// The block editor: draw your own block on a grid of cells (squares, half-square triangles, hourglasses, flying
// geese, joined cells), with mirror or turn symmetry, a 2 × 2 preview and its cutting list. The drawing is kept in
// the quilt (design.drawn, see @quilt/shared/drawn-blocks.js), so it travels with the quilt and shows under
// "My blocks" in the block library. The drawing itself is core/cell-drawing.js.
import '../cutting/page.js'; // load order: runs after cutting/page
import { design, focusBlock, readOnly, selBlocks, selParts } from '../core/store.js';
import { $, themeColour } from '../core/dom.js';
import { setOpenBlockDrawer } from './ui-state.js';
import { dispatch } from './dispatch.js';
import { keepDrawn, useDrawn } from '../core/edits.js';
import { noteRecentBlock } from './block-picker.js';
import { notify } from '../ui/notice.js';
import { len } from '../core/units.js';
import { CG } from '../cutting/plan.js';
import { cutOpts } from '../cutting/draw.js';
import { PATTERNS } from '@quilt/shared/patterns.js';
import { GRID_BLOCKS } from '@quilt/shared/blocks.js';
import { ROLE_COLOURS, rolesOf } from '@quilt/shared/design.js';
import { checkDrawn, drawnKey, registerDrawn } from '@quilt/shared/drawn-blocks.js';
import { gridParts } from '@quilt/shared/grid-blocks.js';
import { pathPoly } from '@quilt/shared/geometry.js';
import { blankDrawing, fromRows, join, paint, rolesUsed, split, toRows } from '../core/cell-drawing.js';
/** @typedef {import('../core/cell-drawing.js').Drawing} Drawing @typedef {import('../core/cell-drawing.js').DrawSym} DrawSym */

const ROLE_NAMES = ['Background', 'Main', 'Accent', 'Fabric 4', 'Fabric 5', 'Fabric 6'];
const UNDO_MAX = 100;

/** The editor's state: the drawing, the tool and fabric role in hand, the symmetry, and its own undo steps. */
const ed = {
  /** @type {Drawing} */ dr: blankDrawing(4),
  tool: '/',
  role: 1,
  /** @type {DrawSym} */ sym: 'off',
  /** @type {Drawing[]} */ undo: [],
  /** @type {{ x0: number, y0: number, x1: number, y1: number } | null} cells being joined */ drag: null,
  /** @type {Drawing | null} the drawing before the stroke being painted */ strokeFrom: null,
};

/** The drawing of a pattern the editor can draw (a drawn block, or a traditional grid block), or null. @param {string} key */
function drawingOf(key) {
  const p = PATTERNS[key],
    def = p?.drawn ? p.def : GRID_BLOCKS[key];
  if (!def || def.fourfold || def.extra) return null;
  return fromRows(def.n, def.rows);
}
const focusKey = () => design.blocks[focusBlock].pattern;

function step(next) {
  if (next === ed.dr) return false;
  ed.undo.push(ed.dr);
  if (ed.undo.length > UNDO_MAX) ed.undo.shift();
  ed.dr = next;
  return true;
}

// ---- drawing
const canvas = () => /** @type {HTMLCanvasElement} */ ($('drawblk-canvas'));

/** Paints a drawing's pieces in the role colours into a square of side S at (ox, oy). */
function paintPieces(g, dr, ox, oy, S) {
  const parts = gridParts({ n: dr.n, rows: toRows(dr) });
  for (const part of parts) {
    g.fillStyle = ROLE_COLOURS[part.role];
    pathPoly(
      g,
      part.poly.map(([u, v]) => [ox + u * S, oy + v * S]),
    );
    g.fill();
  }
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(0,0,0,.35)';
  for (const part of parts) {
    pathPoly(
      g,
      part.poly.map(([u, v]) => [ox + u * S, oy + v * S]),
    );
    g.stroke();
  }
}

