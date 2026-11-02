// What protects the page itself: the security policy (the fixtures serve every page with it, so all the other browser
// tests also show it doesn't get in the app's way), and the libraries' fingerprints.
import { test, expect } from './fixtures.mjs';

const CDN = 'https://cdn.jsdelivr.net/npm/';

test('a script put into the page does not run; the app’s own do', async ({ app, page }) => {
  await app.open();
  const ran = await page.evaluate(async () => {
    const s = document.createElement('script');
    s.textContent = 'window.__injected = true;';
    document.head.appendChild(s);
    const img = document.createElement('img');
    img.setAttribute('onerror', 'window.__injected = true;');
    img.src = 'data:,';
    document.body.appendChild(img);
    await new Promise(r => setTimeout(r, 100));
    img.remove();
    return !!window.__injected;
  });
  expect(ran).toBe(false);
  await expect(page.locator('#page-design')).toBeVisible();
  expect(app.errors).toEqual([]);
});

test('a script from anywhere else, or another package of the CDN, does not load', async ({ app, page }) => {
  await app.open();
  // answered if asked for: only the policy can stop them, not the tests' own "no network"
  const body = 'window.__loaded = true;';
  await page.route('https://evil.example/**', r => r.fulfill({ body, contentType: 'text/javascript' }));
  await page.route(`${CDN}other-package@*/**`, r => r.fulfill({ body, contentType: 'text/javascript' }));
  const load = src =>
    page.evaluate(
      u =>
        new Promise(done => {
          let blocked = '';
          document.addEventListener('securitypolicyviolation', e => (blocked = e.violatedDirective), { once: true });
          const s = document.createElement('script');
          s.src = u;
          s.onload = () => done('loaded');
          s.onerror = () => setTimeout(() => done(blocked || 'failed'), 50);
          document.head.appendChild(s);
        }),
      src,
    );
  expect(await load('https://evil.example/steal.js')).toMatch(/^script-src/);
  expect(await load(`${CDN}other-package@1.0.0/index.js`)).toMatch(/^script-src/);
  expect(await page.evaluate(() => !!window.__loaded)).toBe(false);
});

test('a library that does not match its fingerprint is refused', async ({ app, page }) => {
  expect(app).toBeTruthy();
  const url = `${CDN}three@0.183.2/build/three.core.js`;
  await page.route(url, r => r.fulfill({ body: 'export const tampered = true;', contentType: 'text/javascript' }));
  await page.goto('http://x/');
  const got = await page.evaluate(
    u => import(u).then(m => ('tampered' in m ? 'loaded' : 'other')).catch(() => 'refused'),
    url,
  );
  expect(got).toBe('refused');
});

test('the built page lists a fingerprint for the libraries it loads, Auth0’s too', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../../quilt.html', import.meta.url), 'utf8');
  const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]);
  const urls = Object.keys(map.integrity);
  for (const part of ['three@0.183.2/build/three.module.js', 'three@0.183.2/build/three.core.js', 'auth0-spa-js'])
    expect(urls.some(u => u.includes(part))).toBe(true);
  expect(Object.values(map.integrity).every(v => /^sha384-[A-Za-z0-9+/]+=*$/.test(String(v)))).toBe(true);
});
