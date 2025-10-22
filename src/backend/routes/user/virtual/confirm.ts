import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';
import { UserVirtualContest } from '@prisma/client';

export async function confirm(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string } }>('/confirm', { schema }, async (req) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    const activeContest = await db.activeVirtualContest.findUnique({
      where: { userId },
      include: {
        contest: {
          include: {
            problems: {
              include: {
                problem: {
                  include: {
                    userProblemsData: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!activeContest) {
      throw createError.NotFound('No active virtual contest exists');
    }
    // if endedAt, score, or perProblemScores are null then this endpoint wasn't meant to be called
    if (!activeContest.endedAt || activeContest.score == null || !activeContest.perProblemScores) {
      throw createError.BadRequest('Contest not ended yet or data incomplete');
    }
    // update problem scores in the database
    const n = activeContest.contest.problems.length;
    let indexToId: number[] = Array(n).fill(0);
    let scores: number[] = Array(n).fill(0);
    activeContest.contest.problems.forEach(p => {
      indexToId[p.problemIndex] = p.problemId;
      scores[p.problemIndex] = p.problem.userProblemsData[0]?.score ?? 0;
    });
    let contestScores = activeContest.perProblemScores as number[];
    for (let i = 0; i < n; ++i) {
      let score = Math.max(scores[i], contestScores[i]);
      let status = score == 100 ? 2 : score > 0 ? 1 : 0;
      // persist to db
      await db.userProblemData.upsert({
        where: { userId_problemId: { userId, problemId: indexToId[i] } },
        create: { userId, problemId: indexToId[i], score, status },
        update: { score, status }
      });
    }

    // move the active virtual contest to completed user virtualc ontests
    let data = {
      userId: activeContest.userId,
      contestId: activeContest.contestId,
      startedAt: activeContest.startedAt,
      endedAt: activeContest.endedAt,
      score: activeContest.score,
      perProblemScores: activeContest.perProblemScores,
    };
    const contest = await db.userVirtualContest.create({ data });
    // move all submissions
    await db.virtualSubmission.updateMany({
      where: { activeVirtualContestUserId: userId },
      data: { virtualContestId: contest.id, activeVirtualContestUserId: null }
    });
    // delete the active contest
    await db.activeVirtualContest.delete({ where: { userId } });
    return { success: true };
  });
}