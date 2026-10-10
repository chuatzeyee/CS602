// Declarations and storage: Dim/Static/Const/ReDim, arrays, and Let/Set into variables and array elements.
import type { Bound, Proc, Stmt, VarDecl } from './ast'
import { coerceTo, deref } from './coerce'
import {
  NOTHING, VbaCompileError, VbaError, arrayIndex, defaultValue, newArray, obj, str, type Val, type VbaArray, type VbaType,
} from './runtime'
import { evalExpr, findSlot, toIndex } from './interpreterExpr'
import { copyArray, varKey, vbaTypeOf, type Frame, type Machine, type Slot } from './interpreterTypes'
import { newObject } from './builtinsCollection'

export function evalBounds(m: Machine, bounds: Bound[]): { lo: number; hi: number }[] {
  return bounds.map(b => {
    const lo = b.lo ? toIndex(evalExpr(m, b.lo)) : m.arrayBase
    const hi = toIndex(evalExpr(m, b.hi))
    if (hi < lo) throw new VbaError(9)
    return { lo, hi }
  })
}

const emptyArray = (elemType: VbaType): Val => ({ t: 'arr', v: { dims: [], data: [], elemType, fixed: false } })

export function slotFor(m: Machine, d: VarDecl): Slot {
  const type = vbaTypeOf(d.type)
  if (d.bounds && d.bounds.length) {
    return { v: { t: 'arr', v: newArray(evalBounds(m, d.bounds), type, true) }, type, declared: true, isArray: true, fixed: true }
  }
  if (d.dynamicArray) return { v: emptyArray(type), type, declared: true, isArray: true }
  const fixedLen = d.type?.fixedLen
  if (fixedLen !== undefined) return { v: str(' '.repeat(fixedLen)), type, declared: true, fixedLen }
  // Dim c As New Collection: VBA creates the object on first use; the lab creates it at the Dim
  const made = d.isNew && d.type ? newObject(d.type.name) : undefined
  if (made) return { v: obj(made), type, declared: true }
  return { v: type === 'Object' ? NOTHING : defaultValue(type), type, declared: true }
}

// Dim/Static/Const/ReDim anywhere in a procedure, in source order (VBA declares them for the whole procedure)
const hoistCache = new WeakMap<Proc, Stmt[]>()
export function hoisted(proc: Proc): Stmt[] {
  let list = hoistCache.get(proc)
  if (list) return list
  list = []
  const walk = (stmts: Stmt[]): void => {
    for (const s of stmts) {
      if (s.k === 'dim' || s.k === 'const' || s.k === 'redim') list!.push(s)
      for (const body of childBlocks(s)) walk(body)
    }
  }
  walk(proc.body)
  hoistCache.set(proc, list)
  return list
}

export function childBlocks(s: Stmt): Stmt[][] {
  switch (s.k) {
    case 'if': return [...s.branches.map(b => b.body), ...(s.elseBody ? [s.elseBody] : [])]
    case 'select': return [...s.cases.map(c => c.body), ...(s.elseBody ? [s.elseBody] : [])]
    case 'for': case 'forEach': case 'do': case 'while': case 'with': return [s.body]
    default: return []
  }
}

export function declareConst(m: Machine, vars: Map<string, Slot>, item: { name: string; type?: { name: string }; value: import('./ast').Expr }): void {
  const raw = evalExpr(m, item.value)
  const type = item.type ? vbaTypeOf({ name: item.type.name }) : 'Variant'
  const v = type === 'Variant' ? deref(raw) : coerceTo(raw, type)
  vars.set(varKey(item.name), { v, type, declared: true, isConst: true })
}

// create a procedure's locals (m.frame must already be the new frame)
export function declareLocals(m: Machine, frame: Frame, proc: Proc): void {
  for (const s of hoisted(proc)) {
    m.line = s.line
    if (s.k === 'dim') {
      for (const d of s.vars) {
        const key = varKey(d.name)
        if (frame.vars.has(key)) continue
        if (s.scope === 'static' || proc.isStatic) {
          const procKey = proc.name.toLowerCase()
          let store = m.statics.get(procKey)
          if (!store) { store = new Map(); m.statics.set(procKey, store) }
          let slot = store.get(key)
          if (!slot) { slot = slotFor(m, d); store.set(key, slot) }
          frame.vars.set(key, slot)
        } else frame.vars.set(key, slotFor(m, d))
      }
    } else if (s.k === 'const') {
      for (const c of s.items) declareConst(m, frame.vars, c)
    } else if (s.k === 'redim') {
      for (const it of s.items) {
        const key = varKey(it.name)
        if (frame.vars.has(key) || m.moduleVars.has(key)) continue
        const type = vbaTypeOf(it.type)
        frame.vars.set(key, { v: emptyArray(type), type, declared: true, isArray: true })
      }
    }
  }
}

function fitString(slot: Slot, v: Val): Val {
  if (slot.fixedLen === undefined || v.t !== 'str') return v
  return str(v.v.padEnd(slot.fixedLen).slice(0, slot.fixedLen))
}

