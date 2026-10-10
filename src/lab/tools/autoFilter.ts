// AutoFilter (Data > Filter): one filter per column, columns combined with AND; rows that fail are hidden.
// autoFilterRows is pure; applyAutoFilter runs it on a LabSheet and remembers the filters for the dialog.
//
// Setup (applyAutoFilter / applyTool('autofilter')):
//   { range: 'A8:K68',                       // the list incl. its header row; one cell = its current region
//     columns: [                             // empty list = clear every filter (show all rows)
//       { column: 'Region', filter: { type: 'values', values: ['North', 'West'], blanks?: false } },
//       { column: 'Qty', filter: { type: 'custom', rules: [{ op: 'ge', value: 10 }, { op: 'le', value: 20 }], join: 'and' } },
//       { column: 'Customer', filter: { type: 'custom', rules: [{ op: 'contains', value: 'Hotel' }] } },
//       { column: 'Revenue', filter: { type: 'top10', top: true, count: 5, percent: false } },
//       { column: 'I', filter: { type: 'average', above: true } } ] }
// column: header text or column letter. Custom ops: eq ne gt ge lt le (numbers, dates such as '1 Mar 2026', or text)
// and begins notBegins ends notEnds contains notContains (text, wildcards * ? ~). Between = ge AND le.
// Top 10 keeps ties at the cut-off; Top/Bottom n Percent keeps max(1, floor(n% of the numbers)) values plus ties.
// Above/Below Average and Top 10 look at every record of the column, like Excel.
import type { CellValue, EditResult, LabSheet } from '../types'
import { colIndex, toRange, toRef } from '../refs'
import {
  boxIn, currentRegionBox, isBlank, isErrorValue, numEq, operandValue, sameHeader, textCollator, valueKey, wildcardRegex,
} from './advFilter'
import type { Box } from './advFilter'

export type CustomOp = 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'begins' | 'notBegins' | 'ends' | 'notEnds' | 'contains' | 'notContains'
export interface CustomRule { op: CustomOp; value: string | number }

export type ColumnFilter =
  | { type: 'values'; values: CellValue[]; blanks?: boolean }
  | { type: 'custom'; rules: CustomRule[]; join?: 'and' | 'or' }
  | { type: 'top10'; top?: boolean; count: number; percent?: boolean }
  | { type: 'average'; above: boolean }

export interface AutoFilterColumn { column: string; filter: ColumnFilter }
export interface AutoFilterSetup { range: string; columns: AutoFilterColumn[] }

export const CUSTOM_OPS: readonly CustomOp[] = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'begins', 'notBegins', 'ends', 'notEnds', 'contains', 'notContains']
// Excel's Custom AutoFilter wording
export const OP_LABEL: Record<CustomOp, string> = {
  eq: 'equals', ne: 'does not equal', gt: 'is greater than', ge: 'is greater than or equal to', lt: 'is less than',
  le: 'is less than or equal to', begins: 'begins with', notBegins: 'does not begin with', ends: 'ends with',
  notEnds: 'does not end with', contains: 'contains', notContains: 'does not contain',
}

const cellText = (v: CellValue): string => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v === null ? '' : String(v))

// one Custom AutoFilter condition
export function ruleTest(rule: CustomRule): (v: CellValue) => boolean {
  const text = typeof rule.value === 'number' ? String(rule.value) : rule.value
  const num = typeof rule.value === 'number' ? rule.value : operandValue(text)
  const n = typeof num === 'number' ? num : undefined
  const textMatch = (mode: 'whole' | 'begins' | 'ends' | 'contains') => {
    const re = wildcardRegex(text, mode)
    return (v: CellValue) => typeof v !== 'number' && re.test(cellText(v))
  }
  const negate = (f: (v: CellValue) => boolean) => (v: CellValue) => !f(v)
  switch (rule.op) {
    case 'eq':
    case 'ne': {
      const whole = textMatch('whole')
      const eq = (v: CellValue): boolean => {
        if (text === '') return isBlank(v)
        if (n !== undefined && typeof v === 'number') return numEq(v, n)
        return whole(v)
      }
      return rule.op === 'eq' ? eq : negate(eq)
    }
    case 'gt':
    case 'ge':
    case 'lt':
    case 'le': {
      const cmp = (v: CellValue): number | undefined => {
        if (n !== undefined) return typeof v === 'number' ? (numEq(v, n) ? 0 : v - n) : undefined
        return typeof v === 'string' && v !== '' && !isErrorValue(v) ? textCollator.compare(v, text) : undefined
      }
      const op = rule.op
      return v => {
        const d = cmp(v)
        if (d === undefined) return false
        return op === 'gt' ? d > 0 : op === 'ge' ? d >= 0 : op === 'lt' ? d < 0 : d <= 0
      }
    }
    case 'begins': return textMatch('begins')
    case 'notBegins': return negate(textMatch('begins'))
    case 'ends': return textMatch('ends')
    case 'notEnds': return negate(textMatch('ends'))
    case 'contains': return textMatch('contains')
    case 'notContains': return negate(textMatch('contains'))
  }
}

