import createError from 'http-errors';
import crypto from 'crypto';
import { db } from '@db';
import { GoogleClientId, GoogleClientSecret, RootUrl } from '@config';
import { FastifyInstance } from 'fastify';
import { User } from '@prisma/client';

export async function google(app: FastifyInstance) {
  const provider = 'google';
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
  const scope = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

  const deriveBaseUsername = (email?: string | null, name?: string | null) => {
    if (email && email.includes('@')) {
      return email.split('@', 1)[0].toLowerCase();
    }
    if (name) {
      const sanitized = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
      if (sanitized) return sanitized;
    }
    return 'google-user';
  };

  const ensureUniqueUsername = async (candidate: string): Promise<string> => {
    let suffix = 0;
    let attempt = candidate;
    while (await db.user.findUnique({ where: { username: attempt } })) {
      suffix++;
      attempt = `${candidate}${suffix}`;
    }
    return attempt;
  };

  app.get('/google/start', async () => {
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state } });
    const params = new URLSearchParams({
      client_id: GoogleClientId,
      redirect_uri: `${RootUrl}/auth/google/callback`,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent'
    });
    return { redirect: `${authUrl}?${params}` };
  });

  app.get<{ Querystring: { code?: string; state?: string } }>('/google/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      throw new createError.BadRequest('Missing state/code');
    }
    const dbState = await db.oAuthState.findUnique({ where: { id: state } });
    if (!dbState) {
      throw new createError.Forbidden('Invalid state');
    }
    await db.oAuthState.delete({ where: { id: state } });
    const redirectUri = `${RootUrl}/auth/google/callback`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: GoogleClientId,
        client_secret: GoogleClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }).toString()
    });
    if (!tokenResponse.ok) {
      throw new createError.BadGateway('Token exchange failed');
    }
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new createError.Unauthorized('No access token');
    }

    const userInfoResponse = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userInfoResponse.ok) {
      throw new createError.BadRequest('Failed to fetch user info from Google');
    }
    const userInfo = await userInfoResponse.json() as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    const providerUserId = userInfo?.sub;
    if (!providerUserId) {
      throw new createError.BadRequest('Missing Google user identifier');
    }

    const baseUsername = deriveBaseUsername(userInfo.email, userInfo.name);
    const displayName = userInfo.name || userInfo.email || 'Google User';

    const existingIdentity = await db.authIdentity.findFirst({
      where: { provider, providerUserId }
    });

    let redirectTarget = dbState.redirectUri ?? `${RootUrl}`;
    try {
      redirectTarget = decodeURIComponent(redirectTarget);
    } catch (_) {
      // keep redirectTarget untouched if decoding fails
    }

    let user: User;

    if (existingIdentity) {
      user = await db.user.findUnique({ where: { id: existingIdentity.userId } });
      if (!user) {
        throw new createError.InternalServerError('User missing for existing Google identity');
      }
    } else if (dbState.userId) {
      user = await db.user.findUnique({ where: { id: dbState.userId } });
      if (!user) {
        throw new createError.InternalServerError('User missing for linking context');
      }
      await db.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId,
          displayName
        }
      });
    } else {
      const uniqueUsername = await ensureUniqueUsername(baseUsername);
      user = await db.user.create({
        data: {
          username: uniqueUsername,
          settings: { create: {} }
        }
      });

      await db.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId,
          displayName
        }
      });
    }

    const session = await db.session.create({
      data: {
        userId: user.id,
        id: crypto.randomBytes(32).toString('hex')
      }
    });

    res.redirect(`${RootUrl}/google-auth-success?token=${session.id}&redirect_to=${redirectTarget}&username=${user.username}`);
  });

  app.get<{ Querystring: { token?: string; session_id?: string; redirectTo?: string; redirect_to?: string } }>('/google/link', async (req, res) => {
    const token = req.query.token ?? req.query.session_id;
    if (!token) {
      throw new createError.Forbidden('Missing session token');
    }
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Forbidden('Invalid or expired token');
    }
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (user.username === 'demo-user') {
      throw new createError.BadRequest('Demo user can\'t link Google accounts');
    }
    const redirectTo = req.query.redirectTo ?? req.query.redirect_to ?? `${RootUrl}`;
    const state = crypto.randomBytes(16).toString('hex');
    await db.oAuthState.create({ data: { id: state, userId: user.id, redirectUri: redirectTo } });
    const params = new URLSearchParams({
      client_id: GoogleClientId,
      redirect_uri: `${RootUrl}/auth/google/callback`,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent'
    });
    return res.redirect(`${authUrl}?${params}`);
  });

  app.get('/google/status', async (req) => {
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
      throw new createError.NotFound('Google not linked');
    }
    return { username: identity.displayName };
  });

  app.post<{ Body: { token?: string } }>('/google/unlink', async (req) => {
    const token = req.body.token;
    if (!token) {
      throw new createError.Forbidden('Missing session token');
    }
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Forbidden('Invalid or expired token');
    }
    const user = await db.user.findUnique({ where: { id: session.userId }, include: { authIdentities: true } });
    if (!user.authIdentities?.some(identity => identity.provider === provider)) {
      throw new createError.NotFound('No linked Google account');
    }
    if (user.authIdentities.length + +(user.password != null) === 1) {
      throw new createError.BadRequest('You cannot unlink Google as it\'s your only login method!');
    }
    const identity = user.authIdentities.find(i => i.provider === provider);
    if (!identity) {
      throw new createError.NotFound('No linked Google account');
    }
    await db.authIdentity.delete({ where: { id: identity.id } });
    return { success: true, message: 'Google unlinked successfully' };
  });
}
