// My fabrics: the person's fabric photos, sorted by colour, in folders. Adding is quick (photo, crop, done) and everything
// else is optional. Folders can hold the app's own fabrics too. Press and hold a fabric to choose several.
import { t, tn } from '@quilt/shared/i18n.js';
import { collection, collectionCanvas } from '@quilt/shared/fabric-patterns.js';
import { COLOUR_FAMILIES, colourOrder, fabricFamilies } from '../../app/src/core/colour-match.js';
import { fabricIdsIn } from '../../app/src/core/fabric-picks.js';
import { repo } from '../../app/src/storage/repo.js';
import { onAccountChange } from './account.js';
import { getPicture } from './camera.js';
import { fabricPhoto, loadImage, measureColours } from './images.js';
import {
  addToFolder,
  folder,
  folders,
  foldersOf,
  forgetFabric,
  moveFolder,
  newFolder,
  note,
  removeFolder,
  removeFromFolder,
  renameFolder,
  setNote,
} from './organize.js';
import { whenNear } from './quilt-card.js';
import { boxesFor, fractionMenu, lastUnit, readSide, sizeLabel, toCm, MAX_CM, MIN_CM } from './piece-size.js';
import { get, put } from './store.js';
import { $, ask, el, openSheet, pressable, say, shown } from './ui.js';

const PAGE = 60,
  THUMB_PX = 200,
  NEW_FABRIC_CM = 30; // a guess, for a photo of no measured piece; the fabric's sheet can correct it

const FAMILY_NAMES = {
  red: t('Red'),
  orange: t('Orange'),
  yellow: t('Yellow'),
  green: t('Green'),
  blue: t('Blue'),
  purple: t('Purple'),
  pink: t('Pink'),
  brown: t('Brown'),
  grey: t('Grey'),
  black: t('Black'),
  white: t('White'),
};

const state = {
  /** 'all' (my photos), 'loose' (in no folder), 'app' (the app's own fabrics), or a folder's id */
  view: 'all',
  family: /** @type {string | null} */ (null),
  query: '',
  shown: PAGE,
  /** while choosing several: the ones chosen */
  chosen: /** @type {Set<string> | null} */ (null),
};

// ---- fabrics, mine and the app's
/** @typedef {{ id: string, name: string, blob?: Blob | null, pattern?: any }} Item */
/** @returns {Item[]} */
const myFabrics = () => repo.fabrics.list().map(r => ({ id: r.id, name: r.name, blob: r.blob }));
/** @type {Map<string, any> | null} */
let appById = null;
function appFabric(id) {
  appById ??= new Map(collection().map(p => [p.id, p]));
  return appById.get(id) || null;
}
/** @param {string} id @returns {Item | null} */
function itemById(id) {
  const mine = repo.fabrics.get(id);
  if (mine) return { id, name: mine.name, blob: mine.blob };
  const p = appFabric(id);
  return p ? { id, name: p.name, pattern: p } : null;
}

const toRgb = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
/** A fabric's main colours: the app's are known, a photo's are measured once and kept. @param {Item} it */
function coloursOf(it) {
  if (it.pattern)
    return [
      { rgb: toRgb(it.pattern.fg), share: 0.6 },
      { rgb: toRgb(it.pattern.bg), share: 0.4 },
    ];
  return get('colours', it.id)?.colours || [];
}

let measuring = false;
/** Measures the photos not measured yet, one at a time so that the phone stays quick. */
async function measureNew() {
  if (measuring) return;
  measuring = true;
  try {
    for (const it of myFabrics()) {
      if (get('colours', it.id) || !it.blob) continue;
      let colours = [];
      try {
        colours = await measureColours(it.blob);
      } catch (e) {} // a picture that can't be read: no colours, sorted last
      put('colours', { id: it.id, colours }, { quiet: true });
      renderFabrics();
    }
  } finally {
    measuring = false;
  }
}

// a photo's address on the screen, made once
const urls = new Map();
function urlOf(it) {
  if (!urls.has(it.id)) urls.set(it.id, URL.createObjectURL(it.blob));
  return urls.get(it.id);
}

