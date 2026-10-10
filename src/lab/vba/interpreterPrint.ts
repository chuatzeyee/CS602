// Debug.Print: numbers get a leading sign space and a trailing space, "," moves to the next 14-column print zone,
// a trailing ";" or "," keeps the line open for the next Debug.Print.
import type { Expr, PrintItem } from './ast'
import { deref, toNumber, toStr } from './coerce'
import { VbaError, type Val } from './runtime'
import { evalExpr } from './interpreterExpr'
import type { Machine } from './interpreterTypes'

const ZONE = 14

// the column the next character goes to (0-based), on the last line of the text
const column = (line: string): number => line.length - (line.lastIndexOf('\n') + 1)
const nextZone = (line: string): string => ' '.repeat(ZONE - (column(line) % ZONE))

export function printValue(v: Val): string {
  const x = deref(v)
  switch (x.t) {
    case 'byte': case 'int': case 'long': case 'single': case 'double': case 'currency':
      return `${x.v >= 0 ? ' ' : ''}${toStr(x)} `
    case 'null': return 'Null'
    case 'empty': return ''
    case 'err': return `Error ${x.v}`
    case 'missing': return 'Error 448'
    case 'arr': throw new VbaError(13)
    default: return toStr(x)
  }
}

// Spc(n) and Tab(n) inside Debug.Print: n spaces, or move to column n (Tab alone: the next print zone)
function spacing(m: Machine, e: Expr, line: string): string | null {
  const target = e.k === 'call' ? e.target : e
  if (target.k !== 'name') return null
  const name = target.name.toLowerCase()
  if (name !== 'spc' && name !== 'tab') return null
  const args = e.k === 'call' ? e.args : []
  if (args.length === 0) return name === 'tab' ? nextZone(line) : ''
  const n = Math.max(0, Math.trunc(toNumber(evalExpr(m, args[0].value))))
  if (name === 'spc') return ' '.repeat(n)
  const col = Math.max(1, n)
  return col > column(line) ? ' '.repeat(col - 1 - column(line)) : `\n${' '.repeat(col - 1)}`
}

export function printItems(m: Machine, items: PrintItem[]): void {
  let line = m.printBuf
  for (const it of items) {
    if (it.e) {
      const gap = spacing(m, it.e, line)
      line += gap ?? printValue(evalExpr(m, it.e))
    }
    if (it.sep === ',') line += nextZone(line)
  }
  const last = items[items.length - 1]
  if (last && last.sep) {
    m.printBuf = line
    return
  }
  m.printBuf = ''
  for (const part of line.split('\n')) m.ctx.host.print(part.replace(/\s+$/, ''))
}

export function flushPrint(m: Machine): void {
  if (m.printBuf !== '') m.ctx.host.print(m.printBuf.replace(/\s+$/, ''))
  m.printBuf = ''
}
