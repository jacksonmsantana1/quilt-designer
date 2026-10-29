// Types of the design data, as JSDoc (checked with `npm run typecheck`; no code here).

/** A point [x, y] in a block's unit square (0..1, y down) or in millimetres. @typedef {number[]} Point */
/** @typedef {Point[]} Poly */

/**
 * One part of a block pattern.
 * @typedef {object} Part
 * @property {string} name
 * @property {0 | 1 | 2} role   colour role: 0 background, 1 main, 2 accent (picks the default fabric)
 * @property {Poly} poly        polygon in the block's unit square
 */

/**
 * One cell of the grid. A large block (span > 1) covers span × span cells; the cells it covers keep their own
 * data but carry `under` = the large block's index and are neither drawn nor cut.
 * @typedef {object} Block
 * @property {string} pattern                   key of PATTERNS
 * @property {number} rot                       quarter turns, 0..3
 * @property {boolean} [flip]                   mirrored left to right (after turning)
 * @property {string[]} fabrics                 fabric id for each part, in the pattern's part order
 * @property {number} [span]                    large block: cells per side (2..4)
 * @property {number} [under]                   index of the large block covering this cell
 * @property {Record<number, [number, number]>} [fussy]  part index -> point of the print (fractions of one repeat) centred in it
 */

/**
 * Strips between the blocks.
 * @typedef {object} Sashing
 * @property {number} mm          finished width; 0 = none
 * @property {string} [fabric]
 * @property {string} [corner]    fabric of the cornerstones
 * @property {boolean} [border]   also all round the outside
 */

/**
 * One border; borders[0] is the innermost.
 * @typedef {object} Border
 * @property {'plain' | 'piano' | 'squares' | 'checker' | 'sawtooth' | 'geese'} type
 * @property {number} mm          finished width
 * @property {string[]} fabrics   fabric slots (see BORDER_TYPES[type].slots)
 */

/** @typedef {'off' | 'lr' | 'tb' | 'both' | 'kal'} SymmetryMode */
/** @typedef {'ditch' | 'cross' | 'fans' | 'meander'} QuiltingKind */

/**
 * The quilt being designed. Saved as JSON in localStorage and in My designs.
 * @typedef {object} Design
 * @property {number} [v]        format version (core/format.js); missing in designs saved before versions
 * @property {number} cols
 * @property {number} rows
 * @property {number} blockMm      finished size of one grid cell
 * @property {string} backFabric
 * @property {Block[]} blocks      row by row: blocks[r * cols + c]
 * @property {Sashing} [sashing]
 * @property {Border[]} [borders]
 * @property {SymmetryMode} [sym]
 * @property {QuiltingKind} [quilting]
 */

/** Orientation of a block. @typedef {{ rot: number, flip: boolean }} Orientation */
/** A rectangle on a drawing. @typedef {{ x: number, y: number, w: number, h: number }} Rect */

export {};
