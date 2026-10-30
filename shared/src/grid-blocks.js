// Blocks written as a grid of cells: a short way to draw a traditional pieced block (see blocks.js).
// @ts-check
//
// A block is an n × n grid, written one row per line, one token per cell, separated by spaces:
//   0 1 2       a square of colour role 0 (background), 1 (main) or 2 (accent)
//   a/b         half-square triangle cut along "/": a is the upper-left half, b the lower-right half
//   a\b         half-square triangle cut along "\": a is the lower-left half, b the upper-right half
//   qTRBL       quarter-square triangles (an hourglass): the roles of the top, right, bottom and left triangles
//   ^ab vab <ab >ab   a flying goose pointing up, down, left or right: a is the goose, b the sky
//   -  |  +     this cell belongs to the piece that starts to its left (-), above it (|), or up and to the left (+).
//               A piece covers the rectangle its first cell starts: "1 -" over "| +" is one 2 × 2 square,
//               "^10 -" one goose two cells wide.
//   x           nothing here: filled by `extra` pieces, or by the turned copies of `fourfold`
// Rows are written with String.raw, so a backslash needs no escaping.
//
// `fourfold`: the rows draw one corner (any rectangle at the top left); it is copied three more times, turned a
// quarter, a half and three quarters about the block's centre (Bear's paw, Dutchman's puzzle).
// `extra`: pieces that aren't grid shapes (a snowball's octagon): [name, role, [x, y, x, y, ...] in cells].
//
// Part names say what the piece is and where: "Triangle · row 2, column 3 · upper left".

/** @typedef {import('./types.js').Part} Part */
/** @typedef {{ n: number, rows: string, fourfold?: boolean, extra?: [string, number, number[]][] }} GridDef */

const KIND = { sq: 'Square', rect: 'Rectangle', tri: 'Triangle', goose: 'Goose', sky: 'Sky' };

/**
 * The pieces of one grid, in cells: [kind, role, polygon].
 * @param {string} text @returns {[string, number, number[][]][]}
 */
function parseGrid(text) {
  const cells = text
    .trim()
    .split('\n')
    .map(l => l.trim().split(/\s+/));
  const h = cells.length,
    taken = cells.map(r => r.map(t => t === 'x'));
  const at = (x, y) => (y < h && x < cells[y].length ? cells[y][x] : null);
  const role = c => {
    if (!/^[012]$/.test(c)) throw new Error(`colour role must be 0, 1 or 2, not "${c}"`);
    return +c;
  };
  /** @type {[string, number, number[][]][]} */
  const out = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < cells[y].length; x++) {
      const t = cells[y][x];
      if (taken[y][x]) continue;
      if ('-|+'.includes(t)) throw new Error(`row ${y + 1}, column ${x + 1}: "${t}" belongs to no piece`);
      // the piece's rectangle: "-" cells to the right, "|" cells below, "+" inside
      let w = 1,
        hh = 1;
      while (at(x + w, y) === '-' && !taken[y][x + w]) w++;
      while (at(x, y + hh) === '|' && !taken[y + hh][x]) hh++;
      for (let j = 0; j < hh; j++)
        for (let i = 0; i < w; i++) {
          const want = i && j ? '+' : i ? '-' : j ? '|' : t;
          if (at(x + i, y + j) !== want)
            throw new Error(
              `row ${y + j + 1}, column ${x + i + 1}: expected "${want}" inside the piece at row ${y + 1}, column ${x + 1}`,
            );
          taken[y + j][x + i] = true;
        }
      const x1 = x + w,
        y1 = y + hh,
        c = [x + w / 2, y + hh / 2];
      const [p00, p10, p11, p01] = [
        [x, y],
        [x1, y],
        [x1, y1],
        [x, y1],
      ];
      let m;
      if ((m = /^([012])$/.exec(t))) out.push([w === hh ? 'sq' : 'rect', role(m[1]), [p00, p10, p11, p01]]);
      else if ((m = /^([012])\/([012])$/.exec(t)))
        out.push(['tri', role(m[1]), [p00, p10, p01]], ['tri', role(m[2]), [p10, p11, p01]]);
      else if ((m = /^([012])\\([012])$/.exec(t)))
        out.push(['tri', role(m[1]), [p00, p11, p01]], ['tri', role(m[2]), [p00, p10, p11]]);
      else if ((m = /^q([012])([012])([012])([012])$/.exec(t)))
        out.push(
          ['tri', role(m[1]), [p00, p10, c]],
          ['tri', role(m[2]), [p10, p11, c]],
          ['tri', role(m[3]), [p11, p01, c]],
          ['tri', role(m[4]), [p01, p00, c]],
        );
      else if ((m = /^([\^v<>])([012])([012])$/.exec(t))) {
        const goose = role(m[2]),
          sky = role(m[3]);
        const mx = x + w / 2,
          my = y + hh / 2;
        const shapes = {
          '^': [
            [p01, [mx, y], p11],
            [p00, [mx, y], p01],
            [[mx, y], p10, p11],
          ],
          v: [
            [p00, p10, [mx, y1]],
            [p00, [mx, y1], p01],
            [p10, p11, [mx, y1]],
          ],
          '<': [
            [p10, p11, [x, my]],
            [p00, p10, [x, my]],
            [[x, my], p11, p01],
          ],
          '>': [
            [p00, [x1, my], p01],
            [p00, p10, [x1, my]],
            [[x1, my], p11, p01],
          ],
        }[m[1]];
        out.push(['goose', goose, shapes[0]], ['sky', sky, shapes[1]], ['sky', sky, shapes[2]]);
      } else throw new Error(`row ${y + 1}, column ${x + 1}: "${t}" is not a piece`);
    }
  return out;
}

