import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:18765',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://127.0.0.1:18765',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { OPENAI_API_KEY: '' },
  },
});
