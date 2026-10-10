// engine-fixes.test.ts - regression tests for the Excel-compatibility fixes of the review round (engine-fix):
// TREND/FORECAST arrays, MATCH wildcards, the COUNTIF family, BINOM.INV alpha 0/1, "" in arithmetic, 15-digit number
// text, display/TEXT rounding and negative dates, the @ operator and scientific literals, #DIV/0! and #CYCLE! hints.
// Run: npx tsx --test tests/engine-fixes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet, writeCells } from '../src/lab/sheet.ts'
import { binomInv, excelNumberText, makeCriterion, parseCriterion, wildcardRegExp } from '../src/lab/engine/excelMath.ts'
import { DATE_OVERFLOW, formatNumber, formatText } from '../src/lab/engine/format.ts'
import { resizedSumRange, toDisplayFormula, toEngineFormula } from '../src/lab/engine/formulaText.ts'
import { parseInput } from '../src/lab/engine/input.ts'
import type { CellSpec, CellValue, LabSheet } from '../src/lab/types.ts'

const near = (a: unknown, b: number, tol = 1e-9) => {
  assert.equal(typeof a, 'number', `expected a number, got ${String(a)}`)
  assert.ok(Math.abs((a as number) - b) <= tol, `${String(a)} is not within ${tol} of ${b}`)
}
/** a sheet built by typing each entry, as a learner would */
function typed(entries: Record<string, string>, rows = 40, cols = 12): LabSheet {
  const s = createLabSheet({ rows, cols, cells: {} })
  for (const [ref, raw] of Object.entries(entries)) assert.deepEqual(s.set(ref, raw), { ok: true }, `${ref} ${raw}`)
  return s
}
/** the value a formula gives in `at` (default K1) of sheet `s` */
function calc(s: LabSheet, formula: string, at = 'K1'): CellValue {
  assert.deepEqual(s.set(at, formula), { ok: true }, formula)
  return s.read(at).value as CellValue
}
const column = (s: LabSheet, range: string) => s.values(range).map((line) => line[0])

// ---------- 1. TREND and FORECAST.LINEAR ----------

const trendData: Record<string, string> = {
  A1: '1', A2: '2', A3: '3', A4: '4', A5: '5', A6: '6', A7: '7', A8: '8', A9: '9',
  B1: '42', B2: '47', B3: '45', B4: '53', B5: '56', B6: '58',
}

test('TREND: an omitted known_x is 1..n', () => {
  const s = typed(trendData)
  near(calc(s, '=TREND(B1:B6,,A7)'), 61.6666666666667, 1e-9)
  near(calc(s, '=TREND(B1:B6,A1:A6,A7)'), 61.6666666666667, 1e-9) // the existing form is unchanged
  near(calc(s, '=TREND(B1:B6,A1:A6,A7,FALSE)'), 7 * (42 + 2 * 47 + 3 * 45 + 4 * 53 + 5 * 56 + 6 * 58) / 91, 1e-9)
})

test('TREND: a range new_x spills an array shaped like new_x', () => {
  const s = typed(trendData)
  s.set('D1', '=TREND(B1:B6,A1:A6,A7:A9)')
  const down = column(s, 'D1:D3') as number[]
  ;[61.6666666666667, 64.952380952381, 68.2380952380952].forEach((v, i) => near(down[i], v, 1e-9))
  s.set('F1', '=TREND(B1:B6,,A7:A9)')
  assert.deepEqual(column(s, 'F1:F3'), column(s, 'D1:D3'))
  s.set('A20', '7'); s.set('B20', '8'); s.set('C20', '9')
  s.set('A21', '=TREND(B1:B6,A1:A6,A20:C20)')
  const across = s.values('A21:C21')[0] as number[]
  ;[61.6666666666667, 64.952380952381, 68.2380952380952].forEach((v, i) => near(across[i], v, 1e-9))
  assert.equal(s.raw('B21'), '') // spilled cells hold no formula
})

