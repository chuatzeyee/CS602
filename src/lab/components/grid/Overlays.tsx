// boxes drawn over the cells of one layer (frozen block or scrolling body); purely visual except the fill handle
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Rect } from './geometry'
import { prefersReducedMotion } from '../motion'

export type OverlayKind = 'sel' | 'active' | 'ants' | 'focus' | 'ref' | 'fill'

export interface OverlayBox {
  key: string
  kind: OverlayKind
  rect: Rect
  color?: string
  openTop?: boolean       // the box continues in the other layer
  openBottom?: boolean
  dim?: boolean           // grid not focused
}

// a bigger fill handle for fingers
const HANDLE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 28 : 16

// Excel's reference colours, tuned for the dark theme
export const REF_COLOURS = ['#60a5fa', '#f87171', '#c084fc', '#4ade80', '#fb923c', '#22d3ee', '#f472b6', '#facc15']

function edges(b: OverlayBox, w: number): { borderTopWidth: number; borderBottomWidth: number } {
  return { borderTopWidth: b.openTop ? 0 : w, borderBottomWidth: b.openBottom ? 0 : w }
}

function OverlayDiv({ b }: { b: OverlayBox }) {
  const { left, top, width, height } = b.rect
  const pos = { left: left - 1, top: top - 1, width: width + 1, height: height + 1 }
  switch (b.kind) {
    case 'sel':
      return (
        <div
          className={`absolute pointer-events-none border-solid ${b.dim ? 'border-glow/45' : 'border-glow'}`}
          style={{ ...pos, borderLeftWidth: 2, borderRightWidth: 2, ...edges(b, 2), background: 'rgba(74,222,128,0.075)' }}
        />
      )
    case 'active':
      return (
        <div
          className="absolute pointer-events-none border border-glow/70"
          style={{ left: left + 1, top: top + 1, width: width - 3, height: height - 3 }}
        />
      )
    case 'focus':
      return (
        <div
          className="absolute pointer-events-none border-dashed border-glow/80 rounded-[2px]"
          style={{
            left: left - 3, top: top - 3, width: width + 5, height: height + 5,
            borderLeftWidth: 2, borderRightWidth: 2, ...edges(b, 2),
            boxShadow: '0 0 10px 1px rgba(74,222,128,0.28)',
          }}
        />
      )
    case 'ref':
      return (
        <div
          className="absolute pointer-events-none border-dashed"
          style={{ ...pos, borderColor: b.color, borderLeftWidth: 2, borderRightWidth: 2, ...edges(b, 2), background: `${b.color}14` }}
        />
      )
    case 'fill':
      return (
        <div
          className="absolute pointer-events-none border-dashed border-ink"
          style={{ ...pos, borderLeftWidth: 2, borderRightWidth: 2, ...edges(b, 2), background: 'rgba(255,255,255,0.05)' }}
        />
      )
    case 'ants': {
      // Excel's marching ants: light dashes over a dark line, distinct from the green task outline
      const rect = { x: 1, y: 1, width: Math.max(0, pos.width - 2), height: Math.max(0, pos.height - 2), fill: 'none', strokeWidth: 2 }
      return (
        <svg className="absolute pointer-events-none overflow-visible" style={pos} aria-hidden="true">
          <rect {...rect} stroke="#0d0d0d" />
          <rect {...rect} stroke="#f5f5f5" strokeDasharray="4 4">
            {!prefersReducedMotion() && <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="0.6s" repeatCount="indefinite" />}
          </rect>
        </svg>
      )
    }
  }
}

interface LayerProps {
  boxes: OverlayBox[]
  handle?: Rect                 // selection rect whose bottom-right gets the fill handle
  onHandleDown?(e: ReactPointerEvent): void
  onHandleDouble?(): void
}

export function OverlayLayer({ boxes, handle, onHandleDown, onHandleDouble }: LayerProps) {
  return (
    <div aria-hidden="true" className="absolute inset-0 z-[2] pointer-events-none">
      {boxes.map(b => <OverlayDiv key={b.key} b={b} />)}
      {handle && onHandleDown && (
        <div
          data-fill-handle=""
          title="Drag to fill (double-click: fill down)"
          onPointerDown={onHandleDown}
          onDoubleClick={e => {
            e.stopPropagation()   // not the grid's double-click (that edits the active cell)
            onHandleDouble?.()
          }}
          className="absolute pointer-events-auto flex items-center justify-center cursor-crosshair touch-none"
          style={{
            left: handle.left + handle.width - HANDLE / 2 - 1, top: handle.top + handle.height - HANDLE / 2 - 1,
            width: HANDLE, height: HANDLE,
          }}
        >
          <span className={`block bg-glow border border-base ${HANDLE > 16 ? 'w-[10px] h-[10px]' : 'w-[7px] h-[7px]'}`} />
        </div>
      )}
    </div>
  )
}
