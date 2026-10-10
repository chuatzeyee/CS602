// objectsCore.ts - shared state and helpers of the Excel object model: boxes (1-based, inclusive), argument access,
// address parsing, the per-run state (clipboard, Application settings) and error helpers.
import { colIndex, colLetter } from '../refs'
import type { CellValue } from '../types'
import { VbaError } from './runtime'
import type { Val, VbaHost, VbaObject } from './runtime'
import { bankersRound, toBool, toNumber, toStr } from './coerce'
import type { HostExtras } from './labHost'

export interface Box { r1: number; c1: number; r2: number; c2: number }

// the per-run state shared by every object of one excelScope(host)
export interface XlState {
  readonly host: VbaHost
  readonly extras: Partial<HostExtras>
  clip: Box | null                                   // Copy or Cut without Destination (CutCopyMode)
  clipCut?: boolean                                  // the clipboard holds a Cut: the next ActiveSheet.Paste moves it
  readonly app: Map<string, Val>                     // ScreenUpdating, StatusBar ... as last set
  readonly cellProps: Map<string, Val>               // 'B4|horizontalalignment' -> value (stored, not rendered)
  makeRange(areas: Box[], view?: RangeView, whole?: Whole): VbaObject
  worksheet(): VbaObject
}

export type Whole = '' | 'rows' | 'cols'

/** the boxes of a Range object (duck-typed so modules need not import the class) */
export function areasOf(o: VbaObject | null): Box[] | null {
  if (!o || o.className !== 'Range') return null
  const a = (o as unknown as { areas?: Box[] }).areas
  return Array.isArray(a) ? a : null
}

export type RangeView = 'cells' | 'rows' | 'cols'

export const XL_NONE = -4142

export const lower = (s: string): string => s.toLowerCase()

/** 438 with the member name, so learners can tell a lab limit from a typo. */
export function noMember(cls: string, name: string): VbaError {
  return new VbaError(438, `Object doesn't support this property or method: ${cls}.${name}`)
}

export function appError(detail?: string): VbaError {
  return new VbaError(1004, detail ? `Application-defined or object-defined error (${detail})` : undefined)
}

/** positional argument i or the named argument (case-insensitive); undefined when omitted */
export function arg(args: Val[], named: Record<string, Val>, i: number, name: string): Val | undefined {
  const want = lower(name)
  for (const [k, v] of Object.entries(named)) if (lower(k) === want) return v.t === 'missing' ? undefined : v
  const v = args[i]
  return v === undefined || v.t === 'missing' ? undefined : v
}

// CLng: round half to even
export function toLong(v: Val): number {
  const x = bankersRound(toNumber(v))
  if (!Number.isFinite(x) || Math.abs(x) > 2147483647) throw new VbaError(6)
  return x
}

export const num = (v: Val | undefined, def: number): number => (v === undefined ? def : toLong(v))
export const flag = (v: Val | undefined, def: boolean): boolean => (v === undefined ? def : toBool(v))
export const text = (v: Val): string => toStr(v)

/** a column given as a number or as letters (Cells(1, "B")) */
export function colArg(v: Val): number {
  if (v.t === 'str' && /^[A-Za-z]{1,3}$/.test(v.v.trim())) return colIndex(v.v.trim()) + 1
  return toLong(v)
}

export const cellRef = (row: number, col: number): string => `${colLetter(col - 1)}${row}`
export const boxRows = (b: Box): number => b.r2 - b.r1 + 1
export const boxCols = (b: Box): number => b.c2 - b.c1 + 1
export const sameBox = (a: Box, b: Box): boolean => a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2

export function intersectBox(a: Box, b: Box): Box | null {
  const box = { r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1), r2: Math.min(a.r2, b.r2), c2: Math.min(a.c2, b.c2) }
  return box.r1 <= box.r2 && box.c1 <= box.c2 ? box : null
}

export function boxText(b: Box, absRow = false, absCol = false): string {
  const one = (r: number, c: number): string => `${absCol ? '$' : ''}${colLetter(c - 1)}${absRow ? '$' : ''}${r}`
  return b.r1 === b.r2 && b.c1 === b.c2 ? one(b.r1, b.c1) : `${one(b.r1, b.c1)}:${one(b.r2, b.c2)}`
}

/** raise 1004 unless the box lies on the lab grid */
export function checkBox(host: VbaHost, b: Box, what: string): Box {
  if (b.r1 < 1 || b.c1 < 1 || b.r2 > host.rows || b.c2 > host.cols || b.r1 > b.r2 || b.c1 > b.c2) {
    const last = cellRef(host.rows, host.cols)
    throw new VbaError(1004, `Application-defined or object-defined error: ${what} is outside the lab sheet (A1:${last})`)
  }
  return b
}

const CELL = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/
const COLS = /^\$?([A-Za-z]{1,3})$/
const ROWS = /^\$?(\d{1,7})$/

/** 'A1', 'a1:b5', '$A$1', 'A:C', '3:5', 'A1:B2,D4', 'Sheet1!A1'; null when it is not an address */
export function parseAddress(raw: string, host: VbaHost): Box[] | null {
  const areas: Box[] = []
  for (const part of raw.split(',')) {
    let t = part.trim()
    const bang = t.lastIndexOf('!')
    if (bang >= 0) {
      const sheet = t.slice(0, bang).replace(/^'(.*)'$/, '$1')
      if (lower(sheet) !== lower(host.sheetName)) return null
      t = t.slice(bang + 1)
    }
    const ends = t.split(':')
    if (ends.length > 2 || ends.some((e) => e.trim() === '')) return null
    const [a, b = a] = ends.map((e) => e.trim())
    let m1 = CELL.exec(a)
    let m2 = CELL.exec(b)
    if (m1 && m2) {
      const r = [Number(m1[2]), Number(m2[2])]
      const c = [colIndex(m1[1]) + 1, colIndex(m2[1]) + 1]
      areas.push({ r1: Math.min(r[0], r[1]), c1: Math.min(c[0], c[1]), r2: Math.max(r[0], r[1]), c2: Math.max(c[0], c[1]) })
      continue
    }
    m1 = COLS.exec(a)
    m2 = COLS.exec(b)
    if (m1 && m2 && ends.length === 2) {
      const c = [colIndex(m1[1]) + 1, colIndex(m2[1]) + 1]
      areas.push({ r1: 1, c1: Math.min(c[0], c[1]), r2: host.rows, c2: Math.max(c[0], c[1]) })
      continue
    }
    m1 = ROWS.exec(a)
    m2 = ROWS.exec(b)
    if (m1 && m2 && ends.length === 2) {
      const r = [Number(m1[1]), Number(m2[1])]
      areas.push({ r1: Math.min(r[0], r[1]), c1: 1, r2: Math.max(r[0], r[1]), c2: host.cols })
      continue
    }
    return null
  }
  return areas.length ? areas : null
}

/** has the cell any content? (a formula returning "" counts, like Excel's Ctrl+arrow) */
export function filled(host: VbaHost, row: number, col: number): boolean {
  return host.formula(row, col) !== '' || host.value(row, col) !== null
}

export const isCellError = (c: CellValue): boolean => typeof c === 'string' && /^#(N\/A|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|NULL!|SPILL!|CALC!|CYCLE!|ERROR!)$/.test(c)
