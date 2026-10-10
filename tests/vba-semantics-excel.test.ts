// vba-semantics-excel.test.ts - the Excel object model as real Excel runs it: Range.End, Offset, Value with arrays,
// Formula, Copy/PasteSpecial, dialogs and recorder-style macros (vba_catalogue.md P01-P15).
// Run: npx tsx --test tests/vba-semantics-excel.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E13, E1004, L, cellsOf, check, val, vba, type Opts } from './vbaSemanticsHarness'
import type { LabSheet } from '../src/lab/types'

// run, require success, then compare cells ('#N/A' style strings match error cells)
function after(src: string, cells: Record<string, number | string | boolean>, want: Record<string, unknown>, o: Opts = {}): LabSheet {
  const ran = vba(src, { ...o, cells: { ...cellsOf(cells), ...o.cells } })
  assert.equal(ran.r.error?.message, undefined, `line ${ran.r.error?.line}: ${ran.r.error?.message}`)
  for (const [ref, v] of Object.entries(want)) assert.deepEqual(val(ran.sheet, ref), v, `${ref}`)
  return ran.sheet
}
const prints = (src: string, cells: Record<string, number | string | boolean>, want: string[], o: Opts = {}): void => {
  check(src, want, { ...o, cells: cellsOf(cells) })
}

// A1:A3 filled, A4:A5 blank, A6:A7 filled; B empty; row 1: A1, C1, D1 filled (B1 blank); the grid is 30 x 8
const block = { A1: 1, A2: 2, A3: 3, A6: 6, A7: 7, C1: 'c', D1: 'd' }

test('Range.End: block edges, gaps, blanks and the sheet edge', () => {
  prints(L(
    'Debug.Print Range("A1").End(xlDown).Address & " " & Range("A3").End(xlDown).Address & " " & Range("A4").End(xlDown).Address',
    'Debug.Print Range("A7").End(xlDown).Address & " " & Range("B1").End(xlDown).Address & " " & Range("A1").End(xlUp).Address',
    'Debug.Print Cells(30, 1).End(xlUp).Row & " " & Range("A1").End(xlToRight).Address & " " & Range("C1").End(xlToRight).Address & " " & Range("D1").End(xlToRight).Address',
    'Debug.Print Range("A6").End(xlUp).Address & " " & Range("D1").End(xlToLeft).Address',
  ), block, ['$A$3 $A$6 $A$6', '$A$30 $B$30 $A$1', '7 $C$1 $D$1 $H$1', '$A$3 $C$1'])
})

test('Range.End: a formula showing "" counts as filled', () => {
  prints('Debug.Print Range("A1").End(xlDown).Address', { A1: 1, A2: '=IF(1=1,"","x")', A3: 3 }, ['$A$3'])
})

test('Offset off the sheet and Cells(0, 1) raise error 1004', () => {
  check('Range("A1").Offset(-1, 0).Value = 1', { err: E1004, line: 2 })
  check('Cells(0, 1).Value = 1', { err: E1004, line: 2 })
  check('Range("H1").Offset(0, 1).Select', { err: E1004, line: 2 })
  check('x = Range("A30").Offset(1, 0).Value', { err: E1004, line: 2 })
})

test('Value: a 2-D array fills a block; a 1-D array fills a row, and repeats down a column', () => {
  after(L('Dim a(1 To 2, 1 To 2)', 'a(1, 1) = 1: a(1, 2) = 2: a(2, 1) = 3: a(2, 2) = 4', 'Range("A1:B2").Value = a',
    'Range("D1:F1").Value = Array(7, 8, 9)', 'Range("H1:H3").Value = Array(5, 6)', 'Range("D3:E4").Value = Array("x", "y")'),
  {}, { A1: 1, B1: 2, A2: 3, B2: 4, D1: 7, E1: 8, F1: 9, H1: 5, H2: 5, H3: 5, D3: 'x', E3: 'y', D4: 'x', E4: 'y' })
})

test('Value: an array smaller than the range leaves #N/A in the extra cells; a scalar fills them all', () => {
  after(L('Range("A1:D1").Value = Array(1, 2)', 'Range("A3:B4").Value = 7'), {}, { A1: 1, B1: 2, C1: '#N/A', D1: '#N/A', A3: 7, B4: 7 })
})

