// Drawings for the Cutting guide: labelled blocks, sashing, borders and the whole quilt.
import '../app/pages.js'; // load order: runs after app/pages
import { cgHi, fabHi } from '../render/hi-state.js';
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { dimUnlessHi } from '../render/highlight.js';
import { orientPoly, partsOf } from '@quilt/shared/patterns.js';
import { fabricById } from '../designer/fabric-library.js';
import {
  blockRect,
  borderTotal,
  bordersOf,
  cellRect,
  pathPoly,
  quiltMm,
  sashOf,
  sashRects,
  spanOf,
} from '@quilt/shared/geometry.js';
import { drawBorders, drawQuilt } from '../render/quilt-draw.js';
import { roomiestPoint } from '../pdf/templates.js';
import { fabricFill, pieceFill } from '../render/fabric-fill.js';

// ------------------------------------------------------------- cutting guide page
const cutOpts = { seam: 7.5, fabricWidth: 1500, selvage: 50, bindingWidth: 60 };
function letterBadge(g, x, y, r, letter) {
  // a circle for one character, a pill for labels such as "A12"
  g.font = `600 ${Math.round(r * 1.15)}px Georgia, "Times New Roman", serif`;
  const w = Math.max(0, g.measureText(letter).width - r * 0.9);
  g.beginPath();
  g.arc(x - w / 2, y, r, Math.PI / 2, Math.PI * 1.5);
  g.arc(x + w / 2, y, r, -Math.PI / 2, Math.PI / 2);
  g.closePath();
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.stroke();
  g.fillStyle = '#1f1d1a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, x, y + 0.5);
}
function drawCutBlock(cv, b, P, num) {
  const css = 300,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ar = P.blockH / P.blockW,
    W = css,
    H = Math.round(css * ar);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = '100%';
  cv.style.maxWidth = W + 'px';
  cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBlockArt(g, b, P, num, W, H);
}
// Draws a block with its pieces labelled (A1, B1, ...) into a W x H box at the context's origin.
// Everything scales with W, so the same drawing serves the page (300 px) and the A4 PDF.
function drawBlockArt(g, b, P, num, W, H) {
  const k = W / 300,
    pxPerCm = W / ((b.size || P.blockW) / 10);
  const polys = b.pieces.map(pc => pc.part.poly.map(([u, v]) => [u * W, v * H]));
  b.pieces.forEach((pc, i) => {
    g.fillStyle = pieceFill(g, b.block, i, polys[i], pxPerCm, b.index * 31 + i);
    pathPoly(g, polys[i]);
    g.fill();
    dimUnlessHi(g, { t: 'piece', num, letter: pc.letter, form: pc.form, fabric: pc.fabric });
  });
  g.lineWidth = 1.5 * k;
  g.strokeStyle = '#ffffff';
  g.lineJoin = 'round';
  polys.forEach(p => {
    pathPoly(g, p);
    g.stroke();
  });
  if (fabHi) {
    g.lineWidth = 2.2 * k;
    g.strokeStyle = '#e0592a';
    b.pieces.forEach((pc, i) => {
      if (fabHi({ t: 'piece', num, letter: pc.letter, form: pc.form, fabric: pc.fabric })) {
        pathPoly(g, polys[i]);
        g.stroke();
      }
    });
  }
  b.pieces.forEach((pc, i) => {
    // label at the roomiest point of the piece (far from every seam), sized to the room there
    const p = polys[i],
      xs = p.map(v => v[0]),
      ys = p.map(v => v[1]),
      x0 = Math.min(...xs),
      y0 = Math.min(...ys),
      x1 = Math.max(...xs),
      y1 = Math.max(...ys);
    const [cx, cy] = roomiestPoint(p, x0, y0, x1 - x0, y1 - y0, 0, 0);
    let d = Infinity;
    for (let j = 0; j < p.length; j++) {
      const a = p[j],
        c = p[(j + 1) % p.length],
        vx = c[0] - a[0],
        vy = c[1] - a[1],
        t = Math.max(0, Math.min(1, ((cx - a[0]) * vx + (cy - a[1]) * vy) / (vx * vx + vy * vy)));
      d = Math.min(d, Math.hypot(cx - a[0] - t * vx, cy - a[1] - t * vy));
    }
    const r = Math.max(5 * k, Math.min(14 * k, d * 0.8));
    letterBadge(g, cx, cy, r, `${pc.letter}${num}.${pc.form}`);
  });
}
function swatchCanvas(fab, w = 72, h = 48) {
  const c = document.createElement('canvas'),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // show about 12 cm of the fabric so the print reads at its real scale
  g.fillStyle = fabricFill(g, fab, w / 12, 5);
  g.fillRect(0, 0, w, h);
  return c;
}
const cgRedraws = []; // redraw functions for the Cutting guide pictures (used when a fabric row is hovered)
// the sashing picture: a 2 × 2 corner of the quilt with every strip and cornerstone labelled with its ID.
// S is the width in px; u scales the labels (1 on screen, more for the PDF at print resolution)
function sashMini() {
  const c = Math.min(2, design.cols),
    r = Math.min(2, design.rows);
  return {
    ...design,
    cols: c,
    rows: r,
    blocks: [0, 1, design.cols, design.cols + 1]
      .filter(i => i < design.blocks.length)
      .slice(0, c * r)
      .map(i => {
        const b = { ...design.blocks[i] };
        delete b.span;
        delete b.under;
        return b;
      }),
    borders: [],
  };
}
function sashPicH(S) {
  const q = quiltMm(sashMini());
  return Math.round((S * q.H) / q.W);
}
function drawSashPic(g, S, sashCuts, u) {
  const mini = sashMini(),
    H = sashPicH(S);
  drawQuilt(g, S, H, { seams: true, design: mini });
  g.font = `600 ${11 * u}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const rc of sashRects(mini, S, H)) {
    const x = sashCuts.find(t => t.what === (rc.kind === 'corner' ? 'Cornerstones' : 'Sashing strips'));
    if (!x) continue;
    const t = x.id,
      tw = g.measureText(t).width + 8 * u,
      vert = rc.h > rc.w,
      hh = 16 * u;
    if (rc.kind === 'corner' && rc.w < tw) {
      // cornerstones are too small to write on: a callout beside each one, with a leader line
      const cx = rc.x + rc.w / 2,
        cy = rc.y + rc.h / 2,
        lx = Math.min(S - tw / 2 - 2 * u, cx + 22 * u),
        ly = Math.max(10 * u, cy - 20 * u);
      g.strokeStyle = '#1f1d1a';
      g.lineWidth = u;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(lx, ly);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, 2 * u, 0, Math.PI * 2);
      g.fillStyle = '#1f1d1a';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.fillRect(lx - tw / 2, ly - hh / 2, tw, hh);
      g.strokeRect(lx - tw / 2, ly - hh / 2, tw, hh);
      g.fillStyle = '#1f1d1a';
      g.fillText(t, lx, ly + u);
      continue;
    }
    if (rc.w < 18 * u && rc.h < 18 * u) continue;
    g.save();
    g.translate(rc.x + rc.w / 2, rc.y + rc.h / 2);
    if (vert && rc.w < tw) g.rotate(-Math.PI / 2);
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.fillRect(-tw / 2, -hh / 2, tw, hh);
    g.fillStyle = '#1f1d1a';
    g.fillText(t, 0, u);
    g.restore();
  }
}
// a border ring in px on a W-wide drawing at k px/mm: 'brd' = all borders, 'b<i>' = border i (1 is the innermost)
function borderRing(kind, k) {
  const bs = bordersOf(design);
  if (kind === 'brd') return { o: 0, t: borderTotal(design) * k };
  const i = +kind.slice(1);
  return { o: bs.slice(i + 1).reduce((a, b) => a + b.mm, 0) * k, t: (bs[i] ? bs[i].mm : 0) * k };
}
function dimOutsideRing(g, W, H, r) {
  g.beginPath();
  g.rect(0, 0, W, H);
  g.rect(r.o, r.o, W - 2 * r.o, H - 2 * r.o);
  g.rect(r.o + r.t, r.o + r.t, W - 2 * (r.o + r.t), H - 2 * (r.o + r.t));
  g.fillStyle = 'rgba(236,239,244,.72)';
  g.fill('evenodd');
}
function outlineRing(g, W, H, r, lw = [6, 3.5]) {
  for (const [w, c] of [
    [lw[0], '#fff'],
    [lw[1], '#e0592a'],
  ]) {
    g.lineWidth = w;
    g.strokeStyle = c;
    g.strokeRect(r.o + 1.5, r.o + 1.5, W - 2 * r.o - 3, H - 2 * r.o - 3);
    g.strokeRect(r.o + r.t, r.o + r.t, W - 2 * (r.o + r.t), H - 2 * (r.o + r.t));
  }
}
// one click opens / closes a card's cutting list (it slides down / up); a double-click finds it in the whole quilt
// how many copies of a plan block are mirrored in the quilt (they need odd-shaped pieces cut reversed)
// only shapes without a mirror symmetry of their own (most odd shapes) need cutting reversed for a mirrored block
function chiral(poly) {
  const n = poly.length,
    e = [],
    a = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i],
      q = poly[(i + 1) % n],
      r = poly[(i + 2) % n];
    e.push(Math.hypot(q[0] - p[0], q[1] - p[1]));
    a.push(
      Math.atan2(
        (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]),
        (q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1]),
      ),
    );
  }
  const sig = (E, A) => E.map((v, i) => `${v.toFixed(4)}:${Math.abs(A[i]).toFixed(3)}`);
  const f = sig(e, a),
    rev = sig(
      [...e].reverse(),
      [...a]
        .reverse()
        .slice(1)
        .concat([...a].reverse()[0]),
    );
  for (let k = 0; k < n; k++) if (f.every((v, i) => v === rev[(i + k) % n])) return false;
  return true;
}
const patternChiral = {};
function hasChiralPiece(pattern) {
  if (!(pattern in patternChiral)) patternChiral[pattern] = partsOf(pattern).some(p => chiral(p.poly));
  return patternChiral[pattern];
}
function mirroredCount(pb) {
  if (!hasChiralPiece(pb.block.pattern)) return 0;
  const k = pb.block.pattern + '|' + pb.span + '|' + pb.block.fabrics.join(',');
  return design.blocks.filter(
    b => b.flip && b.under == null && b.pattern + '|' + spanOf(b) + '|' + b.fabrics.join(',') === k,
  ).length;
}
// the real quilt (sashing and borders included) with the sashing or the borders outlined and the rest dimmed
function drawQuiltHi(cv, maxW, maxH, kind) {
  const q = quiltMm(design),
    k = Math.min(maxW / q.W, maxH / q.H),
    W = Math.round(q.W * k),
    H = Math.round(q.H * k);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px';
  cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, W, H, { seams: true });
  g.save();
  if (kind === 'sash') {
    const rs = sashRects(design, W, H);
    g.beginPath();
    g.rect(0, 0, W, H);
    for (const r of rs) g.rect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(236,239,244,.72)';
    g.fill('evenodd');
    for (const r of rs) {
      g.lineWidth = 3;
      g.strokeStyle = '#fff';
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.lineWidth = 1.6;
      g.strokeStyle = '#e0592a';
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
  } else {
    const r = borderRing(kind, k);
    dimOutsideRing(g, W, H, r);
    outlineRing(g, W, H, r);
  }
  g.restore();
}
function drawCutQuilt(P, into) {
  const cv = into ? into.cv : $('cg-quilt'),
    box = cv.parentElement;
  // into.u scales labels and lines (the PDF draws at print resolution); into.dpr overrides the screen's pixel ratio
  const u = (into && into.u) || 1,
    dpr = (into && into.dpr) || Math.min(window.devicePixelRatio || 1, 2),
    lab = 22 * u;
  // lay the quilt out at its real proportions, sashing and borders included; with no sashing the blocks
  // still sit a little apart (an empty gap) so each one reads on its own
  const s = sashOf(design),
    gapMm = Math.round(design.blockMm * 0.05);
  const d2 = s.mm ? design : { ...design, sashing: { mm: gapMm, fabric: 'b0', corner: 'b0', border: false } };
  const q = quiltMm(d2);
  const availW = (into ? into.w : Math.min(1100, box.clientWidth || 900)) - lab;
  let k = availW / q.W;
  if (into) k = Math.min(k, (into.h - lab) / q.H);
  k = Math.max(k, (60 * u) / design.blockMm);
  const W = Math.round(q.W * k),
    H = Math.round(q.H * k),
    TW = W + lab,
    TH = H + lab;
  cv.width = Math.round(TW * dpr);
  cv.height = Math.round(TH * dpr);
  cv.style.width = TW + 'px';
  cv.style.aspectRatio = `${TW} / ${TH}`;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, TW, TH);
  g.save();
  g.translate(lab, lab);
  const pxPerCm = k * 10;
  // borders and sashing in their fabrics
  if (bordersOf(design).length) drawBorders(g, d2, W, H, pxPerCm, true);
  const sr = s.mm ? sashRects(d2, W, H) : [];
  sr.forEach((rc, i) => {
    g.fillStyle = fabricFill(g, fabricById(rc.kind === 'corner' ? s.corner : s.fabric), pxPerCm, 900 + i);
    g.fillRect(rc.x, rc.y, rc.w, rc.h);
    g.beginPath();
    g.rect(rc.x, rc.y, rc.w, rc.h);
    dimUnlessHi(g, { t: 'sash', kind: rc.kind });
    g.strokeStyle = 'rgba(40,30,20,.35)';
    g.lineWidth = u;
    g.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1);
  });
  // blocks, each turned as designed, every piece labelled with its ID
  const numOf = new Map(P.blocks.map((b, i) => [b.block.pattern + '|' + b.span + '|' + b.block.fabrics.join(','), i]));
  const rects = [];
  design.blocks.forEach((blk, bi) => {
    if (blk.under != null) return;
    const i = numOf.get(blk.pattern + '|' + spanOf(blk) + '|' + blk.fabrics.join(',')),
      pb = P.blocks[i];
    const r = Math.floor(bi / design.cols),
      c = bi % design.cols,
      R = blockRect(d2, c, r, W, H);
    rects.push({ ...R, i });
    const turned = {
      ...pb,
      index: bi,
      pieces: pb.pieces.map(pc => ({ ...pc, part: { ...pc.part, poly: orientPoly(pc.part.poly, blk) } })),
    };
    g.save();
    g.translate(R.x, R.y);
    drawBlockArt(g, turned, P, i + 1, R.w, R.h);
    g.restore();
    g.strokeStyle = 'rgba(30,28,25,.55)';
    g.lineWidth = u;
    g.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
  });
  // piece IDs on the sashing and on each border (where there is room)
  const extra = P.sashing || [],
    tag = (t, x, y, fs, rot) => {
      g.save();
      g.translate(x, y);
      if (rot) g.rotate(-Math.PI / 2);
      g.font = `600 ${fs}px Georgia, serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tw = g.measureText(t).width + 6 * u;
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.fillRect(-tw / 2, -fs * 0.7, tw, fs * 1.4);
      g.fillStyle = '#1f1d1a';
      g.fillText(t, 0, 0.5);
      g.restore();
    };
  if (sr.length) {
    const idOf = kind =>
      (extra.find(x => x.group === 'sash' && x.what === (kind === 'corner' ? 'Cornerstones' : 'Sashing strips')) || {})
        .id;
    for (const rc of sr) {
      const t = idOf(rc.kind),
        thin = Math.min(rc.w, rc.h);
      if (!t || (thin < 9 * u && rc.kind !== 'corner') || thin < 3 * u) continue;
      const fs = Math.min(11 * u, thin * 0.75),
        long = Math.max(rc.w, rc.h);
      if (rc.kind === 'corner') {
        if (rc.w >= 30 * u) tag(t, rc.x + rc.w / 2, rc.y + rc.h / 2, Math.min(11 * u, rc.w / 3.2), false);
        else {
          // too small to write on: a short callout up and to the right, with a leader line
          const cx = rc.x + rc.w / 2,
            cy = rc.y + rc.h / 2,
            lx = Math.min(W - 18 * u, cx + 18 * u),
            ly = Math.max(8 * u, cy - 16 * u);
          g.strokeStyle = '#1f1d1a';
          g.lineWidth = u;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(lx, ly);
          g.stroke();
          tag(t, lx, ly, 9 * u, false);
        }
      } else if (long > 40 * u) tag(t, rc.x + rc.w / 2, rc.y + rc.h / 2, fs, rc.h > rc.w);
    }
  }
  const bs = bordersOf(design);
  bs.forEach((b, i) => {
    const o = bs.slice(i + 1).reduce((a, x) => a + x.mm, 0) * k,
      t = b.mm * k;
    if (t < 10 * u) return;
    const ids = extra
      .filter(x => x.group === 'b' + i)
      .map(x => x.id)
      .filter(Boolean)
      .join('  ');
    if (!ids) return;
    tag(ids, W / 2, o + t / 2, Math.min(11 * u, t * 0.7), false);
    tag(ids, W / 2, H - o - t / 2, Math.min(11 * u, t * 0.7), false);
  });
  // highlight: a block (number), the sashing ('sash') or the borders ('brd'); everything else is dimmed
  if (cgHi !== -1) {
    const ring = typeof cgHi === 'string' && cgHi !== 'sash';
    const tgt = cgHi === 'sash' ? sr : ring ? [] : rects.filter(R => R.i === cgHi);
    const outline = (x, y, w, h, wide) => {
      g.lineWidth = wide ? 6 : 3;
      g.strokeStyle = '#fff';
      g.strokeRect(x, y, w, h);
      g.lineWidth = wide ? 3.5 : 1.6;
      g.strokeStyle = '#e0592a';
      g.strokeRect(x, y, w, h);
    };
    if (ring) {
      const r = borderRing(cgHi, k);
      dimOutsideRing(g, W, H, r);
      outlineRing(g, W, H, r);
    } else {
      g.beginPath();
      g.rect(0, 0, W, H);
      for (const R of tgt) g.rect(R.x, R.y, R.w, R.h);
      g.fillStyle = 'rgba(236,239,244,.72)';
      g.fill('evenodd');
    }
    if (!ring)
      for (const R of tgt)
        outline(
          R.x - (cgHi === 'sash' ? 0 : 1),
          R.y - (cgHi === 'sash' ? 0 : 1),
          R.w + (cgHi === 'sash' ? 0 : 2),
          R.h + (cgHi === 'sash' ? 0 : 2),
          cgHi !== 'sash',
        );
  }
  g.restore();
  // column and row numbers along the blocks
  g.fillStyle = '#6b665e';
  g.font = `${12 * u}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let c = 0; c < design.cols; c++) {
    const R = cellRect(d2, c, 0, W, H);
    g.fillText(String(c + 1), lab + R.x + R.w / 2, lab / 2);
  }
  for (let r = 0; r < design.rows; r++) {
    const R = cellRect(d2, 0, r, W, H);
    g.fillText(String(r + 1), lab / 2, lab + R.y + R.h / 2);
  }
  if (into) return;
  const nHi = typeof cgHi === 'number' && cgHi >= 0 ? P.blocks[cgHi].count : 0;
  $('cg-quilt-meta').textContent =
    typeof cgHi === 'string'
      ? `Showing the ${cgHi === 'sash' ? 'sashing' : cgHi === 'brd' ? 'borders' : 'border ' + (+cgHi.slice(1) + 1)}, marked in orange. Double-click it again, or click here, to show all.`
      : cgHi >= 0
        ? `Showing block ${cgHi + 1} (${P.blocks[cgHi].label}): ${nHi} in the quilt. Double-click it again, or click here, to show all.`
        : `${design.cols} × ${design.rows} blocks${s.mm ? ` · ${s.mm} mm sashing` : ''}${bs.length ? ` · ${bs.length} border${bs.length > 1 ? 's' : ''}` : ''} · finished ${P.quiltW} × ${P.quiltH} mm · each piece shows fabric letter + block number . form (D2.3 = fabric D, block 2, form 3; S = sashing, B1 = border 1). Double-click a block, the sashing or the borders above to see where they go in the quilt.`;
  $('cg-quilt-meta').classList.toggle('cg-hi-on', cgHi !== -1);
  document.querySelectorAll('.cgblock').forEach(el => el.classList.toggle('picked', el.dataset.key === String(cgHi)));
}

export {
  cgRedraws,
  cutOpts,
  drawBlockArt,
  drawCutBlock,
  drawCutQuilt,
  drawQuiltHi,
  drawSashPic,
  mirroredCount,
  sashPicH,
  swatchCanvas,
};
