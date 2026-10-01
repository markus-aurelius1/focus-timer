/** Search, deterministic intents and contextual ranking all produce registry actions. */
import { useMemo } from 'react'
import { CalendarDays, CheckCircle2, Expand, Headphones, Keyboard, ListTodo, Map as MapIcon, Moon, PanelLeft, Pause, Play, Plus, Settings2, SlidersHorizontal, Square, Sun, SunMoon, Target, Timer, type LucideIcon } from 'lucide-react'
import { useLabels, useOpenTasks, useSettings } from '@/data/hooks'
import { useAtlas } from '@/atlas/data'
import { useUi } from '@/app/ui-store'
import { todayKey } from '@/lib/time'
import { parseQuickAdd } from '@/planner/quickAdd'
import { toast } from '@/ui/toast'
import { ambiguousPlaceRequest, isControlRequest, parseIntent, searchScore } from './intents'
import { suggestActions } from './context'
import { actions, type ActionId } from './registry'
import { executeProposal } from './runtime'
import { useTarsContext } from './useContext'
export interface Command { id:string;section:string;label:string;hint?:string;keywords?:string;icon:LucideIcon;keys?:string;requiresChoice?:boolean;run:()=>void|Promise<void> }
export function useCommands(query:string):Command[] {
  const context=useTarsContext(),tasks=useOpenTasks(),labels=useLabels(),settings=useSettings(),atlas=useAtlas(),collapsed=useUi(s=>s.sidebarCollapsed)
  return useMemo(()=>{
    const command=(id:string,label:string,action:ActionId,input:Record<string,unknown>={},section='Go to',icon:LucideIcon=Target,hint?:string,keywords?:string):Command=>({id,label,section,icon,hint,keywords,run:async()=>{const r=await executeProposal(action,input);if(!r.ok)toast({title:r.message??'Action unavailable'})}})
    const t=context.timer,today=todayKey()
    const base:Command[]=[
      command('timer',t.status==='running'?'Pause timer':t.status==='paused'?'Resume timer':'Start focus',t.status==='running'?'timer.pause':t.status==='paused'?'timer.resume':'timer.start',{},'Timer',t.status==='running'?Pause:Play,undefined,t.status==='running'?'pause timer':t.status==='paused'?'resume timer':'start focus timer pomodoro begin'),
      ...(t.status!=='idle'?[command('stop','Stop timer','timer.stop',{},'Timer',Square)]:[]),
      command('immersive','Immersive focus','ui.open',{surface:'immersive'},'Timer',Expand,'Full-screen, distraction-free clock','fullscreen zen'),
      command('context','What are you working on?','ui.open',{surface:'context'},'Timer',Target,'Pick a subject, task and intention'),
      command('sounds','Sounds','ui.open',{surface:'sounds'},'Timer',Headphones,'Soundscapes and music','ambient rain noise music'),
      command('profiles','Timer profiles','ui.open',{surface:'profiles'},'Timer',SlidersHorizontal,'Pomodoro, countdown, stopwatch'),
      command('new-task','New task…','task.create',{plannedFor:today},'Tasks',Plus,'With subject, tags, dates and more','add create todo'),
      command('go-focus','Focus','navigation.open',{route:'focus'},'Go to',Timer),
      ...['today','upcoming','inbox','projects','habits'].map(view=>command('go-'+view,'Tasks · '+view[0].toUpperCase()+view.slice(1),'navigation.open',{route:'tasks',view},'Go to',ListTodo)),
      command('go-atlas','Atlas','atlas.open',{},'Go to',MapIcon,'Freely explore every place','map geography'),
      command('go-pyq','Previous questions','pyq.reviewForPlace',{},'Atlas',CheckCircle2,'149 curated canonical questions','pyq cse pcs cds'),
      command('go-calendar','Calendar','calendar.openDay',{day:today},'Go to',CalendarDays,'Plan your time','schedule events'),
      command('go-insights','Insights','navigation.open',{route:'insights'}),command('go-news','Current Affairs','navigation.open',{route:'current-affairs'},'Go to',ListTodo,'News · original links','news current affairs'),command('go-settings','Settings','settings.open',{},'Go to',Settings2,'Preferences'),
      ...(context.route==='atlas'?[command('atlas-full','Full-screen map','ui.open',{surface:'atlasFullscreen'},'Atlas',Expand)]:[]),
      command('theme-light','Theme: Paper (light)','appearance.theme',{theme:'light'},'Appearance',Sun,undefined,'light mode theme'),
      command('theme-dark','Theme: Night (dark)','appearance.theme',{theme:'dark'},'Appearance',Moon,undefined,'dark mode theme'),
      command('theme-auto','Theme: Auto','appearance.theme',{theme:'system'},'Appearance',SunMoon,'Follow the system'),
      command('sidebar',collapsed?'Expand sidebar':'Collapse sidebar','ui.open',{surface:'sidebar'},'Appearance',PanelLeft),
      command('shortcuts','Keyboard shortcuts','ui.open',{surface:'shortcuts'},'Help',Keyboard),
    ]
    const q=query.trim()
    if(!q)return [...suggestActions(context).map((s,i)=>command('context-'+i,s.title,s.action as ActionId,s.input,'Next',Target)),...base.filter(c=>c.section!=='Appearance'||c.id==='sidebar'||c.id==='theme-'+(settings.theme==='dark'?'light':'dark'))]
    const intent=parseIntent(q,context,labels,atlas?.places??[])
    const ambiguousPlace=!intent&&ambiguousPlaceRequest(q,atlas?.places??[])
    const proposal=intent&&actions.find(a=>a.id===intent.action)?.availability(context)?[command('intent',intent.title,intent.action,intent.input as Record<string,unknown>,'Command',Target,'Run this action')]:[]
    const search=q.replace(/^(?:open|show|find)\s+/i,'')
    const placeHits=(atlas?.places??[]).map(p=>({p,s:searchScore([p.name,...(p.aka??[])].join(' '),search)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.p.id.localeCompare(b.p.id)).slice(0,6).map(({p})=>command('place-'+p.id,p.name,'atlas.openPlace',{placeId:p.id},'Places',MapIcon,p.subtitle??p.kind))
    const taskHits=tasks.map(task=>({task,s:searchScore(task.title,search)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.task.id.localeCompare(b.task.id)).slice(0,5).map(({task})=>command('task-'+task.id,task.title,'task.open',{taskId:task.id},'Tasks',CheckCircle2,'Open task'))
    const matches=base.map(c=>({c,s:searchScore(c.label+' '+(c.keywords??''),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.c)
    const parsed=parseQuickAdd(q,today)
    // Failed control requests should not accidentally become captured tasks.
    const controlRequest=isControlRequest(q)
    const add=parsed.title&&!controlRequest?[command('add',`Add task “${parsed.title}”`,'task.create',{text:q},'Create',Plus,'Capture with dates, subjects and tags')]:[]
    return [...proposal,...placeHits,...taskHits,...matches,...add].map(c=>ambiguousPlace?{...c,requiresChoice:true,section:c.section==='Places'?'Choose a place':c.section}:c)
  },[query,context,tasks,labels,settings.theme,atlas,collapsed])
}
