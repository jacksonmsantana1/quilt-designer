const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  const log = (...a) => console.log(...a);
  // Simulation page
  await page.goto('http://x/');
  await page.waitForTimeout(6000);
  log('sim: scrollW', await page.evaluate(() => document.documentElement.scrollWidth), 'renderBtnHidden', await page.evaluate(() => document.getElementById('rbtn').hidden), 'renderCardHidden', await page.evaluate(() => document.getElementById('render-card').hidden), 'state', await page.evaluate(() => document.getElementById('state').textContent));
  await page.screenshot({ path: '/home/claude/quilt/m_sim.png', fullPage: false });
  await page.screenshot({ path: '/home/claude/quilt/m_sim_full.png', fullPage: true });
  log('view after rest:', await page.evaluate(() => document.querySelector('#views [aria-pressed=true]').dataset.view), 'analysis legend hidden', await page.evaluate(() => document.getElementById('legend3d').hidden));
  await page.tap('[data-view="analysis"]'); await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/claude/quilt/m_analysis.png' });
  await page.tap('[data-view="photo"]');
  // Designer
  await page.tap('[data-page="design"]');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  await page.waitForTimeout(400);
  log('design: scrollW', await page.evaluate(() => document.documentElement.scrollWidth));
  await page.screenshot({ path: '/home/claude/quilt/m_design.png' });
  const q = await page.locator('#dz-quilt').boundingBox();
  await page.touchscreen.tap(q.x + q.width * 0.1, q.y + q.height * 0.1);
  await page.waitForTimeout(300);
  const b = await page.locator('#dz-block').boundingBox();
  await page.touchscreen.tap(b.x + b.width * 0.08, b.y + b.height * 0.08);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(b.x + b.width * 0.08, b.y + b.height * 0.08);
  await page.waitForTimeout(250);
  log('double-tap ->', await page.evaluate(() => document.getElementById('dz-parts-info').textContent), '| dialog open', await page.evaluate(() => document.getElementById('dz-dialog').open));
  await page.screenshot({ path: '/home/claude/quilt/m_dialog.png' });
  await page.tap('#dz-done');
  await page.tap('#dz-multi');
  for (const [fx, fy] of [[0.3, 0.1], [0.5, 0.1], [0.7, 0.1]]) { await page.touchscreen.tap(q.x + q.width * fx, q.y + q.height * fy); await page.waitForTimeout(120); }
  log('multi ->', await page.evaluate(() => document.getElementById('dz-editsel').textContent), '| dialog open', await page.evaluate(() => document.getElementById('dz-dialog').open));
  await page.screenshot({ path: '/home/claude/quilt/m_multi.png' });
  await page.tap('#dz-editsel');
  await page.waitForTimeout(200);
  log('edit selected -> dialog open', await page.evaluate(() => document.getElementById('dz-dialog').open), '|', await page.evaluate(() => document.getElementById('dz-blockname').textContent));
  log('errors', errs);
  await browser.close();
})();
