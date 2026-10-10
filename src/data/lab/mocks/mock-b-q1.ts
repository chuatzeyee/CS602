import type { CellSpec, CellValue, Exercise, Task, TestCase } from '../../../lab/types'

// Mock B, question 1 (12 marks): FocusPod study pods. Original practice material modelled on a past paper's technique
// mix (site_build/exam/analysis.json, mock_blueprints[1].questions[0]); expected values from _generator/m2q1_calc.py.
// Session lengths keep away from the band edges (1, 3, 6 h) and from whole multiples of 3 h, so F13*24 never lands on
// 2.9999999 inside MATCH or ROUNDUP. One test-case session runs 9:00:00-12:00:00: both times are exact binary fractions of a
// day, so its 3 h is exact and the case catches INT(...)+1 pass counts and > instead of >= at a band start without float noise.
// Table 4 hours are typed numbers, so a test case may put a row exactly on 6 h.

// a clock time or a duration as Excel stores it: a fraction of a day
const t = (h: number, m = 0, s = 0): number => (h * 3600 + m * 60 + s) / 86400

const CLOCK = 'hh:mm:ss'
const DUR = 'h:mm:ss'
const MONEY = '$#,##0.00'
const MONEY3 = '$#,##0.000'
const PCT = '0%'
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const title = (v: string): CellSpec => ({ v, role: 'label', bold: true })
const label = (v: string): CellSpec => ({ v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'input', fmt } : { v, role: 'input' })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const givenF = (f: string, fmt: string): CellSpec => ({ f, role: 'given', fmt })
const answer = (fmt?: string): CellSpec => (fmt ? { role: 'answer', fmt } : { role: 'answer' })

const shift = (col: string, n: number): string => COLS[COLS.indexOf(col) + n]
// specs across a row from (col, r), or down a column from (col, r0)
function across(col: string, r: number, specs: readonly CellSpec[]): Record<string, CellSpec> {
  return Object.fromEntries(specs.map((s, i) => [`${shift(col, i)}${r}`, s]))
}
function down(col: string, r0: number, specs: readonly CellSpec[]): Record<string, CellSpec> {
  return Object.fromEntries(specs.map((s, i) => [`${col}${r0 + i}`, s]))
}
// the same spec in every listed column x row
function grid(cols: readonly string[], rows: readonly number[], spec: CellSpec): Record<string, CellSpec> {
  return Object.fromEntries(rows.flatMap((r) => cols.map((c) => [`${c}${r}`, spec])))
}
// reference entries from a row template per column, for every listed row (what filling down produces)
function perRow(rows: readonly number[], cols: Record<string, (r: number) => string>): Record<string, string> {
  return Object.fromEntries(rows.flatMap((r) => Object.entries(cols).map(([c, f]) => [`${c}${r}`, f(r)])))
}
// test-case inputs down a column
function inputsDown(col: string, r0: number, values: readonly CellValue[]): Record<string, CellValue> {
  return Object.fromEntries(values.map((v, i) => [`${col}${r0 + i}`, v]))
}

const SESSIONS = [13, 14, 15, 16, 17]   // Table 2: customers 101-105
const GUEST_ROWS = [13, 14, 15, 16]     // Table 4
const MEMBER_ROWS = [18, 19, 20, 21]
const T4_ROWS = [...GUEST_ROWS, ...MEMBER_ROWS]

const CUSTOMERS: readonly (readonly [number, string, number, number])[] = [
  [101, 'Member', t(9, 15), t(13, 5)],
  [102, 'Guest', t(10, 40), t(11, 25)],
  [103, 'Guest', t(13, 10), t(15, 55)],
  [104, 'Member', t(8, 30), t(15, 15)],
  [105, 'Guest', t(12), t(14, 59)],
]
// Table 4: [share of the group's sessions, average hours]
const GUEST_MIX = [[0.15, 0.75], [0.4, 2.5], [0.3, 4], [0.15, 7]]
const MEMBER_MIX = [[0.2, 0.5], [0.3, 2], [0.35, 5], [0.15, 8]]

