const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
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
  await page.goto('http://x/#design');
  await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
  await page.click('#rail-sash'); await page.waitForTimeout(300); await page.evaluate(() => { for (const id of ['sash-card','brd-card','dz-sideparts']) document.getElementById(id).hidden = false; });
  await page.click('#sash-presets button:text("50 mm")'); await page.waitForTimeout(300);
  await page.locator('#sash-fabs .fab').nth(1).click(); await page.locator('#sash-corner .fab').nth(4).click(); await page.waitForTimeout(800);
  console.log('size:', await page.textContent('#dz-size'), '| intro dims', await page.evaluate(() => document.getElementById('intro').textContent.slice(0, 16)));
  await page.screenshot({ path: '/home/claude/quilt/sash1.png' });
  await page.check('#sash-border'); await page.waitForTimeout(800);
  console.log('border:', await page.textContent('#dz-size'));
  // click a block and click the sashing
  const q = await page.locator('#dz-quilt').boundingBox();
  const st = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('quilt-designer.v1')); const q = quiltMm(d); return { W: q.W, H: q.H, mm: d.sashing.mm, B: d.blockMm }; }).catch(() => null);
  console.log('dims', JSON.stringify(st));
  await page.click('#dz-toggle'); await page.waitForTimeout(400);
  const q2 = await page.locator('#dz-quilt').boundingBox();
  const k = q2.width / 2490;   // 5*458 + 6*50 = 2590? computed below
  await page.mouse.click(q2.x + q2.width * (50 + 229) / 2590, q2.y + q2.height * (50 + 229) / 2590); await page.waitForTimeout(300);
  console.log('block click ->', await page.textContent('#dz-blockname'));
  await page.click('#dz-done');
  await page.mouse.click(q2.x + q2.width * (50 + 458 + 25) / 2590, q2.y + q2.height * 0.3); await page.waitForTimeout(500);
  console.log('sash click -> tools', await page.textContent('#dz-toggle'));
  await page.screenshot({ path: '/home/claude/quilt/sash2.png' });
  await page.click('[data-page="cut"]'); await page.waitForTimeout(1200);
  console.log('cut sash:', await page.evaluate(() => { const c = document.querySelector('.cg-sash'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 200) : 'none'; }));
  await page.locator('.cg-sash').screenshot({ path: '/home/claude/quilt/sash_cut.png' });
  console.log('fabric reqs:', await page.evaluate(() => [...document.querySelectorAll('#cg-fabrics tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' | ').slice(0, 300)));
  console.log('errors', errs);
  await browser.close();
})();
