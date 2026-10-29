const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('https://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(10).split('#')[0] });
    if (u.startsWith('https://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.goto('https://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  const q = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(q.x + q.width * .1, q.y + q.height * .1); await page.waitForTimeout(200);
  const bb = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(bb.x + bb.width * .1, bb.y + bb.height * .1);
  await page.click('#dz-dialog .cam-open'); await page.waitForTimeout(2500);
  console.log('msg:', await page.textContent('#cam-msg'));
  await page.screenshot({ path: '/home/claude/quilt/cam_live.png' });
  await page.click('#cam-snap'); await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/claude/quilt/cam_review.png' });
  const before = await page.locator('#dz-fabrics2 .fab').count();
  await page.click('#cam-use'); await page.waitForTimeout(300);
  console.log('fabrics', before, '->', await page.locator('#dz-fabrics2 .fab').count(), '| dialog open:', await page.evaluate(() => document.getElementById('cam-dialog').open));
  console.log('block0 fabrics:', await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks[0].fabrics.slice(0, 3).join(',')));
  // file fallback path
  await page.click('#dz-dialog .cam-open'); await page.waitForTimeout(1500);
  await page.setInputFiles('#cam-file', '/home/claude/quilt/assets/fabric/linen.jpg');
  await page.waitForTimeout(500);
  await page.fill('#cam-name', 'Test linen'); await page.fill('#cam-cm', '20');
  await page.click('#cam-use'); await page.waitForTimeout(300);
  console.log('after file:', await page.locator('#dz-fabrics2 .fab').count(), await page.evaluate(() => [...document.querySelectorAll('#dz-fabrics2 .fab')].map(b => b.textContent.trim()).slice(-2).join(' / ')));
  await page.screenshot({ path: '/home/claude/quilt/cam_after.png' });
  console.log('errors', errs);
  await browser.close();
})();
