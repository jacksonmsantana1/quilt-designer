// My designs: saved quilts.
import '../tour/tour.js'; // load order: runs after tour/tour
import { design, mineCur, readOnly, setMineCur } from '../core/store.js';
import { $ } from '../core/dom.js';
import { dims, exact, roundLen } from '../core/units.js';
import { state } from '../sim/config.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { tl, tlCopy, tlKeyFor, tlSave } from '../timeline/timeline.js';
import { defaultDesign, newDesign } from '@quilt/shared/design.js';
import { openDesign, replaceDesign } from '../designer/dispatch.js';
import { readDesign } from '@quilt/shared/format.js';
import { notify } from '../ui/notice.js';
import { isFabric, loadFabrics } from '../designer/fabric-library.js';
import { fabricIdsIn } from '../core/fabric-picks.js';
import { communityHooks, sharedIds } from './shared-state.js';
import { designs, flush, getSession, setSession, timelines } from '../storage/repo.js';
import { getLang, t } from '@quilt/shared/i18n.js';

// ---- My designs: saved quilts, shown as a Pinterest-style masonry
// The designs themselves are records in storage/repo.js (designs.list, save, remove); mineCur, the one being
// edited, is kept in the session store.
setMineCur(getSession('mineCur') || null);
/** Keeps which saved design is being edited (after setMineCur). */
function mineSave() {
  setSession('mineCur', mineCur || undefined);
}
/**
 * The app's sample designs, by id, with the names they were first saved under on older devices.
 * @type {Record<string, string>}
 */
const SAMPLE_NAMES = { qmedallion: 'Medallion sampler', qphoto: 'Medallion from the photo' };
/**
 * A saved design's name as shown. A person's names stay as they typed them; a sample still under its English name
 * reads in the language in use. @param {{ id: string, name: string }} m @returns {string}
 */
