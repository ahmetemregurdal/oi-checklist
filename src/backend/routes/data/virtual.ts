import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';
import type { ActiveVirtualContest, Contest, UserVirtualContest } from '@prisma/client';

export async function virtual(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string } }>('/virtual/summary', { schema }, async (req) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Unauthorized('Invalid token');
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        activeVirtualContest: {
          include: {
            contest: true
          }
        },
        virtualContests: {
          include: { contest: true },
          orderBy: { endedAt: 'desc' }
        }
      }
    });

    const contests = await db.contest.findMany({ include: { problems: true } });

    interface Virtual {
      activeContest?: ActiveVirtualContest;
      completedContests?: string[];
      contests?: Contest[];
      recent?: UserVirtualContest[]
    };
    let data: Virtual = {};

    // active contest
    data.activeContest = user.activeVirtualContest ?? null;
    // completed contests
    data.completedContests = user.virtualContests.map(i => `${i.contest.name}|${i.contest.stage}`);
    // all contests
    data.contests = contests;
    // recent contests
    data.recent = user.virtualContests.slice(0, 3);

    return data;
  });

  // todo fix in frontend
  app.post<{ Body: { token: string } }>('/virtual/history', { schema }, async (req) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userContests = await db.userVirtualContest.findMany({ where: { userId: session.userId }, orderBy: { endedAt: 'desc' } });
    return userContests;
  });
}