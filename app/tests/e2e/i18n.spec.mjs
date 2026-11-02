// The app in Portuguese: it starts in the browser's language, the menu changes and remembers it, and no page shows
// English sentences left behind.
import { test, expect } from './fixtures.mjs';
import { BLOCKS } from '@quilt/shared/lang/pt-BR.js';

// words that are ordinary in English sentences and never appear in Portuguese ones
const ENGLISH = /\b(the|and|with|your|click|this|from|of|to|in the|is|are)\b/i;
// block names that keep their English on purpose, longest first
const KEPT = Object.entries(BLOCKS)
  .filter(([en, pt]) => en === pt)
  .map(([en]) => en)
  .sort((a, b) => b.length - a.length);

/** Text nodes and tooltips of the whole page that read as English. */
const englishLeft = page =>
  page.evaluate(
    ([source, kept]) => {
      const english = new RegExp(source, 'i'),
        found = new Set();
      const look = s => {
        const text = (s || '').replace(/\s+/g, ' ').trim();
        if (english.test(kept.reduce((rest, name) => rest.replaceAll(name, ''), text))) found.add(text);
      };
      const walk = el => {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        for (const a of ['title', 'aria-label', 'placeholder', 'alt']) if (el.hasAttribute(a)) look(el.getAttribute(a));
        for (const n of el.childNodes) {
          if (n.nodeType === 3) look(n.nodeValue);
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(document.body);
      return [...found];
    },
    [ENGLISH.source, KEPT],
  );

test.describe('a browser in Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('starts in Portuguese, and the menu goes to English and stays there', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Guia de corte');
    const menu = page.locator('#acct select[data-lang]');
    await expect(menu).toHaveValue('pt-BR');

    await menu.selectOption('en');
    await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Cutting guide');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Cutting guide');
    expect(app.errors).toEqual([]);
  });

  for (const pageName of ['design', 'cut', 'mine', 'community', 'sim'])
    test(`no English left on the ${pageName} page`, async ({ app, page }) => {
      await app.open(pageName);
      await page.waitForTimeout(500); // what is drawn just after opening
      expect(await englishLeft(page)).toEqual([]);
      expect(app.errors).toEqual([]);
    });

  test('the cutting guide writes decimals with a comma, and a quilt keeps working', async ({ app, page }) => {
    await app.open();
    await page.locator('#tabs [data-page="cut"]').click();
    const text = await page.locator('#page-cut').innerText();
    expect(text).toMatch(/\d,\d\d m/); // fabric to buy
    expect(text).not.toMatch(/\d\.\d\d m\b/);
    expect(app.errors).toEqual([]);
  });

  test('what is saved does not depend on the language', async ({ app, page }) => {
    await app.open();
    await page.locator('#dz-new').click();
    const saved = await app.current();
    await page.locator('#acct select[data-lang]').selectOption('en');
    await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Cutting guide');
    expect(await app.current()).toEqual(saved);
    expect(app.errors).toEqual([]);
  });

  test('the block library finds a block by its Portuguese or English name, with or without accents', async ({
    app,
    page,
  }) => {
    await app.open();
    await page.evaluate(() => /** @type {HTMLDialogElement} */ (document.querySelector('#blklib')).showModal());
    const box = page.locator('#blklib-q');
    for (const word of ['pinwheel', 'cata-vento', 'estrela de ohio']) {
      await box.fill(word);
      await box.dispatchEvent('input');
      await expect(page.locator('#blklib-grid button').first()).toBeVisible();
    }
    expect(app.errors).toEqual([]);
  });
});

test.describe('a browser in another language', () => {
  test.use({ locale: 'de-DE' });

  test('starts in English', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Cutting guide');
  });
});

test('a browser in English can choose Portuguese', async ({ app, page }) => {
  await app.open();
  await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Cutting guide');
  await page.locator('#acct select[data-lang]').selectOption('pt-BR');
  await expect(page.locator('#tabs [data-page="cut"]')).toHaveText('Guia de corte');
});
