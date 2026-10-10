// vba-semantics-recorder.test.ts - the catalogue's practice tasks (vba_catalogue.md P01-P15) with recorder-style and
// learner-style variants, and compile errors with their lines.
// Run: npx tsx --test tests/vba-semantics-recorder.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet } from '../src/lab/sheet'
import { callVbaFunction, runVba, type RunVbaOptions } from '../src/lab/vba/index'
import type { CellSpec, LabSheet, VbaRunResult } from '../src/lab/types'
import { L, cellsOf, check } from './vbaSemanticsHarness'

const sheetOf = (cells: Record<string, number | string | boolean>, rows = 40, cols = 10): LabSheet =>
  createLabSheet({ rows, cols, cells: cellsOf(cells) as Record<string, CellSpec> })
function go(sheet: LabSheet, src: string, entry: string, o: RunVbaOptions = {}): VbaRunResult {
  const r = runVba(sheet, src, entry, o)
  assert.equal(r.error?.message, undefined, `line ${r.error?.line}: ${r.error?.message}`)
  return r
}
const values = (sheet: LabSheet, refs: string[]): unknown[] => refs.map(ref => sheet.read(ref).value)
const col = (c: string, from: number, to: number): string[] => Array.from({ length: to - from + 1 }, (_, i) => `${c}${from + i}`)

test('P01 badges: Offset in a For loop; Str adds a space; "A" & i + 1 adds first', () => {
  const sheet = sheetOf({ A1: 'Badge #', B1: 'Code' })
  go(sheet, L('Sub NumberBadges()', 'Dim i As Integer', 'For i = 1 To 10', 'Range("A1").Offset(i, 0).Value = i', 'Range("B1").Offset(i, 0).Value = "BDG-" & (100 + i)', 'Next i', 'End Sub'), 'NumberBadges')
  assert.deepEqual(values(sheet, ['A2', 'A11', 'B2', 'B11', 'A12']), [1, 10, 'BDG-101', 'BDG-110', null])
  go(sheet, L('Sub Wrong()', 'For i = 1 To 2', 'Range("B1").Offset(i, 0).Value = "BDG-" & Str(100 + i)', 'Range("C" & i + 1).Value = i', 'Next', 'End Sub'), 'Wrong')
  assert.deepEqual(values(sheet, ['B2', 'C2', 'C3']), ['BDG- 101', 1, 2])
})

test('P02 rota: Font, Interior.ColorIndex and ClearContents', () => {
  const sheet = sheetOf({ B1: 'DRAFT', A3: 'Mon' })
  const r = go(sheet, L('Sub StyleRota()', 'Range("A1").Value = "Weekly Rota"', 'Range("A1").Font.Bold = True', 'Range("A1").Font.Italic = True', 'Range("A1").Interior.ColorIndex = 6', 'Range("B1").ClearContents',
    'Debug.Print CStr(Range("A1").Font.Bold) & " " & Range("A1").Interior.ColorIndex', 'End Sub'), 'StyleRota')
  assert.deepEqual(values(sheet, ['A1', 'B1', 'A3']), ['Weekly Rota', null, 'Mon'])
  assert.equal(r.styles?.A1?.bold, true)
  assert.equal(r.styles?.A1?.italic, true)
  assert.ok(r.styles?.A1?.fill !== undefined)
  assert.deepEqual(r.messages, ['True 6'])
})

test('P03 drop marker: Offset from a corner vs Cells(row, col) with Integer variables read from cells', () => {
  const src = L('Sub MarkDrop()', 'Dim r As Integer, c As Integer', 'r = Range("J2").Value', 'c = Range("J3").Value', 'Range("B2").Offset(r, c).Value = "DROP"', 'Cells(2 + r, 2 + c + 1).Value = "NEXT"', 'End Sub')
  const sheet = sheetOf({ J2: 3, J3: 2 })
  go(sheet, src, 'MarkDrop')
  assert.deepEqual(values(sheet, ['D5', 'E5']), ['DROP', 'NEXT'])
})

const loanLog = { B3: 'Last ID', C3: 'Loan ID', B4: 2, C4: '=B4+1', D4: 'M-1042', E4: 'BK-07', F4: 3, C11: 'Loan ID', D11: 'Member', C12: 1, D12: 'M-1001', E12: 'BK-02', F12: 1, C13: 2, D13: 'M-1017', E13: 'BK-11', F13: 2 }

