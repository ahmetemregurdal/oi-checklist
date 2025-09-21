import createError from 'http-errors';
import crypto from 'crypto';
import { db } from '@db';
import { DiscordClientId, DiscordClientSecret, RootUrl } from '@config';
import { FastifyInstance } from 'fastify';
import { User } from '@prisma/client';

export async function discord(app: FastifyInstance) {
  const provider = 'discord';
  const authUrl = 'https://discord.com/oauth2/authorize';
  const tokenUrl = 'https://discord.com/api/oauth2/token';
  const userApi = 'https://discord.com/api/users/@me';
  const scope = 'identify';

  app.get('/discord/start', async () => {
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state } });
    const params = new URLSearchParams({
      client_id: DiscordClientId,
      redirect_uri: `${RootUrl}/auth/discord/callback`,
      response_type: 'code',
      scope,
      state
    });
    return { redirect: `${authUrl}?${params}` };
  });

  app.get<{ Querystring: { code?: string; state?: string } }>('/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      throw new createError.BadRequest('Missing state/code');
    }
    const dbState = await db.oAuthState.findUnique({ where: { id: state } });
    if (!dbState) {
      throw new createError.Forbidden('Invalid state');
    }
    await db.oAuthState.delete({ where: { id: state } });
    const redirTo = dbState.redirectUri ?? `${RootUrl}`;
    const request = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: DiscordClientId,
        client_secret: DiscordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${RootUrl}/auth/discord/callback`
      }).toString()
    });
    if (!request.ok) {
      throw new createError.BadGateway('Token exchange failed');
    }
    const response = await request.json() as { access_token?: string; token_type?: string };
    if (!response.access_token) {
      throw new createError.Unauthorized('No access token');
    }

    const disc = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${response.access_token}`
        }
      });
      if (!res.ok) {
        throw new createError.BadRequest(`${url} failed`);
      }
      return res.json();
    };

    const discUser = await disc(userApi) as { id: string; username?: string; discriminator?: string; global_name?: string; };
    const authIdentity = await db.authIdentity.findFirst({ where: { provider, providerUserId: discUser.id.toString() } });
    let user: User;
    if (authIdentity) { // already linked to an account
      user = await db.user.findUnique({ where: { id: authIdentity.userId } });
    } else if (dbState.userId) { // link
      user = await db.user.findUnique({ where: { id: dbState.userId } });
      await db.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: discUser.id.toString(),
          displayName: discUser.username
        }
      });
    } else {
      let i = 0;
      while (await db.user.findUnique({ where: { username: discUser.username + (i ? `${i}` : '') } })) {
        i++;
      }
      user = await db.user.create({
        data: {
          username: discUser.username + (i ? `${i}` : ''),
          settings: { create: {} }
        }
      });
      await db.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: discUser.id.toString(),
          displayName: discUser.username
        }
      });
    }
    const session = await db.session.create({
      data: {
        userId: user.id,
        id: crypto.randomBytes(32).toString('hex')
      }
    });
    res.redirect(`${RootUrl}/discord-auth-success?token=${session.id}&redirect_to=${redirTo}&username=${user.username}`);
  });

  app.get<{ Querystring: { token?: string; redirectTo?: string } }>('/discord/link', async (req, res) => {
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
      throw new createError.BadRequest('Demo user can\'t link Discord accounts');
    }
    const redirectTo = req.query.redirectTo ?? `${RootUrl}`;
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state, userId: user.id, redirectUri: redirectTo } });
    const params = new URLSearchParams({
      client_id: DiscordClientId,
      redirect_uri: `${RootUrl}/auth/discord/callback`,
      response_type: 'code',
      scope,
      state
    });
    return res.redirect(`${authUrl}?${params}`);
  });

  app.get('/discord/status', async (req) => {
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
      throw new createError.NotFound('Discord not linked');
    }
    return { username: identity.displayName, providerUserId: identity.providerUserId };
  });

  app.post<{ Body: { token: string } }>('/discord/unlink', async (req) => {
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
      throw new createError.NotFound('No linked Discord account');
    }
    if (user.authIdentities.length + +(user.password != null) == 1) {
      throw new createError.BadRequest('You cannot unlink Discord as it\'s your only login method!');
    }
    await db.authIdentity.delete({ where: { id: user.authIdentities.find(i => i.provider == provider).id } });
    return { success: true, message: 'Discord unlinked successfully' };
  });
}
