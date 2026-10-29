const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
const [W, H, out, edit] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, isMobile: +W < 600, hasTouch: +W < 600 });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  if (edit) {
    await page.goto('http://x/#design');
    await page.waitForFunction(() => document.querySelectorAll('#dz-fabrics2 .fab').length > 0);
    const q = await page.locator('#dz-quilt').boundingBox();
    await page.mouse.click(q.x + q.width * 0.5, q.y + q.height * 0.5);
    await page.selectOption('#dz-patsel', 'logcabin');
    await page.click('#dz-done');
    await page.click('[data-page="cut"]');
  } else {
    await page.goto('http://x/#cut');
  }
  await page.waitForFunction(() => document.querySelectorAll('#cg-blocks .cgblock').length > 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/claude/quilt/' + out, fullPage: true });
  console.log('scrollW', await page.evaluate(() => document.documentElement.scrollWidth));
  console.log(await page.evaluate(() => document.getElementById('cg-facts').innerText));
  console.log(await page.evaluate(() => [...document.querySelectorAll('#cg-fabrics tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')).join('\n')));
  console.log(await page.evaluate(() => [...document.querySelectorAll('.cgblock')].map(b => b.querySelector('.meta').textContent + ' :: ' + [...b.querySelectorAll('tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' | ')).join('\n')));
  console.log('errors', errs);
  await browser.close();
})();
