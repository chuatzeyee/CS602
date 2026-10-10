// checker.ts - grades a learner state against an exercise's reference solution. pure: builds its own sheets.
// rules: CONTRACTS.md "Checking semantics"; how to author for it: CHECKER_NOTES.md; building blocks: checkerUtil.ts.
import { canonicalRaw, parseInput } from './engine/input'
import { createLabSheet, writeCells } from './sheet'
import { boxesOverlap } from './refs'
import type { RangeBox } from './refs'
import { functionsUsed } from './syllabus'
import { applyTool } from './tools/index'
import { runAdvancedFilter } from './tools/advFilter'
import { listProcedures, runVba } from './vba/index'
import { checkVbaTask, withVbaBudget } from './vba/check'
import {
  LOCKED, RANDOM_FNS, NO_FILL, canon, cellsOf, boxOf, specCells, hasContent, specRaw, insideSheet, canonEdits, normTable,
  answerRecord, readOf, buildSheet, put, inBoxRef, sameValue, mismatch, cycleSource, list, fillWords, fillAxes, anchorNotes,
  refNotes, anchoringDiffers, hardCoded, readsNothing, isFormula, canonFn, functionIssues, result, single, sample, judgeSample,
  constantRuns, drawsRandom, randomClosure, refTokens, constraintIssues, referenceEntries, shapeOf, emptyNote, formulaAllowed,
} from './checkerUtil'
import type { RandomSample, Shape } from './checkerUtil'
import type {
  CellRead, CellValue, DataTableDef, Exercise, ExerciseResult, GoalSeekSetup, LabSheet, LearnerState, RandomCheck, SolverSetup,
  Task, TaskCheck, TaskResult,
} from './types'

export { cellsOf, fillEntry, sameValue } from './checkerUtil'
export type { RandomSample } from './checkerUtil'

// ---------- reference ----------

interface RefModel {
  state: LearnerState
  own: Map<string, string[]>           // task id -> cells its reference writes (its own cells first)
  tables: Map<string, DataTableDef[]>  // task id -> data tables its reference adds
  hidden: Map<string, number[]>        // task id -> hidden rows after its reference run, when it changed them
  problems: Map<string, string>        // task id -> why its reference could not be applied
  iterative: boolean
}

const models = new WeakMap<Exercise, RefModel>()

function hasCycle(sheet: LabSheet, cells: string[]): boolean {
  return cells.some((c) => {
    const r = sheet.read(c)
    return r.kind === 'error' && r.value === '#CYCLE!'
  })
}

function applyReference(sheet: LabSheet, task: Task): string | undefined {
  const entries = referenceEntries(task)
  if (task.kind === 'formula' || task.kind === 'value' || task.kind === 'criteria' || (task.kind === 'tool' && task.solutions)) {
    if (Object.keys(entries).length) {
      const r = writeCells(sheet, entries)
      if (!r.ok) return r.message
      if (!sheet.iterative && hasCycle(sheet, Object.keys(entries))) sheet.setIterative(true)
    }
  }
  if (task.kind === 'tool') {
    if (!task.tool || !task.toolSetup) return 'the task has no tool or tool setup'
    const r = applyTool(sheet, task.tool, task.toolSetup)
    return r.ok ? undefined : r.message
  }
  if (task.kind === 'vba' && task.vba) {
    const proc = listProcedures(task.vba.solution).find((p) => p.name.toLowerCase() === task.vba?.entry.toLowerCase())
    if (proc?.kind === 'function' && !task.vba.expected) return undefined
    const r = runVba(sheet, task.vba.solution, task.vba.entry, {
      activeCell: task.vba.activeCell, selection: task.vba.selection, inputs: task.vba.inputs,
    })
    return r.ok ? undefined : r.error?.message ?? 'the reference macro failed'
  }
  return undefined
}

const safeCells = (range: string | undefined): string[] => {
  try {
    return cellsOf(range)
  } catch {
    return []
  }
}

function buildModel(ex: Exercise): RefModel {
  const sheet = createLabSheet(ex.sheet)
  const own = new Map<string, string[]>()
  const tables = new Map<string, DataTableDef[]>()
  const hidden = new Map<string, number[]>()
  const problems = new Map<string, string>()
  const vba: Record<string, string> = {}
  const notes: Record<string, string> = {}
  const selfMarks: Record<string, boolean> = {}
  try {
    for (const task of ex.tasks) {
      const before = sheet.state()
      let problem: string | undefined
      try {
        problem = applyReference(sheet, task)
      } catch (e) {
        problem = e instanceof Error ? e.message : 'the reference could not be applied'
      }
      if (problem) problems.set(task.id, problem)
      const after = sheet.state()
      const cells = new Set(task.kind === 'explain' ? [] : safeCells(task.cells))
      for (const key of Object.keys(task.vba?.expected ?? {})) cells.add(canon(key) ?? key)
      for (const key of new Set([...Object.keys(before.edits), ...Object.keys(after.edits)])) {
        if (before.edits[key] !== after.edits[key]) cells.add(key)
      }
      own.set(task.id, [...cells])
      const had = new Set((before.dataTables ?? []).map((d) => d.range))
      tables.set(task.id, (after.dataTables ?? []).filter((d) => !had.has(d.range)))
      if (JSON.stringify(before.hiddenRows ?? []) !== JSON.stringify(after.hiddenRows ?? [])) hidden.set(task.id, after.hiddenRows ?? [])
      if (task.kind === 'vba' && task.vba) vba[task.id] = task.vba.solution
      if (task.kind === 'explain') {
        selfMarks[task.id] = true
        if (typeof task.answer === 'string') notes[task.id] = task.answer
      }
    }
    const state: LearnerState = { ...sheet.state() }
    if (Object.keys(vba).length) state.vba = vba
    if (Object.keys(notes).length) state.notes = notes
    if (Object.keys(selfMarks).length) state.selfMarks = selfMarks
    return { state, own, tables, hidden, problems, iterative: sheet.iterative }
  } finally {
    sheet.destroy()
  }
}

