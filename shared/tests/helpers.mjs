// Small helpers for the unit tests.
import { newBlockData } from './fixtures.mjs';
export const area = poly => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i],
      [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};
export const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
// a polygon as a set of rounded points, so two polygons compare equal whatever vertex they start from
export const shapeKey = poly =>
  poly
    .map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)
    .sort()
    .join(' ');
export { newBlockData };
