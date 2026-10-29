const { Cloth } = require('./physics.js');
const BED = require('./bed.js');
const c = new Cloth({ nx: 44, ny: 44, width: 2.3, length: 2.3 });
c.colliders = BED; c.layFlat(0, 1.12, 0.2);
for (let f = 0; f < 60*4; f++) c.step(1/60, 20);
const i = 17*44 + 0;
const rows=[];
const orig = c._substep.bind(c);
for (let s=0;s<40;s++){ c._substep(1/1200); rows.push([c.vel[3*i],c.vel[3*i+1],c.vel[3*i+2]].map(v=>v.toFixed(3)).join(' ')+'  y='+c.pos[3*i+1].toFixed(4)+' x='+c.pos[3*i].toFixed(4)+' contact='+c.inContact[i]); }
console.log(rows.join('\n'));
// forces on that particle
c._forces(); console.log('force', c.frc.slice(3*i,3*i+3), 'mass', c.mass[i], 'w', c.mass[i]*9.81);