/** The fabric's picture, for a tile. The app's own are drawn only when they come near the screen. @param {Item} it */
function picture(it) {
  if (it.blob) return el('img', { alt: '', loading: 'lazy', src: urlOf(it) });
  const c = el('canvas', { width: THUMB_PX, height: THUMB_PX });
  if (it.pattern)
    whenNear(c, () => {
      const g = c.getContext('2d');
      g.drawImage(collectionCanvas(it.pattern), 0, 0, THUMB_PX, THUMB_PX);
    });
  return c;
}

/** @param {Item} it */
function details(it) {
  const n = note(it.id);
  return [n.amount, n.place].filter(Boolean).join(' · ');
}

// ---- what the board shows
/** @returns {Item[]} */
function itemsInView() {
  if (state.view === 'app') return collection().map(p => ({ id: p.id, name: p.name, pattern: p }));
  if (state.view === 'loose') return myFabrics().filter(i => !foldersOf(i.id).length);
  if (state.view === 'all') return myFabrics();
  const f = folder(state.view);
  return f ? f.fabricIds.map(itemById).filter(Boolean) : [];
}
function visible() {
  const q = state.query.toLowerCase();
  return itemsInView()
    .filter(i => !q || `${i.name} ${details(i)}`.toLowerCase().includes(q))
    .filter(i => !state.family || fabricFamilies(coloursOf(i)).includes(state.family));
}
/** Sorted by colour: worked out once per list, not per drawing of it. */
function sorted(list) {
  const keyed = list.map(i => [colourOrder(coloursOf(i)), i]);
  // (two with no colours make Infinity - Infinity, which isn't a number)
  keyed.sort((a, b) => /** @type {number} */ (a[0]) - /** @type {number} */ (b[0]) || 0);
  return keyed.map(([, i]) => /** @type {Item} */ (i));
}

function tile(it) {
  const chosen = state.chosen?.has(it.id);
  const b = el(
    'button',
    {
      type: 'button',
      class: chosen ? 'fab chosen' : 'fab',
      'aria-pressed': state.chosen ? String(!!chosen) : undefined,
    },
    picture(it),
    el('span', { class: 'fab-name', textContent: it.name }),
    details(it) && el('small', { class: 'fab-note', textContent: details(it) }),
  );
  pressable(
    b,
    () => {
      if (state.chosen) toggle(it.id);
      else openFabric(it);
    },
    () => {
      if (!state.chosen) state.chosen = new Set();
      state.chosen.add(it.id);
      renderFabrics();
    },
  );
  return b;
}
function toggle(id) {
  if (state.chosen.has(id)) state.chosen.delete(id);
  else state.chosen.add(id);
  if (!state.chosen.size) state.chosen = null;
  renderFabrics();
}

function renderChips() {
  const chip = (label, view, id) =>
    el('button', {
      type: 'button',
      class: state.view === view ? 'chip on' : 'chip',
      textContent: label,
      id,
      onclick: () => {
        state.view = view;
        state.shown = PAGE;
        state.chosen = null;
        renderFabrics();
      },
    });
  $('fab-views').replaceChildren(
    ...shown([
      chip(t('All my fabrics'), 'all', 'view-all'),
      chip(t('Not in a folder'), 'loose', 'view-loose'),
      ...folders().map(f => chip(`${f.name} · ${f.fabricIds.length}`, f.id)),
      chip(t('The app’s fabrics'), 'app', 'view-app'),
      el('button', {
        type: 'button',
        class: 'chip plain',
        id: 'new-folder',
        textContent: t('+ Folder'),
        onclick: () => askName(t('A new folder'), '', name => openFolderNow(newFolder(name).id)),
      }),
      folders().length > 0 &&
        el('button', {
          type: 'button',
          class: 'chip plain',
          id: 'manage-folders',
          textContent: t('Arrange folders'),
          onclick: manageFolders,
        }),
    ]),
  );
  $('fab-colours').replaceChildren(
    ...COLOUR_FAMILIES.map(f =>
      el('button', {
        type: 'button',
        class: state.family === f.key ? 'dot on' : 'dot',
        style: `background: rgb(${f.rgb.join(',')})`,
        'aria-label': FAMILY_NAMES[f.key],
        'aria-pressed': String(state.family === f.key),
        title: FAMILY_NAMES[f.key],
        onclick: () => {
          state.family = state.family === f.key ? null : f.key;
          state.shown = PAGE;
          renderFabrics();
        },
      }),
    ),
  );
}
function openFolderNow(id) {
  state.view = id;
  state.shown = PAGE;
  renderFabrics();
}