test('Value: one cell gives a scalar, several cells a 1-based 2-D array', () => {
  prints(L('v = Range("A1:B3").Value', 'Debug.Print TypeName(Range("A1").Value) & " " & TypeName(v) & " " & LBound(v) & UBound(v) & LBound(v, 2) & UBound(v, 2)',
    'Debug.Print TypeName(Range("C1").Value) & " " & TypeName(Range("B1").Value) & " " & TypeName(Range("B2").Value) & " " & v(2, 1)'),
  { A1: 1, A2: 'two', B1: 'x', B2: true }, ['Double Variant() 1312', 'Empty String Boolean two'])
})

test('Value: writing text that looks like a number stores a number; "" leaves the cell empty', () => {
  prints(L('Range("A1").Value = "12"', 'Range("B1").Value = ""', 'Range("C1").Value = 5', 'Range("C1").Value = Empty',
    'Debug.Print TypeName(Range("A1").Value) & " " & CStr(IsEmpty(Range("B1").Value)) & " " & CStr(IsEmpty(Range("C1").Value))'), {}, ['Double True True'])
})

test('Value: a String starting with = enters a formula', () => {
  const sheet = after('Range("B1").Value = "=A1+1"', { A1: 41 }, { B1: 42 })
  assert.equal(sheet.read('B1').kind, 'number')
})

test('Formula write, then Value and Formula read; constants read back as text', () => {
  prints(L('Range("C1").Formula = "=A1*2"', 'Debug.Print CStr(Range("C1").Value) & " " & Range("C1").Formula & " " & Range("A1").Formula & " [" & Range("H9").Formula & "]"',
    'Range("A1").Value = 5', 'Debug.Print CStr(Range("C1").Value) & " " & CStr(Range("C1").HasFormula) & " " & CStr(Range("A1").HasFormula)'),
  { A1: 21 }, ['42 =A1*2 21 []', '10 True False'])
})

test('FormulaR1C1 writes a relative formula', () => {
  prints(L('Range("C2").FormulaR1C1 = "=R[-1]C[-2]*3"', 'Debug.Print Range("C2").Formula & " " & CStr(Range("C2").Value)'), { A1: 4 }, ['=A1*3 12'])
})

test('Copy then PasteSpecial xlPasteValues freezes a formula\'s value', () => {
  const sheet = after(L('Range("C1").Copy', 'Range("D1").PasteSpecial Paste:=xlPasteValues', 'Application.CutCopyMode = False', 'Range("A1").Value = 1'),
    { A1: 21, C1: '=A1*2' }, { C1: 2, D1: 42 })
  assert.equal(sheet.raw('D1'), '42')
})

test('Copy Destination re-bases relative references and keeps absolute ones', () => {
  const sheet = after(L('Range("C1").Copy Destination:=Range("C2")', 'Range("D1").Copy Range("E3")', 'Range("C1").Copy', 'Range("F2").PasteSpecial xlPasteFormulas'),
    { A1: 2, B1: 3, A2: 5, B2: 7, C1: '=A1*B1', D1: '=$A$1+A$1+$A1' }, { C2: 35 })
  assert.equal(sheet.raw('C2'), '=A2*B2')
  assert.equal(sheet.raw('E3'), '=$A$1+B$1+$A3')
  assert.equal(sheet.raw('F2'), '=D2*E2')
})

test('PasteSpecial onto one cell expands to the copied block', () => {
  after(L('Range("A1:B2").Copy', 'Range("D5").PasteSpecial Paste:=xlPasteValues', 'Application.CutCopyMode = False'),
    { A1: 1, B1: 2, A2: 3, B2: 4 }, { D5: 1, E5: 2, D6: 3, E6: 4, F5: null })
})

test('MsgBox vbYesNo: scripted replies, then the first button', () => {
  const src = L('For k = 1 To 3', 'If MsgBox("Go on?", vbYesNo + vbQuestion) = vbYes Then s = s & "Y" Else s = s & "N"', 'Next', 'Debug.Print s & " " & MsgBox("ok")')
  check(src, ['NYY 1'], { msgBoxReplies: [vbNo(), 6] })
})
function vbNo(): number { return 7 }

