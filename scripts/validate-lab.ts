// validate-lab.ts - checks every lab exercise before it ships: schema, syllabus, the reference passes, wrong answers fail.
// usage: npx tsx scripts/validate-lab.ts [src/data/lab/w03.ts ...] [--mocks] [--fixtures] [--json]
//   no files and no --mocks/--fixtures = every week's exercises plus the mock exams. Exit code 1 on any failure.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  cellsOf, checkExercise, checkTask, fillEntry, referenceFootprints, referenceProblems, referenceState, sameValue, sampleRandomTask,
} from '../src/lab/checker.ts'
import { usesFunction } from '../src/lab/checkerUtil.ts'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { normRef, parseRange, splitRanges, stripDollars } from '../src/lab/refs.ts'
import { canonicalRaw } from '../src/lab/engine/input.ts'
import { FIRST_TAUGHT, functionsUsed, notYetTaught } from '../src/lab/syllabus.ts'
import { EXAM_TECHNIQUES } from '../src/data/lab/techniques.ts'
import type { CellRead, CellValue, Exercise, LearnerState, MockExam, SheetSpec, Task, TaskKind, ToolName, Week } from '../src/lab/types.ts'

export type Level = 'error' | 'warn' | 'skip'
export interface Issue { level: Level; task?: string; message: string }
export type Status = 'PASS' | 'WARN' | 'SKIP' | 'FAIL'
export interface Report { id: string; week: string; source: string; tasks: number; ms: number; status: Status; issues: Issue[] }

