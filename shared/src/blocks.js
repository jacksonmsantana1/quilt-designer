// Traditional pieced blocks, drawn for this app in the grid notation of grid-blocks.js. They are old public
// designs, drawn here from scratch (nothing copied from a pattern book or website). `node shared/tools/block-sheet.mjs`
// draws them all on one page to check them by eye.
// @ts-check

/** @type {Record<string, import('./grid-blocks.js').GridDef & { label: string, family: string }>} */
const GRID_BLOCKS = {
  // ---- four patch family
  doublefour: {
    label: 'Double four patch',
    family: 'Four patch',
    n: 4,
    rows: String.raw`
      1 0 0 -
      0 1 | +
      0 - 1 0
      | + 0 1`,
  },
  sixteen: {
    label: 'Sixteen patch',
    family: 'Four patch',
    n: 4,
    rows: String.raw`
      1 0 1 0
      0 1 0 1
      1 0 1 0
      0 1 0 1`,
  },
  diamond: {
    label: 'Diamond',
    family: 'Four patch',
    n: 2,
    rows: String.raw`
      0/1 1\0
      0\1 1/0`,
  },
  bowtie: {
    label: 'Bow tie',
    family: 'Four patch',
    n: 4,
    rows: String.raw`
      1 - x x
      | + x x
      x x 1 -
      x x | +`,
    extra: [
      ['Background · upper right', 0, [2, 0, 4, 0, 4, 2, 3, 2, 2, 1]],
      ['Knot · upper right', 1, [2, 1, 3, 2, 2, 2]],
      ['Background · lower left', 0, [0, 2, 1, 2, 2, 3, 2, 4, 0, 4]],
      ['Knot · lower left', 1, [1, 2, 2, 2, 2, 3]],
    ],
  },
  dutchman: {
    label: "Dutchman's puzzle",
    family: 'Four patch',
    n: 4,
    fourfold: true,
    rows: String.raw`
      ^10 -
      ^20 -`,
  },
  windowpane: {
    label: 'Window pane',
    family: 'Four patch',
    n: 5,
    rows: String.raw`
      0 - 1 0 -
      | + | | +
      1 - 2 1 -
      0 - 1 0 -
      | + | | +`,
  },
  // ---- nine patch family
  shoofly: {
    label: 'Shoo fly',
    family: 'Nine patch',
    n: 3,
    rows: String.raw`
      1/0 0 0\1
      0   1 0
      1\0 0 0/1`,
  },
  splitnine: {
    label: 'Split nine patch',
    family: 'Nine patch',
    n: 3,
    rows: String.raw`
      1   1   1/0
      1   1/0 0
      1/0 0   0`,
  },
  puss: {
    label: 'Puss in the corner',
    family: 'Nine patch',
    n: 4,
    rows: String.raw`
      1 0 - 1
      0 2 - 0
      | | + |
      1 0 - 1`,
  },
  plus: {
    label: 'Plus',
    family: 'Nine patch',
    n: 3,
    rows: String.raw`
      0 1 0
      1 | 1
      0 | 0`,
  },
  snowball: {
    label: 'Snowball',
    family: 'Nine patch',
    n: 3,
    rows: String.raw`
      x x x
      x x x
      x x x`,
    extra: [
      ['Snowball', 1, [1, 0, 2, 0, 3, 1, 3, 2, 2, 3, 1, 3, 0, 2, 0, 1]],
      ['Corner · upper left', 0, [0, 0, 1, 0, 0, 1]],
      ['Corner · upper right', 0, [2, 0, 3, 0, 3, 1]],
      ['Corner · lower right', 0, [3, 2, 3, 3, 2, 3]],
      ['Corner · lower left', 0, [0, 2, 1, 3, 0, 3]],
    ],
  },
  attic: {
    label: 'Attic windows',
    family: 'Nine patch',
    n: 3,
    rows: String.raw`
      x x x
      x x x
      x x x`,
    extra: [
      ['Window', 0, [1, 0, 3, 0, 3, 2, 1, 2]],
      ['Sill · left', 1, [0, 0, 1, 0, 1, 2, 0, 3]],
      ['Sill · bottom', 2, [0, 3, 1, 2, 3, 2, 3, 3]],
    ],
  },
  churnrev: {
    label: 'Churn dash, reversed',
    family: 'Nine patch',
    n: 6,
    rows: String.raw`
      0/1 - 0 - 1\0 -
      |   + 1 - |   +
      0   1 0 - 1   0
      |   | | + |   |
      0\1 - 1 - 1/0 -
      |   + 0 - |   +`,
  },
  southernpine: {
    label: 'Southern pine',
    family: 'Other',
    n: 5,
    // white 0, the branches (medium) 1, the trunk (dark) 2, the light squares round the trunk 3
    rows: String.raw`
      0/1 0/1 0/1 0   0
      1   |   |   0   0
      1/2 3   0   1/0 -
      2   3   3   1/0 -
      2   2   2/1 1   1/0`,
  },
  emptyspool: {
    label: 'Empty spool',
    family: 'Other',
    n: 8,
    rows: String.raw`
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x
      x x x x x x x x`,
    extra: [
      ['Spool top', 1, [0, 0, 8, 0, 5, 3, 3, 3]],
      ['Thread', 1, [3, 3, 5, 3, 5, 5, 3, 5]],
      ['Spool bottom', 1, [3, 5, 5, 5, 8, 8, 0, 8]],
      ['Side · left', 0, [0, 0, 3, 3, 3, 5, 0, 8]],
      ['Side · right', 0, [8, 0, 8, 8, 5, 5, 5, 3]],
    ],
  },
  cutglass: {
    label: 'Cut glass dish',
    family: 'Larger grids',
    n: 8,
    rows: String.raw`
      1\2 1\2 1\2 1\2 1\2 1\2 0   -
      1\2 1\2 1\2 1\2 1\2 1\2 |   +
      1\2 1\2 0   -   -   -   1\2 1\2
      1\2 1\2 |   +   +   +   1\2 1\2
      1\2 1\2 |   +   +   +   1\2 1\2
      1\2 1\2 |   +   +   +   1\2 1\2
      0   -   1\2 1\2 1\2 1\2 1\2 1\2
      |   +   1\2 1\2 1\2 1\2 1\2 1\2`,
  },
  // ---- stars
  friendstar: {
    label: 'Friendship star',
    family: 'Stars',
    n: 3,
    rows: String.raw`
      0   1\0 0
      0/1 1   1/0
      0   0\1 0`,
  },
  risingstar: {
    label: 'Rising star',
    family: 'Stars',
    n: 8,
    rows: String.raw`
      0   - ^10 -   - - 0   -
      |   + |   +   + + |   +
      <10 - 0   ^20 - 0 >10 -
      |   + <20 1   - >20 | +
      |   + |   |   + | |   +
      |   + 0   v20 - 0 |   +
      0   - v10 -   - - 0   -
      |   + |   +   + + |   +`,
  },
  // ---- strips and logs
  railfence: {
    label: 'Rail fence',
    family: 'Strips and logs',
    n: 3,
    rows: String.raw`
      1 - -
      2 - -
      0 - -`,
  },
  basket: {
    label: 'Basket weave',
    family: 'Strips and logs',
    n: 4,
    rows: String.raw`
      1 - 1 0
      0 - | |
      1 0 1 -
      | | 0 -`,
  },
  bricks: {
    label: 'Brick wall',
    family: 'Strips and logs',
    n: 4,
    rows: String.raw`
      1 - 0 -
      2 0 - 1
      0 - 2 -
      1 2 - 0`,
  },
  courthouse: {
    label: 'Courthouse steps',
    family: 'Strips and logs',
    n: 7,
    rows: String.raw`
      1 0 - - - - 1
      | 1 0 - - 1 |
      | | 1 0 1 | |
      | | | 2 | | |
      | | | 0 | | |
      | | 0 - - | |
      | 0 - - - - |`,
  },
  coins: {
    label: 'Chinese coins',
    family: 'Strips and logs',
    n: 5,
    rows: String.raw`
      1 0 2 0 1
      2 | 1 | 2
      1 | 2 | 1
      2 | 1 | 2
      1 | 2 | 1`,
  },
  chevron: {
    label: 'Chevron',
    family: 'Strips and logs',
    n: 4,
    rows: String.raw`
      0/1 1\0 0/1 1\0
      1/0 0\1 1/0 0\1
      0/2 2\0 0/2 2\0
      2/0 0\2 2/0 0\2`,
  },
  // ---- larger grids
  twentyfive: {
    label: 'Twenty-five patch',
    family: 'Larger grids',
    n: 5,
    rows: String.raw`
      1 0 1 0 1
      0 1 0 1 0
      1 0 1 0 1
      0 1 0 1 0
      1 0 1 0 1`,
  },
  irishchain: {
    label: 'Double Irish chain',
    family: 'Larger grids',
    n: 5,
    rows: String.raw`
      1 0 2 0 1
      0 1 0 1 0
      2 0 1 0 2
      0 1 0 1 0
      1 0 2 0 1`,
  },
  fourqueens: {
    label: '4 Queens',
    family: 'Larger grids',
    n: 7,
    // read from a picture by the block reader as it is; its piece count matches the picture's cutting list
    rows: String.raw`
      0     1\0   0/1   0     1\0   0/1   0
      0\1   2     2/1   10\0  1\2   2     1/0
      0/1   2/1   1/2   q1202 2\1   1\2   1\0
      0     0/10  q2021 0     q2120 01/0  0
      0\1   2\1   1\2   q0212 2/1   1/2   1/0
      0/1   2     2\1   0\10  1/2   2     1\0
      0     1/0   0\1   0     1/0   0\1   0`,
  },
  wingedsquare: {
    label: 'Winged square set',
    family: 'Larger grids',
    n: 12,
    // read from a picture by the block reader (shared/tools/read-block.mjs); the plain 2 × 2 squares joined by hand
    rows: String.raw`
      0   -   1\0 1\0 1\0 1\0 0/1 0/1 0/1 0/1 0   -
      |   +   1\0 1\0 1\0 1\0 0/1 0/1 0/1 0/1 |   +
      0\1 0\1 2   -   1\0 1\0 0/1 0/1 2   -   1/0 1/0
      0\1 0\1 |   +   1\0 1\0 0/1 0/1 |   +   1/0 1/0
      0\1 0\1 0\1 0\1 0   -   0   -   1/0 1/0 1/0 1/0
      0\1 0\1 0\1 0\1 |   +   |   +   1/0 1/0 1/0 1/0
      0/1 0/1 0/1 0/1 0   -   0   -   1\0 1\0 1\0 1\0
      0/1 0/1 0/1 0/1 |   +   |   +   1\0 1\0 1\0 1\0
      0/1 0/1 2   -   1/0 1/0 0\1 0\1 2   -   1\0 1\0
      0/1 0/1 |   +   1/0 1/0 0\1 0\1 |   +   1\0 1\0
      0   -   1/0 1/0 1/0 1/0 0\1 0\1 0\1 0\1 0   -
      |   +   1/0 1/0 1/0 1/0 0\1 0\1 0\1 0\1 |   +`,
  },
  bearspaw: {
    label: "Bear's paw",
    family: 'Larger grids',
    n: 7,
    fourfold: true,
    rows: String.raw`
      0   0/1 0/1 0
      0/1 1   -   |
      0/1 |   +   |`,
    extra: [['Centre', 2, [3, 3, 4, 3, 4, 4, 3, 4]]],
  },
  centerdiamond: {
    label: 'Center diamond',
    family: 'Larger grids',
    n: 6,
    rows: String.raw`
      2 1 - - - 2
      1 x x x x 1
      | x x x x |
      | x x x x |
      | x x x x |
      2 1 - - - 2`,
    extra: [
      ['Diamond', 2, [3, 1, 5, 3, 3, 5, 1, 3]],
      ['Field · upper left', 0, [1, 1, 3, 1, 1, 3]],
      ['Field · upper right', 0, [3, 1, 5, 1, 5, 3]],
      ['Field · lower right', 0, [5, 3, 5, 5, 3, 5]],
      ['Field · lower left', 0, [1, 3, 3, 5, 1, 5]],
    ],
  },
};

export { GRID_BLOCKS };
