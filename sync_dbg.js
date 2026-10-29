const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt_dbg.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  page.on('console', m => { console.log('console:', m.text().slice(0, 200)); });
  setInterval(() => {}, 1000);
  await page.goto('http://x/#design', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  await page.waitForTimeout(800);
  console.log('buttons left:', await page.locator('#dz-simulate, #dz-simulate2').count(), '| intro:', (await page.textContent('#intro')).slice(0, 40));
  const q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(q.x + q.width * .1, q.y + q.height * .1); await page.waitForTimeout(200);
  const bb = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(bb.x + bb.width * .1, bb.y + bb.height * .1);
  await page.locator('#dz-fabrics2 .fab').nth(6).click();
  console.log('right after:', await page.textContent('#dz-sync'));
  await page.waitForTimeout(800);
  console.log('after pause:', await page.textContent('#dz-sync'));
  await page.click('#dz-done');
  await page.fill('#dz-bmm2', '400'); await page.press('#dz-bmm2', 'Tab'); await page.waitForTimeout(900);
  console.log('after size:', await page.textContent('#dz-sync'), '| intro:', (await page.textContent('#intro')).slice(0, 40));
  console.log('errors', errs);
  await browser.close();
})();
