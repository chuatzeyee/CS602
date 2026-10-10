// vba-semantics-flow.test.ts - control flow, procedures, errors and arrays as real VBA runs them.
// Run: npx tsx --test tests/vba-semantics-flow.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E6, E9, E13, L, check, runCases, vba, type Case } from './vbaSemanticsHarness'

const loops: Case[] = [
  // after a normal exit the counter is one Step past the end value
  ['For counter after a normal exit', L('For i = 1 To 5', 'Next i', 'Debug.Print CStr(i)'), ['6']],
  ['For counter after Exit For', L('For i = 1 To 10', 'If i = 3 Then Exit For', 'Next', 'Debug.Print CStr(i)'), ['3']],
  ['negative Step', L('For i = 10 To 1 Step -3', 's = s & i & ","', 'Next', 'Debug.Print s & "|" & i'), ['10,7,4,1,|-2']],
  ['a loop whose start is past its end runs zero times', L('c = 0', 'For i = 5 To 1', 'c = c + 1', 'Next', 'Debug.Print c & "|" & i'), ['0|5']],
  // the end value and the Step are evaluated once, before the first pass
  ['the bounds are evaluated once', L('n = 3', 'For i = 1 To n', 'n = 10', 'c = c + 1', 'Next', 'Debug.Print CStr(c)'), ['3']],
  ['changing the counter inside the loop changes the iterations', L('For i = 1 To 10', 'i = i + 1', 'c = c + 1', 'Next', 'Debug.Print c & " " & i'), ['5 11']],
  // the final increment of an Integer counter to 32768 overflows
  ['an Integer counter overflows on the final increment', L('Dim i As Integer', 'For i = 32766 To 32767', 'Next i'), { err: E6, line: 4 }],
  ['a fractional Step', L('For x = 0 To 1 Step 0.25', 'c = c + 1', 'Next', 'Debug.Print CStr(c) & " " & CStr(x)'), ['5 1.25']],
  ['Do Until true at entry runs zero times', L('i = 5', 'Do Until i > 3', 'i = i + 1', 'Loop', 'Debug.Print CStr(i)'), ['5']],
  ['Do ... Loop Until runs once', L('Do', 'i = i + 1', 'Loop Until True', 'Debug.Print CStr(i)'), ['1']],
  ['Do While / While Wend', L('Do While i < 3', 'i = i + 1', 'Loop', 'While j < 4', 'j = j + 2', 'Wend', 'Debug.Print i & " " & j'), ['3 4']],
  ['Exit Do leaves only the inner loop', L('For i = 1 To 3', 'Do', 'n = n + 1', 'If n Mod 2 = 0 Then Exit Do', 'Loop', 'Next', 'Debug.Print CStr(n)'), ['6']],
  ['nested For with the same Next order', L('For r = 1 To 2', 'For c = 1 To 3', 's = s & r & c & " "', 'Next c', 'Next r', 'Debug.Print Trim(s)'), ['11 12 13 21 22 23']],
  ['For Each over an array gives copies', L('a = Array(1, 2, 3)', 'For Each x In a', 'x = x * 10', 's = s + x', 'Next', 'Debug.Print s & " " & a(0)'), ['60 1']],
  // For Each walks a 2-D array in memory order: the first index changes fastest
  ['For Each over a 2-D array is column-major', L('Dim a(1 To 2, 1 To 2)', 'a(1, 1) = "a": a(1, 2) = "b": a(2, 1) = "c": a(2, 2) = "d"', 'For Each v In a', 's = s & v', 'Next', 'Debug.Print s'),
    ['acbd']],
  ['GoTo a label', L('GoTo Skip', 'Debug.Print "x"', 'Skip:', 'Debug.Print "y"'), ['y']],
]

