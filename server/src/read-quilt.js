// readDesign for the server. Reading a quilt makes its drawn blocks known as patterns, for the whole program: right
// in a browser, which needs them to draw the quilt, but a server reading everyone's quilts would keep them all in
// memory for as long as it runs. It only checks a quilt and stores it, so it forgets them straight after.
import { forgetDrawn } from '@quilt/shared/drawn-blocks.js';
import { readDesign } from '@quilt/shared/format.js';

/** @param {any} raw */
export function readQuilt(raw) {
  try {
    return readDesign(raw);
  } finally {
    forgetDrawn();
  }
}
