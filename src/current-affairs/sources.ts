/** Small allowlist; enabling a publisher requires a successful real RSS check. Verified 2026-10-01. */
import type { NewsSource } from './types.ts'
const source = (id: string, publisher: string, feedUrl: string, kind: NewsSource['kind'], section: string, subjectHints: string[], priority: number, enabled = true): NewsSource => ({ id, publisher, label: `${publisher} · ${section}`, feedUrl, siteUrl: new URL(feedUrl).origin, kind, section, subjectHints, priority, enabled })
export const NEWS_SOURCES: NewsSource[] = [
  source('pib', 'PIB', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1', 'official', 'Press releases', [], 0, false),
  source('rbi-notifications', 'RBI', 'https://www.rbi.org.in/notifications_rss.xml', 'official', 'Notifications', ['Economy'], 0),
  source('rbi-releases', 'RBI', 'https://www.rbi.org.in/pressreleases_rss.xml', 'official', 'Press releases', ['Economy'], 0),
  source('sebi', 'SEBI', 'https://www.sebi.gov.in/sebirss.xml', 'official', 'Regulation', ['Economy'], 0),
  source('ie-upsc', 'Indian Express', 'https://indianexpress.com/section/upsc-current-affairs/feed/', 'newspaper', 'UPSC Current Affairs', [], 1),
  source('ie-explained', 'Indian Express', 'https://indianexpress.com/section/explained/feed/', 'newspaper', 'Explained', [], 1),
  source('ie-economy', 'Indian Express', 'https://indianexpress.com/section/business/economy/feed/', 'newspaper', 'Economy', ['Economy'], 2),
  source('mint-economy', 'Mint', 'https://www.livemint.com/rss/economy', 'newspaper', 'Economy', ['Economy'], 2),
  source('hindu-national', 'The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss', 'newspaper', 'National', [], 2),
  source('guardian-world', 'Guardian', 'https://www.theguardian.com/world/rss', 'international', 'World', ['International relations'], 3),
  source('guardian-environment', 'Guardian', 'https://www.theguardian.com/uk/environment/rss', 'international', 'Environment', ['Environment'], 3),
  source('guardian-science', 'Guardian', 'https://www.theguardian.com/science/rss', 'international', 'Science', ['Sci-Tech'], 3),
]
