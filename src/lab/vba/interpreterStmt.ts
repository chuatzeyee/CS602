// Statements: blocks with GoTo, error trapping (On Error / Resume), assignment, calls and control flow.
import type { CaseTest, Expr, Stmt } from './ast'
import { binary, deref, toBool, toNumber, toStr } from './coerce'
import { VbaCompileError, VbaError, int, str, type Val, type VbaObject } from './runtime'
import { callProc } from './interpreterCore'
import { assignElement, eraseSlot, execReDim, letSlot, setSlot } from './interpreterDecl'
import {
  asObject, callGlobal, evalArgs, evalExpr, findSlot, implicitSlot, isVariantExpr, memberObject, toIndex,
} from './interpreterExpr'
import { printItems } from './interpreterPrint'
import { EndSignal, HostStop, labelIndex, lookupGlobal, tick, type Machine, type Signal, type Slot } from './interpreterTypes'

export function execBlock(m: Machine, stmts: Stmt[], start = 0): Signal {
  let i = start
  while (i < stmts.length) {
    const sig = execStmt(m, stmts[i])
    if (sig === undefined) { i++; continue }
    if (sig.k === 'goto') {
      const idx = labelIndex(stmts, sig.label)
      if (idx !== undefined) { i = idx + 1; continue }
    }
    return sig
  }
  return undefined
}

function setErr(m: Machine, e: VbaError): void {
  m.ctx.err.number = e.number
  m.ctx.err.description = e.description
  m.ctx.err.source = 'VBAProject'
}

export function clearErr(m: Machine): void {
  m.ctx.err.number = 0
  m.ctx.err.description = ''
  m.ctx.err.source = ''
}

// run the On Error GoTo handler from its label (top level of the procedure); it ends with Resume, Exit or End Sub
function runHandler(m: Machine, label: string): Signal {
  const body = m.frame.proc?.body ?? []
  const idx = labelIndex(body, label)
  if (idx === undefined) throw new VbaCompileError(m.line, 'Label not defined')
  return execBlock(m, body, idx + 1)
}

// JavaScript's own limits as VBA errors, so they get a line and can be trapped: a string that outgrows memory is
// "Out of string space" (14), an array that cannot be allocated "Out of memory" (7)
function asVbaError(e: unknown): unknown {
  if (e instanceof RangeError && /Invalid string length/i.test(e.message)) return new VbaError(14)
  if (e instanceof RangeError && /Invalid array length|Array buffer allocation/i.test(e.message)) return new VbaError(7)
  return e
}

// one statement, with the step budget and the procedure's error trap
export function execStmt(m: Machine, s: Stmt): Signal {
  for (;;) {
    m.line = s.line
    tick(m, s.line)
    try {
      return execOne(m, s)
    } catch (thrown) {
      const e = asVbaError(thrown)
      if (!(e instanceof VbaError)) {
        if (e instanceof HostStop && !m.errLines.has(e)) m.errLines.set(e, m.line)   // reported on this statement's line
        throw e
      }
      if (!m.errLines.has(e)) m.errLines.set(e, m.line)   // m.line: the Next/Loop/Case line inside a block statement
      const f = m.frame
      if (f.inHandler || f.onError.mode === 'none') throw e
      setErr(m, e)
      if (f.onError.mode === 'resumeNext') return undefined
      f.inHandler = true
      const sig = runHandler(m, f.onError.label)
      if (sig && sig.k === 'resume') {
        f.inHandler = false
        clearErr(m)
        if (sig.mode === 'same') continue
        if (sig.mode === 'next') return undefined
        return { k: 'goto', label: sig.label ?? '' }
      }
      return sig ?? { k: 'exit', what: 'proc' }
    }
  }
}


function condTrue(m: Machine, e: Expr): boolean {
  const v = deref(evalExpr(m, e))
  return v.t === 'null' ? false : toBool(v)
}

