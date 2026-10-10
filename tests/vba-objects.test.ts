// vba-objects.test.ts - the lab host (labHost.ts) and the Excel object model (objects*.ts) on real LabSheets.
// Run: npx tsx --test tests/vba-objects.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet } from '../src/lab/sheet.ts'
import { createLabHost, DEFAULT_CLOCK } from '../src/lab/vba/labHost.ts'
import type { LabHost, LabHostOptions } from '../src/lab/vba/labHost.ts'
import { excelScope } from '../src/lab/vba/objects.ts'
import { bool, dbl, int, lng, str, VbaError } from '../src/lab/vba/runtime.ts'
import type { GlobalScope, RunCtx, Val, VbaObject } from '../src/lab/vba/runtime.ts'
import type { CellSpec, LabSheet } from '../src/lab/types.ts'
import { runModule } from '../src/lab/vba/interpreterCore.ts'
import type { RunResult } from '../src/lab/vba/interpreterCore.ts'
import { parse } from './vbaCoreHarness.ts'

interface Lab { sheet: LabSheet; host: LabHost; scope: GlobalScope; ctx: RunCtx }

function lab(cells: Record<string, CellSpec> = {}, opts: LabHostOptions = {}, size: [number, number] = [20, 8]): Lab {
  const sheet = createLabSheet({ rows: size[0], cols: size[1], cells })
  const host = createLabHost(sheet, opts)
  const ctx: RunCtx = { host, compareText: false, err: { number: 0, description: '', source: '' } }
  return { sheet, host, scope: excelScope(host), ctx }
}

// call a global: G(l, 'Range', str('A1'))
function G(l: Lab, name: string, ...args: Val[]): Val {
  const g = l.scope.get(name.toLowerCase())
  if (!g) throw new Error(`no global ${name}`)
  if (g.kind === 'fn') return g.fn(l.ctx, args, {})
  if (g.kind === 'obj') return { t: 'obj', v: g.get(l.ctx) }
  return g.value
}
const o = (v: Val): VbaObject => {
  assert.equal(v.t, 'obj')
  return (v as { v: VbaObject }).v
}
const R = (l: Lab, ...addr: string[]): VbaObject => o(G(l, 'Range', ...addr.map(str)))
const C = (l: Lab, r: number, c: number): VbaObject => o(G(l, 'Cells', lng(r), lng(c)))
const get = (x: VbaObject, name: string, ...args: Val[]): Val => x.get(name, args, {})
const getN = (x: VbaObject, name: string, named: Record<string, Val>, ...args: Val[]): Val => x.get(name, args, named)
const call = (x: VbaObject, name: string, named: Record<string, Val> = {}, ...args: Val[]): Val => x.call(name, args, named)
const set = (x: VbaObject, name: string, value: Val): void => x.set(name, [], value)
const addr = (x: VbaObject, ...args: Val[]): string => (get(x, 'Address', ...args) as { v: string }).v
const xl = (l: Lab, name: string): Val => G(l, name)
const plain = (v: Val): unknown => {
  if (v.t === 'arr') return Array.from({ length: v.v.dims[0].hi - v.v.dims[0].lo + 1 }, (_, i) => {
    const w = v.v.dims.length === 2 ? v.v.dims[1].hi - v.v.dims[1].lo + 1 : v.v.data.length
    return v.v.data.slice(i * w, i * w + w).map(plain)
  })
  return 'v' in v ? v.v : v.t
}
function throwsVba(fn: () => unknown, number: number, text?: RegExp): void {
  assert.throws(fn, (e: unknown) => {
    if (!(e instanceof VbaError)) assert.fail(`expected VbaError, got ${String(e)}`)
    assert.equal(e.number, number, e.message)
    if (text) assert.match(e.description, text)
    return true
  })
}

const LIST: Record<string, CellSpec> = {
  A1: { v: 'Name', role: 'header' }, B1: { v: 'Qty', role: 'header' },
  A2: { v: 'Ann' }, B2: { v: 3 }, A3: { v: 'Bo' }, B3: { v: 5 }, A4: { v: 'Cy' }, B4: { v: 7 },
  A7: { v: 'Dee' }, B7: { v: 2 },
}

// ---------- lab host ----------

test('host: writes are visible at once and formulas recalculate, without touching undo or version', () => {
  const l = lab({ A1: { v: 2 }, B1: { f: '=A1*10' } })
  l.host.setValue(1, 1, 7)
  assert.equal(l.host.value(1, 2), 70)
  assert.equal(l.sheet.read('B1').value, 70)
  assert.equal(l.sheet.version, 0)
  assert.equal(l.sheet.canUndo(), false)
})

test('host: finish applies the whole run as one undo step and bumps the version once', () => {
  const l = lab({ A1: { v: 2 }, B1: { f: '=A1*10' } })
  let calls = 0
  l.sheet.subscribe(() => { calls += 1 })
  l.host.setValue(1, 1, 5)
  l.host.setFormula(2, 1, '=A1+1')
  l.host.setValue(3, 3, 'text')
  assert.deepEqual(l.host.finish(), { ok: true })
  assert.equal(calls, 1)
  assert.deepEqual(l.sheet.state().edits, { A1: '5', A2: '=A1+1', C3: 'text' })
  assert.equal(l.sheet.read('B1').value, 50)
  l.sheet.undo()
  assert.deepEqual(l.sheet.state().edits, {})
  assert.equal(l.sheet.canUndo(), false)
  assert.equal(l.sheet.read('B1').value, 20)
})

test('host: finish is idempotent, a run with no change adds no undo step, writes after finish fail', () => {
  const l = lab({ A1: { v: 2 } })
  l.host.setValue(1, 1, 2)
  assert.deepEqual(l.host.finish(), { ok: true })
  assert.deepEqual(l.host.finish(), { ok: true })
  assert.equal(l.sheet.canUndo(), false)
  throwsVba(() => l.host.setValue(1, 1, 3), 1004)
})

test('host: a value written and then put back is no change at all', () => {
  const l = lab({ A1: { v: 2 } })
  l.host.setValue(1, 1, 9)
  l.host.setValue(1, 1, 2)
  l.host.finish()
  assert.equal(l.sheet.canUndo(), false)
})

test('host: locked cells raise 1004 "The cell is protected" and nothing is written', () => {
  const l = lab({ A1: { v: 'Title', role: 'label' }, B1: { v: 4, role: 'given' }, C1: { v: 1, role: 'input' } })
  throwsVba(() => l.host.setValue(1, 1, 'x'), 1004, /The cell is protected/)
  throwsVba(() => l.host.setFormula(1, 2, '=1'), 1004, /protected.*B1/)
  l.host.setValue(1, 3, 2) // inputs are editable
  throwsVba(() => l.host.clear(1, 1, 1, 3, 'contents'), 1004, /protected/)
  assert.equal(l.host.value(1, 3), 2)
  l.host.finish()
  assert.deepEqual(l.sheet.state().edits, { C1: '2' })
})

test('host: NOW() and TODAY() read the mock clock during the run, the real clock after it', () => {
  const l = lab({ A1: { f: '=NOW()' }, A2: { f: '=TODAY()' } }, { clock: 46100.5 })
  assert.equal(l.host.value(1, 1), 46100.5)
  assert.equal(l.host.value(2, 1), 46100)
  assert.equal(l.host.now(), 46100.5)
  assert.equal(l.host.evaluate('=NOW()'), 46100.5)
  l.host.finish()
  assert.ok((l.sheet.read('A1').value as number) > 46200, 'real clock after the run')
  const d = lab({ A1: { f: '=NOW()' } })
  assert.equal(d.host.now(), DEFAULT_CLOCK)
  assert.equal(d.host.value(1, 1), DEFAULT_CLOCK)
})

test('host: evaluate leaves no trace', () => {
  const l = lab({ A1: { v: 2 }, A2: { v: 3 } })
  assert.equal(l.host.evaluate('=SUM(A1:A2)'), 5)
  assert.equal(l.host.evaluate('=1/0'), '#DIV/0!')
  assert.equal(l.host.evaluate('=SUM('), '#NAME?')
  assert.equal(l.sheet.version, 0)
  l.host.finish()
  assert.equal(l.sheet.canUndo(), false)
})

test('host: MsgBox and Debug.Print lines are collected in order; replies are scripted or the first button', () => {
  const l = lab({}, { msgBoxReplies: [7] })
  assert.equal(l.host.msgBox('Delete?', 4, 'Q'), 7)
  l.host.print('debug 1')
  assert.equal(l.host.msgBox('Again?', 4, 'Q'), 6)
  assert.equal(l.host.msgBox('Done', 0, 'Q'), 1)
  assert.equal(l.host.msgBox('Sure?', 1, 'Q'), 1)
  assert.deepEqual(l.host.messages, ['Delete?', 'debug 1', 'Again?', 'Done', 'Sure?'])
})