const centroid = poly => {
  // the centre of the area (not just of the corners), so a long strip is named by its middle
  let a = 0,
    cx = 0,
    cy = 0;
  poly.forEach(([x0, y0], i) => {
    const [x1, y1] = poly[(i + 1) % poly.length],
      k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  });
  return [cx / (3 * a), cy / (3 * a)];
};
/** Where a piece is: its cell, and which side of that cell for a piece smaller than the cell. */
function placeName(poly) {
  const [cx, cy] = centroid(poly),
    col = Math.floor(cx),
    row = Math.floor(cy),
    dx = cx - col - 0.5,
    dy = cy - row - 0.5;
  const v = dy < -0.1 ? 'upper' : dy > 0.1 ? 'lower' : '',
    h = dx < -0.1 ? 'left' : dx > 0.1 ? 'right' : '';
  const side = v && h ? `${v} ${h}` : v ? (v === 'upper' ? 'top' : 'bottom') : h;
  return `row ${row + 1}, column ${col + 1}${side ? ' · ' + side : ''}`;
}

/**
 * The parts of a grid block, in the unit square.
 * @param {GridDef} def @returns {Part[]}
 */
function gridParts(def) {
  const { n } = def;
  let pieces = parseGrid(def.rows).map(([kind, role, poly]) => ({ kind: KIND[kind], role, poly, name: '' }));
  if (def.fourfold) {
    const turn = (poly, k) => {
      let p = poly;
      for (let i = 0; i < k; i++) p = p.map(([x, y]) => [n - y, x]); // a quarter turn clockwise about the centre
      return p;
    };
    pieces = [1, 2, 3].reduce((all, k) => all.concat(pieces.map(p => ({ ...p, poly: turn(p.poly, k) }))), pieces);
  }
  pieces = pieces.map(p => ({ ...p, name: `${p.kind} · ${placeName(p.poly)}` }));
  for (const [name, role, flat] of def.extra || [])
    pieces.push({
      kind: '',
      role,
      name,
      poly: Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i], flat[2 * i + 1]]),
    });
  return pieces.map(p => ({
    name: p.name,
    role: /** @type {0 | 1 | 2} */ (p.role),
    poly: p.poly.map(([x, y]) => [x / n, y / n]),
  }));
}

export { gridParts, parseGrid };
