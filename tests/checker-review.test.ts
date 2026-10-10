// checker-review.test.ts - regressions for the exercise reviewers' checker reports: anchoring that survives the fill,
// check.refs, legacy/modern function names, random draws, message accuracy, Goal Seek and value-task rules.
// Run: npx tsx --test tests/checker-review.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTask, referenceState } from '../src/lab/checker.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import { canonFn, constantRuns, hardCoded, randomClosure, readsNothing, statText, usesFunction } from '../src/lab/checkerUtil.ts'
import type { CellSpec, Exercise, LearnerState, Task, TaskResult } from '../src/lab/types.ts'

const ex = (cells: Record<string, CellSpec>, tasks: Task[], extra: Partial<Exercise> = {}): Exercise => ({
  id: 'review', week: 'EXAM', topic: 't', title: 'T', level: 1, minutes: 5, scenario: 's', skills: [],
  sheet: { rows: 30, cols: 12, cells }, tasks, ...extra,
})
const withEdits = (e: Exercise, edits: Record<string, string>, extra: Partial<LearnerState> = {}): LearnerState => {
  const ref = referenceState(e)
  return { ...ref, ...extra, edits: { ...ref.edits, ...edits } }
}
const run = (e: Exercise, id: string, state: LearnerState): TaskResult => checkTask(e, e.tasks.find((t) => t.id === id) as Task, state)
const said = (r: TaskResult, re: RegExp) => assert.ok(r.messages.some((m) => re.test(m)), `no message matching ${re}: ${JSON.stringify(r.messages)}`)
const silent = (r: TaskResult, re: RegExp) => assert.ok(!r.messages.some((m) => re.test(m)), `unexpected message matching ${re}: ${JSON.stringify(r.messages)}`)
const passes = (r: TaskResult) => assert.equal(r.ok, true, JSON.stringify(r.messages))
const fails = (r: TaskResult) => assert.equal(r.ok, false, 'expected the check to fail')
const answer: CellSpec = { role: 'answer' }
const given = (v: number | string): CellSpec => ({ v, role: 'given' })
const filled = (formula: string, cells: string[], shift: (f: string, i: number) => string): Record<string, string> =>
  Object.fromEntries(cells.map((c, i) => [c, shift(formula, i)]))

// ---------- 1. check.absolute survives the fill direction; check.refs ----------

const rates = ex(
  {
    B9: { v: 0.1, role: 'input' }, A2: given(100), A3: given(200), A4: given(300), C2: answer, C3: answer, C4: answer,
    B6: given(1), C6: given(2), D6: given(3), B7: answer, C7: answer, D7: answer, B11: answer,
  },
  [
    { id: 'down', kind: 'formula', cells: 'C2:C4', prompt: 'p', solution: '=A2*$B$9', check: { absolute: ['$B$9'] } },
    { id: 'right', kind: 'formula', cells: 'B7:D7', prompt: 'p', solution: '=B6*$B$9', check: { absolute: ['$B$9'] } },
    { id: 'one', kind: 'formula', cells: 'B11', prompt: 'p', solution: '=A2*$B$9', check: { absolute: ['$B$9'] } },
  ],
  { testCases: [{ name: 'Rate 20%', inputs: { B9: 0.2 } }] },
)
const down = (f: string) => filled(f, ['C2', 'C3', 'C4'], (x, i) => x.replace('A2', `A${2 + i}`).replace(/B(\$?)9/, (_m, d: string) => (d ? 'B$9' : `B${9 + i}`)))

