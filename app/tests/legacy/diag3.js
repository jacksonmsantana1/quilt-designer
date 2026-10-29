const { Cloth } = require('./physics.js');
const BED = require('./bed.js');
for (const sub of [20, 60]) {
  const c = new Cloth({ nx: 44, ny: 44, width: 2.3, length: 2.3 });
  c.colliders = BED; c.selfCollision = false; c.layFlat(0, 1.12, 0.2);
  for (let f = 0; f < 60*4; f++) c.step(1/60, sub);
  const list = [];
  for (let k = 0; k < c.cA.length; k++) if (c.cT[k] === 0) {
    const a = 3*c.cA[k], b = 3*c.cB[k];
    const L = Math.hypot(c.pos[b]-c.pos[a], c.pos[b+1]-c.pos[a+1], c.pos[b+2]-c.pos[a+2]);
    list.push([(L-c.cRest[k])/c.cRest[k], c.cA[k]]);
  }
  list.sort((p,q)=>q[0]-p[0]);
  const hist = [0,0,0,0]; for (const [s] of list) hist[s<0.002?0:s<0.005?1:s<0.01?2:3]++;
  console.log('substeps', sub, 'hist <0.2% <0.5% <1% >1%:', hist.join(' '));
  for (const [s,i] of list.slice(0,4)) console.log('  ', (s*100).toFixed(2)+'%', 'grid', c.gx[i], c.gy[i], 'pos', [0,1,2].map(d=>c.pos[3*i+d].toFixed(3)).join(','), 'contact', c.inContact[i]);
}
