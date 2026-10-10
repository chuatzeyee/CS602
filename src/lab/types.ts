// Excel Lab shared types: the contract between engine, checker, tools, VBA, UI and exercise data.
import type { HyperFormula } from 'hyperformula'

export type CellValue = number | string | boolean | null

export type Week = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W9' | 'W10' | 'EXAM'

// label/header/note: text, locked. input: changeable parameter (blue text), editable; the checker resets it to
// the spec value (and to each test case). given: pre-filled value or formula, locked (grey). answer: the learner
// fills it (yellow). Cells without a spec are blank and editable (learner helper cells).
export type Role = 'label' | 'header' | 'input' | 'given' | 'answer' | 'note'

export interface CellSpec {
  v?: CellValue          // constant
  f?: string             // formula, starts with '='
  fmt?: string           // Excel number format code: '0.00', '$#,##0.00', '0.0%', 'hh:mm:ss', 'dd-mmm-yy'
  role?: Role
  note?: string          // tooltip
  bold?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface SheetSpec {
  name?: string                       // default 'Sheet1'
  rows: number                        // max 1000
  cols: number                        // max 26
  cells: Record<string, CellSpec>     // 'A1' -> spec
  colWidths?: Record<string, number>  // 'A' -> px
  names?: Record<string, string>      // workbook names: { TaxRate: '=Sheet1!$B$2' }
  seed?: number                       // RAND seed, default 1
  frozenRows?: number
  iterative?: boolean                 // start with iterative calculation on (Excel: 100 iterations, max change 0.001)
}

export interface TaskCheck {
  tol?: number                // absolute tolerance, default 1e-6
  relTol?: number             // relative tolerance, default 1e-9
  mustUse?: string[]          // function names every checked formula must contain, e.g. ['VLOOKUP']; legacy and modern
                              // names count as one function (PERCENTILE = PERCENTILE.INC, NORMINV = NORM.INV, ...)
  mustNotUse?: string[]       // e.g. ['XLOOKUP'] when the exercise drills INDEX/MATCH
  absolute?: string[]         // refs that must appear in the first cell's formula, anchored as written in the directions
                              // the task is filled: cells over several rows need the row's $, over several columns the
                              // column's $; a one-cell task accepts any $. e.g. ['$B$2'] ('B$2' passes a fill-down task)
  refs?: string[]             // cells or ranges the first cell's formula must read, any $ signs, e.g. ['B8'] (a loop cell)
  formulaRequired?: boolean   // default true for 'formula' tasks: a typed constant fails
  allowFormula?: boolean      // 'value' tasks: accept a formula in the answer cells. Default: a formula fails ("Type the
                              // value itself") unless the task's `solutions` entry for that cell is itself a formula
  caseSensitive?: boolean     // text comparison, default false
}

export type ToolName = 'goalseek' | 'solver' | 'datatable' | 'pivot' | 'advfilter' | 'autofilter' | 'sort'

export interface GoalSeekSetup { setCell: string; toValue: number; changingCell: string }

export type Relation = '<=' | '>=' | '=' | 'int' | 'bin'
export interface SolverSetup {
  objective: string
  sense: 'max' | 'min' | 'value'
  valueOf?: number                                                  // sense 'value'
  changing: string                                                  // 'B4:D4' or 'B4:D4,F4'
  constraints: { lhs: string; relation: Relation; rhs?: number | string }[]  // rhs: number, cell or range
  nonNegative?: boolean                                             // default true, like Excel's checkbox
  engine?: 'simplex' | 'grg'
}

// range = the whole block as selected in Excel: formula row/column plus the input values.
// One-variable column table: inputs down the first column, formulas across the first row (top-left blank).
export interface DataTableDef { range: string; rowInput?: string; colInput?: string }

export type PivotAgg = 'sum' | 'count' | 'average' | 'max' | 'min'
export interface PivotConfig {
  rows: string[]
  columns: string[]
  values: { field: string; agg: PivotAgg; show?: 'value' | 'pctGrand' | 'pctRow' | 'pctCol' }[]
  filters: { field: string; include: CellValue[] }[]
}
export interface PivotSetup { source: string; target: string; config: PivotConfig }
export interface AdvFilterSetup { list: string; criteria: string; copyTo?: string; unique?: boolean }

export type ToolSetup = GoalSeekSetup | SolverSetup | DataTableDef | PivotSetup | AdvFilterSetup | Record<string, unknown>

export interface RandomCheck {
  trials: number              // recalculations (keep <= 100)
  stat: 'mean' | 'sd' | 'p'   // statistic over every cell in task.cells across all trials
  target: number
  tol: number                 // absolute; use >= 4 standard errors
  event?: string              // stat 'p': Excel criteria string such as '>=10' or 'Win'
}

export interface VbaTaskSpec {
  entry: string                         // Sub (or Function) the checker runs or calls
  starter: string                       // module text shown in the editor at first
  solution: string                      // reference module
  expected?: Record<string, CellValue>  // cell values after running `entry` on a fresh sheet
  calls?: { args: CellValue[]; result: CellValue }[]  // Function tasks: call entry(...args), compare
  mustUse?: string[]                    // VBA keywords or members, e.g. ['For Each', 'Offset']
  activeCell?: string                   // ActiveCell before the run, default 'A1'
  selection?: string                    // Selection before the run, default = activeCell
  inputs?: string[]                     // answers fed to InputBox calls in order
}

export type TaskKind = 'formula' | 'value' | 'tool' | 'criteria' | 'vba' | 'explain'

export interface Task {
  id: string                  // unique within the exercise
  kind: TaskKind
  cells: string               // answer cell or range ('C5', 'C5:C14'); criteria: the criteria range; vba/explain: may be ''
  prompt: string              // plain English; wrap function names in backticks (`VLOOKUP`) for syntax cards
  marks?: number              // mock exams
  solution?: string           // reference formula for the first cell, filled across `cells` like Excel
  solutions?: Record<string, string>  // explicit per-cell reference entries; overrides `solution`
  answer?: CellValue | Record<string, CellValue>  // value: expected value; tool: expected cell values after the
                                                  // tool runs; explain: model answer text
  check?: TaskCheck
  hints?: string[]            // progressive
  explain?: string            // shown after success or reveal
  tool?: ToolName
  toolSetup?: ToolSetup       // reference setup, applied by Reveal and by the validator
  random?: RandomCheck
  criteria?: { list: string; expectedRows: number[]; unique?: boolean }  // expectedRows: 1-based sheet rows
  vba?: VbaTaskSpec
  wrong?: string[]            // validator only: plausible wrong first-cell entries that must fail
}

export interface TestCase { name: string; inputs: Record<string, CellValue> }

export interface Exercise {
  id: string                  // 'w3-vlookup-shipping', unique site-wide
  week: Week
  topic: string               // short label, e.g. 'Approximate VLOOKUP'
  title: string
  level: 1 | 2 | 3            // 1 drill, 2 applied, 3 exam-style
  minutes: number
  scenario: string            // original 2-5 sentence business story
  sheet: SheetSpec
  tasks: Task[]
  testCases?: TestCase[]      // alternative inputs; formula tasks are re-checked under each
  skills: string[]
  techniques?: string[]       // exam technique names, exactly as in EXAM_TECHNIQUES (src/data/lab/techniques.ts)
  extension?: boolean         // uses functions beyond the week's syllabus (shown as a badge)
}

export interface MockQuestion { id: string; title: string; marks: number; exercise: Exercise }
export interface MockExam {
  id: string
  title: string
  minutes: number
  basedOn: string             // e.g. 'Mirrors the structure of the AY2014-15 T1 paper'
  intro: string
  questions: MockQuestion[]
}

// Everything the learner changed relative to the spec. Persisted, and the checker's only input.
export interface LearnerState {
  edits: Record<string, string>         // raw entries ('=B2*C2', '12%', '42') typed, pasted, filled or written by tools
  fmts?: Record<string, string>         // number formats the learner applied
  dataTables?: DataTableDef[]
  hiddenRows?: number[]                 // 1-based rows hidden by AutoFilter / Advanced Filter in place
  vba?: Record<string, string>          // taskId -> module source
  notes?: Record<string, string>        // explain tasks: taskId -> learner text
  selfMarks?: Record<string, boolean>   // explain tasks: taskId -> learner judged it correct
  iterative?: boolean                   // learner switched iterative calculation on/off
}

export type CellMark = 'ok' | 'bad'
export interface TaskResult {
  taskId: string
  ok: boolean
  correct: number             // cells (or checks) correct
  total: number
  messages: string[]          // learner-facing, specific ("Right on the given data, wrong when B2 changes: hard-coded number?")
  cells: Record<string, CellMark>
  pending?: boolean           // explain task awaiting self-mark
}
export interface ExerciseResult { score: number; marks?: { got: number; max: number }; tasks: TaskResult[] }

export type CellRead =
  | { kind: 'empty'; value: null }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; value: string; message: string; hint: string }   // value: '#N/A', '#DIV/0!' ...

