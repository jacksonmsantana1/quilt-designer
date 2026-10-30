// @ts-check
// Shape mosaics (pure): a quilt top made of one shape repeated all over (Grandmother's flower garden is hexagons,
// tumbling blocks are diamonds), instead of a grid of square blocks. Here: the shapes of a mosaic in millimetres,
// which shape is where, and which shapes touch.
//
// Hexagons stand on a point and sit in rows, every other row shifted half a hexagon. Diamonds lie in the same
// hexagons, three to each (top, left and right: a cube). Triangles sit in rows too, points up and down in turn. The
// edges are trimmed straight (half shapes at the sides, points cut off at the top and bottom), so the borders fit
// like on any quilt. Shapes are numbered row by row, left to right; a mosaic keeps one fabric per shape in that order.
// `mm` is always the length of one side of the shape.

/** @typedef {import('./types.js').Mosaic} Mosaic @typedef {import('./types.js').Poly} Poly */
/**
 * One shape of a mosaic: its polygon in mm (y down), its row and place in the row, whether it is whole (false: cut
 * by the edge of the quilt), its group (diamonds: the three of one cube share it; other shapes: their own) and which
 * way it lies (diamonds: 0 top, 1 left, 2 right of a cube; triangles: 0 point down, 1 point up; hexagons: 0).
 * @typedef {{ poly: Poly, row: number, col: number, whole: boolean, group: number, way: number }} Tile
 */

/** The shapes a mosaic can be made of. */
const MOSAIC_SHAPES = ['hex', 'diamond', 'triangle'];
/** What the shapes are called, one and many. */
const SHAPE_NAMES = {
  hex: ['hexagon', 'hexagons'],
  diamond: ['diamond', 'diamonds'],
  triangle: ['triangle', 'triangles'],
};

const R3 = Math.sqrt(3);

/** Finished width and height of a mosaic in mm. @param {Mosaic} m */
function mosaicMm(m) {
  const s = m.mm;
  // triangles: cols points-up across each row, rows of their height; hexagons and diamonds: hexagons across and down
  if (m.shape === 'triangle') return { w: m.cols * s, h: (m.rows * R3 * s) / 2 };
  return { w: m.cols * R3 * s, h: s + (m.rows - 1) * 1.5 * s };
}

/** Keeps the part of a convex polygon inside the rectangle 0..w × 0..h (Sutherland–Hodgman). @param {Poly} poly */
function clipToRect(poly, w, h) {
  /** @type {[(p: number[]) => number, number][]} each edge: the coordinate it limits and the side kept */
  const edges = [
    [p => p[0], 0],
    [p => -p[0], -w],
    [p => p[1], 0],
    [p => -p[1], -h],
  ];
  let out = poly;
  for (const [f, lim] of edges) {
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i],
        b = out[(i + 1) % out.length],
        fa = f(a) - lim,
        fb = f(b) - lim;
      if (fa >= 0) next.push(a);
      if (fa * fb < 0) {
        const t = fa / (fa - fb);
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    out = next;
    if (!out.length) break;
  }
  return out;
}

/** Area of a polygon (any winding, made positive). @param {Poly} p */
function area(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

const cache = new Map();
/**
 * The shapes of a mosaic, in fabric order (row by row, left to right). The same mosaic size always gives the same
 * shapes, so the list is kept and shared: don't change it.
 * @param {Mosaic} m @returns {Tile[]}
 */
function mosaicTiles(m) {
  const key = `${m.shape} ${m.cols} ${m.rows} ${m.mm}`;
  if (cache.has(key)) return cache.get(key);
  const s = m.mm,
    { w: W, h: H } = mosaicMm(m);
  /** @type {Tile[]} */
  const tiles = [];
  // one row: its shapes (whole, before trimming) left to right, each with its group
  const addRow = (row, shapes) => {
    let col = 0;
    for (const [shape, group, way = 0] of shapes) {
      const whole = area(shape),
        poly = clipToRect(shape, W, H);
      if (poly.length < 3 || area(poly) < whole * 0.01) continue;
      // group -1: a group of its own (every shape but diamonds)
      tiles.push({
        poly,
        row,
        col: col++,
        whole: area(poly) > whole * 0.999,
        group: group < 0 ? tiles.length : group,
        way,
      });
    }
  };
  if (m.shape === 'triangle') {
    const h = (R3 * s) / 2;
    for (let row = 0; row < m.rows; row++) {
      // points down and points up in turn; every other row shifted half a triangle
      const y0 = row * h,
        y1 = y0 + h,
        shift = row % 2 ? s / 2 : 0,
        shapes = [];
      for (let j = -1; j <= m.cols + 1; j++) {
        const x = shift + j * s;
        shapes.push([
          [x - s / 2, y0],
          [x + s / 2, y0],
          [x, y1],
        ]);
        shapes.push([
          [x, y1],
          [x + s / 2, y0],
          [x + s, y1],
        ]);
      }
      const mid = t => t[0][0] + t[1][0] + t[2][0];
      shapes.sort((a, b) => mid(a) - mid(b));
      addRow(
        row,
        shapes.map(t => [t, -1, t[2][1] > t[0][1] ? 0 : 1]),
      );
    }
  } else {
    const w = R3 * s;
    let n = 0;
    for (let row = 0; row < m.rows; row++) {
      // even rows: a hexagon centred on each edge (cut in half there); odd rows: whole hexagons edge to edge
      const shift = row % 2 ? w / 2 : 0,
        cy = s / 2 + row * 1.5 * s,
        shapes = [];
      for (let j = 0; j <= m.cols; j++) {
        const c = [shift + j * w, cy],
          hx = hexagon(c[0], cy, s),
          g = n++;
        // diamonds: the cube's top, left and right, meeting at the hexagon's centre
        if (m.shape === 'diamond')
          shapes.push(
            [[c, hx[5], hx[0], hx[1]], g, 0],
            [[c, hx[3], hx[4], hx[5]], g, 1],
            [[c, hx[1], hx[2], hx[3]], g, 2],
          );
        else shapes.push([hx, -1]);
      }
      addRow(row, shapes);
    }
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, tiles);
  return tiles;
}

/** A hexagon standing on a point, centred at (cx, cy), side s: top, then clockwise. @returns {Poly} */
function hexagon(cx, cy, s) {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    out.push([cx + s * Math.cos(a), cy + s * Math.sin(a)]);
  }
  return out;
}

