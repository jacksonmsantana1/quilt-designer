// Drawing the whole quilt top: blocks, sashing and borders.
import './fabric-fill.js'; // load order: runs after render/fabric-fill
import { shared } from '../core/shared.js';
import { dimUnlessHi } from './highlight.js';
import { fabricById } from '../designer/fabric-library.js';
import {
  blockPolys,
  blockRect,
  borderCornerSlot,
  borderFab,
  borderSidePieces,
  bordersOf,
  pathPoly,
  plainButted,
  quiltMm,
  sashOf,
  sashRects,
} from '../core/geometry.js';
import { fabricFill, pieceFill } from './fabric-fill.js';

// draw every border on a W × H drawing of the quilt
function drawBorders(g, d, W, H, pxPerCm, seams, biBase = 0) {
  const q = quiltMm(d),
    k = W / q.W,
    bs = bordersOf(d);
  let off = 0;
  // outermost first: borders[last] is the outer ring
  for (let bi = bs.length - 1; bi >= 0; bi--) {
    const b = bs[bi],
      T = b.mm,
      ox = off,
      oy = off,
      OW = q.W - 2 * off,
      OH = q.H - 2 * off;
    const sides = [
      { L: OW - 2 * T, tf: [ox + T, oy, 0] },
      { L: OH - 2 * T, tf: [ox + OW, oy + T, 90] },
      { L: OW - 2 * T, tf: [ox + OW - T, oy + OH, 180] },
      { L: OH - 2 * T, tf: [ox, oy + OH - T, 270] },
    ];
    let seed = 2000 + bi * 97;
    for (const sd of sides) {
      g.save();
      g.scale(k, k);
      g.translate(sd.tf[0], sd.tf[1]);
      g.rotate((sd.tf[2] * Math.PI) / 180);
      for (const pc of borderSidePieces(b, sd.L)) {
        g.fillStyle = fabricFill(g, fabricById(borderFab(b, pc.slot)), pxPerCm / k, seed++);
        pathPoly(g, pc.poly);
        g.fill();
        dimUnlessHi(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, pc.slot), corner: false });
        if (seams) {
          g.strokeStyle = 'rgba(40,30,20,.35)';
          g.lineWidth = Math.max(1, W / 1400) / k;
          g.stroke();
        }
      }
      g.restore();
    }
    // corners
    for (const [cx, cy] of [
      [ox, oy],
      [ox + OW - T, oy],
      [ox + OW - T, oy + OH - T],
      [ox, oy + OH - T],
    ]) {
      g.fillStyle = fabricFill(g, fabricById(borderFab(b, borderCornerSlot(b))), pxPerCm, seed++);
      g.fillRect(cx * k, cy * k, T * k, T * k);
      g.beginPath();
      g.rect(cx * k, cy * k, T * k, T * k);
      dimUnlessHi(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, borderCornerSlot(b)), corner: !plainButted(b) });
      if (seams && !plainButted(b)) {
        g.strokeStyle = 'rgba(40,30,20,.35)';
        g.lineWidth = Math.max(1, W / 1400);
        g.strokeRect(cx * k, cy * k, T * k, T * k);
      }
    }
    off += T;
  }
}
// The quilt with its borders pulled apart: each border is drawn as its own ring with a gap around it,
// so several borders read separately. W is the width in px; gap the space between rings (px). Returns the height.
function explodedH(W, gap) {
  const q = quiltMm(shared.design),
    n = bordersOf(shared.design).length,
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
  const bs = bordersOf(shared.design),
    n = bs.length,
    q = quiltMm(shared.design),
    k = (W - 2 * gap * n) / q.W,
    H = explodedH(W, gap);
  const fade = (x, y, w, h, t) => {
    g.beginPath();
    g.rect(x, y, w, h);
    if (t) g.rect(x + t, y + t, w - 2 * t, h - 2 * t);
    g.fillStyle = 'rgba(236,239,244,.78)';
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
  drawQuilt(g, W - 2 * off, H - 2 * off, { seams: true, design: { ...shared.design, borders: [] } });
  if (focus >= 0) fade(0, 0, W - 2 * off, H - 2 * off, 0);
  g.restore();
  return H;
}
/**
 * Draws a quilt top (borders, sashing and blocks) into a W × H box at the context's origin.
 * @param {CanvasRenderingContext2D} g @param {number} W @param {number} H
 * @param {{ seams?: boolean, design?: import('../core/types.js').Design }} [opts] design: the one being edited by default
 */
function drawQuilt(g, W, H, opts = {}) {
  const d = opts.design || shared.design;
  if (bordersOf(d).length) drawBorders(g, d, W, H, W / (quiltMm(d).W / 10), opts.seams);
  const q = quiltMm(d),
    pxPerCm = W / (q.W / 10),
    s = sashOf(d);
  for (const [k, rc] of sashRects(d, W, H).entries()) {
    g.fillStyle = fabricFill(g, fabricById(rc.kind === 'corner' ? s.corner : s.fabric), pxPerCm, 900 + k);
    g.fillRect(rc.x, rc.y, rc.w, rc.h);
    g.beginPath();
    g.rect(rc.x, rc.y, rc.w, rc.h);
    dimUnlessHi(g, { t: 'sash', kind: rc.kind });
    if (opts.seams) {
      g.strokeStyle = 'rgba(40,30,20,.35)';
      g.lineWidth = Math.max(1, W / 1400);
      g.strokeRect(rc.x, rc.y, rc.w, rc.h);
    }
  }
  for (let r = 0; r < d.rows; r++)
    for (let c = 0; c < d.cols; c++) {
      const bi = r * d.cols + c,
        b = d.blocks[bi];
      if (b.under != null) continue;
      const R = blockRect(d, c, r, W, H),
        polys = blockPolys(b, R.x, R.y, R.w, R.h);
      polys.forEach((poly, pi) => {
        g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, bi * 31 + pi);
        pathPoly(g, poly);
        g.fill();
        dimUnlessHi(g, { t: 'qpiece', fabric: b.fabrics[pi] });
      });
      if (opts.seams) {
        g.strokeStyle = 'rgba(40,30,20,.35)';
        g.lineWidth = Math.max(1, W / 1400);
        polys.forEach(poly => {
          pathPoly(g, poly);
          g.stroke();
        });
      }
    }
}

export { drawBorders, drawBordersExploded, drawQuilt, explodedH };
