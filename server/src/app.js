// The API as a Fastify app, built from its parts so the tests can make one with their own database and
// storage (and call it with app.inject, without a network).
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuth } from './auth.js';
import { ApiError } from './records.js';
import { designRoutes } from './routes/designs.js';
import { fabricRoutes } from './routes/fabrics.js';
import { changeRoutes } from './routes/changes.js';

/**
 * @param {{ config: import('./config.js').Config, pool: import('pg').Pool, store: import('./objects.js').ObjectStore, logger?: any }} deps
 */
export async function buildApp({ config, pool, store, logger = false }) {
  const app = Fastify({
    logger,
    bodyLimit: config.maxDesignBytes,
    // unknown fields are refused, not silently dropped (Fastify's default drops them)
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'PUT', 'POST', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-dev-user'],
  });

  app.setErrorHandler((/** @type {any} */ err, req, reply) => {
    if (err instanceof ApiError)
      return reply.code(err.status).send({ error: err.code, message: err.message, ...err.extra });
    if (err.validation) return reply.code(400).send({ error: 'bad_request', message: err.message });
    if (err.statusCode && err.statusCode < 500)
      return reply.code(err.statusCode).send({ error: err.code || 'bad_request', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: 'Something went wrong on the server.' });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'not_found', message: 'No such address.' }));

  app.get('/health', async () => {
    await pool.query('select 1');
    return { ok: true };
  });
  // development storage (objects.js localStore) serves its own upload and download links
  if ('routes' in store && typeof store.routes === 'function') store.routes(app, config.maxFabricBytes);
  registerAuth(app, config, pool);
  designRoutes(app, pool);
  fabricRoutes(app, pool, store, config);
  changeRoutes(app, pool);
  return app;
}