// keep-test for one column, given every value of that column (Top 10 and averages need them all)
export function columnTest(filter: ColumnFilter, column: readonly CellValue[]): (v: CellValue) => boolean {
  switch (filter.type) {
    case 'values': {
      // typed items also match the numbers and dates they stand for ('20', '14 Feb 2026')
      const keys = new Set<string>()
      for (const x of filter.values) {
        keys.add(valueKey(x))
        const n = typeof x === 'string' ? operandValue(x) : undefined
        if (typeof n === 'number') keys.add(valueKey(n))
      }
      const blanks = filter.blanks || filter.values.some(v => typeof v === 'string' && v.trim().toLowerCase() === '(blanks)')
      return v => (isBlank(v) ? blanks || keys.has(valueKey(null)) : keys.has(valueKey(v)))
    }
    case 'custom': {
      // a second condition left empty is ignored, like the dialog's blank second row
      const used = filter.rules.length > 1 && filter.rules[1].value === '' ? filter.rules.slice(0, 1) : filter.rules
      const rules = used.map(ruleTest)
      if (!rules.length) return () => true
      return filter.join === 'or' ? v => rules.some(t => t(v)) : v => rules.every(t => t(v))
    }
    case 'top10': {
      const nums = column.filter((v): v is number => typeof v === 'number')
      if (!nums.length) return () => false
      const sorted = [...nums].sort((a, b) => (filter.top === false ? a - b : b - a))
      const k = filter.percent ? Math.max(1, Math.floor((sorted.length * filter.count) / 100)) : Math.floor(filter.count)
      if (k >= sorted.length) return v => typeof v === 'number'
      const cut = sorted[Math.max(0, k - 1)]
      return filter.top === false ? v => typeof v === 'number' && v <= cut : v => typeof v === 'number' && v >= cut
    }
    case 'average': {
      const nums = column.filter((v): v is number => typeof v === 'number')
      if (!nums.length) return () => false
      const mean = nums.reduce((s, x) => s + x, 0) / nums.length
      return filter.above ? v => typeof v === 'number' && v > mean : v => typeof v === 'number' && v < mean
    }
  }
}

// indices of the rows that stay visible
export function autoFilterRows(rows: readonly (readonly CellValue[])[], filters: readonly { col: number; filter: ColumnFilter }[]): number[] {
  const tests = filters.map(f => ({ col: f.col, test: columnTest(f.filter, rows.map(r => r[f.col] ?? null)) }))
  const out: number[] = []
  rows.forEach((r, i) => { if (tests.every(t => t.test(r[t.col] ?? null))) out.push(i) })
  return out
}

// ---------- setup validation ----------

const TYPES = ['values', 'custom', 'top10', 'average']

function parseFilter(raw: unknown, where: string): ColumnFilter | string {
  if (!raw || typeof raw !== 'object') return `${where}: the filter is missing.`
  const f = raw as Record<string, unknown>
  if (!TYPES.includes(String(f.type))) return `${where}: filter type must be one of ${TYPES.join(', ')}.`
  if (f.type === 'values') {
    if (!Array.isArray(f.values) || !f.values.every(v => v === null || ['string', 'number', 'boolean'].includes(typeof v))) return `${where}: list the values to keep.`
    return { type: 'values', values: f.values as CellValue[], ...(f.blanks === true ? { blanks: true } : {}) }
  }
  if (f.type === 'custom') {
    if (!Array.isArray(f.rules) || f.rules.length < 1 || f.rules.length > 2) return `${where}: a custom filter has one or two conditions.`
    const rules: CustomRule[] = []
    for (const r of f.rules) {
      const o = (r ?? {}) as Record<string, unknown>
      if (!CUSTOM_OPS.includes(o.op as CustomOp)) return `${where}: "${String(o.op)}" is not a filter operator (use ${CUSTOM_OPS.join(', ')}).`
      if (typeof o.value !== 'string' && typeof o.value !== 'number') return `${where}: each condition needs a value.`
      rules.push({ op: o.op as CustomOp, value: o.value })
    }
    if (f.join !== undefined && f.join !== 'and' && f.join !== 'or') return `${where}: join must be "and" or "or".`
    return { type: 'custom', rules, ...(f.join ? { join: f.join as 'and' | 'or' } : {}) }
  }
  if (f.type === 'top10') {
    const count = Number(f.count)
    const percent = f.percent === true
    if (!Number.isInteger(count) || count < 1 || count > (percent ? 100 : 500)) return `${where}: Top 10 needs a whole number from 1 to ${percent ? 100 : 500}.`
    return { type: 'top10', top: f.top !== false, count, percent }
  }
  return { type: 'average', above: f.above !== false }
}

