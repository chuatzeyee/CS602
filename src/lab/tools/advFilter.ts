// Advanced Filter (Data > Advanced) with Excel's criteria-range rules, plus range helpers shared by the
// decision tools. filterList is pure; runAdvancedFilter / applyAdvancedFilter adapt it to a LabSheet.
//
// Criteria rules (site_build/notes/pivot_filter_notes.md 3.14):
// - a criteria column applies to the list column with the same header (trimmed, case-insensitive);
//   a blank header or one that is not a field name makes a computed criterion: its formula is written for the
//   first record (relative row refs) and evaluated for every record; TRUE (or a non-zero number) passes
// - blank criteria cell = no condition; one row = AND of its cells; rows are OR'ed; a blank row passes everything
// - operators =, <>, >, >=, <, <= (two-character ones first); numbers and dates (typed as text, e.g. >=1 Mar 2026)
//   compare by value; text with = / <> is a whole-cell match, without an operator it is "begins with";
//   wildcards * ? and ~ escapes; text is case-insensitive
// - Unique records only keeps the first of each duplicate (on the copied columns), in list order
// - Copy to: a blank cell copies every field; field names typed in its first row pick the columns and their order.
//   As many rows as needed are written below it and the previous extract there is cleared (values, not formulas)
import type { AdvFilterSetup, CellValue, EditResult, LabSheet } from '../types'
import { toEngineFormula } from '../engine/formulaText'
import { parseInput } from '../engine/input'
import { excelWildcard, type WildcardMatcher, type WildcardMode } from '../engine/glob'
import { boxesOverlap, colLetter, parseRange, shiftFormula, toRange, toRef } from '../refs'
import type { RangeBox } from '../refs'

// ---------- shared helpers (also used by autoFilter, sort and pivot) ----------

export type Box = RangeBox

export const isBlank = (v: CellValue | undefined): v is null | undefined | '' => v === null || v === undefined || v === ''

const ERROR_RE = /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|CYCLE!|ERROR!|SPILL!|CALC!|LIC!|GETTING_DATA)$/
// sheet.values() returns errors as their code strings
export const isErrorValue = (v: CellValue | undefined): boolean => typeof v === 'string' && ERROR_RE.test(v)

export const headerText = (v: CellValue | undefined): string => (v === null || v === undefined ? '' : String(v).trim())
export const sameHeader = (a: CellValue | undefined, b: CellValue | undefined): boolean => {
  const x = headerText(a)
  return x !== '' && x.toLowerCase() === headerText(b).toLowerCase()
}

// Excel compares text without regard to case
export const textCollator = new Intl.Collator('en', { sensitivity: 'accent' })

// identity of a value for unique records, checklists and pivot items: text ignores case
export function valueKey(v: CellValue | undefined): string {
  if (isBlank(v)) return 'z:'
  if (typeof v === 'number') return `n:${Number(v.toPrecision(15))}`
  if (typeof v === 'boolean') return `b:${v ? 1 : 0}`
  return isErrorValue(v) ? `e:${v}` : `s:${String(v).toLowerCase()}`
}

// 15 significant digits, like Excel's comparisons
export const numEq = (a: number, b: number): boolean => a === b || Number(a.toPrecision(15)) === Number(b.toPrecision(15))

// a typed operand as Excel reads it: 30, 12%, $1,200, 1 Mar 2026, 2026-03-01, 01/03/2026, TRUE
export function operandValue(text: string): number | boolean | undefined {
  if (text.trim() === '') return undefined
  const p = parseInput(text)
  return p.kind === 'value' && typeof p.value !== 'string' ? p.value : undefined
}

// wildcard pattern -> case-insensitive matcher: * any run, ? one character, ~ before a character makes it literal
// (engine/glob.ts: no RegExp, so a pattern with many stars cannot freeze the page)
export const wildcardRegex = (pattern: string, mode: WildcardMode): WildcardMatcher => excelWildcard(pattern, mode, true)

