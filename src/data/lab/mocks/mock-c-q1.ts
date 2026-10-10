import type { CellSpec, CellValue, Exercise } from '../../../lab/types'

// Mock C, Q1 (12 marks): library collection placement across three storage tiers. A time-step table, mm-to-metre
// costing with SUMPRODUCT and mixed references, a Solver LP allocation and a capacity-constrained re-solve.
// Original scenario and numbers: site_build/exam/analysis.json mock_blueprints[2].questions[0], expected values from
// _generator/m3q1_calc.py (both optima also pass a reduced-cost check: each group sits in its cheapest tier once the
// shadow prices of the full tiers, S$0.001899 open and S$0.001019 compact per title, are added).
// Parts 1-4 have one formula task per fill range (marks add up to the part's), so the checker's isolation carries an
// error forward like a marker would: a wrong I or K column no longer zeroes correct J, K and L formulas, and C9 errors no
// longer fail E4. Part 5 is a Solver task plus a self-marked statement of the Solver settings (the paper marks the
// settings, the allocation and H10); part 6 is a Solver task plus a short written interpretation (the blueprint tags it
// "Written interpretation"). Lab adaptation: the paper re-solves Table 3B for part 6 and pastes row 10
// into row 11 as values; here part 6 re-solves Table 3C (T17:Y25), a copy of Table 3B, so both Solver answers stay on
// one sheet. The Solver tasks mark only the cells the allocation drives (F10:H10; U4:U5 and F11:H11), not the shares:
// the optimal shares mostly equal the proposed start values (14 of 16 in 3B), so marking shares or the offsite column
// paid 2 of the 4.5 Solver marks to a learner who never ran Solver. Both optima are unique (checked with an LP
// solver), so any other allocation moves the cost cells. The share test case uses group 4-8 rows, whose shares start
// at 0: a changed input whose start value is 1 makes the checker blame a "1 typed in" for every wrong I18 formula.

type Cells = Record<string, CellSpec>

const CLOCK = 'hh:mm:ss'
const MONEY = '$#,##0.00'
const PCT = '0%'
const SHARE = '0.00%'
const FIRST = 18
const LAST = 25

