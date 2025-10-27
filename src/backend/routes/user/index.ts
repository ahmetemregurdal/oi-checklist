import { FastifyInstance } from 'fastify';
import { settings } from './settings';
import { problems } from './problems';
import { virtual } from './virtual';
import { link } from './link';
import { export_ } from './export';

export async function user(app: FastifyInstance) {
  app.register(settings);
  app.register(problems);
  app.register(virtual, { prefix: '/virtual' });
  app.register(link, { prefix: '/link' });
  app.register(export_);
}