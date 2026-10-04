/**
 * Development only: `#/insights?crash=route` or `?crash=sheet` throws inside a
 * screen or an open dialog, so the error boundaries can be checked in a
 * browser (tools/perf/error-recovery.mjs). Renders nothing in production.
 */
export function CrashTest({ where }: { where: 'route' | 'sheet' }) {
  if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.hash.split('?')[1] ?? '').get('crash') === where) {
    throw new Error(`Crash test: ${where}`)
  }
  return null
}
