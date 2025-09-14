import createError from "http-errors";
import crypto from 'crypto';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

export async function login(app: FastifyInstance) {
  app.post<{ Body: { username: string, password: string } }>('/login', async (req) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new createError.BadRequest('Missing username or password');
    }
    const user = await db.user.findUnique({ where: { username: username }, include: { settings: true } });
    if (!user || crypto.createHash('sha256').update(password).digest('hex') != user.password) {
      throw new createError.Unauthorized('Invalid username or password');
    }
    const session = await db.session.create({
      data: {
        userId: user.id,
        id: crypto.randomBytes(32).toString('hex')
      }
    });
    return { token: session.id, settings: user.settings, username: user.username };
  });
}