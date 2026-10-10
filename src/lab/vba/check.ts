// Checking a vba task (CONTRACTS.md, checking semantics 8): run the learner's module on a fresh sheet (the spec plus
// the reference entries of every other task), then compare the cells in task.vba.expected or the results of
// task.vba.calls, and look for the keywords in task.vba.mustUse. Messages say what is wrong, never the solution.
import { referenceFootprints, referenceState } from '../checker'
import { canon, list, mismatch, readOf, sameValue } from '../checkerUtil'
import { createLabSheet } from '../sheet'
import type { CellMark, CellValue, Exercise, LabSheet, LearnerState, Task, TaskResult, VbaTaskSpec } from '../types'
import { callFunctionOn, listProcedures, runVba, syntaxError } from './index'
import { learnerCode, procAt, usesKeyword } from './sourceText'

const MAX_CELL_MESSAGES = 3

interface Outcome { bad: string[]; good: string[]; messages: string[]; total: number; correct: number }

// one time budget (MAX_MS in index.ts) for every macro run and Function call of a Check: six calls of a Function
// that never returns stop after 5 seconds in all, not 5 seconds each
let session: { started: number } | null = null

/** run `fn` (a whole Check) with one shared VBA time budget */
export function withVbaBudget<T>(fn: () => T): T {
  if (session) return fn()
  session = { started: performance.now() }
  try {
    return fn()
  } finally {
    session = null
  }
}

const budgetStop = (message: string): boolean => /^Macro stopped after/i.test(message)

// the sheet the macro runs on: spec + the reference entries (and formats) of every other task
function freshSheet(ex: Exercise, task: Task): LabSheet {
  const ref = referenceState(ex)
  const own = new Set(referenceFootprints(ex)[task.id] ?? [])
  const others = (rec: Record<string, string> | undefined): Record<string, string> =>
    Object.fromEntries(Object.entries(rec ?? {}).filter(([k]) => !own.has(canon(k) ?? k)))
  const state: LearnerState = {
    edits: others(ref.edits),
    fmts: others(ref.fmts),
    ...(ref.dataTables ? { dataTables: ref.dataTables } : {}),
    ...(ref.hiddenRows ? { hiddenRows: ref.hiddenRows } : {}),
    ...(ref.iterative !== undefined ? { iterative: ref.iterative } : {}),
  }
  return createLabSheet(ex.sheet, { state })
}

const show = (v: CellValue): string => (v === null ? 'nothing' : typeof v === 'string' ? `"${v}"` : String(v))

function where(source: string, line: number): string {
  if (line <= 0) return ''
  const proc = procAt(source, line)
  return proc ? ` on line ${line} (in ${proc})` : ` on line ${line}`
}

// "Running TestTwoDays stopped with Run-time error '9': Subscript out of range on line 14 (in PostDeliveries)."
export function errorText(source: string, entry: string, err: { line: number; message: string }): string {
  if (/^Compile error/i.test(err.message)) return `${err.message}${where(source, err.line)}. Fix it in the editor, then run ${entry} again.`
  if (/^Macro stopped after/i.test(err.message)) return `${err.message}. Check that every loop moves towards its end.`
  return `Running ${entry} stopped with ${err.message}${where(source, err.line)}.`
}

function compareCells(sheet: LabSheet, expected: Record<string, CellValue>, task: Task): Outcome {
  const bad: string[] = []
  const good: string[] = []
  const notes: string[] = []
  for (const [key, want] of Object.entries(expected)) {
    const cell = canon(key) ?? key.toUpperCase()
    let got
    try {
      got = sheet.read(cell)
    } catch {
      continue
    }
    const wantRead = readOf(want)
    // a formula showing "" counts as empty; a typed space does not (Range("B1").Value = " " is not ClearContents)
    const empty = got.kind === 'empty' || (got.kind === 'string' && got.value === '')
    const same = want === null ? empty : sameValue(got, wantRead, { tol: task.check?.tol ?? 1e-6, relTol: task.check?.relTol, caseSensitive: false })
    if (same) {
      good.push(cell)
      continue
    }
    bad.push(cell)
    const shown = sheet.display(cell)
    notes.push(want === null ? `${cell} should be empty after the run, but shows ${shown || show(got.value)}` : mismatch(cell, got, shown, wantRead))
  }
  const messages = notes.slice(0, MAX_CELL_MESSAGES)
  if (bad.length > MAX_CELL_MESSAGES) messages.push(`${bad.length} cells are not right after the run: ${list(bad, 6)}`)
  return { bad, good, messages, total: bad.length + good.length, correct: good.length }
}

