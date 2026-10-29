// Plain-data designs for the unit tests (no browser, no storage).
import { partsOf } from '@quilt/shared/patterns.js';
export const newBlockData = (pattern = 'plain', fabric = 'b0', extra = {}) => ({
  pattern,
  rot: 0,
  fabrics: partsOf(pattern).map(() => fabric),
  ...extra,
});
export function grid(cols, rows, { blockMm = 100, pattern = 'plain', fabric = 'b0', ...rest } = {}) {
  return {
    cols,
    rows,
    blockMm,
    backFabric: 'b0',
    blocks: Array.from({ length: cols * rows }, () => newBlockData(pattern, fabric)),
    ...rest,
  };
}
