/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// BASE lets the PWA be hosted from a sub-path (e.g. GitHub Pages). Capacitor uses '/'.
const base = process.env.BASE ?? '/'

// Absolute URL of the production site, for canonical / Open Graph / Twitter tags.
// On Vercel it follows the project's production domain automatically (so renaming
// the project needs no code change); SITE_URL overrides it anywhere else.
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://tars-study.vercel.app')
).replace(/\/+$/, '')

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'sw-notifications.js', 'og-image.png'],
      manifest: {
        // The manifest id is the installed app's identity. It predates the rename to
        // Tars and must stay, or browsers would treat Tars as a different app and
        // existing installs would never pick up the new name and icons.
        id: 'lodestar-study',
        name: 'Tars — Study & Focus',
        short_name: 'Tars',
        description: 'A calm study planner, focus timer and progress tracker that works offline.',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#0a0c14',
        theme_color: '#0a0c14',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Start focus',
            short_name: 'Focus',
            url: './#/focus?start=1',
            icons: [{ src: 'icons/shortcut-focus.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: "Today's tasks",
            short_name: 'Today',
            url: './#/tasks?view=today',
            icons: [{ src: 'icons/shortcut-today.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Add a task',
            short_name: 'Add task',
            url: './#/tasks?add=1',
            icons: [{ src: 'icons/shortcut-add.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Insights',
            short_name: 'Insights',
            url: './#/insights',
            icons: [{ src: 'icons/shortcut-insights.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // The Atlas (sheets, relief plates, gazetteer) is precached so the map works offline from the first launch.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,json,webp}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        importScripts: ['sw-notifications.js'],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache well across app updates.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](dexie|dexie-react-hooks|zustand)[\\/]/ },
            { name: 'native', test: /node_modules[\\/]@capacitor/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