function drawEditor() {
  const c = canvas(),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    css = c.getBoundingClientRect().width || 420,
    px = Math.round(css * dpr);
  if (c.width !== px) c.width = c.height = px;
  const g = c.getContext('2d'),
    S = px,
    n = ed.dr.n,
    cell = S / n;
  g.clearRect(0, 0, S, S);
  paintPieces(g, ed.dr, 0, 0, S);
  // the cells, dashed, so it reads as graph paper; pieces have the solid lines
  g.save();
  g.setLineDash([3 * dpr, 4 * dpr]);
  g.strokeStyle = 'rgba(0,0,0,.22)';
  g.lineWidth = dpr;
  for (let k = 1; k < n; k++) {
    g.beginPath();
    g.moveTo(k * cell, 0);
    g.lineTo(k * cell, S);
    g.moveTo(0, k * cell);
    g.lineTo(S, k * cell);
    g.stroke();
  }
  g.restore();
  g.lineWidth = 2 * dpr;
  g.strokeStyle = themeColour('--ink', '#2b2620');
  for (const p of ed.dr.pieces) g.strokeRect(p.x * cell, p.y * cell, p.w * cell, p.h * cell);
  if (ed.drag) {
    const { x0, y0, x1, y1 } = ed.drag;
    g.fillStyle = 'rgba(184,83,46,.25)';
    g.strokeStyle = themeColour('--accent', '#b8532e');
    g.lineWidth = 3 * dpr;
    const x = Math.min(x0, x1),
      y = Math.min(y0, y1),
      w = Math.abs(x1 - x0) + 1,
      h = Math.abs(y1 - y0) + 1;
    g.fillRect(x * cell, y * cell, w * cell, h * cell);
    g.strokeRect(x * cell, y * cell, w * cell, h * cell);
  }
  drawPreview();
  drawCutting();
  $('drawblk-undo').disabled = !ed.undo.length;
  $('drawblk-n').value = String(n);
}

function drawPreview() {
  const c = /** @type {HTMLCanvasElement} */ ($('drawblk-preview')),
    g = c.getContext('2d'),
    S = c.width / 2;
  g.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4; i++) paintPieces(g, ed.dr, (i % 2) * S, Math.floor(i / 2) * S, S);
}

/** What to cut for one block: by fabric role, each kind of piece and how many. */
function drawCutting() {
  const W = design.blockMm,
    seam = cutOpts.seam,
    /** @type {Map<string, { role: number, how: string, n: number, yield: number }>} */
    cuts = new Map();
  for (const part of gridParts({ n: ed.dr.n, rows: toRows(ed.dr) })) {
    const c = CG.classify(part.poly, W, W, seam),
      k = `${part.role}|${c.how}`;
    if (!cuts.has(k)) cuts.set(k, { role: part.role, how: c.how, n: 0, yield: c.yield });
    cuts.get(k).n++;
  }
  const box = $('drawblk-cut');
  box.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'fine';
  head.textContent = `For one ${len(W)} block (${ed.dr.n} × ${ed.dr.n} cells of ${len(W / ed.dr.n)}), seam allowance included:`;
  box.appendChild(head);
  const ul = document.createElement('ul');
  for (const r of rolesUsed(ed.dr))
    for (const c of [...cuts.values()].filter(c => c.role === r)) {
      const li = document.createElement('li'),
        sw = document.createElement('i');
      sw.className = 'drawblk-sw';
      sw.style.background = ROLE_COLOURS[r];
      const cutsNeeded = Math.ceil(c.n / c.yield);
      li.append(
        sw,
        `${ROLE_NAMES[r]}: ${cutsNeeded} × ${c.how}${c.yield > 1 ? ` (${c.n} piece${c.n === 1 ? '' : 's'})` : ''}`,
      );
      ul.appendChild(li);
    }
  box.appendChild(ul);
}

// ---- pointer
/** The point under the pointer, in cells. @param {PointerEvent} e */
function cellPoint(e) {
  const r = canvas().getBoundingClientRect(),
    n = ed.dr.n;
  return {
    x: Math.max(0, Math.min(n - 1e-6, ((e.clientX - r.left) / r.width) * n)),
    y: Math.max(0, Math.min(n - 1e-6, ((e.clientY - r.top) / r.height) * n)),
  };
}
function onDown(e) {
  const { x, y } = cellPoint(e);
  canvas().setPointerCapture(e.pointerId);
  if (ed.tool === 'join') ed.drag = { x0: Math.floor(x), y0: Math.floor(y), x1: Math.floor(x), y1: Math.floor(y) };
  else if (ed.tool === 'split') step(split(ed.dr, x, y, ed.sym));
  else {
    // a whole stroke is one undo step: kept when the pointer comes up
    ed.strokeFrom = ed.dr;
    ed.dr = paint(ed.dr, x, y, ed.tool, ed.role, ed.sym);
  }
  drawEditor();
}
function onMove(e) {
  if (!ed.drag && !ed.strokeFrom) return;
  const { x, y } = cellPoint(e);
  if (ed.drag) ed.drag = { ...ed.drag, x1: Math.floor(x), y1: Math.floor(y) };
  else {
    const next = paint(ed.dr, x, y, ed.tool, ed.role, ed.sym);
    if (next === ed.dr) return;
    ed.dr = next;
  }
  drawEditor();
}
function onUp() {
  if (ed.drag) {
    const { x0, y0, x1, y1 } = ed.drag;
    ed.drag = null;
    step(join(ed.dr, x0, y0, x1, y1, ed.sym));
    drawEditor();
  }
  if (ed.strokeFrom) {
    const done = ed.dr;
    ed.dr = ed.strokeFrom;
    ed.strokeFrom = null;
    step(done);
    drawEditor();
  }
}

