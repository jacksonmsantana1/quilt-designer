// Saving files (the artifact downloads capability, or a normal download).
import '../designer/part-dialog.js'; // load order: runs after designer/part-dialog
import { $ } from '../core/dom.js';

// ------------------------------------------------------------- save image
// Uses the viewer's downloads capability: the viewer confirms each save.
let downloads = null;
if (window.claude && window.claude.use) {
  window.claude
    .use('downloads')
    .then(d => {
      downloads = d;
      $('saveimg').hidden = !d;
      $('saveimg2').hidden = !d;
    })
    .catch(() => {});
}

export { downloads };
