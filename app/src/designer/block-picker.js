// Choosing a block pattern: the list under "Block pattern" (the app's first 27 blocks, plus the ones this quilt uses
// and recent picks), one row that scrolls sideways like the fabric lists, and the block library behind its round
// "+" button, with search and families.
import './colour-finder.js'; // load order: runs after designer/colour-finder
import { design, focusBlock } from '../core/store.js';
import { $, sideRoller } from '../core/dom.js';
import { placeMoreButton } from './fabric-picker.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { GRID_BLOCKS } from '@quilt/shared/blocks.js';
import { ROLE_COLOURS } from '@quilt/shared/design.js';
import { pathPoly } from '@quilt/shared/geometry.js';
import { shortList, withRecent } from '../core/fabric-picks.js';
import { findBlocks, patternsIn } from '../core/block-picks.js';
import { DRAWN_FAMILY, readDrawn } from '@quilt/shared/drawn-blocks.js';
import { designs } from '../storage/repo.js';
import { openBlockDrawer } from './ui-state.js';
import { t } from '@quilt/shared/i18n.js';

const PAGE = 60; // tiles the library shows at a time
// the blocks the list always shows: every block from before the library (people know where they are)
const STARTERS = Object.keys(PATTERNS).filter(k => !(k in GRID_BLOCKS) && !PATTERNS[k].drawn);

// ---- recently picked blocks, per device
const RECENT_KEY = 'quilt-recent-blocks.v1';
/** @returns {string[]} */
function recentBlocks() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter(k => k in PATTERNS) : [];
  } catch (e) {
    return [];
  }
}
/** @param {string} key */
function noteRecentBlock(key) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(withRecent(recentBlocks(), key)));
  } catch (e) {}
}

/** A block tile: the pattern in the default colours, and its name. @param {string} key */
function patternTile(key) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pat';
  b.dataset.p = key;
  b.title = PATTERNS[key].label;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  for (const part of partsOf(key)) {
    g.fillStyle = ROLE_COLOURS[part.role];
    pathPoly(
      g,
      part.poly.map(([u, v]) => [u * 96, v * 96]),
    );
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.stroke();
  }
  const s = document.createElement('span');
  s.textContent = PATTERNS[key].label;
  b.append(c, s);
  return b;
}

/** The list under "Block pattern", with the focused block's pattern pressed. Redrawn only when its blocks change. */
function drawPatternList() {
  if (!design) return;
  const box = $('dz-patterns'),
    cur = design.blocks[focusBlock].pattern;
  const keys = shortList({
    basics: STARTERS,
    selected: cur,
    inQuilt: patternsIn(design),
    recent: recentBlocks(),
    max: 10,
  });
  if (box.dataset.keys !== keys.join()) {
    box.dataset.keys = keys.join();
    box.innerHTML = '';
    for (const k of keys) box.appendChild(patternTile(k));
    // the round "+" button beside the row, like the fabric lists': it opens the block library
    const rest = Object.keys(PATTERNS).length - keys.length,
      more = document.createElement('button');
    more.type = 'button';
    more.className = 'fab-more-btn';
    more.id = 'dz-patterns-more';
    more.title = t('More blocks ({n}): search all blocks by name or family', { n: rest });
    more.setAttribute('aria-label', t('More blocks ({n})', { n: rest }));
    more.innerHTML = `<b aria-hidden="true">+</b><span aria-hidden="true">${rest}</span>`;
    more.addEventListener('click', openBlockLibrary);
    placeMoreButton(box, more);
  }
  for (const b of box.querySelectorAll('.pat[data-p]')) b.setAttribute('aria-pressed', String(b.dataset.p === cur));
  // one row that scrolls sideways, the chosen block in view
  sideRoller(box, '.pat[aria-pressed="true"]');
}

// ---- the block library window
const lib = { group: 'all', shown: PAGE };
// the families in the order a quilter would look through them (any other comes after)
const FAMILIES = [
  DRAWN_FAMILY,
  'Basics',
  'Four patch',
  'Nine patch',
  'Stars',
  'Strips and logs',
  'Larger grids',
  'Hand-drawn',
];
// a search also finds a block by its English name and by its family as shown (`family` itself stays English: it is the
// group's value)
const ALL = () =>
  Object.entries(PATTERNS).map(([key, p]) => ({
    key,
    label: p.label,
    family: p.family,
    also: `${p.en || ''} ${t(p.family)}`,
  }));

