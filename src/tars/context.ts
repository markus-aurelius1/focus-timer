/** Deterministic context is a projection of history and current selection, never a second progress ledger. */
import type { Task, Session } from '@/data/types'
import type { TimerState } from '@/timer/engine'
import type { Exploration } from '@/atlas/useExploration'
import type { RouteName } from '@/app/router'
import { byPriorityThenOrder, isToday, isOverdue } from '@/planner/tasks'
export interface TarsContext {
  route: RouteName
  today: string
  timer: Pick<TimerState, 'status' | 'phase' | 'context'>
  currentTask: Task | null
  selectedPlace: string | null
  selectedPyq: string | null
  plan: Task[]
  dueReviews: string[]
  expedition: { id: string; title: string; nextPlaceId: string | null; remainingMinutes: number; blocked: boolean } | null
  recentFocus: { secondsToday: number; lastSession: Session | null; placesReached: number; expeditionMinutes: number }
  availableActions: string[]
}
export interface ContextInput { route: RouteName; today: string; timer: TimerState; tasks: Task[]; sessions: Session[]; exploration: Exploration | null; selectedPlace?: string | null; selectedPyq?: string | null }
export function deriveContext(input: ContextInput): TarsContext {
  const { route, today, timer, tasks, sessions, exploration: ex } = input
  const plan = tasks.filter(t => isToday(t,today) || isOverdue(t,today)).sort(byPriorityThenOrder)
  const last = sessions.slice().sort((a,b) => b.endedAt-a.endedAt || a.id.localeCompare(b.id))[0] ?? null
  const a = ex?.state.active
  const due = ex?.due.map(d=>d.id) ?? []
  const c: TarsContext = { route,today,timer:{status:timer.status,phase:timer.phase,context:timer.context},currentTask:tasks.find(t=>t.id===timer.context.taskId) ?? null,
    selectedPlace:route==='atlas' ? input.selectedPlace ?? null : null,selectedPyq:route==='atlas' ? input.selectedPyq ?? null : null,plan,dueReviews:due,
    expedition:a && !a.complete ? { id:a.expedition.id,title:a.expedition.title,nextPlaceId:a.next?.stop.place.id ?? null,remainingMinutes:a.next?.remaining ?? 0,blocked:!!a.blockedBy } : null,
    recentFocus:{secondsToday:sessions.filter(s=>s.date===today).reduce((n,s)=>n+s.duration,0),lastSession:last,placesReached:last&&ex ? [...ex.state.discovered.values()].filter(d=>d.at>=last.startedAt&&d.at<=last.endedAt).length : 0,expeditionMinutes:last&&ex?.state.activeRun&&last.endedAt>=ex.state.activeRun.startedAt ? last.duration/60 : 0},availableActions:[] }
  c.availableActions = ['atlas.open','atlas.search','task.create','calendar.openDay','settings.open',timer.status==='running'?'timer.pause':timer.status==='paused'?'timer.resume':'timer.start',
    ...(timer.status!=='idle'?['timer.stop']:[]),...(due.length?['review.startDue']:[]),...(c.expedition?['atlas.continueExpedition']:[]),...(c.selectedPlace?['atlas.reviewPlace','pyq.reviewForPlace']:[]),...(plan.length?['task.open']:[])]
  return c
}
export interface ContextSuggestion { title: string; action: string; input: Record<string, unknown> }
export function suggestActions(c: TarsContext): ContextSuggestion[] {
  const next: ContextSuggestion[] = []
  if (c.selectedPlace) next.push({title:'Questions for this place',action:'pyq.reviewForPlace',input:{placeId:c.selectedPlace}})
  if (c.dueReviews.length) next.push({title:`${c.dueReviews.length} Atlas reviews due`,action:'review.startDue',input:{}})
  if (c.timer.status==='idle' && c.plan[0]) next.push({title:`Focus · ${c.plan[0].title}`,action:'timer.start',input:{taskId:c.plan[0].id}})
  if (c.expedition) next.push({title:`${c.expedition.title} · ${c.expedition.blocked?'recall checkpoint':`${Math.ceil(c.expedition.remainingMinutes)}m to next stop`}`,action:'atlas.continueExpedition',input:{}})
  return next.slice(0,3)
}
