// Compile-time checks of calls to the module's own procedures: the argument count ("Wrong number of arguments",
// "Argument not optional", "Named argument not found"), and ByRef arguments: a variable passed to a typed ByRef parameter
// must have exactly that type, otherwise VBA reports "ByRef argument type mismatch" before anything runs.
import type { Arg, Expr, Param, Proc } from './ast'
import { VbaCompileError, type VbaType } from './runtime'
import { hoisted } from './interpreterDecl'
import { lookupGlobal, varKey, vbaTypeOf, type Machine } from './interpreterTypes'
import { walkStmts } from './interpreterWalk'

interface VarInfo { type: VbaType; isArray: boolean; isConst?: boolean }

function moduleVarTypes(m: Machine): Map<string, VarInfo> {
  const map = new Map<string, VarInfo>()
  for (const s of m.mod.decls) {
    if (s.k === 'dim') {
      for (const d of s.vars) map.set(varKey(d.name), { type: vbaTypeOf(d.type), isArray: Boolean(d.bounds?.length || d.dynamicArray) })
    } else if (s.k === 'const') {
      for (const c of s.items) map.set(varKey(c.name), { type: 'Variant', isArray: false, isConst: true })
    }
  }
  return map
}

function procVarTypes(proc: Proc, moduleTypes: Map<string, VarInfo>): Map<string, VarInfo> {
  const map = new Map(moduleTypes)
  for (const p of proc.params) map.set(varKey(p.name), { type: vbaTypeOf(p.type), isArray: Boolean(p.isArray || p.paramArray) })
  if (proc.kind === 'function') map.set(varKey(proc.name), { type: vbaTypeOf(proc.returnType), isArray: false })
  for (const s of hoisted(proc)) {
    if (s.k === 'dim') {
      for (const d of s.vars) map.set(varKey(d.name), { type: vbaTypeOf(d.type), isArray: Boolean(d.bounds?.length || d.dynamicArray) })
    } else if (s.k === 'const') {
      for (const c of s.items) map.set(varKey(c.name), { type: 'Variant', isArray: false, isConst: true })
    } else if (s.k === 'redim') {
      for (const it of s.items) if (!map.has(varKey(it.name))) map.set(varKey(it.name), { type: vbaTypeOf(it.type), isArray: true })
    }
  }
  return map
}

// the declared type of a ByRef argument; null when the argument is passed by value (expression, constant, function)
function argInfo(m: Machine, e: Expr, vars: Map<string, VarInfo>): VarInfo | null {
  if (e.k === 'name') {
    const info = vars.get(varKey(e.name))
    if (info) return info.isConst ? null : info
    if (m.procs.has(e.name.toLowerCase()) || lookupGlobal(m, e.name)) return null
    return { type: 'Variant', isArray: false }
  }
  if (e.k === 'call' && e.target.k === 'name') {
    const info = vars.get(varKey(e.target.name))
    return info && info.isArray && !info.isConst ? { type: info.type, isArray: false } : null
  }
  return null
}

function mismatch(p: Param, info: VarInfo): boolean {
  const pt = vbaTypeOf(p.type)
  if (pt === 'Variant' && !p.isArray) return false
  return Boolean(p.isArray) !== info.isArray || pt !== info.type
}

function checkArity(callee: Proc, args: Arg[], line: number): void {
  const params = callee.params
  const hasParamArray = params.some(p => p.paramArray)
  const given = new Set<number>()
  let pos = 0
  for (const a of args) {
    if (a.name) {
      const idx = params.findIndex(q => q.name.toLowerCase() === a.name!.toLowerCase())
      if (idx < 0 || params[idx].paramArray) throw new VbaCompileError(line, 'Named argument not found')
      given.add(idx)
      continue
    }
    if ((pos >= params.length || params[pos].paramArray) && !hasParamArray) {
      throw new VbaCompileError(line, 'Wrong number of arguments or invalid property assignment')
    }
    if (pos < params.length && a.value.k !== 'missing') given.add(pos)
    pos++
  }
  if (params.some((p, i) => !p.optional && !p.paramArray && !given.has(i))) throw new VbaCompileError(line, 'Argument not optional')
}

function checkCall(m: Machine, callee: Proc, args: Arg[], vars: Map<string, VarInfo>, line: number): void {
  checkArity(callee, args, line)
  let i = 0
  for (const a of args) {
    const p = a.name ? callee.params.find(q => q.name.toLowerCase() === a.name!.toLowerCase()) : callee.params[i++]
    if (!p || p.byVal || p.paramArray) continue
    const info = argInfo(m, a.value, vars)
    if (info && mismatch(p, info)) throw new VbaCompileError(line, 'ByRef argument type mismatch')
  }
}

export function checkByRefArgs(m: Machine, proc: Proc): void {
  const vars = procVarTypes(proc, moduleVarTypes(m))
  const calleeOf = (target: Expr): Proc | undefined => {
    if (target.k !== 'name') return undefined
    const callee = m.procs.get(target.name.toLowerCase())
    if (!callee) return undefined
    const own = proc.kind === 'function' && varKey(proc.name) === varKey(target.name)
    return vars.has(varKey(target.name)) && !own ? undefined : callee
  }
  walkStmts(proc.body, (e, line, asCallTarget) => {
    // a Function that needs arguments, used without any (x = Twice): Argument not optional
    if (e.k === 'name' && !asCallTarget && !(proc.kind === 'function' && varKey(proc.name) === varKey(e.name))) {
      const callee = calleeOf(e)
      if (callee && callee.kind === 'function') checkArity(callee, [], line)
    }
    if (e.k !== 'call') return
    const callee = calleeOf(e.target)
    if (callee) checkCall(m, callee, e.args, vars, line)
  }, s => {
    if (s.k !== 'call') return
    const callee = calleeOf(s.target)
    if (callee) checkCall(m, callee, s.args, vars, s.line)
  })
}