const cells: Record<string, CellSpec> = {
  // Table 1 (B2:E9): rate bands by group, the new common rate card (Solver's variables) and the Block Pass
  B2: title('Table 1: Hourly Rates'),
  ...across('B', 3, ['# of Hours', 'Guest', 'Member', 'New Rate for All'].map(header)),
  ...down('B', 4, [0, 1, 3, 6].map((v) => given(v, '0'))),
  ...down('C', 4, [12, 10, 8, 7].map((v) => input(v, MONEY))),
  ...down('D', 4, [10, 8.5, 6.5, 6].map((v) => input(v, MONEY))),
  ...grid(['E'], [4, 5, 6, 7], answer(MONEY)),
  B8: label('Block Pass (per 3 hours)'),
  ...across('C', 8, [18, 18, 18].map((v) => input(v, MONEY))),
  B9: label('3-hour charge at hourly rate'),
  ...across('C', 9, [givenF('=C6*3', MONEY), givenF('=D6*3', MONEY), givenF('=E6*3', MONEY)]),

  // Table 3 (G3:J9): lucky-draw credits against a cash prize
  G2: title('Table 3: Lucky-draw credits'),
  G3: header('Month'), H3: header('Credit ($)'), J3: header('Yearly Interest Rate'),
  ...down('G', 4, [0, 1, 2, 3, 4, 5].map((v) => given(v, '0'))),
  ...down('H', 4, [200, 220, 240, 260, 280, 320].map((v) => input(v, MONEY))),
  J4: input(0.06, PCT),
  J6: header('Cash Prize Now ($)'), J7: input(1450, MONEY),
  J8: header('PV of Credits ($)'), J9: answer(MONEY),
  I10: { v: 'Better option:', role: 'label', align: 'right' }, J10: answer(),

  // Table 2 (B12:K19): sessions; row 19 is the Goal Seek test row
  B11: title('Table 2: Sessions'),
  ...across('B', 12, [
    'Customer No.', 'Customer Group', 'Start Time', 'End Time', 'Duration', 'Hourly Rate', 'Charge (Hourly)',
    '# Passes Needed', 'Charge (Passes)', 'Preferred Charge',
  ].map(header)),
  ...down('B', 13, CUSTOMERS.map(([no]) => given(no, '0'))),
  ...down('C', 13, CUSTOMERS.map(([, group]) => input(group))),
  ...down('D', 13, CUSTOMERS.map(([, , start]) => input(start, CLOCK))),
  ...down('E', 13, CUSTOMERS.map(([, , , end]) => input(end, CLOCK))),
  ...grid(['F'], [...SESSIONS, 19], answer(DUR)),
  ...grid(['G', 'H', 'J', 'K'], [...SESSIONS, 19], answer(MONEY)),
  ...grid(['I'], [...SESSIONS, 19], answer('0')),
  B19: given(106, '0'), C19: given('Member'), D19: given(t(13, 47, 30), CLOCK),
  E19: { v: t(18), role: 'answer', fmt: CLOCK, note: 'End-time guess for Goal Seek: a typed value, not a formula.' },

  // Table 4 (M12:O21) with the working columns P:X, totals in rows 17, 22 and 23, and the Member reduction target
  M11: title('Table 4: Session-length distribution'),
  ...across('M', 12, [
    'Group', 'Share of Sessions', 'Avg Duration (hours)', 'Hourly Rate', 'Charge (Hourly)', 'Revised Rate',
    'Revised Charge', '# Passes', 'Charge (Passes)', 'Revised Charge (Passes)', 'Preferred Charge (Now)',
    'Preferred Charge (Revised)',
  ].map(header)),
  M13: label('Guest (35%)'), M18: label('Member (65%)'),
  ...down('N', 13, GUEST_MIX.map(([share]) => input(share, PCT))),
  ...down('O', 13, GUEST_MIX.map(([, hours]) => input(hours, '0.00'))),
  ...down('N', 18, MEMBER_MIX.map(([share]) => input(share, PCT))),
  ...down('O', 18, MEMBER_MIX.map(([, hours]) => input(hours, '0.00'))),
  ...grid(['P', 'Q', 'R', 'S', 'U', 'V', 'W', 'X'], T4_ROWS, answer(MONEY)),
  ...grid(['T'], T4_ROWS, answer('0')),
  V17: label('Total for Guests:'), V22: label('Total for Members:'), V23: label('Total for All:'),
  ...grid(['W', 'X'], [17, 22, 23], answer(MONEY)),
  W22: answer(MONEY3),  // $24.675 needs the third decimal
  Y21: header('Reduction'), Z21: header('Target'),
  Y22: answer('0.0%'), Z22: input(0.1, PCT),
}

