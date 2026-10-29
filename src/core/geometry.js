// Quilt geometry in millimetres: block, sashing, border and large-block layout, plus fabric fills.
import '../designer/design-state.js';          // load order: runs after designer/design-state
import { orientPoly, partsOf } from './patterns.js';
import { fabricById } from '../designer/fabric-library.js';

// ---- drawing
// Fabric is drawn at its real size: each block is design.blockMm across.
// a print placed so its point (u, v) (fractions of one repeat) sits at (cx, cy): a fussy cut
function fabricFillAt(g, fab, pxPerCm, cx, cy, u, v) {
  const pat = g.createPattern(fab.canvas, 'repeat'), k = pxPerCm / (fab.canvas.width / fab.cm);
  pat.setTransform(new DOMMatrix().translate(cx, cy).scale(k).translate(-u * fab.canvas.width, -v * fab.canvas.height));
  return pat;
}
const polyCentre = p => { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; };
// the fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print
function pieceFill(g, b, pi, poly, pxPerCm, seed) {
  const fab = fabricById(b.fabrics[pi]), f = b.fussy && b.fussy[pi];
  if (!f) return fabricFill(g, fab, pxPerCm, seed);
  const [cx, cy] = polyCentre(poly); return fabricFillAt(g, fab, pxPerCm, cx, cy, f[0], f[1]);
}
function fabricFill(g, fab, pxPerCm, seed) {
  const pat = g.createPattern(fab.canvas, 'repeat');
  const k = pxPerCm / (fab.canvas.width / fab.cm);
  const ox = (seed * 7919) % fab.canvas.width, oy = (seed * 104729) % fab.canvas.height;
  pat.setTransform(new DOMMatrix().scale(k).translate(-ox, -oy));
  return pat;
}
function blockPolys(b, x, y, w, h) {
  return partsOf(b.pattern).map(p => orientPoly(p.poly, b).map(([u, v]) => [x + u * w, y + v * h]));
}
function pathPoly(g, poly) { g.beginPath(); poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }
// ---- sashing: strips of fabric between the blocks (optionally all round the outside too), with
// cornerstones where strips cross. design.sashing = { mm, fabric, corner, border }; mm 0 = none.
const sashOf = d => { const s = d && d.sashing; return s && s.mm > 0 ? { mm: s.mm, fabric: s.fabric || 'b0', corner: s.corner || s.fabric || 'b0', border: !!s.border } : { mm: 0, fabric: 'b0', corner: 'b0', border: false }; };
// finished size of the quilt top in mm
// the centre (blocks + sashing), before any borders
function centreMm(d) {
  const s = sashOf(d), e = s.border ? 2 : 0;
  return { W: d.cols * d.blockMm + s.mm * (d.cols - 1 + e), H: d.rows * d.blockMm + s.mm * (d.rows - 1 + e) };
}
const bordersOf = d => (d && Array.isArray(d.borders) ? d.borders.filter(b => BORDER_TYPES[b.type] && b.mm > 0) : []);
const borderTotal = d => bordersOf(d).reduce((a, b) => a + b.mm, 0);
// finished size of the whole quilt top, borders included
function quiltMm(d) { const c = centreMm(d), t = borderTotal(d); return { W: c.W + 2 * t, H: c.H + 2 * t }; }
// ---- large blocks: an "anchor" block with span k covers k × k cells (and the sashing between them);
// the cells it covers keep their data but carry under = the anchor's index and are not drawn or cut
const spanOf = b => (b && b.span > 1 ? b.span : 1);
const anchorOf = (d, i) => { const b = d.blocks[i]; return b && b.under != null ? b.under : i; };
function normalizeSpans(d) {
  if (!d || !Array.isArray(d.blocks)) return d;
  const C = d.cols, R = d.rows, taken = new Array(C * R).fill(false);
  for (const b of d.blocks) delete b.under;
  d.blocks.forEach((b, i) => {
    const c = i % C, r = Math.floor(i / C);
    if (taken[i]) { delete b.span; return; }
    taken[i] = true;
    if (!(b.span > 1)) { delete b.span; return; }
    let k = Math.min(b.span, C - c, R - r);
    const free = k => { for (let y = r; y < r + k; y++) for (let x = c; x < c + k; x++) if ((x !== c || y !== r) && taken[y * C + x]) return false; return true; };
    while (k > 1 && !free(k)) k--;
    if (k <= 1) { delete b.span; return; }
    b.span = k;
    for (let y = r; y < r + k; y++) for (let x = c; x < c + k; x++) { const j = y * C + x; if (j !== i) { taken[j] = true; d.blocks[j].under = i; } }
  });
  return d;
}
// make block i span k × k cells: other large blocks in the way go back to single cells first
function setSpan(d, i, k) {
  const C = d.cols, c = i % C, r = Math.floor(i / C);
  k = Math.max(1, Math.min(k, C - c, d.rows - r));
  d.blocks.forEach((b, j) => {
    if (j === i || !(b.span > 1)) return;
    const cj = j % C, rj = Math.floor(j / C), kj = b.span;
    if (cj < c + k && cj + kj > c && rj < r + k && rj + kj > r) delete b.span;
  });
  if (k > 1) d.blocks[i].span = k; else delete d.blocks[i].span;
  normalizeSpans(d);
}
// where one grid cell (c, r) sits on a W × H drawing of the quilt
function cellRect(d, c, r, W, H) {
  const s = sashOf(d), q = quiltMm(d), kx = W / q.W, ky = H / q.H, off = (s.border ? s.mm : 0) + borderTotal(d);
  return { x: (off + c * (d.blockMm + s.mm)) * kx, y: (off + r * (d.blockMm + s.mm)) * ky, w: d.blockMm * kx, h: d.blockMm * ky };
}
// where block (c, r) sits: a large block covers its k × k cells; a covered cell answers with its large block
function blockRect(d, c, r, W, H) {
  let i = r * d.cols + c;
  const a = d.blocks ? anchorOf(d, i) : i;
  if (a !== i) { i = a; c = a % d.cols; r = Math.floor(a / d.cols); }
  const R = cellRect(d, c, r, W, H), k = d.blocks ? spanOf(d.blocks[i]) : 1;
  if (k === 1) return R;
  const s = sashOf(d), q = quiltMm(d), kx = W / q.W, ky = H / q.H, mm = k * d.blockMm + (k - 1) * s.mm;
  return { x: R.x, y: R.y, w: mm * kx, h: mm * ky };
}
// finished size (mm) of a block that spans k cells
const blockSizeMm = (d, k) => k * d.blockMm + (k - 1) * sashOf(d).mm;
// which block is at (x, y) on a W × H drawing (-1 on sashing or outside); a large block answers for all its area
function blockAt(d, x, y, W, H) {
  const s = sashOf(d), q = quiltMm(d), o = (s.border ? s.mm : 0) + borderTotal(d), mx = x / W * q.W - o, my = y / H * q.H - o, p = d.blockMm + s.mm;
  const c = Math.floor(mx / p), r = Math.floor(my / p);
  if (c < 0 || r < 0 || c >= d.cols || r >= d.rows) return -1;
  const a = anchorOf(d, r * d.cols + c), R = blockRect(d, c, r, W, H);
  return x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h ? a : -1;
}
// the sashing strips and cornerstones on a W × H drawing
function sashRects(d, W, H) {
  const s = sashOf(d); if (!s.mm) return [];
  const q = quiltMm(d), kx = W / q.W, ky = H / q.H, bt = borderTotal(d), off = (s.border ? s.mm : 0) + bt, p = d.blockMm + s.mm, out = [];
  const xs = [], ys = [];                                   // left / top edge of each sashing line, in mm
  if (s.border) { xs.push(bt); ys.push(bt); }
  for (let c = 1; c < d.cols; c++) xs.push(off + c * p - s.mm);
  for (let r = 1; r < d.rows; r++) ys.push(off + r * p - s.mm);
  if (s.border) { xs.push(q.W - bt - s.mm); ys.push(q.H - bt - s.mm); }
  for (const x of xs) for (let r = 0; r < d.rows; r++) out.push({ kind: 'sash', x: x * kx, y: (off + r * p) * ky, w: s.mm * kx, h: d.blockMm * ky });
  for (const y of ys) for (let c = 0; c < d.cols; c++) out.push({ kind: 'sash', x: (off + c * p) * kx, y: y * ky, w: d.blockMm * kx, h: s.mm * ky });
  for (const x of xs) for (const y of ys) out.push({ kind: 'corner', x: x * kx, y: y * ky, w: s.mm * kx, h: s.mm * ky });
  // strips and cornerstones inside a large block are not there: the block covers them
  const big = (d.blocks || []).map((b, i) => (b.span > 1 && b.under == null ? blockRect(d, i % d.cols, Math.floor(i / d.cols), W, H) : null)).filter(Boolean);
  if (!big.length) return out;
  return out.filter(rc => { const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2; return !big.some(B => cx > B.x && cx < B.x + B.w && cy > B.y && cy < B.y + B.h); });
}
// ---- borders: rings of fabric around the centre, innermost first; several can be stacked.
// Each side is drawn in its own frame: x along the side, y from the outer edge (0) to the inner edge (T).
const BORDER_TYPES = {
  plain:    { label: 'Plain strip', slots: ['Fabric', 'Corner squares'], mm: 100, unit: null },
  piano:    { label: 'Piano keys', slots: ['Key A', 'Key B', 'Corners'], mm: 100, unit: T => T / 2 },
  squares:  { label: 'Row of squares', slots: ['Square A', 'Square B', 'Corners'], mm: 64, unit: T => T },
  checker:  { label: 'Checkerboard', slots: ['Square A', 'Square B', 'Corners'], mm: 76, unit: T => T / 2 },
  sawtooth: { label: 'Sawtooth', slots: ['Teeth', 'Background', 'Corners'], mm: 64, unit: T => T },
  geese:    { label: 'Flying geese', slots: ['Geese', 'Sky', 'Corners'], mm: 76, unit: T => T / 2 },
};
const borderUnits = (b, L) => { const u = BORDER_TYPES[b.type].unit; return u ? Math.max(1, Math.round(L / u(b.mm))) : 1; };
// pieces of one border side, in the side's frame: [{poly, slot}]
function borderSidePieces(b, L) {
  const T = b.mm, out = [], n = borderUnits(b, L), u = L / n, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (b.type === 'plain') { out.push({ poly: R(0, 0, L, T), slot: 0 }); return out; }
  for (let i = 0; i < n; i++) {
    const x0 = i * u, x1 = x0 + u, alt = i % 2;
    if (b.type === 'piano' || b.type === 'squares') out.push({ poly: R(x0, 0, x1, T), slot: alt });
    else if (b.type === 'checker') { out.push({ poly: R(x0, 0, x1, T / 2), slot: alt }); out.push({ poly: R(x0, T / 2, x1, T), slot: 1 - alt }); }
    else if (b.type === 'sawtooth') { out.push({ poly: [[x0, T], [x1, 0], [x1, T]], slot: 0 }); out.push({ poly: [[x0, 0], [x1, 0], [x0, T]], slot: 1 }); }
    else if (b.type === 'geese') {
      out.push({ poly: [[x0, 0], [x1, T / 2], [x0, T]], slot: 0 });
      out.push({ poly: [[x0, 0], [x1, 0], [x1, T / 2]], slot: 1 }); out.push({ poly: [[x0, T], [x1, T / 2], [x1, T]], slot: 1 });
    }
  }
  return out;
}
const borderFab = (b, slot) => (b.fabrics && b.fabrics[slot]) || (b.fabrics && b.fabrics[0]) || 'b0';
const borderCornerSlot = b => (b.type === 'plain' ? 1 : 2);
const plainButted = b => b.type === 'plain' && borderFab(b, 1) === borderFab(b, 0);   // no corner squares: long strips

// ---- interaction
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pathPolyInto(g, poly) { poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }

export { BORDER_TYPES, anchorOf, blockAt, blockPolys, blockRect, blockSizeMm, borderCornerSlot, borderFab, borderSidePieces, borderTotal, borderUnits, bordersOf, cellRect, centreMm, fabricFill, normalizeSpans, pathPoly, pathPolyInto, pieceFill, plainButted, pointInPoly, polyCentre, quiltMm, sashOf, sashRects, setSpan, spanOf };
