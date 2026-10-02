/** The only command execution boundary. Unknown, malformed or unavailable actions never reach runtime effects. */
import type { TarsContext } from './context'
export interface ActionInputs {
  'timer.start': { minutes?: number; labelId?: string; taskId?: string; clearContext?: boolean }
  'timer.pause': Record<string,never>
  'timer.resume': Record<string,never>
  'timer.stop': { discard?:boolean }
  'timer.linkTask': { taskId:string }
  'calendar.startBlock': { eventId:string }
  'task.revisePlace': { placeId:string }
  'task.create': { text?: string; plannedFor?: string | null }
  'task.open': { taskId: string }
  'task.complete': { taskId: string }
  'task.schedule': { taskId: string; day: string }
  'calendar.openDay': { day: string }
  'atlas.open': Record<string,never>
  'atlas.openPlace': { placeId: string }
  'atlas.search': { query: string }
  'atlas.startExpedition': { expeditionId: string }
  'atlas.continueExpedition': Record<string,never>
  'atlas.reviewPlace': { placeId: string }
  'pyq.open': { questionId: string }
  'pyq.reviewForPlace': { placeId?: string; family?: 'CSE' | 'PCS' | 'CDS'; year?: number; kind?: string; mode?: 'questions' | 'places' }
  'review.startDue': Record<string,never>
  'settings.open': Record<string,never>
  'navigation.open': { route: 'home' | 'focus' | 'tasks' | 'atlas' | 'calendar' | 'insights' | 'settings' | 'current-affairs' | 'notes'; view?: string }
  'appearance.theme': { theme: 'light' | 'dark' | 'system' }
  'ui.open': { surface: 'immersive' | 'context' | 'sounds' | 'profiles' | 'sidebar' | 'shortcuts' | 'atlasFullscreen' | 'capture' }
}
export type ActionId = keyof ActionInputs
export interface ActionResult { ok: boolean; message?: string; createdTaskId?:string; code?: 'unknown-action' | 'invalid-input' | 'unavailable' | 'failed' }
export interface TarsAction { id: ActionId; title: string; keywords: string[]; availability: (c:TarsContext)=>boolean }
const always = () => true
const titles: Record<ActionId,string> = {'timer.linkTask':'Track this task','calendar.startBlock':'Start focus block','task.revisePlace':'Create place revision task','timer.start':'Start focus','timer.pause':'Pause timer','timer.resume':'Resume timer','timer.stop':'Stop timer','task.create':'New task…','task.open':'Open task','task.complete':'Complete task','task.schedule':'Schedule task','calendar.openDay':'Open calendar day','atlas.open':'Atlas','atlas.openPlace':'Open place','atlas.search':'Search Atlas','atlas.startExpedition':'Start expedition','atlas.continueExpedition':'Continue my expedition','atlas.reviewPlace':'Test this place','pyq.open':'Open canonical PYQ','pyq.reviewForPlace':'Previous questions','review.startDue':'Review places due today','settings.open':'Settings','navigation.open':'Go to','appearance.theme':'Theme','ui.open':'Open controls'}
export const actions: TarsAction[] = (Object.keys(titles) as ActionId[]).map(id=>({id,title:titles[id],keywords:id.split('.'),availability:id==='timer.start'?c=>c.timer.status==='idle':id==='timer.pause'?c=>c.timer.status==='running':id==='timer.resume'?c=>c.timer.status==='paused':id==='timer.stop'?c=>c.timer.status!=='idle':id==='review.startDue'?c=>c.dueReviews.length>0:id==='atlas.continueExpedition'?c=>!!c.expedition:always}))
const fields: Record<ActionId,string[]> = {'timer.linkTask':['taskId'],'calendar.startBlock':['eventId'],'task.revisePlace':['placeId'],'timer.start':['minutes','labelId','taskId','clearContext'],'timer.pause':[],'timer.resume':[],'timer.stop':['discard'],'task.create':['text','plannedFor'],'task.open':['taskId'],'task.complete':['taskId'],'task.schedule':['taskId','day'],'calendar.openDay':['day'],'atlas.open':[],'atlas.openPlace':['placeId'],'atlas.search':['query'],'atlas.startExpedition':['expeditionId'],'atlas.continueExpedition':[],'atlas.reviewPlace':['placeId'],'pyq.open':['questionId'],'pyq.reviewForPlace':['placeId','family','year','kind','mode'],'review.startDue':[],'settings.open':[],'navigation.open':['route','view'],'appearance.theme':['theme'],'ui.open':['surface']}
const string = (v:unknown) => typeof v==='string' && !!v.trim() && v.length<=500
export const validDay = (v:unknown) => { if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const date=new Date(`${v}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v }
export function validateActionInput(id: ActionId, raw:unknown): boolean {
  if (!raw || typeof raw!=='object' || Array.isArray(raw) || ![Object.prototype,null].includes(Object.getPrototypeOf(raw))) return false
  const p=raw as Record<string,unknown>
  if (Object.keys(p).some(k=>!fields[id].includes(k))) return false
  if (Object.entries(p).some(([k,v])=> !['minutes','year','plannedFor','discard','clearContext'].includes(k) && !string(v))) return false
  if (p.clearContext!==undefined && typeof p.clearContext!=='boolean' || p.clearContext===true && p.taskId!==undefined) return false
  // A task owns its subject. Reject conflicting instructions rather than
  // silently ignoring one of the caller's identities.
  if (id==='timer.start' && p.taskId!==undefined && p.labelId!==undefined) return false
  if (p.discard!==undefined && typeof p.discard!=='boolean') return false
  if (p.minutes!==undefined && (typeof p.minutes!=='number' || !Number.isInteger(p.minutes) || p.minutes<1 || p.minutes>480)) return false
  if (p.year!==undefined && (typeof p.year!=='number' || !Number.isInteger(p.year) || p.year<1900 || p.year>2100)) return false
  if (p.day!==undefined && !validDay(p.day) || p.plannedFor!==undefined && p.plannedFor!==null && !validDay(p.plannedFor)) return false
  if (p.family!==undefined && !['CSE','PCS','CDS'].includes(p.family as string)) return false
  if (p.mode!==undefined && !['questions','places'].includes(p.mode as string)) return false
  if (id==='navigation.open' && !['home','focus','tasks','atlas','calendar','insights','settings','current-affairs','notes'].includes(p.route as string)) return false
  if (id==='appearance.theme' && !['light','dark','system'].includes(p.theme as string)) return false
  if (id==='ui.open' && !['immersive','context','sounds','profiles','sidebar','shortcuts','atlasFullscreen','capture'].includes(p.surface as string)) return false
  const required: Partial<Record<ActionId,string[]>> = {'timer.linkTask':['taskId'],'calendar.startBlock':['eventId'],'task.revisePlace':['placeId'],'task.open':['taskId'],'task.complete':['taskId'],'task.schedule':['taskId','day'],'calendar.openDay':['day'],'atlas.openPlace':['placeId'],'atlas.reviewPlace':['placeId'],'atlas.search':['query'],'atlas.startExpedition':['expeditionId'],'pyq.open':['questionId']}
  return (required[id] ?? []).every(k=>string(p[k]))
}
export function createActionRegistry(context:()=>TarsContext, run:(id:ActionId,input:Record<string,unknown>,context:TarsContext)=>Promise<ActionResult>|ActionResult) {
  const busy = new Set<string>()
  const guarded = new Set<ActionId>(['timer.start','task.complete','task.create','task.revisePlace','atlas.startExpedition'])
  return { actions, async execute(id:string,raw:unknown={}):Promise<ActionResult> {
    const action=actions.find(a=>a.id===id)
    if (!action) return {ok:false,code:'unknown-action',message:'Unknown action'}
    let key:string|undefined
    let ownsGuard=false
    try {
      if (!validateActionInput(action.id,raw)) return {ok:false,code:'invalid-input',message:'Check the action details'}
      const input = Object.fromEntries(Object.entries(raw as Record<string,unknown>))
      key = guarded.has(action.id) ? action.id + (action.id==='task.complete' ? ':'+input.taskId : '') : undefined
      if(key&&busy.has(key))return {ok:false,code:'unavailable',message:'This action is already in progress'}
      const c=context()
      if (!action.availability(c)) return {ok:false,code:'unavailable',message:'This action is unavailable right now'}
      if(key){busy.add(key);ownsGuard=true}
      return await run(action.id,input,c)
    } catch { return {ok:false,code:'failed',message:'The action couldn’t finish. Try again.'} }
    finally { if(key&&ownsGuard)busy.delete(key) }
  } }
}