test('host: InputBox takes scripted answers, then the prompt callback, else Cancel', () => {
  const asked: string[] = []
  const l = lab({}, { inputs: ['2.5', ''], prompt: (t, d) => { asked.push(t); return d === 'x' ? null : 'typed' } })
  assert.equal(l.host.inputBox('a', 'T', ''), '2.5')
  assert.equal(l.host.inputBox('b', 'T', ''), '')
  assert.equal(l.host.inputBox('c', 'T', ''), 'typed')
  assert.equal(l.host.inputBox('d', 'T', 'x'), null)
  assert.deepEqual(asked, ['c', 'd'])
  assert.equal(lab().host.inputBox('e', 'T', ''), null)
})

test('host: selection comes from the options; Rnd is deterministic per seed', () => {
  const l = lab({}, { selection: 'b2:c4', activeCell: 'c3', seed: 7 })
  assert.deepEqual(l.host.selection(), { range: 'B2:C4', active: 'C3' })
  l.host.select('D5', 'D5')
  assert.deepEqual(l.host.finalSelection(), { range: 'D5', active: 'D5' })
  assert.deepEqual(lab({}, { selection: 'E2:E9' }).host.selection(), { range: 'E2:E9', active: 'E2' })
  const a = [l.host.random(), l.host.random()]
  const m = lab({}, { seed: 7 })
  assert.deepEqual([m.host.random(), m.host.random()], a)
  assert.ok(a.every((x) => x >= 0 && x < 1))
})

test('host: typed text keeps its format, number formats and styles survive, bad formulas raise 1004', () => {
  const l = lab({ C1: { fmt: '0.00' } })
  l.host.setFormula(1, 1, '12%')
  assert.equal(l.host.value(1, 1), 0.12)
  assert.equal(l.host.numberFormat(1, 1), '0%')
  l.host.setFormula(2, 1, "'00123")
  assert.equal(l.host.value(2, 1), '00123')
  l.host.setNumberFormat(1, 2, '0.0')
  l.host.setNumberFormat(1, 3, 'General')
  l.host.setStyle(1, 2, { bold: true })
  assert.deepEqual(l.host.style(1, 2), { bold: true })
  throwsVba(() => l.host.setFormula(3, 1, '=SUM(A1'), 1004)
  l.host.finish()
  assert.equal(l.sheet.fmt('A1'), '0%')
  assert.equal(l.sheet.fmt('B1'), '0.0')
  assert.equal(l.sheet.fmt('C1'), 'General')
  assert.equal(l.sheet.raw('A2'), "'00123")
  assert.equal(l.host.styles.get('B1')?.bold, true)
  l.sheet.undo()
  assert.deepEqual(l.sheet.state().edits, {}, 'the first undo removes the cell values')
})

// ---------- Range basics ----------

test('Range: Value read/write, default member, case-insensitive members, strings parse like typing', () => {
  const l = lab({ A1: { v: 4 } })
  const a1 = R(l, 'a1')
  assert.deepEqual(get(a1, 'Value'), dbl(4))
  assert.deepEqual(get(a1, 'VALUE'), dbl(4))
  assert.deepEqual(a1.defaultGet?.([]), dbl(4))
  set(R(l, 'B1'), 'value', str('Arrived'))
  a1.defaultSet?.([], int(9))
  set(R(l, 'C1'), 'Value', str('=A1*2'))
  set(R(l, 'D1'), 'Value', str('00123'))
  set(R(l, 'E1'), 'Value', bool(true))
  assert.equal(l.host.value(1, 2), 'Arrived')
  assert.equal(l.host.value(1, 1), 9)
  assert.equal(l.host.value(1, 3), 18)
  assert.equal(l.host.formula(1, 3), '=A1*2')
  assert.equal(l.host.value(1, 4), 123)
  assert.equal(l.host.value(1, 5), true)
  set(R(l, 'B1'), 'Value', { t: 'empty' })
  assert.equal(l.host.value(1, 2), null)
})

test('Range: multi-cell Value reads a 1-based 2-D array (row-major)', () => {
  const l = lab(LIST)
  const v = get(R(l, 'A2:B4'), 'Value')
  assert.equal(v.t, 'arr')
  if (v.t !== 'arr') return
  assert.deepEqual(v.v.dims, [{ lo: 1, hi: 3 }, { lo: 1, hi: 2 }])
  assert.deepEqual(plain(v), [['Ann', 3], ['Bo', 5], ['Cy', 7]])
})

test('Range: writing arrays follows Excel: exact fit, broadcast row/column, #N/A outside the array', () => {
  const l = lab()
  const arr = (rows: unknown[][]): Val => {
    const data = rows.flat().map((x) => (typeof x === 'number' ? dbl(x) : str(String(x))))
    return { t: 'arr', v: { dims: [{ lo: 1, hi: rows.length }, { lo: 1, hi: rows[0].length }], data, elemType: 'Variant', fixed: false } }
  }
  set(R(l, 'A1:B2'), 'Value', arr([[1, 2], [3, 4]]))
  assert.deepEqual(l.sheet.values('A1:B2'), [[1, 2], [3, 4]])
  const oneD: Val = { t: 'arr', v: { dims: [{ lo: 0, hi: 2 }], data: [dbl(7), dbl(8), dbl(9)], elemType: 'Variant', fixed: false } }
  set(R(l, 'D1:F2'), 'Value', oneD)
  assert.deepEqual(l.sheet.values('D1:F2'), [[7, 8, 9], [7, 8, 9]])
  set(R(l, 'A4:C5'), 'Value', arr([[1, 2], [3, 4]]))
  assert.deepEqual(l.sheet.values('A4:C5'), [[1, 2, '#N/A'], [3, 4, '#N/A']])
  set(R(l, 'A7:B9'), 'Value', arr([[5], [6]]))
  assert.deepEqual(l.sheet.values('A7:B9'), [[5, 5], [6, 6], ['#N/A', '#N/A']])
  set(R(l, 'E5:F6'), 'Value', dbl(1))
  assert.deepEqual(l.sheet.values('E5:F6'), [[1, 1], [1, 1]])
})

test('Range: Range("A1", "B5") and Range(Cells(1, 1), Cells(5, 2)) span both corners', () => {
  const l = lab()
  assert.equal(addr(R(l, 'B5', 'A1')), '$A$1:$B$5')
  assert.equal(addr(o(G(l, 'Range', G(l, 'Cells', lng(1), lng(1)), G(l, 'Cells', lng(5), lng(2))))), '$A$1:$B$5')
  assert.equal(addr(R(l, '$c$3')), '$C$3')
  assert.equal(addr(R(l, 'A1:B2,D4')), '$A$1:$B$2,$D$4')
  assert.equal(addr(R(l, 'Sheet1!B2')), '$B$2')
  throwsVba(() => R(l, 'Total'), 1004, /not a cell address/)
  throwsVba(() => R(l, 'Other!A1'), 1004)
})

test('Cells: Cells(r, c), Cells(1, "B"), Cells(n), Cells.Count; off the grid is 1004', () => {
  const l = lab({}, {}, [10, 4])
  assert.equal(addr(C(l, 3, 2)), '$B$3')
  assert.equal(addr(o(G(l, 'Cells', lng(1), str('C')))), '$C$1')
  assert.equal(addr(o(G(l, 'Cells', lng(6)))), '$B$2')
  assert.deepEqual(get(o(G(l, 'Cells')), 'Count'), lng(40))
  throwsVba(() => C(l, 11, 1), 1004, /outside the lab sheet \(A1:D10\)/)
  throwsVba(() => C(l, 0, 1), 1004)
})

test('Range: .Cells(i, j) and r(i) count from the range top-left (and may leave it)', () => {
  const l = lab()
  const r = R(l, 'B2:D4')
  assert.equal(addr(o(get(r, 'Cells', lng(2), lng(3)))), '$D$3')
  assert.equal(addr(o(r.defaultGet?.([lng(4)]) as Val)), '$B$3')
  assert.equal(addr(o(get(r, 'Item', lng(1), lng(1)))), '$B$2')
  assert.equal(addr(o(get(r, 'Cells', lng(5), lng(1)))), '$B$6')
  r.defaultSet?.([lng(2)], dbl(42))
  assert.equal(l.host.value(2, 3), 42)
})

