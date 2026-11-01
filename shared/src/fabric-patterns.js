// @ts-check
// Quilting fabrics drawn in plain code (pure: no DOM, works in Node and the browser): seamless 512 px pictures of
// solids, stripes, gingham, dots, plaids, small florals... Used by the app's fabric collection (1500 fabrics
// that cost nothing to download: each picture is drawn when it's needed) and by the server's seed script.
// The same number always gives the same fabric, so a quilt that uses one looks the same everywhere, always.

const SIZE = 512; // every repeat below divides 512, so the picture tiles without a seam

/** Colours quilters would recognise, by name. @type {[string, number][]} */
const COLOURS = [
  ['navy', 0x1f2a44],
  ['cobalt', 0x2451a6],
  ['sky', 0x8fc1e3],
  ['teal', 0x1b7f7a],
  ['aqua', 0x7fd1c7],
  ['sage', 0x9caf88],
  ['olive', 0x6b7a2a],
  ['forest', 0x2e5a3a],
  ['mustard', 0xd9a520],
  ['butter', 0xf3e2a0],
  ['tangerine', 0xe8762c],
  ['coral', 0xef7f6a],
  ['brick', 0xa3402e],
  ['cherry', 0xc3243a],
  ['rose', 0xe9a3b4],
  ['blush', 0xf6d5d0],
  ['plum', 0x6b2f5b],
  ['lavender', 0xb7a6d6],
  ['chocolate', 0x5b3a29],
  ['tan', 0xc9a77c],
  ['charcoal', 0x3a3a3c],
  ['grey', 0x9a9a9c],
  ['cream', 0xf5efe0],
  ['white', 0xfbfbf8],
];
/** More colours for the collection (the seed script keeps to the list above, so its fabrics stay the same). */
const MORE_COLOURS = /** @type {[string, number][]} */ ([
  ['indigo', 0x2f466f],
  ['denim', 0x4f6d8f],
  ['periwinkle', 0x8e9fd6],
  ['turquoise', 0x2fa9b0],
  ['mint', 0xa8d8bd],
  ['kelly green', 0x3a9a4a],
  ['moss', 0x7c8a4a],
  ['lemon', 0xf2d64b],
  ['gold', 0xc99a2e],
  ['peach', 0xf4b98e],
  ['rust', 0xb5562a],
  ['red', 0xb8202e],
  ['wine', 0x7a1f33],
  ['raspberry', 0xc2386a],
  ['pink', 0xf0a6c0],
  ['violet', 0x6a4c9c],
  ['mauve', 0xa77f8f],
  ['taupe', 0x9b8b7a],
  ['linen', 0xe6dccb],
  ['black', 0x1d1d1f],
]);
const ALL_COLOURS = [...COLOURS, ...MORE_COLOURS];
/**
 * The colours of the collection's second part (fabrics 500 on): none of them used before, and each far enough from
 * every colour above (more than 12 apart in Lab, the measure the colour finder uses) to look different on screen.
 */
const NEW_COLOURS = /** @type {[string, number][]} */ ([
  ['royal blue', 0x2a3fbf],
  ['cornflower', 0x6a8fdc],
  ['peacock', 0x0f5e6e],
  ['jade', 0x2f9a78],
  ['emerald', 0x13804f],
  ['pine', 0x234536],
  ['lime', 0xa8d14a],
  ['pistachio', 0xc5d9a0],
  ['chartreuse', 0xc8d636],
  ['sand', 0xdcc9a3],
  ['ochre', 0xb7802a],
  ['terracotta', 0xc3684f],
  ['salmon', 0xf59a86],
  ['watermelon', 0xe8505b],
  ['scarlet', 0xe2231a],
  ['fuchsia', 0xd1268f],
  ['magenta', 0xa21f6e],
  ['orchid', 0xc78ad1],
  ['lilac', 0xd8c6ea],
  ['eggplant', 0x3d1f3e],
  ['heather', 0xa49bb3],
  ['caramel', 0xa86a32],
  ['cinnamon', 0x8a4b2a],
  ['cocoa', 0x7a5848],
  ['stone', 0xbdb6aa],
  ['pewter', 0x707175],
  ['marigold', 0xe99a1c],
  ['sunflower', 0xf7c21e],
  ['butterscotch', 0xe0b05a],
  ['cranberry', 0x9b1b30],
  ['flamingo', 0xf28aa0],
  ['cerulean', 0x2a8fd0],
  ['mahogany', 0x6a2a1e],
]);
const WHITES = COLOURS.filter(([n]) => n === 'white' || n === 'cream');

