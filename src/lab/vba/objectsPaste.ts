// objectsPaste.ts - Range.Copy [Destination], Range.PasteSpecial (Paste, Operation, SkipBlanks, Transpose) and
// Worksheet.Paste. The clipboard holds the copied box; its content is read at paste time, like Excel's marching ants.
// Formulas are re-based with shiftFormula, values pasted exactly, number formats and styles copied on request.
import { shiftFormula } from '../refs'
import type { CellValue } from '../types'
import { VbaError } from './runtime'
import type { CellStyle, Val } from './runtime'
import { appError, areasOf, arg, boxCols, boxRows, boxText, checkBox, flag, num, XL_NONE } from './objectsCore'
import type { Box, XlState } from './objectsCore'
import { checkWritable } from './objectsValue'

type What = 'all' | 'values' | 'formulas' | 'formats' | 'valuesFormats' | 'formulasFormats' | 'nothing'

const PASTE_TYPES: Record<number, What> = {
  [-4104]: 'all', 7: 'all', 13: 'all', 14: 'all',
  [-4163]: 'values', [-4123]: 'formulas', [-4122]: 'formats',
  12: 'valuesFormats', 11: 'formulasFormats',
  8: 'nothing', [-4144]: 'nothing', 6: 'nothing',
}

interface Snap { raw: string; value: CellValue; fmt: string; style: CellStyle; blank: boolean }

export interface PasteOptions { what: What; op: number; skipBlanks: boolean; transpose: boolean }

const ALL: PasteOptions = { what: 'all', op: XL_NONE, skipBlanks: false, transpose: false }

function combine(op: number, dest: CellValue, src: CellValue): CellValue {
  const isNum = (v: CellValue): boolean => v === null || typeof v === 'number'
  if (op === XL_NONE || op === 0 || !isNum(src) || !isNum(dest)) return src
  const a = (dest as number | null) ?? 0
  const b = (src as number | null) ?? 0
  switch (op) {
    case 2: return a + b
    case 3: return a - b
    case 4: return a * b
    case 5: return b === 0 ? '#DIV/0!' : a / b
    default: throw new VbaError(1004, 'PasteSpecial method of Range class failed: unknown Operation')
  }
}

/** paste box `src` at `dest` (one block at its top-left, or tiled when dest is a whole multiple); returns the pasted box */
export function pasteBlock(st: XlState, src: Box, dest: Box, o: PasteOptions = ALL): Box {
  const host = st.host
  const h = boxRows(src)
  const w = boxCols(src)
  const th = o.transpose ? w : h
  const tw = o.transpose ? h : w
  const dh = boxRows(dest)
  const dw = boxCols(dest)
  const tiles = dh % th === 0 && dw % tw === 0 ? [dh / th, dw / tw] : [1, 1]
  const target = checkBox(host, { r1: dest.r1, c1: dest.c1, r2: dest.r1 + th * tiles[0] - 1, c2: dest.c1 + tw * tiles[1] - 1 }, 'The paste area')
  if (o.what === 'nothing') return target
  const contents = o.what !== 'formats'
  const formats = o.what === 'all' || o.what === 'formats' || o.what === 'valuesFormats' || o.what === 'formulasFormats'
  if (contents) checkWritable(st, target)
  const snap: Snap[][] = []
  for (let i = 0; i < h; i++) {
    const line: Snap[] = []
    for (let j = 0; j < w; j++) {
      const r = src.r1 + i
      const c = src.c1 + j
      const raw = host.formula(r, c)
      const value = host.value(r, c)
      line.push({ raw, value, fmt: host.numberFormat(r, c), style: host.style(r, c), blank: raw === '' && value === null })
    }
    snap.push(line)
  }
  const destValues = new Map<string, CellValue>()
  if (o.op !== XL_NONE && o.op !== 0) {
    for (let r = target.r1; r <= target.r2; r++) for (let c = target.c1; c <= target.c2; c++) destValues.set(`${r},${c}`, host.value(r, c))
  }
  const run = (): void => {
    for (let ti = 0; ti < tiles[0]; ti++) {
      for (let tj = 0; tj < tiles[1]; tj++) {
        for (let i = 0; i < h; i++) {
          for (let j = 0; j < w; j++) {
            const s = snap[i][j]
            if (o.skipBlanks && s.blank) continue
            const r = target.r1 + ti * th + (o.transpose ? j : i)
            const c = target.c1 + tj * tw + (o.transpose ? i : j)
            if (contents) pasteContent(st, s, r, c, src.r1 + i, src.c1 + j, o, destValues.get(`${r},${c}`) ?? null)
            if (formats) {
              host.setNumberFormat(r, c, s.fmt)
              if (o.what === 'all' || o.what === 'formats') host.setStyle(r, c, { bold: false, italic: false, fontColor: undefined, fill: undefined, ...s.style })
            }
          }
        }
      }
    }
  }
  if (st.extras.batch) st.extras.batch(run)
  else run()
  return target
}

