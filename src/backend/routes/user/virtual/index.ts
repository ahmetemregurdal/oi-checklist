import { FastifyInstance } from 'fastify';
import { start } from './start';

export async function virtual(app: FastifyInstance) {
  app.register(start);
}