// Let: x = value (typed variables coerce; objects give their default value; arrays are copied)
export function letSlot(m: Machine, slot: Slot, value: Val): void {
  if (slot.isConst) throw new VbaCompileError(m.line, 'Assignment to constant not permitted')
  if (slot.isArray) {
    if (slot.fixed) throw new VbaCompileError(m.line, "Can't assign to array")
    if (value.t !== 'arr') throw new VbaError(13)
    const copy = copyArray(value.v)
    if (slot.type !== 'Variant' && copy.elemType !== slot.type) throw new VbaError(13)
    slot.v = { t: 'arr', v: copy }
    return
  }
  if (slot.type === 'Object') {
    if (slot.v.t !== 'obj' || slot.v.v === null) throw new VbaError(91)
    if (!slot.v.v.defaultSet) throw new VbaError(438)
    slot.v.v.defaultSet([], value.t === 'obj' ? deref(value) : value)
    return
  }
  if (slot.type === 'Variant') {
    slot.v = value.t === 'obj' ? deref(value) : value.t === 'arr' ? { t: 'arr', v: copyArray(value.v) } : value
    return
  }
  slot.v = fitString(slot, coerceTo(value, slot.type))
}

// Set: x = object reference
export function setSlot(m: Machine, slot: Slot, value: Val): void {
  if (slot.isConst) throw new VbaCompileError(m.line, 'Assignment to constant not permitted')
  if (value.t !== 'obj') throw new VbaError(424)
  if (slot.type !== 'Object' && slot.type !== 'Variant') throw new VbaCompileError(m.line, 'Object required')
  slot.v = value
}

export function assignElement(arr: VbaArray, idx: number[], value: Val, isSet: boolean): void {
  const flat = arrayIndex(arr, idx)
  if (isSet) {
    if (value.t !== 'obj') throw new VbaError(424)
    if (arr.elemType !== 'Object' && arr.elemType !== 'Variant') throw new VbaError(13)
    arr.data[flat] = value
    return
  }
  if (arr.elemType === 'Variant') {
    arr.data[flat] = value.t === 'obj' ? deref(value) : value.t === 'arr' ? { t: 'arr', v: copyArray(value.v) } : value
  } else if (arr.elemType === 'Object') {
    const cur = arr.data[flat]
    if (cur.t !== 'obj' || cur.v === null) throw new VbaError(91)
    if (!cur.v.defaultSet) throw new VbaError(438)
    cur.v.defaultSet([], value)
  } else arr.data[flat] = coerceTo(value, arr.elemType)
}

function preserveInto(old: VbaArray, fresh: VbaArray): void {
  const n = old.dims.length
  if (n !== fresh.dims.length) throw new VbaError(9)
  for (let i = 0; i < n - 1; i++) {
    if (old.dims[i].lo !== fresh.dims[i].lo || old.dims[i].hi !== fresh.dims[i].hi) throw new VbaError(9)
  }
  if (old.dims[n - 1].lo !== fresh.dims[n - 1].lo) throw new VbaError(9)
  const oldLast = old.dims[n - 1].hi - old.dims[n - 1].lo + 1
  const newLast = fresh.dims[n - 1].hi - fresh.dims[n - 1].lo + 1
  const blocks = oldLast === 0 ? 0 : old.data.length / oldLast
  for (let b = 0; b < blocks; b++) {
    for (let j = 0; j < Math.min(oldLast, newLast); j++) fresh.data[b * newLast + j] = old.data[b * oldLast + j]
  }
}

export function execReDim(m: Machine, s: Extract<Stmt, { k: 'redim' }>): void {
  for (const it of s.items) {
    let slot = findSlot(m, it.name)
    if (!slot) {
      slot = { v: emptyArray(vbaTypeOf(it.type)), type: vbaTypeOf(it.type), declared: true, isArray: true }
      m.frame.vars.set(varKey(it.name), slot)
    }
    if (slot.fixed) throw new VbaError(10)
    if (!slot.isArray && slot.type !== 'Variant') throw new VbaCompileError(s.line, 'Expected array')
    const cur = slot.v.t === 'arr' ? slot.v.v : null
    const elemType: VbaType = it.type ? vbaTypeOf(it.type) : cur ? cur.elemType : slot.isArray ? slot.type : 'Variant'
    const fresh = newArray(evalBounds(m, it.bounds), elemType)
    if (s.preserve && cur && cur.dims.length > 0) preserveInto(cur, fresh)
    slot.v = { t: 'arr', v: fresh }
  }
}

// Erase: fixed arrays are reset to default values, dynamic arrays are released
export function eraseSlot(slot: Slot): void {
  if (slot.v.t !== 'arr') throw new VbaError(13)
  const a = slot.v.v
  if (slot.fixed) a.data.fill(defaultValue(a.elemType))
  else slot.v = emptyArray(a.elemType)
}
