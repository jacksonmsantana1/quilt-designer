// Coverage of src/ by the phone app's browser tests (COVERAGE=1, with dist/ built with an inline source map): the
// fixture adds each page's V8 coverage, this file is the global teardown that writes the report (coverage/e2e).
import MCR from 'monocart-coverage-reports';

export const coverageOptions = {
  name: 'Phone app browser tests',
  outputDir: './coverage/e2e',
  // raw: kept for tools/coverage.mjs, which merges every kind of test into one report
  reports: ['v8', 'console-summary', 'json-summary', 'lcovonly', 'raw'],
  // only the app's own script, mapped back to the source files by its source map
  entryFilter: e => /^http:\/\/localhost\/app\.js/.test(e.url),
  sourceFilter: p =>
    (p.includes('mobile/src/') || p.includes('shared/src/') || p.includes('app/src/')) && !p.includes('node_modules'),
  sourcePath: p => p.replace(/^.*?(mobile\/src|shared\/src|app\/src)\//, '$1/'),
  cleanCache: false,
};

export default async function teardown() {
  await MCR(coverageOptions).generate();
}
