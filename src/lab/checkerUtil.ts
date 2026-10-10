// checkerUtil.ts - the checker's building blocks: cells and entries, sheets, value comparison, learner-facing
// messages, task results, random statistics, Solver constraints. Used by checker.ts and scripts/validate-lab.ts (lab-core).
import { makeCriterion, parseLooseNumber } from './engine/excelMath'
import { formatNumber } from './engine/format'
import { canonicalRaw } from './engine/input'
import { createLabSheet, writeCells } from './sheet'
import { inBox, normRef, parseRange, parseRef, rangeCells, shiftFormula, splitRanges, toRange, toRef } from './refs'
import type { RangeBox } from './refs'
import { functionsUsed } from './syllabus'
import type {
  CellMark, CellRead, CellSpec, CellValue, DataTableDef, LabSheet, LearnerState, RandomCheck, Role, SheetSpec, SolverSetup, Task,
  TaskCheck, TaskResult,
} from './types'

export const TOL = 1e-6
export const REL_TOL = 1e-9
export const MAX_MESSAGES = 4
export const LOCKED: ReadonlySet<Role | undefined> = new Set<Role | undefined>(['label', 'header', 'given', 'note'])
export const RANDOM_FNS = ['RAND', 'RANDBETWEEN']
export const ERROR_CODES = ['#N/A', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '#CYCLE!', '#SPILL!', '#ERROR!']

// ---------- cells and entries ----------

export const canon = (ref: string): string | undefined => {
  try {
    return normRef(ref)
  } catch {
    return undefined
  }
}

export function cellsOf(range: string | undefined): string[] {
  const out = new Set<string>()
  for (const part of splitRanges(range ?? '')) for (const ref of rangeCells(part)) out.add(ref)
  return [...out]
}

export const boxOf = (range: string): RangeBox | undefined => {
  try {
    return parseRange(range)
  } catch {
    return undefined
  }
}

// a reference entry for the first cell, filled across the range like Excel (relative refs shift, $ parts stay)
export function fillEntry(entry: string, range: string): Record<string, string> {
  const cells = cellsOf(range)
  if (!cells.length) return {}
  const first = parseRef(cells[0])
  const text = entry.trim()
  const out: Record<string, string> = {}
  for (const ref of cells) {
    const p = parseRef(ref)
    out[ref] = text.startsWith('=') ? shiftFormula(text, p.row - first.row, p.col - first.col) : entry
  }
  return out
}

const specCache = new WeakMap<SheetSpec, Map<string, CellSpec>>()

export function specCells(spec: SheetSpec): Map<string, CellSpec> {
  let map = specCache.get(spec)
  if (!map) {
    map = new Map()
    for (const [key, cell] of Object.entries(spec.cells ?? {})) {
      const ref = canon(key)
      if (ref) map.set(ref, cell)
    }
    specCache.set(spec, map)
  }
  return map
}

export const hasContent = (cell: CellSpec | undefined): boolean =>
  Boolean(cell && ((typeof cell.f === 'string' && cell.f.trim() !== '') || (cell.v !== undefined && cell.v !== null && cell.v !== '')))

export function specRaw(spec: SheetSpec, ref: string): string {
  const cell = specCells(spec).get(ref)
  if (!cell) return ''
  if (typeof cell.f === 'string' && cell.f.trim() !== '') return cell.f.trim().startsWith('=') ? cell.f.trim() : `=${cell.f.trim()}`
  return canonicalRaw(cell.v ?? null)
}

export function insideSheet(spec: SheetSpec, ref: string): boolean {
  const p = parseRef(ref)
  return p.row < Math.min(spec.rows, 1000) && p.col < Math.min(spec.cols, 26)
}

export function canonEdits(spec: SheetSpec, edits: Record<string, string> | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, raw] of Object.entries(edits ?? {})) {
    const ref = canon(key)
    if (ref && insideSheet(spec, ref)) out.set(ref, typeof raw === 'string' ? raw : String(raw ?? ''))
  }
  return out
}

export const normTable = (def: DataTableDef): DataTableDef | undefined => {
  const box = def && typeof def.range === 'string' ? boxOf(def.range) : undefined
  if (!box) return undefined
  const one = (r?: string) => (r && r.trim() ? canon(r) : undefined)
  const rowInput = one(def.rowInput)
  const colInput = one(def.colInput)
  return { range: toRange(box), ...(rowInput ? { rowInput } : {}), ...(colInput ? { colInput } : {}) }
}

export const answerRecord = (task: Task): Record<string, CellValue> | undefined =>
  task.answer !== null && typeof task.answer === 'object' ? task.answer : undefined