export function parseAutoFilterSetup(raw: unknown): AutoFilterSetup | string {
  if (!raw || typeof raw !== 'object') return 'The filter setup is missing.'
  const r = raw as Record<string, unknown>
  if (typeof r.range !== 'string' || !r.range.trim()) return 'AutoFilter needs the list range (headers included).'
  if (r.columns !== undefined && !Array.isArray(r.columns)) return 'AutoFilter columns must be a list.'
  const columns: AutoFilterColumn[] = []
  for (const [i, c] of ((r.columns as unknown[] | undefined) ?? []).entries()) {
    const o = (c ?? {}) as Record<string, unknown>
    if (typeof o.column !== 'string' || !o.column.trim()) return `Filter ${i + 1} needs a column (a header or a column letter).`
    const filter = parseFilter(o.filter, `Filter on ${o.column}`)
    if (typeof filter === 'string') return filter
    columns.push({ column: o.column.trim(), filter })
  }
  return { range: r.range.trim(), columns }
}

// ---------- LabSheet adapter ----------

export interface ActiveAutoFilter { range: string; columns: AutoFilterColumn[]; shown: number; total: number }
const active = new WeakMap<LabSheet, ActiveAutoFilter>()

// the filters applied last on this sheet (for the dialog; not persisted: the hidden rows are)
export const getAutoFilter = (sheet: LabSheet): ActiveAutoFilter | undefined => active.get(sheet)

export function resolveListColumn(column: string, block: Box, headers: readonly CellValue[]): number {
  const j = headers.findIndex(h => sameHeader(h, column))
  if (j >= 0) return j
  const m = /^(?:column\s+)?([A-Za-z]{1,3})$/i.exec(column.trim())
  if (!m) return -1
  const k = colIndex(m[1]) - block.c1
  return k >= 0 && k <= block.c2 - block.c1 ? k : -1
}

export function applyAutoFilter(sheet: LabSheet, setup: Record<string, unknown>): EditResult {
  const parsed = parseAutoFilterSetup(setup)
  if (typeof parsed === 'string') return { ok: false, message: parsed }
  let block = boxIn(sheet, parsed.range, 'list range')
  if (typeof block === 'string') return { ok: false, message: block }
  if (block.r1 === block.r2 && block.c1 === block.c2) block = currentRegionBox(sheet, toRef(block.r1, block.c1)) ?? block
  const values = sheet.values(toRange(block))
  const headers = values[0] ?? []
  const rows = values.slice(1)
  const filters: { col: number; filter: ColumnFilter }[] = []
  for (const c of parsed.columns) {
    const col = resolveListColumn(c.column, block, headers)
    if (col < 0) return { ok: false, message: `"${c.column}" is not a column of ${toRange(block)}.` }
    filters.push({ col, filter: c.filter })
  }
  const visible = new Set(autoFilterRows(rows, filters).map(i => block.r1 + 2 + i))
  const hidden = [...sheet.hiddenRows].filter(r => r < block.r1 + 2 || r > block.r2 + 1)
  for (let r = block.r1 + 2; r <= block.r2 + 1; r++) if (!visible.has(r)) hidden.push(r)
  sheet.setHiddenRows(hidden)
  if (parsed.columns.length) active.set(sheet, { range: toRange(block), columns: parsed.columns, shown: visible.size, total: rows.length })
  else active.delete(sheet)
  return { ok: true }
}

// short description of a filter for lists and status messages
export function describeFilter(f: ColumnFilter): string {
  switch (f.type) {
    case 'values': return `${f.values.length + (f.blanks ? 1 : 0)} value${f.values.length + (f.blanks ? 1 : 0) === 1 ? '' : 's'} ticked`
    case 'custom': return f.rules.map(r => `${OP_LABEL[r.op]} ${r.value === '' ? '(blank)' : r.value}`).join(f.join === 'or' ? ' Or ' : ' And ')
    case 'top10': return `${f.top === false ? 'Bottom' : 'Top'} ${f.count} ${f.percent ? 'Percent' : 'Items'}`
    case 'average': return f.above ? 'Above Average' : 'Below Average'
  }
}
