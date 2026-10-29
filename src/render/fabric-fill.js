// Fabric fills for canvas drawing: a print at its real scale, and fussy-cut pieces.
import '../designer/design-state.js'; // load order: runs after designer/design-state
import { fabricById } from '../designer/fabric-library.js';
import { polyCentre } from '../core/geometry.js';

// ---- drawing
// Fabric is drawn at its real size: each block is design.blockMm across.
// a print placed so its point (u, v) (fractions of one repeat) sits at (cx, cy): a fussy cut
function fabricFillAt(g, fab, pxPerCm, cx, cy, u, v) {
  const pat = g.createPattern(fab.canvas, 'repeat'),
    k = pxPerCm / (fab.canvas.width / fab.cm);
  pat.setTransform(
    new DOMMatrix()
      .translate(cx, cy)
      .scale(k)
      .translate(-u * fab.canvas.width, -v * fab.canvas.height),
  );
  return pat;
}
// the fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print
function pieceFill(g, b, pi, poly, pxPerCm, seed) {
  const fab = fabricById(b.fabrics[pi]),
    f = b.fussy && b.fussy[pi];
  if (!f) return fabricFill(g, fab, pxPerCm, seed);
  const [cx, cy] = polyCentre(poly);
  return fabricFillAt(g, fab, pxPerCm, cx, cy, f[0], f[1]);
}
function fabricFill(g, fab, pxPerCm, seed) {
  const pat = g.createPattern(fab.canvas, 'repeat');
  const k = pxPerCm / (fab.canvas.width / fab.cm);
  const ox = (seed * 7919) % fab.canvas.width,
    oy = (seed * 104729) % fab.canvas.height;
  pat.setTransform(new DOMMatrix().scale(k).translate(-ox, -oy));
  return pat;
}

export { fabricFill, pieceFill };
