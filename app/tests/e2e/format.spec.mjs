// Opening saved designs: old saves are upgraded, damaged ones repaired with a message, newer ones never saved over.
import { test, expect } from './fixtures.mjs';
import fs from 'fs';
import { FORMAT_VERSION } from '@quilt/shared/design.js';

const fixture = f => fs.readFileSync(new URL(`../../../shared/tests/fixtures/designs/${f}`, import.meta.url), 'utf8');
const saved = (page, text) =>
  page.addInitScript(t => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('quilt-designer.v1', t);
      sessionStorage.setItem('seeded', '1');
    }
  }, text);

test('a save from before versions opens and is saved back as the current version', async ({ app, page }) => {
  await saved(page, fixture('v0-before-block-sizes.json'));
  await app.open();
  await expect(page.locator('#notice')).toHaveCount(0);
  await page.locator('[data-step="c:1"]').click();
  const d = await app.current();
  expect(d.v).toBe(FORMAT_VERSION);
  expect(d.cols).toBe(4);
  expect(d.blockMm).toBe(763);
});

test('a damaged save is repaired and the user is told what changed', async ({ app, page }) => {
  await saved(page, fixture('broken.json'));
  await app.open();
  await expect(page.locator('#notice')).toContainText('needed some repairs');
  await expect(page.locator('#notice')).toContainText('unknown pattern');
});

test('a design from a newer version is shown but never saved over', async ({ app, page }) => {
  const text = fixture('newer.json');
  await saved(page, text);
  await app.open();
  await expect(page.locator('#notice')).toContainText('newer version');
  await page.locator('[data-step="c:1"]').click();
  const kept = await app.current();
  expect(kept.v).toBe(99);
  expect(kept.cols).toBe(JSON.parse(text).cols);
  // starting a new design ends it: that one is saved as usual
  await page.locator('#dz-new').click();
  expect((await app.current()).v).toBe(FORMAT_VERSION);
});

test('the sample designs open without repairs', async ({ app, page }) => {
  await app.open('mine');
  await expect(page.locator('#mine-grid .pin').first()).toBeVisible(); // the list is drawn a moment after the page
  const n = await page.locator('#mine-grid .pin').count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await page.getByRole('tab', { name: 'My designs' }).click();
    await page.locator('#mine-grid .pin .img').nth(i).click();
    await page.locator('#page-design').waitFor();
    await expect(page.locator('#notice')).toHaveCount(0);
  }
});