test('TREND: known_y alone returns the fitted values for 1..n; known_y and known_x return fitted values', () => {
  const s = typed(trendData)
  s.set('D1', '=TREND(B1:B6)')
  const fitted = column(s, 'D1:D6') as number[]
  near(fitted[0], 41.952380952381, 1e-9)
  near(fitted[5], 58.3809523809524, 1e-9)
  s.set('E1', '=TREND(B1:B6,A1:A6)')
  assert.deepEqual(column(s, 'E1:E6'), fitted)
})

test('FORECAST.LINEAR and FORECAST with a range x spill; sizes that differ give #N/A', () => {
  const s = typed(trendData)
  s.set('D1', '=FORECAST.LINEAR(A7:A9,B1:B6,A1:A6)')
  s.set('E1', '=FORECAST(A7:A9,B1:B6,A1:A6)')
  const a = column(s, 'D1:D3') as number[]
  ;[61.6666666666667, 64.952380952381, 68.2380952380952].forEach((v, i) => near(a[i], v, 1e-9))
  assert.deepEqual(column(s, 'E1:E3'), a)
  assert.equal(calc(s, '=FORECAST(A7,B1:B6,A1:A5)'), '#N/A')
  assert.equal(calc(s, '=TREND(B1:B6,A1:A5,A7)'), '#REF!')
})

// ---------- 2. MATCH wildcards ----------

test('MATCH type 0 understands * ? and ~ on text, case-insensitively', () => {
  const s = typed({ D1: 'Pandan kaya', D2: 'Kaya toast', D3: 'Gula melaka', D4: 'a*b', D5: '50', E1: '5', E2: '50' })
  assert.equal(calc(s, '=MATCH("*kaya",D1:D3,0)'), 1)
  assert.equal(calc(s, '=MATCH("KAYA*",D1:D3,0)'), 2)
  assert.equal(calc(s, '=MATCH("?ula*",D1:D3,0)'), 3)
  assert.equal(calc(s, '=MATCH("a~*b",D1:D5,0)'), 4)
  assert.equal(calc(s, '=MATCH("*",E1:E2,0)'), '#N/A') // wildcards match text only, not numbers
  assert.equal(calc(s, '=MATCH("x*",D1:D3,0)'), '#N/A')
  // everything else is unchanged
  assert.equal(calc(s, '=MATCH("kaya toast",D1:D3,0)'), 2)
  assert.equal(calc(s, '=MATCH(50,E1:E2,0)'), 2)
  assert.equal(calc(s, '=MATCH(7,E1:E2,1)'), 1)
  assert.equal(calc(s, '=INDEX(D1:D3,MATCH("*melaka",D1:D3,0))'), 'Gula melaka')
})

// ---------- 3. COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF, AVERAGEIFS, COUNTBLANK ----------

test('criteria "": truly empty cells and formulas returning "" both count; "=" and "<>" split them', () => {
  const s = typed({ B1: '=""', B2: '1', B3: '=""', B4: '2' }) // B5 empty
  assert.equal(calc(s, '=COUNTIF(B1:B5,"")'), 3)
  assert.equal(calc(s, '=COUNTBLANK(B1:B5)'), 3)
  assert.equal(calc(s, '=COUNTIF(B1:B5,"=")'), 1)
  assert.equal(calc(s, '=COUNTIF(B1:B5,"<>")'), 4)
  assert.equal(calc(s, '=SUMIF(B1:B5,"<>",B1:B5)'), 3)
})

test('criteria: a reference to an empty cell means 0 (zeros count, blanks do not)', () => {
  const s = typed({ C1: '0', C2: '5', C3: '0', C5: '7', D1: 'x', D2: 'y', D3: 'z', D4: 'w', D5: 'v' }) // C4 and Z9 empty
  assert.equal(calc(s, '=COUNTIF(C1:C5,Z9)'), 2)
  assert.equal(calc(s, '=SUMIF(C1:C5,Z9,C1:C5)'), 0)
  assert.equal(calc(s, '=COUNTIFS(C1:C5,Z9,D1:D5,"<>w")'), 2)
})

