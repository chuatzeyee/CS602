import type { CellSpec, CellValue, Exercise } from '../../../lab/types'

// Mock A, Q1 (13 marks): a pet-store receipt (SUMPRODUCT subtotal, a bracket table built from Table 2, approximate
// VLOOKUP, a day-of-month AND rule, sequential discounts), an integer Solver order for an animal shelter, a TREND
// forecast and a voucher rule with MONTH and a date difference. Original scenario and numbers:
// site_build/exam/analysis.json mock_blueprints[0].questions[0]; expected values from _generator/m1_calc.py
// (J14 $116.10, I16 6%, I17 4%, I18 $104.77, Solver subtotal $285.70 and total $259.99, forecasts 622.46-701.36,
// vouchers for M1001, M1005 and M1008).
// Lab adaptations (the paper uses four sheets, the lab one):
// - part e (copy sheet Q1-E) is the block L1:O22, the receipt moved four columns right (I -> M, J -> N), which the
//   learner rebuilds there (so the block shows no formula of parts a-d); M20 holds 12-Nov-2026, M22 the budget.
// - the shelter's wish list in O2:O13 caps each quantity. The lab Solver has Excel's Options: at the default Integer
//   Optimality of 1% this order stops at $284.50 / $258.90, so the prompt asks for 0%, and the uncapped 12-item knapsack
//   never closes the gap between its LP bound ($285.71) and the best whole-unit subtotal ($285.70) before Max Time.
//   With the caps it solves in about 0.1 s and the optimum is unchanged
//   ($285.70 / $259.99, checked with a DP over 5-cent steps and with MILP per discount bracket).
// - part f (sheet Q1-F) is A24:E37 (rows moved down 24) and part g (sheet Q1-G) is A39:H48 (rows moved down 39).
// - "state the trend equation" is a value task (E26:E27, reference = live TREND formulas so forecasts built on E26:E27
//   pass the sales test case) and "state the Solver model" an explain task.
// - tolerances follow the key: I18 0.005 (cents rounding), forecasts 0.5 (whole cans), slope 0.001, intercept ~0.01.

// Excel 1900-system serial number of a date
const day = (y: number, m: number, d: number): number => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)

const MONEY = '$#,##0.00'
const PCT = '0%'
const DATE = 'dd-mmm-yyyy'

