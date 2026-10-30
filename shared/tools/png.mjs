// Reading and writing PNG files with Node's own zlib (no image library): 8-bit greyscale, grey + alpha, RGB, RGBA
// and palette pictures, not interlaced. Enough for screenshots and scans of quilt blocks.
import zlib from 'node:zlib';

/** @param {Buffer} buf @returns {{ width: number, height: number, data: Uint8Array, channels: 3 }} */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG file');
  let p = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    interlace = 0,
    palette = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p),
      kind = buf.toString('ascii', p + 4, p + 8),
      body = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error('only 8-bit, non-interlaced PNG files can be read');
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!bpp) throw new Error(`PNG colour type ${type} is not supported`);
  const raw = zlib.inflateSync(Buffer.concat(idat)),
    stride = width * bpp,
    rows = new Uint8Array(height * stride);
  // undo the per-row filters (PNG spec section 9)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)],
      src = y * (stride + 1) + 1,
      dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[dst + x - bpp] : 0,
        b = y ? rows[dst - stride + x] : 0,
        c = x >= bpp && y ? rows[dst - stride + x - bpp] : 0,
        v = raw[src + x];
      let out;
      if (f === 0) out = v;
      else if (f === 1) out = v + a;
      else if (f === 2) out = v + b;
      else if (f === 3) out = v + ((a + b) >> 1);
      else {
        const pp = a + b - c,
          pa = Math.abs(pp - a),
          pb = Math.abs(pp - b),
          pc = Math.abs(pp - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      rows[dst + x] = out & 255;
    }
  }
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const s = i * bpp;
    if (type === 2 || type === 6) data.set(rows.subarray(s, s + 3), i * 3);
    else if (type === 3) data.set(palette.subarray(rows[s] * 3, rows[s] * 3 + 3), i * 3);
    else data.fill(rows[s], i * 3, i * 3 + 3); // grey
    if (type === 6 || type === 4) {
      // see-through pixels on white
      const alpha = rows[s + bpp - 1] / 255;
      for (let k = 0; k < 3; k++) data[i * 3 + k] = Math.round(data[i * 3 + k] * alpha + 255 * (1 - alpha));
    }
  }
  return { width, height, data, channels: 3 };
}

export { encodePng } from '../../server/scripts/fabric-patterns.js';
