// Every kind of edit, with the design frozen (fixtures.mjs): code that changed the design in place would throw.
import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app }) => app.open());

async function openBlock(app, page, i) {
  const c = await app.blockCentre(await app.current(), i);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
}

test('a part gets a fabric', async ({ app, page }) => {
  await openBlock(app, page, 0);
  const box = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); // the centre square of the Ohio star
  await page.locator('#dz-fabrics2 .fab', { hasText: 'Rose cotton' }).click();
  const d = await app.current();
  expect(d.blocks[0].fabrics).toContain('b8');
});

test('a fussy cut on a printed fabric', async ({ app, page }) => {
  await openBlock(app, page, 0);
  const box = await page.locator('#dz-block').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.locator('#dz-fabrics2 .fab', { hasText: 'Floral print' }).click();
  await expect(page.locator('#dz-fussy')).toBeVisible();
  await page.locator('#dz-fussy-cv').click({ position: { x: 40, y: 50 } });
  expect(Object.keys((await app.current()).blocks[0].fussy || {})).toHaveLength(1);
  await page.locator('#dz-fussy-clear').click();
  expect((await app.current()).blocks[0].fussy).toBeUndefined();
});

test('copying a block from the library', async ({ app, page }) => {
  await openBlock(app, page, 0);
  await page.locator('#dz-library button').nth(1).click(); // the nine-patch
  expect((await app.current()).blocks[0].pattern).toBe('nine');
});

test('mirror button on hover', async ({ app, page }) => {
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.move(c.x, c.y);
  await page.locator('#dz-hflip').click();
  expect((await app.current()).blocks[0].flip).toBe(true);
});

test('quilting pattern', async ({ app, page }) => {
  await page.locator('#dz-quilting').selectOption('fans');
  expect((await app.current()).quilting).toBe('fans');
});

test('block size in mm', async ({ app, page }) => {
  await page.locator('#dz-bmm3').fill('300');
  await page.locator('#dz-bmm3').press('Enter');
  expect((await app.current()).blockMm).toBe(300);
});

test('sashing fabric and cornerstones', async ({ app, page }) => {
  await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '38 mm' }).click();
  await page.locator('#sash-fabs .fab', { hasText: 'Sage cotton' }).click();
  await page.locator('#sash-corner .fab', { hasText: 'Red linen' }).click();
  expect((await app.current()).sashing).toMatchObject({ mm: 38, fabric: 'b5', corner: 'b4' });
});

test('a border colour', async ({ app, page }) => {
  await page.locator('#rail-brd').click();
  await page.locator('.brd-type[data-t="piano"]').click();
  await page.locator('.brd-slot').first().click();
  await page.locator('#brd-pal .fab', { hasText: 'Mint cotton' }).click();
  expect((await app.current()).borders[0].fabrics[0]).toBe('b9');
});

test('backing fabric when the quilt is turned over', async ({ app, page }) => {
  await page.locator('#dz-flip').click();
  await page.locator('#dz-backfabs .fab', { hasText: 'Indigo cotton' }).click();
  expect((await app.current()).backFabric).toBe('b1');
});

test('new design and undo', async ({ app, page }) => {
  await page.locator('[data-step="c:-1"]').click();
  await page.waitForTimeout(1500);
  await page.locator('#dz-new').click();
  expect((await app.current()).cols).toBe(5);
});
