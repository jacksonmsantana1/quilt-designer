// Sample designs added to My designs.
import './my-designs.js';          // load order: runs after mine/my-designs
import { shared } from '../core/shared.js';
import { newBlock } from '../designer/design-state.js';
import { normalizeSpans } from '../core/geometry.js';
import { symApply } from '../designer/symmetry.js';
import { MINE_KEY, mine } from './my-designs.js';

// A medallion sampler in the style of a quilt the user shared: a large eight-point star in the centre, rings of
// nine-patches, half-square triangles, flying geese, sawtooth stars and economy blocks mirrored eight ways,
// a narrow chocolate border and a wide floral one. It is laid out once, in the top-left eighth, and mirrored.
function medallionDesign() {
  const N = 14, CR = 'b0', MI = 'b9', CH = 'b10', WH = 'b11', MU = 'b3', FL = 'b12';
  const d = { cols: N, rows: N, blockMm: 140, backFabric: CR, sym: 'kal', blocks: [],
    borders: [{ type: 'plain', mm: 25, fabrics: [CH, CH, CH] }, { type: 'plain', mm: 150, fabrics: [FL, FL, FL] }] };
  for (let i = 0; i < N * N; i++) d.blocks.push(newBlock('plain', [WH, WH, WH]));
  const put = (c, r, pattern, roles, rot = 0, extra = {}) => { d.blocks[r * N + c] = { ...newBlock(pattern, roles), rot, ...extra }; };
  // the top-left eighth (c >= r); diagonal cells hold blocks that mirror onto themselves
  put(0, 0, 'nine', [CR, CH, CH]);        put(1, 0, 'nine', [CR, CH, CH]);       put(2, 0, 'hst', [WH, MI, MI], 1);
  put(3, 0, 'geese', [WH, CH, CH], 2);    put(4, 0, 'sawstar', [WH, MU, FL]);    put(5, 0, 'hst', [WH, CH, CH], 0);
  put(6, 0, 'economy', [WH, CH, FL]);
  put(1, 1, 'nine', [WH, MI, MI]);        put(2, 1, 'nine', [CR, CH, CH]);       put(3, 1, 'hst', [WH, CH, CH], 0);
  put(4, 1, 'hst', [WH, MI, MI], 1);      put(5, 1, 'sawstar', [WH, CH, MI]);    put(6, 1, 'economy', [MI, CH, FL]);
  put(2, 2, 'hst', [WH, MI, MI], 1);      put(3, 2, 'nine', [CR, CH, CH]);       put(4, 2, 'nine', [WH, MU, MU]);
  put(5, 2, 'hst', [MI, WH, WH], 1);      put(6, 2, 'economy', [WH, CH, FL]);
  put(3, 3, 'sawstar', [WH, CH, MI]);     put(4, 3, 'nine', [WH, MU, MU]);       put(5, 3, 'geese', [WH, CH, CH], 1);
  put(6, 3, 'hst', [WH, MI, MI], 0);
  put(4, 4, 'sawstar', [WH, CH, CH]);     put(5, 4, 'hst', [WH, CH, CH], 3);     put(6, 4, 'geese', [WH, CH, MI], 2);
  // the large centre star: 4 × 4 cells
  put(5, 5, 'eightstar', [WH, CH, MU], 0, { span: 4 });
  const keep = shared.design; shared.design = d;
  try { normalizeSpans(d); const src = []; for (let r = 0; r < 7; r++) for (let c = r; c < 7; c++) src.push(r * N + c); symApply(src); normalizeSpans(d); }
  finally { shared.design = keep; }
  return d;
}
// The quilt in the user's photo, laid out on a 15 × 15 grid: the top-left eighth is entered cell by cell
// (c >= r) and mirrored eight ways; the 3 × 3 star sits in the middle.
function photoMedallion() {
  const N = 15, WH = 'b11', MI = 'b9', CH = 'b10', MU = 'b3', FL = 'b12', MO = 'b13', TE = 'b14', CR = 'b0';
  const d = { cols: N, rows: N, blockMm: 102, backFabric: CR, sym: 'kal', quilting: 'fans', blocks: [],
    borders: [{ type: 'plain', mm: 20, fabrics: [CH, CH, CH] }, { type: 'plain', mm: 140, fabrics: [FL, FL, FL] }] };
  for (let i = 0; i < N * N; i++) d.blocks.push(newBlock('plain', [WH, WH, WH]));
  const put = (c, r, pattern, roles, rot = 0, extra = {}) => { d.blocks[r * N + c] = { ...newBlock(pattern, roles), rot, ...extra }; };
  const chain = [WH, MO, MO], dark9 = [WH, CH, CH], gold9 = [WH, MU, MU];
  const mintH = [WH, MI, MI], darkH = [WH, CH, CH];
  // row 0
  put(0, 0, 'dnine', chain);  put(1, 0, 'nine', chain);        put(2, 0, 'hst', mintH, 0);  put(3, 0, 'hst', darkH, 0);
  put(4, 0, 'sawstar', [WH, MU, FL]);   put(5, 0, 'hst', mintH, 1); put(6, 0, 'hst', darkH, 1);   put(7, 0, 'economy', [MI, TE, CH]);
  // row 1
  put(1, 1, 'nine', chain);   put(2, 1, 'nine', chain);        put(3, 1, 'hst', mintH, 0);  put(4, 1, 'hst', darkH, 0);
  put(5, 1, 'hst', darkH, 1); put(6, 1, 'hst', mintH, 1);      put(7, 1, 'economy', [MI, TE, CH]);
  // row 2
  put(2, 2, 'nine', chain);   put(3, 2, 'nine', dark9);        put(4, 2, 'nine', dark9);    put(5, 2, 'sawstar', [WH, CH, TE]);
  put(6, 2, 'hst', mintH, 0); put(7, 2, 'economy', [MI, TE, CH]);
  // row 3
  put(3, 3, 'nine', chain);   put(4, 3, 'hst', mintH, 0);      put(5, 3, 'nine', gold9);    put(6, 3, 'sawstar', [WH, CH, MO]);
  put(7, 3, 'sawstar', [WH, CH, MO]);
  // row 4
  put(4, 4, 'sawstar', [WH, CH, CH]); put(5, 4, 'hst', mintH, 0); put(6, 4, 'geese', [WH, MO, MO], 2); put(7, 4, 'geese', [WH, MO, MO], 2);
  // row 5
  put(5, 5, 'sqsq', [WH, MI, MI]); put(6, 5, 'hst', [WH, MI, MI], 1); put(7, 5, 'plain', [WH, WH, WH]);
  // the centre star: 3 × 3 cells, a floral centre
  put(6, 6, 'eightstar', [WH, CH, FL], 0, { span: 3 });
  const keep = shared.design; shared.design = d;
  try { normalizeSpans(d); const src = []; for (let r = 0; r < 8; r++) for (let c = r; c < 8; c++) src.push(r * N + c); symApply(src); normalizeSpans(d); }
  finally { shared.design = keep; }
  delete d.sym;            // laid out; mirroring stays off until the user turns it on
  return d;
}
// add it to My designs once
try {
  if (!localStorage.getItem('quilt-medallion-seeded.v1')) {
    const now = Date.now();
    mine.push({ id: 'qmedallion', name: 'Medallion sampler', d: JSON.stringify(medallionDesign()), created: now, updated: now });
    localStorage.setItem(MINE_KEY, JSON.stringify(mine)); localStorage.setItem('quilt-medallion-seeded.v1', '1');
  }
  if (!localStorage.getItem('quilt-photo-seeded.v1')) {
    const now = Date.now() + 1;
    mine.push({ id: 'qphoto', name: 'Medallion from the photo', d: JSON.stringify(photoMedallion()), created: now, updated: now });
    localStorage.setItem(MINE_KEY, JSON.stringify(mine)); localStorage.setItem('quilt-photo-seeded.v1', '1');
  }
} catch (e) {}
