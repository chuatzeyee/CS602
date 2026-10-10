// objectsRange.ts - the Range object: one or more areas (boxes) plus a view (cells, rows or columns) that decides
// what Count, Item and For Each walk over. Member names are case-insensitive; unknown ones raise 438 with the name.
import { bool, dbl, lng, newArray, NOTHING, obj, own, str, VbaError } from './runtime'
import type { Val, VbaObject } from './runtime'
import { toStr } from './coerce'
import { arg, boxCols, boxRows, boxText, checkBox, noMember, parseAddress, sameBox, toLong } from './objectsCore'
import type { Box, RangeView, Whole, XlState } from './objectsCore'
import { addressOf, currentRegion, endBox, itemBox, offsetBox, rangeArgs, resizeBox, XL_TO_LEFT, XL_TO_RIGHT } from './objectsNav'
import { copyRange, cutRange, pasteSpecial } from './objectsPaste'
import { cellProp, fontObject, interiorObject, propAll, setStoredProp, STORED_PROPS, uniform } from './objectsFormat'
import { borderAround, bordersOf } from './objectsBorders'
import { autoFill, fillRange } from './objectsFill'
import { cellFormula, cellText, checkWritable, fromR1C1, readBox, toR1C1, writeBox } from './objectsValue'

type Fn = (r: RangeObj, args: Val[], named: Record<string, Val>) => Val

const cell = (r: number, c: number): Box => ({ r1: r, c1: c, r2: r, c2: c })

function eachCell(areas: Box[], f: (r: number, c: number) => void): void {
  for (const b of areas) for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) f(r, c)
}

function formulaArray(st: XlState, b: Box, conv: (f: string, r: number, c: number) => string): Val {
  if (b.r1 === b.r2 && b.c1 === b.c2) return str(conv(cellFormula(st, b.r1, b.c1), b.r1, b.c1))
  const a = newArray([{ lo: 1, hi: boxRows(b) }, { lo: 1, hi: boxCols(b) }], 'Variant')
  let i = 0
  for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) a.data[i++] = str(conv(cellFormula(st, r, c), r, c))
  return { t: 'arr', v: a }
}

const asIs = (f: string): string => f

const STYLE_FORMATS: Record<string, string> = {
  normal: 'General', currency: '$#,##0.00', 'currency [0]': '$#,##0', comma: '#,##0.00', 'comma [0]': '#,##0', percent: '0%',
}

