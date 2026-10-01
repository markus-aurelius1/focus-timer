/** Regression of the execution boundary, deterministic intents and history-derived context. */
import { describe,it,expect,vi } from 'vitest'
import { createTimer } from '@/timer/engine'
import { blankTask } from '@/planner/tasks'
import type { Label,Task,Session } from '@/data/types'
import { deriveContext,suggestActions } from './context'
import { createActionRegistry,validateActionInput,validDay,actions } from './registry'
import { ambiguousPlaceRequest, isControlRequest, parseIntent } from './intents'
import type { Place } from '@/atlas/types'
const timer=createTimer({mode:'pomodoro',focusMs:1500000,shortBreakMs:300000,longBreakMs:900000,longBreakEvery:4,autoStartBreaks:true,autoStartFocus:false})
const task=(id:string,plannedFor:string|null,priority:0|1|2|3=0):Task=>({...blankTask({title:id,plannedFor,priority}),id,createdAt:1,updatedAt:1})
const context=deriveContext({route:'focus',today:'2026-10-01',timer,tasks:[task('later','2026-10-02'),task('low','2026-10-01'),task('next','2026-10-01',3)],sessions:[],exploration:null})
const polity={id:'polity',name:'Polity',kind:'subject',color:'#fff',parentId:null,archived:false,order:0,createdAt:1,updatedAt:1} as Label
const nathu={id:'in.pass.nathu-la',name:'Nathu La',aka:['Nathula'],kind:'pass'} as Place
describe('Tars execution boundary',()=>{
  it('blocks malformed and unknown proposals before effects',async()=>{const run=vi.fn(()=>({ok:true}));const registry=createActionRegistry(()=>context,run);for(const [id,input] of [['unknown',{}],['timer.start',{minutes:0}],['timer.start',{minutes:NaN}],['timer.start',{minutes:25,sql:'erase'}],['task.open',{}],['timer.start',{clearContext:'yes'}],['timer.start',{taskId:'next',clearContext:true}],['appearance.theme',{theme:'neon'}],['task.schedule',{taskId:'next',day:'2026-02-30'}]] as const)expect((await registry.execute(id,input)).ok).toBe(false);expect(run).not.toHaveBeenCalled()})
  it('rechecks availability at execution time',async()=>{let c=context;const run=vi.fn(()=>({ok:true}));const registry=createActionRegistry(()=>c,run);expect((await registry.execute('timer.pause',{})).code).toBe('unavailable');c={...c,timer:{...c.timer,status:'running'}};expect((await registry.execute('timer.pause',{})).ok).toBe(true);expect((await registry.execute('timer.start',{})).code).toBe('unavailable');expect(run).toHaveBeenCalledTimes(1)})
  it('reports effect failures without claiming success',async()=>{const registry=createActionRegistry(()=>context,()=>{throw new Error('DB denied')});expect((await registry.execute('atlas.open',{})).code).toBe('failed')})
  it('prevents repeated asynchronous mutations and snapshots caller inputs',async()=>{let finish:()=>void=()=>{};let seen=0;const run=vi.fn(async(_id,input)=>{await new Promise<void>(r=>{finish=r});seen=input.minutes;return {ok:true}});const registry=createActionRegistry(()=>context,run),input={minutes:50};const first=registry.execute('timer.start',input);input.minutes=900;expect((await registry.execute('timer.start',{minutes:50})).code).toBe('unavailable');expect((await registry.execute('timer.start',{minutes:50})).code).toBe('unavailable');finish();expect((await first).ok).toBe(true);expect(seen).toBe(50);expect(run).toHaveBeenCalledTimes(1)})
  it('validates real calendar dates, durations and filters',()=>{expect(validDay('2024-02-29')).toBe(true);for(const d of ['2026-02-29','2026-13-01','hello'])expect(validDay(d)).toBe(false);expect(validateActionInput('timer.start',{minutes:480})).toBe(true);expect(validateActionInput('timer.start',{minutes:481})).toBe(false);expect(validateActionInput('pyq.reviewForPlace',{family:'UPSC-CSE'})).toBe(false);expect(validateActionInput('pyq.reviewForPlace',{family:'CSE',year:2024,mode:'places'})).toBe(true)})
  it('contains every required reusable action',()=>{for(const id of ['timer.start','timer.pause','timer.resume','timer.stop','task.create','task.open','task.complete','task.schedule','calendar.openDay','atlas.open','atlas.openPlace','atlas.search','atlas.startExpedition','atlas.continueExpedition','atlas.reviewPlace','pyq.open','pyq.reviewForPlace','review.startDue','settings.open'])expect(actions.some(a=>a.id===id)).toBe(true)})
})
describe('Tars intents and context',()=>{
  it('ambiguous exact place requests require a palette choice, while unique aliases do not',()=>{
    expect(ambiguousPlaceRequest('Open Nathula',[nathu])).toBe(false)
    expect(ambiguousPlaceRequest('Open Nathu La',[nathu,{...nathu,id:'other'}])).toBe(true)
    expect(ambiguousPlaceRequest('Nathu La',[nathu,{...nathu,id:'other'}])).toBe(false)
  })
  it('explicit capture safely accepts a task title beginning with a control verb',()=>{expect(parseIntent('Add task Review geography tomorrow',context)?.input).toEqual({text:'Review geography tomorrow'})})
  it('archived and duplicate subjects do not produce an arbitrary start',()=>{expect(parseIntent('Start 50 minutes of Polity',context,[{...polity,archived:true}])).toBeNull();expect(parseIntent('Start 50 minutes of Polity',context,[polity,{...polity,id:'duplicate'}])).toBeNull()})
  it('unsupported controls cannot fall through to task capture',()=>{
    for(const q of ['Start focus tomorrow','Open Atlantis','Pause Atlas','Delete all tasks','Schedule something someday','Start 50 minutes of Unknown']) expect(isControlRequest(q)).toBe(true)
    for(const q of ['Physics revision tomorrow','Essay draft today','Read chapter 4']) expect(isControlRequest(q)).toBe(false)
  })
  it('conflicting task/subject identities are rejected',()=>{expect(validateActionInput('timer.start',{taskId:'task',labelId:'subject'})).toBe(false)})
  it('parses the requested natural commands into typed actions',()=>{
    expect(parseIntent('Start 50 minutes of Polity',context,[polity])?.input).toEqual({minutes:50,labelId:'polity'})
    expect(parseIntent('Open Nathu La',context,[],[nathu])?.input).toEqual({placeId:nathu.id})
    expect(parseIntent('Show CSE questions for straits',context)?.input).toEqual({family:'CSE',kind:'strait'})
    expect(parseIntent('Show places from 2024 CSE',context)?.input).toEqual({family:'CSE',year:2024,mode:'places'})
    expect(parseIntent('Continue my expedition',context)?.action).toBe('atlas.continueExpedition')
    expect(parseIntent('Review places due today',context)?.action).toBe('review.startDue')
    expect(parseIntent('Open my next task',context)?.input).toEqual({taskId:'next'})
    expect(parseIntent('Plan tomorrow',context)?.input).toEqual({day:'2026-10-02'})
  })
  it('does not guess ambiguous names, absent subjects or unsupported geography',()=>{expect(parseIntent('Open Nathu La',context,[],[nathu,{...nathu,id:'other'}])).toBeNull();expect(parseIntent('Start 50 minutes of Polity',context,[])).toBeNull();expect(parseIntent('Show CSE questions for legislatures',context)).toBeNull();expect(parseIntent('Start 900 minutes of Polity',context,[polity])).toBeNull()})
  it('derives the plan in priority order without mutating inputs',()=>{expect(context.plan.map(t=>t.id)).toEqual(['next','low']);expect(deriveContext({route:'focus',today:context.today,timer,tasks:context.plan,sessions:[],exploration:null})).toEqual(context);expect(suggestActions(context)[0].input).toEqual({taskId:'next'})})
  it('only exposes selection on Atlas and never grants progress from viewing',()=>{const c=deriveContext({route:'focus',today:context.today,timer,tasks:[],sessions:[],exploration:null,selectedPlace:nathu.id,selectedPyq:'q'});expect(c.selectedPlace).toBeNull();expect(c.selectedPyq).toBeNull();expect(c.recentFocus.placesReached).toBe(0)})
  it('focus totals are recomputed from durable sessions, independent of live ticks',()=>{const s={id:'s',date:context.today,duration:2520,startedAt:1,endedAt:2520001} as Session;const c=deriveContext({route:'focus',today:context.today,timer,tasks:[],sessions:[s],exploration:null});expect(c.recentFocus.secondsToday).toBe(2520);expect(c.recentFocus.lastSession?.id).toBe('s')})
})
