const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
const [W, H, stage, light, target, outName, field] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  await page.addInitScript(() => {
    window.__ptScale = 0.5;
    window.claude = { use: async (n) => n === 'downloads' ? { save: async ({ filename, data }) => {
      const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      window.__saved = { filename, size: data.size, b64: btoa(s) }; return { status: 'saved' }; } } : null };
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console error', m.text().slice(0, 200)); });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u === 'http://x/') return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9) });
    return r.abort();
  });
  await page.goto('http://x/');
  await page.selectOption('#quality', target).catch(()=>{});
  await page.selectOption('#engine', 'raster');
  await page.selectOption('#stagesel', stage);
  await page.selectOption('#lightsel', light);
  if (field) await page.selectOption('#atrest', 'analysis');
  const t0 = Date.now();
  const want = field ? 'analysis' : 'Render done';
  while (Date.now() - t0 < 540000) {
    const s = await page.evaluate(() => document.getElementById('rstat').textContent + ' | ' + document.getElementById('state').textContent + ' | ' + document.getElementById('views').querySelector('[aria-pressed=true]').dataset.view);
    process.stdout.write(((Date.now() - t0) / 1000).toFixed(0) + 's ' + s + '\n');
    if (s.includes(want)) break;
    await new Promise(r => setTimeout(r, 15000));
  }
  if (field) await new Promise(r => setTimeout(r, 20000));
  await page.click('#saveimg2');
  await page.waitForFunction(() => window.__saved, null, { timeout: 120000 });
  const sv = await page.evaluate(() => window.__saved);
  require('fs').writeFileSync('/home/claude/quilt/' + outName, Buffer.from(sv.b64, 'base64'));
  console.log('saved file', sv.filename, sv.size, 'bytes; status text:', await page.evaluate(() => document.getElementById('savestat2').textContent));
  console.log('saved', outName);
  await browser.close();
})();
