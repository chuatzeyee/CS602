// Worked questions for the Question Bank: every lab exercise and mock-exam question, with each task's answer written
// out as text (formula, value, tool settings or model answer). Pure data helpers, no engine.
import { exercises, mocks } from './lab'
import { exam } from './exam'
import type { CellValue, Exercise, Task } from '../lab/types'
import type { QuestionPattern } from './patterns'

export interface Worked {
  ex: Exercise
  source: string          // 'W3 lab' or 'Mock Exam A'
  marks?: number
}

const mockName = (id: string) => `Mock Exam ${id.replace('mock-', '').toUpperCase()}`

export const worked: readonly Worked[] = [
  ...mocks.flatMap(m => m.questions.map(q => ({ ex: q.exercise, source: `${mockName(m.id)} ${q.id.toUpperCase()}`, marks: q.marks }))),
  ...exercises.map(ex => ({ ex, source: ex.week === 'EXAM' ? 'Exam-style lab' : `${ex.week} lab` })),
]

export const workedById = (id: string): Worked | undefined => worked.find(w => w.ex.id === id)

export const cleanPrompt = (s: string): string => s.replace(/`/g, '')

const show = (v: CellValue): string => (v === null ? '(blank)' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v))

const cellList = (entries: [string, string][], max = 8): string[] => {
  const lines = entries.slice(0, max).map(([c, f]) => `${c}: ${f}`)
  if (entries.length > max) lines.push(`... and ${entries.length - max} more cells in the same pattern`)
  return lines
}

const firstCell = (cells: string) => cells.split(':')[0]

function toolLines(t: Task): string[] {
  const s = (t.toolSetup ?? {}) as Record<string, unknown>
  switch (t.tool) {
    case 'goalseek':
      return ['Data > What-If Analysis > Goal Seek', `Set cell: ${s.setCell}`, `To value: ${s.toValue}`, `By changing cell: ${s.changingCell}`]
    case 'solver': {
      const c = (s.constraints ?? []) as { lhs: string; relation: string; rhs?: unknown }[]
      return [
        'Data > Solver',
        `Set Objective: ${s.objective}   To: ${s.sense === 'max' ? 'Max' : s.sense === 'min' ? 'Min' : `Value of ${s.valueOf}`}`,
        `By Changing Variable Cells: ${s.changing}`,
        ...c.map(k => `Subject to: ${k.lhs} ${k.relation === 'int' ? '= integer' : k.relation === 'bin' ? '= binary' : `${k.relation} ${k.rhs}`}`),
        `Make Unconstrained Variables Non-Negative: ${s.nonNegative === false ? 'unticked' : 'ticked'}`,
        `Solving Method: ${s.engine === 'grg' ? 'GRG Nonlinear' : 'Simplex LP'}`,
      ]
    }
    case 'datatable':
      return [
        `Select ${s.range}`,
        'Data > What-If Analysis > Data Table',
        `Row input cell: ${s.rowInput ?? '(empty)'}`,
        `Column input cell: ${s.colInput ?? '(empty)'}`,
      ]
    case 'advfilter':
      return ['Data > Advanced', `List range: ${s.list}`, `Criteria range: ${s.criteria}`, s.copyTo ? `Copy to: ${s.copyTo}` : 'Filter the list in place', `Unique records only: ${s.unique ? 'yes' : 'no'}`]
    case 'pivot': {
      const cfg = (s.config ?? {}) as { rows?: string[]; columns?: string[]; values?: { field: string; agg: string; show?: string }[]; filters?: { field: string; include: unknown[] }[] }
      return [
        `Insert > PivotTable from ${s.source} into ${s.target}`,
        `Rows: ${(cfg.rows ?? []).join(', ') || '(none)'}`,
        `Columns: ${(cfg.columns ?? []).join(', ') || '(none)'}`,
        ...(cfg.values ?? []).map(v => `Values: ${v.agg} of ${v.field}${v.show && v.show !== 'value' ? ` shown as ${v.show}` : ''}`),
        ...(cfg.filters ?? []).map(f => `Filter: ${f.field} = ${f.include.join(', ')}`),
      ]
    }
    case 'autofilter': {
      const cols = (s.columns ?? []) as { column: string; filter: { type: string; values?: unknown[]; rules?: { op: string; value: unknown }[]; join?: string } }[]
      const ops: Record<string, string> = { eq: '=', ne: '<>', gt: '>', ge: '>=', lt: '<', le: '<=' }
      return [
        `Select ${s.range} > Data > Filter`,
        ...cols.map(c => c.filter.type === 'values'
          ? `${c.column}: tick only ${(c.filter.values ?? []).join(', ')}`
          : `${c.column}: Number Filters > Custom: ${(c.filter.rules ?? []).map(r => `${ops[r.op] ?? r.op} ${r.value}`).join(` ${(c.filter.join ?? 'and').toUpperCase()} `)}`),
      ]
    }
    case 'sort': {
      const levels = (s.levels ?? []) as { column: string; order: string; list?: string }[]
      return [
        `Select ${s.range} > Data > Sort (My data has headers: ${s.headers ? 'ticked' : 'unticked'})`,
        ...levels.map((l, i) => `${i === 0 ? 'Sort by' : 'Then by'} ${l.column}: ${l.order === 'custom' ? `Custom List ${l.list}` : l.order === 'desc' ? 'Largest to Smallest / Z to A' : 'Smallest to Largest / A to Z'}`),
      ]
    }
    default:
      return Object.keys(s).length ? [`${t.tool}: ${JSON.stringify(s)}`] : []
  }
}

// the answer to one task as plain lines
export function answerLines(t: Task): string[] {
  const lines: string[] = []
  if (t.kind === 'vba' && t.vba) return t.vba.solution.split('\n')
  if (t.kind === 'explain') return typeof t.answer === 'string' ? [t.answer] : []
  if (t.kind === 'tool') lines.push(...toolLines(t))
  if (t.solutions) lines.push(...cellList(Object.entries(t.solutions)))
  else if (t.solution) {
    const range = t.cells.includes(':') ? ` (fill to ${t.cells})` : ''
    lines.push(`${firstCell(t.cells) || 'Answer'}${range}: ${t.solution}`)
  }
  if (t.kind === 'value' && t.answer !== undefined && !t.solution && !t.solutions) {
    if (t.answer !== null && typeof t.answer === 'object') lines.push(...cellList(Object.entries(t.answer).map(([c, v]) => [c, show(v)])))
    else lines.push(`${t.cells}: ${show(t.answer)}`)
  }
  if (t.random) lines.push(`Expected ${t.random.stat === 'p' ? 'share' : t.random.stat} about ${show(t.random.target)} (simulated, varies by run)`)
  return lines
}

export function examplesFor(p: QuestionPattern, max = 8): Worked[] {
  const ids = new Set(p.examples ?? [])
  const hit = (w: Worked) => ids.has(w.ex.id) || (w.ex.techniques ?? []).some(t => (p.techniques as readonly string[]).includes(t))
  return worked
    .filter(hit)
    .sort((a, b) => Number(ids.has(b.ex.id)) - Number(ids.has(a.ex.id)) || b.ex.level - a.ex.level)
    .slice(0, max)
}

export interface PastPart { paper: string; question: string; label: string; marks: number; focus: string }

export function pastPartsFor(p: QuestionPattern): PastPart[] {
  const want = p.techniques as readonly string[]
  return exam.papers.flatMap(paper => paper.questions.flatMap(q => q.parts
    .filter(part => part.techniques.some(t => want.includes(t)))
    .map(part => ({ paper: paper.title, question: q.id.toUpperCase(), label: part.label, marks: part.marks, focus: part.focus }))))
}
