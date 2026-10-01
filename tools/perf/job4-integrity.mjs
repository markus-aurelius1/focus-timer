/** Compare protected assets/contracts to the external pre-audit snapshot. Read-only. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const snapshot = resolve(process.argv[2] ?? '../job3-safety-20261001-101042')
const root = fileURLToPath(new URL('../../', import.meta.url))
const hashes = JSON.parse(readFileSync(resolve(snapshot, 'sha256.json')))
const protectedFiles = hashes.filter(f => /^(public\/(atlas|pyq-atlas|atlas-assets)\/|tools\/atlas-build\/|src\/timer\/(engine|store)\.ts$|src\/data\/(db|types|repo|backup|sync)\.ts$|src\/atlas\/explore\.ts$|AGENTS\.md$|docs\/TARS-VNEXT-JOB-(1|2-3)\.md$|package(-lock)?\.json$|capacitor\.config\.ts$)/.test(f.path))
for (const f of protectedFiles) assert.equal(createHash('sha256').update(readFileSync(resolve(root, f.path))).digest('hex').toUpperCase(), f.sha256, 'Protected bytes changed: ' + f.path)
const atlas = JSON.parse(readFileSync(resolve(root, 'public/atlas/v1/places.json')))
assert.equal(atlas.places.length, 2273)
assert.equal(new Set(atlas.places.map(p => p.id)).size, 2273)
const runtime = resolve(root, 'public/pyq-atlas/v1')
const manifest = JSON.parse(readFileSync(resolve(runtime, 'manifest.json')))
assert.equal(manifest.count, 149)
assert.deepEqual(manifest.byFamily, { CSE: 72, PCS: 30, CDS: 47 })
let count = 0
for (const paper of manifest.papers) {
  for (const [file, expected] of [[paper.questions, paper.questionsHash], [paper.answers, paper.answersHash]]) assert.equal(createHash('sha256').update(readFileSync(resolve(runtime, file))).digest('hex'), expected)
  count += JSON.parse(readFileSync(resolve(runtime, paper.questions))).questions.length
}
assert.equal(count, 149)
const shippedPapers = readdirSync(resolve(root, 'dist/pyq-atlas/v1/papers'))
assert.equal(shippedPapers.length, manifest.papers.length)
const mapPath = 'src/features/atlas/AtlasMap.tsx'
assert.equal(readFileSync(resolve(root, mapPath), 'utf8').replace(/\r\n/g, '\n'), readFileSync(resolve(snapshot, 'tree', mapPath), 'utf8').replace(/\r\n/g, '\n'), 'Rejected renderer experiment must be fully reverted')
const result = { snapshot, protectedFiles: protectedFiles.length, places: 2273, count, byFamily: manifest.byFamily, packPairs: manifest.papers.length, dbVersion: 2, rendererUnchanged: true, protectedHashes: protectedFiles }
mkdirSync(resolve(root, 'tools/perf/out/job4'), { recursive: true })
writeFileSync(resolve(root, 'tools/perf/out/job4/integrity-results.json'), JSON.stringify(result, null, 2))
console.log(`${protectedFiles.length} protected files byte-identical; 2273 IDs; 149 PYQs (72/30/47); ${manifest.papers.length} pack pairs; renderer reverted; Dexie v2 unchanged`)
