// @ts-check
// The block editor's drawing (pure): pieces on an n × n grid of cells, written and read in the grid notation of
// @quilt/shared/grid-blocks.js. Each piece covers a rectangle of whole cells and has a shape and a colour role per
// part:
//   's'            a square (or a rectangle of joined cells): [role]
//   '/'            a half-square triangle cut along "/": [upper left, lower right]
//   '\'            a half-square triangle cut along "\": [lower left, upper right]
//   'q'            an hourglass (quarter-square triangles): [top, right, bottom, left]
//   '^' 'v' '<' '>'  a flying goose pointing up, down, left or right: [goose, sky]
// Every change returns a new drawing and never changes its input. Symmetry repeats a change on the matching pieces:
// 'mirror' left-right, top-bottom and both; 'turn' a quarter, a half and three quarters about the centre.

/** @typedef {{ x: number, y: number, w: number, h: number, k: string, r: number[] }} Piece */
/** @typedef {{ n: number, pieces: Piece[] }} Drawing */
/** @typedef {'off' | 'mirror' | 'turn'} DrawSym */

/** How many parts each shape has. */
const PARTS = { s: 1, '/': 2, '\\': 2, q: 4, '^': 2, v: 2, '<': 2, '>': 2 };
const SHAPES = Object.keys(PARTS);

/** An n × n grid of plain squares in one role. @param {number} n @param {number} [role] @returns {Drawing} */
function blankDrawing(n, role = 0) {
  const pieces = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pieces.push({ x, y, w: 1, h: 1, k: 's', r: [role] });
  return { n, pieces };
}

/** The drawing in the grid notation: one line per row. @param {Drawing} dr @returns {string} */
function toRows(dr) {
  const g = Array.from({ length: dr.n }, () => new Array(dr.n).fill('0'));
  for (const p of dr.pieces) {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) g[p.y + j][p.x + i] = i && j ? '+' : i ? '-' : '|';
    const [a, b] = p.r;
    g[p.y][p.x] =
      p.k === 's'
        ? `${a}`
        : p.k === '/' || p.k === '\\'
          ? `${a}${p.k}${b}`
          : p.k === 'q'
            ? `q${p.r.join('')}`
            : `${p.k}${a}${b}`;
  }
  return g.map(row => row.join(' ')).join('\n');
}

/**
 * A drawing read back from the grid notation, or null when it uses something the editor can't draw (holes, extra
 * pieces, half triangles cut in two). @param {number} n @param {string} rows @returns {Drawing | null}
 */
function fromRows(n, rows) {
  const g = rows
    .trim()
    .split('\n')
    .map(l => l.trim().split(/\s+/));
  if (g.length !== n || g.some(r => r.length !== n)) return null;
  const taken = g.map(r => r.map(() => false));
  /** @type {Piece[]} */
  const pieces = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (taken[y][x]) continue;
      const t = g[y][x];
      let m, k, r;
      if ((m = /^([0-5])$/.exec(t))) [k, r] = ['s', [+m[1]]];
      else if ((m = /^([0-5])([/\\])([0-5])$/.exec(t))) [k, r] = [m[2], [+m[1], +m[3]]];
      else if ((m = /^q([0-5])([0-5])([0-5])([0-5])$/.exec(t))) [k, r] = ['q', [+m[1], +m[2], +m[3], +m[4]]];
      else if ((m = /^([\^v<>])([0-5])([0-5])$/.exec(t))) [k, r] = [m[1], [+m[2], +m[3]]];
      else return null;
      let w = 1,
        h = 1;
      while (x + w < n && g[y][x + w] === '-' && !taken[y][x + w]) w++;
      while (y + h < n && g[y + h][x] === '|' && !taken[y + h][x]) h++;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          if (g[y + j][x + i] !== (i && j ? '+' : i ? '-' : j ? '|' : t)) return null;
          taken[y + j][x + i] = true;
        }
      pieces.push({ x, y, w, h, k, r });
    }
  return { n, pieces };
}

/** The piece covering a point (in cells), or -1. @param {Drawing} dr @param {number} x @param {number} y */
const pieceAt = (dr, x, y) => dr.pieces.findIndex(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);

