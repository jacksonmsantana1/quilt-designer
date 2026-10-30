// The colour finder: the round colour button under "More fabrics" opens a colour wheel; fabrics are ranked by how
// well their colours match the ones picked, and one clicked there goes to the list it was opened from.
import { test, expect } from './fixtures.mjs';

/** Stores three plain photos: all green, half green and half red, all red; then reloads so the app reads them. */
async function addPhotos(app, page) {
  await app.open();
  await app.storage(async s => {
    const GREEN = 'hsl(120 90% 50%)',
      RED = 'hsl(0 90% 50%)';
    for (const [name, left, right] of [
      ['All green', GREEN, GREEN],
      ['Green and red', GREEN, RED],
      ['All red', RED, RED],
    ]) {
      const c = new OffscreenCanvas(32, 32),
        g = c.getContext('2d');
      g.fillStyle = left;
      g.fillRect(0, 0, 16, 32);
      g.fillStyle = right;
      g.fillRect(16, 0, 16, 32);
      await s.fabrics.add(await c.convertToBlob(), { name, cm: 10 });
    }
  });
  await page.reload();
  await app.open();
}

/** Clicks the wheel at a hue (degrees), near its edge. */
async function clickWheel(page, hue) {
  const box = await page.locator('#colfind-canvas').boundingBox(),
    a = (hue * Math.PI) / 180;
  await page.mouse.click(
    box.x + box.width / 2 + Math.cos(a) * 0.9 * (box.width / 2),
    box.y + box.height / 2 + Math.sin(a) * 0.9 * (box.height / 2),
  );
}

test('the two round buttons, centred together beside the row', async ({ app, page }) => {
  await app.open();
  await page.locator('#rail-parts').click();
  await page.locator('#dz-fabrics2').hover();
  const more = await page.locator('#fab-more-float').boundingBox(),
    colour = await page.locator('#fab-colour-float').boundingBox(),
    row = await page.locator('#dz-fabrics2').boundingBox();
  await expect(page.locator('#fab-colour-float')).toHaveAttribute('aria-label', 'Find fabrics by colour');
  expect(colour.y).toBeGreaterThan(more.y + more.height); // under the ⋯
  const middle = (more.y + colour.y + colour.height) / 2;
  expect(Math.abs(middle - (row.y + row.height / 2))).toBeLessThan(2);
});

test('colours picked on the wheel rank the fabrics; one clicked goes on the selected parts', async ({ app, page }) => {
  await addPhotos(app, page);
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-block').click(); // the centre part
  await page.locator('#dz-fabrics2').hover();
  await page.locator('#fab-colour-float').click();
  const dlg = page.locator('#colfind');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('#colfind-results .fab')).toHaveCount(0); // nothing picked yet

  // green: the all-green photo first, the half-green one next, the red one faded
  await clickWheel(page, 120);
  await expect(dlg.locator('.colfind-dot')).toHaveCount(1);
  await expect(dlg.locator('#colfind-results .fab').first()).toHaveText('All green');
  await expect(dlg.locator('#colfind-results .fab').nth(1)).toHaveText('Green and red');
  await expect(dlg.locator('#colfind-results .fab', { hasText: 'All red' })).toHaveClass(/weak/);
  await expect(dlg.locator('#colfind-picks input')).toBeDisabled(); // one colour is all of it

  // and red, as much of each: the half-and-half photo first; no percentages anywhere
  await clickWheel(page, 0);
  await expect(dlg.locator('.colfind-dot')).toHaveCount(2);
  await expect(dlg.locator('#colfind-picks input')).toHaveCount(2);
  await expect(dlg.locator('#colfind-results .fab').first()).toHaveText('Green and red');
  expect(await dlg.innerText()).not.toContain('%');

  // much more red: the all-red photo moves up past the all-green one
  await dlg.locator('#colfind-picks input').nth(1).fill('90');
  await expect(dlg.locator('#colfind-picks input').first()).toHaveValue('10');
  await expect
    .poll(async () => {
      const names = await dlg.locator('#colfind-results .fab').allTextContents();
      return names.indexOf('All red') < names.indexOf('All green');
    })
    .toBe(true);

  // × takes a colour away: only green again
  await dlg.locator('.colfind-x').nth(1).click();
  await expect(dlg.locator('.colfind-dot')).toHaveCount(1);
  await expect(dlg.locator('#colfind-results .fab').first()).toHaveText('All green');

  // clicking a fabric puts it on the selected part, as from the library
  await dlg.locator('#colfind-results .fab').first().click();
  await expect(dlg).toBeHidden();
  const id = await app.storage(s => s.fabrics.list().find(f => f.name === 'All green').id);
  expect((await app.current()).blocks[0].fabrics.filter(f => f === id)).toHaveLength(1);
  await expect(page.locator('#dz-fabrics2 .fab[aria-pressed="true"]')).toHaveText('All green');
});

test('in a small window the round buttons sit over the row’s end, on the page', async ({ app, page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await app.open();
  await page.locator('#rail-parts').click();
  const row = page.locator('#dz-fabrics2');
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const r = await row.boundingBox();
  for (const id of ['#fab-more-float', '#fab-colour-float']) {
    await expect(page.locator(id)).toBeVisible();
    const b = await page.locator(id).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(r.x); // inside the row's width, not past the card's edge
    expect(b.x + b.width).toBeLessThanOrEqual(Math.min(r.x + r.width, 800));
  }
  await page.locator('#fab-colour-float').click();
  await expect(page.locator('#colfind')).toBeVisible();
});
