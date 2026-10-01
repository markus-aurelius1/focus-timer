/** Conservative natural commands produce structured proposals. Ambiguous names remain search results. */
import type { Label } from '@/data/types'
import type { Place } from '@/atlas/types'
import type { ActionId, ActionInputs } from './registry'
import type { TarsContext } from './context'
import { addDaysKey } from '@/lib/time'
export interface Intent { action:ActionId; input:ActionInputs[ActionId]; title:string }
export const normalizeName=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
/** Unrecognized control language stays a search; it must never capture a task by default. */
export const isControlRequest=(text:string)=>/^(?:add|create|start|pause|resume|stop|continue|review|show|open|find|plan|schedule|complete|delete|set|change|turn)\b/i.test(text.trim())
/** An unresolved exact place name needs an explicit choice, including in the palette. */
export function ambiguousPlaceRequest(text:string,places:Place[]) {
  const open=text.trim().match(/^(?:open|show|find)\s+(.+)$/i)
  if(!open)return false
  const name=normalizeName(open[1])
  return places.filter(p=>[p.id,p.name,...(p.aka??[])].some(alias=>normalizeName(alias)===name)).length>1
}
export function parseIntent(text:string,c:TarsContext,labels:Label[]=[],places:Place[]=[]):Intent|null {
  const q=text.trim(), n=normalizeName(q)
  const capture=q.match(/^(?:add|create)\s+(?:a\s+)?task\s*:?\s+(.+)$/i)
  if(capture)return {action:'task.create',input:{text:capture[1]},title:`Add task “${capture[1]}”`}
  const timer=q.match(/^start\s+(\d+)\s*(?:minutes?|mins?|m)(?:\s+(?:of|on|for)\s+(.+))?$/i)
  if(timer){const minutes=Number(timer[1]);if(minutes<1||minutes>480)return null;const subject=timer[2]?.trim();const matches=labels.filter(l=>!l.archived&&normalizeName(l.name)===normalizeName(subject??''));if(subject&&matches.length!==1)return null;return {action:'timer.start',input:{minutes,...(matches[0]?{labelId:matches[0].id}:{})},title:`Start ${minutes} minutes${subject?` of ${matches[0].name}`:''}`}}
  if(/^(?:continue|resume) (?:my |the )?expedition$/.test(n))return {action:'atlas.continueExpedition',input:{},title:'Continue my expedition'}
  if(/^review (?:places |atlas )?due(?: today)?$/.test(n)||n==='review places due today')return {action:'review.startDue',input:{},title:'Review places due today'}
  if(n==='open my next task'||n==='open next task'){const task=c.plan[0];return task?{action:'task.open',input:{taskId:task.id},title:`Open ${task.title}`}:null}
  if(n==='plan tomorrow')return {action:'calendar.openDay',input:{day:addDaysKey(c.today,1)},title:'Plan tomorrow'}
  const pyq=n.match(/^show (cse|pcs|cds) questions(?: for (.+))?$/)
  if(pyq){const kinds:Record<string,string>={straits:'strait',strait:'strait',rivers:'river',parks:'park',islands:'island',passes:'pass',cities:'city',lakes:'lake',countries:'country',states:'state'};if(pyq[2]&&!kinds[pyq[2]])return null;return {action:'pyq.reviewForPlace',input:{family:pyq[1].toUpperCase() as 'CSE'|'PCS'|'CDS',...(pyq[2]?{kind:kinds[pyq[2]]}:{})},title:`Show ${pyq[1].toUpperCase()} questions${pyq[2]?` for ${pyq[2]}`:''}`}}
  const year=n.match(/^show places from (\d{4}) (cse|pcs|cds)$/)
  if(year)return {action:'pyq.reviewForPlace',input:{year:Number(year[1]),family:year[2].toUpperCase() as 'CSE'|'PCS'|'CDS',mode:'places'},title:`Places from ${year[1]} ${year[2].toUpperCase()}`}
  const open=q.match(/^(?:open|show|find)\s+(.+)$/i)
  if(open){const name=normalizeName(open[1]);const matches=places.filter(p=>[p.id,p.name,...(p.aka??[])].some(alias=>normalizeName(alias)===name));if(matches.length===1)return {action:'atlas.openPlace',input:{placeId:matches[0].id},title:`Open ${matches[0].name}`}}
  return null
}
export const searchScore=(text:string,query:string)=>{
  const t=normalizeName(text),words=normalizeName(query).split(' ').filter(Boolean)
  if(!words.length)return 0
  if(words.some(w=>!t.includes(w)))return 0
  return words.reduce((s,w)=>s+(t===w?8:t.startsWith(w)?4:t.includes(' '+w)?2:1),0)
}