test('Rows/Columns: Rows(n), Columns("B"), counts of a range and of the sheet, EntireRow/EntireColumn', () => {
  const l = lab({}, {}, [30, 6])
  assert.deepEqual(get(o(G(l, 'Rows')), 'Count'), lng(30))
  assert.deepEqual(get(o(G(l, 'Columns')), 'Count'), lng(6))
  assert.equal(addr(o(G(l, 'Rows', lng(3)))), '$3:$3')
  assert.deepEqual(get(o(G(l, 'Rows', lng(3))), 'Count'), lng(1))
  assert.equal(addr(o(G(l, 'Columns', str('B')))), '$B:$B')
  assert.equal(addr(o(G(l, 'Columns', str('A:C')))), '$A:$C')
  assert.equal(addr(o(G(l, 'Rows', str('2:4')))), '$2:$4')
  const r = R(l, 'A1:C5')
  assert.deepEqual(get(o(get(r, 'Rows')), 'Count'), lng(5))
  assert.deepEqual(get(o(get(r, 'Columns')), 'Count'), lng(3))
  assert.deepEqual(get(r, 'Count'), lng(15))
  assert.equal(addr(o(get(r, 'Rows', lng(2)))), '$A$2:$C$2')
  assert.equal(addr(o(get(R(l, 'B3'), 'EntireRow'))), '$3:$3')
  assert.equal(addr(o(get(R(l, 'B3:C4'), 'EntireColumn'))), '$B:$C')
  assert.deepEqual(get(o(get(R(l, 'B3:B5'), 'EntireRow')), 'Count'), lng(3))
  assert.equal(addr(o(get(o(G(l, 'Rows', lng(3))), 'Offset', lng(1), lng(0)))), '$4:$4')
})

test('Offset and Resize; moving off the grid raises 1004', () => {
  const l = lab({}, {}, [12, 6])
  assert.equal(addr(o(get(R(l, 'B3'), 'Offset', lng(2), lng(3)))), '$E$5')
  assert.equal(addr(o(getN(R(l, 'B3'), 'Offset', { ColumnOffset: lng(1) }))), '$C$3')
  assert.equal(addr(o(get(R(l, 'B3:C4'), 'Offset', lng(-1), lng(0)))), '$B$2:$C$3')
  assert.equal(addr(o(get(R(l, 'B3'), 'Resize', lng(2), lng(3)))), '$B$3:$D$4')
  assert.equal(addr(o(get(R(l, 'B3:C4'), 'Resize', lng(1)))), '$B$3:$C$3')
  throwsVba(() => get(R(l, 'B3'), 'Offset', lng(2), lng(5)), 1004, /Offset\(2, 5\) from B3, which is G5, is outside the lab sheet \(A1:F12\)/)
  throwsVba(() => get(R(l, 'A1'), 'Offset', lng(-1), lng(0)), 1004)
  throwsVba(() => get(R(l, 'A12'), 'Offset', lng(1), lng(0)), 1004)
  throwsVba(() => get(R(l, 'A1'), 'Resize', lng(0), lng(1)), 1004)
})

// ---------- End (Ctrl+arrow) ----------

const END_CELLS: Record<string, CellSpec> = {
  A1: { v: 'h' }, A2: { v: 1 }, A3: { v: 2 }, A4: { v: 3 }, A7: { v: 9 }, A8: { v: 9 },
  C1: { v: 1 }, D1: { v: 2 }, F1: { v: 3 },
  E5: { f: '=""' }, E6: { v: 1 },
}
const endOf = (l: Lab, from: string, dir: string): string => addr(o(get(R(l, from), 'End', xl(l, dir))), bool(false), bool(false))

test('End(xlDown): inside a block to its last cell, from the last cell over the gap, from a blank to the next filled', () => {
  const l = lab(END_CELLS, {}, [20, 6])
  assert.equal(endOf(l, 'A1', 'xlDown'), 'A4')
  assert.equal(endOf(l, 'A2', 'xlDown'), 'A4')
  assert.equal(endOf(l, 'A4', 'xlDown'), 'A7')
  assert.equal(endOf(l, 'A5', 'xlDown'), 'A7')
  assert.equal(endOf(l, 'A7', 'xlDown'), 'A8')
})

test('End(xlDown) with nothing below goes to the last row of the grid; at the edge it stays', () => {
  const l = lab(END_CELLS, {}, [20, 6])
  assert.equal(endOf(l, 'A8', 'xlDown'), 'A20')
  assert.equal(endOf(l, 'B1', 'xlDown'), 'B20')
  assert.equal(endOf(l, 'A20', 'xlDown'), 'A20')
})

test('End(xlUp) from the bottom row finds the last filled cell (Cells(Rows.Count, 1).End(xlUp))', () => {
  const l = lab(END_CELLS, {}, [20, 6])
  const rowsCount = (get(o(G(l, 'Rows')), 'Count') as { v: number }).v
  const last = o(get(C(l, rowsCount, 1), 'End', xl(l, 'xlUp')))
  assert.deepEqual(get(last, 'Row'), lng(8))
  assert.equal(endOf(l, 'A7', 'xlUp'), 'A4')
  assert.equal(endOf(l, 'A3', 'xlUp'), 'A1')
  assert.equal(endOf(l, 'A1', 'xlUp'), 'A1')
  assert.equal(endOf(l, 'B5', 'xlUp'), 'B1')
})

test('End(xlToRight)/End(xlToLeft) follow the same rules across a row', () => {
  const l = lab(END_CELLS, {}, [20, 6])
  assert.equal(endOf(l, 'C1', 'xlToRight'), 'D1')
  assert.equal(endOf(l, 'D1', 'xlToRight'), 'F1')
  assert.equal(endOf(l, 'F1', 'xlToRight'), 'F1')
  assert.equal(endOf(l, 'F1', 'xlToLeft'), 'D1')
  assert.equal(endOf(l, 'C1', 'xlToLeft'), 'A1')
  assert.equal(endOf(l, 'B2', 'xlToRight'), 'F2')
})

test('End: a formula returning "" counts as filled; a multi-cell range starts from its top-left', () => {
  const l = lab(END_CELLS, {}, [20, 6])
  assert.equal(endOf(l, 'E1', 'xlDown'), 'E5')
  assert.equal(endOf(l, 'E5', 'xlDown'), 'E6')
  assert.equal(endOf(l, 'A2:B3', 'xlDown'), 'A4')
  throwsVba(() => get(R(l, 'A1'), 'End', lng(3)), 1004)
})

test('End then Offset off the grid raises 1004 (a full list)', () => {
  const l = lab({ A1: { v: 1 }, A2: { v: 2 }, A3: { v: 3 } }, {}, [3, 2])
  throwsVba(() => get(o(get(R(l, 'A1'), 'End', xl(l, 'xlDown'))), 'Offset', lng(1), lng(0)), 1004, /outside the lab sheet/)
})

// ---------- Address, selection, relative Range ----------

test('Address: absolute by default, RowAbsolute/ColumnAbsolute, R1C1, External', () => {
  const l = lab()
  const r = R(l, 'B3:C4')
  assert.equal(addr(r), '$B$3:$C$4')
  assert.equal(addr(r, bool(false), bool(false)), 'B3:C4')
  assert.equal(addr(r, bool(true), bool(false)), 'B$3:C$4')
  assert.equal((getN(R(l, 'D2'), 'Address', { RowAbsolute: bool(false) }) as { v: string }).v, '$D2')
  assert.equal(addr(R(l, 'C2'), bool(true), bool(true), xl(l, 'xlR1C1')), 'R2C3')
  assert.equal((getN(R(l, 'C2'), 'Address', { ReferenceStyle: xl(l, 'xlR1C1'), RowAbsolute: bool(false), ColumnAbsolute: bool(false), RelativeTo: G(l, 'Range', str('A1')) }) as { v: string }).v, 'R[1]C[2]')
  assert.equal(addr(R(l, 'A1'), bool(true), bool(true), lng(1), bool(true)), '[ExcelLab.xlsm]Sheet1!$A$1')
})

test('Select and Activate drive ActiveCell and Selection; Activate inside the selection only moves the active cell', () => {
  const l = lab()
  call(R(l, 'B2:D5'), 'Select')
  assert.deepEqual(l.host.selection(), { range: 'B2:D5', active: 'B2' })
  assert.equal(addr(o(G(l, 'Selection'))), '$B$2:$D$5')
  assert.equal(addr(o(G(l, 'ActiveCell'))), '$B$2')
  call(R(l, 'C4'), 'Activate')
  assert.deepEqual(l.host.selection(), { range: 'B2:D5', active: 'C4' })
  call(R(l, 'F1'), 'Activate')
  assert.deepEqual(l.host.selection(), { range: 'F1', active: 'F1' })
  const app = o(G(l, 'Application'))
  assert.equal(addr(o(get(app, 'ActiveCell'))), '$F$1')
})

test('the recorder idiom ActiveCell.Offset(1, 0).Range("A1").Select; X.Range("B2") is X.Offset(1, 1)', () => {
  const l = lab({}, { activeCell: 'C9' })
  call(o(get(o(get(o(G(l, 'ActiveCell')), 'Offset', lng(1), lng(-2))), 'Range', str('A1'))), 'Select')
  assert.deepEqual(l.host.selection(), { range: 'A10', active: 'A10' })
  assert.equal(addr(o(get(R(l, 'C3'), 'Range', str('B2')))), '$D$4')
  assert.equal(addr(o(get(R(l, 'C3:E9'), 'Range', str('A1:B2')))), '$C$3:$D$4')
})

