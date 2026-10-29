const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } }); page.setDefaultTimeout(30000);
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
  const q = await page.locator('#dz-quilt').boundingBox();
  // centre block -> log cabin
  await page.mouse.click(q.x + q.width * 0.5, q.y + q.height * 0.5);
  await page.selectOption('#dz-patsel', 'logcabin');
  await page.click('#dz-done');
  // open the first block and look at the library
  await page.mouse.click(q.x + q.width * 0.1, q.y + q.height * 0.1);
  await page.waitForTimeout(200);
  const lib = () => page.evaluate(() => [...document.querySelectorAll('#dz-library .blib-item')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? ' (editing)' : '')));
  console.log('library:', JSON.stringify(await lib()));
  await page.locator('#dz-dialog').screenshot({ path: '/home/claude/quilt/lib_1.png' });
  await page.click('#dz-library .blib-item:has-text("Log cabin")');
  await page.waitForTimeout(200);
  console.log('after copy:', JSON.stringify(await lib()), '|', await page.evaluate(() => document.getElementById('dz-blockname').textContent));
  await page.click('#dz-done');
  await page.waitForTimeout(200);
  await page.locator('#dz-quilt').screenshot({ path: '/home/claude/quilt/lib_2.png' });
  console.log('errors', errs);
  await browser.close();
})();