function pasteContent(st: XlState, s: Snap, r: number, c: number, sr: number, sc: number, o: PasteOptions, dest: CellValue): void {
  const host = st.host
  const asFormula = (o.what === 'all' || o.what === 'formulas' || o.what === 'formulasFormats') && s.raw.startsWith('=')
  if (asFormula) {
    host.setFormula(r, c, shiftFormula(s.raw, r - sr, c - sc))
    return
  }
  const v = combine(o.op, dest, s.value)
  host.setValue(r, c, v)
}

export function pasteOptions(args: Val[], named: Record<string, Val>): PasteOptions {
  const type = num(arg(args, named, 0, 'Paste'), -4104)
  const what = PASTE_TYPES[type]
  if (!what) throw new VbaError(1004, `PasteSpecial method of Range class failed: Paste:=${type} is not a paste type the lab knows`)
  return {
    what,
    op: num(arg(args, named, 1, 'Operation'), XL_NONE),
    skipBlanks: flag(arg(args, named, 2, 'SkipBlanks'), false),
    transpose: flag(arg(args, named, 3, 'Transpose'), false),
  }
}

/** Range.PasteSpecial: needs a Copy first; selects the pasted cells like Excel */
export function pasteSpecial(st: XlState, dest: Box, args: Val[], named: Record<string, Val>): void {
  if (!st.clip) throw new VbaError(1004, 'PasteSpecial method of Range class failed: nothing has been copied (use .Copy first; CutCopyMode = False empties the clipboard)')
  if (st.clipCut) throw new VbaError(1004, 'PasteSpecial method of Range class failed: cut cells can only be pasted with ActiveSheet.Paste')
  const pasted = pasteBlock(st, st.clip, dest, pasteOptions(args, named))
  st.host.select(boxText(pasted), boxText({ r1: pasted.r1, c1: pasted.c1, r2: pasted.r1, c2: pasted.c1 }))
}

/** Range.Copy [Destination] */
export function copyRange(st: XlState, areas: Box[], args: Val[], named: Record<string, Val>): void {
  if (areas.length > 1) throw appError('Copy does not work on a range of several areas')
  const dest = arg(args, named, 0, 'Destination')
  if (!dest) {
    st.clip = areas[0]
    st.clipCut = false
    return
  }
  const box = dest.t === 'obj' ? areasOf(dest.v)?.[0] : undefined
  if (!box) throw new VbaError(424)
  pasteBlock(st, areas[0], box)
}

/** move a block to the top-left of `dest` (Cut + Paste): through the engine when the host can, else copy and clear */
export function moveBlock(st: XlState, src: Box, dest: Box): Box {
  const target = checkBox(st.host, { r1: dest.r1, c1: dest.c1, r2: dest.r1 + boxRows(src) - 1, c2: dest.c1 + boxCols(src) - 1 }, 'The paste area')
  if (st.extras.moveCells) {
    st.extras.moveCells(src.r1, src.c1, src.r2, src.c2, target.r1, target.c1)
    return target
  }
  checkWritable(st, src)
  pasteBlock(st, src, target)
  for (let r = src.r1; r <= src.r2; r++) {
    for (let c = src.c1; c <= src.c2; c++) {
      const inside = r >= target.r1 && r <= target.r2 && c >= target.c1 && c <= target.c2
      if (!inside) st.host.clear(r, c, r, c, 'all')
    }
  }
  return target
}

/** Range.Cut [Destination]: with a destination the cells move at once; without one the next ActiveSheet.Paste moves them */
export function cutRange(st: XlState, areas: Box[], args: Val[], named: Record<string, Val>): void {
  if (areas.length > 1) throw appError('Cut does not work on a range of several areas')
  const dest = arg(args, named, 0, 'Destination')
  if (!dest) {
    st.clip = areas[0]
    st.clipCut = true
    return
  }
  const box = dest.t === 'obj' ? areasOf(dest.v)?.[0] : undefined
  if (!box) throw new VbaError(424)
  moveBlock(st, areas[0], box)
}
