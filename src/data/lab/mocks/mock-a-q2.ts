import type { CellSpec, CellValue, Exercise, Task } from '../../../lab/types'

// Mock A, Q2 (12 marks): a batch-service tram queue (CRF arrivals, MIN/MAX capacity with carry-over, an INDEX draw
// of the loading time, seconds to day fractions), then Data Table replications and capacity what-ifs.
// Original scenario and numbers: site_build/exam/analysis.json mock_blueprints[0].questions[1], expected values from
// _generator/m1q2_calc.py. With the fixed draws in P7:R27 the model reproduces the blueprint's first run exactly
// (J7 19:04:00, H29 $4,530.00, H30 65, H31 4.2857, H32 21:03:20). Part (c) swaps the draws for RAND/RANDBETWEEN, so the
// checker compares parts (a)-(b) on seeded random draws (same draws on both sides) and the tables statistically.
// Part (b) is one task per column (5 marks in all) so a slip in one column costs that column only, as with a marker.
// Lab adaptations: RUNS replications instead of 1,000 (the lab sheet stops at row 1000 and every check re-runs the two
// tables; at 100 or fewer, a table that wrongly uses G2 as its input cell averages close to the right answer); the
// pen-150 estimate of part (c) is typed into E34; the part (e) scenarios are run by changing G2/D2 and pressing F9.

const t = (h: number, m = 0, s = 0): number => (h * 3600 + m * 60 + s) / 86400

const CLOCK = 'hh:mm:ss'
const MONEY = '$#,##0.00'
const RUNS = 120
const FIRST_REP = 36
const LAST_REP = FIRST_REP + RUNS - 1
const BODY_LEFT = `D${FIRST_REP}:D${LAST_REP}`
const BODY_REV = `G${FIRST_REP}:G${LAST_REP}`

// long-run mean and per-evening SD of each replicated output (200,000 simulated evenings, m1q2_calc.py logic; an
// independent re-simulation and the lab model itself agree within sampling error)
const LEFT_60 = { mean: 7.968, sd: 3.067 }
const LEFT_150 = { mean: 41.15, sd: 24.203 }
const REV_60 = { mean: 4717.79, sd: 180.25 }
const REV_150 = { mean: 4849.38, sd: 183.75 }
const REV_46_SEATS = { mean: 4875.23, sd: 257.24 }
// half-width of the range RUNS trials usually give (3 standard errors), quoted in the explanations, and the checker
// tolerance (4 standard errors of a RUNS-trial average, rounded up)
const half = (sd: number, k = 3): number => (k * sd) / Math.sqrt(RUNS)
const band = (x: { mean: number; sd: number }, dp = 1): string =>
  `${(x.mean - half(x.sd)).toFixed(dp)}-${(x.mean + half(x.sd)).toFixed(dp)}`
