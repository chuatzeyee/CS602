// tools.test.ts - decision tools (Week 10): Advanced Filter criteria, AutoFilter, Sort, PivotTable.
// Dataset and expected answers: site_build/notes/pivot_filter_notes.md section 4 (computed there by an independent
// Python engine); every expectation is also re-derived here with plain predicates over the records.
// Run: npx tsx --test tests/tools.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CellValue, LabSheet } from '../src/lab/types.ts'
import { filterList, matchCriterion, parseCriterion, regionBox, runAdvancedFilter, applyAdvancedFilter, wildcardRegex } from '../src/lab/tools/advFilter.ts'
import { autoFilterRows, applyAutoFilter, getAutoFilter, parseAutoFilterSetup } from '../src/lab/tools/autoFilter.ts'
import type { ColumnFilter } from '../src/lab/tools/autoFilter.ts'
import { applySort, compareCells, customListOf, looksLikeHeaders, parseSortSetup, sortOrder } from '../src/lab/tools/sort.ts'
import { applyPivot, buildPivot, pivotConflict, pivotFromData } from '../src/lab/tools/pivot.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import { applyTool } from '../src/lab/tools/index.ts'

const CSV = `HC-1001,2026-01-05,Hougang Heartland Hotel,North-East,Hotel,Single Origin Sumatra,29,36.00,1044.00,NEW10,Paid
HC-1002,2026-01-06,BeanBox Online,West,Online,Single Origin Sumatra,43,36.00,1548.00,VIP10,Paid
HC-1003,2026-01-07,KopiCart Online,East,Online,Espresso Decaf,40,30.60,1224.00,NEW15,Paid
HC-1004,2026-01-08,Kopi Corner Novena,Central,Cafe,Espresso Classic,15,27.20,408.00,NEW15,Paid
HC-1005,2026-01-09,Jurong Lakeside Hotel,West,Hotel,Espresso Decaf,18,36.00,648.00,,Paid
HC-1006,2026-01-13,KopiCart Online,East,Online,Cold Brew Concentrate,33,27.00,891.00,VIP10,Paid
HC-1007,2026-01-14,CBD Cowork Hub,Central,Office,Espresso Classic,27,28.80,777.60,NEW10,Paid
HC-1008,2026-01-16,Sembawang Sands Resort,North,Hotel,Espresso Classic,17,27.20,462.40,NEW15,Paid
HC-1009,2026-01-26,Woodlands Brew Bar,North,Cafe,Single Origin Kenya,16,44.00,704.00,,Paid
HC-1010,2026-01-29,BeanBox Online,West,Online,Cold Brew Concentrate,43,27.00,1161.00,VIP10,Paid
HC-1011,2026-02-04,Jurong Lakeside Hotel,West,Hotel,House Blend,28,24.70,691.60,VIP5,Paid
HC-1012,2026-02-09,Kopi Corner Novena,Central,Cafe,Espresso Classic,5,32.00,160.00,,Paid
HC-1013,2026-02-11,Sembawang Sands Resort,North,Hotel,Espresso Classic,17,32.00,544.00,,Paid
HC-1014,2026-02-13,Kopi Corner Novena,Central,Cafe,Espresso Decaf,10,36.00,360.00,,Paid
HC-1015,2026-02-14,Sembawang Sands Resort,North,Hotel,House Blend,13,26.00,338.00,,Paid
HC-1016,2026-02-17,Hougang Heartland Hotel,North-East,Hotel,Espresso Decaf,34,32.40,1101.60,VIP10,Paid
HC-1017,2026-02-19,Sengkang Social,North-East,Cafe,Single Origin Sumatra,15,40.00,600.00,,Paid
HC-1018,2026-02-23,Woodlands Brew Bar,North,Cafe,Espresso Classic,14,32.00,448.00,,Paid
HC-1019,2026-02-25,Bedok Beanery,East,Cafe,Espresso Classic,14,28.80,403.20,NEW10,Paid
HC-1020,2026-02-26,Changi Bizpark Pantry,East,Office,House Blend,13,26.00,338.00,,Overdue
HC-1021,2026-03-02,Punggol Digital Pantry,North-East,Office,Cold Brew Concentrate,24,30.00,720.00,,Paid
HC-1022,2026-03-04,Yishun Yard Cafe,North,Cafe,Single Origin Sumatra,13,40.00,520.00,,Paid
HC-1023,2026-03-06,Sembawang Sands Resort,North,Hotel,Single Origin Sumatra,11,40.00,440.00,,Overdue
HC-1024,2026-03-10,Yishun Yard Cafe,North,Cafe,Single Origin Sumatra,7,40.00,280.00,,Paid
HC-1025,2026-03-12,Sengkang Social,North-East,Cafe,Single Origin Sumatra,10,40.00,400.00,,Paid
HC-1026,2026-03-18,Bedok Beanery,East,Cafe,Espresso Decaf,9,36.00,324.00,,Paid
HC-1027,2026-03-21,Punggol Point Cafe,North-East,Cafe,Espresso Decaf,7,36.00,252.00,,Paid
HC-1028,2026-03-26,BeanBox Online,West,Online,Espresso Decaf,31,32.40,1004.40,VIP10,Overdue
HC-1029,2026-03-27,KopiCart Online,East,Online,Single Origin Kenya,39,39.60,1544.40,VIP10,Paid
HC-1030,2026-03-30,Punggol Point Cafe,North-East,Cafe,Single Origin Sumatra,4,40.00,160.00,,Paid
HC-1031,2026-04-01,Tiong Bahru Bakehouse,Central,Cafe,House Blend,5,26.00,130.00,,Overdue
HC-1032,2026-04-02,Marina Suites Hotel,Central,Hotel,Espresso Decaf,35,34.20,1197.00,VIP5,Overdue
HC-1033,2026-04-06,Bedok Beanery,East,Cafe,Single Origin Kenya,8,44.00,352.00,,Paid
HC-1034,2026-04-13,Marina Suites Hotel,Central,Hotel,Espresso Classic,16,32.00,512.00,,Paid
HC-1035,2026-04-21,Changi Bizpark Pantry,East,Office,House Blend,23,26.00,598.00,,Paid
HC-1036,2026-04-22,Bedok Beanery,East,Cafe,Espresso Classic,18,32.00,576.00,,Paid
HC-1037,2026-04-24,Jurong Lakeside Hotel,West,Hotel,Espresso Classic,27,32.00,864.00,,Overdue
HC-1038,2026-04-25,CBD Cowork Hub,Central,Office,House Blend,9,26.00,234.00,,Paid
HC-1039,2026-04-27,Clementi Campus Canteen,West,Office,Cold Brew Concentrate,6,30.00,180.00,,Paid
HC-1040,2026-04-29,Tiong Bahru Bakehouse,Central,Cafe,Single Origin Kenya,9,44.00,396.00,,Paid
HC-1041,2026-05-01,CBD Cowork Hub,Central,Office,Espresso Classic,20,32.00,640.00,,Paid
HC-1042,2026-05-05,BeanBox Online,West,Online,Single Origin Kenya,18,44.00,792.00,,Paid
HC-1043,2026-05-06,Hougang Heartland Hotel,North-East,Hotel,Espresso Decaf,19,36.00,684.00,,Paid
HC-1044,2026-05-08,Marina Suites Hotel,Central,Hotel,House Blend,24,26.00,624.00,,Paid
HC-1045,2026-05-15,Orchard Grand Hotel,Central,Hotel,Espresso Classic,24,32.00,768.00,,Paid
HC-1046,2026-05-16,Kopi Corner Novena,Central,Cafe,Espresso Classic,14,32.00,448.00,,Paid
HC-1047,2026-05-20,Kopi Corner Novena,Central,Cafe,Espresso Classic,17,32.00,544.00,,Paid
HC-1048,2026-05-22,Clementi Campus Canteen,West,Office,Cold Brew Concentrate,28,30.00,840.00,,Paid
HC-1049,2026-05-25,KopiCart Online,East,Online,Espresso Decaf,35,36.00,1260.00,,Overdue
HC-1050,2026-05-28,Orchard Grand Hotel,Central,Hotel,Espresso Decaf,35,34.20,1197.00,VIP5,Overdue
HC-1051,2026-06-01,Clementi Campus Canteen,West,Office,Espresso Classic,6,32.00,192.00,,Paid
HC-1052,2026-06-04,Sengkang Social,North-East,Cafe,Cold Brew Concentrate,14,30.00,420.00,,Pending
HC-1053,2026-06-05,Punggol Point Cafe,North-East,Cafe,Single Origin Kenya,17,44.00,748.00,,Pending
HC-1054,2026-06-12,Tiong Bahru Bakehouse,Central,Cafe,Cold Brew Concentrate,4,30.00,120.00,,Pending
HC-1055,2026-06-17,Changi Bizpark Pantry,East,Office,House Blend,22,26.00,572.00,,Pending
HC-1056,2026-06-19,Punggol Digital Pantry,North-East,Office,Cold Brew Concentrate,15,30.00,450.00,,Pending
HC-1057,2026-06-22,Sembawang Sands Resort,North,Hotel,Espresso Classic,12,32.00,384.00,,Pending
HC-1058,2026-06-23,Punggol Digital Pantry,North-East,Office,House Blend,21,26.00,546.00,,Pending
HC-1059,2026-06-29,Yishun Yard Cafe,North,Cafe,Espresso Classic,4,32.00,128.00,,Paid
HC-1060,2026-06-30,Woodlands Brew Bar,North,Cafe,Espresso Classic,14,32.00,448.00,,Paid`

