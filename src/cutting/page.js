// Cutting guide page.
import './draw.js'; // load order: runs after cutting/draw
import { cgHi, fabHi, lastPlan, setCgHi, setFabHi, setLastPlan } from '../render/hi-state.js';
import { design } from '../core/store.js';
import { $, esc } from '../core/dom.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { fabricById } from '../designer/fabric-library.js';
import {
  BORDER_TYPES,
  blockSizeMm,
  borderFab,
  borderSidePieces,
  borderTotal,
  borderUnits,
  bordersOf,
  centreMm,
  plainButted,
  quiltMm,
  sashOf,
  sashRects,
} from '../core/geometry.js';
import { drawBordersExploded, explodedH } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { CG } from './plan.js';
import {
  cgRedraws,
  cutOpts,
  drawCutBlock,
  drawCutQuilt,
  drawQuiltHi,
  drawSashPic,
  mirroredCount,
  sashPicH,
  swatchCanvas,
} from './draw.js';

// The whole quilt as on the PDF's quilt page: blocks a little apart, each turned as designed,
// every piece labelled with its ID, rows and columns numbered.
// double-clicking a block opens the whole quilt in a pop-up with that block's squares highlighted
function openQuiltPop(P, i) {
  const d = $('cg-pop'),
    b = P.blocks[i];
  $('cg-pop-title').textContent = `Block ${i + 1} · ${b.label}`;
  $('cg-pop-sub').textContent =
    `${b.count} in the quilt, marked in orange · ${design.cols} × ${design.rows} blocks, ${P.quiltW} × ${P.quiltH} mm`;
  if (!d.open) {
    try {
      d.showModal();
    } catch (e) {
      d.setAttribute('open', '');
    }
  }
  const w = Math.min(1000, window.innerWidth - 80),
    h = window.innerHeight - 170;
  drawCutQuilt(P, { cv: $('cg-pop-cv'), w, h });
}
function cgRowHover(div, makeTest) {
  for (const tr of div.querySelectorAll('.cg-list tbody tr')) {
    tr.classList.add('cutrow');
    tr.title = 'Hover to light up these pieces in the pictures';
    tr.addEventListener('mouseenter', () => lightFabric(makeTest(tr), tr));
    tr.addEventListener('mouseleave', () => lightFabric(null));
  }
}
function cgCardBehaviour(div, key, pick, hint) {
  const list = div.querySelector('.cg-list'),
    cv = div.querySelector('canvas');
  div.dataset.key = String(key);
  if (cgOpen.has(key)) {
    div.classList.add('open');
    list.style.maxHeight = 'none';
  }
  const toggle = () => {
    const open = !div.classList.contains('open');
    list.style.maxHeight = list.scrollHeight + 'px'; // from its real height, so the slide is smooth both ways
    if (!open) {
      list.offsetHeight;
      list.style.maxHeight = '0px';
    }
    div.classList.toggle('open', open);
    if (open) {
      cgOpen.add(key);
      list.addEventListener(
        'transitionend',
        () => {
          if (div.classList.contains('open')) list.style.maxHeight = 'none';
        },
        { once: true },
      );
      setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 280);
    } else cgOpen.delete(key);
    cv.setAttribute('aria-expanded', String(open));
  };
  let clickT = 0;
  const onClick = () => {
    clearTimeout(clickT);
    clickT = setTimeout(toggle, 260);
  };
  const onDbl = () => {
    clearTimeout(clickT);
    pick();
  };
  for (const el of [cv, div.querySelector('h3')]) {
    el.addEventListener('click', onClick);
    el.addEventListener('dblclick', onDbl);
  }
  cv.tabIndex = 0;
  cv.setAttribute('role', 'button');
  cv.setAttribute('aria-expanded', String(cgOpen.has(key)));
  cv.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  cv.title = hint;
}
function openPartPop(kind) {
  const d = $('cg-pop'),
    q = quiltMm(design),
    nb = bordersOf(design).length,
    s = sashOf(design);
  const bi = kind[0] === 'b' && kind !== 'brd' ? +kind.slice(1) : -1,
    b = bi >= 0 ? bordersOf(design)[bi] : null;
  $('cg-pop-title').textContent =
    kind === 'sash' ? 'Sashing' : b ? `Border ${bi + 1}` : nb > 1 ? `Borders (${nb})` : 'Border';
  $('cg-pop-sub').textContent =
    kind === 'sash'
      ? `${s.mm} mm strips between the blocks${s.border ? ' and around the outside' : ''}, marked in orange · finished quilt ${q.W} × ${q.H} mm`
      : b
        ? `${BORDER_TYPES[b.type].label}, ${b.mm} mm all round${nb > 1 ? (bi === 0 ? ' · the innermost border' : bi === nb - 1 ? ' · the outermost border' : '') : ''}, marked in orange · finished quilt ${q.W} × ${q.H} mm`
        : `${borderTotal(design)} mm all round, marked in orange · finished quilt ${q.W} × ${q.H} mm`;
  if (!d.open) {
    try {
      d.showModal();
    } catch (e) {
      d.setAttribute('open', '');
    }
  }
  drawQuiltHi($('cg-pop-cv'), Math.min(1000, window.innerWidth - 80), window.innerHeight - 170, kind);
}
const cgOpen = new Set(); // blocks whose cutting list is open          // distinct block picked on the cutting guide (double-click), -1 = none
function renderCut() {
  if (!design) return;
  cgRedraws.length = 0;
  setFabHi(null);
  const sz = sashOf(design),
    qm = quiltMm(design),
    extra = [];
  if (sz.mm) {
    // counted from the drawn sashing, so strips hidden under large blocks are left out
    const sr = sashRects(design, 1000, 1000),
      strips = sr.filter(x => x.kind === 'sash').length,
      corners = sr.filter(x => x.kind === 'corner').length;
    if (strips)
      extra.push({
        group: 'sash',
        what: 'Sashing strips',
        fabric: sz.fabric,
        w: design.blockMm,
        h: sz.mm,
        n: strips,
      });
    if (corners) extra.push({ group: 'sash', what: 'Cornerstones', fabric: sz.corner, w: sz.mm, h: sz.mm, n: corners });
  }
  // borders: every piece of every side, classified into standard cuts (or long strips cut across the width)
  const bs = bordersOf(design),
    cm = centreMm(design);
  let innerW = cm.W,
    innerH = cm.H;
  bs.forEach((b, bi) => {
    const T = b.mm,
      label = `Border ${bi + 1} · ${BORDER_TYPES[b.type].label}`,
      group = 'b' + bi,
      agg = new Map();
    const usable = cutOpts.fabricWidth - cutOpts.selvage;
    if (b.type === 'plain') {
      const butted = plainButted(b),
        lens = butted ? [innerW + 2 * T, innerW + 2 * T, innerH, innerH] : [innerW, innerW, innerH, innerH];
      if (Math.max(...lens) + 2 * cutOpts.seam > usable)
        extra.push({ group, what: label + ' · strips', fabric: borderFab(b, 0), wof: true, w: T, lens });
      else
        for (const L of lens)
          extra.push({ group, what: label + ' · strips', fabric: borderFab(b, 0), w: L, h: T, n: 1 });
      if (!butted) extra.push({ group, what: label + ' · corner squares', fabric: borderFab(b, 1), w: T, h: T, n: 4 });
    } else {
      // units are eased slightly to fit each side; when that is under 8 %, cut them at their standard size
      const u0 = BORDER_TYPES[b.type].unit(T),
        ease = L => {
          const n = borderUnits(b, L);
          return Math.abs(L / n - u0) / u0 < 0.08 ? n * u0 : L;
        };
      for (const L of [innerW, innerH, innerW, innerH])
        for (const pc of borderSidePieces(b, ease(L))) {
          const c = CG.classify(pc.poly, 1, 1, cutOpts.seam),
            fab = borderFab(b, pc.slot),
            k = fab + '|' + c.kind + '|' + c.cut.join('x');
          if (!agg.has(k))
            agg.set(k, { group, what: label, fabric: fab, kind: c.kind, cut: c.cut, yield: c.yield, how: c.how, n: 0 });
          agg.get(k).n++;
        }
      extra.push(...agg.values());
      extra.push({ group, what: label + ' · corner squares', fabric: borderFab(b, 2), w: T, h: T, n: 4 });
    }
    innerW += 2 * T;
    innerH += 2 * T;
  });
  const P = CG.plan(design, {
    blockMm: design.blockMm,
    sizeOf: k => blockSizeMm(design, k),
    seam: cutOpts.seam,
    fabricWidth: cutOpts.fabricWidth,
    selvage: cutOpts.selvage,
    bindingFabric: 'b1',
    bindingWidth: cutOpts.bindingWidth,
    partsOf,
    label: k => PATTERNS[k].label,
    extra,
    quiltW: qm.W,
    quiltH: qm.H,
  });
  setLastPlan(P);
  $('cg-facts').innerHTML = [
    ['Finished quilt', `${P.quiltW} × ${P.quiltH} mm`],
    ['Blocks', `${design.cols} × ${design.rows}`],
    [
      'Block',
      `${P.blockW} × ${P.blockH} mm finished · ${P.blockW + 2 * P.seam} × ${P.blockH + 2 * P.seam} mm with seam allowance`,
    ],
    ['Distinct blocks', P.blocks.length],
  ]
    .map(([k, v]) => `<span>${k}: <b>${v}</b></span>`)
    .join('');
  // fabric table
  const tb = $('cg-fabrics').querySelector('tbody');
  tb.innerHTML = '';
  for (const r of P.fabrics) {
    const fab = fabricById(r.id),
      tr = document.createElement('tr');
    const notes = [];
    if (r.binding) notes.push(`includes binding: ${r.binding.strips} strips ${r.binding.width} mm × WOF`);
    tr.innerHTML = `<td class="sw"></td><td class="letter">${r.letter}<span class="fname">${esc(fab.name)}</span></td>
      <td class="req">${r.requirement}${r.buy ? `<small>buy ≈ ${r.buy}</small>` : ''}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</td>`;
    tr.querySelector('.sw').appendChild(swatchCanvas(fab));
    tb.appendChild(tr);
  }
  const backFab = fabricById(design.backFabric);
  tb.insertAdjacentHTML(
    'beforeend',
    `<tr class="extra backrow"><td class="sw"></td><td class="letter small">Backing<span class="fname">${esc(backFab.name)}</span></td><td class="req">${P.backing.w} × ${P.backing.h} mm<small>${P.backing.widths} width${P.backing.widths > 1 ? 's' : ''} of fabric sewn together · buy ≈ ${P.backing.buy}</small></td></tr>
    <tr class="extra"><td></td><td class="letter small">Batting</td><td class="req">${P.backing.w} × ${P.backing.h} mm</td></tr>`,
  );
  tb.querySelector('.backrow .sw').appendChild(swatchCanvas(backFab));
  // blocks
  const box = $('cg-blocks');
  box.innerHTML = '';
  P.blocks.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'cgblock';
    const rows = b.list
      .map(
        r =>
          `<tr data-l="${r.letter}" data-f="${r.form}"><td class="l">${r.letter}${i + 1}.${r.form}</td><td>${r.how}</td><td class="n">${Math.ceil(r.pieces / r.yield)}</td><td class="n">${Math.ceil((r.pieces * b.count) / r.yield)}</td></tr>`,
      )
      .join('');
    div.innerHTML = `<h3>Block ${i + 1}</h3><p class="meta">${esc(b.label)}${b.span > 1 ? ` · large block, ${b.span} × ${b.span} cells (${b.size} mm)` : ''} · make ${b.count}${mirroredCount(b) ? ` · ${mirroredCount(b)} mirrored (cut their odd-shaped pieces with the template turned over)` : ''}</p><div class="cg-art"><canvas aria-label="Block ${i + 1}: ${esc(b.label)}, pieces labelled with fabric letters"></canvas><span class="cg-hint" aria-hidden="true">Click: cutting list · double-click: see it in the quilt</span></div>
      <div class="cg-list" id="cg-list-${i}"><div class="tablewrap"><table><thead><tr><th>Fabric</th><th>Cut</th><th>Per block</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    box.appendChild(div);
    {
      const bc = div.querySelector('canvas');
      const draw = () => drawCutBlock(bc, b, P, i + 1);
      draw();
      cgRedraws.push(draw);
    }
    const pick = () => {
      setCgHi(i);
      drawCutQuilt(P);
      openQuiltPop(P, i);
    };
    cgCardBehaviour(
      div,
      i,
      pick,
      'Click to show or hide the cutting list · double-click to find this block in the whole quilt',
    );
    cgRowHover(div, tr => {
      const L = tr.dataset.l,
        F = +tr.dataset.f,
        n = i + 1;
      return x => x.t === 'piece' && x.num === n && x.letter === L && x.form === F;
    });
  });
  const sashCuts = (P.sashing || []).filter(x => x.group === 'sash');
  const hint =
    '<span class="cg-hint" aria-hidden="true">Click: cutting list · double-click: see it in the quilt</span>';
  const listOf = (head, rows) =>
    `<div class="cg-list"><div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  if (sashCuts.length) {
    // piece IDs like the blocks' D2.3: fabric letter + S (sashing) . form
    sashCuts.forEach((x, k) => {
      // eslint-disable-next-line no-param-reassign -- the ids go on the plan's pieces, for the PDF too
      x.id = `${x.letter}S.${k + 1}`;
    });
    const sz = sashOf(design),
      div = document.createElement('div');
    div.className = 'cgblock cg-sash';
    const rows = sashCuts
      .map(
        x =>
          `<tr data-k="${x.what === 'Cornerstones' ? 'corner' : 'sash'}"><td class="l">${x.id}</td><td>${x.what}: ${x.how}</td><td class="n">${x.n}</td></tr>`,
      )
      .join('');
    div.innerHTML =
      `<h3>Sashing</h3><p class="meta">${sz.mm} mm wide${sz.border ? ', also around the outside' : ''}</p><div class="cg-art"><canvas aria-label="Part of the quilt showing the sashing, pieces labelled with their IDs"></canvas>${hint}</div>` +
      listOf('<th>ID</th><th>Cut</th><th>Total</th>', rows);
    box.appendChild(div);
    // a 2 × 2 corner of the quilt, to show how strips and cornerstones go together
    const cv = div.querySelector('canvas'),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      S = 300;
    const drawSash = () => {
      const H = sashPicH(S);
      cv.width = S * dpr;
      cv.height = H * dpr;
      cv.style.width = S + 'px';
      cv.style.maxWidth = '100%';
      cv.style.aspectRatio = `${S} / ${H}`;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSashPic(g, S, sashCuts, 1);
    };
    drawSash();
    cgRedraws.push(drawSash);
    cgRowHover(div, tr => {
      const K = tr.dataset.k;
      return x => x.t === 'sash' && x.kind === K;
    });
    cgCardBehaviour(
      div,
      'sash',
      () => {
        setCgHi('sash');
        drawCutQuilt(P);
        openPartPop('sash');
      },
      'Click to show or hide the cutting list · double-click to see the sashing in the whole quilt',
    );
  }
  const brdCuts = (P.sashing || []).filter(x => x.group && x.group[0] === 'b');
  // piece IDs: fabric letter + B<border number> . form, e.g. CB2.1
  {
    const perBorder = new Map();
    for (const x of brdCuts) {
      const n = (perBorder.get(x.group) || 0) + 1;
      perBorder.set(x.group, n);
      x.id = `${x.letter}B${+x.group.slice(1) + 1}.${n}`;
    }
  }
  // one card per border (border 1 is the innermost): the quilt with that border lit and the others faded, and its cutting list
  const bs2 = bordersOf(design);
  bs2.forEach((bd, bi) => {
    const cuts = brdCuts.filter(x => x.group === 'b' + bi);
    if (!cuts.length) return;
    const key = 'b' + bi,
      div = document.createElement('div');
    div.className = 'cgblock cg-sash';
    const rows = cuts
      .map(x => {
        const n = x.wof ? x.n : Math.ceil(x.n / (x.yield || 1));
        return `<tr data-g="${bi}" data-fab="${x.fabric}" data-c="${/corner squares$/.test(x.what) ? 1 : 0}"><td class="l">${x.id}</td><td><b>${esc(x.what.replace(/^Border \d+ · /, ''))}</b><br>${x.how}</td><td class="n">${x.wof ? '—' : n}</td></tr>`;
      })
      .join('');
    const where = bs2.length > 1 ? (bi === 0 ? ' · innermost' : bi === bs2.length - 1 ? ' · outermost' : '') : '';
    div.innerHTML =
      `<h3>Border ${bi + 1}</h3><p class="meta">${BORDER_TYPES[bd.type].label} · ${bd.mm} mm${where}</p><div class="cg-art"><canvas aria-label="The quilt with border ${bi + 1} lit up and its pieces labelled"></canvas>${hint}</div>` +
      `<p class="meta cg-brdleg">Pieces: <b>${cuts.map(x => x.id).join(' · ')}</b></p>` +
      listOf('<th>ID</th><th>Cut</th><th>Total</th>', rows);
    box.appendChild(div);
    const cv = div.querySelector('canvas'),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      S = 300,
      GAP = bs2.length > 1 ? 7 : 0,
      H = explodedH(S, GAP);
    cv.width = S * dpr;
    cv.height = H * dpr;
    cv.style.width = S + 'px';
    cv.style.maxWidth = '100%';
    cv.style.aspectRatio = `${S} / ${H}`;
    // the borders pulled apart (one ring each), this one bright and the rest faded
    const drawB = () => {
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, H);
      drawBordersExploded(g, S, GAP, bs2.length > 1 ? bi : -1);
    };
    drawB();
    cgRedraws.push(drawB);
    cgRowHover(div, tr => {
      const FB = tr.dataset.fab,
        C = tr.dataset.c === '1';
      return x => x.t === 'brd' && x.bi === bi && x.fabric === FB && x.corner === C;
    });
    cgCardBehaviour(
      div,
      key,
      () => {
        setCgHi(key);
        drawCutQuilt(P);
        openPartPop(key);
      },
      `Click to show or hide the cutting list · double-click to see border ${bi + 1} in the whole quilt`,
    );
  });
  if (typeof cgHi === 'number' && cgHi >= P.blocks.length) setCgHi(-1);
  if (
    (cgHi === 'sash' && !sashCuts.length) ||
    (typeof cgHi === 'string' && cgHi[0] === 'b' && !brdCuts.some(x => x.group === cgHi))
  )
    setCgHi(-1);
  drawCutQuilt(P);
  $('cg-note').textContent =
    `WOF = width of fabric: ${cutOpts.fabricWidth / 10} cm, of which ${P.usable / 10} cm is usable after trimming the selvages. Cut sizes include a ${P.seam} mm seam allowance and are rounded up to the whole millimetre. Requirements add 50 mm to straighten the edge; "buy" rounds up to 5 cm.`;
}
// hovering a line of a cutting list lights up those pieces in every picture
function lightFabric(test, tr) {
  if (fabHi === test) return;
  setFabHi(test);
  document.querySelectorAll('#cg-blocks tr.cut-on').forEach(x => x.classList.remove('cut-on'));
  if (tr) tr.classList.add('cut-on');
  for (const f of cgRedraws) f();
  if (lastPlan) drawCutQuilt(lastPlan);
}
function initCutUI() {
  $('cg-seam').addEventListener('change', e => {
    cutOpts.seam = +e.target.value;
    renderCut();
  });
  $('cg-width').addEventListener('change', e => {
    cutOpts.fabricWidth = +e.target.value;
    renderCut();
  });
  $('cg-binding').addEventListener('change', e => {
    cutOpts.bindingWidth = +e.target.value;
    renderCut();
  });
  $('cg-edit').addEventListener('click', () => showPage('design'));
}
initCutUI();
$('cg-pop-x').addEventListener('click', () => $('cg-pop').close());
$('cg-pop').addEventListener('click', e => {
  if (e.target === $('cg-pop')) $('cg-pop').close();
}); // click outside closes
$('cg-pop').addEventListener('close', () => {
  setCgHi(-1);
  if (lastPlan) drawCutQuilt(lastPlan);
});

export { renderCut };
