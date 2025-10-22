import { db } from '@db';
import { FastifyInstance } from 'fastify';

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
    return data;
  });
}