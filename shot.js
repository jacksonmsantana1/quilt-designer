const { chromium } = require('playwright');
const fs = require('fs');
const THREE_PATH = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules/three/build/three.min.js';
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  for (const [name, vw, vh, scheme, waitMs, scenario] of [['phone', 400, 860, 'dark', 5000, null]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, colorScheme: scheme });
    const logs = [];
    page.on('console', m => logs.push(m.type() + ': ' + m.text()));
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.route('**/three.min.js', r => r.fulfill({ path: THREE_PATH, contentType: 'text/javascript' }));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await page.route('http://x/', r => r.fulfill({ body: html, contentType: 'text/html' }));
    await page.goto('http://x/');
    await page.waitForTimeout(1500);
    console.log('early', await page.evaluate(() => ({ st: document.getElementById('state').textContent, ms: document.getElementById('m-ms').textContent })), logs.slice(0,5));
    if (scenario) { await page.waitForTimeout(800); await page.click(`button[data-sc="${scenario}"]`); }
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: `/home/claude/quilt/${name}.png`, fullPage: name === 'phone' });
    const txt = await page.evaluate(() => ({ state: document.getElementById('state').textContent, clock: document.getElementById('clock').textContent, ms: document.getElementById('m-ms').textContent, slow: document.getElementById('slow').textContent, sw: document.documentElement.scrollWidth }));
    console.log(name, JSON.stringify(txt), logs.slice(0, 6));
    await page.close();
  }
  await browser.close();
})();
