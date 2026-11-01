// My designs: saved quilts.
import '../tour/tour.js'; // load order: runs after tour/tour
import { design, mineCur, readOnly, setMineCur } from '../core/store.js';
import { $ } from '../core/dom.js';
import { dims } from '../core/units.js';
import { state } from '../sim/config.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { tl, tlCopy, tlKeyFor, tlSave } from '../timeline/timeline.js';
import { newDesign } from '@quilt/shared/design.js';
import { openDesign, replaceDesign } from '../designer/dispatch.js';
import { readDesign } from '@quilt/shared/format.js';
import { notify } from '../ui/notice.js';
import { isFabric, loadFabrics } from '../designer/fabric-library.js';
import { fabricIdsIn } from '../core/fabric-picks.js';
import { communityHooks, sharedIds } from './shared-state.js';
import { designs, flush, getSession, setSession, timelines } from '../storage/repo.js';

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
  saveCurrent(($('save-name').value || '').trim(), asNew || saveForceNew);
  saveForceNew = false;
  $('save-dlg').close();
  const b = $('dz-save');
  b.classList.add('saved');
  b.title = 'Saved ✓';
  setTimeout(() => {
    b.classList.remove('saved');
    b.title = 'Save this quilt to My designs';
  }, 1600);
}
/**
 * Saves the quilt being edited: its changes into its saved design, or (new, or not saved yet) as a new one, which
 * takes the timeline so far. @param {string} [typed] the name @param {boolean} [asNew] @returns {import('../storage/repo.js').DesignRecord}
 */
function saveCurrent(typed, asNew = false) {
  const name = (typed || '').trim() || `Quilt ${designs.list().length + 1}`;
  const old = !asNew && mineCur && designs.get(mineCur);
  const prev = mineCur;
  const cur = designs.save({ id: old ? old.id : designs.newId(), name, design });
  if (!old) {
    // the new design takes the timeline so far (an unsaved draft's moves over; a saved design keeps its own too)
    tlCopy(undefined, cur.id);
    if (!prev) timelines.remove(tlKeyFor(null));
    tl.key = tlKeyFor(cur.id);
  }
  setMineCur(cur.id);
  mineSave();
  return cur;
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
/** fabrics whose pictures My designs has asked for */
const askedFabrics = new Set();
function renderMine() {
  const grid = $('mine-grid'),
    q = ($('mine-q').value || '').trim().toLowerCase(),
    sort = $('mine-sort').value;
  const all = designs.list().filter(m => !pendingDelete.has(m.id)), // a deletion waiting for Undo: gone already
    key = sort === 'created' ? 'createdAt' : 'updatedAt';
  const list = all.filter(m => !q || m.name.toLowerCase().includes(q));
  list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b[key] - a[key]);
  grid.innerHTML = '';
  $('mine-empty').hidden = all.length > 0 && list.length > 0;
  if (all.length && !list.length) $('mine-empty').textContent = 'No designs match your search.';
  else
    $('mine-empty').innerHTML = 'No saved designs yet. In the Quilt designer, press <b>Save</b> to keep a quilt here.';
  const when = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  // the pictures of the fabrics the quilts use: asked for once, and the cards drawn again when they come (a quilt
  // from another device can use fabrics not drawn yet here)
  const want = new Set();
  for (const m of list) for (const id of fabricIdsIn(m.design, isFabric)) if (!askedFabrics.has(id)) want.add(id);
  if (want.size) {
    want.forEach(id => askedFabrics.add(id));
    loadFabrics(want).then(() => state.page === 'mine' && renderMine());
  }
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
    const meta = document.createElement('div');
    meta.className = 'meta';
    const text = document.createElement('div');
    text.className = 'meta-text';
    const nm = document.createElement('b');
    nm.textContent = m.name;
    const sm = document.createElement('small');
    sm.textContent = `${d.cols} × ${d.rows} blocks · ${dims([quiltMm(d).W, quiltMm(d).H])} · ${when(m.updatedAt)}`;
    text.append(nm, sm);
    if (sharedIds.has(m.id)) {
      const tag = document.createElement('span');
      tag.className = 'pin-tag';
      tag.textContent = 'Shared';
      tag.title = 'Shared with the community';
      text.appendChild(tag);
    }
    // ⋯ : Open, Rename, Duplicate, Delete (always shown, phones too: no hover needed)
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'pin-more';
    more.textContent = '⋯';
    more.setAttribute('aria-label', `More for “${m.name}”`);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', e => {
      e.stopPropagation();
      cardMenu(more, m, nm);
    });
    meta.append(text, more);
    pin.append(img, meta);
    grid.appendChild(pin);
    img.addEventListener('click', () => openMine(m.id));
  }
}

