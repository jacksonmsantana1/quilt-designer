// Browser tests: `npm run build` first, then `npm run test:e2e`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // the pages run the cloth physics and software WebGL: in parallel they starve each other of CPU
  reporter: [['list']],
  // COVERAGE=1 (npm run coverage:e2e): each test's JavaScript coverage is collected, and reported at the end
  globalTeardown: process.env.COVERAGE ? './tests/e2e/coverage.mjs' : undefined,
  // the tests read English text, whatever language this computer is in (i18n.spec chooses its own)
  use: { locale: 'en-US', viewport: { width: 1300, height: 1000 }, actionTimeout: 15_000 },
});
