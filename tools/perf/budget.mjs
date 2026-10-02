/**
 * Performance budgets for the audit scripts. A budget file names, per device
 * shape, the measurements that must not get worse:
 *
 *   { "desktop": { "counts-zoom-in": { "basePaints": { "max": 4 } },
 *                  "held-drag-zoomed": { "namesHeldShare": { "min": 0.8 } } } }
 *
 * Counts (repaints, label layouts, skeletons shown, animation-frame callbacks)
 * are the budgets that matter: they are the same on any machine. Frame times
 * vary with the hardware, so keep those generous and treat them as advisory.
 */
import { readFileSync } from 'node:fs'

/** `--budget=<file>` on the command line, else null. */
export function budgetArg(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith('--budget='))
  return arg ? JSON.parse(readFileSync(arg.slice('--budget='.length), 'utf8')) : null
}

/** Positional arguments, without `--flags`. */
export const positional = (argv = process.argv) => argv.slice(2).filter((a) => !a.startsWith('--'))

const at = (object, path) => path.split('.').reduce((o, key) => (o == null ? undefined : o[key]), object)

/**
 * Check one shape's measurements (`{ name: { metric: value } }`) against its
 * budget. Returns the failures as readable lines; a budgeted measurement that
 * is missing counts as a failure, so a renamed gesture can't silently pass.
 */
export function checkBudget(budget, shape, measurements) {
  const failures = []
  let checked = 0
  for (const [name, metrics] of Object.entries(budget?.[shape] ?? {})) {
    for (const [metric, limit] of Object.entries(metrics)) {
      checked++
      const value = at(measurements[name], metric)
      if (typeof value !== 'number' || Number.isNaN(value)) failures.push(`${shape} · ${name} · ${metric}: not measured`)
      else if (limit.max !== undefined && value > limit.max) failures.push(`${shape} · ${name} · ${metric}: ${value} is over the budget of ${limit.max}`)
      else if (limit.min !== undefined && value < limit.min) failures.push(`${shape} · ${name} · ${metric}: ${value} is under the budget of ${limit.min}`)
    }
  }
  return { checked, failures }
}

/** Print the verdict for every shape and return the process exit code. */
export function reportBudget(results) {
  const checked = results.reduce((a, r) => a + r.checked, 0)
  const failures = results.flatMap((r) => r.failures)
  if (!checked) return 0
  for (const f of failures) console.log(`BUDGET ${f}`)
  console.log(failures.length ? `\n${failures.length} of ${checked} budgets exceeded` : `\n${checked} budgets met`)
  return failures.length ? 1 : 0
}
