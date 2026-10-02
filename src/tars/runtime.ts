/** Validated actions call existing repository/timer operations. Future language/voice clients use this boundary. */
import { startExpedition } from '@/atlas/actions'
import { db } from '@/data/db'
import { patch } from '@/data/repo'
import { updateSettings } from '@/data/hooks'
import { useTimer } from '@/timer/store'
import { useUi } from '@/app/ui-store'
import { navigate } from '@/app/router'
import { addTask, addFromQuickAdd, AmbiguousNameError, completeTask } from '@/planner/tasks'
import { inferSubject, parseQuickAdd } from '@/planner/quickAdd'
import { focusContextForTask } from '@/planner/focusContext'
import { todayKey } from '@/lib/time'
import { enterFullscreen } from '@/services/fullscreen'
import { toast } from '@/ui/toast'
import { createActionRegistry, type ActionInputs, type ActionId, type ActionResult } from './registry'
import { currentContext } from './useContext'
const ok:ActionResult={ok:true}
const missing=(name:string):ActionResult=>({ok:false,code:'invalid-input',message:`${name} is unavailable`})
const query=(values:Record<string,unknown>)=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)])).toString()
const registry=createActionRegistry(currentContext,async(id,p,c)=>{
  const t=useTimer.getState(), ui=useUi.getState()
  switch(id) {
    case 'timer.linkTask': {
      const task=await db.tasks.get(String(p.taskId));if(!task||task.done)return missing('Task')
      const project=task.projectId?await db.projects.get(task.projectId):undefined
      const current=await db.tasks.get(task.id);if(!current||current.done||current.updatedAt!==task.updatedAt)return missing('Task')
      if (useTimer.getState().timer !== t.timer) return {ok:false,code:'unavailable',message:'Timer context changed. Try again.'}
      t.setContext(focusContextForTask(task,project,t.timer.context));navigate('#/focus');return ok
    }
    case 'calendar.startBlock': {
      const event=await db.events.get(String(p.eventId));if(!event||event.kind!=='block')return missing('Focus block')
      if(useTimer.getState().timer.status!=='idle')return {ok:false,code:'unavailable',message:'Finish the active timer before starting this block'}
      if(event.taskId)return registry.execute('timer.start',{taskId:event.taskId})
      return registry.execute('timer.start',{clearContext:true,...(event.labelId?{labelId:event.labelId}:{})})
    }
    case 'task.revisePlace': {
      const {loadAtlas}=await import('@/atlas/data'),atlas=await loadAtlas(),place=atlas.byId.get(String(p.placeId));if(!place)return missing('Place')
      const task=await addTask({title:`Revise ${place.name}`,notes:place.facts.join('\n')+`\n#/atlas?place=${place.id}`,plannedFor:todayKey(),estimatedPomodoros:1})
      toast({title:'Revision task added',body:`Revise ${place.name} · today`,tone:'success',action:{label:'Open',run:()=>{void executeAction('task.open',{taskId:task.id})}}});return ok
    }
    case 'timer.start': {
      if(p.labelId && !(await db.labels.get(String(p.labelId))))return missing('Subject')
      const task=p.taskId?await db.tasks.get(String(p.taskId)):undefined
      if(p.taskId&&(!task||task.done))return missing('Task')
      const project=task?.projectId?await db.projects.get(task.projectId):undefined
      const profile=task?.profileId?await db.profiles.get(task.profileId):undefined
      // Choose a compatible profile before any mutation. A requested duration also
      // works for a task whose preferred profile is a stopwatch.
      let effectiveProfile = profile
      const effectiveMode = profile?.mode ?? (t.timer.targetMs === null ? 'stopwatch' : 'countdown')
      if (p.minutes !== undefined && effectiveMode === 'stopwatch') {
        effectiveProfile = (await db.profiles.toArray()).find(candidate => candidate.mode === 'countdown')
        if (!effectiveProfile) return missing('Countdown profile')
      }
      if (task) {
        const current = await db.tasks.get(task.id)
        if (!current || current.done || current.updatedAt !== task.updatedAt) return missing('Task')
      }
      // Recheck after asynchronous reads: another source may have started a timer.
      if (useTimer.getState().timer !== t.timer || useTimer.getState().timer.status !== 'idle') return { ok: false, code: 'unavailable', message: 'The timer changed. Try again.' }
      if (effectiveProfile) t.applyProfile(effectiveProfile)
      if (task) {
        t.setContext(focusContextForTask(task, project, t.timer.context))
        if (useTimer.getState().timer.phase !== 'focus') t.selectPhase('focus')
      } else if (p.clearContext) t.setContext({ taskId: null, projectId: null, labelId: p.labelId ? String(p.labelId) : null, note: '' })
      else if (p.labelId) t.setContext({ labelId: String(p.labelId), taskId: null, projectId: null, note: t.timer.context.labelId === p.labelId && !t.timer.context.taskId ? t.timer.context.note : '' })
      if (p.minutes !== undefined) {
        t.selectPhase('focus')
        t.adjust(Number(p.minutes) * 60000 - useTimer.getState().timer.targetMs!)
      }
      t.start()
      navigate('#/focus')
      if (effectiveProfile) void updateSettings({ activeProfileId: effectiveProfile.id })
      return ok
    }
    case 'timer.pause':t.pause();return ok
    case 'timer.resume':t.start();return ok
    case 'timer.stop':t.stop({discard:p.discard===true});return ok
    case 'task.create': {
      if(!p.text){ui.newTask({plannedFor:p.plannedFor as string|null|undefined});return ok}
      const parsed=parseQuickAdd(String(p.text),todayKey()),labels=await db.labels.toArray(),subject=parsed.labelName?undefined:inferSubject(parsed.title,labels)
      let task
      try { task=await addFromQuickAdd(parsed,{labelId:subject?.id??null,...(p.plannedFor!==undefined?{plannedFor:p.plannedFor as string|null}:{})}) }
      catch(error) { if(error instanceof AmbiguousNameError)return {ok:false,code:'invalid-input',message:error.message};throw error }
      if(!task)return missing('Task title')
      toast({title:'Task added',body:task.title,tone:'success',action:{label:'Open',run:()=>{void executeAction('task.open',{taskId:task.id})}}});return ok
    }
    case 'task.open':case 'task.complete':case 'task.schedule': {
      const task=await db.tasks.get(String(p.taskId));if(!task)return missing('Task')
      if(id==='task.open')ui.openTask(task.id)
      else if(id==='task.complete'){if(task.done)return {ok:false,code:'unavailable',message:'This task is already complete'};const next=await completeTask(task);return {ok:true,createdTaskId:next?.id}}
      else await patch('tasks',task.id,{plannedFor:String(p.day)})
      return ok
    }
    case 'calendar.openDay':navigate(`#/calendar?date=${p.day}`);return ok
    case 'atlas.open':navigate('#/atlas');return ok
    case 'atlas.openPlace':case 'atlas.reviewPlace':case 'pyq.reviewForPlace': {
      const {loadAtlas}=await import('@/atlas/data');const atlas=await loadAtlas()
      if(p.placeId&&!atlas.byId.has(String(p.placeId)))return missing('Place')
      if(id==='pyq.reviewForPlace')navigate(`#/atlas?questions=1&${query(p)}`)
      else navigate(`#/atlas?${query({place:p.placeId,...(id==='atlas.reviewPlace'?{test:p.placeId}:{})})}`)
      return ok
    }
    case 'atlas.search':navigate(`#/atlas?search=${encodeURIComponent(String(p.query))}`);return ok
    case 'atlas.startExpedition': {
      const {loadAtlas}=await import('@/atlas/data'),atlas=await loadAtlas()
      if(!atlas.expedition(String(p.expeditionId)))return missing('Expedition')
      await startExpedition(String(p.expeditionId));navigate('#/atlas?expeditions=1');return ok
    }
    case 'atlas.continueExpedition':navigate(c.expedition?.blocked?'#/atlas?expeditions=1':c.expedition?.nextPlaceId?`#/atlas?place=${c.expedition.nextPlaceId}`:'#/atlas?expeditions=1');return ok
    case 'pyq.open': {
      const {getPyqCatalog,getPyqQuestion}=await import('@/atlas/pyq/catalog');const {manifest}=await getPyqCatalog()
      await getPyqQuestion(String(p.questionId),manifest);navigate(`#/atlas?pyq=${encodeURIComponent(String(p.questionId))}`);return ok
    }
    case 'review.startDue':navigate('#/atlas?review=1');return ok
    case 'settings.open':navigate('#/settings');return ok
    case 'navigation.open':navigate(`#/${p.route}${p.view?`?view=${encodeURIComponent(String(p.view))}`:''}`);return ok
    case 'appearance.theme':await updateSettings({theme:p.theme as 'light'|'dark'|'system'});return ok
    case 'ui.open': {
      if(p.surface==='sidebar')ui.toggleSidebar()
      else if(p.surface==='atlasFullscreen')window.dispatchEvent(new CustomEvent('tars:atlas-fullscreen'))
      else if(p.surface==='immersive'){navigate('#/focus');ui.set({immersive:true});void enterFullscreen()}
      else ui.set({[({context:'contextOpen',sounds:'soundOpen',profiles:'profileOpen',shortcuts:'shortcutsOpen',capture:'captureOpen'} as Record<string,string>)[String(p.surface)]]:true})
      return ok
    }
  }
})
export async function executeAction<K extends ActionId>(id:K,input:ActionInputs[K]) {
  const result=await registry.execute(id,input)
  if(!result.ok)toast({title:result.message??'Action unavailable'})
  return result
}
/** Open-language clients may call this after proposing a structured action. The same validator always runs. */
export const executeProposal=(id:string,input:unknown)=>registry.execute(id,input)
