import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import { CircleCheck, LoaderCircle } from 'lucide-react'
import type {
  CellMark, Exercise, ExerciseResult, LabSheet, LearnerState, SpreadsheetApi, Task, TaskResult, ToolDialogProps, ToolName, VbaRunResult,
} from '../types'
import { asOneStep, createLabSheet } from '../sheet'
import { checkExercise, checkTask, revealTask } from '../checker'
import { getExerciseProgress, saveExerciseProgress } from '../progress'
import Spreadsheet from './Spreadsheet'
import GoalSeekDialog from './GoalSeekDialog'
import DataTableDialog from './DataTableDialog'
import SolverDialog from './SolverDialog'
import PivotDialog from './PivotDialog'
import AdvancedFilterDialog from './AdvancedFilterDialog'
import AutoFilterDialog from './AutoFilterDialog'
import SortDialog from './SortDialog'
import VbaPanel from './VbaPanel'
import Toolbar, { iterativeToggleWanted, type ToolKey } from './Toolbar'
import TaskPanel from './TaskPanel'
import TaskCard from './TaskCard'
import StatusBar, { type StatusMessage } from './StatusBar'
import ConfirmDialog from './ConfirmDialog'
import CustomFormatDialog from './CustomFormatDialog'
import { DialogDockContext } from './Dialog'
import { ALL_TOOLS, hasVba, toolsFor, type PlayerMode } from './playerTypes'
import { fillArgs, normRef } from './refUtil'
import { scrollBehavior } from './motion'

export interface PlayerProps {
  exercise: Exercise
  mode?: PlayerMode
  progressId?: string                       // load and save with the exercise progress store under this id
  initialState?: LearnerState               // used when there is no progressId (mock exams)
  onStateChange?(state: LearnerState): void // debounced, and on unmount
  initialResult?: ExerciseResult            // review mode: the submitted result
  heights?: { sheet: string; panel: string } // tailwind height (+ sticky top) classes when the page has more above the player
  taskMarks?: Record<string, number>        // review mode: marks earned per task
  onSelfMark?(taskId: string, ok: boolean): void
}

interface Extras { vba: Record<string, string>; notes: Record<string, string>; selfMarks: Record<string, boolean> }

const DIALOGS: Record<ToolKey, ComponentType<ToolDialogProps>> = {
  goalseek: GoalSeekDialog,
  datatable: DataTableDialog,
  solver: SolverDialog,
  pivot: PivotDialog,
  advfilter: AdvancedFilterDialog,
  autofilter: AutoFilterDialog,
  sort: SortDialog,
}

// phones: one screen of sheet above the nav pill; wide screens: beside the task panel, clear of the pill
const PAGE_HEIGHTS = { sheet: 'h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-10.5rem)]', panel: 'lg:h-[calc(100dvh-10.5rem)] lg:top-4' }
const SANDBOX_HEIGHTS = { sheet: 'h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-12rem)]', panel: '' }

const SANDBOX_VBA = `Sub Hello()
    Range("A1").Value = "Hello from VBA"
    MsgBox "Done: A1 was written"
End Sub
`

const extrasOf = (s?: LearnerState): Extras => ({ vba: { ...s?.vba }, notes: { ...s?.notes }, selfMarks: { ...s?.selfMarks } })

