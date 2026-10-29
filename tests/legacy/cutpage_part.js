/*CGCORE*/
// ------------------------------------------------------------- cutting guide page
const cutOpts = { seam: 7.5, fabricWidth: 1500, selvage: 50, bindingWidth: 60 };
function letterBadge(g, x, y, r, letter) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fill();
  g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
  g.fillStyle = '#1f1d1a'; g.font = `600 ${Math.round(r * 1.25)}px Georgia, "Times New Roman", serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, x, y + 0.5);
}
function drawCutBlock(cv, b, P) {
  const css = 300, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ar = P.blockH / P.blockW, W = css, H = Math.round(css * ar);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = '100%'; cv.style.maxWidth = W + 'px'; cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pxPerCm = W / (P.blockW / 10);
  const polys = b.pieces.map(pc => pc.part.poly.map(([u, v]) => [u * W, v * H]));
  b.pieces.forEach((pc, k) => { g.fillStyle = fabricFill(g, fabricById(pc.fabric), pxPerCm, b.index * 31 + k); pathPoly(g, polys[k]); g.fill(); });
  g.lineWidth = 1.5; g.strokeStyle = '#ffffff';
  polys.forEach(p => { pathPoly(g, p); g.stroke(); });
  b.pieces.forEach((pc, k) => {
    const p = polys[k];
    let A = 0, cx = 0, cy = 0;
    for (let j = 0; j < p.length; j++) { const a = p[j], c = p[(j + 1) % p.length], cr = a[0] * c[1] - c[0] * a[1]; A += cr; cx += (a[0] + c[0]) * cr; cy += (a[1] + c[1]) * cr; }
    A /= 2; cx /= 6 * A; cy /= 6 * A;
    const r = Math.max(7, Math.min(14, Math.sqrt(Math.abs(A)) * 0.22));
    letterBadge(g, cx, cy, r, pc.letter);
  });
}
function swatchCanvas(fab, w = 72, h = 48) {
  const c = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // show about 12 cm of the fabric so the print reads at its real scale
  g.fillStyle = fabricFill(g, fab, w / 12, 5); g.fillRect(0, 0, w, h);
  return c;
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function renderCut() {
  if (!design) return;
  const P = CG.plan(design, { quiltMm: SIZE * 1000, seam: cutOpts.seam, fabricWidth: cutOpts.fabricWidth, selvage: cutOpts.selvage,
    bindingFabric: 'b1', bindingWidth: cutOpts.bindingWidth, partsOf, label: k => PATTERNS[k].label });
  const mm = CG.mm;
  $('cg-facts').innerHTML = [
    ['Finished quilt', `${P.quiltW} × ${P.quiltH} mm`], ['Blocks', `${design.cols} × ${design.rows}`],
    ['Block', `${P.blockW} × ${P.blockH} mm finished · ${P.blockW + 2 * P.seam} × ${P.blockH + 2 * P.seam} mm with seam allowance`],
    ['Distinct blocks', P.blocks.length],
  ].map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join('');
  // fabric table
  const tb = $('cg-fabrics').querySelector('tbody'); tb.innerHTML = '';
  for (const r of P.fabrics) {
    const fab = fabricById(r.id), tr = document.createElement('tr');
    const notes = [];
    if (r.binding) notes.push(`includes binding: ${r.binding.strips} strips ${r.binding.width} mm × WOF`);
    tr.innerHTML = `<td class="sw"></td><td class="letter">${r.letter}<span class="fname">${esc(fab.name)}</span></td>
      <td class="req">${r.requirement}${r.buy ? `<small>buy ≈ ${r.buy}</small>` : ''}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</td>`;
    tr.querySelector('.sw').appendChild(swatchCanvas(fab));
    tb.appendChild(tr);
  }
  tb.insertAdjacentHTML('beforeend', `<tr class="extra"><td></td><td class="letter small">Backing</td><td class="req">${P.backing.w} × ${P.backing.h} mm<small>${P.backing.widths} width${P.backing.widths > 1 ? 's' : ''} of fabric sewn together · buy ≈ ${P.backing.buy}</small></td></tr>
    <tr class="extra"><td></td><td class="letter small">Batting</td><td class="req">${P.backing.w} × ${P.backing.h} mm</td></tr>`);
  // blocks
  const box = $('cg-blocks'); box.innerHTML = '';
  P.blocks.forEach((b, i) => {
    const div = document.createElement('div'); div.className = 'cgblock';
    const rows = b.list.map(r => `<tr><td class="l">${r.letter}</td><td>${r.how}</td><td class="n">${Math.ceil(r.pieces / r.yield)}</td><td class="n">${Math.ceil(r.pieces * b.count / r.yield)}</td></tr>`).join('');
    div.innerHTML = `<h3>Block ${i + 1}</h3><p class="meta">${esc(b.label)} · make ${b.count}</p><canvas aria-label="Block ${i + 1}: ${esc(b.label)}, pieces labelled with fabric letters"></canvas>
      <div class="tablewrap"><table><thead><tr><th>Fabric</th><th>Cut</th><th>Per block</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    box.appendChild(div);
    drawCutBlock(div.querySelector('canvas'), b, P);
  });
  $('cg-note').textContent = `WOF = width of fabric: ${cutOpts.fabricWidth / 10} cm, of which ${P.usable / 10} cm is usable after trimming the selvages. Cut sizes include a ${P.seam} mm seam allowance and are rounded up to the whole millimetre. Requirements add 50 mm to straighten the edge; "buy" rounds up to 5 cm.`;
}
function initCutUI() {
  $('cg-seam').addEventListener('change', e => { cutOpts.seam = +e.target.value; renderCut(); });
  $('cg-width').addEventListener('change', e => { cutOpts.fabricWidth = +e.target.value; renderCut(); });
  $('cg-binding').addEventListener('change', e => { cutOpts.bindingWidth = +e.target.value; renderCut(); });
  $('cg-edit').addEventListener('click', () => showPage('design'));
}
initCutUI();