const HEAD = ['OrderID', 'OrderDate', 'Customer', 'Region', 'Channel', 'Blend', 'Qty', 'UnitPrice', 'Revenue', 'PromoCode', 'Status']
const C = Object.fromEntries(HEAD.map((h, i) => [h, i])) as Record<string, number>
// Excel serial of an ISO date (1900 system)
const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
}
const ROWS: CellValue[][] = CSV.split('\n').map(line => line.split(',').map((x, j) => {
  if (x === '') return null
  if (j === C.OrderDate) return serial(x)
  if (j === C.Qty || j === C.UnitPrice || j === C.Revenue) return Number(x)
  return x
}))
const LIST = { headers: HEAD as CellValue[], rows: ROWS }
const ids = (idx: number[]) => idx.map(i => ROWS[i][0] as string)
const where = (pred: (r: Record<string, CellValue>) => boolean) =>
  ROWS.map((r, i) => ({ r: Object.fromEntries(HEAD.map((h, j) => [h, r[j]])), i })).filter(x => pred(x.r)).map(x => x.i)
const money = (idx: number[]) => Math.round(idx.reduce((s, i) => s + (ROWS[i][C.Revenue] as number), 0) * 100) / 100
const HC = (...n: number[]) => n.map(x => `HC-${1000 + x}`)

// criteria grid helper: header row + value rows
const crit = (headers: CellValue[], ...rows: CellValue[][]) => ({ headers, rows })
const run = (criteria: ReturnType<typeof crit> | null, extra: Partial<Parameters<typeof filterList>[0]> = {}) => {
  const out = filterList({ list: LIST, criteria, ...extra })
  assert.equal(out.error, undefined)
  return out.matches
}

test('dataset matches the notes (60 orders, revenue 36,341.20, 1,118 bags)', () => {
  assert.equal(ROWS.length, 60)
  assert.equal(money(ROWS.map((_, i) => i)), 36341.2)
  assert.equal(ROWS.reduce((s, r) => s + (r[C.Qty] as number), 0), 1118)
  assert.equal(ROWS[0][C.OrderDate], 46027)   // 5 Jan 2026
})

test('criteria cells: operators, numbers, dates as text, booleans', () => {
  const m = (c: CellValue, v: CellValue) => {
    const p = parseCriterion(c)
    return p === null ? true : matchCriterion(p, v)
  }
  assert.equal(parseCriterion(null), null)
  assert.equal(parseCriterion(''), null)
  assert.ok(m('>=30', 30) && m('>=30', 31) && !m('>=30', 29))
  assert.ok(m('<30', 29.99) && !m('<30', 30))
  assert.ok(m('<>5', 4) && !m('<>5', 5) && m('<>5', 'abc') && m('<>5', null))
  assert.ok(m('>5', 6) && !m('>5', 'abc') && !m('>5', null))          // numeric operand: text and blanks never pass
  assert.ok(m(20, 20) && !m(20, 21) && m('20', 20))                   // plain number = equality
  assert.ok(m('>=1 Mar 2026', serial('2026-03-01')) && !m('>=1 Mar 2026', serial('2026-02-28')))
  assert.ok(m('<=31 March 2026', serial('2026-03-31')) && !m('<=31 March 2026', serial('2026-04-01')))
  assert.ok(m('=2026-03-02', serial('2026-03-02')) && m('>01/03/2026', serial('2026-03-02')) && !m('>01/03/2026', serial('2026-03-01')))
  assert.ok(m('>10%', 0.11) && !m('>10%', 0.1) && m('>$1,000', 1000.5))
  assert.ok(m(true, true) && !m(true, false) && m('=FALSE', false) && m('<>TRUE', false))
  assert.ok(m('>M', 'North') && !m('>M', 'East') && m('<=east', 'East') && !m('>M', 5))   // text order, case ignored
  assert.ok(m('=', null) && m('=', '') && !m('=', 'x') && m('<>', 'x') && !m('<>', null))   // = alone: blanks only
})

test('criteria cells: begins-with by default, ="=text" exact, wildcards and ~ escapes', () => {
  const m = (c: CellValue, v: CellValue) => matchCriterion(parseCriterion(c)!, v)
  assert.ok(m('North', 'North') && m('North', 'North-East') && m('north', 'NORTH') && !m('North', 'West'))
  assert.ok(m('=North', 'North') && !m('=North', 'North-East') && m('=north', 'North'))
  assert.ok(m('<>North', 'North-East') && !m('<>North', 'north'))
  assert.ok(m('=*Hotel*', 'Hougang Heartland Hotel') && !m('=*Hotel*', 'Sembawang Sands Resort'))
  assert.ok(m('=VIP?', 'VIP5') && !m('=VIP?', 'VIP10') && m('VIP?', 'VIP10'))   // plain VIP? = begins with VIP + 1 char
  assert.ok(m('=???10', 'NEW10') && m('=*10', 'VIP10') && !m('=*10', 'NEW15'))
  assert.ok(m('=?u*', 'Sumatra') && !m('=?u*', 'Kenya'))
  assert.ok(m('=T-1?', 'T-10') && !m('=T-1?', 'T-1') && !m('=T-1?', 'T-100') && !m('=T-1?', 'TX-10'))
  assert.ok(m('=a~*b', 'a*b') && !m('=a~*b', 'axb') && m('=what~?', 'what?') && !m('=what~?', 'whatx') && m('=x~~y', 'x~y'))
  assert.ok(m('=(1+1)', '(1+1)') && m('=a.c', 'a.c') && !m('=a.c', 'abc'))   // regex characters are literal
  assert.ok(!m('1*', 1044) && !m('=*', 5))   // wildcards only match text
  assert.ok(wildcardRegex('ab', 'contains').test('xxABxx') && wildcardRegex('b', 'ends').test('AB'))
})

