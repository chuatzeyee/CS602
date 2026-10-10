// PivotTable (Insert > PivotTable) written as values in Excel's default compact layout:
//   [report filters: Field | (All) / item / (Multiple Items), then a blank row; ABOVE the target, as in Excel]
//   Sum of Qty    | Column Labels |       |             <- only with column fields
//   Row Labels    | Cafe          | Hotel | Grand Total
//   Cold Brew ... | 18            |       | 167         <- no records for a combination: blank cell
//   Grand Total   | 263           | 359   | 1118
// Several row fields share the first column in outline order (each group row carries its subtotal, as in compact
// form). Several value fields: "Sum of Revenue", "Count of OrderID" ... side by side; with column fields they
// repeat under every column item and the totals are "Total Sum of Revenue". Items sort ascending like Excel
// (numbers, text A to Z, months and weekdays in calendar order, (blank) last). Refresh = create the pivot again.
import type { CellValue, EditResult, LabSheet, PivotAgg, PivotConfig, PivotSetup } from '../types'
import { boxesOverlap, inBox, toRange, toRef } from '../refs'
import { canonicalRaw } from '../engine/input'
import { writeCells } from '../sheet'
import { boxIn, currentRegionBox, headerText, isBlank, valueKey } from './advFilter'
import type { Box } from './advFilter'
import { builtinListFor, compareCells } from './sort'

export const AGG_LABEL: Record<PivotAgg, string> = { sum: 'Sum', count: 'Count', average: 'Average', max: 'Max', min: 'Min' }
export type PivotShow = 'value' | 'pctGrand' | 'pctRow' | 'pctCol'
export const SHOW_LABEL: Record<PivotShow, string> = {
  value: 'No Calculation',
  pctGrand: '% of Grand Total',
  pctRow: '% of Row Total',
  pctCol: '% of Column Total',
}
const AGGS = Object.keys(AGG_LABEL) as PivotAgg[]
const SHOWS = Object.keys(SHOW_LABEL) as PivotShow[]

export const PIVOT_FIELD_ERROR =
  'The PivotTable field name is not valid. To create a PivotTable report, you must use data that is organized as a list with labeled columns.'

export interface PivotOutput {
  cells: CellValue[][]                                   // rectangular block: report filters, blank row, then the table
  fmts: { row: number; col: number; fmt: string }[]      // '0.00%' for Show Values As, date formats on date items
  pageRows: number                                       // rows above the table (filters + 1 blank row), 0 without filters
}

interface Acc { sum: number; nums: number; count: number; max: number; min: number }
const round15 = (x: number): number => (Number.isFinite(x) ? Number(x.toPrecision(15)) : x)

function aggregate(acc: Acc | undefined, agg: PivotAgg): CellValue {
  if (!acc || acc.count === 0) return null
  switch (agg) {
    case 'sum': return round15(acc.sum)
    case 'count': return acc.count
    case 'average': return acc.nums ? round15(acc.sum / acc.nums) : '#DIV/0!'
    case 'max': return acc.nums ? acc.max : 0
    case 'min': return acc.nums ? acc.min : 0
  }
}

// header names with Excel's renaming of repeats (Revenue, Revenue2)
export function pivotFieldNames(headers: readonly CellValue[]): string[] {
  const seen = new Map<string, number>()
  return headers.map(h => {
    const name = headerText(h)
    const key = name.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n > 1 && name ? `${name}${n}` : name
  })
}

// "(blank)" for empty items
export const itemLabel = (v: CellValue): CellValue => (isBlank(v) ? '(blank)' : v)

// ascending item order of one field (custom lists for months / weekdays, blanks last)
function itemRanks(values: readonly CellValue[]): Map<string, number> {
  const firsts = new Map<string, CellValue>()
  for (const v of values) {
    const k = valueKey(v)
    if (!firsts.has(k)) firsts.set(k, v)
  }
  const items = [...firsts.entries()]
  const list = builtinListFor(items.map(([, v]) => v))
  const pos = list ? new Map(list.map((s, i) => [s.toLowerCase(), i])) : undefined
  items.sort(([, a], [, b]) => {
    if (pos && typeof a === 'string' && typeof b === 'string') return (pos.get(a.toLowerCase()) ?? 0) - (pos.get(b.toLowerCase()) ?? 0)
    return compareCells(a, b)
  })
  return new Map(items.map(([k], i) => [k, i]))
}

