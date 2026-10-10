// Interpreter tests (vba-core): control flow, error handling, arrays, With, Debug.Print, End, the step budget.
import assert from 'node:assert/strict'
import { main, prints, run, vtest } from './vbaCoreHarness.ts'
import { obj, str, type GlobalScope, type Val, type VbaObject } from '../src/lab/vba/runtime.ts'

// ---------- control flow ----------

vtest('If / ElseIf / Else and single-line If', () => {
  const src = `Function Size(n)
  If n < 10 Then
    Size = "S"
  ElseIf n < 100 Then
    Size = "M"
  Else
    Size = "L"
  End If
End Function
${main('  Debug.Print Size(5); Size(50); Size(500)\n  If Size(1) = "S" Then Debug.Print "one" Else Debug.Print "other"')}`
  assert.deepEqual(prints(src), ['SML', 'one'])
})

vtest('Select Case: values, lists, ranges, Is, strings, Case Else, first match wins', () => {
  const src = `Function Grade(s)
  Select Case s
    Case Is >= 90
      Grade = "A"
    Case 80 To 89
      Grade = "B"
    Case 70, 75, 79
      Grade = "C"
    Case 70 To 100
      Grade = "D"
    Case Else
      Grade = "F"
  End Select
End Function
Function Kind(w As String)
  Select Case w
    Case "a" To "m"
      Kind = "early"
    Case "zed"
      Kind = "zed"
    Case Else
      Kind = "late"
  End Select
End Function
${main('  Debug.Print Grade(95); Grade(85); Grade(75); Grade(72); Grade(10)\n  Debug.Print Kind("cat"); Kind("zed"); Kind("x")')}`
  assert.deepEqual(prints(src), ['ABCDF', 'earlyzedlate'])
})

vtest('For: Step (negative, fractional), counter value after the loop, Exit For', () => {
  const src = main(`  Dim i As Integer, x As Double, s As String
  For i = 10 To 1 Step -3
    s = s & i & ","
  Next i
  Debug.Print s; i
  For x = 0 To 1 Step 0.25
  Next x
  Debug.Print x
  For i = 1 To 10
    If i = 4 Then Exit For
  Next
  Debug.Print i
  For i = 5 To 1
    Debug.Print "never"
  Next i
  Debug.Print i`)
  assert.deepEqual(prints(src), ['10,7,4,1,-2', ' 1.25', ' 4', ' 5'])
})

vtest('Do loops (four forms), Exit Do, While...Wend', () => {
  const src = main(`  Dim n As Integer
  Do While n < 3
    n = n + 1
  Loop
  Debug.Print n
  Do Until n = 0
    n = n - 1
  Loop
  Debug.Print n
  Do
    n = n + 10
  Loop While n < 5
  Debug.Print n
  Do
    n = n + 1
  Loop Until True
  Debug.Print n
  Do
    n = n + 1
    If n > 20 Then Exit Do
  Loop
  Debug.Print n
  While n > 15
    n = n - 2
  Wend
  Debug.Print n`)
  assert.deepEqual(prints(src), [' 3', ' 0', ' 10', ' 11', ' 21', ' 15'])
})

vtest('GoTo and labels', () => {
  const src = main(`  Dim n As Integer
Again:
  n = n + 1
  If n < 3 Then GoTo Again
  Debug.Print n
  GoTo Done
  Debug.Print "skipped"
Done:
  Debug.Print "done"`)
  assert.deepEqual(prints(src), [' 3', 'done'])
})

function boxScope(log: string[]): GlobalScope {
  const make = (name: string): VbaObject => {
    const props = new Map<string, Val>()
    const self: VbaObject = {
      className: 'Box',
      get(member) {
        if (member.toLowerCase() === 'inner') return obj(make(`${name}.inner`))
        return props.get(member.toLowerCase()) ?? str(`${name}.${member}`)
      },
      set(member, _a, v) { log.push(`${name}.${member}=${v.t === 'str' ? v.v : JSON.stringify(v)}`); props.set(member.toLowerCase(), v) },
      call(member) { log.push(`${name}.${member}()`); return str('') },
    }
    return self
  }
  let made = 0
  return new Map([['newbox', { kind: 'fn', fn: () => { made++; log.push(`made ${made}`); return obj(make(`box${made}`)) } }]])
}

