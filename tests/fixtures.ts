// fixtures.ts - small exercises that cover every task kind and checking edge for the checker, the validator
// (npx tsx scripts/validate-lab.ts --fixtures) and the player harness. Test data only: never shown on the site.
import type { Exercise, MockExam } from '../src/lab/types'

// formula ranges with mixed refs + test cases + wrong entries, typed values (number and text), an explanation
const basics: Exercise = {
  id: 'fx-basics',
  week: 'W1',
  topic: 'Mixed references',
  title: 'Fixture: price grid with a discount',
  level: 1,
  minutes: 5,
  scenario: 'A market stall sells three bag sizes. Fill a revenue grid for several order quantities after the discount.',
  sheet: {
    rows: 14,
    cols: 6,
    cells: {
      A1: { v: 'Discount', role: 'label' }, B1: { v: 0.1, role: 'input', fmt: '0%' },
      A3: { v: 'Qty \\ price', role: 'header' }, B3: { v: 4, role: 'input' }, C3: { v: 6.5, role: 'input' }, D3: { v: 9, role: 'input' },
      E3: { v: 'Row total', role: 'header' },
      A4: { v: 10, role: 'given' }, A5: { v: 20, role: 'given' }, A6: { v: 50, role: 'given' }, A7: { v: 100, role: 'given' },
      B4: { role: 'answer' }, C4: { role: 'answer' }, D4: { role: 'answer' }, B5: { role: 'answer' }, C5: { role: 'answer' }, D5: { role: 'answer' },
      B6: { role: 'answer' }, C6: { role: 'answer' }, D6: { role: 'answer' }, B7: { role: 'answer' }, C7: { role: 'answer' }, D7: { role: 'answer' },
      E4: { role: 'answer' }, E5: { role: 'answer' }, E6: { role: 'answer' }, E7: { role: 'answer' },
      A9: { v: 'Best single sale', role: 'label' }, B9: { role: 'answer', fmt: '0.00' },
      A11: { v: 'Cells over 500', role: 'label' }, B11: { role: 'answer' },
      A12: { v: 'Best size at 100 bags', role: 'label' }, B12: { role: 'answer' },
    },
  },
  tasks: [
    {
      id: 'grid', kind: 'formula', cells: 'B4:D7',
      prompt: 'In B4 write one formula for revenue after the discount that fills down and right to D7.',
      solution: '=B$3*$A4*(1-$B$1)',
      check: { absolute: ['B$3', '$A4', '$B$1'], tol: 1e-9 },
      wrong: ['=B3*A4*(1-B1)', '=B$3*$A4*(1-B1)', '=B$3*$A4*0.9'],
    },
    {
      id: 'totals', kind: 'formula', cells: 'E4:E7', prompt: 'Total each row with `SUM`.',
      solution: '=SUM(B4:D4)', check: { mustUse: ['SUM'] }, wrong: ['=B4+C4', '=SUM(B4:C4)'],
    },
    { id: 'best', kind: 'formula', cells: 'B9', prompt: 'Find the best single sale with `MAX`.', solution: '=MAX(B4:D7)', check: { mustUse: ['MAX'] }, wrong: ['=MAX(B4:D6)'] },
    { id: 'count', kind: 'value', cells: 'B11', prompt: 'How many grid cells exceed 500? Type the number.', answer: 2, wrong: ['3'] },
    { id: 'size', kind: 'value', cells: 'B12', prompt: 'Which size earns most at 100 bags? Type its header.', answer: 'Large', wrong: ['Medium'] },
    {
      id: 'why', kind: 'explain', cells: '', prompt: 'Why does B$3 keep the $ before the 3?',
      answer: 'Filling down must keep pointing at the price row, so the row is anchored while the column moves with each size.',
    },
  ],
  testCases: [
    { name: 'Discount rises to 25%', inputs: { B1: 0.25 } },
    { name: 'Medium bag costs 7', inputs: { C3: 7 } },
  ],
  skills: ['mixed references', 'fill down and right'],
  techniques: ['Absolute/mixed references so formulas fill down/right'],
}

