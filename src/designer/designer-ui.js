// Quilt designer events: clicks, area selection, steppers and panel buttons.
import './edits.js'; // load order: runs after designer/edits
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { loadImage } from '../sim/textures.js';
import { partsOf } from '../core/patterns.js';
import { fabricLib } from './fabric-library.js';
import {
  anchorOf,
  blockAt,
  blockPolys,
  blockRect,
  borderTotal,
  pointInPoly,
  quiltMm,
  sashOf,
} from '../core/geometry.js';
import { BLOCK_PX, drawDesignerCanvas, flipped, turnQuilt } from './canvas.js';
import { drawFabricPalette, drawPaletteInto, drawPartsEditor, renderDesigner } from './parts-editor.js';
import { copyBlockFrom, selectSameFabric } from './block-library.js';
import { PANEL_CARDS, openBlockEditor, placeBlockEditor, syncRail, updateMultiUI } from './side-panel.js';
import { applyFabric } from './edits.js';
import { openSashing } from './sashing-ui.js';
import { openBorders } from './borders-ui.js';
import { tl, tlCommit, tlEnsure, tlKeyFor, tlSwitch } from '../timeline/timeline.js';
import { setFold } from '../ui/folds.js';
import { dispatch, replaceDesign, resizeTo } from './dispatch.js';
import { copyBlock, rotateBlocks, setBackFabric, setBlockMm } from '../core/edits.js';
import { defaultDesign } from '../core/design.js';
import { choosePattern } from './edits.js';

