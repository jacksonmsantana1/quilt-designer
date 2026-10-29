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
  use: { viewport: { width: 1300, height: 1000 }, actionTimeout: 15_000 },
});
