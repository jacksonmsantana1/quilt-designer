// The colour finder: the round colour button under "More fabrics" beside every fabric list opens a window with a
// colour wheel. Up to three colours are picked on it, each with how much of it the fabric should have, and every
// fabric is ranked by how well its own colours match (core/colour-match.js). A fabric clicked there goes to the
// list the window was opened from, as from the library.
import './fabric-picker.js'; // load order: runs after designer/fabric-picker
import { design } from '../core/store.js';
import { $, sideRoller } from '../core/dom.js';
import { isFabric, listedFabrics } from './fabric-library.js';
import { fabricTile, setColourButton, useFabricIn } from './fabric-picker.js';
import { fabricIdsIn } from '../core/fabric-picks.js';
import { colourMatch, fabricColours, hslToRgb, lab, rgbToHsl, shareAmounts } from '../core/colour-match.js';

const MAX = 3, // colours picked at most
  SHOWN = 60, // fabrics shown, best first
  WEAK = 0.35, // a match below this is shown faded
  SIZE = 220; // the wheel, in px

/** @typedef {{ h: number, s: number, l: number, amount: number }} Pick */
const finder = {
  source: /** @type {HTMLElement | null} */ (null),
  picks: /** @type {Pick[]} */ ([]),
  sel: 0, // the pick the lightness slider changes
  light: 0.5, // the wheel's lightness when nothing is picked
};

// ---- each fabric's main colours, measured once from a small copy of its picture. Photos are kept per device (their
// id is a fingerprint of the photo, so it never changes); the basics are quick to measure again at each start.
const CACHE_KEY = 'quilt-fabric-colours.v1';
/** @type {Map<string, { rgb: number[], share: number }[]>} */
const colours = new Map();
try {
  const kept = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  for (const [id, c] of Object.entries(kept)) if (Array.isArray(c)) colours.set(id, c);
} catch (e) {}
function keepColours() {
  const out = {};
  for (const f of listedFabrics()) if (f.blob && colours.has(f.id)) out[f.id] = colours.get(f.id);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch (e) {}
}

/** @param {import('./fabric-library.js').Fabric} f */
async function measure(f) {
  const N = 48,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  try {
    if (f.blob) {
      const bm = await createImageBitmap(f.blob, { resizeWidth: N, resizeHeight: N, resizeQuality: 'medium' });
      g.drawImage(bm, 0, 0);
      bm.close?.();
    } else {
      const k = Math.min(f.canvas.width, f.canvas.height, 360);
      g.drawImage(f.canvas, 0, 0, k, k, 0, 0, N, N);
    }
    return fabricColours(g.getImageData(0, 0, N, N).data);
  } catch (e) {
    return []; // a picture the browser can't read: no colours, ranked last
  }
}

let measuring = null;
/** Measures the fabrics not measured yet, those in the quilt first, a few at a time; the window redraws as it goes. */
function measureAll() {
  return (measuring ??= (async () => {
    const inQuilt = design ? fabricIdsIn(design, isFabric) : new Set();
    const todo = listedFabrics()
      .filter(f => !colours.has(f.id))
      .sort((a, b) => Number(inQuilt.has(b.id)) - Number(inQuilt.has(a.id)));
    for (let i = 0; i < todo.length; i += 12) {
      for (const f of todo.slice(i, i + 12)) colours.set(f.id, await measure(f));
      if ($('colfind').open) {
        drawQuilt();
        drawResults(true);
      }
      await new Promise(r => setTimeout(r, 0)); // lets the page answer clicks in between
    }
    if (todo.some(f => f.blob)) keepColours();
    measuring = null;
  })());
}

// ---- the window
const pickRgb = p => hslToRgb(p.h, p.s, p.l);
const css = rgb => `rgb(${rgb.join(',')})`;
const lightness = () => finder.picks[finder.sel]?.l ?? finder.light;

/** Opens the finder for one fabric list: a fabric clicked there goes to that list. @param {HTMLElement} box */
function openFinder(box) {
  finder.source = box;
  const dlg = $('colfind');
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  drawAll();
  measureAll();
}

/** The wheel at the chosen lightness: hue around, the plain greys in the middle. */
let wheelAt = -1;
function drawWheel() {
  const l = lightness();
  if (l === wheelAt) return;
  wheelAt = l;
  const cv = /** @type {HTMLCanvasElement} */ ($('colfind-canvas')),
    g = cv.getContext('2d'),
    img = g.createImageData(SIZE, SIZE),
    R = SIZE / 2;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - R,
        dy = y + 0.5 - R,
        r = Math.hypot(dx, dy) / R;
      if (r > 1) continue;
      const [cr, cg, cb] = hslToRgb((Math.atan2(dy, dx) * 180) / Math.PI + 360, r, l),
        i = (y * SIZE + x) * 4;
      img.data[i] = cr;
      img.data[i + 1] = cg;
      img.data[i + 2] = cb;
      img.data[i + 3] = r > 0.985 ? Math.round((1 - r) * 255 * 66) : 255; // a soft edge
    }
  g.putImageData(img, 0, 0);
}

