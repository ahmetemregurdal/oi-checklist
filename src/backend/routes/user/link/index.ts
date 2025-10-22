import { FastifyInstance } from 'fastify';
import { ojuz } from './ojuz';
import { qoj } from './qoj';

export async function link(app: FastifyInstance) {
  app.register(ojuz, { prefix: '/ojuz' });
  app.register(qoj, { prefix: '/qoj' });
}