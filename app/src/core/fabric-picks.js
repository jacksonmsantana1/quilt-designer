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
 * The fabric library's search: every word typed must be in the name (any case, accents ignored), within the
 * chosen group. Basics come first, then photos newest first; the "recent" group keeps its own order.
 * @template {{ id: string, name: string, basic?: boolean, added?: number }} F
 * @param {F[]} fabrics
 * @param {{ query?: string, group?: 'all' | 'quilt' | 'recent' | 'basic' | 'mine',
 *   inQuilt?: Set<string>, recent?: string[] }} o
 * @returns {F[]}
 */
export function findFabrics(fabrics, { query = '', group = 'all', inQuilt = new Set(), recent = [] }) {
  const plain = s =>
    s
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .toLowerCase(); // "appliqué" -> "applique"
  const words = plain(query)
    .split(/[\s,]+/)
    .filter(Boolean);
  const named = f => {
    const n = plain(f.name);
    return words.every(w => n.includes(w));
  };
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
