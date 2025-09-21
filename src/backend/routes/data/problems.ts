import createError from 'http-errors';
import { db } from '@db';
import { Olympiads } from 'config';
import { FastifyInstance } from 'fastify';
import { Prisma, ProblemLink } from '@prisma/client';

// Returns all problem related data, and notes if auth
export async function problems(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['sources'],
      properties: {
        sources: {
          type: 'array',
          items: { type: 'string' }
        },
        token: { type: 'string' },
        username: { type: 'string' },
        allLinks: { type: 'boolean' }
      }
    }
  };
  app.post<{ Body: { sources: string[]; token?: string; username?: string; allLinks?: boolean; } }>('/problems', { schema }, async (req) => {
    const { sources, token, username, allLinks } = req.body;
    const invalid = sources.find(i => !Olympiads.has(i));
    if (invalid) {
      throw new createError.BadRequest(`Invalid olympiad: ${invalid}`);
    }
    let user: Prisma.UserGetPayload<{ include: { settings: true } }> | null = null;
    let hasAuth = true;
    if (token != null) {
      const session = await db.session.findUnique({ where: { id: token } });
      if (!session) {
        throw new createError.Unauthorized('Invalid (or expired) token');
      }
      user = await db.user.findUnique({ where: { id: session.userId }, include: { settings: true } });
    }
    if (username != null) {
      if (token && user && user.username !== username) {
        hasAuth = false;
      }
      user = await db.user.findUnique({ where: { username }, include: { settings: true } });
    }
    const problems = await db.problem.findMany({
      where: { source: { in: sources } },
      include: {
        problemLinks: true,
        userProblemsData: hasAuth ? { where: { userId: user.id } } : false
      }
    });
    function pickLink(links: ProblemLink[]): string {
      let pref = user.settings.platformPref as string[] ?? ['oj.uz', 'qoj.ac'];
      let chosen = pref.find(platform => links.some(link => link.platform == platform));
      return links.find(link => link.platform == chosen)?.url ?? links[0].url ?? null;
    }
    const result: Record<string, Record<number, any[]>> = {};
    for (const i of problems) {
      const source = i.source.toUpperCase();
      const year = i.year;
      const data = i.userProblemsData[0] ?? { score: 0, status: 0, note: '' };
      if (!result[source]) {
        result[source] = {};
      }
      if (!result[source][year]) {
        result[source][year] = [];
      }
      result[source][year].push({
        extra: i.extra || null,
        ...(allLinks ? {
          links: i.problemLinks.reduce((acc, l) => {
            acc[l.platform] = l.url;
            return acc;
          }, {} as Record<string, string>)
        } : { link: pickLink(i.problemLinks) }),
        id: i.id, name: i.name, number: i.number,
        ...(hasAuth ? { score: data.score, status: data.status, note: data.note } : {}),
        year
      });
    }
    return result;
  });
}
