/** Conservative CSE acceptance needs a supported concept and substantive news demand, never publisher keywords alone. */
import type { NewsItem, Relevance, RelevanceIndex } from './types'
export const normalize = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const negative = /\b(?:cricket|ipl|football|goal scorer|match score|wins? by \d|box office|film release|movie release|celebrity|actor|actress|horoscope|zodiac|viral video|murder|robbery|rape|arrested|road accident|car crash|smartphone|iphone|earbuds|smartwatch|stock price|share price|shares (?:rise|fall|jump|surge)|stocks (?:rise|fall|jump|surge)|sensex|nifty|answer practice|quiz|extension of period)\b/i
const policy = /\b(?:constitution(?:al)?|fundamental rights|judg(?:e)?ment|ruling|regulat\w*|framework|policy|scheme|treaty|agreement|convention|bill|act|rules?|conservation|protected|ramsar|endangered|biodiversity|climate|emissions|mission|launch|space|discovery|discover\w*|genome|quantum|inflation|budget|tax|agriculture|report|index|indices|reform|security|monsoon|earthquake|geograph\w*|trade|econom\w*|poverty|development|commission|heritage|parliament|federal\w*|welfare|sanctuary|tiger reserve|national park)\b/i
const unique = (s: string[]) => [...new Set(s)]
export function classify(item: Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section'>, index: RelevanceIndex): Relevance {
  const title = ` ${normalize(item.title)} `, text = ` ${normalize(item.title + ' ' + item.description)} `
  const matches = index.signals.filter(s => s.aliases.some(a => text.includes(` ${normalize(a)} `)))
  const strong = matches.filter(s => s.aliases.some(a => title.includes(` ${normalize(a)} `)))
  const courtOnly = strong.length > 0 && strong.every(s => s.concept === 'Supreme Court') && !/\b(?:constitution\w*|fundamental|rights|landmark|federal\w*|article \d+|law|act|rules?|election|parliament)\b/i.test(item.title)
  const noise = negative.test(item.title) || courtOnly, substantive = policy.test(item.title + ' ' + item.description)
  // A crime/price/consumer/sports headline remains noise even if its teaser mentions a regulator or court.
  const accepted = !noise && substantive && strong.length > 0 && matches.some(s => s.prelimsDemand || s.mainsDemand)
  const ordered = [...strong, ...matches.filter(s => !strong.includes(s))]
  const prelims = ordered.some(s => s.prelimsDemand), mains = ordered.some(s => s.mainsDemand)
  return { accepted, score: noise ? 0 : strong.length * 4 + matches.length + (substantive ? 2 : 0), exam: prelims && mains ? 'both' : mains ? 'mains' : 'prelims', subjects: unique(strong.map(s => s.subject)).slice(0, 2), topics: unique(strong.map(s => s.topic)).slice(0, 3), staticAnchors: unique(strong.map(s => s.concept)).slice(0, 3), signals: ordered.map(s => `${s.concept} · CSE P${s.prelimsCount}/M${s.mainsCount}`), ...(!accepted ? { rejectionReason: noise ? 'Noise headline' : !strong.length ? 'No supported headline concept' : 'No substantive syllabus demand' } : {}) }
}