const colWidths: Record<string, number> = {
  A: 24, B: 212, C: 115, D: 90, E: 120, F: 80, G: 90, H: 118, I: 125, J: 140, K: 120, L: 24, M: 110,
  N: 132, O: 154, P: 95, Q: 118, R: 100, S: 115, T: 75, U: 118, V: 176, W: 168, X: 175, Y: 90, Z: 70,
}

// ---------- reference formulas (row 13 / 18 templates, filled down) ----------

const SESSION_ROW: Record<string, (r: number) => string> = {
  F: (r) => `=E${r}-D${r}`,
  G: (r) => `=INDEX($C$4:$D$7,MATCH(F${r}*24,$B$4:$B$7,1),MATCH(C${r},$C$3:$D$3,0))`,
  H: (r) => `=G${r}*F${r}*24`,
  I: (r) => `=ROUNDUP(F${r}*24/3,0)`,
  J: (r) => `=I${r}*INDEX($C$8:$D$8,1,MATCH(C${r},$C$3:$D$3,0))`,
  K: (r) => `=MIN(H${r},J${r})`,
}
// Table 4 at today's prices: Guest rows read column C, Member rows column D
const nowRow = (rates: string, pass: string): Record<string, (r: number) => string> => ({
  P: (r) => `=LOOKUP(O${r},$B$4:$B$7,${rates})`,
  Q: (r) => `=O${r}*P${r}`,
  T: (r) => `=ROUNDUP(O${r}/3,0)`,
  U: (r) => `=T${r}*${pass}`,
  W: (r) => `=MIN(Q${r},U${r})`,
})
// Table 4 on the common rate card E4:E7 and pass price E8
const REVISED_ROW: Record<string, (r: number) => string> = {
  R: (r) => `=LOOKUP(O${r},$B$4:$B$7,$E$4:$E$7)`,
  S: (r) => `=O${r}*R${r}`,
  V: (r) => `=T${r}*$E$8`,
  X: (r) => `=MIN(S${r},V${r})`,
}

// ---------- tasks ----------

// (a) one task per column, weighted like a past-paper marking sheet (0.25 + 1 + 0.25 + 0.5 + 0.75 + 0.25 = 3). Each column is
// checked against the model answer in the other columns, so a wrong G13 costs G's mark only, as when a marker reads row 13.
type ColumnParts = Pick<Task, 'prompt' | 'wrong' | 'hints' | 'explain' | 'check'>
const sessionColumn = (col: string, marks: number, parts: ColumnParts): Task => ({
  id: `sessions-${col.toLowerCase()}`,
  kind: 'formula',
  cells: `${col}13:${col}17`,
  marks,
  solution: SESSION_ROW[col](13),
  check: { tol: 0.005 },
  ...parts,
})

