// The API as a person starts it: `node src/server.js` (settings from the environment, migrations, listening) and
// `node src/migrate.js`, each in a process of its own, on a fresh database.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5433/postgres?host=/tmp';
const SRC = path.join(import.meta.dirname, '..', 'src');
const run = promisify(execFile);

const name = `quilt_start_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`create database ${name}`);
const dbUrl = new URL(ADMIN_URL);
dbUrl.pathname = '/' + name;
const photos = fs.mkdtempSync(path.join(os.tmpdir(), 'quilt-photos-'));
after(async () => {
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.end();
  fs.rmSync(photos, { recursive: true, force: true });
});

test('migrate.js on its own: applies every migration once, then says the database is up to date', async () => {
  const env = { ...process.env, DATABASE_URL: dbUrl.toString() };
  const first = await run(process.execPath, [path.join(SRC, 'migrate.js')], { env });
  assert.match(first.stdout, /^Applied: 001_/);
  const again = await run(process.execPath, [path.join(SRC, 'migrate.js')], { env });
  assert.match(again.stdout, /Database is up to date/);
});

test('migrate.js says what went wrong when the database cannot be reached, and exits with an error', async () => {
  const bad = new URL(ADMIN_URL);
  bad.pathname = '/no_such_database_here';
  await assert.rejects(
    run(process.execPath, [path.join(SRC, 'migrate.js')], { env: { ...process.env, DATABASE_URL: bad.toString() } }),
    e => e.code === 1 && /no_such_database_here/.test(e.stderr),
  );
});

test('server.js starts, answers /alive and /health, takes the stand-in login, and stops on SIGTERM', async () => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(SRC, 'server.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: dbUrl.toString(),
      PORT: String(port),
      AUTH_MODE: 'dev',
      STORAGE: 'local',
      LOCAL_STORAGE_DIR: photos,
      SENTRY_DSN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', d => (out += d));
  child.stderr.on('data', d => (out += d));
  const base = `http://127.0.0.1:${port}`;
  // it is listening once /alive answers
  let alive = null;
  for (let i = 0; i < 100 && !alive; i++) {
    alive = await fetch(`${base}/alive`).catch(() => null);
    if (!alive) await new Promise(r => setTimeout(r, 100));
  }
  try {
    assert.ok(alive, `the server did not start:\n${out}`);
    assert.equal(alive.status, 200);
    assert.equal((await fetch(`${base}/health`)).status, 200);
    // the warnings a person running it on their own computer is shown
    assert.match(out, /Development login is on/);
    assert.match(out, /Photos are kept in/);
    const signedOut = await fetch(`${base}/v1/changes?since=0`);
    assert.equal(signedOut.status, 401);
    const signedIn = await fetch(`${base}/v1/changes?since=0`, { headers: { 'x-dev-user': 'ana' } });
    assert.equal(signedIn.status, 200);
  } finally {
    const stopped = new Promise(r => child.on('exit', r));
    child.kill('SIGTERM');
    await stopped;
  }
});

test('server.js without any sign-in set up says so, and refuses /v1', async () => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, NODE_ENV: 'development', DATABASE_URL: dbUrl.toString(), PORT: String(port) };
  for (const k of ['AUTH_MODE', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'S3_ENDPOINT']) delete env[k];
  env.STORAGE = 'local';
  env.LOCAL_STORAGE_DIR = photos;
  const child = spawn(process.execPath, [path.join(SRC, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => (out += d));
  child.stderr.on('data', d => (out += d));
  let alive = null;
  for (let i = 0; i < 100 && !alive; i++) {
    alive = await fetch(`http://127.0.0.1:${port}/alive`).catch(() => null);
    if (!alive) await new Promise(r => setTimeout(r, 100));
  }
  try {
    assert.ok(alive, `the server did not start:\n${out}`);
    assert.match(out, /Sign-in is not set up/);
    const r = await fetch(`http://127.0.0.1:${port}/v1/changes?since=0`, { headers: { 'x-dev-user': 'ana' } });
    assert.equal(r.status, 401);
  } finally {
    const stopped = new Promise(r => child.on('exit', r));
    child.kill('SIGTERM');
    await stopped;
  }
});
