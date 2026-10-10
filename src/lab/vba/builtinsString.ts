// VBA string functions: Len, Left, Right, Mid, InStr, InStrRev, Replace, Trim, UCase, Space, String, StrComp, Chr,
// Asc, Val, Str, Hex, Oct ...
import { deref, formatNumber, toNumber, toStr } from './coerce'
import { NULL_VAL, VbaError, int, lng, str, dbl, type BuiltinFn, type Val } from './runtime'
import { fn, isNull, need, opt, optWhole, textCompare, whole, type Table } from './builtinsArgs'

// a string function that returns Null for a Null first argument
const nullable = (f: BuiltinFn): BuiltinFn => (ctx, args, named) => (args[0] && isNull(args[0]) ? NULL_VAL : f(ctx, args, named))

const nonNeg = (v: Val): number => {
  const n = whole(v)
  if (n < 0) throw new VbaError(5)
  return n
}

const fold = (s: string, text: boolean): string => (text ? s.toLowerCase() : s)

function inStr(start: number, s1: string, s2: string, text: boolean): number {
  if (start < 1) throw new VbaError(5)
  if (s1 === '' || start > s1.length) return 0
  if (s2 === '') return start
  return fold(s1, text).indexOf(fold(s2, text), start - 1) + 1
}

const instrFn: BuiltinFn = (ctx, args, named) => {
  const first = opt(args, named, 0, 'Start')
  const hasStart = args.length >= 3 || opt([], named, 0, 'Start') !== undefined
  const a = hasStart ? 1 : 0
  const s1 = need(args, named, a, 'String1')
  const s2 = need(args, named, a + 1, 'String2')
  if (isNull(s1) || isNull(s2)) return NULL_VAL
  const start = hasStart && first ? whole(first) : 1
  return lng(inStr(start, toStr(s1), toStr(s2), textCompare(ctx, opt(args, named, a + 2, 'Compare'))))
}

const instrRevFn: BuiltinFn = (ctx, args, named) => {
  const s1 = need(args, named, 0, 'StringCheck')
  const s2 = need(args, named, 1, 'StringMatch')
  if (isNull(s1) || isNull(s2)) return NULL_VAL
  const a = toStr(s1), b = toStr(s2)
  let start = optWhole(opt(args, named, 2, 'Start'), -1)
  if (start === 0 || start < -1) throw new VbaError(5)
  if (start === -1) start = a.length
  if (b === '') return lng(start > a.length ? 0 : start)
  if (start > a.length) return lng(0)
  const text = textCompare(ctx, opt(args, named, 3, 'Compare'))
  const from = start - b.length
  return lng(from < 0 ? 0 : fold(a, text).lastIndexOf(fold(b, text), from) + 1)
}

const replaceFn: BuiltinFn = (ctx, args, named) => {
  const expr = toStr(need(args, named, 0, 'Expression'))
  const find = toStr(need(args, named, 1, 'Find'))
  const repl = toStr(need(args, named, 2, 'Replace'))
  const start = optWhole(opt(args, named, 3, 'Start'), 1)
  let count = optWhole(opt(args, named, 4, 'Count'), -1)
  if (start < 1 || count < -1) throw new VbaError(5)
  const text = textCompare(ctx, opt(args, named, 5, 'Compare'))
  const src = expr.slice(start - 1)
  if (find === '' || count === 0) return str(src)
  let out = ''
  let i = 0
  const hay = fold(src, text), needle = fold(find, text)
  while (count !== 0) {
    const j = hay.indexOf(needle, i)
    if (j < 0) break
    out += src.slice(i, j) + repl
    i = j + find.length
    if (count > 0) count--
  }
  return str(out + src.slice(i))
}

function valOf(s: string): number {
  const t = s.replace(/[ \t\r\n]/g, '')
  const radix = /^&([HhOo]?)([0-9A-Fa-f]+)/.exec(t)
  if (radix) {
    const hex = radix[1].toLowerCase() === 'h'
    const digits = hex ? radix[2] : (/^[0-7]+/.exec(radix[2])?.[0] ?? '0')
    let x = parseInt(digits, hex ? 16 : 8)
    if (digits.length <= (hex ? 4 : 6) && x > 0x7fff && x <= 0xffff) x -= 0x10000
    return x
  }
  const m = /^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?/.exec(t)
  if (!m) return 0
  return Number(m[0].replace(/[dD]/, 'e'))
}

// Str: numbers with a leading space for the sign (Str(0.5) = " .5")
function strOf(v: Val): string {
  const x = deref(v)
  if (x.t === 'str') {
    const n = toNumber(x)
    return strOf(dbl(n))
  }
  if (x.t === 'bool' || x.t === 'date') return toStr(x)
  const n = toNumber(x)
  let s = x.t === 'single' ? formatNumber(n, 7) : x.t === 'double' ? formatNumber(n, 15) : toStr(x)
  s = s.replace(/^(-?)0\./, '$1.')
  return n >= 0 ? ` ${s}` : s
}

function radixText(v: Val, base: 16 | 8): string {
  const x = deref(v)
  let n = whole(x)
  if (n < 0) n = (x.t === 'int' || x.t === 'byte' || (n >= -32768 && x.t !== 'long')) ? n + 0x10000 : n + 0x100000000
  return n.toString(base).toUpperCase()
}

