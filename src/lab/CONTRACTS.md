# Excel Lab build contracts

Read with `src/lab/types.ts` (the shared types) and `site_build/notes/lab_spec.md` (the original design).
Several agents build the lab at the same time; these contracts keep them compatible.

## File ownership

One owner per file. Never edit a file you do not own: work around it and report the change you need.

| Path | Owner |
|---|---|
| `src/lab/types.ts`, `src/lab/CONTRACTS.md`, `src/data/lab/index.ts`, `src/data/lab/techniques.ts`, `src/App.tsx`, `src/components/NavPill.tsx` | orchestrator (frozen) |
| `src/lab/engine/*`, `src/lab/refs.ts`, `src/lab/sheet.ts`, `src/lab/checker.ts`, `src/lab/whatif.ts`, `src/lab/tools/index.ts`, `src/lab/syllabus.ts`, `scripts/validate-lab.ts`, `tests/engine.test.ts`, `tests/checker.test.ts` | lab-core |
| `src/lab/tools/pivot.ts`, `advFilter.ts`, `autoFilter.ts`, `sort.ts`, `src/lab/components/PivotDialog.tsx`, `AdvancedFilterDialog.tsx`, `AutoFilterDialog.tsx`, `SortDialog.tsx`, `tests/tools.test.ts`, `src/data/lab/w10.ts` | decision-tools (lab-core ships stubs first) |
| `src/lab/vba/*`, `src/lab/components/VbaPanel.tsx`, `tests/vba.test.ts`, `src/data/lab/w09.ts` | vba (lab-core ships stubs first) |
| `src/lab/components/Spreadsheet.tsx` and any `src/lab/components/grid/*` helpers | lab-grid |
| every other `src/lab/components/*` (TaskPanel, Toolbar, GoalSeekDialog, DataTableDialog, SolverDialog, FunctionCard, ...), `src/lab/progress.ts`, `src/pages/Lab.tsx`, `LabPlayer.tsx`, `Sandbox.tsx`, `MockExam.tsx` | lab-player |
| `src/data/lab/w01.ts` ... `w06.ts` | the week's exercise author |
| `src/data/lab/mocks.ts` | mock-exam author |
| `src/data/{topics,definitions,quiz,formulas,walkthroughs,course}.ts`, `src/pages/{Home,Topics,Quiz,Functions,Models,Course}.tsx`, `src/index.css` | content |
| `src/data/exam.ts`, `src/data/project.ts`, `src/pages/Exam.tsx`, `src/pages/Project.tsx` | exam-project |

Routes are already wired in `App.tsx` (lazy): `/lab`, `/lab/sandbox`, `/lab/:exerciseId`, `/exam`, `/exam/mock/:mockId`, `/project`.
Links inside the app use react-router (`HashRouter`), e.g. `<Link to="/lab/w3-vlookup-shipping">`.
Catalogue filters use query strings: `/lab?week=W3`, `/lab?technique=<encodeURIComponent(technique)>`.

## Module APIs

### `src/lab/refs.ts` (lab-core)
- `parseRef('$C$5')` -> `{ row, col, absRow, absCol }` (0-based row/col)
- `toRef(row, col)` -> `'C5'`; `colLetter(2)` -> `'C'`; `colIndex('AA')` -> `26`
- `parseRange('C5:D6')` -> `{ r1, c1, r2, c2 }` (a single cell is a 1x1 range)
- `rangeCells('C5:D6')` -> `['C5','D5','C6','D6']` (row-major); `splitRanges('B4:D4,F4')` -> `['B4:D4','F4']`

### `src/lab/sheet.ts` (lab-core)
- `createLabSheet(spec: SheetSpec, opts?: { state?: LearnerState; seed?: number }): LabSheet`
  - Registers the engine plugins once (`registerExcelPack()`, `registerSeededRandom()`) before building any engine.
  - Applies the spec cells, then `state` (edits, fmts, dataTables, hiddenRows).
  - Every mutating method bumps `version` and notifies subscribers (React: `useSyncExternalStore(sheet.subscribe, () => sheet.version)`).

