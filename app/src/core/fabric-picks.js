// Which fabrics to offer where: the short lists under each fabric choice, and the search in the fabric library.
// Pure (no DOM, no storage), so the unit tests use it directly.

/**
 * Every fabric id a design uses, wherever it sits (block parts, sashing, cornerstones, borders, backing, setting
 * triangles): any string in it that names a known fabric.
 * @param {unknown} value a design (or any part of one) @param {(s: string) => boolean} isFabric
 * @returns {Set<string>}
 */
export function fabricIdsIn(value, isFabric) {
  const out = new Set();
  const walk = v => {
    if (typeof v === 'string') {
      if (isFabric(v)) out.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

/**
 * The short list under a fabric choice: every basic fabric, then a few others in this order: the one chosen now,
 * the ones in this quilt, the ones picked recently on this device; when that makes fewer than `fill`, the newest
 * photos join (so a photo that just arrived from another device shows up). At most `max` others.
 * @param {{ basics: string[], selected?: string | null, inQuilt?: Iterable<string>, recent?: string[],
 *   newest?: string[], max?: number, fill?: number }} o
 * @returns {string[]} ids
 */
export function shortList({ basics, selected = null, inQuilt = [], recent = [], newest = [], max = 10, fill = 5 }) {
  const basic = new Set(basics),
    extra = [];
  const add = id => {
    if (id && !basic.has(id) && !extra.includes(id) && extra.length < max) extra.push(id);
  };
  [selected, ...inQuilt, ...recent].forEach(add);
  for (const id of newest) if (extra.length < fill) add(id);
  return [...basics, ...extra];
}

/** Puts an id first in a recent list, without repeats, keeping `max`. @param {string[]} list @param {string} id */
export const withRecent = (list, id, max = 12) => [id, ...list.filter(x => x !== id)].slice(0, max);

/**
 * A search for the libraries: true for a text that has every word typed, in any case, accents ignored
 * ("applique" finds "appliqué"). @param {string} query @returns {(text: string) => boolean}
 */
export function wordsMatcher(query) {
  const plain = s =>
    s
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .toLowerCase();
  const words = plain(query)
    .split(/[\s,]+/)
    .filter(Boolean);
  return text => {
    const t = plain(text);
    return words.every(w => t.includes(w));
  };
}

/**
 * The fabric library's search: every word typed must be in the name (any case, accents ignored), within the
 * chosen group. Basics come first, then photos newest first; the "recent" group keeps its own order.
 * @template {{ id: string, name: string, basic?: boolean, added?: number }} F
 * @param {F[]} fabrics
 * @param {{ query?: string, group?: 'all' | 'quilt' | 'recent' | 'basic' | 'mine',
 *   inQuilt?: Set<string>, recent?: string[] }} o
 * @returns {F[]}
 */
export function findFabrics(fabrics, { query = '', group = 'all', inQuilt = new Set(), recent = [] }) {
  const matches = wordsMatcher(query),
    named = f => matches(f.name);
  if (group === 'recent') {
    const byId = new Map(fabrics.map(f => [f.id, f]));
    return recent.map(id => byId.get(id)).filter(f => f && named(f));
  }
  const inGroup = {
    all: () => true,
    quilt: f => inQuilt.has(f.id),
    basic: f => !!f.basic,
    mine: f => !f.basic,
  }[group];
  return fabrics
    .filter(f => inGroup(f) && named(f))
    .sort((a, b) => (a.basic === b.basic ? (a.basic ? 0 : (b.added || 0) - (a.added || 0)) : a.basic ? -1 : 1));
}

// ---- the palette: the fabrics a person keeps in the short lists, in their order (removed with ×, added from the
// library). Until they change it there is none, and the lists show the default (basics, recent picks, newest photos).

/**
 * The tiles of a short list: the palette (or the default), then fabrics of the quilt and the chosen one when they
 * aren't on it. `fixed`: can't be taken off now (used in this quilt, or the one chosen).
 * @param {{ palette: string[] | null, defaults: string[], inQuilt?: Iterable<string>, selected?: string | null }} o
 * @returns {{ id: string, fixed: boolean }[]}
 */
export function paletteList({ palette, defaults, inQuilt = [], selected = null }) {
  const keep = new Set(inQuilt);
  if (selected) keep.add(selected);
  const ids = [...(palette || defaults)];
  for (const id of keep) if (!ids.includes(id)) ids.push(id);
  return ids.map(id => ({ id, fixed: keep.has(id) }));
}

/** The palette without a fabric. @param {string[]} palette @param {string} id */
export const withoutFabric = (palette, id) => palette.filter(x => x !== id);

/** The palette with a fabric at its end (once). @param {string[]} palette @param {string} id */
export const withFabric = (palette, id) => (palette.includes(id) ? palette : [...palette, id]);
