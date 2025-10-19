import createError from 'http-errors';
import crypto from 'crypto';
import { db } from '@db';
import { root, RootUrl, GithubClientId, GithubClientSecret } from '@config';
import { FastifyInstance } from 'fastify';
import { User } from '@prisma/client';

export async function github(app: FastifyInstance) {
  const provider = 'github';
  const authUrl = 'https://github.com/login/oauth/authorize';
  const tokenUrl = 'https://github.com/login/oauth/access_token';
  const userApi = 'https://api.github.com/user';

  app.get('/github/start', async () => {
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state } });
    const params = new URLSearchParams({
      client_id: GithubClientId,
      redirect_uri: `${RootUrl}/auth/github/callback`,
      state,
      scope: 'read:user'
    });
    return { redirect: `${authUrl}?${params}` };
  });

  app.get<{ Querystring: { code: string, state: string } }>('/github/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      throw new createError.BadRequest('Missing state/code');
    }
    const dbState = await db.oAuthState.findUnique({ where: { id: state } });
    if (!dbState) {
      throw new createError.Forbidden('Invalid state');
    }
    await db.oAuthState.delete({ where: { id: state } });
    const redirTo = dbState.redirectUri ?? RootUrl;
    const request = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GithubClientId,
        client_secret: GithubClientSecret,
        redirect_uri: `${RootUrl}/auth/github/callback`,
        code,
        state
      })
    });
    if (!request.ok) {
      throw new createError.BadGateway('Token exchange failed');
    }
    const response = await request.json() as { access_token?: string; error?: string };
    if (!response.access_token) {
      throw new createError.Unauthorized(response.error ?? 'No access token');
    }

    const gh = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${response.access_token}`,
          'User-Agent': 'oi-checklist'
        }
      });
      if (!res.ok) {
        throw new createError.BadRequest(`${url} failed`);
      }
      return res.json();
    };
    const ghUser = await gh(userApi) as { id: number; login: string };
    const authIdentity = await db.authIdentity.findFirst({ where: { provider, providerUserId: ghUser.id.toString() } });
    let user: User;
    if (authIdentity) { // already linked to an account
      user = await db.user.findUnique({ where: { id: authIdentity.userId } });
    } else if (dbState.userId) { // link
      user = await db.user.findUnique({ where: { id: dbState.userId } });
      await db.authIdentity.create({
        data: {
          userId: dbState.userId,
          provider,
          providerUserId: ghUser.id.toString(),
          displayName: ghUser.login
        }
      });
    } else { // create new user    
      let i = 0;
      while (await db.user.findUnique({ where: { username: ghUser.login + (i ? `${i}` : '') } })) {
        i++;
      }
      user = await db.user.create({
        data: {
          username: ghUser.login + (i ? `${i}` : ''),
          settings: { create: {} }
        }
      });
      await db.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: ghUser.id.toString(),
          displayName: ghUser.login
        }
      });
    }
    const session = await db.session.create({
      data: {
        userId: user.id,
        id: crypto.randomBytes(32).toString('hex')
      }
    });
    res.redirect(`${RootUrl}/github-auth-success?token=${session.id}&redirect_to=${redirTo}&username=${user.username}`);
  });

  app.get<{ Querystring: { token?: string; redirectTo?: string } }>('/github/link', async (req, res) => {
    const token = req.query.token;
    if (!token) {
      throw new createError.Forbidden('Missing session token');
    }
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Forbidden('Invalid or expired token');
    }
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (user.username == 'demo-user') {
      throw new createError.BadRequest('Demo user can\'t link GitHub accounts');
    }
    const redirectTo = req.query.redirectTo ?? `${RootUrl}`;
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state, userId: user.id, redirectUri: redirectTo } });
    const params = new URLSearchParams({
      client_id: GithubClientId,
      redirect_uri: `${RootUrl}/auth/github/callback`,
      state,
      scope: 'read:user'
    });
    return res.redirect(`${authUrl}?${params}`);
  });

  app.get('/github/status', async (req) => {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader != 'string' || !authHeader.startsWith('Bearer ')) {
      throw new createError.Forbidden('Missing session token');
    }
    const token = authHeader.slice(7).trim();
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Forbidden('Invalid or expired token');
    }
    const identity = await db.authIdentity.findFirst({ where: { provider, userId: session.userId } });
    if (!identity) {
      throw new createError.NotFound('GitHub not linked');
    }
    return { username: identity.displayName };
  });

  app.post<{ Body: { token: string } }>('/github/unlink', async (req) => {
    const { token } = req.body;
    if (!token) {
      throw new createError.Forbidden('Missing session token');
    }
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Forbidden('Invalid or expired token');
    }
    const user = await db.user.findUnique({ where: { id: session.userId }, include: { authIdentities: true } });
    if (!user.authIdentities?.some(i => i.provider == provider)) {
      throw new createError.NotFound('No linked GitHub account');
    }
    if (user.authIdentities.length + +(user.password != null) == 1) {
      throw new createError.BadRequest('You cannot unlink GitHub as it\'s your only login method!');
    }
    await db.authIdentity.delete({ where: { id: user.authIdentities.find(i => i.provider == provider).id } });
    return { success: true, message: 'GitHub unlinked successfully' };
  });
}
