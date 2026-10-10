// vba-semantics.test.ts - small programs whose results are known from real VBA (Excel 365, Windows, en-US).
// Each case is the body of `Sub Main()` (or a whole module when it declares its own procedures); the expected
// value is the list of Debug.Print lines (trailing blanks trimmed) or an error. Subtle rules are commented.
// Run: npx tsx --test tests/vba-semantics.test.ts
import { E6, L, runCases, type Case } from './vbaSemanticsHarness'

// line numbers below are module lines: line 1 is `Sub Main()`, so the body's first line is line 2
const numbers: Case[] = [
  // Integer + Integer is computed as Integer, so it overflows before the assignment
  ['Integer variable overflows at 32768', L('Dim i As Integer', 'i = 32767', 'i = i + 1'), { err: E6, line: 4 }],
  ['200 * 200 overflows even into a Long (Integer literals)', L('Dim l As Long', 'l = 200 * 200'), { err: E6, line: 3 }],
  ['CLng(200) * 200 is a Long product', L('Dim l As Long', 'l = CLng(200) * 200', 'Debug.Print CStr(l)'), ['40000']],
  ['the & type suffix makes a Long literal', L('Dim l As Long', 'l = 200& * 200', 'Debug.Print CStr(l)'), ['40000']],
  ['Long overflows past 2147483647', L('Dim l As Long', 'l = 2147483647', 'l = l + 1'), { err: E6, line: 4 }],
  // a Variant holding an Integer is promoted to Long instead of overflowing
  ['Variant arithmetic promotes Integer to Long', L('Dim v', 'v = 32767', 'v = v + 1', 'Debug.Print TypeName(v) & " " & v'), ['Long 32768']],
  ['literal types', 'Debug.Print TypeName(5) & " " & TypeName(40000) & " " & TypeName(2.5) & " " & TypeName("a") & " " & TypeName(True) & " " & TypeName(Empty) & " " & TypeName(Null)',
    ['Integer Long Double String Boolean Empty Null']],
  ['operator result types', 'Debug.Print TypeName(4 / 2) & " " & TypeName(7 \\ 2) & " " & TypeName(2 ^ 2) & " " & TypeName(5 Mod 3) & " " & TypeName(40000 \\ 2)',
    ['Double Integer Double Integer Long']],
  // CInt, CLng and Round use banker's rounding (half to even)
  ['CInt rounds half to even', 'Debug.Print CInt(2.5) & " " & CInt(3.5) & " " & CInt(-2.5) & " " & CInt(1.5) & " " & CInt(0.5)', ['2 4 -2 2 0']],
  ['CLng rounds half to even', 'Debug.Print CLng(2.5) & " " & CLng(-3.5) & " " & CLng("6.5")', ['2 -4 6']],
  ['Round is banker\'s rounding too', 'Debug.Print Round(2.5) & " " & Round(3.5) & " " & Round(-2.5) & " " & Round(0.125, 2) & " " & Round(0.375, 2)',
    ['2 4 -2 0.12 0.38']],
  ['CInt(32767.5) rounds to 32768 and overflows', 'x = CInt(32767.5)', { err: E6, line: 2 }],
  ['assigning a Double to an Integer rounds half to even', L('Dim i As Integer', 'i = 2.5', 'Debug.Print CStr(i)', 'i = 3.5', 'Debug.Print CStr(i)'), ['2', '4']],
  ['Int floors, Fix truncates', 'Debug.Print Int(-2.5) & " " & Fix(-2.5) & " " & Int(2.7) & " " & Fix(2.7) & " " & Int(-0.1)', ['-3 -2 2 2 -1']],
  // \ and Mod round their operands to whole numbers (half to even) first; the result takes the dividend's sign
  ['integer division truncates toward zero after rounding the operands', 'Debug.Print (7 \\ 2) & " " & (-7 \\ 2) & " " & (7.5 \\ 2) & " " & (6.5 \\ 2) & " " & (-7.5 \\ 2)',
    ['3 -3 4 3 -4']],
  ['Mod takes the sign of the dividend and rounds operands', 'Debug.Print (-7 Mod 3) & " " & (7 Mod -3) & " " & (10.5 Mod 3) & " " & (11.5 Mod 3) & " " & (5 Mod 2.5)',
    ['-1 1 1 0 1']],
  ['1 / 0 is division by zero', 'x = 1 / 0', { err: /'11': Division by zero/, line: 2 }],
  ['5 \\ 0 and 5 Mod 0 are division by zero', L('On Error Resume Next', 'x = 5 \\ 0', 'Debug.Print Err.Number', 'Err.Clear', 'x = 5 Mod 0', 'Debug.Print Err.Number'), [' 11', ' 11']],
  // a VBA oddity: 0 / 0 raises Overflow, not Division by zero
  ['0 / 0 is an overflow', 'x = 0 / 0', { err: E6, line: 2 }],
  // negation binds looser than ^, and ^ is left-associative
  ['-2 ^ 2 is -4 and 2 ^ 3 ^ 2 is 64', 'Debug.Print CStr(-2 ^ 2) & " " & CStr(2 ^ 3 ^ 2)', ['-4 64']],
  ['bitwise And/Or/Xor/Not on numbers', 'Debug.Print (5 And 3) & " " & (5 Or 3) & " " & (5 Xor 3) & " " & (Not 0) & " " & (Not 5) & " " & (True And 6)', ['1 7 6 -1 -6 6']],
  ['True is -1 in arithmetic', 'Debug.Print CStr(True + 1) & " " & CInt(True) & " " & CStr(CBool(5)) & " " & CStr(CBool(0))', ['0 -1 True False']],
  ['CStr keeps 15 significant digits', 'Debug.Print CStr(0.1 + 0.2) & " " & CStr(1 / 3) & " " & CStr(2 ^ 50) & " " & CStr(1E+15) & " " & CStr(100000000000000#)',
    ['0.3 0.333333333333333 1.12589990684262E+15 1E+15 100000000000000']],
]

