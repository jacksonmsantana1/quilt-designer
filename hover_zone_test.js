const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('quilt-tour.v1', 'done');
  } catch (e) {} });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.goto('http://x/#design'); await page.waitForTimeout(2500);
  await page.click('#rail-sash'); await page.click('#sash-presets button:text("50 mm")'); await page.waitForTimeout(400);
  await page.click('#rail-brd'); await page.click('.brd-type[data-t="plain"]'); await page.waitForTimeout(400); await page.click('.brd-type[data-t="piano"]'); await page.waitForTimeout(400);
  await page.dblclick('body', { position: { x: 20, y: 700 } }).catch(() => {}); await page.waitForTimeout(400);
  const qb = await page.locator('#dz-quilt').boundingBox();
  const zone = () => page.evaluate(() => getComputedStyle(document.getElementById('dz-hover')).display);
  await page.mouse.move(qb.x + qb.width * 0.5, qb.y + 4); await page.waitForTimeout(250);
  await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/hv_brd.png' });
  // a sashing strip: between block columns 1 and 2 of the 5 x 5 quilt, middle of row 1
  const sr = await page.evaluate(() => { const r = document.getElementById('dz-quilt').getBoundingClientRect(); return [r.x, r.y]; });
  await page.mouse.move(qb.x + qb.width * 0.5, qb.y + qb.height * 0.5 + 1); await page.waitForTimeout(100);
  // find a sashing pixel by scanning a row across the middle
  for (let x = qb.x + qb.width * 0.15; x < qb.x + qb.width * 0.5; x += 2) { await page.mouse.move(x, qb.y + qb.height * 0.5); const rb = await page.evaluate(() => document.getElementById('dz-hrot').hidden); if (rb) { break; } }
  await page.waitForTimeout(250); await page.locator('.flipper').screenshot({ path: '/home/claude/quilt/hv_sash.png' });
  await page.mouse.move(5, 5); await page.waitForTimeout(200);
  console.log('errors', errs); await browser.close(); })();
