// checker.test.ts - the checking rules one by one. Run: npx tsx --test tests/checker.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellsOf, checkExercise, checkTask, fillEntry, referenceState, revealTask, sameValue } from '../src/lab/checker.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import { fixtureById, fixtures } from './fixtures.ts'
import type { CellSpec, Exercise, LearnerState, Task, TaskResult } from '../src/lab/types.ts'

const ex = (cells: Record<string, CellSpec>, tasks: Task[], extra: Partial<Exercise> = {}): Exercise => ({
  id: 'unit', week: 'W5', topic: 't', title: 'T', level: 1, minutes: 5, scenario: 's', skills: [],
  sheet: { rows: 20, cols: 8, cells }, tasks, ...extra,
})
const withEdits = (e: Exercise, edits: Record<string, string>, extra: Partial<LearnerState> = {}): LearnerState => {
  const ref = referenceState(e)
  return { ...ref, ...extra, edits: { ...ref.edits, ...edits } }
}
const run = (e: Exercise, id: string, state: LearnerState): TaskResult => checkTask(e, e.tasks.find((t) => t.id === id) as Task, state)
const said = (r: TaskResult, re: RegExp) => assert.ok(r.messages.some((m) => re.test(m)), `no message matching ${re}: ${JSON.stringify(r.messages)}`)
const fixture = (id: string): Exercise => fixtureById(id) as Exercise

// A1 input, B1 = 2*A1 (task one), C1 = B1+5 (task two)
const chain = ex(
  { A1: { v: 10, role: 'input' }, B1: { role: 'answer' }, C1: { role: 'answer' } },
  [
    { id: 'one', kind: 'formula', cells: 'B1', prompt: 'double', solution: '=A1*2' },
    { id: 'two', kind: 'formula', cells: 'C1', prompt: 'plus five', solution: '=B1+5' },
  ],
  { testCases: [{ name: 'A1 becomes 7', inputs: { A1: 7 } }] },
)

test('reference state: solutions applied and filled, every fixture passes its own check', () => {
  const basics = fixture('fx-basics')
  const ref = referenceState(basics)
  assert.equal(ref.edits.B4, '=B$3*$A4*(1-$B$1)')
  assert.equal(ref.edits.D7, '=D$3*$A7*(1-$B$1)')
  assert.equal(ref.edits.B12, 'Large')
  assert.equal(ref.selfMarks?.why, true)
  for (const f of fixtures.filter((x) => x.id !== 'fx-vba')) {
    const r = checkExercise(f, referenceState(f))
    assert.equal(r.score, 1, `${f.id}: ${JSON.stringify(r.tasks.filter((t) => !t.ok))}`)
  }
  assert.deepEqual(fillEntry('=$A2*B$1', 'C2:D3'), { C2: '=$A2*B$1', D2: '=$A2*C$1', C3: '=$A3*B$1', D3: '=$A3*C$1' })
  assert.deepEqual(cellsOf('B4:C4, B4,E1'), ['B4', 'C4', 'E1'])
})

test('isolation: a mistake in one task does not fail another; helper cells are kept', () => {
  const state = withEdits(chain, { B1: '=A1*3', C1: '=B1+5' })
  assert.equal(run(chain, 'one', state).ok, false)
  assert.equal(run(chain, 'two', state).ok, true)
  const helper = withEdits(chain, { B1: '=A1*3', E5: '=A1*2', C1: '=E5+5' })
  assert.equal(run(chain, 'two', helper).ok, true)
  const r = checkExercise(chain, state)
  assert.equal(r.score, 0.5)
  assert.deepEqual(r.tasks.map((t) => t.ok), [false, true])
})

test('inputs are reset to the spec: a learner experimenting with A1 is still checked on 10', () => {
  const state = withEdits(chain, { A1: '99' })
  assert.equal(checkExercise(chain, state).score, 1)
})

test('hard-coding is caught by the test cases, with the case named', () => {
  const r = run(chain, 'one', withEdits(chain, { B1: '=20' }))
  assert.equal(r.ok, false)
  said(r, /correct on the given data but wrong when 'A1 becomes 7'/)
  said(r, /hard-coded/)
  const typed = run(chain, 'one', withEdits(chain, { B1: '=10*2' }))
  said(typed, /B1 has 10 typed in; refer to the input cell instead/)
  assert.ok(!typed.messages.join(' ').includes('A1*2'), 'messages never reveal the solution')
})

