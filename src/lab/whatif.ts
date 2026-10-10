// whatif.ts - Goal Seek and Solver over a LabSheet with Excel's dialog messages. Results are written into the
// changing cells as values, as one undo step. Data tables live on the sheet (addDataTable / recalc).
import type { HyperFormula, RawCellContent, SimpleCellAddress } from 'hyperformula'
import { goalSeek } from './engine/whatIf'
import { assessPoint, extractLinear, LINEAR_TOLERANCE, multiStart, solve } from './engine/solverBridge'
import type { SolverConstraint, SolverResult, SolverSpec } from './engine/solverBridge'
import { parseLooseNumber } from './engine/excelMath'
import { toEngineFormula } from './engine/formulaText'
import { canonicalRaw } from './engine/input'
import { writeCells } from './sheet'
import { parseRef, rangeCells, splitRanges, toRef } from './refs'
import type { GoalSeekSetup, LabSheet, SolverSetup } from './types'

export interface GoalSeekOutcome { found: boolean; value: number; message: string }
// stopped: Max Time ran out; the best solution found so far is written (Keep or Restore in the dialog)
export type SolverStatus = 'optimal' | 'stopped' | 'infeasible' | 'unbounded' | 'failed'
export interface SolverOutcome { status: SolverStatus; objective?: number; message: string }

export const SOLVER_MESSAGES = {
  optimal: 'Solver found a solution. All constraints and optimality conditions are satisfied.',
  localOptimum: 'Solver found a solution. All constraints and optimality conditions are satisfied. With GRG Nonlinear this is at least a local optimum.',
  integerTolerance: 'Solver found an integer solution within tolerance. All constraints are satisfied.',
  timeLimit: 'Stop chosen when the maximum time limit was reached.',
  infeasible: 'Solver could not find a feasible solution.',
  unbounded: 'The Objective Cell values do not converge.',
  linearity: 'The linearity conditions required by this LP Solver are not satisfied.',
} as const

// Excel's Solver Options: Max Time in seconds, Integer Optimality in percent. The dialog starts at SOLVER_DEFAULTS
// (Excel's 1%); a run without options proves whole-number optima exactly (0%), as reference runs need, within 5 s.
// Solve runs while the page waits, so Max Time is capped.
export interface SolverOptions { maxTime?: number; integerOptimality?: number }
export const SOLVER_DEFAULTS = { maxTime: 5, integerOptimality: 1 } as const
export const MAX_SOLVER_SECONDS = 30

/** What is wrong with the options, for the dialog's fields and runSolver; undefined when they are usable. */
export function solverOptionsProblem(options: SolverOptions): { maxTime?: string; integerOptimality?: string } | undefined {
  const { maxTime, integerOptimality } = options
  const out: { maxTime?: string; integerOptimality?: string } = {}
  if (maxTime !== undefined && !(Number.isFinite(maxTime) && maxTime > 0 && maxTime <= MAX_SOLVER_SECONDS)) {
    out.maxTime = `Max Time must be more than 0 and at most ${MAX_SOLVER_SECONDS} seconds.`
  }
  if (integerOptimality !== undefined && !(Number.isFinite(integerOptimality) && integerOptimality >= 0 && integerOptimality <= 100)) {
    out.integerOptimality = 'Integer Optimality must be a percentage from 0 to 100.'
  }
  return out.maxTime || out.integerOptimality ? out : undefined
}

const MAX_VARIABLES = 200
const MAX_BOX_EXPANSIONS = 5
const POLISH_ROUNDS = 3

interface Cell { ref: string; at: SimpleCellAddress }

function cellIn(sheet: LabSheet, text: string): Cell | string {
  let p
  try {
    p = parseRef(String(text ?? ''))
  } catch {
    return `"${text}" is not a cell reference.`
  }
  if (p.row >= sheet.rows || p.col >= sheet.cols) return `${toRef(p.row, p.col)} is outside the sheet.`
  return { ref: toRef(p.row, p.col), at: { sheet: sheet.sheetId, row: p.row, col: p.col } }
}