function modelOf(ex: Exercise): RefModel {
  let m = models.get(ex)
  if (!m) {
    m = buildModel(ex)
    models.set(ex, m)
  }
  return m
}

const cloneState = (s: LearnerState): LearnerState => JSON.parse(JSON.stringify(s)) as LearnerState

export function referenceState(ex: Exercise): LearnerState {
  return cloneState(modelOf(ex).state)
}

// for the validator: why a task's reference could not be applied, and which cells each task owns
export function referenceProblems(ex: Exercise): Record<string, string> {
  return Object.fromEntries(modelOf(ex).problems)
}

export function referenceFootprints(ex: Exercise): Record<string, string[]> {
  return Object.fromEntries([...modelOf(ex).own].map(([id, cells]) => [id, [...cells]]))
}

// ---------- learner context ----------

interface Ctx {
  ex: Exercise
  ref: RefModel
  learner: LearnerState
  edits: Map<string, string>     // learner edits, canonical refs
  owned: Set<string>             // cells some task owns
  helper: Record<string, string> // learner entries outside every task, kept for every check
  helperTables: DataTableDef[]
  iterative: boolean             // the learner's iterative-calculation switch
  random: boolean                // the model draws random numbers
  randomCells: Map<string, Set<string>>  // task id -> cells whose value comes from random draws (see randomCells)
  shared?: LabSheet              // reference + helpers; one task's entries are swapped in at a time
  mine?: LabSheet                // the learner's own sheet, for showing values as they see them
}

function makeCtx(ex: Exercise, state: LearnerState): Ctx {
  const ref = modelOf(ex)
  const spec = specCells(ex.sheet)
  const edits = canonEdits(ex.sheet, state?.edits)
  const owned = new Set<string>()
  for (const cells of ref.own.values()) cells.forEach((c) => owned.add(c))
  const helper: Record<string, string> = {}
  for (const [cell, raw] of edits) {
    const s = spec.get(cell)
    if (owned.has(cell) || hasContent(s) || s?.role === 'input' || LOCKED.has(s?.role)) continue
    helper[cell] = raw
  }
  const refBoxes = [...ref.tables.values()].flat().map((d) => boxOf(d.range)).filter((b): b is RangeBox => Boolean(b))
  const helperTables = (state?.dataTables ?? []).map(normTable).filter((d): d is DataTableDef => {
    const box = d ? boxOf(d.range) : undefined
    return Boolean(box && !refBoxes.some((b) => boxesOverlap(b, box)) && ![...owned].some((c) => inBoxRef(box, c)))
  })
  const formulas = [
    ...[...spec.values()].map((c) => c.f ?? ''),
    ...Object.values(ref.state.edits),
    ...Object.values(helper),
  ]
  const random = formulas.some((f) => f.includes('(') && functionsUsed(f).some((fn) => RANDOM_FNS.includes(fn)))
  return {
    ex, ref, learner: state ?? { edits: {} }, edits, owned, helper, helperTables,
    iterative: state?.iterative ?? ex.sheet.iterative ?? false, random, randomCells: new Map(),
  }
}

function sharedSheet(ctx: Ctx): LabSheet {
  if (!ctx.shared) {
    ctx.shared = buildSheet(ctx.ex.sheet, {
      edits: { ...ctx.ref.state.edits, ...ctx.helper },
      fmts: { ...ctx.ref.state.fmts, ...ctx.learner.fmts },
      dataTables: [...(ctx.ref.state.dataTables ?? []), ...ctx.helperTables],
      iterative: ctx.ref.iterative,
    })
  }
  return ctx.shared
}

const ownOf = (ctx: Ctx, task: Task): string[] => ctx.ref.own.get(task.id) ?? cellsOf(task.cells)

// the learner's entries for a task's cells; formulas the engine cannot read are blanked and reported
function learnerEntries(ctx: Ctx, cells: string[], sheet: LabSheet): { entries: Record<string, string>; broken: Set<string> } {
  const entries: Record<string, string> = {}
  const broken = new Set<string>()
  for (const cell of cells) {
    const raw = ctx.edits.get(cell) ?? specRaw(ctx.ex.sheet, cell)
    const p = parseInput(raw)
    if (p.kind === 'formula' && !sheet.hf.validateFormula(p.formula)) {
      broken.add(cell)
      entries[cell] = ''
    } else {
      entries[cell] = raw
    }
  }
  return { entries, broken }
}

