import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import seo from '../backend/seo.js';

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')); }
  catch { return fallback; }
}

export default defineConfig({
  plugins: [react(), {
    name: 'live-seo',
    transformIndexHtml(html, context) {
      const settings = readJson('../backend/data/settings.json', { brandName: 'GrupoTrevisan' });
      const products = readJson('../backend/data/catalog-products.json', readJson('../backend/catalog-defaults.json', []));
      const requestPath = context.originalUrl || context.path;
      const path = requestPath === '/index.html' ? '/' : requestPath;
      return seo.renderSeoHtml(html, path, settings, products);
    },
  }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
        ws: true,
      },
      '/robots.txt': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
});