// an If/ElseIf condition; under On Error Resume Next a failing condition goes on into its block, as VBA does
function ifCond(m: Machine, e: Expr): boolean {
  try {
    return condTrue(m, e)
  } catch (err) {
    const f = m.frame
    if (!(err instanceof VbaError) || f.inHandler || f.onError.mode !== 'resumeNext') throw err
    setErr(m, err)
    return true
  }
}

function execOne(m: Machine, s: Stmt): Signal {
  switch (s.k) {
    case 'dim': case 'const': case 'label': case 'noop': return undefined
    case 'redim': execReDim(m, s); return undefined
    case 'assign': execAssign(m, s.target, s.value, s.set); return undefined
    case 'call': execCall(m, s.target, s.args); return undefined
    case 'if': {
      for (const b of s.branches) if (ifCond(m, b.cond)) return execBlock(m, b.body)
      return s.elseBody ? execBlock(m, s.elseBody) : undefined
    }
    case 'select': return execSelect(m, s)
    case 'for': return execFor(m, s)
    case 'forEach': return execForEach(m, s)
    case 'do': return execDo(m, s)
    case 'while': {
      for (;;) {
        m.line = s.line
        tick(m, s.line)
        if (!condTrue(m, s.cond)) return undefined
        const sig = execBlock(m, s.body)
        if (sig) return sig
      }
    }
    case 'exit': return { k: 'exit', what: s.what === 'for' ? 'for' : s.what === 'do' ? 'do' : 'proc' }
    case 'with': {
      const v = evalExpr(m, s.obj)
      asObject(v)
      m.frame.withStack.push(v)
      try { return execBlock(m, s.body) } finally { m.frame.withStack.pop() }
    }
    case 'goto': return { k: 'goto', label: s.label }
    case 'onError': {
      m.frame.onError = s.mode === 'goto' && s.label ? { mode: 'goto', label: s.label }
        : s.mode === 'resumeNext' ? { mode: 'resumeNext' } : { mode: 'none' }
      clearErr(m)
      return undefined
    }
    case 'resume':
      if (!m.frame.inHandler) throw new VbaError(20)
      return { k: 'resume', mode: s.mode, label: s.label }
    case 'print': printItems(m, s.items); return undefined
    case 'end': throw new EndSignal()
  }
}

// the variable a name denotes, created implicitly when undeclared
function nameSlot(m: Machine, name: string): Slot {
  return findSlot(m, name) ?? implicitSlot(m, name)
}

function defaultSet(o: VbaObject, args: Val[], value: Val): void {
  if (!o.defaultSet) throw new VbaError(438)
  o.defaultSet(args, value)
}

function letValue(v: Val): Val {
  return v.t === 'obj' ? deref(v) : v
}

export function execAssign(m: Machine, target: Expr, valueExpr: Expr, isSet: boolean): void {
  const value = evalExpr(m, valueExpr)
  if (target.k === 'name') {
    const slot = findSlot(m, target.name)
    if (!slot) {
      const g = lookupGlobal(m, target.name)
      if (g?.kind === 'obj' && !isSet) return defaultSet(g.get(m.ctx), [], letValue(value))
      if (g || m.procs.has(target.name.toLowerCase())) {
        throw new VbaCompileError(m.line, `Can't assign to ${target.name}`)
      }
    }
    const s = slot ?? implicitSlot(m, target.name)
    return isSet ? setSlot(m, s, value) : letSlot(m, s, value)
  }
  if (target.k === 'member') {
    const o = memberObject(m, target.obj)
    return o.set(target.name, [], isSet ? value : letValue(value))
  }
  if (target.k !== 'call') throw new VbaCompileError(m.line, 'Invalid assignment')
  const t = target.target
  if (t.k === 'name' && /^mid\$?$/i.test(t.name) && !findSlot(m, t.name)) return midStatement(m, target.args, letValue(value))
  if (t.k === 'name') {
    const slot = findSlot(m, t.name)
    if (slot && slot.v.t === 'arr') return assignElement(slot.v.v, evalArgs(m, target.args).pos.map(toIndex), value, isSet)
    if (slot && slot.v.t === 'obj') return defaultSet(asObject(slot.v), evalArgs(m, target.args).pos, letValue(value))
    if (slot) throw new VbaError(13)
    const g = lookupGlobal(m, t.name)
    if (!g) throw new VbaCompileError(m.line, 'Sub or Function not defined')
    const a = evalArgs(m, target.args)
    if (g.kind === 'obj') return defaultSet(g.get(m.ctx), a.pos, letValue(value))
    return defaultSet(asObject(callGlobal(m, g, a)), [], letValue(value))
  }
  if (t.k === 'member') {
    const o = memberObject(m, t.obj)
    const a = evalArgs(m, target.args)
    const r = o.get(t.name, a.pos, a.named)
    if (r.t === 'obj' && r.v !== null && !isSet) return defaultSet(r.v, [], letValue(value))
    return o.set(t.name, a.pos, isSet ? value : letValue(value))
  }
  return defaultSet(asObject(evalExpr(m, t)), evalArgs(m, target.args).pos, letValue(value))
}

