// Link to the cloth physics running in a Web Worker (physics.js).
import '../render/highlight.js';          // load order: runs after render/highlight
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { N, bedM, quilt, state } from './config.js';
import { onSim } from './messages.js';

// ------------------------------------------------------------- simulation
const physSrc = $('physics-src').textContent;
let port = null;
function localPort() {
  // Fallback when Web Workers are unavailable: run on the page's own thread.
  const main = { onmessage: null }, simSide = { onmessage: null };
  simSide.postMessage = (d) => setTimeout(() => main.onmessage && main.onmessage({ data: d }), 0);
  main.postMessage = (d) => setTimeout(() => simSide.onmessage && simSide.onmessage({ data: d }), 0);
  ClothSim.serve(simSide);
  return main;
}
function startSim() {
  try {
    const url = URL.createObjectURL(new Blob([physSrc + '\nClothSim.serve(self);'], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onerror = (e) => { e.preventDefault && e.preventDefault(); if (port === w) { port = localPort(); connect(); } };
    port = w;
  } catch (e) { port = localPort(); }
  connect();
}
function connect() {
  port.onmessage = onSim;
  port.postMessage({ type: 'init', opt: { n: N, scenario: state.scenario, params: state.params, substeps: state.substeps, bed: bedM(), width: quilt.w, length: quilt.l } });
  port.postMessage({ type: 'reset', scenario: state.scenario, dropHeight: state.dropHeight, rot: shared.quiltTurned, pos: dropPosM() });
}
const send = m => port && port.postMessage(m);
// the quilt can be turned a quarter turn on the bed or table before it is dropped (remembered in this browser)
shared.quiltTurned = false;
 try { shared.quiltTurned = localStorage.getItem('quilt-turned.v1') === '1'; } catch (e) {}
// where the quilt's centre is dropped along the long side of the bed or table, mm from its centre (null = the usual spot)
shared.dropPos = null;
const dropPosM = () => (shared.dropPos == null ? null : shared.dropPos / 1000);

export { dropPosM, send, startSim };
