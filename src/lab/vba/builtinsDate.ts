// VBA date and time functions. The clock is the host's (deterministic per run).
import { deref, toDate, toNumber, toStr } from './coerce'
import { NULL_VAL, VbaError, int, lng, str, type BuiltinFn, type Val } from './runtime'
import { fn, isNull, need, opt, optWhole, whole, type Table } from './builtinsArgs'
import {
  DAY_NAMES, MONTH_NAMES, daysInMonth, fullYear, dateParts, parseDateString, parseTimeString, serialFromYMD, timeFraction,
} from './builtinsDateUtil'

const date = (v: number): Val => {
  if (!(v >= -657434 && v < 2958466)) throw new VbaError(5)
  return { t: 'date', v }
}

// a date argument; Null gives null (the function returns Null)
function dateArg(v: Val): number | null {
  const x = deref(v)
  return x.t === 'null' ? null : toDate(x)
}

function part(get: (p: ReturnType<typeof dateParts>) => number): BuiltinFn {
  return (_c, a, n) => {
    const d = dateArg(need(a, n, 0, 'Date'))
    return d === null ? NULL_VAL : int(get(dateParts(d)))
  }
}

// weekday 1..7 counted from firstDay (vbSunday = 1 ... vbSaturday = 7; vbUseSystemDayOfWeek = 0 means Sunday)
function weekday(serial: number, firstDay: number): number {
  const fd = firstDay === 0 ? 1 : firstDay
  if (fd < 1 || fd > 7) throw new VbaError(5)
  return ((dateParts(serial).wd - fd + 7) % 7) + 1
}

function addMonths(serial: number, months: number): number {
  const p = dateParts(serial)
  const total = p.y * 12 + (p.m - 1) + months
  const y = Math.floor(total / 12), m = (total % 12 + 12) % 12 + 1
  const d = Math.min(p.d, daysInMonth(y, m))
  return serialFromYMD(y, m, d) + (serial - Math.floor(serial))
}

const UNIT_DAYS: Record<string, number> = { y: 1, d: 1, w: 1, ww: 7, h: 1 / 24, n: 1 / 1440, s: 1 / 86400 }

function dateAdd(interval: string, k: number, serial: number): number {
  switch (interval) {
    case 'yyyy': return addMonths(serial, 12 * k)
    case 'q': return addMonths(serial, 3 * k)
    case 'm': return addMonths(serial, k)
    default: {
      const unit = UNIT_DAYS[interval]
      if (unit === undefined) throw new VbaError(5)
      const r = serial + k * unit
      return interval === 'h' || interval === 'n' || interval === 's' ? Math.round(r * 86400) / 86400 : r
    }
  }
}

const secs = (serial: number): number => Math.round(serial * 86400)

function weekStart(serial: number, firstDay: number): number {
  return Math.floor(serial) - (weekday(serial, firstDay) - 1)
}

function dateDiff(interval: string, a: number, b: number, firstDay: number): number {
  const p = dateParts(a), q = dateParts(b)
  switch (interval) {
    case 'yyyy': return q.y - p.y
    case 'q': return (q.y * 4 + Math.floor((q.m - 1) / 3)) - (p.y * 4 + Math.floor((p.m - 1) / 3))
    case 'm': return (q.y * 12 + q.m) - (p.y * 12 + p.m)
    case 'y': case 'd': return Math.floor(b) - Math.floor(a)
    case 'w': return Math.trunc((Math.floor(b) - Math.floor(a)) / 7)
    case 'ww': return (weekStart(b, firstDay) - weekStart(a, firstDay)) / 7
    case 'h': return Math.floor(secs(b) / 3600) - Math.floor(secs(a) / 3600)
    case 'n': return Math.floor(secs(b) / 60) - Math.floor(secs(a) / 60)
    case 's': return secs(b) - secs(a)
    default: throw new VbaError(5)
  }
}

function datePart(interval: string, serial: number, firstDay: number): number {
  const p = dateParts(serial)
  switch (interval) {
    case 'yyyy': return p.y
    case 'q': return Math.floor((p.m - 1) / 3) + 1
    case 'm': return p.m
    case 'y': return Math.floor(serial) - serialFromYMD(p.y, 1, 1) + 1
    case 'd': return p.d
    case 'w': return weekday(serial, firstDay)
    case 'ww': return (weekStart(serial, firstDay) - weekStart(serialFromYMD(p.y, 1, 1), firstDay)) / 7 + 1
    case 'h': return p.h
    case 'n': return p.n
    case 's': return p.s
    default: throw new VbaError(5)
  }
}

const intervalArg = (v: Val): string => toStr(v).trim().toLowerCase()