const chr = (code: number, wide: boolean): string => {
  if (code < 0 || code > (wide ? 0xffff : 255)) throw new VbaError(5)
  return String.fromCharCode(code)
}

const asc = (v: Val): number => {
  const s = toStr(v)
  if (s === '') throw new VbaError(5)
  return s.charCodeAt(0)
}

const trimSpaces = (s: string, left: boolean, right: boolean): string => {
  let a = 0, b = s.length
  if (left) while (a < b && s[a] === ' ') a++
  if (right) while (b > a && s[b - 1] === ' ') b--
  return s.slice(a, b)
}

export function stringFunctions(): Table {
  const t: Table = [
    ['len', fn(nullable((_c, a, n) => lng(toStr(need(a, n, 0, 'Expression')).length)))],
    ['left', fn(nullable((_c, a, n) => str(toStr(need(a, n, 0, 'String')).slice(0, nonNeg(need(a, n, 1, 'Length'))))))],
    ['right', fn(nullable((_c, a, n) => {
      const s = toStr(need(a, n, 0, 'String'))
      const k = nonNeg(need(a, n, 1, 'Length'))
      return str(k === 0 ? '' : s.slice(-k))
    }))],
    ['mid', fn(nullable((_c, a, n) => {
      const s = toStr(need(a, n, 0, 'String'))
      const start = whole(need(a, n, 1, 'Start'))
      const lenArg = opt(a, n, 2, 'Length')
      if (start < 1) throw new VbaError(5)
      const k = lenArg === undefined ? s.length : nonNeg(lenArg)
      return str(s.substr(start - 1, k))
    }))],
    ['instr', fn(instrFn)],
    ['instrrev', fn(instrRevFn)],
    ['replace', fn(replaceFn)],
    ['trim', fn(nullable((_c, a, n) => str(trimSpaces(toStr(need(a, n, 0, 'String')), true, true))))],
    ['ltrim', fn(nullable((_c, a, n) => str(trimSpaces(toStr(need(a, n, 0, 'String')), true, false))))],
    ['rtrim', fn(nullable((_c, a, n) => str(trimSpaces(toStr(need(a, n, 0, 'String')), false, true))))],
    ['ucase', fn(nullable((_c, a, n) => str(toStr(need(a, n, 0, 'String')).toUpperCase())))],
    ['lcase', fn(nullable((_c, a, n) => str(toStr(need(a, n, 0, 'String')).toLowerCase())))],
    ['space', fn((_c, a, n) => str(' '.repeat(nonNeg(need(a, n, 0, 'Number')))))],
    ['string', fn((_c, a, n) => {
      const k = nonNeg(need(a, n, 0, 'Number'))
      const c = deref(need(a, n, 1, 'Character'))
      if (c.t === 'null') return NULL_VAL
      const ch = c.t === 'str' ? c.v.charAt(0) : chr(whole(c) % 256, false)
      if (ch === '') throw new VbaError(5)
      return str(ch.repeat(k))
    })],
    ['strcomp', fn((ctx, a, n) => {
      const x = need(a, n, 0, 'String1'), y = need(a, n, 1, 'String2')
      if (isNull(x) || isNull(y)) return NULL_VAL
      const p = fold(toStr(x), textCompare(ctx, opt(a, n, 2, 'Compare')))
      const q = fold(toStr(y), textCompare(ctx, opt(a, n, 2, 'Compare')))
      return int(p < q ? -1 : p > q ? 1 : 0)
    })],
    ['strreverse', fn((_c, a, n) => str([...toStr(need(a, n, 0, 'Expression'))].reverse().join('')))],
    ['chr', fn((_c, a, n) => str(chr(whole(need(a, n, 0, 'CharCode')), false)))],
    ['chrw', fn((_c, a, n) => str(chr(whole(need(a, n, 0, 'CharCode')) & 0xffff, true)))],
    ['asc', fn((_c, a, n) => int(asc(need(a, n, 0, 'String'))))],
    ['ascw', fn((_c, a, n) => int(asc(need(a, n, 0, 'String'))))],
    ['val', fn((_c, a, n) => dbl(valOf(toStr(need(a, n, 0, 'String')))))],
    ['str', fn(nullable((_c, a, n) => str(strOf(need(a, n, 0, 'Number')))))],
    ['spc', fn((_c, a, n) => str(' '.repeat(nonNeg(need(a, n, 0, 'n')))))],
    ['tab', fn(() => str(''))],
    ['hex', fn(nullable((_c, a, n) => str(radixText(need(a, n, 0, 'Number'), 16))))],
    ['oct', fn(nullable((_c, a, n) => str(radixText(need(a, n, 0, 'Number'), 8))))],
  ]
  // the $ forms (Left$, Mid$ ...) return a String and reject Null
  const dollar = ['left', 'right', 'mid', 'trim', 'ltrim', 'rtrim', 'ucase', 'lcase', 'space', 'string', 'chr', 'chrw', 'str', 'hex', 'oct']
  for (const name of dollar) {
    const g = t.find(([k]) => k === name)![1]
    if (g.kind !== 'fn') continue
    const f = g.fn
    t.push([`${name}$`, fn((ctx, a, n) => {
      if (a[0] && isNull(a[0])) throw new VbaError(94)
      return f(ctx, a, n)
    })])
  }
  return t
}
