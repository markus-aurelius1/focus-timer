/**
 * YouTube / YouTube Music support through official mechanisms only:
 * the embeddable IFrame player for videos and playlists, and plain links that
 * open the YouTube / YouTube Music apps. Nothing here attempts background or
 * ad-free playback – that remains a YouTube Premium feature in YouTube's apps.
 */
import type { PlaylistProvider } from '@/data/types'

export interface ParsedMedia {
  provider: PlaylistProvider
  videoId: string | null
  listId: string | null
  embeddable: boolean
}

export function parseMediaUrl(raw: string): ParsedMedia | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^www\.|^m\./, '')
  const listId = url.searchParams.get('list')
  const valid = (id: string | null) => (id && /^[\w-]{6,64}$/.test(id) ? id : null)

  if (host === 'youtu.be') {
    const videoId = valid(url.pathname.slice(1))
    return { provider: 'youtube', videoId, listId: valid(listId), embeddable: !!videoId }
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let videoId = valid(url.searchParams.get('v'))
    const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)
    if (!videoId && m) videoId = valid(m[1])
    const list = valid(listId)
    return { provider: 'youtube', videoId, listId: list, embeddable: !!(videoId || list) }
  }
  if (host === 'music.youtube.com') {
    // YouTube Music has no embeddable player of its own. Plain video ids can still be
    // played in the standard YouTube embed; otherwise we open the app.
    const videoId = valid(url.searchParams.get('v'))
    const list = valid(listId)
    return { provider: 'youtube-music', videoId, listId: list, embeddable: !!videoId }
  }
  if (host.endsWith('spotify.com')) return { provider: 'spotify', videoId: null, listId: null, embeddable: false }
  return { provider: 'link', videoId: null, listId: null, embeddable: false }
}

export function embedUrl(m: ParsedMedia, origin = typeof location !== 'undefined' ? location.origin : ''): string | null {
  if (!m.embeddable) return null
  const params = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1', enablejsapi: '1' })
  if (origin.startsWith('http')) params.set('origin', origin)
  if (m.videoId) {
    if (m.listId) params.set('list', m.listId)
    return `https://www.youtube-nocookie.com/embed/${m.videoId}?${params}`
  }
  if (m.listId) {
    params.set('list', m.listId)
    return `https://www.youtube-nocookie.com/embed/videoseries?${params}`
  }
  return null
}

export function providerName(p: PlaylistProvider): string {
  return { youtube: 'YouTube', 'youtube-music': 'YouTube Music', spotify: 'Spotify', link: 'Link' }[p]
}

/** Send a command to an embedded player (IFrame API postMessage protocol). */
export function playerCommand(frame: HTMLIFrameElement | null, func: 'playVideo' | 'pauseVideo' | 'stopVideo') {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')
}

export const SUGGESTED_STREAMS: Array<{ title: string; url: string }> = [
  { title: 'Lofi hip hop radio – beats to relax/study to', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { title: 'Calm piano for studying', url: 'https://www.youtube.com/results?search_query=calm+piano+study+music' },
]