function cellsIn(sheet: LabSheet, text: string): Cell[] | string {
  const out: Cell[] = []
  for (const part of splitRanges(String(text ?? ''))) {
    let refs: string[]
    try {
      refs = rangeCells(part)
    } catch {
      return `"${part}" is not a cell or range reference.`
    }
    for (const ref of refs) {
      const c = cellIn(sheet, ref)
      if (typeof c === 'string') return c
      if (!out.some((o) => o.ref === c.ref)) out.push(c)
    }
  }
  return out
}

function restore(hf: HyperFormula, cells: Cell[], saved: RawCellContent[]): void {
  hf.batch(() => cells.forEach((c, i) => hf.setCellContents(c.at, [[saved[i]]])))
}

function numberAt(hf: HyperFormula, at: SimpleCellAddress): number {
  const v = hf.getCellValue(at)
  return typeof v === 'number' ? v : v === null ? 0 : NaN
}

/** Excel Goal Seek: Set cell / To value / By changing cell. Keeps the solution like pressing OK. */
export function runGoalSeek(sheet: LabSheet, setup: GoalSeekSetup): GoalSeekOutcome {
  const bad = (message: string): GoalSeekOutcome => ({ found: false, value: NaN, message })
  const target = cellIn(sheet, setup?.setCell)
  if (typeof target === 'string') return bad(`Set cell: ${target}`)
  const changing = cellIn(sheet, setup?.changingCell)
  if (typeof changing === 'string') return bad(`By changing cell: ${changing}`)
  const toValue = typeof setup.toValue === 'number' ? setup.toValue : parseLooseNumber(String(setup.toValue ?? ''))
  if (toValue === undefined || !Number.isFinite(toValue)) return bad('To value must be a number.')
  const hf = sheet.hf
  if (!hf.doesCellHaveFormula(target.at)) return bad('Cell must contain a formula.')
  if (hf.doesCellHaveFormula(changing.at)) return bad('Cell must contain a value.')
  if (!sheet.editable(changing.ref)) return bad(`${changing.ref} is locked, so Goal Seek cannot change it.`)
  const start = hf.getCellValue(changing.at)
  if (start !== null && typeof start !== 'number') return bad(`${changing.ref} must hold a number for Goal Seek to change.`)
  const saved = hf.getCellSerialized(changing.at) as RawCellContent
  const original = typeof start === 'number' ? start : 0
  let result
  try {
    result = goalSeek(hf, { setCell: target.ref, toValue, byChanging: changing.ref, sheet: sheet.name, restore: true })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Goal Seek could not run.')
  } finally {
    restore(hf, [changing], [saved])
  }
  if (!result.found) return { found: false, value: original, message: `Goal Seeking with Cell ${target.ref} may not have found a solution.` }
  const value = tidy(result.input, false)
  const written = writeCells(sheet, { [changing.ref]: canonicalRaw(value) })
  if (!written.ok) return bad(written.message)
  return { found: true, value, message: `Goal Seeking with Cell ${target.ref} found a solution.` }
}

/** Strip float noise (29.999999999 -> 30); integer variables are rounded. */
function tidy(x: number, integer: boolean): number {
  if (!Number.isFinite(x)) return x
  const r = Math.round(x)
  const v = integer || Math.abs(x - r) <= 1e-9 * Math.max(1, Math.abs(x)) ? r : x
  return v === 0 ? 0 : v
}

interface Model { spec: SolverSpec; vars: Cell[]; objective: Cell; integer: Set<string>; explicit: Record<string, { lo?: number; hi?: number }> }

