// Sync between two browsers through the real API (server/), started here on its own test database, with the
// development photo storage. Each test is a fresh browser profile: a new "device". Skipped when no PostgreSQL
// is reachable at TEST_DATABASE_URL.
import { test, expect } from './fixtures.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
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
const AUTH0_DOMAIN = 'dev-5op4uervqyekvlsx.us.auth0.com',
  AUTH0_AUDIENCE = 'https://api.quilt-designer';
let server, pool, admin, apiUrl, signKey;

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
  // development sign-in by name, and Auth0 tokens too: signed here with a test key (the tests' own "Auth0")
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    CORS_ORIGINS: 'http://localhost',
    AUTH0_DOMAIN,
    AUTH0_AUDIENCE,
  });
  pool = createPool(config.databaseUrl);
  await migrate(pool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quilt-e2e-photos-'));
  const pair = await generateKeyPair('RS256');
  signKey = pair.privateKey;
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'e2e', alg: 'RS256' }] });
  // the address is known only once it listens: the store asks for it when it makes a link
  server = await buildApp({ config, pool, store: localStore(dir, () => apiUrl), keys });
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
  await page.locator('.sync-dev summary').click(); // development sign-in, by name
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
  await page.locator('.sync-dev summary').click();
  await page.locator('#sync-user').fill('e2e');
  await page.locator('#sync-connect').click();
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'offline', { timeout: 20_000 });
  await expect(page.locator('#sync-state')).toContainText(/\d+ changes? waiting/);
});

// ---- sign-in with Auth0. Auth0's own page can't be used in a test: its library is replaced by a stand-in that
// "signs in" at once and hands out a token signed with the test key, which the API checks like a real one.

/** serves the stand-in for Auth0's library; returns what the app asked it for */
async function standInAuth0(page, sub, email) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'e2e' })
    .setSubject(sub)
    .setIssuer(`https://${AUTH0_DOMAIN}/`)
    .setAudience(AUTH0_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(signKey);
  const lib = `
    export async function createAuth0Client(options) {
      window.__auth0Options = options;
      return {
        async loginWithPopup(o, cfg) { window.__auth0Login = o; if (cfg && cfg.popup) cfg.popup.close(); localStorage.setItem('stand-in-auth0', '1'); },
        async getUser() { return { sub: ${JSON.stringify(sub)}, email: ${JSON.stringify(email)} }; },
        async getTokenSilently() {
          if (!localStorage.getItem('stand-in-auth0')) throw Object.assign(new Error('Login required'), { error: 'login_required' });
          return ${JSON.stringify(token)};
        },
        async logout() { localStorage.removeItem('stand-in-auth0'); },
      };
    }`;
  await page.route('**/@auth0/auth0-spa-js@*/**', r => r.fulfill({ body: lib, contentType: 'text/javascript' }));
}

async function signInWithAuth0(page) {
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#sync-setup').click();
  await page.locator('#sync-url').fill(apiUrl);
  await page.locator('#sync-signin').click();
  await expect(page.locator('#sync-state')).toContainText('Synced at', { timeout: 20_000 });
}

test('Auth0, device 1: Sign in, and the quilt goes up to that account', async ({ app, page }) => {
  await standInAuth0(page, 'auth0|e2e-ana', 'ana@example.com');
  await app.open();
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Ana quilt');
  await page.locator('#save-ok').click();
  await signInWithAuth0(page);
  await expect(page.locator('#sync-state')).toContainText('ana@example.com');
  // the app asked Auth0 for a token for this API, kept on this device
  const opts = await page.evaluate(() => window.__auth0Options);
  expect(opts).toMatchObject({
    domain: AUTH0_DOMAIN,
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    authorizationParams: { audience: AUTH0_AUDIENCE },
  });
  const { rows } = await pool.query(
    "select u.auth_sub from designs d join users u on u.id = d.owner_id where d.name = 'Ana quilt'",
  );
  expect(rows).toEqual([{ auth_sub: 'auth0|e2e-ana' }]);
});

