// Cancel in Goal Seek's and Solver's result dialogs: put back the cells the run wrote. Those dialogs are modeless, so
// the learner may have typed elsewhere meanwhile: the run's own undo step is taken back only while it is still the
// latest change; otherwise the cells are rewritten as a new step and the later entries stay.
import { writeCells } from '../sheet'
import type { LabSheet } from '../types'

export function restoreAfterRun(sheet: LabSheet, before: Record<string, string>, versionAfterRun: number): void {
  const changed = (): [string, string][] => Object.entries(before).filter(([ref, raw]) => sheet.raw(ref) !== raw)
  if (!changed().length) return
  if (sheet.version === versionAfterRun && sheet.canUndo()) sheet.undo()
  const left = changed()
  if (left.length) writeCells(sheet, Object.fromEntries(left))
}
