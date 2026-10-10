// Internal state of the interpreter (interpreter*.ts). Not part of the shared contracts.
import type { Module, Proc, Stmt, TypeRef } from './ast'
import type { Global, GlobalScope, RunCtx, Val, VbaArray, VbaType } from './runtime'

// a variable's storage; ByRef arguments share the caller's Slot
export interface Slot {
  v: Val
  type: VbaType                   // declared type (element type for arrays); 'Variant' when undeclared
  declared: boolean               // false: created implicitly (no Option Explicit)
  isArray?: boolean               // declared with () or bounds
  fixed?: boolean                 // fixed-size array (Dim a(1 To 5))
  fixedLen?: number               // String * n
  isConst?: boolean
}

export type OnErrorMode = { mode: 'none' } | { mode: 'resumeNext' } | { mode: 'goto'; label: string }

export interface Frame {
  proc: Proc | null               // null while the module-level declarations load
  vars: Map<string, Slot>         // lower-case names: locals, parameters, the Function's return slot
  ret?: Slot                      // a Function's return value (also under its name in vars)
  withStack: Val[]
  onError: OnErrorMode
  inHandler: boolean              // an On Error GoTo handler is running (a new error is not trapped)
}

// control flow leaving a statement early; undefined = carry on with the next statement
export type Signal =
  | undefined
  | { k: 'exit'; what: 'proc' | 'for' | 'do' }
  | { k: 'goto'; label: string }
  | { k: 'resume'; mode: 'same' | 'next' | 'label'; label?: string }

export interface Machine {
  mod: Module
  ctx: RunCtx
  scopes: GlobalScope[]           // excelScope(...) first, vbaLibrary() last
  procs: Map<string, Proc>
  moduleVars: Map<string, Slot>
  statics: Map<string, Map<string, Slot>>
  frame: Frame
  depth: number
  steps: number
  maxSteps: number
  maxMs: number                   // wall-clock budget (0 = none), not counting time spent waiting for the user
  started: number                 // performance.now() when the budget started (a Check shares one over several runs)
  paused: () => number            // ms spent in prompts so far
  deadline: number                // performance.now() past which the budget may be spent (prompts can move it)
  lastCheck: number               // performance.now() at the last clock check
  nextCheck: number               // step count of the next clock check
  every: number                   // steps between clock checks (1 while steps are slow, up to MAX_EVERY)
  maxDepth: number
  line: number                    // line of the statement running now
  printBuf: string                // Debug.Print text waiting for the end of its line (after ; or ,)
  errLines: WeakMap<object, number>
  arrayBase: 0 | 1
}

// End statement: unwinds every procedure, not trappable
export class EndSignal {
  readonly end = true
}

// the step (or time) budget ran out: not trappable
export class BudgetError extends Error {
  readonly line: number
  constructor(steps: number, line: number, seconds?: number) {
    super(seconds
      ? `Macro stopped after ${seconds} seconds: possible infinite loop (line ${line})`
      : `Macro stopped after ${steps.toLocaleString('en-US')} steps: possible infinite loop (line ${line})`)
    this.line = line
  }
}

// the host stopped the run (an InputBox loop the learner cannot leave): not trappable, reported on the current line
export class HostStop extends Error {}

// clock checks: every step while steps are slow (a step that writes a block of cells can take 50 ms), up to every
// MAX_EVERY steps while they are cheap, so a slow loop stops close to its time budget and a fast one pays almost nothing
const CHECK_MS = 2
const MAX_EVERY = 16

function checkClock(m: Machine, line: number): void {
  const now = performance.now()
  if (now >= m.deadline) {
    const used = now - m.started - m.paused()
    if (used > m.maxMs) throw new BudgetError(m.steps, line, Math.round(m.maxMs / 100) / 10)
    m.deadline = now + m.maxMs - used   // time spent answering prompts does not count
  }
  const spent = now - m.lastCheck
  m.every = spent > CHECK_MS ? Math.max(1, Math.floor((m.every * CHECK_MS) / spent)) : Math.min(MAX_EVERY, m.every * 2)
  m.lastCheck = now
  m.nextCheck = m.steps + m.every
}

// count one step; look at the clock when the time budget is on and a check is due
export function tick(m: Machine, line: number): void {
  if (++m.steps > m.maxSteps) throw new BudgetError(m.maxSteps, line)
  if (m.maxMs > 0 && m.steps >= m.nextCheck) checkClock(m, line)
}

// the key of a variable: lower case, without a type suffix (s$ and s are the same variable)
export const varKey = (name: string): string => name.toLowerCase().replace(/[$%&!#@]$/, '')

const SCALAR_TYPES: Record<string, VbaType> = {
  variant: 'Variant', byte: 'Byte', boolean: 'Boolean', integer: 'Integer', long: 'Long', longlong: 'Double',
  longptr: 'Long', single: 'Single', double: 'Double', currency: 'Currency', decimal: 'Double', date: 'Date',
  string: 'String', object: 'Object',
}

// a declared type name -> VbaType; class names (Range, Worksheet, Collection ...) are objects
export function vbaTypeOf(t: TypeRef | undefined): VbaType {
  if (!t) return 'Variant'
  return Object.hasOwn(SCALAR_TYPES, t.name.toLowerCase()) ? SCALAR_TYPES[t.name.toLowerCase()] : 'Object'
}

export function lookupGlobal(m: Machine, name: string): Global | undefined {
  const key = name.toLowerCase()
  for (const s of m.scopes) {
    const g = s.get(key)
    if (g) return g
  }
  return undefined
}

// copy an array (VBA arrays are values: assignment copies them)
export function copyArray(a: VbaArray): VbaArray {
  return { dims: a.dims.map(d => ({ ...d })), data: a.data.map(v => (v.t === 'arr' ? { t: 'arr', v: copyArray(v.v) } : v)), elemType: a.elemType, fixed: false }
}

// labels of a statement list, cached
const labelCache = new WeakMap<Stmt[], Map<string, number>>()
export function labelIndex(stmts: Stmt[], label: string): number | undefined {
  let map = labelCache.get(stmts)
  if (!map) {
    map = new Map()
    stmts.forEach((s, i) => { if (s.k === 'label') map!.set(s.name.toLowerCase(), i) })
    labelCache.set(stmts, map)
  }
  return map.get(label.toLowerCase())
}
