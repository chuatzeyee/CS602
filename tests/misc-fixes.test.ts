// misc-fixes.test.ts - Solver linearity re-check, PivotTable report-filter layout, task-card entry wording, the
// iterative-calculation toggle and the Monty Hall influence-diagram roles. Run: npx tsx --test tests/misc-fixes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises, mocks } from '../src/data/lab/index.ts'
import { sessions } from '../src/data/topics.ts'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { runSolver, SOLVER_MESSAGES } from '../src/lab/whatif.ts'
import { buildWorkbook, readCell } from '../src/lab/engine/workbook.ts'
import { linearityGap, multiStart, solve } from '../src/lab/engine/solverBridge.ts'
import { applyPivot, pivotArea, pivotConflict, pivotFromData } from '../src/lab/tools/pivot.ts'
import { entryInstruction } from '../src/lab/components/TaskCard.tsx'
import { iterativeToggleWanted, showsCycle } from '../src/lab/components/Toolbar.tsx'
import type { CellSpec, CellValue, Exercise, LabSheet, PivotConfig, SolverSetup, Task } from '../src/lab/types.ts'

const num = (s: LabSheet, ref: string): number => {
  const r = s.read(ref)
  assert.equal(r.kind, 'number', `${ref} should be a number, is ${r.kind} ${String(r.value)}`)
  return r.value as number
}

// ---------- 1. Solver: a step model that looks linear near the start ----------

// the W3 food-bank sheet with its own formula answers (subtotal, bracket discount, live total, meals) and no order yet
function foodBank(start: [number, number, number] = [0, 0, 0]): LabSheet {
  const ex = exercises.find(e => e.id === 'w3-exam-food-bank-discount')
  assert.ok(ex, 'the food-bank exercise exists')
  const s = createLabSheet(ex.sheet)
  const formulas = Object.fromEntries(ex.tasks.filter(t => t.kind === 'formula' && typeof t.solution === 'string').map(t => [t.cells, t.solution as string]))
  assert.deepEqual(writeCells(s, { ...formulas, G10: '0.09', D4: String(start[0]), D5: String(start[1]), D6: String(start[2]) }), { ok: true })
  assert.equal(s.raw('B9'), '=VLOOKUP(B8,F4:G8,2,TRUE)')
  return s
}

// the reviewer's repro: the live, bracket-discounted total B10 within the budget (not the linearised G11)
const liveDiscount = (engine: 'simplex' | 'grg'): SolverSetup => ({
  objective: 'B11', sense: 'max', changing: 'D4:D6',
  constraints: [
    { lhs: 'D4', relation: '<=', rhs: 'B14' },
    { lhs: 'D5', relation: '=', rhs: 'B15' },
    { lhs: 'D6', relation: '>=', rhs: 'B16' },
    { lhs: 'B10', relation: '<=', rhs: 'B17' },
    { lhs: 'D4:D6', relation: 'int' },
  ],
  nonNegative: true, engine,
})

test('Simplex LP: a bracket discount that starts beyond the probes fails the linearity re-check (food bank from 0)', () => {
  const s = foodBank()
  const v = s.version
  const r = runSolver(s, liveDiscount('simplex'))
  assert.equal(r.status, 'failed')
  assert.equal(r.message, 'The linearity conditions required by this LP Solver are not satisfied.')
  assert.equal(r.message, SOLVER_MESSAGES.linearity)
  assert.deepEqual(s.values('D4:D6'), [[0], [0], [0]])   // variable cells restored, nothing written
  assert.equal(s.version, v)
  // started inside the jumps the probes already saw it (unchanged behaviour)
  assert.equal(runSolver(foodBank([100, 60, 100]), liveDiscount('simplex')).message, SOLVER_MESSAGES.linearity)
})

