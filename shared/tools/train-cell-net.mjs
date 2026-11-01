// Trains the small cell network (src/cell-net.js) on the labelled cells in shared/data/cell-samples.json and says how
// well it does, honestly: leave-one-block-out (the network is trained on every block but one, and tested on the block
// it never saw), against the seam rules alone.
//   node shared/tools/train-cell-net.mjs            test, then train on everything and write shared/data/cell-net.json
//   node shared/tools/train-cell-net.mjs --no-test  just train and write
import fs from 'node:fs';
import { predict, toJSON, train } from '../src/cell-net.js';

const dir = new URL('../data/', import.meta.url);
const { samples } = JSON.parse(fs.readFileSync(new URL('cell-samples.json', dir), 'utf8'));
const blocks = [...new Set(samples.map(s => s.block))];
const opts = { hidden: 24, epochs: 30, lr: 0.03 };

if (!process.argv.includes('--no-test')) {
  const TAUS = [0.5, 0.7, 0.85, 0.95];
  let rule = 0,
    net = 0;
  const mixed = TAUS.map(() => 0);
  console.log(`${samples.length} cells in ${blocks.length} blocks; one block held out at a time`);
  for (const b of blocks) {
    const trainSet = samples.filter(s => s.block !== b),
      test = samples.filter(s => s.block === b),
      model = train(trainSet, opts);
    const r = test.filter(s => s.rule === s.label).length,
      n = test.filter(s => predict(model, s).shape === s.label).length;
    rule += r;
    net += n;
    // together: the network where it is sure (its top probability above tau), the seam rules where it is not
    TAUS.forEach((tau, i) => {
      mixed[i] += test.filter(s => {
        const p = predict(model, s);
        return (p.p > tau ? p.shape : s.rule) === s.label;
      }).length;
    });
    console.log(`  ${b.padEnd(20)} rules ${r}/${test.length}   network ${n}/${test.length}`);
  }
  console.log(`seam rules alone: ${rule}/${samples.length} = ${((100 * rule) / samples.length).toFixed(1)}%`);
  console.log(`network (unseen blocks): ${net}/${samples.length} = ${((100 * net) / samples.length).toFixed(1)}%`);
  TAUS.forEach((tau, i) =>
    console.log(
      `network where sure (> ${tau}), rules elsewhere: ${mixed[i]}/${samples.length} = ${((100 * mixed[i]) / samples.length).toFixed(1)}%`,
    ),
  );
}
const model = train(samples, opts);
fs.writeFileSync(new URL('cell-net.json', dir), toJSON(model));
console.log('wrote shared/data/cell-net.json');