export type EditResult = { ok: true } | { ok: false; message: string }

// One live sheet. The UI, tools, VBA host and checker all work through this.
export interface LabSheet {
  readonly hf: HyperFormula   // escape hatch for tools; prefer the methods below
  readonly sheetId: number
  readonly name: string
  readonly spec: SheetSpec
  readonly rows: number
  readonly cols: number
  readonly version: number    // increments on every change
  subscribe(listener: () => void): () => void
  raw(ref: string): string                    // formula bar text: formula or typed constant, '' if blank
  read(ref: string): CellRead
  display(ref: string): string                // read() formatted with the cell's number format
  values(range: string): CellValue[][]        // computed values, errors as their code strings
  fmt(ref: string): string | undefined
  setFmt(range: string, code: string | undefined): void
  role(ref: string): Role | undefined
  editable(ref: string): boolean              // false for label/header/given/note and data-table bodies
  set(ref: string, raw: string): EditResult   // '' clears; validates formula syntax; normalises '12%', '$1,200'
  setValues(topLeft: string, values: CellValue[][]): EditResult   // static values (tools)
  fill(source: string, target: string): EditResult   // Excel fill: source is the first row/column of target
  copy(range: string): void
  paste(dest: string): EditResult             // pastes the last copy with relative refs adjusted
  clear(range: string): EditResult
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  recalc(): void                              // F9: redraw RAND/RANDBETWEEN, then re-run data tables
  readonly dataTables: readonly DataTableDef[]
  addDataTable(def: DataTableDef): EditResult // runs it at once
  removeDataTable(range: string): void
  readonly hiddenRows: ReadonlySet<number>
  setHiddenRows(rows: Iterable<number>): void
  readonly iterative: boolean                 // off: circular references show #CYCLE! like Excel's warning
  setIterative(on: boolean): void
  state(): LearnerState
  destroy(): void
}

