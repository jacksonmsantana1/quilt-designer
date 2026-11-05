// A quilt's card on a board, the same on Community and My quiltings: its name, what it is, its realistic picture or photo
// where it has one, and its drawing. The drawing is made only when the card comes near the screen, because a phone has
// neither the speed nor the memory to draw a whole page of quilts at once.
import { quiltMm } from '@quilt/shared/geometry.js';
import { quiltPainter } from '@quilt/shared/quilt-paint.js';
import { t } from '@quilt/shared/i18n.js';
import { fabricById, fabricsReady } from './fabrics.js';
import { $, el } from './ui.js';

const painter = quiltPainter({ fabricById });

/** The quilt's drawing on this canvas, as wide as the canvas shows it (at most double, for sharp screens). */
function paint(cv, d) {
  const q = quiltMm(d),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    w = cv.clientWidth || 160,
    h = Math.round((w * q.H) / q.W);
  cv.width = w * dpr;
  cv.height = h * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  painter.drawQuilt(g, w, h, { seams: true, design: d });
  g.strokeStyle = '#2f466f';
  g.lineWidth = Math.max(2, w * 0.012);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
}

const waiting = new WeakMap();
const near = new IntersectionObserver(
  entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      near.unobserve(e.target);
      const draw = waiting.get(e.target);
      waiting.delete(e.target);
      draw?.();
    }
  },
  { rootMargin: '400px' },
);
/** Calls f once when this comes near the screen. @param {Element} node @param {() => void} f */
function whenNear(node, f) {
  waiting.set(node, f);
  near.observe(node);
}
/** Keeps the room the drawing will take (so the board doesn't jump), and draws it when it comes near. */
function drawWhenNear(cv, d, photos) {
  const q = quiltMm(d);
  cv.style.aspectRatio = `${q.W} / ${q.H}`;
  whenNear(cv, async () => {
    try {
      await fabricsReady(d, photos);
      if (cv.isConnected) paint(cv, d);
    } catch (e) {
      // the card keeps its name and its place, without a drawing
    }
  });
}

/** A picture over the whole screen, and a way to delete it when it's the person's own. */
function showPicture({ src, alt, name, onDelete = null }) {
  $('viewer-img').src = src;
  $('viewer-img').alt = alt;
  $('viewer-name').textContent = name;
  $('viewer-delete').hidden = !onDelete;
  $('viewer-delete').onclick = onDelete;
  $('viewer').showModal();
}

/**
 * @param {{ name: string, by: string, design?: any, fabrics?: any[], photo?: string, alt?: string, onPhoto?: () => void,
 *   onOpen?: () => void, menu?: () => void, badge?: string }} o
 */
function quiltCard({ name, by, design, fabrics = [], photo, alt = '', onPhoto, onOpen, menu, badge }) {
  const drawing = design ? el('canvas') : null,
    img = el('div', { class: 'img' });
  if (photo) {
    // the picture, with the quilt's own drawing in the corner: quilters want to read the pattern too
    img.append(el('img', { class: 'photo', alt, loading: 'lazy', src: photo, onclick: onPhoto }));
    if (drawing) {
      drawing.className = 'inset';
      img.append(drawing);
    }
  } else if (drawing) img.append(drawing);
  if (badge) img.append(el('span', { class: 'badge', textContent: badge }));
  const meta = el(
    'div',
    { class: 'meta' },
    el('b', { class: 'name', textContent: name }),
    el('small', { class: 'by', textContent: by }),
    menu &&
      el('button', {
        type: 'button',
        class: 'more-actions',
        'aria-label': t('More about “{name}”', { name }),
        textContent: '⋯',
        onclick: e => {
          e.stopPropagation();
          menu();
        },
      }),
  );
  const pin = el('article', { class: 'pin' }, img, meta);
  if (onOpen) pin.addEventListener('click', onOpen);
  if (drawing) drawWhenNear(drawing, design, fabrics);
  return pin;
}

export { paint, quiltCard, showPicture, whenNear };
