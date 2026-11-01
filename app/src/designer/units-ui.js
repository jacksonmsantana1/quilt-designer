// The mm / in slide switch beside Layout: which unit lengths are shown and typed in, kept on this device. The quilt
// itself stays in millimetres (core/units.js); a change redraws the designer, and the page you are on.
import './settings.js'; // load order: runs after designer/settings
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { getUnit, len, onUnitChange, setUnit } from '../core/units.js';
import { state } from '../sim/config.js';
import { renderDesigner } from './parts-editor.js';
import { renderCut } from '../cutting/page.js';
import { renderMine } from '../mine/my-designs.js';

const KEY = 'quilt-unit.v1';
try {
  setUnit(localStorage.getItem(KEY) === 'in' ? 'in' : 'mm');
} catch (e) {}

// the cutting guide's choices are in mm; in inches they are written in inches (the value stays millimetres)
const SEAM_IN = { 6: '0.24 in', 6.4: '¼ in (6.4 mm)', 7: '0.28 in', 7.5: '0.30 in', 10: '0.39 in' };
function relabelCuttingOptions() {
  const inches = getUnit() === 'in';
  for (const o of $('cg-seam').options) o.textContent = inches ? SEAM_IN[o.value] || len(+o.value) : `${o.value} mm`;
  for (const o of $('cg-binding').options) o.textContent = len(+o.value);
}

/** The fixed sentences about lengths in the bed card. */
function relabelHints() {
  $('tuck-len').textContent = len(250);
  $('fit-hint').textContent =
    `Drop: about ${len(250)}–${len(300)} covers the mattress, ${len(450)}–${len(550)} the box spring too; floor length is the mattress-top height.`;
}

function show() {
  const inches = getUnit() === 'in';
  /** @type {HTMLInputElement} */ ($('unit-sw')).checked = inches;
  $('unit-lbl').dataset.unit = getUnit();
  for (const el of document.querySelectorAll('[data-unit-name]')) el.textContent = getUnit();
  relabelCuttingOptions();
  relabelHints();
}
show();
$('unit-sw').addEventListener('change', e => setUnit(/** @type {HTMLInputElement} */ (e.target).checked ? 'in' : 'mm'));
onUnitChange(() => {
  try {
    localStorage.setItem(KEY, getUnit());
  } catch (e) {}
  show();
  if (!design) return;
  renderDesigner();
  if (state.page === 'cut') renderCut();
  else if (state.page === 'mine') renderMine();
});