test('P04 add a loan: End(xlDown).Offset(1, 0).PasteSpecial values, twice', () => {
  const sheet = sheetOf(loanLog)
  const src = L('Sub AddLoan()', 'Range("C4:F4").Copy', 'Range("C11").End(xlDown).Offset(1, 0).PasteSpecial Paste:=xlPasteValues', 'Application.CutCopyMode = False', 'Range("D4:F4").ClearContents', 'Range("B4").Value = Range("B4").Value + 1', 'End Sub')
  go(sheet, src, 'AddLoan')
  sheet.set('D4', 'M-1088'); sheet.set('E4', 'BK-03'); sheet.set('F4', '1')
  go(sheet, src, 'AddLoan')
  assert.deepEqual(values(sheet, ['C14', 'D14', 'E14', 'F14', 'C15', 'D15', 'F15', 'D4', 'B4', 'C4']), [3, 'M-1042', 'BK-07', 3, 4, 'M-1088', 1, null, 4, 5])
  assert.equal(sheet.raw('C14'), '3')
  assert.equal(sheet.raw('C4'), '=B4+1')
})

test('P04 recorded: Select, Selection.End, ActiveCell.Offset(1, 0).Range("A1"), continued named arguments', () => {
  const sheet = sheetOf(loanLog)
  const r = go(sheet, L('Sub addRecord()', '    Range("C4:F4").Select', '    Selection.Copy', '    Range("C11").Select', '    Selection.End(xlDown).Select', '    ActiveCell.Offset(1, 0).Range("A1").Select',
    '    Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats, Operation:= _', '        xlNone, SkipBlanks:=False, Transpose:=False', '    Application.CutCopyMode = False', '    Range("D4:F4").Select', '    Selection.ClearContents', '    Range("D3").Select', 'End Sub'), 'addRecord')
  assert.deepEqual(values(sheet, ['C14', 'D14', 'F14', 'D4']), [3, 'M-1042', 3, null])
  assert.equal(r.activeCell, 'D3')
  assert.equal(r.selection, 'D3')
})

test('P05 remove a loan: Rows(n).Delete shifts rows up and adjusts formulas; a "" row number is skipped', () => {
  const base = { ...loanLog, C14: 3, D14: 'M-1042', E14: 'BK-07', F14: 3, C7: 2, B7: '=IFERROR(MATCH(C7,C12:C60,0)+ROW(C11),"")' }
  const src = L('Sub RemoveLoan()', 'Dim rowNum', 'rowNum = Range("B7").Value', 'If rowNum <> "" Then', 'Rows(rowNum).Delete', 'End If', 'Range("C7").ClearContents', 'End Sub')
  const sheet = sheetOf(base)
  go(sheet, src, 'RemoveLoan')
  assert.deepEqual(values(sheet, ['C12', 'C13', 'D13', 'C14', 'C7', 'B7']), [1, 3, 'M-1042', null, null, ''])
  assert.equal(sheet.raw('B7'), '=IFERROR(MATCH(C7,C12:C59,0)+ROW(C11),"")')
  const s2 = sheetOf({ ...base, C7: 9 })
  go(s2, src, 'RemoveLoan')
  assert.deepEqual(values(s2, ['C12', 'C13', 'C14', 'C7']), [1, 2, 3, null])
  // the wrong version without the guard: Rows("") is a type mismatch
  const s3 = sheetOf({ ...base, C7: 9 })
  const r = runVba(s3, L('Sub RemoveLoan()', 'Rows(Range("B7").Value).Delete', 'End Sub'), 'RemoveLoan')
  assert.match(r.error?.message ?? '', /'13'/)
})

test('P07 stamps: Calculate, then paste the frozen NOW() value and number format', () => {
  const sheet = createLabSheet({ rows: 30, cols: 10, cells: { D3: { f: '=NOW()', fmt: 'hh:mm:ss' }, C6: { v: 'Ordered' }, C7: { f: '=$D$3', fmt: 'hh:mm:ss' } } })
  const src = L('Sub StampOrdered()', 'Calculate', 'Range("C7").Copy', 'Range("C6").End(xlDown).Offset(1, 0).PasteSpecial Paste:=xlPasteValuesAndNumberFormats', 'Application.CutCopyMode = False', 'End Sub')
  go(sheet, src, 'StampOrdered', { clock: 46000.5 })
  go(sheet, src, 'StampOrdered', { clock: 46000.75 })
  assert.equal(sheet.raw('C7'), '=$D$3')
  assert.ok(Math.abs((sheet.read('C8').value as number) - 46000.5) < 1e-9)
  assert.ok(Math.abs((sheet.read('C9').value as number) - 46000.75) < 1e-9)
  assert.equal(sheet.fmt('C9'), 'hh:mm:ss')
  assert.ok(!sheet.raw('C9').startsWith('='))
})

