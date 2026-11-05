// The sync card on My designs, and sync running in the background: after changes here (a few seconds later),
// when the connection comes back, every minute while the page is open, and on "Sync now".
// The engine is storage/sync.js; this module shows what it does and fits what arrives into the open app.
import '../timeline/timeline.js'; // load order: runs after timeline/timeline
import { $ } from '../core/dom.js';
import { design, mineCur, setMineCur } from '../core/store.js';
import { createSync } from '../storage/sync.js';
import { API_URL } from '../core/build-settings.js';
import { signIn, signInToken, signOut, tokenMayGoTo } from '../storage/auth0.js';
import { onChange, repo } from '../storage/repo.js';
import { notify } from '../ui/notice.js';
import { openDesign } from '../designer/dispatch.js';
import { addStoredFabric } from '../designer/fabric-library.js';
import { drawFabricPalette } from '../designer/parts-editor.js';
import { adoptDesignId, mineSave, renderMine, startNew } from './my-designs.js';
import { state } from '../sim/config.js';
import { getLang, t, tn } from '@quilt/shared/i18n.js';

const AFTER_CHANGE_MS = 2500,
  EVERY_MS = 60_000;

/** what the open quilt looked like when a sync started: to tell "unchanged here" from "unsaved edits" */
let before = null;
/** @type {import('../storage/sync.js').RemoteEvent[]} */
let arrived = [];

/** what wants to know when the account or sync state changes (onAccount) @type {((c: any, s: import('../storage/sync.js').SyncStatus) => void)[]} */
const watchers = [];
// no token (so "please sign in") for an address it may not go to: one saved earlier, say
const sync = createSync({
  repo,
  onRemote: e => arrived.push(e),
  onStatus: showStatus,
  getToken: async () => (tokenMayGoTo(sync.config()?.url) ? signInToken() : null),
});

const time = at => new Date(at).toLocaleTimeString([getLang()], { hour: '2-digit', minute: '2-digit' });
/** @param {import('../storage/sync.js').SyncStatus} s */
function showStatus(s) {
  const c = sync?.config?.();
  $('sync-dot').dataset.state = s.state;
  const waiting = s.pending ? tn(s.pending, ' · {n} change waiting', ' · {n} changes waiting') : '';
  const text = {
    off: t('Your designs are kept on this computer. Sign in to have them on your other devices too.'),
    syncing: t('Syncing…'),
    ok: s.at ? t('Synced at {time}{waiting}', { time: time(s.at), waiting }) : t('Connected{waiting}', { waiting }),
    offline: t("Can't reach the server: changes wait here and go when it's back{waiting}.", { waiting }),
    login: t('Signed out: {why}', { why: s.message || t('sign in again') }),
    error: s.message || t('Something went wrong.'),
  }[s.state];
  $('sync-state').textContent =
    c && s.state !== 'off'
      ? t('{status} ({who} at {host})', { status: text, who: c.who || c.user, host: new URL(c.url).host })
      : text;
  $('sync-now').hidden = !c || s.state === 'login';
  $('sync-setup').textContent = !c ? t('Sign in to sync') : s.state === 'login' ? t('Sign in') : t('Account');
  for (const fn of watchers) fn(c, s);
}

// ---- signing in and out, shared by the sync card, the welcome page and the account corner (mine/account.js)
/** the quilt server signing in uses when none was set up on this device */
const DEFAULT_SERVER = API_URL || 'http://localhost:8787';
/** Calls fn now and whenever the account or sync state changes. @param {(typeof watchers)[number]} fn */
function onAccount(fn) {
  watchers.push(fn);
  fn(sync.config(), sync.status());
}
/**
 * Signs in with Auth0 (from a click: its window opens at once) and syncs with the server. Resolves with an error
 * to show, or '' when signed in. @param {{ url?: string, signup?: boolean }} [o] @returns {Promise<string>}
 */
async function signInAndSync({ url, signup = false } = {}) {
  if (url && !tokenMayGoTo(url)) return t('Sign-in only works with this app’s own server.');
  let who;
  try {
    who = await signIn({ signup });
  } catch (e) {
    const closed = /popup|cancel/i.test(`${e?.error || ''} ${e?.message || ''}`);
    return closed
      ? t('Sign-in was closed before it finished.')
      : t("Couldn't sign in: {why}", { why: e?.message || e });
  }
  const saved = sync.config()?.url;
  sync.configure({ url: url || (tokenMayGoTo(saved) ? saved : DEFAULT_SERVER), auth0: who.sub, who: who.who });
  accountChanged();
  run();
  return '';
}
/**
 * Signs out on this device: sync stops; the account's designs stay here but out of sight (storage/repo.js) until
 * it signs in again, and a new design is opened, so the next person doesn't find the last one's quilt open.
 */
async function signOutAndStop() {
  const was = sync.config();
  if (was) startNew(); // the open quilt's timeline is kept with it
  sync.configure(null);
  accountChanged();
  // signing out of Auth0 leaves the page for a moment: what's waiting to be saved here goes first
  await repo.flush();
  if (was?.auth0) await signOut().catch(() => {});
}
/** Another account (or none): My designs shows its designs; designs made here without one are offered to it. */
function accountChanged() {
  if (state.page === 'mine') renderMine();
  if (!repo.account()) return;
  const d = repo.designs.strays().length,
    f = repo.fabrics.strays().length;
  if (!d && !f) return;
  const someDesigns = tn(d, '{n} design', '{n} designs'),
    somePhotos = tn(f, '{n} fabric photo', '{n} fabric photos'),
    what =
      d && f ? t('{designs} and {photos}', { designs: someDesigns, photos: somePhotos }) : d ? someDesigns : somePhotos;
  const offer =
    d + f === 1
      ? t('{what} made on this device without an account. Add it to your account?', { what })
      : t('{what} made on this device without an account. Add them to your account?', { what });
  notify(offer, {
    ms: 20000,
    action: {
      label: t('Add to my account'),
      run: () => {
        repo.designs.adoptStrays();
        repo.fabrics.adoptStrays();
        if (state.page === 'mine') renderMine();
        run();
      },
    },
  });
}

