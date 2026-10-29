// Borders panel.
import './sashing-ui.js'; // load order: runs after designer/sashing-ui
import { design } from '../core/store.js';
import { showToolsPanel } from './ui-state.js';
import { $ } from '../core/dom.js';
import { fabricById } from './fabric-library.js';
import { BORDER_TYPES, borderFab, borderSidePieces, pathPoly } from '../core/geometry.js';
import { drawPaletteInto } from './parts-editor.js';
import { fabricFill } from '../render/fabric-fill.js';
import { dispatch } from './dispatch.js';
import { addBorder, moveBorder, removeBorder, setBorderFabric, updateBorder } from '../core/edits.js';

// ---- borders UI
let brdActive = null; // { i, slot } — which border colour the palette is choosing
function borderSketch(type, fabs, w = 96, h = 34) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const b = { type, mm: h, fabrics: fabs },
    cols = ['#2f466f', '#efe5cf', '#c79a45'];
  for (const pc of borderSidePieces(b, w)) {
    g.fillStyle = fabs ? fabricFill(g, fabricById(borderFab(b, pc.slot)), 6, 3) : cols[pc.slot];
    pathPoly(g, pc.poly);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.2)';
    g.lineWidth = 0.6;
    g.stroke();
  }
  return c;
}
function swatch(fid, px = 22) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    c = document.createElement('canvas');
  c.width = c.height = px * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = fabricFill(g, fabricById(fid), 8, 5);
  g.fillRect(0, 0, px, px);
  return c;
}
function renderBorderUI() {
  if (!design || !$('brd-card')) return;
  const types = $('brd-types');
  if (!types.childElementCount)
    for (const [k, t] of Object.entries(BORDER_TYPES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'brd-type';
      b.dataset.t = k;
      b.title = `Add a ${t.label.toLowerCase()} border`;
      const sp = document.createElement('span');
      sp.textContent = t.label;
      b.append(borderSketch(k, null), sp);
      types.appendChild(b);
    }
  const list = $('brd-list');
  list.innerHTML = '';
  const bs = design.borders || [];
  bs.forEach((b, i) => {
    const t = BORDER_TYPES[b.type];
    if (!t) return;
    const row = document.createElement('div');
    row.className = 'brd-row';
    row.dataset.i = i;
    const top = document.createElement('div');
    top.className = 'top';
    const name = document.createElement('b');
    name.textContent = `${i + 1}. ${i === 0 ? 'inner' : i === bs.length - 1 ? 'outer' : 'middle'}`;
    const sel = document.createElement('select');
    sel.dataset.a = 'type';
    for (const [k, tt] of Object.entries(BORDER_TYPES)) sel.add(new Option(tt.label, k, false, k === b.type));
    const mm = document.createElement('input');
    mm.type = 'number';
    mm.min = 10;
    mm.max = 400;
    mm.step = 1;
    mm.value = b.mm;
    mm.dataset.a = 'mm';
    mm.title = 'Width (mm)';
    const unit = document.createElement('span');
    unit.className = 'fine';
    unit.style.margin = 0;
    unit.textContent = 'mm';
    const mk = (a, txt, title, dis) => {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'ic';
      x.dataset.a = a;
      x.textContent = txt;
      x.title = title;
      x.setAttribute('aria-label', title);
      x.disabled = !!dis;
      return x;
    };
    top.append(
      name,
      sel,
      mm,
      unit,
      mk('in', '↑', 'Move inwards', i === 0),
      mk('out', '↓', 'Move outwards', i === bs.length - 1),
      mk('del', '×', 'Remove this border'),
    );
    const slots = document.createElement('div');
    slots.className = 'brd-slots';
    t.slots.forEach((label, si) => {
      const sb = document.createElement('button');
      sb.type = 'button';
      sb.className = 'brd-slot';
      sb.dataset.slot = si;
      sb.setAttribute('aria-pressed', String(!!brdActive && brdActive.i === i && brdActive.slot === si));
      const sp = document.createElement('span');
      sp.textContent = label;
      sb.append(swatch(borderFab(b, si)), sp);
      slots.appendChild(sb);
    });
    row.append(top, slots);
    row.appendChild(borderSketch(b.type, b.fabrics, 260, 26));
    row.lastChild.style.width = '100%';
    row.lastChild.style.height = 'auto';
    row.lastChild.style.borderRadius = '3px';
    list.appendChild(row);
  });
  const pb = $('brd-palbox');
  if (brdActive && bs[brdActive.i]) {
    pb.hidden = false;
    const b = bs[brdActive.i];
    $('brd-paltitle').textContent =
      `Fabric for border ${brdActive.i + 1} · ${BORDER_TYPES[b.type].slots[brdActive.slot]}`;
    drawPaletteInto($('brd-pal'), borderFab(b, brdActive.slot));
  } else {
    pb.hidden = true;
    brdActive = null;
  }
}
/** Applies a border edit and redraws the panel. @param {Function} edit @param {...any} args */
function borderEdit(edit, ...args) {
  dispatch(edit, ...args);
  renderBorderUI();
}
function openBorders() {
  showToolsPanel('brd');
}
function initBorderUI() {
  $('brd-types').addEventListener('click', e => {
    const b = e.target.closest('.brd-type');
    if (!b) return;
    const t = BORDER_TYPES[b.dataset.t],
      n = (design.borders || []).length;
    const def = {
      plain: ['b1', 'b1'],
      piano: ['b1', 'b0', 'b1'],
      squares: ['b4', 'b0', 'b4'],
      checker: ['b1', 'b0', 'b1'],
      sawtooth: ['b4', 'b0', 'b4'],
      geese: ['b1', 'b0', 'b1'],
    }[b.dataset.t];
    borderEdit(addBorder, { type: b.dataset.t, mm: t.mm, fabrics: def });
    brdActive = null;
    renderBorderUI();
    if (n === 0) $('brd-list').scrollIntoView({ block: 'nearest' });
  });
  $('brd-list').addEventListener('change', e => {
    const row = e.target.closest('.brd-row');
    if (!row) return;
    const i = +row.dataset.i;
    if (e.target.dataset.a === 'type') borderEdit(updateBorder, i, { type: e.target.value });
    if (e.target.dataset.a === 'mm') {
      const v = Math.max(10, Math.min(400, Math.round(+e.target.value || 0)));
      borderEdit(updateBorder, i, { mm: v });
    }
  });
  $('brd-list').addEventListener('click', e => {
    const row = e.target.closest('.brd-row');
    if (!row) return;
    const i = +row.dataset.i;
    const a = e.target.closest('[data-a]')?.dataset.a,
      slot = e.target.closest('.brd-slot');
    if (slot) {
      const si = +slot.dataset.slot;
      brdActive = brdActive && brdActive.i === i && brdActive.slot === si ? null : { i, slot: si };
      renderBorderUI();
      return;
    }
    if (a === 'del') {
      brdActive = null;
      borderEdit(removeBorder, i);
    } else if (a === 'in' && i > 0) {
      brdActive = null;
      borderEdit(moveBorder, i, -1);
    } else if (a === 'out' && i < (design.borders || []).length - 1) {
      brdActive = null;
      borderEdit(moveBorder, i, 1);
    }
  });
  $('brd-pal').addEventListener('click', e => {
    const f = e.target.closest('button.fab');
    if (!f || !brdActive) return;
    const { i, slot } = brdActive;
    borderEdit(setBorderFabric, i, slot, f.dataset.f);
  });
}
initBorderUI();

export { openBorders, renderBorderUI };
