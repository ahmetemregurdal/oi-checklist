import { FastifyInstance } from 'fastify';
import { settings } from './settings';

export async function user(app: FastifyInstance) {
  app.register(settings);
}