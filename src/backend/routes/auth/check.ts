import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

export async function check(app: FastifyInstance) {
  app.post<{ Body: { token: string } }>('/check', async (req) => {
    const { token } = req.body;
    if (!token) {
      throw new createError.BadRequest('Missing token');
    }
    let session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.Unauthorized('Invalid session');
    }
    let user = await db.user.findUnique({ where: { id: session.userId }, include: { settings: true } });
    if (user.settings) {
      return { success: true, settings: user.settings };
    }
    return { success: true };
  });
}