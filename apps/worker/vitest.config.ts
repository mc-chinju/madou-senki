import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './test/wrangler.jsonc' } })],
  // Avoid competing Worker files exhausting the default per-test time budget.
  test: { include: ['test/*.test.ts'], maxWorkers: 2 },
});
