// tab-separated clipboard text (what Excel puts on and reads from the system clipboard) and AutoFill series

export function toTsv(rows: readonly (readonly string[])[]): string {
  const quote = (s: string) => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return rows.map(row => row.map(quote).join('\t')).join('\r\n')
}

/** parse clipboard text into rows of cells; handles quoted fields with tabs/newlines; drops the trailing newline */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let quoted = false
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }
  while (i < text.length) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue }
      if (ch === '"') { quoted = false; i++; continue }
      field += ch
      i++
      continue
    }
    if (ch === '"' && field === '') { quoted = true; i++; continue }
    if (ch === '\t') { pushField(); i++; continue }
    if (ch === '\r' && text[i + 1] === '\n') { pushRow(); i += 2; continue }
    if (ch === '\n' || ch === '\r') { pushRow(); i++; continue }
    field += ch
    i++
  }
  if (field !== '' || row.length) pushRow()
  return rows
}

const tidy = (v: number) => Number(v.toPrecision(15))

/** Excel AutoFill for 2+ numbers: extend the least-squares linear trend; one number is copied */
export function linearSeries(values: readonly number[], count: number): number[] {
  const n = values.length
  if (n === 0 || count <= 0) return []
  if (n === 1) return Array.from({ length: count }, () => values[0])
  const mx = (n - 1) / 2
  const my = values.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (values[i] - my)
    sxx += (i - mx) * (i - mx)
  }
  const slope = sxx ? sxy / sxx : 0
  return Array.from({ length: count }, (_, k) => tidy(my + slope * (n + k - mx)))
}
