// Quilt geometry in millimetres: block, sashing, border and large-block layout, plus fabric fills.
// @ts-check
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Rect} Rect @typedef {import('./types.js').Poly} Poly */
import { orientPoly, partsOf } from './patterns.js';
import { isMosaic, mosaicMm, mosaicTiles } from './mosaic.js';
import { t } from './i18n.js';

const polyCentre = p => {
  let x = 0,
    y = 0;
  for (const q of p) {
    x += q[0];
    y += q[1];
  }
  return [x / p.length, y / p.length];
};

function blockPolys(b, x, y, w, h) {
  return partsOf(b.pattern).map(p => orientPoly(p.poly, b).map(([u, v]) => [x + u * w, y + v * h]));
}
function pathPoly(g, poly) {
  g.beginPath();
  poly.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
}
// ---- sashing: strips of fabric between the blocks (optionally all round the outside too), with
// cornerstones where strips cross. design.sashing = { mm, fabric, corner, border, cornerstones, cornerBlock };
// mm 0 = none. A cornerstone can be pieced as a block, from a few simple patterns, once the sashing is wide enough
// to sew one (narrower, the block stays saved but the cornerstones are plain again).
const CORNER_BLOCK_MIN_MM = 76;
const CORNER_PATTERNS = ['four', 'nine', 'hst', 'hourglass', 'sqsq', 'pinwheel', 'ohio'];
/**
 * Sashing with defaults filled in (mm 0 = none); cornerBlock is the block in use, or null.
 * @param {Design} d @returns {Required<Omit<import('./types.js').Sashing, 'cornerBlock'>> & { cornerBlock: import('./types.js').Block | null }}
 */
const sashOf = d => {
  const s = d && d.sashing;
  if (!(s && s.mm > 0))
    return { mm: 0, fabric: 'b0', corner: 'b0', border: false, cornerstones: true, cornerBlock: null };
  const cornerstones = s.cornerstones !== false;
  return {
    mm: s.mm,
    fabric: s.fabric || 'b0',
    corner: s.corner || s.fabric || 'b0',
    border: isOnPoint(d) || !!s.border, // on point the sashing always frames every block, outer ones too

    cornerstones,
    cornerBlock: cornerstones && s.mm >= CORNER_BLOCK_MIN_MM && s.cornerBlock ? s.cornerBlock : null,
  };
};
// ---- on point (design.setting 'onpoint'): every block turned 45°, standing on a corner, in diagonal rows.
// cols × rows positions as in a straight quilt (blocks[0 … cols·rows-1], same order), then (cols-1) × (rows-1)
// more between them (blocks after those, row by row); triangles in settingFabric fill the zig-zag edges.
/** @param {Design} d */
const isOnPoint = d => !!d && d.setting === 'onpoint';
/** Number of block positions (the length of design.blocks). @param {Design} d @returns {number} */
const cellCount = d => d.cols * d.rows + (isOnPoint(d) ? (d.cols - 1) * (d.rows - 1) : 0);
// finished size of the quilt top in mm
// the centre (blocks + sashing), before any borders
/** Size of the centre (blocks + sashing), before borders. @param {Design} d @returns {{ W: number, H: number }} */
function centreMm(d) {
  // a shape mosaic: its own size (no blocks, no sashing)
  if (isMosaic(d)) {
    const m = mosaicMm(d.mosaic);
    return { W: m.w, H: m.h };
  }
  // on point it is the straight size with sashing all round, turned: √2 × (n blocks + n+1 strips) each way.
  // Not a whole number of mm, so where a size is shown it is rounded there (rounding here would make the blocks
  // very slightly out of square)
  if (isOnPoint(d)) {
    const s = sashOf(d).mm;
    return {
      W: Math.SQRT2 * (d.cols * (d.blockMm + s) + s),
      H: Math.SQRT2 * (d.rows * (d.blockMm + s) + s),
    };
  }
  const s = sashOf(d),
    e = s.border ? 2 : 0;
  return { W: d.cols * d.blockMm + s.mm * (d.cols - 1 + e), H: d.rows * d.blockMm + s.mm * (d.rows - 1 + e) };
}
/** The valid borders, innermost first. @param {Design} d @returns {import('./types.js').Border[]} */
const bordersOf = d => (d && Array.isArray(d.borders) ? d.borders.filter(b => BORDER_TYPES[b.type] && b.mm > 0) : []);
/** Total width of all borders, mm. @param {Design} d @returns {number} */
const borderTotal = d => bordersOf(d).reduce((a, b) => a + b.mm, 0);
// finished size of the whole quilt top, borders included
/** Finished size of the whole quilt top, mm. @param {Design} d @returns {{ W: number, H: number }} */
function quiltMm(d) {
  const c = centreMm(d),
    t = borderTotal(d);
  return { W: c.W + 2 * t, H: c.H + 2 * t };
}
// ---- large blocks: an "anchor" block with span k covers k × k cells (and the sashing between them);
// the cells it covers keep their data but carry under = the anchor's index and are not drawn or cut
/** Cells per side covered by a block (1 for a normal block). @param {import('./types.js').Block} b @returns {number} */
const spanOf = b => (b && b.span > 1 ? b.span : 1);
/** The block drawn at cell i: itself, or the large block covering it. @param {Design} d @param {number} i @returns {number} */
const anchorOf = (d, i) => {
  const b = d.blocks[i];
  return b && b.under != null ? b.under : i;
};
/**
 * The grid of cells the blocks stand on: each block's cell (column, row), and the block at a cell (-1: none, off
 * the quilt). Straight, the rows and columns; on point, the turned frame, where the diamonds stand on a straight
 * grid too (the quilt's zig-zag edge leaves cells out). @param {Design} d
 */