test('ActiveCell.Offset(0, 2).Value = x writes beside the active cell (W6 MarkArrived)', () => {
  const l = lab({ C5: { v: 'P-1' } }, { activeCell: 'C5' })
  set(o(get(o(G(l, 'ActiveCell')), 'Offset', lng(0), lng(2))), 'Value', str('Arrived'))
  call(o(get(o(G(l, 'ActiveCell')), 'Offset', lng(1), lng(0))), 'Select')
  assert.equal(l.host.value(5, 5), 'Arrived')
  assert.equal(l.host.selection().active, 'C6')
  // the assignment target may also arrive as Offset(...) = value on the parent
  o(G(l, 'ActiveCell')).set('Offset', [lng(0), lng(1)], str('x'))
  assert.equal(l.host.value(6, 4), 'x')
})

// ---------- Copy and PasteSpecial ----------

const PASTE: Record<string, CellSpec> = {
  A1: { v: 2, fmt: '0.00' }, B1: { f: '=A1*10', fmt: '$#,##0' }, C1: { v: 'txt' },
  A2: { v: 3 }, B2: { f: '=$A$2+A1' }, C2: { v: 4 },
  E1: { v: 100 }, E2: { v: 200 }, F1: { v: 5 },
}
const copyFrom = (l: Lab, range: string): void => { call(R(l, range), 'Copy') }
const paste = (l: Lab, dest: string, named: Record<string, Val>): void => { call(R(l, dest), 'PasteSpecial', named) }

test('Copy Destination:= copies values, re-based formulas and number formats; the selection stays', () => {
  const l = lab(PASTE, { activeCell: 'H1' })
  call(R(l, 'A1:B2'), 'Copy', { Destination: G(l, 'Range', str('A5')) })
  assert.equal(l.host.formula(5, 2), '=A5*10')
  assert.equal(l.host.formula(6, 2), '=$A$2+A5')
  assert.deepEqual(l.sheet.values('A5:B6'), [[2, 20], [3, 5]])
  assert.equal(l.host.numberFormat(5, 2), '$#,##0')
  assert.equal(l.host.numberFormat(5, 1), '0.00')
  assert.equal(l.host.selection().active, 'H1')
  assert.deepEqual(get(o(G(l, 'Application')), 'CutCopyMode'), bool(false))
})

test('PasteSpecial xlPasteValues writes computed values only (no formulas, no formats) and selects the paste', () => {
  const l = lab(PASTE)
  copyFrom(l, 'A1:C2')
  paste(l, 'A10', { Paste: xl(l, 'xlPasteValues') })
  assert.deepEqual(l.sheet.values('A10:C11'), [[2, 20, 'txt'], [3, 5, 4]])
  assert.equal(l.host.formula(10, 2), '20')
  assert.equal(l.host.numberFormat(10, 2), 'General')
  assert.deepEqual(l.host.selection(), { range: 'A10:C11', active: 'A10' })
})

test('PasteSpecial xlPasteFormulas re-bases relative references like Excel (F7 -> F8)', () => {
  const l = lab({ C6: { v: 1 }, C7: { v: 4 }, C8: { v: 9 }, F7: { f: '=IF(C6>C7,"",C7-C6)' } })
  copyFrom(l, 'F7')
  paste(l, 'F8', { Paste: xl(l, 'xlPasteFormulas') })
  assert.equal(l.host.formula(8, 6), '=IF(C7>C8,"",C8-C7)')
  assert.equal(l.host.value(8, 6), 5)
  assert.equal(l.host.numberFormat(8, 6), 'General')
})

test('PasteSpecial xlPasteValuesAndNumberFormats and xlPasteFormulasAndNumberFormats carry the formats', () => {
  const l = lab(PASTE)
  copyFrom(l, 'A1:B1')
  paste(l, 'A12', { Paste: xl(l, 'xlPasteValuesAndNumberFormats'), Operation: xl(l, 'xlNone'), SkipBlanks: bool(false), Transpose: bool(false) })
  assert.deepEqual(l.sheet.values('A12:B12'), [[2, 20]])
  assert.equal(l.host.formula(12, 2), '20')
  assert.equal(l.host.numberFormat(12, 2), '$#,##0')
  paste(l, 'A14', { Paste: xl(l, 'xlPasteFormulasAndNumberFormats') })
  assert.equal(l.host.formula(14, 2), '=A14*10')
  assert.equal(l.host.numberFormat(14, 1), '0.00')
})

test('PasteSpecial xlPasteFormats copies formats only; Paste defaults to xlPasteAll', () => {
  const l = lab(PASTE)
  copyFrom(l, 'A1:B1')
  paste(l, 'E1', { Paste: xl(l, 'xlPasteFormats') })
  assert.deepEqual(l.sheet.values('E1:F1'), [[100, 5]])
  assert.equal(l.host.numberFormat(1, 5), '0.00')
  assert.equal(l.host.numberFormat(1, 6), '$#,##0')
  call(R(l, 'A16'), 'PasteSpecial', {}, )
  assert.equal(l.host.formula(16, 2), '=A16*10')
  assert.equal(l.host.numberFormat(16, 2), '$#,##0')
})

test('PasteSpecial Operation, SkipBlanks and Transpose', () => {
  const l = lab({ A1: { v: 1 }, A2: { v: 2 }, B1: { v: 10 }, B2: { v: 20 }, D1: { v: 7 }, D3: { v: 8 }, E1: { v: 99 }, E2: { v: 99 }, E3: { v: 99 } })
  copyFrom(l, 'A1:A2')
  paste(l, 'B1', { Paste: xl(l, 'xlPasteValues'), Operation: xl(l, 'xlPasteSpecialOperationAdd') })
  assert.deepEqual(l.sheet.values('B1:B2'), [[11], [22]])
  paste(l, 'B1', { Paste: xl(l, 'xlPasteValues'), Operation: xl(l, 'xlPasteSpecialOperationMultiply') })
  assert.deepEqual(l.sheet.values('B1:B2'), [[11], [44]])
  copyFrom(l, 'D1:D3')
  paste(l, 'E1', { Paste: xl(l, 'xlPasteValues'), SkipBlanks: bool(true) })
  assert.deepEqual(l.sheet.values('E1:E3'), [[7], [99], [8]])
  paste(l, 'A5', { Paste: xl(l, 'xlPasteValues'), Transpose: bool(true) })
  assert.deepEqual(l.sheet.values('A5:C5'), [[7, null, 8]])
})

test('PasteSpecial needs a Copy; Application.CutCopyMode = False empties the clipboard', () => {
  const l = lab(PASTE)
  throwsVba(() => paste(l, 'A10', {}), 1004, /nothing has been copied/)
  copyFrom(l, 'A1')
  const app = o(G(l, 'Application'))
  assert.deepEqual(get(app, 'CutCopyMode'), lng(1))
  set(app, 'CutCopyMode', bool(false))
  assert.deepEqual(get(app, 'CutCopyMode'), bool(false))
  throwsVba(() => paste(l, 'A10', {}), 1004)
})

test('a paste onto locked cells raises 1004 before anything is written', () => {
  const l = lab({ A1: { v: 1 }, B1: { v: 2 }, D2: { v: 'Total', role: 'label' } })
  copyFrom(l, 'A1:B1')
  throwsVba(() => paste(l, 'C2', { Paste: xl(l, 'xlPasteValues') }), 1004, /protected.*D2/)
  assert.equal(l.host.value(2, 3), null)
})

// ---------- clearing, For Each, Intersect, Is ----------

test('ClearContents keeps formats, Clear removes both, ClearFormats keeps values', () => {
  const l = lab({ A1: { v: 1, fmt: '0.00' }, A2: { v: 2, fmt: '0.00' }, A3: { v: 3, fmt: '0.00' } })
  call(R(l, 'A1'), 'ClearContents')
  assert.equal(l.host.value(1, 1), null)
  assert.equal(l.host.numberFormat(1, 1), '0.00')
  call(R(l, 'A2'), 'Clear')
  assert.equal(l.host.value(2, 1), null)
  assert.equal(l.host.numberFormat(2, 1), 'General')
  call(R(l, 'A3'), 'ClearFormats')
  assert.equal(l.host.value(3, 1), 3)
  assert.equal(l.host.numberFormat(3, 1), 'General')
  l.host.finish()
  assert.equal(l.sheet.fmt('A1'), '0.00')
  assert.equal(l.sheet.fmt('A2'), 'General')
})