function renderFolderBar() {
  const f = folder(state.view),
    bar = $('fab-folder');
  bar.hidden = !f;
  if (!f) return;
  bar.replaceChildren(
    el('button', {
      type: 'button',
      class: 'btn small solid',
      id: 'folder-add',
      textContent: t('Add fabrics'),
      onclick: () => pickInto(f.id),
    }),
    el('button', {
      type: 'button',
      class: 'btn small',
      id: 'folder-rename',
      textContent: t('Rename'),
      onclick: () => askName(t('Rename this folder'), f.name, name => renameFolder(f.id, name)),
    }),
    el('button', {
      type: 'button',
      class: 'btn small',
      id: 'folder-delete',
      textContent: t('Delete'),
      onclick: () => deleteFolder(f.id),
    }),
  );
}

function renderChosenBar() {
  const bar = $('fab-chosen');
  bar.hidden = !state.chosen;
  if (!state.chosen) return;
  const ids = [...state.chosen],
    here = folder(state.view);
  bar.replaceChildren(
    ...shown([
      el('span', {
        class: 'count',
        textContent: tn(ids.length, 'One chosen', '{n} chosen'),
      }),
      el('button', {
        type: 'button',
        class: 'btn small solid',
        id: 'chosen-add',
        textContent: t('Add to folder'),
        onclick: () => chooseFolderFor(ids),
      }),
      here &&
        el('button', {
          type: 'button',
          class: 'btn small',
          id: 'chosen-out',
          textContent: t('Take out'),
          onclick: () => {
            removeFromFolder(here.id, ids);
            state.chosen = null;
            renderFabrics();
          },
        }),
      el('button', {
        type: 'button',
        class: 'btn small',
        id: 'chosen-cancel',
        textContent: t('Cancel'),
        onclick: () => {
          state.chosen = null;
          renderFabrics();
        },
      }),
    ]),
  );
}

function renderFabrics() {
  renderChips();
  renderFolderBar();
  renderChosenBar();
  const list = sorted(visible());
  const addTile =
    state.view !== 'app' &&
    !state.chosen &&
    el('button', {
      type: 'button',
      class: 'fab add',
      id: 'add-fabric',
      textContent: t('+ Add fabric'),
      onclick: addNewFabric,
    });
  $('fab-board').replaceChildren(...[addTile, ...list.slice(0, state.shown).map(tile)].filter(Boolean));
  $('fab-more').hidden = list.length <= state.shown;
  const empty = $('fab-empty');
  const nothing = !list.length;
  empty.hidden = !nothing;
  if (nothing)
    empty.textContent =
      state.query || state.family
        ? t('No fabrics match.')
        : folder(state.view)
          ? t('This folder is empty. Add fabrics to it: they stay in your other folders too.')
          : state.view === 'loose'
            ? t('All your fabrics are in folders.')
            : t('No fabrics yet. Add a photo of one: it sorts itself by colour.');
  measureNew();
}

// ---- asking for things
/** Asks for a name. @param {string} title @param {string} value @param {(name: string) => void} then */
function askName(title, value, then) {
  const s = openSheet(title),
    input = el('input', { type: 'text', value, maxLength: 60, id: 'folder-name', 'aria-label': t('Name') });
  s.body.append(
    el(
      'form',
      {
        class: 'row',
        onsubmit: e => {
          e.preventDefault();
          const name = input.value.trim();
          if (!name) return input.focus();
          s.close();
          then(name);
          renderFabrics();
          return undefined;
        },
      },
      input,
      el('button', { type: 'submit', class: 'btn solid', textContent: t('OK') }),
    ),
  );
  input.focus();
}

