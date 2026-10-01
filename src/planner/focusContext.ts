/** Shared task selection semantics for commands and the internal context picker. */
import type { Project, Task } from '@/data/types'
import type { TimerContext } from '@/timer/engine'

export function focusContextForTask(task: Task, project: Project | undefined, previous: TimerContext) {
  return {
    taskId: task.id,
    projectId: task.projectId,
    labelId: task.labelId ?? project?.labelId ?? null,
    note: previous.taskId === task.id ? previous.note : '',
  }
}
