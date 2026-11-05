// Cutting guide PDF: the A4 pages and the PDF writer.
import '../sim/save-image.js'; // load order: runs after sim/save-image
import { cgHi, fabHi, setCgHi, setFabHi } from '../render/hi-state.js';
import { design as current, mineCur } from '../core/store.js';
import { designs } from '../storage/repo.js';
import { dims, exact, getUnit, len, sharesOf } from '../core/units.js';
import { comma, t, tn } from '@quilt/shared/i18n.js';
import { fabricById } from '../designer/fabric-library.js';
import { BORDER_TYPES, bordersOf, isOnPoint, quiltMm, sashOf } from '@quilt/shared/geometry.js';
import { drawBordersExploded } from '../render/quilt-draw.js';
import {
  cutOpts,
  drawBlockArt,
  drawCutQuilt,
  drawSashPic,
  drawSettingPic,
  mirroredCount,
  sashPicH,
  settingPicH,
} from '../cutting/draw.js';
import { fabricFill } from '../render/fabric-fill.js';

// ------------------------------------------------------------- cutting guide PDF (A4)
// One A4 page per distinct block: the block drawn as large as the sheet allows, every piece
// labelled (A1, B1, ...) and its cutting list underneath. Page 1 lists the fabrics, page 2 shows
// the whole quilt (sashing and borders included) with every piece's ID; the sashing, the setting triangles (on
// point) and each border get a page of their own at the end.
// Each page is drawn on a canvas at 200 dpi and placed full-bleed on the sheet as a JPEG.
const A4 = { w: 210, h: 297 },
  PDF_DPI = 200,
  PX = PDF_DPI / 25.4; // px per mm
function pdfPageCanvas() {
  const c = document.createElement('canvas');
  c.width = Math.round(A4.w * PX);
  c.height = Math.round(A4.h * PX);
  const g = c.getContext('2d');
  g.scale(PX, PX);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, A4.w, A4.h);
  return [c, g];
}
const PDF_FONT = 'Helvetica, Arial, sans-serif',
  PDF_SERIF = 'Georgia, "Times New Roman", serif';
