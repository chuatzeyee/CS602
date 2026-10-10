// VBA math and conversion functions: Int, Fix, Abs, Sgn, Sqr, Exp, Log, Round, Rnd, Randomize, CInt ... CVErr.
import { bankersRound, coerceTo, deref, fitNumber, toNumber, toStr } from './coerce'
import { EMPTY, NULL_VAL, VbaError, dbl, int, str, type BuiltinFn, type Val, type VbaType } from './runtime'
import { fn, need, opt, optWhole, whole, type CoreCtx, type Table } from './builtinsArgs'

type Unary = (x: number) => number

// Int/Fix/Abs keep the numeric subtype; strings give Double
function keepType(f: Unary): BuiltinFn {
  return (_c, a, n) => {
    const v = deref(need(a, n, 0, 'Number'))
    switch (v.t) {
      case 'null': return NULL_VAL
      case 'empty': return int(0)
      case 'bool': return fitNumber(f(v.v ? -1 : 0), 'int')
      case 'byte': case 'int': case 'long': case 'single': case 'double': case 'currency': case 'date':
        return fitNumber(f(v.v) || 0, v.t)
      default: return fitNumber(f(toNumber(v)) || 0, 'double')
    }
  }
}

function real(f: (x: number) => number): BuiltinFn {
  return (_c, a, n) => {
    const v = deref(need(a, n, 0, 'Number'))
    if (v.t === 'null') return NULL_VAL
    const r = f(toNumber(v))
    if (Number.isNaN(r)) throw new VbaError(5)
    return fitNumber(r, 'double')
  }
}

const roundFn: BuiltinFn = (_c, a, n) => {
  const v = deref(need(a, n, 0, 'Number'))
  if (v.t === 'null') return NULL_VAL
  const digits = optWhole(opt(a, n, 1, 'NumDigitsAfterDecimal'), 0)
  if (digits < 0) throw new VbaError(5)
  const r = bankersRound(toNumber(v), digits)
  if (v.t === 'byte' || v.t === 'int' || v.t === 'long' || v.t === 'single' || v.t === 'currency' || v.t === 'date') {
    return fitNumber(r, v.t)
  }
  if (v.t === 'empty' || v.t === 'bool') return int(r)
  return dbl(r)
}

const BELOW_ONE = Math.fround(1 - 2 ** -24)

// Rnd returns a Single in [0, 1); Rnd(0) repeats the last number
const rndFn: BuiltinFn = (ctx, a, n) => {
  const c = ctx as CoreCtx
  const arg = opt(a, n, 0, 'Number')
  if (arg !== undefined && toNumber(arg) === 0) return { t: 'single', v: c.lastRnd ?? 0 }
  const x = Math.fround(ctx.host.random())
  c.lastRnd = x >= 1 ? BELOW_ONE : x
  return { t: 'single', v: c.lastRnd }
}

const convert = (type: VbaType): BuiltinFn => (_c, a, n) => coerceTo(deref(need(a, n, 0, 'Expression')), type)

const cstrFn: BuiltinFn = (_c, a, n) => {
  const v = deref(need(a, n, 0, 'Expression'))
  return str(v.t === 'err' ? `Error ${v.v}` : toStr(v))
}

const cvarFn: BuiltinFn = (_c, a, n) => {
  const v = opt(a, n, 0, 'Expression')
  return v === undefined ? EMPTY : deref(v)
}

const cvErrFn: BuiltinFn = (_c, a, n) => ({ t: 'err', v: whole(need(a, n, 0, 'Expression')) }) as Val

export function mathFunctions(): Table {
  return [
    ['int', fn(keepType(Math.floor))],
    ['fix', fn(keepType(Math.trunc))],
    ['abs', fn(keepType(Math.abs))],
    ['sgn', fn((_c, a, n) => {
      const v = deref(need(a, n, 0, 'Number'))
      if (v.t === 'null') return NULL_VAL
      return int(Math.sign(toNumber(v)) || 0)
    })],
    ['sqr', fn(real(x => {
      if (x < 0) throw new VbaError(5)
      return Math.sqrt(x)
    }))],
    ['exp', fn(real(Math.exp))],
    ['log', fn(real(x => {
      if (x <= 0) throw new VbaError(5)
      return Math.log(x)
    }))],
    ['sin', fn(real(Math.sin))],
    ['cos', fn(real(Math.cos))],
    ['tan', fn(real(Math.tan))],
    ['atn', fn(real(Math.atan))],
    ['round', fn(roundFn)],
    ['rnd', fn(rndFn)],
    ['randomize', fn(() => EMPTY, true)],
    ['cint', fn(convert('Integer'))],
    ['clng', fn(convert('Long'))],
    ['clnglng', fn(convert('Double'))],
    ['cbyte', fn(convert('Byte'))],
    ['csng', fn(convert('Single'))],
    ['cdbl', fn(convert('Double'))],
    ['cdec', fn(convert('Double'))],
    ['ccur', fn(convert('Currency'))],
    ['cbool', fn(convert('Boolean'))],
    ['cdate', fn(convert('Date'))],
    ['cstr', fn(cstrFn)],
    ['cvar', fn(cvarFn)],
    ['cverr', fn(cvErrFn)],
  ]
}

