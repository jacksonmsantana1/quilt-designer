// @ts-check
// Reads a LINE DRAWING of a quilt block (black ink on white: seams drawn as lines, fabrics drawn as dots, hatching or
// scribble) into cells, with two masks:
//   forms: the seams. A cell is cut along a diagonal where a continuous thin line of ink runs the length of it, with a
//          clearer side next to it (that tells a seam from dark fill). The grid lines are found from the ink itself,
//          because hand-drawn blocks are not evenly spaced, and a few pixels of shift are allowed, because the
//          diagonals do not pass exactly through the corners.
//   fill:  the ink that is not a seam. Each piece's texture (how much ink, and whether the strokes run one way) says
//          which fabric it is: blank, dots, stripes, scribble.
// Pure (no DOM, no files): give it the page's grey pixels. Shapes: "S" a square, "/" cut from bottom-left to top-right,
// "\" cut from top-left to bottom-right, "X" cut both ways (an hourglass).

/** @typedef {{ width: number, height: number, gray: ArrayLike<number> }} Page */
/** @typedef {'S' | '/' | '\\' | 'X'} Shape */
/** @typedef {{ dens: number, coh: number, ang: number }} Texture */
/** @typedef {{ score: number, cover: number, longest: number, a: number, b: number }} Evidence */
/**
 * @typedef {{ shape: Shape, ev: [Evidence, Evidence], regions: Texture[], roles: number[], patch: string, feats: number[], size: number }} Cell
 */
/** @typedef {{ n: number, frame: { x0: number, y0: number, x1: number, y1: number }, LX: number[], LY: number[], cells: Cell[][] }} Reading */

const PATCH = 12; // each cell is kept as a PATCH × PATCH picture (ink share, 0..15) for the learning
const INK = 140; // darker than this is ink

/** The pixels of a box as ink (1) or paper (0). @param {Page} p @param {number[]} box [x, y, w, h] */
function inkMask(p, [bx, by, bw, bh]) {
  const m = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) m[y * bw + x] = p.gray[(by + y) * p.width + bx + x] < INK ? 1 : 0;
  return m;
}

/** The frame of the block: the outermost rows and columns that are mostly ink. The block is square. */
function findFrame(m, bw, bh) {
  const col = x => {
    let c = 0;
    for (let y = 0; y < bh; y++) c += m[y * bw + x];
    return c / bh;
  };
  const row = y => {
    let c = 0;
    for (let x = 0; x < bw; x++) c += m[y * bw + x];
    return c / bw;
  };
  const cs = [...Array(bw).keys()].filter(x => col(x) > 0.5),
    rs = [...Array(bh).keys()].filter(y => row(y) > 0.5);
  if (!cs.length || !rs.length) return { x0: 0, y0: 0, x1: bw - 1, y1: bh - 1 };
  const x0 = Math.min(...cs),
    y0 = Math.min(...rs);
  let x1 = Math.max(...cs),
    y1 = Math.max(...rs);
  const s = Math.min(x1 - x0, y1 - y0);
  if (Math.abs(x1 - x0 - (y1 - y0)) > 0.07 * s) {
    x1 = x0 + s;
    y1 = y0 + s;
  }
  return { x0, y0, x1, y1 };
}

/** The n + 1 grid lines along one axis: the strongest ink columns (or rows) near where an even grid would have them. */
function lattice(/** @type {number[]} */ prof, a0, a1, n) {
  const pos = [],
    step = (a1 - a0) / n;
  for (let k = 0; k <= n; k++) {
    const e = a0 + k * step,
      w = Math.max(2, Math.round(step * 0.22));
    let best = Math.round(e),
      bv = -1;
    for (let x = Math.round(e) - w; x <= Math.round(e) + w; x++) {
      const v = (prof[x - 1] || 0) + (prof[x] || 0) + (prof[x + 1] || 0);
      if (v > bv) {
        bv = v;
        best = x;
      }
    }
    pos.push(k === 0 || k === n ? e : best);
  }
  return pos;
}

/** Whether there is ink at a point. */
const inkAt = (m, bw, bh, x, y) => {
  const xx = Math.round(x),
    yy = Math.round(y);
  return xx >= 0 && yy >= 0 && xx < bw && yy < bh && m[yy * bw + xx] ? 1 : 0;
};

