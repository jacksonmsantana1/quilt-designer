// Side-panel cards that open and close from their title.
import '../designer/pattern-picker.js';          // load order: runs after designer/pattern-picker
import { $ } from '../core/dom.js';

// ---- side-panel cards open and close from their title (remembered in this browser)
const FOLD_KEY = 'quilt-folds.v1';
let folds = {};
 try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) {}
function setFold(card, key, folded) {
  card.classList.toggle('folded', folded);
  const head = card.querySelector('.fold-head'); if (head) head.setAttribute('aria-expanded', String(!folded));
  folds[key] = folded; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
}
function makeFoldable(card, head, key) {
  head.classList.add('fold-head'); head.tabIndex = 0; head.setAttribute('role', 'button');
  head.title = 'Click to open or close';
  const toggle = () => setFold(card, key, !card.classList.contains('folded'));
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  card.classList.toggle('folded', !!folds[key]); head.setAttribute('aria-expanded', String(!folds[key]));
}
function initFolds() {
  // only the Simulation side cards fold; the Quilt designer side panel cards always stay open (no fold arrow)
  for (const card of document.querySelectorAll('#sim-side > .card')) {
    const h = card.querySelector(':scope > h2'); if (!h) continue;
    makeFoldable(card, h, 'sim:' + h.textContent.trim().toLowerCase());
  }
  for (const card of document.querySelectorAll('#dz-side > .card')) card.classList.remove('folded');
}
function syncPartsTitle() {
  const title = $('dz-dialog-title');
  title.classList.remove('fold-head'); title.removeAttribute('tabindex'); title.removeAttribute('role'); title.removeAttribute('title'); title.removeAttribute('aria-expanded');
}
initFolds();

export { setFold, syncPartsTitle };
