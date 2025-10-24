import { FastifyInstance } from 'fastify';
import { history } from './history';
import { summary } from './summary';
import { scores } from './scores';
import { detail } from './detail';
import { stats } from './stats';

export async function virtual(app: FastifyInstance) {
  app.register(history);
  app.register(summary);
  app.register(scores);
  app.register(detail);
  app.register(stats);
}