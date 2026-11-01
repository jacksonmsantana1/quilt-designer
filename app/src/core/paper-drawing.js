// @ts-check
// The block editor's graph paper (pure): seam lines drawn at any angle between points of a fine grid, and fills
// (a point and a fabric role) that colour the piece they fall in. The pieces themselves are worked out from the
// lines by @quilt/shared/seam-faces.js; a fill colours the piece it lies in (the last one wins, and a piece with no
// fill is background). Coordinates are in cells of the block's grid, y down. Every change returns a new drawing.
// Symmetry repeats a line or a fill: 'mirror' left-right, top-bottom and both; 'turn' a quarter, a half and three
// quarters about the centre.
import { insidePoly, seamFaces } from '@quilt/shared/seam-faces.js';
import { placeName } from '@quilt/shared/grid-blocks.js';

/** @typedef {{ n: number, lines: number[][], fills: number[][] }} Paper */
/** @typedef {'off' | 'mirror' | 'turn'} DrawSym */

/** An empty sheet of n × n cells. @param {number} n @returns {Paper} */
const blankPaper = n => ({ n, lines: [], fills: [] });

/** A point moved by each step of a symmetry (itself first). @param {number} n @param {DrawSym} sym @param {number} x @param {number} y */
function copiesOf(n, sym, x, y) {
  if (sym === 'mirror')
    return [
      [x, y],
      [n - x, y],
      [x, n - y],
      [n - x, n - y],
    ];
  if (sym === 'turn')
    return [
      [x, y],
      [n - y, x],
      [n - x, n - y],
      [y, n - x],
    ];
  return [[x, y]];
}

const r6 = v => Math.round(v * 1e6) / 1e6;
/** A line written the one way (ends in order), to recognise the same line drawn either way. */
const lineKey = (/** @type {number[]} */ l) => {
  const [x1, y1, x2, y2] = l,
    a = `${r6(x1)},${r6(y1)}`,
    b = `${r6(x2)},${r6(y2)}`;
  return a < b ? `${a} ${b}` : `${b} ${a}`;
};

/**
 * Adds a seam line from (x1, y1) to (x2, y2), and its symmetric copies; a line already there isn't added again.
 * @param {Paper} pp @param {DrawSym} [sym] @returns {Paper}
 */
function addLine(pp, x1, y1, x2, y2, sym = 'off') {
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-9) return pp;
  const have = new Set(pp.lines.map(lineKey)),
    a = copiesOf(pp.n, sym, x1, y1),
    b = copiesOf(pp.n, sym, x2, y2),
    lines = pp.lines.slice();
  a.forEach(([ax, ay], i) => {
    const l = [ax, ay, b[i][0], b[i][1]],
      k = lineKey(l);
    if (!have.has(k)) (have.add(k), lines.push(l));
  });
  return lines.length === pp.lines.length ? pp : { ...pp, lines };
}

/** How far a point is from a line. */
function distance(px, py, /** @type {number[]} */ l) {
  const [x1, y1, x2, y2] = l,
    dx = x2 - x1,
    dy = y2 - y1,
    t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
}

/**
 * Takes away the line nearest a point (within `reach` cells), and its symmetric copies.
 * @param {Paper} pp @param {number} x @param {number} y @param {number} reach @param {DrawSym} [sym] @returns {Paper}
 */
function eraseLine(pp, x, y, reach, sym = 'off') {
  let best = -1,
    bestD = reach;
  pp.lines.forEach((l, i) => {
    const d = distance(x, y, l);
    if (d <= bestD) [best, bestD] = [i, d];
  });
  if (best < 0) return pp;
  const [x1, y1, x2, y2] = pp.lines[best],
    a = copiesOf(pp.n, sym, x1, y1),
    b = copiesOf(pp.n, sym, x2, y2),
    gone = new Set(a.map(([ax, ay], i) => lineKey([ax, ay, b[i][0], b[i][1]])));
  return { ...pp, lines: pp.lines.filter(l => !gone.has(lineKey(l))) };
}

/**
 * The pieces the lines cut, each with its role, and whether a shape floats free of the rest (left out).
 * @param {Paper} pp @returns {{ pieces: { poly: number[][], role: number }[], floating: boolean }}
 */
function paperPieces(pp) {
  const { pieces, floating } = seamFaces(pp.n, pp.lines);
  return {
    floating,
    pieces: pieces.map(poly => {
      let role = 0;
      for (const [x, y, r] of pp.fills) if (insidePoly(x, y, poly)) role = r;
      return { poly, role };
    }),
  };
}

