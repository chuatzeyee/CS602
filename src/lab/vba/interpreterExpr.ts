// Expression evaluation: literals, names (locals, module variables, procedures, globals), members, calls, indexing.
import type { Arg, Expr } from './ast'
import { binary, bankersRound, toNumber, unary } from './coerce'
import {
  EMPTY, MISSING, NOTHING, NULL_VAL, VbaCompileError, VbaError, arrayIndex, bool, dbl, int, lng, obj, str,
  type Global, type Val, type VbaObject,
} from './runtime'
import { callProc } from './interpreterCore'
import { lookupGlobal, varKey, type Machine, type Slot } from './interpreterTypes'
import { newObject } from './builtinsCollection'

export interface ArgVals { pos: Val[]; named: Record<string, Val> }

function numLiteral(e: Extract<Expr, { k: 'num' }>): Val {
  switch (e.type) {
    case 'int': return int(e.v)
    case 'long': return lng(e.v)
    case 'single': return { t: 'single', v: Math.fround(e.v) }
    case 'currency': return { t: 'currency', v: e.v }
    default: return dbl(e.v)
  }
}

// a variable visible here (local, then module level); undefined when the name is not a variable
export function findSlot(m: Machine, name: string): Slot | undefined {
  const key = varKey(name)
  return m.frame.vars.get(key) ?? m.moduleVars.get(key)
}

// an undeclared name used as a variable: a new local Variant (compile error under Option Explicit)
export function implicitSlot(m: Machine, name: string): Slot {
  if (m.mod.options.explicit) throw new VbaCompileError(m.line, 'Variable not defined')
  const slot: Slot = { v: EMPTY, type: 'Variant', declared: false }
  m.frame.vars.set(varKey(name), slot)
  return slot
}

// built-ins whose result is typed rather than a Variant (CInt(200) * CInt(200) overflows like in VBA)
const TYPED_RESULT = new Set([
  'cint', 'clng', 'cbyte', 'csng', 'cdbl', 'ccur', 'cdate', 'cstr', 'cbool', 'len', 'asc', 'ascw',
  'left$', 'right$', 'mid$', 'trim$', 'ltrim$', 'rtrim$', 'ucase$', 'lcase$', 'space$', 'string$', 'chr$', 'chrw$',
  'str$', 'hex$', 'oct$', 'format$',
])

// whether an expression has Variant type (decides overflow widening and number/string comparison rules)
export function isVariantExpr(m: Machine, e: Expr): boolean {
  switch (e.k) {
    case 'num': case 'str': case 'date': case 'bool': return false
    case 'paren': case 'unary': return isVariantExpr(m, e.e)
    case 'bin':
      if (e.op === '+' || e.op === '-' || e.op === '*' || e.op === '/' || e.op === '\\' || e.op === 'mod' || e.op === '^') {
        return isVariantExpr(m, e.l) || isVariantExpr(m, e.r)
      }
      return false
    case 'name': {
      const slot = findSlot(m, e.name)
      if (slot) return slot.isConst ? false : slot.type === 'Variant' || slot.isArray === true
      const proc = m.procs.get(e.name.toLowerCase())
      if (proc) return !proc.returnType || proc.returnType.name.toLowerCase() === 'variant'
      const g = lookupGlobal(m, e.name)
      return !(g && g.kind === 'const')
    }
    case 'call': {
      if (e.target.k === 'name') {
        const slot = findSlot(m, e.target.name)
        if (slot && slot.v.t === 'arr') return slot.v.v.elemType === 'Variant'
        const proc = m.procs.get(e.target.name.toLowerCase())
        if (proc) return !proc.returnType || proc.returnType.name.toLowerCase() === 'variant'
        if (!slot && TYPED_RESULT.has(e.target.name.toLowerCase())) return false
      }
      return true
    }
    default: return true
  }
}

