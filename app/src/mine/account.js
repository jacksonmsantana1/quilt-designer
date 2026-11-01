// The first page and the account corner. The first page (#welcome) shows at start when nobody is signed in on this
// device: what the app does, Sign in or Create an account (both on Auth0's page), or carry on without an account
// (remembered). The account corner, top right on every page, shows the person signed in and signs them out (back
// to the first page; the designs on this device stay). Signing in itself is mine/sync-ui.js.
import './sync-ui.js'; // load order: runs after mine/sync-ui
import { $ } from '../core/dom.js';
import { onAccount, signInAndSync, signOutAndStop } from './sync-ui.js';

const SKIP_KEY = 'quilt-welcome.v1';
const skipped = () => {
  try {
    return localStorage.getItem(SKIP_KEY) === 'skip';
  } catch (e) {
    return false;
  }
};
/** @param {boolean} skip */
const rememberSkip = skip => {
  try {
    if (skip) localStorage.setItem(SKIP_KEY, 'skip');
    else localStorage.removeItem(SKIP_KEY);
  } catch (e) {}
};

/** @param {string} msg */
const welcomeSays = msg => {
  $('welcome-err').textContent = msg;
  $('welcome-err').hidden = !msg;
};
/**
 * The picture beside the welcome: a patchwork of half-square triangles and plain squares in the page's colours,
 * the same every time (a fixed sequence, not random). @returns {string} SVG
 */
function patchworkArt(cols = 8, rows = 6, s = 100) {
  const C = [
    'oklch(0.58 0.13 40)', // rust
    'oklch(0.72 0.06 140)', // sage
    'oklch(0.8 0.13 85)', // mustard
    'oklch(0.94 0.03 80)', // cream
    'oklch(0.48 0.11 35)', // deep rust
    'oklch(0.62 0.07 145)', // deep sage
  ];
  let seed = 7;
  const next = n => ((seed = (seed * 9301 + 49297) % 233280), Math.floor((seed / 233280) * n));
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * s,
        y = r * s,
        a = C[next(C.length)],
        b = next(3) ? C[3] : C[next(C.length)];
      out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${b}"/>`;
      if (next(4)) {
        // a half-square triangle, turned one of four ways
        const pts = [
          [x, y, x + s, y, x, y + s],
          [x, y, x + s, y, x + s, y + s],
          [x + s, y, x + s, y + s, x, y + s],
          [x, y, x + s, y + s, x, y + s],
        ][next(4)];
        out += `<polygon points="${pts.join(' ')}" fill="${a}"/>`;
      }
    }
  // seams, and quilting stitches along them
  for (let c = 1; c < cols; c++)
    out += `<path d="M${c * s} 0V${rows * s}" stroke="oklch(0.25 0.03 40 / .25)" stroke-width="1.5"/>`;
  for (let r = 1; r < rows; r++)
    out += `<path d="M0 ${r * s}H${cols * s}" stroke="oklch(0.25 0.03 40 / .25)" stroke-width="1.5"/>`;
  out += `<rect x="8" y="8" width="${cols * s - 16}" height="${rows * s - 16}" fill="none" stroke="oklch(0.98 0.01 80 / .7)" stroke-width="2" stroke-dasharray="7 6"/>`;
  return `<svg viewBox="0 0 ${cols * s} ${rows * s}" role="img" aria-label="A patchwork quilt">${out}</svg>`;
}

/** @param {boolean} on */
function showWelcome(on) {
  $('welcome').hidden = !on;
  if (!on) return;
  if (!$('welcome-art').firstChild) $('welcome-art').innerHTML = patchworkArt();
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
  // every Sign in / Create account button on the page; Auth0's window opens straight from the click (browsers block
  // windows opened later)
  for (const b of $('welcome').querySelectorAll('[data-auth]'))
    b.addEventListener('click', () => welcomeSignIn(/** @type {HTMLElement} */ (b).dataset.auth === 'signup'));
  $('welcome-features').addEventListener('click', () => $('welcome-feats').scrollIntoView({ block: 'start' }));
  $('welcome-skip').addEventListener('click', () => {
    rememberSkip(true);
    showWelcome(false);
  });

  let account = null;
  onAccount((c, s) => {
    account = c;
    const expired = !!c && s.state === 'login';
    $('acct-btn').hidden = !c || expired;
    $('acct-signin').hidden = !!c && !expired;
    $('acct-signin').textContent = expired ? 'Sign in again' : 'Sign in';
    if (!c || expired) openMenu(false);
    if (!c) return;
    const who = c.who || c.user || '';
    $('acct-initial').textContent = (who.trim()[0] || '?').toUpperCase();
    $('acct-btn').setAttribute('aria-label', `Account: ${who}`);
    $('acct-btn').title = who;
    $('acct-email').textContent = who;
    $('acct-sync').textContent =
      s.state === 'offline'
        ? "Can't reach the server: changes wait here."
        : 'Your designs and fabric photos sync to your other devices.';
  });
  // signed out: the welcome page offers both; an expired sign-in signs in again straight away
  $('acct-signin').addEventListener('click', () => (account ? signInAndSync() : showWelcome(true)));
  $('acct-btn').addEventListener('click', () => openMenu($('acct-menu').hidden));
  $('acct-signout').addEventListener('click', async () => {
    openMenu(false);
    rememberSkip(false); // before Auth0's logout takes the page away: it comes back to the first page
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

  // signed in with Auth0, or chose to carry on without an account: straight to the app. A development name (sync
  // card) doesn't count as signed in.
  if (!account?.auth0 && !skipped()) showWelcome(true);
}
initAccount();
