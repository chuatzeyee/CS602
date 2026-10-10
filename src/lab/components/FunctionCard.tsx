import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { courseExamples, functionInfo } from './functionInfo'

interface FunctionCardProps {
  name: string
  anchor: HTMLElement | null
  onClose(): void
}

const W = 360

// syntax popover for a function chip: Excel syntax, a short note and the course examples from the function bank
export default function FunctionCard({ name, anchor, onClose }: FunctionCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const id = useId()
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [wide, setWide] = useState(() => window.innerWidth >= 640)   // phones: a sheet along the bottom edge
  const info = functionInfo(name)
  const examples = courseExamples(name)

  useLayoutEffect(() => {
    const place = () => {
      const isWide = window.innerWidth >= 640
      setWide(isWide)
      if (!anchor || !ref.current || !isWide) return setPos(null)
      const a = anchor.getBoundingClientRect()
      const h = ref.current.offsetHeight
      const left = Math.max(8, Math.min(a.left, window.innerWidth - W - 8))
      const below = a.bottom + 6
      const above = a.top - h - 6
      // below the chip, else above it, else as low as it fits on screen
      const top = below + h <= window.innerHeight - 8 ? below : above >= 8 ? above : Math.max(8, window.innerHeight - h - 8)
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => { closeRef.current = onClose }, [onClose])

  // focus once the card is visible (it is measured hidden first on wide screens), so Esc closes it
  const shown = !wide || pos !== null
  const focused = useRef(false)
  useEffect(() => {
    if (!shown || focused.current) return
    focused.current = true
    ref.current?.focus({ preventScroll: true })
  }, [shown])

  useEffect(() => {
    const node = ref.current
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor?.contains(t)) closeRef.current()
    }
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      const a = document.activeElement
      if (anchor?.isConnected && (!a || a === document.body || node?.contains(a))) anchor.focus({ preventScroll: true })
    }
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={id}
      tabIndex={-1}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      // wide screens: rendered hidden at the final width first, so the height used for placement is the real one
      style={pos ? { left: pos.left, top: pos.top, width: W } : wide ? { left: 0, top: 0, width: W, visibility: 'hidden' } : undefined}
      className={`fixed z-[75] ${pos || wide ? '' : 'left-2 right-2 bottom-2'} max-h-[60vh] overflow-y-auto bg-base border border-edge-bright rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-4 text-sm animate-fade-in focus:outline-none`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 id={id} className="font-mono font-semibold text-glow">{name}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-0.5 rounded text-ink-muted hover:text-ink"><X size={14} /></button>
      </div>
      {info ? (
        <>
          <pre className="text-xs font-mono text-ink bg-raised border border-edge rounded-md px-3 py-2 whitespace-pre-wrap mb-2">={info.syntax}</pre>
          <p className="text-ink-secondary leading-relaxed">{info.about}</p>
        </>
      ) : (
        <p className="text-ink-secondary">Type <span className="font-mono text-ink">={name}(</span> in a cell; the arguments follow Excel's order.</p>
      )}
      {examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-edge space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">From the course</p>
          {examples.map(ex => (
            <div key={ex.name}>
              <p className="text-xs text-ink font-medium">{ex.name} <span className="text-ink-faint font-mono">{ex.week}</span></p>
              <p className="text-xs font-mono text-ink-secondary break-all">{ex.formula}</p>
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5">{ex.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
