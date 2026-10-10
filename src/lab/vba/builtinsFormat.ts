// VBA Format and the FormatNumber family. Number and date codes go through the lab's Excel formatter (SheetJS SSF with
// Excel rounding); VBA-only date tokens (n, w, ww, q, y, c, ddddd, dddddd, ttttt) are translated first.
import { formatText } from '../engine/format'
import { deref, formatNumber, parseNumber, toNumber, toStr } from './coerce'
import { own, str, type BuiltinFn, type Val } from './runtime'
import { fn, need, opt, optWhole, type Table } from './builtinsArgs'
import { dateParts, parseDateString, serialFromYMD } from './builtinsDateUtil'

const NAMED: Record<string, string> = {
  currency: '$#,##0.00;-$#,##0.00', fixed: '0.00', standard: '#,##0.00', percent: '0.00%', scientific: '0.00E+00',
  'short date': 'dd/mm/yyyy', 'medium date': 'dd-mmm-yy', 'long date': 'dddd, d mmmm yyyy',
  'short time': 'hh:mm', 'medium time': 'hh:mm AM/PM', 'long time': 'h:mm:ss AM/PM',
}
const BOOL_NAMES: Record<string, [string, string]> = {
  'yes/no': ['Yes', 'No'], 'true/false': ['True', 'False'], 'on/off': ['On', 'Off'],
}

// the format code without quoted text and escaped characters
const bare = (code: string): string => code.replace(/"[^"]*"/g, '').replace(/\\./g, '')

function isDateCode(code: string): boolean {
  return /[dmyhnswqct]/i.test(bare(code).replace(/E[+-]/gi, '').replace(/General/gi, ''))
}

const quote = (s: string): string => `"${s.replace(/"/g, '')}"`

function weekOfYear(serial: number): number {
  const p = dateParts(serial)
  const jan1 = serialFromYMD(p.y, 1, 1)
  const start = (s: number) => Math.floor(s) - (dateParts(s).wd - 1)
  return (start(serial) - start(jan1)) / 7 + 1
}

// VBA date tokens -> Excel tokens, VBA-only tokens -> quoted literals
function translateDate(code: string, serial: number): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '"') {
      const j = code.indexOf('"', i + 1)
      const end = j < 0 ? code.length : j + 1
      out += code.slice(i, end)
      i = end
      continue
    }
    if (c === '\\') { out += code.slice(i, i + 2); i += 2; continue }
    if (/^ampm/i.test(code.slice(i, i + 4))) { out += 'AM/PM'; i += 4; continue }
    if (/^(am\/pm|a\/p)/i.test(code.slice(i, i + 5))) {
      const len = /^am\/pm/i.test(code.slice(i, i + 5)) ? 5 : 3
      out += code.slice(i, i + len)
      i += len
      continue
    }
    const lower = c.toLowerCase()
    let run = 1
    while (i + run < code.length && code[i + run].toLowerCase() === lower) run++
    const p = dateParts(serial)
    switch (lower) {
      case 'd': out += run >= 6 ? 'dddd, d mmmm yyyy' : run === 5 ? 'dd/mm/yyyy' : 'd'.repeat(run); break
      case 'n': out += run >= 2 ? 'mm' : 'm'; break
      case 'y': out += run === 1 ? quote(String(Math.floor(serial) - serialFromYMD(p.y, 1, 1) + 1)) : run >= 3 ? 'yyyy' : 'yy'; break
      case 'w': out += quote(String(run >= 2 ? weekOfYear(serial) : p.wd)); break
      case 'q': out += quote(String(Math.floor((p.m - 1) / 3) + 1)).repeat(run); break
      case 'c': out += quote(toStr({ t: 'date', v: serial })); break
      case 't': out += run >= 5 ? 'h:mm:ss AM/PM' : c.repeat(run); break
      default: out += c.repeat(run)
    }
    i += run
  }
  return out
}

