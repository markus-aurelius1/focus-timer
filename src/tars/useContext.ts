/** Shared read-only context bridge. Map geometry is never needed to understand study state. */
import { useEffect, useMemo } from 'react'
import { currentRoute, useRoute } from '@/app/router'
import { useTasks, useSessions } from '@/data/hooks'
import { useExploration } from '@/atlas/useExploration'
import { useTimer } from '@/timer/store'
import { todayKey } from '@/lib/time'
import { deriveContext, type ContextInput } from './context'
import { dueForReview } from '@/atlas/mastery'
import { useDay } from '@/lib/useDay'
import { useTarsSelection } from './selection'
let projection:ContextInput|null=null
export function currentContext() {
  const timer=useTimer.getState().timer
  const today=todayKey(), selection=useTarsSelection.getState()
  let exploration=projection?.exploration ?? null
  if(exploration && exploration.today!==today) exploration={...exploration,today,due:dueForReview(exploration.state.discovered,exploration.mastery,today,id=>exploration!.atlas.byId.get(id)?.yield?.score ?? 0)}
  return deriveContext({...projection,route:currentRoute().name,today,timer,tasks:projection?.tasks ?? [],sessions:projection?.sessions ?? [],exploration,selectedPlace:selection.placeId,selectedPyq:selection.questionId})
}
export function useTarsContext() {
  const route=useRoute(), timer=useTimer(s=>s.timer), tasks=useTasks(), sessions=useSessions(), ex=useExploration(), selection=useTarsSelection(), today=useDay()
  const context=useMemo(()=>deriveContext({route:route.name,today,timer,tasks,sessions,exploration:ex,selectedPlace:selection.placeId,selectedPyq:selection.questionId}),[route.name,today,timer,tasks,sessions,ex,selection.placeId,selection.questionId])
  useEffect(()=>{projection={route:route.name,today,timer,tasks,sessions,exploration:ex,selectedPlace:selection.placeId,selectedPyq:selection.questionId}},[context,route.name,today,timer,tasks,sessions,ex,selection.placeId,selection.questionId])
  return context
}
