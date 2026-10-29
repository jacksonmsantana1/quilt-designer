// Shared set-up for the browser tests: serves the built page (quilt.html) at http://x/ with the three.js
// libraries from node_modules, so the tests need no network. Also helpers that read the app's state.
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { blockRect, quiltMm } from '@quilt/shared/geometry.js';
import { defaultDesign } from '@quilt/shared/design.js';
import MCR from 'monocart-coverage-reports';
import { coverageOptions } from './coverage.mjs';

const COVERAGE = !!process.env.COVERAGE;

const ROOT = path.resolve(import.meta.dirname, '../..');
const NM = path.join(ROOT, '..', 'node_modules'); // npm workspaces: the packages are in the repository root
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
  // where the page is served: http://localhost/ is a secure context (camera, Web Crypto), http://x/ is not
  origin: ['http://x', { option: true }],
  app: async ({ page, firstVisit, origin }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    // every design is frozen once it is the current one: code that changed it in place would throw
    await page.addInitScript(() => {
      try {
        localStorage.setItem('quilt-freeze.v1', '1');
      } catch (e) {}
    });
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
      if (u.startsWith(origin + '/assets/'))
        return r.fulfill({ path: path.join(ROOT, u.slice(origin.length + 1).split('#')[0]) });
      if (u.startsWith(origin + '/')) return r.fulfill({ body: pageHtml(), contentType: 'text/html' });
      if (u.startsWith('http://127.0.0.1:')) return r.continue(); // a real API server started by a test (sync.spec)
      return r.abort();
    });
    const app = {
      page,
      errors,
      async open(hash = 'design') {
        await page.goto(origin + '/#' + hash);
        await page.locator('#page-' + hash).waitFor();
        if (hash === 'design')
          await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
      },
      /** the design on screen: saved on every change (before the first change, the default 5 × 5 quilt) */
      async current() {
        const d = await page.evaluate(async () => {
          const s = globalThis.__quiltStorage;
          await s.flush();
          const c = s.getSession('current');
          return typeof c === 'string' ? JSON.parse(c) : c || null;
        });
        return d || defaultDesign();
      },
      /** the app's storage (storage/repo.js) after pending writes: run fn(storage) in the page */
      async storage(fn, arg) {
        await page.evaluate(() => globalThis.__quiltStorage.flush());
        return page.evaluate(
          ([f, a]) => new Function('s', 'a', `return (${f})(s, a)`)(globalThis.__quiltStorage, a),
          [fn.toString(), arg],
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
    if (COVERAGE) await MCR(coverageOptions).add(await page.coverage.stopJSCoverage());
    expect(errors, 'no errors in the page').toEqual([]);
  },
});
export { expect };
