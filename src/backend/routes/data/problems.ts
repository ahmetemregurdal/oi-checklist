import createError from 'http-errors';
import { db } from '@db';
import { Olympiads } from 'config';
import { FastifyInstance } from 'fastify';
import { User } from '@prisma/client';

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
    let user: User;
    let hasAuth = true;
    if (token) {
      const session = await db.session.findUnique({ where: { id: token } });
      if (!session) {
        throw new createError.Unauthorized('Invalid (or expired) token');
      }
      user = await db.user.findUnique({ where: { id: session.userId } });
    }
    if (username) {
      if (token && user && user.username !== username) {
        hasAuth = false;
      }
      user = await db.user.findUnique({ where: { username } });
    }
    const problems = await db.problem.findMany({
      where: { source: { in: sources } },
      include: {
        problemLinks: true,
        userProblemsData: hasAuth && user ? { where: { userId: user.id } } : false
      },
    });
    const result: Record<string, Record<number, any[]>> = {};
    for (const i of problems) {
      const source = i.source.toUpperCase();
      const year = i.year;
      const data = (i.userProblemsData && i.userProblemsData[0]) ?? { score: 0, status: 0 };
      if (!result[source]) {
        result[source] = {};
      }
      if (!result[source][year]) {
        result[source][year] = [];
      }
      result[source][year].push({
        extra: i.extra || null,
        ...(allLinks ? {
          links: i.problemLinks.reduce(
            (acc, l) => {
              acc[l.platform] = l.url;
              return acc;
            }, {} as Record<string, string>
          )
        } : { link: i.problemLinks[0]?.url ?? null }),
        name: i.name,
        number: i.number,
        score: data.score,
        source,
        status: data.status,
        year
      });
    }
    return result;
  });
}
