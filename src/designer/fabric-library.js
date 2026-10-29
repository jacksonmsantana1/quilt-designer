// The fabric library used by the designer.
import '../sim/controls.js'; // load order: runs after sim/controls

import { BUNDLED, prepareSwatch } from '../sim/patchwork.js';

// ---- fabric library (bundled scans + the user's photos)
const fabricLib = []; // {id, name, canvas, cm}
const fabricById = id => fabricLib.find(f => f.id === id) || fabricLib[0];
async function initFabricLib() {
  if (fabricLib.length) return;
  const preps = await Promise.all(BUNDLED.map(prepareSwatch));
  preps.forEach((s, i) =>
    fabricLib.push({ id: 'b' + i, name: s.name, canvas: s.canvas, cm: s.cm, print: !s.tint && !/linen/i.test(s.name) }),
  );
}
const ROLE_DEFAULT = ['b0', 'b1', 'b3']; // cream, indigo, mustard

export { ROLE_DEFAULT, fabricById, fabricLib, initFabricLib };