function includeKeys(include: readonly CellValue[]): Set<string> | null {
  if (!include.length) return null
  const keys = new Set<string>()
  for (const v of include) {
    keys.add(valueKey(v))
    if (typeof v === 'string') {
      if (v.trim().toLowerCase() === '(blank)') keys.add(valueKey(null))
      const n = Number(v.replace(/,/g, ''))
      if (v.trim() !== '' && Number.isFinite(n)) keys.add(valueKey(n))
    }
  }
  return keys
}

type Slot = { kind: 'item' | 'sub' | 'grand'; path: string[]; value: number }
type BodyRow = { label: CellValue; field: number; path: string[] }

const SEP = '\u0001'

// the pivot of a header row + records; throws an Error with a learner-facing message
export function pivotFromData(headers: readonly CellValue[], records: readonly (readonly CellValue[])[], config: PivotConfig, fieldFormats: readonly (string | undefined)[] = []): PivotOutput {
  const names = pivotFieldNames(headers)
  if (!names.length || names.some(n => n === '')) throw new Error(PIVOT_FIELD_ERROR)
  const field = (name: unknown, area: string): number => {
    const want = typeof name === 'string' ? name.trim().toLowerCase() : ''
    const j = names.findIndex(n => n.toLowerCase() === want)
    if (j < 0) throw new Error(`${area}: "${String(name)}" is not a field of the source data (fields: ${names.join(', ')}).`)
    return j
  }
  const rowF = config.rows.map(n => field(n, 'Rows'))
  const colF = config.columns.map(n => field(n, 'Columns'))
  const filterF = config.filters.map(f => ({ col: field(f.field, 'Filters'), keys: includeKeys(f.include ?? []), include: f.include ?? [] }))
  const placed = [...rowF, ...colF, ...filterF.map(f => f.col)]
  const twice = placed.find((j, i) => placed.indexOf(j) !== i)
  if (twice !== undefined) throw new Error(`"${names[twice]}" can be in only one of Filters, Rows and Columns.`)
  const vals = config.values.map(v => {
    if (!AGGS.includes(v.agg)) throw new Error(`Values: "${String(v.agg)}" is not a summary function (use ${AGGS.join(', ')}).`)
    const show = v.show ?? 'value'
    if (!SHOWS.includes(show)) throw new Error(`Values: "${String(show)}" is not a Show Values As option.`)
    return { col: field(v.field, 'Values'), agg: v.agg, show }
  })
  if (!rowF.length && !colF.length && !vals.length) throw new Error('Add fields to the Rows, Columns or Values area.')
  const captions: string[] = []
  for (const v of vals) {
    const base = `${AGG_LABEL[v.agg]} of ${names[v.col]}`
    let cap = base
    for (let n = 2; captions.includes(cap); n++) cap = `${base}${n}`
    captions.push(cap)
  }

  const kept = records.filter(r => filterF.every(f => f.keys === null || f.keys.has(valueKey(r[f.col] ?? null))))
  const labels = new Map<string, CellValue>()   // field|key -> first value seen
  const ranks = new Map<number, Map<string, number>>()
  for (const j of [...rowF, ...colF]) {
    ranks.set(j, itemRanks(kept.map(r => r[j] ?? null)))
    for (const r of kept) {
      const k = `${j}${SEP}${valueKey(r[j] ?? null)}`
      if (!labels.has(k)) labels.set(k, r[j] ?? null)
    }
  }
  const label = (j: number, key: string): CellValue => itemLabel(labels.get(`${j}${SEP}${key}`) ?? null)

  // accumulate every record into every (row prefix, column prefix) cell
  const accs = new Map<string, Acc>()
  const rowPaths = new Map<string, string[]>()
  const colPaths = new Map<string, string[]>()
  for (const r of kept) {
    const rp = rowF.map(j => valueKey(r[j] ?? null))
    const cp = colF.map(j => valueKey(r[j] ?? null))
    rowPaths.set(rp.join(SEP), rp)
    colPaths.set(cp.join(SEP), cp)
    for (let a = 0; a <= rp.length; a++) {
      for (let b = 0; b <= cp.length; b++) {
        const cell = `${rp.slice(0, a).join(SEP)}|${cp.slice(0, b).join(SEP)}|`
        vals.forEach((v, i) => {
          const x = r[v.col] ?? null
          const key = `${cell}${i}`
          let acc = accs.get(key)
          if (!acc) {
            acc = { sum: 0, nums: 0, count: 0, max: -Infinity, min: Infinity }
            accs.set(key, acc)
          }
          if (isBlank(x)) return
          acc.count++
          if (typeof x === 'number') {
            acc.sum += x
            acc.nums++
            acc.max = Math.max(acc.max, x)
            acc.min = Math.min(acc.min, x)
          }
        })
      }
    }
  }
  const byRank = (fields: number[]) => (p: string[], q: string[]) => {
    for (let i = 0; i < fields.length; i++) {
      const rk = ranks.get(fields[i])
      const d = (rk?.get(p[i]) ?? 0) - (rk?.get(q[i]) ?? 0)
      if (d) return d
    }
    return 0
  }
  const rowList = [...rowPaths.values()].sort(byRank(rowF))
  const colList = [...colPaths.values()].sort(byRank(colF))

  const cellValue = (rowPath: string[], colPath: string[], i: number): CellValue => {
    const v = vals[i]
    const at = (rp: string[], cp: string[]) => aggregate(accs.get(`${rp.join(SEP)}|${cp.join(SEP)}|${i}`), v.agg)
    const x = at(rowPath, colPath)
    if (v.show === 'value' || typeof x !== 'number') return x
    const base = v.show === 'pctGrand' ? at([], []) : v.show === 'pctRow' ? at(rowPath, []) : at([], colPath)
    if (typeof base !== 'number') return base
    return base === 0 ? '#DIV/0!' : round15(x / base)
  }

  // value columns
  const per = vals.length > 1 ? vals.map((_, i) => i) : [vals.length ? 0 : -1]
  const slots: Slot[] = []
  if (!colF.length) {
    if (vals.length) per.forEach(i => slots.push({ kind: 'item', path: [], value: i }))
  }
  else {
    colList.forEach((p, n) => {
      per.forEach(i => slots.push({ kind: 'item', path: p, value: i }))
      const next = colList[n + 1]
      for (let k = colF.length - 1; k >= 1; k--) {
        if (!next || next.slice(0, k).join(SEP) !== p.slice(0, k).join(SEP)) per.forEach(i => slots.push({ kind: 'sub', path: p.slice(0, k), value: i }))
      }
    })
    per.forEach(i => slots.push({ kind: 'grand', path: [], value: i }))
  }

  // body rows in outline order, group rows first
  const body: BodyRow[] = []
  rowList.forEach((p, n) => {
    const prev = rowList[n - 1]
    for (let k = 1; k < rowF.length; k++) {
      if (!prev || prev.slice(0, k).join(SEP) !== p.slice(0, k).join(SEP)) body.push({ label: label(rowF[k - 1], p[k - 1]), field: rowF[k - 1], path: p.slice(0, k) })
    }
    body.push({ label: label(rowF[rowF.length - 1], p[p.length - 1]), field: rowF[rowF.length - 1], path: p })
  })

  const grid: CellValue[][] = []
  const fmts: PivotOutput['fmts'] = []
  const fmtOf = (j: number) => fieldFormats[j]
  for (const f of filterF) {
    let shown: CellValue = '(All)'
    if (f.keys !== null) {
      // one item: its spelling in the data; several: Excel's (Multiple Items)
      const one = f.include.length === 1 ? records.find(r => valueKey(r[f.col] ?? null) === valueKey(f.include[0]))?.[f.col] ?? f.include[0] : undefined
      shown = one === undefined ? '(Multiple Items)' : itemLabel(one)
      if (typeof shown === 'number' && fmtOf(f.col)) fmts.push({ row: grid.length, col: 1, fmt: fmtOf(f.col) as string })
    }
    grid.push([names[f.col], shown])
  }
  if (filterF.length) grid.push([])
  const top = grid.length
  const pageRows = top
  const pctCols = new Set<number>()

  if (!rowF.length && !colF.length) {
    grid.push([...captions])
    grid.push(vals.map((_, i) => cellValue([], [], i)))
    vals.forEach((v, i) => { if (v.show !== 'value') pctCols.add(i) })
    for (const c of pctCols) fmts.push({ row: top + 1, col: c, fmt: '0.00%' })
    return { cells: rectangular(grid), fmts, pageRows }
  }

  const multi = vals.length > 1
  const capOf = (s: Slot) => (s.value >= 0 ? captions[s.value] : '')
  if (!colF.length) {
    grid.push([rowF.length ? 'Row Labels' : '', ...slots.map(capOf)])
  } else {
    const height = 1 + colF.length + (multi ? 1 : 0)
    const head: CellValue[][] = Array.from({ length: height }, () => new Array<CellValue>(slots.length + 1).fill(null))
    head[0][0] = vals.length === 1 ? captions[0] : null
    head[0][1] = 'Column Labels'
    if (rowF.length) head[height - 1][0] = 'Row Labels'
    slots.forEach((s, n) => {
      const c = n + 1
      const prev = slots[n - 1]
      if (s.kind === 'item') {
        s.path.forEach((key, lvl) => {
          const same = prev && prev.kind !== 'grand' && prev.path.length > lvl && prev.path.slice(0, lvl + 1).join(SEP) === s.path.slice(0, lvl + 1).join(SEP)
          if (!same) {
            head[1 + lvl][c] = label(colF[lvl], key)
            const f = fmtOf(colF[lvl])
            if (f && typeof labels.get(`${colF[lvl]}${SEP}${key}`) === 'number') fmts.push({ row: top + 1 + lvl, col: c, fmt: f })
          }
        })
        if (multi) head[height - 1][c] = capOf(s)
      } else if (s.kind === 'sub') {
        const lvl = s.path.length - 1
        const name = label(colF[lvl], s.path[lvl])
        head[1 + lvl][c] = multi ? `${String(name)} ${capOf(s)}` : `${String(name)} Total`
      } else head[1][c] = multi ? `Total ${capOf(s)}` : 'Grand Total'
    })
    grid.push(...head)
  }
  vals.forEach((v, i) => {
    if (v.show === 'value') return
    slots.forEach((s, n) => { if (s.value === i) pctCols.add(n + 1) })
  })
  const first = grid.length
  if (rowF.length) {
    for (const b of body) {
      grid.push([b.label, ...slots.map(s => (s.value >= 0 ? cellValue(b.path, s.path, s.value) : null))])
      const f = fmtOf(b.field)
      if (f && typeof b.label === 'number') fmts.push({ row: grid.length - 1, col: 0, fmt: f })
    }
    grid.push(['Grand Total', ...slots.map(s => (s.value >= 0 ? cellValue([], s.path, s.value) : null))])
  } else {
    grid.push([null, ...slots.map(s => (s.value >= 0 ? cellValue([], s.path, s.value) : null))])
  }
  for (let r = first; r < grid.length; r++) for (const c of pctCols) fmts.push({ row: r, col: c, fmt: '0.00%' })
  return { cells: rectangular(grid), fmts, pageRows }
}