function referenceEntriesFor(ctx: Ctx, cells: string[]): Record<string, string> {
  return Object.fromEntries(cells.map((c) => [c, ctx.ref.state.edits[c] ?? specRaw(ctx.ex.sheet, c)]))
}

// spec + the reference for every other task + helper cells + the learner's entries for this task
function isolatedState(ctx: Ctx, task: Task, tables: DataTableDef[]): LearnerState {
  const own = new Set(ownOf(ctx, task))
  const edits: Record<string, string> = {}
  for (const [cell, raw] of Object.entries(ctx.ref.state.edits)) if (!own.has(cell)) edits[cell] = raw
  Object.assign(edits, ctx.helper)
  for (const cell of own) {
    const raw = ctx.edits.get(cell)
    if (raw !== undefined) edits[cell] = raw
  }
  return { edits, fmts: { ...ctx.learner.fmts }, dataTables: tables, iterative: ctx.iterative }
}

function otherTables(ctx: Ctx, task: Task): DataTableDef[] {
  const out: DataTableDef[] = []
  for (const t of ctx.ex.tasks) if (t.id !== task.id) out.push(...(ctx.ref.tables.get(t.id) ?? []))
  return out
}

// ---------- comparing ----------

// ---------- results ----------

// ---------- formula and value tasks (one shared sheet, entries swapped in and out) ----------

interface Variant { name: string; inputs: Record<string, string> }

function variantsOf(ex: Exercise): Variant[] {
  const out: Variant[] = [{ name: '', inputs: {} }]
  for (const tc of ex.testCases ?? []) {
    const inputs: Record<string, string> = {}
    for (const [key, v] of Object.entries(tc.inputs ?? {})) {
      const ref = canon(key)
      if (ref && insideSheet(ex.sheet, ref)) inputs[ref] = canonicalRaw(v)
    }
    out.push({ name: tc.name, inputs })
  }
  return out
}

interface Reading { read: CellRead; shown: string; loop?: string }

// loop: for a #CYCLE! cell that only reads a circular chain, the loop cell its error comes from
function readingOf(sheet: LabSheet, cell: string): Reading {
  const read = sheet.read(cell)
  const loop = read.kind === 'error' && read.value === '#CYCLE!' ? cycleSource(sheet, cell) : undefined
  return loop ? { read, shown: sheet.display(cell), loop } : { read, shown: sheet.display(cell) }
}

function readUnder(sheet: LabSheet, cells: string[], v: Variant, rerunTables: boolean): Reading[] {
  const keys = Object.keys(v.inputs)
  const take = () => cells.map((c) => readingOf(sheet, c))
  if (!keys.length) return take()
  const saved = Object.fromEntries(keys.map((c) => [c, sheet.raw(c)]))
  put(sheet, v.inputs)
  if (rerunTables) sheet.recalc()
  try {
    return take()
  } finally {
    put(sheet, saved)
    if (rerunTables) sheet.recalc()
  }
}

interface Swapped { got: Reading[][]; want: CellRead[][]; raws: Record<string, string>; broken: Set<string> }

function swapAndRead(ctx: Ctx, task: Task, cells: string[], variants: Variant[]): Swapped {
  const sheet = sharedSheet(ctx)
  const rerun = sheet.dataTables.length > 0 && !ctx.random && variants.length > 1
  const own = ownOf(ctx, task)
  const want = variants.map((v) => readUnder(sheet, cells, v, rerun).map((r) => r.read))
  const { entries, broken } = learnerEntries(ctx, own, sheet)
  const back = referenceEntriesFor(ctx, own)
  const flip = ctx.iterative !== sheet.iterative
  put(sheet, Object.fromEntries(own.map((c) => [c, ''])))  // clear first so a learner's spilling formula has room
  put(sheet, entries)
  if (flip) sheet.setIterative(ctx.iterative)
  try {
    const got = variants.map((v) => readUnder(sheet, cells, v, rerun))
    const raws = Object.fromEntries(cells.map((c) => [c, ctx.edits.get(c) ?? specRaw(ctx.ex.sheet, c)]))
    return { got, want, raws, broken }
  } finally {
    if (flip) sheet.setIterative(!ctx.iterative)
    put(sheet, back)
    if (rerun) sheet.recalc()
  }
}

// message order: what to fix first comes first; at most MAX_MESSAGES are shown
type Note = [number, string]
const SYNTAX = 0
const MISSING = 1
const FILLED = 2   // the first cell is right and the filled cells are not: the $ signs come before the symptoms
const VALUE = 3
const ANCHOR = 4
const CASE = 5
const FUNCTION = 6
const MORE = 7
const sorted = (notes: Note[]): string[] => [...notes].sort((a, b) => a[0] - b[0]).map((n) => n[1])

const referenceRaw = (ctx: Ctx, cell: string): string => ctx.ref.state.edits[cell] ?? specRaw(ctx.ex.sheet, cell)