runCases(numbers)

const E13 = /'13': Type mismatch/

// comparison: two Strings compare as text; a String vs a number converts the String; between two Variants a number
// is always less than a string (VBA "Comparison operators" table)
const compare: Case[] = [
  ['two strings compare as text: "10" < "9"', 'Debug.Print CStr("10" < "9") & " " & CStr(10 < 9)', ['True False']],
  ['a Variant string against a number compares numerically', L('Dim v', 'v = "10"', 'Debug.Print CStr(v > 9)'), ['True']],
  ['between two Variants a number is less than a string', L('Dim a, b', 'a = 10', 'b = "9"', 'Debug.Print CStr(a < b)'), ['True']],
  ['a typed String against a number is converted', L('Dim s As String', 's = "10"', 'Debug.Print CStr(s > 9) & " " & CStr(s = 10)'), ['True True']],
  ['a non-numeric String against a number is a type mismatch', L('Dim s As String', 's = "abc"', 'If s > 9 Then Debug.Print "x"'), { err: E13, line: 4 }],
  ['Option Compare Binary is the default', 'Debug.Print CStr("abc" = "ABC") & " " & CStr("a" < "B")', ['False False']],
  ['Option Compare Text ignores case', L('Option Compare Text', 'Sub Main()', 'Debug.Print CStr("abc" = "ABC") & " " & CStr("a" < "B")', 'End Sub'), ['True True']],
  ['StrComp with vbTextCompare', 'Debug.Print StrComp("abc", "ABC") & " " & StrComp("abc", "ABC", vbTextCompare) & " " & StrComp("a", "b")', ['1 0 -1']],
]

