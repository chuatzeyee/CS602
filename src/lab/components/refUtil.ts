// light ref helpers for dialog fields (no engine imports)
export const normRef = (s: string): string => s.replace(/[$\s]/g, '').toUpperCase()

const CELL_RE = /^([A-Z]{1,3})([0-9]{1,7})$/

export function colNum(letters: string): number {
  let n = 0
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

export function colName(index: number): string {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

export interface Box { r1: number; c1: number; r2: number; c2: number }

function cell(ref: string): { r: number; c: number } | undefined {
  const m = CELL_RE.exec(ref)
  return m ? { r: Number(m[2]) - 1, c: colNum(m[1]) } : undefined
}

// 'C5:D9' -> 0-based box; undefined when malformed
export function box(range: string): Box | undefined {
  const [a, b = a, extra] = normRef(range).split(':')
  if (extra !== undefined) return undefined
  const p = cell(a)
  const q = cell(b)
  if (!p || !q) return undefined
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) }
}

export const boxRef = (b: Box): string =>
  b.r1 === b.r2 && b.c1 === b.c2
    ? `${colName(b.c1)}${b.r1 + 1}`
    : `${colName(b.c1)}${b.r1 + 1}:${colName(b.c2)}${b.r2 + 1}`

export const cellCount = (range: string): number =>
  normRef(range).split(',').reduce((n, part) => {
    const b = box(part)
    return n + (b ? (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1) : 0)
  }, 0)

// top-left cell of the first area
export function firstCell(range: string): string {
  const b = box(normRef(range).split(',')[0] ?? '')
  return b ? `${colName(b.c1)}${b.r1 + 1}` : 'A1'
}

export interface RefRules { rows: number; cols: number; single?: boolean; multi?: boolean; optional?: boolean }

// a learner-facing problem with a typed reference, or undefined when fine
export function refProblem(raw: string, rules: RefRules): string | undefined {
  const ref = normRef(raw)
  if (!ref) return rules.optional ? undefined : 'Enter a cell reference.'
  const parts = ref.split(',')
  if (parts.length > 1 && !rules.multi) return 'Use a single range here.'
  for (const part of parts) {
    const b = box(part)
    if (!b) return `"${part}" is not a cell reference (e.g. B4 or B4:D4).`
    if (rules.single && (b.r1 !== b.r2 || b.c1 !== b.c2)) return 'This needs a single cell.'
    if (b.r2 >= rules.rows || b.c2 >= rules.cols) return `${part} is outside the sheet.`
  }
  return undefined
}

// every cell of a (possibly multi-area) range, row-major per area
export function cellsOf(range: string, limit = 5000): string[] {
  const out: string[] = []
  for (const part of normRef(range).split(',')) {
    const b = box(part)
    if (!b) continue
    for (let r = b.r1; r <= b.r2; r++) {
      for (let c = b.c1; c <= b.c2; c++) {
        out.push(`${colName(c)}${r + 1}`)
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

// Excel fill: the first row (down) or column (right) of the selection is copied across it;
// a single cell copies from the cell above / to the left
export function fillArgs(range: string, dir: 'down' | 'right'): { source: string; target: string } | null {
  const b = box(normRef(range).split(',')[0] ?? '')
  if (!b) return null
  if (dir === 'down') {
    const top = b.r1 === b.r2 ? b.r1 - 1 : b.r1
    if (top < 0) return null
    return { source: boxRef({ ...b, r1: top, r2: top }), target: boxRef({ ...b, r1: top }) }
  }
  const left = b.c1 === b.c2 ? b.c1 - 1 : b.c1
  if (left < 0) return null
  return { source: boxRef({ ...b, c1: left, c2: left }), target: boxRef({ ...b, c1: left }) }
}
