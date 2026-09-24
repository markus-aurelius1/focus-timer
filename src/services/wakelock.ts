/** Keep the screen on during focus (Screen Wake Lock API on web, KeepAwake plugin natively). */
import { KeepAwake } from '@capacitor-community/keep-awake'
import { isNative } from '@/lib/platform'

let wanted = false
let sentinel: WakeLockSentinel | null = null
let listening = false

async function acquireWeb() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch {
    /* denied, e.g. low battery */
  }
}

function onVisibility() {
  // The browser drops wake locks when the page is hidden; re-acquire on return.
  if (wanted && document.visibilityState === 'visible' && !sentinel) void acquireWeb()
}

export async function keepAwake(on: boolean): Promise<void> {
  if (on === wanted) return
  wanted = on
  if (isNative) {
    try {
      await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
    } catch {
      /* plugin unavailable */
    }
    return
  }
  if (!listening) {
    document.addEventListener('visibilitychange', onVisibility)
    listening = true
  }
  if (on) await acquireWeb()
  else {
    await sentinel?.release().catch(() => {})
    sentinel = null
  }
}