test('For Each walks cells row-major; Rows and Columns walk lines', () => {
  const l = lab()
  const cells = R(l, 'A1:B2').enumerate?.() ?? []
  assert.deepEqual(cells.map((c) => addr(o(c), bool(false), bool(false))), ['A1', 'B1', 'A2', 'B2'])
  const rows = o(get(R(l, 'A1:C2'), 'Rows')).enumerate?.() ?? []
  assert.deepEqual(rows.map((c) => addr(o(c), bool(false), bool(false))), ['A1:C1', 'A2:C2'])
  const cols = o(get(R(l, 'A1:B3'), 'Columns')).enumerate?.() ?? []
  assert.deepEqual(cols.map((c) => addr(o(c), bool(false), bool(false))), ['A1:A3', 'B1:B3'])
  const multi = R(l, 'A1:A2,C5').enumerate?.() ?? []
  assert.equal(multi.length, 3)
})

test('For Each cell ... With cell.Offset(0, 2): .Value and .NumberFormat (W9 ShowShare)', () => {
  const l = lab({ C5: { v: 165 }, C6: { v: 192 }, E2: { v: 200 } })
  for (const c of R(l, 'C5:C6').enumerate?.() ?? []) {
    const target = o(get(o(c), 'Offset', lng(0), lng(2)))
    set(target, 'Value', dbl((plain(get(o(c), 'Value')) as number) / 200))
    set(target, 'NumberFormat', str('0%'))
  }
  assert.deepEqual(l.sheet.values('E5:E6'), [[0.825], [0.96]])
  assert.deepEqual(get(R(l, 'E5'), 'Text'), str('83%'))
  l.host.finish()
  assert.equal(l.sheet.fmt('E5'), '0%')
  assert.equal(l.sheet.display('E6'), '96%')
})

test('Intersect gives the overlap or Nothing; Union joins areas; Is compares ranges', () => {
  const l = lab()
  const x = G(l, 'Intersect', G(l, 'Range', str('B2:D5')), G(l, 'Range', str('C4:F9')))
  assert.equal(addr(o(x)), '$C$4:$D$5')
  const none = G(l, 'Intersect', G(l, 'Range', str('A1')), G(l, 'Range', str('C4:C5,F4:F5')))
  assert.deepEqual(none, { t: 'obj', v: null })
  const hit = G(l, 'Intersect', G(l, 'Range', str('F5')), G(l, 'Range', str('C4:C5,F4:F5')))
  assert.equal(addr(o(hit)), '$F$5')
  assert.equal(addr(o(G(l, 'Union', G(l, 'Range', str('A1')), G(l, 'Range', str('C3:D4'))))), '$A$1,$C$3:$D$4')
  assert.equal(R(l, 'B2').sameAs?.(o(G(l, 'Cells', lng(2), lng(2)))), true)
  assert.equal(R(l, 'B2').sameAs?.(R(l, 'B3')), false)
  assert.deepEqual(get(o(get(R(l, 'A1:B2,D4'), 'Areas')), 'Count'), lng(2))
})

// ---------- Formula, Text, formats, typed values ----------

test('Formula reads and writes; a formula written to a block is re-based per cell; FormulaR1C1 both ways', () => {
  const l = lab({ A1: { v: 1 }, A2: { v: 2 }, A3: { v: 3 }, D1: { v: 'x' } })
  set(R(l, 'B1:B3'), 'Formula', str('=A1*2'))
  assert.deepEqual(l.sheet.values('B1:B3'), [[2], [4], [6]])
  assert.deepEqual(get(R(l, 'B3'), 'Formula'), str('=A3*2'))
  assert.deepEqual(get(R(l, 'A2'), 'Formula'), str('2'))
  assert.deepEqual(get(R(l, 'D1'), 'Formula'), str('x'))
  assert.deepEqual(get(R(l, 'B2'), 'FormulaR1C1'), str('=RC[-1]*2'))
  set(R(l, 'C1:C3'), 'FormulaR1C1', str('=R1C1+RC[-1]'))
  assert.deepEqual(get(R(l, 'C3'), 'Formula'), str('=$A$1+B3'))
  assert.deepEqual(l.sheet.values('C1:C3'), [[3], [5], [7]])
  assert.deepEqual(get(R(l, 'B1'), 'HasFormula'), bool(true))
  assert.deepEqual(get(R(l, 'A1:B1'), 'HasFormula'), { t: 'null' })
  set(R(l, 'E1'), 'FormulaR1C1', str('Arrived'))
  assert.equal(l.host.value(1, 5), 'Arrived')
})

test('Text shows the formatted value; NumberFormat reads per cell or Null when mixed', () => {
  const l = lab({ A1: { v: 1234.5, fmt: '$#,##0.00' }, A2: { v: 0.25, fmt: '0%' }, A3: { v: 3 } })
  assert.deepEqual(get(R(l, 'A1'), 'Text'), str('$1,234.50'))
  assert.deepEqual(get(R(l, 'A2'), 'Text'), str('25%'))
  assert.deepEqual(get(R(l, 'A1'), 'NumberFormat'), str('$#,##0.00'))
  assert.deepEqual(get(R(l, 'A3'), 'NumberFormat'), str('General'))
  assert.deepEqual(get(R(l, 'A1:A2'), 'NumberFormat'), { t: 'null' })
  set(R(l, 'A1:A3'), 'NumberFormat', str('0.0'))
  assert.deepEqual(get(R(l, 'A1:A3'), 'NumberFormat'), str('0.0'))
})

test('Value reads Date for date/time cells and Currency for currency cells; Value2 reads Double', () => {
  const l = lab({ A1: { v: 0.38, fmt: 'h:mm' }, A2: { v: 46027, fmt: 'dd-mmm-yy' }, A3: { v: 18.5, fmt: '$#,##0.00' }, A4: { v: 2 } })
  assert.deepEqual(get(R(l, 'A1'), 'Value'), { t: 'date', v: 0.38 })
  assert.deepEqual(get(R(l, 'A2'), 'Value'), { t: 'date', v: 46027 })
  assert.deepEqual(get(R(l, 'A3'), 'Value'), { t: 'currency', v: 18.5 })
  assert.deepEqual(get(R(l, 'A1'), 'Value2'), dbl(0.38))
  assert.deepEqual(get(R(l, 'A3'), 'Value2'), dbl(18.5))
  assert.deepEqual(get(R(l, 'A4'), 'Value'), dbl(2))
})

test('writing a VBA Date gives the cell a date or time format; typed text like 12% formats itself', () => {
  const l = lab({ C1: { fmt: 'hh:mm:ss' } })
  set(R(l, 'A1'), 'Value', { t: 'date', v: 46027.5 })
  set(R(l, 'A2'), 'Value', { t: 'date', v: 46027 })
  set(R(l, 'A3'), 'Value', { t: 'date', v: 0.5 })
  set(R(l, 'C1'), 'Value', { t: 'date', v: 0.25 })
  set(R(l, 'B1'), 'Value', str('12%'))
  assert.equal(l.host.numberFormat(1, 1), 'dd/mm/yyyy h:mm')
  assert.equal(l.host.numberFormat(2, 1), 'dd/mm/yyyy')
  assert.equal(l.host.numberFormat(3, 1), 'h:mm:ss AM/PM')
  assert.equal(l.host.numberFormat(1, 3), 'hh:mm:ss')
  assert.equal(l.host.value(1, 2), 0.12)
  assert.equal(l.host.numberFormat(1, 2), '0%')
  l.host.finish()
  assert.equal(l.sheet.display('A2'), '05/01/2026')
  assert.equal(l.sheet.raw('B1'), '12%')
})

test('Font and Interior: Bold, Italic, Color, ColorIndex and xlNone', () => {
  const l = lab({ A1: { v: 'Head', bold: true } })
  const font = o(get(R(l, 'A1:B1'), 'Font'))
  assert.deepEqual(font.get('Bold', [], {}), { t: 'null' }, 'A1 is bold in the spec, B1 is not')
  set(font, 'Bold', bool(true))
  set(font, 'Italic', bool(true))
  set(font, 'Color', lng(255))
  assert.deepEqual(font.get('Bold', [], {}), bool(true))
  assert.deepEqual(font.get('ColorIndex', [], {}), lng(3))
  const fill = o(get(R(l, 'A1'), 'Interior'))
  set(fill, 'ColorIndex', lng(6))
  assert.deepEqual(fill.get('Color', [], {}), dbl(65535))
  assert.deepEqual(l.host.style(1, 1), { bold: true, italic: true, fontColor: 255, fill: 65535 })
  set(fill, 'ColorIndex', xl(l, 'xlNone'))
  assert.deepEqual(fill.get('ColorIndex', [], {}), lng(-4142))
  throwsVba(() => set(fill, 'ColorIndex', lng(0)), 1004, /ColorIndex property of the Interior class/)
  set(R(l, 'A1'), 'HorizontalAlignment', xl(l, 'xlCenter'))
  assert.deepEqual(get(R(l, 'A1'), 'HorizontalAlignment'), lng(-4108))
})

