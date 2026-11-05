// My quiltings: the person's saved quilts, only to look at (designing stays on the web), and their photos of the real
// quilts, on the same kind of board as Community. A quilt that was never designed here can have photos too: an album.
import { readDesign } from '@quilt/shared/format.js';
import { getLang, t, tn } from '@quilt/shared/i18n.js';
import { repo } from '../../app/src/storage/repo.js';
import { onAccountChange, signedIn } from './account.js';
import { getPicture } from './camera.js';
import { fabricsReady } from './fabrics.js';
import { quiltPhoto } from './images.js';
import { signInFromTap } from './me.js';
import { addPhoto, albums, photoUrl, photosOf, removePhoto } from './photos.js';
import { paint, quiltCard, showPicture } from './quilt-card.js';
import { $, ask, el, openSheet, say } from './ui.js';

let query = '';

const dateOf = ms =>
  ms ? new Date(ms).toLocaleDateString([getLang()], { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** The quilts and albums, newest first. */
function everything() {
  const list = [];
  for (const rec of repo.designs.list()) {
    const r = readDesign(rec.design);
    if (r) list.push({ id: rec.id, name: rec.name, design: r.design, at: rec.updatedAt });
  }
  for (const a of albums()) {
    list.push({ id: a.id, name: a.name, design: null, at: photosOf(a.id)[0].takenAt });
  }
  return list.sort((a, b) => b.at - a.at);
}

/** Opens a photo large, with the way to delete it. */
function openPhoto(p, name, after) {
  showPicture({
    src: photoUrl(p),
    alt: t('A photo of “{name}”', { name }),
    name,
    onDelete: async () => {
      const sure = await ask(t('Delete this photo?'), t('It will be deleted from all your devices.'), t('Delete'), {
        danger: true,
      });
      if (!sure) return;
      removePhoto(p.id);
      $('viewer').close();
      after();
    },
  });
}

/** Takes or chooses a picture and keeps it with this quilt. @returns {Promise<boolean>} whether one was added */
async function addPhotoTo(item, gallery) {
  try {
    const picture = await getPicture({ gallery });
    if (!picture) return false;
    addPhoto(await quiltPhoto(picture), { quiltId: item.id, album: item.design ? null : item.name });
    return true;
  } catch (e) {
    say(t('That picture could not be read.'));
    return false;
  }
}

function fillQuilt(s, item) {
  const shots = photosOf(item.id);
  s.body.replaceChildren();
  if (item.design) {
    const cv = el('canvas', { class: 'large' });
    s.body.append(
      cv,
      el('p', {
        class: 'hint',
        textContent: t('{cols} × {rows} blocks. To change it, open it on the web app.', {
          cols: item.design.cols,
          rows: item.design.rows,
        }),
      }),
    );
    fabricsReady(item.design).then(() => {
      if (cv.isConnected) paint(cv, item.design);
    });
  }
  const refresh = () => {
    fillQuilt(s, item);
    renderQuilts();
  };
  s.body.append(
    el('h3', { textContent: t('Photos of the real quilt') }),
    el(
      'div',
      { class: 'row' },
      el('button', {
        type: 'button',
        class: 'btn solid',
        textContent: t('Take a photo'),
        onclick: async () => {
          if (await addPhotoTo(item, false)) refresh();
        },
      }),
      el('button', {
        type: 'button',
        class: 'btn',
        textContent: t('From my photos'),
        onclick: async () => {
          if (await addPhotoTo(item, true)) refresh();
        },
      }),
    ),
    shots.length
      ? el(
          'div',
          { class: 'shots' },
          ...shots.map(p =>
            el(
              'button',
              {
                type: 'button',
                class: 'shot',
                onclick: () => openPhoto(p, item.name, refresh),
              },
              el('img', { alt: t('A photo of “{name}”', { name: item.name }), src: photoUrl(p), loading: 'lazy' }),
            ),
          ),
        )
      : el('p', { class: 'hint', textContent: t('No photos yet.') }),
  );
}

function openQuilt(item) {
  const s = openSheet(item.name, { full: true });
  fillQuilt(s, item);
}

/** How many photos, and whether some are waiting for a connection. */
function byLine(item) {
  const n = photosOf(item.id).length,
    bits = [];
  if (item.design) bits.push(t('{cols} × {rows} blocks', { cols: item.design.cols, rows: item.design.rows }));
  if (n) bits.push(tn(n, '{n} photo', '{n} photos'));
  bits.push(dateOf(item.at));
  return bits.filter(Boolean).join(' · ');
}

function renderQuilts() {
  const board = $('quilts-board'),
    empty = $('quilts-empty'),
    join = $('quilts-signin');
  const q = query.toLowerCase();
  const list = everything().filter(i => i.name.toLowerCase().includes(q));
  board.replaceChildren(
    ...list.map(item => {
      const latest = photosOf(item.id)[0];
      return quiltCard({
        name: item.name,
        by: byLine(item),
        design: item.design,
        photo: latest ? photoUrl(latest) : undefined,
        alt: t('A photo of “{name}”', { name: item.name }),
        onOpen: () => openQuilt(item),
        badge: photosOf(item.id).some(p => !p.sent) ? t('Waiting to upload') : undefined,
      });
    }),
  );
  empty.hidden = !!list.length;
  empty.textContent = q
    ? t('None of your quilts match your search.')
    : signedIn()
      ? t('Quilts you design on the web app come here. Photos of your real quilts can start here too: try the camera.')
      : t(
          'Sign in to see the quilts you designed on the web app. You can take photos of real quilts without an account.',
        );
  join.hidden = signedIn() || !!list.length;
}

/** The screen's search box has this now. @param {string} text */
function searchQuilts(text) {
  query = text;
  renderQuilts();
}

function initQuilts() {
  $('quilts-signin').textContent = t('Sign in');
  $('quilts-signin').addEventListener('click', signInFromTap);
  onAccountChange(renderQuilts);
  renderQuilts();
}

export { everything, initQuilts, renderQuilts, searchQuilts };
