// objectsFormat.ts - a small member-table object helper, plus Range.Font and Range.Interior over the host's style
// map. Colours are VBA colour longs (red + green*256 + blue*65536); ColorIndex uses Excel's default 56-colour palette.
import { bool, dbl, lng, NULL_VAL, own, str, VbaError } from './runtime'
import type { CellStyle, Val, VbaObject } from './runtime'
import { toBool, toNumber, toStr } from './coerce'
import { cellRef, noMember, XL_NONE } from './objectsCore'
import type { Box, XlState } from './objectsCore'

type Getter = (args: Val[], named: Record<string, Val>) => Val
type Setter = (value: Val, args: Val[]) => void

/** an object from member tables (keys in lower case); unknown members raise 438 with the member name */
export function makeObject(className: string, get: Record<string, Getter>, set: Record<string, Setter> = {}, extra: Partial<VbaObject> = {}): VbaObject {
  const read = (name: string, args: Val[], named: Record<string, Val>): Val => {
    const f = own(get, name.toLowerCase())
    if (!f) throw noMember(className, name)
    return f(args, named)
  }
  return {
    className,
    get: read,
    call: read,
    set(name, args, value) {
      const f = own(set, name.toLowerCase())
      if (f) return f(value, args)
      if (own(get, name.toLowerCase())) throw new VbaError(450, `Wrong number of arguments or invalid property assignment: ${className}.${name} is read-only`)
      throw noMember(className, name)
    },
    ...extra,
  }
}

const HEX = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '800000', '008000', '000080', '808000',
  '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99',
  '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99', '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
]
/** PALETTE[i - 1] is the colour of ColorIndex i */
export const PALETTE: readonly number[] = HEX.map((h) => parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) * 256 + parseInt(h.slice(4, 6), 16) * 65536)

const rgbOf = (c: number): [number, number, number] => [c & 255, (c >> 8) & 255, (c >> 16) & 255]

export function nearestIndex(color: number): number {
  const [r, g, b] = rgbOf(color)
  let best = 1
  let bestD = Infinity
  PALETTE.forEach((p, i) => {
    const [pr, pg, pb] = rgbOf(p)
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
    if (d < bestD) { bestD = d; best = i + 1 }
  })
  return best
}

// a colour long; the macro recorder writes some colours as negative 32-bit values (red font: -16776961), which Excel
// reads through their low 24 bits
function colorArg(v: Val): number {
  const n = Math.round(toNumber(v))
  if (n < 0 && n >= -2147483648) return n & 0xffffff
  if (n < 0 || n > 16777215) throw new VbaError(1004, 'Unable to set the Color property: use RGB(r, g, b) or a vb colour constant')
  return n
}

// members the macro recorder writes into every Font / Interior With block: stored so they read back, not drawn
const FONT_EXTRAS: Record<string, Val> = {
  superscript: bool(false), subscript: bool(false), outlinefont: bool(false), shadow: bool(false),
  themecolor: lng(2), tintandshade: dbl(0), themefont: lng(2),
}
const INTERIOR_EXTRAS: Record<string, Val> = {
  patterncolorindex: lng(-4105), tintandshade: dbl(0), patterntintandshade: dbl(0), themecolor: lng(0),
  patterncolor: dbl(0), patternthemecolor: lng(0),
}
export const keepAs = (def: Val, v: Val): Val => (def.t === 'bool' ? bool(toBool(v)) : def.t === 'double' ? dbl(toNumber(v)) : lng(Math.round(toNumber(v))))

function withExtras(get: Record<string, Getter>, set: Record<string, Setter>, extras: Record<string, Val>, st: XlState, areas: Box[], prefix: string): void {
  for (const [key, def] of Object.entries(extras)) {
    get[key] ??= () => cellProp(st, areas, `${prefix}.${key}`, def)
    set[key] ??= (v) => propAll(st, areas, `${prefix}.${key}`, keepAs(def, v))
  }
}

function* cells(areas: Box[]): Generator<[number, number]> {
  for (const b of areas) for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) yield [r, c]
}

/** the same value for every cell, else Null (Excel's answer for mixed formatting) */
export function uniform(areas: Box[], read: (row: number, col: number) => Val): Val {
  let first: Val | undefined
  for (const [r, c] of cells(areas)) {
    const v = read(r, c)
    if (!first) first = v
    else if (first.t !== v.t || ('v' in first && 'v' in v && first.v !== v.v)) return NULL_VAL
  }
  return first ?? NULL_VAL
}

function styleAll(st: XlState, areas: Box[], patch: CellStyle): void {
  for (const [r, c] of cells(areas)) st.host.setStyle(r, c, patch)
}

export function propAll(st: XlState, areas: Box[], key: string, value: Val): void {
  for (const [r, c] of cells(areas)) st.cellProps.set(`${cellRef(r, c)}|${key}`, value)
}

export function cellProp(st: XlState, areas: Box[], key: string, def: Val): Val {
  return uniform(areas, (r, c) => st.cellProps.get(`${cellRef(r, c)}|${key}`) ?? def)
}