test('criteria: ordering operators with text compare as text and never give #VALUE!', () => {
  const s = typed({ B7: '10', B8: '20', B9: 'Apple', B10: 'banana', B11: 'cherry' })
  assert.equal(calc(s, '=COUNTIF(B7:B11,">=B3")'), 2)  // banana, cherry are after "B3"; numbers never compare with text
  assert.equal(calc(s, '=COUNTIF(B7:B8,">=B3")'), 0)
  assert.equal(calc(s, '=COUNTIF(B7:B11,">x")'), 0)
  assert.equal(calc(s, '=COUNTIF(B7:B11,"<b")'), 1)    // Apple, case-insensitive
  assert.equal(calc(s, '=SUMIF(B9:B11,">a",B7:B9)'), 30)
})

test('criteria: dates and times written as text are serials', () => {
  const s = typed({ A1: '46202', A2: '46212', A3: '46230', B1: '6:45 PM', B2: '18:00', B3: '9:30' })
  assert.equal(calc(s, '=COUNTIF(A1:A3,">=29 Jun 2026")'), 3)
  assert.equal(calc(s, '=COUNTIF(A1:A3,"29 Jun 2026")'), 1)
  assert.equal(calc(s, '=COUNTIF(A1:A3,">=2026-07-09")'), 2)
  assert.equal(calc(s, '=COUNTIF(A1:A3,"<=09/07/2026")'), 2)
  assert.equal(calc(s, '=COUNTIF(B1:B3,"6:45 PM")'), 1)
  assert.equal(calc(s, '=COUNTIF(B1:B3,">=18:00")'), 2)
  // criteria cells built with TEXT, as in the Week 10 alert sheet
  s.set('C1', '=">="&TEXT(A2,"d mmm yyyy")')
  s.set('D1', '="<="&TEXT(A3,"dd mmm yyyy")')
  assert.equal(calc(s, '=COUNTIFS(A1:A3,C1,A1:A3,D1)'), 2)
})

test('criteria: numeric strings match numbers, wildcards, <> forms, booleans and errors', () => {
  const s = typed({ A1: '5', A2: "'5", A3: '50', A4: 'Ea st', A5: 'East', A6: 'east', A7: 'TRUE', A8: '=NA()', A9: '12%' })
  assert.equal(calc(s, '=COUNTIF(A1:A9,"5")'), 2)    // number 5 and text "5"
  assert.equal(calc(s, '=COUNTIF(A1:A9,5)'), 2)
  assert.equal(calc(s, '=COUNTIF(A1:A9,"5*")'), 1)   // wildcards: text only
  assert.equal(calc(s, '=COUNTIF(A1:A9,"ea*")'), 3)
  assert.equal(calc(s, '=COUNTIF(A1:A9,"east")'), 2)
  assert.equal(calc(s, '=COUNTIF(A1:A9,"<>east")'), 7)
  assert.equal(calc(s, '=COUNTIF(A1:A9,TRUE)'), 1)
  assert.equal(calc(s, '=COUNTIF(A1:A9,"#N/A")'), 1)
  assert.equal(calc(s, '=COUNTIF(A1:A9,">=12%")'), 3)
  assert.equal(calc(s, '=COUNTIF(A1:A9,">"&A1)'), 1)
})

