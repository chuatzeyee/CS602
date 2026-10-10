// final-engine.test.ts - regression tests for the final engine/solver round (fix-engine-solver):
// 1. Solver Max Time / Integer Optimality (the uncapped mock-a-q1 order froze the tab), 2. GRG with variable bounds typed
// as numbers (mock-b-q1 said infeasible), 3. DATEDIF units in any case, 4. MEDIAN/NPV/AVEDEV/... skip "" and other text in
// referenced cells, 5. typed formula text through toEngineFormula (computed criteria, Solver '=formula' right sides),
// 6. the PivotTable status names where the table starts, 7. huge numbers in number formats and "... and 18 more give".
// Run: npx tsx --test tests/final-engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercise as mockA1 } from '../src/data/lab/mocks/mock-a-q1.ts'
import { exercise as mockB1 } from '../src/data/lab/mocks/mock-b-q1.ts'
import { referenceState } from '../src/lab/checker.ts'
import { judgeSample } from '../src/lab/checkerUtil.ts'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { applyTool } from '../src/lab/tools/index.ts'
import { runAdvancedFilter } from '../src/lab/tools/advFilter.ts'
import { applyPivot } from '../src/lab/tools/pivot.ts'
import { runSolver, SOLVER_DEFAULTS, SOLVER_MESSAGES } from '../src/lab/whatif.ts'
import { formatNumber, formatText } from '../src/lab/engine/format.ts'
import { nelderMead } from '../src/lab/engine/nelderMead.ts'
import { multiStart } from '../src/lab/engine/solverBridge.ts'
import { buildWorkbook } from '../src/lab/engine/workbook.ts'
import { pivotCreatedText } from '../src/lab/components/PivotDialog.tsx'
import type { CellValue, LabSheet, SolverSetup } from '../src/lab/types.ts'

