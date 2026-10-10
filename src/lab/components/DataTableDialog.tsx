import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ToolDialogProps } from '../types'
import Dialog from './Dialog'
import RefField, { RefTip, useRefPicker } from './RefField'
import { box, normRef, refProblem } from './refUtil'
import { btnPrimary, btnSecondary } from './ui'

// Excel: select the whole table block (formula row/column + input values), then What-If Analysis > Data Table
export default function DataTableDialog({ sheet, selection, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const [range, setRange] = useState(normRef(selection.split(',')[0] ?? ''))
  const [rowInput, setRowInput] = useState('')
  const [colInput, setColInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tables, setTables] = useState(() => [...sheet.dataTables])

  const run = () => {
    const e: Record<string, string> = {}
    const dims = { rows: sheet.rows, cols: sheet.cols }
    const r = refProblem(range, dims)
    const b = box(range)
    if (r) e.range = r
    else if (b && (b.r2 === b.r1 || b.c2 === b.c1)) e.range = 'Select the whole table: the formula row or column plus the input values (at least 2 x 2).'
    const ri = refProblem(rowInput, { ...dims, single: true, optional: true })
    const ci = refProblem(colInput, { ...dims, single: true, optional: true })
    if (ri) e.rowInput = ri
    if (ci) e.colInput = ci
    if (!ri && !ci && !normRef(rowInput) && !normRef(colInput)) e.form = 'Input cell reference is not valid: fill the row input cell, the column input cell, or both.'
    setErrors(e)
    if (Object.keys(e).length) return
    const def = {
      range: normRef(range),
      ...(normRef(rowInput) ? { rowInput: normRef(rowInput) } : {}),
      ...(normRef(colInput) ? { colInput: normRef(colInput) } : {}),
    }
    const res = sheet.addDataTable(def)
    if (!res.ok) {
      setErrors({ form: res.message })
      return
    }
    const inputs = [def.rowInput && `row input ${def.rowInput}`, def.colInput && `column input ${def.colInput}`].filter(Boolean).join(', ')
    onDone(`Data table ${def.range} filled (${inputs})`)
    onClose()
  }

  const remove = (r: string) => {
    sheet.removeDataTable(r)
    setTables([...sheet.dataTables])
    onDone(`Data table ${r} removed`)
  }

  return (
    <Dialog
      title="Data Table"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={run}>OK</button>
        </>
      }
    >
      <div
        onFocusCapture={picker.onFocusCapture}
        onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); run() } }}
        className="space-y-3"
      >
        <RefField label="Table range (the selection):" value={range} onChange={setRange} picker={picker} pickKey="range" error={errors.range} placeholder="E4:H24" />
        <RefField label="Row input cell:" value={rowInput} onChange={setRowInput} picker={picker} pickKey="row" error={errors.rowInput} autoFocus placeholder="(blank)" />
        <RefField label="Column input cell:" value={colInput} onChange={setColInput} picker={picker} pickKey="col" error={errors.colInput} placeholder="(blank)" />
        {errors.form && <p className="text-xs text-wrong">{errors.form}</p>}
        <RefTip />
        <div className="text-xs text-ink-muted leading-relaxed bg-raised border border-edge rounded-md px-3 py-2 space-y-1">
          <p><span className="text-ink-secondary">One variable:</span> inputs down the first column and formulas across the top row (top-left cell blank): use the <em>column</em> input cell. Inputs across the top row: use the row input cell.</p>
          <p><span className="text-ink-secondary">Two variables:</span> one formula in the top-left corner, row inputs across, column inputs down: fill both.</p>
          <p><span className="text-ink-secondary">Monte Carlo trick:</span> number the runs 1, 2, 3… down the first column, put the output formulas in the top row, and point the column input cell at any blank cell: each row recalculates the model with fresh random draws.</p>
          <p>Tables are recalculated when you press F9 (Calculate Now), not after every edit.</p>
        </div>
        {tables.length > 0 && (
          <div>
            <p className="text-xs font-medium text-ink-secondary mb-1">Data tables on this sheet</p>
            <ul className="space-y-1">
              {tables.map(t => (
                <li key={t.range} className="flex items-center justify-between gap-2 text-xs font-mono bg-surface border border-edge rounded px-2 py-1">
                  <span className="text-ink">{t.range}<span className="text-ink-muted"> {t.rowInput ? `row ${t.rowInput}` : ''}{t.rowInput && t.colInput ? ', ' : ''}{t.colInput ? `col ${t.colInput}` : ''}</span></span>
                  <button type="button" onClick={() => remove(t.range)} aria-label={`Remove data table ${t.range}`} className="p-1 rounded text-ink-muted hover:text-wrong"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}
