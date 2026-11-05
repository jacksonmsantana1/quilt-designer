// The mm / in slide switch beside Layout: which unit lengths are shown and typed in, kept on this device. The quilt
// itself stays in millimetres (core/units.js); a change redraws the designer, and the page you are on.
import './settings.js'; // load order: runs after designer/settings
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { FRACTIONS, eighthsOf, getUnit, len, onUnitChange, setUnit, unitName } from '../core/units.js';
import { comma, t } from '@quilt/shared/i18n.js';
import { state } from '../sim/config.js';
import { renderDesigner } from './parts-editor.js';
import { renderCut } from '../cutting/page.js';
import { renderMine } from '../mine/my-designs.js';

const KEY = 'quilt-unit.v1';
try {
  setUnit(localStorage.getItem(KEY) === 'in' ? 'in' : 'mm');
} catch (e) {}

// the cutting guide's choices are in mm; in inches they are written in inches (the value stays millimetres)
const SEAM_IN = {
  6: t('0.24 in'),
  6.4: t('¼ in (6.4 mm)'),
  7: t('0.28 in'),
  7.5: t('0.30 in'),
  10: t('0.39 in'),
};
function relabelCuttingOptions() {
  const inches = getUnit() === 'in';
  for (const o of $('cg-seam').options)
    o.textContent = inches ? SEAM_IN[o.value] || len(+o.value) : `${comma(o.value)} mm`;
  for (const o of $('cg-binding').options) o.textContent = len(+o.value);
}

/** The fixed sentences about lengths in the bed card. */
function relabelHints() {
  $('tuck-len').textContent = len(250);
  $('fit-hint').textContent = t(
    'Drop: about {a}–{b} covers the mattress, {c}–{d} the box spring too; floor length is the mattress-top height.',
    { a: len(250), b: len(300), c: len(450), d: len(550) },
  );
}

// ---- length boxes in inches: a whole number and a fraction menu (⅛ … ⅞), the way quilters measure, instead of
// decimals. Every number box marked data-len gets a pair beside it; in inches the pair shows and the box hides. The
// box keeps the full value (whole + fraction) and fires its own change event, so the code that reads it is the
// same in both units; when that code writes the box, the pair follows.
const VALUE = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'));
/** @type {(() => void)[]} */
const inchFields = [];
/**
 * A number box whose first digit after getting the focus replaces what is there. Moving in it first keeps it.
 * @param {HTMLInputElement} el @param {() => void} [also] what else starts afresh
 */
function replaceOnTyping(el, also) {
  let fresh = false;
  el.addEventListener('focus', () => (fresh = true));
  el.addEventListener('keydown', e => {
    if (fresh && /^[0-9]$/.test(e.key)) {
      el.value = '';
      if (also) also();
    }
    fresh = false;
  });
}
/** @param {HTMLInputElement} box */
function inchPair(box) {
  if (box.dataset.inchPair) return;
  box.dataset.inchPair = '1';
  const name = box.getAttribute('aria-label') || box.title || t('Length');
  const whole = document.createElement('input');
  whole.type = 'number';
  whole.className = `${box.className} inch-whole`.trim();
  whole.inputMode = 'numeric';
  whole.step = '1';
  whole.min = '0';
  whole.setAttribute('aria-label', t('{name}: whole inches', { name }));
  const frac = document.createElement('select');
  frac.className = 'inch-frac';
  frac.setAttribute('aria-label', t('{name}: fraction of an inch', { name }));
  FRACTIONS.forEach((f, i) => frac.add(new Option(f || '0', String(i))));
  const pair = document.createElement('span');
  pair.className = 'inch-pair';
  pair.append(whole, frac);
  box.after(pair);
  const sync = () => {
    const inches = getUnit() === 'in';
    box.hidden = inches;
    pair.hidden = !inches;
    if (!inches) return;
    const [w, e] = eighthsOf(+VALUE.get.call(box));
    // not while the person is typing in it
    if (document.activeElement !== whole) whole.value = String(w);
    frac.value = String(e);
    if (box.max) whole.max = String(Math.floor(+box.max));
  };
  // the code that fills the box (toInput) moves the pair too
  Object.defineProperty(box, 'value', {
    configurable: true,
    get() {
      return VALUE.get.call(this);
    },
    set(v) {
      VALUE.set.call(this, v);
      sync();
    },
  });
  // typing into "11" would make 1112, which the box would refuse without a word: the first digit replaces it
  replaceOnTyping(whole, () => (frac.value = '0'));
  replaceOnTyping(box);
  const send = () => {
    VALUE.set.call(box, String((+whole.value || 0) + +frac.value / 8));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  };
  whole.addEventListener('change', send);
  frac.addEventListener('change', send);
  inchFields.push(sync);
  sync();
}
for (const el of document.querySelectorAll('input[data-len]')) inchPair(/** @type {HTMLInputElement} */ (el));
// boxes made later (a border's width, made when the border is added)
new MutationObserver(recs => {
  for (const r of recs)
    for (const n of r.addedNodes)
      if (n instanceof HTMLElement)
        for (const el of n.matches('input[data-len]') ? [n] : n.querySelectorAll('input[data-len]'))
          inchPair(/** @type {HTMLInputElement} */ (el));
}).observe(document.body, { childList: true, subtree: true });

function show() {
  const inches = getUnit() === 'in';
  /** @type {HTMLInputElement} */ ($('unit-sw')).checked = inches;
  $('unit-lbl').dataset.unit = getUnit();
  for (const el of document.querySelectorAll('[data-unit-name]')) el.textContent = unitName();
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
  inchFields.forEach(f => f()); // the pairs show or hide (their boxes are filled again just below)
  if (!design) return;
  renderDesigner();
  if (state.page === 'cut') renderCut();
  else if (state.page === 'mine') renderMine();
});
