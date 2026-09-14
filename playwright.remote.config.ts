import { defineConfig, devices } from '@playwright/test';

const origin = process.env.PLAYWRIGHT_BASE_URL;
if (!origin) throw new Error('PLAYWRIGHT_BASE_URL must be configured');

export default defineConfig({
  testDir: './tests/remote',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { ...devices['Desktop Chrome'], channel: 'chromium', baseURL: origin,
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
