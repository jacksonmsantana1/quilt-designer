// The Community board on a phone. The page comes from dist/ and the API is played by the test, so no network is needed.
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { defaultDesign } from '@quilt/shared/design.js';

const DIST = path.resolve(import.meta.dirname, '../dist');
const FABRIC = path.resolve(import.meta.dirname, '../../app/assets/fabric/paisley.jpg');
const API = 'https://block-and-bind-api.fly.dev/v1/community';
const PHOTO_ID = 'f' + 'a'.repeat(24);

const quilt = (name, extra = {}, design = {}) => ({
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

const test = base.extend({
  // the phone app's page, with `api` deciding what the API answers; errors in the page fail the test
  phone: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const seen = [];
    let answer = () => ({ items: [], more: false });
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.href.startsWith(API)) {
        seen.push(u.search);
        const body = answer(u.searchParams);
        return body === null ? route.fulfill({ status: 500, body: '{}' }) : route.fulfill({ json: body });
      }
      if (u.host === 'pictures.test') return route.fulfill({ path: FABRIC, contentType: 'image/jpeg' });
      if (u.host === 'x') {
        const file = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
      }
      return route.abort(); // fonts and anything else: the page must cope without them
    });
    await use({
      page,
      seen,
      api: f => void (answer = f),
      open: () => page.goto('http://x/'),
    });
    expect(errors, 'no errors in the page').toEqual([]);
  },
});

/** Whether a canvas has been painted: more than one colour in it. */
const painted = canvas =>
  canvas.evaluate(c => {
    if (!c.width || c.width === 300) return false;
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height),
      colours = new Set();
    for (let i = 0; i < data.length; i += 400) colours.add(data[i] + ',' + data[i + 1]);
    return colours.size > 3;
  });

test('the board: two columns of cards, each quilt drawn in its fabrics', async ({ phone }) => {
  const { page } = phone;
  phone.api(() => ({
    items: [
      quilt('Evening star'),
      quilt('Tall one', {}, { rows: 7 }),
      quilt('Wide one', {}, { cols: 7, rows: 3, blocks: defaultDesign().blocks.slice(0, 21) }),
      quilt('Small one', {}, { cols: 3, rows: 3, blocks: defaultDesign().blocks.slice(0, 9) }),
    ],
    more: false,
  }));
  await phone.open();
  await expect(page.locator('h1')).toHaveText('Community');
  const pins = page.locator('.pin');
  await expect(pins).toHaveCount(4);
  await expect(pins.first().locator('.name')).toHaveText('Evening star');
  await expect(pins.first().locator('.by')).toContainText('by Ana S. · 5 × 5 blocks');
  await expect.poll(() => painted(pins.first().locator('canvas'))).toBe(true);
  // two columns, and nothing wider than the phone
  const xs = new Set(await pins.evaluateAll(all => all.map(p => Math.round(p.getBoundingClientRect().left))));
  expect(xs.size).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a quilt with a realistic picture shows it, with its drawing in the corner, and opens it large', async ({
  phone,
}) => {
  const { page } = phone;
  phone.api(() => ({ items: [quilt('Pictured', { pictureUrl: 'https://pictures.test/p.jpg' })], more: false }));
  await phone.open();
  const pin = page.locator('.pin');
  await expect.poll(() => pin.locator('.photo').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => painted(pin.locator('canvas.inset'))).toBe(true);
  await pin.locator('.photo').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#viewer-name')).toHaveText('Pictured');
  await expect.poll(() => page.locator('#viewer-img').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#viewer-close').click();
  await expect(page.locator('#viewer')).toBeHidden();
});

test('a fabric photo comes with its quilt; one that cannot be fetched does not stop the drawing', async ({ phone }) => {
  const { page } = phone;
  const blocks = defaultDesign().blocks.map(b => ({ ...b, fabrics: b.fabrics.map(() => PHOTO_ID) }));
  phone.api(() => ({
    items: [
      quilt(
        'Her fabric',
        { fabrics: [{ id: PHOTO_ID, name: 'Hers', cm: 30, url: 'https://pictures.test/f.jpg' }] },
        { blocks },
      ),
      quilt(
        'Broken link',
        { fabrics: [{ id: 'f' + 'b'.repeat(24), name: 'Gone', cm: 30, url: 'https://gone.test/f.jpg' }] },
        {
          blocks: defaultDesign().blocks.map(b => ({ ...b, fabrics: b.fabrics.map(() => 'f' + 'b'.repeat(24)) })),
        },
      ),
    ],
    more: false,
  }));
  await phone.open();
  // (the photo's picture can't be read back from the canvas, as it comes from another address: that it has a size is the test)
  const canvases = page.locator('.pin canvas');
  await expect(canvases).toHaveCount(2);
  await expect.poll(() => canvases.first().evaluate(c => c.width)).toBeGreaterThan(300);
  await expect.poll(() => canvases.nth(1).evaluate(c => c.width)).toBeGreaterThan(300);
});

test('searching asks the server, and says when nothing matches', async ({ phone }) => {
  const { page } = phone;
  phone.api(q =>
    q.get('q') === 'star'
      ? { items: [quilt('Evening star')], more: false }
      : q.get('q')
        ? { items: [], more: false }
        : { items: [quilt('Evening star'), quilt('Log cabin')], more: false },
  );
  await phone.open();
  await expect(page.locator('.pin')).toHaveCount(2);
  await page.locator('#q').fill('star');
  await expect(page.locator('.pin')).toHaveCount(1);
  await page.locator('#q').fill('velvet');
  await expect(page.locator('.pin')).toHaveCount(0);
  await expect(page.locator('#empty')).toHaveText('No shared quilts match your search.');
});

test('More quilts brings the next page after the last one shown', async ({ phone }) => {
  const { page } = phone;
  const first = quilt('Page one', { updatedAt: 1_780_000_000_500 });
  phone.api(q => (q.get('before') ? { items: [quilt('Page two')], more: false } : { items: [first], more: true }));
  await phone.open();
  await page.locator('#more').click();
  await expect(page.locator('.pin .name')).toHaveText(['Page one', 'Page two']);
  await expect(page.locator('#more')).toBeHidden();
  expect(phone.seen[1]).toContain(`before=${first.updatedAt}`);
  expect(phone.seen[1]).toContain(`beforeId=${first.id}`);
});

test('an empty community invites, and a server that fails is explained', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await expect(page.locator('#empty')).toHaveText('No quilts shared yet: be the first!');
  phone.api(() => null);
  await page.reload();
  await expect(page.locator('#empty')).toContainText('Can’t reach the community right now');
});

test('a quilt the app cannot read is left out, not an error', async ({ phone }) => {
  const { page } = phone;
  phone.api(() => ({ items: [quilt('Good'), { ...quilt('Bad'), design: { cols: 'x' } }], more: false }));
  await phone.open();
  await expect(page.locator('.pin .name')).toHaveText(['Good']);
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });
  test('the screen speaks the phone’s language', async ({ phone }) => {
    const { page } = phone;
    phone.api(() => ({ items: [quilt('Estrela')], more: false }));
    await phone.open();
    await expect(page.locator('h1')).toHaveText('Comunidade');
    await expect(page.locator('.pin .by')).toContainText('de Ana S.');
    expect(await page.locator('html').getAttribute('lang')).toBe('pt-BR');
  });
});
