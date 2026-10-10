import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 1 (folders "Week 1" and "Week 1a"): formula building and precedence, relative / absolute / mixed references,
// Fill vs Auto-Fill, TREND (seven $ signs, the line's slope and intercept), SUM / AVERAGE / MIN / MAX / IF / SUMPRODUCT /
// SQRT / ROUNDUP, professional layout (no hard-coding, test cases, documentation, blackbox roles).
// Original scenarios only: the course cases (gasoline prices, water tank, data-centre assets, Assignment 0) teach
// the same skills with their own data.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const title = (v: string): CellSpec => ({ v, role: 'label', bold: true })
const label = (v: string): CellSpec => ({ v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const note = (v: string): CellSpec => ({ v, role: 'note' })
const input = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'input', ...(fmt ? { fmt } : {}) })
const given = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'given', ...(fmt ? { fmt } : {}) })
const calc = (f: string, fmt?: string): CellSpec => ({ f, role: 'given', ...(fmt ? { fmt } : {}) })
const answer = (fmt?: string): CellSpec => ({ role: 'answer', ...(fmt ? { fmt } : {}) })

// 'B5' -> [column index, row number]
function split(ref: string): [number, number] {
  const m = /^([A-Z])(\d+)$/.exec(ref)
  if (!m) throw new Error(`bad ref ${ref}`)
  return [LETTERS.indexOf(m[1]), Number(m[2])]
}

// every cell of 'B5:F11' row by row, each with the same spec
function block(range: string, spec: CellSpec): Record<string, CellSpec> {
  const [a, b = a] = range.split(':')
  const [c1, r1] = split(a)
  const [c2, r2] = split(b)
  const out: Record<string, CellSpec> = {}
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out[`${LETTERS[c]}${r}`] = { ...spec }
  return out
}

// values written down a column from `start`
function down(start: string, values: readonly CellValue[], make: (v: CellValue) => CellSpec): Record<string, CellSpec> {
  const [c, r] = split(start)
  return Object.fromEntries(values.map((v, i) => [`${LETTERS[c]}${r + i}`, make(v)]))
}

// values written across a row from `start`
function across(start: string, values: readonly CellValue[], make: (v: CellValue) => CellSpec): Record<string, CellSpec> {
  const [c, r] = split(start)
  return Object.fromEntries(values.map((v, i) => [`${LETTERS[c + i]}${r}`, make(v)]))
}

const MONEY = '$#,##0.00'
const PCT = '0%'

// ---------- level 1 drills ----------

const precedence: Exercise = {
  id: 'w1-precedence-cafe-prices',
  week: 'W1',
  topic: 'Operator precedence',
  title: 'Brackets decide the price',
  level: 1,
  minutes: 5,
  scenario:
    'A café in a Raffles Place office tower lists its drinks before GST. Members get a percentage off the menu price, ' +
    'takeaway orders add a cup charge, and GST is charged on the whole bill. The manager wants price formulas that stay right when any of these inputs change.',
  sheet: {
    rows: 12,
    cols: 3,
    colWidths: { A: 300, B: 110 },
    cells: {
      A1: title('Café member prices'),
      A3: label('Menu price (before GST)'), B3: input(6.5, MONEY),
      A4: label('Member discount'), B4: input(0.15, PCT),
      A5: label('Takeaway cup charge'), B5: input(0.3, MONEY),
      A6: label('GST rate'), B6: input(0.09, PCT),
      A8: label('Member price, dine-in (incl. GST)'), B8: answer(MONEY),
      A9: label('Member price, takeaway (incl. GST)'), B9: answer(MONEY),
      A11: label('Excel shows for =-3^2+12/4*2'), B11: answer('General'),
    },
  },
  tasks: [
    {
      id: 'dinein',
      kind: 'formula',
      cells: 'B8',
      prompt: 'In B8 work out what a member pays for a dine-in drink: the menu price less the member discount, then GST added on the discounted price.',
      solution: '=B3*(1-B4)*(1+B6)',
      wrong: ['=B3*1-B4*1+B6', '=B3*(1-B4)*B6', '=B3-B4*(1+B6)', '=B3*(1-B4)'],
      hints: [
        'Say it in steps: discounted price = menu price x (1 - discount); price with GST = discounted price x (1 + GST rate).',
        'Excel multiplies before it adds or subtracts, so 1-B4 and 1+B6 each need their own brackets.',
        'Shape of the formula: =B3*(1 - discount cell)*(1 + GST cell).',
      ],
      explain:
        'B3*(1-B4) is the discounted price and *(1+B6) adds GST on top of it. Without brackets Excel would work out B3*1 and B4*1 first and then subtract and add, ' +
        'mixing dollars with percentages. 15% and 9% are stored as 0.15 and 0.09: the % format only changes the display, so never divide them by 100 again.',
    },
    {
      id: 'takeaway',
      kind: 'formula',
      cells: 'B9',
      prompt: 'In B9 work out the member takeaway price: the discounted drink plus the cup charge, with GST charged on both.',
      solution: '=(B3*(1-B4)+B5)*(1+B6)',
      wrong: ['=B3*(1-B4)+B5*(1+B6)', '=B3*(1-B4)*(1+B6)+B5', '=B3*(1-B4)+B5*1+B6', '=(B3+B5)*(1-B4)*(1+B6)'],
      hints: [
        'Add the cup charge to the discounted price first, then apply GST once to that total.',
        'Put brackets round the whole amount before GST, then multiply by (1 + GST rate).',
        'Shape of the formula: =(discounted drink + cup charge)*(1 + GST cell), with B3*(1-B4) as the discounted drink.',
      ],
      explain:
        'The outer brackets make Excel add the cup charge before multiplying by 1+B6, so GST is charged on the whole bill. ' +
        '=B8+B5*(1+B6) is an equivalent route that reuses the dine-in price.',
    },
    {
      id: 'predict',
      kind: 'value',
      cells: 'B11',
      prompt:
        "A colleague's sheet contains =-3^2+12/4*2. Work out by hand what Excel shows and type that number (the number, not the formula) in B11. Then check your prediction by entering the formula in a spare cell such as C11.",
      answer: 15,
      wrong: ['-3', '10.5', '-7.5'],
      hints: [
        'Excel applies negation before the power: -3^2 means (-3)^2.',
        'Then * and / run from left to right: 12/4 first, then times 2.',
      ],
      explain:
        'Order: brackets, negation, %, ^, * and /, + and -, with ties worked left to right. So -3^2 = 9 (negation first, unlike school algebra), ' +
        '12/4*2 = 6 and 9+6 = 15. Write -(3^2) or 0-3^2 when you mean -9.',
    },
  ],
  testCases: [
    { name: 'Menu price $4.80 at the 2023 GST rate of 8%', inputs: { B3: 4.8, B6: 0.08 } },
    { name: 'Members get 20% off and the cup costs $0.50', inputs: { B4: 0.2, B5: 0.5 } },
  ],
  skills: ['operator precedence', 'brackets in formulas', 'percentages stored as fractions', 'negation before ^'],
}

// SGD price list (rows 6-9: Classic, Clear, Leather, Rugged; columns B-D: Mini, Regular, Max)
const SGD: readonly (readonly number[])[] = [[12.9, 14.9, 16.9], [9.9, 11.9, 13.9], [24.9, 27.9, 29.9], [19.9, 22.9, 25.9]]

const ringgit: Exercise = {
  id: 'w1-absolute-ringgit-price-list',
  week: 'W1',
  topic: 'Absolute references',
  title: 'One exchange-rate cell for the whole price list',
  level: 1,
  minutes: 5,
  scenario:
    'A Singapore online shop sells phone cases to buyers in Johor Bahru. Its price list is in Singapore dollars: four designs in three sizes. ' +
    'One input cell holds the exchange rate, and the ringgit list and its rounded-up price tags must update when that rate changes.',
  sheet: {
    rows: 21,
    cols: 4,
    colWidths: { A: 190, B: 90, C: 90, D: 90 },
    cells: {
      A1: title('Phone-case price list'),
      A3: label('Ringgit per 1 SGD'), B3: input(3.42, '0.00'),
      A5: header('SGD price'), ...across('B5', ['Mini', 'Regular', 'Max'], (v) => header(String(v))),
      ...down('A6', ['Classic', 'Clear', 'Leather', 'Rugged'], (v) => label(String(v))),
      ...Object.fromEntries(SGD.flatMap((row, i) => Object.entries(across(`B${6 + i}`, row, (v) => input(v, MONEY))))),
      A11: header('Ringgit price'), ...across('B11', ['Mini', 'Regular', 'Max'], (v) => header(String(v))),
      ...down('A12', ['Classic', 'Clear', 'Leather', 'Rugged'], (v) => label(String(v))),
      ...block('B12:D15', answer('#,##0.00')),
      A17: header('Price tag (RM)'), ...across('B17', ['Mini', 'Regular', 'Max'], (v) => header(String(v))),
      ...down('A18', ['Classic', 'Clear', 'Leather', 'Rugged'], (v) => label(String(v))),
      ...block('B18:D21', answer('General')),
    },
  },
  tasks: [
    {
      id: 'convert',
      kind: 'formula',
      cells: 'B12:D15',
      prompt: 'In B12 convert the Classic Mini price to ringgit with one formula that you can fill right to D12 and down to row 15. Every cell must use the single rate in B3.',
      solution: '=B6*$B$3',
      check: { absolute: ['$B$3'] },
      wrong: ['=B6*B3', '=B6*B$3', '=B6*$B3'],
      hints: [
        'Write B12 first and check it, then think about where its copy in C13 would look for the rate.',
        'The rate must stay in column B when you fill right and in row 3 when you fill down: lock both parts. Pressing F4 once on the reference adds both $ signs (in Excel for Mac the shortcut is Cmd+T).',
        'B12 is the SGD price in B6 times the rate written as $B$3. After filling, C13 should read =C7*$B$3.',
      ],
      explain:
        '$B$3 is fully absolute, so every copy of the formula still reads the one rate, while B6 is relative and moves to each SGD price. ' +
        'With B$3 the fill to the right would look in C3 and D3 (empty, so 0); with $B3 the fill down would look in B4, B5 and so on.',
    },
    {
      id: 'tags',
      kind: 'formula',
      cells: 'B18:D21',
      prompt: 'Price tags show whole ringgit, always rounded up. In B18 use `ROUNDUP` on the ringgit price and fill the formula to D21.',
      solution: '=ROUNDUP(B12,0)',
      check: { mustUse: ['ROUNDUP'] },
      wrong: ['=ROUNDUP(B6,0)', '=ROUNDUP($B$12,0)', '=ROUNDUP(B12,1)'],
      hints: [
        '`ROUNDUP(number, num_digits)`: 0 digits gives a whole number.',
        'Each tag belongs to the price in the same position of the ringgit block, so this time no reference needs a $.',
      ],
      explain:
        'ROUNDUP(x,0) always rounds away from zero, so 44.12 becomes 45. The references stay relative because every tag uses its own price: ' +
        'anchoring is only for cells that every copy must share, like the rate in B3.',
    },
  ],
  testCases: [
    { name: 'Rate falls to 3.30 ringgit', inputs: { B3: 3.3 } },
    { name: 'Rate rises to 3.55 ringgit', inputs: { B3: 3.55 } },
    {
      // +50 cents keeps every ringgit price at least 0.028 away from a whole number, so ROUNDUP is not decided by rounding noise
      name: 'Every SGD price goes up by 50 cents',
      inputs: Object.fromEntries(SGD.flatMap((row, i) => row.map((p, j) => [`${LETTERS[1 + j]}${6 + i}`, Math.round((p + 0.5) * 100) / 100]))),
    },
  ],
  skills: ['absolute references', 'fill down and right', 'ROUNDUP', 'relative references'],
  techniques: ['Absolute/mixed references so formulas fill down/right'],
}

