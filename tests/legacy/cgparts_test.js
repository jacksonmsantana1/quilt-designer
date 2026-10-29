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
  const st = () => page.evaluate(() => [...document.querySelectorAll('.cg-sash')].map(d => d.querySelector('h3').textContent + ':' + d.classList.contains('open') + ':' + d.classList.contains('picked')).join(' | '));
  console.log('cards', await st());
  console.log('ids', await page.evaluate(() => [...document.querySelectorAll('.cg-sash td.l')].map(t => t.textContent).join(' ')));
  const sash = page.locator('.cg-sash').nth(0).locator('canvas'), brd = page.locator('.cg-sash').nth(1).locator('canvas');
  await sash.click(); await page.waitForTimeout(800); console.log('after click sash', await st());
  await sash.hover(); await page.waitForTimeout(300); await page.locator('.cg-sash').nth(0).screenshot({ path: '/home/claude/quilt/cgsash.png' });
  await sash.dblclick(); await page.waitForTimeout(700);
  console.log('pop', await page.evaluate(() => [document.getElementById('cg-pop').open, document.getElementById('cg-pop-title').textContent, document.getElementById('cg-quilt-meta').textContent.slice(0, 50)]), await st());
  await page.locator('#cg-pop').screenshot({ path: '/home/claude/quilt/cgpop_sash.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await brd.dblclick(); await page.waitForTimeout(700);
  console.log('pop', await page.evaluate(() => [document.getElementById('cg-pop').open, document.getElementById('cg-pop-title').textContent]));
  await page.locator('#cg-pop').screenshot({ path: '/home/claude/quilt/cgpop_brd.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await brd.click(); await page.waitForTimeout(800); await page.locator('.cg-sash').nth(1).screenshot({ path: '/home/claude/quilt/cgbrd.png' });
  await brd.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600); console.log('after enter brd', await st());
  // blocks still work
  await page.locator('.cgblock:not(.cg-sash) canvas').first().dblclick(); await page.waitForTimeout(600); console.log('block pop', await page.evaluate(() => document.getElementById('cg-pop-title').textContent));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.locator('#cg-quilt').scrollIntoViewIfNeeded(); await page.locator('#cg-quilt').screenshot({ path: '/home/claude/quilt/cgwhole.png' });
  await page.locator('.cg-sash canvas').first().dblclick(); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  await page.evaluate(() => { cgHi = 'sash'; });
  console.log('errors', errs);
  await browser.close();
})();
