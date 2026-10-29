const { SimController } = require('./physics.js');
const P = {
  down: {rhoA:0.40, E:2000, G:40, B:1.2e-3, muS:0.45, muK:0.38, Cd:1.3, zeta:0.08, thickness:0.040},
  wool: {rhoA:0.75, E:1500, G:30, B:8e-5, muS:0.70, muK:0.60, Cd:1.2, zeta:0.05, thickness:0.008},
  silk: {rhoA:0.12, E:1000, G:10, B:3e-6, muS:0.30, muK:0.25, Cd:1.2, zeta:0.04, thickness:0.002},
};
for (const [k, p] of Object.entries(P)) for (const sc of ['drop','spread']) {
  const sim = new SimController({ n: 40, scenario: sc, params: p });
  let st; for (let f=0; f<480; f++) { sim.frame(1/60); if (f%10===0) st = sim.stats(); }
  console.log(k.padEnd(5), sc.padEnd(7), 'rest', st.restAt && st.restAt.toFixed(2), 'KE', st.ke.toExponential(1), 'strain', (st.maxStrain*100).toFixed(2)+'%', 'NaN', sim.cloth.pos.some(Number.isNaN), 'bendLen', (st.bendLen*100).toFixed(1)+'cm');
}
// serve smoke test
const { serve } = require('./physics.js');
const port = { postMessage(m) { if (m.stats && !this.done) { this.done = true; console.log('serve ok, N =', m.pos.length/3, 'stats keys', Object.keys(m.stats).length); process.exit(0); } } };
serve(port); port.onmessage({ data: { type: 'init', opt: { n: 40 } } });