test('absolute: any anchoring that survives the fill direction passes', () => {
  passes(run(rates, 'down', withEdits(rates, down('=A2*B$9'))))
  passes(run(rates, 'down', withEdits(rates, down('=A2*$B$9'))))
  const loose = run(rates, 'down', withEdits(rates, down('=A2*B9')))
  fails(loose)
  said(loose, /^Make B9 absolute so it survives fill-down$/)
  const colOnly = run(rates, 'down', withEdits(rates, { C2: '=A2*$B9', C3: '=A3*$B10', C4: '=A4*$B11' }))
  fails(colOnly)
  said(colOnly, /Make B9 absolute so it survives fill-down/)
  passes(run(rates, 'right', withEdits(rates, { B7: '=B6*$B9', C7: '=C6*$B9', D7: '=D6*$B9' })))
  const rowOnly = run(rates, 'right', withEdits(rates, { B7: '=B6*B$9', C7: '=C6*C$9', D7: '=D6*D$9' }))
  fails(rowOnly)
  said(rowOnly, /Make B9 absolute so it survives fill-right/)
  passes(run(rates, 'one', withEdits(rates, { B11: '=A2*B9' })))
  said(run(rates, 'one', withEdits(rates, { B11: '=A2*0.1' })), /B11 has 0.1 typed in/)
})

test('check.refs: the formula must read the listed cell, with any $ signs', () => {
  const loop = ex(
    { B5: { v: 10, role: 'input' }, B8: { f: '=B5+1', role: 'given' }, B7: answer },
    [{ id: 'fee', kind: 'formula', cells: 'B7', prompt: 'p', solution: '=B8*2', check: { refs: ['B8'] } }],
    { testCases: [{ name: 'B5 is 20', inputs: { B5: 20 } }] },
  )
  const closed = run(loop, 'fee', withEdits(loop, { B7: '=(B5+1)*2' }))
  fails(closed)
  said(closed, /^Your formula should refer to B8$/)
  passes(run(loop, 'fee', withEdits(loop, { B7: '=$B$8*2' })))
  passes(run(loop, 'fee', withEdits(loop, { B7: '=SUM(B8:B9)*2' })))
})

// ---------- 2. legacy and modern function names ----------