test('GRG on the step model: no global-optimum claim, and no worse than a quick multi-start (food bank from 0)', () => {
  const s = foodBank()
  const r = runSolver(s, liveDiscount('grg'))
  assert.equal(r.status, 'optimal')
  assert.equal(r.message, SOLVER_MESSAGES.localOptimum)
  assert.notEqual(r.message, SOLVER_MESSAGES.optimal)
  const [d4, d5, d6] = s.values('D4:D6').map(row => row[0] as number)
  assert.ok([d4, d5, d6].every(Number.isInteger), 'whole packs')
  assert.ok(d4 <= 150 && d5 === 60 && d6 >= 40, `plan ${d4}/${d5}/${d6} keeps the rules`)
  assert.ok(num(s, 'B10') <= 3800, 'the true, discounted total is within budget')
  // the bug kept the LP plan 150/60/193 (4,638 meals, priced at 0%); the best whole-pack plan gives 5,010
  assert.ok(num(s, 'B11') >= 5000, `meals ${num(s, 'B11')}`)
  assert.equal(r.objective, num(s, 'B11'))
})

test('the linearised food-bank model (fixed discount G10) still solves as an LP with the global message', () => {
  const s = foodBank()
  assert.deepEqual(writeCells(s, { G11: '=B8*(1-G10)', G12: '=INDEX(F4:F8,MATCH(G10,G4:G8,0))' }), { ok: true })
  const r = runSolver(s, {
    objective: 'B11', sense: 'max', changing: 'D4:D6',
    constraints: [
      { lhs: 'D4', relation: '<=', rhs: 'B14' }, { lhs: 'D5', relation: '=', rhs: 'B15' }, { lhs: 'D6', relation: '>=', rhs: 'B16' },
      { lhs: 'G11', relation: '<=', rhs: 'B17' }, { lhs: 'B8', relation: '>=', rhs: 'G12' }, { lhs: 'D4:D6', relation: 'int' },
    ],
    nonNegative: true, engine: 'simplex',
  })
  assert.equal(r.message, SOLVER_MESSAGES.optimal)
  assert.deepEqual(s.values('D4:D6'), [[150], [60], [255]])
  assert.equal(num(s, 'B11'), 5010)
  assert.equal(num(s, 'B9'), 0.09)
})

test('Simplex LP: a large linear model answered far from the start is not mistaken for a step (rounding at binding constraints)', () => {
  // coefficients come from differences of values near 1e8, so they carry ~1e-8 of rounding; at an answer of ~3e4 that is
  // ~3e-4 where the budget row is ~0: the re-check must judge it against the size of the terms
  for (const [a, b, cap] of [[1234.567, 2345.678, 98765432.1], [0.123457, 0.000371, 9876.54321], [3.3, 7.7, 123456789.987]]) {
    const s = createLabSheet({ rows: 6, cols: 6, cells: {
      B1: { v: 0, role: 'input' }, C1: { v: 0, role: 'input' },
      B2: { v: a }, C2: { v: b }, D2: { f: '=SUMPRODUCT(B2:C2,B1:C1)' }, E2: { v: cap },
      B3: { v: 3456.789 }, C3: { v: 1234.5678 }, D3: { f: '=SUMPRODUCT(B3:C3,B1:C1)' }, D4: { f: '=B1-0.5*C1' }, E4: { v: 1000.25 },
    } })
    const r = runSolver(s, { objective: 'D3', sense: 'max', changing: 'B1:C1', constraints: [{ lhs: 'D2', relation: '<=', rhs: 'E2' }, { lhs: 'D4', relation: '<=', rhs: 'E4' }], engine: 'simplex' })
    assert.equal(r.message, SOLVER_MESSAGES.optimal, `cap ${cap}`)
    assert.ok(num(s, 'D2') <= cap * (1 + 1e-12) && num(s, 'D4') <= 1000.25 + 1e-6)
  }
})

