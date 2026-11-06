// The Camera tab: a photo of a real quilt (which quilt it is comes next), or of a fabric (cropped, and sorted by colour).
// A fabric is best a cut piece of a known size: framed live in its shape, it is kept at its real size, so its print is
// drawn at that size on every quilt.
import { t } from '@quilt/shared/i18n.js';
import { onAccountChange } from './account.js';
import { getPicture } from './camera.js';
import { liveShot } from './live-camera.js';
import { fractionMenu, keepPiece, lastPiece, readPiece } from './piece-size.js';
import { quiltPhoto } from './images.js';
import { addFabricFrom } from './my-fabrics.js';
import { addPhoto, newAlbumId, photoUrl, photos } from './photos.js';
import { everything, renderQuilts } from './quilts.js';
import { $, el, openSheet, say } from './ui.js';

const RECENT = 9;

/** What the switch says, the frame says, and the buttons do, for each kind of photo. */
const KINDS = {
  quilt: {
    title: t('A photo of a real quilt'),
    hint: t('Lay it flat, in daylight. The photo keeps nothing about where it was taken.'),
    take: gallery => quiltPicture(gallery),
  },
  fabric: {
    title: t('A photo of a fabric'),
    hint: t('Cut a piece, type its size, and frame it: it’s kept at its real size, and sorts itself by colour.'),
    take: gallery => fabricPicture(gallery),
  },
};
/** @type {keyof typeof KINDS} */
let kind = 'quilt';

function showKind(k) {
  kind = k;
  for (const name of /** @type {(keyof typeof KINDS)[]} */ (Object.keys(KINDS))) {
    $('cam-kind-' + name).setAttribute('aria-pressed', String(name === k));
    $('cam-icon-' + name).toggleAttribute('hidden', name !== k); // an <svg> has no .hidden
  }
  $('cam-title').textContent = KINDS[k].title;
  $('cam-hint').textContent = KINDS[k].hint;
  $('cam-size').hidden = k !== 'fabric';
  showPiece();
}

// ---- the size of the cut piece
/** What the boxes say now. @returns {import('./piece-size.js').PieceText} */
const pieceText = () => ({
  w: $('cam-w').value,
  h: $('cam-h').value,
  unit: $('cam-unit-in').getAttribute('aria-pressed') === 'true' ? 'in' : 'cm',
  wf: $('cam-wf').value,
  hf: $('cam-hf').value,
});
/** No size at all: a photo of a whole fabric, as before (a square, and a width guessed). */
const noSize = p => !p.w.trim() && !p.h.trim() && (p.unit === 'cm' || (p.wf === '0' && p.hf === '0'));

/** The frame shows the piece's shape and size, or the fabric's icon when there's no size (or not one yet). */
function showPiece() {
  const p = pieceText(),
    piece = noSize(p) ? null : readPiece(p),
    ok = kind === 'fabric' && piece && !('error' in piece);
  $('cam-shape').hidden = !ok;
  $('cam-icon-fabric').toggleAttribute('hidden', kind !== 'fabric' || !!ok);
  if (ok) {
    // as wide as it can be in the frame's middle, in the piece's own shape
    const most = 64,
      w = piece.aspect >= 1 ? most : most * piece.aspect,
      h = piece.aspect >= 1 ? most / piece.aspect : most;
    Object.assign($('cam-shape').style, { width: `${w}px`, height: `${h}px` });
    $('cam-shape-label').textContent = piece.label;
  }
  $('cam-size-said').textContent = piece && 'error' in piece ? piece.error : '';
}

function setUnit(unit) {
  $('cam-unit-cm').setAttribute('aria-pressed', String(unit === 'cm'));
  $('cam-unit-in').setAttribute('aria-pressed', String(unit === 'in'));
  // in inches, a fraction menu beside each box, as the web app has
  for (const id of ['cam-wf', 'cam-hf']) $(id).hidden = unit !== 'in';
  $('cam-size').classList.toggle('in', unit === 'in');
  keepPiece(pieceText());
  showPiece();
}

/** Which quilt this photo is of: a saved quilt, or a new album. @returns {Promise<{ quiltId: string, album?: string } | null>} */
function chooseQuilt() {
  return new Promise(done => {
    const s = openSheet(t('Which quilt is this?'));
    let answer = null;
    s.dialog.addEventListener('close', () => done(answer));
    const pick = a => {
      answer = a;
      s.close();
    };
    const name = el('input', {
      type: 'text',
      id: 'album-name',
      maxLength: 80,
      placeholder: t('For example: Grandma’s quilt'),
      'aria-label': t('The name of a new quilt'),
    });
    s.body.append(
      el(
        'form',
        {
          class: 'row',
          onsubmit: e => {
            e.preventDefault();
            const text = name.value.trim();
            if (text) pick({ quiltId: newAlbumId(), album: text });
            else name.focus();
          },
        },
        name,
        el('button', { type: 'submit', class: 'btn solid', textContent: t('Add') }),
      ),
    );
    const list = everything();
    if (list.length) s.body.append(el('h3', { textContent: t('Or one you already have') }));
    for (const item of list)
      s.body.append(
        el('button', {
          type: 'button',
          class: 'choice',
          textContent: item.name,
          onclick: () => pick(item.design ? { quiltId: item.id } : { quiltId: item.id, album: item.name }),
        }),
      );
  });
}

