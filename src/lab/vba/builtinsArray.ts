// VBA array, choice and inspection functions: Array, Split, Join, LBound, UBound, Filter, IIf, Choose, Switch, RGB,
// IsNumeric, IsEmpty, IsNull, IsDate, IsArray, IsObject, IsMissing, IsError, TypeName, VarType.
import { deref, isDateText, isNumeric, toBool, toNumber, toStr, typeName } from './coerce'
import { NULL_VAL, VbaError, bool, int, lng, str, type BuiltinFn, type Val, type VbaArray, type VbaType } from './runtime'
import { fn, need, opt, optWhole, textCompare, whole, type CoreCtx, type Table } from './builtinsArgs'

const strArray = (items: string[]): Val => ({
  t: 'arr', v: { dims: [{ lo: 0, hi: items.length - 1 }], data: items.map(str), elemType: 'String', fixed: false },
})

function arrayArg(v: Val): VbaArray {
  const x = deref(v)
  if (x.t !== 'arr') throw new VbaError(13)
  return x.v
}

function bound(upper: boolean): BuiltinFn {
  return (_c, a, n) => {
    const arr = arrayArg(need(a, n, 0, 'ArrayName'))
    const d = optWhole(opt(a, n, 1, 'Dimension'), 1)
    if (d < 1 || d > arr.dims.length) throw new VbaError(9)
    return lng(upper ? arr.dims[d - 1].hi : arr.dims[d - 1].lo)
  }
}

const splitFn: BuiltinFn = (ctx, a, n) => {
  const s = toStr(need(a, n, 0, 'Expression'))
  const dv = opt(a, n, 1, 'Delimiter')
  const delim = dv === undefined ? ' ' : toStr(dv)
  const limit = optWhole(opt(a, n, 2, 'Limit'), -1)
  const text = textCompare(ctx, opt(a, n, 3, 'Compare'))
  if (s === '') return strArray([])
  if (delim === '') return strArray([s])
  const parts: string[] = []
  const hay = text ? s.toLowerCase() : s
  const needle = text ? delim.toLowerCase() : delim
  let i = 0
  while (limit < 0 || parts.length < limit - 1) {
    const j = hay.indexOf(needle, i)
    if (j < 0) break
    parts.push(s.slice(i, j))
    i = j + delim.length
  }
  parts.push(s.slice(i))
  return strArray(limit === 0 ? [] : parts)
}

const joinFn: BuiltinFn = (_c, a, n) => {
  const arr = arrayArg(need(a, n, 0, 'SourceArray'))
  if (arr.dims.length !== 1) throw new VbaError(arr.dims.length === 0 ? 9 : 5)
  const dv = opt(a, n, 1, 'Delimiter')
  return str(arr.data.map(toStr).join(dv === undefined ? ' ' : toStr(dv)))
}

const filterFn: BuiltinFn = (ctx, a, n) => {
  const arr = arrayArg(need(a, n, 0, 'SourceArray'))
  if (arr.dims.length !== 1) throw new VbaError(5)
  const match = toStr(need(a, n, 1, 'Match'))
  const inc = opt(a, n, 2, 'Include')
  const include = inc === undefined ? true : toBool(inc)
  const text = textCompare(ctx, opt(a, n, 3, 'Compare'))
  const fold = (s: string) => (text ? s.toLowerCase() : s)
  return strArray(arr.data.map(toStr).filter(s => fold(s).includes(fold(match)) === include))
}

const arrayFn: BuiltinFn = (ctx, a) => {
  const lo = (ctx as CoreCtx).arrayBase ?? 0
  const data = [...a]
  return { t: 'arr', v: { dims: [{ lo, hi: lo + data.length - 1 }], data, elemType: 'Variant', fixed: false } }
}

const chooseFn: BuiltinFn = (_c, a) => {
  if (a.length === 0) throw new VbaError(449)
  const i = Math.trunc(toNumber(a[0]))
  return i >= 1 && i < a.length ? a[i] : NULL_VAL
}