const markup: Exercise = {
  id: 'w1-mixed-markup-ready-reckoner',
  week: 'W1',
  topic: 'Mixed references',
  title: 'A markup table from one formula',
  level: 1,
  minutes: 5,
  scenario:
    'A furniture importer in Tampines prices every item as its landed cost plus a markup. The sales team wants a ready reckoner with landed costs ' +
    'down column A and markup rates across row 4, so they can quote any item at any markup. One formula typed in B5 must fill the whole table.',
  sheet: {
    rows: 13,
    cols: 6,
    colWidths: { A: 200 },
    cells: {
      A1: title('Selling-price ready reckoner'),
      A2: note('Selling price = landed cost x (1 + markup)'),
      A4: header('Landed cost \\ Markup'),
      ...across('B4', [0.25, 0.35, 0.5, 0.65, 0.8], (v) => input(v, PCT)),
      ...down('A5', [120, 185, 240, 310, 455, 580, 720], (v) => input(v, '$#,##0')),
      ...block('B5:F11', answer(MONEY)),
      A13: label('Average selling price'),
      ...block('B13:F13', answer(MONEY)),
    },
  },
  tasks: [
    {
      id: 'grid',
      kind: 'formula',
      cells: 'B5:F11',
      prompt: 'In B5 enter one formula for the selling price (landed cost x (1 + markup)) that fills right to F5 and down to row 11 without any editing.',
      solution: '=$A5*(1+B$4)',
      check: { absolute: ['$A5', 'B$4'] },
      wrong: ['=A5*(1+B4)', '=$A5*(1+$B4)', '=A$5*(1+B$4)', '=$A$5*(1+B$4)', '=$A5*B$4'],
      hints: [
        'Ask for each reference: when I fill right, must it stay in its column? When I fill down, must it stay in its row?',
        'The landed cost must stay in column A but move down the rows; the markup must stay in row 4 but move across the columns.',
        'Check a far corner: F11 should read =$A11*(1+F$4).',
      ],
      explain:
        '$A5 locks the column, so filling right keeps reading the costs while filling down moves to the next item; B$4 locks the row, so filling down keeps reading ' +
        'the markups while filling right moves to the next rate. Pressing F4 with the cursor on a reference cycles A5, $A$5, A$5, $A5 (in Excel for Mac the shortcut is Cmd+T).',
    },
    {
      id: 'averages',
      kind: 'formula',
      cells: 'B13:F13',
      prompt: 'In B13 use `AVERAGE` for the average selling price at the 25% markup, then fill right to F13.',
      solution: '=AVERAGE(B5:B11)',
      check: { mustUse: ['AVERAGE'] },
      wrong: ['=AVERAGE(B5:B10)', '=AVERAGE($B$5:$B$11)', '=SUM(B5:B11)/5'],
      hints: ['`AVERAGE(range)` adds the range and divides by how many numbers it holds.', 'Each column averages its own prices, so the range should move when you fill right.'],
      explain: 'AVERAGE counts the numbers for you, so adding an item row inside the range keeps it right; a hand-typed /7 would not.',
    },
  ],
  testCases: [
    { name: 'New season markups from 30% to 90%', inputs: { B4: 0.3, C4: 0.4, D4: 0.55, E4: 0.7, F4: 0.9 } },
    { name: 'Freight surcharge raises every landed cost', inputs: { A5: 132, A6: 199, A7: 258, A8: 333, A9: 489, A10: 624, A11: 774 } },
  ],
  skills: ['mixed references', 'fill down and right', 'F4 reference cycling', 'AVERAGE'],
  techniques: ['Absolute/mixed references so formulas fill down/right'],
}

const autofill: Exercise = {
  id: 'w1-autofill-vs-trend-bike-trips',
  week: 'W1',
  topic: 'Fill vs Auto-Fill',
  title: 'Auto-Fill a trend, then rebuild it with TREND',
  level: 1,
  minutes: 10,
  scenario:
    'A bike-sharing operator started a service in Punggol six months ago and records the trips taken in the town each month. The planner wants a quick ' +
    'straight-line projection for the next three months, first with Auto-Fill and then as live formulas that update when the data is revised, ' +
    'plus the equation of the line for the monthly report.',
  sheet: {
    rows: 16,
    cols: 4,
    colWidths: { A: 80, B: 110, C: 130, D: 210 },
    cells: {
      A1: title('Punggol bike-share trips per month (thousands)'),
      A3: header('Month'), B3: header('Trips (000)'), C3: header('TREND formula'),
      ...down('A4', [1, 2, 3, 4, 5, 6, 7, 8, 9], (v) => given(v, '0')),
      ...down('B4', [42, 47, 45, 53, 56, 58], (v) => input(v, '0.0')),
      ...block('B10:B12', answer('0.0')),
      ...block('C10:C12', answer('0.0')),
      D10: note('projection'),
      B14: header('Trend line'), C14: header('y = m x + b'),
      B15: label('Intercept b'), C15: answer('0.00'), D15: note('thousand trips on the line at month 0'),
      B16: label('Slope m'), C16: answer('0.00'), D16: note('thousand trips added per month'),
    },
  },
  tasks: [
    {
      id: 'autofill',
      kind: 'value',
      cells: 'B10:B12',
      prompt: 'Project the next three months with Auto-Fill: select the six known values B4:B9 and drag the fill handle (the small square at the bottom-right corner) down to B12.',
      answer: { B10: 61.666667, B11: 64.952381, B12: 68.238095 },
      // 0.05 = half a unit of the cell's 0.0 format, so the values as displayed (61.7, 65.0, 68.2) pass; every wrong
      // method below is at least 0.47 away
      check: { tol: 0.05 },
      wrong: ['58', '60', '59', '61.2'],
      hints: [
        'Select all six values, not just the last one: with a single number selected, dragging only copies it.',
        'Excel fits the best straight line through the selected points (least squares, assuming they are equally spaced) and extends it.',
      ],
      explain:
        'With several numbers selected, Auto-Fill extends their least-squares straight line: about 61.7, 65.0 and 68.2 thousand trips. ' +
        'Excel types these as values, so they do not change when B4:B9 change.',
    },
    {
      id: 'trend',
      kind: 'formula',
      cells: 'C10:C12',
      prompt:
        'Now write the same projection as a formula: in C10 use `TREND` with the six trip counts as known_y, their month numbers (A4:A9) as known_x ' +
        'and the new month in A10 as new_x, then fill it down to C12.',
      solution: '=TREND($B$4:$B$9,$A$4:$A$9,A10)',
      check: { mustUse: ['TREND'] },
      wrong: ['=TREND(B4:B9,A4:A9,A10)', '=TREND(B$4:B9,A$4:A9,A10)', '=TREND($B$4:$B$9,$A$4:$A$9,$A$10)', '=TREND($A$4:$A$9,$B$4:$B$9,A10)'],
      hints: [
        '`TREND(known_y, known_x, new_x)`: the trips are the y-values, the month numbers the x-values, and the new month is A10.',
        'Lock both history ranges with $ so they stay on months 1-6 when you fill down; the new month must move.',
        'Pattern: =TREND(trips B4:B9, months A4:A9, A10), with $ on every part of the two ranges and none on A10.',
      ],
      explain:
        'TREND fits the same least-squares line as Auto-Fill, so C10:C12 match B10:B12 today. Because it is a formula, revising a month in B4:B9 moves C10:C12 at once. ' +
        'Without the $ signs the window slides down; with a growing window (B$4:B9) the copies pull the typed Auto-Fill numbers in B10:B11 into the history, ' +
        'and those go stale as soon as the data is revised.',
    },
    {
      id: 'intercept',
      kind: 'formula',
      cells: 'C15',
      prompt:
        "The projection is the straight line y = m x + b (y in thousand trips, x the month number), and `TREND` returns the line's y for any new_x, " +
        "not only future months. In C15 use it to find the intercept b: the line's value at month 0.",
      solution: '=TREND($B$4:$B$9,$A$4:$A$9,0)',
      wrong: ['=TREND($B$4:$B$9,$A$4:$A$9,1)', '=B4', '=TREND($A$4:$A$9,$B$4:$B$9,0)', '=TREND($B$4:$B$9,$A$4:$A$9,0,FALSE)'],
      hints: [
        'A straight line y = m x + b crosses the y-axis where x = 0, and there y = b.',
        'So b is the line evaluated at month 0: give TREND the same known_y and known_x as in C10, and 0 as new_x.',
        'C15: =TREND(the six trip counts, their month numbers, 0).',
      ],
      explain:
        'At month 0 the line gives b = 38.67 thousand trips. It is a property of the fitted line, not a real month: the data start at month 1. ' +
        "TREND's optional fourth argument, const, is TRUE when left out, so Excel works b out; =TREND(...,0,FALSE) would force the line through the origin " +
        '(b = 0) and change every projection.',
    },
    {
      id: 'slope',
      kind: 'formula',
      cells: 'C16',
      prompt: 'In C16 find the slope m: how many thousand trips the line adds from one month to the next.',
      solution: '=TREND($B$4:$B$9,$A$4:$A$9,1)-TREND($B$4:$B$9,$A$4:$A$9,0)',
      wrong: ['=(B9-B4)/(A9-A4)', '=TREND($B$4:$B$9,$A$4:$A$9,1)', '=B9-B8'],
      hints: [
        'The slope is how much the line rises for one step of x.',
        'Take two points on the fitted line one month apart and subtract. Do not use two data points: the data zigzag around the line.',
        'C16: the line at month 1 minus the line at month 0 (your C15), or two neighbouring projections such as C11 - C10.',
      ],
      explain:
        'm = 3.29 thousand trips a month (3.2857 unrounded), so the line is y = 3.29x + 38.67. Check with the unrounded values: 3.2857 x 7 + 38.667 = 61.67, ' +
        'the value in C10. Rise over run between the first and last months, (58 - 42) / 5 = 3.2, is not the least-squares slope: it ignores the four months ' +
        'in between. When an exam asks for the equation of the trend, quote m and b like this; a chart trendline with Display Equation (week 2) shows the same two numbers.',
    },
    {
      id: 'live',
      kind: 'explain',
      cells: '',
      prompt:
        'Change month 5 (B8) from 56 to 64 and watch both projections. Which cells move, which do not, and when would you still use Auto-Fill? ' +
        'Set B8 back to 56 afterwards.',
      answer:
        'The TREND formulas in C10:C12 change, and so do b and m in C15:C16. The Auto-Fill numbers in B10:B12 were typed in once and keep the old projection ' +
        'until you Auto-Fill again. Fill copies a formula and adjusts its references, so the copies stay live; Auto-Fill with numbers selected writes values. ' +
        'Auto-Fill is fine for fixed series such as month numbers or dates; anything that depends on data that may change should be a formula.',
    },
  ],
  testCases: [
    { name: 'Month 6 revised to 64 thousand trips', inputs: { B9: 64 } },
    { name: 'Month 1 revised to 38 thousand trips', inputs: { B4: 38 } },
  ],
  skills: ['Fill vs Auto-Fill', 'Auto-Fill linear projection', 'TREND', 'trend equation y = mx + b'],
  techniques: ['Linear trend forecasting (TREND / trendline)', 'Absolute/mixed references so formulas fill down/right'],
}

