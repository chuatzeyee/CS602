// the list a data dialog (Sort, Filter, Advanced Filter, PivotTable) works on, as in Excel: a selected block as it is,
// a single cell grown to its current region (the block bounded by blank rows and columns)
import type { LabSheet } from '../types'
import { toRef } from '../refs'
import { boxIn, currentRegionBox, isBlank, type Box } from '../tools/advFilter'
import { normRef } from './refUtil'

const isCell = (b: Box) => b.r1 === b.r2 && b.c1 === b.c2

// the range a dialog opens with; none for a blank cell with no data around it (Excel leaves the box empty)
export function startRegion(sheet: LabSheet, selection: string): Box | undefined {
  const region = currentRegionBox(sheet, normRef(selection).split(',')[0] || 'A1')
  if (!region || !isCell(region)) return region
  return isBlank(sheet.values(toRef(region.r1, region.c1))[0]?.[0]) ? undefined : region
}

// a typed or picked range: one cell stands for its current region, the way the tools read it when they run
export function listBox(sheet: LabSheet, text: string): Box | undefined {
  const b = boxIn(sheet, normRef(text), 'range')
  if (typeof b === 'string') return undefined
  return isCell(b) ? currentRegionBox(sheet, toRef(b.r1, b.c1)) ?? b : b
}
