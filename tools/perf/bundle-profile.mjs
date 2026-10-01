/** Static initial import graph and route assets; excludes deferred imports and transferred cache bytes. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { gzipSync } from 'node:zlib'
const root = resolve(process.argv[2] ?? 'dist')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const entry = html.match(/<script[^>]+src="([^" ]+\.js)"/)[1].replace(/^\//, '')
const files = new Set()
const visit = path => {
  if (files.has(path)) return
  files.add(path)
  const source = readFileSync(path, 'utf8')
  for (const match of source.matchAll(/\b(?:from|import)\s*["'](\.[^"']+\.js)["']/g)) visit(resolve(dirname(path), match[1]))
}
visit(resolve(root, entry))
const measure = path => { const bytes = readFileSync(path); return { file: basename(path), raw: bytes.length, gzip: gzipSync(bytes).length } }
const graph = [...files].sort().map(measure)
const result = { definition: 'Static initial import graph only; excludes dynamic imports including service-worker registration and route chunks.', entry: measure(resolve(root, entry)), staticInitial: { raw: graph.reduce((n, f) => n + f.raw, 0), gzip: graph.reduce((n, f) => n + f.gzip, 0), files: graph }, routes: readdirSync(resolve(root, 'assets')).filter(f => /^(AtlasScreen|FieldReview|CalendarScreen|InsightsScreen|SettingsScreen).*\.js$/.test(f)).map(f => measure(resolve(root, 'assets', f))) }
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