/** The dots on the wheel, one per picked colour. */
function drawDots() {
  const wheel = $('colfind-wheel');
  wheel.querySelectorAll('.colfind-dot').forEach(d => d.remove());
  finder.picks.forEach((p, i) => {
    const d = document.createElement('span'),
      a = (p.h * Math.PI) / 180;
    d.className = 'colfind-dot';
    d.dataset.i = String(i);
    d.style.left = `${50 + Math.cos(a) * p.s * 50}%`;
    d.style.top = `${50 + Math.sin(a) * p.s * 50}%`;
    d.style.background = css(pickRgb(p));
    if (i === finder.sel) d.classList.add('on');
    wheel.append(d);
  });
}

/** The rows under the slider: each colour, how much of it (less ↔ more), and an × to take it away. */
function drawPicks() {
  const box = $('colfind-picks');
  box.innerHTML = '';
  finder.picks.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'colfind-pick';
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'colfind-sw';
    sw.dataset.i = String(i);
    sw.style.background = css(pickRgb(p));
    sw.setAttribute('aria-pressed', String(i === finder.sel));
    sw.setAttribute('aria-label', `Colour ${i + 1}: change its lightness`);
    const amount = document.createElement('input');
    amount.type = 'range';
    amount.min = '5';
    amount.max = '95';
    amount.value = String(p.amount);
    amount.dataset.i = String(i);
    amount.disabled = finder.picks.length === 1; // one colour is all of it
    amount.setAttribute('aria-label', `How much of colour ${i + 1}`);
    const less = document.createElement('small'),
      more = document.createElement('small');
    less.textContent = 'less';
    more.textContent = 'more';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'btn sm colfind-x';
    x.dataset.i = String(i);
    x.textContent = '×';
    x.setAttribute('aria-label', `Take colour ${i + 1} away`);
    row.append(sw, less, amount, more, x);
    box.append(row);
  });
  $('colfind-hint').textContent = finder.picks.length
    ? finder.picks.length < MAX
      ? 'Click the wheel to add another colour; drag a dot to change it.'
      : 'Drag a dot to change its colour.'
    : `Click the wheel to pick a colour (up to ${MAX}).`;
  const slider = /** @type {HTMLInputElement} */ ($('colfind-light'));
  slider.value = String(Math.round(lightness() * 100));
  const p = finder.picks[finder.sel],
    mid = p ? css(hslToRgb(p.h, p.s, 0.5)) : '#888';
  slider.style.background = `linear-gradient(to right, #000, ${mid}, #fff)`;
}

/** "Your quilt": a dot for each colour the quilt's fabrics have most of (near shades once). */
function drawQuilt() {
  const box = $('colfind-quilt'),
    seen = [];
  box.innerHTML = '';
  const ids = design ? [...fabricIdsIn(design, isFabric)] : [];
  for (const id of ids) {
    const main = colours.get(id)?.[0];
    if (!main) continue;
    const L = lab(main.rgb);
    if (seen.some(s => (s[0] - L[0]) ** 2 + (s[1] - L[1]) ** 2 + (s[2] - L[2]) ** 2 < 100)) continue;
    seen.push(L);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'colfind-sw';
    b.dataset.rgb = main.rgb.join(',');
    b.style.background = css(main.rgb);
    b.setAttribute('aria-label', 'Use this colour from your quilt');
    box.append(b);
    if (seen.length >= 8) break;
  }
  $('colfind-quilt-box').hidden = !seen.length;
}

