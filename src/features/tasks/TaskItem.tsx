import { motion } from 'motion/react'
import { AlarmClock, Check, GripVertical, ListChecks, Play, Repeat2, Timer } from 'lucide-react'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { patch, remove } from '@/data/repo'
import type { Label, Project, Task } from '@/data/types'
import { cn } from '@/lib/cn'
import { relativeDayLabel, todayKey } from '@/lib/time'
import { isOverdue, subtaskProgress, toggleTask } from '@/planner/tasks'
import { haptics } from '@/services/haptics'
import { useUi } from '@/app/ui-store'
import { toast } from '@/ui/toast'
import { focusOnTask } from '@/features/shared/focusOnTask'

export const PRIORITY_COLOR = ['var(--line-strong)', 'var(--phase-break)', 'var(--accent)', 'var(--danger)'] as const
export const PRIORITY_NAME = ['None', 'Low', 'Medium', 'High'] as const

export function TaskCheck({ task, size = 'md' }: { task: Task; size?: 'sm' | 'md' }) {
  const [pending, setPending] = useState(false)
  const checked = !!task.done || pending
  const s = size === 'sm' ? 'size-5' : 'size-[22px]'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark “${task.title}” as not done` : `Complete “${task.title}”`}
      onClick={(e) => {
        e.stopPropagation()
        if (pending) return
        if (!task.done) {
          haptics.success()
          setPending(true)
          // Let the check animation play before the task leaves the list.
          setTimeout(async () => {
            const next = await toggleTask(task)
            setPending(false)
            toast({
              title: 'Completed',
              body: next ? `${task.title} · next on ${relativeDayLabel(next.plannedFor ?? next.dueDate ?? todayKey())}` : task.title,
              tone: 'success',
              action: { label: 'Undo', run: () => void undoComplete(task, next?.id) },
            })
          }, 320)
        } else {
          haptics.tap()
          void toggleTask(task)
        }
      }}
      className={cn('group relative flex shrink-0 items-center justify-center rounded-full border-2 transition-colors', s)}
      style={{ borderColor: checked ? 'var(--success)' : PRIORITY_COLOR[task.priority], background: checked ? 'var(--success)' : task.priority ? `color-mix(in oklab, ${PRIORITY_COLOR[task.priority]} 10%, transparent)` : undefined }}
    >
      <motion.span initial={false} animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 26 }}>
        <Check className="size-3.5 text-white" strokeWidth={3.2} />
      </motion.span>
    </button>
  )
}

async function undoComplete(task: Task, spawnedId?: string) {
  await patch('tasks', task.id, { done: 0, completedAt: null })
  if (spawnedId) await remove('tasks', spawnedId)
}

export interface TaskItemProps {
  task: Task
  project?: Project
  label?: Label
  sessions?: number
  showDate?: boolean
  onDragStart?: (e: ReactPointerEvent) => void
  className?: string
}

export function TaskItem({ task, project, label, sessions = 0, showDate = true, onDragStart, className }: TaskItemProps) {
  const today = todayKey()
  const overdue = isOverdue(task, today)
  const sub = subtaskProgress(task)
  const dateKey = task.dueDate ?? task.plannedFor
  const dateText = dateKey ? `${task.dueDate ? 'Due ' : ''}${relativeDayLabel(dateKey, today)}${task.dueTime ? ` ${task.dueTime}` : ''}` : null
  const est = task.estimatedPomodoros
  const tags = task.tags ?? []
  const hasMeta = project || label || tags.length > 0 || (showDate && dateText) || est > 0 || sub.total > 0 || task.recurrence || task.reminderAt

  return (
    <div
      className={cn('group flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2/60', task.done && 'opacity-55', className)}
      onClick={() => useUi.getState().openTask(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') useUi.getState().openTask(task.id)
      }}
    >
      {onDragStart && (
        <span
          className="-ml-2 flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3 opacity-60 hover:opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
          onPointerDown={(e) => {
            e.stopPropagation()
            onDragStart(e)
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </span>
      )}
      <div className="pt-px">
        <TaskCheck task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] leading-snug font-semibold break-words', task.done && 'line-through decoration-ink-3')}>{task.title}</p>
        {hasMeta && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-ink-2">
            {project && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: project.color }} />
                {project.name}
              </span>
            )}
            {label && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-[3px]" style={{ background: label.color }} />
                {label.name}
              </span>
            )}
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="font-semibold text-ink-3">
                #{t}
              </span>
            ))}
            {tags.length > 3 && <span className="text-ink-3">+{tags.length - 3}</span>}
            {showDate && dateText && <span className={cn(overdue && 'font-bold text-danger')}>{dateText}</span>}
            {est > 0 && (
              <span className="inline-flex items-center gap-1" title={`${sessions} of ${est} sessions`}>
                <Timer className="size-3.5" />
                <PomodoroDots done={sessions} total={est} />
              </span>
            )}
            {sub.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" />
                {sub.done}/{sub.total}
              </span>
            )}
            {task.recurrence && <Repeat2 className="size-3.5" aria-label="Repeats" />}
            {task.reminderAt && task.reminderAt > Date.now() && <AlarmClock className="size-3.5" aria-label="Reminder set" />}
          </div>
        )}
      </div>
      {!task.done && (
        <button
          type="button"
          aria-label={`Focus on “${task.title}”`}
          onClick={(e) => {
            e.stopPropagation()
            haptics.press()
            void focusOnTask(task)
          }}
          className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent"
        >
          <Play className="size-4 fill-current" />
        </button>
      )}
    </div>
  )
}

export function PomodoroDots({ done, total }: { done: number; total: number }) {
  if (total > 6 || done > 6) return <span className={cn('tabular', done > total && 'font-bold text-danger')}>{done}/{total}</span>
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: Math.max(total, done) }, (_, i) => (
        <span key={i} className={cn('size-1.5 rounded-full', i < done ? (i < total ? 'bg-accent' : 'bg-danger') : 'bg-line-strong')} />
      ))}
    </span>
  )
}
