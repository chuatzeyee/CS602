// sheet.ts - LabSheet: one live HyperFormula sheet with Excel-like entry, formats, fill, copy/paste, undo,
// data tables ("automatic except tables") and iterative calculation. See API_NOTES.md.
import { CellType, CellValueDetailedType, DetailedCellError, ErrorType, HyperFormula } from 'hyperformula'
import type { RawCellContent, SimpleCellAddress } from 'hyperformula'
import { EXCEL_CONFIG, EXCEL_NAMED_EXPRESSIONS, registerExcelPack } from './engine/excelPack'
import { RandomSource, registerSeededRandom } from './engine/seededRandom'
import { readCell } from './engine/workbook'
import { iterateCircular } from './engine/whatIf'
import { canonicalRaw, parseInput } from './engine/input'
import { toDisplayFormula } from './engine/formulaText'
import { formatNumber } from './engine/format'
import { computeDataTable, planDataTable } from './engine/dataTable'
import type { TablePlan } from './engine/dataTable'
import { GRID_COLS, GRID_ROWS, MAX_NESTING, MAX_TEXT, lengthProblem, nestingDepth } from './engine/limits'
import { boxesOverlap, inBox, normRef, parseRange, parseRef, refPastEdge, toRange, toRef } from './refs'
import type { RangeBox } from './refs'
import type { CellRead, CellSpec, CellValue, DataTableDef, EditResult, LabSheet, LearnerState, Role, SheetSpec } from './types'

const MAX_ROWS = GRID_ROWS
const MAX_COLS = GRID_COLS
const SCRATCH = '__lab'
const UNDO_LIMIT = 100
const LOCKED: ReadonlySet<Role> = new Set<Role>(['label', 'header', 'given', 'note'])
const OK: EditResult = { ok: true }
const fail = (message: string): EditResult => ({ ok: false, message })

interface CellChange { ref: string; before: string; after: string }
interface FmtChange { ref: string; before?: string; after?: string }
interface Step { cells: CellChange[]; fmts: FmtChange[]; tables?: { before: DataTableDef[]; after: DataTableDef[] }; group?: Step[] }
interface Internals { write(entries: [string, string][], force: boolean): EditResult; group<T>(fn: () => T): T }

const internals = new WeakMap<LabSheet, Internals>()

/** Write several raw entries (any cells, e.g. 'B4:D4,F4' Solver results) as ONE undo step.
 *  force: also writes locked cells (checker/test-case use only). */
export function writeCells(sheet: LabSheet, entries: Record<string, string>, opts: { force?: boolean } = {}): EditResult {
  const inner = internals.get(sheet)
  return inner ? inner.write(Object.entries(entries), opts.force ?? false) : fail('Not a lab sheet.')
}

/** Run several mutations (a fill, writeCells, setFmt ...) as ONE undo step: one learner action, one Undo. */
export function asOneStep<T>(sheet: LabSheet, fn: () => T): T {
  const inner = internals.get(sheet)
  return inner ? inner.group(fn) : fn()
}

const isPercentFormat = (fmt: string | undefined): boolean => fmt !== undefined && fmt.replace(/"[^"]*"/g, '').includes('%')
const clampInt = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.floor(Number.isFinite(n) ? n : lo)))
const tableKey = (d: DataTableDef): string => `${d.range}|${d.rowInput ?? ''}|${d.colInput ?? ''}`
const byPosition = (a: string, b: string): number => {
  const p = parseRef(a)
  const q = parseRef(b)
  return p.row - q.row || p.col - q.col
}

function specContent(cell: CellSpec): RawCellContent {
  if (typeof cell.f === 'string' && cell.f.trim() !== '') return cell.f.trim().startsWith('=') ? cell.f.trim() : `=${cell.f.trim()}`
  const v = cell.v
  if (typeof v === 'string') return v === '' ? null : `'${v}`
  return v ?? null
}

function engineContent(value: string | number | boolean): RawCellContent {
  return typeof value === 'string' ? `'${value}` : value
}

