// Many fabric photos: the short lists stay short, and the fabric library behind their "More fabrics" tile
// finds a photo by name and gives it to the list it was opened from.
import fs from 'fs';
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
  // "+ Add fabric", then the 5 newest photos fill in; "More fabrics" is a round button outside the row
  await expect(page.locator('#dz-fabrics2 > *')).toHaveCount(15 + 5 + 1);
  await page.locator('#rail-parts').click(); // the Block parts card, where this list is
  await page.locator('#dz-fabrics2').hover(); // the round button appears beside the card
  await expect(page.locator('#fab-more-float')).toHaveAttribute('aria-label', 'More fabrics (1565)'); // 65 photos, 1500 in the collection
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
  // 60 at a time, after the "Add fabric photo" tile: the basics, then the photos (the collection after them)
  await expect(lib.locator('#fablib-grid > *')).toHaveCount(1 + 60);
  await lib.locator('#fablib-more').click();
  await expect(lib.locator('#fablib-grid > *')).toHaveCount(1 + 120);
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

const picture = name => ({
  name,
  mimeType: 'image/jpeg',
  buffer: fs.readFileSync(new URL('../../assets/fabric/paisley.jpg', import.meta.url)),
});

test('+ Add fabric: a photo from this computer, with its name and width, joins the lists', async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-parts').click();
  const row = page.locator('#dz-fabrics2'),
    dlg = page.locator('#addfab');
  const picked = page.waitForEvent('filechooser');
  await row.locator('.fab-add').click();
  await (await picked).setFiles(picture('Grandma paisley scan.jpg'));
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('#addfab-pics img')).toHaveCount(1);
  await expect(dlg.locator('#addfab-name')).toHaveValue('Grandma paisley scan');
  await dlg.locator('#addfab-name').fill('Grandma paisley');
  await dlg.locator('#dz-cm').fill('40');
  await expect(dlg.locator('#dz-cm-o')).toContainText('40');
  await expect(dlg.locator('#addfab-ok')).toHaveText('Add 1 fabric');
  await expect(row.locator('> *').first()).toHaveClass(/fab-add/); // first in the row
  await dlg.locator('#addfab-ok').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#notice')).toContainText('1 photo added');
  await expect(row.locator('.fab', { hasText: 'Grandma paisley' })).toBeVisible();
  expect(await app.storage(s => s.fabrics.list().map(f => [f.name, f.cm]))).toEqual([['Grandma paisley', 40]]);
  // nothing in the quilt changed, and the width is remembered for next time
  expect((await app.current()).blocks.flatMap(b => b.fabrics).some(f => f.startsWith('f') || f.startsWith('h'))).toBe(
    false,
  );
  await page.reload();
  await page.locator('#rail-parts').click();
  await expect(row.locator('.fab', { hasText: 'Grandma paisley' })).toHaveCount(1);
  expect(await page.locator('#dz-cm').inputValue()).toBe('40');
});

test('+ Add fabric: from inside the library, several at once, and Cancel adds nothing', async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-parts').click();
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  const lib = page.locator('#fablib'),
    dlg = page.locator('#addfab');
  await expect(lib).toBeVisible();
  // Cancel
  let picked = page.waitForEvent('filechooser');
  await lib.locator('.fab-add').click();
  await (await picked).setFiles(picture('Not this one.jpg'));
  await dlg.locator('#addfab-cancel').click();
  await expect(dlg).toBeHidden();
  await expect(lib).toBeVisible();
  expect(await app.storage(s => s.fabrics.list().length)).toBe(0);
  // two pictures: no name box, each keeps its file's name
  picked = page.waitForEvent('filechooser');
  await lib.locator('.fab-add').click();
  await (
    await picked
  ).setFiles([
    picture('First.jpg'),
    {
      name: 'Second.jpg',
      mimeType: 'image/jpeg',
      buffer: fs.readFileSync(new URL('../../assets/fabric/linen.jpg', import.meta.url)),
    },
  ]);
  await expect(dlg.locator('#addfab-name')).toBeHidden();
  await expect(dlg.locator('#addfab-ok')).toHaveText('Add 2 fabrics');
  await dlg.locator('#addfab-ok').click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('#notice')).toContainText('2 photos added');
  await lib.locator('#fablib-groups button', { hasText: 'My photos' }).click();
  await expect(lib.locator('#fablib-grid button.fab')).toHaveText(['Second', 'First']); // the newest first
});