test('InputBox: scripted answers in order, then "" (Cancel)', () => {
  check(L('a = InputBox("a")', 'b = InputBox("b")', 'c = InputBox("c")', 'Debug.Print a & "|" & b & "|" & c & "|" & TypeName(c) & "|" & CStr(c = "")'), ['5|7||String|True'], { inputs: ['5', '7'] })
})

test('InputBox returns text, so + joins two answers; Val adds them', () => {
  check(L('Debug.Print InputBox("x") + InputBox("y")', 'Debug.Print Val(InputBox("x")) + Val(InputBox("y"))'), ['57', ' 12'], { inputs: ['5', '7', '5', '7'] })
})

test('InputBox text into an Integer: "abc" and Cancel are type mismatches', () => {
  check(L('Dim n As Integer', 'n = InputBox("n")'), { err: E13, line: 3 }, { inputs: ['abc'] })
  check(L('Dim n As Integer', 'n = InputBox("n")'), { err: E13, line: 3 }, { inputs: [] })
})

test('an object variable needs Set; Nothing gives error 91', () => {
  check(L('Dim r As Range', 'r = Range("A1")'), { err: /'91'/, line: 3 })
  check(L('Dim r As Range', 'r.Value = 1'), { err: /'91'/, line: 3 })
  after(L('Dim r As Range', 'Set r = Range("B2")', 'r.Value = 5', 'r = 6', 'Set r = Nothing', 'If r Is Nothing Then Range("A1").Value = "none"'), {}, { B2: 6, A1: 'none' })
})

test('Let of a multi-cell range into a Variant copies the values', () => {
  prints(L('Dim v', 'v = Range("A1:B1")', 'Range("A1").Value = 9', 'Debug.Print v(1, 1) & " " & v(1, 2) & " " & TypeName(v)'), { A1: 1, B1: 2 }, ['1 2 Variant()'])
})

test('nested With and With evaluating its object once', () => {
  after(L('With Range("A1")', '.Value = 1', 'With .Offset(1, 0)', '.Value = 2', '.Offset(0, 1).Value = 3', 'End With', '.Offset(0, 2).Value = .Value + 10', 'End With',
    'i = 1', 'With Cells(i, 5)', 'i = 5', '.Value = "x"', 'End With'), {}, { A1: 1, A2: 2, B2: 3, C1: 11, E1: 'x', E5: null })
})

test('For Each over a range is row by row; over its Value it is column by column', () => {
  prints(L('For Each c In Range("A1:B2")', 's = s & c.Value', 'Next', 'For Each x In Range("A1:B2").Value', 't = t & x', 'Next', 'Debug.Print s & " " & t'),
    { A1: 'a', B1: 'b', A2: 'c', B2: 'd' }, ['abcd acbd'])
})

test('For Each cell can write back through the loop variable', () => {
  after(L('For Each c In Range("A1:A3")', 'c.Value = c.Value * 2', 'Next c'), { A1: 1, A2: 2, A3: 3 }, { A1: 2, A2: 4, A3: 6 })
})

test('Rows, Columns, Count, Cells(i), Item and Address forms', () => {
  prints(L('Set r = Range("B2:D5")', 'Debug.Print r.Rows.Count & " " & r.Columns.Count & " " & r.Count & " " & r.Cells.Count & " " & r.Row & " " & r.Column',
    'Debug.Print r.Cells(3).Address & " " & r.Cells(2, 3).Address & " " & r(2, 1).Address & " " & Range("B2").Cells(2, 2).Address',
    'Debug.Print Range("B2").Address(False, False) & " " & Range("B2").Address(RowAbsolute:=False) & " " & Range("a1:b2").Address(0, 0) & " " & Range("A1", "C3").Address',
    'Debug.Print Range(Cells(1, 1), Cells(2, 3)).Address & " " & Range("A1").Resize(2, 3).Address & " " & Range("C3").Range("B2").Address & " " & Cells(2, "C").Address'),
  {}, ['4 3 12 12 2 2', '$D$2 $D$3 $B$3 $C$3', 'B2 $B2 A1:B2 $A$1:$C$3', '$A$1:$C$2 $A$1:$C$2 $D$4 $C$2'])
})