// Empty behaves as 0 or ""; Null propagates through arithmetic and comparison but not through &
const emptyNull: Case[] = [
  ['an unassigned Variant is Empty: 0 in sums, "" in text', L('Dim v', 'Debug.Print CStr(v + 1) & "|" & (v & "x") & "|" & CStr(v = 0) & "|" & CStr(v = "") & "|" & TypeName(v) & "|" & TypeName(v + 1)'),
    ['1|x|True|True|Empty|Integer']],
  ['Null propagates through + and = but & treats it as ""', L('Dim n', 'n = Null', 'Debug.Print CStr(IsNull(n + 1)) & " " & (n & "x") & " " & CStr(IsNull(n = 1)) & " " & CStr(IsNull("a" + n)) & " " & CStr(IsNull(Len(n)))'),
    ['True x True True True']],
  // an If whose condition is Null takes the Else branch, and so does its negation
  ['If Null and If Not Null both take Else', L('Dim n', 'n = Null', 'If n = 1 Then Debug.Print "yes" Else Debug.Print "no"', 'If Not (n = 1) Then Debug.Print "yes" Else Debug.Print "no"'),
    ['no', 'no']],
  ['Null into an Integer is Invalid use of Null', L('Dim i As Integer', 'i = Null'), { err: /'94': Invalid use of Null/, line: 3 }],
  ['IsEmpty after assignment and Empty again', L('Dim v', 'Debug.Print CStr(IsEmpty(v))', 'v = 0', 'Debug.Print CStr(IsEmpty(v))', 'v = Empty', 'Debug.Print CStr(IsEmpty(v))'),
    ['True', 'False', 'True']],
]

// + adds when either side is a number and concatenates only when both are strings; & always concatenates
const concat: Case[] = [
  ['+ and & with mixed types', 'Debug.Print CStr("1" + 2) & "|" & ("1" & 2) & "|" & ("1" + "2") & "|" & (1 & 2) & "|" & TypeName("1" + 2) & "|" & (True & "")',
    ['3|12|12|12|Double|True']],
  ['"a" + 2 is a type mismatch', 'x = "a" + 2', { err: E13, line: 2 }],
  ['a String variable in arithmetic is converted', L('Dim s As String', 's = "5"', 'Debug.Print CStr(s * 2) & " " & CStr(s + 1) & " " & CStr(s & 1)'), ['10 6 51']],
  ['numbers and Booleans assigned to a String', L('Dim s As String', 's = 3.5', 'Debug.Print s', 's = True', 'Debug.Print s', 's = 1 / 4', 'Debug.Print s'), ['3.5', 'True', '0.25']],
  ['strings assigned to an Integer are converted and rounded', L('Dim i As Integer', 'i = "12"', 'Debug.Print CStr(i * 2)', 'i = "2.5"', 'Debug.Print CStr(i)'), ['24', '2']],
  ['"" into an Integer is a type mismatch', L('Dim i As Integer', 'i = ""'), { err: E13, line: 3 }],
  ['"abc" into an Integer is a type mismatch', L('Dim i As Integer', 'i = "abc"'), { err: E13, line: 3 }],
  ['Boolean variables accept "True" and numbers', L('Dim b As Boolean', 'b = "True"', 'Debug.Print CStr(b)', 'b = 2', 'Debug.Print CStr(CInt(b))', 'b = 0', 'Debug.Print CStr(b)'), ['True', '-1', 'False']],
  ['CDbl and CInt reject text', L('On Error Resume Next', 'x = CDbl("abc")', 'Debug.Print Err.Number', 'Err.Clear', 'x = CInt("12abc")', 'Debug.Print Err.Number'), [' 13', ' 13']],
]

// Str leaves a space for the sign of a positive number and has no leading zero; Val reads digits, skipping blanks
const conversions: Case[] = [
  ['Str vs CStr', 'Debug.Print "[" & Str(5) & "][" & Str(-5) & "][" & CStr(5) & "][" & Str(0.5) & "][" & CStr(0.5) & "]"', ['[ 5][-5][5][ .5][0.5]']],
  ['Val stops at the first non-numeric character', 'Debug.Print Val("12abc") & " " & Val("  1 2 3") & " " & Val("abc") & " " & Val("&H10") & " " & Val("1e3") & " " & Val("3.7.2") & " " & Val("-4.5x")',
    ['12 123 0 16 1000 3.7 -4.5']],
  // Debug.Print puts a space before a positive number (the sign position)
  ['Debug.Print spacing for numbers', L('Debug.Print 5', 'Debug.Print -5', 'Debug.Print "n="; 7', 'Debug.Print 1; 2'), [' 5', '-5', 'n= 7', ' 1  2']],
  ['IsNumeric', 'Debug.Print CStr(IsNumeric("12")) & " " & CStr(IsNumeric("1.5e2")) & " " & CStr(IsNumeric("abc")) & " " & CStr(IsNumeric("")) & " " & CStr(IsNumeric(Empty))',
    ['True True False False True']],
]