async function deleteFolder(id) {
  const f = folder(id);
  const sure = await ask(
    t('Delete the folder “{name}”?', { name: f.name }),
    t('The fabrics in it are not deleted.'),
    t('Delete the folder'),
    { danger: true },
  );
  if (!sure) return;
  removeFolder(id);
  state.view = 'all';
  renderFabrics();
}

function manageFolders() {
  const s = openSheet(t('Arrange folders'));
  const fill = () => {
    const list = folders();
    s.body.replaceChildren(
      ...list.map((f, i) =>
        el(
          'div',
          { class: 'row spread folder-row' },
          el('span', { class: 'grow', textContent: f.name }),
          el('button', {
            type: 'button',
            class: 'btn small',
            'aria-label': t('Move “{name}” up', { name: f.name }),
            textContent: '↑',
            disabled: i === 0,
            onclick: () => {
              moveFolder(f.id, -1);
              fill();
              renderFabrics();
            },
          }),
          el('button', {
            type: 'button',
            class: 'btn small',
            'aria-label': t('Move “{name}” down', { name: f.name }),
            textContent: '↓',
            disabled: i === list.length - 1,
            onclick: () => {
              moveFolder(f.id, 1);
              fill();
              renderFabrics();
            },
          }),
        ),
      ),
    );
  };
  fill();
}

/** Puts these fabrics into a folder, or a new one. @param {string[]} ids */
function chooseFolderFor(ids) {
  const s = openSheet(tn(ids.length, 'Add {n} fabric to…', 'Add {n} fabrics to…'));
  const finish = id => {
    addToFolder(id, ids);
    s.close();
    state.chosen = null;
    say(t('Added to “{name}”.', { name: folder(id).name }));
    renderFabrics();
  };
  const name = el('input', {
    type: 'text',
    id: 'new-folder-name',
    maxLength: 60,
    placeholder: t('A new folder'),
    'aria-label': t('A new folder'),
  });
  s.body.append(
    el(
      'form',
      {
        class: 'row',
        onsubmit: e => {
          e.preventDefault();
          if (name.value.trim()) finish(newFolder(name.value).id);
          else name.focus();
        },
      },
      name,
      el('button', { type: 'submit', class: 'btn solid', textContent: t('Add') }),
    ),
    ...folders().map(f =>
      el('button', {
        type: 'button',
        class: 'choice',
        textContent: f.name,
        onclick: () => finish(f.id),
      }),
    ),
  );
}

