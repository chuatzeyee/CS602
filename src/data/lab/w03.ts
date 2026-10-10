import type { CellSpec, CellValue, Exercise, Role } from '../../lab/types'

// Week 3 lookups and optimisation: VLOOKUP / LOOKUP (exact, approximate, lower-bound tables), MATCH and INDEX
// (look-left, descending, two-way, spill with row/column 0), XLOOKUP match and search modes, IFS and MIN-MAX,
// Solver LP models (product mix, integer class mix, a price list as decision cells, allocation, a bracket
// discount fixed so Simplex LP can solve). Original scenarios and numbers; every LP optimum was checked to be unique.

type Cells = Record<string, CellSpec>

const at = (ref: string): [number, number] => {
  const m = /^([A-Z])(\d+)$/.exec(ref)
  if (!m) throw new Error(`w03: bad cell ${ref}`)
  return [m[1].charCodeAt(0) - 65, Number(m[2])]
}
const cellAt = (col: number, row: number): string => `${String.fromCharCode(65 + col)}${row}`

// row-major cells of a rectangular range such as 'B4:E7'
function refs(range: string): string[] {
  const [a, b = a] = range.split(':')
  const [c1, r1] = at(a)
  const [c2, r2] = at(b)
  const out: string[] = []
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(cellAt(c, r))
  return out
}

const spec = (role: Role, v?: CellValue, fmt?: string): CellSpec => ({ role, ...(v === undefined ? {} : { v }), ...(fmt ? { fmt } : {}) })
const title = (v: string): CellSpec => ({ ...spec('label', v), bold: true })
const label = (v: CellValue): CellSpec => spec('label', v)
const header = (v: CellValue): CellSpec => spec('header', v)
const given = (fmt?: string) => (v: CellValue): CellSpec => spec('given', v, fmt)
const input = (fmt?: string) => (v: CellValue): CellSpec => spec('input', v, fmt)
const answer = (fmt?: string): CellSpec => spec('answer', undefined, fmt)
// solver variable cells: inputs (as in W2) so test cases can try other plans on the formulas that read them
const decision = (fmt = '#,##0', v: CellValue = 0): CellSpec => ({ ...spec('input', v, fmt), note: 'Decision: Solver changes this cell' })

// one spec for every cell of a range
const fill = (range: string, cell: CellSpec): Cells => Object.fromEntries(refs(range).map((r) => [r, { ...cell }]))
// a block of values from its top-left cell, row by row
function block(topLeft: string, rows: CellValue[][], make: (v: CellValue) => CellSpec): Cells {
  const [c0, r0] = at(topLeft)
  const out: Cells = {}
  rows.forEach((row, i) => row.forEach((v, j) => { out[cellAt(c0 + j, r0 + i)] = make(v) }))
  return out
}
const down = (top: string, values: CellValue[], make: (v: CellValue) => CellSpec): Cells => block(top, values.map((v) => [v]), make)
const across = (left: string, values: CellValue[], make: (v: CellValue) => CellSpec): Cells => block(left, [values], make)
// test-case inputs for a block of cells
function inputs(topLeft: string, rows: CellValue[][]): Record<string, CellValue> {
  const [c0, r0] = at(topLeft)
  const out: Record<string, CellValue> = {}
  rows.forEach((row, i) => row.forEach((v, j) => { out[cellAt(c0 + j, r0 + i)] = v }))
  return out
}
const inputsDown = (top: string, values: CellValue[]) => inputs(top, values.map((v) => [v]))

const MONEY = '$#,##0.00'
const WHOLE = '#,##0'

const T = {
  bracket: 'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
  bounds: 'Building lookup/step tables (lower bounds, increments, CRF)',
  anchors: 'Absolute/mixed references so formulas fill down/right',
  index: 'INDEX by row/column number (matrix lookup)',
  twoWay: 'Two-way INDEX/MATCH lookup',
  rules: 'IF with AND/OR multi-condition rules',
  minMax: 'Capacity and flow-balance logic with MIN/MAX',
  sumproduct: 'SUMPRODUCT totals and weighted/expected values',
  solver: 'Solver optimisation (objective, changing cells, constraints)',
  integer: 'Integer constraints in Solver',
  linear: 'Linearising a model for Solver (fix step-lookups, choose engine)',
  whatIf: 'What-if / scenario analysis by changing inputs',
  interpret: 'Written interpretation of model results',
} as const

// ---------- 1. exact-match VLOOKUP ----------

const SPICES: CellValue[][] = [
  ['SP-310', 'Black pepper', '500 g'],
  ['SP-115', 'Turmeric powder', '1 kg'],
  ['SP-402', 'Star anise', '250 g'],
  ['SP-027', 'Coriander seed', '1 kg'],
  ['SP-268', 'Cumin seed', '500 g'],
  ['SP-133', 'Chilli flakes', '1 kg'],
  ['SP-381', 'Cinnamon bark', '250 g'],
  ['SP-054', 'Green cardamom', '100 g'],
]

const spiceOrder: Exercise = {
  id: 'w3-vlookup-exact-spice-order',
  week: 'W3',
  topic: 'Exact-match VLOOKUP',
  title: 'Price an order from an unsorted price list',
  level: 1,
  minutes: 5,
  scenario:
    'Kampong Glam Spice Traders (fictional) supplies spices to restaurants. Its price list in A4:D11 is kept in the order the items were added, so the codes are not sorted. ' +
    "For each line of today's order the desk keys in an item code (G) and a number of packs (H), and needs the description and the amount to charge.",
  sheet: {
    rows: 11,
    cols: 10,
    cells: {
      A2: title('Price list'),
      F2: title("Today's order"),
      ...across('A3', ['Code', 'Description', 'Pack', 'Price ($)'], header),
      ...across('F3', ['Line', 'Code', 'Packs', 'Description', 'Amount ($)'], header),
      ...block('A4', SPICES, given()),
      ...down('D4', [9.8, 12.4, 7.6, 8.9, 6.75, 15.2, 5.4, 11.3], input(MONEY)),
      ...down('F4', [1, 2, 3, 4, 5], given('0')),
      ...down('G4', ['SP-268', 'SP-054', 'SP-402', 'SP-310', 'SP-115'], input()),
      ...down('H4', [12, 5, 6, 10, 8], input('0')),
      ...fill('I4:I8', answer()),
      ...fill('J4:J8', answer(MONEY)),
    },
    colWidths: { B: 130, I: 130, J: 96 },
  },
  tasks: [
    {
      id: 'desc',
      kind: 'formula',
      cells: 'I4:I8',
      prompt: 'In I4 return the description of the code in G4 with an exact-match `VLOOKUP` on the price list, then fill down to I8. Anchor the table as $A$4:$D$11.',
      solution: '=VLOOKUP(G4,$A$4:$D$11,2,FALSE)',
      check: { mustUse: ['VLOOKUP'], absolute: ['$A$4:$D$11'] },
      wrong: ['=VLOOKUP(G4,$A$4:$D$11,2)', '=VLOOKUP(G4,A4:D11,2,FALSE)', '=VLOOKUP(G4,$A$4:$D$11,1,FALSE)', '=VLOOKUP(G4,$B$4:$D$11,1,FALSE)'],
      hints: [
        'VLOOKUP searches the first column of the table and returns the value from the column you number: Description is column 2 of A4:D11.',
        'The codes are in no particular order, so the 4th argument must be FALSE (exact match).',
        'Press F4 on the table reference to turn it into $A$4:$D$11, so it stays put when you fill down.',
      ],
      explain:
        'FALSE makes VLOOKUP scan the whole first column for the exact code, so the list can be in any order, and a code that is not on the list shows #N/A instead of a wrong item. ' +
        'With TRUE, or with the 4th argument left out, VLOOKUP assumes the codes are sorted ascending and searches as if they were: on this unsorted list it returns wrong rows or #N/A, with no warning. ' +
        'Without the $ signs the table slides down as you fill, and the lower lines lose the top of the list (#N/A).',
    },
    {
      id: 'amount',
      kind: 'formula',
      cells: 'J4:J8',
      prompt: 'In J4 multiply the packs in H4 by the price, looked up inside the same formula with `VLOOKUP` (column 4 of the list, anchored as $A$4:$D$11 again), and fill down to J8.',
      solution: '=H4*VLOOKUP(G4,$A$4:$D$11,4,FALSE)',
      check: { mustUse: ['VLOOKUP'], absolute: ['$A$4:$D$11'], tol: 0.005 },
      wrong: ['=H4*VLOOKUP(G4,$A$4:$D$11,3,FALSE)', '=H4*VLOOKUP(G4,$A$4:$D$11,4)', '=VLOOKUP(G4,$A$4:$D$11,4,FALSE)', '=H4*VLOOKUP(G4,A4:D11,4,FALSE)'],
      hints: [
        'The price is column 4 of A4:D11.',
        'A lookup can sit inside arithmetic: packs times VLOOKUP(...).',
        'Take your I4 formula, change the column number to 4 and multiply it by H4.',
      ],
      explain:
        'VLOOKUP returns the price as a number, so it can be multiplied straight away. Column 3 holds text such as 500 g, and multiplying text gives #VALUE!. ' +
        'Looking the price up inside the amount formula saves a helper column; both give the same amounts.',
    },
  ],
  testCases: [
    { name: 'A different order', inputs: { ...inputsDown('G4', ['SP-133', 'SP-381', 'SP-027', 'SP-115', 'SP-310']), ...inputsDown('H4', [5, 20, 3, 7, 9]) } },
    { name: 'Five prices go up', inputs: { D4: 10.5, D5: 13.1, D6: 8.2, D8: 7.25, D11: 12.1 } },
  ],
  skills: ['VLOOKUP exact match (FALSE)', 'col_index_num', 'Absolute table reference', 'Lookup inside a formula'],
  techniques: [T.anchors],
}

// ---------- 2. text bands -> lower bounds -> LOOKUP ----------

const cardboard: Exercise = {
  id: 'w3-lookup-text-bands-cardboard',
  week: 'W3',
  topic: 'LOOKUP on lower bounds',
  title: 'Turn a printed rate card into a lookup table',
  level: 1,
  minutes: 6,
  scenario:
    'GreenLoop (fictional), a recycling buy-back centre in Tampines, pays for used cardboard by the kilogram, with better rates for bigger loads. ' +
    'Its rate card is printed as text bands (A4:A8), which no lookup function can read. Rewrite the bands as numbers in B4:B8, then price the six loads weighed this morning.',
  sheet: {
    rows: 9,
    cols: 7,
    cells: {
      ...across('A3', ['Band (as printed)', 'From (kg)', 'Rate ($/kg)'], header),
      ...down('A4', ['Under 50 kg', '50 kg to under 200 kg', '200 kg to under 500 kg', '500 kg to under 1,000 kg', '1,000 kg and above'], given()),
      ...fill('B4:B8', answer(WHOLE)),
      ...down('C4', [0.05, 0.07, 0.09, 0.1, 0.12], input('$0.00')),
      ...across('E3', ['Load', 'Weight (kg)', 'Rate ($/kg)'], header),
      ...down('E4', ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], given()),
      ...down('F4', [35, 120, 200, 640, 1500, 49.5], input('#,##0.0')),
      ...fill('G4:G9', answer('$0.00')),
    },
    colWidths: { A: 190 },
  },
  tasks: [
    {
      id: 'bounds',
      kind: 'value',
      cells: 'B4:B8',
      prompt: 'Type the lower bound of each band, in kg, into B4:B8 (plain numbers, not text).',
      answer: { B4: 0, B5: 50, B6: 200, B7: 500, B8: 1000 },
      wrong: ['49.99', '1'],
      hints: ['An approximate lookup needs the smallest weight of each band, as a number.', 'The first band starts at 0, not 1: even a 0.4 kg load must find a row.'],
      explain:
        'Each band is keyed by its lower bound: 0, 50, 200, 500 and 1,000. Upper bounds such as 49.99 would push every load into the band below, ' +
        'and text such as "50 kg" cannot be compared with a weight at all.',
    },
    {
      id: 'rate',
      kind: 'formula',
      cells: 'G4:G9',
      prompt: 'In G4 find the rate for the load in F4 with `LOOKUP`, searching your bounds B4:B8 and returning from the rates C4:C8. Anchor both ranges as $B$4:$B$8 and $C$4:$C$8, then fill down to G9.',
      solution: '=LOOKUP(F4,$B$4:$B$8,$C$4:$C$8)',
      check: { mustUse: ['LOOKUP'], absolute: ['$B$4:$B$8', '$C$4:$C$8'] },
      wrong: ['=LOOKUP(F4,B4:B8,C4:C8)', '=LOOKUP(F4,$C$4:$C$8,$B$4:$B$8)', '=LOOKUP(F4,$B$4:$B$8,$A$4:$A$8)'],
      hints: [
        'LOOKUP finds the largest bound that is not above the weight, then returns the rate in the same position of the rates column.',
        '`LOOKUP(lookup_value, lookup_vector, result_vector)`: the weight, your bounds, then the rates.',
        'Make both ranges absolute ($B$4:$B$8 and $C$4:$C$8) before filling down.',
      ],
      explain:
        'LOOKUP finds the largest bound that is less than or equal to the weight and returns the rate in the same position: 49.5 kg gets $0.05, ' +
        'while 200 kg is itself a bound and gets $0.09. LOOKUP always matches approximately, so the bounds must be sorted ascending.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'What would a 30 kg load show if the table started at 50 instead of 0? Why must the bounds run from smallest to largest?',
      answer:
        'LOOKUP returns the rate of the largest bound that is less than or equal to the weight. If the table started at 50, a 30 kg load would have no bound at or below it and LOOKUP would show #N/A: ' +
        'the 0 row catches every small load. LOOKUP, VLOOKUP with TRUE and MATCH type 1 all assume ascending bounds; on an unsorted list they stop at the wrong row without any warning.',
    },
  ],
  testCases: [
    { name: 'Six other loads', inputs: inputsDown('F4', [55, 480, 999, 1000, 20, 260]) },
    { name: 'New rate card', inputs: inputsDown('C4', [0.04, 0.06, 0.085, 0.11, 0.13]) },
  ],
  skills: ['Lower-bound bracket table', 'LOOKUP vector form', 'Sorted ascending requirement'],
  techniques: [T.bounds, T.bracket],
}

// ---------- 3. MATCH and INDEX: exact, look left, descending ----------

const VESSELS: CellValue[][] = [
  ['Selat Pioneer', 'Merlion Lines', 14, 1260],
  ['Orchid Trader', 'Straits Feeder', 3, 840],
  ['Kallang Star', 'Lion Ocean', 9, 1975],
  ['Pulau Express', 'Merlion Lines', 1, 610],
  ['Raffles Bay', 'Equator Shipping', 12, 2240],
  ['Bukit Horizon', 'Straits Feeder', 6, 1135],
  ['Marina Dawn', 'Lion Ocean', 17, 1580],
  ['Tanjong Spirit', 'Equator Shipping', 8, 990],
]