test('Range writes respect locked cells: a block that touches one is refused as a whole', () => {
  const l = lab({ A1: { v: 'Name', role: 'header' }, B2: { v: 5, role: 'given' } })
  throwsVba(() => set(R(l, 'A1'), 'Value', str('x')), 1004, /The cell is protected/)
  throwsVba(() => set(R(l, 'A2:C2'), 'Value', dbl(1)), 1004, /B2/)
  assert.equal(l.host.value(2, 1), null)
  throwsVba(() => call(R(l, 'A1:B3'), 'ClearContents'), 1004, /protected/)
  assert.equal(l.host.value(2, 2), 5)
})

test('unsupported members raise 438 with the member name', () => {
  const l = lab()
  throwsVba(() => call(o(G(l, 'Columns', str('A:F'))), 'PrintOut'), 438, /Range\.PrintOut/)
  throwsVba(() => get(R(l, 'A1'), 'Foo'), 438, /Range\.Foo/)
  throwsVba(() => get(o(G(l, 'Application')), 'DisplayAlert'), 438, /Application\.DisplayAlert/)
  throwsVba(() => set(R(l, 'A1'), 'Row', lng(3)), 450)
})

// ---------- WorksheetFunction ----------

const DATA: Record<string, CellSpec> = {
  A1: { v: 'k' }, B1: { v: 'v' },
  A2: { v: 'a' }, B2: { v: 12 }, A3: { v: 'b' }, B3: { v: 7 }, A4: { v: 'c' }, B4: { v: 31 },
  A5: { v: 'b' }, B5: { v: 5 }, A6: { v: 'd' }, B6: { v: 18 }, C2: { v: 2 }, C3: { v: 3 }, C4: { v: 1 }, C5: { v: 4 }, C6: { v: 2 },
}
const wsf = (l: Lab, name: string, ...args: Val[]): Val => get(o(G(l, 'WorksheetFunction')), name, ...args)
const rg = (l: Lab, a: string): Val => G(l, 'Range', str(a))

test('WorksheetFunction results equal the sheet\'s own formulas', () => {
  const l = lab(DATA)
  const cases: [string, Val[], string][] = [
    ['Sum', [rg(l, 'B2:B6')], '=SUM(B2:B6)'],
    ['Average', [rg(l, 'B2:B6')], '=AVERAGE(B2:B6)'],
    ['Max', [rg(l, 'B2:B6'), dbl(40)], '=MAX(B2:B6,40)'],
    ['Min', [rg(l, 'B2:B6')], '=MIN(B2:B6)'],
    ['Count', [rg(l, 'A1:B6')], '=COUNT(A1:B6)'],
    ['CountA', [rg(l, 'A1:B6')], '=COUNTA(A1:B6)'],
    ['CountIf', [rg(l, 'A2:A6'), str('b')], '=COUNTIF(A2:A6,"b")'],
    ['CountIfs', [rg(l, 'A2:A6'), str('b'), rg(l, 'B2:B6'), str('>5')], '=COUNTIFS(A2:A6,"b",B2:B6,">5")'],
    ['SumIf', [rg(l, 'A2:A6'), str('b'), rg(l, 'B2:B6')], '=SUMIF(A2:A6,"b",B2:B6)'],
    ['SumIfs', [rg(l, 'B2:B6'), rg(l, 'A2:A6'), str('b')], '=SUMIFS(B2:B6,A2:A6,"b")'],
    ['SumProduct', [rg(l, 'B2:B6'), rg(l, 'C2:C6')], '=SUMPRODUCT(B2:B6,C2:C6)'],
    ['VLookup', [str('c'), rg(l, 'A2:B6'), lng(2), bool(false)], '=VLOOKUP("c",A2:B6,2,FALSE)'],
    ['HLookup', [str('v'), rg(l, 'A1:B6'), lng(3), bool(false)], '=HLOOKUP("v",A1:B6,3,FALSE)'],
    ['Match', [str('c'), rg(l, 'A2:A6'), lng(0)], '=MATCH("c",A2:A6,0)'],
    ['Index', [rg(l, 'B2:B6'), lng(4)], '=INDEX(B2:B6,4)'],
    ['Round', [dbl(2.675), lng(2)], '=ROUND(2.675,2)'],
    ['RoundUp', [dbl(2.111), lng(1)], '=ROUNDUP(2.111,1)'],
    ['RoundDown', [dbl(-2.19), lng(1)], '=ROUNDDOWN(-2.19,1)'],
    ['Large', [rg(l, 'B2:B6'), lng(2)], '=LARGE(B2:B6,2)'],
    ['Small', [rg(l, 'B2:B6'), lng(2)], '=SMALL(B2:B6,2)'],
    ['Rank', [dbl(18), rg(l, 'B2:B6')], '=RANK(18,B2:B6)'],
    ['NormInv', [dbl(0.95), dbl(100), dbl(15)], '=NORMINV(0.95,100,15)'],
    ['Norm_Inv', [dbl(0.95), dbl(100), dbl(15)], '=NORM.INV(0.95,100,15)'],
    ['NormSDist', [dbl(1.5)], '=NORMSDIST(1.5)'],
    ['Pi', [], '=PI()'],
    ['Sqrt', [dbl(2)], '=SQRT(2)'],
    ['Ln', [dbl(10)], '=LN(10)'],
    ['Exp', [dbl(1)], '=EXP(1)'],
    ['Power', [dbl(2), dbl(10)], '=POWER(2,10)'],
    ['Percentile', [rg(l, 'B2:B6'), dbl(0.9)], '=PERCENTILE(B2:B6,0.9)'],
    ['StDev', [rg(l, 'B2:B6')], '=STDEV(B2:B6)'],
    ['Median', [rg(l, 'B2:B6')], '=MEDIAN(B2:B6)'],
    ['Mode', [rg(l, 'C2:C6')], '=MODE(C2:C6)'],
    ['IsNumber', [rg(l, 'B2')], '=ISNUMBER(B2)'],
    ['Trend', [rg(l, 'B2:B6'), rg(l, 'C2:C6'), dbl(5)], '=TREND(B2:B6,C2:C6,5)'],
  ]
  for (const [name, args, formula] of cases) {
    const got = plain(wsf(l, name, ...args))
    const want = l.host.evaluate(formula)
    assert.equal(got, want, `${name}: ${String(got)} vs ${formula} = ${String(want)}`)
  }
})

test('WorksheetFunction: case-insensitive names, Application.WorksheetFunction, arrays as arguments', () => {
  const l = lab(DATA)
  assert.deepEqual(wsf(l, 'sum', rg(l, 'B2:B3')), dbl(19))
  const app = o(G(l, 'Application'))
  assert.deepEqual(get(o(get(app, 'WorksheetFunction')), 'Max', rg(l, 'B2:B6')), dbl(31))
  const arr: Val = { t: 'arr', v: { dims: [{ lo: 0, hi: 2 }], data: [dbl(1), dbl(2), dbl(3)], elemType: 'Variant', fixed: false } }
  assert.deepEqual(wsf(l, 'Sum', arr, dbl(4)), dbl(10))
  assert.deepEqual(wsf(l, 'Sum', rg(l, 'B2:B3,B5')), dbl(24))
})

test('WorksheetFunction: an Excel error raises 1004 "Unable to get the X property"; Application.X returns the error', () => {
  const l = lab(DATA)
  throwsVba(() => wsf(l, 'Match', str('zz'), rg(l, 'A2:A6'), lng(0)), 1004, /Unable to get the Match property of the WorksheetFunction class/)
  throwsVba(() => wsf(l, 'VLookup', str('zz'), rg(l, 'A2:B6'), lng(2), bool(false)), 1004, /VLookup property/)
  const app = o(G(l, 'Application'))
  assert.deepEqual(get(app, 'Match', str('zz'), rg(l, 'A2:A6'), lng(0)), { t: 'err', v: 2042 })
  assert.deepEqual(get(app, 'Sum', rg(l, 'B2:B3')), dbl(19))
  throwsVba(() => wsf(l, 'NoSuchFunction', dbl(1)), 438, /WorksheetFunction\.NoSuchFunction/)
})

test('WorksheetFunction.RandBetween uses the run\'s seeded generator, not the sheet\'s', () => {
  const a = lab({}, { seed: 3 })
  const b = lab({}, { seed: 3 })
  const draws = (l: Lab): unknown[] => Array.from({ length: 5 }, () => plain(wsf(l, 'RandBetween', lng(1), lng(6))))
  const x = draws(a)
  assert.deepEqual(draws(b), x)
  assert.ok(x.every((n) => typeof n === 'number' && n >= 1 && n <= 6 && Number.isInteger(n)))
})

