// The mm / in slide switch beside Layout: lengths are shown and typed in the unit chosen, the quilt stays in
// millimetres, and the choice is kept on this device.
import { test, expect } from './fixtures.mjs';

test('the switch changes how lengths are shown and typed, not the quilt, and is remembered', async ({ app, page }) => {
  await app.open();
  await page.locator('#dz-new').click(); // three plain squares, 300 mm: 900 × 300 mm
  const sw = page.locator('#unit-sw');
  await expect(sw).not.toBeChecked();
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 900 × 300 mm');
  await expect(page.locator('#dz-bsize [data-unit-name]')).toHaveText('mm');

  // inches: the same quilt, written in inches and eighths
  await page.locator('#unit-lbl').click();
  await expect(sw).toBeChecked();
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 35⅜ × 11¾ in');
  await expect(page.locator('#dz-bsize [data-unit-name]')).toHaveText('in');
  await expect(page.locator('#dz-bmm3')).toHaveValue('11.8125');
  expect((await app.current()).blockMm).toBe(300);

  // typing 6 means 6 inches (152 mm); the box shows it back as 6
  await page.locator('#dz-bmm3').fill('6');
  await page.locator('#dz-bmm3').press('Enter');
  expect((await app.current()).blockMm).toBe(152);
  await expect(page.locator('#dz-bmm3')).toHaveValue('6');
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 18 × 6 in');

  // the sashing widths are whole and half inches: 2 in is 51 mm
  await page.locator('#rail-sash').click();
  await expect(page.locator('#sash-presets')).toContainText('1½ in');
  await page.locator('#sash-presets button', { hasText: '2 in' }).click();
  expect((await app.current()).sashing.mm).toBe(51);
  await expect(page.locator('#sash-mm')).toHaveValue('2');

  // the cutting guide speaks inches, and buys fabric by the yard
  await page.locator('[data-page="cut"]').click();
  await expect(page.locator('#cg-facts')).toContainText(' in');
  await expect(page.locator('#cg-facts')).not.toContainText(' mm');
  await expect(page.locator('#cg-fabrics tbody')).toContainText('yd');

  // kept on this device
  await page.reload();
  await app.open();
  await expect(page.locator('#unit-sw')).toBeChecked();
  await expect(page.locator('#dz-size-b')).toContainText(' in');

  // back to millimetres
  await page.locator('#unit-lbl').click();
  await expect(page.locator('#dz-size-b')).toContainText('51 mm sashing · finished quilt 558 × 152 mm');
  await expect(page.locator('#dz-bmm3')).toHaveValue('152');
});
