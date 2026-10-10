// VBA Let-coercion, CStr formatting and operators on tagged values (Val). Used by the interpreter, the built-ins and
// the Excel object model. Every conversion throws VbaError with VBA's numbers: 6 Overflow, 13 Type mismatch,
// 91 Nothing used as a value, 94 Invalid use of Null.
import { VbaError, bool, str, type Val, type VbaType } from './runtime'
import { MAX_DATE, MIN_DATE, formatDateValue, parseDateString } from './builtinsDateUtil'

export { binary, unary, compare, likeMatch, type OpCtx } from './interpreterOps'

type IntTag = 'byte' | 'int' | 'long'
type NumTag = IntTag | 'single' | 'double' | 'currency'

const INT_RANGE: Record<IntTag, [number, number]> = {
  byte: [0, 255], int: [-32768, 32767], long: [-2147483648, 2147483647],
}
const SINGLE_MAX = 3.4028234663852886e38
const CURRENCY_MAX = 922337203685477.5807

export const num = (t: NumTag | 'date', v: number): Val => ({ t, v }) as Val

// an object used as a value: its default member (Range -> Value); Nothing is error 91
export function deref(v: Val): Val {
  if (v.t !== 'obj') return v
  if (v.v === null) throw new VbaError(91)
  if (!v.v.defaultGet) throw new VbaError(438)
  return deref(v.v.defaultGet([]))
}

// Round half to even at `digits` decimals (VBA's Round, CInt, CLng). Values within a few ulps of a tie count as a tie,
// so decimals typed by the learner (2.675) round the way they read.
export function bankersRound(x: number, digits = 0): number {
  if (!Number.isFinite(x)) return x
  const f = 10 ** digits
  const y = x * f
  const fl = Math.floor(y)
  const frac = y - fl
  let r: number
  if (Math.abs(frac - 0.5) <= 8 * Number.EPSILON * Math.max(1, Math.abs(y))) r = fl % 2 === 0 ? fl : fl + 1
  else r = Math.round(y)
  return digits === 0 ? r : r / f
}

const NUM_RE = /^([+-]?)\$?(?:(\d[\d,]*)(?:\.(\d*))?|\.(\d+))(?:[eEdD]([+-]?\d+))?$/

// a VBA numeric string: spaces around, sign, $, thousands commas, decimals, exponent (1e3, 1D3), &H/&O, (5) = -5
export function parseNumber(text: string): number | null {
  let t = text.trim()
  let neg = false
  if (t.length > 2 && t.startsWith('(') && t.endsWith(')')) { neg = true; t = t.slice(1, -1).trim() }
  const radix = /^&([HhOo]?)([0-9A-Fa-f]+)&?$/.exec(t)
  if (radix) {
    const hex = radix[1].toLowerCase() === 'h'
    if (!hex && !/^[0-7]+$/.test(radix[2])) return null
    let x = parseInt(radix[2], hex ? 16 : 8)
    const short = hex ? radix[2].length <= 4 : x <= 0xffff
    if (short && x > 0x7fff) x -= 0x10000
    else if (x > 0x7fffffff && x <= 0xffffffff) x -= 0x100000000
    return neg ? -x : x
  }
  const m = NUM_RE.exec(t)
  if (!m) return null
  const intPart = (m[2] ?? '').replace(/,/g, '') || '0'
  const frac = m[3] ?? m[4] ?? ''
  const x = Number(`${m[1]}${intPart}.${frac || '0'}e${m[5] ?? '0'}`)
  if (!Number.isFinite(x)) return null
  return neg ? -x : x
}

export function toNumber(v: Val): number {
  switch (v.t) {
    case 'empty': return 0
    case 'null': throw new VbaError(94)
    case 'bool': return v.v ? -1 : 0
    case 'str': {
      const x = parseNumber(v.v)
      if (x === null) throw new VbaError(NUM_RE.test(v.v.trim()) ? 6 : 13)   // "1e400" is numeric but too large: Overflow
      return x
    }
    case 'obj': return toNumber(deref(v))
    case 'missing': case 'err': case 'arr': throw new VbaError(13)
    default: return v.v
  }
}

