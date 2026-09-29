import {
  AudioLines,
  AudioWaveform,
  Bird,
  Clock3,
  CloudLightning,
  CloudRain,
  Coffee,
  Droplets,
  ExternalLink,
  Flame,
  Loader2,
  Moon,
  Mountain,
  Orbit,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useUi } from '@/app/ui-store'
import { SOUNDS, type SoundCategory } from '@/audio/sounds'
import { useAudio } from '@/audio/store'
import { parseMediaUrl, providerName, SUGGESTED_STREAMS } from '@/audio/youtube'
import { updateSettings, useAudioPresets, usePlaylists, useSettings } from '@/data/hooks'
import { create, nextOrder, remove } from '@/data/repo'
import { cn } from '@/lib/cn'
import { Button, SectionTitle, TextInput, Toggle } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { openExternal, useMusic } from './music'

const ICONS: Record<string, LucideIcon> = {
  rain: CloudRain,
  thunder: CloudLightning,
  waves: Waves,
  wind: Wind,
  stream: Droplets,
  fire: Flame,
  birds: Bird,
  night: Moon,
  cafe: Coffee,
  clock: Clock3,
  white: AudioWaveform,
  pink: AudioLines,
  brown: Mountain,
  drone: Orbit,
}

const CATEGORY_NAME: Record<SoundCategory, string> = { nature: 'Nature', places: 'Places', noise: 'Noise & tones' }

