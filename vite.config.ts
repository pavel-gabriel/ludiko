import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Served from the root of the custom domain (public/CNAME). The PWA manifest
// and service worker derive start_url / scope / navigateFallback from `base`.
const base = '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered by <PwaToast /> via virtual:pwa-register/react
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Ludiko',
        short_name: 'Ludiko',
        description: 'Jocuri educaționale pentru copii',
        lang: 'ro',
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#FFB6C1', // ludiko-pink
        background_color: '#FFF8F0', // ludiko-bg
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // App shell + built assets. Dyslexic .woff fallbacks are skipped (woff2 is enough).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico,webmanifest}'],
        globIgnores: ['404.html'],
        navigateFallback: `${base}index.html`,
        // Never serve the SPA shell for content bundles or Firebase endpoints
        navigateFallbackDenylist: [/^\/content\//, /^\/__\//, /^\/sounds\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Future content bundles
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(`${base}content/`),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ludiko-content',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'ludiko-font-styles' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'ludiko-font-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith(`${base}sounds/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ludiko-sounds',
              expiration: { maxEntries: 50 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        // Firebase (Firestore/RTDB/Auth/googleapis) is intentionally not matched by any
        // runtime route, so those requests always go straight to the network.
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});
