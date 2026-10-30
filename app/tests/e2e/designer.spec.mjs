import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app }) => app.open());

test('starts with the default 5 × 5 quilt', async ({ page }) => {
  await expect(page.locator('#dz-cols')).toHaveValue('5');
  await expect(page.locator('#dz-rows')).toHaveValue('5');
  await expect(page.locator('#dz-bmm3')).toHaveValue('458');
});

test('the steppers change columns and rows', async ({ app, page }) => {
  await page.locator('[data-step="c:-1"]').click();
  await page.locator('[data-step="r:-1"]').click();
  const d = await app.current();
  expect([d.cols, d.rows, d.blocks.length]).toEqual([4, 4, 16]);
});

test('clicking a block opens Block parts for it', async ({ app, page }) => {
  const c = await app.blockCentre(await app.current(), 6);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
  await expect(page.locator('#dz-blockname')).toContainText('block 2, 2');
});

test('the hover button turns the block a quarter turn', async ({ app, page }) => {
  const d = await app.current();
  const c = await app.blockCentre(d, 0);
  await page.mouse.move(c.x, c.y);
  const btn = page.locator('#dz-hrot');
  await expect(btn).toBeVisible();
  await btn.click();
  expect((await app.current()).blocks[0].rot).toBe(1);
});

test('kaleidoscope symmetry mirrors a change to all eight partners', async ({ app, page }) => {
  await page.locator('[data-step="c:-1"]').click(); // 4 × 5
  await page.locator('[data-step="r:-1"]').click(); // 4 × 4, square
  let d = await app.current();
  const c = await app.blockCentre(d, 1);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-sym').selectOption('kal');
  await page.locator('#dz-patterns [data-p="twisted"]').click();
  d = await app.current();
  expect(d.sym).toBe('kal');
  const twisted = d.blocks.map((b, i) => (b.pattern === 'twisted' ? i : -1)).filter(i => i >= 0);
  expect(twisted).toEqual([1, 2, 4, 7, 8, 11, 13, 14]);
});

// ---- uniting blocks: drag over a square of blocks, then the Unite button at the selection's top-right corner

/** drags over blocks 0, 1, 5 and 6 (the top-left 2 × 2) and unites them */
async function uniteTopLeft(app, page) {
  await dragSelect(app, page, 0, 6);
  await page.locator('#dz-unite').click();
}

test('a square selection gets a Unite button at its top-right corner; one click makes one large block', async ({
  app,
  page,
}) => {
  await expect(page.locator('#dz-span')).toHaveCount(0); // the old Block size menu is gone
  const before = await app.current();
  await dragSelect(app, page, 0, 6);
  const btn = page.locator('#dz-unite');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('Unite 2 × 2');
  // its round end sits on the selection's top-right corner: block 1's right edge, the top of row 1
  const quilt = await page.locator('#dz-quilt').boundingBox(),
    b1 = await app.blockCentre(before, 1),
    corner = { x: b1.x + b1.w / 2, y: quilt.y + (b1.y - quilt.y) - b1.w / 2 },
    box = await btn.boundingBox();
  expect(Math.abs(box.x + 15 - corner.x)).toBeLessThan(4);
  expect(Math.abs(box.y + box.height / 2 - corner.y)).toBeLessThan(4);
  await btn.click();
  const d = await app.current();
  expect(d.blocks[0].span).toBe(2);
  expect([1, 5, 6].map(i => d.blocks[i].under)).toEqual([0, 0, 0]);
  expect(d.blocks[0].pattern).toBe(before.blocks[0].pattern); // the top-left block's pattern and fabrics
  await expect(page.locator('#dz-side')).toBeVisible(); // Block parts opens on it
  await expect(page.locator('#dz-blockname')).toContainText('block 1, 1');
  await expect(btn).toBeHidden(); // one block selected now
});

test('a selection that is not a square: the button is greyed and says why, and nothing changes', async ({
  app,
  page,
}) => {
  await dragSelect(app, page, 0, 7); // 3 × 2
  const btn = page.locator('#dz-unite');
  await expect(btn).toHaveText('Select a square');
  await expect(btn).toHaveClass(/off/);
  await btn.click();
  await expect(page.locator('#notice')).toContainText('Select a square of blocks');
  expect((await app.current()).blocks.some(b => b.span)).toBe(false);
});

test('hovering a large block shows Split, which gives the blocks back as they were', async ({ app, page }) => {
  const before = await app.current();
  await uniteTopLeft(app, page);
  await page.mouse.click(20, 700); // done with the panel
  const c = await app.blockCentre(before, 0); // inside the large block
  await page.mouse.move(c.x, c.y);
  await page.locator('#dz-hsplit').click();
  const d = await app.current();
  expect(d.blocks.some(b => b.span || b.under != null)).toBe(false);
  expect(d.blocks.map(b => b.pattern)).toEqual(before.blocks.map(b => b.pattern));
});

