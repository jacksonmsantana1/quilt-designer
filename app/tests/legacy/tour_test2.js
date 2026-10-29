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
  await page.waitForSelector('#tour:not([hidden])', { timeout: 8000 });
  await page.click('#tour-skip'); await page.waitForTimeout(300);
  await page.click('[data-step="c:1"]'); await page.click('[data-step="c:1"]'); await page.evaluate(() => { const i = document.getElementById('dz-bmm2'); i.value = 300; i.dispatchEvent(new Event('change')); }); await page.waitForTimeout(800);
  const dz = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('quilt-designer.v1')); return d.cols + 'x' + d.rows + '@' + d.blockMm; });
  console.log('my quilt', await dz());
  await page.click('#tour-start'); await page.waitForTimeout(500);
  console.log('tour welcome shows', await dz());
  await page.click('#tour-actions button:not(.primary)'); await page.waitForTimeout(400);
  console.log('not now ->', await dz());
  await page.click('#tour-start'); await page.waitForTimeout(500);
  const title = () => page.textContent('#tour-title');
  const shot = async n => page.screenshot({ path: `/home/claude/quilt/tour_${n}.png` });
  console.log('auto:', await title()); await shot(0);
  await page.click('#tour-actions button.primary'); await page.waitForTimeout(500);
  console.log('1', await title(), '| new opacity', await page.evaluate(() => getComputedStyle(document.getElementById('dz-new')).opacity), '| c- opacity', await page.evaluate(() => getComputedStyle(document.querySelector('[data-step="c:-1"]')).opacity));
  // blocked click
  await page.evaluate(() => document.getElementById('dz-new').click());   // programmatic click bypasses pointer-events; capture blocker should stop it
  await page.waitForTimeout(200); console.log('blocked new design:', await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).cols));
  await shot(1);
  for (let k = 0; k < 2; k++) { await page.click('[data-step="c:-1"]'); await page.waitForTimeout(250); }
  await page.waitForTimeout(400); console.log('2', await title()); await shot(2);
  for (let k = 0; k < 4; k++) { await page.click('[data-step="r:-1"]'); await page.waitForTimeout(250); }
  await page.waitForTimeout(500); console.log('3', await title()); await shot(3);
  let q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(q.x + q.width / 2, q.y + q.height / 2); await page.waitForTimeout(500);
  console.log('4', await title()); await shot(4);
  await page.click('#dz-patbtn'); await page.waitForTimeout(200); await page.click('.patopt[data-key="pinwheel"]'); await page.waitForTimeout(500);
  console.log('5', await title());
  await page.click('#dz-rot2'); await page.waitForTimeout(500); console.log('6', await title());
  const bb = await page.locator('#dz-block').boundingBox(); await page.mouse.click(bb.x + bb.width * .3, bb.y + bb.height * .1); await page.waitForTimeout(500);
  console.log('7', await title());
  console.log('dbg before', await page.evaluate(() => JSON.stringify({ f: JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks[1].fabrics, cls: document.getElementById('dz-fabrics2').className, info: document.getElementById('dz-parts-info').textContent })));
  await page.locator('#dz-fabrics2 .fab').nth(3).click(); await page.waitForTimeout(500); console.log('8', await title()); await shot(8);
  await page.click('#dz-done'); await page.waitForTimeout(500); console.log('9', await title());
  q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.move(q.x + 5, q.y + q.height / 2); await page.mouse.down(); await page.mouse.move(q.x + q.width - 5, q.y + q.height / 2 + 5, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(600);
  console.log('10', await title()); await shot(10);
  const items = await page.locator('#dz-library .blib-item span').allTextContents(); const pi = items.findIndex(x => x.startsWith('Pinwheel'));
  await page.locator('#dz-library .blib-item').nth(pi).click(); await page.waitForTimeout(500); console.log('11', await title());
  await page.click('#dz-done'); await page.waitForTimeout(500); console.log('12', await title());
  await page.waitForTimeout(600); await page.click('#tl-undo'); await page.waitForTimeout(500); console.log('13', await title());
  await page.click('#tl-redo'); await page.waitForTimeout(500); console.log('14', await title());
  await page.click('#dz-toggle'); await page.waitForTimeout(700); console.log('15', await title()); await shot(15);
  await page.click('.brd-type[data-t="piano"]'); await page.waitForTimeout(600); console.log('end', await title()); await shot(16);
  await page.click('#tour-actions button.primary'); await page.waitForTimeout(500);
  console.log('after keep:', await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('quilt-designer.v1')); return d.cols + 'x' + d.rows + ' ' + d.blocks.map(b => b.pattern).join(',') + ' borders ' + (d.borders || []).length + ' | tour active ' + document.body.classList.contains('tour-active') + ' | new opacity ' + getComputedStyle(document.getElementById('dz-new')).opacity; }));
  console.log('errors', errs);
  await browser.close();
})();
