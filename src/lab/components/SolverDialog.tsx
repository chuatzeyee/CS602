import { useEffect, useId, useRef, useState } from 'react'
import type { LabSheet, Relation, SolverSetup, ToolDialogProps } from '../types'
import { MAX_SOLVER_SECONDS, runSolver, SOLVER_DEFAULTS, SOLVER_MESSAGES, solverOptionsProblem } from '../whatif'
import Dialog from './Dialog'
import RefField, { RefTip, useRefPicker } from './RefField'
import { cellsOf, firstCell, normRef, refProblem } from './refUtil'
import { restoreAfterRun } from './toolUndo'
import { btnPrimary, btnSecondary, input, label, monoInput } from './ui'

interface Row { lhs: string; relation: Relation; rhs: string }
interface Model {
  objective: string
  sense: SolverSetup['sense']
  goal: string
  changing: string
  constraints: Row[]
  nonNegative: boolean
  engine: 'simplex' | 'grg'
  maxTime: string            // Options, as typed
  integerOptimality: string
}
// Excel keeps the Solver model with the sheet: reopen shows the last one
const lastModel = new WeakMap<LabSheet, Model>()

const RELATIONS: { value: Relation; label: string }[] = [
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '>=', label: '>=' },
  { value: 'int', label: 'int' },
  { value: 'bin', label: 'bin' },
]
const needsRhs = (r: Relation) => r !== 'int' && r !== 'bin'
const rowText = (c: Row) => needsRhs(c.relation) ? `${c.lhs} ${c.relation} ${c.rhs}` : `${c.lhs} = ${c.relation === 'int' ? 'integer' : 'binary'}`
const isNum = (s: string) => s.trim() !== '' && Number.isFinite(Number(s.replace(/,/g, '')))
const optionNumber = (s: string) => (isNum(s.replace(/%\s*$/, '')) ? Number(s.replace(/%\s*$/, '').replace(/,/g, '')) : Number.NaN)

interface Outcome { status: string; message: string; objective: string; snapshot: Record<string, string>; version: number }

