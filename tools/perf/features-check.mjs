/**
 * End-to-end checks of the Tars UI overhaul in a real browser (dev server):
 * sound following the timer, task creation with subject/tags/metadata,
 * undo, the command palette, sidebar persistence and full-screen sync.
 *
 *   node features-check.mjs [baseUrl]          (default http://localhost:5173/ – needs the dev server,
 *                                                because it reads app modules through Vite)
 * Exits non-zero when a check fails.
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:5173/'
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

const audio = () => page.evaluate(async () => (await import('/src/audio/store.ts')).useAudio.getState().playing)
const timerStatus = () => page.evaluate(async () => (await import('/src/timer/store.ts')).useTimer.getState().timer.status)
const wait = (ms) => page.waitForTimeout(ms)

// ── 4) Sound follows the timer ──────────────────────────────────────────
await page.evaluate(async () => {
  const { useAudio } = await import('/src/audio/store.ts')
  useAudio.getState().clear()
  useAudio.getState().toggleSound('rain')
  useAudio.getState().pause()
})
await page.getByRole('button', { name: /^start focus/i }).click()
await wait(400)
check('start → soundscape plays', (await audio()) === true && (await timerStatus()) === 'running')
await page.getByRole('button', { name: /^pause$/i }).click()
await wait(300)
check('pause → soundscape pauses', (await audio()) === false)
await page.getByRole('button', { name: /^resume$/i }).click()
await wait(300)
check('resume → soundscape resumes', (await audio()) === true)
await page.getByRole('button', { name: /^pause$/i }).click()
await wait(300)
// Someone turns the sound back on by hand while paused; stopping must still silence it.
await page.evaluate(async () => (await import('/src/audio/store.ts')).useAudio.getState().play())
await page.getByRole('button', { name: /stop the timer/i }).click()
await wait(400)
check('stop from a paused timer → soundscape stops', (await audio()) === false && (await timerStatus()) === 'idle')
await page.getByRole('button', { name: /^start focus/i }).click()
await wait(300)
await page.keyboard.press('Space')
await wait(300)
check('Space shortcut pauses timer and sound', (await timerStatus()) === 'paused' && (await audio()) === false)
await page.getByRole('button', { name: /stop the timer/i }).click()
await wait(300)
const voicesGone = await page.evaluate(async () => {
  const { useAudio } = await import('/src/audio/store.ts')
  useAudio.getState().play()
  await new Promise((r) => setTimeout(r, 300))
  useAudio.getState().applyPreset([{ sound: 'waves', volume: 0.5 }], null)
  return Object.keys(useAudio.getState().layers)
})
check('switching presets replaces the layers (no two tracks at once)', voicesGone.length === 1 && voicesGone[0] === 'waves', voicesGone.join(','))
await page.evaluate(async () => (await import('/src/audio/store.ts')).useAudio.getState().stop())

// ── 1) Task creation with metadata ──────────────────────────────────────
await page.goto(base + '#/tasks?view=inbox')
await wait(900)
const input = page.getByRole('textbox', { name: /^new task$/i }).first()
await page.getByRole('button', { name: /more options/i }).first().click()
await input.fill('Kinematics problems')
await page.getByRole('button', { name: /^subject$/i }).first().click()
await page.getByRole('combobox').last().fill('Physics')
await page.getByText(/create subject “physics”/i).click()
await wait(300)
const tagField = page.getByRole('textbox', { name: /add a tag/i }).first()
await tagField.fill('exam')
await tagField.press('Enter')
await page.getByRole('radio', { name: /high/i }).first().click()
await input.press('Enter')
await wait(600)
const t1 = await page.evaluate(async () => {
  const { db } = await import('/src/data/db.ts')
  const t = await db.tasks.filter((x) => x.title === 'Kinematics problems').first()
  const l = t?.labelId ? await db.labels.get(t.labelId) : null
  return t && { subject: l?.name, tags: t.tags, priority: t.priority }
})
check('expanded quick add saves subject, tags and priority at creation', t1?.subject === 'Physics' && t1.tags?.[0] === 'exam' && t1.priority === 3, JSON.stringify(t1))

await input.fill('Physics revision tomorrow 5pm #important ~1h')
await wait(200)
const chipText = await page.locator('[aria-live="polite"]').first().innerText()
check('typed line shows what it understood (subject picked from title)', /Physics/.test(chipText) && /important/.test(chipText) && /17:00/.test(chipText), chipText.replace(/\s+/g, ' '))
await input.press('Enter')
await wait(600)
const t2 = await page.evaluate(async () => {
  const { db } = await import('/src/data/db.ts')
  const { addDaysKey, todayKey } = await import('/src/lib/time.ts')
  const t = await db.tasks.filter((x) => x.title === 'Physics revision').first()
  const l = t?.labelId ? await db.labels.get(t.labelId) : null
  return t && { subject: l?.name, tags: t.tags, plannedOk: t.plannedFor === addDaysKey(todayKey(), 1), dueTime: t.dueTime, est: t.estimatedPomodoros }
})
check('natural-language quick add fills subject, tag, date, time and estimate', t2?.subject === 'Physics' && t2.tags?.[0] === 'important' && t2.plannedOk && t2.dueTime === '17:00' && t2.est === 2, JSON.stringify(t2))

// ── Undo delete ─────────────────────────────────────────────────────────
await page.goto(base + '#/tasks?view=upcoming')
await wait(800)
await page.getByText('Physics revision').first().click()
await wait(500)
await page.getByRole('button', { name: /^delete task$/i }).click()
await wait(500)
const gone = await page.evaluate(async () => !(await (await import('/src/data/db.ts')).db.tasks.filter((x) => x.title === 'Physics revision').first()))
await page.getByRole('button', { name: /^undo$/i }).click()
await wait(500)
const back = await page.evaluate(async () => {
  const { db } = await import('/src/data/db.ts')
  const t = await db.tasks.filter((x) => x.title === 'Physics revision').first()
  return !!t && !(await db.tombstones.get(`tasks:${t.id}`))
})
check('deleting a task can be undone from the toast', gone && back)

// ── Command palette ─────────────────────────────────────────────────────
await page.keyboard.press('Control+k')
// On the dev server the palette's module is fetched on first use: wait for its field rather than a fixed time.
await page.getByRole('dialog', { name: 'Search and commands' }).getByRole('combobox').waitFor({ timeout: 5000 }).catch(() => {})
await wait(150)
await page.keyboard.type('Read chapter 4 fri #biology')
await wait(200)
await page.keyboard.press('Enter')
await wait(600)
const t3 = await page.evaluate(async () => (await (await import('/src/data/db.ts')).db.tasks.filter((x) => x.title === 'Read chapter 4').first())?.tags)
check('Ctrl+K palette captures a task in natural language', t3?.[0] === 'biology', JSON.stringify(t3))
await page.keyboard.press('Control+k')
await page.keyboard.type('insights')
await page.keyboard.press('Enter')
await wait(600)
check('palette navigates', page.url().includes('#/insights'))

// ── 5) Sidebar collapse persists; Atlas full screen syncs ────────────────
await page.getByRole('button', { name: /collapse sidebar/i }).click()
await page.reload()
await wait(1500)
check('collapsed sidebar is remembered after reload', (await page.evaluate(() => document.documentElement.dataset.sidebar)) === 'collapsed')
await page.getByRole('button', { name: /expand sidebar/i }).click()

await page.goto(base + '#/atlas')
await wait(2500)
if (await page.getByRole('dialog').first().isVisible().catch(() => false)) await page.keyboard.press('Escape')
await wait(400)
await page.getByRole('button', { name: /full-screen map/i }).click()
await wait(600)
const fs1 = await page.evaluate(() => ({ chrome: document.documentElement.dataset.chrome, fs: !!document.fullscreenElement }))
check('Atlas full screen hides the chrome', fs1.chrome === 'hidden', JSON.stringify(fs1))
await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null))
if (!fs1.fs) await page.keyboard.press('Escape')
await wait(500)
check('leaving full screen (browser exit / Escape) restores the chrome', (await page.evaluate(() => document.documentElement.dataset.chrome)) === undefined)
await page.getByRole('button', { name: /full-screen map/i }).click()
await wait(300)
await page.goto(base + '#/focus')
await wait(700)
check('leaving the Atlas ends its full screen', (await page.evaluate(() => document.documentElement.dataset.chrome)) === undefined)

// Immersive focus follows the browser's full screen too.
await page.getByRole('button', { name: /immersive mode/i }).click()
await wait(700)
const entered = await page.evaluate(() => !!document.fullscreenElement)
if (entered) {
  await page.evaluate(() => document.exitFullscreen())
  await wait(800)
  check('exiting full screen closes immersive mode', (await page.evaluate(() => document.documentElement.dataset.focus)) === undefined)
} else {
  // Immersive mode is the Focus screen with the app's chrome put away (<html data-focus="immersive" data-chrome="hidden">).
  check('immersive mode opened (full screen unavailable headless)', (await page.evaluate(() => document.documentElement.dataset.focus + '/' + document.documentElement.dataset.chrome)) === 'immersive/hidden')
  await page.keyboard.press('Escape')
  await wait(400)
  check('Escape leaves immersive mode', (await page.evaluate(() => document.documentElement.dataset.focus)) === undefined)
}

// The real runtime chooses a compatible countdown before mutating a stopwatch task.
const profileAction = await page.evaluate(async () => {
  const { db } = await import('/src/data/db.ts')
  const { create, remove } = await import('/src/data/repo.ts')
  const { blankTask } = await import('/src/planner/tasks.ts')
  const { executeProposal } = await import('/src/tars/runtime.ts')
  const { useTimer } = await import('/src/timer/store.ts')
  if (useTimer.getState().timer.status !== 'idle') await executeProposal('timer.stop', { discard: true })
  const before = JSON.stringify(useTimer.getState().timer)
  const invalid = await executeProposal('timer.start', { taskId: 'missing-task', minutes: 50 })
  const unchanged = before === JSON.stringify(useTimer.getState().timer)
  const stopwatch = (await db.profiles.toArray()).find(p => p.mode === 'stopwatch')
  const task = await create('tasks', blankTask({ title: 'Profile action fixture', profileId: stopwatch.id }))
  const result = await executeProposal('timer.start', { taskId: task.id, minutes: 50 })
  const timer = useTimer.getState().timer
  const valid = result.ok && timer.status === 'running' && timer.targetMs === 3000000 && timer.context.taskId === task.id
  await executeProposal('timer.stop', { discard: true })
  await remove('tasks', task.id)
  const event = await create('events', { title:'Unlinked block fixture', kind:'block', date:task.plannedFor ?? '2026-10-01', start:'09:00', end:'10:00', color:null, labelId:null, taskId:null, notes:'', location:'', reminderMinutes:null, recurrence:null })
  const blockResult = await executeProposal('calendar.startBlock', { eventId:event.id })
  const blockTimer = useTimer.getState().timer
  const cleared = blockResult.ok && blockTimer.status === 'running' && blockTimer.context.taskId === null && blockTimer.context.projectId === null && blockTimer.context.labelId === null
  await executeProposal('timer.stop', { discard:true })
  await remove('events', event.id)
  return { valid, invalid: !invalid.ok && unchanged, cleared }
})
check('invalid action references leave timer state unchanged', profileAction.invalid)
check('duration action safely overrides a task stopwatch profile', profileAction.valid)
check('an unlinked calendar block cannot inherit the previous task', profileAction.cleared)

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed ? 1 : 0)
