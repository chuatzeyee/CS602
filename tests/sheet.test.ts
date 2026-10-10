// sheet.test.ts - LabSheet, refs and what-if tools. Run: npx tsx --test tests/sheet.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  colIndex, colLetter, isRef, normRef, parseRange, parseRef, rangeCells, shiftFormula, splitRanges, stripDollars, toRange, toRef,
} from '../src/lab/refs.ts'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { runGoalSeek, runSolver, SOLVER_MESSAGES } from '../src/lab/whatif.ts'
import { applyTool } from '../src/lab/tools/index.ts'
import { canonicalRaw, parseInput } from '../src/lab/engine/input.ts'
import { formatGeneral } from '../src/lab/engine/format.ts'
import type { CellSpec, LabSheet, SheetSpec } from '../src/lab/types.ts'

const near = (a: unknown, b: number, tol = 1e-9) => {
  assert.equal(typeof a, 'number', `expected a number, got ${String(a)}`)
  assert.ok(Math.abs((a as number) - b) <= tol, `${String(a)} is not within ${tol} of ${b}`)
}
const num = (s: LabSheet, ref: string): number => {
  const r = s.read(ref)
  assert.equal(r.kind, 'number', `${ref} should be a number, is ${r.kind} ${String(r.value)}`)
  return r.value as number
}
const sheetOf = (cells: Record<string, CellSpec>, extra: Partial<SheetSpec> = {}): LabSheet => createLabSheet({ rows: 30, cols: 10, cells, ...extra })

test('refs: parse, format, ranges, shifting', () => {
  assert.deepEqual(parseRef('$C$5'), { row: 4, col: 2, absRow: true, absCol: true })
  assert.deepEqual(parseRef('c5'), { row: 4, col: 2, absRow: false, absCol: false })
  assert.deepEqual(parseRef('Sheet1!B$2'), { row: 1, col: 1, absRow: true, absCol: false })
  assert.throws(() => parseRef('5C'))
  assert.equal(toRef(4, 2), 'C5')
  assert.equal(toRef(4, 2, true, true), '$C$5')
  assert.equal(colLetter(2), 'C')
  assert.equal(colLetter(26), 'AA')
  assert.equal(colIndex('AA'), 26)
  assert.equal(colIndex('z'), 25)
  assert.deepEqual(parseRange('C5:D6'), { r1: 4, c1: 2, r2: 5, c2: 3 })
  assert.deepEqual(parseRange('D6:C5'), { r1: 4, c1: 2, r2: 5, c2: 3 })
  assert.deepEqual(parseRange('B2'), { r1: 1, c1: 1, r2: 1, c2: 1 })
  assert.equal(toRange({ r1: 4, c1: 2, r2: 5, c2: 3 }), 'C5:D6')
  assert.deepEqual(rangeCells('C5:D6'), ['C5', 'D5', 'C6', 'D6'])
  assert.deepEqual(splitRanges('B4:D4, F4'), ['B4:D4', 'F4'])
  assert.equal(normRef('$b$7'), 'B7')
  assert.ok(isRef('AA10') && !isRef('A0') && !isRef('SUM'))
  assert.equal(shiftFormula('=$A2*B$1+C3', 2, 1), '=$A4*C$1+D5')
  assert.equal(shiftFormula('=SUM(A1:A3)&"B2"', 1, 0), '=SUM(A2:A4)&"B2"')
  assert.equal(shiftFormula('=LOG10(A1)+Data!B2', 0, 1), '=LOG10(B1)+Data!C2')
  assert.equal(shiftFormula('=A1', -1, 0), '=#REF!')
  assert.equal(stripDollars('=$A$1*"$5"'), '=A1*"$5"')
})

test('input parsing and General format', () => {
  assert.deepEqual(parseInput('12%'), { kind: 'value', value: 0.12, fmt: '0%' })
  assert.deepEqual(parseInput('12.5%'), { kind: 'value', value: 0.125, fmt: '0.0%' })
  assert.deepEqual(parseInput('$1,200'), { kind: 'value', value: 1200, fmt: '$#,##0' })
  assert.deepEqual(parseInput('2026-10-10'), { kind: 'value', value: 46305, fmt: 'yyyy-mm-dd' })
  assert.deepEqual(parseInput('10/10/2026'), { kind: 'value', value: 46305, fmt: 'dd/mm/yyyy' })
  assert.deepEqual(parseInput('6:45 PM'), { kind: 'value', value: 0.78125, fmt: 'h:mm AM/PM' })
  assert.deepEqual(parseInput("'00123"), { kind: 'value', value: '00123' })
  assert.deepEqual(parseInput('true'), { kind: 'value', value: true })
  assert.deepEqual(parseInput(' =a1 '), { kind: 'formula', formula: '=a1' })
  assert.deepEqual(parseInput('   '), { kind: 'empty' })
  assert.equal(parseInput('31/02/2026').kind, 'value')
  assert.equal((parseInput('31/02/2026') as { value: unknown }).value, '31/02/2026')
  assert.equal(canonicalRaw('00123'), "'00123")
  assert.equal(canonicalRaw('=x'), "'=x")
  assert.equal(canonicalRaw('hello'), 'hello')
  assert.equal(canonicalRaw(0.1 + 0.2), '0.30000000000000004')
  assert.equal(formatGeneral(1234567.891), '1234567.891')
  assert.equal(formatGeneral(2 / 3), '0.6666666667')
  assert.equal(formatGeneral(123456789012), '1.23457E+11')
  assert.equal(formatGeneral(0.000001), '1E-06')
  assert.equal(formatGeneral(-42), '-42')
})

