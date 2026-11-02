// The welcome page (shown at start when nobody is signed in) and the account corner. Signing in through them,
// with the API, is in sync.spec.mjs.
import { test, expect } from './fixtures.mjs';

/** Signing in is the way past the welcome page: a stand-in for Auth0's library. No server answers, so sync just waits. */
async function signInPastWelcome(page) {
  await page.route('**/@auth0/auth0-spa-js@*/**', r =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `export async function createAuth0Client() { return {
        async loginWithPopup(o, c) { c && c.popup && c.popup.close(); },
        async getUser() { return { sub: 'auth0|e2e', email: 'e2e@example.com' }; },
        async getTokenSilently() { return 'stand-in'; },
      }; }`,
    }),
  );
  await page.locator('#welcome-signin').click();
  await expect(page.locator('#welcome')).toBeHidden();
}

/** Someone who chose "Continue without an account" when the page still offered it. */
async function skippedEarlier(page) {
  await page.evaluate(() => localStorage.setItem('quilt-welcome.v1', 'skip'));
  await page.reload();
  await expect(page.locator('#dz-quilt')).toBeVisible();
}

test.describe('a first visit, signed out', () => {
  test.use({ welcome: true });

  test('the first page shows what the app does, and offers Sign in or a new account', async ({ app, page }) => {
    await app.open();
    const w = page.locator('#welcome');
    await expect(w).toBeVisible();
    await expect(w.getByRole('heading', { level: 1 })).toHaveText('Every stitch, beautifully planned.');
    await expect(page.locator('#welcome-signin')).toBeFocused();
    await expect(page.locator('#welcome-art svg')).toBeVisible(); // the patchwork picture
    // a new account from the hero and the end; Sign in from the top and the end
    await expect(w.locator('[data-auth="signup"]')).toHaveText(['Start your first quilt', 'Create free account']);
    await expect(w.locator('[data-auth="signin"]')).toHaveText(['Sign in', 'Sign in']);
    await expect(w.locator('.w-plan h3')).toHaveText(['Block', 'Bind']);
    await expect(w.locator('.w-plan .w-price')).toHaveText(['Free', 'Coming soon']); // no price until payments exist
    await expect(w.locator('.w-plan.bind button')).toHaveCount(0);
    await expect(w.locator('.w-card h3')).toHaveText([
      'Block designer',
      'Cutting guide',
      'Your own fabrics',
      'See it on a bed',
    ]);
    await expect(w.getByRole('button', { name: 'Continue without an account' })).toHaveCount(0);
    // who skipped it before it went away isn't sent back to it
    await skippedEarlier(page);
    await expect(w).toBeHidden();
  });

  test('the steps tell one story: their clips play one after another, and a step can be clicked', async ({
    app,
    page,
  }) => {
    await app.open();
    const steps = page.locator('.w-step');
    await expect(steps.locator('button')).toHaveText([
      /Pick your blocks/,
      /Choose fabrics/,
      /Get the cutting guide/,
      /^4\s*See it on a bed or a table$/, // no promise about other devices until sync is live
    ]);
    await expect(page.locator('.w-facts')).toHaveText(
      '1,500 fabrics · Free · Works in your browser, nothing to install',
    );
    const on = () =>
      page.evaluate(() => [...document.querySelectorAll('.w-step')].findIndex(s => s.classList.contains('on')));
    const playing = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.w-step video')].map((v, i) => (v.paused ? -1 : i)).filter(i => i >= 0),
      );
    // nothing moves until the steps are on screen, then the first clip plays, alone
    expect(await on()).toBe(-1);
    await steps.first().scrollIntoViewIfNeeded();
    await expect.poll(playing, { timeout: 20_000 }).toEqual([0]);
    expect(await on()).toBe(0);

    // when it ends, the next one takes over, and the line to it is sewn up
    const toEnd = i =>
      page
        .locator('.w-step video')
        .nth(i)
        .evaluate(v => {
          v.currentTime = v.duration - 0.05;
        });
    await toEnd(0);
    await expect.poll(on, { timeout: 20_000 }).toBe(1);
    await expect.poll(playing, { timeout: 20_000 }).toEqual([1]);
    await expect(steps.nth(0)).toHaveClass(/done/);
    expect(await steps.nth(0).evaluate(s => s.style.getPropertyValue('--sewn'))).toBe('1');

    // a click goes to that step
    await steps.nth(3).locator('button').click();
    await expect.poll(playing, { timeout: 20_000 }).toEqual([3]);
    expect(await on()).toBe(3);

    // after the last clip, and a moment, it starts again
    await toEnd(3);
    await expect.poll(on, { timeout: 20_000 }).toBe(0);

    // closing the page stops it
    await signInPastWelcome(page);
    await expect.poll(playing).toEqual([]);
  });

  test('asking for less motion: the steps keep still, and a click plays only that clip', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await app.open();
    const clips = page.locator('.w-step video');
    await page.locator('.w-steps').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    expect(await clips.evaluateAll(all => all.every(v => v.paused && v.currentTime === 0))).toBe(true);
    await page.locator('.w-step button').nth(1).click();
    await expect.poll(() => clips.nth(1).evaluate(v => !v.paused), { timeout: 20_000 }).toBe(true);
    expect(await clips.nth(2).evaluate(v => v.paused)).toBe(true);
  });

  const clipTimes = page =>
    page.evaluate(() => [...document.querySelectorAll('.w-card video')].map(v => v.currentTime));

  test('the feature cards play their clips while on screen, and stop when the page closes', async ({ app, page }) => {
    await page.setViewportSize({ width: 700, height: 1000 }); // narrow enough to leave the last card out of sight
    await app.open();
    await page.locator('#welcome-cards').scrollIntoViewIfNeeded();
    await expect(page.locator('.w-card video')).toHaveCount(4);
    await expect.poll(async () => (await clipTimes(page))[0] > 0, { timeout: 20_000 }).toBe(true);
    // the last card starts out of sight, and plays when it comes into view
    expect((await clipTimes(page))[3]).toBe(0);
    await page.locator('.w-card').nth(3).scrollIntoViewIfNeeded();
    await expect.poll(async () => (await clipTimes(page))[3] > 0, { timeout: 20_000 }).toBe(true);
    await signInPastWelcome(page);
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll('.w-card video')].every(v => v.paused)))
      .toBe(true);
  });

  test('the patchwork can be played with: a click turns a triangle or recolours a square, a drag moves many', async ({
    app,
    page,
  }) => {
    await app.open();
    const patches = page.locator('#welcome-art .w-patch');
    await expect(patches).toHaveCount(48);
    await expect(page.locator('#welcome-art .w-art-hint')).toHaveText('Click or tap a patch to turn it');
    const look = () =>
      patches.evaluateAll(all =>
        all.map(p => ({
          turn: +p.querySelector('polygon')?.dataset.turn,
          a: p.dataset.a,
          b: p.dataset.b,
        })),
      );
    const before = await look();
    const tri = before.findIndex(p => p.turn >= 0);
    const plain = before.findIndex(p => Number.isNaN(p.turn));
    expect(tri).toBeGreaterThanOrEqual(0);
    expect(plain).toBeGreaterThanOrEqual(0);

    // a triangle turns a quarter at each click, and after a full turn takes a new colour, never the square's
    for (let n = 1; n <= 4; n++) {
      await patches.nth(tri).click();
      expect((await look())[tri].turn).toBe(before[tri].turn + n);
    }
    const after = (await look())[tri];
    expect(after.a).not.toBe(before[tri].a);
    expect(after.a).not.toBe(after.b);
    await expect
      .poll(() =>
        patches
          .nth(tri)
          .locator('polygon')
          .evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a),
      )
      .toBeCloseTo(Math.round(Math.cos(((before[tri].turn + 4) * Math.PI) / 2)), 3); // on screen too, once it has turned

    // a plain square takes a new colour, and only it changes
    const mid = await look();
    await patches.nth(plain).click();
    const now = await look();
    expect(now[plain].b).not.toBe(mid[plain].b);
    expect(now.filter((p, i) => i !== plain)).toEqual(mid.filter((p, i) => i !== plain));

    // a drag along the top row moves each patch it passes, once, including where it started
    const a = await patches.nth(0).boundingBox();
    const c = await patches.nth(3).boundingBox();
    const start = await look();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 });
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 12 }); // and back: not a second time
    await page.mouse.up();
    const end = await look();
    const moved = (p, q) => (Number.isNaN(p.turn) ? p.b !== q.b : q.turn === p.turn + 1);
    for (const i of [0, 1, 2, 3]) expect(moved(start[i], end[i]), `patch ${i + 1} moved once`).toBe(true);
    expect(end.slice(4)).toEqual(start.slice(4));
  });

  test('the cards are one row with no scrollbar: the one under the mouse grows and comes fully into view', async ({
    app,
    page,
  }) => {
    await app.open();
    await page.locator('#welcome-cards').scrollIntoViewIfNeeded();
    const row = page.locator('#welcome-cards');
    const cards = page.locator('.w-card');
    const width = i => cards.nth(i).evaluate(c => c.getBoundingClientRect().width);
    // a row, wider than the page, whose scrollbar takes no room
    expect(await row.evaluate(r => r.scrollWidth > r.clientWidth && r.offsetHeight === r.clientHeight)).toBe(true);
    expect(await row.evaluate(r => getComputedStyle(r).scrollbarWidth)).toBe('none');
    const small = await width(0);
    const before = await row.boundingBox();

    // a mouse alone can walk the whole row: each card grows, comes fully into view, and leaves the next one peeking out
    const pageW = page.viewportSize().width;
    await cards.nth(0).hover();
    await expect.poll(() => width(0)).toBeGreaterThan(small + 50);
    for (const i of [1, 2, 3]) {
      await page.waitForTimeout(900); // the row settles
      const box = await cards.nth(i).boundingBox();
      expect(box.x, `card ${i + 1} peeks out`).toBeLessThan(pageW - 10);
      await page.mouse.move(box.x + 8, box.y + 100);
      await expect.poll(() => width(i)).toBeGreaterThan(small + 50);
      await expect.poll(() => width(i - 1)).toBeCloseTo(small, 0); // the one before shrinks
      await expect
        .poll(async () => {
          const c = await cards.nth(i).boundingBox();
          return c.x >= 0 && c.x + c.width <= pageW;
        })
        .toBe(true);
    }

    // the page below doesn't move as cards grow, and leaving the row brings them back
    expect((await row.boundingBox()).height).toBe(before.height);
    await page.mouse.move(5, 5);
    await expect.poll(() => width(3)).toBeCloseTo(small, 0);
  });

  test('asking for less motion: the cards keep their still pictures', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await app.open();
    await page.locator('#welcome-cards').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    expect(await clipTimes(page)).toEqual([0, 0, 0, 0]);
    const stills = await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll('.w-card video')].map(v => fetch(v.poster).then(r => r.ok && v.paused)),
      ),
    );
    expect(stills).toEqual([true, true, true, true]);
  });

  test('a returning visitor does not load the clips', async ({ app, page }) => {
    await app.open();
    await skippedEarlier(page);
    const loaded = await page.evaluate(() => [...document.querySelectorAll('.welcome video')].map(v => v.readyState));
    expect(loaded).toEqual(new Array(8).fill(0));
  });

  test('signed out, the account corner says Sign in, which brings the welcome page back', async ({ app, page }) => {
    await app.open();
    await skippedEarlier(page);
    await expect(page.locator('#acct-btn')).toBeHidden();
    await page.locator('#acct-signin').click();
    await expect(page.locator('#welcome')).toBeVisible();
  });

  test('connected with a development name only, a refresh still opens the first page', async ({ app, page }) => {
    await app.open();
    await skippedEarlier(page);
    await page.getByRole('tab', { name: 'My designs' }).click();
    await page.locator('#sync-setup').click();
    await page.locator('#sync-url').fill('http://127.0.0.1:9'); // nothing listens there: it stays connected, offline
    await page.locator('.sync-dev summary').click();
    await page.locator('#sync-user').fill('seed');
    await page.locator('#sync-connect').click();
    await expect(page.locator('#sync-state')).toContainText('seed');
    await page.evaluate(() => localStorage.removeItem('quilt-welcome.v1')); // a new visitor
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

test.describe('a first visit on a phone', () => {
  test.use({ welcome: true, viewport: { width: 375, height: 812 }, isMobile: true });

  test('the page takes the phone’s width: the name on one line, one plan under the other', async ({ app, page }) => {
    await app.open();
    expect(await page.evaluate(() => document.compatMode)).toBe('CSS1Compat'); // a whole document: not the old quirks mode
    expect(await page.evaluate(() => innerWidth)).toBe(375);
    const name = await page.locator('.w-logo b').boundingBox();
    const menu = await page.locator('.w-top nav').boundingBox();
    expect(name.height).toBeLessThan(45); // about 30 for one line
    expect(menu.x + menu.width).toBeLessThanOrEqual(375);
    const plans = await page.locator('.w-plan').evaluateAll(els => els.map(e => e.getBoundingClientRect().x));
    expect(plans[0]).toBe(plans[1]);
    expect(await page.locator('#welcome').evaluate(w => w.scrollWidth <= w.clientWidth)).toBe(true);
  });
});

test.describe('a first visit: the guided tour', () => {
  test.use({ welcome: true, firstVisit: true });

  test('waits for the welcome page to close', async ({ app, page }) => {
    await app.open();
    await page.waitForTimeout(2000); // the tour would have started by now
    await expect(page.locator('#tour')).toBeHidden();
    await signInPastWelcome(page);
    await expect(page.locator('#tour')).toBeVisible({ timeout: 5000 });
  });
});
