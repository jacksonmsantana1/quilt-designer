// Reads a picture of a quilt block and writes it in the grid notation of grid-blocks.js.
// @ts-check
//
// Pure (no DOM, no files): give it the picture's pixels, it gives back the notation, the colours it found, and how
// well the answer, drawn back, matches the picture. The steps:
//   1. find the block on the page (the largest patch of "ink": not the paper colour) and resample it to a square
//   2. the fabrics: group the colours (k-means in Lab, a colour space that matches the eye) into a few clusters
//   3. each cell of an n × n grid: try a plain square, a half-square triangle either way and an hourglass, and keep
//      the one whose regions are the most single-coloured (a plain square wins a tie: the simplest answer); where
//      cells stay poorly explained, try one split rectangle over two cells, or a large triangle over four
//   4. the grid size: step 3 for every n from 1 to 16; the smallest n that explains the picture about as well as
//      the best one wins (a finer grid can always copy a coarser one, so the simplest answer is kept)
//   5. draw the answer back over the picture: the share of pixels that agree, per cell and overall
// Not yet: perspective (photos taken at an angle), pieces off the grid (curves, odd angles).

const S = 240; // the block is resampled to S × S pixels

/** @typedef {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray, channels?: number }} Picture */

// ---- colour
const lin = c => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** sRGB 0..255 -> CIE Lab (D65). @returns {[number, number, number]} */
function lab(r, g, b) {
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047),
    y = f(0.2126 * R + 0.7152 * G + 0.0722 * B),
    z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// ---- 1. find the block and resample it
/** The pixel at (x, y) as [r, g, b]. @param {Picture} img */
const px = (img, x, y) => {
  const c = img.channels || 3,
    i = (y * img.width + x) * c;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

/**
 * The block's box on the page: when (nearly) the whole edge of the picture is one colour, that is paper; "ink" is
 * anything clearly different, and the block is the largest connected patch of ink (captions and legends are
 * smaller). A picture that is all block (its edge is fabric: several colours) gives the whole picture, and so does
 * a patch too small to be the block.
 * @param {Picture} img @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
function findBlock(img) {
  const { width: w, height: h } = img,
    whole = { x0: 0, y0: 0, x1: w, y1: h };
  // a frame a little inside the edge: screenshots and scans often have a dark strip at the very edge
  const mx = Math.floor(w * 0.03),
    my = Math.floor(h * 0.03),
    edge = [];
  for (let x = mx; x < w - mx; x += 2) edge.push(lab(...px(img, x, my)), lab(...px(img, x, h - 1 - my)));
  for (let y = my; y < h - my; y += 2) edge.push(lab(...px(img, mx, y)), lab(...px(img, w - 1 - mx, y)));
  // the paper: the middle colour of the frame (by lightness), and nearly all of the frame close to it
  const paper = [...edge].sort((a, b) => a[0] - b[0])[Math.floor(edge.length / 2)];
  if (edge.filter(c => dist2(c, paper) < 150).length < edge.length * 0.9) return whole;
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) ink[y * w + x] = dist2(lab(...px(img, x, y)), paper) > 150 ? 1 : 0;
  // connected patches of ink (4-neighbours), keeping the one with the largest box
  const seen = new Uint8Array(w * h);
  let box = { x0: 0, y0: 0, x1: w, y1: h },
    bestArea = 0;
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!ink[s] || seen[s]) continue;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(),
        x = p % w,
        y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !ink[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (area > bestArea) {
      bestArea = area;
      box = { x0, y0, x1: x1 + 1, y1: y1 + 1 };
    }
  }
  // too small to be the block (a picture that is all block, with a border of one fabric round it)
  return bestArea >= w * h * 0.25 ? box : whole;
}

/** The box resampled to S × S in Lab, each pixel the average of the picture's pixels it covers. */
function resample(img, { x0, y0, x1, y1 }) {
  // a little inside the box: the block's outline is not fabric
  const ix = (x1 - x0) * 0.012,
    iy = (y1 - y0) * 0.012;
  const bx0 = x0 + ix,
    by0 = y0 + iy,
    sw = (x1 - x0 - 2 * ix) / S,
    sh = (y1 - y0 - 2 * iy) / S;
  const out = new Array(S * S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const xa = Math.floor(bx0 + i * sw),
        xb = Math.max(xa + 1, Math.floor(bx0 + (i + 1) * sw)),
        ya = Math.floor(by0 + j * sh),
        yb = Math.max(ya + 1, Math.floor(by0 + (j + 1) * sh));
      let r = 0,
        g = 0,
        b = 0,
        k = 0;
      for (let y = ya; y < Math.min(yb, img.height); y++)
        for (let x = xa; x < Math.min(xb, img.width); x++) {
          const c = px(img, x, y);
          r += c[0];
          g += c[1];
          b += c[2];
          k++;
        }
      out[j * S + i] = lab(r / k, g / k, b / k);
    }
  return out;
}

// ---- seams
/** How strongly the colour changes at each pixel (0 on flat colour). */
function edges(L) {
  const e = new Float32Array(S * S);
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      e[i] = Math.sqrt(Math.max(dist2(L[i - 1], L[i + 1]), dist2(L[i - S], L[i + S])));
    }
  return e;
}

