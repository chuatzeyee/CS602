// grid actions over a LabSheet: lock checks, blank test, clipboard text, external paste, move, AutoFill
import { asOneStep, writeCells } from '../../sheet'
import type { EditResult, LabSheet } from '../../types'
import { linearSeries, parseTsv, toTsv } from './clipboardText'
import { colLetters, rangeText } from './formulaText'
import type { Box } from './navigate'

export const LOCKED_MSG = 'This cell is locked (given data)'
export const TABLE_MSG = 'Cannot change part of a data table'
export const READ_ONLY_MSG = 'This sheet is read-only'

export const refOf = (r: number, c: number): string => `${colLetters(c)}${r + 1}`
export const boxText = (b: Box): string => rangeText(b.r1, b.c1, b.r2, b.c2)

/** empty like Excel: no entry and no value (cells filled by a spilling formula have no entry but are not blank) */
export function isBlank(sheet: LabSheet, r: number, c: number): boolean {
  const ref = refOf(r, c)
  return sheet.raw(ref) === '' && sheet.read(ref).kind === 'empty'
}

/** data-table bodies (everything but the first row and column of each table range) */
export function tableBodies(sheet: LabSheet): Box[] {
  const out: Box[] = []
  for (const dt of sheet.dataTables) {
    const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(dt.range.trim())
    if (!m) continue
    const c1 = colIndex(m[1])
    const c2 = colIndex(m[3])
    const r1 = Number(m[2]) - 1
    const r2 = Number(m[4]) - 1
    out.push({ r1: Math.min(r1, r2) + 1, c1: Math.min(c1, c2) + 1, r2: Math.max(r1, r2), c2: Math.max(c1, c2) })
  }
  return out
}

function colIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

const inAny = (boxes: Box[], r: number, c: number) => boxes.some(b => r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2)

/** why a cell cannot be changed, or null */
export function lockReason(sheet: LabSheet, bodies: Box[], r: number, c: number, readOnly?: boolean): string | null {
  if (readOnly) return READ_ONLY_MSG
  if (inAny(bodies, r, c)) return TABLE_MSG
  return sheet.editable(refOf(r, c)) ? null : LOCKED_MSG
}

/** the first lock reason inside a box (rows in `rows` only), or null */
export function boxLockReason(sheet: LabSheet, bodies: Box[], b: Box, rows: readonly number[], readOnly?: boolean): string | null {
  if (readOnly) return READ_ONLY_MSG
  for (const r of rows) {
    if (r < b.r1 || r > b.r2) continue
    for (let c = b.c1; c <= b.c2; c++) {
      const why = lockReason(sheet, bodies, r, c)
      if (why) return why
    }
  }
  return null
}

/** what Excel puts on the system clipboard: the displayed values as tab-separated text */
export function boxTsv(sheet: LabSheet, b: Box, rows: readonly number[]): string {
  const out: string[][] = []
  for (const r of rows) {
    if (r < b.r1 || r > b.r2) continue
    const line: string[] = []
    for (let c = b.c1; c <= b.c2; c++) line.push(sheet.display(refOf(r, c)))
    out.push(line)
  }
  return toTsv(out)
}

export interface PasteOutcome { box: Box; written: number; skipped: number; error?: string }

/** paste clipboard text from outside the lab as one undo step: each field is entered like typing it */
export function pasteText(sheet: LabSheet, bodies: Box[], at: { r: number; c: number }, text: string): PasteOutcome {
  const rows = parseTsv(text)
  const entries: Record<string, string> = {}
  let written = 0
  let skipped = 0
  let r2 = at.r
  let c2 = at.c
  rows.forEach((fields, i) => {
    fields.forEach((field, j) => {
      const r = at.r + i
      const c = at.c + j
      if (r >= sheet.rows || c >= sheet.cols) return
      r2 = Math.max(r2, r)
      c2 = Math.max(c2, c)
      if (lockReason(sheet, bodies, r, c)) { skipped++; return }
      entries[refOf(r, c)] = field
      written++
    })
  })
  const box = { r1: at.r, c1: at.c, r2, c2 }
  if (!written) return { box, written, skipped }
  const res = writeCells(sheet, entries)
  return res.ok ? { box, written, skipped } : { box, written: 0, skipped, error: res.message }
}

