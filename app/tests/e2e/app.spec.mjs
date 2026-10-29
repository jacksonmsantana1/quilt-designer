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

test('My designs has the sample quilts, and opening one loads it', async ({ app, page }) => {
  await app.open('mine');
  const card = page.locator('#page-mine').getByText('Medallion from the photo', { exact: true });
  await expect(card).toBeVisible();
  await card.click();
  const open = page.locator('#page-mine button', { hasText: /^Open$/ });
  if (await open.count()) await open.first().click();
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
