import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 4 financial functions and modelling: PMT, PV, FV, RATE, NPER (signs, periodic rate, type), NPV and IRR on uneven
// cash flows (yearly, and monthly with a month-0 payment), the course's no-function checks (residue-loan schedule with Goal
// Seek, FV schedule with MATCH type 1, manual PV with Goal Seek for IRR), Goal Seek and Data Tables on financial models,
// circular references with iterative calculation, NORMDIST/NORMSDIST, and an option-pricing model with LN, EXP, SQRT and
// NORMSDIST. Every scenario, business, person and number is original and fictional.

const MONEY = '$#,##0.00'
const MONEY0 = '$#,##0'
const PCT = '0.00%'
const PCT1 = '0.0%'
const PCT0 = '0%'
const DEC4 = '0.0000'

const header = (v: string): CellSpec => ({ v, role: 'header', bold: true })
const title = header
const label = (v: string): CellSpec => ({ v, role: 'label' })
const input = (v: CellValue, fmt?: string, note?: string): CellSpec => ({ v, role: 'input', ...(fmt ? { fmt } : {}), ...(note ? { note } : {}) })
const given = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'given', ...(fmt ? { fmt } : {}) })
const givenF = (f: string, fmt?: string, note?: string): CellSpec => ({ f, role: 'given', ...(fmt ? { fmt } : {}), ...(note ? { note } : {}) })
const answer = (fmt?: string, note?: string): CellSpec => ({ role: 'answer', ...(fmt ? { fmt } : {}), ...(note ? { note } : {}) })

// a column of values from row `firstRow` down (e.g. years 0..6 in A12:A18)
function column(col: string, firstRow: number, values: CellValue[], fmt = '0', role: 'given' | 'input' = 'given', align?: CellSpec['align']): Record<string, CellSpec> {
  const out: Record<string, CellSpec> = {}
  values.forEach((v, i) => { out[`${col}${firstRow + i}`] = { v, role, fmt, ...(align ? { align } : {}) } })
  return out
}

// a block of empty answer cells over rows r1..r2 of the given columns
function answers(cols: string[], r1: number, r2: number, fmt?: string): Record<string, CellSpec> {
  const out: Record<string, CellSpec> = {}
  for (let r = r1; r <= r2; r++) for (const c of cols) out[`${c}${r}`] = answer(fmt)
  return out
}

// ---------- level 1 drills ----------

const pmtDrill: Exercise = {
  id: 'w4-pmt-oven-loan',
  week: 'W4',
  topic: 'PMT',
  title: 'Instalments on a bakery oven loan',
  level: 1,
  minutes: 5,
  scenario:
    'Crumb & Co., a small bakery in Tiong Bahru, is buying a $68,000 deck oven with a bank loan at 5.4% a year, repaid monthly over 4 years. ' +
    'Before signing, the owner wants to check the bank\'s quote and two variations it offers: leaving an $8,000 balloon due at the end of the 4 years, ' +
    'and paying every instalment at the start of the month. Take the bakery as the point of reference: the loan comes in (+), the instalments go out (-).',
  sheet: {
    rows: 12,
    cols: 2,
    colWidths: { A: 360, B: 130 },
    cells: {
      A1: title('Deck oven loan'),
      A3: label('Loan amount'), B3: input(68000, MONEY0),
      A4: label('Interest rate (per year)'), B4: input(0.054, PCT),
      A5: label('Term (years)'), B5: input(4, '0'),
      A6: label('Balloon due at the end of the term'), B6: input(8000, MONEY0),
      A8: header('Monthly instalment'), B8: header('Amount'),
      A9: label('Standard loan, paid at the end of each month'), B9: answer(MONEY),
      A10: label('With the balloon, paid at the end of each month'), B10: answer(MONEY),
      A11: label('With the balloon, paid at the start of each month'), B11: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'standard',
      kind: 'formula',
      cells: 'B9',
      prompt:
        'In B9 work out the monthly instalment with `PMT`. The rate is per year and the term is in years, but the bakery pays every month. ' +
        'Keep Excel\'s sign: the instalment leaves the bakery, so it shows as a negative amount.',
      solution: '=PMT(B4/12,B5*12,B3)',
      check: { mustUse: ['PMT'] },
      wrong: ['=PMT(B4,B5,B3)', '=PMT(B4/12,B5,B3)', '=PMT(B4,B5*12,B3)', '=PMT(B4/12,B5*12,-B3)', '=PMT(B4/12,B5*12,B3,0,1)'],
      hints: [
        '`PMT(rate, nper, pv)`: rate and nper must be in the same unit as the payment, here months.',
        'Monthly rate = yearly rate / 12; number of payments = years x 12.',
        'The loan is money the bakery receives, so pv is +B3 and the instalment comes out negative.',
      ],
      explain:
        '=PMT(B4/12,B5*12,B3) gives -$1,578.34. PMT needs the rate per period and the number of periods in the same unit as the payment: ' +
        '5.4% with 48 periods would charge a full year of interest every month, and 4 periods would repay the oven in 4 months. ' +
        'The minus sign is the convention: the loan comes in (+), so the instalments go out (-).',
    },
    {
      id: 'balloon',
      kind: 'formula',
      cells: 'B10',
      prompt:
        'In B10 the bank lets the bakery leave $8,000 (B6) as a balloon, due at the end of the term (here together with the last instalment). ' +
        'Give it to `PMT` as the future value (fv). The balloon also leaves the bakery: think about its sign.',
      solution: '=PMT(B4/12,B5*12,B3,-B6)',
      check: { mustUse: ['PMT'] },
      wrong: ['=PMT(B4/12,B5*12,B3,B6)', '=PMT(B4/12,B5*12,B3-B6)', '=PMT(B4/12,B5*12,B3)'],
      hints: [
        '`PMT(rate, nper, pv, [fv])`: fv is the amount still to settle after the last period.',
        'The balloon is paid out by the bakery, like the instalments, so it is negative: -B6.',
        'Do not subtract the balloon from the loan amount: it is paid in 4 years, not today.',
      ],
      explain:
        'With fv = -B6 the instalment drops to -$1,428.66 because $8,000 of the loan is cleared in month 48 instead of month by month. ' +
        'PMT(B4/12,B5*12,B3-B6) treats the $8,000 as if it were repaid today and ignores 4 years of interest on it. ' +
        'A positive fv would mean the bank pays the bakery $8,000 at the end, which makes the instalment bigger, not smaller.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'B11',
      prompt:
        'In B11: the same balloon loan, but every instalment is paid at the start of the month. The balloon is still due at the end of the term, ' +
        'one month after the last instalment. Use the `type` argument of `PMT`.',
      solution: '=PMT(B4/12,B5*12,B3,-B6,1)',
      check: { mustUse: ['PMT'] },
      wrong: ['=PMT(B4/12,B5*12,B3,-B6,0)', '=PMT(B4/12,B5*12,B3,B6,1)', '=PMT(B4/12,B5*12,B3,0,1)'],
      hints: [
        '`type` is the 5th argument: 0 or left out = end of period, 1 = start of period.',
        'Keep the balloon as the 4th argument and add 1 after it.',
      ],
      explain:
        'Paid at the start of each month, every instalment reaches the bank a month earlier and so repays a month\'s interest more, and a smaller instalment clears the same loan: ' +
        'B10 / (1 + 5.4%/12) = -$1,422.26. The balloon is still due at the end of the term: type only moves the regular payments.',
    },
  ],
  testCases: [
    { name: 'Rate rises to 6.2%', inputs: { B4: 0.062 } },
    { name: 'Six-year term with a $12,000 balloon', inputs: { B5: 6, B6: 12000 } },
    { name: 'Bigger oven: a $75,500 loan', inputs: { B3: 75500 } },
  ],
  skills: ['PMT', 'monthly rate and number of months', 'sign convention', 'balloon payment (fv)', 'type argument (start of period)'],
}

const pvFvDrill: Exercise = {
  id: 'w4-fv-pv-sabbatical',
  week: 'W4',
  topic: 'FV and PV',
  title: 'Saving for a sabbatical, then spending it',
  level: 1,
  minutes: 8,
  scenario:
    'Arjun, a polytechnic lecturer, plans a 10-month sabbatical in 30 months\' time. Until then he deposits $750 at the start of every month into an account paying 2.6% a year ' +
    '(compounded monthly) that already holds $5,000. During the sabbatical he will withdraw $2,800 at the start of each month and pay a $1,800 course fee at the end. ' +
    'Excel only needs money in and money out to carry opposite signs; each task says which way round to take them.',
  sheet: {
    rows: 13,
    cols: 2,
    colWidths: { A: 400, B: 130 },
    cells: {
      A1: title('Sabbatical fund'),
      A3: label('Interest rate (per year, compounded monthly)'), B3: input(0.026, PCT),
      A4: label('Months of saving before the sabbatical'), B4: input(30, '0'),
      A5: label('Deposit at the start of each month'), B5: input(750, MONEY0),
      A6: label('Already in the account today'), B6: input(5000, MONEY0),
      A7: label('Months of sabbatical'), B7: input(10, '0'),
      A8: label('Withdrawal at the start of each sabbatical month'), B8: input(2800, MONEY0),
      A9: label('Course fee paid at the end of the sabbatical'), B9: input(1800, MONEY0),
      A11: label('Balance when the sabbatical starts'), B11: answer(MONEY),
      A12: label('Balance needed when the sabbatical starts'), B12: answer(MONEY),
      A13: label('Single deposit today that grows to the balance needed'), B13: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'fv',
      kind: 'formula',
      cells: 'B11',
      prompt:
        'In B11 use `FV` for the balance when the sabbatical starts: B4 monthly deposits of B5, each at the start of the month, on top of the B6 already saved. ' +
        'From Arjun\'s point of view the deposits and the opening balance leave his pocket (negative), so the balance he will have comes out positive.',
      solution: '=FV(B3/12,B4,-B5,-B6,1)',
      check: { mustUse: ['FV'] },
      wrong: ['=FV(B3/12,B4,-B5,-B6)', '=FV(B3,B4,-B5,-B6,1)', '=FV(B3/12,B4,-B5,0,1)', '=FV(B3/12,B4,B5,B6,1)', '=FV(B3/12,B4,-B5,-5000,1)'],
      hints: [
        '`FV(rate, nper, pmt, [pv], [type])`: the monthly rate is B3/12 and B4 is already in months.',
        'pmt is the deposit (-B5) and pv the money already there (-B6).',
        'Deposits at the start of each month: type = 1.',
      ],
      explain:
        '=FV(B3/12,B4,-B5,-B6,1) = $28,607.11. Both the deposits and the $5,000 grow: the opening balance for 30 months, each deposit from the day it is made. ' +
        'With type 1 every deposit earns one more month of interest than with type 0. Leaving out pv forgets the $5,000 and its interest.',
    },
    {
      id: 'pv',
      kind: 'formula',
      cells: 'B12',
      prompt:
        'In B12 use `PV` for the balance needed on the first day of the sabbatical: B8 is withdrawn at the start of each of the B7 months and the course fee B9 is paid at the end of the last month, ' +
        'while the rest keeps earning interest. Enter the withdrawals and the fee as negative amounts (money taken out); the balance needed then comes out positive.',
      solution: '=PV(B3/12,B7,-B8,-B9,1)',
      check: { mustUse: ['PV'] },
      wrong: ['=PV(B3/12,B7,-B8,-B9)', '=PV(B3/12,B7,-B8,0,1)', '=PV(B3/12,B7,-B8,B9,1)', '=PV(B3,B7,-B8,-B9,1)', '=PV(B3/12,10,-B8,-B9,1)'],
      hints: [
        '`PV(rate, nper, pmt, [fv], [type])`: pmt is the regular withdrawal, fv the one-off amount at the very end.',
        'Withdrawals at the start of each month: type = 1. The fee is paid at the end of the last month, which is exactly where fv sits.',
        'Both are money taken out of the account, so both are negative: -B8 and -B9.',
      ],
      explain:
        '=PV(B3/12,B7,-B8,-B9,1) = $29,490.62. PV discounts each withdrawal back to the first day of the sabbatical; type 1 because the money is drawn at the start of each month, ' +
        'and the fee goes in the fv slot because it falls at the end. The plan in B11 falls about $884 short of this.',
    },
    {
      id: 'lump',
      kind: 'formula',
      cells: 'B13',
      prompt:
        'In B13: instead of the monthly plan, how much would Arjun have to deposit today, as one single amount, to have the balance in B12 when the sabbatical starts (B4 months from now)? ' +
        'Use `PV` with no regular payment. B12 is money he gets back later (positive), so the deposit today shows as negative.',
      solution: '=PV(B3/12,B4,0,B12)',
      check: { mustUse: ['PV'] },
      wrong: ['=PV(B3/12,B4,0,-B12)', '=PV(B3,B4,0,B12)', '=PV(B3/12,B7,0,B12)'],
      hints: [
        'With no regular payment, leave pmt as 0 (or empty: `PV(rate, nper, , fv)`).',
        'nper is the B4 months of saving, not the sabbatical months.',
        'fv = +B12: the money comes back to Arjun, so the deposit (the result) is negative.',
      ],
      explain:
        '=PV(B3/12,B4,0,B12) = -$27,636.64: put that in today and 30 months of interest grow it to B12. ' +
        'The sign says the deposit leaves Arjun\'s pocket. Compare it with the plan: $5,000 now plus 30 deposits of $750 ($27,500 in total) reaches only $28,607.11, because most deposits earn interest for only part of the time.',
    },
  ],
  testCases: [
    { name: 'Interest rate of 3.4%', inputs: { B3: 0.034 } },
    { name: 'Saving $680 a month for 36 months, starting from $6,500', inputs: { B4: 36, B5: 680, B6: 6500 } },
    { name: 'Withdrawals of $3,100', inputs: { B8: 3100 } },
    { name: 'A 12-month sabbatical with a $2,400 course fee', inputs: { B7: 12, B9: 2400 } },
  ],
  skills: ['FV', 'PV', 'type argument (start of period)', 'sign convention', 'single sum vs regular payments'],
  techniques: ['Time value of money (NPV vs lump sum)'],
}

