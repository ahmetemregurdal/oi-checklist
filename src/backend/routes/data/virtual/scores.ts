import { db } from '@db';
import { FastifyInstance } from 'fastify';
import { contestContexts } from '@config';

// Returns the raw data for specified virtual contests (expects IDs)
// This includes medal cutoffs, per participant ranklists, etc
export async function scores(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['contests'],
      properties: {
        contests: {
          type: 'array',
          items: { type: 'number' }
        }
      }
    }
  };
  app.post<{ Body: { contests: number[] } }>('/scores', { schema }, async (req) => {
    let { contests } = req.body;
    let data = await db.contest.findMany({
      where: { id: { in: contests } },
      include: { scores: true }
    });
    // exclude private scores (like ICO)
    for (let i of data) {
      if (i.scores?.isPrivate) {
        i.scores = null;
      }
      // append user context
      if (i.userContext) {
        (i as any).userContext = contestContexts[i.userContext];
      }
    }
    return data;
  });
}