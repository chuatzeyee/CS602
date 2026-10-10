// a1 reference helpers (0-based rows/cols). pure, no engine.

export interface CellPos { row: number; col: number; absRow: boolean; absCol: boolean }
export interface RangeBox { r1: number; c1: number; r2: number; c2: number }

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d{0,6})$/

function stripSheet(text: string): string {
  const t = text.trim()
  const bang = t.lastIndexOf('!')
  return bang >= 0 ? t.slice(bang + 1) : t
}

export function colLetter(col: number): string {
  let s = ''
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

export function colIndex(letters: string): number {
  return letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
}

export function isRef(text: string): boolean {
  return REF_RE.test(stripSheet(text))
}

export function parseRef(text: string): CellPos {
  const m = REF_RE.exec(stripSheet(text))
  if (!m) throw new Error(`"${text}" is not a cell reference`)
  return { row: Number(m[4]) - 1, col: colIndex(m[2]), absRow: m[3] === '$', absCol: m[1] === '$' }
}

export function toRef(row: number, col: number, absRow = false, absCol = false): string {
  return `${absCol ? '$' : ''}${colLetter(col)}${absRow ? '$' : ''}${row + 1}`
}

export function isRange(text: string): boolean {
  const parts = stripSheet(text).split(':')
  return parts.length <= 2 && parts.every((p) => REF_RE.test(p.trim()))
}

export function parseRange(text: string): RangeBox {
  const parts = stripSheet(text).split(':')
  if (parts.length > 2) throw new Error(`"${text}" is not a range`)
  const a = parseRef(parts[0])
  const b = parts.length === 2 ? parseRef(parts[1]) : a
  return { r1: Math.min(a.row, b.row), c1: Math.min(a.col, b.col), r2: Math.max(a.row, b.row), c2: Math.max(a.col, b.col) }
}

export function toRange(box: RangeBox): string {
  const a = toRef(box.r1, box.c1)
  return box.r1 === box.r2 && box.c1 === box.c2 ? a : `${a}:${toRef(box.r2, box.c2)}`
}

export function rangeCells(text: string): string[] {
  const { r1, c1, r2, c2 } = parseRange(text)
  const out: string[] = []
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(toRef(r, c))
  return out
}

export function splitRanges(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter((s) => s !== '')
}

// canonical 'C5' for '$c$5', 'Sheet1!C5' ...
export function normRef(text: string): string {
  const p = parseRef(text)
  return toRef(p.row, p.col)
}

export function inBox(box: RangeBox, row: number, col: number): boolean {
  return row >= box.r1 && row <= box.r2 && col >= box.c1 && col <= box.c2
}

export function boxesOverlap(a: RangeBox, b: RangeBox): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2
}

// shift the relative parts of every cell reference in a formula (string literals and function names untouched).
// refs pushed off the sheet become #REF! like Excel. Sheet names are at most 31 characters (Excel's limit), which
// also keeps the scan linear on long runs of letters.
const FORMULA_REF_RE = /("(?:[^"]|"")*")|('(?:[^']|''){1,31}'!)|((?:[A-Za-z_][\w.]{0,30}!)?)(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(.!])/g

export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  return formula.replace(FORMULA_REF_RE, (whole, str: string, quotedSheet: string, sheet: string, ac: string, letters: string, ar: string, digits: string, offset: number, all: string) => {
    if (str || quotedSheet) return whole
    const prev = offset > 0 ? all[offset - 1] : ''
    if (/[\w.$]/.test(prev)) return whole
    const col = ac ? colIndex(letters) : colIndex(letters) + dCol
    const row = ar ? Number(digits) - 1 : Number(digits) - 1 + dRow
    if (col < 0 || row < 0 || col > 16383) return `${sheet}#REF!`
    return `${sheet}${ac}${colLetter(col)}${ar}${row + 1}`
  })
}

// '$' signs removed from every reference outside string literals
export function stripDollars(formula: string): string {
  return formula.replace(/("(?:[^"]|"")*")|\$/g, (m, str: string) => (str ? m : ''))
}

// the first reference past the edge of the lab's grid (B5000, AA1, A:AB, 1:5000) outside text, if any. The engine
// reads such a reference as an unknown name (#NAME?), so the lab refuses the formula with a message instead.
const PAST_EDGE_RE = /(?<![\w.$])(?:\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})|\$?(\d+):\$?(\d+)|\$?([A-Za-z]{1,3})\$?(\d+))(?![\w(.!])/g

export function refPastEdge(formula: string, rows: number, cols: number): string | undefined {
  const text = formula.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, (m) => ' '.repeat(m.length))
  for (const m of text.matchAll(PAST_EDGE_RE)) {
    const [whole, colA, colB, rowA, rowB, col, row] = m
    if (colA && colB && (colIndex(colA) >= cols || colIndex(colB) >= cols)) return whole.replace(/\$/g, '')
    if (rowA && rowB && (Number(rowA) > rows || Number(rowB) > rows)) return whole.replace(/\$/g, '')
    if (col && row && (colIndex(col) >= cols || Number(row) > rows)) return whole.replace(/\$/g, '')
  }
  return undefined
}
