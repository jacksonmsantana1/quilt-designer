// Made-up quilting fabrics for development: seamless 512 px pictures (stripes, gingham, dots, plaids, small
// florals...) drawn in plain code and saved as PNG, so the seed script needs no image library. The same number
// always gives the same fabric, so seeding twice adds nothing new.
import zlib from 'node:zlib';
import { COLOURS, SIZE, WHITES, drawWith, lum, pick, random } from '@quilt/shared/fabric-patterns.js';

// the kinds the seed takes turns with (the app's collection has a few more); keep this list as it is, so seeding
// again gives the same fabrics
const KIND_NAMES = [
  'Solid',
  'Stripe',
  'Pinstripe',
  'Bias stripe',
  'Gingham',
  'Check',
  'Polka dot',
  'Ditsy',
  'Floral',
  'Plaid',
  'Chevron',
];

/** Writes RGB pixels as a PNG file (no filtering: the patterns are simple and still pack small). */
export function encodePng(width, height, rgb) {
  const row = width * 3;
  const raw = Buffer.alloc((row + 1) * height); // each row starts with its filter byte, 0 = none
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8 bits per channel, RGB, standard compression/filters, not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Fabric number n: kinds take turns so any count gets an even mix.
 * @param {number} n @returns {{ name: string, cm: number, png: Buffer }}
 */
export function makeFabric(n) {
  const kind = KIND_NAMES[n % KIND_NAMES.length];
  const rnd = random(n + 1);
  const [fgName, fg] = pick(rnd, COLOURS);
  // the background is a lighter colour than the main one (white/cream for gingham); a very light main colour
  // goes on a darker background instead
  const lighter = COLOURS.filter(([, c]) => lum(c) > lum(fg) + 60);
  const darker = COLOURS.filter(([, c]) => lum(c) < lum(fg) - 60);
  const [bgName, bg] =
    kind === 'Gingham' && lum(fg) < 200 ? pick(rnd, WHITES) : pick(rnd, lighter.length ? lighter : darker);
  const px = drawWith(kind, rnd, bg, fg);
  const name = kind === 'Solid' ? `Solid ${fgName} #${n}` : `${kind}, ${fgName} on ${bgName} #${n}`;
  const cm = Math.round((10 + rnd() * 25) * 2) / 2; // real width of the picture: 10 to 35 cm
  return { name, cm, png: encodePng(SIZE, SIZE, px) };
}