const WARN_MS = 1500
const STUB = /not available yet/i
const WEEKS: readonly Week[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W9', 'W10', 'EXAM']
const KINDS: readonly TaskKind[] = ['formula', 'value', 'tool', 'criteria', 'vba', 'explain']
const TOOLS: readonly ToolName[] = ['goalseek', 'solver', 'datatable', 'pivot', 'advfilter', 'autofilter', 'sort']
const ROLES = ['label', 'header', 'input', 'given', 'answer', 'note']
const VOLATILE_DATE = ['TODAY', 'NOW']

// ---------- schema ----------

function rangeProblem(spec: SheetSpec, range: string, what: string): string | undefined {
  const parts = splitRanges(range)
  if (!parts.length) return `${what} is empty`
  for (const part of parts) {
    let box
    try {
      box = parseRange(part.replace(/\$/g, ''))
    } catch {
      return `${what} "${part}" is not a cell or range`
    }
    if (box.r2 >= spec.rows || box.c2 >= spec.cols) return `${what} ${part} is outside the ${spec.rows}x${spec.cols} sheet`
  }
  return undefined
}

function sheetIssues(ex: Exercise): Issue[] {
  const out: Issue[] = []
  const spec = ex.sheet
  if (!spec || !Number.isInteger(spec.rows) || spec.rows < 1 || spec.rows > 1000) out.push({ level: 'error', message: 'sheet.rows must be 1-1000' })
  if (!spec || !Number.isInteger(spec.cols) || spec.cols < 1 || spec.cols > 26) out.push({ level: 'error', message: 'sheet.cols must be 1-26' })
  if (out.length) return out
  for (const [key, cell] of Object.entries(spec.cells ?? {})) {
    const p = rangeProblem(spec, key, 'cell')
    if (p || key.includes(':')) out.push({ level: 'error', message: p ?? `cell key ${key} must be a single cell` })
    if (cell.role && !ROLES.includes(cell.role)) out.push({ level: 'error', message: `${key}: unknown role "${cell.role}"` })
    if (cell.f !== undefined && !cell.f.trim().startsWith('=')) out.push({ level: 'error', message: `${key}: formula must start with =` })
    if (cell.f !== undefined && cell.v !== undefined) out.push({ level: 'warn', message: `${key}: has both a value and a formula (the formula wins)` })
  }
  return out
}

function taskFieldIssues(ex: Exercise, t: Task): Issue[] {
  const out: Issue[] = []
  const err = (message: string) => out.push({ level: 'error', task: t.id, message })
  if (!KINDS.includes(t.kind)) err(`unknown kind "${String(t.kind)}"`)
  if (!t.prompt?.trim()) err('prompt is empty')
  const needsCells = t.kind === 'formula' || t.kind === 'value' || t.kind === 'criteria' || t.kind === 'tool'
  if (needsCells || t.cells) {
    const p = rangeProblem(ex.sheet, t.cells ?? '', 'cells')
    if (p && (needsCells || t.cells)) err(p)
  }
  switch (t.kind) {
    case 'formula':
      if (!t.solution && !t.solutions) err('formula task needs solution or solutions')
      if (Object.keys(t.solutions ?? {}).some((k) => !safeCells(t.cells).includes(k.toUpperCase()))) out.push({ level: 'warn', task: t.id, message: 'solutions has cells outside the task cells' })
      if (t.solution && !t.solution.trim().startsWith('=') && t.check?.formulaRequired !== false) err('solution must be a formula (=...) unless formulaRequired is false')
      break
    case 'value':
      if (t.answer === undefined) err('value task needs answer')
      break
    case 'tool':
      if (!t.tool || !TOOLS.includes(t.tool)) err('tool task needs a known tool')
      if (!t.toolSetup) err('tool task needs toolSetup')
      if (t.answer === undefined && !t.random) err('tool task needs answer (cell values) or random')
      if (t.answer !== undefined && (t.answer === null || typeof t.answer !== 'object')) err('tool answer must be a record of cell values')
      break
    case 'criteria':
      if (Object.keys(t.solutions ?? {}).some((k) => !safeCells(t.cells).includes(k.toUpperCase()))) err('criteria solutions must be cells of the criteria range (cells)')
      if (!t.criteria) err('criteria task needs criteria { list, expectedRows }')
      else {
        const p = rangeProblem(ex.sheet, t.criteria.list, 'criteria.list')
        if (p) err(p)
        if (!Array.isArray(t.criteria.expectedRows) || t.criteria.expectedRows.some((r) => !Number.isInteger(r) || r < 1)) err('criteria.expectedRows must be 1-based row numbers')
      }
      if (!t.solutions) err('criteria task needs solutions (the reference criteria entries)')
      break
    case 'vba':
      if (!t.vba?.entry || !t.vba.solution || typeof t.vba.starter !== 'string') err('vba task needs vba.entry, vba.starter and vba.solution')
      if (t.vba && !t.vba.expected && !t.vba.calls) err('vba task needs vba.expected or vba.calls')
      break
    case 'explain':
      if (typeof t.answer !== 'string' || !t.answer.trim()) err('explain task needs the model answer text in answer')
      break
  }
  return out
}

function refIssues(ex: Exercise, t: Task): Issue[] {
  const out: Issue[] = []
  const refs: [string, string][] = []
  const rec = t.answer !== null && typeof t.answer === 'object' ? t.answer : undefined
  Object.keys(rec ?? {}).forEach((k) => refs.push([k, 'answer cell']))
  Object.keys(t.solutions ?? {}).forEach((k) => refs.push([k, 'solutions cell']))
  Object.keys(t.vba?.expected ?? {}).forEach((k) => refs.push([k, 'vba.expected cell']))
  if (t.vba?.activeCell) refs.push([t.vba.activeCell, 'vba.activeCell'])
  if (t.vba?.selection) refs.push([t.vba.selection, 'vba.selection'])
  for (const a of t.check?.absolute ?? []) refs.push([a, 'check.absolute'])
  for (const a of t.check?.refs ?? []) refs.push([a, 'check.refs'])
  const setup = (t.toolSetup ?? {}) as Record<string, unknown>
  for (const key of ['setCell', 'changingCell', 'objective', 'changing', 'range', 'rowInput', 'colInput', 'source', 'target', 'list', 'criteria', 'copyTo']) {
    if (typeof setup[key] === 'string' && setup[key]) refs.push([setup[key] as string, `toolSetup.${key}`])
  }
  for (const c of (setup.constraints as { lhs?: unknown; rhs?: unknown }[] | undefined) ?? []) {
    if (typeof c.lhs === 'string') refs.push([c.lhs, 'constraint lhs'])
    if (typeof c.rhs === 'string' && /[A-Za-z]/.test(c.rhs) && !c.rhs.trim().startsWith('=')) refs.push([c.rhs, 'constraint rhs'])
  }
  for (const [ref, what] of refs) {
    const p = rangeProblem(ex.sheet, ref, what)
    if (p) out.push({ level: 'error', task: t.id, message: p })
  }
  return out
}

function randomIssues(t: Task): Issue[] {
  const r = t.random
  if (!r) return []
  const out: Issue[] = []
  const err = (message: string) => out.push({ level: 'error', task: t.id, message })
  if (!Number.isInteger(r.trials) || r.trials < 1) err('random.trials must be a positive whole number')
  else if (r.trials > 100) err('random.trials must be <= 100 (keep checks fast)')
  if (!['mean', 'sd', 'p'].includes(r.stat)) err(`random.stat "${String(r.stat)}" must be mean, sd or p`)
  if (!Number.isFinite(r.target)) err('random.target must be a number')
  if (!(r.tol > 0)) err('random.tol must be > 0')
  if (t.kind !== 'formula' && !(t.kind === 'tool' && t.tool === 'datatable')) err('random checks apply to formula tasks and data-table tasks')
  return out
}

const referenceFormulas = (t: Task): string[] => {
  const out: string[] = []
  if (typeof t.solution === 'string') out.push(t.solution)
  for (const v of Object.values(t.solutions ?? {})) out.push(v)
  return out.filter((f) => f.trim().startsWith('='))
}

function syllabusIssues(ex: Exercise): Issue[] {
  const out: Issue[] = []
  const late = new Map<string, string>()
  const formulas: [string | undefined, string][] = [
    ...Object.values(ex.sheet.cells ?? {}).filter((c) => c.f).map((c): [undefined, string] => [undefined, c.f as string]),
    ...ex.tasks.flatMap((t) => referenceFormulas(t).map((f): [string, string] => [t.id, f])),
  ]
  for (const [taskId, f] of formulas) {
    for (const fn of notYetTaught(f, ex.week)) if (!late.has(fn)) late.set(fn, taskId ?? 'sheet')
  }
  if (!ex.extension) {
    for (const [fn, where] of late) {
      const taught = FIRST_TAUGHT[fn]
      out.push({
        level: 'error',
        task: where === 'sheet' ? undefined : where,
        message: taught ? `uses ${fn}, first taught in ${taught} (after ${ex.week}): use taught functions or mark the exercise extension: true` : `uses ${fn}, which the course never teaches: mark the exercise extension: true`,
      })
    }
  } else if (!late.size) {
    out.push({ level: 'warn', message: `extension: true but every function is taught by ${ex.week}` })
  }
  return out
}

function checkedCellIssues(ex: Exercise): Issue[] {
  const out: Issue[] = []
  const spec = ex.sheet.cells ?? {}
  const roleOf = (ref: string) => {
    const key = Object.keys(spec).find((k) => k.toUpperCase() === ref)
    return key ? spec[key].role : undefined
  }
  for (const t of ex.tasks) {
    const cells = t.kind === 'formula' || t.kind === 'value' ? safeCells(t.cells) : t.kind === 'criteria' ? Object.keys(t.solutions ?? {}).map((k) => k.toUpperCase()) : []
    const plain = cells.filter((c) => roleOf(c) !== 'answer')
    if (plain.length) out.push({ level: 'error', task: t.id, message: `answer cells must have role 'answer' in the sheet: ${plain.slice(0, 6).join(', ')}${plain.length > 6 ? ' ...' : ''}` })
    if (t.kind === 'formula' && !t.random && referenceFormulas(t).some((f) => functionsUsed(f).some((fn) => fn === 'RAND' || fn === 'RANDBETWEEN'))) {
      out.push({ level: 'error', task: t.id, message: 'the reference draws random numbers: give the task a random check (trials, stat, target, tol)' })
    }
    for (const f of referenceFormulas(t)) {
      const dated = functionsUsed(f).filter((fn) => VOLATILE_DATE.includes(fn))
      if (dated.length && (t.kind === 'formula' || t.kind === 'value')) out.push({ level: 'error', task: t.id, message: `checked cells must not use ${dated.join('/')}: the expected values would change every day` })
    }
    for (const fn of [...(t.check?.mustUse ?? []), ...(t.check?.mustNotUse ?? [])]) {
      if (!/^[A-Za-z][A-Za-z0-9.]*$/.test(fn)) out.push({ level: 'error', task: t.id, message: `check.mustUse/mustNotUse "${fn}" is not a function name` })
    }
    for (const fn of t.check?.mustUse ?? []) {
      if (t.kind === 'formula' && referenceFormulas(t).length && !referenceFormulas(t).every((f) => usesFunction(f, fn))) {
        out.push({ level: 'error', task: t.id, message: `the reference does not use ${fn.toUpperCase()}, but check.mustUse requires it` })
      }
    }
    if (t.check?.allowFormula !== undefined && t.kind !== 'value') out.push({ level: 'warn', task: t.id, message: 'check.allowFormula only applies to value tasks' })
  }
  const dynamic = Object.values(spec).some((c) => c.f && functionsUsed(c.f).some((fn) => VOLATILE_DATE.includes(fn)))
  if (dynamic && ex.tasks.some((t) => t.kind === 'value' || t.kind === 'tool')) out.push({ level: 'warn', message: 'the sheet uses TODAY/NOW and a task has fixed expected values: they will go stale' })
  return out
}

const safeCells = (range: string | undefined): string[] => {
  try {
    return cellsOf(range)
  } catch {
    return []
  }
}

function testCaseIssues(ex: Exercise): Issue[] {
  const out: Issue[] = []
  const names = new Set<string>()
  const answerCells = new Set(ex.tasks.flatMap((t) => (t.kind === 'formula' || t.kind === 'value' ? safeCells(t.cells) : [])))
  for (const tc of ex.testCases ?? []) {
    if (!tc.name?.trim()) out.push({ level: 'error', message: 'a test case has no name' })
    if (names.has(tc.name)) out.push({ level: 'error', message: `duplicate test case name '${tc.name}'` })
    names.add(tc.name)
    if (!Object.keys(tc.inputs ?? {}).length) out.push({ level: 'error', message: `test case '${tc.name}' changes nothing` })
    for (const key of Object.keys(tc.inputs ?? {})) {
      const p = rangeProblem(ex.sheet, key, `test case '${tc.name}' input`)
      if (p) {
        out.push({ level: 'error', message: p })
        continue
      }
      const ref = normRef(key)
      if (answerCells.has(ref)) out.push({ level: 'error', message: `test case '${tc.name}' changes ${ref}, an answer cell` })
      const role = Object.entries(ex.sheet.cells ?? {}).find(([k]) => k.toUpperCase() === ref)?.[1].role
      if (role !== 'input') out.push({ level: 'warn', message: `test case '${tc.name}' changes ${ref}, which is not an input cell (role 'input')` })
    }
  }
  return out
}

export function schemaIssues(ex: Exercise, ids?: Map<string, number>): Issue[] {
  const out: Issue[] = []
  const err = (message: string) => out.push({ level: 'error', message })
  if (!ex.id || !/^[a-z0-9][a-z0-9-]*$/.test(ex.id)) err(`id "${ex.id}" must be lower-case words joined by hyphens`)
  if (ids && (ids.get(ex.id) ?? 0) > 1) err(`id ${ex.id} is used by ${ids.get(ex.id)} exercises`)
  if (!WEEKS.includes(ex.week)) err(`week "${String(ex.week)}" is not one of ${WEEKS.join(', ')}`)
  if (![1, 2, 3].includes(ex.level)) err('level must be 1, 2 or 3')
  if (!(ex.minutes > 0)) err('minutes must be > 0')
  for (const key of ['topic', 'title', 'scenario'] as const) if (!ex[key]?.trim()) err(`${key} is empty`)
  if (!Array.isArray(ex.skills)) err('skills must be a list')
  for (const tech of ex.techniques ?? []) if (!(EXAM_TECHNIQUES as readonly string[]).includes(tech)) err(`technique "${tech}" is not in EXAM_TECHNIQUES`)
  out.push(...sheetIssues(ex))
  if (out.some((i) => i.level === 'error' && /sheet\.(rows|cols)/.test(i.message))) return out
  if (!ex.tasks?.length) err('the exercise has no tasks')
  const taskIds = new Set<string>()
  for (const t of ex.tasks ?? []) {
    if (!t.id) err('a task has no id')
    if (taskIds.has(t.id)) err(`duplicate task id ${t.id}`)
    taskIds.add(t.id)
    out.push(...taskFieldIssues(ex, t), ...refIssues(ex, t), ...randomIssues(t))
  }
  out.push(...testCaseIssues(ex), ...syllabusIssues(ex), ...checkedCellIssues(ex))
  return out
}

// ---------- behaviour ----------

const stubbed = (texts: string[]): boolean => texts.some((m) => STUB.test(m))

function withEntries(state: LearnerState, entries: Record<string, string>): LearnerState {
  return { ...state, edits: { ...state.edits, ...entries } }
}

// do the task's cells take different values (base or any test case, compared strictly) under two states?
export function valuesDiffer(ex: Exercise, task: Task, a: LearnerState, b: LearnerState): boolean {
  const cells = safeCells(task.cells)
  const sa = createLabSheet(ex.sheet, { state: a })
  const sb = createLabSheet(ex.sheet, { state: b })
  try {
    const cases = [{}, ...(ex.testCases ?? []).map((tc) => Object.fromEntries(Object.entries(tc.inputs).map(([k, v]) => [normRef(k), canonicalRaw(v)])))]
    for (const inputs of cases) {
      const saved = Object.fromEntries(Object.keys(inputs).map((c) => [c, sa.raw(c)]))
      writeCells(sa, inputs, { force: true })
      writeCells(sb, inputs, { force: true })
      if (cells.some((c) => !sameValue(sb.read(c), sa.read(c), { tol: 1e-9, relTol: 1e-9, caseSensitive: true }))) return true
      writeCells(sa, saved, { force: true })
      writeCells(sb, saved, { force: true })
    }
    return false
  } finally {
    sa.destroy()
    sb.destroy()
  }
}

// a wrong entry is entered like a learner would: for a task with one `solution` over several cells it is typed in the first
// cell and filled across `cells` like the solution (a $ left out shows in the filled cells); a task with per-cell `solutions`
// (or a value task) gets it in its first cell only, the other cells keep the reference; criteria: the first `solutions` cell
export function wrongState(task: Task, ref: LearnerState, entry: string): LearnerState {
  if (task.kind === 'vba') return { ...ref, vba: { ...ref.vba, [task.id]: entry } }
  if (task.kind === 'formula' && typeof task.solution === 'string' && !task.solutions) return withEntries(ref, fillEntry(entry, task.cells))
  const first = task.kind === 'criteria' ? Object.keys(task.solutions ?? {})[0] : safeCells(task.cells)[0]
  return first ? withEntries(ref, { [normRef(first)]: entry }) : ref
}

function wrongIssues(ex: Exercise, task: Task, ref: LearnerState): Issue[] {
  const out: Issue[] = []
  if (task.kind === 'tool' && task.tool === 'datatable' && task.wrong?.length) {
    out.push({ level: 'warn', task: task.id, message: 'wrong entries are not used for data-table tasks (the table body cannot be typed into)' })
  }
  const usable = task.kind === 'tool' && task.tool === 'datatable' ? [] : task.wrong ?? []
  const variants: [string, LearnerState][] = usable.map((w) => [`wrong entry ${JSON.stringify(w.length > 60 ? `${w.slice(0, 57)}...` : w)}`, wrongState(task, ref, w)])
  if (task.kind === 'formula' && !task.random && typeof task.solution === 'string' && !task.solutions && task.solution.includes('$')) {
    const stripped = withEntries(ref, fillEntry(stripDollars(task.solution), task.cells))
    if (valuesDiffer(ex, task, ref, stripped)) variants.push(['the solution with its $ signs removed', stripped])
  }
  if (task.kind === 'formula' && (task.check?.formulaRequired ?? true)) {
    const first = safeCells(task.cells)[0]
    const sheet = createLabSheet(ex.sheet, { state: ref })
    const read: CellRead = sheet.read(first)
    sheet.destroy()
    const v: CellValue = read.kind === 'error' ? null : read.value
    if (v !== null) variants.push([`the value ${canonicalRaw(v)} typed into ${first}`, withEntries(ref, { [first]: canonicalRaw(v) })])
  }
  for (const [name, state] of variants) {
    const r = checkTask(ex, task, state)
    if (r.ok) out.push({ level: 'error', task: task.id, message: `${name} passes the check` })
    else if (stubbed(r.messages)) out.push({ level: 'skip', task: task.id, message: `${name}: ${r.messages[0]}` })
  }
  return out
}

function toleranceIssues(ex: Exercise, task: Task, ref: LearnerState): Issue[] {
  const rc = task.random
  if (!rc) return []
  const s = sampleRandomTask(ex, task, ref)
  if (typeof s === 'string') return []
  const nums = s.values.map((v) => (typeof v === 'boolean' ? Number(v) : v)).filter((v): v is number => typeof v === 'number')
  const mean = nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length)
  const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, nums.length - 1))
  const se = rc.stat === 'p' ? Math.sqrt(Math.max(rc.target * (1 - rc.target), 1e-12) / s.n) : rc.stat === 'sd' ? sd / Math.sqrt(2 * Math.max(1, s.n - 1)) : sd / Math.sqrt(s.n)
  if (rc.tol + 1e-12 < 4 * se) {
    return [{ level: 'warn', task: task.id, message: `random.tol ${rc.tol} is under 4 standard errors (${(4 * se).toPrecision(3)}): correct answers may fail; raise tol or trials` }]
  }
  return []
}

