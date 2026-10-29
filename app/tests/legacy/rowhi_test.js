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
  await page.click('#tabs [data-page="cut"]');
  await page.waitForTimeout(2500);
  await page.waitForTimeout(1500);
  const card = page.locator('#cg-blocks .cgblock').first();
  await card.locator('canvas').click(); await page.waitForTimeout(900);
  const rows = card.locator('tbody tr'); console.log('rows', await rows.count(), await rows.nth(1).textContent());
  await rows.nth(1).hover(); await page.waitForTimeout(400);
  await card.screenshot({ path: '/home/claude/quilt/rowhi_block.png' });
  const sc = page.locator('.cg-sash').first(); await page.mouse.move(1, 1); await sc.locator('canvas').click(); await page.waitForTimeout(900);
  await sc.locator('tbody tr').nth(1).hover(); await page.waitForTimeout(400); await sc.screenshot({ path: '/home/claude/quilt/rowhi_sash.png' });
  const bc = page.locator('.cg-sash').nth(2); await page.mouse.move(1, 1); await bc.locator('canvas').click(); await page.waitForTimeout(900);
  await bc.locator('tbody tr').nth(1).hover(); await page.waitForTimeout(400); await bc.screenshot({ path: '/home/claude/quilt/rowhi_brd.png' });
  await page.mouse.move(1, 1); await page.locator('#cg-quilt').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#cg-blocks .cgblock tbody tr').dispatchEvent(new MouseEvent('mouseenter'))); await page.waitForTimeout(300);
  await page.locator('#cg-quilt').screenshot({ path: '/home/claude/quilt/rowhi_quilt.png' });
  console.log('errors', errs); await browser.close(); })();
