// VBA operators on tagged values (re-exported by coerce.ts). Result types follow VBA: Integer + Integer is Integer
// (overflow is error 6 for typed operands, a wider Variant for Variant operands), "/" is Double, "\" and Mod round
// their operands to whole numbers first (half to even), "&" concatenates, comparisons follow VBA's typed/Variant rules.
import type { BinOp } from './ast'
import { NULL_VAL, VbaError, bool, str, type Val } from './runtime'
import { bankersRound, deref, fitNumber, num, parseNumber, toNumber, toStr } from './coerce'
import { globMatch, type GlobToken } from '../engine/glob'

export interface OpCtx {
  compareText: boolean
  lVariant?: boolean                    // the left operand is a Variant (default); false = literal or typed
  rVariant?: boolean
}

type Rank = 'byte' | 'int' | 'long' | 'single' | 'currency' | 'double'
const ORDER: Rank[] = ['byte', 'int', 'long', 'single', 'currency', 'double']
const PROMOTE: Record<string, string[]> = {
  byte: ['byte', 'int', 'long', 'double'], int: ['int', 'long', 'double'], long: ['long', 'double'],
  single: ['single', 'double'], currency: ['currency'], double: ['double'], date: ['date', 'double'],
}

function rankOf(v: Val): Rank {
  switch (v.t) {
    case 'byte': return 'byte'
    case 'empty': case 'bool': case 'int': return 'int'
    case 'long': return 'long'
    case 'single': return 'single'
    case 'currency': return 'currency'
    case 'date': case 'double': case 'str': return 'double'
    default: throw new VbaError(13)
  }
}

function wider(a: Rank, b: Rank): Rank {
  if ((a === 'single' && b === 'long') || (a === 'long' && b === 'single')) return 'double'
  return ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))]
}

function fits(x: number, t: string): boolean {
  try { fitNumber(x, t as Rank); return true } catch { return false }
}

// fit an arithmetic result; Variant arithmetic widens on overflow instead of failing
function fitArith(x: number, tag: Rank | 'date', variant: boolean): Val {
  if (!variant) return fitNumber(x, tag)
  const next = PROMOTE[tag].find(t => fits(x, t))
  if (next === undefined) throw new VbaError(6)
  return fitNumber(x, next as Rank)
}

function plus(l: Val, r: Val, variant: boolean): Val {
  if (l.t === 'empty' && r.t === 'empty') return num('int', 0)
  if (l.t === 'empty') return r.t === 'bool' ? num('int', r.v ? -1 : 0) : r
  if (r.t === 'empty') return l.t === 'bool' ? num('int', l.v ? -1 : 0) : l
  if (l.t === 'str' && r.t === 'str') return str(l.v + r.v)
  const x = toNumber(l) + toNumber(r)
  if (l.t === 'date' || r.t === 'date') return fitArith(x, 'date', variant)
  return fitArith(x, wider(rankOf(l), rankOf(r)), variant)
}

function minus(l: Val, r: Val, variant: boolean): Val {
  const x = toNumber(l) - toNumber(r)
  if (l.t === 'date' && r.t === 'date') return fitNumber(x, 'double')
  if (l.t === 'date' || r.t === 'date') return fitArith(x, 'date', variant)
  return fitArith(x, wider(rankOf(l), rankOf(r)), variant)
}

function times(l: Val, r: Val, variant: boolean): Val {
  return fitArith(toNumber(l) * toNumber(r), wider(rankOf(l), rankOf(r)), variant)
}

const SINGLE_OK = new Set(['single', 'byte', 'int', 'bool', 'empty'])

function divide(l: Val, r: Val): Val {
  const a = toNumber(l), b = toNumber(r)
  if (b === 0) throw new VbaError(a === 0 ? 6 : 11)
  const single = (l.t === 'single' || r.t === 'single') && SINGLE_OK.has(l.t) && SINGLE_OK.has(r.t)
  return fitNumber(a / b, single ? 'single' : 'double')
}

function wholeOperand(v: Val): number {
  const x = bankersRound(toNumber(v), 0)
  if (x < -2147483648 || x > 2147483647) throw new VbaError(6)
  return x
}

function intRank(l: Val, r: Val): Rank {
  const small = (v: Val) => v.t === 'byte' || v.t === 'int' || v.t === 'bool' || v.t === 'empty'
  if (l.t === 'byte' && r.t === 'byte') return 'byte'
  return small(l) && small(r) ? 'int' : 'long'
}

