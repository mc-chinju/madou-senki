import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './test/wrangler.jsonc' } })],
  // Durable Object restart/replay scenarios exceed Vitest's 5s default when the whole suite runs in parallel;
  // 15s matches the per-test timeout most room tests already pass. Explicit per-test timeouts still win.
  test: { include: ['test/*.test.ts'], testTimeout: 15_000 },
});
