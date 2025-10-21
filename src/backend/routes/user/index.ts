import { FastifyInstance } from 'fastify';
import { settings } from './settings';
import { problems } from './problems';
import { virtual } from './virtual';

export async function user(app: FastifyInstance) {
  app.register(settings);
  app.register(problems);
  app.register(virtual, { prefix: '/virtual' });
}