export function fontObject(st: XlState, areas: Box[]): VbaObject {
  const style = (r: number, c: number): CellStyle => st.host.style(r, c)
  const prop = (key: string, def: Val): Getter => () => cellProp(st, areas, `font.${key}`, def)
  const keep = (key: string, conv: (v: Val) => Val): Setter => (v) => propAll(st, areas, `font.${key}`, conv(v))
  const get: Record<string, Getter> = {
    bold: () => uniform(areas, (r, c) => bool(style(r, c).bold ?? false)),
    italic: () => uniform(areas, (r, c) => bool(style(r, c).italic ?? false)),
    color: () => uniform(areas, (r, c) => dbl(style(r, c).fontColor ?? 0)),
    colorindex: () => uniform(areas, (r, c) => {
      const col = style(r, c).fontColor
      return lng(col === undefined ? -4105 : nearestIndex(col))
    }),
    size: prop('size', dbl(11)),
    name: prop('name', str('Calibri')),
    underline: prop('underline', lng(XL_NONE)),
    strikethrough: prop('strikethrough', bool(false)),
    fontstyle: () => uniform(areas, (r, c) => {
      const s = style(r, c)
      return str(s.bold && s.italic ? 'Bold Italic' : s.bold ? 'Bold' : s.italic ? 'Italic' : 'Regular')
    }),
  }
  const set: Record<string, Setter> = {
    bold: (v) => styleAll(st, areas, { bold: toBool(v) }),
    italic: (v) => styleAll(st, areas, { italic: toBool(v) }),
    color: (v) => styleAll(st, areas, { fontColor: colorArg(v) }),
    colorindex: (v) => {
      const i = Math.round(toNumber(v))
      if (i === -4105 || i === XL_NONE) return styleAll(st, areas, { fontColor: undefined })
      if (i < 1 || i > 56) throw new VbaError(1004, 'Unable to set the ColorIndex property of the Font class (use 1 to 56)')
      styleAll(st, areas, { fontColor: PALETTE[i - 1] })
    },
    size: keep('size', (v) => dbl(toNumber(v))),
    name: keep('name', (v) => str(toStr(v))),
    underline: keep('underline', (v) => (v.t === 'bool' ? lng(v.v ? 2 : XL_NONE) : lng(Math.round(toNumber(v))))),
    strikethrough: keep('strikethrough', (v) => bool(toBool(v))),
    fontstyle: (v) => {
      const t = toStr(v).toLowerCase()
      styleAll(st, areas, { bold: t.includes('bold'), italic: t.includes('italic') || t.includes('oblique') })
    },
  }
  withExtras(get, set, FONT_EXTRAS, st, areas, 'font')
  return makeObject('Font', get, set)
}

export function interiorObject(st: XlState, areas: Box[]): VbaObject {
  const fill = (r: number, c: number): number | undefined => st.host.style(r, c).fill
  const setIndex = (v: Val): void => {
    const i = Math.round(toNumber(v))
    if (i === XL_NONE || i === -4105) return styleAll(st, areas, { fill: undefined })
    if (i < 1 || i > 56) throw new VbaError(1004, 'Unable to set the ColorIndex property of the Interior class (use 1 to 56 or xlNone)')
    styleAll(st, areas, { fill: PALETTE[i - 1] })
  }
  const get: Record<string, Getter> = {
    color: () => uniform(areas, (r, c) => dbl(fill(r, c) ?? 16777215)),
    colorindex: () => uniform(areas, (r, c) => {
      const f = fill(r, c)
      return lng(f === undefined ? XL_NONE : nearestIndex(f))
    }),
    pattern: () => uniform(areas, (r, c) => lng(fill(r, c) === undefined ? XL_NONE : 1)),
  }
  const set: Record<string, Setter> = {
    color: (v) => styleAll(st, areas, { fill: colorArg(v) }),
    colorindex: setIndex,
    pattern: (v) => {
      if (Math.round(toNumber(v)) === XL_NONE) styleAll(st, areas, { fill: undefined })
    },
  }
  withExtras(get, set, INTERIOR_EXTRAS, st, areas, 'interior')
  return makeObject('Interior', get, set)
}

/** HorizontalAlignment, WrapText, ColumnWidth ...: kept per cell so a macro can set and read them back */
export const STORED_PROPS: Record<string, Val> = {
  horizontalalignment: lng(1),
  verticalalignment: lng(-4107),
  wraptext: bool(false),
  columnwidth: dbl(8.43),
  rowheight: dbl(15),
  indentlevel: lng(0),
  orientation: lng(-4128),
  shrinktofit: bool(false),
  addindent: bool(false),
  readingorder: lng(-5002),
  mergecells: bool(false),
}

export function setStoredProp(st: XlState, areas: Box[], key: string, value: Val): void {
  const def = STORED_PROPS[key]
  const v = def.t === 'bool' ? bool(toBool(value)) : def.t === 'double' ? dbl(toNumber(value)) : lng(Math.round(toNumber(value)))
  propAll(st, areas, key, v)
}
