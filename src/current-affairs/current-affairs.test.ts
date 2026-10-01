/** Targeted boundaries: real parser shapes, CSE evidence/noise, and conservative event identity. */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { canonicalUrl, cleanText, dedupeUrls, parseFeed } from './feed'
import { collectFeeds } from './gateway'
import { NEWS_SOURCES } from './sources'
import { classify } from './relevance'
import { clusterItems } from './cluster'
import { referenceLinks } from './static-links'
import type { ClassifiedItem, NewsItem, RelevanceIndex } from './types'
const source = NEWS_SOURCES[1]
const index: RelevanceIndex = JSON.parse(readFileSync(new URL('../../public/current-affairs/v1/relevance-index.json', import.meta.url), 'utf8'))
const rss = '<rss version="2.0"><channel><item><title>RBI &amp; regulation</title><link>https://example.org/a?utm_source=x&amp;id=7</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Banking &amp; credit &#8211; rules</p>]]></description><content:encoded>FULL BODY MUST NOT SHIP</content:encoded></item></channel></rss>'
const item = (title: string, overrides: Partial<NewsItem> = {}): NewsItem => ({ title, description: '', publisher: 'Indian Express', section: 'Explained', sourceId: 'ie-explained', url: 'https://example.org/' + encodeURIComponent(title), publishedAt: '2026-10-01T10:00:00Z', ...overrides })
const classified = (title: string, overrides: Partial<NewsItem> = {}): ClassifiedItem => { const row = item(title, overrides); return { ...row, relevance: classify(row, index) } }
describe('RSS and Atom gateway', () => {
  it('normalizes RSS metadata without full article content', () => {
    const rows = parseFeed(rss, source)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: 'RBI & regulation', url: 'https://example.org/a?id=7', description: 'Banking & credit – rules', publishedAt: '2026-10-01T10:00:00.000Z' })
    expect(JSON.stringify(rows)).not.toContain('FULL BODY')
  })
  it('reads namespaced Atom alternate links and summary without content fallback', () => {
    const rows = parseFeed('<atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:title>Space mission</atom:title><atom:link rel="self" href="https://example.org/self"/><atom:link rel="alternate" href="https://example.org/mission"/><atom:updated>2026-10-01T12:00:00Z</atom:updated><atom:summary>&lt;p&gt;New &amp; useful&lt;/p&gt;</atom:summary><atom:content>FULL BODY</atom:content></atom:entry></atom:feed>', source)
    expect(rows[0]).toMatchObject({ title: 'Space mission', url: 'https://example.org/mission', description: 'New & useful', publishedAt: '2026-10-01T12:00:00.000Z' })
  })
  it('strips markup/scripts, normal entities and numeric Unicode safely', () => {
    expect(cleanText('<script>bad()</script><p>&ldquo;RBI&rdquo;&nbsp;&amp; &#x1f30d;</p>')).toBe('“RBI” & 🌍')
    expect(cleanText('&#999999999;')).toBe('')
  })
  it('rejects malformed feeds, DTDs and unsafe links', () => {
    expect(() => parseFeed('<rss><channel></rss>', source)).toThrow()
    expect(() => parseFeed('<!DOCTYPE rss><rss><channel/></rss>', source)).toThrow()
    expect(canonicalUrl('javascript:alert(1)')).toBeNull()
    expect(canonicalUrl('https://user:secret@example.com/')).toBeNull()
  })
  it('deduplicates canonical URLs and retains identity query parameters', () => {
    const rows = dedupeUrls([item('A', { url: 'https://example.org/a?utm_source=x&id=7#tracking' }), item('B', { url: 'https://example.org/a?id=7' }), item('C', { url: 'https://example.org/a?id=8' })])
    expect(rows.map(r => r.url)).toEqual(['https://example.org/a?id=7', 'https://example.org/a?id=8'])
  })
  it('isolates malformed/failed publishers and never fetches disabled feeds', async () => {
    const sources = [source, { ...source, id: 'bad', feedUrl: 'https://example.org/bad' }, { ...source, id: 'disabled', enabled: false }]
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => new Response(url === source.feedUrl ? rss : '<rss><channel></rss>'))
    const data = await collectFeeds(fetcher, sources, 0)
    expect(data.items).toHaveLength(1)
    expect(data.sources.map(s => s.status)).toEqual(['ok', 'failed'])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(data.fetchedAt).toBe('1970-01-01T00:00:00.000Z')
  })
  it('times out an individual publisher without suppressing a successful one', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
        if (url === source.feedUrl) return new Response(rss)
        return new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout'))))
      })
      const promise = collectFeeds(fetcher, [source, { ...source, id: 'slow', feedUrl: 'https://example.org/slow' }])
      await vi.advanceTimersByTimeAsync(10001)
      expect((await promise).sources.map(s => s.status)).toEqual(['ok', 'failed'])
    } finally { vi.useRealTimers() }
  })
})
describe('CSE relevance', () => {
  it.each(['RBI revises banking regulation', 'Supreme Court ruling on constitutional fundamental rights', 'Ramsar protected area conservation expands', 'Government scheme expands Ayushman Bharat coverage', 'New international treaty on nuclear security', 'ISRO launches important lunar space mission'])('accepts %s with subject and exam demand', title => {
    const result = classify(item(title), index)
    expect(result.accepted).toBe(true)
    expect(result.subjects.length).toBeGreaterThan(0)
    expect(['prelims', 'mains', 'both']).toContain(result.exam)
    expect(result.staticAnchors.length).toBeGreaterThan(0)
  })
  it.each(['Cricket score: India wins', 'Film release breaks box office record', 'Celebrity wedding goes viral', 'Police arrested suspect in routine murder', 'Horoscope: your lucky day', 'New smartphone product launch', 'RBI news: shares rise after stock price rally'])('rejects %s', title => expect(classify(item(title), index).accepted).toBe(false))
  it('does not let publisher/section alone determine acceptance or teaser override noise', () => {
    expect(classify(item('Today’s top news', { publisher: 'RBI', section: 'Economy' }), index).accepted).toBe(false)
    expect(classify(item('Celebrity arrested', { description: 'Supreme Court constitutional ruling' }), index).accepted).toBe(false)
    expect(classify(item('Supreme Court dismisses plea over frozen bank accounts', { description: 'Today’s court ruling' }), index).accepted).toBe(false)
    expect(classify(item('UPSC Mains Answer Practice: Fiscal Federalism'), index).accepted).toBe(false)
  })
  it('runtime contains compact CSE provenance, counts and taxonomy anchors', () => {
    expect(index.provenance.prelimsQuestions).toBe(3896)
    expect(index.provenance.mainsQuestions).toBe(1130)
    expect(index.signals.some(s => s.taxonomyIds.length > 0)).toBe(true)
    expect(index.signals.every(s => s.prelimsDemand || s.mainsDemand)).toBe(true)
    expect(JSON.stringify(index)).not.toContain('question_text')
  })
})
describe('event identity and exact references', () => {
  it('merges matching coverage and prefers official sources, keeping every link', () => {
    const rows = [classified('RBI revises banking liquidity regulation framework'), classified('RBI revises banking liquidity regulation framework today', { url: 'https://rbi.org.in/1', sourceId: 'rbi-notifications', publisher: 'RBI' })]
    const events = clusterItems(rows)
    expect(events).toHaveLength(1)
    expect(events[0].members).toHaveLength(2)
    expect(events[0].primary.publisher).toBe('RBI')
  })
  it('keeps distinct RBI and Supreme Court developments apart', () => {
    expect(clusterItems([classified('RBI revises banking liquidity regulation framework'), classified('RBI monetary policy holds repo rate'), classified('Supreme Court constitutional ruling on federalism'), classified('Supreme Court ruling protects fundamental rights')])).toHaveLength(4)
  })
  it('does not merge repeated titles across dates or undated stories', () => {
    const a = classified('RBI revises banking regulation')
    expect(clusterItems([a, classified(a.title, { publishedAt: '2026-09-01T10:00:00Z', url: 'https://example.org/old' }), classified(a.title, { publishedAt: null, url: 'https://example.org/undated' })])).toHaveLength(3)
  })
  it('uses exact known official URLs and nothing for unknown concepts', () => {
    expect(referenceLinks('RBI')[0].url).toBe('https://www.rbi.org.in/')
    expect(referenceLinks('Unknown <entity>')).toEqual([])
    expect(referenceLinks('toString')).toEqual([])
  })
})
