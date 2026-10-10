import type { CellSpec, CellValue, Exercise, SheetSpec } from '../../lab/types'

// Week 10 decision support: AutoFilter, Sort, Advanced Filter, PivotTables, TEXT date/time codes and the exam-safe
// formula routes (SUMIF / COUNTIF with criteria strings, SUMPRODUCT with conditions). Original datasets:
// - Harbourline Coffee Roasters (fictional): 60 orders, 1 Jan to 30 Jun 2026; data and checked answers in
//   site_build/notes/pivot_filter_notes.md section 4 (T1, AF1-AF8, P1-P5). Rows 1-6 criteria zone, row 7 blank,
//   headers A8:K8, records A9:K68, outputs from column M. Adapted here so boundary and $ mistakes change the
//   result: AF1 asks for 24+ bags (two orders of exactly 24), AF4 for June (orders on 1 and 30 June), AF7 for
//   unpaid orders (<>Paid); report-filter pivots start in row 1, where Excel and the lab place the filter alike.
//   Added here: a Custom AutoFilter wildcard count (PromoCode equals NEW1? Or VIP?: 9 orders).
// - Kaya Express dispatch log, DeskHive meeting-room bookings, Swiftline Vans service dates (fictional, made up here).
const ORDERS = `HC-1001,2026-01-05,Hougang Heartland Hotel,North-East,Hotel,Single Origin Sumatra,29,36.00,1044.00,NEW10,Paid
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

const FIELDS = ['OrderID', 'OrderDate', 'Customer', 'Region', 'Channel', 'Blend', 'Qty', 'UnitPrice', 'Revenue', 'PromoCode', 'Status']
const LETTERS = 'ABCDEFGHIJK'
const LIST = 'A8:K68'
const DATE = 'd mmm yyyy'
const MONEY = '#,##0.00'

// Excel serial of an ISO date (1900 system) and of a clock time 'hh:mm'
const serial = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
}
const clock = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number)
  return (h * 60 + m) / 1440
}

const label = (v: string, bold = false): CellSpec => ({ v, role: 'label', ...(bold ? { bold } : {}) })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'input', ...(fmt ? { fmt } : {}) })
const given = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'given', ...(fmt ? { fmt } : {}) })
const answer = (fmt?: string): CellSpec => ({ role: 'answer', ...(fmt ? { fmt } : {}) })
const column = (col: string, from: number, to: number, spec: CellSpec): Record<string, CellSpec> =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${col}${from + i}`, spec]))
const block = (cols: string, from: number, to: number, spec: CellSpec): Record<string, CellSpec> =>
  Object.assign({}, ...[...cols].map((c) => column(c, from, to, spec)))

// the order book at A8:K68 plus the exercise's own cells, `cols` wide; locked: false leaves the records editable (Sort rewrites them)
function orders(cols: number, extra: Record<string, CellSpec>, widths: Record<string, number> = {}, locked = true): SheetSpec {
  const cells: Record<string, CellSpec> = {}
  const role = locked ? { role: 'given' as const } : {}
  FIELDS.forEach((h, j) => { cells[`${LETTERS[j]}8`] = header(h) })
  ORDERS.trim().split('\n').forEach((line, i) => line.split(',').forEach((x, j) => {
    if (x === '') return
    const ref = `${LETTERS[j]}${9 + i}`
    if (j === 1) cells[ref] = { v: serial(x), fmt: DATE, ...role }
    else if (j === 7 || j === 8) cells[ref] = { v: Number(x), fmt: MONEY, ...role }
    else if (j === 6) cells[ref] = { v: Number(x), fmt: '0', ...role }
    else cells[ref] = { v: x, ...role }
  }))
  return {
    name: 'Orders',
    rows: 70,
    cols,
    cells: { ...cells, ...extra },
    colWidths: { B: 96, C: 176, D: 92, F: 160, M: 150, T: 170, ...widths },
    frozenRows: 8,
  }
}

// the order dates as blue inputs (B9:B68) and the same dates moved by `days`: lets a test case re-date every order
const ORDER_DATES = ORDERS.trim().split('\n').map((line) => serial(line.split(',')[1]))
const datesAsInputs = (): Record<string, CellSpec> => Object.fromEntries(ORDER_DATES.map((v, i) => [`B${9 + i}`, input(v, DATE)]))
const redated = (days: number): Record<string, CellValue> => Object.fromEntries(ORDER_DATES.map((v, i) => [`B${9 + i}`, v + days]))

const SCENARIO =
  'Harbourline Coffee Roasters sells roasted coffee to cafes, hotels, office pantries and online resellers across Singapore. ' +
  'The sales team exported the order book for January to June 2026: field names in row 8 and 60 orders below them, one row per order (list range A8:K68). ' +
  'Qty is the number of 1 kg bags, UnitPrice the S$ price per bag after any promo discount, and Revenue = Qty x UnitPrice; PromoCode is blank when no code was used.'

// ---------- level 1 drills ----------

const autofilter: Exercise = {
  id: 'w10-autofilter-number-filters', week: 'W10', level: 1, minutes: 8,
  topic: 'AutoFilter',
  title: 'Filter arrows: Top 10, Or, wildcards and two columns',
  scenario: `${SCENARIO} The sales manager wants quick answers straight from the filter arrows, without formulas.`,
  sheet: orders(14, {
    M1: label('Top 5 by Revenue: rows shown'), N1: answer('0'),
    M2: label('Qty under 10 or over 30: rows shown'), N2: answer('0'),
    M3: label('NEW codes or VIP5: rows shown'), N3: answer('0'),
  }, { M: 250 }),
  tasks: [
    {
      id: 'top5', kind: 'value', cells: 'N1',
      prompt: 'Select any cell in A8:K68 and turn on Data › Filter. On Revenue use Number Filters › Top 10, set Top 5 Items, and type into N1 how many orders stay visible.',
      answer: 6,
      wrong: ['5', '10'],
      hints: ['The status line under the grid counts the visible records ("x of 60 records found").', 'Look at the smallest revenue still visible: does more than one order have it?'],
      explain: 'Six orders stay visible, not five: the 5th largest revenue (1,197.00) belongs to both HC-1032 and HC-1050, and Top 10 keeps every row that ties at the cut-off. Top 10 is only offered for number columns; the same dialog also shows the Bottom n items or the Top or Bottom n percent.',
    },
    {
      id: 'outside', kind: 'value', cells: 'N2',
      prompt: 'Clear the Revenue filter. On Qty use Number Filters › Custom Filter: is less than 10, Or, is greater than 30. Type into N2 how many orders are visible.',
      answer: 23,
      wrong: ['13', '10', '0', '25'],
      hints: ['Custom AutoFilter takes up to two conditions on one column, joined by And or Or.', 'With And, no Qty can be under 10 and over 30 at the same time.'],
      explain: '23 orders: 13 small ones (under 10 bags) plus 10 big ones (over 30). Or keeps a row that meets either condition; And would show nothing. Custom AutoFilter stops at two conditions per column: for more, use Advanced Filter.',
    },
    {
      id: 'codes', kind: 'value', cells: 'N3',
      prompt: 'Clear the Qty filter. Marketing wants the orders that used a NEW code (NEW10 or NEW15) or the VIP5 code, but not VIP10. On PromoCode use Text Filters › Custom Filter: two equals conditions joined by Or, each written with the ? wildcard. Type into N3 how many orders are visible.',
      answer: 9,
      wrong: ['15', '6', '3', '0'],
      hints: [
        '? stands for exactly one character and * for any run of characters. In the Custom AutoFilter, equals compares the whole entry.',
        'NEW1? covers NEW10 and NEW15. Which pattern with a single ? covers VIP5 but not VIP10?',
        'equals NEW1?, Or, equals VIP?',
      ],
      explain: '9 orders: six with NEW10 or NEW15 and three with VIP5. Each ? is exactly one character, so VIP? cannot match VIP10, while VIP* would also keep the six VIP10 orders (15 rows). Because equals tests the whole entry, NEW? (one character after NEW) matches nothing. An Advanced Filter criteria range behaves differently: a plain entry there only tests the beginning of the text.',
    },
    {
      id: 'office', kind: 'tool', tool: 'autofilter', cells: 'E8',
      prompt: 'Clear the PromoCode filter. Then leave the list filtered to Office orders (Channel checklist: Office only) whose Revenue is between 500 and 800 (Number Filters › Between). The check reads which rows your filter hides.',
      toolSetup: {
        range: LIST,
        columns: [
          { column: 'Channel', filter: { type: 'values', values: ['Office'] } },
          { column: 'Revenue', filter: { type: 'custom', rules: [{ op: 'ge', value: 500 }, { op: 'le', value: 800 }], join: 'and' } },
        ],
      },
      answer: {},
      hints: ['Filters on different columns combine with AND: a row must pass both.', 'Between is two conditions joined by And: is greater than or equal to 500, is less than or equal to 800.'],
      explain: '6 orders remain: HC-1007, HC-1021, HC-1035, HC-1041, HC-1055 and HC-1058. AutoFilter always ANDs its columns; an OR across two columns (Office orders, or any order above 800) needs Advanced Filter with two criteria rows.',
    },
  ],
  skills: ['AutoFilter', 'Top 10 filter and ties', 'Custom AutoFilter with Or', 'Wildcards ? and * in a Custom Filter', 'Number Filters › Between', 'Filters on two columns (AND)'],
}

