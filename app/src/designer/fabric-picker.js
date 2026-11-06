// Choosing a fabric: the tiles of the short lists (every fabric choice in the designer), and the fabric library
// window behind their "More fabrics" tile, with search, groups, and adding your own photos.
import './fabric-library.js'; // load order: runs after designer/fabric-library
import { design } from '../core/store.js';
import { $, sideRoller } from '../core/dom.js';
import {
  fabricPalette,
  isFabric,
  listedFabrics,
  loadFabrics,
  noteRecent,
  recentFabrics,
  setFabricPalette,
  thumbUrl,
  tileSource,
} from './fabric-library.js';
import { fabricIdsIn, findFabrics, paletteList, shortList, withFabric, withoutFabric } from '../core/fabric-picks.js';
import { notify } from '../ui/notice.js';
import { choosePhotos } from './add-fabric.js';
import { folders, refreshFolders } from './fabric-folders-state.js';
import { t } from '@quilt/shared/i18n.js';

const PAGE = 60; // tiles the library shows at a time ("Show more" adds as many again)

/**
 * One fabric tile: a button with a small picture and the name. In a short list, `mark` adds a corner badge: an ×
 * that takes the fabric off the palette ('remove'), or a ✓ for one that can't be taken off now ('fixed').
 * @param {import('./fabric-library.js').Fabric} f @param {boolean} pressed @param {'remove' | 'fixed'} [mark]
 */
function fabricTile(f, pressed, mark) {
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
    const [src, k] = tileSource(f);
    pic.getContext('2d').drawImage(src, 0, 0, k, k, 0, 0, 64, 64);
  }
  const s = document.createElement('span');
  s.textContent = f.name;
  b.append(pic, s);
  b.setAttribute('aria-pressed', String(!!pressed));
  if (mark === 'remove') {
    // inside the tile (one row of buttons), so its own click must not reach the list's handler: that would choose it
    const x = document.createElement('span');
    x.className = 'fab-x';
    x.title = t('Take {name} off this list (it stays in the fabric library)', { name: f.name });
    x.setAttribute('aria-hidden', 'true');
    x.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      removeFromPalette(f);
    });
    b.append(x);
    b.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeFromPalette(f);
      }
    });
  } else if (mark === 'fixed') {
    const ok = document.createElement('span');
    ok.className = 'fab-in';
    ok.title = t('In this quilt, or chosen now: it stays on this list');
    ok.setAttribute('aria-hidden', 'true');
    b.append(ok);
  }
  return b;
}

/**
 * The palette before anyone changes it: the basics, recent picks, and the newest photos while there are few
 * others. @returns {string[]}
 */
function defaultPalette() {
  const listed = listedFabrics();
  const newest = listed
    .filter(f => !f.basic && !f.collection)
    .sort((a, b) => (b.added || 0) - (a.added || 0))
    .map(f => f.id);
  return shortList({ basics: listed.filter(f => f.basic).map(f => f.id), recent: recentFabrics(), newest });
}

/**
 * The fabrics a short list shows: the palette (or the default), then the ones in this quilt and the one chosen now
 * when they aren't on it; those can't be taken off (`fixed`).
 * @param {string | null} selected @returns {{ f: import('./fabric-library.js').Fabric, fixed: boolean }[]}
 */
function shortListFabrics(selected) {
  const byId = new Map(listedFabrics().map(f => [f.id, f]));
  return paletteList({
    palette: fabricPalette(),
    defaults: defaultPalette(),
    inQuilt: design ? fabricIdsIn(design, isFabric) : [],
    selected,
  })
    .filter(item => byId.has(item.id))
    .map(item => ({ f: byId.get(item.id), fixed: item.fixed }));
}

// every short list drawn, with the fabric chosen in it, to draw them all again when the palette changes
const lists = new Map();
function redrawLists() {
  for (const [box, selected] of lists) {
    if (box.isConnected) drawShortList(box, selected);
    else lists.delete(box);
  }
}
/** Rolls every list that has this fabric to it (just added: it may be past the end of the row). @param {string} id */
function showInLists(id) {
  for (const box of lists.keys()) {
    const tile = /** @type {HTMLElement | null} */ (box.querySelector(`[data-f="${id}"]`));
    if (tile) box.scrollLeft = tile.offsetLeft - box.clientWidth / 2;
  }
}

