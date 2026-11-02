// The community: quilts shared by quilters (server/src/routes/community.js). Share (the round button under New and
// Save, "Share current design" on the Community page, and ⋯ on My designs) publishes a copy of a quilt under the
// author name the person chooses; sharing again updates it; Stop sharing takes it away. The Community page lists
// everyone's, newest first, and Copy to my designs adds one to My designs, with its fabric photos.
import './account.js'; // load order: runs after mine/account
import { $ } from '../core/dom.js';
import { design, mineCur, readOnly } from '../core/store.js';
import { designs, fabrics as photoStore } from '../storage/repo.js';
import { readDesign } from '@quilt/shared/format.js';
import { notify } from '../ui/notice.js';
import { state } from '../sim/config.js';
import { showPage } from '../app/pages.js';
import { addStoredFabric, isFabric, loadFabrics } from '../designer/fabric-library.js';
import { fabricIdsIn } from '../core/fabric-picks.js';
import { onAccount, publicCall, serverCall, signedIn, signInAndSync, syncNow } from './sync-ui.js';
import { openMine, quiltPicture, renderMine, saveCurrent, shownName } from './my-designs.js';
import { communityHooks, setSharedIds, sharedIds } from './shared-state.js';
import { serverSays } from '../storage/sync.js';
import { getLang, t, tn } from '@quilt/shared/i18n.js';

const AUTHOR_KEY = 'quilt-author.v1';
const PHOTO_ID = /^f[0-9a-f]{24}$/;

/** How many of the person's own fabric photos a quilt uses (they are shared with it). @param {any} d */
function photoCount(d) {
  const ids = new Set();
  const walk = x => {
    if (typeof x === 'string') {
      if (PHOTO_ID.test(x)) ids.add(x);
    } else if (x && typeof x === 'object') for (const v of Object.values(x)) walk(v);
  };
  walk(d);
  return ids.size;
}
/**
 * A fingerprint of a quilt (as read and checked): the same quilt, whatever the order of its keys, gives the same
 * one. A copy from the community keeps its original's, to tell whether it has been changed since.
 * @param {any} d @returns {string}
 */
function quiltSig(d) {
  const r = readDesign(d);
  const stable = x =>
    Array.isArray(x)
      ? `[${x.map(stable).join(',')}]`
      : x && typeof x === 'object'
        ? `{${Object.keys(x)
            .sort()
            .map(k => JSON.stringify(k) + ':' + stable(x[k]))
            .join(',')}}`
        : JSON.stringify(x);
  const text = stable(r ? r.design : d);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16) + ':' + text.length;
}
/** A copy from the community not changed since: { name, author } of the quilt it copies, or null. @param {any} rec @param {any} d */
const unchangedCopy = (rec, d) => (rec?.from && quiltSig(d) === rec.from.sig ? rec.from : null);

const remembered = () => {
  try {
    return localStorage.getItem(AUTHOR_KEY) || '';
  } catch (e) {
    return '';
  }
};
/** @param {string} msg */
const say = msg => {
  $('share-err').textContent = msg;
  $('share-err').hidden = !msg;
};
/**
 * Why a call to the server failed, for the person. A failed fetch carries the browser's own English message.
 * @param {any} e
 */
const why = e =>
  e instanceof TypeError && getLang() !== 'en'
    ? t('The server could not be reached.')
    : (e && e.message) || t('Something went wrong.');

// ---- the share dialog
/** what the dialog shares: a saved design (from My designs) or, with null, the quilt being edited */
let target = /** @type {string | null} */ (null);
/** Opens the share dialog for a saved design, or (null) for the quilt being edited. @param {string | null} id */
function openShare(id) {
  target = id;
  const rec = id ? designs.get(id) : mineCur ? designs.get(mineCur) : null;
  const d = id ? rec?.design : design;
  if (!d) return;
  const pic = quiltPicture(readDesign(d)?.design || d, 260);
  pic.id = 'share-cv';
  pic.setAttribute('aria-hidden', 'true');
  $('share-cv').replaceWith(pic);
  $('share-name').value = rec ? shownName(rec) : '';
  $('share-author').value = remembered();
  const shared = !!rec && sharedIds.has(rec.id),
    signed = !!signedIn(),
    n = photoCount(d);
  $('share-form').hidden = !signed;
  $('share-signin-note').hidden = signed;
  $('share-stop').hidden = !(signed && shared);
  $('share-title').textContent = shared ? t('Shared with the community') : t('Share with the community');
  $('share-ok').textContent = !signed
    ? t('Sign in')
    : shared
      ? t('Update the shared quilt')
      : t('Share with the community');
  $('share-note').textContent =
    t('Anyone using the Quilt designer can see this quilt and copy it to their designs.') +
    (n ? tn(n, ' Your fabric photo in it is shared too.', ' Your {n} fabric photos in it are shared too.') : '');
  say('');
  // a copy from the community, not changed since: it is someone else's quilt
  const copyOf = signed ? unchangedCopy(rec, d) : null;
  if (copyOf)
    $('share-note').textContent = t(
      'This is a copy of “{name}” by {author} from the community. Change it to make it yours, then share it.',
      {
        name: copyOf.name,
        author: copyOf.author,
      },
    );
  $('share-ok').disabled = !!copyOf;
  $('share-dlg').showModal();
  (signed && !$('share-author').value ? $('share-author') : $('share-ok')).focus();
}

