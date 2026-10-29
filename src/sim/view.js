// Switching between the live preview, the photo render and the analysis view.
import './photo-render.js';          // load order: runs after sim/photo-render
import { $ } from '../core/dom.js';
import { state } from './config.js';
import { applyLook } from './lighting.js';
import { setAnalysis } from './analysis.js';
import { startRender, stopRender } from './photo-render.js';

// ------------------------------------------------------------- view modes
function setView(v) {
  if (state.view === v) return;
  const prev = state.view;
  state.view = v;
  for (const b of $('views').children) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  if (prev === 'render') stopRender();
  setAnalysis(v === 'analysis');
  $('rstat').hidden = $('rbar').hidden = v !== 'render';
  $('hint').hidden = v !== 'photo';
  if (v === 'render') $('slow').hidden = true;
  $('stage').classList.toggle('rendering', v === 'render');
  if (v === 'render') startRender(); else applyLook();
}

export { setView };
