const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  const keys = ['spoolstar','crossroads','geesecrown','tulipcross','eightstar','nested','twinbars','twisted','spindiamond','hourframe','window','totem'];
  await page.addInitScript(keys => {
    const roles = ['b0','b1','b3'];
    // fabrics are filled in by the page from roles when the count mismatches, so store only pattern keys via a marker
    localStorage.setItem('nb-keys', JSON.stringify(keys));
  }, keys);
  await page.goto('http://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  // apply each new pattern to one block through the pop-up's pattern picker
  const q = await page.locator('#dz-quilt').boundingBox();
  const cols = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1') || '{}').cols || 5);
  for (let i = 0; i < 12; i++) {
    const c = i % 4, r = Math.floor(i / 4);
    await page.mouse.click(q.x + q.width * (c + .5) / cols, q.y + q.height * (r + .5) / cols);
    await page.waitForSelector('#dz-dialog[open]');
    await page.evaluate(k => { const s = document.getElementById('dz-patsel'); s.value = k; s.dispatchEvent(new Event('change', { bubbles: true })); }, keys[i]);
    await page.click('#dz-done');
  }
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks.slice(0, 20).map(b => b.pattern));
  console.log('patterns', stored.join(','));
  await page.screenshot({ path: 'nb_design.png' });
  await page.mouse.click(q.x + q.width * 0.5 / cols, q.y + q.height * 0.5 / cols);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'nb_dialog.png' });
  await page.click('#dz-done');
  await page.click('text=Cutting guide'); await page.waitForTimeout(1200);
  console.log('cut blocks', await page.locator('.cgblock').count());
  await page.screenshot({ path: 'nb_cut.png', fullPage: true });
  console.log('errors', errs);
  await browser.close();
})();