const dateValueFn: BuiltinFn = (_c, a, n) => {
  const v = deref(need(a, n, 0, 'Date'))
  if (v.t === 'null') return NULL_VAL
  if (v.t === 'str') {
    const d = parseDateString(v.v)
    if (d === null) throw new VbaError(13)
    return date(Math.floor(d))
  }
  return date(Math.floor(toDate(v)))
}

const timeValueFn: BuiltinFn = (_c, a, n) => {
  const v = deref(need(a, n, 0, 'Time'))
  if (v.t === 'null') return NULL_VAL
  if (v.t === 'str') {
    const t = parseTimeString(v.v) ?? parseDateString(v.v)
    if (t === null) throw new VbaError(13)
    return date(Math.abs(t - Math.trunc(t)))
  }
  const d = toDate(v)
  return date(Math.abs(d - Math.trunc(d)))
}

export function dateFunctions(): Table {
  return [
    ['now', fn(ctx => date(ctx.host.now()))],
    ['date', fn(ctx => date(Math.floor(ctx.host.now())))],
    ['time', fn(ctx => { const t = ctx.host.now(); return date(t - Math.floor(t)) })],
    ['timer', fn(ctx => { const t = ctx.host.now(); return { t: 'single', v: Math.fround(Math.round((t - Math.floor(t)) * 86400 * 100) / 100) } })],
    ['year', fn(part(p => p.y))],
    ['month', fn(part(p => p.m))],
    ['day', fn(part(p => p.d))],
    ['hour', fn(part(p => p.h))],
    ['minute', fn(part(p => p.n))],
    ['second', fn(part(p => p.s))],
    ['weekday', fn((_c, a, n) => {
      const d = dateArg(need(a, n, 0, 'Date'))
      return d === null ? NULL_VAL : int(weekday(d, optWhole(opt(a, n, 1, 'FirstDayOfWeek'), 1)))
    })],
    ['weekdayname', fn((_c, a, n) => {
      const k = whole(need(a, n, 0, 'Weekday'))
      const abbr = opt(a, n, 1, 'Abbreviate')
      const first = optWhole(opt(a, n, 2, 'FirstDayOfWeek'), 1) || 1
      if (k < 1 || k > 7) throw new VbaError(5)
      const name = DAY_NAMES[(k - 1 + first - 1) % 7]
      return str(abbr !== undefined && toNumber(abbr) !== 0 ? name.slice(0, 3) : name)
    })],
    ['monthname', fn((_c, a, n) => {
      const k = whole(need(a, n, 0, 'Month'))
      const abbr = opt(a, n, 1, 'Abbreviate')
      if (k < 1 || k > 12) throw new VbaError(5)
      const name = MONTH_NAMES[k - 1]
      return str(abbr !== undefined && toNumber(abbr) !== 0 ? name.slice(0, 3) : name)
    })],
    ['dateserial', fn((_c, a, n) => {
      const y = fullYear(whole(need(a, n, 0, 'Year')))
      return date(serialFromYMD(y, whole(need(a, n, 1, 'Month')), whole(need(a, n, 2, 'Day'))))
    })],
    ['timeserial', fn((_c, a, n) => {
      const t = timeFraction(whole(need(a, n, 0, 'Hour')), whole(need(a, n, 1, 'Minute')), whole(need(a, n, 2, 'Second')))
      return date(t)
    })],
    ['datevalue', fn(dateValueFn)],
    ['timevalue', fn(timeValueFn)],
    ['dateadd', fn((_c, a, n) => {
      const d = dateArg(need(a, n, 2, 'Date'))
      if (d === null) return NULL_VAL
      return date(dateAdd(intervalArg(need(a, n, 0, 'Interval')), Math.trunc(toNumber(need(a, n, 1, 'Number'))), d))
    })],
    ['datediff', fn((_c, a, n) => {
      const x = need(a, n, 1, 'Date1'), y = need(a, n, 2, 'Date2')
      if (isNull(x) || isNull(y)) return NULL_VAL
      const first = optWhole(opt(a, n, 3, 'FirstDayOfWeek'), 1)
      return lng(dateDiff(intervalArg(need(a, n, 0, 'Interval')), toDate(deref(x)), toDate(deref(y)), first))
    })],
    ['datepart', fn((_c, a, n) => {
      const d = dateArg(need(a, n, 1, 'Date'))
      if (d === null) return NULL_VAL
      return int(datePart(intervalArg(need(a, n, 0, 'Interval')), d, optWhole(opt(a, n, 2, 'FirstDayOfWeek'), 1)))
    })],
  ]
}
