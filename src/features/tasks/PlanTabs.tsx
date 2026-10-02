/**
 * The views of the plan, shared by the task lists and the calendar (which is
 * the plan laid out in time, so it lives here rather than as its own
 * destination).
 *
 * In the window all seven sit in one row of tabs. On a phone only four fit, so
 * the three used every day stay as tabs and the lists (Inbox, Projects, Habits,
 * Done) sit behind one "Lists" entry – which shows the list you are on.
 */
import { ChevronDown } from 'lucide-react'
import { navigate } from '@/app/router'
import { cn } from '@/lib/cn'
import { Pressable, Tabs } from '@/ui/controls'
import { Menu } from '@/ui/Menu'
import { useMediaQuery } from '@/ui/useMedia'

export type PlanView = 'today' | 'upcoming' | 'calendar' | 'inbox' | 'projects' | 'habits' | 'done'
export const PLAN_VIEWS: Array<{ id: PlanView; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'projects', label: 'Projects' },
  { id: 'habits', label: 'Habits' },
  { id: 'done', label: 'Done' },
]
/** The views that stay as tabs on a phone. */
const ALWAYS: PlanView[] = ['today', 'upcoming', 'calendar']

const open = (view: PlanView) => navigate(view === 'calendar' ? '#/calendar' : `#/tasks?view=${view}`)

export function PlanTabs({ current, inboxCount = 0 }: { current: PlanView; inboxCount?: number }) {
  const compact = !useMediaQuery('(min-width: 640px)')
  const shown = compact ? PLAN_VIEWS.filter((v) => ALWAYS.includes(v.id)) : PLAN_VIEWS
  const lists = PLAN_VIEWS.filter((v) => !ALWAYS.includes(v.id))
  const onList = compact ? lists.find((v) => v.id === current) : undefined
  return (
    <Tabs
      kind="nav"
      label="Plan views"
      layoutId="plan-view"
      className="-mx-4 px-4 sm:mx-0 sm:px-0"
      items={shown.map((v) => ({ id: v.id, label: v.label, count: v.id === 'inbox' ? inboxCount : undefined }))}
      value={current}
      onChange={open}
      trailing={
        compact && (
          <Menu
            label="Lists"
            align="right"
            items={lists.map((v) => ({ label: v.label, hint: v.id === 'inbox' && inboxCount > 0 ? String(inboxCount) : v.id === current ? 'Open' : undefined, onSelect: () => open(v.id) }))}
            trigger={(props) => (
              <Pressable plain className={cn('tab flex items-center gap-1', onList && 'bg-surface-2')} aria-current={onList ? 'page' : undefined} aria-label={onList ? `${onList.label} – lists` : 'Lists'} {...props}>
                <span className="relative">{onList?.label ?? 'Lists'}</span>
                {!onList && inboxCount > 0 && <span className="t-num relative text-[11.5px] text-ink-3">{inboxCount}</span>}
                <ChevronDown className="relative size-3.5" aria-hidden />
              </Pressable>
            )}
          />
        )
      }
    />
  )
}
