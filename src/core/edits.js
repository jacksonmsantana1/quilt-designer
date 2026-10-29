// @ts-check
// Edits to a design (pure). Each takes a design and returns a new one, sharing every block it does not change,
// or the same design when nothing changes. They never touch the page, storage or the selection:
// designer/dispatch.js applies them, then mirrors the change (symmetry), saves it and redraws.
import { newBlock } from './design.js';
import { setSpan } from './geometry.js';
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Block} Block */

const clone = x => JSON.parse(JSON.stringify(x));

/** Changes the given blocks (large blocks' covered cells are skipped). @param {Design} d @param {Iterable<number>} ids @param {(b: Block, i: number) => Block} fn @returns {Design} */
function mapBlocks(d, ids, fn) {
  const set = new Set(ids);
  let changed = false;
  const blocks = d.blocks.map((b, i) => {
    if (!set.has(i) || b.under != null) return b;
    const nb = fn(b, i);
    if (nb !== b) changed = true;
    return nb;
  });
  return changed ? { ...d, blocks } : d;
}
/** A block with `key` set to `value`, or without `key` when value is `none`. */
function withField(b, key, value, none = undefined) {
  const { [key]: _old, ...rest } = b;
  return value === none ? rest : { ...rest, [key]: value };
}

// ---- blocks
/** Turns blocks a quarter turn clockwise. @param {Design} d @param {Iterable<number>} ids */
const rotateBlocks = (d, ids) => mapBlocks(d, ids, b => ({ ...b, rot: ((b.rot || 0) + 1) % 4 }));

/** Mirrors blocks left to right (or back). @param {Design} d @param {Iterable<number>} ids */
const flipBlocks = (d, ids) => mapBlocks(d, ids, b => withField(b, 'flip', !b.flip, false));

/** Gives a fabric to some parts of the blocks of one pattern. @param {Design} d @param {Iterable<number>} ids @param {string} pattern @param {Iterable<number>} parts @param {string} fid */
function setPartFabric(d, ids, pattern, parts, fid) {
  const ps = new Set(parts);
  return mapBlocks(d, ids, b =>
    b.pattern !== pattern || [...ps].every(pi => b.fabrics[pi] === fid)
      ? b
      : { ...b, fabrics: b.fabrics.map((f, pi) => (ps.has(pi) ? fid : f)) },
  );
}

/** Changes the pattern of blocks, keeping their turn, mirror and size; `roles` are the fabrics of the colour roles. @param {Design} d @param {Iterable<number>} ids @param {string} key @param {string[]} roles */
const setPattern = (d, ids, key, roles) =>
  mapBlocks(d, ids, b => ({
    ...newBlock(key, roles),
    rot: b.rot,
    ...(b.flip ? { flip: true } : {}),
    ...(b.span > 1 ? { span: b.span } : {}),
  }));

/** Copies a block into others; each keeps its own size. @param {Design} d @param {Block} src @param {Iterable<number>} ids */
const copyBlock = (d, src, ids) =>
  mapBlocks(d, ids, b => {
    const { span: _s, under: _u, ...copy } = clone(src);
    return b.span > 1 ? { ...copy, span: b.span } : copy;
  });

/** Sets (or clears, with uv = null) the fussy cut of one part, in the blocks of one pattern. @param {Design} d @param {Iterable<number>} ids @param {string} pattern @param {number} part @param {[number, number] | null} uv */
const setFussy = (d, ids, pattern, part, uv) =>
  mapBlocks(d, ids, b => {
    if (b.pattern !== pattern) return b;
    const f = { ...(b.fussy || {}) };
    if (uv == null) delete f[part];
    else f[part] = uv;
    return withField(b, 'fussy', Object.keys(f).length ? f : undefined);
  });

/** Makes block i cover k × k cells. @param {Design} d @param {number} i @param {number} k */
const setBlockSpan = (d, i, k) => setSpan(d, i, k);

// ---- the whole quilt
/** @param {Design} d @param {string} fid */
const setBackFabric = (d, fid) => (d.backFabric === fid ? d : { ...d, backFabric: fid });
/** @param {Design} d @param {number} mm */
const setBlockMm = (d, mm) => (d.blockMm === mm ? d : { ...d, blockMm: mm });
/** @param {Design} d @param {import('./types.js').QuiltingKind} kind */
const setQuilting = (d, kind) => withField(d, 'quilting', kind, 'ditch');
/** Changes the sashing; `patch` is merged into it. @param {Design} d @param {Partial<import('./types.js').Sashing>} patch */
function setSashing(d, patch) {
  const cur = d.sashing || { mm: 0, fabric: 'b0', corner: 'b3', border: false },
    next = { ...cur, ...patch };
  if (!(next.mm > 0)) next.mm = 0;
  return { ...d, sashing: next };
}
/** Changes the borders: `fn` gets a copy of the list and changes it. @param {Design} d @param {(bs: import('./types.js').Border[]) => void} fn */
function setBorders(d, fn) {
  const bs = clone(d.borders || []);
  fn(bs);
  return { ...d, borders: bs };
}
/**
 * Changes the number of columns and rows. Existing blocks keep their place; new ones copy the nearest
 * existing block, so the checkerboard carries on.
 * @param {Design} d @param {number} cols @param {number} rows
 */
function resize(d, cols, rows) {
  cols = Math.max(1, Math.min(20, cols | 0));
  rows = Math.max(1, Math.min(20, rows | 0));
  if (cols === d.cols && rows === d.rows) return d;
  const blocks = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (r < d.rows && c < d.cols) blocks.push(d.blocks[r * d.cols + c]);
      else blocks.push(clone(d.blocks[Math.min(r, d.rows - 1) * d.cols + Math.min(c, d.cols - 1)]));
    }
  return { ...d, cols, rows, blocks };
}
// resizing is never mirrored: every block changes place
resize.mirror = false;

export {
  copyBlock,
  flipBlocks,
  mapBlocks,
  resize,
  rotateBlocks,
  setBackFabric,
  setBlockMm,
  setBlockSpan,
  setBorders,
  setFussy,
  setPartFabric,
  setPattern,
  setQuilting,
  setSashing,
};
