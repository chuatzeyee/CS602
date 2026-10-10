import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 9 Macros & VBA, plus two Week 6 macro-recording exercises (week 'W6').
// A vba task runs one entry Sub on a fresh copy of the sheet (or calls a Function). Where one run could be passed with
// fixed addresses, the starter holds a Test... driver that replays a user's clicks or loads new inputs, so hard-coded
// rows, fixed loop counts and typed constants fail. Clocks are typed practice cells (the course workbooks use =NOW()),
// so no checked value depends on the time of day; a Now stamp is checked through FORMULATEXT (frozen value or not).
// Course constructs and patterns: site_build/notes/vba_catalogue.md. Scenarios and data are original.

type Cells = Record<string, CellSpec>

const label = (v: string): CellSpec => ({ v, role: 'label' })
const title = (v: string): CellSpec => ({ v, role: 'label', bold: true })
const header = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'header', fmt } : { v, role: 'header' })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const input = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'input', fmt } : { v, role: 'input' })
const answer = (fmt?: string): CellSpec => (fmt ? { role: 'answer', fmt } : { role: 'answer' })
const calc = (f: string, fmt?: string): CellSpec => (fmt ? { f, role: 'given', fmt } : { f, role: 'given' })

// a VBA module from lines
const vb = (...lines: string[]): string => `${lines.join('\n')}\n`

// time of day as a day fraction, computed exactly as the VBA practice clocks do
const tod = (h: number, m: number, s = 0): number => h / 24 + m / 1440 + s / 86400

// one column of cells from a list: column('B', 4, [1, 2], v => given(v)) -> { B4, B5 }
function column<T>(col: string, first: number, values: readonly T[], make: (v: T, i: number) => CellSpec): Cells {
  return Object.fromEntries(values.map((v, i) => [`${col}${first + i}`, make(v, i)]))
}

// the same spec for every cell of a block: block('C', 'E', 11, 20, () => ({ fmt: 'h:mm:ss' }))
function block(c1: string, c2: string, r1: number, r2: number, make: (ref: string) => CellSpec): Cells {
  const out: Cells = {}
  for (let c = c1.charCodeAt(0); c <= c2.charCodeAt(0); c++) {
    for (let r = r1; r <= r2; r++) {
      const ref = `${String.fromCharCode(c)}${r}`
      out[ref] = make(ref)
    }
  }
  return out
}

// rows of values written to consecutive columns from `col` at row `first`: rows('C', 12, [[1, 'a']])
function rows(col: string, first: number, data: readonly (readonly CellValue[])[]): Record<string, CellValue> {
  const out: Record<string, CellValue> = {}
  data.forEach((row, i) => row.forEach((v, j) => { out[`${String.fromCharCode(col.charCodeAt(0) + j)}${first + i}`] = v }))
  return out
}

// ---------- W6: absolute vs relative recording ----------

const deskTimes = [tod(9, 0), tod(9, 30), tod(10, 0), tod(10, 30), tod(11, 0), tod(11, 30), tod(14, 0), tod(14, 30), tod(15, 0), tod(15, 30)]
const deskPatients = ['P-2041', 'P-1187', 'P-3302', 'P-0956', 'P-2210', 'P-1475', 'P-3018', 'P-0821', 'P-2664', 'P-1739']
const deskDentists = ['Dr Wong', 'Dr Rao', 'Dr Wong', 'Dr Lim', 'Dr Rao', 'Dr Wong', 'Dr Lim', 'Dr Rao', 'Dr Wong', 'Dr Lim']

const DESK_TEST = [
  "' TestDesk plays the receptionist. Check runs it, so keep it as it is.",
  'Sub TestDesk()',
  '    Range("C5").Select',
  '    MarkArrived',
  '    MarkArrived',
  '    Range("C10").Select',
  '    MarkArrived',
  'End Sub',
  '',
]

const relativeDesk: Exercise = {
  id: 'w6-macro-relative-desk',
  week: 'W6',
  topic: 'Absolute vs relative recording',
  title: 'Mark the patient who just arrived',
  level: 1,
  minutes: 6,
  scenario:
    "A dental clinic in Tampines keeps today's appointments on one sheet. When a patient walks in, the receptionist clicks " +
    'the patient code and presses an Arrived button: it should write Arrived in the Status column of that row and move the ' +
    'cursor down one row, ready for the next patient. Her first macro was recorded with Use Relative References off, and it ' +
    'always marks the same row.',
  sheet: {
    rows: 18,
    cols: 6,
    colWidths: { A: 28, B: 64, C: 130, D: 96, E: 96 },
    cells: {
      A1: title("Front desk: today's appointments"),
      B3: header('Time'), C3: header('Patient'), D3: header('Dentist'), E3: header('Status'),
      ...column('B', 4, deskTimes, (v) => given(v, 'h:mm')),
      ...column('C', 4, deskPatients, (v) => given(v)),
      ...column('D', 4, deskDentists, (v) => given(v)),
      ...column('E', 4, deskTimes, () => answer()),
      C16: label('Macro A marks'), D16: answer(),
      C17: label('Macro B marks'), D17: answer(),
      C18: label('Macro B ends on'), D18: answer(),
    },
  },
  tasks: [
    {
      id: 'macro-a',
      kind: 'value',
      cells: 'D16',
      prompt:
        'Macro A was recorded with Use Relative References OFF while the cursor was on the patient in C6. Tidied, the ' +
        'recorded code reads:\n`Range("E6").Select`\n`ActiveCell.Value = "Arrived"`\n`Range("C7").Select`\n' +
        'The receptionist now clicks C9 and runs Macro A. Which cell receives Arrived? Type its address (for example B2) in D16.',
      answer: 'E6',
      wrong: ['E9', 'C9'],
      hints: [
        'With Use Relative References off, the recorder stores the exact cells you clicked while recording.',
        'Read the first line: which cell does it select, whatever cell was active before the macro ran?',
      ],
      explain:
        'Absolute recording (the default) stores fixed addresses, so `Range("E6").Select` jumps to E6 wherever the cursor ' +
        'is: Macro A marks the 10:00 patient every time. (For typed text the raw recorder writes ' +
        '`ActiveCell.FormulaR1C1 = "Arrived"`, which does the same as `.Value` here.)',
    },
    {
      id: 'macro-b',
      kind: 'value',
      cells: 'D17:D18',
      prompt:
        'Macro B is the same steps recorded with Use Relative References ON. Tidied, it reads:\n' +
        '`ActiveCell.Offset(0, 2).Range("A1").Select`\n`ActiveCell.Value = "Arrived"`\n`ActiveCell.Offset(1, -2).Range("A1").Select`\n' +
        'She clicks C9 and runs Macro B. Type the cell that receives Arrived in D17 and the cell the cursor ends on in D18.',
      answer: { D17: 'E9', D18: 'C10' },
      wrong: ['E6', 'D9'],
      hints: [
        '`Offset(rows, columns)` counts from the active cell: positive rows go down, positive columns go right.',
        'The recorder adds `.Range("A1")` after each Offset. It means "that cell itself", so it does not move anything.',
        'After writing, the cursor is on the Arrived cell; `Offset(1, -2)` from there is one row down and two columns left.',
      ],
      explain:
        'From C9, `Offset(0, 2)` is E9 (same row, two columns right). Then `Offset(1, -2)` moves one row down and two ' +
        'columns back to C10, the next patient, so pressing the button again marks the next row. Relative recording stores ' +
        'moves, not addresses, which is why one macro works for any patient.',
    },
    {
      id: 'write-relative',
      kind: 'vba',
      cells: 'E4:E13',
      prompt:
        'Write `MarkArrived` the relative way, with no fixed cell address: put Arrived two columns to the right of the active ' +
        'cell, then select the cell one row below the active cell, ready for the next patient. `TestDesk` in the starter ' +
        'plays the receptionist (clicks C5, presses the button twice, clicks C10, presses once). Check runs TestDesk, so ' +
        'leave it unchanged.',
      vba: {
        entry: 'TestDesk',
        starter: vb(
          ...DESK_TEST,
          'Sub MarkArrived()',
          "    ' 1. write Arrived two columns to the right of the active cell",
          "    ' 2. select the cell one row below the active cell",
          'End Sub',
        ),
        solution: vb(
          ...DESK_TEST,
          'Sub MarkArrived()',
          '    ActiveCell.Offset(0, 2).Value = "Arrived"',
          '    ActiveCell.Offset(1, 0).Select',
          'End Sub',
        ),
        expected: Object.fromEntries(deskTimes.map((_, i) => [`E${4 + i}`, [5, 6, 10].includes(4 + i) ? 'Arrived' : null])),
        mustUse: ['ActiveCell', 'Offset'],
      },
      wrong: [
        vb(...DESK_TEST, 'Sub MarkArrived()', '    Range("E5").Value = "Arrived"', '    Range("C6").Select', 'End Sub'),
        vb(...DESK_TEST, 'Sub MarkArrived()', '    ActiveCell.Offset(0, 2).Value = "Arrived"', 'End Sub'),
        vb(
          ...DESK_TEST,
          'Sub MarkArrived()',
          '    ActiveCell.Offset(0, 2).Select',
          '    ActiveCell.Value = "Arrived"',
          '    ActiveCell.Offset(1, 0).Select',
          'End Sub',
        ),
      ],
      hints: [
        '`ActiveCell.Offset(0, 2)` is the cell two columns right of the active cell, on the same row.',
        'Moving the cursor is a Select: `ActiveCell.Offset(1, 0).Select`.',
        'Write first, then Select: once another cell is selected, ActiveCell means the new cell.',
      ],
      explain:
        '`ActiveCell.Offset(0, 2)` always points two columns right of whichever patient was clicked, so the same macro marks ' +
        'rows 5, 6 and 10. Selecting `ActiveCell.Offset(1, 0)` at the end is the relative Down Arrow, so the second press ' +
        'marks the next patient. A fixed `Range("E5")` would mark one row however often the button is pressed.',
    },
  ],
  skills: ['relative recording', 'absolute recording', 'ActiveCell.Offset', 'Select'],
}

// ---------- W6: record management ----------

const LOANS = [
  [1, 'M-3102', 'Cordless drill', 2],
  [2, 'M-3215', 'Pressure washer', 1],
  [3, 'M-3049', 'Ladder 3m', 4],
  [4, 'M-3288', 'Tile cutter', 2],
  [5, 'M-3102', 'Stud finder', 7],
] as const

const ADD_TEST = [
  "' TestAdd plays a volunteer adding two loans. Check runs it, so keep it as it is.",
  'Sub TestAdd()',
  '    AddLoan',
  '    Range("D4").Value = "M-3311"',
  '    Range("E4").Value = "Pressure washer"',
  '    Range("F4").Value = 1',
  '    AddLoan',
  'End Sub',
  '',
]

const addLoan = (...steps: string[]): string => vb(...ADD_TEST, 'Sub AddLoan()', ...steps.map((s) => `    ${s}`), 'End Sub')

const RECORDED_ADD = [
  'Range("C4:F4").Select',
  'Selection.Copy',
  'Range("C11").Select',
  'Selection.End(xlDown).Select',
  'ActiveCell.Offset(1, 0).Range("A1").Select',
  'Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats, Operation:= _',
  '    xlNone, SkipBlanks:=False, Transpose:=False',
  'Application.CutCopyMode = False',
  'Range("D4:F4").Select',
  'Selection.ClearContents',
]

