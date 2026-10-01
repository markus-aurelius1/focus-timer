/** Task-to-focus continuity uses validated actions while preserving tracking an already active session. */
import type { Task } from '@/data/types'
import { useTimer } from '@/timer/store'
import { executeAction } from '@/tars/runtime'
export async function focusOnTask(task:Task,opts:{start?:boolean}={start:true}) {
  return opts.start&&useTimer.getState().timer.status==='idle' ? executeAction('timer.start',{taskId:task.id}) : executeAction('timer.linkTask',{taskId:task.id})
}
