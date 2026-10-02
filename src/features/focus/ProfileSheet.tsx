import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '@/data/db'
import { updateSettings, useProfiles, useSettings } from '@/data/hooks'
import { create, nextOrder, patch, remove, restore } from '@/data/repo'
import type { TimerMode, TimerProfile } from '@/data/types'
import { cn } from '@/lib/cn'
import { Button, Field, IconButton, Segmented, Stepper, TextInput, Toggle } from '@/ui/controls'
import { Sheet, SheetActions, SheetFooter } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { useUi } from '@/app/ui-store'
import { useTimer } from '@/timer/store'
import { MODES, rememberProfile, switchMode } from './mode'
import { profileSummary } from './profileSummary'


const QUICK: Array<{ label: string; focus: number; rest: number; long: number }> = [
  { label: '25 / 5', focus: 25, rest: 5, long: 15 },
  { label: '50 / 10', focus: 50, rest: 10, long: 20 },
  { label: '90 / 20', focus: 90, rest: 20, long: 30 },
]

export function ProfileSheet() {
  const open = useUi((s) => s.profileOpen)
  const close = () => useUi.getState().set({ profileOpen: false })
  const profiles = useProfiles()
  const settings = useSettings()
  const [editing, setEditing] = useState<TimerProfile | 'new' | null>(null)
  const running = useTimer((s) => s.timer.status !== 'idle')
  const mode = useTimer((s) => s.timer.config.mode)
  const active = profiles.find((p) => p.id === settings.activeProfileId)
  useEffect(() => {
    if (active) rememberProfile(active)
  }, [active])

  useEffect(() => {
    if (!open) setEditing(null)
  }, [open])

  const select = async (id: string) => {
    await updateSettings({ activeProfileId: id })
    close()
  }

  const quick = async (q: (typeof QUICK)[number]) => {
    const match = profiles.find((p) => p.mode === 'pomodoro' && p.focusMinutes === q.focus && p.shortBreakMinutes === q.rest)
    if (match) return select(match.id)
    const p = await create('profiles', {
      name: `${q.focus} / ${q.rest}`,
      mode: 'pomodoro',
      focusMinutes: q.focus,
      shortBreakMinutes: q.rest,
      longBreakMinutes: q.long,
      longBreakEvery: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      order: await nextOrder('profiles'),
    })
    await select(p.id)
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? (editing === 'new' ? 'New timer profile' : 'Edit profile') : 'Timer profiles'}
      subtitle={!editing && running ? 'Changes apply from the next phase.' : undefined}
    >
      {editing ? (
        <ProfileEditor
          profile={editing === 'new' ? null : editing}
          canDelete={profiles.length > 1}
          onDone={async (saved) => {
            setEditing(null)
            if (saved) await updateSettings({ activeProfileId: saved })
          }}
        />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="t-label mb-2">Mode</p>
            <Segmented<TimerMode> size="sm" layoutId="mode-tabs" label="Timer mode" value={mode} onChange={(m) => void switchMode(m, profiles)} options={MODES} />
          </div>
          <div className="flex gap-2">
            {QUICK.map((q) => (
              <button key={q.label} type="button" onClick={() => void quick(q)} className="tabular flex-1 rounded-2xl border border-line bg-surface-2 py-3 text-center text-sm font-bold hover:border-line-strong">
                {q.label}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {profiles.map((p) => {
              const active = p.id === (settings.activeProfileId ?? profiles[0]?.id)
              return (
                <li key={p.id} className="flex items-center">
                  <button type="button" onClick={() => void select(p.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border', active ? 'border-transparent bg-accent text-accent-ink' : 'border-line-strong')}>
                      {active && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="block truncate text-[13px] text-ink-2">{profileSummary(p)}</span>
                    </span>
                  </button>
                  <button type="button" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)} className="mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink">
                    <Pencil className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
          <Button block icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            New profile
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function ProfileEditor({ profile, canDelete, onDone }: { profile: TimerProfile | null; canDelete: boolean; onDone: (savedId: string | null) => void }) {
  const [name, setName] = useState(profile?.name ?? 'My rhythm')
  const [mode, setMode] = useState<TimerMode>(profile?.mode ?? 'pomodoro')
  const [focus, setFocus] = useState(profile?.focusMinutes || 30)
  const [short, setShort] = useState(profile?.shortBreakMinutes ?? 5)
  const [long, setLong] = useState(profile?.longBreakMinutes ?? 15)
  const [every, setEvery] = useState(profile?.longBreakEvery ?? 4)
  const [autoBreaks, setAutoBreaks] = useState(profile?.autoStartBreaks ?? true)
  const [autoFocus, setAutoFocus] = useState(profile?.autoStartFocus ?? false)

  const save = async () => {
    const data = {
      name: name.trim() || 'Untitled',
      mode,
      focusMinutes: mode === 'stopwatch' ? 0 : focus,
      shortBreakMinutes: short,
      longBreakMinutes: long,
      longBreakEvery: mode === 'pomodoro' ? every : 0,
      autoStartBreaks: autoBreaks,
      autoStartFocus: autoFocus,
    }
    if (profile) {
      await patch('profiles', profile.id, data)
      onDone(profile.id)
    } else {
      const p = await create('profiles', { ...data, order: await nextOrder('profiles') })
      onDone(p.id)
    }
  }

  const del = async () => {
    if (!profile) return
    const wasActive = (await db.settings.get('settings'))?.activeProfileId === profile.id
    await remove('profiles', profile.id)
    if (wasActive) {
      const first = await db.profiles.orderBy('order').first()
      await updateSettings({ activeProfileId: first?.id ?? null })
    }
    onDone(null)
    // Sessions recorded with it are kept either way; Undo brings the profile back as it was.
    toast({
      title: 'Profile deleted',
      body: profile.name,
      action: {
        label: 'Undo',
        run: async () => {
          await restore('profiles', profile)
          if (wasActive) await updateSettings({ activeProfileId: profile.id })
        },
      },
    })
  }

  return (
    <div className="space-y-5">
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
      </Field>
      <Field label="Mode">
        <Segmented
          className="w-full"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'pomodoro', label: 'Cycles' },
            { value: 'countdown', label: 'Countdown' },
            { value: 'stopwatch', label: 'Open focus' },
          ]}
        />
      </Field>
      <div className="space-y-3 rounded-2xl border border-line p-4">
        {mode !== 'stopwatch' && <SettingLine label={mode === 'countdown' ? 'Length' : 'Focus'}><Stepper label="Focus minutes" value={focus} onChange={setFocus} min={1} max={240} step={5} suffix="m" /></SettingLine>}
        {mode !== 'countdown' && <SettingLine label={mode === 'stopwatch' ? 'Min. break' : 'Short break'}><Stepper label="Short break minutes" value={short} onChange={setShort} min={1} max={60} suffix="m" /></SettingLine>}
        {mode === 'pomodoro' && (
          <>
            <SettingLine label="Long break"><Stepper label="Long break minutes" value={long} onChange={setLong} min={1} max={90} step={5} suffix="m" /></SettingLine>
            <SettingLine label="Long break every"><Stepper label="Sessions before long break" value={every} onChange={setEvery} min={0} max={12} /></SettingLine>
            <SettingLine label="Auto-start breaks"><Toggle label="Auto-start breaks" checked={autoBreaks} onChange={setAutoBreaks} /></SettingLine>
            <SettingLine label="Auto-start next focus"><Toggle label="Auto-start focus" checked={autoFocus} onChange={setAutoFocus} /></SettingLine>
          </>
        )}
      </div>
      <SheetFooter>
        <SheetActions
          start={
            profile &&
            canDelete && (
              <IconButton label={`Delete ${profile.name}`} onClick={() => void del()} className="text-danger hover:bg-danger/10 hover:text-danger">
                <Trash2 className="size-4.5" />
              </IconButton>
            )
          }
        >
          <Button onClick={() => onDone(null)}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </SheetActions>
      </SheetFooter>
    </div>
  )
}

function SettingLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </div>
  )
}