const usd = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`
const usdBand = (x: { mean: number; sd: number }): string => `${usd(x.mean - half(x.sd))}-${usd(x.mean + half(x.sd))}`
const tol4 = (sd: number, step: number): number => Number((Math.ceil(half(sd, 4) / step) * step).toFixed(6))

const label = (v: string, bold = false): CellSpec => (bold ? { v, role: 'label', bold } : { v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt: string): CellSpec => ({ v, role: 'input', fmt })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const givenF = (f: string, fmt: string): CellSpec => ({ f, role: 'given', fmt })
const answer = (fmt: string): CellSpec => ({ role: 'answer', fmt })

// sheet rows of trams 1..21 and of the replications
const TRAMS = Array.from({ length: 21 }, (_, i) => i + 7)
const REPS = Array.from({ length: RUNS }, (_, i) => i + FIRST_REP)

// pre-drawn random numbers of the blueprint: U for the arrivals, the Table B row (1-4) and column (1-2)
const U = [0.8722, 0.0308, 0.0296, 0.2913, 0.7377, 0.1033, 0.3519, 0.2544, 0.339, 0.4554, 0.3582, 0.4066, 0.0112, 0.5692, 0.6681, 0.64, 0.1595, 0.3611, 0.9949, 0.1244, 0.9256]
const ROW_DRAW = [4, 2, 3, 2, 2, 4, 1, 3, 3, 4, 3, 3, 4, 1, 2, 2, 3, 4, 1, 4, 3]
const COL_DRAW = [1, 1, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1]

const drawRow = (r: number): Record<string, string> => ({
  [`P${r}`]: '=RAND()',
  [`Q${r}`]: '=RANDBETWEEN(1,4)',
  [`R${r}`]: '=RANDBETWEEN(1,2)',
})
const RAND_DRAWS: Record<string, string> = Object.assign({}, ...TRAMS.map(drawRow))

const tramCells = (r: number, i: number): Record<string, CellSpec> => ({
  [`B${r}`]: given(i + 1),
  [`C${r}`]: givenF(r === 7 ? '=$J$2' : `=C${r - 1}+$D$3`, CLOCK),
  [`D${r}`]: answer('0'), [`E${r}`]: answer('0'), [`F${r}`]: answer('0'), [`G${r}`]: answer('0'),
  [`H${r}`]: answer(MONEY), [`I${r}`]: answer('0'), [`J${r}`]: answer(CLOCK),
  [`P${r}`]: { v: U[i], role: 'answer', fmt: '0.0000' },
  [`Q${r}`]: { v: ROW_DRAW[i], role: 'answer', fmt: '0' },
  [`R${r}`]: { v: COL_DRAW[i], role: 'answer', fmt: '0' },
})
// trial numbers down C and F; the table bodies D and G stay unlocked (no role) so the Data Tables can fill them
const repCells = (r: number, i: number): Record<string, CellSpec> => ({
  [`C${r}`]: given(i + 1),
  [`D${r}`]: { fmt: '0.000' },
  [`F${r}`]: given(i + 1),
  [`G${r}`]: { fmt: MONEY },
})
const cellsFrom = <T>(items: T[], make: (x: T, i: number) => Record<string, CellSpec>): Record<string, CellSpec> =>
  Object.assign({}, ...items.map(make))

const sheetCells: Record<string, CellSpec> = {
  B1: label('Q2 - Night-safari trams: queue, capacity and replications', true),
  C2: label('Tram Capacity (seats)'), D2: input(40, '0'),
  F2: label('Holding Pen Capacity'), G2: input(60, '0'),
  I2: label('First Tram'), J2: input(t(19), CLOCK),
  C3: label('Departure Interval'), D3: input(t(0, 6), CLOCK),
  F3: label('Fare per Rider ($)'), G3: input(6, MONEY),
  I3: label('Last Tram'), J3: { v: t(21), role: 'given', fmt: CLOCK, note: 'For information: 21 departures from J2, every D3' },
  B5: header('Tram No'), C5: header('Scheduled Departure'), D5: header('Visitors Arrived'), E5: header('Visitors in Pen'),
  F5: header('Riders Boarded'), G5: header('Left in Pen'), H5: header('Fare Revenue ($)'), I5: header('Turned Away'),
  J5: header('Actual Departure'),
  E6: given(0, '0'), F6: given(0, '0'), G6: given(0, '0'), I6: given(0, '0'),
  ...cellsFrom(TRAMS, tramCells),
  L4: label('Table A - visitors arriving per 6-minute interval', true),
  L5: header('Probability'), M5: header('Visitors Arriving'), N5: header('Cum. Prob'),
  L6: input(0.2, '0%'), M6: input(25, '0'), N6: answer('0%'),
  L7: input(0.4, '0%'), M7: input(35, '0'), N7: answer('0%'),
  L8: input(0.25, '0%'), M8: input(45, '0'), N8: answer('0%'),
  L9: input(0.15, '0%'), M9: input(80, '0'), N9: answer('0%'),
  L14: label('Loading time per rider (seconds) - all 8 values equally likely', true),
  L15: input(3, '0.0'), M15: input(3.5, '0.0'),
  L16: input(4, '0.0'), M16: input(4.5, '0.0'),
  L17: input(5, '0.0'), M17: input(5.5, '0.0'),
  L18: input(6, '0.0'), M18: input(7.5, '0.0'),
  P5: label('Fixed random draws (replace by RAND/RANDBETWEEN for Parts c-e)', true),
  P6: header('U (arrivals)'), Q6: header('Row draw (1-4)'), R6: header('Col draw (1-2)'),
  G29: label('Total Fare Revenue'), H29: answer(MONEY),
  G30: label('Total Turned Away'), H30: answer('0'),
  G31: label('Average Left in Pen'), H31: answer('0.0000'),
  G32: label('Last Actual Departure'), H32: answer(CLOCK),
  L30: { note: 'A blank cell: use it as the Column input cell of the replication Data Tables' },
  C33: label('(c) Left in pen (H31)', true), E33: label('(ii) Pen 150'),
  C34: label('Average'), D34: answer('0.000'), E34: answer('0.000'),
  C35: header('Trial'), D35: answer('0.000'),
  F33: label('(d) Fare revenue per evening (H29)', true),
  F34: label('Average'), G34: answer(MONEY),
  F35: header('Trial'), G35: answer(MONEY),
  ...cellsFrom(REPS, repCells),
}

// ---------- parts (a) and (b) ----------

interface ColumnParts {
  id: string
  col: string
  marks: number
  what: string
  solution: string
  wrong: string[]
  hints: string[]
  explain: string
  tol?: number
}
// one column of the tram table: the row-7 formula filled down to row 27
const column = (p: ColumnParts): Task => ({
  id: p.id,
  kind: 'formula',
  cells: `${p.col}7:${p.col}27`,
  marks: p.marks,
  prompt: `(b) ${p.col}7:${p.col}27, ${p.what} Write it in ${p.col}7 and fill down to row 27.`,
  solution: p.solution,
  ...(p.tol ? { check: { tol: p.tol } } : {}),
  wrong: p.wrong,
  hints: p.hints,
  explain: p.explain,
})

const crf: Task = {
  id: 'crf',
  kind: 'formula',
  cells: 'N6:N9',
  marks: 1,
  prompt:
    '(a) Complete the cumulative probability column N6:N9 so that `LOOKUP` can turn a uniform random number into the number ' +
    'of visitors arriving in an interval.',
  solutions: { N6: '0', N7: '=SUM($L$6:L6)', N8: '=SUM($L$6:L7)', N9: '=SUM($L$6:L8)' },
  check: { formulaRequired: false },
  wrong: ['=L6', '=SUM($L$6:L6)'],
  hints: [
    'LOOKUP finds the largest value in N6:N9 that is <= the random number and returns the visitors on that row, so each row needs the LOWER bound of its interval.',
    'N6 is 0; N7 adds up the probabilities above it, =SUM($L$6:L6) (or =N6+L6), filled down to N9.',
  ],
  explain:
    'The lower bounds 0, 20%, 60%, 85% split [0, 1) into intervals as wide as the probabilities: U below 0.2 gives 25 visitors, ' +
    '0.2-0.6 gives 35, 0.6-0.85 gives 45 and 0.85 or more gives 80. Upper bounds (20%, 60%, 85%, 100%) shift every outcome ' +
    'one row and make LOOKUP return #N/A whenever U < 0.2. A marker wants N6 = 0 and N7:N9 from one formula filled down, not typed values.',
}

const tramColumns: Task[] = [
  column({
    id: 'arrivals', col: 'D', marks: 0.5,
    what: 'visitors arrived: turn the draw in P7 into a number of visitors with Table A (`LOOKUP`).',
    solution: '=LOOKUP(P7,$N$6:$N$9,$M$6:$M$9)',
    wrong: ['=LOOKUP(P7,$L$6:$L$9,$M$6:$M$9)', '=LOOKUP(P7,$M$6:$M$9,$N$6:$N$9)', '=INDEX($M$6:$M$9,MATCH(P7,$N$6:$N$9,0))'],
    hints: [
      'Row 6 is "tram 0": the pen starts empty, so one set of row-7 formulas works for every tram.',
      '`LOOKUP`(P7, the cumulative column, the visitors column), with both ranges anchored by $ so they survive the fill.',
    ],
    explain:
      'P7 = 0.8722 is at least 0.85, so tram 1 meets 80 arrivals; P8 = 0.0308 is below 0.2, so tram 2 meets 25. Without $ the ranges ' +
      'slide as you fill: D8 already looks in N7:N10 and shows #N/A for P8 = 0.0308. =INDEX($M$6:$M$9,MATCH(P7,$N$6:$N$9,1)) is equivalent.',
  }),
  column({
    id: 'pen', col: 'E', marks: 0.75,
    what: 'visitors in the pen: the new arrivals plus those left from the previous tram (G6), capped by the pen capacity G2.',
    solution: '=MIN(D7+G6,$G$2)',
    wrong: ['=MIN(D7,$G$2)', '=D7+G6', '=MIN(D7+G6,$D$2)'],
    hints: [
      'Who is waiting when the tram pulls in? This interval\'s arrivals plus the visitors the previous tram left behind (G6).',
      '`MIN`(D7+G6, $G$2): never more than the pen holds. Anchor G2, keep G6 relative so it becomes G7, G8 ... as you fill ' +
        '(G7 inside E7 would be circular: that is this tram\'s leftover).',
    ],
    explain:
      'Tram 1: 80 arrive and nobody is waiting yet (G6 = 0), but only 60 fit, so E7 = 60. Tram 16: 45 arrive while 5 are left from ' +
      'tram 15, so 50 are in the pen. Leaving out G6 loses the queue; leaving out the cap lets the pen hold 85.',
  }),
  column({
    id: 'riders', col: 'F', marks: 0.5,
    what: 'riders boarded: the visitors in the pen, capped by the seats in D2.',
    solution: '=MIN($D$2,E7)',
    wrong: ['=MIN($D$2,D7)', '=MAX($D$2,E7)', '=MIN($G$2,E7)'],
    hints: ['A tram leaves when it is full or the pen is empty.', '`MIN`($D$2, E7): the smaller of the seats and the visitors in the pen.'],
    explain: 'Tram 1 boards MIN(40, 60) = 40; tram 3 finds only 30 in the pen and leaves with all of them. Boarding from D7 would ignore the visitors already waiting.',
  }),
  column({
    id: 'left', col: 'G', marks: 0.25,
    what: 'left in pen: the visitors who could not board and wait for the next tram.',
    solution: '=E7-F7',
    wrong: ['=D7-F7', '=E7-$D$2'],
    hints: ['Everyone in the pen either boards or stays.', 'Visitors in the pen minus riders.'],
    explain: 'G7 = 60 - 40 = 20 wait for tram 2, which is why E8 = 25 + 20 = 45. G is the carry-over that the next row reads as G7, G8 ...',
  }),
  column({
    id: 'revenue', col: 'H', marks: 0.25,
    what: 'fare revenue of the tram (fare per rider in G3).',
    solution: '=F7*$G$3',
    wrong: ['=D7*$G$3', '=E7*$G$3'],
    hints: ['Who pays: the visitors who arrive, wait or ride?', 'Riders x the fare, with G3 anchored.'],
    explain: 'Only riders pay: 40 x $6 = $240.00 for tram 1. Arrivals (D) or the pen (E) would charge visitors who never ride.',
  }),
  column({
    id: 'turned', col: 'I', marks: 0.75,
    what: 'visitors turned away: the arrivals that do not fit in the pen (new arrivals plus those already waiting, above G2).',
    solution: '=MAX(D7+G6-$G$2,0)',
    wrong: ['=MAX(D7-$G$2,0)', '=D7+G6-$G$2', '=MAX(D7+G6-$D$2,0)'],
    hints: [
      'The overflow is whatever E7 could not hold: arrivals plus the visitors already waiting, minus the pen capacity.',
      '`MAX`(D7+G6-$G$2, 0): never negative when the pen has room. =D7+G6-E7 works too.',
    ],
    explain:
      'Tram 1: 80 + 0 - 60 = 20 are turned away. Tram 21: 80 arrive while 5 still wait, so 25 are turned away; leaving out G6 ' +
      'would count 20. Without MAX a quiet interval shows a negative number of visitors.',
  }),
  column({
    id: 'depart', col: 'J', marks: 1,
    what:
      'actual departure time: the scheduled time C7 plus riders x the loading seconds per rider, taken from Table B (L15:M18) ' +
      'at row Q7 and column R7, as a clock time.',
    solution: '=C7+F7*INDEX($L$15:$M$18,Q7,R7)/(24*3600)',
    // within 1 second: =C7+TIME(0,0,seconds) drops half seconds
    tol: 1 / 86400,
    wrong: [
      '=C7+F7*INDEX($L$15:$M$18,Q7,R7)/24', '=C7+F7*INDEX($L$15:$M$18,Q7,R7)/1440', '=C7+INDEX($L$15:$M$18,Q7,R7)/86400',
      '=C7+E7*INDEX($L$15:$M$18,Q7,R7)/86400',
    ],
    hints: [
      '`INDEX`($L$15:$M$18, Q7, R7) is the loading time per rider in seconds; riders x that is the loading time of the tram.',
      'Excel keeps clock times as fractions of a day: divide seconds by 24*3600 (86,400) before adding them to C7.',
    ],
    explain:
      'Q7 = 4 and R7 = 1 pick 6 s, so 40 riders take 240 s and tram 1 leaves at 19:04:00. Dividing by 24 or 1,440 would read the ' +
      'seconds as hours or minutes. =C7+TIME(0,0,F7*INDEX($L$15:$M$18,Q7,R7)) also works (it drops half seconds). In the exam, once ' +
      'the draws are random, =C7+F7*SMALL($L$15:$M$18,RANDBETWEEN(1,8))/86400 is another valid J7 (a random position among the 8 ' +
      'equally likely values); here J has to read Q7 and R7 so it can be compared with the model on the same draws.',
  }),
]

const summary: Task = {
  id: 'summary',
  kind: 'formula',
  cells: 'H29:H32',
  marks: 1,
  prompt:
    '(b) Report total fare revenue in H29 (`SUM` of H7:H27), total turned away in H30, the average left in pen per departure in ' +
    'H31 (`AVERAGE` of G7:G27) and the actual departure time of the last tram in H32 (= J27).',
  solutions: { H29: '=SUM(H7:H27)', H30: '=SUM(I7:I27)', H31: '=AVERAGE(G7:G27)', H32: '=J27' },
  wrong: ['=SUM(H7:H26)', '=SUM(F7:F27)', '=AVERAGE(H7:H27)'],
  hints: ['Each summary covers all 21 trams, rows 7 to 27.', 'H32 is a clock time: link it to J27 and keep the hh:mm:ss format.'],
  explain:
    'With the fixed draws the first run gives $4,530.00 revenue, 65 turned away, 4.2857 left per departure and a last departure at ' +
    '21:03:20. A marker checks both the formula (all 21 rows) and the value in its format: money to 2 dp and H32 as hh:mm:ss, not 0.8773.',
}

// ---------- parts (c) to (e) ----------

const replications: Task[] = [
  {
    id: 'reps-left',
    kind: 'tool',
    tool: 'datatable',
    cells: BODY_LEFT,
    marks: 0.75,
    prompt:
      `(c)(i) Replace the fixed draws with =RAND() in P7:P27, =RANDBETWEEN(1,4) in Q7:Q27 and =RANDBETWEEN(1,2) in R7:R27. Then ` +
      `replicate the evening ${RUNS} times with a one-variable Data Table: put =H31 in D35 (the trial numbers 1-${RUNS} are already ` +
      `in C${FIRST_REP}:C${LAST_REP}), select C35:D${LAST_REP} and run What-If Analysis > Data Table with an empty Row input cell ` +
      'and a blank Column input cell (L30).',
    solutions: { ...RAND_DRAWS, D35: '=H31' },
    toolSetup: { range: `C35:D${LAST_REP}`, colInput: 'L30' },
    // the mean of the RUNS replications within 4 standard errors (SD 3.067 per evening)
    random: { trials: 1, stat: 'mean', target: LEFT_60.mean, tol: tol4(LEFT_60.sd, 0.1) },
    hints: [
      'Once P7:R27 hold RAND/RANDBETWEEN, every recalculation is a new evening, and a Data Table recalculates the model once per trial number.',
      'D35 = H31. The trial numbers only trigger the recalculations, so the Column input cell must be a blank cell that feeds nothing (L30), never G2.',
    ],
    explain:
      'Each row of the table is one independent evening. The input cell must be blank: with G2 as the input cell the table would ' +
      'set the pen size to 1, 2, 3 ... row by row (that averages about 12 instead of 8). Q7:R27 only move the departure times in ' +
      'column J, so they do not change H31 or H29, but the exam still expects all three columns switched. A marker looks for the ' +
      'RAND/RANDBETWEEN draws, D35 = H31 and {=TABLE(,L30)} in the body.',
  },
  {
    id: 'left-avg',
    kind: 'formula',
    cells: 'D34',
    marks: 0.25,
    prompt: `(c)(i) In D34 estimate the average number left in the pen per departure (pen 60): average the ${RUNS} replications.`,
    solution: `=AVERAGE(${BODY_LEFT})`,
    wrong: [`=AVERAGE(D35:D${LAST_REP})`, '=D35', `=MEDIAN(${BODY_LEFT})`],
    hints: [`Average the replications D${FIRST_REP}:D${LAST_REP} only: D35 is the current evening, not a replication.`],
    explain:
      `About 8.0 visitors are left behind per departure (long run ${LEFT_60.mean}; ${RUNS} trials usually give ${band(LEFT_60)}). ` +
      'With the exam\'s 1,000 replications the accepted range narrows to about 7.68-8.26. Press F9 and D34 moves: it is an estimate.',
  },
  {
    id: 'left-150',
    kind: 'value',
    cells: 'E34',
    marks: 1,
    prompt:
      '(c)(ii) Estimate the same average for a 150-place pen: change G2 to 150, press F9 (Data Tables re-run only on F9), then type ' +
      'the new D34 into E34 as a number. Set G2 back to 60 afterwards.',
    answer: LEFT_150.mean,
    // a RUNS-trial estimate: within 4 standard errors (SD 24.2 per evening); the pen-60 value fails
    check: { tol: tol4(LEFT_150.sd, 0.1) },
    wrong: [String(LEFT_60.mean), '=D34'],
    hints: [
      'Type 150 in G2 and press F9: the draws and both tables are recalculated with the bigger pen.',
      'Type the number itself into E34: a formula such as =D34 would follow the table back to pen 60.',
    ],
    explain:
      `About 41 left per departure (long run ${LEFT_150.mean}; ${RUNS} trials usually give ${band(LEFT_150, 0)}, the exam's 1,000 ` +
      'about 38.85-43.45). Arrivals average 0.2x25 + 0.4x35 + 0.25x45 + 0.15x80 = 42.25 per 6 minutes against 40 seats, so a ' +
      'bigger pen lets a queue build up through the evening instead of turning people away.',
  },
  {
    id: 'reps-revenue',
    kind: 'tool',
    tool: 'datatable',
    cells: BODY_REV,
    marks: 1.5,
    prompt:
      `(d) With the pen at 60 places, replicate the fare revenue per evening (H29) ${RUNS} times: put =H29 in G35 (the trial numbers ` +
      `are already in F${FIRST_REP}:F${LAST_REP}) and run a Data Table on F35:G${LAST_REP} with an empty Row input cell and the ` +
      'Column input cell on a blank cell (L30).',
    solutions: { G35: '=H29' },
    toolSetup: { range: `F35:G${LAST_REP}`, colInput: 'L30' },
    // the mean of the RUNS replications within 4 standard errors (SD $180.25 per evening)
    random: { trials: 1, stat: 'mean', target: REV_60.mean, tol: tol4(REV_60.sd, 5) },
    hints: [
      'Same set-up as part (c), one block to the right: the output cell G35 links to the revenue in H29.',
      `Select F35:G${LAST_REP}, Data Table, Row input cell empty, Column input cell L30.`,
    ],
    explain: 'Each row is one evening\'s revenue. A marker looks for G35 = H29 and {=TABLE(,L30)} with a blank input cell.',
  },
  {
    id: 'revenue-avg',
    kind: 'formula',
    cells: 'G34',
    marks: 0.5,
    prompt: `(d) In G34 estimate the average fare revenue per evening from the ${RUNS} replications.`,
    solution: `=AVERAGE(${BODY_REV})`,
    wrong: [`=AVERAGE(G35:G${LAST_REP})`, '=G35', `=SUM(${BODY_REV})`],
    hints: [`Average G${FIRST_REP}:G${LAST_REP}, the replications only.`],
    explain:
      `About ${usd(REV_60.mean)} per evening (${RUNS} trials usually give ${usdBand(REV_60)}; the exam's 1,000 about $4,701-$4,735). ` +
      'Revenue can never exceed 21 x 40 x $6 = $5,040: the seats cap it, and on average about 93 visitors an evening are turned away.',
  },
]

