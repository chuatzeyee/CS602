// what one cell looks like: text (fitted like Excel), alignment, course colour role, tooltip, outline
import type { CellMark, CellRead, LabSheet, Role } from '../../types'
import { CELL_PAD, CHAR_W } from './geometry'

export type Align = 'left' | 'center' | 'right'

export interface CellView {
  text: string
  align: Align
  cls: string
  shadow?: string
  outline?: string        // CSS outline (drawn inside the cell): a wrong answer's dashed edge
  title?: string
  note?: string
  spill?: number          // px the text may overflow into empty cells to the right
}

// [text colour, extra classes]
const ROLE_CLS: Record<Role | 'none', [string, string]> = {
  input: ['text-sky-300', ''],
  given: ['text-ink-secondary', ''],
  answer: ['text-ink', 'bg-amber-400/[0.09]'],
  header: ['text-ink', 'font-semibold bg-raised'],
  note: ['text-ink-muted', 'italic'],
  label: ['text-ink', ''],
  none: ['text-ink', ''],
}

const ANSWER_EDGE = 'inset 0 0 0 1px rgba(251,191,36,0.38)'
// a checked cell: right is a solid green edge, wrong a dashed red one, so the two differ in more than colour
const OK_EDGE = 'inset 0 0 0 2px rgba(74,222,128,0.95)'
const BAD_OUTLINE = '2px dashed rgba(248,113,113,0.95)'
export const MARK_TEXT: Record<CellMark, string> = { ok: 'Checked: right', bad: 'Checked: not right yet' }
export const LOCKED_BG = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 3px, transparent 3px 7px)'

function trimFraction(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** Excel's General format squeezed into a column: fewer decimals or scientific (whichever keeps more digits), else #### */
export function fitGeneral(v: number, maxChars: number): string {
  if (maxChars <= 0) return ''
  const plain = String(v)
  if (plain.length <= maxChars && !plain.includes('e')) return plain
  const digits = (s: string) => s.replace(/E.*$/, '').replace(/[-.]/g, '').replace(/^0+/, '').length
  let fixed: string | null = null
  for (let d = Math.min(10, maxChars); d >= 0; d--) {
    const s = trimFraction(v.toFixed(d))
    if (s.length <= maxChars && (Number(s) !== 0 || v === 0)) { fixed = s; break }
  }
  let sci: string | null = null
  for (let p = Math.min(6, maxChars); p >= 1; p--) {
    const [m, e] = v.toExponential(p - 1).split('e')
    const exp = Number(e)
    const s = `${trimFraction(m)}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`
    if (s.length <= maxChars) { sci = s; break }
  }
  if (fixed && (!sci || digits(fixed) >= digits(sci))) return fixed
  return sci ?? '#'.repeat(maxChars)
}

const fitChars = (width: number) => Math.max(1, Math.floor((width - CELL_PAD) / CHAR_W))

export interface CellViewInput {
  sheet: LabSheet
  ref: string
  raw: string
  read: CellRead
  width: number
  spillRoom: number        // extra px of empty cells to the right
  showFormulas: boolean
  mark?: CellMark
  dataTableBody: boolean
}

export function cellView(i: CellViewInput): CellView {
  const { sheet, ref, raw, read } = i
  const spec = sheet.spec.cells[ref]
  const role = sheet.role(ref)
  let text: string
  let align: Align
  const [roleColour, roleExtra] = ROLE_CLS[role ?? 'none']
  let colour = i.dataTableBody ? 'text-ink-secondary' : roleColour
  let title: string | undefined
  let spill: number | undefined

  if (i.showFormulas) {
    text = raw
    align = raw.startsWith('=') || read.kind === 'string' ? 'left' : read.kind === 'number' ? 'right' : 'center'
  } else {
    text = read.kind === 'empty' ? '' : sheet.display(ref)
    align = read.kind === 'number' ? 'right' : read.kind === 'string' || read.kind === 'empty' ? 'left' : 'center'
  }
  if (spec?.align) align = spec.align

  if (read.kind === 'error') {
    colour = 'text-wrong'
    title = [read.value, read.hint || read.message].filter(Boolean).join(': ')
    if (i.showFormulas) title = undefined
  }
  const max = fitChars(i.width)
  if (!i.showFormulas && read.kind === 'number' && text.length > max) {
    const f = sheet.fmt(ref)
    text = f && f.toLowerCase() !== 'general' ? '#'.repeat(max) : fitGeneral(read.value, max)
  }
  if (text.length > max && align === 'left' && i.spillRoom > 0 && (read.kind === 'string' || i.showFormulas)) {
    spill = i.spillRoom
  }
  const cls = `${colour} ${roleExtra}${spec?.bold ? ' font-semibold' : ''}`
  if (spec?.note) title = title ? `${spec.note}\n${title}` : spec.note
  if (!title && text.length > fitChars(i.width + (spill ?? 0))) title = text
  if (i.mark) title = title ? `${title}\n${MARK_TEXT[i.mark]}` : MARK_TEXT[i.mark]

  const shadow = i.mark === 'ok' ? OK_EDGE : !i.mark && role === 'answer' ? ANSWER_EDGE : undefined
  const outline = i.mark === 'bad' ? BAD_OUTLINE : undefined
  return { text, align, cls, shadow, outline, title, note: spec?.note, spill }
}