test('Demo-Advanced-Filter: AND on one row, OR down the rows, blank = show all', () => {
  const demo = { headers: ['Name', 'Gender', 'Address', 'Age'] as CellValue[], rows: [['Michelle', 'F', 'Yishun', 38], ['ABC', 'M', 'AMK', 35], ['DEF', 'F', 'HM', 40], ['GGG', 'M', 'gregd', 25]] as CellValue[][] }
  const names = (c: ReturnType<typeof crit>) => filterList({ list: demo, criteria: c }).matches.map(i => demo.rows[i][0])
  assert.deepEqual(names(crit(['Gender', 'Age', 'Address'], ['F', '>=30', null])), ['Michelle', 'DEF'])
  assert.deepEqual(names(crit(['Gender', 'Age'], ['F', '>=30'], ['M', '<30'])), ['Michelle', 'DEF', 'GGG'])
  assert.deepEqual(names(crit(['Gender', 'Age'])), ['Michelle', 'ABC', 'DEF', 'GGG'])               // headers only
  assert.deepEqual(names(crit(['Gender', 'Age'], ['F', '>=30'], [null, null])), ['Michelle', 'ABC', 'DEF', 'GGG'])   // blank row
  assert.deepEqual(names(crit([' gender ', 'AGE'], ['f', '>=30'])), ['Michelle', 'DEF'])           // headers trimmed, any case
})

test('AF1 Hotel orders of 20+ bags (AND)', () => {
  const got = run(crit(['Channel', 'Qty'], ['=Hotel', '>=20']))
  assert.deepEqual(ids(got), HC(1, 11, 16, 32, 37, 44, 45, 50))
  assert.deepEqual(got, where(r => r.Channel === 'Hotel' && (r.Qty as number) >= 20))
  assert.equal(money(got), 7487.2)
  assert.deepEqual(run(crit(['Channel', 'Qty'], ['Hotel', '>=20'])), got)   // plain Hotel works too
})

test('AF2 North or West: exact match vs the begins-with trap', () => {
  const got = run(crit(['Region'], ['=North'], ['=West']))
  assert.deepEqual(ids(got), HC(2, 5, 8, 9, 10, 11, 13, 15, 18, 22, 23, 24, 28, 37, 39, 42, 48, 51, 57, 59, 60))
  assert.deepEqual(got, where(r => r.Region === 'North' || r.Region === 'West'))
  assert.equal(money(got), 12617.4)
  const trap = run(crit(['Region'], ['North'], ['West']))
  assert.equal(trap.length, 33)
  assert.equal(money(trap), 19743)
})

test('AF3 OR of AND groups, and the one-row trap', () => {
  const got = run(crit(['Region', 'Channel', 'Revenue'], ['=Central', '=Office', null], ['=East', null, '>600']))
  assert.deepEqual(ids(got), HC(3, 6, 7, 29, 38, 41, 49))
  assert.deepEqual(got, where(r => (r.Region === 'Central' && r.Channel === 'Office') || (r.Region === 'East' && (r.Revenue as number) > 600)))
  assert.equal(money(got), 6571)
  assert.equal(run(crit(['Region', 'Region'], ['=Central', '=East'])).length, 0)
})

test('AF4 date window: repeated header = between; separate rows = everything', () => {
  const got = run(crit(['OrderDate', 'OrderDate'], ['>=1 Mar 2026', '<=31 Mar 2026']))
  assert.deepEqual(ids(got), HC(21, 22, 23, 24, 25, 26, 27, 28, 29, 30))
  assert.deepEqual(got, where(r => (r.OrderDate as number) >= serial('2026-03-01') && (r.OrderDate as number) <= serial('2026-03-31')))
  assert.equal(money(got), 5644.8)
  assert.equal(run(crit(['OrderDate'], ['>=1 Mar 2026'], ['<=31 Mar 2026'])).length, 60)
  assert.deepEqual(run(crit(['OrderDate', 'OrderDate'], ['>=2026-03-01', '<2026-04-01'])), got)
})

test('AF5 / AF6 wildcards: contains Hotel, ? versus *', () => {
  const hotel = run(crit(['Customer'], ['=*Hotel*']))
  assert.equal(hotel.length, 11)
  assert.equal(money(hotel), 9331.2)
  assert.deepEqual(hotel, where(r => String(r.Customer).includes('Hotel')))
  const channel = run(crit(['Channel'], ['=Hotel']))
  assert.equal(channel.length, 16)
  assert.equal(money(channel), 11499.6)
  assert.deepEqual(ids(channel.filter(i => !hotel.includes(i))), HC(8, 13, 15, 23, 57))
  const promo = (c: string) => ids(run(crit(['PromoCode'], [c])))
  assert.deepEqual(promo('=VIP?'), HC(11, 32, 50))
  assert.deepEqual(promo('=VIP*'), HC(2, 6, 10, 11, 16, 28, 29, 32, 50))
  assert.deepEqual(promo('VIP'), promo('=VIP*'))
  assert.deepEqual(promo('=NEW1?'), HC(1, 3, 4, 7, 8, 19))
  assert.deepEqual(promo('=???10'), HC(1, 2, 6, 7, 10, 16, 19, 28, 29))
  assert.deepEqual(promo('=*10'), promo('=???10'))
  assert.equal(promo('VIP?').length, 9)   // plain VIP? also keeps VIP10
  assert.equal(promo('=').length, 45)      // = alone: orders without a code
})

test('AF7 computed criteria: formula for the first record, evaluated per record', () => {
  const avg = 36341.2 / 60
  const seen: string[] = []
  const evaluate = (formula: string, k: number): CellValue => {
    seen.push(formula)
    if (formula === '=I9>AVERAGE($I$9:$I$68)') return (ROWS[k][C.Revenue] as number) > avg
    if (formula === '=WEEKDAY(B9,2)>5') return new Date(Date.UTC(1899, 11, 30) + (ROWS[k][C.OrderDate] as number) * 86400000).getUTCDay() % 6 === 0
    return null
  }
  const formulas = (...f: (string | null)[]) => [f]
  const above = filterList({ list: LIST, criteria: { headers: ['AboveAvg'], rows: [[true]], formulas: formulas('=I9>AVERAGE($I$9:$I$68)') }, evaluate }).matches
  assert.deepEqual(ids(above), HC(1, 2, 3, 5, 6, 7, 9, 10, 11, 16, 21, 28, 29, 32, 37, 41, 42, 43, 44, 45, 48, 49, 50, 53))
  assert.equal(money(above), 22673.6)
  assert.ok(seen.every(f => f === '=I9>AVERAGE($I$9:$I$68)'))
  // blank header works too, AND with an ordinary criterion on the same row
  const overdue = filterList({ list: LIST, criteria: { headers: [null, 'Status'], rows: [[false, '=Overdue']], formulas: formulas('=I9>AVERAGE($I$9:$I$68)', null) }, evaluate }).matches
  assert.deepEqual(ids(overdue), HC(28, 32, 37, 49, 50))
  assert.equal(money(overdue), 5522.4)
  const weekend = filterList({ list: LIST, criteria: { headers: ['Weekend'], rows: [[false]], formulas: formulas('=WEEKDAY(B9,2)>5') }, evaluate }).matches
  assert.deepEqual(ids(weekend), HC(15, 27, 38, 46))
  // a real header makes Excel compare the field with TRUE/FALSE: nothing passes
  assert.equal(filterList({ list: LIST, criteria: { headers: ['Revenue'], rows: [[true]], formulas: formulas('=I9>AVERAGE($I$9:$I$68)') }, evaluate }).matches.length, 0)
  // without an engine a computed criterion is an error, a constant TRUE under a non-field header passes all
  assert.ok(filterList({ list: LIST, criteria: { headers: ['X'], rows: [[true]], formulas: formulas('=I9>1') } }).error)
  assert.equal(run(crit(['NotAField'], [true])).length, 60)
})

