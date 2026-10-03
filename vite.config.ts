import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const candidateDataChunkPattern =
  /^\/assets\/(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)-.*\.js$/

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Meu Santinho',
        short_name: 'Santinho',
        description: 'Organize suas escolhas eleitorais pessoais.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#202625',
        background_color: '#f4f5f3',
        lang: 'pt-BR',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: [
          'assets/AC-*.js',
          'assets/AL-*.js',
          'assets/AP-*.js',
          'assets/AM-*.js',
          'assets/BA-*.js',
          'assets/CE-*.js',
          'assets/DF-*.js',
          'assets/ES-*.js',
          'assets/GO-*.js',
          'assets/MA-*.js',
          'assets/MT-*.js',
          'assets/MS-*.js',
          'assets/MG-*.js',
          'assets/PA-*.js',
          'assets/PB-*.js',
          'assets/PR-*.js',
          'assets/PE-*.js',
          'assets/PI-*.js',
          'assets/RJ-*.js',
          'assets/RN-*.js',
          'assets/RS-*.js',
          'assets/RO-*.js',
          'assets/RR-*.js',
          'assets/SC-*.js',
          'assets/SP-*.js',
          'assets/SE-*.js',
          'assets/TO-*.js',
          'assets/BR-*.js',
          'assets/provenance-*.js',
        ],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              candidateDataChunkPattern.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'candidate-data-2026',
              expiration: {
                maxEntries: 28,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/candidates/2026/') &&
              /\.(?:jpg|jpeg)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'candidate-photos-2026',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