const sortCustom: Exercise = {
  id: 'w10-sort-custom-list', week: 'W10', level: 1, minutes: 5,
  topic: 'Custom sort',
  title: 'Chase the overdue invoices first',
  scenario: `${SCENARIO} Finance wants the list ordered by how urgent each invoice is, biggest amounts first.`,
  sheet: orders(11, {}, {}, false),
  tasks: [
    {
      id: 'sort', kind: 'tool', tool: 'sort', cells: 'A9:K68',
      prompt: 'Sort the order list (A8:K68, with headers) by Status in the custom order Overdue, Pending, Paid, then by Revenue from largest to smallest.',
      toolSetup: { range: LIST, headers: true, levels: [{ column: 'Status', order: 'custom', list: 'Overdue,Pending,Paid' }, { column: 'Revenue', order: 'desc' }] },
      answer: { A9: 'HC-1049', A10: 'HC-1032', A11: 'HC-1050', A16: 'HC-1031', K16: 'Overdue', A17: 'HC-1053', K17: 'Pending', A23: 'HC-1054', A24: 'HC-1002', K24: 'Paid', A68: 'HC-1059' },
      hints: ['A to Z would give Overdue, Paid, Pending: use Order › Custom List and type Overdue, Pending, Paid.', 'Add Level: Then by Revenue, Largest to Smallest.'],
      explain: 'A custom list sorts by your own order instead of the alphabet; Excel ships lists for weekdays and months too. Equal keys keep their original order, so HC-1032 stays before HC-1050 (both 1,197.00). In Excel, Sort On can also be Cell Color, Font Color or a Conditional Formatting Icon, which groups highlighted rows such as due dates coloured by alert level (the lab sorts on cell values only).',
    },
  ],
  skills: ['Sort dialog', 'Custom list order', 'Multi-level sort'],
}

// Kaya Express dispatch log: pickup and delivery date-times are inputs, so test cases can move them
const JOBS: readonly (readonly [string, string, string])[] = [
  ['KX-501', '2026-03-02 09:15', '2026-03-02 13:00'],
  ['KX-502', '2026-03-06 16:40', '2026-03-07 19:10'],
  ['KX-503', '2026-04-14 08:05', '2026-04-14 15:20'],
  ['KX-504', '2026-04-30 21:30', '2026-05-02 22:35'],
  ['KX-505', '2026-05-09 11:00', '2026-05-09 11:50'],
  ['KX-506', '2026-06-01 07:45', '2026-06-02 14:05'],
]
const stamp = (s: string): number => {
  const [d, t] = s.split(' ')
  return serial(d) + clock(t)
}
const STAMP = 'd mmm yyyy h:mm'
const shiftJobs = (days: number, minutes: number): Record<string, CellValue> =>
  Object.fromEntries(JOBS.flatMap(([, p, d], i) => [[`B${4 + i}`, stamp(p) + days], [`C${4 + i}`, stamp(d) + days + minutes / 1440]]))

const textCodes: Exercise = {
  id: 'w10-text-format-codes', week: 'W10', level: 1, minutes: 6,
  topic: 'TEXT date and time codes',
  title: 'Readable labels for a dispatch log',
  scenario: 'Kaya Express, a Singapore courier, logs every pickup and delivery as a date and time in one cell. The customer report needs the pickup weekday, the pickup month and the time in transit as readable labels. Build them with TEXT so they follow when dispatch corrects a time (the blue cells).',
  sheet: {
    name: 'Dispatch',
    rows: 12,
    cols: 6,
    cells: {
      A1: label('Kaya Express: dispatch log', true),
      A3: header('Job'), B3: header('Picked up'), C3: header('Delivered'), D3: header('Pickup day'), E3: header('Pickup month'), F3: header('Time in transit'),
      ...Object.fromEntries(JOBS.flatMap(([job, p, d], i) => [
        [`A${4 + i}`, given(job)], [`B${4 + i}`, input(stamp(p), STAMP)], [`C${4 + i}`, input(stamp(d), STAMP)],
      ])),
      ...block('DEF', 4, 9, answer()),
      A11: label('Blue cells are inputs: change a time and every label must follow.'),
    },
    colWidths: { A: 80, B: 150, C: 150, D: 100, E: 130, F: 130 },
  },
  tasks: [
    {
      id: 'weekday', kind: 'formula', cells: 'D4:D9',
      prompt: 'D4:D9: the pickup weekday as a short name (Mon, Tue, ...) with `TEXT`, filled down.',
      solution: '=TEXT(B4,"ddd")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B4,"dd")', '=TEXT(B4,"dddd")'],
      hints: [
        '`TEXT(value, format_text)` shows a number in any number format, and returns the result as text.',
        'Count the d\'s: d and dd give the day of the month, ddd and dddd the day of the week.',
        'Three d\'s give Mon; four give Monday.',
      ],
      explain: 'TEXT applies a format code to the date and returns text; being a formula, the label follows when dispatch corrects a time. Note the inconsistency the slides point out: d and dd are the day of the month but ddd and dddd the weekday, while m to mmmm all mean the month. The result is text, so it no longer works as a date in arithmetic.',
    },
    {
      id: 'month', kind: 'formula', cells: 'E4:E9',
      prompt: 'E4:E9: the pickup month and year spelled out (March 2026) with `TEXT`, filled down.',
      solution: '=TEXT(B4,"mmmm yyyy")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B4,"mm yyyy")', '=TEXT(B4,"mmm yyyy")'],
      hints: ['Three or four m\'s spell the month as a word: mmm gives Mar, mmmm gives March.', 'One format string can hold several codes: separate the month and year codes with a space.'],
      explain: 'TEXT(B4,"mmmm yyyy") gives March 2026. m and mm give 3 and 03; next to h or s the same m means minutes. mmm (Mar) is the short form a PivotTable helper column usually uses.',
    },
    {
      id: 'transit', kind: 'formula', cells: 'F4:F9',
      prompt: 'F4:F9: the time between pickup and delivery as hours and minutes that keep counting past a day (a delivery 27 hours 10 minutes after pickup shows 27:10, not 3:10), with `TEXT`, filled down.',
      solution: '=TEXT(C4-B4,"[h]:mm")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(C4-B4,"h:mm")', '=TEXT(C4-B4,"hh:mm")', '=C4-B4'],
      hints: ['Delivered minus Picked up is the elapsed time in days (1.5 days = 36 hours).', 'The code h restarts at 0 after 23 hours. Which form of the hour code keeps counting?'],
      explain: 'C4-B4 is the elapsed time in days. [h]:mm shows it as elapsed hours, so KX-502 reads 26:30 and KX-504 49:05. With h:mm the whole days are dropped and KX-502 shows 2:30. Use [h] for any duration that can pass 24 hours.',
    },
  ],
  testCases: [
    { name: 'Every job 40 days later, deliveries 1 hour slower', inputs: shiftJobs(40, 60) },
    { name: 'Every job 31 days earlier, deliveries 30 minutes faster', inputs: shiftJobs(-31, -30) },
  ],
  skills: ['TEXT', 'Date codes d, ddd, mmm, mmmm, yyyy', 'Elapsed time [h]:mm'],
  techniques: ['Date functions (TODAY, MONTH, WEEKDAY, date differences)', 'Time arithmetic (durations, x24, /1440, /86400)'],
}

const REGIONS = ['Central', 'East', 'North', 'North-East', 'West']

const regionStatus: Exercise = {
  id: 'w10-sumproduct-region-status', week: 'W10', level: 1, minutes: 8,
  topic: 'Conditional sums by formula',
  title: 'A PivotTable built from one formula',
  scenario: `${SCENARIO} Finance wants revenue by region and payment status in a fixed report block, the way an exam template asks for it: formulas only, no PivotTable.`,
  sheet: orders(16, {
    M3: label('Revenue by region and status', true), M4: header('Region'),
    N4: input('Overdue'), O4: input('Pending'), P4: input('Paid'),
    ...Object.fromEntries(REGIONS.map((r, i) => [`M${5 + i}`, given(r)])),
    ...block('NOP', 5, 9, answer(MONEY)),
  }, { M: 120, N: 100, O: 100, P: 100 }),
  tasks: [
    {
      id: 'grid', kind: 'formula', cells: 'N5:P9',
      prompt: 'In N5 write one formula with `SUMPRODUCT` that adds the Revenue of the orders whose Region is the one in column M and whose Status is the one in row 4, then fill it right and down to P9. The blue statuses are inputs: the block must stay right if someone types them in another order.',
      solution: '=SUMPRODUCT(($D$9:$D$68=$M5)*($K$9:$K$68=N$4)*$I$9:$I$68)',
      // only the mixed refs are pinned: the data ranges may be written several correct ways ($D$8:$D$68 with
      // SUMPRODUCT's comma form, Qty*UnitPrice for Revenue); a range left relative breaks other cells' values anyway
      check: { absolute: ['$M5', 'N$4'] },
      wrong: [
        '=SUMPRODUCT(($D$9:$D$68=M5)*($K$9:$K$68=N4)*$I$9:$I$68)',
        '=SUMPRODUCT((D9:D68=$M5)*(K9:K68=N$4)*I9:I68)',
        '=SUMPRODUCT(($D$9:$D$68=$M5)*($K$9:$K$68=N$4))',
        '=SUMPRODUCT((($D$9:$D$68=$M5)+($K$9:$K$68=N$4))*$I$9:$I$68)',
      ],
      hints: [
        'A test such as ($D$9:$D$68=$M5) gives TRUE or FALSE for each of the 60 orders; multiplying two tests gives 1 only where both are TRUE.',
        'Multiply the two tests by the Revenue range and let `SUMPRODUCT` add the results.',
        'Filled right, the region must still come from column M; filled down, the status must still come from row 4. Which part of each address needs a $?',
      ],
      explain: 'One formula fills the whole block: $M5 keeps the column of regions, N$4 keeps the row of statuses, and the data ranges are fully anchored. Multiplying the tests is an AND; adding them would count an order that meets either test, and one that meets both twice. North-East has no overdue orders, so the formula returns 0 where a PivotTable leaves the cell blank. SUMIFS($I$9:$I$68,$D$9:$D$68,$M5,$K$9:$K$68,N$4) gives the same block but is not in the course files; SUMIF handles one condition, SUMPRODUCT any number.',
    },
  ],
  testCases: [
    { name: 'Statuses typed as Pending, Paid, Overdue', inputs: { N4: 'Pending', O4: 'Paid', P4: 'Overdue' } },
    { name: 'Statuses typed as Paid, Overdue, Pending', inputs: { N4: 'Paid', O4: 'Overdue', P4: 'Pending' } },
  ],
  skills: ['SUMPRODUCT with conditions', 'Mixed references', 'Formula equivalent of a PivotTable'],
  techniques: [
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'SUMPRODUCT totals and weighted/expected values',
    'Absolute/mixed references so formulas fill down/right',
  ],
}

