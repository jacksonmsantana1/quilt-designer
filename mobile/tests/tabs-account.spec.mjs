// The tabs, signing in and out, deleting an account, and what's done with someone else's quilt.
import { test, expect, quilt } from './fixture.mjs';

test('four tabs, each with its own title and its own search', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await expect(page.locator('h1')).toHaveText('Community');
  await expect(page.locator('nav.tabs button')).toHaveText(['Community', 'My quiltings', 'My fabrics', 'Camera']);
  await phone.tab('quilts');
  await expect(page.locator('h1')).toHaveText('My quiltings');
  await expect(page.locator('#tab-community')).toBeHidden();
  await page.locator('#q').fill('star');
  await phone.tab('camera');
  await expect(page.locator('h1')).toHaveText('Camera');
  await expect(page.locator('#q')).toBeHidden();
  await phone.tab('quilts');
  await expect(page.locator('#q')).toHaveValue('star');
  await phone.tab('community');
  await expect(page.locator('#q')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('signing in shows who it is and stays after closing the app; signing out hides the account’s quilts', async ({
  phone,
}) => {
  const { page, server } = phone;
  server.addDesign('Star of the sea');
  await phone.open();
  await phone.tab('quilts');
  await expect(page.locator('#quilts-empty')).toContainText('Sign in to see the quilts');
  await expect(page.locator('#quilts-board .pin')).toHaveCount(0);
  await phone.signIn();
  await expect(page.locator('#quilts-board .pin .name')).toHaveText(['Star of the sea']);
  await page.reload();
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .pin .name')).toHaveText(['Star of the sea']);
  await page.locator('#me').click();
  await page.locator('#sign-out').click();
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('#quilts-board .pin')).toHaveCount(0);
});

test('the privacy policy and the terms open inside the app, marked as drafts', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Privacy policy' }).click();
  await expect(page.frameLocator('dialog[open] iframe').locator('h1')).toHaveText('Privacy policy');
  await expect(page.frameLocator('dialog[open] iframe').locator('.draft')).toContainText('DRAFT');
  await page.locator('dialog[open]:has(iframe) .close').click();
  await page.getByRole('button', { name: 'Terms of use' }).click();
  await expect(page.frameLocator('dialog[open] iframe').locator('h1')).toHaveText('Terms of use');
});

test('deleting an account asks first, then removes everything; a refusal removes nothing', async ({ phone }) => {
  const { page, server } = phone;
  server.addDesign('Mine');
  await phone.open();
  await expect(page.locator('#me')).toBeVisible();
  await page.locator('#me').click();
  await expect(page.locator('#delete-account')).toHaveCount(0); // nothing to delete without an account
  await expect(page.locator('dialog[open]')).not.toContainText('false');
  await page.locator('dialog[open] .close').click();
  await phone.signIn();
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .pin')).toHaveCount(1);
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');

  await page.locator('#me').click();
  await page.locator('#delete-account').click();
  await expect(page.locator('dialog[open]').last()).toContainText('This can’t be undone');
  await page.locator('dialog[open] .ask-no').click();
  expect(server.log).not.toContain('DELETE /v1/account');

  server.refuseDeleting = true;
  await page.locator('#delete-account').click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(page.locator('.toast')).toContainText('could not be deleted');
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('#fab-board .fab-name', { hasText: 'Rose' })).toBeVisible();

  server.refuseDeleting = false;
  await page.locator('#me').click();
  await page.locator('#delete-account').click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(server.accountDeleted).toEqual({ confirm: 'DELETE' });
  await expect(page.locator('#fab-board .fab-name')).toHaveCount(0);
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .pin')).toHaveCount(0);
  await page.reload();
  await page.locator('#me').click();
  await expect(page.locator('#sign-in')).toBeVisible();
});

test('signed out, a quilt’s actions offer a sign-in', async ({ phone }) => {
  const { page } = phone;
  phone.api(() => ({ items: [quilt('Evening star')], more: false }));
  await phone.open();
  await page.locator('.pin .more-actions').click();
  await page.getByRole('button', { name: 'Save to My quiltings' }).click();
  await expect(page.locator('dialog[open]')).toContainText('Sign in to save quilts.');
  await page.locator('dialog[open] .btn.solid').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#me')).toHaveClass(/in/);
});

