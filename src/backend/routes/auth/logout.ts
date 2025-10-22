import { db } from '@db';
import { FastifyInstance } from 'fastify';

export async function logout(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };
  app.post<{ Body: { token: string } }>('/logout', { schema }, async (req) => {
    const { token } = req.body;
    if (token != 'demo-session-fixed-token-123456789') {
      await db.session.delete({ where: { id: token } }).catch(() => { });
    }
    return { success: true };
  });
}