test('solver bridge: the LP answer is re-checked against the sheet; linearOnly stops, the search keeps the LP plan as a floor', () => {
  // a 10% discount once the order reaches 50: linear on the probes' 0-10 box, not at the answer
  const cells = { B1: 0, B2: '=B1*(1-IF(B1>=50,0.1,0))', B3: 60 }
  const wb = buildWorkbook({ sheets: { S: cells } })
  const spec = { objective: 'S!B1', sense: 'max' as const, changing: ['S!B1'], constraints: [{ lhs: 'S!B2', relation: '<=' as const, rhs: 'S!B3' }] }
  const lp = solve(wb.hf, { ...spec, linearOnly: true })
  assert.equal(lp.linear, false)
  assert.equal(lp.linearAtStart, true)
  assert.notEqual(lp.status, 'optimal')
  assert.ok(lp.maxLinearityError > 1e-7)
  assert.equal(readCell(wb.hf, 'S!B1').value, 0)        // left at the start
  const grg = solve(buildWorkbook({ sheets: { S: cells } }).hf, spec)
  assert.equal(grg.linear, false)
  assert.equal(grg.status, 'optimal')
  assert.ok(grg.objective >= 60 - 1e-9, `at least the LP plan (60), got ${grg.objective}`)
  assert.ok(grg.objective <= 200 / 3 + 1e-6, 'and never past the true limit 66.67')
  // a linear model passes the re-check
  const flat = buildWorkbook({ sheets: { S: { B1: 0, B2: '=2*B1+1', B3: 41 } } })
  const ok = solve(flat.hf, { ...spec, constraints: [{ lhs: 'S!B2', relation: '<=', rhs: 'S!B3' }] })
  assert.equal(ok.linear, true)
  assert.equal(ok.values['S!B1'], 20)
})

test('solver bridge: linearityGap sees a jump between the start and the answer; multiStart finds the far bracket', () => {
  const lin = { coef: [[1]], constant: [0] }
  assert.equal(linearityGap(x => [x[0]], lin, [0], [100]), 0)
  assert.ok(linearityGap(x => [x[0] >= 50 ? 0.9 * x[0] : x[0]], lin, [0], [100]) > 0.01)
  const wb = buildWorkbook({ sheets: { S: { B1: 0, B2: '=B1*(1-IF(B1>=50,0.1,0))', B3: 60 } } })
  const best = multiStart(wb.hf, { objective: 'S!B1', sense: 'max', changing: ['S!B1'], constraints: [{ lhs: 'S!B2', relation: '<=', rhs: 'S!B3' }] }, [[0], [60]])
  assert.ok(best && best.status === 'optimal' && best.linear === false)
  assert.ok(Math.abs(best.objective - 200 / 3) < 1e-3, `about 66.67, got ${best?.objective}`)
})

// ---------- 2. PivotTable: report filters sit above the target ----------

const SALES: [string, string, string, number][] = [
  ['North', 'Paid', 'Shop', 100], ['North', 'Due', 'Online', 50], ['South', 'Paid', 'Online', 70], ['South', 'Due', 'Shop', 30], ['East', 'Paid', 'Shop', 20],
]
function salesSheet(extra: Record<string, CellSpec> = {}): LabSheet {
  const cells: Record<string, CellSpec> = { A1: { v: 'Region' }, B1: { v: 'Status' }, C1: { v: 'Channel' }, D1: { v: 'Sales' } }
  SALES.forEach((r, i) => r.forEach((v, j) => { cells[`${'ABCD'[j]}${i + 2}`] = { v } }))
  return createLabSheet({ rows: 30, cols: 12, cells: { ...cells, ...extra } })
}
const byRegion = (filters: PivotConfig['filters']): PivotConfig => ({ rows: ['Region'], columns: [], values: [{ field: 'Sales', agg: 'sum' }], filters })
const PAID = [{ field: 'Status', include: ['Paid'] as CellValue[] }]
const TABLE = [['Row Labels', 'Sum of Sales'], ['East', 20], ['North', 100], ['South', 70], ['Grand Total', 190]]   // Paid only
const TABLE_ALL = [['Row Labels', 'Sum of Sales'], ['East', 20], ['North', 150], ['South', 100], ['Grand Total', 270]]

