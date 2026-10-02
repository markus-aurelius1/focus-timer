/**
 * The sound panel: ambient layers, study music and saved mixes.
 *
 * It is only a remote control. Everything that plays belongs to the engine in
 * audio/store.ts, so opening or closing this panel, or leaving the screen it
 * was opened from, changes nothing about what is heard.
 *
 * Beside the content on a wide screen (the timer stays in view); a bottom
 * sheet on a phone.
 */
import {
  AudioLines,
  AudioWaveform,
  Bird,
  BookOpen,
  Bug,
  Building2,
  Car,
  Clock3,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  Coffee,
  CupSoda,
  Droplet,
  Droplets,
  ExternalLink,
  Fan,
  Fish,
  Flame,
  FlameKindling,
  Flower2,
  Keyboard,
  Leaf,
  Moon,
  Mountain,
  Orbit,
  Pause,
  Plane,
  Play,
  Plus,
  Sailboat,
  Save,
  Shuffle,
  SkipBack,
  SkipForward,
  Snowflake,
  TrainFront,
  Trash2,
  TreePine,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useUi } from '@/app/ui-store'
import { MIXES, MUSIC_GENRES, MUSIC_TRACKS, SOUND_CATEGORIES, SOUND_LIST, SOUND_META, TRACK_META, type MusicGenre, type SoundCategory } from '@/audio/catalog'
import { queue, useAudio } from '@/audio/store'
import { parseMediaUrl, providerName, SUGGESTED_STREAMS } from '@/audio/youtube'
import { updateSettings, useAudioPresets, usePlaylists, useSettings } from '@/data/hooks'
import { create, nextOrder, remove } from '@/data/repo'
import { cn } from '@/lib/cn'
import { Button, Chip, Group, IconButton, ListRow, Pressable, SectionTitle, Slider, Spinner, SwitchRow, TabPanel, Tabs, TextInput } from '@/ui/controls'
import { SidePanel } from '@/ui/surface/SidePanel'
import { toast } from '@/ui/toast'
import { openExternal, useMusic } from './music'

const CATEGORY_ICON: Record<SoundCategory, LucideIcon> = {
  weather: CloudRain,
  water: Droplets,
  forest: TreePine,
  nature: Flower2,
  night: Moon,
  fire: Flame,
  cafe: Coffee,
  urban: Building2,
  transport: TrainFront,
  noise: AudioWaveform,
}

const ICONS: Record<string, LucideIcon> = {
  'heavy-rain': CloudRainWind,
  'rain-window': CloudDrizzle,
  thunder: CloudLightning,
  wind: Wind,
  blizzard: Snowflake,
  waves: Waves,
  lake: Sailboat,
  drip: Droplet,
  birds: Bird,
  leaves: Leaf,
  cicadas: Bug,
  frogs: Fish,
  owl: Bird,
  campfire: FlameKindling,
  cups: CupSoda,
  keyboard: Keyboard,
  pages: BookOpen,
  clock: Clock3,
  fan: Fan,
  plane: Plane,
  car: Car,
  pink: AudioLines,
  brown: Mountain,
  drone: Orbit,
}

const iconFor = (id: string): LucideIcon => ICONS[id] ?? CATEGORY_ICON[SOUND_META.get(id)?.category ?? 'noise']
const percent = (v: number) => `${Math.round(v * 100)}%`

type Tab = 'ambience' | 'music' | 'mixes'