function cellGrid(d) {
  if (!isOnPoint(d))
    return {
      /** @param {number} i @returns {[number, number]} */
      cell: i => [i % d.cols, Math.floor(i / d.cols)],
      /** @param {number} x @param {number} y */
      at: (x, y) => (x >= 0 && y >= 0 && x < d.cols && y < d.rows ? y * d.cols + x : -1),
    };
  const f = turnedFrame(d, 1, 1),
    map = new Map();
  for (let i = 0, n = cellCount(d); i < n; i++) map.set(f.cell(i).join(','), i);
  return { cell: f.cell, at: (x, y) => map.get(x + ',' + y) ?? -1 };
}
/**
 * Large blocks made consistent (pure: returns a new design, or the same one if nothing changes): each large block
 * is shrunk until it fits on the quilt and overlaps no earlier one; the cells it covers get `under`.
 * @param {Design} d @returns {Design}
 */
function normalizeSpans(d) {
  if (!d || !Array.isArray(d.blocks)) return d;
  const g = cellGrid(d),
    n = d.blocks.length,
    taken = new Array(n).fill(false),
    span = new Array(n).fill(0),
    under = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const b = d.blocks[i],
      [c, r] = g.cell(i);
    if (taken[i]) continue;
    taken[i] = true;
    if (!(b.span > 1)) continue;
    const fits = k => {
      for (let y = r; y < r + k; y++)
        for (let x = c; x < c + k; x++) {
          const j = g.at(x, y);
          if (j < 0 || (j !== i && taken[j])) return false;
        }
      return true;
    };
    let k = b.span;
    while (k > 1 && !fits(k)) k--;
    if (k <= 1) continue;
    span[i] = k;
    for (let y = r; y < r + k; y++)
      for (let x = c; x < c + k; x++) {
        const j = g.at(x, y);
        if (j !== i) {
          taken[j] = true;
          under[j] = i;
        }
      }
  }
  let changed = false;
  const blocks = d.blocks.map((b, i) => {
    const s = span[i] > 1 ? span[i] : undefined,
      u = under[i] >= 0 ? under[i] : undefined;
    if (b.span === s && b.under === u) return b;
    changed = true;
    const { span: _s, under: _u, ...rest } = b;
    return { ...rest, ...(s ? { span: s } : {}), ...(u != null ? { under: u } : {}) };
  });
  return changed ? { ...d, blocks } : d;
}
/**
 * Block i made to cover k × k cells (pure), as many as fit on the quilt; large blocks in the way go back to 1 × 1.
 * @param {Design} d @param {number} i @param {number} k0 @returns {Design}
 */
