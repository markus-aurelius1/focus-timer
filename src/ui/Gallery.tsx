/**
 * The primitives gallery (#/settings?gallery=1): every control in src/ui, in
 * every state, on one page. It is how the system itself is reviewed and
 * screenshotted (tools/perf/shots.mjs), in Paper and in Night; it is not linked
 * from the app.
 */
import { Bell, Copy, Flag, Headphones, MoreHorizontal, Pencil, Play, Star, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Workspace } from '@/app/Workspace'
import { Badge, Button, Checkbox, Chip, DateField, Field, Group, IconButton, ListRow, Progress, SearchField, SegmentedControl, Select, Skeleton, Slider, Spinner, Stepper, Switch, SwitchRow, Tabs, TextArea, TextInput, TimeField } from './controls'
import { AnswerTile } from './patterns/question/AnswerTile'
import { BottomSheet } from './surface/BottomSheet'
import { Dialog } from './surface/Dialog'
import { SheetActions } from './surface/frame'
import { Menu } from './surface/Menu'
import { Popover } from './surface/Popover'
import { SidePanel } from './surface/SidePanel'
import { toast } from './toast'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8" aria-label={title} data-gallery={title}>
      <h2 className="t-heading mb-3">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export default function Gallery() {
  const [tab, setTab] = useState('today')
  const [seg, setSeg] = useState('day')
  const [on, setOn] = useState(true)
  const [check, setCheck] = useState(false)
  const [vol, setVol] = useState(0.6)
  const [n, setN] = useState(25)
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState<'dialog' | 'sheet' | 'detents' | 'panel' | 'popover' | null>(null)
  const [answer, setAnswer] = useState<string | null>('b')
  const anchor = useRef<HTMLButtonElement>(null)

  return (
    <Workspace title="Primitives" back width="lg" meta="Every control, every state">
      <Section title="Buttons">
        {(['primary', 'accent', 'secondary', 'ghost', 'danger'] as const).map((v) => (
          <Button key={v} variant={v}>
            {v[0].toUpperCase() + v.slice(1)}
          </Button>
        ))}
        <Button size="sm">Small</Button>
        <Button size="lg" variant="primary" icon={<Play className="size-4 fill-current" strokeWidth={0} />}>
          Large with icon
        </Button>
        <Button loading variant="primary">
          Saving
        </Button>
        <Button disabled>Disabled</Button>
        <Button
          variant="secondary"
          success={saved}
          icon={<Copy className="size-4" />}
          onClick={() => {
            setSaved(true)
            setTimeout(() => setSaved(false), 1600)
          }}
        >
          Copy
        </Button>
      </Section>

      <Section title="Icon buttons">
        <IconButton label="Sounds" shortcut="S">
          <Headphones className="size-[19px]" />
        </IconButton>
        <IconButton label="Favourite" active>
          <Star className="size-[19px]" />
        </IconButton>
        <IconButton label="Small" size="sm">
          <Pencil className="size-4" />
        </IconButton>
        <IconButton label="Secondary" variant="secondary">
          <Bell className="size-[18px]" />
        </IconButton>
        <IconButton label="Primary, large" variant="primary" size="lg">
          <Play className="size-5 fill-current" strokeWidth={0} />
        </IconButton>
        <IconButton label="Disabled" disabled>
          <Trash2 className="size-[18px]" />
        </IconButton>
        <Spinner className="size-5 text-ink-2" />
      </Section>

      <Section title="Chips and badges">
        <Chip>Plain</Chip>
        <Chip onClick={() => {}}>Pressable</Chip>
        <Chip onClick={() => {}} active>
          Selected
        </Chip>
        <Chip color="#5e57c9">With colour</Chip>
        <Badge>Neutral</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="correct">Correct</Badge>
        <Badge tone="incorrect">Incorrect</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="info">Info</Badge>
      </Section>

      <Section title="Fields">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field label="Text" hint="A hint sits under the control.">
            <TextInput placeholder="Placeholder" />
          </Field>
          <Field label="Invalid">
            <TextInput defaultValue="Not a date" aria-invalid="true" />
          </Field>
          <Field label="Select">
            <Select defaultValue="b">
              <option value="a">First</option>
              <option value="b">Second</option>
            </Select>
          </Field>
          <Field label="Disabled">
            <TextInput disabled defaultValue="Can’t change this" />
          </Field>
          <Field label="Date">
            <DateField defaultValue="2026-10-02" />
          </Field>
          <Field label="Time">
            <TimeField defaultValue="17:30" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <TextArea placeholder="Longer text" />
          </Field>
          <SearchField label="Search the gallery" value={q} onChange={setQ} placeholder="Search" shortcut="/" />
          <div className="flex items-center gap-3">
            <Select compact defaultValue="week" aria-label="Range">
              <option value="week">This week</option>
              <option value="month">This month</option>
            </Select>
            <SearchField compact label="Compact search" value={q} onChange={setQ} placeholder="Filter" />
          </div>
          <Field label="Volume">
            <Slider label="Volume" value={vol} onChange={setVol} valueLabel={`${Math.round(vol * 100)}%`} detents={[0.5]} />
          </Field>
          <Field label="Minutes">
            <Stepper label="Minutes" value={n} onChange={setN} min={5} max={120} step={5} suffix="min" />
          </Field>
        </div>
      </Section>

      <Section title="Selection">
        <Tabs
          label="Example views"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'inbox', label: 'Inbox', count: 3 },
            { id: 'done', label: 'Done' },
          ]}
        />
        <SegmentedControl
          label="Range"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <SegmentedControl
          size="sm"
          label="Small range"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
          ]}
        />
        <Switch checked={on} onChange={setOn} label="Example switch" />
        <Switch checked={false} onChange={() => {}} label="Disabled switch" disabled />
        <Checkbox checked={check} onChange={setCheck} label="Example task" />
        <Checkbox checked onChange={() => {}} label="Done task" />
        <Checkbox checked={check} onChange={setCheck} label="Square" shape="square" size="sm" />
        <Checkbox checked={false} onChange={() => {}} label="High priority" ring="var(--danger)" />
      </Section>

      <Section title="Rows and groups">
        <Group className="w-full" label="Example settings">
          <SwitchRow title="Follow the timer" description="Sounds start, pause and stop with your session." checked={on} onChange={setOn} icon={<Headphones />} />
          <ListRow title="A row that opens something" meta="With a quiet second line" trailing="Value" onClick={() => {}} className="px-4" />
          <ListRow
            title="A row with actions beside it"
            meta="The actions are siblings of the row’s own button"
            leading={<Checkbox checked={check} onChange={setCheck} label="Complete the example row" />}
            onClick={() => {}}
            actions={
              <>
                <IconButton label="Focus on this" size="sm">
                  <Play className="size-[15px] fill-current" />
                </IconButton>
                <Menu
                  label="Row actions"
                  trigger={(p) => (
                    <IconButton label="More" size="sm" {...p}>
                      <MoreHorizontal className="size-4" />
                    </IconButton>
                  )}
                  items={[
                    { label: 'Rename', icon: <Pencil />, onSelect: () => {} },
                    { label: 'Duplicate', icon: <Copy />, onSelect: () => {}, hint: 'D' },
                    { label: 'Delete', icon: <Trash2 />, onSelect: () => {}, danger: true },
                  ]}
                />
              </>
            }
            className="px-2"
          />
          <ListRow title="Selected" selected onClick={() => {}} density="compact" className="px-4" />
          <ListRow title="Disabled" disabled onClick={() => {}} density="comfortable" className="px-4" />
        </Group>
      </Section>

      <Section title="Progress and loading">
        <div className="w-48">
          <Progress label="Daily goal" value={0.64} />
        </div>
        <div className="w-48">
          <Progress label="Thin" value={0.3} thin color="var(--phase-break)" />
        </div>
        <Progress label="Ring" variant="ring" value={0.72}>
          <span className="t-num text-xs">72</span>
        </Progress>
        <div className="w-32">
          <Progress label="Sessions" variant="segments" value={0.5} count={4} valueText="2 of 4" />
        </div>
        <div className="w-56">
          <Skeleton lines={3} />
        </div>
        <Skeleton className="size-12 rounded-full" />
      </Section>

      <Section title="Answer tiles">
        <div className="grid w-full gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Example question">
          <AnswerTile letter="A" state="idle" onSelect={() => setAnswer('a')} selected={answer === 'a'}>
            An answer nobody has chosen
          </AnswerTile>
          <AnswerTile letter="B" state="idle" onSelect={() => setAnswer('b')} selected={answer === 'b'}>
            The answer that is selected
          </AnswerTile>
          <AnswerTile letter="C" state="correct" selected onSelect={() => {}}>
            Chosen, and right
          </AnswerTile>
          <AnswerTile letter="D" state="incorrect" selected onSelect={() => {}}>
            Chosen, and wrong
          </AnswerTile>
          <AnswerTile letter="A" state="correct" onSelect={() => {}}>
            The right answer, not chosen
          </AnswerTile>
          <AnswerTile letter="B" state="idle" disabled onSelect={() => {}}>
            Locked after the answer is saved
          </AnswerTile>
        </div>
      </Section>

      <Section title="Surfaces">
        <Button onClick={() => setOpen('dialog')}>Dialog</Button>
        <Button onClick={() => setOpen('sheet')}>Bottom sheet</Button>
        <Button onClick={() => setOpen('detents')}>Sheet with detents</Button>
        <Button onClick={() => setOpen('panel')}>Side panel</Button>
        <Button ref={anchor} onClick={() => setOpen(open === 'popover' ? null : 'popover')} aria-expanded={open === 'popover'}>
          Popover
        </Button>
        <Menu
          label="Example menu"
          align="left"
          trigger={(p) => (
            <Button icon={<MoreHorizontal className="size-4" />} {...p}>
              Menu
            </Button>
          )}
          items={[
            { label: 'Open', icon: <Flag />, onSelect: () => {} },
            { label: 'Rename', icon: <Pencil />, onSelect: () => {} },
            { label: 'Unavailable', onSelect: () => {}, disabled: true },
            { label: 'Delete', icon: <Trash2 />, onSelect: () => {}, danger: true },
          ]}
        />
        <Button onClick={() => toast({ title: 'Saved', tone: 'success', action: { label: 'Undo', run: () => {} } })}>Toast</Button>
      </Section>
      <div className="h-24" />

      <Dialog
        open={open === 'dialog'}
        onClose={() => setOpen(null)}
        title="A dialog"
        subtitle="For a decision or a short form."
        size="sm"
        footer={
          <SheetActions>
            <Button onClick={() => setOpen(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => setOpen(null)} data-autofocus>
              Confirm
            </Button>
          </SheetActions>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-2">It is sized to its content, keeps its actions in view, traps focus and hands it back when it closes.</p>
      </Dialog>
      <BottomSheet open={open === 'sheet'} onClose={() => setOpen(null)} title="A bottom sheet" subtitle="Sized to its content. Drag it down to close.">
        <p className="pb-2 text-[15px] leading-relaxed text-ink-2">On a phone, most dialogs are one of these.</p>
      </BottomSheet>
      <BottomSheet open={open === 'detents'} onClose={() => setOpen(null)} title="Detents" detents={[180, 0.5, 0.92]}>
        <div className="space-y-3 pb-6 text-[15px] leading-relaxed text-ink-2">
          {Array.from({ length: 14 }, (_, i) => (
            <p key={i}>Drag the sheet between its resting heights. The content scrolls only at the top one. Line {i + 1}.</p>
          ))}
        </div>
      </BottomSheet>
      <SidePanel open={open === 'panel'} onClose={() => setOpen(null)} title="A side panel" subtitle="Beside the content on wide layouts; a sheet on a phone." name="gallery">
        <p className="text-[15px] leading-relaxed text-ink-2">The page beside it stays live. Drag its leading edge to resize it.</p>
      </SidePanel>
      <Popover open={open === 'popover'} onClose={() => setOpen(null)} anchor={anchor} label="Example popover" className="p-4" width={280}>
        <p className="t-heading">A popover</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">Anchored to its trigger, flipped and shifted to stay on screen.</p>
        <Button size="sm" className="mt-3 self-start" onClick={() => setOpen(null)}>
          Done
        </Button>
      </Popover>
    </Workspace>
  )
}
