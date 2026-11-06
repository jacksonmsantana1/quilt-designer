// The Camera tab: a photo of a real quilt (which quilt it is comes next), or of a fabric (cropped, and sorted by colour).
import { t } from '@quilt/shared/i18n.js';
import { getPicture } from './camera.js';
import { quiltPhoto } from './images.js';
import { addFabricFrom } from './my-fabrics.js';
import { addPhoto, newAlbumId, photoUrl, photos } from './photos.js';
import { everything, renderQuilts } from './quilts.js';
import { $, el, openSheet, say } from './ui.js';

const RECENT = 9;

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
  try {
    const picture = await getPicture({ gallery });
    if (picture) await addFabricFrom(picture);
  } catch (e) {
    say(t('That picture could not be read.'));
  }
}

function renderRecent() {
  const shots = photos().slice(0, RECENT);
  $('recent-title').hidden = !shots.length;
  $('recent').replaceChildren(
    ...shots.map(p =>
      el(
        'div',
        { class: 'shot' },
        el('img', { alt: p.album || t('A photo of a quilt'), src: photoUrl(p), loading: 'lazy' }),
        !p.sent && el('span', { class: 'badge', textContent: t('Waiting to upload') }),
      ),
    ),
  );
}

function initCameraTab() {
  $('cam-quilt-title').textContent = t('A photo of a real quilt');
  $('cam-fabric-title').textContent = t('A photo of a fabric');
  $('cam-fabric-hint').textContent = t('Crop it, and it sorts itself by colour.');
  $('cam-quilt-hint').textContent = t('The photo keeps nothing about where it was taken.');
  for (const id of ['cam-quilt', 'cam-fabric']) $(id).textContent = t('Take a photo');
  for (const id of ['cam-quilt-pick', 'cam-fabric-pick']) $(id).textContent = t('From my photos');
  $('recent-title').textContent = t('Latest photos');
  $('cam-quilt').addEventListener('click', () => quiltPicture(false));
  $('cam-quilt-pick').addEventListener('click', () => quiltPicture(true));
  $('cam-fabric').addEventListener('click', () => fabricPicture(false));
  $('cam-fabric-pick').addEventListener('click', () => fabricPicture(true));
  renderRecent();
}

export { initCameraTab, renderRecent };
