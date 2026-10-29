// Moving the data the app kept in localStorage (before IndexedDB) into the new stores (pure: reads the given
// storage, changes nothing; the old keys are left in place for now, so an older copy of the app still works).
import { readDesign } from '../core/format.js';

const OLD = {
  current: 'quilt-designer.v1',
  mine: 'quilt-mydesigns.v1',
  mineCur: 'quilt-mydesigns-current.v1',
  timeline: 'quilt-timeline.v1', // bare key: the one timeline before each design had its own
  seeded: ['quilt-medallion-seeded.v1', 'quilt-photo-seeded.v1'],
};

/** @param {Storage} ls */
function readJson(ls, key) {
  try {
    const t = ls.getItem(key);
    return t == null ? null : JSON.parse(t);
  } catch (e) {
    return null;
  }
}
/**
 * A saved design upgraded to the current format. One that needs repairs (or comes from a newer version) is kept as
 * it was, so nothing is thrown away and the user is told about the repairs when it is opened.
 */
function upgraded(raw) {
  const r = readDesign(raw);
  if (r && !r.problems.length && !r.newer) return r.design;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return raw;
  }
}

/**
 * What to put in the new stores. @param {Storage} ls
 * @returns {{ designs: any[], timelines: any[], session: [string, any][] }}
 */
function migrateLocalStorage(ls) {
  /** @type {{ designs: any[], timelines: any[], session: [string, any][] }} */
  const out = { designs: [], timelines: [], session: [] };
  let current = null;
  try {
    current = ls.getItem(OLD.current);
  } catch (e) {}
  if (current != null) out.session.push(['current', upgraded(current)]);

  const mine = readJson(ls, OLD.mine);
  if (Array.isArray(mine))
    for (const m of mine) {
      if (!m || typeof m.id !== 'string') continue;
      out.designs.push({
        id: m.id,
        name: String(m.name || 'Quilt'),
        design: upgraded(m.d),
        createdAt: +m.created || Date.now(),
        updatedAt: +m.updated || +m.created || Date.now(),
        rev: 1,
        deleted: false,
        dirty: true,
      });
    }
  let mineCur = null;
  try {
    mineCur = ls.getItem(OLD.mineCur);
  } catch (e) {}
  if (mineCur) out.session.push(['mineCur', mineCur]);
  for (const k of OLD.seeded) {
    try {
      if (ls.getItem(k)) out.session.push([k.replace(/^quilt-|\.v1$/g, ''), true]);
    } catch (e) {}
  }

  // timelines: 'quilt-timeline.v1:<design id | draft | tour>'
  const keys = [];
  try {
    for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
  } catch (e) {}
  const seen = new Set();
  for (const k of keys) {
    if (!k || !k.startsWith(OLD.timeline + ':')) continue;
    const t = readJson(ls, k),
      key = k.slice(OLD.timeline.length + 1);
    if (t && Array.isArray(t.steps)) {
      out.timelines.push({ key, steps: t.steps, i: +t.i || 0, seq: +t.seq || t.steps.length });
      seen.add(key);
    }
  }
  const bare = readJson(ls, OLD.timeline),
    bareKey = mineCur || 'draft';
  if (bare && Array.isArray(bare.steps) && !seen.has(bareKey))
    out.timelines.push({ key: bareKey, steps: bare.steps, i: +bare.i || 0, seq: +bare.seq || bare.steps.length });
  return out;
}

export { OLD, migrateLocalStorage };
