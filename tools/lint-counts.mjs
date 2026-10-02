/**
 * Lint totals by rule, for the handoff: how far the design-system migration
 * has got (raw buttons, arbitrary values) and what else is outstanding.
 *
 *   node tools/lint-counts.mjs            print the table
 *   node tools/lint-counts.mjs --json     machine-readable
 */
import { ESLint } from 'eslint'

const eslint = new ESLint()
const results = await eslint.lintFiles(['src', 'api', 'vite.config.ts'])
const counts = new Map()
let errors = 0
for (const file of results) {
  for (const m of file.messages) {
    // The two project rules share `no-restricted-syntax`; their message names them.
    const rule = m.ruleId === 'no-restricted-syntax' ? (m.message.match(/^(tars\/[a-z-]+)/)?.[1] ?? m.ruleId) : (m.ruleId ?? 'parse-error')
    const row = counts.get(rule) ?? { rule, count: 0, files: new Set(), severity: m.severity === 2 ? 'error' : 'warning' }
    row.count++
    row.files.add(file.filePath)
    counts.set(rule, row)
    if (m.severity === 2) errors++
  }
}
const rows = [...counts.values()].sort((a, b) => b.count - a.count).map((r) => ({ rule: r.rule, severity: r.severity, count: r.count, files: r.files.size }))
if (process.argv.includes('--json')) console.log(JSON.stringify({ files: results.length, errors, rows }, null, 2))
else {
  console.log(`${results.length} files linted`)
  for (const r of rows) console.log(`${String(r.count).padStart(5)}  ${r.severity.padEnd(7)}  ${r.rule}  (${r.files} files)`)
  console.log(errors ? `\n${errors} errors` : '\nno errors')
}
process.exit(errors ? 1 : 0)
