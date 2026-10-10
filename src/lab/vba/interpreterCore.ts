// Running a parsed module: loading module-level declarations, calling procedures with VBA's argument passing
// (ByRef variables and array elements, ByVal copies, Optional defaults, ParamArray) and reporting errors.
import type { Arg, Expr, Module, Param, Proc } from './ast'
import { coerceTo, deref } from './coerce'
import {
  EMPTY, MISSING, NOTHING, VbaCompileError, VbaError, arrayIndex, defaultValue,
  type GlobalScope, type Val, type VbaArray, type VbaHost,
} from './runtime'
import type { CoreCtx } from './builtinsArgs'
import { vbaLibrary } from './builtins'
import { checkModule } from './interpreterCheck'
import { declareConst, declareLocals, slotFor } from './interpreterDecl'
import { evalArgs, evalExpr, findSlot, implicitSlot, toIndex } from './interpreterExpr'
import { flushPrint } from './interpreterPrint'
import { clearErr, execBlock } from './interpreterStmt'
import {
  BudgetError, EndSignal, HostStop, copyArray, lookupGlobal, varKey, vbaTypeOf, type Frame, type Machine, type Slot,
} from './interpreterTypes'

export interface RunOptions {
  host: VbaHost
  globals?: GlobalScope | GlobalScope[]        // excelScope(host); vbaLibrary() is always added last
  maxSteps?: number
  maxMs?: number                               // stop after this much running time (prompts excluded); 0 = no limit
  started?: number                             // performance.now() when the budget started (default: now)
  paused?: () => number                        // ms spent waiting for the user (InputBox) so far
  maxDepth?: number
}

export interface RunResult {
  ok: boolean
  value?: Val
  error?: { line: number; message: string }
  steps: number
}

interface WriteBack { slot: Slot; arr: VbaArray; flat: number }

function mismatch(m: Machine): never {
  throw new VbaCompileError(m.line, 'ByRef argument type mismatch')
}

function checkByRef(m: Machine, slot: Slot, isArray: boolean, p: Param): void {
  const pt = vbaTypeOf(p.type)
  if (pt === 'Variant' && !p.isArray) return
  if (Boolean(p.isArray) !== isArray) mismatch(m)
  if (pt !== slot.type) mismatch(m)
}

// the caller's variable or array element for a ByRef parameter; null when the argument is an expression
function byRefSlot(m: Machine, e: Expr, p: Param, writeBacks: WriteBack[]): Slot | null {
  if (e.k === 'name') {
    let slot = findSlot(m, e.name)
    if (!slot) {
      if (m.procs.has(e.name.toLowerCase()) || lookupGlobal(m, e.name)) return null
      slot = implicitSlot(m, e.name)
    }
    if (slot.isConst) return null
    checkByRef(m, slot, Boolean(slot.isArray), p)
    return slot
  }
  if (e.k === 'call' && e.target.k === 'name' && e.args.every(a => !a.name)) {
    const slot = findSlot(m, e.target.name)
    if (!slot || slot.v.t !== 'arr' || slot === m.frame.ret) return null
    const arr = slot.v.v
    const flat = arrayIndex(arr, evalArgs(m, e.args).pos.map(toIndex))
    const tmp: Slot = { v: arr.data[flat], type: arr.elemType, declared: true }
    checkByRef(m, tmp, false, p)
    writeBacks.push({ slot: tmp, arr, flat })
    return tmp
  }
  return null
}

// a parameter slot holding a copy of `raw` (ByVal, or ByRef given an expression)
function valueSlot(m: Machine, p: Param, raw: Val): Slot {
  const type = vbaTypeOf(p.type)
  if (p.isArray) {
    if (raw.t !== 'arr') throw new VbaError(13)
    return { v: { t: 'arr', v: copyArray(raw.v) }, type, declared: true, isArray: true }
  }
  if (type === 'Object') {
    if (raw.t !== 'obj') throw new VbaError(13)
    return { v: raw, type, declared: true }
  }
  if (type === 'Variant') return { v: raw.t === 'arr' ? { t: 'arr', v: copyArray(raw.v) } : raw, type, declared: true }
  void m
  return { v: coerceTo(raw, type), type, declared: true }
}

function missingSlot(m: Machine, p: Param): Slot {
  if (!p.optional) throw new VbaError(449)
  const type = vbaTypeOf(p.type)
  if (p.def) return valueSlot(m, p, evalExpr(m, p.def))
  if (type === 'Variant') return { v: MISSING, type, declared: true }
  return { v: type === 'Object' ? NOTHING : defaultValue(type), type, declared: true }
}

function bindParams(m: Machine, proc: Proc, frame: Frame, args: Arg[], values: Val[] | undefined, wb: WriteBack[]): void {
  const params = proc.params
  const given: (Expr | undefined)[] = []
  const rest: Expr[] = []
  let i = 0
  for (const a of args) {
    if (a.name) {
      const idx = params.findIndex(p => p.name.toLowerCase() === a.name!.toLowerCase())
      if (idx < 0) throw new VbaError(448, 'Named argument not found')
      given[idx] = a.value
    } else if (i < params.length && params[i].paramArray) rest.push(a.value)
    else if (i < params.length) given[i++] = a.value
    else throw new VbaError(450)
  }
  if (values && values.length > params.length && !params.some(p => p.paramArray)) throw new VbaError(450)
  params.forEach((p, idx) => {
    const key = varKey(p.name)
    if (p.paramArray) {
      const vals = values ? values.slice(idx) : rest.map(e => evalExpr(m, e))
      const arr: VbaArray = { dims: [{ lo: 0, hi: vals.length - 1 }], data: vals, elemType: 'Variant', fixed: false }
      frame.vars.set(key, { v: { t: 'arr', v: arr }, type: 'Variant', declared: true, isArray: true })
      return
    }
    if (values) {
      const v = values[idx]
      frame.vars.set(key, v === undefined || v.t === 'missing' ? missingSlot(m, p) : valueSlot(m, p, v))
      return
    }
    const e = given[idx]
    if (!e || e.k === 'missing') { frame.vars.set(key, missingSlot(m, p)); return }
    const ref = p.byVal ? null : byRefSlot(m, e, p, wb)
    frame.vars.set(key, ref ?? valueSlot(m, p, evalExpr(m, e)))
  })
}