// ---------- level 2: Advanced Filter ----------

const andOr: Exercise = {
  id: 'w10-advfilter-and-or', week: 'W10', level: 2, minutes: 15,
  topic: 'Advanced Filter AND / OR',
  title: 'Criteria ranges: same row AND, new row OR',
  scenario: `${SCENARIO} Three managers each want a different slice of the orders, so you write three criteria ranges above the list.`,
  sheet: orders(11, {
    A1: header('Channel'), B1: header('Qty'), A2: answer(), B2: answer(),
    D1: header('Region'), D2: answer(), D3: answer(),
    ...block('FGH', 1, 3, answer()),
  }),
  tasks: [
    {
      id: 'af1', kind: 'criteria', cells: 'A1:B2',
      prompt: 'Criteria range A1:B2: Hotel-channel orders of at least 24 bags. Then run Data › Advanced in place to see them.',
      // B2 first: the validator types each wrong entry into the first cell listed here (two hotel orders have exactly 24 bags)
      solutions: { B2: '>=24', A2: '="=Hotel"' },
      criteria: { list: LIST, expectedRows: [9, 19, 24, 40, 45, 52, 53, 58] },
      wrong: ['>24', '24', '<=24'],
      hints: ['Conditions on the same row must all hold (AND).', 'Qty: an operator and a number, typed as text. "At least 24" includes 24 itself.'],
      explain: '8 orders, revenue 7,487.20. >=24 keeps HC-1044 and HC-1045 (exactly 24 bags); >24 would drop them. ="=Hotel" shows =Hotel and matches exactly; plain Hotel works too because no other channel begins with Hotel.',
    },
    {
      id: 'af2', kind: 'criteria', cells: 'D1:D3',
      prompt: 'Criteria range D1:D3: orders from the North region or the West region. North-East must not appear.',
      solutions: { D2: '="=North"', D3: '="=West"' },
      criteria: { list: LIST, expectedRows: [10, 13, 16, 17, 18, 19, 21, 23, 26, 30, 31, 32, 36, 45, 47, 50, 56, 59, 65, 67, 68] },
      wrong: ['North', '="=North*"'],
      hints: ['Each extra criteria row is an alternative (OR).', 'Plain text means "begins with": North also keeps North-East. Type ="=North" for an exact match.'],
      explain: '21 orders. Plain North returns 33 rows because the 12 North-East orders begin with North too.',
    },
    {
      id: 'af3', kind: 'criteria', cells: 'F1:H3',
      prompt: 'Criteria range F1:H3 (type the headers too): every Central order in the Office channel, plus every East order with Revenue above 600.',
      solutions: { G2: '="=Office"', F1: 'Region', G1: 'Channel', H1: 'Revenue', F2: '="=Central"', F3: '="=East"', H3: '>600' },
      criteria: { list: LIST, expectedRows: [11, 14, 15, 37, 46, 49, 57] },
      wrong: ['="=Online"', '="=Cafe"'],
      hints: ['Headers must match the list headers: Region, Channel, Revenue.', 'Row 2: Central AND Office. Row 3: East AND >600. Leave the other cells blank.'],
      explain: '7 orders, revenue 6,571.00. A blank criteria cell means "any value", and a criteria row left completely blank lets every record through, so the criteria range must end at the last filled row. Both regions on one row would ask for Central AND East at once, which no order meets.',
    },
    {
      id: 'why-rows', kind: 'explain', cells: '',
      prompt: 'Explain why Central and East must sit on different rows of F1:H3. Then say what Excel returns if both regions go on row 2 under two Region headers: first with the criteria range cut to F1:H2, then with F1:H3 kept, so row 3 is empty.',
      answer: 'Cells on the same criteria row are joined with AND; each extra row is an OR alternative, and a record passes if it meets any one row in full. Row 2 means Central AND Office, row 3 means East AND Revenue > 600. Two Region headers on one row ask for Region = Central AND Region = East at the same time, which no record can meet, so with F1:H2 the filter shows no rows. With F1:H3 the empty row 3 is an alternative with no conditions, which every record meets, so all 60 orders show.',
      hints: ['Read each criteria row as one sentence joined with "and".', 'A record is shown when at least one whole row is true for it. What does a row with no conditions ask for?'],
    },
  ],
  skills: ['Advanced Filter', 'Criteria range', 'AND on one row', 'OR across rows', 'Exact match ="=text"'],
}

const datesWildcards: Exercise = {
  id: 'w10-advfilter-dates-wildcards', week: 'W10', level: 2, minutes: 12,
  topic: 'Advanced Filter dates and wildcards',
  title: 'June orders, hotel names and promo codes',
  scenario: `${SCENARIO} Marketing is reviewing the June campaign, the hotel accounts and the use of VIP codes.`,
  sheet: orders(11, {
    A1: header('OrderDate'), B1: header('OrderDate'), A2: answer(), B2: answer(),
    D1: header('Customer'), D2: answer(),
    F1: header('PromoCode'), F2: answer(),
  }),
  tasks: [
    {
      id: 'june', kind: 'criteria', cells: 'A1:B2',
      prompt: 'Criteria range A1:B2 (the OrderDate header twice): the orders dated in June 2026, 1 and 30 June included.',
      solutions: { A2: '>=1 Jun 2026', B2: '<=30 Jun 2026' },
      criteria: { list: LIST, expectedRows: [59, 60, 61, 62, 63, 64, 65, 66, 67, 68] },
      wrong: ['>1 Jun 2026', '1 Jun 2026', '>=1 Jan 2026'],
      hints: ['The same field twice on one row gives a range: from AND to.', 'Write dates in words so they cannot be misread: >=1 Jun 2026. Orders were placed on 1 and on 30 June, so > and < would lose one.'],
      explain: '10 orders (HC-1051 to HC-1060), revenue 4,008.00. >1 Jun 2026 would lose HC-1051 (placed on 1 June). The two bounds on separate rows would be OR: every order passes.',
    },
    {
      id: 'hotel', kind: 'criteria', cells: 'D1:D2',
      prompt: 'Criteria range D1:D2: orders from customers whose name contains "Hotel" anywhere.',
      solutions: { D2: '="=*Hotel*"' },
      criteria: { list: LIST, expectedRows: [9, 13, 19, 24, 40, 42, 45, 51, 52, 53, 58] },
      wrong: ['Hotel', '="=Hotel"'],
      hints: ['* stands for any run of characters, also none.', 'Plain text only matches the beginning of the name.'],
      explain: '11 orders. Channel = Hotel gives 16: Sembawang Sands Resort is a hotel customer without "Hotel" in its name, so filter on the category field when you can.',
    },
    {
      id: 'vip5', kind: 'criteria', cells: 'F1:F2',
      prompt: 'Criteria range F1:F2: the VIP5 orders only, written with a ? wildcard (VIP plus exactly one character).',
      solutions: { F2: '="=VIP?"' },
      criteria: { list: LIST, expectedRows: [19, 40, 58] },
      wrong: ['VIP?', '="=VIP*"'],
      hints: ['? stands for exactly one character.', 'Without the = form, VIP? means "begins with VIP plus one character", which VIP10 also does.'],
      explain: '3 orders (HC-1011, HC-1032, HC-1050). Plain VIP? returns 9 rows because VIP10 also begins with VIP and one more character. The Custom AutoFilter differs here: its equals already compares the whole entry, so equals VIP? gives the 3 rows directly.',
    },
  ],
  skills: ['Advanced Filter', 'Date criteria', 'Repeated header (between)', 'Wildcards * and ?'],
}

