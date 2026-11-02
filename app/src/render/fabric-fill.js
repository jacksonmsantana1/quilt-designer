// Fabric fills for canvas drawing: a print at its real scale, and fussy-cut pieces.
import '../designer/dispatch.js'; // load order: runs after designer/dispatch
import { fabricById } from '../designer/fabric-library.js';
import { polyCentre } from '@quilt/shared/geometry.js';

// ---- drawing
// Fabric is drawn at its real size: each block is design.blockMm across.
// turn (radians) turns the print with its block: on point the pieces are cut on grain in the block, so their
// stripes run diagonally on the quilt
const DEG = 180 / Math.PI;
// a print placed so its point (u, v) (fractions of one repeat) sits at (cx, cy): a fussy cut
function fabricFillAt(g, fab, pxPerCm, cx, cy, u, v, turn = 0) {
  const pat = g.createPattern(fab.canvas, 'repeat'),
    k = pxPerCm / (fab.canvas.width / fab.cm);
  pat.setTransform(
    new DOMMatrix()
      .translate(cx, cy)
      .rotate(turn * DEG)
      .scale(k)
      .translate(-u * fab.canvas.width, -v * fab.canvas.height),
  );
  return pat;
}
// the fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print
function pieceFill(g, b, pi, poly, pxPerCm, seed, turn = 0) {
  const fab = fabricById(b.fabrics[pi]),
    f = b.fussy && b.fussy[pi];
  if (!f) return fabricFill(g, fab, pxPerCm, seed, turn);
  const [cx, cy] = polyCentre(poly);
  return fabricFillAt(g, fab, pxPerCm, cx, cy, f[0], f[1], turn);
}
function fabricFill(g, fab, pxPerCm, seed, turn = 0) {
  const pat = g.createPattern(fab.canvas, 'repeat');
  const k = pxPerCm / (fab.canvas.width / fab.cm);
  const ox = (seed * 7919) % fab.canvas.width,
    oy = (seed * 104729) % fab.canvas.height;
  pat.setTransform(
    new DOMMatrix()
      .rotate(turn * DEG)
      .scale(k)
      .translate(-ox, -oy),
  );
  return pat;
}

export { fabricFill, pieceFill };
