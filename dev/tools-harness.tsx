// dev harness for the decision-tool dialogs (Sort, Filter, Advanced Filter, PivotTable) inside the real Player:
// npx vite --port 4623 --strictPort, then http://localhost:4623/CS602/dev/tools-harness.html (not part of the build)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../src/index.css'
import NavPill from '../src/components/NavPill'
import Player from '../src/lab/components/Player'
import type { CellSpec, CellValue, Exercise } from '../src/lab/types'

const CSV = `HC-1001,2026-01-05,Hougang Heartland Hotel,North-East,Hotel,Single Origin Sumatra,29,36.00,1044.00,NEW10,Paid
HC-1002,2026-01-06,BeanBox Online,West,Online,Single Origin Sumatra,43,36.00,1548.00,VIP10,Paid
HC-1003,2026-01-07,KopiCart Online,East,Online,Espresso Decaf,40,30.60,1224.00,NEW15,Paid
HC-1004,2026-01-08,Kopi Corner Novena,Central,Cafe,Espresso Classic,15,27.20,408.00,NEW15,Paid
HC-1005,2026-01-09,Jurong Lakeside Hotel,West,Hotel,Espresso Decaf,18,36.00,648.00,,Paid
HC-1006,2026-01-13,KopiCart Online,East,Online,Cold Brew Concentrate,33,27.00,891.00,VIP10,Paid
HC-1007,2026-01-14,CBD Cowork Hub,Central,Office,Espresso Classic,27,28.80,777.60,NEW10,Paid
HC-1008,2026-01-16,Sembawang Sands Resort,North,Hotel,Espresso Classic,17,27.20,462.40,NEW15,Paid
HC-1009,2026-01-26,Woodlands Brew Bar,North,Cafe,Single Origin Kenya,16,44.00,704.00,,Paid
HC-1010,2026-01-29,BeanBox Online,West,Online,Cold Brew Concentrate,43,27.00,1161.00,VIP10,Paid
HC-1011,2026-02-04,Jurong Lakeside Hotel,West,Hotel,House Blend,28,24.70,691.60,VIP5,Paid
HC-1012,2026-02-09,Kopi Corner Novena,Central,Cafe,Espresso Classic,5,32.00,160.00,,Paid
HC-1013,2026-02-11,Sembawang Sands Resort,North,Hotel,Espresso Classic,17,32.00,544.00,,Paid
HC-1014,2026-02-13,Kopi Corner Novena,Central,Cafe,Espresso Decaf,10,36.00,360.00,,Paid
HC-1015,2026-02-14,Sembawang Sands Resort,North,Hotel,House Blend,13,26.00,338.00,,Paid
HC-1016,2026-02-17,Hougang Heartland Hotel,North-East,Hotel,Espresso Decaf,34,32.40,1101.60,VIP10,Paid
HC-1017,2026-02-19,Sengkang Social,North-East,Cafe,Single Origin Sumatra,15,40.00,600.00,,Paid
HC-1018,2026-02-23,Woodlands Brew Bar,North,Cafe,Espresso Classic,14,32.00,448.00,,Paid
HC-1019,2026-02-25,Bedok Beanery,East,Cafe,Espresso Classic,14,28.80,403.20,NEW10,Paid
HC-1020,2026-02-26,Changi Bizpark Pantry,East,Office,House Blend,13,26.00,338.00,,Overdue
HC-1021,2026-03-02,Punggol Digital Pantry,North-East,Office,Cold Brew Concentrate,24,30.00,720.00,,Paid
HC-1022,2026-03-04,Yishun Yard Cafe,North,Cafe,Single Origin Sumatra,13,40.00,520.00,,Paid
HC-1023,2026-03-06,Sembawang Sands Resort,North,Hotel,Single Origin Sumatra,11,40.00,440.00,,Overdue
HC-1024,2026-03-10,Yishun Yard Cafe,North,Cafe,Single Origin Sumatra,7,40.00,280.00,,Paid
HC-1025,2026-03-12,Sengkang Social,North-East,Cafe,Single Origin Sumatra,10,40.00,400.00,,Paid
HC-1026,2026-03-18,Bedok Beanery,East,Cafe,Espresso Decaf,9,36.00,324.00,,Paid
HC-1027,2026-03-21,Punggol Point Cafe,North-East,Cafe,Espresso Decaf,7,36.00,252.00,,Paid
HC-1028,2026-03-26,BeanBox Online,West,Online,Espresso Decaf,31,32.40,1004.40,VIP10,Overdue
HC-1029,2026-03-27,KopiCart Online,East,Online,Single Origin Kenya,39,39.60,1544.40,VIP10,Paid
HC-1030,2026-03-30,Punggol Point Cafe,North-East,Cafe,Single Origin Sumatra,4,40.00,160.00,,Paid
HC-1031,2026-04-01,Tiong Bahru Bakehouse,Central,Cafe,House Blend,5,26.00,130.00,,Overdue
HC-1032,2026-04-02,Marina Suites Hotel,Central,Hotel,Espresso Decaf,35,34.20,1197.00,VIP5,Overdue
HC-1033,2026-04-06,Bedok Beanery,East,Cafe,Single Origin Kenya,8,44.00,352.00,,Paid
HC-1034,2026-04-13,Marina Suites Hotel,Central,Hotel,Espresso Classic,16,32.00,512.00,,Paid
HC-1035,2026-04-21,Changi Bizpark Pantry,East,Office,House Blend,23,26.00,598.00,,Paid
HC-1036,2026-04-22,Bedok Beanery,East,Cafe,Espresso Classic,18,32.00,576.00,,Paid
HC-1037,2026-04-24,Jurong Lakeside Hotel,West,Hotel,Espresso Classic,27,32.00,864.00,,Overdue
HC-1038,2026-04-25,CBD Cowork Hub,Central,Office,House Blend,9,26.00,234.00,,Paid
HC-1039,2026-04-27,Clementi Campus Canteen,West,Office,Cold Brew Concentrate,6,30.00,180.00,,Paid
HC-1040,2026-04-29,Tiong Bahru Bakehouse,Central,Cafe,Single Origin Kenya,9,44.00,396.00,,Paid
HC-1041,2026-05-01,CBD Cowork Hub,Central,Office,Espresso Classic,20,32.00,640.00,,Paid
HC-1042,2026-05-05,BeanBox Online,West,Online,Single Origin Kenya,18,44.00,792.00,,Paid
HC-1043,2026-05-06,Hougang Heartland Hotel,North-East,Hotel,Espresso Decaf,19,36.00,684.00,,Paid
HC-1044,2026-05-08,Marina Suites Hotel,Central,Hotel,House Blend,24,26.00,624.00,,Paid
HC-1045,2026-05-15,Orchard Grand Hotel,Central,Hotel,Espresso Classic,24,32.00,768.00,,Paid
HC-1046,2026-05-16,Kopi Corner Novena,Central,Cafe,Espresso Classic,14,32.00,448.00,,Paid
HC-1047,2026-05-20,Kopi Corner Novena,Central,Cafe,Espresso Classic,17,32.00,544.00,,Paid
HC-1048,2026-05-22,Clementi Campus Canteen,West,Office,Cold Brew Concentrate,28,30.00,840.00,,Paid
HC-1049,2026-05-25,KopiCart Online,East,Online,Espresso Decaf,35,36.00,1260.00,,Overdue
HC-1050,2026-05-28,Orchard Grand Hotel,Central,Hotel,Espresso Decaf,35,34.20,1197.00,VIP5,Overdue
HC-1051,2026-06-01,Clementi Campus Canteen,West,Office,Espresso Classic,6,32.00,192.00,,Paid
HC-1052,2026-06-04,Sengkang Social,North-East,Cafe,Cold Brew Concentrate,14,30.00,420.00,,Pending
HC-1053,2026-06-05,Punggol Point Cafe,North-East,Cafe,Single Origin Kenya,17,44.00,748.00,,Pending
HC-1054,2026-06-12,Tiong Bahru Bakehouse,Central,Cafe,Cold Brew Concentrate,4,30.00,120.00,,Pending
HC-1055,2026-06-17,Changi Bizpark Pantry,East,Office,House Blend,22,26.00,572.00,,Pending
HC-1056,2026-06-19,Punggol Digital Pantry,North-East,Office,Cold Brew Concentrate,15,30.00,450.00,,Pending
HC-1057,2026-06-22,Sembawang Sands Resort,North,Hotel,Espresso Classic,12,32.00,384.00,,Pending
HC-1058,2026-06-23,Punggol Digital Pantry,North-East,Office,House Blend,21,26.00,546.00,,Pending
HC-1059,2026-06-29,Yishun Yard Cafe,North,Cafe,Espresso Classic,4,32.00,128.00,,Paid
HC-1060,2026-06-30,Woodlands Brew Bar,North,Cafe,Espresso Classic,14,32.00,448.00,,Paid`