// goal seek on an input cell, after a formula task that the goal seek depends on
const goalSeek: Exercise = {
  id: 'fx-goalseek',
  week: 'W2',
  topic: 'Goal Seek',
  title: 'Fixture: break-even price',
  level: 2,
  minutes: 5,
  scenario: 'A workshop sells 400 lamps a month. Find the price at which it breaks even.',
  sheet: {
    rows: 8,
    cols: 3,
    cells: {
      A1: { v: 'Unit price', role: 'label' }, B1: { v: 20, role: 'input', fmt: '$#,##0.00' },
      A2: { v: 'Unit cost', role: 'label' }, B2: { v: 12, role: 'input' },
      A3: { v: 'Fixed cost', role: 'label' }, B3: { v: 4000, role: 'input' },
      A4: { v: 'Units sold', role: 'label' }, B4: { v: 400, role: 'input' },
      A6: { v: 'Profit', role: 'label' }, B6: { role: 'answer', fmt: '$#,##0.00' },
    },
  },
  tasks: [
    { id: 'profit', kind: 'formula', cells: 'B6', prompt: 'Profit = (price - cost) x units - fixed cost.', solution: '=(B1-B2)*B4-B3', wrong: ['=(B1-B2)*B4', '=(20-12)*400-4000'] },
    {
      id: 'seek', kind: 'tool', tool: 'goalseek', cells: 'B1', prompt: 'Use Goal Seek to set B6 to 0 by changing B1.',
      toolSetup: { setCell: 'B6', toValue: 0, changingCell: 'B1' }, answer: { B1: 22 }, check: { tol: 1e-4 }, wrong: ['21'],
    },
  ],
  testCases: [{ name: 'Unit cost falls to 10', inputs: { B2: 10 } }],
  skills: ['Goal Seek'],
  techniques: ['Goal Seek'],
}

// Solver LP: objective and usage formulas, then the solver run
const solverLp: Exercise = {
  id: 'fx-solver',
  week: 'W3',
  topic: 'Solver LP',
  title: 'Fixture: chairs and tables',
  level: 2,
  minutes: 8,
  scenario: 'A carpentry shop makes chairs and tables with limited carpentry and finishing hours. Choose the mix with the most profit.',
  sheet: {
    rows: 10,
    cols: 5,
    cells: {
      B1: { v: 'Chairs', role: 'header' }, C1: { v: 'Tables', role: 'header' },
      A3: { v: 'Units to make', role: 'label' }, B3: { v: 0, role: 'answer' }, C3: { v: 0, role: 'answer' },
      A4: { v: 'Profit per unit', role: 'label' }, B4: { v: 45, role: 'input' }, C4: { v: 100, role: 'input' },
      D5: { v: 'Used', role: 'header' }, E5: { v: 'Available', role: 'header' },
      A6: { v: 'Carpentry hours', role: 'label' }, B6: { v: 2, role: 'input' }, C6: { v: 4, role: 'input' }, D6: { role: 'answer' }, E6: { v: 400, role: 'input' },
      A7: { v: 'Finishing hours', role: 'label' }, B7: { v: 1, role: 'input' }, C7: { v: 3, role: 'input' }, D7: { role: 'answer' }, E7: { v: 270, role: 'input' },
      A9: { v: 'Total profit', role: 'label' }, B9: { role: 'answer' },
    },
  },
  tasks: [
    { id: 'objective', kind: 'formula', cells: 'B9', prompt: 'Total profit with `SUMPRODUCT`.', solution: '=SUMPRODUCT(B4:C4,B3:C3)', check: { mustUse: ['SUMPRODUCT'] }, wrong: ['=B4*B3'] },
    {
      id: 'usage', kind: 'formula', cells: 'D6:D7', prompt: 'Hours used, filled down.', solution: '=SUMPRODUCT($B$3:$C$3,B6:C6)',
      check: { absolute: ['$B$3:$C$3'] }, wrong: ['=SUMPRODUCT(B3:C3,B6:C6)'],
    },
    {
      id: 'solve', kind: 'tool', tool: 'solver', cells: 'B3:C3', prompt: 'Maximise B9 by changing B3:C3 subject to D6:D7 <= E6:E7.',
      toolSetup: { objective: 'B9', sense: 'max', changing: 'B3:C3', constraints: [{ lhs: 'D6:D7', relation: '<=', rhs: 'E6:E7' }], nonNegative: true, engine: 'simplex' },
      answer: { B3: 60, C3: 70, B9: 9700 }, check: { tol: 1e-6 }, wrong: ['200'],
    },
  ],
  testCases: [
    { name: 'Table profit rises to 110', inputs: { C4: 110 } },
    { name: 'Finishing a chair takes 2 hours', inputs: { B7: 2 } },
  ],
  skills: ['Solver', 'SUMPRODUCT'],
  techniques: ['Solver optimisation (objective, changing cells, constraints)', 'SUMPRODUCT totals and weighted/expected values'],
}

