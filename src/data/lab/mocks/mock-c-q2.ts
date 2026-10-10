import type { CellSpec, CellValue, Exercise, Task } from '../../../lab/types'

// Mock C, Q2 (13 marks): UmbraShare umbrella sharing. Binomial flows with CRITBINOM, SUMIF/SUMPRODUCT flow balance,
// an INDEX fee matrix, Data Table replications of the stock and the profit, the flaw of averages and a deposit what-if.
// Original scenario and numbers: site_build/exam/analysis.json mock_blueprints[2].questions[1], expected values from
// _generator/m3q2_calc.py. With the fixed draws in H11:H22 the reference reproduces the blueprint's first run exactly
// (F11:F22 6,7,0,4,4,0,7,3,1,0,0,0; F4:F7 28,21,25,1; G11 6.00, I11 42.60, J11 7.30, K11 35.30).
// Lab adaptations: part (c) switches H11:H22 to RAND inside its Data Table task, so the checker compares the formula parts
// on seeded random draws (the same draws on both sides) and the replications statistically. The exam's "describe the
// table" is checked by building it. Part (e) (a copy of the sheet in the exam) is answered by changing the inputs in
// place and pressing F9; the two results are typed into R14 and R15 (the checker resets the inputs for every other part).
// One task per filled column or answer cell, as in the past keys: a wrong cell upstream does not cost the cells below it.

type Cells = Record<string, CellSpec>

const MONEY = '"S$"#,##0.00'
const COUNT = '0'
const CHANCE = '0.00'
const DRAW = '0.0000'
const AVG = '0.00'
const TRIALS = 100
const C_FIRST = 26                     // part (c) replications: rows 26-125, output row 25
const C_LAST = C_FIRST + TRIALS - 1
const D_FIRST = 12                     // part (d) replications: rows 12-111, output row 11
const D_LAST = D_FIRST + TRIALS - 1
const BLANK = 'R17'                    // an empty cell for the Column input of both tables

const label = (v: string, bold = false): CellSpec => (bold ? { v, role: 'label', bold } : { v, role: 'label' })
const header = (v: CellValue): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt: string): CellSpec => ({ v, role: 'input', fmt })
const given = (v: CellValue): CellSpec => ({ v, role: 'given' })
const answer = (fmt: string, v?: CellValue): CellSpec => (v === undefined ? { role: 'answer', fmt } : { role: 'answer', fmt, v })

// entries for each row, e.g. down(11, 22, (r) => [[`F${r}`, answer(COUNT)]])
function down<T>(first: number, last: number, make: (row: number, i: number) => [string, T][]): Record<string, T> {
  const out: Record<string, T> = {}
  for (let row = first; row <= last; row++) for (const [key, v] of make(row, row - first)) out[key] = v
  return out
}

const LOCATIONS = [1, 2, 3, 4] as const
const STOCK = [30, 20, 25, 0]                        // Table 1: umbrellas at T = 0
const EXCESS_COST = [0.3, 0.3, 0.3, 7]               // Table 4: S$ per umbrella above the opening stock
const FEES = [[0, 1, 1.4, 6], [1, 0, 1, 6], [1.4, 1, 0, 6], [0, 0, 0, 0]]  // Table 3: from (row) / to (column)
const FEE_COLS = ['J', 'K', 'L', 'M']
// Table 2 rows 11-22: from, to, possible borrowers, chance of borrowing, fixed uniform draw
const PAIRS: readonly (readonly [number, number, number, number, number])[] = [
  [1, 2, 10, 0.6, 0.5376], [1, 3, 8, 0.6, 0.9701], [1, 4, 4, 0.25, 0.1606],
  [2, 1, 9, 0.6, 0.1176], [2, 3, 6, 0.6, 0.4869], [2, 4, 3, 0.25, 0.2096],
  [3, 1, 12, 0.6, 0.4248], [3, 2, 7, 0.6, 0.1267], [3, 4, 5, 0.25, 0.2627],
  [4, 1, 0, 0, 0.0567], [4, 2, 0, 0, 0.6888], [4, 3, 0, 0, 0.8791],
]