// ---- a card's ⋯ menu
/** @type {HTMLElement | null} */
let menu = null;
/** @type {HTMLElement | null} the ⋯ button the menu belongs to */
let menuFor = null;
function closeCardMenu(focusBack = false) {
  if (!menu) return;
  menu.remove();
  menu = null;
  menuFor?.setAttribute('aria-expanded', 'false');
  if (focusBack) menuFor?.focus();
  menuFor = null;
}
/** Opens the ⋯ menu under its button (above it when there's no room below). */
function cardMenu(btn, m, nm) {
  const again = menuFor === btn;
  closeCardMenu();
  if (again) return; // a second click on ⋯ closes it
  menu = document.createElement('div');
  menu.className = 'pin-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `“${m.name}”`);
  const items = [
    ['open', 'Open'],
    ['rename', 'Rename'],
    ['dup', 'Duplicate'],
    sharedIds.has(m.id) ? ['unshare', 'Stop sharing'] : ['share', 'Share with the community'],
    ['del', 'Delete'],
  ];
  for (const [a, label] of items) {
    const it = document.createElement('button');
    it.type = 'button';
    it.setAttribute('role', 'menuitem');
    it.dataset.a = a;
    it.textContent = label;
    if (a === 'del') it.classList.add('danger');
    it.addEventListener('click', () => {
      closeCardMenu();
      if (a === 'open') openMine(m.id);
      else if (a === 'rename') renameCard(m, nm);
      else if (a === 'dup') duplicateCard(m);
      else if (a === 'share') communityHooks.share?.(m.id);
      else if (a === 'unshare') communityHooks.unshare?.(m.id);
      else deleteWithUndo(m);
    });
    menu.appendChild(it);
  }
  // the arrow keys move through the items, Escape closes and goes back to ⋯
  menu.addEventListener('keydown', e => {
    const all = [...menu.querySelectorAll('button')],
      i = all.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCardMenu(true);
    } else if (e.key === 'Tab') closeCardMenu();
  });
  document.body.appendChild(menu);
  menuFor = btn;
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect(),
    mh = menu.offsetHeight,
    mw = menu.offsetWidth;
  menu.style.left = `${Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw))}px`;
  menu.style.top = `${r.bottom + 6 + mh > innerHeight ? r.top - mh - 6 : r.bottom + 6}px`;
  /** @type {HTMLElement} */ (menu.firstChild).focus();
}

// ---- what the menu does
/** Rename in place: Enter or leaving the field keeps the new name, Escape the old one. */
function renameCard(m, nm) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = m.name;
  inp.maxLength = 60;
  inp.style.width = '100%';
  inp.setAttribute('aria-label', 'New name');
  nm.replaceWith(inp);
  inp.focus();
  inp.select();
  // redrawing the cards removes the field, which also blurs it: `ended` stops that from saving again, or saving
  // after Escape
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
}
function duplicateCard(m) {
  const copy = designs.save({ id: designs.newId(), name: m.name + ' (copy)', design: m.design });
  tlCopy(m.id, copy.id);
  renderMine();
}

// Delete with Undo: the card goes at once, but the deletion is made (and so synced) only after the Undo
// message has gone, so an undone deletion never reaches the other devices. Only the last one can be undone.
const UNDO_MS = 10_000;
/** deletions waiting for their Undo time: design id → timer */
const pendingDelete = new Map();
function commitDelete(id) {
  clearTimeout(pendingDelete.get(id));
  pendingDelete.delete(id);
  designs.remove(id);
  timelines.remove(tlKeyFor(id));
  // it was the design being edited: it stays open, as an unsaved design
  if (mineCur === id) {
    setMineCur(null);
    tlCopy(undefined, null);
    tl.key = tlKeyFor(null);
    tlSave();
  }
  mineSave();
}
function deleteWithUndo(m) {
  for (const id of [...pendingDelete.keys()]) commitDelete(id);
  pendingDelete.set(
    m.id,
    setTimeout(() => {
      commitDelete(m.id);
      if (state.page === 'mine') renderMine();
    }, UNDO_MS),
  );
  renderMine();
  notify(`“${m.name}” was deleted.`, {
    ms: UNDO_MS,
    action: {
      label: 'Undo',
      run: () => {
        clearTimeout(pendingDelete.get(m.id));
        pendingDelete.delete(m.id);
        renderMine();
      },
    },
  });
}
// leaving the page during the Undo time: the deletion is made now
addEventListener('pagehide', () => {
  if (!pendingDelete.size) return;
  for (const id of [...pendingDelete.keys()]) commitDelete(id);
  flush();
});
document.addEventListener('click', e => {
  if (menu && !menu.contains(/** @type {Node} */ (e.target))) closeCardMenu();
});

function initMine() {
  $('dz-save').addEventListener('click', () => openSaveDialog(false));
  // New design: always the same start (three plain cream squares in a row, 300 mm); the timeline keeps the previous one
  $('dz-new').addEventListener('click', () => {
    setMineCur(null);
    mineSave();
    if ($('dz-dialog').open) $('dz-dialog').close();
    timelines.remove(tlKeyFor(null)); // a new design starts its own, empty timeline
    replaceDesign(newDesign(), { timeline: null });
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

/**
 * The quilt being edited becomes the saved design `id` (sync kept this device's version of a quilt as a copy):
 * it takes its timeline with it. @param {string} id
 */
function adoptDesignId(id) {
  tlCopy(undefined, id);
  tl.key = tlKeyFor(id);
  setMineCur(id);
  mineSave();
}

export { adoptDesignId, mineSave, openMine, quiltPicture, renderMine, saveCurrent };
