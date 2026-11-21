import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['junit', { outputFile: process.env.PW_JUNIT ?? '.tmp/e2e-junit.xml' }]],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome', // vorhandenes Chrome, kein Browser-Download
    headless: true,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