test('PivotTable: one report filter goes two rows above the target, the table starts at the target (T3 -> filter T1)', () => {
  const s = salesSheet()
  assert.deepEqual(applyPivot(s, { source: 'A1:D6', target: 'G3', config: byRegion(PAID) }), { ok: true })
  assert.deepEqual(s.values('G1:H2'), [['Status', 'Paid'], [null, null]])
  assert.deepEqual(s.values('G3:H7'), TABLE)
  assert.deepEqual(pivotArea({ r1: 2, c1: 6 }, pivotFromData(['Region', 'Status', 'Channel', 'Sales'], SALES, byRegion(PAID))), { r1: 0, c1: 6, r2: 6, c2: 7 })
})

test('PivotTable: with no room above (target in row 1 or 2) the table moves down so the filter sits in row 1', () => {
  for (const target of ['G1', 'G2']) {
    const s = salesSheet()
    assert.deepEqual(applyPivot(s, { source: 'A1:D6', target, config: byRegion(PAID) }), { ok: true }, target)
    assert.deepEqual(s.values('G1:H7'), [['Status', 'Paid'], [null, null], ...TABLE], target)
  }
  // two filters stack upwards from the row two above the table; from row 1 the table starts in row 4
  const two = [...PAID, { field: 'Channel', include: [] as CellValue[] }]
  const s = salesSheet()
  assert.deepEqual(applyPivot(s, { source: 'A1:D6', target: 'G6', config: byRegion(two) }), { ok: true })
  assert.deepEqual(s.values('G3:H6'), [['Status', 'Paid'], ['Channel', '(All)'], [null, null], ['Row Labels', 'Sum of Sales']])
  assert.deepEqual(s.values('G1:H2'), [[null, null], [null, null]])
  const top = salesSheet()
  assert.deepEqual(applyPivot(top, { source: 'A1:D6', target: 'G1', config: byRegion(two) }), { ok: true })
  assert.deepEqual(top.values('G1:H4'), [['Status', 'Paid'], ['Channel', '(All)'], [null, null], ['Row Labels', 'Sum of Sales']])
  // without filters nothing moves
  const plain = salesSheet()
  assert.deepEqual(applyPivot(plain, { source: 'A1:D6', target: 'G1', config: byRegion([]) }), { ok: true })
  assert.deepEqual(plain.values('G1:H5'), TABLE_ALL)
})

test('PivotTable: conflicts, source overlap and re-creating count the filter rows above the target', () => {
  const s = salesSheet({ G1: { v: 'note' } })
  const setup = { source: 'A1:D6', target: 'G3', config: byRegion(PAID) }
  assert.equal(pivotConflict(s, setup), 'G1:H7')                      // Excel asks before replacing G1
  assert.equal(pivotConflict(s, { ...setup, config: byRegion([]) }), null)
  assert.match((applyPivot(s, { ...setup, target: 'A9', config: byRegion([...PAID, { field: 'Channel', include: [] }]) }) as { message: string }).message, /overlap/)
  s.set('G1', '')
  assert.deepEqual(applyPivot(s, { ...setup, config: byRegion([]) }), { ok: true })
  assert.deepEqual(s.values('G3:H7'), TABLE_ALL)
  const v = s.version
  assert.deepEqual(applyPivot(s, setup), { ok: true })                // same target, filter added: one undo step
  assert.equal(s.version, v + 1)
  assert.equal(pivotConflict(s, setup), null)                         // its own earlier output does not count
  assert.deepEqual(s.values('G1:H1'), [['Status', 'Paid']])
  assert.deepEqual(s.values('G3:H7'), TABLE)
  assert.deepEqual(applyPivot(s, { ...setup, config: byRegion([]) }), { ok: true })
  assert.deepEqual(s.values('G1:H2'), [[null, null], [null, null]])  // the filter row is cleared again
  assert.deepEqual(s.values('G3:H7'), TABLE_ALL)
  s.undo()
  assert.deepEqual(s.values('G1:H1'), [['Status', 'Paid']])
  assert.deepEqual(s.values('G3:H7'), TABLE)
})

