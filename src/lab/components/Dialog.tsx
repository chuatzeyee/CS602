import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// where modeless tool dialogs float on wide screens; the player docks them over its task panel so the grid stays clickable
export const DialogDockContext = createContext<'left' | 'right'>('right')

export interface DialogProps {
  title: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  // modal: backdrop and focus kept inside. modeless (tool dialogs): wide screens can still click cells to pick refs
  modal?: boolean
  width?: string
  role?: 'dialog' | 'alertdialog'
  describedBy?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.getClientRects().length > 0)
}

const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

export default function Dialog({ title, onClose, children, footer, modal = false, width = 'sm:w-[440px]', role = 'dialog', describedBy }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  const dock = useContext(DialogDockContext)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = ref.current
    if (root) {
      const auto = root.querySelector<HTMLElement>('[data-autofocus]')
      const first = auto ?? (bodyRef.current && focusables(bodyRef.current)[0]) ?? focusables(root)[0]
      first?.focus()
    }
    return () => {
      if (prev && prev.isConnected) prev.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!modal) return
    const onFocusIn = (e: FocusEvent) => {
      const root = ref.current
      if (root && e.target instanceof Node && !root.contains(e.target)) focusables(root)[0]?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current && !ref.current.contains(document.activeElement)) closeRef.current()
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKey)
    }
  }, [modal])

  const onKeyDown = (e: RKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      closeRef.current()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = focusables(ref.current)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !ref.current.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (modal || !wide() || (e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })
  }
  const onPointerUp = () => { drag.current = null }

  const place = modal
    ? 'bg-black/60 sm:items-center sm:justify-center'
    : `pointer-events-none sm:items-start sm:pt-20 ${dock === 'left' ? 'sm:justify-start sm:pl-4' : 'sm:justify-end sm:pr-4'}`

  return createPortal(
    <div className={`fixed inset-0 z-[70] sm:flex sm:p-4 ${place}`} onMouseDown={modal ? e => { if (e.target === e.currentTarget) onClose() } : undefined}>
      <div
        ref={ref}
        role={role}
        aria-modal={modal || undefined}
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        style={offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        className={`pointer-events-auto flex flex-col bg-base w-full h-full sm:h-auto sm:max-h-[calc(100vh-7rem)] ${width} sm:rounded-xl border-edge-bright sm:border shadow-[0_12px_48px_rgba(0,0,0,0.6)] animate-scale-in`}
      >
        <header
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-edge ${modal ? '' : 'sm:cursor-move'} select-none`}
        >
          <h2 id={titleId} className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 -mr-1 rounded text-ink-muted hover:text-ink hover:bg-raised">
            <X size={16} />
          </button>
        </header>
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm text-ink-secondary">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-edge">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