function setSpan(d, i, k0) {
  const g = cellGrid(d),
    [c, r] = g.cell(i),
    inside = k => {
      for (let y = r; y < r + k; y++) for (let x = c; x < c + k; x++) if (g.at(x, y) < 0) return false;
      return true;
    };
  let k = Math.max(1, k0);
  while (k > 1 && !inside(k)) k--;
  const blocks = d.blocks.map((b, j) => {
    if (j === i) {
      const { span: _s, ...rest } = b;
      return k > 1 ? { ...rest, span: k } : rest;
    }
    if (!(b.span > 1)) return b;
    const [cj, rj] = g.cell(j),
      kj = b.span;
    if (cj < c + k && cj + kj > c && rj < r + k && rj + kj > r) {
      const { span: _s, ...rest } = b;
      return rest;
    }
    return b;
  });
  return normalizeSpans({ ...d, blocks });
}
/** Where grid cell (c, r) sits on a W × H drawing. @param {Design} d @param {number} c @param {number} r @param {number} W @param {number} H @returns {Rect} */
function cellRect(d, c, r, W, H) {
  const s = sashOf(d),
    q = quiltMm(d),
    kx = W / q.W,
    ky = H / q.H,
    off = (s.border ? s.mm : 0) + borderTotal(d);
  return {
    x: (off + c * (d.blockMm + s.mm)) * kx,
    y: (off + r * (d.blockMm + s.mm)) * ky,
    w: d.blockMm * kx,
    h: d.blockMm * ky,
  };
}
// where block (c, r) sits: a large block covers its k × k cells; a covered cell answers with its large block
/** Where the block at (c, r) sits on a W × H drawing (a large block's whole area). @param {Design} d @param {number} c0 @param {number} r0 @param {number} W @param {number} H @returns {Rect} */
function blockRect(d, c0, r0, W, H) {
  const i0 = r0 * d.cols + c0,
    i = d.blocks ? anchorOf(d, i0) : i0,
    c = i % d.cols,
    r = Math.floor(i / d.cols);
  const R = cellRect(d, c, r, W, H),
    k = d.blocks ? spanOf(d.blocks[i]) : 1;
  if (k === 1) return R;
  const s = sashOf(d),
    q = quiltMm(d),
    kx = W / q.W,
    ky = H / q.H,
    mm = k * d.blockMm + (k - 1) * s.mm;
  return { x: R.x, y: R.y, w: mm * kx, h: mm * ky };
}
// finished size (mm) of a block that spans k cells
/** Finished size of a block spanning k cells, mm. @param {Design} d @param {number} k @returns {number} */
const blockSizeMm = (d, k) => k * d.blockMm + (k - 1) * sashOf(d).mm;
// which block is at (x, y) on a W × H drawing (-1 on sashing or outside); a large block answers for all its area
/** Index of the block at (x, y) on a W × H drawing, or -1. @param {Design} d @param {number} x @param {number} y @param {number} W @param {number} H @returns {number} */
function blockAt(d, x, y, W, H) {
  if (isMosaic(d)) return -1; // no blocks showing
  if (isOnPoint(d)) {
    for (let i = 0, n = cellCount(d); i < n; i++)
      if (d.blocks[i].under == null && pointInPoly(x, y, blockOutline(blockPlace(d, i, W, H)))) return i;
    return -1;
  }
  const s = sashOf(d),
    q = quiltMm(d),
    o = (s.border ? s.mm : 0) + borderTotal(d),
    mx = (x / W) * q.W - o,
    my = (y / H) * q.H - o,
    p = d.blockMm + s.mm;
  const c = Math.floor(mx / p),
    r = Math.floor(my / p);
  if (c < 0 || r < 0 || c >= d.cols || r >= d.rows) return -1;
  const a = anchorOf(d, r * d.cols + c),
    R = blockRect(d, c, r, W, H);
  return x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h ? a : -1;
}
/**
 * Where block i sits on a W × H drawing: its square (x, y, w, h) as if straight, and the turn about the square's
 * centre (0, or 45° = π/4 on point). A cell covered by a large block answers with the large block's place.
 * @typedef {Rect & { turn: number }} Place
 * @param {Design} d @param {number} i @param {number} W @param {number} H @returns {Place}
 */
function blockPlace(d, i, W, H) {
  if (!isOnPoint(d)) return { ...blockRect(d, i % d.cols, Math.floor(i / d.cols), W, H), turn: 0 };
  // (a covered cell answers with its large block, which covers k blocks and the k - 1 strips between them)
  const f = turnedFrame(d, W, H),
    a = d.blocks ? anchorOf(d, i) : i,
    k = d.blocks ? spanOf(d.blocks[a]) : 1,
    size = k * d.blockMm + (k - 1) * f.s,
    [u, v] = f.cell(a);
  return f.place(u * f.p + f.s, v * f.p + f.s, size, size);
}
/**
 * On point, worked out in the turned frame: there the blocks stand on a straight grid, (u, v) along a block's top
 * and left edges, each block in a cell of block + sashing, with sashing all round like a straight quilt with its
 * outside strips. Block (c, r) is grid square (c + r, r − c); the one between (c, r) and (c + 1, r + 1) is
 * (c + r + 1, r − c). `place` turns a rectangle of that frame (mm) into a Place on the W × H drawing.
 * @param {Design} d @param {number} W @param {number} H
 */
