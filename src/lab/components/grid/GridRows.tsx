import { memo } from 'react'
import type { CellMark, LabSheet } from '../../types'
import { cellView, LOCKED_BG } from './cellView'
import { HEADER_H, ROW_H, ROW_HEADER_W, type Geometry } from './geometry'

export interface RowLayout {
  sheet: LabSheet
  geo: Geometry
  letters: string[]
  showFormulas: boolean
  gridId: string
  dataTables: { r1: number; c1: number; r2: number; c2: number }[]   // bodies (locked)
}

export const cellId = (gridId: string, r: number, c: number): string => `${gridId}-r${r}c${c}`
/** the hidden text a checked cell is described by (Spreadsheet renders one per mark) */
export const markId = (gridId: string, mark: CellMark): string => `${gridId}-mark-${mark}`

interface RowProps {
  layout: RowLayout
  r: number
  version: number
  selC1: number           // -1 when the row is outside the selection
  selC2: number
  wholeRow: boolean
  marks?: Record<number, CellMark>
  afterHidden: boolean
}

const ALIGN_CLS = { left: 'justify-start text-left', center: 'justify-center text-center', right: 'justify-end text-right' }

function GridRowImpl({ layout, r, selC1, selC2, wholeRow, marks, afterHidden }: RowProps) {
  const { sheet, geo, letters, showFormulas, gridId, dataTables } = layout
  const refs = letters.map(l => `${l}${r + 1}`)
  const raws = refs.map(ref => sheet.raw(ref))
  const reads = refs.map(ref => sheet.read(ref))
  const blank = (k: number) => raws[k] === '' && reads[k].kind === 'empty'
  const inSel = selC1 >= 0
  const cells = []
  for (let c = 0; c < geo.cols; c++) {
    const ref = refs[c]
    let spillRoom = 0
    for (let k = c + 1; k < geo.cols && blank(k); k++) spillRoom += geo.colW[k]
    const dtBody = dataTables.some(b => r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2)
    const v = cellView({
      sheet, ref, raw: raws[c], read: reads[c], width: geo.colW[c], spillRoom, showFormulas, mark: marks?.[c], dataTableBody: dtBody,
    })
    const selected = inSel && c >= selC1 && c <= selC2
    cells.push(
      <div
        key={c}
        id={cellId(gridId, r, c)}
        role="gridcell"
        aria-colindex={c + 2}
        aria-selected={selected}
        aria-readonly={!sheet.editable(ref) || undefined}
        aria-invalid={marks?.[c] === 'bad' || undefined}
        aria-describedby={marks?.[c] ? markId(gridId, marks[c]) : undefined}
        title={v.title}
        className={`relative flex items-center flex-none h-full px-[3px] border-r border-b border-edge whitespace-nowrap ${ALIGN_CLS[v.align]} ${v.cls}`}
        style={{
          width: geo.colW[c],
          boxShadow: v.shadow,
          outline: v.outline,
          outlineOffset: v.outline ? -2 : undefined,
          backgroundImage: dtBody ? LOCKED_BG : undefined,
        }}
      >
        <span
          className={v.spill ? 'relative z-[1] overflow-hidden' : 'overflow-hidden min-w-0'}
          style={v.spill ? { maxWidth: geo.colW[c] - 6 + v.spill, flex: 'none' } : undefined}
        >
          {v.text}
        </span>
        {v.note && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-l-[7px] border-t-s2 border-l-transparent"
          />
        )}
      </div>,
    )
  }
  return (
    <div role="row" aria-rowindex={r + 2} className="flex" style={{ height: ROW_H, width: geo.totalW }}>
      <div
        role="rowheader"
        className={`sticky left-0 z-[3] flex-none flex items-center justify-end pr-2 border-r border-b font-mono text-[11px] select-none ${
          inSel ? 'bg-[#164227] text-glow border-edge-bright' : 'bg-surface text-ink-muted border-edge'
        } ${wholeRow ? 'font-semibold' : ''}`}
        style={{ width: ROW_HEADER_W, boxShadow: afterHidden ? 'inset 0 2px 0 0 #4a4a4a' : undefined }}
      >
        {r + 1}
      </div>
      {cells}
    </div>
  )
}

export const GridRow = memo(GridRowImpl)

interface HeaderProps {
  geo: Geometry
  letters: string[]
  selC1: number
  selC2: number
  wholeCol: boolean
  allSelected: boolean
}

function ColumnHeaderImpl({ geo, letters, selC1, selC2, wholeCol, allSelected }: HeaderProps) {
  return (
    <div role="row" aria-rowindex={1} className="sticky top-0 z-[6] flex" style={{ height: HEADER_H, width: geo.totalW }}>
      <div
        role="columnheader"
        aria-label="Select all"
        className={`sticky left-0 z-[7] flex-none border-r border-b border-edge-bright ${allSelected ? 'bg-glow-dim' : 'bg-raised'}`}
        style={{ width: ROW_HEADER_W }}
      >
        <span className="absolute right-[3px] bottom-[3px] w-0 h-0 border-b-[8px] border-l-[8px] border-b-ink-faint border-l-transparent" />
      </div>
      {letters.map((l, c) => {
        const on = c >= selC1 && c <= selC2
        return (
          <div
            key={l}
            role="columnheader"
            aria-colindex={c + 2}
            className={`flex-none flex items-center justify-center border-r border-b font-mono text-[11px] select-none ${
              on ? 'bg-[#164227] text-glow border-edge-bright' : 'bg-surface text-ink-muted border-edge'
            } ${on && wholeCol ? 'font-semibold' : ''}`}
            style={{ width: geo.colW[c] }}
          >
            {l}
          </div>
        )
      })}
    </div>
  )
}

export const ColumnHeader = memo(ColumnHeaderImpl)
