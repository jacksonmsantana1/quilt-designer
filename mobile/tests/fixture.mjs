// The phone app in a browser: the page comes from dist/, and a small stand-in plays the server, so no network or database
// is needed. real-server.spec.mjs runs the same app against the real one. dist/ is built with --dev-signin: Sign in takes a
// name instead of going to Auth0.
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { defaultDesign } from '@quilt/shared/design.js';

const DIST = path.resolve(import.meta.dirname, '../dist');
export const FABRIC = path.resolve(import.meta.dirname, '../../app/assets/fabric/paisley.jpg');
export const API_ORIGIN = 'https://block-and-bind-api.fly.dev';

/** A shared quilt as the server lists it. */
export const quilt = (name, extra = {}, design = {}) => ({
  id: crypto.randomUUID(),
  name,
  author: 'Ana S.',
  design: { ...defaultDesign(), ...design },
  mine: false,
  sharedAt: 1_780_000_000_000,
  updatedAt: 1_780_000_000_000,
  fabrics: [],
  ...extra,
});

/** What the server keeps, and its answers: only what the app asks of it. */
export function standIn() {
  const s = {
    community: () => ({ items: [], more: false }),
    communitySeen: [],
    designs: new Map(),
    fabrics: new Map(),
    photos: new Map(),
    folders: new Map(),
    notes: new Map(),
    blocks: [],
    reports: [],
    stored: new Map(),
    log: [],
    seq: 0,
    refuseDeleting: false,
    /** A saved quilt arrives from another device. */
    addDesign(name, design = defaultDesign()) {
      const id = crypto.randomUUID(),
        rec = { kind: 'design', id, name, design, rev: 1, seq: ++s.seq, deleted: false };
      s.designs.set(id, rec);
      return rec;
    },
    answer(method, url, body, headers) {
      const u = new URL(url),
        p = u.pathname;
      s.log.push(`${method} ${p}`);
      if (p === '/v1/community' && method === 'GET') {
        s.communitySeen.push(u.search);
        const r = s.community(u.searchParams, headers);
        return r === null ? [500, {}] : [200, r];
      }
      if (!headers['x-dev-user']) return [401, { error: 'unauthorized', message: 'Not signed in.' }];
      let m;
      if (p === '/v1/changes') {
        const since = +u.searchParams.get('since');
        const changes = [...s.designs.values(), ...s.fabrics.values()].filter(r => r.seq > since);
        return [200, { changes, since: s.seq, more: false }];
      }
      if ((m = p.match(/^\/v1\/designs\/(.+)$/)) && method === 'PUT') {
        const rec = {
          kind: 'design',
          id: m[1],
          name: body.name,
          design: body.design,
          rev: body.baseRev + 1,
          seq: ++s.seq,
        };
        s.designs.set(m[1], rec);
        return [200, { record: rec }];
      }
      if ((m = p.match(/^\/v1\/fabrics\/(.+)\/upload$/))) {
        const cur = s.fabrics.get(m[1]);
        if (cur) {
          Object.assign(cur, { name: body.name, cm: body.cm, rev: cur.rev + 1, seq: ++s.seq });
          return [200, { status: 'have', record: cur }];
        }
        s.fabrics.set(m[1], { kind: 'fabric', id: m[1], ...body, rev: 0, seq: 0, pending: true });
        return [200, { status: 'upload', url: `https://storage.test/fabrics/${m[1]}`, headers: {} }];
      }
      if ((m = p.match(/^\/v1\/fabrics\/(.+)\/done$/))) {
        const cur = s.fabrics.get(m[1]);
        Object.assign(cur, { rev: 1, seq: ++s.seq, pending: false });
        return [200, { record: cur }];
      }
      if ((m = p.match(/^\/v1\/fabrics\/([^/]+)$/))) {
        const cur = s.fabrics.get(m[1]);
        if (method === 'GET') return [200, { record: cur, url: `https://storage.test/fabrics/${m[1]}` }];
        Object.assign(cur, { deleted: true, rev: cur.rev + 1, seq: ++s.seq });
        return [200, { record: cur }];
      }
      if (p === '/v1/photos') return [200, { items: [...s.photos.values()].filter(x => x.done) }];
      if ((m = p.match(/^\/v1\/photos\/(.+)\/upload$/))) {
        s.photos.set(m[1], { id: m[1], ...body, url: `https://storage.test/photos/${m[1]}`, done: false });
        return [200, { status: 'upload', url: `https://storage.test/photos/${m[1]}`, headers: {} }];
      }
      if ((m = p.match(/^\/v1\/photos\/(.+)\/done$/))) {
        const cur = s.photos.get(m[1]);
        cur.done = true;
        return [200, { record: cur }];
      }
      if ((m = p.match(/^\/v1\/photos\/([^/]+)$/))) {
        s.photos.delete(m[1]);
        return [200, { ok: true }];
      }
      if (p === '/v1/organize') return [200, { folders: [...s.folders.values()], notes: [...s.notes.values()] }];
      if ((m = p.match(/^\/v1\/folders\/(.+)$/))) {
        const rec = { id: m[1], ...body };
        s.folders.set(m[1], rec);
        return [200, { record: rec }];
      }
      if ((m = p.match(/^\/v1\/fabric-notes\/(.+)$/))) {
        const rec = { fabricId: m[1], ...body };
        s.notes.set(m[1], rec);
        return [200, { record: rec }];
      }
      if ((m = p.match(/^\/v1\/community\/(.+)\/report$/))) {
        s.reports.push({ id: m[1], ...body });
        return [200, { ok: true }];
      }
      if ((m = p.match(/^\/v1\/community\/(.+)\/block$/))) {
        s.blocks.push({ id: m[1], author: 'Ana S.' });
        return [200, { ok: true }];
      }
      if (p === '/v1/blocks') return [200, { items: s.blocks }];
      if ((m = p.match(/^\/v1\/blocks\/(.+)$/))) {
        s.blocks = s.blocks.filter(b => b.id !== m[1]);
        return [200, { ok: true }];
      }
      if (p === '/v1/account' && method === 'DELETE') {
        if (s.refuseDeleting) return [500, { error: 'server_error', message: 'No.' }];
        for (const m2 of [s.designs, s.fabrics, s.photos, s.folders, s.notes]) m2.clear();
        s.accountDeleted = body;
        return [200, { ok: true }];
      }
      return [404, { error: 'not_found', message: `${method} ${p}` }];
    },
  };
  return s;
}

