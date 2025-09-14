import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

export async function check(app: FastifyInstance) {
  app.post<{ Body: { token: string } }>('/check', async (req) => {
    const { token } = req.body;
    if (!await db.session.findUnique({ where: { id: token } })) {
      throw new createError.Unauthorized('Invalid session');
    }
    return { success: true };
  });
}