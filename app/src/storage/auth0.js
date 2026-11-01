// Sign-in with Auth0 (no side effects when loaded). Auth0 keeps the passwords and shows its own sign-in page in a
// small window; the app only gets tokens, which the sync sends to the quilt server (server/src/auth.js checks them).
// Auth0's library comes from the CDN, and only once someone signs in or is signed in: the app works without it.
// The tenant, the app's id there and the server's identifier are not secrets (a page can't keep secrets).

const AUTH0 = {
  domain: 'dev-5op4uervqyekvlsx.us.auth0.com',
  clientId: 'vGWifaVUu8nN9WOlNzVMxfA0TAK2FdlT',
  audience: 'https://api.quilt-designer',
};
const LIBRARY = 'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js@2.28.4/dist/auth0-spa-js.production.esm.js';

/** @type {Promise<any> | null} */
let client = null;
/** Auth0's client, made once. Signed in stays signed in on this device ("refresh tokens" kept in localStorage:
 * browsers block the cookie Auth0 would use otherwise). */
function auth0Client() {
  client ||= import(/* not bundled: loaded from the CDN */ LIBRARY)
    .then(m =>
      m.createAuth0Client({
        domain: AUTH0.domain,
        clientId: AUTH0.clientId,
        cacheLocation: 'localstorage',
        useRefreshTokens: true,
        authorizationParams: { audience: AUTH0.audience, redirect_uri: location.origin },
      }),
    )
    .catch(e => {
      client = null; // try again next time (offline, say)
      throw e;
    });
  return client;
}

/**
 * Opens Auth0's sign-in window (its sign-up screen with signup); resolves with the account ({ sub: Auth0's id,
 * who: the email to show}). Call it straight from a click: the window is opened first, before anything is
 * awaited, or browsers block it.
 * @param {{ signup?: boolean }} [o] @returns {Promise<{ sub: string, who: string }>}
 */
async function signIn({ signup = false } = {}) {
  const w = 420,
    h = 640,
    popup = window.open(
      '',
      'auth0:authorize:popup',
      `width=${w},height=${h},left=${Math.round(screenX + (outerWidth - w) / 2)},top=${Math.round(screenY + (outerHeight - h) / 2)}`,
    );
  try {
    const c = await auth0Client();
    await c.loginWithPopup(signup ? { authorizationParams: { screen_hint: 'signup' } } : {}, { popup });
    const u = await c.getUser();
    return { sub: u.sub, who: u.email || u.name || u.sub };
  } catch (e) {
    popup?.close();
    throw e;
  }
}

/** A token for the quilt server (renewed by the library when needed); fails when signed out on this device. */
const signInToken = async () => (await auth0Client()).getTokenSilently();

/** Signs out on this device (the account stays; the designs here stay too). */
async function signOut() {
  const c = await auth0Client().catch(() => null);
  if (c) await c.logout({ openUrl: false });
}

export { AUTH0, signIn, signInToken, signOut };