function buildModel(sheet: LabSheet, setup: SolverSetup): Model | string {
  const hf = sheet.hf
  const objective = cellIn(sheet, setup?.objective)
  if (typeof objective === 'string') return `Set Objective: ${objective}`
  if (!hf.doesCellHaveFormula(objective.at)) return 'The Objective Cell must contain a formula.'
  const vars = cellsIn(sheet, setup.changing)
  if (typeof vars === 'string') return `By Changing Variable Cells: ${vars}`
  if (!vars.length) return 'Enter the By Changing Variable Cells.'
  if (vars.length > MAX_VARIABLES) return `Too many variable cells: the limit is ${MAX_VARIABLES}.`
  for (const v of vars) {
    if (hf.doesCellHaveFormula(v.at)) return `Variable cells must hold values, not formulas: ${v.ref} has a formula.`
    if (!sheet.editable(v.ref)) return `${v.ref} is locked, so Solver cannot change it.`
  }
  const varSet = new Set(vars.map((v) => v.ref))
  const constraints: SolverConstraint[] = []
  const integer: string[] = []
  const binary: string[] = []
  const explicit: Record<string, { lo?: number; hi?: number }> = {}
  for (const c of setup.constraints ?? []) {
    const lhs = cellsIn(sheet, c.lhs)
    if (typeof lhs === 'string' || !lhs.length) return `Constraint "${c.lhs}": ${typeof lhs === 'string' ? lhs : 'enter a cell reference'}`
    if (c.relation === 'int' || c.relation === 'bin') {
      const outside = lhs.find((l) => !varSet.has(l.ref))
      if (outside) return `Integer and binary constraints can only apply to variable cells: ${outside.ref} is not one.`
      ;(c.relation === 'int' ? integer : binary).push(...lhs.map((l) => l.ref))
      continue
    }
    if (c.relation !== '<=' && c.relation !== '>=' && c.relation !== '=') return `Constraint "${c.lhs}": unknown relation "${String(c.relation)}".`
    const rhs = rhsOf(sheet, c.rhs, lhs.length)
    if (typeof rhs === 'string') return `Constraint ${c.lhs} ${c.relation} ${String(c.rhs ?? '')}: ${rhs}`
    lhs.forEach((l, i) => {
      const r = rhs.length === 1 ? rhs[0] : rhs[i]
      constraints.push({ lhs: l.ref, relation: c.relation as '<=' | '>=' | '=', rhs: r })
      if (varSet.has(l.ref) && typeof r === 'number') {
        const b = { ...(explicit[l.ref] ?? {}) }
        if (c.relation !== '>=') b.hi = Math.min(b.hi ?? Infinity, r)
        if (c.relation !== '<=') b.lo = Math.max(b.lo ?? -Infinity, r)
        explicit[l.ref] = b
      }
    })
  }
  const sense = setup.sense
  if (sense !== 'max' && sense !== 'min' && sense !== 'value') return 'Choose Max, Min or Value Of.'
  if (sense === 'value') {
    if (typeof setup.valueOf !== 'number' || !Number.isFinite(setup.valueOf)) return 'Enter the target number for Value Of.'
    constraints.push({ lhs: objective.ref, relation: '=', rhs: setup.valueOf })
  }
  const spec: SolverSpec = {
    objective: objective.ref,
    sense: sense === 'max' ? 'max' : 'min',
    changing: vars.map((v) => v.ref),
    constraints,
    integer,
    binary,
    nonNegative: setup.nonNegative ?? true,
    sheet: sheet.name,
  }
  return { spec, vars, objective, integer: new Set([...integer, ...binary]), explicit }
}

function rhsOf(sheet: LabSheet, rhs: number | string | undefined, size: number): (number | string)[] | string {
  if (typeof rhs === 'number') return Number.isFinite(rhs) ? [rhs] : 'the right side must be a number or a cell.'
  const text = String(rhs ?? '').trim()
  if (text === '') return 'enter the right side (a number, a cell or a range).'
  const n = parseLooseNumber(text)
  if (n !== undefined && Number.isFinite(n)) return [n]
  if (text.startsWith('=')) {
    const v = sheet.hf.calculateFormula(toEngineFormula(text), sheet.sheetId) // typed text: @, a resized SUMIF range
    return typeof v === 'number' && Number.isFinite(v) ? [v] : 'the right-side formula must give a number.'
  }
  const cells = cellsIn(sheet, text)
  if (typeof cells === 'string') return cells
  if (cells.length !== 1 && cells.length !== size) return 'both sides must be the same size, or the right side a single cell or number.'
  return cells.map((c) => c.ref)
}