// 'C5:D9', '$A$8:$K$68', 'Orders!A8:K68' -> 0-based box inside the sheet, or a learner-facing problem
export function boxIn(sheet: Pick<LabSheet, 'rows' | 'cols' | 'name'>, text: string, what: string): Box | string {
  const trimmed = text.trim()
  if (!trimmed) return `Enter the ${what}.`
  const bang = trimmed.lastIndexOf('!')
  if (bang >= 0) {
    const name = trimmed.slice(0, bang).trim().replace(/^'(.*)'$/, '$1').replace(/''/g, "'")
    if (name.toLowerCase() !== sheet.name.toLowerCase()) return `The ${what} must be on this sheet (${sheet.name}).`
  }
  let b: Box
  try {
    b = parseRange(trimmed.slice(bang + 1).replace(/\s+/g, ''))
  } catch {
    return `The ${what} "${text.trim()}" is not a valid reference. Use a range such as A8:K68.`
  }
  if (b.r2 >= sheet.rows || b.c2 >= sheet.cols) {
    return `The ${what} ${toRange(b)} goes past the edge of the sheet (A1:${toRef(sheet.rows - 1, sheet.cols - 1)}).`
  }
  return b
}

const boxRows = (b: Box): number => b.r2 - b.r1 + 1
export const absRange = (b: Box): string =>
  b.r1 === b.r2 && b.c1 === b.c2
    ? `$${colLetter(b.c1)}$${b.r1 + 1}`
    : `$${colLetter(b.c1)}$${b.r1 + 1}:$${colLetter(b.c2)}$${b.r2 + 1}`

// Excel's current region (Ctrl+*): grow the box while any neighbouring cell, diagonals included, holds something
export function regionBox(filled: (r: number, c: number) => boolean, rows: number, cols: number, start: Box): Box {
  let { r1, c1, r2, c2 } = start
  const rowHas = (r: number, a: number, b: number) => {
    for (let c = Math.max(0, a); c <= Math.min(cols - 1, b); c++) if (filled(r, c)) return true
    return false
  }
  const colHas = (c: number, a: number, b: number) => {
    for (let r = Math.max(0, a); r <= Math.min(rows - 1, b); r++) if (filled(r, c)) return true
    return false
  }
  for (let grew = true; grew;) {
    grew = false
    if (r1 > 0 && rowHas(r1 - 1, c1 - 1, c2 + 1)) { r1--; grew = true }
    if (r2 < rows - 1 && rowHas(r2 + 1, c1 - 1, c2 + 1)) { r2++; grew = true }
    if (c1 > 0 && colHas(c1 - 1, r1 - 1, r2 + 1)) { c1--; grew = true }
    if (c2 < cols - 1 && colHas(c2 + 1, r1 - 1, r2 + 1)) { c2++; grew = true }
  }
  return { r1, c1, r2, c2 }
}

export function currentRegionBox(sheet: LabSheet, ref: string): Box | undefined {
  let start: Box
  try {
    start = parseRange(ref.split(',')[0] ?? '')
  } catch {
    return undefined
  }
  if (start.r2 >= sheet.rows || start.c2 >= sheet.cols) return undefined
  // a selected block is used as it is (Excel too); a single cell grows to its region
  if (start.r1 !== start.r2 || start.c1 !== start.c2) return start
  const grid = sheet.values(`A1:${toRef(sheet.rows - 1, sheet.cols - 1)}`)
  return regionBox((r, c) => !isBlank(grid[r]?.[c]), sheet.rows, sheet.cols, start)
}

// ---------- criteria ----------

export type CritOp = '=' | '<>' | '<' | '<=' | '>' | '>='

export interface Criterion {
  op?: CritOp            // undefined: a plain entry (number equality or "begins with")
  text: string           // the operand as typed
  num?: number           // operand read as a number or date
  bool?: boolean         // operand read as TRUE / FALSE
}

// one criteria cell -> condition; null when blank (no condition)
export function parseCriterion(value: CellValue): Criterion | null {
  if (isBlank(value)) return null
  if (typeof value === 'number') return { text: String(value), num: value }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', bool: value }
  const m = /^(>=|<=|<>|>|<|=)/.exec(value)
  const op = m ? (m[1] as CritOp) : undefined
  const text = m ? value.slice(m[1].length) : value
  const parsed = operandValue(text)
  return {
    ...(op ? { op } : {}),
    text,
    ...(typeof parsed === 'number' ? { num: parsed } : {}),
    ...(typeof parsed === 'boolean' ? { bool: parsed } : {}),
  }
}

