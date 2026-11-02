// Makes the folder that goes online: the page with its settings filled in, its assets and its security headers.
//   API_URL=https://... SENTRY_DSN=https://... npm run publish:page -w @quilt/app      (SENTRY_DSN is optional)
// The result is app/publish/, for Cloudflare Pages. quilt.html is not touched.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'publish';
const { API_URL, SENTRY_DSN = '' } = process.env;
const stop = msg => {
  console.error(msg);
  process.exit(1);
};
const addressOk = v => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !/["'\\<>\s]/.test(v);
  } catch (e) {
    return false;
  }
};
if (!API_URL || !addressOk(API_URL)) stop('API_URL must be the API’s address, on https (see server/README.md).');
if (SENTRY_DSN && !addressOk(SENTRY_DSN)) stop('SENTRY_DSN must be the https address Sentry gives.');

let RELEASE = '';
try {
  RELEASE = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch (e) {} // not in a git folder: reports just won't name the version

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
execFileSync('node', [path.join('tools', 'python.mjs'), 'build.py'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLISH_DIR: OUT, API_URL: new URL(API_URL).origin, SENTRY_DSN, RELEASE },
});
fs.cpSync('assets', path.join(OUT, 'assets'), {
  recursive: true,
  filter: f => !f.endsWith('.gif'), // the page uses the jpg, mp4 and webm
});

// a page without its headers online would have no protection and nobody would notice
const headers = fs.existsSync(path.join(OUT, '_headers')) ? fs.readFileSync(path.join(OUT, '_headers'), 'utf8') : '';
if (!headers.includes('Content-Security-Policy:')) stop('The security headers are missing: nothing to publish.');
const page = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
if (page.includes('@@API_URL@@') || !page.includes(new URL(API_URL).origin))
  stop('The API’s address is not in the page.');

const size = f =>
  fs.statSync(f).isDirectory() ? fs.readdirSync(f).reduce((n, x) => n + size(path.join(f, x)), 0) : fs.statSync(f).size;
console.log(
  `${OUT}/ is ready (${(size(OUT) / 1024 / 1024).toFixed(1)} MB), for ${API_URL}, version ${RELEASE || 'unknown'}.`,
);