async function doShare() {
  // signed out: sign in (Auth0's window opens straight from this click), then the dialog again
  if (!signedIn()) {
    $('share-dlg').close();
    const msg = await signInAndSync();
    if (msg) notify(msg);
    else openShare(target);
    return;
  }
  const name = $('share-name').value.trim(),
    author = $('share-author').value.trim();
  if (!name) return say(t('Please give the quilt a name.'));
  if (!author) return say(t('Please give the name to show with your quilt.'));
  if (author.includes('@')) return say(t('Your name is shown to everyone: please don’t use an email.'));
  try {
    localStorage.setItem(AUTHOR_KEY, author);
  } catch (e) {}
  // the quilt being edited is saved first (its changes too), so what is shared is in My designs
  let id = target;
  if (!id) {
    if (readOnly)
      return say(t('This quilt was made with a newer version of the app, so it can’t be shared from here.'));
    id = saveCurrent(name).id;
  }
  const rec = designs.get(id);
  if (!rec) return say(t('That quilt is no longer in My designs.'));
  $('share-ok').disabled = true;
  $('share-ok').textContent = t('Sharing…');
  try {
    // its photos and the design go to the server first; the shared copy uses them
    await syncNow();
    const put = () => serverCall('PUT', `/v1/shared/${encodeURIComponent(id)}`, { name, author, design: rec.design });
    let r = await put();
    if (r.status === 409 && r.body?.error === 'photos_missing') {
      await syncNow();
      r = await put();
    }
    if (r.status === 409 && r.body?.error === 'not_changed') {
      say(
        getLang() === 'en'
          ? r.body.message
          : t(
              'This quilt is the same as “{name}” by {author}, already shared. Change it to make it yours, then share it.',
              r.body.sharedAs,
            ),
      );
      $('share-ok').textContent = t('Share with the community');
      return;
    }
    if (r.status !== 200 && r.status !== 201) throw new Error(serverSays(r.body, r.status));
    setSharedIds([...sharedIds, id]);
    $('share-dlg').close();
    if (state.page === 'mine') renderMine();
    if (state.page === 'community') loadCommunity();
    notify(t('“{name}” is shared with the community.', { name }), {
      action: { label: t('See it'), run: () => showPage('community') },
    });
  } catch (e) {
    say(t('Couldn’t share it: {why}', { why: why(e) }));
    $('share-ok').disabled = false;
    $('share-ok').textContent = t('Try again');
  }
}

/** Stops sharing one of my designs. @param {string} id */
async function unshare(id) {
  const rec = designs.get(id),
    name = rec ? shownName(rec) : t('The quilt');
  try {
    const r = await serverCall('DELETE', `/v1/shared/${encodeURIComponent(id)}`);
    if (r.status !== 200 && r.status !== 404) throw new Error(serverSays(r.body, r.status));
    setSharedIds([...sharedIds].filter(x => x !== id));
    if ($('share-dlg').open) $('share-dlg').close();
    if (state.page === 'mine') renderMine();
    if (state.page === 'community') loadCommunity();
    notify(t('“{name}” is no longer shared.', { name }));
  } catch (e) {
    notify(t('Couldn’t stop sharing: {why}', { why: why(e) }));
  }
}

/** Which of my designs are shared (the "Shared" tag on My designs), after signing in or out. */
async function loadShared() {
  if (!signedIn()) setSharedIds([]);
  else
    try {
      const r = await serverCall('GET', '/v1/shared');
      if (r.status === 200) setSharedIds(r.body.items.map(i => i.designId));
    } catch (e) {} // offline: the tags come next time
  if (state.page === 'mine') renderMine();
}

// ---- the Community page
/** @type {any[]} */
let items = [];
let more = false,
  loading = 0;
