import { useId, useMemo, useState } from 'react'
import { format as ssfFormat } from 'ssf'
import type { CellValue } from '../types'
import Dialog from './Dialog'
import { btnPrimary, btnSecondary, label, monoInput } from './ui'

const PRESETS = ['0', '0.00', '#,##0', '#,##0.00', '$#,##0.00', '0%', '0.00%', '0.0000', 'dd-mmm-yy', 'd/m/yyyy', 'ddd', 'hh:mm', 'hh:mm:ss', 'mm:ss', '[h]:mm', '[h]:mm:ss', '[mm]:ss', '@']

interface CustomFormatDialogProps {
  current?: string
  sample: CellValue
  target: string
  onApply(code: string | undefined): void
  onClose(): void
}

function preview(code: string, v: CellValue): string {
  if (v === null || v === '') return '(blank cell)'
  try {
    return ssfFormat(code || 'General', v)
  } catch {
    return '(invalid format)'
  }
}

// Format Cells > Number > Custom
export default function CustomFormatDialog({ current, sample, target, onApply, onClose }: CustomFormatDialogProps) {
  const [code, setCode] = useState(current ?? '')
  const id = useId()
  const shown = useMemo(() => preview(code, sample), [code, sample])
  const apply = () => { onApply(code.trim() || undefined); onClose() }

  return (
    <Dialog
      title="Format Cells: Custom"
      onClose={onClose}
      modal
      width="sm:w-[420px]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={apply}>OK</button>
        </>
      }
    >
      <p className="text-xs">Applies to <span className="font-mono text-ink">{target}</span>.</p>
      <div>
        <label htmlFor={id} className={label}>Type:</label>
        <input
          id={id}
          data-autofocus
          value={code}
          spellCheck={false}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
          placeholder="General"
          className={monoInput}
        />
      </div>
      <p className="text-xs">Sample: <span className="font-mono text-ink">{shown}</span></p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common formats">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setCode(p)}
            className={`px-2 py-1 rounded border font-mono text-[11px] ${code === p ? 'bg-glow-dim text-glow border-glow/30' : 'bg-surface text-ink-secondary border-edge hover:text-ink'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed">
        Durations: <span className="font-mono">[h]:mm</span> keeps counting past 24 hours. Times are fractions of a day, so 0.5 shows as 12:00.
      </p>
    </Dialog>
  )
}