/** "Add fabrics" inside a folder: a sheet of ticks, over my photos or the app's fabrics. @param {string} id */
function pickInto(id) {
  const f = folder(id),
    s = openSheet(t('Add to “{name}”', { name: f.name }), { full: true }),
    picked = new Set();
  let from = 'mine',
    q = '',
    shown = PAGE;
  const go = el('button', {
    type: 'button',
    class: 'btn solid wide',
    id: 'pick-done',
    onclick: () => {
      addToFolder(id, [...picked]);
      s.close();
      renderFabrics();
    },
  });
  const grid = el('div', { class: 'fab-grid' }),
    more = el('button', {
      type: 'button',
      class: 'btn',
      textContent: t('More fabrics'),
      onclick: () => {
        shown += PAGE;
        fill();
      },
    });
  const tabs = el('div', { class: 'chips' });
  const fill = () => {
    tabs.replaceChildren(
      el('button', {
        type: 'button',
        class: from === 'mine' ? 'chip on' : 'chip',
        textContent: t('My photos'),
        onclick: () => {
          from = 'mine';
          shown = PAGE;
          fill();
        },
      }),
      el('button', {
        type: 'button',
        class: from === 'app' ? 'chip on' : 'chip',
        id: 'pick-app',
        textContent: t('The app’s fabrics'),
        onclick: () => {
          from = 'app';
          shown = PAGE;
          fill();
        },
      }),
    );
    const source = from === 'mine' ? myFabrics() : collection().map(p => ({ id: p.id, name: p.name, pattern: p }));
    const list = source.filter(i => !folder(id).fabricIds.includes(i.id) && (!q || i.name.toLowerCase().includes(q)));
    grid.replaceChildren(
      ...sorted(list)
        .slice(0, shown)
        .map(it =>
          el(
            'button',
            {
              type: 'button',
              class: picked.has(it.id) ? 'fab chosen' : 'fab',
              'aria-pressed': String(picked.has(it.id)),
              onclick: () => {
                if (picked.has(it.id)) picked.delete(it.id);
                else picked.add(it.id);
                fill();
              },
            },
            picture(it),
            el('span', { class: 'fab-name', textContent: it.name }),
          ),
        ),
    );
    more.hidden = list.length <= shown;
    go.disabled = !picked.size;
    go.textContent = picked.size ? tn(picked.size, 'Add {n} fabric', 'Add {n} fabrics') : t('Tick the fabrics to add');
  };
  s.body.append(
    tabs,
    el('input', {
      type: 'search',
      placeholder: t('Search fabrics'),
      'aria-label': t('Search fabrics'),
      oninput: e => {
        q = e.target.value.trim().toLowerCase();
        shown = PAGE;
        fill();
      },
    }),
    grid,
    el('div', { class: 'more' }, more),
    el('div', { class: 'sheet-foot' }, go),
  );
  fill();
}

/** Which quilts use this fabric. @param {string} id @returns {string[]} */
function quiltsUsing(id) {
  return repo.designs
    .list()
    .filter(r => r.design && fabricIdsIn(r.design, s => s === id).size)
    .map(r => r.name);
}

async function deleteFabric(it, s) {
  const using = quiltsUsing(it.id);
  const sure = await ask(
    t('Delete “{name}”?', { name: it.name }),
    using.length
      ? t('{quilts} uses this fabric: its parts will show another fabric instead.', { quilts: using.join(', ') })
      : t('It will be deleted from all your devices.'),
    t('Delete the fabric'),
    { danger: true },
  );
  if (!sure) return;
  repo.fabrics.remove(it.id);
  forgetFabric(it.id);
  s.close();
  renderFabrics();
}

/**
 * How big the cloth in a fabric's photo is: width × height, kept in step with the picture's shape. A changed size
 * changes the print on every quilt that uses the fabric, here and, once synced, on the web.
 * @param {Item} it
 */
function sizeField(it) {
  const unit = lastUnit();
  const box = id => el('input', { type: 'text', inputMode: 'decimal', id, class: 'size-box', maxLength: 6 });
  const w = box('fabric-w'),
    h = box('fabric-h'),
    // in inches, a fraction menu beside each box, as the web app has
    wf = fractionMenu('fabric-wf', t('{name}: fraction of an inch', { name: t('Width') })),
    hf = fractionMenu('fabric-hf', t('{name}: fraction of an inch', { name: t('Height') })),
    said = el('p', { class: 'hint', id: 'fabric-size-said', role: 'status' });
  wf.hidden = hf.hidden = unit !== 'in';
  let aspect = 1;
  const fill = () => {
    const cm = repo.fabrics.get(it.id)?.cm || NEW_FABRIC_CM,
      across = boxesFor(cm, unit),
      down = boxesFor(cm / aspect, unit);
    w.value = across.text;
    wf.value = across.eighths;
    h.value = down.text;
    hf.value = down.eighths;
  };
  loadImage(it.blob)
    .then(im => {
      aspect = im.naturalWidth / im.naturalHeight;
      fill();
    })
    .catch(() => fill());
  fill();
  const typed = (from, frac, toWidth) => () => {
    const v = readSide(from.value, frac.value, unit);
    const wCm = toCm(toWidth(v), unit);
    if (!(v > 0) || wCm < MIN_CM || wCm > MAX_CM || wCm / aspect < MIN_CM || wCm / aspect > MAX_CM) {
      said.textContent = t('A piece can be from 1 to 300 cm on each side.');
      fill();
      return;
    }
    repo.fabrics.resize(it.id, wCm);
    fill(); // both boxes, in step with the picture's shape
    said.textContent = t('Its quilts show it at {size} now.', { size: sizeLabel(wCm, wCm / aspect, unit) });
    renderFabrics();
  };
  const across = typed(w, wf, v => v),
    down = typed(h, hf, v => v * aspect);
  w.addEventListener('change', across);
  wf.addEventListener('change', across);
  h.addEventListener('change', down);
  hf.addEventListener('change', down);
  return el(
    'div',
    { class: unit === 'in' ? 'field in' : 'field' },
    el('span', { textContent: t('Its real size') }),
    el(
      'div',
      { class: 'size-row' },
      w,
      wf,
      el('span', { textContent: '×' }),
      h,
      hf,
      el('span', { textContent: unit === 'in' ? t('in') : 'cm' }),
    ),
    said,
  );
}

