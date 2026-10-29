// Quilt geometry in millimetres: block, sashing, border and large-block layout, plus fabric fills.
// @ts-check
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Rect} Rect @typedef {import('./types.js').Poly} Poly */
import { orientPoly, partsOf } from './patterns.js';

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
// cornerstones where strips cross. design.sashing = { mm, fabric, corner, border }; mm 0 = none.
/** Sashing with defaults filled in (mm 0 = none). @param {Design} d @returns {Required<import('./types.js').Sashing>} */
const sashOf = d => {
  const s = d && d.sashing;
  return s && s.mm > 0
    ? { mm: s.mm, fabric: s.fabric || 'b0', corner: s.corner || s.fabric || 'b0', border: !!s.border }
    : { mm: 0, fabric: 'b0', corner: 'b0', border: false };
};
// finished size of the quilt top in mm
// the centre (blocks + sashing), before any borders
/** Size of the centre (blocks + sashing), before borders. @param {Design} d @returns {{ W: number, H: number }} */
function centreMm(d) {
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
 * Large blocks made consistent (pure: returns a new design, or the same one if nothing changes): each large block
 * is clipped to the grid and shrunk until it overlaps no earlier one; the cells it covers get `under`.
 * @param {Design} d @returns {Design}
 */
function normalizeSpans(d) {
  if (!d || !Array.isArray(d.blocks)) return d;
  const C = d.cols,
    R = d.rows,
    n = d.blocks.length,
    taken = new Array(n).fill(false),
    span = new Array(n).fill(0),
    under = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const b = d.blocks[i],
      c = i % C,
      r = Math.floor(i / C);
    if (taken[i]) continue;
    taken[i] = true;
    if (!(b.span > 1)) continue;
    let k = Math.min(b.span, C - c, R - r);
    const free = k => {
      for (let y = r; y < r + k; y++)
        for (let x = c; x < c + k; x++) if ((x !== c || y !== r) && taken[y * C + x]) return false;
      return true;
    };
    while (k > 1 && !free(k)) k--;
    if (k <= 1) continue;
    span[i] = k;
    for (let y = r; y < r + k; y++)
      for (let x = c; x < c + k; x++) {
        const j = y * C + x;
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
 * Block i made to cover k × k cells (pure); large blocks in the way go back to 1 × 1.
 * @param {Design} d @param {number} i @param {number} k0 @returns {Design}
 */
function setSpan(d, i, k0) {
  const C = d.cols,
    c = i % C,
    r = Math.floor(i / C),
    k = Math.max(1, Math.min(k0, C - c, d.rows - r));
  const blocks = d.blocks.map((b, j) => {
    if (j === i) {
      const { span: _s, ...rest } = b;
      return k > 1 ? { ...rest, span: k } : rest;
    }
    if (!(b.span > 1)) return b;
    const cj = j % C,
      rj = Math.floor(j / C),
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
// the sashing strips and cornerstones on a W × H drawing
/** Sashing strips and cornerstones on a W × H drawing. @param {Design} d @param {number} W @param {number} H @returns {(Rect & { kind: string })[]} kind: 'sash' or 'corner' */
function sashRects(d, W, H) {
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
  for (const y of ys)
    for (let c = 0; c < d.cols; c++)
      out.push({ kind: 'sash', x: (off + c * p) * kx, y: y * ky, w: d.blockMm * kx, h: s.mm * ky });
  for (const x of xs)
    for (const y of ys) out.push({ kind: 'corner', x: x * kx, y: y * ky, w: s.mm * kx, h: s.mm * ky });
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
  plain: { label: 'Plain strip', slots: ['Fabric', 'Corner squares'], mm: 100, unit: null },
  piano: { label: 'Piano keys', slots: ['Key A', 'Key B', 'Corners'], mm: 100, unit: T => T / 2 },
  squares: { label: 'Row of squares', slots: ['Square A', 'Square B', 'Corners'], mm: 64, unit: T => T },
  checker: { label: 'Checkerboard', slots: ['Square A', 'Square B', 'Corners'], mm: 76, unit: T => T / 2 },
  sawtooth: { label: 'Sawtooth', slots: ['Teeth', 'Background', 'Corners'], mm: 64, unit: T => T },
  geese: { label: 'Flying geese', slots: ['Geese', 'Sky', 'Corners'], mm: 76, unit: T => T / 2 },
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
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pathPolyInto(g, poly) {
  poly.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
}

export {
  BORDER_TYPES,
  anchorOf,
  blockAt,
  blockPolys,
  blockRect,
  blockSizeMm,
  borderCornerSlot,
  borderFab,
  borderSidePieces,
  borderTotal,
  borderUnits,
  bordersOf,
  cellRect,
  centreMm,
  normalizeSpans,
  pathPoly,
  pathPolyInto,
  plainButted,
  pointInPoly,
  polyCentre,
  quiltMm,
  sashOf,
  sashRects,
  setSpan,
  spanOf,
};
