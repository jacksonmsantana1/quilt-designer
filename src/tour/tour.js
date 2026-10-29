// Guided tour for first-time users.
import '../designer/settings.js'; // load order: runs after designer/settings
import { design, focusBlock, mineCur, selBlocks, selParts, setMineCur } from '../core/store.js';
import { hideTools, toolsPanel } from '../designer/ui-state.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { IS_PHONE } from '../sim/renderer.js';
import { initFabricLib } from '../designer/fabric-library.js';
import { bordersOf } from '../core/geometry.js';
import { blockKey } from '../designer/block-library.js';
import { showPage } from '../app/pages.js';
import { mineSave } from '../mine/my-designs.js';
import { tl, tlCopy, tlKeyFor, tlSwitch } from '../timeline/timeline.js';
import { defaultDesign } from '../core/design.js';
import { ensureDesign, openDesign, replaceDesign } from '../designer/dispatch.js';

// ---- guided tour: a short exercise for first-time users. Every control is greyed out and switched
// off except the ones the current step needs; the step moves on by itself once it has been done.
const TOUR_KEY = 'quilt-tour.v1';
const tour = { on: false, i: 0, poll: 0, saved: null, savedCur: null, mark: null };
const blk = i => design && design.blocks[i];
const TOUR = [
  {
    title: 'Welcome to the Quilt designer!',
    text: 'In about two minutes you will make a <b>quilt of three blocks</b> in the Quilt designer, change its pattern and fabrics and add a border. Only the button you need lights up at each step.',
    center: true,
    buttons: [
      ['Start the exercise', 'next', true],
      ['Not now', 'skip'],
    ],
  },
  {
    title: 'Fewer columns',
    text: 'A new quilt starts with 5 × 5 blocks. Above the quilt, click the <b>−</b> next to <b>Columns</b> until there are <b>3</b> columns.',
    allow: ['[data-step="c:-1"]', '#dz-cols'],
    glow: '[data-step="c:-1"]',
    done: () => design.cols === 3,
  },
  {
    title: 'Just one row',
    text: 'Now click the <b>−</b> next to <b>Rows</b> until there is <b>1</b> row. Your quilt is now three blocks side by side.',
    allow: ['[data-step="r:-1"]', '#dz-rows'],
    glow: '[data-step="r:-1"]',
    done: () => design.rows === 1,
  },
  {
    title: 'Open the middle block',
    text: '<b>Click the middle block</b> of your quilt. The side panel opens with its editor.',
    allow: ['#dz-quilt'],
    glow: '#dz-quilt',
    done: () => !$('dz-side').hidden && focusBlock === 1 && selBlocks.size === 1,
  },
  {
    title: 'Choose a pattern',
    text: 'Under <b>Block pattern</b> at the end of the Block parts card, click <b>Pinwheel</b>.',
    allow: ['#dz-patterns'],
    glow: '#dz-patterns [data-p="pinwheel"]',
    done: () => blk(1).pattern === 'pinwheel',
  },
  {
    title: 'Pick a piece',
    text: 'In the big picture of the block at the top of the side panel, <b>click one of the blades</b> of the pinwheel to select it.',
    allow: ['#dz-block'],
    glow: '#dz-block',
    done: () => selParts.size > 0,
  },
  {
    title: 'Give it a fabric',
    text: 'Now click a fabric under <b>Fabric for the selected parts</b>, for example <b>Mustard cotton</b> (any fabric different from the one it has). The piece changes right away.',
    allow: ['#dz-fabrics2'],
    glow: '#dz-fabrics2',
    done: s => blk(1).fabrics.join() !== s.f,
    start: () => ({ f: blk(1).fabrics.join() }),
  },
  {
    title: 'Select all three blocks',
    text: 'Press and <b>drag a rectangle</b> across the whole quilt, from one end to the other. Every block it touches is selected.',
    allow: ['#dz-quilt'],
    glow: '#dz-quilt',
    done: () => selBlocks.size === 3,
  },
  {
    title: 'Copy your block',
    text: 'In the side panel, under <b>Blocks in your quilt</b>, click the <b>Pinwheel</b>. All three blocks become a copy of it.',
    allow: ['#dz-library'],
    glow: '#dz-library',
    done: () => design.blocks.every(b => b.pattern === 'pinwheel' && blockKey(b) === blockKey(blk(1))),
  },
  {
    title: 'Close the side panel',
    text: 'Click the highlighted <b>round button</b> beside the quilt (Block parts) again to close the side panel and see the whole quilt.',
    allow: ['#rail-parts'],
    glow: '#rail-parts',
    done: () => $('dz-side').hidden,
  },
  {
    title: 'Go back in time',
    text: 'Changed your mind? Press the <b>←</b> arrow key on your keyboard. The timeline opens at the bottom of the page and steps back one change.',
    allow: ['#tl-panel'],
    done: s => tl.i < s.i,
    start: () => ({ i: tl.i }),
  },
  {
    title: 'And forward again',
    text: 'Now press the <b>→</b> arrow key to bring the change back. Later, double-click an empty part of the page to close the timeline.',
    allow: ['#tl-panel'],
    done: s => tl.i > s.i,
    start: () => ({ i: tl.i }),
  },
  {
    title: 'Open the borders',
    text: 'Click the <b>Borders</b> round button beside the quilt — the one with a frame drawn on it.',
    allow: ['#rail-brd'],
    glow: '#rail-brd',
    done: () => !$('dz-side').hidden && toolsPanel === 'brd',
  },
  {
    title: 'Add a border',
    text: 'In the <b>Borders</b> card, click <b>Piano keys</b> to frame your quilt.',
    allow: ['#brd-types'],
    glow: '.brd-type[data-t="piano"]',
    done: () => bordersOf(design).length > 0,
  },
  {
    title: 'Well done!',
    text: 'You made a three-block quilt, changed a block, copied it, used undo and redo and added a border. Every change also appears on the bed in <b>Simulation</b>. Keep this quilt, or go back to the one you had before. Restart the tour any time with <b>? Guided tour</b>.',
    center: true,
    buttons: [
      ['Keep this quilt', 'keep', true],
      ['Go back to my previous quilt', 'restore'],
    ],
  },
];
function tourAllowed(el) {
  return !!(el && el.closest && (el.closest('#tour') || el.closest('.tour-allow')));
}
function tourBlock(e) {
  if (!tour.on || tourAllowed(e.target)) return;
  if (
    e.type === 'keydown' &&
    !['Enter', ' ', 'Escape'].includes(e.key) &&
    !((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key))
  )
    return; // reading and scrolling keys still work
  e.preventDefault();
  e.stopImmediatePropagation();
}
for (const ev of [
  'pointerdown',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'keydown',
  'change',
  'input',
  'contextmenu',
  'touchstart',
])
  document.addEventListener(ev, tourBlock, true);
