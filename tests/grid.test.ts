// grid.test.ts - helpers behind the lab Spreadsheet (formula text, navigation, geometry, clipboard, series, sheet actions).
// Run: npx tsx --test tests/grid.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoCloseParens, callContextAt, cycleRef, functionPrefixAt, isPointable, parseRangeText, rangeText, scanRefs,
} from '../src/lab/components/grid/formulaText.ts'
import { linearSeries, parseTsv, toTsv } from '../src/lab/components/grid/clipboardText.ts'
import { bodyWindow, buildGeometry, hitTest, rangeRects, ROW_H, HEADER_H, ROW_HEADER_W, scrollToReveal } from '../src/lab/components/grid/geometry.ts'
import { jump, moveWithin, page, step } from '../src/lab/components/grid/navigate.ts'
import { fitGeneral } from '../src/lab/components/grid/cellView.ts'
import { matchFunctions, syntaxHint } from '../src/lab/components/grid/functions.ts'
import {
  autoFill, boxLockReason, boxTsv, isBlank, lockReason, LOCKED_MSG, moveBox, pasteText, TABLE_MSG, tableBodies,
} from '../src/lab/components/grid/sheetOps.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import type { SheetSpec } from '../src/lab/types.ts'

const letter = (c: number) => String.fromCharCode(65 + c)
const geoOf = (rows: number, cols: number, hidden: number[] = [], frozenRows = 0) =>
  buildGeometry({ rows, cols, hidden: new Set(hidden), frozenRows, showFormulas: false, colLetter: letter })

test('F4 cycles A1 -> $A$1 -> A$1 -> $A1 -> A1 at or just before the caret', () => {
  let t = '=A1*2'
  const seen: string[] = []
  for (let i = 0; i < 4; i++) {
    const out = cycleRef(t, 3)
    assert.ok(out)
    t = out.text
    seen.push(t)
  }
  assert.deepEqual(seen, ['=$A$1*2', '=A$1*2', '=$A1*2', '=A1*2'])
  assert.deepEqual(cycleRef('=SUM(B2:C9)', 11), { text: '=SUM($B$2:$C$9)', caret: 14 })
  assert.equal(cycleRef('=SUM(B2:C9)+', 12)?.text, '=SUM($B$2:$C$9)+')   // ref just before the caret
  assert.equal(cycleRef('=Sheet1!B2', 10)?.text, '=Sheet1!$B$2')
  assert.equal(cycleRef('=LOG10(5)', 5), null)                           // a function, not a reference
  assert.equal(cycleRef('="A1"', 3), null)                               // inside a string
  assert.equal(cycleRef('=VLOOKUP(E2,A:B,2)', 14)?.text, '=VLOOKUP(E2,$A:$B,2)')
})

test('scanRefs finds references outside strings and skips function names', () => {
  const refs = scanRefs('=SUM(A1:B3)+LOG10(C4)&"D5"+$E$6+Data!F7')
  assert.deepEqual(refs.map(r => r.text), ['A1:B3', 'C4', '$E$6', 'Data!F7'])
  assert.deepEqual([refs[0].r1, refs[0].c1, refs[0].r2, refs[0].c2], [0, 0, 2, 1])
  assert.equal(refs[3].sheet, 'Data')
  assert.deepEqual(scanRefs('12'), [])
})

test('point mode only after =, (, comma or an operator', () => {
  assert.ok(isPointable('=', 1))
  assert.ok(isPointable('=SUM(', 5))
  assert.ok(isPointable('=A1+', 4))
  assert.ok(isPointable('=IF(A1>', 7))
  assert.ok(isPointable('=MAX(0, ', 8))
  assert.ok(!isPointable('=A1', 3))
  assert.ok(!isPointable('=SUM(A1)', 8))
  assert.ok(!isPointable('="a+', 4))
  assert.ok(!isPointable('hello+', 6))
  assert.ok(!isPointable('=SUM(B2', 5))     // the caret sits before a reference
})

