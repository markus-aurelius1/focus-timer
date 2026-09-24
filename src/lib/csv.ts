/** RFC 4180 CSV – quoted fields, embedded quotes/newlines, CRLF or LF, optional BOM. */

const needsQuote = /[",\r\n]/
/** Cells starting with these can be executed as formulas by spreadsheet apps (CSV injection). */
const formulaStart = /^[=+\-@\t\r]/

export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = typeof value === 'string' ? value : String(value)
  if (typeof value === 'string' && formulaStart.test(s)) s = `'${s}`
  return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [columns.map(escapeCell).join(',')]
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  for (; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
      continue
    }
    if (c === '"' && field === '') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** Parse into objects keyed by normalised header names (lowercase, underscores). */
export function parseCsvObjects(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