test('build from spec: values, formulas, names, roles, default name', () => {
  const s = sheetOf({
    A1: { v: 'Rate', role: 'label' }, B1: { v: 0.07, role: 'input', fmt: '0.0%' },
    A2: { v: 'Price', role: 'label' }, B2: { v: 200, role: 'given' },
    B3: { f: '=B2*(1+TaxRate)', role: 'answer', fmt: '$#,##0.00' }, B4: { v: '00123' }, B5: { f: 'B2*2' },
  }, { names: { TaxRate: '=Sheet1!$B$1' } })
  assert.equal(s.name, 'Sheet1')
  assert.equal(s.rows, 30)
  assert.equal(s.cols, 10)
  near(num(s, 'B3'), 214)
  assert.equal(s.display('B3'), '$214.00')
  assert.equal(s.display('B1'), '7.0%')
  assert.equal(s.raw('B3'), '=B2*(1+TaxRate)')
  assert.equal(s.raw('B4'), "'00123")
  assert.deepEqual(s.read('B4'), { kind: 'string', value: '00123' })
  assert.equal(s.raw('B5'), '=B2*2')
  assert.equal(s.role('A1'), 'label')
  assert.equal(s.role('C9'), undefined)
  assert.deepEqual(s.values('A1:B2'), [['Rate', 0.07], ['Price', 200]])
  assert.deepEqual(s.state(), { edits: {} })
  const big = createLabSheet({ rows: 5000, cols: 60, cells: {} })
  assert.equal(big.rows, 1000)
  assert.equal(big.cols, 26)
  assert.throws(() => createLabSheet({ rows: 3, cols: 3, cells: { E9: { v: 1 } } }))
})

test('set: Excel-like typed constants, auto formats, clearing and formula errors', () => {
  const s = sheetOf({ C1: { v: 5, fmt: '0.00' }, D1: { v: 'x', role: 'given' } })
  const typed: [string, string, unknown, string][] = [
    ['A1', '12%', 0.12, '12%'], ['A2', '$1,200', 1200, '$1,200'], ['A3', '2026-10-10', 46305, '2026-10-10'],
    ['A4', '10/10/2026', 46305, '10/10/2026'], ['A5', '9:30', 9.5 / 24, '9:30'], ['A6', '6:45 PM', 0.78125, '6:45 PM'],
    ['A7', 'TRUE', true, 'TRUE'], ['A8', "'00123", '00123', '00123'], ['A9', '1,234.5', 1234.5, '1,234.5'], ['A10', 'hello', 'hello', 'hello'],
  ]
  for (const [ref, raw, value, shown] of typed) {
    assert.deepEqual(s.set(ref, raw), { ok: true })
    const r = s.read(ref)
    if (typeof value === 'number') near(r.value, value, 1e-12)
    else assert.equal(r.value, value)
    assert.equal(s.display(ref), shown, `display of ${raw}`)
    assert.equal(s.raw(ref), raw)
  }
  assert.equal(s.fmt('A1'), '0%')
  assert.equal(s.fmt('A10'), undefined)
  assert.deepEqual(s.set('C1', '12%'), { ok: true }) // keeps the cell's own format
  assert.equal(s.fmt('C1'), '0.00')
  assert.equal(s.display('C1'), '0.12')
  // automatic percent entry: a plain number >= 1 typed into a percent cell is a percentage
  assert.deepEqual(s.set('A1', '8'), { ok: true })
  near(num(s, 'A1'), 0.08, 1e-15)
  assert.equal(s.raw('A1'), '8%')
  s.set('A1', '0.5')
  assert.equal(s.display('A1'), '50%')
  s.setValues('A1', [[12]]) // tools write exact values
  assert.equal(num(s, 'A1'), 12)
  s.set('A1', '12%')
  assert.deepEqual(s.set('B1', '=sum(a1:a2)'), { ok: true })
  assert.equal(s.raw('B1'), '=SUM(A1:A2)')
  near(num(s, 'B1'), 1200.12)
  const bad = s.set('B2', '=SUM(A1:A2')
  assert.equal(bad.ok, false)
  assert.match((bad as { message: string }).message, /closing bracket/)
  assert.equal(s.raw('B2'), '')
  assert.equal(s.set('B2', '=SUMM(1)').ok, true)
  assert.equal(s.read('B2').kind, 'error')
  assert.equal(s.display('B2'), '#NAME?')
  assert.equal(s.set('B3', '=1/0').ok, true)
  assert.equal(s.display('B3'), '#DIV/0!')
  assert.deepEqual(s.set('B1', ''), { ok: true })
  assert.equal(s.raw('B1'), '')
  assert.equal(s.read('B1').kind, 'empty')
  assert.equal(s.set('Z99', '1').ok, false)
  assert.equal(s.set('D1', '1').ok, false)
  // set(ref, raw(ref)) reproduces every cell
  for (const ref of ['A1', 'A2', 'A3', 'A5', 'A6', 'A8', 'A9']) {
    const before = s.values(ref)
    s.set(ref, s.raw(ref))
    assert.deepEqual(s.values(ref), before)
  }
})

