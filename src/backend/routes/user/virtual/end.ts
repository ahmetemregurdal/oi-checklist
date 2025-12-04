import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';
import { addMinutes, min } from 'date-fns';
import { ojuz, qoj, codechef } from '@bridge';
import { VirtualSubmission } from '@prisma/client';

function isFulfilled<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> {
  return r.status == 'fulfilled';
}

export async function end(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string } }>('/end', { schema }, async (req) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    // check if there's an active contest
    const userId = session.userId;
    let contest = await db.activeVirtualContest.findUnique({
      where: { userId },
      include: {
        contest: {
          include: {
            problems: {
              include: {
                problem: {
                  include: { problemLinks: true }
                }
              }
            }
          }
        }
      }
    });
    if (!contest) {
      throw createError.NotFound('No active contest exists');
    }
    // capped by actual duration
    contest.endedAt = min([
      new Date(),
      addMinutes(contest.startedAt, contest.contest.duration),
    ]);
    // persist to db
    await db.activeVirtualContest.update({
      where: { userId },
      data: { endedAt: contest.endedAt }
    });

    if (!contest.autosynced) {
      return { success: true };
    }

    // autosync across multiple platforms 
    const usernames = (await db.settings.findUnique({
      where: { userId },
      select: { platformUsernames: true }
    })).platformUsernames as Record<string, string> | null;
    const platforms: Promise<{ error?: string; submissions?: VirtualSubmission[] }>[] = [];
    if (usernames?.['oj.uz']) {
      platforms.push(ojuz.fetchContestScores(usernames['oj.uz'], contest));
    }
    if (usernames?.['qoj.ac']) {
      platforms.push(qoj.fetchContestScores(usernames['qoj.ac'], contest));
    }
    if (usernames?.['codechef']) {
      platforms.push(codechef.fetchContestScores(usernames['codechef'], contest));
    }
    const submissions = (await Promise.allSettled(platforms))
      .filter(isFulfilled)
      .filter(r => !r.value.error)
      .flatMap(r => r.value.submissions);

    // persist to db
    await Promise.all(
      submissions.map(i => db.virtualSubmission.create({
        data: {
          activeVirtualContestUserId: userId,
          contestProblemId: i.contestProblemId,
          time: i.time,
          score: i.score,
          subtaskScores: i.subtaskScores
        }
      })
      )
    );

    const map: Record<number, number[][]> = {};
    submissions.forEach(s => {
      (map[s.contestProblemId] ??= []).push(s.subtaskScores as number[]);
    });

    // get problem indices
    const contestProblems = await db.contestProblem.findMany({ where: { contestId: contest.contestId } });
    const n = contest.contest.problems.length;
    const perProblemScores: number[] = Array(n).fill(0);

    // normalise subtasks across platforms
    // i mean ideally this shouldn't happen, but it does, so oh well
    // also computes subtask wise max
    for (const [idStr, subs] of Object.entries(map)) {
      const id = Number(idStr);
      const maxLen = Math.max(...subs.map(a => a.length));
      const merged = Array(maxLen).fill(0);
      for (const arr of subs) {
        for (let i = 0; i < arr.length; ++i) {
          merged[i] = Math.max(merged[i], arr[i] ?? 0);
        }
      }
      const idx = contestProblems.find(i => i.id == id).problemIndex;
      perProblemScores[idx] = merged.reduce((a, b) => a + b);
    }

    const score = perProblemScores.reduce((a, b) => a + b);
    // persist to db
    await db.activeVirtualContest.update({
      where: { userId },
      data: { score, perProblemScores }
    });

    return { success: true, submissions };
  });
}