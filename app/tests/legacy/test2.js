const { SimController } = require('./physics.js');
for (const sc of ['drop', 'spread', 'corner']) {
  const sim = new SimController({ n: 40, scenario: sc });
  const t0 = Date.now(); let last;
  for (let f = 0; f < 60 * 9; f++) {
    sim.frame(1/60);
    if (f % 10 === 0) last = sim.stats();
    if (f % 90 === 0) console.log(`  ${sc} t=${last.t.toFixed(1)} KE=${last.ke.toFixed(3)} contact=${(last.contact*100).toFixed(0)}% strain=${(last.maxStrain*100).toFixed(2)}% diss=${last.dissipated===null?'-':last.dissipated.toFixed(2)} held=${last.held}`);
  }
  const c = sim.cloth; let onBed = 0;
  for (let i = 0; i < c.N; i++) if (c.pos[3*i+1] > 0.6) onBed++;
  console.log(sc, 'rest at', last.restAt && last.restAt.toFixed(2), 's; on top of bed', (onBed/c.N*100).toFixed(0)+'%;', ((Date.now()-t0)/540).toFixed(1), 'ms/frame; NaN', c.pos.some(Number.isNaN));
}
{ const sim = new SimController({ n: 40, scenario: 'spread' }); for (let f=0;f<540;f++) sim.frame(1/60);
  const c = sim.cloth; let zh=0, zf=0; for (let i=0;i<c.nx;i++){ zh+=c.pos[3*i+2]; zf+=c.pos[3*((c.ny-1)*c.nx+i)+2]; }
  console.log('spread: head edge mean z', (zh/c.nx).toFixed(2), 'foot edge mean z', (zf/c.nx).toFixed(2)); }
