// Static picture of an exercise's starting sheet: labels, inputs, given values/formulas and empty answer cells.
// No formula engine: given formulas are shown as text.
import type { SheetSpec, CellSpec } from '../lab/types'
import { colIndex, colLetter } from '../lab/refs'
import { formatNumber } from '../lab/engine/format'

const MAX_ROWS = 70
const MAX_COLS = 26

function text(c: CellSpec): string {
  if (c.f) return c.f
  if (c.v === null || c.v === undefined) return ''
  if (typeof c.v === 'number') return formatNumber(c.v, c.fmt)
  if (typeof c.v === 'boolean') return c.v ? 'TRUE' : 'FALSE'
  return c.v
}

const tone: Record<string, string> = {
  input: 'text-sky-300',
  given: 'text-ink-secondary',
  answer: 'bg-yellow-400/15 text-yellow-200',
  header: 'font-semibold text-ink',
  label: 'text-ink',
  note: 'text-ink-muted italic',
}

export default function SheetPreview({ sheet }: { sheet: SheetSpec }) {
  const keys = Object.keys(sheet.cells)
  const pos = keys.map(k => { const m = /^([A-Z]+)(\d+)$/.exec(k); return m ? { col: colIndex(m[1]), row: Number(m[2]) } : null }).filter(Boolean) as { col: number; row: number }[]
  if (pos.length === 0) return null
  const lastRow = Math.max(...pos.map(p => p.row))
  const lastCol = Math.max(...pos.map(p => p.col))
  const rows = Math.min(lastRow, MAX_ROWS)
  const cols = Math.min(lastCol + 1, MAX_COLS)
  return (
    <div className="overflow-x-auto border border-edge rounded-md">
      <table className="text-[11px] font-mono border-collapse [overflow-wrap:normal]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-raised px-1.5 text-ink-muted" />
            {Array.from({ length: cols }, (_, c) => <th key={c} className="bg-raised px-2 py-0.5 text-ink-muted font-normal">{colLetter(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <td className="sticky left-0 bg-raised px-1.5 text-right text-ink-muted whitespace-nowrap">{r + 1}</td>
              {Array.from({ length: cols }, (_, c) => {
                const cell = sheet.cells[`${colLetter(c)}${r + 1}`]
                return (
                  <td key={c} className={`border border-edge px-1.5 py-0.5 whitespace-nowrap max-w-[16rem] overflow-hidden text-ellipsis ${cell ? tone[cell.role ?? 'label'] ?? '' : ''}`} title={cell?.note}>
                    {cell ? (cell.role === 'answer' && !cell.f && cell.v == null ? '?' : text(cell)) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {(lastRow > MAX_ROWS || lastCol + 1 > MAX_COLS) && (
        <p className="px-2 py-1 text-[11px] text-ink-muted">Showing A1:{colLetter(cols - 1)}{rows} of A1:{colLetter(lastCol)}{lastRow}.</p>
      )}
      <p className="px-2 py-1 text-[11px] text-ink-muted border-t border-edge">
        <span className="text-sky-300">blue</span> inputs, <span className="text-yellow-200">?</span> answer cells, grey given values and formulas.
      </p>
    </div>
  )
}
