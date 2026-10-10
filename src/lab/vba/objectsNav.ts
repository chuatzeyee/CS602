// objectsNav.ts - moving around the grid: Range(...) arguments, Cells(...) items, Offset, Resize, End (Ctrl+arrow),
// CurrentRegion, Address, Intersect and Union.
import { colLetter } from '../refs'
import { VbaError } from './runtime'
import type { Val } from './runtime'
import {
  appError, arg, areasOf, boxCols, boxRows, boxText, checkBox, colArg, filled, flag, intersectBox, num, parseAddress, text, toLong,
} from './objectsCore'
import type { Box, RangeView, Whole, XlState } from './objectsCore'
import { deref } from './coerce'

export const XL_DOWN = -4121
export const XL_UP = -4162
export const XL_TO_RIGHT = -4161
export const XL_TO_LEFT = -4159
const XL_R1C1 = -4150

const shift = (b: Box, dr: number, dc: number): Box => ({ r1: b.r1 + dr, c1: b.c1 + dc, r2: b.r2 + dr, c2: b.c2 + dc })
const span = (a: Box, b: Box): Box => ({ r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1), r2: Math.max(a.r2, b.r2), c2: Math.max(a.c2, b.c2) })

// one Range(...) argument: a Range object or an address (relative to `base` for X.Range("A1"))
function areasArg(st: XlState, v: Val, base: Box | null): Box[] {
  if (v.t === 'obj') {
    const a = areasOf(v.v)
    if (a) return a
    return areasArg(st, deref(v), base)
  }
  const address = text(v)
  const parsed = parseAddress(address, st.host)
  if (!parsed) throw new VbaError(1004, `Method 'Range' of object '_Global' failed: "${address}" is not a cell address the lab understands (named ranges are not available)`)
  const moved = base ? parsed.map((b) => shift(b, base.r1 - 1, base.c1 - 1)) : parsed
  return moved.map((b) => checkBox(st.host, b, `Range("${address}")`))
}

/** Range(Cell1 [, Cell2]) globally or relative to `base` */
export function rangeArgs(st: XlState, args: Val[], named: Record<string, Val>, base: Box | null = null): Box[] {
  const a = arg(args, named, 0, 'Cell1')
  if (!a) throw new VbaError(449)
  const first = areasArg(st, a, base)
  const b = arg(args, named, 1, 'Cell2')
  if (!b) return first
  const second = areasArg(st, b, base)
  return [span(first.reduce(span), second.reduce(span))]
}

/** Item(i[, j]) on a range: cells count from its top-left (and may leave it), rows/columns count within the view */
// "2:3" (rows) or "B:C" (columns) as 1-based positions; null when the text is a single index
function spanOf(text: string, view: RangeView): [number, number] | null {
  const m = view === 'rows' ? /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(text) : /^\s*([A-Za-z]{1,3})\s*:\s*([A-Za-z]{1,3})\s*$/.exec(text)
  if (!m) return null
  const n = (t: string): number => (view === 'rows' ? Number(t) : [...t.toUpperCase()].reduce((x, ch) => x * 26 + ch.charCodeAt(0) - 64, 0))
  const [p, q] = [n(m[1]), n(m[2])]
  return p <= q ? [p, q] : [q, p]
}

export function itemBox(st: XlState, area: Box, view: RangeView, args: Val[], named: Record<string, Val>): Box {
  const a = arg(args, named, 0, 'RowIndex')
  if (!a) throw new VbaError(449)
  const b = arg(args, named, 1, 'ColumnIndex')
  let box: Box
  const span = view !== 'cells' && a.t === 'str' ? spanOf(a.v, view) : null   // Rows("1:2"), Columns("A:B"), relative
  if (span) {
    box = view === 'rows'
      ? { r1: area.r1 + span[0] - 1, c1: area.c1, r2: area.r1 + span[1] - 1, c2: area.c2 }
      : { r1: area.r1, c1: area.c1 + span[0] - 1, r2: area.r2, c2: area.c1 + span[1] - 1 }
  } else if (view === 'rows') {
    const n = toLong(a)
    box = { r1: area.r1 + n - 1, c1: area.c1, r2: area.r1 + n - 1, c2: area.c2 }
  } else if (view === 'cols') {
    const n = colArg(a)
    box = { r1: area.r1, c1: area.c1 + n - 1, r2: area.r2, c2: area.c1 + n - 1 }
  } else if (b) {
    const r = area.r1 + toLong(a) - 1
    const c = area.c1 + colArg(b) - 1
    box = { r1: r, c1: c, r2: r, c2: c }
  } else {
    const n = toLong(a)
    const w = boxCols(area)
    const r = area.r1 + Math.floor((n - 1) / w)
    const c = area.c1 + ((((n - 1) % w) + w) % w)
    box = { r1: r, c1: c, r2: r, c2: c }
  }
  return checkBox(st.host, box, view === 'cells' ? boxText(box) : `${view === 'rows' ? 'Row' : 'Column'} ${view === 'rows' ? box.r1 : box.c1}`)
}

export function offsetBox(st: XlState, b: Box, args: Val[], named: Record<string, Val>): Box {
  const dr = num(arg(args, named, 0, 'RowOffset'), 0)
  const dc = num(arg(args, named, 1, 'ColumnOffset'), 0)
  const moved = shift(b, dr, dc)
  return checkBox(st.host, moved, `Offset(${dr}, ${dc}) from ${boxText(b)}, which is ${boxText(moved)},`)
}

