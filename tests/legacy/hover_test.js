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
  await page.waitForTimeout(600);
  await page.fill('#dz-bmm2', '450'); await page.press('#dz-bmm2', 'Enter'); await page.waitForTimeout(700); await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); }); await page.waitForTimeout(200);
  const q = await page.locator('#dz-quilt').boundingBox();
  const bw = q.width / 5; console.log('q', JSON.stringify(q));
  // block (row 1, col 2): move across it quickly -> block highlight
  await page.mouse.move(q.x + bw * 1.2, q.y + bw * 0.5); await page.mouse.move(q.x + bw * 1.15, q.y + bw * 0.2, { steps: 3 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/home/claude/quilt/hv_block.png', clip: { x: q.x, y: q.y, width: bw * 3, height: bw * 1.4 } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/claude/quilt/hv_part.png', clip: { x: q.x, y: q.y - 10, width: bw * 3, height: bw * 1.4 } });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks.map(b => b.fabrics.join(',')));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(200);
  console.log('part dialog:', await page.evaluate(() => document.getElementById('dz-partdlg').open), '| block dialog:', await page.evaluate(() => document.getElementById('dz-dialog').open), '|', await page.textContent('#dz-partdlg-sub'), '|', await page.textContent('#dz-partall-txt'));
  await page.screenshot({ path: '/home/claude/quilt/hv_dialog.png' });
  await page.locator('#dz-partfabs .fab').nth(6).click(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks.map(b => b.fabrics.join(',')));
  const changed = after.map((a, i) => a !== before[i] ? i : -1).filter(i => i >= 0);
  console.log('blocks changed:', changed.join(','), '| diff in block:', changed.length ? after[changed[0]].split(',').map((f, k) => f !== before[changed[0]].split(',')[k] ? k + ':' + f : '').filter(Boolean).join(' ') : '');
  await page.check('#dz-partall'); await page.locator('#dz-partfabs .fab').nth(2).click(); await page.waitForTimeout(400);
  const after2 = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-designer.v1')).blocks.map(b => b.fabrics.join(',')));
  console.log('with "all like this":', after2.map((a, i) => a !== after[i] ? i : -1).filter(i => i >= 0).length, 'blocks changed');
  await page.click('#dz-partdone'); await page.waitForTimeout(200);
  // quick click (no dwell) still opens the block editor
  await page.mouse.move(q.x + bw * 3.5, q.y + bw * 3.5); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
  console.log('quick click -> block dialog:', await page.evaluate(() => document.getElementById('dz-dialog').open), '| part dialog:', await page.evaluate(() => document.getElementById('dz-partdlg').open));
  console.log('errors', errs);
  await browser.close();
})();