export function SoundSheet() {
  const open = useUi((s) => s.soundOpen)
  const close = () => useUi.getState().set({ soundOpen: false })
  const playing = useAudio((s) => s.playing)
  const master = useAudio((s) => s.master)
  const count = useAudio((s) => Object.keys(s.layers).length)
  const musicOn = useAudio((s) => s.music.on)
  const [tab, setTab] = useState<Tab>('ambience')
  const nothing = count === 0 && !musicOn

  return (
    <SidePanel
      open={open}
      onClose={close}
      name="sounds"
      width={400}
      title="Sounds"
      subtitle="Made on this device. Nothing to download; works offline."
      size="lg"
      headerAction={
        <IconButton label={playing ? 'Pause sound' : 'Play sound'} variant="primary" disabled={nothing} onClick={() => useAudio.getState().togglePlay()}>
          {playing ? <Pause className="fill-current" strokeWidth={0} /> : <Play className="ml-0.5 fill-current" strokeWidth={0} />}
        </IconButton>
      }
      footer={
        <div className="flex items-center gap-3">
          <Volume2 className="size-4 shrink-0 text-ink-3" aria-hidden />
          <Slider className="flex-1" label="Overall volume" value={master} valueLabel={percent(master)} onChange={(v) => useAudio.getState().setMaster(v)} />
        </div>
      }
    >
      <Tabs
        id="sound"
        label="Sound sections"
        layoutId="sound-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'ambience', label: 'Ambience', count: count || undefined },
          { id: 'music', label: 'Music' },
          { id: 'mixes', label: 'Mixes' },
        ]}
        className="mb-4"
      />
      <TabPanel id="sound" tab="ambience" current={tab}>
        <Ambience />
      </TabPanel>
      <TabPanel id="sound" tab="music" current={tab}>
        <Music />
      </TabPanel>
      <TabPanel id="sound" tab="mixes" current={tab}>
        <Mixes />
      </TabPanel>
    </SidePanel>
  )
}

// ───────────────────────── ambience ─────────────────────────

