// Sync between two browsers through the real API (server/), started here on its own test database, with the
// development photo storage. Each test is a fresh browser profile: a new "device". Skipped when no PostgreSQL
// is reachable at TEST_DATABASE_URL.
import { test, expect } from './fixtures.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { defaultDesign } from '@quilt/shared/design.js';
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

test('device 1: a quilt and a fabric photo, made before connecting, go up once added to the account', async ({
  app,
  page,
}) => {
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
  // made without an account: offered to it, and sent only when added
  await page.locator('#notice').getByRole('button', { name: 'Add to my account' }).click();
  await expect
    .poll(
      async () =>
        (await pool.query("select name, doc->>'cols' as cols, rev from designs where name = 'Synced quilt'")).rows,
      {
        timeout: 15_000,
      },
    )
    .toEqual([{ name: 'Synced quilt', cols: '4', rev: 1 }]);
  await expect
    .poll(async () => (await pool.query('select name, uploaded from fabrics')).rows, { timeout: 15_000 })
    .toEqual([{ name: 'Grandma linen', uploaded: true }]);
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
  await page.locator('#notice').getByRole('button', { name: 'Add to my account' }).click(); // made before connecting
  await page.locator('#sync-now').click();
  await expect(page.locator('#sync-state')).toContainText(/\d+ changes? waiting/, { timeout: 20_000 });
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
        async logout(o) { window.__auth0Logout = o; localStorage.removeItem('stand-in-auth0'); },
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
  await page.locator('#notice').getByRole('button', { name: 'Add to my account' }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "select u.auth_sub from designs d join users u on u.id = d.owner_id where d.name = 'Ana quilt'",
          )
        ).rows,
      { timeout: 15_000 },
    )
    .toEqual([{ auth_sub: 'auth0|e2e-ana' }]);
});

test('Auth0, device 2: the same account gets the quilt; Sign out turns sync off and puts its designs away', async ({
  app,
  page,
}) => {
  await standInAuth0(page, 'auth0|e2e-ana', 'ana@example.com');
  await app.open('mine');
  await signInWithAuth0(page);
  await expect(page.locator('#mine-grid .pin', { hasText: 'Ana quilt' })).toHaveCount(1);
  // nothing from the development user "e2e": a different account
  await expect(page.locator('#mine-grid .pin', { hasText: 'Synced quilt' })).toHaveCount(0);
  const anaId = await app.storage(s => s.designs.list().find(d => d.name === 'Ana quilt').id);
  await page.locator('#sync-setup').click();
  await expect(page.locator('#sync-off')).toHaveText('Sign out');
  await page.locator('#sync-off').click();
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'off');
  await expect(page.locator('#sync-setup')).toHaveText('Sign in to sync');
  expect(await page.evaluate(() => localStorage.getItem('stand-in-auth0'))).toBeNull();
  // out of sight once signed out, but still kept on this device (for when Ana signs in again)
  await expect(page.locator('#mine-grid .pin', { hasText: 'Ana quilt' })).toHaveCount(0);
  expect(await app.storage((s, id) => s.designs.raw(id)?.name, anaId)).toBe('Ana quilt');
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

  test('Sign in, then Sign out from the account corner: back to the welcome page, the designs put away', async ({
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
    // signed out at Auth0 too (so it doesn't sign Ana straight back in), coming back to this page
    const back = await page.evaluate(() => location.origin + location.pathname);
    expect(await page.evaluate(() => window.__auth0Logout)).toEqual({ logoutParams: { returnTo: back } });
    await expect(page.locator('#acct-btn')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('stand-in-auth0'))).toBeNull();
    // not listed while signed out (nobody's account is set), but still on the device
    expect(await app.storage(s => s.designs.list().map(d => d.name))).not.toContain('Ana quilt');
    expect(await app.storage(s => s.getSession('account'))).toBeUndefined();
    // and after a reload, still signed out: the welcome page again
    await page.reload();
    await expect(page.locator('#welcome')).toBeVisible();
  });
});

// ---- one browser, several people (storage/repo.js owners): each sees and syncs only their own designs

/** connects as a development user on the sync card (also when the card was used before) */
async function connectAs(page, user) {
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#sync-setup').click();
  await page.locator('#sync-url').fill(apiUrl);
  await page.evaluate(() => (document.querySelector('.sync-dev').open = true));
  await page.locator('#sync-user').fill(user);
  await page.locator('#sync-connect').click();
  await expect(page.locator('#sync-state')).toContainText(`(${user} at`, { timeout: 20_000 });
  await expect(page.locator('#sync-dot')).toHaveAttribute('data-state', 'ok', { timeout: 20_000 });
}
const serverNames = async user =>
  (
    await pool.query(
      `select d.name from designs d join users u on u.id = d.owner_id
       where u.auth_sub = $1 and not d.deleted order by d.name`,
      ['dev:' + user],
    )
  ).rows.map(r => r.name);
