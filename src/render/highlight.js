// Dimming every piece but the ones being pointed at (Cutting guide).
import '../sim/config.js';          // load order: runs after sim/config
import { shared } from '../core/shared.js';

// Cutting guide: the cutting-list line being hovered (A1.1, AS.1, CB2.1 ...) as a test on each drawn piece;
// matching pieces stay bright, all others dim. null = nothing hovered.
shared.fabHi = null;
const FAB_DIM = 'rgba(236,239,244,.8)';
function dimUnlessHi(g, info) { if (shared.fabHi && !shared.fabHi(info)) { const f = g.fillStyle; g.fillStyle = FAB_DIM; g.fill(); g.fillStyle = f; } }

export { dimUnlessHi };