const cargo: Exercise = {
  id: 'w1-trend-anchored-cargo-lanes',
  week: 'W1',
  topic: 'TREND anchoring',
  title: 'One TREND formula for three lanes and four months',
  level: 1,
  minutes: 6,
  scenario:
    'A freight forwarder at the Changi Airfreight Centre tracks monthly tonnage on three lanes: Jakarta, Bangkok and Sydney. It wants a straight-line forecast ' +
    'for the next four months on every lane, from one TREND formula typed once and filled right and down.',
  sheet: {
    rows: 18,
    cols: 5,
    colWidths: { A: 80, B: 110, C: 110, D: 110 },
    cells: {
      A1: title('Monthly air-freight tonnage'),
      A2: note('Months 1-10 are actual; months 11-14 are the forecast.'),
      A4: header('Month'), B4: header('Jakarta (t)'), C4: header('Bangkok (t)'), D4: header('Sydney (t)'),
      ...down('A5', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], (v) => given(v, '0')),
      ...down('B5', [410, 432, 425, 451, 466, 458, 480, 497, 489, 512], (v) => input(v, '#,##0')),
      ...down('C5', [285, 279, 292, 288, 301, 296, 305, 311, 309, 318], (v) => input(v, '#,##0')),
      ...down('D5', [196, 190, 188, 181, 185, 176, 171, 174, 165, 162], (v) => input(v, '#,##0')),
      ...block('B15:D18', answer('#,##0.0')),
      E15: note('forecast'),
    },
  },
  tasks: [
    {
      id: 'forecast',
      kind: 'formula',
      cells: 'B15:D18',
      prompt:
        "In B15 forecast Jakarta's month-11 tonnage with `TREND` (known_y: the ten actual tonnages, known_x: the month numbers in A5:A14, new_x: the month in A15), " +
        'written so that the same formula fills right to D15 and down to row 18.',
      solution: '=TREND(B$5:B$14,$A$5:$A$14,$A15)',
      check: { mustUse: ['TREND'], absolute: ['B$5', '$A$5', '$A15'] },
      wrong: ['=TREND(B5:B14,A5:A14,A15)', '=TREND($B$5:$B$14,$A$5:$A$14,$A15)', '=TREND(B$5:B$14,A$5:A$14,A15)', '=TREND(B$5:B$14,$A$5:$A$14,A15)'],
      hints: [
        'Filling right moves to the next lane, so the tonnage range must move across but keep its rows. Filling down moves to the next month, so no history range may slide.',
        'The month numbers live only in column A: lock that column in the known_x range and in the new_x cell.',
        'Count your $ signs: the course pattern has seven.',
      ],
      explain:
        'B$5:B$14 keeps the ten real months when you fill down but moves to the next lane when you fill right; $A$5:$A$14 never moves; $A15 stays in column A while ' +
        "its row steps down to months 12-14. This is the course's Method 1 (seven $ signs). Leaving the $ off the bottom rows of both ranges (B$5:B14 and $A$5:$A14, " +
        'Method 2 with five $ signs) lets the window grow to include forecasts that lie on the line: the numbers come out the same, so it adds nothing. ' +
        'Grow only one of them and the two ranges no longer match in size, so TREND returns an error.',
    },
    {
      id: 'sliding',
      kind: 'explain',
      cells: '',
      prompt: 'A colleague typed =TREND(B5:B14,A5:A14,A15) in B15 and filled it to D18. Which ranges does the copy in B18 use, and why do its forecasts differ from yours?',
      answer:
        'B18 becomes =TREND(B8:B17,A8:A17,A18). The window slides down three rows: it drops the three oldest months and treats the forecasts in B15:B17 as if ' +
        "they were real data, so the line is refitted on every row and its slope drifts. That rolling window is the course's Method 3, which only makes sense " +
        'when you deliberately want the latest months to count more. Filled right, the x-range also drifts off the month numbers onto the tonnage columns, ' +
        'which is plainly wrong. Method 1 (seven $ signs) keeps every forecast on the line fitted to the ten actual months.',
    },
  ],
  testCases: [
    { name: 'Latest month revised on every lane', inputs: { B14: 530, C14: 300, D14: 170 } },
    { name: 'First month revised on every lane', inputs: { B5: 395, C5: 270, D5: 205 } },
  ],
  skills: ['TREND with seven $ signs', 'mixed references in TREND', 'fill down and right', 'growing and rolling windows'],
  techniques: ['Linear trend forecasting (TREND / trendline)', 'Absolute/mixed references so formulas fill down/right'],
}

// ---------- level 2 applied models ----------

const OFFICES = ['Raffles Place', 'Changi', 'one-north', 'Woodlands']
const ARRANGEMENTS = ['Orchid bowl', 'Table posy', 'Reception urn', 'Desk succulent', 'Lily vase']
// quantities per arrangement (rows 9-13) and office (columns C-F)
const QTY: readonly (readonly number[])[] = [[3, 1, 2, 0], [6, 2, 4, 3], [1, 1, 1, 0], [10, 4, 8, 5], [2, 0, 1, 1]]
// every quantity cell changed by `delta` (a test case that moves every line amount, so no typed quantity survives)
const qtyCase = (delta: number): Record<string, CellValue> =>
  Object.fromEntries(QTY.flatMap((row, i) => row.map((q, j) => [`${LETTERS[2 + j]}${9 + i}`, q + delta])))

