/** A single shared AudioContext, created lazily and resumed on user gestures. */
let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor({ latencyHint: 'playback' })
  }
  return ctx
}

/** Call from a click/tap handler so later sounds are allowed to play. */
export function unlockAudio(): void {
  const c = getAudioContext()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}
