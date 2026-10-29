const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  page.on('console', m => { if (!/GPU stall|GL Driver/.test(m.text())) console.log('console', m.type(), m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('requestfailed', r => console.log('reqfail', r.url()));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u === 'http://x/') return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9) });
    console.log('unrouted', u); return r.abort();
  });
  await page.goto('http://x/');
  for (let k = 0; k < 12; k++) {
    const t0 = Date.now();
    const v = await Promise.race([page.evaluate(() => ({ f: window.__f || 0, load: document.getElementById('loading').textContent, hidden: document.getElementById('loading').hidden, st: document.getElementById('state').textContent })), new Promise(r => setTimeout(() => r('TIMEOUT'), 8000))]);
    console.log(k, Date.now() - t0, 'ms', JSON.stringify(v));
    await new Promise(r => setTimeout(r, 2000));
  }
  await browser.close();
})();
