# Lab core: practical notes (lab-core)

For the UI, tools, VBA and checker agents. Contracts: `CONTRACTS.md`, types: `types.ts`.

## Create and subscribe

```tsx
const [sheet, setSheet] = useState<LabSheet | null>(null)
useEffect(() => {
  const s = createLabSheet(exercise.sheet, { state: saved })   // seed?: number overrides spec.seed
  setSheet(s)
  return () => s.destroy()
}, [exercise.sheet])
const version = useSyncExternalStore(sheet.subscribe, () => sheet.version)
```

- Build order: spec cells, then `state` (edits, fmts, hiddenRows, iterative, dataTables). Saved entries that no longer fit
  (locked cell, outside the sheet, broken table, over the size limits) are skipped, never thrown. If the engine still
  refuses the state (an entry that throws while computing), the entries are tried one at a time and the ones that load
  are kept. A broken spec (cell outside rows x cols) throws.
- Size limits (`engine/limits.ts`, Excel's): a cell holds at most 32,767 characters and a formula 8,192, with brackets
  nested at most 64 deep; formulas read only the lab's grid (A1:Z1000, the engine's `maxRows`/`maxColumns`), so
  `=SUM(A2:Z10000)` is refused at entry with a message ("Z10000 is past the edge of the lab's sheet ...") and
  `=SEQUENCE(5000,5000)` is #VALUE! at once. A text result over 32,767 characters (REPT, &, CONCATENATE, TEXTJOIN,
  SUBSTITUTE ...) is #VALUE!, as in Excel. Whole columns (`A:A`) cover 1,000 rows.
- One HyperFormula engine per sheet (a 100-cell sheet builds in about 2-15 ms). Always `destroy()` old sheets.
- `sheet.hf` holds a hidden second sheet `__lab` (recalc trigger). Use `sheet.sheetId` for addresses.

## Reads (never change `version`)

`raw read display values fmt role editable dataTables hiddenRows iterative state canUndo canRedo`

- `raw(ref)`: formula-bar text. Formulas come back normalised (`=sum(a1)` -> `=SUM(A1)`). Typed constants keep their text
  (`12%`, `$1,200.50`, `2026-10-10`); text that would parse as something else gets an apostrophe (`'00123`).
  `set(ref, raw(ref))` always reproduces the cell. Data-table body: `{=TABLE(B3,)}`-style text.
  `raw()` shows formulas as typed even where the engine holds another form: Excel 365's `@` stays (`=@B4:B10`, implicit
  intersection: `#VALUE!` when no cell of the range shares the formula's row or column), and the hidden 4th argument the
  engine adds to `SUMIF`/`AVERAGEIF` never shows (Excel resizes a sum range of another shape: `=SUMIF(A2:A9,"x",C2)`
  sums C2:C9, and the extra argument makes the engine track those cells).
- Spilled dynamic-array cells (`=SEQUENCE(3)`, `=A1:A5*2`, FREQUENCY) have `raw() === ''` but `read()` holds the value:
  decide "blank" with `read(ref).kind === 'empty'`, not with `raw()`.
- `display(ref)`: learner fmt, else spec fmt, else a date/time format when the result is a date/time (`=DATE(...)`),
  else Excel-like General (up to 10 significant digits, `1.23457E+11`). An unusable format code falls back to General.
  Values round the Excel way first (half away from zero on 15 significant digits: 2.175 in `0.00` shows 2.18). A date/time
  format on a negative value or one past 31-Dec-9999 shows `########`, as in Excel (`TEXT` gives `#VALUE!`). Times round to
  the smallest unit the format shows and carry up: 59.6 s in `h:mm:ss` shows `0:01:00`, 23:59:59.7 in `hh:mm:ss` `00:00:00`.
  (The grid also shows `####` when a formatted number is wider than its column: give such cells a `colWidths` entry.)
