import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

// Sends profile data for /profile/username
// If auth, sends more data

export async function profile(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['username'],
      properties: {
        username: { type: 'string' },
        token: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { username: string, token?: string } }>('/profile', { schema }, async (req) => {
    // Send:
    // - #1, #2: user id
    // - join date
    // - failed, progress, solved
    // - github, discord, google
    // - last activity time (based on changed any status)
    // - followers

    // If auth:
    // - also report if we're following or not

    const { token, username } = req.body;
    const user = await db.user.findUnique({
      where: { username },
      include: {
        followers: true,
        problemsData: true,
        authIdentities: true
      }
    });
    if (!user) {
      throw createError.NotFound('User not found');
    }

    let areFollowing = 0;
    if (token) {
      const session = await db.session.findUnique({ where: { id: token } });
      if (session) {
        const record = await db.follow.findUnique({
          where: {
            followerId_followedId: {
              followerId: session.userId, followedId: user.id
            }
          }
        });
        if (record) {
          areFollowing = 2;
        } else {
          areFollowing = 1;
        }
      }
    }

    const progress = user.problemsData.filter(i => i.status == 1).length;
    const solved = user.problemsData.filter(i => i.status == 2).length;
    const failed = user.problemsData.filter(i => i.status == 3).length;
    const authIdentities = user.authIdentities.map(i => {
      return {
        displayName: i.displayName,
        provider: i.provider,
      }
    });
    const lastActivityAt = user.problemsData.length ? new Date(Math.max(...user.problemsData.map(p => p.updatedAt.getTime()))) : null;
    const followers = user.followers.length;

    return {
      userId: user.id,
      joinDate: user.createdAt,
      solveStats: { progress, solved, failed },
      authIdentities,
      lastActivityAt,
      followers,
      ...(areFollowing == 0 ? {} : { following: areFollowing - 1 })
    };
  });
}