function overlapIssues(ex: Exercise): Issue[] {
  const owners = new Map<string, string[]>()
  for (const [id, cells] of Object.entries(referenceFootprints(ex))) for (const c of cells) owners.set(c, [...(owners.get(c) ?? []), id])
  const shared = [...owners].filter(([, ids]) => ids.length > 1)
  if (!shared.length) return []
  const pairs = [...new Set(shared.map(([, ids]) => ids.join(' and ')))]
  return [{ level: 'warn', message: `tasks ${pairs.join('; ')} write the same cells (${shared.slice(0, 4).map(([c]) => c).join(', ')}): isolation between them is weaker` }]
}

// test cases that move no checked value prove nothing; formula tasks without any test case cannot catch hard-coding
function testCaseUse(ex: Exercise, ref: LearnerState): Issue[] {
  const formulaCells = ex.tasks.filter((t) => t.kind === 'formula' && !t.random).flatMap((t) => safeCells(t.cells))
  if (!formulaCells.length) return []
  if (!ex.testCases?.length) {
    const inputs = Object.values(ex.sheet.cells ?? {}).some((c) => c.role === 'input')
    return inputs ? [{ level: 'warn', message: 'no test cases: hard-coded numbers in the formula tasks cannot be caught' }] : []
  }
  const out: Issue[] = []
  const sheet = createLabSheet(ex.sheet, { state: ref })
  try {
    const base = formulaCells.map((c) => sheet.read(c))
    for (const tc of ex.testCases) {
      const inputs = Object.fromEntries(Object.entries(tc.inputs).map(([k, v]) => [normRef(k), canonicalRaw(v)]))
      const saved = Object.fromEntries(Object.keys(inputs).map((c) => [c, sheet.raw(c)]))
      writeCells(sheet, inputs, { force: true })
      const moved = formulaCells.some((c, i) => !sameValue(sheet.read(c), base[i], { tol: 0, relTol: 0, caseSensitive: true }))
      writeCells(sheet, saved, { force: true })
      if (!moved) out.push({ level: 'warn', message: `test case '${tc.name}' changes no checked value: pick inputs the formulas depend on` })
    }
  } finally {
    sheet.destroy()
  }
  return out
}

