import { useMemo } from 'react'
import { useSessions } from '@/data/hooks'

/** Sessions and seconds logged against each task – the "actual" side of estimates. */
export function useTaskSessions() {
  const sessions = useSessions()
  return useMemo(() => {
    const counts = new Map<string, number>()
    const seconds = new Map<string, number>()
    for (const s of sessions) {
      if (!s.taskId) continue
      counts.set(s.taskId, (counts.get(s.taskId) ?? 0) + 1)
      seconds.set(s.taskId, (seconds.get(s.taskId) ?? 0) + s.duration)
    }
    return { count: (id: string) => counts.get(id) ?? 0, seconds: (id: string) => seconds.get(id) ?? 0 }
  }, [sessions])
}
