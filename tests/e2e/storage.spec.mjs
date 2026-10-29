// Storage in IndexedDB (storage/repo.js): what is kept after a reload, moving the old localStorage data, the
// record fields a future server needs, and fabric photos.
import { test, expect } from './fixtures.mjs';
import fs from 'fs';

const fixture = f => fs.readFileSync(new URL(`../fixtures/designs/${f}`, import.meta.url), 'utf8');
/** reads a store straight from IndexedDB (not the app's memory) */
const fromIdb = (page, store) =>
  page.evaluate(
    s =>
      new Promise((resolve, reject) => {
        const o = indexedDB.open('quilt');
        o.onsuccess = () => {
          const r = o.result.transaction(s).objectStore(s).getAll();
          r.onsuccess = () => resolve(r.result.map(x => ({ ...x, blob: x.blob ? x.blob.size : undefined })));
          r.onerror = () => reject(r.error);
        };
      }),
    store,
  );

test('changes are written to IndexedDB and are there after a reload', async ({ app, page }) => {
  await app.open();
  await page.locator('[data-step="c:-1"]').click();
  await app.storage(() => null); // flush
  const session = await fromIdb(page, 'session');
  expect(session.find(r => r.key === 'current').value.cols).toBe(4);
  await page.reload();
  await page.locator('#page-design').waitFor();
  expect((await app.current()).cols).toBe(4);
  expect(await page.locator('#dz-cols').inputValue()).toBe('4');
});

test('the data kept in localStorage before is moved over once', async ({ app, page }) => {
  const old = {
    'quilt-designer.v1': fixture('v0-before-block-sizes.json'),
    'quilt-mydesigns.v1': JSON.stringify([
      { id: 'qold1', name: 'Grandma’s star', d: fixture('v0-every-feature.json'), created: 1000, updated: 2000 },
      { id: 'qold2', name: 'Broken one', d: fixture('broken.json'), created: 3000, updated: 4000 },
    ]),
    'quilt-mydesigns-current.v1': 'qold1',
    'quilt-timeline.v1:qold1': JSON.stringify({ steps: [{ id: 1, d: '{}', label: 'Start', t: 1 }], i: 0, seq: 1 }),
    'quilt-medallion-seeded.v1': '1',
  };
  await page.addInitScript(o => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v);
  }, old);
  await app.open('mine');
  const designs = await app.storage(s => s.designs.list());
  const byId = Object.fromEntries(designs.map(d => [d.id, d]));
  expect(byId.qold1.name).toBe('Grandma’s star');
  expect(byId.qold1.design.v).toBe(1); // upgraded on the way in
  expect(byId.qold1.createdAt).toBe(1000);
  expect(byId.qold2.design.blocks[0].pattern).toBe('no-such-pattern'); // kept as it was: repaired when opened
  expect(byId.qmedallion).toBeUndefined(); // it had been seeded (and deleted) before: not brought back
  expect(byId.qphoto).toBeTruthy(); // never seeded before
  expect(await app.storage(s => s.getSession('mineCur'))).toBe('qold1');
  expect(await app.storage(s => s.timelines.get('qold1').steps.length)).toBe(1);
  await expect(page.locator('#mine-grid .pin')).toHaveCount(3);
  await expect(page.locator('#mine-grid .pin.current')).toContainText('Grandma’s star');
  // the old keys are left alone
  expect(await page.evaluate(() => localStorage.getItem('quilt-mydesigns.v1'))).toContain('qold1');
  // and the move happens only once: after a reload, a deleted design stays deleted
  await app.storage(s => s.designs.remove('qold2'));
  await page.reload();
  await page.locator('#page-mine').waitFor();
  await expect(page.locator('#mine-grid .pin')).toHaveCount(2);
});

test('saved designs carry what a server will need', async ({ app, page }) => {
  await app.open();
  await page.locator('#dz-save').click();
  await page.locator('#save-name').fill('Test quilt');
  await page.locator('#save-ok').click();
  let rec = (await app.storage(s => s.designs.list())).find(r => r.name === 'Test quilt');
  expect(rec.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(rec).toMatchObject({ rev: 1, deleted: false, dirty: true });
  expect(rec.updatedAt).toBeGreaterThanOrEqual(rec.createdAt);
  await page.locator('[data-step="r:-1"]').click();
  await page.locator('#dz-save').click();
  await page.locator('#save-ok').click();
  rec = await app.storage((s, id) => s.designs.get(id), rec.id);
  expect(rec.rev).toBe(2);
  expect(rec.design.rows).toBe(4);
  await app.storage((s, id) => s.designs.remove(id), rec.id);
  const stored = (await fromIdb(page, 'designs')).find(r => r.id === rec.id);
  expect(stored).toMatchObject({ deleted: true, design: null, rev: 3 }); // kept as a marker
});

test('a fabric from a photo is kept, under the same id for the same picture', async ({ app, page }) => {
  await app.open();
  const file = {
    name: 'Paisley scan.jpg',
    mimeType: 'image/jpeg',
    buffer: fs.readFileSync('assets/fabric/paisley.jpg'),
  };
  await page.locator('#dz-upload').setInputFiles(file);
  await expect.poll(() => app.storage(s => s.fabrics.list().length)).toBe(1);
  await page.locator('#dz-upload').setInputFiles(file); // the same picture again
  await page.waitForTimeout(500);
  const list = await app.storage(s => s.fabrics.list().map(f => ({ id: f.id, name: f.name, size: f.blob.size })));
  expect(list).toHaveLength(1);
  expect(list[0].id).toMatch(/^[fh][0-9a-f]+$/);
  expect(list[0].size).toBeGreaterThan(1000);
  await page.reload();
  await page.locator('#page-design').waitFor();
  await expect(page.locator('#dz-fabrics2 .fab', { hasText: 'Paisley scan' })).toHaveCount(1);
});
