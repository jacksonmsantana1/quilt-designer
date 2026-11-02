// Fingerprints of the libraries the page loads from the CDN, for the page's import map (build.py). The browser
// refuses a library that doesn't match, so a tampered file on the CDN can't run in the page. They are worked out
// from the same versions in node_modules, following the imports from the built app.
//   node tools/import-integrity.mjs [bundle]   prints { integrity: { url: hash }, prefixes: [url] } (run from app/)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const NM = path.join('..', 'node_modules');
const template = fs.readFileSync('template.html', 'utf8');
const { imports } = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(template)[1]);
const AUTH0 = /const LIBRARY = '([^']+)'/.exec(fs.readFileSync('src/storage/auth0.js', 'utf8'))[1];

/** The file in node_modules behind a CDN address, checked to be the same version. */
function localFile(url) {
  const m = /\/npm\/(@?[^@/]+(?:\/[^@/]+)?)@([^/]+)\/(.*)$/.exec(url);
  if (!m) throw new Error(`Not a CDN address of a package: ${url}`);
  const [, pkg, version, file] = m;
  const have = JSON.parse(fs.readFileSync(path.join(NM, pkg, 'package.json'), 'utf8')).version;
  if (have !== version) throw new Error(`${url} is version ${version}, but node_modules has ${have}`);
  return path.join(NM, pkg, file);
}

/** The address a module name leads to through the import map (null: not one of the map's). */
function resolve(name, from) {
  if (name.startsWith('.')) return from ? new URL(name, from).href : null;
  if (imports[name]) return imports[name];
  const prefix = Object.keys(imports)
    .filter(k => k.endsWith('/') && name.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? imports[prefix] + name.slice(prefix.length) : null;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
const integrity = {};
const walk = url => {
  if (integrity[url]) return;
  const file = localFile(url);
  if (!fs.existsSync(file)) return; // an import written in a comment
  const code = fs.readFileSync(file);
  integrity[url] = 'sha384-' + createHash('sha384').update(code).digest('base64');
  for (const [, name] of code.toString('utf8').matchAll(IMPORT)) {
    const next = resolve(name, url);
    if (next) walk(next);
  }
};

walk(AUTH0);
for (const [, name] of fs.readFileSync(process.argv[2] || path.join('dist', 'app.js'), 'utf8').matchAll(IMPORT)) {
  const url = resolve(name);
  if (url) walk(url);
}

const prefixes = [...new Set(Object.keys(integrity).map(u => /^.*?\/npm\/@?[^@]+@[^/]+\//.exec(u)[0]))].sort();
console.log(JSON.stringify({ integrity, prefixes }));