const sessionTasks: Task[] = [
  sessionColumn('F', 0.25, {
    prompt:
      '(a) Complete F13:K13 and fill the six formulas down to row 17; each column is marked on its own. ' +
      'F13: the session duration from the start and end times, kept as a time (h:mm:ss).',
    check: { tol: 1e-6 },
    wrong: ['=D13-E13', '=(E13-D13)*24', '=HOUR(E13-D13)'],
    hints: ['End time minus start time gives the duration as a fraction of a day; the h:mm:ss format already on F shows it as a time.'],
    explain:
      '=E13-D13 gives 3:50:00, 0:45:00, 2:45:00, 6:45:00 and 2:59:00. Keep F as a time: G, H and I multiply it by 24 where they need hours, ' +
      'and a marker reads F13 as a duration.',
  }),
  sessionColumn('G', 1, {
    prompt:
      '(a) G13: the hourly rate for the customer\'s group (C13) and duration band (Table 1: each band starts at the hours in B4:B7), ' +
      'as one formula that fills down to G17.',
    // exact match; hours without x24; the Guest column for everyone
    wrong: [
      '=VLOOKUP(F13*24,$B$4:$D$7,MATCH(C13,$B$3:$D$3,0),FALSE)',
      '=VLOOKUP(F13,$B$4:$D$7,MATCH(C13,$B$3:$D$3,0),TRUE)',
      '=VLOOKUP(F13*24,$B$4:$D$7,2,TRUE)',
    ],
    hints: [
      'Two lookups meet in C4:D7: the band row from the hours (F13*24) and the group column from C13.',
      '`MATCH(F13*24,$B$4:$B$7,1)` finds the band row, `MATCH(C13,$C$3:$D$3,0)` the group column, and `INDEX($C$4:$D$7,...)` reads the rate where they cross.',
    ],
    explain:
      'Rates: 101 $6.50, 102 $12.00, 103 $10.00, 104 $6.00, 105 $10.00. MATCH type 1 takes the largest band start that is <= the hours ' +
      '(match type 0 gives #N/A, and F13 without x24 always lands in the first band); the group MATCH picks the column, so one formula ' +
      'fills down. =INDEX($B$4:$D$7,...,MATCH(C13,$B$3:$D$3,0)), VLOOKUP(...,TRUE) with the group\'s column or LOOKUP/XLOOKUP on the ' +
      'group\'s column also earn the mark. At an exact band start (3:00:00) F13*24 can come out as 2.9999999: ROUND(F13*24,6) inside MATCH guards against that.',
  }),
  sessionColumn('H', 0.25, {
    prompt: '(a) H13: the hourly charge, prorated by the minute (no rounding up to whole hours); fill down to H17.',
    wrong: ['=G13*F13', '=G13*ROUNDUP(F13*24,0)', '=G13*HOUR(F13)'],
    hints: ['Rate x hours, and the hours are F13*24.'],
    explain:
      '=G13*F13*24: 101 pays 6.50 x 3.8333 = $24.92 by the hour, 103 $27.50, 105 $29.83. Rounding the hours up, or keeping only HOUR(F13), ' +
      'breaks the "prorated by the minute" rule.',
  }),
  sessionColumn('I', 0.5, {
    prompt: '(a) I13: the number of 3-hour Block Passes needed to cover the whole session (3 h 10 min needs 2); fill down to I17.',
    wrong: ['=ROUND(F13*24/3,0)', '=INT(F13*24/3)+1', '=ROUNDUP(F13/3,0)'],
    hints: ['Hours divided by 3 hours per pass, always rounded up: `ROUNDUP(F13*24/3,0)`.'],
    explain:
      'Passes: 2, 1, 1, 3, 1. ROUNDUP covers a part block with a whole pass; ROUND drops 101\'s second pass, and INT(...)+1 buys a pass ' +
      'too many for a session of exactly 3 hours. CEILING(F13*24/3,1) gives the same counts.',
  }),
  sessionColumn('J', 0.75, {
    prompt:
      '(a) J13: the pass charge, the passes x the Block Pass price of the customer\'s group (row 8: C8 for Guests, D8 for Members); ' +
      'fill down to J17.',
    wrong: ['=I13*18', '=I13*C8', '=IF(C13="Guest",$C$8,$D$8)'],
    hints: [
      'The price depends on the group, just like the rate in G: look it up in C8:D8 with the same group MATCH.',
      '`INDEX` on $C$8:$D$8 with row 1 and the group column `MATCH(C13,$C$3:$D$3,0)` returns the group\'s pass price; multiply it by I13.',
    ],
    explain:
      'I13 times the group\'s price from C8:D8 (INDEX with the group MATCH, or =I13*IF(C13="Guest",$C$8,$D$8)) gives $36, $18, $18, $54 and $18. ' +
      'Today both prices are $18, but a formula that always reads C8 (or types 18) breaks as soon as the groups pay different prices.',
  }),
  sessionColumn('K', 0.25, {
    prompt: '(a) K13: the preferred (cheaper) charge; fill down and report the preferred charge for customers 101-105 in K13:K17.',
    wrong: ['=MAX(H13,J13)', '=H13', '=J13'],
    hints: ['The customer pays whichever of H13 and J13 is lower.'],
    explain:
      '=MIN(H13,J13): $24.92, $9.00, $18.00, $40.50, $18.00. 101 and 104 pay by the hour (two passes cost $36, three $54); 103 and 105 ' +
      '(Guests just under 3 hours) buy one $18 pass instead of paying $27.50 and $29.83.',
  }),
]

