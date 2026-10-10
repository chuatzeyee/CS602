import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 2 spreadsheet engineering: black-box and influence-diagram thinking, linear and quadratic price-demand
// functions, revenue/cost/profit models (bait-and-hook IF guard, expected values with a default probability, shares of
// a total), what-if edits, Goal Seek break-evens, Solver (GRG) on a one-decision profit model, and trade-off /
// sensitivity analysis with one- and two-way Data Tables. Scenarios and numbers are original.
// Week 2 teaches no new worksheet functions, so references stay within the week 1 set (SUM, MIN, MAX, IF, SUMPRODUCT, TREND).

type Cells = Record<string, CellSpec>

const MONEY = '$#,##0.00'
const MONEY0 = '$#,##0'
const INT = '#,##0'
const PCT = '0.0%'

const title = (v: string): CellSpec => ({ v, role: 'label', bold: true })
const label = (v: string): CellSpec => ({ v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const note = (v: string): CellSpec => ({ v, role: 'note' })
const input = (v: number, fmt?: string, tip?: string): CellSpec => ({ v, role: 'input', ...(fmt ? { fmt } : {}), ...(tip ? { note: tip } : {}) })
const given = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'given', ...(fmt ? { fmt } : {}) })
const axis = (v: number, fmt: string): CellSpec => ({ v, role: 'given', fmt, bold: true })
const calc = (f: string, fmt?: string): CellSpec => ({ f, role: 'given', ...(fmt ? { fmt } : {}) })
const ans = (fmt?: string): CellSpec => ({ role: 'answer', ...(fmt ? { fmt } : {}) })

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const letters = (from: string, to: string): string[] => LETTERS.slice(LETTERS.indexOf(from), LETTERS.indexOf(to) + 1).split('')

// specs placed left to right from column `from` in `row`, or top to bottom from `row` in column `col`
const across = (row: number, from: string, specs: CellSpec[]): Cells =>
  Object.fromEntries(specs.map((s, i) => [`${LETTERS[LETTERS.indexOf(from) + i]}${row}`, s]))
const down = (col: string, row: number, specs: CellSpec[]): Cells =>
  Object.fromEntries(specs.map((s, i) => [`${col}${row + i}`, s]))

// the same spec in every cell of a block
function block(from: string, to: string, row1: number, row2: number, spec: CellSpec): Cells {
  const out: Cells = {}
  for (let r = row1; r <= row2; r++) for (const c of letters(from, to)) out[`${c}${r}`] = { ...spec }
  return out
}

// per-cell reference formulas: one pattern per row, written for every column from `from` to `to`
function perColumn(from: string, to: string, rows: Record<number, (c: string) => string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [row, f] of Object.entries(rows)) for (const c of letters(from, to)) out[`${c}${row}`] = f(c)
  return out
}

// ---------- level 1: drills ----------

const ARROWS: readonly [string, string, string][] = [
  ['Selling price', 'Demand', 'Y'],
  ['Selling price', 'Revenue', 'Y'],
  ['Croissants baked', 'Croissants sold', 'Y'],
  ['Demand', 'Total cost', 'N'],
  ['Croissants baked', 'Total cost', 'Y'],
  ['Demand slope', 'Revenue', 'N'],
  ['Croissants sold', 'Daily profit', 'N'],
  ['Revenue', 'Daily profit', 'Y'],
  ['Stall rent', 'Croissants sold', 'N'],
]

const croissantStall: Exercise = {
  id: 'w2-blackbox-croissant-stall',
  week: 'W2',
  topic: 'Black box and influence diagram',
  title: 'Sort a bakery stall model into its black box',
  level: 1,
  minutes: 8,
  scenario:
    'Mei runs a kaya-croissant stall at a Tiong Bahru market. Each morning she decides the selling price and how many croissants to bake. ' +
    'The ingredient cost, the daily stall rent and the way demand falls as the price rises come from her supplier, her landlord and her past sales. ' +
    'Croissants left at closing are given away, and Mei judges every plan by one number: her daily profit.',
  sheet: {
    name: 'Stall',
    rows: 27,
    cols: 4,
    colWidths: { A: 200, B: 150, C: 140, D: 110 },
    cells: {
      A1: title('Kaya croissant stall: one trading day'),
      A2: note('Codes: D decision, P parameter, C consequence variable, M performance measure'),
      ...across(4, 'A', [header('Variable'), header('Value'), header('Unit'), header('Class')]),
      ...across(5, 'A', [label('Selling price'), input(4.2, MONEY), label('$ per croissant'), ans()]),
      ...across(6, 'A', [label('Croissants baked'), input(260, INT), label('croissants'), ans()]),
      ...across(7, 'A', [label('Ingredient cost'), input(1.1, MONEY), label('$ per croissant'), ans()]),
      ...across(8, 'A', [label('Stall rent'), input(180, MONEY), label('$ per day'), ans()]),
      ...across(9, 'A', [label('Demand at a $0 price'), input(520, INT), label('croissants'), ans()]),
      ...across(10, 'A', [label('Demand slope'), input(-60, INT), label('croissants per $1'), ans()]),
      ...across(11, 'A', [label('Demand'), calc('=B9+B10*B5', INT), label('croissants'), ans()]),
      ...across(12, 'A', [label('Croissants sold'), calc('=MIN(B11,B6)', INT), label('croissants'), ans()]),
      ...across(13, 'A', [label('Revenue'), calc('=B5*B12', MONEY), label('$'), ans()]),
      ...across(14, 'A', [label('Total cost'), calc('=B7*B6+B8', MONEY), label('$'), ans()]),
      ...across(15, 'A', [label('Daily profit'), calc('=B13-B14', MONEY), label('$'), ans()]),
      A17: title('Influence diagram: does the arrow belong?'),
      A18: header('From'),
      B18: header('To'),
      D18: header('Arrow? Y/N'),
      ...Object.assign({}, ...ARROWS.map(([from, to], i) => across(19 + i, 'A', [label(from), label(to)]))),
      ...block('D', 'D', 19, 27, ans()),
    },
  },
  tasks: [
    {
      id: 'classify',
      kind: 'value',
      cells: 'D5:D15',
      prompt:
        "Classify every variable of Mei's model: in D5:D15 type D (decision: an input Mei chooses), P (parameter: an input with a given value that she " +
        'cannot control), C (consequence variable: an output calculated along the way) or M (performance measure: the output of key interest to her). ' +
        'Blue cells are inputs; grey cells hold formulas you can click to read.',
      answer: { D5: 'D', D6: 'D', D7: 'P', D8: 'P', D9: 'P', D10: 'P', D11: 'C', D12: 'C', D13: 'C', D14: 'C', D15: 'M' },
      hints: [
        'Inputs (blue) are D or P: D when Mei chooses the value herself, P when it is handed to her.',
        'Outputs (grey formulas) are C or M: the performance measure is the output Mei judges a plan by; every other output is a consequence variable.',
        'Exactly two inputs are decisions and exactly one output is the performance measure.',
      ],
      explain:
        'Mei controls the selling price and the batch size, so those are the decisions. Ingredient cost, rent and the two numbers of the demand line are given to her ' +
        '(parameters, the uncontrollable inputs): she cannot choose them, only test them in sensitivity analysis. Every formula is an output; ' +
        'daily profit is the performance measure because it is the number she judges plans by, while demand, croissants sold, revenue and total cost are ' +
        'consequence variables, the intermediate variables computed on the way. The class of an output ' +
        "depends on the decision maker's goal, not on the formula: if Mei also judged plans by leftover croissants (baked minus sold), that output would become " +
        "a second performance measure. The course's suggested colour scheme makes the black box visible on the sheet: decisions in blue, parameters in " +
        'violet, outputs in black with the key ones shaded yellow, brightest for the performance measure (this lab shows every input in blue).',
      wrong: ['P', 'C'],
    },
    {
      id: 'arrows',
      kind: 'value',
      cells: 'D19:D27',
      prompt:
        'An influence diagram has an arrow from X to Y only when X is used directly in the calculation of Y. For each pair in rows 19-27 type Y if the arrow ' +
        "belongs in Mei's influence diagram, or N if it does not (no link at all, or a link only through another variable).",
      answer: Object.fromEntries(ARROWS.map(([, , yn], i) => [`D${19 + i}`, yn])),
      hints: [
        'Click an output in B11:B15: the cells its formula uses are exactly the variables with an arrow into it.',
        'Total cost is ingredient cost x croissants baked + rent: demand is not in that formula.',
        'Croissants sold reaches the profit only through revenue, so the diagram shows sold → revenue → profit, not sold → profit.',
      ],
      explain:
        "Mei's diagram: price, demand at $0 and slope → demand; demand and croissants baked → croissants sold; price and croissants sold → revenue; " +
        'ingredient cost, croissants baked and rent → total cost; revenue and total cost → daily profit. Arrows show direct influence only, which is why the diagram ' +
        "maps one-to-one onto the formulas (Excel's Trace Precedents draws the same arrows). Building it from the performance measure downwards " +
        '(profit → revenue and cost → ... → inputs) guarantees that every input really reaches the output.',
      wrong: ['N', 'No'],
    },
    {
      id: 'analysis',
      kind: 'explain',
      cells: '',
      prompt:
        'Mei asks two questions: "Which price should I charge?" and "What if my demand slope is wrong?". Say which question calls for trade-off analysis and ' +
        'which for sensitivity analysis, and which cells you would change for each.',
      answer:
        '"Which price?" is trade-off analysis: change the decisions (the selling price in B5, and the batch size in B6) and watch revenue, total cost and profit ' +
        'move against each other. "What if the slope is wrong?" is sensitivity analysis: change the uncontrollable parameter (the demand slope in B10, and likewise ' +
        'B7:B9) and see how much the daily profit moves. Decisions are varied to choose a plan; parameters are varied to test how robust that plan is.',
      hints: ['Trade-off analysis varies something Mei controls; sensitivity analysis varies something she does not.', 'Look back at your D and P codes.'],
      explain:
        'The black-box classes tell you what to vary: decisions in trade-off analysis, parameters in sensitivity analysis. A Data Table can run either kind: ' +
        'prices down a column for a trade-off, or slopes across a row for sensitivity.',
    },
  ],
  // no exam technique: the drill classifies variables and arrows; no input is changed and no model result is read
  skills: ['black-box model', 'decisions vs parameters', 'performance measure vs consequence variables', 'influence diagram', 'trade-off vs sensitivity analysis'],
}

