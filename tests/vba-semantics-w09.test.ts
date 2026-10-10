// vba-semantics-w09.test.ts - learner-style alternative solutions for every W9 macro task: other correct ways must pass
// the checker, and typical slips must fail. Run: npx tsx --test tests/vba-semantics-w09.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises } from '../src/data/lab/w09'
import { referenceState } from '../src/lab/checker'
import { checkVbaTask } from '../src/lab/vba/check'
import type { Exercise, LearnerState, Task } from '../src/lab/types'

const find = (exId: string, taskId: string): [Exercise, Task] => {
  const e = exercises.find(x => x.id === exId)
  assert.ok(e, exId)
  const t = e.tasks.find(x => x.id === taskId)
  assert.ok(t?.vba, taskId)
  return [e, t]
}
const state = (e: Exercise, t: Task, source: string): LearnerState => {
  const ref = referenceState(e)
  return { ...ref, vba: { ...ref.vba, [t.id]: source } }
}
// the starter's driver (everything before the procedure to write) plus the learner's procedure
function withDriver(t: Task, proc: string): string {
  const starter = t.vba?.starter ?? ''
  const name = /^\s*(?:Sub|Function)\s+(\w+)/m.exec(proc)?.[1] ?? ''
  const at = starter.search(new RegExp(`^\\s*(?:Sub|Function)\\s+${name}\\b`, 'mi'))
  return `${at >= 0 ? starter.slice(0, at) : starter}\n${proc}\n`
}
const L = (...lines: string[]): string => lines.join('\n')

const passes: [string, string, string, string][] = [
  ['w6-macro-relative-desk', 'write-relative', 'default property and Offset(1)', L('Sub MarkArrived()', '    ActiveCell.Offset(0, 2) = "Arrived"', '    ActiveCell.Offset(1).Select', 'End Sub')],
  ['w6-macro-relative-desk', 'write-relative', 'a With block and Activate', L('Sub MarkArrived()', '    With ActiveCell', '        .Offset(0, 2).Value = "Arrived"', '        .Offset(1, 0).Activate', '    End With', 'End Sub')],
  ['w6-macro-loan-register', 'add-loan', 'the tidied recording', L('Sub AddLoan()', '    Range("C4:F4").Copy', '    Range("C11").End(xlDown).Offset(1, 0).PasteSpecial xlPasteValuesAndNumberFormats',
    '    Application.CutCopyMode = False', '    Range("D4:F4").ClearContents', '    Range("B4") = Range("B4") + 1', 'End Sub')],
  ['w9-vba-range-cells-offset', 'mark-bay', 'cells as Offset arguments', L('Sub MarkBay()', '    Range("B3").Offset(Range("L3"), Range("L4")) = "DROP"', '    Cells(Range("L3") + 3, Range("L4") + 3) = "NEXT"', 'End Sub')],
  ['w9-vba-worksheetfunction-static', 'totals', 'a Variant Static and Application.WorksheetFunction', L('Sub TotalsTwoWays()', '    Static presses', '    presses = presses + 1',
    '    Range("C9") = Application.WorksheetFunction.Sum(Range("C2:C8"))', '    Range("C10").Formula = "=SUM(C2:C8)"', '    Range("C12") = presses', 'End Sub')],
  ['w9-vba-for-next-bibs', 'number-bibs', 'Cells and a cell read back', L('Sub NumberBibs()', '    For i = 1 To 12', '        Cells(5 + i, 2) = Range("E2") + i - 1', '        Cells(5 + i, 3) = Range("E3") & Cells(5 + i, 2)', '    Next i', 'End Sub')],
  ['w9-vba-select-case-lockers', 'assign', 'Range("B" & r) and one-line cases', L('Sub AssignLockers()', '    r = 4', '    Do Until Range("B" & r) = ""', '        Select Case Range("B" & r).Value',
    '            Case 1: Range("C" & r) = "Small": Range("D" & r) = 3.5', '            Case 2: Range("C" & r) = "Medium": Range("D" & r) = 5', '            Case 3: Range("C" & r) = "Large": Range("D" & r) = 7.5',
    '            Case Else: Range("C" & r) = "Check code": Range("D" & r) = 0: bad = bad + 1', '        End Select', '        r = r + 1', '    Loop', '    Range("G9") = r - 4', '    Range("G10") = bad', 'End Sub')],
  ['w9-vba-inputbox-errors', 'set-dose', 'IsNumeric and CDbl', L('Sub SetDose()', '    Dim txt', '    On Error GoTo BadEntry', '    txt = InputBox("Litres per tray (0.5 to 5)")', '    If txt = "" Then',
    '        Range("B3") = "Cancelled"', '        Exit Sub', '    End If', '    If Not IsNumeric(txt) Then GoTo BadEntry', '    If CDbl(txt) < 0.5 Or CDbl(txt) > 5 Then GoTo BadEntry', '    Range("B2") = CDbl(txt)',
    '    Range("B3") = "OK"', '    Exit Sub', 'BadEntry:', '    Range("B3") = "Invalid"', 'End Sub')],
  ['w9-vba-arrays-with', 'share', 'For Each over .Cells', L('Sub ShowShare()', '    For Each c In Range("C5:C11").Cells', '        With c.Offset(0, 2)', '            .Value = c / Range("E2")', '            .NumberFormat = "0%"', '        End With', '    Next', 'End Sub')],
  ['w9-vba-post-deliveries', 'post', 'Value assignment instead of the clipboard', L('Sub PostDeliveries()', '    Dim r As Integer, n As Integer', '    r = 5', '    Do While Cells(r, 2) <> ""',
    '        With Range("B15").End(xlDown).Offset(1, 0)', '            .Resize(1, 5).Value = Range(Cells(r, 2), Cells(r, 6)).Value', '            If .Offset(0, 3) < .Offset(0, 2) Then .Offset(0, 5) = "Short" Else .Offset(0, 5) = "OK"',
    '        End With', '        n = n + 1', '        r = r + 1', '    Loop', '    Range("B5:F12").ClearContents', '    Range("J4") = Now', '    Range("J6") = n', 'End Sub')],
  ['w9-vba-function-tables', 'tables-needed', '-Int(-x) rounding up', L('Function TablesNeeded(guests, seats)', '    TablesNeeded = -Int(-guests / seats)', 'End Function')],
  ['w9-vba-function-tables', 'tables-needed', 'Mod and \\', L('Function TablesNeeded(guests, seats)', '    If guests Mod seats = 0 Then', '        TablesNeeded = guests \\ seats', '    Else',
    '        TablesNeeded = Int(guests / seats) + 1', '    End If', 'End Function')],
  ['w9-vba-arrays-with', 'week-summary', 'a 0-based array used from 1 and Application.Max', L('Sub WeekSummary()', '    Dim cups(7) As Integer, i As Integer, best As Integer, below As Integer, total As Long',
    '    For i = 1 To 7', '        cups(i) = Cells(4 + i, 3).Value', '        total = total + cups(i)', '        If cups(i) < Range("E2").Value Then', '            Cells(4 + i, 4).Value = "Yes"', '            below = below + 1',
    '        Else', '            Cells(4 + i, 4).Value = "No"', '        End If', '    Next i', '    For i = 1 To 7', '        If cups(i) = Application.Max(Range("C5:C11")) And best = 0 Then best = i', '    Next i',
    '    Range("H5").Value = total', '    Range("H6").Value = Cells(4 + best, 2).Value', '    Range("H7").Value = below', 'End Sub')],
  ['w9-vba-queue-timer', 'stamp-macros', 'Value assignment from the clock cell', L('Sub StampArrive()', '    Range("C6").End(xlDown).Offset(1, 0).Value = Range("C7").Value', 'End Sub', '',
    'Sub StampStart()', '    Range("D6").End(xlDown).Offset(1, 0).Value = Range("D7").Value', 'End Sub', '', 'Sub StampEnd()', '    Range("E6").End(xlDown).Offset(1, 0).Value = Range("E7").Value', 'End Sub')],
]

