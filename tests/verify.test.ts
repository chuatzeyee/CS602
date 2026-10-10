// verify.test.ts - regression tests for problems found while verifying the final engine/data round.
// 1. Solver Max Time: branch and cut stops on its own millisecond clock (Date.now() + a rounded timeout), up to ~1.5 ms
//    before the performance.now() deadline; the old check then took about half the time-limited runs for proven optima
//    ("optimality conditions are satisfied") or, with no whole-number answer yet, for infeasible models.
// 2. The dialog's Integer Optimality default (1%) stops mock-a-q1's shelter order at $284.50 / $258.90, so a learner who
//    followed the prompt ("the lab has no Integer Optimality %") failed the check. Every Solver task must pass when run
//    with the dialog defaults, unless its prompt asks for Integer Optimality 0.
// Run: npx tsx --test tests/verify.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercise as mockA1 } from '../src/data/lab/mocks/mock-a-q1.ts'
import { exercises, mocks } from '../src/data/lab/index.ts'
import { checkTask, referenceState } from '../src/lab/checker.ts'
import { rangeCells, splitRanges } from '../src/lab/refs.ts'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { runSolver, SOLVER_DEFAULTS, SOLVER_MESSAGES } from '../src/lab/whatif.ts'
import type { Exercise, LabSheet, SolverSetup, Task } from '../src/lab/types.ts'

const eSolver = mockA1.tasks.find(t => t.id === 'e-solver')
assert.ok(eSolver?.toolSetup && eSolver.solutions, 'mock-a-q1 has its Solver task')
const orderSetup = eSolver.toolSetup as SolverSetup
// without the wish-list caps branch and cut finds 259.987 at once but cannot prove it within seconds
const uncapped: SolverSetup = { ...orderSetup, constraints: orderSetup.constraints.filter(c => c.rhs !== 'O2:O13') }
function shelterSheet(): LabSheet {
  const s = createLabSheet(mockA1.sheet)
  assert.deepEqual(writeCells(s, { ...(eSolver?.solutions as Record<string, string>) }), { ok: true })
  return s
}

test('Solver Max Time: every time-limited branch and cut run reports the stop, never a proven optimum', () => {
  const seen: string[] = []
  for (let i = 0; i < 16; i++) {
    const s = shelterSheet()
    const r = runSolver(s, uncapped, { maxTime: 0.05, integerOptimality: 0 })
    seen.push(`${r.status}: ${r.message}`)
    if (r.status === 'stopped') assert.ok((r.objective ?? 0) > 250, `best order so far kept: ${r.objective}`)
    s.destroy()
  }
  // 'stopped' with the best order so far, or (no whole-number order yet, e.g. on a busy machine) 'failed' with the
  // same message first; before the fix most runs said 'optimal' and a run without an order said 'infeasible'
  const wrong = seen.filter(m => !/^(stopped|failed): /.test(m) || !m.replace(/^\w+: /, '').startsWith(SOLVER_MESSAGES.timeLimit))
  assert.deepEqual(wrong, [], `${wrong.length} of ${seen.length} runs did not report the time limit`)
  assert.ok(seen.some(m => m.startsWith('stopped: ')), 'at least one run kept its best order so far')
})

/** The learner's run: every other task done, the task's own formulas in, the variable cells as the spec has them. */
function learnerRun(ex: Exercise, task: Task, options: { maxTime: number; integerOptimality: number }) {
  const setup = task.toolSetup as SolverSetup
  const s = createLabSheet(ex.sheet, { state: referenceState(ex) })
  const reset: Record<string, string> = {}
  for (const part of splitRanges(setup.changing)) {
    for (const ref of rangeCells(part)) reset[ref] = ex.sheet.cells[ref]?.v == null ? '' : String(ex.sheet.cells[ref]?.v)
  }
  assert.deepEqual(writeCells(s, reset), { ok: true })
  const run = runSolver(s, setup, options)
  const result = checkTask(ex, task, s.state())
  s.destroy()
  return { run, result }
}

test('every Solver task passes when run with the dialog defaults, or its prompt asks for Integer Optimality 0', () => {
  const all = [...exercises, ...mocks.flatMap(m => m.questions.map(q => q.exercise))]
  const solverTasks = all.flatMap(ex => ex.tasks.filter(t => t.kind === 'tool' && t.tool === 'solver').map(task => ({ ex, task })))
  assert.ok(solverTasks.length >= 10, `found ${solverTasks.length} Solver tasks`)
  const failures: string[] = []
  for (const { ex, task } of solverTasks) {
    const asksZero = /Integer Optimality \(%\) to 0\b/.test(task.prompt)
    const { run, result } = learnerRun(ex, task, asksZero ? { ...SOLVER_DEFAULTS, integerOptimality: 0 } : SOLVER_DEFAULTS)
    if (!result.ok) failures.push(`${ex.id}/${task.id} (${run.status}): ${result.messages.join(' | ')}`)
  }
  assert.deepEqual(failures, [])
})

test('mock-a-q1 (e): the prompt asks for Integer Optimality 0, which the 1% default would miss', () => {
  assert.match(eSolver.prompt, /set Options > Integer Optimality \(%\) to 0/)
  assert.doesNotMatch(eSolver.prompt, /no Integer Optimality/)
  const atDefault = learnerRun(mockA1, eSolver, SOLVER_DEFAULTS)
  assert.equal(atDefault.run.message, SOLVER_MESSAGES.integerTolerance)
  assert.equal(atDefault.result.ok, false, 'the 1% stop is short of the best order, as in Excel')
  const asked = learnerRun(mockA1, eSolver, { ...SOLVER_DEFAULTS, integerOptimality: 0 })
  assert.equal(asked.run.message, SOLVER_MESSAGES.optimal)
  assert.equal(asked.result.ok, true, asked.result.messages.join(' | '))
})