test('function prefix and call context drive autocomplete and syntax hints', () => {
  assert.deepEqual(functionPrefixAt('=VL', 3), { start: 1, prefix: 'VL' })
  assert.deepEqual(functionPrefixAt('=1+sum', 6), { start: 3, prefix: 'sum' })
  assert.equal(functionPrefixAt('=VLOOKUP(', 9), null)
  assert.equal(functionPrefixAt('VL', 2), null)
  assert.equal(functionPrefixAt('="VL', 4), null)
  assert.deepEqual(callContextAt('=VLOOKUP(A2,$E$2:$F$9,', 22), { name: 'VLOOKUP', argIndex: 2 })
  assert.deepEqual(callContextAt('=IF(AND(A1>0,', 13), { name: 'AND', argIndex: 1 })
  assert.deepEqual(callContextAt('=IF(AND(A1>0,B1>0),', 19), { name: 'IF', argIndex: 1 })
  assert.deepEqual(callContextAt('=IF("a,b",', 10), { name: 'IF', argIndex: 1 })
  assert.equal(callContextAt('=A1+2', 5), null)
})

test('missing brackets are closed on Enter, like Excel', () => {
  assert.equal(autoCloseParens('=SUM(A1:A3'), '=SUM(A1:A3)')
  assert.equal(autoCloseParens('=IF(AND(A1>0,B1>0'), '=IF(AND(A1>0,B1>0))')
  assert.equal(autoCloseParens('=IF(A1="(",1'), '=IF(A1="(",1)')
  assert.equal(autoCloseParens('=SUM(A1)'), '=SUM(A1)')
  assert.equal(autoCloseParens('text ('), 'text (')
})

test('range text round trip', () => {
  assert.equal(rangeText(4, 3, 1, 1), 'B2:D5')
  assert.equal(rangeText(0, 0, 0, 0), 'A1')
  assert.deepEqual(parseRangeText('$b$2:d5'), { r1: 1, c1: 1, r2: 4, c2: 3 })
  assert.deepEqual(parseRangeText('Sheet1!C3'), { r1: 2, c1: 2, r2: 2, c2: 2 })
  assert.equal(parseRangeText('B2:C3:D4'), null)
  assert.equal(parseRangeText('hello'), null)
})

test('TSV round trip with quoted fields', () => {
  const rows = [['a', 'b\tc'], ['line\nbreak', 'say "hi"']]
  assert.deepEqual(parseTsv(toTsv(rows)), rows)
  assert.deepEqual(parseTsv('1\t2\r\n3\t4\r\n'), [['1', '2'], ['3', '4']])
  assert.deepEqual(parseTsv('x'), [['x']])
})

test('AutoFill series extends the linear trend', () => {
  assert.deepEqual(linearSeries([1, 2], 3), [3, 4, 5])
  assert.deepEqual(linearSeries([10, 20, 30], 2), [40, 50])
  assert.deepEqual(linearSeries([0.1, 0.2], 2), [0.3, 0.4])
  assert.deepEqual(linearSeries([1, 3, 4], 1), [5.666666666666667].map(v => Number(v.toPrecision(15))))
  assert.deepEqual(linearSeries([7], 2), [7, 7])
})

test('navigation skips hidden rows; Ctrl+arrow stops at data edges', () => {
  const geo = geoOf(10, 3, [3, 4])    // rows 3 and 4 (1-based) hidden
  assert.deepEqual(step(geo, { r: 1, c: 0 }, 1, 0), { r: 4, c: 0 })
  assert.deepEqual(step(geo, { r: 4, c: 0 }, -1, 0), { r: 1, c: 0 })
  assert.deepEqual(step(geo, { r: 0, c: 0 }, -1, -1), { r: 0, c: 0 })
  const filled = new Set(['0,0', '1,0', '4,0', '5,0', '8,0'])
  const blank = (r: number, c: number) => !filled.has(`${r},${c}`)
  assert.deepEqual(jump(geo, { r: 0, c: 0 }, 1, 0, blank), { r: 5, c: 0 })   // 0,1 then hidden 2,3, then 4,5 contiguous
  assert.deepEqual(jump(geo, { r: 5, c: 0 }, 1, 0, blank), { r: 8, c: 0 })   // next non-blank
  assert.deepEqual(jump(geo, { r: 8, c: 0 }, 1, 0, blank), { r: 9, c: 0 })   // edge
  assert.deepEqual(jump(geo, { r: 0, c: 1 }, 0, 1, blank), { r: 0, c: 2 })
  assert.deepEqual(page(geo, { r: 0, c: 0 }, 1, 3), { r: 5, c: 0 })
  const box = { r1: 0, c1: 0, r2: 1, c2: 1 }
  assert.deepEqual(moveWithin(geo, box, { r: 1, c: 0 }, 1, 0), { r: 0, c: 1 })
  assert.deepEqual(moveWithin(geo, box, { r: 0, c: 1 }, 0, 1), { r: 1, c: 0 })
})