for (const id of ['dz-dialog', 'dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop'])
  $(id).addEventListener('cancel', e => {
    if (tour.on && !(TOUR[tour.i].allow || []).includes('#dz-done')) e.preventDefault();
  });
function tourHost() {
  // the tour card must sit inside an open modal pop-up, or it would be blocked by it
  for (const id of ['dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop', 'dz-dialog']) {
    const d = $(id);
    if (d && d.open) return d;
  }
  return document.body;
}
// Place the card where it covers the least of what the user needs: the quilt, the open pop-up, the
// controls of this step, the toolbar and side panel. It can also be dragged by its top line, or folded.
function tourPlace() {
  const box = $('tour'),
    st = TOUR[tour.i],
    host = tourHost();
  if (box.parentElement !== host) host.appendChild(box);
  box.classList.toggle('center', !!st.center && !tour.userPos);
  const W = innerWidth,
    H = innerHeight,
    bw = box.offsetWidth,
    bh = box.offsetHeight,
    m = 12;
  const clampXY = (x, y) => [Math.max(m, Math.min(W - bw - m, x)), Math.max(m, Math.min(H - bh - m, y))];
  if (tour.userPos) {
    const [x, y] = clampXY(tour.userPos[0], tour.userPos[1]);
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    return;
  }
  if (st.center) {
    box.style.left = box.style.top = '';
    return;
  }
  const rectOf = el => {
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? r : null;
  };
  const tg = st.glow && document.querySelector(st.glow),
    T = rectOf(tg);
  const keep = []; // [rect, weight]
  if (T) keep.push([T, 12]);
  document.querySelectorAll('.tour-allow').forEach(el => {
    const r = rectOf(el);
    if (r) keep.push([r, 8]);
  });
  for (const sel of ['#dz-quilt', '#dz-size2', '#dz-size']) {
    const r = rectOf(document.querySelector(sel));
    if (r) keep.push([r, 3]);
  }
  if (host !== document.body) {
    const r = rectOf(host);
    if (r) keep.push([r, 6]);
  }
  const side = $('dz-side');
  if (side && !side.hidden) {
    const r = rectOf(side);
    if (r) keep.push([r, 2]);
  }
  const bar = $('tl-panel'),
    barTop = bar && !bar.hidden ? bar.getBoundingClientRect().top : H;
  const cands = [
    [m, m + 60],
    [W - bw - m, m + 60],
    [m, barTop - bh - m],
    [W - bw - m, barTop - bh - m],
    [m, (H - bh) / 2],
    [W - bw - m, (H - bh) / 2],
  ];
  if (T)
    cands.push(
      [T.right + 14, T.top + T.height / 2 - bh / 2],
      [T.left - 14 - bw, T.top + T.height / 2 - bh / 2],
      [T.left + T.width / 2 - bw / 2, T.bottom + 14],
      [T.left + T.width / 2 - bw / 2, T.top - 14 - bh],
    );
  let best = null;
  for (const c of cands) {
    const [x, y] = clampXY(c[0], c[1]);
    let cost = 0;
    for (const [r, w] of keep) {
      const ox = Math.max(0, Math.min(x + bw, r.right) - Math.max(x, r.left)),
        oy = Math.max(0, Math.min(y + bh, r.bottom) - Math.max(y, r.top));
      cost += ox * oy * w;
    }
    if (y + bh > barTop) cost += (y + bh - barTop) * bw * 4; // keep the timeline strip clear
    if (T) cost += Math.hypot(x + bw / 2 - (T.left + T.width / 2), y + bh / 2 - (T.top + T.height / 2)) * 2; // then: as close to the target as possible
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  box.style.left = best.x + 'px';
  box.style.top = best.y + 'px';
}
function initTourDrag() {
  const head = document.querySelector('#tour .tour-head');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const box = $('tour'),
      r = box.getBoundingClientRect(),
      dx = e.clientX - r.left,
      dy = e.clientY - r.top;
    box.classList.remove('center');
    head.setPointerCapture(e.pointerId);
    const move = ev => {
      tour.userPos = [ev.clientX - dx, ev.clientY - dy];
      tourPlace();
    };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
  $('tour-min').addEventListener('click', () => {
    const box = $('tour');
    box.classList.toggle('min');
    $('tour-min').textContent = box.classList.contains('min') ? '▢' : '–';
    $('tour-min').title = box.classList.contains('min') ? 'Show the instructions' : 'Fold the instructions';
    tourPlace();
  });
}
function tourMark() {
  document.querySelectorAll('.tour-allow').forEach(el => el.classList.remove('tour-allow'));
  document.querySelectorAll('.tour-glow').forEach(el => el.classList.remove('tour-glow'));
  if (!tour.on) return;
  const st = TOUR[tour.i];
  for (const sel of st.allow || []) document.querySelectorAll(sel).forEach(el => el.classList.add('tour-allow'));
  const g = st.glow && document.querySelector(st.glow);
  if (g) g.classList.add('tour-glow');
}
function tourShow() {
  const st = TOUR[tour.i];
  $('tour-count').textContent = st.center ? 'Guided tour' : `Step ${tour.i} of ${TOUR.length - 2}`;
  $('tour-title').textContent = st.title;
  $('tour-text').innerHTML = st.text;
  $('tour-prog').style.width = `${Math.round((tour.i / (TOUR.length - 1)) * 100)}%`;
  const acts = $('tour-actions');
  acts.innerHTML = '';
  for (const [label, act, primary] of st.buttons || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.addEventListener('click', () => tourAct(act));
    acts.appendChild(b);
  }
  $('tour-skip').hidden = tour.i === TOUR.length - 1;
  if (st.enter) st.enter();
  tour.mark = st.start ? st.start() : null;
  tourMark();
  const g = st.glow && document.querySelector(st.glow);
  if (g) g.scrollIntoView({ block: 'center', inline: 'nearest' });
  requestAnimationFrame(tourPlace);
  if (st.buttons) acts.querySelector('button').focus();
}
function tourTick() {
  if (!tour.on) return;
  const st = TOUR[tour.i];
  tourMark();
  tourPlace();
  if (st.done && st.done(tour.mark || {})) {
    tour.i++;
    tourShow();
  }
}
function tourBegin() {
  if (tour.on) return;
  tour.saved = design ? JSON.stringify(design) : null;
  tour.savedCur = typeof mineCur !== 'undefined' ? mineCur : null;
  tour.on = true;
  tour.i = 0;
  tour.userPos = null;
  document.body.classList.add('tour-active');
  for (const id of ['dz-dialog', 'dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop']) if ($(id).open) $(id).close();
  if (state.page !== 'design') showPage('design');
  hideTools();
  // the tour always starts from the same default quilt (5 × 5, 458 mm, Ohio star and nine patch), with its
  // own timeline; the user's own quilt is put aside and comes back if they skip or ask for it at the end
  const fresh = () => {
    try {
      localStorage.removeItem(tlKeyFor('tour'));
    } catch (e) {}
    replaceDesign(defaultDesign(), { timeline: 'tour' });
  };
  if (design) fresh();
  else
    (async () => {
      await initFabricLib();
      ensureDesign();
      fresh();
    })();
  $('tour').hidden = false;
  tourShow();
  clearInterval(tour.poll);
  tour.poll = setInterval(tourTick, 200);
}
function tourAct(act) {
  if (act === 'next') {
    tour.i = 1;
    tourShow();
    return;
  }
  if (act === 'skip') {
    tourEnd('restore');
    return;
  }
  tourEnd(act);
}
function tourEnd(how) {
  tour.on = false;
  clearInterval(tour.poll);
  document.body.classList.remove('tour-active');
  tourMark();
  const box = $('tour');
  box.hidden = true;
  document.body.appendChild(box);
  try {
    localStorage.setItem(TOUR_KEY, 'done');
  } catch (e) {}
  for (const id of ['dz-dialog', 'dz-partdlg']) if ($(id).open) $(id).close();
  if (how === 'keep') {
    // the tour quilt becomes an ordinary unsaved design, with its history
    tlCopy('tour', null);
    setMineCur(null);
    mineSave();
    tlSwitch(null);
  } else if (how === 'restore' && tour.saved) {
    setMineCur(tour.savedCur);
    mineSave();
    openDesign(tour.saved, { timeline: mineCur, quiet: true });
  }
  try {
    localStorage.removeItem(tlKeyFor('tour'));
  } catch (e) {}
  showPage('design');
}
$('tour-start').addEventListener('click', tourBegin);
initTourDrag();
$('tour-skip').addEventListener('click', () => tourAct('skip'));
window.addEventListener('resize', () => {
  if (tour.on) tourPlace();
});
document.addEventListener(
  'scroll',
  () => {
    if (tour.on) tourPlace();
  },
  true,
);
// first visit: offer the tour once the designer is ready
setTimeout(() => {
  let seen = null;
  try {
    seen = localStorage.getItem(TOUR_KEY);
  } catch (e) {}
  if (!seen && !IS_PHONE && state.page === 'design') tourBegin();
}, 1200);
