/**
 * The study-audio engine in a real browser (dev server).
 *
 *   1. Every ambient sound and every music track renders: not silent, not
 *      clipping, no NaN, and the loop point is continuous (no click).
 *   2. One engine: playback survives route changes, opening and closing the
 *      sound panel and a minute of timer ticks without a single source being
 *      restarted; a layer never has two voices.
 *   3. Music carries on: a track that has had its run hands over to the next
 *      with sound the whole way through; pause keeps its place; stop rewinds.
 *   4. Pause, stop and leaving release every voice.
 *
 *   node audio-check.mjs [baseUrl] [--quick]     (default http://localhost:5173/ – needs the dev server,
 *                                                  because it reads app modules through Vite)
 *   --quick renders a sample of the catalogue instead of all of it.
 * Exits non-zero when a check fails.
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const args = process.argv.slice(2)
const base = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:5173/'
const quick = args.includes('--quick')
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await prepare(page, base, { sample: false, route: '#/focus' })
const wait = (ms) => page.waitForTimeout(ms)

// ── 1) Everything renders ───────────────────────────────────────────────
const rendered = await page.evaluate(async (quick) => {
  const { SOUND_LIST, MUSIC_TRACKS } = await import('/src/audio/catalog.ts')
  const { renderSound, forgetSound } = await import('/src/audio/sounds.ts')
  const { renderTrack } = await import('/src/audio/music.ts')
  const rate = 44100
  const measure = (buf) => {
    let peak = 0
    let sum = 0
    let bad = 0
    let seam = 0
    let step = 0
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < d.length; i++) {
        const v = d[i]
        if (!Number.isFinite(v)) bad++
        const a = Math.abs(v)
        if (a > peak) peak = a
        sum += v * v
        if (i > 0) step = Math.max(step, Math.abs(v - d[i - 1]))
      }
      // The jump across the loop point, last sample back to first.
      seam = Math.max(seam, Math.abs(d[0] - d[d.length - 1]))
    }
    return { peak, rms: Math.sqrt(sum / (buf.length * buf.numberOfChannels)), bad, seam, step, seconds: buf.duration }
  }
  const out = []
  const sounds = quick ? SOUND_LIST.filter((_, i) => i % 6 === 0) : SOUND_LIST
  for (const s of sounds) {
    const t0 = performance.now()
    try {
      out.push({ kind: 'sound', id: s.id, ms: performance.now() - t0, ...measure(await renderSound(s.id, rate)), ms2: performance.now() - t0 })
    } catch (e) {
      out.push({ kind: 'sound', id: s.id, error: String(e) })
    }
    forgetSound(s.id)
  }
  const tracks = quick ? MUSIC_TRACKS.filter((_, i) => i % 6 === 0) : MUSIC_TRACKS
  for (const t of tracks) {
    const t0 = performance.now()
    try {
      out.push({ kind: 'track', id: t.id, ...measure(await renderTrack(t.id)), ms2: performance.now() - t0 })
    } catch (e) {
      out.push({ kind: 'track', id: t.id, error: String(e) })
    }
  }
  return out
}, quick)

for (const kind of ['sound', 'track']) {
  const list = rendered.filter((r) => r.kind === kind)
  const failed = list.filter((r) => r.error)
  check(`every ${kind} renders (${list.length})`, failed.length === 0, failed.map((r) => `${r.id}: ${r.error}`).join('; '))
  const ok = list.filter((r) => !r.error)
  const silent = ok.filter((r) => r.rms < 0.004)
  check(`no ${kind} is silent`, silent.length === 0, silent.map((r) => `${r.id} rms ${r.rms.toFixed(4)}`).join(', '))
  const loud = ok.filter((r) => r.peak > 1.0 || r.bad > 0)
  check(`no ${kind} clips or has bad samples`, loud.length === 0, loud.map((r) => `${r.id} peak ${r.peak.toFixed(2)} bad ${r.bad}`).join(', '))
  // The step across the seam must be no larger than the steps found inside the loop.
  const clicks = ok.filter((r) => r.seam > Math.max(0.02, r.step * 1.5))
  check(`every ${kind} loops without a click`, clicks.length === 0, clicks.map((r) => `${r.id} seam ${r.seam.toFixed(3)} (largest step inside ${r.step.toFixed(3)})`).join(', '))
  const slowest = ok.reduce((a, b) => (b.ms2 > a.ms2 ? b : a), ok[0])
  const rms = ok.map((r) => r.rms).sort((a, b) => a - b)
  console.log(`  ${kind}s: rms ${rms[0].toFixed(3)}–${rms[rms.length - 1].toFixed(3)}, slowest render ${slowest.id} ${Math.round(slowest.ms2)} ms`)
  if (process.env.VERBOSE) console.log(ok.map((r) => `    ${r.id.padEnd(22)} ${String(Math.round(r.ms2)).padStart(6)} ms  ${r.seconds.toFixed(1)} s  rms ${r.rms.toFixed(3)} peak ${r.peak.toFixed(2)}`).join('\n'))
}

// ── 2) One engine, nothing restarted ────────────────────────────────────
const snap = () => page.evaluate(async () => (await import('/src/audio/store.ts')).engineSnapshot())
const level = () => page.evaluate(async () => (await import('/src/audio/store.ts')).audioTest.level())
const state = () =>
  page.evaluate(async () => {
    const s = (await import('/src/audio/store.ts')).useAudio.getState()
    return { playing: s.playing, layers: Object.keys(s.layers), track: s.music.track, on: s.music.on }
  })

await page.evaluate(async () => {
  const { useAudio } = await import('/src/audio/store.ts')
  const a = useAudio.getState()
  a.clear()
  a.toggleSound('rain')
  a.toggleSound('fire')
  a.setGenre('piano')
  a.playTrack('piano-first-light')
  // Asking again and again must not add voices.
  for (let i = 0; i < 5; i++) a.play()
  a.toggleSound('wind')
  a.toggleSound('wind')
  a.toggleSound('wind')
})
await page.waitForFunction(async () => {
  const s = (await import('/src/audio/store.ts')).engineSnapshot()
  return s.voices.length === 3 && s.music && s.pending.length === 0
}, null, { timeout: 90000 }).catch(() => {})
await level() // attaches the meter
await wait(1500)
let s0 = await snap()
check('three layers, three voices, one music voice', s0.voices.length === 3 && new Set(s0.voices).size === 3 && s0.music === 'piano-first-light', JSON.stringify(s0))
check('the context is running and there is sound', s0.context === 'running' && (await level()) > 0.002, `level ${(await level()).toFixed(4)}`)

// Start a session and move about the app.
await page.keyboard.press('Space')
await wait(600)
for (const route of ['#/plan', '#/atlas', '#/insights', '#/', '#/focus']) {
  await page.evaluate((r) => (location.hash = r), route)
  await wait(900)
}
await page.keyboard.press('s')
await wait(700)
check('the sound panel opens', await page.getByRole('heading', { name: 'Sounds' }).isVisible().catch(() => false))
await page.getByRole('tab', { name: /Music/ }).click()
await wait(300)
check('the panel shows what is playing', await page.getByText('First light').first().isVisible().catch(() => false))
await page.keyboard.press('Escape')
await wait(700)
await page.keyboard.press('f')
await wait(700)
await page.keyboard.press('Escape')
await wait(4000)
let s1 = await snap()
check('routes, the panel, immersive mode and timer ticks restarted nothing', s1.started === s0.started && s1.music === s0.music && s1.voices.length === 3, `sources started ${s0.started} → ${s1.started}`)
check('the music kept playing through it', s1.musicElapsed > s0.musicElapsed + 8, `${s0.musicElapsed.toFixed(1)} s → ${s1.musicElapsed.toFixed(1)} s`)

// Per-layer volume and mute act on the one voice.
await page.evaluate(async () => {
  const a = (await import('/src/audio/store.ts')).useAudio.getState()
  a.setVolume('rain', 0.9)
  a.toggleMute('fire')
})
await wait(600)
const s1b = await snap()
check('volume and mute do not restart a layer', s1b.started === s1.started && s1b.voices.length === 3)

// ── 3) The music hands over without silence ─────────────────────────────
const before = await state()
await page.evaluate(async () => (await import('/src/audio/store.ts')).audioTest.skip(100000))
const levels = []
let changedAt = -1
for (let i = 0; i < 40; i++) {
  await wait(250)
  levels.push(await level())
  if (changedAt < 0 && (await state()).track !== before.track) changedAt = i
}
const after = await state()
const s2 = await snap()
check('a finished track hands over to the next one', after.track !== before.track && after.on && s2.music === after.track, `${before.track} → ${after.track}`)
check('the next track is the next in the genre', after.track.startsWith('piano-'), after.track)
check('no silence across the hand-over', Math.min(...levels) > 0.002, `lowest level ${Math.min(...levels).toFixed(4)}`)
check('one music voice after the hand-over', s2.started === s1b.started + 1, `sources started ${s1b.started} → ${s2.started}`)

// Music alone, no ambience: still never silent across a hand-over.
await page.evaluate(async () => {
  const a = (await import('/src/audio/store.ts')).useAudio.getState()
  for (const id of Object.keys(a.layers)) a.toggleSound(id)
})
await wait(1200)
await page.evaluate(async () => (await import('/src/audio/store.ts')).audioTest.skip(100000))
const alone = []
for (let i = 0; i < 40; i++) {
  await wait(250)
  alone.push(await level())
}
check('music alone: no silence across a hand-over', Math.min(...alone) > 0.0005 && (await state()).track !== after.track, `lowest level ${Math.min(...alone).toFixed(4)}`)
check('removed layers were released', (await snap()).voices.length === 0)

// ── 4) Pause keeps the place, stop rewinds, nothing is left running ─────
await wait(3000)
const playingAt = (await snap()).musicElapsed
await page.keyboard.press('Space') // pause the session
await wait(2200)
const paused = await snap()
check('pausing the session pauses the sound and releases the voices', (await state()).playing === false && paused.music === null && paused.voices.length === 0, JSON.stringify(paused))
check('silence while paused', (await level()) < 0.0005, `level ${(await level()).toFixed(5)}`)
check('the music keeps its place while paused', Math.abs(paused.musicElapsed - playingAt) < 2.5, `${playingAt.toFixed(1)} s → ${paused.musicElapsed.toFixed(1)} s`)
await page.keyboard.press('Space') // resume
await page.waitForFunction(async () => (await import('/src/audio/store.ts')).engineSnapshot().music !== null, null, { timeout: 15000 }).catch(() => {})
await wait(1500)
const resumed = await snap()
check('resuming carries on from the same place', resumed.music === (await state()).track && resumed.musicElapsed >= paused.musicElapsed && resumed.musicElapsed < paused.musicElapsed + 6, `${paused.musicElapsed.toFixed(1)} s → ${resumed.musicElapsed.toFixed(1)} s`)

// Stop the session: Stop, then confirm the discard.
await page.evaluate(async () => (await import('/src/timer/store.ts')).useTimer.getState().stop?.())
await page.evaluate(async () => (await import('/src/audio/store.ts')).useAudio.getState().stop())
await wait(900)
const stopped = await snap()
check('stop releases everything and rewinds the music', (await state()).playing === false && stopped.music === null && stopped.voices.length === 0 && stopped.musicElapsed === 0, JSON.stringify(stopped))
check('silence after stop', (await level()) < 0.0005)

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