/**
 * Which part of a shape a point is in; u, v go from 0 to 1 across the piece. @param {string} k @param {number} u
 * @param {number} v @returns {number}
 */
function partAt(k, u, v) {
  if (k === '/') return u + v < 1 ? 0 : 1;
  if (k === '\\') return v > u ? 0 : 1;
  if (k === 'q') return v <= u && v <= 1 - u ? 0 : u >= v && u >= 1 - v ? 1 : v >= u && v >= 1 - u ? 2 : 3;
  // a goose: the big triangle with its point at the middle of one side
  const inGoose = {
    '^': v >= 2 * Math.abs(u - 0.5),
    v: 1 - v >= 2 * Math.abs(u - 0.5),
    '<': u >= 2 * Math.abs(v - 0.5),
    '>': 1 - u >= 2 * Math.abs(v - 0.5),
  }[k];
  return inGoose === undefined ? 0 : inGoose ? 0 : 1;
}

// ---- symmetry: where a piece goes, and how its shape and parts change on the way
/** @typedef {{ rect: (p: Piece, n: number) => {x: number, y: number, w: number, h: number}, shape: (k: string, r: number[]) => [string, number[]] }} Move */
/** @type {Move} */
const LR = {
  rect: (p, n) => ({ x: n - p.x - p.w, y: p.y, w: p.w, h: p.h }),
  shape: (k, r) =>
    k === '/'
      ? ['\\', [r[1], r[0]]]
      : k === '\\'
        ? ['/', [r[1], r[0]]]
        : k === 'q'
          ? ['q', [r[0], r[3], r[2], r[1]]]
          : k === '<'
            ? ['>', r]
            : k === '>'
              ? ['<', r]
              : [k, r],
};
/** @type {Move} */
const TB = {
  rect: (p, n) => ({ x: p.x, y: n - p.y - p.h, w: p.w, h: p.h }),
  shape: (k, r) =>
    k === '/'
      ? ['\\', r]
      : k === '\\'
        ? ['/', r]
        : k === 'q'
          ? ['q', [r[2], r[1], r[0], r[3]]]
          : k === '^'
            ? ['v', r]
            : k === 'v'
              ? ['^', r]
              : [k, r],
};
/** A quarter turn clockwise about the centre. @type {Move} */
const TURN = {
  rect: (p, n) => ({ x: n - p.y - p.h, y: p.x, w: p.h, h: p.w }),
  shape: (k, r) =>
    k === '/'
      ? ['\\', [r[1], r[0]]]
      : k === '\\'
        ? ['/', r]
        : k === 'q'
          ? ['q', [r[3], r[0], r[1], r[2]]]
          : k === '^'
            ? ['>', r]
            : k === '>'
              ? ['v', r]
              : k === 'v'
                ? ['<', r]
                : k === '<'
                  ? ['^', r]
                  : [k, r],
};
/** @param {Move[]} ms @returns {Move} */
const chain = ms => ({
  rect: (p, n) => ms.reduce((q, m) => ({ ...q, ...m.rect(q, n) }), p),
  shape: (k, r) => ms.reduce(([kk, rr], m) => m.shape(kk, rr), [k, r]),
});
/** The moves a symmetry repeats a change with. @param {DrawSym} sym @returns {Move[]} */
const movesOf = sym =>
  sym === 'mirror'
    ? [LR, TB, chain([LR, TB])]
    : sym === 'turn'
      ? [TURN, chain([TURN, TURN]), chain([TURN, TURN, TURN])]
      : [];

const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * Puts a changed piece in place, and its symmetric copies where a piece of the same size sits.
 * @param {Drawing} dr @param {number} i @param {Piece} np @param {DrawSym} sym @returns {Drawing}
 */
function place(dr, i, np, sym) {
  const pieces = dr.pieces.slice();
  pieces[i] = np;
  for (const m of movesOf(sym)) {
    const rect = m.rect(np, dr.n),
      j = pieces.findIndex(p => sameRect(p, rect));
    if (j < 0 || j === i) continue;
    const [k, r] = m.shape(np.k, np.r);
    pieces[j] = { ...rect, k, r: r.slice() };
  }
  return { n: dr.n, pieces };
}