export function readOf(v: CellValue | undefined): CellRead {
  if (v === null || v === undefined || v === '') return { kind: 'empty', value: null }
  if (typeof v === 'number') return { kind: 'number', value: v }
  if (typeof v === 'boolean') return { kind: 'boolean', value: v }
  if (ERROR_CODES.includes(v.trim().toUpperCase())) return { kind: 'error', value: v.trim().toUpperCase(), message: '', hint: '' }
  return { kind: 'string', value: v }
}

// ---------- sheets ----------

export function buildSheet(spec: SheetSpec, state: LearnerState): LabSheet {
  const sheet = createLabSheet(spec, { state })
  const cells = specCells(spec)
  const locked = Object.entries(state.edits).filter(([ref]) => LOCKED.has(cells.get(ref)?.role))
  if (locked.length) {
    // tools such as Sort may rewrite given cells; the sheet skips locked cells when it loads a state
    writeCells(sheet, Object.fromEntries(locked), { force: true })
    if (sheet.dataTables.length) sheet.recalc()
  }
  return sheet
}

export function put(sheet: LabSheet, entries: Record<string, string>): void {
  if (!Object.keys(entries).length) return
  const r = writeCells(sheet, entries, { force: true })
  if (!r.ok) throw new Error(r.message)
}

export function inBoxRef(box: RangeBox, ref: string): boolean {
  const p = parseRef(ref)
  return p.row >= box.r1 && p.row <= box.r2 && p.col >= box.c1 && p.col <= box.c2
}

// ---------- comparing and messages ----------

export function sameValue(got: CellRead, want: CellRead, check?: TaskCheck): boolean {
  if (want.kind === 'error') return got.kind === 'error' && got.value === want.value
  if (want.kind === 'number') {
    if (got.kind !== 'number') return false
    const diff = Math.abs(got.value - want.value)
    const scale = Math.max(Math.abs(got.value), Math.abs(want.value))
    return diff <= (check?.tol ?? TOL) + 1e-12 * Math.max(1, scale) || diff <= (check?.relTol ?? REL_TOL) * scale
  }
  if (want.kind === 'boolean') return got.kind === 'boolean' && got.value === want.value
  const text = (r: CellRead): string | undefined => (r.kind === 'string' ? r.value : r.kind === 'empty' ? '' : undefined)
  const a = text(got)
  const b = text(want)
  if (a === undefined || b === undefined) return false
  return check?.caseSensitive ? a.trim() === b.trim() : a.trim().toLowerCase() === b.trim().toLowerCase()
}

export const quoteText = (s: string): string => (s.length > 40 ? `"${s.slice(0, 37)}..."` : `"${s}"`)

// a cell showing #CYCLE! only because it reads a loop: the loop cell its error comes from (HyperFormula's error address)
export function cycleSource(sheet: LabSheet, ref: string): string | undefined {
  let at
  try {
    at = parseRef(ref)
  } catch {
    return undefined
  }
  const v: unknown = sheet.hf.getCellValue({ sheet: sheet.sheetId, row: at.row, col: at.col })
  const address = v !== null && typeof v === 'object' && 'address' in v ? (v as { address?: unknown }).address : undefined
  if (typeof address !== 'string') return undefined
  const from = canon(address.slice(address.lastIndexOf('!') + 1))
  return from && from !== normRef(ref) ? from : undefined
}

export const cycleText = (cell: string, loopFrom: string | undefined): string => (loopFrom
  ? `${cell} depends on a circular reference (${loopFrom} is part of a loop)`
  : `${cell} refers back to itself (circular reference)`)

export function mismatch(cell: string, got: CellRead, shown: string, want: CellRead, loopFrom?: string): string {
  if (got.kind === 'error' && want.kind !== 'error') {
    if (got.value === '#CYCLE!') return `${cycleText(cell, loopFrom)}: switch on iterative calculation if the model is meant to be circular`
    return `${cell} shows ${got.value}${got.hint ? `: ${got.hint}` : ''}`
  }
  if (got.kind === 'empty') return `${cell} is empty`
  if (got.kind === 'string' && want.kind === 'number') return `${cell}: shows the text ${quoteText(shown)}, expected a number`
  if (got.kind === 'number' && want.kind === 'string') return `${cell}: shows ${shown}, expected text`
  return `${cell}: shows ${got.kind === 'string' ? quoteText(shown) : shown}, expected a different value`
}

export const list = (cells: string[], max = 4): string =>
  cells.length <= max ? cells.join(', ') : `${cells.slice(0, max).join(', ')} and ${cells.length - max} more`

export const and = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// the directions a task's formula is filled in: down (its cells span several rows), right (several columns)
export interface Axes { rows: boolean; cols: boolean }
export const NO_FILL: Readonly<Axes> = Object.freeze({ rows: false, cols: false })

