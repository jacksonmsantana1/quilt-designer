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
    label: 'Double Irish chain I',
    family: 'Larger grids',
    n: 5,
    rows: String.raw`
      1 0 2 0 1
      0 1 0 1 0
      2 0 1 0 2
      0 1 0 1 0
      1 0 2 0 1`,
  },
  irishchain2: {
    label: 'Double Irish chain II',
    family: 'Larger grids',
    n: 5,
    // read from a picture by the block reader as it is: four corner squares, four strips and a large centre square
    rows: String.raw`
      1 0 - - 1
      0 0 - - 0
      | | + + |
      | | + + |
      1 0 - - 1`,
  },
  carpenterssquare: {
    label: "Carpenter's square",
    family: 'Larger grids',
    n: 10,
    // from a picture: each square's colour sampled between the printed seams (the block reader joined some of them)
    rows: String.raw`
      1 1 1 1 1 1 1 1 1 1
      1 0 0 0 0 1 0 1 0 1
      1 0 1 1 1 1 1 1 1 1
      1 0 1 0 0 1 0 1 0 1
      1 0 1 0 1 1 1 1 1 1
      1 1 1 1 1 1 0 1 0 1
      1 0 1 0 1 0 0 1 0 1
      1 1 1 1 1 1 1 1 0 1
      1 0 1 0 1 0 0 0 0 1
      1 1 1 1 1 1 1 1 1 1`,
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
  henschickens: {
    label: 'Hens and chickens',
    family: 'Larger grids',
    n: 7,
    // read from a picture by the block reader; the 2 × 2 squares and 1 × 3 strips joined as the picture shows them
    rows: String.raw`
      2/3 2/3 2/3 1   3\2 3\2 3\2
      2/3 0   -   |   0   -   3\2
      2/3 |   +   |   |   +   3\2
      1   -   -   2   1   -   -
      2\3 0   -   1   0   -   3/2
      2\3 |   +   |   |   +   3/2
      2\3 2\3 2\3 |   3/2 3/2 3/2`,
  },
  farmerspuzzle: {
    label: "Farmer's puzzle",
    family: 'Larger grids',
    n: 9,
    // read from a picture by the block reader as it is (big triangles and strips joined where no seam is printed)
    rows: String.raw`
      1/0 -   0/1 -   0   1/0 -   0\1 -
      |   +   |   +   |   |   +   |   +
      1\0 -   0\1 -   |   0/1 -   1\0 -
      |   +   |   +   |   |   +   |   +
      0   -   -   -   0   0   -   -   -
      0\1 -   1/0 -   0   1\0 -   0\1 -
      |   +   |   +   |   |   +   |   +
      1\0 -   0/1 -   |   1/0 -   0/1 -
      |   +   |   +   |   |   +   |   +`,
  },
  followleader: {
    label: 'Follow the leader',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0   1/0 0\1 0\1 0
      1/0 0   |   0   0\1
      1/0 -   1   0/1 -
      1\0 0   1\0 0   0/1
      0   1\0 |   0/1 0`,
  },
  pinwheelsquare: {
    label: 'Pinwheel square',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      2   1/0 1\0 3\0 2
      0/3 3\0 |   3/0 0\1
      0/1 -   2   1/0 -
      1\0 0/3 0\1 0\3 3/0
      2   0\3 |   0/1 2`,
  },
  kicks: {
    label: 'Kicks',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0   0   0\1 1\0 0
      0/1 1\0 0/1 1/0 0
      1/0 0\1 2   1\0 0/1
      0   0/1 1/0 0\1 1/0
      0   0\1 1\0 0   0`,
  },
  simplefivepatch: {
    label: 'Simple five-patch',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0 0 0 1 0
      1 0 1 0 0
      0 1 0 1 0
      0 0 1 0 1
      0 1 0 0 0`,
  },
  flyingsquare: {
    label: 'Flying square',
    family: 'Other',
    n: 5,
    // from a picture: two greys, a dark, a check (4) and a dot print (5). The reader joined the dotted squares to the
    // white ones above them (white dots on white), so those are written by hand
    rows: String.raw`
      0 0 0 2 0
      4 1 4 1 0
      0 3 0 2 0
      0 1 5 1 5
      0 3 0 0 0`,
  },
  blocksinabox: {
    label: 'Blocks in a box',
    family: 'Other',
    n: 5,
    // from a picture: 25 separate squares (the reader joined two side squares into strips the picture doesn't show);
    // the dark box outside, the light one inside it, the centre square its own fabric
    rows: String.raw`
      1 1 1 1 1
      1 0 0 0 1
      1 0 2 0 1
      1 0 0 0 1
      1 1 1 1 1`,
  },
  childrensdelight: {
    label: "Children's delight",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the grey squares the main colour, the white ones the background)
    rows: String.raw`
      0 1 1 1 1
      0 1 0 0 1
      1 0 1 1 0
      1 0 1 1 0
      1 1 0 0 1`,
  },
  plaid: {
    label: 'Plaid',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white squares the background, the dark ones the main colour)
    rows: String.raw`
      3 1 0 1 3
      2 - 1 2 -
      0 1 0 1 0
      2 - 1 2 -
      3 1 0 1 3`,
  },
  starcross: {
    label: 'Star and cross',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0 0 1 0 0
      0 2 1 2 0
      1 1 3 1 1
      0 2 1 2 0
      0 0 1 0 0`,
  },
  starcrossset1: {
    label: 'Star and cross set 1',
    family: 'Larger grids',
    n: 10,
    // Star and cross, 2 × 2 (the picture's small squares were too small for the block reader)
    rows: String.raw`
      0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0
      0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0`,
  },
  starcrossset2: {
    label: 'Star and cross set 2',
    family: 'Larger grids',
    n: 20,
    // Star and cross, 4 × 4 (larger than the block reader's grids)
    rows: String.raw`
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1 1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1 1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1 1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      1 1 3 1 1 1 1 3 1 1 1 1 3 1 1 1 1 3 1 1
      0 2 1 2 0 0 2 1 2 0 0 2 1 2 0 0 2 1 2 0
      0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0`,
  },
  stepsaltar: {
    label: 'Steps to the altar',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0\1 0   1   0   1
      0   0\1 0   1   0
      0   0   0\1 0   1
      0   0   0   0\1 0
      0   0   0   0   0\1`,
  },
  greekcross: {
    label: 'Greek cross',
    family: 'Other',
    n: 5,
    // from a picture: the block reader's cells, without the strips it joined where the picture prints seams; the
    // dark fabric the main colour, the light triangles along the band the accent
    rows: String.raw`
      1\2 1   1   1   1
      0\1 1\2 1   0   1
      0   0\1 1\2 1   1
      0   0   0\1 1\2 1
      0   0   0   0\1 1\2`,
  },
  kingscrown2: {
    label: "King's crown II",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0   0   0   0   1
      0   2   0   2/1 1/0
      0   0   2/1 1/0 0
      0   2/1 1/0 0   0
      1   1/0 0   0   0`,
  },
  sawtoothfivepatch: {
    label: 'Sawtooth five-patch',
    family: 'Other',
    n: 5,
    // from a picture: the block reader's cells, without the pieces it joined where the picture prints seams
    rows: String.raw`
      0/1 0/1 0/1 0/1 0
      0/1 1   1   1/0 0
      0/1 1   1/0 0   0
      0/1 1/0 0   0   0
      0   0   0   0   0`,
  },
  doublesawtooth5: {
    label: 'Double sawtooth five-patch',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, the dark the main colour, the light centre
    // the accent)
    rows: String.raw`
      0   1/0 1/0 1/0 1
      1/0 2   2   2   0/1
      1/0 2   2   2   0/1
      1/0 2   2   2   0/1
      1   0/1 0/1 0/1 0`,
  },
  ladylake: {
    label: 'Lady of the lake',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0/1 0/1 0/1 0/1 0/1
      0/1 1   1   1/0 0/1
      0/1 1   1/0 0   0/1
      0/1 1/0 0   0   0/1
      0/1 0/1 0/1 0/1 0/1`,
  },
  tentarmageddon: {
    label: 'Tent of Armageddon',
    family: 'Other',
    n: 5,
    // from a picture: 25 alike triangle squares (the block reader took it for a finer grid)
    rows: String.raw`
      1\0 1\0 1\0 1\0 1\0
      1\0 1\0 1\0 1\0 1\0
      1\0 1\0 1\0 1\0 1\0
      1\0 1\0 1\0 1\0 1\0
      1\0 1\0 1\0 1\0 1\0`,
  },
  alaskahomestead: {
    label: 'Alaska homestead',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0   0/1 2   1\0 0
      0/1 1   0   1   1\0
      2   0   2   0   2
      0\1 1   0   1   1/0
      0   0\1 2   1/0 0`,
  },
  wishingring: {
    label: 'Wishing ring',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      1/0 1   0   1   0\1
      1   0/1 1   1\0 1
      0   1   0   1   0
      1   0\1 1   1/0 1
      1\0 1   0   1   0/1`,
  },
  duckducklings: {
    label: 'Duck and ducklings',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0/1 0/1 1   1\0 1\0
      0/1 1   0   1   1\0
      1   0   1   0   1
      0\1 1   0   1   1/0
      0\1 0\1 1   1/0 1/0`,
  },
  singleweddingring: {
    label: 'Single wedding ring I',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0/1 0/1 0   1\0 1\0
      0/1 0/1 1   1\0 1\0
      0   1   0   1   0
      0\1 0\1 1   1/0 1/0
      0\1 0\1 0   1/0 1/0`,
  },
  weddingrings: {
    label: 'Wedding rings',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: the dark triangles the main colour, the ring's squares and triangles two greys,
    // the check in the corners a fifth fabric
    rows: String.raw`
      0/4 1/0 0   0\1 4\0
      1/0 0/3 2   3\0 0\1
      0   2   0   2   0
      1\0 0\3 2   3/0 0/1
      0\4 1\0 0   0/1 4/0`,
  },
  doublewrench: {
    label: 'Double wrench',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0   0/1 0   1\0 0
      0/1 1   1   1   1\0
      0   1   0   1   0
      0\1 1   1   1   1/0
      0   0\1 0   1/0 0`,
  },
  philadelphia5: {
    label: 'Philadelphia pavements five-patch',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: the dark fabric the main colour, the light grey the accent
    rows: String.raw`
      1   2   2   2   1
      2   1/2 0   2\1 2
      2   0   1   0   2
      2   1\2 0   2/1 2
      1   2   2   2   1`,
  },
  ombre: {
    label: 'Ombre',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: light, dark and mid greys stepping in from each corner, a dot print (3) and a
    // check (4) around the centre
    rows: String.raw`
      1/2 2/0 3   0\2 2\1
      2/0 0/1 4   1\0 0\2
      3   4   0   4   3
      2\0 0\1 4   1/0 0/2
      1\2 2\0 3   0/2 2/1`,
  },
  flyinggeese5: {
    label: 'Flying geese five-patch',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0/1 0/1 0   1\0 1\0
      0/1 0/1 0   1\0 1\0
      0   0   1   0   0
      0\1 0\1 0   1/0 1/0
      0\1 0\1 0   1/0 1/0`,
  },
  foolssquare: {
    label: "Fool's square",
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      1/0 1\0 0   0/1 0\1
      0\1 1   0   1   1/0
      0   0   1   0   0
      0/1 1   0   1   1\0
      1\0 1/0 0   0\1 0/1`,
  },
  ezquilt: {
    label: 'E-Z quilt',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: the dark cross the main colour, the light star points and squares the accent
    rows: String.raw`
      0   2\0 1   0/2 0
      0\2 2   1   2   2/0
      1   1   0   1   1
      0/2 2   1   2   2\0
      0   2/0 1   0\2 0`,
  },
  farmersdaughter: {
    label: "Farmer's daughter",
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: the dark squares the main colour, the light star points and squares the accent
    rows: String.raw`
      0   2\0 0   0/2 0
      0\2 2   1   2   2/0
      0   1   2   1   0
      0/2 2   1   2   2\0
      0   2/0 0   0\2 0`,
  },
  cainabel: {
    label: 'Cain and Abel',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: black corner triangles (1), mid grey (2) and light grey (3) squares, a check (4)
    rows: String.raw`
      0/1 0   2   0   1\0
      0   4/0 3   0\4 0
      2   3   0   3   2
      0   4\0 3   0/4 0
      0\1 0   2   0   1/0`,
  },
  davidgoliath: {
    label: 'David and Goliath',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, the grey the main colour, the light the
    // accent); the corner units are three-triangle units
    rows: String.raw`
      0    02/1 1    1\02 0
      20/1 1/2  1    2\1  1\20
      1    1    2    1    1
      20\1 1\2  1    2/1  1/02
      0    02\1 1    1/20 0`,
  },
  oregon: {
    label: 'Oregon',
    family: 'Other',
    n: 10,
    // read from a picture by the block reader: five columns, the side ones cut in half-height pieces, so each square
    // is 2 × 2 cells here (the white bottom squares written apart, as the picture shows them)
    rows: String.raw`
      1   -   0   -   0   -   0   -   1   -
      |   +   |   +   |   +   |   +   |   +
      0   -   0\1 -   0   -   1/0 -   0   -
      1\0 -   |   +   |   +   |   +   0/1 -
      |   +   0   -   1   -   0   -   |   +
      1/0 -   |   +   |   +   |   +   0\1 -
      |   +   0/1 -   0   -   1\0 -   |   +
      0   -   |   +   |   +   |   +   0   -
      1   -   0   -   0   -   0   -   1   -
      |   +   |   +   |   +   |   +   |   +`,
  },
  providence2: {
    label: 'Providence block II',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0     2\0   1     0/2   0
      0\2   0     q1030 0     2/0
      1     q0301 2     q0103 1
      0/2   0     q3010 0     2\0
      0     2/0   1     0\2   0`,
  },
  cathedralwindow5: {
    label: 'Cathedral window five-patch',
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell's four quarters sampled between the printed seams
    rows: String.raw`
      1   0   0   0/1 1\0 0/1 1\0 0   0   1
      0   1   1   0\1 0\1 1/0 1/0 1   1   0
      0   1   1   0/1 0/1 1\0 1\0 1   1   0
      0/1 1\0 0/1 1   1/0 0\1 1   1\0 0/1 1\0
      0\1 1\0 0/1 1/0 0   0   0\1 1\0 0/1 1/0
      0/1 1/0 0\1 1\0 0   0   0/1 1/0 0\1 1\0
      0\1 1/0 0\1 1   1\0 0/1 1   1/0 0\1 1/0
      0   1   1   0\1 0\1 1/0 1/0 1   1   0
      0   1   1   0/1 0/1 1\0 1\0 1   1   0
      1   0   0   0\1 1/0 0\1 1/0 0   0   1`,
  },
  domino5: {
    label: 'Domino five-patch',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell (the block reader took it for a finer grid)
    rows: String.raw`
      1   1\0 0   0/1 1
      0\1 1   1   1   1/0
      0   1   0   1   0
      0/1 1   1   1   1\0
      1   1/0 0   0\1 1`,
  },
  dominochickenfoot: {
    label: 'Domino chicken foot',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      2\1 1\0 0   0/1 1/2
      0\2 1   0   1   2/0
      0   1   2   1   0
      0/2 1   0   1   2\0
      2/1 1/0 0   0\1 1\2`,
  },
  grandmotherspuzzle: {
    label: "Grandmother's puzzle",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      2   0   0   1\0 2
      0   1   1/0 1   1\0
      0   1/0 2   0/1 0
      0\1 1   0/1 1   0
      2   0\1 0   0   2`,
  },
  gardeneden: {
    label: 'Garden of Eden',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, the grey the main colour, the dark centre
    // the accent)
    rows: String.raw`
      0/1 1\0 1   0/1 1\0
      0\1 1/0 1   0\1 1/0
      1   1   2   1   1
      0/1 1\0 1   0/1 1\0
      0\1 1/0 1   0\1 1/0`,
  },
  georgia: {
    label: 'Georgia',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, the light grey the main colour, the dark
    // the accent)
    rows: String.raw`
      0   1   2   1   0
      1   1/2 0   2\1 1
      2   0   1   0   2
      1   1\2 0   2/1 1
      0   1   2   1   0`,
  },
  grandmotherschoice: {
    label: "Grandmother's choice",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, the dark the main colour)
    rows: String.raw`
      1   0/1 0   1\0 1
      0/1 1   0   1   1\0
      0   0   1   0   0
      0\1 1   0   1   1/0
      1   0\1 0   1/0 1`,
  },
  mrskeller: {
    label: "Mrs Keller's patch",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      1/0 1/0 0   0\1 0\1
      1/0 0   1   0   0\1
      0   1   0   1   0
      1\0 0   1   0   0/1
      1\0 1\0 0   0/1 0/1`,
  },
  redcross5: {
    label: 'Red cross five-patch',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is: a dark cross, and a light diamond in each corner
    rows: String.raw`
      0/2 0\2 1   2/0 2\0
      2\0 2/0 1   0\2 0/2
      1   1   0   1   1
      2/0 2\0 1   0/2 0\2
      0\2 0/2 1   2\0 2/0`,
  },
  album5: {
    label: 'Album five-patch',
    family: 'Other',
    n: 10,
    // from a picture (block reader and each cell measured): a 5 × 5 block on a 10 grid, so the middle strip can start
    // and end half a square in, with a light goose pointing at it from each side
    rows: String.raw`
      0/1 -   0/1 -   0   -   1\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +
      0/1 -   0/2 -   0   -   2\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +
      >20 0   -   -   -   -   -   -   -   <20
      |   |   +   +   +   +   +   +   +   |
      0\1 -   0\2 -   0   -   2/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +
      0\1 -   0\1 -   0   -   1/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +`,
  },
  albumset: {
    label: 'Album set',
    family: 'Larger grids',
    n: 20,
    // Album five-patch, 2 × 2
    rows: String.raw`
      0/1 -   0/1 -   0   -   1\0 -   1\0 -   0/1 -   0/1 -   0   -   1\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      0/1 -   0/2 -   0   -   2\0 -   1\0 -   0/1 -   0/2 -   0   -   2\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      >20 0   -   -   -   -   -   -   -   <20 >20 0   -   -   -   -   -   -   -   <20
      |   |   +   +   +   +   +   +   +   |   |   |   +   +   +   +   +   +   +   |
      0\1 -   0\2 -   0   -   2/0 -   1/0 -   0\1 -   0\2 -   0   -   2/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      0\1 -   0\1 -   0   -   1/0 -   1/0 -   0\1 -   0\1 -   0   -   1/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      0/1 -   0/1 -   0   -   1\0 -   1\0 -   0/1 -   0/1 -   0   -   1\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      0/1 -   0/2 -   0   -   2\0 -   1\0 -   0/1 -   0/2 -   0   -   2\0 -   1\0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      >20 0   -   -   -   -   -   -   -   <20 >20 0   -   -   -   -   -   -   -   <20
      |   |   +   +   +   +   +   +   +   |   |   |   +   +   +   +   +   +   +   |
      0\1 -   0\2 -   0   -   2/0 -   1/0 -   0\1 -   0\2 -   0   -   2/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +
      0\1 -   0\1 -   0   -   1/0 -   1/0 -   0\1 -   0\1 -   0   -   1/0 -   1/0 -
      |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +   |   +`,
  },
  memory: {
    label: 'Memory block',
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell measured, joined into the large corner triangles, the white squares and the long
    // middle strip where the picture prints no seam
    rows: String.raw`
      0/1 -   0   0/1 1\0 0/1 1\0 0   1\0 -
      |   +   0/1 0   0/1 1\0 0   1\0 |   +
      0   0/1 1   0/1 0   -   1\0 1   1\0 0
      0/1 0   0/1 1   |   +   1   1\0 0   1\0
      0\1 0/1 0   -   -   -   -   -   1\0 1/0
      0/1 0\1 |   +   +   +   +   +   1/0 1\0
      0\1 0   0\1 1   0   -   1   1/0 0   1/0
      0   0\1 1   0\1 |   +   1/0 1   1/0 0
      0\1 -   0\1 0   0\1 1/0 0   1/0 1/0 -
      |   +   0   0\1 1/0 0\1 1/0 0   |   +`,
  },
  josephscoat2: {
    label: "Joseph's coat II",
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell measured; the white the background, mid grey the main colour, dark the accent, the
    // light centres of the corner diamonds a fourth fabric
    rows: String.raw`
      1   1/0 0\1 1   2\0 0/2 1   1/0 0\1 1
      1/0 3   3   0\1 2/0 0\2 1/0 3   3   0\1
      1\0 3   3   0/1 2\0 0/2 1\0 3   3   0/1
      1   1\0 0/1 1   2/0 0\2 1   1\0 0/1 1
      0\2 2/0 0\2 2/0 0   -   0\2 2/0 0\2 2/0
      0/2 2\0 0/2 2\0 |   +   0/2 2\0 0/2 2\0
      1   1/0 0\1 1   2\0 0/2 1   1/0 0\1 1
      1/0 3   3   0\1 2/0 0\2 1/0 3   3   0\1
      1\0 3   3   0/1 2\0 0/2 1\0 3   3   0/1
      1   1\0 0/1 1   2/0 0\2 1   1\0 0/1 1`,
  },
  widowerschoice: {
    label: "Widower's choice",
    family: 'Larger grids',
    n: 20,
    // from a picture: each cell measured. Two corner units of 8 × 8 small cells (white strips from the corners to a
    // small grey centre), large grey squares in the other corners, white strips and a grey centre between
    rows: String.raw`
      0   0\1 1   1   1   1   1/0 0   0   -   -   -   1   -   -   -   -   -   -   -
      1\0 0   0\1 1   1   1/0 0   0/1 |   +   +   +   |   +   +   +   +   +   +   +
      1   1\0 0   0\1 1/0 0   0/1 1   |   +   +   +   |   +   +   +   +   +   +   +
      1   1   1\0 1   1   0/1 1   1   |   +   +   +   |   +   +   +   +   +   +   +
      1   1   1/0 1   1   0\1 1   1   |   +   +   +   |   +   +   +   +   +   +   +
      1   1/0 0   0/1 1\0 0   0\1 1   |   +   +   +   |   +   +   +   +   +   +   +
      1/0 0   0/1 1   1   1\0 0   0\1 |   +   +   +   |   +   +   +   +   +   +   +
      0   0/1 1   1   1   1   1\0 0   |   +   +   +   |   +   +   +   +   +   +   +
      0   -   -   -   -   -   -   -   1   -   -   -   0   -   -   -   -   -   -   -
      |   +   +   +   +   +   +   +   |   +   +   +   |   +   +   +   +   +   +   +
      |   +   +   +   +   +   +   +   |   +   +   +   |   +   +   +   +   +   +   +
      |   +   +   +   +   +   +   +   |   +   +   +   |   +   +   +   +   +   +   +
      1   -   -   -   -   -   -   -   0   -   -   -   0   0\1 1   1   1   1   1/0 0
      |   +   +   +   +   +   +   +   |   +   +   +   1\0 0   0\1 1   1   1/0 0   0/1
      |   +   +   +   +   +   +   +   |   +   +   +   1   1\0 0   0\1 1/0 0   0/1 1
      |   +   +   +   +   +   +   +   |   +   +   +   1   1   1\0 1   1   0/1 1   1
      |   +   +   +   +   +   +   +   |   +   +   +   1   1   1/0 1   1   0\1 1   1
      |   +   +   +   +   +   +   +   |   +   +   +   1   1/0 0   0/1 1\0 0   0\1 1
      |   +   +   +   +   +   +   +   |   +   +   +   1/0 0   0/1 1   1   1\0 0   0\1
      |   +   +   +   +   +   +   +   |   +   +   +   0   0/1 1   1   1   1   1\0 0`,
  },
  leapfrog: {
    label: 'Leap frog',
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell measured. Crossed strips in two corners, large triangles and squares in the other two
    rows: String.raw`
      1   1\0 0/1 1   0   -   1\0 -   1   -
      0\1 1/0 0\1 1/0 |   +   |   +   |   +
      0/1 1\0 0/1 1\0 |   +   1   -   1\0 -
      1   1/0 0\1 1   |   +   |   +   |   +
      0   -   -   -   1   -   0   -   -   -
      |   +   +   +   |   +   |   +   +   +
      0\1 -   1   -   0   -   1   1\0 0/1 1
      |   +   |   +   |   +   0\1 1/0 0\1 1/0
      1   -   0\1 -   |   +   0/1 1\0 0/1 1\0
      |   +   |   +   |   +   1   1/0 0\1 1`,
  },
  bachelorspuzzle5: {
    label: "Bachelor's puzzle five-patch",
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell measured. Crossed strips in all four corners, white strips and centre between
    rows: String.raw`
      1   1\0 0/1 1   0   -   1   1\0 0/1 1
      0\1 1/0 0\1 1/0 |   +   0\1 1/0 0\1 1/0
      0/1 1\0 0/1 1\0 |   +   0/1 1\0 0/1 1\0
      1   1/0 0\1 1   |   +   1   1/0 0\1 1
      0   -   -   -   0   -   0   -   -   -
      |   +   +   +   |   +   |   +   +   +
      1   1\0 0/1 1   0   -   1   1\0 0/1 1
      0\1 1/0 0\1 1/0 |   +   0\1 1/0 0\1 1/0
      0/1 1\0 0/1 1\0 |   +   0/1 1\0 0/1 1\0
      1   1/0 0\1 1   |   +   1   1/0 0\1 1`,
  },
  brokenarrows: {
    label: 'Broken arrows',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0\1 1   0   0   0/1
      0   0\1 1   0/1 1
      0   1   1   1   0
      1   1/0 1   1\0 0
      1/0 0   0   1   1\0`,
  },
  honeyschoice: {
    label: "Honey's choice",
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: a pinwheel in each corner, a square in the centre
    rows: String.raw`
      1\0 1/0 0   1\0 1/0
      0/1 0\1 0   0/1 0\1
      0   0   1   0   0
      1\0 1/0 0   1\0 1/0
      0/1 0\1 0   0/1 0\1`,
  },
  propeller: {
    label: 'Propeller',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      0\1 1   0   0   0/1
      0   0\1 1   0/1 1
      0   1   0   1   0
      1   1/0 1   1\0 0
      1/0 0   0   1   1\0`,
  },
  crazyhorse: {
    label: 'Crazy horse',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell
    rows: String.raw`
      1\0 1   0   1   1/0
      1   0\1 1   0/1 1
      0   1   0   1   0
      1   1/0 1   1\0 1
      0/1 1   0   1   0\1`,
  },
  hartford: {
    label: 'Hartford',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: light grey the main colour, mid grey the accent, a black centre (3)
    rows: String.raw`
      0   2\0 0/1 0   0
      0   2/1 1   1\2 2/0
      0\1 1   3   1   1\0
      0/2 2\1 1   1/2 0
      0   0   1/0 0\2 0`,
  },
  roadcalifornia: {
    label: 'Road to California',
    family: 'Larger grids',
    n: 7,
    // read from a picture by the block reader as it is (25 separate squares, as its cutting list has them)
    rows: String.raw`
      0   2/1 1\2 0   2\1 1/2 0
      2/1 0   0   1\2 0   0   2/1
      2\1 0   0   1/2 0   0   2\1
      0   2\1 1/2 0   2/1 1\2 0
      1\2 0   0   2/1 0   0   1\2
      1/2 0   0   2\1 0   0   1/2
      0   2/1 1\2 0   2\1 1/2 0`,
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
    // read from a picture by the block reader; the 2 × 2 paws and 1 × 3 strips joined as the picture shows them
    rows: String.raw`
      0   2\0 2\0 0   0/2 0/2 0
      0\2 1   -   |   1   -   2/0
      0\2 |   +   |   |   +   2/0
      0   -   -   2   0   -   -
      0/2 1   -   0   1   -   2\0
      0/2 |   +   |   |   +   2\0
      0   2/0 2/0 |   0\2 0\2 0`,
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