test('W10 report-filter pivots: a target in row 1 or row 3 gives the same, Excel layout', () => {
  const ex = exercises.find(e => e.id === 'w10-pivot-orders')
  const task = ex?.tasks.find(t => t.id === 'p3')
  assert.ok(ex && task?.toolSetup && task.answer)
  for (const target of ['T1', 'T3']) {
    const s = createLabSheet(ex.sheet)
    assert.deepEqual(applyPivot(s, { ...(task.toolSetup as { source: string; config: PivotConfig }), target }), { ok: true })
    for (const [ref, want] of Object.entries(task.answer as Record<string, CellValue>)) {
      const got = s.values(ref)[0][0]
      assert.ok(typeof want === 'number' ? Math.abs((got as number) - want) < 0.005 : got === want, `${target}: ${ref} is ${String(got)}, expected ${String(want)}`)
    }
  }
})

// ---------- 3. Task-card wording ----------

const t = (extra: Partial<Task>): Task => ({ id: 'x', kind: 'formula', cells: 'B2', prompt: '', ...extra })

test('task card: fill, per-cell, spill and value wording', () => {
  assert.equal(entryInstruction(t({ cells: 'B8', solution: '=1' })), 'Type a formula in B8.')
  assert.equal(entryInstruction(t({ cells: 'C10:C12', solution: '=1' })), 'Type a formula in C10, then fill it down to C12.')
  assert.equal(entryInstruction(t({ cells: 'C21:F21', solution: '=1' })), 'Type a formula in C21, then fill it right to F21.')
  assert.equal(entryInstruction(t({ cells: 'B12:D15', solution: '=1' })), 'Type a formula in B12, then fill it across B12:D15.')
  assert.equal(entryInstruction(t({ cells: 'B6:C8', solutions: { B6: '=1', C6: '=2', B7: '=3', C7: '=4', B8: '=5', C8: '=6' } })), 'Type a formula in each cell of B6:C8.')
  assert.equal(entryInstruction(t({ cells: 'E3:F3,D15', solutions: { E3: '=1', F3: '=2', D15: '=3' } })), 'Type a formula in each cell of E3:F3, D15.')
  assert.equal(entryInstruction(t({ cells: 'H4:K4', solutions: { H4: '=INDEX(B4:E11,1,0)' } })), 'Type one formula in H4; it spills into I4:K4.')
  assert.equal(entryInstruction(t({ cells: 'M4:M11', solutions: { M4: '=INDEX(B4:E11,0,1)' } })), 'Type one formula in M4; it spills into M5:M11.')
  assert.equal(entryInstruction(t({ cells: 'H4:K6', solutions: { H4: '=B4:E6' } })), 'Type one formula in H4; it spills over H4:K6.')
  assert.equal(entryInstruction(t({ kind: 'value', cells: 'C28', answer: 1 })), 'Type the value in C28.')
  assert.equal(entryInstruction(t({ kind: 'value', cells: 'B10:B12', answer: { B10: 1 } })), 'Enter the values in B10:B12.')
  assert.equal(entryInstruction(t({ kind: 'tool', tool: 'solver', cells: 'D4:D6' })), undefined)   // tools keep their own line
  assert.equal(entryInstruction(t({ kind: 'criteria', cells: 'A1:B2' })), undefined)
})

test('task card: no exercise asks to fill per-cell or spill answers, or to type one value into several cells', () => {
  const all: Exercise[] = [...exercises, ...mocks.flatMap(m => m.questions.map(q => q.exercise))]
  const seen = { perCell: 0, spill: 0, values: 0 }
  for (const ex of all) {
    for (const task of ex.tasks) {
      const line = entryInstruction(task)
      if (task.kind !== 'formula' && task.kind !== 'value') {
        assert.equal(line, undefined)
        continue
      }
      assert.ok(line, `${ex.id}/${task.id} has an entry line`)
      const many = task.cells.includes(':') || task.cells.includes(',')
      if (task.kind === 'formula' && task.solutions && typeof task.solution !== 'string' && many) {
        assert.doesNotMatch(line, /fill/, `${ex.id}/${task.id}: ${line}`)
        if (Object.keys(task.solutions).length === 1) {
          seen.spill++
          assert.match(line, /^Type one formula in [A-Z]+\d+; it spills/, `${ex.id}/${task.id}`)
        } else seen.perCell++
      }
      if (task.kind === 'value' && many) {
        seen.values++
        assert.match(line, /^Enter the values in /, `${ex.id}/${task.id}`)
      }
    }
  }
  assert.ok(seen.perCell > 0 && seen.spill > 0 && seen.values > 0, JSON.stringify(seen))
  const bike = exercises.find(e => e.id === 'w1-autofill-vs-trend-bike-trips')?.tasks.find(x => x.id === 'autofill')
  assert.equal(bike && entryInstruction(bike), 'Enter the values in B10:B12.')
})