/** The fabrics, best match first, each with a small bar of its own colours. @param {boolean} [keepScroll] */
function drawResults(keepScroll = false) {
  const box = $('colfind-results'),
    status = $('colfind-status');
  const left = box.scrollLeft;
  box.innerHTML = '';
  const all = listedFabrics(),
    known = all.filter(f => colours.has(f.id));
  const reading = known.length < all.length ? `Reading the fabrics' colours… ${known.length} of ${all.length}` : '';
  if (!finder.picks.length) {
    status.textContent = reading;
    return;
  }
  const wanted = finder.picks.map(p => ({ rgb: pickRgb(p), amount: p.amount }));
  const ranked = known
    .map(f => ({ f, score: colourMatch(wanted, colours.get(f.id)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SHOWN);
  status.textContent = reading || 'Best match first: click one to use it.';
  for (const { f, score } of ranked) {
    const t = fabricTile(f, false),
      bar = document.createElement('i');
    bar.className = 'colfind-bar';
    for (const c of colours.get(f.id)) {
      const s = document.createElement('i');
      s.style.background = css(c.rgb);
      s.style.flexGrow = String(c.share);
      bar.append(s);
    }
    t.insertBefore(bar, t.querySelector('span'));
    if (score < WEAK) t.classList.add('weak');
    box.append(t);
  }
  box.scrollLeft = keepScroll ? left : 0;
  sideRoller(box, '.fab[aria-pressed="true"]');
}

function drawAll() {
  drawWheel();
  drawDots();
  drawPicks();
  drawQuilt();
  drawResults();
}
let soon = 0;
/** Redraws the fabrics a moment after the last change (dragging a dot changes the colour many times a second). */
const resultsSoon = () => {
  clearTimeout(soon);
  soon = setTimeout(() => drawResults(), 120);
};

/** Adds a colour (or, with three already, changes the chosen one). @param {{ h: number, s: number, l: number }} c */
function addPick(c) {
  if (finder.picks.length >= MAX) {
    Object.assign(finder.picks[finder.sel], c);
  } else {
    const n = finder.picks.length + 1,
      amounts = [...finder.picks.map(p => p.amount), Math.round(100 / n)];
    finder.picks.push({ ...c, amount: 0 });
    shareAmounts(amounts, n - 1).forEach((a, i) => (finder.picks[i].amount = a));
    finder.sel = n - 1;
  }
  drawAll();
}

/** Where on the wheel the pointer is, as hue and saturation (outside the wheel: its edge). @param {PointerEvent} e */
function wheelColour(e) {
  const r = $('colfind-canvas').getBoundingClientRect(),
    dx = e.clientX - (r.left + r.width / 2),
    dy = e.clientY - (r.top + r.height / 2);
  return {
    h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
    s: Math.min(1, Math.hypot(dx, dy) / (r.width / 2)),
  };
}

function initFinder() {
  const dlg = $('colfind');
  $('colfind-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => (finder.source = null));
  dlg.addEventListener('click', e => {
    // a click on the backdrop, outside the box, closes it
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });

  // the wheel: a click adds a colour, a dot dragged changes it
  const wheel = $('colfind-wheel');
  let dragging = -1;
  wheel.addEventListener('pointerdown', e => {
    const dot = /** @type {HTMLElement} */ (e.target).closest('.colfind-dot');
    if (dot) {
      dragging = finder.sel = Number(dot.dataset.i);
    } else {
      const { h, s } = wheelColour(e);
      if (s >= 1.04) return;
      addPick({ h, s, l: lightness() });
      dragging = finder.sel;
    }
    wheel.setPointerCapture(e.pointerId);
    drawAll();
    e.preventDefault();
  });
  wheel.addEventListener('pointermove', e => {
    if (dragging < 0 || !finder.picks[dragging]) return;
    Object.assign(finder.picks[dragging], wheelColour(e));
    drawDots();
    drawPicks();
    resultsSoon();
  });
  const stop = () => {
    if (dragging < 0) return;
    dragging = -1;
    drawResults();
  };
  wheel.addEventListener('pointerup', stop);
  wheel.addEventListener('pointercancel', stop);

  $('colfind-light').addEventListener('input', e => {
    const l = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100,
      p = finder.picks[finder.sel];
    if (p) p.l = l;
    else finder.light = l;
    drawWheel();
    drawDots();
    drawPicks();
    resultsSoon();
  });

  const picks = $('colfind-picks');
  picks.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.classList.contains('colfind-x')) {
      finder.picks.splice(i, 1);
      shareAmounts(
        finder.picks.map(p => p.amount),
        -1,
      ).forEach((a, j) => (finder.picks[j].amount = a));
      finder.sel = Math.max(0, Math.min(finder.sel, finder.picks.length - 1));
    } else finder.sel = i;
    drawAll();
  });
  picks.addEventListener('input', e => {
    const t = /** @type {HTMLInputElement} */ (e.target),
      i = Number(t.dataset.i);
    const amounts = finder.picks.map((p, j) => (j === i ? Number(t.value) : p.amount));
    shareAmounts(amounts, i).forEach((a, j) => (finder.picks[j].amount = a));
    // the other sliders follow (this one stays under the finger)
    for (const [j, s] of picks.querySelectorAll('input').entries())
      if (j !== i) s.value = String(finder.picks[j].amount);
    resultsSoon();
  });

  $('colfind-quilt').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button');
    if (b?.dataset.rgb) addPick(rgbToHsl(b.dataset.rgb.split(',').map(Number)));
  });

  $('colfind-results').addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('button.fab');
    const box = finder.source;
    if (!b?.dataset.f || !box) return;
    dlg.close();
    useFabricIn(box, b.dataset.f);
  });

  // the round button under "More fabrics" beside every fabric list
  setColourButton(box => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fab-more-btn';
    if (box.id) b.id = box.id + '-colour';
    b.title = 'Find fabrics by colour';
    b.setAttribute('aria-label', 'Find fabrics by colour');
    const ico = document.createElement('i');
    ico.className = 'colwheel-ico';
    ico.setAttribute('aria-hidden', 'true');
    b.append(ico);
    b.addEventListener('click', () => openFinder(box));
    return b;
  });
}
initFinder();

export { openFinder };