// cells whose value comes from random draws, under the reference or with the learner's entries for this task
function randomCells(ctx: Ctx, task: Task): Set<string> {
  const cached = ctx.randomCells.get(task.id)
  if (cached) return cached
  const base = new Map<string, string>()
  for (const ref of specCells(ctx.ex.sheet).keys()) base.set(ref, specRaw(ctx.ex.sheet, ref))
  for (const [ref, raw] of [...Object.entries(ctx.ref.state.edits), ...Object.entries(ctx.helper)]) base.set(ref, raw)
  const formulas = new Map<string, string[]>()
  for (const [ref, raw] of base) if (isFormula(raw)) formulas.set(ref, [raw])
  for (const cell of ownOf(ctx, task)) {
    const raw = ctx.edits.get(cell)
    if (raw !== undefined && isFormula(raw)) formulas.set(cell, [...(formulas.get(cell) ?? []), raw])
  }
  const found = randomClosure(formulas, [...(ctx.ref.state.dataTables ?? []), ...ctx.helperTables])
  ctx.randomCells.set(task.id, found)
  return found
}

// the value as the learner sees it on their own sheet; '' when that differs from the checked (isolated) value
function shownToLearner(ctx: Ctx, cell: string, checked: Reading): string {
  if (!ctx.mine) ctx.mine = buildSheet(ctx.ex.sheet, { ...ctx.learner, edits: Object.fromEntries(ctx.edits), hiddenRows: [] })
  const own = ctx.mine.read(cell)
  return sameValue(own, checked.read, { tol: 0, relTol: 1e-12, caseSensitive: true }) ? ctx.mine.display(cell) : ''
}

// random: the cell's formula (the learner's or the reference's) draws or reads random cells
function valueNote(ctx: Ctx, cell: string, got: Reading, want: CellRead, random: boolean): string {
  if (got.read.kind === 'error' || got.read.kind === 'empty') return mismatch(cell, got.read, got.shown, want, got.loop)
  const shown = random ? '' : shownToLearner(ctx, cell, got)
  if (shown) return mismatch(cell, got.read, shown, want)
  return random ? `${cell}: gives a different result from the model answer for the same random draws` : `${cell}: expected a different value`
}

function entryNotes(cells: string[], s: Swapped, spilled: Set<string>, needFormula: boolean, range: string, shape: Shape, bad: Set<string>): Note[] {
  const notes: Note[] = []
  const { raws, broken } = s
  const unreadable = cells.filter((c) => broken.has(c))
  unreadable.forEach((c) => bad.add(c))
  if (unreadable.length) notes.push([SYNTAX, `${list(unreadable)}: Excel cannot read this formula (check the brackets, commas and quotes)`])
  if (!needFormula) return notes
  const empty = cells.filter((c) => !broken.has(c) && !spilled.has(c) && raws[c].trim() === '')
  const typed = cells.filter((c) => !broken.has(c) && raws[c].trim() !== '' && !isFormula(raws[c]))
  empty.forEach((c) => bad.add(c))
  typed.forEach((c) => bad.add(c))
  if (empty.length) notes.push([MISSING, emptyNote(cells, empty, range, shape, raws)])
  if (typed.length) notes.push([MISSING, `${list(typed)}: this cell needs a formula, not a typed value`])
  return notes
}

// a test case the base data passes: a typed input value, else $ signs that differ from the model answer, else the logic
function caseNotes(ctx: Ctx, cells: string[], s: Swapped, variants: Variant[], check: TaskCheck | undefined, bad: Set<string>, anchorsOff: boolean): Note[] {
  const notes: Note[] = []
  for (let k = 1; k < variants.length; k++) {
    const failing = cells.filter((c, i) => !bad.has(c) && !sameValue(s.got[k][i].read, s.want[k][i], check))
    if (!failing.length) continue
    failing.forEach((c) => bad.add(c))
    const name = variants[k].name
    const inputs = Object.keys(variants[k].inputs).map((c) => specCells(ctx.ex.sheet).get(c)?.v).filter((v): v is number => typeof v === 'number')
    let why: string | undefined
    for (const c of failing) {
      const typedIn = hardCoded(s.raws[c], inputs, referenceRaw(ctx, c))
      if (typedIn || readsNothing(s.raws[c])) {
        why = typedIn ? `${c} has ${typedIn} typed in; refer to the input cell instead` : `${c} is a hard-coded number (no cell references): refer to the input cells instead`
        break
      }
    }
    if (!why && anchorsOff) why = 'check which references need $ before filling'
    notes.push([CASE, why ? `${list(failing)}: correct on the given data but wrong when '${name}': ${why}` : `${list(failing)}: correct on the given data; check the logic for this case: '${name}'`])
  }
  return notes
}

