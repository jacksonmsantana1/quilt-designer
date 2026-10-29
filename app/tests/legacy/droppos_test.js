const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('quilt-tour.v1', 'done'); } catch (e) {} });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.addInitScript(() => { localStorage.setItem('quilt-run-more.v1', '1'); localStorage.setItem('quilt-sim-adv.v1', '1'); if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('quilt-bed.v1', JSON.stringify({ key: 'br-solteiro', w: 880, l: 1880, drop: 300, tuck: true })); } });
  const cdp = await page.context().newCDPSession(page);
  const cdpShot = async f => { const r = { x: 0, y: 0, width: 1300, height: 1000 }; const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } }); require('fs').writeFileSync(f, Buffer.from(data, 'base64')); };
  await page.goto('http://x/'); await page.waitForTimeout(2500);
  await page.click('#dz-sim'); await page.waitForTimeout(3000);
  await page.waitForTimeout(8000);
  console.log('slider', await page.evaluate(() => { const e = document.getElementById('drop-pos'); return [e.min, e.max, e.value, document.getElementById('drop-pos-v').textContent]; }));
  await page.evaluate(() => { const e = document.getElementById('drop-pos'); e.value = '600'; e.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300); await cdpShot('/home/claude/quilt/dp_guide.png');
  await page.evaluate(() => document.getElementById('drop-pos').dispatchEvent(new Event('change')));
  await page.waitForTimeout(12000); await cdpShot('/home/claude/quilt/dp_after.png');
  console.log('label', await page.textContent('#drop-pos-v'));
  await page.selectOption('#bedsel', 'tb-rect8'); await page.waitForTimeout(500);
  console.log('table slider', await page.evaluate(() => { const e = document.getElementById('drop-pos'); return [e.min, e.max, e.value, document.getElementById('drop-pos-v').textContent]; }));
  await page.selectOption('#bedsel', 'us-queen');
  console.log('errors', errs); await browser.close(); })();
