// Sync between two browsers through the real API (server/), started here on its own test database, with the
// development photo storage. Each test is a fresh browser profile: a new "device". Skipped when no PostgreSQL
// is reachable at TEST_DATABASE_URL.
import { test, expect } from './fixtures.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';
import { loadConfig } from '../../../server/src/config.js';
import { createPool } from '../../../server/src/db.js';
import { migrate } from '../../../server/src/migrate.js';
import { localStore } from '../../../server/src/objects.js';
import { buildApp } from '../../../server/src/app.js';

test.describe.configure({ mode: 'serial' });
// The page is served by the test (not from a real address), so Chrome can't tell it is local and would ask the
// person before letting it reach a server on this computer ("local network access"); a real page served from
// localhost doesn't need that. The check is turned off for this file's browser.
test.use({
  origin: 'http://localhost',
  launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] },
});

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5433/postgres?host=/tmp';
const DB = `quilt_e2e_${process.pid}`;
let server, pool, admin, apiUrl;

test.beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (e) {
    admin = null;
    return;
  }
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.query(`create database ${DB}`);
  const url = new URL(ADMIN_URL);
  url.pathname = '/' + DB;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: url.toString(), CORS_ORIGINS: 'http://localhost' });
  pool = createPool(config.databaseUrl);
  await migrate(pool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quilt-e2e-photos-'));
  // the address is known only once it listens: the store asks for it when it makes a link
  server = await buildApp({ config, pool, store: localStore(dir, () => apiUrl) });
  await server.listen({ port: 0, host: '127.0.0.1' });
  apiUrl = `http://127.0.0.1:${server.server.address().port}`;
});
test.afterAll(async () => {
  if (!admin) return;
  await server.close();
  await pool.end();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.end();
});
test.beforeEach(() => test.skip(!admin, 'no PostgreSQL for the API'));

async function connect(page, user) {
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#sync-setup').click();
  await page.locator('#sync-url').fill(apiUrl);
  await page.locator('#sync-user').fill(user);
  await page.locator('#sync-connect').click();
  await expect(page.locator('#sync-state')).toContainText('Synced at', { timeout: 20_000 });
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'ok');
}

test('device 1: a quilt and a fabric photo go up to the server', async ({ app, page }) => {
  await app.open();
  const photo = {
    name: 'Grandma linen.jpg',
    mimeType: 'image/jpeg',
    buffer: fs.readFileSync(new URL('../../assets/fabric/linen.jpg', import.meta.url)),
  };
  await page.locator('#dz-upload').setInputFiles(photo);
  await expect.poll(() => app.storage(s => s.fabrics.list().length)).toBe(1);
  await page.locator('[data-step="c:-1"]').click(); // 4 × 5
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Synced quilt');
  await page.locator('#save-ok').click();
  await connect(page, 'e2e');
  const { rows: d } = await pool.query(
    "select name, doc->>'cols' as cols, rev from designs where name = 'Synced quilt'",
  );
  expect(d).toEqual([{ name: 'Synced quilt', cols: '4', rev: 1 }]);
  const { rows: f } = await pool.query('select name, uploaded from fabrics');
  expect(f).toEqual([{ name: 'Grandma linen', uploaded: true }]);
});

test('device 2: the quilt and the photo arrive', async ({ app, page }) => {
  await app.open('mine');
  await connect(page, 'e2e');
  await expect(page.locator('#mine-grid .pin', { hasText: 'Synced quilt' })).toHaveCount(1);
  const fab = await app.storage(s => s.fabrics.list().map(f => ({ name: f.name, size: f.blob.size })));
  expect(fab).toHaveLength(1);
  expect(fab[0].size).toBeGreaterThan(10_000);
  // the photo is in the fabric list, ready to use
  await page.locator('#mine-grid .pin', { hasText: 'Synced quilt' }).locator('.img').click();
  expect((await app.current()).cols).toBe(4);
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-fabrics2 .fab', { hasText: 'Grandma linen' })).toHaveCount(1);
});

test('device 3: a change saved here goes up by itself a moment later', async ({ app, page }) => {
  await app.open('mine');
  await connect(page, 'e2e');
  await page.locator('#mine-grid .pin', { hasText: 'Synced quilt' }).locator('.img').click();
  await page.locator('[data-step="r:-1"]').click(); // 4 × 4
  await page.locator('#dz-save').click();
  await page.locator('#save-ok').click(); // save changes
  await expect
    .poll(
      async () =>
        (await pool.query("select doc->>'rows' as rows from designs where name = 'Synced quilt'")).rows[0].rows,
      {
        timeout: 15_000,
      },
    )
    .toBe('4');
});

test('without the server: the change waits, and the card says so', async ({ app, page }) => {
  await app.open();
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Offline quilt');
  await page.locator('#save-ok').click();
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#sync-setup').click();
  await page.locator('#sync-url').fill('http://127.0.0.1:9'); // nothing listens there
  await page.locator('#sync-user').fill('e2e');
  await page.locator('#sync-connect').click();
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'offline', { timeout: 20_000 });
  await expect(page.locator('#sync-state')).toContainText(/\d+ changes? waiting/);
});