/**
 * Colours the piece under a point (and the symmetric ones) in a role. Fills of the same pieces from before are
 * dropped, so the list stays as long as the pieces. Returns the same drawing when nothing changes.
 * @param {Paper} pp @param {number} x @param {number} y @param {number} role @param {DrawSym} [sym] @returns {Paper}
 */
function fill(pp, x, y, role, sym = 'off') {
  const { pieces } = paperPieces(pp),
    at = (px, py) => pieces.findIndex(p => insidePoly(px, py, p.poly)),
    marks = copiesOf(pp.n, sym, x, y).map(([px, py]) => [px, py, role]),
    hit = new Set(marks.map(([px, py]) => at(px, py)));
  if ([...hit].every(i => i < 0 || pieces[i].role === role)) return pp;
  const kept = pp.fills.filter(([px, py]) => !hit.has(at(px, py)));
  return { ...pp, fills: [...kept, ...marks] };
}

/** One point well inside a polygon: the middle of its largest triangle from the first corner. @param {number[][]} poly */
function inner(poly) {
  let best = null,
    bestA = -1;
  for (let i = 1; i + 1 < poly.length; i++) {
    const [a, b, c] = [poly[0], poly[i], poly[i + 1]],
      ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (ar > bestA) [best, bestA] = [[(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3], ar];
  }
  return best;
}

/**
 * A sheet drawn from a block's pieces (cell drawings, traditional blocks): their sides become seam lines and each
 * piece gets a fill in its role. @param {number} n @param {{ poly: number[][], role: number }[]} parts polygons in cells
 * @returns {Paper}
 */
function paperFromParts(n, parts) {
  const onEdge = (/** @type {number[]} */ [x1, y1, x2, y2]) =>
    (Math.abs(x1 - x2) < 1e-9 && (Math.abs(x1) < 1e-9 || Math.abs(x1 - n) < 1e-9)) ||
    (Math.abs(y1 - y2) < 1e-9 && (Math.abs(y1) < 1e-9 || Math.abs(y1 - n) < 1e-9));
  const seen = new Set(),
    lines = [];
  for (const { poly } of parts)
    poly.forEach(([x, y], i) => {
      const [x2, y2] = poly[(i + 1) % poly.length],
        l = [r6(x), r6(y), r6(x2), r6(y2)],
        k = lineKey(l);
      if (!onEdge(l) && !seen.has(k)) (seen.add(k), lines.push(l));
    });
  const fills = parts.filter(p => p.role).map(p => [...inner(p.poly).map(r6), p.role]);
  return { n, lines, fills };
}

/** A piece's name: what it is and where (like the grid blocks' names). @param {number[][]} poly */
function pieceName(poly) {
  const axis = poly.every(([x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return Math.abs(x - x2) < 1e-9 || Math.abs(y - y2) < 1e-9;
  });
  const xs = poly.map(p => p[0]),
    ys = poly.map(p => p[1]),
    square = Math.abs(Math.max(...xs) - Math.min(...xs) - (Math.max(...ys) - Math.min(...ys))) < 1e-9;
  const kind = poly.length === 3 ? 'Triangle' : poly.length === 4 && axis ? (square ? 'Square' : 'Rectangle') : 'Shape';
  return `${kind} · ${placeName(poly)}`;
}

/**
 * The sheet as a block definition for the quilt (see @quilt/shared/drawn-blocks.js), or null when a shape floats
 * free or there is nothing to piece. @param {Paper} pp @param {string} label
 * @returns {import('@quilt/shared/types.js').DrawnBlock | null}
 */
function paperDef(pp, label) {
  const { pieces, floating } = paperPieces(pp);
  if (floating || !pieces.length) return null;
  const rows = Array.from({ length: pp.n }, () => new Array(pp.n).fill('x').join(' ')).join('\n');
  // only the fills that colour something, one per piece
  const fills = [];
  for (const p of pieces) {
    const f = [...pp.fills].reverse().find(([x, y]) => insidePoly(x, y, p.poly));
    if (f && f[2]) fills.push(f.slice());
  }
  return {
    label,
    n: pp.n,
    rows,
    extra: pieces.map(p => [pieceName(p.poly), p.role, p.poly.flat().map(r6)]),
    paper: { lines: pp.lines.map(l => l.map(r6)), fills },
  };
}

/** The roles a sheet's pieces use, in order. @param {Paper} pp @returns {number[]} */
const paperRoles = pp => [...new Set(paperPieces(pp).pieces.map(p => p.role))].sort((a, b) => a - b);

export { addLine, blankPaper, copiesOf, eraseLine, fill, paperDef, paperFromParts, paperPieces, paperRoles };