function formulaProblem(hf: HyperFormula, formula: string): string | undefined {
  const far = refPastEdge(formula, MAX_ROWS, MAX_COLS)
  if (far) return `${far} is past the edge of the lab's sheet: formulas can refer to rows 1 to ${MAX_ROWS.toLocaleString('en-US')} and columns A to Z.`
  if (nestingDepth(formula) > MAX_NESTING) return `There is a problem with this formula: it nests brackets more than ${MAX_NESTING} levels deep, the most Excel allows.`
  try {
    if (hf.validateFormula(formula)) return undefined
  } catch {
    return 'There is a problem with this formula: the engine cannot read it. Check the brackets, commas and quotes.'
  }
  const outside = formula.replace(/"(?:[^"]|"")*"/g, '""')
  if ((outside.match(/"/g) ?? []).length % 2 === 1) return 'There is a problem with this formula: a text value is missing its closing quote (").'
  const open = (outside.match(/\(/g) ?? []).length
  const close = (outside.match(/\)/g) ?? []).length
  if (open > close) return 'There is a problem with this formula: a closing bracket ")" is missing.'
  if (close > open) return 'There is a problem with this formula: there is an extra closing bracket ")".'
  if (/[-+*/^&=<>,(]\s*$/.test(formula)) return 'There is a problem with this formula: it ends with an operator or comma. Finish it or remove the extra symbol.'
  return 'There is a problem with this formula: check the brackets, commas and quotes.'
}

type BuildOptions = { state?: LearnerState; seed?: number }

export function createLabSheet(spec: SheetSpec, opts: BuildOptions = {}): LabSheet {
  if (!opts.state) return buildSheet(spec, opts)
  try {
    return buildSheet(spec, opts)
  } catch {
    return buildSheet(spec, { ...opts, state: salvage(spec, opts.state, opts.seed) })
  }
}

// a saved state the engine refused while computing (stored by an older version, or edited by hand): keep what loads,
// entry by entry, so one bad entry does not cost the rest. A refusal can leave an engine unusable, so the probe sheet
// is rebuilt from the entries kept so far after each one. A broken spec still throws.
function salvage(spec: SheetSpec, state: LearnerState, seed?: number): LearnerState {
  const kept: Record<string, string> = {}
  let probe = buildSheet(spec, { seed })
  try {
    for (const [ref, raw] of Object.entries(state.edits ?? {})) {
      if (typeof raw !== 'string') continue
      let threw = false
      try {
        if (writeCells(probe, { [ref]: raw }).ok) kept[ref] = raw
      } catch {
        threw = true
      }
      if (threw) {
        probe.destroy()
        probe = buildSheet(spec, { seed, state: { edits: kept } })
      }
    }
  } finally {
    probe.destroy()
  }
  const { dataTables, ...rest } = state
  const next: LearnerState = { ...rest, edits: kept }
  if (!dataTables) return next
  try {
    buildSheet(spec, { seed, state: { ...next, dataTables } }).destroy()
    return { ...next, dataTables }
  } catch {
    return next // a data table that cannot run is dropped as well
  }
}

function buildSheet(spec: SheetSpec, opts: BuildOptions): LabSheet {
  registerExcelPack() // plugins are global and must exist before the engine is built
  registerSeededRandom()
  const name = spec.name ?? 'Sheet1'
  const rows = clampInt(spec.rows, 1, MAX_ROWS)
  const cols = clampInt(spec.cols, 1, MAX_COLS)
  const lastRef = toRef(rows - 1, cols - 1)
  const specCells = new Map<string, CellSpec>()
  const grid: RawCellContent[][] = []
  for (const [key, cell] of Object.entries(spec.cells ?? {})) {
    const p = parseRef(key)
    if (p.row >= rows || p.col >= cols) throw new Error(`Spec cell ${key} is outside the ${rows}x${cols} sheet`)
    const ref = toRef(p.row, p.col)
    specCells.set(ref, cell)
    while (grid.length <= p.row) grid.push([])
    const line = grid[p.row]
    while (line.length <= p.col) line.push(null)
    line[p.col] = specContent(cell)
  }
  const random = new RandomSource(opts.seed ?? spec.seed ?? 1, false) // teaching mode: RAND changes only on recalc()
  const names = [...EXCEL_NAMED_EXPRESSIONS, ...Object.entries(spec.names ?? {}).map(([n, expression]) => ({ name: n, expression }))]
  // the engine's size limits are the lab's grid: SEQUENCE(5000,5000) is #VALUE! and a range past Z1000 is refused at entry
  const config = { ...EXCEL_CONFIG, maxRows: MAX_ROWS, maxColumns: MAX_COLS, undoLimit: 0, context: { random } }
  const hf = HyperFormula.buildFromSheets({ [name]: grid, [SCRATCH]: [[0]] }, config, names)
  const sheetId = hf.getSheetId(name) ?? 0
  const scratchAt: SimpleCellAddress = { sheet: hf.getSheetId(SCRATCH) ?? 1, row: 0, col: 0 }

  let version = 0
  let dead = false
  let pokes = 0
  const listeners = new Set<() => void>()
  const learnerFmts = new Map<string, string>()
  const entered = new Map<string, string>()       // typed text of constants ('12%') while the engine still holds that value
  const circular = new Map<string, string>()      // iterative mode: cells whose formula is replaced by its iterated value
  let tables: TablePlan[] = []
  let bodyCells = new Set<string>()
  let hidden: ReadonlySet<number> = new Set<number>()
  let iterativeOn = false
  let clip: RangeBox | null = null
  const undoStack: Step[] = []
  const redoStack: Step[] = []
  let commits = 0 // steps committed so far (the stack itself drops its oldest steps)

  const at = (row: number, col: number): SimpleCellAddress => ({ sheet: sheetId, row, col })
  const inside = (row: number, col: number): boolean => row >= 0 && col >= 0 && row < rows && col < cols
  const specFmt = (ref: string): string | undefined => specCells.get(ref)?.fmt
  const fmtOf = (ref: string): string | undefined => learnerFmts.get(ref) ?? specFmt(ref)

  function cellOf(text: string): { row: number; col: number; ref: string } | string {
    let p
    try {
      p = parseRef(text)
    } catch {
      return `"${text}" is not a cell reference.`
    }
    if (!inside(p.row, p.col)) return `${toRef(p.row, p.col)} is outside the sheet (A1:${lastRef}).`
    return { row: p.row, col: p.col, ref: toRef(p.row, p.col) }
  }
  function boxOf(text: string): RangeBox | string {
    let b
    try {
      b = parseRange(text)
    } catch {
      return `"${text}" is not a range.`
    }
    if (!inside(b.r2, b.c2)) return `${toRange(b)} goes past the edge of the sheet (A1:${lastRef}).`
    return b
  }
  function tableAt(row: number, col: number): TablePlan | undefined {
    return tables.find((t) => inBox(t.body, row, col))
  }
  function lockReason(ref: string): string | undefined {
    const role = specCells.get(ref)?.role
    if (role === 'given') return `${ref} holds given data, so it is locked.`
    if (role && LOCKED.has(role)) return `${ref} is a label, so it is locked.`
    if (bodyCells.has(ref)) return `${ref} is part of a data table: you cannot change part of a data table.`
    return undefined
  }

  // formulas are shown as typed: @ and resized SUMIF ranges live only in the engine's form (engine/formulaText.ts)
  function rawAt(row: number, col: number): string {
    const ref = toRef(row, col)
    const loop = circular.get(ref)
    if (loop !== undefined) return toDisplayFormula(loop)
    const table = tableAt(row, col)
    if (table) return `{=TABLE(${table.def.rowInput ?? ''},${table.def.colInput ?? ''})}`
    const a = at(row, col)
    if (hf.doesCellHaveFormula(a)) return toDisplayFormula(hf.getCellFormula(a) ?? '')
    if (hf.getCellType(a) === CellType.ARRAY) return '' // spilled from a dynamic-array formula: no content of its own
    const s = hf.getCellSerialized(a)
    if (s === null || s === undefined || s === '') return ''
    if (typeof s === 'string' && !s.startsWith("'")) return s // error literal
    const value = typeof s === 'string' ? s.slice(1) : s
    const typed = entered.get(ref)
    if (typed !== undefined) {
      const p = parseInput(typed)
      if (p.kind === 'value' && p.value === value) return typed
    }
    return canonicalRaw(value as string | number | boolean)
  }

  function bump(): void {
    version += 1
    for (const listener of [...listeners]) listener()
  }

  // the engine does not re-spill a blocked dynamic array when its blocker is cleared: enter those formulas again
  function respill(): void {
    const anchors: [number, number, string][] = []
    hf.getSheetValues(sheetId).forEach((line, r) => line.forEach((v, c) => {
      if (v instanceof DetailedCellError && v.type === ErrorType.SPILL && hf.doesCellHaveFormula(at(r, c))) anchors.push([r, c, hf.getCellFormula(at(r, c)) ?? ''])
    }))
    if (anchors.length) hf.batch(() => anchors.forEach(([r, c, f]) => hf.setCellContents(at(r, c), [[f]])))
  }

  function applyCells(changes: readonly CellChange[], dir: 'before' | 'after'): void {
    if (!changes.length) return
    const clears = changes.some((ch) => ch[dir].trim() === '')
    hf.batch(() => {
      for (const ch of changes) {
        const { row, col } = parseRef(ch.ref)
        const raw = ch[dir]
        const p = parseInput(raw)
        circular.delete(ch.ref)
        let content: RawCellContent = null
        if (p.kind === 'formula') content = p.formula
        else if (p.kind === 'value') content = engineContent(p.value)
        if (p.kind === 'value' && raw !== canonicalRaw(p.value)) entered.set(ch.ref, raw)
        else entered.delete(ch.ref)
        hf.setCellContents(at(row, col), [[content]])
      }
    })
    if (clears) respill()
  }
  function applyFmts(changes: readonly FmtChange[], dir: 'before' | 'after'): void {
    for (const ch of changes) {
      const code = ch[dir]
      if (code === undefined) learnerFmts.delete(ch.ref)
      else learnerFmts.set(ch.ref, code)
    }
  }

  // iterative calculation: put formulas back before a change, re-solve the loops after it
  function unwind(): void {
    if (!circular.size) return
    const loops = [...circular]
    circular.clear()
    hf.batch(() => loops.forEach(([ref, f]) => {
      const { row, col } = parseRef(ref)
      hf.setCellContents(at(row, col), [[f]])
    }))
  }
  function cycleMembers(): string[] {
    const own: string[] = []
    const all: string[] = []
    hf.getSheetValues(sheetId).forEach((line, r) => line.forEach((v, c) => {
      if (!(v instanceof DetailedCellError) || v.type !== ErrorType.CYCLE || !inside(r, c) || !hf.doesCellHaveFormula(at(r, c))) return
      const ref = toRef(r, c)
      all.push(ref)
      if (v.address === undefined || v.address.endsWith(`!${ref}`)) own.push(ref)
    }))
    return own.length ? own : all
  }
  function settle(): void {
    if (!iterativeOn) return
    const members = cycleMembers()
    if (!members.length) return
    for (const ref of members) {
      const { row, col } = parseRef(ref)
      circular.set(ref, hf.getCellFormula(at(row, col)) ?? '')
    }
    try {
      iterateCircular(hf, members, { sheet: name, maxIterations: 100, maxChange: 0.001 })
    } catch {
      unwind()
    }
  }

  // data tables
  function rebuildBodies(): void {
    const next = new Set<string>()
    for (const t of tables) for (let r = t.body.r1; r <= t.body.r2; r++) for (let c = t.body.c1; c <= t.body.c2; c++) next.add(toRef(r, c))
    bodyCells = next
  }
  function runTable(t: TablePlan): void {
    const values = computeDataTable(hf, sheetId, t, random)
    hf.setCellContents(at(t.body.r1, t.body.c1), values)
  }
  function clearBody(t: TablePlan): void {
    const blank = Array.from({ length: t.body.r2 - t.body.r1 + 1 }, () => new Array<RawCellContent>(t.body.c2 - t.body.c1 + 1).fill(null))
    hf.setCellContents(at(t.body.r1, t.body.c1), blank)
    respill()
  }
  function setTables(next: readonly DataTableDef[]): void {
    const current = new Map(tables.map((t) => [tableKey(t.def), t]))
    const wanted = new Set(next.map(tableKey))
    tables.filter((t) => !wanted.has(tableKey(t.def))).forEach(clearBody)
    const added: TablePlan[] = []
    tables = next.flatMap((d) => {
      const kept = current.get(tableKey(d))
      if (kept) return [kept]
      const plan = planDataTable(d, rows, cols)
      if (typeof plan === 'string') return []
      added.push(plan)
      return [plan]
    })
    rebuildBodies()
    added.forEach(runTable)
  }
  function tableProblem(plan: TablePlan): string | undefined {
    for (const t of tables) {
      if (t.def.range === plan.def.range) continue
      if (boxesOverlap(t.box, plan.box)) return `This table overlaps the data table at ${t.def.range}.`
      for (const p of [plan.rowIn, plan.colIn]) if (p && inBox(t.body, p.row, p.col)) return `The input cell ${toRef(p.row, p.col)} is inside the data table at ${t.def.range}.`
    }
    for (let r = plan.body.r1; r <= plan.body.r2; r++) {
      for (let c = plan.body.c1; c <= plan.body.c2; c++) {
        const role = specCells.get(toRef(r, c))?.role
        if (role && LOCKED.has(role)) return `The table results would overwrite ${toRef(r, c)}, which is locked. Select only the input values, the formulas and the empty result cells.`
      }
    }
    return undefined
  }

  function commit(step: Step): void {
    undoStack.push(step)
    commits += 1
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0
    bump()
  }
  // the steps committed while fn runs become one (undone last to first, redone first to last)
  function group<T>(fn: () => T): T {
    const start = commits
    try {
      return fn()
    } finally {
      const n = Math.min(commits - start, undoStack.length)
      if (n > 1) undoStack.push({ cells: [], fmts: [], group: undoStack.splice(undoStack.length - n, n) })
    }
  }
  const partsOf = (step: Step): Step[] => step.group ?? [step]

  // one user action: writes the entries (validated already), auto-formats typed %/currency/dates, one undo step
  function edit(entries: readonly [string, string][], fmtChanges: readonly FmtChange[] = []): EditResult {
    unwind()
    const cells: CellChange[] = []
    const fmts: FmtChange[] = [...fmtChanges]
    const seen = new Set<string>()
    for (const [ref, raw] of entries) {
      if (seen.has(ref)) continue
      seen.add(ref)
      const { row, col } = parseRef(ref)
      const before = rawAt(row, col)
      if (before !== raw) cells.push({ ref, before, after: raw })
      const p = parseInput(raw)
      if (p.kind === 'value' && p.fmt && !fmtOf(ref) && !fmts.some((f) => f.ref === ref)) fmts.push({ ref, before: undefined, after: p.fmt })
    }
    if (!cells.length && !fmts.length) {
      settle()
      return OK
    }
    try {
      applyCells(cells, 'after')
    } catch (e) {
      applyCells(cells, 'before')
      settle()
      return fail(`The sheet could not take this change (${e instanceof Error ? e.message : 'engine error'}).`)
    }
    applyFmts(fmts, 'after')
    settle()
    commit({ cells, fmts })
    return OK
  }

  function guard(refs: Iterable<string>, force = false): string | undefined {
    if (dead) return 'This sheet has been closed.'
    if (force) return undefined
    for (const ref of refs) {
      const why = lockReason(ref)
      if (why) return why
    }
    return undefined
  }
  function spillProblem(row: number, col: number): string | undefined {
    return hf.isItPossibleToSetCellContents(at(row, col)) ? undefined : `${toRef(row, col)} is filled by a formula that spills over several cells: change that formula instead.`
  }
  function boxRefs(b: RangeBox): string[] {
    const out: string[] = []
    for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) out.push(toRef(r, c))
    return out
  }
  function sourceRaw(sr: number, sc: number, tr: number, tc: number): string {
    if (tableAt(sr, sc)) return canonicalRaw(valueOf(hf.getCellValue(at(sr, sc))))
    const a = at(sr, sc)
    if (hf.doesCellHaveFormula(a)) {
      const data = hf.getFillRangeData({ start: a, end: a }, { start: at(tr, tc), end: at(tr, tc) })
      const f = data[0]?.[0]
      return typeof f === 'string' ? f : canonicalRaw(f as CellValue)
    }
    return rawAt(sr, sc)
  }
  function copyFmt(srcRef: string, dstRef: string, out: FmtChange[]): void {
    const f = fmtOf(srcRef)
    if (f === undefined || f === fmtOf(dstRef)) return
    out.push({ ref: dstRef, before: learnerFmts.get(dstRef), after: f === specFmt(dstRef) ? undefined : f })
  }

  function write(entries: [string, string][], force: boolean): EditResult {
    const cells: [string, string][] = []
    for (const [key, raw] of entries) {
      const c = cellOf(key)
      if (typeof c === 'string') return fail(c)
      if (typeof raw !== 'string') return fail(`${c.ref}: the entry must be text.`)
      const long = lengthProblem(raw)
      if (long) return fail(`${c.ref}: ${long}`)
      const p = parseInput(raw)
      if (p.kind === 'formula') {
        const problem = formulaProblem(hf, p.formula)
        if (problem) return fail(`${c.ref}: ${problem}`)
      }
      cells.push([c.ref, raw])
    }
    const why = guard(cells.map(([ref]) => ref), force)
    if (why) return fail(why)
    if (force) {
      const forced = cells.filter(([ref]) => bodyCells.has(ref))
      if (forced.length) return fail(lockReason(forced[0][0]) ?? 'Locked cell.')
    }
    return edit(cells)
  }

  const sheet: LabSheet = {
    hf,
    sheetId,
    name,
    spec,
    rows,
    cols,
    get version() { return version },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    raw(ref) {
      if (dead) return ''
      const c = cellOf(ref)
      return typeof c === 'string' ? '' : rawAt(c.row, c.col)
    },
    read(ref): CellRead {
      let p
      try {
        p = parseRef(ref)
      } catch {
        return { kind: 'error', value: '#REF!', message: `"${ref}" is not a cell reference.`, hint: 'Use a reference such as B4.' }
      }
      if (dead) return { kind: 'empty', value: null }
      const r = readCell(hf, at(p.row, p.col))
      switch (r.kind) {
        case 'number': return { kind: 'number', value: r.value }
        case 'text': return { kind: 'string', value: r.value }
        case 'boolean': return { kind: 'boolean', value: r.value }
        case 'error': return { kind: 'error', value: r.code, message: r.message, hint: r.hint }
        default: return { kind: 'empty', value: null }
      }
    },
    display(ref) {
      const r = sheet.read(ref)
      if (r.kind === 'empty') return ''
      if (r.kind === 'error') return r.value
      if (r.kind === 'boolean') return r.value ? 'TRUE' : 'FALSE'
      if (r.kind === 'string') return r.value
      const c = cellOf(ref)
      const key = typeof c === 'string' ? normRef(ref) : c.ref
      return formatNumber(r.value, fmtOf(key) ?? typeFormat(ref))
    },
    values(range) {
      const b = boxOf(range)
      if (typeof b === 'string' || dead) return []
      return hf.getRangeValues({ start: at(b.r1, b.c1), end: at(b.r2, b.c2) }).map((line) => line.map(valueOf))
    },
    fmt(ref) {
      const c = cellOf(ref)
      return typeof c === 'string' ? undefined : fmtOf(c.ref)
    },
    setFmt(range, code) {
      const b = boxOf(range)
      if (typeof b === 'string' || dead) return
      const wanted = code === undefined || code.trim() === '' ? undefined : code
      const fmts: FmtChange[] = []
      for (const ref of boxRefs(b)) {
        const after = wanted === specFmt(ref) ? undefined : wanted
        const before = learnerFmts.get(ref)
        if (before !== after) fmts.push({ ref, before, after })
      }
      if (!fmts.length) return
      applyFmts(fmts, 'after')
      commit({ cells: [], fmts })
    },
    role(ref) {
      const c = cellOf(ref)
      return typeof c === 'string' ? undefined : specCells.get(c.ref)?.role
    },
    editable(ref) {
      const c = cellOf(ref)
      return typeof c !== 'string' && !dead && lockReason(c.ref) === undefined
    },
    set(ref, raw) {
      const c = cellOf(ref)
      if (typeof c === 'string') return fail(c)
      const why = guard([c.ref])
      if (why) return fail(why)
      let text = typeof raw === 'string' ? raw : String(raw ?? '')
      const long = lengthProblem(text)
      if (long) return fail(long)
      const p = parseInput(text)
      if (p.kind === 'formula') {
        const problem = formulaProblem(hf, p.formula)
        if (problem) return fail(problem)
      }
      // Excel's automatic percent entry: 8 typed into a percent-formatted cell means 8%
      if (p.kind === 'value' && typeof p.value === 'number' && !p.fmt && isPercentFormat(fmtOf(c.ref)) && Math.abs(p.value) >= 1) text = `${text.trim()}%`
      const spill = spillProblem(c.row, c.col)
      if (spill) return fail(spill)
      return edit([[c.ref, text]])
    },
    setValues(topLeft, values) {
      const c = cellOf(topLeft)
      if (typeof c === 'string') return fail(c)
      if (!Array.isArray(values) || !values.length) return OK
      const width = Math.max(...values.map((line) => (Array.isArray(line) ? line.length : 0)))
      if (c.row + values.length > rows || c.col + width > cols) {
        return fail(`The values need ${values.length} rows x ${width} columns from ${c.ref}, which goes past the edge of the sheet.`)
      }
      const entries: [string, string][] = []
      values.forEach((line, i) => (Array.isArray(line) ? line : []).forEach((v, j) => entries.push([toRef(c.row + i, c.col + j), canonicalRaw(v)])))
      const long = entries.find(([, raw]) => raw.length > MAX_TEXT + 1)
      if (long) return fail(`${long[0]}: the value is too long: a cell can hold at most ${MAX_TEXT.toLocaleString('en-US')} characters.`)
      const why = guard(entries.map(([ref]) => ref))
      return why ? fail(why) : edit(entries)
    },
    fill(source, target) {
      const s = boxOf(source)
      if (typeof s === 'string') return fail(s)
      const t = boxOf(target)
      if (typeof t === 'string') return fail(t)
      const targets = boxRefs(t).filter((ref) => {
        const p = parseRef(ref)
        return !inBox(s, p.row, p.col)
      })
      const why = guard(targets)
      if (why) return fail(why)
      unwind()
      const h = s.r2 - s.r1 + 1
      const w = s.c2 - s.c1 + 1
      const mod = (n: number, m: number): number => ((n % m) + m) % m
      const entries: [string, string][] = []
      const fmts: FmtChange[] = []
      for (const ref of targets) {
        const { row, col } = parseRef(ref)
        const sr = s.r1 + mod(row - s.r1, h)
        const sc = s.c1 + mod(col - s.c1, w)
        entries.push([ref, sourceRaw(sr, sc, row, col)])
        copyFmt(toRef(sr, sc), ref, fmts)
      }
      return edit(entries, fmts)
    },
    copy(range) {
      const b = boxOf(range)
      if (typeof b !== 'string') clip = b
    },
    paste(dest) {
      if (!clip) return fail('Nothing to paste yet: copy some cells first.')
      const d = boxOf(dest)
      if (typeof d === 'string') return fail(d)
      const src = clip
      const h = src.r2 - src.r1 + 1
      const w = src.c2 - src.c1 + 1
      if (d.r1 + h > rows || d.c1 + w > cols) return fail(`The copied ${h} x ${w} block does not fit at ${toRef(d.r1, d.c1)}: it goes past the edge of the sheet.`)
      const box = { r1: d.r1, c1: d.c1, r2: d.r1 + h - 1, c2: d.c1 + w - 1 }
      const why = guard(boxRefs(box))
      if (why) return fail(why)
      unwind()
      const entries: [string, string][] = []
      const fmts: FmtChange[] = []
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          const ref = toRef(d.r1 + i, d.c1 + j)
          entries.push([ref, sourceRaw(src.r1 + i, src.c1 + j, d.r1 + i, d.c1 + j)])
          copyFmt(toRef(src.r1 + i, src.c1 + j), ref, fmts)
        }
      }
      return edit(entries, fmts)
    },
    clear(range) {
      const b = boxOf(range)
      if (typeof b === 'string') return fail(b)
      if (dead) return fail('This sheet has been closed.')
      let firstLock: string | undefined
      let editableSeen = false
      const entries: [string, string][] = []
      for (const ref of boxRefs(b)) {
        const why = lockReason(ref)
        if (why) {
          firstLock ??= why
          continue
        }
        editableSeen = true
        const { row, col } = parseRef(ref)
        if (rawAt(row, col) !== '') entries.push([ref, ''])
      }
      if (!editableSeen) return fail(firstLock ?? 'Nothing to clear.')
      return entries.length ? edit(entries) : OK
    },
    undo() {
      const step = undoStack.pop()
      if (!step || dead) return
      unwind()
      for (const part of [...partsOf(step)].reverse()) {
        if (part.tables) setTables(part.tables.before)
        applyCells(part.cells, 'before')
        applyFmts(part.fmts, 'before')
      }
      settle()
      redoStack.push(step)
      bump()
    },
    redo() {
      const step = redoStack.pop()
      if (!step || dead) return
      unwind()
      const parts = partsOf(step)
      for (const part of parts) {
        applyCells(part.cells, 'after')
        applyFmts(part.fmts, 'after')
      }
      settle()
      for (const part of parts) if (part.tables) setTables(part.tables.after)
      undoStack.push(step)
      bump()
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    recalc() {
      if (dead) return
      unwind()
      random.redraw()
      pokes += 1
      hf.setCellContents(scratchAt, [[pokes]]) // any change re-evaluates volatile cells
      settle()
      tables.forEach(runTable)
      bump()
    },
    get dataTables() { return tables.map((t) => ({ ...t.def })) },
    addDataTable(def) {
      if (dead) return fail('This sheet has been closed.')
      const plan = planDataTable(def, rows, cols)
      if (typeof plan === 'string') return fail(plan)
      const problem = tableProblem(plan)
      if (problem) return fail(problem)
      const same = tables.find((t) => tableKey(t.def) === tableKey(plan.def))
      if (same) {
        runTable(same)
        bump()
        return OK
      }
      unwind()
      const before = tables.map((t) => t.def)
      const after = [...before.filter((d) => d.range !== plan.def.range), plan.def]
      const cells: CellChange[] = []
      for (const ref of boxRefs(plan.body)) {
        const { row, col } = parseRef(ref)
        if (bodyCells.has(ref)) continue
        const raw = rawAt(row, col)
        if (raw !== '') cells.push({ ref, before: raw, after: '' })
      }
      applyCells(cells, 'after')
      settle()
      setTables(after)
      commit({ cells, fmts: [], tables: { before, after } })
      return OK
    },
    removeDataTable(range) {
      if (dead) return
      let key = range
      try {
        key = toRange(parseRange(range))
      } catch {
        return
      }
      const box = parseRange(key)
      const target = tables.find((t) => t.def.range === key) ?? tables.find((t) => inBox(t.box, box.r1, box.c1))
      if (!target) return
      unwind()
      const before = tables.map((t) => t.def)
      const after = before.filter((d) => d !== target.def)
      setTables(after)
      settle()
      commit({ cells: [], fmts: [], tables: { before, after } })
    },
    get hiddenRows() { return hidden },
    setHiddenRows(list) {
      if (dead) return
      const next = new Set<number>()
      for (const r of list) if (Number.isInteger(r) && r >= 1 && r <= rows) next.add(r)
      hidden = next
      bump()
    },
    get iterative() { return iterativeOn },
    setIterative(on) {
      if (dead || on === iterativeOn) return
      iterativeOn = on
      if (on) settle()
      else unwind()
      bump()
    },
    state() {
      const refs = new Set<string>(baseline.keys())
      if (!dead) {
        hf.getSheetSerialized(sheetId).forEach((line, r) => line.forEach((v, c) => {
          if (v !== null && v !== undefined && v !== '' && inside(r, c)) refs.add(toRef(r, c))
        }))
      }
      circular.forEach((_, ref) => refs.add(ref))
      const edits: Record<string, string> = {}
      for (const ref of [...refs].sort(byPosition)) {
        if (bodyCells.has(ref)) continue
        const { row, col } = parseRef(ref)
        const now = dead ? baseline.get(ref) ?? '' : rawAt(row, col)
        if (now !== (baseline.get(ref) ?? '')) edits[ref] = now
      }
      const out: LearnerState = { edits }
      if (learnerFmts.size) out.fmts = Object.fromEntries([...learnerFmts].sort((a, b) => byPosition(a[0], b[0])))
      if (tables.length) out.dataTables = tables.map((t) => ({ ...t.def }))
      if (hidden.size) out.hiddenRows = [...hidden].sort((a, b) => a - b)
      if (iterativeOn !== (spec.iterative ?? false)) out.iterative = iterativeOn
      return out
    },
    destroy() {
      if (dead) return
      dead = true
      listeners.clear()
      try {
        hf.destroy()
      } catch {
        // already gone
      }
    },
  }

  function typeFormat(ref: string): string | undefined {
    let p
    try {
      p = parseRef(ref)
    } catch {
      return undefined
    }
    const type = hf.getCellValueDetailedType(at(p.row, p.col))
    if (type === CellValueDetailedType.NUMBER_DATE) return 'dd/mm/yyyy'
    if (type === CellValueDetailedType.NUMBER_DATETIME) return 'dd/mm/yyyy h:mm'
    if (type === CellValueDetailedType.NUMBER_TIME) return 'h:mm AM/PM'
    return undefined
  }

  // baseline = the spec as the engine shows it; state().edits is everything that differs from it
  const baseline = new Map<string, string>()
  for (const ref of specCells.keys()) {
    const { row, col } = parseRef(ref)
    baseline.set(ref, rawAt(row, col))
  }

  // learner state: edits in one batch (no undo history), then formats, hidden rows, iteration, data tables
  const st = opts.state
  if (st) {
    const changes: CellChange[] = []
    for (const [key, raw] of Object.entries(st.edits ?? {})) {
      const c = cellOf(key)
      if (typeof c === 'string' || typeof raw !== 'string' || lockReason(c.ref) || lengthProblem(raw)) continue
      changes.push({ ref: c.ref, before: '', after: raw })
    }
    applyCells(changes, 'after')
    for (const [key, code] of Object.entries(st.fmts ?? {})) {
      const c = cellOf(key)
      if (typeof c !== 'string' && typeof code === 'string' && code !== '') learnerFmts.set(c.ref, code)
    }
    if (Array.isArray(st.hiddenRows)) hidden = new Set(st.hiddenRows.filter((r) => Number.isInteger(r) && r >= 1 && r <= rows))
  }
  iterativeOn = st?.iterative ?? spec.iterative ?? false
  settle()
  if (st && Array.isArray(st.dataTables)) {
    for (const def of st.dataTables) {
      const plan = planDataTable(def, rows, cols)
      if (typeof plan === 'string' || tableProblem(plan) || tables.some((t) => boxesOverlap(t.box, plan.box))) continue
      tables = [...tables, plan]
      rebuildBodies()
      runTable(plan)
    }
  }

  internals.set(sheet, { write, group })
  return sheet
}

function valueOf(v: unknown): CellValue {
  if (v instanceof DetailedCellError) return v.value
  if (v === undefined || v === null) return null
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return null
}
