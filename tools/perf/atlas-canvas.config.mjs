/** Unshipped renderer comparison. The application's configuration and precache are untouched. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  root,
  define: { __APP_VERSION__: JSON.stringify('1.0.0') },
  resolve: { alias: { '@': root + 'src' } },
  plugins: [
    {
      name: 'unshipped-label-candidate',
      enforce: 'pre',
      resolveId(source) {
        if (source.endsWith('/renderer/LabelLayer')) return fileURLToPath(new URL('./AtlasCanvasCandidate.tsx', import.meta.url))
      },
    },
    react(),
    tailwindcss(),
    VitePWA({ injectRegister: false, manifest: false, workbox: { maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, globPatterns: ['**/*.{js,css,woff2}'] } }),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', 'http://localhost:4176') },
  ],
  build: { outDir: 'tools/perf/out/canvas-build', emptyOutDir: true },
  preview: { port: 4176, strictPort: true },
})