function checkFormula(ctx: Ctx, task: Task): TaskResult {
  const cells = cellsOf(task.cells)
  const check = task.check
  const needFormula = check?.formulaRequired ?? true
  const variants = variantsOf(ctx.ex)
  const s = swapAndRead(ctx, task, cells, variants)
  const shape = shapeOf(task, cells, s.want[0])
  const bad = new Set<string>()
  // cells filled by a dynamic-array formula in a neighbour: no entry of their own, but a value
  const spilled = new Set(cells.filter((c, i) => s.raws[c].trim() === '' && s.got[0][i].read.kind !== 'empty'))
  const notes = entryNotes(cells, s, spilled, needFormula, task.cells, shape, bad)
  const first = cells[0]
  const firstFormula = isFormula(s.raws[first]) && !s.broken.has(first)
  const anchorsOff = firstFormula && anchoringDiffers(s.raws[first], referenceRaw(ctx, first), shape.axes)
  const anchors = firstFormula
    ? [...anchorNotes(s.raws[first], check?.absolute ?? [], shape.axes, fillWords(cells)), ...refNotes(s.raws[first], check?.refs ?? [])]
    : []

  const wrong = cells.filter((c, i) => !bad.has(c) && !sameValue(s.got[0][i].read, s.want[0][i], check))
  wrong.forEach((c) => bad.add(c))
  if (wrong.length) {
    const i = cells.indexOf(wrong[0])
    notes.push([VALUE, valueNote(ctx, wrong[0], s.got[0][i], s.want[0][i], ctx.random && randomCells(ctx, task).has(wrong[0]))])
    if (wrong.length > 1) notes.push([MORE, `${wrong.length - 1} more cell${wrong.length > 2 ? 's are' : ' is'} wrong (${list(wrong.slice(1))})`])
  }
  const firstRight = !bad.has(first)
  notes.push(...caseNotes(ctx, cells, s, variants, check, bad, anchorsOff))

  // empty, typed and unreadable cells are reported above: function rules only look at the formulas
  const fn = functionIssues(cells.filter((c) => !spilled.has(c) && !s.broken.has(c) && isFormula(s.raws[c])), s.raws, check)
  fn.bad.forEach((c) => bad.add(c))
  notes.push(...fn.messages.map((m): Note => [FUNCTION, m]))

  if (anchors.length) {
    bad.add(first)
    notes.push(...anchors.map((m): Note => [firstRight && wrong.length ? FILLED : ANCHOR, m]))
  } else if (wrong.length && firstRight && anchorsOff && wrong.every((c) => isFormula(s.raws[c]))) {
    notes.push([FILLED, `${first} is right but ${wrong[0]} is not: check which references need $ before filling`])
  }
  return result(task, cells, bad, sorted(notes))
}

function expectedValues(task: Task, cells: string[]): Record<string, CellValue> {
  const rec = answerRecord(task)
  if (rec) return Object.fromEntries(Object.entries(rec).map(([k, v]) => [canon(k) ?? k, v]))
  return Object.fromEntries(cells.map((c) => [c, task.answer as CellValue]))
}

function checkValue(ctx: Ctx, task: Task): TaskResult {
  const expected = expectedValues(task, cellsOf(task.cells))
  const cells = Object.keys(expected)
  const { got, raws } = swapAndRead(ctx, task, cells, [{ name: '', inputs: {} }])
  const bad = new Set<string>()
  const messages: string[] = []
  cells.forEach((c, i) => {
    const raw = (raws[c] ?? '').trim()
    if (isFormula(raw) && !formulaAllowed(task, c)) {
      bad.add(c)
      messages.push(`Type the value itself in ${c} (a number or text), not a formula`)
      return
    }
    const want = readOf(expected[c])
    if (sameValue(got[0][i].read, want, task.check)) return
    bad.add(c)
    messages.push(raw === '' ? `Type your answer in ${c}` : valueNote(ctx, c, got[0][i], want, false))
  })
  return result(task, cells, bad, messages)
}

// ---------- random tasks ----------

function randomSheet(ctx: Ctx, task: Task): LabSheet {
  const mine = task.kind === 'tool' && task.tool === 'datatable' ? learnerTablesFor(ctx, task) : []
  // other tasks' tables re-run on every trial: drop them for a plain draw (RAND in the formula) that does not read them
  const formulas = Object.values(referenceEntries(task)).join(' ')
  const draws = formulas.includes('(') && functionsUsed(formulas).some((fn) => RANDOM_FNS.includes(fn))
  const read = [...refTokens(formulas)].map((t) => boxOf(t.replace(/\$/g, ''))).filter((b): b is RangeBox => Boolean(b))
  const others = otherTables(ctx, task).filter((d) => {
    const box = boxOf(d.range)
    return Boolean(box && (!draws || read.some((b) => boxesOverlap(box, b))))
  })
  return buildSheet(ctx.ex.sheet, isolatedState(ctx, task, [...others, ...mine, ...ctx.helperTables]))
}

// the value of an input the reference refers to, typed into a random formula instead (test cases cannot catch it:
// the draws are checked statistically)
function typedInputs(ctx: Ctx, task: Task, cells: string[], raws: Record<string, string>): string | undefined {
  const entries = referenceEntries(task)
  const spec = specCells(ctx.ex.sheet)
  const inputs = [...refTokens(Object.values(entries).join(' '))].filter((t) => !t.includes(':')).map((t) => spec.get(t.replace(/\$/g, '')))
    .filter((c) => c?.role === 'input' && typeof c.v === 'number').map((c) => c?.v as number)
  for (const c of cells) {
    const typed = isFormula(raws[c]) ? hardCoded(raws[c], inputs, entries[c] ?? '') : undefined
    if (typed) return `${c} has ${typed} typed in; refer to the input cell instead`
  }
  return undefined
}

