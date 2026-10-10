// Source-text helpers for checking: blank out comments and string literals, find keywords, and find the procedures
// a learner left exactly as the starter had them (the Test drivers), so required keywords count only in their code.

// the module with every comment and string literal blanked (same length and line breaks, so positions still match)
export function codeOnly(source: string): string {
  const out: string[] = []
  for (const line of source.split(/\r?\n/)) out.push(codeOfLine(line))
  return out.join('\n')
}

function codeOfLine(line: string): string {
  let s = ''
  let inStr = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inStr) {
      if (ch === '"' && line[i + 1] === '"') {
        s += '  '
        i++
      } else if (ch === '"') {
        inStr = false
        s += '"'
      } else {
        s += ' '
      }
      continue
    }
    if (ch === '"') {
      inStr = true
      s += '"'
      continue
    }
    if (ch === "'") return s
    if (isRem(line, i, s)) return s
    s += ch
  }
  return s
}

// Rem starts a comment where a statement can start: at the start of the line or after a colon
function isRem(line: string, i: number, before: string): boolean {
  if (!/^rem(\s|$)/i.test(line.slice(i, i + 4))) return false
  const prev = before.trimEnd()
  return prev === '' || prev.endsWith(':')
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// a case-insensitive pattern for a keyword or member as the task lists it: 'For Each', 'Int(', 'xlDown', '.Offset'
export function keywordPattern(keyword: string): RegExp {
  const k = keyword.trim()
  const body = k.split(/\s+/).map(part => escape(part).replace(/\\\(/g, '\\s*\\(')).join('\\s+')
  const pre = /^\w/.test(k) ? '(?<![\\w])' : ''
  const post = /\w$/.test(k) ? '(?![\\w])' : ''
  return new RegExp(`${pre}${body}${post}`, 'i')
}

export function usesKeyword(code: string, keyword: string): boolean {
  return keywordPattern(keyword).test(code)
}

// [start, end] 1-based line spans of each Sub/Function/Property block, keyed by lower-case name
export function procSpans(source: string): Map<string, { start: number; end: number; text: string }> {
  const lines = source.split(/\r?\n/)
  const code = codeOnly(source).split('\n')
  const spans = new Map<string, { start: number; end: number; text: string }>()
  let open: { name: string; start: number } | null = null
  code.forEach((line, i) => {
    const head = /^\s*(?:(?:Public|Private|Friend)\s+)?(?:Static\s+)?(?:Sub|Function|Property\s+(?:Get|Let|Set))\s+([A-Za-z_]\w*)/i.exec(line)
    if (!open && head) open = { name: head[1].toLowerCase(), start: i + 1 }
    else if (open && /^\s*End\s+(Sub|Function|Property)\b/i.test(line)) {
      const text = lines.slice(open.start - 1, i + 1).map(l => l.trimEnd()).join('\n')
      spans.set(open.name, { start: open.start, end: i + 1, text })
      open = null
    }
  })
  return spans
}

const hasCode = (text: string): boolean =>
  codeOnly(text).split('\n').slice(1, -1).some(l => l.trim() !== '')

// the learner's code: the module minus procedures that still match a starter procedure holding code (the drivers)
export function learnerCode(source: string, starter: string): string {
  const mine = procSpans(source)
  const given = procSpans(starter)
  const skip = new Set<number>()
  for (const [name, span] of mine) {
    const g = given.get(name)
    if (g && g.text === span.text && hasCode(g.text)) for (let l = span.start; l <= span.end; l++) skip.add(l)
  }
  return codeOnly(source).split('\n').map((l, i) => (skip.has(i + 1) ? '' : l)).join('\n')
}

// the procedure a 1-based line belongs to, if any
export function procAt(source: string, line: number): string | undefined {
  const lines = source.split(/\r?\n/)
  for (const span of procSpans(source).values()) {
    if (line >= span.start && line <= span.end) {
      const m = /(?:Sub|Function|Get|Let|Set)\s+([A-Za-z_]\w*)/i.exec(lines[span.start - 1] ?? '')
      return m?.[1]
    }
  }
  return undefined
}