/** The shared quilts, newest first (append: the next 30). @param {boolean} [append] */
async function loadCommunity(append = false) {
  const q = $('com-q').value.trim(),
    last = append ? items[items.length - 1] : null,
    qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (last) {
    qs.set('before', String(last.updatedAt));
    qs.set('beforeId', last.id);
  }
  const ticket = ++loading;
  let msg = '';
  try {
    const r = await publicCall('/v1/community' + (qs.size ? `?${qs}` : ''));
    if (ticket !== loading) return; // a newer search started
    if (r.status !== 200) throw new Error(serverSays(r.body, r.status));
    items = append ? items.concat(r.body.items) : r.body.items;
    more = r.body.more;
    // the pictures of the fabrics they use, before drawing them (otherwise a fabric still loading shows as cream)
    const ids = new Set();
    for (const it of items) for (const id of fabricIdsIn(it.design, isFabric)) ids.add(id);
    await loadFabrics(ids);
    if (ticket !== loading) return;
  } catch (e) {
    if (ticket !== loading) return;
    if (!append) items = [];
    more = false;
    msg = t('Can’t reach the community right now. {why}', { why: why(e) });
  }
  drawCommunity(msg || (q ? t('No shared quilts match your search.') : t('No quilts shared yet: be the first!')));
}
/** @param {string} empty what to say when there is nothing to show */
function drawCommunity(empty) {
  const grid = $('com-grid');
  grid.innerHTML = '';
  const when = at => new Date(at).toLocaleDateString([getLang()], { day: 'numeric', month: 'short', year: 'numeric' });
  for (const it of items) {
    const r = readDesign(it.design);
    if (!r) continue;
    const pin = document.createElement('article');
    pin.className = 'pin';
    const img = document.createElement('div');
    img.className = 'img';
    img.appendChild(quiltPicture(r.design, 260));
    const meta = document.createElement('div');
    meta.className = 'meta';
    const text = document.createElement('div');
    text.className = 'meta-text';
    const nm = document.createElement('b');
    nm.textContent = it.name;
    const by = document.createElement('small');
    by.className = 'by';
    by.textContent = t('by {author} · {cols} × {rows} blocks · {date}', {
      author: it.author,
      cols: r.design.cols,
      rows: r.design.rows,
      date: when(it.updatedAt),
    });
    text.append(nm, by);
    if (it.mine) {
      const tag = document.createElement('span');
      tag.className = 'pin-tag';
      tag.textContent = t('Yours');
      text.appendChild(tag);
    }
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn sm com-copy';
    const had = alreadyHave(r.design);
    const have = rec => {
      copy.disabled = true;
      copy.textContent = t('In my designs ✓');
      copy.title = t('You have it in My designs: “{name}”', { name: shownName(rec) });
    };
    if (had) have(had);
    else copy.textContent = t('Copy to my designs');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      copy.textContent = t('Copying…');
      have(await copyToMine(it, r.design));
    });
    text.appendChild(document.createElement('br'));
    text.appendChild(copy);
    meta.appendChild(text);
    pin.append(img, meta);
    grid.appendChild(pin);
  }
  $('com-empty').hidden = items.length > 0;
  $('com-empty').textContent = empty;
  $('com-more').hidden = !more;
}

/**
 * The design in My designs that is this very quilt (whatever its name), if there is one: a quilt is copied once.
 * @param {any} d @returns {import('../storage/repo.js').DesignRecord | null}
 */
function alreadyHave(d) {
  const sig = quiltSig(d);
  return designs.list().find(m => quiltSig(m.design) === sig) || null;
}

/** A shared quilt into My designs, with its fabric photos; the one already there if it is. @returns {Promise<any>} */
async function copyToMine(it, d) {
  const had = alreadyHave(d);
  if (had) return had;
  for (const f of it.fabrics || []) {
    if (photoStore.get(f.id)) continue;
    try {
      const blob = await (await fetch(f.url)).blob();
      const { id } = await photoStore.add(blob, { name: f.name, cm: f.cm });
      const rec = photoStore.get(id);
      if (rec?.blob) addStoredFabric(/** @type {any} */ (rec));
    } catch (e) {} // a photo that can't be fetched: its parts show a stand-in
  }
  const rec = designs.save({
    id: designs.newId(),
    name: t('{name} (from {author})', { name: it.name, author: it.author }),
    design: d,
    from: { id: it.id, name: it.name, author: it.author, sig: quiltSig(d) }, // to tell a changed copy from the original
  });
  notify(t('“{name}” is in My designs.', { name: rec.name }), {
    action: { label: t('Open'), run: () => openMine(rec.id) },
  });
  return rec;
}

function initCommunity() {
  $('dz-share').addEventListener('click', () => openShare(null));
  $('com-share').addEventListener('click', () => openShare(null));
  $('share-ok').addEventListener('click', doShare);
  $('share-stop').addEventListener('click', () => target && unshare(target));
  $('share-cancel').addEventListener('click', () => $('share-dlg').close());
  $('share-x').addEventListener('click', () => $('share-dlg').close());
  $('share-author').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doShare();
    }
  });
  let soon = 0;
  $('com-q').addEventListener('input', () => {
    clearTimeout(soon);
    soon = setTimeout(() => loadCommunity(), 300);
  });
  $('com-more').addEventListener('click', () => loadCommunity(true));
  communityHooks.share = id => openShare(id);
  communityHooks.unshare = id => unshare(id);
  communityHooks.render = () => loadCommunity();
  // whose shared quilts are tagged: again when someone else signs in (not on every sync)
  let who;
  onAccount(c => {
    const now = c ? c.auth0 || c.user || '' : '';
    if (now === who) return;
    who = now;
    loadShared();
    if (state.page === 'community') loadCommunity();
  });
  if (state.page === 'community') loadCommunity();
}
initCommunity();
