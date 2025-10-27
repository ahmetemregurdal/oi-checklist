import { FastifyInstance } from 'fastify';
import { db } from '@db';
import createError from 'http-errors';

export async function export_(app: FastifyInstance) {
  const schema = {
    body: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    }
  };

  app.post<{ Body: { token: string } }>('/export', { schema }, async (req, res) => {
    const { token } = req.body;
    const session = await db.session.findUnique({ where: { id: token } });
    if (!session) {
      throw createError.Unauthorized('Invalid token');
    }
    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        authIdentities: true,
        problemsData: { include: { problem: true } },
        settings: true,
        virtualContests: { include: { submissions: { include: { problem: { include: { problem: true } } } }, contest: { include: { problems: { include: { problem: true } } } } } },
        activeVirtualContest: { include: { submissions: { include: { problem: { include: { problem: true } } } }, contest: { include: { problems: { include: { problem: true } } } } } }
      }
    });
    res.header('Content-Disposition', `attachment; filename=${user.username}_${(new Date()).toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-')}_export.json`);
    res.type('application/json');
    return res.send(user);
  });
}