const label = (v: string, bold = false): CellSpec => (bold ? { v, role: 'label', bold } : { v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt: string): CellSpec => ({ v, role: 'input', fmt })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const answer = (fmt?: string): CellSpec => (fmt ? { role: 'answer', fmt } : { role: 'answer' })
const working = (): CellSpec => ({ fmt: MONEY })               // blank editable working cell (not marked)
const quantity = (): CellSpec => ({ v: 0, role: 'answer', fmt: '0' }) // Solver changing cell

// one spec per row down a column, starting at row r0
const down = (col: string, r0: number, specs: readonly CellSpec[]): Record<string, CellSpec> =>
  Object.fromEntries(specs.map((s, i) => [`${col}${r0 + i}`, s]))
const repeat = (n: number, make: () => CellSpec): CellSpec[] => Array.from({ length: n }, make)

// Table 1: item, category, unit price
const ITEMS: readonly (readonly [string, string, number])[] = [
  ['Premium Kibble 2kg', 'Food', 18.9],
  ['Grain-free Kibble 2kg', 'Food', 24.5],
  ['Wet Food Can', 'Food', 2.35],
  ['Training Treats', 'Food', 6.8],
  ['Chew Toy', 'Toys', 7.25],
  ['Rope Tug', 'Toys', 9.6],
  ['Laser Pointer', 'Toys', 12.4],
  ['Cat Tunnel', 'Toys', 15.75],
  ['Pet Shampoo', 'Care', 11.3],
  ['Nail Clipper', 'Care', 8.45],
  ['Flea Collar', 'Care', 21.8],
  ['Waste Bags (roll pack)', 'Care', 4.15],
]
const NAMES = ITEMS.map(([n]) => n)
// the receipt basket (Table 3) and the shelter's wish list (part e), in Table 1 order
const BASKET = [1, 0, 6, 2, 1, 0, 1, 0, 1, 1, 1, 2]
const WISH = [4, 4, 12, 3, 2, 2, 0, 1, 3, 1, 3, 4]
// part f: Wet Food Cans sold in months 1-8
const SALES = [412, 436, 470, 489, 515, 547, 566, 598]
// part g: member, join date, points, last purchase
const MEMBERS: readonly (readonly [string, number, number, number])[] = [
  ['M1001', day(2021, 12, 14), 2340, day(2026, 11, 20)],
  ['M1002', day(2023, 12, 3), 1180, day(2026, 11, 25)],
  ['M1003', day(2019, 12, 28), 4020, day(2026, 9, 15)],
  ['M1004', day(2022, 11, 9), 3300, day(2026, 11, 29)],
  ['M1005', day(2024, 12, 21), 1500, day(2026, 10, 2)],
  ['M1006', day(2020, 12, 1), 1499, day(2026, 11, 30)],
  ['M1007', day(2018, 12, 17), 5610, day(2026, 10, 1)],
  ['M1008', day(2025, 12, 30), 2050, day(2026, 11, 18)],
]

const cells: Record<string, CellSpec> = {
  // Table 1 - Products (A1:C13)
  A1: header('Item'), B1: header('Category'), C1: header('Price ($)'),
  ...down('A', 2, NAMES.map((n) => given(n))),
  ...down('B', 2, ITEMS.map(([, c]) => given(c))),
  ...down('C', 2, ITEMS.map(([, , p]) => input(p, MONEY))),
  // Table 2 - Loyalty discount by subtotal (E1:F5) and the blank lookup table of part b (E9:F13)
  E1: header('Spend Range'), F1: header('Loyalty Discount'),
  E2: given('$40.00 to $99.99'), F2: given(0.03, PCT),
  E3: given('$100.00 to $179.99'), F3: given(0.06, PCT),
  E4: given('$180.00 to $299.99'), F4: given(0.09, PCT),
  E5: given('$300.00 or above'), F5: given(0.12, PCT),
  E8: label('Lookup Table', true),
  ...down('E', 9, repeat(5, () => answer(MONEY))),
  ...down('F', 9, repeat(5, () => answer(PCT))),
  // Table 3 - Receipt template (H1:J14) and the receipt summary (H16:I20)
  H1: header('Item'), I1: header('Quantity'), J1: header('Item Total ($)'),
  ...down('H', 2, NAMES.map((n) => given(n))),
  ...down('I', 2, BASKET.map((q) => input(q, '0'))),
  ...down('J', 2, repeat(12, working)),
  H14: label('Subtotal ($)', true), J14: answer(MONEY),
  H16: label('Loyalty Discount'), I16: answer(PCT),
  H17: label('Payday Promo'), I17: answer(PCT),
  H18: label('Total Payable ($)', true), I18: answer(MONEY),
  H20: label('Purchase Date'), I20: input(day(2026, 11, 27), DATE),
  // part e - the shelter order: the paper's copy sheet Q1-E, the receipt moved four columns right (L1:O22)
  L1: header('Shelter order (part e)'), M1: header('Quantity'), N1: header('Item Total ($)'), O1: header('Wish List (max)'),
  ...down('L', 2, NAMES.map((n) => given(n))),
  ...down('M', 2, repeat(12, quantity)),
  ...down('N', 2, repeat(12, working)),
  ...down('O', 2, WISH.map((w) => given(w, '0'))),
  L14: label('Subtotal ($)', true), N14: answer(MONEY),
  L16: label('Loyalty Discount'), M16: answer(PCT),
  L17: label('Payday Promo'), M17: answer(PCT),
  L18: label('Total Payable ($)', true), M18: answer(MONEY),
  L20: label('Purchase Date'), M20: given(day(2026, 11, 12), DATE),
  L22: label('Budget ($)'), M22: input(260, MONEY),
  // part f - sales history: the paper's sheet Q1-F moved down 24 rows (A25:B37), trend equation in D25:E27
  A24: label('Part f: Wet Food Can sales (sheet Q1-F)', true),
  A25: header('Month'), B25: header('Wet Food Cans Sold'),
  ...down('A', 26, Array.from({ length: 12 }, (_, i) => given(i + 1))),
  ...down('B', 26, SALES.map((v) => input(v, '0'))),
  ...down('B', 34, repeat(4, () => answer('0.00'))),
  D25: header('Trend equation'), D26: label('Slope'), E26: answer('0.000'), D27: label('Intercept'), E27: answer('0.00'),
  // part g - members: the paper's sheet Q1-G moved down 39 rows (A40:E48, G40:H42)
  A39: label('Part g: Members (sheet Q1-G)', true),
  A40: header('Member ID'), B40: header('Join Date'), C40: header('Points'), D40: header('Last Purchase'), E40: header('Renewal Voucher'),
  ...down('A', 41, MEMBERS.map(([id]) => given(id))),
  ...down('B', 41, MEMBERS.map(([, joined]) => input(joined, DATE))),
  ...down('C', 41, MEMBERS.map(([, , points]) => input(points, '#,##0'))),
  ...down('D', 41, MEMBERS.map(([, , , last]) => input(last, DATE))),
  ...down('E', 41, repeat(8, () => answer())),
  G40: label('Campaign Date'), H40: input(day(2026, 12, 1), DATE),
  G42: label('Vouchers to send'), H42: answer('0'),
}

// test cases: a formula that is right on the given data but wrong in a case gets a hint naming any number in it that
// equals a starting value of that case's input cells. The cases that first catch a typed rate or subtotal change only
// cells that start at 0, and the under-$40 case keeps the quantities that start at 2, so VLOOKUP's column 2 and the 1
// in (1-I16) are never reported as typed-in inputs.
const PROMO = '=IF(AND(DAY(I20)>=25,J14>=80,SUMPRODUCT(($B$2:$B$13="Care")*$I$2:$I$13)>=3),4%,0%)'
const VOUCHER = '=IF(AND(MONTH(B41)=MONTH($H$40),C41>=1500,$H$40-D41<=60),"Send Voucher","No Voucher")'

export const exercise: Exercise = {
  id: 'mock-a-q1',
  week: 'EXAM',
  topic: 'Receipt brackets, Solver and trend',
  title: 'PawPantry pet supplies: receipt, discount brackets, budget Solver, trend and voucher rules',
  level: 3,
  minutes: 60,
  scenario:
    'PawPantry is a neighbourhood pet-supply store. Table 1 (A1:C13) lists its 12 products with category (Food, Toys or Care) and ' +
    'unit price, and Table 2 (E1:F5) gives a loyalty discount on the whole receipt that depends on the receipt subtotal (no discount ' +
    'below $40). Table 3 (H1:J14) is the receipt template: quantities in column I, item totals in column J, subtotal in J14, purchase ' +
    'date in I20. From the 25th day of any month a Payday Promo takes a further 4% off the already-discounted bill when the subtotal ' +
    'is at least $80 and the basket contains at least 3 units of Care products. The paper\'s extra sheets are blocks on this sheet: ' +
    'Q1-E in L1:O22, Q1-F in A24:E37 and Q1-G in A39:H48.',
  sheet: {
    rows: 48,
    cols: 15,
    cells,
    colWidths: { A: 170, B: 135, C: 75, D: 105, E: 140, F: 115, G: 125, H: 170, I: 95, J: 105, K: 24, L: 170, M: 90, N: 110, O: 120 },
  },
  tasks: [
    {
      id: 'a-subtotal',
      kind: 'formula',
      cells: 'J14',
      marks: 1,
      prompt:
        '(a) In J2:J13 compute each item total (quantity x price) and in J14 the receipt subtotal for the basket in I2:I13. ' +
        'Give the formula in J14 and its value (J14 is marked; J2:J13 are working cells).',
      solution: '=SUMPRODUCT(I2:I13,C2:C13)',
      // =SUM(J2:J13) with J2:J13 never filled shows $0.00
      wrong: ['=SUMPRODUCT(I2:I12,C2:C12)', '=SUM(C2:C13)', '=SUM(I2:I13)', '=SUM(I2:I13)*SUM(C2:C13)', '=SUM(J2:J13)'],
      hints: [
        'Each item total is quantity x unit price; the subtotal adds the twelve item totals.',
        '`SUMPRODUCT`(I2:I13,C2:C13) does both steps in one cell. =SUM(J2:J13) over J2 =I2*C2 filled down gives the same.',
      ],
      explain:
        'J14 = $116.10. SUMPRODUCT multiplies each quantity by its price and adds the products, so it needs no working column; ' +
        'item totals =I2*C2 filled down to J13 and =SUM(J2:J13) are an equally good answer.',
    },
    {
      id: 'b-lookup-table',
      kind: 'value',
      cells: 'E9:F13',
      marks: 1,
      prompt:
        '(b) Rewrite Table 2 in E9:F13 as a table that an approximate-match `VLOOKUP` can read: thresholds in column E, ' +
        'discounts in column F. Spending below $40 gets no discount.',
      answer: { E9: 0, F9: 0, E10: 40, F10: 0.03, E11: 100, F11: 0.06, E12: 180, F12: 0.09, E13: 300, F13: 0.12 },
      wrong: ['40', '39.99'],
      hints: [
        'An approximate match finds the largest threshold that is not above the subtotal, so each row needs the lower bound of its band, in ascending order.',
        'Start with a 0 row for spending below $40: 0 / 0%, 40 / 3%, 100 / 6%, 180 / 9%, 300 / 12%.',
      ],
      explain:
        'Thresholds 0, 40, 100, 180, 300 with 0%, 3%, 6%, 9%, 12%. Without the 0 row a $30 basket returns #N/A; upper bounds ' +
        '(99.99, 179.99, ...) would give most subtotals the rate of the band below.',
    },
    {
      id: 'c-loyalty',
      kind: 'formula',
      cells: 'I16',
      marks: 1,
      prompt:
        '(c) In I16 return the loyalty discount that applies to the subtotal in J14, using your lookup table in E9:F13 with an ' +
        'approximate-match lookup (`VLOOKUP`, `LOOKUP` or `INDEX`/`MATCH`), not a nested `IF`.',
      solution: '=VLOOKUP(J14,$E$9:$F$13,2,TRUE)',
      // a nested IF that types the brackets in is right on every test case, so it is refused by name, as the prompt says
      check: { mustNotUse: ['IF', 'IFS'] },
      wrong: [
        '=VLOOKUP(J14,$E$9:$F$13,2,FALSE)', '=VLOOKUP(J14,$E$9:$F$13,1,TRUE)', '=VLOOKUP(J14,$E$10:$F$13,2,TRUE)', '=VLOOKUP(J14,E2:F5,2,TRUE)',
        '=IF(J14>=300,12%,IF(J14>=180,9%,IF(J14>=100,6%,IF(J14>=40,3%,0%))))',
      ],
      hints: [
        'Look up the subtotal in the bracket table you built in E9:F13 with an approximate match.',
        '=VLOOKUP(J14,$E$9:$F$13,2,TRUE); LOOKUP(J14,$E$9:$E$13,$F$9:$F$13) and INDEX/MATCH with match type 1 work too.',
      ],
      explain:
        '$116.10 is in the $100.00-$179.99 band, so I16 = 6%. FALSE (exact match) returns #N/A because 116.1 is not a threshold, ' +
        'and a table that starts at 40 fails for baskets under $40. A nested IF with the brackets typed in gives the same 6% but ' +
        'ignores the table the question asks you to use, so a marker gives it no formula mark.',
    },
    {
      id: 'd-promo',
      kind: 'formula',
      cells: 'I17',
      marks: 1,
      prompt:
        '(d)(i) In I17 return the Payday Promo rate (4% or 0%) using the purchase date in I20: it applies when the day of the ' +
        'month is 25 or later, the subtotal is at least $80 and the basket holds at least 3 units of Care products.',
      solution: PROMO,
      wrong: [
        '=IF(AND(DAY(I20)>25,J14>=80,SUMPRODUCT(($B$2:$B$13="Care")*$I$2:$I$13)>=3),4%,0%)',
        '=IF(AND(DAY(I20)>=25,J14>80,SUMPRODUCT(($B$2:$B$13="Care")*$I$2:$I$13)>=3),4%,0%)',
        '=IF(OR(DAY(I20)>=25,J14>=80,SUMPRODUCT(($B$2:$B$13="Care")*$I$2:$I$13)>=3),4%,0%)',
        '=IF(AND(DAY(I20)>=25,J14>=80,COUNTIF($B$2:$B$13,"Care")>=3),4%,0%)',
        '=IF(AND(DAY(I20)>=25,J14>=80),4%,0%)',
      ],
      hints: [
        'All three conditions must hold: AND(day of I20 >= 25, J14 >= 80, Care units >= 3), inside IF(..., 4%, 0%).',
        '`DAY`(I20) gives the day of the month. Care units: SUMPRODUCT(($B$2:$B$13="Care")*$I$2:$I$13) or `SUMIF`($B$2:$B$13,"Care",$I$2:$I$13).',
      ],
      explain:
        'Day 27, subtotal $116.10 and 5 Care units (shampoo, clipper, collar and 2 bag packs), so I17 = 4%. The rules say "or later" ' +
        'and "at least": the 25th, a subtotal of exactly $80.00 and exactly 3 Care units all qualify, so use >=. COUNTIF counts Care ' +
        'product lines (always 4), not units in the basket.',
    },
    {
      id: 'd-total',
      kind: 'formula',
      cells: 'I18',
      marks: 1,
      prompt: '(d)(ii) In I18 compute the Total Payable: apply the loyalty discount first, then the promo on the discounted amount.',
      solution: '=J14*(1-I16)*(1-I17)',
      check: { tol: 0.005 }, // the key's tolerance: rounding to cents with ROUND(...,2) is accepted
      wrong: ['=J14*(1-I16-I17)', '=J14*(1-I16)', '=J14-I16-I17', '=J14*(1-I16)-J14*I17'],
      hints: [
        'The promo is taken off the amount left after the loyalty discount, so the two discounts multiply.',
        '=J14*(1-I16)*(1-I17).',
      ],
      explain:
        '$116.10 x 0.94 x 0.96 = $104.77 (104.76864 unrounded; ROUND(...,2) is fine). Adding the rates, J14*(1-6%-4%) = $104.49, ' +
        'takes the 4% off the undiscounted subtotal, which is not what the rule says.',
    },
    {
      id: 'e-solver',
      kind: 'tool',
      tool: 'solver',
      cells: 'M2:M13,N14,M16:M18',
      marks: 3,
      prompt:
        '(e) PawPantry is filling an order for an animal shelter in L1:O22, the paper\'s copy sheet Q1-E (the receipt moved four ' +
        'columns right: I2:I13 is M2:M13, J14 is N14, I16:I22 is M16:M22). Its purchase date is 12-Nov-2026 (M20, so no promo) and ' +
        'the budget is $260 (M22). Fill in N14 (subtotal of M2:M13 at the Table 1 prices), M16 and M17 (loyalty discount and promo ' +
        'rate) and M18 (Total Payable) as on the receipt. The shelter needs exactly 8 Wet Food Cans and at least 2 Pet Shampoos and ' +
        'takes no more of any item than its wish list in O2:O13; the store limits Grain-free Kibble to 3 bags and Flea Collars to 2 ' +
        'per purchase. Use Solver to choose whole-number quantities in M2:M13 that maximise the Total Payable (M18) without exceeding ' +
        'the budget, and report the optimal subtotal (N14) and Total Payable (M18). Enter every limit above as a constraint and, as ' +
        'in Excel, set Options > Integer Optimality (%) to 0: at the default 1% Solver can stop at an order short of the best, and ' +
        'without the wish-list caps it searches until Max Time runs out.',
      solutions: { N14: '=SUMPRODUCT(M2:M13,C2:C13)', M16: '9%', M17: '0%', M18: '=N14*(1-M16)*(1-M17)' },
      toolSetup: {
        objective: 'M18',
        sense: 'max',
        changing: 'M2:M13',
        constraints: [
          { lhs: 'M18', relation: '<=', rhs: 'M22' },
          { lhs: 'M2:M13', relation: 'int' },
          { lhs: 'M2:M13', relation: '<=', rhs: 'O2:O13' },
          { lhs: 'M4', relation: '=', rhs: 8 },
          { lhs: 'M10', relation: '>=', rhs: 2 },
          { lhs: 'M3', relation: '<=', rhs: 3 },
          { lhs: 'M12', relation: '<=', rhs: 2 },
        ],
        nonNegative: true,
        engine: 'simplex',
      },
      answer: { N14: 285.7, M18: 259.987 },
      check: { tol: 0.01 },
      wrong: ['0', '2.5', '20'],
      hints: [
        'Build the copy first: N14 =SUMPRODUCT(M2:M13,C2:C13) and M18 =N14*(1-M16)*(1-M17). Then Solver: Set Objective M18, Max, By Changing Variable Cells M2:M13.',
        'Constraints: M18 <= M22, M2:M13 = integer, M2:M13 <= O2:O13, M4 = 8, M10 >= 2, M3 <= 3, M12 <= 2, with Make Unconstrained Variables Non-Negative ticked.',
        'A VLOOKUP in M16 is a step function, so Simplex LP refuses the model. An order worth about $260 after the discount has a ' +
          'subtotal between $180 and $299.99, so type 9% in M16 and 0% in M17 (12 November is before the 25th), solve with Simplex LP ' +
          'and check that N14 lands in that band. Set Options > Integer Optimality (%) to 0, here as in Excel.',
      ],
      explain:
        'A Total Payable of at most $260 means a subtotal of at most 260/0.91 = $285.71, and every price is a multiple of $0.05, so ' +
        'no basket beats N14 = $285.70 (M18 = $259.99); Solver finds one of the three baskets that reach it, so N14 and M18 are ' +
        'marked, not the quantities. The 12% band cannot help: a $300 subtotal still costs $264 after 12%. Without the integer constraint ' +
        'Solver splits a unit and reports $285.71 / $260.00; with a VLOOKUP left in M16, Simplex LP stops with the linearity message.',
    },
    {
      id: 'e-model',
      kind: 'explain',
      cells: '',
      marks: 1,
      prompt:
        '(e) State the Solver model you used: objective cell and Max/Min, changing cells, every constraint and the solving method. ' +
        'Say what you entered in M16 and M17, and why.',
      answer:
        'Objective M18, Max; changing cells M2:M13; constraints M18 <= M22, M2:M13 = integer, M2:M13 <= O2:O13, M4 = 8, ' +
        'M10 >= 2, M3 <= 3, M12 <= 2 and Make Unconstrained Variables Non-Negative (M2:M13 >= 0); Simplex LP with Options > ' +
        'Integer Optimality 0%. M16 holds 9% and ' +
        'M17 0% as typed numbers, because a VLOOKUP step would make the model non-linear: an order worth about $260 after the ' +
        'discount has a subtotal in the $180-$299.99 band, and 12 November is before the 25th. The optimum, N14 = $285.70, lies ' +
        'in that band, so 9% was the right rate.',
      hints: ['List the Solver dialog exactly as you filled it in, one constraint per line, then explain the fixed rates.'],
    },
    {
      id: 'f-trend',
      kind: 'formula',
      cells: 'B34:B37',
      marks: 1,
      prompt:
        '(f) A24:E37 is the paper\'s sheet Q1-F moved down 24 rows: monthly unit sales of Wet Food Cans for months 1-8 are in ' +
        'A26:B33. In B34:B37 forecast months 9-12 using a linear trend fitted to months 1-8 (one formula in B34, filled down).',
      solution: '=TREND($B$26:$B$33,$A$26:$A$33,A34)',
      // the key accepts whole-can rounding; relative ranges and a wrong fit window still miss by 5-10 cans when month 8 changes
      check: { tol: 0.5 },
      wrong: [
        '=TREND($A$26:$A$33,$B$26:$B$33,A34)', '=TREND($B$26:$B$33,$A$26:$A$33,A33)', '=FORECAST.LINEAR(A34,$A$26:$A$33,$B$26:$B$33)',
        '=TREND($B$27:$B$33,$A$27:$A$33,A34)', '=26.298*A34+385.79',
      ],
      hints: [
        'Fit the line to months 1-8 only (A26:B33) and lock both ranges with $ so they stay put when you fill down.',
        '=`TREND`($B$26:$B$33,$A$26:$A$33,A34) filled down to B37; `FORECAST.LINEAR`(A34,$B$26:$B$33,$A$26:$A$33) gives the same.',
      ],
      explain:
        'Forecasts 622.46, 648.76, 675.06 and 701.36 cans (rounding to whole cans is accepted): the fitted line evaluated at ' +
        'months 9-12. Known y-values come first in TREND; without the $ signs the fitted range slides down with each row and the ' +
        'later forecasts drift. Building B34 from the trend equation, =$E$26*A34+$E$27, is fine; numbers typed into the formula ' +
        'itself (=26.298*A34+385.79) freeze the forecasts when the sales change.',
    },
    {
      id: 'f-equation',
      kind: 'value',
      cells: 'E26:E27',
      marks: 1,
      prompt:
        '(f) State the trend equation, cans sold = slope x month + intercept: enter the slope in E26 (at least 3 decimals) and the ' +
        'intercept in E27 (at least 2 decimals), for example from a scatter chart of A26:B33 with a linear trendline and Display ' +
        'Equation on chart.',
      answer: { E26: 26.297619047619047, E27: 385.7857142857143 },
      // live reference (TREND at months 1 and 0) so that forecasts built on E26:E27 follow the sales test case
      solutions: { E26: '=TREND($B$26:$B$33,$A$26:$A$33,1)-TREND($B$26:$B$33,$A$26:$A$33,0)', E27: '=TREND($B$26:$B$33,$A$26:$A$33,0)' },
      check: { tol: 0.001, relTol: 2.5e-5 },
      wrong: ['26.3', '385.79'],
      hints: [
        'A scatter chart of months against sales with a linear trendline shows y = mx + c when you tick Display Equation on chart.',
        'Without a chart: the slope is the step between two consecutive forecasts (B35-B34) and the intercept is the trend at month 0, TREND($B$26:$B$33,$A$26:$A$33,0).',
      ],
      explain:
        'y = 26.298x + 385.79: sales grow by about 26.3 cans a month from a month-0 level of about 385.8 cans. Give the slope to ' +
        'at least three decimals and the intercept to two, as the chart label shows them.',
    },
    {
      id: 'g-voucher',
      kind: 'formula',
      cells: 'E41:E48',
      marks: 1.5,
      prompt:
        '(g)(i) A39:H48 is the paper\'s sheet Q1-G moved down 39 rows: members in A40:D48 and the campaign date in H40. A renewal ' +
        'voucher is sent when the member joined in the same calendar month as the campaign date, has at least 1,500 points, and ' +
        'last purchased no more than 60 days before the campaign date. Write the formula for E41 (fill down to E48) returning ' +
        '"Send Voucher" or "No Voucher".',
      solution: VOUCHER,
      wrong: [
        '=IF(AND(MONTH(B41)=MONTH($H$40),C41>1500,$H$40-D41<=60),"Send Voucher","No Voucher")',
        '=IF(AND(MONTH(B41)=MONTH($H$40),C41>=1500,$H$40-D41<60),"Send Voucher","No Voucher")',
        '=IF(AND(MONTH(B41)=MONTH($H$40),C41>=1500,D41-$H$40<=60),"Send Voucher","No Voucher")',
        '=IF(AND(B41=$H$40,C41>=1500,$H$40-D41<=60),"Send Voucher","No Voucher")',
        '=IF(AND(MONTH(B41)=MONTH($H$40),YEAR(B41)=YEAR($H$40),C41>=1500,$H$40-D41<=60),"Send Voucher","No Voucher")',
        '=IF(AND(MONTH(B41)=12,C41>=1500,$H$40-D41<=60),"Send Voucher","No Voucher")',
      ],
      hints: [
        'Three conditions inside AND: same `MONTH` of joining and of the campaign, points >= 1,500, and campaign date - last purchase <= 60 (dates are day numbers, so subtracting gives days).',
        '=IF(AND(MONTH(B41)=MONTH($H$40),C41>=1500,$H$40-D41<=60),"Send Voucher","No Voucher"), with $H$40 locked for the fill-down.',
      ],
      explain:
        'M1001, M1005 and M1008 qualify. The boundaries decide the rest: M1005 has exactly 1,500 points and last bought exactly ' +
        '60 days before 1-Dec-2026 (both included), M1006 has 1,499 points and M1007 last bought 61 days before. Only the month ' +
        'of joining matters, not the year.',
    },
    {
      id: 'g-count',
      kind: 'formula',
      cells: 'H42',
      marks: 0.5,
      prompt: '(g)(ii) In H42 count the vouchers to send.',
      solution: '=COUNTIF(E41:E48,"Send Voucher")',
      wrong: ['=COUNTIF(E41:E47,"Send Voucher")', '=COUNTIF(E41:E48,"Send")', '=COUNTA(E41:E48)'],
      hints: ['Count the cells of E41:E48 that hold the text "Send Voucher".', '=`COUNTIF`(E41:E48,"Send Voucher").'],
      explain: '3 vouchers (M1001, M1005, M1008). COUNTIF matches the whole text, so "Send" alone counts nothing.',
    },
  ],
  testCases: [
    { name: 'the basket adds 2 Grain-free Kibble bags and 3 Cat Tunnels', inputs: { I3: 2, I9: 3 } },
    { name: 'bought on 25-Nov-2026 without the Waste Bags (exactly 3 Care units)', inputs: { I20: day(2026, 11, 25), I13: 0 } },
    { name: 'bought on 24-Nov-2026', inputs: { I20: day(2026, 11, 24) } },
    { name: 'a subtotal of exactly $80.00 (3 Wet Food Cans, no Chew Toy or Flea Collar)', inputs: { I4: 3, I6: 0, I12: 0 } },
    { name: 'no Training Treats, Laser Pointer or Flea Collar (subtotal under $80)', inputs: { I5: 0, I8: 0, I12: 0 } },
    { name: 'only 1 Care unit (no Pet Shampoo, Nail Clipper or Waste Bags)', inputs: { I10: 0, I11: 0, I13: 0 } },
    { name: 'only the Training Treats and Waste Bags (under $40)', inputs: { I2: 0, I4: 0, I6: 0, I8: 0, I10: 0, I11: 0, I12: 0 } },
    { name: 'Pet Shampoo costs $12.10', inputs: { C10: 12.1 } },
    { name: 'month 8 sales were 640 cans', inputs: { B33: 640 } },
    { name: 'the campaign runs on 15-Dec-2026', inputs: { H40: day(2026, 12, 15) } },
    { name: 'member M1006 has 1,500 points', inputs: { C46: 1500 } },
    { name: 'the campaign runs on 4-Jan-2027', inputs: { H40: day(2027, 1, 4) } },
  ],
  skills: [
    'SUMPRODUCT subtotal',
    'bracket table + approximate VLOOKUP',
    'IF/AND with DAY and a conditional SUMPRODUCT',
    'sequential discounts',
    'integer Solver on a linearised model',
    'TREND forecast and trend equation',
    'IF/AND with MONTH and date differences',
    'COUNTIF on a text result',
  ],
  techniques: [
    'SUMPRODUCT totals and weighted/expected values',
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'IF with AND/OR multi-condition rules',
    'Date functions (TODAY, MONTH, WEEKDAY, date differences)',
    'Solver optimisation (objective, changing cells, constraints)',
    'Integer constraints in Solver',
    'Linearising a model for Solver (fix step-lookups, choose engine)',
    'Linear trend forecasting (TREND / trendline)',
    'Absolute/mixed references so formulas fill down/right',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
  ],
}
