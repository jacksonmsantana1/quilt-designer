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
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('quilt-designer.v1')) || null; return d; });
  // build: two spinning-diamond blocks with the same fabrics, one turned 90°, plus an HST turned 90° (looks different)
  const q = await page.locator('#dz-quilt').boundingBox(); const bw = q.width / 5;
  const pick = async (c, r, pat, rots) => { await page.mouse.click(q.x + bw * (c + .5), q.y + bw * (r + .5)); await page.waitForTimeout(200);
    await page.evaluate(p => { const s = document.getElementById('dz-patsel'); s.value = p; s.dispatchEvent(new Event('change')); }, pat); await page.waitForTimeout(150);
    for (let k = 0; k < rots; k++) { await page.click('#dz-rot2'); await page.waitForTimeout(120); } await page.click('#dz-done'); await page.waitForTimeout(150); };
  await pick(0, 0, 'spindiamond', 0); await pick(1, 1, 'spindiamond', 1); await pick(2, 2, 'hst', 0); await pick(3, 3, 'hst', 1);
  await page.mouse.click(q.x + bw * .5, q.y + bw * .5); await page.waitForTimeout(300);
  console.log('library:', await page.evaluate(() => [...document.querySelectorAll('#dz-library .blib-item span')].map(s => s.textContent).join(' | ')));
  await page.locator('#dz-library').screenshot({ path: '/home/claude/quilt/lib2.png' });
  console.log('errors', errs);
  await browser.close();
})();
