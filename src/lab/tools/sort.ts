// Sort (Data > Sort): multi-level and stable, in Excel's order: numbers, text (A to Z, case ignored), FALSE, TRUE,
// errors; blank cells always last, also in Z to A. A custom list (Low,Medium,High or Jan-Dec) puts its entries
// first in list order, other values after them A to Z. Sort by colour is not available in the lab.
// The rows are rewritten in one undo step; formulas move with their row and their relative references shift like
// a copy (=G9*H9 moved to row 4 becomes =G4*H4), exactly as Excel does.
import type { CellValue, EditResult, LabSheet } from '../types'
import { writeCells } from '../sheet'
import { colIndex, colLetter, shiftFormula, toRange, toRef } from '../refs'
import { boxIn, currentRegionBox, headerText, isBlank, isErrorValue, sameHeader, textCollator } from './advFilter'
import type { Box } from './advFilter'

export type SortOrder = 'asc' | 'desc' | 'custom'

export interface SortLevel {
  column: string               // header text ('Priority') or column letter ('D')
  order?: SortOrder            // default 'asc' (A to Z / Smallest to Largest / Oldest to Newest)
  list?: string | string[]     // order 'custom': 'Low,Medium,High', ['Low', 'Medium', 'High'] or a built-in list name
}

// applySort / applyTool('sort') setup
export interface SortSetup {
  range: string                // the block to sort, header row included when headers is true; one cell = its current region
  headers?: boolean            // My data has headers (default true)
  levels: SortLevel[]          // Sort by, Then by, ...
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Excel's built-in custom lists (File > Options > Advanced > Edit Custom Lists)
export const BUILTIN_LISTS: Readonly<Record<string, readonly string[]>> = {
  'Sun-Sat': DAYS.map(d => d.slice(0, 3)),
  'Sunday-Saturday': DAYS,
  'Jan-Dec': MONTHS.map(m => m.slice(0, 3)),
  'January-December': MONTHS,
}

// 'Low, Medium, High' or a built-in list name -> entries
export function customListOf(list: string | readonly string[] | undefined): string[] {
  if (Array.isArray(list)) return list.map(s => String(s).trim()).filter(s => s !== '')
  const text = typeof list === 'string' ? list.trim() : ''
  const named = Object.entries(BUILTIN_LISTS).find(([name]) => name.toLowerCase() === text.toLowerCase())
  if (named) return [...named[1]]
  return text.split(/[,\n]/).map(s => s.trim()).filter(s => s !== '')
}

// the built-in list holding every text value, if any (PivotTables sort months and weekdays this way)
export function builtinListFor(values: readonly CellValue[]): readonly string[] | undefined {
  const texts = values.filter((v): v is string => typeof v === 'string' && v !== '').map(v => v.toLowerCase())
  if (!texts.length) return undefined
  return Object.values(BUILTIN_LISTS).find(list => {
    const lower = new Set(list.map(s => s.toLowerCase()))
    return texts.every(t => lower.has(t))
  })
}

const typeRank = (v: CellValue): number =>
  isBlank(v) ? 4 : typeof v === 'number' ? 0 : typeof v === 'boolean' ? 2 : isErrorValue(v) ? 3 : 1

// ascending order of two cells; blanks last
export function compareCells(a: CellValue, b: CellValue): number {
  const ra = typeRank(a)
  const rb = typeRank(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (a as number) - (b as number)
  if (ra === 1) return textCollator.compare(a as string, b as string)
  if (ra === 2) return Number(a) - Number(b)
  return 0
}

export interface ResolvedLevel { col: number; order: SortOrder; list?: readonly string[] }

function levelCompare(level: ResolvedLevel): (a: CellValue, b: CellValue) => number {
  if (level.order === 'desc') {
    return (a, b) => {
      const ba = isBlank(a)
      const bb = isBlank(b)
      if (ba || bb) return Number(ba) - Number(bb)
      return compareCells(b, a)
    }
  }
  if (level.order === 'custom' && level.list?.length) {
    const index = new Map<string, number>()
    level.list.forEach((s, i) => { if (!index.has(s.toLowerCase())) index.set(s.toLowerCase(), i) })
    const pos = (v: CellValue) => (typeof v === 'string' ? index.get(v.toLowerCase()) : undefined) ?? (typeof v === 'number' ? index.get(String(v)) : undefined)
    return (a, b) => {
      const pa = pos(a)
      const pb = pos(b)
      if (pa !== undefined && pb !== undefined) return pa - pb
      if (pa !== undefined) return -1
      if (pb !== undefined) return 1
      return compareCells(a, b)
    }
  }
  return compareCells
}

// stable permutation: out[p] = index of the row that ends up at position p
export function sortOrder(rows: readonly (readonly CellValue[])[], levels: readonly ResolvedLevel[]): number[] {
  const cmps = levels.map(l => ({ col: l.col, cmp: levelCompare(l) }))
  return rows.map((_, i) => i).sort((i, j) => {
    for (const { col, cmp } of cmps) {
      const d = cmp(rows[i][col] ?? null, rows[j][col] ?? null)
      if (d !== 0) return d
    }
    return i - j
  })
}

const ORDERS: Record<string, SortOrder> = {
  asc: 'asc', ascending: 'asc', 'a to z': 'asc', 'smallest to largest': 'asc', 'oldest to newest': 'asc',
  desc: 'desc', descending: 'desc', 'z to a': 'desc', 'largest to smallest': 'desc', 'newest to oldest': 'desc',
  custom: 'custom', 'custom list': 'custom',
}

// validate an untrusted setup (exercise data, dialog state)
export function parseSortSetup(raw: unknown): SortSetup | string {
  if (!raw || typeof raw !== 'object') return 'The sort setup is missing.'
  const r = raw as Record<string, unknown>
  if (typeof r.range !== 'string' || !r.range.trim()) return 'Sort needs a range (the list to sort).'
  if (r.headers !== undefined && typeof r.headers !== 'boolean') return 'Sort: "headers" must be true or false.'
  if (!Array.isArray(r.levels) || !r.levels.length) return 'Sort needs at least one level (Sort by).'
  const levels: SortLevel[] = []
  for (const [i, item] of r.levels.entries()) {
    if (!item || typeof item !== 'object') return `Sort level ${i + 1} is not valid.`
    const l = item as Record<string, unknown>
    if (typeof l.column !== 'string' || !l.column.trim()) return `Sort level ${i + 1} needs a column (a header or a column letter).`
    const order = l.order === undefined ? 'asc' : ORDERS[String(l.order).toLowerCase()]
    if (!order) return `Sort level ${i + 1}: order must be asc, desc or custom.`
    const list = l.list
    if (list !== undefined && typeof list !== 'string' && !(Array.isArray(list) && list.every(x => typeof x === 'string'))) {
      return `Sort level ${i + 1}: the custom list must be text such as "Low,Medium,High".`
    }
    if (order === 'custom' && !customListOf(list as string | string[] | undefined).length) {
      return `Sort level ${i + 1}: enter the custom list entries in order, e.g. Low,Medium,High.`
    }
    levels.push({ column: l.column.trim(), order, ...(list !== undefined ? { list: list as string | string[] } : {}) })
  }
  return { range: r.range.trim(), ...(r.headers !== undefined ? { headers: r.headers as boolean } : {}), levels }
}

// a level's column inside the block: header text first, then a column letter ('D' or 'Column D')
export function resolveColumn(column: string, block: Box, headers: readonly CellValue[] | null): number {
  if (headers) {
    const j = headers.findIndex(h => sameHeader(h, column))
    if (j >= 0) return j
  }
  const m = /^(?:column\s+)?([A-Za-z]{1,3})$/i.exec(column.trim())
  if (!m) return -1
  const j = colIndex(m[1]) - block.c1
  return j >= 0 && j <= block.c2 - block.c1 ? j : -1
}

// Excel's "My data has headers" guess: the first row is all text and some column below it is not text
export function looksLikeHeaders(block: readonly (readonly CellValue[])[]): boolean {
  const [top, ...rest] = block
  if (!top || !rest.length || top.some(v => isBlank(v) || typeof v !== 'string' || isErrorValue(v))) return false
  return top.some((_, j) => rest.some(r => !isBlank(r[j]) && typeof r[j] !== 'string')) || rest.every(r => r.every(v => typeof v === 'string' || isBlank(v)))
}

// the columns a Sort dialog offers: header text, or "Column D" without headers
export function sortColumns(sheet: LabSheet, range: string, headers: boolean): { key: string; label: string }[] {
  const b = boxIn(sheet, range, 'range')
  if (typeof b === 'string') return []
  const top = headers ? sheet.values(toRange({ ...b, r2: b.r1 }))[0] ?? [] : []
  return Array.from({ length: b.c2 - b.c1 + 1 }, (_, j) => {
    const letter = colLetter(b.c1 + j)
    const h = headerText(top[j])
    return headers && h ? { key: h, label: h } : { key: letter, label: `Column ${letter}` }
  })
}

// Data > Sort on a LabSheet
export function applySort(sheet: LabSheet, setup: Record<string, unknown>): EditResult {
  const parsed = parseSortSetup(setup)
  if (typeof parsed === 'string') return { ok: false, message: parsed }
  let block = boxIn(sheet, parsed.range, 'sort range')
  if (typeof block === 'string') return { ok: false, message: block }
  if (block.r1 === block.r2 && block.c1 === block.c2) block = currentRegionBox(sheet, toRef(block.r1, block.c1)) ?? block
  const hasHeaders = parsed.headers ?? true
  const data: Box = { ...block, r1: hasHeaders ? block.r1 + 1 : block.r1 }
  if (data.r1 > data.r2) return { ok: true }
  for (let r = data.r1; r <= data.r2; r++) {
    if (sheet.hiddenRows.has(r + 1)) return { ok: false, message: 'Some rows of this list are hidden by a filter. Clear the filter (show all rows) before sorting.' }
  }
  const headers = hasHeaders ? sheet.values(toRange({ ...block, r2: block.r1 }))[0] ?? [] : null
  const levels: ResolvedLevel[] = []
  for (const l of parsed.levels) {
    const col = resolveColumn(l.column, block, headers)
    if (col < 0) return { ok: false, message: `"${l.column}" is not a column of ${toRange(block)}.` }
    levels.push({ col, order: l.order ?? 'asc', ...(l.order === 'custom' ? { list: customListOf(l.list) } : {}) })
  }
  const values = sheet.values(toRange(data))
  const width = data.c2 - data.c1 + 1
  const raws = values.map((_, i) => Array.from({ length: width }, (_, j) => sheet.raw(toRef(data.r1 + i, data.c1 + j))))
  if (raws.some(line => line.some(raw => raw.startsWith('{')))) return { ok: false, message: 'This range holds a data table: Excel cannot sort part of a data table.' }
  if (raws.some((line, i) => line.some((raw, j) => raw === '' && !isBlank(values[i][j])))) {
    return { ok: false, message: 'This range holds the spilled results of an array formula. Sort the data the formula reads instead.' }
  }
  const order = sortOrder(values, levels)
  if (order.every((s, p) => s === p)) return { ok: true }
  const entries: Record<string, string> = {}
  order.forEach((s, p) => {
    for (let j = 0; j < width; j++) {
      const raw = raws[s][j]
      const next = raw.startsWith('=') && s !== p ? shiftFormula(raw, p - s, 0) : raw
      if (next !== raws[p][j]) entries[toRef(data.r1 + p, data.c1 + j)] = next
    }
  })
  const res = writeCells(sheet, entries)
  if (!res.ok) return res
  // number formats travel with the cells when a column mixes them
  for (let j = 0; j < width; j++) {
    const fmts = order.map((_, p) => sheet.fmt(toRef(data.r1 + p, data.c1 + j)))
    if (fmts.every(f => f === fmts[0])) continue
    order.forEach((s, p) => {
      if (fmts[s] !== fmts[p]) sheet.setFmt(toRef(data.r1 + p, data.c1 + j), fmts[s])
    })
  }
  return { ok: true }
}
