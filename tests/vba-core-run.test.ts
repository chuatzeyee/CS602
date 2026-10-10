// Interpreter tests (vba-core): VBA source run through parseModule + runModule with a fake host.
import assert from 'node:assert/strict'
import { main, prints, run, vtest } from './vbaCoreHarness.ts'

// ---------- calls and arguments ----------

vtest('ByRef is the default; (x) and expressions pass by value; Call keeps ByRef', () => {
  const src = `Sub Inc(x)\n  x = x + 1\nEnd Sub\n${main('  Dim a As Variant\n  a = 1\n  Inc a\n  Debug.Print a\n  Inc (a)\n  Debug.Print a\n  Call Inc(a)\n  Debug.Print a\n  Inc a + 0\n  Debug.Print a')}`
  assert.deepEqual(prints(src), [' 2', ' 2', ' 3', ' 3'])
})

vtest('ByVal copies the argument', () => {
  const src = `Sub Dbl(ByVal x As Long)\n  x = x * 2\nEnd Sub\n${main('  Dim n As Long\n  n = 5\n  Dbl n\n  Debug.Print n')}`
  assert.deepEqual(prints(src), [' 5'])
})

vtest('ByRef array elements are written back', () => {
  const src = `Sub SetIt(v)\n  v = 42\nEnd Sub\n${main('  Dim arr(1 To 3) As Variant\n  SetIt arr(2)\n  Debug.Print arr(2)')}`
  assert.deepEqual(prints(src), [' 42'])
})

vtest('ByRef argument type mismatch is a compile error reported before running', () => {
  const r = run(`Sub F(x As Integer)\nEnd Sub\n${main('  Debug.Print "ran"\n  Dim y As Long\n  F y')}`)
  assert.equal(r.ok, false)
  assert.deepEqual(r.error, { line: 7, message: 'Compile error: ByRef argument type mismatch' })
  assert.deepEqual(r.printed, [])
  const undeclared = run(`Function G(n As Long)\n  G = n\nEnd Function\n${main('  k = 1\n  Debug.Print G(k)')}`)
  assert.equal(undeclared.error?.message, 'Compile error: ByRef argument type mismatch')
  const fine = `Sub H(x As Long, ByVal y As Integer, z)\n  x = x + y\nEnd Sub\n${main('  Dim a As Long, b As Long, c(1 To 2) As Long\n  H a, b, "lit"\n  H c(1), (b), b\n  Debug.Print a; c(1)')}`
  assert.deepEqual(prints(fine), [' 0  0'])
})

vtest('Optional parameters: defaults and IsMissing', () => {
  const src = `Function Greet(who As String, Optional greeting As String = "Hello", Optional extra)
  If IsMissing(extra) Then
    Greet = greeting & ", " & who
  Else
    Greet = greeting & ", " & who & extra
  End If
End Function
${main('  Debug.Print Greet("Ann")\n  Debug.Print Greet("Bob", "Hi")\n  Debug.Print Greet("Cy", , "!")')}`
  assert.deepEqual(prints(src), ['Hello, Ann', 'Hi, Bob', 'Hello, Cy!'])
})

vtest('named arguments and ParamArray', () => {
  const src = `Function Total(ParamArray xs())
  Dim x
  For Each x In xs
    Total = Total + x
  Next x
End Function
Function Box(w, h)
  Box = w & "x" & h
End Function
${main('  Debug.Print Total(1, 2, 3)\n  Debug.Print Box(h:=2, w:=5)')}`
  assert.deepEqual(prints(src), [' 6', '5x2'])
})

vtest('Function result: assignment to its name, typed default, Empty default', () => {
  const src = `Function A() As Long\nEnd Function\nFunction B()\nEnd Function\nFunction C() As String\n  C = 12\nEnd Function
${main('  Debug.Print A()\n  Debug.Print TypeName(B())\n  Debug.Print TypeName(C()); C()')}`
  assert.deepEqual(prints(src), [' 0', 'Empty', 'String12'])
})

vtest('Static variables persist across calls; Dim does not', () => {
  const src = `Function Counter() As Integer\n  Static n As Integer\n  Dim m As Integer\n  n = n + 1\n  m = m + 1\n  Counter = n * 10 + m\nEnd Function
${main('  Counter\n  Counter\n  Debug.Print Counter()')}`
  assert.deepEqual(prints(src), [' 31'])
})

vtest('recursion works and runaway recursion is error 28', () => {
  const src = `Function Fact(n As Long) As Long\n  If n <= 1 Then\n    Fact = 1\n  Else\n    Fact = n * Fact(n - 1)\n  End If\nEnd Function
Function Deep(n)\n  Deep = Deep(n + 1)\nEnd Function
${main('  Debug.Print Fact(10)')}`
  assert.deepEqual(prints(src), [' 3628800'])
  const r = run(src, 'Deep', { args: [{ t: 'int', v: 1 }] })
  assert.equal(r.ok, false)
  assert.equal(r.error!.message, "Run-time error '28': Out of stack space")
})

