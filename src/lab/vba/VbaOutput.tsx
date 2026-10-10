// The VBA panel's output pane: what the last run did (MsgBox prompts, Debug.Print lines, InputBox answers) and, when
// it stopped, the error with a link to its line.
import { CircleAlert, CircleCheck, Undo2 } from 'lucide-react'
import type { VbaOutput as OutputLine, VbaRunResult } from '../types'
import type { VbaRunOutcome } from './index'
import { cssColor } from './labHost'
import { procAt } from './sourceText'

export interface LastRun {
  macro: string
  result: VbaRunOutcome
  source: string                        // the module as it was run
  key: number
  undoable: boolean                     // the run changed the sheet (and, when shown, nothing changed it since)
  version: number                       // sheet.version right after the run
}

interface VbaOutputProps {
  last: LastRun | null
  idle: string                          // shown before the first run
  onGoToLine(line: number): void
  onUndo(): void
}

const chip = 'mr-1.5 inline-block rounded border px-1 py-px align-[1px] font-sans text-[10px] font-semibold uppercase tracking-wide'

function Line({ o }: { o: OutputLine }) {
  if (o.kind === 'msgbox') {
    return (
      <li className="whitespace-pre-wrap break-words">
        <span className={`${chip} border-s9/40 text-s9`}>MsgBox</span>{o.text}
      </li>
    )
  }
  if (o.kind === 'input') {
    return (
      <li className="whitespace-pre-wrap break-words text-ink-secondary">
        <span className={`${chip} border-s4/40 text-s4`}>InputBox</span>{o.text}
        <span className="text-ink-muted"> → </span>
        {o.answer === undefined ? <span className="italic text-ink-muted">Cancel</span> : o.answer ? <span className="text-ink">{o.answer}</span> : <span className="font-mono text-ink-muted" title="an empty reply, as Cancel gives">""</span>}
      </li>
    )
  }
  return <li className="whitespace-pre-wrap break-words font-mono">{o.text || ' '}</li>
}

type Style = NonNullable<VbaRunResult['styles']>[string]

function Swatch({ colour }: { colour: number }) {
  return <span className="mx-0.5 inline-block h-2.5 w-2.5 rounded-sm border border-edge-bright align-[-1px]" style={{ background: cssColor(colour) }} />
}

function StyleText({ st }: { st: Style }) {
  const parts = [
    st.bold ? 'bold' : null,
    st.italic ? 'italic' : null,
    st.fontColor !== undefined ? <span key="f">font <Swatch colour={st.fontColor} /></span> : null,
    st.fill !== undefined ? <span key="b">fill <Swatch colour={st.fill} /></span> : null,
  ].filter(Boolean)
  if (!parts.length) return <span className="text-ink-muted">plain</span>
  return <>{parts.map((p, i) => <span key={i}>{i > 0 ? ', ' : ''}{p}</span>)}</>
}

// fonts and fills are kept by the run but the lab grid does not draw them: list them, grouped by style
function Formats({ styles }: { styles: NonNullable<VbaRunResult['styles']> }) {
  const groups = new Map<string, { st: Style; cells: string[] }>()
  for (const [cell, st] of Object.entries(styles)) {
    const key = JSON.stringify([st.bold ?? false, st.italic ?? false, st.fontColor ?? null, st.fill ?? null])
    const g = groups.get(key) ?? { st, cells: [] }
    g.cells.push(cell)
    groups.set(key, g)
  }
  return (
    <div className="text-ink-secondary">
      <p className="text-ink-muted">Formatting set by the run (the lab grid does not draw fonts and fills):</p>
      <ul className="mt-0.5 space-y-0.5">
        {[...groups.values()].slice(0, 6).map(g => (
          <li key={g.cells[0]}>
            <span className="font-mono text-ink">{g.cells.slice(0, 6).join(', ')}{g.cells.length > 6 ? ` +${g.cells.length - 6}` : ''}</span>: <StyleText st={g.st} />
          </li>
        ))}
      </ul>
    </div>
  )
}

const plural = (n: number, word: string): string => `${n.toLocaleString('en')} ${word}${n === 1 ? '' : 's'}`

/** what a screen reader hears after a run: a summary, never the output itself (a loop can print thousands of lines) */
export function runSummary(last: LastRun | null): string {
  if (!last) return ''
  const { result, macro } = last
  const lines = (result.output ?? result.messages).length + (result.omitted ?? 0)
  if (result.error) return `${macro} stopped${result.error.line > 0 ? ` on line ${result.error.line}` : ''}.`
  return `Ran ${macro}: ${lines ? plural(lines, 'line') : 'no lines'} of output.`
}

export default function VbaOutput({ last, idle, onGoToLine, onUndo }: VbaOutputProps) {
  if (!last) return <p className="text-ink-muted">{idle}</p>
  const { result, macro } = last
  const err = result.error
  const proc = err && err.line > 0 ? procAt(last.source, err.line) : undefined
  const lines = result.output ?? result.messages.map(text => ({ kind: 'print' as const, text }))
  return (
    <div className="space-y-2">
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${err ? 'text-wrong' : 'text-ink-secondary'}`}>
        {err ? <CircleAlert size={13} aria-hidden /> : <CircleCheck size={13} className="text-correct" aria-hidden />}
        <span>{err ? `${macro} stopped` : `Ran ${macro}`} · {result.steps.toLocaleString('en')} steps</span>
        {last.undoable && (
          <button type="button" className="inline-flex items-center gap-1 rounded px-1 text-ink-muted underline-offset-2 hover:text-ink hover:underline" onClick={onUndo}>
            <Undo2 size={12} aria-hidden /> Undo the run
          </button>
        )}
      </p>
      {result.omitted ? (
        <p className="text-ink-muted">{plural(result.omitted, 'earlier line')} not shown: only the last {plural(lines.length, 'line')} are kept.</p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="space-y-1 text-ink" aria-label="Macro output">
          {lines.map((o, i) => <Line key={i} o={o} />)}
        </ul>
      ) : !err ? (
        <p className="text-ink-muted">No MsgBox or Debug.Print output.</p>
      ) : null}
      {result.styles && Object.keys(result.styles).length > 0 && <Formats styles={result.styles} />}
      {err && (
        <div role="alert" className="rounded-md border border-wrong/30 bg-wrong-dim/50 px-2.5 py-2 text-wrong">
          <p className="whitespace-pre-wrap break-words font-medium">{err.message}</p>
          {err.line > 0 && (
            <p className="mt-1 text-ink-secondary">
              Line {err.line}{proc ? ` in ${proc}` : ''}{' '}
              <button type="button" className="ml-1 text-wrong underline underline-offset-2 hover:text-ink" onClick={() => onGoToLine(err.line)}>
                Go to line
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