/** A small seeded random number generator (mulberry32): the same seed gives the same numbers. @param {number} seed */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** @template T @param {() => number} rnd @param {T[]} list @returns {T} */
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
/** @param {number} c */
const lum = c => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
/** @param {number} a @param {number} b @param {number} t */
const mix = (a, b, t) => {
  const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** An RGB picture with the few drawing tools the patterns need. Shapes wrap around the edges. */
function canvas() {
  const px = new Uint8ClampedArray(SIZE * SIZE * 3);
  const wrap = v => ((v % SIZE) + SIZE) % SIZE;
  const blend = (x, y, c, a = 1) => {
    const i = (wrap(y) * SIZE + wrap(x)) * 3;
    px[i] += (((c >> 16) & 255) - px[i]) * a;
    px[i + 1] += (((c >> 8) & 255) - px[i + 1]) * a;
    px[i + 2] += ((c & 255) - px[i + 2]) * a;
  };
  return {
    px,
    blend,
    /** Paints every pixel with the colour f(x, y) gives. @param {(x: number, y: number) => number} f */
    fill(f) {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) blend(x, y, f(x, y));
    },
    /** A filled circle with soft (anti-aliased) edges. */
    circle(cx, cy, r, c) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const a = Math.min(1, Math.max(0, r - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
          if (a > 0) blend(x, y, c, a);
        }
    },
    /** A little random grain all over, so it reads as cloth rather than flat colour. */
    grain(rnd, amount) {
      for (let i = 0; i < px.length; i += 3) {
        const d = (rnd() - 0.5) * amount;
        px[i] += d;
        px[i + 1] += d;
        px[i + 2] += d;
      }
    },
  };
}
/** @typedef {ReturnType<typeof canvas>} Drawing */

/**
 * The kinds of fabric, each drawn on a canvas `d` with a background and a main colour.
 * @type {Record<string, (d: Drawing, rnd: () => number, bg: number, fg: number) => void>}
 */
