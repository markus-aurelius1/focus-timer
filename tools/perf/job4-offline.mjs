/** Clean-install offline audit with HTTP cache disabled; optional old-build SW upgrade. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
const out = new URL('./out/job4/', import.meta.url)
mkdirSync(out, { recursive: true })
const checks = [], errors = []
const ok = (name, value) => { checks.push({ name, ok: !!value }); console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); assert(value, name) }
const root = new URL('../../public/pyq-atlas/v1/', import.meta.url)
const questions = readdirSync(new URL('papers/', root)).flatMap(f => JSON.parse(readFileSync(new URL('papers/' + f, root))).questions)
const q = questions.find(q => q.relations.some(r => r.masteryEligible && r.quizIncluded && r.semanticRole === 'primary' && r.locationInQuestion === 'stem'))
const answer = JSON.parse(readFileSync(new URL('answers/' + q.id.replace(/-Q\d+$/, '') + '.json', root))).answers.find(a => a.questionId === q.id)

async function audit(url, label, upgrade) {
  const { browser, ctx, page } = await launch({ touch: true })
  const served = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', r => { if (r.fromServiceWorker()) served.push(new URL(r.url()).pathname) })
  try {
    await prepare(page, url, { sample: false, route: '#/atlas' })
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    const oldEntry = await page.locator('script[type=module]').getAttribute('src')
    if (upgrade) {
      upgrade()
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        const activateWaiting = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', activateWaiting)
        })
        const change = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('SW update did not activate')), 30000)
          navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timeout); resolve() }, { once: true })
        })
        await registration.update()
        activateWaiting()
        await change
      })
      // Workbox may also reload on activation. Only tolerate the navigation
      // cancellation from that overlap; the changed entry and ready app below
      // must still prove the update actually loaded.
      try { await page.reload() }
      catch (error) { if (!error.message.includes('net::ERR_ABORTED')) throw error }
      await page.waitForFunction(previous => {
        const entry = document.querySelector('script[type=module]')?.getAttribute('src')
        return !!entry && entry !== previous
      }, oldEntry)
      await page.getByRole('button', { name: 'Ask Tars', exact: true }).waitFor()
      ok(label + ': new build replaces the old entry', (await page.locator('script[type=module]').getAttribute('src')) !== oldEntry)
    }
    // No paper has been opened: only SW installation could supply its JSON offline.
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    served.length = 0
    await ctx.setOffline(true)
    await page.reload()
    await page.getByRole('button', { name: 'Ask Tars', exact: true }).waitFor()
    ok(label + ': offline HTML and entry come from SW', served.includes('/') && served.some(p => /\/assets\/index-.*\.js$/.test(p)))
    await page.goto(url + '#/atlas?search=Nathu%20La')
    const gazetteer = page.getByRole('dialog', { name: 'Gazetteer', exact: true })
    await gazetteer.waitFor()
    await gazetteer.getByRole('button').filter({ hasText: 'Nathu La' }).first().click()
    await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
    ok(label + ': offline search opens an accessible place', await page.getByRole('button', { name: 'Test me', exact: true }).isVisible())
    await page.keyboard.press('Escape')
    await page.goto(url + '#/atlas?pyq=' + q.id)
    const article = page.locator('[data-question-id]')
    await article.waitFor()
    await article.getByRole('radio').nth('ABCD'.indexOf(answer.correctOptions[0])).check()
    await article.getByRole('button', { name: 'Submit answer', exact: true }).click()
    await article.getByText(/Accepted answer/).waitFor()
    ok(label + ': previously unopened question and final answer come from SW', served.some(p => p.includes('/papers/' + q.id.replace(/-Q\d+$/, ''))) && served.some(p => p.includes('/answers/' + q.id.replace(/-Q\d+$/, ''))))
    await article.getByRole('button').last().click()
    ok(label + ': answer returns to a meaningful place', await page.getByRole('heading', { level: 2 }).count() > 0)
    await page.keyboard.press('Escape')
    const command = async text => {
      await page.keyboard.press('Control+k')
      const input = page.getByRole('combobox', { name: 'Search and commands' })
      await input.fill(text)
      await page.waitForTimeout(150)
      await input.press('Enter')
      await page.waitForTimeout(400)
    }
    await command('Settings')
    ok(label + ': shared settings open offline', await page.getByRole('heading', { name: 'Settings', level: 1 }).isVisible())
    await page.goto(url + '#/atlas')
    await page.getByRole('application').waitFor()
    await page.getByRole('button', { name: 'Map options', exact: true }).click()
    await page.getByRole('button', { name: 'Atlas tools', exact: true }).click()
    try { await page.getByText('111/111 assets saved offline', { exact: false }).waitFor() }
    catch (error) {
      console.log('OFFLINE STATUS', await page.getByRole('dialog').innerText())
      console.log('CACHE DIAGNOSTIC', await page.evaluate(async () => {
        const manifest = await (await fetch('/atlas-assets/v1/manifest.json')).json()
        const names = await caches.keys(), result = []
        for (const asset of manifest.assets) {
          const path = new URL('/' + asset.path, location.origin).href
          let found = false
          for (const name of names.filter(k => k.includes('precache'))) {
            const cached = await (await caches.open(name)).match(path, { ignoreSearch: true })
            if (!cached) continue
            const bytes = await cached.arrayBuffer()
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
            if (hash === asset.version && bytes.byteLength === asset.bytes) found = true
          }
          if (!found) result.push(asset.path)
        }
        return { names, missing: result }
      }))
      throw error
    }
    ok(label + ': current asset hashes verify offline', true)
    if (!upgrade) {
      // A matching pathname in an old/corrupt cache must not count as installed.
      await page.evaluate(async () => {
        for (const name of (await caches.keys()).filter(k => k.includes('precache'))) {
          const cache = await caches.open(name)
          const key = (await cache.keys()).find(k => new URL(k.url).pathname.endsWith('/pyq-hotspots.json'))
          if (!key) continue
          window.__assetRestore = { cache, key, response: await cache.match(key) }
          await cache.put(key, new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
          break
        }
        dispatchEvent(new Event('focus'))
      })
      await page.getByText('110/111 assets saved offline', { exact: false }).waitFor()
      ok(label + ': stale same-path asset is not counted', true)
      await page.evaluate(async () => { const s = window.__assetRestore; await s.cache.put(s.key, s.response); dispatchEvent(new Event('focus')) })
      await page.getByText('111/111 assets saved offline', { exact: false }).waitFor()
      ok(label + ': wake refresh restores verified count', true)
    }
    await page.screenshot({ path: fileURLToPath(new URL(label + '-offline.png', out)) })
    return { label, served: [...new Set(served)], oldEntry }
  } finally { await browser.close() }
}

let server
try {
  const runs = [await audit(base, 'clean-install')]
  if (process.argv[3]) {
    let directory = resolve(process.argv[3])
    const current = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)))
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
    server = createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const file = resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname))
      if (!file.startsWith(directory + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(readFileSync(file))
    })
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    runs.push(await audit(`http://localhost:${server.address().port}/`, 'build-upgrade', () => { directory = current }))
  }
  ok('no browser errors', errors.length === 0)
  writeFileSync(new URL('offline-results.json', out), JSON.stringify({ checks, errors, runs }, null, 2))
} finally { if (server) await new Promise(r => server.close(r)) }