const GETTERS: Record<string, Fn> = {
  value: (r) => readBox(r.st, r.box),
  value2: (r) => readBox(r.st, r.box, true),
  formula: (r) => formulaArray(r.st, r.box, asIs),
  formulalocal: (r) => formulaArray(r.st, r.box, asIs),
  formular1c1: (r) => formulaArray(r.st, r.box, toR1C1),
  text: (r) => uniform([r.box], (row, col) => str(cellText(r.st, row, col))),
  hasformula: (r) => uniform(r.areas, (row, col) => bool(r.st.host.formula(row, col).startsWith('='))),
  numberformat: (r) => uniform(r.areas, (row, col) => str(r.st.host.numberFormat(row, col))),
  numberformatlocal: (r) => uniform(r.areas, (row, col) => str(r.st.host.numberFormat(row, col))),
  font: (r) => obj(fontObject(r.st, r.areas)),
  interior: (r) => obj(interiorObject(r.st, r.areas)),
  row: (r) => lng(r.box.r1),
  column: (r) => lng(r.box.c1),
  count: (r) => lng(r.count()),
  countlarge: (r) => dbl(r.count()),
  rows: (r, args, named) => (args.length ? obj(r.item('rows', args, named)) : obj(r.with(r.areas, 'rows'))),
  columns: (r, args, named) => (args.length ? obj(r.item('cols', args, named)) : obj(r.with(r.areas, 'cols'))),
  cells: (r, args, named) => (args.length ? obj(r.item('cells', args, named)) : obj(r.with(r.areas, 'cells'))),
  item: (r, args, named) => obj(r.item(r.view, args, named)),
  range: (r, args, named) => obj(r.with(rangeArgs(r.st, args, named, r.box), 'cells')),
  offset: (r, args, named) => obj(r.with(r.areas.map((b) => offsetBox(r.st, b, args, named)), r.view, r.whole)),
  resize: (r, args, named) => obj(r.with([resizeBox(r.st, r.box, args, named)], 'cells')),
  end: (r, args, named) => obj(r.with([endBox(r.st, r.box, args, named)], 'cells')),
  currentregion: (r) => obj(r.with([currentRegion(r.st, r.box)], 'cells')),
  entirerow: (r) => obj(r.with(r.areas.map((b) => ({ r1: b.r1, c1: 1, r2: b.r2, c2: r.st.host.cols })), 'rows', 'rows')),
  entirecolumn: (r) => obj(r.with(r.areas.map((b) => ({ r1: 1, c1: b.c1, r2: r.st.host.rows, c2: b.c2 })), 'cols', 'cols')),
  address: (r, args, named) => str(addressOf(r.st, r.areas, r.whole, args, named)),
  addresslocal: (r, args, named) => str(addressOf(r.st, r.areas, r.whole, args, named)),
  areas: (r, args) => (args.length ? obj(r.areaAt(toLong(args[0]))) : obj(r.areasObject())),
  worksheet: (r) => obj(r.st.worksheet()),
  parent: (r) => obj(r.st.worksheet()),
  locked: (r) => uniform(r.areas, (row, col) => bool(r.st.extras.locked?.(row, col) ?? false)),
  select: (r) => { r.select(); return bool(true) },
  activate: (r) => { r.activate(); return bool(true) },
  copy: (r, args, named) => { copyRange(r.st, r.areas, args, named); return bool(true) },
  cut: (r, args, named) => { cutRange(r.st, r.areas, args, named); return bool(true) },
  pastespecial: (r, args, named) => { pasteSpecial(r.st, r.box, args, named); return bool(true) },
  clearcontents: (r) => { r.areas.forEach((b) => r.st.host.clear(b.r1, b.c1, b.r2, b.c2, 'contents')); return bool(true) },
  clear: (r) => { r.areas.forEach((b) => r.st.host.clear(b.r1, b.c1, b.r2, b.c2, 'all')); return bool(true) },
  clearformats: (r) => { r.areas.forEach((b) => r.st.host.clear(b.r1, b.c1, b.r2, b.c2, 'formats')); return bool(true) },
  calculate: (r) => { r.st.host.recalc(); return bool(true) },
  borders: (r, args) => obj(bordersOf(r.st, r.areas, args)),
  borderaround: (r, args, named) => { borderAround(r.st, r.areas, args, named); return bool(true) },
  style: (r) => cellProp(r.st, r.areas, 'style', str('Normal')),
  autofill: (r, args, named) => { autoFill(r.st, r.box, args, named); return bool(true) },
  filldown: (r) => { fillRange(r.st, r.box, 'down'); return bool(true) },
  fillup: (r) => { fillRange(r.st, r.box, 'up'); return bool(true) },
  fillright: (r) => { fillRange(r.st, r.box, 'right'); return bool(true) },
  fillleft: (r) => { fillRange(r.st, r.box, 'left'); return bool(true) },
  // accepted and ignored: the lab grid has fixed column widths, no merged cells and no comments
  autofit: () => bool(true),
  merge: (r) => { setStoredProp(r.st, r.areas, 'mergecells', bool(true)); return bool(true) },
  unmerge: (r) => { setStoredProp(r.st, r.areas, 'mergecells', bool(false)); return bool(true) },
  clearcomments: () => bool(true),
  clearnotes: () => bool(true),
  delete: (r, args, named) => { r.deleteCells(args, named); return bool(true) },
  insert: (r, args, named) => { r.insertCells(args, named); return bool(true) },
}

export class RangeObj implements VbaObject {
  readonly className = 'Range'
  readonly st: XlState
  readonly areas: Box[]
  readonly view: RangeView
  readonly whole: Whole

  constructor(st: XlState, areas: Box[], view: RangeView = 'cells', whole: Whole = '') {
    this.st = st
    this.areas = areas
    this.view = view
    this.whole = whole
  }