const bakingClass: Exercise = {
  id: 'w2-linear-demand-baking-class',
  week: 'W2',
  topic: 'Linear price-demand function',
  title: 'Turn "every $5 rise loses 12 seats" into a demand line',
  level: 1,
  minutes: 5,
  scenario:
    'A Katong cooking studio sells seats in its weekend baking class. Its sign-up records show 180 seats sold a month at a fee of $40, and every $5 added ' +
    'to the fee loses 12 seats (every $5 off wins 12). The owner wants the straight-line price-demand function in intercept-and-slope form, a demand table ' +
    'for fees from $20 to $100, and the fee at which nobody would sign up.',
  sheet: {
    name: 'Demand',
    rows: 21,
    cols: 3,
    colWidths: { A: 250, B: 130, C: 80 },
    cells: {
      A1: title('Weekend baking class: price-demand line'),
      A3: label('Known fee ($)'),
      B3: input(40, MONEY),
      A4: label('Seats sold a month at that fee'),
      B4: input(180, INT),
      A5: label('Seats lost for each fee step'),
      B5: input(12, INT),
      A6: label('Fee step ($)'),
      B6: input(5, MONEY),
      A8: label('Slope (seats per $1 of fee)'),
      B8: ans('0.00'),
      A9: label('Intercept (seats at a $0 fee)'),
      B9: ans('#,##0.0'),
      A10: label('Fee at which demand reaches 0 ($)'),
      B10: ans(MONEY),
      A12: header('Fee ($)'),
      B12: header('Seats demanded'),
      ...down('A', 13, [20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => axis(v, MONEY))),
      ...block('B', 'B', 13, 21, ans('#,##0.0')),
    },
  },
  tasks: [
    {
      id: 'line',
      kind: 'formula',
      cells: 'B8:B9',
      prompt: 'From the inputs in B3:B6, compute the slope of the demand line in B8 (seats per $1 of fee) and its intercept in B9 (seats at a $0 fee).',
      solutions: { B8: '=-B5/B6', B9: '=B4-B8*B3' },
      hints: [
        'The slope is the change in seats for each $1 of fee: the seats lost per step spread over the step size, negative because demand falls as the fee rises.',
        'The intercept is the demand at a $0 fee: start from the known point and take away the effect of its $40 fee (intercept + slope x 40 must give back 180).',
        'Slope = -(seats lost per step) / step size; intercept = known seats - slope x known fee.',
      ],
      explain:
        'A straight line is fixed by one point and its slope: slope = -12/5 = -2.4 seats per $1 and intercept = 180 - (-2.4 x 40) = 276 seats, so ' +
        'demand = 276 - 2.4 x fee. The step form =180-12*(fee-40)/5 gives the same numbers. Keeping intercept and slope in their own cells lets a later ' +
        'sensitivity analysis vary them. Gotcha: drop the minus sign and the line rises with the fee.',
      wrong: ['=B5/B6', '=-B6/B5', '=-12/5'],
    },
    {
      id: 'table',
      kind: 'formula',
      cells: 'B13:B21',
      prompt: 'In B13 write one formula for the seats demanded at the fee in A13, using the intercept and slope cells, and fill it down to B21.',
      solution: '=$B$9+$B$8*A13',
      hints: [
        'Demand = intercept + slope x fee.',
        'Filling down must move the fee to the next row but keep the intercept and slope in B9 and B8: press F4 on those two references.',
      ],
      explain:
        '=$B$9+$B$8*A13: 228 seats at $20, falling by 24 seats for every $10, down to 36 at $100. Without the $ signs the copy in B14 would read B10 and B9 ' +
        'instead. Using the 180 known-point seats (B4) as the intercept is a common slip: the line passes through 180 at $40, not at $0.',
      wrong: ['=B9+B8*A13', '=$B$9-$B$8*A13', '=$B$4+$B$8*A13', '=$B$9+$B$8*$A$13'],
    },
    {
      id: 'zero-fee',
      kind: 'formula',
      cells: 'B10',
      prompt: 'In B10 find the fee at which the demand line reaches 0 seats.',
      solution: '=-B9/B8',
      hints: [
        'Set intercept + slope x fee = 0 and solve for the fee.',
        'The slope is negative, so the fee must come out positive.',
        'Fee = -intercept / slope, with the intercept in B9 and the slope in B8.',
      ],
      explain:
        '0 = 276 - 2.4 x fee gives a fee of 276 / 2.4 = $115. Above it the line forecasts negative seats, so keep the analysis below this fee or cap the ' +
        'demand at zero.',
      wrong: ['=B9/B8', '=-B4/B8'],
    },
  ],
  testCases: [
    // both cases move every demand cell (a case that keeps the 180-seats-at-$40 point would leave B15 unchanged)
    { name: '200 seats sell at $40 and each $5 rise loses 10', inputs: { B4: 200, B5: 10 } },
    { name: 'Known point: 160 seats at $50, in $4 steps', inputs: { B3: 50, B4: 160, B6: 4 } },
  ],
  skills: ['linear price-demand function', 'slope and intercept from one point', 'absolute references', 'fill down'],
  techniques: ['Absolute/mixed references so formulas fill down/right'],
}

const teaGrid: Exercise = {
  id: 'w2-profit-grid-mixed-refs',
  week: 'W2',
  topic: 'Mixed references in a two-way grid',
  title: 'One formula for a whole price x volume profit grid',
  level: 1,
  minutes: 5,
  scenario:
    'A Clementi bubble-tea kiosk is choosing its cup price. Before it knows how volume reacts to price, the owner wants a grid of weekly profit for cup ' +
    'prices from $3.40 to $4.60 (down column B) and weekly volumes from 1,800 to 3,000 cups (across row 5). Each cup costs $1.35 in ingredients, and rent ' +
    'plus wages come to $3,900 a week.',
  sheet: {
    name: 'Grid',
    rows: 15,
    cols: 7,
    colWidths: { A: 210, B: 90, C: 90, D: 90, E: 90, F: 90, G: 90 },
    cells: {
      A1: title('Bubble-tea kiosk: weekly profit grid'),
      A2: label('Ingredient cost per cup ($)'),
      B2: input(1.35, MONEY),
      A3: label('Rent and wages per week ($)'),
      B3: input(3900, MONEY0),
      C4: label('Cups sold per week →'),
      A5: label('Weekly profit ($)'),
      B5: header('Price ($)'),
      ...across(5, 'C', [1800, 2100, 2400, 2700, 3000].map((v) => axis(v, INT))),
      ...down('B', 6, [3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6].map((v) => axis(v, MONEY))),
      ...block('C', 'G', 6, 12, ans(MONEY0)),
      A14: label('Best profit in the grid ($)'),
      B14: ans(MONEY0),
      A15: label('Worst profit in the grid ($)'),
      B15: ans(MONEY0),
    },
  },
  tasks: [
    {
      id: 'grid',
      kind: 'formula',
      cells: 'C6:G12',
      prompt: 'In C6 write ONE formula for the weekly profit at the price in column B and the volume in row 5, that fills down and right to complete C6:G12.',
      solution: '=C$5*($B6-$B$2)-$B$3',
      check: { absolute: ['C$5', '$B6', '$B$2', '$B$3'] },
      hints: [
        'Profit = cups x (price - ingredient cost) - rent and wages.',
        'Filling right must keep reading the prices in column B; filling down must keep reading the volumes in row 5. Lock the column of one and the row of the other.',
        'The two cost cells never move: they need both $ signs.',
      ],
      explain:
        '=C$5*($B6-$B$2)-$B$3 works in every cell: C$5 locks the row, so every copy reads a volume from row 5 while the column moves; $B6 locks the column, so ' +
        'every copy reads a price from column B while the row moves; $B$2 and $B$3 never move. F4 cycles a reference through $B$2, B$2, $B2 and B2. ' +
        'Reading the grid: down a column the price changes, a decision (trade-off analysis); along a row the volume changes, which the owner cannot ' +
        'control (sensitivity analysis). Only the corner of $3.40 and 1,800 cups loses money (-$210); every other cell covers the $3,900 of rent and wages.',
      wrong: ['=C5*(B6-B2)-B3', '=C$5*($B6-$B$2)-B3', '=$C$5*($B6-$B$2)-$B$3', '=C$5*(B$6-$B$2)-$B$3'],
    },
    // one task per cell so each can require its own function (mustUse applies to every cell of a task)
    {
      id: 'best',
      kind: 'formula',
      cells: 'B14',
      prompt: 'In B14 show the best weekly profit in the grid, with `MAX`.',
      solution: '=MAX(C6:G12)',
      check: { mustUse: ['MAX'] },
      hints: ['`MAX` takes the whole grid as one range.', 'The grid runs from C6 to G12.'],
      explain:
        '=MAX(C6:G12) = $5,850, at $4.60 and 3,000 cups. A range one row or column short is the classic slip: here the best cell sits in the last row ' +
        'and column. Pointing at G12 gives the same number today but stops working as soon as the grid changes shape; MAX keeps looking at every cell.',
      wrong: ['=MAX(C6:G11)', '=MAX(C6:C12)', '=G12'],
    },
    {
      id: 'worst',
      kind: 'formula',
      cells: 'B15',
      prompt: 'In B15 show the worst weekly profit in the grid, with `MIN`.',
      solution: '=MIN(C6:G12)',
      check: { mustUse: ['MIN'] },
      hints: ['`MIN` takes the same range as the `MAX` in B14.', 'The worst cell is a loss, so expect a negative number.'],
      explain: '=MIN(C6:G12) = -$210, at $3.40 and 1,800 cups: the only loss-making cell, and it sits in the first row and column of the grid.',
      wrong: ['=MIN(D6:G12)', '=MIN(C7:G12)', '=C6'],
    },
  ],
  testCases: [
    { name: 'Ingredient cost rises to $1.50', inputs: { B2: 1.5 } },
    { name: 'Rent and wages rise to $4,200', inputs: { B3: 4200 } },
  ],
  skills: ['mixed references', 'two-way profit grid', 'MAX and MIN'],
  techniques: ['Absolute/mixed references so formulas fill down/right', 'What-if / scenario analysis by changing inputs'],
}

const bentoContract: Exercise = {
  id: 'w2-goalseek-bento-breakeven',
  week: 'W2',
  topic: 'Goal Seek break-even',
  title: 'Goal Seek the break-even price of a bento contract',
  level: 1,
  minutes: 5,
  scenario:
    'A Jurong caterer has agreed to deliver 650 bento boxes a week to a factory canteen, at a price per box it still has to quote. Ingredients and ' +
    "packaging cost $3.85 a box and the kitchen's fixed cost is $2,210 a week. The owner wants the lowest price that does not lose money, found with " +
    'Goal Seek rather than algebra.',
  sheet: {
    name: 'Contract',
    rows: 9,
    cols: 3,
    colWidths: { A: 240, B: 120, C: 80 },
    cells: {
      A1: title('Bento contract: weekly break-even price'),
      A3: label('Boxes per week'),
      B3: input(650, INT),
      A4: label('Cost per box ($)'),
      B4: input(3.85, MONEY),
      A5: label('Fixed kitchen cost per week ($)'),
      B5: input(2210, MONEY),
      A7: label('Price per box ($)'),
      B7: input(6, MONEY, 'Decision: Goal Seek changes this cell'),
      A9: label('Weekly profit ($)'),
      B9: ans(MONEY),
    },
  },
  tasks: [
    {
      id: 'profit',
      kind: 'formula',
      cells: 'B9',
      prompt: 'In B9 write the weekly profit at the price in B7, using the cells above.',
      solution: '=(B7-B4)*B3-B5',
      hints: [
        'Each box earns the price minus its cost; multiply by the boxes, then subtract the weekly fixed cost once.',
        'Refer to B3, B4, B5 and B7: no numbers typed into the formula.',
      ],
      explain:
        '=(B7-B4)*B3-B5 (or =B7*B3-(B4*B3+B5)) gives -$812.50 at $6.00: each box contributes $2.15 towards the $2,210 fixed cost, and 650 boxes are not ' +
        'enough. Keeping every number in its own input cell is what lets Goal Seek change one input and see the effect.',
      wrong: ['=(B7-B4)*B3', '=B7*B3-B4-B5', '=(B7-B4)*B3+B5'],
    },
    {
      id: 'seek',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'B7',
      prompt: 'Use Goal Seek to find the break-even price: set the profit in B9 to 0 by changing the price in B7.',
      toolSetup: { setCell: 'B9', toValue: 0, changingCell: 'B7' },
      answer: { B7: 7.25 },
      check: { tol: 0.005 },
      hints: [
        'Break-even means profit = 0.',
        'What-If Analysis › Goal Seek: Set cell = the profit cell, To value = 0, By changing cell = the price (a cell holding a number, not a formula).',
      ],
      explain:
        'Goal Seek tries prices until the profit reaches 0: $7.25 a box. Check: (7.25 - 3.85) x 650 = 2,210, exactly the fixed cost, the same as the ' +
        'break-even formula cost + fixed cost / boxes = 3.85 + 2,210 / 650. Goal Seek changes exactly one input, which must hold a value, and works ' +
        'backwards from the result you ask for. Solver can find the same price (Set Objective B9, To: Value Of 0, By Changing B7), but for one input ' +
        'and one target Goal Seek is the quicker tool.',
      wrong: ['6', '7'],
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt:
        'The owner now asks you to "use Goal Seek to find the price that maximises profit". Explain why Goal Seek cannot do that, which tool can, and ' +
        'what this fixed-volume model would answer.',
      answer:
        'Goal Seek can only drive one formula cell to a target value by changing one input; it cannot maximise or minimise. Solver can (Max, with ' +
        'constraints if needed). But in this model the 650 boxes do not depend on the price, so profit grows without limit as the price rises: Solver ' +
        'would report that the objective does not converge, an "infinite" best price. An optimal price only exists once the model links demand to price ' +
        '(the canteen would order fewer boxes, or change caterer, if the price were high).',
      hints: ['Goal Seek needs a target value; "as high as possible" is not a value.', 'What happens to the profit here each time the price rises by $1?'],
      explain:
        'This is the rough-model trap: an optimiser gives an absurd answer when demand is not linked to price. Use Goal Seek for "which input gives this ' +
        'result?" and Solver for "which input gives the best result?".',
    },
  ],
  testCases: [
    { name: 'Cost per box rises to $4.10', inputs: { B4: 4.1 } },
    { name: '700 boxes a week with $2,500 fixed cost', inputs: { B3: 700, B5: 2500 } },
  ],
  skills: ['profit formula', 'Goal Seek', 'break-even price', 'Goal Seek vs Solver'],
  techniques: ['Goal Seek'],
}

