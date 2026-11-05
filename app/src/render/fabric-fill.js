// Fabric fills for canvas drawing: a print at its real scale, and fussy-cut pieces (the painting itself is shared with
// the phone app: shared/src/quilt-paint.js).
import '../designer/dispatch.js'; // load order: runs after designer/dispatch
import { fabricById } from '../designer/fabric-library.js';
import { fabricFill, pieceFillWith } from '@quilt/shared/quilt-paint.js';

// the fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print
const pieceFill = (g, b, pi, poly, pxPerCm, seed, turn = 0) =>
  pieceFillWith(fabricById, g, b, pi, poly, pxPerCm, seed, turn);

export { fabricFill, pieceFill };
