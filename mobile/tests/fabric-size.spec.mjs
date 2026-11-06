// A cut piece of fabric at its real size: its size typed in the Camera tab, framed live in its shape (Chromium's
// made-up camera here), cropped in that shape, and kept with the piece's width as the photo's width.
import { test, expect, colourFile } from './fixture.mjs';

/** The fabric records kept on the phone: name, width in cm, and the picture's width / height. */
const kept = page =>
  page.evaluate(
    () =>
      new Promise(done => {
        const o = indexedDB.open('quilt');
        o.onsuccess = () => {
          const all = o.result.transaction('fabrics', 'readonly').objectStore('fabrics').getAll();
          all.onsuccess = async () => {
            const out = [];
            for (const f of all.result.filter(r => !r.deleted)) {
              const bm = await createImageBitmap(f.blob);
              out.push({
                name: f.name,
                cm: Math.round(f.cm * 100) / 100,
                aspect: Math.round((bm.width / bm.height) * 100) / 100,
              });
            }
            done(out);
          };
        };
      }),
  );

/** The shape of something on the screen, width / height. */
const shape = async loc => {
  const b = await loc.boundingBox();
  return Math.round((b.width / b.height) * 100) / 100;
};

async function fabricMode(phone, w, h) {
  const { page } = phone;
  await phone.tab('camera');
  await page.locator('#cam-kind-fabric').click();
  await page.locator('#cam-w').fill(w);
  await page.locator('#cam-h').fill(h);
}

test('a 20 × 10 cm piece is framed live in its shape, and kept 20 cm wide', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await fabricMode(phone, '20', '10');
  await expect(page.locator('#cam-shape-label')).toHaveText('20 × 10 cm');
  expect(await shape(page.locator('#cam-shape'))).toBeCloseTo(2, 1);
  await page.locator('#cam-shoot').click();
  // the camera inside the app, with the piece's frame over it
  await expect(page.locator('#live-video')).toBeVisible();
  await expect.poll(() => page.locator('#live-video').evaluate(v => v.videoWidth)).toBeGreaterThan(0);
  await expect(page.locator('#live-frame')).toContainText('20 × 10 cm');
  expect(await shape(page.locator('#live-frame'))).toBeCloseTo(2, 1);
  await page.locator('#live-shoot').click();
  // cropping starts where it was framed, and keeps the shape
  await expect(page.locator('#crop-box')).toBeVisible();
  expect(await shape(page.locator('#crop-box'))).toBeCloseTo(2, 1);
  await page.locator('#crop-done').click();
  await expect(page.locator('#new-size')).toHaveText('Its real size: 20 × 10 cm');
  await page.locator('#new-save').click();
  await expect.poll(() => kept(page)).toEqual([{ name: 'Fabric 1', cm: 20, aspect: 2 }]);
  // the camera is off again
  expect(await page.evaluate(() => document.querySelectorAll('video').length)).toBe(0);
});

test('closing the camera keeps nothing', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await fabricMode(phone, '15', '15');
  await page.locator('#cam-shoot').click();
  await expect(page.locator('#live-video')).toBeVisible();
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await kept(page)).toEqual([]);
});

test('a piece in inches, from the photos, is cropped in its shape and kept in cm; the size is remembered', async ({
  phone,
}) => {
  const { page } = phone;
  await phone.open();
  await fabricMode(phone, '6', '4,5');
  await page.locator('#cam-unit-in').click();
  await expect(page.locator('#cam-shape-label')).toHaveText('6 × 4.5 in');
  await phone.pick(page.locator('#cam-pick'), await colourFile(page, 'teal', 't.jpg', 800, 600));
  await expect(page.locator('#crop-box')).toBeVisible();
  expect(await shape(page.locator('#crop-box'))).toBeCloseTo(1.33, 1);
  await page.locator('#crop-done').click();
  await expect(page.locator('#new-size')).toHaveText('Its real size: 6 × 4.5 in');
  await page.locator('#new-save').click();
  await expect.poll(() => kept(page)).toEqual([{ name: 'Fabric 1', cm: 15.24, aspect: 1.33 }]);
  await page.reload();
  await phone.tab('camera');
  await page.locator('#cam-kind-fabric').click();
  await expect(page.locator('#cam-w')).toHaveValue('6');
  await expect(page.locator('#cam-h')).toHaveValue('4,5');
  await expect(page.locator('#cam-unit-in')).toHaveAttribute('aria-pressed', 'true');
});

test('with no size, a whole fabric is cropped square as before; a wrong size is said, and opens nothing', async ({
  phone,
}) => {
  const { page } = phone;
  await phone.open();
  await fabricMode(phone, '0', '15');
  await expect(page.locator('#cam-size-said')).toHaveText('Type the width and the height of the piece.');
  await page.locator('#cam-shoot').click();
  await expect(page.locator('.toast').last()).toHaveText('Type the width and the height of the piece.');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('#cam-w').fill('400');
  await expect(page.locator('#cam-size-said')).toHaveText('A piece can be from 1 to 300 cm on each side.');
  await page.locator('#cam-w').fill('');
  await page.locator('#cam-h').fill('');
  await expect(page.locator('#cam-shape')).toBeHidden();
  await expect(page.locator('#cam-icon-fabric')).toBeVisible();
  await phone.pick(page.locator('#cam-pick'), await colourFile(page, 'red', 'r.jpg', 800, 600));
  expect(await shape(page.locator('#crop-box'))).toBeCloseTo(1, 1);
  await page.locator('#crop-done').click();
  await expect(page.locator('#new-size')).toHaveCount(0);
  await page.locator('#new-save').click();
  await expect.poll(() => kept(page)).toEqual([{ name: 'Fabric 1', cm: 30, aspect: 1 }]);
});

test('a fabric’s real size can be corrected in its sheet, and goes to the server', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  await fabricMode(phone, '20', '10');
  await phone.pick(page.locator('#cam-pick'), await colourFile(page, 'blue', 'b.jpg', 800, 600));
  await page.locator('#crop-done').click();
  await page.locator('#new-save').click();
  await phone.tab('fabrics');
  await page.locator('#fab-board .fab', { hasText: 'Fabric 1' }).click();
  await expect(page.locator('#fabric-w')).toHaveValue('20');
  await expect(page.locator('#fabric-h')).toHaveValue('10');
  await page.locator('#fabric-h').fill('12');
  await page.locator('#fabric-h').press('Enter');
  await page.locator('#fabric-h').blur();
  await expect(page.locator('#fabric-w')).toHaveValue('24');
  await expect(page.locator('#fabric-size-said')).toHaveText('Its quilts show it at 24 × 12 cm now.');
  await expect.poll(() => kept(page)).toEqual([{ name: 'Fabric 1', cm: 24, aspect: 2 }]);
  await expect.poll(() => [...server.fabrics.values()].map(f => f.cm), { timeout: 15_000 }).toEqual([24]);
});
