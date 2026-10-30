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
  // that sample's own Open button: the two samples are saved together, so their order on the page can vary
  const card = page.locator('#page-mine article.pin', {
    has: page.getByText('Medallion from the photo', { exact: true }),
  });
  await card.hover();
  await card.locator('button.open').click();
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
});