async function quiltPicture(gallery) {
  try {
    const picture = await getPicture({ gallery });
    if (!picture) return;
    const ready = await quiltPhoto(picture),
      where = await chooseQuilt();
    if (!where) return;
    addPhoto(ready, where);
    say(t('Kept on this phone. It goes up when you’re online and signed in.'));
    renderQuilts();
    renderRecent();
  } catch (e) {
    say(t('That picture could not be read.'));
  }
}

async function fabricPicture(gallery) {
  const p = pieceText();
  const read = noSize(p) ? null : readPiece(p);
  if (read && 'error' in read) {
    say(read.error);
    $('cam-w').focus();
    return;
  }
  const piece = /** @type {{ wCm: number, hCm: number, aspect: number, label: string } | null} */ (read);
  keepPiece(p);
  const measured = piece && { aspect: piece.aspect, cm: piece.wCm };
  try {
    if (!gallery && piece) {
      const shot = await liveShot(piece);
      if (shot === null) return; // closed: nothing kept
      if (shot !== 'unavailable') return await addFabricFrom(shot.blob, { ...measured, start: shot.part });
      // no camera inside the app here: the phone's own one, then the frame on the photo
    }
    const picture = await getPicture({ gallery });
    if (picture) await addFabricFrom(picture, measured || {});
  } catch (e) {
    say(t('That picture could not be read.'));
  }
}

function renderRecent() {
  const shots = photos().slice(0, RECENT);
  $('recent-title').hidden = !shots.length;
  const waiting = photos().filter(p => !p.sent).length;
  $('recent-wait').hidden = !waiting;
  $('recent-wait').textContent = t('{n} waiting to upload', { n: waiting });
  $('recent').replaceChildren(
    ...shots.map(p =>
      el(
        'div',
        { class: 'shot' },
        el('img', { alt: p.album || t('A photo of a quilt'), src: photoUrl(p), loading: 'lazy' }),
        !p.sent &&
          el('span', { class: 'badge wait', title: t('Waiting to upload'), textContent: t('Waiting to upload') }),
      ),
    ),
  );
}

function initCameraTab() {
  $('cam-kind').setAttribute('aria-label', t('What is the photo of?'));
  $('cam-kind-quilt').textContent = t('A quilt');
  $('cam-kind-fabric').textContent = t('A fabric');
  $('cam-shoot').setAttribute('aria-label', t('Take a photo'));
  $('cam-pick-label').textContent = t('My photos');
  $('cam-pick').setAttribute('aria-label', t('From my photos'));
  $('recent-title').textContent = t('Latest photos');
  $('cam-size-label').textContent = t('The size of the cut piece');
  $('cam-w').setAttribute('aria-label', t('Width'));
  $('cam-h').setAttribute('aria-label', t('Height'));
  $('cam-unit').setAttribute('aria-label', t('Unit'));
  $('cam-unit-in').textContent = t('in');
  $('cam-size-hint').textContent = t('Leave it empty for a photo of a whole fabric, without its size.');
  $('cam-w').after(fractionMenu('cam-wf', t('{name}: fraction of an inch', { name: t('Width') })));
  $('cam-h').after(fractionMenu('cam-hf', t('{name}: fraction of an inch', { name: t('Height') })));
  const kept = lastPiece();
  $('cam-w').value = kept.w;
  $('cam-h').value = kept.h;
  $('cam-wf').value = kept.wf || '0';
  $('cam-hf').value = kept.hf || '0';
  $('cam-unit-cm').addEventListener('click', () => setUnit('cm'));
  $('cam-unit-in').addEventListener('click', () => setUnit('in'));
  for (const id of ['cam-w', 'cam-h', 'cam-wf', 'cam-hf']) $(id).addEventListener('input', showPiece);
  for (const id of ['cam-w', 'cam-h', 'cam-wf', 'cam-hf'])
    $(id).addEventListener('change', () => keepPiece(pieceText()));
  setUnit(kept.unit);
  $('cam-kind-quilt').addEventListener('click', () => showKind('quilt'));
  $('cam-kind-fabric').addEventListener('click', () => showKind('fabric'));
  $('cam-shoot').addEventListener('click', () => KINDS[kind].take(false));
  $('cam-pick').addEventListener('click', () => KINDS[kind].take(true));
  showKind('quilt');
  // after a sync (photos sent, or come from another phone) and on signing in or out
  onAccountChange(renderRecent);
  renderRecent();
}

export { initCameraTab, renderRecent };