const goalSeek: Task = {
  id: 'budget',
  kind: 'tool',
  tool: 'goalseek',
  cells: 'E19',
  marks: 1.5,
  prompt:
    '(b) Row 19 is a test row for a Member who starts at 13:47:30 with only $32 to spend. E19 holds an end-time guess typed as a value (18:00:00). ' +
    'Copy the row-13 formulas into F19:K19, then use Goal Seek to find the latest end time at which the preferred charge K19 is exactly $32. Give the end time in E19 as hh:mm:ss.',
  solutions: perRow([19], SESSION_ROW),
  toolSetup: { setCell: 'K19', toValue: 32, changingCell: 'E19' },
  answer: { E19: t(13, 47, 30) + 32 / 6.5 / 24 },
  check: { tol: 1 / 86400 },
  wrong: ['18:00:00', '4:55:23', '17:47:30'],
  hints: [
    'Copy F13:K13 and paste into F19:K19: the relative references move to row 19.',
    'What-If Analysis > Goal Seek: Set cell K19, To value 32, By changing cell E19 (a typed value, not a formula).',
    'Keep the guess inside the 3-6 hour band, as 18:00:00 is: there a Member pays MIN(6.50 x hours, 2 passes = $36).',
  ],
  explain:
    '6.50 x hours = 32 gives 4.9231 hours = 4:55:23, so the latest end is 13:47:30 + 4:55:23 = 18:42:53. Under 3 hours a Member pays at most $18, from 5:32:18 ' +
    'the two passes cap the charge at $36, and from 6 hours it is at least $36, so $32 is reached only once. Report the end time, not the duration. ' +
    'Goal Seek: Set cell K19, To value 32, By changing cell E19.',
}

const presentValue: Task = {
  id: 'credits',
  kind: 'formula',
  cells: 'J9',
  marks: 0.75,
  prompt:
    '(c) A member wins a lucky draw: either $1,450 cash today (J7) or the credits in Table 3 (Month 0 = today, Months 1-5 paid at month end). ' +
    'With 6% yearly interest compounded monthly (J4), compute the present value of the credits in J9.',
  solution: '=NPV(J4/12,H5:H9)+H4',
  check: { tol: 0.01 },
  wrong: ['=NPV(J4,H5:H9)+H4', '=NPV(J4/12,H4:H9)', '=NPV(J4/12,H5:H9)', '=SUM(H4:H9)'],
  hints: [
    'Interest compounds monthly, so the rate per period is J4/12.',
    '`NPV` discounts its first value by one period: give it Months 1-5 (H5:H9) and add the Month 0 credit H4 outside.',
  ],
  explain:
    '=NPV(J4/12,H5:H9)+H4 = $1,499.25. Month 0 is already in today\'s dollars, so it stays outside NPV, which discounts H5 by one month. ' +
    'Using J4 instead of J4/12, or putting H4 inside NPV (it would be discounted a month), are the classic slips.',
}

const decision: Task = {
  id: 'choice',
  kind: 'value',
  cells: 'J10',
  marks: 0.25,
  prompt: '(c) Which option is worth more today? Type Credits or Cash in J10.',
  answer: 'Credits',
  wrong: ['Cash'],
  hints: ['Compare the present value in J9 with the cash prize in J7.'],
  explain: 'The credits are worth $1,499.25 today against $1,450 in cash, so take the credits (about $49 more).',
}