- `values(range)`: errors as code strings (`'#N/A'`), blanks `null`; a range outside the sheet gives `[]`.
- `state()`: edits = every cell whose `raw()` differs from the spec (`''` for a cleared spec cell), row-major;
  `fmts`, `dataTables`, `hiddenRows` only when non-empty; `iterative` only when it differs from the spec.
  Body cells of data tables are never in `edits`. `createLabSheet(spec, { state: s.state() })` reproduces raw and values.

## Mutations (one `version` bump each; a failure returns `{ ok: false, message }` and does not bump)

`set setValues fill paste clear setFmt undo redo recalc addDataTable removeDataTable setHiddenRows setIterative`,
plus `writeCells(sheet, entries, { force? })` exported from `sheet.ts`. `copy()` does not bump.

- `asOneStep(sheet, fn)` (sheet.ts): the mutations fn makes are one undo step (a fill-handle drag that extends a series and
  copies formulas, Ctrl+Enter over a block, a format applied to several areas).
- Undo is the lab's own stack (engine undo is off), 100 steps, one step per user action: a fill, paste, `setValues`,
  `writeCells`, Goal Seek, Solver, `setFmt`, adding or removing a data table. Not undoable: `recalc`, `setHiddenRows`, `setIterative`.
- Locked: roles `label header given note` and data-table bodies. `set/setValues/fill/paste` refuse the whole action if a target
  is locked; `clear(range)` clears the editable cells and fails only when nothing in the range is editable.
- `set(ref, raw)` is "the learner typed this": `''` clears; `'12%'` 0.12, `'$1,200'` 1200, `'1,234.5'`, `'2026-10-10'` and
  `'10/10/2026'` (DD/MM) date serials, `'9:30'`, `'6:45 PM'`, `TRUE`, leading `'` = text. A typed %/currency/date/time/thousands
  constant in a cell without a format auto-applies a matching learner fmt. Excel's automatic percent entry: `8` typed into a
  %-formatted cell means 8% (raw becomes `8%`). Bad syntax returns a friendly message; `=SUMM(1)` is accepted and shows `#NAME?`.
- `setValues(topLeft, CellValue[][])` writes exact values (no percent rule); `null` clears.
- `writeCells(sheet, { B4: '30', F4: '=B4*2' })`: several, possibly non-adjacent, raw entries as ONE undo step.
  `{ force: true }` also writes locked label/given cells (checker test cases); data-table bodies stay protected.
  Forced entries on locked cells show up in `state().edits` but are skipped when a sheet is rebuilt from that state.
- `fill(source, target)`: Ctrl+D / Ctrl+R. The source block is tiled over the target, relative refs shift, `$` parts stay,
  the source's number formats are copied. Target may extend in any direction. No series: the grid does series itself.
- `copy(range)` + `paste(topLeft)`: pastes the copied range's current content with refs adjusted (Excel's clipboard).

## Data tables (Excel "automatic except data tables")

- `addDataTable({ range, rowInput?, colInput? })` runs at once. `range` is the whole selection.
  colInput only: values down the first column, formulas across the first row (top-left ignored).
  rowInput only: values across the first row, formulas down the first column. Both: formula top-left, row values across,
  column values down.
- Re-run by `recalc()` (F9), by undo/redo of a table change and when a sheet is built from state. Ordinary edits do NOT
  re-run them (the player shows the F9 hint).
- Each substitution redraws RAND/RANDBETWEEN first, so with the input cell pointing at a blank cell every row is an
  independent Monte Carlo replication. Inputs are restored afterwards.
- Adding the same definition again just re-runs it. `removeDataTable(range)` takes the exact range or any cell in the table.
- 100 replications of a 50-formula model: about 30 ms in Node.

## RAND

Seeded (`opts.seed ?? spec.seed ?? 1`) and in teaching mode: draws change on `recalc()` and data-table substitutions, not on
ordinary edits. Same spec + same state = same numbers, which keeps checker `random` tasks reproducible.

## Iterative calculation

