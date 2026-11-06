// My fabrics: adding one quickly, colours, details, and folders.
import { test, expect, colourFile } from './fixture.mjs';

const names = page => page.locator('#fab-board .fab-name');
const chip = (page, text) => page.locator('#fab-views .chip', { hasText: text });

/** Makes a folder from the chip row. */
async function newFolder(page, name) {
  await page.locator('#new-folder').click();
  await page.locator('#folder-name').fill(name);
  await page.locator('dialog[open] button[type=submit]').click();
}

test('adding a fabric: photo, crop, done; a square part of the photo is kept, and sorted by colour', async ({
  phone,
}) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await expect(page.locator('#fab-empty')).toContainText('No fabrics yet');
  await phone.pick(page.locator('#add-fabric'), await colourFile(page, 'blue', 'b.jpg', 400, 300));
  await expect(page.locator('#crop-box')).toBeVisible();
  await page.locator('#crop-done').click();
  await expect(page.locator('#new-name')).toHaveValue('Fabric 1');
  await page.locator('#new-save').click(); // nothing else is needed
  await expect(names(page)).toHaveText(['Fabric 1']);
  const img = page.locator('#fab-board .fab:not(.add) img');
  await expect
    .poll(() => img.evaluate(i => [i.naturalWidth === i.naturalHeight, i.naturalWidth > 200]))
    .toEqual([true, true]);
  await phone.addFabric('red', 'Red one');
  await phone.addFabric('rgb(40,150,60)', 'Green one');
  // sorted by colour, whatever order they were added in
  await expect.poll(() => names(page).allTextContents()).toEqual(['Red one', 'Green one', 'Fabric 1']);
});

test('dragging the crop square frames another part of the photo', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  // half red and half blue: the crop decides which one the fabric is
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = 'red';
    g.fillRect(0, 0, 400, 200);
    g.fillStyle = 'blue';
    g.fillRect(400, 0, 400, 200);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  await phone.pick(page.locator('#add-fabric'), {
    name: 'two.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(data, 'base64'),
  });
  const box = page.locator('#crop-box');
  await expect(box).toBeVisible();
  const b = await box.boundingBox(),
    stage = await page.locator('.crop-stage').boundingBox();
  await page.mouse.move(b.x + b.width / 3, b.y + b.height / 3);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width, b.y + b.height / 3, { steps: 4 }); // all the way to the right
  await page.mouse.up();
  await page.locator('#crop-done').click();
  await page.locator('#new-name').fill('From the right');
  await page.locator('#new-save').click();
  await page.locator('#fab-colours .dot[aria-label="Blue"]').click();
  await expect(names(page)).toHaveText(['From the right']);
  await page.locator('#fab-colours .dot[aria-label="Blue"]').click();
  await page.locator('#fab-colours .dot[aria-label="Red"]').click();
  await expect(names(page)).toHaveCount(0);
});

test('colour dots and the search find fabrics, also inside a folder', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose', { place: 'Box 1' });
  await phone.addFabric('blue', 'Sky', { amount: '2 m' });
  const red = page.locator('#fab-colours .dot[aria-label="Red"]');
  await expect
    .poll(async () => {
      await red.click();
      const shown = await names(page).allTextContents();
      await red.click();
      return shown;
    })
    .toEqual(['Rose']);
  await red.click();
  await expect(page.locator('#add-fabric')).toBeVisible();
  await expect(names(page)).toHaveText(['Rose']);
  await red.click();
  await expect(names(page)).toHaveCount(2);
  await page.locator('#q').fill('box 1');
  await expect(names(page)).toHaveText(['Rose']);
  await page.locator('#q').fill('2 m');
  await expect(names(page)).toHaveText(['Sky']);
  await page.locator('#q').fill('velvet');
  await expect(page.locator('#fab-empty')).toHaveText('No fabrics match.');
  await page.locator('#q').fill('');
  await expect(names(page)).toHaveCount(2);

  await newFolder(page, 'Spring');
  await page.locator('#folder-add').click();
  await page.locator('dialog[open] .fab', { hasText: 'Rose' }).click();
  await page.locator('dialog[open] .fab', { hasText: 'Sky' }).click();
  await page.locator('#pick-done').click();
  await expect(names(page)).toHaveCount(2);
  await page.locator('#q').fill('sky');
  await expect(names(page)).toHaveText(['Sky']);
  await page.locator('#q').fill('');
  await expect(names(page)).toHaveCount(2);
  await red.click();
  await expect(names(page)).toHaveText(['Rose']);
});

