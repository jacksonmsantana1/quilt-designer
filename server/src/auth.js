// Who is calling. With Auth0 (AUTH_MODE=auth0) the app sends `Authorization: Bearer <token>`: a token Auth0 signed
// for this API, checked here against Auth0's public keys; its `sub` (Auth0's id for the person) is the user, made on
// first use. The stand-in login for development (AUTH_MODE=dev) takes `X-Dev-User: <name>` and is that user; it
// takes Auth0 tokens too when Auth0 is set up, so one local server serves both. Dev is refused in production
// (config.js), and the server warns when it starts.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const DEV_NAME = /^[a-z0-9][a-z0-9_.-]{0,39}$/i;

/** @typedef {Parameters<typeof jwtVerify>[1]} KeySet the keys a token may be signed with */

/** Auth0's public keys for a tenant (fetched when first needed, kept and refreshed by jose). @param {string} domain @returns {KeySet} */
export const auth0Keys = domain => createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));

/**
 * Adds request.user ({ id }) to every /v1 request, or answers 401.
 * @param {import('fastify').FastifyInstance} app @param {import('./config.js').Config} config @param {import('pg').Pool} pool
 * @param {KeySet} [keys] the keys Auth0 tokens are checked with (the tests bring their own)
 */
export function registerAuth(app, config, pool, keys) {
  const a0 = config.auth0;
  const keySet = a0 ? keys || auth0Keys(a0.domain) : null;
  const userFor = async (sub, email) => {
    const { rows } = await pool.query(
      `insert into users (auth_sub, email) values ($1, $2)
       on conflict (auth_sub) do update set email = coalesce(excluded.email, users.email)
       returning id`,
      [sub, email],
    );
    return { id: rows[0].id };
  };
  const refuse = (reply, message) => reply.code(401).send({ error: 'unauthorized', message });

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    if (config.auth === 'none') return refuse(reply, 'Sign-in is not set up on this server yet.');
    const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    if (bearer && keySet) {
      let claims;
      try {
        // signed by the tenant, for this API, not expired; RS256 only (Auth0's default): no "none", no shared secrets
        ({ payload: claims } = await jwtVerify(bearer[1], keySet, {
          issuer: `https://${a0.domain}/`,
          audience: a0.audience,
          algorithms: ['RS256'],
        }));
      } catch (e) {
        return refuse(reply, e?.code === 'ERR_JWT_EXPIRED' ? 'Your sign-in has expired.' : 'Please sign in again.');
      }
      if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.startsWith('dev:'))
        return refuse(reply, 'Please sign in again.');
      req.user = await userFor(claims.sub, typeof claims.email === 'string' ? claims.email : null);
      return;
    }
    if (config.auth !== 'dev') return refuse(reply, 'Please sign in.');
    const name = req.headers['x-dev-user'];
    if (typeof name !== 'string' || !DEV_NAME.test(name))
      return refuse(reply, 'Development login: send an X-Dev-User header (letters, digits, _ . -).');
    req.user = await userFor('dev:' + name.toLowerCase(), null);
  });
}
