// Block patterns: every block is a list of parts (polygons in the unit square) with a colour role.
import '../sim/controls.js';          // load order: runs after sim/controls

// (fabrics for the quilt come from the designer; the simulation page has no fabric card of its own)

// ------------------------------------------------------------- quilt designer
// The user lays out a grid of blocks, picks a traditional pattern for each
// block and a fabric for every part of it. "Simulate this quilt" turns the
// design into the quilt's texture and a quilting normal map that follows the
// design's own seams, then drops it on the bed.

// Each pattern is a list of parts: a polygon in the unit square (y down) and
// a colour role (0 background, 1 main, 2 accent) used for default fabrics.
const P_ = (name, role, poly) => ({ name, role, poly });
function rotPoly(poly, k) { let p = poly; for (let i = 0; i < k; i++) p = p.map(([x, y]) => [1 - y, x]); return p; }
// a block's orientation: turned rot quarter turns, then mirrored left-right when flip is set
const orientPoly = (poly, b) => { const p = rotPoly(poly, b.rot || 0); return b.flip ? p.map(([x, y]) => [1 - x, y]) : p; };
const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const PATTERNS = {
  plain: { label: 'Plain square', parts: () => [P_('Square', 0, sq(0, 0, 1, 1))] },
  hst: { label: 'Half-square triangle', parts: () => [P_('Lower triangle', 1, [[0, 0], [0, 1], [1, 1]]), P_('Upper triangle', 0, [[0, 0], [1, 0], [1, 1]])] },
  hourglass: { label: 'Hourglass', parts: () => {
    const c = [0.5, 0.5];
    return [P_('Top', 1, [[0, 0], [1, 0], c]), P_('Right', 0, [[1, 0], [1, 1], c]), P_('Bottom', 1, [[1, 1], [0, 1], c]), P_('Left', 0, [[0, 1], [0, 0], c])];
  } },
  four: { label: 'Four patch', parts: () => [P_('Top left', 1, sq(0, 0, .5, .5)), P_('Top right', 0, sq(.5, 0, 1, .5)), P_('Bottom left', 0, sq(0, .5, .5, 1)), P_('Bottom right', 1, sq(.5, .5, 1, 1))] },
  nine: { label: 'Nine patch', parts: () => {
    const out = [], t = 1 / 3, names = ['Top left', 'Top', 'Top right', 'Left', 'Centre', 'Right', 'Bottom left', 'Bottom', 'Bottom right'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out.push(P_(names[j * 3 + i], (i + j) % 2 === 0 ? 1 : 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    return out;
  } },
  ohio: { label: 'Ohio star', parts: () => {
    const t = 1 / 3, out = [];
    for (const [i, j, n] of [[0, 0, 'Corner top left'], [2, 0, 'Corner top right'], [0, 2, 'Corner bottom left'], [2, 2, 'Corner bottom right']]) out.push(P_(n, 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    out.push(P_('Centre', 2, sq(t, t, 2 * t, 2 * t)));
    // four quarter-square-triangle units make the star points
    for (const [i, j, side, vertical] of [[1, 0, 'top', false], [1, 2, 'bottom', false], [0, 1, 'left', true], [2, 1, 'right', true]]) {
      const x0 = i * t, y0 = j * t, x1 = x0 + t, y1 = y0 + t, c = [x0 + t / 2, y0 + t / 2];
      const tri = { N: [[x0, y0], [x1, y0], c], E: [[x1, y0], [x1, y1], c], S: [[x1, y1], [x0, y1], c], Wd: [[x0, y1], [x0, y0], c] };
      const star = vertical ? ['N', 'S'] : ['E', 'Wd'];
      for (const k of ['N', 'E', 'S', 'Wd']) out.push(P_(`Point ${side} · ${{ N: 'upper', E: 'right', S: 'lower', Wd: 'left' }[k]}`, star.includes(k) ? 1 : 0, tri[k]));
    }
    return out;
  } },
  pinwheel: { label: 'Pinwheel', parts: () => {
    const blade = [[0, 0], [.5, 0], [.5, .5]], bg = [[0, 0], [.5, .5], [0, .5]], out = [];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Blade ' + names[k], 1, rotPoly(blade, k))); out.push(P_('Background ' + names[k], 0, rotPoly(bg, k))); }
    return out;
  } },
  geese: { label: 'Flying geese', parts: () => {
    const out = [];
    for (const [r, role] of [[0, 1], [1, 2]]) {
      const y0 = r * .5, y1 = y0 + .5, n = r ? 'lower' : 'upper';
      out.push(P_(`Goose ${n}`, role, [[0, y1], [.5, y0], [1, y1]]), P_(`Sky left ${n}`, 0, [[0, y0], [.5, y0], [0, y1]]), P_(`Sky right ${n}`, 0, [[.5, y0], [1, y0], [1, y1]]));
    }
    return out;
  } },
  logcabin: { label: 'Log cabin', parts: () => {
    let x0 = .4, y0 = .4, x1 = .6, y1 = .6; const w = .1, out = [P_('Hearth', 2, sq(x0, y0, x1, y1))];
    for (let k = 0; k < 16; k++) {
      const side = k % 4, role = side < 2 ? 0 : 1, n = `Log ${k + 1}`;
      if (side === 0) { out.push(P_(n, role, sq(x0, y0 - w, x1, y0))); y0 -= w; }
      else if (side === 1) { out.push(P_(n, role, sq(x1, y0, x1 + w, y1))); x1 += w; }
      else if (side === 2) { out.push(P_(n, role, sq(x0, y1, x1, y1 + w))); y1 += w; }
      else { out.push(P_(n, role, sq(x0 - w, y0, x0, y1))); x0 -= w; }
    }
    return out;
  } },
  churn: { label: 'Churn dash', parts: () => {
    const t = 1 / 3, out = [];
    // corners: half-square triangles with the dark half at the outer corner
    const corner = [[0, 0], [t, 0], [0, t]], cornerBg = [[t, 0], [t, t], [0, t]];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Corner ' + names[k], 1, rotPoly(corner, k)), P_('Corner background ' + names[k], 0, rotPoly(cornerBg, k))); }
    const edgeOuter = sq(t, 0, 2 * t, t / 2), edgeInner = sq(t, t / 2, 2 * t, t), en = ['top', 'right', 'bottom', 'left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Bar ' + en[k], 1, rotPoly(edgeOuter, k)), P_('Bar background ' + en[k], 0, rotPoly(edgeInner, k))); }
    out.push(P_('Centre', 0, sq(t, t, 2 * t, 2 * t)));
    return out;
  } },
  fanstar: { label: 'Fan star', parts: () => {
    // Top-left quadrant: six fan blades radiating from the block centre.
    // Bottom-right: an eight-point star (centre M, four star-point units, corners I, K, L).
    const t = 1 / 3, s = 1 / 6, apex = [0.5, 0.5], out = [];
    const blades = [[[0, .5], [0, t]], [[0, t], [0, s]], [[0, s], [0, 0]], [[0, 0], [s, 0]], [[s, 0], [t, 0]], [[t, 0], [.5, 0]]];
    blades.forEach(([a, b], k) => out.push(P_(`A${k + 1} · fan blade`, k === 4 ? 2 : 1, [a, b, apex])));
    out.push(P_('B', 0, sq(.5, 0, 2 / 3, t)), P_('C', 0, sq(2 / 3, 0, 1, t)), P_('D', 0, sq(0, .5, t, 2 / 3)), P_('E', 0, sq(0, 2 / 3, t, 1)),
             P_('I · star corner', 0, sq(5 / 6, t, 1, .5)), P_('K · star corner', 0, sq(t, 5 / 6, .5, 1)), P_('L · star corner', 0, sq(5 / 6, 5 / 6, 1, 1)),
             P_('M · star centre', 1, sq(.5, .5, 5 / 6, 5 / 6)));
    // star-point unit above M (half-square triangles), turned to each side of the star
    const c = [2 / 3, 2 / 3];
    const turn = ([u, v], k) => { let du = u - c[0], dv = v - c[1]; for (let i = 0; i < k; i++) [du, dv] = [-dv, du]; return [c[0] + du, c[1] + dv]; };
    const unit = [[1, [[.5, t], [2 / 3, .5], [.5, .5]]], [2, [[.5, t], [2 / 3, t], [2 / 3, .5]]], [2, [[2 / 3, t], [5 / 6, t], [2 / 3, .5]]], [1, [[5 / 6, t], [5 / 6, .5], [2 / 3, .5]]]];
    const sides = ['top', 'right', 'bottom', 'left'], letters = [['G', 'F', 'H', 'G'], ['G', 'H', 'F', 'G'], ['G', 'F', 'J', 'G'], ['G', 'J', 'F', 'G']];
    for (let k = 0; k < 4; k++) unit.forEach(([role, poly], i) => out.push(P_(`Star point ${sides[k]} · ${letters[k][i]}`, role, poly.map(p => turn(p, k)))));
    return out;
  } },
};
// The 12 blocks traced from the user's drawing: [label, [[part name, colour role, flat x,y list in 1/24ths], ...]]
const TRACED = {
  spoolstar: ["Spool star", [["Triangle · top left 1",0,[0,6,0,0,6,0]],["Triangle · top",1,[12,6,6,0,18,0]],["Triangle · top right 1",0,[24,6,18,0,24,0]],["Triangle · top left 2",2,[0,6,6,0,6,6]],["Triangle · top left 3",0,[6,6,6,0,12,6]],["Triangle · top right 2",0,[12,6,18,0,18,6]],["Triangle · top right 3",2,[24,6,18,6,18,0]],["Triangle · top left 4",0,[10,6,6,10,6,6]],["Triangle · top right 4",0,[18,6,18,10,14,6]],["Triangle · top left 5",0,[0,6,6,6,6,12]],["Triangle · top right 5",0,[24,6,18,12,18,6]],["Triangle · centre 1",1,[10,6,10,10,6,10]],["Triangle · centre 2",1,[18,10,14,10,14,6]],["Triangle · left",1,[0,6,6,12,0,18]],["Square · left",0,[6,10,10,10,10,14,6,14]],["Rectangle · centre",2,[14,18,10,18,10,6,14,6]],["Square · right",0,[18,14,14,14,14,10,18,10]],["Triangle · right",1,[24,6,24,18,18,12]],["Triangle · centre 3",1,[6,14,10,14,10,18]],["Triangle · centre 4",1,[14,14,18,14,14,18]],["Triangle · bottom left 1",0,[0,18,6,12,6,18]],["Triangle · bottom right 1",0,[24,18,18,18,18,12]],["Triangle · bottom left 2",0,[6,14,10,18,6,18]],["Triangle · bottom right 2",0,[18,14,18,18,14,18]],["Triangle · bottom left 3",2,[0,18,6,18,6,24]],["Triangle · bottom left 4",0,[6,24,6,18,12,18]],["Triangle · bottom right 3",0,[18,24,12,18,18,18]],["Triangle · bottom right 4",2,[24,18,18,24,18,18]],["Triangle · bottom left 5",0,[0,18,6,24,0,24]],["Triangle · bottom",1,[6,24,12,18,18,24]],["Triangle · bottom right 5",0,[24,18,24,24,18,24]]]],
  crossroads: ["Crossroads", [["Rectangle · top",0,[16,0,16,4,8,4,8,0]],["Triangle · top left 1",0,[8,0,0,8,0,0]],["Triangle · top right 1",0,[24,8,16,0,24,0]],["Triangle · top left 2",1,[8,0,8,8,0,8]],["Triangle · top right 2",1,[16,8,16,0,24,8]],["Rectangle · left",0,[0,16,0,8,4,8,4,16]],["Piece · centre",2,[20,8,20,16,16,16,16,20,8,20,8,16,4,16,4,8,8,8,8,4,16,4,16,8]],["Rectangle · right",0,[20,8,24,8,24,16,20,16]],["Triangle · bottom left 1",1,[0,16,8,16,8,24]],["Triangle · bottom right 1",1,[24,16,16,24,16,16]],["Triangle · bottom left 2",0,[0,16,8,24,0,24]],["Triangle · bottom right 2",0,[24,16,24,24,16,24]],["Rectangle · bottom",0,[8,24,8,20,16,20,16,24]]]],
  geesecrown: ["Crown of geese", [["Triangle · top 1",1,[6,0,12,0,9,3]],["Triangle · top 2",1,[12,0,18,0,15,3]],["Triangle · top left 1",0,[6,0,0,6,0,0]],["Triangle · top right 1",0,[24,6,18,0,24,0]],["Triangle · top 3",2,[12,0,12,6,9,3]],["Triangle · top 4",2,[12,0,15,3,12,6]],["Triangle · top left 2",1,[6,0,6,6,0,6]],["Triangle · top left 3",0,[6,0,12,6,6,6]],["Triangle · top right 2",0,[18,0,18,6,12,6]],["Triangle · top right 3",1,[24,6,18,6,18,0]],["Triangle · top left 4",0,[6,12,0,6,6,6]],["Triangle · top right 4",0,[18,12,18,6,24,6]],["Triangle · left 1",1,[0,12,0,6,3,9]],["Triangle · right 1",1,[21,9,24,6,24,12]],["Triangle · left 2",2,[0,12,3,9,6,12]],["Triangle · right 2",2,[21,9,24,12,18,12]],["Square · centre",0,[6,6,18,6,18,18,6,18]],["Triangle · left 3",2,[0,12,6,12,3,15]],["Triangle · right 3",2,[24,12,21,15,18,12]],["Triangle · left 4",1,[0,12,3,15,0,18]],["Triangle · right 4",1,[24,12,24,18,21,15]],["Triangle · bottom left 1",0,[6,12,6,18,0,18]],["Triangle · bottom right 1",0,[18,18,18,12,24,18]],["Triangle · bottom left 2",1,[0,18,6,18,6,24]],["Triangle · bottom left 3",0,[6,24,6,18,12,18]],["Triangle · bottom right 2",0,[18,18,18,24,12,18]],["Triangle · bottom right 3",1,[18,18,24,18,18,24]],["Triangle · bottom 1",2,[9,21,12,18,12,24]],["Triangle · bottom 2",2,[12,24,12,18,15,21]],["Triangle · bottom left 4",0,[0,18,6,24,0,24]],["Triangle · bottom right 4",0,[18,24,24,18,24,24]],["Triangle · bottom 3",1,[6,24,9,21,12,24]],["Triangle · bottom 4",1,[18,24,12,24,15,21]]]],
  tulipcross: ["Tulip cross", [["Triangle · top left 1",0,[4,0,12,0,8,4]],["Triangle · top right 1",0,[16,4,12,0,20,0]],["Square · top left",1,[0,4,0,0,4,0,4,4]],["Square · top right",1,[20,0,24,0,24,4,20,4]],["Hexagon · top left",0,[4,8,0,4,4,4,4,0,8,4,8,8]],["Hexagon · top right",0,[16,4,20,0,20,4,24,4,20,8,16,8]],["Pentagon · top",1,[16,4,16,8,8,8,8,4,12,0]],["Triangle · top left 2",0,[0,12,0,4,4,8]],["Triangle · top right 2",0,[24,12,20,8,24,4]],["Pentagon · left",1,[0,12,4,8,8,8,8,16,4,16]],["Square · centre",2,[8,16,8,8,16,8,16,16]],["Pentagon · right",1,[20,16,16,16,16,8,20,8,24,12]],["Triangle · bottom left 1",0,[0,12,4,16,0,20]],["Triangle · bottom right 1",0,[20,16,24,12,24,20]],["Pentagon · bottom",1,[12,24,8,20,8,16,16,16,16,20]],["Hexagon · bottom left",0,[4,24,4,20,0,20,4,16,8,16,8,20]],["Hexagon · bottom right",0,[20,24,16,20,16,16,20,16,24,20,20,20]],["Square · bottom left",1,[4,24,0,24,0,20,4,20]],["Square · bottom right",1,[20,24,20,20,24,20,24,24]],["Triangle · bottom left 2",0,[4,24,8,20,12,24]],["Triangle · bottom right 2",0,[12,24,16,20,20,24]]]],
  eightstar: ["Eight-point star", [["Triangle · top 1",0,[6,0,12,0,12,6]],["Triangle · top 2",0,[12,0,18,0,12,6]],["Square · top left",0,[6,0,6,6,0,6,0,0]],["Square · top right",0,[18,0,24,0,24,6,18,6]],["Triangle · top left 1",1,[6,0,12,6,6,6]],["Triangle · top right 1",1,[18,0,18,6,12,6]],["Triangle · top left 2",1,[6,12,0,6,6,6]],["Triangle · top left 3",0,[6,12,6,6,12,6]],["Triangle · top right 2",0,[18,12,12,6,18,6]],["Triangle · top right 3",1,[18,12,18,6,24,6]],["Triangle · centre 1",2,[12,6,12,12,9,9]],["Triangle · centre 2",2,[15,9,12,12,12,6]],["Triangle · left 1",0,[0,12,0,6,6,12]],["Triangle · right 1",0,[18,12,24,6,24,12]],["Triangle · centre 3",2,[6,12,9,9,12,12]],["Triangle · centre 4",2,[18,12,12,12,15,9]],["Triangle · centre 5",2,[6,12,12,12,9,15]],["Triangle · centre 6",2,[18,12,15,15,12,12]],["Triangle · left 2",0,[0,12,6,12,0,18]],["Triangle · right 2",0,[18,12,24,12,24,18]],["Triangle · centre 7",2,[9,15,12,12,12,18]],["Triangle · centre 8",2,[12,12,15,15,12,18]],["Triangle · bottom left 1",1,[6,12,6,18,0,18]],["Triangle · bottom left 2",0,[6,12,12,18,6,18]],["Triangle · bottom right 1",0,[18,12,18,18,12,18]],["Triangle · bottom right 2",1,[18,12,24,18,18,18]],["Triangle · bottom left 3",1,[6,24,6,18,12,18]],["Triangle · bottom right 3",1,[18,18,18,24,12,18]],["Square · bottom left",0,[0,18,6,18,6,24,0,24]],["Square · bottom right",0,[24,18,24,24,18,24,18,18]],["Triangle · bottom 1",0,[6,24,12,18,12,24]],["Triangle · bottom 2",0,[18,24,12,24,12,18]]]],
  nested: ["Nested triangles", [["Triangle · top right 1",0,[18,0,18,6,12,0]],["Triangle · top right 2",0,[18,0,24,0,24,6]],["Triangle · top left",0,[12,12,0,0,12,0]],["Triangle · top right 3",2,[18,0,24,6,18,6]],["Triangle · top right 4",1,[24,12,12,12,12,0]],["Triangle · top right 5",0,[18,6,24,6,24,12]],["Triangle · bottom left",1,[24,24,0,24,0,0]],["Triangle · bottom right",0,[12,12,24,12,24,24]]]],
  twinbars: ["Twin bars star", [["Triangle · top 1",1,[6,0,12,0,12,6]],["Triangle · top 2",1,[12,0,18,0,12,6]],["Square · top left",0,[6,0,6,6,0,6,0,0]],["Square · top right",0,[24,6,18,6,18,0,24,0]],["Triangle · top left 1",0,[6,0,12,6,6,6]],["Triangle · top right 1",0,[18,0,18,6,12,6]],["Triangle · top left 2",0,[0,6,6,6,6,12]],["Triangle · top right 2",0,[24,6,18,12,18,6]],["Triangle · left",1,[0,6,6,12,0,18]],["Rectangle · centre 1",2,[6,6,12,6,12,18,6,18]],["Rectangle · centre 2",2,[18,18,12,18,12,6,18,6]],["Triangle · right",1,[24,6,24,18,18,12]],["Triangle · bottom left 1",0,[0,18,6,12,6,18]],["Triangle · bottom right 1",0,[24,18,18,18,18,12]],["Triangle · bottom left 2",0,[6,24,6,18,12,18]],["Triangle · bottom right 2",0,[18,18,18,24,12,18]],["Square · bottom left",0,[0,18,6,18,6,24,0,24]],["Square · bottom right",0,[24,18,24,24,18,24,18,18]],["Triangle · bottom 1",1,[6,24,12,18,12,24]],["Triangle · bottom 2",1,[18,24,12,24,12,18]]]],
  twisted: ["Twisted square", [["Triangle · top left",0,[0,8,0,0,8,0]],["Triangle · top right",0,[24,8,16,0,24,0]],["Pentagon · top right",1,[24,8,16,16,16,8,8,0,16,0]],["Pentagon · top left",2,[0,16,0,8,8,0,16,8,8,8]],["Square · centre",0,[16,8,16,16,8,16,8,8]],["Pentagon · bottom right",1,[24,16,16,24,8,16,16,16,24,8]],["Pentagon · bottom left",2,[0,16,8,8,8,16,16,24,8,24]],["Triangle · bottom left",0,[0,16,8,24,0,24]],["Triangle · bottom right",0,[24,16,24,24,16,24]]]],
  spindiamond: ["Spinning diamond", [["Triangle · top left 1",0,[6,0,0,6,0,0]],["Triangle · top right 1",0,[12,0,18,0,18,6]],["Triangle · top right 2",0,[18,0,24,0,24,6]],["Parallelogram · top left",1,[6,0,12,0,6,6,0,6]],["Triangle · top",0,[12,0,12,6,6,6]],["Parallelogram · top",1,[12,0,18,6,18,12,12,6]],["Parallelogram · top right",1,[18,0,24,6,24,12,18,6]],["Triangle · top left 2",0,[0,12,0,6,6,6]],["Parallelogram · left",1,[0,12,6,6,12,6,6,12]],["Triangle · centre 1",2,[6,12,12,6,12,12]],["Triangle · centre 2",2,[12,6,18,12,12,12]],["Triangle · right",0,[18,6,24,12,18,12]],["Triangle · left",0,[0,12,6,12,6,18]],["Triangle · centre 3",2,[6,12,12,12,12,18]],["Triangle · centre 4",2,[18,12,12,18,12,12]],["Parallelogram · right",1,[18,12,24,12,18,18,12,18]],["Triangle · bottom right 1",0,[24,12,24,18,18,18]],["Parallelogram · bottom left",1,[0,12,6,18,6,24,0,18]],["Parallelogram · bottom",1,[6,18,6,12,12,18,12,24]],["Triangle · bottom",0,[12,18,18,18,12,24]],["Parallelogram · bottom right",1,[18,24,12,24,18,18,24,18]],["Triangle · bottom left 1",0,[0,18,6,24,0,24]],["Triangle · bottom left 2",0,[6,18,12,24,6,24]],["Triangle · bottom right 2",0,[18,24,24,18,24,24]]]],
  hourframe: ["Hourglass frame", [["Triangle · top left 1",1,[4,4,0,0,8,0]],["Triangle · top 1",1,[12,4,8,0,16,0]],["Triangle · top right 1",1,[20,4,16,0,24,0]],["Triangle · top left 2",0,[12,4,4,4,8,0]],["Triangle · top right 2",0,[12,4,16,0,20,4]],["Triangle · top left 3",1,[4,4,0,8,0,0]],["Triangle · top right 3",1,[20,4,24,0,24,8]],["Triangle · top left 4",1,[12,4,8,8,4,4]],["Triangle · top right 4",1,[12,4,20,4,16,8]],["Triangle · top left 5",0,[4,8,4,4,8,8]],["Triangle · top 2",0,[12,4,16,8,8,8]],["Triangle · top right 5",0,[20,4,20,8,16,8]],["Triangle · top left 6",0,[4,12,0,8,4,4]],["Triangle · top right 6",0,[20,4,24,8,20,12]],["Triangle · centre 1",2,[12,12,8,8,16,8]],["Triangle · left 1",1,[0,16,0,8,4,12]],["Triangle · left 2",0,[4,8,8,12,4,16]],["Hexagon · left",1,[4,8,8,8,12,12,8,16,4,16,8,12]],["Hexagon · right",1,[12,12,16,8,20,8,16,12,20,16,16,16]],["Triangle · right 1",0,[16,12,20,8,20,16]],["Triangle · right 2",1,[24,16,20,12,24,8]],["Triangle · centre 2",2,[12,12,16,16,8,16]],["Triangle · bottom left 1",0,[4,20,0,16,4,12]],["Triangle · bottom right 1",0,[20,20,20,12,24,16]],["Triangle · bottom left 2",0,[4,20,4,16,8,16]],["Triangle · bottom 1",0,[12,20,8,16,16,16]],["Triangle · bottom right 2",0,[20,20,16,16,20,16]],["Triangle · bottom left 3",1,[4,20,8,16,12,20]],["Triangle · bottom right 3",1,[20,20,12,20,16,16]],["Triangle · bottom left 4",1,[0,24,0,16,4,20]],["Triangle · bottom right 4",1,[20,20,24,16,24,24]],["Triangle · bottom left 5",0,[4,20,12,20,8,24]],["Triangle · bottom right 5",0,[20,20,16,24,12,20]],["Triangle · bottom left 6",1,[0,24,4,20,8,24]],["Triangle · bottom 2",1,[8,24,12,20,16,24]],["Triangle · bottom right 6",1,[20,20,24,24,16,24]]]],
  window: ["Window diamond", [["Square · top left 1",1,[4,4,0,4,0,0,4,0]],["Square · top left 2",0,[4,4,4,0,8,0,8,4]],["Rectangle · top 1",1,[16,4,8,4,8,0,16,0]],["Square · top right 1",0,[16,4,16,0,20,0,20,4]],["Square · top right 2",1,[20,4,20,0,24,0,24,4]],["Square · top left 3",0,[4,4,4,8,0,8,0,4]],["Square · top left 4",1,[4,4,8,4,8,8,4,8]],["Rectangle · top 2",0,[16,4,16,8,8,8,8,4]],["Square · top right 3",1,[16,4,20,4,20,8,16,8]],["Square · top right 4",0,[20,4,24,4,24,8,20,8]],["Triangle · centre 1",0,[8,12,8,8,12,8]],["Triangle · centre 2",0,[12,8,16,8,16,12]],["Triangle · centre 3",2,[8,12,12,8,12,12]],["Triangle · centre 4",2,[12,8,16,12,12,12]],["Rectangle · left 1",1,[0,16,0,8,4,8,4,16]],["Rectangle · left 2",0,[4,8,8,8,8,16,4,16]],["Rectangle · right 1",0,[20,8,20,16,16,16,16,8]],["Rectangle · right 2",1,[20,8,24,8,24,16,20,16]],["Triangle · centre 5",2,[8,12,12,12,12,16]],["Triangle · centre 6",2,[16,12,12,16,12,12]],["Triangle · centre 7",0,[8,12,12,16,8,16]],["Triangle · centre 8",0,[16,12,16,16,12,16]],["Square · bottom left 1",0,[4,20,0,20,0,16,4,16]],["Square · bottom left 2",1,[4,20,4,16,8,16,8,20]],["Rectangle · bottom 1",0,[8,20,8,16,16,16,16,20]],["Square · bottom right 1",1,[20,16,20,20,16,20,16,16]],["Square · bottom right 2",0,[20,16,24,16,24,20,20,20]],["Square · bottom left 3",1,[4,20,4,24,0,24,0,20]],["Square · bottom left 4",0,[4,20,8,20,8,24,4,24]],["Rectangle · bottom 2",1,[8,20,16,20,16,24,8,24]],["Square · bottom right 3",0,[20,24,16,24,16,20,20,20]],["Square · bottom right 4",1,[20,24,20,20,24,20,24,24]]]],
  totem: ["Totem", [["Triangle · top",1,[12,4,8,0,16,0]],["Hexagon · top left",0,[12,4,4,4,8,8,0,8,0,0,8,0]],["Hexagon · top right",0,[12,4,16,0,24,0,24,8,16,8,20,4]],["Trapezoid · top",1,[20,4,16,8,8,8,4,4]],["Triangle · centre 1",2,[16,8,12,12,8,8]],["Triangle · left",1,[0,16,0,8,4,12]],["Hexagon · left",0,[0,16,4,12,0,8,8,8,12,12,8,16]],["Hexagon · right",0,[24,16,16,16,12,12,16,8,24,8,20,12]],["Triangle · right",1,[24,16,20,12,24,8]],["Triangle · centre 2",2,[12,12,16,16,8,16]],["Trapezoid · bottom",1,[4,20,8,16,16,16,20,20]],["Hexagon · bottom left",0,[0,16,8,16,4,20,12,20,8,24,0,24]],["Hexagon · bottom right",0,[24,16,24,24,16,24,12,20,20,20,16,16]],["Triangle · bottom",1,[12,20,16,24,8,24]]]],
};
for (const [key, [label, parts]] of Object.entries(TRACED))
  PATTERNS[key] = { label, parts: () => parts.map(([n, role, f]) => P_(n, role, Array.from({ length: f.length / 2 }, (_, i) => [f[2 * i] / 24, f[2 * i + 1] / 24]))) };
// Blocks for medallion and sampler quilts
Object.assign(PATTERNS, {
  sqsq: { label: 'Square in a square', parts: () => {
    const c = [[.5, 0], [1, .5], [.5, 1], [0, .5]], names = ['top left', 'top right', 'bottom right', 'bottom left'];
    const out = [P_('Centre square', 1, c)];
    [[[0, 0], [.5, 0], [0, .5]], [[.5, 0], [1, 0], [1, .5]], [[1, .5], [1, 1], [.5, 1]], [[0, .5], [.5, 1], [0, 1]]].forEach((t, k) => out.push(P_('Corner ' + names[k], 0, t)));
    return out;
  } },
  economy: { label: 'Economy', parts: () => {
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    const out = [P_('Centre square', 2, sq(.25, .25, .75, .75))];
    // first round: four triangles turning the centre on point
    [[[.25, .25], [.5, 0], [.75, .25]], [[.75, .25], [1, .5], [.75, .75]], [[.75, .75], [.5, 1], [.25, .75]], [[.25, .75], [0, .5], [.25, .25]]]
      .forEach((t, k) => out.push(P_('Inner triangle ' + ['top', 'right', 'bottom', 'left'][k], 1, t)));
    // second round: the outer corners square it up again
    [[[0, 0], [.5, 0], [0, .5]], [[.5, 0], [1, 0], [1, .5]], [[1, .5], [1, 1], [.5, 1]], [[0, .5], [.5, 1], [0, 1]]].forEach((t, k) => out.push(P_('Outer corner ' + names[k], 0, t)));
    return out;
  } },
  dnine: { label: 'Double nine patch', parts: () => {
    const out = [], t = 1 / 3, m = t / 3, cell = ['top left', 'top', 'top right', 'left', 'centre', 'right', 'bottom left', 'bottom', 'bottom right'];
    for (let J = 0; J < 3; J++) for (let I = 0; I < 3; I++) {
      const n = cell[J * 3 + I];
      if ((I + J) % 2) { out.push(P_('Plain ' + n, 0, sq(I * t, J * t, (I + 1) * t, (J + 1) * t))); continue; }
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
        out.push(P_(`Patch ${n} · ${cell[j * 3 + i]}`, (i + j) % 2 ? 0 : 1, sq(I * t + i * m, J * t + j * m, I * t + (i + 1) * m, J * t + (j + 1) * m)));
    }
    return out;
  } },
  sawstar: { label: 'Sawtooth star', parts: () => {
    const q = .25, out = [], names = ['top left', 'top right', 'bottom right', 'bottom left'];
    [[0, 0], [3, 0], [3, 3], [0, 3]].forEach(([i, j], k) => out.push(P_('Corner ' + names[k], 0, sq(i * q, j * q, (i + 1) * q, (j + 1) * q))));
    out.push(P_('Centre', 2, sq(q, q, 3 * q, 3 * q)));
    // one star-point unit (a flying goose pointing out) on each side, turned about the block centre
    const goose = [[q, q], [.5, 0], [3 * q, q]], skyL = [[q, 0], [.5, 0], [q, q]], skyR = [[.5, 0], [3 * q, 0], [3 * q, q]], sides = ['top', 'right', 'bottom', 'left'];
    for (let k = 0; k < 4; k++) out.push(P_('Point ' + sides[k], 1, rotPoly(goose, k)), P_('Sky ' + sides[k] + ' 1', 0, rotPoly(skyL, k)), P_('Sky ' + sides[k] + ' 2', 0, rotPoly(skyR, k)));
    return out;
  } },
});
const PCACHE = {};
const partsOf = name => (PCACHE[name] = PCACHE[name] || PATTERNS[name].parts());

export { PATTERNS, orientPoly, partsOf };