test('mustUse / mustNotUse treat legacy and modern names as one function', () => {
  const pairs: [string, string][] = [
    ['PERCENTILE', 'PERCENTILE.INC'], ['PERCENTRANK', 'PERCENTRANK.INC'], ['NORMINV', 'NORM.INV'], ['NORMSINV', 'NORM.S.INV'],
    ['NORMDIST', 'NORM.DIST'], ['NORMSDIST', 'NORM.S.DIST'], ['CRITBINOM', 'BINOM.INV'], ['BINOMDIST', 'BINOM.DIST'],
    ['STDEV', 'STDEV.S'], ['STDEVP', 'STDEV.P'], ['VAR', 'VAR.S'], ['VARP', 'VAR.P'], ['RANK', 'RANK.EQ'], ['MODE', 'MODE.SNGL'],
    ['FORECAST', 'FORECAST.LINEAR'], ['CONCATENATE', 'CONCAT'], ['EXPONDIST', 'EXPON.DIST'], ['POISSON', 'POISSON.DIST'],
    ['GAMMAINV', 'GAMMA.INV'], ['LOGINV', 'LOGNORM.INV'],
  ]
  for (const [legacy, modern] of pairs) {
    assert.equal(canonFn(modern.toLowerCase()), canonFn(legacy), `${modern} = ${legacy}`)
    assert.ok(usesFunction(`=_xlfn.${modern}(A1)`, legacy) && usesFunction(`=${legacy}(A1)`, modern), `${legacy} ~ ${modern}`)
  }
  assert.ok(!usesFunction('=STDEV.P(A1:A5)', 'STDEV'), 'STDEV.P is the population SD, not STDEV')
  const data = ex(
    { A1: given(3), A2: given(9), A3: given(4), A4: given(12), A5: given(7), B1: answer, B2: answer, B3: answer },
    [
      { id: 'pct', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=PERCENTILE(A1:A5,0.9)', check: { mustUse: ['PERCENTILE'] } },
      { id: 'sd', kind: 'formula', cells: 'B2', prompt: 'p', solution: '=STDEV.S(A1:A5)', check: { mustUse: ['STDEV.S'] } },
      { id: 'manual', kind: 'formula', cells: 'B3', prompt: 'p', solution: '=SQRT(SUMPRODUCT((A1:A5-AVERAGE(A1:A5))^2)/4)', check: { mustNotUse: ['STDEV'] } },
    ],
  )
  passes(run(data, 'pct', withEdits(data, { B1: '=PERCENTILE.INC(A1:A5,0.9)' })))
  passes(run(data, 'sd', withEdits(data, { B2: '=STDEV(A1:A5)' })))
  const banned = run(data, 'manual', withEdits(data, { B3: '=STDEV.S(A1:A5)' }))
  fails(banned)
  said(banned, /^Solve this without STDEV\.S: this exercise practises another way$/)
})

// ---------- 3. random tasks need a fresh draw when the reference draws ----------

const night = ex(
  {
    B2: { v: 10, role: 'input' }, B4: { f: '=RANDBETWEEN(1,2)', role: 'given' }, E1: given(40), E2: given(60),
    B5: answer, B6: answer, B7: answer,
  },
  [
    {
      id: 'load', kind: 'formula', cells: 'B5', prompt: 'p', solution: '=MAX(0,NORMINV(RAND(),INDEX($E$1:$E$2,B4),$B$2))',
      check: { mustUse: ['MAX'] }, random: { trials: 60, stat: 'mean', target: 50, tol: 4 },
    },
    { id: 'big', kind: 'formula', cells: 'B6', prompt: 'p', solution: '=B5>55', random: { trials: 60, stat: 'p', target: 0.34, tol: 0.2 } },
    { id: 'gap', kind: 'formula', cells: 'B7', prompt: 'p', solution: '=-$B$2*LN(RAND())', random: { trials: 60, stat: 'mean', target: 10, tol: 3 } },
  ],
  { week: 'W5' },
)

test('random: a reference that draws needs a learner draw even with mustUse; reading random cells needs none', () => {
  const ref = referenceState(night)
  passes(run(night, 'load', ref))
  const noDraw = run(night, 'load', withEdits(night, { B5: '=MAX(0,INDEX($E$1:$E$2,B4))' }))
  fails(noDraw)
  said(noDraw, /B5: the formula must draw a random number with RAND or RANDBETWEEN/)
  passes(run(night, 'big', ref))
  passes(run(night, 'big', withEdits(night, { B6: '=55<B5' })))
  const flipped = run(night, 'big', withEdits(night, { B6: '=B5<55' }))
  fails(flipped)
  said(flipped, /the share of trials meeting the condition is off \(too high for this model\)$/)
  silent(flipped, /check the probability and the comparison/)
  said(run(night, 'gap', withEdits(night, { B7: '=-10*LN(RAND())' })), /B7 has 10 typed in; refer to the input cell instead/)
})

// ---------- 4a. "same random draws" only for cells that draw or read draws ----------

const kiosk = ex(
  {
    B1: { v: 100, role: 'input' }, B2: { v: 10, role: 'input' }, B3: { v: 6, role: 'input' },
    B5: answer, B6: answer, B7: answer, B9: answer,
  },
  [
    { id: 'demand', kind: 'formula', cells: 'B5', prompt: 'p', solution: '=RANDBETWEEN(80,120)', random: { trials: 50, stat: 'mean', target: 100, tol: 5 } },
    { id: 'profit', kind: 'formula', cells: 'B6', prompt: 'p', solution: '=B2*MIN(B5,B1)-B3*B1' },
    { id: 'cost', kind: 'formula', cells: 'B7', prompt: 'p', solution: '=B1*B3' },
    { id: 'typed', kind: 'value', cells: 'B9', prompt: 'p', answer: 42 },
  ],
  { week: 'W5', testCases: [{ name: 'Order 90', inputs: { B1: 90 } }] },
)

test('random wording: only formulas that draw or read random cells; never value tasks', () => {
  const cost = run(kiosk, 'cost', withEdits(kiosk, { B7: '=B1*B2' }))
  said(cost, /^B7: shows 1000, expected a different value$/)
  silent(cost, /random draws/)
  said(run(kiosk, 'profit', withEdits(kiosk, { B6: '=B2*MIN(B5,B1)' })), /^B6: gives a different result from the model answer for the same random draws$/)
  const typed = run(kiosk, 'typed', withEdits(kiosk, { B9: '41' }))
  said(typed, /^B9: shows 41, expected a different value$/)
  silent(typed, /random draws/)
  const closure = randomClosure(new Map([['B5', ['=RAND()']], ['B6', ['=B5*2']], ['B7', ['=B1*2']], ['E1', ['=B6']]]), [{ range: 'D1:E4', colInput: 'G1' }])
  assert.deepEqual([...closure].sort(), ['B5', 'B6', 'E1', 'E2', 'E3', 'E4'])
})

// ---------- 4b/4c. hard-coding guesses and the logic message ----------

test('hard-coding: numbers in the reference, 0/1 and never-input argument slots are not blamed', () => {
  assert.equal(hardCoded('=FV(B2/12,144,-B3)', [12], '=FV(B2/12,B1*12,-B3)'), undefined)
  assert.equal(hardCoded('=VLOOKUP(A1,$D$1:$F$9,3,FALSE)', [3]), undefined)
  assert.equal(hardCoded('=HLOOKUP(A1,$D$1:$F$9,2,TRUE)', [2]), undefined)
  assert.equal(hardCoded('=MATCH(A1,$D$1:$D$9,-1)+A2*0', [1, 0]), undefined)
  assert.equal(hardCoded('=ROUND(A1*B1,2)+ROUNDUP(A2,2)', [2]), undefined)
  assert.equal(hardCoded('=INDEX($B$2:$E$9,MATCH(A1,$A$2:$A$9,0),3)', [3], '=INDEX($B$2:$E$9,MATCH(A1,$A$2:$A$9,0),2)'), undefined)
  assert.equal(hardCoded('=INDEX($B$2:$E$9,3,2)', [3], '=INDEX($B$2:$E$9,MATCH(A1,$A$2:$A$9,0),2)'), '3')
  assert.equal(hardCoded('=A1*12', [12]), '12')
  assert.equal(hardCoded('=A1*12%', [0.12]), '12%')
  assert.equal(hardCoded('=IF(A1>"12",A1,0)', [12]), undefined)
  assert.ok(readsNothing('=20') && readsNothing('=12*3+ROUND(2.5,0)') && !readsNothing('=A1*2') && !readsNothing('=Rate*2'))
  const fund = ex(
    { B1: { v: 12, role: 'input' }, B2: { v: 0.06, role: 'input' }, B3: { v: 100, role: 'input' }, B4: answer },
    [{ id: 'fv', kind: 'formula', cells: 'B4', prompt: 'p', solution: '=FV(B2/12,B1*12,-B3)' }],
    { testCases: [{ name: 'Ten years', inputs: { B1: 10 } }, { name: 'Deposit 150', inputs: { B3: 150 } }] },
  )
  const sheet = createLabSheet(fund.sheet, { state: referenceState(fund) })
  const value = sheet.read('B4').value
  sheet.destroy()
  const periods = run(fund, 'fv', withEdits(fund, { B4: '=FV(B2/12,144,-B3)' }))
  said(periods, /^B4: correct on the given data; check the logic for this case: 'Ten years'$/)
  silent(periods, /12 typed in/)
  said(run(fund, 'fv', withEdits(fund, { B4: '=FV(B2/12,B1*12,-100)' })), /B4 has 100 typed in; refer to the input cell instead/)
  said(run(fund, 'fv', withEdits(fund, { B4: `=${String(value)}` })), /B4 is a hard-coded number \(no cell references\): refer to the input cells instead/)
})

test('logic errors get the logic message; $ is only blamed when the anchoring differs from the model answer', () => {
  const pick = ex(
    { B1: { v: 5, role: 'input' }, B2: { v: 3, role: 'input' }, B3: answer },
    [{ id: 'pick', kind: 'formula', cells: 'B3', prompt: 'p', solution: '=IF(B1>B2,"A","B")' }],
    { testCases: [{ name: 'A tie', inputs: { B1: 3 } }] },
  )
  const tie = run(pick, 'pick', withEdits(pick, { B3: '=IF(B1>=B2,"A","B")' }))
  said(tie, /^B3: correct on the given data; check the logic for this case: 'A tie'$/)
  silent(tie, /\$|hard-coded/)
  const flags = ex(
    { B10: { v: 150, role: 'input' }, A2: given(100), A3: given(150), A4: given(300), D2: answer, D3: answer, D4: answer },
    [{ id: 'flag', kind: 'formula', cells: 'D2:D4', prompt: 'p', solution: '=IF(A2>$B$10,"Big","Small")' }],
  )
  const boundary = run(flags, 'flag', withEdits(flags, { D2: '=IF(A2>=$B$10,"Big","Small")', D3: '=IF(A3>=$B$10,"Big","Small")', D4: '=IF(A4>=$B$10,"Big","Small")' }))
  fails(boundary)
  said(boundary, /^D3: shows "Big", expected a different value$/)
  silent(boundary, /\$/)
  const sliding = run(flags, 'flag', withEdits(flags, { D2: '=IF(A2>B10,"Big","Small")', D3: '=IF(A3>B11,"Big","Small")', D4: '=IF(A4>B12,"Big","Small")' }))
  assert.equal(sliding.messages[0], 'D2 is right but D3 is not: check which references need $ before filling')
  const drift = ex(
    { B9: { v: 0.1, role: 'input' }, B10: given(0.1), B11: given(0.1), A2: given(100), A3: given(200), A4: given(300), C2: answer, C3: answer, C4: answer },
    [{ id: 'down', kind: 'formula', cells: 'C2:C4', prompt: 'p', solution: '=A2*$B$9' }],
    { testCases: [{ name: 'Rate 20%', inputs: { B9: 0.2 } }] },
  )
  const moved = run(drift, 'down', withEdits(drift, { C2: '=A2*B9', C3: '=A3*B10', C4: '=A4*B11' }))
  assert.deepEqual(moved.messages, ["C3, C4: correct on the given data but wrong when 'Rate 20%': check which references need $ before filling"])
})

// ---------- 4d/4e/4f. empty cells: per-cell formulas, spills, partly filled ranges ----------

test('per-cell solutions never say fill; spill tasks say spill; empty cells are reported once', () => {
  const per = ex(
    { A2: given(4), A3: given(5), E2: answer, E3: answer },
    [{ id: 'pair', kind: 'formula', cells: 'E2:E3', prompt: 'p', solutions: { E2: '=A2+A3', E3: '=A2*A3' } }],
  )
  const none = run(per, 'pair', { edits: {} })
  said(none, /^E2, E3 are empty: each needs its own formula$/)
  silent(none, /fill/)
  const half = run(per, 'pair', { edits: { E2: '=A2+A3' } })
  assert.deepEqual(half.messages, ['E3: still empty (it needs its own formula)'])
  const logic = run(per, 'pair', { edits: { E2: '=A2+A3', E3: '=A2-A3' } })
  silent(logic, /\$/)

  const spill = ex(
    { A1: given(1), B1: given(2), C1: given(3), D1: given(4), H4: answer, I4: answer, J4: answer, K4: answer },
    [{ id: 'row', kind: 'formula', cells: 'H4:K4', prompt: 'p', solutions: { H4: '=A1:D1*2' } }],
  )
  assert.deepEqual(run(spill, 'row', { edits: {} }).messages, ['H4:K4 is empty: type one formula in H4; it spills across H4:K4'])
  const single = run(spill, 'row', { edits: { H4: '=A1*2' } })
  said(single, /^I4, J4, K4: still empty: the formula in H4 should spill across H4:K4$/)
  silent(single, /fill/)
  passes(run(spill, 'row', { edits: { H4: '=A1:D1*2' } }))

  const totals = ex(
    { A6: given(1), B6: given(2), A7: given(3), B7: given(4), A8: given(5), B8: given(6), E6: answer, E7: answer, E8: answer },
    [{ id: 'sum', kind: 'formula', cells: 'E6:E8', prompt: 'p', solution: '=SUM(A6:B6)', check: { mustUse: ['SUM'] } }],
  )
  assert.deepEqual(run(totals, 'sum', { edits: { E6: '=SUM(A6:B6)' } }).messages, ['E7, E8: still empty (fill the formula down to E8)'])
  assert.deepEqual(run(totals, 'sum', { edits: {} }).messages, ['E6:E8 is empty: enter a formula in E6 and fill it down to E8'])
  const plus = run(totals, 'sum', { edits: { E6: '=A6+B6' } })
  said(plus, /^Use SUM here$/)
  silent(plus, /Use SUM in E7/)
})

// ---------- 4g. cells that only read a loop ----------

test('a cell that reads a circular chain depends on it; a loop cell refers back to itself', () => {
  const loop = ex(
    { A1: { v: 1000, role: 'input' }, A2: { v: 0.1, role: 'input' }, B1: answer, B2: answer, B3: answer },
    [
      { id: 'bal', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=A1+B2' },
      { id: 'int', kind: 'formula', cells: 'B2', prompt: 'p', solution: '=A2*(A1+B1)/2' },
      { id: 'twice', kind: 'formula', cells: 'B3', prompt: 'p', solution: '=B1*2' },
    ],
  )
  const off = { ...referenceState(loop), iterative: false }
  const reader = run(loop, 'twice', off)
  said(reader, /^B3 depends on a circular reference \(B[12] is part of a loop\): switch on iterative calculation/)
  silent(reader, /refers back to itself/)
  said(run(loop, 'int', off), /^B2 refers back to itself \(circular reference\)/)
  passes(run(loop, 'twice', referenceState(loop)))
})

// ---------- 4h/4i. statistics in the cell format; constant data tables ----------

test('random statistics are shown in the cells number format', () => {
  assert.equal(statText(0.00436, '[m]:ss', 0.0002), '6:17')
  assert.equal(statText(0.00436, 'h:mm:ss', 0.0002), '0:06:17')
  assert.equal(statText(349.2, '$#,##0', 16), '$349')
  assert.equal(statText(3.52, '0', 0.1), '3.52', 'a format that rounds the difference away falls back to 3 figures')
  assert.equal(statText(25.5, 'mm:ss', 0.0002), '612:00:00', 'mm:ss would drop the days and hours')
  assert.equal(statText(-0.002, 'mm:ss', 0.0001), '-0.00200', 'a negative time cannot be shown in a time format')
  const waits = ex(
    { B5: { role: 'answer', fmt: '[m]:ss' } },
    [{ id: 'wait', kind: 'formula', cells: 'B5', prompt: 'p', solution: '=RAND()*4/1440', random: { trials: 60, stat: 'mean', target: 2 / 1440, tol: 0.4 / 1440 } }],
    { week: 'W6' },
  )
  const slow = run(waits, 'wait', withEdits(waits, { B5: '=RAND()*8/1440' }))
  fails(slow)
  said(slow, /the average of B5 is \d:\d\d: too high/)
})

test('a replication table frozen by its input cell points at the Row/Column input cells', () => {
  const runs: Record<string, CellSpec> = {}
  for (let i = 1; i <= 20; i++) runs[`D${i + 1}`] = given(i)
  const table = ex(
    { B1: answer, B2: { f: '=IF(B1<0.5,1,0)', role: 'given' }, E1: { f: '=B2', role: 'given' }, G1: { note: 'blank' }, ...runs },
    [
      { id: 'draw', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=RAND()', random: { trials: 30, stat: 'mean', target: 0.5, tol: 0.2 } },
      {
        id: 'reps', kind: 'tool', tool: 'datatable', cells: 'E2:E21', prompt: 'p', toolSetup: { range: 'D1:E21', colInput: 'G1' },
        random: { trials: 3, stat: 'mean', target: 0.5, tol: 0.25 },
      },
    ],
    { week: 'W5' },
  )
  passes(run(table, 'reps', referenceState(table)))
  const frozen = run(table, 'reps', { ...referenceState(table), dataTables: [{ range: 'D1:E21', colInput: 'B1' }] })
  fails(frozen)
  assert.deepEqual(frozen.messages, ['The data table gives the same result in every run: check the Row/Column input cells (the runs need a blank input cell that no formula uses)'])
  const linked = run(table, 'reps', { ...referenceState(table), dataTables: [{ range: 'D1:E21', colInput: 'B2' }] })
  fails(linked)
  said(linked, /^Over 3 recalculations the average of E2, E3 and 18 more is 10.5: too high for this model; check the Row\/Column input cells of the data table$/)
  assert.equal(constantRuns(['E2', 'E3', 'F2', 'F3'], [0, 0, 1, 1], true), true)
  assert.equal(constantRuns(['E2', 'E3', 'F2', 'F3'], [0, 1, 1, 1], true), false)
})

// ---------- 5/6. Goal Seek needs a number; value tasks need a value ----------

test('Goal Seek fails when the changing cell holds a formula', () => {
  const be = ex(
    { B1: { v: 20, role: 'input' }, B2: { v: 12, role: 'input' }, B3: { v: 4000, role: 'input' }, B4: { v: 400, role: 'input' }, B6: answer },
    [
      { id: 'profit', kind: 'formula', cells: 'B6', prompt: 'p', solution: '=(B1-B2)*B4-B3' },
      { id: 'seek', kind: 'tool', tool: 'goalseek', cells: 'B1', prompt: 'p', toolSetup: { setCell: 'B6', toValue: 0, changingCell: 'B1' }, answer: { B1: 22 }, check: { tol: 1e-4 } },
    ],
    { week: 'W2' },
  )
  const shortcut = run(be, 'seek', withEdits(be, { B1: '=B2+10' }))
  fails(shortcut)
  assert.deepEqual(shortcut.messages, ['Run Goal Seek: it leaves a number in B1; a formula there skips the tool'])
  passes(run(be, 'seek', withEdits(be, { B1: '22.00001' })))
})

test('value tasks: a formula fails unless allowFormula or the reference entry is a formula', () => {
  const v = ex(
    { B1: { v: 5, role: 'input' }, B11: answer, B12: answer, E26: answer },
    [
      { id: 'predict', kind: 'value', cells: 'B11', prompt: 'p', answer: 15 },
      { id: 'loose', kind: 'value', cells: 'B12', prompt: 'p', answer: 15, check: { allowFormula: true } },
      { id: 'live', kind: 'value', cells: 'E26', prompt: 'p', answer: { E26: 10 }, solutions: { E26: '=B1*2' } },
    ],
  )
  const typed = run(v, 'predict', withEdits(v, { B11: '=10+5' }))
  fails(typed)
  assert.deepEqual(typed.messages, ['Type the value itself in B11 (a number or text), not a formula'])
  passes(run(v, 'predict', withEdits(v, { B11: '15' })))
  passes(run(v, 'loose', withEdits(v, { B12: '=10+5' })))
  passes(run(v, 'live', referenceState(v)))
  passes(run(v, 'live', withEdits(v, { E26: '10' })))
})
