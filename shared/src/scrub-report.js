// What an error report may carry when it leaves for Sentry (pure; used by the app and the server): what went wrong and
// where in the code, and nothing about the person. No quilts, names, emails, tokens or links to photos.

const EMAIL = /[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g;
const TOKEN = /\b(?:Bearer\s+\S+|eyJ[\w-]+\.[\w-]+\.[\w-]*)/gi;
const QUERY = /(\bhttps?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/gi;

/** A text with emails, tokens and what follows the address in links taken out. @param {any} s */
const clean = s =>
  typeof s === 'string' ? s.replace(TOKEN, '[token]').replace(QUERY, '$1').replace(EMAIL, '[email]') : s;

/** @param {any} frame a line of a stack trace: where in the code only, not the values there */
const cleanFrame = ({ filename, abs_path, function: fn, lineno, colno, in_app, module }) => ({
  filename: clean(filename),
  abs_path: clean(abs_path),
  function: fn,
  lineno,
  colno,
  in_app,
  module,
});

/**
 * An error report as it may leave. Keeps a short list of what it knows to be safe, instead of removing what it knows
 * not to be, so something new in a report stays behind by default. @param {any} event @returns {any}
 */
export function scrubReport(event) {
  const out = {};
  for (const k of ['event_id', 'timestamp', 'platform', 'level', 'release', 'environment', 'sdk', 'logger', 'type'])
    if (event[k] !== undefined) out[k] = event[k];
  if (event.message !== undefined) out.message = clean(event.message);
  if (event.tags) out.tags = Object.fromEntries(Object.entries(event.tags).map(([k, v]) => [k, clean(v)]));
  if (event.exception?.values)
    out.exception = {
      values: event.exception.values.map(({ type, value, mechanism, stacktrace }) => ({
        type,
        value: clean(value),
        mechanism: mechanism && { type: mechanism.type, handled: mechanism.handled },
        stacktrace: stacktrace?.frames && { frames: stacktrace.frames.map(cleanFrame) },
      })),
    };
  // which page or address, without what follows it
  const url = event.request?.url;
  if (typeof url === 'string') out.request = { url: clean(url) };
  return out;
}
