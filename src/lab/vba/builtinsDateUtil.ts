// Date helpers shared by coerce.ts and the date built-ins. Dates are serials counted from VBA's day 0 (30 Dec 1899),
// which equals the Excel 1900 serial for every date from 1 Mar 1900 on. The fraction is the time of day.
// Locale: the lab follows Singapore conventions (day before month), like the lab sheet's own date entry.

const MS_PER_DAY = 86_400_000
const EPOCH = Date.UTC(1899, 11, 30)

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const MIN_DATE = -657434          // 1 Jan 100
export const MAX_DATE = 2958465.999988   // 31 Dec 9999 23:59:59

// two-digit years follow VBA: 0-29 -> 2000-2029, 30-99 -> 1930-1999
export function fullYear(y: number): number {
  if (y >= 0 && y < 30) return 2000 + y
  if (y >= 30 && y < 100) return 1900 + y
  return y
}

// day serial for a (possibly out-of-range) year/month/day, normalising like DateSerial
export function serialFromYMD(y: number, m: number, d: number): number {
  const dt = new Date(0)
  dt.setUTCFullYear(y, m - 1, d)
  dt.setUTCHours(0, 0, 0, 0)
  return Math.round((dt.getTime() - EPOCH) / MS_PER_DAY)
}

export interface DateParts { y: number; m: number; d: number; h: number; n: number; s: number; wd: number }

// calendar and clock parts of a serial; the time rounds to the nearest second (as VBA shows it)
export function dateParts(serial: number): DateParts {
  let day = Math.floor(serial)
  let secs = Math.round(Math.abs(serial - Math.trunc(serial)) * 86400)
  if (serial < 0 && serial !== Math.trunc(serial)) day = Math.trunc(serial)
  if (secs >= 86400) { secs -= 86400; day += 1 }
  const dt = new Date(EPOCH + day * MS_PER_DAY)
  return {
    y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
    h: Math.floor(secs / 3600), n: Math.floor((secs % 3600) / 60), s: secs % 60,
    wd: dt.getUTCDay() + 1,                                  // 1 = Sunday (vbSunday)
  }
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function validDate(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) && y >= 100 && y <= 9999
}

export function timeFraction(h: number, n: number, s: number): number {
  return (h * 3600 + n * 60 + s) / 86400
}

const pad2 = (x: number): string => String(x).padStart(2, '0')

// CStr of a Date: short date (d/m/yyyy as on the lab sheet: dd/mm/yyyy) and/or long time (h:mm:ss AM/PM)
export function formatDateValue(serial: number): string {
  const p = dateParts(serial)
  const hasDate = Math.trunc(serial) !== 0
  const hasTime = p.h !== 0 || p.n !== 0 || p.s !== 0
  const date = `${pad2(p.d)}/${pad2(p.m)}/${p.y}`
  const time = `${p.h % 12 === 0 ? 12 : p.h % 12}:${pad2(p.n)}:${pad2(p.s)} ${p.h < 12 ? 'AM' : 'PM'}`
  if (hasDate && hasTime) return `${date} ${time}`
  if (hasDate) return date
  return time
}

function monthIndex(name: string): number {
  const n = name.toLowerCase()
  if (n.length < 3) return 0
  return MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(n)) + 1
}

const TIME_RE = /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp][Mm]?)?$/

// "13:05", "1:05 PM", "00:00:01", "9 am"; null when not a time
export function parseTimeString(text: string): number | null {
  const m = TIME_RE.exec(text.trim())
  if (!m || (m[2] === undefined && !m[4])) return null
  let h = Number(m[1])
  const n = Number(m[2] ?? 0)
  const s = Number(m[3] ?? 0)
  if (m[4]) {
    if (h < 1 || h > 12) return null
    const pm = m[4][0].toLowerCase() === 'p'
    h = (h % 12) + (pm ? 12 : 0)
  }
  if (h > 23 || n > 59 || s > 59) return null
  return timeFraction(h, n, s)
}

function datePart(text: string): number | null {
  const t = text.trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return validDate(y, mo, d) ? serialFromYMD(y, mo, d) : null
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(t)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    const y = m[3].length <= 2 ? fullYear(Number(m[3])) : Number(m[3])
    if (validDate(y, b, a)) return serialFromYMD(y, b, a)             // day first (lab locale)
    if (validDate(y, a, b)) return serialFromYMD(y, a, b)             // VBA falls back to month first
    return null
  }
  m = /^(\d{1,2})[- ]([A-Za-z]+)\.?[- ](\d{2,4})$/.exec(t)             // 2 Jan 2026, 2-Jan-26
  if (m) return namedDate(Number(m[1]), m[2], m[3])
  m = /^([A-Za-z]+)\.? (\d{1,2}) (\d{2,4})$/.exec(t)                  // January 2, 2026
  if (m) return namedDate(Number(m[2]), m[1], m[3])
  return null
}

function namedDate(d: number, monthName: string, yearText: string): number | null {
  const mo = monthIndex(monthName)
  const y = yearText.length <= 2 ? fullYear(Number(yearText)) : Number(yearText)
  return mo && validDate(y, mo, d) ? serialFromYMD(y, mo, d) : null
}

// CDate / DateValue / IsDate text: a date, a time, or a date followed by a time; null when not a date
export function parseDateString(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const time = parseTimeString(t)
  if (time !== null) return time
  const date = datePart(t)
  if (date !== null) return date
  const m = /^(.*?)[ T]+(\d{1,2}:\d{1,2}(?::\d{1,2})?\s*(?:[AaPp][Mm]?)?|\d{1,2}\s*[AaPp][Mm]?)$/.exec(t)
  if (!m) return null
  const d = datePart(m[1])
  const tm = parseTimeString(m[2])
  return d !== null && tm !== null ? d + tm : null
}
