import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';

export async function history(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };
  // todo fix in frontend
  app.post<{ Body: { token: string } }>('/history', { schema }, async (req) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userContests = await db.userVirtualContest.findMany({ where: { userId: session.userId }, orderBy: { endedAt: 'desc' } });
    return userContests;
  });
}