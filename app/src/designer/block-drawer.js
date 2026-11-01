// The block editor: draw your own block, in one of two ways.
//   Cells: a grid of cells, each a square, half-square triangle, hourglass or flying goose, or joined into bigger
//          squares and rectangles (core/cell-drawing.js).
//   Graph paper: seam lines at any angle between points of a fine grid, with rulers; the pieces are worked out
//          from the lines and coloured by clicking them (core/paper-drawing.js, @quilt/shared/seam-faces.js).
// Both have mirror or turn symmetry, undo, a 2 × 2 preview and the cutting list. The block is kept in the quilt
// (design.drawn, see @quilt/shared/drawn-blocks.js), so it travels with the quilt and shows under "My blocks".
import '../cutting/page.js'; // load order: runs after cutting/page
import { design, focusBlock, readOnly, selBlocks, selParts } from '../core/store.js';
import { $, themeColour } from '../core/dom.js';
import { setOpenBlockDrawer } from './ui-state.js';
import { dispatch } from './dispatch.js';
import { keepDrawn, useDrawn } from '../core/edits.js';
import { noteRecentBlock } from './block-picker.js';
import { notify } from '../ui/notice.js';
import { getUnit, len, num } from '../core/units.js';
import { CG } from '../cutting/plan.js';
import { cutOpts } from '../cutting/draw.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { GRID_BLOCKS } from '@quilt/shared/blocks.js';
import { ROLE_COLOURS, rolesOf } from '@quilt/shared/design.js';
import { checkDrawn, drawnKey, registerDrawn } from '@quilt/shared/drawn-blocks.js';
import { gridParts } from '@quilt/shared/grid-blocks.js';
import { pathPoly } from '@quilt/shared/geometry.js';
import { blankDrawing, fromRows, join, paint, split, toRows } from '../core/cell-drawing.js';
import { addLine, blankPaper, eraseLine, fill, paperDef, paperFromParts, paperPieces } from '../core/paper-drawing.js';
/** @typedef {import('../core/cell-drawing.js').Drawing} Drawing @typedef {import('../core/cell-drawing.js').DrawSym} DrawSym */
/** @typedef {import('../core/paper-drawing.js').Paper} Paper */
/** @typedef {{ mode: 'cells' | 'paper', dr: Drawing, pp: Paper }} Sheet what one undo step brings back */

const ROLE_NAMES = ['Background', 'Main', 'Accent', 'Fabric 4', 'Fabric 5', 'Fabric 6'];
const UNDO_MAX = 100;
const RULER = 24; // css pixels of ruler along the top and left of the graph paper

/** The editor's state: what is drawn, the tools in hand, and its own undo steps. */
const ed = {
  /** @type {'cells' | 'paper'} */ mode: 'cells',
  /** @type {Drawing} */ dr: blankDrawing(4),
  /** @type {Paper} */ pp: blankPaper(4),
  tool: '/', // cells: a shape, 'join' or 'split'
  ptool: 'line', // graph paper: 'line', 'fill' or 'erase'
  snap: 4, // graph paper: points per cell side
  role: 1,
  /** @type {DrawSym} */ sym: 'off',
  /** @type {Sheet[]} */ undo: [],
  /** @type {{ x0: number, y0: number, x1: number, y1: number } | null} cells being joined, or a line being drawn */
  drag: null,
  /** @type {Drawing | null} the drawing before the stroke being painted */ strokeFrom: null,
  /** @type {{ x: number, y: number } | null} the graph-paper point under the pointer */ hover: null,
};
const sheet = () => ({ mode: ed.mode, dr: ed.dr, pp: ed.pp });
const nOf = () => (ed.mode === 'paper' ? ed.pp.n : ed.dr.n);

/** Makes a change one undo step. @param {Partial<Sheet>} next */
function step(next) {
  const was = sheet(),
    now = { ...was, ...next };
  if (now.mode === was.mode && now.dr === was.dr && now.pp === was.pp) return false;
  ed.undo.push(was);
  if (ed.undo.length > UNDO_MAX) ed.undo.shift();
  Object.assign(ed, now);
  return true;
}

