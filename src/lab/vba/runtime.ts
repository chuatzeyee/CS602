// Runtime contracts shared by the interpreter (interpreter*.ts, coerce.ts, builtins*.ts) and the Excel object model
// (objects*.ts, labHost.ts). Values are tagged so the interpreter can follow VBA's Variant subtypes exactly.
import type { CellValue } from '../types'

export type VbaType =
  | 'Variant' | 'Byte' | 'Boolean' | 'Integer' | 'Long' | 'Single' | 'Double' | 'Currency' | 'Date' | 'String' | 'Object'

export type Val =
  | { t: 'empty' }
  | { t: 'null' }
  | { t: 'missing' }                                    // omitted optional argument
  | { t: 'bool'; v: boolean }
  | { t: 'byte' | 'int' | 'long'; v: number }           // Byte 0..255, Integer 16-bit, Long 32-bit
  | { t: 'single' | 'double' | 'currency'; v: number }
  | { t: 'date'; v: number }                            // Excel serial (days, fraction = time of day)
  | { t: 'str'; v: string }
  | { t: 'err'; v: number }                             // CVErr value, e.g. 2042 = #N/A
  | { t: 'obj'; v: VbaObject | null }                   // null = Nothing
  | { t: 'arr'; v: VbaArray }

export interface VbaArray {
  dims: { lo: number; hi: number }[]
  data: Val[]                                           // row-major over dims (first index varies slowest)
  elemType: VbaType
  fixed: boolean                                        // Dim a(1 To 5): ReDim not allowed
}

export const EMPTY: Val = { t: 'empty' }
export const NULL_VAL: Val = { t: 'null' }
export const MISSING: Val = { t: 'missing' }
export const NOTHING: Val = { t: 'obj', v: null }
export const dbl = (v: number): Val => ({ t: 'double', v })
export const lng = (v: number): Val => ({ t: 'long', v })
export const int = (v: number): Val => ({ t: 'int', v })
export const str = (v: string): Val => ({ t: 'str', v })
export const bool = (v: boolean): Val => ({ t: 'bool', v })
export const obj = (v: VbaObject | null): Val => ({ t: 'obj', v })

const ERROR_TEXT: Record<number, string> = {
  3: 'Return without GoSub',
  5: 'Invalid procedure call or argument',
  6: 'Overflow',
  7: 'Out of memory',
  9: 'Subscript out of range',
  10: 'This array is fixed or temporarily locked',
  11: 'Division by zero',
  13: 'Type mismatch',
  14: 'Out of string space',
  20: 'Resume without error',
  28: 'Out of stack space',
  35: 'Sub or Function not defined',
  91: 'Object variable or With block variable not set',
  92: 'For loop not initialized',
  94: 'Invalid use of Null',
  380: 'Invalid property value',
  424: 'Object required',
  429: "ActiveX component can't create object",
  457: 'This key is already associated with an element of this collection',
  438: "Object doesn't support this property or method",
  449: 'Argument not optional',
  450: 'Wrong number of arguments or invalid property assignment',
  1004: 'Application-defined or object-defined error',
}

// a trappable run-time error (Err.Number / Err.Description); On Error handlers catch these
export class VbaError extends Error {
  readonly number: number
  readonly description: string
  constructor(number: number, description?: string) {
    const text = description ?? ERROR_TEXT[number] ?? 'Application-defined or object-defined error'
    super(`Run-time error '${number}': ${text}`)
    this.number = number
    this.description = text
  }
}

// a compile-time error found while loading a module or before running (not trappable)
export class VbaCompileError extends Error {
  readonly line: number
  constructor(line: number, message: string) {
    super(message.startsWith('Compile error') ? message : `Compile error: ${message}`)
    this.line = line
  }
}

// Any Excel or VBA object. Member names arrive as typed; implementations compare case-insensitively.
export interface VbaObject {
  readonly className: string                            // 'Range', 'Worksheet', 'Application', 'Font', 'ErrObject', ...
  get(name: string, args: Val[], named: Record<string, Val>): Val          // property read or function-style method
  set(name: string, args: Val[], value: Val): void                         // property write
  call(name: string, args: Val[], named: Record<string, Val>): Val         // method used as a statement or expression
  defaultGet?(args: Val[]): Val                         // obj(args) or obj used as a value (Range -> .Value)
  defaultSet?(args: Val[], value: Val): void            // obj = value, obj(args) = value
  enumerate?(): Val[]                                   // For Each
  sameAs?(other: VbaObject): boolean                    // Is
}

export interface CellStyle { bold?: boolean; italic?: boolean; fontColor?: number; fill?: number }