const expectedRevenue: Task = {
  id: 'expected',
  kind: 'formula',
  cells: 'P13:Q16,P18:Q21,T13:U16,T18:U21,W13:W16,W18:W21,W17,W22,W23',
  marks: 1.5,
  prompt:
    '(d) Table 4 (M12:O21) gives the session-length distribution for each group; 35% of sessions are Guests and 65% Members. ' +
    'For each row (Guests 13-16, Members 18-21) compute the hourly rate at today\'s rates for the group (P), hourly charge (Q), passes (T), ' +
    'pass charge at the group\'s pass price (U: C8 for Guests, D8 for Members) and preferred charge (W), with formulas that fill down; ' +
    'then the expected revenue per session for Guests (W17), Members (W22) and overall (W23).',
  solutions: {
    ...perRow(GUEST_ROWS, nowRow('$C$4:$C$7', '$C$8')),
    ...perRow(MEMBER_ROWS, nowRow('$D$4:$D$7', '$D$8')),
    W17: '=SUMPRODUCT(N13:N16,W13:W16)',
    W22: '=SUMPRODUCT(N18:N21,W18:W21)',
    W23: '=0.35*W17+0.65*W22',
  },
  check: { tol: 0.005 },
  wrong: ['=LOOKUP(O13,$B$4:$B$7,$D$4:$D$7)', '=VLOOKUP(O13,$B$4:$C$7,2,FALSE)', '=O13*LOOKUP(O13,$B$4:$B$7,$C$4:$C$7)'],
  hints: [
    'Each row uses its own group\'s rates: Guest rows `LOOKUP(O13,$B$4:$B$7,$C$4:$C$7)`, Member rows the same on $D$4:$D$7. Anchor both ranges.',
    'Q = hours x rate; T = `ROUNDUP(O13/3,0)`; U = passes x $C$8 (Guests) or $D$8 (Members); W = `MIN` of the two charges.',
    'Expected revenue per session = `SUMPRODUCT` of the shares and the preferred charges; overall = 0.35 x Guests + 0.65 x Members.',
  ],
  explain:
    'Guest rows pay $9.00, $18.00 (one pass beats $25.00), $32.00 and $49.00: W17 = 0.15 x 9 + 0.40 x 18 + 0.30 x 32 + 0.15 x 49 = $25.50. ' +
    'Member rows all pay by the hour ($5.00, $17.00, $32.50, $48.00): W22 = $24.675. Overall W23 = 0.35 x 25.50 + 0.65 x 24.675 = $24.96 per session. ' +
    'The exam marks W17, W22 and W23 (formula and value), so every row feeding them must be right. Unanchored lookup ranges happen to work ' +
    'on today\'s rows (each row is one band longer than the row above, so the sliding range keeps up) and break on other session lengths; ' +
    'both pass prices are $18 today, but the Member rows should still read D8.',
}

const revisedModel: Task = {
  id: 'revised',
  kind: 'formula',
  cells: 'R13:S16,R18:S21,V13:V16,V18:V21,X13:X16,X18:X21,X17,X22,X23,Y22',
  marks: 2,
  prompt:
    '(e) FocusPod wants one rate table for everyone (E4:E7) and keeps passes at $18 (E8). Complete the revised columns in rows 13-16 and 18-21: ' +
    'R13 = LOOKUP(O13,$B$4:$B$7,$E$4:$E$7), S = O x R, V = T x $E$8, X = MIN(S,V); then X17 and X22 (as W17 and W22), ' +
    'X23 = 0.35*X17+0.65*X22, and the Member reduction Y22 = (W22-X22)/W22.',
  solutions: {
    ...perRow(T4_ROWS, REVISED_ROW),
    X17: '=SUMPRODUCT(N13:N16,X13:X16)',
    X22: '=SUMPRODUCT(N18:N21,X18:X21)',
    X23: '=0.35*X17+0.65*X22',
    Y22: '=(W22-X22)/W22',
  },
  check: { tol: 0.001 },
  wrong: ['=LOOKUP(O13,$B$4:$B$7,$D$4:$D$7)', '=P13', '=INDEX($E$4:$E$7,MATCH(O13,$B$4:$B$7,0))'],
  hints: [
    'R reads the new rates E4:E7 for both groups; anchor the tables so one formula fills down.',
    'V uses the pass price for the new card ($E$8); X17 and X22 are the W17 and W22 formulas one column to the right.',
  ],
  explain:
    'These cells only follow E4:E7: at the Solver answer Guests spend $21.11 and Members $22.21 per session (X17, X22), so Y22 = 10.0% and X23 = $21.82. ' +
    'Y22 compares the Member total under the new card with today\'s W22, which is what the Solver equality Y22 = Z22 pins down.',
}

