const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('quilt-bed.v1', JSON.stringify({ key: 'br-solteiro', w: 880, l: 1880, drop: 300, tuck: true })); } });
  const cdp = await page.context().newCDPSession(page);
  const cdpShot = async f => { const r = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, width: b.width, height: b.height }; }); const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } }); require('fs').writeFileSync(f, Buffer.from(data, 'base64')); };
  await page.goto('http://x/');
  await page.waitForTimeout(2500);
  console.log('first page:', await page.evaluate(() => ['sim', 'design', 'cut'].filter(p => !document.getElementById('page-' + p).hidden).join() + ' | tab ' + document.querySelector('[aria-selected="true"]').textContent + ' | at rest: ' + document.getElementById('atrest').value));
  await page.evaluate(() => document.querySelector('[data-page="sim"]').click());
  await page.waitForTimeout(9000);
  console.log('sim:', await page.evaluate(() => document.getElementById('state').textContent + ' | view ' + [...document.querySelectorAll('#views button')].find(b => b.getAttribute('aria-pressed') === 'true').textContent + ' | rstat hidden ' + document.getElementById('rstat').hidden + ' | canvas ' + document.getElementById('view').width + 'x' + document.getElementById('view').height));
  await cdpShot('/home/claude/quilt/first_sim.png');
  console.log('errors', errs);
  await browser.close();
})();
