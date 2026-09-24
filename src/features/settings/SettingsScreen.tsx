import { ArrowLeft, Bell, Download, FileJson, FileSpreadsheet, HardDrive, Info, Play, Smartphone, Sparkles, Trash2, Upload } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { navigate } from '@/app/router'
import { useUi } from '@/app/ui-store'
import { CHIMES, playChime } from '@/audio/chimes'
import { unlockAudio } from '@/audio/context'
import { backupCounts, BackupError, createBackup, eraseEverything, parseBackup, restoreBackup, type BackupFile } from '@/data/backup'
import { importSessionsCsv, importTasksCsv, sessionsCsv, tasksCsv } from '@/data/csvio'
import { generateDemoData, hasDemoData, removeDemoData } from '@/data/demo'
import { db } from '@/data/db'
import { updateSettings, useProfiles, useSettings } from '@/data/hooks'
import { chooseBaseCamp } from '@/atlas/actions'
import { useAtlas } from '@/atlas/data'
import { useXp } from '@/atlas/useExploration'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { ensureSeed } from '@/data/seed'
import type { AtlasStyle, ThemePreference } from '@/data/types'
import { isNative, isStandalonePwa, platform } from '@/lib/platform'
import { pickTextFile, saveTextFile, stamp } from '@/services/files'
import { promptInstall, useInstall } from '@/services/install'
import { notificationPermission, requestNotificationPermission, showNotification } from '@/services/notifications'
import { Button, IconButton, Segmented, Select, Stepper, Toggle } from '@/ui/controls'
import { confirmDialog } from '@/ui/feedback'
import { Wordmark } from '@/ui/Logo'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { profileSummary } from '@/features/focus/ProfileSheet'
import { LabelsManager } from './LabelsManager'

