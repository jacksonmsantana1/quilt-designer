// My quiltings and the camera: quilts to look at, and photos of real quilts.
import fs from 'node:fs';
import { test, expect, colourFile, FABRIC } from './fixture.mjs';

/** Takes a photo of a new quilt from the Camera tab. */
async function photoOfNewQuilt(phone, name, file) {
  const { page } = phone;
  await phone.tab('camera');
  await phone.pick(page.locator('#cam-shoot'), file);
  await page.locator('#album-name').fill(name);
  await page.locator('dialog[open] button[type=submit]').click();
  await expect(page.locator('.toast').last()).toContainText('Kept on this phone');
}

test('a quilt from the web comes with its drawing, only to look at', async ({ phone }) => {
  const { page, server } = phone;
  server.addDesign('Star of the sea');
  await phone.open();
  await phone.signIn();
  await phone.tab('quilts');
  const pin = page.locator('#quilts-board .pin');
  await expect(pin.locator('.by')).toContainText('5 × 5 blocks');
  await pin.click();
  const sheet = page.locator('dialog[open]');
  await expect(sheet.locator('h2')).toHaveText('Star of the sea');
  await expect(sheet).toContainText('To change it, open it on the web app.');
  await expect.poll(() => sheet.locator('canvas.large').evaluate(c => c.width)).toBeGreaterThan(300);
  // no way to design here
  await expect(sheet.getByRole('button', { name: /edit|change|design/i })).toHaveCount(0);
});

test('a photo with no design starts an album, kept on the phone, and goes up after signing in', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await photoOfNewQuilt(phone, 'Grandma’s quilt', await colourFile(page, 'teal'));
  await expect(page.locator('#recent .shot')).toHaveCount(1);
  await expect(page.locator('#recent .badge')).toHaveText('Waiting to upload');
  await expect(page.locator('#recent-wait')).toHaveText('1 waiting to upload');
  await phone.tab('quilts');
  const pin = page.locator('#quilts-board .pin');
  await expect(pin.locator('.name')).toHaveText('Grandma’s quilt');
  await expect(pin.locator('.by')).toContainText('1 photo');
  await expect(pin.locator('.badge')).toHaveText('Waiting to upload');
  await page.reload(); // it's kept
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .pin .name')).toHaveText('Grandma’s quilt');
  await phone.signIn();
  await expect(page.locator('#quilts-board .pin .badge')).toHaveCount(0);
  const [sent] = [...server.photos.values()];
  expect(sent.album).toBe('Grandma’s quilt');
  expect(sent.done).toBe(true);
});

test('a photo is sent without what the camera recorded, and no larger than 2000 px', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  // a real JPEG with a location written in it, the way a phone's camera does
  const jpeg = fs.readFileSync(FABRIC),
    words = Buffer.from('Exif\0\0GPSLatitude-secret-place'),
    len = Buffer.alloc(2);
  len.writeUInt16BE(words.length + 2);
  const withLocation = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, words, jpeg.subarray(2)]);
  expect(withLocation.includes('secret-place')).toBe(true);
  await photoOfNewQuilt(phone, 'One', { name: 'a.jpg', mimeType: 'image/jpeg', buffer: withLocation });
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => server.stored.size).toBe(1);
  const [kept] = [...server.stored.values()];
  expect(kept.includes('secret-place')).toBe(false);
  expect(kept.includes('Exif')).toBe(false);
  await page.locator('dialog[open] .close').click();

  await photoOfNewQuilt(phone, 'Two', await colourFile(page, 'navy', 'big.jpg', 3000, 1000));
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => server.stored.size).toBe(2);
  const big = [...server.stored.values()][1].toString('base64');
  const size = await page.evaluate(async b => {
    const bytes = Uint8Array.from(atob(b), c => c.charCodeAt(0));
    const bm = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    return [bm.width, bm.height];
  }, big);
  expect(size).toEqual([2000, 667]);
  await page.locator('dialog[open] .close').click();
});

