// @ts-check
// Making designs and blocks (pure).
import { partsOf } from './patterns.js';
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Block} Block */

/** Default fabric for each colour role: cream, indigo, mustard. */
const ROLE_DEFAULT = ['b0', 'b1', 'b3'];

/** A new block of a pattern, each part in the fabric of its colour role. @param {string} [pattern] @param {string[]} [roles] @returns {Block} */
function newBlock(pattern = 'ohio', roles = ROLE_DEFAULT) {
  return { pattern, rot: 0, fabrics: partsOf(pattern).map(p => roles[p.role] || roles[0]) };
}

/** The quilt every new design starts from: 5 × 5, Ohio stars and nine-patches, 458 mm blocks. @returns {Design} */
function defaultDesign() {
  const d = { cols: 5, rows: 5, blockMm: 458, backFabric: 'b0', blocks: [] };
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      d.blocks.push((r + c) % 2 === 0 ? newBlock('ohio', ['b0', 'b1', 'b3']) : newBlock('nine', ['b0', 'b4', 'b3']));
  return d;
}

/** The fabric of each colour role in a block (the first part of each role), for carrying colours to a new pattern. @param {Block} b @returns {string[]} */
function rolesOf(b) {
  const roles = [...ROLE_DEFAULT],
    seen = [false, false, false];
  partsOf(b.pattern).forEach((p, i) => {
    if (!seen[p.role]) {
      roles[p.role] = b.fabrics[i];
      seen[p.role] = true;
    }
  });
  return roles;
}

export { ROLE_DEFAULT, defaultDesign, newBlock, rolesOf };
