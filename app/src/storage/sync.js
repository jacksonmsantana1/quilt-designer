// Sync with the server (server/README.md): saved quilts and fabric photos follow the person between devices.
// No side effects when loaded: createSync() makes a sync for one storage (storage/repo.js); the app's is wired up
// in mine/sync-ui.js, the tests make one per "device".
//
// One sync: first send what changed here (photos first, so the quilts that use them find them), then fetch what
// changed elsewhere since the last sync (change number `since`). This device's storage stays the one the app reads
// and writes; the server is a meeting point, so the app works the same without it.
//
// Conflicts (the same quilt changed on two devices before either synced): nothing is lost. The other device's
// version keeps the quilt's place, and this device's version is kept as a copy named "… (this device)".
// A quilt deleted here but changed elsewhere comes back with the change.

import { getLang, t } from '@quilt/shared/i18n.js';

/** @typedef {ReturnType<import('./repo.js').createRepo>} Repo */
/**
 * @typedef {object} SyncStatus
 * @property {'off' | 'syncing' | 'ok' | 'offline' | 'login' | 'error'} state
 * @property {number} [at]       when the last sync finished (ms)
 * @property {string} [message]  for the person: what went wrong, or what happened
 * @property {number} pending    changes here not on the server yet
 */
/**
 * What another device changed, for the app to show:
 * {kind: 'design', id, deleted} · {kind: 'fabric', id, deleted} · {kind: 'conflict', id, copyId, name} · {kind: 'restored', id, name}
 * @typedef {{ kind: string, id: string, [k: string]: any }} RemoteEvent
 */

const SESSION_KEY = 'sync';
const FABRIC_ID = /^f[0-9a-f]{24}$/;

/**
 * What the server's answer means, in the language in use. The server writes its messages in English and names each
 * error with a code: English shows the server's words, other languages the sentence for the code.
 * @param {any} json the answer @param {number} status
 * @param {string} [otherwise] when the answer doesn't say @returns {string}
 */
function serverSays(json, status, otherwise = t('The server answered {status}.', { status })) {
  if (getLang() === 'en') return json?.message || otherwise;
  /** @type {Record<string, string>} */
  const byCode = {
    bad_request: t('The server did not accept this request.'),
    forbidden: t('This is not allowed (or the link has expired).'),
    not_found: t('That was not found on the server.'),
    server_error: t('Something went wrong on the server.'),
    unauthorized: t('Please sign in again.'),
    conflict: t('It was changed somewhere else.'),
    not_a_quilt: t('The design could not be read as a quilt.'),
    not_uploaded: t('The image has not arrived in storage yet.'),
    wrong_image: t('The uploaded image is not the one this fabric id names.'),
    author_email: t('The author name is shown to everyone: please don’t use an email.'),
    photos_missing: t('Some of its fabric photos are not on the server yet: sync first.'),
    rate_limited: t('Too many requests. Please wait a moment.'),
    storage_full: t('There is no more room in this account.'),
    too_large: t('This quilt is too large to share with the community.'),
    share_blocked: t('This account can no longer share with the community.'),
    taken_down: t('This quilt was taken down from the community.'),
  };
  return byCode[json?.error] ?? otherwise;
}
/**
 * Why the server refused something, to follow "was refused:" (English shows the bare status when it says nothing).
 * @param {any} json @param {number} status
 */
const refusal = (json, status) => (getLang() === 'en' ? json?.message || status : serverSays(json, status));

/**
 * The account's key on this device (what records' `owner` holds): Auth0's id, or `dev:<name>` for the development
 * sign-in. @param {{ auth0?: string, user?: string }} c @returns {string}
 */
const accountOf = c => c.auth0 || `dev:${(c.user || '').trim().toLowerCase()}`;

/** A request failed in a way that stops this sync (offline, signed out, server down). */
class StopSync extends Error {
  /** @param {SyncStatus['state']} state @param {string} message */
  constructor(state, message) {
    super(message);
    this.state = state;
  }
}