function checkRandomFormula(ctx: Ctx, task: Task, rc: RandomCheck): TaskResult {
  const cells = cellsOf(task.cells)
  const raws = Object.fromEntries(cells.map((c) => [c, ctx.edits.get(c) ?? specRaw(ctx.ex.sheet, c)]))
  const reference = referenceEntries(task)
  const bad = new Set<string>()
  const messages: string[] = []
  const notFormula = cells.filter((c) => !isFormula(raws[c]))
  if ((task.check?.formulaRequired ?? true) && notFormula.length) {
    notFormula.forEach((c) => bad.add(c))
    messages.push(notFormula.every((c) => raws[c].trim() === '') ? `${list(notFormula)}: enter a formula` : `${list(notFormula)}: this cell needs a formula, not a typed value`)
  }
  // a reference that draws needs a learner formula that draws, whatever mustUse says; one that only reads random cells does not
  const needs = cells.filter((c) => isFormula(raws[c]) && drawsRandom(reference[c] ?? '') && !drawsRandom(raws[c]))
  needs.forEach((c) => bad.add(c))
  if (needs.length) messages.push(`${list(needs)}: the formula must draw a random number with RAND or RANDBETWEEN`)
  const mustUse = (task.check?.mustUse ?? []).filter((f) => !(needs.length && RANDOM_FNS.includes(canonFn(f))))
  const fn = functionIssues(cells.filter((c) => isFormula(raws[c])), raws, { ...task.check, mustUse })
  fn.bad.forEach((c) => bad.add(c))
  messages.push(...fn.messages)
  const first = cells[0]
  const axes = task.solutions ? NO_FILL : fillAxes(cells)
  const anchors = isFormula(raws[first])
    ? [...anchorNotes(raws[first], task.check?.absolute ?? [], axes, fillWords(cells)), ...refNotes(raws[first], task.check?.refs ?? [])]
    : []
  if (anchors.length) bad.add(first)
  messages.push(...anchors)
  const typed = typedInputs(ctx, task, cells, raws)
  if (typed) {
    cells.forEach((c) => bad.add(c))
    messages.push(typed)
  }
  if (bad.size) return result(task, cells, bad, messages)
  const sheet = randomSheet(ctx, task)
  try {
    const judged = judgeSample(cells, rc, sample(sheet, cells, rc), sheet.fmt(first))
    if (!judged.ok) cells.forEach((c) => bad.add(c))
    return result(task, cells, bad, judged.message ? [judged.message] : [])
  } finally {
    sheet.destroy()
  }
}

// for the validator: the reference sample of a random task (to size its tolerance)
export function sampleRandomTask(ex: Exercise, task: Task, state: LearnerState): RandomSample | string {
  if (!task.random) return 'not a random task'
  const ctx = makeCtx(ex, state)
  if (task.kind === 'tool' && task.tool === 'datatable' && !learnerTablesFor(ctx, task).length) return 'no data table'
  const sheet = randomSheet(ctx, task)
  try {
    return sample(sheet, cellsOf(task.cells), task.random)
  } finally {
    sheet.destroy()
  }
}

// ---------- tool tasks ----------

function refTableOf(ctx: Ctx, task: Task): DataTableDef | undefined {
  return normTable(task.toolSetup as DataTableDef) ?? ctx.ref.tables.get(task.id)?.[0]
}

function learnerTablesFor(ctx: Ctx, task: Task): DataTableDef[] {
  const want = refTableOf(ctx, task)
  const box = want ? boxOf(want.range) : undefined
  if (!box) return []
  return (ctx.learner.dataTables ?? []).map(normTable).filter((d): d is DataTableDef => {
    const b = d ? boxOf(d.range) : undefined
    return Boolean(b && boxesOverlap(b, box))
  })
}

function tableIssue(ctx: Ctx, task: Task): string | undefined {
  const want = refTableOf(ctx, task)
  if (!want) return 'This data table task has no reference setup'
  const mine = learnerTablesFor(ctx, task)
  const exact = mine.find((d) => d.range === want.range)
  if (!exact) {
    if (mine.length) return `Your data table covers ${mine[0].range}: select the whole block ${want.range} (input values plus the formula row or column) before What-If Analysis › Data Table`
    return `There is no data table in ${want.range} yet: select ${want.range}, then What-If Analysis › Data Table`
  }
  const needRow = Boolean(want.rowInput)
  const needCol = Boolean(want.colInput)
  if (needRow && needCol && !(exact.rowInput && exact.colInput)) return 'This two-variable table needs both a Row input cell and a Column input cell'
  if (!needRow && needCol && (exact.rowInput || !exact.colInput)) return 'The input values run down a column, so use the Column input cell (leave the Row input cell empty)'
  if (needRow && !needCol && (exact.colInput || !exact.rowInput)) return 'The input values run across a row, so use the Row input cell (leave the Column input cell empty)'
  return undefined
}

// Excel's Goal Seek leaves a number in the changing cell: a formula there means the tool was not run
function goalSeekIssue(ctx: Ctx, task: Task): string | undefined {
  const cell = canon(String((task.toolSetup as Partial<GoalSeekSetup> | undefined)?.changingCell ?? ''))
  if (!cell || !isFormula(ctx.edits.get(cell) ?? specRaw(ctx.ex.sheet, cell))) return undefined
  return `Run Goal Seek: it leaves a number in ${cell}; a formula there skips the tool`
}

