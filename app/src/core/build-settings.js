// Settings of the published page. `npm run publish:page -w @quilt/app` fills them in (tools/publish.mjs, build.py);
// everywhere else they stay as they are here, which means: no server on the internet and no error reports.
const setting = (/** @type {string} */ v) => (v.startsWith('@@') ? '' : v);

/** The app's quilt server on the internet ('': only a server on this computer). */
export const API_URL = setting('@@API_URL@@');
/** Where error reports go ('': nowhere). */
export const SENTRY_DSN = setting('@@SENTRY_DSN@@');
/** Which version of the code this is, for the reports. */
export const RELEASE = setting('@@RELEASE@@');
