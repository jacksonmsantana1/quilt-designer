// Drawing the quilt in the designer (front and back) and turning it over.
import '../render/quilt-draw.js'; // load order: runs after render/quilt-draw
import { design, focusBlock, selBlocks } from '../core/store.js';
import { $ } from '../core/dom.js';
import { fabricById } from './fabric-library.js';
import { blockRect, borderTotal, bordersOf, quiltMm, sashOf } from '../core/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { drawPaletteInto } from './parts-editor.js';
import { editorInSide } from './side-panel.js';
import { drawQuiltingLines, quiltingOf, strokeSeams } from '../render/quilting.js';
import { drawHover } from './hover.js';
import { fabricFill } from '../render/fabric-fill.js';
import { symOf } from '../core/symmetry.js';

function drawDesignerCanvas() {
  if (!design) return;
  const cv = $('dz-quilt'),
    box = cv.closest('.dz-quiltwrap').getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
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
  const ch = Math.round(cw * ar);
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
  const editing = $('dz-dialog').open || $('dz-partdlg').open || editorInSide || selBlocks.size > 1;
  if (editing)
    for (const bi of selBlocks) {
      const R = blockRect(design, bi % design.cols, Math.floor(bi / design.cols), cw, ch);
      g.lineWidth = 3;
      g.strokeStyle = '#ffffff';
      g.strokeRect(R.x + 1.5, R.y + 1.5, R.w - 3, R.h - 3);
      g.lineWidth = 1.5;
      g.strokeStyle = bi === focusBlock ? '#e0592a' : '#1b2233';
      g.setLineDash(bi === focusBlock ? [] : [5, 4]);
      g.strokeRect(R.x + 1.5, R.y + 1.5, R.w - 3, R.h - 3);
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
        [2, '#e0592a'],
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
  $('dz-size-b').textContent =
    `${sz.mm ? ` · ${sz.mm} mm sashing${sz.border ? ' with border' : ''}` : ''}${nb ? ` · ${nb} border${nb > 1 ? 's' : ''} (${borderTotal(design)} mm)` : ''} · finished quilt ${qmm.W} × ${qmm.H} mm`;
  drawBackCanvas(cw, ch, dpr);
  const hv = $('dz-hover');
  hv.style.width = cw + 'px';
  hv.style.height = ch + 'px';
  hv.width = Math.floor(cw * dpr);
  hv.height = Math.floor(ch * dpr);
  drawHover();
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
  flipped = !flipped;
  const f = $('dz-flipper');
  f.classList.remove('lift');
  void f.offsetWidth;
  f.classList.add('lift'); // restart the lift animation
  f.classList.toggle('flipped', flipped);
  $('dz-flip').title = flipped ? 'Show the front of the quilt' : 'Turn over: show the back of the quilt';
  $('dz-flip').setAttribute('aria-label', flipped ? 'Show the front' : 'Turn over');
  $('dz-flip').setAttribute('aria-pressed', String(flipped));
  $('dz-backbar').hidden = !flipped;
  $('dz-quilt').setAttribute('aria-hidden', String(flipped));
  $('dz-back').setAttribute('aria-hidden', String(!flipped));
  if (flipped) drawPaletteInto($('dz-backfabs'), design.backFabric);
}
const BLOCK_PX = 300;

export { BLOCK_PX, drawDesignerCanvas, flipped, turnQuilt };