function checkTool(ctx: Ctx, task: Task): TaskResult {
  const expected = answerRecord(task) ? expectedValues(task, []) : {}
  const cells = Object.keys(expected).length ? Object.keys(expected) : cellsOf(task.cells)
  const seek = task.tool === 'goalseek' ? goalSeekIssue(ctx, task) : undefined
  if (seek) return result(task, cells, new Set(cells), [seek])
  if (task.tool === 'datatable') {
    const issue = tableIssue(ctx, task)
    if (issue) return result(task, cells, new Set(cells), [issue])
  }
  const mine = task.tool === 'datatable' ? learnerTablesFor(ctx, task) : []
  if (task.random) return checkRandomTool(ctx, task, task.random)
  const sheet = buildSheet(ctx.ex.sheet, isolatedState(ctx, task, [...otherTables(ctx, task), ...mine, ...ctx.helperTables]))
  try {
    const bad = new Set<string>()
    const messages: string[] = []
    for (const [cell, v] of Object.entries(expected)) {
      const got = sheet.read(cell)
      const want = readOf(v)
      if (sameValue(got, want, task.check)) continue
      bad.add(cell)
      if (bad.size === 1) messages.push(mismatch(cell, got, sheet.display(cell), want, readingOf(sheet, cell).loop) + (got.kind === 'error' ? '' : toolHint(task)))
    }
    if (bad.size > 1) messages.push(`${bad.size - 1} more cell${bad.size > 2 ? 's are' : ' is'} wrong (${list([...bad].slice(1))})`)
    if (task.tool === 'solver' && task.toolSetup) messages.push(...constraintIssues(sheet, task.toolSetup as SolverSetup, task.check))
    const hidden = ctx.ref.hidden.get(task.id)
    if (hidden && (task.tool === 'autofilter' || task.tool === 'advfilter')) {
      const mineHidden = [...new Set(ctx.learner.hiddenRows ?? [])].sort((a, b) => a - b)
      if (JSON.stringify(mineHidden) !== JSON.stringify(hidden)) {
        messages.push(`The filter hides ${mineHidden.length} rows; ${hidden.length} rows should be hidden for these conditions`)
      }
    }
    return result(task, cells, bad, messages)
  } finally {
    sheet.destroy()
  }
}

const TOOL_HINTS: Partial<Record<string, string>> = {
  goalseek: 'run Goal Seek and keep the solution',
  solver: 'run Solver and keep the solution',
  datatable: 'check the input cell(s) of the data table',
  pivot: 'build the PivotTable with the fields the task asks for',
  sort: 'sort the list by the columns and order the task asks for',
  advfilter: 'run the Advanced Filter and copy the result to the cell the task names',
}
const toolHint = (task: Task): string => (TOOL_HINTS[task.tool ?? ''] ? `: ${TOOL_HINTS[task.tool ?? '']}` : '')

function checkRandomTool(ctx: Ctx, task: Task, rc: RandomCheck): TaskResult {
  const cells = cellsOf(task.cells)
  const sheet = randomSheet(ctx, task)
  try {
    const s = sample(sheet, cells, rc)
    const def = task.tool === 'datatable' ? refTableOf(ctx, task) : undefined
    // the model cells are the reference's (isolation): a table that is off is set up wrong, mostly its input cells
    if (typeof s !== 'string' && def && constantRuns(cells, s.values.slice(0, cells.length), Boolean(def.colInput))) {
      return result(task, cells, new Set(cells), ['The data table gives the same result in every run: check the Row/Column input cells (the runs need a blank input cell that no formula uses)'])
    }
    const judged = judgeSample(cells, rc, s, sheet.fmt(cells[0]), def ? 'check the Row/Column input cells of the data table' : undefined)
    return result(task, cells, judged.ok ? new Set() : new Set(cells), judged.message ? [judged.message] : [])
  } finally {
    sheet.destroy()
  }
}

// ---------- criteria, vba, explain ----------

function checkCriteria(ctx: Ctx, task: Task): TaskResult {
  const crit = task.criteria
  const cells = cellsOf(task.cells)
  if (!crit) return single(task, false, ['This task has no criteria to check'], cells)
  const sheet = sharedSheet(ctx)
  const own = ownOf(ctx, task)
  const { entries, broken } = learnerEntries(ctx, own, sheet)
  const back = referenceEntriesFor(ctx, own)
  put(sheet, entries)
  let res: { rows: number[]; error?: string }
  try {
    res = runAdvancedFilter(sheet, { list: crit.list, criteria: task.cells, unique: crit.unique })
  } finally {
    put(sheet, back)
  }
  if (broken.size) return single(task, false, [`${list([...broken])}: Excel cannot read this formula (check the brackets, commas and quotes)`], cells)
  if (res.error) return single(task, false, [res.error], cells)
  const got = new Set(res.rows)
  const want = new Set(crit.expectedRows)
  const extra = [...got].filter((r) => !want.has(r)).sort((a, b) => a - b)
  const missing = [...want].filter((r) => !got.has(r)).sort((a, b) => a - b)
  if (!extra.length && !missing.length) return single(task, true, [], cells)
  const messages = [`Your criteria pick ${got.size} row${got.size === 1 ? '' : 's'}; ${want.size} row${want.size === 1 ? ' meets' : 's meet'} the conditions`]
  if (extra.length) messages.push(`Row${extra.length === 1 ? '' : 's'} ${list(extra.map(String))} should not be picked`)
  if (missing.length) messages.push(`Row${missing.length === 1 ? '' : 's'} ${list(missing.map(String))} should be picked too`)
  return single(task, false, messages, cells)
}