function turnedFrame(d, W, H) {
  const s = sashOf(d).mm,
    p = d.blockMm + s,
    q = quiltMm(d),
    bt = borderTotal(d),
    kx = W / q.W,
    ky = H / q.H,
    m = (d.blockMm / 2 + s) * Math.SQRT2, // the centre's edge to the middle of the first row and column
    big = d.cols * d.rows;
  /** @param {number} i @returns {[number, number]} */
  const cell = i => {
    if (i < big) {
      const c = i % d.cols,
        r = Math.floor(i / d.cols);
      return [c + r, r - c];
    }
    const j = i - big,
      c = j % (d.cols - 1),
      r = Math.floor(j / (d.cols - 1));
    return [c + r + 1, r - c];
  };
  /** @param {number} u0 @param {number} v0 @param {number} w @param {number} h @returns {Place} */
  const place = (u0, v0, w, h) => {
    // u runs down-right, v down-left: the turn of 45° that also turns a block's own parts that way
    const u = u0 + w / 2,
      v = v0 + h / 2,
      cx = (bt + m + (u - v) / Math.SQRT2) * kx,
      cy = (bt + (u + v) / Math.SQRT2) * ky;
    return { x: cx - (w * kx) / 2, y: cy - (h * ky) / 2, w: w * kx, h: h * ky, turn: Math.PI / 4 };
  };
  return { s, p, m, cell, place };
}
/** A point of a placed block's square, turned with it. @param {Place} P @returns {(p: number[]) => number[]} */
const turnPoint = P => {
  if (!P.turn) return p => p;
  const cx = P.x + P.w / 2,
    cy = P.y + P.h / 2,
    co = Math.cos(P.turn),
    si = Math.sin(P.turn);
  return ([x, y]) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co];
};
/** The four corners of a placed block (a diamond on point). @param {Place} P @returns {Poly} */
const blockOutline = P =>
  [
    [P.x, P.y],
    [P.x + P.w, P.y],
    [P.x + P.w, P.y + P.h],
    [P.x, P.y + P.h],
  ].map(turnPoint(P));
/** blockPolys for a placed block: its parts where they are on the drawing. @param {import('./types.js').Block} b @param {Place} P @returns {Poly[]} */
const placedPolys = (b, P) => blockPolys(b, P.x, P.y, P.w, P.h).map(poly => poly.map(turnPoint(P)));
/** The smallest upright rectangle around a placed block. @param {Place} P @returns {Rect} */
function placeBox(P) {
  const o = blockOutline(P),
    xs = o.map(p => p[0]),
    ys = o.map(p => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}
/**
 * On point: the triangles that fill the zig-zag edges, on a W × H drawing. 'side' ones sit between two blocks on
 * an edge (cut from a square cut twice on the diagonal), 'corner' ones fill the four corners (a square cut once).
 * @param {Design} d @param {number} W @param {number} H @returns {{ kind: 'side' | 'corner', poly: Poly }[]}
 */
function settingPieces(d, W, H) {
  if (!isOnPoint(d) || isMosaic(d)) return [];
  // outside the sashing that frames the outer blocks: D apart (one block and strip, corner to corner), the first
  // one m in from each edge
  const q = quiltMm(d),
    cm = centreMm(d),
    bt = borderTotal(d),
    kx = W / q.W,
    ky = H / q.H,
    { p, m } = turnedFrame(d, W, H),
    D = p * Math.SQRT2,
    x0 = bt,
    y0 = bt,
    x1 = bt + cm.W,
    y1 = bt + cm.H,
    out = [];
  const add = (kind, ...pts) => out.push({ kind, poly: pts.map(([x, y]) => [x * kx, y * ky]) });
  for (let c = 0; c < d.cols - 1; c++) {
    const a = x0 + m + D * c,
      mid = a + D / 2,
      b = a + D;
    add('side', [a, y0], [b, y0], [mid, y0 + D / 2]);
    add('side', [a, y1], [mid, y1 - D / 2], [b, y1]);
  }
  for (let r = 0; r < d.rows - 1; r++) {
    const a = y0 + m + D * r,
      mid = a + D / 2,
      b = a + D;
    add('side', [x0, a], [x0 + D / 2, mid], [x0, b]);
    add('side', [x1, a], [x1, b], [x1 - D / 2, mid]);
  }
  add('corner', [x0, y0], [x0 + m, y0], [x0, y0 + m]);
  add('corner', [x1, y0], [x1, y0 + m], [x1 - m, y0]);
  add('corner', [x0, y1], [x0, y1 - m], [x0 + m, y1]);
  add('corner', [x1, y1], [x1 - m, y1], [x1, y1 - m]);
  return out;
}
/** How a block's position is named: "2, 3" (row, column); on point, a block between rows and columns "1½, 2½". @param {Design} d @param {number} i */
/**
 * The block at (x, y) on a W × H drawing, or (on a setting triangle, a strip, a border) the one whose middle is
 * nearest; a covered cell answers with its large block. @param {Design} d @param {number} x @param {number} y
 * @param {number} W @param {number} H @returns {number}
 */
function nearestBlock(d, x, y, W, H) {
  const at = blockAt(d, x, y, W, H);
  if (at >= 0) return at;
  let best = 0,
    bd = Infinity;
  for (let i = 0, n = cellCount(d); i < n; i++) {
    if (d.blocks[i].under != null) continue;
    const P = blockPlace(d, i, W, H),
      dist = Math.hypot(P.x + P.w / 2 - x, P.y + P.h / 2 - y);
    if (dist < bd) ((bd = dist), (best = i));
  }
  return best;
}
/**
 * On point, a selection that turns with the blocks: every block in the turned grid between blocks a and b (opposite
 * corners, as a straight selection is between two corners), and the turned box round them on the W × H drawing.
 * @param {Design} d @param {number} a @param {number} b @param {number} W @param {number} H
 * @returns {{ blocks: number[], box: Place, cols: number, rows: number }}
 */
function turnedSelection(d, a, b, W, H) {
  const g = cellGrid(d),
    f = turnedFrame(d, W, H),
    [ax, ay] = g.cell(a),
    [bx, by] = g.cell(b),
    x0 = Math.min(ax, bx),
    x1 = Math.max(ax, bx),
    y0 = Math.min(ay, by),
    y1 = Math.max(ay, by),
    blocks = new Set();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const j = g.at(x, y);
      if (j >= 0) blocks.add(anchorOf(d, j));
    }
  const cols = x1 - x0 + 1,
    rows = y1 - y0 + 1;
  // round whole blocks: from the first one's edge to the last one's (the strips round the outside are left out)
  return {
    blocks: [...blocks],
    box: f.place(x0 * f.p + f.s, y0 * f.p + f.s, cols * f.p - f.s, rows * f.p - f.s),
    cols,
    rows,
  };
}
/**
 * Where block i is on the grid of cells: (column, row) straight; on point, its square in the turned frame, where
 * the diamonds stand on a straight grid too (see turnedFrame). @param {Design} d @param {number} i @returns {[number, number]}
 */
