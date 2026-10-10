// A small VBE-like code editor: a plain textarea over a coloured copy of the text, with scroll-synced line numbers.
// Tab indents (4-space stops, or every selected line), Shift+Tab outdents, Enter keeps the indentation, Esc then Tab
// leaves the editor. Edits go through the browser's insertText so Ctrl+Z keeps working.
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { applySplice, lineOf, lineRange, newlineSplice, outdentSplice, tabSplice, type Splice } from './editing'
import { tokenizeLine, type TokenKind } from './highlight'

export interface VbaEditorApi {
  goToLine(line: number, focus?: boolean): void
  focus(): void
  caretLine(): number
}

interface VbaEditorProps {
  value: string
  onChange(value: string): void
  errorLine?: number                    // 1-based line to mark (the line a run stopped on)
  errorKey?: number                     // changes with every run, so the same line scrolls into view again
  onCaretLine?(line: number): void
  label: string
  describedBy?: string
  apiRef?: Ref<VbaEditorApi>
}

// same metrics for numbers, colours and textarea; 16px on phones so iOS does not zoom into the editor
const TEXT = 'font-mono text-[16px] leading-6 sm:text-[13px] sm:leading-5 [tab-size:4]'
const PAD = 'py-2 px-3'

const COLOUR: Record<TokenKind, string> = {
  kw: 'text-s9',
  comment: 'text-glow/80',
  str: 'text-s4',
  num: 'text-s3',
  text: 'text-ink',
}

export default function VbaEditor({ value, onChange, errorLine, errorKey, onCaretLine, label, describedBy, apiRef }: VbaEditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const [scroll, setScroll] = useState({ top: 0, left: 0 })
  const escaped = useRef(false)
  const pendingSel = useRef<[number, number] | null>(null)
  const lines = useMemo(() => value.split('\n'), [value])
  const coloured = useMemo(() => lines.map(tokenizeLine), [lines])

  useLayoutEffect(() => {
    const el = ta.current
    const sel = pendingSel.current
    if (el && sel) {
      el.setSelectionRange(sel[0], sel[1])
      pendingSel.current = null
    }
  }, [value])

  const scrollToLine = (line: number) => {
    const el = ta.current
    if (!el) return
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
    const top = (line - 1) * lh
    if (top < el.scrollTop || top + lh > el.scrollTop + el.clientHeight - 16) el.scrollTop = Math.max(0, top - el.clientHeight / 3)
    setScroll({ top: el.scrollTop, left: el.scrollLeft })
  }

  useImperativeHandle(apiRef, () => ({
    goToLine(line: number, focus = true) {
      const el = ta.current
      if (!el) return
      const r = lineRange(el.value, line)
      if (focus) el.focus({ preventScroll: true })
      el.setSelectionRange(r.start, r.start)
      scrollToLine(line)
    },
    focus: () => ta.current?.focus(),
    caretLine: () => (ta.current ? lineOf(ta.current.value, ta.current.selectionStart) : 1),
  }))

  useEffect(() => {
    if (errorLine && errorLine > 0) scrollToLine(errorLine)
  }, [errorLine, errorKey])

  const apply = (s: Splice) => {
    const el = ta.current
    if (!el) return
    el.setSelectionRange(s.from, s.to)
    let done = false
    try {
      done = s.text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, s.text)
    } catch {
      done = false
    }
    if (done) {
      el.setSelectionRange(s.selStart, s.selEnd)
      return
    }
    pendingSel.current = [s.selStart, s.selEnd]
    onChange(applySplice(el.value, s))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const wasEscaped = escaped.current
    escaped.current = e.key === 'Escape'
    if (e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return
    const el = e.currentTarget
    if (e.key === 'Tab') {
      if (wasEscaped) return
      e.preventDefault()
      const s = e.shiftKey ? outdentSplice(el.value, el.selectionStart, el.selectionEnd) : tabSplice(el.value, el.selectionStart, el.selectionEnd)
      if (s) apply(s)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      apply(newlineSplice(el.value, el.selectionStart, el.selectionEnd))
    }
  }

  const caret = () => {
    const el = ta.current
    if (el && onCaretLine) onCaretLine(lineOf(el.value, el.selectionStart))
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-base">
      <div aria-hidden className={`${TEXT} w-11 shrink-0 select-none overflow-hidden border-r border-edge py-2 pr-2 text-right text-ink-faint`}>
        <div style={{ transform: `translateY(${-scroll.top}px)` }}>
          {lines.map((_, i) => (
            <div key={i} className={i + 1 === errorLine ? 'font-semibold text-wrong' : undefined}>{i + 1}</div>
          ))}
        </div>
      </div>
      <div className="relative min-w-0 flex-1">
        <pre aria-hidden className={`${TEXT} ${PAD} pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre`}>
          <div className="w-max min-w-full" style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
            {coloured.map((tokens, i) => (
              <div key={i} className={i + 1 === errorLine ? '-mx-3 bg-wrong-dim px-3 shadow-[inset_3px_0_0_var(--color-wrong)]' : undefined}>
                {tokens.length ? tokens.map((t, j) => <span key={j} className={COLOUR[t.kind]}>{t.text}</span>) : '\u200b'}
              </div>
            ))}
          </div>
        </pre>
        <textarea
          ref={ta}
          aria-label={label}
          aria-describedby={describedBy}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          className={`${TEXT} ${PAD} absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent text-transparent caret-ink outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-glow/30`}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={e => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
          onKeyDown={onKeyDown}
          onKeyUp={caret}
          onClick={caret}
          onSelect={caret}
        />
      </div>
    </div>
  )
}
