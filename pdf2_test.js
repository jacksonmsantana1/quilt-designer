const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = '/tmp/claude-0/-home-claude/cb9526ed-9012-5cf4-ac72-246e7bebad80/scratchpad/npm/node_modules';
const MAP = [[/three@0\.183\.2\/(.*)$/, 'three'], [/three-mesh-bvh@0\.9\.14\/(.*)$/, 'three-mesh-bvh'], [/three-gpu-pathtracer@0\.0\.24\/(.*)$/, 'three-gpu-pathtracer']];
(async () => {
  const browser = await chromium.launch();
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/quilt.html', 'utf8') + '</body></html>';
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } }); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('quilt-tour.v1', 'done');
  } catch (e) {} });
  await page.route('**/*', r => {
    const u = r.request().url();
    for (const [re, pkg] of MAP) { const m = u.match(re); if (m) return r.fulfill({ path: path.join(NM, pkg, m[1]), contentType: 'text/javascript' }); }
    if (u.startsWith('https://fonts.')) return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.startsWith('http://x/assets/')) return r.fulfill({ path: '/home/claude/quilt/' + u.slice(9).split('#')[0] });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort();
  });
  await page.goto('http://x/#design'); await page.waitForTimeout(2500);
  await page.click('#rail-sash'); await page.click('#sash-presets button:text("50 mm")'); await page.waitForTimeout(400);
  await page.click('#rail-brd'); await page.click('.brd-type[data-t="plain"]'); await page.waitForTimeout(400); await page.click('.brd-type[data-t="piano"]'); await page.waitForTimeout(400);
  await page.click('#tabs [data-page="cut"]');
  await page.waitForTimeout(2500);
  await page.waitForTimeout(1500);
  page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); }); await page.click('#cg-pdf'); for (let q = 0; q < 8; q++) { await page.waitForTimeout(700); console.log('stat', await page.textContent('#cg-pdfstat')); }
  await page.waitForFunction(() => window.__lastCutPdf, null, { timeout: 120000 });
  const b64 = await page.evaluate(async () => { const b = window.__lastCutPdf; const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return btoa(s); });
  require('fs').writeFileSync('/home/claude/quilt/out_test.pdf', Buffer.from(b64, 'base64'));
  console.log('pdf bytes', Buffer.from(b64, 'base64').length);
  console.log('errors', errs); await browser.close(); })();
