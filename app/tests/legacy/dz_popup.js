const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const W = +(process.argv[2] || 1200), H = +(process.argv[3] || 1000);
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(30000);
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.goto('http://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0 || document.querySelectorAll('#dz-fabrics .fab').length > 0);
  await page.waitForTimeout(600);
  const info = async () => page.evaluate(() => ({ sideHidden: document.getElementById('dz-side').hidden, dialogOpen: document.getElementById('dz-dialog').open, rot: document.getElementById('dz-rot2').textContent, parts: document.getElementById('dz-parts-info').textContent, toggle: document.getElementById('dz-toggle').textContent, scrollW: document.documentElement.scrollWidth }));
  console.log('start', JSON.stringify(await info()));
  await page.screenshot({ path: `/home/claude/quilt/pp_1_${W}.png` });
  const box = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);   // centre block
  await page.waitForTimeout(300);
  console.log('after click', JSON.stringify(await info()));
  await page.click('#dz-allparts');
  await page.click('#dz-fabrics2 .fab:nth-child(6)');      // sage
  const bb = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);   // centre part
  await page.click('#dz-fabrics2 .fab:nth-child(5)');      // red linen
  await page.click('#dz-rot2');
  await page.waitForTimeout(200);
  console.log('edited', JSON.stringify(await info()));
  await page.screenshot({ path: `/home/claude/quilt/pp_2_${W}.png` });
  await page.click('#dz-done');
  await page.click('#dz-toggle');
  await page.waitForTimeout(300);
  console.log('tools', JSON.stringify(await info()));
  await page.screenshot({ path: `/home/claude/quilt/pp_3_${W}.png` });
  console.log(errs.join('\n'));
  await browser.close();
})();
