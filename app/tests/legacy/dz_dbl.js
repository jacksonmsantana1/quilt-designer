const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
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
  await page.evaluate(() => localStorage.clear());
  const box = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1);   // first block: Ohio star
  await page.waitForTimeout(300);
  const bb = await page.locator('#dz-block').boundingBox();
  await page.mouse.dblclick(bb.x + bb.width * 0.08, bb.y + bb.height * 0.08);   // a cream corner
  await page.waitForTimeout(200);
  console.log('after dblclick:', await page.evaluate(() => document.getElementById('dz-parts-info').textContent));
  await page.locator('#dz-dialog').screenshot({ path: '/home/claude/quilt/dbl.png' });
  console.log(errs.join('\n'));
  await browser.close();
})();