const florist: Exercise = {
  id: 'w1-florist-quote-grid',
  week: 'W1',
  topic: 'Price x quantity grid',
  title: 'A quotation grid with discount, GST and a delivery rule',
  level: 2,
  minutes: 18,
  scenario:
    'A florist in Bukit Timah supplies weekly arrangements to four offices of one corporate client. Unit prices sit in column B and the quantities ' +
    'each office ordered in the grid. A volume discount and GST apply to every line, and an office whose flowers come to less than a threshold pays a delivery fee. ' +
    'Build the quotation so that any change to a price, quantity or rate flows through.',
  sheet: {
    rows: 28,
    cols: 7,
    colWidths: { A: 270, B: 90, C: 110, D: 110, E: 110, F: 110, G: 110 },
    cells: {
      A1: title('Florist: weekly quotation'),
      A3: label('Volume discount'), C3: input(0.08, PCT),
      A4: label('GST'), C4: input(0.09, PCT),
      A5: label('Free delivery from (flowers incl. GST)'), C5: input(400, '$#,##0'),
      A6: label('Delivery fee per office'), C6: input(35, MONEY),
      A8: header('Arrangement'), B8: header('Unit price'), ...across('C8', OFFICES, (v) => header(String(v))),
      ...down('A9', ARRANGEMENTS, (v) => label(String(v))),
      ...down('B9', [48, 26, 95, 18, 39], (v) => input(v, MONEY)),
      ...Object.fromEntries(QTY.flatMap((row, i) => Object.entries(across(`C${9 + i}`, row, (v) => input(v, '0'))))),
      A15: header('Amount after discount, incl. GST'), ...across('C15', [...OFFICES, 'All offices'], (v) => header(String(v))),
      ...down('A16', ARRANGEMENTS, (v) => label(String(v))),
      ...block('C16:F20', answer(MONEY)),
      A21: label('Flowers'), ...block('C21:F21', answer(MONEY)),
      A22: label('Office total incl. delivery'), ...block('C22:F22', answer(MONEY)),
      A23: label('Share of the grand total'), ...block('C23:F23', answer('0.0%')),
      ...block('G16:G22', answer(MONEY)),
      A24: label('Largest office total'), C24: answer(MONEY),
      A25: label('Smallest office total'), C25: answer(MONEY),
      A26: label('Average office total'), C26: answer(MONEY),
      A28: label('What-if: grand total at a 15% discount'), C28: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'amounts',
      kind: 'formula',
      cells: 'C16:F20',
      prompt:
        'In C16 enter one formula for the Orchid bowl amount for Raffles Place: unit price x quantity, less the volume discount, plus GST. It must fill right to F16 and down to row 20.',
      solution: '=$B9*C9*(1-$C$3)*(1+$C$4)',
      check: { absolute: ['$B9', '$C$3', '$C$4'] },
      wrong: ['=B9*C9*(1-C3)*(1+C4)', '=$B9*C9*(1-C3)*(1+C4)', '=B$9*C9*(1-$C$3)*(1+$C$4)', '=$B9*C9*(1-$C$3)+$C$4'],
      hints: [
        'Three kinds of reference meet here: the quantity moves both ways, the unit price moves down but never right, the two rates never move.',
        'Unit price: lock only the column. Discount and GST: lock both column and row.',
        'Check a far cell: F20 should multiply $B13 by F13.',
      ],
      explain:
        'C9 is relative (each office and arrangement has its own quantity), $B9 keeps the price column when you fill right, and $C$3 and $C$4 always read the two rates. ' +
        'Brackets make the discount and GST apply to the whole line amount. Gotcha: with B$9 every arrangement would be priced as an Orchid bowl.',
    },
    {
      id: 'flowers',
      kind: 'formula',
      cells: 'C21:F21',
      prompt: 'In C21 total the flowers for Raffles Place with `SUM`, then fill right to F21.',
      solution: '=SUM(C16:C20)',
      check: { mustUse: ['SUM'] },
      wrong: ['=SUM(C16:C19)', '=SUM($C$16:$C$20)'],
      hints: ['Select the five amounts above the cell.', 'Each office sums its own column, so the range must move when you fill right.'],
      explain:
        'A relative SUM range shifts one column per office. Selecting the range with the mouse avoids typing an off-by-one end row. ' +
        'Cross-check in a spare cell such as E24: =SUMPRODUCT($B$9:$B$13,C9:C13)*(1-$C$3)*(1+$C$4) prices a whole office column in one formula and gives the same total.',
    },
    {
      id: 'delivery',
      kind: 'formula',
      cells: 'C22:F22',
      prompt:
        'In C22 work out the office total including delivery with `IF`: an office whose flowers (row 21) come to less than the free-delivery threshold in C5 pays the fee in C6, otherwise nothing extra. Fill right to F22.',
      solution: '=C21+IF(C21<$C$5,$C$6,0)',
      check: { mustUse: ['IF'] },
      wrong: ['=C21+IF(C21>$C$5,$C$6,0)', '=C21+IF(C21<C5,C6,0)', '=IF(C21<$C$5,$C$6,0)'],
      hints: [
        '`IF(test, value_if_true, value_if_false)`: the test compares the office flowers with the threshold.',
        'Add the IF result to the flowers. The threshold and the fee are shared by every office, so anchor them before filling right.',
        'Shape of the formula: =C21+IF(C21<threshold, fee, 0), with the threshold and the fee cells locked with $.',
      ],
      explain:
        'IF returns the fee only when the test C21<$C$5 is TRUE, and 0 otherwise, so the total is flowers + fee or flowers alone. ' +
        'Changi and Woodlands pay the fee. Unanchored, the copies in D22:F22 would compare with D5, E5 and F5, which are empty.',
    },
    {
      id: 'totals',
      kind: 'formula',
      cells: 'G16:G22',
      prompt: 'In G16 total the row across the four offices with `SUM` and fill down to G22, so G21 shows all the flowers and G22 the grand total.',
      solution: '=SUM(C16:F16)',
      check: { mustUse: ['SUM'] },
      wrong: ['=SUM(C16:E16)', '=SUM($C$16:$F$16)'],
      hints: ['Sum across the row this time: four office columns.', 'Filling down, the range must move to each row, so leave it relative.'],
      explain: 'One relative SUM filled down gives the arrangement totals, the flowers total (G21) and the grand total (G22): the row and column totals cross-check each other.',
    },
    {
      id: 'share',
      kind: 'formula',
      cells: 'C23:F23',
      prompt: "In C23 show Raffles Place's share of the grand total in G22, then fill right to F23. The cells are already formatted as percentages.",
      solution: '=C22/$G$22',
      wrong: ['=C22/G22', '=C22/$G$22*100', '=C22/$G$21', '=C21/$G$22'],
      hints: [
        "Share = this office's total / the grand total.",
        'Every office divides by the same grand total, so lock the column of G22 before filling right.',
        'Shape of the formula: =C22/G22 with a $ in front of the G. Do not multiply by 100: the % format does that for you.',
      ],
      explain:
        '=C22/$G$22 gives 0.39, which the % format shows as 39.0%. Excel stores a percentage as a fraction, so never multiply by 100: =C22/$G$22*100 would show 3899.0%. ' +
        'Without the $ the copies would divide by H22, I22 and J22, which are empty, and show #DIV/0!. The four shares add up to 100%, a quick check that no office is missing.',
    },
    // three single-cell tasks, not one C24:C26 task: the checker's messages for an empty multi-cell task say "fill it across",
    // which would put MAX in all three cells
    {
      id: 'largest',
      kind: 'formula',
      cells: 'C24',
      prompt: 'Now summarise the office totals in row 22, one formula per cell. In C24 show the largest office total with `MAX`.',
      solution: '=MAX(C22:F22)',
      check: { mustUse: ['MAX'] },
      wrong: ['=MAX(C16:F20)', '=MAX(G16:G20)', '=MAX(C21:F21)', '=MAX(C22:G22)'],
      hints: ['The four office totals are C22:F22.', 'Use row 22, not row 21, so the delivery fees count, and stop at F22: G22 is the grand total, not an office.'],
      explain: 'MAX scans the four office totals in one step. Row 22 includes the delivery fees; including G22 would return the grand total.',
    },
    {
      id: 'smallest',
      kind: 'formula',
      cells: 'C25',
      prompt: 'In C25 show the smallest office total with `MIN`.',
      solution: '=MIN(C22:F22)',
      check: { mustUse: ['MIN'] },
      wrong: ['=MIN(C21:F21)', '=MIN(C16:F20)', '=MIN(C22:E22)'],
      hints: ['Same four cells as C24.', 'Row 22 again, so the smallest office is charged its delivery fee.'],
      explain: 'MIN reads the same range as MAX. Typing =F22 because Woodlands is smallest today would break as soon as another office orders less.',
    },
    {
      id: 'average',
      kind: 'formula',
      cells: 'C26',
      prompt: 'In C26 show the average office total with `AVERAGE`.',
      solution: '=AVERAGE(C22:F22)',
      check: { mustUse: ['AVERAGE'] },
      wrong: ['=AVERAGE(C21:F21)', '=AVERAGE(C22:G22)', '=G22/5'],
      hints: ['Average the four office totals, not the grand total.', '`AVERAGE(C22:F22)` adds the four totals and divides by 4 for you.'],
      explain:
        'MAX, MIN and AVERAGE summarise a range in one step, the trio the course uses for every column of data. The average office total equals G22/4 here; ' +
        'AVERAGE keeps working if an office is added inside the range.',
    },
    {
      id: 'whatif',
      kind: 'value',
      cells: 'C28',
      prompt: 'What-if: change the discount in C3 to 15%, read the grand total in G22, type that number (2 decimals) into C28, then set C3 back to 8%.',
      answer: 1557.03,
      check: { tol: 0.006 },
      wrong: ['1679.49', '1487.03'],
      hints: ['Type 15% into C3 and the whole grid recalculates.', 'Read G22 (flowers plus delivery fees), not G21.', 'Type the number itself: =G22 would change back when C3 is reset.'],
      explain:
        'The grand total falls from $1,679.49 to $1,557.03: the bigger discount cuts every line, while the two delivery fees stay because no office crosses ' +
        'the $400 threshold (one-north is still above it at $442.87). Because every formula refers to the rate cell, a what-if is one edit; ' +
        'a hard-coded 0.92 inside the formulas would have to be found and changed in 20 places.',
    },
  ],
  testCases: [
    { name: 'Discount 12% and GST at 8%', inputs: { C3: 0.12, C4: 0.08 } },
    // every office, the largest included, now pays the fee: MAX/MIN/AVERAGE of row 21 instead of row 22 fail
    { name: 'Free delivery only from $700, fee $40', inputs: { C5: 700, C6: 40 } },
    {
      name: 'New price list; Woodlands adds 2 bowls and an urn, Changi a lily vase',
      inputs: { B9: 52, B10: 28, B11: 99, B12: 20, B13: 42, F9: 2, F11: 1, D13: 1 },
    },
    { name: 'Every office orders one more of each arrangement', inputs: qtyCase(1) },
    // one-north becomes the largest office, so a direct reference to Raffles Place (=C22) cannot pass for MAX
    { name: 'one-north doubles its weekly order', inputs: { E9: 4, E10: 8, E11: 2, E12: 16, E13: 2 } },
  ],
  skills: ['price x quantity grid', 'mixed and absolute references', 'SUM', 'IF', 'share of a total (%)', 'MAX/MIN/AVERAGE', 'what-if by changing an input'],
  techniques: ['Absolute/mixed references so formulas fill down/right', 'What-if / scenario analysis by changing inputs'],
}

const HEIGHTS = [2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5]

