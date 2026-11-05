// Cutting guide page.
import './draw.js'; // load order: runs after cutting/draw
import { cgHi, fabHi, lastPlan, setCgHi, setFabHi, setLastPlan } from '../render/hi-state.js';
import { design } from '../core/store.js';
import { $, esc } from '../core/dom.js';
import { dims, getUnit, len, sharesOf } from '../core/units.js';
import { comma, t, tn } from '@quilt/shared/i18n.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { fabricById } from '../designer/fabric-library.js';
import {
  BORDER_TYPES,
  blockSizeMm,
  borderFab,
  borderSidePieces,
  borderTotal,
  borderUnits,
  bordersOf,
  cellCount,
  centreMm,
  isOnPoint,
  plainButted,
  quiltMm,
  sashOf,
  sashRects,
} from '@quilt/shared/geometry.js';
import { drawBordersExploded, explodedH } from '../render/quilt-draw.js';
import { showPage } from '../app/pages.js';
import { CG } from './plan.js';
import { SHAPE_NAMES, mosaicMm, mosaicTiles } from '@quilt/shared/mosaic.js';
import {
  SASH_WHAT,
  cgRedraws,
  cutOpts,
  drawCutBlock,
  drawCutQuilt,
  drawQuiltHi,
  drawSashPic,
  drawSettingPic,
  mirroredCount,
  sashPicH,
  settingPicH,
  swatchCanvas,
} from './draw.js';