export function fillAxes(cells: string[]): Axes {
  if (cells.length < 2) return NO_FILL
  return {
    rows: new Set(cells.map((c) => parseRef(c).row)).size > 1,
    cols: new Set(cells.map((c) => parseRef(c).col)).size > 1,
  }
}

export function fillWords(cells: string[]): string {
  if (cells.length < 2) return 'copying'
  const rows = new Set(cells.map((c) => parseRef(c).row)).size
  const cols = new Set(cells.map((c) => parseRef(c).col)).size
  if (cols === 1) return 'fill-down'
  if (rows === 1) return 'fill-right'
  return 'filling down and right'
}

// where to fill the first cell: 'down to C9', 'right to F4', 'down and right to F9'
export const fillTo = (cells: string[], axes: Axes): string =>
  `${axes.rows && axes.cols ? 'down and right' : axes.rows ? 'down' : 'right'} to ${cells[cells.length - 1]}`

const REF_TOKEN = /(?<![A-Z0-9_.$!])(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![A-Z0-9_(])/g

// cell references written in a formula (outside text), one per reference as typed: 'B$4', '$A$1:$B$9'
export function typedRefs(formula: string): string[] {
  const body = formula.replace(/"(?:[^"]|"")*"/g, '""').toUpperCase()
  return [...body.matchAll(REF_TOKEN)].map((m) => (m[2] ? `${m[1]}:${m[2]}` : m[1]))
}

// the same as a set, plus both ends of every range
export function refTokens(formula: string): Set<string> {
  const out = new Set<string>()
  for (const t of typedRefs(formula)) {
    out.add(t)
    if (t.includes(':')) t.split(':').forEach((p) => out.add(p))
  }
  return out
}

export const bare = (ref: string): string => ref.replace(/\$/g, '').toUpperCase()

// the $ signs of a reference that matter when it is filled along `axes`: 'Cr' column anchored, row free; one per range end
function anchorKey(ref: string, axes: Axes): string {
  return ref.split(':').map((part) => {
    const m = /^(\$?)[A-Z]{1,3}(\$?)\d+$/.exec(part.trim().toUpperCase())
    if (!m) return '?'
    return `${axes.cols ? (m[1] ? 'C' : 'c') : ''}${axes.rows ? (m[2] ? 'R' : 'r') : ''}`
  }).join(':')
}

// check.absolute: each listed ref must appear in the first formula, anchored as listed in the directions the task is
// filled (fill-down: the row part, fill-right: the column part, both for a grid; a one-cell task: any $ signs)
export function anchorNotes(formula: string, wanted: string[], axes: Axes, fill: string): string[] {
  const typed = typedRefs(formula)
  const absent: string[] = []
  const absolute: string[] = []
  const mixed: string[] = []
  for (const w of wanted) {
    const target = w.trim().toUpperCase()
    const pool = target.includes(':') ? typed.filter((t) => t.includes(':')) : typed.flatMap((t) => t.split(':'))
    const same = pool.filter((t) => bare(t) === bare(target))
    if (!same.length) absent.push(target)
    else if (same.some((t) => anchorKey(t, axes) === anchorKey(target, axes))) continue
    else if (target.split(':').every((p) => /^\$[A-Z]+\$\d+$/.test(p))) absolute.push(bare(target))
    else mixed.push(target)
  }
  const it = (xs: string[]) => (xs.length > 1 ? 'they survive' : 'it survives')
  const out: string[] = []
  if (absolute.length) out.push(`Make ${and(absolute)} absolute so ${it(absolute)} ${fill}`)
  if (mixed.length) out.push(`Write ${and(mixed)} with these $ signs so ${it(mixed)} ${fill}`)
  if (absent.length) out.push(`Your formula should use ${and(absent)}`)
  return out
}

// check.refs: cells or ranges the first formula must read, with any $ signs (a cell inside a range it reads counts)
export function refNotes(formula: string, wanted: string[]): string[] {
  const read = typedRefs(formula).map((t) => boxOf(bare(t))).filter((b): b is RangeBox => Boolean(b))
  const missing = wanted.map((w) => bare(w.trim())).filter((w) => {
    const box = boxOf(w)
    return Boolean(box && !read.some((b) => b.r1 <= box.r1 && box.r2 <= b.r2 && b.c1 <= box.c1 && box.c2 <= b.c2))
  })
  return missing.length ? [`Your formula should refer to ${and(missing)}`] : []
}