const selectCase: Case[] = [
  // the first matching Case wins even when a later one also matches
  ['Select Case: To, lists, Is and Else, first match wins', L('For Each x In Array(1, 5, 7, 12, -1)', 'Select Case x', 'Case 1 To 3: s = s & "a"', 'Case 4, 5, 6: s = s & "b"', 'Case Is > 4: s = s & "c"', 'Case Else: s = s & "z"', 'End Select', 'Next', 'Debug.Print s'),
    ['abccz']],
  ['Select Case on strings with a range', L('For Each w In Array("apple", "date", "zebra")', 'Select Case w', 'Case "apple", "banana": s = s & "1"', 'Case "c" To "f": s = s & "2"', 'Case Else: s = s & "3"', 'End Select', 'Next', 'Debug.Print s'),
    ['123']],
  ['Select Case True', L('score = 85', 'Select Case True', 'Case score >= 90: g = "A"', 'Case score >= 80: g = "B"', 'Case Else: g = "C"', 'End Select', 'Debug.Print g'), ['B']],
  ['no match and no Else does nothing', L('Select Case 9', 'Case 1: Debug.Print "one"', 'End Select', 'Debug.Print "done"'), ['done']],
  ['Case with a mixed list', L('For Each x In Array(2, 4, 11, 8)', 'Select Case x', 'Case 1, 3 To 5, Is > 10: s = s & "y"', 'Case Else: s = s & "n"', 'End Select', 'Next', 'Debug.Print s'), ['nyyn']],
  ['a cell value in Select Case', L('Range("A1").Value = 3', 'Select Case Range("A1").Value', 'Case 3: Debug.Print "three"', 'Case Else: Debug.Print "other"', 'End Select'), ['three']],
]

const procs: Case[] = [
  // arguments are ByRef by default; (a) makes a copy; ByVal never changes the caller
  ['ByRef default, (paren) copy, Call and ByVal', L('Sub Main()', 'Dim a As Integer', 'a = 1', 'Inc a', 'Debug.Print CStr(a)', 'Inc (a)', 'Debug.Print CStr(a)', 'Call Inc(a)', 'Debug.Print CStr(a)', 'IncV a', 'Debug.Print CStr(a)', 'End Sub',
    'Sub Inc(x As Integer)', 'x = x + 1', 'End Sub', 'Sub IncV(ByVal x As Integer)', 'x = x + 1', 'End Sub'), ['2', '2', '3', '3']],
  ['array elements pass ByRef', L('Sub Main()', 'Dim arr(2) As Integer', 'Inc arr(1)', 'Inc arr(1)', 'Debug.Print CStr(arr(1))', 'End Sub', 'Sub Inc(x As Integer)', 'x = x + 1', 'End Sub'), ['2']],
  // a property value is passed as a temporary copy
  ['a cell value passed ByRef is not written back', L('Sub Main()', 'Range("A1").Value = 5', 'Bump Range("A1").Value', 'Debug.Print CStr(Range("A1").Value)', 'End Sub', 'Sub Bump(x)', 'x = x + 1', 'End Sub'), ['5']],
  ['a Function changes a ByRef argument', L('Sub Main()', 'k = 3', 'r = Dbl(k)', 'Debug.Print r & " " & k', 'r = Dbl((k))', 'Debug.Print r & " " & k', 'End Sub', 'Function Dbl(n)', 'n = n * 2', 'Dbl = n', 'End Function'), ['6 6', '12 6']],
  ['ByRef argument type mismatch is a compile error', L('Sub Main()', 'Dim d As Double', 'Inc d', 'End Sub', 'Sub Inc(x As Integer)', 'x = x + 1', 'End Sub'), { compile: /ByRef argument type mismatch/, line: 3 }],
  ['Static locals keep their value between calls', L('Sub Main()', 'Tick', 'Tick', 'Tick', 'End Sub', 'Sub Tick()', 'Static n As Integer', 'n = n + 1', 'Debug.Print CStr(n)', 'End Sub'), ['1', '2', '3']],
  ['module variables and constants are shared', L('Dim total As Long', 'Const RATE As Double = 0.5', 'Sub Main()', 'AddTo 5', 'AddTo 7', 'Debug.Print CStr(total) & " " & CStr(total * RATE)', 'End Sub', 'Sub AddTo(n)', 'total = total + n', 'End Sub'), ['12 6']],
  ['an unassigned Function returns its type\'s default', L('Sub Main()', 'Debug.Print CStr(IsEmpty(F())) & " " & CStr(G()) & " [" & H() & "]"', 'End Sub', 'Function F()', 'End Function', 'Function G() As Integer', 'End Function', 'Function H() As String', 'End Function'), ['True 0 []']],
  ['recursion', L('Sub Main()', 'Debug.Print CStr(Fact(10))', 'End Sub', 'Function Fact(n)', 'If n <= 1 Then Fact = 1 Else Fact = n * Fact(n - 1)', 'End Function'), ['3628800']],
  ['runaway recursion is Out of stack space', L('Sub Main()', 'Down 1', 'End Sub', 'Sub Down(n)', 'Down n + 1', 'End Sub'), { err: /'28': Out of stack space/ }],
  ['Optional parameters with defaults and IsMissing', L('Sub Main()', 'Debug.Print Greet("Ann") & "|" & Greet("Bo", "Hi") & "|" & CStr(Has()) & "|" & CStr(Has(1))', 'End Sub',
    'Function Greet(n, Optional g As String = "Hello")', 'Greet = g & " " & n', 'End Function', 'Function Has(Optional v) As Boolean', 'Has = Not IsMissing(v)', 'End Function'), ['Hello Ann|Hi Bo|False|True']],
  ['named arguments', L('Sub Main()', 'Show b:=2, a:=1', 'End Sub', 'Sub Show(a, b)', 'Debug.Print a & "," & b', 'End Sub'), ['1,2']],
  ['Exit Function keeps the value set so far', L('Sub Main()', 'Debug.Print CStr(F(5))', 'End Sub', 'Function F(n)', 'F = n', 'If n > 3 Then Exit Function', 'F = 0', 'End Function'), ['5']],
  ['End stops everything without an error', L('Sub Main()', 'Stopper', 'Debug.Print "not here"', 'End Sub', 'Sub Stopper()', 'Debug.Print "a"', 'End', 'End Sub'), ['a']],
]

