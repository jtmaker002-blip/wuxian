import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    proxy: {
      '/oat-api': {
        target: 'https://openaiteach.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/oat-api/, '/api'),
      },
      '/oat-v1': {
        target: 'https://openaiteach.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/oat-v1/, '/v1'),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/library': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