// What the Excel object model needs from the spreadsheet. Rows and columns are 1-based. Synchronous by design.
export interface VbaHost {
  readonly sheetName: string
  readonly rows: number
  readonly cols: number
  value(row: number, col: number): CellValue                    // computed value; errors as code strings ('#N/A')
  formula(row: number, col: number): string                     // what the formula bar shows ('' when empty)
  setFormula(row: number, col: number, text: string): void      // '=...' formula or a typed constant, like the formula bar
  setValue(row: number, col: number, value: CellValue): void    // exact value (no parsing); null clears
  numberFormat(row: number, col: number): string                // 'General' when none
  setNumberFormat(row: number, col: number, code: string): void
  style(row: number, col: number): CellStyle
  setStyle(row: number, col: number, patch: CellStyle): void
  clear(r1: number, c1: number, r2: number, c2: number, what: 'contents' | 'formats' | 'all'): void
  recalc(): void                                                // Calculate: redraw RAND, refresh volatile cells
  evaluate(formula: string): CellValue                          // '=SUM(A1:A5)' on this sheet, no side effects; errors as codes
  selection(): { range: string; active: string }               // A1 refs
  select(range: string, active: string): void
  msgBox(prompt: string, buttons: number, title: string): number           // scripted reply or vbOK (1)
  inputBox(prompt: string, title: string, def: string): string | null      // scripted reply, prompt callback, null = Cancel
  print(text: string): void                                     // Debug.Print
  now(): number                                                 // mock clock: Excel serial with time fraction
  random(): number                                              // seeded Rnd in [0, 1)
}

// Interpreter state visible to built-ins and objects.
export interface RunCtx {
  host: VbaHost
  compareText: boolean                                          // Option Compare Text
  err: { number: number; description: string; source: string } // the Err object's state
}

export type BuiltinFn = (ctx: RunCtx, args: Val[], named: Record<string, Val>) => Val

export type Global =
  | { kind: 'fn'; fn: BuiltinFn; statementOk?: boolean }       // callable; also used bare (no args) where VBA allows
  | { kind: 'const'; value: Val }
  | { kind: 'obj'; get: (ctx: RunCtx) => VbaObject }            // ActiveCell, Selection, Application, Err ...

// a name -> Global table; keys are lower case
export type GlobalScope = ReadonlyMap<string, Global>

// cell value <-> VBA value. Excel error codes map to CVErr numbers like VBA's Range.Value does.
const CELL_ERRORS: Record<string, number> = {
  '#NULL!': 2000, '#DIV/0!': 2007, '#VALUE!': 2015, '#REF!': 2023, '#NAME?': 2029, '#NUM!': 2036, '#N/A': 2042,
  '#SPILL!': 2045, '#CALC!': 2050, '#CYCLE!': 2015, '#ERROR!': 2015,
}
const ERROR_CODES: Record<number, string> = Object.fromEntries(
  Object.entries(CELL_ERRORS).filter(([code]) => code !== '#CYCLE!' && code !== '#ERROR!').map(([code, n]) => [n, code]),
)

// a table entry by a name from learner code or cell text: "constructor" or "toString" must not reach Object.prototype
export const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  (Object.hasOwn(table, key) ? table[key] : undefined)

export function fromCell(c: CellValue): Val {
  if (c === null) return EMPTY
  if (typeof c === 'number') return dbl(c)
  if (typeof c === 'boolean') return bool(c)
  const code = own(CELL_ERRORS, c)
  if (code !== undefined) return { t: 'err', v: code }
  return str(c)
}

// throws VbaError 13 for objects and arrays
export function toCell(v: Val): CellValue {
  switch (v.t) {
    case 'empty': case 'missing': return null
    case 'null': return null
    case 'bool': return v.v
    case 'str': return v.v
    case 'err': return ERROR_CODES[v.v] ?? '#VALUE!'
    case 'obj': case 'arr': throw new VbaError(13)
    default: return v.v
  }
}

// the largest array the lab allocates (a lab sheet has at most 26,000 cells); bigger is "Out of memory"
export const MAX_ARRAY_ELEMENTS = 2_000_000

export function newArray(dims: { lo: number; hi: number }[], elemType: VbaType, fixed = false): VbaArray {
  const size = dims.reduce((n, d) => n * Math.max(0, d.hi - d.lo + 1), 1)
  if (size > MAX_ARRAY_ELEMENTS) throw new VbaError(7)
  return { dims, data: Array.from({ length: size }, () => defaultValue(elemType)), elemType, fixed }
}

// flat index for an element; VbaError 9 when out of range or the wrong number of indexes
export function arrayIndex(a: VbaArray, idx: number[]): number {
  if (idx.length !== a.dims.length) throw new VbaError(9)
  let flat = 0
  for (let i = 0; i < idx.length; i++) {
    const { lo, hi } = a.dims[i]
    if (idx[i] < lo || idx[i] > hi) throw new VbaError(9)
    flat = flat * (hi - lo + 1) + (idx[i] - lo)
  }
  return flat
}

export function defaultValue(t: VbaType): Val {
  switch (t) {
    case 'Boolean': return bool(false)
    case 'Byte': return { t: 'byte', v: 0 }
    case 'Integer': return int(0)
    case 'Long': return lng(0)
    case 'Single': return { t: 'single', v: 0 }
    case 'Double': return dbl(0)
    case 'Currency': return { t: 'currency', v: 0 }
    case 'Date': return { t: 'date', v: 0 }
    case 'String': return str('')
    case 'Object': return NOTHING
    default: return EMPTY
  }
}