const computedUnique: Exercise = {
  id: 'w10-advfilter-computed-unique', week: 'W10', level: 2, minutes: 15,
  topic: 'Computed criteria and unique copy',
  title: 'Big unpaid orders and the single-origin customer list',
  scenario: `${SCENARIO} Finance wants the unpaid orders (Overdue or Pending) above the average order value, and sales wants a clean list of the customers who bought single-origin coffee. Computed criteria are Excel behaviour beyond the slides.`,
  sheet: orders(14, {
    A1: answer(), B1: answer(), A2: answer(), B2: answer(),
    D1: header('Blend'), D2: given('Single Origin'),
    N8: header('Customer'),
  }),
  tasks: [
    {
      id: 'computed', kind: 'criteria', cells: 'A1:B2',
      prompt: 'Criteria range A1:B2: unpaid orders (Status Overdue or Pending) whose Revenue is above the average Revenue of all 60 orders. Use a computed criterion for the Revenue test: a TRUE/FALSE formula written for the first record (row 9) under a header that is not a field name, for example AboveAvg. One Status cell with the <> operator covers both unpaid statuses.',
      solutions: { A2: '=I9>AVERAGE($I$9:$I$68)', A1: 'AboveAvg', B1: 'Status', B2: '<>Paid' },
      criteria: { list: LIST, expectedRows: [36, 40, 45, 57, 58, 61] },
      wrong: ['=$I$9>AVERAGE($I$9:$I$68)', '=I9<AVERAGE($I$9:$I$68)', '=I9>AVERAGE(I9:I68)'],
      hints: [
        'The formula refers to the first record (I9) with a relative reference, and to the whole Revenue column with absolute references.',
        'The formula cell shows TRUE or FALSE for row 9 only: that is normal. Put the Status condition beside it on the same row: <>Paid keeps Overdue and Pending.',
      ],
      explain: '6 orders (5 overdue, 1 pending), revenue 6,270.40. With $I$9 every record tests row 9, so all or none pass. Without $ on the average range, the range slides down with each record and the average changes: 4 small pending orders near the end of the list sneak in. A real header such as Revenue makes Excel compare that field with TRUE/FALSE instead.',
    },
    {
      id: 'unique', kind: 'tool', tool: 'advfilter', cells: 'N9:N19',
      prompt: 'N8 holds the field name Customer. Use Data › Advanced with Copy to another location: List range A8:K68, Criteria range D1:D2, Copy to N8, and tick Unique records only.',
      toolSetup: { list: LIST, criteria: 'D1:D2', copyTo: 'N8', unique: true },
      answer: {
        N9: 'Hougang Heartland Hotel', N10: 'BeanBox Online', N11: 'Woodlands Brew Bar', N12: 'Sengkang Social', N13: 'Yishun Yard Cafe',
        N14: 'Sembawang Sands Resort', N15: 'KopiCart Online', N16: 'Punggol Point Cafe', N17: 'Bedok Beanery', N18: 'Tiong Bahru Bakehouse', N19: null,
      },
      hints: ['Only the columns whose names sit in the Copy to row are copied.', 'Without Unique records only you get 14 names with repeats.'],
      explain: '14 single-origin orders collapse to 10 customers, in list order. D2 (plain Single Origin) means "begins with", so Kenya and Sumatra both match.',
    },
    {
      id: 'unique-why', kind: 'explain', cells: '',
      prompt: 'Explain why Unique records only turned 14 orders into 10 names, and what you would get with Copy to a blank cell (every column) and Unique ticked.',
      answer: 'Unique records only compares just the columns being copied. With only Customer in N8, two orders from the same customer look identical, so each customer appears once, in list order. Copying every column makes each record different (every order has its own OrderID), so all 14 orders would be copied and nothing removed.',
      hints: ['Duplicates are judged on the columns that are copied, not on the whole list.', 'Could two whole orders ever be identical in this list? Look at OrderID.'],
    },
  ],
  skills: ['Computed criteria', 'Copy to another location', 'Unique records only'],
}

// ---------- level 2: PivotTables ----------

