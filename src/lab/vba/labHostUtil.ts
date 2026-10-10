// labHostUtil.ts - helpers for labHost.ts: the mock clock as an epoch for the engine, and number formats written back
// to the LabSheet in as few rectangles as possible.
import { parseRef, toRange } from '../refs'
import type { RangeBox } from '../refs'
import type { LabSheet } from '../types'

const DAY_MS = 86400000
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

/** Epoch milliseconds whose LOCAL date and time equal the Excel serial (the engine's NOW() reads local time). */
export function epochOf(serial: number): number {
  const days = Math.floor(serial)
  const secs = Math.round((serial - days) * 86400)
  const d = new Date(EXCEL_EPOCH_UTC + days * DAY_MS)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, secs).getTime()
}

/** Merge cells into rectangles: vertical runs per column, then equal runs in adjacent columns. */
export function rectangles(refs: Iterable<string>): RangeBox[] {
  const unique = new Map<string, { row: number; col: number }>()
  for (const ref of refs) {
    const p = parseRef(ref)
    unique.set(`${p.row},${p.col}`, p)
  }
  const cells = [...unique.values()].sort((a, b) => a.col - b.col || a.row - b.row)
  const runs: RangeBox[] = []
  for (const p of cells) {
    const last = runs[runs.length - 1]
    if (last && last.c1 === p.col && last.r2 + 1 === p.row) last.r2 = p.row
    else runs.push({ r1: p.row, c1: p.col, r2: p.row, c2: p.col })
  }
  const out: RangeBox[] = []
  for (const run of runs) {
    const prev = out.find((b) => b.r1 === run.r1 && b.r2 === run.r2 && b.c2 + 1 === run.c1)
    if (prev) prev.c2 = run.c2
    else out.push({ ...run })
  }
  return out
}

/** Write the run's number formats to the sheet: one setFmt per rectangle of cells that share a code. */
export function applyFormats(sheet: LabSheet, fmts: ReadonlyMap<string, string>): void {
  const groups = new Map<string, string[]>()
  for (const [ref, code] of fmts) {
    const specFmt = sheet.spec.cells?.[ref]?.fmt
    const target = code === 'General' && specFmt === undefined ? '' : code
    if ((sheet.fmt(ref) ?? '') === target) continue
    const list = groups.get(target) ?? []
    list.push(ref)
    groups.set(target, list)
  }
  for (const [code, refs] of groups) {
    for (const box of rectangles(refs)) sheet.setFmt(toRange(box), code === '' ? undefined : code)
  }
}

/** the 1004 description for a write to a locked lab cell */
export const protectedText = (ref: string): string => `The cell is protected (${ref} is locked in the lab)`

/** a VBA colour long (red + green*256 + blue*65536, as in host.styles) as a CSS colour */
export const cssColor = (vba: number): string =>
  `#${[vba & 255, (vba >> 8) & 255, (vba >> 16) & 255].map((n) => n.toString(16).padStart(2, '0')).join('')}`

/** the Excel serial of a local date and time (pass it as opts.clock to run with the real time) */
export function clockFromDate(d: Date): number {
  const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EXCEL_EPOCH_UTC) / DAY_MS)
  return days + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400
}
