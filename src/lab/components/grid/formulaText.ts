// pure text helpers for the formula editor: reference scanning, F4 cycling, point mode, autocomplete context

export interface RefToken {
  start: number
  end: number                 // exclusive
  text: string
  sheet?: string              // 'Sheet1' from 'Sheet1!A1' (quotes removed)
  r1: number; c1: number; r2: number; c2: number   // 0-based, normalised; whole columns use r1=0, r2=-1
  wholeCols: boolean
}

// sheet names have at most 31 characters (Excel's limit); the bound also keeps the scan linear on long runs of letters
const SHEET = String.raw`(?:'(?:[^']|''){1,31}'|[A-Za-z_][A-Za-z0-9_.]{0,30})!`
const CELL = String.raw`\$?[A-Za-z]{1,3}\$?[0-9]{1,7}`
const COL = String.raw`\$?[A-Za-z]{1,3}`
const REF_RE = new RegExp(String.raw`(?:${SHEET})?(?:${CELL}(?::${CELL})?|${COL}:${COL})`, 'g')
const BEFORE_BAD = /[A-Za-z0-9_.$!'"]/
const AFTER_BAD = /[A-Za-z0-9_.(!$]/

export const isFormulaText = (text: string): boolean => text.startsWith('=')

/** mask[i] is true when text[i] sits inside a "string literal" (quotes included). */
export function stringMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false)
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      mask[i] = true
      if (inStr && text[i + 1] === '"') { mask[i + 1] = true; i++; continue }
      inStr = !inStr
      continue
    }
    mask[i] = inStr
  }
  return mask
}

