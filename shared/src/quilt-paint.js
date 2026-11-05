// Painting a quilt top on a canvas: blocks, sashing and borders, each piece in its fabric at its real size. It is told how
// to find a fabric, so the web app and the phone app share it while keeping their fabrics their own way. No side effects
// when loaded; it only needs a canvas when it is called.
import {
  blockPlace,
  borderCornerSlot,
  borderFab,
  borderSidePieces,
  bordersOf,
  blockOutline,
  cellCount,
  pathPoly,
  placedPolys,
  plainButted,
  polyCentre,
  quiltMm,
  sashOf,
  sashRects,
  settingPieces,
  tilePolys,
} from './geometry.js';

/** A fabric as painting needs it: its picture, and how many cm of cloth the picture's width covers. @typedef {{ canvas: HTMLCanvasElement, cm: number }} PaintFabric */

const DEG = 180 / Math.PI;
// Fabric is drawn at its real size: each block is design.blockMm across.
// turn (radians) turns the print with its block: on point the pieces are cut on grain in the block, so their
// stripes run diagonally on the quilt

/** A print placed so its point (u, v) (fractions of one repeat) sits at (cx, cy): a fussy cut. */
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
/** A print at its real size, starting somewhere of its own for each `seed`. */
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
/**
 * The fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print.
 * @param {(id: string) => PaintFabric} fabricById
 */
function pieceFillWith(fabricById, g, b, pi, poly, pxPerCm, seed, turn = 0) {
  const fab = fabricById(b.fabrics[pi]),
    f = b.fussy && b.fussy[pi];
  if (!f) return fabricFill(g, fab, pxPerCm, seed, turn);
  const [cx, cy] = polyCentre(poly);
  return fabricFillAt(g, fab, pxPerCm, cx, cy, f[0], f[1], turn);
}

/**
 * @param {{ fabricById: (id: string) => PaintFabric, dim?: (g: CanvasRenderingContext2D, info: object) => void }} o
 *   dim: called after each piece is filled, with what the piece is (the cutting guide dims the ones not pointed at)
 */
function quiltPainter({ fabricById, dim = () => {} }) {
  const pieceFill = (g, b, pi, poly, pxPerCm, seed, turn = 0) =>
    pieceFillWith(fabricById, g, b, pi, poly, pxPerCm, seed, turn);

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
          dim(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, pc.slot), corner: false });
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
        dim(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, borderCornerSlot(b)), corner: !plainButted(b) });
        if (seams && !plainButted(b)) {
          g.strokeStyle = 'rgba(40,30,20,.35)';
          g.lineWidth = Math.max(1, W / 1400);
          g.strokeRect(cx * k, cy * k, T * k, T * k);
        }
      }
      off += T;
    }
  }
  // a cornerstone pieced as a block (sashing.cornerBlock), filling the cornerstone rc
  // (rc may be turned, on point: the block turns with it)
  function drawCornerBlock(g, cb, rc, pxPerCm, seed, seams, lineW) {
    const polys = placedPolys(cb, rc);
    polys.forEach((poly, pi) => {
      g.fillStyle = pieceFill(g, cb, pi, poly, pxPerCm, seed * 31 + pi, rc.turn || 0);
      pathPoly(g, poly);
      g.fill();
      dim(g, { t: 'sash', kind: 'corner', fabric: cb.fabrics[pi] });
    });
    if (!seams) return;
    g.strokeStyle = 'rgba(40,30,20,.35)';
    g.lineWidth = lineW;
    for (const poly of polys) {
      pathPoly(g, poly);
      g.stroke();
    }
  }
  /**
   * Draws a quilt top (borders, sashing and blocks) into a W × H box at the context's origin.
   * @param {CanvasRenderingContext2D} g @param {number} W @param {number} H
   * @param {{ seams?: boolean, design: any }} opts
   */
  function drawQuilt(g, W, H, opts) {
    const d = opts.design;
    if (bordersOf(d).length) drawBorders(g, d, W, H, W / (quiltMm(d).W / 10), opts.seams);
    const q = quiltMm(d),
      pxPerCm = W / (q.W / 10),
      s = sashOf(d);
    if (d.mosaic) {
      // a shape mosaic instead of blocks: each shape in its fabric
      const polys = tilePolys(d, W, H);
      polys.forEach((poly, i) => {
        g.fillStyle = fabricFill(g, fabricById(d.mosaic.fabrics[i]), pxPerCm, 500 + i);
        pathPoly(g, poly);
        g.fill();
        dim(g, { t: 'qpiece', fabric: d.mosaic.fabrics[i] });
      });
      if (opts.seams) {
        g.strokeStyle = 'rgba(40,30,20,.35)';
        g.lineWidth = Math.max(1, W / 1400);
        for (const poly of polys) {
          pathPoly(g, poly);
          g.stroke();
        }
      }
      return;
    }
    for (const [k, rc] of /** @type {any[]} */ (sashRects(d, W, H)).entries()) {
      if (rc.kind === 'corner' && s.cornerBlock) {
        drawCornerBlock(g, s.cornerBlock, rc, pxPerCm, 900 + k, opts.seams, Math.max(1, W / 1400));
        continue;
      }
      // a strip or cornerstone: turned on point, its print along it
      g.fillStyle = fabricFill(
        g,
        fabricById(rc.kind === 'corner' ? s.corner : s.fabric),
        pxPerCm,
        900 + k,
        rc.turn || 0,
      );
      pathPoly(g, blockOutline(rc));
      g.fill();
      dim(g, { t: 'sash', kind: rc.kind });
      if (opts.seams) {
        g.strokeStyle = 'rgba(40,30,20,.35)';
        g.lineWidth = Math.max(1, W / 1400);
        g.stroke();
      }
    }
    // on point: the setting triangles along the edges
    for (const [k, sp] of settingPieces(d, W, H).entries()) {
      g.fillStyle = fabricFill(g, fabricById(d.settingFabric || 'b0'), pxPerCm, 700 + k);
      pathPoly(g, sp.poly);
      g.fill();
      dim(g, { t: 'setting', kind: sp.kind });
      if (opts.seams) {
        g.strokeStyle = 'rgba(40,30,20,.35)';
        g.lineWidth = Math.max(1, W / 1400);
        g.stroke();
      }
    }
    for (let bi = 0, n = cellCount(d); bi < n; bi++) {
      const b = d.blocks[bi];
      if (!b || b.under != null) continue;
      const Pl = blockPlace(d, bi, W, H),
        polys = placedPolys(b, Pl);
      polys.forEach((poly, pi) => {
        g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, bi * 31 + pi, Pl.turn); // the print turns with the block
        pathPoly(g, poly);
        g.fill();
        dim(g, { t: 'qpiece', fabric: b.fabrics[pi] });
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
  return { drawBorders, drawCornerBlock, drawQuilt };
}

export { fabricFill, fabricFillAt, pieceFillWith, quiltPainter };
