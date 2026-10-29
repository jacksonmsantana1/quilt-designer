// Real-size templates for odd-shaped pieces, packed onto A4 sheets.
import './pages.js';          // load order: runs after pdf/pages
import { fabricById } from '../designer/fabric-library.js';
import { fabricFill, pathPoly } from '../core/geometry.js';
import { A4, pdfPageCanvas, pdfText } from './pages.js';

// ---- real-size templates for pieces that are not rectangles or right triangles
const polyAngleRight = (p, i) => { const a = p[(i + p.length - 1) % p.length], o = p[i], c = p[(i + 1) % p.length];
  const ux = a[0] - o[0], uy = a[1] - o[1], vx = c[0] - o[0], vy = c[1] - o[1];
  return Math.abs(ux * vx + uy * vy) <= 1e-6 * Math.hypot(ux, uy) * Math.hypot(vx, vy); };
function needsTemplate(poly) {
  if (poly.length === 3) return ![0, 1, 2].some(i => polyAngleRight(poly, i));        // right triangles are cut with a ruler
  if (poly.length === 4) return ![0, 1, 2, 3].every(i => polyAngleRight(poly, i));    // squares and rectangles too
  return true;
}
// a shape's identity up to turning and flipping, so one template serves every copy
function shapeKey(mmPoly) {
  let best = null, bestMirror = false;
  const T = [([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x]];
  for (const mirror of [false, true]) for (const t of T) {
    let q = mmPoly.map(v => t(mirror ? [-v[0], v[1]] : v));
    if (mirror) q = q.reverse();
    const mx = Math.min(...q.map(v => v[0])), my = Math.min(...q.map(v => v[1]));
    q = q.map(([x, y]) => [Math.round((x - mx) * 10) / 10, Math.round((y - my) * 10) / 10]);
    let k = null;
    for (let r = 0; r < q.length; r++) { const ks = q.slice(r).concat(q.slice(0, r)).map(v => v.join(',')).join(';'); if (k === null || ks < k) k = ks; }
    if (best === null || k < best) { best = k; bestMirror = mirror; }
  }
  return { key: best, mirror: bestMirror };
}
function blockTemplates(P, b, i) {
  const map = new Map();
  b.pieces.forEach(pc => {
    if (!needsTemplate(pc.part.poly)) return;
    const mm = pc.part.poly.map(([u, v]) => [u * (b.size || P.blockW), v * (b.size || P.blockH)]);
    const { key, mirror } = shapeKey(mm);
    if (!map.has(key)) map.set(key, { poly: mm, ids: new Map(), mirrored: 0, plain: 0 });
    const t = map.get(key), id = `${pc.letter}${i + 1}.${pc.form}`;
    t.ids.set(id, (t.ids.get(id) || 0) + b.count);
    if (mirror === shapeKey(t.poly).mirror) t.plain += b.count; else t.mirrored += b.count;
  });
  return [...map.values()];
}
// offset a polygon outward by d: the cutting line around the finished line. Sharp points are
// blunted (as quilters trim "dog ears") once the mitre would reach further than 2.5 d.
function offsetPoly(p, d, limit = 2.5) {
  let A = 0; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; A += a[0] * c[1] - c[0] * a[1]; }
  const sgn = A > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const nx = sgn * (c[1] - a[1]) / L, ny = -sgn * (c[0] - a[0]) / L;
    lines.push([[a[0] + nx * d, a[1] + ny * d], [c[0] + nx * d, c[1] + ny * d]]);
  }
  const meet = ([p1, p2], [p3, p4]) => {
    const den = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(den) < 1e-9) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / den;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  };
  const out = [];
  lines.forEach((l, i) => {
    const m = lines[(i + lines.length - 1) % lines.length], v = p[i], q = meet(m, l);
    if (!q) { out.push(l[0]); return; }
    const dist = Math.hypot(q[0] - v[0], q[1] - v[1]);
    if (dist <= limit * d) { out.push(q); return; }
    // blunt the point: cut it square to the bisector at limit*d from the corner
    const ux = (q[0] - v[0]) / dist, uy = (q[1] - v[1]) / dist, c = [v[0] + ux * limit * d, v[1] + uy * limit * d];
    const cl = [c, [c[0] - uy, c[1] + ux]];
    out.push(meet(m, cl) || c, meet(cl, l) || c);
  });
  return out;
}