function rectangular(grid: CellValue[][]): CellValue[][] {
  const width = Math.max(1, ...grid.map(r => r.length))
  return grid.map(r => [...r, ...new Array<CellValue>(width - r.length).fill(null)])
}

// ---------- config validation (exercise data and dialogs are untrusted) ----------

export function parsePivotConfig(raw: unknown): PivotConfig | string {
  if (!raw || typeof raw !== 'object') return 'The PivotTable layout is missing.'
  const r = raw as Record<string, unknown>
  const names = (x: unknown, area: string): string[] | string => {
    if (x === undefined) return []
    if (!Array.isArray(x) || !x.every(s => typeof s === 'string')) return `${area} must be a list of field names.`
    return x as string[]
  }
  const rows = names(r.rows, 'Rows')
  if (typeof rows === 'string') return rows
  const columns = names(r.columns, 'Columns')
  if (typeof columns === 'string') return columns
  const values: PivotConfig['values'] = []
  if (r.values !== undefined && !Array.isArray(r.values)) return 'Values must be a list of { field, agg }.'
  for (const v of (r.values as unknown[] | undefined) ?? []) {
    if (!v || typeof v !== 'object') return 'Each value field needs a field name and a summary function.'
    const o = v as Record<string, unknown>
    if (typeof o.field !== 'string') return 'Each value field needs a field name.'
    const agg = (o.agg ?? 'sum') as PivotAgg
    if (!AGGS.includes(agg)) return `"${String(o.agg)}" is not a summary function (use ${AGGS.join(', ')}).`
    const show = (o.show ?? 'value') as PivotShow
    if (!SHOWS.includes(show)) return `"${String(o.show)}" is not a Show Values As option.`
    values.push({ field: o.field, agg, ...(show !== 'value' ? { show } : {}) })
  }
  const filters: PivotConfig['filters'] = []
  if (r.filters !== undefined && !Array.isArray(r.filters)) return 'Filters must be a list of { field, include }.'
  for (const f of (r.filters as unknown[] | undefined) ?? []) {
    if (!f || typeof f !== 'object' || typeof (f as Record<string, unknown>).field !== 'string') return 'Each report filter needs a field name.'
    const o = f as Record<string, unknown>
    const include = o.include === undefined ? [] : o.include
    if (!Array.isArray(include) || !include.every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x))) return 'A report filter\'s include list must hold the items to show.'
    filters.push({ field: o.field as string, include: include as CellValue[] })
  }
  return { rows, columns, values, filters }
}

