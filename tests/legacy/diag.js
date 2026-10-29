const { Cloth } = require('./physics.js');
const BED = require('./bed.js');
function cyl(n, R, axis) {
  const c = new Cloth({ nx: n, ny: n, width: 2.3, length: 2.3 });
  for (let i = 0; i < c.N; i++) {
    const u = axis === 'x' ? c.pos[3*i] : c.pos[3*i+2];
    const th = u / R;
    if (axis === 'x') { c.pos[3*i] = R*Math.sin(th); } else { c.pos[3*i+2] = R*Math.sin(th); }
    c.pos[3*i+1] = R*(1-Math.cos(th));
  }
  return c.energies().bend / (0.5*c.params.B*2.3*2.3/(R*R));
}
for (const n of [20, 44, 80]) for (const R of [0.3, 1.0]) console.log('n',n,'R',R,'ratio x',cyl(n,R,'x').toFixed(4),'z',cyl(n,R,'z').toFixed(4));

// profile parts
const c = new Cloth({ nx: 44, ny: 44, width: 2.3, length: 2.3 });
c.colliders = BED; c.layFlat(0, 1.12, 0.2);
for (let f=0; f<60; f++) c.step(1/60, 20);
const parts = { forces: ()=>c._forces(), membrane: ()=>c._solveMembrane(1/1200), contacts: ()=>c._solveContacts() };
for (const [k, fn] of Object.entries(parts)) { const t=process.hrtime.bigint(); for (let i=0;i<400;i++) fn(); console.log(k, (Number(process.hrtime.bigint()-t)/1e6/400*20).toFixed(2), 'ms per frame'); }
// settle diagnostics with variations
function run(label, mod) {
  const c = new Cloth({ nx: 44, ny: 44, width: 2.3, length: 2.3 });
  c.colliders = BED; mod && mod(c); c.layFlat(0, 1.12, 0.2);
  const t = Date.now();
  for (let f = 0; f < 60*5; f++) c.step(1/60, 20);
  const e = c.energies();
  // where is KE?
  let maxv=0, mi=0; for (let i=0;i<c.N;i++){const v=Math.hypot(c.vel[3*i],c.vel[3*i+1],c.vel[3*i+2]); if(v>maxv){maxv=v;mi=i;}}
  console.log(label.padEnd(18), 'KE', e.ke.toExponential(2), 'maxStrain', (e.maxStrain*100).toFixed(2)+'%', 'maxv', maxv.toFixed(3), 'at', c.gx[mi], c.gy[mi], c.pos.slice(3*mi,3*mi+3).map(v=>v.toFixed(2)).join(','), ((Date.now()-t)/300).toFixed(1)+'ms/f');
}
run('baseline');
run('no self', c => c.selfCollision = false);
run('no friction', c => c.setParams({muS:0, muK:0}));
run('no pillows', c => { c.colliders = BED.map(b => ({...b, enabled: !b.name.startsWith('pillow')})); });
run('zeta .2', c => c.setParams({zeta:0.2}));
