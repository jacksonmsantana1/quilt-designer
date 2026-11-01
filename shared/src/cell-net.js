// @ts-check
// A very small neural network that learns what shape a cell of a line drawing is (a square, cut one way or the other,
// or an hourglass), from corrections made by hand. Pure JavaScript, no libraries, trains in seconds: the cell's small
// picture (12 × 12 ink shares) and the ten numbers of seam evidence from drawing-reader.js go in; four probabilities
// come out. Turning a cell over or on its side gives eight times the examples (flips swap "/" and "\\").

import { PATCH } from './drawing-reader.js';

/** @typedef {{ patch: string, feats: number[], size?: number, label?: string }} Sample */
/** @typedef {{ inputs: number, hidden: number, w1: number[][], b1: number[], w2: number[][], b2: number[], classes: string[] }} Net */

const CLASSES = ['S', '/', '\\', 'X'];
const INPUTS = PATCH * PATCH + 11;

/** A small seeded random number generator (mulberry32). @param {number} seed */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The network's input for a sample. @param {Sample} s @returns {number[]} */
const inputOf = s => [...Array.from(s.patch, ch => parseInt(ch, 16) / 15), ...s.feats, Math.min(s.size || 30, 60) / 30];

/** The eight ways to turn a cell: [flip left-right, flip up-down, swap the axes]. */
/** @type {[number, number, number][]} */
const TURNS = [0, 1, 2, 3, 4, 5, 6, 7].map(k => [k & 1, (k >> 1) & 1, (k >> 2) & 1]);
/** The same sample turned. A flip swaps "/" and "\\" (and the evidence for them); swapping the axes changes neither. @param {Sample} s */
function turned(s, [h, v, t]) {
  const cells = Array.from(s.patch, ch => parseInt(ch, 16));
  const at = (i, j) => cells[j * PATCH + i];
  let out = '';
  for (let j = 0; j < PATCH; j++)
    for (let i = 0; i < PATCH; i++) {
      let x = h ? PATCH - 1 - i : i,
        y = v ? PATCH - 1 - j : j;
      if (t) [x, y] = [y, x];
      out += at(x, y).toString(16);
    }
  const flips = h ^ v;
  const feats = flips ? [...s.feats.slice(5), ...s.feats.slice(0, 5)] : s.feats.slice();
  const label = s.label && flips && (s.label === '/' || s.label === '\\') ? (s.label === '/' ? '\\' : '/') : s.label;
  return { patch: out, feats, size: s.size, label };
}

/** @param {number} inputs @param {number} hidden @param {() => number} rnd @returns {Net} */
function newNet(inputs, hidden, rnd) {
  const glorot = (a, b) => (rnd() * 2 - 1) * Math.sqrt(6 / (a + b));
  return {
    inputs,
    hidden,
    w1: Array.from({ length: hidden }, () => Array.from({ length: inputs }, () => glorot(inputs, hidden))),
    b1: Array(hidden).fill(0),
    w2: Array.from({ length: CLASSES.length }, () =>
      Array.from({ length: hidden }, () => glorot(hidden, CLASSES.length)),
    ),
    b2: Array(CLASSES.length).fill(0),
    classes: CLASSES,
  };
}

/** @param {Net} net @param {number[]} x */
function forward(net, x) {
  const h = net.w1.map((w, j) => Math.tanh(w.reduce((a, wi, i) => a + wi * x[i], net.b1[j])));
  const z = net.w2.map((w, k) => w.reduce((a, wi, j) => a + wi * h[j], net.b2[k]));
  const mx = Math.max(...z),
    e = z.map(v => Math.exp(v - mx)),
    sum = e.reduce((a, b) => a + b, 0);
  return { h, p: e.map(v => v / sum) };
}

/** The shape the network thinks a cell is, and how sure. @param {Net} net @param {Sample} s */
function predict(net, s) {
  const { p } = forward(net, inputOf(s));
  let k = 0;
  p.forEach((v, i) => {
    if (v > p[k]) k = i;
  });
  return { shape: /** @type {'S' | '/' | '\\' | 'X'} */ (net.classes[k]), p: p[k], probs: p };
}

/**
 * Trains a network on labelled cells (each also turned the 8 ways).
 * @param {Sample[]} samples @param {{ hidden?: number, epochs?: number, lr?: number, seed?: number }} [o]
 * @returns {Net}
 */
function train(samples, { hidden = 24, epochs = 40, lr = 0.03, seed = 1 } = {}) {
  const rnd = random(seed),
    net = newNet(INPUTS, hidden, rnd);
  const data = samples
    .flatMap(s => TURNS.map(t => turned(s, t)))
    .map(s => ({ x: inputOf(s), y: CLASSES.indexOf(/** @type {string} */ (s.label)) }));
  const order = data.map((_, i) => i);
  const vel = {
    w1: net.w1.map(r => r.map(() => 0)),
    b1: net.b1.map(() => 0),
    w2: net.w2.map(r => r.map(() => 0)),
    b2: net.b2.map(() => 0),
  };
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rate = lr * (1 - (0.8 * e) / epochs);
    for (const idx of order) {
      const { x, y } = data[idx],
        { h, p } = forward(net, x);
      const dz = p.map((v, k) => v - (k === y ? 1 : 0));
      const dh = h.map((hj, j) => (1 - hj * hj) * dz.reduce((a, d, k) => a + d * net.w2[k][j], 0));
      for (let k = 0; k < dz.length; k++) {
        for (let j = 0; j < h.length; j++) {
          vel.w2[k][j] = 0.9 * vel.w2[k][j] - rate * (dz[k] * h[j] + 1e-4 * net.w2[k][j]);
          net.w2[k][j] += vel.w2[k][j];
        }
        vel.b2[k] = 0.9 * vel.b2[k] - rate * dz[k];
        net.b2[k] += vel.b2[k];
      }
      for (let j = 0; j < h.length; j++) {
        for (let i = 0; i < x.length; i++) {
          if (!x[i]) continue;
          vel.w1[j][i] = 0.9 * vel.w1[j][i] - rate * (dh[j] * x[i] + 1e-4 * net.w1[j][i]);
          net.w1[j][i] += vel.w1[j][i];
        }
        vel.b1[j] = 0.9 * vel.b1[j] - rate * dh[j];
        net.b1[j] += vel.b1[j];
      }
    }
  }
  return net;
}

/** The network as small JSON (weights to 4 places). @param {Net} net */
const toJSON = net => JSON.stringify(net, (_, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v));

export { CLASSES, INPUTS, inputOf, predict, toJSON, train, turned };
