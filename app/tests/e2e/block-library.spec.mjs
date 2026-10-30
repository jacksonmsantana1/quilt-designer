// The block library: the list under "Block pattern" keeps the app's first blocks, and a "More blocks" tile opens a
// library with every block, searchable by name or family.
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
  await page.locator('#dz-patterns .pat-more').click();
  const lib = page.locator('#blklib');
  await expect(lib).toBeVisible();
  await lib.locator('#blklib-q').fill('bear');
  await expect(lib.locator('#blklib-grid .pat')).toHaveText(["Bear's paw"]);
  await lib.locator('#blklib-grid .pat').click();
  await expect(lib).toBeHidden();
  expect((await app.current()).blocks[0].pattern).toBe('bearspaw');
  await expect(page.locator('#dz-patterns .pat[aria-pressed="true"]')).toHaveText("Bear's paw");
});

test('the library groups blocks by family', async ({ app, page }) => {
  await openBlock(app, page, 0);
  await page.locator('#dz-patterns .pat-more').click();
  await page.locator('#blklib-groups button', { hasText: 'Stars' }).click();
  await expect(page.locator('#blklib-grid .pat', { hasText: 'Rising star' })).toHaveCount(1);
  await expect(page.locator('#blklib-grid .pat', { hasText: 'Nine patch' })).toHaveCount(0);
  await page.locator('#blklib-q').fill('velvet');
  await expect(page.locator('#blklib-none')).toHaveText('No blocks match “velvet”.');
});