// one-variable (column) and two-variable data tables
const dataTables: Exercise = {
  id: 'fx-datatables',
  week: 'W4',
  topic: 'Data tables',
  title: 'Fixture: loan payments by rate, term and amount',
  level: 2,
  minutes: 8,
  scenario: 'A couple compares monthly repayments on a home loan for several interest rates, terms and loan amounts.',
  sheet: {
    rows: 8,
    cols: 10,
    cells: {
      A1: { v: 'Loan amount', role: 'label' }, B1: { v: 250000, role: 'input', fmt: '$#,##0' },
      A2: { v: 'Annual rate', role: 'label' }, B2: { v: 0.05, role: 'input', fmt: '0.0%' },
      A3: { v: 'Years', role: 'label' }, B3: { v: 20, role: 'input' },
      A5: { v: 'Monthly payment', role: 'label' }, B5: { role: 'answer', fmt: '$#,##0.00' },
      E2: { role: 'answer' },
      D3: { v: 0.03, role: 'given', fmt: '0%' }, D4: { v: 0.04, role: 'given', fmt: '0%' }, D5: { v: 0.05, role: 'given', fmt: '0%' },
      D6: { v: 0.06, role: 'given', fmt: '0%' }, D7: { v: 0.07, role: 'given', fmt: '0%' },
      G2: { f: '=B5', role: 'given', fmt: '$#,##0.00' }, H2: { v: 15, role: 'given' }, I2: { v: 20, role: 'given' }, J2: { v: 25, role: 'given' },
      G3: { v: 200000, role: 'given' }, G4: { v: 250000, role: 'given' }, G5: { v: 300000, role: 'given' },
    },
  },
  tasks: [
    { id: 'payment', kind: 'formula', cells: 'B5', prompt: 'Monthly payment with `PMT`.', solution: '=PMT(B2/12,B3*12,-B1)', check: { mustUse: ['PMT'] }, wrong: ['=PMT(B2,B3,-B1)', '=PMT(B2/12,B3*12,B1)'] },
    { id: 'link', kind: 'formula', cells: 'E2', prompt: 'Link E2 to the payment.', solution: '=B5', wrong: ['=B2'] },
    {
      id: 'rates', kind: 'tool', tool: 'datatable', cells: 'E3:E7', prompt: 'One-variable data table over the rates in D3:D7.',
      toolSetup: { range: 'D2:E7', colInput: 'B2' }, answer: { E3: 1386.4939946348015, E7: 1938.247339047183 }, check: { tol: 0.005 },
    },
    {
      id: 'grid', kind: 'tool', tool: 'datatable', cells: 'H3:J5', prompt: 'Two-variable data table: years across, amounts down.',
      toolSetup: { range: 'G2:J5', rowInput: 'B3', colInput: 'B1' }, answer: { H3: 1581.5872534830928, J5: 1753.7701245239402 }, check: { tol: 0.005 },
    },
  ],
  testCases: [{ name: 'Rate rises to 6%', inputs: { B2: 0.06 } }],
  skills: ['PMT', 'one-variable data table', 'two-variable data table'],
  techniques: ['What-if / scenario analysis by changing inputs'],
}