const errors: Case[] = [
  ['On Error Resume Next then Err.Number and Err.Clear', L('On Error Resume Next', 'x = 1 / 0', 'Debug.Print Err.Number & " " & Err.Description', 'Err.Clear', 'Debug.Print Err.Number'), ['11 Division by zero', ' 0']],
  ['an error in a callee goes to the caller\'s handler', L('Sub Main()', 'On Error GoTo H', 'Inner', 'Debug.Print "not here"', 'Exit Sub', 'H:', 'Debug.Print "caught " & Err.Number', 'End Sub',
    'Sub Inner()', 'Debug.Print "in"', 'x = CInt("abc")', 'Debug.Print "after"', 'End Sub'), ['in', 'caught 13']],
  // Resume Next continues after the failing statement and clears Err
  ['Resume Next from a handler', L('On Error GoTo H', 'x = 1 / 0', 'Debug.Print "after " & Err.Number', 'Exit Sub', 'H:', 'Debug.Print "handler"', 'Resume Next'), ['handler', 'after 0']],
  ['Resume retries the failing statement', L('d = 0', 'On Error GoTo H', 'x = 10 / d', 'Debug.Print CStr(x)', 'Exit Sub', 'H:', 'd = 2', 'Resume'), ['5']],
  ['Resume to a label', L('On Error GoTo H', 'x = 1 / 0', 'Debug.Print "skipped"', 'Back:', 'Debug.Print "back"', 'Exit Sub', 'H:', 'Resume Back'), ['back']],
  ['an error inside the handler is not caught by it', L('On Error GoTo H', 'x = 1 / 0', 'Exit Sub', 'H:', 'y = CInt("a")'), { err: E13, line: 6 }],
  ['On Error GoTo 0 turns trapping off', L('On Error Resume Next', 'On Error GoTo 0', 'x = 1 / 0'), { err: /'11'/, line: 4 }],
  // Resume Next in the caller resumes after the call, not inside the Function
  ['an error in a Function under the caller\'s Resume Next', L('Sub Main()', 'On Error Resume Next', 'x = F()', 'Debug.Print "next " & Err.Number', 'End Sub', 'Function F()', 'F = 1 / 0', 'Debug.Print "F after"', 'End Function'), ['next 11']],
  ['Err.Raise with a description', L('On Error GoTo H', 'Err.Raise 1000, , "custom"', 'Exit Sub', 'H:', 'Debug.Print Err.Number & " " & Err.Description'), ['1000 custom']],
  ['an unhandled Err.Raise reports its description', 'Err.Raise 513, , "Bad thing"', { err: /'513': Bad thing/, line: 2 }],
]