const KINDS = {
  Solid(d, rnd, bg, fg) {
    d.fill(() => fg);
    d.grain(rnd, 14);
  },
  Stripe(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64, 128]),
      w = Math.round(p * (0.2 + rnd() * 0.4)),
      across = rnd() < 0.5;
    d.fill((x, y) => ((across ? y : x) % p < w ? fg : bg));
  },
  Pinstripe(d, rnd, bg, fg) {
    const p = pick(rnd, [8, 16, 32]),
      w = 1 + Math.floor(rnd() * 3),
      across = rnd() < 0.5;
    d.fill((x, y) => ((across ? y : x) % p < w ? fg : bg));
  },
  'Bias stripe'(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64]),
      w = Math.round(p * (0.3 + rnd() * 0.3)),
      left = rnd() < 0.5;
    d.fill((x, y) => ((left ? x + y : x - y + SIZE) % p < w ? fg : bg));
  },
  Gingham(d, rnd, bg, fg) {
    const p = pick(rnd, [8, 16, 32]);
    d.fill((x, y) => {
      const n = (x % (2 * p) < p ? 1 : 0) + (y % (2 * p) < p ? 1 : 0);
      return n === 2 ? fg : n === 1 ? mix(bg, fg, 0.5) : bg;
    });
  },
  Check(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64, 128]);
    d.fill((x, y) => ((((x / p) | 0) + ((y / p) | 0)) % 2 ? fg : bg));
  },
  'Polka dot'(d, rnd, bg, fg) {
    const p = pick(rnd, [32, 64, 128]),
      r = p * (0.12 + rnd() * 0.18);
    d.fill(() => bg);
    for (let j = 0; j < SIZE / p; j++)
      for (let i = 0; i < SIZE / p; i++) d.circle(i * p + p / 2 + (j % 2 ? p / 2 : 0), j * p + p / 2, r, fg);
  },
  Ditsy(d, rnd, bg, fg) {
    const other = pick(rnd, COLOURS)[1];
    d.fill(() => bg);
    for (let n = 150 + Math.floor(rnd() * 250); n > 0; n--)
      d.circle(rnd() * SIZE, rnd() * SIZE, 2 + rnd() * 3, rnd() < 0.7 ? fg : other);
  },
  Floral(d, rnd, bg, fg) {
    const middle = pick(rnd, COLOURS)[1],
      leaf = pick(rnd, [0x9caf88, 0x6b7a2a, 0x2e5a3a]);
    d.fill(() => bg);
    for (let n = 25 + Math.floor(rnd() * 45); n > 0; n--) {
      const cx = rnd() * SIZE,
        cy = rnd() * SIZE,
        r = 5 + rnd() * 8,
        turn = rnd() * Math.PI;
      d.circle(cx + Math.cos(turn) * r * 2.2, cy + Math.sin(turn) * r * 2.2, r * 0.55, leaf);
      for (let k = 0; k < 5; k++) {
        const a = turn + (k * 2 * Math.PI) / 5;
        d.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.7, fg);
      }
      d.circle(cx, cy, r * 0.5, middle);
    }
  },
  Plaid(d, rnd, bg, fg) {
    const p = pick(rnd, [128, 256]);
    const bands = [{ at: 0, w: p * (0.15 + rnd() * 0.2), c: fg }];
    for (let n = 2 + Math.floor(rnd() * 3); n > 0; n--)
      bands.push({ at: rnd() * p, w: p * (0.03 + rnd() * 0.12), c: rnd() < 0.5 ? fg : pick(rnd, COLOURS)[1] });
    const inBand = (v, b) => (v - b.at + p) % p < b.w;
    d.fill(() => bg);
    for (const b of bands)
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (inBand(x, b)) d.blend(x, y, b.c, 0.45);
          if (inBand(y, b)) d.blend(x, y, b.c, 0.45);
        }
  },
  Chevron(d, rnd, bg, fg) {
    const p = pick(rnd, [32, 64, 128]),
      q = pick(rnd, [16, 32, 64]);
    d.fill((x, y) => ((y + Math.abs((x % p) - p / 2)) % q < q / 2 ? fg : bg));
  },
  // a tone-on-tone blender: soft clouds of a lighter and a darker shade of one colour (like a batik)
  Mottled(d, rnd, bg, fg) {
    d.fill(() => fg);
    for (let n = 160; n > 0; n--) {
      const c = rnd() < 0.5 ? mix(fg, 0xffffff, 0.25) : mix(fg, 0x000000, 0.2),
        cx = rnd() * SIZE,
        cy = rnd() * SIZE,
        r = 12 + rnd() * 40;
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const t = 1 - Math.hypot(x - cx, y - cy) / r;
          if (t > 0) d.blend(x, y, c, t * t * 0.18);
        }
    }
    d.grain(rnd, 10);
  },
  // the broken check of tweed jackets, woven the real way: a 2/2 twill whose lengthwise and crosswise threads both
  // go four dark, four light (each "thread" here is k pixels wide)
  Houndstooth(d, rnd, bg, fg) {
    const k = pick(rnd, [2, 4, 8]);
    d.fill((x, y) => {
      const i = (x / k) | 0,
        j = (y / k) | 0,
        lengthwiseOnTop = (i + j) % 4 < 2;
      return (lengthwiseOnTop ? i : j) % 8 < 4 ? fg : bg;
    });
  },
};
const KIND_NAMES = Object.keys(KINDS);

/**
 * One picture: `kind` drawn with these colours, the random choices (sizes, places) made from `seed`.
 * @param {string} kind @param {number} seed @param {number} bg @param {number} fg
 * @returns {Uint8ClampedArray} SIZE × SIZE RGB pixels
 */
const drawPattern = (kind, seed, bg, fg) => drawWith(kind, random(seed), bg, fg);
/**
 * The same, with the random choices taken from `rnd` (the seed script draws its colours from it first).
 * @param {string} kind @param {() => number} rnd @param {number} bg @param {number} fg
 */
