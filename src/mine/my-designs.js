// My designs: saved quilts.
import '../tour/tour.js'; // load order: runs after tour/tour
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { quiltMm } from '../core/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { tl, tlCopy, tlKeyFor, tlSave } from '../timeline/timeline.js';
import { defaultDesign } from '../core/design.js';
import { replaceDesign } from '../designer/dispatch.js';

// ---- My designs: saved quilts, shown as a Pinterest-style masonry
const MINE_KEY = 'quilt-mydesigns.v1',
  MINE_CUR = 'quilt-mydesigns-current.v1';
let mine = [];
try {
  mine = JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
} catch (e) {}
shared.mineCur = null;
try {
  shared.mineCur = localStorage.getItem(MINE_CUR) || null;
} catch (e) {}
function mineSave() {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(mine));
    if (shared.mineCur) localStorage.setItem(MINE_CUR, shared.mineCur);
    else localStorage.removeItem(MINE_CUR);
  } catch (e) {
    alertMine('Your browser storage is full: delete a design to save new ones.');
  }
}
function alertMine(t) {
  const el = $('mine-empty');
  el.textContent = t;
  el.hidden = false;
}
function quiltPicture(d, width) {
  const qq = quiltMm(d),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = width,
    h = Math.round((width * qq.H) / qq.W);
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, w, h, { seams: true, design: d });
  g.strokeStyle = '#2f466f';
  g.lineWidth = Math.max(2, w * 0.012);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  return c;
}
let saveForceNew = false;
function openSaveDialog(forceNew) {
  if (!shared.design) return;
  saveForceNew = !!forceNew;
  const cur = !saveForceNew && mine.find(m => m.id === shared.mineCur);
  $('save-name').value = cur ? cur.name : `Quilt ${mine.length + 1}`;
  $('save-title').textContent = cur ? 'Save changes' : 'Save design';
  $('save-asnew').hidden = !cur;
  const pic = quiltPicture(shared.design, 300),
    cv = $('save-cv');
  cv.width = pic.width;
  cv.height = pic.height;
  cv.style.width = '300px';
  cv.getContext('2d').drawImage(pic, 0, 0);
  const d = $('save-dlg');
  if (!d.open) {
    try {
      d.showModal();
    } catch (e) {
      d.setAttribute('open', '');
    }
  }
  $('save-name').select();
}
function doSave(asNew) {
  const name = ($('save-name').value || '').trim() || `Quilt ${mine.length + 1}`,
    now = Date.now(),
    d = JSON.stringify(shared.design);
  let cur = !asNew && !saveForceNew && mine.find(m => m.id === shared.mineCur);
  const prev = shared.mineCur;
  if (cur) {
    cur.name = name;
    cur.d = d;
    cur.updated = now;
  } else {
    cur = { id: 'q' + now.toString(36) + Math.random().toString(36).slice(2, 5), name, d, created: now, updated: now };
    mine.push(cur);
    // the new design takes the timeline so far (an unsaved draft's moves over; a saved design keeps its own too)
    tlCopy(undefined, cur.id);
    if (!prev) {
      try {
        localStorage.removeItem(tlKeyFor(null));
      } catch (e) {}
    }
    tl.key = tlKeyFor(cur.id);
  }
  saveForceNew = false;
  shared.mineCur = cur.id;
  mineSave();
  $('save-dlg').close();
  const b = $('dz-save');
  b.classList.add('saved');
  b.title = 'Saved ✓';
  setTimeout(() => {
    b.classList.remove('saved');
    b.title = 'Save this quilt to My designs';
  }, 1600);
}
function openMine(id) {
  const m = mine.find(x => x.id === id);
  if (!m) return;
  shared.mineCur = id;
  mineSave();
  replaceDesign(JSON.parse(m.d), { timeline: id });
  showPage('design');
}
function renderMine() {
  const grid = $('mine-grid'),
    q = ($('mine-q').value || '').trim().toLowerCase(),
    sort = $('mine-sort').value;
  let list = mine.filter(m => !q || m.name.toLowerCase().includes(q));
  list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b[sort] - a[sort]);
  grid.innerHTML = '';
  $('mine-empty').hidden = mine.length > 0 && list.length > 0;
  if (mine.length && !list.length) $('mine-empty').textContent = 'No designs match your search.';
  else
    $('mine-empty').innerHTML = 'No saved designs yet. In the Quilt designer, press <b>Save</b> to keep a quilt here.';
  const when = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  for (const m of list) {
    let d;
    try {
      d = JSON.parse(m.d);
    } catch (e) {
      continue;
    }
    const pin = document.createElement('article');
    pin.className = 'pin' + (m.id === shared.mineCur ? ' current' : '');
    const img = document.createElement('div');
    img.className = 'img';
    img.title = 'Open in the Quilt designer';
    img.appendChild(quiltPicture(d, 260));
    const over = document.createElement('div');
    over.className = 'over';
    over.innerHTML =
      '<button class="open" type="button">Open</button><button class="ic" type="button" data-a="rename" title="Rename" aria-label="Rename">✎</button><button class="ic" type="button" data-a="dup" title="Duplicate" aria-label="Duplicate">⧉</button><button class="ic" type="button" data-a="del" title="Delete" aria-label="Delete">🗑</button>';
    img.appendChild(over);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const nm = document.createElement('b');
    nm.textContent = m.name;
    const sm = document.createElement('small');
    sm.textContent = `${d.cols} × ${d.rows} blocks · ${quiltMm(d).W} × ${quiltMm(d).H} mm · ${when(m.updated)}`;
    meta.append(nm, sm);
    pin.append(img, meta);
    grid.appendChild(pin);
    img.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) {
        openMine(m.id);
        return;
      }
      if (a === 'rename') {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = m.name;
        inp.maxLength = 60;
        inp.style.width = '100%';
        nm.replaceWith(inp);
        inp.focus();
        inp.select();
        const done = () => {
          m.name = inp.value.trim() || m.name;
          mineSave();
          renderMine();
        };
        inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') done();
          if (ev.key === 'Escape') renderMine();
        });
        inp.addEventListener('blur', done);
      } else if (a === 'dup') {
        const now = Date.now(),
          nid = 'q' + now.toString(36) + Math.random().toString(36).slice(2, 5);
        mine.push({ ...m, id: nid, name: m.name + ' (copy)', created: now, updated: now });
        tlCopy(m.id, nid);
        mineSave();
        renderMine();
      } else if (a === 'del') {
        const btn = e.target.closest('[data-a]');
        if (btn.dataset.armed !== '1') {
          btn.dataset.armed = '1';
          btn.textContent = '✓';
          btn.title = 'Click again to delete';
          btn.style.background = '#e0592a';
          btn.style.color = '#fff';
          setTimeout(() => {
            if (btn.isConnected) {
              btn.dataset.armed = '';
              btn.textContent = '🗑';
              btn.style.background = '';
              btn.style.color = '';
            }
          }, 2500);
          return;
        }
        mine = mine.filter(x => x.id !== m.id);
        try {
          localStorage.removeItem(tlKeyFor(m.id));
        } catch (e) {}
        if (shared.mineCur === m.id) {
          shared.mineCur = null;
          tlCopy(undefined, null);
          tl.key = tlKeyFor(null);
          tlSave();
        }
        mineSave();
        renderMine();
      }
    });
  }
}
function initMine() {
  $('dz-save').addEventListener('click', () => openSaveDialog(false));
  // New design: always the same default quilt (5 × 5 Ohio star / nine patch, 458 mm); the timeline keeps the previous one
  $('dz-new').addEventListener('click', () => {
    shared.mineCur = null;
    mineSave();
    if ($('dz-dialog').open) $('dz-dialog').close();
    try {
      localStorage.removeItem(tlKeyFor(null));
    } catch (e) {} // a new design starts its own, empty timeline
    replaceDesign(defaultDesign(), { timeline: null });
  });
  $('mine-new').addEventListener('click', () => openSaveDialog(true));
  $('save-ok').addEventListener('click', () => doSave(false));
  $('save-asnew').addEventListener('click', () => doSave(true));
  $('save-x').addEventListener('click', () => $('save-dlg').close());
  $('save-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave(false);
    }
  });
  $('save-dlg').addEventListener('close', () => {
    saveForceNew = false;
    if (state.page === 'mine') renderMine();
  });
  $('mine-q').addEventListener('input', renderMine);
  $('mine-sort').addEventListener('change', renderMine);
}
initMine();

export { MINE_KEY, mine, mineSave, renderMine };