export function resizeBox(st: XlState, b: Box, args: Val[], named: Record<string, Val>): Box {
  const h = num(arg(args, named, 0, 'RowSize'), boxRows(b))
  const w = num(arg(args, named, 1, 'ColumnSize'), boxCols(b))
  if (h < 1 || w < 1) throw appError(`Resize(${h}, ${w}) needs at least one row and one column`)
  const sized = { r1: b.r1, c1: b.c1, r2: b.r1 + h - 1, c2: b.c1 + w - 1 }
  return checkBox(st.host, sized, `Resize(${h}, ${w}) from ${boxText(b)}`)
}

/** Ctrl+arrow from the top-left cell: filled run -> its last cell; else the next filled cell; else the sheet edge */
export function endBox(st: XlState, b: Box, args: Val[], named: Record<string, Val>): Box {
  const d = arg(args, named, 0, 'Direction')
  if (!d) throw new VbaError(449)
  const dir = toLong(d)
  const step = dir === XL_DOWN ? [1, 0] : dir === XL_UP ? [-1, 0] : dir === XL_TO_RIGHT ? [0, 1] : dir === XL_TO_LEFT ? [0, -1] : null
  if (!step) throw new VbaError(1004, 'End method of Range class failed: use xlDown, xlUp, xlToRight or xlToLeft')
  const [dr, dc] = step
  const host = st.host
  const on = (r: number, c: number): boolean => r >= 1 && c >= 1 && r <= host.rows && c <= host.cols
  let r = b.r1
  let c = b.c1
  if (!on(r + dr, c + dc)) return { r1: r, c1: c, r2: r, c2: c }
  if (filled(host, r, c) && filled(host, r + dr, c + dc)) {
    while (on(r + dr, c + dc) && filled(host, r + dr, c + dc)) { r += dr; c += dc }
  } else {
    r += dr
    c += dc
    while (!filled(host, r, c) && on(r + dr, c + dc)) { r += dr; c += dc }
  }
  return { r1: r, c1: c, r2: r, c2: c }
}

/** the block of filled cells around b, bounded by blank rows and columns (Ctrl+*) */
export function currentRegion(st: XlState, b: Box): Box {
  const host = st.host
  const any = (r1: number, c1: number, r2: number, c2: number): boolean => {
    for (let r = Math.max(1, r1); r <= Math.min(host.rows, r2); r++) {
      for (let c = Math.max(1, c1); c <= Math.min(host.cols, c2); c++) if (filled(host, r, c)) return true
    }
    return false
  }
  const box = { ...b }
  for (let grew = true; grew;) {
    grew = false
    if (box.r1 > 1 && any(box.r1 - 1, box.c1 - 1, box.r1 - 1, box.c2 + 1)) { box.r1 -= 1; grew = true }
    if (box.r2 < host.rows && any(box.r2 + 1, box.c1 - 1, box.r2 + 1, box.c2 + 1)) { box.r2 += 1; grew = true }
    if (box.c1 > 1 && any(box.r1, box.c1 - 1, box.r2, box.c1 - 1)) { box.c1 -= 1; grew = true }
    if (box.c2 < host.cols && any(box.r1, box.c2 + 1, box.r2, box.c2 + 1)) { box.c2 += 1; grew = true }
  }
  return box
}

/** Address(RowAbsolute, ColumnAbsolute, ReferenceStyle, External, RelativeTo) */
export function addressOf(st: XlState, areas: Box[], whole: Whole, args: Val[], named: Record<string, Val>): string {
  const absRow = flag(arg(args, named, 0, 'RowAbsolute'), true)
  const absCol = flag(arg(args, named, 1, 'ColumnAbsolute'), true)
  const style = num(arg(args, named, 2, 'ReferenceStyle'), 1)
  const external = flag(arg(args, named, 3, 'External'), false)
  const rel = arg(args, named, 4, 'RelativeTo')
  const relBox = rel && rel.t === 'obj' ? areasOf(rel.v)?.[0] : undefined
  const origin = relBox ?? { r1: 1, c1: 1, r2: 1, c2: 1 }
  const r1c1 = (r: number, c: number): string =>
    `${absRow ? `R${r}` : r === origin.r1 ? 'R' : `R[${r - origin.r1}]`}${absCol ? `C${c}` : c === origin.c1 ? 'C' : `C[${c - origin.c1}]`}`
  const one = (b: Box): string => {
    if (style === XL_R1C1) return b.r1 === b.r2 && b.c1 === b.c2 ? r1c1(b.r1, b.c1) : `${r1c1(b.r1, b.c1)}:${r1c1(b.r2, b.c2)}`
    if (whole === 'rows') return `${absRow ? '$' : ''}${b.r1}:${absRow ? '$' : ''}${b.r2}`
    if (whole === 'cols') return `${absCol ? '$' : ''}${colLetter(b.c1 - 1)}:${absCol ? '$' : ''}${colLetter(b.c2 - 1)}`
    return boxText(b, absRow, absCol)
  }
  const out = areas.map(one).join(',')
  return external ? `[ExcelLab.xlsm]${st.host.sheetName}!${out}` : out
}

/** Intersect(r1, r2, ...): the overlap of every argument, null when there is none */
export function intersectAreas(lists: Box[][]): Box[] | null {
  let acc = lists[0] ?? []
  for (const next of lists.slice(1)) {
    const out: Box[] = []
    for (const a of acc) for (const b of next) {
      const x = intersectBox(a, b)
      if (x) out.push(x)
    }
    acc = out
  }
  return acc.length ? acc : null
}

/** the Range arguments of Intersect/Union (Nothing is error 424 like Excel's "Object required") */
export function rangeList(args: Val[]): Box[][] {
  return args.filter((a) => a.t !== 'missing').map((a) => {
    if (a.t !== 'obj' || !a.v) throw new VbaError(424)
    const areas = areasOf(a.v)
    if (!areas) throw new VbaError(13)
    return areas
  })
}
