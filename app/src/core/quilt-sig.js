// A quilt's fingerprint. Pure.
import { readDesign } from '@quilt/shared/format.js';

/**
 * A fingerprint of a quilt (as read and checked): the same quilt, whatever the order of its keys, gives the same
 * one. A copy from the community keeps its original's, to tell whether it has been changed since; a realistic picture
 * is kept under the fingerprint of the quilt it shows.
 * @param {any} d @returns {string}
 */
function quiltSig(d) {
  const r = readDesign(d);
  const stable = x =>
    Array.isArray(x)
      ? `[${x.map(stable).join(',')}]`
      : x && typeof x === 'object'
        ? `{${Object.keys(x)
            .sort()
            .map(k => JSON.stringify(k) + ':' + stable(x[k]))
            .join(',')}}`
        : JSON.stringify(x);
  const text = stable(r ? r.design : d);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16) + ':' + text.length;
}

export { quiltSig };