/**
 * How much of a cell diagonal is a seam: continuous ink along it, with at least one side clearer than the line. The
 * best of a few sideways shifts.
 * @returns {Evidence}
 */
function diagonalEvidence(m, bw, bh, cx0, cy0, cw, ch, slash) {
  const T = 40,
    off = Math.max(3, Math.round(cw * 0.1)),
    len = Math.hypot(cw, ch),
    pxu = ((slash ? 1 : -1) * ch) / len,
    pyu = cw / len;
  /** @type {Evidence | null} */
  let best = null;
  for (const shift of [-3, -2, -1, 0, 1, 2, 3]) {
    let on = 0,
      sideA = 0,
      sideB = 0,
      run = 0,
      longest = 0;
    for (let k = 0; k < T; k++) {
      const t = 0.12 + (0.76 * k) / (T - 1),
        x = cx0 + t * cw + pxu * shift,
        y = (slash ? cy0 + (1 - t) * ch : cy0 + t * ch) + pyu * shift;
      const hit = inkAt(m, bw, bh, x, y);
      on += hit;
      run = hit ? run + 1 : 0;
      longest = Math.max(longest, run);
      sideA += inkAt(m, bw, bh, x + pxu * off, y + pyu * off);
      sideB += inkAt(m, bw, bh, x - pxu * off, y - pyu * off);
    }
    const cover = on / T,
      a = sideA / T,
      b = sideB / T,
      score = Math.min(longest / T, cover) * Math.max(0, 1 - Math.min(a, b) / Math.max(cover, 1e-6));
    if (!best || score > best.score) best = { score, cover, longest: longest / T, a, b };
  }
  return /** @type {Evidence} */ (best);
}

/** The regions of a shape, as polygons in the cell (0..1, y down), in the order of the notation. @param {Shape} shape */
function regionsOf(shape) {
  if (shape === '/')
    return [
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ], // upper left
      [
        [1, 0],
        [1, 1],
        [0, 1],
      ], // lower right
    ];
  if (shape === '\\')
    return [
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ], // lower left
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ], // upper right
    ];
  if (shape === 'X')
    return [
      [
        [0, 0],
        [1, 0],
        [0.5, 0.5],
      ], // top
      [
        [1, 0],
        [1, 1],
        [0.5, 0.5],
      ], // right
      [
        [1, 1],
        [0, 1],
        [0.5, 0.5],
      ], // bottom
      [
        [0, 1],
        [0, 0],
        [0.5, 0.5],
      ], // left
    ];
  return [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ];
}

/** Which of the four triangles of a square a point (u, v in 0..1) is in: top, right, bottom, left. @param {number} u @param {number} v */
function quadrant(u, v) {
  const up = v < u, // above the "\" diagonal
    left = u + v < 1; // above and left of the "/" diagonal
  return up && left ? 0 : up && !left ? 1 : !up && !left ? 2 : 3;
}

/** Which region of a shape a point (u, v in 0..1) is in. @param {Shape} shape @param {number} u @param {number} v */
function regionAt(shape, u, v) {
  if (shape === '/') return u + v < 1 ? 0 : 1;
  if (shape === '\\') return u - v < 0 ? 0 : 1;
  if (shape === 'X') return quadrant(u, v);
  return 0;
}

/**
 * The texture of each region of a cell, from the ink that is not on a seam.
 * @returns {Texture[]}
 */
function textures(m, bw, bh, x0, y0, cw, ch, /** @type {Shape} */ shape) {
  const pad = Math.max(3, Math.round(cw * 0.09)),
    count = regionsOf(shape).length;
  const acc = Array.from({ length: count }, () => ({ n: 0, k: 0, gxx: 0, gyy: 0, gxy: 0 }));
  for (let y = Math.floor(y0 + pad); y < y0 + ch - pad; y++)
    for (let x = Math.floor(x0 + pad); x < x0 + cw - pad; x++) {
      const u = (x - x0) / cw,
        v = (y - y0) / ch,
        dSlash = (u + v - 1) * cw * 0.7071,
        dBack = (u - v) * cw * 0.7071;
      if ((shape === '/' || shape === 'X') && Math.abs(dSlash) < pad) continue;
      if ((shape === '\\' || shape === 'X') && Math.abs(dBack) < pad) continue;
      const r = regionAt(shape, u, v);
      const a = acc[r];
      a.n++;
      a.k += m[y * bw + x];
      const ix = (m[y * bw + Math.min(bw - 1, x + 1)] - m[y * bw + Math.max(0, x - 1)]) / 2,
        iy = (m[Math.min(bh - 1, y + 1) * bw + x] - m[Math.max(0, y - 1) * bw + x]) / 2;
      a.gxx += ix * ix;
      a.gyy += iy * iy;
      a.gxy += ix * iy;
    }
  return acc.map(a => {
    const tot = a.gxx + a.gyy + 1e-9;
    return {
      dens: a.n ? a.k / a.n : 0,
      coh: Math.hypot(a.gxx - a.gyy, 2 * a.gxy) / tot, // 0: dots or scribble .. 1: parallel strokes
      ang: 0.5 * Math.atan2(2 * a.gxy, a.gxx - a.gyy),
    };
  });
}