const strings: Case[] = [
  ['InStr with a start and a compare mode', 'Debug.Print InStr("hello", "l") & " " & InStr(4, "hello", "l") & " " & InStr("hello", "z") & " " & InStr(1, "HELLO", "l", vbTextCompare)',
    ['3 4 0 3']],
  ['Mid, Left and Right past the end', 'Debug.Print Mid("hello", 2, 3) & "|" & Mid("hello", 4) & "|" & Mid("hello", 10) & "|" & Left("hi", 5) & "|" & Right("hi", 5)',
    ['ell|lo||hi|hi']],
  ['Left with a negative length is an invalid call', 'x = Left("hi", -1)', { err: /'5': Invalid procedure call or argument/, line: 2 }],
  ['Split keeps empty fields and Join puts them back', L('Dim p', 'p = Split("a,b,,c", ",")', 'Debug.Print UBound(p) & " " & LBound(p) & " " & Join(p, "-") & " " & Join(Split("x y z"), "+")'),
    ['3 0 a-b--c x+y+z']],
  ['Trim, Replace with a count, StrReverse, UCase', 'Debug.Print "[" & Trim("  a b  ") & "][" & Replace("aaa", "a", "b", , 2) & "][" & StrReverse("abc") & "][" & UCase("MiXed") & "]"',
    ['[a b][bba][cba][MIXED]']],
  ['Len of numbers and Empty', L('Dim v', 'Debug.Print Len(v) & " " & Len("abc") & " " & Len(CStr(123))'), ['0 3 3']],
]

// Like: ? one character, * any run, # one digit, [!a-c] any character outside the set
const like: Case[] = [
  ['Like with [!a-c], #, ? and *', 'Debug.Print CStr("d" Like "[!a-c]") & " " & CStr("b" Like "[!a-c]") & " " & CStr("a1" Like "a#") & " " & CStr("ab" Like "a#") & " " & CStr("abc" Like "a?c") & " " & CStr("ABC" Like "abc") & " " & CStr("a*b" Like "a[*]b") & " " & CStr("" Like "*")',
    ['True False True False True False True True']],
  ['Like follows Option Compare Text', L('Option Compare Text', 'Sub Main()', 'Debug.Print CStr("ABC" Like "abc") & " " & CStr("B" Like "[a-c]")', 'End Sub'), ['True True']],
]

runCases([...compare, ...emptyNull, ...concat, ...conversions, ...strings, ...like])

// Format rounds half away from zero (unlike Round and CInt)
const format: Case[] = [
  ['Format number patterns', 'Debug.Print Format(1234.5, "#,##0.00") & "|" & Format(0.256, "0.0%") & "|" & Format(5, "000") & "|" & Format(2.5, "0") & "|" & Format(1234567.891, "#,##0") & "|" & Format(-5, "0.0")',
    ['1,234.50|25.6%|005|3|1,234,568|-5.0']],
  ['Format named number formats', 'Debug.Print Format(0.5, "Percent") & "|" & Format(1234.5, "Standard") & "|" & Format(1234.5, "Fixed") & "|" & Format(1234.5) & "|" & Format(0.125, "0.00") & "|" & Format(1, "Yes/No")',
    ['50.00%|1,234.50|1234.50|1234.5|0.13|Yes']],
  ['Format with a negative section', 'Debug.Print Format(3, "0.00;(0.00)") & " " & Format(-3, "0.00;(0.00)") & " " & Format(0, "0.0;-0.0;""zero""")', ['3.00 (3.00) zero']],
  ['Format dates and times', 'Debug.Print Format(DateSerial(2026, 3, 5), "yyyy-mm-dd") & "|" & Format(DateSerial(2026, 3, 5), "dd mmm yyyy") & "|" & Format(DateSerial(2026, 3, 5), "dddd d mmmm") & "|" & Format(TimeSerial(14, 5, 9), "hh:mm:ss") & "|" & Format(TimeSerial(14, 5, 0), "h:mm AM/PM")',
    ['2026-03-05|05 Mar 2026|Thursday 5 March|14:05:09|2:05 PM']],
  ['Format text with > and @', 'Debug.Print Format("abc", ">") & " " & Format("ABC", "<") & " " & Format("ab", "@@@@") & "|"', ['ABC abc   ab|']],
]

