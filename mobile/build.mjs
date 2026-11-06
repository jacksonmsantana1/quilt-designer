// Builds the phone app into dist/: its page, one script, its styles and the pictures of the basic fabrics.
//   node build.mjs                 talks to the live API
//   API_URL=... node build.mjs     talks to another one ('' means the same address as the page: dev.mjs)
//   node build.mjs --dev-signin    signs in by name instead of with Auth0: for the tests, never for a real app
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)),
  OUT = path.join(HERE, 'dist');
const API_URL = process.env.API_URL ?? 'https://block-and-bind-api.fly.dev';
const DEV_SIGNIN = process.argv.includes('--dev-signin');

/** Builds it all. @param {string} [apiUrl] @param {boolean} [devSignIn] */
export async function buildApp(apiUrl = API_URL, devSignIn = DEV_SIGNIN) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await build({
    entryPoints: [path.join(HERE, 'src/main.js')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outfile: path.join(OUT, 'app.js'),
    define: { __API_URL__: JSON.stringify(apiUrl), __DEV_SIGNIN__: JSON.stringify(devSignIn) },
    logLevel: 'warning',
    // with COVERAGE=1, a source map inside the script, so the browser tests' coverage maps back to the files
    sourcemap: process.env.COVERAGE ? 'inline' : false,
  });
  fs.copyFileSync(path.join(HERE, 'src/index.html'), path.join(OUT, 'index.html'));
  fs.copyFileSync(path.join(HERE, 'src/style.css'), path.join(OUT, 'style.css'));
  // file by file: fs.cpSync crashed Node 22 on the owner's Windows computer (perhaps the accent in the folder's name)
  const legal = path.join(HERE, 'src/legal');
  fs.mkdirSync(path.join(OUT, 'legal'), { recursive: true });
  for (const f of fs.readdirSync(legal)) fs.copyFileSync(path.join(legal, f), path.join(OUT, 'legal', f));
  const fabrics = path.join(HERE, '../app/assets/fabric');
  fs.mkdirSync(path.join(OUT, 'assets/fabric'), { recursive: true });
  for (const f of fs.readdirSync(fabrics)) fs.copyFileSync(path.join(fabrics, f), path.join(OUT, 'assets/fabric', f));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildApp();
