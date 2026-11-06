// The phone app: four tabs over one page. Community, My quiltings, My fabrics and the camera.
import { App as NativeApp } from '@capacitor/app';
import { getLang, t } from '@quilt/shared/i18n.js';
import { onAccountChange, signedIn, startAccount } from './account.js';
import { isNative } from './auth.js';
import { initCameraTab, renderRecent } from './camera-tab.js';
import { initCommunity, searchCommunity } from './community.js';
import { openAccount } from './me.js';
import { initMyFabrics, searchFabrics } from './my-fabrics.js';
import { initQuilts, searchQuilts } from './quilts.js';
import { onWriteFailed } from './store.js';
import { $, say } from './ui.js';

const TABS = {
  community: {
    title: t('Community'),
    search: t('Search shared quilts and quilters'),
    onSearch: searchCommunity,
  },
  quilts: { title: t('My quiltings'), search: t('Search my quilts'), onSearch: searchQuilts },
  fabrics: { title: t('My fabrics'), search: t('Search name, amount or place'), onSearch: searchFabrics },
  camera: { title: t('Camera'), search: '', onSearch: () => {} },
};
const queries = { community: '', quilts: '', fabrics: '', camera: '' };
const scrolled = { community: 0, quilts: 0, fabrics: 0, camera: 0 };
let current = 'community';

function showTab(name) {
  scrolled[current] = window.scrollY;
  current = name;
  for (const k of Object.keys(TABS)) {
    $(`tab-${k}`).hidden = k !== name;
    $(`go-${k}`).setAttribute('aria-current', k === name ? 'page' : 'false');
  }
  const tab = TABS[name];
  $('title').textContent = tab.title;
  $('q').hidden = !tab.search;
  $('q').placeholder = tab.search;
  $('q').setAttribute('aria-label', tab.search);
  $('q').value = queries[name];
  if (name === 'camera') renderRecent();
  window.scrollTo(0, scrolled[name]);
}

/** The Android back button: closes what's open, then goes to the first tab, and only then leaves the app. */
function goBack() {
  const all = document.querySelectorAll('dialog[open]');
  if (all.length) /** @type {any} */ (all[all.length - 1]).close();
  else if (current !== 'community') showTab('community');
  else NativeApp.exitApp();
}

function showAccountButton() {
  $('me').classList.toggle('in', signedIn());
}

async function start() {
  document.documentElement.lang = getLang();
  onWriteFailed(() => say(t('This phone couldn’t keep that. Is its storage full?')));
  await startAccount();
  for (const k of Object.keys(TABS)) {
    $(`go-${k}`).querySelector('span').textContent = TABS[k].title;
    $(`go-${k}`).addEventListener('click', () => showTab(k));
  }
  $('me').setAttribute('aria-label', t('Your account'));
  $('me').addEventListener('click', openAccount);
  $('viewer-close').setAttribute('aria-label', t('Close'));
  $('viewer-close').addEventListener('click', () => $('viewer').close());
  $('viewer').addEventListener('close', () => $('viewer-img').removeAttribute('src'));
  $('viewer-delete').textContent = t('Delete');
  let soon = /** @type {any} */ (0);
  $('q').addEventListener('input', () => {
    queries[current] = $('q').value.trim();
    clearTimeout(soon);
    const tab = TABS[current],
      text = queries[current];
    soon = setTimeout(() => tab.onSearch(text), 300);
  });
  if (isNative()) NativeApp.addListener('backButton', goBack);
  onAccountChange(showAccountButton);
  showAccountButton();
  showTab('community');
  initCommunity();
  initQuilts();
  initMyFabrics();
  initCameraTab();
}

start();