const dates: Case[] = [
  // DateSerial rolls months and days over into the next or previous year
  ['DateSerial rolls over', 'Debug.Print Format(DateSerial(2026, 13, 1), "yyyy-mm-dd") & " " & Format(DateSerial(2026, 1, 0), "yyyy-mm-dd") & " " & Format(DateSerial(2024, 3, 0), "yyyy-mm-dd") & " " & Format(DateSerial(2026, 2, 30), "yyyy-mm-dd")',
    ['2027-01-01 2025-12-31 2024-02-29 2026-03-02']],
  // DateDiff counts boundaries crossed, not whole periods
  ['DateDiff counts boundaries', 'Debug.Print DateDiff("m", DateSerial(2025, 12, 31), DateSerial(2026, 1, 1)) & " " & DateDiff("yyyy", DateSerial(2025, 12, 31), DateSerial(2026, 1, 1)) & " " & DateDiff("d", DateSerial(2025, 12, 31), DateSerial(2026, 1, 1)) & " " & DateDiff("m", DateSerial(2025, 1, 1), DateSerial(2026, 3, 15)) & " " & DateDiff("m", DateSerial(2026, 3, 1), DateSerial(2026, 1, 31))',
    ['1 1 1 14 -2']],
  ['Weekday counts from Sunday = 1 by default', 'Debug.Print Weekday(DateSerial(2026, 10, 10)) & " " & Weekday(DateSerial(2026, 10, 11)) & " " & Weekday(DateSerial(2026, 10, 10), vbMonday) & " " & WeekdayName(Weekday(DateSerial(2026, 10, 10)))',
    ['7 1 6 Saturday']],
  ['DateAdd clamps to the month end', 'Debug.Print Format(DateAdd("m", 1, DateSerial(2026, 1, 31)), "yyyy-mm-dd") & " " & Format(DateAdd("d", -1, DateSerial(2026, 3, 1)), "yyyy-mm-dd") & " " & Format(DateAdd("yyyy", 1, DateSerial(2024, 2, 29)), "yyyy-mm-dd")',
    ['2026-02-28 2026-02-28 2025-02-28']],
  ['date parts, date literals and date arithmetic', L('d = #3/5/2026 2:30:00 PM#', 'Debug.Print Year(d) & " " & Month(d) & " " & Day(d) & " " & Hour(d) & " " & Minute(d) & " " & TypeName(d) & " " & Format(d + 1, "yyyy-mm-dd") & " " & TypeName(d + 1) & " " & CLng(DateSerial(2026, 1, 1))'),
    ['2026 3 5 14 30 Date 2026-03-06 Date 46023']],
  ['TimeSerial and TimeValue', 'Debug.Print Format(TimeSerial(25, 0, 0), "hh:mm") & " " & Format(TimeSerial(0, 90, 0), "h:mm") & " " & CStr(TimeSerial(12, 0, 0) = 0.5) & " " & Format(TimeValue("6:15 PM"), "hh:mm")',
    ['01:00 1:30 True 18:15']],
]

