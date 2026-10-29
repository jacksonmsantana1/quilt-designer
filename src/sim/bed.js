// Bed and table choice, overhang readout and quilt-size suggestions.
import './design-maps.js'; // load order: runs after sim/design-maps
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { BEDS, BED_KEY, bedM, bedName, bedState, isTableSim, quilt } from './config.js';
import { send } from './worker-link.js';
import { buildBedMeshes, colliderMeshes } from './stage.js';
import { placeCamera, target } from './camera.js';
import { MAT, analysis, buildBedExtras, setEngineering } from './analysis.js';
import { restart, syncDropUI } from './controls.js';
import { borderTotal, sashOf } from '../core/geometry.js';
import { dispatch, resizeTo } from '../designer/dispatch.js';
import { setBlockMm } from '../core/edits.js';

// Change the quilt's size: canvases take its proportions (long side 2048 / 1024 px),
// textures are recreated at the new size, and the physics rebuilds the cloth.
function updateIntro() {
  $('intro').textContent =
    `A ${quilt.w.toFixed(2)} × ${quilt.l.toFixed(2)} m quilt meeting a ${bedName()} (${isTableSim() ? `${bedState.w} × ${bedState.l} mm top, ${bedState.h} mm high` : `${bedState.w} × ${bedState.l} mm mattress`}). Every motion comes from the physics: gravity, fabric elasticity and bending, air drag, and Coulomb friction, in SI units.`;
}
function saveBed() {
  try {
    localStorage.setItem(BED_KEY, JSON.stringify(bedState));
  } catch (e) {}
}
// how the current quilt hangs on the chosen bed (lying as the simulation lays it: head edge 7 cm from the head)
function overhang() {
  const W = quilt.w * 1000,
    L = quilt.l * 1000;
  if (isTableSim()) return { side: Math.round((W - bedState.w) / 2), foot: Math.round((L - bedState.l) / 2) };
  return { side: Math.round((W - bedState.w) / 2), foot: Math.round(L - 70 - bedState.l) };
}
function updateFitReadout() {
  const o = overhang(),
    say = v => (v >= 0 ? `${v} mm` : `${-v} mm short`);
  const t = isTableSim()
    ? `Quilt ${Math.round(quilt.w * 1000)} × ${Math.round(quilt.l * 1000)} mm on a ${bedState.w} × ${bedState.l} mm table, ${bedState.h} mm high: hangs ${say(o.side)} over each side and ${say(o.foot)} over each end.`
    : `Quilt ${Math.round(quilt.w * 1000)} × ${Math.round(quilt.l * 1000)} mm on a ${bedState.w} × ${bedState.l} mm mattress: hangs ${say(o.side)} over each side and ${say(o.foot)} past the foot.`;
  if ($('bed-fit')) $('bed-fit').textContent = t;
  if ($('fit-now')) $('fit-now').textContent = 'In the simulation now: ' + t.charAt(0).toLowerCase() + t.slice(1);
}
function setBed(key, w, l, h) {
  const b = BEDS.find(x => x.key === key);
  bedState.key = b ? key : key === 'custom-table' ? 'custom-table' : 'custom';
  bedState.kind = b ? b.kind || 'bed' : key === 'custom-table' ? 'table' : 'bed';
  bedState.w = b ? b.w : Math.round(w);
  bedState.l = b ? b.l : Math.round(l);
  if (b && b.h) bedState.h = b.h;
  else if (h) bedState.h = Math.round(h);
  saveBed();
  syncBedUI();
  buildBedMeshes();
  buildBedExtras();
  shared.colliders = ClothSim.bedColliders(bedM());
  MAT.top = ClothSim.surfaceTop(bedM());
  MAT.headFace = isTableSim() ? -bedM().l / 2 : -bedM().l / 2 - 0.055;
  const pil = $('pillows').checked;
  if (colliderMeshes.pillowL) {
    colliderMeshes.pillowL.visible = pil;
    colliderMeshes.pillowR.visible = pil && !colliderMeshes.pillowR.userData.dup;
  }
  if ($('pillows').closest('label')) $('pillows').closest('label').hidden = isTableSim();
  target.y = isTableSim() ? Math.max(0.3, bedM().h - 0.1) : 0.5;
  placeCamera();
  if (analysis.on) setEngineering(true);
  send({ type: 'dims', width: quilt.w, length: quilt.l, bed: bedM() });
  send({ type: 'pillows', value: pil });
  updateIntro();
  updateFitReadout();
  renderFitSuggestions();
  shared.dropPos = null;
  syncDropUI();
  restart(); // drop the quilt again on the new bed (leaves the photo render if it was on)
}
function syncBedUI() {
  const known = BEDS.some(b => b.key === bedState.key),
    ck = isTableSim() ? 'custom-table' : 'custom';
  for (const id of ['bedsel', 'fit-bed']) {
    const s = $(id);
    if (s) s.value = known ? bedState.key : id === 'fit-bed' ? 'custom' : ck;
  }
  for (const id of ['bed-custom', 'fit-custom']) if ($(id)) $(id).hidden = known || isTableSim();
  if ($('table-custom')) {
    $('table-custom').hidden = known || !isTableSim();
    $('tbl-w').value = bedState.w;
    $('tbl-l').value = bedState.l;
    $('tbl-h').value = bedState.h;
  }
  for (const [w, l] of [
    ['bed-w', 'bed-l'],
    ['fit-w', 'fit-l'],
  ])
    if ($(w)) {
      $(w).value = bedState.w;
      $(l).value = bedState.l;
    }
  if ($('fit-drop')) $('fit-drop').value = bedState.drop;
  if ($('fit-tuck')) $('fit-tuck').checked = bedState.tuck;
}
function fillBedSelect(sel, withTables = true) {
  sel.innerHTML = '';
  for (const g of withTables ? ['Brazil', 'United States', 'Tables'] : ['Brazil', 'United States']) {
    const og = document.createElement('optgroup');
    og.label = g === 'Tables' ? 'Tables' : `Beds · ${g}`;
    for (const b of BEDS.filter(x => x.group === g))
      og.appendChild(
        new Option(`${b.label} · ${b.w} × ${b.l} mm${b.kind === 'table' ? ` · ${b.h} mm high` : ''}`, b.key),
      );
    sel.appendChild(og);
  }
  sel.appendChild(new Option('Custom bed size…', 'custom'));
  if (withTables) sel.appendChild(new Option('Custom table…', 'custom-table'));
}
// Target quilt size for the bed: mattress + drop on both sides and at the foot (+ 250 mm pillow tuck).
const TUCK = 250;
function fitTarget() {
  return { W: bedState.w + 2 * bedState.drop, L: bedState.l + bedState.drop + (bedState.tuck ? TUCK : 0) };
}
// Layout options that come closest to the target: the current block size first, then common block sizes.
function fitOptions() {
  const T = fitTarget(),
    out = [],
    seen = new Set(),
    sz = shared.design ? sashOf(shared.design) : { mm: 0, border: false },
    S = sz.mm,
    e = sz.border ? 2 : 0;
  const BT = shared.design ? 2 * borderTotal(shared.design) : 0;
  const size = (c, r, B) => ({ W: c * B + S * (c - 1 + e) + BT, L: r * B + S * (r - 1 + e) + BT }); // includes the sashing and borders
  const sizes = [shared.design ? shared.design.blockMm : 400, 250, 300, 305, 350, 400, 450, 457, 500, 550, 600];
  for (const B of sizes) {
    const p = B + S;
    for (const c of [Math.floor((T.W - BT - S * (e - 1)) / p), Math.ceil((T.W - BT - S * (e - 1)) / p)])
      for (const r of [Math.floor((T.L - BT - S * (e - 1)) / p), Math.ceil((T.L - BT - S * (e - 1)) / p)]) {
        if (c < 1 || r < 1 || c > 20 || r > 20) continue;
        const k = `${B}|${c}|${r}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const { W, L } = size(c, r, B),
          err = Math.abs(W - T.W) + Math.abs(L - T.L) + (W < bedState.w ? 1e6 : 0);
        out.push({ B, c, r, W, L, err, current: shared.design && B === shared.design.blockMm });
      }
  }
  out.sort((a, b) => a.err - b.err);
  const cur = out.find(o => o.current),
    list = [];
  if (cur) list.push(cur);
  for (const o of out) {
    if (list.length >= 4) break;
    if (!list.includes(o) && !list.some(x => x.B === o.B)) list.push(o);
  }
  // exact fit: change the block size so the columns match the width exactly
  if (shared.design) {
    const c = Math.max(1, Math.round((T.W - BT - S * (e - 1)) / (shared.design.blockMm + S))),
      B = Math.max(50, Math.round((T.W - BT - S * (c - 1 + e)) / c / 5) * 5),
      r = Math.max(1, Math.round((T.L - BT - S * (e - 1)) / (B + S)));
    if (!list.some(o => o.B === B && o.c === c && o.r === r))
      list.push({ B, c, r, ...size(c, r, B), err: 0, exact: true });
  }
  return list;
}
function renderFitSuggestions() {
  const box = $('fit-list');
  if (!box || !shared.design) return;
  const T = fitTarget();
  $('fit-target').textContent =
    `Target quilt: ${T.W} × ${T.L} mm (mattress ${bedState.w} × ${bedState.l} + ${bedState.drop} mm drop each side and at the foot${bedState.tuck ? ` + ${TUCK} mm pillow tuck` : ''}).`;
  box.innerHTML = '';
  for (const o of fitOptions()) {
    const side = Math.round((o.W - bedState.w) / 2),
      foot = o.L - bedState.l - (bedState.tuck ? TUCK : 0);
    const isNow = shared.design.cols === o.c && shared.design.rows === o.r && shared.design.blockMm === o.B;
    const row = document.createElement('div');
    row.className = 'fitopt';
    row.innerHTML = `<div><b>${o.c} × ${o.r} blocks of ${o.B} mm</b>${o.current ? ' <span class="tag">your block size</span>' : ''}${o.exact ? ' <span class="tag">resized blocks</span>' : ''}
      <small>${o.W} × ${o.L} mm · drop ${side} mm at the sides, ${foot} mm at the foot</small></div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm' + (isNow ? '' : ' primary');
    btn.textContent = isNow ? 'In use' : 'Use';
    btn.disabled = isNow;
    btn.addEventListener('click', () => {
      dispatch(setBlockMm, o.B);
      resizeTo(o.c, o.r);
      renderFitSuggestions();
    });
    row.appendChild(btn);
    box.appendChild(row);
  }
}
function initBedUI() {
  fillBedSelect($('bedsel'));
  fillBedSelect($('fit-bed'), false);
  const onSel = e => {
    if (e.target.value === 'custom') {
      if (isTableSim()) setBed('custom', 1525, 2030);
      else {
        bedState.key = 'custom';
        syncBedUI();
      }
      return;
    }
    if (e.target.value === 'custom-table') {
      setBed('custom-table', isTableSim() ? bedState.w : 900, isTableSim() ? bedState.l : 1600, bedState.h || 750);
      return;
    }
    setBed(e.target.value);
  };
  const onTable = () => {
    const w = +$('tbl-w').value,
      l = +$('tbl-l').value,
      h = +$('tbl-h').value;
    if (w >= 300 && w <= 3000 && l >= 300 && l <= 4000 && h >= 300 && h <= 1200) setBed('custom-table', w, l, h);
    else syncBedUI();
  };
  for (const id of ['tbl-w', 'tbl-l', 'tbl-h']) $(id).addEventListener('change', onTable);
  $('bedsel').addEventListener('change', onSel);
  $('fit-bed').addEventListener('change', onSel);
  const onCustom = (wi, li) => () => {
    const w = +$(wi).value,
      l = +$(li).value;
    if (w >= 500 && w <= 3000 && l >= 1000 && l <= 3000) setBed('custom', w, l);
  };
  for (const [w, l] of [
    ['bed-w', 'bed-l'],
    ['fit-w', 'fit-l'],
  ]) {
    $(w).addEventListener('change', onCustom(w, l));
    $(l).addEventListener('change', onCustom(w, l));
  }
  $('fit-drop').addEventListener('change', e => {
    const v = Math.round(+e.target.value);
    if (v >= 0 && v <= 800) {
      bedState.drop = v;
      saveBed();
      renderFitSuggestions();
    } else e.target.value = bedState.drop;
  });
  $('fit-tuck').addEventListener('change', e => {
    bedState.tuck = e.target.checked;
    saveBed();
    renderFitSuggestions();
  });
  syncBedUI();
  updateIntro();
  updateFitReadout();
}

export { initBedUI, renderFitSuggestions, updateFitReadout, updateIntro };