test('a fabric’s details and name are kept as they’re typed, and go to the server', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');
  await page.locator('#fab-board .fab', { hasText: 'Rose' }).click();
  await page.locator('#fabric-amount').fill('Fat quarter');
  await page.locator('#fabric-place').fill('Box 3');
  await page.locator('#fabric-name').fill('Deep rose');
  await page.locator('dialog[open] .close').click();
  await expect(page.locator('#fab-board .fab-name')).toHaveText(['Deep rose']);
  await expect(page.locator('#fab-board .fab-note')).toHaveText('Fat quarter · Box 3');
  // the new name written down on the phone before the reload: a reload a moment after typing could cut that write
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise(done => {
            const o = indexedDB.open('quilt');
            o.onsuccess = () => {
              const all = o.result.transaction('fabrics', 'readonly').objectStore('fabrics').getAll();
              all.onsuccess = () => done(all.result.map(f => f.name));
            };
          }),
      ),
    )
    .toEqual(['Deep rose']);
  await page.reload();
  await phone.tab('fabrics');
  await expect(page.locator('#fab-board .fab-name')).toHaveText(['Deep rose']);
  await expect(page.locator('#fab-board .fab-note')).toHaveText('Fat quarter · Box 3');
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => [...server.notes.values()].map(n => [n.amount, n.place])).toEqual([['Fat quarter', 'Box 3']]);
  await expect.poll(() => [...server.fabrics.values()].map(f => f.name)).toEqual(['Deep rose']);
});

test('a folder can be made while adding a fabric, and a fabric can be in several', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.pick(page.locator('#add-fabric'), await colourFile(page, 'red'));
  await page.locator('#crop-done').click();
  await page.locator('dialog[open]').getByRole('button', { name: '+ Folder' }).click();
  await page.locator('#folder-name').fill('Christmas');
  await page.locator('dialog[open] button[type=submit]').click();
  await page.locator('dialog[open]').getByRole('button', { name: '+ Folder' }).click();
  await page.locator('#folder-name').fill('Reds');
  await page.locator('dialog[open] button[type=submit]').click();
  await page.locator('#new-save').click();
  await expect(chip(page, 'Christmas')).toHaveText('Christmas · 1');
  await expect(chip(page, 'Reds')).toHaveText('Reds · 1');
});

test('inside a folder, “Add fabrics” ticks several at once, and the app’s own fabrics can go in too', async ({
  phone,
}) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');
  await phone.addFabric('blue', 'Sky');
  await newFolder(page, 'Spring');
  await expect(page.locator('#fab-empty')).toContainText('This folder is empty');
  await page.locator('#folder-add').click();
  await expect(page.locator('#pick-done')).toBeDisabled();
  await page.locator('dialog[open] .fab', { hasText: 'Rose' }).click();
  await expect(page.locator('#pick-done')).toHaveText('Add 1 fabric');
  await page.locator('#pick-app').click();
  await page.locator('dialog[open] .fab').first().click();
  await expect(page.locator('#pick-done')).toHaveText('Add 2 fabrics');
  await page.locator('#pick-done').click();
  await expect(names(page)).toHaveCount(2);
  await expect(chip(page, 'Spring')).toHaveText('Spring · 2');
  await expect
    .poll(() =>
      page.locator('#fab-board canvas').evaluate(c => {
        const d = c.getContext('2d').getImageData(0, 0, 1, 1).data;
        return d[3];
      }),
    )
    .toBe(255); // the app's fabric is drawn on the tile
});

