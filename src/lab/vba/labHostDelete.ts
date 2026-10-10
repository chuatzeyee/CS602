// labHostDelete.ts - Range.Delete for the lab host: whole rows/columns go through the engine's removeRows/removeColumns
// (every formula is adjusted like Excel); other blocks are cleared and the cells beyond them moved up or left.
// Locked cells can be neither deleted nor moved, and a delete that would change a locked formula is undone.
import type { RawCellContent } from 'hyperformula'
import { toRef } from '../refs'
import type { LabSheet } from '../types'
import { VbaError } from './runtime'
import { protectedText } from './labHostUtil'

export interface DeleteBox { r1: number; c1: number; r2: number; c2: number } // 1-based, inclusive

const same = (a: RawCellContent | undefined, b: RawCellContent | undefined): boolean => (a ?? null) === (b ?? null) || (a ?? '') === (b ?? '')

export function deleteCells(sheet: LabSheet, box: DeleteBox, shift: 'up' | 'left'): void {
  const hf = sheet.hf
  const id = sheet.sheetId
  const area = shift === 'up'
    ? { r1: box.r1, c1: box.c1, r2: sheet.rows, c2: box.c2 }
    : { r1: box.r1, c1: box.c1, r2: box.r2, c2: sheet.cols }
  for (let r = area.r1; r <= area.r2; r++) {
    for (let c = area.c1; c <= area.c2; c++) {
      const ref = toRef(r - 1, c - 1)
      if (!sheet.editable(ref)) throw new VbaError(1004, `Delete method of Range class failed: ${protectedText(ref)}`)
      if (!hf.isItPossibleToSetCellContents({ sheet: id, row: r - 1, col: c - 1 })) {
        throw new VbaError(1004, `Delete method of Range class failed: ${ref} is filled by a formula that spills`)
      }
    }
  }
  const snapshot = hf.getSheetSerialized(id)
  const rowsWhole = box.c1 === 1 && box.c2 === sheet.cols
  const colsWhole = box.r1 === 1 && box.r2 === sheet.rows
  if (shift === 'up' && rowsWhole) hf.removeRows(id, [box.r1 - 1, box.r2 - box.r1 + 1])
  else if (shift === 'left' && colsWhole) hf.removeColumns(id, [box.c1 - 1, box.c2 - box.c1 + 1])
  else {
    const blank = Array.from({ length: box.r2 - box.r1 + 1 }, () => new Array<RawCellContent>(box.c2 - box.c1 + 1).fill(null))
    hf.setCellContents({ sheet: id, row: box.r1 - 1, col: box.c1 - 1 }, blank)
    const from = shift === 'up' ? { row: box.r2, col: box.c1 - 1 } : { row: box.r1 - 1, col: box.c2 }
    const to = shift === 'up' ? { row: sheet.rows - 1, col: box.c2 - 1 } : { row: box.r2 - 1, col: sheet.cols - 1 }
    if (from.row <= to.row && from.col <= to.col) {
      hf.moveCells({ start: { sheet: id, ...from }, end: { sheet: id, ...to } }, { sheet: id, row: box.r1 - 1, col: box.c1 - 1 })
    }
  }
  guardLocked(sheet, snapshot, 'Delete', 'its formula refers to the deleted cells')
}

// after a Delete or Insert: if a locked cell's content changed (a formula re-pointed), undo and fail like a protected sheet
export function guardLocked(sheet: LabSheet, snapshot: RawCellContent[][], method: string, why: string): void {
  const hf = sheet.hf
  const id = sheet.sheetId
  const after = hf.getSheetSerialized(id)
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      if (same(snapshot[r]?.[c], after[r]?.[c]) || sheet.editable(toRef(r, c))) continue
      hf.setSheetContent(id, snapshot)
      throw new VbaError(1004, `${method} method of Range class failed: ${protectedText(toRef(r, c))}; ${why}`)
    }
  }
}