const coldRoom: Exercise = {
  id: 'w1-cold-room-cheapest-height',
  week: 'W1',
  topic: 'Design by enumeration',
  title: 'The cheapest cold room for a fixed volume',
  level: 2,
  minutes: 15,
  scenario:
    'A seafood distributor at Jurong Fishery Port needs a walk-in cold room holding 48 cubic metres. The loading bay fixes the depth at 4 m. ' +
    'The floor slab, the insulated wall panels and the ceiling panels each cost a different amount per square metre. ' +
    'Try heights from 2.00 m to 5.00 m in steps of 0.25 m and find the cheapest design.',
  sheet: {
    rows: 20,
    cols: 10,
    colWidths: { A: 90, B: 90, C: 90, D: 90, E: 90, F: 90, G: 110, H: 80, I: 100, J: 110 },
    cells: {
      A1: title('Cold room: cost by height'),
      A3: label('Storage volume (m³)'), C3: input(48, '0.0'),
      A4: label('Depth (m)'), C4: input(4, '0.00'),
      A6: label('Unit cost ($/m²)'), D6: input(120, '$#,##0'), E6: input(85, '$#,##0'), F6: input(50, '$#,##0'),
      A7: header('Height (m)'), B7: header('Depth (m)'), C7: header('Length (m)'), D7: header('Floor (m²)'), E7: header('Walls (m²)'),
      F7: header('Ceiling (m²)'), G7: header('Cost ($)'), H7: header('Flag'),
      A8: given(2, '0.00'), A9: given(2.25, '0.00'),
      ...block('A10:A20', answer('0.00')),
      ...Object.fromEntries(HEIGHTS.map((_, i) => [`B${8 + i}`, calc('=$C$4', '0.00')])),
      ...block('C8:C20', answer('0.00')),
      ...Object.fromEntries(HEIGHTS.map((_, i) => [`D${8 + i}`, calc(`=B${8 + i}*C${8 + i}`, '0.00')])),
      ...block('E8:E20', answer('0.00')),
      ...Object.fromEntries(HEIGHTS.map((_, i) => [`F${8 + i}`, calc(`=D${8 + i}`, '0.00')])),
      ...block('G8:G20', answer(MONEY)),
      ...block('H8:H20', answer()),
      I8: label('Lowest cost'), J8: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'heights',
      kind: 'value',
      cells: 'A10:A20',
      prompt: 'List the heights to try: select A8:A9 together and drag the fill handle down to A20, so Auto-Fill continues the 0.25 m step up to 5.00 m.',
      answer: Object.fromEntries(HEIGHTS.slice(2).map((h, i) => [`A${10 + i}`, h])),
      wrong: ['2.25', '2'],
      hints: ['Select both starting heights: two numbers tell Excel the step.', 'With only A9 selected, dragging copies 2.25 down the column.'],
      explain: 'Auto-Fill reads the step from the selected cells (+0.25) and continues it. The heights are the decision being tried, so typed values are right here.',
    },
    {
      id: 'length',
      kind: 'formula',
      cells: 'C8:C20',
      prompt:
        'Column B repeats the depth from C4 (=$C$4). In C8 work out the length that gives the required volume (volume = height x depth x length) and fill down to C20.',
      solution: '=$C$3/(A8*B8)',
      wrong: ['=C3/(A8*B8)', '=$C$3/A8*B8', '=$C$3/(A8+B8)'],
      hints: [
        'Rearrange volume = height x depth x length for the length.',
        'Divide by the product of height and depth: it needs brackets. The volume is the same for every row.',
        'Shape of the formula: =volume cell with $ / (this row\'s height * this row\'s depth).',
      ],
      explain:
        'Length = volume / (height x depth). The brackets matter: =$C$3/A8*B8 divides by the height and then multiplies by the depth. ' +
        'The volume is anchored because every row needs it; height and depth stay relative so each row uses its own.',
    },
    {
      id: 'walls',
      kind: 'formula',
      cells: 'E8:E20',
      prompt:
        'Floor (D) and ceiling (F) are filled in for you. In E8 work out the area of the four walls (two of depth x height, two of length x height) and fill down to E20.',
      solution: '=2*(B8+C8)*A8',
      wrong: ['=2*B8+C8*A8', '=(B8+C8)*A8', '=2*(B8*C8)*A8'],
      hints: ['Two walls are depth x height and two are length x height.', 'Factor out the height: 2 x (depth + length) x height.'],
      explain: '2*(B8+C8)*A8 is the perimeter of the floor times the height. Without the brackets Excel would compute 2*B8 + C8*A8.',
    },
    {
      id: 'cost',
      kind: 'formula',
      cells: 'G8:G20',
      prompt: 'In G8 cost the room with `SUMPRODUCT`: pair the unit costs in D6:F6 with the three areas of the row, and fill down to G20.',
      solution: '=SUMPRODUCT($D$6:$F$6,D8:F8)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(D6:F6,D8:F8)', '=SUMPRODUCT($D$6:$F$6,$D$8:$F$8)', '=SUMPRODUCT(D8:F8)'],
      hints: [
        '`SUMPRODUCT(array1, array2)` multiplies the arrays item by item and adds the products: 120 x floor + 85 x walls + 50 x ceiling.',
        'The unit costs are the same for every row; the areas belong to each row.',
        'Shape of the formula: =SUMPRODUCT(unit costs D6:F6 locked with $, this row\'s areas D8:F8 left relative).',
      ],
      explain:
        'SUMPRODUCT($D$6:$F$6,D8:F8) = D6*D8 + E6*E8 + F6*F8 in one short formula that fills down. Both ranges must be the same shape (1 x 3 here). ' +
        'Without the $ the unit-cost range would slide down into the table as you fill.',
    },
    {
      id: 'lowest',
      kind: 'formula',
      cells: 'J8',
      prompt: 'In J8 find the lowest cost in the table with `MIN`.',
      solution: '=MIN(G8:G20)',
      check: { mustUse: ['MIN'] },
      wrong: ['=MAX(G8:G20)', '=MIN(C8:C20)', '=MIN(G8:G19)', '=MIN(G9:G20)'],
      hints: ['`MIN(range)` returns the smallest number in the range.', 'Use the whole cost column, G8 to G20, so no design is left out.'],
      explain: 'MIN scans all 13 designs at once, and it updates when any input changes.',
    },
    {
      id: 'flag',
      kind: 'formula',
      cells: 'H8:H20',
      prompt: 'In H8 use `IF` to show the text Lowest when the row cost equals the lowest cost in J8, and an empty text ("") otherwise. Fill down to H20.',
      solution: '=IF(G8=$J$8,"Lowest","")',
      check: { mustUse: ['IF'] },
      wrong: ['=IF(G8=J8,"Lowest","")', '=IF(G8<$J$8,"Lowest","")', '=IF(G8>$J$8,"Lowest","")'],
      hints: ['The test compares the row cost with the lowest cost.', 'Every row compares with the same cell J8, so lock it before filling down.'],
      explain:
        'IF(test,"Lowest","") labels the cheapest row and leaves the others blank-looking. "" is an empty text, not a blank cell. ' +
        'With J8 unanchored the copies would compare with J9, J10... which are empty (0). In Excel the same test, =$G8=$J$8, also works as a ' +
        'conditional-formatting rule on A8:H20 to shade the cheapest row.',
    },
    {
      id: 'interpret',
      kind: 'explain',
      cells: '',
      prompt: 'Describe how the cost changes as the room gets taller and why. State the cheapest height and its cost, and say what you would check before recommending it.',
      answer:
        'Cost falls steeply at first and then rises slowly: a U shape. A taller room needs a shorter length for the same 48 m³, so the floor and ceiling ' +
        'shrink while the wall area grows with the height. The cheapest height on this grid is 3.50 m at about $6,751. Heights from 3.25 m to 3.75 m are within about $15 ' +
        'of it, so practical limits (building clearance, door and racking heights, cooling a taller room) can decide within that band. The 0.25 m grid only ' +
        'brackets the optimum: a finer grid around 3.50 m would narrow it down.',
    },
  ],
  testCases: [
    // the cheapest height moves to 5.00 m, 3.75 m, 3.25 m and 2.00 m: the first and last rows are tested too
    { name: 'Volume grows to 100 m³', inputs: { C3: 100 } },
    { name: 'Depth limited to 3.5 m and the floor slab costs $130/m²', inputs: { C4: 3.5, D6: 130 } },
    { name: 'Wall panels $95/m² and ceiling panels $60/m²', inputs: { E6: 95, F6: 60 } },
    { name: 'A small 16 m³ chiller room', inputs: { C3: 16 } },
  ],
  skills: ['fixed-volume design', 'enumerating a decision', 'SUMPRODUCT', 'MIN', 'IF flag', 'Auto-Fill step series', 'absolute references'],
  techniques: ['SUMPRODUCT totals and weighted/expected values', 'Absolute/mixed references so formulas fill down/right', 'Written interpretation of model results'],
}

// test-case block (rows 17-21): label, demand (kg/yr), cost per order ($), holding cost ($/kg/yr)
const EOQ_CASES: readonly (readonly [string, number, number, number])[] = [
  ['Base case', 36000, 85, 1.9],
  ['Very large demand (four times)', 144000, 85, 1.9],
  ['Very small demand', 900, 85, 1.9],
  ['Ordering almost free ($2 online)', 36000, 2, 1.9],
  ['Storage almost free ($0.05/kg)', 36000, 85, 0.05],
]

const eoq: Exercise = {
  id: 'w1-eoq-tapioca-orders',
  week: 'W1',
  topic: 'Formula building and test cases',
  title: 'How much tapioca to order at a time',
  level: 2,
  minutes: 15,
  scenario:
    'A bubble-tea chain with 14 outlets buys frozen tapioca pearls from a supplier in Johor. Every order costs a fixed amount for paperwork and delivery booking, ' +
    'and every kilogram held in the cold store costs money for a year. The supplier ships whole cartons only and the cold store has limited space. ' +
    'Build a reusable order-size model, with test cases that show how it behaves.',
  sheet: {
    rows: 21,
    cols: 5,
    colWidths: { A: 280, B: 120, C: 130, D: 130, E: 110 },
    cells: {
      A1: title('Tapioca pearls: order size'),
      A3: label('Annual demand (kg)'), B3: input(36000, '#,##0'),
      A4: label('Cost per order ($)'), B4: input(85, MONEY),
      A5: label('Holding cost per kg per year ($)'), B5: input(1.9, MONEY),
      A6: label('Carton size (kg)'), B6: input(25, '0'),
      A7: label('Cold-store space (kg)'), B7: input(2000, '#,##0'),
      A9: label('Economic order quantity (kg)'), B9: answer('#,##0.0'),
      A10: label('Cartons per order'), B10: answer('General'),
      A11: label('Order quantity (kg)'), B11: answer('#,##0'),
      A12: label('Orders per year'), B12: answer('0.0'),
      A13: label('Annual ordering + holding cost ($)'), B13: answer(MONEY),
      A14: label('Fits the cold store?'), B14: answer(),
      A16: header('Test case'), B16: header('Demand (kg/yr)'), C16: header('Cost per order ($)'), D16: header('Holding ($/kg/yr)'), E16: header('EOQ (kg)'),
      ...down('A17', EOQ_CASES.map((c) => c[0]), (v) => label(String(v))),
      ...down('B17', EOQ_CASES.map((c) => c[1]), (v) => input(v, '#,##0')),
      ...down('C17', EOQ_CASES.map((c) => c[2]), (v) => input(v, MONEY)),
      ...down('D17', EOQ_CASES.map((c) => c[3]), (v) => input(v, MONEY)),
      ...block('E17:E21', answer('#,##0.0')),
    },
  },
  tasks: [
    {
      id: 'eoq',
      kind: 'formula',
      cells: 'B9',
      prompt: 'In B9 calculate the economic order quantity: the square root of (2 x annual demand x cost per order / holding cost per kg per year).',
      solution: '=SQRT(2*B3*B4/B5)',
      wrong: ['=SQRT(2*B3*B4)/B5', '=(2*B3*B4/B5)^1/2', '=2*B3*B4/B5^0.5'],
      hints: [
        '`SQRT(number)` takes the square root; raising to the power 0.5 does the same.',
        'If you use ^0.5, put the whole fraction in brackets first: ^ runs before * and /.',
        'Shape of the formula: =SQRT(2*demand*cost per order/holding cost), with the three input cells B3, B4 and B5.',
      ],
      explain:
        'EOQ balances ordering cost (fewer, bigger orders) against holding cost (more stock on the shelf): about 1,794.7 kg. ' +
        'Gotcha: =(...)^1/2 is not a square root, because ^ runs before /, so it raises to the power 1 and then halves. ' +
        'B9 shows one decimal but holds 1794.7291...: a number format changes what you see, not the stored value, so whole cartons need ROUNDUP, not a 0-decimal format.',
    },
    {
      id: 'cartons',
      kind: 'formula',
      cells: 'B10',
      prompt: 'The supplier ships whole cartons. In B10 use `ROUNDUP` for the number of cartons that covers the EOQ.',
      solution: '=ROUNDUP(B9/B6,0)',
      check: { mustUse: ['ROUNDUP'] },
      wrong: ['=B9/B6', '=ROUNDUP(B9,0)/B6', '=ROUNDUP(B9/B6,1)'],
      hints: ['Divide the EOQ by the carton size first.', '`ROUNDUP(number, 0)` rounds up to the next whole number, even 71.01 becomes 72.'],
      explain: 'ROUNDUP(B9/B6,0) gives 72 cartons. Rounding the kilograms first (ROUNDUP(B9,0)/B6) still leaves a fraction of a carton.',
    },
    {
      id: 'qty',
      kind: 'formula',
      cells: 'B11',
      prompt: 'In B11 work out the order quantity in kg that those cartons hold.',
      solution: '=B10*B6',
      wrong: ['=B9', '=B10*25'],
      hints: ['Cartons x kilograms per carton.', 'Both numbers are already on the sheet: refer to their cells.'],
      explain: 'Use the carton-size cell, not a typed 25: when the supplier changes cartons the quantity follows.',
    },
    {
      id: 'orders',
      kind: 'formula',
      cells: 'B12',
      prompt: 'In B12 work out how many orders a year the order quantity in B11 implies.',
      solution: '=B3/B11',
      wrong: ['=B3/B9', '=B11/B3'],
      hints: ['Annual demand divided by the quantity per order.', 'Use the quantity you actually order (B11), not the theoretical EOQ.'],
      explain: 'Use the quantity actually ordered (B11), not the theoretical EOQ: 36,000 / 1,800 = 20 orders a year.',
    },
    {
      id: 'cost',
      kind: 'formula',
      cells: 'B13',
      prompt: 'In B13 work out the annual ordering + holding cost at the order quantity in B11: orders per year x cost per order, plus average stock (half an order) x holding cost.',
      solution: '=B12*B4+B11/2*B5',
      wrong: ['=B12*B4+B11*B5', '=B3/B9*B4+B9/2*B5', '=(B12*B4+B11)/2*B5'],
      hints: [
        'Two parts: ordering cost and holding cost.',
        'Stock falls from a full order to zero, so the average stock is half an order.',
        'Shape of the formula: =orders per year * cost per order + order quantity/2 * holding cost, using B12, B4, B11 and B5.',
      ],
      explain:
        '20 x $85 + 900 kg x $1.90 = $3,410.00. Precedence works for you here: B11/2*B5 is (B11/2)*B5, left to right. Using the EOQ instead of the carton quantity gives $3,409.99, ' +
        'a cost the company cannot actually achieve.',
    },
    {
      id: 'fits',
      kind: 'formula',
      cells: 'B14',
      prompt: 'In B14 use `IF` to show the text Fits when the order quantity is at most the cold-store space, otherwise Too big.',
      solution: '=IF(B11<=B7,"Fits","Too big")',
      check: { mustUse: ['IF'] },
      wrong: ['=IF(B11>B7,"Fits","Too big")', '=IF(B11<=B7,"Too big","Fits")', '=IF(B11<B7,"Fits","Too big")', '=IF(B9<=B7,"Fits","Too big")'],
      hints: ['The test compares B11 with B7; "at most" is <=.', 'Text results go in double quotes.'],
      explain: 'IF returns one of two texts. With demand at 48,000 kg the order grows to 2,075 kg and the check turns to Too big, which is why it must be a formula.',
    },
    {
      id: 'cases',
      kind: 'formula',
      cells: 'E17:E21',
      prompt:
        'A professional model also shows test cases, extremes included, so a reader can see how it behaves. Each row of the test-case block has its own ' +
        "demand, order cost and holding cost. In E17 compute that row's EOQ and fill down to E21, then compare each row with the base case.",
      solution: '=SQRT(2*B17*C17/D17)',
      wrong: ['=SQRT(2*$B$17*$C$17/$D$17)', '=SQRT(2*B3*B4/B5)', '=$B$9', '=SQRT(2*B17*C17)/D17'],
      hints: [
        'Same EOQ formula as B9, but every input now comes from the test-case row.',
        'Each row uses its own inputs, so this time no reference needs a $.',
        'E17: =SQRT(2 x demand x order cost / holding cost), using B17, C17 and D17.',
      ],
      explain:
        'Four times the demand only doubles the EOQ (1,794.7 to 3,589.5 kg): the EOQ grows with the square root of demand, so a busier year brings more orders ' +
        'as well as bigger ones. Near-free ordering pulls the EOQ down to about 275 kg (order little and often). Near-free storage pushes it to about 11,000 kg, ' +
        'far beyond the 2,000 kg cold store, so the EOQ alone is not a plan and the space check in B14 matters. At a holding cost of exactly 0 the formula ' +
        'would show #DIV/0!, worth a note that it must be above 0. Surfacing behaviour like this is what test cases are for; the base-case row also confirms B9.',
    },
    {
      id: 'flat',
      kind: 'explain',
      cells: '',
      prompt: 'Rounding up to whole cartons moved the order from about 1,794.7 kg to 1,800 kg. How much extra does that cost per year, and why so little?',
      answer:
        'Almost nothing: about 1.5 cents a year ($3,410.00 against $3,409.99 at the exact EOQ). The total-cost curve is flat around the EOQ: a slightly bigger order ' +
        'adds a little holding cost but saves almost the same in ordering cost. So practical rounding to cartons, pallets or delivery days is safe near the optimum, ' +
        'and the inputs do not need to be very precise.',
    },
  ],
  testCases: [
    { name: 'Demand rises to 48,000 kg', inputs: { B3: 48000 } },
    // 70 cartons of 25 kg = exactly 1,750 kg: "at most" (<=) still fits, < does not
    { name: 'Holding cost $2.60 per kg, $110 per order and a 1,750 kg cold store', inputs: { B5: 2.6, B4: 110, B7: 1750 } },
    // the EOQ (1,794.7 kg) would fit, the 52 cartons actually ordered (1,820 kg) do not
    { name: '35 kg cartons and a 1,800 kg cold store', inputs: { B6: 35, B7: 1800 } },
    // one input of every test-case row changes, so no typed EOQ or input survives in E17:E21
    { name: 'Test-case rows revised', inputs: { B17: 40000, C18: 90, D19: 2.4, B20: 30000, D21: 0.08 } },
  ],
  skills: ['formula building', 'SQRT', 'ROUNDUP', 'test-case block', 'IF with text', 'intermediate cells'],
  techniques: ['Written interpretation of model results'],
}

