// The block editor: draw a block on a grid of cells from the block library, use it in the quilt, and find it again
// under "My blocks". The drawing is kept in the quilt (design.drawn), so it survives a reload.
import { test, expect } from './fixtures.mjs';

test.beforeEach(async ({ app }) => app.open());

async function openDrawer(app, page) {
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('#dz-side')).toBeVisible();
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-draw').click();
  await expect(page.locator('#drawblk')).toBeVisible();
  await expect(page.locator('#blklib')).toBeHidden();
}

/** On graph paper: like onGrid, but the block starts after the rulers (24 pixels). */
async function onPaper(page, n, x, y, x2, y2) {
  const box = await page.locator('#drawblk-canvas').boundingBox(),
    size = box.width - 24,
    at = (cx, cy) => [box.x + 24 + (cx / n) * size, box.y + 24 + (cy / n) * size];
  await page.mouse.move(...at(x, y));
  await page.mouse.down();
  if (x2 !== undefined) await page.mouse.move(...at(x2, y2), { steps: 6 });
  await page.mouse.up();
}

/** Clicks the editor's grid at (x, y) in cells; drags to (x2, y2) when given. */
async function onGrid(page, n, x, y, x2, y2) {
  const box = await page.locator('#drawblk-canvas').boundingBox(),
    at = (cx, cy) => [box.x + (cx / n) * box.width, box.y + (cy / n) * box.height];
  await page.mouse.move(...at(x, y));
  await page.mouse.down();
  if (x2 !== undefined) await page.mouse.move(...at(x2, y2), { steps: 4 });
  await page.mouse.up();
}