const berths: Exercise = {
  id: 'w3-index-match-berths',
  week: 'W3',
  topic: 'MATCH and INDEX',
  title: 'Who is at berth 12, and where does a 275 m ship fit?',
  level: 1,
  minutes: 8,
  scenario:
    'PortLink (fictional) runs a container terminal at Pasir Panjang. Its schedule (A4:D11) lists the vessel first and the berth number further right, ' +
    'so VLOOKUP cannot answer the duty officer\'s question "who is at berth 12?". A second table (A15:B20) lists the berth classes from the longest to the shortest, ' +
    'for sending an arriving ship to the shortest class that can take it.',
  sheet: {
    rows: 20,
    cols: 8,
    cells: {
      ...across('A3', ['Vessel', 'Shipping line', 'Berth', 'Containers'], header),
      ...block('A4', VESSELS.map((r) => r.slice(0, 2)), given()),
      ...down('C4', VESSELS.map((r) => r[2]), given('0')),
      ...down('D4', VESSELS.map((r) => r[3]), given(WHOLE)),
      ...across('F3', ['Berth', 'Row in list', 'Vessel'], header),
      ...down('F4', [12, 14, 8], input('0')),
      ...fill('G4:G6', answer('0')),
      ...fill('H4:H6', answer()),
      ...across('A14', ['Max length (m)', 'Berth class'], header),
      ...down('A15', [400, 350, 300, 260, 220, 180], given('0')),
      ...down('B15', ['Class A', 'Class B', 'Class C', 'Class D', 'Class E', 'Class F'], given()),
      ...across('F14', ['Ship length (m)', 'Shortest class that fits'], header),
      ...down('F15', [275, 180, 333], input('0')),
      ...fill('G15:G17', answer()),
    },
    colWidths: { A: 120, B: 130, F: 120, G: 170, H: 120 },
  },
  tasks: [
    {
      id: 'pos',
      kind: 'formula',
      cells: 'G4:G6',
      prompt: 'In G4 use `MATCH` to find where the berth in F4 sits in the berth column C4:C11 (1 = first vessel), and fill down to G6.',
      solution: '=MATCH(F4,$C$4:$C$11,0)',
      check: { mustUse: ['MATCH'] },
      wrong: ['=MATCH(F4,$C$4:$C$11)', '=MATCH(F4,$C$3:$C$11,0)', '=MATCH(F4,C4:C11,0)'],
      hints: [
        'MATCH returns a position, not a value: `MATCH(lookup_value, lookup_array, match_type)`.',
        'The berths are not sorted, so use match_type 0 for an exact match.',
        'Anchor the berth column as $C$4:$C$11 so it stays put when you fill down.',
      ],
      explain:
        'Berth 12 is the 5th entry of C4:C11, so MATCH returns 5. With match_type 1, which is also what you get when you leave it out, MATCH assumes an ascending list ' +
        'and can return a wrong position without any error. Positions count from the first cell of the range: starting it at the header C3 shifts every answer by one.',
    },
    {
      id: 'vessel',
      kind: 'formula',
      cells: 'H4:H6',
      prompt: 'In H4 return the vessel at that berth with `INDEX` on the vessel column A4:A11 and the position from `MATCH` (nest the MATCH or point at G4). Fill down to H6.',
      solution: '=INDEX($A$4:$A$11,MATCH(F4,$C$4:$C$11,0))',
      check: { mustUse: ['INDEX'] },
      wrong: ['=INDEX($A$4:$A$11,MATCH(F4,$C$4:$C$11,1))', '=INDEX($A$3:$A$11,MATCH(F4,$C$4:$C$11,0))', '=INDEX($B$4:$B$11,MATCH(F4,$C$4:$C$11,0))'],
      hints: [
        '`INDEX(array, row_num)` returns the item at that position of the array.',
        'The vessel names sit to the LEFT of the berths, where VLOOKUP cannot reach; INDEX can return any column.',
        'INDEX over the anchored vessel column $A$4:$A$11, with your G4 position (or the same MATCH) as row_num.',
      ],
      explain:
        'INDEX($A$4:$A$11,MATCH(F4,$C$4:$C$11,0)) finds the row by berth and returns the vessel from column A. Both ranges must start on the same row (4), ' +
        'or the position points at the wrong vessel. This is why INDEX with MATCH replaces VLOOKUP when the answer sits left of the search column.',
    },
    {
      id: 'fit',
      kind: 'formula',
      cells: 'G15:G17',
      prompt: 'A15:A20 holds the longest ship each berth class takes, longest first. In G15 return the shortest class that can take the ship in F15, with `INDEX` and `MATCH` type -1, and fill down to G17.',
      solution: '=INDEX($B$15:$B$20,MATCH(F15,$A$15:$A$20,-1))',
      check: { mustUse: ['INDEX', 'MATCH'] },
      wrong: ['=INDEX($B$15:$B$20,MATCH(F15,$A$15:$A$20,1))', '=INDEX($B$15:$B$20,MATCH(F15,$A$15:$A$20,0))', '=INDEX($B$15:$B$20,MATCH(F15,$A$15:$A$20,-1)+1)'],
      hints: [
        'A 275 m ship needs a class whose maximum is at least 275 m; of those classes, it should get the one with the smallest maximum.',
        'MATCH type -1 returns the position of the smallest entry at or above the lookup value, and needs a list sorted from largest to smallest, as A15:A20 is.',
        'INDEX over the class names $B$15:$B$20, with MATCH(F15, the anchored lengths, -1) as row_num.',
      ],
      explain:
        'MATCH type -1 mirrors type 1: on a descending list it returns the smallest value at or above the lookup value, so 275 m maps to the 300 m class and 180 m to the 180 m class. ' +
        'Of the classic lookups only MATCH can approximate-match a descending list (VLOOKUP and LOOKUP need ascending ones; XLOOKUP\'s match modes work in any order); ' +
        'a ship longer than 400 m would show #N/A.',
    },
  ],
  testCases: [
    { name: 'Other berths and ships', inputs: { ...inputsDown('F4', [6, 17, 3]), ...inputsDown('F15', [210, 400, 262]) } },
    { name: 'A third set of queries', inputs: { ...inputsDown('F4', [9, 1, 12]), ...inputsDown('F15', [399, 221, 261]) } },
  ],
  skills: ['MATCH exact (0)', 'INDEX + MATCH to the left', 'MATCH -1 on a descending list'],
  techniques: [T.index],
}

// ---------- 4. XLOOKUP match modes ----------

const storage: Exercise = {
  id: 'w3-xlookup-storage-units',
  week: 'W3',
  topic: 'XLOOKUP match modes',
  title: 'The smallest unit that fits, the biggest the budget allows',
  level: 1,
  minutes: 5,
  scenario:
    'StoreRight (fictional) rents self-storage units in Bukit Batok in six sizes (A4:C9). Staff answer two questions all day: what is the smallest unit that fits a customer\'s things, ' +
    'and what is the biggest unit the monthly budget can pay for? `XLOOKUP` answers both: match_mode 1 returns the next larger item and -1 the next smaller.',
  sheet: {
    rows: 16,
    cols: 5,
    cells: {
      ...across('A3', ['Size (sq ft)', 'Unit', 'Rent ($/month)'], header),
      ...down('A4', [15, 25, 40, 60, 100, 150], given(WHOLE)),
      ...down('B4', ['XS', 'S', 'M', 'L', 'XL', 'XXL'], given()),
      ...down('C4', [79, 119, 169, 229, 339, 459], input(MONEY)),
      ...across('A12', ['Customer', 'Needs (sq ft)', 'Smallest unit that fits', 'Budget ($/month)', 'Biggest unit in budget'], header),
      ...down('A13', ['Mdm Wong', 'Mr Lim', 'Ms Rao', 'Dr Goh'], given()),
      ...down('B13', [30, 100, 12, 170], input(WHOLE)),
      ...fill('C13:C16', answer()),
      ...down('D13', [200, 340, 60, 459], input(MONEY)),
      ...fill('E13:E16', answer()),
    },
    colWidths: { A: 96, B: 104, C: 180, D: 120, E: 170 },
  },
  tasks: [
    {
      id: 'fit',
      kind: 'formula',
      cells: 'C13:C16',
      prompt: 'In C13 use `XLOOKUP` to return the smallest unit (B4:B9) whose size (A4:A9) is at least the space in B13, showing "No unit" when nothing is big enough. Fill down to C16.',
      solution: '=XLOOKUP(B13,$A$4:$A$9,$B$4:$B$9,"No unit",1)',
      check: { mustUse: ['XLOOKUP'] },
      wrong: [
        '=XLOOKUP(B13,$A$4:$A$9,$B$4:$B$9,"No unit",-1)', '=XLOOKUP(B13,$A$4:$A$9,$B$4:$B$9,"No unit")', '=XLOOKUP(B13,$A$4:$A$9,$B$4:$B$9,1)',
        '=XLOOKUP(B13,A4:A9,B4:B9,"No unit",1)',
      ],
      hints: [
        '`XLOOKUP` takes what to find, where to look and what to return, then if_not_found and match_mode.',
        'match_mode 1 means: an exact match, or else the next larger item.',
        'The 4th argument is what to show when nothing is found: "No unit". Anchor both arrays.',
      ],
      explain:
        'match_mode 1 returns the exact size if there is one, otherwise the next larger size: the smallest unit that fits. A need above 150 sq ft has no larger item, ' +
        'so XLOOKUP shows the if_not_found text instead of #N/A. XLOOKUP checks the items one by one, so the list does not even have to be sorted (only the binary-search modes, search_mode 2 and -2, need sorted data).',
    },
    {
      id: 'budget',
      kind: 'formula',
      cells: 'E13:E16',
      prompt: 'In E13 use `XLOOKUP` to return the biggest unit whose rent (C4:C9) fits within the budget in D13, showing "None" when even the smallest unit is too dear. Fill down to E16.',
      solution: '=XLOOKUP(D13,$C$4:$C$9,$B$4:$B$9,"None",-1)',
      check: { mustUse: ['XLOOKUP'] },
      wrong: ['=XLOOKUP(D13,$C$4:$C$9,$B$4:$B$9,"None",1)', '=XLOOKUP(D13,$C$4:$C$9,$A$4:$A$9,"None",-1)', '=XLOOKUP(D13,C4:C9,B4:B9,"None",-1)'],
      hints: [
        'Search the rent column this time and return the unit name from column B, to its left.',
        'match_mode -1: an exact match, or else the next smaller item.',
        'XLOOKUP(D13, the anchored rents, the anchored unit names, "None", -1).',
      ],
      explain:
        'With match_mode -1 XLOOKUP returns the exact rent if there is one, otherwise the next smaller rent: the dearest unit the budget still covers. ' +
        'The return array may sit left of the lookup array, which VLOOKUP cannot do. A budget below the cheapest rent finds nothing smaller and shows "None".',
    },
  ],
  testCases: [
    { name: 'Four new customers', inputs: { ...inputsDown('B13', [60, 26, 151, 14]), ...inputsDown('D13', [120, 500, 80, 230]) } },
    { name: 'Rents go up', inputs: inputsDown('C4', [85, 129, 185, 249, 369, 499]) },
  ],
  skills: ['XLOOKUP if_not_found', 'match_mode 1 (next larger)', 'match_mode -1 (next smaller)', 'Return a column to the left'],
  techniques: [T.bracket],
}

// ---------- 4b. XLOOKUP search from the last entry, wildcards ----------

// a hawker stall's price log in date order: [date serial, code, dish, new price]
const PRICE_LOG: CellValue[][] = [
  [45663, 'D01', 'Chicken rice', 4.5],
  [45663, 'D06', 'Nasi lemak', 4],
  [45663, 'D02', 'Curry laksa', 5.5],
  [45663, 'D03', 'Char kway teow', 5],
  [45663, 'D04', 'Fish soup', 6],
  [45719, 'D02', 'Curry laksa', 6],
  [45810, 'D05', 'Mee rebus', 4.8],
  [45901, 'D01', 'Chicken rice', 5],
  [45901, 'D03', 'Char kway teow', 5.5],
  [46027, 'D04', 'Fish soup', 6.5],
  [46083, 'D02', 'Curry laksa', 6.5],
  [46146, 'D05', 'Mee rebus', 5.2],
  [46237, 'D01', 'Chicken rice', 5.5],
]