const arrays: Case[] = [
  ['Option Base 1 changes Dim and Array but not Split', L('Option Base 1', 'Sub Main()', 'Dim a(3)', 'Debug.Print LBound(a) & " " & UBound(a) & " " & LBound(Array(1, 2)) & " " & LBound(Split("x y"))', 'End Sub'), ['1 3 1 0']],
  // ReDim Preserve may change only the upper bound of the last dimension
  ['ReDim Preserve: last dimension only', L('Dim a()', 'ReDim a(1 To 2, 1 To 2)', 'a(2, 2) = "x"', 'ReDim Preserve a(1 To 2, 1 To 4)', 'Debug.Print a(2, 2) & " " & UBound(a, 2)', 'ReDim Preserve a(1 To 3, 1 To 4)'),
    { err: E9, line: 7 }],
  ['ReDim clears and ReDim Preserve keeps', L('Dim a()', 'ReDim a(2)', 'a(1) = 7', 'ReDim Preserve a(5)', 'Debug.Print a(1) & " " & UBound(a)', 'ReDim a(3)', 'Debug.Print CStr(IsEmpty(a(1)))'), ['7 5', 'True']],
  ['UBound and LBound per dimension', L('Dim a(1 To 3, 0 To 4)', 'Debug.Print UBound(a) & " " & UBound(a, 2) & " " & LBound(a, 2)', 'x = UBound(a, 3)'), { err: E9, line: 4 }],
  ['UBound of an unallocated array', L('Dim b() As Integer', 'x = UBound(b)'), { err: E9, line: 3 }],
  ['an index past the bound', L('Dim a(2)', 'a(3) = 1'), { err: E9, line: 3 }],
  ['typed arrays start with typed defaults', L('Dim n(2) As Integer, s(1) As String', 'Debug.Print n(0) + 1 & "[" & s(1) & "]" & TypeName(n)'), ['1[]Integer()']],
  ['assigning an array copies it', L('Dim a', 'a = Array(1, 2)', 'b = a', 'b(0) = 9', 'Debug.Print a(0) & " " & b(0)'), ['1 9']],
  ['IsArray and Erase', L('Dim a()', 'ReDim a(2)', 'Debug.Print CStr(IsArray(a))', 'Erase a', 'x = UBound(a)'), { err: E9, line: 6 }],
  ['ReDim of a fixed-size array is a compile error', L('Dim b(3)', 'b(1) = 1', 'ReDim b(5)'), { compile: /Array already dimensioned/, line: 4 }],
  ['ReDim Preserve may not move a lower bound', L('Dim a()', 'ReDim a(1 To 2, 1 To 3)', 'ReDim Preserve a(1 To 2, 0 To 3)'), { err: E9, line: 4 }],
]

runCases([...loops, ...selectCase, ...procs, ...errors, ...arrays])

test('Option Explicit: an undeclared variable is a compile error and nothing runs', () => {
  const ran = check(L('Option Explicit', 'Sub Main()', 'Dim x As Integer', 'Range("A1").Value = 1', 'x = 1', 'y = 2', 'End Sub'), { compile: /Variable not defined/, line: 6 })
  assert.equal(ran.sheet.read('A1').kind, 'empty')
})

test('step budget: an endless loop stops with the step message', () => {
  const ran = vba(L('Do', 'x = x + 1', 'Loop'), { maxSteps: 5000 })
  assert.equal(ran.r.ok, false)
  assert.match(ran.r.error?.message ?? '', /Macro stopped after 5,000 steps: possible infinite loop/)
})

test('step budget: For with Step 0 never ends', () => {
  const ran = vba(L('For i = 1 To 3 Step 0', 'c = c + 1', 'Next'), { maxSteps: 5000 })
  assert.match(ran.r.error?.message ?? '', /Macro stopped after 5,000 steps/)
})

test('a run-time error reports the line inside the callee', () => {
  check(L('Sub Main()', 'Helper', 'End Sub', 'Sub Helper()', 'Dim i As Integer', 'i = 40000', 'End Sub'), { err: E6, line: 6 })
})

test('an error in Loop Until is reported on the Loop line', () => {
  check(L('Do', 'n = n + 1', 'Loop Until n / 0 > 1'), { err: /'11'/, line: 4 })
})