function pdfText(g, txt, x, y, size, opt = {}) {
  g.font = `${opt.weight || 400} ${size}px ${opt.serif ? PDF_SERIF : PDF_FONT}`;
  g.fillStyle = opt.color || '#1f1d1a';
  g.textAlign = opt.align || 'left';
  g.textBaseline = 'alphabetic';
  g.fillText(txt, x, y);
}
function pdfWrap(g, txt, maxW, size) {
  g.font = `400 ${size}px ${PDF_FONT}`;
  const words = String(txt).split(' '),
    lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (g.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const plainHow = s => String(s).replace(/\s*[◩⊠]/g, '');
function pdfHeader(g, P, title, sub, page, pages) {
  const M = 12;
  pdfText(g, title, M, M + 8, 9, { serif: true, weight: 600 });
  if (sub) pdfText(g, sub, M, M + 14, 4.2, { color: '#5a5650' });
  pdfText(
    g,
    t('Quilt {quilt} · block {block} · seam {seam}', {
      quilt: dims([P.quiltW, P.quiltH]),
      block: dims([P.blockW, P.blockH]),
      seam: len(P.seam),
    }),
    A4.w - M,
    M + 6,
    3.4,
    { align: 'right', color: '#5a5650' },
  );
  pdfText(g, t('Page {page} of {pages}', { page, pages }), A4.w - M, A4.h - 7, 3.2, {
    align: 'right',
    color: '#8a857c',
  });
  g.strokeStyle = '#d9d3c7';
  g.lineWidth = 0.3;
  g.beginPath();
  g.moveTo(M, M + 17.5);
  g.lineTo(A4.w - M, M + 17.5);
  g.stroke();
}
function pdfTable(g, x, y, widths, head, rows, size = 3.6) {
  const pad = 1.8,
    lh = size * 1.35,
    W = widths.reduce((a, b) => a + b, 0);
  const wrapped = rows.map(r => r.map((c, i) => (i === 1 ? pdfWrap(g, c, widths[i] - 2 * pad, size) : [String(c)])));
  const rowH = wrapped.map(r => Math.max(...r.map(c => c.length)) * lh + 2 * pad);
  const headH = lh + 2 * pad;
  g.fillStyle = '#f6e7d4';
  g.fillRect(x, y, W, headH);
  let cx = x;
  head.forEach((h, i) => {
    pdfText(g, h, i >= 2 ? cx + widths[i] - pad : cx + pad, y + pad + size, size, {
      weight: 700,
      align: i >= 2 ? 'right' : 'left',
    });
    cx += widths[i];
  });
  let cy = y + headH;
  wrapped.forEach((r, ri) => {
    if (ri % 2) {
      g.fillStyle = '#faf8f4';
      g.fillRect(x, cy, W, rowH[ri]);
    }
    cx = x;
    r.forEach((lines, i) => {
      lines.forEach((ln, li) =>
        pdfText(g, ln, i >= 2 ? cx + widths[i] - pad : cx + pad, cy + pad + size + li * lh, size, {
          weight: i === 0 ? 700 : 400,
          serif: i === 0,
          align: i >= 2 ? 'right' : 'left',
        }),
      );
      cx += widths[i];
    });
    cy += rowH[ri];
    g.strokeStyle = '#e4ded3';
    g.lineWidth = 0.2;
    g.beginPath();
    g.moveTo(x, cy);
    g.lineTo(x + W, cy);
    g.stroke();
  });
  return cy;
}
function pdfTableHeight(g, widths, rows, size = 3.6) {
  const pad = 1.8,
    lh = size * 1.35;
  return (
    lh +
    2 * pad +
    rows.reduce((h, r) => h + Math.max(1, pdfWrap(g, r[1], widths[1] - 2 * pad, size).length) * lh + 2 * pad, 0)
  );
}
// "6 × 8 blocks" or "6 × 8 blocks on point"
const gridText = () => {
  const grid = { cols: exact(current).cols, rows: exact(current).rows };
  return isOnPoint(exact(current)) ? t('{cols} × {rows} blocks on point', grid) : t('{cols} × {rows} blocks', grid);
};
function pdfFabricPage(P, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12;
  // the quilt's name on the first page, when it has one: a printed guide gets mixed up with others
  const rec = mineCur ? designs.get(mineCur) : null;
  pdfHeader(
    g,
    P,
    rec ? t('Cutting guide · {name}', { name: rec.name }) : t('Cutting guide'),
    `${gridText()} · ${tn(P.blocks.length, '{n} distinct block', '{n} distinct blocks')}`,
    1,
    pages,
  );
  let y = M + 26;
  pdfText(g, t('Fabrics'), M, y, 6, { serif: true, weight: 600 });
  y += 5;
  const rowH = 22;
  for (const r of P.fabrics) {
    const fab = fabricById(r.id);
    g.save();
    g.beginPath();
    g.rect(M, y, 34, rowH - 4);
    g.clip();
    g.fillStyle = fabricFill(g, fab, 10, 5);
    g.fillRect(M, y, 34, rowH - 4);
    g.restore(); // 10 px/cm in mm space: real scale
    g.strokeStyle = '#cfc8bb';
    g.lineWidth = 0.25;
    g.strokeRect(M, y, 34, rowH - 4);
    pdfText(g, r.letter, M + 40, y + 9, 9, { serif: true, weight: 600 });
    pdfText(g, fab.name, M + 40, y + 15, 3.6, { color: '#5a5650' });
    pdfText(g, r.requirement, M + 75, y + 7.5, 4.4, { weight: 600 });
    const notes = [
      r.buy ? t('buy ≈ {buy}', { buy: r.buy }) : '',
      r.binding
        ? t('includes binding: {strips} strips {width} × WOF', {
            strips: r.binding.strips,
            width: len(r.binding.width),
          })
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (notes) pdfText(g, notes, M + 75, y + 13, 3.6, { color: '#5a5650' });
    y += rowH;
  }
  y += 2;
  pdfText(g, t('Backing'), M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(
    g,
    tn(P.backing.widths, '{size} · {n} width of fabric · buy ≈ {buy}', '{size} · {n} widths of fabric · buy ≈ {buy}', {
      size: dims([P.backing.w, P.backing.h]),
      buy: P.backing.buy,
    }),
    M + 75,
    y + 6,
    4,
    {},
  );
  y += 9;
  pdfText(g, t('Batting'), M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(g, dims([P.backing.w, P.backing.h]), M + 75, y + 6, 4, {});
  y += 9;
  for (const x of P.sashing || []) {
    if (y > A4.h - 70) break;
    pdfText(g, x.what, M + 40, y + 6, 4, { weight: 600 });
    pdfText(
      g,
      `${x.id || x.letter}: ${x.wof ? '' : Math.ceil(x.n / (x.yield || 1)) + ' × '}${plainHow(x.how)}`.slice(0, 110),
      M + 40,
      y + 11,
      3.5,
      { color: '#3a3732' },
    );
    y += 13;
  }
  y += 7;
  pdfText(g, t('Piece labels'), M, y, 6, { serif: true, weight: 600 });
  y += 6;
  for (const ln of pdfWrap(
    g,
    t(
      "Each piece is labelled fabric letter + block number + form: D2.3 is a piece of fabric D in block 2, in that block's third shape cut from fabric D. The letters are the fabrics listed above; pieces with the same label are cut identically.",
    ),
    A4.w - 2 * M,
    4,
  )) {
    pdfText(g, ln, M, y, 4);
    y += 5.6;
  }
  y += 3;
  const inInches = getUnit() === 'in';
  for (const ln of pdfWrap(
    g,
    t(
      'WOF = width of fabric: {width}, {usable} usable after trimming the selvages. Cut sizes include a {seam} seam allowance and are rounded {rounding}.',
      {
        width: inInches ? len(cutOpts.fabricWidth) : `${comma(cutOpts.fabricWidth / 10)} cm`,
        usable: inInches ? len(P.usable) : `${comma(P.usable / 10)} cm`,
        seam: len(P.seam),
        rounding: inInches ? t('to the nearest ⅛ inch') : t('up to the whole millimetre'),
      },
    ),
    A4.w - 2 * M,
    3.6,
  )) {
    pdfText(g, ln, M, y, 3.6, { color: '#5a5650' });
    y += 5;
  }
  return c;
}
function pdfQuiltPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12,
    s = sashOf(exact(current)),
    nb = bordersOf(exact(current)).length;
  pdfHeader(
    g,
    P,
    t('Whole quilt'),
    [
      gridText(),
      ...(s.mm ? [t('{size} sashing', { size: len(s.mm) })] : []),
      ...(nb ? [tn(nb, '{n} border', '{n} borders')] : []),
      t('every piece with its ID'),
    ].join(' · '),
    page,
    pages,
  );
  // the same drawing as the Cutting guide page (sashing and borders included), made at print resolution
  const top = M + 24,
    availW = A4.w - 2 * M,
    availH = A4.h - top - 26;
  const keepHi = cgHi,
    keepFab = fabHi;
  setCgHi(-1);
  setFabHi(null);
  const tmp = document.createElement('canvas');
  try {
    drawCutQuilt(P, { cv: tmp, w: availW * PX, h: availH * PX, u: 2.4, dpr: 1 });
  } finally {
    setCgHi(keepHi);
    setFabHi(keepFab);
  }
  const k = Math.min(availW / (tmp.width / PX), availH / (tmp.height / PX), 1),
    QW = (tmp.width / PX) * k,
    QH = (tmp.height / PX) * k;
  g.drawImage(tmp, (A4.w - QW) / 2, top, QW, QH);
  let y = top + QH + 6;
  const txt = [
    t(
      'Columns are numbered across the top and rows down the side. Each block piece is labelled with its fabric letter, the number of its block in this guide and its form (D2.3 = fabric D, block 2, form 3).',
    ),
    ...(s.mm ? [t('Sashing pieces carry S (AS.1 = fabric A, sashing form 1).')] : []),
    ...(isOnPoint(exact(current)) ? [t('Setting triangles carry T (AT.1 = fabric A, setting triangle form 1).')] : []),
    ...(nb
      ? [
          t(
            'Border pieces carry B and the border number, counted from the inside (CB2.1 = fabric C, border 2, form 1).',
          ),
        ]
      : []),
    t('The pages that follow show each block{sashing}{setting}{borders} with their cutting lists.', {
      sashing: s.mm ? t(', the sashing') : '',
      setting: isOnPoint(exact(current)) ? t(', the setting triangles') : '',
      borders: nb ? t(' and the borders') : '',
    }),
  ].join(' ');
  for (const ln of pdfWrap(g, txt, A4.w - 2 * M, 3.6)) {
    pdfText(g, ln, M, y, 3.6, { color: '#3a3732' });
    y += 5;
  }
  return c;
}
// one page for the sashing (a corner of the quilt with every strip and cornerstone labelled) and its cutting list
function pdfSashPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12,
    s = sashOf(exact(current)),
    cuts = (P.sashing || []).filter(x => x.group === 'sash');
  pdfHeader(
    g,
    P,
    t('Sashing'),
    s.border
      ? t('{size} strips between the blocks and around the outside · strips and cornerstones with their IDs', {
          size: len(s.mm),
        })
      : t('{size} strips between the blocks · strips and cornerstones with their IDs', { size: len(s.mm) }),
    page,
    pages,
  );
  const widths = [24, 118, 22, 22],
    rows = cuts.map(x => [x.id, `${x.what}: ${plainHow(x.how)}`, '', x.n]);
  const tH = pdfTableHeight(g, widths, rows),
    top = M + 24;
  const side = Math.min(A4.w - 2 * M - 30, A4.h - top - tH - 24),
    H = (side * sashPicH(1000)) / 1000,
    x0 = (A4.w - side) / 2;
  g.save();
  g.translate(x0, top);
  g.scale(1 / PX, 1 / PX);
  drawSashPic(g, side * PX, cuts, 2.6);
  g.restore();
  g.strokeStyle = '#bdb6a8';
  g.lineWidth = 0.3;
  g.strokeRect(x0, top, side, H);
  pdfText(
    g,
    t('A corner of the quilt (2 × 2 blocks) showing how the strips and cornerstones go together.'),
    A4.w / 2,
    top + H + 5,
    3.4,
    { align: 'center', color: '#5a5650' },
  );
  pdfTable(g, M, top + H + 10, widths, ['ID', t('Cut'), '', 'Total'], rows);
  return c;
}
// on point: one page for the setting triangles (a corner of the quilt with each kind labelled) and their cutting list
function pdfSettingPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12,
    cuts = (P.sashing || []).filter(x => x.group === 'setting');
  pdfHeader(
    g,
    P,
    t('Setting triangles'),
    t('The triangles that fill the edges of the quilt on point · straight grain along the quilt’s edge'),
    page,
    pages,
  );
  const widths = [24, 110, 26, 26],
    rows = cuts.map(x => [x.id, `${x.what}: ${plainHow(x.how)}`, Math.ceil(x.n / x.yield), x.n]);
  const tH = pdfTableHeight(g, widths, rows),
    top = M + 24;
  const side = Math.min(A4.w - 2 * M - 30, A4.h - top - tH - 40),
    H = (side * settingPicH(1000)) / 1000,
    x0 = (A4.w - side) / 2;
  const keepFab = fabHi;
  setFabHi(null);
  g.save();
  g.translate(x0, top);
  g.scale(1 / PX, 1 / PX);
  try {
    drawSettingPic(g, side * PX, cuts, 2.6);
  } finally {
    setFabHi(keepFab);
  }
  g.restore();
  g.strokeStyle = '#bdb6a8';
  g.lineWidth = 0.3;
  g.strokeRect(x0, top, side, H);
  pdfText(
    g,
    t('A corner of the quilt (2 × 2 blocks and the one between them) showing where the triangles go.'),
    A4.w / 2,
    top + H + 5,
    3.4,
    { align: 'center', color: '#5a5650' },
  );
  let y = pdfTable(g, M, top + H + 10, widths, ['ID', t('Cut'), t('Squares'), t('Triangles')], rows) + 6;
  for (const ln of pdfWrap(
    g,
    t(
      'Side triangles: each square cut twice on the diagonal gives 4, with the long side on the straight grain, so the quilt’s edge does not stretch. Corner triangles: each square cut once gives 2, with both short sides on the straight grain. The sizes are exact (rounded up to the whole millimetre): cut them a little larger if you like to trim the edges straight after sewing.',
    ),
    A4.w - 2 * M,
    3.6,
  )) {
    pdfText(g, ln, M, y, 3.6, { color: '#3a3732' });
    y += 5;
  }
  return c;
}
// one page per border (border 1 is the innermost): the borders pulled apart with this one lit, and its cutting list
function pdfBorderPage(P, bi, page, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12,
    bs = bordersOf(exact(current)),
    bd = bs[bi],
    q = quiltMm(exact(current));
  const cuts = (P.sashing || []).filter(x => x.group === 'b' + bi);
  const where =
    bs.length > 1
      ? bi === 0
        ? ` · ${t('the innermost border')}`
        : bi === bs.length - 1
          ? ` · ${t('the outermost border')}`
          : ''
      : '';
  pdfHeader(
    g,
    P,
    t('Border {n}', { n: bi + 1 }),
    t('{type} · {size} all round{where}', { type: BORDER_TYPES[bd.type].label, size: len(bd.mm), where }),
    page,
    pages,
  );
  const widths = [24, 118, 22, 22],
    rows = cuts.map(x => [x.id, `${x.part}: ${plainHow(x.how)}`, '', x.wof ? '—' : Math.ceil(x.n / (x.yield || 1))]);
  const tH = pdfTableHeight(g, widths, rows),
    top = M + 24;
  const gapMm = bs.length > 1 ? 3 : 0,
    side = Math.min(A4.w - 2 * M - 30, ((A4.h - top - tH - 30) * q.W) / q.H),
    x0 = (A4.w - side) / 2;
  const keepFab = fabHi;
  setFabHi(null);
  let Hpx;
  g.save();
  g.translate(x0, top);
  g.scale(1 / PX, 1 / PX);
  try {
    Hpx = drawBordersExploded(g, side * PX, gapMm * PX, bs.length > 1 ? bi : -1);
  } finally {
    setFabHi(keepFab);
  }
  g.restore();
  const H = Hpx / PX;
  pdfText(
    g,
    t('Pieces of border {n}: {ids}', { n: bi + 1, ids: cuts.map(x => x.id).join(' · ') }),
    A4.w / 2,
    top + H + 6,
    3.8,
    {
      align: 'center',
      weight: 600,
    },
  );
  pdfTable(g, M, top + H + 11, widths, ['ID', t('Cut'), '', 'Total'], rows);
  return c;
}
function pdfBlockPage(P, b, i, page, pages) {
  const [c, g] = pdfPageCanvas(),
    M = 12;
  pdfHeader(
    g,
    P,
    b.mosaic ? t('Mosaic') : b.corner ? t('Cornerstone block') : t('Block {n}', { n: i + 1 }),
    [
      b.label,
      ...(b.span > 1 ? [t('large block, {size}', { size: dims([b.size, b.size]) })] : []),
      ...(b.corner ? [len(b.size)] : []),
      t('make {n}', { n: b.count }),
      ...(mirroredCount(b)
        ? [t('{n} mirrored: cut their odd-shaped pieces with the template turned over', { n: mirroredCount(b) })]
        : []),
    ].join(' · '),
    page,
    pages,
  );
  const widths = [22, 112, 26, 26];
  const rows = b.list.map(r => [
    `${r.letter}${i + 1}.${r.form}`,
    plainHow(r.how),
    sharesOf(r.pieces / r.yield),
    Math.ceil((r.pieces * b.count) / r.yield),
  ]);
  const tH = pdfTableHeight(g, widths, rows);
  const top = M + 22,
    bottom = A4.h - 12;
  // the block fills the page width unless the cutting list needs the room
  const side = Math.min(A4.w - 2 * M, bottom - top - tH - 8);
  const bx = (A4.w - side) / 2,
    bh = side;
  g.save();
  g.translate(bx, top);
  // draw at device resolution for crisp prints: scale back to px inside the block box
  g.scale(1 / PX, 1 / PX);
  drawBlockArt(g, b, P, i + 1, side * PX, bh * PX);
  g.restore();
  g.strokeStyle = '#bdb6a8';
  g.lineWidth = 0.3;
  g.strokeRect(bx, top, side, bh);
  pdfTable(g, M, top + bh + 6, widths, [t('Piece'), t('Cut'), t('Per block'), 'Total'], rows);
  return c;
}
const canvasJpeg = c =>
  new Promise((res, rej) =>
    c.toBlob(
      b => (b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error(t('Page could not be drawn')))),
      'image/jpeg',
      0.9,
    ),
  );
// Minimal PDF 1.4 writer: one full-page JPEG per A4 page.
function buildPdf(pages) {
  const enc = new TextEncoder(),
    parts = [],
    offsets = [];
  let len = 0;
  const put = x => {
    const u = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(u);
    len += u.length;
  };
  const obj = (n, body) => {
    offsets[n] = len;
    put(`${n} 0 obj\n`);
    body();
    put('\nendobj\n');
  };
  const W = ((A4.w / 25.4) * 72).toFixed(2),
    H = ((A4.h / 25.4) * 72).toFixed(2),
    n = pages.length;
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    const po = 3 + i * 3,
      co = po + 1,
      io = po + 2;
    obj(po, () =>
      put(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`,
      ),
    );
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(co, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(io, () => {
      put(
        `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`,
      );
      put(p.jpg);
      put('\nendstream');
    });
  });
  const xref = len,
    count = 3 + n * 3;
  let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export {
  A4,
  buildPdf,
  canvasJpeg,
  pdfBlockPage,
  pdfBorderPage,
  pdfFabricPage,
  pdfPageCanvas,
  pdfQuiltPage,
  pdfSashPage,
  pdfSettingPage,
  pdfText,
};
