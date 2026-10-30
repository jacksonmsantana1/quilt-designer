// Colours of fabrics, and how well a fabric matches the colours someone asks for (the colour finder). Pure: no DOM,
// so the unit tests use it directly. Colours are compared in CIE Lab, where distances match what the eye sees.

const lin = c => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** sRGB 0..255 -> Lab. @param {number[]} rgb @returns {number[]} */
export function lab([r, g, b]) {
  const R = lin(r),
    G = lin(g),
    B = lin(b);
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047),
    y = f(0.2126 * R + 0.7152 * G + 0.0722 * B),
    z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Hue (0–360), saturation and lightness (0–1) -> sRGB 0..255. @returns {number[]} */
export function hslToRgb(h, s, l) {
  const k = n => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}
/** sRGB 0..255 -> hue (0–360), saturation and lightness (0–1). @param {number[]} rgb */
export function rgbToHsl([r, g, b]) {
  const R = r / 255,
    G = g / 255,
    B = b / 255,
    max = Math.max(R, G, B),
    min = Math.min(R, G, B),
    l = (max + min) / 2,
    d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: Math.min(1, s), l };
}

/**
 * A fabric's main colours: up to five, with the share of the picture each covers (largest first). Pixels in RGBA
 * (a canvas's ImageData). Colours nearer than the eye easily tells apart are joined into one.
 * @param {Uint8ClampedArray | Uint8Array} rgba @returns {{ rgb: number[], share: number }[]}
 */
export function fabricColours(rgba) {
  const pts = [],
    cols = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // see-through: not fabric
    const c = [rgba[i], rgba[i + 1], rgba[i + 2]];
    cols.push(c);
    pts.push(lab(c));
  }
  if (!pts.length) return [];
  // k-means, five clusters, started from points far apart (the same every time)
  const k = Math.min(5, pts.length),
    centres = [pts[0]];
  while (centres.length < k) {
    let far = pts[0],
      fd = -1;
    for (const p of pts) {
      const d = Math.min(...centres.map(c => dist2(p, c)));
      if (d > fd) {
        fd = d;
        far = p;
      }
    }
    centres.push(far);
  }
  let which = new Array(pts.length).fill(0);
  for (let it = 0; it < 8; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    which = pts.map(p => {
      let bi = 0,
        bd = Infinity;
      centres.forEach((c, i) => {
        const d = dist2(p, c);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const s = sum[bi];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
      return bi;
    });
    sum.forEach((s, i) => {
      if (s[3]) centres[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  // each cluster's colour (the average of its pixels, in sRGB) and share
  let groups = centres.map((c, i) => {
    const mine = cols.filter((_, j) => which[j] === i);
    const avg = [0, 1, 2].map(ch => (mine.length ? mine.reduce((s, m) => s + m[ch], 0) / mine.length : 0));
    return { lab: c, rgb: avg.map(Math.round), share: mine.length / pts.length };
  });
  // join colours closer than ~8 (Lab), the larger share keeping its colour
  for (let joined = true; joined;) {
    joined = false;
    groups = groups.filter(g => g.share > 0).sort((a, b) => b.share - a.share);
    for (let i = 0; i < groups.length && !joined; i++)
      for (let j = i + 1; j < groups.length && !joined; j++)
        if (dist2(groups[i].lab, groups[j].lab) < 64) {
          groups[i].share += groups[j].share;
          groups[j].share = 0;
          joined = true;
        }
  }
  return groups.filter(g => g.share >= 0.02).map(g => ({ rgb: g.rgb, share: +g.share.toFixed(3) }));
}

/**
 * How well a fabric matches the colours asked for, 0 to 1. For each colour asked: how much of the fabric is close
 * to it (a near shade counts in part), up to the amount asked; added up. Amounts are shares (any scale: they are
 * made to add up to 1 here).
 * @param {{ rgb: number[], amount: number }[]} wanted @param {{ rgb: number[], share: number }[]} colours
 */
export function colourMatch(wanted, colours) {
  const total = wanted.reduce((s, w) => s + w.amount, 0);
  if (!total || !colours.length) return 0;
  const sigma2 = 2 * 16 * 16; // a shade ~16 (Lab) away counts about half
  const fab = colours.map(c => ({ lab: lab(c.rgb), share: c.share }));
  let score = 0;
  for (const w of wanted) {
    const L = lab(w.rgb);
    let near = 0;
    for (const c of fab) near += c.share * Math.exp(-dist2(L, c.lab) / sigma2);
    score += Math.min(w.amount / total, near);
  }
  return score;
}

/**
 * Amounts after one changed: the others share what's left in the proportions they had, so together they stay 100.
 * @param {number[]} amounts @param {number} changed index (−1: just make them add up) @returns {number[]}
 */
export function shareAmounts(amounts, changed) {
  if (!amounts.length) return [];
  if (amounts.length === 1) return [100]; // one colour is all of it
  const fixed = changed >= 0 ? Math.max(0, Math.min(100, amounts[changed])) : 0,
    rest = 100 - fixed,
    others = amounts.map((a, i) => (i === changed ? 0 : a)),
    ot = others.reduce((s, a) => s + a, 0);
  const n = amounts.length - (changed >= 0 ? 1 : 0);
  const out = amounts.map((a, i) => (i === changed ? fixed : n ? (ot ? (a * rest) / ot : rest / n) : 0));
  const rounded = out.map(Math.round),
    diff = 100 - rounded.reduce((s, a) => s + a, 0),
    fix = rounded.findIndex((_, i) => i !== changed);
  if (diff && fix >= 0) rounded[fix] += diff;
  return rounded;
}