// ---------- level 2: applied models ----------

const earbuds: Exercise = {
  id: 'w2-quadratic-demand-earbuds',
  week: 'W2',
  topic: 'Non-linear price-demand (quadratic)',
  title: 'When the demand line bends: a quadratic trendline',
  level: 2,
  minutes: 12,
  scenario:
    'A Bugis electronics shop tested eight prices for its own-brand wireless earbuds and recorded the units sold in a typical week (E4:F11). Sales fall ' +
    'quickly at low prices and level off at high ones. On a scatter chart, an order-2 polynomial trendline fits the survey as ' +
    'units = 0.01237 x price² - 4.587 x price + 474.3 between $40 and $180. Compare that curve with a straight-line fit and see what each implies for revenue.',
  sheet: {
    name: 'Earbuds',
    rows: 21,
    cols: 6,
    colWidths: { A: 120, B: 140, C: 165, D: 170, E: 200, F: 140 },
    cells: {
      A1: title('Wireless earbuds: two price-demand curves'),
      A3: label('Quadratic trendline: units = a·price² + b·price + c'),
      A4: label('a (price²)'),
      B4: input(0.01237, '0.00000'),
      A5: label('b (price)'),
      B5: input(-4.587, '0.000'),
      A6: label('c (constant)'),
      B6: input(474.3, '0.0'),
      E3: header('Survey price ($)'),
      F3: header('Units sold a week'),
      ...down('E', 4, [40, 60, 80, 100, 120, 140, 160, 180].map((v) => given(v, MONEY0))),
      ...down('F', 4, [312, 240, 190, 137, 104, 73, 58, 49].map((v) => input(v, INT))),
      ...across(13, 'A', [header('Price ($)'), header('Quadratic demand'), header('Straight-line demand'), header('Quadratic revenue ($)'), header('Straight-line revenue ($)')]),
      ...down('A', 14, [40, 60, 80, 100, 120, 140, 160, 180].map((v) => axis(v, MONEY0))),
      ...block('B', 'C', 14, 21, ans('#,##0.0')),
      ...block('D', 'E', 14, 21, ans(MONEY0)),
    },
  },
  tasks: [
    {
      id: 'quadratic',
      kind: 'formula',
      cells: 'B14:B21',
      prompt: 'In B14 compute the demand from the quadratic trendline (coefficients a, b and c in B4:B6) at the price in A14, and fill it down to B21.',
      solution: '=$B$4*A14^2+$B$5*A14+$B$6',
      hints: [
        'A trendline equation is just a formula in the price: replace x with the price cell.',
        'Excel writes x² as x^2. The three coefficient cells must not move when you fill down.',
        'Check: at $100 the curve gives about 139 units.',
      ],
      explain:
        '=$B$4*A14^2+$B$5*A14+$B$6 follows the survey closely: 311 at $40, 139 at $100, 49 at $180. Excel works out ^ before *, so $B$4*A14^2 squares only ' +
        'the price; ($B$4*A14)^2 would square the coefficient as well. Trust a trendline only inside its data: this one turns upwards beyond about $185, ' +
        'which real demand would not do.',
      wrong: ['=$B$4*A14+$B$5*A14+$B$6', '=$B$4*A14^2+$B$5*A14', '=B4*A14^2+B5*A14+B6', '=($B$4*A14)^2+$B$5*A14+$B$6'],
    },
    {
      id: 'straight',
      kind: 'formula',
      cells: 'C14:C21',
      prompt: 'In C14 forecast the demand at the price in A14 with `TREND` on the survey (a straight line through E4:F11), and fill it down to C21.',
      solution: '=TREND($F$4:$F$11,$E$4:$E$11,A14)',
      check: { mustUse: ['TREND'] },
      hints: [
        '`TREND` fits the least-squares straight line through the survey and reads it at a new price.',
        "TREND(known_y's, known_x's, new_x): units sold are the y values, survey prices the x values.",
        'Lock both survey ranges with $ before filling down.',
      ],
      explain:
        '=TREND($F$4:$F$11,$E$4:$E$11,A14) is the straight line units ≈ 350.6 - 1.866 x price through the same survey. Swapping the two ranges would fit ' +
        'price on units instead and give nonsense. A straight line cannot bend: it under-predicts at both ends (276 against 312 sold at $40) and over-predicts ' +
        'in the middle (164 against 137 at $100).',
      wrong: ['=TREND(F4:F11,E4:E11,A14)', '=TREND($E$4:$E$11,$F$4:$F$11,A14)'],
    },
    {
      id: 'revenue',
      kind: 'formula',
      cells: 'D14:E21',
      prompt:
        'In D14 write one formula for weekly revenue (price x units) that fills down and right over D14:E21: column D uses the quadratic demand, column E ' +
        'the straight-line demand.',
      solution: '=$A14*B14',
      check: { absolute: ['$A14'] },
      hints: [
        'Revenue = price x units.',
        'Moving right, the formula must keep reading the price in column A while the units move from column B to column C.',
      ],
      explain:
        '=$A14*B14 locks only the price column: moving right it becomes =$A14*C14 (straight-line units), moving down it follows the next price. The quadratic ' +
        'revenue peaks at the $80 test price (about $14,921 a week), while the straight line points to $100 ($16,404) because it overstates demand in the ' +
        'middle of the range.',
      wrong: ['=A14*B14', '=$A$14*B14', '=$A14*$B14'],
    },
    {
      id: 'compare',
      kind: 'explain',
      cells: '',
      prompt:
        "Compare both demand columns with the survey. Which price-demand function would you use, and how would the straight line mislead the shop's pricing?",
      answer:
        'Use the quadratic. The survey falls fast from 312 units at $40 to 137 at $100 and then levels off to 49 at $180. The quadratic trendline stays within ' +
        'about 4 units of every survey point, while the straight line under-predicts at both ends (276 at $40, 15 at $180), over-predicts in the middle ' +
        '(164 at $100) and would forecast negative sales above about $188. For revenue the quadratic makes $80 the best tested price (about $14,921 a week) ' +
        'but the straight line says $100, so a linear model would push the price too high. Either curve should only be used inside the surveyed $40 to $180 range.',
      hints: ['Compare each curve with the survey at $40, $100 and $180.', 'Then find the highest revenue in each revenue column.'],
      explain:
        'Choosing the functional form is part of building the model: chart the data, try trendline types, and keep the one that follows the data without ' +
        'absurd behaviour in the range you will use. The equation then enters the model as an ordinary formula.',
    },
  ],
  testCases: [
    { name: 'Re-survey: $100 sold 146 a week (trendline refitted)', inputs: { F7: 146, B4: 0.0117, B5: -4.445, B6: 469.3 } },
    // not a change at $40: the least-squares line pivots at $140 then, so C19 and E19 would not move
    { name: 'Re-survey: $60 sold 232 a week (trendline refitted)', inputs: { F5: 232, B4: 0.01225, B5: -4.537, B6: 469.5 } },
  ],
  skills: ['quadratic price-demand function', 'TREND straight-line fit', 'exponent operator ^', 'mixed references', 'revenue curve'],
  techniques: ['Linear trend forecasting (TREND / trendline)', 'Absolute/mixed references so formulas fill down/right', 'Written interpretation of model results'],
}

