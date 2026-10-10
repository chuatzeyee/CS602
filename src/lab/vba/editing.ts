// Pure text edits behind the VBA editor's keys: Tab (4-space tab stops, or indent every selected line), Shift+Tab
// (outdent), Enter (keep the line's indentation). Each returns a splice so the editor can apply it through the
// browser's own insertText (keeping Ctrl+Z) or by hand.

export const TAB = 4

export interface Splice {
  from: number                  // replace value[from, to) with text
  to: number
  text: string
  selStart: number              // selection afterwards
  selEnd: number
}

const lineStart = (value: string, pos: number): number => value.lastIndexOf('\n', pos - 1) + 1
const lineEnd = (value: string, pos: number): number => {
  const i = value.indexOf('\n', pos)
  return i < 0 ? value.length : i
}
const leading = (line: string): number => line.length - line.trimStart().length

// the block of whole lines a selection touches; a selection ending at the start of a line leaves that line out
function lineBlock(value: string, start: number, end: number): { from: number; to: number } {
  const from = lineStart(value, start)
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  return { from, to: lineEnd(value, Math.max(last, from)) }
}

export function tabSplice(value: string, start: number, end: number): Splice {
  const multi = value.slice(start, end).includes('\n')
  if (!multi) {
    const col = start - lineStart(value, start)
    const pad = ' '.repeat(TAB - (col % TAB))
    return { from: start, to: end, text: pad, selStart: start + pad.length, selEnd: start + pad.length }
  }
  const { from, to } = lineBlock(value, start, end)
  const lines = value.slice(from, to).split('\n')
  const text = lines.map(l => (l.trim() ? ' '.repeat(TAB) + l : l)).join('\n')
  const firstShift = lines[0].trim() ? TAB : 0
  return { from, to, text, selStart: start + firstShift, selEnd: end + (text.length - (to - from)) }
}

export function outdentSplice(value: string, start: number, end: number): Splice | null {
  const { from, to } = lineBlock(value, start, end)
  const lines = value.slice(from, to).split('\n')
  const cut = lines.map(l => {
    const lead = leading(l.replace(/\t/g, ' '))
    return Math.min(lead, lead % TAB || TAB)
  })
  if (cut.every(n => n === 0)) return null
  const text = lines.map((l, i) => l.slice(cut[i])).join('\n')
  const firstCol = start - from
  const selStart = Math.max(from, start - Math.min(cut[0], firstCol))
  const selEnd = start === end ? selStart : Math.max(selStart, end - (to - from - text.length))
  return { from, to, text, selStart, selEnd }
}

// Enter: a new line indented like the current one (only up to the caret when the caret sits inside the indentation)
export function newlineSplice(value: string, start: number, end: number): Splice {
  const from = lineStart(value, start)
  const line = value.slice(from, lineEnd(value, start))
  const indent = line.slice(0, Math.min(leading(line), start - from))
  const text = `\n${indent}`
  return { from: start, to: end, text, selStart: start + text.length, selEnd: start + text.length }
}

export function applySplice(value: string, s: Splice): string {
  return value.slice(0, s.from) + s.text + value.slice(s.to)
}

// 1-based line of a caret position, and the [start, end) of a 1-based line
export const lineOf = (value: string, pos: number): number => value.slice(0, pos).split('\n').length

export function lineRange(value: string, line: number): { start: number; end: number } {
  let start = 0
  for (let n = 1; n < line; n++) {
    const i = value.indexOf('\n', start)
    if (i < 0) return { start: value.length, end: value.length }
    start = i + 1
  }
  return { start, end: lineEnd(value, start) }
}
