import { useMemo } from 'react'
import { CircleAlert, Info, CircleCheck, RefreshCw } from 'lucide-react'
import type { LabSheet } from '../types'
import { box, cellCount, normRef } from './refUtil'

export type StatusTone = 'info' | 'ok' | 'warn' | 'error'
export interface StatusMessage { text: string; tone: StatusTone }

interface StatusBarProps {
  sheet: LabSheet
  version: number
  selection: string
  message?: StatusMessage | null
  f9Hint?: boolean
  onRecalc?(): void
}

export function formatStat(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-6)) return n.toPrecision(6)
  return Number(n.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 6 })
}

// Excel's status bar: Average / Count / Sum of the visible selected cells (shown for 2+ non-empty cells)
function selectionStats(sheet: LabSheet, selection: string) {
  if (cellCount(selection) < 2) return null
  let count = 0
  let nums = 0
  let sum = 0
  for (const area of normRef(selection).split(',')) {
    const b = box(area)
    if (!b) continue
    const rows = sheet.values(area)
    rows.forEach((row, i) => {
      if (sheet.hiddenRows.has(b.r1 + i + 1)) return
      for (const v of row) {
        if (v === null || v === '') continue
        if (typeof v === 'string' && v.startsWith('#')) continue
        count++
        if (typeof v === 'number') { nums++; sum += v }
      }
    })
  }
  return count >= 2 ? { count, nums, sum } : null
}

const toneIcon = { info: Info, ok: CircleCheck, warn: CircleAlert, error: CircleAlert }
const toneText = { info: 'text-ink-secondary', ok: 'text-correct', warn: 'text-s4', error: 'text-wrong' }

export default function StatusBar({ sheet, version, selection, message, f9Hint, onRecalc }: StatusBarProps) {
  const stats = useMemo(() => {
    try {
      return selectionStats(sheet, selection)
    } catch {
      return null
    }
  }, [sheet, version, selection])  // version: recompute after edits
  const Icon = message ? toneIcon[message.tone] : null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-8 px-3 py-1.5 border-t border-edge bg-base text-[11px] text-ink-muted" role="status" aria-live="polite" aria-label="Status bar">
      <span className={`flex items-center gap-1.5 min-w-0 ${message ? toneText[message.tone] : ''}`}>
        {Icon && <Icon size={12} className="flex-shrink-0" />}
        <span className="truncate">{message?.text ?? 'Ready'}</span>
      </span>
      {f9Hint && (
        <button type="button" onClick={onRecalc} className="flex items-center gap-1 text-s4 hover:text-ink" title="Calculate Now (F9)">
          <RefreshCw size={11} /> Data tables are not recalculated automatically: press F9
        </button>
      )}
      {stats && (
        <span className="ml-auto flex items-center gap-3 font-mono" aria-label="Selection statistics">
          {stats.nums > 0 && <span>Average: <span className="text-ink-secondary">{formatStat(stats.sum / stats.nums)}</span></span>}
          <span>Count: <span className="text-ink-secondary">{stats.count}</span></span>
          {stats.nums > 0 && <span>Sum: <span className="text-ink-secondary">{formatStat(stats.sum)}</span></span>}
        </span>
      )}
    </div>
  )
}
