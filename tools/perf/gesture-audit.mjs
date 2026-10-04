/**
 * Atlas gesture audit: what does a person actually feel while panning and
 * zooming, and where does the time go? Complements profile.mjs (one phone
 * workload) with three device shapes and the behaviours profile.mjs can't see:
 *
 *   - frame times and long animation frames per gesture (rAF + LoAF)
 *   - how often the base map is repainted and the names re-laid out mid-gesture
 *   - how many names and symbols are on screen at the end of a held drag,
 *     before and after the finger lifts (the "empty map while dragging" check)
 *   - tap → place card latency
 *   - repaints caused by selecting a place and by the shell resizing the map
 *     (rail collapse, full screen)
 *   - main-thread and raster time by trace event for one zoom and one long pan
 *
 *   node gesture-audit.mjs [baseUrl] [desktop|laptop-hidpi|phone] [--counts] [--budget=budgets/gesture.json]
 *
 * `--counts` runs only the passes that count repaints and layouts (about a
 * minute per shape, and the same on any machine) – the mode CI uses.
 * `--budget` fails the run when a budgeted measurement is exceeded (budget.mjs).
 *
 * Run against a production build (`npm run build && npm run preview`). Results
 * go to out/gesture-audit/<config>.json. Set CHROMIUM_PATH to use a specific
 * Chrome; SHOTS=1 saves the held-drag screenshots.
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { budgetArg, checkBudget, positional, reportBudget } from './budget.mjs'
import { prepare } from './lib.mjs'

const [base = 'http://localhost:4173/', only] = positional()
const countsOnly = process.argv.includes('--counts')
const budget = budgetArg()
const outDir = fileURLToPath(new URL('./out/gesture-audit/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const CONFIGS = [
  { id: 'desktop', width: 1440, height: 900, dpr: 1.25, touch: false, throttle: 1 },
  { id: 'laptop-hidpi', width: 1440, height: 900, dpr: 2, touch: false, throttle: 1 },
  { id: 'phone', width: 390, height: 844, dpr: 3, touch: true, throttle: 4 },
].filter((c) => !only || c.id === only)

const verdicts = []

for (const config of CONFIGS) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: config.dpr, hasTouch: config.touch, isMobile: config.touch })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await prepare(page, base, { route: '#/atlas' })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')

  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })

  const box = await page.locator('[role=application]').first().boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2 - (config.touch ? 60 : 0)

  // ── static facts about the renderer ──────────────────────────────────────
  const facts = await page.evaluate(() => {
    const atlas = document.querySelector('.atlas')
    const base = atlas.querySelector('.atlas-base') ?? atlas.querySelector('.atlas-layer')
    const paths = [...base.querySelectorAll('path')]
    const segs = paths.map((p) => (p.getAttribute('d').match(/[ML]/g) ?? []).length)
    return {
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      mapCss: [atlas.clientWidth, atlas.clientHeight],
      baseLayerCss: [base.offsetWidth, base.offsetHeight],
      baseLayerDevicePx: Math.round(base.offsetWidth * devicePixelRatio) * Math.round(base.offsetHeight * devicePixelRatio),
      basePaths: paths.length,
      baseSegments: segs.reduce((a, b) => a + b, 0),
      largestPathSegments: Math.max(0, ...segs),
      pathDataChars: paths.reduce((a, p) => a + p.getAttribute('d').length, 0),
      names: atlas.querySelector('.atlas-names')?.atlasEntries?.filter(e => !e.label.path).length ?? atlas.querySelectorAll('.atlas-name:not(.atlas-river-name)').length,
      symbols: atlas.querySelectorAll('.atlas-sym').length,
      riverNames: atlas.querySelector('.atlas-names')?.atlasEntries?.filter(e => e.label.path).length ?? (atlas.querySelectorAll('.atlas-river-name').length || atlas.querySelectorAll('textPath').length),
      labelLayerNodes: [...atlas.querySelectorAll('.atlas-labels, .atlas-names')].reduce((total, layer) => total + layer.querySelectorAll('*').length, 0),
      documentNodes: document.querySelectorAll('*').length,
    }
  })

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle })

  // ── input helpers ────────────────────────────────────────────────────────
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  /** A drag that keeps the pointer down at the end until `release` is called. */
  async function hold(dx, dy, ms) {
    const steps = Math.max(2, Math.round(ms / 8))
    if (config.touch) await touch('touchStart', [[cx, cy]])
    else {
      await page.mouse.move(cx, cy)
      await page.mouse.down()
    }
    for (let i = 1; i <= steps; i++) {
      const x = cx + (dx * i) / steps
      const y = cy + (dy * i) / steps
      if (config.touch) await touch('touchMove', [[x, y]])
      else await page.mouse.move(x, y)
      await page.waitForTimeout(8)
    }
    return async () => (config.touch ? touch('touchEnd', []) : page.mouse.up())
  }
  const drag = async (dx, dy, ms = 700) => (await hold(dx, dy, ms))()
  /**
   * Wheel input at a fixed cadence, like a real wheel or trackpad. The events are not awaited one
   * by one: the browser acknowledges an input event only once a frame has handled it, so awaiting
   * each would slow the input down whenever a frame is slow and hide exactly what is being measured.
   */
  async function zoom(deltaY, count, gapMs) {
    await page.mouse.move(cx, cy)
    const sent = []
    for (let i = 0; i < count; i++) {
      sent.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY }).catch(() => {}))
      await new Promise((r) => setTimeout(r, gapMs))
    }
    await Promise.all(sent)
  }
  async function pinch(from, to, steps = 40) {
    await touch('touchStart', [
      [cx - from, cy],
      [cx + from, cy],
    ])
    for (let i = 1; i <= steps; i++) {
      const d = from + ((to - from) * i) / steps
      await touch('touchMove', [
        [cx - d, cy],
        [cx + d, cy],
      ])
      await page.waitForTimeout(16)
    }
    await touch('touchEnd', [])
  }

  // ── measurement ──────────────────────────────────────────────────────────
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  async function measure(name, gesture, { counts = false } = {}) {
    await page.evaluate((counts) => {
      const a = (window.__audit ??= {})
      a.frames = []
      a.long = []
      a.loaf = []
      a.basePaints = 0
      a.labelCommits = 0
      a.anchorWrites = 0
      const nameTimes = document.querySelector('.atlas-names')?.atlasPositionTimes
      if (nameTimes) nameTimes.length = 0
      const gen = (a.gen = (a.gen ?? 0) + 1)
      const loop = (t) => {
        if (a.gen !== gen) return
        a.frames.push(t)
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
      a.po?.disconnect()
      a.po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.entryType === 'longtask') a.long.push(e.duration)
          else
            a.loaf.push({
              ms: Math.round(e.duration),
              blocking: Math.round(e.blockingDuration),
              script: Math.round(e.scripts.reduce((s, x) => s + x.duration, 0)),
              styleLayout: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
            })
        }
      })
      a.po.observe({ type: 'longtask' })
      try {
        a.po.observe({ type: 'long-animation-frame' })
      } catch {}
      a.mo?.disconnect()
      a.mo = null
      if (counts) {
        // A base repaint is a write to the painted world group's transform; a label layout is a React commit in the label layer.
        const atlas = document.querySelector('.atlas')
        const g = atlas.querySelector('.atlas-base') ? null : atlas.querySelector('.atlas-layer svg > g')
        const labels = atlas.querySelector('.atlas-labels')
        const names = atlas.querySelector('.atlas-names')
        a.mo = new MutationObserver((list) => {
          let commit = false
          for (const m of list) {
            if (m.target === g) a.basePaints++
            else if (m.type === 'childList') commit = true
            else if (m.target !== labels && m.target !== names) a.anchorWrites++
          }
          if (commit) a.labelCommits++
        })
        if (g) a.mo.observe(g, { attributes: true, attributeFilter: ['transform'] })
        a.mo.observe(labels, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
        if (names) a.mo.observe(names, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
      }
    }, counts)
    const m0 = await metrics()
    const t0 = Date.now()
    const extra = await gesture()
    const wall = Date.now() - t0
    const m1 = await metrics()
    const r = await page.evaluate(() => {
      const a = window.__audit
      a.gen++
      a.mo?.disconnect()
      return {
        frames: a.frames,
        long: a.long,
        loaf: a.loaf,
        basePaints: a.basePaints,
        labelCommits: a.labelCommits,
        anchorWrites: a.anchorWrites,
        positionTimes: document.querySelector('.atlas-names')?.atlasPositionTimes ?? [],
      }
    })
    const d = r.frames
      .slice(1)
      .map((t, i) => t - r.frames[i])
      .sort((a, b) => a - b)
    const pct = (p) => +(d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0).toFixed(1)
    const res = {
      name,
      wallMs: wall,
      frames: d.length,
      fps: +(d.length / (wall / 1000)).toFixed(1),
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      max: +(d[d.length - 1] ?? 0).toFixed(1),
      over33: d.filter((x) => x > 33.4).length,
      over50: d.filter((x) => x > 50).length,
      over100: d.filter((x) => x > 100).length,
      longTasks: r.long.length,
      longTaskMs: Math.round(r.long.reduce((a, b) => a + b, 0)),
      longestTask: Math.round(Math.max(0, ...r.long)),
      loaf: r.loaf.sort((a, b) => b.ms - a.ms).slice(0, 3),
      scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
      styleMs: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000),
      layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
      taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
      labelPositionMaxMs: +Math.max(0, ...r.positionTimes).toFixed(2),
      labelPositionP95Ms: +(r.positionTimes.toSorted((a, b) => a - b)[Math.floor(r.positionTimes.length * 0.95)] ?? 0).toFixed(2),
      ...(counts ? { basePaints: r.basePaints, labelCommits: r.labelCommits, anchorStyleWrites: r.anchorWrites } : {}),
      ...(extra ?? {}),
    }
    console.log(`[${config.id}] ${JSON.stringify(res)}`)
    return res
  }

  /** Names and symbols whose anchor is inside the map right now. */
  const onScreen = () =>
    page.evaluate(() => {
      const atlas = document.querySelector('.atlas')
      const r = atlas.getBoundingClientRect()
      const surface = atlas.querySelector('.atlas-names')
      if (surface?.atlasEntries) {
        const view = surface.atlasLabelView()
        const at = surface.atlasEntries.filter(e => !e.label.path).map(e => {
          const x = view.x + e.anchor.worldX * view.k + e.anchor.offsetX + e.left
          const y = view.y + e.anchor.worldY * view.k + e.anchor.offsetY + e.top
          return { e, x, y }
        }).filter(({ e, x, y }) => x + e.width > 0 && y + e.height > 0 && x < r.width && y < r.height)
        const symbols = [...atlas.querySelectorAll('.atlas-sym')].filter(el => {
          const b = el.getBoundingClientRect()
          return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom
        }).length
        return { names: at.length, symbols, at: at.map(({ e, x, y }) => [e.label.text, Math.round((r.left + x) * 10) / 10, Math.round((r.top + y) * 10) / 10]) }
      }
      const inside = (el) => {
        const b = el.getBoundingClientRect()
        return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom
      }
      // Keep the legacy retention metric scoped to point names; curved rivers were SVG textPaths at the checkpoint.
      const names = [...atlas.querySelectorAll('.atlas-point-name, .atlas-name:not(.atlas-river-name) > .atlas-name-text')].filter(inside)
      // Where each name is, to see whether it stays put across the layout that follows a release.
      const at = names.map((el) => {
        const b = el.getBoundingClientRect()
        return [el.textContent, Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10]
      })
      return { names: names.length, symbols: [...atlas.querySelectorAll('.atlas-sym')].filter(inside).length, at }
    })

  const settleMs = 900
  const results = []
  const run = async (...a) => results.push(await measure(...a))

  /** Zoomed in the sheet is wider than the map, so a held drag really travels: what is on screen before the finger lifts? */
  const heldDrag = async () => {
    const release = await hold(-box.width * 0.9, -box.height * 0.3, 1400)
    await page.waitForTimeout(600)
    const held = await onScreen()
    if (process.env.SHOTS) await page.screenshot({ path: `${outDir}${config.id}-held-drag-zoomed.png` })
    await release()
    await page.waitForTimeout(settleMs)
    const settled = await onScreen()
    if (process.env.SHOTS) await page.screenshot({ path: `${outDir}${config.id}-held-drag-zoomed-released.png` })
    // Of the names on screen at release, how many are still exactly where they were once the view has settled?
    const after = new Map(settled.at.map(([text, x, y]) => [text, [x, y]]))
    const kept = held.at.filter(([text, x, y]) => {
      const p = after.get(text)
      return p && Math.abs(p[0] - x) <= 1 && Math.abs(p[1] - y) <= 1
    }).length
    const count = ({ names, symbols }) => ({ names, symbols })
    return {
      labelsWhileHeld: count(held),
      labelsAfterRelease: count(settled),
      namesHeldShare: +(held.names / Math.max(1, settled.names)).toFixed(2),
      symbolsHeldShare: +(held.symbols / Math.max(1, settled.symbols)).toFixed(2),
      namesKeptShare: +(kept / Math.max(1, held.names)).toFixed(2),
    }
  }

  if (!countsOnly) {
    // Timing passes: nothing observing the DOM.
    await run('idle-2s', () => page.waitForTimeout(2000))
    await run('pan-short', async () => {
      await drag(-140, -60)
      await drag(160, 90)
      await page.waitForTimeout(settleMs)
    })
    await run('pan-long', async () => {
      await drag(-box.width * 0.85, -box.height * 0.35, 1400)
      await page.waitForTimeout(settleMs)
    })
    await run('pan-back', async () => {
      await drag(box.width * 0.85, box.height * 0.35, 1400)
      await page.waitForTimeout(settleMs)
    })
    if (config.touch) {
      await run('pinch-in', async () => {
        await pinch(40, 160)
        await page.waitForTimeout(settleMs)
      })
      await run('pinch-out', async () => {
        await pinch(160, 40)
        await page.waitForTimeout(settleMs)
      })
    }
    await run('zoom-in-continuous', async () => {
      await zoom(-30, 60, 16)
      await page.waitForTimeout(settleMs)
    })
    await run('pan-zoomed', async () => {
      await drag(-200, -80)
      await drag(180, 120)
      await page.waitForTimeout(settleMs)
    })
    await run('held-drag-zoomed', heldDrag)
    await run('fling-zoomed', async () => {
      // A quick flick: momentum carries the map on after the release.
      await drag(box.width * 0.5, box.height * 0.2, 160)
      await page.waitForTimeout(1600)
    })
    await run('zoom-out-continuous', async () => {
      await zoom(30, 60, 16)
      await page.waitForTimeout(settleMs)
    })
    await run('wheel-notches-in', async () => {
      await zoom(-100, 8, 110)
      await page.waitForTimeout(settleMs)
    })
    await run('wheel-notches-out', async () => {
      await zoom(100, 8, 110)
      await page.waitForTimeout(settleMs)
    })
  }

  // Count passes: how much repaint and re-layout a gesture causes.
  await run(
    'counts-zoom-in',
    async () => {
      await zoom(-30, 60, 16)
      await page.waitForTimeout(settleMs)
    },
    { counts: true },
  )
  await run('counts-held-drag-zoomed', heldDrag, { counts: true })
  await run(
    'counts-pan-long',
    async () => {
      await drag(-box.width * 0.5, -box.height * 0.2, 1000)
      await page.waitForTimeout(settleMs)
    },
    { counts: true },
  )
  await run(
    'counts-zoom-out',
    async () => {
      await zoom(30, 60, 16)
      await page.waitForTimeout(settleMs)
    },
    { counts: true },
  )
  await run(
    'counts-notches',
    async () => {
      await zoom(-100, 6, 110)
      await page.waitForTimeout(settleMs)
      await zoom(100, 6, 110)
      await page.waitForTimeout(settleMs)
    },
    { counts: true },
  )

  // Tap → the place card (desktop inspector or phone sheet) is in the DOM. Also: what did selecting cost the map?
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  // A fixed wait can end during the preceding SVG repaint on a slow runner.
  // Selection is an independent pass: do not charge it a late wheel settlement.
  await page.waitForFunction(() => !document.querySelector('.atlas.atlas-moving'))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const tap = await page.evaluate(() => {
    const bounds = document.querySelector('.atlas').getBoundingClientRect()
    for (const sym of document.querySelectorAll('.atlas .atlas-sym')) {
      const b = sym.getBoundingClientRect(),
        x = b.left + b.width / 2,
        y = b.top + b.height / 2
      if (x < bounds.left + 16 || x > bounds.right - 16 || y < bounds.top + 16 || y > bounds.bottom - 16 || y > innerHeight - 16) continue
      if (document.elementFromPoint(x, y)?.closest('button, [role=dialog]')) continue
      return { x, y }
    }
    return null
  })
  if (!tap) throw new Error('No visible place symbol available for the selection check')
  let tapLatency = null
  if (tap) {
    await page.evaluate(() => {
      window.__tap = null
      window.__tapUp = 0
      const seen = () => document.querySelector('[data-inspector] h2, [role=dialog] h2')
      const mo = new MutationObserver(() => {
        if (seen() && window.__tapUp && window.__tap === null) {
          window.__tap = performance.now() - window.__tapUp
          mo.disconnect()
        }
      })
      mo.observe(document.body, { childList: true, subtree: true })
      addEventListener('pointerup', () => (window.__tapUp = performance.now()), { capture: true, once: true })
    })
    await run(
      'counts-select-place',
      async () => {
        if (config.touch) await page.touchscreen.tap(tap.x, tap.y)
        else await page.mouse.click(tap.x, tap.y)
        await page.waitForTimeout(1200)
      },
      { counts: true },
    )
    tapLatency = await page.evaluate(() => (window.__tap === null ? null : Math.round(window.__tap)))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  console.log(`[${config.id}] tap → card ${tapLatency} ms`)

  // The shell resizing the map: collapsing the rail, entering and leaving the full-screen map.
  if (!config.touch) {
    await run(
      'counts-news-return',
      async () => {
        await page.getByRole('navigation', { name: 'Workspaces' }).getByRole('button', { name: 'News', exact: true }).click()
        await page.getByRole('navigation', { name: 'Workspaces' }).getByRole('button', { name: 'Atlas', exact: true }).click()
        await page.waitForTimeout(1200)
      },
      { counts: true },
    )
    await run(
      'counts-settings-return',
      async () => {
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
        await page.getByRole('navigation', { name: 'Workspaces' }).getByRole('button', { name: 'Atlas', exact: true }).click()
        await page.waitForTimeout(1200)
      },
      { counts: true },
    )
    await run(
      'counts-fullscreen-enter',
      async () => {
        await page.keyboard.press('Shift+F')
        await page.waitForTimeout(1200)
      },
      { counts: true },
    )
    await run(
      'counts-fullscreen-exit',
      async () => {
        await page.keyboard.press('Shift+F')
        await page.waitForTimeout(1200)
      },
      { counts: true },
    )
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle })

  // ── trace: where the time goes for one zoom and one long pan ─────────────
  async function trace(gesture) {
    const events = []
    const onData = (e) => events.push(...e.value)
    cdp.on('Tracing.dataCollected', onData)
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,cc,gpu,viz', transferMode: 'ReportEvents' })
    await gesture()
    await cdp.send('Tracing.end')
    await done
    cdp.off('Tracing.dataCollected', onData)
    const complete = events.filter((e) => e.ph === 'X' && e.dur)
    const byThread = new Map()
    for (const e of complete) if (/^(Layout|UpdateLayoutTree|Paint|FunctionCall|EventDispatch)$/.test(e.name)) byThread.set(`${e.pid}:${e.tid}`, (byThread.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur)
    const threadNames = new Map(events.filter((e) => e.ph === 'M' && e.name === 'thread_name').map((e) => [e.pid + ':' + e.tid, e.args?.name]))
    const rendererMain = [...byThread].filter(([key]) => threadNames.get(key) === 'CrRendererMain')
    const [mainThread] = (rendererMain.length ? rendererMain : [...byThread]).sort((a, b) => b[1] - a[1])[0] ?? []
    const sum = (list) => {
      const m = new Map()
      for (const e of list) m.set(e.name, (m.get(e.name) ?? 0) + e.dur / 1000)
      return Object.fromEntries(
        [...m]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 14)
          .map(([k, v]) => [k, Math.round(v)]),
      )
    }
    const main = complete.filter((e) => `${e.pid}:${e.tid}` === mainThread)
    const off = complete.filter((e) => `${e.pid}:${e.tid}` !== mainThread && /Raster|ImageDecode|Decode|GPUTask|DrawFrame|Draw|Commit|Activate|TileManager/i.test(e.name))
    const slow = main
      .filter((e) => !/^(RunTask|ThreadControllerImpl::RunTask|RunMicrotasks|Animation Frame|AnimationFrame)$/.test(e.name))
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8)
      .map((e) => `${e.name} ${(e.dur / 1000).toFixed(0)}ms`)
    return { mainThreadMs: sum(main), offThreadMs: sum(off), rasterTasks: off.filter((e) => e.name === 'RasterTask').length, slowestMainEvents: slow }
  }
  const traces = {}
  if (!countsOnly) {
    traces.zoomIn = await trace(async () => {
      await zoom(-30, 40, 16)
      await page.waitForTimeout(700)
    })
    traces.zoomOut = await trace(async () => {
      await zoom(30, 40, 16)
      await page.waitForTimeout(700)
    })
    traces.panLong = await trace(async () => {
      await drag(-box.width * 0.85, -box.height * 0.35, 1400)
      await page.waitForTimeout(700)
    })
    console.log(`[${config.id}] traces ${JSON.stringify(traces)}`)
  }

  const heap = await cdp.send('Runtime.getHeapUsage')
  writeFileSync(
    `${outDir}${config.id}${countsOnly ? '-counts' : ''}.json`,
    JSON.stringify({ config, gpu, facts, results, tapLatencyMs: tapLatency, traces, jsHeapUsedMB: +(heap.usedSize / 1048576).toFixed(1) }, null, 2),
  )
  await browser.close()

  const byName = Object.fromEntries(results.map((r) => [r.name, r]))
  byName.heap = { usedMB: +(heap.usedSize / 1048576).toFixed(1) }
  byName.tap = { latencyMs: tapLatency ?? NaN }
  verdicts.push(checkBudget(budget, config.id, byName))
}

process.exit(reportBudget(verdicts))