const table1: Cells = {
  B2: header('Table 1: stock by location'),
  B3: header('Location'), C3: header('Umbrellas at T = 0'), D3: header('Borrowed Out'), E3: header('Returned In'),
  F3: header('Umbrellas at T = 1'), G3: header('Excess Umbrellas'),
  ...down(4, 7, (r, i) => [
    [`B${r}`, given(LOCATIONS[i])], [`C${r}`, input(STOCK[i], COUNT)],
    [`D${r}`, answer(COUNT)], [`E${r}`, answer(COUNT)], [`F${r}`, answer(COUNT)], [`G${r}`, answer(COUNT)],
  ]),
}

const table2: Cells = {
  B9: header('Table 2: borrowing pairs (H = fixed draws)'),
  B10: header('From'), C10: header('To'), D10: header('Possible Borrowers'), E10: header('Chance of Borrowing'),
  F10: header('Umbrellas Moved'), G10: header('Revenue (S$)'), H10: header('U (fixed draw)'),
  ...down(11, 22, (r, i) => {
    const [from, to, n, p, u] = PAIRS[i]
    return [
      [`B${r}`, given(from)], [`C${r}`, given(to)], [`D${r}`, input(n, COUNT)], [`E${r}`, input(p, CHANCE)],
      [`F${r}`, answer(COUNT)], [`G${r}`, answer(MONEY)], [`H${r}`, answer(DRAW, u)],
    ]
  }),
}

const tables345: Cells = {
  I2: header('Table 3: fee matrix (S$)'), I3: header('From / To'),
  ...Object.fromEntries(LOCATIONS.map((l, j) => [`${FEE_COLS[j]}3`, header(l)])),
  ...down(4, 7, (r, i) => [[`I${r}`, header(LOCATIONS[i])], ...FEE_COLS.map((c, j): [string, CellSpec] => [`${c}${r}`, input(FEES[i][j], MONEY)])]),
  O2: header('Table 4: cost per excess umbrella'), O3: header('Location'), P3: header('Cost per Excess Umbrella (S$)'),
  ...down(4, 7, (r, i) => [[`O${r}`, given(LOCATIONS[i])], [`P${r}`, input(EXCESS_COST[i], MONEY)]]),
  I9: header('Table 5: daily results'),
  I10: header('Revenue per Day'), J10: header('Cost per Day'), K10: header('Profit per Day'),
  I11: answer(MONEY), J11: answer(MONEY), K11: answer(MONEY),
}

// part (c): averages in row 20, output links in row 25, trials 1-100 down I26:I125 (the table fills J26:M125)
const partC: Cells = {
  I19: header('Location'), ...Object.fromEntries(LOCATIONS.map((l, j) => [`${FEE_COLS[j]}19`, header(l)])),
  I20: label('Average at T = 1'), ...Object.fromEntries(FEE_COLS.map((c) => [`${c}20`, answer(AVG)])),
  I23: header('Part (c): umbrellas at T = 1, 100 scenarios'),
  I24: header('Trial'), ...Object.fromEntries(LOCATIONS.map((l, j) => [`${FEE_COLS[j]}24`, header(`Location ${l}`)])),
  ...Object.fromEntries(FEE_COLS.map((c) => [`${c}25`, answer(COUNT)])),
  ...down(C_FIRST, C_LAST, (r, i) => [[`I${r}`, given(i + 1)]]),
}

// part (d): profit replications O11:P111, expected profit R12; part (e) answers R14:R15; the blank input cell R17
const partDE: Cells = {
  O9: header('Part (d): profit per day, 100 trials'),
  O10: header('Trial'), P10: header('Profit per Day (S$)'), P11: answer(MONEY),
  ...down(D_FIRST, D_LAST, (r, i) => [[`O${r}`, given(i + 1)], [`P${r}`, { fmt: MONEY }]]),
  Q12: label('Expected profit per day (100 trials)'), R12: answer(MONEY),
  Q14: label('(e)(i) Expected profit with the S$9 deposit'), R14: answer(MONEY),
  Q15: label('(e)(ii) Break-even station-to-station chance'), R15: answer(CHANCE),
  Q17: label('Blank cell for the Column input:'), [BLANK]: { note: 'Leave blank: Column input cell of both replication tables.' },
}