test('display formats: 0.00, currency, percent, time, date, General, booleans, errors', () => {
  const s = sheetOf({
    A1: { v: 3.14159, fmt: '0.00' }, A2: { v: -1234.5, fmt: '$#,##0.00' }, A3: { v: 0.1234, fmt: '0.0%' },
    A4: { v: 0.78125, fmt: 'hh:mm:ss' }, A5: { v: 46305, fmt: 'dd-mmm-yy' }, A6: { v: 1234567.891 }, A7: { f: '=1/3' },
    A8: { f: '=2>1' }, A9: { f: '=NA()' }, A10: { f: '=DATE(2026,10,10)' }, A11: { v: 1e12 }, A12: { v: 42 },
  })
  assert.equal(s.display('A1'), '3.14')
  assert.equal(s.display('A2'), '-$1,234.50')
  assert.equal(s.display('A3'), '12.3%')
  assert.equal(s.display('A4'), '18:45:00')
  assert.equal(s.display('A5'), '10-Oct-26')
  assert.equal(s.display('A6'), '1234567.891')
  assert.equal(s.display('A7'), '0.3333333333')
  assert.equal(s.display('A8'), 'TRUE')
  assert.equal(s.display('A9'), '#N/A')
  assert.equal(s.display('A10'), '10/10/2026')
  assert.equal(s.display('A11'), '1E+12')
  assert.equal(s.display('A12'), '42')
  assert.equal(s.display('B1'), '')
  s.setFmt('A12', '0.00')
  assert.equal(s.display('A12'), '42.00')
  assert.deepEqual(s.state().fmts, { A12: '0.00' })
  s.setFmt('A1', '0.00') // same as the spec: no learner override
  assert.deepEqual(s.state().fmts, { A12: '0.00' })
  s.setFmt('A12', '0.0.0"') // unusable code falls back to General
  assert.equal(s.display('A12'), '42')
  s.undo()
  assert.equal(s.display('A12'), '42.00')
})

test('locked cells: labels, given data and data-table bodies', () => {
  const s = sheetOf({ A1: { v: 'Label', role: 'label' }, A2: { v: 5, role: 'given' }, A3: { v: 1, role: 'input' }, A4: { role: 'answer' }, A5: { v: 'n', role: 'note' }, A6: { v: 'H', role: 'header' } })
  for (const ref of ['A1', 'A2', 'A5', 'A6']) {
    assert.equal(s.editable(ref), false, ref)
    const r = s.set(ref, '9')
    assert.equal(r.ok, false)
    assert.match((r as { message: string }).message, /locked/)
  }
  for (const ref of ['A3', 'A4', 'B1']) assert.equal(s.editable(ref), true, ref)
  assert.equal(s.editable('K1'), false) // outside the sheet
  const v = s.version
  assert.equal(s.setValues('A1', [[1]]).ok, false)
  assert.equal(s.fill('A3', 'A1:A3').ok, false)
  assert.equal(s.version, v)
  assert.deepEqual(s.clear('A1:A4'), { ok: true }) // clears what it may, skips locked cells
  assert.equal(s.raw('A3'), '')
  assert.equal(s.raw('A2'), '5')
  assert.equal(s.clear('A1:A2').ok, false)
})

test('fill down and right adjusts relative, absolute and mixed references like Excel', () => {
  const s = sheetOf({
    A2: { v: 1 }, A3: { v: 2 }, A4: { v: 3 }, B1: { v: 10 }, C1: { v: 20 }, D1: { v: 30 }, E1: { v: 0.5 },
    B2: { f: '=$A2*B$1+$E$1', role: 'answer', fmt: '0.0' },
    C2: { role: 'answer' }, D2: { role: 'answer' }, B3: { role: 'answer' }, C3: { role: 'answer' }, D3: { role: 'answer' }, B4: { role: 'answer' }, C4: { role: 'answer' }, D4: { role: 'answer' },
  })
  const v0 = s.version
  assert.deepEqual(s.fill('B2', 'B2:D2'), { ok: true })
  assert.deepEqual(s.fill('B2:D2', 'B2:D4'), { ok: true })
  assert.equal(s.version, v0 + 2)
  assert.equal(s.raw('C2'), '=$A2*C$1+$E$1')
  assert.equal(s.raw('B4'), '=$A4*B$1+$E$1')
  assert.equal(s.raw('D4'), '=$A4*D$1+$E$1')
  near(num(s, 'D4'), 90.5)
  near(num(s, 'C3'), 40.5)
  assert.equal(s.display('D4'), '90.5')
  s.undo()
  assert.equal(s.raw('B4'), '')
  assert.equal(s.raw('C2'), '=$A2*C$1+$E$1')
  s.redo()
  assert.equal(s.raw('D4'), '=$A4*D$1+$E$1')
  // fill a constant down copies it; fill a block in one call
  const t = sheetOf({ A1: { v: 7 }, B1: { f: '=A1*2' } })
  assert.deepEqual(t.fill('A1:B1', 'A1:B5'), { ok: true })
  assert.deepEqual(t.values('A5:B5'), [[7, 14]])
  assert.equal(t.raw('B5'), '=A5*2')
  t.undo()
  assert.equal(t.raw('B5'), '')
  assert.equal(t.fill('A1', 'A1:A99').ok, false)
})

