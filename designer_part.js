// ------------------------------------------------------------- quilt designer
// The user lays out a grid of blocks, picks a traditional pattern for each
// block and a fabric for every part of it. "Simulate this quilt" turns the
// design into the quilt's texture and a quilting normal map that follows the
// design's own seams, then drops it on the bed.

// Each pattern is a list of parts: a polygon in the unit square (y down) and
// a colour role (0 background, 1 main, 2 accent) used for default fabrics.
const P_ = (name, role, poly) => ({ name, role, poly });
function rotPoly(poly, k) { let p = poly; for (let i = 0; i < k; i++) p = p.map(([x, y]) => [1 - y, x]); return p; }
const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const PATTERNS = {
  plain: { label: 'Plain square', parts: () => [P_('Square', 0, sq(0, 0, 1, 1))] },
  hst: { label: 'Half-square triangle', parts: () => [P_('Lower triangle', 1, [[0, 0], [0, 1], [1, 1]]), P_('Upper triangle', 0, [[0, 0], [1, 0], [1, 1]])] },
  hourglass: { label: 'Hourglass', parts: () => {
    const c = [0.5, 0.5];
    return [P_('Top', 1, [[0, 0], [1, 0], c]), P_('Right', 0, [[1, 0], [1, 1], c]), P_('Bottom', 1, [[1, 1], [0, 1], c]), P_('Left', 0, [[0, 1], [0, 0], c])];
  } },
  four: { label: 'Four patch', parts: () => [P_('Top left', 1, sq(0, 0, .5, .5)), P_('Top right', 0, sq(.5, 0, 1, .5)), P_('Bottom left', 0, sq(0, .5, .5, 1)), P_('Bottom right', 1, sq(.5, .5, 1, 1))] },
  nine: { label: 'Nine patch', parts: () => {
    const out = [], t = 1 / 3, names = ['Top left', 'Top', 'Top right', 'Left', 'Centre', 'Right', 'Bottom left', 'Bottom', 'Bottom right'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out.push(P_(names[j * 3 + i], (i + j) % 2 === 0 ? 1 : 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    return out;
  } },
  ohio: { label: 'Ohio star', parts: () => {
    const t = 1 / 3, out = [];
    for (const [i, j, n] of [[0, 0, 'Corner top left'], [2, 0, 'Corner top right'], [0, 2, 'Corner bottom left'], [2, 2, 'Corner bottom right']]) out.push(P_(n, 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    out.push(P_('Centre', 2, sq(t, t, 2 * t, 2 * t)));
    // four quarter-square-triangle units make the star points
    for (const [i, j, side, vertical] of [[1, 0, 'top', false], [1, 2, 'bottom', false], [0, 1, 'left', true], [2, 1, 'right', true]]) {
      const x0 = i * t, y0 = j * t, x1 = x0 + t, y1 = y0 + t, c = [x0 + t / 2, y0 + t / 2];
      const tri = { N: [[x0, y0], [x1, y0], c], E: [[x1, y0], [x1, y1], c], S: [[x1, y1], [x0, y1], c], Wd: [[x0, y1], [x0, y0], c] };
      const star = vertical ? ['N', 'S'] : ['E', 'Wd'];
      for (const k of ['N', 'E', 'S', 'Wd']) out.push(P_(`Point ${side} · ${{ N: 'upper', E: 'right', S: 'lower', Wd: 'left' }[k]}`, star.includes(k) ? 1 : 0, tri[k]));
    }
    return out;
  } },
  pinwheel: { label: 'Pinwheel', parts: () => {
    const blade = [[0, 0], [.5, 0], [.5, .5]], bg = [[0, 0], [.5, .5], [0, .5]], out = [];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Blade ' + names[k], 1, rotPoly(blade, k))); out.push(P_('Background ' + names[k], 0, rotPoly(bg, k))); }
    return out;
  } },
  geese: { label: 'Flying geese', parts: () => {
    const out = [];
    for (const [r, role] of [[0, 1], [1, 2]]) {
      const y0 = r * .5, y1 = y0 + .5, n = r ? 'lower' : 'upper';
      out.push(P_(`Goose ${n}`, role, [[0, y1], [.5, y0], [1, y1]]), P_(`Sky left ${n}`, 0, [[0, y0], [.5, y0], [0, y1]]), P_(`Sky right ${n}`, 0, [[.5, y0], [1, y0], [1, y1]]));
    }
    return out;
  } },
  logcabin: { label: 'Log cabin', parts: () => {
    let x0 = .4, y0 = .4, x1 = .6, y1 = .6; const w = .1, out = [P_('Hearth', 2, sq(x0, y0, x1, y1))];
    for (let k = 0; k < 16; k++) {
      const side = k % 4, role = side < 2 ? 0 : 1, n = `Log ${k + 1}`;
      if (side === 0) { out.push(P_(n, role, sq(x0, y0 - w, x1, y0))); y0 -= w; }
      else if (side === 1) { out.push(P_(n, role, sq(x1, y0, x1 + w, y1))); x1 += w; }
      else if (side === 2) { out.push(P_(n, role, sq(x0, y1, x1, y1 + w))); y1 += w; }
      else { out.push(P_(n, role, sq(x0 - w, y0, x0, y1))); x0 -= w; }
    }
    return out;
  } },
  churn: { label: 'Churn dash', parts: () => {
    const t = 1 / 3, out = [];
    // corners: half-square triangles with the dark half at the outer corner
    const corner = [[0, 0], [t, 0], [0, t]], cornerBg = [[t, 0], [t, t], [0, t]];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Corner ' + names[k], 1, rotPoly(corner, k)), P_('Corner background ' + names[k], 0, rotPoly(cornerBg, k))); }
    const edgeOuter = sq(t, 0, 2 * t, t / 2), edgeInner = sq(t, t / 2, 2 * t, t), en = ['top', 'right', 'bottom', 'left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Bar ' + en[k], 1, rotPoly(edgeOuter, k)), P_('Bar background ' + en[k], 0, rotPoly(edgeInner, k))); }
    out.push(P_('Centre', 0, sq(t, t, 2 * t, 2 * t)));
    return out;
  } },
};
const PCACHE = {};
const partsOf = name => (PCACHE[name] = PCACHE[name] || PATTERNS[name].parts());

// ---- fabric library (bundled scans + the user's photos)
const fabricLib = [];          // {id, name, canvas, cm}
const fabricById = id => fabricLib.find(f => f.id === id) || fabricLib[0];
let activeFabric = null;
async function initFabricLib() {
  if (fabricLib.length) return;
  const preps = await Promise.all(BUNDLED.map(prepareSwatch));
  preps.forEach((s, i) => fabricLib.push({ id: 'b' + i, name: s.name, canvas: s.canvas, cm: s.cm }));
}
const ROLE_DEFAULT = ['b0', 'b1', 'b3'];     // cream, indigo, mustard

// ---- design state
const DESIGN_KEY = 'quilt-designer.v1';
let design = null, selBlocks = new Set(), focusBlock = 0, selParts = new Set();
function newBlock(pattern = 'ohio', roles = ROLE_DEFAULT) {
  return { pattern, rot: 0, fabrics: partsOf(pattern).map(p => roles[p.role] || roles[0]) };
}
function defaultDesign() {
  const d = { cols: 5, rows: 5, blocks: [] };
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
    d.blocks.push((r + c) % 2 === 0 ? newBlock('ohio', ['b0', 'b1', 'b3']) : newBlock('nine', ['b0', 'b4', 'b3']));
  return d;
}
function loadDesign() {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null');
    if (d && d.cols && d.rows && Array.isArray(d.blocks) && d.blocks.length === d.cols * d.rows &&
        d.blocks.every(b => PATTERNS[b.pattern] && b.fabrics.length === partsOf(b.pattern).length)) return d;
  } catch (e) {}
  return defaultDesign();
}
function saveDesign() { try { localStorage.setItem(DESIGN_KEY, JSON.stringify(design)); } catch (e) {} }
function resizeDesign(cols, rows) {
  cols = Math.max(1, Math.min(20, cols | 0)); rows = Math.max(1, Math.min(20, rows | 0));
  const old = design, blocks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r < old.rows && c < old.cols) blocks.push(old.blocks[r * old.cols + c]);
    else {
      // new blocks continue the checkerboard of the nearest existing block pattern
      const src = old.blocks[Math.min(r, old.rows - 1) * old.cols + Math.min(c, old.cols - 1)];
      blocks.push(JSON.parse(JSON.stringify(src)));
    }
  }
  design = { cols, rows, blocks };
  selBlocks = new Set([Math.min(focusBlock, blocks.length - 1)]); focusBlock = [...selBlocks][0]; selParts.clear();
  saveDesign(); renderDesigner();
}