// more compile errors that VBA reports before running anything
const compileMore: Case[] = [
  ['On Error GoTo a missing label', L('On Error GoTo Nowhere', 'x = 1'), { compile: /Label not defined/ }],
  ['Exit For outside a For', L('x = 1', 'Exit For'), { compile: /Exit For not within For/, line: 3 }],
  ['Exit Do outside a Do', L('x = 1', 'Exit Do'), { compile: /Exit Do not within Do/, line: 3 }],
  ['a duplicate Dim', L('Dim x As Integer', 'Dim x As Long'), { compile: /Duplicate declaration in current scope/, line: 3 }],
  ['assigning to a Const', L('Const RATE = 0.5', 'RATE = 1'), { compile: /Assignment to constant not permitted/, line: 3 }],
  ['a Function called with too many arguments', L('Sub Main()', 'x = Twice(1, 2)', 'End Sub', 'Function Twice(n)', 'Twice = n * 2', 'End Function'), { compile: /Wrong number of arguments/, line: 2 }],
  ['a Sub called with too few arguments', L('Sub Main()', 'Show 1', 'End Sub', 'Sub Show(a, b)', 'End Sub'), { compile: /Argument not optional/, line: 2 }],
]

// Variant arithmetic promotes on overflow; typed Integer arithmetic does not
const promotion: Case[] = [
  ['a Variant times an Integer literal promotes to Long', L('Dim v', 'v = 200', 'Debug.Print CStr(v * 200) & " " & TypeName(v * 200)'), ['40000 Long']],
  ['an Integer variable times an Integer literal overflows', L('Dim i As Integer', 'i = 200', 'Debug.Print i * 200'), { err: E6, line: 4 }],
  ['an Integer times a Long literal is a Long', L('Dim i As Integer', 'i = 200', 'Debug.Print CStr(i * 200&)'), ['40000']],
  ['a cell number is a Double, so no Integer overflow', L('Range("A1").Value = 200', 'Debug.Print CStr(Range("A1").Value * 200)'), ['40000']],
  ['Integer from a cell rounds half to even', L('Dim i As Integer', 'Range("A1").Value = 2.5', 'i = Range("A1").Value', 'Debug.Print CStr(i)'), ['2']],
]

// functions returning arrays, object variables and Set
const objectsAndArrays: Case[] = [
  ['a Function returning an array', L('Sub Main()', 'Debug.Print F()(1) & " " & UBound(F())', 'End Sub', 'Function F()', 'F = Array(10, 20, 30)', 'End Function'), ['20 2']],
  ['a Worksheet variable', L('Dim ws As Worksheet', 'Set ws = ActiveSheet', 'ws.Range("A1").Value = 1', 'Debug.Print ws.Name & " " & Worksheets("Sheet1").Range("A1").Value & " " & Worksheets.Count'), ['Sheet1 1 1']],
  ['a missing sheet is subscript out of range', 'x = Worksheets("Nope").Range("A1").Value', { err: E9, line: 2 }],
  ['For Each sheet in Worksheets', L('For Each ws In Worksheets', 'Debug.Print ws.Name', 'Next'), ['Sheet1']],
  ['Set x = 5 needs an object', L('Dim x As Range', 'Set x = 5'), { err: /'424': Object required|Type mismatch|Object required/ }],
]

runCases([...compileMore, ...promotion, ...objectsAndArrays])

