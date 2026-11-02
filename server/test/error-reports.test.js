// Error reports: what reaches Sentry says what went wrong and where, and nothing about the person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { scrubReport } from '@quilt/shared/scrub-report.js';
import { loadConfig } from '../src/config.js';
import { memoryStore } from '../src/objects.js';
import { buildApp } from '../src/app.js';
import { startErrorReports } from '../src/error-reports.js';

const config = loadConfig({ DATABASE_URL: 'postgres://x/y', AUTH_MODE: 'dev' });

test('a report keeps what went wrong and where, without the person or their data', () => {
  const out = scrubReport({
    event_id: 'e1',
    level: 'error',
    release: 'abc',
    message: 'Saving ana@example.com failed',
    tags: { route: '/v1/designs/:id' },
    user: { id: '42', email: 'ana@example.com', ip_address: '203.0.113.9' },
    breadcrumbs: [{ message: 'PUT /v1/designs' }],
    extra: { design: { name: 'Secret quilt' } },
    contexts: { design: { name: 'Secret quilt' } },
    somethingNewOneDay: 'private',
    request: {
      url: 'https://api.test/v1/fabrics/f1?sig=abc#x',
      headers: { authorization: 'Bearer abc' },
      cookies: { a: 1 },
      data: { name: 'Secret quilt' },
      query_string: 'q=private',
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'Bearer abc.def failed for ben@example.org at https://r2.test/x?X-Amz-Signature=abc eyJa.eyJb.sig',
          mechanism: { type: 'generic', handled: true, data: { private: 1 } },
          stacktrace: {
            frames: [
              { filename: 'https://x.test/app.js?t=1', function: 'save', lineno: 3, vars: { design: 'Secret quilt' } },
            ],
          },
        },
      ],
    },
  });
  const text = JSON.stringify(out);
  for (const leak of ['example', 'Secret', 'private', 'sig=', 'Signature', 'eyJ', 'abc.def', '203.0.113', 'cookies'])
    assert.ok(!text.includes(leak), `${leak} in ${text}`);
  assert.equal(out.level, 'error');
  assert.equal(out.release, 'abc');
  assert.equal(out.tags.route, '/v1/designs/:id');
  assert.equal(out.request.url, 'https://api.test/v1/fabrics/f1');
  assert.equal(out.exception.values[0].stacktrace.frames[0].function, 'save');
  assert.equal(out.exception.values[0].stacktrace.frames[0].lineno, 3);
  assert.equal(out.exception.values[0].mechanism.handled, true);
});

test('only unexpected errors are reported, and the visitor is not told their details', async () => {
  const seen = [];
  const pool = /** @type {any} */ ({
    query: async () => {
      throw new Error('database password wrong');
    },
  });
  const app = await buildApp({
    config,
    pool,
    store: memoryStore(),
    onError: (e, route) => seen.push([e.message, route]),
  });
  const broken = await app.inject({ url: '/health' });
  assert.equal(broken.statusCode, 500);
  assert.ok(!broken.body.includes('password'));
  assert.deepEqual(seen, [['database password wrong', '/health']]);
  assert.equal((await app.inject({ url: '/nowhere' })).statusCode, 404);
  assert.equal((await app.inject({ url: '/v1/changes' })).statusCode, 401);
  assert.equal(seen.length, 1, 'things refused on purpose are not errors');
  await app.close();
});

test('/alive answers without asking the database, and is not counted by the limits', async () => {
  const pool = /** @type {any} */ ({
    query: async () => {
      throw new Error('should not be asked');
    },
  });
  const app = await buildApp({ config: { ...config, ratePerMinute: 1 }, pool, store: memoryStore() });
  for (let i = 0; i < 3; i++) assert.equal((await app.inject({ url: '/alive' })).statusCode, 200);
  await app.close();
});

test('without an address nothing is sent; with one, the report arrives scrubbed', async () => {
  const off = await startErrorReports(null);
  off.report(new Error('nothing happens'));
  await off.close();

  const got = [];
  const sentry = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => (body += d)).on('end', () => (got.push(body), res.end('{}')));
  });
  await new Promise(r => sentry.listen(0, '127.0.0.1', r));
  const { port } = /** @type {any} */ (sentry.address());
  const on = await startErrorReports(`http://key@127.0.0.1:${port}/1`, { environment: 'test', release: 'r1' });
  on.report(new Error('Saving failed for ana@example.com'), '/v1/designs/:id');
  await on.close();
  await new Promise(r => sentry.close(r));
  const sent = got.join('\n');
  assert.ok(sent.includes('Saving failed for [email]'), sent.slice(0, 400));
  assert.ok(sent.includes('/v1/designs/:id'));
  assert.ok(!sent.includes('example.com'));
});
