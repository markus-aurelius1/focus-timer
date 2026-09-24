import { db } from '@/data/db'
import type { Task } from '@/data/types'
import { navigate } from '@/app/router'
import { useTimer } from '@/timer/store'
import { toast } from '@/ui/toast'

/** Convert a task into a timer session: link it, inherit its subject, and start. */
export async function focusOnTask(task: Task, opts: { start?: boolean } = { start: true }) {
  const project = task.projectId ? await db.projects.get(task.projectId) : undefined
  const t = useTimer.getState()
  const labelId = task.labelId ?? project?.labelId ?? t.timer.context.labelId
  t.setContext({ taskId: task.id, projectId: task.projectId, labelId })
  navigate('#/focus')
  const s = useTimer.getState().timer
  if (opts.start && s.status === 'idle') {
    if (s.phase !== 'focus') useTimer.getState().selectPhase('focus')
    useTimer.getState().start()
  } else if (s.status !== 'idle') {
    toast({ title: 'Now tracking', body: `The current session counts towards “${task.title}”.` })
  }
}
