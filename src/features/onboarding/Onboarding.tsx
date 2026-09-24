import { motion } from 'motion/react'
import { Bell, CalendarCheck2, ChartNoAxesColumn, Sparkles, Timer } from 'lucide-react'
import { useState } from 'react'
import { updateSettings, useSettings } from '@/data/hooks'
import type { ThemePreference } from '@/data/types'
import { requestNotificationPermission } from '@/services/notifications'
import { Button, Segmented } from '@/ui/controls'
import { LogoMark } from '@/ui/Logo'
import { Sheet } from '@/ui/Sheet'

const LOOP = [
  { icon: CalendarCheck2, title: 'Plan', body: 'Capture tasks, estimate sessions, time-block your day.' },
  { icon: Timer, title: 'Focus', body: 'A timer that survives sleep, reloads and app switches.' },
  { icon: ChartNoAxesColumn, title: 'Track & review', body: 'Every session is logged against a subject or task.' },
  { icon: Sparkles, title: 'Improve', body: 'Each session adds a star to your sky. Watch it fill.' },
]

export function Onboarding() {
  const settings = useSettings()
  const [notif, setNotif] = useState<'idle' | 'granted' | 'denied'>('idle')
  const open = settings.updatedAt > 0 && !settings.onboarded
  const finish = () => void updateSettings({ onboarded: true })

  return (
    <Sheet open={open} onClose={finish} size="md" bare>
      <div className="px-6 pt-6 pb-6 sm:px-8 sm:pt-10">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent-soft">
          <LogoMark className="size-8 text-accent" />
        </motion.div>
        <h2 className="font-display text-[30px] leading-tight font-medium tracking-tight">Welcome to Lodestar</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">A calm place to plan your study, focus deeply, and see your effort add up. Everything stays on this device and works offline.</p>

        <ol className="mt-6 space-y-3">
          {LOOP.map(({ icon: Icon, title, body }, i) => (
            <motion.li key={title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <Icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{title}</span>
                <span className="block text-[13px] text-ink-2">{body}</span>
              </span>
            </motion.li>
          ))}
        </ol>

        <div className="mt-7 space-y-3 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Appearance</span>
            <Segmented<ThemePreference>
              size="sm"
              value={settings.theme}
              onChange={(v) => void updateSettings({ theme: v })}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Paper' },
                { value: 'dark', label: 'Night' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold">Notifications</span>
              <span className="block text-xs text-ink-2">For session ends and reminders.</span>
            </span>
            <Button
              size="sm"
              icon={<Bell className="size-3.5" />}
              disabled={notif !== 'idle'}
              onClick={async () => setNotif((await requestNotificationPermission()) ? 'granted' : 'denied')}
            >
              {notif === 'granted' ? 'Enabled' : notif === 'denied' ? 'Not allowed' : 'Enable'}
            </Button>
          </div>
        </div>

        <Button block size="lg" variant="primary" className="mt-6" onClick={finish}>
          Begin
        </Button>
      </div>
    </Sheet>
  )
}
