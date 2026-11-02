// Reports the server's crashes and unexpected errors to Sentry, when SENTRY_DSN is set. Only what shared/src/
// scrub-report.js lets through, and no record of requests: Sentry's library is loaded only when it will be used.
import { scrubReport } from '@quilt/shared/scrub-report.js';

/**
 * @param {string | null} dsn where reports go (null: nowhere) @param {{ environment?: string, release?: string }} [o]
 * @returns {Promise<{ report: (err: any, route?: string) => void, close: () => Promise<any> }>}
 */
export async function startErrorReports(dsn, o = {}) {
  if (!dsn) return { report: () => {}, close: async () => {} };
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment: o.environment,
    release: o.release,
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: event => scrubReport(event),
  });
  return {
    report: (err, route) => void Sentry.captureException(err, route ? { tags: { route } } : undefined),
    close: () => Sentry.close(2000),
  };
}
