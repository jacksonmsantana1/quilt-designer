// Frames and statistics coming back from the physics worker.
import './view.js';          // load order: runs after sim/view
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from './config.js';
import { simPos } from './quilt-mesh.js';
import { analysisOnStats } from './analysis.js';
import { setView } from './view.js';

// ------------------------------------------------------------- messages
let handsData = []; shared.newFrame = false;
function onSim(e) {
  const m = e.data;
  if (m.type !== 'frame') return;
  if (state.view === 'render') return;          // the render holds the captured shape
  simPos.set(m.pos); shared.havePos = true; handsData = m.hands;
  shared.newFrame = true;
  if (m.stats) updateStats(m.stats);
}

const fmtJ = v => (Math.abs(v) < 0.1 ? (v * 1000).toFixed(1) + ' mJ' : v.toFixed(2) + ' J');
function updateStats(s) {
  state.lastStats = s;
  $('clock').textContent = `t = ${s.t.toFixed(2)} s`;
  const pill = $('state');
  let cls = 'fall', txt = 'Falling';
  if (!s.running) { cls = ''; txt = 'Paused'; }
  else if (s.held) { cls = 'held'; txt = 'Held by hands'; }
  else if (s.restAt !== null) { cls = 'rest'; txt = `At rest · ${s.restAt.toFixed(1)} s`; }
  else if (s.contact > 0.04) { cls = 'settle'; txt = 'Settling'; }
  pill.className = 'pill ' + cls; pill.textContent = txt;
  const slow = $('slow');
  if (s.running && s.speed < 0.93 && state.view !== 'render') { slow.hidden = false; slow.textContent = `running at ${(s.speed).toFixed(2)}× speed`; }
  else slow.hidden = true;
  $('hint').hidden = (s.running && s.speed < 0.93) || state.view !== 'photo';
  $('m-ke').textContent = fmtJ(s.ke);
  $('m-pe').textContent = fmtJ(s.pe);
  $('m-el').textContent = fmtJ(s.stretch + s.bend);
  $('m-dis').textContent = s.dissipated === null ? 'held' : fmtJ(s.dissipated);
  $('m-vy').textContent = s.vy.toFixed(3) + ' m/s';
  $('m-st').textContent = (s.maxStrain * 100).toFixed(2) + ' %';
  $('m-ct').textContent = (s.contact * 100).toFixed(0) + ' %';
  $('m-mass').textContent = s.mass.toFixed(2) + ' kg';
  $('m-bl').textContent = (s.bendLen * 100).toFixed(1) + ' cm';
  const P = state.params;
  $('m-vt').textContent = P.Cd > 0 ? Math.sqrt(2 * P.rhoA * 9.81 / (1.204 * P.Cd)).toFixed(2) + ' m/s' : 'none (no air)';
  $('m-ms').textContent = s.stepMs.toFixed(1) + ' ms';
  analysisOnStats(s);
  if (s.restAt !== null && !state.autoDone && s.running && state.view === 'photo' && state.atRest !== 'none' && state.page === 'sim') {
    state.autoDone = true;
    setView(state.atRest);
  }
  if (s.running) {
    const H = state.history;
    if (H.length && s.t < H[H.length - 1].t) H.length = 0;
    H.push({ t: s.t, ke: s.ke, el: s.stretch + s.bend, dis: s.dissipated });
    while (H.length && H[0].t < s.t - 10) H.shift();
    drawChart();
  }
}

const chart = $('chart');
function drawChart() {
  const H = state.history;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = chart.clientWidth, h = chart.clientHeight;
  if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
  const g = chart.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement);
  const col = k => cs.getPropertyValue(k).trim();
  const padL = 38, padB = 16, padT = 6, pw = w - padL - 4, ph = h - padB - padT;
  let ymax = 0.05;
  for (const p of H) ymax = Math.max(ymax, p.ke, p.el * 10, p.dis || 0);
  const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  ymax = nice.find(v => v >= ymax) || ymax;
  const t1 = H.length ? Math.max(10, H[H.length - 1].t) : 10, t0 = t1 - 10;
  const X = t => padL + (t - t0) / 10 * pw, Y = v => padT + ph - v / ymax * ph;
  g.strokeStyle = col('--line'); g.lineWidth = 1; g.fillStyle = col('--muted');
  g.font = `11px ${col('--font-data')}`; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let k = 0; k <= 2; k++) {
    const v = ymax * k / 2, y = Y(v);
    g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke();
    g.fillText(v + ' J', padL - 4, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let t = Math.floor(t0 / 2) * 2 + 2; t <= t1; t += 2) g.fillText(t + ' s', X(t), padT + ph + 3);
  const line = (key, color, mul = 1, dash = []) => {
    g.strokeStyle = color; g.lineWidth = 1.8; g.setLineDash(dash); g.beginPath();
    let started = false;
    for (const p of H) {
      const v = p[key]; if (v === null || v === undefined) { started = false; continue; }
      const x = X(p.t), y = Y(Math.min(ymax, v * mul));
      started ? g.lineTo(x, y) : g.moveTo(x, y); started = true;
    }
    g.stroke(); g.setLineDash([]);
  };
  line('dis', col('--muted'), 1, [4, 3]);
  line('el', col('--madder'), 10);
  line('ke', col('--accent'));
}

export { handsData, onSim };