const num = (s: LabSheet, ref: string): number => {
  const r = s.read(ref)
  assert.equal(r.kind, 'number', `${ref} should be a number, is ${r.kind} ${String(r.value)}`)
  return r.value as number
}
const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`)
/** a sheet built by typing each entry, as a learner would */
function typed(entries: Record<string, string>, rows = 30, cols = 12): LabSheet {
  const s = createLabSheet({ rows, cols, cells: {} })
  for (const [ref, raw] of Object.entries(entries)) assert.deepEqual(s.set(ref, raw), { ok: true }, `${ref} ${raw}`)
  return s
}
function calc(s: LabSheet, formula: string, at = 'K1'): CellValue {
  assert.deepEqual(s.set(at, formula), { ok: true }, formula)
  return s.read(at).value as CellValue
}
const timed = <T>(run: () => T): { value: T; ms: number } => {
  const t0 = performance.now()
  const value = run()
  return { value, ms: performance.now() - t0 }
}

// ---------- 1. Solver: Max Time and Integer Optimality ----------

const eSolver = mockA1.tasks.find(t => t.id === 'e-solver')
assert.ok(eSolver?.toolSetup && eSolver.solutions, 'mock-a-q1 has its Solver task')
const orderSetup = eSolver.toolSetup as SolverSetup
// the shelter order without its wish-list caps (M2:M13 <= O2:O13): the 12-item knapsack the reviewer saw freeze the tab
const uncapped: SolverSetup = { ...orderSetup, constraints: orderSetup.constraints.filter(c => c.rhs !== 'O2:O13') }
function shelterSheet(): LabSheet {
  const s = createLabSheet(mockA1.sheet)
  assert.deepEqual(writeCells(s, { ...(eSolver?.solutions as Record<string, string>) }), { ok: true })
  return s
}
/** the order keeps every rule of the uncapped model and uses whole units */
function assertOrderKeepsRules(s: LabSheet) {
  const q = s.values('M2:M13').map(r => r[0] as number)
  assert.ok(q.every(v => Number.isInteger(v) && v >= 0), `whole, non-negative quantities: ${q.join(',')}`)
  assert.equal(q[2], 8)
  assert.ok(q[8] >= 2 && q[1] <= 3 && q[10] <= 2, `limits kept: ${q.join(',')}`)
  assert.ok(num(s, 'M18') <= num(s, 'M22') + 1e-9, `within the budget: ${num(s, 'M18')}`)
}

test('Solver Max Time: the uncapped integer order stops at the limit with the best whole-unit order so far', () => {
  const s = shelterSheet()
  const v = s.version
  const { value: r, ms } = timed(() => runSolver(s, uncapped, { maxTime: 1, integerOptimality: 0 }))
  assert.ok(ms < 2500, `Solve returns soon after the 1 s limit (${Math.round(ms)} ms)`)
  assert.equal(r.status, 'stopped')
  assert.equal(r.message, SOLVER_MESSAGES.timeLimit)
  assert.equal(r.message, 'Stop chosen when the maximum time limit was reached.')
  assert.equal(s.version, v + 1, 'the best order so far is written as one undo step (Keep / Restore in the dialog)')
  assertOrderKeepsRules(s)
  assert.ok(num(s, 'M18') >= 259.9, `a good order was found before the limit: ${num(s, 'M18')}`)
  assert.equal(r.objective, num(s, 'M18'))
  s.undo()
  assert.deepEqual(s.values('M2:M13').map(x => x[0]), Array(12).fill(0), 'Restore Original Values = undo')
})

test('Solver Integer Optimality: the dialog defaults (5 s, 1%) solve the uncapped order at once, within tolerance', () => {
  assert.deepEqual(SOLVER_DEFAULTS, { maxTime: 5, integerOptimality: 1 })
  const s = shelterSheet()
  const { value: r, ms } = timed(() => runSolver(s, uncapped, SOLVER_DEFAULTS))
  assert.ok(ms < 5500, `the whole Solve stays within about 5 s (${Math.round(ms)} ms)`)
  assert.equal(r.status, 'optimal')
  assert.equal(r.message, SOLVER_MESSAGES.integerTolerance)
  assert.equal(r.message, 'Solver found an integer solution within tolerance. All constraints are satisfied.')
  assertOrderKeepsRules(s)
  assert.ok(num(s, 'M18') >= 0.99 * 260, `within 1% of the $260 bound: ${num(s, 'M18')}`)
})

test('Solver: the capped reference order is still proven exactly (reference runs default to 0%)', () => {
  const s = shelterSheet()
  const { value: r, ms } = timed(() => runSolver(s, orderSetup))
  assert.ok(ms < 2000, `${Math.round(ms)} ms`)
  assert.equal(r.message, SOLVER_MESSAGES.optimal)
  near(num(s, 'N14'), 285.7, 0.005, 'N14')
  near(num(s, 'M18'), 259.987, 0.001, 'M18')
  const viaTool = shelterSheet()
  assert.deepEqual(applyTool(viaTool, 'solver', orderSetup), { ok: true })
  near(num(viaTool, 'M18'), 259.987, 0.001, 'Reveal / validator run')
  // Integer Optimality 0% with time to spare: the same proof as before
  assert.equal(runSolver(shelterSheet(), orderSetup, { maxTime: 5, integerOptimality: 0 }).message, SOLVER_MESSAGES.optimal)
})

test('Solver options are checked: Max Time above 0 and at most 30 s, Integer Optimality 0-100%', () => {
  const s = shelterSheet()
  const v = s.version
  for (const bad of [{ maxTime: 0 }, { maxTime: -1 }, { maxTime: 31 }, { maxTime: Number.NaN }, { integerOptimality: -1 }, { integerOptimality: 101 }]) {
    const r = runSolver(s, orderSetup, bad)
    assert.equal(r.status, 'failed', JSON.stringify(bad))
    assert.match(r.message, /Max Time|Integer Optimality/)
  }
  assert.equal(s.version, v)
})

test('Max Time also bounds GRG Nonlinear: the mock-b rate card stops at a tiny limit', () => {
  const task = mockB1.tasks.find(t => t.id === 'solver')
  assert.ok(task?.toolSetup)
  const s = createLabSheet(mockB1.sheet, { state: referenceState(mockB1) })
  assert.deepEqual(writeCells(s, { E4: '10', E5: '8.5', E6: '6.5', E7: '6' }), { ok: true })
  const { value: r, ms } = timed(() => runSolver(s, task.toolSetup as SolverSetup, { maxTime: 0.02, integerOptimality: 1 }))
  assert.ok(ms < 1500, `${Math.round(ms)} ms`)
  assert.ok(r.message.startsWith(SOLVER_MESSAGES.timeLimit), r.message)
  assert.ok(r.status === 'stopped' || r.status === 'failed', r.status)
  if (r.status === 'failed') assert.deepEqual(s.values('E4:E7'), [[10], [8.5], [6.5], [6]], 'nothing found: the cells are restored')
})

test('nelderMead and multiStart stop at their deadline', () => {
  let calls = 0
  const slowDownhill = (x: number[]) => { calls++; const t = performance.now(); while (performance.now() - t < 0.2); return -x[0] } // never converges
  const { value: r, ms } = timed(() => nelderMead(slowDownhill, [0], { step: [1], maxIterations: 1e9, deadline: performance.now() + 30 }))
  assert.ok(ms < 500, `${Math.round(ms)} ms`)
  assert.ok(r.x[0] > 0 && calls > 2)
  const wb = buildWorkbook({ sheets: { S: { B1: 0, B2: '=B1*(1-IF(B1>=50,0.1,0))', B3: 60 } } })
  const spec = { objective: 'S!B1', sense: 'max' as const, changing: ['S!B1'], constraints: [{ lhs: 'S!B2', relation: '<=' as const, rhs: 'S!B3' }] }
  const late = timed(() => multiStart(wb.hf, { ...spec, deadline: performance.now() - 1 }, [[0], [60]]))
  assert.ok(late.ms < 200, `${Math.round(late.ms)} ms`)
  assert.equal(late.value?.stopped ?? true, true)
})

// ---------- 2. GRG with variable bounds typed as numbers ----------

const rateCard = mockB1.tasks.find(t => t.id === 'solver')
const cardSetup = rateCard?.toolSetup as SolverSetup
function cardSheet(): LabSheet {
  const s = createLabSheet(mockB1.sheet, { state: referenceState(mockB1) })
  assert.deepEqual(writeCells(s, { E4: '10', E5: '8.5', E6: '6.5', E7: '6' }), { ok: true })
  return s
}

test('GRG: the rate-card caps typed as numbers (E4 <= 10 ...) solve like the cell form E4:E7 <= D4:D7', () => {
  const numberCaps: SolverSetup['constraints'] = [
    { lhs: 'E4', relation: '<=', rhs: 10 }, { lhs: 'E5', relation: '<=', rhs: 8.5 }, { lhs: 'E6', relation: '<=', rhs: 6.5 }, { lhs: 'E7', relation: '<=', rhs: '6' },
    ...cardSetup.constraints.slice(1),
  ]
  for (const constraints of [numberCaps, [...numberCaps, { lhs: 'E4:E7', relation: '>=' as const, rhs: 0.5 }]]) {
    const s = cardSheet()
    const r = runSolver(s, { ...cardSetup, constraints })
    assert.equal(r.status, 'optimal', r.message)
    near(num(s, 'X23'), 21.8248, 0.01, 'X23')
    near(num(s, 'Y22'), 0.1, 1e-4, 'Y22 = Z22')
    const e = s.values('E4:E7').map(x => x[0] as number)
    ;[10, 7.2, 6, 5.3229].forEach((want, i) => near(e[i], want, 0.01, `E${4 + i}`))
  }
})

test('GRG: from the corner of typed caps the search steps into the box (the old search never left the corner)', () => {
  // the corner has the best penalised objective in the first round, so every later round restarted there; its outward
  // first simplex was clamped back onto the corner and the search reported no feasible solution
  const s = typed({ B1: '10', C1: '10', D1: '=B1+C1+0.001*B1*C1', E1: '=(B1+C1)/20' })
  const r = runSolver(s, {
    objective: 'D1', sense: 'max', changing: 'B1:C1',
    constraints: [{ lhs: 'B1', relation: '<=', rhs: 10 }, { lhs: 'C1', relation: '<=', rhs: 10 }, { lhs: 'E1', relation: '=', rhs: 0.9 }],
    engine: 'grg',
  })
  assert.equal(r.status, 'optimal', r.message)
  near(num(s, 'E1'), 0.9, 1e-6, 'E1 = 0.9')
  near(num(s, 'D1'), 18.081, 1e-3, 'D1 at B1 = C1 = 9')
})

test('GRG: a start on a typed upper bound, below a typed lower bound, or a variable fixed by "=" still moves', () => {
  const peak = (start: string) => typed({ B1: start, B2: '=10-(B1-1)^2' })
  const top = peak('3')
  assert.equal(runSolver(top, { objective: 'B2', sense: 'max', changing: 'B1', constraints: [{ lhs: 'B1', relation: '<=', rhs: 3 }], engine: 'grg' }).status, 'optimal')
  near(num(top, 'B1'), 1, 1e-3, 'from the upper bound')
  const below = typed({ B1: '0', B2: '=10-(B1-2)^2' })
  const r = runSolver(below, { objective: 'B2', sense: 'max', changing: 'B1', constraints: [{ lhs: 'B1', relation: '>=', rhs: 0.5 }, { lhs: 'B1', relation: '<=', rhs: 3 }], engine: 'grg' })
  assert.equal(r.status, 'optimal', r.message)
  near(num(below, 'B1'), 2, 1e-3, 'from below the lower bound')
  const fixed = typed({ B1: '0', C1: '0', D1: '=100-(C1-2*B1)^2+B1*C1/100' })
  const f = runSolver(fixed, { objective: 'D1', sense: 'max', changing: 'B1:C1', constraints: [{ lhs: 'B1', relation: '=', rhs: 5 }, { lhs: 'C1', relation: '<=', rhs: 20 }], engine: 'grg' })
  assert.equal(f.status, 'optimal', f.message)
  near(num(fixed, 'B1'), 5, 1e-9, 'B1 fixed')
  near(num(fixed, 'C1'), 10.025, 0.01, 'C1 = 2*B1 + B1/200')
})

// ---------- 3. DATEDIF units in any case ----------

test('DATEDIF reads its unit in any case, like Excel', () => {
  const s = typed({ A1: '2024-01-31', B1: '2026-03-15' })
  const upper: Record<string, CellValue> = {}
  for (const unit of ['D', 'M', 'Y', 'YM', 'MD', 'YD']) upper[unit] = calc(s, `=DATEDIF(A1,B1,"${unit}")`)
  assert.deepEqual({ D: upper.D, M: upper.M, Y: upper.Y, YM: upper.YM }, { D: 774, M: 25, Y: 2, YM: 1 })
  for (const [unit, value] of Object.entries(upper)) {
    assert.equal(typeof value, 'number', unit)
    for (const u of [unit.toLowerCase(), unit[0] + unit.slice(1).toLowerCase(), unit[0].toLowerCase() + unit.slice(1)]) {
      assert.equal(calc(s, `=DATEDIF(A1,B1,"${u}")`), value, u)
    }
  }
  assert.deepEqual(s.set('C1', 'ym'), { ok: true })
  assert.equal(calc(s, '=DATEDIF(A1,B1,C1)'), 1)
  assert.equal(calc(s, '=DATEDIF(A1,B1,"w")'), '#NUM!')
  assert.equal(calc(s, '=DATEDIF(B1,A1,"d")'), '#NUM!')
})

// ---------- 4. "" (and other text) in referenced cells ----------

test('MEDIAN, NPV, AVEDEV, DEVSQ, GEOMEAN, HARMEAN, SKEW skip a referenced "" (and text, TRUE, blanks) like Excel', () => {
  const s = typed({ A1: '=""', A2: '1', A3: '2', A4: '4', A6: 'TRUE', A7: "'abc", A8: '=1/0' }) // A5 empty
  for (const skip of ['A1', 'A5', 'A6', 'A7']) {
    assert.equal(calc(s, `=MEDIAN(${skip},A2,A3)`), 1.5, `MEDIAN with ${skip}`)
    assert.equal(calc(s, `=NPV(0.1,${skip},A2)`), calc(s, '=NPV(0.1,A2)'), `NPV with ${skip}`)
    assert.equal(calc(s, `=AVEDEV(${skip},A2,A3)`), 0.5, `AVEDEV with ${skip}`)
    assert.equal(calc(s, `=DEVSQ(${skip},A2,A3)`), 0.5, `DEVSQ with ${skip}`)
    assert.equal(calc(s, `=GEOMEAN(${skip},A2,A4)`), 2, `GEOMEAN with ${skip}`)
    assert.equal(calc(s, `=HARMEAN(${skip},A2,A4)`), 1.6, `HARMEAN with ${skip}`)
    assert.equal(calc(s, `=SKEW(${skip},A2,A3,A4)`), calc(s, '=SKEW(A2:A4)'), `SKEW with ${skip}`)
    assert.equal(calc(s, `=SKEW.P(${skip},A2,A3,A4)`), calc(s, '=SKEW.P(A2:A4)'), `SKEW.P with ${skip}`)
  }
  assert.ok(Math.abs((calc(s, '=NPV(0.1,A1,A2)') as number) - 1 / 1.1) < 1e-12)
  assert.equal(calc(s, '=MEDIAN(A1:A4)'), 2)              // ranges were already right
  assert.equal(calc(s, '=MEDIAN(A1)'), '#NUM!')           // no numbers at all
  // unchanged: typed arguments are converted, errors still win, "" in arithmetic stays #VALUE!
  assert.equal(calc(s, '=MEDIAN("",1)'), '#VALUE!')
  assert.equal(calc(s, '=MEDIAN("3",1)'), 2)
  assert.equal(calc(s, '=MEDIAN(TRUE,3)'), 2)
  assert.equal(calc(s, '=MEDIAN(A8,A2)'), '#DIV/0!')
  assert.equal(calc(s, '=MEDIAN(A1+0,A2)'), '#VALUE!')
  assert.equal(calc(s, '=""-1'), '#VALUE!')
  assert.equal(calc(s, '=A1-1'), '#VALUE!')
  assert.equal(calc(s, '=SUM(A1,A2)'), 1)
  assert.equal(calc(s, '=MEDIAN(A2,A3,A4)'), 2)
})

// ---------- 5. typed formula text goes through toEngineFormula ----------

function salesSheet(): LabSheet {
  const s = typed({
    A4: 'Rep', B4: 'Region', C4: 'Sales',
    A5: 'Ann', B5: 'North', C5: '120', A6: 'Bo', B6: 'South', C6: '80', A7: 'Cy', B7: 'North', C7: '60',
    A8: 'Di', B8: 'East', C8: '150', A9: 'Ed', B9: 'South', C9: '90',
  })
  return s
}

test('Advanced Filter computed criteria accept @ and a resized SUMIF sum range', () => {
  const s = salesSheet()
  assert.deepEqual(s.set('E2', '=@C5>100'), { ok: true })
  assert.equal(s.raw('E2'), '=@C5>100')
  assert.deepEqual(runAdvancedFilter(s, { list: 'A4:C9', criteria: 'E1:E2' }).rows, [5, 8])
  // regions whose total sales exceed 160: SUMIF with a one-cell sum range that Excel resizes to C5:C9
  assert.deepEqual(s.set('F2', '=SUMIF($B$5:$B$9,B5,$C$5)>160'), { ok: true })
  assert.equal(s.raw('F2'), '=SUMIF($B$5:$B$9,B5,$C$5)>160')
  assert.deepEqual(runAdvancedFilter(s, { list: 'A4:C9', criteria: 'F1:F2' }).rows, [5, 6, 7, 9])
})

test("Solver: an '=formula' right side is read like a typed formula (@, resized SUMIF)", () => {
  const s = typed({ A1: 'x', A2: 'y', A3: 'x', B1: '10', B2: '20', B3: '30', C1: '3', D1: '=2*C1' })
  for (const rhs of ['=@B1', '=SUMIF(A1:A3,"x",B1)/4']) {
    const r = runSolver(s, { objective: 'D1', sense: 'max', changing: 'C1', constraints: [{ lhs: 'C1', relation: '<=', rhs }], engine: 'simplex' })
    assert.equal(r.status, 'optimal', `${rhs}: ${r.message}`)
    assert.equal(num(s, 'C1'), 10, rhs)
  }
})

// ---------- 6. PivotTable: the status names where the table body starts ----------

test('PivotTable status: report filters above a top-row target push the table down, and the message says where', () => {
  assert.equal(pivotCreatedText('T1', 1), 'PivotTable created at T3 (report filter above it at T1)')
  assert.equal(pivotCreatedText('T2', 2), 'PivotTable created at T4 (report filters above it at T1:T2)')
  assert.equal(pivotCreatedText('T5', 1), 'PivotTable created at T5 (report filter above it at T3)')
  assert.equal(pivotCreatedText('$H$3', 0), 'PivotTable created at H3')
  // the text matches where applyPivot really writes the table
  const s = salesSheet()
  const res = applyPivot(s, { source: 'A4:C9', target: 'H1', config: { rows: ['Rep'], columns: [], values: [{ field: 'Sales', agg: 'sum' }], filters: [{ field: 'Region', include: [] }] } })
  assert.deepEqual(res, { ok: true })
  assert.equal(s.values('H1')[0][0], 'Region')
  assert.equal(s.values('H3')[0][0], 'Row Labels')
  assert.match(pivotCreatedText('H1', 1), /created at H3 \(report filter above it at H1\)/)
})

// ---------- 7. huge numbers in number formats; checker grammar ----------

test('a huge value keeps its number format instead of "$2.3,"', () => {
  const digits = '234545576675344' + '0'.repeat(99)
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  assert.equal(formatNumber(2.34545576675344e113, '$#,##0.00'), `$${grouped}.00`)
  assert.equal(formatNumber(-2.34545576675344e113, '$#,##0.00'), `-$${grouped}.00`)
  assert.equal(formatNumber(2.3e21, '#,##0.00;(#,##0.00)'), '2,300,000,000,000,000,000,000.00')
  assert.equal(formatNumber(-2.3e21, '#,##0.00;(#,##0.00)'), '(2,300,000,000,000,000,000,000.00)')
  assert.equal(formatNumber(-2.3e21, '$#,##0.00_);($#,##0.00)'), '($2,300,000,000,000,000,000,000.00)')
  assert.equal(formatNumber(2.3e21, '$#,##0.00_);($#,##0.00)'), '$2,300,000,000,000,000,000,000.00 ')
  assert.equal(formatNumber(2.3e20, '0.00'), '230000000000000000000.00')            // no binary noise past 15 digits
  assert.equal(formatNumber(1234567890123456, '0'), '1234567890123460')
  assert.equal(formatNumber(2.3e20, '0.0%'), '23000000000000000000000.0%')
  assert.equal(formatNumber(1.5e24, '#,##0,,'), '1,500,000,000,000,000,000')
  assert.equal(formatNumber(2.3e21, '"Total: "#,##0" units"'), 'Total: 2,300,000,000,000,000,000,000 units')
  assert.equal(formatNumber(2.3e21, '#,##0.0#'), '2,300,000,000,000,000,000,000.0')
  assert.equal(formatNumber(2.3e21, '0.00E+00'), '2.30E+21')
  assert.equal(formatText(2.3e21, '$#,##0.00'), '$2,300,000,000,000,000,000,000.00')
  // ordinary values are unchanged
  assert.equal(formatNumber(1234.5, '$#,##0.00'), '$1,234.50')
  assert.equal(formatNumber(-1234.5, '#,##0.00;(#,##0.00)'), '(1,234.50)')
  assert.equal(formatNumber(999999999999999, '#,##0'), '999,999,999,999,999')
})

test('the circular manager fee with the wrong =B8/B5 shows its runaway value in currency format', () => {
  const s = createLabSheet({ rows: 10, cols: 3, cells: { B3: { v: 100000 }, B4: { v: 40000 }, B5: { v: 0.08, fmt: '0.0%' }, B7: { fmt: '$#,##0.00' }, B8: { f: '=B3-B4-B7', fmt: '$#,##0.00' } } })
  s.setIterative(true)
  assert.deepEqual(s.set('B7', '=B8/B5'), { ok: true })
  const shown = s.display('B7')
  assert.match(shown, /^-?\$\d{1,3}(,\d{3})+\.00$/, shown)
  assert.ok(!/[eE]|,,|,\./.test(shown), shown)
})

test('checker: "E10, E11 and 18 more give the same result" (plural verb for several cells)', () => {
  const cells = Array.from({ length: 20 }, (_, i) => `E${10 + i}`)
  const rc = { trials: 5, stat: 'mean' as const, target: 3, tol: 0.1 }
  const many = judgeSample(cells, rc, { values: Array(100).fill(7), stat: 7, n: 100 })
  assert.equal(many.ok, false)
  assert.match(many.message ?? '', /^E10, E11 and 18 more give the same result on every recalculation: they need a fresh random draw/)
  const one = judgeSample(['E10'], rc, { values: Array(5).fill(7), stat: 7, n: 5 })
  assert.match(one.message ?? '', /^E10 gives the same result on every recalculation: it needs a fresh random draw/)
})
