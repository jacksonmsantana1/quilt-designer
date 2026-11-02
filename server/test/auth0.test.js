// Sign-in with Auth0: the API takes tokens Auth0 signed for it and nothing else. The tests are their own "Auth0":
// a key pair made here signs the tokens, and the API checks them with its public half (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { defaultDesign } from '@quilt/shared/design.js';
import { loadConfig } from '../src/config.js';
import { setup } from './helpers.js';

const DOMAIN = 'quilt-test.eu.auth0.com',
  AUDIENCE = 'https://api.quilt-designer';
const ENV = { AUTH_MODE: 'auth0', AUTH0_DOMAIN: DOMAIN, AUTH0_AUDIENCE: AUDIENCE };

const auth0 = await generateKeyPair('RS256'),
  stranger = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(auth0.publicKey)), kid: 'k1', alg: 'RS256' }] });

/** a token as Auth0 would make it; `o` changes any part of it */
const token = (sub, o = {}) =>
  new SignJWT({ ...(o.claims || {}) })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(o.issuer ?? `https://${DOMAIN}/`)
    .setAudience(o.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(o.expires ?? '1h')
    .sign(o.key ?? auth0.privateKey);

const { withToken, as, pool } = await setup(ENV, undefined, jwks);
const quilt = { name: 'Star', design: defaultDesign(), baseRev: 0 };

test('a token Auth0 signed for this API signs the person in; the same person is the same user', async () => {
  const t = await token('auth0|ana');
  assert.equal((await withToken(t)('PUT', '/v1/designs/q1', quilt)).status, 201); // created
  const again = await withToken(await token('auth0|ana'))('GET', '/v1/designs/q1');
  assert.equal(again.status, 200);
  assert.equal(again.body.name, 'Star');
  const { rows } = await pool.query("select count(*)::int as n from users where auth_sub = 'auth0|ana'");
  assert.equal(rows[0].n, 1);
});

test("one person can't see another's quilts", async () => {
  await withToken(await token('auth0|bea'))('PUT', '/v1/designs/mine', quilt);
  const other = await withToken(await token('google-oauth2|carl'))('GET', '/v1/designs/mine');
  assert.equal(other.status, 404);
});

test('tokens that are not for this API, not from this tenant, expired or forged are refused', async () => {
  const bad = {
    'another API': await token('auth0|ana', { audience: `https://${DOMAIN}/api/v2/` }),
    'another tenant': await token('auth0|ana', { issuer: 'https://someone-else.auth0.com/' }),
    expired: await token('auth0|ana', { expires: Math.floor(Date.now() / 1000) - 60 }),
    'signed by someone else': await token('auth0|ana', { key: stranger.privateKey }),
    'not a token': 'hello',
  };
  for (const [why, t] of Object.entries(bad)) {
    const r = await withToken(t)('GET', '/v1/changes');
    assert.deepEqual([r.status, r.body.error], [401, 'unauthorized'], why);
  }
  assert.equal((await withToken(bad.expired)('GET', '/v1/changes')).body.message, 'Your sign-in has expired.');
});

test('a token with no signature ("alg": "none") is refused', async () => {
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: 'none' })}.${enc({ sub: 'auth0|ana', iss: `https://${DOMAIN}/`, aud: AUDIENCE, exp: now + 600 })}.`;
  assert.equal((await withToken(unsigned)('GET', '/v1/changes')).status, 401);
});

test('a token cannot pass itself off as a development user', async () => {
  assert.equal((await withToken(await token('dev:seed'))('GET', '/v1/changes')).status, 401);
});

test('with Auth0 on, the development header is refused, and no token is refused', async () => {
  assert.equal((await as('ana')('GET', '/v1/changes')).status, 401);
  assert.equal((await as(null)('GET', '/v1/changes')).status, 401);
});

test('development mode with Auth0 set up takes both: the header and Auth0 tokens', async () => {
  const dev = await setup({ ...ENV, AUTH_MODE: 'dev' }, undefined, jwks);
  assert.equal((await dev.as('seed')('GET', '/v1/changes')).status, 200);
  assert.equal((await dev.withToken(await token('auth0|ana'))('GET', '/v1/changes')).status, 200);
  assert.equal(
    (await dev.withToken(await token('auth0|ana', { key: stranger.privateKey }))('GET', '/v1/changes')).status,
    401,
  );
});

test('settings: Auth0 is the production default once its tenant is given; it needs the API identifier', () => {
  const DB = { DATABASE_URL: 'postgres://x/y?sslmode=require' };
  const c = loadConfig({ ...DB, NODE_ENV: 'production', AUTH0_DOMAIN: `https://${DOMAIN}/`, AUTH0_AUDIENCE: AUDIENCE });
  assert.equal(c.auth, 'auth0');
  assert.deepEqual(c.auth0, { domain: DOMAIN, audience: AUDIENCE });
  assert.throws(() => loadConfig({ ...DB, AUTH0_DOMAIN: DOMAIN }), /AUTH0_AUDIENCE is not set/);
  assert.throws(() => loadConfig({ ...DB, AUTH_MODE: 'auth0' }), /needs AUTH0_DOMAIN/);
});
