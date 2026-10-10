// dev harness for the lab Spreadsheet: npx vite --port 4621 --strictPort, then
// http://localhost:4621/CS602/dev/grid-harness.html (not part of the production build)
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../src/index.css'
import NavPill from '../src/components/NavPill'
import Spreadsheet from '../src/lab/components/Spreadsheet'
import { createLabSheet } from '../src/lab/sheet'
import type { CellMark, CellSpec, LabSheet, SheetSpec, SpreadsheetApi } from '../src/lab/types'

const ROWS = 300

function sampleSpec(): SheetSpec {
  const cells: Record<string, CellSpec> = {
    A1: { v: 'Unit price', role: 'label' },
    B1: { v: 12.5, role: 'input', fmt: '$#,##0.00', note: 'Changeable input: try another price' },
    A2: { v: 'Tax rate', role: 'label' },
    B2: { v: 0.07, role: 'input', fmt: '0.0%' },
    A3: { v: 'Discount', role: 'label' },
    B3: { v: 0.1, role: 'input', fmt: '0%' },
    D1: { v: 'Blue = inputs, grey = given, amber = your answers. This note spills into the empty cells.', role: 'note' },
    D3: { v: 'Bad formula', role: 'label' },
    E3: { f: '=B1/0', role: 'given' },
    A5: { v: 'Item', role: 'header' },
    B5: { v: 'Qty', role: 'header', align: 'right' },
    C5: { v: 'Price', role: 'header', align: 'right' },
    D5: { v: 'Net', role: 'header', align: 'right' },
    E5: { v: 'Helper', role: 'header' },
    F5: { v: 'Total', role: 'header', align: 'right' },
    G5: { v: 'Paid?', role: 'header', align: 'center' },
    I5: { v: 'Rate', role: 'header' },
    J5: { f: '=SUM(F6:F15)', role: 'given', fmt: '$#,##0.00' },
  }
  for (let r = 6; r <= ROWS; r++) {
    cells[`A${r}`] = { v: `Item ${r - 5}`, role: 'label' }
    cells[`B${r}`] = { v: ((r * 7) % 13) + 1, role: 'given' }
    cells[`C${r}`] = { f: '=$B$1*(1-$B$3)', role: 'given', fmt: '0.00' }
    if (r <= 15) cells[`D${r}`] = { role: 'answer', fmt: '0.00' }
    cells[`F${r}`] = { f: `=B${r}*C${r}*(1+$B$2)`, role: 'given', fmt: '#,##0.00' }
    cells[`G${r}`] = { f: `=F${r}>100`, role: 'given' }
  }
  ;[0.05, 0.07, 0.09, 0.11, 0.13].forEach((v, i) => { cells[`I${6 + i}`] = { v, role: 'input', fmt: '0%' } })
  cells.A6 = { ...cells.A6, note: 'Rows 6 onwards hold 295 order lines' }
  return {
    name: 'Orders',
    rows: ROWS,
    cols: 11,
    cells,
    colWidths: { A: 96, D: 92, F: 96, G: 64, I: 64, J: 96 },
    frozenRows: 5,
  }
}