test('undo after uniting brings the separate blocks back in one step', async ({ app, page }) => {
  await uniteTopLeft(app, page);
  await page.mouse.click(20, 700);
  await page.waitForTimeout(1500); // the timeline makes its step after a short pause
  await page.keyboard.press('Control+z');
  expect((await app.current()).blocks.some(b => b.span)).toBe(false);
});

test('a click on empty space ends the selection, and the Unite button goes with it', async ({ app, page }) => {
  await dragSelect(app, page, 0, 6);
  await expect(page.locator('#dz-unite')).toBeVisible();
  await page.mouse.click(20, 700);
  await expect(page.locator('#dz-unite')).toBeHidden();
});

test('with sashing, the large block covers the strips and cornerstone between its blocks', async ({ app, page }) => {
  await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '50 mm' }).click();
  await page.locator('#rail-sash').click(); // close the card
  await uniteTopLeft(app, page);
  await page.locator('#tabs [data-page="cut"]').click();
  // one large block of 2 × 458 + 50 = 966 mm
  await expect(page.locator('#cg-blocks .cgblock .meta').first()).toContainText('2 × 2 cells (966 mm)');
  // 5 × 5 blocks have 40 strips and 16 cornerstones; inside the large block went 4 strips and 1 cornerstone
  const sash = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: /^Sashing$/ }) });
  await expect(sash.locator('td.n')).toHaveText(['36', '15']);
});

async function dragSelect(app, page, a, b) {
  const d = await app.current();
  const p = await app.blockCentre(d, a),
    q = await app.blockCentre(d, b);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 8 });
  await page.mouse.up();
}

test('after an area selection, a click on empty space ends it and closes Block parts', async ({ app, page }) => {
  const quilt = () => page.locator('#dz-quilt').evaluate(cv => cv.toDataURL());
  const before = await quilt();
  await dragSelect(app, page, 0, 6); // blocks 0, 1, 5 and 6
  await expect(page.locator('#dz-side')).toBeVisible();
  await expect(page.locator('#dz-blockname')).toContainText('editing 4 blocks');
  expect(await quilt(), 'the selected blocks have dotted frames').not.toBe(before);

  await page.mouse.click(20, 700); // empty page space
  await expect(page.locator('#dz-side')).toBeHidden();
  await expect(page.locator('#rail-parts')).toHaveAttribute('aria-pressed', 'false');
  expect(await quilt(), 'no frames left: the quilt looks as it did before the selection').toBe(before);

  // the selection really ended: the next block clicked is edited on its own
  const c = await app.blockCentre(await app.current(), 12);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-blockname')).not.toContainText('editing');
  await page.locator('#dz-patterns [data-p="twisted"]').click();
  const d = await app.current();
  expect(d.blocks.map((b, i) => (b.pattern === 'twisted' ? i : -1)).filter(i => i >= 0)).toEqual([12]);
});

test('a click on a control keeps the area selection and Block parts open', async ({ app, page }) => {
  await dragSelect(app, page, 0, 6);
  await expect(page.locator('#dz-blockname')).toContainText('editing 4 blocks');
  await page.locator('#dz-allparts').click(); // a button in the panel
  await page.locator('#dz-cols').click({ position: { x: 4, y: 12 } }); // a field beside the quilt (not its arrows)
  await expect(page.locator('#dz-side')).toBeVisible();
  await expect(page.locator('#dz-blockname')).toContainText('editing 4 blocks');
});

test('the arrow keys step through the timeline', async ({ app, page }) => {
  await page.locator('[data-step="c:-1"]').click();
  await page.waitForTimeout(1500); // the timeline makes a step after a short pause
  await page.locator('[data-step="c:-1"]').click();
  await page.waitForTimeout(1500);
  expect((await app.current()).cols).toBe(3);
  await page.mouse.click(20, 700);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tl-panel')).toBeVisible();
  await expect.poll(async () => (await app.current()).cols).toBe(4);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await app.current()).cols).toBe(3);
});

test('on point: blocks turn 45°, a block sits between each 2 × 2, triangles fill the edges', async ({ app, page }) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  let d = await app.current();
  expect(d.setting).toBe('onpoint');
  expect(d.blocks.length).toBe(25 + 16);
  const box = await page.locator('#dz-quilt').boundingBox(),
    col = box.width / 5,
    row = box.height / 5;
  // the block between the first four (one column and one row in, where four diamonds meet)
  await page.mouse.click(box.x + col, box.y + row);
  await expect(page.locator('#dz-blockname')).toContainText('block 1½, 1½');
  await expect(page.locator('#dz-sym')).toBeDisabled(); // not on point yet
  await expect(page.locator('#rail-sash')).toBeEnabled(); // sashing works on point
  // a setting triangle on the top edge, between the first two blocks: its own card and fabric
  await page.mouse.click(box.x + col, box.y + 4);
  await expect(page.locator('#set-card')).toBeVisible();
  const fab = page.locator('#set-fabs .fab').nth(2),
    id = await fab.getAttribute('data-f');
  await fab.click();
  expect((await app.current()).settingFabric).toBe(id);
  // straight again: the blocks between go
  await page.locator('#dz-setting').selectOption('straight');
  d = await app.current();
  expect(d.setting).toBeUndefined();
  expect(d.blocks.length).toBe(25);
});

