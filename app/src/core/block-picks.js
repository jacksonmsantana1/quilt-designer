// Which block patterns to offer: the block library's search and groups. Pure, so the unit tests use it directly.
import { wordsMatcher } from './fabric-picks.js';

/** The patterns a design uses (its blocks, and a pieced cornerstone). @param {any} design @returns {Set<string>} */
export function patternsIn(design) {
  const out = new Set();
  if (!design) return out;
  for (const b of design.blocks) if (b.under == null) out.add(b.pattern);
  if (design.sashing?.cornerBlock) out.add(design.sashing.cornerBlock.pattern);
  return out;
}

/**
 * The block library's search: every word typed must be in the block's name or family, within the chosen group
 * ('all', 'quilt', 'recent', or a family's name). Library order, except "recent", which keeps its own.
 * @template {{ key: string, label: string, family: string, also?: string }} B
 * @param {B[]} blocks @param {{ query?: string, group?: string, inQuilt?: Set<string>, recent?: string[] }} o
 * @returns {B[]}
 */
export function findBlocks(blocks, { query = '', group = 'all', inQuilt = new Set(), recent = [] }) {
  const matches = wordsMatcher(query),
    found = b => matches(`${b.label} ${b.family} ${b.also || ''}`); // also: the English name and the family as shown
  if (group === 'recent') {
    const byKey = new Map(blocks.map(b => [b.key, b]));
    return recent.map(k => byKey.get(k)).filter(b => b && found(b));
  }
  const inGroup = group === 'all' ? () => true : group === 'quilt' ? b => inQuilt.has(b.key) : b => b.family === group;
  return blocks.filter(b => inGroup(b) && found(b));
}
