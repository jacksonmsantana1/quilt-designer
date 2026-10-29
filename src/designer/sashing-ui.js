// Sashing panel.
import '../cutting/page.js'; // load order: runs after cutting/page
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { saveDesign } from './design-state.js';
import { quiltMm, sashOf } from '../core/geometry.js';
import { drawPaletteInto, renderDesigner } from './parts-editor.js';

// ---- sashing settings
function renderSashUI() {
  if (!shared.design || !$('sash-card')) return;
  const s = sashOf(shared.design),
    raw = shared.design.sashing || {};
  if (document.activeElement !== $('sash-mm')) $('sash-mm').value = s.mm;
  $('sash-border').checked = !!raw.border;
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
  drawPaletteInto($('sash-corner'), raw.corner || raw.fabric || 'b0');
  const q = quiltMm(shared.design);
  $('sash-note').textContent = s.mm
    ? `Finished quilt with sashing: ${q.W} × ${q.H} mm. Click the sashing on the quilt to come back here.`
    : 'Choose a width to add strips of fabric between the blocks.';
}
function setSash(patch) {
  const cur = shared.design.sashing || { mm: 0, fabric: 'b0', corner: 'b3', border: false };
  shared.design.sashing = { ...cur, ...patch };
  if (!(shared.design.sashing.mm > 0)) shared.design.sashing.mm = 0;
  saveDesign();
  renderDesigner();
  renderSashUI();
}
function openSashing() {
  shared.showToolsPanel('sash');
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
  $('sash-fabs').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (b) setSash({ fabric: b.dataset.f, ...(shared.design.sashing && shared.design.sashing.mm ? {} : { mm: 50 }) });
  });
  $('sash-corner').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (b) setSash({ corner: b.dataset.f, ...(shared.design.sashing && shared.design.sashing.mm ? {} : { mm: 50 }) });
  });
}
initSashUI();

export { openSashing, renderSashUI };
