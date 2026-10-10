import { useCallback, useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { Crosshair } from 'lucide-react'
import { normRef } from './refUtil'
import { label as labelCls, monoInput } from './ui'

// Excel RefEdit behaviour: the last focused ref field is "armed"; selecting cells in the grid while it is armed fills it.
export function useRefPicker(selection: string) {
  const [armed, setArmed] = useState<string | null>(null)
  const setter = useRef<((v: string) => void) | null>(null)
  const prev = useRef(selection)

  useEffect(() => {
    if (prev.current === selection) return
    prev.current = selection
    setter.current?.(normRef(selection))
  }, [selection])

  const arm = useCallback((key: string, set: (v: string) => void) => {
    setArmed(key)
    setter.current = set
  }, [])
  const disarm = useCallback(() => {
    setArmed(null)
    setter.current = null
  }, [])
  // put on the dialog body: focusing anything that is not a ref field disarms
  const onFocusCapture = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!(e.target instanceof HTMLElement) || e.target.dataset.refField === undefined) disarm()
  }, [disarm])

  return { armed, arm, disarm, onFocusCapture, selection }
}
export type RefPicker = ReturnType<typeof useRefPicker>

interface RefFieldProps {
  label: string
  value: string
  onChange(v: string): void   // keep it stable (a state setter): it is captured when the field is armed
  picker: RefPicker
  pickKey: string
  error?: string
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
}

export default function RefField({ label, value, onChange, picker, pickKey, error, placeholder, autoFocus, disabled }: RefFieldProps) {
  const id = useId()
  const armed = picker.armed === pickKey
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="flex gap-1.5">
        <input
          id={id}
          data-ref-field=""
          data-autofocus={autoFocus || undefined}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={e => onChange(e.target.value)}
          onFocus={() => picker.arm(pickKey, onChange)}
          className={`${monoInput} ${armed ? '!border-glow/60' : ''} ${error ? 'border-wrong/60' : ''}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(normRef(picker.selection))}
          title={`Use the grid selection (${picker.selection})`}
          aria-label={`Use the grid selection ${picker.selection} for ${label}`}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2 rounded-md border bg-raised hover:text-glow hover:border-glow/30 text-[11px] font-mono disabled:opacity-40 ${
            armed ? 'text-glow border-glow/30' : 'text-ink-muted border-edge'
          }`}
        >
          <Crosshair size={13} />
          <span className="hidden sm:inline max-w-[5.5rem] truncate">{picker.selection}</span>
        </button>
      </div>
      {error && <p id={`${id}-err`} className="text-[11px] text-wrong mt-1">{error}</p>}
    </div>
  )
}

// static (no layout shift while fields arm and disarm, so a click never lands on a moved button)
export function RefTip() {
  return (
    <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink-muted">
      <Crosshair size={12} className="flex-shrink-0" /> Click a reference box, then select cells on the sheet to fill it.
    </p>
  )
}