const label = (v: string, bold = false): CellSpec => (bold ? { v, role: 'label', bold } : { v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt: string): CellSpec => ({ v, role: 'input', fmt })
const given = (v: CellValue): CellSpec => ({ v, role: 'given' })
const answer = (fmt: string, v?: CellValue): CellSpec => (v === undefined ? { role: 'answer', fmt } : { role: 'answer', fmt, v })

// one entry per row of a column, e.g. column('I', 18, 25, (r) => `=1-G${r}-H${r}`)
function column<T>(col: string, first: number, last: number, make: (row: number, i: number) => T): Record<string, T> {
  const out: Record<string, T> = {}
  for (let row = first; row <= last; row++) out[`${col}${row}`] = make(row, row - first)
  return out
}
const groupRows = <T>(col: string, make: (row: number, i: number) => T): Record<string, T> => column(col, FIRST, LAST, make)
const shift = (col: string, by: number): string => String.fromCharCode(col.charCodeAt(0) + by)

// Table 3: group, years since publication, share of titles requested per day, requests per requested title, titles
const GROUPS: readonly (readonly [number, string, number, number, number])[] = [
  [1, '< 1 year', 0.09, 3.0, 12000],
  [2, '1 - 2 years', 0.04, 2.2, 18000],
  [3, '3 - 5 years', 0.015, 1.8, 35000],
  [4, '6 - 10 years', 0.006, 1.5, 60000],
  [5, '11 - 20 years', 0.0025, 1.3, 90000],
  [6, '21 - 30 years', 0.001, 1.2, 110000],
  [7, '31 - 50 years', 0.0004, 1.1, 150000],
  [8, '> 50 years', 0.00015, 1.0, 240000],
]

// Table 3A proposed (open, compact) shares; also the start values of the Solver tables 3B and 3C
const PROPOSED: readonly (readonly [number, number])[] = [[1, 0], [1, 0], [0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]

// a policy table whose share columns start at `open` (G = Table 3A, M = 3B, T = 3C): offsite = remainder, daily storage
// cost, blended abandonment rate and abandoned requests per day, as the blueprint's row-18 formulas filled down
function policyFormulas(open: string): Record<string, string> {
  const [compact, offsite, cost, rate, lost] = [1, 2, 3, 4, 5].map((k) => shift(open, k))
  return {
    ...groupRows(offsite, (r) => `=1-${open}${r}-${compact}${r}`),
    ...groupRows(cost, (r) => `=$F${r}*$G$3/1000*SUMPRODUCT($C$3:$E$3,${open}${r}:${offsite}${r})`),
    ...groupRows(rate, (r) => `=SUMPRODUCT(${open}${r}:${offsite}${r},$C$4:$E$4)`),
    ...groupRows(lost, (r) => `=$D${r}*$E${r}*$F${r}*${rate}${r}`),
  }
}

const POLICY_HEADERS = ['Open', 'Compact', 'Offsite', 'Daily Storage Cost', 'Abandonment Rate', 'Abandoned Requests per Day']

// header row 17 and answer cells of a policy table; the Solver tables (3B, 3C) start from the proposed shares
function policyCells(open: string, solver: boolean, shareFmt: string): Cells {
  const cols = [0, 1, 2, 3, 4, 5].map((k) => shift(open, k))
  const out: Cells = {}
  cols.forEach((c, k) => { out[`${c}17`] = header(POLICY_HEADERS[k]) })
  if (solver) {
    Object.assign(
      out,
      groupRows(cols[0], (_, i) => answer(shareFmt, PROPOSED[i][0])),
      groupRows(cols[1], (_, i) => answer(shareFmt, PROPOSED[i][1])),
    )
  }
  Object.assign(
    out,
    groupRows(cols[2], () => answer(shareFmt)),
    groupRows(cols[3], () => answer(MONEY)),
    groupRows(cols[4], () => answer(SHARE)),
    groupRows(cols[5], () => answer('0.00')),
  )
  return out
}

const CELLS: Cells = {
  // Table 1: tier pricing, with the thickness and abandonment cost constants in G2:H3 (E4 is part 1's answer)
  B1: label('Table 1 - Tier pricing', true),
  B2: header('Storage Tier'), C2: header('Open Shelves'), D2: header('Compact Shelving'), E2: header('Offsite Depository'),
  G2: header('Avg Book Thickness (mm)'), H2: header('Cost per Abandoned Request (S$)'),
  B3: label('Price (S$ per shelf-metre per day)'), C3: input(0.09, '0.000'), D3: input(0.035, '0.000'), E3: input(0.012, '0.000'),
  G3: input(32, '0'), H3: input(1.5, '$0.00'),
  B4: label('Average Abandonment Rate'), C4: input(0, PCT), D4: input(0.02, PCT), E4: answer(PCT),
  // Table 2: offsite retrieval delay vs abandonment rate, first row given
  B6: label('Table 2 - Offsite delay vs abandonment', true),
  B7: header('Retrieval Delay (h:mm)'), C7: header('Abandonment Rate'),
  B8: input(2 / 24, CLOCK), C8: input(0.2, PCT),
  ...column('B', 9, 14, () => answer(CLOCK)),
  ...column('C', 9, 14, () => answer(PCT)),
  // Table 4: policy cost comparison
  E6: label('Table 4 - Policy cost comparison', true),
  F7: header('Daily Storage Cost (S$)'), G7: header('Cost of Abandoned Requests (S$)'), H7: header('Total Policy Cost (S$)'),
  E8: label('Current'), E9: label('Proposed'), E10: label('Optimised'), E11: label('Optimised with space limits'),
  F8: answer(MONEY),
  ...Object.fromEntries(['F', 'G', 'H'].flatMap((c) => [9, 10, 11].map((r) => [`${c}${r}`, answer(MONEY)]))),
  // space limits for part 6
  T1: label('Space limits (Part 6)', true),
  T2: label('Open Shelves Capacity (titles)'), U2: input(25000, '#,##0'),
  T3: label('Compact Shelving Capacity (titles)'), U3: input(170000, '#,##0'),
  T4: label('Open titles used'), U4: answer('#,##0'),
  T5: label('Compact titles used'), U5: answer('#,##0'),
  // Table 3: request activity by age group
  B16: label('Table 3 - Request activity by age group', true),
  B17: header('Age Group'), C17: header('Years Since Publication'), D17: header('% of Titles Requested per Day'),
  E17: header('Requests per Requested Title'), F17: header('Number of Titles'),
  ...groupRows('B', (_, i) => given(GROUPS[i][0])),
  ...groupRows('C', (_, i) => given(GROUPS[i][1])),
  ...groupRows('D', (_, i) => input(GROUPS[i][2], '0.000%')),
  ...groupRows('E', (_, i) => input(GROUPS[i][3], '0.0')),
  ...groupRows('F', (_, i) => input(GROUPS[i][4], '#,##0')),
  // Table 3A: proposed shares (inputs), the rest is part 3
  G16: label('Table 3A - Proposed policy (offsite = remainder)', true),
  ...policyCells('G', false, PCT),
  ...groupRows('G', (_, i) => input(PROPOSED[i][0], PCT)),
  ...groupRows('H', (_, i) => input(PROPOSED[i][1], PCT)),
  // Table 3B: part 5's Solver table; Table 3C: its copy for the part 6 re-solve
  M16: label('Table 3B - Optimised policy (start values = proposed shares)', true),
  ...policyCells('M', true, PCT),
  T16: label('Table 3C - Optimised with space limits (copy of Table 3B for Part 6)', true),
  ...policyCells('T', true, SHARE),
}

// reference entries of the Solver parts (the blueprint's reference formulas; parts 1-4 use one `solution` per fill range)
const TABLE_3B: Record<string, string> = {
  ...policyFormulas('M'),
  F10: '=SUM(P18:P25)', G10: '=SUM(R18:R25)*$H$3', H10: '=SUM(F10:G10)',
}
const TABLE_3C: Record<string, string> = {
  ...policyFormulas('T'),
  U4: '=SUMPRODUCT($F$18:$F$25,T18:T25)', U5: '=SUMPRODUCT($F$18:$F$25,U18:U25)',
  F11: '=SUM(W18:W25)', G11: '=SUM(Y18:Y25)*$H$3', H11: '=SUM(F11:G11)',
}

export const exercise: Exercise = {
  id: 'mock-c-q1',
  week: 'EXAM',
  topic: 'Tier costing and Solver LP',
  title: 'Library collection placement across three storage tiers',
  level: 3,
  minutes: 60,
  scenario:
    'A university library stores 715,000 titles in three tiers (Table 1): open shelves (dearest per shelf-metre, every request served), ' +
    'compact shelving (cheaper, but 2% of requests are abandoned because items are awkward to retrieve) and an offsite depository ' +
    '(cheapest, but retrieval takes 2-5 hours and many requesters give up). Books average 32 mm thick (1,000 mm = 1 m) and each ' +
    'abandoned request costs S$1.50 in lost service value. Table 3 groups the titles by years since publication, with the share of ' +
    'titles requested per day, requests per requested title and the number of titles. Answer in the cells each part names; Table 3C ' +
    '(T17:Y25) is the copy of Table 3B that part 6 re-solves, so both Solver answers stay on this one sheet. Parts 5 and 6 also ' +
    'ask for a short written answer, which you mark against the model answer.',
  sheet: {
    name: 'Q1',
    rows: 26,
    cols: 25,
    cells: CELLS,
    colWidths: {
      A: 24, B: 254, C: 176, D: 218, E: 212, F: 176, G: 234, H: 200, I: 80, J: 140, K: 126, L: 198,
      M: 80, N: 80, O: 80, P: 140, Q: 126, R: 198, S: 24, T: 254, U: 100, V: 80, W: 140, X: 126, Y: 198,
    },
  },
  tasks: [
    {
      id: 'p1-delays',
      kind: 'formula',
      cells: 'B9:B14',
      marks: 0.25,
      prompt:
        '(1) Offsite retrieval takes between 2 and 5 hours (uniform). 20% of requesters abandon at a 2-hour delay and the rate rises ' +
        'steadily with the delay, by 6 percentage points for every extra 30 minutes. Complete Table 2 (B8:C14) in 30-minute steps ' +
        'from 2:00 to 5:00 (row 8 is given). First the delays: write B9 so it fills down to B14.',
      solution: '=B8+TIME(0,30,0)',
      wrong: ['=B8+30', '=B8+0.5', '=B8+TIME(0,0,30)', '=$B$8+TIME(0,30,0)'],
      hints: [
        'Excel stores a time as a fraction of a day, so +30 adds 30 days and +0.5 adds 12 hours.',
        '`TIME`(0,30,0) is half an hour (1/48 of a day): add it to the delay above.',
      ],
      explain:
        'B9 `=B8+TIME(0,30,0)` (or `=B8+1/48`) adds half an hour; filled down, the delays run 02:30:00 ... 05:00:00. A typed 30 or ' +
        '0.5 would add 30 days or 12 hours. Markers read B14 as 05:00:00 (hh:mm:ss), not as the day fraction 0.2083.',
    },
    {
      id: 'p1-rates',
      kind: 'formula',
      cells: 'C9:C14',
      marks: 0.25,
      prompt: '(1) Now the abandonment rates: write C9 so it fills down to C14.',
      solution: '=C8+6%',
      wrong: ['=C8+6', '=C8*1.06', '=$C$8+6%'],
      hints: ['Six percentage points is 6% (0.06), added to the rate above, not 6 and not 6% of the rate.'],
      explain: 'C9 `=C8+6%` filled down gives 26%, 32%, ... 56% at 5:00. `=C8*1.06` grows the rate by 6% of itself instead.',
    },
    {
      id: 'p1-average',
      kind: 'formula',
      cells: 'E4',
      marks: 0.5,
      prompt: '(1) Use Table 2 to set the average abandonment rate for the depository in E4.',
      solution: '=AVERAGE(C8:C14)',
      wrong: ['=AVERAGE(C8:C13)', '=AVERAGE(C9:C14)', '=C14'],
      hints: ['The delay is uniform and the rate rises evenly, so the average rate is the rate at the middle delay: the `AVERAGE` of all seven rates.'],
      explain:
        'E4 `=AVERAGE(C8:C14)` = 38%, the rate at the middle delay of 3:30 (`=(C8+C14)/2` gives the same). Markers give E4 a formula ' +
        'mark and a value mark. AVERAGE(C8:C13) = 35% treats each rate as a flat 30-minute band, which the steady rise rules out.',
    },
    {
      id: 'p2-current-cost',
      kind: 'formula',
      cells: 'F8',
      marks: 1,
      prompt: '(2) Today every title sits on open shelves. Compute the current daily storage cost in F8.',
      solution: '=SUM(F18:F25)*$G$3/1000*C3',
      check: { tol: 0.005 },
      wrong: ['=SUM(F18:F25)*$G$3*C3', '=SUM(F18:F25)*$G$3/100*C3', '=SUM(F18:F25)*$G$3/1000*E3'],
      hints: [
        'Shelf space = titles x thickness. The thickness is in mm but the price is per metre: divide by 1,000.',
        'Total titles (`SUM` of F18:F25) x G3/1000 metres x the open-shelf price in C3.',
      ],
      explain:
        '715,000 titles x 32 mm / 1,000 = 22,880 shelf-metres at S$0.09 a metre a day: S$2,059.20. Open shelves lose no requests ' +
        '(C4 = 0%), so the cost of abandoned requests is 0 and today\'s total policy cost is also S$2,059.20.',
    },
    {
      id: 'p3-offsite',
      kind: 'formula',
      cells: 'I18:I25',
      marks: 0.5,
      prompt:
        '(3) The head librarian proposes Table 3A (shares of each group per tier, G18:H25 given). With formulas that fill down to ' +
        'row 25 compute the offsite share I18 (= remainder), the daily storage cost J18, the blended abandonment rate K18 and the ' +
        'expected abandoned requests per day L18; report J18, J21, K21 and L21 (every cell of I18:L25 is marked). Start with I18:I25.',
      solution: '=1-G18-H18',
      wrong: ['=G18+H18', '=1-H18', '=1-G18', '=1-G18+H18'],
      hints: ['Each group\'s three shares add to 100%: offsite is what open and compact leave.'],
      explain: 'I18 `=1-G18-H18` (or `=1-SUM(G18:H18)`): 0% for groups 1-3, 100% for groups 4-8 under the proposal.',
    },
    {
      id: 'p3-storage',
      kind: 'formula',
      cells: 'J18:J25',
      marks: 1,
      prompt: '(3) Daily storage cost of each group in J18:J25 (S$ per day). Report J18 and J21.',
      solution: '=$F18*$G$3/1000*SUMPRODUCT($C$3:$E$3,G18:I18)',
      wrong: [
        '=$F18*$G$3*SUMPRODUCT($C$3:$E$3,G18:I18)', '=$F18*G3/1000*SUMPRODUCT($C$3:$E$3,G18:I18)',
        '=$F18*$G$3/1000*SUMPRODUCT($C$3:$D$3,G18:H18)',
      ],
      hints: [
        'Shelf-metres = titles x thickness / 1,000; the price per metre is the share-weighted `SUMPRODUCT`($C$3:$E$3,G18:I18).',
        'Lock the Table 1 cells ($C$3:$E$3, $G$3) and the titles column ($F18) so the formula fills down here and copies right to Table 3B in part 5.',
      ],
      explain:
        'J18 `=$F18*$G$3/1000*SUMPRODUCT($C$3:$E$3,G18:I18)` (shelf-metres x blended price): J18 S$34.56 and J21 S$23.04; the ' +
        'column reads 34.56, 51.84, 39.20, 23.04, 34.56, 42.24, 57.60, 92.16. Markers check the $ signs as well as the value: ' +
        'with $F18 and $G$3 the formula also copies right to Table 3B unchanged.',
    },
    {
      id: 'p3-rate',
      kind: 'formula',
      cells: 'K18:K25',
      marks: 1,
      prompt: '(3) Blended abandonment rate of each group in K18:K25. Report K21.',
      solution: '=SUMPRODUCT(G18:I18,$C$4:$E$4)',
      wrong: ['=SUMPRODUCT(G18:H18,$C$4:$D$4)', '=AVERAGE(G18:I18)*$E$4'],
      hints: ['Weight each tier\'s abandonment rate (row 4 of Table 1) by the group\'s share in that tier; lock $C$4:$E$4.'],
      explain:
        'K18 `=SUMPRODUCT(G18:I18,$C$4:$E$4)` (or G18*$C$4+H18*$D$4+I18*$E$4): 0% for the open groups, 2% for group 3 and 38% for ' +
        'the offsite groups, so K21 = 38%.',
    },
    {
      id: 'p3-abandoned',
      kind: 'formula',
      cells: 'L18:L25',
      marks: 1,
      prompt: '(3) Expected abandoned requests per day of each group in L18:L25. Report L21.',
      solution: '=$D18*$E18*$F18*K18',
      wrong: ['=$D18*$F18*K18', '=$D18*$E18*$F18*K18*$H$3', '=$D18*$E18*K18'],
      hints: ['Requests per day = titles x share requested per day x requests per requested title; times K18 gives the abandoned ones.'],
      explain:
        'L18 `=$D18*$E18*$F18*K18` (or with `SUMPRODUCT`($C$4:$E$4,G18:I18) in place of K18): L21 = 0.6% x 1.5 x 60,000 x 38% = ' +
        '205.2 abandoned requests a day; the column reads 0, 0, 18.90, 205.20, 111.15, 50.16, 25.08, 13.68.',
    },
    {
      id: 'p4-storage-total',
      kind: 'formula',
      cells: 'F9',
      marks: 0.5,
      prompt:
        '(4) For the proposed policy fill row 9 of Table 4: total storage cost (F9), cost of abandoned requests at S$1.50 each (G9) ' +
        'and total policy cost (H9). Start with F9.',
      solution: '=SUM(J18:J25)',
      check: { tol: 0.01 },
      wrong: ['=SUM(J18:J24)', '=AVERAGE(J18:J25)', '=SUMPRODUCT(J18:J25,F18:F25)'],
      hints: ['Column J is already a cost per day for each group: add it up.'],
      explain: 'F9 `=SUM(J18:J25)` = S$375.20 a day, against S$2,059.20 today.',
    },
    {
      id: 'p4-abandon-cost',
      kind: 'formula',
      cells: 'G9',
      marks: 1,
      prompt: '(4) Cost of abandoned requests in G9.',
      solution: '=SUM(L18:L25)*$H$3',
      check: { tol: 0.01 },
      wrong: ['=SUM(L18:L25)', '=SUM(L18:L25)*1.5', '=AVERAGE(L18:L25)*$H$3'],
      hints: ['Column L counts abandoned requests, not dollars: price them at H3.'],
      explain:
        'G9 `=SUM(L18:L25)*$H$3` = 424.17 requests x S$1.50 = S$636.255 a day. Moving groups 4-5 offsite saves shelf cost, but ' +
        'their 205 + 111 abandoned requests a day cost far more than the space they free: part 5 finds the better split.',
    },
    {
      id: 'p4-total',
      kind: 'formula',
      cells: 'H9',
      marks: 0.5,
      prompt: '(4) Total policy cost in H9.',
      solution: '=SUM(F9:G9)',
      check: { tol: 0.01 },
      wrong: ['=F9', '=F9-G9'],
      hints: ['The policy pays for the shelving and for the abandoned requests.'],
      explain: 'H9 `=SUM(F9:G9)` (or `=F9+G9`) = S$1,011.455 a day, about half of today\'s S$2,059.20.',
    },
    {
      id: 'p5-solver-optimum',
      kind: 'tool',
      tool: 'solver',
      cells: 'M18:R25,F10:H10',
      marks: 1.75,
      prompt:
        '(5) Build Table 3B (M18:R25) like Table 3A with O18 = `1-M18-N18`, starting from the proposed shares (already in M18:N25). ' +
        'Use Solver to find the shares that minimise the optimised total policy cost H10 (F10 = `SUM(P18:P25)`, G10 = ' +
        '`SUM(R18:R25)*$H$3`, H10 = `SUM(F10:G10)`) and keep Solver\'s solution: the optimal allocation stays in M18:O25 and ' +
        'F10:H10 are marked (the optimum is unique, so only the optimal shares give these costs). State the settings in the next task.',
      solutions: TABLE_3B,
      toolSetup: {
        objective: 'H10', sense: 'min', changing: 'M18:N25',
        constraints: [
          { lhs: 'M18:O25', relation: '>=', rhs: 0 },
          { lhs: 'M18:O25', relation: '<=', rhs: 1 },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { F10: 485.6, G10: 186.705, H10: 672.305 },
      check: { tol: 0.01 },
      wrong: ['0', '0.5'],
      hints: [
        'Copy I18:L25 to O18:R25: with the $ signs of part 3 the formulas move onto the shares in M:N. Then add F10:H10.',
        'Solver: Set Objective H10, To Min, By Changing M18:N25, constraints M18:O25 >= 0 and M18:O25 <= 1, Simplex LP (every formula is linear in the shares).',
      ],
      explain:
        'Optimum: groups 1-2 open, 3-5 compact, 6-8 offsite (M18:O25 all 0% or 100%); F10 S$485.60, G10 S$186.705, H10 S$672.305, ' +
        'S$339.15 a day below the proposal. Without space limits each group is independent and takes the tier with the lowest cost ' +
        'per title per day, 0.032 x price + D x E x rate x 1.50: group 3 costs 0.00288 open, 0.00193 compact and 0.01577 offsite; ' +
        'group 6 costs 0.001156 compact against 0.001068 offsite. Solver must agree with this row-by-row check. Markers read the ' +
        'allocation table and H10 (formula and value); Max instead of Min, or no O18:O25 >= 0 (which lets M + N pass 100%), changes both.',
    },
    {
      id: 'p5-solver-settings',
      kind: 'explain',
      cells: '',
      marks: 0.75,
      prompt:
        '(5) State the Solver settings you used for Table 3B: objective cell and Min/Max, changing cells, every constraint and the ' +
        'solving method.',
      answer:
        'Set Objective H10, To Min. By Changing Variable Cells M18:N25 (not O18:O25: the offsite share is a formula). Constraints ' +
        'M18:O25 >= 0 and M18:O25 <= 1; O18:O25 >= 0 is the one that stops M + N going over 100%. Make Unconstrained Variables ' +
        'Non-Negative ticked. Solving method Simplex LP: every cost is a sum of share x constant, so the model is linear.',
      hints: ['List the Solver dialog as you filled it in, one constraint per line, and say why that solving method fits.'],
    },
    {
      id: 'p6-solver-space-limits',
      kind: 'tool',
      tool: 'solver',
      cells: 'T18:Y25,U4:U5,F11:H11',
      marks: 1.5,
      prompt:
        '(6) Space is limited: open shelves hold at most 25,000 titles (U2) and compact shelving at most 170,000 titles (U3). Keep ' +
        'Table 3B as it is: copy M18:R25 to T18:Y25 (Table 3C) and link row 11 of Table 4 to the copy (F11 = `SUM(W18:W25)`, G11 = ' +
        '`SUM(Y18:Y25)*$H$3`, H11 = `SUM(F11:G11)`). Add U4 = `SUMPRODUCT($F$18:$F$25,T18:T25)` and U5 = ' +
        '`SUMPRODUCT($F$18:$F$25,U18:U25)`, re-run Solver on Table 3C (minimise H11 by changing T18:U25) with the two capacity ' +
        'constraints added, and report the new allocation (it stays in T18:V25) and total cost in row 11 of Table 4. U4:U5 and ' +
        'F11:H11 are marked (the optimum is unique, so only the optimal shares give these values).',
      solutions: TABLE_3C,
      toolSetup: {
        objective: 'H11', sense: 'min', changing: 'T18:U25',
        constraints: [
          { lhs: 'T18:V25', relation: '>=', rhs: 0 },
          { lhs: 'T18:V25', relation: '<=', rhs: 1 },
          { lhs: 'U4', relation: '<=', rhs: 'U2' },
          { lhs: 'U5', relation: '<=', rhs: 'U3' },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { U4: 25000, U5: 170000, F11: 462.08, G11: 235.005, H11: 697.085 },
      // the lab's Solver writes shares to 8 decimals, so U5 reads 170000.00024: well inside tol
      check: { tol: 0.01 },
      wrong: ['0', '0.72222'],
      hints: [
        'Select M18:R25, copy, select T18 and paste: the shares arrive as values in T:U and the formulas shift to V:Y. Then type ' +
          'F11:H11 so row 11 reads W and Y (copying row 10 down a row would shift its ranges to rows 19-26).',
        'Solver: Min H11 by changing T18:U25 with T18:V25 >= 0, T18:V25 <= 1, U4 <= U2 and U5 <= U3 (Simplex LP).',
      ],
      explain:
        'Solver: Set Objective H11, To Min, By Changing T18:U25, subject to T18:V25 >= 0, T18:V25 <= 1, U4 <= U2 and U5 <= U3 ' +
        '(Simplex LP). New allocation: group 2 is 72.22% open and 27.78% compact, group 5 is 77.78% compact and 22.22% offsite, ' +
        'the other groups stay as in part 5. F11 S$462.08, G11 S$235.005, H11 S$697.085, S$24.78 a day more than H10. Both limits ' +
        'bind (U4 = 25,000, U5 = 170,000). Markers read the allocation and H11. A limit typed the wrong way round (>=) leaves U4 ' +
        'at 30,000 and row 11 equal to row 10; if Table 3C or row 11 still reads Table 3B (M:R), H11 does not depend on T18:U25 ' +
        'and Solver returns any shares that fit the limits.',
    },
    {
      id: 'p6-interpretation',
      kind: 'explain',
      cells: '',
      marks: 0.5,
      prompt:
        '(6) In two or three sentences, explain which groups change tier under the space limits, why those groups, and what the ' +
        'limits cost per day.',
      answer:
        'Open shelves are 5,000 titles short (groups 1-2 need 30,000), and moving group 2 to compact costs only S$0.00088 more per ' +
        'title a day against S$0.00634 for group 1, so 27.78% of group 2 moves to compact. Compact is then 20,000 titles over its ' +
        'limit; the cheapest titles to send offsite are group 5\'s (S$0.00102 more per title), so 22.22% of group 5 goes offsite. ' +
        'The total rises by S$24.78 to S$697.085 a day. The shared limits tie the groups together, so the row-by-row comparison of ' +
        'part 5 no longer works and Solver is needed.',
      hints: ['Compare the extra cost per title of each possible move: the cheapest move fills each shortfall first.'],
    },
  ],
  testCases: [
    { name: 'Delays start at 1:30', inputs: { B8: 1.5 / 24 } },
    { name: 'A 2-hour delay loses 25% of requests', inputs: { C8: 0.25 } },
    { name: 'Books average 30 mm and open shelving costs S$0.10', inputs: { G3: 30, C3: 0.1 } },
    { name: 'Compact shelving costs S$0.04 and loses 3% of requests', inputs: { D3: 0.04, D4: 0.03 } },
    { name: 'Groups 4-8 keep 40% of their titles on compact shelving', inputs: { H21: 0.4, H22: 0.4, H23: 0.4, H24: 0.4, H25: 0.4 } },
    { name: 'An abandoned request costs S$2.00', inputs: { H3: 2 } },
    { name: 'Offsite costs S$0.015 and group 6 holds 120,000 titles', inputs: { E3: 0.015, F23: 120000 } },
  ],
  skills: [
    'Time steps with TIME', 'mm to metre unit conversion', 'SUMPRODUCT costing with mixed references', 'Solver LP allocation',
    'Stating Solver settings', 'Capacity constraints in a Solver re-solve', 'Interpreting binding capacity limits',
  ],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Unit conversion (MB to GB, seconds/minutes to day fractions)',
    'SUMPRODUCT totals and weighted/expected values',
    'Absolute/mixed references so formulas fill down/right',
    'Solver optimisation (objective, changing cells, constraints)',
    'Linearising a model for Solver (fix step-lookups, choose engine)',
    'Written interpretation of model results',
  ],
}