const gridCell = (d, i) => (isOnPoint(d) ? turnedFrame(d, 1, 1).cell(i) : [i % d.cols, Math.floor(i / d.cols)]);
/**
 * Can these selected blocks be united into one large block? They must cover a square of 2 × 2 to 4 × 4 cells,
 * exactly (a large block in the selection counts with all its cells). Returns the top-left block and the size,
 * or why not: 'one' (a single block), 'square' (not a square, or holes in it), 'size' (bigger than 4 × 4).
 * @param {Design} d @param {Iterable<number>} sel @returns {{ i: number, k: number } | { why: 'one' | 'square' | 'size' }}
 */
function uniteOf(d, sel) {
  const at = new Map(), // "x,y" → the block whose own cell it is
    cells = new Set();
  for (let i = 0, n = cellCount(d); i < n; i++) at.set(gridCell(d, i).join(','), i);
  for (const i0 of sel) {
    const a = anchorOf(d, i0),
      k = spanOf(d.blocks[a]),
      [x0, y0] = gridCell(d, a);
    for (let y = y0; y < y0 + k; y++) for (let x = x0; x < x0 + k; x++) cells.add(x + ',' + y);
  }
  const xy = [...cells].map(c => c.split(',').map(Number)),
    xs = xy.map(p => p[0]),
    ys = xy.map(p => p[1]),
    w = Math.max(...xs) - Math.min(...xs) + 1,
    h = Math.max(...ys) - Math.min(...ys) + 1;
  if (cells.size <= 1) return { why: 'one' };
  if (w !== h || cells.size !== w * h) return { why: 'square' };
  if (w > 4) return { why: 'size' };
  const i = at.get(Math.min(...xs) + ',' + Math.min(...ys));
  return i == null ? { why: 'square' } : { i, k: w };
}
function cellName(d, i) {
  const big = d.cols * d.rows;
  if (!isOnPoint(d) || i < big) return `${Math.floor(i / d.cols) + 1}, ${(i % d.cols) + 1}`;
  const j = i - big;
  return `${Math.floor(j / (d.cols - 1)) + 1}½, ${(j % (d.cols - 1)) + 1}½`;
}
// the sashing strips and cornerstones on a W × H drawing
/**
 * Sashing strips and cornerstones on a W × H drawing. Without cornerstones, the strips and crossings along each
 * line between rows join into one long strip (kind 'long'), broken only where a large block covers the line; a
 * crossing left on its own there (large blocks on both sides) joins the strips above and below it instead.
 * @param {Design} d @param {number} W @param {number} H @returns {(Rect & { kind: string })[]} kind: 'sash', 'corner' or 'long'
 */