// Props shared by every tool dialog (Goal Seek, Data Table, Solver, PivotTable, Advanced Filter, AutoFilter, Sort).
export interface ToolDialogProps {
  sheet: LabSheet
  selection: string           // current selection, 'A3:F63' or 'C5'
  task?: Task                 // the active task, if any
  onClose(): void
  onDone(summary: string): void   // status-bar message, e.g. 'Goal Seek found a solution: B4 = 0.0731'
}

// one line of a macro's output: a MsgBox prompt, a Debug.Print line, or an InputBox prompt with its answer
export interface VbaOutput { kind: 'msgbox' | 'print' | 'input'; text: string; answer?: string }

export interface VbaRunResult {
  ok: boolean
  error?: { line: number; message: string }
  messages: string[]          // MsgBox and Debug.Print output, in order
  steps: number
  output?: VbaOutput[]        // the same output tagged by kind, with InputBox prompts and answers
  activeCell?: string         // ActiveCell after the run ('C7')
  selection?: string          // Selection after the run ('C7:D9')
  styles?: Record<string, { bold?: boolean; italic?: boolean; fontColor?: number; fill?: number }>  // fonts and fills the
                              // run set ('B4' -> style; colours are VBA longs); the lab grid does not draw them
}

export interface VbaPanelProps {
  sheet: LabSheet
  task?: Task
  code: string
  onCodeChange(code: string): void
  activeCell: string
  selection: string
  onRun(result: VbaRunResult): void
}

export interface SpreadsheetApi {
  select(range: string): void
  focus(): void
  selection(): { range: string; active: string }
}

export interface SpreadsheetProps {
  sheet: LabSheet
  marks?: Record<string, CellMark>    // outlines after Check
  focusCells?: string                 // the active task's cells, outlined
  readOnly?: boolean
  onSelectionChange?(range: string, active: string): void
  apiRef?: { current: SpreadsheetApi | null }
}
