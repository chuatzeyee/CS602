import { useId } from 'react'
import { ArrowDown, CircleCheck, CircleDashed, CircleX, Eye, Lightbulb, SquareTerminal, ThumbsDown, ThumbsUp, Wrench, MousePointerClick } from 'lucide-react'
import type { Task, TaskResult, ToolName } from '../types'
import PromptText from './PromptText'
import { TOOL_INFO, type PlayerMode } from './playerTypes'
import { box, boxRef, cellCount, firstCell, normRef } from './refUtil'
import { btnGhost, btnSecondary, input } from './ui'
import { listProcedures } from '../vba/index'

export interface TaskCardProps {
  task: Task
  index: number
  mode: PlayerMode
  active: boolean
  result?: TaskResult
  stale?: boolean
  revealed: boolean
  hintLevel: number
  note: string
  selfMark?: boolean
  modelShown: boolean
  marksGot?: number
  solvedBefore?: boolean        // passed at an earlier visit; shown until the next Check
  onSelect(): void
  onHint(): void
  onReveal(): void
  onNote(text: string): void
  onShowModel(): void
  onSelfMark(ok: boolean): void
  onOpenTool(tool: ToolName): void
  onOpenVba(): void
  onGoToSheet?(): void          // phones: the sheet sits below the task list
}

// what to do in the VBA editor: complete the starter and run its Test macro, or write the entry procedure
function VbaHowTo({ task }: { task: Task }) {
  const entry = task.vba?.entry ?? 'the macro'
  const name = <span className="font-mono text-ink-secondary">{entry}</span>
  const given = task.vba ? listProcedures(task.vba.starter).find(p => p.name.toLowerCase() === entry.toLowerCase()) : undefined
  const icon = <SquareTerminal size={12} className="mr-1.5 inline align-[-2px]" aria-hidden />
  if (given?.kind === 'sub') return <span>{icon}Complete the macro in the VBA editor, run {name} to test it, then Check.</span>
  if (given?.kind === 'function') return <span>{icon}Complete {name} in the VBA editor, then Check: it is called with test values.</span>
  return <span>{icon}Write {name} in the VBA editor, run it, then Check.</span>
}

const fmtMarks = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''))

// where a spill from the first cell of a one-row or one-column range lands; a block just names the range
function spillTarget(range: string): string {
  const b = box(range)
  if (!b) return `over ${range}`
  if (b.r1 === b.r2) return `into ${boxRef({ ...b, c1: b.c1 + 1 })}`
  if (b.c1 === b.c2) return `into ${boxRef({ ...b, r1: b.r1 + 1 })}`
  return `over ${range}`
}

// the "how to enter it" line under a formula or value task: one formula filled over the range, a formula per cell
// (`solutions` for several cells), one formula that spills (`solutions` for the first cell only), or values
export function entryInstruction(task: Pick<Task, 'kind' | 'cells' | 'solution' | 'solutions'>): string | undefined {
  if (task.kind !== 'formula' && task.kind !== 'value') return undefined
  const range = normRef(task.cells)
  const shown = range.split(',').join(', ')
  const many = cellCount(range) > 1
  if (task.kind === 'value') return many ? `Enter the values in ${shown}.` : `Type the value in ${shown}.`
  if (!many) return `Type a formula in ${shown}.`
  const first = firstCell(range)
  const own = Object.keys(task.solutions ?? {}).map(normRef)
  if (typeof task.solution !== 'string' && own.length > 0) {
    if (own.length === 1 && own[0] === first && !range.includes(',')) return `Type one formula in ${first}; it spills ${spillTarget(range)}.`
    return `Type a formula in each cell of ${shown}.`
  }
  const b = range.includes(',') ? undefined : box(range)
  if (b && b.c1 === b.c2) return `Type a formula in ${first}, then fill it down to ${boxRef({ ...b, r1: b.r2 })}.`
  if (b && b.r1 === b.r2) return `Type a formula in ${first}, then fill it right to ${boxRef({ ...b, c1: b.c2 })}.`
  return `Type a formula in ${first}, then fill it across ${shown}.`
}

