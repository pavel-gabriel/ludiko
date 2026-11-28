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
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg', 'icons/icon-monochrome.svg', 'offline.html'],
      manifest: {
        name: 'Ludiko',
        short_name: 'Ludiko',
        description: 'Învață jucându-te: tutore gratuit de matematică pentru clasele 0-VIII, fără reclame, funcționează offline.',
        lang: 'ro',
        dir: 'ltr',
        categories: ['education', 'kids'],
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        orientation: 'any',
        prefer_related_applications: false,
        theme_color: '#FFB6C1', // ludiko-pink
        background_color: '#FFF8F0', // ludiko-bg
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        screenshots: [
          { src: 'screenshots/phone-home.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Ecranul principal Ludiko' },
          { src: 'screenshots/phone-items.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Exerciții cu imagini' },
          { src: 'screenshots/phone-singleplayer.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Joc de unul singur' },
          { src: 'screenshots/tablet-home.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Ludiko pe tabletă' },
          { src: 'screenshots/tablet-items.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Exerciții pe tabletă' },
        ],
      },
      workbox: {
        // App shell + built assets. Dyslexic .woff fallbacks are skipped (woff2 is enough).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico,webmanifest}'],
        globIgnores: ['404.html', 'screenshots/**'], // store screenshots are not needed offline
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
        // take control of the first page load, so the content packs prefetched in the first visit are runtime-cached (offline from the start)
        clientsClaim: true,
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
