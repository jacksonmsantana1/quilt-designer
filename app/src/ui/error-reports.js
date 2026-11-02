// Reports the page's errors to Sentry, on the published page only (core/build-settings.js). Its library is loaded just
// there, so the page stays lighter everywhere else, and is checked against its fingerprint like the other libraries.
// Only what shared/src/scrub-report.js lets through leaves the page.
import { scrubReport } from '@quilt/shared/scrub-report.js';
import { RELEASE, SENTRY_DSN } from '../core/build-settings.js';

const LIBRARY = 'https://browser.sentry-cdn.com/11.10.0/bundle.min.js';
const FINGERPRINT = 'sha384-O/8YQaGGVy/n9jIUzcOiaiJVm4t5+JMNiK/zOa0fWvlSld+FquXemEcwJxQ3x/Lr';

export function startErrorReports() {
  if (!SENTRY_DSN) return;
  const s = document.createElement('script');
  s.src = LIBRARY;
  s.integrity = FINGERPRINT;
  s.crossOrigin = 'anonymous';
  s.onload = () =>
    /** @type {any} */ (globalThis).Sentry?.init({
      dsn: SENTRY_DSN,
      release: RELEASE || undefined,
      environment: 'production',
      sendDefaultPii: false,
      // errors only: not Sentry's count of who visits
      integrations: (/** @type {any[]} */ all) => all.filter(i => i.name !== 'BrowserSession'),
      beforeBreadcrumb: () => null,
      beforeSend: scrubReport,
    });
  document.head.appendChild(s);
}
