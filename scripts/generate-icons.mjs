/**
 * Renders the app icon SVG (assets/icon.svg) into every PNG the PWA and the
 * Android project need. Uses a headless Chromium via playwright-core:
 *
 *   npm i -D playwright-core && node scripts/generate-icons.mjs
 *
 * (Set CHROMIUM_PATH if Chromium isn't auto-detected.)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(process.env.PLAYWRIGHT_FROM ? join(process.env.PLAYWRIGHT_FROM, 'x.js') : import.meta.url)
const { chromium } = require('playwright-core')

const icon = readFileSync(join(root, 'assets/icon.svg'), 'utf8')
const inner = icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

/** Wrap artwork: `pad` shrinks it inside the canvas (maskable / adaptive safe zones). */
const wrap = (pad = 0, round = 0, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${round ? `<clipPath id="r"><rect width="1024" height="1024" rx="${round}"/></clipPath>` : ''}
  <g ${round ? 'clip-path="url(#r)"' : ''}>
    ${bg ? '<rect width="1024" height="1024" fill="#0a0c14"/>' : ''}
    <g transform="translate(${pad} ${pad}) scale(${(1024 - 2 * pad) / 1024})">${inner}</g>
  </g></svg>`

const star = (color = '#ffffff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M48 6 L52.6 43.4 L90 48 L52.6 52.6 L48 90 L43.4 52.6 L6 48 L43.4 43.4 Z" fill="${color}"/></svg>`

const glyph = (path) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#0d1122"/><g fill="none" stroke="#f2c46d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(24 24) scale(2)">${path}</g></svg>`

const jobs = [
  ['public/icons/icon-192.png', 192, wrap()],
  ['public/icons/icon-512.png', 512, wrap()],
  ['public/icons/icon-maskable-512.png', 512, wrap(110)],
  ['public/apple-touch-icon.png', 180, wrap()],
  ['public/icons/badge-96.png', 96, star()],
  ['public/icons/shortcut-focus.png', 96, glyph('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>')],
  ['public/icons/shortcut-today.png', 96, glyph('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>')],
  ['public/icons/shortcut-add.png', 96, glyph('<path d="M12 5v14M5 12h14"/>')],
  ['public/icons/shortcut-insights.png', 96, glyph('<path d="M4 20V10M12 20V4M20 20v-6"/>')],
]

// Android launcher + adaptive foreground + notification icons (only if the platform exists).
const res = join(root, 'android/app/src/main/res')
if (existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, k] of Object.entries(dens)) {
    jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, 48 * k, wrap(0, 180)])
    jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, 48 * k, wrap(0, 512)])
    // Adaptive icon foreground: 108dp canvas, artwork within the central 72dp.
    // Adaptive foreground: full-bleed artwork; the star sits inside the 72dp safe zone.
    jobs.push([`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, wrap()])
    jobs.push([`android/app/src/main/res/drawable-${d}/ic_stat_lodestar.png`, 24 * k, star()])
  }

  // Launcher shortcut icons (48dp at xxhdpi).
  jobs.push(['android/app/src/main/res/drawable-xxhdpi/ic_shortcut_focus.png', 144, glyph('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>')])
  jobs.push(['android/app/src/main/res/drawable-xxhdpi/ic_shortcut_today.png', 144, glyph('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>')])
  jobs.push(['android/app/src/main/res/drawable-xxhdpi/ic_shortcut_add.png', 144, glyph('<path d="M12 5v14M5 12h14"/>')])
  // Splash screens: night sky with the star, every orientation and density Capacitor ships.
  const splash = (w, h) => {
    const s = Math.min(w, h) * 0.22
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#f2c46d" stop-opacity=".35"/><stop offset="100%" stop-color="#f2c46d" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="#0a0c14"/><circle cx="${w / 2}" cy="${h / 2}" r="${s * 1.6}" fill="url(#g)"/><path transform="translate(${w / 2} ${h / 2}) scale(${s / 90})" d="M0 -90 L9.6 -9.6 L90 0 L9.6 9.6 L0 90 L-9.6 9.6 L-90 0 L-9.6 -9.6 Z" fill="#f2c46d"/></svg>`
  }
  const splashSizes = {
    'drawable/splash.png': [480, 320],
    'drawable-land-mdpi/splash.png': [480, 320],
    'drawable-land-hdpi/splash.png': [800, 480],
    'drawable-land-xhdpi/splash.png': [1280, 720],
    'drawable-land-xxhdpi/splash.png': [1600, 960],
    'drawable-land-xxxhdpi/splash.png': [1920, 1280],
    'drawable-port-mdpi/splash.png': [320, 480],
    'drawable-port-hdpi/splash.png': [480, 800],
    'drawable-port-xhdpi/splash.png': [720, 1280],
    'drawable-port-xxhdpi/splash.png': [960, 1600],
    'drawable-port-xxxhdpi/splash.png': [1280, 1920],
  }
  for (const [file, [w, h]] of Object.entries(splashSizes)) jobs.push([`android/app/src/main/res/${file}`, [w, h], splash(w, h)])
}

// iOS app icon (opaque, 1024) and universal splash.
if (existsSync(join(root, 'ios/App/App/Assets.xcassets'))) {
  jobs.push(['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, wrap()])
  const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><defs><radialGradient id="g"><stop offset="0%" stop-color="#f2c46d" stop-opacity=".35"/><stop offset="100%" stop-color="#f2c46d" stop-opacity="0"/></radialGradient></defs><rect width="2732" height="2732" fill="#0a0c14"/><circle cx="1366" cy="1366" r="420" fill="url(#g)"/><path transform="translate(1366 1366) scale(2.8)" d="M0 -90 L9.6 -9.6 L90 0 L9.6 9.6 L0 90 L-9.6 9.6 L-90 0 L-9.6 -9.6 Z" fill="#f2c46d"/></svg>`
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) jobs.push([`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, 2732, big])
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const [out, size, svg] of jobs) {
  const [w, h] = Array.isArray(size) ? size : [Math.round(size), Math.round(size)]
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`)
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
  mkdirSync(dirname(join(root, out)), { recursive: true })
  writeFileSync(join(root, out), png)
  console.log('✓', out)
}
await browser.close()
