// The sync card on My designs, and sync running in the background: after changes here (a few seconds later),
// when the connection comes back, every minute while the page is open, and on "Sync now".
// The engine is storage/sync.js; this module shows what it does and fits what arrives into the open app.
import '../timeline/timeline.js'; // load order: runs after timeline/timeline
import { $ } from '../core/dom.js';
import { design, mineCur, setMineCur } from '../core/store.js';
import { createSync } from '../storage/sync.js';
import { signIn, signInToken, signOut } from '../storage/auth0.js';
import { onChange, repo } from '../storage/repo.js';
import { notify } from '../ui/notice.js';
import { openDesign } from '../designer/dispatch.js';
import { addStoredFabric } from '../designer/fabric-library.js';
import { drawFabricPalette } from '../designer/parts-editor.js';
import { adoptDesignId, mineSave, renderMine } from './my-designs.js';
import { state } from '../sim/config.js';

const AFTER_CHANGE_MS = 2500,
  EVERY_MS = 60_000;

/** what the open quilt looked like when a sync started: to tell "unchanged here" from "unsaved edits" */
let before = null;
/** @type {import('../storage/sync.js').RemoteEvent[]} */
let arrived = [];

/** what wants to know when the account or sync state changes (onAccount) @type {((c: any, s: import('../storage/sync.js').SyncStatus) => void)[]} */
const watchers = [];
const sync = createSync({ repo, onRemote: e => arrived.push(e), onStatus: showStatus, getToken: signInToken });

const time = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
/** @param {import('../storage/sync.js').SyncStatus} s */
function showStatus(s) {
  const c = sync?.config?.();
  $('sync-dot').dataset.state = s.state;
  const waiting = s.pending ? ` · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : '';
  const text = {
    off: 'Sync is off: your designs are kept in this browser only.',
    syncing: 'Syncing…',
    ok: s.at ? `Synced at ${time(s.at)}${waiting}` : `Connected${waiting}`,
    offline: `Can't reach the server: changes wait here and go when it's back${waiting}.`,
    login: `Signed out: ${s.message || 'sign in again'}`,
    error: s.message || 'Something went wrong.',
  }[s.state];
  $('sync-state').textContent =
    c && s.state !== 'off' ? `${text} (${c.who || c.user} at ${new URL(c.url).host})` : text;
  $('sync-now').hidden = !c || s.state === 'login';
  $('sync-setup').textContent = !c ? 'Sign in to sync' : s.state === 'login' ? 'Sign in' : 'Account';
  for (const fn of watchers) fn(c, s);
}

// ---- signing in and out, shared by the sync card, the welcome page and the account corner (mine/account.js)
/** the quilt server signing in uses when none was set up on this device */
const DEFAULT_SERVER = 'http://localhost:8787';
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
  let who;
  try {
    who = await signIn({ signup });
  } catch (e) {
    const closed = /popup|cancel/i.test(`${e?.error || ''} ${e?.message || ''}`);
    return closed ? 'Sign-in was closed before it finished.' : `Couldn't sign in: ${e?.message || e}`;
  }
  sync.configure({ url: url || sync.config()?.url || DEFAULT_SERVER, auth0: who.sub, who: who.who });
  run();
  return '';
}
/** Signs out on this device: sync stops, the designs here stay. */
async function signOutAndStop() {
  const was = sync.config();
  sync.configure(null);
  // signing out of Auth0 leaves the page for a moment: what's waiting to be saved here goes first
  await repo.flush();
  if (was?.auth0) await signOut().catch(() => {});
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
      notify(`“${e.name}” was also changed on another device. Both are kept: yours is now “${e.name} (this device)”.`);
      // the quilt open here is this device's version: it carries on as the copy
      if (before?.id === e.id) adoptDesignId(e.copyId);
    } else if (e.kind === 'restored') notify(`“${e.name}” was changed on another device, so it is back in My designs.`);
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
    notify(`“${e.name}” was deleted on another device. It stays open here as an unsaved quilt.`);
  } else if (unsaved)
    notify(`“${e.name}” was changed on another device. Your unsaved changes here are kept; save to keep yours.`);
  else {
    const r = repo.designs.get(e.id);
    if (r) openDesign(r.design, { keepFocus: true, quiet: true });
    notify(`“${e.name}” was updated from another device.`);
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
    $('sync-user').value = c?.user || '';
    $('sync-off').hidden = !c;
    $('sync-off').textContent = c?.auth0 ? 'Sign out' : 'Turn sync off';
    $('sync-signin').textContent = c?.auth0 ? 'Sign in again' : 'Sign in';
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

export { run as syncNow, onAccount, signInAndSync, signOutAndStop };
