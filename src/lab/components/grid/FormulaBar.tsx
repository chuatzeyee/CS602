import { useState, type FocusEvent, type KeyboardEvent, type RefObject, type SyntheticEvent } from 'react'
import { Check, Lock, X } from 'lucide-react'

interface FormulaBarProps {
  gridId: string
  selectionText: string
  onNameSubmit(text: string): boolean
  onNameDone(): void
  value: string
  editing: boolean
  locked: boolean
  lockReason?: string
  inputRef: RefObject<HTMLInputElement | null>
  onBarFocus(caret: number): void
  onBarChange(text: string, caret: number): void
  onBarSelect(caret: number): void
  onBarKeyDown(e: KeyboardEvent<HTMLInputElement>): void
  onBarBlur(e: FocusEvent<HTMLInputElement>): void
  onCancel(): void
  onEnter(): void
  showFormulas: boolean
  onToggleFormulas(): void
  mode: string
}

const caretOf = (e: SyntheticEvent<HTMLInputElement>) => e.currentTarget.selectionStart ?? e.currentTarget.value.length

export default function FormulaBar(p: FormulaBarProps) {
  const [nameDraft, setNameDraft] = useState<string | null>(null)

  const nameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (p.onNameSubmit(e.currentTarget.value)) { setNameDraft(null); p.onNameDone() }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setNameDraft(null)
      p.onNameDone()
    }
  }

  return (
    <div className="flex items-stretch gap-1.5 p-1.5 border-b border-edge bg-surface">
      <input
        aria-label="Name box"
        value={nameDraft ?? p.selectionText}
        onChange={e => setNameDraft(e.target.value)}
        onFocus={e => { setNameDraft(p.selectionText); e.currentTarget.select() }}
        onBlur={() => setNameDraft(null)}
        onKeyDown={nameKey}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        className="w-[4.75rem] sm:w-28 flex-none bg-base border border-edge rounded px-1.5 py-1 font-mono text-xs text-ink focus:outline-none focus:border-glow/50"
      />
      <div className="flex flex-none items-center gap-0.5">
        <button
          type="button"
          aria-label="Cancel entry"
          title="Cancel (Esc)"
          disabled={!p.editing}
          onMouseDown={e => e.preventDefault()}
          onClick={p.onCancel}
          className="p-1 rounded text-ink-muted hover:text-wrong hover:bg-raised disabled:opacity-25 disabled:pointer-events-none"
        >
          <X size={14} />
        </button>
        <button
          type="button"
          aria-label="Enter"
          title="Enter"
          disabled={!p.editing}
          onMouseDown={e => e.preventDefault()}
          onClick={p.onEnter}
          className="p-1 rounded text-ink-muted hover:text-glow hover:bg-raised disabled:opacity-25 disabled:pointer-events-none"
        >
          <Check size={14} />
        </button>
        <span className="px-1 font-mono text-xs italic text-ink-muted select-none" aria-hidden="true">fx</span>
      </div>
      <div className="relative flex-1 min-w-0">
        <input
          ref={p.inputRef}
          aria-label="Formula bar"
          aria-controls={p.gridId}
          value={p.value}
          readOnly={p.locked}
          onFocus={e => p.onBarFocus(caretOf(e))}
          onChange={e => p.onBarChange(e.target.value, caretOf(e))}
          onSelect={e => p.onBarSelect(caretOf(e))}
          onKeyDown={p.onBarKeyDown}
          onBlur={p.onBarBlur}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          title={p.locked ? p.lockReason : undefined}
          className={`w-full h-full bg-base border rounded px-2 py-1 font-mono text-xs focus:outline-none ${
            p.locked ? 'text-ink-secondary border-edge pr-7' : `text-ink border-edge focus:border-glow/50 ${p.mode !== 'Ready' ? 'pr-14' : ''}`
          }`}
        />
        {p.locked && (
          <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" aria-hidden="true" />
        )}
        {p.mode !== 'Ready' && (
          <span
            aria-live="polite"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-px rounded bg-glow-dim/80 text-glow text-[9px] font-mono uppercase tracking-wider pointer-events-none"
          >
            {p.mode}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-pressed={p.showFormulas}
        title="Show formulas (Ctrl+`)"
        onMouseDown={e => e.preventDefault()}
        onClick={p.onToggleFormulas}
        className={`flex-none px-2 rounded border font-mono text-[11px] transition-colors ${
          p.showFormulas ? 'bg-glow-dim text-glow border-glow/30' : 'bg-base text-ink-muted border-edge hover:text-ink'
        }`}
      >
        <span className="hidden sm:inline">Show formulas</span>
        <span className="sm:hidden">=f</span>
      </button>
    </div>
  )
}
