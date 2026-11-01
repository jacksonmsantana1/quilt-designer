// The pieces a block drawn on graph paper is cut into, found from its seam lines (pure).
// @ts-check
//
// The block is the square 0..n (in cells, y down). Seam lines are straight segments inside it, at any angle. The
// pieces are the regions the lines and the block's edges enclose:
//   1. every line is split where it meets another line (or an edge), so the lines become a network of edges
//      between points
//   2. edges that end in the open (a seam that stops short) enclose nothing: they are trimmed away, end by end
//   3. a shape that touches nothing else (a square drawn in the middle with no seam out to the edges) can't be
//      pieced as it is: it is left out and reported, so the person can add a seam joining it to the rest
//   4. walking round each region, always taking the sharpest turn, gives its outline; points in the middle of a
//      straight side are dropped, so a triangle stays a triangle even where a neighbour's seam meets its side
// Coordinates are rounded to a millionth of a cell to recognise the same point reached two ways.

/** @typedef {number[]} Point @typedef {Point[]} Poly @typedef {number[]} Line  [x1, y1, x2, y2] */

const EPS = 1e-9;
const keyOf = (x, y) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;

/** Twice the signed area of a polygon (positive when it runs clockwise on screen, y down). @param {Poly} p */
function area2(p) {
  let a = 0;
  p.forEach(([x0, y0], i) => {
    const [x1, y1] = p[(i + 1) % p.length];
    a += x0 * y1 - x1 * y0;
  });
  return a;
}

/** Where segment ab meets segment cd: the points they share (none, one, or the two ends of an overlap). */
function meet(a, b, c, d) {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = d[0] - c[0],
    sy = d[1] - c[1],
    den = rx * sy - ry * sx,
    qx = c[0] - a[0],
    qy = c[1] - a[1];
  if (Math.abs(den) < EPS) {
    // parallel: they share points only when on one line, then where each one's ends lie on the other
    if (Math.abs(qx * ry - qy * rx) > EPS) return [];
    return [a, b, c, d].filter((p, i) => (i < 2 ? onSegment(p, c, d) : onSegment(p, a, b)));
  }
  const t = (qx * sy - qy * sx) / den,
    u = (qx * ry - qy * rx) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return [];
  return [[a[0] + t * rx, a[1] + t * ry]];
}
/** Is p on the segment ab (ends included)? */
function onSegment(p, a, b) {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    len2 = rx * rx + ry * ry;
  if (len2 < EPS) return Math.hypot(p[0] - a[0], p[1] - a[1]) < 1e-7;
  const t = ((p[0] - a[0]) * rx + (p[1] - a[1]) * ry) / len2,
    dx = a[0] + t * rx - p[0],
    dy = a[1] + t * ry - p[1];
  return t > -EPS && t < 1 + EPS && dx * dx + dy * dy < 1e-14;
}

/** Drops the points in the middle of straight sides. @param {Poly} p @returns {Poly} */
function tidyPoly(p) {
  const out = p.filter((q, i) => {
    const a = p[(i + p.length - 1) % p.length],
      b = p[(i + 1) % p.length];
    return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
  return out.length >= 3 ? out : p;
}

/**
 * The pieces of an n × n block cut by seam lines, as polygons in cells, and whether some shape floats free of the
 * rest (and so was left out). @param {number} n @param {Line[]} lines
 * @returns {{ pieces: Poly[], floating: boolean }}
 */
function seamFaces(n, lines) {
  /** @type {[Point, Point][]} */
  const segs = [
    [
      [0, 0],
      [n, 0],
    ],
    [
      [n, 0],
      [n, n],
    ],
    [
      [n, n],
      [0, n],
    ],
    [
      [0, n],
      [0, 0],
    ],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    // inside the block only, and long enough to be a seam
    const c = v => Math.max(0, Math.min(n, v));
    const a = [c(x1), c(y1)],
      b = [c(x2), c(y2)];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6) segs.push([a, b]);
  }
  // 1. split every segment at the points it shares with the others
  /** @type {Map<string, Point>} */
  const pts = new Map();
  const point = p => {
    const k = keyOf(p[0], p[1]);
    if (!pts.has(k)) pts.set(k, [p[0], p[1]]);
    return k;
  };
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  const link = (a, b) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  segs.forEach(([a, b], i) => {
    const cuts = [a, b];
    segs.forEach(([c, d], j) => {
      if (i !== j) cuts.push(...meet(a, b, c, d));
    });
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len2 = dx * dx + dy * dy;
    const keys = [
      ...new Set(
        cuts
          .map(p => ({ p, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 }))
          .sort((u, v) => u.t - v.t)
          .map(({ p }) => point(p)),
      ),
    ];
    for (let k = 1; k < keys.length; k++) link(keys[k - 1], keys[k]);
  });
  // 2. trim seams that end in the open
  for (let trimmed = true; trimmed;) {
    trimmed = false;
    for (const [k, nb] of adj)
      if (nb.size < 2) {
        for (const o of nb) adj.get(o).delete(k);
        adj.delete(k);
        trimmed = true;
      }
  }
  // 3. keep what is joined to the block's edge
  const start = keyOf(0, 0),
    joined = new Set([start]),
    todo = [start];
  while (todo.length) for (const o of adj.get(todo.pop()) || []) if (!joined.has(o)) (joined.add(o), todo.push(o));
  const floating = [...adj.keys()].some(k => !joined.has(k));
  for (const k of [...adj.keys()]) if (!joined.has(k)) adj.delete(k);
  // 4. walk round each region: at each point, leave by the edge that turns most sharply
  const angle = (from, to) => {
    const a = pts.get(from),
      b = pts.get(to);
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  /** @type {Map<string, string[]>} each point's neighbours in order of angle */
  const around = new Map();
  for (const [k, nb] of adj)
    around.set(
      k,
      [...nb].sort((u, v) => angle(k, u) - angle(k, v)),
    );
  const used = new Set();
  /** @type {Poly[]} */
  const pieces = [];
  for (const [k0, nb] of around)
    for (const k1 of nb) {
      if (used.has(k0 + '>' + k1)) continue;
      const ring = [];
      let a = k0,
        b = k1;
      while (!used.has(a + '>' + b)) {
        used.add(a + '>' + b);
        ring.push(pts.get(a));
        const list = around.get(b),
          i = list.indexOf(a);
        [a, b] = [b, list[(i + list.length - 1) % list.length]];
      }
      // the regions come out one way round, the outside of the block the other
      if (area2(ring) > EPS) pieces.push(tidyPoly(ring));
    }
  return { pieces, floating };
}

/** Is the point inside the polygon? (Points on an edge may go either way.) @param {number} x @param {number} y @param {Poly} poly */
function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export { area2, insidePoly, seamFaces };