// ---- what a block can be opened as
/** The cell drawing of a pattern (a drawn block, or a traditional grid block), or null. @param {string} key */
function cellsOf(key) {
  const p = PATTERNS[key],
    def = p?.drawn ? p.def : GRID_BLOCKS[key];
  if (!def || def.fourfold || def.extra) return null;
  return fromRows(def.n, def.rows);
}
/** Any pattern on graph paper: the lines it was drawn with, or its pieces' sides. @param {string} key @param {number} n */
function paperOf(key, n) {
  const def = PATTERNS[key]?.drawn ? PATTERNS[key].def : null;
  if (def?.paper) return { n: def.n, lines: def.paper.lines, fills: def.paper.fills };
  const size = def ? def.n : GRID_BLOCKS[key] ? GRID_BLOCKS[key].n : n;
  return paperFromParts(
    size,
    partsOf(key).map(p => ({ role: p.role, poly: p.poly.map(([x, y]) => [x * size, y * size]) })),
  );
}
const focusKey = () => design.blocks[focusBlock].pattern;

/** The pieces drawn now, in the unit square, with their roles. @returns {{ poly: number[][], role: number }[]} */
function currentParts() {
  if (ed.mode === 'cells') return gridParts({ n: ed.dr.n, rows: toRows(ed.dr) });
  const n = ed.pp.n;
  return paperPieces(ed.pp).pieces.map(p => ({ role: p.role, poly: p.poly.map(([x, y]) => [x / n, y / n]) }));
}

// ---- drawing
const canvas = () => /** @type {HTMLCanvasElement} */ ($('drawblk-canvas'));
/** Where the block sits on the canvas, in canvas pixels (graph paper leaves room for the rulers). */
function frame() {
  const c = canvas(),
    dpr = c.width / (c.getBoundingClientRect().width || c.width),
    m = ed.mode === 'paper' ? RULER * dpr : 0;
  return { o: m, size: c.width - m, dpr };
}

/** Paints pieces (unit square) in the role colours into a square of side S at (ox, oy). */
function paintParts(g, parts, ox, oy, S, edge = 'rgba(0,0,0,.35)') {
  const at = poly => poly.map(([u, v]) => [ox + u * S, oy + v * S]);
  for (const part of parts) {
    g.fillStyle = ROLE_COLOURS[part.role];
    pathPoly(g, at(part.poly));
    g.fill();
  }
  g.lineWidth = 1;
  g.strokeStyle = edge;
  for (const part of parts) {
    pathPoly(g, at(part.poly));
    g.stroke();
  }
}

