// New fabric from the camera: Chromium's fake webcam (a moving test pattern) on a secure origin, and the
// photo-file fallback. The dialog is opened through its button's click handler (see the note in the report).
import { test, expect } from './fixtures.mjs';
import fs from 'fs';

const openCamera = page => page.locator('.cam-open').first().dispatchEvent('click');
const paisley = { name: 'paisley.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync('assets/fabric/paisley.jpg') };

// Chromium's fake webcam for this file (it needs its own browser)
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

test.describe('with a webcam', () => {
  test.use({
    origin: 'http://localhost',
    permissions: ['camera'],
  });

  test('take a picture, review it, retake, and use it as a fabric', async ({ app, page }) => {
    await app.open();
    // select the centre square of block 0 first: the new fabric goes straight onto it
    const c = await app.blockCentre(await app.current(), 0);
    await page.mouse.click(c.x, c.y);
    const box = await page.locator('#dz-block').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await openCamera(page);
    await expect(page.locator('#cam-dialog')).toBeVisible();
    // permission already granted: straight to the live picture
    await expect(page.locator('#cam-snap')).toBeEnabled({ timeout: 15_000 });
    await page.locator('#cam-snap').click();
    await expect(page.locator('#cam-review')).toBeVisible();
    await expect(page.locator('#cam-name')).toHaveValue(/^Photo fabric \d+$/);
    await page.locator('#cam-retake').click();
    await expect(page.locator('#cam-snap')).toBeEnabled({ timeout: 15_000 });
    await page.locator('#cam-snap').click();
    await page.locator('#cam-name').fill('Test card');
    await page.locator('#cam-cm').fill('12');
    await page.locator('#cam-fix').check(); // even out the light and make it repeat seamlessly
    await page.locator('#cam-use').click();
    await expect(page.locator('#cam-dialog')).toBeHidden();
    // the photo is stored once its hash is worked out, just after the dialog closes
    await expect.poll(() => app.storage(s => s.fabrics.list().length)).toBe(1);
    const fab = await app.storage(s => s.fabrics.list().map(f => ({ id: f.id, name: f.name, cm: f.cm })));
    expect(fab).toEqual([{ id: expect.stringMatching(/^f[0-9a-f]{24}$/), name: 'Test card', cm: 12 }]); // sha-256 here
    expect((await app.current()).blocks[0].fabrics).toContain(fab[0].id);
    await expect(page.locator('#dz-fabnote')).toContainText('kept in this browser');
  });

  test('closing the dialog stops the camera', async ({ app, page }) => {
    await app.open();
    await openCamera(page);
    await expect(page.locator('#cam-snap')).toBeEnabled({ timeout: 15_000 });
    await page.locator('#cam-close').click();
    await expect(page.locator('#cam-dialog')).toBeHidden();
    expect(await page.locator('#cam-video').evaluate(v => v.srcObject)).toBeNull();
  });
});

test('without a camera (not a secure page): the dialog explains, and a photo file works instead', async ({
  app,
  page,
}) => {
  await app.open();
  await openCamera(page);
  await expect(page.locator('#cam-ask-note')).toContainText('does not offer a camera');
  await expect(page.locator('#cam-allow')).toBeHidden();
  await page.locator('#cam-file2').setInputFiles(paisley);
  await expect(page.locator('#cam-review')).toBeVisible();
  await page.locator('#cam-use').click();
  // no part was selected: the new fabric becomes the active one in the palette
  await expect.poll(() => app.storage(s => s.fabrics.list().length)).toBe(1);
  expect(await app.storage(s => s.fabrics.list()[0].id)).toMatch(/^h[0-9a-f]{16}$/); // the simple hash on plain http
});

test('a photo file from the live-camera view', async ({ app, page }) => {
  await app.open();
  await openCamera(page);
  await page.locator('#cam-file').setInputFiles(paisley);
  await expect(page.locator('#cam-review')).toBeVisible();
  await page.locator('#cam-retake').click(); // no live camera was used: back to the first step
  await expect(page.locator('#cam-ask')).toBeVisible();
});
