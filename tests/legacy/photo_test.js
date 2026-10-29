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
  await page.goto('http://x/#mine'); await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/claude/quilt/med_mine.png' });
  const card = page.locator('text=Medallion from the photo').first(); console.log('card', await card.count());
  await card.click(); await page.waitForTimeout(500);
  const open = page.locator('button:text("Open")'); if (await open.count()) { await open.first().click(); }
  await page.waitForTimeout(2500);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/med_design.png' });
  await page.evaluate(() => document.getElementById('dz-sym').value); await page.mouse.move(2,2); await page.waitForTimeout(300); await page.locator('#dz-quilt').screenshot({ path: '/home/claude/quilt/photo_q.png' });
  await page.click('#dz-sim'); await page.waitForTimeout(14000); await page.screenshot({ path: '/home/claude/quilt/photo_sim.png' }); await page.click('#sim-close');
  await page.click('#tabs [data-page="cut"]'); await page.waitForTimeout(2500);
  console.log('cards', await page.evaluate(() => [...document.querySelectorAll('.cgblock h3')].map(h => h.textContent).join(', ')));
  console.log('errors', errs); await browser.close(); })();