function unusedAnswerCells(ex: Exercise): Issue[] {
  const covered = new Set<string>()
  for (const t of ex.tasks) {
    safeCells(t.cells).forEach((c) => covered.add(c))
    for (const k of [...Object.keys(t.solutions ?? {}), ...Object.keys(t.vba?.expected ?? {})]) covered.add(k.toUpperCase())
    if (t.answer !== null && typeof t.answer === 'object') Object.keys(t.answer).forEach((k) => covered.add(k.toUpperCase()))
  }
  for (const fp of Object.values(referenceFootprints(ex))) fp.forEach((c) => covered.add(c))
  const loose = Object.entries(ex.sheet.cells ?? {}).filter(([k, c]) => c.role === 'answer' && !covered.has(k.toUpperCase())).map(([k]) => k)
  return loose.length ? [{ level: 'warn', message: `answer-styled cells no task checks: ${loose.slice(0, 6).join(', ')}${loose.length > 6 ? ' ...' : ''}` }] : []
}

export function behaviourIssues(ex: Exercise): { issues: Issue[]; ms: number } {
  const issues: Issue[] = []
  let ref: LearnerState
  const t0 = performance.now()  // the first check in the browser also builds the reference
  try {
    ref = referenceState(ex)
  } catch (e) {
    return { issues: [{ level: 'error', message: `the reference state could not be built: ${e instanceof Error ? e.message : String(e)}` }], ms: 0 }
  }
  const problems = referenceProblems(ex)
  const res = checkExercise(ex, ref)
  const ms = performance.now() - t0
  for (const task of ex.tasks) {
    const r = res.tasks.find((x) => x.taskId === task.id)
    const problem = problems[task.id]
    if (problem && STUB.test(problem)) {
      issues.push({ level: 'skip', task: task.id, message: problem })
      continue
    }
    if (problem) issues.push({ level: 'error', task: task.id, message: `the reference could not be applied: ${problem}` })
    if (!r) {
      issues.push({ level: 'error', task: task.id, message: 'no result for this task' })
      continue
    }
    if (!r.ok) {
      if (stubbed(r.messages)) issues.push({ level: 'skip', task: task.id, message: r.messages[0] })
      else issues.push({ level: 'error', task: task.id, message: `the reference fails its own check: ${r.messages.join(' | ') || 'no message'}` })
      continue
    }
    issues.push(...wrongIssues(ex, task, ref), ...toleranceIssues(ex, task, ref))
  }
  issues.push(...overlapIssues(ex), ...testCaseUse(ex, ref), ...unusedAnswerCells(ex))
  if (ms > WARN_MS) issues.push({ level: 'warn', message: `checking took ${Math.round(ms)} ms (over ${WARN_MS} ms)` })
  return { issues, ms }
}

