import { FastifyInstance } from 'fastify';
import { contestContexts } from '@config';
import createError from 'http-errors';
import { db } from '@db';

export async function context(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'contestId', 'type', 'context'],
      properties: {
        token: { type: 'string' },
        contestId: { type: 'number' },
        type: { type: 'string' },
        context: {
          type: 'object',
          additionalProperties: { type: 'string' }
        }
      }
    }
  };
  app.post<{ Body: { token: string, contestId: number, type: keyof typeof contestContexts, context: Record<string, string> } }>('/context', { schema }, async (req) => {
    const { token, contestId, type, context } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    if (!Object.prototype.hasOwnProperty.call(contestContexts, type)) {
      throw createError.NotFound('Invalid type');
    }
    const validKeys = new Set<string>(contestContexts[type].fields.map(f => f.key));
    for (const [key, val] of Object.entries(context)) {
      if (!validKeys.has(key)) {
        throw createError.BadRequest(`Invalid key ${key} for context type ${type}`);
      }
      const field = contestContexts[type].fields.find(f => f.key == key);
      if (!field.options.includes(val)) {
        throw createError.BadRequest(`Invalid key ${val} for key ${key}`);
      }
    }
    // it's valid, dump to db
    const contest = await db.userVirtualContest.findUnique({
      where: {
        userId_contestId: { userId, contestId }
      }
    });
    if (!contest) {
      throw createError.NotFound(`You haven't attempted that contest yet`);
    }
    await db.userVirtualContest.update({
      where: { id: contest.id },
      data: { userContextData: context }
    });
    return { success: true };
  });
}