/** Linearity probe like the bridge's (finite differences + random points); the cells are restored by the caller. */
function isLinear(hf: HyperFormula, model: Model): boolean {
  const { spec, vars, objective } = model
  const sheetId = objective.at.sheet
  const lhs = spec.constraints.map((c) => addrIn(sheetId, c.lhs))
  const rhs = spec.constraints.map((c) => (typeof c.rhs === 'number' ? c.rhs : addrIn(sheetId, c.rhs)))
  const evaluate = (x: number[]): number[] => {
    hf.batch(() => vars.forEach((v, j) => hf.setCellContents(v.at, [[x[j]]])))
    return [numberAt(hf, objective.at), ...lhs.map((l, i) => numberAt(hf, l) - (typeof rhs[i] === 'number' ? (rhs[i] as number) : numberAt(hf, rhs[i] as SimpleCellAddress)))]
  }
  const x0 = vars.map((v) => { const x = numberAt(hf, v.at); return Number.isFinite(x) ? x : 0 })
  const box = x0.map((x) => ({ lo: Math.min(0, x), hi: Math.max(10, 3 * Math.abs(x) + 10) }))
  return extractLinear(evaluate, x0, box).maxErr <= LINEAR_TOLERANCE
}

function addrIn(sheet: number, ref: string): SimpleCellAddress {
  const p = parseRef(ref)
  return { sheet, row: p.row, col: p.col }
}

/** Non-linear search inside a box; when a variable ends on an artificial edge of the box, widen it and search again.
 *  A model that only looked linear near the start (a bracket lookup further out) is non-linear too: the run never
 *  claims more than a local optimum, and a quick multi-start search replaces the answer when it finds a better one.
 *  At spec.deadline every stage stops; the last answer that met every constraint is kept (stopped). */
function solveNonlinear(hf: HyperFormula, model: Model): SolverResult {
  const { spec, vars } = model
  const nonNeg = spec.nonNegative ?? true
  const bounds: Record<string, { lo?: number; hi?: number }> = {}
  for (const [ref, b] of Object.entries(model.explicit)) {
    bounds[ref] = { ...(Number.isFinite(b.lo ?? NaN) ? { lo: b.lo } : {}), ...(Number.isFinite(b.hi ?? NaN) ? { hi: b.hi } : {}) }
  }
  const late = () => spec.deadline !== undefined && performance.now() > spec.deadline
  const startsOf = () => vars.map((v) => { const x = numberAt(hf, v.at); return Number.isFinite(x) ? (nonNeg ? Math.max(0, x) : x) : 0 })
  const origin = startsOf()
  let starts = origin
  let result = solve(hf, { ...spec, bounds })
  let stopped = result.stopped === true
  let feasible = result.status === 'optimal' ? result : undefined
  const next = (r: SolverResult) => {
    result = r
    stopped ||= r.stopped === true || late()
    if (r.status === 'optimal') feasible = r
  }
  let nonlinear = !result.linear
  let stepped = result.linearAtStart === true && !result.linear
  for (let round = 0; round < MAX_BOX_EXPANSIONS && !result.linear && !stopped; round++) {
    let widened = false
    vars.forEach((v, j) => {
      const x = result.values[v.ref]
      const explicit = bounds[v.ref] ?? {}
      const start = starts[j]
      const lo = explicit.lo ?? (nonNeg ? 0 : start - 10 - Math.abs(start))
      const hi = Math.max(lo + 10, start + 10 + 2 * Math.abs(start))
      const atHi = explicit.hi === undefined && Math.abs(x - hi) <= 1e-6 * (1 + Math.abs(x))
      const atLo = explicit.lo === undefined && !nonNeg && Math.abs(x - lo) <= 1e-6 * (1 + Math.abs(x))
      if (atHi || atLo) widened = true
    })
    if (!widened) break
    starts = startsOf() // the search restarts from the edge, so the default box grows about threefold
    next(solve(hf, { ...spec, bounds }))
    nonlinear ||= !result.linear
    stepped ||= result.linearAtStart === true && !result.linear
  }
  // nearly feasible: search again in a small box around the point, which sharpens the simplex steps
  for (let k = 0; k < POLISH_ROUNDS && !result.linear && result.status !== 'optimal' && !stopped; k++) {
    const tight: Record<string, { lo?: number; hi?: number }> = {}
    for (const v of vars) {
      const x = result.values[v.ref]
      const d = 1e-3 * (1 + Math.abs(x)) / 10 ** k
      const own = bounds[v.ref] ?? {}
      tight[v.ref] = { lo: Math.max(own.lo ?? (nonNeg ? 0 : -Infinity), x - d), hi: Math.min(own.hi ?? Infinity, x + d) }
    }
    next(solve(hf, { ...spec, bounds: tight }))
  }
  if (stopped && result.status !== 'optimal' && feasible) result = feasible
  const ended = stopped ? { stopped } : {}
  if (!nonlinear) return { ...result, ...ended }
  if (stepped && !stopped) {
    const found = result.status === 'optimal' ? vars.map((v) => result.values[v.ref]) : undefined
    const alt = multiStart(hf, { ...spec, bounds }, found ? [origin, found] : [origin])
    if (alt && (result.status !== 'optimal' || improves(alt.objective, objectiveAt(hf, spec, result), spec.sense))) return alt
  }
  return { ...result, ...ended, linear: false }
}