test('Auth0, device 2: the same account gets the quilt; Sign out turns sync off and keeps the designs', async ({
  app,
  page,
}) => {
  await standInAuth0(page, 'auth0|e2e-ana', 'ana@example.com');
  await app.open('mine');
  await signInWithAuth0(page);
  await expect(page.locator('#mine-grid .pin', { hasText: 'Ana quilt' })).toHaveCount(1);
  // nothing from the development user "e2e": a different account
  await expect(page.locator('#mine-grid .pin', { hasText: 'Synced quilt' })).toHaveCount(0);
  await page.locator('#sync-setup').click();
  await expect(page.locator('#sync-off')).toHaveText('Sign out');
  await page.locator('#sync-off').click();
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'off');
  await expect(page.locator('#sync-setup')).toHaveText('Sign in to sync');
  expect(await page.evaluate(() => localStorage.getItem('stand-in-auth0'))).toBeNull();
  await expect(page.locator('#mine-grid .pin', { hasText: 'Ana quilt' })).toHaveCount(1);
});

test('Auth0: a sign-in window closed before it finished says so, and sync stays off', async ({ app, page }) => {
  await page.route('**/@auth0/auth0-spa-js@*/**', r =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `export async function createAuth0Client() { return { async loginWithPopup(o, c) { c && c.popup && c.popup.close(); throw Object.assign(new Error('Popup closed'), { error: 'cancelled' }); } }; }`,
    }),
  );
  await app.open('mine');
  await page.locator('#sync-setup').click();
  await page.locator('#sync-url').fill(apiUrl);
  await page.locator('#sync-signin').click();
  await expect(page.locator('#sync-err')).toHaveText('Sign-in was closed before it finished.');
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'off');
});

// ---- the welcome page and the account corner (mine/account.js), signing in to the default server address

test.describe('welcome page', () => {
  test.use({ welcome: true });

  /** the default server address (localhost:8787) is passed on to this file's API */
  const toTestApi = page =>
    page.route('http://localhost:8787/**', async r => {
      try {
        const res = await r.fetch({ url: r.request().url().replace('http://localhost:8787', apiUrl) });
        await r.fulfill({ response: res });
      } catch (e) {
        await r.abort().catch(() => {}); // a sync still going when the test ended
      }
    });

  test('Create an account opens Auth0 on its sign-up screen; then signed in and synced, the account corner shows who', async ({
    app,
    page,
  }) => {
    await standInAuth0(page, 'auth0|e2e-new', 'new@example.com');
    await toTestApi(page);
    await app.open();
    await page.locator('#welcome-signup').click();
    await expect(page.locator('#welcome')).toBeHidden();
    expect(await page.evaluate(() => window.__auth0Login)).toEqual({ authorizationParams: { screen_hint: 'signup' } });
    await expect(page.locator('#acct-btn')).toBeVisible();
    await expect(page.locator('#acct-initial')).toHaveText('N');
    await expect(page.locator('#acct-signin')).toBeHidden();
    await expect
      .poll(
        async () =>
          (await pool.query("select count(*)::int as n from users where auth_sub = 'auth0|e2e-new'")).rows[0].n,
      )
      .toBe(1);
  });

  test('Sign in, then Sign out from the account corner: back to the welcome page, the designs stay', async ({
    app,
    page,
  }) => {
    await standInAuth0(page, 'auth0|e2e-ana', 'ana@example.com');
    await toTestApi(page);
    await app.open();
    await page.locator('#welcome-signin').click();
    await expect(page.locator('#welcome')).toBeHidden();
    expect(await page.evaluate(() => window.__auth0Login)).toEqual({});
    // Ana's quilt from the earlier tests arrives
    await expect.poll(() => app.storage(s => s.designs.list().map(d => d.name))).toContain('Ana quilt');
    await page.locator('#acct-btn').click();
    await expect(page.locator('#acct-menu')).toBeVisible();
    await expect(page.locator('#acct-email')).toHaveText('ana@example.com');
    await page.keyboard.press('Escape');
    await expect(page.locator('#acct-menu')).toBeHidden();
    await page.locator('#acct-btn').click();
    await page.locator('#acct-signout').click();
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#acct-btn')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('stand-in-auth0'))).toBeNull();
    expect(await app.storage(s => s.designs.list().map(d => d.name))).toContain('Ana quilt');
    // and after a reload, still signed out: the welcome page again
    await page.reload();
    await expect(page.locator('#welcome')).toBeVisible();
  });
});
