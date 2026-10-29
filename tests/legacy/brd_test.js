const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
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
  await page.click('#rail-sash'); await page.waitForTimeout(300); await page.evaluate(() => { for (const id of ['sash-card','brd-card','dz-sideparts']) document.getElementById(id).hidden = false; });
  console.log('types:', (await page.locator('.brd-type span').allTextContents()).join(', '));
  await page.click('.brd-type[data-t="plain"]'); await page.waitForTimeout(500);
  await page.click('.brd-type[data-t="geese"]'); await page.waitForTimeout(500);
  await page.click('.brd-type[data-t="checker"]'); await page.waitForTimeout(500);
  await page.click('.brd-type[data-t="plain"]'); await page.waitForTimeout(500);
  // change outer plain border's corner fabric -> corner squares
  await page.locator('.brd-row').nth(3).locator('.brd-slot').nth(1).click(); await page.locator('#brd-pal .fab').nth(3).click(); await page.waitForTimeout(600);
  await page.locator('.brd-row').nth(0).locator('input').fill('50'); await page.locator('.brd-row').nth(0).locator('input').press('Enter'); await page.waitForTimeout(600);
  console.log('size:', await page.textContent('#dz-size'));
  console.log('rows:', (await page.locator('.brd-row .top b').allTextContents()).join(' | '));
  await page.screenshot({ path: '/home/claude/quilt/brd1.png' });
  // move geese outward, then delete checker
  await page.locator('.brd-row').nth(1).locator('[data-a="out"]').click(); await page.waitForTimeout(400);
  console.log('order:', await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).borders.map(b => b.type + b.mm).join(' > ')));
  await page.click('#rail-brd'); await page.waitForTimeout(300); await page.click('#rail-brd'); await page.waitForTimeout(400);
  const q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(q.x + 6, q.y + q.height / 2); await page.waitForTimeout(400);
  console.log('edge click -> panel:', await page.evaluate(() => [...document.querySelectorAll('#dz-side > .card')].filter(c => c.offsetParent).map(c => c.id).join()));
  await page.click('[data-page="cut"]'); await page.waitForTimeout(1500);
  console.log('borders card:', await page.evaluate(() => { const c = [...document.querySelectorAll('.cg-sash')].find(x => x.querySelector('h3').textContent === 'Borders'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 700) : 'none'; }));
  await page.locator('.cg-sash').last().screenshot({ path: '/home/claude/quilt/brd_cut.png' });
  console.log('errors', errs);
  await browser.close();
})();