const statusOf = (issues: Issue[]): Status =>
  issues.some((i) => i.level === 'error') ? 'FAIL' : issues.some((i) => i.level === 'skip') ? 'SKIP' : issues.some((i) => i.level === 'warn') ? 'WARN' : 'PASS'

export function validateExercise(ex: Exercise, opts: { ids?: Map<string, number>; source?: string; pending?: string } = {}): Report {
  const issues = schemaIssues(ex, opts.ids)
  let ms = 0
  if (!issues.some((i) => i.level === 'error')) {
    const b = behaviourIssues(ex)
    issues.push(...b.issues)
    ms = b.ms
  }
  if (opts.pending && issues.some((i) => i.level === 'skip')) issues.push({ level: 'skip', message: `pending: ${opts.pending}` })
  return { id: ex.id, week: ex.week, source: opts.source ?? '', tasks: ex.tasks?.length ?? 0, ms, status: statusOf(issues), issues }
}

export function mockIssues(mock: MockExam, ids?: Map<string, number>): Issue[] {
  const out: Issue[] = []
  const err = (message: string) => out.push({ level: 'error', message })
  if (!mock.id || !/^[a-z0-9][a-z0-9-]*$/.test(mock.id)) err(`mock id "${mock.id}" must be lower-case words joined by hyphens`)
  if (ids && (ids.get(mock.id) ?? 0) > 1) err(`mock id ${mock.id} is used more than once`)
  if (!(mock.minutes > 0)) err('mock minutes must be > 0')
  for (const key of ['title', 'basedOn', 'intro'] as const) if (!mock[key]?.trim()) err(`mock ${key} is empty`)
  if (!mock.questions?.length) err('mock has no questions')
  const qids = new Set<string>()
  for (const q of mock.questions ?? []) {
    if (qids.has(q.id)) err(`duplicate question id ${q.id}`)
    qids.add(q.id)
    if (!(q.marks > 0)) err(`question ${q.id}: marks must be > 0`)
    if (q.exercise.week !== 'EXAM') out.push({ level: 'warn', message: `question ${q.id}: its exercise week is ${q.exercise.week}, expected EXAM` })
    const perTask = q.exercise.tasks.filter((t) => t.marks !== undefined)
    if (perTask.length && perTask.length !== q.exercise.tasks.length) out.push({ level: 'warn', message: `question ${q.id}: only some tasks have marks (the others score 0)` })
    const sum = perTask.reduce((s, t) => s + (t.marks ?? 0), 0)
    if (perTask.length && Math.abs(sum - q.marks) > 1e-9) err(`question ${q.id}: task marks add up to ${sum}, the question is worth ${q.marks}`)
  }
  return out
}