vtest('With evaluates its object once; nested With uses the innermost object', () => {
  const log: string[] = []
  const src = main(`  With NewBox()
    .Title = "a"
    With .Inner
      .Title = "b"
      .Refresh
    End With
    .Title = "c"
    Debug.Print .Title
  End With`)
  assert.deepEqual(prints(src, { globals: boxScope(log) }), ['c'])
  assert.deepEqual(log, ['made 1', 'box1.Title=a', 'box1.inner.Title=b', 'box1.inner.Refresh()', 'box1.Title=c'])
})

// ---------- error handling ----------

vtest('On Error GoTo + Resume Next continues inside the loop', () => {
  const src = main(`  Dim i As Integer, r As Double
  On Error GoTo Fix
  For i = -1 To 1
    r = 1 / i
    Debug.Print i; r
  Next i
  Debug.Print "done"
  Exit Sub
Fix:
  Debug.Print "err"; Err.Number
  Resume Next`)
  assert.deepEqual(prints(src), ['-1 -1', 'err 11', ' 0 -1', ' 1  1', 'done'])
})

vtest('Resume retries the failing statement; Resume label jumps', () => {
  const retry = main(`  Dim d As Integer
  On Error GoTo Handler
  Debug.Print 10 / d
  Exit Sub
Handler:
  d = 2
  Resume`)
  assert.deepEqual(prints(retry), [' 5'])
  const jump = main(`  On Error GoTo Handler
  Err.Raise 5
  Debug.Print "skipped"
After:
  Debug.Print "after"; Err.Number
  Exit Sub
Handler:
  Resume After`)
  assert.deepEqual(prints(jump), ['after 0'])
})

vtest('On Error Resume Next, Err.Number, Err.Description, Err.Clear', () => {
  const src = main(`  On Error Resume Next
  Dim x As Integer
  x = "abc"
  Debug.Print Err.Number; Err.Description
  Err.Clear
  Debug.Print Err.Number
  x = 1 / 0
  Debug.Print Err.Number
  On Error GoTo 0
  Debug.Print Err.Number`)
  assert.deepEqual(prints(src), [' 13 Type mismatch', ' 0', ' 11', ' 0'])
})

vtest('an unhandled error in a callee goes to the nearest caller with a handler', () => {
  const src = `Sub Inner()\n  Err.Raise 1000, , "custom"\n  Debug.Print "not here"\nEnd Sub
Sub Middle()\n  Inner\n  Debug.Print "not here either"\nEnd Sub
${main('  On Error GoTo H\n  Middle\n  Debug.Print "skipped"\n  Exit Sub\nH:\n  Debug.Print Err.Number; Err.Description')}`
  assert.deepEqual(prints(src), [' 1000 custom'])
})

vtest('an error inside the handler is not trapped; Resume without error is error 20', () => {
  const r = run(main(`  On Error GoTo H
  Err.Raise 5
  Exit Sub
H:
  Debug.Print "in handler"
  Err.Raise 9`))
  assert.equal(r.ok, false)
  assert.equal(r.error?.message, "Run-time error '9': Subscript out of range")
  assert.equal(r.error?.line, 8)
  assert.deepEqual(r.printed, ['in handler'])
  const r2 = run(main('  Resume Next'))
  assert.equal(r2.error?.message, "Run-time error '20': Resume without error")
})

vtest('unhandled run-time errors report the line and VBA message', () => {
  const r = run(main('  Dim a(1 To 3) As Integer\n  a(4) = 1'))
  assert.deepEqual(r.error, { line: 4, message: "Run-time error '9': Subscript out of range" })
  const r2 = run(`Sub Helper()\n  Dim x As Integer\n  x = "oops"\nEnd Sub\n${main('  Helper')}`)
  assert.deepEqual(r2.error, { line: 3, message: "Run-time error '13': Type mismatch" })
})

// ---------- arrays ----------

vtest('arrays: fixed, dynamic, ReDim, ReDim Preserve (last dimension)', () => {
  const src = main(`  Dim a() As Integer
  ReDim a(1 To 3)
  a(1) = 1: a(2) = 2: a(3) = 3
  ReDim Preserve a(1 To 5)
  a(5) = 5
  Debug.Print UBound(a); a(3); a(4); a(5)
  ReDim a(2)
  Debug.Print LBound(a); UBound(a); a(0)
  Dim m(1 To 2, 1 To 3) As Long
  m(2, 3) = 7
  ReDim g(1 To 2, 1 To 2)
  g(2, 2) = "x"
  ReDim Preserve g(1 To 2, 1 To 4)
  Debug.Print m(2, 3); UBound(m, 2); g(2, 2)`)
  assert.deepEqual(prints(src), [' 5  3  0  5', ' 0  2  0', ' 7  3 x'])
  const r = run(main('  Dim f(3) As Integer\n  ReDim f(5)'))
  assert.equal(r.ok, false)
})

