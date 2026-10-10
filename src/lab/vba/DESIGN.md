# VBA interpreter: design and contracts

The lab runs learner macros against a `LabSheet`. Course scope and practice tasks: `site_build/notes/vba_catalogue.md`
(sections 1-7, RECOMMENDATION R1-R?). Exercises: `src/data/lab/w09.ts` (all reference solutions must run).
Shared types: `ast.ts` (syntax tree) and `runtime.ts` (values, errors, `VbaObject`, `VbaHost`, globals). They are fixed
contracts: change them only to fix a real problem, keep it additive, and note it under "Changes" below.

## Files and owners

| File | Owner | Exports |
|---|---|---|
| `ast.ts`, `runtime.ts`, `DESIGN.md` | orchestrator | types, `VbaError`, `VbaCompileError`, value helpers, `fromCell`/`toCell`, array helpers |
| `lexer.ts`, `parser.ts`, `parserBlocks.ts` | orchestrator; vba-harden may extend | `lex(source)`; `parseModule(source): { module: Module } \| { error: ParseError }` |
| `coerce.ts` | vba-core (first) | VBA Let-coercion and operators (below) |
| `interpreter*.ts`, `builtins*.ts` | vba-core | `runProcedure`, `vbaLibrary()` |
| `objects*.ts`, `labHost.ts` | vba-objects | `excelScope(host)`, `createLabHost(sheet, opts)` |
| `index.ts`, `check.ts`, `../components/VbaPanel.tsx` | vba-integrate | the public API in `CONTRACTS.md` |
| `sourceText.ts`, `editing.ts`, `highlight.ts`, `VbaEditor.tsx`, `VbaOutput.tsx` | vba-integrate | keyword scan for `mustUse`, editor keys, colouring, the panel's editor and output pane |

Sentinels (create the file when the piece works and its tests pass): `/tmp/cs602-vba/parser.ready`,
`/tmp/cs602-vba/coerce.ready`, `/tmp/cs602-vba/core.ready`, `/tmp/cs602-vba/objects.ready`.

## Values

