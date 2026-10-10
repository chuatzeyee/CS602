// objectsValue.ts - cell <-> VBA value conversion for Range.Value/Value2/Formula/Text: typed reads (Date and Currency
// cells), Excel's assignment rules (strings parse like typing, dates get a date format), arrays written to ranges
// (broadcast of a single row/column, #N/A outside the array), formula re-basing and A1 <-> R1C1 conversion.
import { formatNumber } from '../engine/format'
import { shiftFormula } from '../refs'
import { arrayIndex, fromCell, newArray, toCell, VbaError } from './runtime'
import type { Val, VbaArray } from './runtime'
import { deref, formatNumber as cstrNumber } from './coerce'
import { boxCols, boxRows, cellRef } from './objectsCore'
import type { Box, XlState } from './objectsCore'
import { protectedText } from './labHostUtil'

const strip = (code: string): string => code.replace(/"[^"]*"|\\.|_.|\*./g, '').replace(/\[(?!h\]|m\]|s\])[^\]]*\]/gi, '')

/** a number format that shows a date or a time (so Range.Value reads a Date) */
export function isDateFormat(code: string): boolean {
  if (!code || code === 'General') return false
  return /[dmyhs]/i.test(strip(code).replace(/General/gi, ''))
}

/** a currency format (Range.Value reads a Currency, Value2 a Double) */
export function isCurrencyFormat(code: string): boolean {
  if (!code || code === 'General') return false
  return /[$€£¥]/.test(code.replace(/"[^"]*"/g, '')) || /\[\$[^\]-]*[^\]]*\]/.test(code)
}

export function readCell(st: XlState, row: number, col: number, value2 = false): Val {
  const c = st.host.value(row, col)
  if (typeof c === 'number' && !value2) {
    const fmt = st.host.numberFormat(row, col)
    if (isDateFormat(fmt) && c >= -657434 && c < 2958466) return { t: 'date', v: c }
    if (isCurrencyFormat(fmt)) return { t: 'currency', v: Math.round(c * 10000) / 10000 }
  }
  return fromCell(c)
}

/** Value of a box: a scalar for one cell, else a 1-based 2-D Variant array */
export function readBox(st: XlState, b: Box, value2 = false): Val {
  if (b.r1 === b.r2 && b.c1 === b.c2) return readCell(st, b.r1, b.c1, value2)
  const a = newArray([{ lo: 1, hi: boxRows(b) }, { lo: 1, hi: boxCols(b) }], 'Variant')
  let i = 0
  for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) a.data[i++] = readCell(st, r, c, value2)
  return { t: 'arr', v: a }
}

/** what Range.Formula reads: the formula, or the constant as text */
export function cellFormula(st: XlState, row: number, col: number): string {
  const raw = st.host.formula(row, col)
  if (raw.startsWith('=')) return raw
  const c = st.host.value(row, col)
  if (c === null) return ''
  if (typeof c === 'number') return cstrNumber(c, 15)
  if (typeof c === 'boolean') return c ? 'TRUE' : 'FALSE'
  return c
}

export function cellText(st: XlState, row: number, col: number): string {
  const c = st.host.value(row, col)
  if (c === null) return ''
  if (typeof c === 'boolean') return c ? 'TRUE' : 'FALSE'
  if (typeof c === 'string') return c
  const fmt = st.host.numberFormat(row, col)
  return formatNumber(c, fmt === 'General' ? undefined : fmt)
}

function dateFormatFor(serial: number): string {
  if (serial >= 0 && serial < 1) return 'h:mm:ss AM/PM'
  return Number.isInteger(serial) ? 'dd/mm/yyyy' : 'dd/mm/yyyy h:mm'
}

function autoFormat(st: XlState, row: number, col: number, code: string): void {
  if (st.host.numberFormat(row, col) === 'General') st.host.setNumberFormat(row, col, code)
}

/** one cell = one VBA value, the way Range.Value = x does it */
export function writeCell(st: XlState, row: number, col: number, v: Val, rebase?: { dr: number; dc: number }): void {
  const val = v.t === 'obj' ? deref(v) : v
  switch (val.t) {
    case 'str': {
      const t = rebase && val.v.trim().startsWith('=') && (rebase.dr || rebase.dc) ? shiftFormula(val.v.trim(), rebase.dr, rebase.dc) : val.v
      st.host.setFormula(row, col, t)
      return
    }
    case 'date':
      st.host.setValue(row, col, val.v)
      autoFormat(st, row, col, dateFormatFor(val.v))
      return
    case 'currency':
      st.host.setValue(row, col, val.v)
      autoFormat(st, row, col, '$#,##0.00')
      return
    case 'arr':
      throw new VbaError(13)
    default:
      st.host.setValue(row, col, toCell(val))
  }
}