vtest('arrays: Option Base 1, Array(), assignment copies, For Each, Split/Join', () => {
  const src = main(`  Dim a(3) As Integer, v, b, w, total
  v = Array(10, 20, 30)
  b = v
  b(1) = 99
  For Each w In v
    total = total + w
  Next w
  Debug.Print LBound(a); LBound(v); v(1); total
  Debug.Print Join(Split("a,b,c", ","), "-"); UBound(Split("")); UBound(Split("x y"))`, 'Option Base 1')
  assert.deepEqual(prints(src), [' 1  1  10  60', 'a-b-c-1  1'])
})

vtest('IsArray, uninitialised dynamic arrays and Erase', () => {
  const src = main(`  Dim d() As String, f(1 To 2) As Integer
  Debug.Print IsArray(d)
  f(1) = 5
  Erase f
  Debug.Print f(1)
  On Error Resume Next
  Debug.Print UBound(d)
  Debug.Print Err.Number`)
  assert.deepEqual(prints(src), ['True', ' 0', ' 9'])
})

// ---------- host interaction, printing, End, budget ----------

vtest('MsgBox and InputBox go through the host; Cancel gives ""', () => {
  const r = run(main(`  Dim ans, txt
  ans = MsgBox("Continue?", vbYesNo + vbQuestion, "Quiz")
  Debug.Print ans = vbNo
  txt = InputBox("Name?")
  Debug.Print "[" & txt & "]"
  txt = InputBox("Again?")
  Debug.Print "[" & txt & "]"
  MsgBox "Bye " & 1`), 'Main', { inputs: ['Ann', null], replies: [7] })
  assert.equal(r.ok, true)
  assert.deepEqual(r.printed, ['True', '[Ann]', '[]'])
  assert.deepEqual(r.prompts, ['Continue?', 'Name?', 'Again?', 'Bye 1'])
})

vtest('Debug.Print separators and an open line after ;', () => {
  const src = main('  Debug.Print "a", "b"\n  Debug.Print 1; 2\n  Debug.Print "x";\n  Debug.Print "y"\n  Debug.Print\n  Debug.Print -3; True; Null')
  assert.deepEqual(prints(src), [`a${' '.repeat(13)}b`, ' 1  2', 'xy', '', '-3 TrueNull'])
})

vtest('End stops the macro without an error', () => {
  const src = `Sub Stopper()\n  End\nEnd Sub\n${main('  Debug.Print "before"\n  Stopper\n  Debug.Print "after"')}`
  const r = run(src)
  assert.equal(r.ok, true)
  assert.deepEqual(r.printed, ['before'])
})

vtest('the step budget stops infinite loops', () => {
  const r = run(main('  Dim n As Long\n  Do\n    n = n + 1\n  Loop'), 'Main', { maxSteps: 1000 })
  assert.equal(r.ok, false)
  assert.match(r.error!.message, /^Macro stopped after 1,000 steps: possible infinite loop \(line \d\)$/)
  const r2 = run(main('  Do\n  Loop'), 'Main', { maxSteps: 500 })
  assert.equal(r2.ok, false)
})

vtest('Exit For outside a loop and Exit Function in a Sub are compile errors', () => {
  const r = run(main('  Debug.Print "ran"\n  Exit For'))
  assert.deepEqual(r.error, { line: 4, message: 'Compile error: Exit For not within For...Next' })
  assert.deepEqual(r.printed, [])
  const r2 = run(main('  Exit Function'))
  assert.equal(r2.error?.message, 'Compile error: Exit Function not allowed in Sub or Property')
  const r3 = run(main('  Do\n    For i = 1 To 2\n      Exit Do\n    Next\n  Loop\n  Debug.Print i'))
  assert.equal(r3.ok, true)
  assert.deepEqual(r3.printed, [' 1'])
})

vtest('Debug.Print Spc and Tab', () => {
  const src = main('  Debug.Print "a"; Spc(3); "b"\n  Debug.Print "ab"; Tab(6); "c"\n  Debug.Print "x"; Tab; "y"')
  assert.deepEqual(prints(src), ['a   b', 'ab   c', `x${' '.repeat(13)}y`])
})

vtest('On Error Resume Next: a failing If condition runs the Then block, as in VBA', () => {
  const src = main('  On Error Resume Next\n  If 1 / 0 > 1 Then\n    Debug.Print "then"; Err.Number\n  Else\n    Debug.Print "else"\n  End If')
  assert.deepEqual(prints(src), ['then 11'])
})