const switchFn: BuiltinFn = (_c, a) => {
  if (a.length % 2 !== 0) throw new VbaError(5)
  for (let i = 0; i < a.length; i += 2) {
    const c = deref(a[i])
    if (c.t !== 'null' && toBool(c)) return a[i + 1]
  }
  return NULL_VAL
}

const rgbPart = (v: Val): number => Math.max(0, Math.min(255, whole(v)))

const VAR_TYPES: Record<string, number> = {
  empty: 0, null: 1, int: 2, long: 3, single: 4, double: 5, currency: 6, date: 7, str: 8, obj: 9, err: 10, missing: 10,
  bool: 11, byte: 17,
}
const ELEM_TYPES: Partial<Record<VbaType, number>> = {
  Integer: 2, Long: 3, Single: 4, Double: 5, Currency: 6, Date: 7, String: 8, Object: 9, Boolean: 11, Variant: 12, Byte: 17,
}

function varType(v: Val): number {
  if (v.t === 'arr') return 8192 + (ELEM_TYPES[v.v.elemType] ?? 12)
  if (v.t === 'obj' && v.v?.defaultGet) return varType(deref(v))
  return VAR_TYPES[v.t] ?? 12
}

const isEmptyFn: BuiltinFn = (_c, a, n) => {
  const v = need(a, n, 0, 'Expression')
  if (v.t === 'obj' && (v.v === null || !v.v.defaultGet)) return bool(false)
  return bool(deref(v).t === 'empty')
}

export function arrayFunctions(): Table {
  return [
    ['array', fn(arrayFn)],
    ['split', fn(splitFn)],
    ['join', fn(joinFn)],
    ['filter', fn(filterFn)],
    ['lbound', fn(bound(false))],
    ['ubound', fn(bound(true))],
    ['iif', fn((_c, a, n) => {
      const c = deref(need(a, n, 0, 'Expression'))
      return c.t !== 'null' && toBool(c) ? need(a, n, 1, 'TruePart') : need(a, n, 2, 'FalsePart')
    })],
    ['choose', fn(chooseFn)],
    ['switch', fn(switchFn)],
    ['rgb', fn((_c, a, n) => lng(rgbPart(need(a, n, 0, 'Red')) + rgbPart(need(a, n, 1, 'Green')) * 256 + rgbPart(need(a, n, 2, 'Blue')) * 65536))],
    ['isnumeric', fn((_c, a, n) => bool(isNumeric(need(a, n, 0, 'Expression'))))],
    ['isempty', fn(isEmptyFn)],
    ['isnull', fn((_c, a, n) => {
      const v = need(a, n, 0, 'Expression')
      return bool(v.t === 'null' || (v.t === 'obj' && v.v?.defaultGet !== undefined && deref(v).t === 'null'))
    })],
    ['isdate', fn((_c, a, n) => {
      const v = deref(need(a, n, 0, 'Expression'))
      return bool(v.t === 'date' || (v.t === 'str' && isDateText(v.v)))
    })],
    ['isarray', fn((_c, a, n) => bool(need(a, n, 0, 'VarName').t === 'arr'))],
    ['isobject', fn((_c, a, n) => bool(need(a, n, 0, 'Expression').t === 'obj'))],
    ['ismissing', fn((_c, a) => bool(a[0] !== undefined && a[0].t === 'missing'))],
    ['iserror', fn((_c, a, n) => {
      const v = need(a, n, 0, 'Expression')
      return bool(v.t === 'err' || (v.t === 'obj' && v.v?.defaultGet !== undefined && deref(v).t === 'err'))
    })],
    ['typename', fn((_c, a, n) => str(typeName(need(a, n, 0, 'VarName'))))],
    ['vartype', fn((_c, a, n) => int(varType(need(a, n, 0, 'VarName'))))],
  ]
}
