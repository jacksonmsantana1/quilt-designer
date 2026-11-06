// Browser tests of the phone app, on a screen the size of a phone: `npm run test:e2e -w @quilt/mobile`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    locale: 'en-US',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    actionTimeout: 15_000,
    // the camera inside the app (live-camera.js): Chromium's made-up camera, allowed without asking
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
});
