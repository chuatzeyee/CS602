// objectsWsf.ts - WorksheetFunction.X / Application.WorksheetFunction.X (and the Application.X short form): arguments
// are marshalled into one formula (ranges as addresses, scalars and arrays as literals) and evaluated by the sheet's
// own engine, so results match the sheet's formulas. An Excel error raises 1004 "Unable to get the X property of the
// WorksheetFunction class"; the Application.X form returns the error value instead, like Excel.
import { bool, dbl, newArray, obj, str, VbaError } from './runtime'
import type { Val, VbaObject } from './runtime'
import { deref, toNumber } from './coerce'
import { areasOf, boxText, isCellError, noMember, parseAddress } from './objectsCore'
import type { XlState } from './objectsCore'
import type { CellValue } from '../types'

const ERROR_LITERAL: Record<number, string> = {
  2000: '#NULL!', 2007: '#DIV/0!', 2015: '#VALUE!', 2023: '#REF!', 2029: '#NAME?', 2036: '#NUM!', 2042: '#N/A',
}
const ERROR_NUMBER: Record<string, number> = Object.fromEntries(Object.entries(ERROR_LITERAL).map(([n, code]) => [code, Number(n)]))

// VBA spells the dotted Excel names with underscores (Norm_Inv, StDev_S, Percentile_Inc)
export const excelName = (name: string): string => name.toUpperCase().replace(/_/g, '.')

function literal(v: Val): string {
  switch (v.t) {
    case 'empty': return '0'
    case 'bool': return v.v ? 'TRUE' : 'FALSE'
    case 'str': return `"${v.v.replace(/"/g, '""')}"`
    case 'err': return ERROR_LITERAL[v.v] ?? '#VALUE!'
    case 'null': throw new VbaError(94)
    case 'missing': return ''
    case 'obj': case 'arr': throw new VbaError(13)
    default: return Number.isFinite(v.v) ? String(v.v) : '#NUM!'
  }
}

function marshal(v: Val): string[] {
  if (v.t === 'missing') return ['']
  if (v.t === 'obj') {
    const areas = areasOf(v.v)
    if (areas) return areas.map((b) => boxText(b))
    return marshal(deref(v))
  }
  if (v.t === 'arr') {
    const a = v.v
    if (a.dims.length === 1) return [`{${a.data.map(literal).join(',')}}`]
    if (a.dims.length !== 2) throw new VbaError(13)
    const w = a.dims[1].hi - a.dims[1].lo + 1
    const rows: string[] = []
    for (let i = 0; i < a.data.length; i += w) rows.push(a.data.slice(i, i + w).map(literal).join(','))
    return [`{${rows.join(';')}}`]
  }
  return [literal(v)]
}

function cellToVal(c: CellValue): Val {
  if (c === null) return { t: 'empty' }
  if (typeof c === 'number') return dbl(c)
  if (typeof c === 'boolean') return bool(c)
  if (isCellError(c)) return { t: 'err', v: ERROR_NUMBER[c] ?? 2015 }
  return str(c)
}

function resultToVal(res: CellValue | CellValue[][]): Val {
  if (!Array.isArray(res)) return cellToVal(res)
  const h = res.length
  const w = res[0]?.length ?? 0
  if (h === 1 && w === 1) return cellToVal(res[0][0])
  const a = h === 1 ? newArray([{ lo: 1, hi: w }], 'Variant') : newArray([{ lo: 1, hi: h }, { lo: 1, hi: w }], 'Variant')
  a.data = res.flat().map(cellToVal)
  return { t: 'arr', v: a }
}

const firstError = (res: CellValue | CellValue[][]): boolean =>
  Array.isArray(res) ? res.length === 1 && res[0].length === 1 && isCellError(res[0][0]) : isCellError(res)

// RAND and RANDBETWEEN draw from the run's own generator, not the sheet's
function randomCall(st: XlState, fn: string, args: Val[]): Val | undefined {
  if (fn === 'RAND') return dbl(st.host.random())
  if (fn !== 'RANDBETWEEN') return undefined
  const lo = Math.ceil(toNumber(args[0] ?? { t: 'empty' }))
  const hi = Math.floor(toNumber(args[1] ?? { t: 'empty' }))
  if (hi < lo) throw new VbaError(1004, 'Unable to get the RandBetween property of the WorksheetFunction class')
  return dbl(lo + Math.floor(st.host.random() * (hi - lo + 1)))
}

/** evaluate name(args) on the sheet; raise=false returns Excel errors as error values (Application.X) */
export function worksheetFunction(st: XlState, name: string, args: Val[], raise: boolean): Val {
  const fn = excelName(name)
  if (st.extras.knowsFunction && !st.extras.knowsFunction(fn)) throw noMember('WorksheetFunction', name)
  const rnd = randomCall(st, fn, args)
  if (rnd) return rnd
  let end = args.length
  while (end > 0 && args[end - 1].t === 'missing') end--
  const parts = args.slice(0, end).flatMap(marshal)
  const formula = `=${fn}(${parts.join(',')})`
  const res = st.extras.evaluateArray ? st.extras.evaluateArray(formula) : st.host.evaluate(formula)
  if (raise && firstError(res)) {
    throw new VbaError(1004, `Unable to get the ${name.charAt(0).toUpperCase()}${name.slice(1)} property of the WorksheetFunction class`)
  }
  return resultToVal(res)
}

/** Evaluate("SUM(A1:A3)") / Evaluate("B2"): a value, or a Range for an address; Excel errors come back as values */
export function evaluateText(st: XlState, text: string): Val {
  const t = text.trim().replace(/^=/, '')
  const boxes = parseAddress(t, st.host)
  if (boxes) return obj(st.makeRange(boxes))
  const res = st.extras.evaluateArray ? st.extras.evaluateArray(`=${t}`) : st.host.evaluate(`=${t}`)
  return resultToVal(res)
}

export function worksheetFunctionObject(st: XlState): VbaObject {
  return {
    className: 'WorksheetFunction',
    get: (name, args) => worksheetFunction(st, name, args, true),
    call: (name, args) => worksheetFunction(st, name, args, true),
    set(name) { throw noMember('WorksheetFunction', name) },
  }
}