test('formula required: a typed value fails, formulaRequired false accepts it', () => {
  const r = run(chain, 'one', withEdits(chain, { B1: '20' }))
  assert.equal(r.ok, false)
  said(r, /needs a formula, not a typed value/)
  const empty = run(chain, 'one', withEdits(chain, { B1: '' }))
  said(empty, /B1 is empty/)
  const loose = ex({ A1: { v: 10, role: 'input' }, B1: { role: 'answer' } }, [
    { id: 'one', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=A1*2', check: { formulaRequired: false } },
  ])
  assert.equal(run(loose, 'one', withEdits(loose, { B1: '20' })).ok, true)
})

const grid = ex(
  {
    A1: { v: 0.1, role: 'input' }, B3: { v: 4, role: 'input' }, C3: { v: 6, role: 'input' },
    A4: { v: 10, role: 'given' }, A5: { v: 20, role: 'given' },
    B4: { role: 'answer' }, C4: { role: 'answer' }, B5: { role: 'answer' }, C5: { role: 'answer' },
  },
  [{ id: 'g', kind: 'formula', cells: 'B4:C5', prompt: 'grid', solution: '=B$3*$A4*(1-$A$1)', check: { absolute: ['B$3', '$A4', '$A$1'] } }],
  { testCases: [{ name: 'Discount 20%', inputs: { A1: 0.2 } }] },
)

test('anchoring: missing $ found by values after the fill and by the absolute list', () => {
  const relative = run(grid, 'g', withEdits(grid, fillEntry('=B3*A4*(1-A1)', 'B4:C5')))
  assert.equal(relative.ok, false)
  assert.equal(relative.cells.B4, 'bad')
  said(relative, /Make A1 absolute so it survives filling down and right/)
  said(relative, /Write B\$3 and \$A4 with these \$ signs/)
  const plain: Exercise = { ...grid, tasks: [{ ...grid.tasks[0], check: undefined }] }
  const hint = run(plain, 'g', withEdits(plain, fillEntry('=B3*A4*(1-A1)', 'B4:C5')))
  said(hint, /B4 is right but C4 is not: check which references need \$ before filling/)
  const almost = run(grid, 'g', withEdits(grid, { B4: '=B$3*$A4*(1-A1)', C4: '=C$3*$A4*(1-$A$1)', B5: '=B$3*$A5*(1-$A$1)', C5: '=C$3*$A5*(1-$A$1)' }))
  assert.equal(almost.ok, false)
  said(almost, /Make A1 absolute so it survives filling down and right/)
  assert.equal(almost.correct, 3) // values right everywhere; only the first cell's anchoring is marked
  const typedEach = run(grid, 'g', withEdits(grid, { B4: '=B$3*$A4*(1-$A$1)', C4: '=C$3*$A4*(1-$A$1)', B5: '=B$3*$A5*(1-$A$1)', C5: '=C$3*$A5*(1-$A$1)' }))
  assert.equal(typedEach.ok, true)
})

test('partly filled ranges and unreadable formulas are reported per cell', () => {
  const partial = run(grid, 'g', withEdits(grid, { B4: '=B$3*$A4*(1-$A$1)', C4: '', B5: '', C5: '' }))
  assert.equal(partial.correct, 1)
  said(partial, /still empty/)
  const broken = run(grid, 'g', withEdits(grid, { B4: '=SUM(B3' }))
  said(broken, /B4: Excel cannot read this formula/)
  assert.equal(broken.cells.B4, 'bad')
})

test('a dynamic-array formula that spills over the range counts as filled', () => {
  const col = ex({ A1: { v: 1 }, A2: { v: 2 }, A3: { v: 3 }, B1: { role: 'answer' }, B2: { role: 'answer' }, B3: { role: 'answer' } }, [
    { id: 'd', kind: 'formula', cells: 'B1:B3', prompt: 'double', solution: '=A1*2' },
  ])
  const r = run(col, 'd', withEdits(col, { B1: '=A1:A3*2', B2: '', B3: '' }))
  assert.equal(r.ok, true, JSON.stringify(r.messages))
})

test('tolerance, text case and whitespace, booleans', () => {
  assert.ok(sameValue({ kind: 'number', value: 1.0000004 }, { kind: 'number', value: 1 }))
  assert.ok(!sameValue({ kind: 'number', value: 1.01 }, { kind: 'number', value: 1 }))
  assert.ok(sameValue({ kind: 'number', value: 1.01 }, { kind: 'number', value: 1 }, { tol: 0.05 }))
  assert.ok(sameValue({ kind: 'number', value: 1e12 + 100 }, { kind: 'number', value: 1e12 }, { relTol: 1e-9 }))
  assert.ok(sameValue({ kind: 'string', value: ' large ' }, { kind: 'string', value: 'Large' }))
  assert.ok(!sameValue({ kind: 'string', value: 'large' }, { kind: 'string', value: 'Large' }, { caseSensitive: true }))
  assert.ok(!sameValue({ kind: 'number', value: 1 }, { kind: 'boolean', value: true }))
  const v = ex({ B1: { role: 'answer' }, B2: { role: 'answer' } }, [
    { id: 'rate', kind: 'value', cells: 'B1', prompt: 'rate', answer: 0.0731, check: { tol: 0.0001 } },
    { id: 'name', kind: 'value', cells: 'B2', prompt: 'name', answer: 'Large' },
  ])
  assert.equal(run(v, 'rate', withEdits(v, { B1: '7.31%' })).ok, true)
  assert.equal(run(v, 'rate', withEdits(v, { B1: '0.0732' })).ok, true)
  const off = run(v, 'rate', withEdits(v, { B1: '0.07' }))
  assert.equal(off.ok, false)
  said(off, /B1: shows 0.07, expected a different value/)
  assert.equal(run(v, 'name', withEdits(v, { B2: '  large' })).ok, true)
  said(run(v, 'name', withEdits(v, { B2: '' })), /Type your answer in B2/)
})

test('error values must match the reference error code', () => {
  const look = ex(
    { A1: { v: 'Ann', role: 'given' }, B1: { v: 5, role: 'given' }, A2: { v: 'Bo', role: 'given' }, B2: { v: 7, role: 'given' }, D1: { v: 'Zed', role: 'input' }, E1: { role: 'answer' } },
    [{ id: 'l', kind: 'formula', cells: 'E1', prompt: 'look up', solution: '=VLOOKUP(D1,A1:B2,2,FALSE)' }],
  )
  assert.equal(run(look, 'l', withEdits(look, { E1: '=INDEX(B1:B2,MATCH(D1,A1:A2,0))' })).ok, true)
  assert.equal(run(look, 'l', withEdits(look, { E1: '=D1*1' })).ok, false)
  assert.equal(run(look, 'l', withEdits(look, { E1: '=0' })).ok, false)
  const num = run(chain, 'one', withEdits(chain, { B1: '=A1/0' }))
  said(num, /B1 shows #DIV\/0!/)
})

test('mustUse and mustNotUse look at function names outside text', () => {
  const t = ex({ A1: { v: 3 }, A2: { v: 4 }, B1: { role: 'answer' } }, [
    { id: 's', kind: 'formula', cells: 'B1', prompt: 'add', solution: '=SUM(A1:A2)', check: { mustUse: ['SUM'], mustNotUse: ['SUMPRODUCT'] } },
  ])
  said(run(t, 's', withEdits(t, { B1: '=A1+A2' })), /^Use SUM here$/)
  const inText = run(t, 's', withEdits(t, { B1: '=IF(A1>0,A1+A2,"SUM(")' }))
  assert.equal(inText.ok, false)
  said(inText, /Use SUM here/)
  said(run(t, 's', withEdits(t, { B1: '=SUMPRODUCT(A1:A2,{1;1})+0*SUM(A1)' })), /without SUMPRODUCT/)
  assert.equal(run(t, 's', withEdits(t, { B1: '=sum(a1:a2)' })).ok, true)
})

test('random tasks: reproducible statistics, wrong distributions and non-random formulas fail', () => {
  const mc = fixture('fx-montecarlo')
  const ref = referenceState(mc)
  const a = run(mc, 'demand', ref)
  const b = run(mc, 'demand', ref)
  assert.equal(a.ok, true)
  assert.deepEqual(a, b)
  const narrow = withEdits(mc, { B5: '=RANDBETWEEN(80,100)' })
  const r1 = run(mc, 'demand', narrow)
  const r2 = run(mc, 'demand', narrow)
  assert.equal(r1.ok, false)
  assert.deepEqual(r1.messages, r2.messages)
  said(r1, /average of B5 is .*too low/)
  said(run(mc, 'demand', withEdits(mc, { B5: '=100' })), /RAND or RANDBETWEEN/)
  said(run(mc, 'demand', withEdits(mc, { B5: '100' })), /needs a formula/)
  assert.equal(run(mc, 'demand', withEdits(mc, { B5: '=80+INT(RAND()*41)' })).ok, true)
  assert.equal(run(mc, 'rush', withEdits(mc, { B11: '=B10>RAND()' })).ok, true)
  said(run(mc, 'rush', withEdits(mc, { B11: '=RAND()<0.3' })), /B11 has 0.3 typed in; refer to the input cell instead/)
  said(run(mc, 'rush', withEdits(mc, { B11: '=RAND()>B10' })), /7\d% of the results in B11 are TRUE: the share of trials meeting the condition is off \(too high/)
})

test('formulas over random cells compare exactly: both sides see the same draws', () => {
  const mc = fixture('fx-montecarlo')
  assert.equal(run(mc, 'profit', withEdits(mc, { B6: '=MIN(B5,B1)*B2-B1*B3' })).ok, true)
  assert.equal(run(mc, 'average', withEdits(mc, { B8: '=(AVERAGE(E3:E52)+AVERAGE(E53:E102))/2' })).ok, true)
  assert.equal(run(mc, 'average', withEdits(mc, { B8: '=AVERAGE(E3:E101)' })).ok, false)
  // demand wrong does not leak into profit (isolation with random cells)
  assert.equal(run(mc, 'profit', withEdits(mc, { B5: '=RANDBETWEEN(1,2)', B6: '=B2*MIN(B5,B1)-B3*B1' })).ok, true)
})

test('queue simulation: two random columns, deterministic columns compare exactly and stay isolated', () => {
  const cells: Record<string, CellSpec> = { B1: { v: 2, role: 'input' }, B2: { v: 1, role: 'input' }, B3: { v: 3, role: 'input' }, C5: { v: 0, role: 'given' }, F5: { v: 0, role: 'given' } }
  for (let r = 6; r <= 35; r++) for (const c of 'BCDEF') cells[`${c}${r}`] = { role: 'answer' }
  const q = ex(cells, [
    { id: 'gap', kind: 'formula', cells: 'B6:B35', prompt: 'p', solution: '=-$B$1*LN(RAND())', random: { trials: 20, stat: 'mean', target: 2, tol: 0.3 }, check: { absolute: ['$B$1'] } },
    { id: 'arr', kind: 'formula', cells: 'C6:C35', prompt: 'p', solution: '=C5+B6' },
    { id: 'svc', kind: 'formula', cells: 'D6:D35', prompt: 'p', solution: '=$B$2+RAND()*($B$3-$B$2)', random: { trials: 20, stat: 'mean', target: 2, tol: 0.15 } },
    { id: 'start', kind: 'formula', cells: 'E6:E35', prompt: 'p', solution: '=MAX(C6,F5)' },
    { id: 'end', kind: 'formula', cells: 'F6:F35', prompt: 'p', solution: '=E6+D6' },
  ], { sheet: { rows: 40, cols: 8, cells }, testCases: [{ name: 'Faster arrivals', inputs: { B1: 1.5 } }] })
  assert.equal(checkExercise(q, referenceState(q)).score, 1)
  const alt: Record<string, string> = {}
  for (let r = 6; r <= 35; r++) Object.assign(alt, { [`E${r}`]: `=MAX(F${r - 1},C${r})`, [`F${r}`]: `=D${r}+E${r}` })
  assert.equal(checkExercise(q, withEdits(q, alt)).score, 1)
  const late: Record<string, string> = {}
  for (let r = 6; r <= 35; r++) Object.assign(late, { [`E${r}`]: `=C${r}`, [`B${r}`]: `=-2*LN(RAND())` })
  const res = checkExercise(q, withEdits(q, late))
  assert.deepEqual(res.tasks.map((t) => t.ok), [false, true, true, false, true])
  said(res.tasks[0], /B6 has 2 typed in/)
  said(res.tasks[3], /for the same random draws/)
})

test('data tables: the learner table must exist with the same range and input-cell role', () => {
  const dt = fixture('fx-datatables')
  const ref = referenceState(dt)
  assert.ok(ref.dataTables?.some((d) => d.range === 'D2:E7' && d.colInput === 'B2'))
  assert.equal(run(dt, 'rates', ref).ok, true)
  const none = run(dt, 'rates', { ...ref, dataTables: ref.dataTables?.filter((d) => d.range !== 'D2:E7') })
  said(none, /no data table in D2:E7 yet/)
  const rowWise = run(dt, 'rates', { ...ref, dataTables: [{ range: 'D2:E7', rowInput: 'B2' }, { range: 'G2:J5', rowInput: 'B3', colInput: 'B1' }] })
  said(rowWise, /Column input cell/)
  const wrongInput = run(dt, 'rates', { ...ref, dataTables: [{ range: 'D2:E7', colInput: 'B3' }, { range: 'G2:J5', rowInput: 'B3', colInput: 'B1' }] })
  assert.equal(wrongInput.ok, false)
  said(wrongInput, /check the input cell/)
  const swapped = run(dt, 'grid', { ...ref, dataTables: [{ range: 'D2:E7', colInput: 'B2' }, { range: 'G2:J5', rowInput: 'B1', colInput: 'B3' }] })
  assert.equal(swapped.ok, false)
  // the link formula is checked on its own even when the tables are missing
  assert.equal(run(dt, 'link', { ...ref, dataTables: [] }).ok, true)
})

test('Monte Carlo replication table is checked statistically', () => {
  const mc = fixture('fx-montecarlo')
  const ref = referenceState(mc)
  assert.equal(run(mc, 'table', ref).ok, true)
  said(run(mc, 'table', { ...ref, dataTables: [] }), /no data table in D2:E102/)
  const fixed = run(mc, 'table', withEdits(mc, { B6: '=B2*MIN(B5,B1)-B3*B1' }, { dataTables: [{ range: 'D2:E102', colInput: 'G1' }] }))
  assert.equal(fixed.ok, true)
})

test('Goal Seek and Solver tasks compare the answer cells; Solver also checks the constraints', () => {
  const gs = fixture('fx-goalseek')
  assert.equal(run(gs, 'seek', withEdits(gs, { B1: '22.00001' })).ok, true)
  said(run(gs, 'seek', withEdits(gs, { B1: '21' })), /run Goal Seek/)
  const sv = fixture('fx-solver')
  assert.equal(run(sv, 'solve', withEdits(sv, { B3: '60', C3: '70' })).ok, true)
  const over = run(sv, 'solve', withEdits(sv, { B3: '200', C3: '50' }))
  assert.equal(over.ok, false)
  said(over, /Constraint D6:D7 <= E6:E7 does not hold/)
  said(run(sv, 'solve', withEdits(sv, { B3: '-10', C3: '70' })), /must not be negative/)
})

test('decision tools: pivot answers, sorted rows and filtered rows', () => {
  const cells: Record<string, CellSpec> = { A1: { v: 'Region' }, B1: { v: 'Store' }, C1: { v: 'Sales' } }
  const rows: [string, string, number][] = [['North', 'S01', 1200], ['South', 'S02', 800], ['North', 'S03', 950], ['East', 'S04', 1500], ['North', 'S05', 1800]]
  rows.forEach(([r, s, v], i) => Object.assign(cells, { [`A${i + 2}`]: { v: r }, [`B${i + 2}`]: { v: s }, [`C${i + 2}`]: { v } }))
  const d = ex(cells, [
    { id: 'pivot', kind: 'tool', tool: 'pivot', cells: 'E1:F5', prompt: 'p', toolSetup: { source: 'A1:C6', target: 'E1', config: { rows: ['Region'], columns: [], values: [{ field: 'Sales', agg: 'sum' }], filters: [] } }, answer: { F2: 1500, F3: 3950 } },
    { id: 'sort', kind: 'tool', tool: 'sort', cells: 'A2:C6', prompt: 'p', toolSetup: { range: 'A1:C6', levels: [{ column: 'Sales', order: 'desc' }] }, answer: { C2: 1800, B2: 'S05', C6: 800 } },
    { id: 'filter', kind: 'tool', tool: 'autofilter', cells: 'A1', prompt: 'p', toolSetup: { range: 'A1:C6', columns: [{ column: 'Region', filter: { type: 'values', values: ['North'] } }] }, answer: {} },
  ], { week: 'W10', sheet: { rows: 20, cols: 10, cells } })
  const ref = referenceState(d)
  assert.equal(checkExercise(d, ref).score, 1)
  const blank = checkExercise(d, { edits: {} })
  assert.deepEqual(blank.tasks.map((t) => t.ok), [false, false, false])
  said(blank.tasks[0], /F2 is empty: build the PivotTable/)
  said(blank.tasks[1], /C2: shows 1200, expected a different value: sort the list/)
  said(blank.tasks[2], /hides 0 rows; 2 rows should be hidden/)
  assert.equal(run(d, 'filter', { edits: {}, hiddenRows: ref.hiddenRows }).ok, true)
  assert.equal(checkTask(d, d.tasks[2], revealTask(d, d.tasks[2], { edits: {} })).ok, true)
})

test('explain tasks are pending until self-marked', () => {
  const basics = fixture('fx-basics')
  const none = run(basics, 'why', { edits: {} })
  assert.equal(none.pending, true)
  assert.equal(none.ok, false)
  assert.equal(run(basics, 'why', { edits: {}, selfMarks: { why: true } }).ok, true)
  const no = run(basics, 'why', { edits: {}, selfMarks: { why: false } })
  assert.equal(no.ok, false)
  assert.equal(no.pending, undefined)
})

test('reveal applies one task and keeps everything else', () => {
  const basics = fixture('fx-basics')
  const mine: LearnerState = { edits: { B4: '=1', B11: '7', F2: 'note to self' }, fmts: { F2: '0.0' } }
  const grid = basics.tasks[0]
  const next = revealTask(basics, grid, mine)
  assert.equal(next.edits.B4, '=B$3*$A4*(1-$B$1)')
  assert.equal(next.edits.D7, '=D$3*$A7*(1-$B$1)')
  assert.equal(next.edits.B11, '7')
  assert.equal(next.edits.F2, 'note to self')
  assert.equal(next.fmts?.F2, '0.0')
  assert.equal(mine.edits.B4, '=1', 'the input state is not mutated')
  assert.equal(checkTask(basics, grid, next).ok, true)
  const why = revealTask(basics, basics.tasks[5], mine)
  assert.equal(why.selfMarks?.why, true)
  assert.match(why.notes?.why ?? '', /price row/)
  const dt = fixture('fx-datatables')
  const shown = revealTask(dt, dt.tasks[2], { edits: {} })
  assert.ok(shown.dataTables?.some((d) => d.range === 'D2:E7'))
  const gs = fixture('fx-goalseek')
  const sought = revealTask(gs, gs.tasks[1], { edits: { B6: '=(B1-B2)*B4-B3' } })
  assert.equal(sought.edits.B1, '22')
  assert.equal(checkTask(gs, gs.tasks[1], sought).ok, true)
})

test('iterative calculation: the learner must switch it on for a circular model', () => {
  const loop = ex(
    { A1: { v: 1000, role: 'input' }, A2: { v: 0.1, role: 'input' }, B1: { role: 'answer' }, B2: { role: 'answer' } },
    [
      { id: 'bal', kind: 'formula', cells: 'B1', prompt: 'closing balance', solution: '=A1+B2' },
      { id: 'int', kind: 'formula', cells: 'B2', prompt: 'interest on the average balance', solution: '=A2*(A1+B1)/2' },
    ],
  )
  const ref = referenceState(loop)
  assert.equal(ref.iterative, true)
  assert.equal(checkExercise(loop, ref).score, 1)
  const off = run(loop, 'int', { ...ref, iterative: false })
  assert.equal(off.ok, false)
  said(off, /circular/)
  const sheet = createLabSheet(loop.sheet, { state: ref })
  const b2 = sheet.read('B2')
  sheet.destroy()
  assert.ok(b2.kind === 'number' && Math.abs(b2.value - 105.26) < 0.01)
})

test('hidden rows do not change values; marks are computed per task', () => {
  const q1 = fixture('fx-mock-q1')
  const ref = referenceState(q1)
  const r = checkExercise(q1, { ...ref, hiddenRows: [2, 3, 4] })
  assert.equal(r.score, 1)
  assert.deepEqual(r.marks, { got: 6, max: 6 })
  const partial = checkExercise(q1, withEdits(q1, { C2: '=VLOOKUP(B2,$F$2:$G$5,2,FALSE)', C3: '=VLOOKUP(B3,$F$2:$G$5,2,FALSE)' }))
  assert.equal(partial.tasks[0].correct, 3)
  assert.deepEqual(partial.marks, { got: 1.75 + 3, max: 6 })
})

test('performance: a 5-task exercise with test cases checks well under 1.5 s', () => {
  const basics = fixture('fx-basics')
  const state = withEdits(basics, { B4: '=B3*A4' })
  checkExercise(basics, state)
  const t0 = performance.now()
  checkExercise(basics, state)
  assert.ok(performance.now() - t0 < 1500)
  const mc = fixture('fx-montecarlo')
  const t1 = performance.now()
  checkExercise(mc, referenceState(mc))
  assert.ok(performance.now() - t1 < 4000)
})