/** A fabric's sheet: its picture, its details and its folders. Details are kept as they're typed. @param {Item} it */
function openFabric(it) {
  const mine = !!it.blob,
    n = note(it.id),
    s = openSheet(it.name);
  const field = (label, input) => el('label', { class: 'field' }, el('span', { textContent: label }), input);
  const name = el('input', { type: 'text', id: 'fabric-name', value: it.name, maxLength: 80, disabled: !mine });
  const amount = el('input', {
    type: 'text',
    id: 'fabric-amount',
    value: n.amount,
    maxLength: 40,
    placeholder: t('For example: 2 m, or a fat quarter'),
  });
  const place = el('input', {
    type: 'text',
    id: 'fabric-place',
    value: n.place,
    maxLength: 60,
    placeholder: t('For example: Box 1'),
  });
  const keep = () => {
    if (mine && name.value.trim() && name.value.trim() !== it.name) {
      repo.fabrics.rename(it.id, name.value.trim());
      s.dialog.querySelector('h2').textContent = name.value.trim();
    }
    setNote(it.id, { amount: amount.value.trim(), place: place.value.trim() });
    renderFabrics();
  };
  for (const i of [name, amount, place]) i.addEventListener('change', keep);
  const size = mine ? sizeField(it) : null;
  s.dialog.addEventListener('close', keep);
  const ticks = el('div', { class: 'ticks' });
  const fillTicks = () =>
    ticks.replaceChildren(
      ...folders().map(f =>
        el(
          'label',
          { class: 'tick' },
          el('input', {
            type: 'checkbox',
            checked: f.fabricIds.includes(it.id),
            onchange: e => {
              if (e.target.checked) addToFolder(f.id, [it.id]);
              else removeFromFolder(f.id, [it.id]);
              renderFabrics();
            },
          }),
          el('span', { textContent: f.name }),
        ),
      ),
      el('button', {
        type: 'button',
        class: 'chip plain',
        textContent: t('+ Folder'),
        onclick: () =>
          askName(t('A new folder'), '', folderName => {
            addToFolder(newFolder(folderName).id, [it.id]);
            fillTicks();
          }),
      }),
    );
  fillTicks();
  s.body.append(
    ...shown([
      el('div', { class: 'fab-large' }, picture(it)),
      field(t('Name'), name),
      size,
      field(t('How much'), amount),
      field(t('Where it’s kept'), place),
      el('h3', { textContent: t('Folders') }),
      ticks,
      mine &&
        el('button', {
          type: 'button',
          class: 'choice danger-text',
          id: 'delete-fabric',
          textContent: t('Delete this fabric'),
          onclick: () => deleteFabric(it, s),
        }),
    ]),
  );
}

// ---- adding a fabric
/**
 * Cropping: a frame over the picture, moved by dragging and sized by its corner. It keeps its shape: a square, or the
 * shape of the cut piece when its size is known (then the picture's width is the piece's width).
 * @param {Blob} blob @param {{ aspect?: number, start?: { x: number, y: number, w: number, h: number } }} [o]
 *   aspect: width / height; start: where the frame starts, in the picture's pixels (where it was framed live)
 * @returns {Promise<Blob | null>} the cropped picture
 */
