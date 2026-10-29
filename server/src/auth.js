// Who is calling. For now only the stand-in login for development: the app sends `X-Dev-User: <name>` and is
// that user (made on first use). It is refused in production (config.js), and the server warns when it starts.
// A real login provider will replace this with a check of the provider's signed token (Authorization header).

const DEV_NAME = /^[a-z0-9][a-z0-9_.-]{0,39}$/i;

/**
 * Adds request.user ({ id }) to every /v1 request, or answers 401.
 * @param {import('fastify').FastifyInstance} app @param {import('./config.js').Config} config @param {import('pg').Pool} pool
 */
export function registerAuth(app, config, pool) {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    if (config.auth !== 'dev')
      return reply.code(401).send({ error: 'unauthorized', message: 'Sign-in is not set up on this server yet.' });
    const name = req.headers['x-dev-user'];
    if (typeof name !== 'string' || !DEV_NAME.test(name))
      return reply.code(401).send({
        error: 'unauthorized',
        message: 'Development login: send an X-Dev-User header (letters, digits, _ . -).',
      });
    const { rows } = await pool.query(
      `insert into users (auth_sub) values ($1)
       on conflict (auth_sub) do update set auth_sub = excluded.auth_sub
       returning id`,
      ['dev:' + name.toLowerCase()],
    );
    req.user = { id: rows[0].id };
  });
}