test('SUMIF/AVERAGEIF: a sum range of another shape is resized from its top-left cell, like Excel', () => {
  const s = typed({
    A1: 'East', A2: 'West', A3: 'East', A4: 'North', A5: 'East',
    B1: '10', B2: '20', B3: '30', B4: '40', B5: '50', D1: 'East',
  })
  assert.equal(calc(s, '=SUMIF($A$1:$A$5,D1,$B$1)', 'E1'), 90)
  assert.equal(s.raw('E1'), '=SUMIF($A$1:$A$5,D1,$B$1)')         // shown as typed
  assert.equal(calc(s, '=AVERAGEIF(A1:A5,"East",B1)', 'E2'), 30)
  assert.equal(calc(s, '=SUMIF(A1:A5,"East",B1:B2)', 'E3'), 90)   // a smaller range grows too
  assert.equal(calc(s, '=SUMIF(A1:A5,"East",B1:C9)', 'E4'), 90)   // a larger one is cut to the shape of range
  // the resized cells are real dependencies: changing them recalculates
  s.set('B5', '500')
  assert.equal(s.read('E1').value, 540)
  s.set('B3', '=B1*10')
  assert.equal(s.read('E1').value, 610)
  // fill, copy/paste, undo and state round trips keep the typed form
  assert.deepEqual(s.fill('E1', 'E1:E2'), { ok: true })
  assert.equal(s.raw('E2'), '=SUMIF($A$1:$A$5,D2,$B$1)')
  s.copy('E3')
  assert.deepEqual(s.paste('F4'), { ok: true })
  assert.equal(s.raw('F4'), '=SUMIF(B2:B6,"East",C2:C3)')
  const again = createLabSheet(s.spec, { state: s.state() })
  for (const ref of ['E1', 'E2', 'E3', 'E4', 'F4']) {
    assert.equal(again.raw(ref), s.raw(ref), ref)
    assert.deepEqual(again.read(ref), s.read(ref), ref)
  }
  s.undo()
  assert.equal(s.raw('F4'), '')
  // a typed 4th argument is not Excel's SUMIF
  assert.equal(calc(s, '=SUMIF(A1:A5,"East",B1:B5,C1:C5)'), '#N/A')
})

test('COUNTIFS/SUMIFS/AVERAGEIFS: ranges of different sizes give #VALUE!; errors in summed cells propagate', () => {
  const s = typed({ A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '=1/0', B3: '3' })
  assert.equal(calc(s, '=COUNTIFS(A1:A3,"a",B1:B2,">0")'), '#VALUE!')
  assert.equal(calc(s, '=SUMIFS(B1:B3,A1:A2,"a")'), '#VALUE!')
  assert.equal(calc(s, '=AVERAGEIFS(B1:B3,A1:A3,"zzz")'), '#DIV/0!')
  assert.equal(calc(s, '=SUMIFS(B1:B3,A1:A3,"a")'), 4)            // the error row is not summed
  assert.equal(calc(s, '=SUMIF(A1:A3,"b",B1:B3)'), '#DIV/0!')
  assert.equal(calc(s, '=AVERAGEIFS(B1:B3,A1:A3,"a",B1:B3,">1")'), 3)
  assert.equal(calc(s, '=MINIFS(B1:B3,A1:A3,"a")'), 1)
  assert.equal(calc(s, '=MAXIFS(B1:B3,A1:A3,"a")'), 3)
  assert.equal(calc(s, '=MAXIFS(B1:B3,A1:A3,"zzz")'), 0)
  assert.equal(calc(s, '=MINIFS(B1:B3,A1:A3,"b")'), '#DIV/0!')
  assert.equal(calc(s, '=MINIFS(B1:B3,A1:A2,"a")'), '#VALUE!')
})

test('criteria matcher (excelMath) keeps the old results it shared with the checker', () => {
  assert.equal([3, 7, 1, 9].filter(makeCriterion('>5')).length, 2)
  assert.equal(['North', 'East', 'north', null].filter(makeCriterion('N*')).length, 2)
  assert.equal(['North', 'East', null].filter(makeCriterion('<>North')).length, 2)
  assert.equal([null, '', 'x'].filter(makeCriterion('')).length, 2)
  assert.deepEqual(parseCriterion(null), { op: '=', operand: { kind: 'number', value: 0 } })
  assert.deepEqual(parseCriterion('>=29 Jun 2026'), { op: '>=', operand: { kind: 'number', value: 46202 } })
  assert.deepEqual(parseCriterion('<>'), { op: '<>', operand: { kind: 'empty' } })
  assert.ok(wildcardRegExp('~?x*').test('?xyz'))
  assert.ok(!wildcardRegExp('~?x*').test('axyz'))
})

test('COUNTIF over 1,000 growing ranges stays fast', () => {
  const cells: Record<string, CellSpec> = {}
  for (let r = 1; r <= 1000; r++) cells[`A${r}`] = { v: (r * 7919) % 1000 }
  const s = createLabSheet({ rows: 1000, cols: 4, cells })
  const entries: Record<string, string> = {}
  for (let r = 1; r <= 1000; r++) entries[`B${r}`] = `=COUNTIF($A$1:A${r},">"&A${r})`
  const t = Date.now()
  writeCells(s, entries)
  assert.ok(Date.now() - t < 5000, `took ${Date.now() - t} ms`)
  assert.equal(s.read('B1').value, 0)
})

