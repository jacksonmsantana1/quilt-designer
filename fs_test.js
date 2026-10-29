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
  await page.mouse.click(q.x + q.width * 0.1, q.y + q.height * 0.1);
  await page.selectOption('#dz-patsel', 'fanstar');
  const bb = await page.locator('#dz-block').boundingBox();
  const at = (u, v) => [bb.x + bb.width * u, bb.y + bb.height * v];
  const fab = async (n) => page.click(`#dz-fabrics2 .fab:nth-child(${n})`);
  // background (role 0 parts carried the cream fabric): select by double-clicking B, paint sage
  await page.mouse.dblclick(...at(0.58, 0.15)); await fab(6);
  // rust parts (indigo by default): double-click fan blade A1, paint red linen
  await page.mouse.dblclick(...at(0.12, 0.45)); await fab(5);
  // light parts (mustard by default): double-click A5, paint cream
  await page.mouse.dblclick(...at(0.25, 0.08)); await fab(1);
  await page.waitForTimeout(200);
  console.log(await page.evaluate(() => document.getElementById('dz-blockname').textContent));
  await page.locator('#dz-block').screenshot({ path: '/home/claude/quilt/fs_block.png' });
  await page.click('#dz-done');
  await page.click('[data-page="cut"]');
  await page.waitForFunction(() => document.querySelectorAll('.cgblock').length > 0);
  await page.waitForTimeout(300);
  const blk = page.locator('.cgblock', { hasText: 'Fan star' });
  await blk.screenshot({ path: '/home/claude/quilt/fs_cut.png' });
  console.log(await blk.evaluate(b => [...b.querySelectorAll('tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')).join('\n')));
  console.log('errors', errs);
  await browser.close();
})();