/** Takes a fabric off the palette (every short list), with an Undo. @param {import('./fabric-library.js').Fabric} f */
function removeFromPalette(f) {
  const before = fabricPalette();
  setFabricPalette(withoutFabric(before || defaultPalette(), f.id));
  redrawLists();
  notify(t('Took {name} off the fabric lists. It stays in the fabric library.', { name: f.name }), {
    ms: 6000,
    action: {
      label: t('Undo'),
      run: () => {
        setFabricPalette(before);
        redrawLists();
      },
    },
  });
}

/**
 * "More fabrics": a round button beside a short list (outside its row, so it never covers a fabric); it opens the
 * library for that list. @param {HTMLElement} box @param {number} shown
 */
function moreButton(box, shown) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fab-more-btn';
  if (box.id) b.id = box.id + '-more';
  const rest = listedFabrics().length - shown,
    label = rest > 0 ? t('More fabrics ({n})', { n: rest }) : t('Add a fabric photo');
  b.title = t('{label}: search all fabrics, and add photos of your own', { label });
  b.setAttribute('aria-label', label);
  const sign = document.createElement('b');
  sign.textContent = rest > 0 ? '⋯' : '+';
  sign.setAttribute('aria-hidden', 'true');
  b.append(sign);
  if (rest > 0) {
    const n = document.createElement('span');
    n.textContent = String(rest);
    n.setAttribute('aria-hidden', 'true');
    b.append(n);
  }
  b.addEventListener('click', () => openLibrary(box));
  return b;
}

/**
 * "+ Add fabric": opens the computer's file picker (designer/add-fabric.js). Not a `.fab`: it isn't a fabric, and the
 * lists choose whatever their `.fab` buttons name.
 */
function addFabricTile() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'fab-add fab-more';
  b.title = t('Add photos of your own fabrics');
  b.innerHTML = `<b aria-hidden="true">+</b><span>${t('Add fabric')}</span>`;
  b.addEventListener('click', () => choosePhotos(b));
  return b;
}

/** Fills a short list. @param {HTMLElement} box @param {string | null} selected */
// ---- the floating "More fabrics" button: one for the page, on the body so a scrolling panel can't clip it
const float = {
  el: /** @type {HTMLButtonElement | null} */ (null),
  el2: /** @type {HTMLButtonElement | null} */ (null), // the second round button under it (colours), when the row has one
  box: /** @type {HTMLElement | null} */ (null),
  region: /** @type {HTMLElement | null} */ (null), // the part of the page that shows it while the mouse is over it
  timer: 0,
};
/** The row's own round buttons (shown beside it on touch screens): the first opens the library. @param {HTMLElement} box */
const inlineButtons = box =>
  /** @type {HTMLElement[]} */ ([...(box.parentElement.querySelector(':scope > .fab-more-stack')?.children || [])]);
/** The floating round buttons, made once: each does what the row's own button in its place does. */
function floatButtons() {
  if (float.el) return [float.el, float.el2];
  const make = (id, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fab-more-btn fab-more-float';
    b.id = id;
    // a name under it (set when shown), like the round buttons beside the quilt: a number or a colour wheel alone
    // says little
    b.hidden = true;
    b.addEventListener('mouseenter', () => clearTimeout(float.timer)); // moving onto it keeps it
    b.addEventListener('mouseleave', hideFloatSoon);
    b.addEventListener('click', () => {
      const inline = float.box ? inlineButtons(float.box)[n] : null;
      hideFloat();
      inline?.click();
    });
    document.body.append(b);
    return b;
  };
  float.el = make('fab-more-float', 0);
  float.el2 = make('fab-colour-float', 1);
  return [float.el, float.el2];
}
// Where the mouse is, kept here: after a scroll the browser doesn't update which element is "hovered" until the
// mouse moves again, so asking it then said "not over the list", hid the button, and it stayed hidden.
const pointer = { x: -1, y: -1 };
addEventListener(
  'mousemove',
  e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  },
  { passive: true },
);
/** Each list's section (the part of the page that shows its button), with its row. */
const sectionRow = new WeakMap();
// a scroll (a row sideways, its panel or the page): the section now under the mouse shows its button, beside its
// row where the row has moved to; with none under it (and the mouse not on the button) the button goes
addEventListener(
  'scroll',
  () => {
    if (pointer.x < 0 || matchMedia('(hover: none)').matches) return;
    const el = document.elementFromPoint(pointer.x, pointer.y);
    if (float.el && !float.el.hidden && el && (float.el.contains(el) || float.el2.contains(el))) {
      if (float.box) showFloat(float.box, float.region);
      return;
    }
    const region = el ? el.closest('[data-float]') : null;
    if (region && sectionRow.has(region)) showFloat(sectionRow.get(region), region);
    else hideFloat();
  },
  true,
);