test('CurrentRegion and Intersect', () => {
  prints(L('Debug.Print Range("A1").CurrentRegion.Address & " " & Intersect(Range("A1:B2"), Range("B2:C3")).Address',
    'Debug.Print CStr(Intersect(Range("A1"), Range("C3")) Is Nothing)'), { A1: 1, B1: 2, A2: 3, B3: 4 }, ['$A$1:$B$3 $B$2', 'True'])
})

test('an error cell reads as an Error value: IsError, CStr, and arithmetic is a type mismatch', () => {
  prints(L('v = Range("A1").Value', 'Debug.Print CStr(IsError(v)) & " " & CStr(v) & " " & TypeName(v)'), { A1: '=1/0' }, ['True Error 2007 Error'])
  check('x = Range("A1").Value + 1', { err: E13, line: 2 }, { cells: cellsOf({ A1: '=1/0' }) })
})

test('a blank cell equals "" and 0, a zero does not equal ""', () => {
  prints('Debug.Print CStr(Range("A1") = "") & " " & CStr(Range("A1") = 0) & " " & CStr(Range("B1") = "") & " " & CStr(Range("C1") = "")', { B1: 0, C1: '=""' },
    ['True True False True'])
})

test('cell Variants: a number is less than any text; text against a number literal converts or mismatches', () => {
  prints(L('Debug.Print CStr(Range("A1").Value > Range("B1").Value) & " " & CStr(Range("A1").Value < Range("B1").Value) & " " & CStr(Range("B1").Value > 8)'),
    { A1: 10, B1: '9' }, ['False True True'])
  check('If Range("A1").Value > 5 Then x = 1', { err: E13, line: 2 }, { cells: cellsOf({ A1: 'abc' }) })
})

test('deleting rows inside a For loop skips the row that moves up (the classic bug)', () => {
  after(L('For i = 1 To 5', 'If Cells(i, 1).Value = 2 Then Rows(i).Delete', 'Next'), { A1: 1, A2: 2, A3: 2, A4: 3, A5: 2 }, { A1: 1, A2: 2, A3: 3, A4: null })
})

test('a formula that pointed at a deleted row shows #REF!', () => {
  after('Rows(2).Delete', { A1: 1, A2: 2, A3: 3, B1: '=A2*10', B3: '=A3+1' }, { B1: '#REF!', B2: 4, A2: 3 })
})

test('Rows(n).Insert and EntireRow.Insert shift cells down and adjust formulas', () => {
  const sheet = after(L('Rows(2).Insert', 'Range("A1").EntireRow.Insert'), { A1: 1, A2: 2, B1: '=A2*10' }, { A1: null, A2: 1, A3: null, A4: 2, B2: 20 })
  assert.equal(sheet.raw('B2'), '=A4*10')
})

test('Insert of a block shifts down (or right) only those columns; pushing a filled cell off the grid is 1004', () => {
  after(L('Range("A2:B2").Insert Shift:=xlShiftDown', 'Range("D1").Insert Shift:=xlShiftToRight'), { A1: 1, A2: 2, B2: 3, C2: 4, D1: 'd' }, { A2: null, A3: 2, B3: 3, C2: 4, D1: null, E1: 'd' })
  check('Rows(5).Insert', { err: E1004, line: 2 }, { cells: cellsOf({ A30: 'last' }) })
})

test('recorder paste: Selection.Copy, Range.Select, ActiveSheet.Paste', () => {
  after(L('Range("A1:A2").Select', 'Selection.Copy', 'Range("C1").Select', 'ActiveSheet.Paste', 'Application.CutCopyMode = False'), { A1: 1, A2: '=A1+1' }, { C1: 1, C2: 2 })
})

test('PasteSpecial after CutCopyMode = False fails with 1004', () => {
  check(L('Range("A1").Copy', 'Application.CutCopyMode = False', 'Range("B1").PasteSpecial xlPasteValues'), { err: E1004, line: 4 }, { cells: cellsOf({ A1: 1 }) })
})

// Cut moves cells: formulas that point at them follow, as when the recorder writes a drag-and-drop move
test('Cut with a Destination moves the cell and re-points formulas that refer to it', () => {
  const sheet = after('Range("A1").Cut Destination:=Range("C3")', { A1: 5, B1: '=A1*2' }, { A1: null, C3: 5, B1: 10 })
  assert.equal(sheet.raw('B1'), '=C3*2')
})

