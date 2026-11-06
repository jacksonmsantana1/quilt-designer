// The phone app with the real server's code behind it, on its own test database, to be sure the two agree: the other tests
// use a stand-in. No network: requests go straight into the server. Skipped when no PostgreSQL is reachable at
// TEST_DATABASE_URL.
import { test as base, expect } from '@playwright/test';
import pg from 'pg';
import { defaultDesign } from '@quilt/shared/design.js';
import { loadConfig } from '../../server/src/config.js';
import { createPool } from '../../server/src/db.js';
import { migrate } from '../../server/src/migrate.js';
import { memoryStore } from '../../server/src/objects.js';
import { buildApp } from '../../server/src/app.js';
import { colourFile, routes, watch } from './fixture.mjs';

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5433/postgres?host=/tmp';
const DB = `quilt_phone_${process.pid}`;
let admin, pool, server, store;
const storage = new Map();

const test = base;
test.describe.configure({ mode: 'serial' });

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
  const config = loadConfig({
    NODE_ENV: 'test',
    AUTH_MODE: 'dev',
    DATABASE_URL: url.toString(),
    RATE_LIMIT_PER_MINUTE: '100000',
  });
  pool = createPool(config.databaseUrl);
  await migrate(pool);
  const memory = memoryStore();
  // links the test's browser can follow; what's uploaded is copied in where the server looks for it
  store = {
    ...memory,
    uploadUrl: async (key, { type }) => ({ url: `https://storage.test/${key}`, headers: { 'content-type': type } }),
    downloadUrl: async key => `https://storage.test/${key}`,
    get: async key => (storage.has(key) ? new Uint8Array(storage.get(key)) : null),
    copy: async (from, to) => void storage.set(to, storage.get(from)),
    remove: async key => void storage.delete(key),
  };
  server = await buildApp({ config, pool, store });
});
test.afterAll(async () => {
  if (!admin) return;
  await server.close();
  await pool.end();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.end();
});

/** A phone (a new browser profile) signed in as "tester". */
async function aPhone(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  const errors = watch(page);
  await routes(
    page,
    async (method, url, body, headers) => {
      const u = new URL(url);
      const r = await server.inject({
        method,
        url: u.pathname + u.search,
        payload: body ?? undefined,
        headers: Object.fromEntries(
          Object.entries(headers).filter(([k]) => ['x-dev-user', 'content-type'].includes(k)),
        ),
      });
      return [r.statusCode, r.body ? JSON.parse(r.body) : {}];
    },
    storage,
  );
  await page.goto('http://localhost/');
  await page.locator('#me').click();
  await page.locator('#sign-in').click();
  await expect(page.getByText('Signed in as tester')).toBeVisible();
  return { page, errors, context };
}
const syncNow = async page => {
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(page.locator('#sync-state')).toHaveText('In step with your account.');
};