// call a Sub or Function; `values` passes ready-made arguments (the entry procedure)
export function callProc(m: Machine, proc: Proc, args: Arg[], values?: Val[]): Val {
  if (m.depth >= m.maxDepth) throw new VbaError(28)
  const callerLine = m.line
  const frame: Frame = { proc, vars: new Map(), withStack: [], onError: { mode: 'none' }, inHandler: false }
  const writeBacks: WriteBack[] = []
  bindParams(m, proc, frame, args, values, writeBacks)
  if (proc.kind === 'function') {
    const type = vbaTypeOf(proc.returnType)
    frame.ret = { v: type === 'Object' ? NOTHING : defaultValue(type), type, declared: true }
    frame.vars.set(varKey(proc.name), frame.ret)
  }
  const caller = m.frame
  m.frame = frame
  m.depth++
  try {
    declareLocals(m, frame, proc)
    const sig = execBlock(m, proc.body)
    if (sig && sig.k === 'goto') throw new VbaCompileError(m.line, 'Label not defined')
    if (frame.inHandler) clearErr(m)
    return frame.ret ? frame.ret.v : EMPTY
  } finally {
    m.frame = caller
    m.depth--
    m.line = callerLine
    for (const w of writeBacks) {
      w.arr.data[w.flat] = w.arr.elemType === 'Variant' ? w.slot.v : coerceTo(w.slot.v, w.arr.elemType)
    }
  }
}

function loadModule(m: Machine): void {
  for (const p of m.mod.procs) {
    const key = p.name.toLowerCase()
    if (m.procs.has(key)) throw new VbaCompileError(p.line, `Ambiguous name detected: ${p.name}`)
    m.procs.set(key, p)
  }
  checkModule(m)
  for (const s of m.mod.decls) {
    m.line = s.line
    if (s.k === 'dim') for (const d of s.vars) m.moduleVars.set(varKey(d.name), slotFor(m, d))
    else if (s.k === 'const') for (const c of s.items) declareConst(m, m.moduleVars, c)
  }
}

function errorInfo(m: Machine, e: unknown): { line: number; message: string } {
  if (e instanceof VbaError) return { line: m.errLines.get(e) ?? m.line, message: e.message }
  if (e instanceof VbaCompileError || e instanceof BudgetError) return { line: e.line, message: e.message }
  if (e instanceof HostStop) {
    const line = m.errLines.get(e) ?? m.line
    return { line, message: `${e.message} (line ${line})` }
  }
  if (e instanceof RangeError && /call stack/i.test(e.message)) return { line: m.line, message: new VbaError(28).message }
  const msg = e instanceof Error ? e.message : String(e)
  return { line: m.line, message: `Internal error: ${msg}` }
}

export function newMachine(mod: Module, opts: RunOptions): Machine {
  const scopes = Array.isArray(opts.globals) ? [...opts.globals] : opts.globals ? [opts.globals] : []
  const ctx: CoreCtx = {
    host: opts.host, compareText: mod.options.compareText, err: { number: 0, description: '', source: '' },
    arrayBase: mod.options.base,
  }
  const moduleVars = new Map<string, Slot>()
  const maxMs = opts.maxMs ?? 0
  const started = opts.started ?? performance.now()
  return {
    mod, ctx, scopes: [...scopes, vbaLibrary()], procs: new Map(), moduleVars, statics: new Map(),
    frame: { proc: null, vars: moduleVars, withStack: [], onError: { mode: 'none' }, inHandler: false },
    depth: 0, steps: 0, maxSteps: opts.maxSteps ?? 2_000_000, maxDepth: opts.maxDepth ?? 64, line: 0,
    maxMs, started, paused: opts.paused ?? (() => 0), deadline: started + maxMs, lastCheck: started, nextCheck: 1, every: 1,
    printBuf: '', errLines: new WeakMap(), arrayBase: mod.options.base,
  }
}

// a Function entry that returns an object gives its default value (a Range gives its Value), when it has one
function entryValue(v: Val): Val {
  if (v.t !== 'obj' || v.v === null || !v.v.defaultGet) return v
  try {
    return deref(v)
  } catch {
    return v
  }
}

// run `entry` of a parsed module; never throws
export function runModule(mod: Module, entry: string, args: Val[], opts: RunOptions): RunResult {
  const m = newMachine(mod, opts)
  try {
    loadModule(m)
    const proc = m.procs.get(entry.toLowerCase())
    if (!proc) return { ok: false, error: { line: 0, message: `Sub or Function not defined: ${entry}` }, steps: 0 }
    const raw = callProc(m, proc, [], args)
    flushPrint(m)
    return { ok: true, value: entryValue(raw), steps: m.steps }
  } catch (e) {
    flushPrint(m)
    if (e instanceof EndSignal) return { ok: true, value: EMPTY, steps: m.steps }
    return { ok: false, error: errorInfo(m, e), steps: m.steps }
  }
}
