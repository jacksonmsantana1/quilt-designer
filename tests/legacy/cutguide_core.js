// ------------------------------------------------------------- cutting guide core (millimetres)
// Turns the designed quilt into cutting instructions, using standard quilting
// methods. s = seam allowance.
//   squares / rectangles   cut = finished + 2s
//   half-square triangles  cut a square of (finished leg + s(2+sqrt2)) and cut it once on the
//                          diagonal: 2 triangles per square
//   quarter-square tri.    cut a square of (finished long side + s(2+2sqrt2)) and cut it twice
//                          on the diagonal: 4 triangles per square
// Cut sizes round UP to the whole millimetre. Fabric is cut in strips across the
// width of fabric (WOF) and the strips are sub-cut.
const CG = (() => {
  const upmm = x => Math.ceil(x - 1e-6);
  const mm = x => `${Math.round(x)} mm`;
  const close = (a, b) => Math.abs(a - b) < 1e-6;
  const metres = x => `${(Math.ceil(x / 50 - 1e-6) * 0.05).toFixed(2)} m`;   // rounded up to 5 cm

  function classify(poly, W, H, s) {
    const p = poly.map(([u, v]) => [u * W, v * H]);
    if (p.length === 4 && p.every((a, i) => { const b = p[(i + 1) % 4]; return close(a[0], b[0]) || close(a[1], b[1]); })) {
      const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
      const w = upmm(Math.max(...xs) - Math.min(...xs) + 2 * s), h = upmm(Math.max(...ys) - Math.min(...ys) + 2 * s);
      if (w === h) return { kind: 'square', cut: [w, w], yield: 1, how: `square ${mm(w)}` };
      return { kind: 'rect', cut: [Math.max(w, h), Math.min(w, h)], yield: 1, how: `rectangle ${Math.min(w, h)} × ${Math.max(w, h)} mm` };
    }
    if (p.length === 3) {
      const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      for (let k = 0; k < 3; k++) {
        const r = p[k], a = p[(k + 1) % 3], b = p[(k + 2) % 3];
        const ra = [a[0] - r[0], a[1] - r[1]], rb = [b[0] - r[0], b[1] - r[1]];
        if (Math.abs(ra[0] * rb[0] + ra[1] * rb[1]) > 1e-6 * W * W || Math.abs(L(r, a) - L(r, b)) > 1e-6 * W) continue;
        const leg = L(r, a), hyp = L(a, b);
        const legsAxis = (close(ra[0], 0) || close(ra[1], 0)) && (close(rb[0], 0) || close(rb[1], 0));
        if (legsAxis) { const c = upmm(leg + s * (2 + Math.SQRT2)); return { kind: 'hst', cut: [c, c], yield: 2, how: `square ${mm(c)}, cut once on the diagonal ◩` }; }
        const c = upmm(hyp + s * (2 + 2 * Math.SQRT2));
        return { kind: 'qst', cut: [c, c], yield: 4, how: `square ${mm(c)}, cut twice on the diagonals ⊠` };
      }
    }
    // other shapes (e.g. triangles in non-square blocks): cut from a template
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const w = upmm(Math.max(...xs) - Math.min(...xs) + 2 * s), h = upmm(Math.max(...ys) - Math.min(...ys) + 2 * s);
    if (p.length === 3) {
      // draw the template from its finished sides, then add the seam allowance all round
      const sides = [0, 1, 2].map(i => Math.round(Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][1] - p[(i + 1) % 3][1]))).sort((a, b) => a - b);
      return { kind: 'template', cut: [Math.max(w, h), Math.min(w, h), ...sides], yield: 1,
               how: `triangle template, finished sides ${sides.join(' × ')} mm; add ${s} mm seam allowance all round (fits in ${Math.min(w, h)} × ${Math.max(w, h)} mm)` };
    }
    return { kind: 'template', cut: [Math.max(w, h), Math.min(w, h)], yield: 1, how: `template piece in a ${Math.min(w, h)} × ${Math.max(w, h)} mm rectangle, ${s} mm seam allowance added` };
  }

  // strips across the fabric width, sub-cut into pieces; picks the orientation using less length
  function stripPlan(a, b, n, usable) {
    let best = null;
    for (const [h, w] of [[b, a], [a, b]]) {
      if (w > usable) continue;
      const per = Math.floor(usable / w), strips = Math.ceil(n / per);
      const pl = { stripH: h, pieceW: w, per, strips, length: strips * h, widthUsed: Math.min(n, per) * w };
      if (!best || pl.length < best.length) best = pl;
    }
    return best || { stripH: a, pieceW: b, per: 1, strips: n, length: n * a, widthUsed: b };
  }

  /** design {cols, rows, blockMm, blocks:[{pattern, rot, fabrics}]}; opts {blockMm, seam, fabricWidth, selvage, bindingFabric, bindingWidth, partsOf, label} */
  function plan(design, opts) {
    const s = opts.seam, usable = opts.fabricWidth - opts.selvage;
    const blockW = opts.blockMm, blockH = opts.blockMm;          // blocks are square, of the size the user set
    const groups = new Map();
    design.blocks.forEach((b, i) => {
      const key = b.pattern + '|' + b.fabrics.join(',');        // rotation does not change the cutting
      if (!groups.has(key)) groups.set(key, { block: b, count: 0, index: i });
      groups.get(key).count++;
    });
    const letters = new Map();
    const letterOf = id => { if (!letters.has(id)) letters.set(id, String.fromCharCode(65 + letters.size)); return letters.get(id); };
    const blocks = [];
    for (const g of groups.values()) {
      const pieces = opts.partsOf(g.block.pattern).map((p, i) => ({ part: p, fabric: g.block.fabrics[i], letter: letterOf(g.block.fabrics[i]), ...classify(p.poly, blockW, blockH, s) }));
      const rows = new Map();
      for (const pc of pieces) {
        const k = pc.letter + '|' + pc.kind + '|' + pc.cut.join('x');
        if (!rows.has(k)) rows.set(k, { letter: pc.letter, fabric: pc.fabric, kind: pc.kind, cut: pc.cut, yield: pc.yield, how: pc.how, pieces: 0 });
        rows.get(k).pieces++;
      }
      blocks.push({ ...g, label: opts.label(g.block.pattern), pieces, list: [...rows.values()].sort((a, b) => a.letter.localeCompare(b.letter) || b.cut[0] - a.cut[0]) });
    }
    const fabrics = new Map();
    for (const b of blocks) for (const r of b.list) {
      const f = fabrics.get(r.fabric) || { id: r.fabric, letter: r.letter, cuts: new Map() };
      const k = r.kind + '|' + r.cut.join('x');
      const c = f.cuts.get(k) || { kind: r.kind, cut: r.cut, yield: r.yield, how: r.how, pieces: 0 };
      c.pieces += r.pieces * b.count; f.cuts.set(k, c); fabrics.set(r.fabric, f);
    }
    const result = [];
    for (const f of fabrics.values()) {
      let length = 0, oneStrip = true, maxW = 0;
      const cuts = [...f.cuts.values()].map(c => {
        const n = Math.ceil(c.pieces / c.yield), sp = stripPlan(c.cut[0], c.cut[1], n, usable);
        length += sp.length; if (sp.strips > 1) oneStrip = false; maxW = Math.max(maxW, sp.widthUsed);
        return { ...c, toCut: n, strip: sp };
      }).sort((a, b) => b.cut[0] - a.cut[0]);
      result.push({ id: f.id, letter: f.letter, cuts, length, small: oneStrip && cuts.length <= 2 && maxW <= 550 && length <= 500, maxW });
    }
    const QW = blockW * design.cols, QH = blockH * design.rows;
    const bindStrips = Math.ceil((2 * (QW + QH) + 300) / usable);
    let bf = result.find(r => r.id === opts.bindingFabric);
    if (!bf) { bf = { id: opts.bindingFabric, letter: letterOf(opts.bindingFabric), cuts: [], length: 0, small: false, maxW: 0 }; result.push(bf); }
    bf.binding = { strips: bindStrips, width: opts.bindingWidth };
    bf.length += bindStrips * opts.bindingWidth; bf.small = false;
    for (const r of result) {
      const L = Math.ceil(r.length + 50);                    // 50 mm to straighten the edge
      r.requirement = r.small ? `${Math.ceil(r.maxW)} × ${Math.ceil(r.length)} mm` : `${L} mm × WOF`;
      r.buy = r.small ? '' : metres(L);
    }
    result.sort((a, b) => a.letter.localeCompare(b.letter));
    const backW = QW + 200, backH = QH + 200, widths = Math.ceil(Math.min(backW, backH) / usable);
    return {
      blockW, blockH, quiltW: QW, quiltH: QH, seam: s, usable, blocks, fabrics: result,
      backing: { w: backW, h: backH, widths, buy: metres(widths * Math.max(backW, backH)) },
    };
  }
  return { plan, mm, metres };
})();
