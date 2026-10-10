// The VBA editor: a module, a macro list, Run (F5) against the live sheet with the grid's active cell and selection,
// and the run's output. A task's own Test macro gets the task's scripted InputBox answers; anything else asks with
// window.prompt. Running is one undo step on the sheet.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { LoaderCircle, Play, RotateCcw, SquareTerminal, Trash2 } from 'lucide-react'
import type { VbaPanelProps } from '../types'
import { listProcedures, runVba, type ProcInfo } from '../vba/index'
import { clockFromDate } from '../vba/labHost'
import VbaEditor, { type VbaEditorApi } from '../vba/VbaEditor'
import VbaOutput, { runSummary, type LastRun } from '../vba/VbaOutput'
import ConfirmDialog from './ConfirmDialog'
import { btnGhost, btnPrimary } from './ui'

const same = (a: string | undefined, b: string | undefined): boolean => Boolean(a && b && a.toLowerCase() === b.toLowerCase())

const ask = (text: string, def: string): string | null => {
  try {
    return window.prompt(text, def)
  } catch {
    return null
  }
}

export default function VbaPanel({ sheet, task, code, onCodeChange, activeCell, selection, onRun }: VbaPanelProps) {
  const helpId = useId()
  const selectId = useId()
  const editor = useRef<VbaEditorApi | null>(null)
  const procs = useMemo(() => listProcedures(code), [code])
  const macros = useMemo(() => procs.filter(p => p.kind === 'sub' && (p.params ?? 0) === 0), [procs])
  const entry = task?.vba?.entry
  const [chosen, setChosen] = useState<string | null>(null)
  const [last, setLast] = useState<LastRun | null>(null)
  const [running, setRunning] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [, setTick] = useState(0)
  const caretProc = useRef<string | null>(null)

  const macro = macros.find(m => same(m.name, chosen ?? undefined)) ?? macros.find(m => same(m.name, entry)) ?? macros[0]

  // the sheet changing after a run makes "Undo the run" unsafe
  useEffect(() => sheet.subscribe(() => setTick(t => t + 1)), [sheet])
  const undoable = Boolean(last?.undoable && last.version === sheet.version && sheet.canUndo())

  // like the VBE, the macro box follows the caret into a runnable Sub
  const onCaretLine = (line: number) => {
    const p: ProcInfo | undefined = procs.find(x => (x.line ?? 0) <= line && line <= (x.endLine ?? x.line ?? 0))
    const name = p?.name ?? null
    if (name === caretProc.current) return
    caretProc.current = name
    if (p && macros.includes(p)) setChosen(p.name)
  }

  const run = () => {
    if (running || !macro) return
    const name = macro.name
    const own = Boolean(task?.vba && same(name, entry))
    const source = code
    const opts = {
      activeCell, selection,
      inputs: own ? task?.vba?.inputs ?? [] : [],
      prompt: ask,
      clock: clockFromDate(new Date()),
      seed: Math.floor(Math.random() * 2 ** 31),
    }
    setRunning(true)
    window.setTimeout(() => {
      const before = sheet.version
      const result = runVba(sheet, source, name, opts)
      setLast({ macro: name, result, source, key: Date.now(), undoable: sheet.version !== before, version: sheet.version })
      setRunning(false)
      onRun(result)
    }, 0)
  }

  const undoRun = () => {
    if (!undoable) return
    sheet.undo()
    setLast(l => (l ? { ...l, undoable: false } : l))
  }

  const errorLine = last && last.source === code && last.result.error && last.result.error.line > 0 ? last.result.error.line : undefined
  const idle = macros.length
    ? `Choose a macro and press Run (F5). It runs on the sheet above, starting from the active cell ${activeCell}.`
    : 'Write a Sub with no parameters (Sub Name() … End Sub) to run it.'

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-surface text-xs"
      onKeyDown={e => {
        if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          run()
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-edge px-2 py-1.5">
        <span className="flex items-center gap-1.5 font-medium text-ink-secondary">
          <SquareTerminal size={14} aria-hidden /> VBA <span className="hidden text-ink-muted sm:inline">· Module1</span>
        </span>
        <label htmlFor={selectId} className="sr-only">Macro to run</label>
        <select
          id={selectId}
          className="min-w-0 max-w-[14rem] flex-1 rounded-md border border-edge bg-base px-2 py-1 font-mono text-[12px] text-ink focus:border-glow/50 focus:outline-none sm:flex-none"
          value={macro?.name ?? ''}
          onChange={e => setChosen(e.target.value)}
          disabled={!macros.length}
        >
          {macros.length ? macros.map(m => <option key={m.name} value={m.name}>{m.name}</option>) : <option value="">(no macros)</option>}
        </select>
        <button type="button" className={`${btnPrimary} !py-1`} onClick={run} disabled={!macro || running} title="Run the macro (F5)" aria-keyshortcuts="F5">
          {running ? <LoaderCircle size={13} className="animate-spin" aria-hidden /> : <Play size={13} aria-hidden />}
          Run <kbd className="hidden font-mono text-[10px] opacity-70 sm:inline">F5</kbd>
        </button>
        <span className="ml-auto flex items-center gap-1">
          {last && (
            <button type="button" className={`${btnGhost} !px-2 !py-1`} onClick={() => setLast(null)} title="Clear the output">
              <Trash2 size={13} aria-hidden /> <span className="hidden sm:inline">Clear output</span>
            </button>
          )}
          {task?.vba && (
            <button type="button" className={`${btnGhost} !px-2 !py-1`} onClick={() => setConfirmReset(true)} title="Put the starter code back" aria-label="Reset the code to the starter">
              <RotateCcw size={13} aria-hidden /> Reset
            </button>
          )}
        </span>
      </div>
      <p id={helpId} className="sr-only">
        F5 runs the chosen macro. Tab indents and Shift+Tab outdents; press Escape then Tab to leave the editor.
      </p>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <VbaEditor
          value={code}
          onChange={c => onCodeChange(c)}
          errorLine={errorLine}
          errorKey={last?.key}
          onCaretLine={onCaretLine}
          label="VBA code"
          describedBy={helpId}
          apiRef={editor}
        />
        <section
          aria-label="Output"
          className="max-h-[42%] min-h-[4.5rem] shrink-0 overflow-auto border-t border-edge bg-void/60 px-3 py-2 leading-relaxed md:max-h-none md:w-[clamp(220px,36%,380px)] md:border-l md:border-t-0"
        >
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Output</h3>
          <p className="sr-only" aria-live="polite">{runSummary(last)}</p>
          <VbaOutput last={last && { ...last, undoable }} idle={idle} onGoToLine={line => editor.current?.goToLine(line)} onUndo={undoRun} />
        </section>
      </div>
      {confirmReset && task?.vba && (
        <ConfirmDialog
          title="Reset the VBA module?"
          confirmLabel="Reset"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false)
            setLast(null)
            setChosen(null)
            onCodeChange(task.vba?.starter ?? '')
          }}
        >
          Your code in this module is replaced by the starter code. The sheet is not changed.
        </ConfirmDialog>
      )}
    </div>
  )
}
