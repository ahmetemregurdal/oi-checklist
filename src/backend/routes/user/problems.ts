import createError from 'http-errors';
import { db } from '@db';
import { FastifyInstance } from 'fastify';

// Updates problem status/score and notes
export async function problems(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token', 'id'],
      properties: {
        token: { type: 'string' },
        id: { type: 'number' },
        status: { type: 'integer', minimum: 0, maximum: 3 },
        score: { type: 'number', minimum: 0, maximum: 100 },
        note: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string, id: number, status?: number, score?: number, note?: string } }>('/problems', { schema }, async (req) => {
    const { token, id, status, score, note } = req.body;
    let session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw new createError.BadRequest('Invalid token');
    }
    const userId = session.userId;
    let problem = await db.problem.findUnique({ where: { id } });
    if (!problem) {
      throw new createError.BadRequest(`Invalid problem id: ${id}`);
    }
    await db.userProblemData.upsert({
      where: { userId_problemId: { userId, problemId: id } },
      update: {
        ...(status != undefined ? { status } : {}),
        ...(score != undefined ? { score } : {}),
        ...(note != undefined ? { note } : {})
      },
      create: {
        userId, problemId: id, status: status ?? 0, score: score ?? 0, note: note ?? ""
      }
    });
    return { success: true };
  });
}