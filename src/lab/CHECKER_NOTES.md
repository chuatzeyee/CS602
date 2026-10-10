# Checker notes (lab-core)

Notes for exercise authors and the player. Rules: `CONTRACTS.md` "Checking semantics"; types: `types.ts`.

## Checker and validator

### How a check works

- `checkExercise(ex, state)` / `checkTask(ex, task, state)` never touch the learner's live sheet: they build their own.
  `referenceState(ex)` applies every task's reference in task order (formula `solution` filled across `cells` like Excel
  fill, then `solutions` per cell on top, value `answer`, tool runs via `applyTool(sheet, task.tool, task.toolSetup)`,
  VBA runs, explain self-marks) and is cached per exercise object. `revealTask` copies one task's reference cells into
  the state. A reference that creates a circular reference switches iterative calculation on; the learner must too.
- Isolation: task k is judged on the spec + the reference for every other task + the learner's helper cells (blank,
  unowned cells) + the learner's own entries for task k. A task "owns" its `cells` plus every cell its reference run
  wrote (Goal Seek's changing cell, Solver's variables, pivot output...). Learner edits to inputs, givens and other
  spec cells are ignored (inputs reset to the spec, then to each test case).
- Formula and value tasks are compared inside ONE shared sheet: the reference value is read, the learner's entries are
  swapped in, read again, swapped back. Both sides therefore see the same RAND draws and the same data-table results, so
  a formula over random cells (profit from a random demand, AVERAGE of replications) is compared exactly.
- Test cases: every formula task is re-read with each case's inputs on both sides. In a model without RAND, data tables
  are re-run for each case; in a random model they are not (tables stay as built).
- Random tasks (`random`) get a fresh sheet with the fixed seed: trial 1 is the sheet as built, each further trial is
  F9 (`recalc()`: new draws, tables re-run). The stat is over every task cell in every trial. Same state = same verdict.
  When the reference formula of a cell draws (RAND/RANDBETWEEN), the learner's formula there must draw too, whatever
  `mustUse` says; a reference that only reads random cells (`=B5>55`) needs no draw of its own.
  Test cases cannot see hard-coding in a random formula, so the checker fails a random formula that types the value
  of an input the reference refers to (`=-2*LN(RAND())` instead of `=-$B$1*LN(RAND())`); `absolute` and `refs` apply.
- Tool tasks compare the cells in `answer` with `check.tol`; Solver also checks each reference constraint (and
  non-negativity) on the learner's values; data-table tasks first need a learner table with the same range and the
  same row/column input roles; AutoFilter/Advanced Filter in place also compare the hidden rows. Goal Seek tasks fail
  when the changing cell holds a formula ("Run Goal Seek: it leaves a number in B13; a formula there skips the tool"):
  Excel's Goal Seek needs a constant there.
- Value tasks: the learner types the value. A formula in an answer cell fails ("Type the value itself in B11 (a number
  or text), not a formula") unless `check.allowFormula: true`, or the task's own `solutions` entry for that cell is a
  formula (a live reference, as in a trend equation other cells build on). Every existing value task types its answer.
- Messages: specific, at most four per task, never the reference formula. Value messages show the value as the learner
  sees it on their own sheet ("C7: shows 1,250.00, expected a different value"), or no value when the isolated sheet
  differs from theirs (an earlier task is wrong) or the cell is random. "gives a different result from the model answer
  for the same random draws" is only said when the learner's or the reference formula for that cell draws or reads
  random cells (directly, through other formulas or through a data table); never for value tasks.
