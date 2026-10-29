// Quilting stitches and seam lines.
import '../sim/quilt-size.js';          // load order: runs after sim/quilt-size
import { shared } from '../core/shared.js';
import { blockPolys, blockRect, pathPoly, quiltMm, sashRects } from '../core/geometry.js';

// ---- quilting: the stitching that holds the layers together, drawn over the whole top.
// 'ditch' = along the seams only; the others add a pattern of their own over the top
const QUILTING = { ditch: 'In the ditch (along the seams)', cross: 'Crosshatch', fans: 'Baptist fans', meander: 'Meander' };
const quiltingOf = d => (d && QUILTING[d.quilting] ? d.quilting : 'ditch');
function drawQuiltingLines(g, W, H, kind) {
  const k = W / quiltMm(shared.design).W;                                     // px per mm
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
  if (kind === 'cross') {                                               // diagonal grid, 38 mm (1½ in) apart
    const sp = 38 * k; g.beginPath();
    for (let t = -H; t < W + H; t += sp) { g.moveTo(t, 0); g.lineTo(t + H, H); g.moveTo(t, H); g.lineTo(t + H, 0); }
    g.stroke();
  } else if (kind === 'fans') {                                         // rows of fans: arcs 25 mm apart in 200 mm fans
    const F = 200 * k, st = 25 * k;
    for (let row = Math.ceil(H / F); row >= 0; row--) for (let c = -1; c * F < W + F; c++) {
      const x0 = c * F + (row % 2 ? F / 2 : 0), y0 = (row + 1) * F;
      g.save(); g.beginPath(); g.rect(x0, y0 - F, F, F); g.clip();
      for (let r = st; r <= F * 1.42; r += st) { g.beginPath(); g.arc(x0, y0, r, -Math.PI / 2, 0); g.stroke(); }
      g.restore();
    }
  } else if (kind === 'meander') {                                      // a wandering line, rows about 30 mm apart
    let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const row = 30 * k, step = 18 * k;
    for (let y = row / 2; y < H + row; y += row) {
      g.beginPath(); g.moveTo(-step, y);
      for (let x = -step; x < W + 2 * step; x += step) { const cy = y + (rnd() - .5) * row * 1.4, ny = y + (rnd() - .5) * row * .5; g.quadraticCurveTo(x + step / 2, cy, x + step, ny); }
      g.stroke();
    }
  }
  g.restore();
}
function strokeSeams(g, W, H) {
  const d = shared.design;
  for (const rc of sashRects(d, W, H)) g.strokeRect(rc.x, rc.y, rc.w, rc.h);
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++) {
    if (d.blocks[r * d.cols + c].under != null) continue;
    const R = blockRect(d, c, r, W, H);
    for (const poly of blockPolys(d.blocks[r * d.cols + c], R.x, R.y, R.w, R.h)) { pathPoly(g, poly); g.stroke(); }
  }
}
// The design's seams drawn at 1/f size and returned for scaling up: scaling up a small drawing
// with smoothing gives a blur of about f pixels, at a tiny fraction of a blur filter's cost.
function softSeams(W, H, blur, bg, ink, lineWidth) {
  const f = Math.max(1, blur), w = Math.max(8, Math.round(W / f)), h = Math.max(8, Math.round(H / f));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.setTransform(w / W, 0, 0, h / H, 0, 0); g.strokeStyle = ink; g.lineWidth = lineWidth; strokeSeams(g, W, H);
  const qk = quiltingOf(shared.design); if (qk !== 'ditch') { g.lineWidth = lineWidth * 0.6; drawQuiltingLines(g, W, H, qk); }
  return c;
}

export { drawQuiltingLines, quiltingOf, softSeams, strokeSeams };