// the learner's first formula anchors a reference it shares with the reference formula differently in a direction the
// task is filled: filling it reads other cells than the model answer does
export function anchoringDiffers(learner: string, reference: string, axes: Axes): boolean {
  if (!axes.rows && !axes.cols) return false
  const keys = (formula: string): Map<string, Set<string>> => {
    const out = new Map<string, Set<string>>()
    for (const t of typedRefs(formula)) out.set(bare(t), (out.get(bare(t)) ?? new Set<string>()).add(anchorKey(t, axes)))
    return out
  }
  const theirs = keys(reference)
  for (const [ref, mine] of keys(learner)) {
    const want = theirs.get(ref)
    if (want && (want.size !== mine.size || [...mine].some((k) => !want.has(k)))) return true
  }
  return false
}

// Excel's legacy and modern names for one function: mustUse / mustNotUse treat them as the same function
const FN_ALIASES: Readonly<Record<string, string>> = {
  'PERCENTILE.INC': 'PERCENTILE', 'PERCENTRANK.INC': 'PERCENTRANK', 'NORM.INV': 'NORMINV', 'NORM.S.INV': 'NORMSINV',
  'NORM.DIST': 'NORMDIST', 'NORM.S.DIST': 'NORMSDIST', 'BINOM.INV': 'CRITBINOM', 'BINOM.DIST': 'BINOMDIST',
  'STDEV.S': 'STDEV', 'STDEV.P': 'STDEVP', 'VAR.S': 'VAR', 'VAR.P': 'VARP', 'RANK.EQ': 'RANK', 'MODE.SNGL': 'MODE',
  'FORECAST.LINEAR': 'FORECAST', CONCAT: 'CONCATENATE', 'EXPON.DIST': 'EXPONDIST', 'POISSON.DIST': 'POISSON',
  'GAMMA.INV': 'GAMMAINV', 'LOGNORM.INV': 'LOGINV',
}

export const canonFn = (name: string): string => {
  const up = name.trim().toUpperCase()
  return FN_ALIASES[up] ?? up
}

// the functions a formula calls that count as `fn` (itself or its legacy/modern twin), as written
export const callsOf = (raw: string, fn: string): string[] =>
  isFormula(raw ?? '') ? functionsUsed(raw).filter((f) => canonFn(f) === canonFn(fn)) : []

export const usesFunction = (raw: string, fn: string): boolean => callsOf(raw, fn).length > 0

// argument slots that never hold a model input: lookup column numbers and match types, rounding digits, type flags
const NEVER_INPUT: Readonly<Record<string, readonly number[]>> = {
  VLOOKUP: [3, 4], HLOOKUP: [3, 4], MATCH: [3], XMATCH: [3, 4], XLOOKUP: [5, 6],
  ROUND: [2], ROUNDUP: [2], ROUNDDOWN: [2], TRUNC: [2],
  PMT: [5], PV: [5], FV: [5], NPER: [5], RATE: [5, 6], IRR: [2],
  WEEKDAY: [2], RANK: [3], 'RANK.AVG': [3], PERCENTRANK: [3], TREND: [4],
  NORMDIST: [4], NORMSDIST: [2], 'LOGNORM.DIST': [4], BINOMDIST: [4], POISSON: [3], EXPONDIST: [3],
  GAMMADIST: [4], 'GAMMA.DIST': [4], WEIBULL: [4], 'WEIBULL.DIST': [4], 'BETA.DIST': [4],
}

interface Slot { fn: string; arg: number; start: number; end: number }

// the argument slots of every function call in a formula body whose text is blanked (positions kept)
function argSlots(body: string): Slot[] {
  const slots: Slot[] = []
  const open: Slot[] = []
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '(' || ch === '{') {
      const name = ch === '{' ? '{' : /([A-Za-z_][A-Za-z0-9_.]*)$/.exec(body.slice(0, i))?.[1] ?? ''
      open.push({ fn: name.replace(/^(?:_xlfn\.|_xlws\.)+/i, '').toUpperCase(), arg: 1, start: i + 1, end: i + 1 })
    } else if (ch === ',' && open.length) {
      const top = open[open.length - 1]
      slots.push({ ...top, end: i })
      top.arg += 1
      top.start = i + 1
    } else if ((ch === ')' || ch === '}') && open.length) {
      slots.push({ ...(open.pop() as Slot), end: i })
    }
  }
  return slots
}

export interface Literal { text: string; value: number; fn?: string; arg?: number; alone: boolean }

