import createError from 'http-errors';
import { db } from '@db';
import { Olympiads, Platforms } from '@config';
import { FastifyInstance } from 'fastify';

export async function settings(app: FastifyInstance) {
  // special edge case for usaco since it's the only one that's grouped
  const olympiads = new Set(Array.from(Olympiads).map(i => i.startsWith('usaco') ? 'usaco' : i));

  app.post<{ Body: { token?: string, updated?: Record<string, any>, username?: string } }>('/settings', async (req) => {
    const { token, username } = req.body;
    if (token) {
      let session = await db.session.findUnique({ where: { id: token } });
      if (!session) {
        throw createError.Unauthorized('Invalid session');
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
              throw createError.BadRequest(`${i} must be an array`);
            }
            if (new Set(updated[i]).size !== updated[i].length) {
              throw createError.BadRequest(`${i} must not contain duplicates`);
            }
            for (const j of updated[i]) {
              if (!(i == 'platformPref' ? Platforms : olympiads).has(j)) {
                throw createError.BadRequest(`Invalid value "${j}" in ${i}`);
              }
            }
            params[i] = updated[i];
          }
          if ('platformUsernames' in updated) {
            const names = updated.platformUsernames;
            if (typeof names != 'object' || names === null || Array.isArray(names)) {
              throw createError.BadRequest('platformUsernames must be an object');
            }
            const existing = (user.settings?.platformUsernames ?? {}) as Record<string, string>;
            for (const [i, j] of Object.entries(names)) {
              if (!Platforms.has(i)) {
                throw createError.BadRequest(`Invalid platform "${i}" in platformUsernames`);
              }
              if (j === null) {
                delete existing[i];
                continue;
              }
              if (typeof j != 'string') {
                throw createError.BadRequest(`Invalid username for platform "${i}"`);
              }
              existing[i] = j;
            }
            params.platformUsernames = { ...existing };
          }
          await db.settings.update({ where: { userId: user.id }, data: params });
          return { success: true };
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw createError.BadRequest('Invalid JSON in "updated"');
          }
          throw createError.BadRequest((e as Error).message);
        }
      }
    }
    if (username) {
      let user = await db.user.findUnique({ where: { username }, include: { settings: true } });
      if (!user?.settings?.checklistPublic) {
        throw createError.Forbidden('User missing or checklist private');
      }
      return user.settings ?? {};
    }
    throw createError.BadRequest('Username unspecified');
  });
}