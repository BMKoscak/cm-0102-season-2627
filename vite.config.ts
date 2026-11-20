import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bgCachePlugin } from './server/bgCacheMiddleware';

export default defineConfig({
  base: './',
  plugins: [react(), bgCachePlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