// numbers typed into a formula (outside text and references) with the function argument each sits in; `alone`: the
// number is the whole argument (a sign allowed)
export function numberLiterals(formula: string): Literal[] {
  const blank = (m: string): string => `${m[0]}${' '.repeat(Math.max(0, m.length - 2))}${m[m.length - 1]}`
  const body = formula.replace(/"(?:[^"]|"")*"/g, blank).replace(/'(?:[^']|'')*'/g, blank)
  const slots = argSlots(body)
  const out: Literal[] = []
  for (const m of body.matchAll(/(?<![A-Za-z0-9_.$])(\d+(?:\.\d+)?|\.\d+)(%?)(?![A-Za-z0-9_(])/g)) {
    const at = m.index ?? 0
    let slot: Slot | undefined
    for (const s of slots) if (s.start <= at && at < s.end && (!slot || s.start > slot.start)) slot = s
    const alone = Boolean(slot && body.slice(slot.start, slot.end).replace(/\s+/g, '').replace(/^[-+]/, '') === m[0])
    out.push({ text: m[0], value: Number(m[1]) / (m[2] ? 100 : 1), fn: slot?.fn, arg: slot?.arg, alone })
  }
  return out
}

// a number typed into a formula that equals a test-case input's starting value: a hard-coded input. Not counted: 0 and 1,
// numbers the reference formula types too, and a number alone in an argument that never holds an input (NEVER_INPUT) or
// in which the reference also types a number (INDEX row/column numbers ...)
export function hardCoded(formula: string, inputs: number[], reference = ''): string | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  const theirs = isFormula(reference) ? numberLiterals(reference) : []
  const typedSlots = new Set(theirs.filter((l) => l.fn && l.alone).map((l) => `${canonFn(l.fn ?? '')}#${l.arg}`))
  for (const lit of numberLiterals(formula)) {
    if (near(lit.value, 0) || near(lit.value, 1) || theirs.some((t) => near(t.value, lit.value))) continue
    const fn = canonFn(lit.fn ?? '')
    if (lit.alone && lit.fn && (NEVER_INPUT[fn]?.includes(lit.arg ?? 0) || typedSlots.has(`${fn}#${lit.arg}`))) continue
    if (inputs.some((v) => v !== 0 && near(v, lit.value))) return lit.text
  }
  return undefined
}

export const isFormula = (raw: string): boolean => (raw ?? '').trim().startsWith('=')

// a formula that reads no cell and no name (=20, =12*3): the same value whatever the inputs
export function readsNothing(raw: string): boolean {
  if (!isFormula(raw) || typedRefs(raw).length) return false
  const body = raw.replace(/"(?:[^"]|"")*"/g, '""').toUpperCase()
  return !/[A-Z_]/.test(body.replace(/[A-Z_][A-Z0-9_.]*\(/g, '(').replace(/\b(?:TRUE|FALSE)\b/g, ''))
}

export function functionIssues(cells: string[], raws: Record<string, string>, check: TaskCheck | undefined): { bad: Set<string>; messages: string[] } {
  const bad = new Set<string>()
  const messages: string[] = []
  for (const fn of check?.mustUse ?? []) {
    const missing = cells.filter((c) => !usesFunction(raws[c], fn))
    if (!missing.length) continue
    missing.forEach((c) => bad.add(c))
    messages.push(missing.length === cells.length ? `Use ${fn.toUpperCase()} here` : `Use ${fn.toUpperCase()} in ${list(missing)}`)
  }
  for (const fn of check?.mustNotUse ?? []) {
    const using = cells.filter((c) => usesFunction(raws[c], fn))
    if (!using.length) continue
    using.forEach((c) => bad.add(c))
    const named = [...new Set(using.flatMap((c) => callsOf(raws[c], fn)))].join('/')
    messages.push(`Solve this without ${named}${using.length < cells.length ? ` (${list(using)})` : ''}: this exercise practises another way`)
  }
  return { bad, messages }
}

// ---------- task shapes ----------

// a task's reference entries: `solution` filled across `cells`, then `solutions` per cell on top; value tasks: `answer`
export function referenceEntries(task: Task): Record<string, string> {
  const out: Record<string, string> = task.kind === 'formula' && typeof task.solution === 'string' ? fillEntry(task.solution, task.cells) : {}
  const rec = answerRecord(task)
  if (task.kind === 'value' && task.answer !== undefined && !task.solutions) {
    if (!rec) for (const ref of cellsOf(task.cells)) out[ref] = canonicalRaw(task.answer as CellValue)
    for (const [key, v] of Object.entries(rec ?? {})) {
      const ref = canon(key)
      if (ref) out[ref] = canonicalRaw(v)
    }
  }
  for (const [key, raw] of Object.entries(task.solutions ?? {})) {
    const ref = canon(key)
    if (ref) out[ref] = raw
  }
  return out
}

// how the reference covers the task's cells: one formula filled across ('fill'), a formula per cell ('cells'), one formula
// in the first cell whose result spills over the range ('spill'), or one cell
export interface Shape { kind: 'single' | 'fill' | 'cells' | 'spill'; axes: Axes }