const loanRegister: Exercise = {
  id: 'w6-macro-loan-register',
  week: 'W6',
  topic: 'Record management macros',
  title: 'Tool library register: find and add loans',
  level: 2,
  minutes: 15,
  scenario:
    'A community tool library in Bukit Batok lends drills, ladders and pressure washers. Volunteers type each loan into the ' +
    'entry row C4:F4, where C4 offers the next loan number (=B4+1) and B4 stores the last number used. An Add button should ' +
    'copy the entry to the first empty row of the register, clear the entry fields and move B4 on by one, and the Find box ' +
    'in C7 should show which sheet row holds a given loan.',
  sheet: {
    rows: 40,
    cols: 7,
    colWidths: { A: 28, B: 80, C: 90, D: 96, E: 150, F: 64 },
    cells: {
      A1: title('Tool library loans'),
      B3: header('Last no.'), C3: header('Loan no.'), D3: header('Member'), E3: header('Tool'), F3: header('Days'),
      B4: input(5, '0'), C4: calc('=B4+1', '0'), D4: input('M-3307'), E4: input('Ladder 2m'), F4: input(3, '0'),
      B6: header('Row'), C6: header('Find no.'),
      B7: answer('0'), C7: input(3, '0'),
      C10: title('Loan register'),
      C11: header('Loan no.'), D11: header('Member'), E11: header('Tool'), F11: header('Days'),
      ...column('C', 12, LOANS, (r) => given(r[0], '0')),
      ...column('D', 12, LOANS, (r) => given(r[1])),
      ...column('E', 12, LOANS, (r) => given(r[2])),
      ...column('F', 12, LOANS, (r) => given(r[3], '0')),
      ...block('C', 'C', 17, 30, () => ({ fmt: '0' })),
      ...block('F', 'F', 17, 30, () => ({ fmt: '0' })),
    },
  },
  tasks: [
    {
      id: 'find-row',
      kind: 'formula',
      cells: 'B7',
      prompt:
        'In B7, return the sheet row that holds the loan number typed in C7, or an empty text "" when that number is not ' +
        'in the register. Use an exact `MATCH` on C12:C40, turn the position into a sheet row with `ROW`, and wrap it in `IFERROR`.',
      solution: '=IFERROR(MATCH(C7,C12:C40,0)+ROW(C11),"")',
      check: { mustUse: ['MATCH', 'IFERROR'] },
      wrong: ['=MATCH(C7,C12:C40,0)', '=IFERROR(MATCH(C7,C12:C40,1)+ROW(C11),"")', '=MATCH(C7,C12:C40,0)+ROW(C11)'],
      hints: [
        '`MATCH`(C7, C12:C40, 0) gives the position inside the register (1 for the first loan), not the sheet row.',
        'The register starts just below row 11, so add `ROW`(C11) (or 11) to turn the position into a row number.',
        'An unknown number makes `MATCH` return #N/A; `IFERROR`(..., "") shows a blank instead, which a macro can test.',
      ],
      explain:
        'Exact `MATCH` finds the loan number; adding `ROW`(C11) turns position 3 into sheet row 14 and stays right if rows ' +
        'are inserted above the register, unlike a typed +11. `IFERROR` returns "" for a missing number, so a Delete macro ' +
        'can test `If rowNum <> "" Then` before removing anything. Match type 1 would quietly return the last loan for a ' +
        'number that is not there.',
    },
    {
      id: 'add-loan',
      kind: 'vba',
      cells: 'C17:F18',
      prompt:
        'Write `AddLoan` the way the recorder produces it, plus one hand-written line: copy C4:F4, select C11, jump to the ' +
        'last loan with `Selection.End(xlDown)`, step one row down with `ActiveCell.Offset(1, 0)`, paste values and number ' +
        'formats, press Esc (`Application.CutCopyMode = False`), clear D4:F4, then add 1 to B4. `TestAdd` in the starter ' +
        'adds two loans in a row; Check runs TestAdd, so leave it unchanged.',
      vba: {
        entry: 'TestAdd',
        starter: vb(
          ...ADD_TEST,
          'Sub AddLoan()',
          "    ' recorded steps, Use Relative References ON only for the Down Arrow:",
          "    ' copy C4:F4, select C11, Ctrl+Down, Down Arrow,",
          "    ' Paste Special > Values and number formats, Esc, clear D4:F4",
          "    ' then add the hand-written line that adds 1 to B4",
          'End Sub',
        ),
        solution: addLoan(...RECORDED_ADD, 'Range("B4").Value = Range("B4").Value + 1'),
        expected: {
          C16: 5, D16: 'M-3102',
          ...rows('C', 17, [[6, 'M-3307', 'Ladder 2m', 3], [7, 'M-3311', 'Pressure washer', 1]]),
          C19: null, B4: 7, C4: 8, D4: null, E4: null, F4: null,
        },
        mustUse: ['xlDown', 'PasteSpecial'],
      },
      wrong: [
        addLoan(
          'Range("C4:F4").Copy',
          'Range("C17").PasteSpecial Paste:=xlPasteValuesAndNumberFormats',
          'Application.CutCopyMode = False',
          'Range("D4:F4").ClearContents',
          'Range("B4").Value = Range("B4").Value + 1',
        ),
        addLoan(...RECORDED_ADD),
        addLoan(
          'Range("C4:F4").Copy',
          'Range("C11").End(xlDown).Offset(1, 0).PasteSpecial Paste:=xlPasteFormulas',
          'Application.CutCopyMode = False',
          'Range("D4:F4").ClearContents',
          'Range("B4").Value = Range("B4").Value + 1',
        ),
        addLoan(
          'Range("C4:F4").Copy',
          'Range("C11").End(xlDown).PasteSpecial Paste:=xlPasteValuesAndNumberFormats',
          'Application.CutCopyMode = False',
          'Range("D4:F4").ClearContents',
          'Range("B4").Value = Range("B4").Value + 1',
        ),
      ],
      hints: [
        'The recorder writes the copy as `Range("C4:F4").Select` then `Selection.Copy`, and the jump as `Range("C11").Select` then `Selection.End(xlDown).Select`.',
        'The relative Down Arrow is `ActiveCell.Offset(1, 0).Range("A1").Select`; then `Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats` and `Application.CutCopyMode = False` for Esc.',
        'The hand-written last line reads B4, adds 1 and writes it back: `Range("B4").Value = Range("B4").Value + 1`.',
      ],
      explain:
        'Ctrl+Down from the header lands on the last loan however long the register is, and the relative ' +
        '`Offset(1, 0)` steps to the empty row below it, so the second Add lands under the first. Paste Special > Values ' +
        'freezes the loan number: a plain paste would copy the formula =B4+1 into the register. Adding 1 to B4 makes C4 ' +
        'offer the next number, and because B4 only grows, a deleted loan number is never reused.',
    },
    {
      id: 'why-relative',
      kind: 'explain',
      cells: '',
      prompt:
        'When you record AddLoan, Use Relative References is switched on only for the Down Arrow after Ctrl+Down. Why that ' +
        'step? What would go wrong if it stayed off for the whole recording, and what if it stayed on?',
      answer:
        'Ctrl+Down from C11 always lands on the last loan, wherever that is, so End(xlDown) is already dynamic. The step after ' +
        'it must mean "one row below wherever I am now": recorded relative it becomes ActiveCell.Offset(1, 0), so every run ' +
        'pastes into the next empty row. Recorded absolute, the recorder writes the address it reached (Range("C17").Select), ' +
        'so every later Add overwrites row 17. Left on for the whole recording, the fixed steps (select C4:F4 to copy, select ' +
        'D4:F4 to clear) would also be stored as offsets from the active cell, so the macro would copy and clear the wrong ' +
        'cells whenever it starts from another cell.',
      hints: ['Compare what the recorder writes for a click on a cell with relative references off (an address) and on (an Offset from the active cell).'],
    },
  ],
  testCases: [
    { name: 'Find loan 5', inputs: { C7: 5 } },
    { name: 'Find loan 9, which is not in the register', inputs: { C7: 9 } },
    { name: 'Find loan 1', inputs: { C7: 1 } },
  ],
  skills: ['macro recording', 'record management', 'IFERROR + MATCH row finder', 'End(xlDown) next empty row', 'Paste Special values'],
}

// ---------- W9 level 1: Range, Cells and Offset ----------

const MAP_TEST = [
  "' TestMap runs your macro for the drop typed in L3:L4, then for a drop 0 rows down and 6 across.",
  "' Check runs it, so keep it as it is.",
  'Sub TestMap()',
  '    MarkBay',
  '    Range("L3").Value = 0',
  '    Range("L4").Value = 6',
  '    MarkBay',
  'End Sub',
  '',
]

const markBay = (...steps: string[]): string => vb(...MAP_TEST, 'Sub MarkBay()', ...steps.map((s) => `    ${s}`), 'End Sub')

