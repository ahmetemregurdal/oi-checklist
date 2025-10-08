import { FastifyInstance } from 'fastify';
import { register } from './register';
import { login } from './login';
import { check } from './check';
import { github } from './github';
import { discord } from './discord';
import { google } from './google';

export async function auth(app: FastifyInstance) {
  app.register(register);
  app.register(login);
  app.register(check);
  app.register(github);
  app.register(discord);
  app.register(google);
}