export function shapeOf(task: Task, cells: string[], want: CellRead[]): Shape {
  if (cells.length < 2) return { kind: 'single', axes: NO_FILL }
  const entries = referenceEntries(task)
  const keys = Object.keys(entries)
  const spills = keys.length === 1 && keys[0] === cells[0] && isFormula(entries[keys[0]]) && want.slice(1).some((r) => r.kind !== 'empty')
  if (spills) return { kind: 'spill', axes: NO_FILL }
  return task.solutions ? { kind: 'cells', axes: NO_FILL } : { kind: 'fill', axes: fillAxes(cells) }
}

// the empty cells, said once, with what to do for this shape of task
export function emptyNote(cells: string[], empty: string[], range: string, shape: Shape, raws: Record<string, string>): string {
  const first = cells[0]
  const all = empty.length === cells.length
  if (shape.kind === 'single') return `${first} is empty: enter a formula`
  if (shape.kind === 'spill') {
    if (isFormula(raws[first])) return `${list(empty)}: still empty: the formula in ${first} should spill across ${range}`
    return `${all ? `${range} is empty` : `${list(empty)}: still empty`}: type one formula in ${first}; it spills across ${range}`
  }
  if (shape.kind === 'cells') {
    if (all) return `${list(empty)} ${empty.length === 1 ? 'is' : 'are'} empty: each needs its own formula`
    return `${list(empty)}: still empty (${empty.length === 1 ? 'it needs' : 'each of these cells needs'} its own formula)`
  }
  return all ? `${range} is empty: enter a formula in ${first} and fill it ${fillTo(cells, shape.axes)}` : `${list(empty)}: still empty (fill the formula ${fillTo(cells, shape.axes)})`
}

// value tasks: the learner types the value; a formula fails unless check.allowFormula, or the task's own reference entry
// for that cell (`solutions`) is a formula
export function formulaAllowed(task: Task, cell: string): boolean {
  return task.check?.allowFormula === true || Object.entries(task.solutions ?? {}).some(([key, raw]) => canon(key) === cell && isFormula(raw))
}

// ---------- results ----------

export function result(task: Task, cells: string[], bad: Set<string>, messages: string[], extra: Partial<TaskResult> = {}): TaskResult {
  const marks: Record<string, CellMark> = {}
  cells.forEach((c) => { marks[c] = bad.has(c) ? 'bad' : 'ok' })
  const correct = cells.filter((c) => !bad.has(c)).length
  const unique = [...new Set(messages)]
  return {
    taskId: task.id,
    ok: bad.size === 0 && unique.length === 0,
    correct,
    total: cells.length,
    messages: unique.slice(0, MAX_MESSAGES),
    cells: marks,
    ...extra,
  }
}

export function single(task: Task, ok: boolean, messages: string[], cells: string[] = []): TaskResult {
  const marks: Record<string, CellMark> = {}
  cells.forEach((c) => { marks[c] = ok ? 'ok' : 'bad' })
  return { taskId: task.id, ok, correct: ok ? 1 : 0, total: 1, messages: ok ? [] : messages.slice(0, MAX_MESSAGES), cells: marks }
}

// ---------- random statistics ----------

export interface RandomSample { values: CellValue[]; stat: number; n: number }

export function statOf(values: CellValue[], rc: RandomCheck): number | string {
  if (rc.stat === 'p') {
    const ev = rc.event?.trim()
    const test = ev === undefined ? (v: CellValue) => v === true || v === 1 : /^(true|false)$/i.test(ev) ? (v: CellValue) => v === (ev.toUpperCase() === 'TRUE') : makeCriterion(ev)
    return values.filter((v) => test(v)).length / Math.max(1, values.length)
  }
  const nums = values.filter((v): v is number => typeof v === 'number')
  if (nums.length !== values.length) return 'some results are not numbers'
  const mean = nums.reduce((s, x) => s + x, 0) / Math.max(1, nums.length)
  if (rc.stat === 'mean') return mean
  const ss = nums.reduce((s, x) => s + (x - mean) ** 2, 0)
  return nums.length > 1 ? Math.sqrt(ss / (nums.length - 1)) : 0
}

export function sample(sheet: LabSheet, cells: string[], rc: RandomCheck): RandomSample | string {
  const values: CellValue[] = []
  const trials = Math.max(1, Math.floor(rc.trials))
  for (let t = 0; t < trials; t++) {
    if (t > 0) sheet.recalc()
    for (const c of cells) {
      const r = sheet.read(c)
      if (r.kind === 'error' && r.value === '#CYCLE!') return `${cycleText(c, cycleSource(sheet, c))} on some recalculations: check which cells it reads`
      if (r.kind === 'error') return `${c} shows ${r.value} on some recalculations${r.hint ? `: ${r.hint}` : ''}`
      values.push(r.value)
    }
  }
  const stat = statOf(values, rc)
  return typeof stat === 'string' ? `${list(cells, 2)}: ${stat}` : { values, stat, n: values.length }
}