function shownName(m) {
  const sample = SAMPLE_NAMES[m.id];
  return m.name === sample ? t(sample) : m.name;
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
/** The person's own saved quilts (the samples don't count), for the name suggested to a new one. */
const ownCount = () => designs.list().filter(m => !m.sample).length;
/** A new quilt: three plain squares of 300 mm, or 12 in when the quilt is measured in inches. @returns {import('@quilt/shared/design.js').Design} */
const freshDesign = () => ({ ...newDesign(), blockMm: roundLen(300) });
/**
 * Does the quilt on the screen have changes that would be lost? A saved quilt: when it differs from what was saved
 * (as the sync card tells). Not saved yet: when it is no longer a fresh new quilt. Never for a quilt that can't be saved.
 */
function hasUnsaved() {
  if (!design || readOnly) return false;
  const open = sameText(design);
  if (open === openedAs) return false; // as it was opened (a sample, read and repaired, may differ from its record)
  const rec = mineCur && designs.get(mineCur);
  if (rec) return open !== sameText(rec.design);
  return ![freshDesign(), newDesign(), defaultDesign()].some(d => sameText(d) === open);
}
/**
 * A design as text with its fields in a fixed order: one that came back from the server has the same fields in
 * another order. @param {any} v @returns {string}
 */
function sameText(v) {
  if (Array.isArray(v)) return `[${v.map(sameText).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .filter(k => v[k] !== undefined)
      .sort()
      .map(k => `${JSON.stringify(k)}:${sameText(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
/** the quilt on the screen as it was when it was opened or saved, as sameText */
let openedAs = '';
const markOpened = () => (openedAs = design ? sameText(design) : '');
/** what to do once the save dialog has saved (save and continue) @type {(() => void) | null} */
let afterSave = null;
/** what the "unsaved changes" dialog continues with @type {(() => void) | null} */
let leaveNext = null;
/**
 * Runs `go`, which puts another quilt on the screen; first, when the one there has unsaved changes, asks whether to
 * save them (save and continue), leave them (don't keep), or stay (keep editing). @param {() => void} go
 */
function confirmLeave(go) {
  if (!hasUnsaved()) return go();
  leaveNext = go;
  const cur = mineCur && designs.get(mineCur);
  $('leave-text').textContent = cur
    ? t('“{name}” has changes that are not saved yet.', { name: shownName(cur) })
    : t('This quilt is not saved yet.');
  const d = $('leave-dlg');
  if (!d.open) {
    try {
      d.showModal();
    } catch (e) {
      d.setAttribute('open', '');
    }
  }
}
function leaveChoice(how) {
  const go = leaveNext;
  leaveNext = null;
  $('leave-dlg').close();
  if (!go || how === 'stay') return;
  if (how === 'drop') return go();
  const cur = mineCur && designs.get(mineCur);
  if (cur) {
    saveCurrent(cur.name);
    notify(t('“{name}” is in My designs.', { name: shownName(cur) }));
    return go();
  }
  afterSave = go; // not saved before: the save dialog asks for its name, then goes on
  openSaveDialog(false);
}
let saveForceNew = false;
function openSaveDialog(forceNew) {
  if (!design) return;
  saveForceNew = !!forceNew;
  const cur = !saveForceNew && mineCur && designs.get(mineCur);
  $('save-name').value = cur ? shownName(cur) : t('Quilt {n}', { n: ownCount() + 1 });
  $('save-title').textContent = cur ? t('Save changes') : t('Save design');
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
  saveNameFresh = true;
}
let saveNameFresh = false;
function doSave(asNew) {
  if (readOnly) {
    notify(t('This quilt was made with a newer version of the app, so it cannot be saved here.'));
    $('save-dlg').close();
    return;
  }
  const saved = saveCurrent(($('save-name').value || '').trim(), asNew || saveForceNew);
  // during the tutorial its own card says so, and the notice would cover the card's buttons
  if (!document.body.classList.contains('tour-active')) notify(t('“{name}” is in My designs.', { name: saved.name }));
  saveForceNew = false;
  const next = afterSave;
  afterSave = null;
  $('save-dlg').close();
  if (next) next();
  const b = $('dz-save');
  b.classList.add('saved');
  b.title = t('Saved ✓');
  setTimeout(() => {
    b.classList.remove('saved');
    b.title = t('Save this quilt to My designs');
  }, 1600);
}
/**
 * Saves the quilt being edited: its changes into its saved design, or (new, or not saved yet) as a new one, which
 * takes the timeline so far. @param {string} [typed] the name @param {boolean} [asNew] @returns {import('../storage/repo.js').DesignRecord}
 */
function saveCurrent(typed, asNew = false) {
  const name = (typed || '').trim() || t('Quilt {n}', { n: ownCount() + 1 });
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
  markOpened();
  return cur;
}
function openMine(id) {
  const m = designs.get(id);
  if (!m) return;
  if (id !== mineCur) return confirmLeave(() => openSaved(id));
  openSaved(id);
}
/** @param {string} id */
function openSaved(id) {
  const m = designs.get(id);
  if (!m) return;
  if (!readDesign(m.design)) {
    notify(t('“{name}” could not be read.', { name: shownName(m) }));
    return;
  }
  setMineCur(id);
  mineSave();
  openDesign(m.design, { timeline: id, what: `“${shownName(m)}”` });
  markOpened();
  showPage('design');
  window.scrollTo(0, 0); // the quilt in sight, not the page where My designs was scrolled to
}
/** fabrics whose pictures My designs has asked for */
const askedFabrics = new Set();
function renderMine() {
  const grid = $('mine-grid'),
    q = ($('mine-q').value || '').trim().toLowerCase(),
    sort = $('mine-sort').value;
  const all = designs.list().filter(m => !pendingDelete.has(m.id)), // a deletion waiting for Undo: gone already
    key = sort === 'created' ? 'createdAt' : 'updatedAt';
  const list = all.filter(m => !q || shownName(m).toLowerCase().includes(q));
  list.sort(sort === 'name' ? (a, b) => shownName(a).localeCompare(shownName(b)) : (a, b) => b[key] - a[key]);
  grid.innerHTML = '';
  $('mine-empty').hidden = all.length > 0 && list.length > 0;
  if (all.length && !list.length) $('mine-empty').textContent = t('No designs match your search.');
  else
    $('mine-empty').innerHTML = t(
      'No saved designs yet. In the Quilt designer, press <b>Save</b> to keep a quilt here.',
    );
  const when = at => new Date(at).toLocaleDateString([getLang()], { day: 'numeric', month: 'short', year: 'numeric' });
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
    img.title = t('Open in the Quilt designer');
    img.appendChild(quiltPicture(d, 260));
    const meta = document.createElement('div');
    meta.className = 'meta';
    const text = document.createElement('div');
    text.className = 'meta-text';
    const nm = document.createElement('b');
    nm.textContent = shownName(m);
    const sm = document.createElement('small');
    sm.textContent = t('{cols} × {rows} blocks · {size} · {date}', {
      cols: d.cols,
      rows: d.rows,
      size: dims([quiltMm(exact(d)).W, quiltMm(exact(d)).H]), // in inches, from the inches typed
      date: when(m.updatedAt),
    });
    text.append(nm, sm);
    // the samples came with the app: said so, so nobody wonders whose quilts these are
    if (m.sample) {
      const ex = document.createElement('small');
      ex.className = 'pin-sample';
      ex.textContent = t('An example that comes with the app');
      text.append(ex);
    }
    if (sharedIds.has(m.id)) {
      const tag = document.createElement('span');
      tag.className = 'pin-tag';
      tag.textContent = t('Shared');
      tag.title = t('Shared with the community');
      text.appendChild(tag);
    }
    // ⋯ : Open, Rename, Duplicate, Delete (always shown, phones too: no hover needed)
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'pin-more';
    more.textContent = '⋯';
    more.setAttribute('aria-label', t('More for “{name}”', { name: shownName(m) }));
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
  menu.setAttribute('aria-label', `“${shownName(m)}”`);
  const items = [
    ['open', t('Open')],
    ['rename', t('Rename')],
    ['dup', t('Duplicate')],
    sharedIds.has(m.id) ? ['unshare', t('Stop sharing')] : ['share', t('Share with the community')],
    ['del', t('Delete')],
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
  const shown = shownName(m);
  inp.value = shown;
  inp.maxLength = 60;
  inp.style.width = '100%';
  inp.setAttribute('aria-label', t('New name'));
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
    if (keep && name && name !== shown) designs.save({ id: m.id, name });
    renderMine();
  };
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') end(true);
    if (ev.key === 'Escape') end(false);
  });
  inp.addEventListener('blur', () => end(true));
}
function duplicateCard(m) {
  const copy = designs.save({
    id: designs.newId(),
    name: t('{name} (copy)', { name: shownName(m) }),
    design: m.design,
  });
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
  notify(t('“{name}” was deleted.', { name: shownName(m) }), {
    ms: UNDO_MS,
    action: {
      label: t('Undo'),
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

/** A new quilt on the screen, without asking (signing out opens one: the quilt there belongs to the account). */
function startNew() {
  setMineCur(null);
  mineSave();
  if ($('dz-dialog').open) $('dz-dialog').close();
  timelines.remove(tlKeyFor(null)); // a new design starts its own, empty timeline
  replaceDesign(freshDesign(), { timeline: null });
}
function initMine() {
  $('dz-save').addEventListener('click', () => openSaveDialog(false));
  // New design: always the same start (three plain cream squares in a row, 300 mm); the timeline keeps the previous one
  $('dz-new').addEventListener('click', () => confirmLeave(startNew));
  $('leave-stay').addEventListener('click', () => leaveChoice('stay'));
  $('leave-x').addEventListener('click', () => leaveChoice('stay'));
  $('leave-drop').addEventListener('click', () => leaveChoice('drop'));
  $('leave-save').addEventListener('click', () => leaveChoice('save'));
  $('leave-dlg').addEventListener('close', () => (leaveNext = null));
  $('mine-new').addEventListener('click', () => openSaveDialog(true));
  $('save-ok').addEventListener('click', () => doSave(false));
  $('save-asnew').addEventListener('click', () => doSave(true));
  $('save-x').addEventListener('click', () => $('save-dlg').close());
  $('save-name').addEventListener('keydown', e => {
    if (saveNameFresh && e.key.length === 1 && !e.ctrlKey && !e.metaKey)
      /** @type {HTMLInputElement} */ (e.target).value = '';
    saveNameFresh = false;
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave(false);
    }
  });
  $('save-dlg').addEventListener('close', () => {
    saveForceNew = false;
    afterSave = null; // closed without saving: stay on this quilt
    if (state.page === 'mine') renderMine();
  });
  $('mine-q').addEventListener('input', renderMine);
  $('mine-sort').addEventListener('change', renderMine);
}
initMine();

// The Save button tells whether there is something to save: orange "Save" while there is, "Saved ✓" once the quilt
// on the screen is the one in My designs. Checked a few times a second, only when the quilt has changed.
/** @type {[any, any, any]} */
let savedSeen = [null, null, null];
function showSavedState() {
  const rec = mineCur ? designs.get(mineCur) : null;
  if (design === savedSeen[0] && mineCur === savedSeen[1] && rec === savedSeen[2]) return;
  savedSeen = [design, mineCur, rec];
  const done = !!design && !!mineCur && !hasUnsaved();
  const b = $('dz-save');
  if (b.classList.contains('is-saved') === done) return;
  b.classList.toggle('is-saved', done);
  const name = b.querySelector('.rail-name');
  if (name) name.textContent = done ? t('Saved ✓') : t('Save');
}
window.setInterval(showSavedState, 400);

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

export { adoptDesignId, confirmLeave, mineSave, startNew, openMine, quiltPicture, renderMine, saveCurrent, shownName };