const warehouseMap: Exercise = {
  id: 'w9-vba-range-cells-offset',
  week: 'W9',
  topic: 'Range, Cells and Offset',
  title: 'Drop a pallet on the warehouse map',
  level: 1,
  minutes: 6,
  scenario:
    'A cold-storage warehouse in Jurong maps its floor as a grid of pallet bays in B3:I8. Dispatch types how many rows down ' +
    'and columns across from the corner bay B3 the next pallet goes, and a macro marks that bay DROP and the bay to its ' +
    'right NEXT for the forklift that follows.',
  sheet: {
    rows: 12,
    cols: 12,
    colWidths: { A: 40, B: 52, C: 52, D: 52, E: 52, F: 52, G: 52, H: 52, I: 52, J: 24, K: 190, L: 64 },
    cells: {
      A1: title('Floor map (corner bay B3; numbers are offsets from B3)'),
      B2: header(0, '0'), C2: header(1, '0'), D2: header(2, '0'), E2: header(3, '0'),
      F2: header(4, '0'), G2: header(5, '0'), H2: header(6, '0'), I2: header(7, '0'),
      ...column('A', 3, [0, 1, 2, 3, 4, 5], (v) => header(v, '0')),
      K3: label('Rows down'), L3: input(3, '0'),
      K4: label('Columns across'), L4: input(2, '0'),
      K6: label('Range("B3").Offset(2, 5)'), L6: answer(),
      K7: label('Cells(7, 4)'), L7: answer(),
    },
  },
  tasks: [
    {
      id: 'read-refs',
      kind: 'value',
      cells: 'L6:L7',
      prompt: 'Without running anything: which cell is `Range("B3").Offset(2, 5)`, and which is `Cells(7, 4)`? Type the addresses in L6 and L7.',
      answer: { L6: 'G5', L7: 'D7' },
      wrong: ['H6', 'D8'],
      hints: [
        '`Offset(rows, columns)` moves from the starting cell, rows first; `Offset(0, 0)` is the cell itself.',
        '`Cells(row, column)` counts from A1, row first: `Cells(1, 1)` is A1 and column 4 is D.',
      ],
      explain:
        'B3 moved 2 rows down and 5 columns right is G5. `Cells(7, 4)` is row 7, column 4 (D), so D7. Both put the row ' +
        'first, unlike an A1-style address, which starts with the column letter.',
    },
    {
      id: 'mark-bay',
      kind: 'vba',
      cells: 'B3:I8',
      prompt:
        'Write `MarkBay`: read the rows down (L3) and columns across (L4) into variables, write DROP in the bay that far ' +
        'from B3 using `Range("B3").Offset(...)`, and NEXT in the bay to its right using `Cells(row, column)`. `TestMap` ' +
        'runs your macro for the typed drop and then for a drop 0 rows down and 6 across. Check runs TestMap, so leave it unchanged.',
      vba: {
        entry: 'TestMap',
        starter: vb(
          ...MAP_TEST,
          'Sub MarkBay()',
          "    ' read rows down (L3) and columns across (L4)",
          "    ' DROP: the bay that far from B3, with Range(\"B3\").Offset(...)",
          "    ' NEXT: the bay to its right, with Cells(row, column)",
          'End Sub',
        ),
        solution: markBay(
          'Dim r As Integer, c As Integer',
          'r = Range("L3").Value',
          'c = Range("L4").Value',
          'Range("B3").Offset(r, c).Value = "DROP"',
          'Cells(3 + r, 2 + c + 1).Value = "NEXT"',
        ),
        expected: { D6: 'DROP', E6: 'NEXT', H3: 'DROP', I3: 'NEXT', C5: null, F5: null },
        mustUse: ['Offset', 'Cells'],
      },
      wrong: [
        markBay('Dim r As Integer, c As Integer', 'r = Range("L3").Value', 'c = Range("L4").Value', 'Range("B3").Offset(r - 1, c - 1).Value = "DROP"', 'Cells(3 + r, 2 + c + 1).Value = "NEXT"'),
        markBay('Dim r As Integer, c As Integer', 'r = Range("L3").Value', 'c = Range("L4").Value', 'Range("B3").Offset(r, c).Value = "DROP"', 'Cells(2 + c + 1, 3 + r).Value = "NEXT"'),
        markBay('Range("B3").Offset(3, 2).Value = "DROP"', 'Cells(6, 5).Value = "NEXT"'),
      ],
      hints: [
        'Read the inputs first: `r = Range("L3").Value` and `c = Range("L4").Value`.',
        '`Range("B3").Offset(r, c)` is the drop bay. B3 is row 3, column 2, so the same bay is `Cells(3 + r, 2 + c)`.',
        'The bay to its right is one more column: `Cells(3 + r, 2 + c + 1)`.',
      ],
      explain:
        'Offset counts from a starting range and Cells counts from A1; both take the row first. `Range("B3").Offset(r, c)` ' +
        'and `Cells(3 + r, 2 + c)` are the same bay, so NEXT is `Cells(3 + r, 3 + c)`. Because the macro reads L3 and L4 ' +
        'every time it runs, the same code handles each drop: the second test lands in H3 and I3.',
    },
  ],
  skills: ['Range', 'Cells(row, column)', 'Offset', 'variables'],
}

// ---------- W9 level 1: WorksheetFunction, .Formula and Static ----------

const TOTALS_TEST = [
  "' TestTotals presses the button, edits Monday, presses again, then edits Tuesday.",
  "' Check runs it, so keep it as it is.",
  'Sub TestTotals()',
  '    TotalsTwoWays',
  '    Range("C2").Value = 150',
  '    TotalsTwoWays',
  '    Range("C3").Value = 120',
  'End Sub',
  '',
]

const TOTALS_BODY = [
  'Static presses As Integer',
  'presses = presses + 1',
  'Range("C9").Value = WorksheetFunction.Sum(Range("C2:C8"))',
  'Range("C10").Formula = "=SUM(C2:C8)"',
  'Range("C12").Value = presses',
]

const totalsTwoWays = (body: string[]): string => vb(...TOTALS_TEST, 'Sub TotalsTwoWays()', ...body.map((s) => `    ${s}`), 'End Sub')

const fruitTotals: Exercise = {
  id: 'w9-vba-worksheetfunction-static',
  week: 'W9',
  topic: 'WorksheetFunction, .Formula and Static',
  title: 'A frozen total, a live total and a press counter',
  level: 1,
  minutes: 6,
  scenario:
    "A fruit stall at Tekka Market keeps a week of takings. The bookkeeper wants a total that never changes once it is " +
    'taken, the owner wants a live total that follows every correction, and both want to see how many times the Totals ' +
    'button has been pressed since the file was opened.',
  sheet: {
    rows: 14,
    cols: 4,
    colWidths: { A: 28, B: 190, C: 100 },
    cells: {
      B1: header('Day'), C1: header('Takings'),
      ...column('B', 2, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], (v) => given(v)),
      ...column('C', 2, [120, 95, 143, 88, 160, 210, 184], (v) => input(v, '$#,##0.00')),
      B9: label('Total (frozen value)'), C9: answer('$#,##0.00'),
      B10: label('Total (live formula)'), C10: answer('$#,##0.00'),
      B12: label('Totals button presses'), C12: answer('0'),
      B14: label('Usable from another module'), C14: answer(),
    },
  },
  tasks: [
    {
      id: 'totals',
      kind: 'vba',
      cells: 'C9:C12',
      prompt:
        'Write `TotalsTwoWays`: put the sum of C2:C8 into C9 as a plain value with `WorksheetFunction.Sum`, write the live ' +
        'formula =SUM(C2:C8) into C10 with `.Formula`, and show in C12 how many times the macro has run, using a `Static` ' +
        'counter. `TestTotals` presses the button, corrects Monday, presses again and then corrects Tuesday; Check runs ' +
        'TestTotals, so leave it unchanged.',
      vba: {
        entry: 'TestTotals',
        starter: vb(
          ...TOTALS_TEST,
          'Sub TotalsTwoWays()',
          "    ' C9: the sum as a value (WorksheetFunction.Sum)",
          "    ' C10: a live =SUM(C2:C8) formula (.Formula)",
          "    ' C12: how many times this macro has run (a Static counter)",
          'End Sub',
        ),
        solution: totalsTwoWays(TOTALS_BODY),
        expected: { C9: 1030, C10: 1055, C12: 2 },
        mustUse: ['WorksheetFunction', 'Formula', 'Static'],
      },
      wrong: [
        totalsTwoWays(TOTALS_BODY.map((s) => (s.startsWith('Range("C9")') ? 'Range("C9").Formula = "=SUM(C2:C8)"' : s))),
        totalsTwoWays(TOTALS_BODY.map((s) => (s.startsWith('Range("C10")') ? 'Range("C10").Value = WorksheetFunction.Sum(Range("C2:C8"))' : s))),
        totalsTwoWays(TOTALS_BODY.map((s) => s.replace('Static presses', 'Dim presses'))),
      ],
      hints: [
        'A worksheet function from VBA: `WorksheetFunction.Sum(Range("C2:C8"))` (or `Application.WorksheetFunction.Sum`) returns a number.',
        '`Range("C10").Formula = "=SUM(C2:C8)"` puts the formula itself into the cell, as if you had typed it.',
        'A `Dim` variable starts again at 0 on every run; `Static presses As Integer` keeps its value between runs.',
      ],
      explain:
        'C9 receives the number the function returned, so it stays at the total of the moment (1,030 after the second ' +
        'press) when Tuesday changes. C10 holds a formula, so Excel keeps it up to date (1,055). The Static counter keeps ' +
        'its value after the Sub ends, which is how a macro can count its own runs; a Dim counter would show 1 every time.',
    },
    {
      id: 'scope',
      kind: 'value',
      cells: 'C14',
      prompt:
        'A module starts with `Public x As Integer` and `Dim y As Long` above its first procedure, and `Sub MySub()` ' +
        'declares `Dim z As Single` inside. Which of x, y and z can a procedure in another module use? Type the name in C14.',
      answer: 'x',
      wrong: ['y', 'x, y'],
      hints: [
        'A Dim inside a procedure is local to that procedure.',
        'A Dim above the first procedure is shared by the procedures of that module only; Public reaches every module.',
      ],
      explain:
        'z lives only inside MySub, y is shared by every procedure in its own module, and only the Public x can be used ' +
        'from other modules. Declare at the narrowest level that works: it keeps procedures from changing each other\'s values.',
    },
  ],
  skills: ['WorksheetFunction', '.Formula vs .Value', 'Static variables', 'variable scope'],
}

// ---------- W9 level 1: For ... Next ----------

const BIB_TEST = [
  "' TestBibs loads another race (first bib 730, prefix MR-) and runs your macro.",
  "' Check runs it, so keep it as it is.",
  'Sub TestBibs()',
  '    Range("E2").Value = 730',
  '    Range("E3").Value = "MR-"',
  '    NumberBibs',
  'End Sub',
  '',
]

const numberBibs = (...steps: string[]): string => vb(...BIB_TEST, 'Sub NumberBibs()', ...steps.map((s) => `    ${s}`), 'End Sub')
const runners = Array.from({ length: 12 }, (_, i) => i + 1)