const partAB: Task[] = [
  {
    id: 'moved',
    kind: 'formula',
    cells: 'F11:F22',
    marks: 1,
    prompt:
      '(a) In F11 compute the number of umbrellas moved for the pair in row 11: binomial with the possible borrowers (D11) and ' +
      'chance (E11), using the draw in H11 as the cumulative probability. Guard rows with no borrowers. Fill down to F22. (The exam ' +
      'puts `RAND()` where H11 is; here use H11, which part (c) turns into `RAND()` draws.)',
    solution: '=IF(D11>0,CRITBINOM(D11,E11,H11),0)',
    // a RAND() inside F11 draws numbers the model answer cannot share: say so instead of "different result"
    check: { mustNotUse: ['RAND', 'RANDBETWEEN'] },
    wrong: [
      '=IF(D11>0,CRITBINOM(D11,1-E11,H11),0)', '=IF(D11>0,CRITBINOM(D11,E11,0.5),0)', '=D11*E11',
      '=IF(D11>0,ROUND(NORMINV(H11,D11*E11,SQRT(D11*E11*(1-E11))),0),0)', '=IF(D11>0,CRITBINOM(D11,E11,RAND()),0)',
    ],
    hints: [
      'Each of the D11 possible borrowers borrows independently with chance E11, so the number moved is binomial: inverse-transform the uniform draw in H11.',
      '`CRITBINOM`(trials, probability, alpha) (or `BINOM.INV`) gives the smallest count whose cumulative probability reaches alpha. Wrap it in `IF`(D11>0, ..., 0) for the pairs from location 4.',
    ],
    explain:
      'With the fixed draws the column reads 6, 7, 0, 4, 4, 0, 7, 3, 1, 0, 0, 0 (32 umbrellas moved). CRITBINOM turns a uniform ' +
      'number into a binomial count; the IF guard returns 0 where nobody can borrow. A rounded normal approximation (NORMINV) is ' +
      'not binomial: it drifts in the tails and for small chances such as 0.15. Use H11 rather than a new RAND() so that the ' +
      'switch in part (c) randomises every pair at once; in the exam the RAND() can sit inside the formula instead.',
  },
  {
    id: 'borrowed-out',
    kind: 'formula',
    cells: 'D4:D7',
    marks: 0.5,
    prompt: '(b) In D4 compute the umbrellas borrowed out of location 1 (every pair in Table 2 whose From is 1). Fill down to D7.',
    solution: '=SUMPRODUCT(($B$11:$B$22=B4)*$F$11:$F$22)',
    wrong: [
      '=SUMIF($B$11:$B$22,B4,$D$11:$D$22)', '=COUNTIF($B$11:$B$22,B4)', '=SUMIF($C$11:$C$22,B4,$F$11:$F$22)',
      '=SUMIF($B$11:$B$22,$B$4,$F$11:$F$22)',
    ],
    hints: [
      'Add the umbrellas moved (F11:F22) on every row whose From number (B11:B22) equals the location in B4.',
      '`SUMIF`($B$11:$B$22, B4, $F$11:$F$22) or `SUMPRODUCT`(($B$11:$B$22=B4)*$F$11:$F$22): lock both ranges, leave B4 relative.',
    ],
    explain:
      'With the fixed draws: 13, 8, 11, 0. A marker accepts SUMIF or SUMPRODUCT, but checks the $ signs: the ranges must stay on ' +
      'rows 11-22 while B4 moves down to B7.',
  },
  {
    id: 'returned-in',
    kind: 'formula',
    cells: 'E4:E7',
    marks: 0.5,
    prompt: '(b) In E4 compute the umbrellas returned into location 1 (every pair whose To is 1). Fill down to E7.',
    solution: '=SUMPRODUCT(($C$11:$C$22=B4)*$F$11:$F$22)',
    wrong: ['=SUMIF($C$11:$C$22,B4,$D$11:$D$22)', '=SUMIF($B$11:$B$22,B4,$F$11:$F$22)', '=SUMIF(C11:C22,B4,F11:F22)'],
    hints: [
      'Same idea as D4, but match the To column (C11:C22) against the location in B4.',
      '`SUMIF`($C$11:$C$22, B4, $F$11:$F$22). Without the $ signs the range slides down and misses the pair 1 -> 2 in E5.',
    ],
    explain: 'With the fixed draws: 11, 9, 11, 1. Location 4 only receives: every umbrella that is not returned lands there.',
  },
  {
    id: 'stock-t1',
    kind: 'formula',
    cells: 'F4:F7',
    marks: 0.5,
    prompt: '(b) In F4 compute the umbrellas at location 1 at T = 1 (opening stock, less borrowed out, plus returned in). Fill down to F7.',
    solution: '=C4-D4+E4',
    wrong: ['=C4+D4-E4', '=E4-D4', '=$C$4-D4+E4'],
    hints: ['Stock at T = 1 = stock at T = 0 - borrowed out + returned in.', 'F4 = C4 - D4 + E4, all relative so it fills down.'],
    explain: 'With the fixed draws: 28, 21, 25, 1. Umbrellas are only moved, so column F still adds up to 75.',
  },
  {
    id: 'excess',
    kind: 'formula',
    cells: 'G4:G7',
    marks: 0.5,
    prompt: '(b) In G4 compute the excess umbrellas at location 1: the stock at T = 1 above the opening stock, never negative. Fill down to G7.',
    solution: '=MAX(0,F4-C4)',
    wrong: ['=F4-C4', '=MIN(0,F4-C4)', '=ABS(F4-C4)', '=MAX(0,C4-F4)'],
    hints: ['A station that ends below its opening stock has no excess, not a negative one.', '`MAX`(0, F4 - C4).'],
    explain:
      'With the fixed draws: 0, 1, 0, 1. MAX(0, ...) keeps a station that ends below its opening stock at zero excess, and ' +
      'location 4 (opening stock 0) counts every lost umbrella as excess.',
  },
]

