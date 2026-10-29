const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +process.argv[2], height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync('/home/claude/quilt/cutguide_preview.html', 'utf8') + '</body></html>');
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[3], fullPage: true });
  console.log('errors', errs, 'scrollW', await p.evaluate(() => document.documentElement.scrollWidth));
  console.log(await p.evaluate(() => document.querySelector('#fabrics').innerText));
  await b.close();
})();