// ---- saving
/** The drawing as a block definition with its name, checked; null (and a message) if it can't be used. */
function currentDef() {
  const def = checkDrawn({ label: $('drawblk-name').value, n: ed.dr.n, rows: toRows(ed.dr) });
  if (!def) notify('This drawing could not be made into a block.');
  return def;
}
function useInQuilt() {
  if (readOnly) return notify('This quilt is read-only here, so it can’t be changed.');
  const def = currentDef();
  if (!def) return;
  const key = drawnKey(def);
  registerDrawn(key, def);
  noteRecentBlock(key);
  selParts.clear();
  dispatch(useDrawn, selBlocks, key, def, rolesOf(design.blocks[focusBlock]));
  /** @type {HTMLDialogElement} */ ($('drawblk')).close();
}
function keepInMyBlocks() {
  if (readOnly) return notify('This quilt is read-only here, so it can’t be changed.');
  const def = currentDef();
  if (!def) return;
  const key = drawnKey(def);
  registerDrawn(key, def);
  dispatch(keepDrawn, key, def);
  notify(`“${def.label}” is in My blocks, in the block library.`);
}

// ---- opening
function setTool(t) {
  ed.tool = t;
  for (const b of document.querySelectorAll('#drawblk-tools button'))
    b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.tool === t));
  canvas().style.cursor = t === 'join' ? 'cell' : 'crosshair';
}
function setRole(r) {
  ed.role = r;
  for (const b of document.querySelectorAll('#drawblk-roles button'))
    b.setAttribute('aria-pressed', String(+(/** @type {HTMLElement} */ (b).dataset.role) === r));
}

/** Opens the editor: on the selected block when it is a drawn one (to change it), otherwise on an empty grid. */
function openDrawer() {
  const key = focusKey(),
    mine = PATTERNS[key]?.drawn ? drawingOf(key) : null;
  ed.dr = mine || blankDrawing(4);
  ed.undo = [];
  const count = Object.values(PATTERNS).filter(p => p.drawn).length;
  $('drawblk-name').value = mine ? PATTERNS[key].label : `My block ${count + 1}`;
  const from = drawingOf(key);
  $('drawblk-from').disabled = !from;
  $('drawblk-from').title = from
    ? `Start again from “${PATTERNS[key].label}”, the selected block`
    : 'The selected block can’t be drawn on this grid';
  const dlg = /** @type {HTMLDialogElement} */ ($('drawblk'));
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  drawEditor();
}

function initDrawer() {
  const tools = $('drawblk-tools');
  tools.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.tool) setTool(b.dataset.tool);
  });
  const roles = $('drawblk-roles');
  ROLE_COLOURS.forEach((col, r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'drawblk-role';
    b.dataset.role = String(r);
    b.title = ROLE_NAMES[r];
    b.setAttribute('aria-label', ROLE_NAMES[r]);
    b.style.background = col;
    roles.appendChild(b);
  });
  roles.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.role) setRole(+b.dataset.role);
  });
  $('drawblk-sym').addEventListener('change', e => {
    ed.sym = /** @type {DrawSym} */ (/** @type {HTMLSelectElement} */ (e.target).value);
  });
  $('drawblk-n').addEventListener('change', e => {
    const n = +(/** @type {HTMLSelectElement} */ (e.target).value);
    if (n !== ed.dr.n) step(blankDrawing(n));
    drawEditor();
  });
  $('drawblk-clear').addEventListener('click', () => {
    step(blankDrawing(ed.dr.n));
    drawEditor();
  });
  $('drawblk-from').addEventListener('click', () => {
    const from = drawingOf(focusKey());
    if (from && step(from)) drawEditor();
  });
  $('drawblk-undo').addEventListener('click', () => {
    if (!ed.undo.length) return;
    ed.dr = ed.undo.pop();
    drawEditor();
  });
  $('drawblk').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      $('drawblk-undo').click();
    }
  });
  $('drawblk-x').addEventListener('click', () => /** @type {HTMLDialogElement} */ ($('drawblk')).close());
  $('drawblk-use').addEventListener('click', useInQuilt);
  $('drawblk-keep').addEventListener('click', keepInMyBlocks);
  const c = canvas();
  c.addEventListener('pointerdown', onDown);
  c.addEventListener('pointermove', onMove);
  c.addEventListener('pointerup', onUp);
  c.addEventListener('pointercancel', onUp);
  addEventListener('resize', () => /** @type {HTMLDialogElement} */ ($('drawblk')).open && drawEditor());
  setTool(ed.tool);
  setRole(ed.role);
  setOpenBlockDrawer(openDrawer);
}
initDrawer();

export { openDrawer };
