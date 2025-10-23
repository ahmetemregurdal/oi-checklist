import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import createError from 'http-errors';
import { auth } from './routes/auth';
import { user } from './routes/user';
import { data } from './routes/data';

const app = fastify();

app.register(auth, { prefix: '/auth' });
app.register(user, { prefix: '/user' });
app.register(data, { prefix: '/data' });

app.register(fastifyStatic, {
  root: path.join(__dirname, '../static/html'),
  decorateReply: true,
  serve: false
});

fs.readdirSync(path.join(__dirname, `../static/html`)).forEach(i => {
  if (!i.endsWith('.html') || i == '404.html') {
    return;
  }
  app.get(`/${i.replace('index.html', '').replace(/\.html$/, '')}`, (_req, res) => {
    return res.sendFile(i, path.join(__dirname, `../static/html`));
  });
});

app.get('/profile/:username', (_req, res) => {
  return res.sendFile('index.html', path.join(__dirname, '../static/html'));
});

app.setNotFoundHandler((_req, res) => {
  res.code(404).sendFile('404.html', path.join(__dirname, '../static/html'));
});

for (const i of ['js', 'css', 'images']) {
  app.register(fastifyStatic, {
    root: path.join(__dirname, `../static/${i}`),
    prefix: `/${i}/`,
    decorateReply: false
  });
}

app.setErrorHandler((err, req, res) => {
  if (err.validation) {
    res.status(400).send({ error: 'Bad request', message: err.message, details: err.validation });
    return;
  }
  if (createError.isHttpError(err)) {
    res.status(err.statusCode).send({ error: err.message });
    return;
  }
  console.error('Unhandled error: ', err);
  res.status(500).send({ error: 'Internal server error' });
});

app.listen({ port: 5501 }).then(() => {
  console.log('Running at http://localhost:5501');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});