test('recorded move: Selection.Cut, Range.Select, ActiveSheet.Paste empties the clipboard', () => {
  const ran = check(L('Range("A1:A2").Select', 'Selection.Cut', 'Debug.Print Application.CutCopyMode', 'Range("D1").Select', 'ActiveSheet.Paste', 'Debug.Print CStr(Application.CutCopyMode)'),
    [' 2', 'False'], { cells: cellsOf({ A1: 1, A2: 2 }) })
  assert.deepEqual([val(ran.sheet, 'A1'), val(ran.sheet, 'D1'), val(ran.sheet, 'D2')], [null, 1, 2])
  assert.equal(ran.r.selection, 'D1:D2')
  check(L('Range("A1").Cut', 'Range("B1").PasteSpecial xlPasteValues'), { err: E1004, line: 3 }, { cells: cellsOf({ A1: 1 }) })
})

test('Copy one cell onto a larger range fills it', () => {
  after('Range("A1").Copy Range("B1:B3")', { A1: '=ROW()*10' }, { B1: 10, B2: 20, B3: 30 })
})

test('NumberFormat changes .Text, not .Value; Font and Interior read back', () => {
  prints(L('Range("A1").NumberFormat = "0.00"', 'Range("A1").Font.Color = vbRed', 'Range("A1").Interior.ColorIndex = 6',
    'Debug.Print Range("A1").Text & " " & CStr(Range("A1").Value) & " " & Range("A1").NumberFormat & " " & Range("A1").Font.Color & " " & Range("A1").Interior.ColorIndex'),
  { A1: 3.14159 }, ['3.14 3.14159 0.00 255 6'])
})

// an address Excel cannot resolve (here an undefined name) is error 1004; the lab has no named ranges at all (deviation)
test('Range() of an unknown name is error 1004', () => {
  check('x = Range("TaxRate").Value', { err: E1004, line: 2 })
})

test('WorksheetFunction raises 1004 when the worksheet function fails; Application.X returns an error value', () => {
  const cells = cellsOf({ A1: 'a', B1: 1, A2: 'b', B2: 2 })
  check('x = WorksheetFunction.VLookup("zz", Range("A1:B2"), 2, False)', { err: /'1004': Unable to get the VLookup property of the WorksheetFunction class/, line: 2 }, { cells })
  check(L('x = Application.VLookup("zz", Range("A1:B2"), 2, False)', 'Debug.Print CStr(IsError(x)) & " " & Application.VLookup("b", Range("A1:B2"), 2, False)'), ['True 2'], { cells })
  check('x = WorksheetFunction.Average(Range("D1:D3"))', { err: E1004, line: 2 }, { cells })
})

test('WorksheetFunction.Round rounds half away from zero, unlike VBA Round', () => {
  prints('Debug.Print WorksheetFunction.Round(2.5, 0) & " " & Round(2.5) & " " & WorksheetFunction.RoundUp(2.1, 0) & " " & WorksheetFunction.Max(1, 5, 3) & " " & WorksheetFunction.CountIf(Range("A1:A4"), ">2")',
    { A1: 1, A2: 2, A3: 3, A4: 4 }, ['3 2 3 5 2'])
})

test('ActiveCell.Address, Selection.Count, Offset.Resize.Select', () => {
  const ran = check(L('Range("B2").Select', 'Debug.Print ActiveCell.Address & " " & ActiveCell.Address(0, 0) & " " & Selection.Count', 'ActiveCell.Offset(1, 1).Resize(2, 2).Select', 'Debug.Print Selection.Address & " " & ActiveCell.Address'),
    ['$B$2 B2 1', '$C$3:$D$4 $C$3'])
  assert.equal(ran.r.selection, 'C3:D4')
})

test('Now, Date and Time follow the run clock; writing Now stores a date serial', () => {
  const ran = check(L('Range("A1").Value = Now', 'Debug.Print Format(Now, "yyyy-mm-dd hh:mm") & " " & Format(Date, "dddd") & " " & Format(Time, "hh:mm") & " " & TypeName(Range("A1").Value) & " " & CStr(Timer)'),
    ['2026-01-05 09:00 Monday 09:00 Date 32400'])
  assert.ok(Math.abs((val(ran.sheet, 'A1') as number) - 46027.375) < 1e-9)
})

