// Cutting guide PDF: the A4 pages and the PDF writer.
import '../sim/save-image.js';          // load order: runs after sim/save-image
import { shared } from '../core/shared.js';
import { fabricById } from '../designer/fabric-library.js';
import { BORDER_TYPES, bordersOf, fabricFill, quiltMm, sashOf } from '../core/geometry.js';
import { drawBordersExploded } from '../render/quilt-draw.js';
import { cutOpts, drawBlockArt, drawCutQuilt, drawSashPic, mirroredCount, sashPicH } from '../cutting/draw.js';

// ------------------------------------------------------------- cutting guide PDF (A4)
// One A4 page per distinct block: the block drawn as large as the sheet allows, every piece
// labelled (A1, B1, ...) and its cutting list underneath. Page 1 lists the fabrics, page 2 shows
// the whole quilt (sashing and borders included) with every piece's ID; the sashing and each border
// get a page of their own at the end.
// Each page is drawn on a canvas at 200 dpi and placed full-bleed on the sheet as a JPEG.
const A4 = { w: 210, h: 297 }, PDF_DPI = 200, PX = PDF_DPI / 25.4;          // px per mm
function pdfPageCanvas() {
  const c = document.createElement('canvas'); c.width = Math.round(A4.w * PX); c.height = Math.round(A4.h * PX);
  const g = c.getContext('2d'); g.scale(PX, PX); g.fillStyle = '#fff'; g.fillRect(0, 0, A4.w, A4.h);
  return [c, g];
}
const PDF_FONT = 'Helvetica, Arial, sans-serif', PDF_SERIF = 'Georgia, "Times New Roman", serif';
function pdfText(g, txt, x, y, size, opt = {}) {
  g.font = `${opt.weight || 400} ${size}px ${opt.serif ? PDF_SERIF : PDF_FONT}`;
  g.fillStyle = opt.color || '#1f1d1a'; g.textAlign = opt.align || 'left'; g.textBaseline = 'alphabetic';
  g.fillText(txt, x, y);
}
function pdfWrap(g, txt, maxW, size) {
  g.font = `400 ${size}px ${PDF_FONT}`;
  const words = String(txt).split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
const plainHow = s => String(s).replace(/\s*[◩⊠]/g, '');
function pdfHeader(g, P, title, sub, page, pages) {
  const M = 12;
  pdfText(g, title, M, M + 8, 9, { serif: true, weight: 600 });
  if (sub) pdfText(g, sub, M, M + 14, 4.2, { color: '#5a5650' });
  pdfText(g, `Quilt ${P.quiltW} × ${P.quiltH} mm · block ${P.blockW} × ${P.blockH} mm · seam ${P.seam} mm`, A4.w - M, M + 6, 3.4, { align: 'right', color: '#5a5650' });
  pdfText(g, `Page ${page} of ${pages}`, A4.w - M, A4.h - 7, 3.2, { align: 'right', color: '#8a857c' });
  g.strokeStyle = '#d9d3c7'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(M, M + 17.5); g.lineTo(A4.w - M, M + 17.5); g.stroke();
}
function pdfTable(g, x, y, widths, head, rows, size = 3.6) {
  const pad = 1.8, lh = size * 1.35, W = widths.reduce((a, b) => a + b, 0);
  const wrapped = rows.map(r => r.map((c, i) => i === 1 ? pdfWrap(g, c, widths[i] - 2 * pad, size) : [String(c)]));
  const rowH = wrapped.map(r => Math.max(...r.map(c => c.length)) * lh + 2 * pad);
  const headH = lh + 2 * pad;
  g.fillStyle = '#f6e7d4'; g.fillRect(x, y, W, headH);
  let cx = x; head.forEach((h, i) => { pdfText(g, h, i >= 2 ? cx + widths[i] - pad : cx + pad, y + pad + size, size, { weight: 700, align: i >= 2 ? 'right' : 'left' }); cx += widths[i]; });
  let cy = y + headH;
  wrapped.forEach((r, ri) => {
    if (ri % 2) { g.fillStyle = '#faf8f4'; g.fillRect(x, cy, W, rowH[ri]); }
    cx = x;
    r.forEach((lines, i) => {
      lines.forEach((ln, li) => pdfText(g, ln, i >= 2 ? cx + widths[i] - pad : cx + pad, cy + pad + size + li * lh, size,
        { weight: i === 0 ? 700 : 400, serif: i === 0, align: i >= 2 ? 'right' : 'left' }));
      cx += widths[i];
    });
    cy += rowH[ri];
    g.strokeStyle = '#e4ded3'; g.lineWidth = 0.2; g.beginPath(); g.moveTo(x, cy); g.lineTo(x + W, cy); g.stroke();
  });
  return cy;
}
function pdfTableHeight(g, widths, rows, size = 3.6) {
  const pad = 1.8, lh = size * 1.35;
  return lh + 2 * pad + rows.reduce((h, r) => h + Math.max(1, pdfWrap(g, r[1], widths[1] - 2 * pad, size).length) * lh + 2 * pad, 0);
}
function pdfFabricPage(P, pages) {
  const [c, g] = pdfPageCanvas(), M = 12;
  pdfHeader(g, P, 'Cutting guide', `${shared.design.cols} × ${shared.design.rows} blocks · ${P.blocks.length} distinct block${P.blocks.length > 1 ? 's' : ''}`, 1, pages);
  let y = M + 26;
  pdfText(g, 'Fabrics', M, y, 6, { serif: true, weight: 600 }); y += 5;
  const rowH = 22;
  for (const r of P.fabrics) {
    const fab = fabricById(r.id);
    g.save(); g.beginPath(); g.rect(M, y, 34, rowH - 4); g.clip();
    g.fillStyle = fabricFill(g, fab, 10, 5); g.fillRect(M, y, 34, rowH - 4); g.restore();   // 10 px/cm in mm space: real scale
    g.strokeStyle = '#cfc8bb'; g.lineWidth = 0.25; g.strokeRect(M, y, 34, rowH - 4);
    pdfText(g, r.letter, M + 40, y + 9, 9, { serif: true, weight: 600 });
    pdfText(g, fab.name, M + 40, y + 15, 3.6, { color: '#5a5650' });
    pdfText(g, r.requirement, M + 75, y + 7.5, 4.4, { weight: 600 });
    const notes = [r.buy ? `buy ≈ ${r.buy}` : '', r.binding ? `includes binding: ${r.binding.strips} strips ${r.binding.width} mm × WOF` : ''].filter(Boolean).join(' · ');
    if (notes) pdfText(g, notes, M + 75, y + 13, 3.6, { color: '#5a5650' });
    y += rowH;
  }
  y += 2;
  pdfText(g, 'Backing', M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(g, `${P.backing.w} × ${P.backing.h} mm · ${P.backing.widths} width${P.backing.widths > 1 ? 's' : ''} of fabric · buy ≈ ${P.backing.buy}`, M + 75, y + 6, 4, {});
  y += 9;
  pdfText(g, 'Batting', M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(g, `${P.backing.w} × ${P.backing.h} mm`, M + 75, y + 6, 4, {});
  y += 9;
  for (const x of P.sashing || []) {
    if (y > A4.h - 70) break;
    pdfText(g, x.what, M + 40, y + 6, 4, { weight: 600 });
    pdfText(g, `${x.id || x.letter}: ${x.wof ? '' : Math.ceil(x.n / (x.yield || 1)) + ' × '}${plainHow(x.how)}`.slice(0, 110), M + 40, y + 11, 3.5, { color: '#3a3732' });
    y += 13;
  }
  y += 7;
  pdfText(g, 'Piece labels', M, y, 6, { serif: true, weight: 600 }); y += 6;
  for (const ln of pdfWrap(g, 'Each piece is labelled fabric letter + block number + form: D2.3 is a piece of fabric D in block 2, in that block\'s third shape cut from fabric D. The letters are the fabrics listed above; pieces with the same label are cut identically.', A4.w - 2 * M, 4)) { pdfText(g, ln, M, y, 4); y += 5.6; }
  y += 3;
  for (const ln of pdfWrap(g, `WOF = width of fabric: ${cutOpts.fabricWidth / 10} cm, ${P.usable / 10} cm usable after trimming the selvages. Cut sizes include a ${P.seam} mm seam allowance and are rounded up to the whole millimetre.`, A4.w - 2 * M, 3.6)) { pdfText(g, ln, M, y, 3.6, { color: '#5a5650' }); y += 5; }
  return c;
}
function pdfQuiltPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, s = sashOf(shared.design), nb = bordersOf(shared.design).length;
  pdfHeader(g, P, 'Whole quilt', `${shared.design.cols} × ${shared.design.rows} blocks${s.mm ? ` · ${s.mm} mm sashing` : ''}${nb ? ` · ${nb} border${nb > 1 ? 's' : ''}` : ''} · every piece with its ID`, page, pages);
  // the same drawing as the Cutting guide page (sashing and borders included), made at print resolution
  const top = M + 24, availW = A4.w - 2 * M, availH = A4.h - top - 26;
  const keepHi = shared.cgHi, keepFab = shared.fabHi; shared.cgHi = -1; shared.fabHi = null;
  const tmp = document.createElement('canvas');
  try { drawCutQuilt(P, { cv: tmp, w: availW * PX, h: availH * PX, u: 2.4, dpr: 1 }); } finally { shared.cgHi = keepHi; shared.fabHi = keepFab; }
  const k = Math.min(availW / (tmp.width / PX), availH / (tmp.height / PX), 1), QW = tmp.width / PX * k, QH = tmp.height / PX * k;
  g.drawImage(tmp, (A4.w - QW) / 2, top, QW, QH);
  let y = top + QH + 6;
  const txt = `Columns are numbered across the top and rows down the side. Each block piece is labelled with its fabric letter, the number of its block in this guide and its form (D2.3 = fabric D, block 2, form 3).`
    + (s.mm ? ' Sashing pieces carry S (AS.1 = fabric A, sashing form 1).' : '') + (nb ? ' Border pieces carry B and the border number, counted from the inside (CB2.1 = fabric C, border 2, form 1).' : '')
    + ' The pages that follow show each block, the sashing and the borders with their cutting lists.';
  for (const ln of pdfWrap(g, txt, A4.w - 2 * M, 3.6)) { pdfText(g, ln, M, y, 3.6, { color: '#3a3732' }); y += 5; }
  return c;
}
// one page for the sashing (a corner of the quilt with every strip and cornerstone labelled) and its cutting list
function pdfSashPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, s = sashOf(shared.design), cuts = (P.sashing || []).filter(x => x.group === 'sash');
  pdfHeader(g, P, 'Sashing', `${s.mm} mm strips between the blocks${s.border ? ' and around the outside' : ''} · strips and cornerstones with their IDs`, page, pages);
  const widths = [24, 118, 22, 22], rows = cuts.map(x => [x.id, `${x.what}: ${plainHow(x.how)}`, '', x.n]);
  const tH = pdfTableHeight(g, widths, rows), top = M + 24;
  const side = Math.min(A4.w - 2 * M - 30, A4.h - top - tH - 24), H = side * sashPicH(1000) / 1000, x0 = (A4.w - side) / 2;
  g.save(); g.translate(x0, top); g.scale(1 / PX, 1 / PX); drawSashPic(g, side * PX, cuts, 2.6); g.restore();
  g.strokeStyle = '#bdb6a8'; g.lineWidth = 0.3; g.strokeRect(x0, top, side, H);
  pdfText(g, 'A corner of the quilt (2 × 2 blocks) showing how the strips and cornerstones go together.', A4.w / 2, top + H + 5, 3.4, { align: 'center', color: '#5a5650' });
  pdfTable(g, M, top + H + 10, widths, ['ID', 'Cut', '', 'Total'], rows);
  return c;
}
// one page per border (border 1 is the innermost): the borders pulled apart with this one lit, and its cutting list
function pdfBorderPage(P, bi, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, bs = bordersOf(shared.design), bd = bs[bi], q = quiltMm(shared.design);
  const cuts = (P.sashing || []).filter(x => x.group === 'b' + bi);
  const where = bs.length > 1 ? (bi === 0 ? ' · the innermost border' : bi === bs.length - 1 ? ' · the outermost border' : '') : '';
  pdfHeader(g, P, `Border ${bi + 1}`, `${BORDER_TYPES[bd.type].label} · ${bd.mm} mm all round${where}`, page, pages);
  const widths = [24, 118, 22, 22], rows = cuts.map(x => [x.id, `${x.what.replace(/^Border \d+ · /, '')}: ${plainHow(x.how)}`, '', x.wof ? '—' : Math.ceil(x.n / (x.yield || 1))]);
  const tH = pdfTableHeight(g, widths, rows), top = M + 24;
  const gapMm = bs.length > 1 ? 3 : 0, side = Math.min(A4.w - 2 * M - 30, (A4.h - top - tH - 30) * q.W / q.H), x0 = (A4.w - side) / 2;
  const keepFab = shared.fabHi; shared.fabHi = null; let Hpx;
  g.save(); g.translate(x0, top); g.scale(1 / PX, 1 / PX); try { Hpx = drawBordersExploded(g, side * PX, gapMm * PX, bs.length > 1 ? bi : -1); } finally { shared.fabHi = keepFab; } g.restore();
  const H = Hpx / PX;
  pdfText(g, `Pieces of border ${bi + 1}: ${cuts.map(x => x.id).join(' · ')}`, A4.w / 2, top + H + 6, 3.8, { align: 'center', weight: 600 });
  pdfTable(g, M, top + H + 11, widths, ['ID', 'Cut', '', 'Total'], rows);
  return c;
}
function pdfBlockPage(P, b, i, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12;
  pdfHeader(g, P, `Block ${i + 1}`, `${b.label}${b.span > 1 ? ` · large block, ${b.size} × ${b.size} mm` : ''} · make ${b.count}${mirroredCount(b) ? ` · ${mirroredCount(b)} mirrored: cut their odd-shaped pieces with the template turned over` : ''}`, page, pages);
  const widths = [22, 112, 26, 26];
  const rows = b.list.map(r => [`${r.letter}${i + 1}.${r.form}`, plainHow(r.how), Math.ceil(r.pieces / r.yield), Math.ceil(r.pieces * b.count / r.yield)]);
  const tH = pdfTableHeight(g, widths, rows);
  const top = M + 22, bottom = A4.h - 12;
  // the block fills the page width unless the cutting list needs the room
  const side = Math.min(A4.w - 2 * M, bottom - top - tH - 8);
  const bx = (A4.w - side) / 2, bh = side;
  g.save(); g.translate(bx, top);
  // draw at device resolution for crisp prints: scale back to px inside the block box
  g.scale(1 / PX, 1 / PX); drawBlockArt(g, b, P, i + 1, side * PX, bh * PX); g.restore();
  g.strokeStyle = '#bdb6a8'; g.lineWidth = 0.3; g.strokeRect(bx, top, side, bh);
  pdfTable(g, M, top + bh + 6, widths, ['Piece', 'Cut', 'Per block', 'Total'], rows);
  return c;
}
const canvasJpeg = c => new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('Page could not be drawn')), 'image/jpeg', 0.9));
// Minimal PDF 1.4 writer: one full-page JPEG per A4 page.
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offsets = []; let len = 0;
  const put = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offsets[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  const W = (A4.w / 25.4 * 72).toFixed(2), H = (A4.h / 25.4 * 72).toFixed(2), n = pages.length;
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    const po = 3 + i * 3, co = po + 1, io = po + 2;
    obj(po, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(co, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(io, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put('\nendstream'); });
  });
  const xref = len, count = 3 + n * 3;
  let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export { A4, buildPdf, canvasJpeg, pdfBlockPage, pdfBorderPage, pdfFabricPage, pdfPageCanvas, pdfQuiltPage, pdfSashPage, pdfText };