const partC_tasks: Task[] = [
  {
    id: 'stock-links',
    kind: 'formula',
    cells: 'J25:M25',
    marks: 0.25,
    prompt:
      '(c) Generate 100 scenarios with a Data Table and give the average number of umbrellas at each location at T = 1. First ' +
      'set up the output row of the table: in J25:M25 link to the umbrellas at T = 1 of locations 1-4 (F4:F7).',
    solutions: { J25: '=F4', K25: '=F5', L25: '=F6', M25: '=F7' },
    wrong: ['=G4', '=D4', '=F5', '=C4'],
    hints: [
      'A one-variable Data Table with its trials down a column recalculates the formulas in its top row once per trial.',
      'The stocks run down F4:F7 but the links run across, so filling right from J25 does not work: type =F4, =F5, =F6 and =F7.',
    ],
    explain: 'These four links are the outputs the table records: each trial row holds the four stocks of one simulated morning.',
  },
  {
    id: 'stock-table',
    kind: 'tool',
    tool: 'datatable',
    cells: `J${C_FIRST}:J${C_LAST}`,
    marks: 0.75,
    prompt:
      `(c) Switch H11:H22 to =RAND() (fill down), then generate the 100 scenarios: select I25:M${C_LAST} (trials 1-100 are in ` +
      `I${C_FIRST}:I${C_LAST}) and run a Data Table with an empty Row input cell and a blank Column input cell (${BLANK} is free).`,
    solutions: down(11, 22, (r) => [[`H${r}`, '=RAND()']]),
    toolSetup: { range: `I25:M${C_LAST}`, colInput: BLANK },
    // location 1 over 3 x 100 trials (sd 3.18): catches fixed draws, a RAND in H11 only, and a model input as the input cell
    random: { trials: 3, stat: 'mean', target: 30.8, tol: 0.95 },
    hints: [
      'With fixed numbers in H every trial would repeat the same morning. =RAND() in H11:H22 makes each recalculation, and each row of the table, a new morning.',
      `The trial numbers only force recalculations: select I25:M${C_LAST}, What-If Analysis > Data Table, leave the Row input cell empty and give an empty cell that no formula uses (${BLANK}) as the Column input cell.`,
    ],
    explain:
      'For each trial the table writes the trial number into the blank cell, recalculates (redrawing all twelve RAND() values) and ' +
      'records F4:F7, so every row is an independent morning. The input cell must not feed the model: with C4 as the input cell the ' +
      'table would overwrite station 1\'s opening stock with 1, 2, 3 ... Each row still adds up to 75 umbrellas. In the exam the ' +
      'description earns these marks: Data Table, outputs F4:F7 across the top, trials down the side, Row input empty, Column input a blank cell.',
  },
  {
    id: 'stock-averages',
    kind: 'formula',
    cells: 'J20:M20',
    marks: 1,
    prompt: '(c) In J20 give the average number of umbrellas at location 1 at T = 1 over the 100 scenarios, and fill right to M20.',
    solution: `=AVERAGE(J${C_FIRST}:J${C_LAST})`,
    wrong: [`=AVERAGE(J25:J${C_LAST})`, `=AVERAGE($J$${C_FIRST}:$J$${C_LAST})`, '=F4', `=AVERAGE(I${C_FIRST}:I${C_LAST})`],
    hints: [
      `Average the 100 trials only (J${C_FIRST}:J${C_LAST}), not the output link in row 25.`,
      'Leave the references relative so the formula moves to the next location as you fill right.',
    ],
    explain:
      'Expect about 30.8, 20.45, 20.75 and 3.0; the key accepts 29.85-31.75, 19.59-21.31, 19.86-21.64 and 2.55-3.45 (three ' +
      'standard errors of a 100-trial average). The exact means are the opening stock - the sum of n x p out + the sum of n x p ' +
      'in, e.g. station 3: 25 - (12 + 7) x 0.6 - 5 x 0.25 + (8 + 6) x 0.6 = 20.75; use them to sanity-check the simulation. Your ' +
      'averages move a little with every F9.',
  },
]