const OPT_E7 = 6 - (0.1 * 24.675 - 0.6 * 1.3 - 1.75 * 0.5) / 1.2

const rateCard: Task = {
  id: 'solver',
  kind: 'tool',
  tool: 'solver',
  cells: 'E4:E7',
  marks: 3,
  prompt:
    '(e) Members should see their expected spend per session fall by exactly 10% (Z22 = 10%), measured by Y22. Starting from E4:E7 = current Member rates ' +
    '(type 10, 8.5, 6.5 and 6), use Solver to maximise X23 by changing E4:E7 subject to: new rates not above current Member rates (E4:E7 <= D4:D7); ' +
    'rates non-increasing as duration rises (E4:E6 >= E5:E7); 3 x E6 (E9) at least the pass price (E9 >= E8); and Y22 = Z22. ' +
    'Use GRG Nonlinear (MIN and LOOKUP make the model non-smooth). Report E4:E7 and X23.',
  solutions: { E4: '10', E5: '8.5', E6: '6.5', E7: '6' },
  toolSetup: {
    objective: 'X23',
    sense: 'max',
    changing: 'E4:E7',
    constraints: [
      { lhs: 'E4:E7', relation: '<=', rhs: 'D4:D7' },
      { lhs: 'E4:E6', relation: '>=', rhs: 'E5:E7' },
      { lhs: 'E9', relation: '>=', rhs: 'E8' },
      { lhs: 'Y22', relation: '=', rhs: 'Z22' },
    ],
    nonNegative: true,
    engine: 'grg',
  },
  answer: { E4: 10, E5: 7.2, E6: 6, E7: OPT_E7, X23: 0.35 * (15.525 + 1.05 * OPT_E7) + 0.65 * 0.9 * 24.675 },
  check: { tol: 0.01 },
  wrong: ['8.5', '24'],  // E4 after Min instead of Max; after dropping E4:E7 <= D4:D7
  hints: [
    'Set Objective X23, Max, By Changing Variable Cells E4:E7; add the four constraints as written, with cells on the right ' +
      '(E4:E7 <= D4:D7, not the typed rates), so the model still follows Table 1 when a rate changes.',
    'Variable cells need values, not formulas: type 10, 8.5, 6.5 and 6 into E4:E7 before you run Solver.',
    'GRG stops at local optima on MIN models: if the result looks odd, run Solver again from its own answer.',
  ],
  explain:
    'Solver: Max X23 by changing E4:E7 with E4:E7 <= D4:D7, E4:E6 >= E5:E7, E9 >= E8, Y22 = Z22 (GRG Nonlinear). Answer: E4:E7 = $10.00, $7.20, $6.00, $5.32 and X23 = $21.82. ' +
    'Within the bounds every Member charge stays on the hourly side, so X22 is linear in the rates and the 10% equality fixes it at 0.9 x 24.675 = 22.2075. ' +
    'Maximising X23 then takes the Member cut where it costs Guests least. Per $1 cut from X22, Guests (X17) lose $0 while E5 falls from 8.50 to 7.20 ' +
    '(2.5-hour Guests already pay the $18 pass), $0.69 through E6, $0.88 through E7 and $1.13 through E4: so E5 = 7.20, E6 drops to its floor ' +
    'of 6.00 (3 x E6 >= $18), the rest comes from E7 = 5.32 and E4 stays at 10.00. In the exam the Solver settings (objective and Max, the ' +
    'variable cells, every constraint) carry marks as well as the optimal values, so write them down.',
}