test('geometry: frozen rows, layer rectangles, hit testing, reveal, virtual window', () => {
  const geo = geoOf(1000, 4, [5], 2)
  assert.equal(geo.frozen, 2)
  assert.equal(geo.visRows.length, 999)
  assert.equal(geo.bodyH, 997 * ROW_H)
  const rr = rangeRects(geo, 0, 1, 3, 2)
  assert.deepEqual(rr.frozen, { left: ROW_HEADER_W + 84, width: 168, top: 0, height: 2 * ROW_H })
  assert.deepEqual(rr.body, { left: ROW_HEADER_W + 84, width: 168, top: 0, height: 2 * ROW_H })
  assert.deepEqual(rangeRects(geo, 4, 0, 4, 0), { clipTop: false, clipBottom: false })   // hidden row only
  const hitFrozen = hitTest(geo, ROW_HEADER_W + 10, HEADER_H + ROW_H + 5, 0, 5000)
  assert.deepEqual(hitFrozen, { r: 1, c: 0, zone: 'cell' })
  const hitBody = hitTest(geo, ROW_HEADER_W + 90, HEADER_H + 2 * ROW_H + 5, 0, 10 * ROW_H)
  assert.deepEqual(hitBody, { r: 13, c: 1, zone: 'cell' })   // body index 10 -> visRows[12] = row 13 (row 4 hidden)
  assert.equal(hitTest(geo, 5, 5, 0, 0)?.zone, 'corner')
  const view = { scrollLeft: 0, scrollTop: 0, width: 300, height: 300 }
  const reveal = scrollToReveal(geo, 500, 3, view)
  assert.ok(reveal && reveal.top > 0 && reveal.left > 0)
  assert.equal(scrollToReveal(geo, 3, 0, view), null)
  const [a, b] = bodyWindow(geo, 0, 400)
  assert.equal(a, 0)
  assert.ok(b > 400 / ROW_H && b < 60)
  const [c, d] = bodyWindow(geo, 500 * ROW_H, 400)
  assert.ok(c <= 500 && d >= 500 + 400 / ROW_H)
})

test('General format squeezes numbers into narrow columns like Excel', () => {
  assert.equal(fitGeneral(0.333333333333333, 10), '0.33333333')
  assert.equal(fitGeneral(12345678, 8), '12345678')
  assert.equal(fitGeneral(123456789012, 8), '1.23E+11')
  assert.equal(fitGeneral(-0.000012345, 9), '-1.23E-05')
  assert.equal(fitGeneral(42, 5), '42')
})

test('function autocomplete ranks course functions first and has syntax hints', () => {
  const v = matchFunctions('V')
  assert.equal(v[0], 'VLOOKUP')
  assert.ok(matchFunctions('rand').includes('RANDBETWEEN'))
  assert.deepEqual(matchFunctions(''), [])
  const h = syntaxHint('vlookup')
  assert.ok(h && h.args.length === 4 && h.args[3] === '[range_lookup]')
  const pmt = syntaxHint('PMT')
  assert.ok(pmt && pmt.args[0] === 'rate' && pmt.example?.startsWith('=PMT('))
})

// ---- grid actions over a real LabSheet ----

const opsSpec = (): SheetSpec => ({
  rows: 20,
  cols: 8,
  cells: {
    A1: { v: 'Qty', role: 'header' },
    A2: { v: 4, role: 'given' },
    A3: { v: 6, role: 'given' },
    B1: { v: 0.1, role: 'input', fmt: '0%' },
    C2: { role: 'answer' },
  },
})
const rowsOf = (s: { rows: number }) => Array.from({ length: s.rows }, (_, i) => i)