/**
 * Shows the floating button for a list, just left of its card (or of the row, when it has no card).
 * @param {HTMLElement} box the row @param {HTMLElement} region the part of the page it belongs to
 */
function showFloat(box, region) {
  const inline = inlineButtons(box);
  // (beside the tutorial's column there is no room outside the card: the row's own buttons show instead)
  if (!inline.length || matchMedia('(hover: none)').matches || document.body.classList.contains('tour-docked')) return;
  const buttons = floatButtons();
  clearTimeout(float.timer);
  float.box = box;
  float.region = region;
  const size = 52,
    edge = /** @type {HTMLElement} */ (box.closest('.card') || box.parentElement).getBoundingClientRect(),
    row = box.getBoundingClientRect();
  let left = edge.left - size - 10;
  // no room on the left (a small window): over the row's right end, inside the card. Just outside its right edge they
  // fell under the next panel or off the page; the row scrolls, so the tile under them can still be reached
  if (left < 4) left = Math.min(row.right, innerWidth) - size - 6;
  // nor on the round buttons beside the quilt (On a bed, Picture): just to their left then, over the quilt's edge,
  // which is only looked at (inside the row they would cover fabrics)
  const rail = document.querySelector('.rail:not(.rail-left)')?.getBoundingClientRect();
  if (rail && rail.width && left < rail.right + 6 && left + size > rail.left - 6) left = rail.left - size - 8;
  for (const [n, b] of buttons.entries()) {
    const src = inline[n];
    b.hidden = !src;
    if (!src) continue;
    b.replaceChildren(...[...src.childNodes].map(c => c.cloneNode(true)));
    b.title = src.title;
    // its name: the first opens the library of that row (blocks or fabrics), the second finds by colour
    b.dataset.name =
      n === 1 ? t('By colour') : box.closest('.pats, #dz-patterns') ? t('More blocks') : t('More fabrics');
    b.setAttribute('aria-label', src.getAttribute('aria-label') || '');
    b.style.left = left + 'px';
    // the buttons together are centred on the row, the second under the first with room for the first one's name
    b.style.top =
      row.top + row.height / 2 - (inline.length * size + (inline.length - 1) * 20) / 2 + n * (size + 20) + 'px';
  }
}
function hideFloat() {
  clearTimeout(float.timer);
  if (float.el) float.el.hidden = float.el2.hidden = true;
}
function hideFloatSoon() {
  clearTimeout(float.timer);
  float.timer = setTimeout(hideFloat, 300); // time to move the mouse from the row onto it
}

/**
 * Puts a row's round "More" button beside it (fabrics and blocks alike): just left of the row on touch screens;
 * with a mouse, a floating copy just outside the row's card while the mouse is anywhere over the list's section:
 * the block holding its title and row ("Fabric for the selected parts", "Block pattern"), when that block holds just
 * this one list; where a card has two lists (sashing and cornerstones), each its own row.
 * A second button (the colour finder, for fabrics) goes under the first.
 * @param {HTMLElement} box the row @param {HTMLButtonElement} button @param {HTMLButtonElement | null} [second]
 */
function placeMoreButton(box, button, second = null) {
  // the row is wrapped once to hold the two side by side
  let wrap = box.parentElement;
  if (!wrap.classList.contains('fabs-row')) {
    wrap = document.createElement('div');
    wrap.className = 'fabs-row';
    box.replaceWith(wrap);
    wrap.append(box);
  }
  wrap.querySelector(':scope > .fab-more-stack')?.remove();
  const stack = document.createElement('div');
  stack.className = 'fab-more-stack';
  stack.append(button);
  if (second) stack.append(second);
  wrap.prepend(stack);
  const parent = wrap.parentElement,
    lists = parent ? parent.querySelectorAll('.fabs:not(.fablib-grid), #dz-patterns').length : 0,
    region = parent && parent !== document.body && lists === 1 ? parent : wrap;
  if (!region.dataset.float) {
    region.dataset.float = '1';
    sectionRow.set(region, box);
    region.addEventListener('mouseenter', () => showFloat(box, region));
    region.addEventListener('focusin', () => showFloat(box, region));
    region.addEventListener('mouseleave', hideFloatSoon);
  }
}