`Val` is a tagged union of VBA Variant subtypes. Typed variables hold the tag of their declared type. Every coercion
follows VBA's Let-coercion rules: Integer overflow is error 6, a non-numeric string is error 13, Empty is 0 or "",
and a Boolean True is -1. Dates are Excel serials (the sheet's 1900 system). VBA's own day 0 is 30 Dec 1899; the two
agree for every date from 1 Mar 1900 on, which is all the lab needs.

`coerce.ts` (vba-core, written first so vba-objects can import it):
- `toNumber(v): number`, `toStr(v): string` (VBA's CStr: up to 15 significant digits, so `0.1 + 0.2` gives "0.3";
  Booleans give "True"/"False"; dates use a short date/time form), `toBool(v): boolean`, `toDate(v): number`
- `coerceTo(v, type: VbaType): Val`, with errors 6 and 13 as VBA raises them
- `typeName(v): string` (VBA `TypeName`), `isNumeric(v): boolean`
- `binary(op: BinOp, l, r, ctx): Val`, `unary(op, v): Val`, `compare(l, r, compareText): -1 | 0 | 1 | null` (null when Null)
- `likeMatch(text, pattern, compareText): boolean`, `bankersRound(x, digits): number`

## Names

Lookup is case-insensitive, in this order:
1. locals and parameters
2. module-level variables and constants
3. procedures in the module
4. `excelScope(host)`, then `vbaLibrary()`

`excelScope(host)` covers the Excel object model:
- `Range`, `Cells`, `ActiveCell`, `Selection`, `ActiveSheet`, `Application`, `Worksheets`, `Sheets`
- `ThisWorkbook`, `ActiveWorkbook`, `WorksheetFunction`, `Rows`, `Columns`, `Intersect`, `Calculate`
- the `xl...` constants

`vbaLibrary()` covers VBA itself:
- the functions `Len`, `Left`, `MsgBox`, `InputBox`, `CInt`, `Round`, `Format`, `DateAdd`, `UBound`, ...
- the `vb...` constants and the `Err` object

A `name` or `call` expression whose target is an object uses the object's `defaultGet`/`defaultSet`. So `Range("A1")`
is the `Range` global with one argument, and `Cells(2, 3).Value = 5` is `call` → `member` → assign.

## Procedures and errors

- `runProcedure(source, entry, args, { host, globals, maxSteps = 2_000_000, maxDepth = 64 })` parses the module, runs `entry`
  and returns `{ ok, value?, error?: { line, message }, steps }`. It never throws.
- Run-time errors are `VbaError`. They are caught by `On Error`, and reported as
  `Run-time error '13': Type mismatch` with the line of the failing statement.
- Compile errors (parse errors, `Variable not defined` under `Option Explicit`, an unknown procedure in a `Call`)
  are reported before anything runs.
- The step budget gives "Macro stopped after 2,000,000 steps: possible infinite loop (line n)".
- `End` stops everything without an error.

## Host and grid

`VbaHost` is synchronous: the interpreter runs to completion in one call. `createLabHost` adapts a `LabSheet`:
- Every write is visible to the next read.
- At `finish()`, the whole run becomes one undo step.
- `MsgBox` prompts and `Debug.Print` lines are collected in order.
- `InputBox` takes scripted answers first, then a prompt callback (the panel passes `window.prompt`), else Cancel ("").
- The clock and `Rnd` are deterministic per run.

## Changes

(record any change to the shared contracts here)
- The vba-parser agent timed out without output. `parser.ts` was promoted from the vba-core agent's scratch parser
  (lexer and parser in one file); it parses every Week 9 macro, and all 182 VBA tests pass.
- vba-integrate: `runVba` adds optional `output` (MsgBox / Debug.Print / InputBox lines tagged by kind), `activeCell`,
  `selection` and `styles` to `VbaRunResult` (types.ts, additive). `listProcedures` also returns `params` (required
  parameters), `line` and `endLine`; `syntaxError(source)` and `callFunctionOn(sheet, ...)` are exported for check.ts.
- `RunOptions.maxMs` / `paused`: a wall-clock budget ("Macro stopped after 5 seconds: possible infinite loop (line n)"),
  time spent in InputBox prompts excluded. `runVba` and function calls use 5 s; the 2,000,000 step budget is unchanged.
  A loop that reads and writes a cell each pass reaches 5 s at about a million steps.
- lab-fixer (code review): the clock is read every step while steps are slow and up to every 16 steps while they are
  cheap (interpreterTypes.ts `tick`), so a loop writing a block of cells per pass stops at about 5 s (it ran 82 s when
  the clock was read every 4,096 steps). `RunOptions.started` / `RunVbaOptions.started` / `callFunctionOn(..., { started })`
  (additive): one budget shared by every run of a Check (`withVbaBudget` in check.ts, used by `checkExercise` and
  `checkTask`), so six calls of a Function that never returns stop after 5 s in all; the remaining calls are not run.
  A prompt loop stops after `MAX_PROMPTS` (30) InputBox prompts or `MAX_CANCELS` (3) Cancels in a row (`HostStop`,
  not trappable, reported on its line). Output: the host and `runVba` keep the last `MAX_MESSAGES` (1,000) MsgBox /
  Debug.Print lines (each cut at 5,000 characters); `VbaRunOutcome.omitted` counts the dropped ones and the panel says
  so; the panel announces a one-line summary instead of the output. Cell writes obey Excel's limits (1004 for text
  over 32,767 characters, a formula over 8,192, or a formula reading past the lab's grid). runtime.ts (additive):
  `own(table, key)`, so member names and cell text such as "constructor" or "toString" never reach Object.prototype
  (Range("A1").constructor is 438; a cell holding "toString" is a String). `Like` is matched by engine/glob.ts (no
  RegExp: "*a*a*a*a*a*a*a*a*a*a*b" took a second per step).
- parser.ts: a string left open closes at the end of its line, as the VBE does (it used to loop until memory ran out,
  freezing the editor for seconds per keystroke); `Select` must be followed by `Case`; reading past the last token gives
  the final newline instead of a crash; the lexer matches sticky patterns instead of slicing the rest of the module.
- vba-harden (tests `tests/vba-semantics*.test.ts`, harness `tests/vbaSemanticsHarness.ts`):
  - ast.ts (additive): `for`, `forEach` and `do` carry `endLine` (the Next / Loop line), so an Integer counter that
    overflows on its last increment, or a failing `Loop Until` condition, is reported on that line as the VBE does.
    Run-time errors take `m.line`, the line being executed inside a block statement.
  - The lexer moved from parser.ts to `lexer.ts` (`lex`, `Tok`). `&HFFFF&` is the Long 65535 (`&HFFFF` stays the
    Integer -1); `&O17` octal literals; a stray character is "Invalid character".
  - parser.ts tracks open blocks (helpers in parserBlocks.ts): an unclosed block at End Sub is "Block If without End If" / "For without Next" /
    "Do without Loop" / "While without Wend" / "Select Case without End Select" / "With without End With" (at the
    block's first line); a closer that matches no open block is reported where it stands ("Next without For",
    "Loop without Do", "End If without block If", "Else without If", "Case without Select Case" ...), naming the
    block left open when there is one: "Next without For (the If on line 3 has no End If)". A missing End Sub is
    "Expected End Sub"; code outside a procedure is "Invalid outside procedure"; `Foo(1, 2)` as a statement is
    "Expected: =" (as in the VBE); `want()` messages use VBE wording ("Expected: Then or GoTo", "Expected: To").
  - Calls to the module's own procedures are checked before the run: "Wrong number of arguments or invalid property
    assignment", "Argument not optional", "Named argument not found" (were run-time errors 450/449).
  - `RunVbaOptions.msgBoxReplies` (additive) scripts MsgBox answers; an unscripted MsgBox returns its default button
    (vbDefaultButton2/3 honoured) instead of always the first.
  - `HostExtras.insertCells` (additive) and `Range.Insert [Shift]` / `Rows(n).Insert` / `EntireRow.Insert`
    (labHostInsert.ts): engine addRows/addColumns or a block move; pushing filled cells off the grid is 1004.
  - Macro-recorder output is accepted: Interior/Font members the recorder writes (PatternColorIndex, TintAndShade,
    ThemeColor, Superscript, ThemeFont ...), negative colour longs (-16776961 = red), Font.FontStyle, Range.AddIndent/
    ReadingOrder/MergeCells/Merge/UnMerge/AutoFit/ClearComments/Style, Borders(...) and BorderAround (stored per cell
    edge, objectsBorders.ts), ActiveWindow.SmallScroll/ScrollRow (ignored), AutoFill/FillDown/FillRight/FillUp/FillLeft
    (objectsFill.ts), `ActiveCell.Columns("A:A")` / `.Rows("1:1")` relative spans, and the xl constants they use.
  - Currency prints with at most four decimals; CDbl("1e400") is Overflow (6), not Type mismatch; Format keeps the
    case of `am/pm` and `a/p`.
  - `Range.Cut [Destination]` and Cut + `ActiveSheet.Paste` move cells through the engine (`HostExtras.moveCells`,
    additive): formulas that point at the moved cells follow them; PasteSpecial of a Cut is 1004; CutCopyMode is 2.
  - `Sheets(Array("Sheet1"))` is a Sheets collection (For Each, Select); `New Collection`, `Dim c As New Collection`
    and `CreateObject("Scripting.Dictionary")` / `New Dictionary` work (builtinsCollection.ts); other classes are 429.
  - `Range.Value = " "` stores a space (it used to clear the cell); check.ts no longer counts a cell holding spaces
    as empty when a task expects it cleared (a formula showing "" still counts as empty).
  - JavaScript limits become VBA errors with a line: a string too long is 14 "Out of string space", an array over
    2,000,000 elements (`MAX_ARRAY_ELEMENTS`) or one that cannot be allocated is 7 "Out of memory".
  - The lexer treats pasted non-breaking spaces as spaces and explains curly quotes.