// ---- making the most of the A4 sheet
// Each template is turned to the angle that needs the fewest sheets; among angles that tie,
// square-to-the-sheet angles are preferred (easier to read and to line up the grain), then the
// smallest footprint. Templates that fit on one sheet are then packed together, several per
// sheet, with a skyline packer that also tries each one turned 90°.
const TPL = { x: 8, y: 35, w: 194, h: 253 }, TPL_GAP = 5;
const rotPts = (pts, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const bbox = q => { const xs = q.map(v => v[0]), ys = q.map(v => v[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function bestAngle(cut) {
  const H = hull(cut), cands = new Set();
  for (let k = 0; k < 360; k++) cands.add(k * Math.PI / 360);                 // every 0.5°
  for (let i = 0; i < H.length; i++) {                                        // and every hull edge laid flat (min-area boxes live there)
    const a = H[i], c = H[(i + 1) % H.length], e = Math.atan2(c[1] - a[1], c[0] - a[0]);
    for (const off of [0, Math.PI / 2]) cands.add((((-e + off) % Math.PI) + Math.PI) % Math.PI);
  }
  let best = null;
  for (const ang of cands) {
    const [x0, y0, x1, y1] = bbox(rotPts(H, ang)), w = x1 - x0, h = y1 - y0;
    const sheets = Math.ceil(w / TPL.w) * Math.ceil(h / TPL.h);
    const square = Math.min(ang % (Math.PI / 2), Math.PI / 2 - ang % (Math.PI / 2)) < 1e-6;
    const score = [sheets, square ? 0 : 1, w * h];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2] - 1e-6))))
      best = { ang, w, h, score, sheets };
  }
  return best;
}
// shape geometry at its chosen angle, with the bounding box at the origin
function templateShape(t, seam) {
  const cut0 = offsetPoly(t.poly, seam), fit = bestAngle(cut0);
  const cut = rotPts(cut0, fit.ang), [x0, y0] = bbox(cut);
  const sh = p => p.map(([x, y]) => [x - x0, y - y0]);
  return { t, fin: sh(rotPts(t.poly, fit.ang)), cut: sh(cut), w: fit.w, h: fit.h, ang: fit.ang, sheets: fit.sheets };
}
const turn90 = (sp) => ({ ...sp, fin: sp.fin.map(([x, y]) => [sp.h - y, x]), cut: sp.cut.map(([x, y]) => [sp.h - y, x]), w: sp.h, h: sp.w, ang: sp.ang + Math.PI / 2 });
// skyline bottom-left packing of the single-sheet templates into as few A4 sheets as possible
function packTemplates(shapes) {
  const W = TPL.w, H = TPL.h, g = TPL_GAP, sheets = [];
  const items = shapes.slice().sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  const tryPlace = (sky, w, h) => {
    let best = null;
    for (let i = 0; i < sky.length; i++) {
      const x = sky[i].x; if (x + w > W + 1e-6) break;
      let y = 0, j = i, span = 0;
      while (span < w - 1e-6 && j < sky.length) { y = Math.max(y, sky[j].y); span = sky[j].x + sky[j].w - x; j++; }
      if (span < w - 1e-6 || y + h > H + 1e-6) continue;
      if (!best || y < best.y - 1e-6 || (Math.abs(y - best.y) < 1e-6 && x < best.x)) best = { x, y };
    }
    return best;
  };
  const addSky = (sky, x, w, top) => {
    const out = [];
    for (const s of sky) {
      if (s.x + s.w <= x || s.x >= x + w) { out.push(s); continue; }
      if (s.x < x) out.push({ x: s.x, w: x - s.x, y: s.y });
      if (s.x + s.w > x + w) out.push({ x: x + w, w: s.x + s.w - x - w, y: s.y });
    }
    out.push({ x, w, y: top }); out.sort((a, b) => a.x - b.x);
    return out.filter(s => s.w > 1e-6);
  };
  for (const it of items) {
    let placed = false;
    for (const sheet of sheets) {
      let best = null;
      for (const v of [it, turn90(it)]) {
        const w = v.w + g, h = v.h + g, pos = tryPlace(sheet.sky, Math.min(w, W), Math.min(h, H));
        if (pos && (!best || pos.y + v.h < best.pos.y + best.v.h)) best = { v, pos };
      }
      if (best) { sheet.items.push({ ...best.v, x: best.pos.x, y: best.pos.y }); sheet.sky = addSky(sheet.sky, best.pos.x, Math.min(best.v.w + g, W), best.pos.y + best.v.h + g); placed = true; break; }
    }
    if (!placed) {
      const v = it.w <= W && it.h <= H ? it : turn90(it);
      sheets.push({ items: [{ ...v, x: 0, y: 0 }], sky: addSky([{ x: 0, w: W, y: 0 }], 0, Math.min(v.w + g, W), v.h + g) });
    }
  }
  // centre each sheet's layout in the printable area
  for (const sh of sheets) {
    const [, , x1, y1] = bbox(sh.items.flatMap(it => [[it.x, it.y], [it.x + it.w, it.y + it.h]]));
    sh.dx = (W - x1) / 2; sh.dy = (H - y1) / 2;
  }
  return sheets;
}
// does any part of the polygon fall on this sheet? (skips blank sheets of a split template)
function tileHasShape(p, x, y, w, h) {
  const inR = ([px, py]) => px > x && px < x + w && py > y && py < y + h;
  if (p.some(inR)) return true;
  const inP = (qx, qy) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  if ([[x, y], [x + w, y], [x, y + h], [x + w, y + h]].some(([qx, qy]) => inP(qx, qy))) return true;
  const R = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  for (let i = 0; i < p.length; i++) for (let k = 0; k < 4; k++) if (X(p[i], p[(i + 1) % p.length], R[k], R[(k + 1) % 4])) return true;
  return false;
}
function roomiestPoint(p, x, y, w, h, mx = 15, my = 12) {
  const inP = (qx, qy) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const dSeg = (qx, qy, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((qx - a[0]) * vx + (qy - a[1]) * vy) / (vx * vx + vy * vy))); return Math.hypot(qx - a[0] - t * vx, qy - a[1] - t * vy); };
  let best = null, bd = -1;
  const st = Math.max(1, Math.min(3, Math.min(w, h) / 20));
  for (let qy = y + my; qy < y + h - my; qy += st) for (let qx = x + mx; qx < x + w - mx; qx += st) {
    if (!inP(qx, qy)) continue;
    let d = Math.min(qx - x, x + w - qx, qy - y, y + h - qy);
    for (let i = 0; i < p.length; i++) d = Math.min(d, dSeg(qx, qy, p[i], p[(i + 1) % p.length]));
    if (d > bd) { bd = d; best = [qx, qy]; }
  }
  return best || [p.reduce((a, v) => a + v[0], 0) / p.length, p.reduce((a, v) => a + v[1], 0) / p.length];
}
function drawTemplateShape(g, P, it, ox, oy, clip) {
  const t = it.t, fin = it.fin.map(([x, y]) => [x + ox, y + oy]), cut = it.cut.map(([x, y]) => [x + ox, y + oy]);
  const fabId = [...t.ids.keys()][0], letter = fabId.match(/^[A-Z]+/)[0];
  const fab = fabricById((P.fabrics.find(f => f.letter === letter) || {}).id);
  g.save(); pathPoly(g, fin); g.clip(); g.globalAlpha = 0.18; g.fillStyle = fabricFill(g, fab, 10, 3);
  const [bx0, by0, bx1, by1] = bbox(cut); g.fillRect(bx0, by0, bx1 - bx0, by1 - by0); g.restore();
  g.strokeStyle = '#111'; g.lineWidth = 0.4; pathPoly(g, cut); g.stroke();
  g.setLineDash([2, 1.4]); g.lineWidth = 0.3; pathPoly(g, fin); g.stroke(); g.setLineDash([]);
  // label, count and straight-grain arrow (the block's horizontal direction, turned with the shape)
  const [cx, cy] = roomiestPoint(fin, clip[0], clip[1], clip[2], clip[3], clip[4] ?? 15, clip[5] ?? 12);
  const ids = [...t.ids.keys()].join(' / ');
  const size = Math.max(3.4, Math.min(7, (bx1 - bx0) / (ids.length * 0.9)));
  pdfText(g, ids, cx, cy, size, { align: 'center', serif: true, weight: 700 });
  pdfText(g, 'cut ' + [...t.ids.values()].reduce((a, n) => a + n, 0), cx, cy + 3.6, 2.6, { align: 'center', color: '#3a3732' });
  const L = Math.max(10, Math.min(26, Math.min(bx1 - bx0, by1 - by0) * 0.35)), dx = Math.cos(it.ang), dy = Math.sin(it.ang);
  const mx = cx, my = cy + 6 + Math.abs(dy) * L / 2;
  const ax = mx - dx * L / 2, ay = my - dy * L / 2, ex = mx + dx * L / 2, ey = my + dy * L / 2;
  g.lineWidth = 0.35; g.strokeStyle = '#1f1d1a'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey);
  for (const [px, py, s] of [[ax, ay, 1], [ex, ey, -1]]) { g.moveTo(px + s * (dx * 2.5 - dy * 1.4), py + s * (dy * 2.5 + dx * 1.4)); g.lineTo(px, py); g.lineTo(px + s * (dx * 2.5 + dy * 1.4), py + s * (dy * 2.5 - dx * 1.4)); }
  g.stroke();
  pdfText(g, 'grain', mx + Math.abs(dy) * 4, my + Math.abs(dx) * 3.4, 2.4, { align: Math.abs(dy) > 0.5 ? 'left' : 'center', color: '#5a5650' });
}
function pdfTemplateHeader(g, P, title, lines, page, pages) {
  const M = 10;
  pdfText(g, title, M, M + 6, 6.5, { serif: true, weight: 600 });
  lines.forEach((l, k) => pdfText(g, l.text, M, M + 12 + k * 4.4, k ? 3.1 : 3.6, { color: l.color || (k ? '#5a5650' : '#3a3732'), weight: l.weight || 400 }));
  const bx = A4.w - M - 50, by = M + 4;
  g.strokeStyle = '#1f1d1a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 50, by);
  for (let k = 0; k <= 5; k++) { g.moveTo(bx + k * 10, by - (k % 5 ? 1.2 : 2)); g.lineTo(bx + k * 10, by + (k % 5 ? 1.2 : 2)); }
  g.stroke(); pdfText(g, 'check: 50 mm', bx + 25, by + 5.5, 3, { align: 'center', color: '#5a5650' });
  pdfText(g, `Page ${page} of ${pages}`, A4.w - M, A4.h - 6, 3.2, { align: 'right', color: '#8a857c' });
}
const realSizeNote = P => `Real size: print at 100 % / "actual size". Solid line = cutting line (${P.seam} mm seam allowance included); dashed = sewing line.`;
const mirrorNote = t => t.mirrored && t.plain ? `${[...t.ids.keys()].join('/')}: ${t.mirrored} of ${t.mirrored + t.plain} are mirror images, turn the template over to cut them.` : '';
// a sheet holding several whole templates
function pdfPackedPage(P, b, i, sheet, sk, nsk, page, pages) {
  const [c, g] = pdfPageCanvas();
  const notes = sheet.items.map(it => mirrorNote(it.t)).filter(Boolean);
  pdfTemplateHeader(g, P, `Templates · Block ${i + 1}`, [
    { text: `${b.label} · ${sheet.items.map(it => [...it.t.ids.entries()].map(([id, n]) => `${id} × ${n}`).join(', ')).join(' · ')}${nsk > 1 ? ` · sheet ${sk + 1} of ${nsk}` : ''}` },
    { text: realSizeNote(P) },
    ...notes.slice(0, 2).map(n => ({ text: n, color: '#8a3b1f', weight: 600 })),
  ], page, pages);
  for (const it of sheet.items) {
    const ox = TPL.x + sheet.dx + it.x, oy = TPL.y + sheet.dy + it.y;
    drawTemplateShape(g, P, it, ox, oy, [ox, oy, it.w, it.h, 0, 0]);
  }
  return c;
}
// one sheet of a template too big for a single A4 sheet
function pdfTiledPage(P, b, i, sp, tile, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 10;
  const t = sp.t, n = sp.tiles.length;
  pdfTemplateHeader(g, P, `Template · Block ${i + 1}`, [
    { text: `${b.label} · cut ${[...t.ids.entries()].map(([id, k]) => `${id} × ${k}`).join(' · ')} · sheet ${tile.k + 1} of ${n} (row ${tile.r + 1}, column ${tile.c + 1})` },
    { text: realSizeNote(P) },
    ...(mirrorNote(t) ? [{ text: mirrorNote(t), color: '#8a3b1f', weight: 600 }] : []),
  ], page, pages);
  g.save(); g.beginPath(); g.rect(TPL.x, TPL.y, TPL.w, TPL.h); g.clip();
  const ox = TPL.x - tile.c * TPL.w + sp.ox, oy = TPL.y - tile.r * TPL.h + sp.oy;
  drawTemplateShape(g, P, sp, ox, oy, [TPL.x, TPL.y, TPL.w, TPL.h]);
  g.restore();
  g.setLineDash([1, 1]); g.strokeStyle = '#8a857c'; g.lineWidth = 0.25; g.strokeRect(TPL.x, TPL.y, TPL.w, TPL.h); g.setLineDash([]);
  // join marks at the middle of each edge that meets another sheet
  g.strokeStyle = '#1f1d1a'; g.lineWidth = 0.3;
  const mids = [];
  if (tile.c > 0) mids.push([TPL.x, TPL.y + TPL.h / 2, 'left']);
  if (tile.c < sp.cols - 1) mids.push([TPL.x + TPL.w, TPL.y + TPL.h / 2, 'right']);
  if (tile.r > 0) mids.push([TPL.x + TPL.w / 2, TPL.y, 'top']);
  if (tile.r < sp.rows - 1) mids.push([TPL.x + TPL.w / 2, TPL.y + TPL.h, 'bottom']);
  for (const [x, y] of mids) { g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); }
  pdfText(g, 'Trim along the dotted border where sheets join, match the + marks, and tape the sheets edge to edge.', M, A4.h - 6, 3, { color: '#5a5650' });
  return c;
}
function templateJobs(P, b, i) {
  const shapes = blockTemplates(P, b, i).map(t => templateShape(t, P.seam));
  const single = shapes.filter(sp => sp.sheets === 1), big = shapes.filter(sp => sp.sheets > 1), jobs = [];
  const sheets = packTemplates(single);
  sheets.forEach((sh, k) => jobs.push((n, p) => pdfPackedPage(P, b, i, sh, k, sheets.length, p, n)));
  for (const sp of big) {
    sp.cols = Math.ceil(sp.w / TPL.w); sp.rows = Math.ceil(sp.h / TPL.h);
    sp.ox = (sp.cols * TPL.w - sp.w) / 2; sp.oy = (sp.rows * TPL.h - sp.h) / 2;
    const cutAt = sp.cut.map(([x, y]) => [x + sp.ox, y + sp.oy]);
    sp.tiles = [];
    for (let r = 0; r < sp.rows; r++) for (let c = 0; c < sp.cols; c++)
      if (tileHasShape(cutAt, c * TPL.w + 3, r * TPL.h + 3, TPL.w - 6, TPL.h - 6)) sp.tiles.push({ r, c, k: sp.tiles.length });
    for (const tile of sp.tiles) jobs.push((n, p) => pdfTiledPage(P, b, i, sp, tile, p, n));
  }
  return jobs;
}

export { roomiestPoint, templateJobs };
