// Makes the app's icons and start screens for Android and iOS from assets/logo.svg:
//   node generate-icons.mjs
// (Playwright draws the picture; Capacitor's tool, fetched when it's run, makes every size the stores ask for.)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';

const HERE = import.meta.dirname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.goto(`file:///${path.join(HERE, 'assets/logo.svg').replaceAll('\\', '/')}`);
await page.screenshot({ path: path.join(HERE, 'assets/logo.png') });
await browser.close();
execFileSync(
  'npx',
  [
    '--yes',
    '@capacitor/assets',
    'generate',
    '--ios',
    '--android',
    '--iconBackgroundColor',
    '#f7f0e4',
    '--iconBackgroundColorDark',
    '#f7f0e4',
    '--splashBackgroundColor',
    '#f7f0e4',
    '--splashBackgroundColorDark',
    '#2b2320',
  ],
  { cwd: HERE, stdio: 'inherit', shell: process.platform === 'win32' },
);