function intDivide(op: '\\' | 'mod', l: Val, r: Val, variant: boolean): Val {
  const a = wholeOperand(l), b = wholeOperand(r)
  if (b === 0) throw new VbaError(11)
  const x = op === '\\' ? Math.trunc(a / b) : a % b
  return fitArith(x === 0 ? 0 : x, intRank(l, r), variant)
}

function power(l: Val, r: Val): Val {
  const a = toNumber(l), b = toNumber(r)
  if ((a < 0 && !Number.isInteger(b)) || (a === 0 && b < 0)) throw new VbaError(5)
  return fitNumber(a ** b, 'double')
}

function concat(l: Val, r: Val): Val {
  if (l.t === 'null' && r.t === 'null') return NULL_VAL
  const s = (v: Val) => (v.t === 'null' ? '' : toStr(v))
  return str(s(l) + s(r))
}

interface Logical { x: number; kind: 'bool' | 'byte' | 'int' | 'long' }

function toLogical(v: Val): Logical {
  switch (v.t) {
    case 'empty': return { x: 0, kind: 'int' }
    case 'bool': return { x: v.v ? -1 : 0, kind: 'bool' }
    case 'byte': case 'int': case 'long': return { x: v.v, kind: v.t }
    case 'single': case 'double': case 'currency': case 'date': return { x: wholeOperand(v), kind: 'long' }
    case 'str': {
      const t = v.v.trim().toLowerCase()
      if (t === 'true' || t === 'false') return { x: t === 'true' ? -1 : 0, kind: 'bool' }
      const n = parseNumber(v.v)
      if (n === null) throw new VbaError(13)
      return { x: wholeOperand(num('double', n)), kind: 'long' }
    }
    default: throw new VbaError(13)
  }
}

function logicalResult(x: number, a: Logical['kind'], b: Logical['kind']): Val {
  if (a === 'bool' && b === 'bool') return bool(x !== 0)
  if (a === 'byte' && b === 'byte') return num('byte', x & 0xff)
  const small = (k: string) => k !== 'long'
  return small(a) && small(b) ? num('int', (x << 16) >> 16) : num('long', x | 0)
}

function logical(op: 'and' | 'or' | 'xor' | 'eqv' | 'imp', l: Val, r: Val): Val {
  if (l.t === 'null' || r.t === 'null') {
    if (l.t === 'null' && r.t === 'null') return NULL_VAL
    const o = toLogical(l.t === 'null' ? r : l)
    const known = (x: number) => logicalResult(x, o.kind, o.kind)
    if (op === 'and' && o.x === 0) return known(0)
    if (op === 'or' && o.x === -1) return known(-1)
    if (op === 'imp' && ((l.t === 'null' && o.x === -1) || (r.t === 'null' && o.x === 0))) return known(-1)
    return NULL_VAL
  }
  const a = toLogical(l), b = toLogical(r)
  const x = op === 'and' ? a.x & b.x : op === 'or' ? a.x | b.x : op === 'xor' ? a.x ^ b.x
    : op === 'eqv' ? ~(a.x ^ b.x) : ~a.x | b.x
  return logicalResult(x, a.kind, b.kind)
}

function cmpStr(a: string, b: string, text: boolean): -1 | 0 | 1 {
  const x = text ? a.toLowerCase() : a
  const y = text ? b.toLowerCase() : b
  return x < y ? -1 : x > y ? 1 : 0
}

const cmpNum = (a: number, b: number): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

// VBA comparison: null when either side is Null. Typed/Variant matters when a number meets a string:
// typed string vs Variant number -> text compare; typed number vs string -> numeric (13 if not numeric);
// two Variants -> the number is less than the string.
export function compare(l: Val, r: Val, compareText: boolean, lVariant = true, rVariant = true): -1 | 0 | 1 | null {
  const a = deref(l), b = deref(r)
  if (a.t === 'null' || b.t === 'null') return null
  for (const v of [a, b]) if (v.t === 'err' || v.t === 'arr' || v.t === 'missing' || v.t === 'obj') throw new VbaError(13)
  if (a.t === 'str' && b.t === 'str') return cmpStr(a.v, b.v, compareText)
  if (a.t === 'str' && b.t === 'empty') return cmpStr(a.v, '', compareText)
  if (a.t === 'empty' && b.t === 'str') return cmpStr('', b.v, compareText)
  if (a.t !== 'str' && b.t !== 'str') return cmpNum(toNumber(a), toNumber(b))
  const strIsLeft = a.t === 'str'
  const strVariant = strIsLeft ? lVariant : rVariant
  const numVariant = strIsLeft ? rVariant : lVariant
  if (!strVariant && numVariant) return cmpStr(toStr(a), toStr(b), compareText)
  if (strVariant && numVariant) return strIsLeft ? 1 : -1
  return cmpNum(toNumber(a), toNumber(b))
}

