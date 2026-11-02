// The first page and the account corner. The first page (#welcome) shows at start when nobody is signed in on this
// device: what the app does, Sign in or Create an account (both on Auth0's page). People who chose to carry on without
// an account when the page still offered it are remembered, and go straight to the app. The account corner, top right
// on every page, shows the person signed in and signs them out (back to the first page; the designs on this device
// stay). Signing in itself is mine/sync-ui.js.
import './sync-ui.js'; // load order: runs after mine/sync-ui
import { $ } from '../core/dom.js';
import { onAccount, signInAndSync, signOutAndStop } from './sync-ui.js';
import { t } from '@quilt/shared/i18n.js';

const SKIP_KEY = 'quilt-welcome.v1';
const skipped = () => {
  try {
    return localStorage.getItem(SKIP_KEY) === 'skip';
  } catch (e) {
    return false;
  }
};
const forgetSkip = () => {
  try {
    localStorage.removeItem(SKIP_KEY);
  } catch (e) {}
};

/** @param {string} msg */
const welcomeSays = msg => {
  $('welcome-err').textContent = msg;
  $('welcome-err').hidden = !msg;
};
const C = [
  'oklch(0.58 0.13 40)', // rust
  'oklch(0.72 0.06 140)', // sage
  'oklch(0.8 0.13 85)', // mustard
  'oklch(0.94 0.03 80)', // cream
  'oklch(0.48 0.11 35)', // deep rust
  'oklch(0.62 0.07 145)', // deep sage
];
/**
 * The picture beside the welcome: a patchwork of half-square triangles and plain squares in the page's colours,
 * the same every time (a fixed sequence, not random). @returns {string} SVG
 */
function patchworkArt(cols = 8, rows = 6, s = 100) {
  let seed = 7;
  const next = n => ((seed = (seed * 9301 + 49297) % 233280), Math.floor((seed / 233280) * n));
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * s,
        y = r * s,
        a = next(C.length),
        b = next(3) ? 3 : next(C.length);
      out += `<g class="w-patch" data-a="${a}" data-b="${b}"><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${C[b]}"/>`;
      if (next(4)) {
        // a half-square triangle, turned one of four ways (about the middle of its square, as a click turns it)
        const turn = next(4);
        out += `<polygon points="${x},${y} ${x + s},${y} ${x},${y + s}" fill="${C[a]}" data-turn="${turn}" style="transform-origin:${x + s / 2}px ${y + s / 2}px;transform:rotate(${turn * 90}deg)"/>`;
      }
      out += '</g>';
    }
  // seams, and quilting stitches along them
  let seams = '';
  for (let c = 1; c < cols; c++)
    seams += `<path d="M${c * s} 0V${rows * s}" stroke="oklch(0.25 0.03 40 / .25)" stroke-width="1.5"/>`;
  for (let r = 1; r < rows; r++)
    seams += `<path d="M0 ${r * s}H${cols * s}" stroke="oklch(0.25 0.03 40 / .25)" stroke-width="1.5"/>`;
  seams += `<rect x="8" y="8" width="${cols * s - 16}" height="${rows * s - 16}" fill="none" stroke="oklch(0.98 0.01 80 / .7)" stroke-width="2" stroke-dasharray="7 6"/>`;
  return `<svg viewBox="0 0 ${cols * s} ${rows * s}" role="img" aria-label="${t('A patchwork quilt')}">${out}<g class="w-seams">${seams}</g></svg>`;
}
/**
 * One move on a patch, the way a quilter plays with half-square triangles: a triangle turns a quarter, and takes a new
 * colour after each full turn; a plain square takes a new colour.
 * @param {SVGGElement} patch
 */
function turnPatch(patch) {
  const { a, b } = patch.dataset;
  const tri = /** @type {SVGPolygonElement | null} */ (patch.querySelector('polygon'));
  if (!tri) {
    const next = (+b + 1) % C.length;
    patch.setAttribute('data-b', String(next));
    const square = /** @type {SVGRectElement} */ (patch.querySelector('rect'));
    square.style.fill = C[next];
    return;
  }
  const turn = +tri.dataset.turn + 1;
  tri.dataset.turn = String(turn);
  tri.style.transform = `rotate(${turn * 90}deg)`;
  if (turn % 4) return;
  let next = (+a + 1) % C.length;
  if (next === +b) next = (next + 1) % C.length; // never the colour of the square behind it: the triangle would vanish
  patch.setAttribute('data-a', String(next));
  tri.style.fill = C[next];
}
/**
 * The patchwork can be played with: a click or tap moves one patch; dragging with a mouse moves each patch it passes,
 * once. A finger's drag stays free to scroll the page.
 */
