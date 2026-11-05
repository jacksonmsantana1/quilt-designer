// The Community board: everyone's shared quilts, newest first, with their realistic pictures where they have one, as on
// the web app (app/src/mine/community.js). A card's quilt is drawn only when it comes near the screen, because a phone
// has neither the speed nor the memory to draw a whole page of them at once. Saving and reporting need a sign-in: they
// come with it.
import { readDesign } from '@quilt/shared/format.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { quiltPainter } from '@quilt/shared/quilt-paint.js';
import { getLang, t } from '@quilt/shared/i18n.js';
import { fabricById, fabricsReady } from './fabrics.js';

const API_URL = __API_URL__;
const $ = /** @type {(id: string) => any} */ (id => document.getElementById(id));
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

// ---- drawing when near the screen
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
/** Keeps the room the drawing will take (so the board doesn't jump), and draws it when it comes near. */
function drawWhenNear(cv, it, d) {
  const q = quiltMm(d);
  cv.style.aspectRatio = `${q.W} / ${q.H}`;
  waiting.set(cv, async () => {
    try {
      await fabricsReady(d, it.fabrics);
      if (cv.isConnected) paint(cv, d);
    } catch (e) {
      // the card keeps its name and its place, without a drawing
    }
  });
  near.observe(cv);
}

// ---- the viewer
function showPicture(it) {
  $('viewer-img').src = it.pictureUrl;
  $('viewer-img').alt = t('“{name}” on a bed', { name: it.name });
  $('viewer-name').textContent = it.name;
  $('viewer').showModal();
}

// ---- a card
function card(it, d) {
  const pin = document.createElement('article');
  pin.className = 'pin';
  const img = document.createElement('div');
  img.className = 'img';
  const drawing = document.createElement('canvas');
  if (it.pictureUrl) {
    // the realistic picture, with the quilt's own drawing in the corner: quilters want to read the pattern too
    const photo = new Image();
    photo.className = 'photo';
    photo.alt = t('“{name}” on a bed', { name: it.name });
    photo.loading = 'lazy';
    photo.src = it.pictureUrl;
    photo.addEventListener('click', () => showPicture(it));
    drawing.className = 'inset';
    img.append(photo, drawing);
  } else img.append(drawing);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.className = 'name';
  name.textContent = it.name;
  const by = document.createElement('small');
  by.className = 'by';
  by.textContent = t('by {author} · {cols} × {rows} blocks · {date}', {
    author: it.author,
    cols: d.cols,
    rows: d.rows,
    date: new Date(it.updatedAt).toLocaleDateString([getLang()], { day: 'numeric', month: 'short', year: 'numeric' }),
  });
  meta.append(name, by);
  pin.append(img, meta);
  drawWhenNear(drawing, it, d);
  return pin;
}

// ---- the board
/** @type {any[]} */
let items = [];
let more = false,
  loading = 0;

/** The shared quilts for the search typed now (append: the next page). @param {boolean} [append] */
async function loadBoard(append = false) {
  const q = $('q').value.trim(),
    last = append ? items[items.length - 1] : null,
    qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (last) {
    qs.set('before', String(last.updatedAt));
    qs.set('beforeId', last.id);
  }
  const ticket = ++loading;
  const empty = $('empty');
  let got = [];
  let message = '';
  try {
    const r = await fetch(`${API_URL}/v1/community${qs.size ? `?${qs}` : ''}`);
    if (ticket !== loading) return; // a newer search started
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.json();
    if (ticket !== loading) return;
    got = body.items;
    more = body.more;
  } catch (e) {
    if (ticket !== loading) return;
    more = false;
    message = t('Can’t reach the community right now. {why}', { why: t('The server could not be reached.') });
  }
  items = append ? items.concat(got) : got;
  const board = $('board');
  if (!append) board.replaceChildren();
  for (const it of got) {
    const r = readDesign(it.design);
    if (r) board.append(card(it, r.design));
  }
  empty.hidden = !!items.length && !message;
  empty.textContent =
    message || (q ? t('No shared quilts match your search.') : t('No quilts shared yet: be the first!'));
  $('more').hidden = !more;
}

function initCommunity() {
  $('title').textContent = t('Community');
  $('q').placeholder = t('Search shared quilts and quilters');
  $('q').setAttribute('aria-label', t('Search shared quilts and quilters'));
  $('more').textContent = t('More quilts');
  $('viewer-close').setAttribute('aria-label', t('Close'));
  let soon = /** @type {any} */ (0);
  $('q').addEventListener('input', () => {
    clearTimeout(soon);
    soon = setTimeout(() => loadBoard(), 300);
  });
  $('more').addEventListener('click', () => loadBoard(true));
  $('viewer-close').addEventListener('click', () => $('viewer').close());
  $('viewer').addEventListener('close', () => $('viewer-img').removeAttribute('src'));
  loadBoard();
}

export { initCommunity };