// ---------- 4. BINOM.INV / CRITBINOM ----------

test('BINOM.INV and CRITBINOM accept alpha 0 (gives 0) and 1 (gives trials)', () => {
  const s = typed({})
  assert.equal(calc(s, '=CRITBINOM(40,0.05,0)'), 0)
  assert.equal(calc(s, '=BINOM.INV(40,0.05,0)'), 0)
  assert.equal(calc(s, '=CRITBINOM(40,0.05,1)'), 40)
  assert.equal(calc(s, '=CRITBINOM(10,0.5,0.5)'), 5)
  assert.equal(calc(s, '=CRITBINOM(1000,0.003,0.95)'), 6)
  assert.equal(calc(s, '=CRITBINOM(10.9,0.5,0.99)'), 9)          // trials truncated
  assert.equal(calc(s, '=CRITBINOM(10,0,0.7)'), 0)
  assert.equal(calc(s, '=CRITBINOM(10,1,0.7)'), 10)
  for (const bad of ['=CRITBINOM(10,0.5,-0.1)', '=CRITBINOM(10,0.5,1.1)', '=CRITBINOM(10,1.5,0.5)', '=CRITBINOM(-1,0.5,0.5)']) {
    assert.equal(calc(s, bad), '#NUM!', bad)
  }
  // the smallest k with P(X <= k) >= alpha, checked against a direct sum
  const cdf = (n: number, p: number, k: number) => {
    let c = 0
    let pmf = (1 - p) ** n
    for (let i = 0; i <= k; i++) { c += pmf; pmf *= ((n - i) / (i + 1)) * (p / (1 - p)) }
    return c
  }
  for (const [n, p, a] of [[40, 0.05, 0.3], [1000, 0.004, 0.77], [25, 0.6, 0.01], [200, 0.5, 0.999]]) {
    const k = binomInv(n, p, a) as number
    assert.ok(cdf(n, p, k) >= a && (k === 0 || cdf(n, p, k - 1) < a), `${n} ${p} ${a} -> ${k}`)
  }
  assert.equal(binomInv(1e7, 0.5, 0.5), 5e6)
})

// ---------- 5. "" in arithmetic ----------

test('"" from a formula is not a number in arithmetic; empty cells stay 0', () => {
  const s = typed({ A1: '=""', A2: '5' }) // A3 empty
  assert.equal(calc(s, '=""-1'), '#VALUE!')
  assert.equal(calc(s, '=""*1'), '#VALUE!')
  assert.equal(calc(s, '=A1-A2'), '#VALUE!')
  assert.equal(calc(s, '=-A1'), '#VALUE!')
  assert.equal(calc(s, '=IFERROR(A1-A2,"x")'), 'x')
  assert.equal(calc(s, '=ROUND(A1,0)'), '#VALUE!')
  // unchanged: empty cells, comparisons, concatenation and functions that skip text
  assert.equal(calc(s, '=A3+1'), 1)
  assert.equal(calc(s, '=A3*2'), 0)
  assert.equal(calc(s, '=A1=""'), true)
  assert.equal(calc(s, '=A1=0'), false)
  assert.equal(calc(s, '=A3=0'), true)
  assert.equal(calc(s, '=A1&"x"'), 'x')
  assert.equal(calc(s, '=SUM(A1:A3)'), 5)
  assert.equal(calc(s, '=SUM(A1,A2)'), 5)
  assert.equal(calc(s, '=AVERAGE(A1:A3)'), 5)
  assert.equal(calc(s, '=COUNT(A1:A3)'), 1)
  assert.equal(calc(s, '=MAX(A1,A2)'), 5)
  assert.equal(calc(s, '=SUMPRODUCT(A1:A2,A1:A2)'), 25)
  assert.equal(calc(s, '=IF(A1="",0,A1-A2)'), 0)
})

// ---------- 6. 15 significant digits when a number becomes text ----------

