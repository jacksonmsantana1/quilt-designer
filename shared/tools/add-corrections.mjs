// Learns from the corrections made in the review page (drawing-review.mjs): adds the labelled cells to
// shared/data/cell-samples.json, trains the small network again, and says how it did on these cells BEFORE learning
// them (that is the honest measure of progress) and prints each corrected block in the grid notation.
//   node shared/tools/add-corrections.mjs corrections.json        (the file the page downloads, or what it copied)
// Cells of a block marked "Looks right" are all kept; of any other block only the cells you changed (the rest were
// not checked by you, so they are not trusted).
import fs from 'node:fs';
import { predict, toJSON, train } from '../src/cell-net.js';
import { ruleShape } from '../src/drawing-reader.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node shared/tools/add-corrections.mjs corrections.json');
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(file, 'utf8'));
const dir = new URL('../data/', import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL('cell-samples.json', dir), 'utf8'));
let net = null;
try {
  net = JSON.parse(fs.readFileSync(new URL('cell-net.json', dir), 'utf8'));
} catch (e) {}

const fresh = [];
for (const b of input.blocks) {
  const keep = b.cells.filter(c => b.confirmed || c.changed);
  for (const c of keep)
    fresh.push({
      block: b.name,
      r: c.r,
      c: c.c,
      label: c.shape,
      rule: ruleShape(c.feats, c.size || 30),
      size: c.size,
      patch: c.patch,
      feats: c.feats,
    });
  const chg = b.changed.length;
  console.log(
    `\n${b.name} (${b.n} × ${b.n})${b.confirmed ? ' ✓ marked right' : ''}${chg ? `, ${chg} cell${chg > 1 ? 's' : ''} changed` : ''}${b.note ? `\n  note: ${b.note}` : ''}\n${b.rows.replace(/^/gm, '      ')}`,
  );
}
if (fresh.length) {
  const rule = fresh.filter(s => s.rule === s.label).length;
  const learned = net ? fresh.filter(s => predict(net, s).shape === s.label).length : null;
  console.log(
    `\nbefore learning these ${fresh.length} cells: seam rules right on ${rule}${learned == null ? '' : `, network right on ${learned}`}`,
  );
  // replace what is already known for a block with the new reading of it
  const names = new Set(fresh.map(s => s.block));
  data.samples = data.samples.filter(s => !names.has(s.block)).concat(fresh);
  fs.writeFileSync(new URL('cell-samples.json', dir), JSON.stringify(data));
  const model = train(data.samples, { hidden: 24, epochs: 30, lr: 0.03 });
  fs.writeFileSync(new URL('cell-net.json', dir), toJSON(model));
  console.log(
    `now ${data.samples.length} labelled cells in ${new Set(data.samples.map(s => s.block)).size} blocks; network trained again`,
  );
}