// ---------- loading ----------

interface Loaded { source: string; exercises: Exercise[]; mocks: MockExam[]; pending: Record<string, string> }

const isExercise = (x: unknown): x is Exercise => Boolean(x && typeof x === 'object' && 'tasks' in x && 'sheet' in x)
const isMock = (x: unknown): x is MockExam => Boolean(x && typeof x === 'object' && 'questions' in x && Array.isArray((x as MockExam).questions))

export async function loadModule(file: string): Promise<Loaded> {
  const mod = (await import(pathToFileURL(path.resolve(file)).href)) as Record<string, unknown>
  const out: Loaded = { source: path.relative(process.cwd(), path.resolve(file)), exercises: [], mocks: [], pending: {} }
  for (const [name, value] of Object.entries(mod)) {
    const items = Array.isArray(value) ? value : [value]
    for (const item of items) {
      if (isMock(item)) out.mocks.push(item)
      else if (isExercise(item)) out.exercises.push(item)
    }
    if (name === 'pendingFixtures' && value && typeof value === 'object') out.pending = value as Record<string, string>
  }
  return out
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function countIds(list: { id: string }[]): Map<string, number> {
  const ids = new Map<string, number>()
  for (const x of list) ids.set(x.id, (ids.get(x.id) ?? 0) + 1)
  return ids
}

export async function run(args: string[]): Promise<{ reports: Report[]; failed: boolean }> {
  const files = args.filter((a) => !a.startsWith('--'))
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const site = await loadModule(path.join(ROOT, 'src/data/lab/index.ts'))
  const siteMocks = site.mocks.length ? site.mocks : (await loadModule(path.join(ROOT, 'src/data/lab/mocks.ts'))).mocks
  const everything = !files.length && !flags.has('--mocks') && !flags.has('--fixtures')
  const targets: Loaded[] = []
  if (everything) targets.push({ ...site, mocks: siteMocks })
  for (const f of files) targets.push(await loadModule(f))
  if (flags.has('--mocks') && !everything) targets.push({ source: 'src/data/lab/mocks.ts', exercises: [], mocks: siteMocks, pending: {} })
  if (flags.has('--fixtures')) targets.push(await loadModule(path.join(ROOT, 'tests/fixtures.ts')))

  // ids are unique site-wide: count each exercise object once, wherever it was loaded from
  const all = [{ ...site, mocks: siteMocks }, ...targets]
  const ids = countIds([...new Set(all.flatMap((t) => [...t.exercises, ...t.mocks.flatMap((m) => m.questions.map((q) => q.exercise))]))])
  const mockIds = countIds([...new Set(all.flatMap((t) => t.mocks))])

  const reports: Report[] = []
  const seen = new Set<Exercise>()
  const seenMocks = new Set<MockExam>()
  for (const target of targets) {
    for (const ex of target.exercises) {
      if (seen.has(ex)) continue
      seen.add(ex)
      reports.push(validateExercise(ex, { ids, source: target.source, pending: target.pending[ex.id] }))
    }
    for (const mock of target.mocks) {
      if (seenMocks.has(mock)) continue
      seenMocks.add(mock)
      const issues = mockIssues(mock, mockIds)
      reports.push({ id: `mock ${mock.id}`, week: 'EXAM', source: target.source, tasks: mock.questions?.length ?? 0, ms: 0, status: statusOf(issues), issues })
      for (const q of mock.questions ?? []) {
        if (seen.has(q.exercise)) continue
        seen.add(q.exercise)
        reports.push(validateExercise(q.exercise, { ids, source: `${target.source} ${mock.id}/${q.id}` }))
      }
    }
  }
  return { reports, failed: reports.some((r) => r.status === 'FAIL') }
}

// ---------- output ----------

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))

