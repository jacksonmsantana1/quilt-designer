// The quilt on a table: the cloth as drawn must not cut through the table top. The cloth's nodes are ~6 cm apart and
// the top is 4 cm thick, so a straight stretch of cloth between two nodes used to pass through its edge, and the wood
// showed through the quilt all round the table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const ClothSim = createRequire(import.meta.url)('../../physics.js');

test('the quilt drawn over a table never cuts through the table top', () => {
  const sim = new ClothSim.SimController({
    n: 40,
    width: 2.29,
    length: 2.29,
    bed: { kind: 'table', w: 0.9, l: 1.8, h: 0.75 },
    scenario: 'drop',
  });
  for (let f = 0; f < 60 * 4; f++) sim.frame(1 / 60);
  const c = sim.cloth,
    top = c.colliders.find(b => b.name === 'tabletop'),
    n = [0, 0, 0];
  // the deepest point a quarter, half or three quarters along any edge of the cloth goes into the top (cm)
  const deepest = x => {
    let worst = 0;
    for (let e = 0; e < c.cA.length; e++) {
      const a = 3 * c.cA[e],
        b = 3 * c.cB[e];
      for (const t of [0.25, 0.5, 0.75]) {
        const p = [0, 1, 2].map(k => x[a + k] + (x[b + k] - x[a + k]) * t);
        worst = Math.min(worst, ClothSim.roundedBoxSDF(p[0], p[1], p[2], top, n));
      }
    }
    return worst * 100;
  };
  assert.ok(deepest(c.pos) < -0.3, 'the physics alone lets the cloth between nodes into the edge (the old bug)');
  assert.ok(deepest(c.drawnPositions()) > -0.01, 'drawn, the cloth stays out of the table top');
});

test('a quilt dropped on a couch settles over it, and nothing drawn goes through it', () => {
  for (const seats of [1, 2, 3]) {
    const bed = { kind: 'couch', w: [0.95, 1.5, 2.1][seats - 1], l: 0.9, seats };
    const sim = new ClothSim.SimController({ n: 40, width: 2.29, length: 2.29, bed, scenario: 'drop' });
    const parts = sim.cloth.colliders.map(b => b.name);
    assert.equal(parts.filter(n => n.startsWith('couchSeat')).length, seats, 'one seat cushion per seat');
    for (const n of ['couchbase', 'couchback', 'couchArmL', 'couchArmR', 'leg0']) assert.ok(parts.includes(n), n);
    for (let f = 0; f < 60 * 4; f++) sim.frame(1 / 60);
    assert.ok(sim.cloth.energies().ke < 0.01, `${seats} seats: the quilt comes to rest`);
    const c = sim.cloth,
      x = c.drawnPositions(),
      n = [0, 0, 0];
    let deepest = 0,
      top = 0;
    for (let i = 0; i < c.N; i++) top = Math.max(top, x[3 * i + 1]);
    for (let e = 0; e < c.cA.length; e++)
      for (const b of c.colliders)
        for (const t of [0.25, 0.5, 0.75]) {
          const p = [0, 1, 2].map(k => x[3 * c.cA[e] + k] + (x[3 * c.cB[e] + k] - x[3 * c.cA[e] + k]) * t);
          deepest = Math.min(deepest, ClothSim.roundedBoxSDF(p[0], p[1], p[2], b, n));
        }
    assert.ok(deepest > -0.002, `${seats} seats: drawn, the quilt stays out of the couch`);
    assert.ok(top > ClothSim.COUCH.back && top < ClothSim.COUCH.back + 0.05, `${seats} seats: it lies over the back`);
  }
});
