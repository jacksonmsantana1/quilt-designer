// Zoom: the mouse wheel over the quilt zooms in and out at the mouse, dragging with the wheel pressed moves the
// zoomed quilt, and clicks still find the block under the mouse. All the way out, the wheel scrolls the page.
import { test, expect } from './fixtures.mjs';

const quiltBox = page => page.locator('#dz-quilt').boundingBox();
const windowBox = page => page.locator('#dz-quilt').evaluate(c => c.parentElement.getBoundingClientRect().toJSON());

test('the wheel zooms at the mouse; a click still opens the block under it; the wheel pressed moves it', async ({
  app,
  page,
}) => {
  await app.open();
  const b0 = await quiltBox(page);
  // over the middle block of the 5 × 5 quilt (block 3, 3)
  const mx = b0.x + b0.width / 2,
    my = b0.y + b0.height / 2;
  await page.mouse.move(mx, my);
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await quiltBox(page)).width).toBeGreaterThan(b0.width * 1.5);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY); // the page kept still
  // the quilt's window keeps its size, and the point under the mouse stays under it
  const w = await windowBox(page);
  expect(Math.abs(w.width - b0.width)).toBeLessThan(2);
  const b1 = await quiltBox(page);
  expect(Math.abs((mx - b1.x) / b1.width - 0.5)).toBeLessThan(0.01);

  await page.mouse.click(mx, my);
  await expect(page.locator('#dz-blockname')).toContainText('block 3, 3');

  // dragging with the wheel pressed moves the zoomed quilt with the mouse (the block editor opened beside it:
  // measure again; still zoomed)
  await page.waitForTimeout(300);
  const before = await quiltBox(page),
    w2 = await windowBox(page),
    px = w2.x + w2.width / 2,
    py = w2.y + w2.height / 2;
  expect(before.width).toBeGreaterThan(w2.width * 1.5);
  await page.mouse.move(px, py);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(px - 80, py - 40);
  await page.mouse.up({ button: 'middle' });
  const b2 = await quiltBox(page);
  expect(Math.round(b2.x - before.x)).toBe(-80);
  expect(Math.round(b2.y - before.y)).toBe(-40);

  // all the way out: the whole quilt again, and then the wheel scrolls the page
  await page.mouse.move(px, py);
  for (let k = 0; k < 6; k++) await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await quiltBox(page)).width).toBeLessThan(w2.width + 1);
  await page
    .locator('#dz-quilt')
    .evaluate(c => c.parentElement.classList.contains('zoomed'))
    .then(z => expect(z).toBe(false));
});