### `src/lab/whatif.ts` (lab-core)
- `runGoalSeek(sheet, setup: GoalSeekSetup): { found: boolean; value: number; message: string }` writes the changing cell as a value.
- `runSolver(sheet, setup: SolverSetup, options?: { maxTime?: number; integerOptimality?: number }): { status: 'optimal' | 'infeasible' | 'unbounded' | 'stopped' | 'failed'; objective?: number; message: string }` writes the changing cells (one undo step). `'stopped'` = Excel's "Stop chosen when the maximum time limit was reached." with the best feasible answer kept. Defaults: 5 s; integer optimality 0% for Reveal/checker/validator, 1% in the dialog.
- Data tables: `sheet.addDataTable(def)`; `sheet.recalc()` re-runs them (Excel's "automatic except data tables": edits do not re-run tables, F9 does; the player shows a "press F9" hint after edits).

### `src/lab/tools/index.ts` (lab-core)
- `applyTool(sheet, tool: ToolName, setup: ToolSetup): EditResult` dispatches to the tool modules. Used by Reveal and the validator.

### `src/lab/tools/advFilter.ts` (decision-tools)
- `runAdvancedFilter(sheet, setup: AdvFilterSetup): { rows: number[]; error?: string }` matching 1-based sheet rows of the list (header excluded).
- `applyAdvancedFilter(sheet, setup): EditResult` in place: `sheet.setHiddenRows(...)`; with `copyTo`: writes the header and matching rows as values.

### `src/lab/tools/pivot.ts` (decision-tools)
- `buildPivot(sheet, setup: { source: string; config: PivotConfig }): CellValue[][]` Excel tabular layout with headers and Grand Totals.
- `applyPivot(sheet, setup: PivotSetup): EditResult` writes the table at `target` as values.

### `src/lab/tools/autoFilter.ts`, `src/lab/tools/sort.ts` (decision-tools)
- `applyAutoFilter(sheet, setup: Record<string, unknown>): EditResult` (hides rows) and `applySort(sheet, setup: Record<string, unknown>): EditResult` (rewrites rows). Setup shapes are defined and documented in those files.

### `src/lab/vba/index.ts` (vba)
- `runVba(sheet, source, entry, opts?: { activeCell?: string; selection?: string; inputs?: string[]; maxSteps?: number }): VbaRunResult`
- `callVbaFunction(source, name, args: CellValue[]): { ok: true; value: CellValue } | { ok: false; error: string }`
- `listProcedures(source): { name: string; kind: 'sub' | 'function' }[]`
- `src/lab/vba/check.ts`: `checkVbaTask(ex: Exercise, task: Task, state: LearnerState): TaskResult`

### `src/lab/checker.ts` (lab-core), pure, builds its own sheets
- `checkExercise(ex, state): ExerciseResult`, `checkTask(ex, task, state): TaskResult`
- `referenceState(ex): LearnerState` what the reference solution produces (formula solutions, tool runs, VBA runs, self-marks true).
- `revealTask(ex, task, state): LearnerState` the state with that task's reference applied (other entries kept).

Checking semantics (normative):
1. Isolation: task k is evaluated on spec + reference entries for every other task + the learner's helper cells (edits outside all task cells) + the learner's entries for task k. A mistake in task 1 does not fail task 2.
2. `formula`: every cell of `cells` must hold a formula unless `formulaRequired: false`. Values are compared with the reference (numbers: `tol`/`relTol`; text: trimmed, case-insensitive unless `caseSensitive`; booleans exact; errors must match the reference's error code). Then each `testCase` is applied to both sheets and compared again; the message names the case.
3. `mustUse` / `mustNotUse` match function names outside string literals; legacy and modern names count as the same function (PERCENTILE = PERCENTILE.INC, NORMINV = NORM.INV, ...). `absolute`: each listed ref must be anchored in every direction the task is filled (a fill-down task accepts `B$9` or `$B$9`; a single-cell task accepts any anchoring). `refs`: each listed cell must appear in the formula, with any `$`.
4. `value`: the learner's typed value(s) against `answer`.
5. `tool`: compare the cells in `answer` (a Record). Solver tasks also check every reference constraint holds on the learner sheet. Data-table tasks require a learner DataTableDef with the same range and input-cell role, then compare `answer` cells or apply `random`.
6. `random`: when the reference formula draws (RAND or RANDBETWEEN), the learner's formula must draw too, whatever `mustUse` says; a reference that only reads random cells needs no draw. The stat over all task cells across `trials` redraws (seeds fixed so results are reproducible) must be within `tol` of `target`.
7. `criteria`: `runAdvancedFilter(sheet, { list: task.criteria.list, criteria: task.cells, unique })` must return exactly `expectedRows`.
8. `vba`: `checkVbaTask`.
9. `explain`: pending until `selfMarks[taskId]` is set; ok when true.
Messages are specific and kind (what is wrong, which cell, which case); never reveal the solution text.

### `src/lab/syllabus.ts` (lab-core)
- `FIRST_TAUGHT: Record<string, Week>` function name -> week it is first taught (evidence: course workbooks in `~/SMU/CS602/Week N/` and the function bank `src/data/formulas.ts`).
- `functionsUsed(formula): string[]`; the validator rejects a non-`extension` exercise whose reference uses a function taught after its week.

### `scripts/validate-lab.ts` (lab-core)
`npx tsx scripts/validate-lab.ts [src/data/lab/w03.ts ...] [--mocks]` (no args = everything). For each exercise:
schema (unique ids, refs inside the sheet, required fields per kind, techniques in `EXAM_TECHNIQUES`, syllabus),
the reference state passes every task, and wrong answers fail (each `task.wrong` entry, plus automatic variants:
`$` stripped from the solution, the first cell's value typed as a constant). Prints a table; exit code 1 on any failure; warns when a check takes > 1.5 s.

### Components (React, default exports)
- `Spreadsheet` (`SpreadsheetProps`, lab-grid): name box + formula bar + grid; owns selection, editing and keyboard.
- `GoalSeekDialog`, `DataTableDialog`, `SolverDialog` (`ToolDialogProps`, lab-player).
- `PivotDialog`, `AdvancedFilterDialog`, `AutoFilterDialog`, `SortDialog` (`ToolDialogProps`, decision-tools).
- `VbaPanel` (`VbaPanelProps`, vba).
lab-core ships placeholder versions of the decision-tools and vba modules and components so the player compiles from the start.

## Global rules
- Do not run `npm install` / `npm i`. Installed: hyperformula ~3.5.0 (always `licenseKey: 'gpl-v3'`), ssf, javascript-lp-solver, tsx, react, react-router-dom, lucide-react, playwright-core.
- No state-changing git commands (commit, checkout, reset, stash, clean). Read-only git is fine.
- Type-check: `npx tsc -p tsconfig.app.json --noEmit`. Do not run `npm run build` (shared `dist/`); for a bundle use `npx vite build --outDir /tmp/<agent>-dist`.
- Browser checks: your own port (`npx vite --port <unique> --strictPort`), stop it afterwards. playwright-core with `executablePath: '/usr/bin/chromium-browser'`; the script must live in `portal/scripts/` to resolve the package; screenshots go to `/tmp`.
- Tests: `node:test` in `tests/<area>.test.ts`, run with `npx tsx --test tests/<area>.test.ts`.
- Style: match the portal (function components, Tailwind with the `index.css` theme tokens: `bg-void/base/surface/raised/overlay`, `border-edge/edge-bright`, `text-ink/ink-secondary/ink-muted`, `glow`, `correct`, `wrong`). Few comments, terse lowercase. No `console.log` in `src/`.
- Public site: original scenarios only; no verbatim slides or exam papers; nothing from Assignment 2 or Quiz 4; no team-member names; nothing from private team material.
- Syllabus: an exercise for week N uses only functions taught up to week N, unless marked `extension: true`.
