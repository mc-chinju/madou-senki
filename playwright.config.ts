import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8787', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {} },
  webServer: {
    command: 'pnpm --filter @madou/web build && pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --local --config test/wrangler.e2e.jsonc --persist-to ../../.cache/e2e-state && pnpm --filter @madou/worker exec wrangler dev --config test/wrangler.e2e.jsonc --port 8787 --persist-to ../../.cache/e2e-state',
    url: 'http://localhost:8787',
    reuseExistingServer: false,
    timeout: 60000,
    env: { WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('.cache/wrangler/logs'), WRANGLER_REGISTRY_PATH: resolve('.cache/wrangler/registry') },
  },
});