const advice: Task = {
  id: 'advice',
  kind: 'explain',
  cells: '',
  marks: 2,
  prompt:
    '(e) Management can either enlarge the pen (to 150, or even 300 places) or buy larger 46-seat trams and keep the pen at 60. ' +
    'Estimate the average revenue per evening for pen 150, pen 300 and 46-seat trams, recommend one option and explain in 2-3 ' +
    'sentences. (Change G2 or D2, press F9 so both tables re-run, read G34 and D34, then restore G2 = 60 and D2 = 40.)',
  answer:
    `Pen 150: about ${usd(REV_150.mean)}; pen 300: about the same (no further gain); 46-seat trams with the 60 pen: about ` +
    `${usd(REV_46_SEATS.mean)} (today: about ${usd(REV_60.mean)}). Seats are the bottleneck: on average 42.25 visitors arrive ` +
    'per 6 minutes but a tram takes only 40, so a bigger pen mostly turns lost visitors into a longer queue (about 41 left behind ' +
    'per departure at 150), and 300 places add nothing. Larger trams raise revenue at least as much and cut the average queue to ' +
    'about 3, so I recommend the 46-seat trams.',
  hints: [
    'Run each scenario on the same number of trials and compare G34 (revenue) and D34 (queue left behind).',
    'Ask what limits revenue: the pen only stores visitors, the seats decide how many ride.',
  ],
  explain:
    'Revenue counts riders, and riders are capped by the seats: 21 x 40 x $6 = $5,040 an evening now, 21 x 46 x $6 = $5,796 with ' +
    'larger trams. A bigger pen helps only by keeping visitors who would otherwise be turned away; a 150-place pen overflows only ' +
    'behind a queue long enough to fill the next trams anyway, so the extra places of a 300 pen hold visitors who would not ride ' +
    `before closing. With ${RUNS} trials a revenue estimate has a standard error of about ` +
    `${usd(half(REV_150.sd, 1))}-${usd(half(REV_46_SEATS.sd, 1))}, so the ${usd(REV_46_SEATS.mean - REV_150.mean)} gap between 46 seats and pen 150 can flip between ` +
    'runs: press F9 a few times, and let the far shorter queue (about 3 against 41) settle the choice. Marks go to the three ' +
    'estimates (exam ranges for 1,000 trials: $4,832-$4,867 for either pen, $4,851-$4,900 for 46 seats) and to a recommendation ' +
    'that the numbers support.',
}

