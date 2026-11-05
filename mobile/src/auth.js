// Sign-in with Auth0, the same accounts as the web app. Its library is part of the app (the page allows no scripts from
// elsewhere). In a browser it signs in in a small window. In the Android and iOS app it opens the phone's own browser, and
// Auth0 comes back to the app by a link that only this app answers; that link must be in the app's "Allowed Callback URLs"
// at Auth0 (see mobile/README.md). Test builds (build.mjs --dev-signin) skip Auth0 and use a name, as the server's tests do;
// the server only takes those when AUTH_MODE=dev, which production refuses.
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { getLang } from '@quilt/shared/i18n.js';

const AUTH0 = {
  domain: 'dev-5op4uervqyekvlsx.us.auth0.com',
  clientId: 'vGWifaVUu8nN9WOlNzVMxfA0TAK2FdlT',
  audience: 'https://api.quilt-designer',
};
const APP_ID = 'com.blockandbind.app';
const BACK_TO_APP = `${APP_ID}://${AUTH0.domain}/capacitor/${APP_ID}/callback`;

/** Whether this is the Android or iOS app, not a browser. @returns {boolean} */
const isNative = () => !!(/** @type {any} */ (window).Capacitor?.isNativePlatform?.());

/** @type {Promise<any> | null} */
let client = null;
function auth0Client() {
  client ||= createAuth0Client({
    domain: AUTH0.domain,
    clientId: AUTH0.clientId,
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    useRefreshTokensFallback: false, // the fallback needs a hidden frame of Auth0's, which this page doesn't allow
    authorizationParams: {
      audience: AUTH0.audience,
      redirect_uri: isNative() ? BACK_TO_APP : location.origin,
      ...(getLang() === 'pt-BR' ? { ui_locales: getLang() } : {}),
    },
  }).catch(e => {
    client = null; // try again next time (offline, say)
    throw e;
  });
  return client;
}

// ---- in the app: the phone's browser, and the link back
/** @type {{ ok: () => void, fail: (e: Error) => void } | null} */
let waiting = null;
function listenForTheWayBack() {
  NativeApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(BACK_TO_APP)) return;
    const w = waiting;
    waiting = null;
    try {
      if (/[?&](code|error)=/.test(url) && /[?&]state=/.test(url))
        await (await auth0Client()).handleRedirectCallback(url);
      w?.ok();
    } catch (e) {
      w?.fail(e);
    }
    await Browser.close().catch(() => {}); // Android closes it by itself, and says it can't
  });
  Browser.addListener('browserFinished', () => {
    const w = waiting;
    waiting = null;
    w?.fail(new Error('Sign-in window closed: cancelled'));
  });
}
let listening = false;

/** @param {string} url */
const openInBrowser = url => Browser.open({ url, windowName: '_self' });

async function signInInApp(c) {
  if (!listening) listenForTheWayBack();
  listening = true;
  const back = new Promise((ok, fail) => {
    waiting = { ok: /** @type {() => void} */ (ok), fail };
  });
  await c.loginWithRedirect({ openUrl: openInBrowser });
  await back;
}

/**
 * Signs in; resolves with who it is. Call it straight from a tap: browsers block a window opened later.
 * @returns {Promise<{ sub?: string, who: string, user?: string }>}
 */
async function signIn() {
  if (__DEV_SIGNIN__) return { user: 'tester', who: 'tester' };
  if (isNative()) {
    const c = await auth0Client();
    await signInInApp(c);
    const u = await c.getUser();
    return { sub: u.sub, who: u.email || u.name || u.sub };
  }
  const popup = window.open('', 'auth0:authorize:popup', 'width=420,height=640');
  try {
    const c = await auth0Client();
    await c.loginWithPopup({}, { popup });
    const u = await c.getUser();
    return { sub: u.sub, who: u.email || u.name || u.sub };
  } catch (e) {
    popup?.close();
    throw e;
  }
}

/** A token for the quilt server (renewed by the library); fails when signed out on this phone. */
const signInToken = async () => (await auth0Client()).getTokenSilently();

/** Signs out at Auth0 too, or the next Sign in would go straight through without asking. */
async function signOut() {
  if (__DEV_SIGNIN__) return;
  const c = await auth0Client().catch(() => null);
  if (!c) return;
  if (isNative()) await c.logout({ logoutParams: { returnTo: BACK_TO_APP }, openUrl: openInBrowser });
  else await c.logout({ logoutParams: { returnTo: location.origin + location.pathname } });
}

export { isNative, signIn, signInToken, signOut };
