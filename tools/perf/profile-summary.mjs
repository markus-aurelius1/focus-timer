/** Aggregate every run, preserving ranges and raw samples; never select a best run. */
import { readFileSync, writeFileSync } from 'node:fs'
const groups = process.argv.slice(2)
if (!groups.length) throw new Error('Usage: node profile-summary.mjs prefix [prefix...] (three out/prefix-N.json runs each)')
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length
  return +(n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2).toFixed(1)
}
const summary = groups.map(prefix => {
  const runs = [1, 2, 3].map(n => JSON.parse(readFileSync(new URL(`./out/${prefix}-${n}.json`, import.meta.url))))
  return { prefix, runs, workloads: runs[0].map((sample, index) => {
    if (!runs.every(run => run[index].name === sample.name)) throw new Error('Workload mismatch')
    return { name: sample.name, ...Object.fromEntries(['fps', 'p95', 'max', 'wallMs', 'scriptMs', 'layoutMs', 'taskMs'].map(key => {
      const values = runs.map(run => run[index][key])
      return [key, { median: median(values), min: Math.min(...values), max: Math.max(...values) }]
    })) }
  }) }
})
writeFileSync(new URL('./out/job4/profile-summary.json', import.meta.url), JSON.stringify(summary, null, 2))
for (const group of summary) for (const s of group.workloads) console.log(`${group.prefix} | ${s.name} | FPS ${s.fps.median} (${s.fps.min}–${s.fps.max}) | p95 ${s.p95.median} (${s.p95.min}–${s.p95.max}) | maximum ${s.max.median} (${s.max.min}–${s.max.max}) | wall ${s.wallMs.median}`)