// 1000 Monte Carlo trials (dev/grid-harness.html?sheet=mc): ~5000 volatile formulas for the performance check
function monteCarloSpec(): SheetSpec {
  const cells: Record<string, CellSpec> = {
    A1: { v: 'Trial', role: 'header' }, B1: { v: 'Demand', role: 'header' }, C1: { v: 'Sold', role: 'header' },
    D1: { v: 'Profit', role: 'header' }, E1: { v: 'Stock-out?', role: 'header' },
    G1: { v: 'Order qty', role: 'label' }, H1: { v: 120, role: 'input' },
    G2: { v: 'Price', role: 'label' }, H2: { v: 9, role: 'input', fmt: '$0.00' },
    G3: { v: 'Unit cost', role: 'label' }, H3: { v: 4, role: 'input', fmt: '$0.00' },
    G5: { v: 'Mean profit', role: 'label' }, H5: { f: '=AVERAGE(D2:D1000)', role: 'answer', fmt: '$#,##0.00' },
    G6: { v: 'P(stock-out)', role: 'label' }, H6: { f: '=COUNTIF(E2:E1000,TRUE)/COUNT(A2:A1000)', role: 'answer', fmt: '0.0%' },
  }
  for (let r = 2; r <= 1000; r++) {
    cells[`A${r}`] = { v: r - 1, role: 'given' }
    cells[`B${r}`] = { f: '=ROUND(NORMINV(RAND(),110,25),0)', role: 'given' }
    cells[`C${r}`] = { f: `=MIN(B${r},$H$1)`, role: 'given' }
    cells[`D${r}`] = { f: `=C${r}*$H$2-$H$1*$H$3`, role: 'given', fmt: '#,##0' }
    cells[`E${r}`] = { f: `=B${r}>$H$1`, role: 'given' }
  }
  return { name: 'MonteCarlo', rows: 1000, cols: 8, cells, colWidths: { G: 110, H: 96 }, frozenRows: 1 }
}

declare global {
  interface Window { __grid?: { sheet: LabSheet; api: { current: SpreadsheetApi | null }; selection: { range: string; active: string } } }
}

function Harness() {
  const sheet = useMemo(() => {
    if (new URLSearchParams(window.location.search).get('sheet') === 'mc') return createLabSheet(monteCarloSpec())
    const s = createLabSheet(sampleSpec())
    s.addDataTable({ range: 'I5:J10', colInput: 'B2' })
    s.setHiddenRows([20])
    return s
  }, [])
  const api = useRef<SpreadsheetApi | null>(null)
  const [sel, setSel] = useState({ range: 'A1', active: 'A1' })
  const [marks, setMarks] = useState<Record<string, CellMark> | undefined>(undefined)
  const [readOnly, setReadOnly] = useState(false)
  const [focus, setFocus] = useState(true)

  useEffect(() => {
    window.__grid = { sheet, api, selection: sel }
  }, [sheet, sel])

  const btn = 'px-2.5 py-1 rounded-md border border-edge bg-raised text-xs text-ink-secondary hover:text-ink'
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 pb-28">
      <h1 className="text-lg font-semibold text-ink mb-1">Lab grid harness</h1>
      <p className="text-xs text-ink-muted mb-3" data-testid="selection">
        selection <span className="font-mono text-glow">{sel.range}</span> active <span className="font-mono text-glow">{sel.active}</span>
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button className={btn} onClick={() => setMarks(m => (m ? undefined : { D6: 'ok', D7: 'bad', D8: 'ok' }))}>toggle marks</button>
        <button className={btn} onClick={() => setFocus(f => !f)}>toggle focus cells</button>
        <button className={btn} onClick={() => setReadOnly(r => !r)}>{readOnly ? 'editable' : 'read-only'}</button>
        <button className={btn} onClick={() => api.current?.select('D6:D15')}>api.select(D6:D15)</button>
        <button className={btn} onClick={() => sheet.recalc()}>recalc</button>
      </div>
      <section className="flex flex-col h-[72vh] min-h-[420px] bg-base border border-edge rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-edge text-[11px] text-ink-muted">toolbar placeholder</div>
        <div className="flex-1 min-h-0 relative">
          <Spreadsheet
            sheet={sheet}
            marks={marks}
            focusCells={focus ? 'D6:D15' : undefined}
            readOnly={readOnly}
            onSelectionChange={(range, active) => setSel({ range, active })}
            apiRef={api}
          />
        </div>
        <div className="px-3 py-1.5 border-t border-edge text-[11px] text-ink-muted">status bar placeholder</div>
      </section>
      <NavPill />
    </div>
  )
}

// reuse the root when HMR re-runs this module (other files change while the harness is open)
const host = window as unknown as { __gridRoot?: Root }
host.__gridRoot ??= createRoot(document.getElementById('root')!)
host.__gridRoot.render(
  <StrictMode>
    <HashRouter>
      <Harness />
    </HashRouter>
  </StrictMode>,
)
