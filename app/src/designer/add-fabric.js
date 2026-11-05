// Adding photos of your own fabrics from this computer: the "+ Add fabric" tile (first in every fabric list and in the
// fabric library) opens the computer's file picker, then a small window asks how wide the fabric in the photo is,
// because that sets the size of the print on the quilt.
import './fabric-picker.js'; // load order: runs after designer/fabric-picker
import { $ } from '../core/dom.js';
import { len } from '../core/units.js';
import { notify } from '../ui/notice.js';
import { loadImage } from '../sim/textures.js';
import { addFabric } from './fabric-library.js';
import { redrawLists, refreshLibrary, showInLists } from './fabric-picker.js';
import { t, tn } from '@quilt/shared/i18n.js';

const CM_KEY = 'quilt-photo-cm.v1',
  PREVIEWS = 6; // photos shown in the window; the button says how many there are in all

/** @type {{ file: File, url: string }[]} */
let chosen = [];
let adding = false;

/**
 * Opens the computer's file picker. The input has to be inside the window that is open now, because everything outside
 * a modal window is out of reach. @param {HTMLElement} from what was clicked
 */
function choosePhotos(from) {
  const input = $('dz-upload'),
    home = from.closest('dialog[open]') || document.body;
  if (input.parentElement !== home) home.append(input);
  input.click();
}

const nameOf = file => file.name.replace(/\.[^.]+$/, '').slice(0, 40);
function showWidth() {
  $('dz-cm-o').textContent = len(+$('dz-cm').value * 10);
}
function letGo() {
  for (const c of chosen) URL.revokeObjectURL(c.url);
  chosen = [];
  $('addfab-pics').replaceChildren();
}

function photosPicked(files) {
  const images = files.filter(f => f.type.startsWith('image/'));
  if (!images.length) return notify(t('Those files aren’t pictures.'));
  letGo();
  chosen = images.map(file => ({ file, url: URL.createObjectURL(file) }));
  $('addfab-pics').replaceChildren(
    ...chosen.slice(0, PREVIEWS).map(c => {
      const im = new Image();
      im.src = c.url;
      im.alt = '';
      return im;
    }),
  );
  const one = chosen.length === 1;
  $('addfab-name-row').hidden = !one;
  if (one) $('addfab-name').value = nameOf(images[0]);
  $('addfab-ok').textContent = tn(chosen.length, 'Add {n} fabric', 'Add {n} fabrics');
  showWidth();
  $('addfab').showModal();
}

async function addChosen() {
  adding = true;
  $('addfab-ok').disabled = true;
  const cm = +$('dz-cm').value,
    one = chosen.length === 1,
    failed = [];
  let last = null,
    added = 0;
  for (const { file, url } of chosen)
    try {
      const im = await loadImage(url),
        c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      const name = (one && $('addfab-name').value.trim().slice(0, 40)) || nameOf(file);
      last = await addFabric(c, { name, cm });
      added++;
    } catch (e) {
      failed.push(file.name); // a kind of picture this browser can't read (a phone's HEIC photo, say)
    }
  try {
    localStorage.setItem(CM_KEY, String(cm));
  } catch (e) {}
  adding = false;
  $('addfab-ok').disabled = false;
  $('addfab').close();
  redrawLists();
  refreshLibrary();
  if (last) showInLists(last);
  const note = added
    ? tn(
        added,
        '{n} photo added. They are kept in this browser with your designs.',
        '{n} photos added. They are kept in this browser with your designs.',
      )
    : '';
  notify(
    failed.length
      ? `${note} ${t('Couldn’t read {names}. Try a JPG or PNG picture.', { names: failed.join(', ') })}`.trim()
      : note,
  );
}

function init() {
  const dlg = $('addfab');
  try {
    const saved = +localStorage.getItem(CM_KEY);
    if (saved) $('dz-cm').value = String(saved);
  } catch (e) {}
  $('dz-upload').addEventListener('change', e => {
    const files = [...e.target.files];
    e.target.value = ''; // so that the same photo can be chosen again
    if (files.length) photosPicked(files);
  });
  $('dz-cm').addEventListener('input', showWidth);
  $('addfab-ok').addEventListener('click', addChosen);
  $('addfab-cancel').addEventListener('click', () => dlg.close());
  $('addfab-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('cancel', e => {
    if (adding) e.preventDefault(); // Escape waits until the photos are in
  });
  dlg.addEventListener('close', letGo);
}
init();

export { choosePhotos };
