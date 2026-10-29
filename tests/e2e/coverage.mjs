// Coverage of src/ by the browser tests (COVERAGE=1): fixtures.mjs adds each page's V8 coverage, this file is
// also the global teardown that writes the report (coverage/e2e: HTML, plus a summary in the console).
import MCR from 'monocart-coverage-reports';

export const coverageOptions = {
  name: 'Browser tests',
  outputDir: './coverage/e2e',
  reports: ['v8', 'console-summary', 'json-summary', 'lcovonly'],
  // only the app bundle (the inline module script of the page), mapped back to src/ by its source map
  entryFilter: e => /^http:\/\/(x|localhost)\//.test(e.url) && (e.source || '').includes('sourceMappingURL=data:'),
  sourceFilter: p => p.includes('src/') && !p.includes('node_modules'),
  sourcePath: p => p.replace(/^.*?src\//, 'src/'),
  cleanCache: false,
};

export default async function teardown() {
  await MCR(coverageOptions).generate();
}
