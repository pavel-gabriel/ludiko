import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { contentPacksPlugin } from './scripts/contentPacksPlugin';

// Served from the root of the custom domain (public/CNAME). The PWA manifest
// and service worker derive start_url / scope / navigateFallback from `base`.
const base = '/';

// Content packs (docs/ENGINE.md "Content packs"): items/explanations/generators per subject × grade band,
// loaded on demand. Their chunks are left out of the precache and runtime-cached instead.
const contentPacks = contentPacksPlugin({ contentDir: path.resolve(__dirname, 'content') });

export default defineConfig({
  base,
  plugins: [
    react(),
    contentPacks,
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
        // Content packs (pack-only chunks) are not precached: a child only downloads its subjects and grades.
        // They are runtime-cached below (CacheFirst) and prefetched for the active profile (src/learner/prefetch.ts).
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter((e) => !contentPacks.packOnlyChunks.has(e.url.replace(/^\//, ''))),
            warnings: [],
          }),
        ],
        navigateFallback: `${base}index.html`,
        // Never serve the SPA shell for content bundles or Firebase endpoints
        navigateFallbackDenylist: [/^\/content\//, /^\/__\//, /^\/sounds\//],
        cleanupOutdatedCaches: true,
        // Web Push handlers (public/push-sw.js, docs/NOTIFICATIONS.md): push + notificationclick
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Hashed build assets that are not precached = content packs (immutable: CacheFirst)
            // (RegExp, not a closure: workbox serializes urlPattern functions into sw.js, where `base` does not exist)
            urlPattern: new RegExp(`${base}assets/[^/]+\\.js$`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ludiko-packs',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Future content bundles
            urlPattern: new RegExp(`${base}content/`),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ludiko-content',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: new RegExp(`${base}sounds/`),
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
    /* Agent worktrees live under .claude/ — never collect their tests */
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