- Which message, when:
  - Empty cells are reported once, with what to do for the task's shape: one `solution` filled across ("enter a formula
    in C2 and fill it down to C9"), per-cell `solutions` ("B6: still empty (it needs its own formula)", never "fill"),
    or a spill (the reference is one formula in the first cell whose result spills over `cells`: "type one formula in
    H4; it spills across H4:K4"). `mustUse` / `mustNotUse` only look at the cells that hold formulas.
  - A test case that fails while the given data passes: "C14 has 12 typed in; refer to the input cell instead" when a
    number typed in the formula equals a changed input (not counted: 0, 1, numbers the reference also types, and a
    number alone in an argument that never holds an input: VLOOKUP/HLOOKUP column and match flag, MATCH/XMATCH/XLOOKUP
    modes, ROUND digits, PMT/PV/FV/NPER/RATE type, distribution `cumulative` flags, or an argument where the reference
    also types a number, such as INDEX's row/column); "is a hard-coded number" for a formula that reads no cell;
    "check which references need $ before filling" when the first formula anchors a reference it shares with the
    reference formula differently in the direction the task is filled; otherwise "check the logic for this case: '<case>'".
  - "B4 is right but C4 is not: check which references need $ before filling" (listed first) only under that same
    anchoring condition; one-cell, per-cell and spill tasks are never told about $.
  - A cell that shows #CYCLE! because it reads a loop "depends on a circular reference (B8 is part of a loop)"; a cell in
    the loop "refers back to itself".
  - Random and data-table statistics are shown in the task cells' number format (6:17, not 0.00436), unless that format
    would round away the difference (3 significant figures instead) or drop whole time units ([h]:mm:ss instead).
    Proportions: "the share of trials meeting the condition is off (too high for this model)". A data table that is
    off says to check its Row/Column input cells (the model cells come from the reference, so the table setup is the
    cause); one whose runs all give the same result gets "The data table gives the same result in every run".

### Writing tasks that check well

- Mark every formula/value answer cell `role: 'answer'`; test-case inputs must be `role: 'input'` cells.
- Give at least one test case per exercise that changes an input every formula depends on: it is what catches
  hard-coded numbers ("correct on the given data but wrong when 'Rate rises to 6%'"). Pick values that change every
  answer cell and avoid ties (a MIN/MAX/IF that picks the same branch in every case proves nothing). Name the case in
  plain words: the name is shown to the learner.
- `wrong`: 2-3 plausible first-cell mistakes a student really makes (relative instead of absolute, exact instead of
  approximate match, wrong range end, `>` for `>=`). For a task with one `solution` over several cells each entry is
  typed in the first cell and filled across `cells` like the solution, so a missing `$` shows in the filled cells. For
  a task with per-cell `solutions` (and value tasks) the entry replaces the first cell's reference entry only; the
  other cells keep theirs, so write mistakes for the first cell (criteria tasks: the first `solutions` cell). The
  validator also tries the solution with its `$` removed (when that changes a value) and the first value typed as a
  constant.
- `check.absolute` lists refs that must appear in the first cell's formula, anchored as written in the directions the
  task is filled: cells over several rows need the row's `$`, over several columns the column's `$`, a grid both (so
  `B$3` and `$A4` stay exact there); a one-cell task accepts any `$`. So `['$B$9']` on a fill-down task accepts `B$9`
  and `$B$9` and says "Make B9 absolute so it survives fill-down" for `B9` or `$B9`. Use it when fill correctness is
  the point. `check.refs` lists cells or ranges the first cell's formula must read with any `$` (a cell inside a range
  it reads counts): a drill that must read the loop cell of a circular model, or must not be answered by typing a
  closed-form value.
- `mustUse` / `mustNotUse` look at function names outside text, so `"VLOOKUP("` in a string does not count. Excel's
  legacy and modern names are one function: PERCENTILE = PERCENTILE.INC, PERCENTRANK = PERCENTRANK.INC, NORMINV =
  NORM.INV, NORMSINV = NORM.S.INV, NORMDIST = NORM.DIST, NORMSDIST = NORM.S.DIST, CRITBINOM = BINOM.INV, BINOMDIST =
  BINOM.DIST, STDEV = STDEV.S, STDEVP = STDEV.P, VAR = VAR.S, VARP = VAR.P, RANK = RANK.EQ, MODE = MODE.SNGL,
  FORECAST = FORECAST.LINEAR, CONCATENATE = CONCAT, EXPONDIST = EXPON.DIST, POISSON = POISSON.DIST, GAMMAINV =
  GAMMA.INV, LOGINV = LOGNORM.INV (not PERCENTILE.EXC or STDEV.P for STDEV).
- Tolerances: numbers default to `tol 1e-6` or `relTol 1e-9`. Typed values and Goal Seek answers need a realistic `tol`
  (for example 0.005 for money, 1e-4 for a rate). Solver answers: if the optimum is not unique, put only the objective
  cell in `answer`.
- Text compares trimmed and case-insensitive unless `caseSensitive`. Errors must match the reference's error code.
- Data tables: put the formula row/column and the input values in the spec (or in an earlier formula task) and use the
  body as the task's `cells`. Monte Carlo replications: `colInput` is a blank cell outside the table.
- Explain tasks: `answer` is the model answer text; the learner self-marks.
- A formula whose reference uses RAND/RANDBETWEEN needs a `random` check (the validator insists). Formulas that only
  read random cells (profit from a random demand) are ordinary formula tasks: they are compared on the same draws.
- Sort rewrites the list rows, so a list that a Sort task sorts must not be `given`/`label` cells. AutoFilter and
  in-place Advanced Filter tasks are judged on the hidden rows: give them a small `cells` (the header cell) so their
  cells do not overlap other tasks (the validator warns about overlaps). `wrong` is ignored for data-table tasks.
- No TODAY()/NOW() in checked cells. Keep functions to the week's syllabus (`FIRST_TAUGHT`) or set `extension: true`.

### Random tolerances

`tol >= 4 * sd / sqrt(trials * cells)` for a mean (sd of one cell's value); for a proportion use
`sd = sqrt(p * (1 - p))`; for an sd target use about `sd / sqrt(2 * trials * cells)`. Check the theory with the
validator: it warns when `tol` is under four standard errors of the reference sample. Keep `trials <= 100`; for a data
table of N replications 3-10 trials are enough (each trial already has N values).

### Timing

A check builds one shared sheet plus one per tool or random task. Learner macros and Functions share one 5-second
budget per Check (`withVbaBudget`, vba/check.ts): a Function that never returns stops once, not once per call. Typical exercises check in 20-150 ms in Node; the
validator warns above 1.5 s. Keep sheets small (under ~2,000 formulas), avoid whole-column ranges, keep replication
tables to 100-500 rows, and remember every random trial re-runs the data tables the task reads.

### Validator

`npx tsx scripts/validate-lab.ts [files...] [--mocks] [--fixtures] [--json]` (no files and no flags = every week plus the
mocks). It checks the schema (ids unique site-wide, refs inside the sheet, required fields per kind, techniques in
`EXAM_TECHNIQUES`, syllabus, answer-cell roles, no TODAY/NOW, `check.absolute`/`check.refs` inside the sheet, `mustUse`
in the reference under either name, `allowFormula` only on value tasks), that the reference passes every task, that each `wrong`
entry and the automatic variants fail, tolerance sizes for random tasks, overlapping task cells, and timing. Status per
exercise: PASS, WARN, SKIP (a stubbed module answered "not available yet") or FAIL; exit code 1 on any FAIL.
Fixtures for every task kind: `tests/fixtures.ts` (`fixtures`, `fixtureMock`, `pendingFixtures`).