test('& and text functions write numbers with up to 15 significant digits', () => {
  const s = typed({ B3: '=480/86400', B4: '=1/3' })
  assert.equal(calc(s, '=""&(1/3)'), '0.333333333333333')
  assert.equal(calc(s, '="<="&B3'), '<=0.00555555555555556')
  assert.equal(calc(s, '=TEXT(B4,"General")'), '0.333333333333333')
  assert.equal(calc(s, '=CONCATENATE("x",B4)'), 'x0.333333333333333')
  assert.equal(calc(s, '=LEN(B4)'), 17)
  assert.equal(calc(s, '=0.1+0.2&""'), '0.3')
  assert.equal(calc(s, '=1234567890123456&""'), '1.23456789012346E+15')
  assert.equal(calc(s, '=46202&"!"'), '46202!')
  assert.equal(calc(s, '=DATE(2026,6,29)&""'), '46202')
  assert.equal(calc(s, '=TRUE&""'), 'TRUE')
  assert.equal(excelNumberText(-2.5), '-2.5')
  assert.equal(excelNumberText(123456789012345), '123456789012345')
  assert.equal(excelNumberText(1e15), '1E+15')
  assert.equal(excelNumberText(1e-6), '1E-06')
  assert.equal(excelNumberText(0.0001), '0.0001')
  // a criterion built with & reads the same number back
  s.set('C1', '=B3')
  assert.equal(calc(s, '=COUNTIF(C1,"<="&B3)'), 1)
})

// ---------- 7. display and TEXT ----------

test('negative date/time values show ######## in a cell and give #VALUE! in TEXT', () => {
  const s = typed({ A1: '=TIME(1,0,0)-TIME(2,15,0)', B1: '=A1' })
  s.setFmt('B1', 'h:mm')
  assert.equal(s.display('A1'), DATE_OVERFLOW)
  assert.equal(s.display('B1'), DATE_OVERFLOW)
  assert.equal(calc(s, '=TEXT(A1,"h:mm")'), '#VALUE!')
  assert.equal(calc(s, '=TEXT(-1,"dd/mm/yyyy")'), '#VALUE!')
  assert.equal(formatNumber(-0.05, '[h]:mm:ss'), DATE_OVERFLOW)
  assert.equal(formatNumber(-0.05, '0.00'), '-0.05')               // only date/time formats
  assert.equal(formatText(-0.05, 'h:mm'), undefined)
})

test('time display rounds to the smallest unit shown and carries (cell and TEXT agree)', () => {
  const cases: [number, string, string][] = [
    [59.6, 'h:mm:ss', '0:01:00'], [59.6, '[h]:mm:ss', '0:01:00'], [59.6, 'mm:ss', '01:00'],
    [3599.6, 'h:mm:ss', '1:00:00'], [3599.6, '[h]:mm:ss', '1:00:00'], [119.6, 'h:mm:ss', '0:02:00'],
    [188.5, 'mm:ss', '03:09'], [188.4, 'mm:ss', '03:08'], [59.4, 'h:mm:ss', '0:00:59'],
    [1.26, 'ss.0', '01.3'], [3599.96, 'mm:ss.0', '00:00.0'],
  ]
  for (const [secs, fmt, shown] of cases) {
    assert.equal(formatNumber(secs / 86400, fmt), shown, `${secs} s in ${fmt}`)
    assert.equal(formatText(secs / 86400, fmt), shown, `TEXT ${secs} s in ${fmt}`)
  }
  const s = typed({ A1: '=188.5/86400', A2: '=59.6/86400' })
  s.setFmt('A1', 'mm:ss')
  s.setFmt('A2', 'h:mm:ss')
  assert.equal(s.display('A1'), '03:09')
  assert.equal(calc(s, '=TEXT(A1,"mm:ss")'), '03:09')
  assert.equal(s.display('A2'), '0:01:00')
  assert.equal(calc(s, '=TEXT(A2,"[h]:mm:ss")'), '0:01:00')
})