// ---------- sheets, workbook, Application ----------

test('Worksheets(1), Sheets("Sheet1"), ActiveSheet and the workbook; another sheet is error 9', () => {
  const l = lab({ A1: { v: 5 } })
  const ws = o(G(l, 'Worksheets', lng(1)))
  assert.deepEqual(get(ws, 'Name'), str('Sheet1'))
  assert.deepEqual(get(o(get(ws, 'Range', str('A1'))), 'Value'), dbl(5))
  assert.equal(o(G(l, 'Sheets', str('sheet1'))).sameAs?.(o(G(l, 'ActiveSheet'))), true)
  assert.deepEqual(get(o(G(l, 'Worksheets')), 'Count'), lng(1))
  assert.equal(o(G(l, 'Worksheets')).enumerate?.().length, 1)
  throwsVba(() => G(l, 'Worksheets', str('Data')), 9, /Subscript out of range/)
  throwsVba(() => G(l, 'Sheets', lng(2)), 9)
  assert.deepEqual(get(o(G(l, 'ThisWorkbook')), 'Name'), str('ExcelLab.xlsm'))
  assert.deepEqual(get(o(get(o(G(l, 'ActiveWorkbook')), 'Worksheets', lng(1))), 'Name'), str('Sheet1'))
  assert.deepEqual(get(o(get(o(G(l, 'Application')), 'ActiveSheet')), 'Name'), str('Sheet1'))
})

test('Application settings are kept: ScreenUpdating, Calculation, EnableEvents, DisplayAlerts, StatusBar', () => {
  const l = lab()
  const app = o(G(l, 'Application'))
  assert.deepEqual(get(app, 'ScreenUpdating'), bool(true))
  set(app, 'ScreenUpdating', bool(false))
  assert.deepEqual(get(app, 'screenupdating'), bool(false))
  set(app, 'Calculation', xl(l, 'xlCalculationManual'))
  assert.deepEqual(get(app, 'Calculation'), lng(-4135))
  set(app, 'StatusBar', str('Working...'))
  assert.deepEqual(get(app, 'StatusBar'), str('Working...'))
  set(app, 'DisplayAlerts', bool(false))
  set(app, 'EnableEvents', bool(false))
  assert.deepEqual(get(app, 'EnableEvents'), bool(false))
})

test('Application.Wait moves the mock clock forward; Calculate redraws the sheet', () => {
  const l = lab({ A1: { f: '=NOW()' } }, { clock: 46000.5 })
  const app = o(G(l, 'Application'))
  call(app, 'Wait', {}, { t: 'date', v: 46000.5 + 1 / 86400 })
  assert.equal(l.host.now(), 46000.5 + 1 / 86400)
  call(app, 'Wait', {}, { t: 'date', v: 46000 })
  assert.equal(l.host.now(), 46000.5 + 1 / 86400, 'the clock never goes back')
  G(l, 'Calculate')
  assert.ok(Math.abs((l.host.value(1, 1) as number) - (46000.5 + 1 / 86400)) < 1e-9, 'NOW() follows the waited clock')
})

test('Application.InputBox: Type:=1 returns a number (asking again after bad input), Cancel is False, Type:=8 a Range', () => {
  const l = lab({}, { inputs: ['lots', '42', '', 'B2:C3', 'hello'] })
  const app = o(G(l, 'Application'))
  assert.deepEqual(call(app, 'InputBox', { Prompt: str('How many?'), Type: lng(1) }), dbl(42))
  assert.deepEqual(call(app, 'InputBox', { Prompt: str('How many?'), Type: lng(1) }), bool(false))
  assert.equal(addr(o(call(app, 'InputBox', { Prompt: str('Range?'), Type: lng(8) }))), '$B$2:$C$3')
  assert.deepEqual(call(app, 'InputBox', {}, str('Name?')), str('hello'))
})

test('CurrentRegion and UsedRange find the block around the data', () => {
  const l = lab(LIST)
  assert.equal(addr(o(get(R(l, 'B3'), 'CurrentRegion'))), '$A$1:$B$4')
  assert.equal(addr(o(get(o(G(l, 'ActiveSheet')), 'UsedRange'))), '$A$1:$B$7')
})

test('a run through the object model is one undo step on the LabSheet', () => {
  const l = lab(LIST)
  const dest = o(get(o(get(R(l, 'B1'), 'End', xl(l, 'xlDown'))), 'Offset', lng(1), lng(0)))
  set(dest, 'Value', dbl(11))
  set(o(get(dest, 'Offset', lng(0), lng(-1))), 'Value', str('Eve'))
  set(R(l, 'D1:D3'), 'Value', dbl(0))
  call(R(l, 'D1'), 'ClearContents')
  assert.deepEqual(l.host.finish(), { ok: true })
  assert.deepEqual(l.sheet.state().edits, { A5: 'Eve', B5: '11', D2: '0', D3: '0' })
  l.sheet.undo()
  assert.deepEqual(l.sheet.state().edits, {})
  assert.equal(l.sheet.canUndo(), false)
})

// ---------- Delete, discard ----------

const REG: Record<string, CellSpec> = {
  A1: { v: 'No.', role: 'header' }, B1: { v: 'Item', role: 'header' },
  A2: { v: 1 }, B2: { v: 'drill' }, A3: { v: 2 }, B3: { v: 'saw' }, A4: { v: 3 }, B4: { v: 'ladder' },
  C2: { f: '=A3*10' }, C1: { f: '=COUNT(A2:A9)' },
}

test('Rows(n).Delete shifts the rows below up and adjusts formulas like Excel, as one undo step', () => {
  const l = lab(REG, {}, [10, 3])
  call(o(G(l, 'Rows', lng(3))), 'Delete')
  assert.deepEqual(l.sheet.values('A2:B3'), [[1, 'drill'], [3, 'ladder']])
  assert.equal(l.host.formula(2, 3), '=#REF!*10')
  assert.equal(l.host.formula(1, 3), '=COUNT(A2:A8)')
  l.host.finish()
  assert.deepEqual(l.sheet.values('A2:B4'), [[1, 'drill'], [3, 'ladder'], [null, null]])
  l.sheet.undo()
  assert.deepEqual(l.sheet.values('A2:B4'), [[1, 'drill'], [2, 'saw'], [3, 'ladder']])
  assert.equal(l.sheet.raw('C1'), '=COUNT(A2:A9)')
})

test('Delete refuses locked cells, and undoes itself when a locked formula would change', () => {
  const l = lab({ ...REG, C1: { f: '=COUNT(A2:A9)', role: 'given' } }, {}, [10, 3])
  throwsVba(() => call(o(G(l, 'Rows', lng(1))), 'Delete'), 1004, /protected/)
  throwsVba(() => call(o(get(R(l, 'A3'), 'EntireRow')), 'Delete'), 1004, /C1.*formula refers to the deleted cells/)
  assert.deepEqual(l.sheet.values('A2:B4'), [[1, 'drill'], [2, 'saw'], [3, 'ladder']])
  assert.equal(l.host.formula(1, 3), '=COUNT(A2:A9)')
})

test('Range.Delete Shift:=xlShiftUp moves the cells below a block up', () => {
  const l = lab({ A1: { v: 1 }, A2: { v: 2 }, A3: { v: 3 }, B1: { v: 'x' }, B2: { v: 'y' } }, {}, [6, 3])
  call(R(l, 'A2'), 'Delete', { Shift: xl(l, 'xlShiftUp') })
  assert.deepEqual(l.sheet.values('A1:B3'), [[1, 'x'], [3, 'y'], [null, null]])
})

test('discard puts the sheet back without an undo step', () => {
  const l = lab({ A1: { v: 1 } })
  set(R(l, 'A1:B2'), 'Value', dbl(5))
  l.host.discard()
  assert.deepEqual(l.sheet.values('A1:B2'), [[1, null], [null, null]])
  assert.equal(l.sheet.canUndo(), false)
  throwsVba(() => l.host.setValue(1, 1, 2), 1004)
})

test('Evaluate returns a value for a formula, a Range for an address, and errors as values', () => {
  const l = lab({ A1: { v: 2 }, A2: { v: 5 } })
  assert.deepEqual(G(l, 'Evaluate', str('SUM(A1:A2)*2')), dbl(14))
  assert.deepEqual(G(l, 'Evaluate', str('=A1+1')), dbl(3))
  assert.equal(addr(o(G(l, 'Evaluate', str('A2')))), '$A$2')
  assert.deepEqual(get(o(G(l, 'Application')), 'Evaluate', str('1/0')), { t: 'err', v: 2007 })
})