/** Whether a design is a shape mosaic (its blocks are then kept but not shown). @param {any} d */
const isMosaic = d => !!(d && d.mosaic);

/**
 * A new mosaic about the size of a w × h mm quilt top, every shape in one fabric.
 * @param {number} w @param {number} h @param {string} fabric @param {number} [mm] side of the shape
 * @param {Mosaic['shape']} [shape] @returns {Mosaic}
 */
function newMosaic(w, h, fabric, mm = 50, shape = 'hex') {
  const fit = x => Math.max(1, Math.min(60, Math.round(x)));
  const [cols, rows] =
    shape === 'triangle'
      ? [fit(w / mm), fit(h / ((R3 * mm) / 2))]
      : [fit(w / (R3 * mm)), fit((h - mm) / (1.5 * mm) + 1)];
  const m = { shape, mm, cols, rows, fabrics: [] };
  m.fabrics = Array(tileCount(m)).fill(fabric);
  return m;
}

/** How many shapes a mosaic has (the length of its fabric list). @param {Mosaic} m */
const tileCount = m => mosaicTiles(m).length;

/** The shape under a point (mm), or -1. @param {Mosaic} m @param {number} x @param {number} y */
function tileAt(m, x, y) {
  return mosaicTiles(m).findIndex(t => inside(x, y, t.poly));
}
/** @param {Poly} poly */
function inside(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const nbCache = new Map();
/**
 * The shapes that share a side with one shape (six round a hexagon: the petals of a rosette; four round a diamond;
 * three round a triangle). Found from the sides themselves, so it holds for every shape, at the edges too.
 * @param {Mosaic} m @param {number} i @returns {number[]}
 */
function tileNeighbours(m, i) {
  const key = `${m.shape} ${m.cols} ${m.rows} ${m.mm}`;
  if (!nbCache.has(key)) {
    const tiles = mosaicTiles(m),
      bySide = new Map(),
      pt = q => `${q[0].toFixed(3)},${q[1].toFixed(3)}`;
    tiles.forEach((t, k) =>
      t.poly.forEach((a, j) => {
        const side = [pt(a), pt(t.poly[(j + 1) % t.poly.length])].sort().join(' ');
        if (!bySide.has(side)) bySide.set(side, []);
        bySide.get(side).push(k);
      }),
    );
    const nb = tiles.map(() => new Set());
    for (const ks of bySide.values()) for (const a of ks) for (const b of ks) if (a !== b) nb[a].add(b);
    if (nbCache.size > 50) nbCache.clear();
    nbCache.set(
      key,
      nb.map(x => [...x]),
    );
  }
  return nbCache.get(key)[i] || [];
}

/**
 * The shapes a paint tool reaches from the one clicked: 'one' just it, 'rosette' it and the shapes around it (a
 * flower: Grandmother's flower garden; for diamonds, the three of its cube), 'row' its whole row, 'way' every shape
 * lying the same way (every top of a cube, or every triangle pointing up: tumbling blocks in three clicks).
 * @param {Mosaic} m @param {number} i @param {'one' | 'rosette' | 'row' | 'way'} tool @returns {number[]}
 */
function tilesForTool(m, i, tool) {
  const tiles = mosaicTiles(m);
  if (!tiles[i]) return [];
  if (tool === 'rosette' && m.shape === 'diamond')
    return tiles.map((t, k) => (t.group === tiles[i].group ? k : -1)).filter(k => k >= 0);
  if (tool === 'rosette') return [i, ...tileNeighbours(m, i)];
  // (all hexagons lie the same way: there, one)
  if (tool === 'way' && m.shape !== 'hex')
    return tiles.map((t, k) => (t.way === tiles[i].way ? k : -1)).filter(k => k >= 0);
  if (tool === 'row') return tiles.map((t, k) => (t.row === tiles[i].row ? k : -1)).filter(k => k >= 0);
  return [i];
}

export {
  MOSAIC_SHAPES,
  SHAPE_NAMES,
  isMosaic,
  mosaicMm,
  mosaicTiles,
  newMosaic,
  tileAt,
  tileCount,
  tileNeighbours,
  tilesForTool,
};
