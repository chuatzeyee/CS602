import type { CellSpec, CellValue, Exercise } from '../../../lab/types'

// Mock B, Q2 (13 marks): zoo entrance with C10 ticket counters sharing one queue (exponential arrivals, CRF party
// sizes, NORMINV ticketing with a MAX floor, COUNTIF + LARGE start times) and a membership officer as a side
// process (Bernoulli invitation, uniform chat length), queue measures weighted by party size, then Data Table
// replications comparing pooled counters with dedicated lines.
// Original scenario and numbers: site_build/exam/analysis.json mock_blueprints[1].questions[1], expected values from
// _generator/m2q2_calc.py. With the fixed draws in Q16:U40 the model reproduces the blueprint's first run exactly
// (C16 0:00:13, E16 0:01:03, G40 9:25:48, H40 = K40 9:26:55, O40 11, chats 3, G10 0:04:13, H10 42.19%, I10 93.11%).
// Part (f) swaps the draws for RAND(), so the checker compares parts (a)-(e) on seeded random draws (the same draws
// on both sides) and the replications against long-run averages (400,000 runs of the generator model).
// Lab adaptations: the sheet stops at column Z, so the pooled table sits under the model (B44) instead of W20:AC71,
// and it covers 1-3 counters x TRIALS trials instead of 1-6 x 50 (4-6 counters wait about 0:00:12, 0:00:03 and 0:00:01;
// every check re-runs the table three times and each cell re-simulates the whole model, so its size sets the check
// time); the dedicated-line estimates (C10 = 1) are read from the table's 1-counter column after changing C4 (a
// what-if, not a second table) and typed in.

const t = (h: number, m = 0, s = 0): number => (h * 3600 + m * 60 + s) / 86400
const mins = (m: number): number => m / 1440

const CLOCK = 'hh:mm:ss'
const PCT = '0%'
const PCT2 = '0.00%'
const MIN2 = '0.00'
const DRAW = '0.0000'

const FIRST = 16 // party 1
const LAST = 40 // party 25
const TRIALS = 10 // replications in the pooled data table: each table run re-simulates the model 3 x TRIALS times
const TOP = 44 // corner row of the pooled table
const BODY_END = TOP + TRIALS
const AVG = BODY_END + 1 // averages row
const COUNTERS = ['C', 'D', 'E'] // 1..3 counters across
const LAST_COL = COUNTERS[COUNTERS.length - 1]
const BLANK = 'H45' // a free cell for the Column input of the table