test('isBlank treats spilled cells as filled and lock reasons name the cause', () => {
  const s = createLabSheet(opsSpec())
  assert.ok(isBlank(s, 5, 5))
  assert.ok(!isBlank(s, 1, 0))
  s.set('E1', '=SEQUENCE(3)')
  assert.equal(s.raw('E2'), '')
  assert.ok(!isBlank(s, 1, 4), 'E2 is filled by the spill from E1')
  assert.equal(lockReason(s, [], 1, 0), LOCKED_MSG)
  assert.equal(lockReason(s, [], 1, 2), null)
  assert.equal(lockReason(s, [{ r1: 1, c1: 2, r2: 1, c2: 2 }], 1, 2), TABLE_MSG)
  assert.equal(boxLockReason(s, [], { r1: 1, c1: 1, r2: 2, c2: 2 }, rowsOf(s)), null)
  assert.equal(boxLockReason(s, [], { r1: 1, c1: 0, r2: 2, c2: 2 }, rowsOf(s)), LOCKED_MSG)
  s.destroy()
})

test('external paste is one undo step and skips locked cells', () => {
  const s = createLabSheet(opsSpec())
  const out = pasteText(s, [], { r: 1, c: 0 }, '9\t=A2*2\r\n7\t8\r\n')
  assert.deepEqual(out.box, { r1: 1, c1: 0, r2: 2, c2: 1 })
  assert.equal(out.skipped, 2)          // A2, A3 are given
  assert.equal(s.raw('B2'), '=A2*2')
  assert.equal(s.raw('B3'), '8')
  assert.equal(s.raw('A2'), '4')
  s.undo()
  assert.equal(s.raw('B2'), '')
  assert.equal(s.raw('B3'), '')
  const bad = pasteText(s, [], { r: 4, c: 3 }, '=SUM(1,\t2')
  assert.ok(bad.error && bad.written === 0)
  assert.equal(s.raw('E5'), '')
  s.destroy()
})

test('cut + paste moves entries in one undo step; formulas keep their references', () => {
  const s = createLabSheet(opsSpec())
  s.set('C2', '=A2*$B$1')
  s.set('D2', '5')
  const res = moveBox(s, { r1: 1, c1: 2, r2: 1, c2: 3 }, { r1: 5, c1: 2, r2: 5, c2: 3 })
  assert.ok(res.ok)
  assert.equal(s.raw('C6'), '=A2*$B$1')
  assert.equal(s.raw('D6'), '5')
  assert.equal(s.raw('C2'), '')
  assert.equal(s.raw('D2'), '')
  s.undo()
  assert.equal(s.raw('C2'), '=A2*$B$1')
  assert.equal(s.raw('C6'), '')
  s.destroy()
})

test('AutoFill: numbers extend the series (with their format), formulas copy with relative refs', () => {
  const s = createLabSheet(opsSpec())
  s.set('E2', '5%')
  s.set('E3', '10%')
  const series = autoFill(s, { r1: 1, c1: 4, r2: 2, c2: 4 }, { r1: 1, c1: 4, r2: 5, c2: 4 }, 'down')
  assert.ok(series.ok)
  assert.equal(s.read('E6').value, 0.25)
  assert.equal(s.display('E6'), '25%')
  s.set('C2', '=A2*2')
  const copy = autoFill(s, { r1: 1, c1: 2, r2: 1, c2: 2 }, { r1: 1, c1: 2, r2: 2, c2: 2 }, 'down')
  assert.ok(copy.ok)
  assert.equal(s.raw('C3'), '=A3*2')
  s.set('F2', '1')
  s.set('G2', '3')
  const right = autoFill(s, { r1: 1, c1: 5, r2: 1, c2: 6 }, { r1: 1, c1: 5, r2: 1, c2: 7 }, 'right')
  assert.ok(right.ok)
  assert.equal(s.raw('H2'), '5')
  s.destroy()
})

test('clipboard text and data-table bodies', () => {
  const s = createLabSheet(opsSpec())
  assert.equal(boxTsv(s, { r1: 0, c1: 0, r2: 2, c2: 1 }, rowsOf(s)), 'Qty\t10%\r\n4\t\r\n6\t')
  s.set('D10', '=B1*2')
  s.set('C11', '0.1')
  s.set('C12', '0.2')
  assert.ok(s.addDataTable({ range: 'C10:D12', colInput: 'B1' }).ok)
  assert.deepEqual(tableBodies(s), [{ r1: 10, c1: 3, r2: 11, c2: 3 }])
  assert.equal(lockReason(s, tableBodies(s), 10, 3), TABLE_MSG)
  s.destroy()
})