const pins = page => page.locator('#mine-grid .pin h3, #mine-grid .pin .name, #mine-grid .pin');

test("one browser, two people: after a sign out, the next person doesn't see or receive the first one's designs", async ({
  app,
  page,
}) => {
  await app.open();
  await connectAs(page, 'e2e-ann');
  await page.getByRole('tab', { name: 'Quilt designer' }).click();
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Ann private quilt');
  await page.locator('#save-ok').click();
  await expect.poll(() => serverNames('e2e-ann'), { timeout: 15_000 }).toEqual(['Ann private quilt']);
  // Ann signs out: her quilt leaves the list, and a new design is open instead of hers
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#sync-setup').click();
  await page.locator('#sync-off').click();
  await expect(pins(page).filter({ hasText: 'Ann private quilt' })).toHaveCount(0);
  expect((await app.current()).cols).toBe(3); // the new design: three plain squares in a row
  // Ben signs in on the same browser: nothing of Ann's, here or on his account
  await connectAs(page, 'e2e-ben');
  await expect(pins(page).filter({ hasText: 'Ann private quilt' })).toHaveCount(0);
  expect(await serverNames('e2e-ben')).toEqual([]);
  // Ann again: her quilt is back
  await connectAs(page, 'e2e-ann');
  await expect(pins(page).filter({ hasText: 'Ann private quilt' })).toHaveCount(1);
});

test('signing in offers the designs made on this device without an account; they go up only if accepted', async ({
  app,
  page,
}) => {
  await app.open();
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Made before signing in');
  await page.locator('#save-ok').click();
  await connectAs(page, 'e2e-cat');
  const notice = page.locator('#notice');
  await expect(notice).toContainText('1 design made on this device without an account');
  expect(await serverNames('e2e-cat')).toEqual([]); // not sent unless accepted
  await notice.getByRole('button', { name: 'Add to my account' }).click();
  await expect.poll(() => serverNames('e2e-cat'), { timeout: 15_000 }).toEqual(['Made before signing in']);
});

// ---- sharing with the community (mine/community.js, server/src/routes/community.js)

test('Share from the designer: the quilt is saved, shared under the chosen name, and tagged on My designs', async ({
  app,
  page,
}) => {
  await app.open();
  await connectAs(page, 'e2e-sha');
  await page.getByRole('tab', { name: 'Quilt designer' }).click();
  await page.locator('#dz-share').click();
  const dlg = page.locator('#share-dlg');
  await expect(dlg).toBeVisible();
  await page.locator('#share-name').fill('Community star');
  // the name shown to everyone is never an email
  await page.locator('#share-author').fill('sha@example.com');
  await page.locator('#share-ok').click();
  await expect(page.locator('#share-err')).toContainText('don’t use an email');
  await page.locator('#share-author').fill('Sha Q.');
  await page.locator('#share-ok').click();
  await expect(dlg).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#notice')).toContainText('“Community star” is shared with the community.');
  const { rows } = await pool.query('select name, author from shared_designs');
  expect(rows).toEqual([{ name: 'Community star', author: 'Sha Q.' }]);
  // saved in My designs, with the tag, and its ⋯ menu offers Stop sharing
  await page.getByRole('tab', { name: 'My designs' }).click();
  const card = page.locator('#mine-grid .pin', { hasText: 'Community star' });
  await expect(card.locator('.pin-tag')).toHaveText('Shared');
  await card.locator('.pin-more').click();
  await expect(page.locator('.pin-menu [data-a="unshare"]')).toHaveText('Stop sharing');
  await page.keyboard.press('Escape');
});

