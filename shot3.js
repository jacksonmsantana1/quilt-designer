const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [
  [/cdn\.jsdelivr\.net\/npm\/three@0\.183\.2\/(.*)$/, m => path.join(NM, 'three', m[1])],
  [/cdn\.jsdelivr\.net\/npm\/three-mesh-bvh@0\.9\.14\/(.*)$/, m => path.join(NM, 'three-mesh-bvh', m[1])],
  [/cdn\.jsdelivr\.net\/npm\/three-gpu-pathtracer@0\.0\.24\/(.*)$/, m => path.join(NM, 'three-gpu-pathtracer', m[1])],
];
const shots = JSON.parse(process.argv[2] || '[]');
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, colorScheme: 'light' });
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|GL Driver/.test(m.text())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, f] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: f(m), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u === 'http://x/') return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9) });
    return r.continue();
  });
  await page.goto('http://x/');
  for (const s of shots) {
    if (s.click) await page.click(s.click);
    if (s.select) await page.selectOption(s.select[0], s.select[1]);
    if (s.waitText) await page.waitForFunction(([id, t]) => document.getElementById(id).textContent.includes(t), s.waitText, { timeout: s.timeout || 90000 }).catch(e => logs.push('wait timeout ' + s.waitText));
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '/home/claude/quilt/' + s.shot }); }
    if (s.log) console.log(s.log, await page.evaluate(() => ({ state: document.getElementById('state').textContent, rstat: document.getElementById('rstat').textContent, loading: document.getElementById('loading').hidden })));
  }
  console.log(logs.slice(0, 15).join('\n'));
  await browser.close();
})();
