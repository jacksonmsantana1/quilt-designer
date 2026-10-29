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

test('a block can be made 2 × 2', async ({ app, page }) => {
  let d = await app.current();
  const c = await app.blockCentre(d, 6);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-span').selectOption('2');
  d = await app.current();
  expect(d.blocks[6].span).toBe(2);
  expect([7, 11, 12].map(i => d.blocks[i].under)).toEqual([6, 6, 6]);
});

test('the round buttons open each side panel, and ✕ cancels the changes', async ({ app, page }) => {
  await page.locator('#rail-sash').click();
  await expect(page.locator('#sash-card')).toBeVisible();
  await page.locator('#sash-presets button', { hasText: '50 mm' }).click();
  expect((await app.current()).sashing.mm).toBe(50);
  await page.locator('#sash-card .card-cancel').click();
  await expect(page.locator('#dz-side')).toBeHidden();
  expect((await app.current()).sashing).toBeFalsy();
});

test('a double-click on empty space closes the side panel', async ({ page }) => {
  await page.locator('#rail-brd').click();
  await expect(page.locator('#dz-side')).toBeVisible();
  await page.mouse.dblclick(20, 700);
  await expect(page.locator('#dz-side')).toBeHidden();
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