test('AF8 unique records on the copied column keep the first of each, in list order', () => {
  const all = run(crit(['Blend'], ['Single Origin']))
  assert.equal(all.length, 14)
  assert.deepEqual(all, where(r => String(r.Blend).startsWith('Single Origin')))
  const uniq = run(crit(['Blend'], ['Single Origin']), { unique: true, uniqueCols: [C.Customer] })
  assert.deepEqual(uniq.map(i => ROWS[i][C.Customer]), [
    'Hougang Heartland Hotel', 'BeanBox Online', 'Woodlands Brew Bar', 'Sengkang Social', 'Yishun Yard Cafe',
    'Sembawang Sands Resort', 'KopiCart Online', 'Punggol Point Cafe', 'Bedok Beanery', 'Tiong Bahru Bakehouse',
  ])
  assert.equal(run(crit(['Blend'], ['Single Origin']), { unique: true }).length, 14)   // whole records: no duplicates
  assert.equal(run(null, { unique: true, uniqueCols: [C.Region] }).length, 5)
})

// ---------- AutoFilter ----------

const af = (...filters: { col: string; filter: ColumnFilter }[]) => autoFilterRows(ROWS, filters.map(f => ({ col: C[f.col], filter: f.filter })))

test('T1 Top 10: Top 5 items shows 6 rows (tie at the cut-off), Bottom 3 Qty', () => {
  const top5 = af({ col: 'Revenue', filter: { type: 'top10', top: true, count: 5 } })
  assert.deepEqual(new Set(ids(top5)), new Set(HC(2, 29, 49, 3, 32, 50)))
  const fifth = [...ROWS.map(r => r[C.Revenue] as number)].sort((a, b) => b - a)[4]
  assert.deepEqual(top5, where(r => (r.Revenue as number) >= fifth))
  assert.deepEqual(ids(af({ col: 'Qty', filter: { type: 'top10', top: false, count: 3 } })), HC(30, 54, 59))
  const q4 = autoFilterRows([[500], [450], [450], [450], [300], [200]], [{ col: 0, filter: { type: 'top10', count: 3 } }])
  assert.equal(q4.length, 4)
  assert.equal(af({ col: 'Revenue', filter: { type: 'top10', count: 10, percent: true } }).length, 6)   // 10% of 60 = 6
  assert.equal(af({ col: 'Qty', filter: { type: 'top10', top: false, count: 5, percent: true } }).length, 3)
  assert.equal(af({ col: 'Revenue', filter: { type: 'top10', count: 500 } }).length, 60)
  assert.equal(af({ col: 'Customer', filter: { type: 'top10', count: 5 } }).length, 0)   // text column: nothing
})

test('AutoFilter number, date and text filters; columns combine with AND', () => {
  assert.equal(af({ col: 'Revenue', filter: { type: 'average', above: true } }).length, 24)
  assert.equal(af({ col: 'Revenue', filter: { type: 'average', above: false } }).length, 36)
  const between = af({ col: 'Qty', filter: { type: 'custom', rules: [{ op: 'ge', value: 10 }, { op: 'le', value: 20 }], join: 'and' } })
  assert.deepEqual(between, where(r => (r.Qty as number) >= 10 && (r.Qty as number) <= 20))
  const outside = af({ col: 'Qty', filter: { type: 'custom', rules: [{ op: 'lt', value: 10 }, { op: 'gt', value: 30 }], join: 'or' } })
  assert.deepEqual(outside, where(r => (r.Qty as number) < 10 || (r.Qty as number) > 30))
  const march = af({ col: 'OrderDate', filter: { type: 'custom', rules: [{ op: 'ge', value: '1 Mar 2026' }, { op: 'le', value: '31 Mar 2026' }] } })
  assert.equal(march.length, 10)
  assert.deepEqual(af({ col: 'OrderDate', filter: { type: 'custom', rules: [{ op: 'eq', value: '14 Feb 2026' }] } }), where(r => r.OrderID === 'HC-1015'))
  assert.equal(af({ col: 'Customer', filter: { type: 'custom', rules: [{ op: 'contains', value: 'hotel' }] } }).length, 11)
  assert.equal(af({ col: 'Customer', filter: { type: 'custom', rules: [{ op: 'notContains', value: 'Hotel' }] } }).length, 49)
  assert.deepEqual(af({ col: 'Customer', filter: { type: 'custom', rules: [{ op: 'begins', value: 'Kopi' }] } }), where(r => String(r.Customer).startsWith('Kopi')))
  assert.deepEqual(af({ col: 'Customer', filter: { type: 'custom', rules: [{ op: 'ends', value: 'online' }] } }), where(r => String(r.Customer).endsWith('Online')))
  assert.deepEqual(af({ col: 'Region', filter: { type: 'custom', rules: [{ op: 'eq', value: 'North' }] } }), where(r => r.Region === 'North'))
  assert.deepEqual(af({ col: 'Region', filter: { type: 'custom', rules: [{ op: 'ne', value: 'North*' }] } }), where(r => !String(r.Region).startsWith('North')))
  assert.deepEqual(af({ col: 'PromoCode', filter: { type: 'custom', rules: [{ op: 'eq', value: 'VIP?' }] } }), where(r => r.PromoCode === 'VIP5'))
  assert.equal(af({ col: 'PromoCode', filter: { type: 'custom', rules: [{ op: 'notBegins', value: 'NEW' }] } }).length, 54)   // blanks pass
  assert.equal(af({ col: 'Region', filter: { type: 'values', values: ['North', 'west'] } }).length, 21)
  assert.equal(af({ col: 'PromoCode', filter: { type: 'values', values: [], blanks: true } }).length, 45)
  assert.equal(af({ col: 'PromoCode', filter: { type: 'values', values: ['(Blanks)', 'VIP5'] } }).length, 48)
  assert.deepEqual(af({ col: 'Qty', filter: { type: 'values', values: ['4', 43] } }), where(r => r.Qty === 4 || r.Qty === 43))
  assert.deepEqual(af({ col: 'OrderDate', filter: { type: 'values', values: ['14 Feb 2026'] } }), where(r => r.OrderID === 'HC-1015'))
  const and = af({ col: 'Channel', filter: { type: 'values', values: ['Hotel'] } }, { col: 'Qty', filter: { type: 'custom', rules: [{ op: 'ge', value: 20 }] } })
  assert.deepEqual(ids(and), HC(1, 11, 16, 32, 37, 44, 45, 50))
  const codes = [['T-1'], ['T-10'], ['T-100'], ['TX-10']] as CellValue[][]
  const eq = (v: string) => autoFilterRows(codes, [{ col: 0, filter: { type: 'custom', rules: [{ op: 'eq', value: v }] } }]).map(i => codes[i][0])
  assert.deepEqual(eq('T-1?'), ['T-10'])
  assert.deepEqual(eq('T-1*'), ['T-1', 'T-10', 'T-100'])
})