const HEAD = ['OrderID', 'OrderDate', 'Customer', 'Region', 'Channel', 'Blend', 'Qty', 'UnitPrice', 'Revenue', 'PromoCode', 'Status']
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
}

function cells(): Record<string, CellSpec> {
  const out: Record<string, CellSpec> = {
    A1: { v: 'Channel' }, B1: { v: 'Qty' }, A2: { f: '="=Hotel"' }, B2: { v: '>=20' },
  }
  HEAD.forEach((h, j) => { out[`${COLS[j]}8`] = { v: h, bold: true } })
  CSV.trim().split('\n').forEach((line, i) => line.split(',').forEach((x, j) => {
    if (x === '') return
    const ref = `${COLS[j]}${9 + i}`
    let v: CellValue = x
    if (j === 1) out[ref] = { v: serial(x), fmt: 'd mmm yyyy' }
    else {
      if (j >= 6 && j <= 8) v = Number(x)
      out[ref] = j === 8 || j === 7 ? { v, fmt: '#,##0.00' } : { v }
    }
  }))
  return out
}

const exercise: Exercise = {
  id: 'dev-w10-tools',
  week: 'W10',
  topic: 'Decision tools',
  title: 'Harbourline Coffee order book (harness)',
  level: 2,
  minutes: 20,
  scenario: 'Harbourline Coffee Roasters exported 60 orders. Use Sort, Filter, Advanced Filter and a PivotTable to answer questions.',
  sheet: { name: 'Orders', rows: 90, cols: 26, cells: cells(), frozenRows: 8, colWidths: { B: 92, C: 170, F: 150 } },
  tasks: [
    {
      id: 'af1', kind: 'criteria', cells: 'A1:B2',
      prompt: 'Criteria range A1:B2: Hotel orders of 20 bags or more. Then run Data > Advanced in place.',
      criteria: { list: 'A8:K68', expectedRows: [9, 19, 24, 40, 45, 52, 53, 58] },
    },
    {
      id: 'p1', kind: 'tool', tool: 'pivot', cells: 'M3:N9',
      prompt: 'PivotTable at M3: Region in Rows, Sum of Revenue in Values.',
      toolSetup: { source: 'A8:K68', target: 'M3', config: { rows: ['Region'], columns: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      answer: { M3: 'Row Labels', N3: 'Sum of Revenue', N9: 36341.2 },
    },
    {
      id: 's1', kind: 'tool', tool: 'sort', cells: 'A9:K68',
      prompt: 'Sort the orders by Revenue, largest first.',
      toolSetup: { range: 'A8:K68', levels: [{ column: 'Revenue', order: 'desc' }] },
      answer: { A9: 'HC-1002' },
    },
    {
      id: 't1', kind: 'tool', tool: 'autofilter', cells: 'I9:I68',
      prompt: 'Turn on the filter and show the Top 5 orders by Revenue.',
      toolSetup: { range: 'A8:K68', columns: [{ column: 'Revenue', filter: { type: 'top10', count: 5 } }] },
      answer: {},
    },
  ],
  skills: ['Sort', 'AutoFilter', 'Advanced Filter', 'PivotTable'],
}

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-void text-ink px-3 sm:px-6 py-4 pb-28">
        <h1 className="text-sm font-semibold text-ink-secondary mb-3">Decision tools harness</h1>
        <Player exercise={exercise} />
      </div>
      <NavPill />
    </HashRouter>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><App /></StrictMode>)