/** The cell as a small picture of ink share, as hex digits (one per pixel). */
function patchOf(m, bw, bh, x0, y0, cw, ch) {
  let s = '';
  for (let j = 0; j < PATCH; j++)
    for (let i = 0; i < PATCH; i++) {
      let k = 0,
        n = 0;
      for (
        let y = Math.floor(y0 + (j * ch) / PATCH);
        y < Math.max(Math.floor(y0 + (j * ch) / PATCH) + 1, y0 + ((j + 1) * ch) / PATCH);
        y++
      )
        for (
          let x = Math.floor(x0 + (i * cw) / PATCH);
          x < Math.max(Math.floor(x0 + (i * cw) / PATCH) + 1, x0 + ((i + 1) * cw) / PATCH);
          x++
        ) {
          n++;
          k += x >= 0 && y >= 0 && x < bw && y < bh ? m[y * bw + x] : 0;
        }
      s += Math.round((15 * k) / Math.max(1, n)).toString(16);
    }
  return s;
}

/**
 * How strong the seam evidence must be, by the width of a cell in pixels: in small cells (an 8 × 8 block on a small
 * picture) dense hatching and scribble look like seams, so more is asked. Tuned on corrected readings.
 * @param {number} cw
 */
const shapeThreshold = cw => Math.min(0.6, Math.max(0.35, 0.35 + (28 - cw) * 0.0143));

/** The same with one threshold for every cell size. @param {number[]} f @param {number} t @returns {Shape} */
function shapeByThreshold(f, t) {
  const s = f[0] > t,
    b = f[5] > t;
  return s && b ? 'X' : s && f[0] >= f[5] ? '/' : b ? CUT_BACK : 'S';
}

/** What the seam rules read from the evidence numbers of a cell cw pixels wide. @param {number[]} f @param {number} cw @returns {Shape} */
function ruleShape(f, cw) {
  const t = shapeThreshold(cw),
    s = f[0] > t,
    b = f[5] > t;
  return s && b ? 'X' : s && f[0] >= f[5] ? '/' : b ? CUT_BACK : 'S';
}

/** The "back" cut: from the top left to the bottom right. */
const CUT_BACK = '\\';
const WHITE = 0.04; // a piece with less ink than this (share of its area) is blank paper

/** Two regions are one fabric when their textures are less than this far apart. */
const FABRIC_GAP = 1.5;
/**
 * How alike two textures are: 0 identical, FABRIC_GAP and more, different fabrics. Tuned on corrected readings: how much
 * ink matters most (the same hatching drawn in a different direction is still the same fabric).
 * @param {Texture} a @param {Texture} b
 */
const textureGap = (a, b) => Math.abs(a.dens - b.dens) / 0.25 + Math.abs(a.coh - b.coh) / 2;

/**
 * Gives every region a fabric role: 0 for blank paper, then 1.. for the textures, alike ones sharing a role (at most 5).
 * @param {Cell[][]} cells
 */