const audit: Exercise = {
  id: 'w1-layout-audit-concert',
  week: 'W1',
  topic: 'Professional layout',
  title: 'Audit a break-even sheet before it is reused',
  level: 2,
  minutes: 12,
  scenario:
    'An intern at a Singapore events company built a quick break-even sheet for a rooftop concert. It gives the right answer today, but two input values are typed ' +
    'inside formulas and nothing is documented. Before the finance manager reuses it for the next concert, find the problems, rebuild the calculations properly ' +
    "and classify the model's variables.",
  sheet: {
    rows: 21,
    cols: 3,
    colWidths: { A: 290, B: 130, C: 130 },
    cells: {
      A1: title('Rooftop concert: break-even'),
      A3: label('Ticket price ($)'), B3: input(68, MONEY),
      A4: label('Ticketing platform fee (share of price)'), B4: input(0.07, PCT),
      A5: label('Variable cost per attendee ($)'), B5: input(9.5, MONEY),
      A6: label('Fixed costs ($)'), B6: input(48600, '$#,##0'),
      B8: header("Intern's version"), C8: header('Your version'),
      A9: label('Contribution per ticket ($)'), B9: calc('=B3*(1-0.07)-B5', MONEY), C9: answer(MONEY),
      A10: label('Break-even tickets'), B10: calc('=B6/B9', '#,##0.0'), C10: answer('General'),
      A11: label('Break-even revenue ($)'), B11: calc('=B10*68', '$#,##0'), C11: answer('$#,##0'),
      A13: label('Cells with an input value typed inside the formula:'),
      A14: label('the upper one'), B14: answer(),
      A15: label('the lower one'), B15: answer(),
      A17: header('Variable'), B17: header('Blackbox role'),
      A18: label('Ticket price (the organiser sets it)'), B18: answer(),
      A19: label('Fixed costs'), B19: answer(),
      A20: label('Contribution per ticket'), B20: answer(),
      A21: label('Break-even tickets'), B21: answer(),
    },
  },
  tasks: [
    {
      id: 'spot',
      kind: 'value',
      cells: 'B14:B15',
      prompt:
        "Click through the intern's formulas in B9:B11. Type the addresses of the two cells that have an input value typed inside the formula, " +
        'as plain text like A1 with no $ signs (the upper one in B14).',
      answer: { B14: 'B9', B15: 'B11' },
      wrong: ['B10', 'B3'],
      hints: ['Look for numbers inside a formula that also appear in the input block.', 'The fee 7% is stored as 0.07; the ticket price is 68.'],
      explain:
        'B9 contains 0.07 (the fee) and B11 contains 68 (the price). Both show the right result today, but change the inputs and these cells silently keep the old values.',
    },
    {
      id: 'contribution',
      kind: 'formula',
      cells: 'C9',
      prompt: 'In C9 rebuild the contribution per ticket using only cell references: the ticket price after the platform fee, less the variable cost.',
      solution: '=B3*(1-B4)-B5',
      wrong: ['=B3*(1-0.07)-B5', '=B3*1-B4-B5', '=B3*(1-B4)'],
      hints: [
        "Start from the intern's B9 and replace the typed number with the input cell that holds it.",
        'Keep the brackets: the fee is a share of the price, so the price is multiplied by (1 - fee).',
      ],
      explain:
        'Same arithmetic as B9, but the fee now comes from B4. Test it: set B4 to 10% and only your version moves. ' +
        'This is the marginal contribution of a ticket: what is left of the price, after the fee and the variable cost, to cover the fixed costs.',
    },
    {
      id: 'tickets',
      kind: 'formula',
      cells: 'C10',
      prompt: 'In C10 work out the break-even number of tickets with `ROUNDUP`: fixed costs divided by your contribution per ticket, rounded up to whole tickets.',
      solution: '=ROUNDUP(B6/C9,0)',
      check: { mustUse: ['ROUNDUP'] },
      wrong: ['=B6/C9', '=ROUNDUP(B6/B3,0)', '=ROUNDUP(B6/B9,1)', '=ROUNDUP(B6/B9,0)'],
      hints: [
        'Each ticket contributes C9 towards the fixed costs, so break-even tickets = fixed costs / contribution per ticket.',
        'You cannot sell 904.35 tickets: round up so the costs are fully covered.',
        'Shape of the formula: =ROUNDUP(fixed costs / your contribution in C9, 0).',
      ],
      explain: '48,600 / 53.74 = 904.35, so 905 tickets break even. Rounding down would leave the concert slightly short.',
    },
    {
      id: 'revenue',
      kind: 'formula',
      cells: 'C11',
      prompt: 'In C11 work out the break-even revenue: your break-even tickets times the ticket price.',
      solution: '=C10*B3',
      wrong: ['=C10*68', '=B10*B3'],
      hints: ["Use your own break-even tickets from C10, not the intern's B10.", 'Refer to the price input, not the number 68.'],
      explain: '905 x $68 = $61,540. With the price in B3 the revenue follows any new price automatically.',
    },
    {
      id: 'blackbox',
      kind: 'value',
      cells: 'B18:B21',
      prompt:
        'Classify each variable in the blackbox view: in each of B18:B21 type exactly one of the words Decision, Parameter, Consequence or Performance ' +
        '(singular, one word per cell).',
      answer: { B18: 'Decision', B19: 'Parameter', B20: 'Consequence', B21: 'Performance' },
      wrong: ['Parameter', 'Performance'],
      hints: [
        'Inputs go in: a decision is chosen by the user, a parameter is given.',
        'Outputs come out: a performance measure is what the user cares about most, a consequence variable is worked out on the way.',
      ],
      explain:
        'The organiser chooses the price (decision); the fixed costs are given (parameter); the contribution is an intermediate result (consequence variable); ' +
        'the break-even number of tickets is the result the organiser judges the plan by (performance measure).',
    },
    {
      id: 'document',
      kind: 'explain',
      cells: '',
      prompt:
        'Write the documentation block for your version in the course format (description, cell, formula or <Input>), and say what a reader should be able to tell from the colours on a professional sheet.',
      answer:
        'Ticket price | B3 | <Input>; Platform fee | B4 | <Input>; Variable cost per attendee | B5 | <Input>; Fixed costs | B6 | <Input>; ' +
        'Contribution per ticket | C9 | =B3*(1-B4)-B5; Break-even tickets | C10 | =ROUNDUP(B6/C9,0); Break-even revenue | C11 | =C10*B3. ' +
        'The colours should tell a reader at a glance which cells are inputs they may change (blue text in the course workbooks), which hold formulas ' +
        'and where the results are. Colour is optional, though: the sheet must still read correctly when printed in black and white, so the labels, the ' +
        'separate input block and the <Input> entries in the documentation have to carry the same message. Document only representative cells, and make ' +
        'the block readable on a printout without row and column headers.',
    },
  ],
  testCases: [
    { name: 'Platform fee rises to 10%', inputs: { B4: 0.1 } },
    { name: 'Ticket price $75 and variable cost $11', inputs: { B3: 75, B5: 11 } },
    { name: 'Fixed costs rise to $52,000', inputs: { B6: 52000 } },
  ],
  skills: ['no hard-coded inputs', 'documentation block', 'colour roles', 'blackbox view', 'break-even', 'ROUNDUP'],
}