// ---------- LabSheet adapters ----------

function sourceOf(sheet: LabSheet, source: string): { box: Box; headers: CellValue[]; records: CellValue[][]; fmts: (string | undefined)[] } | string {
  let box = boxIn(sheet, source, 'source range')
  if (typeof box === 'string') return box
  if (box.r1 === box.r2 && box.c1 === box.c2) box = currentRegionBox(sheet, toRef(box.r1, box.c1)) ?? box
  const values = sheet.values(toRange(box))
  if (values.length < 2) return 'The source range needs a header row and at least one record.'
  const fmts = (values[0] ?? []).map((_, j) => sheet.fmt(toRef(box.r1 + 1, box.c1 + j)))
  return { box, headers: values[0] ?? [], records: values.slice(1), fmts }
}

// the pivot block as values (CONTRACTS: Excel layout with headers and Grand Totals); throws on a bad layout
export function buildPivot(sheet: LabSheet, setup: { source: string; config: PivotConfig }): CellValue[][] {
  const src = sourceOf(sheet, setup.source)
  if (typeof src === 'string') throw new Error(src)
  const config = parsePivotConfig(setup.config)
  if (typeof config === 'string') throw new Error(config)
  return pivotFromData(src.headers, src.records, config, src.fmts).cells
}

// fields of a source range for the dialog: name, whether it holds numbers, its items (sorted, for report filters)
export interface PivotField { name: string; numeric: boolean; items: CellValue[]; fmt?: string }
export function pivotFields(sheet: LabSheet, source: string): PivotField[] | string {
  const src = sourceOf(sheet, source)
  if (typeof src === 'string') return src
  const names = pivotFieldNames(src.headers)
  if (names.some(n => n === '')) return PIVOT_FIELD_ERROR
  return names.map((name, j) => {
    const col = src.records.map(r => r[j] ?? null)
    const ranks = itemRanks(col)
    const firsts = new Map<string, CellValue>()
    for (const v of col) if (!firsts.has(valueKey(v))) firsts.set(valueKey(v), v)
    const items = [...firsts.entries()].sort((a, b) => (ranks.get(a[0]) ?? 0) - (ranks.get(b[0]) ?? 0)).map(([, v]) => v)
    const filled = col.filter(v => !isBlank(v))
    return { name, numeric: filled.length > 0 && filled.every(v => typeof v === 'number'), items, ...(src.fmts[j] ? { fmt: src.fmts[j] } : {}) }
  })
}