const rateNperDrill: Exercise = {
  id: 'w4-rate-nper-instalments',
  week: 'W4',
  topic: 'RATE and NPER',
  title: 'What does the "low interest" plan really cost?',
  level: 1,
  minutes: 8,
  scenario:
    'An electronics shop in Jurong sells a $3,600 laptop on an instalment plan: 24 monthly payments of $165, the first one paid on the day you take the laptop home. ' +
    'Separately, Priya saves $400 at the end of every month towards a $15,000 wedding fund in an account paying 3.1% a year (compounded monthly); she already has $2,000. ' +
    'Use RATE to find the true cost of the plan and NPER to find how long Priya must save.',
  sheet: {
    rows: 15,
    cols: 2,
    colWidths: { A: 400, B: 130 },
    cells: {
      A1: title('Laptop instalment plan'),
      A3: label('Cash price'), B3: input(3600, MONEY0),
      A4: label('Number of monthly instalments'), B4: input(24, '0'),
      A5: label('Instalment (the first one is paid on the day of purchase)'), B5: input(165, MONEY),
      A7: label('Interest rate per year built into the plan'), B7: answer(PCT),
      A9: title('Wedding fund'),
      A10: label('Target'), B10: input(15000, MONEY0),
      A11: label('Already saved'), B11: input(2000, MONEY0),
      A12: label('Saved at the end of each month'), B12: input(400, MONEY0),
      A13: label('Interest rate (per year, compounded monthly)'), B13: input(0.031, PCT),
      A15: label('Months of saving needed'), B15: answer('0.00'),
    },
  },
  tasks: [
    {
      id: 'rate',
      kind: 'formula',
      cells: 'B7',
      prompt:
        'In B7 find the yearly interest rate built into the plan with `RATE`. The buyer receives a $3,600 laptop (positive) and pays the instalments (negative), the first on the day of purchase. ' +
        '`RATE` returns the rate per month: turn it into the nominal rate per year (12 monthly periods, not compounded), the way banks quote it.',
      solution: '=RATE(B4,-B5,B3,0,1)*12',
      check: { mustUse: ['RATE'] },
      wrong: ['=RATE(B4,-B5,B3,0,1)', '=RATE(B4,-B5,B3)*12', '=RATE(B4,B5,B3,0,1)*12', '=(1+RATE(B4,-B5,B3,0,1))^12-1', '=RATE(24,-B5,B3,0,1)*12'],
      hints: [
        '`RATE(nper, pmt, pv, [fv], [type])`: nper = B4 payments, pmt = -B5, pv = +B3.',
        'The first payment is on the day of purchase: payments at the start of each period, type = 1 (fv = 0 before it).',
        'The result is a monthly rate because the payments are monthly: multiply by 12.',
      ],
      explain:
        '=RATE(B4,-B5,B3,0,1)*12 = 10.17% a year: the monthly rate (0.85%) that makes 24 payments of $165, the first one today, worth exactly $3,600. ' +
        'If pmt and pv have the same sign RATE cannot find a rate and shows #NUM!. Multiplying by 12 gives the nominal yearly rate quoted by banks.',
    },
    {
      id: 'nper',
      kind: 'formula',
      cells: 'B15',
      prompt:
        'In B15 use `NPER` to find how many months Priya must save to reach the target. Her savings (the $2,000 and every monthly $400) leave her pocket, and the target comes back to her. ' +
        'Leave the result unrounded: NPER gives a fraction of a month.',
      solution: '=NPER(B13/12,-B12,-B11,B10)',
      check: { mustUse: ['NPER'] },
      wrong: [
        '=NPER(B13,-B12,-B11,B10)', '=NPER(B13/12,-B12,0,B10)', '=NPER(B13/12,B12,B11,B10)', '=NPER(B13/12,-B12,-B11,B10,1)',
        '=ROUNDUP(NPER(B13/12,-B12,-B11,B10),0)', '=NPER(B13/12,-B12,-2000,B10)',
      ],
      hints: [
        '`NPER(rate, pmt, pv, [fv], [type])`: the rate must be per month, like the savings.',
        'pmt = -B12, pv = -B11 (both paid in), fv = +B10 (what she gets back).',
        'She saves at the end of each month, so type is 0 and can be left out.',
      ],
      explain:
        '=NPER(B13/12,-B12,-B11,B10) = 30.86 months, so she needs 31 monthly deposits. Excel accepts any sign combination without complaint: with every amount positive, ' +
        'NPER(B13/12,B12,B11,B10) returns -44.47 months, which is why you must check that the result makes sense. Leaving out the $2,000 asks for about five more months.',
    },
    {
      id: 'flat',
      kind: 'explain',
      cells: '',
      prompt:
        'The shop advertises the plan as "only $360 extra on $3,600 over two years: 5% a year". Explain why the rate in B7 is about twice that, and what RATE actually measures.',
      answer:
        'RATE finds the monthly rate that makes the 24 instalments, the first paid today, worth exactly the $3,600 cash price; x12 that is about 10.2% a year. ' +
        'The "5% a year" divides the $360 by the full price for two whole years, but the buyer repays part of the price every month (the first instalment at once), ' +
        'so on average owes only about half of it. $360 of interest on an average balance near $1,800 over two years is about 10% a year.',
      hints: ['How much does the buyer still owe after one year? After 23 months?'],
    },
  ],
  testCases: [
    { name: 'Instalment of $172 and a savings rate of 2.4%', inputs: { B5: 172, B13: 0.024 } },
    { name: 'Cash price of $3,450 and a target of $18,000', inputs: { B3: 3450, B10: 18000 } },
    { name: '30 instalments of $140; $3,000 already saved and $450 a month', inputs: { B4: 30, B5: 140, B11: 3000, B12: 450 } },
  ],
  skills: ['RATE', 'NPER', 'monthly rate to yearly rate (x12)', 'type argument', 'sign convention'],
  techniques: ['Written interpretation of model results'],
}

const npvIrrDrill: Exercise = {
  id: 'w4-npv-irr-solar',
  week: 'W4',
  topic: 'NPV and IRR',
  title: 'Rooftop solar: NPV with the payment today outside',
  level: 1,
  minutes: 6,
  scenario:
    'Polar Freight, a cold-chain logistics firm in Tuas, can put solar panels on its warehouse roof for $185,000, paid on installation today. ' +
    'The electricity savings are uneven: they rise with tariffs for three years, then fall as the panels age. The firm\'s cost of capital is 7% a year. ' +
    'Value the project with NPV and IRR and let a formula state the decision.',
  sheet: {
    rows: 16,
    cols: 2,
    colWidths: { A: 250, B: 130 },
    cells: {
      A1: title('Rooftop solar project'),
      A3: label('Discount rate (per year)'), B3: input(0.07, PCT1),
      A5: header('Year'), B5: header('Cash flow'),
      ...column('A', 6, [0, 1, 2, 3, 4, 5, 6], '0', 'given', 'center'),
      ...column('B', 6, [-185000, 38000, 41500, 44000, 43200, 42000, 40500], MONEY0, 'input'),
      A14: label('Net present value'), B14: answer(MONEY),
      A15: label('Internal rate of return'), B15: answer(PCT),
      A16: label('Decision'), B16: answer(),
    },
  },
  tasks: [
    {
      id: 'npv',
      kind: 'formula',
      cells: 'B14',
      prompt:
        'In B14 compute the NPV at the rate in B3 with `NPV`. `NPV` treats its first value as one year away, but the $185,000 in B6 is paid today.',
      solution: '=NPV(B3,B7:B12)+B6',
      check: { mustUse: ['NPV'] },
      wrong: ['=NPV(B3,B6:B12)', '=NPV(B3,B7:B12)', '=NPV(B3,B7:B12)-B6', '=NPV(B3,B6:B12)+B6'],
      hints: [
        '`NPV(rate, value1, ...)` discounts value1 by one period, value2 by two, and so on.',
        'Discount only years 1 to 6 (B7:B12) with `NPV`.',
        'Then add the year-0 cash flow as it is: it is already in today\'s money (and already negative).',
      ],
      explain:
        '=NPV(B3,B7:B12)+B6 = $12,568.19. Putting B6 inside NPV would discount the payment made today by a year as well as everything else, giving $11,745.97; ' +
        'leaving it out values only the savings. The manual check adds up each cash flow / (1 + rate)^year over years 0 to 6.',
    },
    {
      id: 'irr',
      kind: 'formula',
      cells: 'B15',
      prompt: 'In B15 compute the internal rate of return with `IRR`. Unlike `NPV`, `IRR` takes every cash flow, year 0 included.',
      solution: '=IRR(B6:B12)',
      check: { mustUse: ['IRR'] },
      wrong: ['=IRR(B7:B12)', '=IRR(B6:B11)'],
      hints: [
        '`IRR(values, [guess])` needs at least one negative and one positive value.',
        'Select the whole column of cash flows, year 0 to year 6.',
      ],
      explain:
        '=IRR(B6:B12) = 9.15%: the discount rate at which the NPV is exactly zero. Without the year-0 payment every value is positive, no rate makes the NPV zero, and IRR shows #NUM!.',
    },
    {
      id: 'decision',
      kind: 'formula',
      cells: 'B16',
      prompt: 'In B16 use `IF` to show "Invest" when the project adds value at the firm\'s discount rate, otherwise "Do not invest".',
      solution: '=IF(B14>0,"Invest","Do not invest")',
      check: { mustUse: ['IF'] },
      wrong: ['=IF(B14<0,"Invest","Do not invest")', '=IF(B15>0,"Invest","Do not invest")', '="Invest"'],
      hints: [
        'A project adds value when its NPV is above zero.',
        'Equivalent rule: invest when the IRR is above the discount rate (not above zero).',
      ],
      explain:
        'NPV > 0 and IRR > discount rate give the same decision for a project like this one (one payment, then savings). ' +
        'At 7% the panels are worth $12,568 more than the firm\'s cost of capital requires; at 10% the NPV turns negative and the formula switches to "Do not invest".',
    },
  ],
  testCases: [
    { name: 'Discount rate of 10%', inputs: { B3: 0.1 } },
    { name: 'Year-3 saving falls to $30,000', inputs: { B9: 30000 } },
    { name: 'Panels cost $200,000', inputs: { B6: -200000 } },
    { name: 'Savings of $34,000 and $37,000 in years 1 and 2', inputs: { B7: 34000, B8: 37000 } },
    { name: 'Savings of $35,000 a year in years 4 to 6', inputs: { B10: 35000, B11: 35000, B12: 35000 } },
  ],
  skills: ['NPV', 'IRR', 'time-0 cash flow outside NPV', 'accept/reject rule'],
  techniques: ['Time value of money (NPV vs lump sum)'],
}

const circularDrill: Exercise = {
  id: 'w4-circular-manager-fee',
  week: 'W4',
  topic: 'Circular reference',
  title: 'A manager fee that is paid out of its own profit',
  level: 1,
  minutes: 6,
  scenario:
    'A hawker centre co-operative in Jalan Besar pays its manager 8% of the co-op\'s net profit, and the net profit is counted after deducting that fee. ' +
    'The fee needs the profit and the profit needs the fee: a circular reference. Close the loop, switch on iterative calculation (the Iterative button in the toolbar), ' +
    'then check the answer with a little algebra.',
  sheet: {
    rows: 10,
    cols: 2,
    colWidths: { A: 340, B: 130 },
    cells: {
      A1: title('Manager fee'),
      A3: label('Income'), B3: input(186000, MONEY0),
      A4: label('Running costs'), B4: input(121500, MONEY0),
      A5: label('Manager fee rate (of net profit)'), B5: input(0.08, PCT1),
      A7: label('Manager fee'), B7: answer(MONEY),
      A8: label('Net profit after the fee'), B8: givenF('=B3-B4-B7', MONEY),
      A10: label('Manager fee by algebra (no circular reference)'), B10: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'fee',
      kind: 'formula',
      cells: 'B7',
      prompt:
        'In B7 enter the fee: the fee rate times the net profit in B8. B8 already deducts B7, so Excel reports a circular reference. ' +
        'Switch on Iterative in the toolbar and watch the fee settle.',
      solution: '=B5*B8',
      // the loop is the point: task algebra's closed form typed into B7 gives the same value with no loop at all
      check: { tol: 0.01, refs: ['B8'] },
      wrong: ['=B5*(B3-B4)', '=B5*B3', '=B8/B5', '=B5*(B3-B4)/(1+B5)'],
      hints: [
        'The fee is a percentage of the profit AFTER the fee: refer to B8, not to income minus costs.',
        'If the cells show a circular-reference error, iterative calculation is still off: press Iterative in the toolbar.',
      ],
      explain:
        '=B5*B8 settles at $4,777.78. With iteration on, Excel computes the fee from the profit, the profit from the fee, and repeats until the change is below 0.001 ' +
        '(at most 100 rounds). Charging 8% of the profit before the fee ($5,160) would pay the manager more than the agreement says.',
    },
    {
      id: 'algebra',
      kind: 'formula',
      cells: 'B10',
      prompt:
        'Check the iteration without a loop. If F is the fee, r the rate and P = income - costs, the agreement says F = r x (P - F). ' +
        'Solve this for F and enter the result in B10 as a formula of B3, B4 and B5.',
      solution: '=B5*(B3-B4)/(1+B5)',
      wrong: ['=B5*(B3-B4)', '=B5*(B3-B4)/(1-B5)', '=B5*(B3-B4)*(1-B5)'],
      hints: [
        'Multiply out: F = rP - rF.',
        'Collect the F terms: F + rF = rP, so F(1 + r) = rP.',
      ],
      explain:
        'F = rP / (1 + r) = 8% x 64,500 / 1.08 = $4,777.78, the same as the iteration (to within its 0.001 stopping rule). ' +
        'Algebra works for this short loop; iteration saves you the algebra when the loop is longer (tax in the middle, MAX guards for a loss year) or cannot be rearranged at all.',
    },
    {
      id: 'converge',
      kind: 'explain',
      cells: '',
      prompt: 'Why does Excel\'s iteration settle quickly here? What kind of circular model would never settle?',
      answer:
        'Each round recomputes the fee from the profit left after the previous fee. A change of $1 in the fee changes the next fee by only 8 cents (the rate), ' +
        'so every correction is 8% of the one before and the loop converges in a few rounds. A loop that multiplies a change by more than 1 each round ' +
        '(for example a fee above 100% of profit) would grow without limit and diverge.',
    },
  ],
  testCases: [
    { name: 'Income of $210,000', inputs: { B3: 210000 } },
    { name: 'Fee rate of 10%', inputs: { B5: 0.1 } },
    { name: 'Running costs of $140,000', inputs: { B4: 140000 } },
  ],
  skills: ['circular reference', 'iterative calculation', 'fixed point by algebra'],
}