const purifier: Exercise = {
  id: 'w2-bait-hook-purifier',
  week: 'W2',
  topic: 'Bait-and-hook profit model',
  title: 'Cheap purifier, pricey filters: a two-product profit model',
  level: 2,
  minutes: 15,
  scenario:
    'A home-appliance start-up sells a countertop water purifier and the replacement filters that only fit it. Like any bait-and-hook business, it can ' +
    'price the purifier near cost and earn its margin on filters. Market tests say yearly purifier demand falls in a straight line with the purifier ' +
    'price, and each owner buys 3.5 filters a year. If a filter costs more than 45% of the purifier price, buyers see the trap and nobody buys the purifier.',
  sheet: {
    name: 'Purifier',
    rows: 28,
    cols: 3,
    colWidths: { A: 260, B: 130, C: 80 },
    cells: {
      A1: title('Countertop purifier and filters: yearly profit model'),
      A3: header('Decisions'),
      A4: label('Purifier price ($)'),
      B4: input(129, MONEY),
      A5: label('Filter price ($)'),
      B5: input(39, MONEY),
      A7: header('Parameters'),
      A8: label('Purifier unit cost ($)'),
      B8: input(108, MONEY),
      A9: label('Filter unit cost ($)'),
      B9: input(9, MONEY),
      A10: label('Fixed cost per year ($)'),
      B10: input(380000, MONEY0),
      A11: label('Max filter price / purifier price'),
      B11: input(0.45, '0%'),
      A12: label('Filters per purifier per year'),
      B12: input(3.5, '0.0'),
      A13: label('Purifiers sold at a $0 price'),
      B13: input(64000, INT),
      A14: label('Demand slope (purifiers per $1)'),
      B14: input(-250, INT),
      A16: header('Results'),
      A17: label('Purifiers sold'),
      B17: ans(INT),
      A18: label('Filters sold'),
      B18: ans(INT),
      A19: label('Total revenue ($)'),
      B19: ans(MONEY0),
      A20: label('Total cost ($)'),
      B20: ans(MONEY0),
      A21: label('Profit ($)'),
      B21: ans(MONEY0),
      A23: label('Purifier margin on cost'),
      B23: ans(PCT),
      A24: label('Filter margin on cost'),
      B24: ans(PCT),
      A26: header('What-if on the filter price'),
      A27: label('Profit with filters at $55 ($)'),
      B27: ans(MONEY0),
      A28: label('Profit with filters at $60 ($)'),
      B28: ans(MONEY0),
    },
  },
  tasks: [
    {
      id: 'purifiers',
      kind: 'formula',
      cells: 'B17',
      prompt:
        'In B17 compute the purifiers sold: 0 when the filter price is above the maximum ratio times the purifier price, otherwise the demand line ' +
        '(intercept + slope x purifier price). Use `IF`.',
      solution: '=IF(B5>B11*B4,0,B13+B14*B4)',
      check: { mustUse: ['IF'] },
      hints: [
        'The test compares the filter price with 45% of the purifier price.',
        'IF(test, value if TRUE, value if FALSE): the test is TRUE when buyers walk away.',
        'Test: filter price > max ratio x purifier price. TRUE gives 0; FALSE gives B13 + B14 x purifier price.',
      ],
      explain:
        '=IF(B5>B11*B4,0,B13+B14*B4) gives 31,750 purifiers at $129 and $39 ($39 is well under 0.45 x $129 = $58.05). The IF is the limit of the hook: ' +
        'raise the filter price to $65 and purifier demand drops to 0. =IF(B5/B4>B11,0,...) works too. Use > rather than >=: the rule is "more than", so ' +
        'a filter priced exactly at the limit still sells.',
      wrong: ['=IF(B5>B11*B4,B13+B14*B4,0)', '=IF(B5<B11*B4,0,B13+B14*B4)', '=B13+B14*B4', '=IF(B5>=B11*B4,0,B13+B14*B4)', '=IF(B5>B11,0,B13+B14*B4)'],
    },
    {
      id: 'filters',
      kind: 'formula',
      cells: 'B18',
      prompt: 'In B18 compute the filters sold in a year.',
      solution: '=B12*B17',
      hints: ['Filter demand comes from the purifiers in use, not from the filter price.', 'Filters sold = filters per purifier x purifiers sold.'],
      explain:
        '=B12*B17 = 111,125 filters. Linking filter demand to purifier demand is what ties the two prices together: anything that kills purifier sales also ' +
        'kills filter sales.',
      wrong: ['=B12*B13', '=B17/B12'],
    },
    {
      id: 'revenue',
      kind: 'formula',
      cells: 'B19',
      prompt: 'In B19 compute the total revenue from purifiers and filters.',
      solution: '=B4*B17+B5*B18',
      hints: ['Two products, so two price x quantity terms.', 'Purifiers sold are in B17 and filters sold in B18: pair each with its own price.'],
      explain: '=B4*B17+B5*B18 = $8,429,625: about $4.10 million from purifiers and $4.33 million from filters.',
      wrong: ['=B4*B17', '=B4*B17+B5*B17'],
    },
    {
      id: 'cost',
      kind: 'formula',
      cells: 'B20',
      prompt: "In B20 compute the total cost: each product's unit cost times its quantity, plus the fixed cost.",
      solution: '=B8*B17+B9*B18+B10',
      hints: ['Unit cost x units for each product.', 'The fixed cost is paid once a year whatever the sales.'],
      explain:
        '=B8*B17+B9*B18+B10 = $4,809,125. Leaving out the fixed cost is the classic prototype error: profit is then overstated by exactly $380,000, and only ' +
        'a hand check catches it.',
      wrong: ['=B8*B17+B9*B18', '=B8*B17+B9*B17+B10'],
    },
    {
      id: 'profit',
      kind: 'formula',
      cells: 'B21',
      prompt: 'In B21 compute the yearly profit.',
      solution: '=B19-B20',
      hints: ['Profit = total revenue - total cost.', 'Both totals are already in B19 and B20: no need to recompute them.'],
      explain: '=B19-B20 = $3,620,500 a year. Building profit from the revenue and cost cells keeps each step easy to check by hand.',
      wrong: ['=B20-B19', '=B19+B20'],
    },
    {
      id: 'margins',
      kind: 'formula',
      cells: 'B23:B24',
      prompt: "In B23 compute the purifier's margin on cost, (price - unit cost) / unit cost, as one formula that fills down to B24 for the filter.",
      solution: '=(B4-B8)/B8',
      hints: [
        'Margin on cost = (price - unit cost) / unit cost.',
        "The filter's price and cost sit one row below the purifier's (B5 and B9), so the same relative formula fills down.",
      ],
      explain:
        '=(B4-B8)/B8 gives 19.4% for the purifier and, filled down, (39 - 9) / 9 = 333% for the filter. Without the brackets Excel divides first: ' +
        '=B4-B8/B8 is 128, not a margin.',
      wrong: ['=(B4-B8)/B4', '=B4-B8/B8', '=(B4-B8)/$B$8'],
    },
    {
      id: 'whatif',
      kind: 'value',
      cells: 'B27:B28',
      prompt:
        'What-if: change the filter price in B5 to $55, read the profit in B21 and type it into B27 as a number. Then try $60 and type that profit into ' +
        'B28. Set B5 back to $39 afterwards.',
      answer: { B27: 5398500, B28: -380000 },
      check: { tol: 0.5 },
      hints: [
        'Type 55 into B5 and the whole model recalculates; read B21. Then type 60.',
        'At $60, compare the filter price with 45% of the $129 purifier price: what does the IF in B17 return?',
        'Type the numbers themselves: a formula such as =B21 would go back to the base profit once B5 is reset.',
      ],
      explain:
        'At $55 the profit rises to $5,398,500: each of the 111,125 filters earns $16 more and no buyer is lost, because $55 is still under the ' +
        '$58.05 limit (45% of $129). At $60 the IF switches purifier demand to 0, the filter sales go with it and the profit is minus the $380,000 ' +
        'fixed cost. A what-if is one edit to an input cell because every formula refers to it; the cliff just above $58.05 is the hook breaking.',
      wrong: ['3620500', '=B21'],
    },
    {
      id: 'bait',
      kind: 'explain',
      cells: '',
      prompt:
        'Use the two margins and the demand rule to explain the bait-and-hook strategy: why can the start-up price the purifier so close to cost, and what ' +
        'stops it raising the filter price without limit?',
      answer:
        'Each purifier sold brings 3.5 filters a year, and filters earn 333% on cost against 19% for the purifier, so most of the profit comes from filters: ' +
        'the cheap purifier is the bait that creates filter demand. It could even sell the purifier below cost if the extra purifiers brought enough filter ' +
        'profit. The limit is the 45% rule in the IF: a higher filter price pays (about $5.4 million profit at $55) only while a filter costs at most 45% ' +
        'of the purifier price ($58.05). Above that, buyers see the trap, purifier demand drops to zero and filter sales go with it: at $60 the profit ' +
        'falls to minus the $380,000 fixed cost.',
      hints: ['Compare the two margins, and remember where filter demand comes from.', 'What does the IF do when the filter price passes 45% of the purifier price?'],
      explain:
        'The two prices must be set together: the purifier price drives demand for both products, and it also caps the filter price. That is why one profit ' +
        'model holds both products and their trade-offs are analysed together.',
    },
  ],
  // every case moves all seven answers; the last sits exactly on the 50% limit (70 = 0.5 x 140, exact in binary) to tell > from >=
  testCases: [
    { name: 'Purifier price cut to $99 and filters to $35', inputs: { B4: 99, B5: 35 } },
    { name: 'Filter price raised to $65 and purifier cost to $112', inputs: { B5: 65, B8: 112 } },
    {
      name: 'Market re-test: 70,000 at a $0 price, slope -280, 3 filters a year; unit costs $104 and $10; fixed cost $420,000',
      inputs: { B13: 70000, B14: -280, B12: 3, B8: 104, B9: 10, B10: 420000 },
    },
    { name: 'Limit raised to 50% and the filter priced exactly at it: purifier $140, filters $70', inputs: { B11: 0.5, B4: 140, B5: 70 } },
  ],
  skills: ['IF guard on demand', 'linked product demand', 'revenue, cost and profit model', 'margin on cost', 'what-if on a decision', 'bait-and-hook pricing'],
  techniques: ['What-if / scenario analysis by changing inputs', 'Written interpretation of model results'],
}