// Excel places the table at the target and its report filters above it: the last filter two rows up, one blank row
// before the table. With no room above (a target in row 1 or 2) the table moves down until the filters fit from row 1.
export function pivotArea(target: { r1: number; c1: number }, out: Pick<PivotOutput, 'cells' | 'pageRows'>): Box {
  const r1 = Math.max(0, target.r1 - out.pageRows)
  return { r1, c1: target.c1, r2: r1 + out.cells.length - 1, c2: target.c1 + (out.cells[0]?.length ?? 1) - 1 }
}

// what each sheet's last pivot at a target covered, so "create again" clears leftovers and stale formats
const placed = new WeakMap<LabSheet, Map<string, { box: Box; fmts: string[] }>>()

// Excel's "There's already data in M3:R10. Do you want to replace it?": the filled cells the new pivot would cover,
// ignoring the previous pivot created at the same target; null when the area is free (or the setup is invalid)
export function pivotConflict(sheet: LabSheet, setup: PivotSetup): string | null {
  const src = sourceOf(sheet, setup.source)
  const config = parsePivotConfig(setup.config)
  const target = boxIn(sheet, setup.target, 'target cell')
  if (typeof src === 'string' || typeof config === 'string' || typeof target === 'string') return null
  let out: PivotOutput
  try {
    out = pivotFromData(src.headers, src.records, config, src.fmts)
  } catch {
    return null
  }
  const full = pivotArea(target, out)
  const area: Box = { ...full, r2: Math.min(sheet.rows - 1, full.r2), c2: Math.min(sheet.cols - 1, full.c2) }
  const before = placed.get(sheet)?.get(toRef(target.r1, target.c1))
  const values = sheet.values(toRange(area))
  const filled = values.some((line, i) => line.some((v, j) => !isBlank(v) && !(before && inBox(before.box, area.r1 + i, area.c1 + j))))
  return filled ? toRange(area) : null
}

