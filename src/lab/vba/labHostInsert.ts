// labHostInsert.ts - Range.Insert and Cut-and-paste moves for the lab host. Whole rows/columns go through the engine's addRows/addColumns (every
// formula is adjusted like Excel) and the grid keeps its size; a block moves the cells below it down (or to its right
// across). Like Excel, an insert that would push filled cells off the grid fails with 1004, and so does one that would
// move or re-point a locked cell.
import { toRef } from '../refs'
import type { LabSheet } from '../types'
import { VbaError } from './runtime'
import { protectedText } from './labHostUtil'
import { guardLocked, type DeleteBox } from './labHostDelete'

export function insertCells(sheet: LabSheet, box: DeleteBox, shift: 'down' | 'right'): void {
  const hf = sheet.hf
  const id = sheet.sheetId
  const down = shift === 'down'
  const n = down ? box.r2 - box.r1 + 1 : box.c2 - box.c1 + 1
  const area = down ? { r1: box.r1, c1: box.c1, r2: sheet.rows, c2: box.c2 } : { r1: box.r1, c1: box.c1, r2: box.r2, c2: sheet.cols }
  for (let r = area.r1; r <= area.r2; r++) {
    for (let c = area.c1; c <= area.c2; c++) {
      const ref = toRef(r - 1, c - 1)
      const pushedOff = down ? r > sheet.rows - n : c > sheet.cols - n
      if (pushedOff && !hf.isCellEmpty({ sheet: id, row: r - 1, col: c - 1 })) {
        throw new VbaError(1004, `Insert method of Range class failed: it would push ${ref} off the sheet (the lab grid ends at ${toRef(sheet.rows - 1, sheet.cols - 1)})`)
      }
      if (!sheet.editable(ref)) throw new VbaError(1004, `Insert method of Range class failed: ${protectedText(ref)}`)
    }
  }
  const snapshot = hf.getSheetSerialized(id)
  const size = (): { width: number; height: number } => hf.getSheetDimensions(id)
  if (down && box.c1 === 1 && box.c2 === sheet.cols) {
    hf.addRows(id, [box.r1 - 1, n])
    const extra = size().height - sheet.rows
    if (extra > 0) hf.removeRows(id, [sheet.rows, extra])
  } else if (!down && box.r1 === 1 && box.r2 === sheet.rows) {
    hf.addColumns(id, [box.c1 - 1, n])
    const extra = size().width - sheet.cols
    if (extra > 0) hf.removeColumns(id, [sheet.cols, extra])
  } else {
    const last = down ? { row: sheet.rows - n - 1, col: box.c2 - 1 } : { row: box.r2 - 1, col: sheet.cols - n - 1 }
    if (last.row >= box.r1 - 1 && last.col >= box.c1 - 1) {
      hf.moveCells({ start: { sheet: id, row: box.r1 - 1, col: box.c1 - 1 }, end: { sheet: id, ...last } },
        { sheet: id, row: box.r1 - 1 + (down ? n : 0), col: box.c1 - 1 + (down ? 0 : n) })
    }
  }
  guardLocked(sheet, snapshot, 'Insert', 'its formula refers to the moved cells')
}

/** Cut and paste: move the block to (row, col) through the engine, so formulas that refer to it follow it, as in Excel */
export function moveCells(sheet: LabSheet, box: DeleteBox, row: number, col: number): void {
  const hf = sheet.hf
  const id = sheet.sheetId
  const h = box.r2 - box.r1 + 1
  const w = box.c2 - box.c1 + 1
  if (row < 1 || col < 1 || row + h - 1 > sheet.rows || col + w - 1 > sheet.cols) {
    throw new VbaError(1004, 'Paste method of Worksheet class failed: the moved cells would not fit on the lab sheet')
  }
  for (const b of [box, { r1: row, c1: col, r2: row + h - 1, c2: col + w - 1 }]) {
    for (let r = b.r1; r <= b.r2; r++) {
      for (let c = b.c1; c <= b.c2; c++) {
        const ref = toRef(r - 1, c - 1)
        if (!sheet.editable(ref)) throw new VbaError(1004, `Paste method of Worksheet class failed: ${protectedText(ref)}`)
      }
    }
  }
  const snapshot = hf.getSheetSerialized(id)
  hf.moveCells({ start: { sheet: id, row: box.r1 - 1, col: box.c1 - 1 }, end: { sheet: id, row: box.r2 - 1, col: box.c2 - 1 } }, { sheet: id, row: row - 1, col: col - 1 })
  guardLocked(sheet, snapshot, 'Paste', 'its formula refers to the moved cells')
}
