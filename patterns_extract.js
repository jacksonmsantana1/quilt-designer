const P_ = (name, role, poly) => ({ name, role, poly });
function rotPoly(poly, k) { let p = poly; for (let i = 0; i < k; i++) p = p.map(([x, y]) => [1 - y, x]); return p; }
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
};
