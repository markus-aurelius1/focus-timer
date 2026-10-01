/** Home context stays factual and concise, with one immediate continuation. */
import { useTarsContext } from './useContext'
import { executeAction } from './runtime'
export function ContextMoment() {
  const c=useTarsContext()
  if(c.timer.status!=='idle'||!c.plan.length&&!c.dueReviews.length)return null
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 text-xs text-ink-2" aria-label="Today’s study context"><span>{c.plan.length} planned tasks · {c.dueReviews.length} Atlas reviews due</span>{c.timer.status==='idle'&&c.plan[0]?<button type="button" className="min-h-8 font-bold text-accent hover:underline" onClick={()=>{void executeAction('timer.start',{taskId:c.plan[0].id})}}>Start next</button>:c.dueReviews.length>0?<button type="button" className="min-h-8 font-bold text-accent hover:underline" onClick={()=>{void executeAction('review.startDue',{})}}>Review</button>:null}</div>
}
