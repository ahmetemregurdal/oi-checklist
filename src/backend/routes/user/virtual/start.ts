import { FastifyInstance } from 'fastify';
import { db } from '@db';
import createError from 'http-errors';

export async function start(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'autosynced', 'name'],
      properties: {
        token: { type: 'string' },
        autosynced: { type: 'boolean' },
        name: { type: 'string' },
        stage: { type: ['string', 'null'] }
      }
    }
  };
  app.post<{ Body: { token: string, autosynced: boolean, name: string, stage?: string | null } }>('/start', { schema }, async (req) => {
    const { token, autosynced, name, stage } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    // we shouldn't already have an active vc
    if (await db.activeVirtualContest.findUnique({ where: { userId: session.userId } })) {
      throw createError.BadRequest('You already have an active virtual contest');
    }
    // we shouldn't have already completed this vc
    const contest = await db.contest.findUnique({ where: { name_stage: { name, stage: stage ?? '' } } });
    if (!contest) {
      throw createError.NotFound('Contest not found');
    }
    if (await db.userVirtualContest.findUnique({ where: { userId_contestId: { userId: session.userId, contestId: contest.id } } })) {
      throw createError.BadRequest(`You've already completed this virtual contest`);
    }
    // start the virtual contest
    await db.activeVirtualContest.create({
      data: {
        userId: session.userId,
        contestId: contest.id,
        startedAt: new Date(),
        autosynced,
      }
    });
    return { success: true };
  });
}