/** Makes the blocks drawn in every saved quilt known, so "My blocks" shows them all (sync brings other devices'). */
function gatherDrawn() {
  for (const m of designs.list()) if (m.design?.drawn) readDrawn(m.design.drawn);
}

function openBlockLibrary() {
  gatherDrawn();
  lib.group = 'all';
  lib.shown = PAGE;
  $('blklib-q').value = '';
  drawBlockLibrary();
  const dlg = $('blklib');
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  $('blklib-q').focus();
}

function drawBlockLibrary() {
  const all = ALL(),
    inQuilt = patternsIn(design),
    recent = recentBlocks(),
    query = $('blklib-q').value,
    cur = design ? design.blocks[focusBlock].pattern : null;
  const groups = $('blklib-groups');
  groups.innerHTML = '';
  const names = { all: t('All'), quilt: t('In this quilt'), recent: t('Recent') };
  for (const f of [...FAMILIES, ...all.map(b => b.family)]) names[f] ??= t(f);
  for (const [g, label] of Object.entries(names)) {
    const n = findBlocks(all, { group: g, inQuilt, recent }).length;
    if (!n && g !== 'all' && g !== lib.group) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.g = g;
    b.textContent = `${label} ${n}`;
    b.setAttribute('aria-pressed', String(g === lib.group));
    groups.appendChild(b);
  }
  const found = findBlocks(all, { query, group: lib.group, inQuilt, recent });
  const grid = $('blklib-grid');
  grid.innerHTML = '';
  // the editor's tile comes first where a drawn block could be listed
  if (!query.trim() && (lib.group === 'all' || lib.group === DRAWN_FAMILY)) grid.appendChild(drawTile());
  for (const b of found.slice(0, lib.shown)) {
    const tile = patternTile(b.key);
    tile.setAttribute('aria-pressed', String(b.key === cur));
    grid.appendChild(tile);
  }
  const left = found.length - lib.shown;
  $('blklib-more').hidden = left <= 0;
  $('blklib-more').textContent = t('Show more ({n} more)', { n: left });
  $('blklib-none').hidden = found.length > 0 || lib.group === DRAWN_FAMILY;
  $('blklib-none').textContent = query.trim()
    ? t('No blocks match “{q}”.', { q: query.trim() })
    : t('No blocks here yet.');
}

/** The tile that opens the block editor. */
function drawTile() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pat pat-draw';
  b.id = 'blklib-draw';
  b.dataset.draw = '';
  b.title = t('Draw your own block on a grid');
  b.innerHTML = `<b aria-hidden="true">✎</b><span>${t('Draw a block')}</span>`;
  return b;
}

/**
 * A block picked in the library joins the recent ones and goes to the selected blocks through the list's own click
 * handler, as if it had been clicked there. @param {string} key
 */
function pickFromLibrary(key) {
  $('blklib').close();
  noteRecentBlock(key);
  const box = $('dz-patterns'),
    b = document.createElement('button');
  b.type = 'button';
  b.className = 'pat';
  b.dataset.p = key;
  b.hidden = true;
  box.appendChild(b);
  b.click();
  b.remove();
}

function initBlockLibrary() {
  const dlg = $('blklib');
  $('blklib-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => {
    // a click on the backdrop, outside the box, closes it
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  $('blklib-q').addEventListener('input', () => {
    lib.shown = PAGE;
    drawBlockLibrary();
  });
  $('blklib-groups').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (!b) return;
    lib.group = b.dataset.g;
    lib.shown = PAGE;
    drawBlockLibrary();
  });
  $('blklib-grid').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button.pat');
    if (b && 'draw' in b.dataset) {
      $('blklib').close();
      openBlockDrawer();
    } else if (b?.dataset.p) pickFromLibrary(b.dataset.p);
  });
  $('blklib-more').addEventListener('click', () => {
    lib.shown += PAGE;
    drawBlockLibrary();
  });
}
initBlockLibrary();

export { drawPatternList, noteRecentBlock, openBlockLibrary, patternTile };
