import { useId, useState } from 'react'
import type { LabSheet, ToolDialogProps } from '../types'
import { absRange, applyAdvancedFilter, runAdvancedFilter, showAllRows } from '../tools/advFilter'
import Dialog from './Dialog'
import RefField, { useRefPicker } from './RefField'
import { normRef, refProblem } from './refUtil'
import { startRegion } from './toolRange'
import { btnPrimary, btnSecondary } from './ui'

interface Remembered { action: 'inplace' | 'copy'; list: string; criteria: string; copyTo: string; unique: boolean }
// Excel keeps the last ranges with the sheet (the hidden names _FilterDatabase, Criteria, Extract)
const lastSetup = new WeakMap<LabSheet, Remembered>()

interface Outcome { found: number; total: number; notes: string[]; copied?: string }

function defaults(sheet: LabSheet, selection: string, task: ToolDialogProps['task']): Remembered {
  const prev = lastSetup.get(sheet)
  if (task?.kind === 'criteria' && task.criteria) {
    return { action: prev?.action ?? 'inplace', list: task.criteria.list, criteria: task.cells, copyTo: prev?.copyTo ?? '', unique: task.criteria.unique ?? false }
  }
  if (prev) return prev
  const region = startRegion(sheet, selection)
  return { action: 'inplace', list: region ? absRange(region) : '', criteria: '', copyTo: '', unique: false }
}

export default function AdvancedFilterDialog({ sheet, selection, task, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const [start] = useState(() => defaults(sheet, selection, task))
  const [action, setAction] = useState(start.action)
  const [list, setList] = useState(start.list)
  const [criteria, setCriteria] = useState(start.criteria)
  const [copyTo, setCopyTo] = useState(start.copyTo)
  const [unique, setUnique] = useState(start.unique)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const ids = { unique: useId(), result: useId() }
  const dims = { rows: sheet.rows, cols: sheet.cols }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    const l = refProblem(list, dims)
    if (l) e.list = l
    const c = refProblem(criteria, { ...dims, optional: true })
    if (c) e.criteria = c
    if (action === 'copy') {
      const t = refProblem(copyTo, dims)
      if (t) e.copyTo = t
    }
    return e
  }

  const ok = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    const setup = {
      list: normRef(list),
      criteria: normRef(criteria),
      ...(action === 'copy' ? { copyTo: normRef(copyTo) } : {}),
      unique,
    }
    lastSetup.set(sheet, { action, list, criteria, copyTo, unique })
    const run = runAdvancedFilter(sheet, setup)
    if (run.error) {
      setErrors({ form: run.error })
      return
    }
    const res = applyAdvancedFilter(sheet, setup)
    if (!res.ok) {
      setErrors({ form: res.message })
      return
    }
    const found = run.rows.length
    const total = run.total ?? found
    const summary = action === 'copy'
      ? `Advanced Filter: ${found} of ${total} records copied to ${normRef(copyTo)}`
      : `Advanced Filter: ${found} of ${total} records found`
    onDone(summary)
    if (run.notes?.length) setOutcome({ found, total, notes: run.notes, ...(action === 'copy' ? { copied: normRef(copyTo) } : {}) })
    else onClose()
  }

  const clear = () => {
    showAllRows(sheet)
    onDone('Filter cleared: every row is shown')
    onClose()
  }

  if (outcome) {
    return (
      <Dialog
        title="Advanced Filter"
        onClose={onClose}
        describedBy={ids.result}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setOutcome(null)}>Back</button>
            <button type="button" data-autofocus className={btnPrimary} onClick={onClose}>OK</button>
          </>
        }
      >
        <p id={ids.result} className="text-ink">
          {outcome.copied ? `${outcome.found} of ${outcome.total} records copied to ${outcome.copied}.` : `${outcome.found} of ${outcome.total} records found.`}
        </p>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-s4">Check your criteria range:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs leading-relaxed">
            {outcome.notes.map(n => <li key={n}>{n}</li>)}
          </ul>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      title="Advanced Filter"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={`${btnSecondary} mr-auto`} onClick={clear} disabled={sheet.hiddenRows.size === 0} title="Data > Clear: show every row again">
            Clear filter
          </button>
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={ok}>OK</button>
        </>
      }
    >
      <form
        onSubmit={e => { e.preventDefault(); ok() }}
        onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'radio') { e.preventDefault(); ok() } }}
        onFocusCapture={picker.onFocusCapture}
        className="space-y-3"
      >
        <fieldset>
          <legend className="block text-xs font-medium text-ink-secondary mb-1">Action</legend>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="radio" name="af-action" checked={action === 'inplace'} onChange={() => setAction('inplace')} className="accent-glow" />
              Filter the list, in-place
            </label>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="radio" name="af-action" checked={action === 'copy'} onChange={() => setAction('copy')} className="accent-glow" />
              Copy to another location
            </label>
          </div>
        </fieldset>
        <RefField label="List range:" value={list} onChange={setList} picker={picker} pickKey="list" error={errors.list} autoFocus placeholder="e.g. $A$8:$K$68" />
        <RefField label="Criteria range:" value={criteria} onChange={setCriteria} picker={picker} pickKey="criteria" error={errors.criteria} placeholder="e.g. $A$1:$B$2" />
        <RefField label="Copy to:" value={copyTo} onChange={setCopyTo} picker={picker} pickKey="copyTo" error={errors.copyTo} placeholder="e.g. $N$8" disabled={action !== 'copy'} />
        <label htmlFor={ids.unique} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input id={ids.unique} type="checkbox" checked={unique} onChange={e => setUnique(e.target.checked)} className="accent-glow" />
          Unique records only
        </label>
        {errors.form && <p role="alert" className="text-xs text-wrong">{errors.form}</p>}
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer select-none hover:text-ink-secondary">Criteria rules</summary>
          <ul className="list-disc pl-5 mt-1.5 space-y-1 leading-relaxed">
            <li>Criteria headers must match the list headers. Same row = AND, separate rows = OR, a blank cell = no condition.</li>
            <li>Text means "begins with": North also keeps North-East. Type <code className="font-mono text-ink-secondary">="=North"</code> for an exact match.</li>
            <li>Operators &gt; &gt;= &lt; &lt;= &lt;&gt; work on numbers and dates (&gt;=1 Mar 2026). Wildcards: ? one character, * any run.</li>
            <li>Computed criteria: a TRUE/FALSE formula for the first record (relative row) under a header that is blank or not a field name.</li>
            <li>Copy to: a blank cell copies every column; typed field names copy only those columns, in that order.</li>
          </ul>
        </details>
      </form>
    </Dialog>
  )
}