function AtlasSettings() {
  const settings = useSettings()
  const atlas = useAtlas()
  const { level } = useXp()
  return (
    <Group title="Atlas">
      <Line label="Map style" hint="More styles unlock as your rank rises.">
        <Select compact value={settings.atlasStyle} onChange={(e) => void updateSettings({ atlasStyle: e.target.value as AtlasStyle })} aria-label="Map style">
          {MAP_STYLES.map((s) => (
            <option key={s.id} value={s.id} disabled={s.minRank > level.rankIndex}>
              {s.name}
              {s.minRank > level.rankIndex ? ` – ${RANKS[s.minRank].title}` : ''}
            </option>
          ))}
        </Select>
      </Line>
      <Line label="Base camp" hint="Starts explored; free survey spreads out from here.">
        <Select
          compact
          value={settings.baseCamp ?? ''}
          onChange={(e) => atlas && e.target.value && void chooseBaseCamp(atlas, e.target.value)}
          aria-label="Base camp"
          disabled={!atlas}
        >
          <option value="">Choose…</option>
          {atlas?.states
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
      </Line>
      <Line label="Questions during breaks" hint="Two quick recall questions on the break screen.">
        <Toggle label="Questions during breaks" checked={settings.breakReview} onChange={(v) => void updateSettings({ breakReview: v })} />
      </Line>
    </Group>
  )
}

export default function SettingsScreen() {
  const settings = useSettings()
  const profiles = useProfiles()
  const profile = profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0]
  const [perm, setPerm] = useState<string>('default')
  useEffect(() => {
    void notificationPermission().then(setPerm)
  }, [])

  return (
    <div className="pt-safe mx-auto w-full max-w-2xl px-4 pb-10 sm:px-6">
      <header className="flex items-center gap-2 pt-5 pb-4">
        <IconButton label="Back" className="lg:hidden" onClick={() => (history.length > 1 ? history.back() : navigate('#/focus'))}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <h1 className="font-display text-[32px] leading-tight font-medium tracking-tight">Settings</h1>
      </header>

      <Group title="Appearance">
        <Line label="Theme">
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
        </Line>
        <Line label="Week starts on">
          <Segmented<'1' | '0'>
            size="sm"
            value={String(settings.weekStartsOn) as '1' | '0'}
            onChange={(v) => void updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </Line>
        <Line label="24-hour clock">
          <Toggle label="24-hour clock" checked={settings.use24h} onChange={(v) => void updateSettings({ use24h: v })} />
        </Line>
      </Group>

      <Group title="Timer">
        <button type="button" onClick={() => useUi.getState().set({ profileOpen: true })} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60">
          <span>
            <span className="block text-[15px] font-semibold">Timer profiles</span>
            <span className="block text-[13px] text-ink-2">{profile ? `${profile.name} · ${profileSummary(profile)}` : '—'}</span>
          </span>
          <span className="text-sm font-bold text-accent">Edit</span>
        </button>
        <Line label="Keep screen awake" hint="While a timer is running.">
          <Toggle label="Keep screen awake" checked={settings.keepAwake} onChange={(v) => void updateSettings({ keepAwake: v })} />
        </Line>
        <Line label="Immersive mode on start" hint="Go full-screen when focus begins.">
          <Toggle label="Immersive mode on start" checked={settings.immersiveOnStart} onChange={(v) => void updateSettings({ immersiveOnStart: v })} />
        </Line>
        <Line label="Shortest session to keep" hint="Stopped sessions shorter than this aren’t recorded.">
          <Stepper label="Minimum minutes" value={Math.round(settings.minSessionSeconds / 60)} onChange={(v) => void updateSettings({ minSessionSeconds: v * 60 })} min={0} max={15} suffix="m" />
        </Line>
        <Line label="End sound">
          <div className="flex items-center gap-1">
            <Select compact value={settings.endSound} onChange={(e) => void updateSettings({ endSound: e.target.value })} aria-label="End sound">
              {CHIMES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <IconButton
              label="Preview sound"
              size="sm"
              onClick={() => {
                unlockAudio()
                playChime(settings.endSound, settings.endVolume, 'focusEnd')
              }}
            >
              <Play className="size-4" />
            </IconButton>
          </div>
        </Line>
        <Line label="Sound volume">
          <input type="range" min={0} max={1} step={0.05} value={settings.endVolume} onChange={(e) => void updateSettings({ endVolume: Number(e.target.value) })} aria-label="End sound volume" className="w-36" />
        </Line>
      </Group>

      <AtlasSettings />

      <Group title="Notifications & feel">
        <Line label="Notifications" hint={perm === 'denied' ? 'Blocked in system settings – allow notifications for Lodestar there.' : perm === 'unsupported' ? 'Not supported in this browser.' : 'Session endings and reminders.'}>
          <Toggle
            label="Notifications"
            checked={settings.notifications && perm === 'granted'}
            disabled={perm === 'denied' || perm === 'unsupported'}
            onChange={async (v) => {
              if (v && perm !== 'granted') {
                const ok = await requestNotificationPermission()
                setPerm(ok ? 'granted' : await notificationPermission())
                if (!ok) return
              }
              await updateSettings({ notifications: v })
            }}
          />
        </Line>
        {perm === 'granted' && (
          <div className="px-4 pb-3">
            <Button size="sm" icon={<Bell className="size-3.5" />} onClick={() => void showNotification('Lodestar', 'Notifications are working ✦', { tag: 'test' })}>
              Send a test
            </Button>
          </div>
        )}
        <Line label="Haptics" hint="Gentle vibrations on supported devices.">
          <Toggle label="Haptics" checked={settings.haptics} onChange={(v) => void updateSettings({ haptics: v })} />
        </Line>
      </Group>

      <Group title="Subjects & labels" hint="Organise loosely – Exam › Subject › Topic – or keep a flat list. Sessions roll up through the tree in Insights.">
        <LabelsManager />
      </Group>

      <DataGroup />

      <InstallGroup />

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Wordmark />
        <p className="max-w-sm text-xs leading-relaxed text-ink-3">
          Version {__APP_VERSION__} · Local-first: your data lives on this device and never leaves it unless you export it. Works offline.
        </p>
      </div>
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-ink-2 uppercase">{title}</h2>
      {hint && <p className="-mt-1 mb-2 px-1 text-[13px] text-ink-3">{hint}</p>}
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-soft">{children}</div>
    </section>
  )
}

function Line({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-[13px] leading-snug text-ink-2">{hint}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function ActionRow({ icon, title, body, onClick, danger }: { icon: ReactNode; title: string; body: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-ink-2'}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-danger' : ''}`}>{title}</span>
        <span className="block text-[13px] leading-snug text-ink-2">{body}</span>
      </span>
    </button>
  )
}

function DataGroup() {
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [counts, setCounts] = useState<{ sessions: number; tasks: number } | null>(null)
  const [demo, setDemo] = useState(false)
  const [storage, setStorage] = useState<string>('')

  const refresh = async () => {
    setCounts({ sessions: await db.sessions.count(), tasks: await db.tasks.count() })
    setDemo(await hasDemoData())
    try {
      const est = await navigator.storage?.estimate?.()
      const persisted = await navigator.storage?.persisted?.()
      if (est?.usage !== undefined) setStorage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used${persisted ? ' · protected from eviction' : ''}`)
    } catch {
      /* unsupported */
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  const exportJson = async () => {
    const backup = await createBackup()
    await saveTextFile(`lodestar-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json')
    toast({ title: 'Backup saved', body: 'Keep it somewhere safe – you can restore it on any device.', tone: 'success' })
  }

  const importJson = async () => {
    const file = await pickTextFile('application/json,.json')
    if (!file) return
    try {
      setPending(parseBackup(file.text))
    } catch (err) {
      toast({ title: 'Couldn’t read that backup', body: err instanceof BackupError ? err.message : 'The file may be damaged.', tone: 'warning' })
    }
  }

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    if (mode === 'replace' && !(await confirmDialog({ title: 'Replace everything?', body: 'All data on this device is replaced by the backup. This can’t be undone – export a backup first if unsure.', confirmLabel: 'Replace', danger: true }))) return
    const report = await restoreBackup(pending, mode)
    setPending(null)
    await ensureSeed()
    await refresh()
    toast({ title: 'Backup restored', body: mode === 'merge' ? `${report.inserted} added · ${report.updated} updated · ${report.skipped} already up to date` : `${report.inserted} records loaded`, tone: 'success' })
  }

  const importCsv = async (kind: 'sessions' | 'tasks') => {
    const file = await pickTextFile('text/csv,.csv')
    if (!file) return
    const r = kind === 'sessions' ? await importSessionsCsv(file.text) : await importTasksCsv(file.text)
    await refresh()
    toast({ title: `Imported ${r.imported} ${kind}`, body: r.skipped ? `${r.skipped} rows skipped (duplicates or missing fields).` : undefined, tone: r.imported ? 'success' : 'warning' })
  }

  const erase = async () => {
    if (!(await confirmDialog({ title: 'Erase all data?', body: 'Every session, task, label and setting on this device will be deleted. This can’t be undone.', confirmLabel: 'Erase everything', danger: true }))) return
    await eraseEverything()
    localStorage.removeItem('lodestar.timer.v1')
    location.reload()
  }

  return (
    <>
      <Group title="Your data" hint={counts ? `${counts.sessions} sessions · ${counts.tasks} tasks${storage ? ` · ${storage}` : ''}` : undefined}>
        <ActionRow icon={<FileJson className="size-4.5" />} title="Back up everything" body="A complete JSON backup of all your data." onClick={() => void exportJson()} />
        <ActionRow icon={<Upload className="size-4.5" />} title="Restore from backup" body="Merge a backup into this device, or replace it." onClick={() => void importJson()} />
        <ActionRow icon={<FileSpreadsheet className="size-4.5" />} title="Export sessions (CSV)" body="Every focus session – for spreadsheets." onClick={async () => void saveTextFile(`lodestar-sessions-${stamp()}.csv`, await sessionsCsv(), 'text/csv')} />
        <ActionRow icon={<Download className="size-4.5" />} title="Export tasks (CSV)" body="Tasks with projects, dates and checklists." onClick={async () => void saveTextFile(`lodestar-tasks-${stamp()}.csv`, await tasksCsv(), 'text/csv')} />
        <ActionRow icon={<Upload className="size-4.5" />} title="Import sessions (CSV)" body="Columns like date, start, minutes, subject, note." onClick={() => void importCsv('sessions')} />
        <ActionRow icon={<Upload className="size-4.5" />} title="Import tasks (CSV)" body="Columns like title, project, priority, due_date." onClick={() => void importCsv('tasks')} />
        {demo ? (
          <ActionRow
            icon={<Sparkles className="size-4.5" />}
            title="Remove sample data"
            body="Deletes only the sample records; your own data stays."
            onClick={async () => {
              await removeDemoData()
              await refresh()
              toast({ title: 'Sample data removed', tone: 'success' })
            }}
          />
        ) : (
          counts &&
          counts.sessions < 5 && (
            <ActionRow
              icon={<Sparkles className="size-4.5" />}
              title="Preview with sample data"
              body="Fill Insights and the Atlas with four months of example history. Removable any time."
              onClick={async () => {
                await generateDemoData()
                await refresh()
                toast({ title: 'Sample history added', body: 'Explore Insights and the Atlas. Remove it here when you’re done.', tone: 'success' })
              }}
            />
          )
        )}
        <ActionRow icon={<Trash2 className="size-4.5" />} title="Erase all data" body="Start completely fresh on this device." onClick={() => void erase()} danger />
      </Group>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Restore backup" size="sm">
        {pending && (
          <div className="space-y-4">
            <p className="text-[15px] text-ink-2">Backup from {new Date(pending.exportedAt).toLocaleString()}.</p>
            <ul className="grid grid-cols-2 gap-1 text-[13px] text-ink-2">
              {Object.entries(backupCounts(pending))
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>
                    <b className="text-ink">{n}</b> {k}
                  </li>
                ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Button variant="primary" block onClick={() => void restore('merge')}>
                Merge – keep the newest of each item
              </Button>
              <Button variant="danger" block onClick={() => void restore('replace')}>
                Replace everything on this device
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}

function InstallGroup() {
  const canPrompt = useInstall((s) => !!s.event)
  const installed = useInstall((s) => s.installed) || isStandalonePwa()
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <Group title="App">
      {isNative ? (
        <Line label={`Lodestar for ${platform === 'ios' ? 'iOS' : 'Android'}`} hint="Timer alerts are scheduled with the system, so they arrive even if the app is closed.">
          <Smartphone className="size-5 text-ink-3" />
        </Line>
      ) : installed ? (
        <Line label="Installed" hint="Running as an app. Long-press the icon for quick actions.">
          <HardDrive className="size-5 text-success" />
        </Line>
      ) : canPrompt ? (
        <ActionRow icon={<Download className="size-4.5" />} title="Install Lodestar" body="Add it to your home screen or dock. Works fully offline." onClick={() => void promptInstall()} />
      ) : (
        <Line label="Install as an app" hint={ios ? 'In Safari, tap Share → Add to Home Screen.' : 'Use your browser’s “Install app” or “Add to Home screen” option.'}>
          <Info className="size-5 text-ink-3" />
        </Line>
      )}
    </Group>
  )
}