// VBA Like: * any run, ? one character, # one digit, [a-z] [!a-c] character lists; the whole text must match. Matched
// with engine/glob.ts, not a RegExp: "*a*a*a*a*a*a*a*a*a*a*b" against a long text must not freeze the page in one step.
export function likeMatch(text: string, pattern: string, compareText: boolean): boolean {
  const fold = (c: string): string => (compareText ? c.toLowerCase() : c)
  const tokens: GlobToken[] = []
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (tokens[tokens.length - 1] !== '*') tokens.push('*')
    } else if (c === '?') {
      tokens.push(() => true)
    } else if (c === '#') {
      tokens.push(ch => ch >= '0' && ch <= '9')
    } else if (c === '[') {
      const close = pattern.indexOf(']', i + 1)
      if (close < 0) throw new VbaError(93, 'Invalid pattern string')
      let body = pattern.slice(i + 1, close)
      i = close
      if (body === '') continue
      const neg = body[0] === '!' && body.length > 1
      if (neg) body = body.slice(1)
      const spans: [string, string][] = []
      for (let j = 0; j < body.length; j++) {
        if (j + 2 < body.length && body[j + 1] === '-') {
          if (body[j] > body[j + 2]) throw new VbaError(93, 'Invalid pattern string')
          spans.push([body[j], body[j + 2]])
          j += 2
        } else spans.push([body[j], body[j]])
      }
      const inList = (ch: string): boolean => spans.some(([lo, hi]) => ch >= lo && ch <= hi)
      const test = compareText ? (ch: string) => inList(ch) || inList(ch.toLowerCase()) || inList(ch.toUpperCase()) : inList
      tokens.push(neg ? ch => !test(ch) : test)
    } else {
      const lit = fold(c)
      tokens.push(ch => fold(ch) === lit)
    }
  }
  return globMatch(tokens, text)
}

function isOp(l: Val, r: Val): Val {
  if (l.t !== 'obj' || r.t !== 'obj') throw new VbaError(424)
  if (l.v === null || r.v === null) return bool(l.v === r.v)
  return bool(l.v === r.v || (l.v.sameAs?.(r.v) ?? false))
}

export function binary(op: BinOp, l: Val, r: Val, ctx: OpCtx): Val {
  if (op === 'is') return isOp(l, r)
  const a = deref(l), b = deref(r)
  const variant = (ctx.lVariant ?? true) || (ctx.rVariant ?? true)
  switch (op) {
    case '&': return concat(a, b)
    case 'and': case 'or': case 'xor': case 'eqv': case 'imp': return logical(op, a, b)
    case '=': case '<>': case '<': case '>': case '<=': case '>=': {
      const c = compare(a, b, ctx.compareText, ctx.lVariant ?? true, ctx.rVariant ?? true)
      if (c === null) return NULL_VAL
      const res = op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0
        : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0
      return bool(res)
    }
    default: break
  }
  if (a.t === 'null' || b.t === 'null') return NULL_VAL
  switch (op) {
    case 'like': return bool(likeMatch(toStr(a), toStr(b), ctx.compareText))
    case '+': return plus(a, b, variant)
    case '-': return minus(a, b, variant)
    case '*': return times(a, b, variant)
    case '/': return divide(a, b)
    case '\\': case 'mod': return intDivide(op, a, b, variant)
    default: return power(a, b)
  }
}

export function unary(op: '-' | '+' | 'not', v: Val, variant = true): Val {
  const a = deref(v)
  if (a.t === 'null') return NULL_VAL
  if (op === '+') {
    if (a.t === 'err' || a.t === 'arr' || a.t === 'missing') throw new VbaError(13)
    return a
  }
  if (op === 'not') {
    const o = toLogical(a)
    return logicalResult(~o.x, o.kind, o.kind)
  }
  switch (a.t) {
    case 'empty': return num('int', 0)
    case 'bool': return num('int', a.v ? 1 : 0)
    case 'byte': return num('int', -a.v)
    case 'int': case 'long': return fitArith(-a.v || 0, a.t, variant)
    case 'single': case 'double': case 'currency': case 'date': return num(a.t, -a.v || 0)
    case 'str': return fitNumber(-toNumber(a) || 0, 'double')
    default: throw new VbaError(13)
  }
}
