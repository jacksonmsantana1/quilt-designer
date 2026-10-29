const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (/setFussy/.test(m.text())) console.log(m.text()); });
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
  const card = page.locator('text=Medallion sampler').first(); console.log('card', await card.count());
  await card.click(); await page.waitForTimeout(500);
  const open = page.locator('button:text("Open")'); if (await open.count()) { await open.first().click(); }
  await page.waitForTimeout(2500);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/med_design.png' });
  const qb = await page.locator('#dz-quilt').boundingBox();
  // economy block at column 7, row 1 (index 6,0): click it, then its centre piece
  const R = await page.evaluate(() => { const c = document.getElementById('dz-quilt').getBoundingClientRect(); return [c.width, c.height]; });
  const cell = (c, r) => { const o = 175 / 2310 * R[0], s = 140 / 2310 * R[0]; return [qb.x + o + (c + .5) * s, qb.y + o + (r + .5) * s]; };
  let p = cell(6, 0); await page.mouse.click(p[0] + 8, p[1] + 8); await page.waitForTimeout(500);
  const bb = await page.locator('#dz-block').boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(600);
  console.log('fussy shown', await page.evaluate(() => !document.getElementById('dz-fussy').hidden), await page.textContent('#dz-parts-info'));
  await page.locator('#dz-fussy-cv').click({ position: { x: 55, y: 60 } }); await page.waitForTimeout(500);
  await page.locator('#dz-fussy').screenshot({ path: '/home/claude/quilt/fussy_ui.png' });
  await page.selectOption('#dz-quilting', 'fans'); await page.waitForTimeout(800);
  await page.mouse.move(2, 2); await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/quilting.png' });
  await page.click('#dz-sim'); await page.waitForTimeout(14000); await page.screenshot({ path: '/home/claude/quilt/med_sim.png' }); await page.click('#sim-close');
  await page.click('#tabs [data-page="cut"]'); await page.waitForTimeout(2500);
  console.log('fussy rows', await page.evaluate(() => [...document.querySelectorAll('.cgblock td')].map(t => t.textContent).filter(t => /fussy/.test(t)).slice(0, 3).join(' || ')));
  console.log('cards', await page.evaluate(() => [...document.querySelectorAll('.cgblock h3')].map(h => h.textContent).join(', ')));
  console.log('errors', errs); await browser.close(); })();