vtest('calling a Function entry with arguments returns its value', () => {
  const r = run('Function TablesNeeded(guests, seats)\n  Dim t As Integer\n  t = Int(guests / seats)\n  If t * seats < guests Then t = t + 1\n  TablesNeeded = t\nEnd Function',
    'TablesNeeded', { args: [{ t: 'double', v: 45 }, { t: 'double', v: 8 }] })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { t: 'int', v: 6 })
})

// ---------- types, overflow, coercion on assignment ----------

vtest('Integer overflow: literals and typed variables raise 6, Variants widen', () => {
  const r = run(main('  Dim x As Long\n  x = 200 * 200'))
  assert.equal(r.error?.message, "Run-time error '6': Overflow")
  assert.equal(r.error?.line, 4)
  const r2 = run(main('  Dim i As Integer\n  i = 32767\n  i = i + 1'))
  assert.equal(r2.error?.message, "Run-time error '6': Overflow")
  assert.deepEqual(prints(main('  v = 200\n  v = v * 200\n  Debug.Print v; TypeName(v)')), [' 40000 Long'])
  assert.equal(run(main('  Debug.Print CInt(200) * CInt(200)')).error?.message, "Run-time error '6': Overflow")
})

vtest('typed variables coerce on assignment', () => {
  assert.deepEqual(prints(main('  Dim i As Integer, s As String, b As Boolean, d As Double\n  i = "12"\n  s = 5.5\n  b = "True"\n  d = "1e3"\n  Debug.Print i; s; b; d')),
    [' 12 5.5True 1000'])
  const r = run(main('  Dim i As Integer\n  i = "abc"'))
  assert.equal(r.error?.message, "Run-time error '13': Type mismatch")
  assert.deepEqual(prints(main('  Dim i As Integer\n  i = 2.5\n  Debug.Print i\n  i = 3.5\n  Debug.Print i')), [' 2', ' 4'])
})

vtest('banker rounding in CInt, CLng and Round', () => {
  assert.deepEqual(prints(main('  Debug.Print CInt(2.5)\n  Debug.Print CInt(3.5)\n  Debug.Print Round(2.5)\n  Debug.Print Round(0.125, 2)\n  Debug.Print CLng(-2.5)')),
    [' 2', ' 4', ' 2', ' 0.12', '-2'])
})

vtest('string comparison: binary by default, Option Compare Text', () => {
  const body = '  Debug.Print "abc" = "ABC"\n  Debug.Print StrComp("a", "B")\n  Debug.Print InStr("Hello", "LL")'
  assert.deepEqual(prints(main(body)), ['False', ' 1', ' 0'])
  assert.deepEqual(prints(main(body, 'Option Compare Text')), ['True', '-1', ' 3'])
})

vtest('comparisons of cell-like Variants with literals', () => {
  const src = main('  Dim v As Variant, e As Variant\n  v = 5\n  Debug.Print v = "5"\n  Debug.Print e = ""\n  Debug.Print e = 0\n  Debug.Print v > 4')
  assert.deepEqual(prints(src), ['True', 'True', 'True', 'True'])
})

vtest('Like operator', () => {
  assert.deepEqual(prints(main('  Debug.Print "PK-411" Like "PK-###"\n  Debug.Print "Smith" Like "s*"\n  Debug.Print "b" Like "[!a-c]"')),
    ['True', 'False', 'False'])
})

vtest('Set, Nothing, Is and error 91', () => {
  assert.deepEqual(prints(main('  Dim o As Object\n  Debug.Print o Is Nothing')), ['True'])
  const r = run(main('  Dim o As Object\n  Debug.Print o.Name'))
  assert.equal(r.error?.message, "Run-time error '91': Object variable or With block variable not set")
})

vtest('implicit variables without Option Explicit', () => {
  assert.deepEqual(prints(main('  total = 0\n  For k = 1 To 300\n    total = total + k * k\n  Next k\n  Debug.Print total')), [' 9045050'])
})

vtest('Option Explicit: Variable not defined is reported before running', () => {
  const r = run(main('  Debug.Print "ran"\n  x = 5', 'Option Explicit'))
  assert.equal(r.ok, false)
  assert.equal(r.error?.message, 'Compile error: Variable not defined')
  assert.equal(r.error?.line, 4)
  assert.deepEqual(r.printed, [])
})

vtest('unknown procedure is a compile error before running', () => {
  const r = run(main('  Debug.Print "ran"\n  DoesNotExist 1'))
  assert.equal(r.error?.message, 'Compile error: Sub or Function not defined')
  assert.deepEqual(r.printed, [])
})

