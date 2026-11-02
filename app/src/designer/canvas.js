// Drawing the quilt in the designer (front and back) and turning it over.
import '../render/quilt-draw.js'; // load order: runs after render/quilt-draw
import { design, focusBlock, selBlocks } from '../core/store.js';
import { $, themeColour } from '../core/dom.js';
import { dims, len } from '../core/units.js';
import { fabricById } from './fabric-library.js';
import {
  blockOutline,
  blockPlace,
  borderTotal,
  bordersOf,
  pathPoly,
  placeBox,
  quiltMm,
  sashOf,
  uniteOf,
} from '@quilt/shared/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { drawPaletteInto } from './parts-editor.js';
import { editorInSide } from './side-panel.js';
import { drawQuiltingLines, quiltingOf, strokeSeams } from '../render/quilting.js';
import { drawHover } from './hover.js';
import { fabricFill } from '../render/fabric-fill.js';
import { symOf } from '../core/symmetry.js';
import { SHAPE_NAMES } from '@quilt/shared/mosaic.js';
import { t, tn } from '@quilt/shared/i18n.js';

// ---- zoom: the mouse wheel over the quilt zooms in and out at the mouse; dragging with the wheel pressed moves
// the quilt. Zoomed, the quilt is drawn bigger (so it stays sharp) in a window of its usual size, and moved in it:
// everything that finds a block or shape under the mouse measures from the canvas, so it keeps working.
const ZOOM_MAX = 6;
const zoom = { z: 1, x: 0, y: 0 }; // x, y: how far the zoomed quilt is moved left and up, css px
/** The quilt's size in its window (unzoomed), css px. */
let view = { w: 0, h: 0 };
/** Keeps the zoomed quilt filling its window. */
function clampPan() {
  zoom.x = Math.max(0, Math.min(view.w * zoom.z - view.w, zoom.x));
  zoom.y = Math.max(0, Math.min(view.h * zoom.z - view.h, zoom.y));
}
/** Places the zoomed quilt (and the layer drawn over it) in its window, without drawing it again. */
function placeZoomed() {
  const on = zoom.z > 1,
    inner = $('dz-quilt').parentElement;
  inner.classList.toggle('zoomed', on);
  inner.style.width = on ? view.w + 'px' : '';
  inner.style.height = on ? view.h + 'px' : '';
  for (const id of ['dz-quilt', 'dz-hover']) {
    const el = $(id);
    el.style.left = on ? -zoom.x + 'px' : '';
    el.style.top = on ? -zoom.y + 'px' : '';
  }
}
/**
 * Zooms by a factor about a point of the quilt's window (css px from its top left), keeping that point under the
 * mouse. Returns false when nothing changed (already all the way out: the page may scroll instead).
 * @param {number} f @param {number} mx @param {number} my
 */
function zoomAt(f, mx, my) {
  const z = Math.max(1, Math.min(ZOOM_MAX, zoom.z * f));
  if (Math.abs(z - zoom.z) < 1e-3) return false;
  const u = (mx + zoom.x) / zoom.z,
    v = (my + zoom.y) / zoom.z;
  zoom.z = z < 1.02 ? 1 : z; // close enough to the whole quilt: exactly it
  zoom.x = u * zoom.z - mx;
  zoom.y = v * zoom.z - my;
  clampPan();
  drawSoon();
  return true;
}
/** Moves the zoomed quilt by (dx, dy) css px, as if dragged. */
function panBy(dx, dy) {
  zoom.x -= dx;
  zoom.y -= dy;
  clampPan();
  placeZoomed();
}
/** Back to the whole quilt. */
function resetZoom() {
  if (zoom.z === 1) return;
  Object.assign(zoom, { z: 1, x: 0, y: 0 });
  drawDesignerCanvas();
}
let soonFrame = 0;
const drawSoon = () => {
  if (!soonFrame)
    soonFrame = requestAnimationFrame(() => {
      soonFrame = 0;
      drawDesignerCanvas();
    });
};