function assignRoles(cells) {
  /** @type {{ t: Texture, n: number }[]} */
  const groups = [];
  for (const row of cells)
    for (const c of row) {
      c.roles = c.regions.map(t => {
        if (t.dens < WHITE) return 0;
        let best = -1,
          bd = FABRIC_GAP;
        groups.forEach((g, i) => {
          const d = textureGap(t, g.t);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best < 0 && groups.length < 5) {
          groups.push({ t: { ...t }, n: 1 });
          return groups.length;
        }
        if (best < 0) {
          // too many fabrics: the nearest one
          let nd = Infinity;
          groups.forEach((g, i) => {
            const d = textureGap(t, g.t);
            if (d < nd) {
              nd = d;
              best = i;
            }
          });
        }
        const g = groups[best];
        g.t = { dens: (g.t.dens * g.n + t.dens) / (g.n + 1), coh: (g.t.coh * g.n + t.coh) / (g.n + 1), ang: g.t.ang };
        g.n++;
        return best + 1;
      });
    }
}

/** The numbers the learning gets besides the picture: the evidence for each diagonal. @param {[Evidence, Evidence]} ev */
const featuresOf = ev => [
  ev[0].score,
  ev[0].cover,
  ev[0].longest,
  ev[0].a,
  ev[0].b,
  ev[1].score,
  ev[1].cover,
  ev[1].longest,
  ev[1].a,
  ev[1].b,
];

/**
 * Reads one block.
 * @param {Page} page @param {number[]} box [x, y, w, h] in the page @param {number} n cells across and down
 * @param {{ threshold?: number, classify?: ((c: { feats: number[], patch: string, size: number }) => Shape | null) | null }} [opts]
 * @returns {Reading}
 */
function readDrawing(page, box, n, opts = {}) {
  const [, , bw, bh] = box,
    m = inkMask(page, box),
    frame = findFrame(m, bw, bh);
  const colP = Array.from({ length: bw }, (_, x) => {
      let c = 0;
      for (let y = frame.y0; y < frame.y1; y++) c += m[y * bw + x];
      return c;
    }),
    rowP = Array.from({ length: bh }, (_, y) => {
      let c = 0;
      for (let x = frame.x0; x < frame.x1; x++) c += m[y * bw + x];
      return c;
    });
  const LX = lattice(colP, frame.x0, frame.x1, n),
    LY = lattice(rowP, frame.y0, frame.y1, n);
  /** @type {Cell[][]} */
  const cells = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const x0 = LX[c],
        y0 = LY[r],
        cw = LX[c + 1] - x0,
        ch = LY[r + 1] - y0;
      /** @type {[Evidence, Evidence]} */
      const ev = [
        diagonalEvidence(m, bw, bh, x0, y0, cw, ch, true),
        diagonalEvidence(m, bw, bh, x0, y0, cw, ch, false),
      ];
      const feats = featuresOf(ev),
        patch = patchOf(m, bw, bh, x0, y0, cw, ch);
      /** @type {Shape} */
      let shape = ruleShape(feats, opts.threshold != null ? 0 : cw);
      if (opts.threshold != null) shape = shapeByThreshold(feats, opts.threshold);
      const learned = opts.classify ? opts.classify({ feats, patch, size: Math.round(cw) }) : null;
      if (learned) shape = learned;
      row.push({
        shape,
        ev,
        regions: textures(m, bw, bh, x0, y0, cw, ch, shape),
        roles: [],
        patch,
        feats,
        size: Math.round(cw),
      });
    }
    cells.push(row);
  }
  assignRoles(cells);
  return { n, frame, LX, LY, cells };
}

/** Re-measures one cell's regions after its shape was changed by hand. @param {Page} page @param {number[]} box */
function remeasure(page, box, reading, r, c, /** @type {Shape} */ shape) {
  const [, , bw, bh] = box,
    m = inkMask(page, box),
    cell = reading.cells[r][c];
  const x0 = reading.LX[c],
    y0 = reading.LY[r];
  cell.shape = shape;
  cell.regions = textures(m, bw, bh, x0, y0, reading.LX[c + 1] - x0, reading.LY[r + 1] - y0, shape);
  return cell;
}

/** The block in the grid notation (grid-blocks.js), one row per line. @param {Reading} reading */
function notation(reading) {
  return reading.cells
    .map(row =>
      row
        .map(c => {
          const R = c.roles;
          if (c.shape === '/') return `${R[0]}/${R[1]}`;
          if (c.shape === '\\') return `${R[0]}\\${R[1]}`;
          if (c.shape === 'X') return `q${R[0]}${R[1]}${R[2]}${R[3]}`;
          return String(R[0]);
        })
        .join(' '),
    )
    .join('\n');
}

export {
  FABRIC_GAP,
  ruleShape,
  shapeThreshold,
  PATCH,
  WHITE,
  assignRoles,
  featuresOf,
  inkMask,
  notation,
  quadrant,
  readDrawing,
  regionAt,
  regionsOf,
  remeasure,
  textureGap,
};
