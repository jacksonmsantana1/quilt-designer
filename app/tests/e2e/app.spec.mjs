import { test, expect } from './fixtures.mjs';

test('the simulation opens over the designer and closes again', async ({ app, page }) => {
  test.slow(); // the 3D view is slow without a GPU
  await app.open();
  await page.locator('#dz-sim').click({ timeout: 60_000 });
  await expect(page.locator('#page-sim')).toBeVisible();
  await page.locator('#bedsel').selectOption('tb-rect6');
  await expect(page.locator('#intro')).toContainText('rectangular table, 6 seats');
  await page.locator('#sim-close').click();
  await expect(page.locator('#page-sim')).toBeHidden();
  await expect(page.locator('#page-design')).toBeVisible();
});

test('couches: a ready size, and a custom one with its own width, depth and seats', async ({ app, page }) => {
  test.slow(); // the 3D view is slow without a GPU
  await app.open();
  await page.locator('#dz-sim').click({ timeout: 60_000 });
  await page.locator('#bedsel').selectOption('co-loveseat');
  await expect(page.locator('#intro')).toContainText('loveseat, 2 seats (1500 mm wide, 900 mm deep)');
  await expect(page.locator('#couch-custom')).toBeHidden();
  await page.locator('#bedsel').selectOption('custom-couch');
  await expect(page.locator('#couch-custom')).toBeVisible();
  await expect(page.locator('#cch-w')).toHaveValue('1500'); // starts from the couch shown
  await page.locator('#cch-w').fill('2800');
  await page.locator('#cch-w').press('Enter');
  await page.locator('#cch-s').fill('4');
  await page.locator('#cch-s').press('Enter');
  await expect(page.locator('#intro')).toContainText('custom couch (2800 mm wide, 900 mm deep)');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quilt-bed.v1')));
  expect(saved).toMatchObject({ key: 'custom-couch', kind: 'couch', w: 2800, l: 900, seats: 4 });
  // more seats than fit the width (each at least 40 cm between the arms): the boxes go back to the couch shown
  await page.locator('#cch-s').fill('9');
  await page.locator('#cch-s').press('Enter');
  await expect(page.locator('#cch-s')).toHaveValue('4');
});

test('My designs has the sample quilts, and opening one loads it', async ({ app, page }) => {
  await app.open('mine');
  const name = page.locator('#page-mine').getByText('Medallion from the photo', { exact: true });
  await expect(name).toBeVisible();
  // that sample's own ⋯ menu, Open: the two samples are saved together, so their order on the page can vary
  const card = page.locator('#page-mine article.pin', {
    has: page.getByText('Medallion from the photo', { exact: true }),
  });
  await card.locator('.pin-more').click();
  await page.locator('.pin-menu [data-a="open"]').click();
  await expect.poll(async () => (await app.current()).cols).toBe(15);
});