// writes the pivot for setup.target as values (one undo step) plus its number formats
export function applyPivot(sheet: LabSheet, setup: PivotSetup): EditResult {
  if (!setup || typeof setup !== 'object') return { ok: false, message: 'The PivotTable setup is missing.' }
  if (typeof setup.source !== 'string') return { ok: false, message: 'Choose the table or range to analyse.' }
  if (typeof setup.target !== 'string') return { ok: false, message: 'Choose where the PivotTable goes (a target cell).' }
  const src = sourceOf(sheet, setup.source)
  if (typeof src === 'string') return { ok: false, message: src }
  const config = parsePivotConfig(setup.config)
  if (typeof config === 'string') return { ok: false, message: config }
  const target = boxIn(sheet, setup.target, 'target cell')
  if (typeof target === 'string') return { ok: false, message: target }
  let out: PivotOutput
  try {
    out = pivotFromData(src.headers, src.records, config, src.fmts)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The PivotTable could not be built.' }
  }
  const h = out.cells.length
  const w = out.cells[0]?.length ?? 1
  const at = toRef(target.r1, target.c1)
  const area = pivotArea(target, out)
  if (area.r2 >= sheet.rows || area.c2 >= sheet.cols) {
    return { ok: false, message: `The PivotTable needs ${h} rows x ${w} columns from ${toRef(area.r1, area.c1)}, which goes past the edge of the sheet. Choose a target with more room.` }
  }
  if (boxesOverlap(area, src.box)) return { ok: false, message: `A PivotTable cannot overlap its source data (${toRange(src.box)}). Choose a target cell outside it.` }
  const memory = placed.get(sheet) ?? new Map<string, { box: Box; fmts: string[] }>()
  const before = memory.get(at)
  // the new block, plus blanks where the previous pivot at this target reached beyond it: one undo step
  const entries: Record<string, string> = {}
  if (before) {
    for (let r = before.box.r1; r <= Math.min(before.box.r2, sheet.rows - 1); r++) {
      for (let c = before.box.c1; c <= Math.min(before.box.c2, sheet.cols - 1); c++) if (!inBox(area, r, c)) entries[toRef(r, c)] = ''
    }
  }
  out.cells.forEach((line, i) => line.forEach((v, j) => { entries[toRef(area.r1 + i, area.c1 + j)] = canonicalRaw(v) }))
  const res = writeCells(sheet, entries)
  if (!res.ok) return res
  const wanted = new Map(out.fmts.map(f => [toRef(area.r1 + f.row, area.c1 + f.col), f.fmt]))
  for (const ref of before?.fmts ?? []) if (!wanted.has(ref)) sheet.setFmt(ref, undefined)
  // one setFmt per vertical run of the same format
  const runs = new Map<string, number[]>()
  for (const f of out.fmts) {
    const key = `${f.col}${SEP}${f.fmt}`
    runs.set(key, [...(runs.get(key) ?? []), f.row])
  }
  for (const [key, list] of runs) {
    const [colText, fmt] = key.split(SEP)
    const col = area.c1 + Number(colText)
    const sorted = [...list].sort((a, b) => a - b)
    let start = sorted[0]
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) continue
      const r1 = area.r1 + start
      const r2 = area.r1 + sorted[i - 1]
      const range = toRange({ r1, c1: col, r2, c2: col })
      const already = Array.from({ length: r2 - r1 + 1 }, (_, k) => sheet.fmt(toRef(r1 + k, col))).every(f => f === fmt)
      if (!already) sheet.setFmt(range, fmt)
      if (i < sorted.length) start = sorted[i]
    }
  }
  memory.set(at, { box: area, fmts: [...wanted.keys()] })
  placed.set(sheet, memory)
  return { ok: true }
}
