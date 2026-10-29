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
  await page.goto('http://x/#design'); await page.waitForTimeout(2500);
  const qb = await page.locator('#dz-quilt').boundingBox();
  // block 0: pick twisted square (asymmetric), then turn on 4-way symmetry
  await page.mouse.click(qb.x + qb.width * 0.08, qb.y + qb.width * 0.08); await page.waitForTimeout(400);
  await page.click('#dz-patterns [data-p="twisted"]'); await page.waitForTimeout(300);
  await page.mouse.click(qb.x + qb.width * 0.28, qb.y + qb.width * 0.08); await page.waitForTimeout(400);
  await page.click('#dz-patterns [data-p="geese"]'); await page.waitForTimeout(300);
  await page.selectOption('#dz-sym', 'kal'); await page.waitForTimeout(500);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/sym1.png' });
  // edit a block now: rotate block (0,1) via hover button and check its partners follow
  await page.mouse.move(qb.x + qb.width * 0.30, qb.y + qb.width * 0.10); await page.waitForTimeout(300);
  const rb = await page.evaluate(() => { const r = document.getElementById('dz-hrot').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(rb[0], rb[1], { steps: 3 }); await page.mouse.click(rb[0], rb[1]); await page.waitForTimeout(500);
  await page.mouse.move(5, 5); await page.waitForTimeout(300);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/sym2.png' });
  await page.click('#tabs [data-page="cut"]'); await page.waitForTimeout(2000);
  console.log('meta', await page.evaluate(() => [...document.querySelectorAll('.cgblock .meta')].map(m => m.textContent).slice(0, 4).join(' || ')));
  console.log('errors', errs); await browser.close(); })();
