const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
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
  await page.goto('http://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  if (await page.textContent('#dz-toggle') === 'Show design tools') await page.click('#dz-toggle');
  await page.waitForTimeout(300);
  await page.selectOption('#fit-bed', 'br-queen'); await page.waitForTimeout(500);
  console.log('target:', await page.textContent('#fit-target'));
  console.log('options:', (await page.locator('.fitopt b').allTextContents()).join(' | '));
  await page.locator('.fitopt button:not([disabled])').first().click(); await page.waitForTimeout(300);
  console.log('design now:', await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('quilt-designer.v1')); return d.cols + 'x' + d.rows + ' @ ' + d.blockMm; }));
  console.log('fit-now:', await page.textContent('#fit-now'));
  await page.locator('#fit-bed').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/home/claude/quilt/bed_fit.png' });
  await page.click('#dz-simulate'); await page.waitForTimeout(9000);
  console.log('bed-fit:', await page.textContent('#bed-fit'));
  console.log('intro:', await page.textContent('#intro'));
  await page.screenshot({ path: '/home/claude/quilt/bed_sim.png' });
  console.log('errors', errs);
  await browser.close();
})();
