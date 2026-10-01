/** Dev-server audit of stale asynchronous actions, cross-tab writes and midnight/wake projections. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch, prepare } from './lib.mjs'
const base = process.argv[2] ?? 'http://localhost:5173/'
const checks = [], errors = []
const ok = (name, value) => { checks.push({ name, ok: !!value }); console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); assert(value, name) }
const { browser, ctx, page } = await launch({ touch: true })
page.on('pageerror', e => errors.push(e.message))
try {
  await prepare(page, base, { sample: false, route: '#/focus' })
  const result = await page.evaluate(async () => {
    const { db } = await import('/src/data/db.ts')
    const { create } = await import('/src/data/repo.ts')
    const { addTask } = await import('/src/planner/tasks.ts')
    const { executeProposal } = await import('/src/tars/runtime.ts')
    const { useTimer } = await import('/src/timer/store.ts')
    const label = (await db.labels.toArray())[0]
    useTimer.getState().setContext({ labelId: label.id, note: 'Previous intention' })
    const task = await addTask({ title: 'Independent task' })
    const start = await executeProposal('timer.start', { taskId: task.id })
    const context = useTimer.getState().timer.context
    await executeProposal('timer.stop', { discard: true })
    useTimer.getState().setContext({ labelId: label.id, taskId: task.id, note: 'Previous block intention' })
    const block = await create('events', { title: 'Unlinked block', kind: 'block', date: '2026-10-01', start: '12:00', end: '12:25', labelId: null, taskId: null, recurrence: null, notes: '', location: '', color: null, reminderMinutes: null })
    const blockStart = await executeProposal('calendar.startBlock', { eventId: block.id })
    const blockContext = useTimer.getState().timer.context
    await executeProposal('timer.stop', { discard: true })
    const before = { tasks: await db.tasks.count(), runs: await db.expeditions.count(), context: useTimer.getState().timer.context }
    const invalid = await Promise.all([
      executeProposal('timer.start', { taskId: 'absent' }), executeProposal('timer.start', { labelId: 'absent' }),
      executeProposal('task.complete', { taskId: 'absent' }), executeProposal('atlas.startExpedition', { expeditionId: 'absent' }),
      executeProposal('atlas.openPlace', { placeId: 'absent' }), executeProposal('pyq.open', { questionId: 'absent' }),
    ])
    const after = { tasks: await db.tasks.count(), runs: await db.expeditions.count(), context: useTimer.getState().timer.context }
    // Hold the real profile read while another UI interaction changes the timer.
    const profile = (await db.profiles.toArray())[0]
    const delayed = await addTask({ title: 'Delayed action', profileId: profile.id })
    const get = db.profiles.get.bind(db.profiles)
    db.profiles.get = async id => {
      await new Promise(resolve => { window.__releaseAction = resolve })
      return get(id)
    }
    window.__staleAction = executeProposal('timer.start', { taskId: delayed.id }).finally(() => { db.profiles.get = get })
    return { start, context, blockStart, blockContext, invalid, unchanged: JSON.stringify(before) === JSON.stringify(after) }
  })
  ok('new task clears previous subject and intention', result.start.ok && result.context.labelId === null && result.context.note === '')
  ok('unlinked calendar block clears previous task/subject/intention', result.blockStart.ok && !result.blockContext.taskId && !result.blockContext.labelId && result.blockContext.note === '')
  ok('invalid identities fail without mutation', result.invalid.every(r => !r.ok) && result.unchanged)
  await page.waitForFunction(() => !!window.__releaseAction)
  const stale = await page.evaluate(async () => {
    const { useTimer } = await import('/src/timer/store.ts')
    useTimer.getState().setContext({ note: 'Changed while waiting' })
    window.__releaseAction()
    const result = await window.__staleAction
    return { result, timer: useTimer.getState().timer }
  })
  ok('stale async start does not overwrite a newer idle timer', !stale.result.ok && stale.timer.status === 'idle' && stale.timer.context.note === 'Changed while waiting')
  const taskId = await page.evaluate(async () => {
    const { addTask } = await import('/src/planner/tasks.ts')
    return (await addTask({ title: 'Cross-tab repeat', recurrence: { freq: 'daily', interval: 1 } })).id
  })
  const other = await ctx.newPage()
  other.on('pageerror', e => errors.push(e.message))
  await other.goto(base + '#/focus')
  await other.getByRole('button', { name: 'Ask Tars', exact: true }).waitFor()
  const complete = (tab, id) => tab.evaluate(async id => {
    const { db } = await import('/src/data/db.ts')
    const { completeTask } = await import('/src/planner/tasks.ts')
    return completeTask(await db.tasks.get(id))
  }, id)
  const completions = await Promise.all([complete(page, taskId), complete(other, taskId)])
  ok('two tabs create one recurring successor', completions.filter(Boolean).length === 1)
  await other.close()
  await page.goto(base + '#/focus')
  await page.getByRole('button', { name: 'Ask Tars', exact: true }).waitFor()
  await page.waitForTimeout(400)
  const immediate = await page.evaluate(async () => {
    const { currentContext } = await import('/src/tars/useContext.ts')
    const { useTimer } = await import('/src/timer/store.ts')
    const { useTarsSelection } = await import('/src/tars/selection.ts')
    const { db } = await import('/src/data/db.ts')
    const task = (await db.tasks.toArray()).find(t => t.title === 'Independent task')
    useTimer.getState().setContext({ taskId: task.id })
    useTarsSelection.getState().set('in.pass.nathu-la', null)
    location.hash = '#/atlas'
    const atlas = currentContext()
    location.hash = '#/focus'
    const focus = currentContext()
    return { task: atlas.currentTask?.id === task.id, selection: atlas.selectedPlace, cleared: focus.selectedPlace === null && focus.route === 'focus' }
  })
  ok('imperative context immediately uses the new task', immediate.task)
  ok('imperative context clears Atlas selection on an immediate route change', immediate.selection === 'in.pass.nathu-la' && immediate.cleared)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Ask Tars', exact: true }).focus()
  await page.keyboard.press('Enter')
  const input = page.getByRole('combobox', { name: 'Search and commands' })
  await input.waitFor()
  ok('palette has a labelled, focused combobox', await input.evaluate(el => el === document.activeElement))
  for (const query of ['Start focus tomorrow', 'Open Atlantis', 'Pause Atlas']) {
    await input.fill(query)
    await page.waitForTimeout(200)
    ok('unsupported control is not captured: ' + query, await page.getByRole('option', { name: /^Add task/ }).count() === 0)
  }
  await input.fill('Open Chandrabhaga')
  await page.getByRole('option').first().waitFor()
  const beforeAmbiguous = page.url()
  await input.press('Enter')
  await page.waitForTimeout(200)
  ok('ambiguous real place alias does not run the first result on Enter', page.url() === beforeAmbiguous && await input.isVisible() && await page.getByRole('option', { selected: true }).count() === 0)
  await input.press('ArrowDown')
  ok('ambiguous place remains explicitly keyboard-selectable', await page.getByRole('option', { selected: true }).count() === 1)
  await page.keyboard.press('Tab')
  ok('palette traps keyboard focus', await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')))
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Search and commands', exact: true }).waitFor({ state: 'detached' })
  ok('Escape restores the command trigger focus', await page.getByRole('button', { name: 'Ask Tars', exact: true }).evaluate(el => el === document.activeElement))
  await page.goto(base + '#/atlas?place=in.pass.nathu-la')
  await page.getByRole('button', { name: 'Test me', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Test me', exact: true }).click()
  const review = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Close review', exact: true }) })
  await review.locator('h3').waitFor()
  await page.evaluate(async () => {
    const { db } = await import('/src/data/db.ts')
    window.__recallsBefore = await db.recalls.count()
    window.__failRecall = () => { throw new Error('Injected storage failure') }
    db.recalls.hook('creating', window.__failRecall)
  })
  const answerReview = async () => {
    const order = review.getByRole('button', { name: 'Check order', exact: true })
    if (await order.count()) {
      const choices = review.locator('fieldset button').filter({ hasNotText: /^(?:Reset|Check order)$/ })
      while (await choices.count()) await choices.first().click()
      await order.click()
    } else await review.locator('fieldset > div').last().getByRole('button').first().evaluate(el => { el.click(); el.click() })
  }
  await answerReview()
  await review.getByRole('alert').waitFor()
  ok('failed Field Review persistence does not reveal success', await review.getByText(/^(?:Correct|Not quite)$/).count() === 0)
  await page.evaluate(async () => { const { db } = await import('/src/data/db.ts'); db.recalls.hook('creating').unsubscribe(window.__failRecall) })
  await answerReview()
  await review.getByText(/^(?:Correct|Not quite)$/).waitFor()
  ok('Field Review retries once and suppresses duplicate input', await page.evaluate(async () => (await import('/src/data/db.ts')).db.recalls.count().then(n => n === window.__recallsBefore + 1)))
  await page.keyboard.press('Escape')
  await review.waitFor({ state: 'detached' })
  await page.clock.install()
  await page.clock.setSystemTime(new Date('2026-10-01T23:59:00'))
  await page.evaluate(async () => {
    const { create } = await import('/src/data/repo.ts')
    const { db } = await import('/src/data/db.ts')
    await db.recalls.clear()
    await create('recalls', { placeId: 'in.pass.nathu-la', type: 'fact', correct: 1, at: Date.now(), date: '2026-10-01', source: 'card' })
    dispatchEvent(new Event('focus'))
  })
  await page.goto(base + '#/atlas')
  await page.getByRole('application').waitFor()
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('new recall is not due before midnight', await page.getByRole('button', { name: 'Review', exact: true }).isDisabled())
  await page.clock.setSystemTime(new Date('2026-10-01T23:59:58'))
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.clock.runFor(3500)
  await page.clock.resume()
  await page.getByRole('button', { name: 'Review · 1', exact: true }).waitFor()
  ok('Atlas review queue refreshes at midnight without a DB write', await page.getByRole('button', { name: 'Review · 1', exact: true }).isEnabled())
  await page.clock.setSystemTime(new Date('2026-10-03T09:00:00'))
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.waitForTimeout(200)
  const day = await page.evaluate(async () => (await import('/src/tars/useContext.ts')).currentContext().today)
  ok('Tars context uses the same resumed local day', day === '2026-10-03')
  await page.clock.setSystemTime(new Date('2026-10-03T23:59:00'))
  await page.evaluate(async () => {
    const { addTask } = await import('/src/planner/tasks.ts')
    await addTask({ title: 'Midnight planning fixture', plannedFor: '2026-10-04' })
    dispatchEvent(new Event('focus'))
  })
  await page.goto(base + '#/tasks?view=today')
  await page.getByRole('textbox', { name: /new task/i }).waitFor()
  ok('tomorrow task stays out of Today before midnight', await page.getByText('Midnight planning fixture', { exact: true }).count() === 0)
  await page.clock.setSystemTime(new Date('2026-10-03T23:59:58'))
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.clock.runFor(3500)
  await page.clock.resume()
  await page.getByText('Midnight planning fixture', { exact: true }).waitFor()
  ok('Today planning refreshes at midnight without a task write', true)
  ok('no browser errors', errors.length === 0)
  mkdirSync(new URL('./out/job4/', import.meta.url), { recursive: true })
  writeFileSync(new URL('./out/job4/actions-results.json', import.meta.url), JSON.stringify({ checks, errors }, null, 2))
} finally { await browser.close() }