test('P08 cold room: Do While ActiveCell <> "" with Offset and Font.Color; a blank stops the walk', () => {
  const sheet = sheetOf({ C3: 'Temp C', C4: 4.5, C5: 7.9, C6: 8.4, C7: 3.0, C8: 1.6, C9: 5.2, C10: 9.1, C11: 2.0 })
  const r = go(sheet, L('Sub FlagTemps()', '    Range("C4").Select', '    Do While ActiveCell <> ""', '        If ActiveCell.Value > 8 Or ActiveCell.Value < 2 Then', '            ActiveCell.Offset(0, 1).Value = "CHECK"',
    '            ActiveCell.Offset(0, 1).Font.Color = vbRed', '        Else', '            ActiveCell.Offset(0, 1).Value = "OK"', '        End If', '        ActiveCell.Offset(1, 0).Select', '    Loop', 'End Sub'), 'FlagTemps')
  assert.deepEqual(values(sheet, col('D', 4, 12)), ['OK', 'OK', 'CHECK', 'OK', 'CHECK', 'OK', 'CHECK', 'OK', null])
  assert.equal(r.styles?.D6?.fontColor, 255)
  assert.equal(r.activeCell, 'C12')
})

test('P08 learner variant: a fixed For count treats the blank cell as 0 (below 2)', () => {
  const sheet = sheetOf({ C4: 8, C5: 1.99, C6: 2 })
  go(sheet, L('Sub FlagTemps()', 'For i = 0 To 3', 'If Range("C4").Offset(i, 0).Value > 8 Or Range("C4").Offset(i, 0).Value < 2 Then', 'Range("D4").Offset(i, 0).Value = "CHECK"', 'Else', 'Range("D4").Offset(i, 0).Value = "OK"', 'End If', 'Next', 'End Sub'), 'FlagTemps')
  assert.deepEqual(values(sheet, col('D', 4, 7)), ['OK', 'CHECK', 'OK', 'CHECK'])
})

const doseSrc = L('Sub SetDose()', '    Dim txt', '    Dim v As Single', '    On Error GoTo BadEntry', '    txt = InputBox("Litres per tray (0.5 to 5)")', '    If txt = "" Then Exit Sub', '    v = txt',
  '    If v < 0.5 Or v > 5 Then GoTo BadEntry', '    Range("B1").Value = v', '    Exit Sub', 'BadEntry:', '    MsgBox "Enter a number from 0.5 to 5"', 'End Sub')

test('P09 dose: InputBox, a Single, On Error GoTo and GoTo the same label', () => {
  const cases: [string[], number, string[]][] = [[['2.5'], 2.5, []], [['lots'], 1, ['Enter a number from 0.5 to 5']], [['9'], 1, ['Enter a number from 0.5 to 5']], [[''], 1, []], [[], 1, []]]
  for (const [inputs, b1, msgs] of cases) {
    const sheet = sheetOf({ B1: 1, B4: 12, C4: '=B4*$B$1' })
    const r = go(sheet, doseSrc, 'SetDose', { inputs })
    assert.equal(sheet.read('B1').value, b1, JSON.stringify(inputs))
    assert.deepEqual(r.messages, msgs, JSON.stringify(inputs))
    assert.equal(sheet.read('C4').value, 12 * b1)
  }
})

test('P09: a Single that is not exact reaches the cell as the Single\'s value', () => {
  const sheet = sheetOf({ B1: 1 })
  go(sheet, doseSrc, 'SetDose', { inputs: ['0.7'] })
  // VBA converts the Single 0.7 to the Double 0.699999988079071 when it writes the cell
  assert.ok(Math.abs((sheet.read('B1').value as number) - 0.699999988079071) < 1e-12, String(sheet.read('B1').value))
})

test('P10 lockers: Do While over Cells(r, 2) with Select Case and Case Else', () => {
  const sheet = sheetOf({ B4: 2, B5: 1, B6: 3, B7: 2, B8: 4, B9: 1, B10: 3, D12: '=SUM(D4:D10)' })
  go(sheet, L('Sub AssignLockers()', 'Dim r As Integer', 'r = 4', 'Do While Cells(r, 2).Value <> ""', 'Select Case Cells(r, 2).Value', 'Case 1', 'Cells(r, 3).Value = "Small": Cells(r, 4).Value = 3.5', 'Case 2',
    'Cells(r, 3).Value = "Medium": Cells(r, 4).Value = 5', 'Case 3', 'Cells(r, 3).Value = "Large": Cells(r, 4).Value = 7.5', 'Case Else', 'Cells(r, 3).Value = "Check code": Cells(r, 4).Value = 0', 'End Select', 'r = r + 1', 'Loop', 'End Sub'), 'AssignLockers')
  assert.deepEqual(values(sheet, col('C', 4, 11)), ['Medium', 'Small', 'Large', 'Medium', 'Check code', 'Small', 'Large', null])
  assert.equal(sheet.read('D12').value, 32)
})

