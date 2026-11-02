// The shape of a quilted top, worked out from where its stitches are: the batting sinks into a valley at each stitch
// line, rises into a soft pillow between them, and puckers in little ripples that run away from the line.
// Pure (no DOM, no three.js) so the unit tests import it directly. Heights are in mm, 0 being the quilt's top face.

// The batting climbs out of a stitch line in three stages: a tight crease, a shoulder, then the long slow dome of the
// pillow. Each is [share of the depth, how far it reaches in mm].
const VALLEY = [
  [0.35, 3.5],
  [0.35, 13],
  [0.3, 42],
];
// where the puckers are strongest, and how far apart they are along the line
const PUCKER_MM = 10,
  PUCKER_SPACING_MM = 24;
// the threads of the cloth: the height of their slubs, how long they run and how far apart they lie
const WEAVE_MM = 0.05,
  WEAVE_LONG_MM = 22,
  WEAVE_WIDE_MM = 1.6;
// the edge comes back to the top face over this distance, to meet the binding
const EDGE_MM = 8;

// A table of random values (always the same ones) for the noise below.
const NOISE = (() => {
  const table = new Float32Array(65536);
  let seed = 4242;
  for (let i = 0; i < table.length; i++) {
    seed = (seed * 16807) % 2147483647;
    table[i] = (seed / 2147483647) * 2 - 1;
  }
  return table;
})();
/** Smooth random hills between -1 and 1, one hill or so per unit of x and y. */
function noise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    fx = x - xi,
    fy = y - yi,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255,
    x1 = (xi + 1) & 255,
    y0 = (yi & 255) << 8,
    y1 = ((yi + 1) & 255) << 8;
  const a = NOISE[x0 + y0],
    b = NOISE[x1 + y0],
    c = NOISE[x0 + y1],
    d = NOISE[x1 + y1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * For every pixel, the distance to the nearest stitched pixel and which pixel that is (exact, in time proportional to
 * the number of pixels: the Felzenszwalb and Huttenlocher distance transform, keeping the winner).
 * @param {Uint8Array} mask non-zero where there is a stitch @param {number} w @param {number} h
 * @returns {{ dist: Float32Array, near: Int32Array }} near is -1 when nothing is stitched
 */
function nearestStitch(mask, w, h) {
  const FAR = 1e9,
    down = new Float32Array(w * h), // distance up or down the column to its nearest stitch
    from = new Int32Array(w * h).fill(-1); // and that stitch's row
  for (let x = 0; x < w; x++) {
    let last = -1;
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      if (mask[i]) last = y;
      down[i] = last < 0 ? FAR : y - last;
      from[i] = last;
    }
    last = -1;
    for (let y = h - 1; y >= 0; y--) {
      const i = y * w + x;
      if (mask[i]) last = y;
      if (last >= 0 && last - y < down[i]) {
        down[i] = last - y;
        from[i] = last;
      }
    }
  }
  const dist = new Float32Array(w * h),
    near = new Int32Array(w * h).fill(-1),
    site = new Int32Array(w), // the columns whose parabolas make up the lower envelope of this row
    start = new Float64Array(w + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let k = -1;
    for (let x = 0; x < w; x++) {
      const gx = down[row + x];
      if (gx >= FAR) continue;
      let s = -Infinity;
      while (k >= 0) {
        const q = site[k],
          gq = down[row + q];
        s = (gx * gx + x * x - gq * gq - q * q) / (2 * (x - q));
        if (s > start[k]) break;
        k--;
      }
      k++;
      site[k] = x;
      start[k] = k === 0 ? -Infinity : s;
    }
    if (k < 0) {
      dist.fill(FAR, row, row + w);
      continue;
    }
    let j = 0;
    for (let x = 0; x < w; x++) {
      while (j < k && start[j + 1] < x) j++;
      const q = site[j],
        g = down[row + q],
        dx = x - q;
      dist[row + x] = Math.sqrt(dx * dx + g * g);
      near[row + x] = from[row + q] * w + q;
    }
  }
  return { dist, near };
}

/**
 * A soft blur: three passes of a box blur, which together look like a Gaussian. Returns a new array.
 * @param {Float32Array} src @param {number} w @param {number} h @param {number} r radius of each pass, in pixels
 */
function softBlur(src, w, h, r) {
  // lines of n pixels, the next line starting `next` further on and each pixel `step` from the one before
  const blurLines = (from, lines, n, next, step) => {
    const to = new Float32Array(w * h);
    for (let l = 0; l < lines; l++) {
      const first = l * next,
        at = i => from[first + step * Math.max(0, Math.min(n - 1, i))];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < n; i++) {
        to[first + step * i] = sum / (2 * r + 1);
        sum += at(i + r + 1) - at(i - r);
      }
    }
    return to;
  };
  let a = src;
  for (let pass = 0; pass < 3; pass++) a = blurLines(blurLines(a, h, w, w, 1), w, h, 1, w);
  return a;
}

/**
 * The height of the quilted top at each pixel, in mm.
 * @param {Uint8Array} mask non-zero where there is a stitch @param {number} w @param {number} h
 * @param {{ mmPerPx: number, depth: number, thread?: Uint8Array }} o depth: how deep the valleys are, mm;
 *   thread: non-zero on the stitches themselves, which each pull in a tiny dimple
 */