// CStr's number text: up to `digits` significant digits, scientific (1E+15, 1E-05) outside the fixed range
export function formatNumber(x: number, digits = 15): string {
  if (x === 0 || Object.is(x, -0)) return '0'
  if (!Number.isFinite(x)) return String(x)
  const expText = x.toExponential(digits - 1)
  const e = Number(expText.slice(expText.indexOf('e') + 1))
  if (e < -4 || e >= digits) {
    const mant = expText.slice(0, expText.indexOf('e')).replace(/\.?0+$/, '')
    return `${mant}E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`
  }
  const fixed = x.toFixed(Math.max(0, digits - 1 - e))
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

// Currency is a scaled integer: at most four decimals, never binary noise (1.2346, not 1.23459999999999992)
function currencyText(x: number): string {
  const t = bankersRound(x, 4).toFixed(4).replace(/\.?0+$/, '')
  return t === '-0' ? '0' : t
}

export function toStr(v: Val): string {
  switch (v.t) {
    case 'empty': return ''
    case 'null': throw new VbaError(94)
    case 'bool': return v.v ? 'True' : 'False'
    case 'str': return v.v
    case 'byte': case 'int': case 'long': return String(v.v)
    case 'single': return formatNumber(v.v, 7)
    case 'double': return formatNumber(v.v, 15)
    case 'currency': return currencyText(v.v)
    case 'date': return formatDateValue(v.v)
    case 'obj': return toStr(deref(v))
    default: throw new VbaError(13)
  }
}

export function toBool(v: Val): boolean {
  switch (v.t) {
    case 'empty': return false
    case 'null': throw new VbaError(94)
    case 'bool': return v.v
    case 'str': {
      const t = v.v.trim().toLowerCase()
      if (t === 'true' || t === '#true#') return true
      if (t === 'false' || t === '#false#') return false
      const x = parseNumber(v.v)
      if (x === null) throw new VbaError(13)
      return x !== 0
    }
    case 'obj': return toBool(deref(v))
    case 'missing': case 'err': case 'arr': throw new VbaError(13)
    default: return v.v !== 0
  }
}

// a Date serial; strings are parsed as dates or times (day before month, like the lab sheet)
export function toDate(v: Val): number {
  let x: number
  if (v.t === 'str') {
    const d = parseDateString(v.v)
    if (d === null) {
      const n = parseNumber(v.v)
      if (n === null) throw new VbaError(13)
      x = n
    } else x = d
  } else x = toNumber(v)
  if (x < MIN_DATE || x > MAX_DATE + 1e-6) throw new VbaError(6)
  return x
}

export function isDateText(text: string): boolean {
  return parseDateString(text) !== null
}

function toIntegral(x: number, t: IntTag): number {
  const r = bankersRound(x, 0)
  const [lo, hi] = INT_RANGE[t]
  if (!(r >= lo && r <= hi)) throw new VbaError(6)
  return r === 0 ? 0 : r
}

// fit a computed number into a numeric tag, or fail with Overflow
export function fitNumber(x: number, t: NumTag | 'date'): Val {
  switch (t) {
    case 'byte': case 'int': case 'long': return num(t, toIntegral(x, t))
    case 'single': {
      if (!(Math.abs(x) <= SINGLE_MAX)) throw new VbaError(6)
      return num('single', Math.fround(x))
    }
    case 'currency': {
      if (!(Math.abs(x) <= CURRENCY_MAX)) throw new VbaError(6)
      return num('currency', bankersRound(x, 4))
    }
    case 'date': {
      if (!(x >= MIN_DATE && x <= MAX_DATE + 1e-6)) throw new VbaError(6)
      return num('date', x)
    }
    default: {
      if (!Number.isFinite(x)) throw new VbaError(6)
      return num('double', x)
    }
  }
}

const TYPE_TAG: Partial<Record<VbaType, NumTag>> = {
  Byte: 'byte', Integer: 'int', Long: 'long', Single: 'single', Double: 'double', Currency: 'currency',
}

// Let-coercion of a value into a declared type (assignment to a typed variable, typed parameter, C... functions)
export function coerceTo(v: Val, type: VbaType): Val {
  switch (type) {
    case 'Variant': return v
    case 'Boolean': return bool(toBool(v))
    case 'String':
      if (v.t === 'err') throw new VbaError(13)
      return str(toStr(v))
    case 'Date': return num('date', toDate(v))
    case 'Object':
      if (v.t === 'obj') return v
      throw new VbaError(13)
    default: {
      const tag = TYPE_TAG[type] ?? 'double'
      return fitNumber(toNumber(v), tag)
    }
  }
}

export function typeName(v: Val): string {
  switch (v.t) {
    case 'empty': return 'Empty'
    case 'null': return 'Null'
    case 'missing': return 'Error'
    case 'bool': return 'Boolean'
    case 'byte': return 'Byte'
    case 'int': return 'Integer'
    case 'long': return 'Long'
    case 'single': return 'Single'
    case 'double': return 'Double'
    case 'currency': return 'Currency'
    case 'date': return 'Date'
    case 'str': return 'String'
    case 'err': return 'Error'
    case 'obj': return v.v === null ? 'Nothing' : v.v.className
    case 'arr': return `${v.v.elemType}()`
  }
}

export function isNumeric(v: Val): boolean {
  switch (v.t) {
    case 'empty': case 'bool': case 'byte': case 'int': case 'long':
    case 'single': case 'double': case 'currency': return true
    case 'str': return parseNumber(v.v) !== null
    case 'obj':
      if (v.v === null || !v.v.defaultGet) return false
      return isNumeric(deref(v))
    default: return false
  }
}