/** raise "The cell is protected" before anything in the box is written */
export function checkWritable(st: XlState, b: Box): void {
  const locked = st.extras.locked
  if (!locked) return
  for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) if (locked(r, c)) throw new VbaError(1004, protectedText(cellRef(r, c)))
}

const NA: Val = { t: 'err', v: 2042 }

function arrayGrid(a: VbaArray): { rows: number; cols: number; at: (i: number, j: number) => Val } {
  if (a.dims.length === 1) {
    const { lo, hi } = a.dims[0]
    return { rows: 1, cols: Math.max(0, hi - lo + 1), at: (_i, j) => a.data[j] }
  }
  if (a.dims.length === 2) {
    const [d1, d2] = a.dims
    return { rows: Math.max(0, d1.hi - d1.lo + 1), cols: Math.max(0, d2.hi - d2.lo + 1), at: (i, j) => a.data[arrayIndex(a, [d1.lo + i, d2.lo + j])] }
  }
  throw new VbaError(13)
}

/** Range.Value = v / Range.Formula = v over a whole box (Excel's rules for arrays that do not fit) */
export function writeBox(st: XlState, b: Box, v: Val): void {
  checkWritable(st, b)
  const val = v.t === 'obj' ? deref(v) : v
  const run = (): void => {
    if (val.t !== 'arr') {
      for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) writeCell(st, r, c, val, { dr: r - b.r1, dc: c - b.c1 })
      return
    }
    const g = arrayGrid(val.v)
    for (let i = 0; i <= b.r2 - b.r1; i++) {
      for (let j = 0; j <= b.c2 - b.c1; j++) {
        const si = g.rows === 1 ? 0 : i
        const sj = g.cols === 1 ? 0 : j
        const item = si < g.rows && sj < g.cols ? g.at(si, sj) : NA
        writeCell(st, b.r1 + i, b.c1 + j, item.t === 'arr' || item.t === 'obj' ? NA : item)
      }
    }
  }
  const cells = boxRows(b) * boxCols(b)
  if (cells > 1 && st.extras.batch) st.extras.batch(run)
  else run()
}

// ----- A1 <-> R1C1 -----
const A1_REF = /("(?:[^"]|"")*")|(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![\w(!])/g
const R1C1_REF = /("(?:[^"]|"")*")|\b[Rr](\[-?\d+\]|\d+)?[Cc](\[-?\d+\]|\d+)?(?![\w(!])/g

export function toR1C1(formula: string, row: number, col: number): string {
  if (!formula.startsWith('=')) return formula
  return formula.replace(A1_REF, (whole, s: string, ac: string, letters: string, ar: string, digits: string, at: number, all: string) => {
    if (s) return whole
    if (at > 0 && /[\w.$:]/.test(all[at - 1]) && all[at - 1] !== ':') return whole
    const c = letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
    const r = Number(digits)
    const rp = ar ? `R${r}` : r === row ? 'R' : `R[${r - row}]`
    const cp = ac ? `C${c}` : c === col ? 'C' : `C[${c - col}]`
    return rp + cp
  })
}

export function fromR1C1(formula: string, row: number, col: number): string {
  if (!formula.trim().startsWith('=')) return formula
  return formula.replace(R1C1_REF, (whole, s: string, rp: string | undefined, cp: string | undefined) => {
    if (s) return whole
    const part = (p: string | undefined, base: number): { n: number; abs: boolean } =>
      p === undefined ? { n: base, abs: false } : p.startsWith('[') ? { n: base + Number(p.slice(1, -1)), abs: false } : { n: Number(p), abs: true }
    const r = part(rp, row)
    const c = part(cp, col)
    if (r.n < 1 || c.n < 1) return '#REF!'
    const letters = cellRef(1, c.n).replace(/\d+$/, '')
    return `${c.abs ? '$' : ''}${letters}${r.abs ? '$' : ''}${r.n}`
  })
}