// ---------- level 3 exam-style ----------

const fleet: Exercise = {
  id: 'w1-exam-courier-fleet-plan',
  week: 'W1',
  topic: 'Capacity planning with TREND',
  title: 'Exam-style: a four-year fleet plan from productivity ratios',
  level: 3,
  minutes: 30,
  scenario:
    'A same-day parcel courier in Singapore has eight years of history: parcels delivered and the vans, motorbikes and sorting staff it used. ' +
    'It opened a new sorting hub late in 2025 and hired ahead of demand. Volumes for 2026-2029 have been projected, and management wants the plan built on productivity ' +
    '(parcels per unit of each resource) projected with a straight-line trend against volume, not on extrapolating fleet sizes directly. ' +
    'Build each part at the cell addresses given; formulas must fill right and down.',
  sheet: {
    rows: 21,
    cols: 9,
    colWidths: { A: 210, B: 110, C: 90, D: 100, E: 110, F: 20, G: 90, H: 100, I: 110 },
    cells: {
      A1: title('Courier resource plan 2026-2029'),
      C2: header('Resources used / required'), G2: header('Productivity (000 parcels per unit)'),
      A3: header('Year'), B3: header('Parcels (000)'), C3: header('Vans'), D3: header('Motorbikes'), E3: header('Sorting staff'),
      G3: header('Vans'), H3: header('Motorbikes'), I3: header('Sorting staff'),
      ...down('A4', [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029], (v) => given(v, '0')),
      ...down('B4', [2150, 2480, 3410, 3920, 4050, 4390, 4760, 5120, 5500, 5880, 6250, 6600], (v) => input(v, '#,##0')),
      ...down('C4', [31, 34, 43, 47, 47, 49, 51, 53], (v) => input(v, '#,##0')),
      ...down('D4', [58, 66, 92, 101, 99, 104, 110, 115], (v) => input(v, '#,##0')),
      ...down('E4', [44, 49, 62, 66, 66, 68, 70, 84], (v) => input(v, '#,##0')),
      ...block('C12:E15', answer('General')),
      ...block('G4:I15', answer('0.00')),
      A17: label('Cost of adding one unit ($)'), C17: input(68000, '$#,##0'), D17: input(9500, '$#,##0'), E17: input(4200, '$#,##0'),
      A18: label('Units to add in 2026'), ...block('C18:E18', answer('General')),
      A19: label('Cost of the 2026 additions ($)'), C19: answer('$#,##0'),
      A21: label('Direct fit: units needed in 2029'), ...block('C21:E21', answer('General')),
    },
  },
  tasks: [
    {
      id: 'productivity',
      kind: 'formula',
      cells: 'G4:I11',
      marks: 2,
      prompt: '(a) In G4 compute the 2018 productivity of vans: thousand parcels per van. Write it so that it fills right to I4 and down to row 11.',
      solution: '=$B4/C4',
      check: { absolute: ['$B4'] },
      wrong: ['=B4/C4', '=$B$4/C4', '=C4/$B4'],
      hints: [
        'Productivity = business volume / number of units.',
        'Filling right must keep dividing the parcels column; filling down must move to the next year.',
        'Shape of the formula: =parcels / vans of the same year, with a $ only in front of the parcels column letter.',
      ],
      explain:
        '$B4 locks the parcels column but lets the year move, while C4 moves to each resource and year, so one formula covers the 3 x 8 block. ' +
        '2018 vans: 2,150 / 31 = 69.35 thousand parcels per van.',
    },
    {
      id: 'trend',
      kind: 'formula',
      cells: 'G12:I15',
      marks: 3,
      prompt:
        '(b) In G12 project the 2026 van productivity with `TREND` against parcel volume (known_y: the van productivity history, known_x: B4:B11, new_x: B12). ' +
        'It must fill right to I12 and down to row 15.',
      solution: '=TREND(G$4:G$11,$B$4:$B$11,$B12)',
      check: { mustUse: ['TREND'], absolute: ['G$4', '$B$4', '$B12'] },
      wrong: ['=TREND(G4:G11,B4:B11,B12)', '=TREND($G$4:$G$11,$B$4:$B$11,$B12)', '=TREND(G$4:G$11,$A$4:$A$11,$A12)'],
      hints: [
        'known_y is the productivity history of the resource, known_x the parcel history, new_x the projected parcels of the year.',
        'Filling right: known_y moves to the next resource, known_x and new_x stay in column B. Filling down: nothing in the history may slide.',
        'Pattern: =TREND(G4:G11, B4:B11, B12) plus seven $ signs: the rows of known_y, all four parts of known_x, the column of new_x.',
      ],
      explain:
        "G$4:G$11 (rows locked), $B$4:$B$11 (fully locked) and $B12 (column locked): the course's seven $ signs. The ratio is projected against volume, so the plan assumes productivity " +
        'keeps improving as the business grows. A time-based TREND on the years (column A) is a different model and gives different ratios.',
    },
    {
      id: 'required',
      kind: 'formula',
      cells: 'C12:E15',
      marks: 2,
      prompt: '(c) In C12 compute the vans required in 2026 with `ROUNDUP`: projected parcels / projected productivity, rounded up to whole units. Fill right to E12 and down to row 15.',
      solution: '=ROUNDUP($B12/G12,0)',
      check: { mustUse: ['ROUNDUP'], absolute: ['$B12'] },
      wrong: ['=$B12/G12', '=ROUNDUP(B12/G12,0)', '=ROUNDUP($B12*G12,0)'],
      hints: ['Required units = volume / volume handled per unit.', 'Part units do not exist, so round up; the parcels column is locked as in (a).'],
      explain: '2026 vans: 5,500 / 99.41 = 55.3, so 56 vans. ROUNDUP guarantees enough capacity; ROUND could leave the plan one van short.',
    },
    {
      id: 'additions',
      kind: 'formula',
      cells: 'C18:E18',
      marks: 1.5,
      prompt: '(d) In C18 compute how many vans must be added in 2026: the 2026 requirement minus the 2025 holding, but never below zero. Use `MAX` and fill right to E18.',
      solution: '=MAX(0,C12-C11)',
      check: { mustUse: ['MAX'] },
      wrong: ['=C12-C11', '=MAX(0,C12-$C$11)', '=MAX(0,C15-C11)'],
      hints: ['If the requirement is below what you already have, you add nothing.', '`MAX(0, x)` returns x when it is positive and 0 otherwise.'],
      explain: 'MAX(0, required - held) floors the additions at zero. After hiring for the new hub the courier already has more sorting staff than 2026 needs (84 held, 81 required), so nobody is hired.',
    },
    {
      id: 'cost',
      kind: 'formula',
      cells: 'C19',
      marks: 1.5,
      prompt: '(e) In C19 use `SUMPRODUCT` for the total cost of the 2026 additions (unit costs in C17:E17).',
      solution: '=SUMPRODUCT(C17:E17,C18:E18)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(C17:E17,C12:E12)', '=SUM(C18:E18)*C17'],
      hints: ['Cost = units added x cost per unit, for each resource, then add the three.', 'The two rows C17:E17 and C18:E18 line up item by item.'],
      explain: '3 vans x $68,000 + 9 motorbikes x $9,500 + 0 staff = $289,500. SUMPRODUCT pairs the two rows item by item.',
    },
    {
      id: 'direct',
      kind: 'formula',
      cells: 'C21:E21',
      marks: 1,
      prompt:
        '(f) For comparison, fit the number of units directly against parcels: in C21 forecast the vans needed in 2029 from the van counts in C4:C11 and the parcels in B4:B11 ' +
        '(`TREND` or `FORECAST.LINEAR`), rounded up with `ROUNDUP`. Fill right to E21.',
      solution: '=ROUNDUP(FORECAST.LINEAR($B15,C$4:C$11,$B$4:$B$11),0)',
      check: { mustUse: ['ROUNDUP'] },
      wrong: ['=ROUNDUP(FORECAST.LINEAR(B15,C4:C11,B4:B11),0)', '=ROUNDUP(FORECAST.LINEAR($B15,$B$4:$B$11,C$4:C$11),0)', '=ROUNDUP(FORECAST.LINEAR($B12,C$4:C$11,$B$4:$B$11),0)'],
      hints: [
        '`FORECAST.LINEAR(x, known_y, known_x)` puts the new x first; `TREND(known_y, known_x, new_x)` puts it last.',
        'The y-values are now the unit counts themselves; the 2029 parcels are in B15.',
      ],
      explain:
        'The direct fit says 66 vans, 148 motorbikes and 97 staff in 2029, against 61, 140 and 89 from the productivity plan in C15:E15. ' +
        'FORECAST.LINEAR(x, known_y, known_x) gives the same number as TREND(known_y, known_x, x).',
    },
    {
      id: 'compare',
      kind: 'explain',
      cells: '',
      marks: 2,
      prompt: '(g) Compare the 2029 plans in C15:E15 and C21:E21. What does each method assume about productivity, and which would you present to management, with what caveats?',
      answer:
        'The productivity method projects how many parcels each van, motorbike or sorter handles, lets that ratio keep rising in a straight line with volume, and divides ' +
        'the projected volume by it. The direct fit treats the unit count itself as a straight line in volume: every extra thousand parcels needs the same number of ' +
        'extra units as in the past, so productivity only creeps towards that historical rate instead of improving at its recent pace, and the 2025 hiring for the new hub ' +
        'pulls the staff line up. That is why the direct fit asks for more of everything. I would present the productivity plan, with the projected ratios as targets ' +
        'to negotiate: a straight-line ratio keeps rising for ever while real productivity gains level off, and neither model covers lead times, spare capacity or shifts.',
    },
  ],
  testCases: [
    { name: 'Projected volumes revised up and vans cost $72,000', inputs: { B12: 5650, B13: 6080, B14: 6500, B15: 6900, C17: 72000 } },
    { name: '2025 counts corrected (contract staff excluded)', inputs: { C11: 55, D11: 118, E11: 72 } },
    { name: 'Parcel history restated', inputs: { B4: 2100, B5: 2430, B6: 3350, B7: 3860, B8: 3990, B9: 4320, B10: 4690, B11: 5050 } },
    // every 2018-2024 count moves (vans +1, motorbikes +2, staff -1), so no typed count survives in (a)
    {
      name: 'Vehicle and staff counts for 2018-2024 restated',
      inputs: {
        C4: 32, C5: 35, C6: 44, C7: 48, C8: 48, C9: 50, C10: 52,
        D4: 60, D5: 68, D6: 94, D7: 103, D8: 101, D9: 106, D10: 112,
        E4: 43, E5: 48, E6: 61, E7: 65, E8: 65, E9: 67, E10: 69,
      },
    },
  ],
  skills: ['performance ratios', 'TREND with seven $ signs', 'ROUNDUP', 'MAX floor at zero', 'SUMPRODUCT', 'FORECAST.LINEAR', 'interpretation'],
  techniques: [
    'Linear trend forecasting (TREND / trendline)',
    'Absolute/mixed references so formulas fill down/right',
    'SUMPRODUCT totals and weighted/expected values',
    'Capacity and flow-balance logic with MIN/MAX',
    'Written interpretation of model results',
  ],
}

