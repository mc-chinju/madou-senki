import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:8787', ws: true, changeOrigin: false } },
  },
  build: { outDir: 'dist' },
});
