// Files the app makes: the real-size templates in the cutting-guide PDF, and pictures of the 3D view (an
// ordinary download, or through the viewer's downloads capability when the page runs inside Claude).
import { test, expect } from './fixtures.mjs';

/** a quilt whose blocks have pieces that need a paper template: small ones packed on a sheet, big ones tiled */
const templateQuilt = mm => ({
  v: 1,
  cols: 2,
  rows: 1,
  blockMm: mm,
  backFabric: 'b0',
  blocks: ['twisted', 'totem'].map(pattern => ({ pattern, rot: 0, fabrics: Array(14).fill('b1') })),
});
async function pdfPages(app, page, design) {
  await page.addInitScript(d => localStorage.setItem('quilt-designer.v1', JSON.stringify(d)), design);
  await app.open('cut');
  await page.locator('#cg-pdf').click();
  await page.waitForFunction(() => window.__lastCutPdf, null, { timeout: 80_000 });
  return page.evaluate(async () => {
    const t = new TextDecoder('latin1').decode(new Uint8Array(await window.__lastCutPdf.arrayBuffer()));
    return +(t.match(/\/Type \/Pages \/Count (\d+)/) || [])[1];
  });
}

test('the PDF has template pages for shapes that are not squares or right triangles', async ({ app, page }) => {
  test.slow();
  // fabrics page + quilt page + one page per block = 4 without templates
  const pages = await pdfPages(app, page, templateQuilt(150));
  expect(pages).toBeGreaterThan(4);
});

test('big template shapes are split over several sheets', async ({ app, page }) => {
  test.slow();
  // a 900 mm block: its biggest pieces are larger than a sheet, so each one takes several pages
  expect(await pdfPages(app, page, templateQuilt(900))).toBeGreaterThan(4 + 2);
});

async function openSim(app, page) {
  await app.open();
  await page.locator('#dz-sim').click({ timeout: 60_000 });
  await expect(page.locator('#page-sim')).toBeVisible();
}

test('Take picture downloads a PNG of the 3D view', async ({ app, page }) => {
  test.slow();
  await openSim(app, page);
  // the 3D view keeps the page busy in software WebGL: a real click waits for a quiet moment that may not come,
  // so the button's click is sent directly
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('#saveimg3').dispatchEvent('click'),
  ]);
  expect(dl.suggestedFilename()).toMatch(/^quilt-preview-\d+x\d+-\d{4}-\d\d-\d\d_\d{4}\.png$/);
  const buf = await (await dl.createReadStream()).toArray();
  expect(Buffer.concat(buf).subarray(1, 4).toString()).toBe('PNG');
  await expect(page.locator('#savestat3')).toHaveText('Picture saved');
});

test('inside Claude, pictures go through the downloads capability', async ({ app, page }) => {
  test.slow();
  await page.addInitScript(() => {
    window.__saves = [];
    window.claude = {
      use: async name =>
        name === 'downloads' && {
          save: async ({ filename, data }) => {
            window.__saves.push({ filename, size: data.size });
            if (window.__decline) throw Object.assign(new Error('no'), { code: 'declined' });
            return { status: 'delivered' };
          },
        },
    };
  });
  await openSim(app, page);
  await page.locator('#saveimg3').dispatchEvent('click');
  await expect(page.locator('#savestat3')).toHaveText('Picture sent', { timeout: 60_000 });
  const saves = await page.evaluate(() => window.__saves);
  expect(saves).toHaveLength(1);
  expect(saves[0].size).toBeGreaterThan(1000);
  await page.evaluate(() => (window.__decline = true));
  await page.locator('#saveimg3').dispatchEvent('click');
  await expect(page.locator('#savestat3')).toHaveText('Not saved', { timeout: 60_000 });
});