/**
 * Paints the part of the piece under a point (in cells) in a role, first giving the piece the tool's shape.
 * Returns the same drawing when nothing changes.
 * @param {Drawing} dr @param {number} x @param {number} y @param {string} shape @param {number} role @param {DrawSym} [sym]
 */
function paint(dr, x, y, shape, role, sym = 'off') {
  const i = pieceAt(dr, x, y);
  if (i < 0 || !(shape in PARTS)) return dr;
  const p = dr.pieces[i];
  const r = p.k === shape ? p.r.slice() : new Array(PARTS[shape]).fill(p.r[0]);
  r[partAt(shape, (x - p.x) / p.w, (y - p.y) / p.h)] = role;
  if (shape === p.k && r.every((v, k) => v === p.r[k])) return dr;
  return place(dr, i, { ...p, k: shape, r }, sym);
}

/** Joins whole cells into one: the rectangle grows to take in every piece it cuts through. */
function joinOne(dr, x0, y0, x1, y1) {
  let a = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1) + 1, y1: Math.max(y0, y1) + 1 };
  const cuts = p => p.x < a.x1 && p.x + p.w > a.x0 && p.y < a.y1 && p.y + p.h > a.y0;
  for (let grew = true; grew;) {
    grew = false;
    for (const p of dr.pieces)
      if (cuts(p)) {
        const b = {
          x0: Math.min(a.x0, p.x),
          y0: Math.min(a.y0, p.y),
          x1: Math.max(a.x1, p.x + p.w),
          y1: Math.max(a.y1, p.y + p.h),
        };
        if (b.x0 !== a.x0 || b.y0 !== a.y0 || b.x1 !== a.x1 || b.y1 !== a.y1) [a, grew] = [b, true];
      }
  }
  const inside = dr.pieces.filter(cuts);
  if (inside.length < 2) return dr;
  const first = inside.find(p => p.x === a.x0 && p.y === a.y0) || inside[0];
  return {
    n: dr.n,
    pieces: [
      ...dr.pieces.filter(p => !cuts(p)),
      { x: a.x0, y: a.y0, w: a.x1 - a.x0, h: a.y1 - a.y0, k: 's', r: [first.r[0]] },
    ],
  };
}

/**
 * Joins the cells from (x0, y0) to (x1, y1) (whole cells, either corner first) into one square or rectangle, in
 * the role of its top-left piece; symmetry joins the matching cells too. @param {Drawing} dr @param {DrawSym} [sym]
 */
function join(dr, x0, y0, x1, y1, sym = 'off') {
  let out = joinOne(dr, x0, y0, x1, y1);
  if (out === dr) return dr;
  for (const m of movesOf(sym)) {
    const lo = m.rect(
      { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1, k: 's', r: [0] },
      dr.n,
    );
    out = joinOne(out, lo.x, lo.y, lo.x + lo.w - 1, lo.y + lo.h - 1);
  }
  return out;
}

/** Splits the piece under a point back into single cells (and the matching pieces with symmetry). @param {Drawing} dr @param {number} x @param {number} y @param {DrawSym} [sym] */
function split(dr, x, y, sym = 'off') {
  const i = pieceAt(dr, x, y);
  if (i < 0) return dr;
  const p = dr.pieces[i];
  if (p.w === 1 && p.h === 1) return dr;
  const rects = [p, ...movesOf(sym).map(m => m.rect(p, dr.n))];
  const gone = dr.pieces.filter(q => rects.some(r => sameRect(q, r)));
  const pieces = dr.pieces.filter(q => !gone.includes(q));
  for (const q of gone)
    for (let j = 0; j < q.h; j++)
      for (let k = 0; k < q.w; k++) pieces.push({ x: q.x + k, y: q.y + j, w: 1, h: 1, k: 's', r: [q.r[0]] });
  return { n: dr.n, pieces };
}

/** The roles a drawing uses, in order. @param {Drawing} dr @returns {number[]} */
const rolesUsed = dr => [...new Set(dr.pieces.flatMap(p => p.r))].sort((a, b) => a - b);

export { PARTS, SHAPES, blankDrawing, fromRows, join, paint, partAt, pieceAt, rolesUsed, split, toRows };