function textCode(s: string, code: string): string {
  let t = code.includes('>') ? s.toUpperCase() : code.includes('<') ? s.toLowerCase() : s
  const at = (code.match(/@/g) ?? []).length
  if (at > t.length) t = t.padStart(at)
  return t
}

// VBA's Format(expression, format)
export function formatValue(v: Val, fmt?: string): string {
  const x = deref(v)
  if (x.t === 'null' || x.t === 'empty') return ''
  if (fmt === undefined || fmt === '') return x.t === 'err' ? `Error ${x.v}` : toStr(x)
  const key = fmt.trim().toLowerCase()
  if (key === 'general number') return x.t === 'str' ? x.v : formatNumber(toNumber(x))
  if (key === 'general date') return x.t === 'str' && parseDateString(x.v) === null ? x.v : toStr({ t: 'date', v: dateOf(x) ?? 0 })
  const names = own(BOOL_NAMES, key)
  if (names) return toNumber(x) !== 0 ? names[0] : names[1]
  const code = own(NAMED, key) ?? fmt
  if (isDateCode(code)) {
    const serial = dateOf(x)
    if (serial === null) return x.t === 'str' ? x.v : toStr(x)
    const text = formatText(serial, translateDate(code, serial)) ?? toStr({ t: 'date', v: serial })
    return lowerAmPm(bare(code)) ? text.replace(/\b(AM|PM|A|P)\b/, t => t.toLowerCase()) : text
  }
  let n: number
  if (x.t === 'str') {
    const p = parseNumber(x.v)
    if (p === null) return textCode(x.v, code)
    n = p
  } else n = toNumber(x)
  if (/^[@<>!&]+$/.test(bare(code))) return textCode(x.t === 'str' ? x.v : toStr(x), code)
  return formatText(n, code) ?? toStr(x)
}

// "am/pm" and "a/p" in lower case give "pm"/"p" in VBA (the engine's formatter always gives upper case)
const lowerAmPm = (code: string): boolean => /am\/pm|a\/p/.test(code) && !/AM\/PM|A\/P/i.test(code.replace(/am\/pm|a\/p/g, ''))

function dateOf(x: Val): number | null {
  if (x.t === 'str') return parseDateString(x.v) ?? parseNumber(x.v)
  return toNumber(x)
}

const formatFn: BuiltinFn = (_c, a, n) => {
  const f = opt(a, n, 1, 'Format')
  return str(formatValue(need(a, n, 0, 'Expression'), f === undefined ? undefined : toStr(f)))
}

// FormatNumber / FormatCurrency / FormatPercent (digits after the decimal point, default 2)
function numberCode(prefix: string, suffix: string): BuiltinFn {
  return (_c, a, n) => {
    const digits = optWhole(opt(a, n, 1, 'NumDigitsAfterDecimal'), 2)
    const group = opt(a, n, 4, 'GroupDigits')
    const parens = opt(a, n, 3, 'UseParensForNegativeNumbers')
    const body = `${group !== undefined && toNumber(group) === 0 ? '0' : '#,##0'}${digits > 0 ? `.${'0'.repeat(digits)}` : ''}`
    const pos = `${prefix}${body}${suffix}`
    const neg = parens !== undefined && toNumber(parens) !== 0 ? `(${pos})` : `-${pos}`
    return str(formatValue(need(a, n, 0, 'Expression'), `${pos};${neg}`))
  }
}

const DATE_TIME_FORMATS = ['General Date', 'Long Date', 'Short Date', 'Long Time', 'Short Time']

export function formatFunctions(): Table {
  return [
    ['format', fn(formatFn)],
    ['format$', fn(formatFn)],
    ['formatnumber', fn(numberCode('', ''))],
    ['formatcurrency', fn(numberCode('$', ''))],
    ['formatpercent', fn(numberCode('', '%'))],
    ['formatdatetime', fn((_c, a, n) => {
      const k = optWhole(opt(a, n, 1, 'NamedFormat'), 0)
      return str(formatValue(need(a, n, 0, 'Date'), DATE_TIME_FORMATS[k] ?? 'General Date'))
    })],
  ]
}
