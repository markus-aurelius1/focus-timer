/** Complete-link clustering avoids transitive chain merges and shared-institution over-merging. */
import { normalize } from './relevance.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { ClassifiedItem, NewsEvent } from './types.ts'
const stop = new Set('the a an of to in on for and by with as is at from after over new says said india indian rbi supreme court government'.split(' '))
const tokens = (title: string) => new Set(normalize(title).split(' ').filter(t => t.length > 2 && !stop.has(t)))
export function sameEvent(a: ClassifiedItem, b: ClassifiedItem): boolean {
  if (normalize(a.title) === normalize(b.title)) return !!a.publishedAt && !!b.publishedAt && Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) <= 48 * 3600000
  if (!a.publishedAt || !b.publishedAt || Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) > 36 * 3600000) return false
  if (!a.relevance.staticAnchors.some(s => b.relevance.staticAnchors.includes(s))) return false
  const x = tokens(a.title), y = tokens(b.title), intersection = [...x].filter(t => y.has(t)).length
  return intersection >= 3 && intersection / new Set([...x, ...y]).size >= 0.6
}
const priority = (item: ClassifiedItem) => NEWS_SOURCES.find(s => s.id === item.sourceId)?.priority ?? 9
const orderSources = (a: ClassifiedItem, b: ClassifiedItem) => priority(a) - priority(b) || b.relevance.score - a.relevance.score || a.url.localeCompare(b.url)
export function clusterItems(items: ClassifiedItem[]): NewsEvent[] {
  const groups: ClassifiedItem[][] = []
  for (const item of items.filter(i => i.relevance.accepted).sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0) || a.url.localeCompare(b.url))) {
    const group = groups.find(g => g.every(other => sameEvent(item, other)))
    if (group) group.push(item); else groups.push([item])
  }
  return groups.map(members => { members.sort(orderSources); return { id: members.map(i => i.url).sort()[0], primary: members[0], members } })
}
