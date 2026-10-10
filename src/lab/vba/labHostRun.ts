// labHostRun.ts - the end of a run: diff the engine against the snapshot taken when the host was created, put the
// engine back, then write the net change through the LabSheet (number formats first, then every cell as ONE
// writeCells step, so the first Undo takes the macro's values away). Typed entries ('12%') carry their own format.
import type { RawCellContent, SimpleCellAddress } from 'hyperformula'
import { writeCells } from '../sheet'
import { parseInput } from '../engine/input'
import { toRef } from '../refs'
import type { EditResult, LabSheet } from '../types'
import { applyFormats } from './labHostUtil'

const sameContent = (a: RawCellContent, b: RawCellContent): boolean =>
  (a ?? '') === (b ?? '') || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())

export interface RunDiff { entries: Record<string, string>; restore: [SimpleCellAddress, RawCellContent][] }

// cells whose engine content changed during the run (editable ones only: data-table bodies and iterated values change
// through recalc, not the macro), with their final formula-bar text and the content to put back
export function diffRun(sheet: LabSheet, before: RawCellContent[][], typed?: ReadonlyMap<string, string>): RunDiff {
  const after = sheet.hf.getSheetSerialized(sheet.sheetId)
  const entries: Record<string, string> = {}
  const restore: [SimpleCellAddress, RawCellContent][] = []
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const was = before[r]?.[c] ?? null
      if (sameContent(was, after[r]?.[c] ?? null)) continue
      const ref = toRef(r, c)
      if (!sheet.editable(ref)) continue
      const t = typed?.get(ref)
      const p = t === undefined ? undefined : parseInput(t)
      entries[ref] = t !== undefined && p?.kind === 'value' && p.value === sheet.read(ref).value ? t : sheet.raw(ref)
      restore.push([{ sheet: sheet.sheetId, row: r, col: c }, was])
    }
  }
  return { entries, restore }
}

// restore the engine, then write the net change through the sheet: number formats first, then every cell as ONE
// writeCells step (so the first Undo takes the macro's values away). Typed entries ('12%') carry their own format.
export function applyRun(
  sheet: LabSheet,
  before: RawCellContent[][],
  side: { fmts: Map<string, string>; typed: ReadonlyMap<string, string> },
  refresh: () => void,
): EditResult {
  const { entries, restore } = diffRun(sheet, before, side.typed)
  for (const [ref, text] of Object.entries(entries)) {
    if (side.typed.get(ref) !== text) continue
    const p = parseInput(text)
    if (p.kind === 'value' && side.fmts.get(ref) === p.fmt && !sheet.fmt(ref)) side.fmts.delete(ref)
  }
  if (restore.length) sheet.hf.batch(() => restore.forEach(([a, content]) => sheet.hf.setCellContents(a, [[content]])))
  applyFormats(sheet, side.fmts)
  const res = restore.length ? writeCells(sheet, entries, { force: false }) : ({ ok: true } as EditResult)
  if (!restore.length) refresh() // NOW() back on the real clock
  return res
}
