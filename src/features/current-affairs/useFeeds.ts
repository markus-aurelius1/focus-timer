/** Preserves Job 5 feed refresh and successful-response Workbox/CacheStorage fallback. */
import { useCallback, useEffect, useState } from 'react'
import { useOnline } from '@/lib/useOnline'
import { canonicalUrl } from '@/current-affairs/feed'
import type { FeedResponse, RelevanceIndex } from '@/current-affairs/types'
const endpoint = '/api/current-affairs'
export function relativeAge(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`
}
function validResponse(data: FeedResponse) {
  return data?.version === 1 && Number.isFinite(Date.parse(data.fetchedAt)) && Array.isArray(data.items) && Array.isArray(data.sources) && data.items.every(i => typeof i.title === 'string' && typeof i.description === 'string' && typeof i.publisher === 'string' && typeof i.section === 'string' && typeof i.sourceId === 'string' && typeof i.url === 'string' && !!canonicalUrl(i.url))
}
export function useFeeds() {
  const online = useOnline()
  const [data, setData] = useState<FeedResponse | null>(null), [index, setIndex] = useState<RelevanceIndex | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [cached, setCached] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(r => r + 1), [])
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(tick)
  }, [])
  useEffect(() => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 18000)
    let cancelled = false
    setLoading(true); setError('')
    const getData = async () => {
      try {
        const [asset, response] = await Promise.all([fetch(`${import.meta.env.BASE_URL}current-affairs/v1/relevance-index.json`, { signal: controller.signal }), fetch(endpoint, { signal: controller.signal, cache: 'no-cache' })])
        if (!asset.ok || !response.ok) throw new Error('News unavailable')
        const [nextIndex, nextData] = await Promise.all([asset.json() as Promise<RelevanceIndex>, response.json() as Promise<FeedResponse>])
        if (nextIndex.version !== 1 || !Array.isArray(nextIndex.signals) || !validResponse(nextData)) throw new Error('Invalid feed response')
        if (!cancelled) { setIndex(nextIndex); setData(nextData); setCached(response.headers.get('X-Tars-News-Cache') === 'hit') }
      } catch {
        // Workbox usually serves the offline response. CacheStorage is also a fallback on first mount after a failed revalidation.
        let restored = false
        try {
          const saved = await window.caches?.match(endpoint), asset = await fetch(`${import.meta.env.BASE_URL}current-affairs/v1/relevance-index.json`)
          if (saved && asset.ok) {
            const [nextData, nextIndex] = await Promise.all([saved.json() as Promise<FeedResponse>, asset.json() as Promise<RelevanceIndex>])
            if (validResponse(nextData) && nextIndex.version === 1 && Array.isArray(nextIndex.signals) && !cancelled) { setData(nextData); setIndex(nextIndex); setCached(true); restored = true }
          }
        } catch { /* No last successful response yet. */ }
        if (!cancelled) { setError(restored ? 'Refresh unavailable – showing the last successful feed.' : 'Couldn’t refresh Current Affairs. Try again when you’re online.'); setCached(true) }
      } finally { clearTimeout(timeout); if (!cancelled) { setLoading(false); setNow(Date.now()) } }
    }
    void getData()
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout) }
  }, [online, revision])
  return { data, index, loading, error, cached, now, online, reload }
}