const raceBibs: Exercise = {
  id: 'w9-vba-for-next-bibs',
  week: 'W9',
  topic: 'For ... Next loops',
  title: 'Number the race bibs',
  level: 1,
  minutes: 6,
  scenario:
    'A charity run at East Coast Park signs up walk-in runners on the day. The organiser types the first free bib number ' +
    'and the race prefix in E2:E3, and a macro numbers all twelve rows of the sign-up sheet in one go.',
  sheet: {
    rows: 20,
    cols: 6,
    colWidths: { A: 70, B: 80, C: 110, D: 130, E: 80 },
    cells: {
      A1: title('Walk-in sign-ups'),
      D2: label('First bib'), E2: input(501, '0'),
      D3: label('Prefix'), E3: input('ECP-'),
      A5: header('Runner'), B5: header('Bib no.'), C5: header('Bib code'),
      ...column('A', 6, runners, (v) => given(v, '0')),
      ...column('B', 6, runners, () => answer('0')),
      ...column('C', 6, runners, () => answer()),
      D9: label('Last cell written'), E9: answer(),
      D10: label('Value written'), E10: answer('0'),
    },
  },
  tasks: [
    {
      id: 'number-bibs',
      kind: 'vba',
      cells: 'B6:C17',
      prompt:
        'Write `NumberBibs` with a `For ... Next` loop over runners 1 to 12: put the bib number (first bib + runner - 1) ' +
        'in column B and the bib code (the prefix followed by that number) in column C. `TestBibs` loads another race ' +
        '(first bib 730, prefix MR-) and runs your macro; Check runs TestBibs, so leave it unchanged.',
      vba: {
        entry: 'TestBibs',
        starter: vb(
          ...BIB_TEST,
          'Sub NumberBibs()',
          "    ' for runner i = 1 to 12:",
          "    '   column B: the first bib (E2) + i - 1",
          "    '   column C: the prefix (E3) followed by that number",
          'End Sub',
        ),
        solution: numberBibs(
          'Dim i As Integer',
          'Dim bib As Long',
          'For i = 1 To 12',
          '    bib = Range("E2").Value + i - 1',
          '    Range("B5").Offset(i, 0).Value = bib',
          '    Range("C5").Offset(i, 0).Value = Range("E3").Value & bib',
          'Next i',
        ),
        expected: {
          ...Object.fromEntries(runners.map((i) => [`B${5 + i}`, 729 + i])),
          ...Object.fromEntries(runners.map((i) => [`C${5 + i}`, `MR-${729 + i}`])),
          B18: null, C18: null,
        },
        mustUse: ['For', 'Next'],
      },
      wrong: [
        numberBibs('Dim i As Integer', 'For i = 1 To 11', '    Range("B5").Offset(i, 0).Value = Range("E2").Value + i - 1', '    Range("C5").Offset(i, 0).Value = Range("E3").Value & (Range("E2").Value + i - 1)', 'Next i'),
        numberBibs('Dim i As Integer', 'For i = 1 To 12', '    Range("B5").Offset(i, 0).Value = 500 + i', '    Range("C5").Offset(i, 0).Value = Range("E3").Value & (500 + i)', 'Next i'),
        numberBibs('Dim i As Integer', 'For i = 1 To 12', '    Range("B5").Offset(i, 0).Value = Range("E2").Value + i - 1', '    Range("C5").Offset(i, 0).Value = Range("E3").Value & Str(Range("E2").Value + i - 1)', 'Next i'),
        numberBibs('Dim i As Integer', 'For i = 1 To 12', '    Range("B5").Offset(i, 0).Value = Range("E2").Value + i', '    Range("C5").Offset(i, 0).Value = Range("E3").Value & (Range("E2").Value + i)', 'Next i'),
      ],
      hints: [
        'A counted loop: `For i = 1 To 12` ... `Next i`.',
        'Runner i sits in row 5 + i, which is `Range("B5").Offset(i, 0)`; their bib is E2 + i - 1.',
        'Join text with &: `Range("E3").Value & bib` gives MR-730.',
      ],
      explain:
        'The counter i runs 1 to 12, so `Offset(i, 0)` from the header row reaches rows 6 to 17, and E2 + i - 1 gives ' +
        'consecutive bibs from the typed number. & joins the prefix and the number into text; `Str(bib)` would add a ' +
        'leading space ("MR- 730"). Reading E2 and E3 inside the macro is what lets TestBibs change them.',
    },
    {
      id: 'trace-step',
      kind: 'value',
      cells: 'E9:E10',
      prompt:
        'Trace this loop without running it:\n`For i = 2 To 11 Step 3`\n`Range("G1").Offset(i, 0).Value = i * 5`\n`Next i`\n' +
        'Which cell is written last, and with what value? Type the address in E9 and the value in E10.',
      answer: { E9: 'G12', E10: 55 },
      wrong: ['G11', 'G9'],
      hints: [
        '`Step 3` adds 3 to i each time round: list the values of i until the next one would pass 11.',
        '`Offset(i, 0)` from G1 is row 1 + i.',
      ],
      explain:
        'i takes 2, 5, 8 and 11 (the next value, 14, is past the end), so the last write is `Range("G1").Offset(11, 0)`, ' +
        'which is G12, with 11 * 5 = 55. The end value is included when the steps land on it exactly.',
    },
  ],
  skills: ['For ... Next', 'Step', 'Offset', '& to join text'],
}

// ---------- W9 level 1: Function procedures ----------

const tablesNeeded = (...body: string[]): string => vb('Function TablesNeeded(guests, seats)', ...body.map((s) => `    ${s}`), 'End Function')

const banquetTables: Exercise = {
  id: 'w9-vba-function-tables',
  week: 'W9',
  topic: 'Function procedures (UDF)',
  title: 'How many banquet tables?',
  level: 1,
  minutes: 6,
  scenario:
    'A banquet hall in Marina Bay seats guests at round tables of different sizes and always books whole tables. The sales ' +
    'team wants a TablesNeeded function that macros can call and that works in a cell like any Excel function.',
  sheet: {
    rows: 12,
    cols: 5,
    colWidths: { A: 170, B: 80, C: 120 },
    cells: {
      A1: title('Banquet bookings'),
      A3: header('Event'), B3: header('Guests'), C3: header('Seats per table'),
      ...column('A', 4, ['Wedding lunch', 'Product launch', 'Alumni dinner', 'Board retreat', 'Gala night'], (v) => given(v)),
      ...column('B', 4, [23, 40, 7, 100, 96], (v) => given(v, '0')),
      ...column('C', 4, [6, 8, 10, 12, 12], (v) => given(v, '0')),
      A10: label('n = TablesNeeded(30, 8) + TablesNeeded(30, 10)'),
      A11: label('n'), B11: answer('0'),
    },
  },
  tasks: [
    {
      id: 'tables-needed',
      kind: 'vba',
      cells: '',
      prompt:
        'Write the function `TablesNeeded(guests, seats)`: it returns the number of whole tables needed, rounding any part ' +
        'table up (the events in rows 4-8 need 4, 5, 1, 9 and 8). Use `Int(...)`, not a worksheet function. Check calls it ' +
        'with several guest counts and table sizes.',
      vba: {
        entry: 'TablesNeeded',
        starter: tablesNeeded("' return the number of whole tables (round any part table up)", "' use Int(...), not a worksheet function"),
        solution: tablesNeeded('Dim t As Integer', 't = Int(guests / seats)', 'If t * seats < guests Then t = t + 1', 'TablesNeeded = t'),
        calls: [
          { args: [23, 6], result: 4 },
          { args: [40, 8], result: 5 },
          { args: [7, 10], result: 1 },
          { args: [100, 12], result: 9 },
          { args: [96, 12], result: 8 },
          { args: [0, 8], result: 0 },
        ],
        mustUse: ['Int('],
      },
      wrong: [
        tablesNeeded('TablesNeeded = Int(guests / seats) + 1'),
        tablesNeeded('TablesNeeded = Int(guests / seats)'),
        tablesNeeded('TablesNeeded = guests / seats'),
      ],
      hints: [
        '`Int(x)` drops the fraction: `Int(23 / 6)` is 3 full tables.',
        'If those tables do not seat everyone (`t * seats < guests`), one more table is needed.',
        'A Function returns its result by assigning to its own name: `TablesNeeded = t`.',
      ],
      explain:
        '`Int(guests / seats)` counts the full tables; an extra table is added only when some guests are left over. Always ' +
        'adding 1 would book 6 tables for 40 guests at 8 per table. Because it is a Function in a standard module, Excel also ' +
        'accepts it in a cell, for example =TablesNeeded(B4, C4).',
    },
    {
      id: 'call-trace',
      kind: 'value',
      cells: 'B11',
      prompt: 'A Sub uses your function: `n = TablesNeeded(30, 8) + TablesNeeded(30, 10)`. What is n? Type it in B11.',
      answer: 7,
      wrong: ['8', '6.75'],
      hints: ['Work out each call on its own: 30 guests at 8 per table, then 30 guests at 10 per table.'],
      explain: '30 / 8 = 3.75, so 4 tables; 30 / 10 = 3 exactly, so 3 tables. n = 4 + 3 = 7.',
    },
    {
      id: 'sub-or-function',
      kind: 'explain',
      cells: '',
      prompt:
        'A colleague wrote the rule as `Sub TablesNeeded(guests, seats)`, and =TablesNeeded(B4, C4) in a cell shows ' +
        '#NAME?. Explain the difference between a Sub and a Function, and where each can be used.',
      answer:
        'A Sub carries out actions (writes cells, formats, shows messages) and returns no value. You run it from the Macro ' +
        'dialog, a button or shape, or another procedure (Call), but a cell formula cannot use it. A Function returns one ' +
        'value by assigning it to its own name; VBA can call it (t = TablesNeeded(23, 6)) and a cell can use it like a ' +
        'built-in function, as long as it sits in a standard module (Insert > Module), not in a sheet or ThisWorkbook module. ' +
        'So the rounding rule must be a Function in Module1.',
      hints: ['Ask what each kind of procedure gives back, and from where Excel lets you start it.'],
    },
  ],
  skills: ['Function procedure', 'user-defined function', 'Int', 'Sub vs Function'],
}

// ---------- W9 level 2: Do While until a blank + Select Case ----------

const PARCEL_CODES = [2, 1, 3, 2, 4, 1, 3, 3, 0, 1]
const KIOSK_TEST = [
  "' TestKiosk scans a late parcel into row 14, then runs your macro. Check runs it, so keep it as it is.",
  'Sub TestKiosk()',
  '    Range("A14").Value = "PK-411"',
  '    Range("B14").Value = 2',
  '    AssignLockers',
  'End Sub',
  '',
]

const LOCKER_CASES = [
  '    Select Case Cells(r, 2).Value',
  '        Case 1',
  '            Cells(r, 3).Value = "Small"',
  '            Cells(r, 4).Value = 3.5',
  '        Case 2',
  '            Cells(r, 3).Value = "Medium"',
  '            Cells(r, 4).Value = 5',
  '        Case 3',
  '            Cells(r, 3).Value = "Large"',
  '            Cells(r, 4).Value = 7.5',
  '        Case Else',
  '            Cells(r, 3).Value = "Check code"',
  '            Cells(r, 4).Value = 0',
  '            bad = bad + 1',
  '    End Select',
]

const assignLockers = (loopStart: string, cases: string[], loopEnd: string): string =>
  vb(
    ...KIOSK_TEST,
    'Sub AssignLockers()',
    '    Dim r As Integer, n As Integer, bad As Integer',
    '    r = 4',
    `    ${loopStart}`,
    ...cases.map((s) => `    ${s}`),
    '        n = n + 1',
    '        r = r + 1',
    `    ${loopEnd}`,
    '    Range("G9").Value = n',
    '    Range("G10").Value = bad',
    'End Sub',
  )

const lockerOut: [string, number][] = [
  ['Medium', 5], ['Small', 3.5], ['Large', 7.5], ['Medium', 5], ['Check code', 0], ['Small', 3.5],
  ['Large', 7.5], ['Large', 7.5], ['Check code', 0], ['Small', 3.5], ['Medium', 5],
]

