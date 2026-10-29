// Shared set-up for the browser tests: serves the built page (quilt.html) at http://x/ with the three.js
// libraries from node_modules, so the tests need no network. Also helpers that read the app's state.
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { blockRect, quiltMm } from '../../src/core/geometry.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const NM = path.join(ROOT, 'node_modules');
const LIBS = [
  [/three@0\.183\.2\/(.*)$/, 'three'],
  [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'],
  [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer'],
];
let html = null;
const pageHtml = () =>
  (html ??=
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
    fs.readFileSync(path.join(ROOT, 'quilt.html'), 'utf8') +
    '</body></html>');

export const test = base.extend({
  // set `firstVisit: true` in a test file to see the guided tour start by itself
  firstVisit: [false, { option: true }],
  app: async ({ page, firstVisit }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (!firstVisit)
      await page.addInitScript(() => {
        try {
          localStorage.setItem('quilt-tour.v1', 'done');
        } catch (e) {}
      });
    await page.route('**/*', r => {
      const u = r.request().url();
      for (const [re, pkg] of LIBS) {
        const m = u.match(re);
        if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' });
      }
      if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
      if (u.startsWith('http://x/assets/')) return r.fulfill({ path: path.join(ROOT, u.slice(9).split('#')[0]) });
      if (u.startsWith('http://x/')) return r.fulfill({ body: pageHtml(), contentType: 'text/html' });
      return r.abort();
    });
    const app = {
      page,
      errors,
      async open(hash = 'design') {
        await page.goto('http://x/#' + hash);
        await page.locator('#page-' + hash).waitFor();
        if (hash === 'design')
          await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
      },
      /** the design on screen: saved on every change (before the first change, the default 5 × 5 quilt) */
      async current() {
        const d = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1') || 'null'));
        return (
          d || { cols: 5, rows: 5, blockMm: 458, backFabric: 'b0', blocks: Array.from({ length: 25 }, () => ({})) }
        );
      },
      /** page coordinates of the centre of block i of design d, on the designer's quilt canvas */
      async blockCentre(d, i) {
        const box = await page.locator('#dz-quilt').boundingBox();
        const R = blockRect(d, i % d.cols, Math.floor(i / d.cols), box.width, box.height);
        return { x: box.x + R.x + R.w / 2, y: box.y + R.y + R.h / 2, w: R.w };
      },
      quiltMm,
    };
    await use(app);
    expect(errors, 'no errors in the page').toEqual([]);
  },
});
export { expect };