function Ambience() {
  const layers = useAudio((s) => s.layers)
  const loading = useAudio((s) => s.loading)
  const [category, setCategory] = useState<SoundCategory | 'all'>('all')
  const active = Object.keys(layers)
  const shown = category === 'all' ? SOUND_LIST : SOUND_LIST.filter((s) => s.category === category)
  const audio = useAudio.getState()

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <section aria-label="In the mix">
          <SectionTitle
            action={
              <Button size="sm" variant="ghost" onClick={() => active.forEach((id) => audio.toggleSound(id))}>
                Clear
              </Button>
            }
          >
            In the mix
          </SectionTitle>
          <Group as="ul" flat>
            {active.map((id) => {
              const meta = SOUND_META.get(id)
              if (!meta) return null
              const layer = layers[id]
              const Icon = iconFor(id)
              return (
                <li key={id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                  <span className="flex size-8 shrink-0 items-center justify-center text-ink-2">{loading.includes(id) ? <Spinner className="size-4" /> : <Icon className="size-[18px]" aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px] font-semibold', layer.muted && 'text-ink-3')}>{meta.name}</span>
                    <Slider label={`${meta.name} volume`} value={layer.volume} valueLabel={percent(layer.volume)} onChange={(v) => audio.setVolume(id, v)} className={cn(layer.muted && 'opacity-50')} />
                  </span>
                  <IconButton size="sm" label={layer.muted ? `Unmute ${meta.name}` : `Mute ${meta.name}`} active={layer.muted} aria-pressed={layer.muted} onClick={() => audio.toggleMute(id)}>
                    {layer.muted ? <VolumeX /> : <Volume2 />}
                  </IconButton>
                  <IconButton size="sm" label={`Remove ${meta.name}`} onClick={() => audio.toggleSound(id)}>
                    <X />
                  </IconButton>
                </li>
              )
            })}
          </Group>
        </section>
      )}

      <section aria-label="All sounds">
        <div className="chip-row scrollbar-none -mx-5 mb-3 px-5" role="group" aria-label="Sound categories">
          <Chip active={category === 'all'} onClick={() => setCategory('all')} className="shrink-0">
            All
          </Chip>
          {SOUND_CATEGORIES.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} className="shrink-0">
              {c.name}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {shown.map((s) => {
            const Icon = iconFor(s.id)
            const on = !!layers[s.id]
            return (
              <Pressable
                key={s.id}
                aria-pressed={on}
                onClick={() => audio.toggleSound(s.id)}
                className={cn('flex min-h-12 items-center gap-2.5 rounded-field px-3 py-2 text-left text-[13px] leading-tight font-semibold', on ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink')}
              >
                {loading.includes(s.id) ? <Spinner className="size-[18px] shrink-0" /> : <Icon className={cn('size-[18px] shrink-0', !on && 'text-ink-2')} aria-hidden />}
                <span className="min-w-0">{s.name}</span>
              </Pressable>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ───────────────────────── music ─────────────────────────

function Music() {
  const music = useAudio((s) => s.music)
  const playing = useAudio((s) => s.playing)
  const loading = useAudio((s) => s.loading)
  const audio = useAudio.getState()
  const current = TRACK_META.get(music.track)
  const sounding = playing && music.on
  const tracks = queue(music)
  const genreName = (g: MusicGenre) => MUSIC_GENRES.find((x) => x.id === g)?.name ?? ''

  return (
    <div className="space-y-5">
      <section aria-label="Now playing" className="rounded-card bg-surface-2 p-4">
        <p className="t-micro text-ink-3">{sounding ? 'Now playing' : music.on ? 'Paused' : 'Study music'}</p>
        <p className="mt-1 truncate text-[17px] leading-snug font-bold" aria-live="polite">
          {current?.name}
        </p>
        <p className="text-[13px] text-ink-2">{current ? genreName(current.genre) : ''} · plays on, one track into the next</p>
        <div className="mt-3 flex items-center gap-1.5">
          <IconButton label="Previous track" onClick={() => audio.prevTrack()}>
            <SkipBack />
          </IconButton>
          <IconButton
            size="lg"
            variant="primary"
            label={sounding ? 'Pause music' : 'Play music'}
            onClick={() => {
              // Pausing the music leaves the ambience playing; the header button pauses everything.
              if (sounding) audio.setMusic(false)
              else audio.playTrack(music.track)
            }}
          >
            {loading.includes(`music:${music.track}`) ? <Spinner className="size-5" /> : sounding ? <Pause className="fill-current" strokeWidth={0} /> : <Play className="ml-0.5 fill-current" strokeWidth={0} />}
          </IconButton>
          <IconButton label="Next track" onClick={() => audio.nextTrack()}>
            <SkipForward />
          </IconButton>
          <span className="flex-1" />
          <IconButton label="Shuffle" active={music.shuffle} aria-pressed={music.shuffle} onClick={() => audio.setShuffle(!music.shuffle)}>
            <Shuffle />
          </IconButton>
        </div>
        <Slider className="mt-2" label="Music volume" value={music.volume} valueLabel={percent(music.volume)} onChange={(v) => audio.setMusicVolume(v)} />
      </section>

      <section aria-label="Tracks">
        <div className="chip-row scrollbar-none -mx-5 mb-2 px-5" role="group" aria-label="Genres">
          <Chip active={music.genre === 'all'} onClick={() => audio.setGenre('all')} className="shrink-0">
            All
          </Chip>
          {MUSIC_GENRES.map((g) => (
            <Chip key={g.id} active={music.genre === g.id} onClick={() => audio.setGenre(g.id)} className="shrink-0">
              {g.name}
            </Chip>
          ))}
        </div>
        {music.genre !== 'all' && <p className="mb-1 px-1 text-[13px] text-ink-2">{MUSIC_GENRES.find((g) => g.id === music.genre)?.about}</p>}
        <ul>
          {tracks.map((t) => {
            const selected = t.id === music.track && music.on
            return (
              <ListRow
                as="li"
                key={t.id}
                density="compact"
                selected={selected}
                title={t.name}
                meta={music.genre === 'all' ? genreName(t.genre) : undefined}
                label={`Play ${t.name}`}
                trailing={selected && sounding ? <AudioLines className="size-4 text-accent" aria-label="Playing" /> : undefined}
                onClick={() => audio.playTrack(t.id)}
              />
            )
          })}
        </ul>
        <p className="mt-2 px-1 text-[13px] text-ink-3">{MUSIC_TRACKS.length} pieces, each written by the app from a few rules. No recordings.</p>
      </section>

      <Links />
    </div>
  )
}

/** Saved YouTube links: the official embedded player, or the YouTube Music app. */
function Links() {
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
    <section aria-label="Your links">
      <SectionTitle>Your links</SectionTitle>
      <p className="mb-3 px-1 text-[13px] leading-relaxed text-ink-2">YouTube videos and playlists play here in the official player and need a connection. YouTube Music opens in its own app.</p>
      {playlists.length > 0 && (
        <Group as="ul" flat className="mb-3">
          {playlists.map((p) => {
            const embeddable = !!parseMediaUrl(p.url)?.embeddable
            return (
              <ListRow
                as="li"
                key={p.id}
                density="compact"
                className="pl-3"
                leading={embeddable ? <Play className="size-4 text-ink-2" aria-hidden /> : <ExternalLink className="size-4 text-ink-2" aria-hidden />}
                title={p.title}
                meta={providerName(p.provider)}
                label={`${embeddable ? 'Play' : 'Open'} ${p.title}`}
                onClick={() => start(p)}
                actions={
                  <IconButton size="sm" label={`Remove ${p.title}`} onClick={() => void remove('playlists', p.id)}>
                    <Trash2 />
                  </IconButton>
                }
              />
            )
          })}
        </Group>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube or YouTube Music link" aria-label="Link" inputMode="url" />
        {url && (
          <div className="flex gap-2">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional)" aria-label="Name" />
            <Button type="submit" variant="primary" icon={<Plus className="size-4" />}>
              Save
            </Button>
          </div>
        )}
      </form>
      {playlists.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_STREAMS.map((s) => (
            <Chip
              key={s.url}
              onClick={() => {
                setUrl(s.url)
                setTitle(s.title)
              }}
            >
              {s.title}
            </Chip>
          ))}
        </div>
      )}
    </section>
  )
}

// ───────────────────────── mixes ─────────────────────────

function Mixes() {
  const layers = useAudio((s) => s.layers)
  const presetId = useAudio((s) => s.presetId)
  const presets = useAudioPresets()
  const settings = useSettings()
  const [saving, setSaving] = useState<string | null>(null)
  const active = Object.keys(layers)
  const audio = useAudio.getState()

  const save = async () => {
    const name = saving?.trim()
    if (!name || !active.length) return
    await create('audioPresets', { name, layers: active.map((sound) => ({ sound, volume: layers[sound].volume })), order: await nextOrder('audioPresets') })
    setSaving(null)
    toast({ title: 'Mix saved', body: name, tone: 'success' })
  }

  const icons = (mix: Array<{ sound: string }>) => (
    <span className="flex gap-1 text-ink-3">
      {mix.map((l) => {
        const Icon = iconFor(l.sound)
        return <Icon key={l.sound} className="size-4" aria-hidden />
      })}
    </span>
  )
  const names = (mix: Array<{ sound: string }>) =>
    mix
      .map((l) => SOUND_META.get(l.sound)?.name)
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="space-y-5">
      <section aria-label="Your mixes">
        <SectionTitle>Your mixes</SectionTitle>
        {presets.length > 0 ? (
          <Group as="ul" flat>
            {presets.map((p) => (
              <ListRow
                as="li"
                key={p.id}
                density="compact"
                className="pl-3"
                selected={presetId === p.id}
                title={p.name}
                meta={names(p.layers)}
                label={`Play ${p.name}`}
                trailing={icons(p.layers)}
                onClick={() => audio.applyPreset(p.layers, p.id)}
                actions={
                  <IconButton size="sm" label={`Delete ${p.name}`} onClick={() => void remove('audioPresets', p.id)}>
                    <Trash2 />
                  </IconButton>
                }
              />
            ))}
          </Group>
        ) : (
          <p className="px-1 text-[13px] text-ink-2">Build a mix under Ambience, then save it here.</p>
        )}
        {active.length > 0 &&
          (saving === null ? (
            <Button className="mt-2" size="sm" variant="ghost" icon={<Save className="size-4" />} onClick={() => setSaving('')}>
              Save the current mix
            </Button>
          ) : (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <TextInput autoFocus value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="Name this mix" aria-label="Mix name" />
              <Button type="submit" variant="primary" disabled={!saving.trim()}>
                Save
              </Button>
            </form>
          ))}
      </section>

      <section aria-label="Ready-made mixes">
        <SectionTitle>Ready-made</SectionTitle>
        <Group as="ul" flat>
          {MIXES.map((m) => (
            <ListRow as="li" key={m.id} density="compact" className="pl-3" selected={presetId === m.id} title={m.name} meta={names(m.layers)} label={`Play ${m.name}`} trailing={icons(m.layers)} onClick={() => audio.applyPreset(m.layers, m.id)} />
          ))}
        </Group>
      </section>

      <Group flat>
        <SwitchRow className="px-3" title="Follow the timer" description="Sound plays during focus, pauses when you pause, stops when you stop, and fades out for breaks." checked={settings.ambientFollowsTimer} onChange={(v) => void updateSettings({ ambientFollowsTimer: v })} />
      </Group>
    </div>
  )
}
