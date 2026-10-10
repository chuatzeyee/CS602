// tools/index.ts - one entry point for Reveal and the validator: run a tool with its reference setup.
import type { AdvFilterSetup, DataTableDef, EditResult, GoalSeekSetup, LabSheet, PivotSetup, SolverSetup, ToolName, ToolSetup } from '../types'
import { runGoalSeek, runSolver } from '../whatif'
import { applyAdvancedFilter } from './advFilter'
import { applyAutoFilter } from './autoFilter'
import { applyPivot } from './pivot'
import { applySort } from './sort'

export function applyTool(sheet: LabSheet, tool: ToolName, setup: ToolSetup): EditResult {
  if (!setup || typeof setup !== 'object') return { ok: false, message: `The ${tool} setup is missing.` }
  try {
    switch (tool) {
      case 'goalseek': {
        const r = runGoalSeek(sheet, setup as GoalSeekSetup)
        return r.found ? { ok: true } : { ok: false, message: r.message }
      }
      case 'solver': {
        const r = runSolver(sheet, setup as SolverSetup)
        return r.status === 'optimal' ? { ok: true } : { ok: false, message: r.message }
      }
      case 'datatable':
        return sheet.addDataTable(setup as DataTableDef)
      case 'pivot':
        return applyPivot(sheet, setup as PivotSetup)
      case 'advfilter':
        return applyAdvancedFilter(sheet, setup as AdvFilterSetup)
      case 'autofilter':
        return applyAutoFilter(sheet, setup as Record<string, unknown>)
      case 'sort':
        return applySort(sheet, setup as Record<string, unknown>)
      default:
        return { ok: false, message: `Unknown tool "${String(tool)}".` }
    }
  } catch (e) {
    return { ok: false, message: `${tool} failed: ${e instanceof Error ? e.message : 'unknown problem'}` }
  }
}
