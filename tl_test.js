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
  await page.waitForTimeout(500);
  const st = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('quilt-designer.v1') || 'null'); const o = JSON.parse(localStorage.getItem('quilt-timeline.v1') || '{}'); return `${document.getElementById('tl-open').textContent} | design ${d ? d.cols + 'x' + d.rows + '@' + d.blockMm : 'default'} | labels: ${(o.steps || []).map(s => s.label).join(' > ')}`; });
  const setBmm = async v => { await page.evaluate(v => { const i = document.getElementById('dz-bmm2'); i.value = v; i.dispatchEvent(new Event('change')); }, v); await page.waitForTimeout(700); };
  console.log('start ', await st());
  await setBmm(400);
  await page.click('[data-step="c:1"]'); await page.waitForTimeout(700);
  // fabric change through the block editor
  const q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(q.x + 20, q.y + 20); await page.waitForTimeout(300);
  await page.click('#dz-allparts'); await page.locator('#dz-fabrics2 .fab').nth(6).click(); await page.waitForTimeout(700);
  await page.click('#dz-done');
  console.log('edits ', await st());
  await page.click('#tl-undo'); await page.waitForTimeout(300);
  console.log('undo  ', await st());
  await page.mouse.move(5, 5); await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  console.log('ctrl+z', await st());
  await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(300);
  console.log('redo  ', await st());
  await page.click('#tl-open'); await page.waitForTimeout(400);
  await page.screenshot({ path: '/home/claude/quilt/tl_panel.png' });
  await page.locator('.tl-step').nth(0).click(); await page.waitForTimeout(400);
  console.log('step 1', await st());
  await setBmm(350); await page.waitForTimeout(2000);
  console.log('branch', await st());
  await page.reload(); await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0); await page.waitForTimeout(600);
  console.log('reload', await st());
  // cap: pretend 100 steps exist, then make one more change
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('quilt-timeline.v1')); const last = o.steps[o.steps.length - 1]; o.steps = Array.from({ length: 100 }, (_, k) => ({ ...last, id: k + 1, label: 'S' + (k + 1) })); o.i = 99; o.seq = 100; localStorage.setItem('quilt-timeline.v1', JSON.stringify(o)); });
  await page.reload(); await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0); await page.waitForTimeout(600);
  await setBmm(420); await page.waitForTimeout(2500);
  console.log('cap   ', await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('quilt-timeline.v1')); return o.steps.length + ' steps, first ' + o.steps[0].label + ', last ' + o.steps[o.steps.length - 1].label + ' | ' + document.getElementById('tl-open').textContent; }));
  console.log('errors', errs);
  await browser.close();
})();