async function crop(blob, { aspect = 1, start: from0 } = {}) {
  const im = await loadImage(blob);
  return new Promise(done => {
    const s = openSheet(t('Crop to the fabric'), { full: true });
    let answer = null;
    s.dialog.addEventListener('close', () => done(answer));
    const stage = el('div', { class: 'crop-stage' }),
      // shown once it is placed on the picture: before that it has no size or place of its own
      box = el(
        'div',
        { class: 'crop-box', id: 'crop-box', hidden: true },
        el('div', { class: 'crop-corner', id: 'crop-corner' }),
      );
    im.className = 'crop-img';
    im.alt = '';
    stage.append(im, box);
    s.body.append(
      stage,
      el('p', {
        class: 'hint',
        textContent:
          from0 || aspect !== 1
            ? t('Drag the frame, or its corner, to fit the edges of the piece.')
            : t('Drag the square, or its corner, to frame only the fabric.'),
      }),
      el(
        'div',
        { class: 'sheet-foot' },
        el('button', {
          type: 'button',
          class: 'btn solid wide',
          id: 'crop-done',
          textContent: t('Use this part'),
          onclick: async () => {
            const k = im.naturalWidth / im.clientWidth;
            answer = await fabricPhoto(im, { x: pos.x * k, y: pos.y * k, w: pos.w * k, h: (pos.w / aspect) * k });
            s.close();
          },
        }),
      ),
    );
    const W = () => im.clientWidth,
      H = () => im.clientHeight;
    const pos = { x: 0, y: 0, w: 0 };
    const show = () => {
      box.hidden = false;
      box.style.left = `${pos.x}px`;
      box.style.top = `${pos.y}px`;
      box.style.width = `${pos.w}px`;
      box.style.height = `${pos.w / aspect}px`;
    };
    const start = () => {
      const k = im.naturalWidth / W(),
        most = Math.min(W(), H() * aspect);
      if (from0) {
        // where it was framed, kept inside the picture
        pos.w = Math.max(40, Math.min(most, from0.w / k));
        pos.x = Math.max(0, Math.min(W() - pos.w, from0.x / k));
        pos.y = Math.max(0, Math.min(H() - pos.w / aspect, from0.y / k));
      } else {
        pos.w = most * 0.9;
        pos.x = (W() - pos.w) / 2;
        pos.y = (H() - pos.w / aspect) / 2;
      }
      show();
    };
    const dragging = (node, move) => {
      node.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        node.setPointerCapture(e.pointerId);
        const from = { x: e.clientX, y: e.clientY, ...pos };
        const moved = m => {
          move(m.clientX - from.x, m.clientY - from.y, from);
          show();
        };
        const up = () => {
          node.removeEventListener('pointermove', moved);
          node.removeEventListener('pointerup', up);
          node.removeEventListener('pointercancel', up);
        };
        node.addEventListener('pointermove', moved);
        node.addEventListener('pointerup', up);
        node.addEventListener('pointercancel', up);
      });
    };
    dragging(box, (dx, dy, from) => {
      pos.x = Math.max(0, Math.min(W() - pos.w, from.x + dx));
      pos.y = Math.max(0, Math.min(H() - pos.w / aspect, from.y + dy));
    });
    dragging($('crop-corner'), (dx, dy, from) => {
      const most = Math.min(W() - from.x, (H() - from.y) * aspect);
      pos.w = Math.max(40, Math.min(most, from.w + Math.max(dx, dy * aspect)));
    });
    if (im.complete) requestAnimationFrame(start);
    else im.addEventListener('load', start);
  });
}

/**
 * After cropping: a name and the optional details. Saving straight away is the quick way.
 * @param {Blob} blob @param {{ cm?: number, aspect?: number }} [piece] a measured piece: the width of cloth the picture shows
 */