function compareCalls(sheet: LabSheet, source: string, spec: VbaTaskSpec, task: Task, started: number): Outcome {
  const messages: string[] = []
  let correct = 0
  for (const c of spec.calls ?? []) {
    const call = `${spec.entry}(${c.args.map(a => show(a)).join(', ')})`
    const r = callFunctionOn(sheet, source, spec.entry, c.args, { started })
    if (!r.ok && /^Compile error/i.test(r.error)) {
      messages.push(errorText(source, spec.entry, { line: r.line ?? 0, message: r.error }))
      break
    }
    if (!r.ok && budgetStop(r.error)) {
      // the shared budget is spent: the remaining calls would stop at once
      messages.push(`${call} did not finish: ${errorText(source, spec.entry, { line: r.line ?? 0, message: r.error })}`)
      break
    }
    if (!r.ok) {
      messages.push(r.line !== undefined && r.line > 0
        ? `${call} stopped with ${r.error}${where(source, r.line)}`
        : `${call}: ${r.error}`)
      continue
    }
    if (sameValue(readOf(r.value), readOf(c.result), { tol: task.check?.tol ?? 1e-6, relTol: task.check?.relTol, caseSensitive: false })) correct++
    else messages.push(`${call} returns ${show(r.value)}, which is not right`)
  }
  const total = spec.calls?.length ?? 0
  return { bad: [], good: [], messages: messages.slice(0, MAX_CELL_MESSAGES + 1), total, correct }
}

function missingKeywords(source: string, spec: VbaTaskSpec): string[] {
  const code = learnerCode(source, spec.starter)
  return (spec.mustUse ?? []).filter(k => !usesKeyword(code, k))
}

function finish(task: Task, out: Outcome, messages: string[], marks: Record<string, CellMark>): TaskResult {
  const unique = [...new Set(messages)].slice(0, 5)
  const ok = unique.length === 0 && out.correct === out.total
  const total = Math.max(1, out.total)
  return { taskId: task.id, ok, correct: ok ? total : out.correct, total, messages: unique, cells: marks }
}

export function checkVbaTask(ex: Exercise, task: Task, state: LearnerState): TaskResult {
  const spec = task.vba
  if (!spec) return { taskId: task.id, ok: false, correct: 0, total: 1, messages: ['This task has no macro to check.'], cells: {} }
  const saved = state?.vba?.[task.id]
  const source = typeof saved === 'string' ? saved : spec.starter
  const intro: string[] = []
  if (!source.trim()) {
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: ['The VBA module is empty: Reset brings back the starter code.'], cells: {} }
  }
  const procs = listProcedures(source)
  const entry = procs.find(p => p.name.toLowerCase() === spec.entry.toLowerCase())
  if (!entry) {
    const inStarter = listProcedures(spec.starter).some(p => p.name.toLowerCase() === spec.entry.toLowerCase())
    const msg = inStarter
      ? `Check runs ${spec.entry}, but your module has no procedure called ${spec.entry}: keep it as the starter has it (Reset restores the starter).`
      : `Check runs ${spec.entry}, but your module has no procedure called ${spec.entry}: write it with exactly that name.`
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: [msg], cells: {} }
  }
  const syntax = syntaxError(source)
  if (syntax) {
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: [errorText(source, spec.entry, syntax)], cells: {} }
  }
  const unchanged = source.trim() === spec.starter.trim()
  let sheet: LabSheet
  try {
    sheet = freshSheet(ex, task)
  } catch (e) {
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: [`The exercise sheet could not be built: ${e instanceof Error ? e.message : String(e)}`], cells: {} }
  }
  try {
    const started = session?.started ?? performance.now()
    const marks: Record<string, CellMark> = {}
    const outcomes: Outcome[] = []
    if (spec.expected) {
      const run = runVba(sheet, source, spec.entry, {
        activeCell: spec.activeCell, selection: spec.selection, inputs: spec.inputs ?? [], started,
      })
      if (!run.ok && run.error) intro.push(errorText(source, spec.entry, run.error))
      const cells = compareCells(sheet, spec.expected, task)
      cells.good.forEach(c => { marks[c] = 'ok' })
      cells.bad.forEach(c => { marks[c] = 'bad' })
      const ran = run.ok || run.steps > 0
      outcomes.push(run.ok ? cells : { ...cells, messages: cells.bad.length && ran ? [`${cells.bad.length} of ${cells.total} checked cells are not right yet: ${list(cells.bad, 6)}`] : [] })
    }
    if (spec.calls?.length) outcomes.push(compareCalls(sheet, source, spec, task, started))
    const missing = missingKeywords(source, spec)
    const keywordNotes = missing.map(k => `The task asks you to use ${k.trim().replace(/\s*\($/, '')}: your code does not use it yet.`)
    const out: Outcome = outcomes.reduce<Outcome>(
      (a, o) => ({ bad: [...a.bad, ...o.bad], good: [...a.good, ...o.good], messages: [...a.messages, ...o.messages], total: a.total + o.total, correct: a.correct + o.correct }),
      { bad: [], good: [], messages: [], total: 0, correct: 0 },
    )
    const problems = [...intro, ...out.messages, ...keywordNotes]
    if (unchanged && (problems.length || out.correct < out.total)) problems.unshift('Your module is still the starter code: complete the macro, run it, then Check.')
    return finish(task, out, problems, marks)
  } catch (e) {
    return { taskId: task.id, ok: false, correct: 0, total: 1, messages: [`The macro could not be checked: ${e instanceof Error ? e.message : String(e)}`], cells: {} }
  } finally {
    sheet.destroy()
  }
}
