/**
 * Notifications across platforms.
 *
 * - Native (Capacitor): phase ends and reminders are *scheduled ahead of time*
 *   with the OS, so they fire on time even if the WebView is suspended or killed.
 * - Web/PWA: notifications are shown by the page (via the service worker
 *   registration so they work on Android Chrome). Browsers offer no way to
 *   schedule a local notification in advance, so on the web they fire when the
 *   page next gets CPU time – immediately in most desktop browsers.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from '@/lib/platform'
import { hashString } from '@/lib/random'

export type Channel = 'timer' | 'reminders'

export interface ScheduledNotification {
  id: number
  at: number
  title: string
  body: string
  channel: Channel
  /** Route to open when tapped, e.g. `#/focus`. */
  route?: string
}

let channelsReady = false
let actionHandler: ((route: string) => void) | null = null

async function ensureChannels() {
  if (!isNative || channelsReady) return
  channelsReady = true
  try {
    await LocalNotifications.createChannel({
      id: 'timer',
      name: 'Focus timer',
      description: 'Focus and break endings',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
    await LocalNotifications.createChannel({
      id: 'reminders',
      name: 'Reminders',
      description: 'Task, event and habit reminders',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* iOS has no channels */
  }
}

export function onNotificationTap(handler: (route: string) => void) {
  actionHandler = handler
  if (isNative) {
    void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const route = (event.notification.extra as { route?: string } | undefined)?.route
      if (route) actionHandler?.(route)
    })
  }
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (isNative) {
    try {
      const p = await LocalNotifications.checkPermissions()
      return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default'
    } catch {
      return 'unsupported'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    try {
      const p = await LocalNotifications.requestPermissions()
      await ensureChannels()
      return p.display === 'granted'
    } catch {
      return false
    }
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/** Show a notification right now. */
export async function showNotification(title: string, body: string, opts: { tag?: string; route?: string; channel?: Channel } = {}) {
  if (isNative) {
    await ensureChannels()
    const id = Math.abs(hashString(`${opts.tag ?? title}:${Date.now()}`)) % 1_000_000_000
    await LocalNotifications.schedule({
      notifications: [{ id, title, body, channelId: opts.channel ?? 'reminders', extra: { route: opts.route } }],
    }).catch(() => {})
    return
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag: opts.tag,
    renotify: !!opts.tag,
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/badge-96.png`,
    data: { route: opts.route },
    vibrate: [180, 90, 180],
  }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) await reg.showNotification(title, options)
    else {
      const n = new Notification(title, options)
      n.onclick = () => {
        window.focus()
        if (opts.route) actionHandler?.(opts.route)
        n.close()
      }
    }
  } catch {
    /* some browsers throw when called outside a gesture */
  }
}

/** Replace every pending native notification on `channel` whose id falls in [base, base+span). */
export async function replaceScheduled(base: number, span: number, items: ScheduledNotification[]) {
  if (!isNative) return
  await ensureChannels()
  try {
    const pending = await LocalNotifications.getPending()
    const stale = pending.notifications.filter((n) => n.id >= base && n.id < base + span).map((n) => ({ id: n.id }))
    if (stale.length) await LocalNotifications.cancel({ notifications: stale })
    const now = Date.now()
    const future = items.filter((n) => n.at > now + 500)
    if (!future.length) return
    await LocalNotifications.schedule({
      notifications: future.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        channelId: n.channel,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: { route: n.route },
      })),
    })
  } catch (err) {
    console.warn('[notifications] schedule failed', err)
  }
}

export const TIMER_NOTIFICATION_BASE = 7_000
export const TIMER_NOTIFICATION_SPAN = 100
export const REMINDER_NOTIFICATION_BASE = 1_000_000
export const REMINDER_NOTIFICATION_SPAN = 900_000_000

export function reminderNotificationId(key: string): number {
  return REMINDER_NOTIFICATION_BASE + (hashString(key) % (REMINDER_NOTIFICATION_SPAN - 1))
}