function sashRects(d, W, H) {
  if (isMosaic(d)) return [];
  if (isOnPoint(d)) return sashOnPoint(d, W, H);
  /** @type {Set<object>} */
  const across = new Set(); // the pieces on the lines between rows: horizontal strips and crossings
  const all = sashPieces(d, W, H, across);
  if (sashOf(d).cornerstones) return all;
  const rows = joinRuns(
      all.filter(rc => across.has(rc)),
      'x',
    ),
    lone = rows.filter(rc => rc.kind === 'corner'),
    cols = joinRuns([...all.filter(rc => !across.has(rc)), ...lone], 'y');
  // (a crossing still on its own is cut like a strip, in the sashing fabric)
  return [...rows.filter(rc => rc.kind !== 'corner'), ...cols].map(rc =>
    rc.kind === 'corner' ? { ...rc, kind: 'sash' } : rc,
  );
}
/**
 * On point: the sashing round every block, worked out in the turned frame (where it is straight sashing with strips
 * all round) and turned onto the drawing. Each piece is a Place (turned 45°) with its kind, as in sashRects.
 * @param {Design} d @param {number} W @param {number} H @returns {(Place & { kind: string })[]}
 */
function sashOnPoint(d, W, H) {
  const sz = sashOf(d);
  if (!sz.mm) return [];
  const f = turnedFrame(d, W, H),
    { s, p } = f,
    b = d.blockMm,
    pieces = new Map(), // by place: a strip or crossing two blocks share is there once
    /** @type {Set<object>} */
    across = new Set(); // the pieces along u (the turned frame's rows): strips and crossings
  const put = (key, kind, u, v, w, h, isAcross) => {
    if (pieces.has(key)) return;
    const rc = { kind, x: u, y: v, w, h };
    pieces.set(key, rc);
    if (isAcross) across.add(rc);
  };
  for (let i = 0, n = cellCount(d); i < n; i++) {
    const [I, J] = f.cell(i);
    put(`v${I},${J}`, 'sash', I * p, J * p + s, s, b, false);
    put(`v${I + 1},${J}`, 'sash', (I + 1) * p, J * p + s, s, b, false);
    put(`h${I},${J}`, 'sash', I * p + s, J * p, b, s, true);
    put(`h${I},${J + 1}`, 'sash', I * p + s, (J + 1) * p, b, s, true);
    for (const [a, c] of [
      [I, J],
      [I + 1, J],
      [I, J + 1],
      [I + 1, J + 1],
    ])
      put(`c${a},${c}`, 'corner', a * p, c * p, s, s, true);
  }
  // strips and cornerstones inside a large block are not there: the block covers them
  const big = [];
  for (let i = 0, n = cellCount(d); i < n; i++) {
    const k = spanOf(d.blocks[i]);
    if (k < 2 || d.blocks[i].under != null) continue;
    const [I, J] = f.cell(i);
    big.push([I * p + s, J * p + s, k * b + (k - 1) * s]);
  }
  let rects = [...pieces.values()].filter(rc => {
    const cx = rc.x + rc.w / 2,
      cy = rc.y + rc.h / 2;
    return !big.some(([u, v, z]) => cx > u && cx < u + z && cy > v && cy < v + z);
  });
  if (!sz.cornerstones) {
    // as straight: the strips and crossings along each row of the turned frame join into long strips
    const rows = joinRuns(
        rects.filter(rc => across.has(rc)),
        'x',
      ),
      lone = rows.filter(rc => rc.kind === 'corner'),
      cols = joinRuns([...rects.filter(rc => !across.has(rc)), ...lone], 'y');
    rects = [...rows.filter(rc => rc.kind !== 'corner'), ...cols].map(rc =>
      rc.kind === 'corner' ? { ...rc, kind: 'sash' } : rc,
    );
  }
  return rects.map(rc => ({ ...f.place(rc.x, rc.y, rc.w, rc.h), kind: rc.kind }));
}
/**
 * Pieces on the same line that touch end to end along x (or y) joined: a run of several becomes one 'long' strip.
 * @param {(Rect & { kind: string })[]} pieces @param {'x' | 'y'} ax @returns {(Rect & { kind: string })[]}
 */