// classic traps: IIf evaluates both branches, And/Or do not short-circuit, Dim a, b As Integer types only b
const traps: Case[] = [
  ['IIf evaluates both branches', 'x = IIf(True, 1, 1 / 0)', { err: /'11'/, line: 2 }],
  ['And does not short-circuit', L('x = 0', 'If x <> 0 And 10 / x > 1 Then Debug.Print "big"'), { err: /'11'/, line: 3 }],
  ['Dim a, b As Integer makes a a Variant', L('Dim a, b As Integer', 'Debug.Print TypeName(a) & " " & TypeName(b)'), ['Empty Integer']],
  ['a single-line If runs every statement after Then', L('x = 0', 'If x = 1 Then a = 1: b = 2 Else c = 3', 'Debug.Print a & "," & b & "," & c'), [',,3']],
  ['Single keeps 7 significant digits', L('Dim s As Single', 's = 0.1', 'Debug.Print s; CDbl(s)', 'Debug.Print TypeName(s * 2) & " " & TypeName(s * 2#)'), [' 0.1  0.100000001490116', 'Single Double']],
  ['Byte range is 0 to 255', L('Dim b As Byte', 'b = 255', 'b = b + 1'), { err: E6, line: 4 }],
  ['Currency keeps four decimals', L('Dim c As Currency', 'c = 1.23456', 'Debug.Print CStr(c) & " " & TypeName(c)'), ['1.2346 Currency']],
  ['numeric literals compare with string literals numerically', 'Debug.Print CStr("5" = 5) & " " & CStr("3" * "4") & " " & TypeName("3" * "4")', ['True 12 Double']],
  ['Choose, Switch, Chr, Asc, Hex, String, Space', 'Debug.Print Choose(2, "a", "b", "c") & Switch(False, "x", True, "y") & Chr(65) & Asc("a") & Hex(255) & String(3, "z") & "[" & Space(2) & "]"',
    ['byA97FFzzz[  ]']],
  ['Abs, Sgn, Sqr, Exp and Log', 'Debug.Print Abs(-3) & " " & Sgn(-2) & " " & Sqr(16) & " " & Round(Exp(1), 4) & " " & Round(Log(100) / Log(10), 6)', ['3 -1 4 2.7183 2']],
  ['an empty Array() has UBound -1', 'Debug.Print UBound(Array()) & "[" & Join(Array(), ",") & "]"', ['-1[]']],
  ['Debug.Print with commas uses 14-column zones; a trailing ; continues the line', L('Debug.Print "a", "b"', 'Debug.Print "x";', 'Debug.Print "y"'), ['a             b', 'xy']],
  ['line continuation and comments', L('x = 1 + _', '    2 \' a comment', 'Rem another comment', 'Debug.Print CStr(x)'), ['3']],
  ['names are case-insensitive', L('dim Total as integer', 'TOTAL = 3', 'debug.print cstr(total)'), ['3']],
]

runCases([...format, ...dates, ...traps])

// learner mistakes that real VBA accepts and runs, with surprising results
const surprises: Case[] = [
  // True is -1, so True > False is False
  ['True > False is False', 'Debug.Print CStr(True > False) & " " & CStr(True < False)', ['False True']],
  // Not is bitwise: Not 2 is -3, which is true, so the Then branch runs although "b" was found
  ['If Not InStr(...) runs when the text is found', 'If Not InStr("abc", "b") Then Debug.Print "ran" Else Debug.Print "skipped"', ['ran']],
  // x = 1 Or 2 is (x = 1) Or 2, which is 2: always true
  ['If x = 1 Or 2 is always true', L('x = 5', 'If x = 1 Or 2 Then Debug.Print "yes" Else Debug.Print "no"'), ['yes']],
  // Case x > 5 compares x with the Boolean (x > 5)
  ['Case x > 5 inside Select Case x compares with a Boolean', L('x = 10', 'Select Case x', 'Case x > 5: Debug.Print "big"', 'Case Else: Debug.Print "else"', 'End Select'), ['else']],
  ['"Total: " + 5 is a type mismatch', 'Debug.Print "Total: " + 5', { err: /'13'/, line: 2 }],
  ['Integer / makes a Double, assigning it back rounds', L('Dim i As Integer', 'i = 10', 'i = i / 4', 'Debug.Print CStr(i)'), ['2']],
  ['a Dim inside a loop does not reset the variable', L('For i = 1 To 3', 'Dim s As String', 's = s & i', 'Next', 'Debug.Print s'), ['123']],
  ['Err.Number stays set until cleared; a new On Error clears it', L('On Error Resume Next', 'x = 1 / 0', 'y = 2', 'Debug.Print Err.Number', 'On Error Resume Next', 'Debug.Print Err.Number'), [' 11', ' 0']],
  ['a Double loop counter accumulates binary error', L('For x = 0 To 1 Step 0.1', 'c = c + 1', 'Next', 'Debug.Print CStr(c)'), ['11']],
  ['date minus date is a Double, date plus a number a Date', 'Debug.Print TypeName(DateSerial(2026, 1, 2) - DateSerial(2026, 1, 1)) & " " & TypeName(DateSerial(2026, 1, 1) + 1) & " " & CStr(DateSerial(2026, 1, 1) = 46023)',
    ['Double Date True']],
]