test('P11 gift card: Do ... Loop Until with a Single balance', () => {
  const src = L('Sub BurnDown()', 'Dim bal As Single, r As Integer', 'bal = Range("B1").Value', 'r = 0', 'Do', 'Range("A5").Offset(r, 0).Value = bal', 'bal = bal - Range("B2").Value', 'r = r + 1', 'Loop Until bal < Range("B2").Value', 'Range("B3").Value = bal', 'End Sub')
  const sheet = sheetOf({ B1: 50, B2: 7.5 })
  go(sheet, src, 'BurnDown')
  assert.deepEqual(values(sheet, [...col('A', 5, 11), 'B3']), [50, 42.5, 35, 27.5, 20, 12.5, null, 5])
  const s2 = sheetOf({ B1: 30, B2: 7.5 })
  go(s2, src, 'BurnDown')
  assert.deepEqual(values(s2, [...col('A', 5, 9), 'B3']), [30, 22.5, 15, 7.5, null, 0])
})

test('P12 totals: WorksheetFunction.Sum gives a value, .Formula a live formula', () => {
  const sheet = sheetOf({ C2: 120, C3: 95, C4: 143, C5: 88, C6: 160, C7: 210, C8: 184 })
  go(sheet, L('Sub TotalsTwoWays()', 'Range("C9").Value = WorksheetFunction.Sum(Range("C2:C8"))', 'Range("C10").Formula = "=SUM(C2:C8)"', 'End Sub'), 'TotalsTwoWays')
  sheet.set('C2', '150')
  assert.deepEqual(values(sheet, ['C9', 'C10']), [1000, 1030])
  assert.equal(sheet.raw('C9'), '1000')
})

test('P13 tables needed: a Function with Int, called directly and from the sheet', () => {
  const src = L('Function TablesNeeded(guests, seats)', '    TablesNeeded = Int(guests / seats)', '    If guests / seats > TablesNeeded Then TablesNeeded = TablesNeeded + 1', 'End Function')
  const got = [[23, 6], [40, 8], [7, 10], [100, 12], [1, 4], [41, 8]].map(([g, s]) => {
    const r = callVbaFunction(src, 'TablesNeeded', [g, s])
    return r.ok ? r.value : r.error
  })
  assert.deepEqual(got, [4, 5, 1, 9, 1, 6])
})

test('P15 seats: nested For with Cells and a single-line If', () => {
  const sheet = sheetOf({ A1: 'Hall seats' })
  const r = go(sheet, L('Sub LabelSeats()', 'Dim r As Integer, s As Integer', 'For r = 1 To 4', 'For s = 1 To 6', 'Cells(2 + r, 1 + s).Value = "R" & r & "S" & s', 'If s = 4 Then Cells(2 + r, 1 + s).Interior.ColorIndex = 15', 'Next s', 'Next r', 'End Sub'), 'LabelSeats')
  assert.deepEqual(values(sheet, ['B3', 'G3', 'D5', 'B6', 'G6']), ['R1S1', 'R1S6', 'R3S3', 'R4S1', 'R4S6'])
  assert.ok(r.styles?.E3?.fill !== undefined && r.styles?.D3?.fill === undefined)
})

test('relative recording: ActiveCell.Offset(-2, 0).Range("A1"), FormulaR1C1 and Range(Selection, Selection.End(xlDown)).Count', () => {
  const sheet = sheetOf({ C6: 1, C7: 2, C8: 3, C9: 4 })
  const r = go(sheet, L('Sub Rec()', 'Range("C6").Select', 'n = Range(Selection, Selection.End(xlDown)).Count', 'Range("C10").Select', 'ActiveCell.FormulaR1C1 = "=SUM(R[-4]C:R[-1]C)"',
    'ActiveCell.Offset(-2, 0).Range("A1").Select', 'ActiveCell.Offset(0, 1).Value = n', 'Range("E1:E3").Select', 'Range("E2").Activate', 'Selection.Value = "s"', 'End Sub'), 'Rec')
  assert.equal(sheet.raw('C10'), '=SUM(C6:C9)')
  assert.deepEqual(values(sheet, ['C10', 'D8', 'E1', 'E3']), [10, 4, 's', 's'])
  assert.equal(r.activeCell, 'E2')
  assert.equal(r.selection, 'E1:E3')
})

