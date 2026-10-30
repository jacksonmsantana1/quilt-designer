import { test, expect } from './fixtures.mjs';
import { newBlock } from '@quilt/shared/design.js';

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

test('without cornerstones: long strips between the rows, and no cornerstones to cut', async ({ app, page }) => {
  const sashPanel = async () => {
    await page.locator('#tabs [data-page="design"]').click();
    if (!(await page.locator('#sash-card').isVisible())) await page.locator('#rail-sash').click();
  };
  await sashPanel();
  await expect(page.locator('#sash-cs')).toBeChecked();
  await expect(page.locator('#sash-cs-box')).toBeVisible();
  await page.locator('#sash-cs').uncheck();
  await expect(page.locator('#sash-cs-box')).toBeHidden(); // no cornerstone fabric to choose
  expect((await app.current()).sashing.cornerstones).toBe(false);

  await page.locator('#tabs [data-page="cut"]').click();
  const sash = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: 'Sashing' }) });
  // 5 × 5 blocks of 458 mm: short strips between the blocks; the 4 rows of sashing between them are 2490 mm
  // long (2505 cut), wider than the fabric, so they are cut across its width (65 mm cut) and joined
  await expect(sash.locator('td:nth-child(2)')).toHaveText([
    /^Sashing strips: /,
    'Long sashing strips: 7 strips 65 mm × WOF, joined and cut to 2505 + 2505 + 2505 + 2505 mm',
  ]);
  await expect(sash).not.toContainText('Cornerstones');

  await sashPanel();
  await page.locator('#sash-cs').check();
  await expect(page.locator('#sash-cs-box')).toBeVisible();
  expect((await app.current()).sashing.cornerstones).toBe(true);
});

test('cornerstones pieced as a block: only on sashing over 75 mm, parts in their own fabrics, cut like a block', async ({
  app,
  page,
}) => {
  const sashPanel = async () => {
    await page.locator('#tabs [data-page="design"]').click();
    if (!(await page.locator('#sash-card').isVisible())) await page.locator('#rail-sash').click();
  };
  const nine = page.locator('#sash-cpats button[data-p="nine"]');
  await sashPanel();
  await expect(nine).toBeDisabled(); // 50 mm: too narrow to sew a block
  await expect(page.locator('#sash-cb-note')).toContainText('wider than 75 mm');

  await page.locator('#sash-presets button', { hasText: '76 mm' }).click();
  await expect(nine).toBeEnabled();
  await nine.click();
  await expect(page.locator('#sash-cb-edit')).toBeVisible();
  expect((await app.current()).sashing.cornerBlock.pattern).toBe('nine');
  // the centre square of the nine-patch gets a fabric of its own; the other parts keep theirs
  await page.locator('#sash-cb').click();
  await expect(page.locator('#sash-cb-info')).toContainText('Selected:');
  await expect(page.locator('#sash-corner-lbl')).toHaveText('Fabric for the selected parts');
  await page.locator('#sash-corner .fab[data-f="b2"]').click();
  const fabrics = (await app.current()).sashing.cornerBlock.fabrics;
  expect(fabrics[4]).toBe('b2');
  expect(fabrics.filter(f => f === 'b2')).toHaveLength(1);

  // the cutting guide: a card of its own, one block per cornerstone (4 × 4 crossings), and no plain squares
  await page.locator('#tabs [data-page="cut"]').click();
  const card = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: 'Cornerstone block' }) });
  await expect(card.locator('.meta')).toContainText('Cornerstone · Nine patch · 76 mm · make 16');
  const sash = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: 'Sashing' }) });
  await expect(sash).not.toContainText('Cornerstones');

  // narrower again: plain cornerstones, but the block is still saved for later
  await sashPanel();
  await page.locator('#sash-presets button', { hasText: '50 mm' }).click();
  await expect(page.locator('#sash-cb-edit')).toBeHidden();
  await expect(page.locator('#sash-cb-note')).toContainText('plain ones until then');
  expect((await app.current()).sashing.cornerBlock.pattern).toBe('nine');
  await page.locator('#tabs [data-page="cut"]').click();
  await expect(page.locator('#cg-blocks h3', { hasText: 'Cornerstone block' })).toHaveCount(0);
  await expect(sash).toContainText('Cornerstones');
});

test('a cornerstone pattern starts in the colours of its button, whatever the last block had', async ({
  app,
  page,
}) => {
  await page.locator('#tabs [data-page="design"]').click();
  if (!(await page.locator('#sash-card').isVisible())) await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '76 mm' }).click();
  await page.locator('#sash-cpats button[data-p="four"]').click();
  await page.locator('#sash-corner .fab[data-f="b2"]').click(); // nothing selected: every part in one fabric
  expect(new Set((await app.current()).sashing.cornerBlock.fabrics)).toEqual(new Set(['b2']));
  await page.locator('#sash-cpats button[data-p="ohio"]').click();
  expect((await app.current()).sashing.cornerBlock.fabrics).toEqual(newBlock('ohio').fabrics); // cream, indigo, mustard
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

test('on point: a card for the setting triangles, cut from squares like quarter- and half-square triangles', async ({
  page,
}) => {
  await page.locator('#tabs [data-page="design"]').click();
  await page.locator('#dz-setting').selectOption('onpoint');
  await page.locator('#tabs [data-page="cut"]').click();
  // no sashing on point (yet); the borders stay
  await expect(page.locator('#cg-blocks .cgblock h3')).toHaveText([
    /Block 1/,
    /Block 2/,
    /Block 3/,
    /Setting triangles/,
    /Border 1/,
    /Border 2/,
  ]);
  const card = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: 'Setting triangles' }) });
  await expect(card.locator('td.l')).toHaveText([/^[A-Z]T\.1$/, /^[A-Z]T\.2$/]);
  // 5 × 5 blocks of 458 mm: 16 side triangles from 4 squares (the block diagonal 648 mm + seams), 4 corners from 2
  await expect(card.locator('tbody tr').nth(0).locator('td')).toHaveText([
    /T\.1/,
    'Side triangles: square 684 mm, cut twice on the diagonals ⊠',
    '4',
    '16',
  ]);
  await expect(card.locator('tbody tr').nth(1).locator('td')).toHaveText([
    /T\.2/,
    'Corner triangles: square 350 mm, cut once on the diagonal ◩',
    '2',
    '4',
  ]);
  await card.locator('canvas').click();
  await expect(card.locator('.cg-list')).toHaveCSS('max-height', 'none');
  const row = card.locator('tbody tr').first();
  await row.hover();
  await expect(row).toHaveClass(/cut-on/);
  await page.mouse.move(5, 5);
  await card.locator('canvas').dblclick();
  await expect(page.locator('#cg-pop-title')).toHaveText('Setting triangles');
});