function checkExplain(ctx: Ctx, task: Task): TaskResult {
  const mark = ctx.learner.selfMarks?.[task.id]
  if (mark === undefined) {
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: ['Write your answer, compare it with the model answer, then mark it'], cells: {}, pending: true }
  }
  return { taskId: task.id, ok: mark, correct: mark ? 1 : 0, total: 1, messages: mark ? [] : ['You marked this answer as not right yet'], cells: {} }
}

// ---------- entry points ----------

function runTask(ctx: Ctx, task: Task): TaskResult {
  try {
    switch (task.kind) {
      case 'formula': return task.random ? checkRandomFormula(ctx, task, task.random) : checkFormula(ctx, task)
      case 'value': return checkValue(ctx, task)
      case 'tool': return checkTool(ctx, task)
      case 'criteria': return checkCriteria(ctx, task)
      case 'vba': return checkVbaTask(ctx.ex, task, ctx.learner)
      case 'explain': return checkExplain(ctx, task)
      default: return single(task, false, [`Unknown task kind "${String(task.kind)}"`])
    }
  } catch (e) {
    return single(task, false, [`This task could not be checked: ${e instanceof Error ? e.message : 'unexpected problem'}`])
  }
}

function withCtx<T>(ex: Exercise, state: LearnerState, run: (ctx: Ctx) => T): T {
  const ctx = makeCtx(ex, state)
  try {
    return run(ctx)
  } finally {
    ctx.shared?.destroy()
    ctx.mine?.destroy()
  }
}

export function checkTask(ex: Exercise, task: Task, state: LearnerState): TaskResult {
  return withVbaBudget(() => withCtx(ex, state, (ctx) => runTask(ctx, task)))
}

const floorQuarter = (x: number): number => Math.floor(x * 4 + 1e-9) / 4

export function checkExercise(ex: Exercise, state: LearnerState): ExerciseResult {
  return withVbaBudget(() => withCtx(ex, state, (ctx) => {
    const tasks = ex.tasks.map((t) => runTask(ctx, t))
    const ok = tasks.filter((t) => t.ok).length
    const out: ExerciseResult = { score: ex.tasks.length ? ok / ex.tasks.length : 0, tasks }
    if (ex.tasks.some((t) => t.marks !== undefined)) {
      let got = 0
      let max = 0
      ex.tasks.forEach((t, i) => {
        const m = t.marks ?? 0
        const r = tasks[i]
        const frac = r.pending ? 0 : r.total > 0 ? Math.min(1, r.correct / r.total) : r.ok ? 1 : 0
        got += floorQuarter(m * frac)
        max += m
      })
      out.marks = { got, max }
    }
    return out
  }))
}

export function revealTask(ex: Exercise, task: Task, state: LearnerState): LearnerState {
  const model = modelOf(ex)
  const own = model.own.get(task.id) ?? cellsOf(task.cells)
  const edits: Record<string, string> = Object.fromEntries(canonEdits(ex.sheet, state?.edits))
  const fmts: Record<string, string> = {}
  for (const [key, code] of Object.entries(state?.fmts ?? {})) {
    const ref = canon(key)
    if (ref) fmts[ref] = code
  }
  // a reference that could not be applied (a stubbed tool) has nothing to show: keep the learner's cells
  for (const cell of model.problems.has(task.id) ? [] : own) {
    const raw = model.state.edits[cell]
    if (raw === undefined) delete edits[cell]
    else edits[cell] = raw
    const code = model.state.fmts?.[cell]
    if (code !== undefined) fmts[cell] = code
  }
  const next: LearnerState = { ...cloneState({ ...state, edits: {} }), edits }
  if (Object.keys(fmts).length) next.fmts = fmts
  const mine = model.tables.get(task.id) ?? []
  if (mine.length) {
    const boxes = mine.map((d) => boxOf(d.range)).filter((b): b is RangeBox => Boolean(b))
    const kept = (state?.dataTables ?? []).map(normTable).filter((d): d is DataTableDef => {
      const b = d ? boxOf(d.range) : undefined
      return Boolean(b && !boxes.some((x) => boxesOverlap(x, b)))
    })
    next.dataTables = [...kept, ...mine.map((d) => ({ ...d }))]
  }
  const hidden = model.hidden.get(task.id)
  if (hidden) next.hiddenRows = [...hidden]
  if (task.kind === 'vba' && task.vba) next.vba = { ...state?.vba, [task.id]: task.vba.solution }
  if (task.kind === 'explain') {
    next.selfMarks = { ...state?.selfMarks, [task.id]: true }
    const mineNote = state?.notes?.[task.id]
    if ((!mineNote || !mineNote.trim()) && typeof task.answer === 'string') next.notes = { ...state?.notes, [task.id]: task.answer }
  }
  if (model.iterative && !(state?.iterative ?? ex.sheet.iterative ?? false)) next.iterative = true
  return next
}
