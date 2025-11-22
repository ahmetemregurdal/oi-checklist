import { FastifyInstance } from 'fastify';
import { problems } from './problems';
import { virtual } from './virtual';
import { profile } from './profile';

export async function data(app: FastifyInstance) {
  app.register(problems);
  app.register(virtual, { prefix: '/virtual' });
  app.register(profile);
}