const pivots: Exercise = {
  id: 'w10-pivot-orders', week: 'W10', level: 2, minutes: 20,
  topic: 'PivotTables',
  title: 'Revenue by region, bags by blend and channel, who owes us',
  scenario: `${SCENARIO} Management wants three summaries without writing formulas, then two pivot numbers confirmed with formulas.`,
  sheet: orders(21, {
    M1: label('Three PivotTables, then two checks with formulas'),
    M26: label('Region'), N26: input('East'),
    M27: label('Revenue (SUMIF)'), N27: answer(MONEY),
    M29: label('Blend'), N29: input('Espresso Decaf'),
    M30: label('Channel'), N30: input('Online'),
    M31: label('Bags sold (SUMPRODUCT)'), N31: answer('0'),
  }, { N: 150 }),
  tasks: [
    {
      id: 'p1', kind: 'tool', tool: 'pivot', cells: 'M3:N9',
      prompt: 'Insert a PivotTable from A8:K68 at M3 (existing worksheet): Region in Rows, Revenue in Values (Sum).',
      toolSetup: { source: LIST, target: 'M3', config: { rows: ['Region'], columns: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      answer: { M3: 'Row Labels', N3: 'Sum of Revenue', M4: 'Central', N4: 8515.6, N5: 8082.6, N6: 4696.4, M7: 'North-East', N7: 7125.6, N8: 7921, M9: 'Grand Total', N9: 36341.2 },
      check: { tol: 0.005 },
      hints: ['Select a cell inside the list first, so Table/Range picks up A8:K68.', 'Tick Region (text goes to Rows) and Revenue (numbers go to Values as Sum).'],
      explain: 'Central leads with 8,515.60, 433.00 ahead of East. The Grand Total is the whole order book: 36,341.20.',
    },
    {
      id: 'p2', kind: 'tool', tool: 'pivot', cells: 'M12:R20',
      prompt: 'Insert a second PivotTable at M12: Blend in Rows, Channel in Columns, Qty in Values (Sum).',
      toolSetup: { source: LIST, target: 'M12', config: { rows: ['Blend'], columns: ['Channel'], values: [{ field: 'Qty', agg: 'sum' }], filters: [] } },
      answer: { M12: 'Sum of Qty', N12: 'Column Labels', N13: 'Cafe', R13: 'Grand Total', M16: 'Espresso Decaf', P16: null, Q16: 106, O20: 359, R15: 281, R20: 1118 },
      hints: ['Drag (or add) Channel to Columns.', 'An empty cell means no orders for that blend and channel, not zero.'],
      explain: 'Espresso Classic sells the most bags (281); hotels take 359 bags. Seven blend-channel cells are empty because nobody ordered that combination. In Excel, a PivotChart on this table (stacked columns, one series per channel) shows the same split and redraws whenever the pivot is filtered or rearranged.',
    },
    {
      // Excel puts a report filter two rows above the table: from T3 the filter lands in T1, and from T1 (no room
      // above) the table moves down to T3. The lab does the same, so both targets give this layout.
      id: 'p3', kind: 'tool', tool: 'pivot', cells: 'T1:U12',
      prompt: 'Insert a third PivotTable at T1: Status in Filters showing Overdue only, Customer in Rows, Revenue in Values (Sum). The filter takes row 1, so the table itself starts at T3.',
      toolSetup: { source: LIST, target: 'T1', config: { rows: ['Customer'], columns: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Status', include: ['Overdue'] }] } },
      answer: { T1: 'Status', U1: 'Overdue', T2: null, T3: 'Row Labels', T4: 'BeanBox Online', U7: 1260, T12: 'Grand Total', U12: 6430.4 },
      check: { tol: 0.005 },
      hints: ['Add Status to Filters, open its list and keep only Overdue.', 'The report filter sits above the table, then one blank row.'],
      explain: '6,430.40 is overdue across 8 orders; KopiCart Online owes the most (1,260.00). Double-clicking a value in Excel (Show Details) lists the orders behind it.',
    },
    {
      id: 'sumif', kind: 'formula', cells: 'N27',
      prompt: 'Confirm a number of the first PivotTable with a formula. N26 is an input region: in N27 use `SUMIF` to total its revenue.',
      solution: '=SUMIF($D$9:$D$68,N26,$I$9:$I$68)',
      check: { mustUse: ['SUMIF'] },
      wrong: ['=SUMIF($I$9:$I$68,N26,$D$9:$D$68)', '=SUMIF($D$9:$D$68,N26,$G$9:$G$68)', '=SUMIF($D$9:$D$68,"East",$I$9:$I$68)'],
      hints: [
        '`SUMIF(range, criteria, sum_range)`: range is where the condition is tested, sum_range what gets added.',
        'Use the cell N26 as the criteria so the check follows any region typed there.',
      ],
      explain: '8,082.60 for East, the same as the PivotTable. SUMIF tests one condition; the criteria can be a cell, a text such as "East", a comparison string such as ">600", or an operator joined to a cell such as ">="&B3.',
    },
    {
      id: 'sumproduct', kind: 'formula', cells: 'N31',
      prompt: 'Now a cell of the second PivotTable. N29 (blend) and N30 (channel) are inputs: in N31 use `SUMPRODUCT` to total the bags of that blend sold to that channel.',
      solution: '=SUMPRODUCT(($F$9:$F$68=N29)*($E$9:$E$68=N30)*$G$9:$G$68)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(($F$9:$F$68=N29)*($E$9:$E$68=N30)*$I$9:$I$68)', '=SUMPRODUCT(($F$9:$F$68=N29)*$G$9:$G$68)', '=SUMPRODUCT(($E$9:$E$68=N29)*($F$9:$F$68=N30)*$G$9:$G$68)'],
      hints: [
        'Two conditions: one test on the Blend column, one on the Channel column. Each gives TRUE/FALSE per order.',
        'Multiplying the tests by the Qty range leaves only the bags of orders that pass both; `SUMPRODUCT` adds them.',
        'Blends are in column F, channels in column E, bags in column G.',
      ],
      explain: '106 bags, the same as the PivotTable cell for Espresso Decaf and Online. For a combination nobody ordered the formula returns 0 while the PivotTable leaves the cell blank. Exam templates are marked on formulas in fixed cells, so SUMIF (one condition) and SUMPRODUCT (several) are the exam-safe routes to a pivot number.',
    },
    {
      id: 'when', kind: 'explain', cells: '',
      prompt: 'Your manager asks why you build some summaries as PivotTables and others with formulas. Give two situations for each.',
      answer: 'PivotTable: exploring a list quickly by dragging fields (by region, by blend, by customer); two-way summaries with many items that would need a grid of formulas; re-slicing with a report filter and opening the records behind a number (Show Details). Formulas such as SUMIF, COUNTIF and SUMPRODUCT: a fixed report or exam template where each answer must sit in a given cell; numbers that must update the moment data or inputs change (a PivotTable needs Refresh); results that feed further formulas such as shares, targets or a Solver model.',
      hints: ['Think about who reads the result, where it must sit, and what happens when the data change.', 'Which one can you re-slice with a click, and which one updates by itself?'],
    },
  ],
  testCases: [
    { name: 'North; House Blend to hotels', inputs: { N26: 'North', N29: 'House Blend', N30: 'Hotel' } },
    { name: 'West; Cold Brew Concentrate to hotels (no orders)', inputs: { N26: 'West', N29: 'Cold Brew Concentrate', N30: 'Hotel' } },
  ],
  skills: ['PivotTable rows, columns and values', 'Report filter', 'SUMIF and SUMPRODUCT cross-checks', 'PivotTable or formulas'],
  techniques: ['Conditional aggregation (SUMIF/COUNTIF with criteria strings)', 'SUMPRODUCT totals and weighted/expected values'],
}

const monthHelper: Exercise = {
  id: 'w10-pivot-month-helper', week: 'W10', level: 2, minutes: 15,
  topic: 'Helper column + PivotTable',
  title: 'Revenue by month: a TEXT helper column feeds the PivotTable',
  scenario: `${SCENARIO} The regional manager for North-East wants revenue by month. The dates are daily, so you first add a Month column with a format code, then summarise it. The order dates are blue inputs here: when an order is re-dated, its Month label must follow.`,
  sheet: orders(18, {
    ...datesAsInputs(),
    L8: header('Month'), ...column('L', 9, 68, answer()),
    Q3: label('Month missing for North-East'), R3: answer(),
    Q6: label('Region'), R6: input('North-East'),
    Q7: label('Month'), R7: input('Jun'),
    Q8: label('Revenue (SUMPRODUCT)'), R8: answer(MONEY),
  }, { L: 64, N: 130, O: 120, Q: 210, R: 110 }),
  tasks: [
    {
      id: 'month', kind: 'formula', cells: 'L9:L68',
      prompt: 'L8 holds the header Month. In L9 use `TEXT` to turn the order date into a three-letter month (Jan, Feb, ...) and fill down to L68.',
      solution: '=TEXT(B9,"mmm")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B9,"mm")', '=TEXT(B9,"mmmm")', '=MONTH(B9)'],
      hints: ['A PivotTable groups identical labels, so every January order needs exactly the same text.', 'The month codes are m, mm, mmm and mmmm: which one gives Jan?'],
      explain: 'TEXT(B9,"mmm") turns 5 Jan 2026 into the text Jan, so 60 different dates collapse into six month labels. A PivotTable summarises a stored copy (cache) of its source: add the helper column before inserting it, or change the data source and Refresh.',
    },
    {
      // target in row 1 so the report filter lands where Excel puts it (see p3 in w10-pivot-orders)
      id: 'pivot', kind: 'tool', tool: 'pivot', cells: 'N1:O9',
      prompt: 'Insert a PivotTable from A8:L68 (helper column included) at N1: Region in Filters showing North-East only, Month in Rows, Revenue in Values (Sum). The filter takes row 1, so the table itself starts at N3. Build it on the order dates as given: a PivotTable does not update when a date changes.',
      toolSetup: { source: 'A8:L68', target: 'N1', config: { rows: ['Month'], columns: [], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Region', include: ['North-East'] }] } },
      answer: {
        N1: 'Region', O1: 'North-East', N3: 'Row Labels', O3: 'Sum of Revenue',
        N4: 'Jan', O4: 1044, N5: 'Feb', O5: 1701.6, N6: 'Mar', O6: 1532, N7: 'May', O7: 684, N8: 'Jun', O8: 2164, N9: 'Grand Total', O9: 7125.6,
      },
      check: { tol: 0.005 },
      hints: ['The source must include column L, or Month is not in the field list.', 'Put Region in Filters and keep only North-East.'],
      explain: 'North-East earned 7,125.60, with June its best month (2,164.00). The months come out Jan to Jun rather than A to Z because PivotTables sort month names with the built-in Jan-Dec custom list.',
    },
    {
      id: 'missing', kind: 'value', cells: 'R3',
      prompt: 'Which month is missing from the North-East PivotTable? Type it in R3 the way the pivot labels months (three letters).',
      answer: 'Apr',
      wrong: ['Mar', 'May'],
      hints: ['Compare the row labels with Jan to Jun.', 'A PivotTable has no row for an item that has no records after filtering.'],
      explain: 'North-East placed no orders in April, and a PivotTable only lists items that occur in the filtered records. A formula for North-East in April returns 0 instead of dropping the row.',
    },
    {
      id: 'check', kind: 'formula', cells: 'R8',
      prompt: 'R6 (region) and R7 (month) are inputs. In R8 use `SUMPRODUCT` with your helper column to total the revenue for that region and month.',
      solution: '=SUMPRODUCT(($D$9:$D$68=R6)*($L$9:$L$68=R7)*$I$9:$I$68)',
      wrong: ['=SUMIF($L$9:$L$68,R7,$I$9:$I$68)', '=SUMPRODUCT(($D$9:$D$68=R6)*($B$9:$B$68=R7)*$I$9:$I$68)', '=SUMPRODUCT(($D$9:$D$68=R6)*($L$9:$L$68=R7)*$G$9:$G$68)'],
      hints: [
        'Two tests, each TRUE/FALSE per order: one on the Region column, one on the Month column. Multiplied by the Revenue range, they keep only the orders that pass both.',
        'The month test goes against your helper column L, not against the dates in column B.',
        'Compare with the input cells, not typed names: ($D$9:$D$68=R6) works for any region typed in R6; `SUMPRODUCT` adds the products.',
      ],
      explain: '2,164.00 for North-East in June, the same as the PivotTable. The text month only matches the helper column: compared with the real dates in column B, "Jun" matches nothing. SUMIF($L$9:$L$68,R7,$I$9:$I$68) would give the June total of all regions, the Grand Total of an unfiltered pivot.',
    },
  ],
  testCases: [
    { name: 'Central in May', inputs: { R6: 'Central', R7: 'May' } },
    { name: 'West in January', inputs: { R6: 'West', R7: 'Jan' } },
    { name: 'Every order re-dated 31 days later', inputs: redated(31) },
  ],
  skills: ['TEXT helper column', 'PivotTable with a report filter', 'Calendar order of month labels', 'SUMPRODUCT on a helper column'],
  techniques: [
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'SUMPRODUCT totals and weighted/expected values',
    'Date functions (TODAY, MONTH, WEEKDAY, date differences)',
  ],
}

const pivotSettings: Exercise = {
  id: 'w10-pivot-value-settings', week: 'W10', level: 2, minutes: 12,
  topic: 'PivotTable value settings',
  title: 'Orders, revenue share and average order by channel',
  scenario: `${SCENARIO} The board asks which channel brings the most revenue per order. Count, Average and Show Values As go beyond the course files, which only use Sum.`,
  sheet: orders(16, { M11: label('Channel with the highest average order'), N11: answer() }, { N: 130, O: 130, P: 140 }),
  tasks: [
    {
      id: 'p5', kind: 'tool', tool: 'pivot', cells: 'M3:P8',
      prompt: 'Insert a PivotTable from A8:K68 at M3: Channel in Rows; in Values, in this order from left to right: OrderID summarised by Count, Revenue (Sum) shown as % of Grand Total, and Revenue summarised by Average.',
      toolSetup: {
        source: LIST,
        target: 'M3',
        config: { rows: ['Channel'], columns: [], values: [{ field: 'OrderID', agg: 'count' }, { field: 'Revenue', agg: 'sum', show: 'pctGrand' }, { field: 'Revenue', agg: 'average' }], filters: [] },
      },
      answer: { M3: 'Row Labels', N3: 'Count of OrderID', O3: 'Sum of Revenue', P3: 'Average of Revenue', N4: 24, N7: 8, O5: 0.316434, O7: 0.259342, P7: 1178.1, P8: 605.686667, N8: 60, O8: 1 },
      check: { tol: 0.000001 },
      hints: ['Add Revenue to Values twice: one Sum shown as % of Grand Total, one Average.', 'OrderID is text, so its default summary is Count.'],
      explain: 'Online is only 8 of 60 orders (13.3%) but 25.9% of the revenue: its average order is 1,178.10. Hotel is the largest channel by revenue (31.6%).',
    },
    {
      id: 'best', kind: 'value', cells: 'N11',
      prompt: 'Read your PivotTable: which channel has the highest average revenue per order? Type it in N11.',
      answer: 'Online',
      wrong: ['Hotel', 'Cafe'],
      hints: ['Look down the Average of Revenue column, not the % column.', 'The highest share of revenue is not the same as the highest revenue per order.'],
      explain: 'Online averages 1,178.10 per order, Hotel 718.73, Office 507.30 and Cafe 388.72.',
    },
    {
      id: 'share', kind: 'explain', cells: '',
      prompt: 'Online is 13.3% of the orders but 25.9% of the revenue. What does that tell the sales team, and what would you check before moving effort from cafes to online resellers?',
      answer: 'Online orders are large: 1,178.10 on average against 388.72 for cafes, so one online order is worth about three cafe orders. But the 8 online orders come from just 2 customers (BeanBox Online and KopiCart Online), 6 of them used VIP or NEW discount codes and 2 are overdue, so the revenue rests on very few accounts. Check repeat frequency, the margin after discounts and payment risk before shifting effort; cafes give 24 smaller orders spread over 7 customers.',
      hints: ['Count how many different online customers there are, and look at their PromoCode and Status.', 'Compare the average order of each channel with how many orders it has.'],
    },
  ],
  skills: ['Value Field Settings', 'Count and Average', 'Show Values As % of Grand Total', 'Interpreting shares'],
  techniques: ['Written interpretation of model results'],
}

// ---------- level 3: exam-style ----------

// DeskHive meeting-room bookings, March to April 2026: [date, room, team, start, end]
const BOOKINGS: readonly (readonly [string, string, string, string, string])[] = [
  ['2026-03-02', 'Banyan', 'Kopi Labs', '09:00', '12:00'], ['2026-03-03', 'Orchid', 'Laksa Logic', '14:00', '15:30'],
  ['2026-03-05', 'Tembusu', 'Durian Data', '10:00', '17:00'], ['2026-03-06', 'Banyan', 'Pandan Pay', '13:30', '16:00'],
  ['2026-03-10', 'Orchid', 'Sambal Studio', '09:30', '11:00'], ['2026-03-12', 'Banyan', 'Pixel Prawn', '15:00', '18:30'],
  ['2026-03-13', 'Tembusu', 'Kopi Labs', '08:30', '12:30'], ['2026-03-16', 'Orchid', 'Durian Data', '10:15', '12:45'],
  ['2026-03-16', 'Banyan', 'Laksa Logic', '14:00', '20:00'], ['2026-03-18', 'Tembusu', 'Pandan Pay', '09:00', '10:30'],
  ['2026-03-20', 'Banyan', 'Sambal Studio', '11:00', '13:15'], ['2026-03-24', 'Orchid', 'Kopi Labs', '16:00', '17:45'],
  ['2026-03-25', 'Banyan', 'Durian Data', '09:30', '12:30'], ['2026-03-27', 'Tembusu', 'Laksa Logic', '09:00', '11:30'],
  ['2026-03-27', 'Orchid', 'Pandan Pay', '14:30', '17:30'], ['2026-03-28', 'Tembusu', 'Pixel Prawn', '13:00', '18:00'],
  ['2026-03-31', 'Banyan', 'Pixel Prawn', '13:00', '15:00'], ['2026-04-01', 'Tembusu', 'Sambal Studio', '10:00', '16:30'],
  ['2026-04-01', 'Banyan', 'Durian Data', '15:30', '18:00'], ['2026-04-02', 'Orchid', 'Kopi Labs', '09:00', '10:00'],
  ['2026-04-06', 'Tembusu', 'Laksa Logic', '13:00', '14:30'], ['2026-04-07', 'Banyan', 'Pandan Pay', '09:00', '17:00'],
  ['2026-04-09', 'Orchid', 'Pixel Prawn', '11:30', '13:00'], ['2026-04-10', 'Orchid', 'Sambal Studio', '09:30', '11:30'],
  ['2026-04-10', 'Banyan', 'Kopi Labs', '14:00', '16:15'], ['2026-04-14', 'Tembusu', 'Durian Data', '10:00', '13:30'],
  ['2026-04-17', 'Orchid', 'Laksa Logic', '15:00', '18:15'], ['2026-04-20', 'Banyan', 'Sambal Studio', '09:00', '11:00'],
  ['2026-04-22', 'Tembusu', 'Kopi Labs', '14:00', '19:30'], ['2026-04-24', 'Banyan', 'Pandan Pay', '10:00', '12:30'],
  ['2026-04-27', 'Orchid', 'Durian Data', '13:00', '16:00'], ['2026-04-30', 'Tembusu', 'Pixel Prawn', '08:30', '10:00'],
]
const LAST = 9 + BOOKINGS.length   // bookings in rows 10-41
// dates and end times are inputs, so a test case can move every Day and Hours cell (hard-coding fails there too)
const shiftBookings = (days: number, minutes: number): Record<string, CellValue> =>
  Object.fromEntries(BOOKINGS.flatMap(([d, , , , e], i) => [[`B${10 + i}`, serial(d) + days], [`F${10 + i}`, clock(e) + minutes / 1440]]))

const roomReport: Exercise = {
  id: 'w10-room-bookings-report', week: 'W10', level: 3, minutes: 25,
  topic: 'Exam-style period report',
  title: 'Meeting-room report: fixed answer cells, formulas only',
  scenario: 'DeskHive, a coworking space in Tanjong Pagar, rents three meeting rooms by the hour. The March and April 2026 bookings sit in rows 10 to 41, under the headers in row 9. The owner keeps a fixed report template: she types a period into B3:B4 and expects every yellow cell to update, so the answers must be formulas, not PivotTables. Booking dates and times are blue inputs too: when one is corrected, the Day and Hours columns and the report must follow.',
  sheet: {
    name: 'Bookings',
    rows: 42,
    cols: 11,
    cells: {
      A1: label('DeskHive meeting rooms: period report', true),
      A3: label('Report from'), B3: input(serial('2026-03-16'), DATE),
      A4: label('Report to'), B4: input(serial('2026-04-10'), DATE),
      A5: label('Bookings in period'), B5: answer('0'),
      A6: label('Friday hours in period'), B6: answer('0.00'),
      J3: header('Room'), K3: header('Hours in period'),
      J4: given('Banyan'), J5: given('Orchid'), J6: given('Tembusu'),
      ...column('K', 4, 6, answer('0.00')),
      J7: label('Total (hours:minutes)'), K7: answer(),
      A9: header('Booking'), B9: header('Date'), C9: header('Room'), D9: header('Team'), E9: header('Start'), F9: header('End'), G9: header('Day'), H9: header('Hours'),
      ...Object.fromEntries(BOOKINGS.flatMap(([d, room, team, s, e], i) => [
        [`A${10 + i}`, given(`MR-${301 + i}`)], [`B${10 + i}`, input(serial(d), DATE)], [`C${10 + i}`, given(room)],
        [`D${10 + i}`, given(team)], [`E${10 + i}`, input(clock(s), 'h:mm')], [`F${10 + i}`, input(clock(e), 'h:mm')],
      ])),
      ...column('G', 10, LAST, answer()),
      ...column('H', 10, LAST, answer('0.00')),
    },
    colWidths: { A: 168, B: 96, C: 80, D: 104, E: 60, F: 60, G: 56, H: 64, I: 24, J: 100, K: 120 },
    frozenRows: 9,
  },
  tasks: [
    {
      id: 'day', kind: 'formula', cells: `G10:G${LAST}`,
      prompt: '(a) G10:G41: the weekday of each booking as Mon, Tue, ... with `TEXT`, filled down.',
      solution: '=TEXT(B10,"ddd")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B10,"dddd")', '=TEXT(B10,"dd")'],
      hints: ['`TEXT` can show a date with any date format code.', 'ddd gives the short weekday name; d or dd would give the day of the month.'],
      explain: 'The weekday as text lets part (f) pick out Fridays with a plain test (="Fri"). WEEKDAY(B10) would return a number (6 for a Friday), which is harder to read in a report.',
    },
    {
      id: 'hours', kind: 'formula', cells: `H10:H${LAST}`,
      prompt: '(b) H10:H41: the length of each booking in hours as a plain number (2.5 for 2 h 30 min), filled down.',
      solution: '=(F10-E10)*24',
      wrong: ['=F10-E10', '=(F10-E10)*60', '=(E10-F10)*24'],
      hints: ['End minus Start is a fraction of a day.', 'How many hours are in one day?'],
      explain: 'Times are fractions of a day, so (End - Start) x 24 gives decimal hours: 10:15 to 12:45 is 0.104 days = 2.5 hours. Decimal hours add up like ordinary numbers; format them 0.00, not as a time.',
    },
    {
      id: 'count', kind: 'formula', cells: 'B5',
      prompt: '(c) B5: the number of bookings dated from B3 to B4, both dates included. Try `COUNTIF` with criteria built from B3 and B4 (COUNTIFS is not in the course).',
      solution: '=COUNTIF($B$10:$B$41,">="&$B$3)-COUNTIF($B$10:$B$41,">"&$B$4)',
      wrong: [
        '=COUNTIF($B$10:$B$41,">="&$B$3)-COUNTIF($B$10:$B$41,">="&$B$4)', '=COUNTIF($B$10:$B$41,">="&$B$3)',
        '=COUNTIF($B$10:$B$41,">"&$B$3)-COUNTIF($B$10:$B$41,">"&$B$4)', '=COUNTIF($B$10:$B$41,">=B3")-COUNTIF($B$10:$B$41,">B4")',
      ],
      hints: [
        'COUNTIF takes one condition, so a date window needs two counts: everything from the start date on, minus everything after the end date.',
        'Build each criterion from a cell: the operator goes in quotes and is joined to the date with &, as in ">="&B3.',
        'For the end date use ">"&B4, so the bookings dated B4 itself are not taken away.',
      ],
      explain: '18 bookings from 16 Mar to 10 Apr. ">" for the end date keeps the bookings dated B4 itself: with ">=" the two bookings on 10 Apr would be lost. The operator goes inside quotes and the cell is joined with &; a date typed inside the quotes would not follow B3.',
    },
    {
      id: 'rooms', kind: 'formula', cells: 'K4:K6',
      prompt: '(d) K4:K6: the hours booked for each room in J4:J6 within the period: one formula in K4 (for example `SUMPRODUCT` with three tests), filled down.',
      solution: '=SUMPRODUCT(($C$10:$C$41=$J4)*($B$10:$B$41>=$B$3)*($B$10:$B$41<=$B$4)*$H$10:$H$41)',
      wrong: [
        '=SUMIF($C$10:$C$41,$J4,$H$10:$H$41)',
        '=SUMPRODUCT(($C$10:$C$41=$J4)*($B$10:$B$41>$B$3)*($B$10:$B$41<$B$4)*$H$10:$H$41)',
        '=SUMPRODUCT((C10:C41=J4)*(B10:B41>=B3)*(B10:B41<=B4)*H10:H41)',
      ],
      hints: [
        'Three tests, each TRUE/FALSE per booking: the room, a date on or after B3, a date on or before B4.',
        'The Date column is tested twice, once for each bound, like a repeated header in an Advanced Filter criteria range.',
        'Multiply the tests by the Hours range; only the room label should move as you fill down.',
      ],
      explain: 'Banyan 26.00, Orchid 11.75 and Tembusu 17.00 hours for 16 Mar to 10 Apr. Testing the Date column twice gives a between condition, exactly like a date header repeated on one Advanced Filter criteria row. This block is the formula version of a PivotTable with Room in Rows and a date filter.',
    },
    {
      id: 'total', kind: 'formula', cells: 'K7',
      prompt: '(e) K7: the total of K4:K6 as hours and minutes that keep counting past a day (a total of 30.5 hours shows as 30:30), with `TEXT`.',
      solution: '=TEXT(SUM(K4:K6)/24,"[h]:mm")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(SUM(K4:K6)/24,"h:mm")', '=TEXT(SUM(K4:K6),"[h]:mm")', '=SUM(K4:K6)'],
      hints: ['Time codes work on fractions of a day, but K4:K6 hold hours.', 'Which hour code keeps counting past 23?'],
      explain: '54:45 for the base period. Dividing by 24 turns hours back into days, then [h]:mm shows elapsed hours; h:mm would show 6:45 because it drops the two whole days.',
    },
    {
      id: 'fridays', kind: 'formula', cells: 'B6',
      prompt: '(f) B6: the hours booked on Fridays within the period (all rooms), using your Day column.',
      solution: '=SUMPRODUCT(($G$10:$G$41="Fri")*($B$10:$B$41>=$B$3)*($B$10:$B$41<=$B$4)*$H$10:$H$41)',
      wrong: ['=SUMPRODUCT(($G$10:$G$41="Friday")*($B$10:$B$41>=$B$3)*($B$10:$B$41<=$B$4)*$H$10:$H$41)', '=SUMIF($G$10:$G$41,"Fri",$H$10:$H$41)'],
      hints: ['The Day column holds text such as Fri, so the test compares it with that text in quotes.', 'Keep the two date tests from part (d).'],
      explain: '12.00 Friday hours from 16 Mar to 10 Apr. The test must match what TEXT returned: "Fri", not "Friday". SUMIF($G$10:$G$41,"Fri",$H$10:$H$41) alone would add every Friday in March and April (24.25 hours).',
    },
    {
      id: 'advice', kind: 'explain', cells: '',
      prompt: '(g) The owner wants to turn Orchid into hot desks because it has the fewest hours. Try other periods in B3:B4, then give your advice in two or three sentences.',
      answer: 'Orchid is the least used room in every period I tried: 11.75 of 54.75 hours (about 21%) from 16 Mar to 10 Apr, 10.25 of 52.50 hours in March and 6.75 of 32.00 hours from 6 to 24 Apr, while Banyan takes 40-50% of the hours. That supports a change, but the report only counts hours: before converting Orchid, check its seats against team sizes, whether bookings are turned away when Banyan is busy, and more than two months of data.',
      hints: ['Compare Orchid\'s share of the total in at least two periods.', 'Name one thing the hours do not tell you.'],
    },
  ],
  testCases: [
    { name: 'Report for 1 to 31 March', inputs: { B3: serial('2026-03-01'), B4: serial('2026-03-31') } },
    { name: 'Report for 6 to 24 April', inputs: { B3: serial('2026-04-06'), B4: serial('2026-04-24') } },
    { name: 'Every booking re-entered one day later, ending 15 minutes later', inputs: shiftBookings(1, 15) },
  ],
  skills: ['TEXT weekday helper', 'Hours from times (x24)', 'COUNTIF date window', 'SUMPRODUCT with date bounds', 'TEXT [h]:mm', 'Interpreting a report'],
  techniques: [
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'SUMPRODUCT totals and weighted/expected values',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Date functions (TODAY, MONTH, WEEKDAY, date differences)',
    'Absolute/mixed references so formulas fill down/right',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
  ],
}

// Swiftline Vans: [route, next service due, serviced?] for vans SV-101 to SV-136 (list A12:D48)
const VANS: readonly (readonly [string, string, string])[] = [
  ['East', '2026-07-30', 'No'], ['West', '2026-08-19', 'No'], ['Central', '2026-06-19', 'No'], ['North', '2026-07-01', 'Yes'],
  ['East', '2026-07-15', 'Yes'], ['North', '2026-07-24', 'Yes'], ['North', '2026-06-22', 'Yes'], ['Central', '2026-08-03', 'No'],
  ['East', '2026-08-07', 'No'], ['North', '2026-06-03', 'Yes'], ['Central', '2026-08-12', 'No'], ['West', '2026-08-05', 'No'],
  ['East', '2026-07-09', 'No'], ['West', '2026-06-12', 'No'], ['Central', '2026-06-29', 'No'], ['Central', '2026-06-28', 'No'],
  ['East', '2026-07-02', 'No'], ['North', '2026-06-26', 'Yes'], ['West', '2026-07-21', 'No'], ['East', '2026-08-14', 'No'],
  ['North', '2026-07-10', 'Yes'], ['Central', '2026-08-20', 'No'], ['East', '2026-06-08', 'Yes'], ['North', '2026-07-19', 'No'],
  ['West', '2026-07-16', 'No'], ['Central', '2026-06-15', 'Yes'], ['North', '2026-08-21', 'No'], ['West', '2026-07-07', 'Yes'],
  ['Central', '2026-07-13', 'No'], ['Central', '2026-08-17', 'No'], ['North', '2026-07-27', 'No'], ['West', '2026-08-10', 'No'],
  ['Central', '2026-07-20', 'No'], ['North', '2026-07-23', 'No'], ['East', '2026-07-06', 'No'], ['Central', '2026-07-31', 'No'],
]
// what Copy to writes for level 2 as at 20 Jul 2026 (due 29 Jun to 19 Jul, not serviced), in list order
const EXTRACT: readonly (readonly [string, string, string])[] = [
  ['SV-113', 'East', '2026-07-09'], ['SV-115', 'Central', '2026-06-29'], ['SV-117', 'East', '2026-07-02'], ['SV-124', 'North', '2026-07-19'],
  ['SV-125', 'West', '2026-07-16'], ['SV-129', 'Central', '2026-07-13'], ['SV-135', 'East', '2026-07-06'],
]

const fleetAlerts: Exercise = {
  id: 'w10-fleet-service-alerts', week: 'W10', level: 3, minutes: 25,
  topic: 'Dynamic Advanced Filter',
  title: 'Service alerts: date windows, TEXT criteria and a copied list',
  scenario: 'Swiftline Vans runs 36 delivery vans from a depot in Tuas. Each van has a next-service due date and a Serviced flag (A12:D48). The fleet manager types an as-at date and an alert level, and wants the vans that still need a service in that window copied to F12, the way a project tracker raises alerts on late milestones.',
  sheet: {
    name: 'Fleet',
    rows: 50,
    cols: 9,
    cells: {
      A1: label('Swiftline Vans: service alerts', true),
      A3: label('As-at date'), B3: input(serial('2026-07-20'), DATE),
      A4: label('Alert level'), B4: input(2, '0'),
      A5: label('Window from'), B5: answer(DATE),
      A6: label('Window to'), B6: answer(DATE),
      A7: label('Vans to chase'), B7: answer('0'),
      F2: header('Level'), G2: header('From (days)'), H2: header('To (days)'), I2: header('Meaning'),
      // the offsets are inputs (the manager may retune a level), so offsets typed into a formula fail a test case
      F3: given(1, '0'), G3: input(0, '0'), H3: input(10, '0'), I3: given('Due in the next 10 days'),
      F4: given(2, '0'), G4: input(-21, '0'), H4: input(-1, '0'), I4: given('Overdue by 1 to 21 days'),
      F5: given(3, '0'), G5: input(-999, '0'), H5: input(-22, '0'), I5: given('Overdue by more than 21 days'),
      A9: header('Due Date'), B9: header('Due Date'), C9: header('Serviced'),
      A10: answer(), B10: answer(), C10: given('No'),
      A12: header('Van'), B12: header('Route'), C12: header('Due Date'), D12: header('Serviced'),
      ...Object.fromEntries(VANS.flatMap(([route, due, done], i) => [
        [`A${13 + i}`, given(`SV-${101 + i}`)], [`B${13 + i}`, given(route)], [`C${13 + i}`, given(serial(due), DATE)], [`D${13 + i}`, given(done)],
      ])),
      F12: header('Van'), G12: header('Route'), H12: header('Due Date'),
      ...block('FGH', 13, 12 + EXTRACT.length, answer()),
    },
    colWidths: { A: 120, B: 110, C: 110, D: 80, E: 24, F: 70, G: 96, H: 110, I: 210 },
  },
  tasks: [
    {
      id: 'window', kind: 'formula', cells: 'B5:B6',
      prompt: '(a) B5:B6: the first and last due date of the alert window: the as-at date in B3 plus the From and To offsets of the level in B4, looked up in the table F3:H5 (the blue offsets may be retuned).',
      solutions: { B5: '=$B$3+VLOOKUP($B$4,$F$3:$H$5,2,FALSE)', B6: '=$B$3+VLOOKUP($B$4,$F$3:$H$5,3,FALSE)' },
      wrong: ['=$B$3+VLOOKUP($B$4,$F$3:$H$5,3,FALSE)', '=VLOOKUP($B$4,$F$3:$H$5,2,FALSE)', '=$B$3+IF($B$4=1,0,IF($B$4=2,-21,-999))'],
      hints: [
        'Dates are day numbers, so adding an offset of -21 moves a date 21 days back.',
        'Look the level up in the first column of F3:H5 with `VLOOKUP`: From is column 2, To is column 3.',
        'B5 is the as-at date plus the From offset of the chosen level; B6 is the same with the To offset.',
      ],
      explain: 'Level 2 as at 20 Jul 2026 gives 29 Jun to 19 Jul 2026. Keeping the offsets in a table means a retuned window is one changed number and a new alert level one more row, not a new formula. A live tracker would hold =TODAY() in B3; a typed as-at date lets you replay a past situation. VLOOKUP without its last argument (approximate match) finds the same row here, because the levels are whole numbers in ascending order.',
    },
    {
      id: 'criteria', kind: 'formula', cells: 'A10:B10',
      prompt: '(b) A10:B10, under the two Due Date headers: the criteria as text in the form >=5 Jul 2026 and <=25 Jul 2026 (day without a leading zero, month as a word), built from B5 and B6 with `TEXT` and the format code d mmm yyyy.',
      solutions: { A10: '=">="&TEXT(B5,"d mmm yyyy")', B10: '="<="&TEXT(B6,"d mmm yyyy")' },
      check: { mustUse: ['TEXT'] },
      wrong: ['=">="&B5', '=">="&TEXT(B5,"dd/mm/yyyy")', '=">"&TEXT(B5,"d mmm yyyy")'],
      hints: [
        'Criteria values must be text: join the operator, in quotes, to the date with &.',
        'Joined without TEXT, a date turns into its serial number (>=46202).',
        'The code d mmm yyyy writes the day without a leading zero (dd would give 05) and the month as a word, which no one can misread.',
      ],
      explain: 'The same field twice on one criteria row is an AND: due on or after the start AND on or before the end. TEXT writes each date with the month as a word, so the criterion reads >=29 Jun 2026 and cannot be confused between day-first and month-first dates. Joined without TEXT it would read >=46202: Excel still filters correctly on that, but nobody can check it at a glance.',
    },
    {
      id: 'count', kind: 'formula', cells: 'B7',
      prompt: '(c) B7: how many vans the filter should list (due inside the window and not yet serviced), with one formula that compares the Due Date column with B5 and B6.',
      solution: '=SUMPRODUCT(($C$13:$C$48>=B5)*($C$13:$C$48<=B6)*($D$13:$D$48="No"))',
      wrong: ['=SUMPRODUCT(($C$13:$C$48>=B5)*($C$13:$C$48<=B6))', '=SUMPRODUCT(($C$13:$C$48>B5)*($C$13:$C$48<B6)*($D$13:$D$48="No"))', '=COUNTIF($C$13:$C$48,">="&B5)-COUNTIF($C$13:$C$48,">"&B6)'],
      hints: [
        'A test such as ($C$13:$C$48>=B5) gives TRUE or FALSE for every van; multiplying tests turns them into 1s and 0s.',
        '`SUMPRODUCT` adds the products, so a van counts only when every test gives 1.',
        'COUNTIF alone cannot test the Serviced column at the same time.',
      ],
      explain: '7 vans for level 2. Multiplying the TRUE/FALSE tests is an AND, the same rule as one criteria row, so B7 should match the number of rows the filter copies. Adding the tests instead would give each van a score from 0 to 3, so SUMPRODUCT would total the tests passed rather than count the vans.',
    },
    {
      id: 'extract', kind: 'tool', tool: 'advfilter', cells: `F13:H${12 + EXTRACT.length}`,
      prompt: '(d) With the inputs as given (as at 20 Jul 2026, level 2), run Data › Advanced: Copy to another location, List range A12:D48, Criteria range A9:C10, Copy to F12:H12 (the headers Van, Route and Due Date are already there).',
      toolSetup: { list: 'A12:D48', criteria: 'A9:C10', copyTo: 'F12:H12' },
      answer: {
        ...Object.fromEntries(EXTRACT.flatMap(([van, route, due], i) => [[`F${13 + i}`, van], [`G${13 + i}`, route], [`H${13 + i}`, serial(due)]])),
        [`F${13 + EXTRACT.length}`]: null,
      },
      hints: [
        'Copy to the header row F12:H12: only the columns named there are copied, in that order.',
        'The criteria range is the header row plus the value row: A9:C10. A blank row inside it would let every van through.',
      ],
      explain: 'Seven vans: SV-113, SV-115, SV-117, SV-124, SV-125, SV-129 and SV-135. Four serviced vans are also due in the window (SV-104, SV-105, SV-121, SV-128); Serviced = No on the same criteria row keeps them out.',
    },
    {
      id: 'rerun', kind: 'explain', cells: '',
      prompt: '(e) The manager changes B3 to 27 Jul 2026. B5:B7 and A10:B10 update at once, but the list under F12 does not. Explain why, and how the course\'s milestone tracker keeps its filtered view current. (If you try it, set B3 back to 20 Jul 2026 and run the filter again: part (d) is checked for the given inputs.)',
      answer: 'Advanced Filter is a one-off command: it copies the matching rows as values and does not recalculate when its criteria change, so it must be run again (Data › Advanced) after every change. The tracker automates this: the filter is recorded as a macro, and the sheet\'s Worksheet_Change event calls the macro whenever a watched input such as the alert level changes (tested with Intersect), so the view refreshes by itself. B7 is a formula, so a mismatch between B7 and the list shows that the list is out of date.',
      hints: ['Which of these cells hold formulas, and which hold values written by a command?', 'How could a macro be started automatically when B3 or B4 changes?'],
    },
  ],
  testCases: [
    { name: 'As at 3 Aug 2026', inputs: { B3: serial('2026-08-03') } },
    { name: 'Alert level 3 (very late)', inputs: { B4: 3 } },
    { name: 'Level 1 as at 6 Jul 2026', inputs: { B3: serial('2026-07-06'), B4: 1 } },
    { name: 'Level 2 retuned to 8-28 days overdue', inputs: { G4: -28, H4: -8 } },
  ],
  skills: ['Alert windows with VLOOKUP', 'Criteria strings with TEXT', 'Repeated header (between)', 'Advanced Filter copy to', 'SUMPRODUCT count of AND conditions'],
  techniques: [
    'Date functions (TODAY, MONTH, WEEKDAY, date differences)',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'What-if / scenario analysis by changing inputs',
  ],
}

export const exercises: readonly Exercise[] = [
  autofilter, sortCustom, textCodes, regionStatus,
  andOr, datesWildcards, computedUnique, pivots, monthHelper, pivotSettings,
  roomReport, fleetAlerts,
]