// The whole quilt as on the PDF's quilt page: blocks a little apart, each turned as designed,
// every piece labelled with its ID, rows and columns numbered.
// double-clicking a block opens the whole quilt in a pop-up with that block's squares highlighted
function openQuiltPop(P, i) {
  const d = $('cg-pop'),
    b = P.blocks[i];
  $('cg-pop-title').textContent = b.corner ? b.label : t('Block {n} · {label}', { n: i + 1, label: b.label });
  $('cg-pop-sub').textContent = t('{count} in the quilt, marked in orange · {cols} × {rows} blocks, {size}', {
    count: b.count,
    cols: design.cols,
    rows: design.rows,
    size: dims([P.quiltW, P.quiltH]),
  });
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
    tr.title = t('Hover to light up these pieces in the pictures');
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
    kind === 'sash'
      ? t('Sashing')
      : kind === 'setting'
        ? t('Setting triangles')
        : b
          ? t('Border {n}', { n: bi + 1 })
          : nb > 1
            ? t('Borders ({n})', { n: nb })
            : t('Border');
  const finished = dims([q.W, q.H]);
  $('cg-pop-sub').textContent =
    kind === 'setting'
      ? t('The triangles that fill the edges of the quilt on point, marked in orange · finished quilt {finished}', {
          finished,
        })
      : kind === 'sash'
        ? s.border
          ? t('{size} strips between the blocks and around the outside, marked in orange · finished quilt {finished}', {
              size: len(s.mm),
              finished,
            })
          : t('{size} strips between the blocks, marked in orange · finished quilt {finished}', {
              size: len(s.mm),
              finished,
            })
        : b
          ? t('{type}, {size} all round{where}, marked in orange · finished quilt {finished}', {
              type: BORDER_TYPES[b.type].label,
              size: len(b.mm),
              where:
                nb > 1 && bi === 0
                  ? ` · ${t('the innermost border')}`
                  : nb > 1 && bi === nb - 1
                    ? ` · ${t('the outermost border')}`
                    : '',
              finished,
            })
          : t('{size} all round, marked in orange · finished quilt {finished}', {
              size: len(borderTotal(design)),
              finished,
            });
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
  // a mosaic: its shapes are one card of their own, and the whole quilt with every piece labelled is that card
  document.querySelector('#page-cut .cg-quilt').hidden = !!design.mosaic;
  cgRedraws.length = 0;
  setFabHi(null);
  const sz = sashOf(design),
    qm = quiltMm(design),
    extra = [],
    extraBlocks = [];
  if (sz.mm) {
    // counted from the drawn sashing (in mm), so strips hidden under large blocks are left out
    const sr = sashRects(design, qm.W, qm.H),
      strips = sr.filter(x => x.kind === 'sash').length,
      corners = sr.filter(x => x.kind === 'corner').length,
      lens = sr.filter(x => x.kind === 'long').map(x => Math.round(Math.max(x.w, x.h)));
    if (strips)
      extra.push({
        group: 'sash',
        what: SASH_WHAT.sash,
        fabric: sz.fabric,
        w: design.blockMm,
        h: sz.mm,
        n: strips,
      });
    // without cornerstones: the strips between rows run the full width, longer than the fabric is wide
    // (cut across the width and joined, like long border strips) unless they all fit across it
    if (lens.length) {
      const usable = cutOpts.fabricWidth - cutOpts.selvage;
      if (Math.max(...lens) + 2 * cutOpts.seam > usable)
        extra.push({ group: 'sash', what: SASH_WHAT.long, fabric: sz.fabric, wof: true, w: sz.mm, lens });
      else
        for (const L of new Set(lens))
          extra.push({
            group: 'sash',
            what: SASH_WHAT.long,
            fabric: sz.fabric,
            w: L,
            h: sz.mm,
            n: lens.filter(l => l === L).length,
          });
    }
    // pieced cornerstones are cut like blocks (a card of their own, below); plain ones are squares
    if (corners && sz.cornerBlock)
      extraBlocks.push({
        block: sz.cornerBlock,
        count: corners,
        size: sz.mm,
        label: t('Cornerstone · {label}', { label: PATTERNS[sz.cornerBlock.pattern].label }),
      });
    else if (corners)
      extra.push({ group: 'sash', what: SASH_WHAT.corner, fabric: sz.corner, w: sz.mm, h: sz.mm, n: corners });
  }
  // borders: every piece of every side, classified into standard cuts (or long strips cut across the width)
  const bs = bordersOf(design),
    cm = centreMm(design);
  let innerW = cm.W,
    innerH = cm.H;
  bs.forEach((b, bi) => {
    const T = b.mm,
      type = BORDER_TYPES[b.type].label,
      label = t('Border {n} · {type}', { n: bi + 1, type }),
      group = 'b' + bi,
      agg = new Map();
    // what: the name with its border, for the first PDF page; part: without it, for the border's own card and page
    const strips = { what: t('{label} · strips', { label }), part: t('{label} · strips', { label: type }) },
      cornerSquares = {
        what: t('{label} · corner squares', { label }),
        part: t('{label} · corner squares', { label: type }),
        cornerSquares: true,
      };
    const usable = cutOpts.fabricWidth - cutOpts.selvage;
    if (b.type === 'plain') {
      const butted = plainButted(b),
        lens = butted ? [innerW + 2 * T, innerW + 2 * T, innerH, innerH] : [innerW, innerW, innerH, innerH];
      if (Math.max(...lens) + 2 * cutOpts.seam > usable)
        extra.push({ group, ...strips, fabric: borderFab(b, 0), wof: true, w: T, lens });
      else for (const L of lens) extra.push({ group, ...strips, fabric: borderFab(b, 0), w: L, h: T, n: 1 });
      if (!butted) extra.push({ group, ...cornerSquares, fabric: borderFab(b, 1), w: T, h: T, n: 4 });
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
            agg.set(k, {
              group,
              what: label,
              part: type,
              fabric: fab,
              kind: c.kind,
              cut: c.cut,
              yield: c.yield,
              how: c.how,
              n: 0,
            });
          agg.get(k).n++;
        }
      extra.push(...agg.values());
      extra.push({ group, ...cornerSquares, fabric: borderFab(b, 2), w: T, h: T, n: 4 });
    }
    innerW += 2 * T;
    innerH += 2 * T;
  });
  // on point: the triangles along the edges, cut from squares like half- and quarter-square triangles
  if (isOnPoint(design)) extra.push(...CG.settingExtra(design, cutOpts.seam));
  const mos = design.mosaic ? mosaicForPlan(design) : null;
  const P = CG.plan(design, {
    blockMm: mos ? mos.size : design.blockMm,
    mosaic: mos,
    sizeOf: k => blockSizeMm(design, k),
    seam: cutOpts.seam,
    fabricWidth: cutOpts.fabricWidth,
    selvage: cutOpts.selvage,
    bindingFabric: 'b1',
    bindingWidth: cutOpts.bindingWidth,
    partsOf,
    label: k => PATTERNS[k].label,
    extra,
    extraBlocks,
    quiltW: Math.round(qm.W), // (on point the size is not a whole number of mm)
    quiltH: Math.round(qm.H),
  });
  setLastPlan(P);
  $('cg-facts').innerHTML = (
    mos
      ? [
          [t('Finished quilt'), dims([P.quiltW, P.quiltH])],
          [
            t('Mosaic'),
            t('{count} {shapes}, {size} sides', {
              count: design.mosaic.fabrics.length,
              shapes: SHAPE_NAMES[design.mosaic.shape][1],
              size: len(design.mosaic.mm),
            }),
          ],
        ]
      : [
          [t('Finished quilt'), dims([P.quiltW, P.quiltH])],
          [
            t('Blocks'),
            isOnPoint(design)
              ? t('{cols} × {rows} on point ({all} in all)', {
                  cols: design.cols,
                  rows: design.rows,
                  all: cellCount(design),
                })
              : `${design.cols} × ${design.rows}`,
          ],
          [
            t('Block'),
            t('{finished} finished · {cut} with seam allowance', {
              finished: dims([P.blockW, P.blockH]),
              cut: dims([P.blockW + 2 * P.seam, P.blockH + 2 * P.seam]),
            }),
          ],
          [t('Distinct blocks'), P.blocks.filter(b => !b.corner).length],
        ]
  )
    .map(([k, v]) => `<span>${k}: <b>${v}</b></span>`)
    .join('');
  // fabric table
  const tb = $('cg-fabrics').querySelector('tbody');
  tb.innerHTML = '';
  for (const r of P.fabrics) {
    const fab = fabricById(r.id),
      tr = document.createElement('tr');
    const notes = [];
    if (r.binding)
      notes.push(
        t('includes binding: {strips} strips {width} × WOF', { strips: r.binding.strips, width: len(r.binding.width) }),
      );
    tr.innerHTML = `<td class="sw"></td><td class="letter">${r.letter}<span class="fname">${esc(fab.name)}</span></td>
      <td class="req">${r.requirement}${r.buy ? `<small>${t('buy ≈ {buy}', { buy: r.buy })}</small>` : `<small>${t('a small piece: a remnant will do')}</small>`}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</td>`;
    tr.querySelector('.sw').appendChild(swatchCanvas(fab));
    tb.appendChild(tr);
  }
  const backFab = fabricById(design.backFabric);
  tb.insertAdjacentHTML(
    'beforeend',
    `<tr class="extra backrow"><td class="sw"></td><td class="letter small">${t('Backing')}<span class="fname">${esc(backFab.name)}</span></td><td class="req">${dims([P.backing.w, P.backing.h])}<small>${tn(P.backing.widths, '{n} width of fabric sewn together · buy ≈ {buy}', '{n} widths of fabric sewn together · buy ≈ {buy}', { buy: P.backing.buy })}</small></td></tr>
    <tr class="extra"><td></td><td class="letter small">${t('Batting')}</td><td class="req">${dims([P.backing.w, P.backing.h])}</td></tr>`,
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
          `<tr data-l="${r.letter}" data-f="${r.form}"><td class="l">${r.letter}${i + 1}.${r.form}</td><td>${r.how}</td><td class="n">${sharesOf(r.pieces / r.yield)}</td><td class="n">${Math.ceil((r.pieces * b.count) / r.yield)}</td></tr>`,
      )
      .join('');
    const meta = [esc(b.label)];
    if (b.span > 1) meta.push(t('large block, {n} × {n} cells ({size})', { n: b.span, size: len(b.size) }));
    if (b.corner) meta.push(len(b.size));
    meta.push(t('make {n}', { n: b.count }));
    if (mirroredCount(b))
      meta.push(t('{n} mirrored (cut their odd-shaped pieces with the template turned over)', { n: mirroredCount(b) }));
    // pieced cornerstones are a block card too (their IDs carry its number), named for what they are
    div.innerHTML = `<h3>${b.mosaic ? t('Mosaic') : b.corner ? t('Cornerstone block') : t('Block {n}', { n: i + 1 })}</h3><p class="meta">${meta.join(' · ')}</p><div class="cg-art"><canvas aria-label="${t('Block {n}: {label}, pieces labelled with fabric letters', { n: i + 1, label: esc(b.label) })}"></canvas><span class="cg-hint" aria-hidden="true">${t('Click: cutting list · double-click: see it in the quilt')}</span></div>
      <div class="cg-list" id="cg-list-${i}"><div class="tablewrap"><table><thead><tr><th>${t('Fabric')}</th><th>${t('Cut')}</th><th>${t('Per block')}</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    box.appendChild(div);
    {
      const bc = div.querySelector('canvas');
      const draw = () => drawCutBlock(bc, b, P, i + 1);
      draw();
      cgRedraws.push(draw);
    }
    // (a mosaic is the whole quilt already: nothing to find in it)
    const pick = () => {
      if (b.mosaic) return;
      setCgHi(i);
      drawCutQuilt(P);
      openQuiltPop(P, i);
    };
    cgCardBehaviour(
      div,
      i,
      pick,
      t('Click to show or hide the cutting list · double-click to find this block in the whole quilt'),
    );
    cgRowHover(div, tr => {
      const L = tr.dataset.l,
        F = +tr.dataset.f,
        n = i + 1;
      return x => x.t === 'piece' && x.num === n && x.letter === L && x.form === F;
    });
  });
  const sashCuts = (P.sashing || []).filter(x => x.group === 'sash');
  const hint = `<span class="cg-hint" aria-hidden="true">${t('Click: cutting list · double-click: see it in the quilt')}</span>`;
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
          `<tr data-k="${Object.keys(SASH_WHAT).find(k => SASH_WHAT[k] === x.what)}"><td class="l">${x.id}</td><td>${x.what}: ${x.how}</td><td class="n">${x.n}</td></tr>`,
      )
      .join('');
    const wide = isOnPoint(design)
      ? t('{size} wide, framing every block', { size: len(sz.mm) })
      : sz.border
        ? t('{size} wide, also around the outside', { size: len(sz.mm) })
        : t('{size} wide', { size: len(sz.mm) });
    div.innerHTML =
      `<h3>${t('Sashing')}</h3><p class="meta">${wide}</p><div class="cg-art"><canvas aria-label="${t('Part of the quilt showing the sashing, pieces labelled with their IDs')}"></canvas>${hint}</div>` +
      listOf(`<th>ID</th><th>${t('Cut')}</th><th>Total</th>`, rows);
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
      t('Click to show or hide the cutting list · double-click to see the sashing in the whole quilt'),
    );
  }
  // on point: the setting triangles, IDs like the sashing's: fabric letter + T (triangles) . form
  const setCuts = (P.sashing || []).filter(x => x.group === 'setting');
  if (setCuts.length) {
    setCuts.forEach((x, k) => {
      // eslint-disable-next-line no-param-reassign -- the ids go on the plan's pieces, for the PDF too
      x.id = `${x.letter}T.${k + 1}`;
    });
    const div = document.createElement('div');
    div.className = 'cgblock cg-sash cg-setting';
    const rows = setCuts
      .map(
        x =>
          `<tr data-k="${x.setting}"><td class="l">${x.id}</td><td>${x.what}: ${x.how}</td><td class="n">${Math.ceil(x.n / x.yield)}</td><td class="n">${x.n}</td></tr>`,
      )
      .join('');
    div.innerHTML =
      `<h3>${t('Setting triangles')}</h3><p class="meta">${t("Fill the edges of the quilt on point · straight grain along the quilt's edge")}</p><div class="cg-art"><canvas aria-label="${t('A corner of the quilt on point, the setting triangles labelled with their IDs')}"></canvas>${hint}</div>` +
      listOf(`<th>ID</th><th>${t('Cut')}</th><th>${t('Squares')}</th><th>${t('Triangles')}</th>`, rows);
    box.appendChild(div);
    const cv = div.querySelector('canvas'),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      S = 300;
    const drawSet = () => {
      const H = settingPicH(S);
      cv.width = S * dpr;
      cv.height = H * dpr;
      cv.style.width = S + 'px';
      cv.style.maxWidth = '100%';
      cv.style.aspectRatio = `${S} / ${H}`;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSettingPic(g, S, setCuts, 1);
    };
    drawSet();
    cgRedraws.push(drawSet);
    cgRowHover(div, tr => {
      const K = tr.dataset.k;
      return x => x.t === 'setting' && x.kind === K;
    });
    cgCardBehaviour(
      div,
      'setting',
      () => {
        setCgHi('setting');
        drawCutQuilt(P);
        openPartPop('setting');
      },
      t('Click to show or hide the cutting list · double-click to see the setting triangles in the whole quilt'),
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
        return `<tr data-g="${bi}" data-fab="${x.fabric}" data-c="${x.cornerSquares ? 1 : 0}"><td class="l">${x.id}</td><td><b>${esc(x.part)}</b><br>${x.how}</td><td class="n">${x.wof ? '—' : n}</td></tr>`;
      })
      .join('');
    const where =
      bs2.length > 1 ? (bi === 0 ? ` · ${t('innermost')}` : bi === bs2.length - 1 ? ` · ${t('outermost')}` : '') : '';
    div.innerHTML =
      `<h3>${t('Border {n}', { n: bi + 1 })}</h3><p class="meta">${BORDER_TYPES[bd.type].label} · ${len(bd.mm)}${where}</p><div class="cg-art"><canvas aria-label="${t('The quilt with border {n} lit up and its pieces labelled', { n: bi + 1 })}"></canvas>${hint}</div>` +
      `<p class="meta cg-brdleg">${t('Pieces: <b>{ids}</b>', { ids: cuts.map(x => x.id).join(' · ') })}</p>` +
      listOf(`<th>ID</th><th>${t('Cut')}</th><th>Total</th>`, rows);
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
      t('Click to show or hide the cutting list · double-click to see border {n} in the whole quilt', { n: bi + 1 }),
    );
  });
  if (typeof cgHi === 'number' && cgHi >= P.blocks.length) setCgHi(-1);
  if (
    (cgHi === 'sash' && !sashCuts.length) ||
    (cgHi === 'setting' && !setCuts.length) ||
    (typeof cgHi === 'string' && cgHi[0] === 'b' && !brdCuts.some(x => x.group === cgHi))
  )
    setCgHi(-1);
  if (!mos) drawCutQuilt(P);
  const inInches = getUnit() === 'in';
  $('cg-note').textContent = t(
    'WOF = width of fabric: {width}, of which {usable} is usable after trimming the selvages. Cut sizes include a {seam} seam allowance and are rounded {rounding}. Requirements add {extra} to straighten the edge; "buy" rounds up to {step}.',
    {
      width: inInches ? len(cutOpts.fabricWidth) : `${comma(cutOpts.fabricWidth / 10)} cm`,
      usable: inInches ? len(P.usable) : `${comma(P.usable / 10)} cm`,
      seam: len(P.seam),
      rounding: inInches ? t('to the nearest ⅛ inch') : t('up to the whole millimetre'),
      extra: len(50),
      step: inInches ? t('⅛ yard') : '5 cm',
    },
  );
}
/**
 * A mosaic for the cutting plan: its shapes as the parts of one square "block" of the quilt's longer side, the
 * mosaic centred in it (the plan and the card drawing take parts in a unit square).
 * @param {import('@quilt/shared/types.js').Design} d
 */
function mosaicForPlan(d) {
  const m = d.mosaic,
    { w, h } = mosaicMm(m),
    S = Math.max(w, h),
    ox = (S - w) / 2,
    oy = (S - h) / 2,
    shapes = SHAPE_NAMES[m.shape][1];
  return {
    size: S,
    fabrics: m.fabrics,
    label: t('{shapes}, {size} sides', { shapes: `${shapes[0].toUpperCase()}${shapes.slice(1)}`, size: len(m.mm) }),
    parts: mosaicTiles(m).map((tile, i) => ({
      name: t('Shape {n}', { n: i + 1 }),
      role: 0,
      poly: tile.poly.map(([x, y]) => [(x + ox) / S, (y + oy) / S]),
    })),
  };
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
