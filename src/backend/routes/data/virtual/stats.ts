import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';

export async function stats(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'contestId'],
      properties: {
        token: { type: 'string' },
        contestId: { type: 'number' }
      }
    }
  };
  app.post<{ Body: { token: string, contestId: number } }>('/stats', { schema }, async (req) => {
    const { token, contestId } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid session');
    }
    const userId = session.userId;
    const contest = await db.userVirtualContest.findUnique({
      where: { userId_contestId: { userId, contestId } },
      include: {
        contest: {
          include: {
            scores: true,
            problems: true
          }
        }
      }
    });
    if (!contest) {
      throw createError.NotFound('Contest not found; have you attempted it / does it exist?');
    }
    // rank per problem = #people that did better than us + 1
    const scores = contest.contest.scores.problemScores as Record<string, number[]>;
    const userScores = contest.perProblemScores as number[];
    let ranks = contest.contest.problems.map(p => {
      const idx = p.problemIndex;
      const arr = scores[String(idx + 1)];
      return Math.min(arr.length, arr.filter(i => i > userScores[idx]).length + 1);
    });
    // same logic for overall rank
    const scoresArr = Object.values(scores)
    const totalScores = scoresArr[0].map((_, i) => scoresArr.reduce((sum, arr) => sum + (arr[i] ?? 0), 0));
    let rank = Math.min(totalScores.length, totalScores.filter(i => i > contest.score).length + 1);
    // average score
    let average = totalScores.reduce((a, b) => a + b) / totalScores.length;
    // return everything
    return { rank, ranks, average, total: totalScores.length };
  });
}