test('AutoFilter setup validation', () => {
  assert.equal(typeof parseAutoFilterSetup({}), 'string')
  assert.equal(typeof parseAutoFilterSetup({ range: 'A8:K68', columns: [{ column: 'Qty', filter: { type: 'top10', count: 0 } }] }), 'string')
  assert.equal(typeof parseAutoFilterSetup({ range: 'A8:K68', columns: [{ column: 'Qty', filter: { type: 'custom', rules: [{ op: 'like', value: 1 }] } }] }), 'string')
  assert.deepEqual(parseAutoFilterSetup({ range: 'A8', columns: [] }), { range: 'A8', columns: [] })
})

// ---------- Sort ----------

test('Sort order: numbers, text, FALSE, TRUE, errors, blanks last (also descending)', () => {
  const vals: CellValue[] = ['b', null, 3, true, '#N/A', 'A', false, -1, '', 'a']
  const rows = vals.map(v => [v])
  const asc = sortOrder(rows, [{ col: 0, order: 'asc' }]).map(i => vals[i])
  assert.deepEqual(asc, [-1, 3, 'A', 'a', 'b', false, true, '#N/A', null, ''])
  const desc = sortOrder(rows, [{ col: 0, order: 'desc' }]).map(i => vals[i])
  assert.deepEqual(desc, ['#N/A', true, false, 'b', 'A', 'a', 3, -1, null, ''])
  assert.ok(compareCells('apple', 'Banana') < 0 && compareCells(10, 9) > 0 && compareCells('Item 10', 'Item 2') < 0)
})

test('Sort: custom lists, stability, several levels', () => {
  const vals: CellValue[] = ['High', 'low', 'Urgent', 'Medium', null, 'Low', 'high', 'Another']
  const order = sortOrder(vals.map(v => [v]), [{ col: 0, order: 'custom', list: customListOf('Low,Medium,High') }]).map(i => vals[i])
  assert.deepEqual(order, ['low', 'Low', 'Medium', 'High', 'high', 'Another', 'Urgent', null])
  assert.deepEqual(customListOf('Jan-Dec').slice(0, 3), ['Jan', 'Feb', 'Mar'])
  assert.deepEqual(customListOf(['x', ' y ']), ['x', 'y'])
  const months: CellValue[] = ['Mar', 'Jan', 'Dec', 'Feb']
  assert.deepEqual(sortOrder(months.map(m => [m]), [{ col: 0, order: 'custom', list: customListOf('Jan-Dec') }]).map(i => months[i]), ['Jan', 'Feb', 'Mar', 'Dec'])
  // Region A to Z, then Revenue largest first; equal keys keep list order
  const p = sortOrder(ROWS, [{ col: C.Region, order: 'asc' }, { col: C.Revenue, order: 'desc' }])
  assert.deepEqual(ids(p.slice(0, 3)), HC(32, 50, 7))    // Central: 1197, 1197 (list order kept), 777.60
  const regions = p.map(i => ROWS[i][C.Region])
  assert.deepEqual([...new Set(regions)], ['Central', 'East', 'North', 'North-East', 'West'])
  assert.ok(looksLikeHeaders([HEAD, ...ROWS.slice(0, 3)]))
  assert.ok(!looksLikeHeaders(ROWS.slice(0, 4)))                      // starts at a record: HC-1001, a date, ...
  assert.ok(looksLikeHeaders([['Name'], ['Ann'], ['Bob']]) && !looksLikeHeaders([['Name', null], ['Ann', 1]]))
  assert.equal(typeof parseSortSetup({ range: 'A1', levels: [] }), 'string')
  assert.equal(typeof parseSortSetup({ range: 'A1', levels: [{ column: 'A', order: 'custom' }] }), 'string')
  assert.deepEqual(parseSortSetup({ range: 'A1', levels: [{ column: 'Qty', order: 'Z to A' }] }), { range: 'A1', levels: [{ column: 'Qty', order: 'desc' }] })
})

// ---------- PivotTable ----------

const pv = (config: Partial<Parameters<typeof pivotFromData>[2]>, rows = ROWS, head: CellValue[] = HEAD) =>
  pivotFromData(head, rows, { rows: [], columns: [], values: [], filters: [], ...config })
const sumIf = (pred: (r: Record<string, CellValue>) => boolean, field = 'Revenue') =>
  Math.round(where(pred).reduce((s, i) => s + (ROWS[i][C[field]] as number), 0) * 100) / 100

test('P1 revenue by region: Row Labels, Sum of Revenue, Grand Total', () => {
  const { cells } = pv({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }] })
  assert.deepEqual(cells, [
    ['Row Labels', 'Sum of Revenue'],
    ['Central', 8515.6], ['East', 8082.6], ['North', 4696.4], ['North-East', 7125.6], ['West', 7921],
    ['Grand Total', 36341.2],
  ])
  for (const [region, total] of cells.slice(1, -1)) assert.equal(total, sumIf(r => r.Region === region))
})

test('P2 bags by blend x channel: Column Labels, blanks for empty combinations', () => {
  const { cells } = pv({ rows: ['Blend'], columns: ['Channel'], values: [{ field: 'Qty', agg: 'sum' }] })
  assert.deepEqual(cells, [
    ['Sum of Qty', 'Column Labels', null, null, null, null],
    ['Row Labels', 'Cafe', 'Hotel', 'Office', 'Online', 'Grand Total'],
    ['Cold Brew Concentrate', 18, null, 73, 76, 167],
    ['Espresso Classic', 115, 113, 53, null, 281],
    ['Espresso Decaf', 26, 141, null, 106, 273],
    ['House Blend', 5, 65, 88, null, 158],
    ['Single Origin Kenya', 50, null, null, 57, 107],
    ['Single Origin Sumatra', 49, 40, null, 43, 132],
    ['Grand Total', 263, 359, 214, 282, 1118],
  ])
  assert.equal(cells[4][4], sumIf(r => r.Blend === 'Espresso Decaf' && r.Channel === 'Online', 'Qty'))
})