  get box(): Box { return this.areas[0] }

  with(areas: Box[], view: RangeView = 'cells', whole: Whole = ''): RangeObj {
    return new RangeObj(this.st, areas, view, whole)
  }

  count(): number {
    return this.areas.reduce((n, b) => n + (this.view === 'rows' ? boxRows(b) : this.view === 'cols' ? boxCols(b) : boxRows(b) * boxCols(b)), 0)
  }

  item(view: RangeView, args: Val[], named: Record<string, Val>): RangeObj {
    const box = itemBox(this.st, this.box, view, args, named)
    return this.with([box], view, view === 'rows' && this.whole === 'rows' ? 'rows' : view === 'cols' && this.whole === 'cols' ? 'cols' : '')
  }

  areaAt(n: number): RangeObj {
    const b = this.areas[n - 1]
    if (!b) throw new VbaError(9)
    return this.with([b])
  }

  areasObject(): VbaObject {
    const self = this
    const items = (): Val[] => self.areas.map((b) => obj(self.with([b], 'cells')))
    return {
      className: 'Areas',
      get(name, args) {
        const n = name.toLowerCase()
        if (n === 'count') return lng(self.areas.length)
        if (n === 'item') return obj(self.areaAt(args[0] ? toLong(args[0]) : 0))
        throw noMember('Areas', name)
      },
      call(name, args, named) { return this.get(name, args, named) },
      set(name) { throw noMember('Areas', name) },
      defaultGet(args) { return args.length ? this.get('Item', args, {}) : NOTHING },
      enumerate: items,
    }
  }

  // Delete [Shift]: whole rows shift up, whole columns shift left; a block follows Shift or its shape
  deleteCells(args: Val[], named: Record<string, Val>): void {
    const del = this.st.extras.deleteCells
    if (!del) throw noMember('Range', 'Delete')
    if (this.areas.length > 1) throw new VbaError(1004, 'Delete method of Range class failed: it does not work on several areas')
    const b = this.box
    const host = this.st.host
    const shiftArg = arg(args, named, 0, 'Shift')
    let shift: 'up' | 'left'
    if (this.whole === 'rows' || (b.c1 === 1 && b.c2 === host.cols)) shift = 'up'
    else if (this.whole === 'cols' || (b.r1 === 1 && b.r2 === host.rows)) shift = 'left'
    else if (shiftArg) shift = toLong(shiftArg) === XL_TO_LEFT ? 'left' : 'up'
    else shift = boxRows(b) > boxCols(b) ? 'left' : 'up'
    del(b.r1, b.c1, b.r2, b.c2, shift)
  }

  // Insert [Shift]: whole rows shift down, whole columns shift right; a block follows Shift or its shape
  insertCells(args: Val[], named: Record<string, Val>): void {
    const ins = this.st.extras.insertCells
    if (!ins) throw noMember('Range', 'Insert')
    if (this.areas.length > 1) throw new VbaError(1004, 'Insert method of Range class failed: it does not work on several areas')
    const b = this.box
    const host = this.st.host
    const shiftArg = arg(args, named, 0, 'Shift')
    let shift: 'down' | 'right'
    if (this.whole === 'rows' || (b.c1 === 1 && b.c2 === host.cols)) shift = 'down'
    else if (this.whole === 'cols' || (b.r1 === 1 && b.r2 === host.rows)) shift = 'right'
    else if (shiftArg) shift = toLong(shiftArg) === XL_TO_RIGHT ? 'right' : 'down'
    else shift = boxRows(b) > boxCols(b) ? 'right' : 'down'
    ins(b.r1, b.c1, b.r2, b.c2, shift)
  }

  select(): void {
    this.st.host.select(this.areas.map((b) => boxText(b)).join(','), boxText(cell(this.box.r1, this.box.c1)))
  }