test('learner variants: ActiveCell.Offset(1).Select, Offset(, 2), Cells(Rows.Count, 1).End(xlUp), Range("A" & n)', () => {
  const sheet = sheetOf({ A1: 'x', A2: 'y', A3: 'z' })
  const r = go(sheet, L('Sub Next1()', 'n = Cells(Rows.Count, 1).End(xlUp).Row + 1', 'Range("A" & n).Value = "new"', 'Range("A1").Offset(, 2).Value = "c"', 'Range("A1").Select', 'ActiveCell.Offset(1).Select', 'End Sub'), 'Next1')
  assert.deepEqual(values(sheet, ['A4', 'C1']), ['new', 'c'])
  assert.equal(r.activeCell, 'A2')
})

// compile errors: nothing runs, and the message names the line
const compileCases: [string, string, RegExp, number[]][] = [
  ['Block If without End If', L('Sub Main()', 'If 1 > 0 Then', 'x = 1', 'End Sub'), /Block If without End If/, [2, 4]],
  ['For without Next', L('Sub Main()', 'For i = 1 To 3', 'x = 1', 'End Sub'), /For without Next/, [2, 4]],
  ['Next without For', L('Sub Main()', 'x = 1', 'Next i', 'End Sub'), /Next without For/, [3]],
  ['Loop without Do', L('Sub Main()', 'x = 1', 'Loop', 'End Sub'), /Loop without Do/, [3]],
  ['End If without block If', L('Sub Main()', 'x = 1', 'End If', 'End Sub'), /End If without block If/, [3]],
  ['Else without If', L('Sub Main()', 'x = 1', 'Else', 'End Sub'), /Else without If/, [3]],
  ['a missing parenthesis', L('Sub Main()', 'x = 1', 'y = (1 + 2', 'End Sub'), /Expected/, [3]],
  ['a Sub called with parentheses and two arguments', L('Sub Main()', 'Show(1, 2)', 'End Sub', 'Sub Show(a, b)', 'End Sub'), /Expected: =/, [2]],
  ['an unknown procedure', L('Sub Main()', 'x = 1', 'Call Foo', 'End Sub'), /Sub or Function not defined/, [3]],
  ['a missing End Sub', L('Sub Main()', 'x = 1'), /End Sub/, [1, 2, 3]],
  ['an unknown type', L('Sub Main()', 'Dim x As Intger', 'End Sub'), /User-defined type not defined/, [2]],
  ['Select without End Select', L('Sub Main()', 'Select Case 1', 'Case 1: x = 1', 'End Sub'), /Select Case without End Select/, [2, 4]],
]
for (const [name, src, pattern, lines] of compileCases) {
  test(`compile error: ${name}`, () => {
    const sheet = sheetOf({})
    const r = runVba(sheet, src, 'Main')
    assert.equal(r.ok, false)
    assert.match(r.error?.message ?? '', /^Compile error/)
    assert.match(r.error?.message ?? '', pattern)
    assert.ok(lines.includes(r.error?.line ?? -1), `line ${r.error?.line}: ${r.error?.message}`)
  })
}

test('a run-time error keeps the cells written before it, like Excel', () => {
  const ran = check(L('Range("A1").Value = 1', 'Range("A2").Value = 1 / 0', 'Range("A3").Value = 3'), { err: /'11'/, line: 3 })
  assert.deepEqual(values(ran.sheet, ['A1', 'A2', 'A3']), [1, null, null])
})

