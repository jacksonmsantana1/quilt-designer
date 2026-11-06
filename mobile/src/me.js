// The account's sheet: sign in or out, sync, who this person has blocked, the privacy policy and terms, and deleting the
// account (the app stores require that it can be done from inside the app).
import { getLang, t } from '@quilt/shared/i18n.js';
import {
  deleteAccountNow,
  signInNow,
  signOutNow,
  signedIn,
  sync,
  syncEverything,
  syncProblem,
  whoAmI,
} from './account.js';
import { loadBoard } from './community.js';
import { ask, el, openSheet, say, shown } from './ui.js';

// where people can write to: the owner's to choose (the stores want a way to reach the app's maker), and hidden until then
const CONTACT_EMAIL = '';

/** Signs in from a tap, and says what went wrong if it does. @returns {Promise<boolean>} whether someone is signed in now */
async function signInFromTap() {
  try {
    await signInNow();
    return true;
  } catch (e) {
    const closed = /popup|cancel/i.test(`${e?.error || ''} ${e?.message || ''}`);
    say(closed ? t('Sign-in was closed before it finished.') : t("Couldn't sign in: {why}", { why: e?.message || e }));
    return false;
  }
}

/** Something needs an account: says so, with the way to sign in. @param {string} why */
function offerSignIn(why) {
  const s = openSheet(t('Sign in'));
  s.body.append(
    el('p', { textContent: why }),
    el('button', {
      type: 'button',
      class: 'btn solid',
      textContent: t('Sign in'),
      onclick: async () => {
        s.close();
        if (await signInFromTap()) loadBoard();
      },
    }),
  );
}

/** A page that comes with the app (privacy policy, terms), over everything. @param {string} title @param {string} file */
function showPage(title, file) {
  const s = openSheet(title, { full: true });
  s.body.classList.add('page');
  s.body.append(el('iframe', { src: file, title }));
}

async function showBlocked(list) {
  list.replaceChildren(el('p', { class: 'hint', textContent: t('Looking…') }));
  let items = [];
  try {
    const r = await sync.request('GET', '/v1/blocks');
    if (r.status !== 200) throw new Error(String(r.status));
    items = r.body.items;
  } catch (e) {
    list.replaceChildren(el('p', { class: 'hint', textContent: t('The server could not be reached.') }));
    return;
  }
  list.replaceChildren();
  if (!items.length) list.append(el('p', { class: 'hint', textContent: t('You haven’t blocked anyone.') }));
  for (const b of items) {
    const row = el(
      'div',
      { class: 'row spread' },
      el('span', { textContent: b.author || t('Someone who no longer shares') }),
      el('button', {
        type: 'button',
        class: 'btn small',
        textContent: t('See them again'),
        onclick: async () => {
          try {
            await sync.request('DELETE', `/v1/blocks/${b.id}`);
            row.remove();
            loadBoard();
          } catch (e) {
            say(t('That didn’t work. Try again when you’re online.'));
          }
        },
      }),
    );
    list.append(row);
  }
}

async function deleteAccount(s) {
  const sure = await ask(
    t('Delete your account?'),
    t(
      'Your quilts, fabric photos, quilt photos, folders and shared quilts will be deleted from Block & Bind for good, on all your devices. This can’t be undone.',
    ),
    t('Delete everything'),
    { danger: true },
  );
  if (!sure) return;
  try {
    await deleteAccountNow();
    s.close();
    say(t('Your account has been deleted.'));
    loadBoard();
  } catch (e) {
    say(t('The account could not be deleted. Nothing was removed. Try again when you’re online.'));
  }
}

function openAccount() {
  const s = openSheet(t('Your account'));
  const fill = () => {
    s.body.replaceChildren();
    if (signedIn()) {
      const status = sync.status();
      const blocked = el('div', { class: 'blocked' });
      s.body.append(
        el('p', { textContent: t('Signed in as {who}', { who: whoAmI() }) }),
        el('p', {
          class: 'hint',
          id: 'sync-state',
          textContent:
            status.state === 'offline'
              ? t('Offline: everything is kept on this phone and goes up when you’re back.')
              : syncProblem() ||
                (status.at
                  ? t('In step with your account.')
                  : t('Your quilts and fabrics follow you between your devices.')),
        }),
        el('button', {
          type: 'button',
          class: 'choice',
          textContent: t('Sync now'),
          onclick: async () => {
            await syncEverything();
            fill();
          },
        }),
        el('button', {
          type: 'button',
          class: 'choice',
          textContent: t('People you’ve blocked'),
          onclick: () => showBlocked(blocked),
        }),
        blocked,
        el('button', {
          type: 'button',
          class: 'choice',
          id: 'sign-out',
          textContent: t('Sign out'),
          onclick: async () => {
            await signOutNow();
            fill();
            loadBoard();
          },
        }),
      );
    } else {
      s.body.append(
        el('p', {
          textContent: t(
            'Sign in with the same account as the web app: your quilts come here, and your fabrics and photos are kept safe.',
          ),
        }),
        el('button', {
          type: 'button',
          class: 'btn solid',
          id: 'sign-in',
          textContent: t('Sign in'),
          onclick: async () => {
            if (await signInFromTap()) {
              fill();
              loadBoard();
            }
          },
        }),
      );
    }
    s.body.append(
      ...shown([
        el('button', {
          type: 'button',
          class: 'choice',
          textContent: t('Privacy policy'),
          onclick: () =>
            showPage(t('Privacy policy'), getLang() === 'pt-BR' ? 'legal/privacidade.html' : 'legal/privacy.html'),
        }),
        el('button', {
          type: 'button',
          class: 'choice',
          textContent: t('Terms of use'),
          onclick: () => showPage(t('Terms of use'), getLang() === 'pt-BR' ? 'legal/termos.html' : 'legal/terms.html'),
        }),
        CONTACT_EMAIL && el('a', { class: 'choice', href: `mailto:${CONTACT_EMAIL}`, textContent: t('Write to us') }),
        signedIn() &&
          el('button', {
            type: 'button',
            class: 'choice danger-text',
            id: 'delete-account',
            textContent: t('Delete my account'),
            onclick: () => deleteAccount(s),
          }),
      ]),
    );
  };
  fill();
}

export { offerSignIn, openAccount, signInFromTap };