test('press and hold chooses several, which go to a folder; taking them out deletes nothing', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');
  await phone.addFabric('blue', 'Sky');
  await phone.addFabric('green', 'Leaf');
  const tile = name => page.locator('#fab-board .fab', { hasText: name });
  await phone.hold(tile('Rose'));
  await expect(page.locator('#fab-chosen')).toContainText('One chosen');
  await expect(page.locator('#fab-chosen')).not.toContainText('null');
  await tile('Sky').click();
  await expect(page.locator('#fab-chosen')).toContainText('2 chosen');
  await tile('Rose').click();
  await tile('Leaf').click();
  await expect(page.locator('#fab-chosen')).toContainText('2 chosen');
  await page.locator('#chosen-add').click();
  await page.locator('#new-folder-name').fill('Cool');
  await page.locator('dialog[open] button[type=submit]').click();
  await expect(page.locator('#fab-chosen')).toBeHidden();
  await expect(chip(page, 'Cool')).toHaveText('Cool · 2');

  // the view of what's in no folder
  await page.locator('#view-loose').click();
  await expect(names(page)).toHaveText(['Rose']);

  // out of the folder, not deleted
  await chip(page, 'Cool').click();
  await expect(names(page)).toHaveCount(2);
  await phone.hold(tile('Sky'));
  await page.locator('#chosen-out').click();
  await expect(names(page)).toHaveText(['Leaf']);
  await page.locator('#view-all').click();
  await expect(names(page)).toHaveCount(3);
  // a tap doesn't open a fabric while choosing, and Cancel ends it
  await phone.hold(tile('Rose'));
  await page.locator('#chosen-cancel').click();
  await expect(page.locator('#fab-chosen')).toBeHidden();
  await tile('Rose').click();
  await expect(page.locator('dialog[open] h2')).toHaveText('Rose');
});

test('folders can be renamed, reordered and deleted, and deleting one deletes no fabric', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');
  await newFolder(page, 'First');
  await page.locator('#view-all').click();
  await newFolder(page, 'Second');
  await page.locator('#folder-rename').click();
  await page.locator('#folder-name').fill('Later');
  await page.locator('dialog[open] button[type=submit]').click();
  await expect(chip(page, 'Later')).toBeVisible();
  await page.locator('#manage-folders').click();
  await page.getByRole('button', { name: 'Move “Later” up' }).click();
  await expect(page.locator('dialog[open] .folder-row .grow')).toHaveText(['Later', 'First']);
  await page.locator('dialog[open] .close').click();
  await page.reload();
  await phone.tab('fabrics');
  await expect(page.locator('#fab-views .chip')).toHaveText([
    'All my fabrics',
    'Not in a folder',
    'Later · 0',
    'First · 0',
    'The app’s fabrics',
    '+ Folder',
    'Arrange folders',
  ]);
  await chip(page, 'First').click();
  await page.locator('#folder-delete').click();
  await expect(page.locator('dialog[open]')).toContainText('The fabrics in it are not deleted.');
  await page.locator('dialog[open] .ask-yes').click();
  await expect(chip(page, 'First')).toHaveCount(0);
  await expect(names(page)).toHaveText(['Rose']);
});

test('folders go to the server, and a folder from another device comes here', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  await phone.tab('fabrics');
  await newFolder(page, 'Spring');
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => [...server.folders.values()].map(f => [f.name, f.deleted])).toEqual([['Spring', false]]);
  const id = crypto.randomUUID();
  server.folders.set(id, { id, name: 'From my tablet', fabricIds: ['c1'], position: 5, deleted: false, updatedAt: 1 });
  await page.getByRole('button', { name: 'Sync now' }).click();
  await page.locator('dialog[open] .close').click();
  await expect(chip(page, 'From my tablet')).toHaveText('From my tablet · 1');
  await chip(page, 'From my tablet').click();
  await expect(names(page)).toHaveCount(1);
  // deleted on the other device
  server.folders.set(id, { ...server.folders.get(id), deleted: true, updatedAt: 2 });
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await page.locator('dialog[open] .close').click();
  await expect(chip(page, 'From my tablet')).toHaveCount(0);
});