// ---- drawing
// Fabric is drawn at its real size: the quilt is SIZE metres across.
function fabricFill(g, fab, pxPerCm, seed) {
  const pat = g.createPattern(fab.canvas, 'repeat');
  const k = pxPerCm / (fab.canvas.width / fab.cm);
  const ox = (seed * 7919) % fab.canvas.width, oy = (seed * 104729) % fab.canvas.height;
  pat.setTransform(new DOMMatrix().scale(k).translate(-ox, -oy));
  return pat;
}
function blockPolys(b, x, y, w, h) {
  return partsOf(b.pattern).map(p => rotPoly(p.poly, b.rot).map(([u, v]) => [x + u * w, y + v * h]));
}
function pathPoly(g, poly) { g.beginPath(); poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }
function drawQuilt(g, W, H, opts = {}) {
  const d = design, bw = W / d.cols, bh = H / d.rows, pxPerCm = W / (SIZE * 100);
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++) {
    const bi = r * d.cols + c, b = d.blocks[bi], polys = blockPolys(b, c * bw, r * bh, bw, bh);
    polys.forEach((poly, pi) => {
      g.fillStyle = fabricFill(g, fabricById(b.fabrics[pi]), pxPerCm, bi * 31 + pi);
      pathPoly(g, poly); g.fill();
    });
    if (opts.seams) {
      g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = Math.max(1, W / 1400);
      polys.forEach(poly => { pathPoly(g, poly); g.stroke(); });
    }
  }
}
function drawDesignerCanvas() {
  const cv = $('dz-quilt'), box = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2), css = Math.max(200, Math.floor(Math.min(box.width, 720)));
  cv.style.width = cv.style.height = css + 'px';
  cv.width = cv.height = Math.floor(css * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, css, css, { seams: true });
  // binding
  g.strokeStyle = '#2f466f'; g.lineWidth = Math.max(3, css * 0.006); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, css - g.lineWidth, css - g.lineWidth);
  const bw = css / design.cols, bh = css / design.rows;
  for (const bi of selBlocks) {
    const c = bi % design.cols, r = Math.floor(bi / design.cols);
    g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.strokeRect(c * bw + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    g.lineWidth = 1.5; g.strokeStyle = bi === focusBlock ? '#e0592a' : '#1b2233'; g.setLineDash(bi === focusBlock ? [] : [5, 4]);
    g.strokeRect(c * bw + 1.5, r * bh + 1.5, bw - 3, bh - 3); g.setLineDash([]);
  }
  $('dz-size').textContent = `${design.cols} × ${design.rows} blocks · quilt ${(SIZE * 100).toFixed(0)} × ${(SIZE * 100).toFixed(0)} cm · block ${(SIZE * 100 / design.cols).toFixed(1)} × ${(SIZE * 100 / design.rows).toFixed(1)} cm`;
}
function drawPartsEditor() {
  const cv = $('dz-block'), css = 260, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = css * dpr; cv.style.width = cv.style.height = css + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, css, css);
  const b = design.blocks[focusBlock], polys = blockPolys(b, 0, 0, css, css);
  const realCm = SIZE * 100 / design.cols, pxPerCm = css / realCm;
  polys.forEach((poly, pi) => { g.fillStyle = fabricFill(g, fabricById(b.fabrics[pi]), pxPerCm, focusBlock * 31 + pi); pathPoly(g, poly); g.fill(); });
  polys.forEach((poly, pi) => {
    pathPoly(g, poly);
    if (selParts.has(pi)) {
      g.fillStyle = 'rgba(224,89,42,.28)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
      g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.stroke();
    } else { g.lineWidth = 1; g.strokeStyle = 'rgba(20,20,20,.45)'; g.stroke(); }
  });
  const names = [...selParts].map(i => partsOf(b.pattern)[i].name);
  $('dz-parts-info').textContent = selParts.size === 0 ? 'Click a part to select it, or select all parts. Then pick a fabric.'
    : selParts.size === 1 ? `Selected: ${names[0]} · ${fabricById(b.fabrics[[...selParts][0]]).name}` : `${selParts.size} parts selected`;
  $('dz-blockname').textContent = `${PATTERNS[b.pattern].label} · block ${Math.floor(focusBlock / design.cols) + 1}, ${focusBlock % design.cols + 1}` + (selBlocks.size > 1 ? ` · editing ${selBlocks.size} blocks` : '');
}
function drawPatternButtons() {
  const box = $('dz-patterns');
  if (!box.childElementCount) {
    for (const [key, p] of Object.entries(PATTERNS)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pat'; b.dataset.p = key; b.title = p.label;
      const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      const cols = ['#efe5cf', '#2f466f', '#c79a45'];
      partsOf(key).forEach(part => { g.fillStyle = cols[part.role]; pathPoly(g, part.poly.map(([u, v]) => [u * 96, v * 96])); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(); });
      const s = document.createElement('span'); s.textContent = p.label;
      b.append(c, s); box.appendChild(b);
    }
  }
  const cur = design.blocks[focusBlock].pattern;
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.p === cur));
}
function drawFabricPalette() {
  const box = $('dz-fabrics'); box.innerHTML = '';
  for (const f of fabricLib) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fab'; b.dataset.f = f.id; b.title = f.name;
    const c = document.createElement('canvas'); c.width = c.height = 64; const k = Math.min(f.canvas.width, f.canvas.height, 360);
    c.getContext('2d').drawImage(f.canvas, 0, 0, k, k, 0, 0, 64, 64);
    const s = document.createElement('span'); s.textContent = f.name;
    b.append(c, s);
    b.setAttribute('aria-pressed', String(f.id === activeFabric));
    box.appendChild(b);
  }
}
function renderDesigner() {
  if (!design) return;
  $('dz-cols').value = design.cols; $('dz-rows').value = design.rows;
  $('dz-rot').textContent = `Rotate 90° (${design.blocks[focusBlock].rot * 90}°)`;
  drawDesignerCanvas(); drawPartsEditor(); drawPatternButtons();
}

