const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream'] });
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
  const st = () => page.evaluate(() => ({ ask: !document.getElementById('cam-ask').hidden, allow: !document.getElementById('cam-allow').hidden, tab: !document.getElementById('cam-newtab').hidden, note: document.getElementById('cam-ask-note').hidden ? '' : document.getElementById('cam-ask-note').textContent, live: !document.getElementById('cam-viewbox').hidden, msg: document.getElementById('cam-msg').textContent }));
  await page.evaluate(() => document.querySelector('#dz-side .cam-open, .cam-open').click());
  await page.waitForTimeout(500);
  console.log('deny', 'opened:', JSON.stringify(await st()));
  await page.screenshot({ path: '/home/claude/quilt/cam_ask_' + 'deny' + '.png' });
  if (await page.isVisible('#cam-allow')) { await page.click('#cam-allow'); await page.waitForTimeout(2000); console.log('deny', 'after allow:', JSON.stringify(await st())); }
  console.log('errors', errs);
  await browser.close();
})();