function initDesignerUI() {
  // ---- area selection: drag a dotted rectangle; every block it touches is selected
  const qcv = $('dz-quilt'),
    mq = $('dz-marquee');
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
    for (let rr = 0; rr < shared.design.rows; rr++)
      for (let cc = 0; cc < shared.design.cols; cc++) {
        const b = blockRect(shared.design, cc, rr, r.width, r.height); // every block the rectangle touches
        if (b.x < R2 && b.x + b.w > L && b.y < B2 && b.y + b.h > T)
          out.add(anchorOf(shared.design, rr * shared.design.cols + cc));
      }
    return out;
  };
  qcv.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (flipped || e.button !== 0 || !shared.design) return;
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
      base: e.shiftKey || e.ctrlKey || e.metaKey ? new Set(shared.selBlocks) : new Set(),
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
    Object.assign(mq.style, {
      left: Math.min(x0, x1) + 'px',
      top: Math.min(y0, y1) + 'px',
      width: Math.abs(x1 - x0) + 'px',
      height: Math.abs(y1 - y0) + 'px',
    });
    const inside = blocksIn(x0, y0, x1, y1);
    mq.dataset.count = `${inside.size} block${inside.size === 1 ? '' : 's'}`;
    if (!mqFrame)
      mqFrame = requestAnimationFrame(() => {
        // live highlight, at most once per frame
        mqFrame = 0;
        if (!marquee) return;
        shared.selBlocks = new Set([...marquee.base, ...blocksIn(marquee.x0, marquee.y0, marquee.x1, marquee.y1)]);
        drawDesignerCanvas();
      });
  });
  const endMarquee = (e, cancel) => {
    if (!marquee || e.pointerId !== marquee.id) return;
    const m0 = marquee;
    marquee = null;
    mq.hidden = true;
    if (!m0.active) return; // a plain click: the click handler opens the block
    suppressClick = true;
    if (cancel) {
      shared.selBlocks = m0.base.size ? m0.base : new Set([shared.focusBlock]);
      drawDesignerCanvas();
      return;
    }
    const inside = blocksIn(m0.x0, m0.y0, m0.x1, m0.y1);
    shared.selBlocks = new Set([...m0.base, ...inside]);
    if (!shared.selBlocks.size) shared.selBlocks = new Set([shared.focusBlock]);
    shared.focusBlock = inside.size ? Math.min(...inside) : [...shared.selBlocks][0];
    shared.selParts.clear();
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
    const bi = blockAt(shared.design, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (bi < 0) {
      // a click on a border or the sashing opens its settings
      const q = quiltMm(shared.design),
        bt = borderTotal(shared.design),
        mx = ((e.clientX - r.left) / r.width) * q.W,
        my = ((e.clientY - r.top) / r.height) * q.H;
      if (bt && (mx < bt || my < bt || mx > q.W - bt || my > q.H - bt)) openBorders();
      else if (sashOf(shared.design).mm) openSashing();
      return;
    }
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const prevPattern = shared.design.blocks[shared.focusBlock].pattern;
    if (multi) {
      if (shared.selBlocks.has(bi) && shared.selBlocks.size > 1) shared.selBlocks.delete(bi);
      else shared.selBlocks.add(bi);
    } else if (!shared.selBlocks.has(bi) || shared.selBlocks.size <= 1) shared.selBlocks = new Set([bi]);
    shared.focusBlock = shared.selBlocks.has(bi) ? bi : [...shared.selBlocks][0];
    if (shared.design.blocks[shared.focusBlock].pattern !== prevPattern || !multi) shared.selParts.clear();
    renderDesigner();
    if (!multi) openBlockEditor();
    updateMultiUI();
  });
  $('dz-block').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * BLOCK_PX,
      y = ((e.clientY - r.top) / r.height) * BLOCK_PX;
    const polys = blockPolys(shared.design.blocks[shared.focusBlock], 0, 0, BLOCK_PX, BLOCK_PX);
    const hit = polys.findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    const now = performance.now(),
      last = shared.partTap;
    shared.partTap = { t: now, hit };
    if (last && last.hit === hit && now - last.t < 380) {
      selectSameFabric(hit);
      shared.partTap = null;
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      shared.selParts.has(hit) ? shared.selParts.delete(hit) : shared.selParts.add(hit);
    } else if (shared.selParts.size === 1 && shared.selParts.has(hit)) shared.selParts.clear();
    else shared.selParts = new Set([hit]);
    drawPartsEditor();
  });
  // double-click a part: select every part cut from the same fabric
  $('dz-block').addEventListener('dblclick', e => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * BLOCK_PX,
      y = ((e.clientY - r.top) / r.height) * BLOCK_PX;
    const b = shared.design.blocks[shared.focusBlock],
      hit = blockPolys(b, 0, 0, BLOCK_PX, BLOCK_PX).findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    selectSameFabric(hit);
  });
  $('dz-allparts').addEventListener('click', () => {
    shared.selParts = new Set(partsOf(shared.design.blocks[shared.focusBlock].pattern).map((_, i) => i));
    drawPartsEditor();
  });
  $('dz-sameparts').addEventListener('click', () => {
    const b = shared.design.blocks[shared.focusBlock],
      ref = shared.selParts.size ? b.fabrics[[...shared.selParts][0]] : null;
    if (ref === null) {
      $('dz-parts-info').textContent = 'Select one part first; this then selects every part with the same fabric.';
      return;
    }
    shared.selParts = new Set(b.fabrics.map((f, i) => (f === ref ? i : -1)).filter(i => i >= 0));
    drawPartsEditor();
  });
  $('dz-noparts').addEventListener('click', () => {
    shared.selParts.clear();
    drawPartsEditor();
  });
  $('dz-allblocks').addEventListener('click', () => {
    shared.selBlocks = new Set(shared.design.blocks.map((_, i) => i));
    drawDesignerCanvas();
    drawPartsEditor();
    updateMultiUI();
  });
  $('dz-sameblocks').addEventListener('click', () => {
    const p = shared.design.blocks[shared.focusBlock].pattern;
    shared.selBlocks = new Set(shared.design.blocks.map((b, i) => (b.pattern === p ? i : -1)).filter(i => i >= 0));
    drawDesignerCanvas();
    drawPartsEditor();
  });
  $('dz-patterns').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) choosePattern(b.dataset.p);
  });
  const rotate = () => dispatch(rotateBlocks, shared.selBlocks);
  $('dz-rot').addEventListener('click', rotate);
  $('dz-rot2').addEventListener('click', rotate);
  $('dz-patsel').addEventListener('change', e => choosePattern(e.target.value));
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
    if (shared.selBlocks.size > 1) {
      shared.selBlocks = new Set([shared.focusBlock]);
    }
    shared.selParts.clear();
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
    if (open && !toolsOpen && shared.design) {
      tlEnsure();
      tlCommit();
      shared.toolsSnap = { d: JSON.stringify(shared.design), i: tl.i, key: tl.key };
    }
    toolsOpen = open;
    $('dz-side').hidden = !open;
    $('dz').classList.toggle('tools-open', open);
    placeBlockEditor(open);
    if (!open) shared.toolsPanel = null;
    syncRail();
    if (shared.design) {
      drawDesignerCanvas();
      drawPartsEditor();
    }
  };
  // round buttons beside the quilt: each opens the side panel with its own card; the active one closes it
  const showPanel = name => {
    shared.toolsPanel = name;
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
    $('rail-' + n).addEventListener('click', () =>
      toolsOpen && shared.toolsPanel === n ? setTools(false) : showPanel(n),
    );
  shared.showTools = () => {
    if (!toolsOpen || shared.toolsPanel !== 'parts') showPanel('parts');
  };
  shared.showToolsPanel = showPanel;
  shared.hideTools = () => {
    if (toolsOpen) setTools(false);
  };
  $('dz-flip').addEventListener('click', turnQuilt);
  $('dz-backfabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    dispatch(setBackFabric, b.dataset.f);
    drawPaletteInto($('dz-backfabs'), shared.design.backFabric);
  });
  setTools(false); // the side panel starts closed
  $('dz-copy').addEventListener('click', () => {
    const src = shared.design.blocks[shared.focusBlock];
    dispatch(
      copyBlock,
      src,
      [...shared.selBlocks].filter(bi => bi !== shared.focusBlock),
    );
  });
  const sizeChange = () => resizeTo(+$('dz-cols').value, +$('dz-rows').value);
  const blockSize = e => {
    const v = Math.round(+e.target.value);
    if (!(v >= 50 && v <= 1000)) {
      e.target.value = shared.design.blockMm;
      return;
    }
    dispatch(setBlockMm, v);
  };
  for (const id of ['dz-bmm3']) $(id).addEventListener('change', blockSize);
  $('dz-cols').addEventListener('change', sizeChange);
  $('dz-rows').addEventListener('change', sizeChange);
  for (const b of document.querySelectorAll('[data-step]'))
    b.addEventListener('click', () => {
      const [which, d] = b.dataset.step.split(':');
      resizeTo(shared.design.cols + (which === 'c' ? +d : 0), shared.design.rows + (which === 'r' ? +d : 0));
    });
  $('dz-reset').addEventListener('click', () => {
    if ($('dz-reset').dataset.armed !== '1') {
      $('dz-reset').dataset.armed = '1';
      $('dz-reset').textContent = 'Click again to start over';
      setTimeout(() => {
        $('dz-reset').dataset.armed = '';
        $('dz-reset').textContent = 'Start over';
      }, 3000);
      return;
    }
    shared.mineCur = null;
    try {
      localStorage.removeItem('quilt-mydesigns-current.v1');
      localStorage.removeItem(tlKeyFor(null));
    } catch (e) {}
    tlSwitch(null);
    replaceDesign(defaultDesign());
    $('dz-reset').dataset.armed = '';
    $('dz-reset').textContent = 'Start over';
  });
  $('dz-upload').addEventListener('change', async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    for (const f of files) {
      const im = await loadImage(URL.createObjectURL(f));
      const c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      fabricLib.push({
        id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: f.name.replace(/\.[^.]+$/, ''),
        canvas: c,
        cm: +$('dz-cm').value,
      });
    }
    e.target.value = '';
    drawFabricPalette();
    $('dz-fabnote').textContent =
      `${files.length} photo${files.length === 1 ? '' : 's'} added. Your photos are kept only until you reload the page.`;
  });
  const cmOut2 = () => {
    $('dz-cm-o').textContent = $('dz-cm').value + ' cm';
  };
  $('dz-cm').addEventListener('input', cmOut2);
  cmOut2();
  new ResizeObserver(() => {
    if (state.page === 'design') drawDesignerCanvas();
  }).observe($('dz-quilt').closest('.dz-quiltwrap'));
}

export { initDesignerUI };