test.describe('first visit', () => {
  test.use({ firstVisit: true });
  test('the guided tour starts by itself and blocks other controls', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('#tour')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/tour-active/);
    await page.locator('#tour-skip').click();
    await expect(page.locator('body')).not.toHaveClass(/tour-active/);
  });

  test('the tutorial makes a real quilt: block, copies, sashing, border, the bed and the cutting guide', async ({
    app,
    page,
  }) => {
    await app.open();
    const title = page.locator('#tour-title');
    await page.getByRole('button', { name: 'Start the exercise' }).click();
    await expect(title).toHaveText('Make it three rows');
    const start = await app.current();
    expect([start.cols, start.rows, start.blocks.length]).toEqual([3, 1, 3]);
    await expect(page.locator('#tour-clip')).toHaveAttribute('src', 'assets/clips/tut_en_rows.mp4');
    // a control that is off for now says so, instead of seeming broken
    await page.locator('[data-step="c:1"]').click({ force: true });
    await expect(page.locator('#tour-note')).toContainText('Only the highlighted');
    await page.locator('[data-step="r:1"]').click();
    await expect(title).toHaveText('Make it three rows');
    await page.locator('[data-step="r:1"]').click();

    await expect(title).toHaveText('Measure in inches');
    await page.locator('.unit-sw').click();

    await expect(title).toHaveText('Choose the block size');
    // back: the switch goes back to mm, and the step can be done again
    await page.locator('#tour-back').click();
    await expect(title).toHaveText('Measure in inches');
    await expect(page.locator('#unit-sw')).not.toBeChecked();
    await page.locator('.unit-sw').click();
    await expect(title).toHaveText('Choose the block size');
    // typing replaces the number there, wherever the click left the cursor
    await page.locator('#dz-bsize .inch-whole').click();
    // another number: said so, and put back
    await page.keyboard.type('13');
    await page.keyboard.press('Enter');
    await expect(page.locator('#tour-note')).toContainText('Type 12');
    await expect(title).toHaveText('Choose the block size');
    await expect.poll(async () => (await app.current()).blockMm).toBe(254);
    await page.keyboard.type('12');
    await page.keyboard.press('Enter');

    await expect(title).toHaveText('Open the middle block');
    const sized = await app.current();
    expect([sized.rows, sized.blocks.length, sized.blockMm]).toEqual([3, 9, 305]);
    // the sign comes up as the video ends (or at once, where the video can't play), and the button works all along
    await expect(page.locator('#dz-quilt.tour-glow')).toBeVisible({ timeout: 30_000 });
    let q = await page.locator('#dz-quilt').boundingBox();
    await page.mouse.click(q.x + q.width / 2, q.y + q.height / 2);

    await expect(title).toHaveText('Choose the nine patch');
    // the other controls are off, and clicking them doesn't move the tutorial on
    await page.locator('#rail-brd').click({ force: true });
    await expect(title).toHaveText('Choose the nine patch');
    await expect(page.locator('#tour-arrow')).toBeVisible();
    // another block: it isn't applied, the person is told, and the step's video comes back
    await page.locator('#dz-patterns .pat:not([data-p="nine"])').first().click();
    await expect(page.locator('#tour-note')).toContainText('different block');
    expect((await app.current()).blocks[4].pattern).toBe('plain');
    await expect(title).toHaveText('Choose the nine patch');
    await page.locator('#dz-patterns [data-p="nine"]').click();
    await expect(page.locator('#tour-note')).toBeHidden();
    await expect(page.locator('#tour-arrow')).toBeHidden();

    await expect(title).toHaveText('Pick a square');
    // back: the pattern comes off, and choosing it again goes on
    await page.locator('#tour-back').click();
    await expect(title).toHaveText('Choose the nine patch');
    expect((await app.current()).blocks[4].pattern).toBe('plain');
    await page.locator('#dz-patterns [data-p="nine"]').click();
    await expect(title).toHaveText('Pick a square');
    // (the panel may still be scrolling to it: this click waits for it to settle, as a person would)
    // a corner first: refused, and the step stays
    const part = await page.locator('#dz-block').boundingBox();
    await page.mouse.click(part.x + part.width / 6, part.y + part.height / 6);
    await expect(page.locator('#tour-note')).toContainText('another square');
    await expect(title).toHaveText('Pick a square');
    await page.locator('#dz-block').click();

    await expect(title).toHaveText('Give it a fabric');
    await expect(page.locator('#dz-fabrics2 [data-f="b3"].tour-glow')).toBeVisible({ timeout: 30_000 });
    await page.locator('#dz-fabrics2 .fab:not([data-f="b3"])').first().click();
    await expect(page.locator('#tour-note')).toContainText('different fabric');
    await expect(title).toHaveText('Give it a fabric');
    await page.locator('#dz-fabrics2 [data-f="b3"]').click();

    await expect(title).toHaveText('Select the whole quilt');
    q = await page.locator('#dz-quilt').boundingBox();
    await page.mouse.move(q.x + 6, q.y + 6);
    await page.mouse.down();
    await page.mouse.move(q.x + q.width - 6, q.y + q.height - 6, { steps: 6 });
    await page.mouse.up();

    await expect(title).toHaveText('Copy your block');
    // the plain block, marked as current after the drag, can't be clicked: it would wipe out the nine patch
    const others = page.locator('#dz-library .blib-item:not([data-src="4"])');
    await others.first().click({ force: true });
    expect((await app.current()).blocks[4].pattern).toBe('nine');
    await expect(title).toHaveText('Copy your block');
    // back a step, and the same step again
    await page.locator('#tour-back').click();
    await expect(title).toHaveText('Select the whole quilt');
    expect((await app.current()).blocks[4].pattern).toBe('nine');
    q = await page.locator('#dz-quilt').boundingBox();
    await page.mouse.move(q.x + 6, q.y + 6);
    await page.mouse.down();
    await page.mouse.move(q.x + q.width - 6, q.y + q.height - 6, { steps: 6 });
    await page.mouse.up();
    await expect(title).toHaveText('Copy your block');
    await page.locator('#dz-library .blib-item[data-src="4"]').click();

    await expect(title).toHaveText('Add sashing');
    await page.locator('#rail-sash').click();
    await expect(title).toHaveText('Try a narrow width');
    // another width: refused out loud
    await page.locator('#sash-presets button:nth-child(3)').click();
    await expect(page.locator('#tour-note')).toContainText('different width');
    expect((await app.current()).sashing?.mm || 0).toBe(0);
    await page.locator('#sash-presets button:nth-child(2)').click();
    await expect(title).toHaveText('Now a wide one');
    expect((await app.current()).sashing.mm).toBe(25);
    await page.locator('#sash-presets button:nth-child(6)').click();
    await expect(title).toHaveText('Choose the one for this quilt');
    expect((await app.current()).sashing.mm).toBe(76);
    await page.locator('#sash-presets button:nth-child(4)').click();

    await expect(title).toHaveText('Open the borders');
    await page.locator('#rail-brd').click();
    await expect(title).toHaveText('Add a border');
    await page.locator('.brd-type[data-t="plain"]').click();

    await expect(title).toHaveText('Save your quilt');
    await page.locator('#dz-save').click();
    await expect(title).toHaveText('Give it a name');
    await expect(page.locator('#save-name')).toHaveValue('My first quilt');
    await page.locator('#save-ok').click();

    await expect(title).toHaveText('See it on a bed');
    await expect(page.locator('#tour-back')).toBeHidden();
    await page.locator('#dz-sim').click();
    await expect(title).toHaveText('Back to your quilt');
    await expect(page.locator('#bedsel')).toHaveValue('br-solteiro');
    await page.locator('#sim-close').click();

    await expect(title).toHaveText('See what to cut');
    // back into the 3D view, and out again
    await page.locator('#tour-back').click();
    await expect(title).toHaveText('Back to your quilt');
    await expect(page.locator('#sim-close')).toBeVisible();
    await page.locator('#sim-close').click();
    await expect(title).toHaveText('See what to cut');
    await page.locator('#tabs [data-page="cut"]').click();

    await expect(title).toHaveText('See the sizes');
    await expect(page.locator('#cg-seam')).toHaveValue('6.4');
    await page.locator('#cg-blocks .cgblock:first-child h3').click();

    await expect(title).toHaveText('Well done!');
    await expect(page.locator('#cg-blocks .cgblock:first-child')).toContainText('4½');
    await expect(page.locator('#cg-blocks .cgblock').first()).toContainText('Nine patch');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('body')).not.toHaveClass(/tour-active/);
    // the cutting guide stays open: it is still being read
    await expect(page.locator('#cg-blocks')).toBeVisible();
    const d = await app.current();
    expect(new Set(d.blocks.map(b => b.pattern))).toEqual(new Set(['nine']));
    expect(d.blocks.every(b => b.fabrics.includes('b3'))).toBe(true);
    expect(d.sashing.mm).toBe(51);
    expect(d.borders.length).toBe(1);
    expect(d.blockMm).toBe(305);
    // it is saved: the worst way to end would be not finding it again
    const names = await app.storage(s => s.designs.list().map(m => m.name));
    expect(names).toContain('My first quilt');
    // the size box, outside the tutorial too: the first digit replaces the number
    await page.locator('#tabs [data-page="design"]').click();
    await page.locator('#dz-bsize .inch-whole').click();
    await page.keyboard.type('10');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await app.current()).blockMm).toBe(254);
    expect(app.errors).toEqual([]);
  });
});