test('P3 report filter Status = Overdue', () => {
  const { cells } = pv({ rows: ['Customer'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Status', include: ['overdue'] }] })
  assert.deepEqual(cells.slice(0, 3), [['Status', 'Overdue'], [null, null], ['Row Labels', 'Sum of Revenue']])
  assert.deepEqual(cells.slice(3), [
    ['BeanBox Online', 1004.4], ['Changi Bizpark Pantry', 338], ['Jurong Lakeside Hotel', 864], ['KopiCart Online', 1260],
    ['Marina Suites Hotel', 1197], ['Orchard Grand Hotel', 1197], ['Sembawang Sands Resort', 440], ['Tiong Bahru Bakehouse', 130],
    ['Grand Total', 6430.4],
  ])
  const two = pv({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Status', include: ['Overdue', 'Pending'] }] }).cells
  assert.deepEqual(two[0], ['Status', '(Multiple Items)'])
  assert.equal(two[two.length - 1][1], sumIf(r => r.Status !== 'Paid'))
  assert.deepEqual(pv({ values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Status', include: [] }] }).cells, [['Status', '(All)'], [null, null], ['Sum of Revenue', null], [36341.2, null]])
})

test('P4 month helper sorts Jan-Dec like Excel; a filtered-out month disappears', () => {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const head = [...HEAD, 'Month']
  const rows = ROWS.map(r => [...r, MON[new Date(Date.UTC(1899, 11, 30) + (r[C.OrderDate] as number) * 86400000).getUTCMonth()]])
  const all = pv({ rows: ['Month'], values: [{ field: 'Revenue', agg: 'sum' }] }, rows, head).cells
  assert.deepEqual(all.map(r => r[0]), ['Row Labels', ...MON, 'Grand Total'])
  assert.deepEqual(all.slice(1, 7).map(r => r[1]), [8868, 4984.4, 5644.8, 5039, 7797, 4008])
  const ne = pv({ rows: ['Month'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Region', include: ['North-East'] }] }, rows, head).cells
  assert.deepEqual(ne.slice(2).map(r => r[0]), ['Row Labels', 'Jan', 'Feb', 'Mar', 'May', 'Jun', 'Grand Total'])
  assert.deepEqual(ne.slice(3).map(r => r[1]), [1044, 1701.6, 1532, 684, 2164, 7125.6])
})

test('P5 count, % of grand total and average by channel', () => {
  const out = pv({ rows: ['Channel'], values: [{ field: 'OrderID', agg: 'count' }, { field: 'OrderID', agg: 'count', show: 'pctGrand' }, { field: 'Revenue', agg: 'sum', show: 'pctGrand' }, { field: 'Revenue', agg: 'average' }] })
  const { cells } = out
  assert.deepEqual(cells[0], ['Row Labels', 'Count of OrderID', 'Count of OrderID2', 'Sum of Revenue', 'Average of Revenue'])
  assert.deepEqual(cells.map(r => r[1]), ['Count of OrderID', 24, 16, 12, 8, 60])
  const close = (a: CellValue, b: number) => assert.ok(typeof a === 'number' && Math.abs(a - b) < 1e-9, `${a} != ${b}`)
  close(cells[1][2], 0.4); close(cells[4][2], 8 / 60); close(cells[5][2], 1)
  close(cells[2][3], 11499.6 / 36341.2); close(cells[5][3], 1)
  close(cells[1][4], 9329.2 / 24); close(cells[4][4], 1178.1); close(cells[5][4], 36341.2 / 60)
  assert.ok(out.fmts.some(f => f.row === 1 && f.col === 2 && f.fmt === '0.00%'))
  assert.ok(!out.fmts.some(f => f.col === 1 || f.col === 4))
})

test('Pivot: % of row / column total, max, min, (blank) items', () => {
  const close = (a: CellValue, b: number) => assert.ok(typeof a === 'number' && Math.abs(a - b) < 1e-9, `${a} != ${b}`)
  const row = pv({ rows: ['Blend'], columns: ['Channel'], values: [{ field: 'Qty', agg: 'sum', show: 'pctRow' }] }).cells
  close(row[2][1], 18 / 167); close(row[2][5], 1); close(row[8][1], 263 / 1118); assert.equal(row[2][2], null)
  const col = pv({ rows: ['Blend'], columns: ['Channel'], values: [{ field: 'Qty', agg: 'sum', show: 'pctCol' }] }).cells
  close(col[2][1], 18 / 263); close(col[8][1], 1); close(col[2][5], 167 / 1118)
  const mm = pv({ rows: ['Region'], values: [{ field: 'Qty', agg: 'max' }, { field: 'Qty', agg: 'min' }] }).cells
  assert.deepEqual(mm[0], ['Row Labels', 'Max of Qty', 'Min of Qty'])
  assert.deepEqual(mm[mm.length - 1], ['Grand Total', 43, 4])
  const promo = pv({ rows: ['PromoCode'], values: [{ field: 'OrderID', agg: 'count' }] }).cells
  assert.deepEqual(promo.map(r => r[0]), ['Row Labels', 'NEW10', 'NEW15', 'VIP10', 'VIP5', '(blank)', 'Grand Total'])
  assert.deepEqual(promo.map(r => r[1]), ['Count of OrderID', 3, 3, 6, 3, 45, 60])
  assert.deepEqual(pv({ rows: ['Status'] }).cells, [['Row Labels'], ['Overdue'], ['Paid'], ['Pending'], ['Grand Total']])
  assert.deepEqual(pv({ values: [{ field: 'Qty', agg: 'sum' }, { field: 'OrderID', agg: 'count' }] }).cells, [['Sum of Qty', 'Count of OrderID'], [1118, 60]])
  const avgText = pv({ rows: ['Status'], values: [{ field: 'Customer', agg: 'average' }] }).cells
  assert.equal(avgText[1][1], '#DIV/0!')
})

test('Pivot: two row fields (compact outline with subtotals) and two column fields', () => {
  const two = pv({ rows: ['Region', 'Status'], values: [{ field: 'Revenue', agg: 'sum' }] }).cells
  assert.deepEqual(two.slice(0, 5), [['Row Labels', 'Sum of Revenue'], ['Central', 8515.6], ['Overdue', sumIf(r => r.Region === 'Central' && r.Status === 'Overdue')], ['Paid', sumIf(r => r.Region === 'Central' && r.Status === 'Paid')], ['Pending', 120]])
  assert.deepEqual(two[two.length - 1], ['Grand Total', 36341.2])
  const cols = pv({ rows: ['Region'], columns: ['Channel', 'Status'], values: [{ field: 'Qty', agg: 'sum' }] }).cells
  assert.deepEqual(cols[0].slice(0, 2), ['Sum of Qty', 'Column Labels'])
  assert.deepEqual(cols[1].slice(0, 6), [null, 'Cafe', null, null, 'Cafe Total', 'Hotel'])
  assert.deepEqual(cols[2].slice(0, 5), ['Row Labels', 'Overdue', 'Paid', 'Pending', null])
  assert.equal(cols[1][cols[1].length - 1], 'Grand Total')
  const last = cols[cols.length - 1]
  assert.equal(last[4], sumIf(r => r.Channel === 'Cafe', 'Qty'))
  assert.equal(last[last.length - 1], 1118)
  const multi = pv({ rows: ['Region'], columns: ['Channel'], values: [{ field: 'OrderID', agg: 'count' }, { field: 'Revenue', agg: 'sum' }] }).cells
  assert.deepEqual(multi[0].slice(0, 2), [null, 'Column Labels'])
  assert.deepEqual(multi[1], [null, 'Cafe', null, 'Hotel', null, 'Office', null, 'Online', null, 'Total Count of OrderID', 'Total Sum of Revenue'])
  assert.deepEqual(multi[2].slice(0, 3), ['Row Labels', 'Count of OrderID', 'Sum of Revenue'])
  assert.deepEqual(multi[multi.length - 1].slice(-2), [60, 36341.2])
  const onlyCols = pv({ columns: ['Status'], values: [{ field: 'OrderID', agg: 'count' }] }).cells
  assert.deepEqual(onlyCols, [['Count of OrderID', 'Column Labels', null, null, null], [null, 'Overdue', 'Paid', 'Pending', 'Grand Total'], [null, 8, 45, 7, 60]])
})

test('Pivot errors: unknown field, missing header, a field in two areas', () => {
  assert.throws(() => pv({ rows: ['Regin'] }), /not a field/)
  assert.throws(() => pv({ rows: ['Region'] }, ROWS, ['OrderID', null, ...HEAD.slice(2)]), /field name is not valid/)
  assert.throws(() => pv({ rows: ['Region'], columns: ['Region'] }), /only one of/)
  assert.throws(() => pv({}), /Add fields/)
  assert.throws(() => pv({ values: [{ field: 'Qty', agg: 'median' as 'sum' }] }), /not a summary function/)
})

test('current region grows over neighbours, diagonals included', () => {
  const grid = [
    'x...',
    '.x..',
    '....',
    '..xx',
  ].map(s => [...s].map(ch => ch === 'x'))
  const filled = (r: number, c: number) => grid[r]?.[c] ?? false
  assert.deepEqual(regionBox(filled, 4, 4, { r1: 0, c1: 0, r2: 0, c2: 0 }), { r1: 0, c1: 0, r2: 1, c2: 1 })
  assert.deepEqual(regionBox(filled, 4, 4, { r1: 3, c1: 3, r2: 3, c2: 3 }), { r1: 3, c1: 2, r2: 3, c2: 3 })
})

// ---------- on a live LabSheet ----------

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function ordersSheet(extra: Record<string, { v?: CellValue; f?: string; fmt?: string; role?: 'given' | 'label' }> = {}): LabSheet {
  const cells: Record<string, { v?: CellValue; f?: string; fmt?: string; role?: 'given' | 'label' }> = {}
  HEAD.forEach((h, j) => { cells[`${COLS[j]}8`] = { v: h } })
  ROWS.forEach((r, i) => r.forEach((v, j) => {
    if (v !== null) cells[`${COLS[j]}${9 + i}`] = j === C.OrderDate ? { v, fmt: 'd mmm yyyy' } : { v }
  }))
  return createLabSheet({ name: 'Orders', rows: 90, cols: 26, cells: { ...cells, ...extra } })
}
const typeAll = (s: LabSheet, entries: Record<string, string>) => {
  for (const [ref, raw] of Object.entries(entries)) assert.deepEqual(s.set(ref, raw), { ok: true }, ref)
}
const sheetIds = (s: LabSheet, rows: number[]) => rows.map(r => s.values(`A${r}`)[0][0])

test('LabSheet: runAdvancedFilter with typed criteria, ="=text" formulas and date strings', () => {
  const s = ordersSheet()
  typeAll(s, { A1: 'Channel', B1: 'Qty', A2: '="=Hotel"', B2: '>=20' })
  const res = runAdvancedFilter(s, { list: '$A$8:$K$68', criteria: '$A$1:$B$2' })
  assert.equal(res.error, undefined)
  assert.deepEqual(sheetIds(s, res.rows), HC(1, 11, 16, 32, 37, 44, 45, 50))
  assert.equal(res.total, 60)
  typeAll(s, { A1: 'OrderDate', B1: 'OrderDate', P1: '1/3/2026', P2: '31/3/2026', A2: '=">="&TEXT(P1,"d mmm yyyy")', B2: '="<="&TEXT(P2,"d mmm yyyy")' })
  assert.equal(s.values('A2')[0][0], '>=1 Mar 2026')
  assert.deepEqual(runAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:B2' }).rows, [29, 30, 31, 32, 33, 34, 35, 36, 37, 38])
  assert.equal(runAdvancedFilter(s, { list: 'C20', criteria: 'A1:B2' }).rows.length, 10)   // one cell = its current region
  typeAll(s, { A1: 'Region', B1: '', A2: '=North', B2: '', P1: '', P2: '' })
  const trap = runAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2' })
  assert.equal(trap.rows.length, 0)
  assert.ok(trap.notes?.some(n => n.includes('="=North"')), JSON.stringify(trap.notes))
  typeAll(s, { A3: 'West' })
  assert.ok(runAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A4' }).notes?.some(n => n.includes('blank')))
  assert.match(runAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:B70' }).error ?? '', /overlaps/)
  assert.match(runAdvancedFilter(s, { list: 'A8:K999', criteria: 'A1:A2' }).error ?? '', /edge of the sheet/)
  assert.match(runAdvancedFilter(s, { list: 'Other!A8:K68', criteria: 'A1:A2' }).error ?? '', /this sheet/)
})

test('LabSheet: computed criteria run through the engine without leaving traces', () => {
  const s = ordersSheet()
  typeAll(s, { M1: 'AboveAvg', M2: '=I9>AVERAGE($I$9:$I$68)', N1: 'Status', N2: '="=Overdue"' })
  const before = JSON.stringify(s.state())
  const undo = s.canUndo()
  const version = s.version
  const a = runAdvancedFilter(s, { list: 'A8:K68', criteria: 'M1:M2' })
  assert.equal(a.rows.length, 24)
  assert.deepEqual(sheetIds(s, runAdvancedFilter(s, { list: 'A8:K68', criteria: 'M1:N2' }).rows), HC(28, 32, 37, 49, 50))
  typeAll(s, { L1: '', L2: '=WEEKDAY(B9,2)>5' })
  assert.deepEqual(sheetIds(s, runAdvancedFilter(s, { list: 'A8:K68', criteria: 'L1:L2' }).rows), HC(15, 27, 38, 46))
  s.set('L2', '')
  assert.equal(JSON.stringify(s.state()), before)
  assert.equal(s.canUndo(), undo)
  assert.ok(s.version >= version)
  typeAll(s, { M2: '=$I$9>AVERAGE($I$9:$I$68)' })   // absolute row: every record tests row 9 -> all pass
  assert.equal(runAdvancedFilter(s, { list: 'A8:K68', criteria: 'M1:M2' }).rows.length, 60)
  typeAll(s, { M1: 'Revenue', M2: '=I9>AVERAGE($I$9:$I$68)' })
  const wrong = runAdvancedFilter(s, { list: 'A8:K68', criteria: 'M1:M2' })
  assert.equal(wrong.rows.length, 0)
  assert.ok(wrong.notes?.some(n => n.includes('computed criterion')))
})

test('LabSheet: applyAdvancedFilter in place hides rows; Copy to writes values, unique, re-runs clear leftovers', () => {
  const s = ordersSheet()
  typeAll(s, { A1: 'Blend', A2: 'Single Origin' })
  assert.deepEqual(applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2' }), { ok: true })
  assert.equal(s.hiddenRows.size, 46)
  assert.ok(!s.hiddenRows.has(9) && !s.hiddenRows.has(10) && s.hiddenRows.has(11))   // HC-1003 is Espresso Decaf
  typeAll(s, { N8: 'Customer' })
  assert.deepEqual(applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', copyTo: 'N8', unique: false }), { ok: true })
  assert.deepEqual(s.values('N21:N23').map(r => r[0]), ['BeanBox Online', 'Punggol Point Cafe', null])   // HC-1042, HC-1053
  assert.deepEqual(applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', copyTo: '$N$8', unique: true }), { ok: true })
  assert.deepEqual(s.values('N9:N19').map(r => r[0]), [
    'Hougang Heartland Hotel', 'BeanBox Online', 'Woodlands Brew Bar', 'Sengkang Social', 'Yishun Yard Cafe',
    'Sembawang Sands Resort', 'KopiCart Online', 'Punggol Point Cafe', 'Bedok Beanery', 'Tiong Bahru Bakehouse', null,
  ])
  assert.equal(s.values('N22')[0][0], null)
  // whole records to a blank cell: header row + every column, date format carried over
  assert.deepEqual(applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', copyTo: 'P8' }), { ok: true })
  assert.deepEqual(s.values('P8:Z8')[0], HEAD)
  assert.equal(s.values('P9')[0][0], 'HC-1001')
  assert.equal(s.fmt('Q9'), 'd mmm yyyy')
  assert.equal(s.display('Q9'), '5 Jan 2026')
  typeAll(s, { N8: 'Custmer' })
  assert.deepEqual(applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', copyTo: 'N8' }), { ok: false, message: 'The extract range has a missing or invalid field name.' })
  assert.match((applyAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', copyTo: 'A80' }) as { message: string }).message, /enough room/)
  // the checker's call: in place, unique on whole records
  assert.equal(runAdvancedFilter(s, { list: 'A8:K68', criteria: 'A1:A2', unique: true }).rows.length, 14)
})

test('LabSheet: applyAutoFilter hides rows, remembers the filters, clears', () => {
  const s = ordersSheet()
  assert.deepEqual(applyAutoFilter(s, { range: 'C20', columns: [{ column: 'Revenue', filter: { type: 'top10', count: 5 } }] }), { ok: true })
  assert.equal(s.hiddenRows.size, 54)
  assert.equal(getAutoFilter(s)?.shown, 6)
  assert.equal(getAutoFilter(s)?.range, 'A8:K68')
  assert.deepEqual(applyAutoFilter(s, { range: 'A8:K68', columns: [{ column: 'E', filter: { type: 'values', values: ['Hotel'] } }, { column: 'Qty', filter: { type: 'custom', rules: [{ op: 'ge', value: 20 }] } }] }), { ok: true })
  assert.equal(s.hiddenRows.size, 52)
  assert.match((applyAutoFilter(s, { range: 'A8:K68', columns: [{ column: 'Nope', filter: { type: 'average', above: true } }] }) as { message: string }).message, /not a column/)
  assert.deepEqual(applyAutoFilter(s, { range: 'A8:K68', columns: [] }), { ok: true })
  assert.equal(s.hiddenRows.size, 0)
  assert.equal(getAutoFilter(s), undefined)
})

test('LabSheet: applySort moves formulas with their rows, one undo step, custom list', () => {
  const s = createLabSheet({
    rows: 12, cols: 6,
    cells: {
      A1: { v: 'Task' }, B1: { v: 'Priority' }, C1: { v: 'Hours' }, D1: { v: 'Cost' }, F1: { v: 50, role: 'given' }, F2: { v: 70 },
      A2: { v: 'Paint' }, B2: { v: 'Low' }, C2: { v: 3 }, D2: { f: '=C2*$F$1' },
      A3: { v: 'Roof' }, B3: { v: 'High' }, C3: { v: 8 }, D3: { f: '=C3*$F$1' },
      A4: { v: 'Wiring' }, B4: { v: 'Medium' }, C4: { v: 5 }, D4: { f: '=C4*$F$1' },
      A5: { v: 'Fence' }, B5: { v: 'High' }, C5: { v: 2 }, D5: { f: '=C5*$F$1' },
    },
  })
  assert.deepEqual(applySort(s, { range: 'B3', levels: [{ column: 'Priority', order: 'custom', list: 'High,Medium,Low' }, { column: 'Hours', order: 'asc' }] }), { ok: true })
  assert.deepEqual(s.values('A2:D5'), [['Fence', 'High', 2, 100], ['Roof', 'High', 8, 400], ['Wiring', 'Medium', 5, 250], ['Paint', 'Low', 3, 150]])
  assert.equal(s.raw('D2'), '=C2*$F$1')
  assert.equal(s.raw('D5'), '=C5*$F$1')
  s.undo()
  assert.deepEqual(s.values('A2:A5').map(r => r[0]), ['Paint', 'Roof', 'Wiring', 'Fence'])
  assert.deepEqual(applySort(s, { range: 'A1:D5', levels: [{ column: 'D', order: 'desc' }] }), { ok: true })
  assert.deepEqual(s.values('A2:A5').map(r => r[0]), ['Roof', 'Wiring', 'Paint', 'Fence'])
  assert.deepEqual(applySort(s, { range: 'A2:D5', headers: false, levels: [{ column: 'Column A' }] }), { ok: true })
  assert.deepEqual(s.values('A2:A5').map(r => r[0]), ['Fence', 'Paint', 'Roof', 'Wiring'])
  assert.match((applySort(s, { range: 'A1:D5', levels: [{ column: 'Budget' }] }) as { message: string }).message, /not a column/)
  s.setHiddenRows([3])
  assert.match((applySort(s, { range: 'A1:D5', levels: [{ column: 'Task' }] }) as { message: string }).message, /hidden/)
  s.setHiddenRows([])
  assert.match((applySort(s, { range: 'F1:F2', levels: [{ column: 'F', order: 'desc' }], headers: false }) as { message: string }).message, /F1 .*locked/)
})

test('LabSheet: applyPivot writes values, formats percentages, re-creating clears leftovers', () => {
  const s = ordersSheet()
  const setup = { source: 'A8:K68', target: 'M3', config: { rows: ['Blend'], columns: ['Channel'], values: [{ field: 'Qty', agg: 'sum' as const }], filters: [] } }
  s.set('P7', 'note')
  assert.equal(pivotConflict(s, setup), 'M3:R11')   // Excel asks before replacing data
  s.set('P7', '')
  assert.equal(pivotConflict(s, setup), null)
  assert.deepEqual(applyPivot(s, setup), { ok: true })
  assert.equal(pivotConflict(s, setup), null)        // its own earlier output does not count
  assert.deepEqual(s.values('M3:R4'), [['Sum of Qty', 'Column Labels', null, null, null, null], ['Row Labels', 'Cafe', 'Hotel', 'Office', 'Online', 'Grand Total']])
  assert.deepEqual(s.values('M11:R11')[0], ['Grand Total', 263, 359, 214, 282, 1118])
  assert.equal(s.values('O5')[0][0], null)
  assert.deepEqual(buildPivot(s, setup), s.values('M3:R11'))
  const share = { ...setup, config: { rows: ['Channel'], columns: [], values: [{ field: 'Revenue', agg: 'sum' as const, show: 'pctGrand' as const }], filters: [] } }
  assert.deepEqual(applyPivot(s, share), { ok: true })
  assert.deepEqual(s.values('M3:N8'), [['Row Labels', 'Sum of Revenue'], ['Cafe', 9329.2 / 36341.2], ['Hotel', 11499.6 / 36341.2], ['Office', 6087.6 / 36341.2], ['Online', 9424.8 / 36341.2], ['Grand Total', 1]].map(r => r.map(v => (typeof v === 'number' ? Number(v.toPrecision(15)) : v))))
  assert.equal(s.values('M11')[0][0], null)       // old grand total row cleared
  assert.equal(s.values('R4')[0][0], null)        // old columns cleared
  assert.equal(s.display('N4'), '25.67%')
  assert.deepEqual(applyPivot(s, { ...setup, config: { rows: ['Channel'], columns: [], values: [{ field: 'OrderID', agg: 'count' as const }], filters: [] } }), { ok: true })
  assert.equal(s.display('N4'), '24')             // percentage format removed again
  assert.match((applyPivot(s, { ...setup, target: 'C20' }) as { message: string }).message, /overlap/)
  assert.match((applyPivot(s, { ...setup, target: 'Z3' }) as { message: string }).message, /edge of the sheet/)
  assert.match((applyPivot(s, { ...setup, config: { ...setup.config, rows: ['Blnd'] } }) as { message: string }).message, /not a field/)
  assert.deepEqual(applyTool(s, 'pivot', setup), { ok: true })
  assert.deepEqual(applyTool(s, 'sort', { range: 'A8:K68', levels: [{ column: 'Revenue', order: 'desc' }] }), { ok: true })
  assert.equal(s.values('A9')[0][0], 'HC-1002')
  assert.deepEqual(applyTool(s, 'autofilter', { range: 'A8:K68', columns: [{ column: 'Region', filter: { type: 'values', values: ['West'] } }] }), { ok: true })
  assert.equal(60 - s.hiddenRows.size, 10)
  assert.deepEqual(applyTool(s, 'advfilter', { list: 'A8:K68', criteria: '' }), { ok: true })
  assert.equal(s.hiddenRows.size, 0)
})
