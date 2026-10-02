/**
 * More procedural soundscapes: weather, water, forest, night, fire, café and
 * study, urban and transport. Each is rendered once into a seamless loop like
 * the originals in sounds.ts. They are sketches in filtered noise and simple
 * tones – impressions of a place, tuned to sit under study without drawing
 * attention to themselves.
 */
import { burst, chain, filter, gain, noiseBuffer, noiseSource, panner, seamGain, tone } from './dsp'
import type { SoundDef } from './sounds'

/** A slow random wander for a gain: breeze, surf, traffic. */
function wander(g: GainNode, D: number, rand: () => number, lo: number, hi: number, every: number) {
  g.gain.value = lo + (hi - lo) * rand()
  for (let t = 0; t <= D; t += every * (0.6 + rand() * 0.8)) g.gain.linearRampToValueAtTime(lo + (hi - lo) * rand(), t)
}

export const MORE_SOUNDS: SoundDef[] = [
  {
    id: 'heavy-rain',
    duration: 14,
    trim: 0.9,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const sheet = noiseSource(ctx, 'white', D, rand)
      chain(sheet, filter(ctx, 'highpass', 300), filter(ctx, 'lowpass', 9000), gain(ctx, 0.5), out)
      sheet.start()
      const roar = noiseSource(ctx, 'brown', D, rand)
      const rg = ctx.createGain()
      wander(rg, D, rand, 0.4, 0.62, 2.5)
      chain(roar, filter(ctx, 'lowpass', 600), rg, out)
      roar.start()
      const drops = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.006 + rand() * 0.02) burst(ctx, out, drops, t, { freq: 1200 + rand() * 6000, q: 1 + rand() * 4, gain: 0.05 + rand() * 0.22, decay: 0.006 + rand() * 0.025, pan: rand() * 2 - 1 })
    },
  },
  {
    id: 'rain-window',
    duration: 16,
    trim: 1.2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      // The rain outside, heard through glass: dull, with the highs gone.
      const outside = noiseSource(ctx, 'pink', D, rand)
      chain(outside, filter(ctx, 'lowpass', 1400, 0.6), gain(ctx, 0.55), out)
      outside.start()
      const body = noiseSource(ctx, 'brown', D, rand)
      chain(body, filter(ctx, 'lowpass', 260), gain(ctx, 0.3), out)
      body.start()
      // Drops tapping the pane and the sill.
      const taps = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.05 + rand() * 0.22) burst(ctx, out, taps, t, { freq: 700 + rand() * 1800, q: 6 + rand() * 10, gain: 0.1 + rand() * 0.35, decay: 0.02 + rand() * 0.05, pan: rand() * 1.4 - 0.7 })
    },
  },
  {
    id: 'blizzard',
    duration: 26,
    trim: 1.1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      for (const [centre, q, level] of [[420, 2.2, 0.5], [900, 3.5, 0.3], [1900, 5, 0.14]] as const) {
        const src = noiseSource(ctx, 'pink', D, rand)
        const bp = filter(ctx, 'bandpass', centre, q)
        // The pitch of the wind rises and falls as gusts pass.
        for (let t = 0; t <= D; t += 1.5 + rand() * 3) bp.frequency.linearRampToValueAtTime(centre * (0.6 + rand() * 0.9), t)
        const g = ctx.createGain()
        wander(g, D, rand, level * 0.3, level, 3)
        chain(src, bp, g, panner(ctx, rand() * 1.2 - 0.6), out)
        src.start()
      }
      const snow = noiseSource(ctx, 'white', D, rand)
      chain(snow, filter(ctx, 'highpass', 5000), gain(ctx, 0.02), out)
      snow.start()
    },
  },
  {
    id: 'waterfall',
    duration: 12,
    trim: 0.8,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const wash = noiseSource(ctx, 'white', D, rand)
      chain(wash, filter(ctx, 'bandpass', 1600, 0.35), gain(ctx, 0.5), out)
      wash.start()
      const thunder = noiseSource(ctx, 'brown', D, rand)
      const g = ctx.createGain()
      wander(g, D, rand, 0.5, 0.7, 1.2)
      chain(thunder, filter(ctx, 'lowpass', 300), g, out)
      thunder.start()
      const spray = noiseSource(ctx, 'white', D, rand)
      chain(spray, filter(ctx, 'highpass', 4500), gain(ctx, 0.07), out)
      spray.start()
    },
  },
  {
    id: 'lake',
    duration: 22,
    trim: 1.6,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const air = noiseSource(ctx, 'pink', D, rand)
      chain(air, filter(ctx, 'lowpass', 900), gain(ctx, 0.08), out)
      air.start()
      // Small waves lapping at the shore, every few seconds.
      const lap = noiseBuffer(ctx, 'pink', 3, rand)
      for (let t = 0.5; t < D - 2.5; t += 2.2 + rand() * 2.6) {
        const src = ctx.createBufferSource()
        src.buffer = lap
        const bp = filter(ctx, 'bandpass', 500 + rand() * 500, 0.8)
        bp.frequency.setValueAtTime(380, t)
        bp.frequency.linearRampToValueAtTime(1300 + rand() * 600, t + 1.1)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.32 + rand() * 0.2, t + 0.9)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
        chain(src, bp, g, panner(ctx, rand() * 1.2 - 0.6), out)
        src.start(t)
        src.stop(t + 2.5)
      }
    },
  },
  {
    id: 'drip',
    duration: 20,
    trim: 2.4,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const hush = noiseSource(ctx, 'brown', D, rand)
      chain(hush, filter(ctx, 'lowpass', 220), gain(ctx, 0.2), out)
      hush.start()
      // Drops falling into still water in a hollow space: a short chirp, then its echo.
      for (let t = 0.4; t < D - 1; t += 0.5 + rand() * 1.8) {
        const f = 700 + rand() * 1400
        const pan = rand() * 1.6 - 0.8
        tone(ctx, out, t, { from: f, to: f * 1.9, dur: 0.07, gain: 0.16 + rand() * 0.2, pan })
        tone(ctx, out, t + 0.16, { from: f * 1.1, to: f * 1.8, dur: 0.06, gain: 0.05, pan: -pan })
        tone(ctx, out, t + 0.33, { from: f * 1.1, to: f * 1.7, dur: 0.05, gain: 0.02, pan })
      }
    },
  },
  {
    id: 'leaves',
    duration: 20,
    trim: 1.7,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      for (let layer = 0; layer < 3; layer++) {
        const src = noiseSource(ctx, 'white', D, rand)
        const bp = filter(ctx, 'bandpass', 2600 + layer * 1500, 0.7)
        const g = ctx.createGain()
        wander(g, D, rand, 0.01, 0.2 - layer * 0.04, 1.6)
        chain(src, bp, g, panner(ctx, layer - 1), out)
        src.start()
      }
      const twigs = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.3 + rand() * 1.6) burst(ctx, out, twigs, t, { freq: 3000 + rand() * 4000, q: 3, gain: 0.05 + rand() * 0.1, decay: 0.01 + rand() * 0.03, pan: rand() * 2 - 1, type: 'highpass' })
    },
  },
  {
    id: 'cicadas',
    duration: 18,
    trim: 1.3,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      // Several insects, each a narrow band of noise switched on and off many times a second.
      for (let i = 0; i < 5; i++) {
        const src = noiseSource(ctx, 'white', D, rand)
        const bp = filter(ctx, 'bandpass', 4200 + rand() * 2600, 14)
        const pulse = ctx.createGain()
        pulse.gain.value = 0
        const lfo = ctx.createOscillator()
        lfo.type = 'square'
        lfo.frequency.value = 24 + rand() * 30
        const depth = gain(ctx, 0.5)
        lfo.connect(depth).connect(pulse.gain)
        const swell = ctx.createGain()
        wander(swell, D, rand, 0.02, 0.2, 2.5)
        chain(src, bp, pulse, swell, panner(ctx, rand() * 2 - 1), out)
        src.start()
        lfo.start()
      }
    },
  },
  {
    id: 'meadow',
    duration: 28,
    trim: 2.6,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const breeze = noiseSource(ctx, 'pink', D, rand)
      const bg = ctx.createGain()
      wander(bg, D, rand, 0.04, 0.14, 3)
      chain(breeze, filter(ctx, 'bandpass', 900, 0.4), bg, out)
      breeze.start()
      // Bees drifting past.
      for (let i = 0; i < 4; i++) {
        const at = rand() * (D - 5)
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(190 + rand() * 60, at)
        osc.frequency.linearRampToValueAtTime(170 + rand() * 60, at + 4)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.035, at + 1.6)
        g.gain.linearRampToValueAtTime(0, at + 4)
        const p = ctx.createStereoPanner()
        const from = rand() < 0.5 ? -1 : 1
        p.pan.setValueAtTime(from, at)
        p.pan.linearRampToValueAtTime(-from, at + 4)
        chain(osc, filter(ctx, 'lowpass', 900), g, p, out)
        osc.start(at)
        osc.stop(at + 4.1)
      }
      // A few birds, far off.
      for (let t = 1; t < D - 1; t += 2.5 + rand() * 4) {
        const base = 2600 + rand() * 1800
        const notes = 2 + Math.floor(rand() * 3)
        const pan = rand() * 1.6 - 0.8
        for (let k = 0; k < notes; k++) tone(ctx, out, t + k * 0.13, { from: base * (1 + rand() * 0.2), to: base * (0.8 + rand() * 0.5), dur: 0.08, gain: 0.03 + rand() * 0.03, pan })
      }
    },
  },
  {
    id: 'frogs',
    duration: 20,
    trim: 2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const water = noiseSource(ctx, 'brown', D, rand)
      chain(water, filter(ctx, 'lowpass', 300), gain(ctx, 0.14), out)
      water.start()
      // Each frog has its own pitch and place, and croaks in short runs.
      const frogs = Array.from({ length: 5 }, () => ({ f: 190 + rand() * 520, pan: rand() * 1.8 - 0.9, rate: 0.09 + rand() * 0.08 }))
      for (const frog of frogs) {
        for (let t = rand() * 4; t < D - 1; t += 2 + rand() * 5) {
          const croaks = 2 + Math.floor(rand() * 4)
          for (let k = 0; k < croaks; k++) {
            const at = t + k * (frog.rate * 2.4)
            const osc = ctx.createOscillator()
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(frog.f, at)
            osc.frequency.linearRampToValueAtTime(frog.f * 1.25, at + frog.rate)
            const g = ctx.createGain()
            g.gain.setValueAtTime(0, at)
            g.gain.linearRampToValueAtTime(0.06, at + 0.015)
            g.gain.exponentialRampToValueAtTime(0.0001, at + frog.rate)
            chain(osc, filter(ctx, 'bandpass', frog.f * 2.2, 3), g, panner(ctx, frog.pan), out)
            osc.start(at)
            osc.stop(at + frog.rate + 0.02)
          }
        }
      }
    },
  },
  {
    id: 'owl',
    duration: 30,
    trim: 2.4,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const night = noiseSource(ctx, 'pink', D, rand)
      chain(night, filter(ctx, 'bandpass', 500, 0.3), gain(ctx, 0.06), out)
      night.start()
      const crickets = noiseSource(ctx, 'white', D, rand)
      const chirp = ctx.createGain()
      chirp.gain.value = 0
      const lfo = ctx.createOscillator()
      lfo.type = 'square'
      lfo.frequency.value = 17
      lfo.connect(gain(ctx, 0.5)).connect(chirp.gain)
      chain(crickets, filter(ctx, 'bandpass', 4600, 18), chirp, gain(ctx, 0.05), out)
      crickets.start()
      lfo.start()
      // The owl: hoo, hoo-hoo… then a long silence.
      for (let t = 2 + rand() * 3; t < D - 3; t += 8 + rand() * 6) {
        const f = 310 + rand() * 50
        const pan = rand() * 1.2 - 0.6
        for (const [dt, dur] of [[0, 0.45], [0.75, 0.22], [1.05, 0.55]] as const) {
          const osc = ctx.createOscillator()
          osc.frequency.setValueAtTime(f, t + dt)
          osc.frequency.linearRampToValueAtTime(f * 0.92, t + dt + dur)
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, t + dt)
          g.gain.linearRampToValueAtTime(0.12, t + dt + 0.06)
          g.gain.linearRampToValueAtTime(0, t + dt + dur)
          chain(osc, g, panner(ctx, pan), out)
          osc.start(t + dt)
          osc.stop(t + dt + dur + 0.02)
        }
      }
    },
  },
  {
    id: 'campfire',
    duration: 20,
    trim: 1.1,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const flame = noiseSource(ctx, 'brown', D, rand)
      const fg = ctx.createGain()
      wander(fg, D, rand, 0.25, 0.5, 0.8)
      chain(flame, filter(ctx, 'lowpass', 420, 0.7), fg, out)
      flame.start()
      // Out of doors: a little wind, and wood that pops harder than it does in a grate.
      const wind = noiseSource(ctx, 'pink', D, rand)
      const wg = ctx.createGain()
      wander(wg, D, rand, 0.02, 0.1, 3)
      chain(wind, filter(ctx, 'bandpass', 600, 0.5), wg, out)
      wind.start()
      const clicks = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 0; t < D; t += 0.08 + rand() * 0.5) {
        const big = rand() < 0.12
        burst(ctx, out, clicks, t, { freq: big ? 500 + rand() * 900 : 1200 + rand() * 4200, q: 1 + rand() * 3, gain: big ? 0.6 + rand() * 0.3 : 0.1 + rand() * 0.3, decay: big ? 0.05 : 0.004 + rand() * 0.02, pan: rand() * 1.4 - 0.7 })
      }
    },
  },
  {
    id: 'cups',
    duration: 24,
    trim: 2.2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const room = noiseSource(ctx, 'pink', D, rand)
      chain(room, filter(ctx, 'bandpass', 500, 0.4), gain(ctx, 0.07), out)
      room.start()
      // China on china: two or three high partials, struck and gone.
      for (let t = 0.6; t < D - 0.5; t += 0.9 + rand() * 3.2) {
        const f = 1900 + rand() * 2600
        const pan = rand() * 1.6 - 0.8
        const hits = rand() < 0.35 ? 2 : 1
        for (let k = 0; k < hits; k++) {
          const at = t + k * (0.07 + rand() * 0.05)
          tone(ctx, out, at, { from: f, to: f * 0.995, dur: 0.16 + rand() * 0.2, gain: 0.05 + rand() * 0.06, pan })
          tone(ctx, out, at, { from: f * 2.76, to: f * 2.74, dur: 0.07, gain: 0.02, pan })
        }
      }
      // The espresso machine, once.
      const at = 6 + rand() * 8
      const steam = noiseSource(ctx, 'white', 4, rand)
      const sg = ctx.createGain()
      sg.gain.setValueAtTime(0, at)
      sg.gain.linearRampToValueAtTime(0.07, at + 0.5)
      sg.gain.linearRampToValueAtTime(0.05, at + 2.4)
      sg.gain.linearRampToValueAtTime(0, at + 3.2)
      chain(steam, filter(ctx, 'bandpass', 3800, 1.2), sg, panner(ctx, 0.6), out)
      steam.start(at)
      steam.stop(at + 3.4)
    },
  },
  {
    id: 'keyboard',
    duration: 18,
    crossfade: 0.6,
    trim: 6,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const keys = noiseBuffer(ctx, 'white', 1, rand)
      let t = 0.2
      while (t < D - 0.3) {
        // Words: a run of keys, a space bar, a pause to think.
        const letters = 2 + Math.floor(rand() * 8)
        for (let k = 0; k < letters && t < D - 0.3; k++) {
          burst(ctx, out, keys, t, { freq: 1500 + rand() * 1500, q: 2.5, gain: 0.16 + rand() * 0.14, decay: 0.018, pan: rand() * 0.8 - 0.4 })
          burst(ctx, out, keys, t + 0.012, { freq: 300 + rand() * 200, q: 1.5, gain: 0.08, decay: 0.03, pan: 0, type: 'lowpass' })
          t += 0.07 + rand() * 0.11
        }
        burst(ctx, out, keys, t, { freq: 700, q: 1.2, gain: 0.2, decay: 0.035, pan: 0, type: 'lowpass' })
        t += 0.18 + rand() * (rand() < 0.2 ? 2.4 : 0.5)
      }
    },
  },
  {
    id: 'pages',
    duration: 26,
    trim: 2.4,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const hall = noiseSource(ctx, 'pink', D, rand)
      chain(hall, filter(ctx, 'lowpass', 500), gain(ctx, 0.08), out)
      hall.start()
      const paper = noiseBuffer(ctx, 'white', 2, rand)
      for (let t = 1.5; t < D - 1.5; t += 4 + rand() * 6) {
        // A page lifted and turned: a rising rustle, then the soft slap as it lands.
        const src = ctx.createBufferSource()
        src.buffer = paper
        const bp = filter(ctx, 'bandpass', 1800, 0.9)
        bp.frequency.setValueAtTime(1500, t)
        bp.frequency.linearRampToValueAtTime(4200, t + 0.5)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.14, t + 0.25)
        g.gain.linearRampToValueAtTime(0.03, t + 0.55)
        g.gain.linearRampToValueAtTime(0, t + 0.7)
        const pan = rand() * 1.2 - 0.6
        chain(src, bp, g, panner(ctx, pan), out)
        src.start(t)
        src.stop(t + 0.75)
        burst(ctx, out, paper, t + 0.62, { freq: 420, q: 1, gain: 0.2, decay: 0.05, pan, type: 'lowpass' })
      }
      // Someone shifts in a chair; a pencil is put down.
      for (let t = 3; t < D - 1; t += 7 + rand() * 9) burst(ctx, out, paper, t, { freq: 240 + rand() * 200, q: 2, gain: 0.16, decay: 0.09, pan: rand() * 1.6 - 0.8, type: 'lowpass' })
    },
  },
  {
    id: 'city',
    duration: 30,
    trim: 1.5,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const hum = noiseSource(ctx, 'brown', D, rand)
      chain(hum, filter(ctx, 'lowpass', 220), gain(ctx, 0.5), out)
      hum.start()
      const air = noiseSource(ctx, 'pink', D, rand)
      chain(air, filter(ctx, 'bandpass', 800, 0.3), gain(ctx, 0.07), out)
      air.start()
      // Cars passing some streets away: a swell of low noise moving across.
      for (let t = 1; t < D - 6; t += 3 + rand() * 5) {
        const src = noiseSource(ctx, 'pink', 6, rand)
        const lp = filter(ctx, 'lowpass', 500, 0.8)
        lp.frequency.setValueAtTime(300, t)
        lp.frequency.linearRampToValueAtTime(900 + rand() * 500, t + 2.6)
        lp.frequency.linearRampToValueAtTime(280, t + 5.6)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.12 + rand() * 0.1, t + 2.6)
        g.gain.linearRampToValueAtTime(0, t + 5.6)
        const p = ctx.createStereoPanner()
        const from = rand() < 0.5 ? -0.9 : 0.9
        p.pan.setValueAtTime(from, t)
        p.pan.linearRampToValueAtTime(-from, t + 5.6)
        chain(src, lp, g, p, out)
        src.start(t)
        src.stop(t + 5.8)
      }
    },
  },
  {
    id: 'fan',
    duration: 12,
    fold: 2,
    trim: 0.9,
    render(ctx, out, rand, D) {
      const air = noiseSource(ctx, 'pink', D + 2, rand)
      const blades = ctx.createGain()
      blades.gain.value = 0.45
      // Three blades at 3 turns a second: a soft beat nine times a second. Whole cycles fit the loop exactly.
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 9
      lfo.connect(gain(ctx, 0.07)).connect(blades.gain)
      chain(air, filter(ctx, 'lowpass', 1200, 0.5), blades, seamGain(ctx, 1, D, 2), out)
      air.start()
      lfo.start()
      const motor = ctx.createOscillator()
      motor.type = 'triangle'
      motor.frequency.value = 100
      chain(motor, gain(ctx, 0.03), out)
      motor.start()
      // A whole number of cycles, then silence: the hum meets itself exactly at the loop point.
      motor.stop(D)
    },
  },
  {
    id: 'train',
    duration: 16,
    fold: 2,
    trim: 1.3,
    render(ctx, out, rand, D) {
      const rumble = noiseSource(ctx, 'brown', D + 2, rand)
      chain(rumble, filter(ctx, 'lowpass', 260), seamGain(ctx, 0.6, D, 2), out)
      rumble.start()
      const rush = noiseSource(ctx, 'pink', D + 2, rand)
      chain(rush, filter(ctx, 'bandpass', 1400, 0.4), seamGain(ctx, 0.06, D, 2), out)
      rush.start()
      // Wheels over the rail joints: da-dum … da-dum, an exact number of times per loop so it never stumbles.
      const clack = noiseBuffer(ctx, 'white', 1, rand)
      const period = D / 10
      for (let i = 0; i < 10; i++) {
        const t = i * period + 0.05
        for (const dt of [0, 0.17]) {
          burst(ctx, out, clack, t + dt, { freq: 180, q: 1.4, gain: 0.5, decay: 0.07, pan: -0.2, type: 'lowpass' })
          burst(ctx, out, clack, t + dt + 0.005, { freq: 1700 + rand() * 500, q: 3, gain: 0.07, decay: 0.03, pan: 0.2 })
        }
      }
    },
  },
  {
    id: 'plane',
    duration: 14,
    trim: 0.9,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const engines = noiseSource(ctx, 'brown', D, rand)
      chain(engines, filter(ctx, 'lowpass', 340, 0.6), gain(ctx, 0.75), out)
      engines.start()
      const cabin = noiseSource(ctx, 'pink', D, rand)
      chain(cabin, filter(ctx, 'bandpass', 2400, 0.35), gain(ctx, 0.12), out)
      cabin.start()
      for (const f of [92, 138]) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = f
        chain(osc, gain(ctx, 0.03), out)
        osc.start()
      }
    },
  },
  {
    id: 'car',
    duration: 24,
    trim: 1.2,
    render(ctx, out, rand) {
      const D = ctx.length / ctx.sampleRate
      const road = noiseSource(ctx, 'brown', D, rand)
      const rg = ctx.createGain()
      wander(rg, D, rand, 0.5, 0.68, 4)
      chain(road, filter(ctx, 'lowpass', 300), rg, out)
      road.start()
      const tyres = noiseSource(ctx, 'pink', D, rand)
      chain(tyres, filter(ctx, 'bandpass', 900, 0.5), gain(ctx, 0.08), out)
      tyres.start()
      const engine = ctx.createOscillator()
      engine.type = 'triangle'
      engine.frequency.value = 74
      chain(engine, gain(ctx, 0.05), out)
      engine.start()
      // Cat's-eyes and expansion joints under the wheels, now and then.
      const thud = noiseBuffer(ctx, 'white', 1, rand)
      for (let t = 2; t < D - 1; t += 3 + rand() * 6) {
        burst(ctx, out, thud, t, { freq: 140, q: 1.2, gain: 0.35, decay: 0.06, pan: -0.3, type: 'lowpass' })
        burst(ctx, out, thud, t + 0.11, { freq: 140, q: 1.2, gain: 0.28, decay: 0.06, pan: 0.3, type: 'lowpass' })
      }
    },
  },
]