// what the macro recorder writes for the Home-tab buttons: every member must be accepted, and the ones the lab
// checks (fill, font colour, bold) must take effect
test('recorded fill colour, font colour and alignment blocks run and set the checked formats', () => {
  const sheet = sheetOf({ A1: 'Title', B1: 'x' })
  const r = go(sheet, L('Sub Rec()', '    Range("A1:B1").Select', '    With Selection.Interior', '        .Pattern = xlSolid', '        .PatternColorIndex = xlAutomatic', '        .Color = 65535',
    '        .TintAndShade = 0', '        .PatternTintAndShade = 0', '    End With', '    With Selection.Font', '        .Color = -16776961', '        .TintAndShade = 0', '    End With',
    '    Selection.Font.Bold = True', '    With Selection', '        .HorizontalAlignment = xlCenter', '        .VerticalAlignment = xlBottom', '        .WrapText = False', '        .Orientation = 0',
    '        .AddIndent = False', '        .IndentLevel = 0', '        .ShrinkToFit = False', '        .ReadingOrder = xlContext', '        .MergeCells = False', '    End With',
    '    Debug.Print Selection.Interior.Color & " " & Selection.Font.Color & " " & Selection.HorizontalAlignment & " " & Selection.Font.FontStyle', 'End Sub'), 'Rec')
  assert.deepEqual(r.messages, ['65535 255 -4108 Bold'])
  assert.equal(r.styles?.B1?.fill, 65535)
  assert.equal(r.styles?.A1?.fontColor, 255)
  assert.equal(r.styles?.A1?.bold, true)
})

test('recorded Format Cells font block, borders, column widths and scrolling run', () => {
  const sheet = sheetOf({ A1: 1 })
  const r = go(sheet, L('Sub Rec()', '    Range("A1:C3").Select', '    With Selection.Font', '        .Name = "Calibri"', '        .Size = 11', '        .Strikethrough = False', '        .Superscript = False',
    '        .Subscript = False', '        .OutlineFont = False', '        .Shadow = False', '        .Underline = xlUnderlineStyleNone', '        .ThemeColor = xlThemeColorLight1', '        .TintAndShade = 0',
    '        .ThemeFont = xlThemeFontMinor', '    End With', '    Selection.Borders(xlDiagonalDown).LineStyle = xlNone', '    With Selection.Borders(xlEdgeBottom)', '        .LineStyle = xlContinuous',
    '        .ColorIndex = 0', '        .TintAndShade = 0', '        .Weight = xlThin', '    End With', '    Selection.Borders(xlInsideVertical).LineStyle = xlNone', '    Columns("A:A").ColumnWidth = 12',
    '    Columns("B:B").EntireColumn.AutoFit', '    ActiveWindow.SmallScroll Down:=3', '    ActiveWindow.ScrollRow = 1', '    Range("A1").BorderAround Weight:=xlMedium',
    '    Debug.Print Selection.Borders(xlEdgeBottom).LineStyle & " " & Selection.Borders(xlEdgeBottom).Weight & " " & Range("A1").Borders(xlEdgeTop).Weight & " " & Columns("A:A").ColumnWidth', 'End Sub'), 'Rec')
  assert.deepEqual(r.messages, ['1 2 -4138 12'])
})

test('recorded fill-handle drags: AutoFill copies formulas, extends series; FillDown copies the top row', () => {
  const sheet = sheetOf({ C1: 1, D1: '=C1*2', E1: 'Mon', F1: 2, F2: 4, G1: 'Item 9', H1: 5, A3: 'x' })
  go(sheet, L('Sub Rec()', '    Range("C1").AutoFill Destination:=Range("C1:C5"), Type:=xlFillSeries', '    Range("D1").Select', '    Selection.AutoFill Destination:=Range("D1:D5"), Type:=xlFillDefault',
    '    Range("D1:D5").Select', '    Range("E1").AutoFill Destination:=Range("E1:E3")', '    Range("F1:F2").AutoFill Destination:=Range("F1:F4")', '    Range("G1").AutoFill Destination:=Range("G1:G3")',
    '    Range("H1").AutoFill Destination:=Range("H1:H3")', '    Range("A3:A5").FillDown', 'End Sub'), 'Rec')
  assert.deepEqual(values(sheet, ['C5', 'D5', 'E3', 'F4', 'G3', 'H3', 'A5']), [5, 10, 'Wed', 8, 'Item 11', 5, 'x'])
  assert.equal(sheet.raw('D5'), '=C5*2')
  const bad = runVba(sheet, L('Sub Bad()', 'Range("C1").AutoFill Destination:=Range("D2:D5")', 'End Sub'), 'Bad')
  assert.match(bad.error?.message ?? '', /'1004'/)
})

test('relative recording: ActiveCell.Columns("A:A").EntireColumn and ActiveCell.Rows("1:1").EntireRow', () => {
  const sheet = sheetOf({})
  const r = go(sheet, L('Sub Rec()', 'Range("B2").Select', 'ActiveCell.Offset(0, 1).Columns("A:A").EntireColumn.Select', 'Debug.Print Selection.Address', 'ActiveCell.Rows("1:1").EntireRow.Select', 'Debug.Print Selection.Address',
    'Range("B2").Select', 'ActiveCell.Range("A1:B2").Select', 'Debug.Print Selection.Address', 'End Sub'), 'Rec')
  // Excel shows whole columns as $C:$C; the lab's selection is the grid's cells (40 rows x 10 columns here)
  assert.deepEqual(r.messages, ['$C$1:$C$40', '$A$1:$J$1', '$B$2:$C$3'])
})