const priceLog: Exercise = {
  id: 'w3-xlookup-latest-price-log',
  week: 'W3',
  topic: 'XLOOKUP search modes',
  title: 'The latest price from a price-change log',
  level: 1,
  minutes: 8,
  scenario:
    'Seven Spice Kitchen (fictional), a stall in a Toa Payoh hawker centre, adds a row to its log (A4:D16) every time a dish\'s price changes, oldest first, so most dishes appear more than once. ' +
    'The owner wants each dish\'s current price (its last entry), its first recorded price, and a quick way to find a dish by one word of its name.',
  sheet: {
    rows: 16,
    cols: 8,
    cells: {
      A1: title('Price-change log'),
      ...across('A3', ['Date', 'Code', 'Dish', 'Price ($)'], header),
      ...block('A4', PRICE_LOG.map((r) => [r[0]]), given('dd-mmm-yy')),
      ...block('B4', PRICE_LOG.map((r) => r.slice(1, 3)), given()),
      ...down('D4', PRICE_LOG.map((r) => r[3]), input('$0.00')),
      ...across('F3', ['Code', 'Current price ($)', 'First price ($)'], header),
      ...down('F4', ['D02', 'D01', 'D03', 'D07'], input()),
      ...fill('G4:H7', answer('$0.00')),
      F9: header('Word in the name'),
      G9: header('Current price ($)'),
      F10: input()('rebus'),
      G10: answer('$0.00'),
    },
    colWidths: { A: 90, C: 130, E: 24, F: 130, G: 140, H: 130 },
  },
  tasks: [
    {
      id: 'current',
      kind: 'formula',
      cells: 'G4:G7',
      prompt:
        'In G4 use `XLOOKUP` to return the current price of the dish code in F4. The log is oldest first, so search it from the last entry (search_mode -1), ' +
        'and show "No record" for a code that is not in the log. Fill down to G7.',
      solution: '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,"No record",0,-1)',
      check: { mustUse: ['XLOOKUP'] },
      wrong: [
        '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,"No record")',
        '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,"No record",0,1)',
        '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,,0,-1)',
        '=XLOOKUP(F4,B4:B16,D4:D16,"No record",0,-1)',
      ],
      hints: [
        'The current price is the LAST entry for the code, but a normal lookup stops at the first (oldest) one.',
        'After what to find, where to look and what to return, `XLOOKUP` takes if_not_found, match_mode (0 = exact) and search_mode (-1 = start from the last item).',
        'XLOOKUP(F4, the anchored codes, the anchored prices, "No record", 0, -1).',
      ],
      explain:
        'search_mode -1 starts at the bottom of the log, so the first match it meets is the latest change: Curry laksa (D02) went from $5.50 to $6.00 to $6.50, and XLOOKUP returns $6.50. ' +
        'VLOOKUP with FALSE, MATCH with 0 and XLOOKUP\'s default search all stop at the oldest entry. D07 is not in the log, so the if_not_found text replaces #N/A.',
    },
    {
      id: 'first',
      kind: 'formula',
      cells: 'H4:H7',
      prompt: 'In H4 return the first price ever recorded for the code in F4, again showing "No record" when the code is missing, and fill down to H7.',
      solution: '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,"No record")',
      check: { mustUse: ['XLOOKUP'] },
      wrong: [
        '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16,"No record",0,-1)',
        '=XLOOKUP(F4,$B$4:$B$16,$D$4:$D$16)',
        '=XLOOKUP(F4,B4:B16,D4:D16,"No record")',
      ],
      hints: ['The first entry is what XLOOKUP finds when it searches from the top: its default.', 'Drop the search_mode (or use 1) and keep "No record" as the 4th argument.'],
      explain:
        'Searching from the first item (search_mode 1, the default) returns the oldest entry: $5.50 for Curry laksa, the same answer as VLOOKUP with FALSE. ' +
        'Current minus first price shows how much each dish has gone up. Tip: =FORMULATEXT(G4) shows a formula as text beside its result, as the course\'s XLOOKUP workbook does.',
    },
    {
      id: 'word',
      kind: 'formula',
      cells: 'G10',
      prompt:
        'In G10 return the current price of the dish whose name contains the word in F10 (rebus finds Mee rebus). Use `XLOOKUP` with the wildcard match_mode 2, ' +
        'a * on both sides of F10, "Not found" when no name matches, and a search from the last entry.',
      solution: '=XLOOKUP("*"&F10&"*",$C$4:$C$16,$D$4:$D$16,"Not found",2,-1)',
      check: { mustUse: ['XLOOKUP'] },
      wrong: [
        '=XLOOKUP("*"&F10&"*",$C$4:$C$16,$D$4:$D$16,"Not found",2)',
        '=XLOOKUP("*"&F10&"*",$C$4:$C$16,$D$4:$D$16,"Not found",0,-1)',
        '=XLOOKUP(F10,$C$4:$C$16,$D$4:$D$16,"Not found",2,-1)',
      ],
      hints: [
        'In match_mode 2, * stands for any number of characters: "*rebus*" matches any name that contains rebus.',
        'Join the stars to the cell with &: "*"&F10&"*".',
        'XLOOKUP("*"&F10&"*", the dish names, the prices, "Not found", 2, -1).',
      ],
      explain:
        'With match_mode 2, * matches any run of characters and ? a single one, and the match ignores case, so "*"&F10&"*" finds rebus anywhere in the name. ' +
        'Searching from the last entry returns Mee rebus\'s latest price, $5.20, not its first ($4.80). In match_mode 0 the * is an ordinary character and nothing matches.',
    },
  ],
  testCases: [
    { name: 'Four other codes and the word kway', inputs: { ...inputsDown('F4', ['D04', 'D05', 'D02', 'D06']), F10: 'kway' } },
    { name: 'Prices corrected in the log', inputs: inputsDown('D4', [4.6, 4.2, 5.6, 5.1, 6.2, 6.1, 4.9, 5.2, 5.6, 6.6, 6.7, 5.3, 5.8]) },
    { name: 'The word soup', inputs: { F10: 'soup' } },
  ],
  skills: ['XLOOKUP search_mode -1 (last match)', 'XLOOKUP default search (first match)', 'Wildcard match_mode 2 with *', 'if_not_found text'],
}

// ---------- 5. IFS: tiers and a floor/cap ----------

const commission: Exercise = {
  id: 'w3-ifs-trainer-commission',
  week: 'W3',
  topic: 'IFS and MIN-MAX',
  title: 'Trainer tiers and a capped commission',
  level: 1,
  minutes: 7,
  scenario:
    'CoreFit (fictional), a gym chain with outlets in Orchard and Tampines, pays its personal trainers a monthly commission on the training packages they sell. ' +
    'The commission is a percentage of sales, never less than a guaranteed floor and never more than a cap, and each trainer gets a tier for the leaderboard. ' +
    'Write the tier and the commission with `IFS`, then check the commission with `MIN` and `MAX`.',
  sheet: {
    rows: 9,
    cols: 8,
    cells: {
      ...across('A3', ['Trainer', 'Sales ($)', 'Tier', 'Commission ($)', 'Check: MIN-MAX ($)'], header),
      ...down('A4', ['Aisyah', 'Ben', 'Chloe', 'Dinesh', 'Elaine', 'Farid'], given()),
      ...down('B4', [21400, 8000, 3600, 15000, 11250, 2100], input('$#,##0')),
      ...fill('C4:C9', answer()),
      ...fill('D4:E9', answer(MONEY)),
      ...across('G3', ['Rule', 'Value'], header),
      ...down('G4', ['Commission rate', 'Guaranteed floor ($)', 'Cap ($)', 'Elite from sales of ($)', 'Senior from sales of ($)'], label),
      H4: input('0%')(0.12),
      ...down('H5', [400, 2000, 15000, 8000], input('$#,##0')),
    },
    colWidths: { D: 120, E: 140, F: 24, G: 180 },
  },
  tasks: [
    {
      id: 'tier',
      kind: 'formula',
      cells: 'C4:C9',
      prompt: 'In C4 use `IFS` to label the trainer Elite (sales of at least H7), Senior (at least H8) or Junior, and fill down to C9.',
      solution: '=IFS(B4>=$H$7,"Elite",B4>=$H$8,"Senior",TRUE,"Junior")',
      check: { mustUse: ['IFS'] },
      wrong: [
        '=IFS(B4>=$H$8,"Senior",B4>=$H$7,"Elite",TRUE,"Junior")',
        '=IFS(B4>=$H$7,"Elite",B4>=$H$8,"Senior")',
        '=IFS(B4>$H$7,"Elite",B4>$H$8,"Senior",TRUE,"Junior")',
        '=IFS(B4>=H7,"Elite",B4>=H8,"Senior",TRUE,"Junior")',
      ],
      hints: [
        'IFS checks its tests left to right and returns the value of the first TRUE one, so test the highest tier first.',
        'End with TRUE,"Junior" as the catch-all: without it IFS shows #N/A when no test holds.',
        '"At least $15,000" includes 15,000 itself: use >=, and anchor $H$7 and $H$8 before filling down.',
      ],
      explain:
        'Order matters: a trainer with $21,400 also passes the Senior test, but IFS stops at the first TRUE test, Elite. TRUE as the last test catches everyone else. ' +
        'The nested-IF version is =IF(B4>=$H$7,"Elite",IF(B4>=$H$8,"Senior","Junior")).',
    },
    {
      id: 'pay',
      kind: 'formula',
      cells: 'D4:D9',
      prompt: 'In D4 use `IFS` to pay the commission rate (H4) on the sales, but never less than the floor (H5) and never more than the cap (H6). Fill down to D9.',
      solution: '=IFS(B4*$H$4<$H$5,$H$5,B4*$H$4>$H$6,$H$6,TRUE,B4*$H$4)',
      check: { mustUse: ['IFS'], tol: 0.005 },
      wrong: [
        '=IFS(B4*$H$4<$H$5,$H$5,B4*$H$4>$H$6,$H$6)',
        '=IFS(B4*$H$4>$H$5,$H$5,B4*$H$4<$H$6,$H$6,TRUE,B4*$H$4)',
        '=IFS(B4*H4<H5,H5,B4*H4>H6,H6,TRUE,B4*H4)',
        '=IFS(B4<$H$5,$H$5,B4>$H$6,$H$6,TRUE,B4*$H$4)',
        '=B4*$H$4',
      ],
      hints: [
        'Three cases: below the floor pay the floor, above the cap pay the cap, otherwise pay the commission itself.',
        'Compare the commission (sales times rate), not the sales, with the floor and the cap.',
        'The pattern from class for keeping x between a minimum and a maximum: IFS(x<min,min,x>max,max,TRUE,x), with x = B4*$H$4.',
      ],
      explain:
        'IFS pays the floor when the commission is below it, the cap when it is above it, and the commission itself otherwise (the TRUE catch-all): ' +
        'Farid\'s 12% of $2,100 is only $252, so he gets the $400 floor, and Aisyah\'s $2,568 is cut to the $2,000 cap. ' +
        'The nested IF is =IF(B4*$H$4<$H$5,$H$5,IF(B4*$H$4>$H$6,$H$6,B4*$H$4)).',
    },
    {
      id: 'minmax',
      kind: 'formula',
      cells: 'E4:E9',
      prompt: 'In E4 pay the same commission using only `MIN` and `MAX` (no IF or IFS), and fill down to E9. Every row must match column D.',
      solution: '=MIN($H$6,MAX($H$5,B4*$H$4))',
      check: { mustUse: ['MIN', 'MAX'], mustNotUse: ['IF', 'IFS'], tol: 0.005 },
      wrong: [
        '=MIN($H$5,MAX($H$6,B4*$H$4))',
        '=MAX($H$6,MIN($H$5,B4*$H$4))',
        '=MIN($H$6,B4*$H$4)',
        '=MAX($H$5,B4*$H$4)',
      ],
      hints: [
        'MAX(floor, x) can never be below the floor; MIN(cap, x) can never be above the cap.',
        'Nest one inside the other: first lift x to the floor, then cut the result at the cap.',
        'MIN(cap, MAX(floor, commission)), with the cap, the floor and the rate anchored.',
      ],
      explain:
        'MAX($H$5,B4*$H$4) lifts any commission below $400 to the floor, and MIN($H$6, ...) cuts anything above $2,000 to the cap. =MAX($H$5,MIN($H$6,B4*$H$4)) works too. ' +
        'Nested IF, MIN-MAX and IFS give identical results, so pick the one you read fastest. The same MIN and MAX logic caps any quantity at a limit, ' +
        'such as customers served = MIN(demand, capacity).',
    },
  ],
  testCases: [
    { name: 'Rate 15%, floor $500, cap $2,400', inputs: { H4: 0.15, H5: 500, H6: 2400 } },
    { name: 'New tier thresholds', inputs: { H7: 20000, H8: 10000 } },
    { name: 'A different month of sales', inputs: inputsDown('B4', [1800, 16500, 12000, 30000, 4000, 9600]) },
  ],
  skills: ['IFS with a TRUE catch-all', 'Order of tests', 'Floor and cap: nested IF, MIN-MAX and IFS'],
  techniques: [T.rules, T.minMax, T.anchors],
}

// ---------- 6. spill formulas ----------

const OUTLETS: CellValue[][] = [
  ['Bugis', 182400, 175900, 190300, 204800],
  ['Jurong East', 165200, 171000, 168700, 189500],
  ['Tampines', 158900, 162300, 170100, 181200],
  ['Woodlands', 121500, 118800, 126400, 139900],
  ['Serangoon', 143700, 149200, 151800, 160400],
  ['Clementi', 98600, 102100, 99400, 110300],
  ['Bedok', 134800, 131500, 140200, 152700],
  ['Yishun', 112300, 115600, 119900, 128400],
]

const spill: Exercise = {
  id: 'w3-spill-outlet-quarters',
  week: 'W3',
  topic: 'Spill formulas',
  title: 'One formula, four quarters',
  level: 1,
  minutes: 7,
  scenario:
    'Boba Bay (fictional) runs eight bubble-tea outlets. The area manager picks an outlet in H2 and wants its four quarterly sales and next year\'s quarterly targets; ' +
    'she also picks a quarter in M2 to compare all eight outlets. In modern Excel one formula can return several values, which spill into the empty cells beside or below it.',
  sheet: {
    rows: 11,
    cols: 13,
    cells: {
      ...across('A3', ['Outlet', 'Q1', 'Q2', 'Q3', 'Q4'], header),
      ...block('A4', OUTLETS.map((r) => [r[0]]), given()),
      ...block('B4', OUTLETS.map((r) => r.slice(1)), given(WHOLE)),
      G2: label('Outlet'),
      H2: input()('Tampines'),
      ...across('H3', ['Q1', 'Q2', 'Q3', 'Q4'], header),
      G4: label('Sales ($)'),
      ...fill('H4:K4', answer(WHOLE)),
      G5: label('Growth target'),
      H5: input('0%')(0.08),
      G6: label('Target ($)'),
      ...fill('H6:K6', answer(WHOLE)),
      L2: label('Quarter'),
      M2: input()('Q3'),
      M3: header('Sales ($)'),
      ...fill('M4:M11', answer(WHOLE)),
    },
    colWidths: { A: 100, B: 80, C: 80, D: 80, E: 80, F: 24, G: 104, H: 80, I: 80, J: 80, K: 80, L: 64, M: 96 },
  },
  tasks: [
    {
      id: 'row',
      kind: 'formula',
      cells: 'H4:K4',
      prompt: 'In H4 write ONE formula with `INDEX` and `MATCH` that returns all four quarters of the outlet named in H2. Type it in H4 only: it spills into I4:K4 by itself.',
      solutions: { H4: '=INDEX(B4:E11,MATCH(H2,A4:A11,0),0)' },
      check: { mustUse: ['INDEX', 'MATCH'] },
      wrong: ['=INDEX(B4:E11,MATCH(H2,A4:A11,0),1)', '=INDEX(B4:E11,MATCH(H2,A4:A11,1),0)', '=INDEX(A4:E11,MATCH(H2,A4:A11,0),0)'],
      hints: [
        'First find the outlet\'s position in A4:A11 with an exact MATCH.',
        'INDEX(B4:E11, row, 0): a column_num of 0 means "the whole row".',
        'Leave I4:K4 empty: the result needs room to spill.',
      ],
      explain:
        'With column_num 0 INDEX returns the entire row of B4:E11, four values that spill into H4:K4. The spilled cells show values but hold no formula of their own; ' +
        'if any of them is not empty you get #SPILL!. An @ in front (=@INDEX(...)) stops the spill: it keeps only the cell of that row in the formula\'s own column, and column H is outside B:E, so H4 shows #VALUE!.',
    },
    {
      id: 'target',
      kind: 'formula',
      cells: 'H6:K6',
      prompt: 'In H6 write ONE formula that multiplies the four sales in H4:K4 by (1 + the growth target in H5); it spills into I6:K6.',
      solutions: { H6: '=H4:K4*(1+H5)' },
      wrong: ['=H4:K4*H5', '=H4:K4+H5', '=H4*(1+H5)', '=H4:K4*1.08'],
      hints: [
        'Arithmetic on a range gives one result per cell: =H4:K4*2 spills four values.',
        'An 8% increase means multiplying by 1 + H5.',
        'Type the range itself, H4:K4. (Excel 365 also accepts the spill reference H4#, but this lab cannot read it.)',
      ],
      explain:
        'H4:K4*(1+H5) multiplies each quarter by 1.08 and spills four targets: a single cell times a range gives one result per cell of the range. Pick another outlet in H2 and both spills update at once.',
    },
    {
      id: 'column',
      kind: 'formula',
      cells: 'M4:M11',
      prompt: 'In M4 write ONE formula with `INDEX` and `MATCH` that returns the sales of all eight outlets in the quarter named in M2. Type it in M4 only: it spills down to M11.',
      solutions: { M4: '=INDEX(B4:E11,0,MATCH(M2,B3:E3,0))' },
      check: { mustUse: ['INDEX', 'MATCH'] },
      wrong: ['=INDEX(B4:E11,MATCH(M2,B3:E3,0),0)', '=INDEX(A4:E11,0,MATCH(M2,B3:E3,0))', '=INDEX(B4:E11,0,MATCH(M2,A3:E3,0))', '=INDEX(B4:E11,0,3)'],
      hints: [
        'This time MATCH the quarter in M2 against the headers B3:E3: it gives the column number.',
        'INDEX(B4:E11, 0, column): a row_num of 0 means "the whole column".',
        'Leave M5:M11 empty so the result has room to spill.',
      ],
      explain:
        'With row_num 0 INDEX returns the whole Q3 column of B4:E11: eight values that spill down M4:M11, each beside its outlet\'s row. ' +
        'Column_num 0 returns a row and spills across; row_num 0 returns a column and spills down. Both MATCHes must be exact (0).',
    },
  ],
  testCases: [
    { name: 'Clementi picked', inputs: { H2: 'Clementi' } },
    { name: 'Growth target 12%', inputs: { H5: 0.12 } },
    { name: 'Q1 picked', inputs: { M2: 'Q1' } },
  ],
  skills: ['INDEX with column_num 0', 'INDEX with row_num 0', 'Spill range', 'Array arithmetic that spills'],
  techniques: [T.index],
}

