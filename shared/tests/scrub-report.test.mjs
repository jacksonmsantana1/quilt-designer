import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubReport } from '../src/scrub-report.js';

test('scrubReport keeps only the fields it knows are safe', () => {
  const out = scrubReport({
    event_id: 'e1',
    timestamp: 1,
    platform: 'javascript',
    level: 'error',
    release: '1.0',
    environment: 'production',
    sdk: { name: 'sentry' },
    logger: 'console',
    type: 'error',
    user: { email: 'ana@example.com' },
    extra: { quilt: { name: 'Quilt da Ana' } },
    breadcrumbs: [{ message: 'clicked' }],
    contexts: { device: {} },
  });
  assert.deepEqual(Object.keys(out).sort(), [
    'environment',
    'event_id',
    'level',
    'logger',
    'platform',
    'release',
    'sdk',
    'timestamp',
    'type',
  ]);
});

test('scrubReport takes emails, tokens and link queries out of messages, tags, exceptions and the page address', () => {
  const out = scrubReport({
    message: 'failed for ana@example.com with Bearer abc.def and https://r2.example/photo.jpg?sig=secret',
    tags: { who: 'jo@x.org', page: 'design' },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'token eyJhbGciOi.eyJzdWIiOi.sig in https://api.example/v1?code=1#frag',
          mechanism: { type: 'onerror', handled: false, data: { secret: 1 } },
          stacktrace: {
            frames: [
              {
                filename: 'https://page.example/app.js?v=1',
                abs_path: 'https://page.example/app.js?v=1',
                function: 'draw',
                lineno: 3,
                colno: 7,
                in_app: true,
                module: 'app',
                vars: { email: 'ana@example.com' },
                context_line: 'const secret = 1',
              },
            ],
          },
        },
      ],
    },
    request: { url: 'https://page.example/quilt.html?invite=abc#x', headers: { Authorization: 'Bearer x' } },
  });
  assert.equal(out.message, 'failed for [email] with [token] and https://r2.example/photo.jpg');
  assert.deepEqual(out.tags, { who: '[email]', page: 'design' });
  const ex = out.exception.values[0];
  assert.equal(ex.type, 'TypeError');
  assert.equal(ex.value, 'token [token] in https://api.example/v1');
  assert.deepEqual(ex.mechanism, { type: 'onerror', handled: false });
  assert.deepEqual(ex.stacktrace.frames[0], {
    filename: 'https://page.example/app.js',
    abs_path: 'https://page.example/app.js',
    function: 'draw',
    lineno: 3,
    colno: 7,
    in_app: true,
    module: 'app',
  });
  assert.deepEqual(out.request, { url: 'https://page.example/quilt.html' });
});

test('scrubReport copes with a report that has little in it', () => {
  assert.deepEqual(scrubReport({}), {});
  const out = scrubReport({ message: 42, exception: { values: [{ type: 'Error', value: 'x' }] }, request: {} });
  assert.equal(out.message, 42); // not text: left as it is
  assert.deepEqual(out.exception.values[0], { type: 'Error', value: 'x', mechanism: undefined, stacktrace: undefined });
  assert.equal(out.request, undefined);
});