// Monte Carlo: random formulas checked statistically, a replication data table on a blank input cell,
// and formulas over the replications (compared exactly: same draws on both sides)
const reps: Record<string, { v: number; role: 'given' }> = {}
for (let i = 1; i <= 100; i++) reps[`D${i + 2}`] = { v: i, role: 'given' }
const monteCarlo: Exercise = {
  id: 'fx-montecarlo',
  week: 'W5',
  topic: 'Monte Carlo',
  title: 'Fixture: newspaper stand replications',
  level: 3,
  minutes: 12,
  scenario: 'A kiosk orders 100 papers a day; demand is a whole number from 80 to 120. Simulate the daily profit.',
  sheet: {
    rows: 102,
    cols: 8,
    cells: {
      A1: { v: 'Order quantity', role: 'label' }, B1: { v: 100, role: 'input' },
      A2: { v: 'Price', role: 'label' }, B2: { v: 10, role: 'input' },
      A3: { v: 'Unit cost', role: 'label' }, B3: { v: 6, role: 'input' },
      A5: { v: 'Demand', role: 'label' }, B5: { role: 'answer' },
      A6: { v: 'Profit', role: 'label' }, B6: { role: 'answer' },
      A8: { v: 'Average profit', role: 'label' }, B8: { role: 'answer', fmt: '0.00' },
      A9: { v: 'P(profit < 300)', role: 'label' }, B9: { role: 'answer', fmt: '0.00' },
      A10: { v: 'Rush probability', role: 'label' }, B10: { v: 0.3, role: 'input' },
      A11: { v: 'Rush today?', role: 'label' }, B11: { role: 'answer' },
      D1: { v: 'Rep', role: 'header' }, E1: { v: 'Profit', role: 'header' },
      E2: { f: '=B6', role: 'given' },
      G1: { note: 'blank input cell for the replication table' },
      ...reps,
    },
  },
  tasks: [
    {
      id: 'demand', kind: 'formula', cells: 'B5', prompt: 'Draw a whole-number demand from 80 to 120 with `RANDBETWEEN`.',
      solution: '=RANDBETWEEN(80,120)', random: { trials: 100, stat: 'mean', target: 100, tol: 6 }, wrong: ['=RANDBETWEEN(80,100)', '100'],
    },
    { id: 'profit', kind: 'formula', cells: 'B6', prompt: 'Profit: price x papers sold - cost x papers ordered.', solution: '=B2*MIN(B5,B1)-B3*B1', wrong: ['=B2*B5-B3*B5'] },
    {
      id: 'table', kind: 'tool', tool: 'datatable', cells: 'E3:E102', prompt: 'Replicate the profit 100 times with a data table on a blank input cell.',
      toolSetup: { range: 'D2:E102', colInput: 'G1' }, random: { trials: 3, stat: 'mean', target: 348.78, tol: 16 },
    },
    { id: 'average', kind: 'formula', cells: 'B8', prompt: 'Average simulated profit.', solution: '=AVERAGE(E3:E102)', check: { mustUse: ['AVERAGE'] }, wrong: ['=AVERAGE(E3:E101)'] },
    { id: 'risk', kind: 'formula', cells: 'B9', prompt: 'Share of days with profit under 300, with `COUNTIF`.', solution: '=COUNTIF(E3:E102,"<300")/100', check: { mustUse: ['COUNTIF'] }, wrong: ['=COUNTIF(E3:E102,"<=300")/100'] },
    {
      id: 'rush', kind: 'formula', cells: 'B11', prompt: 'TRUE on a rush day: a Bernoulli event with probability B10.',
      solution: '=RAND()<B10', random: { trials: 100, stat: 'p', target: 0.3, tol: 0.19 }, wrong: ['=RAND()>B10'],
    },
  ],
  testCases: [{ name: 'Order 90 papers', inputs: { B1: 90 } }],
  skills: ['RANDBETWEEN', 'data table replications'],
  techniques: [
    'Data Table for Monte Carlo replications (blank input cell)',
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'Bernoulli event (RAND() < p)',
  ],
}