test('saving a quilt brings it, with its fabric photos, to My quiltings; only once', async ({ phone }) => {
  const { page } = phone;
  const id = 'f' + 'a'.repeat(24);
  const blocks = quilt('x').design.blocks.map(b => ({ ...b, fabrics: b.fabrics.map(() => id) }));
  phone.api(() => ({
    items: [
      quilt(
        'Evening star',
        { fabrics: [{ id, name: 'Hers', cm: 20, url: 'https://pictures.test/f.jpg' }] },
        { blocks },
      ),
    ],
    more: false,
  }));
  await phone.open();
  await phone.signIn();
  await page.locator('.pin .more-actions').click();
  await page.getByRole('button', { name: 'Save to My quiltings' }).click();
  await expect(page.locator('.toast')).toContainText('is in My quiltings');
  await page.locator('.pin .more-actions').click();
  await page.getByRole('button', { name: 'Save to My quiltings' }).click();
  await expect(page.locator('.toast').last()).toContainText('You already have this quilt.');
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .name')).toHaveText(['Evening star (from Ana S.)']);
  await phone.tab('fabrics');
  await expect(page.locator('#fab-board .fab-name')).toHaveText(['Hers']);
});

test('reporting says why; your own quilt can’t be reported', async ({ phone }) => {
  const { page, server } = phone;
  const theirs = quilt('Theirs');
  phone.api(() => ({ items: [theirs, quilt('Mine', { mine: true })], more: false }));
  await phone.open();
  await phone.signIn();
  await page.locator('.pin .more-actions').first().click();
  await page.getByRole('button', { name: 'Report this quilt' }).click();
  await page.getByRole('button', { name: 'Copied without permission' }).click();
  await expect(page.locator('.toast')).toContainText('someone will look at it');
  expect(server.reports).toEqual([{ id: theirs.id, reason: 'copyright' }]);
  await page.locator('.pin .more-actions').nth(1).click();
  await expect(page.getByRole('button', { name: 'Save to My quiltings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report this quilt' })).toHaveCount(0);
});

test('blocking someone hides their quilts and can be undone from the account', async ({ phone }) => {
  const { page, server } = phone;
  const theirs = quilt('Theirs');
  phone.api(() => ({ items: server.blocks.length ? [] : [theirs], more: false }));
  await phone.open();
  await phone.signIn();
  await page.locator('.pin .more-actions').click();
  await page.getByRole('button', { name: 'Stop seeing Ana S.’s quilts' }).click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(page.locator('.pin')).toHaveCount(0);
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'People you’ve blocked' }).click();
  await expect(page.locator('dialog[open] .blocked')).toContainText('Ana S.');
  await page.getByRole('button', { name: 'See them again' }).click();
  await expect(page.locator('.pin')).toHaveCount(1);
  await page.locator('dialog[open] .close').click();
});

test('signed in, the board is asked for with who’s asking, so that blocks apply', async ({ phone }) => {
  const { page, server } = phone;
  const asked = [];
  phone.api((_, headers) => {
    asked.push(headers['x-dev-user'] || null);
    return { items: [], more: false };
  });
  await phone.open();
  await expect(page.locator('#empty')).toBeVisible();
  expect(asked[0]).toBeNull();
  await page.reload(); // (signing in reloads the board only from its own sheet)
  await phone.signIn();
  await expect.poll(() => asked.at(-1)).toBe('tester');
  expect(server.communitySeen.length).toBeGreaterThan(1);
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });
  test('the tabs and the account speak Portuguese, and the policy is the Portuguese one', async ({ phone }) => {
    const { page } = phone;
    await phone.open();
    await expect(page.locator('nav.tabs button')).toHaveText(['Comunidade', 'Meus quilts', 'Meus tecidos', 'Câmera']);
    await page.locator('#me').click();
    await page.getByRole('button', { name: 'Política de privacidade' }).click();
    await expect(page.frameLocator('dialog[open] iframe').locator('.draft')).toContainText('RASCUNHO');
  });
});