test('number formats round exact decimal halves away from zero (cell and TEXT agree)', () => {
  const cases: [number, string, string][] = [
    [2.175, '0.00', '2.18'], [1.005, '0.00', '1.01'], [-2.175, '0.00', '-2.18'], [59.995, '0.00', '60.00'],
    [636.255, '$#,##0.00', '$636.26'], [0.1225, '0.0%', '12.3%'], [1234.5, '#,##0', '1,235'], [2.5, '0', '3'],
    [2.4999, '0', '2'], [12345.5, '#,##0,', '12'], [0.004, '0.00;(0.00)', '0.00'],
  ]
  for (const [n, fmt, shown] of cases) {
    assert.equal(formatNumber(n, fmt), shown, `${n} in ${fmt}`)
    assert.equal(formatText(n, fmt), shown, `TEXT ${n} in ${fmt}`)
  }
  const s = typed({ A1: '2.175' })
  s.setFmt('A1', '0.00')
  assert.equal(s.display('A1'), '2.18')
  assert.equal(calc(s, '=TEXT(1.005,"0.00")'), '1.01')
  assert.equal(calc(s, '=TEXT(A1,"0.00")'), '2.18')
  assert.equal(calc(s, '=TEXT(Z9,"0.00")'), '0.00')                  // an empty cell is 0
  assert.equal(calc(s, '=TEXT("12.5","0.0")'), '12.5')
  assert.equal(calc(s, '=TEXT("abc","0.0")'), 'abc')
})

// ---------- 8. formula input: @ and scientific literals ----------

test('@ is implicit intersection: a range gives the cell in the formula\'s row or column, else #VALUE!', () => {
  const s = typed({ B4: '11', B5: '12', B6: '13', B7: '14', C4: '21', C5: '22', C6: '23', D4: '31', D5: '32', D6: '33' })
  assert.equal(calc(s, '=@B4:B7', 'F6'), 13)
  assert.equal(s.raw('F6'), '=@B4:B7')
  assert.equal(calc(s, '=@B4:B7', 'F9'), '#VALUE!')
  assert.equal(calc(s, '=@B4:D4', 'C9'), 21)                        // a row range intersects by column
  assert.equal(calc(s, '=@B4:D4', 'F9'), '#VALUE!')
  assert.equal(calc(s, '=@B4:D6', 'H5'), '#VALUE!')                  // a 2-D range needs both row and column
  assert.equal(calc(s, '=@B4:D6', 'C8'), '#VALUE!')
  assert.equal(calc(s, '=@B4:B7*2+1', 'F5'), 25)
  assert.equal(calc(s, '=@B5', 'F1'), 12)
  // INDEX returns a reference, so @INDEX intersects it too (Excel 365); an array gives its top-left value
  assert.equal(calc(s, '=@INDEX(B4:D6,2,0)', 'C10'), 22)
  assert.equal(calc(s, '=@INDEX(B4:D6,2,0)', 'F10'), '#VALUE!')
  assert.equal(calc(s, '=@INDEX(B4:D6,0,2)', 'F5'), 22)
  assert.equal(calc(s, '=@INDEX({1,2;3,4},2,0)', 'F11'), 3)
  assert.equal(calc(s, '=@INDEX(B4:D6,2,3)', 'F12'), 32)
  assert.equal(s.raw('F12'), '=@INDEX(B4:D6,2,3)')
  assert.equal(calc(s, '=SUM(@B4:B7,1)', 'F4'), 12)
  // fill moves the range like any reference; state and undo keep the @
  assert.deepEqual(s.fill('F6', 'F6:F7'), { ok: true })
  assert.equal(s.raw('F7'), '=@B5:B8')
  assert.equal(s.read('F7').value, 14)
  const again = createLabSheet(s.spec, { state: s.state() })
  assert.equal(again.raw('F7'), '=@B5:B8')
  assert.equal(again.read('F7').value, 14)
  // @ inside text is just text
  assert.equal(calc(s, '="a@b"&"@"', 'F13'), 'a@b@')
})