const partD_tasks: Task[] = [
  {
    id: 'revenue',
    kind: 'formula',
    cells: 'G11:G22',
    marks: 0.5,
    prompt:
      '(d) Revenue for each pair is umbrellas moved x the fee in Table 3, looked up by the From and To numbers. Enter it in G11 and ' +
      'fill down to G22. (If H11:H22 already hold RAND() from part (c), that is fine: your formulas are checked on the same ' +
      'draws as the model answer.)',
    solution: '=F11*INDEX($J$4:$M$7,B11,C11)',
    wrong: [
      '=INDEX($J$4:$M$7,B11,C11)', '=F11*VLOOKUP(B11,$I$4:$M$7,C11,FALSE)', '=F11*INDEX($J$4:$M$7,C11,B11)', '=F11*INDEX(J4:M7,B11,C11)',
    ],
    hints: [
      'The From number is the row and the To number the column of the fee matrix J4:M7, so `INDEX`($J$4:$M$7, B11, C11) reads the fee without a `MATCH`.',
      'G11 = F11 * `INDEX`($J$4:$M$7, B11, C11): lock the matrix, leave F11, B11 and C11 relative.',
    ],
    explain:
      'With the fixed draws G11 = 6 x S$1.00 = S$6.00 and the column adds up to S$42.60. VLOOKUP(B11, $I$4:$M$7, C11 + 1, FALSE) ' +
      'also works (the first column of that range holds the From numbers); the fee from 3 to 1 is not the fee from 1 to 3 once ' +
      'prices differ, so keep From as the row.',
  },
  {
    id: 'revenue-day',
    kind: 'formula',
    cells: 'I11',
    marks: 0.5,
    prompt: '(d) In I11 give the revenue per day.',
    solution: '=SUM(G11:G22)',
    wrong: ['=SUM(F11:F22)', '=AVERAGE(G11:G22)', '=G11'],
    hints: ['Add the revenue of every pair.'],
    explain: 'S$42.60 with the fixed draws.',
  },
  {
    id: 'cost-day',
    kind: 'formula',
    cells: 'J11',
    marks: 0.5,
    prompt: '(d) In J11 give the cost per day: the excess umbrellas at each location x its cost per excess umbrella (Table 4).',
    solution: '=SUMPRODUCT(G4:G7,P4:P7)',
    wrong: ['=SUM(G4:G7)*P4', '=SUMPRODUCT(F4:F7,P4:P7)', '=G7*P7', '=SUM(G4:G7)'],
    hints: ['Multiply each location\'s excess (G4:G7) by its cost (P4:P7) and add up.', '`SUMPRODUCT`(G4:G7, P4:P7).'],
    explain: 'S$7.30 with the fixed draws: one excess umbrella at station 2 at S$0.30 and one lost umbrella at S$7.00.',
  },
  {
    id: 'profit-day',
    kind: 'formula',
    cells: 'K11',
    marks: 0.5,
    prompt: '(d) In K11 give the profit per day.',
    solution: '=I11-J11',
    wrong: ['=I11+J11', '=J11-I11', '=I11'],
    hints: ['Profit = revenue - cost.'],
    explain: 'S$35.30 with the fixed draws. A lost umbrella earns the S$6.00 deposit but costs S$7.00 to replace.',
  },
  {
    id: 'profit-table',
    kind: 'tool',
    tool: 'datatable',
    cells: `P${D_FIRST}:P${D_LAST}`,
    marks: 0.5,
    prompt:
      `(d) Then estimate the expected profit over 100 trials: in P11 link to the profit (K11) and run a Data Table on ` +
      `O11:P${D_LAST} (trials 1-100 in O${D_FIRST}:O${D_LAST}) with an empty Row input cell and a blank Column input cell (${BLANK}).`,
    solutions: { P11: '=K11' },
    toolSetup: { range: `O11:P${D_LAST}`, colInput: BLANK },
    // 3 x 100 profits (sd 4.36): the blueprint's +/-1.31 is about five standard errors
    random: { trials: 3, stat: 'mean', target: 32.05, tol: 1.31 },
    hints: [
      'Same set-up as part (c): one output (P11 = K11) at the top, trial numbers down the side, an empty Column input cell.',
      `Select O11:P${D_LAST}, What-If Analysis > Data Table, leave the Row input cell empty and use ${BLANK} as the Column input cell.`,
    ],
    explain:
      'Each row is the profit of one simulated morning, so the column is a sample of 100 daily profits (they vary by about S$4.40 ' +
      'from morning to morning).',
  },
  {
    id: 'expected-profit',
    kind: 'formula',
    cells: 'R12',
    marks: 0.5,
    prompt: `(d) In R12 give the expected profit per day: the average of the 100 trials in P${D_FIRST}:P${D_LAST}.`,
    solution: `=AVERAGE(P${D_FIRST}:P${D_LAST})`,
    wrong: [`=AVERAGE(P11:P${D_LAST})`, '=K11', `=AVERAGE(O${D_FIRST}:O${D_LAST})`],
    hints: [`Average the trials only, not the link in P11: one morning's profit (K11) is not an expected value.`],
    explain:
      'The exact expected profit is S$32.05 (expected revenue S$54.00 - expected cost S$21.95). One 100-trial average has a ' +
      'standard error of about S$0.44, so the key accepts S$30.74-33.36; your value changes with every F9.',
  },
  {
    id: 'averages-flaw',
    kind: 'explain',
    cells: '',
    marks: 1,
    prompt: '(d) Could you plug the part (c) averages into the cost formula instead of building the profit table? Explain.',
    answer:
      'No. Cost uses MAX(0, stock at T = 1 - opening stock), which is not linear, so the cost at the average stock is not the ' +
      'average cost: E[MAX(0, X - c)] >= MAX(0, E[X] - c). With the part (c) averages the cost would be about S$21.38 instead of ' +
      'the true S$21.95 (profit overstated): averaging the stocks first lets mornings below the opening stock cancel mornings ' +
      'above it, but a shortfall never earns a negative cost. Replicate the profit itself instead: a second Data Table with K11 ' +
      'as its formula, trials down the side, the Row input empty and a blank Column input cell, then average the 100 profits. ' +
      'Revenue is linear in the umbrellas moved, so only the cost is biased.',
    hints: [
      'Compare the average of MAX(0, X - c) with MAX(0, average of X - c) for a station whose stock is sometimes above and sometimes below its opening level.',
    ],
    explain:
      'At the averages the excess is 0.8, 0.45, 0 and 3 umbrellas: 0.3 x 1.25 + 7 x 3 = S$21.38. Location 4 is linear (its ' +
      'stock never falls below its opening 0) but stations 1-3 are not: their expected excess (about 1.70, 1.38 and 0.10) is ' +
      'higher than the excess at the average stock.',
  },
]