test('deleting a fabric asks first, warns when a quilt uses it, and leaves its folders', async ({ phone }) => {
  const { page, server } = phone;
  await phone.open();
  await phone.signIn();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'Rose');
  const id = await page.evaluate(() => 0); // (the id is the photo's fingerprint: read back from the server's copy)
  expect(id).toBe(0);
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => server.fabrics.size).toBe(1);
  await page.locator('dialog[open] .close').click();
  const [fabricId] = [...server.fabrics.keys()];
  const base = (await import('@quilt/shared/design.js')).defaultDesign();
  server.addDesign('Uses it', {
    ...base,
    blocks: base.blocks.map(b => ({ ...b, fabrics: b.fabrics.map(() => fabricId) })),
  });
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await page.locator('dialog[open] .close').click();
  await newFolder(page, 'Reds');
  await page.locator('#folder-add').click();
  await page.locator('dialog[open] .fab', { hasText: 'Rose' }).click();
  await page.locator('#pick-done').click();
  await expect(chip(page, 'Reds')).toHaveText('Reds · 1');

  await page.locator('#fab-board .fab', { hasText: 'Rose' }).click();
  await page.locator('#delete-fabric').click();
  await expect(page.locator('dialog[open]').last()).toContainText('Uses it uses this fabric');
  await page.locator('dialog[open] .ask-no').click();
  await expect(page.locator('#delete-fabric')).toBeVisible();
  await page.locator('#delete-fabric').click();
  await page.locator('dialog[open] .ask-yes').click();
  await expect(names(page)).toHaveCount(0);
  await expect(chip(page, 'Reds')).toHaveText('Reds · 0');
  await page.locator('#me').click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect.poll(() => server.fabrics.get(fabricId).deleted).toBe(true);
  await page.locator('dialog[open] .close').click();
});

test('a tile’s picture starts at its top, whatever the height of the row', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await phone.addFabric('red', 'A fabric with a very long name that takes up several lines', { amount: '2 m' });
  await phone.addFabric('blue', 'Sky');
  const tops = await page
    .locator('#fab-board .fab:not(.add)')
    .evaluateAll(all =>
      all.map(t => t.querySelector('img').getBoundingClientRect().top - t.getBoundingClientRect().top),
    );
  expect(new Set(tops.map(Math.round)).size).toBe(1);
});

test('the app’s 1500 fabrics come a page at a time, by colour, and can’t be deleted', async ({ phone }) => {
  const { page } = phone;
  await phone.open();
  await phone.tab('fabrics');
  await page.locator('#view-app').click();
  await expect(page.locator('#add-fabric')).toHaveCount(0);
  await expect(names(page)).toHaveCount(60);
  await page.locator('#fab-more').click();
  await expect(names(page)).toHaveCount(120);
  await page.locator('#fab-colours .dot[aria-label="Blue"]').click();
  await expect(names(page)).toHaveCount(60);
  await names(page).first().click();
  await expect(page.locator('#fabric-name')).toBeDisabled();
  await expect(page.locator('#delete-fabric')).toHaveCount(0);
  await expect(page.locator('dialog[open]')).not.toContainText('false');
});

test.describe('in Portuguese', () => {
  test.use({ locale: 'pt-BR' });
  test('colours and folders speak Portuguese', async ({ phone }) => {
    const { page } = phone;
    await phone.open();
    await phone.tab('fabrics');
    await expect(page.locator('#view-all')).toHaveText('Todos os meus tecidos');
    await expect(page.locator('#fab-colours .dot[aria-label="Vermelho"]')).toBeVisible();
    await expect(page.locator('#add-fabric')).toHaveText('+ Adicionar tecido');
  });
});
