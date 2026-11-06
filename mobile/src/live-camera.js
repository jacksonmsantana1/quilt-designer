// The camera inside the app, for a cut piece of fabric: the picture, live, with a frame over it in the piece's shape, so
// that the piece is framed as the photo is taken. The phone's own camera app can't show anything over its picture, so
// this one is the WebView's camera (getUserMedia); Android asks for the CAMERA permission the first time.
import { t } from '@quilt/shared/i18n.js';
import { el, openSheet, say } from './ui.js';

/** How much of the picture the frame may take: room around it to see the piece's edges. */
const ROOM = 0.8;

/**
 * Where the frame is, in a W × H box: the largest rectangle of this shape that leaves some room around it.
 * @param {number} W @param {number} H @param {number} aspect width / height @returns {{ x: number, y: number, w: number, h: number }}
 */
function frameIn(W, H, aspect) {
  const w = Math.min(W * ROOM, H * ROOM * aspect),
    h = w / aspect;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

/**
 * The part of the video's own picture that shows in a box of W × H with object-fit: cover (centred, cut at two sides).
 * @param {number} vw @param {number} vh the video's size @param {number} W @param {number} H the box
 * @returns {{ k: number, ox: number, oy: number }} picture px = (box px + ox) * k
 */
function coverMap(vw, vh, W, H) {
  const s = Math.max(W / vw, H / vh); // box px per picture px
  return { k: 1 / s, ox: (vw * s - W) / 2, oy: (vh * s - H) / 2 };
}

/**
 * A photo of a cut piece, framed live. null: changed their mind; 'unavailable': no camera here (or not allowed), so
 * the phone's own camera is used instead.
 * @param {{ aspect: number, label: string }} piece @returns {Promise<{ blob: Blob, part: { x: number, y: number, w: number, h: number } } | null | 'unavailable'>}
 */
async function liveShot({ aspect, label }) {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
  } catch (e) {
    if (e?.name === 'NotAllowedError') say(t('The camera wasn’t allowed, so the phone’s own camera opens instead.'));
    return 'unavailable';
  }
  return new Promise(done => {
    const s = openSheet(t('Frame the piece'), { full: true });
    s.dialog.classList.add('live');
    let answer = null;
    const video = el('video', { id: 'live-video', autoplay: true, muted: true, playsInline: true }),
      frame = el(
        'div',
        { class: 'live-frame', id: 'live-frame' },
        el('span', { class: 'live-size', textContent: label }),
      ),
      stage = el('div', { class: 'live-stage' }, video, frame);
    video.setAttribute('playsinline', ''); // iPhones play it inside the page only with the attribute
    video.srcObject = stream;
    const place = () => {
      const f = frameIn(stage.clientWidth, stage.clientHeight, aspect);
      Object.assign(frame.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` });
    };
    const resized = new ResizeObserver(place);
    resized.observe(stage);
    s.dialog.addEventListener('close', () => {
      resized.disconnect();
      for (const tr of stream.getTracks()) tr.stop(); // the camera's light goes off
      done(answer);
    });
    const shoot = el(
      'button',
      {
        type: 'button',
        class: 'cam-shoot',
        id: 'live-shoot',
        'aria-label': t('Take a photo'),
        onclick: async () => {
          const vw = video.videoWidth,
            vh = video.videoHeight;
          if (!vw || !vh) return; // the picture hasn't started yet
          const c = document.createElement('canvas');
          c.width = vw;
          c.height = vh;
          c.getContext('2d').drawImage(video, 0, 0, vw, vh);
          // the frame as the person saw it, in the picture's own pixels: where cropping starts
          const W = stage.clientWidth,
            H = stage.clientHeight,
            f = frameIn(W, H, aspect),
            m = coverMap(vw, vh, W, H);
          const part = { x: (f.x + m.ox) * m.k, y: (f.y + m.oy) * m.k, w: f.w * m.k, h: f.h * m.k };
          const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92));
          if (blob) answer = { blob, part };
          s.close();
        },
      },
      el('span', { class: 'shutter-dot' }),
    );
    s.body.append(
      stage,
      el('p', {
        class: 'hint live-hint',
        textContent: t('Hold the phone flat over the piece, and fit its edges in the frame.'),
      }),
      el('div', { class: 'live-foot' }, shoot),
    );
    video.play().catch(() => {});
  });
}

export { coverMap, frameIn, liveShot };
