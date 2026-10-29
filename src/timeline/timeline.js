// Design timeline: undo, redo and the film strip.
import '../mine/samples.js'; // load order: runs after mine/samples
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { PATTERNS } from '../core/patterns.js';
import { fabricById } from '../designer/fabric-library.js';
import { saveDesign } from '../designer/design-state.js';
import { BORDER_TYPES, bordersOf, quiltMm, sashOf } from '../core/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { drawDesignerCanvas } from '../designer/canvas.js';
import { renderDesigner } from '../designer/parts-editor.js';

// ---- design timeline: every change is a step (the last 100 are kept in this browser);
// undo / redo, or jump to any step from the timeline strip.
const TL_KEY = 'quilt-timeline.v1',
  TL_MAX = 100;
var tlBarOn = false; // the timeline film strip opens with the arrow keys and closes on a double-click outside
const tl = { steps: [], i: -1, ready: false, restoring: false, timer: 0, thumbs: new Map(), seq: 0, key: '' };
// each design has its own timeline: saved designs by their id, the unsaved one as "draft"
const tlKeyFor = id => TL_KEY + ':' + (id || 'draft');
function tlSave() {
  const v = JSON.stringify({ steps: tl.steps, i: tl.i, seq: tl.seq });
  for (let tries = 0; tries < 8; tries++) {
    try {
      localStorage.setItem(tl.key, v);
      return;
    } catch (e) {
      // storage full: shorten the longest other timeline and try again
      let worst = null,
        size = 0;
      for (let k = 0; k < localStorage.length; k++) {
        const n = localStorage.key(k);
        if (n && n.startsWith(TL_KEY + ':') && n !== tl.key) {
          const l = (localStorage.getItem(n) || '').length;
          if (l > size) {
            size = l;
            worst = n;
          }
        }
      }
      if (!worst) return;
      try {
        const o = JSON.parse(localStorage.getItem(worst));
        if (o.steps.length <= 2) localStorage.removeItem(worst);
        else {
          const cut = Math.ceil(o.steps.length / 2);
          o.steps = o.steps.slice(cut);
          o.i = Math.max(0, o.i - cut);
          localStorage.setItem(worst, JSON.stringify(o));
        }
      } catch (e2) {
        localStorage.removeItem(worst);
      }
    }
  }
}
// switch to another design's timeline (loads it, or starts one)
function tlSwitch(id) {
  clearTimeout(tl.timer);
  if (tl.ready) tlSave();
  tl.key = tlKeyFor(id);
  tl.steps = [];
  tl.i = -1;
  tl.seq = 0;
  tl.ready = false;
  tl.thumbs.clear();
  tlEnsure();
}
// a design got a new id (first save, save as new, duplicate): give it a copy of a timeline
function tlCopy(fromId, toId, move) {
  try {
    const v =
      fromId === undefined
        ? JSON.stringify({ steps: tl.steps, i: tl.i, seq: tl.seq })
        : localStorage.getItem(tlKeyFor(fromId));
    if (v) localStorage.setItem(tlKeyFor(toId), v);
    if (move && fromId !== undefined) localStorage.removeItem(tlKeyFor(fromId));
  } catch (e) {}
}
function tlEnsure() {
  if (tl.ready || !shared.design) return;
  tl.ready = true;
  if (!tl.key) {
    tl.key = tlKeyFor(typeof shared.mineCur !== 'undefined' ? shared.mineCur : null);
    try {
      const old = localStorage.getItem(TL_KEY);
      if (old && !localStorage.getItem(tl.key)) localStorage.setItem(tl.key, old);
      localStorage.removeItem(TL_KEY);
    } catch (e) {} // timeline saved before designs had their own
  }
  try {
    const o = JSON.parse(localStorage.getItem(tl.key) || 'null');
    if (o && Array.isArray(o.steps) && o.steps.length) {
      tl.steps = o.steps;
      tl.i = Math.min(o.i, o.steps.length - 1);
      tl.seq = o.seq || o.steps.length;
    }
  } catch (e) {}
  const cur = JSON.stringify(shared.design);
  if (!tl.steps.length || tl.steps[tl.i].d !== cur) tlPush(cur, tl.steps.length ? 'Opened' : 'Start');
  tlUI();
}
function tlPush(d, label) {
  tl.steps = tl.steps.slice(0, tl.i + 1); // a change after going back starts a new branch
  tl.steps.push({ id: ++tl.seq, d, label, t: Date.now() });
  while (tl.steps.length > TL_MAX) tl.steps.shift();
  tl.i = tl.steps.length - 1;
  tlSave();
}
// changes arriving close together (typing a number, dragging) become one step
function tlRecord() {
  if (tl.restoring || !shared.design) return;
  tlEnsure();
  clearTimeout(tl.timer);
  tl.timer = setTimeout(tlCommit, 450);
}
function tlCommit() {
  // record the pending change now
  clearTimeout(tl.timer);
  tl.timer = 0;
  if (!shared.design || !tl.ready) return;
  const cur = JSON.stringify(shared.design),
    prev = tl.steps[tl.i];
  if (prev && prev.d === cur) return;
  tlPush(cur, tlDescribe(prev ? JSON.parse(prev.d) : null, shared.design));
  tlUI();
}
function tlDescribe(a, b) {
  if (!a) return 'Start';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (a.cols !== b.cols || a.rows !== b.rows) return `Layout ${b.cols} × ${b.rows}`;
  if (a.blockMm !== b.blockMm) return `Block size ${b.blockMm} mm`;
  if (a.backFabric !== b.backFabric) return `Backing: ${fabricById(b.backFabric).name}`;
  if (JSON.stringify(a.borders || []) !== JSON.stringify(b.borders || [])) {
    const na = bordersOf(a).length,
      nb = bordersOf(b).length;
    if (nb > na) return `Add border: ${BORDER_TYPES[bordersOf(b)[nb - 1].type].label}`;
    if (nb < na) return 'Remove border';
    return 'Change border';
  }
  if (JSON.stringify(a.sashing || null) !== JSON.stringify(b.sashing || null)) {
    const p = sashOf(a),
      s = sashOf(b);
    if (!s.mm) return 'No sashing';
    if (p.mm !== s.mm) return `Sashing ${s.mm} mm`;
    if (p.border !== s.border) return s.border ? 'Sashing border on' : 'Sashing border off';
    if (p.fabric !== s.fabric) return `Sashing: ${fabricById(s.fabric).name}`;
    return `Cornerstones: ${fabricById(s.corner).name}`;
  }
  let pat = 0,
    rot = 0,
    fab = 0;
  const newFabs = new Set(),
    patNames = new Set();
  b.blocks.forEach((x, i) => {
    const y = a.blocks[i];
    if (!y) return;
    if (x.pattern !== y.pattern) {
      pat++;
      patNames.add(PATTERNS[x.pattern].label);
      return;
    }
    if (x.rot !== y.rot) rot++;
    let ch = false;
    x.fabrics.forEach((f, k) => {
      if (f !== y.fabrics[k]) {
        ch = true;
        newFabs.add(f);
      }
    });
    if (ch) fab++;
  });
  if (pat) return `${patNames.size === 1 ? [...patNames][0] : 'Patterns'} in ${plural(pat, 'block')}`;
  if (fab) return `${newFabs.size === 1 ? fabricById([...newFabs][0]).name : 'Fabrics'} in ${plural(fab, 'block')}`;
  if (rot) return `Rotate ${plural(rot, 'block')}`;
  return 'Change';
}
function tlGo(i) {
  if (!tl.steps.length) return;
  i = Math.max(0, Math.min(tl.steps.length - 1, i));
  if (i === tl.i) return;
  clearTimeout(tl.timer);
  tl.i = i;
  tlSave();
  shared.design = JSON.parse(tl.steps[i].d);
  const n = shared.design.blocks.length;
  shared.selBlocks = new Set([Math.min(shared.focusBlock, n - 1)]);
  shared.focusBlock = [...shared.selBlocks][0];
  shared.selParts.clear();
  tl.restoring = true;
  saveDesign();
  renderDesigner();
  tl.restoring = false;
  tlUI();
}
function tlThumb(step) {
  if (tl.thumbs.has(step.id)) return tl.thumbs.get(step.id);
  const d = JSON.parse(step.d),
    S = 82,
    c = document.createElement('canvas'),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  const qq = quiltMm(d),
    w = qq.W >= qq.H ? S : Math.round((S * qq.W) / qq.H),
    h = qq.W >= qq.H ? Math.round((S * qq.H) / qq.W) : S;
  c.width = w * dpr;
  c.height = h * dpr;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const keep = shared.design;
  shared.design = d;
  try {
    drawQuilt(g, w, h);
  } finally {
    shared.design = keep;
  }
  tl.thumbs.set(step.id, c);
  if (tl.thumbs.size > 140) tl.thumbs.delete(tl.thumbs.keys().next().value);
  return c;
}
function tlUI() {
  const n = tl.steps.length;
  $('tl-undo').disabled = tl.i <= 0;
  $('tl-redo').disabled = tl.i >= n - 1;
  $('tl-open').textContent = `Timeline · ${tl.i + 1}/${n}`;
  if ($('tl-panel').hidden) return;
  $('tl-first').disabled = $('tl-back').disabled = tl.i <= 0;
  $('tl-last').disabled = $('tl-fwd').disabled = tl.i >= n - 1;
  const sl = $('tl-slider');
  sl.max = Math.max(0, n - 1);
  sl.value = tl.i;
  $('tl-pos').textContent = `${tl.i + 1} / ${n} · ${tl.steps[tl.i] ? tl.steps[tl.i].label : ''}`;
  const list = $('tl-list');
  list.innerHTML = '';
  const now = Date.now(),
    ago = t => {
      const s = Math.round((now - t) / 1000);
      return s < 60
        ? `${s}s ago`
        : s < 3600
          ? `${Math.round(s / 60)} min ago`
          : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
  tl.steps.forEach((st, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tl-step' + (k === tl.i ? ' cur' : '') + (k > tl.i ? ' future' : '');
    b.title = `Step ${k + 1}: ${st.label} · ${ago(st.t)}`;
    const num = document.createElement('span');
    num.className = 'n';
    num.textContent = `${k + 1}`;
    const lab = document.createElement('span');
    lab.className = 'l';
    lab.textContent = st.label;
    b.append(tlThumb(st), num, lab);
    b.addEventListener('click', () => tlGo(k));
    list.appendChild(b);
  });
  const cur = list.children[tl.i];
  if (cur) list.scrollLeft = cur.offsetLeft - list.clientWidth / 2 + cur.offsetWidth / 2;
}
function initTimeline() {
  $('tl-undo').addEventListener('click', () => tlGo(tl.i - 1));
  $('tl-redo').addEventListener('click', () => tlGo(tl.i + 1));
  const showBar = v => {
    const p = $('tl-panel');
    p.hidden = !v;
    $('tl-open').setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('tl-open', v);
    if (v) {
      tlUI();
      document.body.style.setProperty('--tl-h', p.offsetHeight + 'px');
    } else stopPlay();
    tlBarOn = v;
    if (state.page === 'design') drawDesignerCanvas();
  };
  tl.showBar = showBar;
  $('tl-open').addEventListener('click', () => showBar($('tl-panel').hidden));
  $('tl-close').addEventListener('click', () => showBar(false));
  $('tl-first').addEventListener('click', () => tlGo(0));
  $('tl-last').addEventListener('click', () => tlGo(tl.steps.length - 1));
  $('tl-back').addEventListener('click', () => tlGo(tl.i - 1));
  $('tl-fwd').addEventListener('click', () => tlGo(tl.i + 1));
  // play: runs through the history like a video, from the start (or from here) to the latest step
  let playT = 0;
  function stopPlay() {
    clearInterval(playT);
    playT = 0;
    $('tl-play').textContent = '▶';
    $('tl-play').setAttribute('aria-label', 'Play');
  }
  $('tl-play').addEventListener('click', () => {
    if (playT) {
      stopPlay();
      return;
    }
    if (tl.i >= tl.steps.length - 1) tlGo(0);
    $('tl-play').textContent = '❚❚';
    $('tl-play').setAttribute('aria-label', 'Pause');
    playT = setInterval(() => {
      if (tl.i >= tl.steps.length - 1) {
        stopPlay();
        return;
      }
      tlGo(tl.i + 1);
    }, 600);
  });
  // the wheel scrolls the film strip sideways
  $('tl-list').addEventListener(
    'wheel',
    e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        $('tl-list').scrollLeft += e.deltaY;
      }
    },
    { passive: false },
  );
  $('tl-slider').addEventListener('input', e => tlGo(+e.target.value));
  $('tl-clear').addEventListener('click', () => {
    if (!shared.design) return;
    tl.steps = [];
    tl.i = -1;
    tl.thumbs.clear();
    tlPush(JSON.stringify(shared.design), 'Start');
    tlUI();
  });
  // the undo / redo / Timeline buttons stay hidden until the left or right arrow key is pressed
  const row = $('tl-row');
  let rowT = 0;
  const hideRow = () => {
    clearTimeout(rowT);
    rowT = setTimeout(() => {
      if (row.matches(':hover') || row.contains(document.activeElement)) return hideRow();
      row.classList.add('tl-hidden');
    }, 5000);
  };
  document.addEventListener('keydown', e => {
    if (
      state.page !== 'design' ||
      (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      e.target.isContentEditable ||
      e.target.closest('[role="listbox"], #tl-panel')
    )
      return;
    e.preventDefault();
    if ($('tl-panel').hidden && tl.showBar) tl.showBar(true);
    if (shared.design) tlGo(tl.i + (e.key === 'ArrowRight' ? 1 : -1)); // the arrows step back and forth through the timeline
  });
  tl.hideRow = () => {
    clearTimeout(rowT);
    row.classList.add('tl-hidden');
  };
  row.addEventListener('pointerleave', hideRow);
  document.addEventListener('keydown', e => {
    if (state.page !== 'design' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      tlGo(tl.i - 1);
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault();
      tlGo(tl.i + 1);
    }
  });
}
initTimeline();
// the toolbar can wrap onto a second line (status text): refit the quilt when its height changes
new ResizeObserver(() => {
  if (state.page === 'design' && shared.design) drawDesignerCanvas();
}).observe($('dz-size'));

export { tl, tlBarOn, tlCommit, tlCopy, tlEnsure, tlGo, tlKeyFor, tlRecord, tlSave, tlSwitch, tlUI };
