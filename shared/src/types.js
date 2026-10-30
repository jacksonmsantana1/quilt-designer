// Types of the design data, as JSDoc (checked with `npm run typecheck`; no code here).

/** A point [x, y] in a block's unit square (0..1, y down) or in millimetres. @typedef {number[]} Point */
/** @typedef {Point[]} Poly */

/**
 * One part of a block pattern.
 * @typedef {object} Part
 * @property {string} name
 * @property {number} role   colour role 0 to 5: 0 background, 1 main, 2 accent, 3–5 more (picks the default fabric)
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
 * @property {boolean} [cornerstones]  false: no cornerstones, the strips between rows run the full width
 * @property {Block} [cornerBlock]  cornerstones pieced as this block (pattern and fabrics) instead of plain fabric;
 *                                  used only while the sashing is wider than 75 mm (CORNER_BLOCK_MIN_MM)
 */

/**
 * One border; borders[0] is the innermost.
 * @typedef {object} Border
 * @property {'plain' | 'piano' | 'squares' | 'checker' | 'sawtooth' | 'geese'} type
 * @property {number} mm          finished width
 * @property {string[]} fabrics   fabric slots (see BORDER_TYPES[type].slots)
 */

/**
 * A shape mosaic (shared/src/mosaic.js): the quilt top is one shape repeated all over instead of blocks.
 * @typedef {object} Mosaic
 * @property {'hex' | 'diamond' | 'triangle'} shape  hexagons, diamonds (tumbling blocks) or triangles
 * @property {number} mm          finished length of one side of the shape
 * @property {number} cols        shapes across
 * @property {number} rows        rows of shapes
 * @property {string[]} fabrics   fabric of each shape, row by row (see mosaicTiles)
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
 * @property {Block[]} blocks      row by row: blocks[r * cols + c]; on point, then the (cols-1) × (rows-1) between
 * @property {'onpoint'} [setting] blocks turned 45° in diagonal rows (missing: straight)
 * @property {string} [settingFabric] on point: the fabric of the triangles along the edges
 * @property {Mosaic} [mosaic]    a shape mosaic instead of the blocks (the blocks are kept for going back)
 * @property {Sashing} [sashing]
 * @property {Border[]} [borders]
 * @property {SymmetryMode} [sym]
 * @property {QuiltingKind} [quilting]
 */

/** Orientation of a block. @typedef {{ rot: number, flip: boolean }} Orientation */
/** A rectangle on a drawing. @typedef {{ x: number, y: number, w: number, h: number }} Rect */

export {};