test('+ Add fabric: a file that is not a picture, or one the browser cannot read, is explained', async ({
  app,
  page,
}) => {
  await app.open();
  await page.locator('#rail-parts').click();
  const tile = page.locator('#dz-fabrics2 .fab-add');
  let picked = page.waitForEvent('filechooser');
  await tile.click();
  await (await picked).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('#notice')).toContainText('aren’t pictures');
  await expect(page.locator('#addfab')).toBeHidden();
  picked = page.waitForEvent('filechooser');
  await tile.click();
  await (await picked).setFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a picture') });
  await page.locator('#addfab-ok').click();
  await expect(page.locator('#notice')).toContainText('Couldn’t read broken.jpg');
  expect(await app.storage(s => s.fabrics.list().length)).toBe(0);
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

test('the palette: × takes a fabric off every list (with Undo); the library puts it back', async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-parts').click();
  const row = page.locator('#dz-fabrics2'),
    teal = row.locator('.fab', { hasText: 'Teal cotton' });
  // the default quilt uses cream, indigo, mustard, red linen: those show a ✓ and have no ×
  await expect(row.locator('.fab', { hasText: 'Cream cotton' }).locator('.fab-in')).toHaveCount(1);
  await expect(row.locator('.fab', { hasText: 'Cream cotton' }).locator('.fab-x')).toHaveCount(0);
  await teal.hover();
  await teal.locator('.fab-x').click();
  await expect(teal).toHaveCount(0);
  expect((await app.current()).blocks.every(b => !b.fabrics.includes('b14'))).toBe(true); // nothing chosen by the click
  // gone from the other lists too
  await page.locator('#rail-sash').click();
  await expect(page.locator('#sash-fabs .fab', { hasText: 'Teal cotton' })).toHaveCount(0);
  // Undo brings it back
  await page.locator('#notice button', { hasText: 'Undo' }).click();
  await expect(page.locator('#sash-fabs .fab', { hasText: 'Teal cotton' })).toHaveCount(1);
  // off again, then back from the library: at the end of the list, with a dot in the library
  await page.locator('#rail-parts').click();
  await teal.hover();
  await teal.locator('.fab-x').click();
  await expect(teal).toHaveCount(0);
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#fablib-q').fill('teal');
  await expect(page.locator('#fablib-grid .fab.on-palette', { hasText: 'Teal cotton' })).toHaveCount(0);
  await expect(page.locator('#fablib-reset')).toBeVisible();
  await page.locator('#fablib-grid button.fab', { hasText: 'Teal cotton' }).click();
  await expect(row.locator('.fab').last()).toContainText('Teal cotton');
  // reset: the lists as at first
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#fablib-reset').click();
  await expect(page.locator('#fablib-reset')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('quilt-fabric-palette.v1'))).toBeNull();
});

test('the collection: 1500 fabrics drawn in code, found by name, used like any other', async ({ app, page }) => {
  await app.open();
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-block').click(); // the centre part
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-more-float').click();
  const lib = page.locator('#fablib');
  await expect(lib.locator('#fablib-groups button', { hasText: 'Collection' })).toHaveText('Collection 1500');
  await expect(lib.locator('#fablib-groups button', { hasText: 'My photos' })).toHaveCount(0); // no photos yet
  await lib.locator('#fablib-groups button', { hasText: 'Collection' }).click();
  await expect(lib.locator('#fablib-grid .fab')).toHaveCount(60);
  await expect(lib.locator('#fablib-grid .fab').first()).toHaveText('Charcoal solid');
  await lib.locator('#fablib-q').fill('forest gingham');
  await lib.locator('#fablib-grid button.fab', { hasText: 'Forest gingham on cream' }).click();
  await expect(lib).toBeHidden();
  expect((await app.current()).blocks[0].fabrics.filter(f => f === 'c4')).toHaveLength(1);
  // in the short list now, chosen; its picture is drawn (a green and cream check, not the cream stand-in)
  await expect(page.locator('#dz-fabrics2 .fab[aria-pressed="true"]')).toHaveText('Forest gingham on cream');
  const colours = await page
    .locator('#dz-fabrics2 .fab[aria-pressed="true"] canvas')
    .evaluate(cv => new Set(Array.from(cv.getContext('2d').getImageData(0, 0, 64, 64).data).map(v => v >> 5)).size);
  expect(colours).toBeGreaterThan(3);
});
