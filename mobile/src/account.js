// Who is signed in, and keeping this phone and the server in step. Quilts and fabric photos use the web app's own storage
// and sync (app/src/storage), so they behave the same; folders, notes and quilt photos come after them.
import { repo } from '../../app/src/storage/repo.js';
import { createSync } from '../../app/src/storage/sync.js';
import { signIn, signInToken, signOut } from './auth.js';
import { adoptOrganize, forgetOrganize, syncOrganize } from './organize.js';
import { adoptPhotos, forgetPhotos, syncPhotos } from './photos.js';
import { onStoreChange, openStore } from './store.js';

const API_URL = __API_URL__;
const SOON_MS = 2500,
  EVERY_MS = 60000;

/** @type {Set<() => void>} */
const listeners = new Set();
/** Calls f when what the screens show may have changed (a sync, another account). @param {() => void} f */
const onAccountChange = f => void listeners.add(f);
const tell = () => listeners.forEach(f => f());

const sync = createSync({
  repo,
  getToken: signInToken,
  onRemote: tell,
});

const signedIn = () => !!sync.config();
/** The email (or name) shown for the account. */
const whoAmI = () => sync.config()?.who || sync.config()?.user || '';

/** What to send to the server to say who's asking; nothing when signed out or when it can't be had. */
async function authHeaders() {
  const c = sync.config();
  if (!c) return {};
  if (!c.auth0) return { 'x-dev-user': c.user };
  try {
    return { authorization: `Bearer ${await signInToken()}` };
  } catch (e) {
    return {};
  }
}

let lastProblem = '';
/** What went wrong in the last sync of folders and photos, for the person. */
const syncProblem = () => sync.status().message || lastProblem;

/** One whole sync: quilts and fabric photos first, as the others refer to them. */
async function syncOnce() {
  if (!signedIn()) return;
  try {
    await sync.syncNow();
    lastProblem = '';
    if (!['ok', 'error'].includes(sync.status().state)) return; // offline or signed out: nothing more would work
    await syncOrganize(sync.request);
    const { errors } = await syncPhotos(sync.request);
    lastProblem = errors.join(' ');
  } catch (e) {
    // the status says why (offline, signed out); what's here is safe, and the next sync carries on
  }
}

let syncing = null,
  again = false;
/** Syncs now, or right after the sync that's running, which may have missed what was just asked for. */
function syncEverything() {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
    syncing = null;
    tell();
  })();
  return syncing;
}

let soon = /** @type {any} */ (0);
function syncSoon() {
  clearTimeout(soon);
  soon = setTimeout(syncEverything, SOON_MS);
}

/** Opens the storage and starts syncing, if someone is signed in. */
async function startAccount() {
  await repo.openStorage({ legacy: null });
  await openStore();
  repo.onChange(syncSoon);
  onStoreChange(syncSoon);
  window.addEventListener('online', syncEverything);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncEverything();
  });
  setInterval(syncEverything, EVERY_MS);
  syncEverything();
}

/** Signs in (from a tap). @returns {Promise<void>} */
async function signInNow() {
  const who = await signIn();
  sync.configure(who.sub ? { url: API_URL, auth0: who.sub, who: who.who } : { url: API_URL, user: who.user });
  // what was kept on this phone without an account goes with this one
  repo.designs.adoptStrays();
  repo.fabrics.adoptStrays();
  adoptOrganize();
  adoptPhotos();
  tell();
  syncEverything();
}

/** Signs out: this account's things stay on the phone, out of sight, until it signs in again. */
async function signOutNow() {
  const was = sync.config();
  sync.configure(null);
  await repo.flush();
  tell();
  if (was?.auth0) await signOut().catch(() => {});
}

/**
 * Deletes the account on the server, and this phone's copy of it. @returns {Promise<void>} fails when the server refuses or
 * can't be reached, and then nothing is removed here.
 */
async function deleteAccountNow() {
  const r = await sync.request('DELETE', '/v1/account', { confirm: 'DELETE' });
  if (r.status !== 200) throw new Error(r.body?.message || String(r.status));
  for (const side of [repo.designs, repo.fabrics]) {
    for (const x of side.list()) side.purge(x.id);
    for (const x of side.dirty()) side.purge(x.id);
  }
  forgetOrganize();
  forgetPhotos();
  await signOutNow();
}

export {
  authHeaders,
  deleteAccountNow,
  onAccountChange,
  signInNow,
  signOutNow,
  signedIn,
  startAccount,
  sync,
  syncEverything,
  syncProblem,
  whoAmI,
};