test('Style = "Currency" / "Percent" set the number format', () => {
  const sheet = sheetOf({ A1: 0.25, B1: 1234.5 })
  const r = go(sheet, L('Sub Rec()', 'Range("A1").Style = "Percent"', 'Range("B1").Style = "Currency"', 'Debug.Print Range("A1").Text & " " & Range("B1").Text & " " & Range("A1").Style', 'End Sub'), 'Rec')
  assert.deepEqual(r.messages, ['25% $1,234.50 Percent'])
})

test('selection state: Offset of a block, Activate inside it, EntireRow, Rows(n).Select, Columns("B").Select', () => {
  const sheet = sheetOf({ A1: 1, A2: 2, A3: 3 })
  const r = go(sheet, L('Sub Sel()', 'Range("A1:B3").Select', 'Selection.Offset(1, 0).Select', 'Debug.Print Selection.Address & " " & ActiveCell.Address',
    'Range("A1:C3").Select', 'Range("B2").Activate', 'ActiveCell.Value = "x"', 'Debug.Print Selection.Address & " " & ActiveCell.Address',
    'Selection.Value = Selection.Value', 'ActiveCell.Offset(1, 0).Select', 'Debug.Print Selection.Address', 'Range("C2").Select', 'Selection.EntireRow.Select', 'Debug.Print ActiveCell.Address',
    'Rows(3).Select', 'Debug.Print ActiveCell.Address', 'Columns("B").Select', 'Debug.Print ActiveCell.Address', 'Range("A1").Select', 'Range("A1:B2").Copy', 'Range("D4").PasteSpecial xlPasteValues',
    'Debug.Print Selection.Address & " " & ActiveCell.Address', 'End Sub'), 'Sel')
  assert.deepEqual(r.messages, ['$A$2:$B$4 $A$2', '$A$1:$C$3 $B$2', '$B$3', '$A$2', '$A$3', '$B$1', '$D$4:$E$5 $D$4'])
  assert.equal(sheet.read('B2').value, 'x')
})

test('the run starts from the given active cell and selection', () => {
  const sheet = sheetOf({})
  const r = go(sheet, L('Sub Sel()', 'Debug.Print ActiveCell.Address & " " & Selection.Address & " " & Selection.Count', 'End Sub'), 'Sel', { activeCell: 'B2', selection: 'A1:C3' })
  assert.deepEqual(r.messages, ['$B$2 $A$1:$C$3 9'])
  const r2 = go(sheet, L('Sub Sel()', 'Debug.Print ActiveCell.Address & " " & Selection.Address', 'End Sub'), 'Sel', { activeCell: 'C5' })
  assert.deepEqual(r2.messages, ['$C$5 $C$5'])
})

// catalogue section 8, gotcha 1: a block If left open inside a For makes the VBE report "Next without For"
test('compile error: a missing End If inside a For is "Next without For" at the Next line', () => {
  const r = runVba(sheetOf({}), L('Sub Main()', 'For i = 1 To 3', '  If i = 2 Then', '    x = 1', 'Next i', 'End Sub'), 'Main')
  assert.equal(r.error?.line, 5)
  assert.match(r.error?.message ?? '', /^Compile error: Next without For \(the If on line 3 has no End If\)$/)
  const r2 = runVba(sheetOf({}), L('Sub Main()', 'Do', '  With Range("A1")', '    x = 1', 'Loop', 'End Sub'), 'Main')
  assert.match(r2.error?.message ?? '', /Loop without Do \(the With on line 3 has no End With\)/)
})

// catalogue section 8, gotchas 4 and 7
test('a misspelt constant is an Empty Variant without Option Explicit, and Variable not defined with it', () => {
  const r = runVba(sheetOf({}), L('Sub Main()', 'Range("A1").Value = 1 + xlColourindexnone', 'End Sub'), 'Main')
  assert.equal(r.ok, true)
  const r2 = runVba(sheetOf({}), L('Option Explicit', 'Sub Main()', 'Range("A1").Interior.ColorIndex = xlColourindexnone', 'End Sub'), 'Main')
  assert.match(r2.error?.message ?? '', /Variable not defined/)
  assert.equal(r2.error?.line, 3)
})