// ---------- 7. LP product mix with Solver ----------

const kaya: Exercise = {
  id: 'w3-solver-kaya-mix',
  week: 'W3',
  topic: 'LP product mix with Solver',
  title: 'How many cases of each kaya?',
  level: 2,
  minutes: 15,
  scenario:
    'Kaya Kingdom (fictional) cooks three kayas in a Singapore central kitchen: Classic, Pandan and Gula melaka. Each case uses coconut milk, stove time and packing time (B8:D10), ' +
    'and the weekly supply of each is limited (G8:G10); shops will take at most 100 cases of Gula melaka. Build the linear model and let Solver choose the most profitable weekly plan.',
  sheet: {
    rows: 13,
    cols: 8,
    cells: {
      ...across('B3', ['Classic', 'Pandan', 'Gula melaka'], header),
      A4: label('Cases to make'),
      ...fill('B4:D4', decision('#,##0.0')),
      A5: label('Profit per case ($)'),
      ...across('B5', [18, 22, 32], input(MONEY)),
      ...across('A7', ['Resource per case', 'Classic', 'Pandan', 'Gula melaka', 'Used', '', 'Available', 'Unused'], header),
      ...down('A8', ['Coconut milk (litres)', 'Stove time (hours)', 'Packing time (hours)', 'Gula melaka orders (cases)'], label),
      ...block('B8', [[6, 5, 8], [0.5, 1, 1], [0.4, 0.4, 0.5]], input('0.0')),
      ...across('B11', [0, 0, 1], input('0')),
      ...fill('E8:E11', answer('#,##0.0')),
      ...fill('F8:F11', label('<=')),
      ...down('G8', [2500, 300, 200, 100], input(WHOLE)),
      ...fill('H8:H11', answer('#,##0.0')),
      A13: label('Total profit ($)'),
      B13: answer(MONEY),
    },
    colWidths: { A: 205, D: 100 },
  },
  tasks: [
    {
      id: 'objective',
      kind: 'formula',
      cells: 'B13',
      prompt: 'In B13 compute the total profit with `SUMPRODUCT` of the plan (B4:D4) and the profit per case (B5:D5).',
      solution: '=SUMPRODUCT(B4:D4,B5:D5)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUM(B4:D4)*SUM(B5:D5)', '=SUMPRODUCT(B4:D4,B8:D8)', '=B4*B5+C4*C5'],
      hints: ['SUMPRODUCT multiplies the matching items of two ranges of the same shape and adds the products.', 'Both ranges run across columns B to D.'],
      explain:
        'SUMPRODUCT(B4:D4,B5:D5) = 18 x Classic + 22 x Pandan + 32 x Gula melaka cases: the linear objective function Solver will maximise. ' +
        'In LP terms B4:D4 are the decision variables and B13 the objective (the model\'s performance measure); B4:D4 hold 0 until Solver runs, so B13 shows $0.00 for now.',
    },
    {
      id: 'usage',
      kind: 'formula',
      cells: 'E8:E11',
      prompt: 'In E8 compute how much of each resource the plan uses: `SUMPRODUCT` of the anchored plan row $B$4:$D$4 and the resource row B8:D8. Fill down to E11.',
      solution: '=SUMPRODUCT($B$4:$D$4,B8:D8)',
      check: { mustUse: ['SUMPRODUCT'], absolute: ['$B$4:$D$4'] },
      wrong: ['=SUMPRODUCT(B4:D4,B8:D8)', '=SUMPRODUCT($B$4:$D$4,$B$8:$D$8)', '=SUM(B8:D8)'],
      hints: ['Each row of B8:D11 says what one case of each kaya uses.', 'The plan row must stay on row 4 when you fill down ($B$4:$D$4); the resource row must move.'],
      explain:
        'E8 = 6 x Classic + 5 x Pandan + 8 x Gula melaka litres. Each used amount is the left-hand side (LHS) of a constraint and the available amount in column G its right-hand side (RHS). ' +
        'Row 11 has the coefficients 0, 0, 1, so E11 is just the Gula melaka cases: writing the demand limit as one more resource row lets a single range constraint, E8:E11 <= G8:G11, cover every limit.',
    },
    {
      id: 'solve',
      kind: 'tool',
      tool: 'solver',
      cells: 'B4:D4',
      prompt: 'Use Solver to maximise B13 by changing B4:D4, subject to E8:E11 <= G8:G11. Keep the variables non-negative and choose Simplex LP.',
      toolSetup: {
        objective: 'B13', sense: 'max', changing: 'B4:D4',
        constraints: [{ lhs: 'E8:E11', relation: '<=', rhs: 'G8:G11' }],
        nonNegative: true, engine: 'simplex',
      },
      answer: { B4: 200, C4: 100, D4: 100, B13: 9000 },
      check: { tol: 1e-4 },
      wrong: ['500'],
      hints: [
        'Data > Solver: Set Objective B13, Max, By Changing Variable Cells B4:D4.',
        'Add one range constraint, E8:E11 <= G8:G11, tick Make Unconstrained Variables Non-Negative and pick Simplex LP.',
      ],
      explain:
        'Solver makes 200 Classic, 100 Pandan and 100 Gula melaka cases for $9,000. One range constraint covers all four limits because Excel compares E8 with G8, E9 with G9 and so on. ' +
        'The model is linear (fixed coefficients times the plan), so Simplex LP finds the exact optimum, at a corner of the feasible region.',
    },
    {
      id: 'unused',
      kind: 'formula',
      cells: 'H8:H11',
      prompt: 'In H8 compute the unused amount of each resource (available minus used) and fill down to H11.',
      solution: '=G8-E8',
      wrong: ['=E8-G8', '=G8-$E$8'],
      hints: ['Available is in column G, used in column E.'],
      explain: 'A limit with nothing unused is binding: it is what stops the plan from growing. Coconut milk, stove time and the Gula melaka limit are binding; packing has 30 hours to spare.',
    },
    {
      id: 'binding',
      kind: 'explain',
      cells: '',
      prompt:
        'Which constraints are binding at the optimum? The owner can buy one more litre of coconut milk, one more stove hour or one more packing hour. ' +
        'Try each one (add 1 to G8, G9 or G10, re-run Solver, note the profit, then undo): which would you advise, and why is packing time not worth buying?',
      answer:
        'Coconut milk (2,500 litres), stove time (300 hours) and the 100-case Gula melaka limit are binding: they are used up, so loosening any of them can raise profit. ' +
        'Packing time has 30 hours unused, so another packing hour adds nothing. Re-running Solver with one more stove hour raises profit by $12, ' +
        'with one more litre of coconut milk by only $2, so the stove hour is the better buy if it costs less than $12.',
    },
  ],
  testCases: [
    { name: 'Gula melaka earns $36 a case', inputs: { D5: 36 } },
    { name: 'Recipes revised', inputs: { B8: 5.5, B9: 0.45, C10: 0.5 } },
    { name: 'More coconut milk and Gula melaka orders', inputs: { G8: 2700, G11: 120 } },
    { name: 'Another production plan', inputs: { B4: 150, C4: 120, D4: 90 } },
  ],
  skills: ['Decision, objective and constraint cells', 'SUMPRODUCT objective and constraint rows', 'Range constraint in Solver', 'Binding vs slack constraints'],
  techniques: [T.solver, T.sumproduct, T.anchors, T.interpret],
}

// ---------- 8. integer class mix (min/max bounds, int) ----------

