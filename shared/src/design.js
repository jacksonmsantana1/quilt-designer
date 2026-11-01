// @ts-check
// Making designs and blocks (pure).
import { partsOf } from './patterns.js';
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Block} Block */

/** Version of the saved design format (see core/format.js). */
const FORMAT_VERSION = 7;

// A block's parts have colour roles 0 to 5: 0 background, 1 main, 2 accent, then 3, 4 and 5 for blocks with more
// fabrics (most use only the first three). Designs keep a fabric per part, not roles: roles only pick the fabrics a
// new block starts in, and the colours of the pattern pictures.
/** How many colour roles there are. */
const ROLE_COUNT = 6;
/** Default fabric for each colour role: cream, indigo, mustard, sage, rose, chocolate. */
const ROLE_DEFAULT = ['b0', 'b1', 'b3', 'b5', 'b8', 'b10'];
/** The colour each role is drawn in on pattern pictures (the default fabrics' colours). */
const ROLE_COLOURS = ['#efe5cf', '#2f466f', '#c79a45', '#7d8f70', '#b26a5f', '#4a2c22'];

/** A new block of a pattern, each part in the fabric of its colour role. @param {string} [pattern] @param {string[]} [roles] @returns {Block} */
function newBlock(pattern = 'ohio', roles = ROLE_DEFAULT) {
  return { pattern, rot: 0, fabrics: partsOf(pattern).map(p => roles[p.role] || roles[0]) };
}

/** The quilt every new design starts from: 5 × 5, Ohio stars and nine-patches, 458 mm blocks. @returns {Design} */
function defaultDesign() {
  const d = { v: FORMAT_VERSION, cols: 5, rows: 5, blockMm: 458, backFabric: 'b0', blocks: [] };
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      d.blocks.push((r + c) % 2 === 0 ? newBlock('ohio', ['b0', 'b1', 'b3']) : newBlock('nine', ['b0', 'b4', 'b3']));
  return d;
}

/**
 * What the New design button starts from: three plain cream squares in a row (3 × 1, 300 mm blocks, 900 × 300 mm), ready
 * to be given a pattern, fabrics, sashing and borders. @returns {Design}
 */
function newDesign() {
  return {
    v: FORMAT_VERSION,
    cols: 3,
    rows: 1,
    blockMm: 300,
    backFabric: 'b0',
    blocks: [0, 1, 2].map(() => newBlock('plain', ['b0'])),
  };
}

/** The fabric of each colour role in a block (the first part of each role), for carrying colours to a new pattern. @param {Block} b @returns {string[]} */
function rolesOf(b) {
  const roles = [...ROLE_DEFAULT],
    seen = new Array(ROLE_COUNT).fill(false);
  partsOf(b.pattern).forEach((p, i) => {
    if (!seen[p.role]) {
      roles[p.role] = b.fabrics[i];
      seen[p.role] = true;
    }
  });
  return roles;
}

export { FORMAT_VERSION, ROLE_COLOURS, ROLE_COUNT, ROLE_DEFAULT, defaultDesign, newBlock, newDesign, rolesOf };
