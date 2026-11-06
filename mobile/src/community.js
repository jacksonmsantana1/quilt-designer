// The Community board: everyone's shared quilts, newest first, with their realistic pictures where they have one, as on
// the web app (app/src/mine/community.js). Saving, reporting and blocking need a sign-in.
import { readDesign } from '@quilt/shared/format.js';
import { getLang, t } from '@quilt/shared/i18n.js';
import { quiltSig } from '../../app/src/core/quilt-sig.js';
import { repo } from '../../app/src/storage/repo.js';
import { authHeaders, signedIn, sync } from './account.js';
import { offerSignIn } from './me.js';
import { quiltCard, showPicture } from './quilt-card.js';
import { $, ask, el, openSheet, say } from './ui.js';

const API_URL = __API_URL__;

// ---- what can be done with someone's quilt
/** A shared quilt into My quiltings, with its fabric photos: a quilt is copied once. */
async function saveQuilt(it, d) {
  const sig = quiltSig(d);
  if (repo.designs.list().some(m => quiltSig(m.design) === sig)) {
    say(t('You already have this quilt.'));
    return;
  }
  for (const f of it.fabrics || []) {
    if (repo.fabrics.get(f.id)) continue;
    try {
      const blob = await (await fetch(f.url)).blob();
      await repo.fabrics.add(blob, { name: f.name, cm: f.cm });
    } catch (e) {} // a photo that can't be fetched: its parts show a stand-in
  }
  const rec = repo.designs.save({
    id: repo.designs.newId(),
    name: t('{name} (from {author})', { name: it.name, author: it.author }),
    design: d,
    from: { id: it.id, name: it.name, author: it.author, sig },
  });
  say(t('“{name}” is in My quiltings.', { name: rec.name }));
}

function reportQuilt(it) {
  const s = openSheet(t('Report “{name}”', { name: it.name }));
  s.body.append(el('p', { textContent: t('Why should this quilt not be here?') }));
  for (const [reason, label] of [
    ['inappropriate', t('Inappropriate content')],
    ['copyright', t('Copied without permission')],
    ['spam', t('Spam')],
    ['other', t('Something else')],
  ])
    s.body.append(
      el('button', {
        type: 'button',
        class: 'choice',
        textContent: label,
        onclick: async () => {
          s.close();
          try {
            const r = await sync.request('POST', `/v1/community/${it.id}/report`, { reason });
            if (r.status !== 200 && r.status !== 201) throw new Error(String(r.status));
            say(t('Thank you: someone will look at it.'));
          } catch (e) {
            say(t('The report could not be sent. Try again when you’re online.'));
          }
        },
      }),
    );
}

async function blockAuthor(it) {
  const sure = await ask(
    t('Stop seeing {author}’s quilts?', { author: it.author }),
    t('They won’t be told. You can see them again from your account.'),
    t('Stop seeing them'),
  );
  if (!sure) return;
  try {
    const r = await sync.request('POST', `/v1/community/${it.id}/block`);
    if (r.status !== 200) throw new Error(String(r.status));
    loadBoard();
  } catch (e) {
    say(t('That didn’t work. Try again when you’re online.'));
  }
}

function quiltMenu(it, d) {
  const s = openSheet(it.name);
  const act = (label, needs, f) =>
    el('button', {
      type: 'button',
      class: 'choice',
      textContent: label,
      onclick: () => {
        s.close();
        if (!signedIn()) offerSignIn(needs);
        else f();
      },
    });
  s.body.append(act(t('Save to My quiltings'), t('Sign in to save quilts.'), () => saveQuilt(it, d)));
  if (!it.mine)
    s.body.append(
      act(t('Report this quilt'), t('Sign in to report a quilt.'), () => reportQuilt(it)),
      act(t('Stop seeing {author}’s quilts', { author: it.author }), t('Sign in to choose whose quilts you see.'), () =>
        blockAuthor(it),
      ),
    );
}

// ---- a card
function card(it, d) {
  const alt = t('“{name}” on a bed', { name: it.name });
  return quiltCard({
    name: it.name,
    by: t('by {author} · {cols} × {rows} blocks · {date}', {
      author: it.author,
      cols: d.cols,
      rows: d.rows,
      date: new Date(it.updatedAt).toLocaleDateString([getLang()], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    }),
    design: d,
    fabrics: it.fabrics,
    photo: it.pictureUrl,
    alt,
    onPhoto: () => showPicture({ src: it.pictureUrl, alt, name: it.name }),
    menu: () => quiltMenu(it, d),
  });
}

// ---- the board
/** @type {any[]} */
let items = [];
let more = false,
  loading = 0,
  query = '';

/** The shared quilts for the search typed now (append: the next page). @param {boolean} [append] */
async function loadBoard(append = false) {
  const q = query,
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
    // signed in, the list leaves out whoever this person chose not to see
    const r = await fetch(`${API_URL}/v1/community${qs.size ? `?${qs}` : ''}`, { headers: await authHeaders() });
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

/** The screen's search box has this now. @param {string} text */
function searchCommunity(text) {
  query = text;
  loadBoard();
}

function initCommunity() {
  $('more').textContent = t('More quilts');
  $('more').addEventListener('click', () => loadBoard(true));
  loadBoard();
}

export { initCommunity, loadBoard, searchCommunity };
