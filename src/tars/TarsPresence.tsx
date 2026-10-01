/** Quiet command access and a few actionable moments; no chat panel or generated advice. */
import { Command, ArrowUpRight } from 'lucide-react'
import { useUi } from '@/app/ui-store'
import { suggestActions } from './context'
import { useTarsContext } from './useContext'
import { executeProposal } from './runtime'
import { toast } from '@/ui/toast'
import { cn } from '@/lib/cn'
export function TarsPresence() {
  const c=useTarsContext(), immersive=useUi(s=>s.immersive), full=useUi(s=>s.atlasFullscreen)
  const suggestions=suggestActions(c)
  if(immersive||full)return null
  return <aside aria-label="Tars context" className={cn('tars-presence fixed z-[29] flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full bg-surface px-1.5 py-1.5 shadow-dialog', c.route==='atlas' ? 'top-[calc(220px+env(safe-area-inset-top))] left-3 lg:left-[calc(var(--sidebar-w)+12px)]' : 'right-3 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:right-5 lg:bottom-5')}>
    <button type="button" aria-label="Ask Tars" onClick={()=>useUi.getState().set({paletteOpen:true})} className="press flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-soft"><Command className="size-4"/><span>Tars</span><kbd className="hidden text-[10px] font-medium text-ink-3 sm:inline">⌘K</kbd></button>
    {c.route!=='atlas'&&suggestions[0]&&<button type="button" onClick={async()=>{const s=suggestions[0],r=await executeProposal(s.action,s.input);if(!r.ok)toast({title:r.message??'Action unavailable'})}} className="press hidden h-10 max-w-64 items-center gap-2 rounded-full px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2 lg:flex"><span className="truncate">{suggestions[0].title}</span><ArrowUpRight className="size-3.5 shrink-0"/></button>}
  </aside>
}
