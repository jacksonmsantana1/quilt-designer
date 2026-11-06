// Quilt designer events: clicks, area selection, steppers and panel buttons.
import './edits.js'; // load order: runs after designer/edits
import {
  design,
  focusBlock,
  selBlocks,
  selParts,
  setFocusBlock,
  setMineCur,
  setSelBlocks,
  setSelParts,
  setToolsSnap,
} from '../core/store.js';
import {
  partTap,
  setHideTools,
  setPartTap,
  setShowTools,
  setShowToolsPanel,
  setToolsPanel,
  toolsPanel,
  mosaicBrush,
  mosaicTool,
  setMosaicBrush,
  setMosaicTool,
} from './ui-state.js';
import { $ } from '../core/dom.js';
import { fromInput, getUnit, len, roundLen, toInput } from '../core/units.js';
import { state } from '../sim/config.js';
import {
  anchorOf,
  blockAt,
  blockOutline,
  blockPlace,
  blockPolys,
  borderTotal,
  cellCount,
  convexOverlap,
  isOnPoint,
  nearestBlock,
  pointInPoly,
  quiltMm,
  sashRects,
  tileAtPx,
  turnedSelection,
  uniteOf,
} from '@quilt/shared/geometry.js';
import { BLOCK_PX, drawDesignerCanvas, flipped, panBy, turnQuilt, zoom, zoomAt } from './canvas.js';
import { drawPaletteInto, drawPartsEditor, renderDesigner } from './parts-editor.js';
import { copyBlockFrom, selectSameFabric } from './block-library.js';
import { PANEL_CARDS, openBlockEditor, placeBlockEditor, syncRail, updateMultiUI } from './side-panel.js';
import { applyFabric, choosePattern } from './edits.js';
import { openSashing } from './sashing-ui.js';
import { openBorders } from './borders-ui.js';
import { tl, tlCommit, tlEnsure, tlKeyFor } from '../timeline/timeline.js';
import { setSession, timelines } from '../storage/repo.js';
import { setFold } from '../ui/folds.js';
import { dispatch, replaceDesign, resizeTo } from './dispatch.js';
import {
  copyBlock,
  rotateBlocks,
  setBackFabric,
  setBlockMm,
  setBlockSpan,
  setSetting,
  setSettingFabric,
  paintEach,
  paintTiles,
  setMosaic,
  setMosaicMm,
  setMosaicShape,
} from '../core/edits.js';
import { notify } from '../ui/notice.js';
import { newDesign } from '@quilt/shared/design.js';
import { tilesForTool } from '@quilt/shared/mosaic.js';
import { comma, t, tn } from '@quilt/shared/i18n.js';

