// Choosing a fabric: the tiles of the short lists (every fabric choice in the designer), and the fabric library
// window behind their "More fabrics" tile, with search, groups, and adding your own photos.
import './fabric-library.js'; // load order: runs after designer/fabric-library
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { isFabric, listedFabrics, loadFabrics, noteRecent, recentFabrics, thumbUrl } from './fabric-library.js';
import { fabricIdsIn, findFabrics, shortList } from '../core/fabric-picks.js';

const PAGE = 60; // tiles the library shows at a time ("Show more" adds as many again)

/** One fabric tile: a button with a small picture and the name. @param {import('./fabric-library.js').Fabric} f */
function fabricTile(f, pressed) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fab';
  b.dataset.f = f.id;
  b.title = f.name;
  let pic;
  if (f.blob) {
    // a photo: the browser loads and shrinks it only when the tile is on screen
    pic = document.createElement('img');
    pic.loading = 'lazy';
    pic.decoding = 'async';
    pic.alt = '';
    pic.src = thumbUrl(f);
  } else {
    pic = document.createElement('canvas');
    pic.width = pic.height = 64;
    const k = Math.min(f.canvas.width, f.canvas.height, 360);
    pic.getContext('2d').drawImage(f.canvas, 0, 0, k, k, 0, 0, 64, 64);
  }
  const s = document.createElement('span');
  s.textContent = f.name;
  b.append(pic, s);
  b.setAttribute('aria-pressed', String(!!pressed));
  return b;
}

/**
 * The fabrics a short list shows: the basics, the one chosen now, the ones in this quilt, recent picks, and the
 * newest photos while there are few others. @param {string | null} selected @returns {import('./fabric-library.js').Fabric[]}
 */
function shortListFabrics(selected) {
  const listed = listedFabrics(),
    byId = new Map(listed.map(f => [f.id, f]));
  const newest = listed
    .filter(f => !f.basic)
    .sort((a, b) => (b.added || 0) - (a.added || 0))
    .map(f => f.id);
  const ids = shortList({
    basics: listed.filter(f => f.basic).map(f => f.id),
    selected,
    inQuilt: design ? fabricIdsIn(design, isFabric) : [],
    recent: recentFabrics(),
    newest,
  });
  return ids.map(id => byId.get(id)).filter(Boolean);
}

/** The last tile of a short list: opens the library for that list. @param {HTMLElement} box @param {number} shown */
function moreTile(box, shown) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fab fab-more';
  const rest = listedFabrics().length - shown;
  b.title = 'All fabrics: search, and add photos of your own';
  const plus = document.createElement('b');
  plus.textContent = rest > 0 ? '⋯' : '+';
  plus.setAttribute('aria-hidden', 'true');
  const s = document.createElement('span');
  s.textContent = rest > 0 ? `More fabrics (${rest})` : 'Add a fabric photo';
  b.append(plus, s);
  // its own click: the list's handler (one fabric per button) must not see it
  b.addEventListener('click', e => {
    e.stopPropagation();
    openLibrary(box);
  });
  return b;
}

/** Fills a short list. @param {HTMLElement} box @param {string | null} selected */
function drawShortList(box, selected) {
  box.innerHTML = '';
  const fabs = shortListFabrics(selected);
  for (const f of fabs) box.appendChild(fabricTile(f, f.id === selected));
  box.appendChild(moreTile(box, fabs.length));
}

// ---- the fabric library window
const lib = { source: /** @type {HTMLElement | null} */ (null), selected: null, group: 'all', shown: PAGE };
const GROUPS = { all: 'All', quilt: 'In this quilt', recent: 'Recent', basic: 'Basics', mine: 'My photos' };

/** Opens the library for one short list: a fabric picked there goes to that list. @param {HTMLElement} box */
function openLibrary(box) {
  lib.source = box;
  lib.selected = /** @type {HTMLElement | null} */ (box.querySelector('.fab[aria-pressed="true"]'))?.dataset.f ?? null;
  lib.group = 'all';
  lib.shown = PAGE;
  $('fablib-q').value = '';
  drawLibrary();
  const dlg = $('fablib');
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  $('fablib-q').focus();
}

/** Draws the library's groups and tiles for the search typed now. */
function drawLibrary() {
  if (!$('fablib').open && !lib.source) return;
  const all = listedFabrics(),
    inQuilt = design ? fabricIdsIn(design, isFabric) : new Set(),
    recent = recentFabrics(),
    query = $('fablib-q').value;
  const groups = $('fablib-groups');
  groups.innerHTML = '';
  for (const [g, label] of Object.entries(GROUPS)) {
    const n = findFabrics(all, { group: /** @type {any} */ (g), inQuilt, recent }).length;
    if (!n && g !== 'all' && g !== lib.group) continue; // an empty group isn't worth a button
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.g = g;
    b.textContent = `${label} ${n}`;
    b.setAttribute('aria-pressed', String(g === lib.group));
    groups.appendChild(b);
  }
  const found = findFabrics(all, { query, group: /** @type {any} */ (lib.group), inQuilt, recent });
  const grid = $('fablib-grid');
  grid.innerHTML = '';
  if (lib.group === 'all' || lib.group === 'mine') {
    // adding a photo: the file input sits in the window's foot, with the width a photo covers
    const add = document.createElement('label');
    add.className = 'fab fab-more';
    add.htmlFor = 'dz-upload';
    add.title = 'Add photos of your own fabrics';
    add.innerHTML = '<b aria-hidden="true">+</b><span>Add fabric photo</span>';
    grid.appendChild(add);
  }
  for (const f of found.slice(0, lib.shown)) grid.appendChild(fabricTile(f, f.id === lib.selected));
  const left = found.length - lib.shown;
  $('fablib-more').hidden = left <= 0;
  $('fablib-more').textContent = `Show more (${left} more)`;
  $('fablib-none').hidden = found.length > 0;
  $('fablib-none').textContent = query.trim() ? `No fabrics match “${query.trim()}”.` : 'No fabrics here yet.';
}

/**
 * A fabric picked in the library joins the recent ones and goes, right away, to the list the library was opened
 * from, through that list's own click handler, as if it had been clicked there. Its picture is made meanwhile:
 * the quilt is drawn again once it's ready (fabric-library.js).
 * @param {string} id
 */
function pickFromLibrary(id) {
  const box = lib.source;
  $('fablib').close();
  if (!box) return;
  loadFabrics([id]);
  noteRecent(id);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fab';
  b.dataset.f = id;
  b.hidden = true;
  box.appendChild(b);
  b.click();
  b.remove();
}

function initLibrary() {
  const dlg = $('fablib');
  $('fablib-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    lib.source = null;
  });
  dlg.addEventListener('click', e => {
    // a click on the backdrop, outside the box, closes it
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  $('fablib-q').addEventListener('input', () => {
    lib.shown = PAGE;
    drawLibrary();
  });
  $('fablib-groups').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (!b) return;
    lib.group = b.dataset.g;
    lib.shown = PAGE;
    drawLibrary();
  });
  $('fablib-grid').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button.fab');
    if (b?.dataset.f) pickFromLibrary(b.dataset.f);
  });
  $('fablib-more').addEventListener('click', () => {
    lib.shown += PAGE;
    drawLibrary();
  });
}
initLibrary();

/** The library again after photos were added (they show first under My photos and All). */
function refreshLibrary() {
  if ($('fablib').open) drawLibrary();
}

export { drawShortList, openLibrary, refreshLibrary };