const partE_tasks: Task[] = [
  {
    id: 'deposit-profit',
    kind: 'value',
    cells: 'R14',
    marks: 1.5,
    prompt:
      '(e)(i) To discourage people keeping umbrellas, the forfeited deposit (M4:M6) rises from S$6 to S$9. This is expected to ' +
      'cut the chance of a non-return borrowing (E13, E16, E19) to 0.15 and, through some lost goodwill, the chance of ' +
      'station-to-station borrowing to 0.55. Give the new expected profit in R14 (change the inputs in place and press F9 to ' +
      're-run the profit table; put them back afterwards).',
    answer: 35.54,
    check: { tol: 1.49 },
    wrong: ['32.05', '41.05', '38.52', '38.07'],
    hints: [
      'Set M4:M6 to 9, E13, E16 and E19 to 0.15 and the six station-to-station chances (E11, E12, E14, E15, E17, E18) to 0.55; leave the location-4 rows at 0.',
      'Press F9 a few times and average the R12 values you see: one 100-trial average moves by about S$0.50.',
    ],
    explain:
      'About S$35.54 (expected revenue S$49.20 - expected cost S$13.66), against S$32.05 today; the key accepts S$34.06-37.03. ' +
      'Changing only the deposit gives about S$41.05, forgetting the 0.55 about S$38.52 and forgetting the 0.15 about S$38.07. ' +
      'The checker resets the inputs, so the what-if does not disturb your other answers.',
  },
  {
    id: 'deposit-verdict',
    kind: 'explain',
    cells: '',
    marks: 1,
    prompt: '(e)(i) Is the change better for expected profit? Describe your procedure.',
    answer:
      'Better: expected profit rises from about S$32.05 to about S$35.54 a day. Fewer umbrellas are lost (each costs S$7.00 to ' +
      'replace) and each one still lost now keeps a S$9 deposit, which outweighs the fees lost on fewer station-to-station trips. ' +
      'Procedure: change M4:M6 to 9, E13/E16/E19 to 0.15 and the other non-zero chances to 0.55, recalculate the 100-trial profit ' +
      'table several times (F9) and compare the average R12 with the original. The gain of about S$3.50 is many times the ' +
      'S$0.45-0.50 standard error of a 100-trial average, so it is not simulation noise.',
    hints: ['Compare the two expected profits and say how sure you are, given that each 100-trial average is itself random.'],
    explain:
      'Expected cost falls from S$21.95 to S$13.66 (fewer replacements) while expected revenue falls only from S$54.00 to S$49.20. ' +
      'A marker looks for the verdict, the new expected profit and the procedure (which inputs change, re-running the table).',
  },
  {
    id: 'break-even',
    kind: 'value',
    cells: 'R15',
    marks: 1.5,
    prompt:
      '(e)(ii) With the S$9 deposit and 0.15 for non-returns, below what station-to-station chance does the change become worse ' +
      'than today? Type the chance in R15.',
    answer: 0.49,
    check: { tol: 0.03 },
    wrong: ['0.55', '0.45', '0.58'],
    hints: [
      'Keep M4:M6 at 9 and E13, E16, E19 at 0.15, lower the six station-to-station chances step by step and re-run the profit table each time.',
      'The change becomes worse once the average profit drops below today\'s S$32.05. One 100-trial average is noisy, so press F9 several times at each step, or build a two-way Data Table: make the six chances =$A$24, put =K11 in A25, candidate chances in B25:H25 (Row input A24) and trials 1-100 in A26:A125 (Column input a blank cell).',
    ],
    explain:
      'The exact break-even is about 0.491. Near it expected profit moves by about S$0.59 per 0.01 of chance, so the S$0.45-0.50 ' +
      'noise of one 100-trial average blurs the answer by about 0.01: the key accepts 0.46-0.52. Comparing with the fixed-draw ' +
      'profit (S$35.30) instead of today\'s expected S$32.05 gives about 0.55; leaving the non-returns at 0.25 gives about 0.45.',
  },
]