const escapeRoom: Exercise = {
  id: 'w2-solver-escape-room-price',
  week: 'W2',
  topic: 'Solver GRG on a price',
  title: 'Solver finds the best price on a curved profit',
  level: 2,
  minutes: 12,
  scenario:
    'An escape-room company on Sentosa sets one price per player for its weekday sessions. Weekly demand falls by 12 players for every $1 on the price ' +
    '(900 players at a $0 price); each player costs $8 in staff time and props, and the venue costs $4,500 a week. The rooms can host only 360 players ' +
    'a week. Find the best price with and without that room limit.',
  sheet: {
    name: 'Rooms',
    rows: 15,
    cols: 4,
    colWidths: { A: 240, B: 130, C: 140, D: 60 },
    cells: {
      A1: title('Escape-room sessions: best price per player'),
      A3: header('Weekly model'),
      B3: header('No room limit'),
      C3: header('With room limit'),
      A4: label('Price per player ($)'),
      B4: input(30, MONEY, 'Decision: Solver changes this cell'),
      C4: input(30, MONEY, 'Decision: Solver changes this cell'),
      A5: label('Players (demand)'),
      B5: ans(INT),
      C5: ans(INT),
      A6: label('Revenue ($)'),
      ...block('B', 'C', 6, 8, ans(MONEY)),
      A7: label('Total cost ($)'),
      A8: label('Profit ($)'),
      A10: header('Parameters'),
      A11: label('Players a week at a $0 price'),
      B11: input(900, INT),
      A12: label('Demand slope (players per $1)'),
      B12: input(-12, INT),
      A13: label('Cost per player ($)'),
      B13: input(8, MONEY),
      A14: label('Fixed cost per week ($)'),
      B14: input(4500, MONEY0),
      A15: label('Room capacity (players a week)'),
      B15: input(360, INT),
    },
  },
  tasks: [
    {
      id: 'demand',
      kind: 'formula',
      cells: 'B5:C5',
      prompt: 'In B5 compute the players (demand) at the price in B4 from the parameters in column B, and fill it right to C5.',
      solution: '=$B$11+$B$12*B4',
      hints: ['Demand = players at $0 + slope x price.', 'Both model columns read the same parameters in B11:B12: lock them before filling right.'],
      explain:
        '=$B$11+$B$12*B4 gives 540 players at $30. The parameters are stored once and every price column reads them: the usual layout for a trade-off ' +
        'row of model columns.',
      wrong: ['=B11+B12*B4', '=$B$11-$B$12*B4', '=$B$11+$B$12*$B$4'],
    },
    {
      id: 'money',
      kind: 'formula',
      cells: 'B6:C8',
      prompt: 'Complete B6:C8: revenue, total cost and profit for both columns.',
      solutions: { B6: '=B4*B5', C6: '=C4*C5', B7: '=$B$13*B5+$B$14', C7: '=$B$13*C5+$B$14', B8: '=B6-B7', C8: '=C6-C7' },
      hints: [
        'Revenue = price x players; total cost = cost per player x players + fixed cost; profit = revenue - total cost.',
        'Write column B, then fill right: the two cost parameters need $ signs, the price and the players do not.',
      ],
      explain:
        'At $30: revenue $16,200, total cost $8,820, profit $7,380. Profit = (price - 8) x (900 - 12 x price) - 4,500 is a quadratic in the price: it rises, ' +
        'peaks and falls, so the best price lies somewhere in the middle.',
      wrong: ['=B4*B11', '=B4*B12'],
    },
    {
      id: 'open',
      kind: 'tool',
      tool: 'solver',
      cells: 'B4',
      prompt: 'Use Solver on column B: maximise the profit in B8 by changing the price in B4, with no constraints and GRG Nonlinear as the solving method.',
      toolSetup: { objective: 'B8', sense: 'max', changing: 'B4', constraints: [], nonNegative: true, engine: 'grg' },
      answer: { B4: 41.5, B8: 8967 },
      check: { tol: 0.01 },
      hints: [
        'Data › Solver: Set Objective B8, To Max, By Changing Variable Cells B4.',
        'Profit is a curve in the price, so choose GRG Nonlinear (Simplex LP refuses non-linear models).',
      ],
      explain:
        'Solver settles at $41.50: 402 players and $8,967 profit. Check: the profit curve (P - 8)(900 - 12P) - 4,500 is zero-margin at $8 and zero-demand at ' +
        '$75, and it peaks halfway between them, at $41.50. GRG Nonlinear climbs the smooth curve to its top; on a non-linear model it promises a local ' +
        'optimum, which on this single-peaked curve is also the global one.',
      wrong: ['30', '45'],
    },
    {
      id: 'capped',
      kind: 'tool',
      tool: 'solver',
      cells: 'C4',
      prompt: 'Now use Solver on column C: maximise C8 by changing C4, subject to the players in C5 being at most the room capacity in B15 (GRG Nonlinear).',
      toolSetup: { objective: 'C8', sense: 'max', changing: 'C4', constraints: [{ lhs: 'C5', relation: '<=', rhs: 'B15' }], nonNegative: true, engine: 'grg' },
      answer: { C4: 45, C8: 8820 },
      check: { tol: 0.01 },
      hints: ['Same set-up on column C, plus Add constraint: C5 <= B15.', 'Keep "Make Unconstrained Variables Non-Negative" ticked.'],
      explain:
        'With the cap, $41.50 is not feasible (402 players, only 360 places), so Solver raises the price until demand just fits: 900 - 12 x P = 360 gives ' +
        'P = $45 and a profit of $8,820. The capacity constraint is binding, and it costs only $147 of profit.',
      wrong: ['41.5', '40'],
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'Explain why the room limit moves the best price up from $41.50 to $45, and why GRG Nonlinear is the right Solver engine for this model.',
      answer:
        'At $41.50 demand is 402 players but only 360 fit, so that price is not feasible. Any price below $45 creates more demand than the rooms can hold, and ' +
        'above $41.50 profit falls as the price rises, so the best feasible price is the lowest one that keeps demand at 360: $45, where the capacity ' +
        'constraint is binding. Profit is (price - cost) x demand and demand itself depends on the price, so the objective is a quadratic, non-linear function ' +
        "of the decision: GRG Nonlinear handles smooth non-linear models, while Simplex LP would reject it. With one decision and a single-peaked curve, GRG's " +
        'local optimum is also the global one.',
      hints: ['Is $41.50 feasible with only 360 places?', 'Is profit a straight line in the price?'],
      explain:
        'Report the Solver set-up (objective, Max/Min, changing cells, constraints, engine) with the answer, and confirm the result by hand or with a small ' +
        'trade-off table around it.',
    },
  ],
  testCases: [
    { name: 'Cost per player rises to $10 and each $1 loses 13 players', inputs: { B13: 10, B12: -13 } },
    { name: '960 players at a $0 price and $5,000 fixed cost', inputs: { B11: 960, B14: 5000 } },
  ],
  skills: ['price-demand profit model', 'Solver Max', 'GRG Nonlinear', 'capacity constraint', 'binding constraint'],
  techniques: [
    'Solver optimisation (objective, changing cells, constraints)',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

const rooftopCinema: Exercise = {
  id: 'w2-tradeoff-rooftop-cinema',
  week: 'W2',
  topic: 'Trade-off analysis: one-way Data Table',
  title: 'Ticket price trade-off with a one-way Data Table',
  level: 2,
  minutes: 12,
  scenario:
    'A rooftop cinema at Marina Bay screens a film every Friday night and must pick one ticket price. Each $1 on the ticket loses 9 guests (390 guests at ' +
    'a $0 price), but the deck holds only 280 seats. Every guest also spends $6.50 on snacks at a 60% margin, and a screening night costs $2,400. ' +
    'Tabulate how guests, ticket revenue, snack profit and profit trade off as the ticket price moves from $10 to $34.',
  sheet: {
    name: 'Cinema',
    rows: 18,
    cols: 8,
    colWidths: { A: 250, B: 100, C: 24, D: 130, E: 80, F: 150, G: 140, H: 100 },
    cells: {
      A1: title('Rooftop cinema: one-way Data Table on the ticket price'),
      A3: header('Decision'),
      A4: label('Ticket price ($)'),
      B4: input(18, MONEY),
      A5: header('Parameters'),
      A6: label('Guests at a $0 price'),
      B6: input(390, INT),
      A7: label('Demand slope (guests per $1)'),
      B7: input(-9, INT),
      A8: label('Seats on the deck'),
      B8: input(280, INT),
      A9: label('Snack spend per guest ($)'),
      B9: input(6.5, MONEY),
      A10: label('Snack margin'),
      B10: input(0.6, '0%'),
      A11: label('Fixed cost per night ($)'),
      B11: input(2400, MONEY0),
      A12: header('Results'),
      A13: label('Guests'),
      B13: ans(INT),
      A14: label('Ticket revenue ($)'),
      B14: ans(MONEY),
      A15: label('Snack profit ($)'),
      B15: ans(MONEY),
      A16: label('Profit ($)'),
      B16: ans(MONEY),
      A18: label('Highest profit in the table ($)'),
      B18: ans(MONEY),
      D2: title('Trade-off table: each price is fed into B4'),
      ...across(3, 'D', [header('Ticket price ($)'), header('Guests'), header('Ticket revenue ($)'), header('Snack profit ($)'), header('Profit ($)')]),
      E4: ans(INT),
      ...block('F', 'H', 4, 4, ans(MONEY)),
      ...down('D', 5, [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34].map((v) => axis(v, MONEY0))),
      ...block('E', 'E', 5, 17, ans(INT)),
      ...block('F', 'H', 5, 17, ans(MONEY)),
    },
  },
  tasks: [
    {
      id: 'guests',
      kind: 'formula',
      cells: 'B13',
      prompt: 'In B13 compute the guests: the demand at the ticket price, but never more than the seats on the deck. Use `MIN`.',
      solution: '=MIN(B8,B6+B7*B4)',
      check: { mustUse: ['MIN'] },
      hints: ['Demand = guests at $0 + slope x price.', 'The smaller of the demand and the seats is what actually turns up.'],
      explain:
        '=MIN(B8,B6+B7*B4) gives 228 guests at $18. At $12 or less the demand passes 280 and the MIN caps it: a capacity limit is the MIN of what is wanted ' +
        'and what is available.',
      wrong: ['=MAX(B8,B6+B7*B4)', '=MIN(B8,B6-B7*B4)', '=B6+B7*B4'],
    },
    {
      id: 'money',
      kind: 'formula',
      cells: 'B14:B16',
      prompt: 'In B14:B16 compute the ticket revenue, the snack profit and the profit for the night.',
      solutions: { B14: '=B4*B13', B15: '=B13*B9*B10', B16: '=B14+B15-B11' },
      hints: ['Ticket revenue = price x guests; snack profit = guests x spend x margin.', 'Profit = ticket revenue + snack profit - fixed cost.'],
      explain: 'At $18: ticket revenue $4,104, snack profit $889.20, profit $2,593.20.',
      wrong: ['=B4*B6', '=B4*B8'],
    },
    {
      id: 'links',
      kind: 'formula',
      cells: 'E4:H4',
      prompt: 'Set up the formula row of the Data Table: in E4:H4 link to the four results in B13:B16 (guests, ticket revenue, snack profit, profit).',
      solutions: { E4: '=B13', F4: '=B14', G4: '=B15', H4: '=B16' },
      hints: ['A one-variable Data Table with its inputs down a column records the formulas in its top row.', 'Each link is just = and the result cell, e.g. =B13 in E4.'],
      explain: 'The links tell the Data Table which outputs to record for each price. Until the table runs they show the base case at $18.',
      wrong: ['=B6', '=B4'],
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E5:H17',
      prompt: 'Select D4:H17 and run What-If Analysis › Data Table with B4 as the column input cell, so each price in D5:D17 is fed into the model.',
      toolSetup: { range: 'D4:H17', colInput: 'B4' },
      answer: { E5: 280, F5: 2800, H5: 1492, E10: 210, H10: 2619, F11: 4224, H17: 783.6 },
      check: { tol: 0.005 },
      hints: [
        'The prices run down a column: use the Column input cell and leave the Row input cell empty.',
        "The column input cell is the model's ticket price, B4, not a cell inside the table.",
      ],
      explain:
        'Excel puts each price into B4 in turn, recalculates and copies the four linked results across. The body holds {=TABLE(,B4)}: its cells cannot be ' +
        'edited one by one, and with "Automatic except for data tables" they refresh only when you press F9.',
    },
    {
      id: 'best',
      kind: 'formula',
      cells: 'B18',
      prompt: 'In B18 use `MAX` to show the highest profit the Data Table found for the ticket prices in D5:D17.',
      solution: '=MAX(H5:H17)',
      check: { mustUse: ['MAX'] },
      hints: ['`MAX` returns the largest number in a range.', 'Profit is the last column of the table, H5:H17.'],
      explain:
        '=MAX(H5:H17) = $2,619, at a $20 ticket. MAX of the ticket revenue column would give $4,224 at $22: the right answer to the wrong objective. ' +
        'Leave out H4: it is the link row, showing the profit at whatever price is in B4 rather than one of the tabulated prices.',
      wrong: ['=MAX(F5:F17)', '=MAX(E5:H17)', '=MAX(H5:H16)', '=MAX(H4:H17)'],
    },
    {
      id: 'tradeoff',
      kind: 'explain',
      cells: '',
      prompt:
        'Read the table from $10 to $34. Which ticket price gives the most profit, why is it lower than the price with the most ticket revenue, and what ' +
        'kind of analysis is this?',
      answer:
        'Profit peaks at $20 ($2,619) while ticket revenue peaks at $22 ($4,224). Up to about $12 the 280-seat cap binds, so raising the price there loses no ' +
        'guests. Above that every $1 loses 9 guests, and each lost guest also takes $3.90 of snack profit away, so it pays to stop raising the price earlier ' +
        'than ticket revenue alone suggests. This is trade-off analysis: we changed a decision (the ticket price) and watched guests, ticket revenue, snack ' +
        'profit and profit move against each other. The exact optimum lies between the $2 steps, at about $19.72, which Solver would find.',
      hints: ['Find the row with the highest profit and the row with the highest ticket revenue.', 'What else does a guest bring besides the ticket?'],
      explain:
        'A trade-off table varies a decision. Reading it means naming the best value, the competing effects behind it and the limit set by the step size; ' +
        'a chart of the profit column shows the same peak.',
    },
  ],
  // the first and third cases put the seat cap to work; the last moves the best tabulated price to the $34 end of the table
  // (and puts B4 above it), so a MAX range that drops a row or adds the link row H4 fails
  testCases: [
    { name: 'Ticket price cut to $11 and snack spend up to $8.00', inputs: { B4: 11, B9: 8 } },
    { name: '420 guests at a $0 price and $2,700 fixed cost', inputs: { B6: 420, B11: 2700 } },
    { name: 'Deck extended to 300 seats, tickets at $9 and a 65% snack margin', inputs: { B8: 300, B4: 9, B10: 0.65 } },
    { name: 'Guests less price-sensitive (5 fewer per $1) and tickets at $36', inputs: { B7: -5, B4: 36 } },
  ],
  skills: ['capacity cap with MIN', 'one-variable Data Table', 'trade-off analysis', 'reading a trade-off table'],
  techniques: ['What-if / scenario analysis by changing inputs', 'Capacity and flow-balance logic with MIN/MAX', 'Written interpretation of model results'],
}

const scooterShare: Exercise = {
  id: 'w2-sensitivity-escooter',
  week: 'W2',
  topic: 'Sensitivity analysis: two-way Data Table',
  title: 'How sensitive is e-scooter profit? A two-way Data Table',
  level: 2,
  minutes: 12,
  scenario:
    'An e-scooter sharing operator in Punggol charges a $1.50 unlock fee plus $0.39 a minute. Its analysts estimate 9,000 rides a day at a $0 unlock fee, ' +
    'falling by 2,000 rides for each $1 on the fee, with an average ride of 12 minutes; each ride costs $1.20 to run and the fleet costs $5,500 a day. ' +
    'Neither the demand slope nor the ride length is under the operator\'s control, so management wants to know how much daily profit depends on them.',
  sheet: {
    name: 'Scooters',
    rows: 15,
    cols: 10,
    colWidths: { A: 270, B: 100, C: 24, D: 120, E: 80, F: 80, G: 80, H: 80, I: 80, J: 165 },
    cells: {
      A1: title('E-scooter sharing: two-way sensitivity table'),
      A3: header('Decisions'),
      A4: label('Unlock fee ($)'),
      B4: input(1.5, MONEY),
      A5: label('Price per minute ($)'),
      B5: input(0.39, MONEY),
      A6: header('Parameters'),
      A7: label('Rides a day at a $0 unlock fee'),
      B7: input(9000, INT),
      A8: label('Demand slope (rides per $1 of fee)'),
      B8: input(-2000, INT),
      A9: label('Average ride length (minutes)'),
      B9: input(12, '0'),
      A10: label('Running cost per ride ($)'),
      B10: input(1.2, MONEY),
      A11: label('Fixed cost per day ($)'),
      B11: input(5500, MONEY0),
      A12: header('Results'),
      A13: label('Rides a day'),
      B13: ans(INT),
      A14: label('Revenue per ride ($)'),
      B14: ans(MONEY),
      A15: label('Profit per day ($)'),
      B15: ans(MONEY0),
      D2: title('Profit per day: ride minutes (down) x demand slope (across)'),
      D3: label('Minutes ↓  slope →'),
      D4: ans(MONEY0),
      ...across(4, 'E', [-3000, -2500, -2000, -1500, -1000].map((v) => axis(v, INT))),
      ...down('D', 5, [6, 8, 10, 12, 14, 16, 18].map((v) => axis(v, '0'))),
      ...block('E', 'I', 5, 11, ans(MONEY0)),
      J4: header('Swing across slopes ($)'),
      ...block('J', 'J', 5, 11, ans(MONEY0)),
    },
  },
  tasks: [
    {
      id: 'model',
      kind: 'formula',
      cells: 'B13:B15',
      prompt: 'In B13:B15 compute the rides a day, the revenue per ride and the profit per day.',
      solutions: { B13: '=B7+B8*B4', B14: '=B4+B5*B9', B15: '=B13*(B14-B10)-B11' },
      hints: [
        'Rides = rides at a $0 fee + slope x unlock fee.',
        'Revenue per ride = unlock fee + price per minute x minutes.',
        'Profit = rides x (revenue per ride - running cost per ride) - fixed cost.',
      ],
      explain: '6,000 rides x ($6.18 - $1.20) - $5,500 = $24,380 a day.',
      wrong: ['=B7-B8*B4', '=B8*B4'],
    },
    {
      id: 'corner',
      kind: 'formula',
      cells: 'D4',
      prompt:
        'The sensitivity table sits in D4:I11, demand slopes across row 4 and ride lengths down column D. In its top-left corner D4, link to the profit per day.',
      solution: '=B15',
      hints: [
        'A two-variable Data Table tabulates exactly one output: the formula in its top-left corner.',
        'Excel feeds each slope and ride length into the model and records whatever the corner shows, so the corner must show the profit.',
      ],
      explain: '=B15. In a two-way table the corner holds the single output; the row and the column around it hold the values to try.',
      wrong: ['=B13', '=B14'],
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E5:I11',
      prompt:
        'Select D4:I11 and run What-If Analysis › Data Table: the slopes in row 4 go into the row input cell B8, the ride lengths in column D into the ' +
        'column input cell B9.',
      toolSetup: { range: 'D4:I11', rowInput: 'B8', colInput: 'B9' },
      answer: { E5: 6380, I5: 14300, G8: 24380, E11: 27440, I11: 49400 },
      check: { tol: 0.005 },
      hints: ['Row input cell: the parameter whose values run across the top row.', 'Column input cell: the parameter whose values run down the left column.'],
      explain:
        'Each body cell is the daily profit for one slope and one ride length; G8 repeats the base case (slope -2,000, 12 minutes): $24,380. Swapping the two ' +
        'input cells is the usual mistake: the table then feeds minutes into the slope cell and slopes into the minutes cell.',
    },
    {
      id: 'spread',
      kind: 'formula',
      cells: 'J5:J11',
      prompt:
        'In J5 compute how far the profit swings across the five slopes for 6-minute rides (the largest minus the smallest value in that row of the ' +
        'table, with `MAX` and `MIN`), and fill it down to J11.',
      solution: '=MAX(E5:I5)-MIN(E5:I5)',
      check: { mustUse: ['MAX', 'MIN'] },
      hints: ['Use `MAX` and `MIN` on one row of the table.', 'Keep the references relative so each copy reads its own row.'],
      explain:
        '=MAX(E5:I5)-MIN(E5:I5) grows from $7,920 for 6-minute rides to $21,960 for 18-minute rides. =I5-E5 happens to give the same numbers here, ' +
        'because profit rises steadily with the slope, but MAX and MIN keep working when the largest and smallest values sit elsewhere in the row.',
      wrong: ['=MAX(E5:I5)', '=MAX($E$5:$I$5)-MIN($E$5:$I$5)', '=MAX(E5:I11)-MIN(E5:I11)', '=I5-E5'],
    },
    {
      id: 'robust',
      kind: 'explain',
      cells: '',
      prompt:
        'What does the table say about how sensitive profit is to the demand slope, and when is the model most robust? Is this trade-off or sensitivity analysis?',
      answer:
        'Across the five slopes profit swings by $7,920 when rides last 6 minutes but by $21,960 when they last 18 minutes: profit is far more sensitive to how ' +
        'price-sensitive riders are when rides are long, because every lost ride then takes more per-minute revenue with it. The model is most robust when rides ' +
        'are short. Both inputs are parameters the operator cannot control, so this is sensitivity analysis; if long rides are expected, the demand-slope ' +
        'estimate deserves the most checking. Profit stays positive in every cell, from $6,380 (steep slope, 6-minute rides) to $49,400.',
      hints: ['Compare the swing in J5 (6-minute rides) with the one in J11 (18-minute rides).', 'Who controls the slope and the ride length?'],
      explain:
        'A sensitivity table shows which assumption matters most, and when: here one parameter (ride length) amplifies the effect of another (the demand ' +
        'slope). That tells managers where better data is worth paying for before they trust a forecast.',
    },
  ],
  // every case moves all eleven answers (the swing in J needs the fee, the per-minute price or the running cost to change)
  testCases: [
    { name: 'Unlock fee raised to $2.00', inputs: { B4: 2 } },
    { name: 'Riders pay $0.45 a minute, running cost $1.50 and 9,500 rides at a $0 fee', inputs: { B5: 0.45, B10: 1.5, B7: 9500 } },
    { name: 'Fleet costs $6,000 a day, running cost $1.10, slope -2,400 per $1 and 14-minute rides', inputs: { B11: 6000, B10: 1.1, B8: -2400, B9: 14 } },
  ],
  skills: ['two-variable Data Table', 'row and column input cells', 'sensitivity analysis', 'MAX minus MIN swing'],
  techniques: ['What-if / scenario analysis by changing inputs', 'Written interpretation of model results'],
}

const PROGRAMMES = ['Culinary arts', 'Aircraft maintenance', 'Data analytics', 'Nursing aide', 'Electrical installation']

const trainingFund: Exercise = {
  id: 'w2-training-fund-margins',
  week: 'W2',
  topic: 'Expected-value investment model',
  title: 'A repayable training fund: which programme pays?',
  level: 2,
  minutes: 16,
  scenario:
    'A Singapore social-impact fund pays the course fees of mid-career trainees in five vocational programmes. Instead of a grant, each graduate repays a ' +
    'fixed sum out of future salary (the repayment per graduate), but some trainees drop out or never find a job in the field and repay nothing: the ' +
    "programme's default probability. The fund's board wants each programme's investment, expected repayment, expected margin and margin %, and the same " +
    'for the whole plan.',
  sheet: {
    name: 'Fund',
    rows: 15,
    cols: 7,
    colWidths: { A: 210, B: 165, C: 165, D: 165, E: 165, F: 165, G: 120 },
    cells: {
      A1: title('Repayable training fund: expected margins'),
      A3: header('Programme'),
      ...across(3, 'B', PROGRAMMES.map((p) => header(p))),
      G3: header('Whole plan'),
      A4: label('Trainees funded'),
      ...across(4, 'B', [40, 12, 30, 25, 18].map((v) => input(v, INT))),
      A5: label('Course fee per trainee ($)'),
      ...across(5, 'B', [6800, 18500, 11200, 7400, 9600].map((v) => input(v, MONEY0))),
      A6: label('Repayment per graduate ($)'),
      ...across(6, 'B', [8300, 23900, 14600, 8700, 12100].map((v) => input(v, MONEY0))),
      A7: label('Default probability'),
      ...across(7, 'B', [0.09, 0.06, 0.12, 0.04, 0.07].map((v) => input(v, '0%'))),
      A9: label('Investment ($)'),
      A10: label('Expected repayment ($)'),
      A11: label('Expected margin ($)'),
      ...block('B', 'G', 9, 11, ans(MONEY0)),
      A12: label('Expected margin %'),
      ...block('B', 'G', 12, 12, ans(PCT)),
      A13: label('Share of plan investment'),
      ...block('B', 'F', 13, 13, ans(PCT)),
      A14: label('Highest expected margin ($)'),
      B14: ans(),
      A15: label('Highest expected margin %'),
      B15: ans(),
    },
  },
  tasks: [
    {
      id: 'investment',
      kind: 'formula',
      cells: 'B9:F9',
      prompt: 'In B9 compute the investment in culinary arts (trainees x course fee) and fill it right to F9.',
      solution: '=B4*B5',
      hints: ['Investment = trainees funded x course fee per trainee.', 'Each programme reads its own column, so no $ signs are needed.'],
      explain: '=B4*B5 = $272,000 for culinary arts. Locking the fee as $B$5 would charge every programme the culinary fee once filled right.',
      wrong: ['=B4*$B$5', '=B5'],
    },
    {
      id: 'repayment',
      kind: 'formula',
      cells: 'B10:F10',
      prompt: 'In B10 compute the expected repayment for culinary arts, counting only the trainees who do repay, and fill it right to F10.',
      solution: '=(1-B7)*B4*B6',
      hints: [
        'A trainee repays with probability 1 - the default probability.',
        'Expected repayment = (1 - default probability) x trainees x repayment per graduate.',
      ],
      explain:
        '=(1-B7)*B4*B6 = 0.91 x 40 x $8,300 = $302,120. It is an expected value: on average 91% of the culinary trainees repay. Multiplying by the ' +
        'default probability itself gives the expected loss, not the repayment.',
      wrong: ['=B7*B4*B6', '=B4*B6', '=(1-B7)*B6'],
    },
    {
      id: 'margin',
      kind: 'formula',
      cells: 'B11:F12',
      prompt: "In B11:F12 compute each programme's expected margin (expected repayment - investment) and expected margin % (margin / investment).",
      solutions: perColumn('B', 'F', { 11: (c) => `=${c}10-${c}9`, 12: (c) => `=${c}11/${c}9` }),
      hints: ['Margin = expected repayment - investment.', 'Margin % divides by the investment, not by the repayment.', 'Write B11 and B12, then fill right.'],
      explain:
        'Culinary arts: $30,120 on $272,000, an 11.1% margin; aircraft maintenance: $47,592 on $222,000, 21.4%. Margin is in dollars and margin % is a ' +
        'ratio: row 12 has a percentage format, so the stored 0.111 shows as 11.1%. Do not multiply by 100 yourself.',
      wrong: ['=B9-B10', '=B10/B9'],
    },
    {
      id: 'totals',
      kind: 'formula',
      cells: 'G9:G11',
      prompt: 'In G9 total the investment over the five programmes, and fill it down to G11 for the expected repayment and the expected margin.',
      solution: '=SUM(B9:F9)',
      hints: ['`SUM` across the five programme columns.', 'One formula in G9 fills down to G11.'],
      explain:
        'Investment $1,187,800, expected repayment $1,368,506, expected margin $180,706. Summing the margin row gives the same total as repayment minus investment.',
      wrong: ['=SUM(B9:E9)', '=B9+C9+D9+E9'],
    },
    {
      id: 'overall',
      kind: 'formula',
      cells: 'G12',
      prompt: "In G12 compute the whole plan's expected margin %.",
      solution: '=G11/G9',
      hints: ["A percentage for the whole plan comes from the plan's totals.", 'Averaging the five percentages ignores that the programmes have different sizes.'],
      explain:
        '=G11/G9 = 15.2%. The simple average of the five margin % is 15.5%: wrong, because it gives the small electrical programme as much weight as data ' +
        'analytics. Ratios for a whole plan come from its totals.',
      wrong: ['=AVERAGE(B12:F12)', '=G11/G10'],
    },
    {
      id: 'share',
      kind: 'formula',
      cells: 'B13:F13',
      prompt:
        "In B13 compute culinary arts' share of the whole plan's investment (its investment divided by the plan total in G9), as one formula that " +
        'fills right to F13.',
      solution: '=B9/$G$9',
      hints: [
        "Share = the programme's investment / the plan's total investment.",
        'Filled right, B9 must move on to C9, D9 ... while the total stays in G9: press F4 on the G9 reference.',
        'Check: the five shares add up to 100%.',
      ],
      explain:
        "=B9/$G$9: culinary arts takes 22.9% of the plan's money and data analytics the most, 28.3%. Without the $ the copy in C13 divides by H9, an " +
        'empty cell, and shows #DIV/0!. $G9 also works here, because filling right never changes the row.',
      wrong: ['=B9/G9', '=B9/SUM(B9:F9)', '=B9/$G$10'],
    },
    {
      id: 'leaders',
      kind: 'value',
      cells: 'B14:B15',
      prompt:
        'Type into B14 the programme with the highest expected margin in dollars, and into B15 the programme with the highest expected margin %, exactly as ' +
        'named in row 3.',
      answer: { B14: 'Data analytics', B15: 'Aircraft maintenance' },
      hints: ['Compare row 11 for dollars and row 12 for percentages.', 'The two answers are different programmes.'],
      explain: 'Data analytics earns the most dollars ($49,440); aircraft maintenance earns the most per dollar invested (21.4%).',
      wrong: ['Aircraft maintenance', 'Culinary arts'],
    },
    {
      id: 'measure',
      kind: 'explain',
      cells: '',
      prompt: 'Why do the two rankings differ, and what must the board decide before using this model to choose which programmes to grow?',
      answer:
        'Dollar margin rewards size: data analytics funds 30 trainees at $11,200 each (28% of the money), so even a 14.7% margin earns $49,440. ' +
        'Margin % rewards efficiency: ' +
        'aircraft maintenance earns 21.4% because each graduate repays $23,900 against an $18,500 fee and only 6% fail to repay, but only 12 trainees are ' +
        'funded. The board must first choose its performance measure: total expected margin (grow the big programmes) or return per dollar invested (grow ' +
        'aircraft maintenance, if places and money allow). The whole plan earns 15.2% on $1.19 million.',
      hints: ['Margin $ = margin % x investment: which factor drives each winner?', 'A model is optimised for one performance measure at a time.'],
      explain:
        'Choosing the performance measure is a modelling decision made before any formula: it decides which output you maximise with Solver or compare in ' +
        'a Data Table.',
    },
  ],
  // each case moves every answer: trainee numbers alone would leave the margin % row unchanged, rates alone the investment row
  testCases: [
    {
      name: 'Board funds 35, 15, 36, 20 and 24 trainees and every course fee rises $200',
      inputs: { B4: 35, C4: 15, D4: 36, E4: 20, F4: 24, B5: 7000, C5: 18700, D5: 11400, E5: 7600, F5: 9800 },
    },
    {
      name: 'Default probabilities revised to 11%, 8%, 9%, 5% and 10%, with 5 more trainees in each programme',
      inputs: { B7: 0.11, C7: 0.08, D7: 0.09, E7: 0.05, F7: 0.1, B4: 45, C4: 17, D4: 35, E4: 30, F4: 23 },
    },
    {
      name: 'Repayments revised to $8,600, $23,000, $15,000, $9,000 and $11,800 and every course fee cut by $300',
      inputs: { B6: 8600, C6: 23000, D6: 15000, E6: 9000, F6: 11800, B5: 6500, C5: 18200, D5: 10900, E5: 7100, F5: 9300 },
    },
  ],
  skills: [
    'expected value with a default probability',
    'margin and margin %',
    'totals and overall ratio',
    'share of a total with an anchored reference',
    'choosing a performance measure',
  ],
  techniques: ['Absolute/mixed references so formulas fill down/right', 'Written interpretation of model results'],
}

// ---------- level 3: exam-style ----------

const instantCamera: Exercise = {
  id: 'w2-exam-instant-camera',
  week: 'W2',
  topic: 'Exam-style pricing model',
  title: 'Exam-style: price an instant camera and its film',
  level: 3,
  minutes: 30,
  scenario:
    'A Singapore start-up is launching an instant camera whose film packs only it can supply, and it prices a film pack at 15% of the camera price. ' +
    'Camera demand (thousands a year) falls linearly with the camera price, and every camera owner buys 10 film packs a year. Cameras cost $110 to make, ' +
    'film packs $5.20, and fixed costs are $640 thousand a year. Management plans to launch at $150, but first wants the break-even prices, the ' +
    'profit-maximising price and a sensitivity study.',
  sheet: {
    name: 'Camera',
    rows: 30,
    cols: 8,
    colWidths: { A: 250, B: 132, C: 132, D: 132, E: 132, F: 132, G: 132, H: 136 },
    cells: {
      A1: title('Instant camera and film packs: launch pricing model'),
      A2: note('Quantities in thousands a year, money in $ thousands (unit prices in $). Answer in the yellow cells.'),
      A4: header('Trade-off analysis'),
      ...across(4, 'B', ['Lower break-even', 'Trial', 'Trial', 'Launch plan', 'Best price', 'Trial', 'Upper break-even'].map((h) => header(h))),
      A5: label('Camera price ($)'),
      ...across(5, 'B', [90, 110, 130, 150, 160, 190, 230].map((v) => input(v, MONEY))),
      B5: input(90, MONEY, 'Goal Seek starts here for the lower break-even'),
      F5: input(160, MONEY, 'Solver starts here'),
      H5: input(230, MONEY, 'Goal Seek starts here for the upper break-even'),
      A6: label('Film pack price ($)'),
      ...block('B', 'H', 6, 6, ans(MONEY)),
      A8: header('Parameters'),
      A9: label('Camera unit cost ($)'),
      B9: input(110, MONEY),
      A10: label('Film pack unit cost ($)'),
      B10: input(5.2, MONEY),
      A11: label('Fixed cost ($ thousands)'),
      B11: input(640, INT),
      A12: label('Film pack price / camera price'),
      B12: input(0.15, '0%'),
      A13: label('Film packs per camera per year'),
      B13: input(10, '0'),
      A14: label('Demand intercept (thousands)'),
      B14: input(58, '0.0'),
      A15: label('Demand slope (thousands per $1)'),
      B15: input(-0.24, '0.00'),
      A16: header('Results'),
      A17: label('Camera demand (thousands)'),
      A18: label('Film pack demand (thousands)'),
      ...block('B', 'H', 17, 18, ans('#,##0.00')),
      A19: label('Revenue ($ thousands)'),
      A20: label('Total cost ($ thousands)'),
      A21: label('Profit ($ thousands)'),
      ...block('B', 'H', 19, 21, ans('#,##0.0')),
      A23: title('Sensitivity: profit of the $150 launch plan ($ thousands)'),
      A25: label('Film packs ↓  slope →'),
      B25: ans('#,##0.0'),
      ...across(25, 'C', [-0.32, -0.28, -0.24, -0.2, -0.16].map((v) => axis(v, '0.00'))),
      ...down('B', 26, [6, 8, 10, 12, 14].map((v) => axis(v, '0'))),
      ...block('C', 'G', 26, 30, ans('#,##0.0')),
    },
  },
  tasks: [
    {
      id: 'film',
      kind: 'formula',
      cells: 'B6:H6',
      prompt: '(a) In B6 compute the film pack price for the camera price in B5, and fill it right to H6.',
      solution: '=$B$12*B5',
      hints: ['Film pack price = ratio x camera price.', 'Every column reads the same ratio in B12.'],
      explain:
        '=$B$12*B5: $13.50 for a $90 camera and $22.50 at the $150 launch price. Tying the film price to the camera price leaves a single decision, so the ' +
        'whole model becomes a function of the camera price.',
      wrong: ['=B12*B5', '=$B$12/B5', '=$B$12*$B$5'],
    },
    {
      id: 'demand',
      kind: 'formula',
      cells: 'B17:H18',
      prompt: '(b) In B17:H18 compute, for every price column, the camera demand (intercept + slope x camera price) and the film pack demand.',
      solutions: perColumn('B', 'H', { 17: (c) => `=$B$14+$B$15*${c}5`, 18: (c) => `=$B$13*${c}17` }),
      hints: ['Camera demand uses the intercept and slope in B14:B15: lock them before filling right.', 'Film pack demand = packs per camera x camera demand.'],
      explain: 'At the $150 launch price: 58 - 0.24 x 150 = 22 thousand cameras and 220 thousand film packs a year.',
      wrong: ['=$B$14-$B$15*B5', '=$B$14+$B$15*B6'],
    },
    {
      id: 'money',
      kind: 'formula',
      cells: 'B19:H21',
      prompt: '(c) In B19:H21 compute the revenue, total cost and profit ($ thousands) for every price column.',
      solutions: perColumn('B', 'H', {
        19: (c) => `=${c}5*${c}17+${c}6*${c}18`,
        20: (c) => `=$B$9*${c}17+$B$10*${c}18+$B$11`,
        21: (c) => `=${c}19-${c}20`,
      }),
      hints: [
        'Revenue = camera price x camera demand + film price x film demand.',
        'Total cost = unit cost x quantity for each product + the fixed cost.',
        'Profit = revenue - total cost.',
      ],
      explain:
        'At $150: revenue $8,250k, total cost $4,204k, profit $4,046k. Profit = (58 - 0.24P)(2.5P - 162) - 640 is a quadratic in the camera price P, so it ' +
        'has two break-even prices and one peak.',
      wrong: ['=B5*B17', '=B5*B17+B6*B17'],
    },
    {
      id: 'lower',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'B5',
      prompt: '(d) Starting from the $90 in B5, use Goal Seek to find the lower break-even price: set B21 to 0 by changing B5.',
      toolSetup: { setCell: 'B21', toValue: 0, changingCell: 'B5' },
      answer: { B5: 71.05190125906381 },
      check: { tol: 0.01 },
      hints: [
        'Profit is a parabola in the camera price, so it crosses 0 twice: Goal Seek usually stops at the crossing nearest its starting value.',
        'Goal Seek: Set cell B21, To value 0, By changing cell B5 (still holding the low starting price of $90).',
      ],
      explain:
        'About $71.05: below the $110 cost of a camera, yet the film packs still cover the loss on each camera: the bait-and-hook effect. Started from a high ' +
        'price, Goal Seek would have found the other break-even.',
      wrong: ['90', '110'],
    },
    {
      id: 'best',
      kind: 'tool',
      tool: 'solver',
      cells: 'F5',
      prompt: '(e) Use Solver to find the profit-maximising camera price in column F: maximise F21 by changing F5 (GRG Nonlinear).',
      toolSetup: { objective: 'F21', sense: 'max', changing: 'F5', constraints: [], nonNegative: true, engine: 'grg' },
      answer: { F5: 153.23333333333335, F21: 4052.272666666667 },
      check: { tol: 0.01 },
      hints: ['Set Objective F21, To Max, By Changing Variable Cells F5.', 'Profit is a curve in the price: choose GRG Nonlinear.'],
      explain:
        'About $153.23, with a profit of $4,052.27 thousand: the top of the parabola, halfway between the two break-even prices, (71.05 + 235.41) / 2. The ' +
        '$150 launch plan earns only about $6 thousand less.',
      wrong: ['150', '160'],
    },
    {
      id: 'upper',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'H5',
      prompt: '(f) Starting from the $230 in H5, use Goal Seek to find the upper break-even price: set H21 to 0 by changing H5.',
      toolSetup: { setCell: 'H21', toValue: 0, changingCell: 'H5' },
      answer: { H5: 235.41476540760286 },
      check: { tol: 0.01 },
      hints: ['The same Goal Seek set-up on column H.', 'A high starting value leads Goal Seek to the upper break-even.'],
      explain:
        'About $235.41: at that price only about 1,500 cameras a year sell, and the margin on them and their film only just covers the $640 thousand ' +
        'fixed cost. The trade-off ' +
        'row now reads 71.05, 110, 130, 150, 153.23, 190 and 235.41, with profit rising to the peak and falling back to 0.',
      wrong: ['230', '240'],
    },
    {
      id: 'corner',
      kind: 'formula',
      cells: 'B25',
      prompt:
        '(g) The sensitivity table B25:G30 tabulates the profit of the $150 launch plan (column E) for demand slopes across row 25 and film packs per camera ' +
        'down column B. In B25 link to that profit.',
      solution: '=E21',
      hints: ['The corner of a two-way Data Table holds the one output it tabulates.', 'The launch plan is column E.'],
      explain: '=E21 ($4,046k). Linking to F21 would tabulate the Solver column instead, a price the company is not launching at.',
      wrong: ['=F21', '=E19'],
    },
    {
      id: 'sensitivity',
      kind: 'tool',
      tool: 'datatable',
      cells: 'C26:G30',
      prompt: '(h) Run a two-variable Data Table on B25:G30 with B15 (demand slope) as the row input cell and B13 (film packs per camera) as the column input cell.',
      toolSetup: { range: 'B25:G30', rowInput: 'B15', colInput: 'B13' },
      answer: { C26: 798, G26: 4249.2, E28: 4046, C30: 2182, G30: 8954.8 },
      check: { tol: 0.005 },
      hints: ['Select the whole block B25:G30 first.', 'Slopes run across the top row (row input B15); packs run down the left column (column input B13).'],
      explain:
        'The base case comes back at E28 (slope -0.24, 10 packs): $4,046k. Even the worst corner (slope -0.32, 6 packs) still makes $798k. Select the ' +
        'corner formula, the row and the column of inputs and the empty body together: a selection without the corner has nothing to tabulate.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt:
        '(i) In three or four sentences, advise management: over what price range does the camera make money, how good is the $150 plan, and which ' +
        'assumption should be checked hardest before launch?',
      answer:
        'The camera is profitable between about $71.05 and $235.41; profit peaks at $153.23 ($4.05 million a year), and the $150 launch plan is within about ' +
        '$6 thousand of that peak, so it is a sound, rounder price. The lower break-even sits below the $110 camera cost because the film packs carry the ' +
        'margin. The sensitivity table shows profit is far more sensitive to the demand slope when owners buy more film packs: across the slopes it swings by ' +
        'about $3.45 million at 6 packs a year but $6.77 million at 14. Management should validate the demand slope (and film usage) most carefully; even the ' +
        'worst combination tested still earns about $0.8 million.',
      hints: ['Use the trade-off row for the range and the peak.', 'Compare the spread across one row of the table at 6 packs and at 14 packs.'],
      explain:
        'Marks go to the numbers and to the reasoning: quote the break-evens and the optimum from your cells, separate decisions (trade-off) from parameters ' +
        '(sensitivity), and end with a recommendation.',
    },
  ],
  // every case changes the film ratio (B6:H6 depend on nothing else outside the price row) and the demand line, so all answers move.
  // demand must stay >= 0 at the upper break-even price kept in H5 (235.41): intercept up or slope flatter, never the reverse
  testCases: [
    { name: 'Camera cost $118, demand intercept 60 thousand and film packs at 18% of the camera price', inputs: { B9: 118, B14: 60, B12: 0.18 } },
    { name: 'Owners buy 12 film packs a year, the slope is -0.22 and film packs cost 14% of the camera price', inputs: { B13: 12, B15: -0.22, B12: 0.14 } },
    {
      name: 'Film packs cost $6.00 to make, fixed cost $700 thousand, intercept 62 thousand and film at 16%',
      inputs: { B10: 6, B11: 700, B14: 62, B12: 0.16 },
    },
    { name: 'Trial prices $100, $120, $140 and $180, film at 17% and a slope of -0.23', inputs: { C5: 100, D5: 120, E5: 140, G5: 180, B12: 0.17, B15: -0.23 } },
  ],
  skills: ['trade-off row of model columns', 'linked consumable pricing', 'Goal Seek from different starting values', 'Solver GRG', 'two-variable Data Table', 'management recommendation'],
  techniques: [
    'Goal Seek',
    'Solver optimisation (objective, changing cells, constraints)',
    'What-if / scenario analysis by changing inputs',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

const DIPLOMAS = ['Engineering', 'Nursing', 'Business', 'Media design']

const incomeShareFund: Exercise = {
  id: 'w2-exam-income-share-fund',
  week: 'W2',
  topic: 'Exam-style investment evaluation',
  title: 'Exam-style: set the income share for a graduate fund',
  level: 3,
  minutes: 25,
  scenario:
    'A Singapore foundation sponsors polytechnic students from low-income families in four diploma programmes. Instead of a bursary, each graduate pays ' +
    'back a share of salary for five years, but some graduates never repay (the default probability). The foundation must decide what income share ' +
    'to ask for: at least enough for an overall expected margin of 10% on the money it puts in.',
  sheet: {
    name: 'Fund',
    rows: 28,
    cols: 6,
    colWidths: { A: 260, B: 120, C: 120, D: 120, E: 120, F: 130 },
    cells: {
      A1: title('Graduate income-share fund: evaluation'),
      A2: note('All money in $. Answer in the yellow cells.'),
      A3: header('Plan settings'),
      A4: label('Income share of salary'),
      B4: input(0.1, '0.00%', 'Decision: Goal Seek changes this cell'),
      A5: label('Repayment years'),
      B5: input(5, '0'),
      A7: header('Programme'),
      ...across(7, 'B', DIPLOMAS.map((d) => header(d))),
      F7: header('Whole fund'),
      A8: label('Students sponsored'),
      ...across(8, 'B', [24, 18, 30, 12].map((v) => input(v, INT))),
      A9: label('Sponsorship per student ($)'),
      ...across(9, 'B', [21000, 17500, 15000, 19000].map((v) => input(v, MONEY0))),
      A10: label('Starting salary per year ($)'),
      ...across(10, 'B', [46000, 41000, 38000, 35000].map((v) => input(v, MONEY0))),
      A11: label('Default probability'),
      ...across(11, 'B', [0.08, 0.04, 0.1, 0.15].map((v) => input(v, '0%'))),
      A13: label('Expected repayment per student ($)'),
      ...block('B', 'E', 13, 13, ans(MONEY0)),
      A14: label('Investment ($)'),
      A15: label('Expected repayment ($)'),
      A16: label('Expected margin ($)'),
      ...block('B', 'F', 14, 16, ans(MONEY0)),
      A17: label('Expected margin %'),
      ...block('B', 'F', 17, 17, ans(PCT)),
      A19: title('Data Table: each income share is fed into B4'),
      ...across(20, 'B', [header('Income share'), header('Total margin ($)'), header('Margin %')]),
      C21: calc('=F16', MONEY0),
      D21: calc('=F17', PCT),
      ...down('B', 22, [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14].map((v) => axis(v, '0%'))),
      ...block('C', 'C', 22, 28, ans(MONEY0)),
      ...block('D', 'D', 22, 28, ans(PCT)),
    },
  },
  tasks: [
    {
      id: 'per-student',
      kind: 'formula',
      cells: 'B13:E13',
      prompt:
        '(a) In B13 compute the expected repayment per Engineering student: a graduate pays the income share of the starting salary for each repayment ' +
        'year, and only graduates who repay count. Fill it right to E13.',
      solution: '=(1-B11)*B10*$B$4*$B$5',
      hints: [
        'Expected value = probability of repaying x amount repaid.',
        'The income share and the repayment years sit in single cells (B4, B5): lock them before filling right.',
        'Per student: (1 - default probability) x starting salary x income share x repayment years.',
      ],
      explain:
        '=(1-B11)*B10*$B$4*$B$5. At a 10% share an Engineering graduate repays 46,000 x 10% x 5 = $23,000, and 92% of them do: $21,160 expected per student.',
      wrong: ['=(1-B11)*B10*B4*B5', '=B11*B10*$B$4*$B$5', '=(1-B11)*B10*$B$4'],
    },
    {
      id: 'programmes',
      kind: 'formula',
      cells: 'B14:E15',
      prompt: "(b) In B14:E15 compute each programme's investment (students x sponsorship) and expected repayment (students x expected repayment per student).",
      solutions: perColumn('B', 'E', { 14: (c) => `=${c}8*${c}9`, 15: (c) => `=${c}8*${c}13` }),
      hints: ['Investment = students sponsored x sponsorship per student.', 'Expected repayment = students x the per-student value in row 13.'],
      explain: 'At a 10% share Engineering costs $504,000 and is expected to repay $507,840.',
      wrong: ['=B9', '=B8*B10'],
    },
    {
      id: 'margins',
      kind: 'formula',
      cells: 'B16:E17',
      prompt: "(c) In B16:E17 compute each programme's expected margin and expected margin %.",
      solutions: perColumn('B', 'E', { 16: (c) => `=${c}15-${c}14`, 17: (c) => `=${c}16/${c}14` }),
      hints: ['Margin = expected repayment - investment; margin % = margin / investment.', 'Write B16 and B17, then fill right to column E.'],
      explain: 'At a 10% share media design loses $49,500 (-21.7%) while business earns $63,000 (14.0%).',
      wrong: ['=B14-B15', '=B15/B14'],
    },
    {
      id: 'totals',
      kind: 'formula',
      cells: 'F14:F15',
      prompt:
        "(d) In F14 and F15 compute the fund's total investment and total expected repayment with `SUMPRODUCT`, straight from the students and the " +
        'per-student figures.',
      solutions: { F14: '=SUMPRODUCT(B8:E8,B9:E9)', F15: '=SUMPRODUCT(B8:E8,B13:E13)' },
      check: { mustUse: ['SUMPRODUCT'] },
      hints: ['`SUMPRODUCT` multiplies two rows item by item and adds the products.', 'Investment pairs students with sponsorship; repayment pairs students with row 13.'],
      explain:
        "=SUMPRODUCT(B8:E8,B9:E9) = $1,497,000 and =SUMPRODUCT(B8:E8,B13:E13). Multiplying SUM(B8:E8) by SUM(B9:E9) instead would pair every programme's " +
        "students with every other programme's sponsorship.",
      wrong: ['=SUMPRODUCT(B8:E8,B10:E10)', '=SUM(B8:E8)*SUM(B9:E9)'],
    },
    {
      id: 'margin-total',
      kind: 'formula',
      cells: 'F16',
      prompt: "(e) In F16 compute the fund's total expected margin.",
      solution: '=F15-F14',
      hints: ['Total margin = total expected repayment - total investment.', 'Both totals are already in F14 and F15.'],
      explain: '=F15-F14: only $56,580 at a 10% share. Summing B16:E16 gives the same number, as long as the range covers all four programmes.',
      wrong: ['=F14-F15', '=SUM(B16:D16)'],
    },
    {
      id: 'overall',
      kind: 'formula',
      cells: 'F17',
      prompt: "(f) In F17 compute the fund's overall expected margin %.",
      solution: '=F16/F14',
      hints: ['Ratios for the whole fund come from its totals.', 'Divide the total margin by the total investment, as each programme does in row 17.'],
      explain:
        "=F16/F14 = 3.8% at a 10% share. The plain average of the four programme percentages is a different number because it ignores the programmes' sizes.",
      wrong: ['=AVERAGE(B17:E17)', '=F16/F15'],
    },
    {
      id: 'share',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'B4',
      prompt: '(g) Use Goal Seek to find the income share that gives an overall expected margin of 10%: set F17 to 0.1 by changing B4.',
      toolSetup: { setCell: 'F17', toValue: 0.1, changingCell: 'B4' },
      answer: { B4: 0.1059938979647009 },
      check: { tol: 0.0001 },
      hints: ['To value is 0.1 (10% as a decimal), not 10.', 'The changing cell is the income share in B4.'],
      explain:
        'About 10.60% of salary. Each percentage point of share adds about $155,000 of expected repayment, so the fund needs 0.6 of a point more than the ' +
        '10% it started with.',
      wrong: ['0.1', '0.12'],
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'C22:D28',
      prompt:
        '(h) The Data Table frame B21:D28 lists income shares from 8% to 14% down column B and links to the total margin (C21) and the margin % (D21). ' +
        'Run What-If Analysis › Data Table on it with B4 as the column input cell.',
      toolSetup: { range: 'B21:D28', colInput: 'B4' },
      answer: { C22: -254136, D22: -0.16976352705410822, C24: 56580, D24: 0.03779559118236473, C28: 678012, D28: 0.45291382765531063 },
      check: { tol: 0.0001 },
      hints: ['Select B21:D28: the shares, the two links and the empty result cells.', 'The shares run down a column, so B4 is the Column input cell.'],
      explain:
        "The fund's margin turns positive between a 9% share (-6.6%) and 10% (+3.8%): it breaks even at about 9.64%. Each extra point of share adds about " +
        '$155,000. The column input cell must be the model\'s share cell B4, not one of the shares inside the table.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt:
        '(i) Advise the foundation: what income share should it ask for, which programme is the problem, and what could it do instead of raising the share ' +
        'for every graduate?',
      answer:
        'To earn a 10% overall expected margin the foundation must ask for about 10.60% of salary for five years (it breaks even at about 9.64%). Media design ' +
        'is the problem: its graduates earn the least and 15% never repay, so it only breaks even at a share of about 12.8% and still loses about 17% at 10.60%, ' +
        'while business (20.8%) and nursing (19.2%) carry the fund. Instead of raising the share for everyone, the foundation could sponsor fewer media design ' +
        'students, lower their sponsorship, or set a programme-specific share for media design. It should also test how sensitive the result is to the ' +
        'default probabilities, which are uncertain parameters.',
      hints: ['Use the Goal Seek answer and the Data Table.', 'Look at row 17: which programme pulls the total down?'],
      explain: 'A good recommendation names the decision (the share), quotes the numbers, points to the weak spot and offers a targeted alternative.',
    },
  ],
  // each case changes something in every programme column for both the per-student repayment and the investment, so all answers move
  testCases: [
    { name: 'Graduates repay for 4 years, with 26, 20, 28 and 14 students', inputs: { B5: 4, B8: 26, C8: 20, D8: 28, E8: 14 } },
    {
      name: 'Sponsorship costs rise 5% and default probabilities rise to 9%, 6%, 12% and 18%',
      inputs: { B9: 22050, C9: 18375, D9: 15750, E9: 19950, B11: 0.09, C11: 0.06, D11: 0.12, E11: 0.18 },
    },
    {
      name: 'Starting salaries of $48,000, $42,500, $39,500 and $36,000, and sponsorship $500 lower per student',
      inputs: { B10: 48000, C10: 42500, D10: 39500, E10: 36000, B9: 20500, C9: 17000, D9: 14500, E9: 18500 },
    },
  ],
  skills: ['expected repayment with a default probability', 'SUMPRODUCT totals', 'overall vs average margin', 'Goal Seek on a decision rate', 'one-variable Data Table', 'recommendation'],
  techniques: [
    'SUMPRODUCT totals and weighted/expected values',
    'Goal Seek',
    'What-if / scenario analysis by changing inputs',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

export const exercises: readonly Exercise[] = [
  croissantStall,
  bakingClass,
  teaGrid,
  bentoContract,
  earbuds,
  purifier,
  escapeRoom,
  rooftopCinema,
  scooterShare,
  trainingFund,
  instantCamera,
  incomeShareFund,
]