for (const [exId, taskId, how, proc] of passes) {
  test(`${exId}/${taskId} passes with ${how}`, () => {
    const [e, t] = find(exId, taskId)
    const r = checkVbaTask(e, t, state(e, t, withDriver(t, proc)))
    assert.equal(r.ok, true, r.messages.join(' | '))
  })
}

const fails: [string, string, string, string, RegExp][] = [
  ['w9-vba-for-next-bibs', 'number-bibs', 'Str adds a space', L('Sub NumberBibs()', '    For i = 1 To 12', '        Cells(5 + i, 2) = Range("E2") + i - 1', '        Cells(5 + i, 3) = Range("E3") & Str(Cells(5 + i, 2))', '    Next i', 'End Sub'), /not right|C\d+/],
  ['w9-vba-worksheetfunction-static', 'totals', 'Dim instead of Static', L('Sub TotalsTwoWays()', '    Dim presses As Integer', '    presses = presses + 1', '    Range("C9").Value = WorksheetFunction.Sum(Range("C2:C8"))', '    Range("C10").Formula = "=SUM(C2:C8)"', '    Range("C12").Value = presses', 'End Sub'), /C12|Static/],
  ['w9-vba-select-case-lockers', 'assign', 'a fixed row count', L('Sub AssignLockers()', '    For r = 4 To 12', '        Select Case Cells(r, 2).Value', '            Case 1: Cells(r, 3) = "Small": Cells(r, 4) = 3.5', '            Case 2: Cells(r, 3) = "Medium": Cells(r, 4) = 5',
    '            Case 3: Cells(r, 3) = "Large": Cells(r, 4) = 7.5', '            Case Else: Cells(r, 3) = "Check code": Cells(r, 4) = 0', '        End Select', '    Next', 'End Sub'), /./],
  ['w9-vba-inputbox-errors', 'set-dose', 'no error trap', L('Sub SetDose()', '    Dim dose As Single', '    dose = InputBox("Litres per tray (0.5 to 5)")', '    Range("B2") = dose', '    Range("B3") = "OK"', 'End Sub'), /Type mismatch|On Error/],
]

for (const [exId, taskId, how, proc, why] of fails) {
  test(`${exId}/${taskId} fails with ${how}`, () => {
    const [e, t] = find(exId, taskId)
    const r = checkVbaTask(e, t, state(e, t, withDriver(t, proc)))
    assert.equal(r.ok, false)
    assert.match(r.messages.join(' | '), why)
  })
}