export const exercise: Exercise = {
  id: 'mock-a-q2',
  week: 'EXAM',
  topic: 'Batch-service queue simulation',
  title: 'Night-safari trams: queue, capacity and replications',
  level: 3,
  minutes: 60,
  scenario:
    'A wildlife park runs evening trams from its entrance plaza. A tram is scheduled every 6 minutes (D3) from 19:00 (J2) to 21:00 ' +
    'inclusive, 21 departures, and seats 40 (D2). Visitors wait in a holding pen of at most 60 people (G2); anyone arriving when the ' +
    'pen is full is turned away. Riders board first-come-first-served and a tram leaves as soon as it is full or the pen is empty. ' +
    'Visitors arriving per 6-minute interval follow Table A; loading time per rider is equally likely to be any of the 8 values in ' +
    'Table B; the fare is $6 per rider (G3). Columns P:R hold pre-drawn random numbers so your first run is reproducible.',
  sheet: {
    rows: LAST_REP,
    cols: 18,
    cells: sheetCells,
    colWidths: {
      A: 24, B: 70, C: 162, D: 126, E: 118, F: 154, G: 162, H: 126, I: 90, J: 120, K: 24, L: 156, M: 132, N: 154, O: 24, P: 154,
      Q: 154, R: 154,
    },
    frozenRows: 3,
  },
  tasks: [crf, ...tramColumns, summary, ...replications, advice],
  // three cases that between them move every input (each case re-reads every formula task, so they are grouped)
  testCases: [
    {
      name: 'Table A changes to 10% / 30% / 40% / 20% for 20, 30, 50 and 90 visitors',
      inputs: { L6: 0.1, L7: 0.3, L8: 0.4, L9: 0.2, M6: 20, M7: 30, M8: 50, M9: 90 },
    },
    { name: 'trams seat 30, the pen holds 45 and the fare is $7.50', inputs: { D2: 30, G2: 45, G3: 7.5 } },
    {
      name: 'every loading time is 1 second longer and the first tram leaves at 18:30',
      inputs: { L15: 4, M15: 4.5, L16: 5, M16: 5.5, L17: 6, M17: 6.5, L18: 7, M18: 8.5, J2: t(18, 30) },
    },
  ],
  skills: [
    'CRF lower bounds + LOOKUP', 'MIN/MAX capacity with carry-over', 'INDEX draw from a 4x2 table', 'seconds to day fractions (/86400)',
    'Data Table replications on a blank input cell', 'what-if on pen and tram size', 'written recommendation',
  ],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'Capacity and flow-balance logic with MIN/MAX',
    'Time-stepped batch-service queue simulation',
    'INDEX by row/column number (matrix lookup)',
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Unit conversion (MB to GB, seconds/minutes to day fractions)',
    'Absolute/mixed references so formulas fill down/right',
    'Data Table for Monte Carlo replications (blank input cell)',
    'What-if / scenario analysis by changing inputs',
    'Queue performance measures (weighted wait, % within threshold, utilisation)',
    'Written interpretation of model results',
  ],
}