const parcelLockers: Exercise = {
  id: 'w9-vba-select-case-lockers',
  week: 'W9',
  topic: 'Do While loops and Select Case',
  title: 'Assign parcel lockers until the list runs out',
  level: 2,
  minutes: 12,
  scenario:
    'A parcel-locker kiosk at a Punggol MRT station sorts incoming parcels by size code: 1 small, 2 medium, 3 large; any ' +
    'other code is a scanning error. Codes are scanned down column B, and the list is as long as the day is busy. A macro ' +
    'fills in the locker type and fee for every parcel and reports how many it processed.',
  sheet: {
    rows: 22,
    cols: 8,
    colWidths: { A: 80, B: 84, C: 110, D: 70, F: 150, G: 90, H: 70 },
    cells: {
      A1: title('Locker assignment'),
      A3: header('Parcel'), B3: header('Size code'), C3: header('Locker'), D3: header('Fee'),
      ...column('A', 4, PARCEL_CODES, (_, i) => given(`PK-${401 + i}`)),
      ...column('B', 4, PARCEL_CODES, (v) => input(v, '0')),
      B14: { fmt: '0' },
      ...column('C', 4, lockerOut, () => answer()),
      ...column('D', 4, lockerOut, () => answer('$0.00')),
      F3: header('Code'), G3: header('Locker'), H3: header('Fee'),
      F4: given(1, '0'), G4: given('Small'), H4: given(3.5, '$0.00'),
      F5: given(2, '0'), G5: given('Medium'), H5: given(5, '$0.00'),
      F6: given(3, '0'), G6: given('Large'), H6: given(7.5, '$0.00'),
      F7: label('any other code: Check code, $0.00'),
      F9: label('Parcels processed'), G9: answer('0'),
      F10: label('Bad codes'), G10: answer('0'),
      F11: label('Total fees'), G11: calc('=SUM(D4:D20)', '$0.00'),
      F13: label('j after loop 1'), G13: answer('0'),
      F14: label('j after loop 2'), G14: answer('0'),
    },
  },
  tasks: [
    {
      id: 'assign',
      kind: 'vba',
      cells: 'C4:D14',
      prompt:
        'Write `AssignLockers`: start at row 4 and work down until the size code in column B is blank. Use `Select Case` ' +
        'on the code: 1 Small 3.50, 2 Medium 5.00, 3 Large 7.50, anything else Check code and 0. Write the locker in column ' +
        'C and the fee in column D, then the number of parcels processed in G9 and the number of bad codes in G10. ' +
        '`TestKiosk` first scans a late parcel into row 14; Check runs TestKiosk, so leave it unchanged.',
      vba: {
        entry: 'TestKiosk',
        starter: vb(
          ...KIOSK_TEST,
          'Sub AssignLockers()',
          '    Dim r As Integer, n As Integer, bad As Integer',
          '    r = 4',
          "    ' loop down column B until the size code is blank",
          "    ' Select Case on the code: locker in column C, fee in column D",
          "    ' count every parcel (n) and every bad code (bad)",
          "    ' after the loop: n in G9, bad in G10",
          'End Sub',
        ),
        solution: assignLockers('Do While Cells(r, 2).Value <> ""', LOCKER_CASES, 'Loop'),
        expected: {
          ...Object.fromEntries(lockerOut.map(([locker], i) => [`C${4 + i}`, locker])),
          ...Object.fromEntries(lockerOut.map(([, fee], i) => [`D${4 + i}`, fee])),
          C15: null, G9: 11, G10: 2, G11: 48,
        },
        mustUse: ['Select Case', 'Loop'],
      },
      wrong: [
        assignLockers('For r = 4 To 13', LOCKER_CASES, 'Next r').replace('        r = r + 1\n', ''),
        assignLockers('Do While Cells(r, 2).Value <> ""', LOCKER_CASES.slice(0, 10).concat(['    End Select']), 'Loop'),
        assignLockers('Do While Cells(r, 3).Value <> ""', LOCKER_CASES, 'Loop'),
      ],
      hints: [
        'Keep a row counter: start r at 4 and loop `Do While Cells(r, 2).Value <> ""` ... `Loop`, adding 1 to r inside the loop.',
        '`Select Case Cells(r, 2).Value` with `Case 1`, `Case 2`, `Case 3` and `Case Else` for everything else.',
        'n counts every parcel; bad counts only inside `Case Else`. Write both after the loop ends.',
      ],
      explain:
        '`Do While ... <> ""` handles however many parcels there are and stops at the first blank code, so the late parcel ' +
        'in row 14 is processed without changing the code; a `For r = 4 To 13` loop would miss it. `Select Case` compares ' +
        'one value with each Case in turn, and `Case Else` catches every other value (0 and 4 here), which is why those ' +
        'rows say Check code. Integer counters start at 0 when declared.',
    },
    {
      id: 'loop-types',
      kind: 'value',
      cells: 'G13:G14',
      prompt:
        'Both loops start with j = 12.\nLoop 1: `Do` / `j = j + 5` / `Loop While j < 10`\n' +
        'Loop 2: `Do While j < 10` / `j = j + 5` / `Loop`\nWhat is j after each loop? Type the values in G13 and G14.',
      answer: { G13: 17, G14: 12 },
      wrong: ['12', '22'],
      hints: [
        'Loop 1 tests its condition at the bottom, after the body has already run once.',
        'Loop 2 tests at the top: when the condition is FALSE from the start, the body never runs.',
      ],
      explain:
        '`Do ... Loop While` tests after the body, so it always runs at least once: 12 + 5 = 17, then 17 < 10 is FALSE and ' +
        'it stops. `Do While ... Loop` tests first: 12 < 10 is FALSE, so the body is skipped and j stays 12. The same holds ' +
        'for Until: a test-first loop may run zero times, a test-last loop runs at least once.',
    },
  ],
  skills: ['Do While until a blank cell', 'Select Case', 'Case Else', 'counters', 'test-first vs test-last loops'],
}

// ---------- W9 level 2: InputBox, validation and error trapping ----------

const DOSE_TEST = [
  "' TestPrompts runs SetDose four times; Check answers the prompts with 2.5, lots, 9 and a blank (Cancel).",
  "' After each run it logs B2 and B3 in E6:F9. Check runs it, so keep it as it is.",
  'Sub TestPrompts()',
  '    Dim i As Integer',
  '    For i = 1 To 4',
  '        SetDose',
  '        Range("E5").Offset(i, 0).Value = Range("B2").Value',
  '        Range("F5").Offset(i, 0).Value = Range("B3").Value',
  '    Next i',
  'End Sub',
  '',
]

const DOSE_BODY = [
  'Dim txt As String',
  'Dim dose As Single',
  'On Error GoTo BadEntry',
  'txt = InputBox("Litres per tray (0.5 to 5)")',
  'If txt = "" Then',
  '    Range("B3").Value = "Cancelled"',
  '    Exit Sub',
  'End If',
  'dose = txt',
  'If dose < 0.5 Or dose > 5 Then GoTo BadEntry',
  'Range("B2").Value = dose',
  'Range("B3").Value = "OK"',
  'Exit Sub',
  'BadEntry:',
  'Range("B3").Value = "Invalid"',
]

const setDose = (body: string[]): string =>
  vb(...DOSE_TEST, 'Sub SetDose()', ...body.map((s) => (s.endsWith(':') ? s : `    ${s}`)), 'End Sub')

const wateringDose: Exercise = {
  id: 'w9-vba-inputbox-errors',
  week: 'W9',
  topic: 'InputBox, validation and On Error',
  title: 'Set the watering dose safely',
  level: 2,
  minutes: 12,
  scenario:
    'A plant nursery in Lim Chu Kang sets the litres of water per tray for its beds. Staff type the dose into a prompt, and ' +
    'a typo must never break the watering plan in column C: only 0.5 to 5 litres is allowed. The macro should accept a good ' +
    'dose, refuse anything else with a status message, and do nothing when the prompt is cancelled.',
  sheet: {
    rows: 14,
    cols: 6,
    colWidths: { A: 130, B: 90, C: 80, E: 90, F: 110 },
    cells: {
      A1: title('Watering plan'),
      A2: label('Litres per tray'), B2: input(1, '0.0'),
      A3: label('Status'), B3: answer(),
      A5: header('Bed'), B5: header('Trays'), C5: header('Litres'),
      ...column('A', 6, ['Bed A', 'Bed B', 'Bed C', 'Bed D'], (v) => given(v)),
      ...column('B', 6, [12, 8, 15, 6], (v) => given(v, '0')),
      ...column('C', 6, [6, 7, 8, 9], (r) => calc(`=B${r}*$B$2`, '0.0')),
      E5: header('Dose after'), F5: header('Status after'),
      ...block('E', 'E', 6, 9, () => ({ fmt: '0.0' })),
      A11: label('Space test: A, B or C?'), A12: label('Your answer'), B12: answer(),
    },
  },
  tasks: [
    {
      id: 'set-dose',
      kind: 'vba',
      cells: 'B2:B3',
      prompt:
        'Write `SetDose`: ask with `InputBox("Litres per tray (0.5 to 5)")`. A blank reply (Cancel) writes Cancelled in B3 ' +
        'and changes nothing else. A number from 0.5 to 5 goes into B2 and writes OK in B3. Anything else (text, or a number ' +
        'out of range) writes Invalid in B3 and leaves B2 alone; trap conversion errors with `On Error GoTo`. `TestPrompts` ' +
        'runs SetDose four times with the replies 2.5, lots, 9 and a blank, logging B2 and B3 after each run in E6:F9. Check ' +
        'runs TestPrompts, so leave it unchanged.',
      vba: {
        entry: 'TestPrompts',
        starter: vb(
          ...DOSE_TEST,
          'Sub SetDose()',
          "    ' ask: InputBox(\"Litres per tray (0.5 to 5)\")",
          "    ' blank reply -> B3 Cancelled; 0.5 to 5 -> B2 and B3 OK; anything else -> B3 Invalid",
          'End Sub',
        ),
        solution: setDose(DOSE_BODY),
        inputs: ['2.5', 'lots', '9', ''],
        expected: {
          B2: 2.5, B3: 'Cancelled',
          ...rows('E', 6, [[2.5, 'OK'], [2.5, 'Invalid'], [2.5, 'Invalid'], [2.5, 'Cancelled']]),
          C6: 30, C7: 20, C8: 37.5, C9: 15,
        },
        mustUse: ['InputBox', 'On Error'],
      },
      wrong: [
        setDose(DOSE_BODY.map((s) => (s === 'If txt = "" Then' ? 'If txt = " " Then' : s))),
        setDose(DOSE_BODY.filter((s) => !s.startsWith('If dose <'))),
        setDose(DOSE_BODY.filter((s, i) => !(s === 'Exit Sub' && i > 8))),
        setDose(DOSE_BODY.filter((s) => s !== 'On Error GoTo BadEntry')),
      ],
      hints: [
        'Read the reply as text first (`Dim txt As String`) and test `If txt = "" Then` before converting it.',
        '`On Error GoTo BadEntry` at the top sends any run-time error, such as turning "lots" into a number, to the line labelled `BadEntry:`.',
        'An out-of-range number can jump to the same label with `GoTo BadEntry`. Put `Exit Sub` just before the label so a good dose does not run the error lines too.',
      ],
      explain:
        'Reading the reply into a String lets the macro spot a blank (Cancel) before any conversion. Assigning text such as ' +
        '"lots" to a Single raises a Type mismatch, which `On Error GoTo BadEntry` turns into a status message instead of ' +
        'the debugger; an out-of-range number jumps to the same label with `GoTo`. The `Exit Sub` before the label matters: ' +
        'without it, a good dose would fall through into the BadEntry lines and end as Invalid.',
    },
    {
      id: 'space-test',
      kind: 'value',
      cells: 'B12',
      prompt:
        'Another version tests the reply with `If txt = " " Then Exit Sub` (a space between the quotes) before ' +
        '`dose = txt`, with `On Error GoTo BadEntry` at the top. The user presses Cancel, so txt is "". What happens? ' +
        'Type A, B or C in B12.\nA. The macro exits quietly.\nB. B2 becomes 0.\nC. The code jumps to BadEntry and reports an invalid entry.',
      answer: 'C',
      wrong: ['A', 'B'],
      hints: ['Is "" (nothing) equal to " " (one space)? If not, the next line converts "" to a number.'],
      explain:
        '"" is not equal to " ", so the test fails and `dose = txt` tries to turn an empty text into a number. That raises a ' +
        'Type mismatch, and the error trap jumps to BadEntry. Test blank replies with `= ""`.',
    },
  ],
  skills: ['InputBox', 'input validation', 'On Error GoTo', 'Exit Sub', 'GoTo label'],
}

// ---------- W9 level 2: variables, arrays, For Each and With ----------

const WEEK_TEST = [
  "' TestWeek loads another week (target 200, Friday 330 cups) and runs your macro.",
  "' Check runs it, so keep it as it is.",
  'Sub TestWeek()',
  '    Range("E2").Value = 200',
  '    Range("C9").Value = 330',
  '    WeekSummary',
  'End Sub',
  '',
]

