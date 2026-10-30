// Many fabric photos: the short lists stay short, and the fabric library behind their "More fabrics" tile
// finds a photo by name and gives it to the list it was opened from.
import { test, expect } from './fixtures.mjs';

/** Stores n small photos of different colours, "Test photo 01" to n, then reloads so the app reads them. */
async function addPhotos(app, page, n) {
  await app.open();
  await app.storage(async (s, count) => {
    for (let i = 1; i <= count; i++) {
      const c = new OffscreenCanvas(32, 32),
        g = c.getContext('2d');
      g.fillStyle = `hsl(${i * 37} 60% 50%)`;
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, i % 32, 4); // every picture different, so every photo its own fabric
      await s.fabrics.add(await c.convertToBlob(), { name: `Test photo ${String(i).padStart(2, '0')}`, cm: 10 });
    }
  }, n);
  await page.reload();
  await app.open();
}
const photoId = (app, name) => app.storage((s, nm) => s.fabrics.list().find(f => f.name === nm).id, name);

test('the short list: the basics, a few photos, and a button for the rest', async ({ app, page }) => {
  await addPhotos(app, page, 70);
  // the 5 newest photos fill in; "More fabrics" is a round button outside the row
  await expect(page.locator('#dz-fabrics2 > *')).toHaveCount(15 + 5);
  await page.locator('#rail-parts').click(); // the Block parts card, where this list is
  await page.locator('#dz-fabrics2').hover(); // the round button appears beside the card
  await expect(page.locator('#fab-more-float')).toHaveAttribute('aria-label', 'More fabrics (65)');
});

test('the library finds a photo by name and puts it on the selected parts', async ({ app, page }) => {
  await addPhotos(app, page, 70);
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-block').click(); // the centre part
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  const lib = page.locator('#fablib');
  await expect(lib).toBeVisible();
  // 60 at a time, after the "Add fabric photo" tile
  await expect(lib.locator('#fablib-grid > *')).toHaveCount(1 + 60);
  await lib.locator('#fablib-more').click();
  await expect(lib.locator('#fablib-grid > *')).toHaveCount(1 + 85);
  await lib.locator('#fablib-groups button', { hasText: 'Basics' }).click();
  await expect(lib.locator('#fablib-grid .fab')).toHaveCount(15);
  await lib.locator('#fablib-groups button', { hasText: 'All' }).click();
  await lib.locator('#fablib-q').fill('photo 07');
  await expect(lib.locator('#fablib-grid button.fab')).toHaveText(['Test photo 07']);
  await lib.locator('#fablib-grid button.fab').click();
  await expect(lib).toBeHidden();
  const id = await photoId(app, 'Test photo 07');
  const b = (await app.current()).blocks[0];
  expect(b.fabrics.filter(f => f === id)).toHaveLength(1); // the centre part
  // now in the quilt and recently picked: in the short list, chosen
  await expect(page.locator('#dz-fabrics2 .fab[aria-pressed="true"]')).toHaveText('Test photo 07');
});

test('the library also serves the other fabric choices (sashing here)', async ({ app, page }) => {
  await addPhotos(app, page, 12);
  await page.locator('#rail-sash').click();
  await page.locator('#sash-fabs').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#fablib-q').fill('photo 03');
  await page.locator('#fablib-grid button.fab').click();
  expect((await app.current()).sashing.fabric).toBe(await photoId(app, 'Test photo 03'));
  expect((await app.current()).sashing.mm).toBe(50); // choosing a fabric first gives the sashing a width
});

test('a search with no match says so', async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-parts').click();
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#fablib-q').fill('velvet');
  await expect(page.locator('#fablib-none')).toHaveText('No fabrics match “velvet”.');
  await page.keyboard.press('Escape'); // in a search box, the first Escape clears it
  await page.keyboard.press('Escape');
  await expect(page.locator('#fablib')).toBeHidden();
});