// Mid(s, start[, length]) = text: overwrite characters of the variable s in place (its length never changes)
function midStatement(m: Machine, args: import('./ast').Arg[], value: Val): void {
  const [varArg, startArg, lenArg] = args
  if (!varArg || varArg.value.k !== 'name' || !startArg) throw new VbaError(5)
  const slot = nameSlot(m, varArg.value.name)
  const text = toStr(slot.v)
  const start = toIndex(evalExpr(m, startArg.value))
  if (start < 1 || start > text.length) throw new VbaError(5)
  const repl = toStr(value)
  let n = Math.min(repl.length, text.length - start + 1)
  if (lenArg && lenArg.value.k !== 'missing') n = Math.min(n, Math.max(0, toIndex(evalExpr(m, lenArg.value))))
  letSlot(m, slot, str(text.slice(0, start - 1) + repl.slice(0, n) + text.slice(start - 1 + n)))
}

export function execCall(m: Machine, target: Expr, args: import('./ast').Arg[]): void {
  if (target.k === 'name') {
    const key = target.name.toLowerCase()
    const proc = m.procs.get(key)
    const slot = findSlot(m, target.name)
    if (proc && (!slot || slot === m.frame.ret)) { callProc(m, proc, args); return }
    if (key === 'erase' && !slot) {
      for (const a of args) {
        if (a.value.k !== 'name') throw new VbaError(13)
        eraseSlot(nameSlot(m, a.value.name))
      }
      return
    }
    if (key === 'error' && !slot && args.length === 1) {
      throw new VbaError(toIndex(evalExpr(m, args[0].value)))
    }
    if (slot) throw new VbaCompileError(m.line, 'Expected procedure, not variable')
    const g = lookupGlobal(m, key)
    if (!g) throw new VbaCompileError(m.line, 'Sub or Function not defined')
    callGlobal(m, g, evalArgs(m, args))
    return
  }
  if (target.k === 'member') {
    const o = memberObject(m, target.obj)
    const a = evalArgs(m, args)
    o.call(target.name, a.pos, a.named)
    return
  }
  if (target.k === 'call' && args.length === 0 && (target.target.k === 'member' || target.target.k === 'name')) {
    execCall(m, target.target, target.args)
    return
  }
  evalExpr(m, target)
}

function caseMatches(m: Machine, subj: Val, subjVariant: boolean, t: CaseTest): boolean {
  const opCtx = (e: Expr) => ({ compareText: m.ctx.compareText, lVariant: subjVariant, rVariant: isVariantExpr(m, e) })
  const test = (op: '=' | '<>' | '<' | '>' | '<=' | '>=', e: Expr): boolean => {
    const r = binary(op, subj, evalExpr(m, e), opCtx(e))
    return r.t === 'bool' && r.v
  }
  if (t.k === 'value') return test('=', t.e)
  if (t.k === 'range') return test('>=', t.from) && test('<=', t.to)
  return test(t.op, t.e)
}

