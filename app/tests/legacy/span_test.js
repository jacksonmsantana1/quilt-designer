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
  await page.click('#rail-sash'); await page.click('#sash-presets button:text("50 mm")'); await page.waitForTimeout(300);
  const qb = await page.locator('#dz-quilt').boundingBox();
  // centre block (2,2) -> eight-point star spanning... first make block (1,1) a 3x3
  await page.mouse.click(qb.x + qb.width * 0.30, qb.y + qb.height * 0.30); await page.waitForTimeout(400);
  console.log('span opts', await page.evaluate(() => [...document.getElementById('dz-span').options].map(o => o.textContent + (o.disabled ? '(x)' : '')).join(' | ')));
  await page.selectOption('#dz-span', '3'); await page.waitForTimeout(400);
  await page.click('#dz-patterns [data-p="eightstar"]'); await page.waitForTimeout(400);
  await page.mouse.move(5, 5); await page.waitForTimeout(200);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/span1.png' });
  // hover inside the big block, over the hidden sashing line
  const qb2 = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.move(qb2.x + qb2.width * 0.5, qb2.y + qb2.height * 0.4); await page.waitForTimeout(300);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/span2.png' });
  await page.click('#tabs [data-page="cut"]'); await page.waitForTimeout(2000);
  console.log('meta', await page.evaluate(() => [...document.querySelectorAll('.cgblock .meta')].map(m => m.textContent).join(' || ')));
  await page.locator('#cg-quilt').screenshot({ path: '/home/claude/quilt/span_cut.png' });
  console.log('errors', errs); await browser.close(); })();
