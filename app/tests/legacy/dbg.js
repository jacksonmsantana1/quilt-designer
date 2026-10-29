const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt_dbg.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 480, height: 600 } });
  page.setDefaultTimeout(240000);
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u === 'http://x/') return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9) });
    return r.abort();
  });
  await page.goto('http://x/');
  await page.selectOption('#quality', '32'); await page.selectOption('#engine', 'raster');
  await page.waitForFunction(() => window.__dbg && window.__dbg.raster.n > 10, null, { timeout: 200000 });
  const out = await page.evaluate(() => {
    const { raster, renderer, scene, sun, skyLight } = window.__dbg;
    const h2f = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; return e === 0 ? s * Math.pow(2, -14) * (m / 1024) : e === 31 ? (m ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + m / 1024); };
    const read = (rt, fx = 0.5, fy = 0.5) => { const b = new Uint16Array(4);
      try { renderer.readRenderTargetPixels(rt, Math.floor(rt.width * fx), Math.floor(rt.height * fy), 1, 1, b); return Array.from(b).map(v => +h2f(v).toFixed(3)); } catch (e) { return 'err ' + e.message; } };
    return { n: raster.n, size: [raster.rtFrame.width, raster.rtFrame.height], frame: read(raster.rtFrame), accum: read(raster.rtAccum), accumWindow: read(raster.rtAccum, 0.12, 0.7), accumFloor: read(raster.rtAccum, 0.8, 0.15),
      env: scene.environmentIntensity, sunVis: sun.visible, sunI: sun.intensity, sunPos: sun.position.toArray().map(v => +v.toFixed(2)), skyI: skyLight.intensity, skyVis: skyLight.visible,
      tm: renderer.toneMapping, exp: renderer.toneMappingExposure, outCS: renderer.outputColorSpace };
  });
  console.log(JSON.stringify(out));
  await browser.close();
})();