function execSelect(m: Machine, s: Extract<Stmt, { k: 'select' }>): Signal {
  const subj = evalExpr(m, s.subject)
  const sv = isVariantExpr(m, s.subject)
  for (const c of s.cases) {
    m.line = c.line
    if (c.tests.some(t => caseMatches(m, subj, sv, t))) return execBlock(m, c.body)
  }
  return s.elseBody ? execBlock(m, s.elseBody) : undefined
}

function counterSlot(m: Machine, e: Expr): Slot {
  if (e.k !== 'name') throw new VbaCompileError(m.line, 'Invalid For control variable')
  return nameSlot(m, e.name)
}

function loopEnd(sig: Signal, what: 'for' | 'do'): { done: boolean; sig: Signal } {
  if (sig === undefined) return { done: false, sig }
  if (sig.k === 'exit' && sig.what === what) return { done: true, sig: undefined }
  return { done: true, sig }
}

function execFor(m: Machine, s: Extract<Stmt, { k: 'for' }>): Signal {
  const slot = counterSlot(m, s.counter)
  const from = evalExpr(m, s.from)
  const to = toNumber(deref(evalExpr(m, s.to)))
  const step = s.step ? deref(evalExpr(m, s.step)) : int(1)
  const stepN = toNumber(step)
  const opCtx = { compareText: false, lVariant: slot.type === 'Variant', rVariant: s.step ? isVariantExpr(m, s.step) : false }
  letSlot(m, slot, from)
  for (;;) {
    m.line = s.line
    tick(m, s.line)
    const c = toNumber(slot.v)
    if (stepN >= 0 ? c > to : c < to) return undefined
    const r = loopEnd(execBlock(m, s.body), 'for')
    if (r.done) return r.sig
    m.line = s.endLine ?? s.line          // VBA reports an error in the increment (Integer overflow) on the Next line
    letSlot(m, slot, binary('+', slot.v, step, opCtx))
  }
}

// array elements in VBA's For Each order (first index fastest)
function arrayItems(a: import('./runtime').VbaArray): Val[] {
  if (a.dims.length === 0) throw new VbaError(92)
  if (a.dims.length === 1) return [...a.data]
  const sizes = a.dims.map(d => d.hi - d.lo + 1)
  const out: Val[] = []
  const idx = sizes.map(() => 0)
  for (let n = 0; n < a.data.length; n++) {
    let flat = 0
    for (let i = 0; i < sizes.length; i++) flat = flat * sizes[i] + idx[i]
    out.push(a.data[flat])
    for (let i = 0; i < sizes.length; i++) {
      if (++idx[i] < sizes[i]) break
      idx[i] = 0
    }
  }
  return out
}

function execForEach(m: Machine, s: Extract<Stmt, { k: 'forEach' }>): Signal {
  const slot = counterSlot(m, s.item)
  const group = evalExpr(m, s.group)
  let items: Val[]
  if (group.t === 'arr') items = arrayItems(group.v)
  else {
    const o = asObject(group)
    if (!o.enumerate) throw new VbaError(438)
    items = o.enumerate()
  }
  for (const it of items) {
    m.line = s.line
    tick(m, s.line)
    if (it.t === 'obj' && (slot.type === 'Object' || slot.type === 'Variant')) setSlot(m, slot, it)
    else letSlot(m, slot, it)
    const r = loopEnd(execBlock(m, s.body), 'for')
    if (r.done) return r.sig
  }
  return undefined
}

function execDo(m: Machine, s: Extract<Stmt, { k: 'do' }>): Signal {
  const holds = (c: { until: boolean; cond: Expr }): boolean => condTrue(m, c.cond) !== c.until
  for (;;) {
    m.line = s.line
    tick(m, s.line)
    if (s.pre && !holds(s.pre)) return undefined
    const r = loopEnd(execBlock(m, s.body), 'do')
    if (r.done) return r.sig
    m.line = s.endLine ?? s.line          // an error in `Loop Until cond` is on the Loop line
    if (s.post && !holds(s.post)) return undefined
  }
}