test('on point: sashing frames every block, and the cutting guide lists it', async ({ app, page }) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '50 mm' }).click();
  expect((await app.current()).sashing.mm).toBe(50);
  await expect(page.locator('#sash-border')).toBeChecked(); // always on point
  await expect(page.locator('#sash-border')).toBeDisabled();
  // a click on a strip opens the sashing card: the strip along the first block's top-right edge, framing it
  await page.locator('#rail-sash').click(); // (close the card first)
  const box = await page.locator('#dz-quilt').boundingBox(),
    d = await app.current();
  const q = Math.SQRT2 * (5 * (d.blockMm + 50) + 50), // the quilt's width in mm, on point
    k = box.width / q,
    m = (d.blockMm / 2 + 50) * Math.SQRT2; // edge to the first block's middle
  // halfway along that edge, and a quarter strip out from the block
  const ex = m + (d.blockMm / 2 / Math.SQRT2) * 1 + 25 / Math.SQRT2,
    ey = m - (d.blockMm / 2) * Math.SQRT2 + d.blockMm / 2 / Math.SQRT2 - 25 / Math.SQRT2;
  await page.mouse.click(box.x + ex * k, box.y + ey * k);
  await expect(page.locator('#sash-card')).toBeVisible();
  await page.locator('#tabs [data-page="cut"]').click();
  const sash = page.locator('#cg-blocks .cgblock', { has: page.locator('h3', { hasText: /^Sashing$/ }) });
  await expect(sash.locator('.meta')).toContainText('framing every block');
  await expect(sash.locator('td:nth-child(2)')).toHaveText([/^Sashing strips: /, /^Cornerstones: /]);
  await expect(page.locator('#cg-blocks .cgblock h3', { hasText: 'Setting triangles' })).toBeVisible();
});

test('on point: dragging from one diamond to the one below makes a diamond of 2 × 2; it unites, and Split gives them back', async ({
  app,
  page,
}) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  const d = await app.current();
  // from block 6 (row 2, column 2) to block 11 below it: with the two between them (29, 30), a diamond of 2 × 2
  const a = await app.blockCentre(d, 6),
    b = await app.blockCentre(d, 11);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#dz-unite')).toHaveText('Unite 2 × 2');
  await page.locator('#dz-unite').click();
  let after = await app.current();
  expect(after.blocks[6].span).toBe(2);
  expect([29, 30, 11].map(i => after.blocks[i].under)).toEqual([6, 6, 6]);
  // hover the large diamond: Split
  await page.mouse.click(20, 700);
  const c = await app.blockCentre(after, 6);
  await page.mouse.move(c.x, c.y);
  await page.locator('#dz-hsplit').click();
  after = await app.current();
  expect(after.blocks.some(b => b.span || b.under != null)).toBe(false);
});

test('on point: two diamonds side by side only touch at a corner, so they cannot be united', async ({ app, page }) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  const d = await app.current(),
    a = await app.blockCentre(d, 6),
    b = await app.blockCentre(d, 7);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Shift');
  await expect(page.locator('#dz-unite')).toHaveText('Select a square');
});

test('on point: the selection turns with the blocks, from one diamond to another, whole diamonds only', async ({
  app,
  page,
}) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  const d = await app.current();
  // from block 6 to the block between rows 3 and 4 (33): 2 diamonds one way and 3 the other in the turned grid
  const a = await app.blockCentre(d, 6),
    b = await app.blockCentre(d, 33);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  // while dragging: the box is turned, and says its size upright beside it
  await expect(page.locator('.marquee-tag')).toHaveText('2 × 3 blocks');
  expect(await page.locator('#dz-marquee').evaluate(el => el.style.transform)).toBe('rotate(45deg)');
  await page.mouse.up();
  await expect(page.locator('#dz-blockname')).toContainText('editing 6 blocks');
  await expect(page.locator('.marquee-tag')).toBeHidden();
});

test('on point: a drag that starts on a setting triangle starts from the nearest diamond', async ({ app, page }) => {
  await page.locator('#dz-setting').selectOption('onpoint');
  const d = await app.current(),
    box = await page.locator('#dz-quilt').boundingBox(),
    b = await app.blockCentre(d, 6);
  // on the top edge between the first two blocks: a setting triangle; the nearest diamond is block 0 or 1
  await page.mouse.move(box.x + box.width / 5, box.y + 3);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#dz-blockname')).toContainText(/editing \d+ blocks/);
});