/** cut + paste as one undo step: entries move unchanged (formulas keep pointing at the same cells), the source is cleared */
export function moveBox(sheet: LabSheet, src: Box, dest: Box): EditResult {
  const entries: Record<string, string> = {}
  for (let r = src.r1; r <= src.r2; r++) for (let c = src.c1; c <= src.c2; c++) entries[refOf(r, c)] = ''
  for (let r = src.r1; r <= src.r2; r++) {
    for (let c = src.c1; c <= src.c2; c++) {
      const tr = dest.r1 + r - src.r1
      const tc = dest.c1 + c - src.c1
      if (tr <= dest.r2 && tc <= dest.c2) entries[refOf(tr, tc)] = sheet.raw(refOf(r, c))
    }
  }
  return writeCells(sheet, entries)
}

const numericConstant = (sheet: LabSheet, ref: string): number | undefined => {
  const raw = sheet.raw(ref)
  if (raw === '' || raw.startsWith('=')) return undefined
  const v = sheet.read(ref)
  return v.kind === 'number' ? v.value : undefined
}

/**
 * Excel AutoFill from `src` (the selection) over `target` (src extended down or right).
 * Lines of 2+ numeric constants extend their linear trend; everything else is copied with relative refs adjusted.
 */
export function autoFill(sheet: LabSheet, src: Box, target: Box, dir: 'down' | 'right'): EditResult {
  const lines: Box[] = []
  if (dir === 'down') for (let c = src.c1; c <= src.c2; c++) lines.push({ r1: src.r1, c1: c, r2: src.r2, c2: c })
  else for (let r = src.r1; r <= src.r2; r++) lines.push({ r1: r, c1: src.c1, r2: r, c2: src.c2 })
  const valuesOf = (l: Box): number[] | null => {
    const out: number[] = []
    for (let r = l.r1; r <= l.r2; r++) {
      for (let c = l.c1; c <= l.c2; c++) {
        const v = numericConstant(sheet, refOf(r, c))
        if (v === undefined) return null
        out.push(v)
      }
    }
    return out.length >= 2 ? out : null
  }
  const series = lines.map(valuesOf)
  if (series.every(v => v === null)) return sheet.fill(boxText(src), boxText(target))
  // copied columns, the series and their formats: one drag, one undo step
  return asOneStep(sheet, () => fillLines(sheet, lines, series, target, dir))
}

function fillLines(sheet: LabSheet, lines: Box[], series: (number[] | null)[], target: Box, dir: 'down' | 'right'): EditResult {
  const entries: Record<string, string> = {}
  const fmts: [string, string][] = []
  for (const [i, l] of lines.entries()) {
    const values = series[i]
    const rest: Box = dir === 'down' ? { ...l, r1: l.r2 + 1, r2: target.r2 } : { ...l, c1: l.c2 + 1, c2: target.c2 }
    if (!values) {
      const res = sheet.fill(boxText(l), boxText({ ...l, r2: rest.r2, c2: rest.c2 }))
      if (!res.ok) return res
      continue
    }
    const next = linearSeries(values, dir === 'down' ? rest.r2 - l.r2 : rest.c2 - l.c2)
    next.forEach((v, k) => {
      entries[dir === 'down' ? refOf(l.r2 + 1 + k, l.c1) : refOf(l.r1, l.c2 + 1 + k)] = String(v)
    })
    const fmt = sheet.fmt(refOf(l.r2, l.c2))
    if (fmt) fmts.push([boxText(rest), fmt])
  }
  const res = writeCells(sheet, entries)
  if (!res.ok) return res
  for (const [range, fmt] of fmts) sheet.setFmt(range, fmt)
  return res
}