test('a fabric, a folder, a note and a photo go from one phone to another through the real server', async ({
  browser,
}) => {
  test.skip(!admin, 'no PostgreSQL');
  const one = await aPhone(browser);
  await one.page.locator('dialog[open] .close').click();
  await one.page.locator('#go-fabrics').click();

  const chooser = one.page.waitForEvent('filechooser');
  await one.page.locator('#add-fabric').click();
  await (await chooser).setFiles(await colourFile(one.page, 'red'));
  await one.page.locator('#crop-done').click();
  await one.page.locator('#new-name').fill('Rose');
  await one.page.locator('#new-amount').fill('2 m');
  await one.page.locator('dialog[open]').getByRole('button', { name: '+ Folder' }).click();
  await one.page.locator('#folder-name').fill('Reds');
  await one.page.locator('dialog[open] button[type=submit]').click();
  await one.page.locator('#new-save').click();
  await expect(one.page.locator('#fab-views .chip', { hasText: 'Reds' })).toHaveText('Reds · 1');

  await one.page.locator('#go-camera').click();
  const chooser2 = one.page.waitForEvent('filechooser');
  await one.page.locator('#cam-quilt').click();
  await (await chooser2).setFiles(await colourFile(one.page, 'teal'));
  await one.page.locator('#album-name').fill('Grandma’s quilt');
  await one.page.locator('dialog[open] button[type=submit]').click();
  await expect(one.page.locator('#recent .shot')).toHaveCount(1);

  await one.page.locator('#me').click();
  await syncNow(one.page);
  await expect(one.page.locator('dialog[open]')).toBeVisible();
  expect(one.errors).toEqual([]);

  const two = await aPhone(browser);
  await syncNow(two.page);
  await two.page.locator('dialog[open] .close').click();
  await two.page.locator('#go-fabrics').click();
  await expect(two.page.locator('#fab-views .chip', { hasText: 'Reds' })).toHaveText('Reds · 1');
  await expect(two.page.locator('#fab-board .fab-name')).toHaveText(['Rose']);
  await expect(two.page.locator('#fab-board .fab-note')).toHaveText('2 m');
  await two.page.locator('#go-quilts').click();
  await expect(two.page.locator('#quilts-board .name')).toHaveText(['Grandma’s quilt']);
  await expect.poll(() => two.page.locator('#quilts-board .photo').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);

  // renaming a fabric on one phone reaches the other
  await two.page.locator('#go-fabrics').click();
  await two.page.locator('#fab-board .fab', { hasText: 'Rose' }).click();
  await two.page.locator('#fabric-name').fill('Deep rose');
  await two.page.locator('dialog[open] .close').click();
  await two.page.locator('#me').click();
  await syncNow(two.page);
  await syncNow(one.page);
  await one.page.locator('dialog[open] .close').click();
  await one.page.locator('#go-fabrics').click();
  await expect(one.page.locator('#fab-board .fab-name')).toHaveText(['Deep rose']);
  expect(two.errors).toEqual([]);
  await one.context.close();
  await two.context.close();
});

test('a shared quilt can be saved, reported and blocked; then the account can be deleted', async ({ browser }) => {
  test.skip(!admin, 'no PostgreSQL');
  const ana = await server.inject({
    method: 'PUT',
    url: '/v1/shared/q1',
    headers: { 'x-dev-user': 'ana' },
    payload: { name: 'Her quilt', author: 'Ana', design: { ...defaultDesign(), cols: 3 } },
  });
  expect(ana.statusCode).toBeLessThan(300);

  const { page, errors, context } = await aPhone(browser);
  await page.locator('dialog[open] .close').click();
  await page.reload();
  const pin = page.locator('#board .pin', { hasText: 'Her quilt' });
  await expect(pin).toBeVisible();
  await pin.locator('.more-actions').click();
  await page.getByRole('button', { name: 'Save to My quiltings' }).click();
  await expect(page.locator('.toast')).toContainText('is in My quiltings');
  await pin.locator('.more-actions').click();
  await page.getByRole('button', { name: 'Report this quilt' }).click();
  await page.getByRole('button', { name: 'Spam' }).click();
  await expect(page.locator('.toast').last()).toContainText('someone will look at it');
  await pin.locator('.more-actions').click();
  await page.getByRole('button', { name: 'Stop seeing Ana’s quilts' }).click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(pin).toHaveCount(0);

  await page.locator('#me').click();
  await page.getByRole('button', { name: 'People you’ve blocked' }).click();
  await expect(page.locator('dialog[open] .blocked')).toContainText('Ana');
  await page.getByRole('button', { name: 'See them again' }).click();
  await expect(pin).toHaveCount(1);

  await page.locator('#delete-account').click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(page.locator('#me')).not.toHaveClass(/in/);
  const { rows } = await pool.query("select count(*)::int as n from users where auth_sub = 'dev:tester'");
  expect(rows[0].n).toBe(0);
  expect(errors).toEqual([]);
  await context.close();
});
