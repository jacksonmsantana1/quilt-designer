// More of the designer: choosing a part by resting the mouse on it, flipping several
// blocks, the hover over sashing and borders, and the part-selection buttons.
import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app }) => app.open());

async function openBlock(app, page, i) {
  const c = await app.blockCentre(await app.current(), i);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
}

test('resting the mouse on a part lights it; a click then edits just that part', async ({ app, page }) => {
  const d = await app.current(),
    c = await app.blockCentre(d, 0);
  await page.mouse.move(c.x - 3, c.y - 3);
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(900); // longer than the dwell time
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
  await page.locator('#dz-fabrics2 .fab', { hasText: 'Rose cotton' }).click();
  const b = (await app.current()).blocks[0],
    was = d.blocks[0].fabrics;
  const changed = b.fabrics.filter((f, i) => f !== was[i]);
  expect(changed).toEqual(['b8']); // only the centre square
});

test('the part buttons: all, same fabric, clear', async ({ app, page }) => {
  await openBlock(app, page, 0);
  const n = (await app.current()).blocks[0].fabrics.length;
  await page.locator('#dz-allparts').click();
  await page.locator('#dz-fabrics2 .fab', { hasText: 'Rose cotton' }).click();
  expect((await app.current()).blocks[0].fabrics).toEqual(Array(n).fill('b8'));
  await page.locator('#dz-noparts').click();
  await expect(page.locator('#dz-parts-info')).not.toContainText(/^\d+ parts? selected/);
  await page.locator('#dz-sameparts').click();
});

test('the hover flip button flips every selected block', async ({ app, page }) => {
  const d = await app.current();
  let a = await app.blockCentre(d, 0);
  await page.mouse.click(a.x, a.y);
  await expect(page.locator('#dz-side')).toBeVisible();
  await page.waitForTimeout(400); // the side panel opening moves the quilt
  a = await app.blockCentre(d, 0);
  const b = await app.blockCentre(d, 2);
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Shift');
  await page.mouse.move(a.x, a.y);
  await page.locator('#dz-hflip').click();
  const after = await app.current();
  expect([after.blocks[0].flip, after.blocks[2].flip, after.blocks[1].flip]).toEqual([true, true, undefined]);
});

test('hovering the sashing and the borders lights them up without errors', async ({ app, page }) => {
  await page.locator('#rail-sash').click();
  await page.locator('#sash-mm').fill('60');
  await page.locator('#sash-mm').dispatchEvent('change');
  await page.locator('#rail-brd').click();
  await page.locator('#brd-types .brd-type').first().click();
  await expect.poll(async () => (await app.current()).borders?.length).toBe(1);
  const box = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.move(box.x + 6, box.y + box.height / 2); // the border
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); // a block or the sashing
  const d = await app.current(),
    r = await app.blockCentre(d, 0);
  await page.mouse.move(r.x + r.w / 2 + 2, r.y); // just right of the first block: the sashing
  await page.mouse.move(box.x - 20, box.y - 20); // off the quilt
});
