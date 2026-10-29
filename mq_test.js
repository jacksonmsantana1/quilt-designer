const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('quilt-tour.v1', 'done'); } catch (e) {} });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.goto('http://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  await page.waitForTimeout(300);
  const q = await page.locator('#dz-quilt').boundingBox();
  const P = (u, v) => [q.x + q.width * u, q.y + q.height * v];
  const info = () => page.evaluate(() => ({ open: document.getElementById('dz-dialog').open, name: document.getElementById('dz-blockname').textContent }));
  // 1. plain click
  await page.mouse.click(...P(0.5, 0.5)); await page.waitForTimeout(200);
  console.log('click:', JSON.stringify(await info()));
  await page.click('#dz-done');
  // 2. drag from block (r0,c0) to block (r1,c2): 3 x 2 = 6 blocks
  await page.mouse.move(...P(0.05, 0.05)); await page.mouse.down();
  await page.mouse.move(...P(0.30, 0.20), { steps: 6 }); await page.mouse.move(...P(0.50, 0.30), { steps: 6 });
  await page.waitForTimeout(150);
  console.log('mid-drag label:', await page.evaluate(() => { const m = document.getElementById('dz-marquee'); return m.hidden ? 'hidden' : m.dataset.count; }));
  await page.screenshot({ path: '/home/claude/quilt/mq_drag.png', clip: { x: 0, y: 100, width: 1000, height: 700 } });
  await page.mouse.up(); await page.waitForTimeout(250);
  console.log('after drag:', JSON.stringify(await info()));
  await page.click('#dz-done');
  // 3. shift-drag adds two more (bottom-right corner area)
  await page.mouse.click(...P(0.1, 0.1)); await page.click('#dz-done');      // reset to one block
  await page.mouse.move(...P(0.05, 0.05)); await page.mouse.down(); await page.mouse.move(...P(0.50, 0.30), { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); await page.click('#dz-done');
  await page.keyboard.down('Shift');
  await page.mouse.move(...P(0.85, 0.85)); await page.mouse.down(); await page.mouse.move(...P(0.95, 0.99), { steps: 5 }); await page.mouse.move(...P(0.70, 0.95), { steps: 5 }); await page.mouse.up();
  await page.keyboard.up('Shift'); await page.waitForTimeout(250);
  console.log('after shift-drag:', JSON.stringify(await info()));
  console.log('errors', errs);
  await browser.close();
})();
