const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  page.setDefaultTimeout(240000);
  await page.addInitScript(() => { window.__ptScale = 0.5; });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 200)); });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);
  await page.goto('http://x/#design'); log('loaded');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics .fab').length > 0, null, { timeout: 60000 }).catch(e => log('fabrics never appeared', errs));
  log('fabrics', await page.evaluate(() => document.querySelectorAll('#dz-fabrics .fab').length), errs);
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/claude/quilt/dz_phone.png', fullPage: true, timeout: 60000 }); log('shot1'); console.log('scrollW', await page.evaluate(() => document.documentElement.scrollWidth)); console.log(errs); await browser.close(); return;
  // edit: select block (row 1, col 2), set log cabin, select all parts... apply fabrics
  const box = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.1);
  await page.click('[data-p="logcabin"]');
  await page.click('#dz-allparts');
  await page.click('#dz-fabrics .fab:nth-child(3)');           // paisley to every part
  const bb = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);   // hearth
  await page.click('#dz-fabrics .fab:nth-child(5)');           // red linen
  await page.click('[data-step="c:1"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/claude/quilt/dz_2.png', timeout: 60000 }); log('shot2');
  console.log('layout', await page.evaluate(() => document.getElementById('dz-size').textContent), '|', await page.evaluate(() => document.getElementById('dz-parts-info').textContent));
  await page.click('#dz-simulate'); log('simulate clicked');
  await page.selectOption('#engine', 'raster'); await page.selectOption('#quality', '32'); log('engine set');
  await page.waitForFunction(() => document.getElementById('rstat').textContent.includes('Render done'), null, { timeout: 300000 }).catch(() => errs.push('render wait timeout'));
  await page.locator('#stage').screenshot({ path: '/home/claude/quilt/dz_3.png' });
  console.log('state', await page.evaluate(() => document.getElementById('state').textContent + ' | ' + document.getElementById('rstat').textContent + ' | ' + document.getElementById('fabnote').textContent));
  console.log(errs.slice(0, 8).join('\n'));
  await browser.close();
})();
