// The folder that goes online: the settings in the page, the headers beside it, and the ordinary build untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const publish = env =>
  spawnSync('node', [path.join('tools', 'publish.mjs')], {
    cwd: APP,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

test('it refuses an address that isn’t https', () => {
  for (const API_URL of ['', 'http://api.example.com', 'not an address']) {
    const r = publish({ API_URL });
    assert.notEqual(r.status, 0, API_URL);
    assert.match(r.stderr, /API_URL must be/);
  }
});

test('the published folder has its settings, assets and headers, and leaves quilt.html alone', () => {
  const quilt = path.join(APP, 'quilt.html');
  const before = fs.existsSync(quilt) ? fs.readFileSync(quilt) : null;
  const r = publish({ API_URL: 'https://api.example.com', SENTRY_DSN: 'https://key@sentry.example.com/1' });
  assert.equal(r.status, 0, r.stderr);
  const dir = path.join(APP, 'publish');
  const page = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const headers = fs.readFileSync(path.join(dir, '_headers'), 'utf8');
  assert.ok(page.includes('https://api.example.com'));
  assert.ok(page.includes('https://key@sentry.example.com/1'));
  assert.ok(!page.includes('@@API_URL@@'));
  assert.ok(headers.includes('Content-Security-Policy:'));
  assert.ok(headers.includes('https://browser.sentry-cdn.com/11.10.0/'), 'Sentry’s library may load');
  assert.ok(!headers.includes('localhost'), 'online, the page has no business with this computer');
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'wood_color.jpg')));
  assert.ok(!fs.readdirSync(path.join(dir, 'assets', 'clips')).some(f => f.endsWith('.gif')));
  // each script's fingerprint in the headers is of the page as published
  const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].length;
  assert.equal((headers.match(/'sha256-/g) || []).length, scripts);
  if (before) assert.ok(before.equals(fs.readFileSync(quilt)), 'quilt.html is not touched');
  assert.ok(!fs.existsSync(path.join(dir, 'app.js')), 'the page holds it');
  fs.rmSync(dir, { recursive: true, force: true });
  assert.ok(
    execFileSync('git', ['check-ignore', 'publish/index.html'], { cwd: APP, encoding: 'utf8' }).includes('publish'),
  );
});