/**
 * @param {{ repo: Repo, fetch?: typeof fetch, onRemote?: (e: RemoteEvent) => void, onStatus?: (s: SyncStatus) => void, getToken?: () => Promise<string> }} deps
 *   getToken: a fresh sign-in token for the server (storage/auth0.js), for accounts signed in with Auth0
 */
function createSync({
  repo,
  fetch: fetchFn = (url, init) => globalThis.fetch(url, init),
  onRemote = () => {},
  onStatus = () => {},
  getToken = () => Promise.reject(new Error('no sign-in')),
}) {
  /** @type {SyncStatus} */
  let status = { state: 'off', pending: 0 };
  let running = null,
    again = false;

  /**
   * The server and who is signed in: an Auth0 account (auth0 = its id, who = the email to show) or, in development,
   * a name (user). @returns {{ url: string, user?: string, auth0?: string, who?: string, since: number, at?: number } | null}
   */
  const config = () => repo.getSession(SESSION_KEY) || null;
  // set up before records had owners: what was synced belongs to that account (once)
  if (config() && !repo.account()) {
    const acc = accountOf(config());
    repo.setAccount(acc);
    repo.designs.claimSynced(acc);
    repo.fabrics.claimSynced(acc);
  }
  const pendingCount = () => repo.designs.dirty().length + repo.fabrics.dirty().length;
  const setStatus = s => {
    status = { ...status, ...s, pending: pendingCount() };
    onStatus(status);
  };

  /**
   * Turns sync on with a server address and an account (signed in with Auth0, or a development name), or off with
   * null. A different server or account starts afresh: everything here is sent to it.
   * @param {{ url: string, user?: string, auth0?: string, who?: string } | null} c
   */
  function configure(c) {
    const old = config();
    if (!c) {
      repo.setSession(SESSION_KEY, undefined);
      repo.setAccount(null); // nobody's: only what was made here without an account is listed
      setStatus({ state: 'off', message: '' });
      return;
    }
    const url = c.url.trim().replace(/\/+$/, ''),
      who = c.auth0 ? { auth0: c.auth0, who: c.who || c.auth0 } : { user: (c.user || '').trim() },
      same = old && old.url === url && old.user === who.user && old.auth0 === who.auth0;
    // whose designs are listed and synced from now on (storage/repo.js)
    repo.setAccount(accountOf(who));
    if (!same) {
      // another server: this account's designs here are all new to it. Another account on the same server: it
      // only fetches its own (since 0); the other account's stay here, unsent
      if (!old || old.url !== url) {
        repo.designs.resetSync();
        repo.fabrics.resetSync();
      }
      repo.setSession(SESSION_KEY, { url, ...who, since: 0 });
    } else if (who.who && old.who !== who.who) repo.setSession(SESSION_KEY, { ...old, who: who.who });
    setStatus({ state: 'ok', message: '' });
  }

  /** One API call: { status, body }. Network failures and 401 stop the sync. */
  async function api(method, path, body) {
    const c = /** @type {NonNullable<ReturnType<typeof config>>} */ (config());
    let r, login;
    if (c.auth0) {
      // a fresh token each time (the Auth0 library keeps it and renews it); none means signed out on this device
      const token = await getToken().catch(() => null);
      if (!token) throw new StopSync('login', t('Please sign in again.'));
      login = { authorization: `Bearer ${token}` };
    } else login = { 'x-dev-user': c.user };
    try {
      r = await fetchFn(c.url + path, {
        method,
        headers: { ...login, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new StopSync('offline', t('The server could not be reached.'));
    }
    const json = await r.json().catch(() => null);
    if (r.status === 401) throw new StopSync('login', serverSays(json, r.status, t('Not signed in.')));
    // too many requests: stop here, nothing is lost, and the next sync carries on
    if (r.status >= 500 || r.status === 429) throw new StopSync('error', serverSays(json, r.status));
    return { status: r.status, body: json };
  }

  const sameDesign = (a, b) => a.name === b.name && JSON.stringify(a.design) === JSON.stringify(b.design);

  /** The quilt was changed here and elsewhere: the server's version keeps its place, this one becomes a copy. */
  function conflict(local, server) {
    if (server && !server.deleted && sameDesign(local, server)) {
      repo.designs.markSynced(local.id, local.rev, server.rev); // the same change made twice: nothing to keep apart
      return;
    }
    const copy = repo.designs.save({
      id: repo.designs.newId(),
      name: t('{name} (this device)', { name: local.name }),
      design: local.design,
    });
    if (server) repo.designs.applyRemote(server);
    else repo.designs.purge(local.id);
    onRemote({ kind: 'conflict', id: local.id, copyId: copy.id, name: local.name, deleted: !server || server.deleted });
  }

  // ---- sending what changed here
  async function pushFabrics(errors) {
    for (const r of repo.fabrics.dirty()) {
      const base = r.syncRev || 0;
      if (r.deleted) {
        if (!base) repo.fabrics.purge(r.id);
        else {
          const res = await api('DELETE', `/v1/fabrics/${r.id}?baseRev=${base}`);
          repo.fabrics.markSynced(r.id, r.rev, res.body?.record?.rev ?? base);
        }
        continue;
      }
      if (!FABRIC_ID.test(r.id) || !r.blob) {
        errors.push(
          t("“{name}” was added on a page that can't fingerprint photos, so it stays on this device.", {
            name: r.name,
          }),
        );
        continue;
      }
      const type = ['image/jpeg', 'image/png', 'image/webp'].includes(r.blob.type) ? r.blob.type : 'image/jpeg';
      const up = await api('POST', `/v1/fabrics/${r.id}/upload`, {
        name: r.name.slice(0, 80),
        cm: Math.max(1, Math.min(300, r.cm || 15)),
        type,
        bytes: r.blob.size,
      });
      if (up.status !== 200) {
        errors.push(t('The photo “{name}” was refused: {why}', { name: r.name, why: refusal(up.body, up.status) }));
        continue;
      }
      if (up.body.status === 'upload') {
        let put;
        try {
          put = await fetchFn(up.body.url, { method: 'PUT', headers: up.body.headers, body: r.blob });
        } catch (e) {
          throw new StopSync('offline', t('The photo storage could not be reached.'));
        }
        if (!put.ok) {
          errors.push(t('The photo “{name}” could not be uploaded ({status}).', { name: r.name, status: put.status }));
          continue;
        }
        const done = await api('POST', `/v1/fabrics/${r.id}/done`);
        if (done.status !== 200) {
          errors.push(
            t('The photo “{name}” was refused: {why}', { name: r.name, why: refusal(done.body, done.status) }),
          );
          continue;
        }
        repo.fabrics.markSynced(r.id, r.rev, done.body.record.rev);
      } else repo.fabrics.markSynced(r.id, r.rev, up.body.record.rev);
    }
  }

  async function pushDesigns(errors) {
    // a conflict makes a new copy to send: a few rounds at most
    for (let round = 0; round < 3; round++) {
      const dirty = repo.designs.dirty().filter(r => !errors.skip.has(r.id + ':' + r.rev));
      if (!dirty.length) return;
      for (const r of dirty) {
        const base = r.syncRev || 0;
        if (r.deleted) {
          if (!base) {
            repo.designs.purge(r.id);
            continue;
          }
          const res = await api('DELETE', `/v1/designs/${r.id}?baseRev=${base}`);
          if (res.status === 409 && res.body?.server && !res.body.server.deleted) {
            // changed on another device: that change wins over this deletion
            repo.designs.applyRemote(res.body.server);
            onRemote({ kind: 'restored', id: r.id, name: res.body.server.name });
          } else repo.designs.markSynced(r.id, r.rev, res.body?.record?.rev ?? base);
          continue;
        }
        const res = await api('PUT', `/v1/designs/${r.id}`, {
          name: r.name.slice(0, 80) || t('Quilt'),
          design: r.design,
          baseRev: base,
        });
        if (res.status === 200 || res.status === 201) {
          const rec = res.body.record;
          // the server may have repaired the quilt (format checks): keep its version
          repo.designs.markSynced(r.id, r.rev, rec.rev, { design: rec.design });
        } else if (res.status === 409) conflict(r, res.body?.server ?? null);
        else {
          errors.push(t('“{name}” was not sent: {why}', { name: r.name, why: refusal(res.body, res.status) }));
          errors.skip.add(r.id + ':' + r.rev); // not again until it changes
        }
      }
    }
  }

  // ---- fetching what changed elsewhere
  async function pull() {
    for (let page = 0; page < 1000; page++) {
      const c = config();
      if (!c) return;
      const res = await api('GET', `/v1/changes?since=${c.since}&limit=200`);
      if (res.status !== 200)
        throw new StopSync('error', serverSays(res.body, res.status, t('Changes could not be read.')));
      for (const ch of res.body.changes) await applyChange(ch);
      repo.setSession(SESSION_KEY, { ...config(), since: res.body.since });
      if (!res.body.more) return;
    }
  }

  async function applyChange(ch) {
    const side = ch.kind === 'design' ? repo.designs : repo.fabrics,
      local = side.raw(ch.id);
    if (local && (local.syncRev || 0) >= ch.rev) return; // this device's own change, coming back
    if (ch.kind === 'design') {
      if (local && local.dirty && !local.deleted) return conflict(local, ch);
      side.applyRemote(ch);
      onRemote({ kind: 'design', id: ch.id, deleted: ch.deleted, name: ch.name });
      return;
    }
    if (ch.deleted) {
      side.applyRemote(ch);
      onRemote({ kind: 'fabric', id: ch.id, deleted: true });
      return;
    }
    let blob = local?.blob || null;
    if (!blob) {
      const meta = await api('GET', `/v1/fabrics/${ch.id}`);
      if (meta.status !== 200 || !meta.body.url) return;
      try {
        const r = await fetchFn(meta.body.url);
        if (!r.ok) return;
        blob = new Blob([await r.arrayBuffer()], { type: ch.type });
      } catch (e) {
        throw new StopSync('offline', t('The photo storage could not be reached.'));
      }
    }
    side.applyRemote({ ...ch, blob });
    onRemote({ kind: 'fabric', id: ch.id, deleted: false });
  }

  /** One sync now (or right after the one running). Resolves with the status. */
  async function syncNow() {
    if (!config()) return status;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        setStatus({ state: 'syncing' });
        /** @type {string[] & { skip?: Set<string> }} */
        const errors = Object.assign([], { skip: new Set() });
        try {
          await pushFabrics(errors);
          await pushDesigns(errors);
          await pull();
          await repo.flush();
          const c = config();
          if (c) repo.setSession(SESSION_KEY, { ...c, at: Date.now() });
          setStatus({ state: errors.length ? 'error' : 'ok', at: Date.now(), message: errors.join(' ') });
        } catch (e) {
          if (e instanceof StopSync) setStatus({ state: e.state, message: e.message });
          else setStatus({ state: 'error', message: e?.message || String(e) });
          again = false;
        }
      } while (again);
      running = null;
      return status;
    })();
    return running;
  }

  /**
   * One call to the server as the signed-in account (mine/community.js): { status, body }; throws when offline,
   * signed out or the server fails (the message says which). @param {string} method @param {string} path @param {any} [body]
   */
  async function request(method, path, body) {
    if (!config()) throw new Error(t('Sign in first.'));
    try {
      return await api(method, path, body);
    } catch (e) {
      if (e instanceof StopSync) setStatus({ state: e.state, message: e.message });
      throw e;
    }
  }

  return { configure, config, request, syncNow, status: () => status };
}

export { createSync, serverSays };
