import { FastifyInstance } from 'fastify';
import { register } from './register';
import { login } from './login';
import { check } from './check';

export async function auth(app: FastifyInstance) {
  app.register(register);
  app.register(login);
  app.register(check);
}