// objectsFill.ts - Range.AutoFill (the fill handle, as the macro recorder writes it) and FillDown/FillRight/FillUp/
// FillLeft. Formulas are re-based like a paste. With xlFillDefault, two or more numbers extend as a linear trend and one
// date, "Item 1"-style text or a day/month name as a series; xlFillSeries also counts up from a single number;
// xlFillCopy (and anything else) repeats the source. Number formats follow the cells they come from.
import { shiftFormula } from '../refs'
import { VbaError } from './runtime'
import type { Val } from './runtime'
import { areasOf, arg, boxCols, boxRows, toLong } from './objectsCore'
import type { Box, XlState } from './objectsCore'
import { pasteBlock } from './objectsPaste'
import { checkWritable } from './objectsValue'

const DEFAULT = 0, COPY = 1, SERIES = 2, FORMATS = 3
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LISTS = [DAYS, DAYS.map(d => d.slice(0, 3)), MONTHS, MONTHS.map(m => m.slice(0, 3))]

interface Src { raw: string; value: unknown; fmt: string }
type Next = (i: number) => string | number | boolean | null   // the constant at position i of the line (0 = first source cell)

const fail = (why: string): VbaError => new VbaError(1004, `AutoFill method of Range class failed: ${why}`)
const isDateFormat = (fmt: string): boolean => /[dy]|m{3,}/i.test(fmt.replace(/"[^"]*"/g, '')) && !/general/i.test(fmt)

function listOf(text: string): [string[], number] | null {
  for (const list of LISTS) {
    const i = list.findIndex(x => x.toLowerCase() === text.toLowerCase())
    if (i >= 0) return [list, i]
  }
  return null
}

const matchCase = (model: string, word: string): string =>
  model === model.toUpperCase() ? word.toUpperCase() : model === model.toLowerCase() ? word.toLowerCase() : word

// the series a line of constants extends to, or null when the source just repeats
function seriesOf(src: Src[], type: number): Next | null {
  if (type !== DEFAULT && type !== SERIES) return null
  if (src.some(s => s.raw.startsWith('='))) return null
  const h = src.length
  if (src.every(s => typeof s.value === 'number')) {
    const ys = src.map(s => s.value as number)
    if (h === 1) {
      if (type === SERIES) return i => ys[0] + i
      return isDateFormat(src[0].fmt) ? i => ys[0] + i : null
    }
    const mx = (h - 1) / 2
    const my = ys.reduce((a, b) => a + b, 0) / h
    const sxx = ys.reduce((a, _, i) => a + (i - mx) ** 2, 0)
    const slope = ys.reduce((a, y, i) => a + (i - mx) * (y - my), 0) / sxx
    return i => my + slope * (i - mx)
  }
  if (!src.every(s => typeof s.value === 'string')) return null
  const texts = src.map(s => s.value as string)
  const listed = texts.map(listOf)
  if (listed.every(l => l && l[0] === listed[0]![0])) {
    const [list, i0] = listed[0]!
    const step = h > 1 ? listed[1]![1] - i0 : 1
    return i => matchCase(texts[0], list[(((i0 + step * i) % list.length) + list.length) % list.length])
  }
  const nums = texts.map(t => /^(.*?)(\d+)$/.exec(t))
  if (nums.every(m => m && m[1] === nums[0]![1])) {
    const [, prefix, digits] = nums[0]!
    const n0 = Number(digits)
    const step = h > 1 ? Number(nums[1]![2]) - n0 : 1
    return i => `${prefix}${String(Math.max(0, n0 + step * i)).padStart(digits.length, '0')}`
  }
  return null
}

/** Range.AutoFill Destination, [Type]: the destination holds the source and extends it in one direction */
export function autoFill(st: XlState, src: Box, args: Val[], named: Record<string, Val>): void {
  const destArg = arg(args, named, 0, 'Destination')
  const dest = destArg?.t === 'obj' ? areasOf(destArg.v)?.[0] : undefined
  if (!dest) throw new VbaError(424)
  const typeArg = arg(args, named, 1, 'Type')
  const type = typeArg ? toLong(typeArg) : DEFAULT
  const vertical = dest.c1 === src.c1 && dest.c2 === src.c2 && (dest.r1 === src.r1 || dest.r2 === src.r2)
  const horizontal = dest.r1 === src.r1 && dest.r2 === src.r2 && (dest.c1 === src.c1 || dest.c2 === src.c2)
  if (!vertical && !horizontal) throw fail('the destination must contain the source range and extend it down, up, right or left')
  const host = st.host
  // only the cells beyond the source are written (the source may be a locked given cell)
  const beyond: Box[] = vertical
    ? [{ ...dest, r2: src.r1 - 1 }, { ...dest, r1: src.r2 + 1 }]
    : [{ ...dest, c2: src.c1 - 1 }, { ...dest, c1: src.c2 + 1 }]
  beyond.filter(b => b.r1 <= b.r2 && b.c1 <= b.c2).forEach(b => checkWritable(st, b))
  const h = vertical ? boxRows(src) : boxCols(src)
  const lines = vertical ? boxCols(src) : boxRows(src)
  const first = vertical ? dest.r1 - src.r1 : dest.c1 - src.c1           // 0 when filling down/right, negative up/left
  const last = vertical ? dest.r2 - src.r1 : dest.c2 - src.c1
  // read every source line first: the engine cannot answer reads while a batch of writes is open
  const writes: (() => void)[] = []
  for (let k = 0; k < lines; k++) {
    const at = (i: number): [number, number] => (vertical ? [src.r1 + i, src.c1 + k] : [src.r1 + k, src.c1 + i])
    const cells: Src[] = Array.from({ length: h }, (_, i) => {
      const [r, c] = at(i)
      return { raw: host.formula(r, c), value: host.value(r, c), fmt: host.numberFormat(r, c) }
    })
    const series = seriesOf(cells, type)
    for (let i = first; i <= last; i++) {
      if (i >= 0 && i < h) continue
      const s = ((i % h) + h) % h
      const [r, c] = at(i)
      const from = cells[s]
      writes.push(() => {
        host.setNumberFormat(r, c, from.fmt)
        if (type === FORMATS) return
        if (from.raw.startsWith('=')) host.setFormula(r, c, shiftFormula(from.raw, vertical ? i - s : 0, vertical ? 0 : i - s))
        else if (series && type !== COPY) host.setValue(r, c, series(i))
        else host.setValue(r, c, (from.value ?? null) as string | number | boolean | null)
      })
    }
  }
  const run = (): void => writes.forEach(w => w())
  if (st.extras.batch) st.extras.batch(run)
  else run()
}

/** FillDown/FillUp/FillRight/FillLeft: copy the first (last) row or column over the rest; one row copies from above */
export function fillRange(st: XlState, b: Box, dir: 'down' | 'up' | 'right' | 'left'): void {
  const vertical = dir === 'down' || dir === 'up'
  const size = vertical ? boxRows(b) : boxCols(b)
  let src: Box
  let dest: Box
  if (size === 1) {
    const step = dir === 'down' || dir === 'right' ? -1 : 1
    src = vertical ? { ...b, r1: b.r1 + step, r2: b.r1 + step } : { ...b, c1: b.c1 + step, c2: b.c1 + step }
    dest = b
  } else if (dir === 'down') { src = { ...b, r2: b.r1 }; dest = { ...b, r1: b.r1 + 1 } }
  else if (dir === 'up') { src = { ...b, r1: b.r2 }; dest = { ...b, r2: b.r2 - 1 } }
  else if (dir === 'right') { src = { ...b, c2: b.c1 }; dest = { ...b, c1: b.c1 + 1 } }
  else { src = { ...b, c1: b.c2 }; dest = { ...b, c2: b.c2 - 1 } }
  if (src.r1 < 1 || src.c1 < 1 || src.r2 > st.host.rows || src.c2 > st.host.cols) {
    throw new VbaError(1004, `Fill${dir[0].toUpperCase()}${dir.slice(1)} method of Range class failed: there is no cell to copy from`)
  }
  pasteBlock(st, src, dest)
}