const textOf = (v: CellValue): string => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v === null ? '' : String(v))

const regexCache = new Map<string, WildcardMatcher>()
function cachedRegex(pattern: string, mode: 'whole' | 'begins'): WildcardMatcher {
  const key = `${mode}\u0000${pattern}`
  let re = regexCache.get(key)
  if (!re) {
    if (regexCache.size > 500) regexCache.clear()
    re = wildcardRegex(pattern, mode)
    regexCache.set(key, re)
  }
  return re
}

// does a list value satisfy one criteria cell? numbers never match text patterns (wildcards are for text)
export function matchCriterion(c: Criterion, v: CellValue): boolean {
  const blank = isBlank(v)
  if (c.op === undefined) {
    if (c.num !== undefined && typeof v === 'number') return numEq(v, c.num)
    if (c.bool !== undefined && typeof v === 'boolean') return v === c.bool
    if (typeof v === 'number') return false
    return cachedRegex(c.text, 'begins').test(textOf(v))
  }
  if (c.op === '=' || c.op === '<>') {
    let hit: boolean
    if (c.text === '') hit = blank
    else if (c.num !== undefined && typeof v === 'number') hit = numEq(v, c.num)
    else if (c.bool !== undefined && typeof v === 'boolean') hit = v === c.bool
    else if (typeof v === 'number') hit = false
    else hit = cachedRegex(c.text, 'whole').test(textOf(v))
    return c.op === '=' ? hit : !hit
  }
  let cmp: number
  if (c.num !== undefined) {
    if (typeof v !== 'number') return false
    cmp = numEq(v, c.num) ? 0 : v - c.num
  } else {
    if (typeof v !== 'string' || blank || isErrorValue(v)) return false
    cmp = textCollator.compare(v, c.text)
  }
  return c.op === '>' ? cmp > 0 : c.op === '>=' ? cmp >= 0 : c.op === '<' ? cmp < 0 : cmp <= 0
}

const isTruthy = (v: CellValue): boolean => v === true || (typeof v === 'number' && v !== 0)

type Condition =
  | { kind: 'field'; col: number; crit: Criterion }
  | { kind: 'formula'; formula: string }
  | { kind: 'const'; value: CellValue }

export interface ListData { headers: CellValue[]; rows: CellValue[][] }
export interface CriteriaData {
  headers: CellValue[]
  rows: CellValue[][]
  formulas?: (string | null | undefined)[][]   // '=...' for criteria cells that hold a formula
}
export interface FilterInput {
  list: ListData
  criteria?: CriteriaData | null                // none: every record passes
  evaluate?: (formula: string, record: number) => CellValue   // computed criteria: formula shifted to record k
  unique?: boolean
  uniqueCols?: number[]                         // columns that decide duplicates (default: every column)
}
export interface FilterOutcome { matches: number[]; error?: string }

// header index per criteria column; -1 = computed criterion
function criteriaFields(listHeaders: CellValue[], criteriaHeaders: CellValue[]): number[] {
  return criteriaHeaders.map(h => (headerText(h) === '' ? -1 : listHeaders.findIndex(l => sameHeader(l, h))))
}

