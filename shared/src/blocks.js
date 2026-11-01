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
  crazyann5: {
    label: 'Crazy Ann five-patch',
    family: 'Other',
    n: 5,
    // from a picture: laid out like Pinwheel square; mid grey the main colour, light grey corners, a dark centre (3)
    // and long check triangles (4)
    rows: String.raw`
      2   0/1 4\0 1\0 2
      0/1 1   |   1   1\0
      0/4 -   3   4/0 -
      0\1 1   0\4 1   1/0
      2   0\1 |   1/0 2`,
  },
  jackinthebox: {
    label: 'Jack in the box',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the dark cross squares written apart, as the picture shows them)
    rows: String.raw`
      0/2 2\0 1   0/3 2\0
      0\3 3\0 1   3/0 2/0
      1   1   0   1   1
      0/2 0/3 1   0\3 3\0
      0\2 3/0 1   0\2 2/0`,
  },
  squareandhalf: {
    label: 'Square and half',
    family: 'Other',
    n: 5,
    // from a picture: each cell's quarters measured (the block reader took it for a finer grid)
    rows: String.raw`
      1/0   1/0   0     0\1   0\1
      1/0   1     q1010 1     0\1
      0     q0101 0     q0101 0
      1\0   1     q1010 1     0/1
      1\0   1\0   0     0/1   0/1`,
  },
  handyandy5: {
    label: 'Handy Andy five-patch',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader (the white the background, light grey the main colour, dark the accent)
    rows: String.raw`
      0/1   0/1   0     1\0   1\0
      0/1   1     q2121 1     1\0
      0     q1212 1     q1212 0
      0\1   1     q2121 1     1/0
      0\1   0\1   0     1/0   1/0`,
  },
  zandcross: {
    label: 'Z and cross',
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      2\0 2   0   1   1/0
      2   0\2 3   0/1 1
      0   3   3   3   0
      1   1/0 3   2\0 2
      0/1 1   0   2   0\2`,
  },
  grandmothersown3: {
    label: "Grandmother's own III",
    family: 'Other',
    n: 5,
    // from a picture: a dark cross ending in a goose at each side, white squares between its arms, light grey around
    rows: String.raw`
      0   0   ^10 0   0
      0   2   1   2   0
      <10 1   1   1   >10
      0   2   1   2   0
      0   0   v10 0   0`,
  },
  dakotagold: {
    label: 'Dakota gold',
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: a check cross (1) on white, triangle squares of dark (2), mid (3) and light (4)
    // grey around it
    rows: String.raw`
      3\4 4\2 1   2/3 3/4
      2\3 0   1   0   4/2
      1   1   1   1   1
      2/4 0   1   0   3\2
      4/3 3/2 1   2\4 4\3`,
  },
  grandmotherscross2: {
    label: "Grandmother's cross II",
    family: 'Other',
    n: 5,
    // from a picture, cell by cell: like Grandmother's own III in other colours (mid grey around, a light cross
    // ending in a goose at each side, white squares between its arms)
    rows: String.raw`
      0   0   ^10 0   0
      0   2   1   2   0
      <10 1   0   1   >10
      0   2   1   2   0
      0   0   v10 0   0`,
  },
  goldenroyalty: {
    label: 'Golden royalty',
    family: 'Other',
    n: 5,
    // from a picture: the block reader's cells, each cell's quarters measured to place the small white triangles of
    // the three-triangle units; light (1), mid (2) and dark (3) greys
    rows: String.raw`
      0     01/1  0     1\01  0
      10\1  1/2   q3232 2\1   1/01
      0     q2323 0     q2323 0
      10\1  1\2   q3232 2/1   1/01
      0     01\1  0     1/10  0`,
  },
  kingdavidscrown: {
    label: "King David's crown",
    family: 'Larger grids',
    n: 10,
    // read from a picture by the block reader and checked cell by cell: light (1) points and a mid grey (2) ring
    // around a white centre
    rows: String.raw`
      0   -   1\0 -   2\0 0/2 0/1 -   0   -
      |   +   |   +   2/0 0\2 |   +   |   +
      0\1 -   0   0/2 2   -   2\0 0   1/0 -
      |   +   0/2 0   0   -   0   2\0 |   +
      0\2 2/0 2   0   0   -   0   2   0\2 2/0
      0/2 2\0 |   |   |   +   |   |   0/2 2\0
      0/1 -   0\2 0   0   -   0   2/0 1\0 -
      |   +   0   0\2 2   -   2/0 0   |   +
      0   -   1/0 -   2\0 0/2 0\1 -   0   -
      |   +   |   +   2/0 0\2 |   +   |   +`,
  },
  bullseye: {
    label: "Bull's eye",
    family: 'Larger grids',
    n: 10,
    // read from a picture by the block reader and checked cell by cell: light (1) and mid grey (2) points around
    // light squares
    rows: String.raw`
      0   -   1\0 0/2 0   -   2\0 0/1 0   -
      |   +   1   2   |   +   2   1   |   +
      0\1 1   |   2/0 1   -   0\2 |   1   1/0
      0/2 2   2/0 0   |   +   0   0\2 2   2\0
      0   -   1   -   0   -   1   -   0   -
      |   +   |   +   |   +   |   +   |   +
      0\2 2   2\0 0   1   -   0   0/2 2   2/0
      0/1 1   -   2\0 |   +   0/2 1   1   1\0
      0   -   1   2   0   -   2   1   0   -
      |   +   1/0 0\2 |   +   2/0 0\1 |   +`,
  },
  queencharlotte: {
    label: "Queen Charlotte's crown",
    family: 'Other',
    n: 5,
    // from a picture: the block reader's cells checked one by one; light (1), mid (2) and dark (3) greys, and two
    // large dotted corner triangles (4) the reader didn't tell from white
    rows: String.raw`
      0   1\0 0/1 0\4 -
      0\1 2   2/3 |   +
      0/1 2/3 3   3/2 1/0
      4\0 -   3/2 2   1\0
      |   +   1/0 0\1 0`,
  },
  birdsnest: {
    label: "Bird's nest",
    family: 'Other',
    n: 10,
    // from a picture, cell by cell: a 5 × 5 block on a 10 grid, so each square of the centre cross can hold a light
    // diamond (four small triangle squares)
    rows: String.raw`
      0/2 -   0/2 -   0/1 1\0 2\0 -   2\0 -
      |   +   |   +   0\1 1/0 |   +   |   +
      0/2 -   2   -   0/1 1\0 2   -   2\0 -
      |   +   |   +   0\1 1/0 |   +   |   +
      0/1 1\0 0/1 1\0 0/1 1\0 0/1 1\0 0/1 1\0
      0\1 1/0 0\1 1/0 0\1 1/0 0\1 1/0 0\1 1/0
      0\2 -   2   -   0/1 1\0 2   -   2/0 -
      |   +   |   +   0\1 1/0 |   +   |   +
      0\2 -   0\2 -   0/1 1\0 2/0 -   2/0 -
      |   +   |   +   0\1 1/0 |   +   |   +`,
  },
  milkyway: {
    label: 'Milky way',
    family: 'Larger grids',
    n: 10,
    // from a picture: each cell measured; dark (2) and white four-patches, large light grey (1) triangles and squares
    rows: String.raw`
      2   0   1/0 -   2   0   0/1 -   2   0
      0   2   |   +   0   2   |   +   0   2
      1\0 -   0   -   0\1 -   1   -   1\0 -
      |   +   |   +   |   +   |   +   |   +
      2   0   0/1 -   2   0   1/0 -   2   0
      0   2   |   +   0   2   |   +   0   2
      0\1 -   1   -   1\0 -   0   -   0\1 -
      |   +   |   +   |   +   |   +   |   +
      2   0   1/0 -   2   0   0/1 -   2   0
      0   2   |   +   0   2   |   +   0   2`,
  },
  captainswheel: {
    label: "Captain's wheel",
    family: 'Other',
    n: 5,
    // read from a picture by the block reader as it is
    rows: String.raw`
      0\1 1   1   1/0 0/1
      1\0 0   0   0   1
      1   0   0   0   1
      1   0   0   0   0\1
      1/0 0/1 1   1   1\0`,
  },
  hemstitch: {
    label: 'Hemstitch',
    family: 'Larger grids',
    n: 7,
    // from a picture: 49 separate squares, each measured; light (1) and dark (2) squares on white
    rows: String.raw`
      1 0 0 0 0 0 1
      0 2 0 0 0 2 0
      0 0 1 0 1 0 0
      0 0 0 2 0 0 0
      0 0 1 0 1 0 0
      0 2 0 0 0 2 0
      1 0 0 0 0 0 1`,
  },
  wallsofjericho: {
    label: 'Walls of Jericho',
    family: 'Larger grids',
    n: 7,
    // from a picture: each cell measured; mid grey (2) strips on the diagonals, a light (1) cross of long strips
    rows: String.raw`
      0   0   0/2 1   2\0 0   0
      0   0/2 2/0 |   0\2 2\0 0
      0/2 2/0 0   |   0   0\2 2\0
      1   -   -   0   1   -   -
      0\2 2\0 0   1   0   0/2 2/0
      0   0\2 2\0 |   0/2 2/0 0
      0   0   0\2 |   2/0 0   0`,
  },
  loverstiff: {
    label: "Lover's tiff",
    family: 'Larger grids',
    n: 7,
    // from a picture: each cell measured; mid grey (2) strips, and in each gap two light (1) squares and two
    // triangle squares
    rows: String.raw`
      0   2   -   0   2   -   0
      2   1   0\1 2   1/0 1\0 2
      |   1\0 1   |   1   0/1 |
      0   2   -   0   2   -   0
      2   1/0 1   2   1   0\1 2
      |   0\1 0/1 |   1\0 1   |
      0   2   -   0   2   -   0`,
  },
  countryroads: {
    label: 'Country roads',
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: white strips between four corner units of light (1) squares and mid grey (2)
    // triangles and squares
    rows: String.raw`
      1   0\2 2   0   2   2/0 1
      2\0 1   0\2 |   2/0 1   0/2
      2   2\0 1   |   1   0/2 2
      0   -   -   1   0   -   -
      2   2/0 1   0   1   0\2 2
      2/0 1   0/2 |   2\0 1   0\2
      1   0/2 2   |   2   2\0 1`,
  },
  citysquare: {
    label: 'City square',
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: two light (1) strips of triangles along the diagonal, the dark (2) half below
    rows: String.raw`
      0   0   0   0   0   0/1 0/1
      0   0   0   0   0/1 0/1 0/2
      0   0   0   0/1 0/1 0/2 2
      0   0   0/1 0/1 0/2 2   2
      0   0/1 0/1 0/2 2   2   2
      0/1 0/1 0/2 2   2   2   2
      0/1 0/2 2   2   2   2   2`,
  },
  queenvictoria: {
    label: "Queen Victoria's crown",
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: a border of triangle squares, four squares and a small diamond in the centre
    rows: String.raw`
      0     0\1   0\1   0\1   0\1   0\1   0\1
      1\0   1     0     0     0     1     0\1
      1\0   0     0     q0010 0     0     0\1
      1\0   0     q0100 1     q0001 0     0\1
      1\0   0     0     q1000 0     0     0\1
      1\0   1     0     0     0     1     0\1
      1\0   1\0   1\0   1\0   1\0   1\0   0`,
  },
  lincolnsplatform: {
    label: "Lincoln's platform",
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: a border of mid grey (2) and white squares; inside, large dark (3) corner
    // triangles and a light (1) cross with a dark centre
    rows: String.raw`
      2   0   2   0   2   0   2
      0   3/0 -   1   0\3 -   0
      2   |   +   |   |   +   2
      0   1   -   3   1   -   0
      2   3\0 -   1   0/3 -   2
      0   |   +   |   |   +   0
      2   0   2   0   2   0   2`,
  },
  pricklypear: {
    label: 'Prickly pear',
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: dark (3) corners, a border of mid grey (2) triangles, large light (1) triangles
    // and a dark cross around a light centre
    rows: String.raw`
      3   2\0 2\0 2\0 2\0 2\0 3
      0/2 0/1 -   0   1\0 -   2/0
      0/2 |   +   3   |   +   2/0
      0/2 0   3   1   3   0   2/0
      0/2 0\1 -   3   1/0 -   2/0
      0/2 |   +   0   |   +   2/0
      3   0\2 0\2 0\2 0\2 0\2 3`,
  },
  arkansas: {
    label: 'Arkansas',
    family: 'Larger grids',
    n: 14,
    // from a picture: each cell measured; light (0) corners, a dark (2) frame of strips, mid grey (1) inside with
    // light strips crossing to small dark-cornered diamonds, and a light cross of squares
    rows: String.raw`
      0   -   2   -   -   -   -   -   -   -   -   -   0   -
      |   +   |   +   +   +   +   +   +   +   +   +   |   +
      2   -   0   0\1 1   1   1   1   1   1   1/0 0   2   -
      |   +   1\0 0   0\1 1   1   1   1   1/0 0   0/1 |   +
      |   +   1   1\0 2/1 1\2 0   -   2/1 1\2 0/1 1   |   +
      |   +   1   1   2\1 1/2 |   +   2\1 1/2 1   1   |   +
      |   +   1   1   0   -   0   -   0   -   1   1   |   +
      |   +   1   1   |   +   |   +   |   +   1   1   |   +
      |   +   1   1   2/1 1\2 0   -   2/1 1\2 1   1   |   +
      |   +   1   1/0 2\1 1/2 |   +   2\1 1/2 0\1 1   |   +
      |   +   1/0 0   0/1 1   1   1   1   1\0 0   0\1 |   +
      |   +   0   0/1 1   1   1   1   1   1   1\0 0   |   +
      0   -   2   -   -   -   -   -   -   -   -   -   0   -
      |   +   |   +   +   +   +   +   +   +   +   +   |   +`,
  },
  dovewindowcross: {
    label: 'Dove in a window cross',
    family: 'Larger grids',
    n: 14,
    // from a picture: each cell measured; four large squares in the centre and an arm of small triangles on each side
    rows: String.raw`
      0   -   -   -   0\1 0   0   0   0   1/0 0   -   -   -
      |   +   +   +   0\1 0/1 1\0 0/1 1\0 1/0 |   +   +   +
      |   +   +   +   0\1 0   0/1 1\0 0   1/0 |   +   +   +
      |   +   +   +   0\1 1   1   1   1   1/0 |   +   +   +
      1\0 1\0 1\0 1\0 1   -   -   1   -   -   0/1 0/1 0/1 0/1
      0   0/1 0   1   |   +   +   |   +   +   1   0   1\0 0
      0   0\1 0/1 1   |   +   +   |   +   +   1   1\0 1/0 0
      0   0/1 0\1 1   1   -   -   1   -   -   1   1/0 1\0 0
      0   0\1 0   1   |   +   +   |   +   +   1   0   1/0 0
      1/0 1/0 1/0 1/0 |   +   +   |   +   +   0\1 0\1 0\1 0\1
      0   -   -   -   0/1 1   1   1   1   1\0 0   -   -   -
      |   +   +   +   0/1 0   0\1 1/0 0   1\0 |   +   +   +
      |   +   +   +   0/1 0\1 1/0 0\1 1/0 1\0 |   +   +   +
      |   +   +   +   0/1 0   0   0   0   1\0 |   +   +   +`,
  },
  dovewindowcross2: {
    label: 'Dove in a window cross II',
    family: 'Larger grids',
    n: 7,
    // from a picture: each cell measured; light (2) triangles and squares in the corners, a mid grey (1) cross with a
    // dark (3) centre
    rows: String.raw`
      1   0/1 0/1 2   1\0 1\0 1
      0/1 0/1 1   |   1   1\0 1\0
      0/1 1   1   |   1   1   1\0
      2   -   -   3   2   -   -
      0\1 1   1   2   1   1   1/0
      0\1 0\1 1   |   1   1/0 1/0
      1   0\1 0\1 |   1/0 1/0 1`,
  },
  redcross1: {
    label: 'Red cross I',
    family: 'Nine patch',
    n: 3,
    // from a picture: white corners, a light (1) cross with a mid grey (2) centre
    rows: String.raw`
      0 1 0
      1 2 1
      0 1 0`,
  },
  patience9: {
    label: 'Patience nine-patch',
    family: 'Nine patch',
    n: 3,
    // from a picture: white down the diagonal, light (1) beside it, mid grey (2) in the other corners
    rows: String.raw`
      0 1 2
      1 0 1
      2 1 0`,
  },
  ninevariation1: {
    label: 'Nine-patch variation I',
    family: 'Nine patch',
    n: 3,
    // from a picture: white down the diagonal, light (1) elsewhere
    rows: String.raw`
      0 1 1
      1 0 1
      1 1 0`,
  },
  hblock: {
    label: 'H-block',
    family: 'Nine patch',
    n: 3,
    // from a picture: an H of mid grey (1) squares, white above and below its bar
    rows: String.raw`
      1 0 1
      1 1 1
      1 0 1`,
  },
  basketweave1: {
    label: 'Basketweave I',
    family: 'Nine patch',
    n: 3,
    // from a picture: a white centre, light (1) and mid grey (2) squares turning around it
    rows: String.raw`
      1 1 2
      2 0 2
      2 1 1`,
  },
  twocolourdouble9: {
    label: 'Two-colour double nine-patch',
    family: 'Nine patch',
    n: 9,
    // from a picture: large dark (1) corners and white sides, a small nine-patch in the centre
    rows: String.raw`
      1 - - 0 - - 1 - -
      | + + | + + | + +
      | + + | + + | + +
      0 - - 1 0 1 0 - -
      | + + 0 1 0 | + +
      | + + 1 0 1 | + +
      1 - - 0 - - 1 - -
      | + + | + + | + +
      | + + | + + | + +`,
  },
  threecolourdouble9: {
    label: 'Three-colour double nine-patch',
    family: 'Nine patch',
    n: 9,
    // from a picture: small nine-patches of mid grey (1) and light (2) in the corners and centre, large white sides
    rows: String.raw`
      1 2 1 0 - - 1 2 1
      2 1 2 | + + 2 1 2
      1 2 1 | + + 1 2 1
      0 - - 1 2 1 0 - -
      | + + 2 1 2 | + +
      | + + 1 2 1 | + +
      1 2 1 0 - - 1 2 1
      2 1 2 | + + 2 1 2
      1 2 1 | + + 1 2 1`,
  },
  buildingblocks: {
    label: 'Building blocks',
    family: 'Nine patch',
    n: 9,
    // from a picture: small nine-patches of light (2) in the corners, three strips (mid grey (1), white, mid grey) on
    // each side, a large white centre
    rows: String.raw`
      0 2 0 1 - - 0 2 0
      2 0 2 0 - - 2 0 2
      0 2 0 1 - - 0 2 0
      1 0 1 0 - - 1 0 1
      | | | | + + | | |
      | | | | + + | | |
      0 2 0 1 - - 0 2 0
      2 0 2 0 - - 2 0 2
      0 2 0 1 - - 0 2 0`,
  },
  homewardbound: {
    label: 'Homeward bound',
    family: 'Nine patch',
    n: 6,
    // from a picture: four-patches in the corners (a light (2) square at the outer corner), large mid grey (1)
    // squares on the sides, a large white centre
    rows: String.raw`
      2 0 1 - 0 2
      0 0 | + 0 0
      1 - 0 - 1 -
      | + | + | +
      0 0 1 - 0 0
      2 0 | + 0 2`,
  },
  pussyinthecorner: {
    label: 'Pussy in the corner',
    family: 'Nine patch',
    n: 6,
    // from a picture: four-patches with one dark (2) square in the corners and centre, large mid grey (1) sides
    rows: String.raw`
      0 0 1 - 0 0
      0 2 | + 0 2
      1 - 0 0 1 -
      | + 0 2 | +
      0 0 1 - 0 0
      0 2 | + 0 2`,
  },
  pussinthecorner: {
    label: 'Puss in the corner II',
    family: 'Nine patch',
    n: 9,
    // from a picture: small dark (1) nine-patches in the corners, white sides with a light (2) strip framing the
    // white centre
    rows: String.raw`
      0 1 0 0 - - 0 1 0
      1 0 1 | + + 1 0 1
      0 1 0 2 - - 0 1 0
      0 - 2 0 - - 2 0 -
      | + | | + + | | +
      | + | | + + | | +
      0 1 0 2 - - 0 1 0
      1 0 1 0 - - 1 0 1
      0 1 0 | + + 0 1 0`,
  },
  pennsylvania: {
    label: 'Pennsylvania',
    family: 'Nine patch',
    n: 6,
    // from a picture: light (1) and white four-patches in the corners, large white sides, a large light centre
    rows: String.raw`
      1 0 0 - 0 1
      0 1 | + 1 0
      0 - 1 - 0 -
      | + | + | +
      0 1 0 - 1 0
      1 0 | + 0 1`,
  },
  patiencecorner: {
    label: 'Patience corner',
    family: 'Nine patch',
    n: 6,
    // from a picture: large light (1) squares in two corners, two four-patches of light squares, white around
    rows: String.raw`
      1 - 0 0 0 0
      | + 0 1 1 0
      0 0 0 1 1 0
      0 1 1 0 0 0
      0 1 1 0 1 -
      0 0 0 0 | +`,
  },
  handweave: {
    label: 'Handweave',
    family: 'Nine patch',
    n: 9,
    // from a picture, each cell measured: large mid grey (1) corners, a frame of mid grey strips around a white
    // centre, white strips and squares between
    rows: String.raw`
      1 - 0 0 - - 0 1 -
      | + | | + + | | +
      0 - 0 1 - - 0 0 -
      0 - 1 0 - - 1 0 -
      | + | | + + | | +
      | + | | + + | | +
      0 - 0 1 - - 0 0 -
      1 - 0 0 - - 0 1 -
      | + | | + + | | +`,
  },
  twocolourdomino: {
    label: 'Two-colour domino',
    family: 'Nine patch',
    n: 6,
    // from a picture: 36 squares, each measured; light (0) and mid grey (1)
    rows: String.raw`
      0 1 0 1 1 0
      1 0 1 0 0 1
      0 1 1 0 0 1
      1 0 0 1 1 0
      1 0 0 1 0 1
      0 1 1 0 1 0`,
  },
  alabama: {
    label: 'Alabama',
    family: 'Nine patch',
    n: 9,
    // from a picture, each cell measured: light (1) and white strips framing a small nine-patch, mid grey (2)
    // squares down both diagonals
    rows: String.raw`
      2 1 1 1 - - 1 1 2
      1 2 0 0 - - 0 2 1
      1 0 2 1 - - 2 0 1
      1 0 1 2 0 2 1 0 1
      | | | 0 2 0 | | |
      | | | 2 0 2 | | |
      1 0 2 1 - - 2 0 1
      1 2 0 0 - - 0 2 1
      2 1 1 1 - - 1 1 2`,
  },
  fourcolourdomino: {
    label: 'Four-colour domino',
    family: 'Nine patch',
    n: 6,
    // from a picture: 36 squares, each measured; white, light (1), mid grey (2) and dark (3)
    rows: String.raw`
      0 3 0 1 1 0
      3 0 1 2 2 1
      0 1 1 2 2 1
      1 2 2 1 1 0
      1 2 2 1 0 3
      0 1 1 0 3 0`,
  },
  twocolourgardenpath: {
    label: 'Two-colour garden path',
    family: 'Nine patch',
    n: 9,
    // from a picture, cell by cell: small light (1) nine-patches in the corners and a checkerboard cross, large white
    // pieces on the sides
    rows: String.raw`
      0 1 0 0 - - 0 1 0
      1 0 1 | + + 1 0 1
      0 1 0 1 0 1 0 1 0
      0 - 1 0 1 0 1 0 -
      | + 0 1 0 1 0 | +
      | + 1 0 1 0 1 | +
      0 1 0 1 0 1 0 1 0
      1 0 1 0 - - 1 0 1
      0 1 0 | + + 0 1 0`,
  },
  nineplaid: {
    label: 'Nine-patch plaid',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: light (1) squares along the top and left with a mid grey (2) corner; inside, dark
    // (3) and dot print (4) squares on white
    rows: String.raw`
      2 1 1 1 1 1
      1 4 0 0 0 4
      1 0 4 3 4 0
      1 0 3 4 3 0
      1 0 4 3 4 0
      1 4 0 0 0 4`,
  },
  streaklightning: {
    label: 'Streak of lightning',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: zigzags of mid grey (1) squares on white
    rows: String.raw`
      1 1 0 0 1 1
      1 0 0 1 1 0
      0 0 1 1 0 0
      0 1 1 0 0 1
      1 1 0 0 1 1
      1 0 0 1 1 0`,
  },
  treeeverlasting1: {
    label: 'Tree everlasting I',
    family: 'Nine patch',
    n: 3,
    // from a picture, each cell measured: nine triangle squares all turned the same way
    rows: String.raw`
      0/1 0/1 0/1
      0/1 0/1 0/1
      0/1 0/1 0/1`,
  },
  lightningstreaks: {
    label: 'Lightning streaks',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: rows of triangle squares, every other row turned the other way
    rows: String.raw`
      0/1 0/1 0/1 0/1 0/1 0/1
      1/0 1/0 1/0 1/0 1/0 1/0
      0/1 0/1 0/1 0/1 0/1 0/1
      1/0 1/0 1/0 1/0 1/0 1/0
      0/1 0/1 0/1 0/1 0/1 0/1
      1/0 1/0 1/0 1/0 1/0 1/0`,
  },
  sawtooth: {
    label: 'Sawtooth',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: a large light (1) triangle of squares edged with sawtooth triangle squares,
    // white squares and large white squares in the other corner
    rows: String.raw`
      0/1 0/1 0/1 0/1 0/1 0
      0/1 1   1   1   1/0 0
      0/1 1   1   1/0 0   -
      0/1 1   1/0 0   |   +
      0/1 1/0 0   -   0   -
      0   0   |   +   |   +`,
  },
  sawtoothsquare: {
    label: 'Sawtooth square',
    family: 'Nine patch',
    n: 3,
    // from a picture, each cell measured: three plain squares and five triangle squares down one diagonal, a white
    // corner
    rows: String.raw`
      1   0\1 0\1
      1\0 1   1/0
      1\0 1/0 0`,
  },
  practicalorchard: {
    label: 'Practical orchard',
    family: 'Nine patch',
    n: 3,
    // from a picture, each cell measured: a mid grey (2) cross around a white centre, light (1) corners, two of them
    // triangle squares
    rows: String.raw`
      1   2   0\1
      2   0   2
      1\0 2   1`,
  },
  hourglass2: {
    label: 'Hourglass II',
    family: 'Nine patch',
    n: 3,
    // from a picture, each cell measured: light (1) corners, white sides, an hourglass in the centre
    rows: String.raw`
      1     0     1
      0     q1010 0
      1     0     1`,
  },
  triplet: {
    label: 'Triplet',
    family: 'Nine patch',
    n: 6,
    // from a picture, each cell measured: large grey (1) corners and white sides, a band of three pinwheels
    rows: String.raw`
      1   -   0   -   1   -
      |   +   |   +   |   +
      1\0 0/1 0\1 1/0 1\0 0/1
      1/0 0\1 0/1 1\0 1/0 0\1
      1   -   0   -   1   -
      |   +   |   +   |   +`,
  },
  clownschoice: {
    label: "Clown's choice",
    family: 'Nine patch',
    n: 3,
    // from a picture, each cell measured: hourglasses in the corners and centre, white squares between
    rows: String.raw`
      q1010 0     q1010
      0     q1010 0
      q1010 0     q1010`,
  },
  checkerboard: {
    label: 'Checkerboard',
    family: 'Other',
    n: 6,
    // from a picture: nine squares on point among white ones: mid grey (1), light (2), stripes (3), dark (4),
    // check (5); the dot print, a seventh fabric, shares the light role
    rows: String.raw`
      0/1 1\0 0/2 2\0 0/3 3\0
      0\1 1/0 0\2 2/0 0\3 3/0
      0/3 3\0 0/1 1\0 0/4 4\0
      0\3 3/0 0\1 1/0 0\4 4/0
      0/5 5\0 0/2 2\0 0/5 5\0
      0\5 5/0 0\2 2/0 0\5 5/0`,
  },
  courthousesquare: {
    label: 'Courthouse square',
    family: 'Other',
    n: 6,
    // from a picture: squares on point: a dark (2) ring, light (1) ones inside it, a white centre, white triangles
    // at the edges
    rows: String.raw`
      0/2 2\0 0/2 2\0 0/2 2\0
      0\2 2/1 1\2 2/1 1\2 2/0
      0/2 2\1 1/0 0\1 1/2 2\0
      0\2 2/1 1\0 0/1 1\2 2/0
      0/2 2\1 1/2 2\1 1/2 2\0
      0\2 2/0 0\2 2/0 0\2 2/0`,
  },
  arborwindowalbum: {
    label: 'Arbor window album',
    family: 'Other',
    n: 6,
    // from a picture: squares on point: a mid grey (1) ring, a white X inside it, dark (2) triangles at the edges
    rows: String.raw`
      2/1 1\2 2/1 1\2 2/1 1\2
      2\1 1/0 0\1 1/0 0\1 1/2
      2/1 1\0 0/0 0\0 0/1 1\2
      2\1 1/0 0\0 0/0 0\1 1/2
      2/1 1\0 0/1 1\0 0/1 1\2
      2\1 1/2 2\1 1/2 2\1 1/2`,
  },
  ninepatchonpoint: {
    label: 'Nine-patch on point',
    family: 'Nine patch',
    n: 6,
    // from a picture: a nine-patch of light (1) and white squares turned on point, white triangles in the corners
    rows: String.raw`
      0   0   0/1 1\0 0   0
      0   0   0\1 1/0 0   0
      0/1 1\0 0/1 1\0 0/1 1\0
      0\1 1/0 0\1 1/0 0\1 1/0
      0   0   0/1 1\0 0   0
      0   0   0\1 1/0 0   0`,
  },
  hourglass3: {
    label: 'Hourglass III',
    family: 'Other',
    n: 6,
    // from a picture: a light (1) border, inside it a white square on point edged with light triangles
    rows: String.raw`
      1   1   1   -   1   1
      1   0   0/1 1\0 0   1
      1   0/1 0   -   1\0 1
      |   0\1 |   +   1/0 |
      1   0   0\1 1/0 0   1
      1   1   1   -   1   1`,
  },
  ninepatchframe: {
    label: 'Nine-patch frame',
    family: 'Other',
    n: 6,
    // from a picture: mid grey (2) four-patches in the corners and a large mid grey centre, a light (1) frame on point
    rows: String.raw`
      2   2   0/1 1\0 2   2
      2   2/1 1/0 0\1 1\2 2
      0/1 1/0 2   -   0\1 1\0
      0\1 1\0 |   +   0/1 1/0
      2   2\1 1\0 0/1 1/2 2
      2   2   0\1 1/0 2   2`,
  },
  auntsukeyschoice: {
    label: "Aunt Sukey's choice",
    family: 'Other',
    n: 6,
    // from a picture: light (1) squares in the corners, a mid grey (2) centre, a light frame on point
    rows: String.raw`
      1   0   0/1 1\0 0   1
      0   0/1 1/0 0\1 1\0 0
      0/1 1/0 2   -   0\1 1\0
      0\1 1\0 |   +   0/1 1/0
      0   0\1 1\0 0/1 1/0 0
      1   0   0\1 1/0 0   1`,
  },
  auntvinah: {
    label: "Aunt Vinah's favorite",
    family: 'Larger grids',
    n: 12,
    // from a picture: large light (1) corner triangles, a white centre, and on each side a square on point holding
    // four small squares, two white and two dark (2)
    rows: String.raw`
      0/1 -   -   -   0   0   0   0   1\0 -   -   -
      |   +   +   +   0/2 2\0 0/2 2\0 |   +   +   +
      |   +   +   +   0\2 2/0 0\2 2/0 |   +   +   +
      |   +   +   +   0   0   0   0   |   +   +   +
      0   0/2 2\0 0   0   -   -   -   0   0/2 2\0 0
      0   0\2 2/0 0   |   +   +   +   0   0\2 2/0 0
      0   0/2 2\0 0   |   +   +   +   0   0/2 2\0 0
      0   0\2 2/0 0   |   +   +   +   0   0\2 2/0 0
      0\1 -   -   -   0   0   0   0   1/0 -   -   -
      |   +   +   +   0/2 2\0 0/2 2\0 |   +   +   +
      |   +   +   +   0\2 2/0 0\2 2/0 |   +   +   +
      |   +   +   +   0   0   0   0   |   +   +   +`,
  },
  jeffersoncity: {
    label: 'Jefferson City',
    family: 'Nine patch',
    n: 3,
    // from a picture: hourglasses around a white centre, light (1) in the corners, dark (2) on the sides
    rows: String.raw`
      q1010 q2020 q1010
      q1212 0     q1212
      q1010 q2020 q1010`,
  },
  illinois: {
    label: 'Illinois',
    family: 'Other',
    n: 6,
    // from a picture: large grey (1) corner triangles, two geese on each side pointing out, a grey square on point in
    // the centre
    rows: String.raw`
      1/0 -   ^10 -   0\1 -
      |   +   ^10 -   |   +
      <10 <10 0/1 1\0 >10 >10
      |   |   0\1 1/0 |   |
      1\0 -   v10 -   0/1 -
      |   +   v10 -   |   +`,
  },
  crosspatch: {
    label: 'Crosspatch',
    family: 'Nine patch',
    n: 9,
    // from a picture: mid grey (1) squares in an X and around the edge on white, a large hourglass in the centre,
    // light (2) top and bottom, dark (3) at the sides
    rows: String.raw`
      1     0     0     0     1     0     0     0     1
      0     1     0     1     0     1     0     1     0
      0     0     1     0     0     0     1     0     0
      0     1     0     q2323 -     -     0     1     0
      1     0     0     |     +     +     0     0     1
      0     1     0     |     +     +     0     1     0
      0     0     1     0     0     0     1     0     0
      0     1     0     1     0     1     0     1     0
      1     0     0     0     1     0     0     0     1`,
  },
  atthesquare: {
    label: 'At the square',
    family: 'Nine patch',
    n: 9,
    // from a picture: hourglasses in the corners (light (1) top and bottom, mid grey (2) at the sides), three
    // strips on each side, a white centre
    rows: String.raw`
      q1212 -     -     1     -     -     q1212 -     -
      |     +     +     2     -     -     |     +     +
      |     +     +     1     -     -     |     +     +
      2     1     2     0     -     -     2     1     2
      |     |     |     |     +     +     |     |     |
      |     |     |     |     +     +     |     |     |
      q1212 -     -     1     -     -     q1212 -     -
      |     +     +     2     -     -     |     +     +
      |     +     +     1     -     -     |     +     +`,
  },
  chainhourglass: {
    label: 'Chain and hourglass',
    family: 'Nine patch',
    n: 9,
    // from a picture: hourglasses in the corners and centre, three strips (white, light (1), white) on each side
    rows: String.raw`
      q0101 -     -     0     1     0     q0101 -     -
      |     +     +     |     |     |     |     +     +
      |     +     +     |     |     |     |     +     +
      0     -     -     q1010 -     -     0     -     -
      1     -     -     |     +     +     1     -     -
      0     -     -     |     +     +     0     -     -
      q0101 -     -     0     1     0     q0101 -     -
      |     +     +     |     |     |     |     +     +
      |     +     +     |     |     |     |     +     +`,
  },
  londontownroads: {
    label: 'Londontown roads',
    family: 'Nine patch',
    n: 9,
    // from a picture: hourglasses of mid grey (1) and white in the corners, three strips (dark (2), white, dark)
    // on each side, a white centre
    rows: String.raw`
      q1010 -     -     2     -     -     q0101 -     -
      |     +     +     0     -     -     |     +     +
      |     +     +     2     -     -     |     +     +
      2     0     2     0     -     -     2     0     2
      |     |     |     |     +     +     |     |     |
      |     |     |     |     +     +     |     |     |
      q0101 -     -     2     -     -     q1010 -     -
      |     +     +     0     -     -     |     +     +
      |     +     +     2     -     -     |     +     +`,
  },
  boxkite: {
    label: 'Box kite',
    family: 'Nine patch',
    n: 3,
    // from a picture: a mid grey (2) centre, light (1) and mid grey triangle squares around it
    rows: String.raw`
      0/2 0/1 2\0
      0/1 2   1/0
      0\2 1/0 2\0`,
  },
  nonamenine: {
    label: 'No-name nine-patch',
    family: 'Nine patch',
    n: 6,
    // from a picture: dark (3) corners, light (1) and mid grey (2) squares, a white square on point on each side, a
    // large white centre
    rows: String.raw`
      3   1   2/0 0\2 1   3
      1   2   2\0 0/2 2   1
      2/0 0\2 0   -   2/0 0\2
      2\0 0/2 |   +   2\0 0/2
      1   2   2/0 0\2 2   1
      3   1   2\0 0/2 1   3`,
  },
  crabclaws: {
    label: 'Crab claws',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: two mid grey (2) and two light (1) claws around a white centre
    rows: String.raw`
      0/2 0   2\0 0   0/1 1\0
      0\2 2   2/1 1   1   0
      0   2   0   0   2\1 1/0
      0/1 1\2 0   0   2   0
      0   1   1   1/2 2   2\0
      0\1 1/0 0   0\2 0   2/0`,
  },
  cardtricks: {
    label: 'Card tricks',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: four cards, light (1) and mid grey (2), overlapping around the centre
    rows: String.raw`
      0   0/1 1\0 0/2 2\0 0
      0/1 1   1   1\2 2   2\0
      0\1 1/2 2\1 1/2 2   2/0
      0/2 2   2/1 1\2 2/1 1\0
      0\2 2   2\1 1   1   1/0
      0   0\2 2/0 0\1 1/0 0`,
  },
  colorwheel: {
    label: 'Color wheel',
    family: 'Other',
    n: 6,
    // from a picture: four cards around a dark (5) centre, light (1), dots (4), mid grey (3) and check (2); the top
    // left quarter measured, the others turned from it
    rows: String.raw`
      0   0/1 1\0 0/4 4\0 0
      0/1 1   1   1\4 4   4\0
      0\1 1/2 5   -   4   4/0
      0/2 2   |   +   4/3 3\0
      0\2 2   2\3 3   3   3/0
      0   0\2 2/0 0\3 3/0 0`,
  },
  fortsumter: {
    label: 'Fort Sumter',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: on point, a light (1) square framed by white strips, mid grey (2) squares
    // at their ends and in the corners
    rows: String.raw`
      2   2\1 1/2 2\1 1/2 2
      1\2 2/0 0   0   0\2 2/1
      1/2 0   1   1   0   2\1
      1\2 0   1   1   0   2/1
      1/2 2\0 0   0   0/2 2\1
      2   2/1 1\2 2/1 1\2 2`,
  },
  gardenpath: {
    label: 'Garden path',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: a mid grey (3) frame on point; stripes (1), check (2), dark (4) and light
    // (5) in the corners and the four-patch centre
    rows: String.raw`
      1   0/4 0/3 3\0 5\0 2
      0/5 0/3 3/0 0\3 3\0 4\0
      0/3 3/0 4   1   0\3 3\0
      0\3 3\0 2   5   0/3 3/0
      0\4 0\3 3\0 0/3 3/0 5/0
      2   0\5 0\3 3/0 4/0 1`,
  },
  gentlemansfancy: {
    label: "Gentleman's fancy",
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: dark (3) corners, mid grey (2) triangles, light (1) squares and a mid grey
    // centre
    rows: String.raw`
      3   3/2 2\0 0/2 2\3 3
      3/2 1   1/0 0\1 1   2\3
      0\2 1/0 2   -   0\1 2/0
      0/2 1\0 |   +   0/1 2\0
      3\2 1   1\0 0/1 1   2/3
      3   3\2 2/0 0\2 2/3 3`,
  },
  grandmothersown4: {
    label: "Grandmother's own IV",
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: a mid grey (2) cross ending in points, white squares between its arms, light (1)
    // around
    rows: String.raw`
      1   1   1/2 2\1 1   1
      1   0   2   -   0   1
      1/2 2   2   -   2   2\1
      1\2 |   |   +   |   2/1
      1   0   2   -   0   1
      1   1   1\2 2/1 1   1`,
  },
  stonemasonspuzzle: {
    label: "Stone mason's puzzle",
    family: 'Larger grids',
    n: 7,
    // from a picture, cell by cell: a dark (2) cross with a mid grey (3) centre, light (1) strips beside it, white
    // four-patches with a mid grey corner
    rows: String.raw`
      3 0 1 2 1 0 3
      0 0 | | | 0 0
      1 - | | | 1 -
      2 - 2 3 2 2 -
      1 - 1 2 1 1 -
      0 0 | | | 0 0
      3 0 | | | 0 3`,
  },
  california: {
    label: 'California',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: mid grey (2) strips on each side, a dark (3) square on point in the centre framed
    // by light (1) and mid grey triangles
    rows: String.raw`
      0     0     2     -     0     0
      0     0/1   q2112 q2211 1\0 0
      2     q1221 1/3   3\1   q1122 2
      |     q2211 1\3   3/1   q2112 |
      0     0\1   q1221 q1122 1/0 0
      0     0     2     -     0     0`,
  },
  merrykite: {
    label: 'Merry kite',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: dark (3) corners and star points, mid grey (2) and light (1) squares, a large
    // light centre, white between the points
    rows: String.raw`
      3   2   3\0 0/3 2   3
      2   1   1\3 3/1 1   2
      0\3 3\1 1   -   1/3 3/0
      0/3 3/1 |   +   1\3 3\0
      2   1   1/3 3\1 1   2
      3   2   3/0 0\3 2   3`,
  },
  flyingdutchman2: {
    label: 'Flying Dutchman II',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: pinwheels of grey (1) triangle squares turning around the centre, white
    // strips at the edges
    rows: String.raw`
      0   -   -   0\1 1/0 0
      1\0 0/1 1/0 0/1 1\0 |
      1/0 0\1 1\0 1/0 0\1 |
      0   1\0 0/1 0\1 1\0 0/1
      |   0\1 1/0 0/1 1/0 0\1
      |   0/1 1\0 0   -   -`,
  },
  saintgeorgescross: {
    label: "Saint George's cross",
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) and mid grey (2) triangle squares around a large light centre
    rows: String.raw`
      0/1 1\2 2\1 1/2 2/1 1\0
      2\1 1/0 1\2 2/1 0\1 1/2
      1\2 2\1 1   -   1/2 2/1
      1/2 2/1 |   +   1\2 2\1
      2/1 1\0 1/2 2\1 0/1 1\2
      0\1 1/2 2/1 1\2 2\1 1/0`,
  },
  capitalt: {
    label: 'Capital T',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: large light (1) triangles in the corners, small geese on each side, a white
    // centre
    rows: String.raw`
      0/1 -   1\0 0/1 1\0 -
      |   +   1\0 0/1 |   +
      0\1 0\1 0   -   1/0 1/0
      0/1 0/1 |   +   1\0 1\0
      0\1 -   1/0 0\1 1/0 -
      |   +   1/0 0\1 |   +`,
  },
  robbingpeter9: {
    label: 'Robbing Peter to pay Paul nine-patch',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: a ring of light (1) triangle squares around white squares and strips
    rows: String.raw`
      0   1\0 1\0 0/1 0/1 0
      0\1 0/1 0   -   1\0 1/0
      0\1 0   0   -   0   1/0
      0/1 |   |   +   |   1\0
      0/1 0\1 0   -   1/0 1\0
      0   1/0 1/0 0\1 0\1 0`,
  },
  loveinamist: {
    label: 'Love-in-a-mist',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) squares on point on each side and large stars in the corners,
    // a white centre
    rows: String.raw`
      0   1\0 0/1 1\0 0/1 0
      0\1 1   0\1 1/0 1   1/0
      0/1 1\0 0   -   0/1 1\0
      0\1 1/0 |   +   0\1 1/0
      0/1 1   0/1 1\0 1   1\0
      0   1/0 0\1 1/0 0\1 0`,
  },
  weathervane: {
    label: 'Weathervane',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: dark (2) star points and squares, light (1) points and squares, a large dark
    // centre
    rows: String.raw`
      0   2\0 0/1 1\0 0/2 0
      0\2 2   1   1   2   2/0
      0/1 1   2   -   1   1\0
      0\1 1   |   +   1   1/0
      0/2 2   1   1   2   2\0
      0   2/0 0\1 1/0 0\2 0`,
  },
  indianpuzzle: {
    label: 'Indian puzzle',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) stars in the corners, mid grey (2) triangles around a white
    // square on point
    rows: String.raw`
      0   1\0 2/0 0\2 0/1 0
      0\1 1   0\2 2/0 1   1/0
      2/0 2\0 2/0 0\2 0/2 0\2
      2\0 2/0 2\0 0/2 0\2 0/2
      0/1 1   0/2 2\0 1   1\0
      0   1/0 2\0 0/2 0\1 0`,
  },
  fancycontrarywife: {
    label: 'Fancy contrary wife',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: mid grey (2) triangles and squares on white, a light (1) centre
    rows: String.raw`
      0   2\0 2\0 0/2 0/2 0
      0\2 2   2/0 0\2 2   2/0
      0\2 2/0 1   -   0\2 2/0
      0/2 2\0 |   +   0/2 2\0
      0/2 2   2\0 0/2 2   2\0
      0   2/0 2/0 0\2 0\2 0`,
  },
  arizona2: {
    label: 'Arizona II',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: a ring of mid grey (2) triangle squares, white strips, a light (1) centre
    rows: String.raw`
      0   2\0 2\0 0/2 0/2 0
      0\2 0/2 0   -   2\0 2/0
      0\2 0   1   -   0   2/0
      0/2 |   |   +   |   2\0
      0/2 0\2 0   -   2/0 2\0
      0   2/0 2/0 0\2 0\2 0`,
  },
  unionsquare: {
    label: 'Union square',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) corners and centre, mid grey (2) triangles around the centre,
    // dark (3) points on each side
    rows: String.raw`
      1   0\1 0\3 3/0 1/0 1
      1\0 0   0/2 2\0 0   0/1
      3\0 0/2 1   -   2\0 0/3
      3/0 0\2 |   +   2/0 0\3
      1/0 0   0\2 2/0 0   0\1
      1   0/1 0/3 3\0 1\0 1`,
  },
  wyomingvalley: {
    label: 'Wyoming valley',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) and mid grey (2) star points around a small light star in the
    // centre
    rows: String.raw`
      0   1\0 2\0 0/2 0/1 0
      0\1 0/1 0\2 2/0 1\0 1/0
      0\2 2\0 1/0 0\1 0/2 2/0
      0/2 2/0 1\0 0/1 0\2 2\0
      0/1 0\1 0/2 2\0 1/0 1\0
      0   1/0 2/0 0\2 0\1 0`,
  },
  morning: {
    label: 'Morning',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: mid grey (2) corner squares and points, light (1) points, strips and a
    // large light centre
    rows: String.raw`
      0   2\0 0/1 1\0 0/2 0
      0\2 2   1   -   2   2/0
      0/1 1   1   -   1   1\0
      0\1 |   |   +   |   1/0
      0/2 2   1   -   2   2\0
      0   2/0 0\1 1/0 0\2 0`,
  },
  contrarywife: {
    label: 'Contrary wife',
    family: 'Nine patch',
    n: 3,
    // from a picture: light (1) corners and centre, white and mid grey (2) triangle squares between
    rows: String.raw`
      1   0/2 1
      0/2 1   2/0
      1   2/0 1`,
  },
  atticwindow1: {
    label: 'Attic window I',
    family: 'Nine patch',
    n: 3,
    // from a picture: dark (3) corners, light (1) squares and triangles, mid grey (2) triangles, a white centre
    rows: String.raw`
      3   3/2 1
      3/1 0   1/3
      1   2/3 3`,
  },
  stepsaltar2: {
    label: 'Steps to the altar II',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: steps of mid grey (1), light (2) and dot print (3) squares on white, a large dark
    // (4) triangle and square, large white squares
    rows: String.raw`
      1   0   2   0   3   0
      0   2   0   3   0   0
      2   0   3   0/4 0   -
      0   3   0/4 4   |   +
      3   0   0   -   4   -
      0   0   |   +   |   +`,
  },
  railroad2: {
    label: 'Railroad II',
    family: 'Other',
    n: 6,
    // from a picture: grey (1) and white four-patches in the corners and centre, large triangle squares between
    rows: String.raw`
      1   0   1/0 -   0   1
      0   1   |   +   1   0
      1/0 -   0   1   0/1 -
      |   +   1   0   |   +
      0   1   0/1 -   1   0
      1   0   |   +   0   1`,
  },
  rockyroadcalifornia: {
    label: 'Rocky road to California',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: large grey (1) squares in two corners, four-patches in the other two and
    // the centre, large triangle squares between
    rows: String.raw`
      1   -   0/1 -   0   1
      |   +   |   +   1   0
      0/1 -   1   0   1/0 -
      |   +   0   1   |   +
      0   1   1/0 -   1   -
      1   0   |   +   |   +`,
  },
  kellysblock: {
    label: "Kelly's block",
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: a large grey (1) centre with squares stepping out from it, large and small
    // triangle squares in the corners
    rows: String.raw`
      0/1 0   1/0 0   1\0 -
      0   0   0   1   |   +
      1/0 0   1   -   1   0
      0   1   |   +   0   0/1
      0\1 -   1   0   0   0
      |   +   0\1 0   0/1 1/0`,
  },
  brokensugarbowl: {
    label: 'Broken sugar bowl',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: large dark (2) squares in two corners, four-patches of dark, light (1) and
    // white, large light triangle squares between
    rows: String.raw`
      2   -   0/1 -   0   2
      |   +   |   +   1   0
      0/1 -   2   1   1/0 -
      |   +   1   2   |   +
      0   1   1/0 -   2   -
      2   0   |   +   |   +`,
  },
  roadwhitehouse: {
    label: 'Road to the White House',
    family: 'Other',
    n: 6,
    // from a picture: four-patches of mid grey (2) with white or light (1), large light squares, large triangle
    // squares of light and dark (3)
    rows: String.raw`
      2   0   1\3 -   1   -
      0   2   |   +   |   +
      3\1 -   2   1   1\3 -
      |   +   1   2   |   +
      1   -   3\1 -   2   0
      |   +   |   +   0   2`,
  },
  jacobsladder: {
    label: "Jacob's ladder",
    family: 'Other',
    n: 6,
    // from a picture: mid grey (2) and white four-patches, large triangle squares of white and light (1)
    rows: String.raw`
      2   0   0/1 -   2   0
      0   2   |   +   0   2
      0/1 -   2   0   1/0 -
      |   +   0   2   |   +
      2   0   1/0 -   2   0
      0   2   |   +   0   2`,
  },
  mixedt: {
    label: 'Mixed T',
    family: 'Larger grids',
    n: 9,
    // from a picture: columns of grey (1) squares over small triangle squares, between tall strips of grey and white
    rows: String.raw`
      1   1   1   0   1   1   1   0   1
      1/0 |   0\1 |   1/0 |   0\1 |   1/0
      0   |   0   |   0   |   0   |   0
      1   0   1   1   1   0   1   1   1
      0\1 |   1/0 |   0\1 |   1/0 |   0\1
      0   |   0   |   0   |   0   |   0
      1   1   1   0   1   1   1   0   1
      1/0 |   0\1 |   1/0 |   0\1 |   1/0
      0   |   0   |   0   |   0   |   0`,
  },
  dublinchain: {
    label: 'Dublin chain',
    family: 'Larger grids',
    n: 9,
    // from a picture, each cell measured: light (1) squares in a ring and a cross, mid grey (2) triangle squares in
    // chains down the diagonals, on white
    rows: String.raw`
      1   2\0 0   1   0   1   0   0/2 1
      0\2 1   2\0 0   0   0   0/2 1   2/0
      0   0\2 1   2\0 0   0/2 1   2/0 0
      1   0   0\2 1   0   1   2/0 0   1
      0   0   0   0   1   0   0   0   0
      1   0   0/2 1   0   1   2\0 0   1
      0   0/2 1   2/0 0   0\2 1   2\0 0
      0/2 1   2/0 0   0   0   0\2 1   2\0
      1   2/0 0   1   0   1   0   0\2 1`,
  },
  flowergardenpath: {
    label: 'Flower garden path',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: mid grey (2) triangles in an X, light (1) triangles and strips, white
    rows: String.raw`
      2\0 1\0 1   -   0/1 0/2
      0\2 2\0 1\0 0/1 0/2 2/0
      1   0\2 2\0 0/2 2/0 1
      |   0/2 2/0 0\2 2\0 |
      0/2 2/0 1/0 0\1 0\2 2\0
      2/0 1/0 1   -   0\1 0\2`,
  },
  massachusetts: {
    label: 'Massachusetts',
    family: 'Larger grids',
    n: 12,
    // from a picture, each cell measured: mid grey (2) sawtooth borders and frame, white rings, a sawtooth ring
    // around a large light (1) centre
    rows: String.raw`
      2   0\2 0\2 0\2 0\2 0\2 0\2 0\2 0\2 0\2 0\2 0
      2\0 2   2   2   2   2   2   2   2   2   2   0\2
      2\0 2   0   0   0   0   0   0   0   0   2   0\2
      2\0 2   0   0   2/0 2/0 2/0 2/0 2   0   2   0\2
      2\0 2   0   2/0 1   -   -   -   0/2 0   2   0\2
      2\0 2   0   2/0 |   +   +   +   0/2 0   2   0\2
      2\0 2   0   2/0 |   +   +   +   0/2 0   2   0\2
      2\0 2   0   2/0 |   +   +   +   0/2 0   2   0\2
      2\0 2   0   2   0/2 0/2 0/2 0/2 0   0   2   0\2
      2\0 2   0   0   0   0   0   0   0   0   2   0\2
      2\0 2   2   2   2   2   2   2   2   2   2   0\2
      0   2\0 2\0 2\0 2\0 2\0 2\0 2\0 2\0 2\0 2\0 2`,
  },
  battlegrounds: {
    label: 'Battlegrounds',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: 36 triangle squares, white above the seam; light (1), mid grey (2), dark (3) or
    // dots (4) below
    rows: String.raw`
      0/1 0/2 0/4 0/1 0/4 0/2
      0/3 0/2 0/1 0/2 0/3 0/1
      0/4 0/4 0/1 0/4 0/2 0/4
      0/2 0/4 0/2 0/1 0/3 0/2
      0/4 0/3 0/1 0/2 0/4 0/4
      0/1 0/2 0/4 0/1 0/2 0/1`,
  },
  catscradle: {
    label: "Cat's cradle",
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) triangles stepping round a large light centre, large white squares
    rows: String.raw`
      0   0/1 0   0/1 0   -
      0/1 0/1 0/1 0/1 |   +
      0   0/1 1   -   1/0 1/0
      0/1 0/1 |   +   1/0 0
      0   -   1/0 1/0 1/0 1/0
      |   +   1/0 0   1/0 0`,
  },
  wingedsquareblock: {
    label: 'Winged square',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: light (1) triangle squares wrapping two sides of a large dark (2) centre, large
    // white squares in the other corners
    rows: String.raw`
      0/1 0/1 0/1 0/1 0   -
      0/1 0/1 0/1 0/1 |   +
      0/1 0/1 2   -   1/0 1/0
      0/1 0/1 |   +   1/0 1/0
      0   -   1/0 1/0 1/0 1/0
      |   +   1/0 1/0 1/0 1/0`,
  },
  dartingbird: {
    label: 'Darting bird',
    family: 'Nine patch',
    n: 3,
    // from a picture, cell by cell: a light (1) corner square and centre, light triangles around them, white
    rows: String.raw`
      1   0/1 1\0
      0/1 1   1\0
      0\1 0\1 0`,
  },
  formalgarden: {
    label: 'Formal garden',
    family: 'Nine patch',
    n: 3,
    // from a picture, cell by cell: light (1) and mid grey (2) triangle squares turning around a dark (3) centre
    rows: String.raw`
      1\2 2\1 1/2
      1/2 3   2/1
      2/1 1\2 2\1`,
  },
  calicopuzzle: {
    label: 'Calico puzzle',
    family: 'Nine patch',
    n: 3,
    // from a picture, cell by cell: light (1) squares on the sides, a mid grey (2) centre, triangle squares of white
    // and mid grey in the corners
    rows: String.raw`
      0\2 1   0/2
      1   2   1
      2/0 1   2\0`,
  },
  ninewaterwheel: {
    label: 'Nine-patch water wheel',
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: four-patches of white, light (1) and mid grey (2) in the corners; large light
    // triangle squares turning around a large light centre
    rows: String.raw`
      0   1   1\0 -   2   0
      2   0   |   +   0   1
      0/1 -   1   -   1/0 -
      |   +   |   +   |   +
      1   0   0\1 -   0   2
      0   2   |   +   1   0`,
  },
  rangerspride: {
    label: "Ranger's pride",
    family: 'Other',
    n: 6,
    // from a picture, cell by cell: light (1) triangles and squares crossing the block on both diagonals, on white
    rows: String.raw`
      q1001 q1100 0   0   0   0/1
      0   1\0 0   1   q0110 1\0
      0   1   1\0 0/1 0   0
      0   0   0/1 1\0 1   0
      0/1 0/1 1   0   0\1 0
      1\0 0   0   0   q0011 q0110`,
  },
  flutterwheel: {
    label: 'Flutter wheel',
    family: 'Nine patch',
    n: 6,
    // from a picture, each cell measured: grey (1) pinwheels in the corners and centre, large white squares between
    rows: String.raw`
      1\0 1/0 0   -   1\0 1/0
      0/1 0\1 |   +   0/1 0\1
      0   -   1\0 1/0 0   -
      |   +   0/1 0\1 |   +
      1\0 1/0 0   -   1\0 1/0
      0/1 0\1 |   +   0/1 0\1`,
  },
  wheelingnine: {
    label: 'Wheeling nine-patch',
    family: 'Other',
    n: 6,
    // from a picture, each cell measured: light (1) and mid grey (2) triangle squares wheeling around a light centre
    rows: String.raw`
      0/1 2/1 0\2 2\1 1\0 2
      1/2 1/0 2   0\1 1\2 2\0
      2/0 2   1   2   0/2 0
      2\1 1\0 2   0/1 2/1 0\2
      0\1 1\2 2\0 1/2 1/0 2
      2   0/2 0   2/0 2   0`,
  },
  octagon: {
    label: 'Octagon',
    family: 'Nine patch',
    n: 3,
    // from a picture: small light (1) triangles cut off the corners of a white block
    rows: String.raw`
      1/0 0 0\1
      0   0 0
      1\0 0 0/1`,
  },
  shoofly2: {
    label: 'Shoo fly II',
    family: 'Nine patch',
    n: 3,
    // from a picture: light (1) triangles pointing in to a light centre (Shoo fly's triangles turned the other way)
    rows: String.raw`
      0/1 0 1\0
      0   1 0
      0\1 0 1/0`,
  },
  greekcross3: {
    label: 'Greek cross III',
    family: 'Nine patch',
    n: 6,
    // from a picture: like Churn dash, reversed, with dark (2) triangles and a mid grey (1) centre and strips
    rows: String.raw`
      0/2 -   0   -   2\0 -
      |   +   1   -   |   +
      0   1   1   -   1   0
      |   |   |   +   |   |
      0\2 -   1   -   2/0 -
      |   +   0   -   |   +`,
  },
  kitchenwoodbox: {
    label: 'Kitchen woodbox',
    family: 'Nine patch',
    n: 6,
    // from a picture: mid grey (2) octagon ring, a light (1) ring inside it, a white centre
    rows: String.raw`
      0   0/2 2   -   2\0 0
      0/2 1   1   -   1   2\0
      2   1   0   -   1   2
      |   |   |   +   |   |
      0\2 1   1   -   1   2/0
      0   0\2 2   -   2/0 0`,
  },
  greciandesign: {
    label: 'Grecian design',
    family: 'Nine patch',
    n: 6,
    // from a picture: large mid grey (2) corner triangles, grey and white strips, a grey centre
    rows: String.raw`
      0/2 -   2   -   2\0 -
      |   +   0   -   |   +
      2   0   2   -   0   2
      |   |   |   +   |   |
      0\2 -   0   -   2/0 -
      |   +   2   -   |   +`,
  },
  londonroads: {
    label: 'London roads',
    family: 'Nine patch',
    n: 9,
    // from a picture: corner triangles with a mid grey (2) quarter, three strips (light (1), white, light) on each
    // side, a white centre
    rows: String.raw`
      0/02 -    -    1    -    -    0\02 -    -
      |    +    +    0    -    -    |    +    +
      |    +    +    1    -    -    |    +    +
      1    0    1    0    -    -    1    0    1
      |    |    |    |    +    +    |    |    |
      |    |    |    |    +    +    |    |    |
      02\0 -    -    1    -    -    20/0 -    -
      |    +    +    0    -    -    |    +    +
      |    +    +    1    -    -    |    +    +`,
  },
  goldengate: {
    label: 'Golden gate',
    family: 'Nine patch',
    n: 9,
    // from a picture: large light (1) corner triangles, three strips (dark (2), white, dark) on each side, a white
    // centre
    rows: String.raw`
      0/1 -   -   2   -   -   1\0 -   -
      |   +   +   0   -   -   |   +   +
      |   +   +   2   -   -   |   +   +
      2   0   2   0   -   -   2   0   2
      |   |   |   |   +   +   |   |   |
      |   |   |   |   +   +   |   |   |
      0\1 -   -   2   -   -   1/0 -   -
      |   +   +   0   -   -   |   +   +
      |   +   +   2   -   -   |   +   +`,
  },
  squaregreekcross: {
    label: 'Square Greek cross',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: dark (2) corner triangles, white strips outside light (1) strips, a light centre
    rows: String.raw`
      2/0 -   0   -   0\2 -
      |   +   1   -   |   +
      0   1   1   -   1   0
      |   |   |   +   |   |
      2\0 -   1   -   0/2 -
      |   +   0   -   |   +`,
  },
  albumcross: {
    label: 'Album cross',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: dark (3) corners cut by white triangles round a mid grey (2) square, large light
    // (1) squares on the sides, a white centre
    rows: String.raw`
      3   3/0 1   -   0\3 3
      3/0 2   |   +   2   0\3
      1   -   0   -   1   -
      |   +   |   +   |   +
      3\0 2   1   -   2   0/3
      3   3\0 |   +   0/3 3`,
  },
  newalbum1: {
    label: 'New album I',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: mid grey (2) corners cut by white triangles round a dark (3) square, large light
    // (1) squares on the sides, a small dark-and-white pinwheel in the centre
    rows: String.raw`
      2   2/0 1   -   0\2 2
      2/0 3   |   +   3   0\2
      1   -   0   0\3 1   -
      |   +   3\0 0   |   +
      2\0 3   1   -   3   0/2
      2   2\0 |   +   0/2 2`,
  },
  sawtoothpatch: {
    label: 'Sawtooth patch',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: large light (1) corner triangles, mid grey (2) squares on point on the sides and
    // in the centre
    rows: String.raw`
      0/1 -   0/2 2\0 1\0 -
      |   +   0\2 2/0 |   +
      0/2 2\0 0/2 2\0 0/2 2\0
      0\2 2/0 0\2 2/0 0\2 2/0
      0\1 -   0/2 2\0 1/0 -
      |   +   0\2 2/0 |   +`,
  },
  prairiequeen: {
    label: 'Prairie queen',
    family: 'Nine patch',
    n: 6,
    // from a picture, cell by cell: large mid grey (2) and light (1) corner triangles, dark (3) and white
    // four-patches on the sides, a large light centre
    rows: String.raw`
      2/1 -   0   3   1\2 -
      |   +   3   0   |   +
      3   0   1   -   3   0
      0   3   |   +   0   3
      2\1 -   0   3   1/2 -
      |   +   3   0   |   +`,
  },
  santafe: {
    label: 'Santa Fé',
    family: 'Nine patch',
    n: 9,
    // from a picture, each cell measured: four small grey (2) octagons around a checkerboard centre, large white
    // corners
    rows: String.raw`
      0   -   -   0/2 2   2\0 0   -   -
      |   +   +   2   0   2   |   +   +
      |   +   +   0\2 2   2/0 |   +   +
      0/2 2   2\0 2   0   2   0/2 2   2\0
      2   0   2   0   2   0   2   0   2
      0\2 2   2/0 2   0   2   0\2 2   2/0
      0   -   -   0/2 2   2\0 0   -   -
      |   +   +   2   0   2   |   +   +
      |   +   +   0\2 2   2/0 |   +   +`,
  },
  tilepuzzle: {
    label: 'Tile puzzle',
    family: 'Nine patch',
    n: 9,
    // from a picture, each cell measured: five small grey (2) octagons, grey and white squares between
    rows: String.raw`
      0/2 2   2\0 0   2   0   0/2 2   2\0
      2   0   2   2   0   2   2   0   2
      0\2 2   2/0 0   2   0   0\2 2   2/0
      0   2   0   0/2 2   2\0 0   2   0
      2   0   2   2   0   2   2   0   2
      0   2   0   0\2 2   2/0 0   2   0
      0/2 2   2\0 0   2   0   0/2 2   2\0
      2   0   2   2   0   2   2   0   2
      0\2 2   2/0 0   2   0   0\2 2   2/0`,
  },
  singleweddingring2: {
    label: 'Single wedding ring II',
    family: 'Nine patch',
    n: 6,
    // from a picture, each cell measured: white squares on point in grey (2) corners, grey and white strips
    rows: String.raw`
      2/0 0\2 0   -   2/0 0\2
      2\0 0/2 2   -   2\0 0/2
      0   2   0   -   2   0
      |   |   |   +   |   |
      2/0 0\2 2   -   2/0 0\2
      2\0 0/2 0   -   2\0 0/2`,
  },
  rollingstone: {
    label: 'Rolling stone',
    family: 'Nine patch',
    n: 6,
    // from a picture, each cell measured: white squares on point in dark (2) corners, a light (1) ring around a
    // white centre
    rows: String.raw`
      2/0 0\2 0   -   2/0 0\2
      2\0 0/1 1   -   1\0 0/2
      0   1   0   -   1   0
      |   |   |   +   |   |
      2/0 0\1 1   -   1/0 0\2
      2\0 0/2 0   -   2\0 0/2`,
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
  scotsplaid: {
    label: "Scot's plaid",
    family: 'Four patch',
    n: 4,
    // from a picture: light (1) frame along the top and left, mid grey (2) bars, a white (0) diagonal and corner
    rows: String.raw`
      0 1 1 1
      1 0 2 2
      1 2 0 0
      1 2 0 0`,
  },
  autumntints: {
    label: 'Autumn tints',
    family: 'Four patch',
    n: 4,
    // from a picture: two large mid grey (2) squares, and two four-patches of white (0), light (1) and dark (3)
    rows: String.raw`
      2 - 0 3
      | + 1 0
      0 1 2 -
      3 0 | +`,
  },
  sixteenplaid: {
    label: 'Sixteen-patch plaid',
    family: 'Larger grids',
    n: 8,
    // from a picture: large mid grey (2) and light (1) corners, white bars, and a diagonal of squares in four greys
    rows: String.raw`
      2 - 0 2 0 0 1 -
      | + | 0 2 | | +
      0 - 2 3 0 1 0 -
      2 0 3 2 1 0 2 0
      0 2 0 1 2 3 0 2
      0 - 1 0 3 2 0 -
      1 - 0 2 0 0 2 -
      | + | 0 2 | | +`,
  },
  fourh: {
    label: 'Four-H',
    family: 'Larger grids',
    n: 6,
    // from a picture: four turns of two light grey (1) bars round a white (0) and grey square
    rows: String.raw`
      1 0 1 1 - -
      | 1 | 0 1 0
      | 0 | 1 - -
      1 - - 1 0 1
      0 1 0 | 1 |
      1 - - | 0 |`,
  },
  flyfoot1: {
    label: 'Flyfoot I',
    family: 'Larger grids',
    n: 8,
    // from a picture: large white (0) squares, a light (1) ring round a dark (3) centre, mid grey (2) edges
    rows: String.raw`
      2 0 0 - 2 2 2 2
      2 0 | + 1 1 0 0
      2 1 1 1 1 1 0 -
      2 1 1 3 3 1 | +
      0 - 1 3 3 1 1 2
      | + 1 1 1 1 1 2
      0 0 1 1 0 - 0 2
      2 2 2 2 | + 0 2`,
  },
  whitehousesteps: {
    label: 'White House steps',
    family: 'Larger grids',
    n: 8,
    // from a picture: grey (1) and white (0) squares in rings round a white centre
    rows: String.raw`
      1 1 1 1 1 1 1 1
      1 0 0 0 0 0 0 1
      1 0 1 1 1 1 0 1
      1 0 1 0 0 1 0 1
      1 0 1 0 0 1 0 1
      1 0 1 1 1 1 0 1
      1 0 0 0 0 0 0 1
      1 1 1 1 1 1 1 1`,
  },
  balkanpuzzle: {
    label: 'Balkan puzzle',
    family: 'Other',
    n: 4,
    // from a drawing (Brown 1211): a pinwheel of dotted (1) and white corners round a white diamond, four striped (2) bands
    rows: String.raw`
      1\0 0/2 0\1 1/0
      1/0 2/0 0\2 2\0
      0\2 2\0 0/2 0/1
      0/1 1\0 2/0 0\1`,
  },
  blockade: {
    label: 'Blockade',
    family: 'Other',
    n: 4,
    // from a drawing (Brown 1212, also A four corner puzzle): black (1) and striped (2) corners, a white ring, black and striped in the middle
    rows: String.raw`
      1\2 2/0 0\1 1/2
      1/0 0/2 1\0 0\2
      2\0 0\1 2/0 0/1
      2/1 1\0 0/2 2\1`,
  },
  hazydaisy: {
    label: 'Hazy daisy',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1213): four hourglasses of black (1) and white (0), a dotted (2) square on point in the point of each black triangle
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
      ['Daisy 1 · top triangle', 1, [0, 0, 4, 0, 2.75, 1.25, 2, 0.5, 1.25, 1.25]],
      ['Daisy 1 · top dotted square', 2, [2, 2, 1.25, 1.25, 2, 0.5, 2.75, 1.25]],
      ['Daisy 1 · right white triangle', 0, [4, 0, 4, 4, 2, 2]],
      ['Daisy 1 · bottom triangle', 1, [0, 4, 4, 4, 2.75, 2.75, 2, 3.5, 1.25, 2.75]],
      ['Daisy 1 · bottom dotted square', 2, [2, 2, 1.25, 2.75, 2, 3.5, 2.75, 2.75]],
      ['Daisy 1 · left white triangle', 0, [0, 0, 0, 4, 2, 2]],
      ['Daisy 2 · top white triangle', 0, [4, 0, 8, 0, 6, 2]],
      ['Daisy 2 · right triangle', 1, [8, 0, 8, 4, 6.75, 2.75, 7.5, 2, 6.75, 1.25]],
      ['Daisy 2 · right dotted square', 2, [6, 2, 6.75, 1.25, 7.5, 2, 6.75, 2.75]],
      ['Daisy 2 · bottom white triangle', 0, [4, 4, 8, 4, 6, 2]],
      ['Daisy 2 · left triangle', 1, [4, 0, 4, 4, 5.25, 2.75, 4.5, 2, 5.25, 1.25]],
      ['Daisy 2 · left dotted square', 2, [6, 2, 5.25, 1.25, 4.5, 2, 5.25, 2.75]],
      ['Daisy 3 · top white triangle', 0, [0, 4, 4, 4, 2, 6]],
      ['Daisy 3 · right triangle', 1, [4, 4, 4, 8, 2.75, 6.75, 3.5, 6, 2.75, 5.25]],
      ['Daisy 3 · right dotted square', 2, [2, 6, 2.75, 5.25, 3.5, 6, 2.75, 6.75]],
      ['Daisy 3 · bottom white triangle', 0, [0, 8, 4, 8, 2, 6]],
      ['Daisy 3 · left triangle', 1, [0, 4, 0, 8, 1.25, 6.75, 0.5, 6, 1.25, 5.25]],
      ['Daisy 3 · left dotted square', 2, [2, 6, 1.25, 5.25, 0.5, 6, 1.25, 6.75]],
      ['Daisy 4 · top triangle', 1, [4, 4, 8, 4, 6.75, 5.25, 6, 4.5, 5.25, 5.25]],
      ['Daisy 4 · top dotted square', 2, [6, 6, 5.25, 5.25, 6, 4.5, 6.75, 5.25]],
      ['Daisy 4 · right white triangle', 0, [8, 4, 8, 8, 6, 6]],
      ['Daisy 4 · bottom triangle', 1, [4, 8, 8, 8, 6.75, 6.75, 6, 7.5, 5.25, 6.75]],
      ['Daisy 4 · bottom dotted square', 2, [6, 6, 5.25, 6.75, 6, 7.5, 6.75, 6.75]],
      ['Daisy 4 · left white triangle', 0, [4, 4, 4, 8, 6, 6]],
    ],
  },
  chineselanterns: {
    label: 'Chinese lanterns',
    family: 'Other',
    n: 4,
    // from a drawing (Brown 1215): a diamond cut into eight long triangles in four fabrics (stars 1, striped 2, dotted 3, sparse 4), white corners
    rows: String.raw`
      x x x x
      x x x x
      x x x x
      x x x x`,
    extra: [
      ['Lantern · upper left, outer', 1, [2, 0, 0, 2, 1, 2]],
      ['Lantern · upper left, inner', 2, [2, 0, 1, 2, 2, 2]],
      ['Lantern · upper right, inner', 3, [2, 0, 2, 2, 3, 2]],
      ['Lantern · upper right, outer', 4, [2, 0, 3, 2, 4, 2]],
      ['Lantern · lower left, outer', 4, [0, 2, 1, 2, 2, 4]],
      ['Lantern · lower left, inner', 3, [1, 2, 2, 2, 2, 4]],
      ['Lantern · lower right, inner', 2, [2, 2, 3, 2, 2, 4]],
      ['Lantern · lower right, outer', 1, [3, 2, 4, 2, 2, 4]],
      ['Corner · upper left', 0, [0, 0, 2, 0, 0, 2]],
      ['Corner · upper right', 0, [2, 0, 4, 0, 4, 2]],
      ['Corner · lower left', 0, [0, 2, 0, 4, 2, 4]],
      ['Corner · lower right', 0, [4, 2, 4, 4, 2, 4]],
    ],
  },
  tamspatch: {
    label: "Tam's patch",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1117): two large squares (1), a white (0) and a small (2) square in a pinwheel
    rows: String.raw`
      0 - 1 -
      0 2 | +
      1 - 2 0
      | + 0 -`,
  },
  swastika: {
    label: 'Swastika',
    family: 'Other',
    n: 10,
    // from a drawing (Brown 1118): four arms turned about a small centre square (3), each a striped (2) strip, a dotted (1) and a white (0) block
    rows: String.raw`
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x
      x x x x x x x x x x`,
    extra: [
      ['Arm 1 · strip', 2, [0, 0, 1, 0, 1, 5, 0, 5]],
      ['Arm 1 · dotted block', 1, [1, 0, 5, 0, 5, 2.5, 1, 2.5]],
      ['Arm 1 · white block', 0, [1, 2.5, 5, 2.5, 5, 4, 4, 4, 4, 5, 1, 5]],
      ['Arm 2 · strip', 2, [10, 0, 10, 1, 5, 1, 5, 0]],
      ['Arm 2 · dotted block', 1, [10, 1, 10, 5, 7.5, 5, 7.5, 1]],
      ['Arm 2 · white block', 0, [7.5, 1, 7.5, 5, 6, 5, 6, 4, 5, 4, 5, 1]],
      ['Arm 3 · strip', 2, [10, 10, 9, 10, 9, 5, 10, 5]],
      ['Arm 3 · dotted block', 1, [9, 10, 5, 10, 5, 7.5, 9, 7.5]],
      ['Arm 3 · white block', 0, [9, 7.5, 5, 7.5, 5, 6, 6, 6, 6, 5, 9, 5]],
      ['Arm 4 · strip', 2, [0, 10, 0, 9, 5, 9, 5, 10]],
      ['Arm 4 · dotted block', 1, [0, 9, 0, 5, 2.5, 5, 2.5, 9]],
      ['Arm 4 · white block', 0, [2.5, 9, 2.5, 5, 4, 5, 4, 6, 5, 6, 5, 9]],
      ['Centre square', 3, [4, 4, 6, 4, 6, 6, 4, 6]],
    ],
  },
  onedozennapkins: {
    label: 'One dozen napkins',
    family: 'Larger grids',
    n: 21,
    // from a drawing (Brown 1119): a white square crossed by two triple strips each way, black (1) and white (0), woven where they cross
    rows: String.raw`
      0 - - 1 0 1 0 - - - - - - - - 1 0 1 0 - -
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      1 - - 0 1 0 1 - - - - - - - - 0 1 0 1 - -
      0 - - 1 0 1 0 - - - - - - - - 1 0 1 0 - -
      1 - - 0 1 0 1 - - - - - - - - 0 1 0 1 - -
      0 - - 1 0 1 0 - - - - - - - - 1 0 1 0 - -
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +
      1 - - 0 1 0 1 - - - - - - - - 0 1 0 1 - -
      0 - - 1 0 1 0 - - - - - - - - 1 0 1 0 - -
      1 - - 0 1 0 1 - - - - - - - - 0 1 0 1 - -
      0 - - 1 0 1 0 - - - - - - - - 1 0 1 0 - -
      | + + | | | | + + + + + + + + | | | | + +
      | + + | | | | + + + + + + + + | | | | + +`,
  },
  pinwheel2: {
    label: 'Pinwheel II',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1121): dotted (1) and striped (2) squares round a white (0) middle, with dotted triangles
    rows: String.raw`
      1 1/0 2 1
      2 0 0 0\1
      1\0 0 0 2
      1 2 0/1 1`,
  },
  anvil: {
    label: 'The anvil',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1122): dotted (1) corners and dotted triangles along the edges, a white (0) middle
    rows: String.raw`
      1 0/1 0/1 1
      0/1 0 0 1/0
      0/1 0 0 1/0
      1 1/0 1/0 1`,
  },
  crockettcabin: {
    label: 'Crockett cabin quilt',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1123a): one fabric (1) in squares and triangles on white (0)
    rows: String.raw`
      1 0 0/1 0
      0 1 0 1/0
      0/1 0 1 0
      0 1/0 0 1`,
  },
  roadtooklahoma: {
    label: 'Road to Oklahoma',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1123b): one fabric (1) in squares and triangles on white (0)
    rows: String.raw`
      1 0 0/1 1
      0 1 0 1/0
      0/1 0 1 0
      1 1/0 0 1`,
  },
  arkansascrossroads: {
    label: 'The Arkansas cross roads',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1123c): scribble (1), dotted (2) and striped (3) squares and triangles on white (0)
    rows: String.raw`
      1 2 3/0 0
      2 1 0 0/3
      3/0 0 1 2
      0 0/3 2 1`,
  },
  wildduck: {
    label: 'Wild duck',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1124): dotted (1) and striped (2) triangles in diagonal rows on white (0)
    rows: String.raw`
      0/1 0 0/1 2/0
      0 2/1 1 2/0
      0/1 1 2/1 0
      2/0 2/0 0 2/0`,
  },
  nelsonsvictory: {
    label: "Nelson's victory",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1125): scribble (1) corners, plus (2) squares and triangles in a pinwheel in the middle, white (0)
    rows: String.raw`
      1 2 0 1
      0 0\2 0/2 2
      2 2/0 2\0 0
      1 0 2 1`,
  },
  windmill: {
    label: 'Windmill',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1126): a pinwheel of triangles (1) in the middle and a triangle in each corner, on white (0)
    rows: String.raw`
      0/1 0 0 1\0
      0 1\0 1/0 0
      0 0/1 0\1 0
      0\1 0 0 1/0`,
  },
  xquartet: {
    label: 'X quartet',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1127): dotted (1) corners and a pinwheel of triangles (2) in the middle, white (0)
    rows: String.raw`
      1 0/2 0 1
      0 2\0 2/0 2\0
      0\2 0/2 0\2 0
      1 0 2/0 1`,
  },
  clayschoice: {
    label: "Clay's choice",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1128a): dotted (1) corners, a pinwheel of scribble (2) triangles with dotted triangles between, white (0)
    rows: String.raw`
      1 2\0 0 1
      0 1\2 1/2 2/0
      0/2 2/1 2\1 0
      1 0 0\2 1`,
  },
  blocksandpinwheels: {
    label: 'Blocks and pinwheels',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1128b): dotted (1) corners and a pinwheel of scribble (2) triangles on white (0)
    rows: String.raw`
      1 2\0 0 1
      0 0\2 0/2 2/0
      0/2 2/0 2\0 0
      1 0 0\2 1`,
  },
  yearsfavorite: {
    label: "Year's favorite",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1129a): striped (1) triangles in two long diagonal rows on white (0)
    rows: String.raw`
      0\1 0 0/1 0/1
      0\1 0\1 0/1 0
      0 1/0 1\0 1\0
      1/0 1/0 0 1\0`,
  },
  pinwheels: {
    label: 'Pinwheels',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1129b): dotted (1) and striped (2) triangles and squares turning about the middle, white (0)
    rows: String.raw`
      0\1 0\2 2 0/1
      2 1\0 1/0 0/2
      2/0 0/1 0\1 2
      1/0 2 2\0 1\0`,
  },
  roosevelt: {
    label: "Mr. Roosevelt's necktie",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1129.5): a dotted (1) diamond in the middle with four dotted squares round it, white (0)
    rows: String.raw`
      0 1 0 0
      1 1/1 1\0 0
      0 0\1 1/1 1
      0 0 1 0`,
  },
  yankeepuzzle: {
    label: 'Yankee puzzle',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1130a): dotted (1) triangles in diagonal rows on white (0)
    rows: String.raw`
      0/1 1\0 1\0 1\0
      0/1 0\1 0/1 1/0
      0/1 1/0 1\0 1/0
      0\1 0\1 0\1 1/0`,
  },
  flyfoot: {
    label: 'Flyfoot',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1130b): dotted (1) triangles turning about the middle, white (0)
    rows: String.raw`
      1/0 0\1 1\0 0\1
      0/1 1\0 1/0 0/1
      1/0 0/1 0\1 1/0
      1\0 0\1 1\0 0/1`,
  },
  ladieswreath: {
    label: "Ladies' wreath",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1131): striped (1) triangles in a wreath on white (0)
    rows: String.raw`
      0/1 0/1 0 1\0
      0/1 0/1 0\1 0
      0 1\0 1/0 1/0
      0\1 0 1/0 1/0`,
  },
  mosaic17: {
    label: 'Mosaic #17',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1132): sixteen half-square triangles, dotted (1) on white (0), all the same way
    rows: String.raw`
      1/0 1/0 1/0 1/0
      1/0 1/0 1/0 1/0
      1/0 1/0 1/0 1/0
      1/0 1/0 1/0 1/0`,
  },
  hopscotch: {
    label: 'Hopscotch',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1133): rows of half-square triangles, dotted (1) on white (0), turned every other row
    rows: String.raw`
      1\0 1\0 1\0 1\0
      0/1 0/1 0/1 0/1
      1\0 1\0 1\0 1\0
      0/1 0/1 0/1 0/1`,
  },
  twopatchquilt: {
    label: 'Two patch quilt',
    family: 'Stars',
    n: 4,
    // from a drawing (Brown 1136b): dotted (2) corners and middle, four white geese pointing in with scribble (1) round them
    rows: String.raw`
      2 v01 - 2
      >01 2 2 <01
      | 2 2 |
      2 ^01 - 2`,
  },
  sawtoothedstar: {
    label: 'Saw toothed star',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1136a): a scrap block of twelve different prints; white (0) corners, a pair of triangles top and bottom, squares between; the lower right square of the middle band is cut in two
    rows: String.raw`
      0 1\2 3/4 0
      1\4 4 5 5/2
      2/1 2 3 1\5
      0 4/3 2\5 0`,
  },
  freetrade: {
    label: 'Free trade',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1137), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0 1\0 0/1 0
      0\1 0/1 0 1/0
      0/1 0 1/0 1\0
      0 1/0 0\1 0`,
  },
  ribbonstar: {
    label: 'Ribbon star',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1138), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0 1\0 0/1 0
      0\1 1/0 0\1 1/0
      0/1 1\0 0/1 1\0
      0 1/0 0\1 0`,
  },
  chisholmtrail: {
    label: 'Chisholm trail',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1139), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1/0 1\0 0/1 0\1
      0\1 2 1\0 1/0
      0/1 0\1 2 1\0
      1\0 1/0 0\1 0/1`,
  },
  barbarafrietschie: {
    label: 'Barbara Frietschie',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1140a), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0/0 1\0 0/2 0\0
      0\2 0\1 0/1 1/0
      0/1 1/0 1\0 2\0
      0\0 2/0 0\1 0/0`,
  },
  coloradoquilt: {
    label: 'The Colorado quilt',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1140b), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0/1 1\0 0/1 1\0
      0\1 1\0 1/0 1/0
      0/1 0/1 0\1 1\0
      0\1 1/0 0\1 1/0`,
  },
  piecedstar: {
    label: 'Pieced star',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1140c), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1/0 1\0 0/1 0\1
      0\1 0\1 0/1 1/0
      0/1 1/0 1\0 1\0
      1\0 1/0 0\1 0/1`,
  },
  annaschoice: {
    label: "Anna's choice quilt",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1141a), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0\1 0\1 0/1 0/1
      0\1 1\0 1/0 0/1
      1/0 0/1 0\1 1\0
      1/0 1/0 1\0 1\0`,
  },
  margaretschoice: {
    label: "Margaret's choice",
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1141b), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0\1 2\0 1/2 0/1
      1\2 0\1 0/1 2/0
      0/2 1/0 1\0 2\1
      1/0 2/1 0\2 1\0`,
  },
  friendlyhand: {
    label: 'Friendly hand',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1142a), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1 0 1 1/0 0 1 0 0/1
      0 1 1/0 0 1 0 0/1 1
      1\0 0 0 0 0\1 1 1 1
      1 1\0 0 0 0 0\1 1 1
      0 1 0 0/1 1\1 0 1 1/0
      1 0 0/1 1 0 1\1 1/0 0
      0\1 1 1 1 1\0 0/0 0 0
      0 0\1 1 1 1 1\0 0 0`,
  },
  milkywayii: {
    label: 'Milky way II',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1142b), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1 0 2 2/0 0 1\1 0 0/2
      0 1 2/0 0 1 0 0/2 2
      2\0 0 0 0 0\2 2 2 2
      2 2\0 0 0 0 0\2 2 2
      0 1 0 0/2 1 0 2 2/0
      1 0 0/2 2 0 1 2/0 0
      0\2 2 2 2 2\0 0 0 0
      0 0\2 2 2 2 2\0 0 0`,
  },
  pinwheelsii: {
    label: 'Pinwheels II',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1142c), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1 0 2 2/0 0 1 0 0/2
      0 1 2/0 0 1 0 0/2 2
      2\0 0 0 0 0\2 2 0 0
      2 2\0 0 0 0 0\2 0 0
      0 1 0 0/2 1 0 2 2/0
      1 0 0/2 2 0 1 2/0 0
      0\2 2 0 0 2\0 0 0 0
      0 0\2 0 0 2 2\0 0 0`,
  },
  statehouse: {
    label: 'State house',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1143), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0 0/1 0 2 0 0/2 0 1
      0/1 1 2 0 0/2 2 1 0
      0 2 1 1/2 0 1/1 2 2/0
      2 0 1/2 2 1 0 2/0 0
      0 0/2 0 1 2 2/1 0 2
      0/2 2 1 0 2/1 1 2 0
      0 1 2 2/0 0 2 1 1/0
      1 0 2/0 0 2 0 1/0 0`,
  },
  sunnylanes: {
    label: 'Sunny lanes',
    family: 'Larger grids',
    n: 8,
    // from a drawing (Brown 1144), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      1 3 2 2/0 0 0/2 1 3
      3 1 2/0 0 0/2 2 3 1
      2 2/0 1 3 1 3 2 2/0
      2/0 0 3 1 3 1 2/0 0
      0 0/2 1 3 1 3 0 0/2
      0/2 2 3 1 3 1 0/2 2
      1 3 2 2/0 0 0/2 1 3
      3 1 2/0 0 0/2 2 3 1`,
  },
  ladyofthewhitehouse: {
    label: 'Lady of the White House',
    family: 'Four patch',
    n: 4,
    // from a drawing (Brown 1145), read by the line-drawing reader and corrected by hand
    rows: String.raw`
      0 1 0 0
      0 0\2 0/2 3
      3 2/0 2\0 0
      0 0 1 0`,
  },
};

export { GRID_BLOCKS };
