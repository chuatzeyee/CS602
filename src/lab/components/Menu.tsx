import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface MenuItem {
  key: string
  label: ReactNode
  hint?: string
  checked?: boolean
  disabled?: boolean
  onSelect(): void
}

interface MenuButtonProps {
  label: ReactNode
  items: MenuItem[]
  title?: string
  className: string
  ariaLabel?: string
}

// dropdown menu rendered in a portal so a scrolling toolbar does not clip it
export default function MenuButton({ label, items, title, className, ariaLabel }: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const w = menu.current?.offsetWidth ?? 200
    const h = menu.current?.offsetHeight ?? 0
    const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top })
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const onScroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])]
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
    else if (e.key === 'Tab') close(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        className={className}
      >
        {label}
        <ChevronDown size={12} className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={menu}
          id={id}
          role="menu"
          onKeyDown={onKeyDown}
          style={{ left: pos.left, top: pos.top }}
          className="fixed z-[75] min-w-[200px] py-1 bg-base border border-edge-bright rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.6)] animate-fade-in"
        >
          {items.map(it => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { close(false); it.onSelect() }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-secondary hover:bg-raised hover:text-ink focus:bg-raised focus:text-ink focus:outline-none disabled:opacity-40"
            >
              <span className="w-3.5 flex-shrink-0 text-glow">{it.checked && <Check size={13} />}</span>
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="font-mono text-[10px] text-ink-muted">{it.hint}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