test('copy and paste adjust references; clipboard errors are friendly', () => {
  const s = sheetOf({ A2: { v: 1 }, A5: { v: 4 }, B1: { v: 10 }, C1: { v: 20 }, E1: { v: 0.5 }, B2: { f: '=$A2*B$1+$E$1', fmt: '0.00' } })
  assert.equal(s.paste('C5').ok, false)
  s.copy('B2')
  assert.deepEqual(s.paste('C5'), { ok: true })
  assert.equal(s.raw('C5'), '=$A5*C$1+$E$1')
  near(num(s, 'C5'), 80.5)
  assert.equal(s.fmt('C5'), '0.00')
  s.copy('A1:B2')
  assert.equal(s.paste('J30').ok, false)
  s.undo()
  assert.equal(s.raw('C5'), '')
})

test('undo/redo: one step per action, redo cleared by a new edit, setValues and writeCells are single steps', () => {
  const s = sheetOf({})
  assert.equal(s.canUndo(), false)
  s.set('A1', '1')
  s.set('A1', '2')
  s.setValues('B1', [[1, 2], [3, 4]])
  assert.deepEqual(s.values('B1:C2'), [[1, 2], [3, 4]])
  s.undo()
  assert.deepEqual(s.values('B1:C2'), [[null, null], [null, null]])
  s.undo()
  assert.equal(s.raw('A1'), '1')
  assert.equal(s.canRedo(), true)
  s.redo()
  assert.equal(s.raw('A1'), '2')
  s.set('A2', 'x')
  assert.equal(s.canRedo(), false)
  assert.deepEqual(writeCells(s, { D1: '5', F3: '=D1*2' }), { ok: true })
  near(num(s, 'F3'), 10)
  s.undo()
  assert.equal(s.raw('D1'), '')
  assert.equal(s.raw('F3'), '')
  assert.equal(s.raw('A2'), 'x')
  s.set('G1', '12%')
  assert.equal(s.fmt('G1'), '0%')
  s.undo()
  assert.equal(s.fmt('G1'), undefined)
})

// rate in B1, years in B4, future value in B2
const fvCells = (): Record<string, CellSpec> => ({
  A1: { v: 'Rate', role: 'label' }, B1: { v: 0.05, role: 'input' }, A4: { v: 'Years', role: 'label' }, B4: { v: 10, role: 'input' },
  B2: { f: '=1000*(1+B1)^B4', role: 'given' },
  E1: { f: '=B2' }, F1: { f: '=B2-1000' }, D2: { v: 0.03 }, D3: { v: 0.05 }, D4: { v: 0.07 },
  E6: { v: 0.03 }, F6: { v: 0.05 }, G6: { v: 0.07 }, D7: { f: '=B2' },
  D10: { f: '=B2' }, E10: { v: 5 }, F10: { v: 10 }, D11: { v: 0.03 }, D12: { v: 0.05 },
})
const fv = (r: number, y: number) => 1000 * (1 + r) ** y

test('data table: one-variable column, row-oriented and two-variable layouts', () => {
  const s = sheetOf(fvCells())
  assert.deepEqual(s.addDataTable({ range: 'D1:F4', colInput: 'B1' }), { ok: true })
  near(num(s, 'E2'), fv(0.03, 10), 1e-9)
  near(num(s, 'E4'), fv(0.07, 10), 1e-9)
  near(num(s, 'F3'), fv(0.05, 10) - 1000, 1e-9)
  near(num(s, 'B1'), 0.05) // input restored
  assert.equal(s.editable('E2'), false)
  assert.equal(s.raw('E2'), '{=TABLE(,B1)}')
  assert.equal(s.set('E2', '1').ok, false)
  assert.deepEqual(s.addDataTable({ range: 'D6:G7', rowInput: 'B1' }), { ok: true })
  near(num(s, 'E7'), fv(0.03, 10), 1e-9)
  near(num(s, 'G7'), fv(0.07, 10), 1e-9)
  assert.deepEqual(s.addDataTable({ range: 'D10:F12', rowInput: 'B4', colInput: 'B1' }), { ok: true })
  near(num(s, 'E11'), fv(0.03, 5), 1e-9)
  near(num(s, 'F12'), fv(0.05, 10), 1e-9)
  near(num(s, 'B4'), 10)
  assert.deepEqual(s.dataTables.map((d) => d.range), ['D1:F4', 'D6:G7', 'D10:F12'])
  // edits do not re-run tables (automatic except tables); recalc does
  assert.deepEqual(s.set('B4', '20'), { ok: true })
  near(num(s, 'E2'), fv(0.03, 10), 1e-9)
  s.recalc()
  near(num(s, 'E2'), fv(0.03, 20), 1e-9)
  near(num(s, 'F12'), fv(0.05, 10), 1e-9) // two-variable table drives B4 itself
  // body cells never appear in edits; tables do
  const st = s.state()
  assert.deepEqual(st.edits, { B4: '20' })
  assert.equal(st.dataTables?.length, 3)
  // remove clears the body, undo brings it back
  s.removeDataTable('D6:G7')
  assert.equal(s.raw('E7'), '')
  assert.equal(s.editable('E7'), true)
  s.undo()
  near(num(s, 'E7'), fv(0.03, 20), 1e-9)
  s.undo() // the B4 edit
  s.undo() // the two-variable table
  assert.equal(s.raw('E11'), '')
  assert.equal(s.dataTables.length, 2)
})