vtest('module-level variables and constants', () => {
  const src = `Dim hits As Integer\nConst RATE As Double = 0.5\nPrivate Const NAME_ = "Lab"
Sub Hit()\n  hits = hits + 1\nEnd Sub
${main('  Hit\n  Hit\n  Debug.Print hits; RATE * 4; NAME_')}`
  assert.deepEqual(prints(src), [' 2  2 Lab'])
  const r = run(main('  Const K = 1\n  K = 2'))
  assert.match(r.error!.message, /Assignment to constant not permitted|constant/)
})

// ---------- more call and type semantics ----------

vtest('Exit Function keeps the value so far; functions can return arrays', () => {
  const src = `Function Firsts(n)\n  Firsts = n * 2\n  Exit Function\n  Firsts = 0\nEnd Function
Function Pair()\n  Pair = Array("x", "y")\nEnd Function
${main('  Dim parts() As String\n  parts = Split("a b c")\n  Debug.Print Firsts(4); Pair()(1); UBound(parts); parts(2)')}`
  assert.deepEqual(prints(src), [' 8 y 2 c'])
})

vtest('module-level variables pass ByRef; implicit variables are local to their procedure', () => {
  const src = `Dim total As Long\nSub Add(ByRef t As Long, n)\n  t = t + n\n  scratch = 99\nEnd Sub
${main('  Add total, 5\n  Add total, 7\n  Debug.Print total; IsEmpty(scratch)')}`
  assert.deepEqual(prints(src), [' 12 True'])
})

vtest('IIf evaluates both parts and And/Or do not short-circuit', () => {
  const r = run(main('  Dim x As Integer\n  Debug.Print IIf(x > 0, 1 / x, 0)'))
  assert.equal(r.error?.message, "Run-time error '11': Division by zero")
  const r2 = run(main('  Dim x As Integer\n  If x <> 0 And 10 / x > 1 Then Debug.Print "big"'))
  assert.equal(r2.error?.message, "Run-time error '11': Division by zero")
})

vtest('Err.Raise with a custom number; the Error statement raises', () => {
  const src = main('  On Error Resume Next\n  Err.Raise 1234\n  Debug.Print Err.Number; Err.Description\n  Err.Clear\n  Error 9\n  Debug.Print Err.Number')
  assert.deepEqual(prints(src), [' 1234 Application-defined or object-defined error', ' 9'])
})

vtest('Static Sub keeps every local; an Integer For counter can overflow', () => {
  const src = `Static Sub Tick()\n  Dim n As Integer\n  n = n + 1\n  Debug.Print n\nEnd Sub\n${main('  Tick\n  Tick')}`
  assert.deepEqual(prints(src), [' 1', ' 2'])
  const r = run(main('  Dim i As Integer\n  For i = 32766 To 32767\n  Next i'))
  assert.equal(r.error?.message, "Run-time error '6': Overflow")
})

vtest('For Each over a 2-D array goes down the first index first', () => {
  const src = main('  Dim g(1 To 2, 1 To 2), v, s\n  g(1, 1) = "a": g(1, 2) = "b": g(2, 1) = "c": g(2, 2) = "d"\n  For Each v In g\n    s = s & v\n  Next\n  Debug.Print s')
  assert.deepEqual(prints(src), ['acbd'])
})

vtest('Select Case and InStr follow Option Compare Text', () => {
  const src = main('  Select Case "YES"\n    Case "yes"\n      Debug.Print "matched"\n    Case Else\n      Debug.Print "no"\n  End Select', 'Option Compare Text')
  assert.deepEqual(prints(src), ['matched'])
})

vtest('Set is required for object variables; Let on Nothing is error 91', () => {
  const src = `Dim box As Object\n${main('  box = 5')}`
  const r = run(src)
  assert.equal(r.error?.message, "Run-time error '91': Object variable or With block variable not set")
  const r2 = run(main('  Dim v\n  Set v = 5'))
  assert.equal(r2.error?.message, "Run-time error '424': Object required")
})

vtest('the Mid statement overwrites characters in place', () => {
  assert.deepEqual(prints(main('  Dim s As String\n  s = "abcdef"\n  Mid(s, 2, 3) = "XYZW"\n  Debug.Print s\n  Mid(s, 5) = "123"\n  Debug.Print s')), ['aXYZef', 'aXYZ12'])
})

vtest('a misspelt type is "User-defined type not defined"; class names are objects', () => {
  const r = run(main('  Dim n As Intger\n  n = 5'))
  assert.deepEqual(r.error, { line: 3, message: 'Compile error: User-defined type not defined' })
  assert.equal(run(main('  Dim s As Strng')).error?.message, 'Compile error: User-defined type not defined')
  assert.deepEqual(prints(main('  Dim ws As Worksheet, c As Collection, d As Date, x As Long\n  Debug.Print ws Is Nothing; d')), ['True12:00:00 AM'])
})