// Advanced Filter criteria range (passes once decision-tools ships the real filter)
const criteria: Exercise = {
  id: 'fx-criteria',
  week: 'W10',
  topic: 'Advanced Filter',
  title: 'Fixture: big orders from the north',
  level: 1,
  minutes: 4,
  scenario: 'A wholesaler wants the northern stores with sales above 1,000.',
  sheet: {
    rows: 11,
    cols: 6,
    cells: {
      A1: { v: 'Region', role: 'header' }, B1: { v: 'Store', role: 'header' }, C1: { v: 'Sales', role: 'header' },
      A2: { v: 'North', role: 'given' }, B2: { v: 'S01', role: 'given' }, C2: { v: 1200, role: 'given' },
      A3: { v: 'South', role: 'given' }, B3: { v: 'S02', role: 'given' }, C3: { v: 800, role: 'given' },
      A4: { v: 'North', role: 'given' }, B4: { v: 'S03', role: 'given' }, C4: { v: 950, role: 'given' },
      A5: { v: 'East', role: 'given' }, B5: { v: 'S04', role: 'given' }, C5: { v: 1500, role: 'given' },
      A6: { v: 'North', role: 'given' }, B6: { v: 'S05', role: 'given' }, C6: { v: 1800, role: 'given' },
      A7: { v: 'West', role: 'given' }, B7: { v: 'S06', role: 'given' }, C7: { v: 400, role: 'given' },
      A8: { v: 'South', role: 'given' }, B8: { v: 'S07', role: 'given' }, C8: { v: 1300, role: 'given' },
      A9: { v: 'North', role: 'given' }, B9: { v: 'S08', role: 'given' }, C9: { v: 600, role: 'given' },
      A10: { v: 'East', role: 'given' }, B10: { v: 'S09', role: 'given' }, C10: { v: 1100, role: 'given' },
      A11: { v: 'North', role: 'given' }, B11: { v: 'S10', role: 'given' }, C11: { v: 2100, role: 'given' },
      E1: { v: 'Region', role: 'header' }, F1: { v: 'Sales', role: 'header' }, E2: { role: 'answer' }, F2: { role: 'answer' },
    },
  },
  tasks: [
    {
      id: 'north', kind: 'criteria', cells: 'E1:F2', prompt: 'Fill the criteria range for northern stores with sales above 1,000.',
      solutions: { E2: 'North', F2: '>1000' }, criteria: { list: 'A1:C11', expectedRows: [2, 6, 11] }, wrong: ['South'],
    },
  ],
  skills: ['Advanced Filter criteria'],
}

// VBA: a Sub that writes cells and a Function called with arguments (pass once the vba agent ships the interpreter)
const vba: Exercise = {
  id: 'fx-vba',
  week: 'W9',
  topic: 'VBA loops',
  title: 'Fixture: squares and commission',
  level: 1,
  minutes: 6,
  scenario: 'Two small macros: fill a column of squares, and a commission function for the sales team.',
  sheet: { rows: 6, cols: 3, cells: { A1: { role: 'answer' }, A2: { role: 'answer' }, A3: { role: 'answer' }, A4: { role: 'answer' }, A5: { role: 'answer' } } },
  tasks: [
    {
      id: 'squares', kind: 'vba', cells: 'A1:A5', prompt: 'Write `FillSquares` to put 1, 4, 9, 16, 25 in A1:A5 with a For loop.',
      vba: {
        entry: 'FillSquares',
        starter: "Sub FillSquares()\n    ' your loop here\nEnd Sub\n",
        solution: 'Sub FillSquares()\n    Dim i As Integer\n    For i = 1 To 5\n        Cells(i, 1).Value = i * i\n    Next i\nEnd Sub\n',
        expected: { A1: 1, A2: 4, A3: 9, A4: 16, A5: 25 },
        mustUse: ['For'],
      },
      wrong: ['Sub FillSquares()\n    Dim i As Integer\n    For i = 1 To 5\n        Cells(i, 1).Value = i + i\n    Next i\nEnd Sub\n'],
    },
    {
      id: 'commission', kind: 'vba', cells: '', prompt: 'Write the function `Commission(sales)`: 10% above 1,000, else 5%.',
      vba: {
        entry: 'Commission',
        starter: 'Function Commission(sales)\nEnd Function\n',
        solution: 'Function Commission(sales)\n    If sales > 1000 Then\n        Commission = sales * 0.1\n    Else\n        Commission = sales * 0.05\n    End If\nEnd Function\n',
        calls: [{ args: [2000], result: 200 }, { args: [500], result: 25 }],
      },
    },
  ],
  skills: ['For loop', 'Function procedure'],
}

export const fixtures: readonly Exercise[] = [basics, goalSeek, solverLp, dataTables, monteCarlo, criteria, vba]

// tasks that need a module still shipped as a stub: the validator reports them as SKIP while the stub answers
export const pendingFixtures: Readonly<Record<string, string>> = {
  'fx-criteria': 'needs the real Advanced Filter (decision-tools)',
  'fx-vba': 'needs the VBA interpreter (vba)',
}

