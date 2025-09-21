import createError from 'http-errors';
import { db } from '@db';
import { Olympiads, Platforms } from '@config';
import { FastifyInstance } from 'fastify';

export async function settings(app: FastifyInstance) {
  app.post<{ Body: { token?: string, updated?: Record<string, any>, username?: string } }>('/settings', async (req) => {
    const { token, username } = req.body;
    if (token) {
      let session = await db.session.findUnique({ where: { id: token } });
      if (!session) {
        throw new createError.Unauthorized('Invalid session');
      }
      let user = await db.user.findUnique({ where: { id: session.userId }, include: { settings: true } });
      if (!username || user.username == username) {
        const { updated } = req.body;
        if (!updated) {
          return user.settings ?? {};
        }
        try {
          let params: Record<string, any> = {};
          for (const i of ['checklistPublic', 'ascSort', 'darkMode'] as const) {
            if (i in updated) {
              params[i] = Boolean(updated[i]);
            }
          }
          for (const i of ['olympiadOrder', 'hiddenOlympiads', 'platformPref'] as const) {
            if (!(i in updated)) {
              continue;
            }
            if (!Array.isArray(updated[i])) {
              throw new createError.BadRequest(`${i} must be an array`);
            }
            if (new Set(updated[i]).size !== updated[i].length) {
              throw new createError.BadRequest(`${i} must not contain duplicates`);
            }
            for (const j of updated[i]) {
              if (!(i == 'platformPref' ? Platforms : Olympiads).has(j)) {
                throw new createError.BadRequest(`Invalid value "${j}" in ${i}`);
              }
            }
            params[i] = updated[i];
          }
          if ('platformUsernames' in updated) {
            const names = updated.platformUsernames;
            if (typeof names != 'object' || names === null || Array.isArray(names)) {
              throw new createError.BadRequest('platformUsernames must be an object');
            }
            const existing = (user.settings?.platformUsernames ?? {}) as Record<string, string>;
            for (const [i, j] of Object.entries(names)) {
              if (!Platforms.has(i)) {
                throw new createError.BadRequest(`Invalid platform "${i}" in platformUsernames`);
              }
              if (j === null) {
                delete existing[i];
                continue;
              }
              if (typeof j != 'string') {
                throw new createError.BadRequest(`Invalid username for platform "${i}"`);
              }
              existing[i] = j;
            }
            params.platformUsernames = { ...existing };
          }
          await db.settings.update({ where: { userId: user.id }, data: params });
          return { success: true };
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new createError.BadRequest('Invalid JSON in "updated"');
          }
          throw new createError.InternalServerError('Something went wrong; are your updated settings correct?');
        }
      }
    }
    if (username) {
      let user = await db.user.findUnique({ where: { username }, include: { settings: true } });
      if (!user?.settings?.checklistPublic) {
        throw new createError.Forbidden('User missing or checklist private');
      }
      return user.settings ?? {};
    }
    throw new createError.BadRequest('Username unspecified');
  });
}