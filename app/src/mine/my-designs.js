// My designs: saved quilts.
import '../tour/tour.js'; // load order: runs after tour/tour
import { design, mineCur, readOnly, setMineCur } from '../core/store.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { tl, tlCopy, tlKeyFor, tlSave } from '../timeline/timeline.js';
import { defaultDesign } from '@quilt/shared/design.js';
import { openDesign, replaceDesign } from '../designer/dispatch.js';
import { readDesign } from '@quilt/shared/format.js';
import { notify } from '../ui/notice.js';
import { designs, getSession, setSession, timelines } from '../storage/repo.js';

// ---- My designs: saved quilts, shown as a Pinterest-style masonry
// The designs themselves are records in storage/repo.js (designs.list, save, remove); mineCur, the one being
// edited, is kept in the session store.
setMineCur(getSession('mineCur') || null);
/** Keeps which saved design is being edited (after setMineCur). */
function mineSave() {
  setSession('mineCur', mineCur || undefined);
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
  if (!design) return;
  saveForceNew = !!forceNew;
  const cur = !saveForceNew && mineCur && designs.get(mineCur);
  $('save-name').value = cur ? cur.name : `Quilt ${designs.list().length + 1}`;
  $('save-title').textContent = cur ? 'Save changes' : 'Save design';
  $('save-asnew').hidden = !cur;
  const pic = quiltPicture(design, 300),
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
  if (readOnly) {
    notify('This quilt was made with a newer version of the app, so it cannot be saved here.');
    $('save-dlg').close();
    return;
  }
  const name = ($('save-name').value || '').trim() || `Quilt ${designs.list().length + 1}`;
  const old = !asNew && !saveForceNew && mineCur && designs.get(mineCur);
  const prev = mineCur;
  const cur = designs.save({ id: old ? old.id : designs.newId(), name, design });
  if (!old) {
    // the new design takes the timeline so far (an unsaved draft's moves over; a saved design keeps its own too)
    tlCopy(undefined, cur.id);
    if (!prev) timelines.remove(tlKeyFor(null));
    tl.key = tlKeyFor(cur.id);
  }
  saveForceNew = false;
  setMineCur(cur.id);
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
  const m = designs.get(id);
  if (!m) return;
  if (!readDesign(m.design)) {
    notify(`“${m.name}” could not be read.`);
    return;
  }
  setMineCur(id);
  mineSave();
  openDesign(m.design, { timeline: id, what: `“${m.name}”` });
  showPage('design');
}
function renderMine() {
  const grid = $('mine-grid'),
    q = ($('mine-q').value || '').trim().toLowerCase(),
    sort = $('mine-sort').value;
  const all = designs.list(),
    key = sort === 'created' ? 'createdAt' : 'updatedAt';
  const list = all.filter(m => !q || m.name.toLowerCase().includes(q));
  list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b[key] - a[key]);
  grid.innerHTML = '';
  $('mine-empty').hidden = all.length > 0 && list.length > 0;
  if (all.length && !list.length) $('mine-empty').textContent = 'No designs match your search.';
  else
    $('mine-empty').innerHTML = 'No saved designs yet. In the Quilt designer, press <b>Save</b> to keep a quilt here.';
  const when = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  for (const m of list) {
    const r = readDesign(m.design);
    if (!r) continue;
    const d = r.design;
    const pin = document.createElement('article');
    pin.className = 'pin' + (m.id === mineCur ? ' current' : '');
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
    sm.textContent = `${d.cols} × ${d.rows} blocks · ${quiltMm(d).W} × ${quiltMm(d).H} mm · ${when(m.updatedAt)}`;
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
        // Enter or leaving the field keeps the new name, Escape the old one (redrawing the cards removes the
        // field, which also blurs it: `ended` stops that from saving again, or saving after Escape)
        let ended = false;
        const end = keep => {
          if (ended) return;
          ended = true;
          const name = inp.value.trim();
          if (keep && name && name !== m.name) designs.save({ id: m.id, name });
          renderMine();
        };
        inp.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') end(true);
          if (ev.key === 'Escape') end(false);
        });
        inp.addEventListener('blur', () => end(true));
      } else if (a === 'dup') {
        const copy = designs.save({ id: designs.newId(), name: m.name + ' (copy)', design: m.design });
        tlCopy(m.id, copy.id);
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
        designs.remove(m.id);
        timelines.remove(tlKeyFor(m.id));
        if (mineCur === m.id) {
          setMineCur(null);
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
    setMineCur(null);
    mineSave();
    if ($('dz-dialog').open) $('dz-dialog').close();
    timelines.remove(tlKeyFor(null)); // a new design starts its own, empty timeline
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

export { mineSave, renderMine };
