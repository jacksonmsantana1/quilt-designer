// The welcome page (shown at start when nobody is signed in) and the account corner. Signing in through them,
// with the API, is in sync.spec.mjs.
import { test, expect } from './fixtures.mjs';

test.describe('a first visit, signed out', () => {
  test.use({ welcome: true });

  test('the first page shows what the app does, and offers Sign in, a new account, or carrying on without one', async ({
    app,
    page,
  }) => {
    await app.open();
    const w = page.locator('#welcome');
    await expect(w).toBeVisible();
    await expect(w.getByRole('heading', { level: 1 })).toHaveText('Every stitch, beautifully planned.');
    await expect(page.locator('#welcome-signin')).toBeFocused();
    await expect(page.locator('#welcome-art svg')).toBeVisible(); // the patchwork picture
    // a new account from the top, the hero and the end; Sign in from the top and the end
    await expect(w.locator('[data-auth="signup"]')).toHaveText([
      'Get started',
      'Start your first quilt',
      'Create free account',
    ]);
    await expect(w.locator('[data-auth="signin"]')).toHaveText(['Sign in', 'Sign in']);
    await expect(w.locator('.w-card h3')).toHaveText([
      'Block designer',
      'Cutting guide',
      'Your own fabrics',
      'See it on a bed',
    ]);
    // See features scrolls down to them
    await page.locator('#welcome-features').click();
    await expect(page.locator('#welcome-feats')).toBeInViewport();
    await page.locator('#welcome-skip').click();
    await expect(w).toBeHidden();
    // remembered: not shown again on this device
    await page.reload();
    await expect(page.locator('#dz-quilt')).toBeVisible();
    await expect(w).toBeHidden();
  });

  test('signed out, the account corner says Sign in, which brings the welcome page back', async ({ app, page }) => {
    await app.open();
    await page.locator('#welcome-skip').click();
    await expect(page.locator('#acct-btn')).toBeHidden();
    await page.locator('#acct-signin').click();
    await expect(page.locator('#welcome')).toBeVisible();
  });

  test('connected with a development name only, a refresh still opens the first page', async ({ app, page }) => {
    await app.open();
    await page.locator('#welcome-skip').click();
    await page.getByRole('tab', { name: 'My designs' }).click();
    await page.locator('#sync-setup').click();
    await page.locator('#sync-url').fill('http://127.0.0.1:9'); // nothing listens there: it stays connected, offline
    await page.locator('.sync-dev summary').click();
    await page.locator('#sync-user').fill('seed');
    await page.locator('#sync-connect').click();
    await expect(page.locator('#sync-state')).toContainText('seed');
    await page.evaluate(() => localStorage.removeItem('quilt-welcome.v1')); // as if "Continue without" was never chosen
    await page.reload();
    await expect(page.locator('#welcome')).toBeVisible();
  });

  test('a sign-in window closed early says so, and the welcome page stays', async ({ app, page }) => {
    await page.route('**/@auth0/auth0-spa-js@*/**', r =>
      r.fulfill({
        contentType: 'text/javascript',
        body: `export async function createAuth0Client() { return { async loginWithPopup(o, c) { c && c.popup && c.popup.close(); throw Object.assign(new Error('Popup closed'), { error: 'cancelled' }); } }; }`,
      }),
    );
    await app.open();
    await page.locator('#welcome-signin').click();
    await expect(page.locator('#welcome-err')).toHaveText('Sign-in was closed before it finished.');
    await expect(page.locator('#welcome')).toBeVisible();
  });
});

test.describe('a first visit: the guided tour', () => {
  test.use({ welcome: true, firstVisit: true });

  test('waits for the welcome page to close', async ({ app, page }) => {
    await app.open();
    await page.waitForTimeout(2000); // the tour would have started by now
    await expect(page.locator('#tour')).toBeHidden();
    await page.locator('#welcome-skip').click();
    await expect(page.locator('#tour')).toBeVisible({ timeout: 5000 });
  });
});