function StatusIcon({ result, index, exam, before }: { result?: TaskResult; index: number; exam: boolean; before?: boolean }) {
  if (!result && before && !exam) {
    return <CircleCheck size={20} className="text-correct/50 flex-shrink-0" aria-label="Solved on an earlier visit" />
  }
  if (!result || exam) {
    return <span className="flex items-center justify-center w-5 h-5 rounded-full border border-edge-bright text-[10px] font-mono text-ink-muted flex-shrink-0">{index + 1}</span>
  }
  if (result.pending) return <CircleDashed size={20} className="text-s4 flex-shrink-0" aria-label="Waiting for your self-mark" />
  if (result.ok) return <CircleCheck size={20} className="text-correct flex-shrink-0" aria-label="Correct" />
  return <CircleX size={20} className="text-wrong flex-shrink-0" aria-label="Not yet correct" />
}

export default function TaskCard(p: TaskCardProps) {
  const { task, mode, result } = p
  const exam = mode === 'exam'
  const learn = mode === 'practice' || mode === 'review'
  const hints = task.hints ?? []
  const entry = entryInstruction(task)
  const noteId = useId()
  const solvedOrShown = Boolean(result?.ok) || p.revealed
  const border = !result || exam ? (p.active ? 'border-glow/40' : 'border-edge') : result.ok ? 'border-correct/30' : result.pending ? 'border-s4/30' : 'border-wrong/30'
  // phones show only the active task in full; the others collapse to one line
  const collapsed = !p.active

  return (
    <article
      onClick={p.onSelect}
      className={`rounded-lg border bg-surface transition-colors ${border} ${p.active ? 'ring-1 ring-glow/25 bg-raised/40' : 'hover:border-edge-bright'}`}
      aria-current={p.active || undefined}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); p.onSelect() }}
        className={`w-full flex items-center gap-2.5 px-4 pt-3 text-left ${collapsed ? 'max-lg:pb-3' : ''}`}
      >
        <StatusIcon result={result} index={p.index} exam={exam} before={p.solvedBefore} />
        <span className="text-sm font-semibold text-ink flex-shrink-0">Task {p.index + 1}</span>
        {collapsed && <span className="lg:hidden flex-1 min-w-0 truncate text-xs text-ink-muted">{task.prompt.replace(/`/g, '')}</span>}
        {task.marks !== undefined && (
          <span className="text-[11px] font-mono text-ink-muted">
            {p.marksGot !== undefined ? `${fmtMarks(p.marksGot)}/${fmtMarks(task.marks)}` : `${fmtMarks(task.marks)}`} mark{task.marks === 1 ? '' : 's'}
          </span>
        )}
        {result && !exam && !result.ok && !result.pending && result.total > 1 && (
          <span className="text-[11px] font-mono text-ink-muted">{result.correct}/{result.total}</span>
        )}
        {task.cells && <span className="ml-auto flex-shrink-0 text-[11px] font-mono text-ink-secondary bg-raised border border-edge rounded px-1.5 py-px">{task.cells}</span>}
      </button>

      <div className={`px-4 pb-3 pt-2 space-y-2.5 ${collapsed ? 'max-lg:hidden' : ''}`}>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line"><PromptText text={task.prompt} /></p>

        {entry && (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <MousePointerClick size={12} /> {entry}
          </p>
        )}
        {task.kind === 'criteria' && (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <MousePointerClick size={12} /> Type the criteria range in {task.cells}; Check runs an Advanced Filter with it.
          </p>
        )}
        {task.kind === 'tool' && task.tool && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            <Wrench size={12} /> <span>Use <span className="text-ink-secondary">{TOOL_INFO[task.tool].path}</span></span>
            <button type="button" className={`${btnSecondary} !py-1`} onClick={e => { e.stopPropagation(); if (task.tool) p.onOpenTool(task.tool) }}>
              Open {TOOL_INFO[task.tool].label}
            </button>
          </div>
        )}
        {task.kind === 'vba' && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            <VbaHowTo task={task} />
            <button type="button" className={`${btnSecondary} !py-1`} onClick={e => { e.stopPropagation(); p.onOpenVba() }}>Open VBA editor</button>
          </div>
        )}
        {task.kind === 'explain' && (
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            <label htmlFor={noteId} className="sr-only">Your answer for task {p.index + 1}</label>
            <textarea
              id={noteId}
              value={p.note}
              onChange={e => p.onNote(e.target.value)}
              rows={4}
              placeholder="Write your answer…"
              className={`${input} resize-y leading-relaxed`}
            />
            {learn && (
              p.modelShown ? (
                <div className="space-y-2">
                  <div className="text-sm text-ink-secondary leading-relaxed bg-raised border border-edge rounded-md px-3 py-2 whitespace-pre-line">
                    <span className="text-ink font-medium">Model answer: </span>{typeof task.answer === 'string' ? task.answer : 'See the explanation below.'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-ink-muted">Did yours make the same points?</span>
                    <button type="button" aria-pressed={p.selfMark === true} onClick={() => p.onSelfMark(true)} className={`${btnSecondary} !py-1 ${p.selfMark === true ? '!text-correct !border-correct/40 !bg-correct-dim/40' : ''}`}>
                      <ThumbsUp size={12} /> Got it
                    </button>
                    <button type="button" aria-pressed={p.selfMark === false} onClick={() => p.onSelfMark(false)} className={`${btnSecondary} !py-1 ${p.selfMark === false ? '!text-wrong !border-wrong/40 !bg-wrong-dim/40' : ''}`}>
                      <ThumbsDown size={12} /> Not yet
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${btnSecondary} !py-1`} onClick={p.onShowModel}><Eye size={12} /> Show model answer</button>
              )
            )}
          </div>
        )}

        {learn && result && result.messages.length > 0 && (
          <ul className={`space-y-1 text-xs leading-relaxed ${p.stale ? 'opacity-60' : ''}`}>
            {result.messages.map((m, i) => (
              <li key={i} className={`flex gap-2 ${result.ok ? 'text-correct' : result.pending ? 'text-s4' : 'text-wrong'}`}>
                <span className="mt-1.5 h-1 w-1 rounded-full bg-current flex-shrink-0" />
                <span>{m}</span>
              </li>
            ))}
            {p.stale && <li className="text-ink-muted italic">Edited since the last check.</li>}
          </ul>
        )}

        {learn && p.hintLevel > 0 && (
          <ol className="space-y-1.5">
            {hints.slice(0, p.hintLevel).map((h, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink-secondary leading-relaxed bg-raised/70 border border-edge rounded-md px-3 py-2">
                <Lightbulb size={13} className="text-s4 flex-shrink-0 mt-px" />
                <span><span className="text-ink-muted">Hint {i + 1}: </span><PromptText text={h} /></span>
              </li>
            ))}
          </ol>
        )}

        {learn && solvedOrShown && task.explain && (
          <div className="text-xs text-ink-secondary leading-relaxed bg-glow-dim/25 border border-glow/15 rounded-md px-3 py-2 whitespace-pre-line">
            <span className="text-glow font-medium">{p.revealed && !result?.ok ? 'Revealed. ' : 'Why it works: '}</span><PromptText text={task.explain} />
          </div>
        )}

        {p.onGoToSheet && task.kind !== 'explain' && (
          <button type="button" className={`${btnSecondary} !py-1 lg:hidden`} onClick={e => { e.stopPropagation(); p.onGoToSheet?.() }}>
            <ArrowDown size={12} /> Go to the sheet
          </button>
        )}

        {learn && (hints.length > 0 || task.kind !== 'explain') && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
            {hints.length > 0 && (
              <button type="button" className={btnGhost} onClick={p.onHint} disabled={p.hintLevel >= hints.length}>
                <Lightbulb size={13} /> {p.hintLevel === 0 ? 'Hint' : p.hintLevel >= hints.length ? 'No more hints' : `Next hint (${p.hintLevel}/${hints.length})`}
              </button>
            )}
            {task.kind !== 'explain' && (
              <button type="button" className={btnGhost} onClick={p.onReveal}>
                <Eye size={13} /> {p.revealed ? 'Reveal again' : 'Reveal'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