export function evalExpr(m: Machine, e: Expr): Val {
  switch (e.k) {
    case 'num': return numLiteral(e)
    case 'str': return str(e.v)
    case 'date': return { t: 'date', v: e.v }
    case 'bool': return bool(e.v)
    case 'empty': return EMPTY
    case 'null': return NULL_VAL
    case 'nothing': return NOTHING
    case 'missing': return MISSING
    case 'paren': return evalExpr(m, e.e)
    case 'unary': return unary(e.op, evalExpr(m, e.e), isVariantExpr(m, e.e))
    case 'bin': {
      const l = evalExpr(m, e.l)
      const r = evalExpr(m, e.r)
      return binary(e.op, l, r, {
        compareText: m.ctx.compareText, lVariant: isVariantExpr(m, e.l), rVariant: isVariantExpr(m, e.r),
      })
    }
    case 'name': return evalName(m, e.name)
    case 'member': return memberObject(m, e.obj).get(e.name, [], {})
    case 'call': return evalCall(m, e.target, e.args)
    case 'new': {
      const made = newObject(e.className)
      if (!made) throw new VbaError(429, `ActiveX component can't create object: New ${e.className} is not available in the lab`)
      return obj(made)
    }
  }
}

function evalName(m: Machine, name: string): Val {
  const slot = findSlot(m, name)
  if (slot) return slot.v
  const proc = m.procs.get(name.toLowerCase())
  if (proc) return callProc(m, proc, [])
  const g = lookupGlobal(m, name)
  if (g) return callGlobal(m, g, { pos: [], named: {} })
  return implicitSlot(m, name).v
}

// the object for obj.member; a leading dot uses the innermost With object
export function memberObject(m: Machine, e: Expr | null): VbaObject {
  let v: Val
  if (e === null) {
    if (m.frame.withStack.length === 0) throw new VbaCompileError(m.line, 'Invalid or unqualified reference')
    v = m.frame.withStack[m.frame.withStack.length - 1]
  } else v = evalExpr(m, e)
  return asObject(v)
}

export function asObject(v: Val): VbaObject {
  if (v.t !== 'obj') throw new VbaError(424)
  if (v.v === null) throw new VbaError(91)
  return v.v
}

export function evalArgs(m: Machine, args: Arg[]): ArgVals {
  const pos: Val[] = []
  const named: Record<string, Val> = {}
  for (const a of args) {
    const v = evalExpr(m, a.value)
    if (a.name) named[a.name] = v
    else pos.push(v)
  }
  return { pos, named }
}

export function callGlobal(m: Machine, g: Global, a: ArgVals): Val {
  if (g.kind === 'fn') return g.fn(m.ctx, a.pos, a.named)
  if (g.kind === 'const') return a.pos.length ? indexValue(g.value, a.pos) : g.value
  const o = g.get(m.ctx)
  if (a.pos.length === 0 && Object.keys(a.named).length === 0) return obj(o)
  if (!o.defaultGet) throw new VbaError(438)
  return o.defaultGet(a.pos)
}

export function toIndex(v: Val): number {
  const x = bankersRound(toNumber(v), 0)
  if (x < -2147483648 || x > 2147483647) throw new VbaError(6)
  return x
}

// v(args): an array element or an object's default member
export function indexValue(v: Val, args: Val[]): Val {
  if (v.t === 'arr') return v.v.data[arrayIndex(v.v, args.map(toIndex))]
  if (v.t === 'obj') {
    if (v.v === null) throw new VbaError(91)
    if (!v.v.defaultGet) throw new VbaError(438)
    return v.v.defaultGet(args)
  }
  if (args.length === 0) return v
  throw new VbaError(13)
}

function evalCall(m: Machine, target: Expr, args: Arg[]): Val {
  if (target.k === 'name') {
    const slot = findSlot(m, target.name)
    const proc = m.procs.get(target.name.toLowerCase())
    if (slot && !(proc && slot === m.frame.ret)) return indexValue(slot.v, evalArgs(m, args).pos)
    if (proc) return callProc(m, proc, args)
    const g = lookupGlobal(m, target.name)
    if (g) return callGlobal(m, g, evalArgs(m, args))
    throw new VbaCompileError(m.line, 'Sub or Function not defined')
  }
  if (target.k === 'member') {
    const o = memberObject(m, target.obj)
    const a = evalArgs(m, args)
    return o.get(target.name, a.pos, a.named)
  }
  return indexValue(evalExpr(m, target), evalArgs(m, args).pos)
}