// ---- interaction
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function eachSelected(fn) { for (const bi of selBlocks) fn(design.blocks[bi], bi); }
function applyFabric(fid) {
  activeFabric = fid;
  if (!selParts.size) { $('dz-parts-info').textContent = 'Select one or more parts first, then pick a fabric.'; drawFabricPalette(); return; }
  const focus = design.blocks[focusBlock];
  eachSelected(b => { if (b.pattern === focus.pattern) for (const pi of selParts) b.fabrics[pi] = fid; });
  saveDesign(); drawFabricPalette(); drawDesignerCanvas(); drawPartsEditor();
}
function setPattern(key) {
  // carry the focused block's colours over to the new pattern, role by role
  const b0 = design.blocks[focusBlock], roles = [...ROLE_DEFAULT], seen = [false, false, false];
  partsOf(b0.pattern).forEach((p, i) => { if (!seen[p.role]) { roles[p.role] = b0.fabrics[i]; seen[p.role] = true; } });
  eachSelected((b, bi) => { design.blocks[bi] = { ...newBlock(key, roles), rot: b.rot }; });
  selParts.clear(); saveDesign(); renderDesigner();
}

function initDesignerUI() {
  $('dz-quilt').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / r.width * design.cols), rr = Math.floor((e.clientY - r.top) / r.height * design.rows);
    if (c < 0 || rr < 0 || c >= design.cols || rr >= design.rows) return;
    const bi = rr * design.cols + c;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { if (selBlocks.has(bi) && selBlocks.size > 1) selBlocks.delete(bi); else selBlocks.add(bi); }
    else selBlocks = new Set([bi]);
    if (selBlocks.has(bi)) focusBlock = bi; else focusBlock = [...selBlocks][0];
    // keep part selection only while the pattern stays the same
    if (design.blocks[focusBlock].pattern !== design.blocks[bi].pattern) selParts.clear();
    renderDesigner();
  });
  $('dz-block').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 260, y = (e.clientY - r.top) / r.height * 260;
    const polys = blockPolys(design.blocks[focusBlock], 0, 0, 260, 260);
    const hit = polys.findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { selParts.has(hit) ? selParts.delete(hit) : selParts.add(hit); }
    else if (selParts.size === 1 && selParts.has(hit)) selParts.clear();
    else selParts = new Set([hit]);
    drawPartsEditor();
  });
  $('dz-allparts').addEventListener('click', () => { selParts = new Set(partsOf(design.blocks[focusBlock].pattern).map((_, i) => i)); drawPartsEditor(); });
  $('dz-sameparts').addEventListener('click', () => {
    const b = design.blocks[focusBlock], ref = selParts.size ? b.fabrics[[...selParts][0]] : null;
    if (ref === null) { $('dz-parts-info').textContent = 'Select one part first; this then selects every part with the same fabric.'; return; }
    selParts = new Set(b.fabrics.map((f, i) => f === ref ? i : -1).filter(i => i >= 0)); drawPartsEditor();
  });
  $('dz-noparts').addEventListener('click', () => { selParts.clear(); drawPartsEditor(); });
  $('dz-allblocks').addEventListener('click', () => { selBlocks = new Set(design.blocks.map((_, i) => i)); drawDesignerCanvas(); drawPartsEditor(); });
  $('dz-sameblocks').addEventListener('click', () => {
    const p = design.blocks[focusBlock].pattern;
    selBlocks = new Set(design.blocks.map((b, i) => b.pattern === p ? i : -1).filter(i => i >= 0)); drawDesignerCanvas(); drawPartsEditor();
  });
  $('dz-patterns').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPattern(b.dataset.p); });
  $('dz-fabrics').addEventListener('click', e => { const b = e.target.closest('button'); if (b) applyFabric(b.dataset.f); });
  $('dz-rot').addEventListener('click', () => { eachSelected(b => { b.rot = (b.rot + 1) % 4; }); saveDesign(); renderDesigner(); });
  $('dz-copy').addEventListener('click', () => {
    const src = design.blocks[focusBlock];
    eachSelected((b, bi) => { if (bi !== focusBlock) design.blocks[bi] = JSON.parse(JSON.stringify(src)); });
    saveDesign(); drawDesignerCanvas();
  });
  const sizeChange = () => resizeDesign(+$('dz-cols').value, +$('dz-rows').value);
  $('dz-cols').addEventListener('change', sizeChange); $('dz-rows').addEventListener('change', sizeChange);
  for (const b of document.querySelectorAll('[data-step]')) b.addEventListener('click', () => {
    const [which, d] = b.dataset.step.split(':');
    resizeDesign(design.cols + (which === 'c' ? +d : 0), design.rows + (which === 'r' ? +d : 0));
  });
  $('dz-reset').addEventListener('click', () => {
    if ($('dz-reset').dataset.armed !== '1') { $('dz-reset').dataset.armed = '1'; $('dz-reset').textContent = 'Click again to start over'; setTimeout(() => { $('dz-reset').dataset.armed = ''; $('dz-reset').textContent = 'Start over'; }, 3000); return; }
    design = defaultDesign(); selBlocks = new Set([0]); focusBlock = 0; selParts.clear(); saveDesign(); renderDesigner();
    $('dz-reset').dataset.armed = ''; $('dz-reset').textContent = 'Start over';
  });
  $('dz-upload').addEventListener('change', async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    for (const f of files) {
      const im = await loadImage(URL.createObjectURL(f));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      fabricLib.push({ id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name.replace(/\.[^.]+$/, ''), canvas: c, cm: +$('dz-cm').value });
    }
    e.target.value = ''; drawFabricPalette();
    $('dz-fabnote').textContent = `${files.length} photo${files.length === 1 ? '' : 's'} added. Your photos are kept only until you reload the page.`;
  });
  const cmOut2 = () => { $('dz-cm-o').textContent = $('dz-cm').value + ' cm'; };
  $('dz-cm').addEventListener('input', cmOut2); cmOut2();
  $('dz-simulate').addEventListener('click', simulateDesign);
  new ResizeObserver(() => { if (state.page === 'design') drawDesignerCanvas(); }).observe($('dz-quilt').parentElement);
}