const mockQ1: Exercise = {
  id: 'fx-mock-q1',
  week: 'EXAM',
  topic: 'Approximate lookup',
  title: 'Fixture mock Q1: parcel fees',
  level: 3,
  minutes: 10,
  scenario: 'A courier charges by weight band. Price five parcels and summarise the fees.',
  sheet: {
    rows: 10,
    cols: 7,
    cells: {
      A1: { v: 'Parcel', role: 'header' }, B1: { v: 'Weight (kg)', role: 'header' }, C1: { v: 'Fee', role: 'header' },
      A2: { v: 'P1', role: 'given' }, B2: { v: 0.5, role: 'input' }, C2: { role: 'answer' },
      A3: { v: 'P2', role: 'given' }, B3: { v: 3, role: 'input' }, C3: { role: 'answer' },
      A4: { v: 'P3', role: 'given' }, B4: { v: 7.5, role: 'input' }, C4: { role: 'answer' },
      A5: { v: 'P4', role: 'given' }, B5: { v: 12, role: 'input' }, C5: { role: 'answer' },
      A6: { v: 'P5', role: 'given' }, B6: { v: 1, role: 'input' }, C6: { role: 'answer' },
      A8: { v: 'Total fees', role: 'label' }, C8: { role: 'answer' },
      A9: { v: 'Average fee', role: 'label' }, C9: { role: 'answer' },
      F1: { v: 'From (kg)', role: 'header' }, G1: { v: 'Fee', role: 'header' },
      F2: { v: 0, role: 'given' }, G2: { v: 5, role: 'given' }, F3: { v: 1, role: 'given' }, G3: { v: 8, role: 'given' },
      F4: { v: 5, role: 'given' }, G4: { v: 15, role: 'given' }, F5: { v: 10, role: 'given' }, G5: { v: 25, role: 'given' },
    },
  },
  tasks: [
    {
      id: 'fee', kind: 'formula', cells: 'C2:C6', marks: 3, prompt: 'Fee per parcel with an approximate `VLOOKUP` on the band table.',
      solution: '=VLOOKUP(B2,$F$2:$G$5,2,TRUE)', check: { mustUse: ['VLOOKUP'], absolute: ['$F$2:$G$5'] },
      wrong: ['=VLOOKUP(B2,$F$2:$G$5,2,FALSE)', '=VLOOKUP(B2,F2:G5,2,TRUE)'],
    },
    { id: 'total', kind: 'formula', cells: 'C8', marks: 2, prompt: 'Total of the fees.', solution: '=SUM(C2:C6)', wrong: ['=SUM(C2:C5)'] },
    { id: 'avg', kind: 'formula', cells: 'C9', marks: 1, prompt: 'Average fee.', solution: '=AVERAGE(C2:C6)', wrong: ['=C8/4'] },
  ],
  testCases: [{ name: 'P2 weighs 12 kg', inputs: { B3: 12 } }],
  skills: ['VLOOKUP TRUE'],
  techniques: ['Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)'],
}

const mockQ2: Exercise = {
  id: 'fx-mock-q2',
  week: 'EXAM',
  topic: 'Interpretation',
  title: 'Fixture mock Q2: read the result',
  level: 3,
  minutes: 5,
  scenario: 'A cafe compares two suppliers on cost per cup.',
  sheet: {
    rows: 5,
    cols: 3,
    cells: {
      A1: { v: 'Supplier A cost per cup', role: 'label' }, B1: { v: 0.42, role: 'given' },
      A2: { v: 'Supplier B cost per cup', role: 'label' }, B2: { v: 0.39, role: 'given' },
      A4: { v: 'Cheaper supplier', role: 'label' }, B4: { role: 'answer' },
    },
  },
  tasks: [
    { id: 'pick', kind: 'value', cells: 'B4', marks: 2, prompt: 'Type A or B.', answer: 'B', wrong: ['A'] },
    { id: 'why', kind: 'explain', cells: '', marks: 2, prompt: 'Explain the choice in one sentence.', answer: 'Supplier B costs 3 cents less per cup.' },
  ],
  skills: ['interpretation'],
  techniques: ['Written interpretation of model results'],
}

export const fixtureMock: MockExam = {
  id: 'fx-mock',
  title: 'Fixture mock exam',
  minutes: 15,
  basedOn: 'Test fixture: two short questions',
  intro: 'Two questions to exercise mock scoring.',
  questions: [
    { id: 'fx-q1', title: 'Parcel fees', marks: 6, exercise: mockQ1 },
    { id: 'fx-q2', title: 'Supplier choice', marks: 4, exercise: mockQ2 },
  ],
}

export const fixtureById = (id: string): Exercise | undefined =>
  [...fixtures, ...fixtureMock.questions.map((q) => q.exercise)].find((e) => e.id === id)
