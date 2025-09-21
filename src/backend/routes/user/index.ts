import { FastifyInstance } from 'fastify';
import { settings } from './settings';
import { problems } from './problems';

export async function user(app: FastifyInstance) {
  app.register(settings);
  app.register(problems);
}