function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function drawCells(g, o, S, dpr) {
  const n = ed.dr.n,
    cell = S / n;
  paintParts(g, currentParts(), o, o, S);
  // the cells, dashed; pieces have the solid lines
  g.save();
  g.setLineDash([3 * dpr, 4 * dpr]);
  g.strokeStyle = 'rgba(0,0,0,.22)';
  g.lineWidth = dpr;
  for (let k = 1; k < n; k++) {
    line(g, k * cell, 0, k * cell, S);
    line(g, 0, k * cell, S, k * cell);
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
}

function drawPaper(g, o, S, dpr) {
  const n = ed.pp.n,
    cell = S / n,
    ink = themeColour('--ink', '#2b2620'),
    accent = themeColour('--accent', '#b8532e'),
    at = v => o + v * cell;
  // the margin for the rulers
  g.fillStyle = themeColour('--panel', '#fffaf2');
  g.fillRect(0, 0, o, o + S);
  g.fillRect(0, 0, o + S, o);
  const { pieces, floating } = paperPieces(ed.pp);
  paintParts(
    g,
    pieces.map(p => ({ role: p.role, poly: p.poly.map(([x, y]) => [x / n, y / n]) })),
    o,
    o,
    S,
    'transparent',
  );
  // the grid: faint at every point you can snap to, stronger at every square
  g.lineWidth = dpr;
  for (let k = 1; k < n * ed.snap; k++) {
    g.strokeStyle = k % ed.snap ? 'rgba(60,90,140,.13)' : 'rgba(60,90,140,.35)';
    line(g, at(k / ed.snap), o, at(k / ed.snap), o + S);
    line(g, o, at(k / ed.snap), o + S, at(k / ed.snap));
  }
  // the seams: the pieces' outlines solid; a line that cuts nothing (it stops short) faint and dashed, so it shows
  g.save();
  g.strokeStyle = ink;
  g.globalAlpha = 0.45;
  g.lineWidth = 1.5 * dpr;
  g.setLineDash([5 * dpr, 4 * dpr]);
  for (const [x1, y1, x2, y2] of ed.pp.lines) line(g, at(x1), at(y1), at(x2), at(y2));
  g.restore();
  g.strokeStyle = ink;
  g.lineWidth = 2 * dpr;
  g.lineJoin = 'round';
  for (const p of pieces) {
    pathPoly(
      g,
      p.poly.map(([x, y]) => [at(x), at(y)]),
    );
    g.stroke();
  }
  g.strokeRect(o, o, S, S);
  // rulers: a tick at every grid point, the length from the corner at every square
  const cellMm = design.blockMm / n;
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = dpr;
  g.font = `${10 * dpr}px monospace`;
  for (let k = 0; k <= n * ed.snap; k++) {
    const v = at(k / ed.snap),
      major = k % ed.snap === 0,
      t = (major ? 8 : k % (ed.snap / 2) === 0 ? 5 : 3) * dpr;
    line(g, v, o - 2 * dpr, v, o - 2 * dpr - t);
    line(g, o - 2 * dpr, v, o - 2 * dpr - t, v);
    if (major && k) {
      const label = num((k / ed.snap) * cellMm),
        p = Math.min(v, o + S - 14 * dpr);
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillText(label, p, 1 * dpr);
      g.save();
      g.translate(1 * dpr, p);
      g.rotate(-Math.PI / 2);
      g.fillText(label, 0, 0);
      g.restore();
    }
  }
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText(getUnit(), 2 * dpr, 2 * dpr);
  // the line being drawn, with its length; the point under the pointer
  if (ed.drag) {
    const { x0, y0, x1, y1 } = ed.drag;
    g.save();
    g.strokeStyle = accent;
    g.lineWidth = 3 * dpr;
    g.setLineDash([6 * dpr, 4 * dpr]);
    line(g, at(x0), at(y0), at(x1), at(y1));
    g.restore();
    g.fillStyle = accent;
    g.font = `600 ${12 * dpr}px sans-serif`;
    g.fillText(
      len(Math.hypot(x1 - x0, y1 - y0) * cellMm),
      Math.min(at(x1) + 8 * dpr, o + S - 80 * dpr),
      Math.min(at(y1) + 8 * dpr, o + S - 16 * dpr),
    );
  }
  if (ed.hover && ed.ptool === 'line') {
    g.fillStyle = accent;
    g.beginPath();
    g.arc(at(ed.hover.x), at(ed.hover.y), 4 * dpr, 0, 7);
    g.fill();
  }
  $('drawblk-float').hidden = !floating;
}

function drawEditor() {
  const c = canvas(),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    css = c.getBoundingClientRect().width || 420,
    px = Math.round(css * dpr);
  if (c.width !== px) c.width = c.height = px;
  const g = c.getContext('2d'),
    { o, size } = frame();
  g.clearRect(0, 0, c.width, c.height);
  if (ed.mode === 'paper') drawPaper(g, o, size, dpr);
  else drawCells(g, o, size, dpr);
  drawPreview();
  drawCutting();
  $('drawblk-undo').disabled = !ed.undo.length;
  $('drawblk-n').value = String(nOf());
  press('#drawblk-mode button', 'mode', ed.mode);
  $('drawblk-cells-tools').hidden = ed.mode !== 'cells';
  $('drawblk-paper-tools').hidden = ed.mode !== 'paper';
  if (ed.mode !== 'paper') $('drawblk-float').hidden = true;
}

function drawPreview() {
  const c = /** @type {HTMLCanvasElement} */ ($('drawblk-preview')),
    g = c.getContext('2d'),
    S = c.width / 2,
    parts = currentParts();
  g.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4; i++) paintParts(g, parts, (i % 2) * S, Math.floor(i / 2) * S, S);
}