  // inside the current selection only the active cell moves; elsewhere Activate selects the range
  activate(): void {
    const sel = this.st.host.selection()
    const b = this.box
    const inside = this.areas.length === 1 && (parseAddress(sel.range, this.st.host) ?? []).some((s) => s.r1 <= b.r1 && s.c1 <= b.c1 && s.r2 >= b.r2 && s.c2 >= b.c2)
    if (inside) this.st.host.select(sel.range, boxText(cell(b.r1, b.c1)))
    else this.select()
  }

  private member(name: string, args: Val[], named: Record<string, Val>): Val {
    const key = name.toLowerCase()
    const f = own(GETTERS, key)
    if (f) return f(this, args, named)
    const stored = own(STORED_PROPS, key)
    if (stored) return cellProp(this.st, this.areas, key, stored)
    throw noMember('Range', name)
  }

  get(name: string, args: Val[], named: Record<string, Val>): Val { return this.member(name, args, named) }

  call(name: string, args: Val[], named: Record<string, Val>): Val { return this.member(name, args, named) }

  set(name: string, args: Val[], value: Val): void {
    const key = name.toLowerCase()
    switch (key) {
      case 'value': case 'value2': case 'formula': case 'formulalocal':
        if (args.length) return this.item(this.view, args, {}).set(name, [], value)
        return this.areas.forEach((b) => writeBox(this.st, b, value))
      case 'formular1c1': {
        if (value.t === 'arr') return this.areas.forEach((b) => writeBox(this.st, b, value))
        const text = toStr(value)
        return this.areas.forEach((b) => {
          checkWritable(this.st, b)
          for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) this.st.host.setFormula(r, c, fromR1C1(text, r, c))
        })
      }
      case 'numberformat': case 'numberformatlocal': {
        const code = toStr(value)
        return eachCell(this.areas, (r, c) => this.st.host.setNumberFormat(r, c, code))
      }
      case 'style': {
        // the built-in cell styles the ribbon's Number group applies (Style = "Currency" from the $ button)
        const name = toStr(value)
        const code = own(STYLE_FORMATS, name.toLowerCase())
        if (code) eachCell(this.areas, (r, c) => this.st.host.setNumberFormat(r, c, code))
        return propAll(this.st, this.areas, 'style', str(name))
      }
      default:
        if (own(STORED_PROPS, key)) return setStoredProp(this.st, this.areas, key, value)
        const getter = own(GETTERS, key)
        if (getter) {
          // Offset(1, 0) = 5, Cells(2, 1) = x: the member gives a Range, assign its default (Value)
          const target = getter(this, args, {})
          if (target.t === 'obj' && target.v instanceof RangeObj) return target.v.defaultSet([], value)
          throw new VbaError(450, `Wrong number of arguments or invalid property assignment: Range.${name} is read-only`)
        }
        throw noMember('Range', name)
    }
  }

  defaultGet(args: Val[]): Val {
    return args.length ? obj(this.item(this.view, args, {})) : readBox(this.st, this.box)
  }

  defaultSet(args: Val[], value: Val): void {
    if (args.length) return this.item(this.view, args, {}).defaultSet([], value)
    this.areas.forEach((b) => writeBox(this.st, b, value))
  }

  enumerate(): Val[] {
    const out: Val[] = []
    for (const b of this.areas) {
      if (this.view === 'rows') for (let r = b.r1; r <= b.r2; r++) out.push(obj(this.with([{ r1: r, c1: b.c1, r2: r, c2: b.c2 }], 'rows')))
      else if (this.view === 'cols') for (let c = b.c1; c <= b.c2; c++) out.push(obj(this.with([{ r1: b.r1, c1: c, r2: b.r2, c2: c }], 'cols')))
      else for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) out.push(obj(this.with([cell(r, c)])))
    }
    return out
  }

  sameAs(other: VbaObject): boolean {
    return other instanceof RangeObj && other.areas.length === this.areas.length && other.areas.every((b, i) => sameBox(b, this.areas[i]))
  }
}

/** a Range over the given boxes, checked against the lab grid */
export function makeRange(st: XlState, areas: Box[], view: RangeView = 'cells', whole: Whole = ''): RangeObj {
  return new RangeObj(st, areas.map((b) => checkBox(st.host, b, boxText(b))), view, whole)
}