/** The objective at a result's values (its own number can predate the integer rounding). */
function objectiveAt(hf: HyperFormula, spec: SolverSpec, result: SolverResult): number {
  return assessPoint(hf, spec, result.values).objective
}

function improves(candidate: number, current: number, sense: SolverSpec['sense']): boolean {
  if (!Number.isFinite(candidate)) return false
  if (!Number.isFinite(current)) return true
  const margin = 1e-5 * (1 + Math.abs(current)) // a real gain, not constraint slack
  return sense === 'max' ? candidate > current + margin : candidate < current - margin
}

/** Excel Solver: Max / Min / Value Of, variable cells, constraints (cell, range, int, bin), non-negative, engine, and
 *  the Options Max Time (s) and Integer Optimality (%). At Max Time the best solution found so far is written (status
 *  stopped, Excel's "Stop chosen when the maximum time limit was reached."); none yet: nothing changes (failed). */
export function runSolver(sheet: LabSheet, setup: SolverSetup, options: SolverOptions = {}): SolverOutcome {
  const failed = (message: string): SolverOutcome => ({ status: 'failed', message })
  const bad = solverOptionsProblem(options)
  if (bad) return failed((bad.maxTime ?? bad.integerOptimality) as string)
  const deadline = performance.now() + 1000 * (options.maxTime ?? SOLVER_DEFAULTS.maxTime)
  const built = buildModel(sheet, setup)
  if (typeof built === 'string') return failed(built)
  const model: Model = { ...built, spec: { ...built.spec, deadline, integerTolerance: (options.integerOptimality ?? 0) / 100 } }
  const hf = sheet.hf
  const saved = model.vars.map((v) => hf.getCellSerialized(v.at) as RawCellContent)
  let result: SolverResult
  try {
    if (setup.engine === 'simplex') {
      const linear = isLinear(hf, model)
      restore(hf, model.vars, saved)
      if (!linear) return failed(SOLVER_MESSAGES.linearity)
      // like Excel, the answer is checked against the sheet as well: a step that only starts further out fails here
      result = solve(hf, { ...model.spec, linearOnly: true })
      if (!result.linear) {
        restore(hf, model.vars, saved)
        return failed(SOLVER_MESSAGES.linearity)
      }
    } else {
      result = solveNonlinear(hf, model)
    }
  } catch (e) {
    restore(hf, model.vars, saved)
    return failed(`Solver could not run this model: ${e instanceof Error ? e.message : 'unknown problem'}.`)
  }
  restore(hf, model.vars, saved)
  if (result.status === 'unbounded') return { status: 'unbounded', message: SOLVER_MESSAGES.unbounded }
  if (result.status !== 'optimal' && result.stopped) {
    return failed(`${SOLVER_MESSAGES.timeLimit} No solution meeting every constraint was found in that time: allow more time under Options, or limit the variable cells.`)
  }
  if (result.status !== 'optimal') return { status: 'infeasible', message: SOLVER_MESSAGES.infeasible }
  const entries = Object.fromEntries(model.vars.map((v) => [v.ref, canonicalRaw(tidy(result.values[v.ref], model.integer.has(v.ref)))]))
  const written = writeCells(sheet, entries)
  if (!written.ok) return failed(written.message)
  const value = numberAt(hf, model.objective.at)
  const objective = Number.isFinite(value) ? value : undefined
  if (result.stopped) return { status: 'stopped', objective, message: SOLVER_MESSAGES.timeLimit }
  const message = !result.linear ? SOLVER_MESSAGES.localOptimum : result.withinTolerance ? SOLVER_MESSAGES.integerTolerance : SOLVER_MESSAGES.optimal
  return { status: 'optimal', objective, message }
}