/** What to cut for one block: by fabric role, each kind of piece and how many. */
function drawCutting() {
  const W = design.blockMm,
    n = nOf(),
    seam = cutOpts.seam,
    parts = currentParts(),
    /** @type {Map<string, { role: number, how: string, n: number, yield: number }>} */
    cuts = new Map();
  for (const part of parts) {
    const c = CG.classify(part.poly, W, W, seam),
      k = `${part.role}|${c.how}`;
    if (!cuts.has(k)) cuts.set(k, { role: part.role, how: c.how, n: 0, yield: c.yield });
    cuts.get(k).n++;
  }
  const box = $('drawblk-cut');
  box.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'fine';
  head.textContent = `For one ${len(W)} block (${n} × ${n} squares of ${len(W / n)}), seam allowance included:`;
  box.appendChild(head);
  const ul = document.createElement('ul');
  for (const r of [...new Set(parts.map(p => p.role))].sort((a, b) => a - b))
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
/** The point under the pointer, in cells (kept inside the block). @param {PointerEvent} e */
function cellPoint(e) {
  const r = canvas().getBoundingClientRect(),
    { o, size, dpr } = frame(),
    n = nOf(),
    toCells = v => ((v * dpr - o) / size) * n;
  return {
    x: Math.max(0, Math.min(n - 1e-6, toCells(e.clientX - r.left))),
    y: Math.max(0, Math.min(n - 1e-6, toCells(e.clientY - r.top))),
  };
}
/** The nearest graph-paper point. */
function snapped({ x, y }) {
  const s = ed.snap,
    n = nOf(),
    to = v => Math.max(0, Math.min(n, Math.round(v * s) / s));
  return { x: to(x), y: to(y) };
}
function onDown(e) {
  const p = cellPoint(e);
  canvas().setPointerCapture(e.pointerId);
  if (ed.mode === 'paper') {
    if (ed.ptool === 'line') {
      const s = snapped(p);
      ed.drag = { x0: s.x, y0: s.y, x1: s.x, y1: s.y };
    } else if (ed.ptool === 'fill') step({ pp: fill(ed.pp, p.x, p.y, ed.role, ed.sym) });
    else {
      const { size, dpr } = frame();
      step({ pp: eraseLine(ed.pp, p.x, p.y, ((12 * dpr) / size) * nOf(), ed.sym) });
    }
  } else if (ed.tool === 'join')
    ed.drag = { x0: Math.floor(p.x), y0: Math.floor(p.y), x1: Math.floor(p.x), y1: Math.floor(p.y) };
  else if (ed.tool === 'split') step({ dr: split(ed.dr, p.x, p.y, ed.sym) });
  else {
    // a whole stroke is one undo step: kept when the pointer comes up
    ed.strokeFrom = ed.dr;
    ed.dr = paint(ed.dr, p.x, p.y, ed.tool, ed.role, ed.sym);
  }
  drawEditor();
}
function onMove(e) {
  const p = cellPoint(e);
  if (ed.mode === 'paper') {
    const s = snapped(p),
      moved = !ed.hover || ed.hover.x !== s.x || ed.hover.y !== s.y;
    ed.hover = s;
    if (ed.drag) ed.drag = { ...ed.drag, x1: s.x, y1: s.y };
    if (moved) drawEditor();
    return;
  }
  if (ed.drag) ed.drag = { ...ed.drag, x1: Math.floor(p.x), y1: Math.floor(p.y) };
  else if (ed.strokeFrom) {
    const next = paint(ed.dr, p.x, p.y, ed.tool, ed.role, ed.sym);
    if (next === ed.dr) return;
    ed.dr = next;
  } else return;
  drawEditor();
}
function onUp() {
  if (ed.drag) {
    const { x0, y0, x1, y1 } = ed.drag;
    ed.drag = null;
    if (ed.mode === 'paper') step({ pp: addLine(ed.pp, x0, y0, x1, y1, ed.sym) });
    else step({ dr: join(ed.dr, x0, y0, x1, y1, ed.sym) });
    drawEditor();
  }
  if (ed.strokeFrom) {
    const done = ed.dr;
    ed.dr = ed.strokeFrom;
    ed.strokeFrom = null;
    step({ dr: done });
    drawEditor();
  }
}

// ---- saving
/** The drawing as a block definition with its name, checked; null (and a message) if it can't be used. */
function currentDef() {
  const label = $('drawblk-name').value;
  if (ed.mode === 'paper') {
    const raw = paperDef(ed.pp, label);
    if (!raw) {
      notify('A shape floats free inside the block: draw a seam from it to another seam or to the edge.');
      return null;
    }
    const def = checkDrawn(raw);
    if (!def) notify('This drawing has too many pieces to be a block.');
    return def;
  }
  const def = checkDrawn({ label, n: ed.dr.n, rows: toRows(ed.dr) });
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

// ---- tools and opening
/** Presses the one button of a group whose data value matches. */
function press(sel, attr, value) {
  for (const b of document.querySelectorAll(sel))
    b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset[attr] === String(value)));
}
function setTool(t) {
  ed.tool = t;
  press('#drawblk-tools button', 'tool', t);
  canvas().style.cursor = t === 'join' ? 'cell' : 'crosshair';
}
function setPaperTool(t) {
  ed.ptool = t;
  press('#drawblk-ptools button', 'ptool', t);
  canvas().style.cursor = t === 'fill' ? 'cell' : 'crosshair';
}
const showTool = () => (ed.mode === 'paper' ? setPaperTool(ed.ptool) : setTool(ed.tool));
function setRole(r) {
  ed.role = r;
  press('#drawblk-roles button', 'role', r);
}
/** The cell drawing on graph paper: its pieces' sides become seam lines. @param {Drawing} dr */
const cellsToPaper = dr =>
  paperFromParts(
    dr.n,
    gridParts({ n: dr.n, rows: toRows(dr) }).map(p => ({
      role: p.role,
      poly: p.poly.map(([x, y]) => [x * dr.n, y * dr.n]),
    })),
  );
