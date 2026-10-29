// Hover highlight on blocks, parts, sashing and borders, with the rotate and mirror buttons.
import '../camera/fabric-camera.js'; // load order: runs after camera/fabric-camera
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { partsOf } from '../core/patterns.js';
import { fabricById } from './fabric-library.js';
import { saveDesign } from './design-state.js';
import {
  BORDER_TYPES,
  blockAt,
  blockPolys,
  blockRect,
  borderTotal,
  bordersOf,
  pathPoly,
  pathPolyInto,
  pointInPoly,
  quiltMm,
  sashOf,
  sashRects,
} from '../core/geometry.js';
import { flipped } from './canvas.js';
import { drawPartsEditor, renderDesigner } from './parts-editor.js';
import { openBlockEditor } from './side-panel.js';
import { symApply } from './symmetry.js';

// ---- hover: highlight the block under the mouse; rest on one part and only that part lights up.
// A click while a part is lit opens a small pop-up with just the fabrics, for that part.
const hover = { bi: -1, part: -1, cand: -1, timer: 0, x: 0, y: 0, zone: null, zr: null, zi: -1 };
const PART_DWELL = 650; // ms the mouse must rest on a part
function hoverGeom() {
  const cv = $('dz-quilt'),
    w = parseFloat(cv.style.width) || cv.clientWidth,
    h = parseFloat(cv.style.height) || cv.clientHeight;
  return { w, h };
}
function partAt(bi, x, y) {
  const { w, h } = hoverGeom(),
    R = blockRect(shared.design, bi % shared.design.cols, Math.floor(bi / shared.design.cols), w, h);
  return blockPolys(shared.design.blocks[bi], R.x, R.y, R.w, R.h).findIndex(p => pointInPoly(x, y, p));
}
// what lies under (x, y) outside the blocks: a sashing strip / cornerstone, or one of the borders
function zoneAt(x, y) {
  const { w: W, h: H } = hoverGeom(),
    q = quiltMm(shared.design),
    k = W / q.W,
    mx = x / k,
    my = y / k;
  const bs = bordersOf(shared.design),
    d = Math.min(mx, my, q.W - mx, q.H - my);
  if (bs.length && d >= 0 && d < borderTotal(shared.design)) {
    let o = 0;
    for (let i = bs.length - 1; i >= 0; i--) {
      if (d < o + bs[i].mm) return { zone: 'brd', zi: i, zr: { o: o * k, t: bs[i].mm * k } };
      o += bs[i].mm;
    }
  }
  for (const r of sashRects(shared.design, W, H))
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { zone: 'sash', zi: -1, zr: r };
  return null;
}
function hoverLabel(g, txt, W) {
  g.font = '600 12px system-ui, sans-serif';
  const tw = g.measureText(txt).width + 14;
  const lx = Math.min(Math.max(4, hover.x + 14), W - tw - 4),
    ly = Math.max(4, hover.y - 30);
  g.fillStyle = 'rgba(25,28,36,.88)';
  g.beginPath();
  g.roundRect ? g.roundRect(lx, ly, tw, 22, 6) : g.rect(lx, ly, tw, 22);
  g.fill();
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(txt, lx + 7, ly + 11);
}
function drawHover() {
  const cv = $('dz-hover');
  if (!cv || !shared.design) return;
  const g = cv.getContext('2d'),
    dpr = cv.width / (parseFloat(cv.style.width) || 1);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rb = $('dz-hrot');
  if (hover.zone) {
    // sashing or a border: light it up like a block, with its name
    if (rb) rb.hidden = true;
    if ($('dz-hflip')) $('dz-hflip').hidden = true;
    const { w: W, h: H } = hoverGeom(),
      z = hover.zr;
    g.save();
    g.beginPath();
    if (hover.zone === 'brd') {
      g.rect(z.o, z.o, W - 2 * z.o, H - 2 * z.o);
      g.rect(z.o + z.t, z.o + z.t, W - 2 * (z.o + z.t), H - 2 * (z.o + z.t));
    } else for (const r of sashRects(shared.design, W, H)) g.rect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(255,255,255,.26)';
    g.fill('evenodd');
    g.lineJoin = 'round';
    for (const [lw, c] of [
      [3, 'rgba(255,255,255,.95)'],
      [1.5, '#e0592a'],
    ]) {
      g.lineWidth = lw;
      g.strokeStyle = c;
      if (hover.zone === 'brd') {
        g.strokeRect(z.o + 1, z.o + 1, W - 2 * z.o - 2, H - 2 * z.o - 2);
        g.strokeRect(z.o + z.t, z.o + z.t, W - 2 * (z.o + z.t), H - 2 * (z.o + z.t));
      } else g.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    }
    g.restore();
    const s = sashOf(shared.design),
      b = hover.zone === 'brd' ? bordersOf(shared.design)[hover.zi] : null;
    hoverLabel(
      g,
      hover.zone === 'brd'
        ? `Border ${hover.zi + 1} · ${BORDER_TYPES[b.type].label} · ${b.mm} mm · click to edit`
        : `${z.kind === 'corner' ? 'Cornerstone' : 'Sashing'} · ${fabricById(z.kind === 'corner' ? s.corner : s.fabric).name} · ${s.mm} mm · click to edit`,
      W,
    );
    return;
  }
  if (hover.bi < 0 || hover.bi >= shared.design.blocks.length) {
    if (rb) rb.hidden = true;
    if ($('dz-hflip')) $('dz-hflip').hidden = true;
    return;
  }
  const { w: HW, h: HH } = hoverGeom(),
    RR = blockRect(shared.design, hover.bi % shared.design.cols, Math.floor(hover.bi / shared.design.cols), HW, HH),
    x = RR.x,
    y = RR.y,
    bw = RR.w,
    bh = RR.h;
  if (rb) {
    // small round rotate button in the block's top-right corner
    const sz = bw < 70 ? 22 : 28;
    rb.style.width = rb.style.height = sz + 'px';
    rb.style.left = cv.offsetLeft + x + bw - sz - 5 + 'px';
    rb.style.top = cv.offsetTop + y + 5 + 'px';
    rb.hidden = bw < 34 || document.body.classList.contains('tour-active');
    const fb = $('dz-hflip');
    if (fb) {
      fb.style.width = fb.style.height = sz + 'px';
      fb.style.left = cv.offsetLeft + x + bw - 2 * sz - 9 + 'px';
      fb.style.top = rb.style.top;
      fb.hidden = rb.hidden || bw < 70;
    }
  }
  if (hover.part < 0) {
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.fillRect(x, y, bw, bh);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    g.lineWidth = 1.5;
    g.strokeStyle = '#e0592a';
    g.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    return;
  }
  const polys = blockPolys(shared.design.blocks[hover.bi], x, y, bw, bh),
    p = polys[hover.part];
  if (!p) return;
  // dim the rest of the block a little so the part stands out
  g.save();
  g.beginPath();
  g.rect(x, y, bw, bh);
  pathPolyInto(g, p);
  g.fillStyle = 'rgba(20,24,34,.28)';
  g.fill('evenodd');
  g.restore();
  pathPoly(g, p);
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 3;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = '#e0592a';
  g.stroke();
  // label: part name and fabric
  const b = shared.design.blocks[hover.bi],
    txt = `${partsOf(b.pattern)[hover.part].name} · ${fabricById(b.fabrics[hover.part]).name}`;
  g.font = '600 12px system-ui, sans-serif';
  const tw = g.measureText(txt).width + 14;
  const W = parseFloat(cv.style.width),
    lx = Math.min(Math.max(4, hover.x + 14), W - tw - 4),
    ly = Math.max(4, hover.y - 30);
  g.fillStyle = 'rgba(25,28,36,.88)';
  g.beginPath();
  g.roundRect ? g.roundRect(lx, ly, tw, 22, 6) : g.rect(lx, ly, tw, 22);
  g.fill();
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(txt, lx + 7, ly + 11);
}
function clearHover() {
  clearTimeout(hover.timer);
  if (hover.bi !== -1 || hover.part !== -1 || hover.zone) {
    hover.bi = -1;
    hover.part = -1;
    hover.cand = -1;
    hover.zone = null;
    drawHover();
  }
}
function initHover() {
  const qcv = $('dz-quilt');
  qcv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || flipped || !shared.design || e.buttons) {
      if (e.buttons) clearHover();
      return;
    }
    const r = qcv.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    const { w: HW, h: HH } = hoverGeom(),
      bi = blockAt(shared.design, x, y, HW, HH);
    if (bi < 0) {
      const z = zoneAt(x, y);
      if (!z) {
        clearHover();
        return;
      }
      clearTimeout(hover.timer);
      hover.timer = 0;
      hover.bi = -1;
      hover.part = -1;
      hover.x = x;
      hover.y = y;
      hover.zone = z.zone;
      hover.zi = z.zi;
      hover.zr = z.zr;
      drawHover();
      return;
    }
    hover.zone = null;
    const part = partAt(bi, x, y);
    hover.x = x;
    hover.y = y;
    if (bi !== hover.bi) {
      hover.bi = bi;
      hover.part = -1;
      hover.cand = part;
      clearTimeout(hover.timer);
    }
    if (hover.part >= 0) {
      if (part >= 0 && part !== hover.part) hover.part = part;
      drawHover();
      return;
    } // part mode follows the mouse
    if (part !== hover.cand || !hover.timer) {
      hover.cand = part;
      clearTimeout(hover.timer);
      hover.timer = setTimeout(() => {
        hover.timer = 0;
        if (document.body.classList.contains('tour-active')) return;
        if (hover.cand >= 0 && hover.bi >= 0) {
          hover.part = hover.cand;
          drawHover();
        }
      }, PART_DWELL);
    }
    drawHover();
  });
  const hrot = $('dz-hrot');
  const hflip = $('dz-hflip'),
    onBtn = el => el && (hrot.contains(el) || hflip.contains(el));
  qcv.addEventListener('pointerleave', e => {
    if (onBtn(e.relatedTarget)) return;
    clearHover();
  });
  document.addEventListener(
    'pointermove',
    e => {
      if ((hover.bi >= 0 || hover.zone) && e.target !== qcv && !onBtn(e.target)) clearHover();
    },
    { passive: true },
  );
  hflip.addEventListener('pointermove', () => {
    if (hover.part >= 0) hover.part = -1;
    clearTimeout(hover.timer);
    hover.timer = 0;
    drawHover();
  });
  hflip.addEventListener('click', e => {
    e.stopPropagation();
    const bi = hover.bi;
    if (bi < 0 || !shared.design) return;
    const targets = shared.selBlocks.size > 1 && shared.selBlocks.has(bi) ? [...shared.selBlocks] : [bi];
    for (const i of targets) {
      const b = shared.design.blocks[i];
      if (b.flip) delete b.flip;
      else b.flip = true;
    }
    symApply(targets);
    saveDesign();
    renderDesigner();
    drawPartsEditor();
    hover.bi = bi;
    drawHover();
  });
  hrot.addEventListener('pointermove', () => {
    if (hover.part >= 0) {
      hover.part = -1;
    }
    clearTimeout(hover.timer);
    hover.timer = 0;
    drawHover();
  });
  hrot.addEventListener('click', e => {
    e.stopPropagation();
    const bi = hover.bi;
    if (bi < 0 || !shared.design) return;
    // rotate the hovered block, or every selected block when it is one of several selected
    const targets = shared.selBlocks.size > 1 && shared.selBlocks.has(bi) ? [...shared.selBlocks] : [bi];
    for (const i of targets) shared.design.blocks[i].rot = (shared.design.blocks[i].rot + 1) % 4;
    symApply(targets);
    saveDesign();
    renderDesigner();
    drawPartsEditor();
    hover.bi = bi;
    drawHover();
  });
  qcv.addEventListener('pointerdown', () => {
    clearTimeout(hover.timer);
    hover.timer = 0;
  });
  // a click on a lit part opens the fabric pop-up instead of the block editor
  qcv.addEventListener(
    'click',
    e => {
      if (flipped || hover.part < 0 || hover.bi < 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.defaultPrevented)
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const bi = hover.bi,
        part = hover.part;
      shared.selBlocks = new Set([bi]);
      shared.focusBlock = bi;
      shared.selParts = new Set([part]);
      clearHover();
      renderDesigner();
      openBlockEditor();
      drawPartsEditor();
    },
    true,
  );
}

export { clearHover, drawHover, initHover };