function joinRuns(pieces, ax) {
  const len = ax === 'x' ? 'w' : 'h',
    lines = new Map();
  for (const rc of pieces) {
    const at = ax === 'x' ? rc.y : rc.x;
    lines.set(at, [...(lines.get(at) || []), rc]);
  }
  const out = [];
  for (const line of lines.values()) {
    line.sort((a, b) => a[ax] - b[ax]);
    let run = [line[0]];
    const flush = () => {
      const first = run[0],
        last = run[run.length - 1],
        ext = last[ax] + last[len] - first[ax];
      if (run.length === 1) out.push(first);
      else
        out.push({
          kind: 'long',
          x: first.x,
          y: first.y,
          w: ax === 'x' ? ext : first.w,
          h: ax === 'y' ? ext : first.h,
        });
    };
    for (const rc of line.slice(1)) {
      const last = run[run.length - 1];
      if (rc[ax] <= last[ax] + last[len] + 1e-6 * (last[len] || 1)) run.push(rc);
      else (flush(), (run = [rc]));
    }
    flush();
  }
  return out;
}
/**
 * sashRects with cornerstones; the pieces on the lines between rows are also added to `across`.
 * @param {Design} d @param {number} W @param {number} H @param {Set<object>} across @returns {(Rect & { kind: string })[]}
 */
function sashPieces(d, W, H, across) {
  const s = sashOf(d);
  if (!s.mm) return [];
  const q = quiltMm(d),
    kx = W / q.W,
    ky = H / q.H,
    bt = borderTotal(d),
    off = (s.border ? s.mm : 0) + bt,
    p = d.blockMm + s.mm,
    out = [];
  const xs = [],
    ys = []; // left / top edge of each sashing line, in mm
  if (s.border) {
    xs.push(bt);
    ys.push(bt);
  }
  for (let c = 1; c < d.cols; c++) xs.push(off + c * p - s.mm);
  for (let r = 1; r < d.rows; r++) ys.push(off + r * p - s.mm);
  if (s.border) {
    xs.push(q.W - bt - s.mm);
    ys.push(q.H - bt - s.mm);
  }
  for (const x of xs)
    for (let r = 0; r < d.rows; r++)
      out.push({ kind: 'sash', x: x * kx, y: (off + r * p) * ky, w: s.mm * kx, h: d.blockMm * ky });
  const add = rc => (across.add(rc), out.push(rc));
  for (const y of ys)
    for (let c = 0; c < d.cols; c++)
      add({ kind: 'sash', x: (off + c * p) * kx, y: y * ky, w: d.blockMm * kx, h: s.mm * ky });
  for (const x of xs) for (const y of ys) add({ kind: 'corner', x: x * kx, y: y * ky, w: s.mm * kx, h: s.mm * ky });
  // strips and cornerstones inside a large block are not there: the block covers them
  const big = (d.blocks || [])
    .map((b, i) => (b.span > 1 && b.under == null ? blockRect(d, i % d.cols, Math.floor(i / d.cols), W, H) : null))
    .filter(Boolean);
  if (!big.length) return out;
  return out.filter(rc => {
    const cx = rc.x + rc.w / 2,
      cy = rc.y + rc.h / 2;
    return !big.some(B => cx > B.x && cx < B.x + B.w && cy > B.y && cy < B.y + B.h);
  });
}
// ---- borders: rings of fabric around the centre, innermost first; several can be stacked.
// Each side is drawn in its own frame: x along the side, y from the outer edge (0) to the inner edge (T).
const BORDER_TYPES = {
  plain: { label: t('Plain strip'), slots: [t('Fabric'), t('Corner squares')], mm: 100, unit: null },
  piano: { label: t('Piano keys'), slots: [t('Key A'), t('Key B'), t('Corners')], mm: 100, unit: T => T / 2 },
  squares: { label: t('Row of squares'), slots: [t('Square A'), t('Square B'), t('Corners')], mm: 64, unit: T => T },
  checker: { label: t('Checkerboard'), slots: [t('Square A'), t('Square B'), t('Corners')], mm: 76, unit: T => T / 2 },
  sawtooth: { label: t('Sawtooth'), slots: [t('Teeth'), t('Background'), t('Corners')], mm: 64, unit: T => T },
  geese: { label: t('Flying geese'), slots: [t('Geese'), t('Sky'), t('Corners')], mm: 76, unit: T => T / 2 },
};
const borderUnits = (b, L) => {
  const u = BORDER_TYPES[b.type].unit;
  return u ? Math.max(1, Math.round(L / u(b.mm))) : 1;
};
// pieces of one border side, in the side's frame: [{poly, slot}]
/** Pieces of one side of a border of length L (mm), in the side's frame. @param {import('./types.js').Border} b @param {number} L @returns {{ poly: Poly, slot: number }[]} */
function borderSidePieces(b, L) {
  const T = b.mm,
    out = [],
    n = borderUnits(b, L),
    u = L / n,
    R = (x0, y0, x1, y1) => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
  if (b.type === 'plain') {
    out.push({ poly: R(0, 0, L, T), slot: 0 });
    return out;
  }
  for (let i = 0; i < n; i++) {
    const x0 = i * u,
      x1 = x0 + u,
      alt = i % 2;
    if (b.type === 'piano' || b.type === 'squares') out.push({ poly: R(x0, 0, x1, T), slot: alt });
    else if (b.type === 'checker') {
      out.push({ poly: R(x0, 0, x1, T / 2), slot: alt });
      out.push({ poly: R(x0, T / 2, x1, T), slot: 1 - alt });
    } else if (b.type === 'sawtooth') {
      out.push({
        poly: [
          [x0, T],
          [x1, 0],
          [x1, T],
        ],
        slot: 0,
      });
      out.push({
        poly: [
          [x0, 0],
          [x1, 0],
          [x0, T],
        ],
        slot: 1,
      });
    } else if (b.type === 'geese') {
      out.push({
        poly: [
          [x0, 0],
          [x1, T / 2],
          [x0, T],
        ],
        slot: 0,
      });
      out.push({
        poly: [
          [x0, 0],
          [x1, 0],
          [x1, T / 2],
        ],
        slot: 1,
      });
      out.push({
        poly: [
          [x0, T],
          [x1, T / 2],
          [x1, T],
        ],
        slot: 1,
      });
    }
  }
  return out;
}
const borderFab = (b, slot) => (b.fabrics && b.fabrics[slot]) || (b.fabrics && b.fabrics[0]) || 'b0';
const borderCornerSlot = b => (b.type === 'plain' ? 1 : 2);
const plainButted = b => b.type === 'plain' && borderFab(b, 1) === borderFab(b, 0); // no corner squares: long strips