test('Community: someone else sees the shared quilt, by its author, and copies it to their designs', async ({
  app,
  page,
}) => {
  await app.open();
  await connectAs(page, 'e2e-viewer');
  await page.getByRole('tab', { name: 'Community' }).click();
  const card = page.locator('#com-grid .pin', { hasText: 'Community star' });
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  await expect(card.locator('.by')).toContainText('by Sha Q.');
  await expect(card.locator('.pin-tag')).toHaveCount(0); // not theirs
  await card.getByRole('button', { name: 'Copy to my designs' }).click();
  await expect(card.getByRole('button', { name: 'In my designs ✓' })).toBeVisible();
  await page.getByRole('tab', { name: 'My designs' }).click();
  await expect(page.locator('#mine-grid .pin', { hasText: 'Community star (from Sha Q.)' })).toHaveCount(1);
  // a quilt is copied once: back on Community, its button says so and can't be pressed
  await page.getByRole('tab', { name: 'Community' }).click();
  const again = page
    .locator('#com-grid .pin', { hasText: 'Community star' })
    .getByRole('button', { name: 'In my designs ✓' });
  await expect(again).toBeDisabled();
  await expect(again).toHaveAttribute('title', 'You have it in My designs: “Community star (from Sha Q.)”');
  await page.getByRole('tab', { name: 'My designs' }).click();
  await expect(page.locator('#mine-grid .pin', { hasText: 'Community star' })).toHaveCount(1);
  // search: by author, and nothing for a stranger's name
  await page.getByRole('tab', { name: 'Community' }).click();
  await page.locator('#com-q').fill('nobody like this');
  await expect(page.locator('#com-empty')).toHaveText('No shared quilts match your search.');
});

test("a copy from the community can't be shared as it is; once changed, it can", async ({ app, page }) => {
  await app.open();
  await connectAs(page, 'e2e-copier');
  await page.getByRole('tab', { name: 'Community' }).click();
  const card = page.locator('#com-grid .pin', { hasText: 'Community star' }).first();
  await card.getByRole('button', { name: 'Copy to my designs' }).click();
  await expect(card.getByRole('button', { name: 'In my designs ✓' })).toBeVisible();
  // Share on the copy: it says whose quilt it is, and can't be pressed
  await page.getByRole('tab', { name: 'My designs' }).click();
  const mine = page.locator('#mine-grid .pin', { hasText: 'Community star (from Sha Q.)' });
  await mine.locator('.pin-more').click();
  await page.locator('.pin-menu [data-a="share"]').click();
  await expect(page.locator('#share-note')).toContainText('This is a copy of “Community star” by Sha Q.');
  await expect(page.locator('#share-ok')).toBeDisabled();
  // and looks it: grey (the page's --off colour), not rust, with a "not allowed" pointer
  const look = await page.locator('#share-ok').evaluate(b => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--off)';
    document.body.append(probe);
    const off = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { bg: getComputedStyle(b).backgroundColor, off, cursor: getComputedStyle(b).cursor };
  });
  expect(look.bg).toBe(look.off);
  expect(look.cursor).toBe('not-allowed');
  await page.locator('#share-cancel').click();
  // changed (one column fewer), it is theirs to share
  await mine.locator('.img').click();
  await page.locator('[data-step="c:-1"]').click();
  await page.locator('#dz-share').click();
  await expect(page.locator('#share-ok')).toBeEnabled();
  await page.locator('#share-author').fill('Copier');
  await page.locator('#share-ok').click();
  await expect(page.locator('#share-dlg')).toBeHidden({ timeout: 15_000 });
  const { rows } = await pool.query("select name from shared_designs where author = 'Copier'");
  expect(rows).toEqual([{ name: 'Community star (from Sha Q.)' }]);
});

test("the server refuses an unchanged copy even without the app's note (another device, or copied by hand)", async ({
  app,
  page,
}) => {
  // the same quilt as "Community star", saved in another account by hand (no note of where it came from)
  const { rows } = await pool.query("select doc from shared_designs where name = 'Community star'");
  const put = await server.inject({
    method: 'PUT',
    url: '/v1/designs/qbyhand',
    headers: { 'x-dev-user': 'e2e-byhand' },
    payload: { name: 'Community star (from Sha Q.)', design: rows[0].doc, baseRev: 0 },
  });
  expect(put.statusCode).toBe(201);
  await app.open();
  await connectAs(page, 'e2e-byhand');
  const mine = page.locator('#mine-grid .pin', { hasText: 'Community star (from Sha Q.)' });
  await expect(mine).toHaveCount(1, { timeout: 15_000 });
  await mine.locator('.pin-more').click();
  await page.locator('.pin-menu [data-a="share"]').click();
  await expect(page.locator('#share-ok')).toBeEnabled();
  await page.locator('#share-author').fill('By hand');
  await page.locator('#share-ok').click();
  await expect(page.locator('#share-err')).toContainText('the same as “Community star” by Sha Q., already shared', {
    timeout: 15_000,
  });
  await expect(page.locator('#share-dlg')).toBeVisible();
});

