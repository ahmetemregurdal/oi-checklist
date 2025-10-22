import { db } from '@db';
import { FastifyInstance } from 'fastify';
import createError from 'http-errors';

export async function detail(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        contestId: { type: 'number' },
        slug: { type: 'string' }
      },
      required: ['token'],
      oneOf: [
        { required: ['contestId'] },
        { required: ['slug'] }
      ]
    }
  };
  app.post<{ Body: { token: string, contestId?: number, slug?: string } }>('/detail', { schema }, async (req) => {
    let { token, contestId, slug } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const userId = session.userId;
    if (slug != null) {
      const match = slug.match(/^([a-z]+)(\d{4})(.*)$/i);
      if (!match) {
        throw createError.BadRequest('Invalid slug format');
      }
      const [, namePart, yearPart, stagePart] = match;
      const name = `${namePart.toUpperCase()} ${yearPart}`;
      const stage = stagePart
        ?.replace(/^day(\d+)$/i, 'Day $1')
        .replace(/^./, c => c.toUpperCase()) ?? '';
      const contestRecord = await db.contest.findUnique({
        where: { name_stage: { name, stage } }
      });
      if (!contestRecord) {
        throw createError.NotFound(`That contest doesn't exist`);
      }
      contestId = contestRecord.id;
    }
    const contest = await db.userVirtualContest.findUnique({
      where: { userId_contestId: { userId, contestId } },
      include: { submissions: true }
    });
    if (!contest) {
      throw createError.NotFound(`You haven't attempted this virtual contest yet / the contest doesn't exist`);
    }
    return contest;
  });
}