test('data table: validation messages', () => {
  const s = sheetOf({ ...fvCells(), H2: { v: 'note', role: 'label' } })
  const msg = (r: { ok: boolean }) => (r as { message: string }).message
  assert.match(msg(s.addDataTable({ range: 'D1:F4' })), /input cell/i)
  assert.match(msg(s.addDataTable({ range: 'D1:D4', colInput: 'B1' })), /two rows and two columns/)
  assert.match(msg(s.addDataTable({ range: 'D1:F4', colInput: 'E2' })), /outside the table/)
  assert.match(msg(s.addDataTable({ range: 'D1:F4', colInput: 'Q1' })), /not valid|outside/)
  assert.match(msg(s.addDataTable({ range: 'G1:H3', colInput: 'B1' })), /locked/)
  assert.match(msg(s.addDataTable({ range: 'D1:F4', colInput: 'B1', rowInput: 'B1' })), /different/)
  assert.match(msg(s.addDataTable({ range: 'Z1:Z4', colInput: 'B1' })), /edge|valid/)
  assert.deepEqual(s.addDataTable({ range: 'D1:F4', colInput: 'B1' }), { ok: true })
  assert.match(msg(s.addDataTable({ range: 'E3:F5', colInput: 'B1' })), /overlaps/)
  assert.match(msg(s.addDataTable({ range: 'D10:F12', colInput: 'E3' })), /inside the data table/)
})

test('data table Monte Carlo trick: blank column input, every row an independent replication', () => {
  const cells: Record<string, CellSpec> = {
    B1: { f: '=RAND()' }, B2: { f: '=B1*10' }, E1: { f: '=B2' }, G1: { f: '=AVERAGE(E2:E201)' },
  }
  for (let i = 1; i <= 200; i++) cells[`D${i + 1}`] = { v: i }
  const s = createLabSheet({ rows: 210, cols: 10, cells })
  assert.deepEqual(s.addDataTable({ range: 'D1:E201', colInput: 'J1' }), { ok: true })
  const draws = s.values('E2:E201').map((r) => r[0] as number)
  assert.ok(new Set(draws).size > 190, 'rows should differ')
  assert.ok(draws.every((x) => x >= 0 && x < 10))
  const mean = num(s, 'G1')
  near(mean, 5, 0.85) // sd 2.89, se 0.2: more than 4 standard errors
  assert.equal(s.raw('J1'), '')
  // F9 redraws every replication; same seed rebuilds the same draws
  const again = createLabSheet({ rows: 210, cols: 10, cells }, { state: s.state() })
  assert.deepEqual(again.values('E2:E201'), s.values('E2:E201'))
  s.recalc()
  const redrawn = s.values('E2:E201').map((r) => r[0] as number)
  assert.notDeepEqual(redrawn, draws)
  near(num(s, 'G1'), 5, 0.85)
  // RAND stays put on ordinary edits (teaching mode), changes on recalc
  const b1 = num(s, 'B1')
  s.set('H5', '1')
  assert.equal(num(s, 'B1'), b1)
})

test('data table performance: 100 replications of a ~50-formula model under 2 s', () => {
  const cells: Record<string, CellSpec> = {}
  for (let r = 1; r <= 10; r++) {
    cells[`A${r}`] = { f: '=RAND()' }
    cells[`B${r}`] = { f: `=NORM.INV(A${r},100,15)` }
    cells[`C${r}`] = { f: `=MAX(0,ROUND(B${r},0))` }
    cells[`D${r}`] = { f: `=MIN(C${r},110)*5-C${r}*2` }
    cells[`E${r}`] = { f: `=IF(D${r}<0,1,0)` }
  }
  cells.F1 = { f: '=SUM(D1:D10)' }
  cells.G1 = { f: '=F1' }
  for (let i = 1; i <= 100; i++) cells[`F${i + 1}`] = { v: i }
  const s = createLabSheet({ rows: 120, cols: 10, cells })
  const t0 = performance.now()
  assert.deepEqual(s.addDataTable({ range: 'F1:G101', colInput: 'J1' }), { ok: true })
  s.recalc()
  const ms = performance.now() - t0
  assert.ok(ms < 2000, `two runs of 100 replications took ${ms.toFixed(0)} ms`)
  assert.ok(new Set(s.values('G2:G101').map((r) => r[0])).size > 50)
})