const normalDrill: Exercise = {
  id: 'w4-normdist-portfolio-returns',
  week: 'W4',
  topic: 'NORMDIST and NORMSDIST',
  title: 'How likely is a losing year? NORMDIST and NORMSDIST',
  level: 1,
  minutes: 6,
  scenario:
    'A robo-adviser describes the yearly return of its balanced portfolio as normally distributed, with a mean of 6.5% and a standard deviation (the volatility, ' +
    'as in Black-Scholes) of 9%. Before investing, a client wants three numbers: the chance of a losing year, how unusual a -10% year would be, ' +
    'and the chance of a year above 20%. Use the two normal-distribution functions of Week 4.',
  sheet: {
    rows: 12,
    cols: 2,
    colWidths: { A: 400, B: 130 },
    cells: {
      A1: title('Portfolio return risk'),
      A3: label('Mean yearly return'), B3: input(0.065, PCT1),
      A4: label('Standard deviation of the yearly return'), B4: input(0.09, PCT1),
      A5: label('A losing year: a return below'), B5: input(0, PCT1),
      A6: label('A bad year: a return of'), B6: input(-0.1, PCT1),
      A7: label('A great year: a return above'), B7: input(0.2, PCT1),
      A9: label('Probability of a losing year'), B9: answer(PCT),
      A10: label('z-score of the bad year'), B10: answer('0.00'),
      A11: label('Probability of a year as bad as B6 or worse'), B11: answer(PCT),
      A12: label('Probability of a great year'), B12: answer(PCT),
    },
  },
  tasks: [
    {
      id: 'loss',
      kind: 'formula',
      cells: 'B9',
      prompt:
        'In B9 use `NORMDIST` for the probability of a losing year, a return below B5. Its last argument decides what it returns: you want the cumulative probability (the area to the left of B5).',
      solution: '=NORMDIST(B5,B3,B4,TRUE)',
      check: { mustUse: ['NORMDIST'] },
      wrong: ['=NORMDIST(B5,B3,B4,FALSE)', '=NORMSDIST(B5)', '=1-NORMDIST(B5,B3,B4,TRUE)', '=NORMDIST(B5,B4,B3,TRUE)'],
      hints: [
        '`NORMDIST(x, mean, standard_dev, cumulative)`: x is the return B5, then the mean B3 and the standard deviation B4.',
        'cumulative TRUE gives the probability of a value at or below x; FALSE gives the height of the curve at x.',
      ],
      explain:
        '=NORMDIST(B5,B3,B4,TRUE) = 23.51%: about one year in four loses money, even though the average year gains 6.5%. ' +
        'With FALSE, NORMDIST returns the density, 3.42 here: the height of the curve, which is not a probability (it can even be above 1).',
    },
    {
      id: 'z',
      kind: 'formula',
      cells: 'B10',
      prompt: 'In B10 standardise the bad year B6: z = (x - mean) / standard deviation. Watch the brackets.',
      solution: '=(B6-B3)/B4',
      wrong: ['=B6-B3/B4', '=(B3-B6)/B4', '=(B6-B3)/B4^2', '=(B6-B3)*B4'],
      hints: [
        'z counts how many standard deviations a value lies from the mean; below the mean it is negative.',
        'Without brackets Excel divides before it subtracts: write (B6-B3)/B4.',
      ],
      explain:
        '=(B6-B3)/B4 = -1.83: a -10% year lies 1.83 standard deviations below the mean. B6-B3/B4 divides only the mean by the standard deviation (operator precedence) and gives a meaningless -0.82.',
    },
    {
      id: 'bad',
      kind: 'formula',
      cells: 'B11',
      prompt: 'In B11 use `NORMSDIST` on the z-score in B10 for the probability of a year as bad as B6 or worse.',
      solution: '=NORMSDIST(B10)',
      check: { mustUse: ['NORMSDIST'] },
      wrong: ['=NORMSDIST(B6)', '=1-NORMSDIST(B10)', '=NORMSDIST(-B10)', '=NORMDIST(B10,0,1,FALSE)'],
      hints: [
        '`NORMSDIST(z)` is the normal distribution with mean 0 and standard deviation 1: it needs the standardised value, not the return itself.',
        'The area to the left of z is the probability of a value at or below it.',
      ],
      explain:
        '=NORMSDIST(B10) = 3.34%, the same as NORMDIST(B6,B3,B4,TRUE): standardising turns any normal into the standard one. ' +
        'NORMSDIST(0) = 0.5 because half of all years fall below the mean; NORMSDIST(B6) would treat -10% as if it were z = -0.1.',
    },
    {
      id: 'great',
      kind: 'formula',
      cells: 'B12',
      prompt: 'In B12 find the probability of a great year, a return above B7. `NORMDIST` only gives the area to the LEFT of a value.',
      solution: '=1-NORMDIST(B7,B3,B4,TRUE)',
      wrong: ['=NORMDIST(B7,B3,B4,TRUE)', '=1-NORMDIST(B7,B3,B4,FALSE)', '=1-NORMSDIST(B7)', '=NORMDIST(-B7,B3,B4,TRUE)'],
      hints: [
        'The probabilities of "at or below B7" and "above B7" add up to 1.',
        'Take NORMDIST(B7, B3, B4, TRUE) away from 1.',
      ],
      explain:
        '=1-NORMDIST(B7,B3,B4,TRUE) = 6.68%: 20% lies 1.5 standard deviations above the mean, so roughly one year in fifteen. ' +
        '1-NORMSDIST((B7-B3)/B4) gives the same.',
    },
  ],
  testCases: [
    { name: 'Mean return of 5% with a standard deviation of 12%', inputs: { B3: 0.05, B4: 0.12 } },
    { name: 'A losing year means losing more than 5%', inputs: { B5: -0.05 } },
    { name: 'A bad year of -15%', inputs: { B6: -0.15 } },
    { name: 'A great year means above 15%', inputs: { B7: 0.15 } },
  ],
  skills: ['NORMDIST (cumulative TRUE)', 'z-score', 'NORMSDIST', 'upper tail with 1 - NORMDIST', 'probability vs density (FALSE)'],
}

// ---------- level 2 applied models ----------

const OFFER_B = [3000, 1500, 1500, 2000, 2000, 2000]

const feeOffer: Exercise = {
  id: 'w4-npv-monthly-fee-offer',
  week: 'W4',
  topic: 'NPV with a month-0 payment',
  title: 'Paid today or paid monthly? Three ways to settle a fee',
  level: 2,
  minutes: 12,
  scenario:
    'A freelance illustrator has painted a mural for a café chain in Tanjong Pagar. To settle the fee the café offers three options: (A) $11,700 paid today; ' +
    '(B) six monthly instalments, the first paid today, that dip while its new outlet gets going (the table below); or (C) six equal monthly payments of $1,990, the first paid today. ' +
    'Whatever she receives goes towards a business loan that charges 8.4% a year, so that is the rate at which she discounts later money. Put the offers in today\'s money and pick the best.',
  sheet: {
    rows: 18,
    cols: 2,
    colWidths: { A: 400, B: 140 },
    cells: {
      A1: title('Settling the mural fee'),
      A3: label('Discount rate per year (her business loan rate)'), B3: input(0.084, PCT1),
      A4: label('Offer A: lump sum paid today'), B4: input(11700, MONEY0),
      A5: label('Offer C: equal monthly payment, the first one today'), B5: input(1990, MONEY0),
      A6: label('Offer C: number of monthly payments'), B6: input(6, '0'),
      A8: header('Offer B: month (0 = today)'), B8: header('Payment'),
      ...column('A', 9, [0, 1, 2, 3, 4, 5], '0', 'given', 'center'),
      ...column('B', 9, OFFER_B, MONEY0, 'input'),
      A16: label('Offer B: value today'), B16: answer(MONEY),
      A17: label('Offer C: value today'), B17: answer(MONEY),
      A18: label('Offer worth the most today (A, B or C)'), B18: answer(),
    },
  },
  tasks: [
    {
      id: 'npv',
      kind: 'formula',
      cells: 'B16',
      prompt:
        'In B16 value offer B in today\'s money with `NPV`. The rate in B3 is per year but the payments are monthly, and the month-0 payment in B9 is made today.',
      solution: '=NPV(B3/12,B10:B14)+B9',
      check: { mustUse: ['NPV'] },
      wrong: ['=NPV(B3,B10:B14)+B9', '=NPV(B3/12,B9:B14)', '=NPV(B3/12,B10:B14)', '=SUM(B9:B14)', '=NPV(B3/12,B9:B14)+B9'],
      hints: [
        '`NPV` treats its first value as one period away, and its rate must be per period: here per month.',
        'Give `NPV` the monthly rate B3/12 and months 1 to 5 (B10:B14) only: the month-0 payment is already in today\'s money.',
        'Add B9 outside the function: NPV(B3/12, B10:B14) + B9.',
      ],
      explain:
        '=NPV(B3/12,B10:B14)+B9 = $11,803.79. With B3 instead of B3/12 every month would be discounted as if it were a year; ' +
        'with B9 inside NPV the $3,000 paid today would be discounted by a month as well; and the plain SUM ignores the time value of money altogether.',
    },
    {
      id: 'pv',
      kind: 'formula',
      cells: 'B17',
      prompt:
        'In B17 value offer C with `PV`: B6 equal payments of B5, the first one today. Show the value as a positive amount, like B16.',
      solution: '=PV(B3/12,B6,-B5,0,1)',
      check: { mustUse: ['PV'] },
      wrong: ['=PV(B3/12,B6,-B5)', '=PV(B3,B6,-B5,0,1)', '=PV(B3/12,B6,B5,0,1)', '=B5*B6', '=PV(B3/12,6,-B5,0,1)'],
      hints: [
        'Equal payments are what `PV` is for. The first one is today, so every payment falls at the START of a month.',
        '`PV(rate, nper, pmt, [fv], [type])`: rate B3/12, nper B6, type 1.',
        'PV returns the opposite sign of pmt: enter the payment as -B5 to show the value as positive.',
      ],
      explain:
        '=PV(B3/12,B6,-B5,0,1) = $11,734.42. Type 1 puts every payment at the start of a month, so PV here does exactly what NPV over months 1 to 5 plus the month-0 payment does: ' +
        'PV needs equal payments but allows the start of the period; NPV allows uneven payments but always at the end of each period.',
    },
    {
      id: 'best',
      kind: 'formula',
      cells: 'B18',
      prompt:
        'In B18 show the letter of the offer worth the most today: "A" (B4), "B" (B16) or "C" (B17). Use `IF`; `AND` helps for A, which must beat both of the others.',
      solution: '=IF(AND(B4>B16,B4>B17),"A",IF(B16>B17,"B","C"))',
      check: { mustUse: ['IF'] },
      wrong: [
        '=IF(B16>B4,"B","A")',
        '=IF(OR(B4>B16,B4>B17),"A",IF(B16>B17,"B","C"))',
        '=IF(AND(B4>B16,B4>B17),"A",IF(B16>B17,"C","B"))',
        '=IF(AND(B4<B16,B4<B17),"A",IF(B16>B17,"B","C"))',
      ],
      hints: [
        'A is the best only when it beats B AND C: two conditions that must both hold.',
        'When A is not the best, a second `IF` decides between B and C.',
        'IF(AND(B4>B16, B4>B17), "A", IF(B16>B17, "B", "C")).',
      ],
      explain:
        '=IF(AND(B4>B16,B4>B17),"A",IF(B16>B17,"B","C")) gives "B". With OR instead of AND, A would win as soon as it beat just one of the other offers; ' +
        'comparing only A with B ignores C, which wins when its payments are a little larger.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt:
        'Which offer should she take? Justify it with the values in today\'s money, and say what would make the lump sum the better choice.',
      answer:
        'Offer B: at her 8.4% loan rate it is worth about $11,804 today, against $11,734 for C and $11,700 for A. She waits for most of the money, but the $300 more that B pays ' +
        'is worth more than the interest she would save by paying down her loan sooner. The margins are small (about $69 over C and $104 over A), so the lump sum would win ' +
        'if her money were worth more to her, for example if her loan charged about 13% a year or more, or if the café trimmed the later instalments.',
    },
  ],
  testCases: [
    { name: 'A loan rate of 15% a year', inputs: { B3: 0.15 } },
    { name: 'Equal payments of $2,020', inputs: { B5: 2020 } },
    { name: 'A lump sum of $11,780 and a 7.2% loan rate', inputs: { B4: 11780, B3: 0.072 } },
    { name: 'Offer B front-loaded: $4,000 today, then $1,600 a month', inputs: { B9: 4000, B10: 1600, B11: 1600, B12: 1600, B13: 1600, B14: 1600 } },
    { name: 'Offer C with five payments', inputs: { B6: 5 } },
  ],
  skills: ['NPV with a monthly rate', 'month-0 payment outside NPV', 'PV with type 1', 'NPV vs PV', 'IF with AND', 'lump sum vs instalments'],
  techniques: ['Time value of money (NPV vs lump sum)', 'IF with AND/OR multi-condition rules', 'Written interpretation of model results'],
}