test('Ex9 gotcha: testing " " lets Cancel through to Sqr(""), which the handler traps', () => {
  const src = L('Sub Ex9()', 'On Error GoTo BadEntry', 'Num = InputBox("Number?")', 'If Num = " " Then Exit Sub', 'Range("A1").Value = Sqr(Num)', 'Exit Sub', 'BadEntry:', 'MsgBox "Bad entry"', 'End Sub')
  const r = go(sheetOf({}), src, 'Ex9', { inputs: [''] })
  assert.deepEqual(r.messages, ['Bad entry'])
  const sheet = sheetOf({})
  go(sheet, src, 'Ex9', { inputs: ['16'] })
  assert.equal(sheet.read('A1').value, 4)
})

test('an unscripted MsgBox answers with its default button', () => {
  const r = go(sheetOf({}), L('Sub Main()', 'Debug.Print MsgBox("a", vbYesNo) & " " & MsgBox("b", vbYesNo + vbDefaultButton2) & " " & MsgBox("c", vbYesNoCancel + vbDefaultButton3) & " " & MsgBox("d", vbOKCancel)', 'End Sub'), 'Main')
  assert.deepEqual(r.messages, ['a', 'b', 'c', 'd', '6 7 2 1'])
})

test('code pasted from documents: non-breaking spaces are spaces, curly quotes get a hint', () => {
  const ok = runVba(sheetOf({}), 'Sub Main()\n  Range("A1").Value = 5\nEnd Sub\n', 'Main')
  assert.equal(ok.ok, true, ok.error?.message)
  const bad = runVba(sheetOf({}), 'Sub Main()\n  x = 1\n  MsgBox “Hello”\nEnd Sub\n', 'Main')
  assert.equal(bad.error?.line, 3)
  assert.match(bad.error?.message ?? '', /^Compile error: Invalid character \(“\): type straight quotes/)
})

test('P06 edit and update a loan: copy the INDEX/MATCH row as values, then write it back at "C" & CStr(rowNum)', () => {
  const lookup = (c: string): string => `=IF($C7="","",INDEX(${c}$12:${c}$60,MATCH($C7,$C$12:$C$60,0)))`
  const base = { ...loanLog, C14: 3, D14: 'M-1042', E14: 'BK-07', F14: 3, C7: 2, B7: '=IFERROR(MATCH(C7,C12:C60,0)+ROW(C11),"")', D7: lookup('D'), E7: lookup('E'), F7: lookup('F') }
  const src = L('Sub EditLoan()', '    Range("C7:F7").Copy', '    Range("C8").PasteSpecial Paste:=xlPasteValues', '    Application.CutCopyMode = False', 'End Sub', '',
    'Sub UpdateLoan()', '    Dim rowNum', '    rowNum = Range("B7").Value', '    If rowNum <> "" Then', '        Range("C8:F8").Copy', '        Range("C" & CStr(rowNum)).PasteSpecial Paste:=xlPasteValues',
    '        Application.CutCopyMode = False', '        Range("C8:F8").ClearContents', '        Range("C7").ClearContents', '    End If', 'End Sub')
  const sheet = sheetOf(base, 61)
  go(sheet, src, 'EditLoan')
  assert.deepEqual(values(sheet, ['C8', 'D8', 'E8', 'F8']), [2, 'M-1017', 'BK-11', 2])
  sheet.set('F8', '5')
  go(sheet, src, 'UpdateLoan')
  assert.deepEqual(values(sheet, ['C13', 'D13', 'E13', 'F13', 'C12', 'F14', 'C8', 'F8', 'C7', 'D7', 'B7']), [2, 'M-1017', 'BK-11', 5, 1, 3, null, null, null, '', ''])
})

test('AutoFill from a locked given cell writes only the cells beyond it', () => {
  const sheet = createLabSheet({ rows: 10, cols: 5, cells: { A1: { v: 2, role: 'given' }, A2: { v: 3, role: 'given' }, B1: { f: '=A1*10', role: 'given' }, B2: { role: 'answer' } } })
  go(sheet, L('Sub Fill()', 'Range("B1").AutoFill Destination:=Range("B1:B2")', 'End Sub'), 'Fill')
  assert.equal(sheet.raw('B2'), '=A2*10')
  assert.equal(sheet.read('B2').value, 30)
  const r = runVba(sheet, L('Sub Fill()', 'Range("B2").AutoFill Destination:=Range("A2:B2")', 'End Sub'), 'Fill')
  assert.match(r.error?.message ?? '', /'1004'.*protected/)
})
