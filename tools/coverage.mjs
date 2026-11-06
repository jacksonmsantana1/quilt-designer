// One coverage report for the whole repository: every test the project has (unit tests of shared, app, server; the
// web app's and the phone app's browser tests) on every source file, those no test loads counted as not run.
//   node tools/coverage.mjs              runs them all, then writes coverage/all (HTML, lcov, summary)
//   node tools/coverage.mjs --report     only merges what the last runs left (after running some of them again)
// The browser tests need a build with a source map, which this does and undoes; the server's need PostgreSQL
// (TEST_DATABASE_URL, as for npm test).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import MCR from 'monocart-coverage-reports';

const ROOT = path.resolve(import.meta.dirname, '..');
const NODE_DIR = path.join(ROOT, 'coverage/node');
const run = (cmd, cwd, env = {}) => {
  console.log(`\n> ${cmd}  (${path.relative(ROOT, cwd) || '.'})`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  } catch (e) {
    // a failing test still leaves its coverage; the report says how much ran, the test run says what failed
    console.log(`(exit ${e.status}: carrying on to the report)`);
  }
};

if (!process.argv.includes('--report')) {
  fs.rmSync(path.join(ROOT, 'coverage'), { recursive: true, force: true });
  // unit tests: Node writes its V8 coverage into a folder per workspace
  run('node --test "tests/*.test.mjs"', path.join(ROOT, 'shared'), { NODE_V8_COVERAGE: path.join(NODE_DIR, 'shared') });
  run('node --test "tests/unit/*.test.mjs"', path.join(ROOT, 'app'), { NODE_V8_COVERAGE: path.join(NODE_DIR, 'app') });
  run('node --test --test-concurrency=1 "test/*.test.js"', path.join(ROOT, 'server'), {
    NODE_V8_COVERAGE: path.join(NODE_DIR, 'server'),
  });
  // browser tests: each leaves its raw coverage in <workspace>/coverage/e2e/raw
  run('npm run coverage:e2e', path.join(ROOT, 'app'));
  run('npm run coverage:e2e', path.join(ROOT, 'mobile'));
}

/** A source file's path from the repository's top folder: app/src/…, shared/src/…, server/src/…, mobile/src/… */
const fromRoot = p => {
  const m = /(?:^|\/)((?:app|shared|server|mobile)\/src\/.*)$/.exec(p.replace(/\\/g, '/').replace(/^file:\/\//, ''));
  return m ? m[1] : p;
};
const SOURCE = /(?:^|\/)(app|shared|server|mobile)\/src\/.*\.js$/;

const mcr = MCR({
  name: 'Block & Bind: all tests',
  outputDir: path.join(ROOT, 'coverage/all'),
  reports: ['v8', 'console-summary', 'json-summary', 'lcovonly'],
  inputDir: ['app', 'mobile'].map(w => path.join(ROOT, w, 'coverage/e2e/raw')).filter(d => fs.existsSync(d)),
  entryFilter: e => {
    const u = e.url || '';
    if (u.startsWith('file://')) return SOURCE.test(u) && !u.includes('node_modules');
    return true; // browser entries were filtered when they were kept
  },
  sourceFilter: p => SOURCE.test(fromRoot(p)) && !p.includes('node_modules') && !p.endsWith('.d.ts'),
  sourcePath: fromRoot,
  // the files no test loads, so they count as not run instead of being left out
  all: {
    dir: ['app/src', 'shared/src', 'server/src', 'mobile/src'].map(d => path.join(ROOT, d)),
    filter: f => (f.endsWith('.js') && !f.endsWith('.d.ts') ? 'js' : false),
  },
  cleanCache: true,
});
for (const w of ['shared', 'app', 'server']) {
  const dir = path.join(NODE_DIR, w);
  if (fs.existsSync(dir)) await mcr.addFromDir(dir);
}
const results = await mcr.generate();
const s = results.summary;
console.log(
  `\nAll tests: functions ${s.functions.pct}%  lines ${s.lines.pct}%  statements ${s.statements?.pct ?? '-'}%  branches ${s.branches.pct}%`,
);