test('Value conversions on write: "001" becomes 1, "10%" becomes 0.1, True stays Boolean, an array into one cell writes its first item', () => {
  prints(L('Range("A1").Value = "001"', 'Range("A2").Value = "10%"', 'Range("A3").Value = True', 'Range("A4").Value = Array(7, 8)',
    'Debug.Print Range("A1").Value & " " & Range("A2").Value & " " & TypeName(Range("A3").Value) & " " & Range("A4").Value'), {}, ['1 0.1 Boolean 7'])
})

test('a date written to a cell compares equal to the same date', () => {
  prints(L('Range("A1").Value = DateSerial(2026, 1, 1)', 'Debug.Print CStr(Range("A1").Value = DateSerial(2026, 1, 1)) & " " & Format(Range("A1").Value, "yyyy-mm-dd") & " " & CStr(Range("A1").Value2)'),
    {}, ['True 2026-01-01 46023'])
})

test('Value2 of a date cell is its serial number', () => {
  prints(L('Range("A1").Value = DateSerial(2026, 1, 1)', 'Debug.Print TypeName(Range("A1").Value) & " " & TypeName(Range("A1").Value2) & " " & TypeName(Range("B1").Value2)'), {}, ['Date Double Empty'])
})

test('a run that fails half-way keeps the rows it wrote (no rollback)', () => {
  const ran = vba(L('For i = 1 To 5', 'Cells(i, 1).Value = 10 / (3 - i)', 'Next'))
  assert.match(ran.r.error?.message ?? '', /'11'/)
  assert.deepEqual([val(ran.sheet, 'A1'), val(ran.sheet, 'A2'), val(ran.sheet, 'A3')], [5, 10, null])
})

test('Range("A1:A3") = 0 and Range("A1:B1").Value = Range("A3:B3").Value copy values', () => {
  after(L('Range("A1:B1").Value = Range("A3:B3").Value', 'Range("C1:C3") = 0'), { A3: 'x', B3: '=1+1' }, { A1: 'x', B1: 2, C1: 0, C3: 0 })
})

test('ClearContents keeps the number format; Clear removes it', () => {
  const ran = check(L('Range("A1").NumberFormat = "0.00"', 'Range("B1").NumberFormat = "0.00"', 'Range("A1").ClearContents', 'Range("B1").Clear', 'Debug.Print Range("A1").NumberFormat & " " & Range("B1").NumberFormat'),
    ['0.00 General'], { cells: cellsOf({ A1: 1, B1: 2 }) })
  assert.equal(val(ran.sheet, 'A1'), null)
})

test('Application.ScreenUpdating, StatusBar and Calculate are accepted', () => {
  prints(L('Application.ScreenUpdating = False', 'Application.StatusBar = "busy"', 'Calculate', 'Application.Calculate', 'Application.ScreenUpdating = True', 'Debug.Print "ok"'), {}, ['ok'])
})

test('Worksheets("Sheet1").Activate, Sheets(1).Range and ActiveSheet.Cells', () => {
  after(L('Worksheets("Sheet1").Activate', 'Sheets(1).Range("A1").Value = 1', 'ActiveSheet.Cells(2, 1).Value = 2', 'ThisWorkbook.Worksheets("Sheet1").Range("A3").Value = 3'), {}, { A1: 1, A2: 2, A3: 3 })
})

test('Value = " " stores a space: the cell is not empty (P02\'s wrong answer)', () => {
  const ran = check(L('Range("B1").Value = " "', 'Debug.Print "[" & Range("B1").Value & "] " & CStr(IsEmpty(Range("B1").Value)) & " " & Len(Range("B1").Value)'), ['[ ] False 1'])
  assert.equal(val(ran.sheet, 'B1'), ' ')
})

test('Me is the sheet (sheet-module code) and Workbooks holds only the lab workbook', () => {
  const ran = check(L('Me.Range("A1").Value = 1', 'Debug.Print Me.Name & " " & Workbooks.Count & " " & Workbooks(1).Name & " " & CStr(Workbooks(1) Is ThisWorkbook)', 'Workbooks("Book1.xlsx").Activate'),
    { err: /'9': Subscript out of range/, line: 4 })
  assert.equal(val(ran.sheet, 'A1'), 1)
  assert.deepEqual(ran.out, ['Sheet1 1 ExcelLab.xlsm True'])
})
