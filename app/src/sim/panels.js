// Show / hide panels of the Simulation page.
import '../timeline/timeline.js'; // load order: runs after timeline/timeline
import { $ } from '../core/dom.js';
import { resize } from './camera.js';
import { fitSimSide } from '../app/layout.js';

// 3D view: the scenario / display / pointer buttons are hidden until asked for
(function initStageControls() {
  const stage = $('stage'),
    btn = $('stage-ctl'),
    KEY = 'quilt-stage-ctl.v1';
  let shown = false;
  try {
    shown = localStorage.getItem(KEY) === '1';
  } catch (e) {}
  const set = v => {
    shown = v;
    stage.dataset.ctl = v ? 'shown' : 'hidden';
    btn.textContent = v ? 'Hide controls' : 'Show controls';
    btn.setAttribute('aria-expanded', String(v));
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch (e) {}
  };
  btn.addEventListener('click', () => set(!shown));
  set(shown);
})();

// Run options card: hidden until "More options"
const simPanels = { run: false, adv: false };
function updateSimSide() {
  const side = $('sim-side'),
    any = simPanels.run || simPanels.adv;
  side.hidden = !any;
  $('bench').classList.toggle('one', !any);
  $('run-card').hidden = !simPanels.run;
  requestAnimationFrame(() => {
    resize();
    fitSimSide();
  });
}
(function initRunMore() {
  const btn = $('run-more');
  const set = v => {
    simPanels.run = v;
    btn.textContent = v ? 'Fewer options' : 'More options';
    btn.setAttribute('aria-expanded', String(v));
    updateSimSide();
  };
  btn.addEventListener('click', () => set(!simPanels.run));
  set(false); // always starts closed
})();

// simulation page: the advanced cards (photo render, measurements, analysis, fabric physics) are hidden behind one button
(function initAdvanced() {
  const side = $('sim-side'),
    btn = $('sim-adv');
  let shown = false; // always starts hidden
  const set = v => {
    shown = v;
    side.dataset.adv = v ? 'shown' : 'hidden';
    simPanels.adv = v;
    btn.textContent = v ? 'Hide advanced settings' : 'Show advanced settings';
    btn.title = 'Photo render, measurements, final-state analysis and fabric physics';
    btn.setAttribute('aria-expanded', String(v));
    if (typeof updateSimSide === 'function') updateSimSide();
  };
  btn.addEventListener('click', () => set(!shown));
  set(shown);
})();