export const exercise: Exercise = {
  id: 'mock-c-q2',
  week: 'EXAM',
  topic: 'Binomial flows and replications',
  title: 'UmbraShare umbrella-sharing: binomial flows, replications and a deposit what-if',
  level: 3,
  minutes: 60,
  scenario:
    'UmbraShare places shared umbrellas at three MRT stations (locations 1-3); location 4 stands for umbrellas that are borrowed and ' +
    'never returned. Each rainy morning (T = 0) it stocks C4:C7, and Table 2 gives, for each from-to pair, the number of potential ' +
    'borrowers and the chance each one borrows, so the umbrellas moved per pair are binomial. Table 3 is the fee matrix (S$1.00-S$1.40 ' +
    'between stations; the S$6.00 deposit is kept when an umbrella is not returned) and Table 4 the cost of each umbrella above the ' +
    'opening stock: S$0.30 to truck it back at a station, S$7.00 to replace an unreturned one. Column H holds pre-drawn uniform ' +
    'numbers for a reproducible single run.',
  sheet: {
    rows: C_LAST,
    cols: 18,
    cells: { A1: label('UmbraShare: one rainy morning', true), ...table1, ...table2, ...tables345, ...partC, ...partDE },
    colWidths: {
      A: 24, B: 70, C: 140, D: 140, E: 146, F: 140, G: 120, H: 110, I: 130, J: 96, K: 90, L: 90, M: 90, N: 24, O: 70, P: 150,
      Q: 326, R: 100,
    },
  },
  tasks: [...partAB, ...partC_tasks, ...partD_tasks, ...partE_tasks],
  testCases: [
    { name: 'stations 1 and 3 open with 36 and 28 umbrellas', inputs: { C4: 36, C6: 28 } },
    { name: '14 people could borrow from station 1 to station 2', inputs: { D11: 14 } },
    {
      name: 'the part (e) policy applies (S$9 deposit, chances 0.15 and 0.55)',
      inputs: { M4: 9, M5: 9, M6: 9, E11: 0.55, E12: 0.55, E13: 0.15, E14: 0.55, E15: 0.55, E16: 0.15, E17: 0.55, E18: 0.55, E19: 0.15 },
    },
    { name: 'fees become S$1.20 from 1 to 2 and S$1.60 from 3 to 1', inputs: { K4: 1.2, J6: 1.6 } },
    { name: 'excess costs rise to S$0.50 at station 2 and S$8 per lost umbrella', inputs: { P5: 0.5, P7: 8 } },
  ],
  skills: [
    'CRITBINOM on a fixed or RAND draw', 'SUMIF/SUMPRODUCT flow balance with MAX', 'INDEX on a from/to fee matrix',
    'Data Table replications on a blank input cell', 'flaw of averages', 'what-if and break-even by re-running the table',
  ],
  techniques: [
    'Binomial random variable (CRITBINOM / BINOM.INV)',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Capacity and flow-balance logic with MIN/MAX',
    'SUMPRODUCT totals and weighted/expected values',
    'Data Table for Monte Carlo replications (blank input cell)',
    'INDEX by row/column number (matrix lookup)',
    'Replicate the full output (E[f(X)] is not f(E[X]))',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
  ],
}