// the days a duration/clock format's text stands for ('06:17' in mm:ss); undefined for dates, AM/PM and other codes
function timeValue(text: string, fmt: string): number | undefined {
  const code = fmt.replace(/"[^"]*"/g, '').replace(/\\./g, '')
  if (/[dy]|AM\/PM|A\/P/i.test(code)) return undefined
  const units = [...code.matchAll(/\[?(h+|m+|s+)\]?/gi)].map((m) => ({ h: 1 / 24, m: 1 / 1440, s: 1 / 86400 })[m[1][0].toLowerCase() as 'h' | 'm' | 's'])
  const parts = text.match(/\d+(?:\.\d+)?/g) ?? []
  if (!units.length || parts.length !== units.length) return undefined
  return (text.trim().startsWith('-') ? -1 : 1) * parts.reduce((sum, p, i) => sum + Number(p) * units[i], 0)
}

// a statistic for a message in the cells' number format (6:17, not 0.00436), unless that format rounds away more than
// half the tolerance (3 significant figures instead) or drops whole units of a time (mm:ss over an hour: [h]:mm:ss)
export function statText(n: number, fmt: string | undefined, tol: number): string {
  const plain = Math.abs(n) >= 100 ? n.toFixed(1) : n.toPrecision(3)
  if (!fmt || fmt.trim().toLowerCase() === 'general') return plain
  const text = formatNumber(n, fmt).trim()
  if (!/\d/.test(text)) return plain  // '' or ######## (a negative time)
  const time = timeValue(text, fmt)
  const back = parseLooseNumber(text) ?? time
  if (back === undefined || !Number.isFinite(back) || Math.abs(back - n) <= Math.max(tol / 2, time === undefined ? 0 : 1 / 86400)) return text
  return time !== undefined && n >= 0 ? formatNumber(n, '[h]:mm:ss') : plain
}

// fmt: the number format of the task's cells, used to show the statistic; advice: what to check when the statistic is off
// (default: the distribution; data tables: their input cells)
export function judgeSample(cells: string[], rc: RandomCheck, s: RandomSample | string, fmt?: string, advice?: string): { ok: boolean; message?: string } {
  if (typeof s === 'string') return { ok: false, message: s }
  const distinct = new Set(s.values.map((v) => String(v))).size
  const label = list(cells, 2)
  if (distinct === 1 && s.values.length > 1 && !(rc.stat === 'sd' && rc.target === 0)) {
    return { ok: false, message: `${label} ${cells.length > 1 ? 'give the same result on every recalculation: they need' : 'gives the same result on every recalculation: it needs'} a fresh random draw (RAND or RANDBETWEEN) each time` }
  }
  if (Math.abs(s.stat - rc.target) <= rc.tol) return { ok: true }
  const high = s.stat > rc.target
  const over = `Over ${rc.trials} recalculation${rc.trials === 1 ? '' : 's'}`
  if (rc.stat === 'p') {
    const pct = `${(s.stat * 100).toFixed(s.stat * 100 < 10 ? 1 : 0)}%`
    const what = rc.event === undefined || /^true$/i.test(rc.event.trim()) ? 'are TRUE' : `meet ${rc.event}`
    return { ok: false, message: `${over} ${pct} of the results in ${label} ${what}: the share of trials meeting the condition is off (too ${high ? 'high' : 'low'} for this model)${advice ? `; ${advice}` : ''}` }
  }
  const what = rc.stat === 'mean' ? 'average' : 'standard deviation'
  return { ok: false, message: `${over} the ${what} of ${label} is ${statText(s.stat, fmt, rc.tol)}: too ${high ? 'high' : 'low'} for this model; ${advice ?? 'check the distribution and its parameters'}` }
}

// a replication table whose runs all give the same result (down each column of runs; across each row for a row-input
// table): the input cell freezes the model instead of standing for the run number
export function constantRuns(cells: string[], values: readonly CellValue[], runsDown: boolean): boolean {
  const lines = new Map<number, { n: number; seen: Set<string> }>()
  cells.forEach((c, i) => {
    const p = parseRef(c)
    const key = runsDown ? p.col : p.row
    const line = lines.get(key) ?? { n: 0, seen: new Set<string>() }
    line.n += 1
    line.seen.add(String(values[i]))
    lines.set(key, line)
  })
  return lines.size > 0 && [...lines.values()].every((l) => l.n > 1 && l.seen.size === 1)
}

export const drawsRandom = (raw: string): boolean => isFormula(raw) && functionsUsed(raw).some((fn) => RANDOM_FNS.includes(fn))