test('draw a block with mirror symmetry and use it in the quilt; it stays after a reload', async ({ app, page }) => {
  await openDrawer(app, page);
  await expect(page.locator('#drawblk-name')).toHaveValue('My block 1');
  await page.locator('#drawblk-tools [data-tool="/"]').click();
  await page.locator('#drawblk-roles [data-role="1"]').click();
  await page.locator('#drawblk-sym').selectOption('mirror');
  await onGrid(page, 4, 0.2, 0.2); // the upper left of the first cell, and its mirror images in the other corners
  // join the middle four cells into one square in the accent fabric
  await page.locator('#drawblk-tools [data-tool="join"]').click();
  await onGrid(page, 4, 1.5, 1.5, 2.5, 2.5);
  await page.locator('#drawblk-tools [data-tool="s"]').click();
  await page.locator('#drawblk-roles [data-role="2"]').click();
  await onGrid(page, 4, 2, 2);
  // the cutting list follows the drawing
  await expect(page.locator('#drawblk-cut li')).toHaveCount(4);
  await expect(page.locator('#drawblk-cut')).toContainText('Main: 2 × square');
  await expect(page.locator('#drawblk-cut')).toContainText('Accent: 1 × square');
  await page.locator('#drawblk-name').fill('Corner star');
  await page.locator('#drawblk-use').click();
  await expect(page.locator('#drawblk')).toBeHidden();

  const check = async () => {
    const d = await app.current(),
      key = d.blocks[0].pattern;
    expect(key).toMatch(/^my[0-9a-f]{12}$/);
    expect(d.drawn[key]).toEqual({
      label: 'Corner star',
      n: 4,
      rows: '1/0 0 0 0\\1\n0 2 - 0\n0 | + 0\n1\\0 0 0 0/1',
    });
    expect(d.blocks[0].fabrics).toHaveLength(17); // 4 triangle squares (8 parts), 8 squares, the joined centre
    return key;
  };
  const key = await check();
  await expect(page.locator(`#dz-patterns [data-p="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await check();
  // and it is in the library, under My blocks
  const c = await app.blockCentre(await app.current(), 0);
  await page.mouse.click(c.x, c.y);
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-groups button', { hasText: 'My blocks' }).click();
  await expect(page.locator('#blklib-grid .pat[data-p]')).toHaveText(['Corner star']);
  await expect(page.locator('#blklib-draw')).toBeVisible();
  await page.keyboard.press('Escape');
  // the cutting guide knows the drawn block like any other
  await page.locator('#tabs [data-page="cut"]').click();
  await expect(page.locator('#page-cut')).toContainText('Corner star');
});

test('the editor opens on a drawn block to change it; undo, split and clear', async ({ app, page }) => {
  await openDrawer(app, page);
  await page.locator('#drawblk-n').selectOption('3');
  await page.locator('#drawblk-tools [data-tool="q"]').click();
  await page.locator('#drawblk-roles [data-role="1"]').click();
  await onGrid(page, 3, 1.5, 1.1); // the top of the middle cell's hourglass
  await page.locator('#drawblk-use').click();
  let d = await app.current();
  const first = d.blocks[0].pattern;
  expect(d.drawn[first].rows).toBe('0 0 0\n0 q1000 0\n0 0 0');

  // the selected block is a drawn one: the editor opens on it, with its name
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-draw').click();
  await expect(page.locator('#drawblk-name')).toHaveValue('My block 1');
  await expect(page.locator('#drawblk-n')).toHaveValue('3');
  await page.locator('#drawblk-tools [data-tool="join"]').click();
  await onGrid(page, 3, 0.5, 0.5, 1.5, 0.5);
  await page.locator('#drawblk-undo').click(); // the join undone
  await onGrid(page, 3, 0.5, 2.5, 2.5, 2.5); // the bottom row joined
  await page.locator('#drawblk-tools [data-tool="split"]').click();
  await onGrid(page, 3, 1.5, 2.5); // and split again
  await page.locator('#drawblk-tools [data-tool="v"]').click();
  await onGrid(page, 3, 0.5, 0.2); // a goose pointing down, with its sky in the background
  await page.locator('#drawblk-name').fill('Hourglass goose');
  await page.locator('#drawblk-use').click();
  d = await app.current();
  const second = d.blocks[0].pattern;
  expect(second).not.toBe(first); // a changed drawing is a new pattern; the quilt keeps the old one too
  expect(d.drawn[second]).toEqual({ label: 'Hourglass goose', n: 3, rows: 'v10 0 0\n0 q1000 0\n0 0 0' });
  expect(Object.keys(d.drawn)).toContain(first);

  // Clear starts again on an empty grid of the same size; Undo brings the drawing back
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-draw').click();
  const lines = await page.locator('#drawblk-cut li').count();
  expect(lines).toBeGreaterThan(2);
  await page.locator('#drawblk-clear').click();
  await expect(page.locator('#drawblk-cut li')).toHaveCount(1); // background squares only
  await page.locator('#drawblk-undo').click();
  await expect(page.locator('#drawblk-cut li')).toHaveCount(lines);
  await page.locator('#drawblk-x').click();
  await expect(page.locator('#drawblk')).toBeHidden();
});

test('start from a traditional block, and save to My blocks without using it', async ({ app, page }) => {
  // the first block of a new quilt is an Ohio star, drawn by hand in the app's code: not on a grid of cells, so
  // the editor starts from it on graph paper
  await openDrawer(app, page);
  await page.locator('#drawblk-from').click();
  await expect(page.locator('#drawblk-mode [data-mode="paper"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#drawblk-cut li')).not.toHaveCount(0);
  await page.locator('#drawblk-x').click();
  // a sixteen patch is written in the grid notation, so the editor can start from it
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-q').fill('sixteen');
  await page.locator('#blklib-grid .pat[data-p="sixteen"]').click();
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-draw').click();
  await page.locator('#drawblk-from').click();
  await expect(page.locator('#drawblk-mode [data-mode="cells"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#drawblk-n')).toHaveValue('4');
  await page.locator('#drawblk-roles [data-role="4"]').click();
  await page.locator('#drawblk-tools [data-tool="s"]').click();
  await onGrid(page, 4, 1.5, 1.5);
  await page.locator('#drawblk-name').fill('Rose star');
  const before = (await app.current()).blocks[0].pattern;
  await page.locator('#drawblk-keep').click();
  await expect(page.locator('#notice')).toContainText('Rose star');
  const d = await app.current();
  expect(d.blocks[0].pattern).toBe(before); // the quilt's blocks are unchanged
  expect(Object.values(d.drawn).map(b => b.label)).toEqual(['Rose star']);
});

test('graph paper: seams at any angle, fills, a floating shape refused, and the block used in the quilt', async ({
  app,
  page,
}) => {
  await openDrawer(app, page);
  await page.locator('#drawblk-mode [data-mode="paper"]').click();
  await expect(page.locator('#drawblk-paper-tools')).toBeVisible();
  await expect(page.locator('#drawblk-cells-tools')).toBeHidden();
  // a square on point: one seam, turned four ways; the ends snap to the grid's points
  await page.locator('#drawblk-sym').selectOption('turn');
  await onPaper(page, 4, 1.97, 0.03, 3.98, 2.04);
  await page.locator('#drawblk-ptools [data-ptool="fill"]').click();
  await page.locator('#drawblk-roles [data-role="1"]').click();
  await onPaper(page, 4, 2, 2);
  await expect(page.locator('#drawblk-cut')).toContainText('Main: 1 ×');
  // a square floating in the middle: not a piece, and the block can't be used until it is joined to the rest
  await page.locator('#drawblk-ptools [data-ptool="line"]').click();
  await onPaper(page, 4, 1.5, 1.5, 2.5, 1.5);
  await expect(page.locator('#drawblk-float')).toBeVisible();
  await page.locator('#drawblk-use').click();
  await expect(page.locator('#notice')).toContainText('floats free');
  await page.locator('#drawblk-undo').click();
  await expect(page.locator('#drawblk-float')).toBeHidden();
  // erase one seam, then put it back
  await page.locator('#drawblk-sym').selectOption('off');
  await page.locator('#drawblk-ptools [data-ptool="erase"]').click();
  await onPaper(page, 4, 3, 1);
  // the main piece now runs into the corner the seam cut off: an odd shape, cut from a template
  await expect(page.locator('#drawblk-cut')).toContainText('Main: 1 × template piece');
  await page.locator('#drawblk-undo').click();
  await page.locator('#drawblk-name').fill('Diamond in a square');
  await page.locator('#drawblk-use').click();
  await expect(page.locator('#drawblk')).toBeHidden();

  const d = await app.current(),
    key = d.blocks[0].pattern,
    def = d.drawn[key];
  expect(def.label).toBe('Diamond in a square');
  expect(def.rows).toBe(Array(4).fill('x x x x').join('\n'));
  expect(def.extra).toHaveLength(5);
  expect(def.extra.map(e => e[1]).sort()).toEqual([0, 0, 0, 0, 1]);
  expect(def.paper.lines).toHaveLength(4);
  expect(d.blocks[0].fabrics).toHaveLength(5);
  // opening the editor on it again brings back the graph paper and its lines
  await page.locator('#dz-patterns').hover();
  await page.locator('#fab-more-float').click();
  await page.locator('#blklib-draw').click();
  await expect(page.locator('#drawblk-mode [data-mode="paper"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#drawblk-name')).toHaveValue('Diamond in a square');
  await page.locator('#drawblk-x').click();
  await page.locator('#tabs [data-page="cut"]').click();
  await expect(page.locator('#page-cut')).toContainText('Diamond in a square');
});