test('Stop sharing from the ⋯ menu: gone from the community, the tag goes', async ({ app, page }) => {
  await app.open();
  await connectAs(page, 'e2e-sha');
  await expect(page.locator('#mine-grid .pin', { hasText: 'Community star' }).locator('.pin-tag')).toHaveText(
    'Shared',
    { timeout: 15_000 },
  );
  const card = page.locator('#mine-grid .pin', { hasText: 'Community star' });
  await card.locator('.pin-more').click();
  await page.locator('.pin-menu [data-a="unshare"]').click();
  await expect(page.locator('#notice')).toContainText('is no longer shared');
  await expect(card.locator('.pin-tag')).toHaveCount(0);
  expect((await pool.query("select count(*)::int as n from shared_designs where author = 'Sha Q.'")).rows[0].n).toBe(0);
});

test('signed out, Share asks to sign in first', async ({ app, page }) => {
  await app.open();
  await page.locator('#dz-share').click();
  await expect(page.locator('#share-signin-note')).toBeVisible();
  await expect(page.locator('#share-form')).toBeHidden();
  await expect(page.locator('#share-ok')).toHaveText('Sign in');
});

test("Community draws a shared quilt in its own fabrics, even ones this browser hasn't drawn yet", async ({
  app,
  page,
}) => {
  // a quilt all in Black solid (one of the fabrics drawn only when first used), shared by someone else
  const d = defaultDesign();
  const black = { ...d, blocks: d.blocks.map(b => ({ ...b, fabrics: b.fabrics.map(() => 'c230') })) };
  const r = await server.inject({
    method: 'PUT',
    url: '/v1/shared/qblack',
    headers: { 'x-dev-user': 'e2e-black' },
    payload: { name: 'All black', author: 'Noir', design: black },
  });
  expect(r.statusCode).toBe(201);
  await app.open();
  await connectAs(page, 'e2e-looker');
  await page.getByRole('tab', { name: 'Community' }).click();
  const pic = page.locator('#com-grid .pin', { hasText: 'All black' }).locator('canvas');
  await expect(pic).toHaveCount(1, { timeout: 15_000 });
  // the middle of the picture: black, not the cream stand-in of a fabric still loading
  const lum = await pic.evaluate(c => {
    const g = c.getContext('2d'),
      [r, gr, b] = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return 0.3 * r + 0.59 * gr + 0.11 * b;
  });
  expect(lum).toBeLessThan(90);
});

test('a quilt shared without a picture gets one made, and everyone sees it', async ({ app, page }) => {
  test.setTimeout(240_000);
  await app.open();
  await connectAs(page, 'e2e-pic');
  // very little, on the renderer that works without a graphics card; this test does want the picture made
  await page.evaluate(() => {
    globalThis.__noAutoPicture = false;
    globalThis.__pictureQuality = 1;
    const e = document.getElementById('engine');
    e.value = 'raster';
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('tab', { name: 'Quilt designer' }).click();
  await page.locator('#dz-quilting').selectOption('fans'); // a quilt of this person's own
  await page.locator('#dz-share').click();
  await expect(page.locator('#share-note')).toContainText('A realistic picture of it is made on this computer');
  await page.locator('#share-name').fill('Pictured star');
  await page.locator('#share-author').fill('Pia');
  await page.locator('#share-ok').click();
  await expect(page.locator('#share-dlg')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#pic-job')).toBeVisible();
  // shared at once, the picture following when it is ready
  await expect(page.locator('#notice')).toContainText('Your realistic picture is ready', { timeout: 200_000 });
  await expect
    .poll(
      async () =>
        (await pool.query("select picture_key from shared_designs where name = 'Pictured star'")).rows[0].picture_key,
      { timeout: 20_000 },
    )
    .toMatch(/^pictures[/]/);
  // on the Community page: the picture, with the quilt's own drawing in its corner; a click shows it large
  await page.getByRole('tab', { name: 'Community' }).click();
  const card = page.locator('#com-grid .pin', { hasText: 'Pictured star' });
  await expect(card.locator('.pin-inset')).toBeVisible();
  await card.locator('.pin-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => card.locator('.pin-photo').evaluate(i => i.naturalWidth)).toBe(1500);
  await card.locator('.pin-photo').click();
  await expect(page.locator('#pic-dlg')).toBeVisible();
  await expect.poll(() => page.locator('#pic-img').evaluate(i => i.naturalWidth)).toBe(1500);
  await page.locator('#pic-close').click();
  // shared again: the dialog says the picture goes with it
  await page.getByRole('tab', { name: 'Quilt designer' }).click();
  await page.locator('#dz-share').click();
  await expect(page.locator('#share-note')).toContainText('Its realistic picture is shared too');
  await expect(page.locator('#share-cv')).toHaveJSProperty('tagName', 'IMG');
  await page.locator('#share-cancel').click();
});