function detailsThenKeep(blob, piece = {}) {
  return new Promise(done => {
    const s = openSheet(t('Your new fabric'));
    const number = repo.fabrics.list().length + 1;
    const name = el('input', {
      type: 'text',
      id: 'new-name',
      value: t('Fabric {n}', { n: number }),
      maxLength: 80,
    });
    const amount = el('input', {
      type: 'text',
      id: 'new-amount',
      maxLength: 40,
      placeholder: t('For example: 2 m, or a fat quarter'),
    });
    const place = el('input', { type: 'text', id: 'new-place', maxLength: 60, placeholder: t('For example: Box 1') });
    const field = (label, input) => el('label', { class: 'field' }, el('span', { textContent: label }), input);
    const inFolders = new Set(folder(state.view) ? [state.view] : []);
    const chips = el('div', { class: 'chips wrap' });
    const fill = () =>
      chips.replaceChildren(
        ...folders().map(f =>
          el('button', {
            type: 'button',
            class: inFolders.has(f.id) ? 'chip on' : 'chip',
            'aria-pressed': String(inFolders.has(f.id)),
            textContent: f.name,
            onclick: () => {
              if (inFolders.has(f.id)) inFolders.delete(f.id);
              else inFolders.add(f.id);
              fill();
            },
          }),
        ),
        el('button', {
          type: 'button',
          class: 'chip plain',
          textContent: t('+ Folder'),
          onclick: () =>
            askName(t('A new folder'), '', folderName => {
              inFolders.add(newFolder(folderName).id);
              fill();
            }),
        }),
      );
    fill();
    s.dialog.addEventListener('close', () => done());
    s.body.append(
      field(t('Name'), name),
      piece.cm &&
        el('p', {
          class: 'hint',
          id: 'new-size',
          textContent: t('Its real size: {size}', {
            size: sizeLabel(piece.cm, piece.cm / (piece.aspect || 1), lastUnit()),
          }),
        }),
      field(t('How much (you can leave this)'), amount),
      field(t('Where it’s kept (you can leave this)'), place),
      el('h3', { textContent: t('Folders') }),
      chips,
      el(
        'div',
        { class: 'sheet-foot' },
        el('button', {
          type: 'button',
          class: 'btn solid wide',
          id: 'new-save',
          textContent: t('Keep this fabric'),
          onclick: async () => {
            const { id, isNew } = await repo.fabrics.add(blob, {
              name: name.value.trim() || t('Fabric {n}', { n: number }),
              cm: piece.cm || NEW_FABRIC_CM,
            });
            setNote(id, { amount: amount.value.trim(), place: place.value.trim() });
            for (const f of inFolders) addToFolder(f, [id]);
            s.close();
            if (!isNew) say(t('You already have this photo.'));
            renderFabrics();
          },
        }),
      ),
    );
  });
}

/**
 * A picture becomes a fabric: crop, details, kept.
 * @param {Blob} picture @param {{ aspect?: number, start?: { x: number, y: number, w: number, h: number }, cm?: number }} [piece]
 *   a cut piece of a known size: cropped in its shape, and kept at its real width
 */
async function addFabricFrom(picture, piece = {}) {
  const cropped = await crop(picture, piece);
  if (cropped) await detailsThenKeep(cropped, piece);
}

async function addNewFabric() {
  try {
    const picture = await getPicture({ gallery: true });
    if (picture) await addFabricFrom(picture);
  } catch (e) {
    say(t('That picture could not be read.'));
  }
}

/** The screen's search box has this now. @param {string} text */
function searchFabrics(text) {
  state.query = text;
  state.shown = PAGE;
  renderFabrics();
}

function initMyFabrics() {
  $('fab-more').textContent = t('More fabrics');
  $('fab-more').addEventListener('click', () => {
    state.shown += PAGE;
    renderFabrics();
  });
  onAccountChange(() => {
    // another account's photos and folders: keep nothing chosen from what was on the screen
    if (state.view !== 'all' && state.view !== 'loose' && state.view !== 'app' && !folder(state.view))
      state.view = 'all';
    state.chosen = null;
    renderFabrics();
  });
  renderFabrics();
}

export { addFabricFrom, initMyFabrics, renderFabrics, searchFabrics };