const WEEK_BODY = [
  'Dim cups(1 To 7) As Integer',
  'Dim i As Integer, best As Integer, below As Integer',
  'Dim total As Long',
  'For i = 1 To 7',
  '    cups(i) = Range("C4").Offset(i, 0).Value',
  'Next i',
  'best = 1',
  'For i = 1 To 7',
  '    total = total + cups(i)',
  '    If cups(i) > cups(best) Then best = i',
  '    If cups(i) < Range("E2").Value Then',
  '        Range("D4").Offset(i, 0).Value = "Yes"',
  '        below = below + 1',
  '    Else',
  '        Range("D4").Offset(i, 0).Value = "No"',
  '    End If',
  'Next i',
  'Range("H5").Value = total',
  'Range("H6").Value = Range("B4").Offset(best, 0).Value',
  'Range("H7").Value = below',
]

const weekSummary = (body: string[]): string =>
  vb('Option Explicit', '', ...WEEK_TEST, 'Sub WeekSummary()', ...body.map((s) => `    ${s}`), 'End Sub')

const SHARE_TEST = [
  "' TestShare loads the same test week (target 200, Friday 330 cups) and runs your macro.",
  "' Check runs it, so keep it as it is.",
  'Sub TestShare()',
  '    Range("E2").Value = 200',
  '    Range("C9").Value = 330',
  '    ShowShare',
  'End Sub',
  '',
]

const showShare = (...body: string[]): string => vb(...SHARE_TEST, 'Sub ShowShare()', ...body.map((s) => `    ${s}`), 'End Sub')
const WEEK_CUPS = [165, 192, 178, 210, 240, 305, 288]
const TEST_CUPS = [165, 192, 178, 210, 330, 305, 288]   // the test week the drivers load: Friday 330
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const kopiWeek: Exercise = {
  id: 'w9-vba-arrays-with',
  week: 'W9',
  topic: 'Variables, arrays, For Each and With',
  title: 'A week of kopi sales in an array',
  level: 2,
  minutes: 15,
  scenario:
    'A kopi stall at a Toa Payoh hawker centre logs the cups sold each day. The owner wants one macro that loads the week ' +
    'into an array, flags the days below the daily target, and reports the total, the best day and the number of slow days, ' +
    'plus a second macro that shows each day as a share of the target.',
  sheet: {
    rows: 12,
    cols: 8,
    colWidths: { A: 28, B: 64, C: 70, D: 110, E: 120, G: 170, H: 80 },
    cells: {
      A1: title('Kopi stall: cups sold this week'),
      D2: label('Daily target'), E2: input(180, '0'),
      B4: header('Day'), C4: header('Cups'), D4: header('Below target?'), E4: header('Share of target'),
      ...column('B', 5, DAYS, (v) => given(v)),
      ...column('C', 5, WEEK_CUPS, (v) => input(v, '0')),
      ...column('D', 5, DAYS, () => answer()),
      ...column('E', 5, DAYS, () => answer('0%')),
      G5: label('Total cups'), H5: answer('0'),
      G6: label('Best day'), H6: answer(),
      G7: label('Days below target'), H7: answer('0'),
      G9: label('Integer variable(s)'), H9: answer(),
      G10: label('Largest Integer value'), H10: answer('0'),
    },
  },
  tasks: [
    {
      id: 'week-summary',
      kind: 'vba',
      cells: 'D5:D11',
      prompt:
        'Write `WeekSummary` under Option Explicit: load the seven daily counts into the array `cups(1 To 7)`, then loop ' +
        'over the array to write Yes or No in column D (below the target in E2 or not), and write the week\'s total in H5, ' +
        'the best day\'s name in H6 and the number of days below target in H7. `TestWeek` changes the target to 200 and ' +
        'Friday to 330 cups before running it; Check runs TestWeek, so leave it unchanged.',
      vba: {
        entry: 'TestWeek',
        starter: vb(
          'Option Explicit',
          '',
          ...WEEK_TEST,
          'Sub WeekSummary()',
          '    Dim cups(1 To 7) As Integer',
          "    ' 1. load C5:C11 into the array",
          "    ' 2. loop over the array: Yes/No in column D, running total, best day, days below target",
          "    ' 3. total in H5, best day's name in H6, days below target in H7",
          'End Sub',
        ),
        solution: weekSummary(WEEK_BODY),
        expected: {
          ...Object.fromEntries(['Yes', 'Yes', 'Yes', 'No', 'No', 'No', 'No'].map((v, i) => [`D${5 + i}`, v])),
          H5: 1668, H6: 'Fri', H7: 3,
        },
        mustUse: ['Option Explicit'],
      },
      wrong: [
        weekSummary(WEEK_BODY.filter((s) => s !== 'best = 1')),
        weekSummary(WEEK_BODY.map((s) => s.replace('< Range("E2").Value', '< 180'))),
        weekSummary(WEEK_BODY.map((s) => (s.startsWith('Range("H6")') ? 'Range("H6").Value = best' : s))),
      ],
      hints: [
        'Fill the array in a first loop: `cups(i) = Range("C4").Offset(i, 0).Value` for i = 1 To 7.',
        'Keep the position of the best day so far: start with `best = 1` and update it with `If cups(i) > cups(best) Then best = i`.',
        'Under Option Explicit every variable needs a Dim, including the counters and the total.',
      ],
      explain:
        'The array holds the whole week in one variable, so the second loop can total, compare and flag without reading the ' +
        'sheet again. Storing the best day as a position (best = 5) lets you fetch its name with `Range("B4").Offset(best, 0)`. ' +
        'Comparing with Range("E2") rather than a typed 180 is what keeps the flags right when TestWeek changes the target.',
    },
    {
      id: 'share',
      kind: 'vba',
      cells: 'E5:E11',
      prompt:
        'Write `ShowShare`: a `For Each` loop over the cells of C5:C11 with a `With` block on each cell\'s `.Offset(0, 2)`, ' +
        'which writes the day\'s cups divided by the target in E2 and sets the NumberFormat to 0%. `TestShare` loads the ' +
        'same test week as TestWeek first; Check runs TestShare, so leave it unchanged.',
      vba: {
        entry: 'TestShare',
        starter: vb(
          ...SHARE_TEST,
          'Sub ShowShare()',
          '    Dim cell As Range',
          "    ' For Each cell In C5:C11, With cell.Offset(0, 2): .Value = share of target, .NumberFormat = \"0%\"",
          'End Sub',
        ),
        solution: showShare(
          'Dim cell As Range',
          'For Each cell In Range("C5:C11")',
          '    With cell.Offset(0, 2)',
          '        .Value = cell.Value / Range("E2").Value',
          '        .NumberFormat = "0%"',
          '    End With',
          'Next cell',
        ),
        expected: Object.fromEntries(TEST_CUPS.map((c, i) => [`E${5 + i}`, c / 200])),
        mustUse: ['For Each', 'With'],
      },
      wrong: [
        showShare('Dim cell As Range', 'For Each cell In Range("C5:C11")', '    With cell.Offset(0, 1)', '        .Value = cell.Value / Range("E2").Value', '    End With', 'Next cell'),
        showShare('Dim cell As Range', 'For Each cell In Range("C5:C11")', '    With cell.Offset(0, 2)', '        .Value = cell.Value / 180', '    End With', 'Next cell'),
      ],
      hints: [
        '`For Each cell In Range("C5:C11")` ... `Next cell` visits each cell; declare `cell As Range`.',
        'Inside `With cell.Offset(0, 2)` ... `End With`, a line that starts with a dot (.Value, .NumberFormat) works on that cell.',
      ],
      explain:
        '`For Each` walks the cells of a range without a counter, and `With` names the target cell once so `.Value` and ' +
        '`.NumberFormat` both apply to it. Dividing by Range("E2") keeps the shares right when the target changes.',
    },
    {
      id: 'declarations',
      kind: 'value',
      cells: 'H9:H10',
      prompt:
        'A module declares `Dim p, q, r As Integer`. Which of p, q and r are Integers? Type the name or names in H9. Then type ' +
        'the largest value an Integer variable can hold in H10.',
      answer: { H9: 'r', H10: 32767 },
      wrong: ['p, q, r', 'p'],
      hints: [
        'In VBA, `As Integer` applies only to the name right before it; a name without its own As is a Variant.',
        'An Integer takes 2 bytes (16 bits, signed).',
      ],
      explain:
        'Only r is an Integer: p and q have no type of their own, so they are Variants (16 bytes each). Write ' +
        '`Dim p As Integer, q As Integer, r As Integer` instead. An Integer uses 2 bytes, so it holds -32,768 to 32,767; ' +
        'counts that can pass that need a Long.',
    },
    {
      id: 'option-explicit',
      kind: 'explain',
      cells: '',
      prompt:
        'Why start every module with Option Explicit? Use a typo as your example, such as `totl = totl + cups(i)` written ' +
        'instead of `total = total + cups(i)`.',
      answer:
        'Option Explicit makes VBA refuse to run until every variable is declared with Dim. Without it, the typo totl ' +
        'silently creates a new, empty Variant: the loop adds to totl, total stays 0, and H5 shows 0 with no error, so the ' +
        'mistake is easy to miss. With it, the editor stops at totl with "Variable not defined". Declaring with a type ' +
        '(Dim total As Long) also catches type mistakes early and uses less memory than Variants.',
      hints: ['What does VBA do with a name it has never seen when Option Explicit is missing?'],
    },
  ],
  skills: ['Dim and data types', 'arrays', 'For Each', 'With', 'Option Explicit'],
}

// ---------- W9 level 3: queue timer with time stamps ----------

const STAMPS: [string, number][] = [
  ['C8', tod(8, 52, 10)], ['D8', tod(8, 55, 40)], ['E8', tod(8, 59, 5)],
  ['C9', tod(8, 57, 30)], ['D9', tod(8, 59, 5)], ['E9', tod(9, 4, 50)],
  ['C10', tod(9, 2, 0)], ['D10', tod(9, 4, 50)], ['E10', tod(9, 11, 30)],
]

const MORNING_TEST = [
  "' TestMorning replays a morning at the counter. Check runs it, so keep it as it is.",
  'Sub TestMorning()',
  '    SetClock 9, 12, 30',
  '    StampArrive',
  '    SetClock 9, 13, 5',
  '    StampStart',
  '    SetClock 9, 15, 40',
  '    StampArrive',
  '    SetClock 9, 18, 20',
  '    StampEnd',
  '    SetClock 9, 18, 50',
  '    StampStart',
  '    SetClock 9, 20, 15',
  '    StampArrive',
  'End Sub',
  '',
  "' the practice clock: in the real workbook D3 holds =NOW()",
  'Sub SetClock(h, m, s)',
  '    Range("D3").Value = h / 24 + m / 1440 + s / 86400',
  'End Sub',
  '',
]

const stamp = (name: string, col: string, paste: string, jump = `Range("${col}6").End(xlDown).Offset(1, 0)`): string[] => [
  `Sub ${name}()`,
  '    Calculate',
  `    Range("${col}7").Copy`,
  `    ${jump}.PasteSpecial Paste:=${paste}`,
  '    Application.CutCopyMode = False',
  'End Sub',
  '',
]

