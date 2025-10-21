import { FastifyInstance } from 'fastify';
import { ojuz } from './ojuz';

export async function link(app: FastifyInstance) {
  app.register(ojuz);
}