function quiltRelief(mask, w, h, o) {
  const { mmPerPx, depth, thread } = o,
    { dist, near } = nearestStitch(mask, w, h),
    out = new Float32Array(w * h);
  let puckers = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++)
    for (let x = 0; x < w; x++, i++) {
      if (near[i] < 0) continue;
      const d = dist[i] * mmPerPx,
        e = d / PUCKER_MM;
      // the noise is read at the nearest stitch, so its value is the same all the way along each line leaving
      // the seam: that makes ripples across the seam rather than blotches
      const nx = ((near[i] % w) * mmPerPx) / PUCKER_SPACING_MM,
        ny = (Math.floor(near[i] / w) * mmPerPx) / PUCKER_SPACING_MM;
      puckers[i] = noise(nx, ny) * e * Math.exp(1 - e) * depth * 0.1;
      for (const [share, reach] of VALLEY) out[i] -= depth * share * Math.exp(-d / reach);
    }
  // where two seams are equally near the ripples would jump, so soften them a little
  puckers = softBlur(puckers, w, h, 1);
  for (let y = 0, i = 0; y < h; y++)
    for (let x = 0; x < w; x++, i++) {
      const X = x * mmPerPx,
        Y = y * mmPerPx;
      // uneven batting, and the broad rise and fall of a quilt that was laid down by hand (only upwards: never into the bed)
      const lumps =
        noise(X / 38, Y / 38) * 0.08 +
        noise(X / 95 + 7, Y / 95 + 3) * 0.18 +
        (noise(X / 310 + 2, Y / 310 + 9) + 1) * 0.28;
      const weave =
        (noise(X / WEAVE_WIDE_MM, Y / WEAVE_LONG_MM) + noise(X / WEAVE_LONG_MM + 5, Y / WEAVE_WIDE_MM + 5)) * WEAVE_MM;
      const edge = Math.min(1, (Math.min(x, y, w - 1 - x, h - 1 - y) * mmPerPx) / EDGE_MM),
        fade = edge * edge * (3 - 2 * edge);
      out[i] = (out[i] + puckers[i] + lumps * depth + weave - (thread && thread[i] ? 0.45 : 0)) * fade;
    }
  return out;
}

/**
 * A heights image as a tangent-space normal map, the way three.js reads one (image rows run down, v runs up).
 * @param {Float32Array} height mm @param {number} w @param {number} h @param {number} mmPerPx
 * @returns {Uint8ClampedArray} 4 values per pixel
 */
function reliefNormals(height, w, h, mmPerPx) {
  const rgba = new Uint8ClampedArray(4 * w * h);
  for (let y = 0, i = 0; y < h; y++) {
    const up = y > 0 ? -w : 0,
      dn = y < h - 1 ? w : 0;
    for (let x = 0; x < w; x++, i++) {
      const lf = x > 0 ? -1 : 0,
        rt = x < w - 1 ? 1 : 0;
      const sx = (height[i + rt] - height[i + lf]) / ((rt - lf || 1) * mmPerPx),
        sy = (height[i + dn] - height[i + up]) / (((dn - up) / w || 1) * mmPerPx),
        l = Math.hypot(sx, sy, 1),
        o = 4 * i;
      rgba[o] = ((-sx / l) * 0.5 + 0.5) * 255;
      rgba[o + 1] = ((sy / l) * 0.5 + 0.5) * 255;
      rgba[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/**
 * A grid of values made k times finer along a smooth curve (Catmull-Rom) that passes through the original values.
 * @param {ArrayLike<number>} src n × n × dim values @param {number} n @param {number} k @param {number} dim
 * @returns {Float32Array} ((n - 1) k + 1)² × dim values
 */
function refineGrid(src, n, k, dim) {
  const fine = (n - 1) * k + 1,
    out = new Float32Array(fine * fine * dim),
    weights = [];
  for (let s = 0; s < k; s++) {
    const t = s / k,
      t2 = t * t,
      t3 = t2 * t;
    weights.push([
      -0.5 * t + t2 - 0.5 * t3,
      1 - 2.5 * t2 + 1.5 * t3,
      0.5 * t + 2 * t2 - 1.5 * t3,
      -0.5 * t2 + 0.5 * t3,
    ]);
  }
  const clampN = i => Math.max(0, Math.min(n - 1, i));
  // along the rows first, then down the columns
  const rows = new Float32Array(fine * n * dim);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < fine; i++) {
      const c = Math.min(n - 2, Math.floor(i / k)),
        s = i - c * k,
        w = s < k ? weights[s] : [0, 0, 1, 0];
      for (let d = 0; d < dim; d++) {
        let v = 0;
        for (let m = 0; m < 4; m++) v += w[m] * src[dim * (j * n + clampN(c - 1 + m)) + d];
        rows[dim * (j * fine + i) + d] = v;
      }
    }
  for (let j = 0; j < fine; j++) {
    const c = Math.min(n - 2, Math.floor(j / k)),
      s = j - c * k,
      w = s < k ? weights[s] : [0, 0, 1, 0];
    const r0 = clampN(c - 1),
      r1 = c,
      r2 = c + 1,
      r3 = clampN(c + 2);
    for (let i = 0; i < fine; i++)
      for (let d = 0; d < dim; d++)
        out[dim * (j * fine + i) + d] =
          w[0] * rows[dim * (r0 * fine + i) + d] +
          w[1] * rows[dim * (r1 * fine + i) + d] +
          w[2] * rows[dim * (r2 * fine + i) + d] +
          w[3] * rows[dim * (r3 * fine + i) + d];
  }
  return out;
}

export { nearestStitch, quiltRelief, refineGrid, reliefNormals, softBlur };
