import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';
import { codechef as codechefApi } from '@bridge';

export async function codechef(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'cookie'],
      properties: {
        token: { type: 'string' },
        cookie: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string, cookie: string } }>('/verify', { schema }, async (req) => {
    const { token, cookie } = req.body;
    let session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    let res = await codechefApi.verify(cookie);
    if (res.error) {
      throw new createError.Unauthorized(res.error);
    }
    // persist into db
    let settings = await db.settings.findUnique({ where: { userId }, select: { platformUsernames: true } });
    let existing = settings.platformUsernames ?? {};
    existing['codechef'] = res.username;
    await db.settings.update({ where: { userId }, data: { platformUsernames: existing } });
    return { valid: true, username: res.username };
  });

  app.post<{ Body: { token: string, cookie: string } }>('/update', { schema }, async (req) => {
    const { token, cookie } = req.body;
    let session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    let problems = (
      await db.problemLink.findMany({
        where: { platform: 'codechef' },
        include: { problem: { include: { problemLinks: true } } },
        orderBy: { problemId: 'asc' }
      })
    ).map(i => i.problem);

    let settings = await db.settings.findUnique({ where: { userId }, select: { platformUsernames: true } });
    if (!settings.platformUsernames || !settings.platformUsernames['codechef']) {
      throw new createError.BadRequest('codechef username not set');
    }
    let results = await codechefApi.fetchProblemScores(cookie, settings.platformUsernames['codechef'], problems);
    if (results.error) {
      throw new createError.Forbidden(results.error);
    }
    const resultsMap = new Map(results.scores.map(i => [i.problemId, i]));

    // fetch old progress
    let progress = await db.userProblemData.findMany({
      where: {
        userId,
        problemId: { in: problems.map(i => i.id) }
      },
      orderBy: { problemId: 'asc' }
    });
    const progressMap = new Map(progress.map(i => [i.problemId, i]));

    // update progress
    for (const problem of problems) {
      let oldScore = progressMap.get(problem.id)?.score ?? 0;
      let score = Math.max(oldScore, resultsMap.get(problem.id)?.score ?? 0);
      let status = score == 100 ? 2 : score > 0 ? 1 : 0;
      if (score != oldScore) {
        await db.userProblemData.upsert({
          where: { userId_problemId: { userId, problemId: problem.id } },
          create: { userId, problemId: problem.id, score, status },
          update: { score, status }
        });
      }
    }

    return { success: true };
  });
}