test('iterative calculation: circular donation model', () => {
  const cells: Record<string, CellSpec> = {
    B1: { v: 100000, role: 'input' }, B2: { v: 50000, role: 'input' },
    B3: { f: '=B1-B2-B4', role: 'given' }, B4: { f: '=5%*B3', role: 'given' }, B5: { f: '=B3+B4' },
  }
  const s = sheetOf(cells)
  assert.equal(s.iterative, false)
  assert.equal(s.display('B3'), '#CYCLE!')
  assert.equal(s.display('B4'), '#CYCLE!')
  s.setIterative(true)
  assert.equal(s.iterative, true)
  near(num(s, 'B3'), 50000 / 1.05, 0.01)
  near(num(s, 'B4'), 0.05 * 50000 / 1.05, 0.01)
  near(num(s, 'B5'), 50000, 0.01)
  assert.equal(s.raw('B4'), '=5%*B3')
  assert.deepEqual(s.state(), { edits: {}, iterative: true })
  s.set('B1', '200000')
  near(num(s, 'B3'), 150000 / 1.05, 0.01)
  s.undo()
  near(num(s, 'B3'), 50000 / 1.05, 0.01)
  s.setIterative(false)
  assert.equal(s.display('B3'), '#CYCLE!')
  // the spec can start with iteration on; the state round-trips it
  const on = sheetOf(cells, { iterative: true })
  near(num(on, 'B4'), 0.05 * 50000 / 1.05, 0.01)
  assert.deepEqual(on.state(), { edits: {} })
  on.setIterative(false)
  const off = createLabSheet({ rows: 30, cols: 10, cells, iterative: true }, { state: on.state() })
  assert.equal(off.iterative, false)
  assert.equal(off.display('B3'), '#CYCLE!')
})

test('goal seek: Excel messages, value written as one undo step', () => {
  const s = sheetOf(fvCells())
  const v = s.version
  const r = runGoalSeek(s, { setCell: 'B2', toValue: 2000, changingCell: 'B1' })
  assert.equal(r.found, true)
  assert.equal(r.message, 'Goal Seeking with Cell B2 found a solution.')
  near(r.value, 2 ** 0.1 - 1, 1e-7)
  near(num(s, 'B2'), 2000, 1e-4)
  assert.equal(s.version, v + 1)
  assert.equal(s.raw('B1'), String(r.value))
  s.undo()
  near(num(s, 'B1'), 0.05)
  assert.equal(runGoalSeek(s, { setCell: 'B1', toValue: 3, changingCell: 'B4' }).message, 'Cell must contain a formula.')
  assert.equal(runGoalSeek(s, { setCell: 'B2', toValue: 3, changingCell: 'E1' }).message, 'Cell must contain a value.')
  const never = runGoalSeek(s, { setCell: 'B2', toValue: -5, changingCell: 'B4' })
  assert.equal(never.found, false)
  assert.equal(never.message, 'Goal Seeking with Cell B2 may not have found a solution.')
  near(num(s, 'B4'), 10)
  assert.deepEqual(applyTool(s, 'goalseek', { setCell: 'B2', toValue: 2000, changingCell: 'B4' }), { ok: true })
  near(num(s, 'B2'), 2000, 1e-4)
})

const productMix = (): LabSheet => sheetOf({
  A2: { v: 'Units', role: 'label' }, B2: { v: 0, role: 'input' }, C2: { v: 0, role: 'input' },
  B3: { v: 30, role: 'given' }, C3: { v: 40, role: 'given' }, B4: { f: '=SUMPRODUCT(B3:C3,B2:C2)', role: 'given' },
  B6: { v: 2 }, C6: { v: 3 }, D6: { f: '=SUMPRODUCT(B6:C6,$B$2:$C$2)' }, E6: { v: 120 },
  B7: { v: 4 }, C7: { v: 2 }, D7: { f: '=SUMPRODUCT(B7:C7,$B$2:$C$2)' }, E7: { v: 160 },
  D8: { f: '=B2' }, E8: { v: 35 },
})

test('solver: product-mix LP with range constraints, one undo step', () => {
  const s = productMix()
  const v = s.version
  const r = runSolver(s, { objective: 'B4', sense: 'max', changing: 'B2:C2', constraints: [{ lhs: 'D6:D8', relation: '<=', rhs: 'E6:E8' }], engine: 'simplex' })
  assert.equal(r.status, 'optimal')
  assert.equal(r.message, SOLVER_MESSAGES.optimal)
  near(r.objective, 1700, 1e-6)
  assert.deepEqual(s.values('B2:C2'), [[30, 20]])
  assert.equal(s.version, v + 1)
  s.undo()
  assert.deepEqual(s.values('B2:C2'), [[0, 0]])
  const infeasible = runSolver(s, { objective: 'B4', sense: 'max', changing: 'B2:C2', constraints: [{ lhs: 'B2', relation: '>=', rhs: 50 }, { lhs: 'B2', relation: '<=', rhs: 'E8' }], engine: 'simplex' })
  assert.equal(infeasible.status, 'infeasible')
  assert.equal(infeasible.message, 'Solver could not find a feasible solution.')
  assert.deepEqual(s.values('B2:C2'), [[0, 0]])
  const unbounded = runSolver(s, { objective: 'B4', sense: 'max', changing: 'B2:C2', constraints: [], engine: 'simplex' })
  assert.equal(unbounded.status, 'unbounded')
  const min = runSolver(s, { objective: 'B4', sense: 'min', changing: 'B2:C2', constraints: [{ lhs: 'D6', relation: '>=', rhs: 60 }], engine: 'simplex' })
  assert.equal(min.status, 'optimal')
  near(min.objective, 800, 1e-6)
  assert.equal(runSolver(s, { objective: 'B3', sense: 'max', changing: 'B2:C2', constraints: [] }).message, 'The Objective Cell must contain a formula.')
  assert.match(runSolver(s, { objective: 'B4', sense: 'max', changing: 'B2:D6', constraints: [] }).message, /locked|formula/)
  assert.deepEqual(applyTool(s, 'solver', { objective: 'B4', sense: 'max', changing: 'B2:C2', constraints: [{ lhs: 'D6:D8', relation: '<=', rhs: 'E6:E8' }] }), { ok: true })
  near(num(s, 'B4'), 1700, 1e-6)
})

