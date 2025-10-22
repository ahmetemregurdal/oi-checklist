import { FastifyInstance } from 'fastify';
import { start } from './start';
import { end } from './end';

export async function virtual(app: FastifyInstance) {
  app.register(start);
  app.register(end);
}