// Compile-time checks run before anything executes: Variable not defined (Option Explicit), Sub or Function not
// defined, Label not defined, Duplicate declaration.
import type { Proc, Stmt, TypeRef } from './ast'
import { VbaCompileError } from './runtime'
import { checkByRefArgs } from './interpreterCheckByRef'
import { childBlocks, hoisted } from './interpreterDecl'
import { lookupGlobal, varKey, type Machine } from './interpreterTypes'
import { walkStmts } from './interpreterWalk'

// ReDim of an array declared with fixed bounds (Dim a(3) ... ReDim a(5)) is a compile error in VBA
function checkFixedArrays(proc: Proc, moduleFixed: Set<string>): void {
  const fixed = new Set(moduleFixed)
  for (const s of hoisted(proc)) {
    if (s.k === 'dim') {
      for (const d of s.vars) {
        if (d.bounds?.length) fixed.add(varKey(d.name))
        else fixed.delete(varKey(d.name))
      }
    }
  }
  for (const p of proc.params) fixed.delete(varKey(p.name))
  for (const s of hoisted(proc)) {
    if (s.k === 'redim') for (const it of s.items) if (fixed.has(varKey(it.name))) throw new VbaCompileError(s.line, 'Array already dimensioned')
  }
}

function procLocals(proc: Proc): Set<string> {
  const names = new Set<string>(proc.params.map(p => varKey(p.name)))
  if (proc.kind === 'function') names.add(varKey(proc.name))
  const seen = new Set<string>()
  for (const s of hoisted(proc)) {
    const declared = s.k === 'dim' ? s.vars.map(v => v.name) : s.k === 'const' ? s.items.map(c => c.name) : []
    for (const n of declared) {
      const key = varKey(n)
      if (seen.has(key) || proc.params.some(p => varKey(p.name) === key)) {
        throw new VbaCompileError(s.line, 'Duplicate declaration in current scope')
      }
      seen.add(key)
      names.add(key)
    }
    if (s.k === 'redim') for (const it of s.items) names.add(varKey(it.name))
  }
  return names
}

// names a procedure uses as plain variables (implicitly declared when Option Explicit is off)
function implicitNames(proc: Proc): Set<string> {
  const names = new Set<string>()
  walkStmts(proc.body, (e, _line, asCallTarget) => {
    if (e.k === 'name' && !asCallTarget) names.add(varKey(e.name))
  }, () => undefined)
  return names
}

function allLabels(proc: Proc): Set<string> {
  const labels = new Set<string>()
  walkStmts(proc.body, () => undefined, s => { if (s.k === 'label') labels.add(s.name.toLowerCase()) })
  return labels
}

// Exit For / Exit Do outside their loop, Exit Sub in a Function and Exit Function in a Sub
function checkExits(stmts: Stmt[], proc: Proc, inFor: boolean, inDo: boolean): void {
  for (const s of stmts) {
    if (s.k === 'exit') {
      if (s.what === 'for' && !inFor) throw new VbaCompileError(s.line, 'Exit For not within For...Next')
      if (s.what === 'do' && !inDo) throw new VbaCompileError(s.line, 'Exit Do not within Do...Loop')
      if (s.what === 'sub' && proc.kind !== 'sub') throw new VbaCompileError(s.line, 'Exit Sub not allowed in Function or Property')
      if (s.what === 'function' && proc.kind !== 'function') {
        throw new VbaCompileError(s.line, 'Exit Function not allowed in Sub or Property')
      }
    }
    const isFor = s.k === 'for' || s.k === 'forEach'
    for (const body of childBlocks(s)) checkExits(body, proc, inFor || isFor, inDo || s.k === 'do')
  }
}

const SCALAR_NAMES = ['variant', 'byte', 'boolean', 'integer', 'long', 'longlong', 'longptr', 'single', 'double', 'currency',
  'decimal', 'date', 'string', 'object']

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}

// a misspelt built-in type (As Intger, As Strng) is "User-defined type not defined"; other names are object classes
function checkType(t: TypeRef | undefined, line: number): void {
  if (!t) return
  const name = t.name.toLowerCase()
  if (SCALAR_NAMES.includes(name)) return
  if (SCALAR_NAMES.some(s => editDistance(name, s) <= (s.length <= 4 ? 1 : 2))) {
    throw new VbaCompileError(line, 'User-defined type not defined')
  }
}

function checkTypes(m: Machine): void {
  const stmtTypes = (s: Stmt): void => {
    if (s.k === 'dim') for (const d of s.vars) checkType(d.type, s.line)
    if (s.k === 'const' || s.k === 'redim') for (const it of s.items) checkType(it.type, s.line)
  }
  m.mod.decls.forEach(stmtTypes)
  for (const proc of m.mod.procs) {
    for (const p of proc.params) checkType(p.type, proc.line)
    checkType(proc.returnType, proc.line)
    hoisted(proc).forEach(stmtTypes)
  }
}

export function checkModule(m: Machine): void {
  checkTypes(m)
  const moduleNames = new Set<string>()
  for (const s of m.mod.decls) {
    if (s.k === 'dim') for (const d of s.vars) moduleNames.add(varKey(d.name))
    if (s.k === 'const') for (const c of s.items) moduleNames.add(varKey(c.name))
  }
  const explicit = m.mod.options.explicit
  const moduleFixed = new Set<string>()
  for (const s of m.mod.decls) if (s.k === 'dim') for (const d of s.vars) if (d.bounds?.length) moduleFixed.add(varKey(d.name))
  for (const proc of m.mod.procs) {
    checkFixedArrays(proc, moduleFixed)
    const locals = procLocals(proc)
    const implicit = explicit ? new Set<string>() : implicitNames(proc)
    const labels = allLabels(proc)
    checkExits(proc.body, proc, false, false)
    checkByRefArgs(m, proc)
    const known = (key: string): boolean =>
      locals.has(key) || moduleNames.has(key) || m.procs.has(key) || lookupGlobal(m, key) !== undefined
    walkStmts(proc.body, (e, line, asCallTarget) => {
      if (e.k !== 'name') return
      const key = e.name.toLowerCase()
      if (known(key) || locals.has(varKey(key)) || moduleNames.has(varKey(key)) || implicit.has(varKey(key))) return
      if (asCallTarget) {
        if (key === 'erase' || implicit.has(key)) return
        throw new VbaCompileError(line, 'Sub or Function not defined')
      }
      if (explicit) throw new VbaCompileError(line, 'Variable not defined')
    }, s => {
      const label = s.k === 'goto' ? s.label : s.k === 'onError' && s.mode === 'goto' ? s.label
        : s.k === 'resume' && s.mode === 'label' ? s.label : undefined
      if (label !== undefined && !labels.has(label.toLowerCase())) throw new VbaCompileError(s.line, 'Label not defined')
    })
  }
}