const SHED_YEARS = Array.from({ length: 16 }, (_, i) => i)

const shedFund: Exercise = {
  id: 'w4-fund-schedule-match',
  week: 'W4',
  topic: 'FV and NPER checked by a schedule',
  title: 'Check FV and NPER the long way: a year-by-year fund schedule',
  level: 2,
  minutes: 12,
  scenario:
    'A dragon-boat club in Kallang is saving for a new boat shed that will cost $180,000. Its fund holds $40,000 today, earns 4.5% a year, ' +
    'and the club adds $12,000 of membership surplus at the end of every year. Answer with FV and NPER, then check both without the functions, as the course does: ' +
    'a year-by-year schedule of the fund, and an approximate MATCH that reads off the year in which the target is reached.',
  sheet: {
    rows: 29,
    cols: 2,
    colWidths: { A: 400, B: 160 },
    cells: {
      A1: title('Boat-shed fund'),
      A3: label('In the fund today'), B3: input(40000, MONEY0),
      A4: label('Return per year'), B4: input(0.045, PCT1),
      A5: label('Added at the end of each year'), B5: input(12000, MONEY0),
      A6: label('Cost of the boat shed (target)'), B6: input(180000, MONEY0),
      A7: label('Years for the forecast'), B7: input(8, '0'),
      A9: label('Fund after B7 years (FV)'), B9: answer(MONEY),
      A10: label('Years to reach the target (NPER)'), B10: answer('0.00'),
      A11: label('Year in which the schedule first reaches the target (MATCH)'), B11: answer('0'),
      A13: header('Year'), B13: header('Fund at the end of the year'),
      ...column('A', 14, SHED_YEARS, '0', 'given', 'center'),
      B14: givenF('=B3', MONEY),
      ...answers(['B'], 15, 29, MONEY),
    },
  },
  tasks: [
    {
      id: 'fv',
      kind: 'formula',
      cells: 'B9',
      prompt:
        'In B9 use `FV` for the fund after B7 years. From the club\'s point of view the $40,000 and every yearly addition are paid into the fund (negative), so the fund it will have comes out positive.',
      solution: '=FV(B4,B7,-B5,-B3)',
      check: { mustUse: ['FV'] },
      wrong: ['=FV(B4,B7,-B5)', '=FV(B4,B7,B5,B3)', '=FV(B4/12,B7*12,-B5,-B3)', '=FV(B4,B7,-B5,-B3,1)', '=FV(B4,8,-B5,-B3)'],
      hints: [
        '`FV(rate, nper, pmt, [pv], [type])`: everything here is yearly, so no /12.',
        'pmt is the yearly addition (-B5) and pv the money already in the fund (-B3); additions at the end of the year, so no type.',
      ],
      explain:
        '=FV(B4,B7,-B5,-B3) = $169,444.19. Leaving out pv forgets the $40,000 and its eight years of growth; type 1 would credit each addition a year too early.',
    },
    {
      id: 'schedule',
      kind: 'formula',
      cells: 'B15:B29',
      prompt:
        'In B15 write the fund at the end of year 1: last year\'s fund grows by one year of return, then the addition B5 is paid in. Fill it down to B29 (year 15).',
      solution: '=B14*(1+$B$4)+$B$5',
      wrong: ['=B14*(1+B4)+B5', '=(B14+$B$5)*(1+$B$4)', '=B14*$B$4+$B$5', '=B14*(1+$B$4)'],
      hints: [
        'The addition comes at the END of the year, so it earns nothing in the year it is paid: grow first, then add.',
        'Fund this year = fund last year x (1 + return) + addition.',
        'B14 must move down as you fill; the return B4 and the addition B5 must not: $B$4 and $B$5.',
      ],
      explain:
        '=B14*(1+$B$4)+$B$5 is the course\'s FV schedule. The year-8 row shows $169,444.19, exactly the FV in B9: FV is this recurrence done in one step. ' +
        'Without the $ signs the return and the addition would slide down to B5, B6... as you fill.',
    },
    {
      id: 'nper',
      kind: 'formula',
      cells: 'B10',
      prompt: 'In B10 use `NPER` for the number of years the fund needs to reach the target B6. Use the same signs as in B9 and leave the result unrounded.',
      solution: '=NPER(B4,-B5,-B3,B6)',
      check: { mustUse: ['NPER'] },
      wrong: ['=NPER(B4,B5,B3,B6)', '=NPER(B4,-B5,0,B6)', '=NPER(B4,-B5,-B3,B6,1)', '=ROUNDUP(NPER(B4,-B5,-B3,B6),0)', '=NPER(B4,-B5,-B3,180000)'],
      hints: [
        '`NPER(rate, pmt, pv, [fv], [type])`: the target is the fv.',
        'Money paid in is negative (-B5, -B3) and the target that comes back is positive (B6).',
      ],
      explain:
        '=NPER(B4,-B5,-B3,B6) = 8.54 years. With every amount positive Excel still returns a number, a negative one, so always check that the answer makes sense.',
    },
    {
      id: 'match',
      kind: 'formula',
      cells: 'B11',
      prompt:
        'In B11 read the year off the schedule instead: an approximate `MATCH` (match type 1) of the target B6 in the whole schedule B14:B29, year 0 included.',
      solution: '=MATCH(B6,B14:B29,1)',
      check: { mustUse: ['MATCH'] },
      wrong: ['=MATCH(B6,B14:B29,0)', '=MATCH(B6,B15:B29,1)', '=MATCH(B6,B14:B29,1)-1', '=MATCH(B6,B14:B29,-1)'],
      hints: [
        '`MATCH(lookup, range, 1)` returns the position of the largest value at or below the lookup value; the fund only grows, so the list is sorted ascending as type 1 needs.',
        'Position 1 is year 0, so the position MATCH returns is one more than the last year that is still below the target.',
      ],
      explain:
        '=MATCH(B6,B14:B29,1) = 9. The last fund below $180,000 is year 8 ($169,444.19), the 9th value in the list because year 0 comes first, ' +
        'so the position is the year in which the target is reached (year 9, $189,069.18). Exact match (0) gives #N/A; starting the range at B15 gives 8, the last year that is still short.',
    },
    {
      id: 'plan',
      kind: 'explain',
      cells: '',
      prompt: 'NPER says 8.54 years but the schedule says year 9. Which should the club plan with, and why do the two differ?',
      answer:
        'Year 9. NPER solves the time-value equation for a fractional number of years, as if the fund could be measured part-way through year 9, but the return is credited ' +
        'and the $12,000 added only at the end of each year: after 8 years the fund holds about $169,400, still short, and only at the end of year 9 (about $189,100) is there enough. ' +
        'Rounding NPER up gives the same 9 years; the schedule also shows the path year by year, which is why the course uses it as a check.',
    },
  ],
  testCases: [
    { name: 'A return of 6% a year', inputs: { B4: 0.06 } },
    { name: 'A target of $220,000', inputs: { B6: 220000 } },
    { name: '$55,000 today, $15,000 a year and a 10-year forecast', inputs: { B3: 55000, B5: 15000, B7: 10 } },
  ],
  skills: ['FV', 'NPER', 'year-by-year balance schedule', 'approximate MATCH (type 1)', 'absolute references'],
  techniques: [
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

const QUARTERS = Array.from({ length: 12 }, (_, i) => i + 1)

const loanSchedule: Exercise = {
  id: 'w4-loan-schedule-goal-seek',
  week: 'W4',
  topic: 'Loan schedule and Goal Seek',
  title: 'Rebuild PMT by hand: a quarterly loan schedule',
  level: 2,
  minutes: 15,
  scenario:
    'Kopi Kaki Carts, a coffee-cart start-up, borrows $36,000 for two carts at 6% a year. The bank wants 12 equal quarterly instalments over 3 years and accepts a $6,000 balloon with the last one. ' +
    'Work out the instalment with PMT, then rebuild it without the function, the way the course checks PMT: a quarter-by-quarter residue-loan schedule whose instalment Goal Seek finds.',
  sheet: {
    rows: 24,
    cols: 3,
    colWidths: { A: 280, B: 150, C: 150 },
    cells: {
      A1: title('Coffee cart loan'),
      A3: label('Loan amount'), B3: input(36000, MONEY0),
      A4: label('Interest rate (per year)'), B4: input(0.06, PCT),
      A5: label('Years'), B5: input(3, '0'),
      A6: label('Instalments per year'), B6: input(4, '0'),
      A7: label('Balloon paid with the last instalment'), B7: input(6000, MONEY0),
      A9: label('Instalment from PMT'), B9: answer(MONEY),
      A11: header('Quarter'), B11: header('Instalment'), C11: header('Balance owed'),
      ...column('A', 12, [0, ...QUARTERS], '0', 'given', 'center'),
      C12: givenF('=B3', MONEY),
      B13: input(2500, MONEY, 'Trial instalment: type a guess, Goal Seek changes it'),
      ...Object.fromEntries(QUARTERS.slice(1).map((q) => [`B${12 + q}`, givenF('=$B$13', MONEY)])),
      ...answers(['C'], 13, 24, MONEY),
    },
  },
  tasks: [
    {
      id: 'pmt',
      kind: 'formula',
      cells: 'B9',
      prompt:
        'In B9 use `PMT` for the quarterly instalment, including the balloon. B4 is a yearly rate and the bank charges it quarter by quarter (B6 instalments a year for B5 years).',
      solution: '=PMT(B4/B6,B5*B6,B3,-B7)',
      check: { mustUse: ['PMT'] },
      wrong: ['=PMT(B4/12,B5*12,B3,-B7)', '=PMT(B4/B6,B5*B6,B3)', '=PMT(B4/B6,B5*B6,B3,B7)', '=PMT(B4/B6,12,B3,-B7)'],
      hints: [
        'Quarterly rate = B4/B6; number of quarters = B5*B6.',
        'The balloon is paid out at the end, like the instalments: fv = -B7.',
      ],
      explain:
        '=PMT(B4/B6,B5*B6,B3,-B7) = -$2,840.40 a quarter. Using /12 and *12 would price a monthly loan: the period of the rate must match the period of the payments.',
    },
    {
      id: 'balance',
      kind: 'formula',
      cells: 'C13:C24',
      prompt:
        'In C13 write the balance owed after quarter 1 and fill it down to C24: last quarter\'s balance grows by one quarter of interest, then the instalment in column B is paid. ' +
        'Anchor the rate cells so the formula survives the fill.',
      solution: '=C12*(1+$B$4/$B$6)-B13',
      wrong: ['=C12*(1+$B$4)-B13', '=C12*(1+$B$4/12)-B13', '=(C12-B13)*(1+$B$4/$B$6)', '=C12*(1+B4/B6)-B13'],
      hints: [
        'The instalment is paid at the END of the quarter, so the balance first earns a quarter of interest, then the instalment comes off.',
        'Balance this quarter = balance last quarter x (1 + B4/B6) - instalment.',
        'C12 and B13 must move down with the fill; B4 and B6 must not: $B$4 and $B$6.',
      ],
      explain:
        '=C12*(1+$B$4/$B$6)-B13 is the residue-loan recurrence. With the trial instalment of $2,500 the balance after quarter 12 is still $10,439.23, well above the $6,000 balloon; ' +
        'the right instalment leaves exactly the balloon. Without the $ signs the rate would slide down to B5, B6, B7... as you fill.',
    },
    {
      id: 'seek',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'B13',
      prompt:
        'Use Goal Seek (What-If Analysis) to find the instalment that leaves exactly the $6,000 balloon: set C24 to 6000 by changing B13.',
      toolSetup: { setCell: 'C24', toValue: 6000, changingCell: 'B13' },
      answer: { B13: 2840.39978718689 },
      check: { tol: 0.01 },
      wrong: ['2500', '3000'],
      hints: [
        'Goal Seek changes one input until a formula cell hits a target: here the input is the trial instalment, the formula the balance after the last quarter.',
        'Set cell: C24. To value: 6000. By changing cell: B13 (it must hold a value, not a formula).',
        'The answer should match B9 apart from the sign.',
      ],
      explain:
        'Goal Seek tries instalments until the last balance equals the balloon: $2,840.40, the same as PMT. The schedule shows what PMT hides: ' +
        'the balance after each quarter, and how the interest part shrinks as the loan is repaid.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt:
        'Why does B13 come out positive while B9 is negative? And how would the balance formula and the PMT formula change if each instalment were paid at the START of the quarter?',
      answer:
        'PMT follows the sign convention: the loan comes in (+), so the instalment going out is negative. The schedule simply subtracts a positive instalment from the balance, so both describe the same payment. ' +
        'Paid at the start of the quarter, the instalment reduces the balance before interest is charged: balance = (previous balance - instalment) x (1 + B4/B6), ' +
        'and PMT needs type 1: PMT(B4/B6,B5*B6,B3,-B7,1), which is smaller by a factor of 1 + 1.5%.',
    },
  ],
  testCases: [
    { name: 'Interest rate of 7.5%', inputs: { B4: 0.075 } },
    { name: 'Loan of $42,000', inputs: { B3: 42000 } },
    { name: 'Balloon of $9,000', inputs: { B7: 9000 } },
    { name: 'Half-yearly instalments over 6 years (still 12 rows)', inputs: { B5: 6, B6: 2 } },
    { name: 'A 4-year term (16 quarterly instalments)', inputs: { B5: 4 } },
  ],
  skills: ['PMT', 'loan balance schedule', 'Goal Seek', 'quarterly rate', 'absolute references'],
  techniques: ['Goal Seek', 'Absolute/mixed references so formulas fill down/right', 'Written interpretation of model results'],
}

const GROWTH_RATES = [0.02, 0.03, 0.04, 0.05]
const YEARS = Array.from({ length: 10 }, (_, i) => i + 1)

const growthGrid: Exercise = {
  id: 'w4-growth-grid-two-ways',
  week: 'W4',
  topic: 'Mixed references and a two-variable data table',
  title: 'One growth table, built two ways',
  level: 2,
  minutes: 12,
  scenario:
    'Kestrel Dental, a group of clinics, sets aside $50,000 today to replace its X-ray machines and wants to see what the reserve grows to at 2% to 5% a year after 1 to 10 years, compounded yearly. ' +
    'Build the table twice, as in the course: once with a single formula that fills right and down, and once with a two-variable Data Table on a one-cell model. Then compare the two methods.',
  sheet: {
    rows: 31,
    cols: 5,
    colWidths: { A: 250, B: 100, C: 100, D: 100, E: 100 },
    cells: {
      A1: title('Equipment reserve'),
      A3: label('Amount set aside today'), B3: input(50000, MONEY0),
      A4: label('Rate per year (model input)'), B4: input(0.04, PCT1),
      A5: label('Years (model input)'), B5: input(6, '0'),
      A6: label('Reserve after B5 years at B4'), B6: answer(MONEY),
      A7: header('Single formula'),
      A8: header('Years \\ Rate'),
      ...Object.fromEntries(GROWTH_RATES.map((r, i) => [`${'BCDE'[i]}8`, given(r, PCT0)])),
      ...column('A', 9, YEARS, '0', 'given', 'center'),
      ...answers(['B', 'C', 'D', 'E'], 9, 18, MONEY0),
      A20: header('Data table'),
      A21: answer(MONEY0),
      ...Object.fromEntries(GROWTH_RATES.map((r, i) => [`${'BCDE'[i]}21`, given(r, PCT0)])),
      ...column('A', 22, YEARS, '0', 'given', 'center'),
      ...answers(['B', 'C', 'D', 'E'], 22, 31, MONEY0),
    },
  },
  tasks: [
    {
      id: 'model',
      kind: 'formula',
      cells: 'B6',
      prompt: 'In B6 compute what B3 grows to after B5 years at B4 a year, compounded yearly. This one cell is the model the data table will re-run.',
      solution: '=B3*(1+B4)^B5',
      wrong: ['=B3*(1+B4*B5)', '=B3*(1+B4)*B5', '=B3*B4^B5'],
      hints: ['Each year the amount is multiplied by (1 + rate).', 'After n years: amount x (1 + rate)^n. `FV`(B4,B5,0,-B3) gives the same.'],
      explain: '=B3*(1+B4)^B5 = $63,265.95. B3*(1+B4*B5) is simple interest: it forgets the interest earned on interest.',
    },
    {
      id: 'grid',
      kind: 'formula',
      cells: 'B9:E18',
      prompt:
        'In B9 write ONE formula for the reserve at the rate in row 8 after the years in column A, then fill it right to E and down to row 18. ' +
        'Decide which part of each reference must stay fixed when the formula moves right, and which when it moves down.',
      solution: '=$B$3*(1+B$8)^$A9',
      check: { absolute: ['$B$3', 'B$8', '$A9'] },
      wrong: ['=B3*(1+B8)^A9', '=$B$3*(1+$B$8)^$A9', '=$B$3*(1+B$8)^A$9', '=B$3*(1+B$8)^$A9'],
      hints: [
        'The amount B3 must never move: lock both its column and its row.',
        'The rates are all in row 8: lock the row (B$8) and let the column move right.',
        'The years are all in column A: lock the column ($A9) and let the row move down.',
      ],
      explain:
        '=$B$3*(1+B$8)^$A9 is the course\'s mixed-reference pattern. A $ before the row keeps a row fixed while filling down; a $ before the column keeps a column fixed while filling right. ' +
        'With $B$8 every column would use 2%; with A$9 every row would use 1 year.',
    },
    {
      id: 'corner',
      kind: 'formula',
      cells: 'A21',
      prompt: 'Set up the data table: its formula goes in the top-left corner A21. Link it to the model output.',
      solution: '=B6',
      wrong: ['=B4', '=B3'],
      hints: ['In a two-variable table the corner cell holds the formula the table re-runs.', 'The rate and the years are the inputs; the reserve in B6 is the output to link.'],
      explain: '=B6: the data table substitutes each rate into B4 and each number of years into B5, recalculates B6 and copies the result into the grid.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'B22:E31',
      prompt:
        'Select A21:E31 and create a two-variable Data Table. The rates run across row 21 and replace the model\'s rate B4; the years run down column A and replace B5.',
      toolSetup: { range: 'A21:E31', rowInput: 'B4', colInput: 'B5' },
      answer: { B22: 51000, E22: 52500, B31: 60949.7209997379, E31: 81444.7313388721 },
      check: { tol: 0.005 },
      hints: ['Values across the top go with the Row input cell; values down the side with the Column input cell.', 'Row input cell B4, column input cell B5.'],
      explain: 'The table matches the single-formula grid cell for cell, from $51,000 (2%, 1 year) to $81,444.73 (5%, 10 years).',
    },
    {
      id: 'compare',
      kind: 'explain',
      cells: '',
      prompt: 'Both grids agree. If the reserve came from a 30-row model instead of one formula, which method would you use, and what is the catch?',
      answer:
        'The data table. It needs only the output cell and two input cells, however long the model behind B6 is, and no $ signs at all: Excel re-runs the whole model for every rate and year. ' +
        'The single formula would have to squeeze the whole model into one fill-able formula with exactly the right $ signs. ' +
        'The catch: with "automatic except for data tables" the table only refreshes when you press F9, and you cannot edit single cells inside it.',
    },
  ],
  testCases: [
    { name: 'Set aside $65,000', inputs: { B3: 65000 } },
    { name: 'Model inputs of 4.5% for 7 years', inputs: { B4: 0.045, B5: 7 } },
  ],
  skills: ['mixed references', 'fill right and down', 'compound growth', 'two-variable data table'],
  techniques: ['Absolute/mixed references so formulas fill down/right', 'What-if / scenario analysis by changing inputs'],
}

const RATES = [0.026, 0.028, 0.03, 0.032, 0.034, 0.036, 0.038, 0.04, 0.042]

const mortgageTables: Exercise = {
  id: 'w4-home-loan-data-tables',
  week: 'W4',
  topic: 'Data tables on a loan model',
  title: 'Home loan: instalments across rates and tenures',
  level: 2,
  minutes: 18,
  scenario:
    'The Ongs are buying a resale flat in Sengkang and need a $420,000 bank loan. Banks quote 2.6% to 4.2% a year and tenures of 20, 25 or 30 years, ' +
    'and the couple can afford at most $1,900 a month. Build the instalment and the loan their budget can repay, then let Data Tables show both across the rates, ' +
    'and a rate-by-tenure grid of instalments.',
  sheet: {
    rows: 24,
    cols: 7,
    colWidths: { A: 290, B: 120, C: 24, D: 100, E: 110, F: 120, G: 110 },
    cells: {
      A1: title('Home loan planner'),
      A3: label('Loan amount'), B3: input(420000, MONEY0),
      A4: label('Interest rate (per year)'), B4: input(0.032, PCT),
      A5: label('Tenure (years)'), B5: input(25, '0'),
      A6: label('Monthly budget'), B6: input(1900, MONEY0),
      A8: label('Monthly instalment'), B8: answer(MONEY),
      A9: label('Loan the budget can repay'), B9: answer(MONEY0),
      A11: label('Highest rate at which a 30-year loan fits the budget'), B11: answer(PCT),
      D2: header('Rate'), E2: header('Instalment'), F2: header('Loan budget'),
      E3: answer(MONEY), F3: answer(MONEY0),
      ...column('D', 4, RATES, PCT1),
      ...answers(['E'], 4, 12, MONEY),
      ...answers(['F'], 4, 12, MONEY0),
      D14: header('Rate \\ Years'),
      D15: answer(MONEY), E15: given(20, '0'), F15: given(25, '0'), G15: given(30, '0'),
      ...column('D', 16, RATES, PCT1),
      ...answers(['E', 'F', 'G'], 16, 24, MONEY),
    },
  },
  tasks: [
    {
      id: 'instalment',
      kind: 'formula',
      cells: 'B8',
      prompt:
        'In B8 use `PMT` for the monthly instalment, shown as a positive amount. Take the bank\'s point of view: it pays out the loan (enter it as -B3) and receives the instalments.',
      solution: '=PMT(B4/12,B5*12,-B3)',
      check: { mustUse: ['PMT'] },
      wrong: ['=PMT(B4/12,B5*12,B3)', '=PMT(B4,B5,-B3)', '=PMT(B4/12,B5,-B3)'],
      hints: ['Monthly rate B4/12, number of payments B5*12.', 'A negative pv makes PMT positive.'],
      explain: '=PMT(B4/12,B5*12,-B3) = $2,035.65 a month, above the $1,900 budget at 25 years and 3.2%.',
    },
    {
      id: 'budget',
      kind: 'formula',
      cells: 'B9',
      prompt:
        'In B9 use `PV` for the largest loan that the $1,900 budget (B6) repays at the same rate and tenure. The instalments leave the Ongs\' pocket (negative); show the loan as a positive amount.',
      solution: '=PV(B4/12,B5*12,-B6)',
      check: { mustUse: ['PV'] },
      wrong: ['=PV(B4/12,B5*12,B6)', '=PV(B4,B5,-B6)', '=PV(B4/12,B5*12,-B6,0,1)'],
      hints: ['The loan is the present value of all the instalments the budget pays.', '`PV(B4/12, B5*12, -B6)`: payments at the end of each month, so no type.'],
      explain: '=PV(B4/12,B5*12,-B6) = $392,012: PV and PMT are the same equation solved for a different unknown.',
    },
    {
      id: 'links',
      kind: 'formula',
      cells: 'E3:F3,D15',
      prompt:
        'Set up the formula cells for the data tables: E3 and D15 show the instalment (B8) and F3 the loan budget (B9). Each is a simple link to the model cell.',
      solutions: { E3: '=B8', F3: '=B9', D15: '=B8' },
      wrong: ['=B4', '=B9'],
      hints: [
        'A one-variable table down a column needs its formulas in the row above the first input value, one column to the right.',
        'A two-variable table needs its formula in the top-left corner (D15).',
      ],
      explain:
        'Data tables do not copy formulas: they re-run the model with each input value substituted into the input cell and read the formula cells you linked. ' +
        'Linking to the input (B4) instead of the output would just repeat the rates.',
    },
    {
      id: 'table1',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E4:F12',
      prompt:
        'Select D3:F12 and create a one-variable Data Table: the rates run down column D, so B4 is the column input cell. Columns E and F then show the instalment and the loan budget at each rate.',
      toolSetup: { range: 'D3:F12', colInput: 'B4' },
      answer: { E4: 1905.41193022587, E12: 2263.55773498563, F4: 418807.076486292, F12: 352542.366234394 },
      check: { tol: 0.01 },
      hints: [
        'Select the whole block, D3 to F12: the input values plus the formula row.',
        'Column input cell = B4 (leave the row input cell empty).',
      ],
      explain:
        'Each row is the model re-run with that rate in B4: the instalment climbs from $1,905 at 2.6% to $2,264 at 4.2%, and the loan the budget can repay falls accordingly. ' +
        'After editing the model press F9 to refresh data tables.',
    },
    {
      id: 'table2',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E16:G24',
      prompt:
        'Select D15:G24 and create a two-variable Data Table: tenures run across row 15 (row input cell B5) and rates down column D (column input cell B4).',
      toolSetup: { range: 'D15:G24', rowInput: 'B5', colInput: 'B4' },
      answer: { E16: 2246.109818517, G16: 1681.42678845276, E24: 2589.59708875539, G24: 2053.87212959679 },
      check: { tol: 0.01 },
      hints: [
        'The formula sits in the top-left corner D15; the values across the top go with the row input cell.',
        'Row input cell = B5 (years), column input cell = B4 (rate).',
      ],
      explain:
        'Every cell is the instalment for one rate and one tenure. Swapping the two input cells is the classic slip: Excel would put the years into the rate cell and the rates into the tenure.',
    },
    {
      id: 'maxrate',
      kind: 'formula',
      cells: 'B11',
      prompt:
        'In B11 find the highest rate in the grid at which the 30-year instalment (G16:G24) is still within the budget B6. The instalments rise with the rate, so an approximate `MATCH` on G16:G24 finds the last one at or below the budget; `INDEX` returns its rate (`LOOKUP` works too).',
      solution: '=INDEX(D16:D24,MATCH(B6,G16:G24,1))',
      wrong: ['=INDEX(D16:D24,MATCH(B6,G16:G24,0))', '=INDEX(D16:D24,MATCH(B6,E16:E24,1))', '=MATCH(B6,G16:G24,1)'],
      hints: [
        '`MATCH(lookup, range, 1)` gives the position of the biggest value that does not exceed the lookup value, in a list sorted ascending.',
        'Feed that position to `INDEX` over the rates in D16:D24.',
      ],
      explain:
        '=INDEX(D16:D24,MATCH(B6,G16:G24,1)) = 3.40%: at 3.4% the 30-year instalment is $1,862.62, at 3.6% it is $1,909.51. ' +
        'Exact match (0) gives #N/A because no instalment is exactly $1,900. The course uses the same MATCH(...,1) idea to read how many years a savings plan needs.',
    },
    {
      id: 'tradeoff',
      kind: 'explain',
      cells: '',
      prompt:
        'Use the grid: at 3.2%, which cuts the monthly instalment more, a 30-year instead of a 25-year tenure, or a rate 0.4 points lower at 25 years? What is the catch with the longer tenure?',
      answer:
        'At 3.2% the 30-year tenure cuts the instalment from $2,035.65 to $1,816.36 (about $219 a month), while 2.8% at 25 years gives $1,948.27 (about $87 less). ' +
        'The longer tenure brings the instalment within budget, but the Ongs pay for 60 more months: about $653,900 in total instead of $610,700, roughly $43,000 more interest.',
    },
  ],
  testCases: [
    { name: 'Loan of $380,000', inputs: { B3: 380000 } },
    { name: 'Budget of $2,050', inputs: { B6: 2050 } },
    { name: '3.5% over 30 years with a $1,950 budget', inputs: { B4: 0.035, B5: 30, B6: 1950 } },
  ],
  skills: ['PMT', 'PV', 'one-variable data table', 'two-variable data table', 'approximate MATCH with INDEX', 'sign convention'],
  techniques: [
    'What-if / scenario analysis by changing inputs',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'Written interpretation of model results',
  ],
}

const bonusModel: Exercise = {
  id: 'w4-circular-bonus-pool',
  week: 'W4',
  topic: 'Circular reference',
  title: 'A staff bonus that depends on profit after the bonus',
  level: 2,
  minutes: 12,
  scenario:
    'Fernhill Studio, a design agency in Kallang, expects $640,000 of revenue and $452,000 of operating costs this year. The partners promised staff a bonus pool of 12% of profit after tax, ' +
    'but the bonus is itself a cost that lowers profit before tax (corporate tax 17%). Build the model with the natural formulas, switch on iterative calculation (the Iterative button) to resolve the circular reference, ' +
    'and make sure neither the bonus nor the tax can go negative in a loss year.',
  sheet: {
    rows: 13,
    cols: 2,
    colWidths: { A: 330, B: 140 },
    cells: {
      A1: title('Bonus pool model'),
      A3: label('Revenue'), B3: input(640000, MONEY0),
      A4: label('Operating costs'), B4: input(452000, MONEY0),
      A5: label('Corporate tax rate'), B5: input(0.17, PCT1),
      A6: label('Bonus rate (of profit after tax)'), B6: input(0.12, PCT1),
      A8: label('Bonus pool'), B8: answer(MONEY),
      A9: label('Profit before tax'), B9: answer(MONEY),
      A10: label('Tax'), B10: answer(MONEY),
      A11: label('Profit after tax'), B11: answer(MONEY),
      A13: label('Bonus as a share of profit before tax'), B13: answer(PCT),
    },
  },
  tasks: [
    {
      id: 'bonus',
      kind: 'formula',
      cells: 'B8',
      prompt:
        'In B8: the bonus pool is the bonus rate times the profit after tax (B11), and never negative. Use `MAX`(0, ...) as the guard.',
      solution: '=MAX(0,B6*B11)',
      check: { tol: 0.01 },
      wrong: ['=B6*B11', '=MAX(0,B6*B9)', '=MAX(0,B6*(B3-B4))'],
      hints: [
        'Refer to B11 even though it is still empty: the loop closes when you fill B11.',
        'MAX(0, x) returns x when it is positive and 0 otherwise.',
      ],
      explain:
        '=MAX(0,B6*B11) settles at $17,028.74. In a loss year the profit after tax is negative and an unguarded formula would create a negative bonus that raises the profit.',
    },
    {
      id: 'pbt',
      kind: 'formula',
      cells: 'B9',
      prompt: 'In B9: profit before tax = revenue - operating costs - bonus pool (the bonus is a deductible cost).',
      solution: '=B3-B4-B8',
      check: { tol: 0.01 },
      wrong: ['=B3-B4', '=B3-B4+B8'],
      hints: ['Start from revenue and take off both kinds of cost.', 'The bonus in B8 is a cost too. This is where the circle closes: B9 uses B8, which uses B11, which uses B9.'],
      explain: '=B3-B4-B8 = $170,971.26 once the loop has settled. Leaving the bonus out overstates profit and therefore tax and bonus.',
    },
    {
      id: 'tax',
      kind: 'formula',
      cells: 'B10',
      prompt: 'In B10: tax = tax rate x profit before tax, but no tax when there is a loss.',
      solution: '=MAX(0,B5*B9)',
      check: { tol: 0.01 },
      wrong: ['=B5*B9', '=MAX(0,B5*B11)'],
      hints: ['Tax is charged on profit BEFORE tax (B9).', 'A loss does not earn a tax refund in this model: guard with `MAX`(0, ...).'],
      explain: '=MAX(0,B5*B9) = $29,065.11. Without the guard a loss year shows negative tax, a refund the firm would not receive.',
    },
    {
      id: 'pat',
      kind: 'formula',
      cells: 'B11',
      prompt: 'In B11: profit after tax = profit before tax - tax. When all four cells are in, switch on Iterative in the toolbar.',
      solution: '=B9-B10',
      check: { tol: 0.01 },
      wrong: ['=B9', '=B3-B4-B10', '=B9*(1-B5)'],
      hints: [
        'Refer to the tax cell rather than multiplying by (1 - tax rate): in a loss year the tax is 0, not 17% of the loss.',
        'A circular-reference error everywhere means iterative calculation is still off.',
      ],
      explain:
        '=B9-B10 = $141,906.15. The course\'s Charity Donation model writes profit after tax as (1 - tax rate) x profit before tax: B9*(1-B5) gives the same number in a profitable year, ' +
        'but in a loss year it takes 17% off the loss while the MAX guard in B10 charges no tax. Subtracting the tax cell keeps the two consistent.',
    },
    {
      id: 'share',
      kind: 'formula',
      cells: 'B13',
      prompt: 'In B13 show the bonus pool as a share of profit before tax.',
      solution: '=B8/B9',
      check: { tol: 1e-4 },
      wrong: ['=B8/B11', '=B8/B3', '=B9/B8'],
      hints: ['A share is a part divided by the whole: which cell is the whole here?', 'Divide the bonus by profit BEFORE tax, not after.'],
      explain:
        '=B8/B9 = 9.96%, which is exactly 12% x (1 - 17%): the bonus is 12% of an amount that is 83% of profit before tax.',
    },
    {
      id: 'interpret',
      kind: 'explain',
      cells: '',
      prompt:
        'A partner reads B13 and says "we promised 12%, why does the model say 9.96%?". Explain, and say what the model shows if costs rise to $680,000.',
      answer:
        'The promise is 12% of profit AFTER tax, and profit after tax is 83% of profit before tax, so the pool is 12% x 83% = 9.96% of profit before tax; both statements are true. ' +
        'With costs of $680,000 the studio makes a $40,000 loss: the MAX guards set both tax and bonus to 0, so the loss stays at $40,000 instead of being softened by a negative bonus or a tax refund.',
    },
  ],
  testCases: [
    { name: 'Revenue of $700,000', inputs: { B3: 700000 } },
    { name: 'Tax rate of 20% and bonus rate of 15%', inputs: { B5: 0.2, B6: 0.15 } },
    { name: 'A loss year: costs of $680,000', inputs: { B4: 680000 } },
  ],
  skills: ['circular reference', 'iterative calculation', 'MAX(0, ...) guard', 'profit before and after tax'],
  techniques: ['Written interpretation of model results'],
}

const VOLS = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4]

const optionPricing: Exercise = {
  id: 'w4-option-pricing-bank-share',
  week: 'W4',
  topic: 'Option pricing',
  title: 'Pricing a call and a put with LN, EXP, SQRT and NORMSDIST',
  level: 2,
  minutes: 22,
  scenario:
    'Kai, an analyst at a fund in Raffles Place, is pricing six-month European options on a bank share trading at $38.40. The exercise price is $40, the risk-free rate 3.2% a year and the share\'s volatility 24% a year. ' +
    'Following the course, keep the inputs apart from the intermediate variables and split the long Black-Scholes formulas into intermediate cells: d1, d2, N(d1), N(d2), N(-d1) and N(-d2), then the call and the put. ' +
    'Call = S·N(d1) - X·exp(-rf·t)·N(d2); Put = -S·N(-d1) + X·exp(-rf·t)·N(-d2); d1 = [LN(S/X) + (rf + σ²/2)·t] / (σ·√t); d2 has (rf - σ²/2) instead.',
  sheet: {
    rows: 18,
    cols: 6,
    colWidths: { A: 280, B: 120, C: 24, D: 90, E: 100, F: 100 },
    cells: {
      A1: title('European options'),
      A3: label('Share price now (S)'), B3: input(38.4, MONEY),
      A4: label('Exercise price (X)'), B4: input(40, MONEY),
      A5: label('Risk-free rate per year (rf)'), B5: input(0.032, PCT),
      A6: label('Volatility per year (σ)'), B6: input(0.24, PCT),
      A7: label('Time to maturity in years (t)'), B7: input(0.5, '0.00'),
      A9: label('d1'), B9: answer(DEC4),
      A10: label('d2'), B10: answer(DEC4),
      A11: label('N(d1)'), B11: answer(DEC4),
      A12: label('N(d2)'), B12: answer(DEC4),
      A13: label('N(-d1)'), B13: answer(DEC4),
      A14: label('N(-d2)'), B14: answer(DEC4),
      A15: label('Call option price'), B15: answer(MONEY),
      A16: label('Put option price'), B16: answer(MONEY),
      A18: label('Market price of the call'), B18: given(2.45, MONEY),
      D2: header('Volatility'), E2: header('Call'), F2: header('Put'),
      E3: givenF('=B15', MONEY), F3: givenF('=B16', MONEY),
      ...column('D', 4, VOLS, PCT0),
      ...answers(['E', 'F'], 4, 9, MONEY),
    },
  },
  tasks: [
    {
      id: 'd1',
      kind: 'formula',
      cells: 'B9',
      prompt: 'In B9 compute d1 with `LN` and `SQRT`. Mind the brackets: the whole numerator is divided by the whole of σ x SQRT(t).',
      solution: '=(LN(B3/B4)+(B5+B6^2/2)*B7)/(B6*SQRT(B7))',
      check: { mustUse: ['LN', 'SQRT'] },
      wrong: [
        '=(LN(B3/B4)+(B5+B6^2/2)*B7)/B6*SQRT(B7)',
        '=(LN(B3/B4)+(B5+B6^2/2)*B7)/(B6*B7)',
        '=(LN(B4/B3)+(B5+B6^2/2)*B7)/(B6*SQRT(B7))',
        '=LN(B3/B4)+(B5+B6^2/2)*B7/(B6*SQRT(B7))',
        '=(LN(B3/40)+(B5+B6^2/2)*B7)/(B6*SQRT(B7))',
      ],
      hints: [
        'Numerator: LN(S/X) + (rf + σ^2/2) x t. Denominator: σ x SQRT(t).',
        'Put brackets around the whole denominator: /(B6*SQRT(B7)). Without them Excel divides by σ and then multiplies by SQRT(t).',
      ],
      explain:
        'With the 24% volatility d1 = -0.0614: the share is below the exercise price, so LN(S/X) is negative. ^ binds tighter than / so B6^2/2 is half the variance, as required.',
    },
    {
      id: 'd2',
      kind: 'formula',
      cells: 'B10',
      prompt: 'In B10 compute d2: the same as d1 but with (rf - σ^2/2). Use `SQRT` for √t, as in d1.',
      solution: '=(LN(B3/B4)+(B5-B6^2/2)*B7)/(B6*SQRT(B7))',
      check: { mustUse: ['SQRT'] },
      wrong: ['=B9-B6*B7', '=B9+B6*SQRT(B7)', '=(LN(B3/B4)+(B5+B6^2/2)*B7)/(B6*SQRT(B7))'],
      hints: ['Copy the d1 formula and change one sign.', 'Shortcut that gives the same value: d2 = d1 - σ x SQRT(t).'],
      explain: 'With the 24% volatility d2 = -0.2311. The two formulas differ by σ^2 x t / (σ SQRT(t)) = σ SQRT(t), so =B9-B6*SQRT(B7) is equivalent.',
    },
    {
      id: 'n',
      kind: 'formula',
      cells: 'B11:B12',
      prompt: 'In B11 compute N(d1) with `NORMSDIST`, the cumulative standard normal probability, and fill it down to B12 for N(d2).',
      solution: '=NORMSDIST(B9)',
      wrong: ['=NORMDIST(B9,0,1,FALSE)', '=NORMSDIST(-B9)', '=1-NORMSDIST(B9)'],
      hints: [
        '`NORMSDIST(z)` takes one argument and returns the area under the standard normal curve to the left of z.',
        'NORMDIST(z,0,1,TRUE) gives the same; with FALSE it returns the height of the curve, which is not a probability.',
      ],
      explain: 'With the 24% volatility N(d1) = 0.4755 and N(d2) = 0.4086. NORMSDIST(0) = 0.5, so a d below zero gives a probability below one half.',
    },
    {
      id: 'nneg',
      kind: 'formula',
      cells: 'B13:B14',
      prompt: 'The put needs N(-d1) and N(-d2). In B13 compute N(-d1) with `NORMSDIST` and fill it down to B14 for N(-d2).',
      solution: '=NORMSDIST(-B9)',
      wrong: ['=NORMSDIST(B9)', '=-NORMSDIST(B9)', '=NORMSDIST(-B11)', '=-B11'],
      hints: [
        'N(-d1) is the area to the left of MINUS d1: negate the cell inside the function.',
        'Refer to d1 (B9), not to N(d1): the fill then moves it to d2 (B10).',
      ],
      explain:
        'With the 24% volatility N(-d1) = 0.5245 and N(-d2) = 0.5914. The normal curve is symmetric, so N(-d) = 1 - N(d) and =1-B11 filled down gives the same values. ' +
        'Like the course\'s model, these intermediate cells keep the put formula short and easy to check.',
    },
    {
      id: 'call',
      kind: 'formula',
      cells: 'B15',
      prompt: 'In B15 price the call: S·N(d1) - X·exp(-rf·t)·N(d2), using `EXP` and the cells above.',
      solution: '=B3*B11-B4*EXP(-B5*B7)*B12',
      check: { mustUse: ['EXP'] },
      wrong: ['=B3*B11-B4*EXP(B5*B7)*B12', '=B3*B11-B4*B12', '=B3*B12-B4*EXP(-B5*B7)*B11'],
      hints: ['EXP(-B5*B7) discounts the exercise price back to today at the risk-free rate.', 'Multiply S by N(d1) and the discounted X by N(d2).'],
      explain: 'With the 24% volatility the call is worth $2.17. EXP(+rf t) would grow the exercise price instead of discounting it, and without it the call is undervalued.',
    },
    {
      id: 'put',
      kind: 'formula',
      cells: 'B16',
      prompt: 'In B16 price the put: -S·N(-d1) + X·exp(-rf·t)·N(-d2), using the N(-d) cells.',
      solution: '=-B3*B13+B4*EXP(-B5*B7)*B14',
      check: { mustUse: ['EXP'] },
      wrong: [
        '=-B3*B11+B4*EXP(-B5*B7)*B12',
        '=B3*B13-B4*EXP(-B5*B7)*B14',
        '=-B3*B13+B4*EXP(B5*B7)*B14',
      ],
      hints: ['The put pays when the share ends BELOW X, so its signs are the mirror image of the call.', 'Use N(-d1) (B13) with S and N(-d2) (B14) with the discounted X.'],
      explain:
        'With the 24% volatility the put is worth $3.14. Put-call parity checks it: put = call - S + X·exp(-rf·t) = 2.17 - 38.40 + 39.37. ' +
        'Writing NORMSDIST(-B9) and NORMSDIST(-B10) straight into the put gives the same value in one long formula.',
    },
    {
      id: 'vols',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E4:F9',
      prompt:
        'E3 and F3 already link to the call and the put. Select D3:F9 and create a one-variable Data Table with B6 (volatility) as the column input cell.',
      toolSetup: { range: 'D3:F9', colInput: 'B6' },
      answer: { E4: 1.20675071646244, E9: 3.9070134312622, F4: 2.17184351867384, F9: 4.87210623347361 },
      check: { tol: 0.005 },
      hints: ['The volatilities run down column D, so use the Column input cell.', 'Column input cell = B6.'],
      explain:
        'Both prices rise with volatility: a wider spread of possible share prices gives the holder more upside while the loss is capped at the premium.',
    },
    {
      id: 'implied',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'B6',
      prompt:
        'The call actually trades at $2.45 (B18). Use Goal Seek to find the volatility that gives that price: set B15 to 2.45 by changing B6. This is the implied volatility.',
      toolSetup: { setCell: 'B15', toValue: 2.45, changingCell: 'B6' },
      answer: { B6: 0.265440860245516 },
      check: { tol: 1e-4 },
      wrong: ['0.24', '0.3'],
      hints: ['The data table already tells you roughly where the answer lies: between 25% and 30%.', 'Set cell B15, To value 2.45, By changing cell B6.'],
      explain:
        'Goal Seek finds about 26.5%: the market price assumes a more volatile share than the 24% estimate. Traders quote options by this implied volatility because it can be compared across strikes and maturities.',
    },
    {
      id: 'read',
      kind: 'explain',
      cells: '',
      prompt: 'Using the data table, describe how volatility affects the call and the put, and explain why an option is worth more when the share is more volatile.',
      answer:
        'Both prices rise steadily with volatility: the call from $1.21 at 15% to $3.91 at 40%, the put from $2.17 to $4.87. An option holder gains from large moves in their favour but can lose at most the premium, ' +
        'because they simply do not exercise when the move goes the wrong way. More volatility means more chance of a large favourable move with no extra downside, so the option is worth more.',
    },
  ],
  testCases: [
    { name: 'Share price of $41.20', inputs: { B3: 41.2 } },
    { name: 'Exercise price of $36', inputs: { B4: 36 } },
    { name: 'Nine months to maturity', inputs: { B7: 0.75 } },
    { name: 'Volatility of 30% and a 4% rate', inputs: { B6: 0.3, B5: 0.04 } },
  ],
  skills: ['LN', 'EXP', 'SQRT', 'NORMSDIST', 'Black-Scholes call and put', 'intermediate cells for long formulas', 'one-variable data table', 'Goal Seek (implied volatility)'],
  techniques: ['Goal Seek', 'What-if / scenario analysis by changing inputs', 'Written interpretation of model results'],
}

// ---------- level 3 exam-style ----------

const outletExam: Exercise = {
  id: 'w4-exam-bao-outlet',
  week: 'W4',
  topic: 'Exam-style: project appraisal and financing',
  title: 'Exam practice: a second bao outlet, and how to pay for it',
  level: 3,
  minutes: 30,
  scenario:
    'Lantern Bao, a small bao chain, is weighing a second outlet in Punggol. The fit-out costs $150,000, paid today; the outlet\'s net cash flows for years 1 to 6 are in Table 2 ' +
    '(year 6 is lower because the unit must be restored when the lease ends). The owners want a 10% return. The fit-out contractor offers 36 monthly instalments at 6.9% a year, ' +
    'the first due on signing, or a 3% discount for paying cash today. Answer each part in the cell given, as in the exam.',
  sheet: {
    rows: 31,
    cols: 3,
    colWidths: { A: 360, B: 140, C: 150 },
    cells: {
      A1: title('Lantern Bao: Punggol outlet'),
      A3: header('Table 1: inputs'),
      A4: label('Required return (per year)'), C4: input(0.1, PCT1),
      A5: label('Fit-out cost, paid today'), C5: input(150000, MONEY0),
      A6: label('Instalment plan: interest rate (per year)'), C6: input(0.069, PCT),
      A7: label('Instalment plan: monthly payments (first one on signing)'), C7: input(36, '0'),
      A8: label('Discount for paying cash today'), C8: input(0.03, PCT1),
      A10: header('Table 2: outlet cash flows'),
      A11: header('Year'), B11: header('Net cash flow'), C11: header('PV at the trial rate'),
      ...column('A', 12, [0, 1, 2, 3, 4, 5, 6], '0', 'given', 'center'),
      B12: givenF('=-C5', MONEY0),
      ...column('B', 13, [28000, 36000, 42000, 44000, 43000, 20000], MONEY0, 'input'),
      ...answers(['C'], 12, 18, MONEY),
      A20: label('Trial rate (Goal Seek changes this)'), C20: input(0.15, PCT, 'A starting guess for Goal Seek'),
      A21: label('Sum of the PVs at the trial rate'), C21: givenF('=SUM(C12:C18)', MONEY),
      A23: header('Answers'),
      A24: label('(a) NPV at the required return'), C24: answer(MONEY),
      A25: label('(b) IRR'), C25: answer(PCT),
      A26: label('(e) Monthly instalment'), C26: answer(MONEY),
      A27: label('(f) Balance owed at the end of year 1 (after 12 instalments)'), C27: answer(MONEY),
      A28: label('(g) PV of all the instalments at the required return'), C28: answer(MONEY),
      A29: label('(g) Cash price after the discount'), C29: answer(MONEY),
    },
  },
  tasks: [
    {
      id: 'a',
      kind: 'formula',
      cells: 'C24',
      marks: 2,
      prompt: '(a) In C24 compute the NPV of the outlet at the required return C4 with `NPV`. Remember when the fit-out is paid.',
      solution: '=NPV(C4,B13:B18)+B12',
      wrong: ['=NPV(C4,B12:B18)', '=NPV(C4,B13:B18)', '=NPV(C4/12,B13:B18)+B12'],
      hints: ['`NPV` discounts its first value by one full year.', 'Years 1 to 6 go inside `NPV`; year 0 is added outside, as it is already in today\'s money.'],
      explain: '=NPV(C4,B13:B18)+B12 = $4,803.52 > 0: at 10% the outlet earns more than the owners require. Including B12 inside NPV discounts the fit-out by a year.',
    },
    {
      id: 'b',
      kind: 'formula',
      cells: 'C25',
      marks: 1,
      prompt: '(b) In C25 compute the IRR of the outlet\'s cash flows.',
      solution: '=IRR(B12:B18)',
      wrong: ['=IRR(B13:B18)', '=IRR(B12:B17)'],
      hints: ['IRR is the rate at which the NPV of all the cash flows is zero.', '`IRR` takes all the cash flows, year 0 included.'],
      explain: '=IRR(B12:B18) = 11.08%, above the 10% required return, which agrees with the positive NPV.',
    },
    {
      id: 'c',
      kind: 'formula',
      cells: 'C12:C18',
      marks: 1.5,
      prompt:
        '(c) Without NPV: in C12 compute the present value of the year-0 cash flow at the trial rate in C20, and fill it down to C18. Use PV = cash flow / (1 + rate)^year, with the year from column A.',
      solution: '=B12/(1+$C$20)^A12',
      wrong: ['=B12/(1+C20)^A12', '=B12*(1+$C$20)^A12', '=B12/(1+$C$20)'],
      hints: [
        'The rate must stay on C20 as you fill down: anchor it.',
        'The exponent is the year in column A, so year 0 is not discounted at all.',
      ],
      explain:
        '=B12/(1+$C$20)^A12 discounts each year back to today; C21 adds them up. At the trial rate of 15% the sum is negative, so 15% is above the IRR.',
    },
    {
      id: 'd',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'C20',
      marks: 1.5,
      prompt: '(d) Use Goal Seek to set C21 (the sum of the PVs) to 0 by changing the trial rate C20. Compare the rate it finds with part (b).',
      toolSetup: { setCell: 'C21', toValue: 0, changingCell: 'C20' },
      answer: { C20: 0.110802821391794 },
      check: { tol: 1e-5 },
      wrong: ['0.15', '0.1'],
      hints: ['Set cell C21, To value 0, By changing cell C20.', 'The rate that makes the NPV zero is, by definition, the IRR.'],
      explain: 'Goal Seek stops at 11.08%, the IRR from part (b): IRR is the discount rate at which the NPV is zero, found by trial and error just like this.',
    },
    {
      id: 'e',
      kind: 'formula',
      cells: 'C26',
      marks: 1.5,
      prompt:
        '(e) In C26 compute the monthly instalment of the contractor\'s plan (rate C6, C7 payments, the first on signing) for the full fit-out cost. Keep Excel\'s sign convention: the shop receives the fit-out.',
      solution: '=PMT(C6/12,C7,C5,0,1)',
      wrong: ['=PMT(C6/12,C7,C5)', '=PMT(C6,C7,C5,0,1)', '=PMT(C6/12,C7,-C5,0,1)'],
      hints: ['Monthly rate C6/12; C7 is already a number of months.', 'First payment on signing: type = 1.'],
      explain: '=PMT(C6/12,C7,C5,0,1) = -$4,598.27 a month. With type 0 each payment would be one month later and slightly larger.',
    },
    {
      id: 'f',
      kind: 'formula',
      cells: 'C27',
      marks: 1.5,
      prompt:
        '(f) In C27: how much does the shop still owe at the end of the first year, when 12 instalments are paid and the 13th is about to fall due? Show it as a positive amount.',
      solution: '=PV(C6/12,C7-12,C26,0,1)',
      wrong: ['=PV(C6/12,C7-12,C26)', '=C5+12*C26', '=PV(C6/12,C7,C26,0,1)', '=PV(C6/12,24,C26,0,1)'],
      hints: [
        'What is still owed at the end of year 1 equals the value, on that date, of the instalments still to come.',
        'After 12 payments, C7 - 12 payments remain and the next one is due at once (start of month 13): type 1.',
        'Equivalent: -FV(C6/12,12,C26,C5,1), the loan grown 12 months minus the payments grown to the same date.',
      ],
      explain:
        '=PV(C6/12,C7-12,C26,0,1) = $103,398.01. =C5+12*C26 ignores the interest: only part of each instalment repays the loan.',
    },
    {
      id: 'g1',
      kind: 'formula',
      cells: 'C28',
      marks: 1,
      prompt:
        '(g) In C28 compute the present value of all C7 instalments (first one on signing), discounted at the shop\'s own required return C4 turned into a monthly rate. Show it as a positive amount.',
      solution: '=PV(C4/12,C7,C26,0,1)',
      wrong: ['=PV(C6/12,C7,C26,0,1)', '=PV(C4,C7,C26,0,1)', '=PV(C4/12,C7,C26)'],
      hints: ['Use the instalment from C26 as pmt, with the same timing as in part (e).', 'Discount at what the shop\'s money earns (C4/12 a month), not at the contractor\'s rate.'],
      explain:
        '=PV(C4/12,C7,C26,0,1) = $143,693.60. At the contractor\'s own rate the PV would be exactly $150,000; at the shop\'s higher 10% the same payments are worth less today.',
    },
    {
      id: 'g2',
      kind: 'formula',
      cells: 'C29',
      marks: 0.5,
      prompt: '(g) In C29 compute the cash price after the discount.',
      solution: '=C5*(1-C8)',
      wrong: ['=C5*C8', '=C5-C8', '=C5*0.97'],
      hints: ['The discount is a share of the price.', '3% off means paying 97% of the price.'],
      explain: '=C5*(1-C8) = $145,500.00.',
    },
    {
      id: 'h',
      kind: 'explain',
      cells: '',
      marks: 1.5,
      prompt: '(h) Should Lantern Bao open the outlet, and should it pay cash or take the instalments? Justify both decisions with your numbers.',
      answer:
        'Open it: the NPV at 10% is about +$4,800 and the IRR (11.08%) is above the 10% required return. ' +
        'Take the instalments: valued at the shop\'s own 10% return the 36 payments are worth about $143,694 today, less than the $145,500 cash price, ' +
        'because the contractor charges only 6.9% while the shop\'s money earns 10%. (Assumes the shop really can earn 10% on the cash it keeps.)',
    },
  ],
  testCases: [
    { name: 'Required return of 12% and a 5% cash discount', inputs: { C4: 0.12, C8: 0.05 } },
    {
      name: 'A weaker forecast ($2,000 lower every year) and a $160,000 fit-out',
      inputs: { B13: 26000, B14: 34000, B15: 40000, B16: 42000, B17: 41000, B18: 18000, C5: 160000 },
    },
    { name: 'Fit-out of $165,000 at 7.5% over 48 months', inputs: { C5: 165000, C6: 0.075, C7: 48 } },
  ],
  skills: ['NPV', 'IRR', 'manual present value', 'Goal Seek', 'PMT with type 1', 'loan balance after k payments', 'lump sum vs instalments'],
  techniques: [
    'Time value of money (NPV vs lump sum)',
    'Goal Seek',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

const SAVING_RATES = [0.03, 0.04, 0.05, 0.06, 0.07]

const fundExam: Exercise = {
  id: 'w4-exam-university-fund',
  week: 'W4',
  topic: 'Exam-style: savings plan',
  title: 'Exam practice: a university fund with every Group 1 function',
  level: 3,
  minutes: 30,
  scenario:
    'The Lims want to pay for their son\'s university studies, which start in 11 years. Fees are expected to be $24,000 a year for 4 years, paid at the start of each academic year, ' +
    'and the fund will earn 3% a year during the degree. Until then their investments earn 4.5% a year, compounded monthly; they have $10,000 invested today and can add $350 at the end of every month. ' +
    'Answer each part in the cell given, as in the exam.',
  sheet: {
    rows: 21,
    cols: 7,
    colWidths: { A: 350, B: 20, C: 130, D: 24, E: 80, F: 130, G: 110 },
    cells: {
      A1: title('University fund'),
      A3: header('Table 1: inputs'),
      A4: label('University fee per year'), C4: input(24000, MONEY0),
      A5: label('Years of study (fees at the start of each year)'), C5: input(4, '0'),
      A6: label('Return during the degree (per year)'), C6: input(0.03, PCT1),
      A7: label('Return while saving (per year, compounded monthly)'), C7: input(0.045, PCT1),
      A8: label('Years until university starts'), C8: input(11, '0'),
      A9: label('Invested today'), C9: input(10000, MONEY0),
      A10: label('Monthly amount the Lims can save'), C10: input(350, MONEY0),
      A12: header('Answers'),
      A13: label('(a) Fund needed when university starts'), C13: answer(MONEY),
      A14: label('(b) Value of today\'s investment by then'), C14: answer(MONEY),
      A15: label('(c) Monthly saving needed'), C15: answer(MONEY),
      A16: label('(d) Months needed at the amount in C10'), C16: answer('0.0'),
      A17: label('(e) Yearly return needed with C10 a month for C8 years'), C17: answer(PCT),
      A19: label('(g) Trial yearly return (Goal Seek changes this)'), C19: input(0.04, PCT, 'A starting guess for Goal Seek'),
      A20: label('(g) Fund at the trial return when university starts'), C20: answer(MONEY),
      E2: header('Return'), F2: header('Saving needed'), G2: header('Months at C10'),
      F3: givenF('=C15', MONEY), G3: givenF('=C16', '0.0'),
      ...column('E', 4, SAVING_RATES, PCT1),
      ...answers(['F'], 4, 8, MONEY),
      ...answers(['G'], 4, 8, '0.0'),
    },
  },
  tasks: [
    {
      id: 'a',
      kind: 'formula',
      cells: 'C13',
      marks: 1.5,
      prompt:
        '(a) In C13 use `PV` for the fund needed on the first day of university: C5 yearly fees of C4, each paid at the start of the year, while the rest earns C6. ' +
        'The fees leave the fund (negative), so the fund needed is positive.',
      solution: '=PV(C6,C5,-C4,0,1)',
      wrong: ['=PV(C6,C5,-C4)', '=PV(C6/12,C5,-C4,0,1)', '=C4*C5', '=PV(C6,4,-C4,0,1)'],
      hints: ['Yearly fees, yearly rate: no /12 here.', 'Fees at the start of each year: type = 1.'],
      explain: '=PV(C6,C5,-C4,0,1) = $91,886.67, less than 4 x $24,000 because the money for the later years keeps earning 3% until it is spent.',
    },
    {
      id: 'b',
      kind: 'formula',
      cells: 'C14',
      marks: 1,
      prompt: '(b) In C14 use `FV` for what today\'s C9 grows to by the time university starts (no monthly saving in this part).',
      solution: '=FV(C7/12,C8*12,0,-C9)',
      wrong: ['=FV(C7,C8,0,-C9)', '=FV(C7/12,C8*12,0,C9)', '=FV(C7/12,C8,0,-C9)', '=FV(C7/12,132,0,-C9)'],
      hints: ['Monthly compounding: rate C7/12 for C8*12 months.', 'pmt is 0 here and pv is -C9.'],
      explain:
        '=FV(C7/12,C8*12,0,-C9) = $16,389.80. Compounding yearly instead, FV(C7,C8,0,-C9), gives $16,228.53: monthly compounding earns interest on interest sooner.',
    },
    {
      id: 'c',
      kind: 'formula',
      cells: 'C15',
      marks: 2,
      prompt:
        '(c) In C15 use `PMT` for the monthly saving (end of month) that, together with today\'s C9, reaches the fund needed in C13 when university starts. Keep Excel\'s signs: money the Lims put in is negative.',
      solution: '=PMT(C7/12,C8*12,-C9,C13)',
      wrong: ['=PMT(C7/12,C8*12,0,C13)', '=PMT(C7/12,C8*12,-C9,C13-C14)', '=PMT(C7/12,C8*12,C9,C13)', '=PMT(C7,C8,-C9,C13)', '=PMT(C7/12,132,-C9,C13)'],
      hints: [
        '`PMT(rate, nper, pv, fv)`: pv = -C9 (already invested), fv = +C13 (what the fund must reach).',
        'Do not subtract C14 from C13 as well: the pv argument already counts the growth of the $10,000.',
      ],
      explain:
        '=PMT(C7/12,C8*12,-C9,C13) = -$443.07 a month. Putting C9 in the pv slot lets PMT grow it for the C8 years; subtracting C14 too would count it twice.',
    },
    {
      id: 'd',
      kind: 'formula',
      cells: 'C16',
      marks: 1.5,
      prompt:
        '(d) The Lims can only save C10 at the end of each month, on top of today\'s C9. In C16 use `NPER` for the number of months it takes to reach C13. ' +
        'Leave the result unrounded.',
      solution: '=NPER(C7/12,-C10,-C9,C13)',
      wrong: ['=NPER(C7,-C10,-C9,C13)', '=NPER(C7/12,-C10,0,C13)', '=NPER(C7/12,C10,C9,C13)', '=ROUNDUP(NPER(C7/12,-C10,-C9,C13),0)'],
      hints: ['The rate must be per month, like the savings.', 'Same signs as part (c): the saving and today\'s investment are negative, the target positive.'],
      explain: '=NPER(C7/12,-C10,-C9,C13) = 155.9 months, about two years longer than the 132 months available.',
    },
    {
      id: 'e',
      kind: 'formula',
      cells: 'C17',
      marks: 1.5,
      prompt:
        '(e) In C17 use `RATE` for the yearly return they would need to reach C13 in C8 years, saving C10 a month on top of today\'s C9. ' +
        'Give it per year in the same form as C7 (a yearly rate compounded monthly).',
      solution: '=RATE(C8*12,-C10,-C9,C13)*12',
      wrong: [
        '=RATE(C8*12,-C10,-C9,C13)', '=RATE(C8,-C10,-C9,C13)*12', '=RATE(C8*12,-C10,0,C13)*12', '=RATE(132,-C10,-C9,C13)*12',
        '=(1+RATE(C8*12,-C10,-C9,C13))^12-1',
      ],
      hints: ['nper = C8*12 months; RATE returns the monthly rate.', 'Multiply by 12 for the yearly rate.'],
      explain: '=RATE(C8*12,-C10,-C9,C13)*12 = 7.16% a year, well above the 4.5% they expect.',
    },
    {
      id: 'f',
      kind: 'tool',
      tool: 'datatable',
      cells: 'F4:G8',
      marks: 2,
      prompt:
        '(f) F3 and G3 link to parts (c) and (d). Select E3:G8 and create a one-variable Data Table that shows both for saving returns of 3% to 7% (column input cell C7).',
      toolSetup: { range: 'E3:G8', colInput: 'C7' },
      answer: { F4: -499.382888156073, F8: -355.2572192926, G4: 174.463107177881, G8: 133.182274275896 },
      check: { tol: 0.01 },
      hints: ['Select from E3 (empty corner) to G8.', 'The returns run down a column: Column input cell = C7.'],
      explain: 'Each row re-runs the model with that return in C7. A higher return lowers the saving needed and shortens the time at $350 a month.',
    },
    {
      id: 'gap',
      kind: 'formula',
      cells: 'C20',
      marks: 0.5,
      prompt:
        '(g) Check part (e) by trial and error, as the course checks RATE. First, in C20 use `FV` for what today\'s C9 plus C10 a month grow to in C8 years ' +
        'at the trial return in C19 (a yearly rate compounded monthly).',
      solution: '=FV(C19/12,C8*12,-C10,-C9)',
      check: { mustUse: ['FV'] },
      wrong: ['=FV(C19,C8,-C10,-C9)', '=FV(C7/12,C8*12,-C10,-C9)', '=FV(C19/12,C8*12,0,-C9)', '=FV(C19/12,C8*12,C10,C9)', '=FV(C19/12,132,-C10,-C9)'],
      hints: [
        'Same kind of FV as part (b), but now the monthly saving is the pmt and the rate is the trial return C19.',
        'FV(C19/12, C8*12, pmt, pv) with both the saving and today\'s investment negative (paid in).',
      ],
      explain:
        '=FV(C19/12,C8*12,-C10,-C9) = $73,430.72 at the 4% starting guess, well short of the $91,886.67 needed. Goal Seek can now raise the trial return until the two match.',
    },
    {
      id: 'g',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'C19',
      marks: 0.5,
      prompt:
        '(g) Then use Goal Seek to make C20 reach the fund needed: set C20 to the amount shown in C13 (type it as a number) by changing C19. Compare the return it finds with part (e).',
      toolSetup: { setCell: 'C20', toValue: 91886.6725174724, changingCell: 'C19' },
      answer: { C19: 0.0715669003440282 },
      check: { tol: 1e-5 },
      wrong: ['0.04', '0.045'],
      hints: [
        'Goal Seek\'s To value must be a number, not a cell reference: type the fund needed, 91886.67.',
        'Set cell C20, To value 91886.67, By changing cell C19.',
      ],
      explain: 'Goal Seek finds 7.16%, the same as RATE: RATE is Excel doing this trial and error for you.',
    },
    {
      id: 'h',
      kind: 'explain',
      cells: '',
      marks: 1.5,
      prompt: '(h) Interpret parts (c) to (e) for the Lims: is $350 a month enough, and what are their options?',
      answer:
        'No. At 4.5% they need about $443 a month; $350 a month reaches the target only after about 156 months, roughly two years after university starts, ' +
        'or they would need a 7.2% return, which means taking much more investment risk. The practical options are to save about $93 more a month, add a lump sum now, ' +
        'or plan to pay part of the fees from other money.',
    },
  ],
  testCases: [
    { name: 'Fees of $27,000 a year and $15,000 invested today', inputs: { C4: 27000, C9: 15000 } },
    { name: 'Saving return of 5.5% and $400 a month', inputs: { C7: 0.055, C10: 400 } },
    { name: 'A 3-year degree, earning 2% during it', inputs: { C5: 3, C6: 0.02 } },
    { name: 'University starts in 10 years', inputs: { C8: 10 } },
  ],
  skills: ['PV with type 1', 'FV', 'PMT', 'NPER', 'RATE', 'one-variable data table', 'Goal Seek'],
  techniques: [
    'Time value of money (NPV vs lump sum)',
    'What-if / scenario analysis by changing inputs',
    'Goal Seek',
    'Written interpretation of model results',
  ],
}

export const exercises: readonly Exercise[] = [
  pmtDrill,
  pvFvDrill,
  rateNperDrill,
  npvIrrDrill,
  circularDrill,
  normalDrill,
  feeOffer,
  shedFund,
  loanSchedule,
  growthGrid,
  mortgageTables,
  bonusModel,
  optionPricing,
  outletExam,
  fundExam,
]