const classPlan: Exercise = {
  id: 'w3-solver-integer-class-plan',
  week: 'W3',
  topic: 'Integer Solver model',
  title: 'Weekly class plan for a tuition centre',
  level: 2,
  minutes: 22,
  scenario:
    'Bright Minds (fictional), a tuition centre in Toa Payoh, decides how many classes of each course to run each week. Every class brings in fees and uses tutor teaching hours and room hours; ' +
    'each course has a minimum (classes already promised) and a maximum (demand), and the centre runs 15 to 25 classes a week in total. Classes are whole numbers: find the plan with the highest net contribution.',
  sheet: {
    rows: 19,
    cols: 8,
    cells: {
      ...across('B3', ['P6 Maths', 'Sec 4 Chemistry', 'JC Economics', 'Adult Excel', 'Total', 'At least', 'At most'], header),
      A4: label('Classes to run'),
      ...fill('B4:E4', decision()),
      F4: { f: '=SUM(B4:E4)', role: 'given', fmt: WHOLE },
      ...across('G4', [15, 25], input(WHOLE)),
      ...down('A5', ['Minimum classes', 'Maximum classes'], label),
      ...block('B5', [[4, 3, 2, 0], [12, 10, 6, 5]], input(WHOLE)),
      ...down('A8', ['Fee revenue per class ($)', 'Teaching hours per class', 'Room hours per class', 'Direct cost per class ($)'], label),
      ...across('B8', [1500, 1300, 2400, 1500], input('$#,##0')),
      ...block('B9', [[2, 2, 3, 3], [2, 3, 3, 4]], input('0.0')),
      ...across('B11', [400, 800, 700, 500], input('$#,##0')),
      F13: header('Total'),
      H13: header('Available'),
      ...down('A14', ['Fee revenue ($)', 'Teaching hours', 'Room hours', 'Direct cost ($)'], label),
      ...fill('B14:F14', answer('$#,##0')),
      ...fill('B15:F16', answer('#,##0')),
      ...fill('B17:F17', answer('$#,##0')),
      ...fill('G15:G16', label('<=')),
      ...down('H15', [56, 68], input(WHOLE)),
      A19: label('Net contribution ($)'),
      F19: answer('$#,##0'),
      G19: label('maximise'),
    },
    colWidths: { A: 190, C: 120, D: 110, E: 100 },
  },
  tasks: [
    {
      id: 'grid',
      kind: 'formula',
      cells: 'B14:E17',
      prompt: 'In B14 write one formula, classes (row 4) times the per-class figure in the same column (B8), that fills right to column E and down to row 17, giving the revenue, teaching hours, room hours and direct cost of every course.',
      solution: '=B$4*B8',
      check: { absolute: ['B$4'] },
      wrong: ['=B4*B8', '=$B$4*B8', '=B$4*B$8', '=$B4*B8'],
      hints: [
        'Every cell is (classes to run) x (the per-class figure six rows up in the same column).',
        'Filling down, the classes must stay on row 4; filling right, everything must move with the course. Which $ does that?',
      ],
      explain:
        'B$4 locks the row but not the column: filling right picks up C4, D4, E4, filling down stays on row 4, while B8 moves freely to B9, B10 and B11. ' +
        '$B$4 would multiply every course by the P6 Maths classes, and B4 without $ would slide onto the minimum and maximum rows.',
    },
    {
      id: 'totals',
      kind: 'formula',
      cells: 'F14:F17',
      prompt: 'In F14 total the row with `SUM` and fill down to F17.',
      solution: '=SUM(B14:E14)',
      wrong: ['=SUM(B14:D14)', '=SUM($B$14:$E$14)'],
      hints: ['Four courses: columns B to E.'],
      explain:
        'F15 and F16 are the left-hand sides of the teaching-hour and room-hour constraints; F14 and F17 feed the objective. In influence-diagram terms the classes in row 4 ' +
        'are the decisions, rows 5-11 and the limits in G4:H4 and H15:H16 the parameters, rows 14-17 the consequence variables and F19 the performance measure.',
    },
    {
      id: 'net',
      kind: 'formula',
      cells: 'F19',
      prompt: 'In F19 compute the net contribution: total fee revenue minus total direct cost.',
      solution: '=F14-F17',
      wrong: ['=F14+F17', '=F14', '=SUM(F14:F17)'],
      hints: ['Revenue is F14, direct cost F17.'],
      explain: 'F19 is the objective cell. =SUM(F14,-F17) is the same thing written as a sum with a negative term.',
    },
    {
      id: 'solve',
      kind: 'tool',
      tool: 'solver',
      cells: 'B4:E4',
      prompt:
        'Use Solver (Simplex LP) to find the whole-number plan in B4:E4 with the highest net contribution (F19): every course between its minimum and maximum, ' +
        'teaching and room hours within what is available (H15:H16), and the total number of classes (F4) between G4 and H4.',
      toolSetup: {
        objective: 'F19', sense: 'max', changing: 'B4:E4',
        constraints: [
          { lhs: 'B4:E4', relation: '>=', rhs: 'B5:E5' },
          { lhs: 'B4:E4', relation: '<=', rhs: 'B6:E6' },
          { lhs: 'F15', relation: '<=', rhs: 'H15' },
          { lhs: 'F16', relation: '<=', rhs: 'H16' },
          { lhs: 'F4', relation: '>=', rhs: 'G4' },
          { lhs: 'F4', relation: '<=', rhs: 'H4' },
          { lhs: 'B4:E4', relation: 'int' },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { B4: 12, C4: 4, D4: 6, E4: 2, F19: 27400 },
      check: { tol: 1e-4 },
      wrong: ['11'],
      hints: [
        'Set Objective F19, To Max, By Changing Variable Cells B4:E4.',
        'Two range constraints cover every minimum and every maximum at once: B4:E4 >= B5:E5 and B4:E4 <= B6:E6. Then F15 <= H15, F16 <= H16, F4 >= G4 and F4 <= H4.',
        'Add B4:E4 int last: integer constraints only go on the variable cells, never on formulas.',
      ],
      explain:
        'The plan runs 12 P6 Maths, 4 Sec 4 Chemistry, 6 JC Economics and 2 Adult Excel classes for $27,400 a week, using all 56 teaching hours. ' +
        'Solver: Max F19 by changing B4:E4, subject to B4:E4 >= B5:E5, B4:E4 <= B6:E6, F15 <= H15, F16 <= H16, F4 >= G4, F4 <= H4, B4:E4 = integer. ' +
        'In Excel also set Options > Integer Optimality to 0%: with the default tolerance Solver may stop at a whole-number plan that is close to, but not exactly, the best.',
    },
    {
      id: 'why-int',
      kind: 'explain',
      cells: '',
      prompt: 'Without the integer constraint Solver plans 2.67 Adult Excel classes for $27,566.67. Why not just round that plan down, and which limits decide the plan?',
      answer:
        'Rounding the LP plan down to 12, 3, 6 and 2 classes is feasible but earns only $26,900 and leaves 2 teaching hours idle. With B4:E4 integer, Solver earns $27,400 ' +
        'by running a fourth Sec 4 Chemistry class in those 2 hours, so the integer optimum is not the rounded LP answer. Teaching hours are fully used and P6 Maths and JC Economics sit at their maximum demand: ' +
        'more tutor hours or more demand for those courses would pay; room hours (6 spare) and the 25-class limit do not bind.',
    },
    {
      id: 'infeasible',
      kind: 'explain',
      cells: '',
      prompt:
        'The landlord asks for at least 30 classes a week. Type 30 in G4 and 35 in H4, run Solver again and read its message. What does it mean, and why does it happen here? ' +
        'Set G4 and H4 back to 15 and 25 afterwards.',
      answer:
        'Solver could not find a feasible solution: no plan meets every constraint, so there is no feasible region to search. Even with the shortest courses first, ' +
        '30 classes need 12 P6 Maths and 10 Sec 4 Chemistry classes at 2 hours plus 8 more at 3 hours, 24 + 20 + 24 = 68 teaching hours, but only 56 are available ' +
        '(at most 26 classes fit). The fix is in the inputs (more tutor hours or a smaller promise), not in Solver. The other failure, an unbounded model, ' +
        'shows "The Objective Cell values do not converge": a missing limit lets the objective grow without end.',
    },
  ],
  testCases: [
    { name: 'Fees go up', inputs: { B8: 1600, C8: 1400, D8: 2500, E8: 1650 } },
    {
      name: 'Longer classes, higher costs, more hours available',
      inputs: { ...inputs('B9', [[2.5, 2.5, 3.5, 3.5], [2.5, 3.5, 3.5, 4.5], [450, 850, 750, 550]]), H15: 70, H16: 80 },
    },
    { name: 'Another class plan', inputs: { B4: 10, C4: 5, D4: 5, E4: 3 } },
  ],
  skills: ['Mixed reference grid (B$4)', 'Min and max bounds as range constraints', 'Integer constraint', 'LP relaxation vs integer optimum'],
  techniques: [T.solver, T.integer, T.anchors, T.interpret],
}

// ---------- 8b. Solver chooses a price list (lookups feed the model) ----------

// [account, type, kg a month]: chains in rows 10-13, independents in rows 14-17
const BEAN_ACCOUNTS: CellValue[][] = [
  ['Lumen Cafe Group', 'Chain', 520],
  ['Harbourfront Hotel Group', 'Chain', 430],
  ['Kopi Together (6 outlets)', 'Chain', 260],
  ['Orchid Bakery Group', 'Chain', 180],
  ['Joo Chiat Brew Bar', 'Independent', 35],
  ['Tiong Bahru Book Cafe', 'Independent', 60],
  ['Bishan Corner Cafe', 'Independent', 165],
  ['Jurong Lake Coffee Shop', 'Independent', 190],
]
const BEAN_PRICES = [32, 29.5, 27, 25]

const priceList: Exercise = {
  id: 'w3-solver-price-list-cut',
  week: 'W3',
  topic: 'Solver on a price list',
  title: 'A new price list that gives away the least',
  level: 2,
  minutes: 25,
  scenario:
    'BeanRoute Roasters (fictional) sells coffee beans to Singapore cafes at a price per kg that falls with the monthly volume (A4:B7); the band price applies to the whole order. ' +
    'A rival is undercutting it, so BeanRoute will publish one new price list (C4:C7) for every account. The chains want at least 8% off their bills as a group and at least 5% each; ' +
    'independent cafes should save at least 3% as a group. No price may rise, a bigger band may never cost more per kg than a smaller one, and BeanRoute wants to give away as little revenue as possible.',
  sheet: {
    rows: 23,
    cols: 6,
    cells: {
      A1: title('BeanRoute Roasters: a new price list'),
      ...across('A3', ['From (kg a month)', 'Current price ($/kg)', 'New price ($/kg)'], header),
      ...down('A4', [1, 50, 150, 400], given(WHOLE)),
      ...down('B4', BEAN_PRICES, input('$0.00')),
      ...down('C4', BEAN_PRICES, (v) => decision('$0.00', v)),
      ...across('A9', ['Account', 'Type', 'Beans (kg a month)', 'Current bill ($)', 'New bill ($)', 'Drop'], header),
      ...block('A10', BEAN_ACCOUNTS.map((r) => r.slice(0, 2)), given()),
      ...down('C10', BEAN_ACCOUNTS.map((r) => r[2]), input(WHOLE)),
      ...fill('D10:E17', answer(MONEY)),
      ...fill('F10:F17', answer('0.0%')),
      ...across('A19', ['Accounts', 'Current revenue ($)', 'New revenue ($)', 'Drop', 'Target: at least'], header),
      ...down('A20', ['Chains (as a group)', 'Independents (as a group)', 'All accounts'], label),
      ...fill('B20:C22', answer(MONEY)),
      ...fill('D20:D22', answer('0.00%')),
      ...down('E20', [0.08, 0.03], input('0%')),
      E22: label('(minimise D22)'),
      A23: label('Each chain on its own bill'),
      E23: input('0%')(0.05),
    },
    colWidths: { A: 200, B: 165, C: 150, D: 130, E: 130, F: 80 },
  },
  tasks: [
    {
      id: 'current',
      kind: 'formula',
      cells: 'D10:D17',
      prompt:
        'In D10 compute the account\'s current monthly bill: its kilograms (C10) times the current price of the band it falls in, found with an approximate `VLOOKUP` on A4:B7. Fill down to D17.',
      solution: '=C10*VLOOKUP(C10,$A$4:$B$7,2,TRUE)',
      check: { tol: 0.005 },
      wrong: [
        '=C10*VLOOKUP(C10,$A$4:$B$7,2,FALSE)',
        '=VLOOKUP(C10,$A$4:$B$7,2,TRUE)',
        '=C10*VLOOKUP(C10,A4:B7,2,TRUE)',
        '=C10*VLOOKUP(C10,$A$4:$C$7,3,TRUE)',
      ],
      hints: [
        'The price depends on the band, and the band on the kilograms: look C10 up in the band starts A4:A7.',
        'TRUE (or leaving it out) finds the largest band start at or below the kilograms: 260 kg falls in the 150 kg band.',
        'Kilograms times VLOOKUP(C10, the anchored table $A$4:$B$7, 2, TRUE).',
      ],
      explain:
        'Kopi Together buys 260 kg at $27.00 = $7,020.00 a month. Every kilogram of an order pays its band\'s price, and the table must be anchored so the formula fills down. ' +
        'An exact match (FALSE) finds only orders of exactly 1, 50, 150 or 400 kg.',
    },
    {
      id: 'new',
      kind: 'formula',
      cells: 'E10:E17',
      prompt:
        'In E10 compute the bill at the new prices in C4:C7 with the same kind of lookup, and fill down to E17. ' +
        '(The new prices start equal to the current ones, so for now E10 shows the same as D10.)',
      solution: '=C10*VLOOKUP(C10,$A$4:$C$7,3,TRUE)',
      check: { tol: 0.005 },
      wrong: ['=D10', '=C10*VLOOKUP(C10,$A$4:$C$7,2,TRUE)', '=C10*VLOOKUP(C10,$C$4:$C$7,1,TRUE)'],
      hints: [
        'Same band, different price column: the new prices sit in column C.',
        'Widen the anchored table to $A$4:$C$7 and return its 3rd column.',
      ],
      explain:
        'The lookup reads the kilograms, which Solver never changes, so each new bill is a fixed quantity times one of the four new prices. ' +
        'The whole model is therefore linear in C4:C7, and Simplex LP can solve it although every bill comes from a VLOOKUP.',
    },
    {
      id: 'drop',
      kind: 'formula',
      cells: 'F10:F17',
      prompt: 'In F10 compute how much the account\'s bill falls, as a share of its current bill, and fill down to F17.',
      solution: '=(D10-E10)/D10',
      wrong: ['=(E10-D10)/D10', '=(D10-E10)/E10', '=D10-E10', '=E10/D10'],
      hints: ['A drop is (old - new) / old.', 'The cell is formatted as a percentage: a new bill at 95% of the old one shows 5.0%.'],
      explain:
        '(D10-E10)/D10 compares the saving with the current bill. Every drop is 0% until Solver changes the prices; F10:F13 become the left-hand sides of the 5%-per-chain rule.',
    },
    {
      id: 'totals',
      kind: 'formula',
      cells: 'B20:C22',
      prompt:
        'In B20:C22 total the current and the new revenue of the chains (rows 10-13), the independents (rows 14-17) and all eight accounts.',
      solutions: {
        B20: '=SUM(D10:D13)', C20: '=SUM(E10:E13)',
        B21: '=SUM(D14:D17)', C21: '=SUM(E14:E17)',
        B22: '=SUM(D10:D17)', C22: '=SUM(E10:E17)',
      },
      check: { tol: 0.005 },
      wrong: ['=SUM(D10:D17)', '=SUM(D10:D12)', '=SUM(E10:E13)'],
      hints: ['The chains are rows 10-13 and the independents rows 14-17.', 'B20 = SUM(D10:D13) fills right to C20; row 22 adds all eight accounts.'],
      explain: 'The chains spend $35,630.00 a month and the independents $12,475.00: $48,105.00 in all. Keeping each group in one block of rows lets one SUM per group do the work.',
    },
    {
      id: 'gdrop',
      kind: 'formula',
      cells: 'D20:D22',
      prompt: 'In D20 compute the chains\' drop in revenue, (current - new) / current, and fill down to D22.',
      solution: '=(B20-C20)/B20',
      wrong: ['=(C20-B20)/B20', '=(B20-C20)/C20', '=B20-C20'],
      hints: ['The same (old - new) / old as column F, on the group totals.'],
      explain:
        'D20 and D21 are the left-hand sides of the group targets in E20:E21, and D22 is the objective Solver will minimise. ' +
        'D22 is not the average of the account drops: big bills weigh more.',
    },
    {
      id: 'solve',
      kind: 'tool',
      tool: 'solver',
      cells: 'C4:C7',
      prompt:
        'Use Solver (Simplex LP) to choose the new prices C4:C7 that give away the least revenue overall (minimise D22), while: no new price is above the current one; ' +
        'each band costs no more per kg than the band before it; each group\'s drop reaches its target in E20:E21; and every chain saves at least E23 on its own bill.',
      toolSetup: {
        objective: 'D22', sense: 'min', changing: 'C4:C7',
        constraints: [
          { lhs: 'C4:C7', relation: '<=', rhs: 'B4:B7' },
          { lhs: 'C5:C7', relation: '<=', rhs: 'C4:C6' },
          { lhs: 'D20:D21', relation: '>=', rhs: 'E20:E21' },
          { lhs: 'F10:F13', relation: '>=', rhs: 'E23' },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { C4: 32, C5: 29.5, C6: 25.65, C7: 25 - 2256.4 / 950, D22: 3329.65 / 48105 },
      check: { tol: 1e-4 },
      wrong: ['27'],
      hints: [
        'Set Objective D22, To Min, By Changing Variable Cells C4:C7 (they start at the current prices).',
        'Price rules: C4:C7 <= B4:B7, and C5:C7 <= C4:C6, which compares each band\'s new price with the one above it.',
        'Targets: D20:D21 >= E20:E21 for the groups and F10:F13 >= E23 for each chain. Tick Make Unconstrained Variables Non-Negative and choose Simplex LP.',
      ],
      explain:
        'Solver: Min D22 by changing C4:C7, subject to C4:C7 <= B4:B7, C5:C7 <= C4:C6, D20:D21 >= E20:E21 and F10:F13 >= E23 (Simplex LP). ' +
        'New prices: $32.00, $29.50, $25.65 and $22.62 a kg, an overall drop of 6.92%. The 150 kg band falls exactly 5%, the least the two chains buying in it accept, ' +
        'and the 400 kg band falls far enough to bring the chains as a group to 8%; the two small bands keep their current prices.',
    },
    {
      id: 'read',
      kind: 'explain',
      cells: '',
      prompt:
        'Read the answer: which targets bind and which are beaten? The independents were promised 3%: how much do they get, and why? ' +
        'Could any single price list give the chains in the 150 kg band their 5% without helping independents?',
      answer:
        'The chains\' 8% group target binds, and so does the 5% of the two chains in the 150 kg band (Kopi Together and Orchid Bakery); the two big chains get 9.5%. ' +
        'The independents save 3.84% ($479.25 a month), more than the 3% promised: Bishan Corner Cafe and Jurong Lake Coffee Shop buy in the same 150 kg band, ' +
        'so the 5% cut there reaches them too. With one price per band the discount cannot be aimed at the chains alone; only different band limits or a separate price list could. ' +
        '"No price may rise" also binds for the 1 kg and 50 kg bands: without it, Solver would win revenue back by raising the 50 kg price.',
    },
  ],
  testCases: [
    { name: 'Other monthly volumes', inputs: inputsDown('C10', [600, 380, 400, 150, 20, 149, 50, 210]) },
    { name: 'Current prices revised', inputs: inputsDown('B4', [33, 30, 27.5, 25.5]) },
    { name: 'Another new price list', inputs: inputsDown('C4', [31, 29, 26, 23.5]) },
  ],
  skills: [
    'Quantity times an approximate VLOOKUP', 'Decision cells inside a lookup table', 'Percentage-drop constraints',
    'Constraints between decision cells (C5:C7 <= C4:C6)', 'Reading binding and beaten targets',
  ],
  techniques: [T.solver, T.bracket, T.anchors, T.interpret],
}

// ---------- 9. two-way INDEX/MATCH rate card ----------

const ZONES = ['Central', 'East', 'North', 'West', 'Islands']
const RATES = [
  [5.5, 6.0, 6.5, 6.8, 12.0],
  [7.0, 7.6, 8.4, 8.2, 14.5],
  [9.5, 10.2, 11.3, 11.0, 17.8],
  [13.0, 14.1, 15.6, 15.2, 22.4],
  [19.0, 20.6, 22.5, 23.0, 30.5],
  [28.0, 30.2, 33.0, 32.4, 42.0],
]

const courier: Exercise = {
  id: 'w3-two-way-courier-rates',
  week: 'W3',
  topic: 'Two-way INDEX/MATCH',
  title: 'Price parcels from a weight-by-zone rate card',
  level: 2,
  minutes: 15,
  scenario:
    'SwiftParcel SG (fictional) charges by weight band and delivery zone: the rate card C5:G10 lists each band by its lower bound in kg (B5:B10) and each zone in C4:G4. ' +
    'A flat-price Big Box (row 11) carries anything up to 30 kg to a zone. Price this morning\'s eight parcels; the customer always pays the cheaper option.',
  sheet: {
    rows: 23,
    cols: 7,
    cells: {
      A3: title('Rate card ($)'),
      B4: header('From (kg)'),
      ...across('C4', ZONES, header),
      ...down('A5', ['Under 1 kg', '1 to under 3 kg', '3 to under 5 kg', '5 to under 10 kg', '10 to under 20 kg', '20 kg and over'], label),
      ...down('B5', [0, 1, 3, 5, 10, 20], given('0')),
      ...block('C5', RATES, input('$0.00')),
      A11: label('Big Box (any weight to 30 kg)'),
      ...across('C11', [18, 19.5, 21, 20.5, 28], input('$0.00')),
      ...across('A13', ['Parcel', 'Weight (kg)', 'Zone', 'Rate card fee ($)', 'Big Box fee ($)', 'Charge ($)'], header),
      ...down('A14', ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], given()),
      ...down('B14', [0.8, 3, 12.5, 4.2, 25, 7.9, 1.5, 19.99], input('0.00')),
      ...down('C14', ['East', 'North', 'West', 'Central', 'Islands', 'North', 'Islands', 'Central'], input()),
      ...fill('D14:F21', answer('$0.00')),
      A23: label('Total charges ($)'),
      F23: answer(MONEY),
    },
    colWidths: { A: 190, D: 145, E: 130, F: 100 },
  },
  tasks: [
    {
      id: 'fee',
      kind: 'formula',
      cells: 'D14:D21',
      prompt: 'In D14 return the rate-card fee with `INDEX` over $C$5:$G$10, a `MATCH` on the weight bands $B$5:$B$10 and a `MATCH` on the zone names $C$4:$G$4. Fill down to D21.',
      solution: '=INDEX($C$5:$G$10,MATCH(B14,$B$5:$B$10,1),MATCH(C14,$C$4:$G$4,0))',
      check: { mustUse: ['INDEX', 'MATCH'], absolute: ['$C$5:$G$10', '$B$5:$B$10', '$C$4:$G$4'] },
      wrong: [
        '=INDEX($C$5:$G$10,MATCH(B14,$B$5:$B$10,0),MATCH(C14,$C$4:$G$4,0))',
        '=INDEX($C$5:$G$10,MATCH(C14,$C$4:$G$4,0),MATCH(B14,$B$5:$B$10,1))',
        '=INDEX($C$5:$G$10,MATCH(B14,$B$5:$B$10,1),MATCH(C14,$C$4:$G$4,1))',
        '=INDEX(C5:G10,MATCH(B14,B5:B10,1),MATCH(C14,C4:G4,0))',
      ],
      hints: [
        '`INDEX(array, row_num, column_num)` needs two positions: let one `MATCH` find the weight band and another the zone.',
        'The weight falls between band starts, so its MATCH is approximate (type 1); a zone name must match exactly (type 0).',
        'Anchor the grid and both lookup ranges with $ before filling down.',
      ],
      explain:
        'The weight falls between band starts, so MATCH type 1 picks the largest lower bound at or below it (12.5 kg -> the 10 kg row); it needs the bounds ascending from 0. ' +
        'Zone names must match exactly: MATCH type 1 on unsorted text returns a wrong column without any warning, and type 0 on the weight finds nothing for 0.8 kg (#N/A).',
    },
    {
      id: 'box',
      kind: 'formula',
      cells: 'E14:E21',
      prompt: 'In E14 return the Big Box price for the parcel\'s zone from C11:G11. Only the column changes, so one `MATCH` is enough. Fill down to E21.',
      solution: '=INDEX($C$11:$G$11,1,MATCH(C14,$C$4:$G$4,0))',
      wrong: ['=INDEX($C$11:$G$11,1,MATCH(C14,$C$4:$G$4,1))', '=INDEX($C$5:$G$11,1,MATCH(C14,$C$4:$G$4,0))', '=HLOOKUP(C14,$C$4:$G$11,7,FALSE)'],
      hints: ['Row 11 is a single row: only the zone decides which price applies.', 'INDEX(result_array, 1, MATCH(...)) takes the column number from an exact MATCH on the zone.'],
      explain:
        'With a one-row array INDEX needs only the column position. HLOOKUP(C14,$C$4:$G$11,8,FALSE) gives the same price by counting 8 rows down from the zone headers.',
    },
    {
      id: 'charge',
      kind: 'formula',
      cells: 'F14:F21',
      prompt: 'In F14 charge the cheaper of the two options and fill down to F21.',
      solution: '=MIN(D14,E14)',
      wrong: ['=MAX(D14,E14)', '=MIN($D$14,$E$14)'],
      hints: ['The customer pays whichever fee is lower.'],
      explain: 'MIN picks the cheaper option row by row, so the customer never pays more than the lower of the two fees.',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'F23',
      prompt: 'In F23 total the charges.',
      solution: '=SUM(F14:F21)',
      wrong: ['=SUM(D14:D21)', '=SUM(F14:F20)'],
      hints: ['Add up F14:F21.'],
      explain: 'The eight parcels cost $123.40: $17.50 less than the rate card alone ($140.90), because the Big Box wins three times.',
    },
    {
      id: 'read',
      kind: 'explain',
      cells: '',
      prompt: 'Which parcels go cheaper by Big Box, and what do they have in common? Why would MATCH type 1 on the zone names be dangerous?',
      answer:
        'P3 (West, 12.5 kg: $20.50 instead of $23.00), P5 (Islands, 25 kg: $28.00 instead of $42.00) and P8 (Central, 19.99 kg: $18.00 instead of $19.00) go by Big Box: ' +
        'heavy parcels, 10 kg and over, where the flat price undercuts the weight bands. The zone names are not sorted, so an approximate MATCH would return some column ' +
        'without any error and quietly charge the wrong zone; only an exact match (0) is safe for names.',
    },
  ],
  testCases: [
    {
      name: 'Eight other parcels',
      inputs: { ...inputsDown('B14', [2.5, 0.3, 5, 28, 9.99, 1, 15, 3.7]), ...inputsDown('C14', ['West', 'Central', 'Islands', 'East', 'Central', 'West', 'East', 'Islands']) },
    },
    { name: 'Rates and Big Box prices revised', inputs: { ...inputs('C5', RATES.map((r) => r.map((v) => v + 0.5))), ...inputs('C11', [[17, 18.5, 20, 19.5, 26]]) } },
  ],
  skills: ['Two-way INDEX/MATCH', 'Approximate MATCH on lower bounds', 'Exact MATCH on names', 'INDEX with a column from MATCH', 'MIN for the cheaper option'],
  techniques: [T.twoWay, T.bracket, T.interpret],
}

// ---------- 10. all-units price breaks ----------

const toteBags: Exercise = {
  id: 'w3-price-breaks-tote-bags',
  week: 'W3',
  topic: 'Quantity price breaks',
  title: 'When 250 bags cost less than 230',
  level: 2,
  minutes: 12,
  scenario:
    'InkSprint (fictional), a print shop in Bukit Merah, sells custom tote bags at an all-units price: the unit price of the band an order falls in applies to every bag. ' +
    'Its price list (A4:B9) is keyed by the smallest order of each band. Price this week\'s eight orders, then look at what happens just below a price break.',
  sheet: {
    rows: 20,
    cols: 7,
    cells: {
      ...across('A3', ['Bags from', 'Unit price ($)'], header),
      ...down('A4', [1, 100, 250, 500, 1000, 2500], given(WHOLE)),
      ...down('B4', [6.8, 5.9, 5.2, 4.6, 4.1, 3.7], input('$0.00')),
      ...across('A12', ['Customer', 'Bags', 'Unit price ($)', 'Charge ($)'], header),
      ...down('A13', ['Seng Kang PTA', 'Orchid Weddings', 'Kopi and Co', 'Marina Run Club', 'Tiong Bahru Market', 'Hall Seven Committee', 'FinTech Week', 'Green Grocer'], given()),
      ...down('B13', [80, 99, 100, 240, 250, 499, 520, 1200], input(WHOLE)),
      ...fill('C13:C20', answer('$0.00')),
      ...fill('D13:D20', answer(MONEY)),
      F12: header('Price break at 250 bags'),
      F13: label('Dearer than 250 bags from'),
      G13: answer(WHOLE),
    },
    colWidths: { A: 170, C: 120, D: 110, F: 190 },
  },
  tasks: [
    {
      id: 'price',
      kind: 'formula',
      cells: 'C13:C20',
      prompt: 'In C13 look up the unit price for the order in B13 with an approximate-match `VLOOKUP` on the price list $A$4:$B$9, and fill down to C20.',
      solution: '=VLOOKUP(B13,$A$4:$B$9,2,TRUE)',
      check: { mustUse: ['VLOOKUP'], absolute: ['$A$4:$B$9'] },
      wrong: ['=VLOOKUP(B13,$A$4:$B$9,2,FALSE)', '=VLOOKUP(B13,A4:B9,2,TRUE)', '=VLOOKUP(B13,$A$4:$B$9,1,TRUE)'],
      hints: [
        'The list is keyed by the smallest order of each band and sorted ascending: exactly what VLOOKUP with TRUE needs.',
        'FALSE would only find orders of exactly 1, 100, 250 ... bags.',
      ],
      explain:
        'VLOOKUP(B13,$A$4:$B$9,2,TRUE) returns the price of the largest band start at or below the order: 240 bags pay $5.90 each, 250 bags $5.20. Leaving out the 4th argument is the same as TRUE.',
    },
    {
      id: 'charge',
      kind: 'formula',
      cells: 'D13:D20',
      prompt: 'In D13 compute the charge (bags times unit price) and fill down to D20.',
      solution: '=B13*C13',
      check: { tol: 0.005 },
      wrong: ['=B13*$C$13', '=C13'],
      hints: ['Every bag in the order pays the same unit price.'],
      explain: 'Compare the rows: 99 bags cost $673.20 but 100 bags only $590.00, and 240 bags cost more than 250. That is the price break at work.',
    },
    {
      id: 'dearer',
      kind: 'value',
      cells: 'G13',
      prompt: '250 bags cost $1,300.00. In G13 type the smallest order size (in bags) that costs MORE than 250 bags.',
      answer: 221,
      wrong: ['220', '249'],
      hints: [
        'Below 250 bags every bag costs $5.90.',
        'Solve n x 5.90 > 1,300 for the smallest whole n.',
        'Check it as a what-if: type your answer, then one bag less, into B16 and compare D16 with $1,300.00. Set B16 back to 240 afterwards.',
      ],
      explain: '1,300 / 5.90 = 220.3, so 221 bags cost $1,303.90, more than 250 bags. Every order from 221 to 249 bags pays more than the bigger order of 250.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt: 'A customer wants 230 bags. What should the shop tell her, and how could the price list stop this from happening?',
      answer:
        '230 bags cost 230 x $5.90 = $1,357.00 but 250 bags cost only $1,300.00, so she should order 250: 20 more bags for $57 less. Any order from 221 to 249 bags is dearer than 250 bags, ' +
        'and similar dead zones sit below every break of an all-units price list. The shop could charge never more than the next break costs (the MIN of the two charges), ' +
        'or switch to incremental pricing, where the lower price applies only to the bags above each break.',
    },
  ],
  testCases: [
    { name: 'New price list', inputs: inputsDown('B4', [6.5, 5.8, 5.0, 4.5, 3.9, 3.5]) },
    { name: 'Other order sizes', inputs: inputsDown('B13', [150, 260, 1, 2500, 999, 600, 75, 640]) },
  ],
  skills: ['VLOOKUP approximate match (TRUE)', 'All-units price breaks', 'Breakpoint reasoning'],
  techniques: [T.bracket, T.whatIf, T.interpret],
}

// ---------- 11. exam-style: catering order calculator ----------

const MENU: CellValue[][] = [
  ['T07', 'Beef rendang'],
  ['T02', 'Mee goreng'],
  ['T10', 'Teh tarik urn'],
  ['T04', 'Curry puffs (30)'],
  ['T01', 'Nasi lemak'],
  ['T09', 'Fruit platter'],
  ['T05', 'Otah wraps'],
  ['T03', 'Chicken satay (50)'],
  ['T08', 'Kueh platter'],
  ['T06', 'Fried bee hoon'],
]

const catering: Exercise = {
  id: 'w3-exam-catering-order',
  week: 'W3',
  topic: 'Exam: lookup model',
  title: 'Exam-style: a catering order calculator',
  level: 3,
  minutes: 30,
  scenario:
    'Saffron Table Catering (fictional) delivers party trays across Singapore. Table 1 (A4:D14) is the menu, Table 2 (F4:H9) the bulk discount on the order subtotal, printed as text bands, ' +
    'and Table 3 (F11:J14) the delivery fee by region and by the amount after discount. Build the order calculator at exactly these addresses, as in the exam: ' +
    'formulas in the yellow cells unless a value is asked for.',
  sheet: {
    rows: 33,
    cols: 10,
    cells: {
      A1: title('Saffron Table Catering: order calculator'),
      A3: title('Table 1: Menu'),
      F3: title('Table 2: Bulk discount'),
      F10: title('Table 3: Delivery fee ($)'),
      A16: title('Order lines'),
      ...across('A4', ['Code', 'Tray', 'Price ($)', 'Serves'], header),
      ...block('A5', MENU, given()),
      ...down('C5', [88, 58, 60, 42, 68, 52, 64, 75, 46, 55], input(MONEY)),
      ...down('D5', [12, 10, 20, 15, 10, 12, 12, 12, 15, 10], given('0')),
      ...across('F4', ['Subtotal band', 'From ($)', 'Discount'], header),
      ...down('F5', ['Below $500', '$500 to $1,499.99', '$1,500 to $2,499.99', '$2,500 to $3,999.99', '$4,000 and above'], given()),
      ...fill('G5:G9', answer(WHOLE)),
      ...down('H5', [0, 0.03, 0.05, 0.08, 0.1], input('0%')),
      ...across('F11', ['After discount ($)', 'Central', 'East', 'North', 'West'], header),
      ...down('F12', [0, 1000, 2000], given(WHOLE)),
      ...block('G12', [[35, 40, 45, 48], [20, 25, 30, 32], [0, 0, 10, 12]], input(MONEY)),
      ...across('A17', ['Line', 'Code', 'Trays', 'Line total ($)'], header),
      ...down('A18', [1, 2, 3, 4, 5, 6], given('0')),
      ...down('B18', ['T01', 'T03', 'T08', 'T09', 'T10', 'T05'], input()),
      ...down('C18', [8, 6, 5, 5, 5, 9], input('0')),
      ...fill('D18:D23', answer(MONEY)),
      A26: label('Delivery region'),
      D26: input()('North'),
      ...down('A27', ['Subtotal ($)', 'Discount rate', 'Amount after discount ($)', 'Delivery fee ($)', 'Total payable ($)'], label),
      D27: answer(MONEY),
      D28: answer('0%'),
      ...fill('D29:D31', answer(MONEY)),
      A33: label('What-if: total payable with 8 satay trays ($)'),
      D33: answer(MONEY),
    },
    colWidths: { B: 140, E: 24, F: 150 },
  },
  tasks: [
    {
      id: 'line',
      kind: 'formula',
      cells: 'D18:D23',
      prompt: '(a) In D18 compute the line total: trays times the price of the code in B18, looked up exactly in the menu. Fill down to D23.',
      solution: '=C18*VLOOKUP(B18,$A$5:$D$14,3,FALSE)',
      wrong: ['=C18*VLOOKUP(B18,$A$5:$D$14,3,TRUE)', '=C18*VLOOKUP(B18,$A$5:$D$14,2,FALSE)', '=C18*VLOOKUP(B18,A5:D14,3,FALSE)'],
      hints: ['The menu codes are not sorted: exact match.', 'Price is the 3rd column of A5:D14; anchor the menu before filling down.'],
      explain: 'Line totals 544, 450, 230, 260, 300 and 576 dollars. INDEX/MATCH or XLOOKUP on the code work just as well; an approximate match on unsorted codes would price the wrong trays.',
    },
    {
      id: 'bounds',
      kind: 'value',
      cells: 'G5:G9',
      prompt: '(b) The discount bands in F5:F9 are text. Type the lower bound of each band into G5:G9 so the table can be searched.',
      answer: { G5: 0, G6: 500, G7: 1500, G8: 2500, G9: 4000 },
      wrong: ['499.99', '500'],
      hints: ['Each band starts at a round amount: the smallest subtotal it covers.', 'Below $500 starts at 0.'],
      explain: 'Lower bounds 0, 500, 1,500, 2,500 and 4,000, ascending, turn the printed bands into a bracket table that an approximate match can read.',
    },
    {
      id: 'subtotal',
      kind: 'formula',
      cells: 'D27',
      prompt: '(c) In D27 compute the order subtotal.',
      solution: '=SUM(D18:D23)',
      wrong: ['=SUM(D18:D22)', '=SUMPRODUCT(C18:C23,C5:C10)'],
      hints: ['Add the six line totals.'],
      explain: '$2,360.00. SUMPRODUCT(C18:C23,C5:C10) would pair the order lines with the first six menu rows by position: a different tray order, so wrong prices.',
    },
    {
      id: 'disc',
      kind: 'formula',
      cells: 'D28',
      prompt: '(d) In D28 look up the discount rate for the subtotal in your bracket table G5:H9.',
      solution: '=VLOOKUP(D27,$G$5:$H$9,2,TRUE)',
      wrong: ['=VLOOKUP(D27,$G$5:$H$9,2,FALSE)', '=VLOOKUP(D27,$F$5:$H$9,3,TRUE)', '=VLOOKUP(D27,$G$5:$H$9,1,TRUE)'],
      hints: ['$2,360 sits between two bounds: an approximate match is needed.', 'LOOKUP(D27,G5:G9,H5:H9) or INDEX/MATCH type 1 are equivalent.'],
      explain: '5%: 2,360 lies in the $1,500 to $2,499.99 band. With FALSE only a subtotal of exactly 0, 500, 1,500 ... would find a rate.',
    },
    {
      id: 'after',
      kind: 'formula',
      cells: 'D29',
      prompt: '(e) In D29 compute the amount after discount.',
      solution: '=D27*(1-D28)',
      wrong: ['=D27*D28', '=D27-D28'],
      hints: ['A 5% discount leaves 95% of the subtotal.'],
      explain: '$2,242.00 = 2,360 x (1 - 5%).',
    },
    {
      id: 'fee',
      kind: 'formula',
      cells: 'D30',
      prompt: '(f) In D30 look up the delivery fee for the region in D26 and the amount after discount, from Table 3 (G12:J14).',
      solution: '=INDEX($G$12:$J$14,MATCH(D29,$F$12:$F$14,1),MATCH(D26,$G$11:$J$11,0))',
      wrong: [
        '=INDEX($G$12:$J$14,MATCH(D27,$F$12:$F$14,1),MATCH(D26,$G$11:$J$11,0))',
        '=INDEX($G$12:$J$14,MATCH(D29,$F$12:$F$14,0),MATCH(D26,$G$11:$J$11,0))',
        '=INDEX($G$12:$J$14,MATCH(D26,$G$11:$J$11,0),MATCH(D29,$F$12:$F$14,1))',
        '=VLOOKUP(D29,$F$12:$J$14,4,TRUE)',
      ],
      hints: ['Row: an approximate MATCH of the amount after discount on F12:F14. Column: an exact MATCH of the region on G11:J11.', 'The table is keyed on the amount AFTER discount, D29.'],
      explain:
        '$10.00: $2,242.00 falls in the $2,000 row and North is the 3rd column. Using the subtotal D27 gives the same fee here, but not for an order of $2,052, ' +
        'whose amount after discount ($1,949.40) drops into the $1,000 row. The same two-way lookup can be written with VLOOKUP, letting MATCH supply the column number: ' +
        '=VLOOKUP(D29,$F$12:$J$14,MATCH(D26,$F$11:$J$11,0),TRUE).',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'D31',
      prompt: '(g) In D31 compute the total payable.',
      solution: '=D29+D30',
      wrong: ['=D27+D30', '=D29'],
      hints: ['Amount after discount plus delivery.'],
      explain: '$2,252.00 = 2,242 + 10.',
    },
    {
      id: 'whatif',
      kind: 'value',
      cells: 'D33',
      prompt: '(h) Change line 2 (C19) to 8 trays of satay, read the total payable, type it into D33 as a number, then set C19 back to 6.',
      answer: 2319.2,
      check: { tol: 0.005 },
      wrong: ['2394.5', '2252'],
      hints: ['The subtotal becomes $2,510: which discount band is that?', 'Then check which delivery row the new amount after discount falls in.'],
      explain: '$2,319.20: the subtotal of $2,510 earns 8%, leaving $2,309.20 after discount, still in the $2,000 delivery row ($10).',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt:
        '(i) Compare D33 with D31: two more satay trays add $150 of food, so why does the total payable rise by much less? ' +
        'Explain, and say what the caterer might tell clients whose subtotal is just under $2,500.',
      answer:
        'The extra $150 lifts the subtotal from $2,360 to $2,510, into the 8% band, and the discount applies to the whole order: 8% of $2,510 is $200.80 against 5% of $2,360 = $118.00. ' +
        'The order gains $150 of food and $82.80 more discount, a net $67.20. Clients just below a band can add food for much less than its price, so the caterer can suggest topping up; ' +
        'the delivery fee is based on the amount after discount ($2,309.20), which stays in the $2,000 row.',
    },
  ],
  testCases: [
    { name: 'A different order', inputs: { ...inputsDown('B18', ['T07', 'T02', 'T04', 'T06', 'T03', 'T10']), ...inputsDown('C18', [6, 7, 9, 5, 3, 4]) } },
    { name: 'Delivery to the West', inputs: { D26: 'West' } },
    { name: 'Discount rates revised', inputs: inputsDown('H5', [0, 0.04, 0.06, 0.09, 0.12]) },
  ],
  skills: ['Exact lookup in a formula', 'Text bands to lower bounds', 'Approximate VLOOKUP', 'Two-way INDEX/MATCH', 'What-if at a bracket boundary'],
  techniques: [T.bounds, T.bracket, T.twoWay, T.whatIf, T.interpret],
}

// ---------- 12. exam-style: allocation LP fed by a lookup ----------

const OUTLET_NAMES = ['Jurong East', 'Woodlands', 'Tampines', 'Bishan']

const chilled: Exercise = {
  id: 'w3-exam-chilled-allocation',
  week: 'W3',
  topic: 'Exam: LP allocation',
  title: 'Exam-style: ship chilled cartons at the lowest cost',
  level: 3,
  minutes: 30,
  scenario:
    'FrostLink Logistics (fictional) trucks chilled cartons from warehouses in Tuas and Changi to four supermarket outlets. Table 1 (B4:E5) gives the road distances, ' +
    'Table 2 (G4:H8) the freight rate per carton by distance band. Each warehouse can ship a limited number of cartons a day (G13:G14) and every outlet must receive its demand (B16:E16). ' +
    'Answer at exactly these addresses, as in the exam.',
  sheet: {
    rows: 20,
    cols: 8,
    cells: {
      A1: title('FrostLink Logistics: daily carton plan'),
      A2: title('Table 1: Road distances'),
      G2: title('Table 2: Freight rates'),
      A3: header('Distance (km)'),
      ...across('B3', OUTLET_NAMES, header),
      ...down('A4', ['Tuas', 'Changi'], label),
      ...block('B4', [[12, 24, 41, 27], [33, 30, 9, 18]], given('0')),
      ...across('G3', ['From (km)', 'Rate ($/carton)'], header),
      ...down('G4', [0, 10, 20, 30, 40], given('0')),
      ...down('H4', [1.2, 1.6, 2.1, 2.7, 3.3], input('$0.00')),
      A7: header('Cost per carton ($)'),
      ...across('B7', OUTLET_NAMES, header),
      ...down('A8', ['Tuas', 'Changi'], label),
      ...fill('B8:E9', answer('$0.00')),
      A12: header('Cartons shipped'),
      ...across('B12', [...OUTLET_NAMES, 'Shipped', 'Capacity', 'Unused'], header),
      ...down('A13', ['Tuas', 'Changi', 'Received', 'Demand'], label),
      ...fill('B13:E14', decision()),
      ...fill('F13:F14', answer(WHOLE)),
      ...down('G13', [900, 600], input(WHOLE)),
      ...fill('H13:H14', answer(WHOLE)),
      ...fill('B15:E15', answer(WHOLE)),
      ...across('B16', [350, 420, 380, 300], input(WHOLE)),
      A18: label('Total freight cost ($)'),
      B18: answer(MONEY),
      A20: label('Served by both'),
      B20: answer(),
    },
    colWidths: { A: 170, G: 90, H: 120 },
  },
  tasks: [
    {
      id: 'cost',
      kind: 'formula',
      cells: 'B8:E9',
      prompt: '(a) In B8 look up the freight rate for the distance in B4 from Table 2, in one formula that fills right to E8 and down to E9.',
      solution: '=LOOKUP(B4,$G$4:$G$8,$H$4:$H$8)',
      wrong: ['=LOOKUP(B4,G4:G8,H4:H8)', '=LOOKUP(B4,G$4:G$8,H$4:H$8)', '=VLOOKUP(B4,$G$4:$H$8,2,FALSE)', '=LOOKUP($B$4,$G$4:$G$8,$H$4:$H$8)'],
      hints: ['The distance moves with the route (relative B4); the rate table must not move at all.', 'Distances fall between band starts: an approximate lookup.'],
      explain:
        'Tuas costs $1.60, $2.10, $3.30 and $2.10 a carton to the four outlets; Changi $2.70, $2.70, $1.20 and $1.60. Filling right as well as down is why the table needs $ on both row and column.',
    },
    {
      id: 'shipped',
      kind: 'formula',
      cells: 'F13:F14',
      prompt: '(b) In F13 total the cartons each warehouse ships and fill down to F14.',
      solution: '=SUM(B13:E13)',
      wrong: ['=SUM(B13:D13)', '=SUM(B13:B14)'],
      hints: ['Add across the warehouse\'s row.'],
      explain: 'F13:F14 are the left-hand sides of the capacity constraints.',
    },
    {
      id: 'received',
      kind: 'formula',
      cells: 'B15:E15',
      prompt: '(c) In B15 total the cartons each outlet receives and fill right to E15.',
      solution: '=SUM(B13:B14)',
      wrong: ['=SUM(B13:E13)', '=SUM(B13:B16)'],
      hints: ['Add down the outlet\'s column, warehouses only.'],
      explain: 'B15:E15 are the left-hand sides of the demand constraints.',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'B18',
      prompt: '(d) In B18 compute the total freight cost of the plan with `SUMPRODUCT`.',
      solution: '=SUMPRODUCT(B8:E9,B13:E14)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(B8:E8,B13:E13)', '=SUM(B8:E9)*SUM(B13:E14)', '=SUMPRODUCT(B4:E5,B13:E14)'],
      hints: ['SUMPRODUCT works on two blocks of the same shape: cost per carton times cartons, route by route.'],
      explain: 'One SUMPRODUCT over the 2 x 4 blocks adds the eight route costs: the objective to minimise.',
    },
    {
      id: 'solve',
      kind: 'tool',
      tool: 'solver',
      cells: 'B13:E14',
      prompt:
        '(e) Use Solver (Simplex LP) to find the cheapest daily plan in B13:E14: no warehouse ships more than its capacity, every outlet receives at least its demand, ' +
        'and cartons are whole numbers. Keep the plan Solver finds.',
      toolSetup: {
        objective: 'B18', sense: 'min', changing: 'B13:E14',
        constraints: [
          { lhs: 'F13:F14', relation: '<=', rhs: 'G13:G14' },
          { lhs: 'B15:E15', relation: '>=', rhs: 'B16:E16' },
          { lhs: 'B13:E14', relation: 'int' },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { B13: 350, C13: 420, D13: 0, E13: 80, B14: 0, C14: 0, D14: 380, E14: 220, B18: 2418 },
      check: { tol: 1e-4 },
      wrong: ['420'],
      hints: [
        'The objective is the total freight cost B18, and it is a cost: Min, not Max. The shipments B13:E14 are the variable cells.',
        'Two range constraints cover all six limits: shipped against capacity by warehouse, received against demand by outlet.',
        'F13:F14 <= G13:G14, B15:E15 >= B16:E16, B13:E14 int; tick Make Unconstrained Variables Non-Negative.',
      ],
      explain:
        'Solver: Min B18 by changing B13:E14, subject to F13:F14 <= G13:G14, B15:E15 >= B16:E16 and B13:E14 = integer (Simplex LP, non-negative). ' +
        'Tuas ships 350 to Jurong East, 420 to Woodlands and 80 to Bishan; Changi ships 380 to Tampines and 220 to Bishan. Total $2,418.00 a day.',
    },
    {
      id: 'unused',
      kind: 'formula',
      cells: 'H13:H14',
      prompt: '(f) In H13 compute each warehouse\'s unused capacity and fill down to H14.',
      solution: '=G13-F13',
      wrong: ['=F13-G13', '=G13-$F$13'],
      hints: ['Capacity minus shipped.'],
      explain: 'Tuas has 50 cartons spare; Changi none: its capacity constraint is binding.',
    },
    {
      id: 'both',
      kind: 'value',
      cells: 'B20',
      prompt: '(g) Which outlet is supplied by both warehouses? Type its name in B20 exactly as in the header.',
      answer: 'Bishan',
      wrong: ['Tampines', 'Woodlands'],
      hints: ['Look for the column with two non-zero shipments.'],
      explain: 'Bishan: Changi is full, so the last 80 Bishan cartons come from Tuas.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: '(h) If Changi could ship 50 more cartons a day, how would the plan and the cost change? And why can Simplex LP solve this model although the costs come from LOOKUP?',
      answer:
        'The 50 extra Changi cartons would replace 50 of the Tuas cartons to Bishan, saving $2.10 - $1.60 = $0.50 each: $25 a day, a total of $2,393.00. ' +
        'The LOOKUPs read the fixed distances, not the decision cells, so every cost per carton is a constant and the total cost is a linear SUMPRODUCT of the shipments. ' +
        'If the rate depended on the number of cartons shipped (volume bands), the model would have steps: fix the band first, solve, then check the band still applies.',
    },
  ],
  testCases: [
    { name: 'Freight rates rise', inputs: inputsDown('H4', [1.3, 1.75, 2.3, 2.95, 3.6]) },
    { name: 'Capacities revised', inputs: { G13: 950, G14: 650 } },
    { name: 'Another shipping plan', inputs: inputs('B13', [[360, 430, 0, 110], [0, 0, 390, 200]]) },
  ],
  skills: ['LOOKUP filled right and down', 'Transportation LP', 'Range constraints for supply and demand', 'Reading binding constraints'],
  techniques: [T.solver, T.integer, T.sumproduct, T.bracket, T.anchors, T.linear, T.interpret],
}

// ---------- 13. exam-style: linearise a bracket discount for Solver ----------

const foodBank: Exercise = {
  id: 'w3-exam-food-bank-discount',
  week: 'W3',
  topic: 'Exam: linearise for Solver',
  title: 'Exam-style: fix the discount bracket so Simplex LP can solve',
  level: 3,
  minutes: 30,
  scenario:
    'Harvest Hands (fictional), a Singapore food bank, is ordering packs for a weekend food drive (Table 1, A3:D6). The wholesaler takes a bulk discount off the whole order, ' +
    'by subtotal bracket (Table 2, F3:G8), and the food bank can spend at most $3,800 after discount. Table 3 (A13:B17) holds the other rules: the store room limits rice packs, ' +
    'every hamper gets exactly one canned pack, and a partner home has asked for at least 40 noodle packs. Find the whole-pack order that provides the most meals. ' +
    'Answer at exactly these addresses, as in the exam.',
  sheet: {
    rows: 17,
    cols: 7,
    cells: {
      A1: title('Harvest Hands food drive: the order'),
      A2: title('Table 1: Packs'),
      F2: title('Table 2: Bulk discount'),
      A12: title('Table 3: Rules'),
      ...across('A3', ['Pack', 'Price ($)', 'Meals per pack', 'Packs to buy'], header),
      ...down('A4', ['Rice pack (5 kg)', 'Canned food pack', 'Instant noodle pack'], label),
      ...down('B4', [14, 9, 6], input(MONEY)),
      ...down('C4', [20, 8, 6], input(WHOLE)),
      ...fill('D4:D6', decision()),
      ...across('F3', ['Subtotal from ($)', 'Discount'], header),
      ...down('F4', [0, 1000, 2500, 4000, 6000], input(WHOLE)),
      ...down('G4', [0, 0.03, 0.06, 0.09, 0.12], input('0%')),
      ...down('A8', ['Subtotal ($)', 'Discount (from Table 2)', 'Total after discount ($)', 'Meals provided'], label),
      B8: answer(MONEY),
      B9: answer('0%'),
      B10: answer(MONEY),
      B11: answer(WHOLE),
      ...down('F10', ['Fixed discount for Solver', 'Total at the fixed discount ($)', 'That bracket starts at ($)'], label),
      G10: answer('0%'),
      G11: answer(MONEY),
      G12: answer(MONEY),
      ...across('A13', ['Rule', 'Value'], header),
      ...down('A14', ['Rice packs, at most (store room)', 'Canned packs, exactly (one per hamper)', 'Noodle packs, at least (partner home)', 'Budget after discount ($)'], label),
      ...down('B14', [150, 60, 40], input(WHOLE)),
      B17: input(MONEY)(3800),
    },
    colWidths: { A: 310, B: 100, C: 120, D: 110, E: 24, F: 260, G: 90 },
  },
  tasks: [
    {
      id: 'subtotal',
      kind: 'formula',
      cells: 'B8',
      prompt: '(a) In B8 compute the order subtotal at list prices: packs to buy times price, added over the three packs.',
      solution: '=SUMPRODUCT(B4:B6,D4:D6)',
      wrong: ['=SUM(B4:B6)*SUM(D4:D6)', '=SUMPRODUCT(C4:C6,D4:D6)', '=SUM(D4:D6)'],
      hints: ['One SUMPRODUCT pairs each price with its number of packs.'],
      explain: 'SUMPRODUCT(B4:B6,D4:D6) is linear in the packs. D4:D6 hold 0 until Solver runs, so B8 shows $0.00 for now.',
    },
    {
      id: 'rate',
      kind: 'formula',
      cells: 'B9',
      prompt: '(b) In B9 look up the discount for the subtotal in B8 from Table 2.',
      solution: '=VLOOKUP(B8,F4:G8,2,TRUE)',
      wrong: ['=VLOOKUP(B8,F4:G8,2,FALSE)', '=VLOOKUP(B8,F4:G8,1,TRUE)', '=LOOKUP(B8,G4:G8,F4:F8)'],
      hints: ['The subtotal falls between bracket starts: an approximate match on F4:F8.', 'VLOOKUP(B8, F4:G8, 2, TRUE), or LOOKUP(B8, F4:F8, G4:G8).'],
      explain: 'An approximate lookup returns the discount of the largest bracket start at or below the subtotal. As the subtotal crosses $1,000, $2,500, $4,000 and $6,000, B9 jumps.',
    },
    {
      id: 'after',
      kind: 'formula',
      cells: 'B10',
      prompt: '(c) In B10 compute the total after discount.',
      solution: '=B8*(1-B9)',
      wrong: ['=B8*B9', '=B8-B9', '=B8*(1+B9)'],
      hints: ['A 6% discount leaves 94% of the subtotal.'],
      explain: 'B10 is what the food bank really pays. Because B9 jumps at each bracket, B10 is a step-shaped function of the packs, not a linear one.',
    },
    {
      id: 'meals',
      kind: 'formula',
      cells: 'B11',
      prompt: '(d) In B11 compute the number of meals the order provides.',
      solution: '=SUMPRODUCT(C4:C6,D4:D6)',
      wrong: ['=SUMPRODUCT(B4:B6,D4:D6)', '=SUM(C4:C6)', '=SUMPRODUCT(B4:B6,C4:C6)'],
      hints: ['Meals per pack times packs, added up: the same shape as B8.'],
      explain: 'B11 is the objective (the performance measure) Solver will maximise.',
    },
    {
      id: 'fix',
      kind: 'value',
      cells: 'G10',
      prompt:
        '(e) A constraint B10 <= B17 would make Solver work on a step function: Simplex LP needs a linear model, and GRG can stall on the jumps. ' +
        'Instead, decide which bracket the best order can reach within the $3,800 budget and type that bracket\'s discount into G10: Solver will treat it as fixed.',
      answer: 0.09,
      wrong: ['0.06', '0.12', '4000'],
      hints: [
        'In a bracket with discount d, the budget buys at most 3,800 / (1 - d) dollars of packs at list price.',
        'The 12% bracket starts at a $6,000 subtotal: how much is that after discount? At 9%, is 3,800 / 0.91 at least $4,000?',
        'More packs mean more meals, so pick the highest bracket the budget can reach.',
      ],
      explain:
        'At 9% the budget buys up to 3,800 / 0.91 = $4,175.82 of packs at list price, inside the 9% bracket ($4,000 to $5,999.99). The 12% bracket starts at $6,000, which still costs $5,280 after discount, ' +
        'so it is out of reach, and an order in the 6% bracket must stay below $4,000. So the best order sits in the 9% bracket, where the discount is a constant.',
    },
    {
      id: 'fixedtotal',
      kind: 'formula',
      cells: 'G11',
      prompt: '(f) In G11 compute the total after discount using the fixed discount in G10 instead of the looked-up one.',
      solution: '=B8*(1-G10)',
      wrong: ['=B8*(1-B9)', '=B8*G10', '=B8-G10'],
      hints: ['B10\'s formula with G10 in place of B9.'],
      explain:
        'G11 is linear in the packs, so Simplex LP accepts G11 <= B17 as the budget constraint. It equals the true total B10 only while the order really is in the bracket G10 belongs to: ' +
        'that is what the next constraint and the final check make sure of.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'G12',
      prompt:
        '(g) In G12 look up the subtotal at which the bracket in G10 starts: find G10 in the discount column G4:G8 (exact match) and return the From ($) value to its left.',
      solution: '=INDEX(F4:F8,MATCH(G10,G4:G8,0))',
      wrong: ['=MATCH(G10,G4:G8,0)', '=INDEX(G4:G8,MATCH(G10,G4:G8,0))', '=VLOOKUP(G10,F4:G8,1,FALSE)'],
      hints: [
        'VLOOKUP cannot return a column to the left of the one it searches; INDEX and MATCH can.',
        'MATCH(G10, G4:G8, 0) gives the bracket\'s position; INDEX(F4:F8, that position) its starting subtotal.',
      ],
      explain:
        'MATCH finds G10\'s discount in G4:G8 and INDEX returns the start of that bracket from F4:F8, to the left of the column searched. ' +
        'The constraint B8 >= G12 keeps the subtotal in the bracket whose discount G11 assumes. =XLOOKUP(G10,G4:G8,F4:F8) works too.',
    },
    {
      id: 'solve',
      kind: 'tool',
      tool: 'solver',
      cells: 'D4:D6',
      prompt:
        '(h) Use Solver (Simplex LP) to maximise the meals in B11 by changing D4:D6, with whole packs, the Table 3 rules (rice at most B14, canned exactly B15, noodles at least B16), ' +
        'the total at the fixed discount G11 within the budget B17, and the subtotal B8 at least G12 so the order stays in the bracket. Keep the solution, then check that B9 shows the same discount as G10.',
      toolSetup: {
        objective: 'B11', sense: 'max', changing: 'D4:D6',
        constraints: [
          { lhs: 'D4', relation: '<=', rhs: 'B14' },
          { lhs: 'D5', relation: '=', rhs: 'B15' },
          { lhs: 'D6', relation: '>=', rhs: 'B16' },
          { lhs: 'G11', relation: '<=', rhs: 'B17' },
          { lhs: 'B8', relation: '>=', rhs: 'G12' },
          { lhs: 'D4:D6', relation: 'int' },
        ],
        nonNegative: true, engine: 'simplex',
      },
      answer: { D4: 150, D5: 60, D6: 255, B11: 5010, B9: 0.09, B10: 3794.7 },
      check: { tol: 0.005 },
      wrong: ['149'],
      hints: [
        'Set Objective B11, To Max, By Changing Variable Cells D4:D6.',
        'D4 <= B14, D5 = B15 (choose = in the Add Constraint box), D6 >= B16, G11 <= B17 and B8 >= G12.',
        'Add D4:D6 int, tick Make Unconstrained Variables Non-Negative and choose Simplex LP.',
      ],
      explain:
        'Solver: Max B11 by changing D4:D6, subject to D4 <= B14, D5 = B15, D6 >= B16, G11 <= B17, B8 >= G12 and D4:D6 = integer (Simplex LP). ' +
        'It buys 150 rice, 60 canned and 255 noodle packs: 5,010 meals for a $4,170.00 subtotal, which really is in the 9% bracket (B9 = 9%), so the true total B10 is $3,794.70, within budget. ' +
        'Rice gives the most meals per dollar, so it fills its 150-pack limit first and noodles take the rest of the money.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt:
        '(i) Why did the model need a fixed discount before Solver, and how do you know the fix was safe? What is the best order with a subtotal below $4,000, and why is the order Solver found better?',
      answer:
        'B10 uses a lookup on the subtotal, so it jumps at each bracket: the model is not linear (not even smooth). Simplex LP either reports that the linearity conditions are not satisfied ' +
        'or, if it only tests the model inside one bracket, solves it with the wrong discount; GRG can stall or stop at a poor plan. ' +
        'With the discount fixed at the bracket the answer must lie in, every formula is linear; B8 >= G12 keeps the subtotal in that bracket, and after solving B9 still shows 9%, ' +
        'so the true total B10 equals G11 and is within budget. The best order below $4,000 (6% bracket) is 150, 60 and 226 packs, 4,836 meals: 174 fewer. ' +
        'Crossing into the 9% bracket makes a bigger order cheaper after discount ($4,000 costs $3,640, while $3,999 costs $3,759.06), the price-break effect seen with quantity discounts.',
    },
  ],
  testCases: [
    { name: 'A smaller order', inputs: inputsDown('D4', [50, 60, 80]) },
    { name: 'New prices and meal counts', inputs: { ...inputsDown('B4', [15, 9.5, 6.5]), ...inputsDown('C4', [22, 9, 7]) } },
    { name: 'Brackets revised', inputs: { ...inputsDown('F4', [0, 800, 2000, 3200, 4500]), ...inputsDown('G4', [0, 0.03, 0.05, 0.07, 0.09]) } },
  ],
  skills: [
    'Approximate lookup of a bracket discount', 'Why a step lookup breaks Simplex LP', 'Fixing the bracket to linearise a model',
    'Equality and integer constraints', 'INDEX/MATCH to the left', 'Checking the bracket after solving',
  ],
  techniques: [T.linear, T.solver, T.integer, T.bracket, T.sumproduct, T.interpret],
}

export const exercises: readonly Exercise[] = [
  spiceOrder, cardboard, berths, storage, priceLog, commission, spill, courier, toteBags, kaya, classPlan, priceList, catering, chilled, foodBank,
]