function drawDesignerCanvas() {
  if (!design) return;
  const cv = $('dz-quilt'),
    box = cv.closest('.dz-quiltwrap').getBoundingClientRect();
  const dpr0 = Math.min(window.devicePixelRatio || 1, 2),
    qmm = quiltMm(design),
    ar = qmm.H / qmm.W;
  // the preview has the quilt's real proportions (square blocks), and fits the screen
  let cw = Math.max(200, Math.floor(Math.min(box.width - (window.innerWidth > 640 ? 128 : 0), 860)));
  let maxH = Math.max(320, Math.floor(window.innerHeight * 0.82));
  if (document.body.classList.contains('tl-open')) {
    // keep the whole quilt above the timeline bar
    const docTop0 = cv.closest('.dz-quiltwrap').getBoundingClientRect().top + window.scrollY;
    maxH = Math.max(240, Math.floor(window.innerHeight - docTop0 - ($('tl-panel').offsetHeight || 0) - 92));
  }
  // with the tools open on a wide screen the quilt column is pinned: the quilt must fit the window
  if ($('dz').classList.contains('tools-open') && window.innerWidth > 920) {
    // fit below the page header without any page scrolling: the page stays still, only the tools scroll
    const docTop = cv.closest('.dz-quiltwrap').getBoundingClientRect().top + window.scrollY;
    const tlH = document.body.classList.contains('tl-open') ? $('tl-panel').offsetHeight : 0;
    maxH = Math.max(240, Math.floor(window.innerHeight - docTop - 160 - tlH)); // room for the two lines under the quilt and the page's bottom margin
    const side = $('dz-side'),
      sideTop = side.getBoundingClientRect().top + window.scrollY;
    side.style.maxHeight = Math.max(240, Math.floor(window.innerHeight - sideTop - 40 - tlH)) + 'px';
  } else {
    $('dz-side').style.maxHeight = '';
  }
  if (cw * ar > maxH) cw = Math.floor(maxH / ar);
  // zoomed: the quilt is drawn zoom.z times bigger, in a window of the usual size (cw, ch from here on are the
  // drawn size); a very big drawing uses fewer pixels per css px, so the canvas stays a sane size
  view = { w: cw, h: Math.round(cw * ar) };
  clampPan();
  cw = Math.round(view.w * zoom.z);
  const ch = Math.round(view.h * zoom.z),
    dpr = Math.min(dpr0, 4096 / Math.max(cw, ch));
  placeZoomed();
  cv.style.width = cw + 'px';
  cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * dpr);
  cv.height = Math.floor(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, cw, ch, { seams: true });
  // the quilting stitches, as thread on the top
  const qk = quiltingOf(design);
  if (qk !== 'ditch') {
    g.save();
    g.setLineDash([Math.max(2, cw / 300), Math.max(1.5, cw / 420)]);
    g.lineWidth = Math.max(0.7, cw / 1000);
    g.strokeStyle = 'rgba(40,30,20,.28)';
    g.translate(0.6, 0.6);
    drawQuiltingLines(g, cw, ch, qk);
    g.translate(-0.6, -0.6);
    g.strokeStyle = 'rgba(255,255,255,.5)';
    drawQuiltingLines(g, cw, ch, qk);
    g.restore();
  }
  // binding
  g.strokeStyle = '#2f466f';
  g.lineWidth = Math.max(3, cw * 0.006);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  // the selection frame shows only while blocks are being edited; otherwise only the hover marks a block
  const editing = !design.mosaic && ($('dz-dialog').open || editorInSide || selBlocks.size > 1);
  if (editing)
    for (const bi of selBlocks) {
      // the block's outline (a diamond on point), drawn 1.5 px inside its edge
      const P = blockPlace(design, bi, cw, ch),
        cx = P.x + P.w / 2,
        cy = P.y + P.h / 2,
        k = 1 - 3 / Math.max(P.w, 6);
      const frame = blockOutline(P).map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
      g.lineWidth = 3;
      g.strokeStyle = '#ffffff';
      pathPoly(g, frame);
      g.stroke();
      g.lineWidth = 1.5;
      g.strokeStyle = bi === focusBlock ? themeColour('--mark', '#d2602f') : themeColour('--ink', '#2e211c');
      g.setLineDash(bi === focusBlock ? [] : [5, 4]);
      g.stroke();
      g.setLineDash([]);
    }
  // symmetry axes (dashed) while a symmetry is on: the lines the design is mirrored across
  const sy = symOf(design);
  if (sy !== 'off') {
    const bt = (borderTotal(design) * cw) / quiltMm(design).W,
      x0 = bt,
      y0 = bt,
      x1 = cw - bt,
      y1 = ch - bt,
      mx = cw / 2,
      my = ch / 2;
    g.save();
    g.setLineDash([8, 6]);
    g.lineCap = 'round';
    const line = (a, b, c, d) => {
      for (const [w, col] of [
        [4, 'rgba(255,255,255,.85)'],
        [2, themeColour('--mark', '#d2602f')],
      ]) {
        g.lineWidth = w;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(a, b);
        g.lineTo(c, d);
        g.stroke();
      }
    };
    if (sy !== 'tb') line(mx, y0, mx, y1);
    if (sy !== 'lr') line(x0, my, x1, my);
    if (sy === 'kal') {
      line(x0, y0, x1, y1);
      line(x1, y0, x0, y1);
    }
    g.restore();
  }
  const sz = sashOf(design);
  const nb = bordersOf(design).length;
  // a mosaic has no blocks: its shapes instead of the block size
  $('dz-bsize').hidden = !!design.mosaic;
  const mos = design.mosaic
    ? t('{n} {shapes}, {size} sides', {
        n: design.mosaic.fabrics.length,
        shapes: SHAPE_NAMES[design.mosaic.shape][1],
        size: len(design.mosaic.mm),
      })
    : '';
  const sashText =
      sz.mm && !design.mosaic
        ? ' · ' +
          (sz.border
            ? t('{size} sashing with border', { size: len(sz.mm) })
            : t('{size} sashing', { size: len(sz.mm) }))
        : '',
    borderText = nb
      ? ' · ' + tn(nb, '{n} border ({size})', '{n} borders ({size})', { size: len(borderTotal(design)) })
      : '';
  $('dz-size-b').textContent =
    `${mos}${sashText}${borderText} · ${t('finished quilt {size}', { size: dims([qmm.W, qmm.H]) })}`;
  drawBackCanvas(view.w, view.h, dpr0);
  const hv = $('dz-hover');
  hv.style.width = cw + 'px';
  hv.style.height = ch + 'px';
  hv.width = Math.floor(cw * dpr);
  hv.height = Math.floor(ch * dpr);
  drawHover();
  placeUnite(cw, ch);
}
// Unite: a button at the top-right corner of a selection of several blocks; greyed, with the reason, when they
// are not a square of 2 × 2 to 4 × 4 (shared/geometry.js uniteOf). Redrawn with the selection frames.
const UNITE_WHY = {
  square: [t('Select a square'), t('Select a square of blocks to unite them: 2 × 2, 3 × 3 or 4 × 4')],
  size: [t('Up to 4 × 4'), t('Up to 4 × 4 blocks can be united into one')],
  one: ['', ''],
};
function placeUnite(cw, ch) {
  const b = $('dz-unite'),
    cv = $('dz-quilt');
  if (!b) return;
  if (selBlocks.size < 2 || flipped || design.mosaic || document.body.classList.contains('tour-active')) {
    b.hidden = true;
    return;
  }
  let right = 0,
    top = Infinity;
  for (const bi of selBlocks) {
    const R = placeBox(blockPlace(design, bi, cw, ch));
    right = Math.max(right, R.x + R.w);
    top = Math.min(top, R.y);
  }
  const u = uniteOf(design, selBlocks),
    [label, why] =
      'why' in u
        ? UNITE_WHY[u.why]
        : [t('Unite {k} × {k}', { k: u.k }), t('Unite these {n} cells into one large block', { n: u.k * u.k })];
  b.querySelector('.unite-label').textContent = label;
  b.title = why;
  b.setAttribute('aria-label', why);
  b.classList.toggle('off', 'why' in u);
  b.classList.toggle('lefty', right + 130 > cw); // no room for the label on the right
  b.style.left = cv.offsetLeft + right + 'px';
  b.style.top = cv.offsetTop + top + 'px';
  b.hidden = false;
}
// The back: one backing fabric at real scale, the quilting stitches showing
// through (mirrored left to right, as on a real quilt turned over) and the
// binding folded round the edge.
function drawBackCanvas(cw, ch, dpr) {
  const cv = $('dz-back');
  cv.style.width = cw + 'px';
  cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * dpr);
  cv.height = Math.floor(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pxPerCm = cw / (quiltMm(design).W / 10);
  g.fillStyle = fabricFill(g, fabricById(design.backFabric), pxPerCm, 7);
  g.fillRect(0, 0, cw, ch);
  // stitch-in-the-ditch lines, mirrored
  g.save();
  g.translate(cw, 0);
  g.scale(-1, 1);
  g.setLineDash([Math.max(2, cw / 260), Math.max(2, cw / 360)]);
  g.lineWidth = Math.max(0.8, cw / 900);
  g.strokeStyle = 'rgba(40,30,20,.45)';
  strokeSeams(g, cw, ch);
  if (quiltingOf(design) !== 'ditch') drawQuiltingLines(g, cw, ch, quiltingOf(design));
  g.setLineDash([]);
  g.restore();
  // soft loft shading between the stitches
  g.fillStyle = 'rgba(255,255,255,.04)';
  g.fillRect(0, 0, cw, ch);
  // binding wraps round to the back
  g.strokeStyle = '#2f466f';
  g.lineWidth = Math.max(4, cw * 0.009);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  $('dz-backname').textContent = fabricById(design.backFabric).name;
}
let flipped = false;
function turnQuilt() {
  resetZoom(); // the back turns over the whole quilt
  flipped = !flipped;
  const f = $('dz-flipper');
  f.classList.remove('lift');
  void f.offsetWidth;
  f.classList.add('lift'); // restart the lift animation
  f.classList.toggle('flipped', flipped);
  $('dz-flip').title = flipped ? t('Show the front of the quilt') : t('Turn over: show the back of the quilt');
  $('dz-flip').setAttribute('aria-label', flipped ? t('Show the front') : t('Turn over'));
  $('dz-flip').setAttribute('aria-pressed', String(flipped));
  $('dz-backbar').hidden = !flipped;
  $('dz-quilt').setAttribute('aria-hidden', String(flipped));
  $('dz-back').setAttribute('aria-hidden', String(!flipped));
  if (flipped) drawPaletteInto($('dz-backfabs'), design.backFabric);
}
const BLOCK_PX = 300;

export { BLOCK_PX, drawDesignerCanvas, flipped, panBy, resetZoom, turnQuilt, zoom, zoomAt };
