// Shape mosaics in the designer: the Layout menu turns the quilt into hexagons, a click or a drag paints them with
// the fabric chosen in the Mosaic panel, and going back shows the blocks again.
import { test, expect } from './fixtures.mjs';

test('a quilt becomes a hexagon mosaic, is painted by click and drag, and goes back to blocks', async ({
  app,
  page,
}) => {
  await app.open();
  const blocksBefore = (await app.current()).blocks;
  await page.locator('#dz-setting').selectOption('mosaic');
  await expect(page.locator('#mos-card')).toBeVisible();
  await expect(page.locator('#rail-parts')).toBeHidden();
  let d = await app.current();
  expect(d.mosaic.shape).toBe('hex');
  expect(d.mosaic.fabrics.every(f => f === 'b0')).toBe(true);
  await expect(page.locator('#dz-size-b')).toContainText(`${d.mosaic.fabrics.length} hexagons, 50 mm sides`);

  // fewer, bigger hexagons: the steppers count them
  await page.locator('#dz-cols').fill('6');
  await page.locator('#dz-cols').dispatchEvent('change');
  await page.locator('#dz-rows').fill('6');
  await page.locator('#dz-rows').dispatchEvent('change');
  await page.locator('#mos-mm').fill('120');
  await page.locator('#mos-mm').dispatchEvent('change');
  d = await app.current();
  expect([d.mosaic.cols, d.mosaic.rows, d.mosaic.mm]).toEqual([6, 6, 120]);

  // paint with indigo: a click on the middle of the quilt paints one hexagon
  await page.locator('#mos-fabs .fab[data-f="b1"]').click();
  const box = await page.locator('#dz-quilt').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  d = await app.current();
  expect(d.mosaic.fabrics.filter(f => f === 'b1')).toHaveLength(1);

  // a drag across a row paints every hexagon on the way, as one undo step (a moment later: quick repeats merge)
  await page.waitForTimeout(1100);
  const y = box.y + box.height * 0.25;
  await page.mouse.move(box.x + 5, y);
  await page.mouse.down();
  for (let x = 5; x < box.width - 5; x += 10) await page.mouse.move(box.x + x, y);
  await page.mouse.up();
  d = await app.current();
  const painted = d.mosaic.fabrics.filter(f => f === 'b1').length;
  expect(painted).toBeGreaterThan(6);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await app.current()).mosaic.fabrics.filter(f => f === 'b1').length).toBe(1);

  // tools: a rosette paints the hexagon and the six around it; Fill all with Random uses the fabrics in the list
  await page.waitForTimeout(1100);
  await page.locator('#mos-fabs .fab[data-f="b3"]').click();
  await page.locator('#mos-tools [data-tool="rosette"]').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect((await app.current()).mosaic.fabrics.filter(f => f === 'b3')).toHaveLength(7);
  await page.waitForTimeout(1100);
  await page.locator('#mos-tools [data-tool="row"]').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9);
  expect((await app.current()).mosaic.fabrics.filter(f => f === 'b3').length).toBeGreaterThan(7);
  await page.waitForTimeout(1100);
  await page.locator('#mos-tools [data-tool="random"]').click();
  await page.locator('#mos-fill').click();
  const listed = await page.locator('#mos-fabs button.fab[data-f]').evaluateAll(bs => bs.map(b => b.dataset.f));
  const after = (await app.current()).mosaic.fabrics;
  expect(after.every(f => listed.includes(f))).toBe(true);
  expect(new Set(after).size).toBeGreaterThan(3);
  await page.keyboard.press('Control+z'); // Fill all is one step
  expect((await app.current()).mosaic.fabrics.filter(f => f === 'b3').length).toBeGreaterThan(7);

  // the cutting guide: one card for the mosaic, hexagons cut from a template, the edge pieces too; the PDF has
  // the fabrics, the mosaic and its real-size templates
  await page.locator('[data-page="cut"]').click();
  await expect(page.locator('#cg-facts')).toContainText('Mosaic:');
  const card = page.locator('#cg-blocks .cgblock').first();
  await expect(card.locator('h3')).toHaveText('Mosaic');
  await expect(card.locator('tbody')).toContainText('hexagon template, finished side 120 mm');
  await expect(card.locator('tbody')).toContainText('template piece'); // the half and trimmed shapes at the edges
  await page.locator('#cg-pdf').click();
  await page.waitForFunction(() => window.__lastCutPdf, null, { timeout: 80_000 });
  const pages = await page.evaluate(async () => {
    const t = new TextDecoder('latin1').decode(new Uint8Array(await window.__lastCutPdf.arrayBuffer()));
    return +(t.match(/\/Type \/Pages \/Count (\d+)/) || [])[1];
  });
  expect(pages).toBeGreaterThanOrEqual(3);
  await page.locator('[data-page="design"]').click();

  // tumbling blocks: diamonds, and Same way paints every top of a cube in one click
  await page.locator('#mos-shape').selectOption('diamond');
  await expect(page.locator('#dz-size-b')).toContainText('diamonds, 120 mm sides');
  await page.waitForTimeout(1100);
  await page.locator('#mos-tools [data-tool="way"]').click();
  await page.locator('#mos-fabs .fab[data-f="b4"]').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const tops = (await app.current()).mosaic.fabrics.filter(f => f === 'b4').length;
  expect(tops).toBeGreaterThan(10);
  await page.locator('#mos-shape').selectOption('triangle');
  await expect(page.locator('#dz-size-b')).toContainText('triangles');
  await expect(page.locator('#mos-tools [data-tool="way"]')).toBeVisible();
  await page.locator('#mos-shape').selectOption('hex');
  await expect(page.locator('#mos-tools [data-tool="way"]')).toBeHidden();

  // back to blocks: the same blocks as before
  await page.locator('#dz-setting').selectOption('straight');
  d = await app.current();
  expect(d.mosaic).toBeUndefined();
  expect(d.blocks).toEqual(blocksBefore);
  await expect(page.locator('#rail-parts')).toBeVisible();
});
