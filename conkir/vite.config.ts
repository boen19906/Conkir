import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2020' },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true, changeOrigin: true }
    }
  }
});