function initDesignerUI() {
  // ---- area selection: drag a dotted rectangle; every block it touches is selected
  const qcv = $('dz-quilt'),
    mq = $('dz-marquee');
  // on point the box is turned, so its size shows on a tag of its own (upright), beside it
  const mqTag = document.createElement('div');
  mqTag.className = 'marquee-tag';
  mqTag.hidden = true;
  mq.after(mqTag);
  let marquee = null,
    suppressClick = false,
    mqFrame = 0;
  const blocksIn = (x0, y0, x1, y1) => {
    const r = qcv.getBoundingClientRect(),
      out = new Set();
    const L = Math.min(x0, x1),
      R2 = Math.max(x0, x1),
      T = Math.min(y0, y1),
      B2 = Math.max(y0, y1);
    const box = [
      [L, T],
      [R2, T],
      [R2, B2],
      [L, B2],
    ];
    const onPoint = isOnPoint(design);
    if (onPoint) {
      // on point the selection turns with the blocks: from the diamond where the drag began to the one under
      // the mouse (or the nearest ones), every whole diamond between them in the turned grid
      const a = nearestBlock(design, x0, y0, r.width, r.height),
        b = nearestBlock(design, x1, y1, r.width, r.height);
      return new Set(turnedSelection(design, a, b, r.width, r.height).blocks);
    }
    for (let i = 0, n = cellCount(design); i < n; i++) {
      const P = blockPlace(design, i, r.width, r.height),
        cx = P.x + P.w / 2,
        cy = P.y + P.h / 2;
      // straight: every block the rectangle touches. On point, every diamond whose middle it holds: any upright
      // rectangle round a diamond of diamonds also touches the ones beside it, so touching would never fit
      if (onPoint ? cx > L && cx < R2 && cy > T && cy < B2 : convexOverlap(box, blockOutline(P)))
        out.add(anchorOf(design, i));
    }
    return out;
  };
  // ---- zoom with the mouse wheel over the quilt (at the mouse); drag with the wheel pressed to move it. All the way
  // out, the wheel scrolls the page as usual
  qcv.addEventListener(
    'wheel',
    e => {
      if (flipped || !design || e.ctrlKey) return; // (ctrl + wheel: the browser's own zoom)
      const r = qcv.parentElement.getBoundingClientRect(),
        dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const zoomed = zoomAt(Math.exp(-dy * 0.0015), e.clientX - r.left, e.clientY - r.top);
      // keep the page still while zooming, and at full zoom when zooming in further
      if (zoomed || (dy < 0 && zoom.z > 1)) e.preventDefault();
    },
    { passive: false },
  );
  let pan = null;
  qcv.addEventListener('pointerdown', e => {
    if (e.button !== 1 || flipped) return;
    e.preventDefault(); // no autoscroll
    if (zoom.z <= 1) return;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      qcv.setPointerCapture(e.pointerId);
    } catch (err) {}
    qcv.parentElement.classList.add('panning');
  });
  qcv.addEventListener('mousedown', e => {
    if (e.button === 1) e.preventDefault(); // (some browsers start autoscroll on the mouse event)
  });
  qcv.addEventListener('pointermove', e => {
    if (!pan || e.pointerId !== pan.id) return;
    panBy(e.clientX - pan.x, e.clientY - pan.y);
    pan.x = e.clientX;
    pan.y = e.clientY;
  });
  const endPan = e => {
    if (!pan || e.pointerId !== pan.id) return;
    pan = null;
    qcv.parentElement.classList.remove('panning');
  };
  qcv.addEventListener('pointerup', endPan);
  qcv.addEventListener('pointercancel', endPan);

  // ---- a mosaic: click a shape to paint it, or drag over several (one undo step: painting merges)
  let painting = null;
  // Random: a fabric from the list in the Mosaic panel (the palette); otherwise the chosen fabric, over the shapes
  // the tool reaches from each one (a rosette, a row)
  const paletteIds = () =>
    [...$('mos-fabs').querySelectorAll('button.fab[data-f]')].filter(b => !b.hidden).map(b => b.dataset.f);
  const paintWithTool = ids => {
    if (mosaicTool === 'random') {
      const pal = paletteIds();
      if (!pal.length) return;
      dispatch(
        paintEach,
        ids.map(i => [i, pal[Math.floor(Math.random() * pal.length)]]),
      );
    } else
      dispatch(
        paintTiles,
        ids.flatMap(i => tilesForTool(design.mosaic, i, mosaicTool)),
        mosaicBrush,
      );
  };
  const paintAt = e => {
    const r = qcv.getBoundingClientRect(),
      i = tileAtPx(design, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (i >= 0 && i !== painting.last) {
      painting.last = i;
      paintWithTool([i]);
    }
    return i;
  };
  qcv.addEventListener('pointerdown', e => {
    if (!design || !design.mosaic || flipped || e.button !== 0) return;
    painting = { id: e.pointerId, last: -1 };
    if (paintAt(e) < 0)
      painting = null; // a border: its click opens its settings
    else if (e.pointerType !== 'touch')
      try {
        qcv.setPointerCapture(e.pointerId); // keep painting when the mouse runs past the edge
      } catch (err) {}
  });
  qcv.addEventListener('pointermove', e => {
    if (painting && e.pointerId === painting.id && e.pointerType !== 'touch') paintAt(e);
  });
  const stopPainting = e => {
    if (painting && e.pointerId === painting.id) painting = null;
  };
  qcv.addEventListener('pointerup', stopPainting);
  qcv.addEventListener('pointercancel', stopPainting);
  qcv.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (flipped || e.button !== 0 || !design || design.mosaic) return;
    if (e.pointerType === 'touch') return; // on phones a drag scrolls the page
    const r = qcv.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    marquee = {
      id: e.pointerId,
      x0: x,
      y0: y,
      x1: x,
      y1: y,
      active: false,
      base: e.shiftKey || e.ctrlKey || e.metaKey ? new Set(selBlocks) : new Set(),
    };
  });
  qcv.addEventListener('pointermove', e => {
    if (!marquee || e.pointerId !== marquee.id) return;
    const r = qcv.getBoundingClientRect();
    marquee.x1 = Math.max(0, Math.min(r.width, e.clientX - r.left));
    marquee.y1 = Math.max(0, Math.min(r.height, e.clientY - r.top));
    if (!marquee.active && Math.hypot(marquee.x1 - marquee.x0, marquee.y1 - marquee.y0) > 6) {
      marquee.active = true;
      qcv.setPointerCapture(e.pointerId);
      mq.hidden = false;
    }
    if (!marquee.active) return;
    e.preventDefault();
    const { x0, y0, x1, y1 } = marquee;
    if (isOnPoint(design)) {
      // the box turns with the blocks and wraps whole diamonds; its size sits upright at its right corner
      const turned = turnedSelection(
        design,
        nearestBlock(design, x0, y0, r.width, r.height),
        nearestBlock(design, x1, y1, r.width, r.height),
        r.width,
        r.height,
      );
      Object.assign(mq.style, {
        left: turned.box.x + 'px',
        top: turned.box.y + 'px',
        width: turned.box.w + 'px',
        height: turned.box.h + 'px',
        transform: 'rotate(45deg)',
      });
      mq.dataset.count = '';
      const right = blockOutline(turned.box).reduce((m, pt) => (pt[0] > m[0] ? pt : m));
      mqTag.textContent = tn(turned.cols * turned.rows, '{cols} × {rows} block', '{cols} × {rows} blocks', {
        cols: turned.cols,
        rows: turned.rows,
      });
      Object.assign(mqTag.style, { left: right[0] + 8 + 'px', top: right[1] - 11 + 'px' });
      mqTag.hidden = false;
    } else {
      Object.assign(mq.style, {
        left: Math.min(x0, x1) + 'px',
        top: Math.min(y0, y1) + 'px',
        width: Math.abs(x1 - x0) + 'px',
        height: Math.abs(y1 - y0) + 'px',
        transform: '',
      });
      const inside = blocksIn(x0, y0, x1, y1);
      mq.dataset.count = tn(inside.size, '{n} block', '{n} blocks');
    }
    if (!mqFrame)
      mqFrame = requestAnimationFrame(() => {
        // live highlight, at most once per frame
        mqFrame = 0;
        if (!marquee) return;
        setSelBlocks(new Set([...marquee.base, ...blocksIn(marquee.x0, marquee.y0, marquee.x1, marquee.y1)]));
        drawDesignerCanvas();
      });
  });
  const endMarquee = (e, cancel) => {
    if (!marquee || e.pointerId !== marquee.id) return;
    const m0 = marquee;
    marquee = null;
    mq.hidden = true;
    mqTag.hidden = true;
    if (!m0.active) return; // a plain click: the click handler opens the block
    suppressClick = true;
    if (cancel) {
      setSelBlocks(m0.base.size ? m0.base : new Set([focusBlock]));
      drawDesignerCanvas();
      return;
    }
    const inside = blocksIn(m0.x0, m0.y0, m0.x1, m0.y1);
    setSelBlocks(new Set([...m0.base, ...inside]));
    if (!selBlocks.size) setSelBlocks(new Set([focusBlock]));
    setFocusBlock(inside.size ? Math.min(...inside) : [...selBlocks][0]);
    selParts.clear();
    renderDesigner();
    updateMultiUI();
    openBlockEditor();
  };
  qcv.addEventListener('pointerup', e => endMarquee(e, false));
  qcv.addEventListener('pointercancel', e => endMarquee(e, true));
  qcv.addEventListener(
    'click',
    e => {
      if (flipped) return;
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  $('dz-quilt').addEventListener('click', e => {
    if (flipped || e.defaultPrevented) return;
    const r = e.currentTarget.getBoundingClientRect();
    const bi = blockAt(design, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (design.mosaic && tileAtPx(design, e.clientX - r.left, e.clientY - r.top, r.width, r.height) >= 0) return; // painted
    if (bi < 0) {
      // a click on a border or the sashing opens its settings
      const q = quiltMm(design),
        bt = borderTotal(design),
        mx = ((e.clientX - r.left) / r.width) * q.W,
        my = ((e.clientY - r.top) / r.height) * q.H;
      if (bt && (mx < bt || my < bt || mx > q.W - bt || my > q.H - bt)) openBorders();
      else if (
        sashRects(design, r.width, r.height).some(rc =>
          pointInPoly(e.clientX - r.left, e.clientY - r.top, blockOutline(rc)),
        )
      )
        openSashing();
      else if (isOnPoint(design)) showPanel('set'); // a setting triangle
      return;
    }
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const prevPattern = design.blocks[focusBlock].pattern;
    if (multi) {
      if (selBlocks.has(bi) && selBlocks.size > 1) selBlocks.delete(bi);
      else selBlocks.add(bi);
    } else if (!selBlocks.has(bi) || selBlocks.size <= 1) setSelBlocks(new Set([bi]));
    setFocusBlock(selBlocks.has(bi) ? bi : [...selBlocks][0]);
    if (design.blocks[focusBlock].pattern !== prevPattern || !multi) selParts.clear();
    renderDesigner();
    if (!multi) openBlockEditor();
    updateMultiUI();
  });
  $('dz-block').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * BLOCK_PX,
      y = ((e.clientY - r.top) / r.height) * BLOCK_PX;
    const polys = blockPolys(design.blocks[focusBlock], 0, 0, BLOCK_PX, BLOCK_PX);
    const hit = polys.findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    const now = performance.now(),
      last = partTap;
    setPartTap({ t: now, hit });
    if (last && last.hit === hit && now - last.t < 380) {
      selectSameFabric(hit);
      setPartTap(null);
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      selParts.has(hit) ? selParts.delete(hit) : selParts.add(hit);
    } else if (selParts.size === 1 && selParts.has(hit)) selParts.clear();
    else setSelParts(new Set([hit]));
    drawPartsEditor();
  });
  // double-click a part: select every part cut from the same fabric
  $('dz-block').addEventListener('dblclick', e => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * BLOCK_PX,
      y = ((e.clientY - r.top) / r.height) * BLOCK_PX;
    const b = design.blocks[focusBlock],
      hit = blockPolys(b, 0, 0, BLOCK_PX, BLOCK_PX).findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    selectSameFabric(hit);
  });
  $('dz-allblocks').addEventListener('click', () => {
    setSelBlocks(new Set(design.blocks.map((_, i) => i)));
    drawDesignerCanvas();
    drawPartsEditor();
    updateMultiUI();
  });
  $('dz-sameblocks').addEventListener('click', () => {
    const p = design.blocks[focusBlock].pattern;
    setSelBlocks(new Set(design.blocks.map((b, i) => (b.pattern === p ? i : -1)).filter(i => i >= 0)));
    drawDesignerCanvas();
    drawPartsEditor();
  });
  $('dz-patterns').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) choosePattern(b.dataset.p);
  });
  const rotate = () => dispatch(rotateBlocks, selBlocks);
  $('dz-rot').addEventListener('click', rotate);
  $('dz-fabrics2').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) applyFabric(b.dataset.f);
  });
  $('dz-library').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) copyBlockFrom(+b.dataset.src);
  });
  const dlg = $('dz-dialog');
  $('dz-close').addEventListener('click', () => dlg.close());
  $('dz-done').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => {
    // a click on the backdrop, outside the box, closes it
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  dlg.addEventListener('close', () => {
    if (selBlocks.size > 1) {
      setSelBlocks(new Set([focusBlock]));
    }
    selParts.clear();
    drawDesignerCanvas();
    updateMultiUI();
  });
  // side panel: hidden until asked for
  let toolsOpen = false;
  try {
    toolsOpen = localStorage.getItem('quilt-designer.tools') === '1';
  } catch (e) {}
  const setTools = open => {
    // remember the quilt as it was when the panel opened, so "cancel" can bring it back
    if (open && !toolsOpen && design) {
      tlEnsure();
      tlCommit();
      setToolsSnap({ d: JSON.stringify(design), i: tl.i, key: tl.key });
    }
    toolsOpen = open;
    $('dz-side').hidden = !open;
    $('dz').classList.toggle('tools-open', open);
    placeBlockEditor(open);
    if (!open) setToolsPanel(null);
    syncRail();
    if (design) {
      drawDesignerCanvas();
      drawPartsEditor();
    }
  };
  // round buttons beside the quilt: each opens the side panel with its own card; the active one closes it
  const showPanel = name => {
    setToolsPanel(name);
    for (const [n, id] of Object.entries(PANEL_CARDS)) {
      const c = $(id);
      c.hidden = n !== name;
      if (n === name && c.classList.contains('folded'))
        setFold(c, n === 'parts' ? 'dz:block parts' : n === 'sash' ? 'dz:sashing' : 'dz:borders', false);
    }
    if (!toolsOpen) setTools(true);
    else syncRail();
    $('dz-side').scrollTop = 0;
  };
  for (const [n] of Object.entries(PANEL_CARDS))
    $('rail-' + n)?.addEventListener('click', () => (toolsOpen && toolsPanel === n ? setTools(false) : showPanel(n)));
  // Unite: the selected square of blocks becomes one large block (the top-left one's pattern and fabrics); when
  // the selection is not a square, the button says why instead
  $('dz-unite').addEventListener('click', e => {
    e.stopPropagation();
    const u = uniteOf(design, selBlocks);
    if ('why' in u) {
      notify($('dz-unite').title);
      return;
    }
    setSelBlocks(new Set([u.i]));
    setFocusBlock(u.i);
    selParts.clear();
    dispatch(setBlockSpan, u.i, u.k);
    openBlockEditor();
  });
  // layout: straight, or on point (blocks turned 45°); the setting triangles' fabric has its own card
  $('dz-setting').addEventListener('change', e => {
    const v = e.target.value;
    // a mosaic: the blocks stay underneath; going back to blocks shows them again, straight or on point
    if (v === 'mosaic') {
      dispatch(setMosaic, true);
      showPanel('mosaic');
      return;
    }
    if (design.mosaic) {
      dispatch(setMosaic, false);
      if (toolsOpen && toolsPanel === 'mosaic') setTools(false);
    }
    dispatch(setSetting, v === 'onpoint');
    if (toolsOpen && toolsPanel === 'set' && !isOnPoint(design)) setTools(false);
  });
  $('mos-fabs').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (!b) return;
    setMosaicBrush(b.dataset.f);
    drawPaletteInto($('mos-fabs'), mosaicBrush);
  });
  $('mos-tools').addEventListener('click', e => {
    const b = e.target.closest('button[data-tool]');
    if (!b) return;
    setMosaicTool(b.dataset.tool);
    for (const tool of $('mos-tools').querySelectorAll('button')) tool.setAttribute('aria-pressed', String(tool === b));
  });
  $('mos-fill').addEventListener('click', () => {
    if (!design.mosaic) return;
    const all = design.mosaic.fabrics.map((_, i) => i);
    if (mosaicTool === 'random') paintWithTool(all);
    else dispatch(paintTiles, all, mosaicBrush);
  });
  $('mos-shape').addEventListener('change', e => dispatch(setMosaicShape, e.target.value));
  $('mos-mm').addEventListener('change', e => {
    const v = fromInput(+e.target.value);
    if (v >= 10 && v <= 200) dispatch(setMosaicMm, v);
    else e.target.value = String(toInput(design.mosaic ? design.mosaic.mm : 50));
  });
  $('set-fabs').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (b) dispatch(setSettingFabric, b.dataset.f);
  });
  setShowTools(() => {
    if (!toolsOpen || toolsPanel !== 'parts') showPanel('parts');
  });
  setShowToolsPanel(showPanel);
  setHideTools(() => {
    if (toolsOpen) setTools(false);
  });
  $('dz-flip').addEventListener('click', turnQuilt);
  $('dz-backfabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    dispatch(setBackFabric, b.dataset.f);
    drawPaletteInto($('dz-backfabs'), design.backFabric);
  });
  setTools(false); // the side panel starts closed
  $('dz-copy').addEventListener('click', () => {
    const src = design.blocks[focusBlock];
    dispatch(
      copyBlock,
      src,
      [...selBlocks].filter(bi => bi !== focusBlock),
    );
  });
  const sizeChange = () => resizeTo(+$('dz-cols').value, +$('dz-rows').value);
  const blockSize = e => {
    const box = e.target;
    let v = fromInput(+box.value);
    // a size typed in centimetres (25 for a 25 cm block) is read as such, and said so
    if (getUnit() === 'mm' && v > 0 && v < 50 && v * 10 >= 50 && v * 10 <= 1000) {
      v *= 10;
      notify(t('{cm} cm is {mm} mm: the sizes here are in millimetres.', { cm: comma(v / 10), mm: v }));
    }
    if (!(v >= 50 && v <= 1000)) {
      // refused out loud, and ready for the next try: the old number back, selected
      notify(t('A block can be from {min} to {max}.', { min: len(50), max: len(1000) }));
      box.value = String(toInput(design.blockMm));
      box.select();
      return;
    }
    dispatch(setBlockMm, v);
    box.value = String(toInput(v)); // the box shows what was used (250 after "25 cm"), not what was typed
  };
  for (const id of ['dz-bmm3']) $(id).addEventListener('change', blockSize);
  $('dz-cols').addEventListener('change', sizeChange);
  $('dz-rows').addEventListener('change', sizeChange);
  for (const b of document.querySelectorAll('[data-step]'))
    b.addEventListener('click', () => {
      const [which, d] = b.dataset.step.split(':'),
        g = design.mosaic || design; // a mosaic: shapes across and down
      resizeTo(g.cols + (which === 'c' ? +d : 0), g.rows + (which === 'r' ? +d : 0));
    });
  // of the blocks chosen, every other one (a chessboard), the one being edited among them: a second block can then be
  // copied into half the quilt at once
  // clicked again on the half it chose: the other half, for the second block
  let altFrom = /** @type {{ all: Set<number>, kept: Set<number> } | null} */ (null);
  $('dz-alternate').addEventListener('click', () => {
    const same = (/** @type {Set<number>} */ a, /** @type {Set<number>} */ b) =>
      a.size === b.size && [...a].every(i => b.has(i));
    if (altFrom && same(selBlocks, altFrom.kept)) {
      const from = altFrom;
      const other = new Set([...from.all].filter(i => !from.kept.has(i) && design.blocks[i]?.under == null));
      if (!other.size) return;
      altFrom = { all: from.all, kept: other };
      setFocusBlock([...other][0]);
      setSelBlocks(other);
      renderDesigner();
      notify(t('Now the other half is chosen. Click a block pattern, or a block of your quilt, to put it in them.'));
      return;
    }
    const at = i => Math.floor(i / design.cols) + (i % design.cols);
    const keep = new Set(
      [...selBlocks].filter(i => at(i) % 2 === at(focusBlock) % 2 && design.blocks[i]?.under == null),
    );
    if (keep.size === selBlocks.size || !keep.size) return;
    altFrom = { all: new Set(selBlocks), kept: keep };
    setSelBlocks(keep);
    renderDesigner();
    notify(
      t(
        'Every other block is chosen. Now click a block pattern, or a block of your quilt, to put it in them. Click the button again for the other half.',
      ),
    );
  });
  $('dz-reset').addEventListener('click', () => {
    if ($('dz-reset').dataset.armed !== '1') {
      $('dz-reset').dataset.armed = '1';
      $('dz-reset').textContent = t('Click again to start over');
      setTimeout(() => {
        $('dz-reset').dataset.armed = '';
        $('dz-reset').textContent = t('Start over');
      }, 3000);
      return;
    }
    setMineCur(null);
    setSession('mineCur', undefined);
    timelines.remove(tlKeyFor(null));
    replaceDesign({ ...newDesign(), blockMm: roundLen(300) }, { timeline: null });
    $('dz-reset').dataset.armed = '';
    $('dz-reset').textContent = t('Start over');
  });
  new ResizeObserver(() => {
    if (state.page === 'design') drawDesignerCanvas();
  }).observe($('dz-quilt').closest('.dz-quiltwrap'));
}

export { initDesignerUI };