// ---- interaction
/**
 * Do two convex polygons overlap (more than touching)? They don't when some edge direction of either one has a
 * gap between them along its perpendicular (the separating axis test).
 * @param {Poly} a @param {Poly} b @returns {boolean}
 */
function convexOverlap(a, b) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i],
        [x2, y2] = poly[(i + 1) % poly.length],
        nx = y1 - y2,
        ny = x2 - x1;
      const span = p => {
        const ds = p.map(([x, y]) => x * nx + y * ny);
        return [Math.min(...ds), Math.max(...ds)];
      };
      const [a0, a1] = span(a),
        [b0, b1] = span(b);
      if (a1 <= b0 || b1 <= a0) return false;
    }
  return true;
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/**
 * A mosaic's shapes on a drawing of the whole quilt W × H px (borders included), in fabric order.
 * @param {Design} d @param {number} W @param {number} H @returns {Poly[]}
 */
function tilePolys(d, W, H) {
  if (!isMosaic(d)) return [];
  const q = quiltMm(d),
    kx = W / q.W,
    ky = H / q.H,
    o = borderTotal(d);
  return mosaicTiles(d.mosaic).map(t => t.poly.map(([x, y]) => [(x + o) * kx, (y + o) * ky]));
}
/** The mosaic shape at a point of the drawing, or -1. @param {Design} d @param {number} x @param {number} y @param {number} W @param {number} H */
function tileAtPx(d, x, y, W, H) {
  return tilePolys(d, W, H).findIndex(p => pointInPoly(x, y, p));
}

function pathPolyInto(g, poly) {
  poly.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
}

export {
  tileAtPx,
  tilePolys,
  BORDER_TYPES,
  CORNER_BLOCK_MIN_MM,
  CORNER_PATTERNS,
  anchorOf,
  blockAt,
  blockOutline,
  blockPlace,
  blockPolys,
  blockRect,
  blockSizeMm,
  borderCornerSlot,
  borderFab,
  borderSidePieces,
  borderTotal,
  borderUnits,
  bordersOf,
  cellCount,
  cellGrid,
  cellName,
  cellRect,
  centreMm,
  convexOverlap,
  isOnPoint,
  normalizeSpans,
  pathPoly,
  nearestBlock,
  pathPolyInto,
  placeBox,
  placedPolys,
  plainButted,
  pointInPoly,
  polyCentre,
  quiltMm,
  sashOf,
  sashRects,
  setSpan,
  settingPieces,
  spanOf,
  turnedSelection,
  uniteOf,
};