const stamps = (paste: string, jump?: (col: string) => string): string =>
  vb(
    ...MORNING_TEST,
    ...stamp('StampArrive', 'C', paste, jump?.('C')),
    ...stamp('StampStart', 'D', paste, jump?.('D')),
    ...stamp('StampEnd', 'E', paste, jump?.('E')),
  )

const queueTimer: Exercise = {
  id: 'w9-vba-queue-timer',
  week: 'W9',
  topic: 'Time-stamp macros',
  title: 'Pharmacy counter timer',
  level: 3,
  minutes: 30,
  scenario:
    'A polyclinic pharmacy counter in Bedok wants real data on how long patients wait. An observer presses Arrive when a ' +
    'patient joins the queue, Start when the pharmacist calls them and End when they leave; each button copies the current ' +
    'time from row 7 and pastes it as a value under its column. In the real workbook D3 holds =NOW(); here D3 is a typed ' +
    'practice clock, so results are repeatable. Three patients are already logged.',
  sheet: {
    rows: 24,
    cols: 8,
    colWidths: { A: 28, B: 70, C: 84, D: 84, E: 84, F: 96, G: 110 },
    cells: {
      A1: title('Pharmacy counter timer'),
      C3: label('Clock'), D3: { ...input(tod(9, 0, 0), 'h:mm:ss'), note: 'Practice clock. In the real workbook this cell holds =NOW() and F9 refreshes it.' },
      B6: header('Patient'), C6: header('Arrive'), D6: header('Start'), E6: header('End'), F6: header('Wait (min)'), G6: header('Service (min)'),
      B7: label('now'), C7: calc('=$D$3', 'h:mm:ss'), D7: calc('=$D$3', 'h:mm:ss'), E7: calc('=$D$3', 'h:mm:ss'),
      ...column('B', 8, Array.from({ length: 13 }, (_, i) => i + 1), (v) => given(v, '0')),
      ...block('C', 'E', 11, 20, () => ({ fmt: 'h:mm:ss' })),
      ...Object.fromEntries(STAMPS.map(([ref, v]) => [ref, input(v, 'h:mm:ss')])),
      ...block('F', 'G', 8, 20, () => answer('0.00')),
      B22: label('Average wait (min)'), F22: answer('0.00'),
      B23: label('Share of waits over 3 min'), F23: answer('0%'),
    },
  },
  tasks: [
    {
      id: 'wait',
      kind: 'formula',
      cells: 'F8:F20',
      prompt:
        'In F8, write the wait in minutes: call time (Start) minus arrival time, times 1440. Show "" while the patient has ' +
        'not been called (D8 blank). Fill it down to F20.',
      solution: '=IF(D8="","",(D8-C8)*1440)',
      check: { tol: 1e-6 },
      wrong: ['=IF(D8="","",(D8-C8)*24)', '=IF(D8="","",D8-C8)', '=(D8-C8)*1440'],
      hints: [
        'Excel stores a time as a fraction of a day, so a difference of times is a fraction of a day too.',
        'A day has 1440 minutes: multiply the difference by 1440.',
        '`IF`(D8="", "", ...) keeps rows without a Start time blank instead of showing a negative wait.',
      ],
      explain:
        'Times are day fractions, so Start - Arrive is a fraction of a day and x1440 turns it into minutes (x24 would give ' +
        'hours, x86400 seconds). The `IF` guard returns "" until the Start time exists; AVERAGE and COUNT later skip those "" ' +
        'cells, so only called patients count.',
    },
    {
      id: 'service',
      kind: 'formula',
      cells: 'G8:G20',
      prompt: 'In G8, write the service time in minutes (End minus Start, times 1440), "" while the patient is still at the counter (E8 blank). Fill down to G20.',
      solution: '=IF(E8="","",(E8-D8)*1440)',
      wrong: ['=IF(E8="","",(E8-C8)*1440)', '=IF(E8="","",(E8-D8)*60)'],
      hints: ['Same pattern as the wait, with End and Start.', 'End minus Arrive would be the time in the system, not the service time.'],
      explain:
        'Service time runs from the call (Start) to the departure (End). End - Arrive would add the wait as well, which is the ' +
        'time in the system. The guard on E keeps patients still being served out of the numbers.',
    },
    {
      id: 'stamp-macros',
      kind: 'vba',
      cells: 'C11:E13',
      prompt:
        'Write `StampArrive`, `StampStart` and `StampEnd`. Each runs `Calculate`, copies its own column\'s clock cell in ' +
        'row 7 (C7, D7 or E7) and pastes it as values and number formats into the first empty cell under that column\'s ' +
        'header (`End(xlDown)` from row 6, then one row down), then cancels copy mode. (Assigning the clock cell\'s `.Value` ' +
        'to that cell freezes the time too.) `TestMorning` sets the practice clock and presses the buttons in the order a ' +
        'morning at the counter would; Check runs TestMorning, so leave it unchanged.',
      vba: {
        entry: 'TestMorning',
        starter: vb(
          ...MORNING_TEST,
          'Sub StampArrive()',
          "    ' Calculate, copy C7, paste values and number formats below the last stamp in column C",
          'End Sub',
          '',
          'Sub StampStart()',
          'End Sub',
          '',
          'Sub StampEnd()',
          'End Sub',
        ),
        solution: stamps('xlPasteValuesAndNumberFormats'),
        expected: {
          C11: tod(9, 12, 30), D11: tod(9, 13, 5), C12: tod(9, 15, 40), E11: tod(9, 18, 20), D12: tod(9, 18, 50), C13: tod(9, 20, 15),
          C14: null, D13: null, E12: null,
        },
        mustUse: ['xlDown'],
      },
      wrong: [
        stamps('xlPasteFormulas'),
        stamps('xlPasteValuesAndNumberFormats', (col) => `Range("${col}6").End(xlDown)`),
        stamps('xlPasteValuesAndNumberFormats', (col) => `Range("${col}11")`),
      ],
      hints: [
        'Each macro has four lines: `Calculate`, `Range("C7").Copy`, a PasteSpecial, `Application.CutCopyMode = False`.',
        '`Range("C6").End(xlDown)` is the last filled cell under the header (row 7 is never empty); `.Offset(1, 0)` is the empty cell below it.',
        'Paste with `Paste:=xlPasteValuesAndNumberFormats`: a formula would keep showing the current clock.',
      ],
      explain:
        'Row 7 always shows the clock, so each button copies its own row-7 cell and pastes it as a value: the time freezes, ' +
        'which is the whole point of a stamp. A pasted formula (=$D$3) would keep changing with the clock. `End(xlDown)` ' +
        'from the header finds the last stamp in that column, whatever its length, and `Offset(1, 0)` steps to the free cell ' +
        'below, so each column grows independently. `Calculate` plays the role of F9 before copying.',
    },
    {
      id: 'avg-wait',
      kind: 'formula',
      cells: 'F22',
      prompt: 'In F22, the average wait in minutes of the patients called so far (`AVERAGE` skips the "" rows).',
      solution: '=AVERAGE(F8:F20)',
      check: { mustUse: ['AVERAGE'] },
      wrong: ['=SUM(F8:F20)/13', '=AVERAGE(G8:G20)'],
      hints: ['`AVERAGE` ignores text, and "" is text, so average the whole column F8:F20.'],
      explain:
        '`AVERAGE`(F8:F20) uses only the numeric waits, so it updates by itself as the stamp macros add patients. Dividing ' +
        'the sum by 13 would count empty rows as zero waits.',
    },
    {
      id: 'over-3',
      kind: 'formula',
      cells: 'F23',
      prompt: 'In F23, the share of called patients who waited more than 3 minutes: `COUNTIF` over the waits divided by `COUNT` of the waits.',
      solution: '=COUNTIF(F8:F20,">3")/COUNT(F8:F20)',
      check: { mustUse: ['COUNTIF', 'COUNT'] },
      wrong: ['=COUNTIF(F8:F20,">3")', '=COUNTIF(F8:F20,"<=3")/COUNT(F8:F20)', '=COUNTIF(F8:F20,">3")/13'],
      hints: ['`COUNTIF`(F8:F20, ">3") counts the long waits.', '`COUNT` counts only numbers, so it skips the "" rows: it is the number of called patients.'],
      explain:
        'A service-level measure: long waits over called patients. `COUNT` skips the "" rows, so the share is over patients ' +
        'actually called; the criteria string ">3" is how COUNTIF takes a comparison.',
    },
    {
      id: 'events',
      kind: 'explain',
      cells: '',
      prompt:
        'The observer would rather type a ticket number in column B and have the arrival stamped automatically, with no ' +
        'button. Which event procedure would you use, where must its code go, and what should it check before stamping?',
      answer:
        'Use Private Sub Worksheet_Change(ByVal Target As Range) in the timer sheet\'s own code module (in the VB Editor, ' +
        'double-click the sheet in the Project Explorer, then pick Worksheet and Change), not in Module1, where Excel never ' +
        'calls it. Excel passes the edited cells as Target, so first test If Intersect(Target, Range("B8:B20")) Is Nothing ' +
        'Then Exit Sub, then stamp the arrival in the same row (Target.Offset(0, 1).Value = Now, or copy C7 as a value). ' +
        'Without the test, every edit anywhere, including the stamp the macro itself writes, would fire the event again. ' +
        'Workbook_Open in ThisWorkbook is the event for code that should run when the file opens.',
      hints: ['Events are Subs with fixed names that Excel calls itself. Which object owns a cell edit, and which argument tells you the edited cell?'],
    },
  ],
  testCases: [
    { name: 'Patient 1 called at 8:57:00', inputs: { D8: tod(8, 57, 0) } },
    { name: 'Patient 3 arrived at 9:00:30', inputs: { C10: tod(9, 0, 30) } },
    { name: 'Patient 2 left at 9:06:10', inputs: { E9: tod(9, 6, 10) } },
  ],
  skills: ['time stamps', 'Calculate', 'End(xlDown)', 'Paste Special values', 'time arithmetic', 'events'],
  techniques: ['Time arithmetic (durations, x24, /1440, /86400)', 'Queue performance measures (weighted wait, % within threshold, utilisation)'],
}

// ---------- W9 level 3: post deliveries to a ledger ----------

const INBOX = [
  ['Leaf & Co', 'Black tea (kg)', 20, 20, 18.5],
  ['Pearl Supply', 'Tapioca pearls (kg)', 50, 44, 3.2],
  ['DairyLand', 'Milk powder (kg)', 30, 30, 9.8],
  ['SugarWorks', 'Brown sugar (kg)', 25, 20, 2.4],
  ['CupCraft', 'Cups 700 ml (sleeve)', 40, 40, 6.5],
] as const

const LEDGER = [
  ['Leaf & Co', 'Green tea (kg)', 15, 15, 21, 'OK'],
  ['Pearl Supply', 'Tapioca pearls (kg)', 50, 50, 3.2, 'OK'],
  ['DairyLand', 'Fresh milk (L)', 60, 52, 2.05, 'Short'],
  ['SugarWorks', 'Syrup (bottle)', 24, 24, 7.9, 'OK'],
] as const

const fmtOf = (j: number): string | undefined => (j === 2 || j === 3 ? '0' : j === 4 ? '$0.00' : undefined)

const POST_TEST = [
  "' TestTwoDays posts today's inbox, types one delivery for tomorrow and posts again.",
  "' Check runs it, so keep it as it is.",
  'Sub TestTwoDays()',
  '    PostDeliveries',
  '    Range("B5").Value = "DairyLand"',
  '    Range("C5").Value = "Fresh milk (L)"',
  '    Range("D5").Value = 60',
  '    Range("E5").Value = 55',
  '    Range("F5").Value = 2.05',
  '    PostDeliveries',
  'End Sub',
  '',
]

