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
  if (await page.textContent('#dz-toggle') === 'Show design tools') await page.click('#dz-toggle');
  await page.waitForTimeout(400);
  const info = () => page.evaluate(() => { const q = document.getElementById('dz-quilt').getBoundingClientRect(), s = document.getElementById('dz-side'); return JSON.stringify({ quiltTop: Math.round(q.top), quiltBottom: Math.round(q.bottom), winH: innerHeight, pageScroll: scrollY, panelScroll: s.scrollTop, panelScrollMax: s.scrollHeight - s.clientHeight }); });
  console.log('open:', await info());
  const sb = await page.locator('#dz-side').boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + 300); await page.mouse.wheel(0, 900); await page.waitForTimeout(400);
  console.log('after wheel on panel:', await info());
  await page.screenshot({ path: '/home/claude/quilt/sticky.png' });
  await page.mouse.move(400, 500); await page.mouse.wheel(0, 900); await page.waitForTimeout(400);
  console.log('after wheel on quilt side:', await info());
  await page.screenshot({ path: '/home/claude/quilt/sticky2.png' });
  console.log('errors', errs);
  await browser.close();
})();
