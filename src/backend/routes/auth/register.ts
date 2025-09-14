import createError from 'http-errors';
import crypto from 'crypto';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

export async function register(app: FastifyInstance) {
  app.post<{ Body: { username: string; password: string } }>('/register', async (req) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new createError.BadRequest('Missing username or password');
    }
    if (await db.user.findUnique({ where: { username: username } })) {
      throw new createError.Conflict('Username taken');
    }
    await db.user.create({
      data: {
        username,
        password: crypto.createHash('sha256').update(password).digest('hex')
      }
    });
    return { success: true };
  });
}