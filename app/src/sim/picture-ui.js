// The realistic picture's button on the designer's rail, the small card that shows how it is going while the person
// carries on working, and the window to look at the finished picture in.
import './picture.js'; // load order: runs after sim/picture
import { $ } from '../core/dom.js';
import { design } from '../core/store.js';
import { quiltSig } from '../core/quilt-sig.js';
import { notify } from '../ui/notice.js';
import { pictures } from '../storage/pictures.js';
import { pictureHooks } from './picture-state.js';
import { canMakePictures, onPicture, pictureJob, startPicture, stopPicture } from './picture.js';
import { t } from '@quilt/shared/i18n.js';

const btn = $('dz-picture');

/** The button says what a click on it will do for the quilt on the screen. */
function refreshButton() {
  if (!design) return;
  const sig = quiltSig(design),
    job = pictureJob(),
    ready = pictures.has(sig);
  const label = ready
    ? t('See the realistic picture of this quilt')
    : job?.sig === sig
      ? t('The realistic picture of this quilt is being made')
      : t('Make a realistic picture of this quilt');
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.classList.toggle('has-picture', ready);
  btn.classList.toggle('making', job?.sig === sig);
}

function jobText(job) {
  if (job.stage === 'settling') return t('Laying the quilt on the bed…');
  if (job.stage === 'preparing') return t('Setting up the room…');
  if (job.stage === 'compiling')
    return t('Warming up the graphics card… The page may pause for a moment, the first time only.');
  return t('Rendering: {pct}%', { pct: Math.round(job.progress * 100) });
}
let shownText = '';
function refreshCard() {
  const job = pictureJob(),
    card = $('pic-job');
  card.hidden = !job;
  if (!job) return;
  const text = jobText(job);
  if (text !== shownText) $('pic-job-text').textContent = shownText = text;
  $('pic-job-fill').style.width = `${Math.round(job.progress * 100)}%`;
}

// ---- looking at a picture
let shownUrl = '';
function closeViewer() {
  if (shownUrl) URL.revokeObjectURL(shownUrl);
  shownUrl = '';
  $('pic-img').removeAttribute('src');
}
/** Shows a picture kept on this device. @param {string} sig the quilt's fingerprint */
async function showPicture(sig) {
  const rec = await pictures.get(sig);
  if (!rec) return;
  closeViewer();
  shownUrl = URL.createObjectURL(rec.blob);
  showPictureAt(shownUrl);
}
/** Shows a picture from its address (one shared with the community). @param {string} url */
function showPictureAt(url) {
  $('pic-img').src = url;
  $('pic-save').href = url;
  if (!$('pic-dlg').open) $('pic-dlg').showModal();
}

function clicked() {
  if (!design) return; // the app is still starting
  const sig = quiltSig(design),
    job = pictureJob();
  if (pictures.has(sig)) return showPicture(sig);
  if (job?.sig === sig) return notify(t('It’s on its way: keep working, and it will tell you when it’s ready.'));
  if (job) return notify(t('A picture of another version of a quilt is being made. Wait for it, or stop it first.'));
  if (startPicture(design)) notify(t('Making the picture. Keep working: it will tell you when it’s ready.'));
}

function init() {
  if (!canMakePictures()) btn.hidden = true;
  btn.addEventListener('click', clicked);
  $('pic-job-stop').addEventListener('click', stopPicture);
  $('pic-close').addEventListener('click', () => $('pic-dlg').close());
  $('pic-dlg').addEventListener('close', closeViewer);
  let soon = 0;
  pictureHooks.designChanged = () => {
    clearTimeout(soon);
    soon = setTimeout(refreshButton, 400);
  };
  onPicture(e => {
    refreshCard();
    if (e.type === 'change') {
      // (the button only cares when a picture starts or ends, not at every step)
      if (!shownText || pictureJob()?.progress === 0) refreshButton();
      return;
    }
    shownText = '';
    refreshButton();
    if (e.type === 'done')
      notify(t('Your realistic picture is ready.'), {
        ms: 20000,
        action: { label: t('See it'), run: () => showPicture(e.sig) },
      });
    else if (e.type === 'failed') notify(t('Couldn’t make the picture: {why}', { why: e.why }));
  });
  pictures.load().then(refreshButton);
}
init();

export { showPicture, showPictureAt };
