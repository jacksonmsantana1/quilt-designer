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
  // in inches a length is typed as whole inches and picked as a fraction, never as decimals
  const whole = page.getByLabel('Block size: whole inches'),
    frac = page.getByLabel('Block size: fraction of an inch');
  await expect(page.locator('#dz-bmm3')).toBeHidden();
  await expect(whole).toHaveValue('11');
  await expect(frac).toHaveValue('6'); // ¾: 300 mm is 11¾ in, as written above
  await expect(frac.locator('option')).toHaveText(['0', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞']);
  expect((await app.current()).blockMm).toBe(300);

  // 6 and 0 means 6 inches (152 mm)
  await frac.selectOption('0');
  await whole.fill('6');
  await whole.press('Enter');
  expect((await app.current()).blockMm).toBe(152);
  await expect(whole).toHaveValue('6');
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 18 × 6 in');
  // 6½ in: the fraction menu alone changes it (165 mm), and back to 6
  await frac.selectOption({ label: '½' });
  expect((await app.current()).blockMm).toBe(165);
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 19½ × 6½ in');
  await frac.selectOption('0');
  expect((await app.current()).blockMm).toBe(152);

  // the sashing widths are whole and half inches: 2 in is 51 mm
  await page.locator('#rail-sash').click();
  await expect(page.locator('#sash-presets')).toContainText('1½ in');
  await page.locator('#sash-presets button', { hasText: '2 in' }).click();
  expect((await app.current()).sashing.mm).toBe(51);
  await expect(page.locator('#sash-mm')).toHaveValue('2');

  // a box made later, a border's width, gets the same pair: 2⅝ in is 67 mm
  await page.locator('#rail-brd').click();
  await page.locator('.brd-type[data-t="plain"]').click();
  const bw = page.locator('#brd-list .inch-pair').first();
  await bw.locator('input').fill('2');
  await bw.locator('select').selectOption({ label: '⅝' });
  expect((await app.current()).borders[0].mm).toBe(67);
  await expect(bw.locator('input')).toHaveValue('2');
  await expect(bw.locator('select')).toHaveValue('5');

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
  await expect(page.locator('#dz-size-b')).toContainText('51 mm sashing');
  await expect(page.locator('#dz-bmm3')).toBeVisible(); // a plain number box again
  await expect(page.locator('#dz-bmm3')).toHaveValue('152');
  await expect(page.locator('#dz-bsize .inch-pair')).toBeHidden();
});

test('a block size typed in centimetres is read as such; one out of range is refused out loud', async ({
  app,
  page,
}) => {
  await app.open();
  const box = page.locator('#dz-bmm3');
  await box.fill('25');
  await box.press('Enter');
  await expect.poll(async () => (await app.current()).blockMm).toBe(250);
  await expect(page.locator('#notice')).toContainText('25 cm is 250 mm');
  await expect(box).toHaveValue('250'); // the box shows what was used
  await box.fill('5000');
  await box.press('Enter');
  await expect(page.locator('#notice')).toContainText('A block can be from 50 mm to 1000 mm');
  await expect(box).toHaveValue('250');
  expect((await app.current()).blockMm).toBe(250);
});

test('in inches the sizes add up exactly: 10 in blocks, 2 in sashing, 2 in and 4 in borders make 58 × 70 in', async ({
  app,
  page,
}) => {
  await app.open();
  // the visible switch, as a person clicks it (the box itself is hidden under it)
  await page.locator('#unit-lbl').click();
  await expect(page.locator('#unit-sw')).toBeChecked();
  await page.locator('#dz-new').click();
  if (await page.locator('#leave-dlg').isVisible()) await page.locator('#leave-drop').click();
  for (let i = 0; i < 1; i++) await page.locator('[data-step="c:1"]').click();
  for (let i = 0; i < 4; i++) await page.locator('[data-step="r:1"]').click();
  const size = page.locator('#dz-bsize .inch-whole');
  await size.fill('10');
  await size.press('Enter');
  await page.locator('#rail-sash').click();
  await page.locator('#sash-presets button', { hasText: '2 in' }).click();
  await page.locator('#rail-brd').click();
  await page.locator('.brd-type[data-t="plain"]').click();
  await page.locator('.brd-type[data-t="plain"]').click();
  const first = page.locator('#brd-list .brd-row').first().locator('.inch-whole');
  await first.fill('2');
  await first.press('Enter');
  const d = await app.current();
  expect([d.cols, d.rows, d.blockMm, d.sashing.mm, d.borders.map(b => b.mm)]).toEqual([4, 5, 254, 51, [51, 102]]);
  await expect(page.locator('#dz-size-b')).toContainText('finished quilt 58 × 70 in');
  await page.locator('[data-page="cut"]').click();
  await expect(page.locator('#cg-seam')).toHaveValue('6.4'); // inches: a quarter-inch seam
  // the outer border's top and bottom strips: 50 in + 2 × 4 in, plus ½ in of seams
  await expect(page.locator('#cg-blocks .cgblock').last()).toContainText('58½');
  await expect(page.locator('#cg-blocks .cgblock').last()).not.toContainText('58⅝');
});
