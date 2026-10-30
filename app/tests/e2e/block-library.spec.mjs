// The block library: the list under "Block pattern" (one row that scrolls sideways) keeps the app's first blocks, and
// a round "+" button beside it opens a library with every block, searchable by name or family.
import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app }) => app.open());

async function openBlock(app, page, i) {
  const c = await app.blockCentre(await app.current(), i);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
}

test('a block from the library goes on the selected block and joins the list', async ({ app, page }) => {
  await openBlock(app, page, 0);
  await expect(page.locator('#dz-patterns [data-p="bearspaw"]')).toHaveCount(0); // not in the list yet
  await page.locator('#dz-patterns').hover(); // the round button appears beside the card
  await page.locator('#fab-more-float').click();
  const lib = page.locator('#blklib');
  await expect(lib).toBeVisible();
  await lib.locator('#blklib-q').fill('bear');
  await expect(lib.locator('#blklib-grid .pat')).toHaveText(["Bear's paw"]);
  await lib.locator('#blklib-grid .pat').click();
  await expect(lib).toBeHidden();
  expect((await app.current()).blocks[0].pattern).toBe('bearspaw');
  await expect(page.locator('#dz-patterns .pat[aria-pressed="true"]')).toHaveText("Bear's paw");
});

test('Block pattern is one row that scrolls sideways, with the round button for the rest', async ({ app, page }) => {
  await openBlock(app, page, 0);
  const row = page.locator('#dz-patterns');
  const tops = await row.locator('.pat').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1); // all on one line
  expect(await row.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
  await row.hover();
  await expect(page.locator('#fab-more-float')).toHaveAttribute('aria-label', /^More blocks \(\d+\)$/);
});

test('the library groups blocks by family', async ({ app, page }) => {
  await openBlock(app, page, 0);
  await page.locator('#dz-patterns').hover(); // the round button appears beside the card
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-groups button', { hasText: 'Stars' }).click();
  await expect(page.locator('#blklib-grid .pat', { hasText: 'Rising star' })).toHaveCount(1);
  await expect(page.locator('#blklib-grid .pat', { hasText: 'Nine patch' })).toHaveCount(0);
  await page.locator('#blklib-q').fill('velvet');
  await expect(page.locator('#blklib-none')).toHaveText('No blocks match “velvet”.');
});
