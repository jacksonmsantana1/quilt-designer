// My designs: saving, renaming, duplicating, deleting, searching and sorting the saved quilts.
import { test, expect } from './fixtures.mjs';

const pins = page => page.locator('#mine-grid .pin');
const pin = (page, name) => pins(page).filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
/** one of a card's round buttons (shown on hover) */
async function cardButton(page, name, action) {
  const p = pin(page, name);
  await p.locator('.img').hover();
  await p.locator(`[data-a="${action}"]`).click();
}
const names = page => pins(page).locator('.meta b').allTextContents();

async function saveAs(page, name) {
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill(name);
  await page.locator('#save-ok').click();
  await expect(page.locator('#save-dlg')).toBeHidden();
}

test('save, rename, duplicate and delete', async ({ app, page }) => {
  await app.open();
  await saveAs(page, 'Blue star');
  await page.getByRole('tab', { name: 'My designs' }).click();
  await expect(pin(page, 'Blue star')).toHaveClass(/current/);

  // rename: Enter keeps the new name, Escape keeps the old one
  await cardButton(page, 'Blue star', 'rename');
  await page.locator('#mine-grid input').fill('Indigo star');
  await page.keyboard.press('Enter');
  await expect(pin(page, 'Indigo star')).toHaveCount(1);
  await cardButton(page, 'Indigo star', 'rename');
  await page.locator('#mine-grid input').fill('Never mind');
  await page.keyboard.press('Escape');
  await expect(pin(page, 'Indigo star')).toHaveCount(1);

  // duplicate: a new record with its own id and the same quilt
  await cardButton(page, 'Indigo star', 'dup');
  await expect(pin(page, 'Indigo star \\(copy\\)')).toHaveCount(1);
  const recs = await app.storage(s => s.designs.list().filter(r => r.name.startsWith('Indigo star')));
  expect(recs).toHaveLength(2);
  expect(recs[0].id).not.toBe(recs[1].id);
  expect(recs[0].design).toEqual(recs[1].design);

  // delete: the first click arms the button, the second deletes
  const before = await pins(page).count();
  await cardButton(page, 'Indigo star', 'del');
  await expect(pins(page)).toHaveCount(before);
  await pin(page, 'Indigo star').locator('[data-a="del"]').click();
  await expect(pins(page)).toHaveCount(before - 1);
  // it was the design being edited: that becomes an unsaved design again
  expect(await app.storage(s => s.getSession('mineCur') ?? null)).toBeNull();
});

test('a deleted card disarms itself after a moment', async ({ app, page }) => {
  await app.open('mine');
  const first = (await names(page))[0];
  await cardButton(page, first, 'del');
  const btn = pin(page, first).locator('[data-a="del"]');
  await expect(btn).toHaveText('✓');
  await expect(btn).toHaveText('🗑', { timeout: 4000 });
});

test('save changes, save as new, and the save dialog from My designs', async ({ app, page }) => {
  await app.open();
  await saveAs(page, 'Version one');
  await page.locator('[data-step="c:-1"]').click();
  // the dialog now offers to save the changes (same design) or a new one
  await page.locator('#dz-save').click();
  await expect(page.locator('#save-title')).toHaveText('Save changes');
  await expect(page.locator('#save-asnew')).toBeVisible();
  await page.locator('#save-name').fill('Version two');
  await page.locator('#save-asnew').click();
  const recs = await app.storage(s => s.designs.list().map(r => ({ name: r.name, cols: r.design.cols })));
  expect(recs).toEqual(
    expect.arrayContaining([
      { name: 'Version one', cols: 5 },
      { name: 'Version two', cols: 4 },
    ]),
  );
  // "Save current design" on My designs always makes a new one; the ✕ closes the dialog without saving
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#mine-new').click();
  await expect(page.locator('#save-title')).toHaveText('Save design');
  await page.locator('#save-x').click();
  await expect(page.locator('#save-dlg')).toBeHidden();
  // and Enter in the name field saves
  await page.locator('#mine-new').click();
  await page.locator('#save-name').fill('Version three');
  await page.locator('#save-name').press('Enter');
  await expect(pin(page, 'Version three')).toHaveCount(1);
});

test('search and sort', async ({ app, page }) => {
  await app.open();
  await saveAs(page, 'Zebra');
  await page.getByRole('tab', { name: 'My designs' }).click();
  await page.locator('#mine-sort').selectOption('name');
  const sorted = await names(page);
  expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b)));
  await page.locator('#mine-sort').selectOption('updated');
  expect((await names(page))[0]).toBe('Zebra'); // the most recently saved first
  await page.locator('#mine-q').fill('medallion');
  expect((await names(page)).every(n => /medallion/i.test(n))).toBe(true);
  await page.locator('#mine-q').fill('nothing like this');
  await expect(pins(page)).toHaveCount(0);
  await expect(page.locator('#mine-empty')).toHaveText('No designs match your search.');
});

test('with no saved designs, the page says how to save one', async ({ app, page }) => {
  await app.open('mine');
  for (const n of await names(page)) {
    await cardButton(page, n, 'del');
    await pin(page, n).locator('[data-a="del"]').click();
  }
  await expect(page.locator('#mine-empty')).toContainText('No saved designs yet');
});