export function formatTable(reports: Report[]): string {
  const width = Math.max(10, ...reports.map((r) => r.id.length))
  const lines = [`${pad('STATUS', 7)}${pad('EXERCISE', width + 2)}${pad('WEEK', 6)}${pad('TASKS', 7)}${pad('MS', 7)}NOTE`]
  for (const r of reports) {
    const first = r.issues.find((i) => i.level === 'error') ?? r.issues.find((i) => i.level === 'skip') ?? r.issues.find((i) => i.level === 'warn')
    const note = first ? `${first.task ? `${first.task}: ` : ''}${first.message}` : ''
    lines.push(`${pad(r.status, 7)}${pad(r.id, width + 2)}${pad(r.week, 6)}${pad(String(r.tasks), 7)}${pad(String(Math.round(r.ms)), 7)}${note.length > 100 ? `${note.slice(0, 97)}...` : note}`)
  }
  const details = reports.filter((r) => r.issues.length > 1 || r.status === 'FAIL')
  for (const r of details) {
    lines.push('', `${r.id} (${r.source})`)
    for (const i of r.issues) lines.push(`  ${pad(i.level.toUpperCase(), 6)}${i.task ? `${i.task}: ` : ''}${i.message}`)
  }
  const count = (s: Status) => reports.filter((r) => r.status === s).length
  lines.push('', `${reports.length} checked: ${count('PASS')} pass, ${count('WARN')} warn, ${count('SKIP')} skip, ${count('FAIL')} fail`)
  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const t0 = performance.now()
  const { reports, failed } = await run(args)
  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify({ reports, failed, seconds: Number(seconds) }, null, 1)}\n`)
  else process.stdout.write(`${formatTable(reports)} (${seconds} s)\n`)
  process.exitCode = failed ? 1 : 0
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (invoked === import.meta.url) {
  main().catch((e: unknown) => {
    process.stderr.write(`validate-lab: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
    process.exitCode = 1
  })
}