const JOBS = ['M-201', 'M-202', 'M-203', 'M-204', 'M-205', 'M-206', 'M-207', 'M-208']

const movers: Exercise = {
  id: 'w1-exam-movers-truck-choice',
  week: 'W1',
  topic: 'Exam-style model',
  title: 'Exam-style: pricing house moves with the cheaper truck',
  level: 3,
  minutes: 25,
  scenario:
    'A Singapore removal company prices HDB and condo moves. Each job needs enough truck trips to carry its volume, using small or large trucks, ' +
    'whichever costs less, plus movers paid by the hour; every quote has a minimum charge before GST. ' +
    'Build the quotation model for eight jobs at the cell addresses given, with formulas that fill right and down.',
  sheet: {
    rows: 21,
    cols: 11,
    colWidths: { A: 230, B: 90, C: 80, D: 80, E: 90, F: 90, G: 90, H: 90, I: 90, J: 90, K: 120 },
    cells: {
      A1: title('Removal quotations'),
      A3: header('Truck'), C3: header('Small'), D3: header('Large'),
      A4: label('Capacity per trip (m³)'), C4: input(18, '0'), D4: input(30, '0'),
      A5: label('Charge per trip ($)'), C5: input(220, '$#,##0'), D5: input(340, '$#,##0'),
      A6: label('Mover rate ($ per mover-hour)'), C6: input(28, MONEY),
      A7: label('Minimum charge before GST ($)'), C7: input(450, '$#,##0'),
      A8: label('GST'), C8: input(0.09, PCT),
      A10: header('Job'), B10: header('Volume (m³)'), C10: header('Movers'), D10: header('Hours'), E10: header('Small trips'), F10: header('Large trips'),
      G10: header('Small cost'), H10: header('Large cost'), I10: header('Truck cost'), J10: header('Mover cost'), K10: header('Quote incl. GST'),
      ...down('A11', JOBS, (v) => label(String(v))),
      ...down('B11', [12, 25, 34, 17, 41, 8, 29, 52], (v) => input(v, '0')),
      ...down('C11', [2, 3, 4, 2, 4, 2, 3, 5], (v) => input(v, '0')),
      ...down('D11', [3, 5, 6.5, 4, 7, 2.5, 5.5, 8], (v) => input(v, '0.0')),
      ...block('E11:F18', answer('General')),
      ...block('G11:J18', answer('$#,##0')),
      ...block('K11:K18', answer(MONEY)),
      A20: label('Total of all quotes'), K20: answer(MONEY),
      A21: label('Jobs where the large truck is cheaper'), K21: answer('General'),
    },
  },
  tasks: [
    {
      id: 'trips',
      kind: 'formula',
      cells: 'E11:F18',
      marks: 2,
      prompt: '(a) In E11 use `ROUNDUP` for the small-truck trips job M-201 needs (volume / capacity per trip, in whole trips). Fill right to F11 for large trucks and down to row 18.',
      solution: '=ROUNDUP($B11/C$4,0)',
      check: { mustUse: ['ROUNDUP'], absolute: ['$B11', 'C$4'] },
      wrong: ['=ROUNDUP(B11/C4,0)', '=ROUNDUP($B11/$C$4,0)', '=$B11/C$4'],
      hints: [
        'A part-full truck still makes a trip, so round the number of trips up.',
        'Filling right must switch from the small to the large capacity (C4 to D4) but keep the job volume in column B.',
      ],
      explain:
        '$B11 keeps the volume column and C$4 keeps the capacity row, so E11:F18 is one formula. M-202 (25 m³) needs 2 small trips (25/18 = 1.4) but only 1 large trip.',
    },
    {
      id: 'costs',
      kind: 'formula',
      cells: 'G11:H18',
      marks: 1.5,
      prompt: '(b) In G11 compute the small-truck cost of M-201: trips x charge per trip. Fill right to H11 and down to row 18.',
      solution: '=E11*C$5',
      check: { absolute: ['C$5'] },
      wrong: ['=E11*C5', '=E11*$C$5', '=E11*$C5'],
      hints: ['The trip counts sit two columns to the left, in the same order as the charges in C5:D5.', 'Lock only the row of the charge.'],
      explain: 'Filled right, E11*C$5 becomes F11*D$5: large trips times the large charge. With $C$5 the large trucks would be priced at the small rate.',
    },
    {
      id: 'cheaper',
      kind: 'formula',
      cells: 'I11:I18',
      marks: 1.5,
      prompt: '(c) In I11 use `MIN` to pick the cheaper truck cost for each job and fill down to I18.',
      solution: '=MIN(G11:H11)',
      check: { mustUse: ['MIN'] },
      wrong: ['=MAX(G11:H11)', '=MIN(G11:G18)'],
      hints: ['The two options for a job sit side by side in G and H.', 'Compare within the row, not down the column.'],
      explain: 'MIN of the two options is the cheaper plan for each job. The large truck wins only for M-202 and M-207, where one large trip replaces two small ones.',
    },
    {
      id: 'labour',
      kind: 'formula',
      cells: 'J11:J18',
      marks: 1,
      prompt: '(d) In J11 compute the mover cost: movers x hours x the rate in C6. Fill down to J18.',
      solution: '=C11*D11*$C$6',
      wrong: ['=C11*D11*C6', '=C11+D11*$C$6'],
      hints: ['Mover-hours = movers x hours.', 'The rate in C6 is shared by every job: anchor it before filling down.'],
      explain: 'Every job uses the one rate cell; without its $ the copies would read C7, C8 and so on.',
    },
    {
      id: 'quote',
      kind: 'formula',
      cells: 'K11:K18',
      marks: 2.5,
      prompt:
        '(e) In K11 compute the quote incl. GST: truck cost + mover cost, but at least the minimum charge in C7, then GST on top. Fill down to K18.',
      solution: '=MAX($C$7,I11+J11)*(1+$C$8)',
      wrong: ['=(I11+J11)*(1+$C$8)', '=MAX($C$7,I11+J11)*$C$8', '=MIN($C$7,I11+J11)*(1+$C$8)', '=MAX($C$7,I11+J11*(1+$C$8))'],
      hints: [
        'A minimum charge is a floor: the larger of the minimum and the actual cost.',
        '`MAX` (or an `IF`) applies the floor; then multiply by (1 + GST).',
      ],
      explain:
        'MAX($C$7, cost) never lets a quote fall below $450 before GST: M-201, M-204 and M-206 are small jobs and pay the minimum, $490.50 with GST. ' +
        '=IF(I11+J11<$C$7,$C$7,I11+J11)*(1+$C$8) is equivalent.',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'K20',
      marks: 0.5,
      prompt: '(f) In K20 total all eight quotes.',
      solution: '=SUM(K11:K18)',
      wrong: ['=SUM(K11:K17)', '=SUM(I11:J18)'],
      hints: ['`SUM` over the quote column.', 'Eight jobs: rows 11 to 18.'],
      explain: 'The eight quotes add up to $7,961.36.',
    },
    {
      id: 'count',
      kind: 'value',
      cells: 'K21',
      marks: 1,
      prompt: '(g) Read your model: for how many of the eight jobs is the large truck strictly cheaper than the small one? Type the number in K21.',
      answer: 2,
      wrong: ['3', '0'],
      hints: ['Compare columns G and H row by row.', 'Strictly cheaper: equal costs do not count.'],
      explain: 'Two jobs: M-202 (25 m³) and M-207 (29 m³). Each fits in one large trip but needs two small ones; for the other six jobs the small truck is cheaper.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      marks: 2,
      prompt:
        '(h) The operations manager wants to sell the small trucks because large trucks carry more. Using your results, explain why the cheaper truck depends on the job volume, ' +
        'and what the minimum charge does to small jobs.',
      answer:
        'Trips come in whole numbers, so truck cost jumps each time the volume passes a multiple of a capacity. A large trip costs $340 against $220 for a small one, ' +
        'so the large truck is cheaper only when it saves enough small trips to cover its higher charge. Among these jobs that happens between 18 and 30 m³, ' +
        'where one large trip replaces two small ones (M-202 and M-207); it would happen again just above 54 m³ (four small trips, $880, against two large, $680). ' +
        'Jobs that fit in one small truck, jobs that need two trips either way (34 m³) and jobs where the large truck saves only one trip in three ' +
        '(41 m³ and 52 m³: $660 small against $680 large) are cheaper with small trucks, so selling them would raise six of the eight quotes. ' +
        'The minimum charge is a floor of $450 before GST: the three small jobs cost less than that with a small truck, so they pay the minimum and part of the ' +
        "small truck's saving is not passed on. With only large trucks their costs ($480 to $564) would be above the floor, so their quotes would rise too.",
    },
  ],
  testCases: [
    { name: 'Large-truck partner switches to 24 m³ trucks at $300 a trip', inputs: { D4: 24, D5: 300 } },
    { name: 'Small trucks: 15 m³ for $200 a trip; movers $32 an hour', inputs: { C4: 15, C5: 200, C6: 32 } },
    { name: 'Minimum charge $500 and GST 10%', inputs: { C7: 500, C8: 0.1 } },
    // every job's volume, crew and hours move, and each volume crosses a trip boundary for one of the trucks
    {
      name: 'Site surveys revise every job: new volumes, one more mover and half an hour longer',
      inputs: {
        B11: 20, B12: 32, B13: 38, B14: 21, B15: 35, B16: 19, B17: 31, B18: 56,
        C11: 3, C12: 4, C13: 5, C14: 3, C15: 5, C16: 3, C17: 4, C18: 6,
        D11: 3.5, D12: 5.5, D13: 7, D14: 4.5, D15: 7.5, D16: 3, D17: 6, D18: 8.5,
      },
    },
  ],
  skills: ['ROUNDUP trips', 'MIN for the cheaper option', 'MAX as a minimum charge', 'mixed references', 'interpretation'],
  techniques: [
    'ROUNDUP block counts and MIN for the cheaper option',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

export const exercises: readonly Exercise[] = [precedence, ringgit, markup, autofill, cargo, florist, coldRoom, eoq, audit, fleet, movers]