function mergeState(base: LearnerState, x: Extras): LearnerState {
  const { vba: _v, notes: _n, selfMarks: _s, ...rest } = base
  return {
    ...rest,
    ...(Object.keys(x.vba).length ? { vba: x.vba } : {}),
    ...(Object.keys(x.notes).length ? { notes: x.notes } : {}),
    ...(Object.keys(x.selfMarks).length ? { selfMarks: x.selfMarks } : {}),
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function withTask(prev: ExerciseResult | null, ex: Exercise, tr: TaskResult): ExerciseResult {
  const tasks = ex.tasks
    .map(t => (t.id === tr.taskId ? tr : prev?.tasks.find(r => r.taskId === t.id)))
    .filter((r): r is TaskResult => Boolean(r))
  const score = ex.tasks.length ? tasks.filter(r => r.ok).length / ex.tasks.length : 0
  return { score, tasks }
}

const firstArea = (cells: string) => normRef(cells).split(',')[0] ?? ''

// learner entries, only tracked while the sheet has data tables (for the F9 hint)
const editsOf = (s: LabSheet) => (s.dataTables.length ? JSON.stringify(s.state().edits) : '')

export default function Player(props: PlayerProps) {
  const { exercise, mode = 'practice', progressId } = props
  const learn = mode === 'practice' || mode === 'review'
  const sandbox = mode === 'sandbox'

  const [boot] = useState(() => {
    const p = progressId ? getExerciseProgress(progressId) : undefined
    return { state: p?.state ?? props.initialState, solved: p?.solved ?? [], best: p?.best ?? 0 }
  })
  const seed = useRef<LearnerState | undefined>(boot.state)
  const solvedRef = useRef<string[]>(boot.solved)
  const bestRef = useRef<number>(boot.best)
  const dirty = useRef(false)
  const lastSaved = useRef('')   // JSON of the last state written (or loaded): unchanged state is not re-saved
  const saveWarned = useRef(false)
  const destroyed = useRef(new WeakSet<LabSheet>())
  const onStateChangeRef = useRef(props.onStateChange)
  useEffect(() => { onStateChangeRef.current = props.onStateChange }, [props.onStateChange])

  const [gen, setGen] = useState(0)
  const [sheet, setSheet] = useState<LabSheet | null>(null)
  const [extras, setExtras] = useState<Extras>(() => extrasOf(boot.state))
  const extrasRef = useRef(extras)
  useEffect(() => { extrasRef.current = extras }, [extras])

  const [loadError, setLoadError] = useState<string | null>(null)
  const [result, setResult] = useState<ExerciseResult | null>(props.initialResult ?? null)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [sel, setSel] = useState({ range: 'A1', active: 'A1' })
  const [activeTask, setActiveTask] = useState<string | null>(exercise.tasks[0]?.id ?? null)
  const [hints, setHints] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const [modelShown, setModelShown] = useState<Set<string>>(() => new Set(Object.keys(boot.state?.selfMarks ?? {})))
  const [tool, setTool] = useState<ToolKey | null>(null)
  const [vbaOpen, setVbaOpen] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: 'reset' } | { kind: 'reveal'; task: Task } | null>(null)
  const [customFmt, setCustomFmt] = useState(false)
  const [fresh, setFresh] = useState<{ sheet: LabSheet | null; tables: string; edits: string }>({ sheet: null, tables: '', edits: '' })
  const [solvedBefore, setSolvedBefore] = useState<Set<string>>(() => new Set(boot.solved))
  const apiRef = useRef<SpreadsheetApi | null>(null)
  const sheetBox = useRef<HTMLElement>(null)
  const snapshot = useRef<{ result: ExerciseResult | null; sheet: LabSheet | null; raw: Record<string, string> }>({ result: null, sheet: null, raw: {} })

  const persist = useCallback((s: LabSheet, force = false) => {
    if (destroyed.current.has(s)) return
    dirty.current = false
    const state = mergeState(s.state(), extrasRef.current)
    const json = JSON.stringify(state)
    if (json === lastSaved.current && !force) return
    lastSaved.current = json
    if (progressId) {
      const saved = saveExerciseProgress(progressId, { state, solved: solvedRef.current, total: exercise.tasks.length, best: bestRef.current, updated: Date.now() })
      if (!saved && !saveWarned.current) {
        saveWarned.current = true
        setStatus({ text: 'Your work could not be saved on this device (the browser\'s storage is full or blocked): it is kept only while this page stays open.', tone: 'warn' })
      }
    }
    onStateChangeRef.current?.(state)
  }, [progressId, exercise.tasks.length])
  const persistRef = useRef(persist)
  useEffect(() => { persistRef.current = persist }, [persist])

  // build the live sheet; rebuilt on reset and reveal (gen); destroyed after the swap so no render sees a dead sheet
  useEffect(() => {
    let s: LabSheet
    try {
      s = createLabSheet(exercise.sheet, { state: seed.current })
    } catch (e) {
      try {
        s = createLabSheet(exercise.sheet)
      } catch (fatal) {
        setLoadError(errText(fatal))   // a broken exercise spec: nothing to show
        return
      }
      setStatus({ text: `Your saved work could not be restored (${errText(e)}); starting fresh.`, tone: 'warn' })
    }
    // the first build only shows what is stored already; rebuilds (reset, reveal) are saved
    if (gen === 0) lastSaved.current = JSON.stringify(mergeState(s.state(), extrasRef.current))
    setSheet(s)
    return () => {
      if (dirty.current) persistRef.current(s)
      destroyed.current.add(s)
      setTimeout(() => s.destroy(), 0)
    }
  }, [exercise.sheet, gen])

  const subscribe = useCallback((cb: () => void) => (sheet ? sheet.subscribe(cb) : () => {}), [sheet])
  const version = useSyncExternalStore(subscribe, () => (sheet ? sheet.version : -1))

  useEffect(() => {
    if (!sheet) return
    dirty.current = true
    const t = setTimeout(() => persist(sheet), 500)
    return () => clearTimeout(t)
  }, [sheet, version, extras, persist])

  // leaving or hiding the page (reload, closing the tab, switching apps on a phone) saves at once, not 500 ms later
  useEffect(() => {
    if (!sheet) return
    const flush = () => { if (dirty.current) persistRef.current(sheet) }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [sheet])

  // marks stay on a cell until it is edited: the entries are snapshotted when a result (or a rebuilt sheet) arrives
  const { marks, staleTasks } = useMemo(() => {
    const stale = new Set<string>()
    if (!sheet || !result) return { marks: undefined, staleTasks: stale }
    if (snapshot.current.result !== result || snapshot.current.sheet !== sheet) {
      const raw: Record<string, string> = {}
      for (const t of result.tasks) for (const ref of Object.keys(t.cells)) raw[ref] = sheet.raw(ref)
      snapshot.current = { result, sheet, raw }
    }
    const out: Record<string, CellMark> = {}
    for (const t of result.tasks) {
      for (const [ref, m] of Object.entries(t.cells)) {
        const before = snapshot.current.raw[ref]
        if (before === undefined || before === sheet.raw(ref)) out[ref] = m
        else stale.add(t.taskId)
      }
    }
    return { marks: out, staleTasks: stale }
    // version: re-evaluate after edits
  }, [sheet, result, version])

  const currentState = useCallback((): LearnerState | null => (sheet ? mergeState(sheet.state(), extrasRef.current) : null), [sheet])
  const task = exercise.tasks.find(t => t.id === activeTask)
  const tools = sandbox ? ALL_TOOLS : toolsFor(exercise)
  const showVba = sandbox || hasVba(exercise)
  // version: a #CYCLE! can appear or go with any edit
  const showIterative = useMemo(() => iterativeToggleWanted(exercise, sandbox, sheet), [exercise, sandbox, sheet, version])

  // data tables are "fresh" after F9 or when a table is added or removed; later edits make them stale (Excel's
  // "automatic except data tables")
  // version: tables and edits change with it
  const tablesKey = useMemo(() => (sheet ? JSON.stringify(sheet.dataTables) : ''), [sheet, version])
  const editsKey = useMemo(() => (sheet ? editsOf(sheet) : ''), [sheet, version])
  if (fresh.sheet !== sheet || fresh.tables !== tablesKey) setFresh({ sheet, tables: tablesKey, edits: editsKey })
  const f9Hint = Boolean(sheet?.dataTables.length && fresh.sheet === sheet && fresh.tables === tablesKey && editsKey !== fresh.edits)

  const recalc = useCallback(() => {
    if (!sheet) return
    sheet.recalc()
    setFresh({ sheet, tables: JSON.stringify(sheet.dataTables), edits: editsOf(sheet) })
    setStatus({ text: sheet.dataTables.length ? 'Calculated: new random draws, data tables re-run' : 'Calculated: new random draws', tone: 'info' })
  }, [sheet])

  // F9 anywhere on the page (the grid's own F9 handler is pre-empted so the status bar knows tables are fresh)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || e.ctrlKey || e.altKey || e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      recalc()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recalc])

  const runCheck = () => {
    const state = currentState()
    if (!sheet || !state || checking) return
    setChecking(true)
    const t0 = performance.now()
    setTimeout(() => {
      let r: ExerciseResult | null = null
      try {
        r = checkExercise(exercise, state)
      } catch (e) {
        setStatus({ text: `Check failed: ${errText(e)}`, tone: 'error' })
      }
      const apply = () => {
        setChecking(false)
        if (!r) return
        const ok = r.tasks.filter(t => t.ok).length
        const n = exercise.tasks.length
        setResult(r)
        solvedRef.current = r.tasks.filter(t => t.ok).map(t => t.taskId)
        bestRef.current = Math.max(bestRef.current, r.score)
        persist(sheet, true)
        setStatus({
          text: ok === n ? (n === 1 ? 'The task is correct. Well done!' : `All ${n} tasks correct. Well done!`) : `${ok} of ${n} task${n === 1 ? '' : 's'} correct`,
          tone: ok === n ? 'ok' : 'info',
        })
      }
      const wait = 300 - (performance.now() - t0)
      if (wait > 0) setTimeout(apply, wait)
      else apply()
    }, 30)
  }

  const rebuild = (next: LearnerState | undefined) => {
    dirty.current = false
    seed.current = next
    setExtras(extrasOf(next))
    setGen(g => g + 1)
  }

  const doReset = () => {
    rebuild(undefined)
    setResult(null)
    setRevealed(new Set())
    setHints({})
    setModelShown(new Set())
    setSolvedBefore(new Set())
    setStatus({ text: sandbox ? 'Sandbox cleared' : 'Sheet reset to the start', tone: 'info' })
  }

  const doReveal = (t: Task) => {
    const state = currentState()
    if (!state) return
    let next: LearnerState
    try {
      next = revealTask(exercise, t, state)
    } catch (e) {
      setStatus({ text: `Could not reveal: ${errText(e)}`, tone: 'error' })
      return
    }
    rebuild(next)
    setRevealed(r => new Set(r).add(t.id))
    try {
      const tr = checkTask(exercise, t, next)
      setResult(prev => withTask(prev, exercise, tr))
    } catch {
      // the reveal itself worked; ticks appear at the next Check
    }
    const i = exercise.tasks.indexOf(t)
    setStatus({ text: `Task ${i + 1} revealed${t.cells ? ` in ${t.cells}` : ''}`, tone: 'info' })
  }

  const selectTask = (t: Task) => {
    setActiveTask(t.id)
    if (t.cells) apiRef.current?.select(firstArea(t.cells))
    if (t.kind === 'vba') setVbaOpen(true)
  }

  const setNote = (id: string, text: string) => setExtras(x => ({ ...x, notes: { ...x.notes, [id]: text } }))
  const setSelfMark = (t: Task, ok: boolean) => {
    const nextExtras = { ...extrasRef.current, selfMarks: { ...extrasRef.current.selfMarks, [t.id]: ok } }
    extrasRef.current = nextExtras
    setExtras(nextExtras)
    props.onSelfMark?.(t.id, ok)
    if (!sheet) return
    try {
      const tr = checkTask(exercise, t, mergeState(sheet.state(), nextExtras))
      setResult(prev => withTask(prev, exercise, tr))
    } catch {
      // shown at the next Check
    }
  }

  const fill = (dir: 'down' | 'right') => {
    if (!sheet) return
    const args = fillArgs(sel.range, dir)
    if (!args) {
      setStatus({ text: dir === 'down' ? 'Select the cells to fill, with the formula in the top row.' : 'Select the cells to fill, with the formula in the left column.', tone: 'warn' })
      return
    }
    const res = sheet.fill(args.source, args.target)
    setStatus(res.ok ? { text: `Filled ${dir} ${args.target}`, tone: 'info' } : { text: res.message, tone: 'warn' })
  }

  const applyFormat = (code: string | undefined) => {
    if (!sheet) return
    asOneStep(sheet, () => { for (const area of normRef(sel.range).split(',')) sheet.setFmt(area, code) })
    setStatus({ text: `Number format ${code ?? 'General'} on ${sel.range}`, tone: 'info' })
  }

  const vbaTask = task?.kind === 'vba' ? task : exercise.tasks.find(t => t.kind === 'vba')
  const vbaKey = sandbox ? 'module' : vbaTask?.id ?? 'module'
  const savedCode = extras.vba[vbaKey]
  const vbaCode = typeof savedCode === 'string' ? savedCode : vbaTask?.vba?.starter ?? SANDBOX_VBA
  const onVbaRun = (r: VbaRunResult) => {
    // like Excel, the grid shows where the macro left the selection
    if (r.selection && (r.selection !== sel.range || r.activeCell !== sel.active)) apiRef.current?.select(r.selection)
    if (!r.ok && r.error) setStatus({ text: `VBA stopped${r.error.line > 0 ? ` on line ${r.error.line}` : ''}: ${r.error.message}`, tone: 'error' })
    else setStatus({ text: r.messages.length ? `Macro ran. ${r.messages[r.messages.length - 1]}` : `Macro ran (${r.steps.toLocaleString('en')} steps)`, tone: 'ok' })
  }

  const okCount = result?.tasks.filter(t => t.ok).length ?? 0
  const summary = result && learn
    ? <span className={okCount === exercise.tasks.length ? 'text-correct' : 'text-ink-secondary'}>{okCount}/{exercise.tasks.length} correct</span>
    : undefined

  const Dlg = tool ? DIALOGS[tool] : null
  const toolDone = (summaryText: string) =>
    setStatus({ text: summaryText, tone: /not|fail|infeasible|unbounded|error|restored|cancel/i.test(summaryText) ? 'warn' : 'ok' })

  const cards = exercise.tasks.map((t, i) => (
    <TaskCard
      key={t.id}
      task={t}
      index={i}
      mode={mode}
      active={t.id === activeTask}
      result={result?.tasks.find(r => r.taskId === t.id)}
      stale={staleTasks.has(t.id)}
      revealed={revealed.has(t.id)}
      hintLevel={hints[t.id] ?? 0}
      note={extras.notes[t.id] ?? ''}
      selfMark={extras.selfMarks[t.id]}
      modelShown={modelShown.has(t.id)}
      marksGot={props.taskMarks?.[t.id]}
      solvedBefore={learn && solvedBefore.has(t.id)}
      onSelect={() => selectTask(t)}
      onHint={() => setHints(h => ({ ...h, [t.id]: (h[t.id] ?? 0) + 1 }))}
      onReveal={() => setConfirm({ kind: 'reveal', task: t })}
      onNote={text => setNote(t.id, text)}
      onShowModel={() => setModelShown(s => new Set(s).add(t.id))}
      onSelfMark={ok => setSelfMark(t, ok)}
      // keep the grid selection: the dialog reads it (a Data Table range, a PivotTable source), and moving it now would
      // also fill the dialog's first reference box
      onOpenTool={(name: ToolName) => { setActiveTask(t.id); setTool(name) }}
      onOpenVba={() => { setActiveTask(t.id); setVbaOpen(true) }}
      onGoToSheet={() => sheetBox.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })}
    />
  ))

  const heights = props.heights ?? (sandbox ? SANDBOX_HEIGHTS : PAGE_HEIGHTS)
  const scrollMargin = mode === 'exam' || mode === 'review' ? 'scroll-mt-16' : 'scroll-mt-3'

  // tool dialogs dock on the right, so the task text stays readable while one is open
  return (
    <DialogDockContext.Provider value="right">
      <div className={sandbox ? '' : 'lg:grid lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-4 lg:items-start'}>
        {!sandbox && (
          <aside className={`mb-4 lg:mb-0 lg:overflow-y-auto lg:pr-1 lg:sticky ${heights.panel}`} aria-label="Tasks">
            <TaskPanel
              exercise={exercise}
              mode={mode}
              summary={result && learn && okCount === exercise.tasks.length && exercise.tasks.length > 0 ? (
                <div className="flex items-center gap-2 bg-correct-dim/40 border border-correct/30 rounded-lg px-4 py-2.5 text-sm text-correct animate-fade-in">
                  <CircleCheck size={16} /> Every task is correct.
                </div>
              ) : undefined}
            >
              {cards}
            </TaskPanel>
          </aside>
        )}

        <section ref={sheetBox} className={`flex flex-col bg-base border border-edge rounded-lg overflow-hidden ${heights.sheet} ${scrollMargin} min-h-[420px]`} aria-label="Spreadsheet">
          {sheet ? (
            <>
              <Toolbar
                check={learn && exercise.tasks.length > 0 ? { busy: checking, onCheck: runCheck, summary } : undefined}
                canUndo={sheet.canUndo()}
                canRedo={sheet.canRedo()}
                onUndo={() => { sheet.undo(); setStatus(null) }}
                onRedo={() => { sheet.redo(); setStatus(null) }}
                onFillDown={() => fill('down')}
                onFillRight={() => fill('right')}
                format={sheet.fmt(sel.active)}
                onFormat={applyFormat}
                onCustomFormat={() => setCustomFmt(true)}
                onRecalc={recalc}
                iterative={showIterative ? { on: sheet.iterative, onToggle: () => { sheet.setIterative(!sheet.iterative); setStatus({ text: `Iterative calculation ${sheet.iterative ? 'on' : 'off'}`, tone: 'info' }) } } : undefined}
                tools={tools}
                onTool={setTool}
                vba={showVba ? { open: vbaOpen, onToggle: () => setVbaOpen(o => !o) } : undefined}
                onReset={() => setConfirm({ kind: 'reset' })}
              />
              <div className="flex-1 min-h-0 relative">
                <Spreadsheet
                  sheet={sheet}
                  marks={marks}
                  focusCells={task?.cells || undefined}
                  onSelectionChange={(range, active) => setSel({ range, active })}
                  apiRef={apiRef}
                />
              </div>
              {vbaOpen && showVba && (
                <div className="h-[46%] min-h-[240px] border-t border-edge-bright flex flex-col overflow-hidden">
                  <VbaPanel
                    key={vbaKey}
                    sheet={sheet}
                    task={sandbox ? undefined : vbaTask}
                    code={vbaCode}
                    onCodeChange={code => setExtras(x => ({ ...x, vba: { ...x.vba, [vbaKey]: code } }))}
                    activeCell={sel.active}
                    selection={sel.range}
                    onRun={onVbaRun}
                  />
                </div>
              )}
              <StatusBar sheet={sheet} version={version} selection={sel.range} message={status} f9Hint={f9Hint} onRecalc={recalc} />
            </>
          ) : loadError ? (
            <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-wrong" role="alert">
              This exercise could not be loaded: {loadError}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-ink-muted">
              <LoaderCircle size={16} className="animate-spin" /> Loading the sheet…
            </div>
          )}
        </section>
      </div>

      {Dlg && sheet && (
        <Dlg sheet={sheet} selection={sel.range} task={task} onClose={() => setTool(null)} onDone={toolDone} />
      )}
      {customFmt && sheet && (
        <CustomFormatDialog
          current={sheet.fmt(sel.active)}
          sample={sheet.values(sel.active)[0]?.[0] ?? null}
          target={sel.range}
          onApply={applyFormat}
          onClose={() => setCustomFmt(false)}
        />
      )}
      {confirm?.kind === 'reset' && (
        <ConfirmDialog
          title={sandbox ? 'Clear the sandbox?' : 'Reset this exercise?'}
          confirmLabel={sandbox ? 'Clear' : 'Reset'}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); doReset() }}
        >
          {sandbox
            ? 'Every cell, format, data table and macro in the sandbox is removed. This cannot be undone.'
            : 'Your entries, tool results, notes and macros for this exercise are removed and the sheet goes back to the start. Solved tasks stay counted.'}
        </ConfirmDialog>
      )}
      {confirm?.kind === 'reveal' && (
        <ConfirmDialog
          title={`Reveal task ${exercise.tasks.indexOf(confirm.task) + 1}?`}
          confirmLabel="Reveal"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const t = confirm.task; setConfirm(null); doReveal(t) }}
        >
          The reference answer is written into {confirm.task.cells || 'the sheet'}{confirm.task.kind === 'vba' ? ' and the VBA editor' : ''}, replacing what you entered there. Try a hint first if you have not.
        </ConfirmDialog>
      )}
    </DialogDockContext.Provider>
  )
}
