import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

// Toggles following
export async function follow(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['username', 'token'],
      properties: {
        token: { type: 'string' },
        username: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string, username: string } }>('/follow', { schema }, async (req) => {
    const { token, username } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.BadRequest('Invalid token');
    }
    const followerId = session.userId;
    const followed = await db.user.findUnique({ where: { username } });
    if (!followed) {
      throw createError.NotFound('User not found');
    }
    const followedId = followed.id;
    if (followerId == followedId) {
      throw createError.BadRequest('You cannot follow yourself');
    }
    const existing = await db.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } }
    });
    if (existing) {
      await db.follow.delete({
        where: { followerId_followedId: { followerId, followedId } }
      });
      return { success: true };
    }
    await db.follow.create({
      data: { followerId, followedId }
    });
    return { success: true };
  });
}