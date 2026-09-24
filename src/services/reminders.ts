/**
 * Reminders are derived from tasks (reminderAt), calendar events
 * (reminderMinutes before start) and habits (daily reminder time) rather than
 * stored separately, so they can never drift out of sync with what they remind
 * you about. A small delivery log prevents repeats.
 *
 * Native: the next 48h of reminders are handed to the OS scheduler.
 * Web: a light in-app check runs every 30s and on every wake.
 */
import { liveQuery } from 'dexie'
import { db } from '@/data/db'
import { isNative } from '@/lib/platform'
import { addDaysKey, atTime, dayKey, formatTimeOfDay, weekdayOf, HOUR } from '@/lib/time'
import { occurrencesBetween } from '@/planner/recurrence'
import { onWake } from './lifecycle'
import {
  REMINDER_NOTIFICATION_BASE,
  REMINDER_NOTIFICATION_SPAN,
  reminderNotificationId,
  replaceScheduled,
  showNotification,
} from './notifications'
import { toast } from '@/ui/toast'

export interface DueReminder {
  key: string
  at: number
  title: string
  body: string
  route: string
}

export async function collectReminders(from: number, to: number, use24h = false): Promise<DueReminder[]> {
  const out: DueReminder[] = []
  const tasks = await db.tasks.where('done').equals(0).toArray()
  for (const t of tasks) {
    if (t.reminderAt && t.reminderAt >= from && t.reminderAt <= to) {
      out.push({
        key: `task:${t.id}:${t.reminderAt}`,
        at: t.reminderAt,
        title: t.title,
        body: t.dueDate ? `Due ${t.dueDate}${t.dueTime ? ` at ${t.dueTime}` : ''}` : 'Task reminder',
        route: `#/tasks?task=${t.id}`,
      })
    }
  }

  const startDay = addDaysKey(dayKey(from), -1)
  const endDay = addDaysKey(dayKey(to), 1)
  const events = await db.events.toArray()
  for (const e of events) {
    if (e.reminderMinutes === null || e.reminderMinutes === undefined) continue
    const days = e.recurrence ? occurrencesBetween(e.recurrence, e.date, startDay, endDay) : e.date >= startDay && e.date <= endDay ? [e.date] : []
    for (const d of days) {
      const startMs = atTime(d, e.start ?? '09:00')
      const at = startMs - e.reminderMinutes * 60_000
      if (at < from || at > to) continue
      out.push({
        key: `event:${e.id}:${d}:${e.reminderMinutes}`,
        at,
        title: e.kind === 'block' ? `Focus block: ${e.title}` : e.title,
        body: e.start ? `Starts at ${formatTimeOfDay(startMs, use24h)}${e.location ? ` · ${e.location}` : ''}` : 'Today',
        route: e.kind === 'block' ? `#/focus?block=${e.id}&date=${d}` : `#/calendar?date=${d}`,
      })
    }
  }

  const habits = await db.habits.filter((h) => !h.archived && !!h.reminderTime).toArray()
  for (const h of habits) {
    for (let d = startDay; d <= endDay; d = addDaysKey(d, 1)) {
      if (h.weekdays.length && !h.weekdays.includes(weekdayOf(d))) continue
      const at = atTime(d, h.reminderTime!)
      if (at < from || at > to) continue
      const log = await db.habitLogs.get(`${h.id}:${d}`)
      if (log && log.value > 0) continue
      out.push({ key: `habit:${h.id}:${d}`, at, title: h.name, body: 'Keep your habit going today', route: '#/tasks?view=habits' })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

interface ReminderRuntime {
  notifications: boolean
  use24h: boolean
}
const runtime: ReminderRuntime = { notifications: true, use24h: false }
export function configureReminders(patch: Partial<ReminderRuntime>) {
  Object.assign(runtime, patch)
}

async function deliverDue(navigate: (route: string) => void) {
  const now = Date.now()
  // Only look back a few hours – we don't want a flood of stale reminders on first launch.
  const due = await collectReminders(now - 6 * HOUR, now, runtime.use24h)
  for (const r of due) {
    const already = await db.reminderLog.get(r.key)
    if (already) continue
    await db.reminderLog.put({ id: r.key, firedAt: now })
    toast({ title: r.title, body: r.body, duration: 8000, action: { label: 'Open', run: () => navigate(r.route) } })
    // Native reminders were scheduled with the OS and have already been shown.
    if (!isNative && runtime.notifications) void showNotification(r.title, r.body, { tag: r.key, route: r.route })
  }
  // Keep the log small.
  await db.reminderLog.where('firedAt').below(now - 14 * 24 * HOUR).delete()
}

async function scheduleNative() {
  if (!isNative) return
  const now = Date.now()
  const upcoming = runtime.notifications ? await collectReminders(now, now + 48 * HOUR, runtime.use24h) : []
  await replaceScheduled(
    REMINDER_NOTIFICATION_BASE,
    REMINDER_NOTIFICATION_SPAN,
    upcoming.map((r) => ({ id: reminderNotificationId(r.key), at: r.at, title: r.title, body: r.body, channel: 'reminders' as const, route: r.route })),
  )
}

let started = false

export function startReminders(navigate: (route: string) => void): () => void {
  if (started) return () => {}
  started = true
  const tick = () => void deliverDue(navigate).catch((e) => console.warn('[reminders]', e))
  tick()
  const interval = setInterval(tick, 30_000)
  const offWake = onWake(tick)

  let debounce: ReturnType<typeof setTimeout> | undefined
  const sub = liveQuery(() => Promise.all([db.tasks.count(), db.events.count(), db.habits.count(), db.tasks.orderBy('updatedAt').last(), db.events.orderBy('updatedAt').last(), db.habitLogs.count()])).subscribe({
    next: () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => void scheduleNative(), 800)
    },
  })

  return () => {
    started = false
    clearInterval(interval)
    offWake()
    sub.unsubscribe()
  }
}
