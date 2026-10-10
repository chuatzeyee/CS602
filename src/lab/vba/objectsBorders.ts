// objectsBorders.ts - Range.Borders(edge), Range.Borders (all edges) and Range.BorderAround. The lab grid does not draw
// borders, so the settings are stored per cell and edge: a macro (or the code the recorder writes for every border
// button) runs and can read them back.
import { dbl, lng, obj } from './runtime'
import type { Val, VbaObject } from './runtime'
import { arg, toLong } from './objectsCore'
import type { Box, XlState } from './objectsCore'
import { cellProp, keepAs, makeObject, propAll } from './objectsFormat'

const ALL_EDGES = [7, 8, 9, 10, 11, 12]   // xlEdgeLeft .. xlInsideHorizontal (Borders without an index)
const AROUND = [7, 8, 9, 10]
const DEFAULTS: Record<string, Val> = {
  linestyle: lng(-4142), weight: lng(2), color: dbl(0), colorindex: lng(-4105), tintandshade: dbl(0), themecolor: lng(0),
}

type Getter = (args: Val[], named: Record<string, Val>) => Val
type Setter = (value: Val, args: Val[]) => void

// the cells and per-cell edge that a range's border index means: xlEdgeBottom is the bottom edge of the last row,
// xlInsideHorizontal the bottom edges of every row but the last, and so on (diagonals belong to every cell)
function edgeCells(areas: Box[], edge: number): [Box[], number] {
  const pick = (f: (b: Box) => Box | null): Box[] => areas.map(f).filter((b): b is Box => b !== null)
  switch (edge) {
    case 7: return [pick(b => ({ ...b, c2: b.c1 })), 7]
    case 8: return [pick(b => ({ ...b, r2: b.r1 })), 8]
    case 9: return [pick(b => ({ ...b, r1: b.r2 })), 9]
    case 10: return [pick(b => ({ ...b, c1: b.c2 })), 10]
    case 11: return [pick(b => (b.c2 > b.c1 ? { ...b, c2: b.c2 - 1 } : null)), 10]
    case 12: return [pick(b => (b.r2 > b.r1 ? { ...b, r2: b.r2 - 1 } : null)), 9]
    default: return [areas, edge]
  }
}

function edgeMembers(st: XlState, areas: Box[], edges: number[]): [Record<string, Getter>, Record<string, Setter>] {
  const get: Record<string, Getter> = {}
  const set: Record<string, Setter> = {}
  for (const [key, def] of Object.entries(DEFAULTS)) {
    get[key] = () => {
      const [cells, e] = edgeCells(areas, edges[0])
      return cells.length ? cellProp(st, cells, `border.${e}.${key}`, def) : def
    }
    set[key] = (v) => edges.forEach(edge => {
      const [cells, e] = edgeCells(areas, edge)
      if (cells.length) propAll(st, cells, `border.${e}.${key}`, keepAs(def, v))
    })
  }
  return [get, set]
}

/** Range.Borders(index) is one edge; Range.Borders without an index sets every edge at once */
export function bordersOf(st: XlState, areas: Box[], args: Val[]): VbaObject {
  if (args.length) {
    const [get, set] = edgeMembers(st, areas, [toLong(args[0])])
    return makeObject('Border', get, set)
  }
  const [get, set] = edgeMembers(st, areas, ALL_EDGES)
  get.item = (a) => obj(bordersOf(st, areas, a.slice(0, 1)))
  get.count = () => lng(ALL_EDGES.length)
  return makeObject('Borders', get, set, { defaultGet: (a) => (a.length ? obj(bordersOf(st, areas, a.slice(0, 1))) : obj(bordersOf(st, areas, []))) })
}

/** Range.BorderAround([LineStyle], [Weight], [ColorIndex], [Color]) */
export function borderAround(st: XlState, areas: Box[], args: Val[], named: Record<string, Val>): void {
  const [, set] = edgeMembers(st, areas, AROUND)
  set.linestyle(arg(args, named, 0, 'LineStyle') ?? lng(1), [])
  set.weight(arg(args, named, 1, 'Weight') ?? lng(2), [])
  const index = arg(args, named, 2, 'ColorIndex')
  if (index) set.colorindex(index, [])
  const color = arg(args, named, 3, 'Color')
  if (color) set.color(color, [])
}