test('scientific literals in formulas are accepted', () => {
  const s = typed({ A1: '=1E-12', A2: '=2.5E+3', A3: '=A2*1E3', A4: '=.5E2', A5: '1E-12' })
  assert.equal(s.read('A1').value, 1e-12)
  assert.equal(s.read('A2').value, 2500)
  assert.equal(s.read('A3').value, 2500000)
  assert.equal(s.read('A4').value, 50)
  assert.equal(s.read('A5').value, 1e-12)                          // a typed constant, unchanged
  assert.equal(calc(s, '="1E5"&"x"'), '1E5x')                       // text keeps its E
  assert.equal(calc(s, '=E1+1'), 1)                                  // E1 is still a reference
})

test('formula text rewriting is exact outside the rewritten parts', () => {
  const same = ['=SUM(A1:A3)', '=IF(A1>0,"@x",B2)', '=COUNTIF(A:A,">=5")', "='My Sheet'!A1+1", '=SUMIFS(C1:C9,A1:A9,"x")',
    '=SUMIF(A1:A9,"x",C1:C9)', '=SUMIF(A1:A9,"x")', '=LOG10(E2)', '={1,2;3,4}']
  for (const f of same) {
    assert.equal(toEngineFormula(f), f, f)
    assert.equal(toDisplayFormula(f), f, f)
  }
  assert.equal(toEngineFormula('=@A1:A9'), '=SINGLE(A1:A9)')
  assert.equal(toEngineFormula('=@ INDEX(A1:C3,2,0)+@(B1:B3)'), '=SINGLE(INDEX(A1:C3,2,0))+SINGLE((B1:B3))')
  assert.equal(toEngineFormula('=1E-12+2.5E+3'), '=1e-12+2.5e+3')
  assert.equal(toEngineFormula('=SUMIF(D9:D68,N26,I9)'), '=SUMIF(D9:D68,N26,I9,I9:I68)')
  assert.equal(toEngineFormula('=SUMIF($D$9:$D$68,N26,$I$9)'), '=SUMIF($D$9:$D$68,N26,$I$9,$I$9:$I$68)')
  assert.equal(toEngineFormula('=averageif(A1:B3, ">0", C1)'), '=averageif(A1:B3, ">0", C1,C1:D3)')
  assert.equal(toDisplayFormula('=SUMIF(D9:D68,N26,I9,I9:I68)'), '=SUMIF(D9:D68,N26,I9)')
  assert.equal(toDisplayFormula('=SUMIF(D9:D68,N26,I9,J9:J68)'), '=SUMIF(D9:D68,N26,I9,J9:J68)')
  assert.equal(toDisplayFormula('=SINGLE(A1:A9)*2'), '=@A1:A9*2')
  assert.equal(toDisplayFormula('=SINGLE(A1:A9*2)'), '=@(A1:A9*2)')
  assert.equal(resizedSumRange('$D$9:D68', '$I$9'), '$I$9:I68')      // a growing range keeps growing when filled
  assert.equal(resizedSumRange('$D$9:D68', 'I9'), undefined)         // cannot be written as one range: left to SUMIF
  assert.equal(resizedSumRange('A1:A5', 'B1:B9'), undefined)         // already big enough
  const p = parseInput('=@B4:B10')
  assert.deepEqual(p, { kind: 'formula', formula: '=SINGLE(B4:B10)' })
})

// ---------- 9, 10. hints ----------

test('#DIV/0! hint does not suggest IFERROR; #CYCLE! hint covers intended and accidental loops', () => {
  const s = typed({ A1: '=1/0', B1: '=B2+1', B2: '=B1*2' })
  const div = s.read('A1')
  assert.equal(div.kind, 'error')
  assert.ok(div.kind === 'error' && !/IFERROR/i.test(div.hint ?? '') && /divisor/i.test(div.hint ?? '') && /IF\(/.test(div.hint ?? ''))
  const cyc = s.read('B1')
  assert.ok(cyc.kind === 'error' && cyc.value === '#CYCLE!')
  const hint = cyc.kind === 'error' ? cyc.hint ?? '' : ''
  assert.match(hint, /refers back to itself, directly or through other cells/)
  assert.match(hint, /If that is intended .*turn on Iterative calculation; otherwise fix the reference/)
  assert.doesNotMatch(hint, /helper/)
})