const label = (v: string, bold = false): CellSpec => (bold ? { v, role: 'label', bold } : { v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt: string): CellSpec => ({ v, role: 'input', fmt })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const givenF = (f: string, fmt: string): CellSpec => ({ f, role: 'given', fmt })
const answer = (fmt?: string): CellSpec => (fmt ? { role: 'answer', fmt } : { role: 'answer' })

const rowsOf = (r1: number, r2: number): number[] => Array.from({ length: r2 - r1 + 1 }, (_, i) => r1 + i)
const PARTY_ROWS = rowsOf(FIRST, LAST)

// the same spec in every listed column of rows r1..r2
function grid(cols: readonly string[], r1: number, r2: number, make: (row: number, col: string) => CellSpec): Record<string, CellSpec> {
  return Object.fromEntries(cols.flatMap((c) => rowsOf(r1, r2).map((r) => [`${c}${r}`, make(r, c)])))
}

// reference entries of parties 1..25 from row formulas: { D: (r) => formula of row r }
function partyFormulas(cols: Record<string, (r: number) => string>): Record<string, string> {
  return Object.fromEntries(PARTY_ROWS.flatMap((r) => Object.entries(cols).map(([c, f]) => [`${c}${r}`, f(r)])))
}

// pre-drawn uniform numbers of the blueprint (rows 16-40): inter-arrival, party size, ticketing, chat select, chat length
const DRAWS: Record<string, readonly number[]> = {
  Q: [0.2714, 0.8873, 0.8234, 0.5426, 0.008, 0.6685, 0.9394, 0.519, 0.6117, 0.4489, 0.4792, 0.5834, 0.6011, 0.4999, 0.1306, 0.6271, 0.6484, 0.3553, 0.3135, 0.9774, 0.4613, 0.1705, 0.4984, 0.733, 0.1024],
  R: [0.8046, 0.5007, 0.4035, 0.6208, 0.1267, 0.6987, 0.6159, 0.6083, 0.5896, 0.5225, 0.7505, 0.9059, 0.2562, 0.2548, 0.503, 0.8737, 0.0914, 0.9167, 0.9287, 0.9654, 0.8834, 0.0257, 0.307, 0.3724, 0.1303],
  S: [0.0182, 0.3897, 0.6657, 0.8391, 0.9589, 0.3448, 0.7531, 0.808, 0.5433, 0.8252, 0.5091, 0.3648, 0.9591, 0.5576, 0.7785, 0.1882, 0.9046, 0.6572, 0.6125, 0.9311, 0.5439, 0.6621, 0.136, 0.5023, 0.3941],
  T: [0.1886, 0.8329, 0.6768, 0.8394, 0.8522, 0.3235, 0.8582, 0.7128, 0.9939, 0.9483, 0.3492, 0.5472, 0.2877, 0.6917, 0.9214, 0.3068, 0.5097, 0.8052, 0.5243, 0.3441, 0.1781, 0.2921, 0.3027, 0.8776, 0.4464],
  U: [0.3241, 0.6097, 0.152, 0.3499, 0.0348, 0.9891, 0.6074, 0.452, 0.8423, 0.8307, 0.803, 0.4298, 0.9877, 0.7858, 0.7564, 0.8379, 0.5187, 0.5679, 0.1767, 0.5396, 0.1332, 0.4093, 0.952, 0.6769, 0.6932],
}

// Table 1 (rows 4-7): party size, probability, mean and SD of the ticketing time (min), chance of a membership chat
const SIZES = [1, 2, 3, 4]
const PROB = [0.2, 0.4, 0.25, 0.15]
const MEAN = [1.2, 1.6, 2.1, 2.6]
const SD = [0.3, 0.4, 0.5, 0.6]
const CHAT = [0.4, 0.3, 0.2, 0.15]

// long-run average wait per visitor in minutes (400,000 runs of 25 parties each, generator model) and the SD of one run
const POOLED = { mean: [13.5763, 3.1274, 0.7529, 0.2005, 0.0568, 0.0162], sd: [2.4024, 1.4356, 0.6235, 0.2398, 0.0968, 0.0418] }
const DEDICATED = { k: [2, 3, 4, 5, 6], mean: [6.7719, 2.9878, 1.5732, 1.0079, 0.7317], sd: [2.9577, 2.0317, 1.1697, 0.7359, 0.5213] }

// reference formulas of parts (c) and (d), row r (the blueprint's row-16 formulas filled down)
const QUEUE: Record<string, (r: number) => string> = {
  D: (r) => `=LOOKUP(R${r},$J$3:$J$6,$E$4:$E$7)`,
  E: (r) => `=MAX($L$4/1440,NORMINV(S${r},LOOKUP(D${r},$E$4:$E$7,$G$4:$G$7)/1440,LOOKUP(D${r},$E$4:$E$7,$H$4:$H$7)/1440))`,
  F: (r) => `=F${r - 1}+C${r}`,
  G: (r) => `=IF(O${r}<$C$10,F${r},LARGE($H$15:H${r - 1},$C$10))`,
  H: (r) => `=G${r}+E${r}`,
  O: (r) => `=COUNTIF($H$15:H${r - 1},">"&F${r})`,
}
const OFFICER: Record<string, (r: number) => string> = {
  I: (r) => `=IF(MAX($L$15:L${r - 1})<H${r},"Yes","No")`,
  J: (r) => `=IF(AND(I${r}="Yes",T${r}<LOOKUP(D${r},$E$4:$E$7,$I$4:$I$7)),"Yes","No")`,
  K: (r) => `=IF(J${r}="No",H${r},H${r}+($M$4+U${r}*($N$4-$M$4))/1440)`,
  L: (r) => `=IF(J${r}="No",0,K${r})`,
  M: (r) => `=G${r}-F${r}`,
  N: (r) => `=K${r}-F${r}`,
}

const TIME_COLS = ['C', 'E', 'F', 'G', 'H', 'K', 'L', 'M', 'N']
const MODEL_FMT: Record<string, string | undefined> = { D: '0', I: undefined, J: undefined, O: '0' }

const cells: Record<string, CellSpec> = {
  B1: label('Zoo entrance: ticket counters and a membership officer', true),
  C3: label('Average Inter-arrival Time'), C4: input(t(0, 0, 40), CLOCK),
  F1: label('Table 1 - Party sizes', true),
  E2: header('Party Size'), F2: header('Probability'), G2: header('Mean Ticketing Time (min)'), H2: header('SD Ticketing Time (min)'),
  I2: header('Probability of Membership Chat'), J2: header('Cumulative Probability (CRF)'),
  J3: given(0, PCT),
  ...Object.fromEntries(SIZES.flatMap((size, i) => [
    [`E${4 + i}`, given(size, '0')], [`F${4 + i}`, input(PROB[i], PCT)], [`G${4 + i}`, input(MEAN[i], MIN2)],
    [`H${4 + i}`, input(SD[i], MIN2)], [`I${4 + i}`, input(CHAT[i], PCT)], [`J${4 + i}`, answer(PCT)],
  ])),
  L3: header('Min Ticketing (min)'), M3: header('Min Chat (min)'), N3: header('Max Chat (min)'),
  L4: input(0.75, MIN2), M4: input(2, MIN2), N4: input(5, MIN2),
  C9: label('Number of Counters'), C10: input(2, '0'),
  E9: label('Good-Experience Threshold'), E10: input(t(0, 3), CLOCK),
  G9: header('Avg Wait per Visitor'), H9: header('% Visitors with Good Experience'), I9: header('Counter Utilisation'),
  G10: answer(CLOCK), H10: answer(PCT2), I10: answer(PCT2),
  B14: header('Party'), C14: header('Inter-arrival'), D14: header('Party Size'), E14: header('Ticketing Time'), F14: header('Arrival'),
  G14: header('Start'), H14: header('End of Ticketing'), I14: header('Officer Free?'), J14: header('Chat?'), K14: header('Leave Time'),
  L14: header('Officer Free From'), M14: header('Wait'), N14: header('Time in System'), O14: header('Parties in System'),
  F15: givenF('=H15', CLOCK), H15: given(t(9), CLOCK), K15: given(t(9), CLOCK), L15: given(t(9), CLOCK),
  ...grid(['B'], FIRST, LAST, (r) => given(r - FIRST + 1)),
  ...grid(TIME_COLS, FIRST, LAST, () => answer(CLOCK)),
  ...grid(Object.keys(MODEL_FMT), FIRST, LAST, (_, c) => answer(MODEL_FMT[c])),
  Q15: header('U inter-arrival'), R15: header('U party size'), S15: header('U ticketing'), T15: header('U chat select'), U15: header('U chat length'),
  ...grid(Object.keys(DRAWS), FIRST, LAST, (r, c) => ({ v: DRAWS[c][r - FIRST], role: 'answer', fmt: DRAW })),
  I41: label('Parties that chat'), J41: answer('0'),
  // part (f): pooled two-way table (counters across, trials down) and the dedicated-line what-ifs
  B43: label('Pooled queue: average wait per visitor (counters across, trials down)', true),
  [`B${TOP}`]: answer(CLOCK),
  ...Object.fromEntries(COUNTERS.map((c, i) => [`${c}${TOP}`, given(i + 1, '0')])),
  ...grid(['B'], TOP + 1, BODY_END, (r) => given(r - TOP, '0')),
  ...grid(COUNTERS, TOP + 1, BODY_END, () => answer(CLOCK)),
  [`B${AVG}`]: label('Average'),
  H44: label('Blank cell'),
  [BLANK]: { note: 'An empty cell: use it as the Column input cell of the data table' },
  ...grid(COUNTERS, AVG, AVG, () => answer(CLOCK)),
  J43: label('Dedicated lines (one counter each)', true),
  J44: header('Lines (k)'), K44: header('Inter-arrival per line'), L44: header('Avg wait per visitor'),
  ...Object.fromEntries(DEDICATED.k.flatMap((k, i) => [
    [`J${45 + i}`, given(k, '0')], [`K${45 + i}`, given(t(0, 0, 40 * k), CLOCK)], [`L${45 + i}`, answer(CLOCK)],
  ])),
}

export const exercise: Exercise = {
  id: 'mock-b-q2',
  week: 'EXAM',
  topic: 'Multi-server queue with a side process',
  title: 'Zoo entrance: multi-counter ticket queue with a membership officer',
  level: 3,
  minutes: 60,
  scenario:
    'Parties of 1-4 visitors join one queue at a zoo gate and are served by C10 ticket counters: inter-arrival times are exponential ' +
    'with mean C4, party sizes follow Table 1, and ticketing takes a normal time (minutes) with the mean and SD of the party size, never ' +
    'under L4. One membership officer waits after the counters: a party that finishes ticketing while the officer is free is invited to ' +
    'a chat with the probability in column I; the chat lasts a uniform M4 to N4 minutes, then the party leaves. The day starts at ' +
    '09:00:00 (row 15) and the model covers 25 parties (rows 16-40); Q16:U40 hold pre-drawn uniform numbers for a reproducible first ' +
    'run, which part (f) switches to RAND() for replications.',
  sheet: {
    rows: AVG,
    cols: 21,
    cells,
    colWidths: {
      A: 28, B: 68, C: 104, D: 104, E: 124, F: 90, G: 190, H: 234, I: 226, J: 112, K: 168, L: 146, M: 110, N: 110, O: 100,
      P: 24, Q: 118, R: 96, S: 90, T: 104, U: 104,
    },
  },
  tasks: [
    {
      id: 'crf',
      kind: 'formula',
      cells: 'J4:J7',
      marks: 0.5,
      prompt: '(a) Complete J4:J7 (J3 = 0) so that `LOOKUP` can generate a random party size: one formula in J4, filled down to J7.',
      solution: '=SUM($F$4:F4)',
      wrong: ['=SUM(F4:F4)', '=F4', '=SUM($F$4:F5)'],
      hints: [
        'Each cell holds the probability of this size or smaller: the running total of column F.',
        'Anchor the start of the range so it grows as you fill down: =SUM($F$4:F4). =J3+F4 works too.',
      ],
      explain:
        'J3:J7 read 0, 20%, 60%, 85%, 100%. J3:J6 are the lower bounds of the four bands, so LOOKUP(u, $J$3:$J$6, $E$4:$E$7) returns ' +
        '1 for u in [0, 20%), 2 for [20%, 60%), 3 for [60%, 85%) and 4 for [85%, 100%). J7 = 100% only closes the last band.',
    },
    {
      id: 'interarrival',
      kind: 'formula',
      cells: 'C16:C40',
      marks: 0.5,
      prompt:
        '(b) In C16 simulate the exponential inter-arrival time with mean C4 from the uniform draw in Q16, inverted as -mean x LN(1 - u) ' +
        '(in the exam you would write `RAND()` instead of Q16); fill down to C40.',
      solution: '=-$C$4*LN(1-Q16)',
      wrong: ['=-$C$4*LN(Q16)', '=$C$4*LN(1-Q16)', '=-40/86400*LN(1-Q16)', '=-$C$4*LN(1-Q16)/86400'],
      hints: [
        'An exponential time with mean m is -m*LN(1-u) for a uniform u: LN of a number below 1 is negative, hence the minus sign.',
        'C4 already holds 40 seconds as a fraction of a day, so the result is a time; lock C4 with $ before filling down.',
      ],
      explain:
        'C16 = -0:00:40 x LN(1 - 0.2714) = 0:00:12.7, shown as 0:00:13. Because C4 is a time, so is the result: no /86400 is needed. ' +
        'A typed 40/86400 gives the same first run but ignores a new mean in C4.',
    },
    {
      id: 'queue',
      kind: 'formula',
      cells: 'D16:H40,O16:O40',
      marks: 2.5,
      prompt:
        '(c) Write D16 (party size from R16), E16 (ticketing time from S16: normal with the mean and SD for the party size, in minutes, ' +
        'but never below L4), F16 (arrival), O16 (earlier parties that have not finished ticketing when this party arrives), G16 ' +
        '(start of ticketing with C10 counters) and H16 (end of ticketing); fill down to row 40. H40 is when party 25 finishes ticketing.',
      solutions: partyFormulas(QUEUE),
      wrong: ['=LOOKUP(R16,$J$4:$J$7,$E$4:$E$7)', '=LOOKUP(R16,$J$3:$J$6,$F$4:$F$7)', '=VLOOKUP(R16,$J$3:$J$6,1,TRUE)'],
      hints: [
        'Size: LOOKUP of R16 in the lower bounds $J$3:$J$6. Ticketing: NORMINV(S16, mean, SD) with the mean and SD of that size looked up ' +
          'the same way and divided by 1440, floored with MAX($L$4/1440, ...).',
        'O16 = COUNTIF($H$15:H15, ">"&F16) counts earlier ends after this arrival. Start: on arrival if O16 < $C$10, otherwise when a ' +
          'counter frees up, LARGE($H$15:H15, $C$10). End = start + ticketing time.',
      ],
      explain:
        'With the fixed draws, party 1 is a party of 3 (0.8046 lies in [60%, 85%)) and its ticketing takes NORMINV(0.0182, 2.1, 0.5) = ' +
        '1.05 min = 0:01:03, above the 0.75-minute floor. While fewer than C10 parties are at the counters a party starts on arrival; ' +
        'otherwise it waits for the C10-th largest earlier end time. Party 25 arrives with 11 parties still in the system (O40), starts ' +
        'at 9:25:48 and finishes ticketing at 9:26:55 (H40). Means, SDs and L4 are minutes: divide by 1440 before mixing them with clock times.',
    },
    {
      id: 'officer',
      kind: 'formula',
      cells: 'I16:N40,J41',
      marks: 3.5,
      prompt:
        '(d) Write I16 (is the officer free when the party finishes ticketing? "Yes"/"No"), J16 (chat? "Yes"/"No" from T16 and the ' +
        'chat probability for the party size in column I; only possible if the officer is free), K16 (leave time = end of ticketing, plus ' +
        'a uniform 2-5 minute chat (M4:N4) from U16 if chatting), L16 (officer free-from time: K16 if chatting, otherwise 0 so it does not ' +
        'affect the officer), M16 (wait) and N16 (time in system); fill down to row 40. In J41 count the parties that chat; K40 is when ' +
        'party 25 leaves.',
      solutions: { ...partyFormulas(OFFICER), J41: '=COUNTIF(J16:J40,"Yes")' },
      wrong: ['=IF(MAX($L$15:L15)>H16,"Yes","No")', '=IF(MAX($L$15:L15)<H16,"No","Yes")', '=IF(MAX($L$15:L15)<H16,TRUE,FALSE)'],
      hints: [
        'The officer is next free at the latest "free from" time so far, MAX($L$15:L15); the zeros of parties who did not chat never win the MAX.',
        'Chat when AND(I16="Yes", T16 < the chance for this size); a chat lasts $M$4 + U16*($N$4-$M$4) minutes, so divide by 1440 ' +
          'before adding it to H16. Wait = start - arrival; time in system = leave - arrival.',
      ],
      explain:
        'With the fixed draws 3 parties chat: parties 1, 13 and 22. Party 1 (size 3, chance 20%) has T16 = 0.1886 < 20%, so it chats for ' +
        '2 + 0.3241 x 3 = 2.97 minutes and leaves at 9:04:14 (K16); the officer is busy until then, so party 2 is not even asked. Party ' +
        '25 does not chat and leaves when its ticketing ends, at 9:26:55 (K40). L16 = 0 for non-chatting parties keeps the MAX on the ' +
        'last real chat.',
    },
    {
      id: 'kpis',
      kind: 'formula',
      cells: 'G10:I10',
      marks: 3,
      prompt:
        '(e) Compute G10 = average wait per visitor (each party\'s wait counts once per person), H10 = share of visitors who wait no ' +
        'longer than E10, and I10 = utilisation of the ticket counters (total ticketing time / (counters x time from 09:00 until the ' +
        'latest end of ticketing in column H)).',
      solutions: {
        G10: '=SUMPRODUCT(D16:D40,M16:M40)/SUM(D16:D40)',
        H10: '=SUMPRODUCT((M16:M40<=E10)*D16:D40)/SUM(D16:D40)',
        I10: '=SUM(E16:E40)/(C10*(MAX(H16:H40)-H15))',
      },
      wrong: ['=AVERAGE(M16:M40)', '=SUMPRODUCT(D16:D40,M16:M40)/25', '=SUMPRODUCT(D16:D40,N16:N40)/SUM(D16:D40)'],
      hints: [
        'Per visitor means weighting each wait by the party size: SUMPRODUCT(sizes, waits) / SUM(sizes).',
        'H10: SUMPRODUCT((M16:M40<=E10)*D16:D40) (or SUMIF on the waits) over all visitors, SUM(D16:D40). I10: the counters are ' +
          'open from H15 to MAX(H16:H40), C10 of them at a time.',
      ],
      explain:
        'The 25 parties bring 64 visitors. Weighting by size gives 0:04:13 per visitor; a plain AVERAGE of M16:M40 would count a party of ' +
        '4 like a single visitor. 27 of the 64 visitors (42.19%) wait at most 3:00; SUMIF(M16:M40,"<="&E10,D16:D40)/SUM(D16:D40) is ' +
        'equivalent. The counters work 50:08 of ticketing in 2 x 26:55, so utilisation is 93.11%. With several counters the last arrival ' +
        'need not finish last, so take MAX(H16:H40) rather than H40: they coincide on the fixed draws, but not in every replication.',
    },
    {
      id: 'draws',
      kind: 'formula',
      cells: 'Q16:U40',
      marks: 0.25,
      prompt:
        '(f) Switch the fixed draws in Q16:U40 to `RAND` (one formula in Q16, filled across and down), so every recalculation ' +
        'simulates a new morning.',
      solution: '=RAND()',
      random: { trials: 4, stat: 'p', event: '<0.25', target: 0.25, tol: 0.08 },
      wrong: ['=RANDBETWEEN(0,1)', '=RAND()*2'],
      hints: ['Type =RAND() in Q16 and fill it across to U16 and down to row 40.', 'Leave columns C-O alone: they already read the draws.'],
      explain:
        '125 fresh uniforms per recalculation turn the fixed first run into one random replication; F9, and every cell of a Data Table, ' +
        'draws a new one. The formulas of parts (a)-(e) stay exactly as they are.',
    },
    {
      id: 'corner',
      kind: 'formula',
      cells: `B${TOP}`,
      marks: 0.25,
      prompt:
        `(f)(i) Pooled queue: B${TOP}:${LAST_COL}${BODY_END} becomes a two-way Data Table with counters 1-3 across ` +
        `(C${TOP}:${LAST_COL}${TOP}) and trials 1-${TRIALS} down (B${TOP + 1}:B${BODY_END}). In its corner B${TOP} link to the ` +
        'average wait per visitor.',
      solution: '=G10',
      wrong: ['=G16', '=H10'],
      hints: ['The corner of a two-way table holds the one output formula the table re-evaluates.', 'Point it at G10.'],
      explain: 'The table evaluates the corner formula once for every pair of a counters value (across) and a trial number (down).',
    },
    {
      id: 'pooled',
      kind: 'tool',
      tool: 'datatable',
      cells: `C${TOP + 1}:${LAST_COL}${BODY_END}`,
      marks: 0.75,
      prompt:
        `(f)(i) Select B${TOP}:${LAST_COL}${BODY_END} and run What-If Analysis > Data Table: the Row input cell is the input that ` +
        `the counters across the top replace, the Column input cell a blank cell (${BLANK} is free). Each row is then a fresh ` +
        'replication of the 25 parties for 1 to 3 counters at 40-second inter-arrival.',
      toolSetup: { range: `B${TOP}:${LAST_COL}${BODY_END}`, rowInput: 'C10', colInput: BLANK },
      // the 1-counter average of the replications, within 4 standard errors of the long-run value
      answer: { [`C${AVG}`]: mins(POOLED.mean[0]) },
      check: { tol: mins((4 * POOLED.sd[0]) / Math.sqrt(TRIALS)) },
      hints: [
        'The values across the top are numbers of counters, so the Row input cell is the cell that holds the number of counters.',
        `Row input cell C10; Column input cell an empty cell that feeds nothing (${BLANK}), so the trial numbers down the side only ` +
          'force fresh draws.',
      ],
      explain:
        'Every body cell re-runs the 25 parties with C10 = the counters above it and new RAND() draws. Long-run averages: 0:13:35, ' +
        '0:03:08 and 0:00:45 for 1 to 3 counters (4 to 6 counters: about 0:00:12, 0:00:03 and 0:00:01).',
    },
    {
      id: 'averages',
      kind: 'formula',
      cells: `C${AVG}:${LAST_COL}${AVG}`,
      marks: 0.5,
      prompt: `(f)(i) In C${AVG} average the trials for 1 counter and fill right to ${LAST_COL}${AVG}.`,
      solution: `=AVERAGE(C${TOP + 1}:C${BODY_END})`,
      wrong: [`=AVERAGE(C${TOP}:C${BODY_END})`, `=AVERAGE($C$${TOP + 1}:$C$${BODY_END})`],
      hints: [
        `Average rows ${TOP + 1}-${BODY_END} of each column, not the counters in row ${TOP}.`,
        'Keep the references relative so the formula fills right.',
      ],
      explain:
        `With ${TRIALS} trials these are rough estimates (about +/-2.3 minutes for one counter and +/-1.4 minutes for two, 3 standard ` +
        'errors), so F9 moves them; the pattern does not change: one counter is hopeless, two are overloaded, three or more keep waits short.',
    },
    {
      id: 'dedicated',
      kind: 'value',
      cells: 'L45:L49',
      marks: 0.5,
      prompt:
        '(f)(ii) Dedicated lines: if each of k counters had its own line and parties were split evenly, each line would be a ' +
        'single-counter queue with inter-arrival k x 40 s. Your table\'s 1-counter column is exactly that queue: set C4 to each time ' +
        `in K45:K49, press F9 and type the 1-counter average (C${AVG}) into L45:L49 as h:mm:ss values. Set C4 back to 0:00:40 afterwards.`,
      answer: Object.fromEntries(DEDICATED.mean.map((m, i) => [`L${45 + i}`, mins(m)])),
      // 10-trial estimates. relTol scales by the larger of the two values, so 0.6 accepts 0.4x to 2.5x the long-run mean: an
      // honest set of five fails about 0.02% of the time (400,000 simulated runs). It always rejects the 40-second value
      // typed without F9 (k = 3-6) and rejects the pooled 3-counter value for k = 3 98% of the time; k = 2 cannot separate
      // either, and 0.7 (0.3x to 3.3x) let the pooled 3-counter value through 22% of the time.
      check: { relTol: 0.6 },
      wrong: ['6.76', '6:45', '0:01:20'],
      hints: [
        'A dedicated line is one counter (C10 = 1) seeing a party every k x 40 s: the 1-counter column of your table with C4 = k x 40 s.',
        'Type the time with its hours, e.g. 0:05:30; 5:30 would mean five hours and 30 minutes.',
      ],
      explain:
        'Long-run single-line averages: 0:06:46 (80 s), 0:02:59 (120 s), 0:01:34 (160 s), 0:01:00 (200 s) and 0:00:44 (240 s). C10 can ' +
        'stay at 2: the table already substitutes C10 = 1 in its first column, so only C4 has to change.',
    },
    {
      id: 'compare',
      kind: 'explain',
      cells: '',
      marks: 0.75,
      prompt: `(f) Compare the two policies in 2-4 sentences: k counters sharing one queue (row ${AVG}) versus k dedicated lines (L45:L49).`,
      hints: [
        `Compare the same number of counters under both policies: row ${AVG} against L45:L49, then ask how many dedicated lines match three pooled counters.`,
        'What does a counter do when its own line is empty while another line is long? And how much ticketing work arrives per minute?',
      ],
      answer:
        'Pooling wins at every staffing level: three counters sharing one queue average about 0:00:45 of waiting per visitor, while ' +
        'three dedicated lines (a party every 120 s each) average about 0:03:00, and it takes about six dedicated counters (0:00:44) to ' +
        'match three pooled ones. With separate lines a counter can sit idle while another line is long; one shared queue always sends ' +
        'the next party to the first free counter. Two counters are too few either way: parties bring about 1.8 minutes of ticketing ' +
        'every 40 seconds (about 2.7 busy counters), so waits build up (about 0:03:08 pooled, 0:06:46 dedicated).',
    },
  ],
  // each test case costs a full re-read of every formula task on this heavy model (about 60 ms), so there are two. The first
  // moves every input; on the checked draws its wide SDs make party 24 finish ticketing after party 25 (so H40 in place of
  // MAX(H16:H40) fails in I10) and the 1-minute floor binds for three parties (so a NORMINV without MAX fails in E). The
  // second makes every party chat whatever the draws (one counter spaces the ends by at least L4, longer than any chat), so
  // party 25 chats and a count over J16:J39 fails.
  testCases: [
    {
      name:
        'a busier gate (a party every 35 s), three counters, larger and slower parties with more variable ticketing, chattier ' +
        'members, 3-6 minute chats and a 2-minute threshold',
      inputs: {
        C4: t(0, 0, 35), C10: 3, E10: t(0, 2), F4: 0.1, F5: 0.3, F6: 0.35, F7: 0.25, G4: 1.5, G5: 1.9, G6: 2.4, G7: 2.9,
        H4: 0.6, H5: 0.8, H6: 1, H7: 1.2, I4: 0.6, I5: 0.5, I6: 0.4, I7: 0.3, L4: 1, M4: 3, N4: 6,
      },
    },
    {
      name: 'one counter, and every party chats for 6-18 seconds when the officer is free',
      inputs: { C10: 1, I4: 1, I5: 1, I6: 1, I7: 1, M4: 0.1, N4: 0.3 },
    },
  ],
  skills: [
    'CRF table + LOOKUP', 'exponential inter-arrival times', 'NORMINV with a MAX floor', 'COUNTIF + LARGE c-counter start',
    'side process with IF/AND', 'visitor-weighted SUMPRODUCT measures', 'two-way Data Table replications', 'pooled vs dedicated lines',
  ],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'Exponential inter-arrival times (-mean*LN(RAND()))',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Normal random variable (NORMINV) with a floor via MAX',
    'Multi-server queue (COUNTIF system length + LARGE c-th end time)',
    'IF with AND/OR multi-condition rules',
    'Bernoulli event (RAND() < p)',
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'Queue performance measures (weighted wait, % within threshold, utilisation)',
    'SUMPRODUCT totals and weighted/expected values',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Data Table for Monte Carlo replications (blank input cell)',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
  ],
}
