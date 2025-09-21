import { FastifyInstance } from 'fastify';
import { problems } from './problems';

export async function data(app: FastifyInstance) {
  app.register(problems);
}