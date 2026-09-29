import { describe, expect, it } from 'vitest'
import { describeRule, nextOccurrence, occurrencesBetween, occursOn } from './recurrence'
import { inferSubject, parseQuickAdd } from './quickAdd'
import { isInbox, isOverdue, isToday, isUpcoming, blankTask, groupUpcoming } from './tasks'
import type { Task } from '@/data/types'

// 2026-09-24 is a Thursday.
const TODAY = '2026-09-24'

describe('recurrence', () => {
  it('daily with interval', () => {
    const rule = { freq: 'daily' as const, interval: 2 }
    expect(occursOn(rule, '2026-09-01', '2026-09-03')).toBe(true)
    expect(occursOn(rule, '2026-09-01', '2026-09-04')).toBe(false)
    expect(nextOccurrence(rule, '2026-09-01', '2026-09-01')).toBe('2026-09-03')
  })

  it('weekly on specific weekdays', () => {
    const rule = { freq: 'weekly' as const, interval: 1, weekdays: [1, 3] } // Mon, Wed
    expect(occurrencesBetween(rule, '2026-09-21', '2026-09-21', '2026-10-04')).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-28',
      '2026-09-30',
    ])
  })

  it('every other week', () => {
    const rule = { freq: 'weekly' as const, interval: 2 }
    expect(nextOccurrence(rule, '2026-09-24', '2026-09-24')).toBe('2026-10-08')
  })

  it('monthly on the 31st falls back to month end', () => {
    const rule = { freq: 'monthly' as const, interval: 1 }
    expect(nextOccurrence(rule, '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence(rule, '2026-01-31', '2026-02-28')).toBe('2026-03-31')
  })

  it('respects until', () => {
    const rule = { freq: 'daily' as const, interval: 1, until: '2026-09-25' }
    expect(nextOccurrence(rule, TODAY, '2026-09-25')).toBeNull()
  })

  it('describes rules', () => {
    expect(describeRule({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] })).toBe('Every weekday')
    expect(describeRule({ freq: 'monthly', interval: 1 }, '2026-09-03')).toBe('Every month on the 3rd')
  })
})

describe('quick add', () => {
  it('extracts metadata and leaves a clean title', () => {
    const r = parseQuickAdd('Essay draft tomorrow !high +History @Essays #exam ~3', TODAY)
    expect(r.title).toBe('Essay draft')
    expect(r.plannedFor).toBe('2026-09-25')
    expect(r.priority).toBe(3)
    expect(r.projectName).toBe('History')
    expect(r.labelName).toBe('Essays')
    expect(r.tags).toEqual(['exam'])
    expect(r.estimate).toBe(3)
  })

  it('reads the example from the brief: date, time and a tag', () => {
    const r = parseQuickAdd('Physics revision tomorrow 5pm #important', TODAY)
    expect(r.title).toBe('Physics revision')
    expect(r.plannedFor).toBe('2026-09-25')
    expect(r.dueDate).toBe('2026-09-25')
    expect(r.dueTime).toBe('17:00')
    expect(r.tags).toEqual(['important'])
  })

  it('collects several tags once each', () => {
    expect(parseQuickAdd('Read #ch4 #Revision #revision', TODAY).tags).toEqual(['ch4', 'Revision'])
  })

  it('turns a time estimate into sessions of the current length', () => {
    expect(parseQuickAdd('Past paper ~1h30m', TODAY, { sessionMinutes: 45 })).toMatchObject({ title: 'Past paper', estimate: 2, estimateMinutes: 90 })
    expect(parseQuickAdd('Notes ~45m', TODAY)).toMatchObject({ estimate: 2, estimateMinutes: 45 })
    expect(parseQuickAdd('Essay ~1.5h', TODAY, { sessionMinutes: 50 })).toMatchObject({ estimate: 2, estimateMinutes: 90 })
    expect(parseQuickAdd('Flashcards ~2', TODAY)).toMatchObject({ estimate: 2 })
    expect(parseQuickAdd('Costs ~about', TODAY).title).toBe('Costs ~about')
  })

  it('distinguishes do-dates from deadlines and times', () => {
    const r = parseQuickAdd('Lab report fri due mon at 5pm', TODAY)
    expect(r.title).toBe('Lab report')
    expect(r.plannedFor).toBe('2026-09-25')
    expect(r.dueDate).toBe('2026-09-28')
    expect(r.dueTime).toBe('17:00')
  })

  it('parses repeats and anchors them', () => {
    const r = parseQuickAdd('Flashcards every mon and wed', TODAY)
    expect(r.title).toBe('Flashcards')
    expect(r.recurrence).toEqual({ freq: 'weekly', interval: 1, weekdays: [1, 3] })
    expect(r.plannedFor).toBe('2026-09-28')
  })

  it('infers the subject a title names', () => {
    const labels = [
      { id: 'p', name: 'Physics', archived: false },
      { id: 'c', name: 'Chemistry', archived: false },
      { id: 'oc', name: 'Organic Chemistry', archived: false },
      { id: 'x', name: 'Old', archived: true },
    ]
    expect(inferSubject('Physics revision', labels)?.id).toBe('p')
    expect(inferSubject('organic chemistry: alkenes', labels)?.id).toBe('oc')
    expect(inferSubject('Physical exercise', labels)).toBeUndefined()
    expect(inferSubject('Physics and Chemistry mock', labels)).toBeUndefined()
    expect(inferSubject('Old notes', labels)).toBeUndefined()
  })

  it('does not treat a leading weekday as a date', () => {
    expect(parseQuickAdd('Monday seminar prep', TODAY).title).toBe('Monday seminar prep')
  })

  it('parses month names and next weekday', () => {
    expect(parseQuickAdd('Exam oct 3', TODAY).plannedFor).toBe('2026-10-03')
    expect(parseQuickAdd('Call next tue', TODAY).plannedFor).toBe('2026-09-29')
    expect(parseQuickAdd('Revise in 3 days', TODAY).plannedFor).toBe('2026-09-27')
  })
})

describe('task selectors', () => {
  const t = (p: Partial<Task>): Task => ({ ...blankTask(p), id: Math.random().toString(), createdAt: 0, updatedAt: 0 })

  it('classifies tasks into today, overdue, upcoming and inbox', () => {
    expect(isToday(t({ plannedFor: TODAY }), TODAY)).toBe(true)
    expect(isToday(t({ dueDate: TODAY }), TODAY)).toBe(true)
    expect(isOverdue(t({ dueDate: '2026-09-20' }), TODAY)).toBe(true)
    expect(isOverdue(t({ plannedFor: '2026-09-20' }), TODAY)).toBe(true)
    // Planned in the past but the deadline is still ahead → not overdue, just rolled over.
    expect(isOverdue(t({ plannedFor: '2026-09-20', dueDate: '2026-09-30' }), TODAY)).toBe(false)
    expect(isUpcoming(t({ plannedFor: '2026-09-26' }), TODAY)).toBe(true)
    expect(isInbox(t({}))).toBe(true)
    expect(isInbox(t({ projectId: 'p' }))).toBe(false)
    expect(isOverdue(t({ dueDate: '2026-09-20', done: 1 }), TODAY)).toBe(false)
  })

  it('groups upcoming by day', () => {
    const groups = groupUpcoming([t({ plannedFor: '2026-09-27' }), t({ dueDate: '2026-09-26' }), t({ plannedFor: '2026-09-27' })], TODAY)
    expect(groups.map((g) => [g.day, g.tasks.length])).toEqual([
      ['2026-09-26', 1],
      ['2026-09-27', 2],
    ])
  })
})
