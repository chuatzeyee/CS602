// function autocomplete list and the one-line syntax hint shown under the active editor
import type { SyntaxHint } from './functions'
import { isCourseFunction } from './functions'

export interface PopupAnchor { left: number; top: number; maxWidth: number }

interface Props {
  anchor: PopupAnchor | null
  listId: string
  items: string[]
  active: number
  onPick(name: string): void
  onHover(index: number): void
  hint: SyntaxHint | null
  argIndex: number
}

function argSlot(args: string[], argIndex: number): number {
  if (!args.length) return -1
  let i = Math.min(argIndex, args.length - 1)
  if (args[i] === '...') i = Math.max(0, args.length - 2)
  return i
}

export default function EditorPopups({ anchor, listId, items, active, onPick, onHover, hint, argIndex }: Props) {
  if (!anchor) return null
  if (items.length) {
    return (
      <ul
        id={listId}
        role="listbox"
        aria-label="Functions"
        className="absolute z-[60] min-w-44 max-h-56 overflow-auto py-1 bg-overlay border border-edge-bright rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] animate-scale-in"
        style={{ left: anchor.left, top: anchor.top, maxWidth: anchor.maxWidth }}
      >
        {items.map((name, i) => (
          <li
            key={name}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={e => { e.preventDefault(); onPick(name) }}
            onMouseEnter={() => onHover(i)}
            className={`flex items-center justify-between gap-3 px-2.5 py-1 font-mono text-xs cursor-pointer ${
              i === active ? 'bg-glow-dim text-glow' : 'text-ink-secondary hover:bg-raised'
            }`}
          >
            <span>{name}</span>
            {isCourseFunction(name) && <span className="text-[9px] uppercase tracking-wider text-ink-faint">course</span>}
          </li>
        ))}
        <li aria-hidden="true" className="px-2.5 pt-1 mt-1 border-t border-edge text-[10px] text-ink-faint">Tab to insert</li>
      </ul>
    )
  }
  if (!hint) return null
  const slot = argSlot(hint.args, argIndex)
  return (
    <div
      role="tooltip"
      className="absolute z-[60] px-2 py-1 bg-overlay border border-edge-bright rounded shadow-[0_6px_18px_rgba(0,0,0,0.45)] font-mono text-[11px] text-ink-secondary whitespace-nowrap overflow-hidden text-ellipsis"
      style={{ left: anchor.left, top: anchor.top, maxWidth: anchor.maxWidth }}
    >
      <span className="text-glow">{hint.name}</span>(
      {hint.args.map((a, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span className={i === slot ? 'text-ink font-semibold' : ''}>{a}</span>
        </span>
      ))}
      )
      {hint.example && <span className="ml-2 text-ink-faint">e.g. {hint.example}</span>}
    </div>
  )
}
