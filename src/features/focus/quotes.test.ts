import { describe, expect, it } from 'vitest'
import { QUOTES } from './quotes'

describe('focus quotes', () => {
  it('has at least 500 lines and no duplicates', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(500)
    const seen = new Set(QUOTES.map((q) => q.toLowerCase().replace(/[^a-z]/g, '')))
    expect(seen.size).toBe(QUOTES.length)
  })

  it('keeps every line short enough to read at a glance', () => {
    const long = QUOTES.filter((q) => q.length > 96)
    expect(long).toEqual([])
  })

  it('follows the house style: a full sentence, no exclamation marks, curly apostrophes, no attribution', () => {
    for (const q of QUOTES) {
      expect(q, q).toMatch(/^[A-Z]/)
      expect(q, q).toMatch(/[.?]$/)
      expect(q, q).not.toMatch(/[!'"]|—| - |\s{2,}/)
    }
  })
})