// ---------- 4. Iterative calculation toggle ----------

const plain = (extra: Partial<Exercise> = {}): Exercise => ({
  id: 'x', week: 'W4', topic: 'Loans', title: 'Loan table', level: 1, minutes: 5, scenario: 'A loan.', skills: ['PMT'],
  sheet: { rows: 6, cols: 4, cells: { A1: { v: 1, role: 'input' } } }, tasks: [t({ cells: 'B1', prompt: 'Compute the payment.' })], ...extra,
})

test('iterative toggle: spec, text, a #CYCLE! on the sheet or iteration on; always in the sandbox', () => {
  const ex = plain()
  const s = createLabSheet(ex.sheet)
  assert.equal(iterativeToggleWanted(ex, false, s), false)
  assert.equal(iterativeToggleWanted(ex, true, s), true)                                         // sandbox
  assert.equal(iterativeToggleWanted(plain({ sheet: { ...ex.sheet, iterative: true } }), false, null), true)
  assert.equal(iterativeToggleWanted(plain({ scenario: 'The fee is a share of profit after the fee: a circular model.' }), false, null), true)
  assert.equal(iterativeToggleWanted(plain({ tasks: [t({ prompt: 'Switch on iterative calculation, then compute B1.' })] }), false, null), true)
  assert.equal(iterativeToggleWanted(plain({ tasks: [t({ hints: ['Excel needs Enable iterative calculation.'] })] }), false, null), true)
  // a learner's accidental loop: the toggle appears with the #CYCLE! and stays while iteration is on
  assert.deepEqual(s.set('B1', '=C1+1'), { ok: true })
  assert.deepEqual(s.set('C1', '=B1/2'), { ok: true })
  assert.equal(s.read('B1').value, '#CYCLE!')
  assert.equal(showsCycle(s), true)
  assert.equal(iterativeToggleWanted(ex, false, s), true)
  s.setIterative(true)
  assert.equal(showsCycle(s), false)
  assert.equal(iterativeToggleWanted(ex, false, s), true)
  s.setIterative(false)
  assert.deepEqual(s.set('C1', '5'), { ok: true })
  assert.equal(showsCycle(s), false)
  assert.equal(iterativeToggleWanted(ex, false, s), false)
  // text that only looks like the error does not count
  assert.deepEqual(s.set('D1', "'#CYCLE!"), { ok: true })
  assert.equal(showsCycle(s), false)
})

test('iterative toggle: every W4 circular exercise gets it', () => {
  const circular = exercises.filter(e => e.id.includes('circular'))
  assert.ok(circular.length > 0)
  for (const ex of circular) assert.equal(iterativeToggleWanted(ex, false, null), true, ex.id)
})

// ---------- 5. Monty Hall influence diagram (Week 5 slides) ----------

test('Monty Hall influence diagram: switch/stay and the first pick are parameters; prize door and amount are decisions', () => {
  const topic = sessions.flatMap(se => se.topics).find(tp => tp.id === 'monty-hall-simulation')
  assert.ok(topic)
  const line = topic.sections.flatMap(se => se.points).find(p => p.startsWith('The influence diagram'))
  assert.ok(line)
  assert.match(line, /parameters \(decision to switch\/stay, initial selected door\)/)
  assert.match(line, /decisions \(prize door placement, prize amount\)/)
  assert.match(line, /performance measure \(total prize money to prepare\)/)
})