// cells whose value depends on a random draw: formulas calling RAND/RANDBETWEEN, formulas reading such cells (directly or
// through other formulas) and data-table bodies whose formula cells are random. formulas: cell -> its entries
export function randomClosure(formulas: ReadonlyMap<string, readonly string[]>, tables: readonly DataTableDef[]): Set<string> {
  const readers = new Map<string, string[]>()
  const wide: [RangeBox, string][] = []
  const random = new Set<string>()
  const queue: string[] = []
  const mark = (cell: string): void => {
    if (random.has(cell)) return
    random.add(cell)
    queue.push(cell)
  }
  const link = (from: string, to: string): void => {
    const xs = readers.get(from)
    if (xs) xs.push(to)
    else readers.set(from, [to])
  }
  for (const [cell, raws] of formulas) {
    for (const raw of raws) {
      if (!isFormula(raw)) continue
      if (drawsRandom(raw)) mark(cell)
      for (const t of typedRefs(raw)) {
        const box = boxOf(bare(t))
        if (!box) continue
        if ((box.r2 - box.r1 + 1) * (box.c2 - box.c1 + 1) > 2000) wide.push([box, cell])
        else for (let r = box.r1; r <= box.r2; r++) for (let c = box.c1; c <= box.c2; c++) link(toRef(r, c), cell)
      }
    }
  }
  for (const def of tables) {
    const box = def && typeof def.range === 'string' ? boxOf(def.range) : undefined
    if (!box) continue
    const heads = def.rowInput && def.colInput ? [toRef(box.r1, box.c1)]
      : def.colInput ? Array.from({ length: box.c2 - box.c1 }, (_, i) => toRef(box.r1, box.c1 + 1 + i))
        : Array.from({ length: box.r2 - box.r1 }, (_, i) => toRef(box.r1 + 1 + i, box.c1))
    for (let r = box.r1 + 1; r <= box.r2; r++) for (let c = box.c1 + 1; c <= box.c2; c++) heads.forEach((h) => link(h, toRef(r, c)))
  }
  while (queue.length) {
    const cell = queue.pop() as string
    for (const reader of readers.get(cell) ?? []) mark(reader)
    const at = parseRef(cell)
    for (const [box, reader] of wide) if (inBox(box, at.row, at.col)) mark(reader)
  }
  return random
}

// ---------- solver constraints ----------

export function constraintIssues(sheet: LabSheet, setup: SolverSetup, check?: TaskCheck): string[] {
  const out: string[] = []
  const num = (ref: string): number => {
    const r = sheet.read(ref)
    return r.kind === 'number' ? r.value : r.kind === 'empty' ? 0 : NaN
  }
  const refs = (text: string): string[] => {
    try {
      return cellsOf(text.replace(/\$/g, ''))
    } catch {
      return []
    }
  }
  const side = (rhs: number | string | undefined, n: number): number[] | undefined => {
    if (typeof rhs === 'number') return [rhs]
    const text = String(rhs ?? '').trim()
    const lit = Number(text)
    if (text !== '' && Number.isFinite(lit)) return [lit]
    const cells = refs(text)
    return cells.length && (cells.length === 1 || cells.length === n) ? cells.map(num) : undefined
  }
  for (const c of setup.constraints ?? []) {
    const lhs = refs(String(c.lhs ?? ''))
    if (c.relation === 'int' || c.relation === 'bin') {
      const off = lhs.filter((l) => {
        const v = num(l)
        return c.relation === 'int' ? Math.abs(v - Math.round(v)) > 1e-6 : !(Math.abs(v) <= 1e-6 || Math.abs(v - 1) <= 1e-6)
      })
      if (off.length) out.push(`${list(off)} must be ${c.relation === 'int' ? 'whole numbers' : '0 or 1'} (constraint ${c.lhs} ${c.relation})`)
      continue
    }
    const rhs = side(c.rhs, lhs.length)
    if (!rhs) continue
    lhs.forEach((l, i) => {
      const a = num(l)
      const b = rhs.length === 1 ? rhs[0] : rhs[i]
      const tol = Math.max(check?.tol ?? 0, 1e-6 * Math.max(1, Math.abs(b)))
      const holds = c.relation === '<=' ? a <= b + tol : c.relation === '>=' ? a >= b - tol : Math.abs(a - b) <= tol
      if (!holds) out.push(`Constraint ${c.lhs} ${c.relation} ${String(c.rhs)} does not hold: ${l} is ${sheet.display(l) || '0'}`)
    })
  }
  if (setup.nonNegative ?? true) {
    const negative = refs(String(setup.changing ?? '')).filter((c) => num(c) < -1e-9)
    if (negative.length) out.push(`${list(negative)} must not be negative (Make Unconstrained Variables Non-Negative)`)
  }
  return out
}