const errorChains: Case[] = [
  ['an error two calls down reaches the first handler; Resume Next continues after the call', L('Sub Main()', 'On Error GoTo H', 'A', 'Debug.Print "back " & Err.Number', 'Exit Sub', 'H:', 'Debug.Print "caught " & Err.Number', 'Resume Next', 'End Sub',
    'Sub A()', 'B', 'Debug.Print "A after"', 'End Sub', 'Sub B()', 'Err.Raise 1001', 'End Sub'), ['caught 1001', 'back 0']],
  ['a callee that handles its own error leaves Err clear for the caller', L('Sub Main()', 'Inner', 'Debug.Print "main " & Err.Number', 'End Sub',
    'Sub Inner()', 'On Error GoTo H', 'x = 1 / 0', 'Exit Sub', 'H:', 'Debug.Print "inner " & Err.Number', 'End Sub'), ['inner 11', 'main 0']],
  ['Err.Raise in a handler goes to the caller\'s handler', L('Sub Main()', 'On Error GoTo H', 'Inner', 'Exit Sub', 'H:', 'Debug.Print "main " & Err.Number & " " & Err.Description', 'End Sub',
    'Sub Inner()', 'On Error GoTo H2', 'x = 1 / 0', 'Exit Sub', 'H2:', 'Err.Raise Err.Number, , "inner: " & Err.Description', 'End Sub'), ['main 11 inner: Division by zero']],
  ['On Error Resume Next and a failed Set leave the variable Nothing', L('Dim r As Range', 'On Error Resume Next', 'Set r = Worksheets("Nope").Range("A1")', 'Debug.Print Err.Number & " " & CStr(r Is Nothing)'), ['9 True']],
  // Resume Next continues with the statement after the failing one, so "ok 2" still prints
  ['a handler in a loop handles each error', L('On Error GoTo H', 'For i = 1 To 3', 'x = 1 / (i - 2)', 'Debug.Print "ok " & i', 'Next', 'Exit Sub', 'H:', 'Debug.Print "bad " & i', 'Resume Next'), ['ok 1', 'bad 2', 'ok 2', 'ok 3']],
  // under Resume Next, an If whose condition fails runs its Then branch
  ['a failing If condition under Resume Next enters the Then branch', L('On Error Resume Next', 'If 1 / 0 > 1 Then Debug.Print "then" Else Debug.Print "else"', 'Debug.Print Err.Number'), ['then', ' 11']],
  ['Resume outside a handler is error 20', 'Resume Next', { err: /'20': Resume without error/ }],
  ['the error message of an unhandled standard error', 'x = Array(1)(5)', { err: /^Run-time error '9': Subscript out of range$/, line: 2 }],
]

runCases(errorChains)

// Collection and Scripting.Dictionary (not in the course, but VBA built-ins learners may know)
const collections: Case[] = [
  ['New Collection: Add with key and Before, Item by index or key (any case), For Each, Remove', L('Dim c As New Collection', 'c.Add "a"', 'c.Add "b", "kb"', 'c.Add "z", Before:=1',
    'Debug.Print c.Count & " " & c(1) & " " & c("KB") & " " & c.Item(3)', 'For Each x In c', 's = s & x', 'Next', 'c.Remove 1', 'Debug.Print s & " " & c.Count'), ['3 z b b', 'zab 2']],
  ['a duplicate Collection key is error 457', L('Dim c As New Collection', 'c.Add 1, "k"', 'c.Add 2, "K"'), { err: /'457': This key is already associated/, line: 4 }],
  ['a missing Collection index is error 9', L('Set c = New Collection', 'x = c(1)'), { err: /'9'/, line: 3 }],
  // reading a missing key adds it, as Scripting.Dictionary does; keys are case-sensitive by default
  ['Scripting.Dictionary: Add, item assignment, Exists, Keys, Items, For Each keys', L('Set d = CreateObject("Scripting.Dictionary")', 'd.Add "apple", 3', 'd("pear") = 5', 'd("apple") = d("apple") + 1',
    'Debug.Print d.Count & " " & d("apple") & " " & CStr(d.Exists("pear")) & " " & CStr(d.Exists("Pear")) & " " & Join(d.Keys, ",") & " " & UBound(d.Items)',
    'x = d("missing")', 'For Each k In d', 't = t & k & "=" & d(k) & ";"', 'Next', 'Debug.Print d.Count & " " & t'), ['2 4 True False apple,pear 1', '3 apple=4;pear=5;missing=;']],
  ['an unknown class is error 429', 'Set x = CreateObject("Excel.Application")', { err: /'429'/, line: 2 }],
]

runCases(collections)

// JavaScript's limits surface as VBA errors with a line, and can be trapped
const limits: Case[] = [
  ['a string that keeps doubling runs out of string space', L('s = "x"', 'For i = 1 To 40', 's = s & s', 'Next'), { err: /'14': Out of string space/, line: 4 }],
  ['a huge array is out of memory', L('Dim a()', 'ReDim a(1 To 100000000)'), { err: /'7': Out of memory/, line: 3 }],
  ['an out-of-memory error can be trapped', L('On Error Resume Next', 'x = String(2000000000, "x")', 'Debug.Print Err.Number'), [' 14']],
]

runCases(limits)
