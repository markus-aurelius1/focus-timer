/** Separate production harness build; never part of the application or precache. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve('src') } },
  build: { outDir: 'tools/perf/out/pixel-build', emptyOutDir: true, rollupOptions: { input: 'tools/perf/atlas-pixel.html' } },
})