function drawShortList(box, selected) {
  lists.set(box, selected);
  box.innerHTML = '';
  const fabs = shortListFabrics(selected);
  for (const { f, fixed } of fabs) box.appendChild(fabricTile(f, f.id === selected, fixed ? 'fixed' : 'remove'));
  box.prepend(addFabricTile()); // first, and pinned there: at the end of a long row nobody would find it
  placeMoreButton(box, moreButton(box, fabs.length), colourButton ? colourButton(box) : null);
  // one row that scrolls sideways, the chosen fabric in view
  sideRoller(box, '.fab[aria-pressed="true"]');
}

// ---- the fabric library window
const lib = { source: /** @type {HTMLElement | null} */ (null), selected: null, group: 'all', shown: PAGE };
const GROUPS = {
  all: t('All'),
  quilt: t('In this quilt'),
  recent: t('Recent'),
  basic: t('Basics'),
  collection: t('Collection'),
  mine: t('My photos'),
};

/** A folder group's folder, when the library shows one. */
const openFolder = () => folders.find(f => `folder:${f.id}` === lib.group) || null;
/** The fabrics of a folder that this app knows. */
const inFolder = (all, f) => all.filter(x => f.fabricIds.includes(x.id));

/** Opens the library for one short list: a fabric picked there goes to that list. @param {HTMLElement} box */
function openLibrary(box) {
  lib.source = box;
  lib.selected = /** @type {HTMLElement | null} */ (box.querySelector('.fab[aria-pressed="true"]'))?.dataset.f ?? null;
  lib.group = 'all';
  lib.shown = PAGE;
  $('fablib-q').value = '';
  drawLibrary();
  refreshFolders().then(drawLibrary); // the phone may have changed them
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
  // the folders made in the phone app, after the groups every fabric list has
  for (const f of folders) {
    const n = inFolder(all, f).length,
      g = `folder:${f.id}`;
    if (!n && g !== lib.group) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.g = g;
    b.textContent = `${f.name} ${n}`;
    b.setAttribute('aria-pressed', String(g === lib.group));
    groups.appendChild(b);
  }
  if (lib.group.startsWith('folder:') && !openFolder()) lib.group = 'all'; // deleted on the phone
  const folder = openFolder();
  const found = folder
    ? findFabrics(inFolder(all, folder), { query, group: 'all', inQuilt, recent })
    : findFabrics(all, { query, group: /** @type {any} */ (lib.group), inQuilt, recent });
  const grid = $('fablib-grid');
  grid.innerHTML = '';
  if (lib.group === 'all' || lib.group === 'mine') {
    grid.appendChild(addFabricTile());
  }
  // a dot marks the fabrics on the palette (in the short lists)
  const onPalette = new Set(fabricPalette() || defaultPalette());
  for (const f of found.slice(0, lib.shown)) {
    const tile = fabricTile(f, f.id === lib.selected);
    if (onPalette.has(f.id)) {
      tile.classList.add('on-palette');
      tile.title = t('{name} · in your fabric lists', { name: f.name });
    }
    grid.appendChild(tile);
  }
  $('fablib-reset').hidden = !fabricPalette();
  const left = found.length - lib.shown;
  $('fablib-more').hidden = left <= 0;
  $('fablib-more').textContent = t('Show more ({n} more)', { n: left });
  $('fablib-none').hidden = found.length > 0;
  $('fablib-none').textContent = query.trim()
    ? t('No fabrics match “{q}”.', { q: query.trim() })
    : t('No fabrics here yet.');
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
  if (box) useFabricIn(box, id);
}

/**
 * A fabric chosen outside a list (library, colour finder): its picture is made, it joins the recent ones and the
 * palette, and it goes to the list through the list's own click handler, as if it had been clicked there.
 * @param {HTMLElement} box the list @param {string} id
 */
function useFabricIn(box, id) {
  loadFabrics([id]);
  noteRecent(id);
  // a fabric picked in the library joins the palette, at its end
  const palette = fabricPalette();
  if (palette || !defaultPalette().includes(id)) setFabricPalette(withFabric(palette || defaultPalette(), id));
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
  // the fabric lists as they were at first: the basics and the newest photos
  $('fablib-reset').addEventListener('click', () => {
    setFabricPalette(null);
    redrawLists();
    drawLibrary();
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

// the second round button beside every fabric list, made by the colour finder (designer/colour-finder.js), which
// loads later and hands it in here
let colourButton = /** @type {((box: HTMLElement) => HTMLButtonElement) | null} */ (null);
/** @param {(box: HTMLElement) => HTMLButtonElement} make */
const setColourButton = make => (colourButton = make);

export {
  drawShortList,
  fabricTile,
  openLibrary,
  placeMoreButton,
  redrawLists,
  refreshLibrary,
  setColourButton,
  showInLists,
  useFabricIn,
};
