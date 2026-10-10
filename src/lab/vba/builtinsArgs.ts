// Argument helpers for the VBA built-in functions (builtins*.ts).
import { bankersRound, deref, toNumber, toStr } from './coerce'
import { VbaError, type BuiltinFn, type Global, type RunCtx, type Val } from './runtime'

export type Table = [string, Global][]

// the interpreter adds Option Base to the context it creates (Array() follows it)
export interface CoreCtx extends RunCtx { arrayBase?: 0 | 1; lastRnd?: number }

export const fn = (f: BuiltinFn, statementOk = false): Global => ({ kind: 'fn', fn: f, statementOk })
export const konst = (value: Val): Global => ({ kind: 'const', value })

// argument i (or the named argument), undefined when omitted
export function opt(args: Val[], named: Record<string, Val>, i: number, name?: string): Val | undefined {
  if (name) {
    const want = name.toLowerCase()
    for (const k of Object.keys(named)) {
      if (k.toLowerCase() === want) return named[k].t === 'missing' ? undefined : named[k]
    }
  }
  const v = args[i]
  return v === undefined || v.t === 'missing' ? undefined : v
}

// a required argument: error 449 when omitted
export function need(args: Val[], named: Record<string, Val>, i: number, name?: string): Val {
  const v = opt(args, named, i, name)
  if (v === undefined) throw new VbaError(449)
  return v
}

// CLng-style whole number (half to even), error 6 outside Long
export function whole(v: Val): number {
  const x = bankersRound(toNumber(v), 0)
  if (!(x >= -2147483648 && x <= 2147483647)) throw new VbaError(6)
  return x
}

export function optWhole(v: Val | undefined, def: number): number {
  return v === undefined ? def : whole(v)
}

export const isNull = (v: Val): boolean => deref(v).t === 'null'

export function text(v: Val): string {
  return toStr(v)
}

// vbBinaryCompare (0) / vbTextCompare (1); omitted = Option Compare
export function textCompare(ctx: RunCtx, v: Val | undefined): boolean {
  if (v === undefined) return ctx.compareText
  const c = whole(v)
  if (c === -1) return ctx.compareText
  if (c !== 0 && c !== 1 && c !== 2) throw new VbaError(5)
  return c !== 0
}
