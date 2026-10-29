const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }); page.setDefaultTimeout(60000);
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
  await page.waitForTimeout(300);
  await page.click('#dz-flip');
  await page.waitForTimeout(420);
  await page.screenshot({ path: '/home/claude/quilt/bk_mid.png', clip: { x: 0, y: 100, width: 1000, height: 820 } });
  await page.waitForTimeout(900);
  await page.click('#dz-backfabs .fab:nth-child(3)');     // woven paisley
  await page.waitForTimeout(300);
  console.log('back:', await page.evaluate(() => document.getElementById('dz-backname').textContent), '| button', await page.evaluate(() => document.getElementById('dz-flip').textContent));
  await page.screenshot({ path: '/home/claude/quilt/bk_back.png', clip: { x: 0, y: 100, width: 1000, height: 900 } });
  await browser.close(); console.log('errors', errs); return;
  await page.click('[data-page="cut"]');
  await page.waitForFunction(() => document.querySelector('.backrow'));
  console.log('cut backing row:', await page.evaluate(() => document.querySelector('.backrow').innerText.replace(/\s+/g, ' ')));
  await page.click('[data-page="design"]');
  await page.evaluate(() => { const s = document.getElementById('atrest'); s.value = 'none'; s.dispatchEvent(new Event('change')); });
  await page.click('#dz-simulate2');
  await page.waitForTimeout(1500);
  await page.click('[data-sc="corner"]');
  await page.waitForTimeout(5000);
  await page.locator('#stage').screenshot({ path: '/home/claude/quilt/bk_sim.png' });
  console.log('state', await page.evaluate(() => document.getElementById('state').textContent));
  console.log('errors', errs);
  await browser.close();
})();