test('solver: integer and binary constraints, Value Of', () => {
  const s = sheetOf({
    B2: { v: 0 }, C2: { v: 0 }, B3: { v: 120 }, C3: { v: 190 }, B4: { f: '=SUMPRODUCT(B3:C3,B2:C2)' },
    B6: { v: 1 }, C6: { v: 1 }, D6: { f: '=SUMPRODUCT(B6:C6,$B$2:$C$2)' }, B7: { v: 1.4 }, C7: { v: 2.6 }, D7: { f: '=SUMPRODUCT(B7:C7,$B$2:$C$2)' },
    B8: { v: 25 }, C8: { v: 60 }, D8: { f: '=SUMPRODUCT(B8:C8,$B$2:$C$2)' },
  })
  const base = { objective: 'B4', sense: 'max' as const, changing: 'B2:C2', engine: 'simplex' as const }
  const caps = [{ lhs: 'D6', relation: '<=' as const, rhs: 60 }, { lhs: 'D7', relation: '<=' as const, rhs: 115 }, { lhs: 'D8', relation: '<=' as const, rhs: 2500 }]
  const r = runSolver(s, { ...base, constraints: [...caps, { lhs: 'B2:C2', relation: 'int' }] })
  assert.equal(r.status, 'optimal')
  assert.deepEqual(s.values('B2:C2'), [[32, 27]])
  near(r.objective, 8970, 1e-6)
  assert.match(runSolver(s, { ...base, constraints: [{ lhs: 'D6', relation: 'int' }] }).message, /variable cells/)
  // knapsack with binary picks
  const k = sheetOf({
    A1: { v: 12 }, A2: { v: 7 }, A3: { v: 11 }, A4: { v: 8 }, B1: { v: 24 }, B2: { v: 13 }, B3: { v: 23 }, B4: { v: 15 },
    D1: { f: '=SUMPRODUCT(A1:A4,C1:C4)' }, D2: { f: '=SUMPRODUCT(B1:B4,C1:C4)' },
  })
  const kr = runSolver(k, { objective: 'D2', sense: 'max', changing: 'C1:C4', constraints: [{ lhs: 'C1:C4', relation: 'bin' }, { lhs: 'D1', relation: '<=', rhs: 26 }], engine: 'simplex' })
  assert.equal(kr.status, 'optimal')
  assert.equal(kr.objective, 51)
  assert.ok(k.values('C1:C4').flat().every((x) => x === 0 || x === 1))
  // Value Of: make the objective hit a number
  const p = productMix()
  const vr = runSolver(p, { objective: 'B4', sense: 'value', valueOf: 900, changing: 'B2:C2', constraints: [{ lhs: 'D6:D8', relation: '<=', rhs: 'E6:E8' }], engine: 'simplex' })
  assert.equal(vr.status, 'optimal')
  near(num(p, 'B4'), 900, 1e-6)
})

test('solver: GRG non-linear price-demand profit; Simplex LP refuses non-linear models', () => {
  const cells: Record<string, CellSpec> = {
    A1: { v: 'Price', role: 'label' }, B1: { role: 'input' }, B2: { f: '=1000-20*B1' }, B3: { f: '=(B1-10)*B2' },
  }
  const s = sheetOf(cells)
  const lp = runSolver(s, { objective: 'B3', sense: 'max', changing: 'B1', constraints: [], engine: 'simplex' })
  assert.equal(lp.status, 'failed')
  assert.equal(lp.message, 'The linearity conditions required by this LP Solver are not satisfied.')
  assert.equal(s.raw('B1'), '')
  const r = runSolver(s, { objective: 'B3', sense: 'max', changing: 'B1', constraints: [], engine: 'grg' })
  assert.equal(r.status, 'optimal')
  near(num(s, 'B1'), 30, 1e-3)
  near(r.objective, 8000, 1e-3)
  assert.match(r.message, /Solver found a solution/)
  // with a capacity constraint on demand: price must keep demand <= 300 -> p >= 35
  const c = sheetOf(cells)
  const rc = runSolver(c, { objective: 'B3', sense: 'max', changing: 'B1', constraints: [{ lhs: 'B2', relation: '<=', rhs: 300 }], engine: 'grg' })
  assert.equal(rc.status, 'optimal')
  near(num(c, 'B1'), 35, 1e-3)
  near(num(c, 'B3'), 7500, 0.1)
})

