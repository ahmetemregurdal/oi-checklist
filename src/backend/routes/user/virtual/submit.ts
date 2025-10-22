import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';

export async function submit(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'scores'],
      properties: {
        token: { type: 'string' },
        scores: {
          type: 'array',
          items: {
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      }
    }
  };
  app.post<{ Body: { token: string, scores: number[] } }>('/submit', { schema }, async (req) => {
    const { token, scores } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    let activeContest = await db.activeVirtualContest.findUnique({
      where: { userId },
      include: {
        contest: {
          include: { problems: true }
        }
      }
    });
    if (!activeContest) {
      throw createError.NotFound('No active virtual contest exists!');
    }
    // if endedAt is null then this endpoint wasn't meant to be called
    if (!activeContest.endedAt) {
      throw createError.BadRequest('Contest not ended yet');
    }
    // "national security check"
    if (activeContest.autosynced) {
      throw createError.Forbidden(`You can't manaully modify scores for autosynced contests!`);
    }
    const n = activeContest.contest.problems.length;
    if (scores.length != n) {
      throw createError.BadRequest(`You must specify exactly ${n} scores`);
    }
    const score = scores.reduce((a, b) => a + b);
    let data = {
      userId,
      contestId: activeContest.contestId,
      startedAt: activeContest.startedAt,
      endedAt: activeContest.endedAt,
      score,
      perProblemScores: scores
    };
    // move the contest
    await db.userVirtualContest.create({ data });
    await db.activeVirtualContest.delete({ where: { userId } });
    return { success: true };
  });
}