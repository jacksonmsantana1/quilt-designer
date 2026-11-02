// The realistic picture: asked for with a button, made in the background while the person carries on, then there to
// look at. These run on the plain fallback renderer and very few frames: the point here is the feature, not the image.
import { test, expect } from './fixtures.mjs';

test.setTimeout(240000);

/** Asks for very little, on the renderer that works without a graphics card. */
async function quick(page) {
  await page.evaluate(() => {
    globalThis.__pictureQuality = 1;
    const e = document.getElementById('engine');
    e.value = 'raster';
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

test('the picture is made in the background, you can keep working, and it stays for that quilt', async ({ app }) => {
  const { page } = app;
  await app.open();
  await quick(page);
  const btn = page.locator('#dz-picture'),
    card = page.locator('#pic-job');
  await expect(btn).toHaveAttribute('title', 'Make a realistic picture of this quilt');
  await expect(card).toBeHidden();

  await btn.click();
  await expect(card).toBeVisible();
  await expect(btn).toHaveAttribute('title', 'The realistic picture of this quilt is being made');

  // the person isn't held up: the page keeps answering, and the live view stays on the page they were on
  await expect(page.locator('#page-design')).toBeVisible();
  expect(await page.evaluate(() => 1 + 1)).toBe(2);

  await expect(page.locator('#notice')).toContainText('Your realistic picture is ready', { timeout: 200000 });
  await expect(card).toBeHidden();
  await expect(btn).toHaveAttribute('title', 'See the realistic picture of this quilt');

  // See it: a real image, the size it was made
  await page.locator('#notice button').click();
  await expect(page.locator('#pic-dlg')).toBeVisible();
  await page.waitForFunction(() => document.getElementById('pic-img').naturalWidth === 1500);
  await expect(page.locator('#pic-save')).toHaveAttribute('download', 'quilt-picture.jpg');
  await page.locator('#pic-close').click();
  await expect(page.locator('#pic-dlg')).toBeHidden();

  // it is still there after a reload, and the button knows
  await page.reload();
  await expect(btn).toHaveAttribute('title', 'See the realistic picture of this quilt');
  await btn.click();
  await page.waitForFunction(() => document.getElementById('pic-img').naturalWidth === 1500);
  await page.locator('#pic-close').click();

  // another quilt doesn't have it
  await page.locator('#dz-quilting').selectOption('cross');
  await expect(btn).toHaveAttribute('title', 'Make a realistic picture of this quilt');
});

test('a picture can be stopped, and the quilt edited while one is being made', async ({ app }) => {
  const { page } = app;
  await app.open();
  await quick(page);
  const btn = page.locator('#dz-picture'),
    card = page.locator('#pic-job');
  await btn.click();
  await expect(card).toBeVisible();
  // edited meanwhile: the picture on its way is of the quilt as it was
  await page.locator('#dz-quilting').selectOption('cross');
  await expect(btn).toHaveAttribute('title', 'Make a realistic picture of this quilt');
  await btn.click();
  await expect(page.locator('#notice')).toContainText('another version');
  await page.locator('#pic-job-stop').click();
  await expect(card).toBeHidden();
  await expect(btn).toHaveAttribute('title', 'Make a realistic picture of this quilt');
});