// indices of the matching records, in list order
export function filterList(input: FilterInput): FilterOutcome {
  const { list, criteria } = input
  const fields = criteria ? criteriaFields(list.headers, criteria.headers) : []
  const groups: Condition[][] = (criteria?.rows ?? []).map((line, i) => {
    const out: Condition[] = []
    fields.forEach((col, j) => {
      const v = line[j] ?? null
      const f = criteria?.formulas?.[i]?.[j]
      if (col >= 0) {
        const crit = parseCriterion(v)
        if (crit) out.push({ kind: 'field', col, crit })
      } else if (typeof f === 'string' && f.startsWith('=')) out.push({ kind: 'formula', formula: f })
      else if (!isBlank(v)) out.push({ kind: 'const', value: v })
    })
    return out
  })
  if (!input.evaluate && groups.some(g => g.some(c => c.kind === 'formula'))) {
    return { matches: [], error: 'Computed criteria need the formula engine.' }
  }
  const memo = new Map<string, boolean>()
  const test = (c: Condition, k: number, row: CellValue[]): boolean => {
    if (c.kind === 'field') return matchCriterion(c.crit, row[c.col] ?? null)
    if (c.kind === 'const') return isTruthy(c.value)
    const key = `${k}\u0000${c.formula}`
    let hit = memo.get(key)
    if (hit === undefined) {
      let out: CellValue = null
      try {
        out = input.evaluate ? input.evaluate(c.formula, k) : null
      } catch {
        out = null
      }
      hit = isTruthy(out)
      memo.set(key, hit)
    }
    return hit
  }
  const matches: number[] = []
  list.rows.forEach((row, k) => {
    if (groups.length === 0 || groups.some(g => g.every(c => test(c, k, row)))) matches.push(k)
  })
  if (!input.unique) return { matches }
  const cols = input.uniqueCols ?? list.headers.map((_, j) => j)
  const seen = new Set<string>()
  return {
    matches: matches.filter(k => {
      const key = cols.map(j => valueKey(list.rows[k][j] ?? null)).join('\u0001')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  }
}

// ---------- LabSheet adapters ----------

export interface AdvFilterRun {
  rows: number[]            // 1-based sheet rows of the matching records (header excluded)
  error?: string
  notes?: string[]          // learner hints about the criteria range (shown by the dialog)
  total?: number            // records in the list
  listRange?: string        // the list range actually used (a single cell grows to its current region)
}

interface Plan {
  list: Box
  criteria?: Box
  copyTo?: Box
  data: ListData
}

function planOf(sheet: LabSheet, setup: AdvFilterSetup): Plan | string {
  if (!setup || typeof setup.list !== 'string') return 'Enter the list range.'
  let list = boxIn(sheet, setup.list, 'list range')
  if (typeof list === 'string') return list
  if (list.r1 === list.r2 && list.c1 === list.c2) list = currentRegionBox(sheet, toRef(list.r1, list.c1)) ?? list
  const values = sheet.values(toRange(list))
  const headers = values[0] ?? []
  if (headers.every(h => headerText(h) === '')) return 'The first row of the list range must hold the field names (headers).'
  let criteria: Box | undefined
  if (typeof setup.criteria === 'string' && setup.criteria.trim() !== '') {
    const c = boxIn(sheet, setup.criteria, 'criteria range')
    if (typeof c === 'string') return c
    if (boxesOverlap(c, list)) return 'The criteria range overlaps the list range. Put the criteria above the list with at least one blank row between them.'
    criteria = c
  }
  let copyTo: Box | undefined
  if (typeof setup.copyTo === 'string' && setup.copyTo.trim() !== '') {
    const c = boxIn(sheet, setup.copyTo, 'Copy to range')
    if (typeof c === 'string') return c
    copyTo = c
  }
  return { list, criteria, copyTo, data: { headers, rows: values.slice(1) } }
}

interface Extract { cols: number[]; hasHeader: boolean; width: number }

// Copy to: blank single cell (or blank header row) = every column; otherwise the field names typed in its first row
function extractOf(sheet: LabSheet, copyTo: Box, headers: CellValue[]): Extract | string {
  const top = sheet.values(toRange({ r1: copyTo.r1, c1: copyTo.c1, r2: copyTo.r1, c2: copyTo.c2 }))[0] ?? []
  if (top.every(v => isBlank(v))) return { cols: headers.map((_, j) => j), hasHeader: false, width: headers.length }
  const cols: number[] = []
  for (const v of top) {
    const j = isBlank(v) ? -1 : headers.findIndex(h => sameHeader(h, v))
    if (j < 0) return 'The extract range has a missing or invalid field name.'
    cols.push(j)
  }
  return { cols, hasHeader: true, width: cols.length }
}

function criteriaNotes(sheet: LabSheet, criteria: Box, headers: CellValue[], fields: number[]): string[] {
  const notes: string[] = []
  const vals = sheet.values(toRange(criteria))
  const critHeaders = vals[0] ?? []
  for (let i = 1; i < vals.length; i++) {
    const line = vals[i] ?? []
    if (fields.every((_, j) => isBlank(line[j]) && !sheet.raw(toRef(criteria.r1 + i, criteria.c1 + j)).startsWith('='))) {
      notes.push(`Criteria row ${criteria.r1 + i + 1} is blank inside the criteria range, so every record passes. End the criteria range at the last filled row.`)
    }
    fields.forEach((col, j) => {
      const ref = toRef(criteria.r1 + i, criteria.c1 + j)
      const raw = sheet.raw(ref)
      const v = line[j] ?? null
      if (col >= 0 && v === '#NAME?' && raw.startsWith('=')) {
        notes.push(`${ref} shows #NAME?: an entry that starts with = is read as a formula. For an exact text match type ="${raw.replace(/"/g, '""')}".`)
      } else if (col >= 0 && typeof v === 'boolean' && raw.startsWith('=')) {
        notes.push(`${ref} holds a TRUE/FALSE formula under the field name "${headerText(headers[col])}", so Excel compares that field with ${v ? 'TRUE' : 'FALSE'}. A computed criterion needs a header that is blank or not a field name.`)
      } else if (col < 0 && !isBlank(v) && !raw.startsWith('=') && headerText(critHeaders[j]) !== '') {
        notes.push(`"${headerText(critHeaders[j])}" (${toRef(criteria.r1, criteria.c1 + j)}) is not a field name in the list, so ${ref} is read as a computed criterion. Check the header spelling.`)
      }
    })
  }
  return notes
}

interface Prepared { plan: Plan; run: AdvFilterRun; extract?: Extract }

function prepare(sheet: LabSheet, setup: AdvFilterSetup): Prepared | string {
  const plan = planOf(sheet, setup)
  if (typeof plan === 'string') return plan
  const { list, criteria, copyTo, data } = plan
  let extract: Extract | undefined
  if (copyTo) {
    const ex = extractOf(sheet, copyTo, data.headers)
    if (typeof ex === 'string') return ex
    extract = ex
  }
  let crit: CriteriaData | null = null
  let notes: string[] = []
  if (criteria) {
    const vals = sheet.values(toRange(criteria))
    const formulas = vals.slice(1).map((line, i) => line.map((_, j) => {
      const raw = sheet.raw(toRef(criteria.r1 + 1 + i, criteria.c1 + j))
      return raw.startsWith('=') ? raw : null
    }))
    crit = { headers: vals[0] ?? [], rows: vals.slice(1), formulas }
    notes = criteriaNotes(sheet, criteria, data.headers, criteriaFields(data.headers, crit.headers))
  }
  // computed criteria: the formula is written for the first record; shift it down to record k and evaluate it
  // with the sheet's engine (fire-and-forget: no cell is written, nothing enters the undo history). raw() is the
  // typed form (@, a SUMIF sum range Excel resizes), so it goes through toEngineFormula like a typed entry
  const evaluate = (formula: string, k: number): CellValue => {
    const out = sheet.hf.calculateFormula(toEngineFormula(k === 0 ? formula : shiftFormula(formula, k, 0)), sheet.sheetId)
    if (Array.isArray(out)) return null
    return typeof out === 'number' || typeof out === 'string' || typeof out === 'boolean' ? out : null
  }
  const res = filterList({ list: data, criteria: crit, evaluate, unique: setup.unique, uniqueCols: extract?.cols })
  if (res.error) return res.error
  const run: AdvFilterRun = {
    rows: res.matches.map(k => list.r1 + 2 + k),
    total: data.rows.length,
    listRange: toRange(list),
    ...(notes.length ? { notes } : {}),
  }
  return { plan, run, extract }
}

// matching records of the list (1-based sheet rows); the checker's criteria tasks call this
export function runAdvancedFilter(sheet: LabSheet, setup: AdvFilterSetup): AdvFilterRun {
  const p = prepare(sheet, setup)
  return typeof p === 'string' ? { rows: [], error: p } : p.run
}

// last row written by a copy-to run per sheet and destination, so a smaller re-run clears the old extract
const extracts = new WeakMap<LabSheet, Map<string, number>>()

// in place: hides the other records of the list; with copyTo: writes the matching records as values
export function applyAdvancedFilter(sheet: LabSheet, setup: AdvFilterSetup): EditResult {
  const p = prepare(sheet, setup)
  if (typeof p === 'string') return { ok: false, message: p }
  const { plan: { list, criteria, copyTo, data }, run, extract: ex } = p
  if (!copyTo || !ex) {
    const keep = new Set(run.rows)
    const hidden = [...sheet.hiddenRows].filter(r => r < list.r1 + 2 || r > list.r2 + 1)
    for (let r = list.r1 + 2; r <= list.r2 + 1; r++) if (!keep.has(r)) hidden.push(r)
    sheet.setHiddenRows(hidden)
    return { ok: true }
  }
  const records = run.rows.map(r => data.rows[r - list.r1 - 2])
  const body = records.map(rec => ex.cols.map(j => rec[j] ?? null))
  const block = ex.hasHeader ? body : [ex.cols.map(j => data.headers[j] ?? null), ...body]
  const startRow = ex.hasHeader ? copyTo.r1 + 1 : copyTo.r1
  const lastRow = copyTo.r1 + records.length
  const c2 = copyTo.c1 + ex.width - 1
  if (lastRow >= sheet.rows) {
    return { ok: false, message: `There is not enough room below ${toRef(copyTo.r1, copyTo.c1)} for ${records.length} records: the sheet ends at row ${sheet.rows}.` }
  }
  if (c2 >= sheet.cols) return { ok: false, message: `The ${ex.width} copied columns do not fit to the right of ${toRef(copyTo.r1, copyTo.c1)}.` }
  // the old extract: what this tool wrote last time here, or the filled block right below the new one
  const key = `${copyTo.r1},${copyTo.c1},${ex.width}`
  const memory = extracts.get(sheet) ?? new Map<string, number>()
  let staleEnd = Math.max(lastRow, memory.get(key) ?? -1)
  const below = lastRow + 1 < sheet.rows ? sheet.values(toRange({ r1: lastRow + 1, c1: copyTo.c1, r2: sheet.rows - 1, c2 })) : []
  for (let i = 0; i < below.length && below[i].some(v => !isBlank(v)); i++) staleEnd = Math.max(staleEnd, lastRow + 1 + i)
  const out: Box = { r1: copyTo.r1, c1: copyTo.c1, r2: Math.min(sheet.rows - 1, staleEnd), c2 }
  if (boxesOverlap(out, list)) return { ok: false, message: 'The Copy to range must be outside the list range.' }
  if (criteria && boxesOverlap(out, criteria)) return { ok: false, message: 'The Copy to range must not overlap the criteria range.' }
  if (block.length) {
    const res = sheet.setValues(toRef(startRow, copyTo.c1), block)
    if (!res.ok) return res
  }
  if (out.r2 > lastRow) sheet.clear(toRange({ r1: lastRow + 1, c1: out.c1, r2: out.r2, c2 }))
  memory.set(key, lastRow)
  extracts.set(sheet, memory)
  // the copied columns keep the list's number formats (dates, currency)
  ex.cols.forEach((j, i) => {
    const fmt = sheet.fmt(toRef(list.r1 + 1, list.c1 + j))
    if (!fmt || !records.length) return
    const col = copyTo.c1 + i
    const area: Box = { r1: copyTo.r1 + 1, c1: col, r2: lastRow, c2: col }
    const differs = Array.from({ length: boxRows(area) }, (_, k) => sheet.fmt(toRef(area.r1 + k, col))).some(f => f !== fmt)
    if (differs) sheet.setFmt(toRange(area), fmt)
  })
  return { ok: true }
}

// Data > Clear: show every row again (only the rows of `range` when given)
export function showAllRows(sheet: LabSheet, range?: string): void {
  const b = range ? boxIn(sheet, range, 'range') : undefined
  if (!b || typeof b === 'string') {
    sheet.setHiddenRows([])
    return
  }
  sheet.setHiddenRows([...sheet.hiddenRows].filter(r => r < b.r1 + 1 || r > b.r2 + 1))
}