test('a photo can be added to a saved quilt, opened large and deleted, here and on the server', async ({ phone }) => {
  const { page, server } = phone;
  server.addDesign('Star of the sea');
  await phone.open();
  await phone.signIn();
  await phone.tab('quilts');
  await page.locator('#quilts-board .pin').click();
  const sheet = page.locator('dialog[open]');
  await expect(sheet).toContainText('No photos yet.');
  await phone.pick(sheet.getByRole('button', { name: 'From my photos' }), await colourFile(page, 'teal'));
  await expect(sheet.locator('.shot')).toHaveCount(1);
  await sheet.locator('.close').click();
  await expect(page.locator('#quilts-board .pin .photo')).toBeVisible();
  await expect(page.locator('#quilts-board .pin canvas.inset')).toHaveCount(1); // the drawing goes in the corner
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => [...server.photos.values()].filter(p => p.done).length).toBe(1);
  await page.locator('dialog[open] .close').click();

  await page.locator('#quilts-board .pin').click();
  await page.locator('dialog[open] .shot').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await page.locator('#viewer-delete').click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(page.locator('#viewer')).toBeHidden();
  await expect(page.locator('dialog[open]')).toContainText('No photos yet.');
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('#quilts-board .pin .photo')).toHaveCount(0);
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => server.photos.size).toBe(0);
  await page.locator('dialog[open] .close').click();
});

test('a photo deleted on another device goes from here too; one taken there comes here', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  await photoOfNewQuilt(phone, 'Mine', await colourFile(page, 'teal'));
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => [...server.photos.values()].filter(p => p.done).length).toBe(1);
  server.photos.clear();
  server.photos.set('elsewhere', {
    id: 'elsewhere',
    quiltId: 'a-other',
    album: 'From my tablet',
    takenAt: 1_780_000_000_000,
    url: 'https://pictures.test/p.jpg',
    done: true,
  });
  await page.getByRole('button', { name: 'Sync now' }).click();
  await page.locator('dialog[open] .close').click();
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .name')).toHaveText(['From my tablet']);
});

test('changing their mind in the file picker or the quilt question keeps nothing', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('camera');
  await phone.pick(page.locator('#cam-shoot'), await colourFile(page, 'teal'));
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('#recent .shot')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('an album’s next photo can go in the same album', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await photoOfNewQuilt(phone, 'Grandma’s quilt', await colourFile(page, 'teal'));
  await phone.pick(page.locator('#cam-shoot'), await colourFile(page, 'red'));
  await page.getByRole('button', { name: 'Grandma’s quilt' }).click();
  await phone.tab('quilts');
  await expect(page.locator('#quilts-board .pin')).toHaveCount(1);
  await expect(page.locator('#quilts-board .pin .by')).toContainText('2 photos');
});

test('the switch says what the photo is of, and the same buttons take a fabric', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('camera');
  await expect(page.locator('#cam-title')).toHaveText('A photo of a real quilt');
  await expect(page.locator('#recent-wait')).toBeHidden();
  await page.getByRole('button', { name: 'A fabric' }).click();
  await expect(page.locator('#cam-kind-fabric')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#cam-kind-quilt')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#cam-title')).toHaveText('A photo of a fabric');
  await expect(page.locator('#cam-shape')).toBeVisible(); // the cut piece's shape, 15 × 15 cm to begin with
  await expect(page.locator('#cam-icon-quilt')).toBeHidden();
  await phone.pick(page.locator('#cam-pick'), await colourFile(page, 'blue'));
  await expect(page.locator('#crop-box')).toBeVisible();
});

test('a file that isn’t a picture is explained', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('camera');
  await phone.pick(page.locator('#cam-shoot'), {
    name: 'notes.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('not a picture'),
  });
  await expect(page.locator('.toast')).toHaveText('That picture could not be read.');
});