/** Serves the page and passes the API's requests to `answer` ([status, json], or null for a server that fails). */
export async function routes(page, answer, storage = new Map()) {
  await page.route('**/*', async route => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.origin === API_ORIGIN) {
      const [status, json] = await answer(req.method(), u.href, req.postDataJSON(), req.headers());
      return route.fulfill({ status, json });
    }
    if (u.host === 'pictures.test') return route.fulfill({ path: FABRIC, contentType: 'image/jpeg' });
    if (u.host === 'storage.test') {
      const key = u.pathname.slice(1);
      if (req.method() === 'PUT') {
        storage.set(key, req.postDataBuffer());
        return route.fulfill({ status: 200, body: '' });
      }
      return storage.has(key)
        ? route.fulfill({ body: storage.get(key), contentType: 'image/jpeg' })
        : route.fulfill({ status: 404 });
    }
    if (u.host === 'localhost') {
      const file = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
      return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
    }
    return route.abort(); // fonts and anything else: the page must cope without them
  });
}

/** Watches the page: errors in it and anything the page's security policy blocks fail the test. */
export function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** A picture of one colour, as a file for the file picker. @returns {Promise<{ name: string, mimeType: string, buffer: Buffer }>} */
export async function colourFile(page, colour, name = `${colour}.jpg`, w = 400, h = 300) {
  const data = await page.evaluate(
    async ([c, W, H]) => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = c;
      g.fillRect(0, 0, W, H);
      // a corner of another shade, so that no two pictures are the same file
      g.fillStyle = `rgb(${Math.floor(Math.random() * 40)},0,0)`;
      g.fillRect(0, 0, 2, 2);
      return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    [colour, w, h],
  );
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') };
}

export const test = base.extend({
  // the phone app's page with the stand-in server: phone.server decides what it answers
  phone: async ({ page }, use) => {
    const errors = watch(page),
      server = standIn();
    await routes(page, (method, url, body, headers) => server.answer(method, url, body, headers), server.stored);
    const tab = name => page.locator(`#go-${name}`).click();
    await use({
      page,
      server,
      get seen() {
        return server.communitySeen;
      },
      api: f => void (server.community = f),
      open: () => page.goto('http://localhost/'),
      tab,
      /** Signs in from the account's sheet, and closes it. */
      signIn: async () => {
        await page.locator('#me').click();
        await page.locator('#sign-in').click();
        await expect(page.getByText('Signed in as tester')).toBeVisible();
        await page.locator('dialog[open] .close').click();
      },
      /** Taps this and hands the file picker that opens this file. */
      pick: async (button, file) => {
        const chooser = page.waitForEvent('filechooser');
        await button.click();
        await (await chooser).setFiles(file);
      },
      /** Adds a fabric: the quick way, from My fabrics. */
      addFabric: async (colour, name, { amount = '', place = '' } = {}) => {
        const file = await colourFile(page, colour);
        const chooser = page.waitForEvent('filechooser');
        await page.locator('#add-fabric').click();
        await (await chooser).setFiles(file);
        await page.locator('#crop-done').click();
        await page.locator('#new-name').fill(name);
        if (amount) await page.locator('#new-amount').fill(amount);
        if (place) await page.locator('#new-place').fill(place);
        await page.locator('#new-save').click();
        await expect(page.locator('#fab-board .fab-name', { hasText: name })).toBeVisible();
      },
      /** Presses and holds a fabric until the app takes it as chosen. */
      hold: async locator => {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(550);
        await page.mouse.up();
      },
    });
    expect(errors, 'no errors in the page').toEqual([]);
    // a condition that left something out must not show as a word
    const words = await page.evaluate(() => document.body.innerText).catch(() => '');
    expect(words).not.toMatch(/\b(null|undefined|false|NaN)\b|Invalid Date/);
  },
});

export { expect };