function initPatchwork() {
  const art = $('welcome-art');
  /** @param {EventTarget | null} el @returns {SVGGElement | null} */
  const patchAt = el => /** @type {Element} */ (el).closest('.w-patch');
  let first = null,
    moved = new Set();
  /** @param {SVGGElement} p */
  const once = p => {
    if (!moved.has(p)) turnPatch(p);
    moved.add(p);
  };
  art.addEventListener('pointerdown', e => {
    first = patchAt(e.target);
    moved = new Set();
  });
  art.addEventListener('pointerover', e => {
    const p = patchAt(e.target);
    if (e.pointerType !== 'mouse' || e.buttons !== 1 || !first || !p || p === first) return;
    once(first); // the patch the drag started on counts too
    once(p);
  });
  art.addEventListener('click', e => {
    const p = patchAt(e.target);
    if (p) once(p);
  });
  art.addEventListener('dragstart', e => e.preventDefault());
}

let clipWatch = null;
/**
 * The feature cards' clips play while they are on screen, and load only then. Someone who asked for less motion sees
 * their still pictures instead.
 * @param {boolean} on
 */
function watchClips(on) {
  if (clipWatch) clipWatch.disconnect();
  clipWatch = null;
  const clips = /** @type {NodeListOf<HTMLVideoElement>} */ ($('welcome').querySelectorAll('.w-card video'));
  if (!on) {
    for (const v of clips) v.pause();
    return;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clipWatch = new IntersectionObserver(seen => {
    for (const { target, isIntersecting } of seen) {
      const v = /** @type {HTMLVideoElement} */ (target);
      // play() refused or interrupted: the still picture stays
      if (isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  });
  for (const v of clips) clipWatch.observe(v);
}

/**
 * The row of feature cards has no scrollbar. The card under the mouse grows and slides fully into view, which is also
 * how a mouse travels along the row. It stays large until the mouse moves over another card or leaves the row, so the
 * gaps between the cards, and cards moving under a still mouse, don't make it flicker.
 */
function initCardRow() {
  const row = $('welcome-cards');
  let big = null,
    follow = 0;
  /** @param {Element | null} card */
  const grow = card => {
    if (card === big) return;
    big?.classList.remove('big');
    big = card;
    cancelAnimationFrame(follow);
    if (!card) return;
    card.classList.add('big');
    const pull = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0.16,
      until = performance.now() + 800;
    const step = now => {
      const r = row.getBoundingClientRect(),
        c = card.getBoundingClientRect(),
        // room left on each side, so the next card still peeks out: it's what the mouse moves to, to go on
        room = Math.max(16, Math.min(110, (r.width - c.width) / 2));
      if (c.left < r.left + room) row.scrollLeft += (c.left - r.left - room) * pull;
      else if (c.right > r.right - room) row.scrollLeft += (c.right - r.right + room) * pull;
      if (now < until) follow = requestAnimationFrame(step);
    };
    follow = requestAnimationFrame(step);
  };
  row.addEventListener('pointermove', e => {
    const card = e.pointerType === 'mouse' && /** @type {Element} */ (e.target).closest('.w-card');
    if (card) grow(card);
  });
  row.addEventListener('pointerleave', () => grow(null));
}

let playStory = (/** @type {boolean} */ on) => void on;
/**
 * "From idea to heirloom": four clips of one quilt, from three empty blocks to the bed. They play one after another,
 * as one story, while the steps are on screen, and the stitched line between the steps is sewn up as they go. A step
 * can be clicked to go to it. With less motion asked for, nothing starts by itself and a click plays just that clip.
 */
function initStory() {
  const list = /** @type {HTMLElement} */ ($('welcome').querySelector('.w-steps'));
  const steps = /** @type {HTMLElement[]} */ ([...list.querySelectorAll('.w-step')]);
  const clips = steps.map(s => /** @type {HTMLVideoElement} */ (s.querySelector('video')));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let now = -1,
    again = 0,
    watch = null;
  const mark = () =>
    steps.forEach((s, i) => {
      s.classList.toggle('on', i === now);
      s.classList.toggle('done', i < now);
      const sewn = i === now ? clips[i].currentTime / (clips[i].duration || 1) : i < now ? 1 : 0;
      s.style.setProperty('--sewn', String(sewn));
    });
  /** @param {number} i */
  const play = i => {
    clearTimeout(again);
    clips.forEach((v, k) => k !== i && v.pause());
    now = i;
    clips[i].currentTime = 0;
    clips[i].play().catch(() => {}); // refused or interrupted: the still picture stays
    mark();
  };
  clips.forEach((v, i) => {
    v.addEventListener('timeupdate', () => i === now && mark());
    v.addEventListener('ended', () => {
      if (i !== now || still) return;
      if (i < clips.length - 1) play(i + 1);
      else {
        steps[i].style.setProperty('--sewn', '1');
        again = window.setTimeout(() => play(0), 2500); // a moment on the finished quilt, then from the start
      }
    });
    steps[i].querySelector('button').addEventListener('click', () => play(i));
  });
  list.classList.toggle('playing', !still);
  playStory = on => {
    if (watch) watch.disconnect();
    watch = null;
    if (!on) {
      clearTimeout(again);
      for (const v of clips) v.pause();
      return;
    }
    if (still) return;
    watch = new IntersectionObserver(([{ isIntersecting }]) => {
      if (!isIntersecting) {
        clearTimeout(again);
        for (const v of clips) v.pause();
      } else if (now < 0 || clips[now].ended) play(now < 0 || now === clips.length - 1 ? 0 : now + 1);
      else clips[now].play().catch(() => {});
    });
    watch.observe(list);
  };
}

/** @param {boolean} on */
function showWelcome(on) {
  $('welcome').hidden = !on;
  watchClips(on);
  playStory(on);
  if (!on) return;
  if (!$('welcome-art').firstChild)
    $('welcome-art').innerHTML = `${patchworkArt()}<p class="w-art-hint">${t('Click or tap a patch to turn it')}</p>`;
  welcomeSays('');
  openMenu(false);
  $('welcome').scrollTop = 0;
  $('welcome-signin').focus();
}
/** @param {boolean} signup */
async function welcomeSignIn(signup) {
  welcomeSays('');
  const msg = await signInAndSync({ signup });
  if (msg) welcomeSays(msg);
  else showWelcome(false);
}

/** @param {boolean} open */
function openMenu(open) {
  $('acct-menu').hidden = !open;
  $('acct-btn').setAttribute('aria-expanded', String(open));
}

function initAccount() {
  initCardRow();
  initStory();
  initPatchwork();
  // every Sign in / Create account button on the page; Auth0's window opens straight from the click (browsers block
  // windows opened later)
  for (const b of $('welcome').querySelectorAll('[data-auth]'))
    b.addEventListener('click', () => welcomeSignIn(/** @type {HTMLElement} */ (b).dataset.auth === 'signup'));

  let account = null;
  onAccount((c, s) => {
    account = c;
    const expired = !!c && s.state === 'login';
    $('acct-btn').hidden = !c || expired;
    $('acct-signin').hidden = !!c && !expired;
    $('acct-signin').textContent = expired ? t('Sign in again') : t('Sign in');
    if (!c || expired) openMenu(false);
    if (!c) return;
    const who = c.who || c.user || '';
    $('acct-initial').textContent = (who.trim()[0] || '?').toUpperCase();
    $('acct-btn').setAttribute('aria-label', t('Account: {who}', { who }));
    $('acct-btn').title = who;
    $('acct-email').textContent = who;
    $('acct-sync').textContent =
      s.state === 'offline'
        ? t("Can't reach the server: changes wait here.")
        : t('Your designs and fabric photos sync to your other devices.');
  });
  // signed out: the welcome page offers both; an expired sign-in signs in again straight away
  $('acct-signin').addEventListener('click', () => (account ? signInAndSync() : showWelcome(true)));
  $('acct-btn').addEventListener('click', () => openMenu($('acct-menu').hidden));
  $('acct-signout').addEventListener('click', async () => {
    openMenu(false);
    forgetSkip(); // before Auth0's logout takes the page away: it comes back to the first page
    await signOutAndStop();
    showWelcome(true);
  });
  document.addEventListener('click', e => {
    if (!$('acct-menu').hidden && !$('acct').contains(/** @type {Node} */ (e.target))) openMenu(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('acct-menu').hidden) {
      openMenu(false);
      $('acct-btn').focus();
    }
  });

  // signed in with Auth0, or chose earlier to carry on without an account: straight to the app. A development name (sync
  // card) doesn't count as signed in.
  if (!account?.auth0 && !skipped()) showWelcome(true);
}
initAccount();
