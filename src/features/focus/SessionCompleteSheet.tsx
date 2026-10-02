import { useRoute } from '@/app/router'
import { Sheet } from '@/ui/Sheet'
import { SessionCompleteCard, useLastSession } from './SessionComplete'

/**
 * The session-complete card as a dialog, for when the session ended while you
 * were somewhere else in the app. On the Focus screen it appears in place of
 * the clock instead (FocusScreen.tsx), so nothing modal interrupts the flow
 * from a session into its break.
 */
export function SessionCompleteSheet() {
  const view = useLastSession()
  const onFocus = useRoute().name === 'focus'
  const open = !!view && !onFocus
  return (
    <Sheet open={open} onClose={() => view?.close()} size="sm" bare label={view?.session.completed === false ? 'Session saved' : 'Session complete'}>
      {view && !onFocus ? <SessionCompleteCard view={view} /> : null}
    </Sheet>
  )
}
