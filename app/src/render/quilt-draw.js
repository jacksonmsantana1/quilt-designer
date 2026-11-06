// Drawing the whole quilt top: blocks, sashing and borders.
import './fabric-fill.js'; // load order: runs after render/fabric-fill
import { design } from '../core/store.js';
import { dimUnlessHi } from './highlight.js';
import { fabricById } from '../designer/fabric-library.js';
import {
  borderCornerSlot,
  borderFab,
  borderSidePieces,
  bordersOf,
  pathPoly,
  plainButted,
  quiltMm,
} from '@quilt/shared/geometry.js';
import { quiltPainter } from '@quilt/shared/quilt-paint.js';
import { fabricFill } from './fabric-fill.js';

const painter = quiltPainter({ fabricById: id => fabricById(id), dim: dimUnlessHi });
const { drawBorders, drawCornerBlock } = painter;
/**
 * Draws a quilt top (borders, sashing and blocks) into a W × H box at the context's origin.
 * @param {CanvasRenderingContext2D} g @param {number} W @param {number} H
 * @param {{ seams?: boolean, design?: import('@quilt/shared/types.js').Design }} [opts] design: the one being edited by default
 */
const drawQuilt = (g, W, H, opts = {}) => painter.drawQuilt(g, W, H, { ...opts, design: opts.design || design });
// The quilt with its borders pulled apart: each border is drawn as its own ring with a gap around it,
// so several borders read separately. W is the width in px; gap the space between rings (px). Returns the height.
function explodedH(W, gap) {
  const q = quiltMm(design),
    n = bordersOf(design).length,
    k = (W - 2 * gap * n) / q.W;
  return Math.round(q.H * k + 2 * gap * n);
}
// one border drawn as a ring filling the box (X, Y, BW, BH) in px at k px/mm; each side is laid out for its own length,
// so the units fit whatever the box (used to draw the borders pulled apart)
function drawRingPx(g, b, bi, X, Y, BW, BH, k) {
  const T = b.mm,
    Tp = T * k,
    Lw = (BW - 2 * Tp) / k,
    Lh = (BH - 2 * Tp) / k;
  const sides = [
    [Lw, X + Tp, Y, 0],
    [Lh, X + BW, Y + Tp, 90],
    [Lw, X + BW - Tp, Y + BH, 180],
    [Lh, X, Y + BH - Tp, 270],
  ];
  let seed = 2000 + bi * 97;
  for (const [L, tx, ty, rot] of sides) {
    g.save();
    g.translate(tx, ty);
    g.rotate((rot * Math.PI) / 180);
    g.scale(k, k);
    for (const pc of borderSidePieces(b, L)) {
      const fab = borderFab(b, pc.slot);
      g.fillStyle = fabricFill(g, fabricById(fab), 10, seed++);
      pathPoly(g, pc.poly);
      g.fill();
      dimUnlessHi(g, { t: 'brd', bi, fabric: fab, corner: false });
      g.strokeStyle = 'rgba(40,30,20,.35)';
      g.lineWidth = 1 / k;
      g.stroke();
    }
    g.restore();
  }
  for (const [cx, cy] of [
    [X, Y],
    [X + BW - Tp, Y],
    [X + BW - Tp, Y + BH - Tp],
    [X, Y + BH - Tp],
  ]) {
    const fab = borderFab(b, borderCornerSlot(b));
    g.fillStyle = fabricFill(g, fabricById(fab), k * 10, seed++);
    g.fillRect(cx, cy, Tp, Tp);
    g.beginPath();
    g.rect(cx, cy, Tp, Tp);
    dimUnlessHi(g, { t: 'brd', bi, fabric: fab, corner: !plainButted(b) });
    if (!plainButted(b)) {
      g.strokeStyle = 'rgba(40,30,20,.35)';
      g.lineWidth = 1;
      g.strokeRect(cx, cy, Tp, Tp);
    }
  }
}
function drawBordersExploded(g, W, gap, focus = -1) {
  const bs = bordersOf(design),
    n = bs.length,
    q = quiltMm(design),
    k = (W - 2 * gap * n) / q.W,
    H = explodedH(W, gap);
  const fade = (x, y, w, h, t) => {
    g.beginPath();
    g.rect(x, y, w, h);
    if (t) g.rect(x + t, y + t, w - 2 * t, h - 2 * t);
    g.fillStyle = 'rgba(250,243,232,.78)';
    g.fill('evenodd');
  };
  let off = 0; // px from the outside edge
  for (let i = n - 1; i >= 0; i--) {
    // outermost first; each ring sits a gap inside the one around it
    const X = off,
      BW = W - 2 * off,
      BH = H - 2 * off,
      Tp = bs[i].mm * k;
    drawRingPx(g, bs[i], i, X, X, BW, BH, k);
    g.strokeStyle = 'rgba(40,30,20,.45)';
    g.lineWidth = 1;
    g.strokeRect(X + 0.5, X + 0.5, BW - 1, BH - 1);
    g.strokeRect(X + Tp - 0.5, X + Tp - 0.5, BW - 2 * Tp + 1, BH - 2 * Tp + 1);
    if (focus >= 0 && i !== focus) fade(X, X, BW, BH, Tp);
    off += Tp + gap;
  }
  // the quilt inside all the borders
  g.save();
  g.translate(off, off);
  drawQuilt(g, W - 2 * off, H - 2 * off, { seams: true, design: { ...design, borders: [] } });
  if (focus >= 0) fade(0, 0, W - 2 * off, H - 2 * off, 0);
  g.restore();
  return H;
}
export { drawBorders, drawBordersExploded, drawCornerBlock, drawQuilt, explodedH };