// invalid arguments raise error 5; a Double that overflows raises error 6
const invalid: Case[] = [
  ['a negative number to a fractional power', 'x = (-8) ^ (1 / 3)', { err: /'5': Invalid procedure call or argument/, line: 2 }],
  ['Sqr of a negative number', 'x = Sqr(-1)', { err: /'5'/, line: 2 }],
  ['Log of zero', 'x = Log(0)', { err: /'5'/, line: 2 }],
  ['Mid from position 0', 'x = Mid("abc", 0, 1)', { err: /'5'/, line: 2 }],
  ['a Double past 1.8E+308', 'x = 1E+308 * 10', { err: E6, line: 2 }],
  ['CDbl of a too-large text', 'x = CDbl("1e400")', { err: E6, line: 2 }],
  ['CLng past the Long range', 'x = CLng(3000000000#)', { err: E6, line: 2 }],
]

runCases([...surprises, ...invalid])

// comparisons chain left to right on Booleans; Mod sits between * / \ and + -; \ is below * and /
const precedence: Case[] = [
  ['1 < 2 < 3 is True, 3 > 2 > 1 is False', 'Debug.Print CStr(1 < 2 < 3) & " " & CStr(3 > 2 > 1) & " " & CStr(Not 1 = 2)', ['True False True']],
  ['Mod and \\ precedence', 'Debug.Print (10 - 7 Mod 3) & " " & (2 * 7 Mod 4) & " " & (7 \\ 2 * 2) & " " & (2 ^ -1) & " " & (-2 * -3)', ['9 2 1 0.5 6']],
  ['x = 5 = 5 assigns the comparison', L('x = 5 = 5', 'Debug.Print CStr(x)'), ['True']],
  ['type suffixes and literal sizes', 'Debug.Print TypeName(5!) & " " & TypeName(5@) & " " & TypeName(5%) & " " & TypeName(32768) & " " & TypeName(2147483648#) & " " & TypeName(1E3) & " " & TypeName(#1/2/2026#)',
    ['Single Currency Integer Long Double Double Date']],
  // &HFFFF is the Integer -1; the & suffix makes it the Long 65535
  ['hex and octal literals', 'Debug.Print &HFFFF & " " & &HFFFF& & " " & &H8000 & " " & &H10000 & " " & &HFFFFFFFF & " " & &O17 & " " & TypeName(&HFFFF)', ['-1 65535 -32768 65536 -1 15 Integer']],
  ['numbers in & keep CStr form', 'Debug.Print "x" & 1# & "|" & 0.5 & "|" & 1E+16 & "|" & CSng(1 / 3) & "|" & (1 / 3)', ['x1|0.5|1E+16|0.3333333|0.333333333333333']],
  ['jagged arrays and Application.Transpose', L('a = Array(Array(1, 2), Array(3, 4))', 'Range("A1").Value = 1: Range("A2").Value = 2: Range("A3").Value = 3', 'v = Application.Transpose(Range("A1:A3").Value)',
    'Debug.Print a(1)(0) & " " & LBound(v) & UBound(v) & " " & Join(v, ",")'), ['3 13 1,2,3']],
  ['Format keeps the case of am/pm', 'Debug.Print Format(TimeSerial(13, 7, 0), "hh:mm am/pm") & " " & Format(TimeSerial(9, 7, 0), "h:mm a/p") & " " & Format(TimeSerial(13, 7, 0), "h:mm AM/PM")', ['01:07 pm 9:07 a 1:07 PM']],
]

runCases(precedence)