// ---- 2. the fabrics
/** k-means on the flat (non-seam) pixels; returns the centres. */
function kmeans(points, k) {
  // start from points far apart (k-means++ without the randomness: the farthest point each time)
  const centres = [points[Math.floor(points.length / 2)]];
  while (centres.length < k) {
    let far = points[0],
      fd = -1;
    for (const p of points) {
      const d = Math.min(...centres.map(c => dist2(p, c)));
      if (d > fd) {
        fd = d;
        far = p;
      }
    }
    centres.push(far);
  }
  let cost = 0;
  for (let it = 0; it < 12; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    cost = 0;
    for (const p of points) {
      let bi = 0,
        bd = Infinity;
      centres.forEach((c, i) => {
        const d = dist2(p, c);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      cost += bd;
      const s = sum[bi];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    sum.forEach((s, i) => {
      if (s[3]) centres[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return { centres, cost: cost / points.length };
}

/**
 * The fabrics: the number of clusters is the smallest k after which one more cluster no longer helps much; tiny
 * clusters (seam lines, specks of a print) are dropped. @returns {number[][]} cluster centres in Lab
 */
function fabrics(L, e) {
  // only pixels well inside a piece: two pixels from any colour change (the dark middle of a drawn seam line is
  // flat too, and would pass for a tiny fabric)
  // (a "change" is well above the picture's own grain: on a grainy photo every pixel differs a little)
  const grain = [...e].sort((a, b) => a - b)[Math.floor(e.length / 2)],
    change = Math.max(6, grain * 2.5);
  const pts = [];
  for (let y = 2; y < S - 2; y++)
    for (let x = 2 + (y % 3); x < S - 2; x += 3) {
      let flat = true;
      for (let dy = -2; dy <= 2 && flat; dy++)
        for (let dx = -2; dx <= 2; dx++) if (e[(y + dy) * S + x + dx] >= change) flat = false;
      if (flat) pts.push(L[y * S + x]);
    }
  const runs = [kmeans(pts, 1)];
  for (let k = 2; k <= 6; k++) {
    runs.push(kmeans(pts, k));
    const prev = runs[k - 2].cost,
      cur = runs[k - 1].cost;
    if (prev < 1.5 || cur > prev * 0.5) {
      runs.pop();
      break;
    }
  }
  let { centres } = runs[runs.length - 1];
  // drop clusters with almost no pixels
  const count = centres.map(() => 0);
  for (const p of pts) count[nearest(centres, p)]++;
  centres = centres.filter((_, i) => count[i] >= pts.length * 0.015);
  return centres;
}
const nearest = (centres, p) => {
  let bi = 0,
    bd = Infinity;
  centres.forEach((c, i) => {
    const d = dist2(p, c);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi;
};

// ---- 3. each cell, then pieces covering two or four cells
// the shapes a piece can be: for a point (u, v) in its rectangle (0..1), which region it is in, and how far from a seam
const SHAPES = {
  plain: { cost: 0, regions: 1, region: () => 0, near: () => 1 },
  '/': { cost: 0.02, regions: 2, region: (u, v) => (u + v < 1 ? 0 : 1), near: (u, v) => Math.abs(u + v - 1) },
  '\\': { cost: 0.02, regions: 2, region: (u, v) => (v > u ? 0 : 1), near: (u, v) => Math.abs(u - v) },
  q: {
    cost: 0.04,
    regions: 4,
    // top, right, bottom, left
    region: (u, v) => (v < u ? (u + v < 1 ? 0 : 1) : u + v > 1 ? 2 : 3),
    near: (u, v) => Math.min(Math.abs(u - v), Math.abs(u + v - 1)),
  },
};

/**
 * How well one shape explains the rectangle of w × h cells at cell (ci, cj): the fabric of each region (the one most
 * of its pixels have) and the share of pixels that disagree. Pixels on seams are left out.
 */
function fit(labels, e, n, ci, cj, w, h, kind) {
  const sh = SHAPES[kind],
    size = S / n,
    hist = Array.from({ length: sh.regions }, () => new Map());
  let total = 0;
  for (let y = Math.ceil(cj * size); y < (cj + h) * size; y++)
    for (let x = Math.ceil(ci * size); x < (ci + w) * size; x++) {
      const cu = (x + 0.5) / size - ci,
        cv = (y + 0.5) / size - cj;
      // near the cells' own borders (seams and outlines), or on a colour change: left out
      if (cu % 1 < 0.07 || cu % 1 > 0.93 || cv % 1 < 0.07 || cv % 1 > 0.93 || e[y * S + x] > 25) continue;
      const u = cu / w,
        v = cv / h;
      if (sh.near(u, v) < 0.06 / Math.max(w, h)) continue;
      const m = hist[sh.region(u, v)],
        l = labels[y * S + x];
      m.set(l, (m.get(l) || 0) + 1);
      total++;
    }
  if (!total) return null;
  const clusters = [];
  let good = 0;
  for (const m of hist) {
    let bl = 0,
      bc = 0;
    for (const [l, c] of m)
      if (c > bc) {
        bc = c;
        bl = l;
      }
    clusters.push(bl);
    good += bc;
  }
  // a split whose sides are one fabric is a plain piece said the long way
  if (sh.regions > 1 && new Set(clusters).size === 1) return null;
  const miss = 1 - good / total;
  return { x: ci, y: cj, w, h, kind, clusters, miss, score: miss + sh.cost };
}

const bestOf = list => list.filter(Boolean).reduce((a, b) => (!a || b.score < a.score ? b : a), null);

/**
 * The pieces: the best shape for every cell; then, where cells are poorly explained, a split rectangle over two
 * cells (1 × 2 or 2 × 1) or a half-square triangle over 2 × 2 is tried, and kept when it explains them clearly
 * better. A piece always starts at its top-left cell, as the notation writes it.
 */
function pieces(labels, e, n) {
  const one = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) one.push(bestOf(Object.keys(SHAPES).map(k => fit(labels, e, n, i, j, 1, 1, k))));
  const taken = new Array(n * n).fill(false),
    out = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      if (taken[j * n + i]) continue;
      let best = one[j * n + i];
      if (best.miss > 0.05)
        for (const [w, h] of [
          [1, 2],
          [2, 1],
          [2, 2],
        ]) {
          if (i + w > n || j + h > n) continue;
          const covered = [];
          for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) covered.push(y * n + x);
          if (covered.some(k => taken[k])) continue;
          // the cells as they are, against one split piece over all of them
          const alone = covered.reduce((s, k) => s + one[k].miss, 0) / covered.length;
          const big = bestOf(['/', '\\'].map(k => fit(labels, e, n, i, j, w, h, k)));
          if (big && big.miss < alone * 0.5 && big.miss < 0.08 && (best.w * best.h === 1 || big.miss < best.miss))
            best = big;
        }
      out.push(best);
      for (let y = j; y < j + best.h; y++) for (let x = i; x < i + best.w; x++) taken[y * n + x] = true;
    }
  return out;
}

/** The fabric (cluster) a piece has at pixel (x, y) of the S × S block, cells `size` pixels wide. */
/**
 * Which neighbouring quarters of an hourglass are one piece: same fabric and no seam printed between them (the
 * half-diagonal from their shared corner to the centre is plain). Quarters are top, right, bottom, left; the pair
 * sharing a corner is named by it. Pictures without printed seams show none, so their quarters stay apart.
 * @returns {Set<'TR' | 'BR' | 'BL' | 'TL'>}
 */
function joinedQuarters(p, e, n) {
  const size = S / n,
    x0 = p.x * size,
    y0 = p.y * size,
    w = p.w * size,
    h = p.h * size,
    cx = x0 + w / 2,
    cy = y0 + h / 2;
  const corners = { TR: [x0 + w, y0, 0, 1], BR: [x0 + w, y0 + h, 1, 2], BL: [x0, y0 + h, 2, 3], TL: [x0, y0, 3, 0] };
  const out = new Set();
  for (const [name, [ax, ay, q1, q2]] of Object.entries(corners)) {
    if (p.clusters[q1] !== p.clusters[q2]) continue;
    // the strongest colour change near the half-diagonal, averaged along its middle
    let sum = 0,
      k = 0;
    for (let t = 0.25; t <= 0.75; t += 0.05) {
      const x = Math.round(ax + (cx - ax) * t),
        y = Math.round(ay + (cy - ay) * t);
      let m = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          m = Math.max(m, e[Math.min(S - 1, Math.max(0, y + dy)) * S + Math.min(S - 1, Math.max(0, x + dx))]);
      sum += m;
      k++;
    }
    if (sum / k < 12) out.add(/** @type {any} */ (name));
  }
  return out;
}

/**
 * The notation for an hourglass whose joined quarters make halves: a half-square triangle (two pairs joined), a
 * three-triangle unit (one pair), or the hourglass itself. r: the roles of the top, right, bottom, left quarters.
 */
function quarterToken(r, joined) {
  const [t, ri, b, l] = r;
  if (joined.has('TL') && joined.has('BR')) return `${t}/${ri}`;
  if (joined.has('TR') && joined.has('BL')) return `${b}\\${t}`;
  if (joined.has('TL')) return `${t}/${ri}${b}`;
  if (joined.has('BR')) return `${t}${l}/${ri}`;
  if (joined.has('BL')) return `${b}\\${t}${ri}`;
  if (joined.has('TR')) return `${b}${l}\\${t}`;
  return 'q' + r.join('');
}

function clusterAt(p, x, y, size) {
  const u = ((x + 0.5) / size - p.x) / p.w,
    v = ((y + 0.5) / size - p.y) / p.h;
  return p.clusters[SHAPES[p.kind].region(u, v)];
}

// ---- the answer
/**
 * Reads a block. `fabrics` are the clusters found, in sRGB; `role` maps each to a colour role (by area: the largest 0,
 * the next 1, and so on, up to 5). `match` is the share of the picture's pixels the answer draws in the same fabric
 * (seams aside); `cells` the same per cell, row by row, to show where it is unsure. `pieces` is the answer as
 * rectangles of cells with a shape and a fabric per region; `pieceAt` the piece over each cell.
 * @param {Picture} img
 */
function readBlock(img) {
  const box = findBlock(img),
    L = resample(img, box),
    e = edges(L);
  const centres = fabrics(L, e);
  const labels = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) labels[i] = nearest(centres, L[i]);
  // 4. the grid size: the smallest n that explains the picture nearly as well as the best n
  const tries = [];
  for (let n = 1; n <= 16; n++) {
    const ps = pieces(labels, e, n);
    tries.push({ n, ps, explained: ps.reduce((s, p) => s + (1 - p.miss) * p.w * p.h, 0) / (n * n) });
  }
  const top = Math.max(...tries.map(t => t.explained));
  const { n, ps } = tries.find(t => t.explained >= top - 0.015);
  // colour roles by area in the answer: the largest is the background
  const area = centres.map(() => 0);
  for (const p of ps) for (const l of p.clusters) area[l] += (p.w * p.h) / p.clusters.length;
  const byArea = centres.map((_, i) => i).sort((a, b) => area[b] - area[a]);
  const role = centres.map(() => 0);
  byArea.forEach((ci, rank) => (role[ci] = rank)); // at most 6 fabrics are found: roles 0 to 5
  // the notation: each piece's token at its top-left cell, "-", "|" and "+" over the rest of it
  const grid = Array.from({ length: n }, () => new Array(n).fill(''));
  for (const p of ps) {
    const r = p.clusters.map(l => role[l]);
    let tok;
    if (p.kind === 'plain') tok = String(r[0]);
    else if (p.kind === 'q') tok = quarterToken(r, joinedQuarters(p, e, n));
    else tok = r[0] + p.kind + r[1];
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++)
        grid[y][x] = x === p.x && y === p.y ? tok : y === p.y ? '-' : x === p.x ? '|' : '+';
  }
  const pad = Math.max(...grid.flat().map(t => t.length));
  const rows = grid
    .map(r =>
      r
        .map(t => t.padEnd(pad))
        .join(' ')
        .trimEnd(),
    )
    .join('\n');
  // 5. draw it back: the share of (non-seam) pixels whose fabric the answer gets right
  const pieceAt = new Array(n * n);
  for (const p of ps)
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) pieceAt[y * n + x] = p;
  let agree = 0,
    counted = 0;
  const cellMatch = pieceAt.map(() => [0, 0]);
  const size = S / n;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (e[y * S + x] > 25) continue;
      const ci = Math.min(n - 1, Math.floor(x / size)),
        cj = Math.min(n - 1, Math.floor(y / size)),
        ok = clusterAt(pieceAt[cj * n + ci], x, y, size) === labels[y * S + x] ? 1 : 0;
      agree += ok;
      counted++;
      cellMatch[cj * n + ci][0] += ok;
      cellMatch[cj * n + ci][1]++;
    }
  return {
    n,
    rows,
    fabrics: centres.map(labToRgb),
    role,
    match: counted ? agree / counted : 0,
    cells: cellMatch.map(([a, t]) => (t ? a / t : 0)),
    pieces: ps,
    pieceAt,
    box,
    grids: tries.map(t => ({ n: t.n, explained: t.explained })), // how well each grid size explained the picture
  };
}

/** Lab -> sRGB 0..255 (to show the fabrics found). */
function labToRgb([L, A, B]) {
  const fy = (L + 16) / 116,
    fx = fy + A / 500,
    fz = fy - B / 200;
  const inv = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047,
    Y = inv(fy),
    Z = inv(fz) * 1.08883;
  const g = c =>
    Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  return [
    g(3.2406 * X - 1.5372 * Y - 0.4986 * Z),
    g(-0.9689 * X + 1.8758 * Y + 0.0415 * Z),
    g(0.0557 * X - 0.204 * Y + 1.057 * Z),
  ];
}

export { S, clusterAt, findBlock, readBlock };
