import { useId, useState } from 'react'
import type { LabSheet, ToolDialogProps } from '../types'
import { runGoalSeek } from '../whatif'
import Dialog from './Dialog'
import RefField, { RefTip, useRefPicker } from './RefField'
import { firstCell, normRef, refProblem } from './refUtil'
import { restoreAfterRun } from './toolUndo'
import { btnPrimary, btnSecondary, label, monoInput } from './ui'

interface Remembered { setCell: string; toValue: string; changingCell: string }
const lastSetup = new WeakMap<LabSheet, Remembered>()

interface Outcome { found: boolean; message: string; changing: string; original: string; setCell: string; target: number; version: number }

export default function GoalSeekDialog({ sheet, selection, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const prev = lastSetup.get(sheet)
  const [setCell, setSetCell] = useState(prev?.setCell ?? firstCell(selection))
  const [toValue, setToValue] = useState(prev?.toValue ?? '')
  const [changing, setChanging] = useState(prev?.changingCell ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const valueId = useId()

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    const dims = { rows: sheet.rows, cols: sheet.cols, single: true }
    const s = refProblem(setCell, dims)
    const c = refProblem(changing, dims)
    if (s) e.setCell = s
    else if (!sheet.raw(normRef(setCell)).startsWith('=')) e.setCell = 'Set cell must contain a formula.'
    if (toValue.trim() === '' || !Number.isFinite(Number(toValue.replace(/,/g, '')))) e.toValue = 'Enter a number.'
    if (c) e.changing = c
    else if (sheet.raw(normRef(changing)).startsWith('=')) e.changing = 'By changing cell must contain a value, not a formula.'
    else if (!sheet.editable(normRef(changing))) e.changing = 'That cell is locked; pick an input cell.'
    return e
  }

  const run = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    const sc = normRef(setCell)
    const cc = normRef(changing)
    const target = Number(toValue.replace(/,/g, ''))
    lastSetup.set(sheet, { setCell: sc, toValue, changingCell: cc })
    const original = sheet.raw(cc)
    try {
      const res = runGoalSeek(sheet, { setCell: sc, toValue: target, changingCell: cc })
      setOutcome({ found: res.found, message: res.message, changing: cc, original, setCell: sc, target, version: sheet.version })
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Goal Seek could not run.' })
    }
  }

  const finish = (keep: boolean) => {
    if (!outcome) return
    if (!keep) {
      // Goal Seek wrote one undo step: take it back so Cancel leaves no trace, like Excel (toolUndo.ts)
      restoreAfterRun(sheet, { [outcome.changing]: outcome.original }, outcome.version)
      onDone(`Goal Seek cancelled: ${outcome.changing} restored`)
    } else {
      onDone(outcome.found
        ? `Goal Seek found a solution: ${outcome.changing} = ${sheet.display(outcome.changing)}`
        : `Goal Seek may not have found a solution: ${outcome.changing} = ${sheet.display(outcome.changing)}`)
    }
    onClose()
  }

  if (outcome) {
    return (
      <Dialog
        title="Goal Seek Status"
        onClose={() => finish(false)}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => finish(false)}>Cancel</button>
            <button type="button" data-autofocus className={btnPrimary} onClick={() => finish(true)}>OK</button>
          </>
        }
      >
        <p className={outcome.found ? 'text-ink' : 'text-s4'}>
          {outcome.message || `Goal Seeking with Cell ${outcome.setCell} ${outcome.found ? 'found a solution.' : 'may not have found a solution.'}`}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-ink-muted">Target value:</dt><dd className="text-ink">{outcome.target}</dd>
          <dt className="text-ink-muted">Current value:</dt><dd className="text-ink">{sheet.display(outcome.setCell)}</dd>
          <dt className="text-ink-muted">{outcome.changing}:</dt><dd className="text-ink">{sheet.display(outcome.changing)}</dd>
        </dl>
        <p className="text-xs text-ink-muted">
          {outcome.found
            ? `OK keeps the new value in ${outcome.changing}; Cancel restores ${outcome.original === '' ? 'the blank cell' : outcome.original}.`
            : `${outcome.changing} was left as it was. Try another starting value in ${outcome.changing}, or check that ${outcome.setCell} depends on it.`}
        </p>
      </Dialog>
    )
  }

  return (
    <Dialog
      title="Goal Seek"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={run}>OK</button>
        </>
      }
    >
      <form
        onSubmit={e => { e.preventDefault(); run() }}
        onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); run() } }}
        onFocusCapture={picker.onFocusCapture}
        className="space-y-3"
      >
        <RefField label="Set cell:" value={setCell} onChange={setSetCell} picker={picker} pickKey="set" error={errors.setCell} autoFocus placeholder="B10" />
        <div>
          <label htmlFor={valueId} className={label}>To value:</label>
          <input
            id={valueId}
            value={toValue}
            inputMode="decimal"
            onChange={e => setToValue(e.target.value)}
            aria-invalid={errors.toValue ? true : undefined}
            className={`${monoInput} ${errors.toValue ? 'border-wrong/60' : ''}`}
            placeholder="0"
          />
          {errors.toValue && <p className="text-[11px] text-wrong mt-1">{errors.toValue}</p>}
        </div>
        <RefField label="By changing cell:" value={changing} onChange={setChanging} picker={picker} pickKey="changing" error={errors.changing} placeholder="B4" />
        {errors.form && <p className="text-xs text-wrong">{errors.form}</p>}
        <RefTip />
      </form>
    </Dialog>
  )
}