export function colIndexOf(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

export function colLetters(index: number): string {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

const CELL_PARTS = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/

function parseCellPart(s: string): { r: number; c: number } | null {
  const m = CELL_PARTS.exec(s)
  return m ? { r: Number(m[4]) - 1, c: colIndexOf(m[2]) } : null
}

/** every cell/range reference outside string literals, left to right */
export function scanRefs(text: string): RefToken[] {
  if (!isFormulaText(text)) return []
  const mask = stringMask(text)
  const out: RefToken[] = []
  REF_RE.lastIndex = 0
  for (let m = REF_RE.exec(text); m; m = REF_RE.exec(text)) {
    const start = m.index
    const end = start + m[0].length
    if (mask[start]) continue
    if (start > 0 && BEFORE_BAD.test(text[start - 1])) continue
    if (end < text.length && AFTER_BAD.test(text[end])) continue
    const bang = m[0].lastIndexOf('!')
    const sheet = bang >= 0 ? m[0].slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'") : undefined
    const body = bang >= 0 ? m[0].slice(bang + 1) : m[0]
    const [a, b = a] = body.split(':')
    const pa = parseCellPart(a)
    const pb = parseCellPart(b)
    if (pa && pb) {
      out.push({
        start, end, text: m[0], sheet, wholeCols: false,
        r1: Math.min(pa.r, pb.r), c1: Math.min(pa.c, pb.c), r2: Math.max(pa.r, pb.r), c2: Math.max(pa.c, pb.c),
      })
    } else if (!pa && !pb && body.includes(':')) {
      const ca = colIndexOf(a.replace('$', ''))
      const cb = colIndexOf(b.replace('$', ''))
      out.push({ start, end, text: m[0], sheet, wholeCols: true, r1: 0, r2: -1, c1: Math.min(ca, cb), c2: Math.max(ca, cb) })
    }
  }
  return out
}

/** the reference containing the caret, else the nearest one ending before it */
export function refAtCaret(text: string, caret: number): RefToken | null {
  const refs = scanRefs(text)
  let best: RefToken | null = null
  for (const t of refs) {
    if (t.start <= caret && caret <= t.end) return t
    if (t.end <= caret) best = t
  }
  return best
}

// A1 -> $A$1 -> A$1 -> $A1 -> A1
function nextAnchoring(absCol: boolean, absRow: boolean): [boolean, boolean] {
  if (!absCol && !absRow) return [true, true]
  if (absCol && absRow) return [false, true]
  if (!absCol && absRow) return [true, false]
  return [false, false]
}

function anchorPart(part: string, absCol: boolean, absRow: boolean): string {
  const m = CELL_PARTS.exec(part)
  if (m) return `${absCol ? '$' : ''}${m[2]}${absRow ? '$' : ''}${m[4]}`
  return `${absCol ? '$' : ''}${part.replace(/\$/g, '')}`   // whole column
}

/** F4: cycle the $ anchoring of the reference at (or just before) the caret */
export function cycleRef(text: string, caret: number): { text: string; caret: number } | null {
  const tok = refAtCaret(text, caret)
  if (!tok) return null
  const bang = tok.text.lastIndexOf('!')
  const prefix = bang >= 0 ? tok.text.slice(0, bang + 1) : ''
  const body = tok.text.slice(prefix.length)
  const parts = body.split(':')
  const first = CELL_PARTS.exec(parts[0])
  let next: [boolean, boolean]
  if (first) next = nextAnchoring(first[1] === '$', first[3] === '$')
  else next = parts[0].startsWith('$') ? [false, false] : [true, false]
  const replaced = prefix + parts.map(p => anchorPart(p, next[0], next[1])).join(':')
  return { text: text.slice(0, tok.start) + replaced + text.slice(tok.end), caret: tok.start + replaced.length }
}

const POINT_AFTER = new Set(['=', '(', ',', '+', '-', '*', '/', '^', '&', '<', '>', ':', ';'])

/** Excel point mode: the caret follows =, (, a comma or an operator (outside a string) */
export function isPointable(text: string, caret: number): boolean {
  if (!isFormulaText(text) || caret < 1) return false
  const mask = stringMask(text)
  if (caret < text.length && mask[caret] && mask[caret - 1]) return false
  let i = caret - 1
  while (i > 0 && text[i] === ' ') i--
  if (mask[i]) return false
  // the char right after the caret must not continue an identifier or reference
  const after = text[caret]
  if (after !== undefined && /[A-Za-z0-9_$.]/.test(after)) return false
  return POINT_AFTER.has(text[i])
}

/** replace text[start, end) with s; caret goes after it */
export function spliceText(text: string, start: number, end: number, s: string): { text: string; caret: number } {
  return { text: text.slice(0, start) + s + text.slice(end), caret: start + s.length }
}

/** the function-name prefix being typed at the caret (for autocomplete) */
export function functionPrefixAt(text: string, caret: number): { start: number; prefix: string } | null {
  if (!isFormulaText(text)) return null
  const mask = stringMask(text)
  if (caret > 0 && mask[caret - 1]) return null
  const head = text.slice(0, caret)
  const m = /[A-Za-z_][A-Za-z0-9_.]*$/.exec(head)
  if (!m) return null
  const start = m.index
  const before = start > 0 ? text[start - 1] : ''
  if (start === 0 || !(POINT_AFTER.has(before) || before === ' ')) return null
  const after = text[caret]
  if (after !== undefined && /[A-Za-z0-9_.(]/.test(after)) return null
  return { start, prefix: m[0] }
}

/** innermost FUNC( the caret is inside, with the 0-based argument index */
export function callContextAt(text: string, caret: number): { name: string; argIndex: number } | null {
  if (!isFormulaText(text)) return null
  const mask = stringMask(text)
  const stack: { name: string; argIndex: number }[] = []
  for (let i = 1; i < caret && i < text.length; i++) {
    if (mask[i]) continue
    const ch = text[i]
    if (ch === '(') {
      const m = /([A-Za-z_][A-Za-z0-9_.]*)\s*$/.exec(text.slice(0, i))
      stack.push({ name: m ? m[1].toUpperCase() : '', argIndex: 0 })
    } else if (ch === ')') {
      stack.pop()
    } else if (ch === ',' && stack.length) {
      stack[stack.length - 1] = { ...stack[stack.length - 1], argIndex: stack[stack.length - 1].argIndex + 1 }
    }
  }
  for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name) return stack[k]
  return null
}

/** Excel adds the missing closing brackets when a formula is entered */
export function autoCloseParens(text: string): string {
  if (!isFormulaText(text)) return text
  const mask = stringMask(text)
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (mask[i]) continue
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth = Math.max(0, depth - 1)
  }
  const unclosedString = (text.split('"').length - 1) % 2 === 1
  return unclosedString ? text : text + ')'.repeat(depth)
}

/** 'B3' or 'B3:D9' for a 0-based rectangle */
export function rangeText(r1: number, c1: number, r2: number, c2: number): string {
  const a = `${colLetters(Math.min(c1, c2))}${Math.min(r1, r2) + 1}`
  const b = `${colLetters(Math.max(c1, c2))}${Math.max(r1, r2) + 1}`
  return a === b ? a : `${a}:${b}`
}

/** parse 'B3', '$B$3', 'b3:d9', 'Sheet1!B3:C4' -> 0-based rectangle (null when invalid) */
export function parseRangeText(s: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const t = s.trim().replace(/^.*!/, '')
  const [a, b = a, extra] = t.split(':')
  if (extra !== undefined) return null
  const pa = parseCellPart(a)
  const pb = parseCellPart(b)
  if (!pa || !pb) return null
  return { r1: Math.min(pa.r, pb.r), c1: Math.min(pa.c, pb.c), r2: Math.max(pa.r, pb.r), c2: Math.max(pa.c, pb.c) }
}