export function SoundSheet() {
  const open = useUi((s) => s.soundOpen)
  const close = () => useUi.getState().set({ soundOpen: false })
  const audio = useAudio()
  const presets = useAudioPresets()
  const settings = useSettings()
  const [saving, setSaving] = useState<string | null>(null)
  const active = Object.keys(audio.layers)

  const savePreset = async () => {
    const name = saving?.trim()
    if (!name || !active.length) return
    await create('audioPresets', { name, layers: active.map((sound) => ({ sound, volume: audio.layers[sound] })), order: await nextOrder('audioPresets') })
    setSaving(null)
    toast({ title: 'Soundscape saved', body: name, tone: 'success' })
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Soundscape"
      subtitle="Layer sounds and set each level. Everything is generated on your device and works offline."
      size="lg"
      headerAction={
        <button
          type="button"
          onClick={() => audio.togglePlay()}
          disabled={!active.length}
          aria-label={audio.playing ? 'Pause' : 'Play'}
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-ink disabled:opacity-30"
        >
          {audio.playing ? <Pause className="size-4.5 fill-current" strokeWidth={0} /> : <Play className="ml-0.5 size-4.5 fill-current" strokeWidth={0} />}
        </button>
      }
    >
      <div className="space-y-6">
        <section>
          <SectionTitle>Presets</SectionTitle>
          <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {presets.map((p) => (
              <div key={p.id} className="group relative shrink-0">
                <button
                  type="button"
                  onClick={() => audio.applyPreset(p.layers, p.id)}
                  className={cn('flex h-16 min-w-32 flex-col justify-center rounded-2xl border px-3.5 text-left transition-colors', audio.presetId === p.id ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface-2 hover:border-line-strong')}
                >
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="mt-0.5 flex gap-1 text-ink-3">
                    {p.layers.map((l) => {
                      const Icon = ICONS[l.sound] ?? AudioLines
                      return <Icon key={l.sound} className="size-3.5" />
                    })}
                  </span>
                </button>
                <button type="button" aria-label={`Delete ${p.name}`} onClick={() => void remove('audioPresets', p.id)} className="absolute -top-1.5 -right-1.5 hidden size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-3 shadow-soft group-hover:flex hover:text-danger">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
          {active.length > 0 &&
            (saving === null ? (
              <button type="button" onClick={() => setSaving('')} className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs font-bold text-accent">
                <Save className="size-3.5" /> Save current mix
              </button>
            ) : (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void savePreset()
                }}
              >
                <TextInput autoFocus value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="Name this mix" className="py-2" />
                <Button type="submit" variant="primary">
                  Save
                </Button>
              </form>
            ))}
        </section>

        {(['nature', 'places', 'noise'] as SoundCategory[]).map((cat) => (
          <section key={cat}>
            <SectionTitle>{CATEGORY_NAME[cat]}</SectionTitle>
            <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
              {SOUNDS.filter((s) => s.category === cat).map((s) => {
                const Icon = ICONS[s.id] ?? AudioLines
                const on = audio.layers[s.id] !== undefined
                const loading = audio.loading.includes(s.id)
                return (
                  <div key={s.id} className={cn('rounded-2xl border px-3 py-2.5 transition-colors', on ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-2/60')}>
                    <button type="button" onClick={() => audio.toggleSound(s.id)} aria-pressed={on} className="flex w-full items-center gap-2.5 text-left">
                      <span className={cn('flex size-9 items-center justify-center rounded-xl', on ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-2')}>
                        {loading ? <Loader2 className="size-4.5 animate-spin" /> : <Icon className="size-4.5" />}
                      </span>
                      <span className="text-sm font-bold">{s.name}</span>
                    </button>
                    {on && (
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={audio.layers[s.id]}
                        onChange={(e) => audio.setVolume(s.id, Number(e.target.value))}
                        aria-label={`${s.name} volume`}
                        className="mt-2 w-full"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <section className="space-y-3 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Master volume</span>
            <input type="range" min={0} max={1} step={0.01} value={audio.master} onChange={(e) => audio.setMaster(Number(e.target.value))} aria-label="Master volume" className="w-40" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold">Follow the timer</span>
              <span className="block text-xs text-ink-2">Sounds and music play during focus, pause when you pause, stop when you stop, and fade out for breaks.</span>
            </span>
            <Toggle label="Follow the timer" checked={settings.ambientFollowsTimer} onChange={(v) => void updateSettings({ ambientFollowsTimer: v })} />
          </div>
        </section>

        <MusicSection />
      </div>
    </Sheet>
  )
}

function MusicSection() {
  const playlists = usePlaylists()
  const play = useMusic((s) => s.play)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const parsed = url ? parseMediaUrl(url) : null

  const add = async () => {
    if (!parsed) return toast({ title: 'That doesn’t look like a link', tone: 'warning' })
    await create('playlists', { title: title.trim() || `${providerName(parsed.provider)} playlist`, url: url.trim(), provider: parsed.provider, order: await nextOrder('playlists') })
    setUrl('')
    setTitle('')
  }

  const start = (p: { id: string; title: string; url: string; provider: 'youtube' | 'youtube-music' | 'spotify' | 'link' }) => {
    const m = parseMediaUrl(p.url)
    if (m?.embeddable) {
      play(p)
      useUi.getState().set({ soundOpen: false })
    } else openExternal(p.url)
  }

  return (
    <section>
      <SectionTitle>Music</SectionTitle>
      <p className="mb-3 px-1 text-[13px] leading-relaxed text-ink-2">
        Save YouTube or YouTube Music links. YouTube videos and playlists play here in the official embedded player; YouTube Music opens in its own app, where background listening follows your YouTube subscription.
      </p>
      {playlists.length > 0 && (
        <ul className="mb-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {playlists.map((p) => {
            const embeddable = !!parseMediaUrl(p.url)?.embeddable
            return (
              <li key={p.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.title}</span>
                  <span className="block text-xs text-ink-3">{providerName(p.provider)}</span>
                </span>
                <Button size="sm" variant={embeddable ? 'primary' : 'secondary'} icon={embeddable ? <Play className="size-3.5 fill-current" /> : <ExternalLink className="size-3.5" />} onClick={() => start(p)}>
                  {embeddable ? 'Play' : 'Open'}
                </Button>
                <button type="button" aria-label={`Remove ${p.title}`} onClick={() => void remove('playlists', p.id)} className="rounded-full p-2 text-ink-3 hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube or YouTube Music link" inputMode="url" />
        {url && (
          <div className="flex gap-2">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional)" className="py-2" />
            <Button type="submit" variant="primary" icon={<Plus className="size-4" />}>
              Save
            </Button>
          </div>
        )}
      </form>
      {playlists.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_STREAMS.map((s) => (
            <button
              key={s.url}
              type="button"
              onClick={() => {
                setUrl(s.url)
                setTitle(s.title)
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink">
              {s.title}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