`state.iterative ?? spec.iterative ?? false`. On: after every change the cells of circular chains are solved Gauss-Seidel
(100 iterations, max change 0.001); the engine holds their values while `raw()` and `state()` keep their formulas.
Off: they show `#CYCLE!` (`read(ref).hint` explains). Goal Seek, Solver and data-table substitutions see those cells frozen
at the last iteration.

## What-if (`whatif.ts`) and tools

- `runGoalSeek(sheet, { setCell, toValue, changingCell })` -> `{ found, value, message }`: "Goal Seeking with Cell B9 found a
  solution." / "... may not have found a solution." / "Cell must contain a formula." / "Cell must contain a value.".
  Found: the value is written (one undo step). Not found: the cell is left as it was.
- `runSolver(sheet, setup, options?)` -> `{ status, objective?, message }` (`SOLVER_MESSAGES` exported). Constraint lhs: cell or range;
  rhs: number, numeric text, cell, same-size range or `=formula` (evaluated once). `int`/`bin` only on variable cells.
  `nonNegative` defaults to true. `engine: 'simplex'` refuses non-linear models with Excel's linearity message. `'grg'` (or none):
  linear models still go to the exact LP solver, non-linear ones to a bounded Nelder-Mead (local optimum; the search box widens
  when the answer sits on its edge). Optimal: values written as one undo step; otherwise the variable cells are restored.
- Solver answer re-check: like Excel, an LP answer is checked against the sheet again (the linear model at the answer and at
  points between the start and the answer). A model that only looked linear near the start (a bracket lookup that jumps
  further out) is not linear: `'simplex'` then fails with the linearity message, `'grg'` searches it as non-linear and never
  claims more than a local optimum (`SOLVER_MESSAGES.localOptimum`).
- Multi-start: for such a model a quick extra search from spread-out points (Excel's Multistart option, `multiStart()` in
  `engine/solverBridge.ts`) replaces the answer when it finds a better one.
- Time limit (Excel's Solver Options): `options = { maxTime?: seconds, integerOptimality?: percent }`. `SOLVER_DEFAULTS`
  (5 s, 1%) is what the dialog starts with; `MAX_SOLVER_SECONDS` (30) caps Max Time, since a run blocks the page;
  `solverOptionsProblem(options)` validates both. Without options a run gets 5 s and proves whole-number optima exactly (0%),
  as reference runs need. When Max Time runs out the best answer meeting every constraint is written with status `'stopped'`
  and "Stop chosen when the maximum time limit was reached."; with none found yet the run fails (that message plus what to
  try) and nothing changes.
- `applyTool(sheet, tool, setup)` (`tools/index.ts`): `goalseek` ok only when found, `solver` only when optimal (not `'stopped'`),
  `datatable` -> `addDataTable`, the rest -> the decision-tools modules. Never throws.
- Pivot report filters (`config.filters`) go ABOVE the target, as in Excel: the last filter two rows up, one blank row, the
  table at the target (`pivotArea(target, out)` in `tools/pivot.ts` gives the whole block). A target in row 1 or 2 has no room
  above: the block moves down so the filters start in row 1. The whole block must fit on the sheet and miss the source.
- All synchronous: LP models take 5-30 ms, GRG models 10-200 ms.

## refs.ts extras

`isRef isRange normRef toRange inBox boxesOverlap`, `shiftFormula(formula, dRow, dCol)` (pure; refs pushed off the sheet become
`#REF!`), `stripDollars(formula)`.

## Gotchas

- Write through the sheet (`set`, `setValues`, `writeCells`), not `sheet.hf`: engine writes skip undo, `version`, typed text
  and iteration. If a tool probes with `hf`, restore the cells and then write the final values with `writeCells`.
- The engine does not re-spill a blocked dynamic array on its own; the sheet re-enters blocked formulas after clears.
- Very large sliding ranges (1,000 formulas each summing 10,000 cells) are slow in HyperFormula; keep models small.
- `parseLooseNumber('E8')` (engine) returns `NaN`: check `Number.isFinite` before using it.
