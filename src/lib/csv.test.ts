import { describe, expect, it } from 'vitest'
import { parseCsv, parseCsvObjects, toCsv } from './csv'

describe('csv', () => {
  it('round-trips awkward values', () => {
    const rows = [{ a: 'plain', b: 'with, comma', c: 'quote "inside"', d: 'multi\nline' }]
    const text = toCsv(['a', 'b', 'c', 'd'], rows)
    expect(parseCsvObjects(text)).toEqual(rows)
  })

  it('neutralises formula injection', () => {
    expect(toCsv(['x'], [{ x: '=HYPERLINK("x")' }])).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('handles BOM, CRLF and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })
})
