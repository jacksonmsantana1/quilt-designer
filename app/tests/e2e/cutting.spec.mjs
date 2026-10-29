import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '50 mm' }).click();
  await page.locator('#rail-brd').click();
  await page.locator('.brd-type[data-t="plain"]').click();
  await page.locator('.brd-type[data-t="piano"]').click();
  await page.locator('#tabs [data-page="cut"]').click();
  await expect(page.locator('#cg-blocks .cgblock').first()).toBeVisible();
});

test('one card per distinct block, the sashing and each border', async ({ page }) => {
  await expect(page.locator('#cg-blocks .cgblock h3')).toHaveText([
    /Block 1/,
    /Block 2/,
    /Sashing/,
    /Border 1/,
    /Border 2/,
  ]);
});

test('piece IDs: blocks, sashing (S) and borders (B + number)', async ({ page }) => {
  await expect(page.locator('#cg-blocks .cgblock').nth(2).locator('td.l')).toHaveText(['AS.1', 'BS.2']);
  await expect(page.locator('#cg-blocks .cgblock').nth(3).locator('td.l')).toHaveText([/^[A-Z]B1\.1$/]);
});

test('a click opens and closes a cutting list', async ({ page }) => {
  const card = page.locator('#cg-blocks .cgblock').first();
  await card.locator('canvas').click();
  await expect(card).toHaveClass(/open/);
  await card.locator('canvas').click();
  await expect(card).not.toHaveClass(/open/);
});

test('a double-click shows the block in the whole quilt', async ({ page }) => {
  await page.locator('#cg-blocks .cgblock').nth(3).locator('canvas').dblclick();
  await expect(page.locator('#cg-pop')).toBeVisible();
  await expect(page.locator('#cg-pop-title')).toHaveText('Border 1');
});

test('hovering a cutting-list line marks it', async ({ page }) => {
  const card = page.locator('#cg-blocks .cgblock').first();
  await card.locator('canvas').click();
  // the list slides open and the page scrolls to it: wait until both have finished
  await expect(card.locator('.cg-list')).toHaveCSS('max-height', 'none');
  await expect
    .poll(async () => {
      const a = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(150);
      return a === (await page.evaluate(() => window.scrollY));
    })
    .toBe(true);
  const row = card.locator('tbody tr').nth(1);
  await row.hover();
  await expect(row).toHaveClass(/cut-on/);
});

test('the PDF has the fabrics, the whole quilt, the blocks, the sashing and each border', async ({ page }) => {
  await page.locator('#cg-pdf').click();
  await page.waitForFunction(() => window.__lastCutPdf, null, { timeout: 80_000 });
  const info = await page.evaluate(async () => {
    const t = new TextDecoder('latin1').decode(new Uint8Array(await window.__lastCutPdf.arrayBuffer()));
    return { head: t.slice(0, 8), pages: +(t.match(/\/Type \/Pages \/Count (\d+)/) || [])[1] };
  });
  expect(info.head).toBe('%PDF-1.4');
  expect(info.pages).toBeGreaterThanOrEqual(2 + 2 + 1 + 2);
});