// ---- design -> simulation
// Colour: the design drawn at 2048 px with real-scale fabric. Quilting: the
// quilt is stitched in the ditch along every seam of the design, so the
// batting puffs between them; that relief becomes a normal map.
const designNormalCanvas = document.createElement('canvas'); designNormalCanvas.width = designNormalCanvas.height = 1024;
const designNormalTex = new THREE.CanvasTexture(designNormalCanvas);
designNormalTex.colorSpace = THREE.NoColorSpace; designNormalTex.anisotropy = maxAniso;
function strokeSeams(g, W) {
  const d = design, bw = W / d.cols, bh = W / d.rows;
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++)
    for (const poly of blockPolys(d.blocks[r * d.cols + c], c * bw, r * bh, bw, bh)) { pathPoly(g, poly); g.stroke(); }
}
function buildDesignMaps() {
  const g = patchCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  drawQuilt(g, PW, PW);
  // shadow in the seams
  const cav = document.createElement('canvas'); cav.width = cav.height = PW; const cg = cav.getContext('2d');
  cg.fillStyle = '#fff'; cg.fillRect(0, 0, PW, PW);
  cg.filter = 'blur(3px)'; cg.strokeStyle = 'rgba(0,0,0,.55)'; cg.lineWidth = 5; strokeSeams(cg, PW);
  g.globalCompositeOperation = 'multiply'; g.drawImage(cav, 0, 0); g.globalCompositeOperation = 'source-over';
  // binding: ½-inch indigo cotton
  const bw = PW * (1.27 / (SIZE * 100));
  g.save(); g.beginPath(); g.rect(0, 0, PW, PW); g.rect(bw, bw, PW - 2 * bw, PW - 2 * bw); g.clip('evenodd');
  g.fillStyle = fabricFill(g, fabricById('b1'), PW / (SIZE * 100), 3); g.fillRect(0, 0, PW, PW); g.restore();
  patchTex.needsUpdate = true;
  // quilting relief -> normal map
  const N = designNormalCanvas.width, hc = document.createElement('canvas'); hc.width = hc.height = N; const hg = hc.getContext('2d');
  hg.fillStyle = '#fff'; hg.fillRect(0, 0, N, N);
  hg.filter = 'blur(6px)'; hg.strokeStyle = '#000'; hg.lineWidth = 7; strokeSeams(hg, N);
  hg.filter = 'none'; hg.lineWidth = Math.max(4, N * 0.012); hg.strokeStyle = '#999'; hg.strokeRect(0, 0, N, N);
  const h = hg.getImageData(0, 0, N, N).data, out = new ImageData(N, N), o = out.data, s = 6 / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xm = Math.max(0, x - 1), xp = Math.min(N - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(N - 1, y + 1);
    const gx = (h[4 * (y * N + xp)] - h[4 * (y * N + xm)]) * s, gy = -(h[4 * (yp * N + x)] - h[4 * (ym * N + x)]) * s;
    const l = Math.hypot(gx, gy, 1), i = 4 * (y * N + x);
    o[i] = (-gx / l * 0.5 + 0.5) * 255; o[i + 1] = (-gy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  designNormalCanvas.getContext('2d').putImageData(out, 0, 0);
  designNormalTex.needsUpdate = true;
  QM.top.normalMap = designNormalTex; QM.top.needsUpdate = true;
  if (pathTracer && state.view === 'render') pathTracer.updateMaterials();
}
function simulateDesign() {
  buildDesignMaps();
  state.usingDesign = true;
  $('fabnote').textContent = `Your design: ${design.cols} × ${design.rows} blocks.`;
  $('fabreset').hidden = false;
  showPage('sim');
  restart();
}

// ---- pages
function showPage(p) {
  state.page = p;
  $('page-sim').hidden = p !== 'sim'; $('page-design').hidden = p !== 'design';
  for (const b of $('tabs').children) b.setAttribute('aria-selected', String(b.dataset.page === p));
  if (p === 'design') {
    (async () => {
      await initFabricLib();
      if (!design) { design = loadDesign(); selBlocks = new Set([0]); focusBlock = 0; activeFabric = 'b0'; }
      drawFabricPalette(); renderDesigner();
    })();
  } else resize();
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showPage(b.dataset.page); });
initDesignerUI();