const POST_BODY = [
  'Dim r As Integer, n As Integer',
  'Dim dest As Range',
  'r = 5',
  'Do While Cells(r, 2).Value <> ""',
  '    Set dest = Range("B15").End(xlDown).Offset(1, 0)',
  '    Range(Cells(r, 2), Cells(r, 6)).Copy',
  '    dest.PasteSpecial Paste:=xlPasteValues',
  '    With dest',
  '        If .Offset(0, 3).Value < .Offset(0, 2).Value Then',
  '            .Offset(0, 5).Value = "Short"',
  '        Else',
  '            .Offset(0, 5).Value = "OK"',
  '        End If',
  '    End With',
  '    n = n + 1',
  '    r = r + 1',
  'Loop',
  'Application.CutCopyMode = False',
  'Range("B5:F12").ClearContents',
  'Range("J4").Value = Now',
  'Range("J6").Value = n',
]

const postDeliveries = (body: string[]): string => vb(...POST_TEST, 'Sub PostDeliveries()', ...body.map((s) => `    ${s}`), 'End Sub')

const posted = [
  ...INBOX.map((d) => [...d, d[3] < d[2] ? 'Short' : 'OK']),
  ['DairyLand', 'Fresh milk (L)', 60, 55, 2.05, 'Short'],
]

const stockLedger: Exercise = {
  id: 'w9-vba-post-deliveries',
  week: 'W9',
  topic: 'End-to-end macro: loop, last row, copy values',
  title: "Post the day's deliveries to the stock ledger",
  level: 3,
  minutes: 30,
  scenario:
    "A bubble-tea chain's central kitchen in Kallang logs supplier deliveries during the day in an inbox (B5:F12). At " +
    'closing, a Post macro must copy every delivery to the bottom of the stock ledger as values, flag deliveries that ' +
    'came in short, clear the inbox and stamp the posting time. The inbox length changes every day, and the ledger ' +
    'already holds earlier deliveries.',
  sheet: {
    rows: 32,
    cols: 10,
    colWidths: { A: 24, B: 110, C: 150, D: 70, E: 70, F: 76, G: 64, H: 16, I: 230, J: 130 },
    cells: {
      A1: title('Central kitchen: deliveries'),
      B3: title("Today's inbox"),
      B4: header('Supplier'), C4: header('Item'), D4: header('Ordered'), E4: header('Received'), F4: header('Unit cost'),
      ...Object.fromEntries(INBOX.flatMap((d, i) => d.map((v, j) => [`${'BCDEF'[j]}${5 + i}`, input(v, fmtOf(j))]))),
      ...block('D', 'E', 10, 12, () => ({ fmt: '0' })),
      ...block('F', 'F', 10, 12, () => ({ fmt: '$0.00' })),
      B14: title('Stock ledger'),
      B15: header('Supplier'), C15: header('Item'), D15: header('Ordered'), E15: header('Received'), F15: header('Unit cost'), G15: header('Status'),
      ...Object.fromEntries(LEDGER.flatMap((d, i) => d.map((v, j) => [`${'BCDEFG'[j]}${16 + i}`, input(v, fmtOf(j))]))),
      ...block('D', 'E', 20, 31, () => ({ fmt: '0' })),
      ...block('F', 'F', 20, 31, () => ({ fmt: '$0.00' })),
      I3: title('Posting'),
      I4: label('Posted at'), J4: answer('d mmm yyyy h:mm'),
      I5: label('Stamp check'),
      J5: calc('=IF(COUNT(J4)=0,"not posted",IFERROR(FORMULATEXT(J4),"frozen"))'),
      I6: label('Rows posted by the last run'), J6: answer('0'),
      I8: label('Short deliveries in the ledger'), J8: answer('0'),
      I9: label('Cost of goods received'), J9: answer('$#,##0.00'),
      I11: label('End(xlDown) on an empty column'), J11: answer('0'),
    },
  },
  tasks: [
    {
      id: 'post',
      kind: 'vba',
      cells: 'B20:G25',
      prompt:
        'Write `PostDeliveries`: walk down the inbox from row 5 until Supplier (column B) is blank. For each delivery, copy ' +
        'B:F of that row as values to the first empty row under the ledger header (find it with `End(xlDown)` from B15) and ' +
        'write Short in column G when Received is below Ordered, else OK, using a `With` block on the destination cell. ' +
        'Then clear the inbox B5:F12, stamp the posting ' +
        'time into J4 as a value with the VBA function Now, and write the number of rows posted in J6. `TestTwoDays` posts ' +
        "today's inbox, " +
        'types one delivery for tomorrow and posts again; Check runs TestTwoDays, so leave it unchanged.',
      vba: {
        entry: 'TestTwoDays',
        starter: vb(
          ...POST_TEST,
          'Sub PostDeliveries()',
          "    ' walk down the inbox from row 5 until Supplier (column B) is blank:",
          "    '   copy B:F of the row as values to the first empty ledger row (End(xlDown) from B15)",
          "    '   Status in column G: Short if Received < Ordered, else OK",
          "    ' then clear B5:F12, put Now in J4 as a value and the number of rows posted in J6",
          'End Sub',
        ),
        solution: postDeliveries(POST_BODY),
        expected: {
          ...rows('B', 20, posted),
          B26: null, B5: null, F5: null, B9: null, J5: 'frozen', J6: 1,
        },
        mustUse: ['Loop', 'xlDown', 'With', 'Now'],
      },
      wrong: [
        postDeliveries(POST_BODY.map((s) => s.replace('Range("B15").End(xlDown).Offset(1, 0)', 'Cells(r + 15, 2)'))),
        postDeliveries(POST_BODY.filter((s) => s !== 'Range("B5:F12").ClearContents')),
        postDeliveries(POST_BODY.map((s) => s.replace('.Offset(0, 3).Value < .Offset(0, 2).Value', '.Offset(0, 2).Value < .Offset(0, 3).Value'))),
        postDeliveries(POST_BODY.map((s) => (s.startsWith('Range("J4")') ? 'Range("J4").Formula = "=NOW()"' : s))),
      ],
      hints: [
        'Loop `Do While Cells(r, 2).Value <> ""` with r starting at 5, and add 1 to r inside the loop.',
        'Inside the loop, `Set dest = Range("B15").End(xlDown).Offset(1, 0)` is the next empty ledger row; copy ' +
          '`Range(Cells(r, 2), Cells(r, 6))` and use `dest.PasteSpecial Paste:=xlPasteValues`.',
        '`With dest` lets you reach Ordered, Received and Status as `.Offset(0, 2)`, `.Offset(0, 3)` and `.Offset(0, 5)`.',
        'After the loop: `Range("B5:F12").ClearContents`, `Range("J4").Value = Now` (a value, not a formula), and n into J6.',
      ],
      explain:
        'Finding the ledger end with `End(xlDown)` inside the loop means each delivery lands under the previous one, today ' +
        'and tomorrow, however long the ledger is. Pasting values (or `.Value = .Value`) copies what was received, not a ' +
        'link to the inbox, so clearing the inbox leaves the ledger intact. `Range("J4").Value = Now` freezes the time; ' +
        'writing the formula =NOW() would keep changing, which the stamp check in J5 catches.',
    },
    {
      id: 'short-count',
      kind: 'formula',
      cells: 'J8',
      prompt: 'In J8, count the Short deliveries in the ledger G16:G31 with `COUNTIF`.',
      solution: '=COUNTIF(G16:G31,"Short")',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(G16:G31,"OK")', '=COUNTIF(F16:F31,"Short")', '=COUNTIF(G16:G24,"Short")'],
      hints: ['Criteria for a text match are just the text in quotes: "Short".', 'Cover the whole ledger area, down to row 31, so future postings count too.'],
      explain:
        '`COUNTIF` with the criteria "Short" counts matching status cells; a range down to row 31 keeps counting as the ' +
        'macro appends rows, so the summary never needs editing.',
    },
    {
      id: 'cost',
      kind: 'formula',
      cells: 'J9',
      prompt: 'In J9, the cost of everything received in the ledger: `SUMPRODUCT` of Received (E16:E31) and Unit cost (F16:F31).',
      solution: '=SUMPRODUCT(E16:E31,F16:F31)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(D16:D31,F16:F31)', '=SUM(E16:E31)*SUM(F16:F31)', '=SUMPRODUCT(E16:E19,F16:F19)'],
      hints: ['Cost is received quantity times unit cost, row by row, then added up.', 'Pay for what was received (column E), not what was ordered.'],
      explain:
        '`SUMPRODUCT` multiplies Received by Unit cost row by row and adds the products; blank rows contribute 0, so the ' +
        'range can run to row 31 ahead of future postings.',
    },
    {
      id: 'empty-column',
      kind: 'value',
      cells: 'J11',
      prompt:
        'In Excel, if nothing at all sits below the header in B15, which row does `Range("B15").End(xlDown)` jump to? Type ' +
        'the row number in J11.',
      answer: 1048576,
      wrong: ['16', '15'],
      hints: ['End(xlDown) is Ctrl+Down: from a cell with nothing below it, Excel jumps to the next filled cell or, if there is none, to the last row of the sheet.'],
      explain:
        'With nothing below, Ctrl+Down runs to the last row of the sheet, 1,048,576, and `.Offset(1, 0)` from there fails ' +
        'with error 1004. That is why record macros need at least one filled cell under the header (the course timer keeps ' +
        'a clock formula in row 7) or a bottom-up search with `Cells(Rows.Count, 2).End(xlUp)`.',
    },
    {
      id: 'why-values',
      kind: 'explain',
      cells: '',
      prompt: 'Why does PostDeliveries paste values instead of using a normal paste or link formulas such as =B5 in the ledger?',
      answer:
        'The inbox is cleared and reused every day. A link such as =B5, or any formula that refers to the inbox, would show ' +
        'whatever is in the inbox now: after the clear the posted rows would go blank, and tomorrow they would show ' +
        "tomorrow's deliveries. Paste Special > Values (or .Value = .Value) freezes what was actually received, so the ledger " +
        'is a permanent record. The same idea makes a time stamp a value rather than =NOW().',
      hints: ['What happens to a ledger cell holding =B5 after the macro clears B5:F12?'],
    },
  ],
  testCases: [
    { name: 'Earlier milk delivery counted as OK', inputs: { G18: 'OK' } },
    { name: 'Green tea delivery: only 12 kg received', inputs: { E16: 12 } },
    { name: 'Syrup unit cost 8.40', inputs: { F19: 8.4 } },
  ],
  skills: ['last row with End(xlDown)', 'Do While until a blank cell', 'copy values', 'With', 'Set', 'Now', 'COUNTIF', 'SUMPRODUCT'],
  techniques: ['Conditional aggregation (SUMIF/COUNTIF with criteria strings)', 'SUMPRODUCT totals and weighted/expected values'],
}

export const exercises: readonly Exercise[] = [
  relativeDesk,
  loanRegister,
  warehouseMap,
  fruitTotals,
  raceBibs,
  banquetTables,
  parcelLockers,
  wateringDose,
  kopiWeek,
  queueTimer,
  stockLedger,
]