// ---------- test cases (inputs only; every formula task is re-checked under each) ----------

const testCases: TestCase[] = [
  { name: 'hourly rates rise by $1 for both groups', inputs: { ...inputsDown('C', 4, [13, 11, 9, 8]), ...inputsDown('D', 4, [11, 9.5, 7.5, 7]) } },
  { name: 'Block Passes cost $20 for Guests and $15 for Members', inputs: { C8: 20, D8: 15 } },
  {
    // customer 103 plays exactly 3:00:00 (9:00 to 12:00, exact in binary): the band start and the pass count are tested
    name: 'a different day of sessions',
    inputs: {
      ...inputsDown('D', 13, [t(8, 5), t(14, 20), t(9), t(10, 10), t(16, 30)]),
      ...inputsDown('E', 13, [t(9, 35), t(21, 5), t(12), t(10, 50), t(21, 55)]),
    },
  },
  { name: 'customers 102 and 105 are Members', inputs: { C14: 'Member', C17: 'Member' } },
  { name: 'credits of $250 today and 12% interest a year', inputs: { H4: 250, J4: 0.12 } },
  { name: 'longer Guest sessions and a new Member mix', inputs: { ...inputsDown('O', 13, [1.25, 2.75, 4.25, 6.5]), ...inputsDown('N', 18, [0.25, 0.25, 0.3, 0.2]) } },
  {
    // rows in lower bands than their position (unanchored lookups slide off the band), a 6-hour Guest row (6/3 passes exactly),
    // and cheaper new passes that put revised charges of both groups on the pass side (X must be the MIN, not the hourly charge)
    name: 'shorter sessions in Table 4 (one Guest session of 6 hours) and new passes at $14 (E8)',
    inputs: { ...inputsDown('O', 13, [0.5, 0.9, 2.25, 6]), ...inputsDown('O', 18, [0.25, 0.75, 2.25, 5]), E8: 14 },
  },
]

export const exercise: Exercise = {
  id: 'mock-b-q1',
  week: 'EXAM',
  topic: 'Time pricing, NPV and Solver',
  title: 'FocusPod study pods: tiered prorated pricing, Goal Seek, NPV and a common rate card',
  level: 3,
  minutes: 60,
  scenario:
    'FocusPod rents sound-proof study pods. The hourly rate depends on the customer group (Guest or Member) and falls as sessions get longer (Table 1): ' +
    'the rate of the band that the total duration falls into applies to the whole session, prorated by the minute (no rounding up to whole hours). ' +
    'Alternatively customers buy $18 Block Passes, each covering 3 hours; passes must cover the whole session (3 h 10 min needs 2 passes). ' +
    'Customers always pay the cheaper of the hourly charge and the pass charge. Build every answer at the cell addresses given, as in the exam.',
  sheet: { rows: 24, cols: 26, cells, colWidths },
  tasks: [...sessionTasks, goalSeek, presentValue, decision, expectedRevenue, revisedModel, rateCard],
  testCases,
  skills: [
    'durations from clock times (x24)', 'two-way INDEX/MATCH on a band table', 'ROUNDUP pass counts and MIN for the cheaper charge',
    'Goal Seek on an end time', 'NPV with a Month 0 cash flow', 'expected revenue with SUMPRODUCT', 'GRG Solver with an equality target',
  ],
  techniques: [
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Two-way INDEX/MATCH lookup',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'ROUNDUP block counts and MIN for the cheaper option',
    'Absolute/mixed references so formulas fill down/right',
    'Goal Seek',
    'Time value of money (NPV vs lump sum)',
    'Written interpretation of model results',
    'SUMPRODUCT totals and weighted/expected values',
    'Solver optimisation (objective, changing cells, constraints)',
  ],
}