export default function SolverDialog({ sheet, selection, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const prev = lastModel.get(sheet)
  const [objective, setObjective] = useState(prev?.objective ?? firstCell(selection))
  const [sense, setSense] = useState<SolverSetup['sense']>(prev?.sense ?? 'max')
  const [goal, setGoal] = useState(prev?.goal ?? '0')
  const [changing, setChanging] = useState(prev?.changing ?? '')
  const [rows, setRows] = useState<Row[]>(prev?.constraints ?? [])
  const [picked, setPicked] = useState<number | null>(null)
  const [nonNegative, setNonNegative] = useState(prev?.nonNegative ?? true)
  const [engine, setEngine] = useState<'simplex' | 'grg'>(prev?.engine ?? 'simplex')
  const [maxTime, setMaxTime] = useState(prev?.maxTime ?? String(SOLVER_DEFAULTS.maxTime))
  const [integerOptimality, setIntegerOptimality] = useState(prev?.integerOptimality ?? String(SOLVER_DEFAULTS.integerOptimality))
  const [showOptions, setShowOptions] = useState(false)
  const [editing, setEditing] = useState<{ index: number | null } | null>(null)
  const [dLhs, setDLhs] = useState('')
  const [dRel, setDRel] = useState<Relation>('<=')
  const [dRhs, setDRhs] = useState('')
  const [dErr, setDErr] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const ids = { value: useId(), list: useId(), engine: useId(), rel: useId(), nonneg: useId(), maxTime: useId(), intOpt: useId() }
  const editorRef = useRef<HTMLDivElement>(null)
  const editorOpen = editing !== null

  useEffect(() => {
    if (editorOpen) editorRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [editorOpen])
  const dims = { rows: sheet.rows, cols: sheet.cols }

  const openEditor = (index: number | null) => {
    const c = index === null ? undefined : rows[index]
    setDLhs(c?.lhs ?? '')
    setDRel(c?.relation ?? '<=')
    setDRhs(c?.rhs ?? '')
    setDErr({})
    setEditing({ index })
  }

  const commitDraft = (again: boolean) => {
    const e: Record<string, string> = {}
    const l = refProblem(dLhs, dims)
    if (l) e.lhs = l
    if (needsRhs(dRel)) {
      if (!dRhs.trim()) e.rhs = 'Enter a number or a cell reference.'
      else if (!isNum(dRhs)) {
        const r = refProblem(dRhs, dims)
        if (r) e.rhs = r
      }
    }
    setDErr(e)
    if (Object.keys(e).length || !editing) return
    const row: Row = { lhs: normRef(dLhs), relation: dRel, rhs: needsRhs(dRel) ? (isNum(dRhs) ? dRhs.trim() : normRef(dRhs)) : '' }
    if (editing.index === null) setRows(rs => [...rs, row])
    else setRows(rs => rs.map((r, i) => (i === editing.index ? row : r)))
    if (again) {
      setDLhs('')
      setDRhs('')
      setEditing({ index: null })
    } else setEditing(null)
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    const o = refProblem(objective, { ...dims, single: true })
    if (o) e.objective = o
    else if (!sheet.raw(normRef(objective)).startsWith('=')) e.objective = 'The objective cell must contain a formula.'
    if (sense === 'value' && !isNum(goal)) e.goal = 'Enter a number.'
    const c = refProblem(changing, { ...dims, multi: true })
    if (c) e.changing = c
    else {
      const bad = cellsOf(changing).find(ref => !sheet.editable(ref) || sheet.raw(ref).startsWith('='))
      if (bad) e.changing = `${bad} holds a formula or is locked: variable cells must be input values.`
    }
    const opt = solverOptionsProblem({ maxTime: optionNumber(maxTime), integerOptimality: optionNumber(integerOptimality) })
    if (opt?.maxTime) e.maxTime = opt.maxTime
    if (opt?.integerOptimality) e.integerOptimality = opt.integerOptimality
    return e
  }

  const solve = () => {
    const e = validate()
    setErrors(e)
    if (e.maxTime || e.integerOptimality) setShowOptions(true)
    if (Object.keys(e).length) return
    const model: Model = { objective: normRef(objective), sense, goal, changing: normRef(changing), constraints: rows, nonNegative, engine, maxTime, integerOptimality }
    lastModel.set(sheet, model)
    const setup: SolverSetup = {
      objective: model.objective,
      sense,
      ...(sense === 'value' ? { valueOf: Number(goal.replace(/,/g, '')) } : {}),
      changing: model.changing,
      constraints: rows.map(r => ({
        lhs: r.lhs,
        relation: r.relation,
        ...(needsRhs(r.relation) ? { rhs: isNum(r.rhs) ? Number(r.rhs.replace(/,/g, '')) : r.rhs } : {}),
      })),
      nonNegative,
      engine,
    }
    const snapshot: Record<string, string> = {}
    for (const ref of cellsOf(model.changing)) snapshot[ref] = sheet.raw(ref)
    const options = { maxTime: optionNumber(maxTime), integerOptimality: optionNumber(integerOptimality) }
    // Solve runs while the page waits (Max Time bounds it): show "Solving..." first, then run
    setBusy(true)
    window.requestAnimationFrame(() => window.setTimeout(() => {
      if (!alive.current) return
      try {
        const res = runSolver(sheet, setup, options)
        setKeep(res.status === 'optimal' || res.status === 'stopped')
        setOutcome({ status: res.status, message: res.message, objective: model.objective, snapshot, version: sheet.version })
      } catch (err) {
        setErrors({ form: err instanceof Error ? err.message : 'Solver could not run this model.' })
      } finally {
        setBusy(false)
      }
    }, 0))
  }

  const finish = (keepIt: boolean) => {
    if (!outcome) return
    if (keepIt) {
      const kept = outcome.status === 'optimal' ? 'solution kept' : outcome.status === 'stopped' ? 'best solution so far kept (time limit)' : outcome.message
      onDone(`Solver: ${kept}; ${outcome.objective} = ${sheet.display(outcome.objective)}`)
    } else {
      // Solver wrote its result as one undo step: take it back, or rewrite the cells if the sheet changed since (toolUndo.ts)
      restoreAfterRun(sheet, outcome.snapshot, outcome.version)
      onDone('Solver: original values restored')
    }
    onClose()
  }

  if (outcome) {
    const ok = outcome.status === 'optimal'
    return (
      <Dialog
        title="Solver Results"
        onClose={() => finish(false)}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => finish(false)}>Cancel</button>
            <button type="button" data-autofocus className={btnPrimary} onClick={() => finish(keep)}>OK</button>
          </>
        }
      >
        <p className={ok ? 'text-ink' : 'text-s4'}>{outcome.message || (ok ? 'Solver found a solution. All Constraints and optimality conditions are satisfied.' : 'Solver could not find a feasible solution.')}</p>
        {outcome.status === 'stopped' && (
          <p className="text-xs text-ink-muted">The variable cells hold the best solution found in that time, which may not be the best there is. Allow more time under Options to search further.</p>
        )}
        {outcome.message === SOLVER_MESSAGES.integerTolerance && (
          <p className="text-xs text-ink-muted">This whole-number solution is within Integer Optimality of the best possible. Set Integer Optimality to 0 under Options to make Solver prove the optimum.</p>
        )}
        <p className="font-mono text-xs"><span className="text-ink-muted">Objective {outcome.objective}:</span> <span className="text-ink">{sheet.display(outcome.objective)}</span></p>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Keep or restore</legend>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="radio" name="keep" checked={keep} onChange={() => setKeep(true)} className="accent-glow" /> Keep Solver Solution
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="radio" name="keep" checked={!keep} onChange={() => setKeep(false)} className="accent-glow" /> Restore Original Values
          </label>
        </fieldset>
      </Dialog>
    )
  }

  return (
    <Dialog
      title="Solver Parameters"
      onClose={onClose}
      width="sm:w-[460px]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={btnPrimary} onClick={solve} disabled={editing !== null || busy}>{busy ? 'Solving...' : 'Solve'}</button>
        </>
      }
    >
      <div onFocusCapture={picker.onFocusCapture} className="space-y-3">
        <RefField label="Set Objective:" value={objective} onChange={setObjective} picker={picker} pickKey="objective" error={errors.objective} autoFocus placeholder="F12" />
        <fieldset>
          <legend className={label}>To:</legend>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(['max', 'min', 'value'] as const).map(s => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-ink cursor-pointer">
                <input type="radio" name="sense" checked={sense === s} onChange={() => setSense(s)} className="accent-glow" />
                {s === 'max' ? 'Max' : s === 'min' ? 'Min' : 'Value Of:'}
              </label>
            ))}
            <input
              id={ids.value}
              aria-label="Value of"
              value={goal}
              inputMode="decimal"
              disabled={sense !== 'value'}
              onChange={e => setGoal(e.target.value)}
              className={`${monoInput} !w-28 ${errors.goal ? 'border-wrong/60' : ''}`}
            />
          </div>
          {errors.goal && <p className="text-[11px] text-wrong mt-1">{errors.goal}</p>}
        </fieldset>
        <RefField label="By Changing Variable Cells:" value={changing} onChange={setChanging} picker={picker} pickKey="changing" error={errors.changing} placeholder="B4:D4" />

        <div>
          <p id={ids.list} className={label}>Subject to the Constraints:</p>
          <div role="listbox" aria-labelledby={ids.list} className="min-h-[5.5rem] max-h-40 overflow-y-auto bg-surface border border-edge rounded-md py-1">
            {rows.length === 0 && <p className="px-2.5 py-1.5 text-xs text-ink-faint">No constraints yet.</p>}
            {rows.map((c, i) => (
              <button
                key={`${i}-${rowText(c)}`}
                type="button"
                role="option"
                aria-selected={picked === i}
                onClick={() => setPicked(i)}
                onDoubleClick={() => openEditor(i)}
                className={`block w-full text-left px-2.5 py-1 font-mono text-xs ${picked === i ? 'bg-glow-dim text-glow' : 'text-ink hover:bg-raised'}`}
              >
                {rowText(c)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button type="button" className={btnSecondary} onClick={() => openEditor(null)} disabled={editing !== null}>Add</button>
            <button type="button" className={btnSecondary} onClick={() => picked !== null && openEditor(picked)} disabled={picked === null || editing !== null}>Change</button>
            <button
              type="button"
              className={btnSecondary}
              disabled={picked === null || editing !== null}
              onClick={() => { setRows(rs => rs.filter((_, i) => i !== picked)); setPicked(null) }}
            >
              Delete
            </button>
            <button type="button" className={btnSecondary} disabled={!rows.length || editing !== null} onClick={() => { setRows([]); setPicked(null) }}>Reset All</button>
          </div>
        </div>

        {editing && (
          <div ref={editorRef} className="bg-raised border border-edge-bright rounded-lg p-3 space-y-2.5 animate-fade-in" role="group" aria-label={editing.index === null ? 'Add Constraint' : 'Change Constraint'}>
            <p className="text-xs font-semibold text-ink">{editing.index === null ? 'Add Constraint' : 'Change Constraint'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:items-start">
              <RefField label="Cell Reference:" value={dLhs} onChange={setDLhs} picker={picker} pickKey="lhs" error={dErr.lhs} autoFocus placeholder="B4:D4" />
              <div>
                <label htmlFor={ids.rel} className={label}>&nbsp;</label>
                <select id={ids.rel} aria-label="Relation" value={dRel} onChange={e => setDRel(e.target.value as Relation)} className={`${input} font-mono !w-20`}>
                  {RELATIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {needsRhs(dRel) ? (
                <RefField label="Constraint:" value={dRhs} onChange={setDRhs} picker={picker} pickKey="rhs" error={dErr.rhs} placeholder="10 or F4" />
              ) : (
                <div>
                  <span className={label}>Constraint:</span>
                  <p className="text-xs font-mono text-ink-muted py-2">{dRel === 'int' ? 'integer' : 'binary'}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-1.5">
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
              {editing.index === null && <button type="button" className={btnSecondary} onClick={() => commitDraft(true)}>Add</button>}
              <button type="button" className={btnPrimary} onClick={() => commitDraft(false)}>OK</button>
            </div>
          </div>
        )}

        <label htmlFor={ids.nonneg} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input id={ids.nonneg} type="checkbox" checked={nonNegative} onChange={e => setNonNegative(e.target.checked)} className="accent-glow" />
          Make Unconstrained Variables Non-Negative
        </label>
        <div>
          <label htmlFor={ids.engine} className={label}>Select a Solving Method:</label>
          <select id={ids.engine} value={engine} onChange={e => setEngine(e.target.value as 'simplex' | 'grg')} className={input}>
            <option value="simplex">Simplex LP</option>
            <option value="grg">GRG Nonlinear</option>
          </select>
          <p className="text-[11px] text-ink-muted mt-1">
            {engine === 'simplex'
              ? 'For linear models: objective and constraints are sums of variables times constants. Step lookups and IFs on the variables break linearity.'
              : 'For smooth nonlinear models. It finds a local optimum from the current values, so try different starting values.'}
          </p>
        </div>
        <details open={showOptions} onToggle={e => setShowOptions(e.currentTarget.open)} className="bg-surface border border-edge rounded-md">
          <summary className="cursor-pointer select-none px-2.5 py-1.5 text-xs font-medium text-ink-secondary">Options</summary>
          <div className="grid grid-cols-2 gap-3 px-2.5 pb-2.5">
            <div>
              <label htmlFor={ids.maxTime} className={label}>Max Time (s):</label>
              <input
                id={ids.maxTime}
                value={maxTime}
                inputMode="decimal"
                aria-invalid={!!errors.maxTime}
                onChange={e => setMaxTime(e.target.value)}
                className={`${monoInput} ${errors.maxTime ? 'border-wrong/60' : ''}`}
              />
              {errors.maxTime && <p className="text-[11px] text-wrong mt-1">{errors.maxTime}</p>}
            </div>
            <div>
              <label htmlFor={ids.intOpt} className={label}>Integer Optimality (%):</label>
              <input
                id={ids.intOpt}
                value={integerOptimality}
                inputMode="decimal"
                aria-invalid={!!errors.integerOptimality}
                onChange={e => setIntegerOptimality(e.target.value)}
                className={`${monoInput} ${errors.integerOptimality ? 'border-wrong/60' : ''}`}
              />
              {errors.integerOptimality && <p className="text-[11px] text-wrong mt-1">{errors.integerOptimality}</p>}
            </div>
            <p className="col-span-2 text-[11px] text-ink-muted">
              {`Solver stops after Max Time (up to ${MAX_SOLVER_SECONDS} s here) with the best solution found so far. With integer or binary constraints it accepts a whole-number solution within Integer Optimality of the best possible; 0 makes it prove the optimum, which can take much longer.`}
            </p>
          </div>
        </details>
        {errors.form && <p className="text-xs text-wrong">{errors.form}</p>}
        <RefTip />
      </div>
    </Dialog>
  )
}