/**
 * Cells or graph paper. Going to graph paper takes the cell drawing along while the paper is still empty; coming
 * back finds the cells as they were. @param {'cells' | 'paper'} mode
 */
function setMode(mode) {
  if (mode === ed.mode) return;
  // (an untouched grid of cells comes along as an empty sheet, not as a seam round every cell)
  const empty = !ed.pp.lines.length && !ed.pp.fills.length,
    untouched = toRows(ed.dr) === toRows(blankDrawing(ed.dr.n));
  step({ mode, pp: mode === 'paper' && empty ? (untouched ? blankPaper(ed.dr.n) : cellsToPaper(ed.dr)) : ed.pp });
  showTool();
  drawEditor();
}

/** Opens the editor: on the selected block when it is a drawn one (to change it), otherwise on an empty grid. */
function openDrawer() {
  const key = focusKey(),
    def = PATTERNS[key]?.drawn ? PATTERNS[key].def : null;
  ed.undo = [];
  ed.drag = null;
  ed.hover = null;
  if (def?.extra) {
    ed.mode = 'paper';
    ed.pp = paperOf(key, def.n);
    ed.dr = blankDrawing(def.n);
  } else {
    ed.mode = 'cells';
    ed.dr = (def && cellsOf(key)) || blankDrawing(4);
    ed.pp = blankPaper(ed.dr.n);
  }
  const count = Object.values(PATTERNS).filter(p => p.drawn).length;
  $('drawblk-name').value = def ? PATTERNS[key].label : `My block ${count + 1}`;
  $('drawblk-from').title = `Start again from “${PATTERNS[key].label}”, the selected block`;
  showTool();
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

/** Start from the selected block: as cells when it is drawn on a grid of cells, otherwise on graph paper (any block can). */
function startFromSelected() {
  const key = focusKey(),
    cells = ed.mode === 'cells' ? cellsOf(key) : null;
  if (cells) step({ dr: cells });
  else step({ mode: 'paper', pp: paperOf(key, GRID_BLOCKS[key]?.n || PATTERNS[key]?.def?.n || ed.pp.n) });
  showTool();
  drawEditor();
}

function initDrawer() {
  $('drawblk-tools').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.tool) setTool(b.dataset.tool);
  });
  $('drawblk-ptools').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.ptool) setPaperTool(b.dataset.ptool);
  });
  $('drawblk-mode').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.mode) setMode(/** @type {'cells' | 'paper'} */ (b.dataset.mode));
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
  $('drawblk-snap').addEventListener('change', e => {
    ed.snap = +(/** @type {HTMLSelectElement} */ (e.target).value);
    drawEditor();
  });
  $('drawblk-n').addEventListener('change', e => {
    const n = +(/** @type {HTMLSelectElement} */ (e.target).value);
    if (ed.mode === 'paper') {
      // the drawing stays as it is: its lines are measured again in the new squares
      const k = n / ed.pp.n;
      if (k !== 1)
        step({
          pp: {
            n,
            lines: ed.pp.lines.map(l => l.map(v => v * k)),
            fills: ed.pp.fills.map(([x, y, r]) => [x * k, y * k, r]),
          },
        });
    } else if (n !== ed.dr.n) step({ dr: blankDrawing(n) });
    drawEditor();
  });
  $('drawblk-clear').addEventListener('click', () => {
    step(ed.mode === 'paper' ? { pp: blankPaper(ed.pp.n) } : { dr: blankDrawing(ed.dr.n) });
    drawEditor();
  });
  $('drawblk-from').addEventListener('click', startFromSelected);
  $('drawblk-undo').addEventListener('click', () => {
    if (!ed.undo.length) return;
    Object.assign(ed, ed.undo.pop());
    showTool();
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
  c.addEventListener('pointerleave', () => {
    if (ed.hover && !ed.drag) {
      ed.hover = null;
      drawEditor();
    }
  });
  addEventListener('resize', () => /** @type {HTMLDialogElement} */ ($('drawblk')).open && drawEditor());
  setTool(ed.tool);
  setPaperTool(ed.ptool);
  setRole(ed.role);
  setOpenBlockDrawer(openDrawer);
}
initDrawer();

export { openDrawer };
