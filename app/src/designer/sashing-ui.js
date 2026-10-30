// Sashing panel.
import '../cutting/page.js'; // load order: runs after cutting/page
import { design } from '../core/store.js';
import { showToolsPanel } from './ui-state.js';
import { $ } from '../core/dom.js';
import {
  CORNER_BLOCK_MIN_MM,
  CORNER_PATTERNS,
  isOnPoint,
  blockPolys,
  pathPoly,
  pointInPoly,
  quiltMm,
  sashOf,
} from '@quilt/shared/geometry.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { ROLE_COLOURS, newBlock } from '@quilt/shared/design.js';
import { fabricById, onFabricsLoaded } from './fabric-library.js';
import { pieceFill } from '../render/fabric-fill.js';
import { drawPaletteInto } from './parts-editor.js';
import { dispatch } from './dispatch.js';
import { setSashing } from '../core/edits.js';

// the parts of the cornerstone block picked for the next fabric (none: the fabric goes on every part)
let cbSel = new Set();

// the cornerstone choices: plain fabric, then the simple patterns (drawn in their role colours, like the blocks')
function drawCornerPatterns(current, allowed) {
  const box = $('sash-cpats');
  if (!box.childElementCount)
    for (const key of ['', ...CORNER_PATTERNS]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pat';
      b.dataset.p = key;
      b.title = key ? PATTERNS[key].label : 'Plain fabric';
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      for (const part of partsOf(key || 'plain')) {
        g.fillStyle = ROLE_COLOURS[part.role];
        pathPoly(
          g,
          part.poly.map(([u, v]) => [u * 64, v * 64]),
        );
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
      }
      const s = document.createElement('span');
      s.textContent = b.title;
      b.append(c, s);
      box.appendChild(b);
    }
  for (const b of box.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.p === current));
    b.disabled = !!b.dataset.p && !allowed; // plain fabric is always possible
  }
}
// the cornerstone block, large, at the fabric's real scale; the picked parts outlined
function drawCornerBlockEditor(cb, mm) {
  const cv = $('sash-cb'),
    g = cv.getContext('2d'),
    S = cv.width,
    polys = blockPolys(cb, 0, 0, S, S);
  g.clearRect(0, 0, S, S);
  polys.forEach((poly, pi) => {
    g.fillStyle = pieceFill(g, cb, pi, poly, S / (mm / 10), pi);
    pathPoly(g, poly);
    g.fill();
    g.strokeStyle = 'rgba(40,30,20,.45)';
    g.lineWidth = 1;
    g.stroke();
  });
  for (const pi of cbSel) {
    pathPoly(g, polys[pi]);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = '#e0592a';
    g.lineWidth = 2.5;
    g.stroke();
  }
  const names = partsOf(cb.pattern).map(p => p.name),
    pick = [...cbSel];
  $('sash-cb-info').textContent = !pick.length
    ? `${PATTERNS[cb.pattern].label} · click a part to choose its fabric`
    : pick.length === 1
      ? `Selected: ${names[pick[0]]} · ${fabricById(cb.fabrics[pick[0]]).name}`
      : `${pick.length} parts selected`;
}
// ---- sashing settings
function renderSashUI() {
  if (!design || !$('sash-card')) return;
  const s = sashOf(design),
    raw = design.sashing || {};
  if (document.activeElement !== $('sash-mm')) $('sash-mm').value = s.mm;
  // on point the sashing always frames every block (so the setting triangles stay simple triangles)
  const onPoint = isOnPoint(design);
  $('sash-border').checked = onPoint || !!raw.border;
  $('sash-border').disabled = onPoint;
  $('sash-border').parentElement.title = onPoint ? 'On point, the sashing always frames every block' : '';
  $('sash-cs').checked = s.cornerstones;
  $('sash-cs-box').hidden = !s.cornerstones; // no cornerstones: no fabric to choose for them
  const box = $('sash-presets');
  box.innerHTML = '';
  for (const v of [0, 25, 38, 50, 64, 76]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v ? v + ' mm' : 'None';
    b.dataset.v = v;
    b.setAttribute('aria-pressed', String(s.mm === v));
    box.appendChild(b);
  }
  drawPaletteInto($('sash-fabs'), raw.fabric || 'b0');
  // pieced cornerstones only where there is room to sew them; a block chosen before stays saved meanwhile
  const wide = s.mm >= CORNER_BLOCK_MIN_MM,
    cb = s.cornerBlock;
  cbSel = cb ? new Set([...cbSel].filter(i => i < cb.fabrics.length)) : new Set(); // (undo can change the pattern)
  drawCornerPatterns(cb ? cb.pattern : '', wide);
  $('sash-cb-note').textContent = wide
    ? ''
    : `Pieced cornerstones need sashing wider than ${CORNER_BLOCK_MIN_MM - 1} mm${raw.cornerBlock ? ': plain ones until then' : ''}.`;
  $('sash-cb-edit').hidden = !cb;
  if (cb) drawCornerBlockEditor(cb, s.mm);
  $('sash-corner-lbl').textContent = !cb
    ? 'Cornerstone fabric'
    : cbSel.size
      ? 'Fabric for the selected parts'
      : 'Fabric for every part (or click parts above first)';
  const picked = cb ? new Set((cbSel.size ? [...cbSel] : cb.fabrics.map((_, i) => i)).map(i => cb.fabrics[i])) : null;
  drawPaletteInto($('sash-corner'), !cb ? raw.corner || raw.fabric || 'b0' : picked.size === 1 ? [...picked][0] : null);
  const q = quiltMm(design);
  $('sash-note').textContent = s.mm
    ? `Finished quilt with sashing: ${q.W} × ${q.H} mm. Click the sashing on the quilt to come back here.`
    : 'Choose a width to add strips of fabric between the blocks.';
}
function setSash(patch) {
  dispatch(setSashing, patch);
  renderSashUI();
}
function openSashing() {
  showToolsPanel('sash');
}
function initSashUI() {
  $('sash-mm').addEventListener('change', e => {
    const v = Math.max(0, Math.min(200, Math.round(+e.target.value || 0)));
    setSash({ mm: v });
  });
  $('sash-presets').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setSash({ mm: +b.dataset.v });
  });
  $('sash-border').addEventListener('change', e => setSash({ border: e.target.checked }));
  $('sash-cs').addEventListener('change', e => setSash({ cornerstones: e.target.checked }));
  $('sash-fabs').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (b) setSash({ fabric: b.dataset.f, ...(design.sashing && design.sashing.mm ? {} : { mm: 50 }) });
  });
  $('sash-cpats').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const p = b.dataset.p,
      cur = sashOf(design).cornerBlock;
    if ((cur ? cur.pattern : '') === p) return;
    cbSel = new Set();
    if (!p) return setSash({ cornerBlock: undefined });
    // a new pattern starts in the colours its button shows (cream, indigo, mustard by role): carrying the old
    // block's colours over gave a muddle when it was all one fabric
    setSash({ cornerBlock: newBlock(p) });
  });
  $('sash-cb').addEventListener('click', e => {
    const cb = sashOf(design).cornerBlock;
    if (!cb) return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    const hit = blockPolys(cb, 0, 0, 1, 1).findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) cbSel.has(hit) ? cbSel.delete(hit) : cbSel.add(hit);
    else cbSel = cbSel.size === 1 && cbSel.has(hit) ? new Set() : new Set([hit]);
    renderSashUI();
  });
  $('sash-corner').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (!b) return;
    const cb = sashOf(design).cornerBlock;
    if (cb)
      setSash({
        cornerBlock: { ...cb, fabrics: cb.fabrics.map((f, i) => (!cbSel.size || cbSel.has(i) ? b.dataset.f : f)) },
      });
    else setSash({ corner: b.dataset.f, ...(design.sashing && design.sashing.mm ? {} : { mm: 50 }) });
  });
}
initSashUI();
onFabricsLoaded(() => {
  if (design && !$('sash-card').hidden) renderSashUI();
});

export { openSashing, renderSashUI };
