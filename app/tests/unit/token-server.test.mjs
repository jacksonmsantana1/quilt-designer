// Where a sign-in token may be sent: the app's own server or this computer, whatever address is typed or was saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenMayGoTo } from '../../src/storage/auth0.js';

test('a token goes to a server on this computer', () => {
  for (const url of ['http://localhost:8787', 'http://127.0.0.1:9', 'http://[::1]:8787']) assert.ok(tokenMayGoTo(url));
});

test('a token never goes anywhere else', () => {
  for (const url of ['https://evil.example', 'http://localhost.evil.example', 'not an address', '', undefined, null])
    assert.equal(tokenMayGoTo(url), false, String(url));
});

test('the app’s own server is allowed by its whole address, on https', () => {
  const api = 'https://api.example.com';
  assert.ok(tokenMayGoTo('https://api.example.com/', api));
  assert.equal(tokenMayGoTo('http://api.example.com', api), false);
  assert.equal(tokenMayGoTo('https://api.example.com.evil.test', api), false);
});