test('ActiveSheet.Paste pastes at the selection; a destination that is a whole multiple is tiled', () => {
  const l = lab({ A1: { v: 1 }, B1: { f: '=A1+1' } }, { activeCell: 'A3' })
  copyFrom(l, 'A1:B1')
  call(o(G(l, 'ActiveSheet')), 'Paste')
  assert.equal(l.host.formula(3, 2), '=A3+1')
  assert.deepEqual(l.host.selection(), { range: 'A3:B3', active: 'A3' })
  call(R(l, 'A5:B6'), 'PasteSpecial', { Paste: xl(l, 'xlPasteValues') })
  assert.deepEqual(l.sheet.values('A5:B6'), [[1, 2], [1, 2]])
})

test('error values: a #DIV/0! cell reads as CVErr; writing CVErr(xlErrNA) shows #N/A', () => {
  const l = lab({ A1: { f: '=1/0' } })
  assert.deepEqual(get(R(l, 'A1'), 'Value'), { t: 'err', v: 2007 })
  assert.deepEqual(get(R(l, 'A1'), 'Text'), str('#DIV/0!'))
  set(R(l, 'B1'), 'Value', { t: 'err', v: 2042 })
  assert.deepEqual(get(R(l, 'B1'), 'Value'), { t: 'err', v: 2042 })
  assert.deepEqual(l.sheet.values('B1'), [['#N/A']])
})

test('a multi-area range writes every area; Application.Goto selects', () => {
  const l = lab()
  set(R(l, 'A1:A2,C3'), 'Value', str('x'))
  assert.deepEqual(l.sheet.values('A1:C3'), [['x', null, null], ['x', null, null], [null, null, 'x']])
  call(o(G(l, 'Application')), 'Goto', {}, G(l, 'Range', str('B7')))
  assert.deepEqual(l.host.selection(), { range: 'B7', active: 'B7' })
})

test('Application.InputBox: Type:=2 text, Type:=4 logical, a scripted blank is Cancel', () => {
  const l = lab({}, { inputs: ['Ann', 'yes', 'TRUE', ''] })
  const app = o(G(l, 'Application'))
  assert.deepEqual(call(app, 'InputBox', { Prompt: str('Name'), Type: lng(2) }), str('Ann'))
  assert.deepEqual(call(app, 'InputBox', { Prompt: str('OK?'), Type: lng(4) }), bool(true))
  assert.deepEqual(call(app, 'InputBox', { Prompt: str('Name') }), bool(false))
})

// ---------- end to end: VBA source through the interpreter, the lab host and the object model ----------
// (skipped until a parser exists; VBA_TEST_PARSER can point at another parseModule module)

const vtest = parse ? test : test.skip

function runOn(cells: Record<string, CellSpec>, body: string, opts: LabHostOptions = {}, size: [number, number] = [20, 8]): Lab & { res: RunResult } {
  const l = lab(cells, opts, size)
  const parsed = parse!(`Sub Main()\n${body}\nEnd Sub\n`)
  if ('error' in parsed) throw new Error(`parse error line ${parsed.error.line}: ${parsed.error.message}`)
  const res = runModule(parsed.module, 'Main', [], { host: l.host, globals: l.scope })
  return { ...l, res }
}
const ok = (r: { res: RunResult }): void => assert.equal(r.res.error?.message, undefined, `line ${r.res.error?.line}: ${r.res.error?.message}`)

vtest('e2e: append below the last row with Cells(Rows.Count, 1).End(xlUp).Row + 1', () => {
  const r = runOn(LIST, [
    'Dim nextRow As Long',
    'nextRow = Cells(Rows.Count, 1).End(xlUp).Row + 1',
    'Cells(nextRow, 1).Value = "Eve"',
    'Cells(nextRow, 2).Value = 4',
    'Range("A1").End(xlDown).Offset(1, 0).Value = "Fay"',
  ].join('\n'))
  ok(r)
  assert.deepEqual(r.sheet.values('A5:B8'), [['Fay', null], [null, null], ['Dee', 2], ['Eve', 4]])
})

vtest('e2e: recorded PasteSpecial with named arguments and a line continuation', () => {
  const r = runOn(PASTE, [
    'Range("A1:B1").Select',
    'Selection.Copy',
    'Range("D5").Select',
    'Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats, Operation:= _',
    '    xlNone, SkipBlanks:=False, Transpose:=False',
    'Application.CutCopyMode = False',
  ].join('\n'))
  ok(r)
  assert.deepEqual(r.sheet.values('D5:E5'), [[2, 20]])
  assert.equal(r.host.numberFormat(5, 5), '$#,##0')
  assert.deepEqual(r.host.selection(), { range: 'D5:E5', active: 'D5' })
})

vtest('e2e: For Each with With cell.Offset and NumberFormat; Is Nothing with Intersect', () => {
  const r = runOn({ C5: { v: 165 }, C6: { v: 192 }, E2: { v: 200 } }, [
    'Dim cell As Range',
    'For Each cell In Range("C5:C6")',
    '    With cell.Offset(0, 2)',
    '        .Value = cell.Value / Range("E2").Value',
    '        .NumberFormat = "0%"',
    '    End With',
    'Next cell',
    'If Intersect(Range("A1"), Range("C5:C6")) Is Nothing Then Range("A1").Value = "outside"',
    'If Not Intersect(Range("C6"), Range("C5:C6")) Is Nothing Then Range("A2").Value = "inside"',
  ].join('\n'))
  ok(r)
  assert.deepEqual(r.sheet.values('E5:E6'), [[0.825], [0.96]])
  assert.deepEqual(r.sheet.values('A1:A2'), [['outside'], ['inside']])
  assert.equal(r.host.numberFormat(6, 5), '0%')
})

vtest('e2e: a WorksheetFunction error is trappable as 1004; Application.Match returns an error value', () => {
  const r = runOn(DATA, [
    'Dim pos As Variant',
    'On Error Resume Next',
    'pos = WorksheetFunction.Match("zz", Range("A2:A6"), 0)',
    'Range("D1").Value = Err.Number',
    'On Error GoTo 0',
    'pos = Application.Match("zz", Range("A2:A6"), 0)',
    'If IsError(pos) Then Range("D2").Value = "not found"',
    'Range("D3").Value = WorksheetFunction.VLookup("c", Range("A2:B6"), 2, False)',
  ].join('\n'))
  ok(r)
  assert.deepEqual(r.sheet.values('D1:D3'), [[1004], ['not found'], [31]])
})

vtest('e2e: writing a locked cell stops the macro with 1004 on that line', () => {
  const r = runOn({ A1: { v: 'Name', role: 'header' } }, ['Range("B1").Value = 1', 'Range("A1").Value = "x"', 'Range("C1").Value = 3'].join('\n'))
  assert.equal(r.res.ok, false)
  assert.equal(r.res.error?.line, 3)
  assert.match(r.res.error?.message ?? '', /Run-time error '1004': The cell is protected \(A1/)
  r.host.finish()
  assert.deepEqual(r.sheet.state().edits, { B1: '1' })
})

vtest('e2e: arrays to and from ranges, Rows.Count of a block, MsgBox and Debug.Print collected', () => {
  const r = runOn(LIST, [
    'Dim v As Variant, i As Long, total As Double',
    'v = Range("B2:B4").Value',
    'For i = 1 To UBound(v, 1)',
    '    total = total + v(i, 1)',
    'Next i',
    'Range("D1").Value = total',
    'Range("D2:F2").Value = Array(1, 2, 3)',
    'Range("D3").Value = Range("A1").CurrentRegion.Rows.Count',
    'Debug.Print Range("A1").End(xlDown).Address',
    'MsgBox "Total " & total',
  ].join('\n'))
  ok(r)
  assert.deepEqual(r.sheet.values('D1:F3'), [[15, null, null], [1, 2, 3], [4, null, null]])
  assert.deepEqual(r.host.messages, ['$A$4', 'Total 15'])
})

vtest('e2e: unsupported members name themselves in the 438 message', () => {
  const r = runOn({}, 'Columns("A:F").PrintOut')
  assert.equal(r.res.ok, false)
  assert.match(r.res.error?.message ?? '', /438.*Range\.PrintOut/)
})

test('clockFromDate and epochOf agree; cssColor turns VBA colours into CSS', async () => {
  const { clockFromDate, cssColor } = await import('../src/lab/vba/labHost.ts')
  const { epochOf } = await import('../src/lab/vba/labHostUtil.ts')
  const serial = clockFromDate(new Date(2026, 9, 10, 14, 30, 15))
  assert.ok(Math.abs(serial - (46305 + (14 * 3600 + 30 * 60 + 15) / 86400)) < 1e-9)
  assert.equal(clockFromDate(new Date(epochOf(serial))), serial)
  assert.equal(cssColor(255), '#ff0000')
  assert.equal(cssColor(65535), '#ffff00')
  assert.equal(cssColor(16711680), '#0000ff')
})