test('state round trip reproduces raw entries and values', () => {
  const spec: SheetSpec = { rows: 20, cols: 8, seed: 7, cells: { ...fvCells(), H1: { v: 'given', role: 'given' }, A15: { f: '=RANDBETWEEN(1,6)' }, A16: { v: 'old' } } }
  const s = createLabSheet(spec)
  s.set('B1', '6%')
  s.set('A16', '')
  s.set('B15', '=A15*2')
  s.set('C15', '$1,200.50')
  s.set('C16', "'0042")
  s.setFmt('B15', '0.0')
  s.addDataTable({ range: 'D1:F4', colInput: 'B1' })
  s.setHiddenRows([3, 2, 99])
  const st = s.state()
  assert.deepEqual(st.edits, { B1: '6%', B15: '=A15*2', C15: '$1,200.50', A16: '', C16: "'0042" })
  assert.deepEqual(st.fmts, { B1: '0%', B15: '0.0', C15: '$#,##0.00' })
  assert.deepEqual(st.hiddenRows, [2, 3])
  assert.deepEqual(st.dataTables, [{ range: 'D1:F4', colInput: 'B1' }])
  const copy = createLabSheet(spec, { state: JSON.parse(JSON.stringify(st)) })
  for (let r = 1; r <= 20; r++) {
    for (const col of 'ABCDEFGH') {
      const ref = `${col}${r}`
      assert.equal(copy.raw(ref), s.raw(ref), `raw ${ref}`)
      assert.deepEqual(copy.values(ref), s.values(ref), `value ${ref}`)
      assert.equal(copy.display(ref), s.display(ref), `display ${ref}`)
    }
  }
  assert.deepEqual(copy.state(), st)
  assert.deepEqual([...copy.hiddenRows], [2, 3])
  assert.equal(copy.canUndo(), false)
  // bad saved state never throws: locked and out-of-sheet edits and broken tables are skipped
  const odd = createLabSheet(spec, { state: { edits: { H1: 'x', Z99: '1', B4: '=1+' }, dataTables: [{ range: 'Q1' }], hiddenRows: [-1] } })
  assert.equal(odd.raw('H1'), 'given')
  assert.equal(odd.dataTables.length, 0)
})

test('writeCells force, fill upwards, applyTool dispatch and table removal by any cell', () => {
  const s = sheetOf({ ...fvCells(), A10: { v: 'fixed', role: 'given' }, B10: { v: 3 }, B9: { role: 'answer' }, B8: { role: 'answer' }, B7: { f: '=B10*2' } })
  assert.equal(writeCells(s, { A10: 'changed' }).ok, false)
  assert.deepEqual(writeCells(s, { A10: 'changed' }, { force: true }), { ok: true })
  assert.equal(s.raw('A10'), 'changed')
  s.undo()
  assert.equal(s.raw('A10'), 'fixed')
  assert.equal(writeCells(s, { B9: '=SUM(' }).ok, false)
  assert.deepEqual(s.fill('B7', 'B5:B7'), { ok: true }) // upwards, like dragging the fill handle up
  assert.equal(s.raw('B5'), '=B8*2')
  assert.equal(s.raw('B6'), '=B9*2')
  assert.deepEqual(applyTool(s, 'datatable', { range: 'D1:F4', colInput: 'B1' }), { ok: true })
  assert.equal(s.dataTables.length, 1)
  s.removeDataTable('E3')
  assert.equal(s.dataTables.length, 0)
  assert.equal(applyTool(s, 'nope' as never, {}).ok, false)
  assert.equal(applyTool(s, 'solver', { objective: 'B2', sense: 'max', changing: 'B1', constraints: [], engine: 'simplex' }).ok, false)
})

test('dynamic arrays: spilled cells have no content of their own, so undo and state keep the spill', () => {
  const s = sheetOf({ A1: { f: '=SEQUENCE(3)' }, C1: { v: 4 }, C2: { v: 9 } })
  assert.deepEqual(s.values('A1:A3'), [[1], [2], [3]])
  assert.equal(s.raw('A2'), '')
  assert.deepEqual(s.read('A2'), { kind: 'number', value: 2 })
  assert.deepEqual(s.state(), { edits: {} })
  assert.deepEqual(s.set('A2', '5'), { ok: true })
  assert.equal(s.display('A1'), '#SPILL!')
  s.undo()
  assert.deepEqual(s.values('A1:A3'), [[1], [2], [3]])
  s.set('B1', '=C1:C2*2')
  assert.deepEqual(s.values('B1:B2'), [[8], [18]])
  const copy = createLabSheet({ rows: 30, cols: 10, cells: { A1: { f: '=SEQUENCE(3)' }, C1: { v: 4 }, C2: { v: 9 } } }, { state: s.state() })
  assert.deepEqual(copy.state(), { edits: { B1: '=C1:C2*2' } })
  assert.deepEqual(copy.values('A1:B3'), s.values('A1:B3'))
})

test('version and subscribe: one bump per mutation, none for failures or reads', () => {
  const s = sheetOf({ A1: { v: 1, role: 'given' } })
  let calls = 0
  const off = s.subscribe(() => { calls += 1 })
  s.set('B1', '5')
  s.setValues('C1', [[1, 2]])
  s.fill('B1', 'B1:B3')
  s.setFmt('B1', '0.00')
  s.copy('B1')
  s.paste('D1')
  s.clear('D1')
  s.undo()
  s.redo()
  s.recalc()
  s.setHiddenRows([2])
  s.setIterative(true)
  assert.equal(calls, 11) // copy() changes nothing
  assert.equal(s.version, 11)
  s.set('A1', '2')
  s.set('B2', '=SUM(')
  s.raw('B1')
  s.state()
  assert.equal(calls, 11)
  off()
  s.set('B1', '6')
  assert.equal(calls, 11)
  assert.equal(s.version, 12)
  s.destroy()
  assert.equal(s.set('B1', '1').ok, false)
  assert.equal(s.raw('B1'), '')
})