function drawWith(kind, rnd, bg, fg) {
  const d = canvas();
  KINDS[kind](d, rnd, bg, fg);
  if (kind !== 'Solid' && kind !== 'Mottled') d.grain(rnd, 6);
  return d.px;
}

// ---- the collection: 1500 fabrics in the app, each known by its number (id "c" + number)

/**
 * The collection's parts, made one after the other: how many fabrics, the seed of their random choices, the main
 * colours and the background colours. Only ever add a part at the end: the fabrics before stay the same.
 * @type {{ count: number, seed: number, main: [string, number][], back: [string, number][] }[]}
 */
const PARTS = [
  { count: 500, seed: 2026, main: ALL_COLOURS, back: ALL_COLOURS },
  // 1000 more, each with one of the new colours as its main colour (backgrounds from every colour)
  { count: 1000, seed: 2027, main: NEW_COLOURS, back: [...ALL_COLOURS, ...NEW_COLOURS] },
];
/** How many fabrics the collection has. */
const COLLECTION_SIZE = PARTS.reduce((n, p) => n + p.count, 0);
// how often each kind comes up (solids and blenders are what quilters buy most)
const COLLECTION_KINDS = [
  'Solid',
  'Mottled',
  'Ditsy',
  'Floral',
  'Gingham',
  'Polka dot',
  'Stripe',
  'Pinstripe',
  'Check',
  'Plaid',
  'Bias stripe',
  'Chevron',
  'Houndstooth',
  'Solid',
  'Mottled',
  'Ditsy',
  'Floral',
];
/**
 * One fabric of the collection, without its picture.
 * @typedef {{ id: string, name: string, cm: number, kind: string, seed: number, bg: number, fg: number,
 *   colours: [string, string] }} CollectionFabric
 */
/** @type {CollectionFabric[] | null} */
let list = null;
/** The collection's fabrics, in order (worked out once; no pictures drawn). @returns {CollectionFabric[]} */
function collection() {
  if (list) return list;
  list = [];
  const seen = new Set();
  for (const part of PARTS) {
    const rnd = random(part.seed),
      end = list.length + part.count;
    for (let n = 0; list.length < end && n < part.count * 20; n++) {
      const kind = COLLECTION_KINDS[n % COLLECTION_KINDS.length];
      const [fgName, fg] = pick(rnd, part.main);
      // a lighter background for the main colour (white or cream for gingham and most dots); a very light main
      // colour goes on a darker one instead
      const lighter = part.back.filter(([, c]) => lum(c) > lum(fg) + 60);
      const darker = part.back.filter(([, c]) => lum(c) < lum(fg) - 60);
      const plainBg = (kind === 'Gingham' || kind === 'Polka dot') && lum(fg) < 200 && rnd() < 0.7;
      const [bgName, bg] = plainBg ? pick(rnd, WHITES) : pick(rnd, lighter.length ? lighter : darker);
      const seed = Math.floor(rnd() * 2 ** 31);
      const one = kind === 'Solid' || kind === 'Mottled';
      const key = one ? `${kind} ${fgName}` : `${kind} ${fgName} ${bgName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const Fg = fgName[0].toUpperCase() + fgName.slice(1),
        k = kind.toLowerCase();
      const name =
        kind === 'Solid' ? `${Fg} solid` : kind === 'Mottled' ? `${Fg} mottled blender` : `${Fg} ${k} on ${bgName}`;
      // the real width of the picture: small prints are small (10 to 35 cm across)
      const cm = one ? 22 : Math.round((10 + rnd() * 25) * 2) / 2;
      list.push({
        id: 'c' + list.length,
        name,
        cm,
        kind,
        seed,
        bg: one ? fg : bg,
        fg,
        colours: [fgName, one ? fgName : bgName],
      });
    }
  }
  return list;
}
/** A collection fabric's picture. @param {CollectionFabric} f @returns {Uint8ClampedArray} SIZE × SIZE RGB */
const drawCollectionFabric = f => drawPattern(f.kind, f.seed, f.bg, f.fg);

export {
  COLLECTION_SIZE,
  COLOURS,
  KIND_NAMES,
  SIZE,
  WHITES,
  collection,
  drawCollectionFabric,
  drawPattern,
  drawWith,
  lum,
  pick,
  random,
};
