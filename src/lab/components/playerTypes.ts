import type { Exercise, ToolName } from '../types'
import type { ToolKey } from './Toolbar'

// practice: everything on. exam: no hints, reveal, check or explanations. review: after a mock is submitted.
export type PlayerMode = 'practice' | 'sandbox' | 'exam' | 'review'

export const TOOL_INFO: Record<ToolName, { label: string; path: string }> = {
  goalseek: { label: 'Goal Seek', path: 'What-If Analysis › Goal Seek' },
  datatable: { label: 'Data Table', path: 'What-If Analysis › Data Table' },
  solver: { label: 'Solver', path: 'Data › Solver' },
  pivot: { label: 'PivotTable', path: 'Insert › PivotTable' },
  advfilter: { label: 'Advanced Filter', path: 'Data › Advanced' },
  autofilter: { label: 'AutoFilter', path: 'Data › Filter' },
  sort: { label: 'Sort', path: 'Data › Sort' },
}

export const ALL_TOOLS: ToolKey[] = ['goalseek', 'datatable', 'solver', 'sort', 'autofilter', 'advfilter', 'pivot']

// toolbar tools an exercise needs: its tool tasks, plus Advanced Filter for criteria tasks
export function toolsFor(ex: Exercise): ToolKey[] {
  const used = new Set<ToolKey>()
  for (const t of ex.tasks) {
    if (t.kind === 'tool' && t.tool) used.add(t.tool)
    if (t.kind === 'criteria') used.add('advfilter')
  }
  return ALL_TOOLS.filter(t => used.has(t))
}

export const needsIterative = (ex: Exercise): boolean =>
  Boolean(ex.sheet.iterative) || /circular|iterat/i.test([ex.topic, ex.title, ...ex.skills, ...(ex.techniques ?? [])].join(' '))

export const hasVba = (ex: Exercise): boolean => ex.tasks.some(t => t.kind === 'vba')