async function run() {
  if (!sync.config()) return;
  const rec = mineCur ? repo.designs.get(mineCur) : null;
  before = { id: mineCur, saved: rec ? JSON.stringify(rec.design) : null, open: JSON.stringify(design) };
  arrived = [];
  await sync.syncNow();
  await fitIn(arrived);
}

/** What arrived from other devices: into the fabric list, My designs, and the open quilt where safe. */
async function fitIn(events) {
  let fabricsChanged = false,
    designsChanged = false;
  for (const e of events) {
    if (e.kind === 'fabric') {
      const f = repo.fabrics.get(e.id);
      if (f?.blob) {
        addStoredFabric(f);
        fabricsChanged = true;
      }
      continue;
    }
    designsChanged = true;
    if (e.kind === 'conflict') {
      notify(
        t('“{name}” was also changed on another device. Both are kept: yours is now “{name} (this device)”.', {
          name: e.name,
        }),
      );
      // the quilt open here is this device's version: it carries on as the copy
      if (before?.id === e.id) adoptDesignId(e.copyId);
    } else if (e.kind === 'restored')
      notify(t('“{name}” was changed on another device, so it is back in My designs.', { name: e.name }));
    else if (e.kind === 'design' && before?.id === e.id) openOrKeep(e);
  }
  if (fabricsChanged) drawFabricPalette();
  if (designsChanged && state.page === 'mine') renderMine();
}

/** The quilt open here changed on another device: show the new version, unless it has unsaved edits here. */
function openOrKeep(e) {
  const unsaved = before.open !== before.saved;
  if (e.deleted) {
    setMineCur(null);
    mineSave();
    notify(t('“{name}” was deleted on another device. It stays open here as an unsaved quilt.', { name: e.name }));
  } else if (unsaved)
    notify(
      t('“{name}” was changed on another device. Your unsaved changes here are kept; save to keep yours.', {
        name: e.name,
      }),
    );
  else {
    const r = repo.designs.get(e.id);
    if (r) openDesign(r.design, { keepFocus: true, quiet: true });
    notify(t('“{name}” was updated from another device.', { name: e.name }));
  }
}

let timer = 0;
const soon = (ms = AFTER_CHANGE_MS) => {
  clearTimeout(timer);
  if (sync.config()) timer = setTimeout(run, ms);
};

function initSyncUI() {
  const form = $('sync-form'),
    err = $('sync-err');
  const say = msg => {
    err.textContent = msg;
    err.hidden = !msg;
  };
  const openForm = () => {
    const c = sync.config();
    $('sync-url').value = c?.url || DEFAULT_SERVER;
    // the published page has one server: nothing to choose, and no development sign-in
    if (API_URL) {
      $('sync-url').value = API_URL;
      /** @type {HTMLElement} */ ($('sync-url').closest('label')).hidden = true;
      /** @type {HTMLElement} */ (form.querySelector('.sync-dev')).hidden = true;
    }
    $('sync-user').value = c?.user || '';
    $('sync-off').hidden = !c;
    $('sync-off').textContent = c?.auth0 ? t('Sign out') : t('Turn sync off');
    $('sync-signin').textContent = c?.auth0 ? t('Sign in again') : t('Sign in');
    say('');
    form.hidden = false;
    $('sync-signin').focus();
  };
  $('sync-setup').addEventListener('click', () => (form.hidden ? openForm() : (form.hidden = true)));
  $('sync-cancel').addEventListener('click', () => (form.hidden = true));
  $('sync-off').addEventListener('click', () => {
    form.hidden = true;
    signOutAndStop();
  });
  // Auth0's window opens straight from the click (browsers block windows opened later)
  $('sync-signin').addEventListener('click', async () => {
    if (!$('sync-url').reportValidity()) return;
    say('');
    const msg = await signInAndSync({ url: $('sync-url').value });
    say(msg);
    if (!msg) form.hidden = true;
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!$('sync-user').value.trim()) return $('sync-user').focus();
    sync.configure({ url: $('sync-url').value, user: $('sync-user').value });
    accountChanged();
    form.hidden = true;
    run();
  });
  $('sync-now').addEventListener('click', run);
  onChange(() => soon());
  addEventListener('online', () => soon(500));
  setInterval(() => document.visibilityState === 'visible' && soon(0), EVERY_MS);
  showStatus(sync.status());
  if (sync.config()) {
    showStatus({ state: 'ok', pending: repo.designs.dirty().length + repo.fabrics.dirty().length });
    soon(1500);
  }
}
initSyncUI();

// ---- the server, for the community (mine/community.js)
/** Who is signed in for sync (null: nobody). */
const signedIn = () => sync.config();
/** A call as the signed-in account: { status, body }. @param {string} method @param {string} path @param {any} [body] */
const serverCall = (method, path, body) => sync.request(method, path, body);
/**
 * A call anyone may make (the community's quilts): as the signed-in account when there is one (so its own are
 * marked), otherwise without signing in, to the server set up here or the usual one. @param {string} path
 * @returns {Promise<{ status: number, body: any }>}
 */
async function publicCall(path) {
  if (sync.config()) return sync.request('GET', path);
  const r = await fetch(DEFAULT_SERVER + path);
  return { status: r.status, body: await r.json().catch(() => null) };
}

export { run as syncNow, onAccount, publicCall, serverCall, signedIn, signInAndSync, signOutAndStop };
