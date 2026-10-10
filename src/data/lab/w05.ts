import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 5 Monte Carlo simulation: RAND/RANDBETWEEN (and one stored draw tested twice), CRF tables with LOOKUP / VLOOKUP TRUE,
// resampling (M1 bins, M2a SMALL + RANDBETWEEN, M2b PERCENTILE + RAND, M3 inversion: NORMINV, -mean*LN(RAND()), CRITBINOM for
// binomial and Poisson counts), checks against exact results (SUMPRODUCT, BINOMDIST), Data Table replications on a blank input
// cell and their statistics, a Monty-Hall-style game, capacity sizing from a percentile and storage sizing from cumulative
// supply and demand under random rain. Scenarios and data are original.
// Random targets are exact expectations, probabilities or SDs (or long-run simulations); tolerances are >= 4 standard errors.
// RAND() lives in given cells or task references only: never in input cells, which test cases overwrite and restore.

type Cells = Record<string, CellSpec>

const withFmt = (fmt?: string) => (fmt ? { fmt } : {})
const label = (v: string, bold = false): CellSpec => ({ v, role: 'label', ...(bold ? { bold } : {}) })
const header = (v: CellValue): CellSpec => ({ v, role: 'header' })
const input = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'input', ...withFmt(fmt) })
const given = (v: CellValue, fmt?: string): CellSpec => ({ v, role: 'given', ...withFmt(fmt) })
const calc = (f: string, fmt?: string): CellSpec => ({ f, role: 'given', ...withFmt(fmt) })
const answer = (fmt?: string): CellSpec => ({ role: 'answer', ...withFmt(fmt) })

// one spec per row of a column, e.g. column('A', 8, 27, (i) => given(i + 1))
function column(col: string, first: number, last: number, make: (i: number, row: number) => CellSpec): Cells {
  const out: Cells = {}
  for (let row = first; row <= last; row++) out[`${col}${row}`] = make(row - first, row)
  return out
}
const runs = (col: string, first: number, count: number): Cells => column(col, first, first + count - 1, (i) => given(i + 1, '0'))
const answers = (col: string, first: number, last: number, fmt?: string): Cells => column(col, first, last, () => answer(fmt))
const listed = (col: string, first: number, data: readonly CellValue[], make: (v: CellValue) => CellSpec): Cells =>
  column(col, first, first + data.length - 1, (i) => make(data[i]))

// ---------- level 1 drills ----------

const kopi: Exercise = {
  id: 'w5-rand-toast-brew',
  week: 'W5',
  topic: 'RAND() draws',
  title: 'Yes/no events, uniform times and a three-way choice with RAND()',
  level: 1,
  minutes: 8,
  scenario:
    'A kopi stall in Toa Payoh wants a feel for its next 20 customers before the morning rush. Its tally sheets show that 35% of ' +
    'customers add a kaya toast set, that brewing a drink takes anywhere from 1.5 to 3.5 minutes (every value equally likely), and that ' +
    'half the customers order kopi, 30% teh and the rest Milo. Simulate the 20 customers with RAND().',
  sheet: {
    rows: 29,
    cols: 5,
    cells: {
      A1: label('Kopi stall: the next 20 customers', true),
      A3: label('P(customer adds a toast set)'), B3: input(0.35, '0%'),
      A4: label('Shortest brew (min)'), B4: input(1.5, '0.0'),
      A5: label('Longest brew (min)'), B5: input(3.5, '0.0'),
      D3: label('P(orders kopi)'), E3: input(0.5, '0%'),
      D4: label('P(orders teh)'), E4: input(0.3, '0%'),
      D5: { v: 'Everyone else orders Milo', role: 'note' },
      A7: header('Customer'), B7: header('Toast set?'), C7: header('Brew time (min)'), D7: header('RAND()'), E7: header('Drink'),
      ...runs('A', 8, 20),
      ...answers('B', 8, 27),
      ...answers('C', 8, 27, '0.00'),
      ...column('D', 8, 27, () => calc('=RAND()', '0.000')),
      ...answers('E', 8, 27),
      A29: label('Share with a toast set'), B29: answer('0%'),
    },
    colWidths: { A: 200, B: 100, C: 120, D: 130, E: 90 },
  },
  tasks: [
    {
      id: 'toast',
      kind: 'formula',
      cells: 'B8:B27',
      prompt:
        'In B8 show "Yes" when the customer adds a toast set and "No" otherwise, with `RAND` inside `IF` and the probability as the ' +
        'absolute reference $B$3. Fill down to B27.',
      solution: '=IF(RAND()<$B$3,"Yes","No")',
      random: { trials: 50, stat: 'p', event: 'Yes', target: 0.35, tol: 0.065 },
      check: { absolute: ['$B$3'] },
      wrong: ['=IF(RAND()>$B$3,"Yes","No")', '=IF(RAND()<0.35,"Yes","No")', '=IF(RAND()<B3,"Yes","No")', '=IF(RAND()>0.65,"Yes","No")'],
      hints: [
        'RAND() is equally likely to land anywhere between 0 and 1, so it falls below 0.35 on 35% of draws.',
        'Compare a fresh RAND() with the probability cell inside IF, and anchor that cell so every row still points at it after filling down.',
        'The pattern is IF(RAND() < probability, "Yes", "No"), with the probability read from $B$3.',
      ],
      explain:
        'RAND() is uniform on [0, 1), so P(RAND() < 0.35) = 0.35 and the "Yes" branch fires on 35% of draws. Each row has its own RAND(), ' +
        'so customers are independent. $B$3 keeps pointing at the probability when you fill down; typing 0.35 into the formula would ' +
        'ignore a change in B3. Press F9: the pattern of Yes and No changes, but over many redraws about 35% are Yes.',
    },
    {
      id: 'brew',
      kind: 'formula',
      cells: 'C8:C27',
      prompt:
        'In C8 draw a brew time that is equally likely to be anywhere between the shortest and the longest time, with `RAND` and the ' +
        'absolute references $B$4 and $B$5. Fill down to C27.',
      solution: '=$B$4+RAND()*($B$5-$B$4)',
      random: { trials: 50, stat: 'mean', target: 2.5, tol: 0.08 },
      check: { mustUse: ['RAND'], absolute: ['$B$4', '$B$5'] },
      wrong: ['=$B$4+RAND()*$B$5', '=RAND()*($B$5-$B$4)', '=RANDBETWEEN($B$4,$B$5)', '=$B$4+RAND()*2', '=B4+RAND()*(B5-B4)'],
      hints: [
        'RAND() covers a range 1 wide that starts at 0. Stretch it to the width of the brew range, then shift it so it starts at the shortest time.',
        'Width = longest - shortest, start = shortest; anchor both cells with $.',
        'The course pattern is min + RAND()*(max - min), with $B$4 as min and $B$5 as max.',
      ],
      explain:
        'RAND()*(max-min) is uniform on [0, max-min); adding min moves it to [min, max), here 1.5 to 3.5 minutes with mean 2.5. ' +
        'RANDBETWEEN would only return whole minutes (2 or 3 here), which is not a continuous uniform time.',
    },
    {
      id: 'drink',
      kind: 'formula',
      cells: 'E8:E27',
      prompt:
        'Column D holds one `RAND` per customer. In E8 return "Kopi" when D8 is below the kopi share in E3, "Teh" when D8 is below the ' +
        'kopi and teh shares added together, and "Milo" otherwise: one nested `IF` that tests the same D8 twice. Fill down to E27.',
      solution: '=IF(D8<$E$3,"Kopi",IF(D8<$E$3+$E$4,"Teh","Milo"))',
      wrong: [
        '=IF(RAND()<$E$3,"Kopi",IF(RAND()<$E$3+$E$4,"Teh","Milo"))', '=IF(D8<$E$3,"Kopi",IF(D8<$E$4,"Teh","Milo"))',
        '=IF(D8<0.5,"Kopi",IF(D8<0.8,"Teh","Milo"))', '=IF(D8>$E$3,"Kopi",IF(D8>$E$3+$E$4,"Teh","Milo"))',
      ],
      hints: [
        'Cut the 0-1 range of ONE random number into three pieces as wide as the shares: below 50% kopi, 50% to 80% teh, the rest Milo.',
        'The second IF only sees numbers of at least the kopi share, so its threshold is the kopi and teh shares added together.',
        'IF(D8 < kopi share, "Kopi", IF(D8 < kopi share + teh share, "Teh", "Milo")), with $E$3 and $E$4 anchored.',
      ],
      explain:
        'Both tests read the same number, so each customer gets exactly one draw and the three intervals have the right widths: 50%, 30% ' +
        'and 20%. Writing RAND() in both tests draws twice: a customer who is not a kopi drinker gets a fresh number, so teh comes out ' +
        '50% x 80% = 40% of the time and Milo only 10%. That is why a draw that is tested more than once goes in its own cell (column D) and ' +
        'is referred to, while a draw used once (column B) can stay inside the formula. The other fix is a second draw with a conditional ' +
        'probability: IF(RAND()<50%, "Kopi", IF(RAND()<30%/50%, "Teh", "Milo")).',
    },
    {
      id: 'share',
      kind: 'formula',
      cells: 'B29',
      prompt: 'In B29 work out the share of the 20 simulated customers who add a toast set, with `COUNTIF`.',
      solution: '=COUNTIF(B8:B27,"Yes")/COUNT(A8:A27)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(B8:B27,"Yes")', '=COUNTIF(B8:B27,"No")/COUNT(A8:A27)'],
      hints: [
        'A share is a count divided by the number of customers.',
        'COUNTIF(range,"Yes") counts the Yes cells.',
        'COUNTIF(B8:B27,"Yes") divided by the 20 customers (COUNT(A8:A27) counts them).',
      ],
      explain:
        'Count / number of customers is the relative frequency, the simulated estimate of 35%. With only 20 customers it swings a lot ' +
        'from one F9 to the next (standard error about 11 percentage points): more customers or replications make it steadier.',
    },
  ],
  testCases: [
    { name: 'the toast-set probability rises to 60%', inputs: { B3: 0.6 } },
    { name: 'kopi falls to 40% and teh rises to 45%', inputs: { E3: 0.4, E4: 0.45 } },
  ],
  skills: ['RAND', 'Bernoulli event with IF(RAND()<p)', 'continuous uniform min+RAND()*(max-min)', 'nested IF on one stored RAND()', 'COUNTIF share'],
  techniques: [
    'Bernoulli event (RAND() < p)',
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
  ],
}

const bouquets: Exercise = {
  id: 'w5-crf-lookup-bouquets',
  week: 'W5',
  topic: 'CRF table + LOOKUP(RAND())',
  title: 'Build the cumulative column, then draw with LOOKUP(RAND())',
  level: 1,
  minutes: 7,
  scenario:
    'A Bugis florist sells bouquets online. Last quarter, 45% of orders were for one bouquet, 25% for two, 15% for three, 10% for four ' +
    'and 5% for five. Turn the table into lower-bound cumulative probabilities, simulate the next 20 orders and check them against ' +
    'the expected value.',
  sheet: {
    rows: 23,
    cols: 8,
    cells: {
      A1: label('Online bouquet orders', true),
      A3: header('Bouquets per order'), B3: header('Probability'), C3: header('Cum. prob (lower bound)'),
      ...runs('A', 4, 5),
      ...listed('B', 4, [0.45, 0.25, 0.15, 0.1, 0.05], (v) => input(v, '0%')),
      C4: given(0, '0%'),
      ...answers('C', 5, 8, '0%'),
      E3: header('Order'), F3: header('Bouquets'),
      ...runs('E', 4, 20),
      ...answers('F', 4, 23, '0'),
      H3: label('Expected bouquets per order'), H4: answer('0.00'),
      H6: label('Simulated average, 20 orders'), H7: answer('0.00'),
    },
    colWidths: { A: 130, B: 90, C: 170, F: 90, H: 200 },
  },
  tasks: [
    {
      id: 'crf',
      kind: 'formula',
      cells: 'C5:C8',
      prompt: 'C4 holds 0, the lower bound for one bouquet. In C5 enter the cumulative probability of all smaller orders (the lower bound for two bouquets) and fill down to C8.',
      solution: '=C4+B4',
      wrong: ['=C4+B5', '=SUM($B$4:B5)', '=B4'],
      hints: [
        'The interval for two bouquets starts where the interval for one bouquet ends.',
        'So each lower bound is the previous lower bound plus the previous size\'s probability.',
        'C5 = C4 + B4 (or SUM the probabilities from B4 down to the row above), filled down.',
      ],
      explain:
        'LOOKUP and VLOOKUP TRUE pick the largest lower bound that is <= the random number, so each size needs the cumulative probability ' +
        'of all smaller sizes beside it: 0, 45%, 70%, 85%, 95%, the course\'s down-shifted CRF column. =SUM($B$4:B4) gives the same ' +
        'column. Writing the running total including the own row (45%, 70% ... 100%) here gives upper bounds and shifts every draw by one ' +
        'size. The course\'s other layout keeps those running totals beside the sizes, puts a 0 in the row above, and starts the lookup ' +
        'vector one row higher: the same draws.',
    },
    {
      id: 'draw',
      kind: 'formula',
      cells: 'F4:F23',
      prompt: 'In F4 simulate the bouquets in one order with `LOOKUP` on a fresh `RAND`, the lower bounds in C4:C8 and the sizes in A4:A8. Fill down to F23.',
      solution: '=LOOKUP(RAND(),$C$4:$C$8,$A$4:$A$8)',
      random: { trials: 50, stat: 'mean', target: 2.05, tol: 0.16 },
      // a random task has no test cases: the $ check is what names the missing anchor (else #N/A further down)
      check: { absolute: ['$C$4:$C$8', '$A$4:$A$8'] },
      wrong: [
        '=LOOKUP(RAND(),$B$4:$B$8,$A$4:$A$8)', '=LOOKUP(RAND(),$C$4:$C$8,$A$5:$A$9)', '=LOOKUP(0.5,$C$4:$C$8,$A$4:$A$8)',
        '=LOOKUP(RAND(),C4:C8,A4:A8)', '=RANDBETWEEN(1,5)',
      ],
      hints: [
        'LOOKUP(value, lookup_vector, result_vector) finds the largest entry of lookup_vector that is <= value and returns the matching result.',
        'Look up a new RAND() in the cumulative column, not in the probability column, and lock both ranges.',
        'LOOKUP(RAND(), lower bounds $C$4:$C$8, sizes $A$4:$A$8).',
      ],
      explain:
        'RAND() falls in [0, 45%) on 45% of draws, giving one bouquet, in [45%, 70%) on 25%, giving two, and so on: each interval is as ' +
        'wide as that size\'s probability. The probability column cannot be the lookup vector because it is not sorted ascending ' +
        '(LOOKUP then returns #N/A or the wrong size). VLOOKUP with TRUE does the same job only when the sizes sit to the right of the ' +
        'lower bounds, because VLOOKUP searches the first column of its table.',
    },
    {
      id: 'expected',
      kind: 'formula',
      cells: 'H4',
      prompt: 'In H4 compute the expected number of bouquets per order from the table with `SUMPRODUCT`.',
      solution: '=SUMPRODUCT(A4:A8,B4:B8)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=AVERAGE(A4:A8)', '=SUMPRODUCT(A4:A8,C4:C8)'],
      hints: [
        'An expected value weights each possible value by its probability.',
        'Multiply each size by its probability and add the five products.',
        'SUMPRODUCT(sizes A4:A8, probabilities B4:B8) does both steps at once.',
      ],
      explain:
        'E[X] = 1(0.45) + 2(0.25) + 3(0.15) + 4(0.10) + 5(0.05) = 2.05 bouquets. AVERAGE of the sizes (3) ignores that one-bouquet orders ' +
        'are nine times as common as five-bouquet orders.',
    },
    {
      id: 'simavg',
      kind: 'formula',
      cells: 'H7',
      prompt: 'In H7 average the 20 simulated orders in F4:F23, to set beside the expected value in H4.',
      solution: '=AVERAGE(F4:F23)',
      wrong: ['=AVERAGE(A4:A8)', '=AVERAGE(F4:F22)', '=SUM(F4:F23)'],
      hints: ['Use the simulated column, not the table.', 'AVERAGE over all 20 orders, F4 to F23.', 'AVERAGE(F4:F23).'],
      explain:
        'Press F9 a few times: H7 scatters around 2.05 (standard error about 0.27 with 20 orders) while H4 stays put. More simulated ' +
        'orders pull the average closer to the exact value: that is how the course uses a simulation to check an analytical result.',
    },
  ],
  testCases: [
    { name: 'the shares become 40%, 20%, 20%, 10%, 10%', inputs: { B4: 0.4, B5: 0.2, B6: 0.2, B7: 0.1, B8: 0.1 } },
    { name: 'the shares become 25%, 25%, 25%, 15%, 10%', inputs: { B4: 0.25, B5: 0.25, B6: 0.25, B7: 0.15, B8: 0.1 } },
  ],
  skills: ['CRF lower bounds', 'LOOKUP(RAND(), CRF, values)', 'expected value with SUMPRODUCT', 'simulated vs expected value'],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'SUMPRODUCT totals and weighted/expected values',
  ],
}

const hub: Exercise = {
  id: 'w5-inverse-transform-hub',
  week: 'W5',
  topic: 'Inverse transform (M3)',
  title: 'Normal, exponential, binomial and Poisson draws by inversion',
  level: 1,
  minutes: 8,
  scenario:
    'A container depot in Tuas plans tomorrow\'s shift for 20 trucks. Unloading a truck takes a normally distributed time (mean 42, SD 6 ' +
    'minutes), the gap before the next truck is exponential with mean 15 minutes, each of the 40 pallets on a truck fails ' +
    'inspection with probability 5%, and inspectors log on average 1.5 damage reports (dents, torn seals) per truck. Draw all four ' +
    'with RAND() and the inverse distribution functions taught this week.',
  sheet: {
    rows: 29,
    cols: 5,
    cells: {
      A1: label('Container depot: one shift, 20 trucks', true),
      A3: label('Unload time (min): mean'), B3: input(42, '0.0'),
      A4: label('Unload time (min): SD'), B4: input(6, '0.0'),
      A5: label('Gap between trucks (min): mean'), B5: input(15, '0.0'),
      A6: label('Pallets on a truck'), B6: input(40, '0'),
      A7: label('P(a pallet fails inspection)'), B7: input(0.05, '0%'),
      A8: label('Damage reports per truck: mean'), B8: input(1.5, '0.0'),
      A9: header('Truck'), B9: header('Unload (min)'), C9: header('Gap to next (min)'), D9: header('Failed pallets'), E9: header('Damage reports'),
      ...runs('A', 10, 20),
      ...answers('B', 10, 29, '0.0'),
      ...answers('C', 10, 29, '0.0'),
      ...answers('D', 10, 29, '0'),
      ...answers('E', 10, 29, '0'),
    },
    colWidths: { A: 220, B: 110, C: 130, D: 110, E: 120 },
  },
  tasks: [
    {
      id: 'normal',
      kind: 'formula',
      cells: 'B10:B29',
      prompt: 'In B10 draw a normal unload time with mean B3 and SD B4: `NORMINV` of a `RAND`. Fill down to B29.',
      solution: '=NORMINV(RAND(),$B$3,$B$4)',
      // share below mean - 1 SD (36 min) = NORMSDIST(-1): unlike the mean it also sees a wrong SD argument
      random: { trials: 50, stat: 'p', event: '<36', target: 0.1587, tol: 0.05 },
      check: { absolute: ['$B$3', '$B$4'] },
      wrong: [
        '=NORMINV(RAND(),$B$4,$B$3)', '=NORMDIST(RAND(),$B$3,$B$4,TRUE)', '=NORMINV(0.5,$B$3,$B$4)', '=NORMINV(RAND(),B3,B4)',
        '=NORMINV(RAND(),42,6)', '=NORMINV(RAND(),$B$5,$B$4)', '=NORMINV(RAND(),$B$3,$B$3)', '=NORMINV(RAND(),$B$3,$B$4^2)',
        '=NORMINV(RAND(),$B$3,$B$4*2)',
      ],
      hints: [
        'Inversion: treat RAND() as a cumulative probability and ask which unload time has that much probability below it.',
        'NORMINV(probability, mean, standard_dev) answers exactly that question.',
        'NORMINV(RAND(), $B$3, $B$4): a fresh RAND() first, then the mean and the SD, both anchored.',
      ],
      explain:
        'NORMINV turns a uniform cumulative probability into the matching point of the normal curve: RAND() = 0.5 gives the mean 42 and ' +
        'RAND() = 0.975 gives 42 + 1.96 x 6 = 53.8 minutes. NORMDIST goes the other way (value to probability), so it cannot draw values. ' +
        'NORM.INV is the newer name of NORMINV, and $B$3+$B$4*NORMSINV(RAND()) draws the same times from a standard normal z. A time ' +
        'cannot be negative: when the mean is only a few SDs above zero, exam models wrap the draw in MAX(0, ...) or MAX(minimum, ...), ' +
        'as in the generator exercise.',
    },
    {
      id: 'exponential',
      kind: 'formula',
      cells: 'C10:C29',
      prompt: 'In C10 draw an exponential gap with mean B5 minutes by inverting the exponential CDF with `LN` and `RAND`. Fill down to C29.',
      solution: '=-$B$5*LN(RAND())',
      random: { trials: 50, stat: 'mean', target: 15, tol: 2.4 },
      check: { absolute: ['$B$5'] },
      wrong: ['=-LN(RAND())/$B$5', '=$B$5*LN(RAND())', '=EXPONDIST(RAND(),1/$B$5,TRUE)', '=-B5*LN(RAND())', '=-15*LN(RAND())'],
      hints: [
        'Inversion: set RAND() equal to the exponential CDF, 1 - EXP(-x/mean), and solve for x.',
        'That gives x = -mean*LN(1-RAND()); 1-RAND() is just as uniform as RAND(), so -mean*LN(RAND()) works too.',
        '-$B$5*LN(RAND()). Mind the minus sign: LN of a number below 1 is negative.',
      ],
      explain:
        'The exponential CDF is 1 - EXP(-x/mean); solving it for x at a random probability gives -mean*LN(1-RAND()), and the course ' +
        'shortcut -mean*LN(RAND()) is equivalent. Most gaps are short and a few are long: the mean is 15 but the median only about 10.4 ' +
        'minutes. Dividing by the mean treats it as a rate by mistake.',
    },
    {
      id: 'binomial',
      kind: 'formula',
      cells: 'D10:D29',
      prompt: 'In D10 draw how many of the B6 pallets fail inspection (each with probability B7) using `CRITBINOM` with a `RAND`. Fill down to D29.',
      solution: '=CRITBINOM($B$6,$B$7,RAND())',
      random: { trials: 50, stat: 'mean', target: 2, tol: 0.18 },
      check: { absolute: ['$B$6', '$B$7'] },
      wrong: [
        '=CRITBINOM($B$7,$B$6,RAND())', '=CRITBINOM($B$6,1-$B$7,RAND())', '=$B$6*$B$7', '=CRITBINOM(B6,B7,RAND())',
        '=CRITBINOM(40,0.05,RAND())',
      ],
      hints: [
        'CRITBINOM(trials, probability_s, alpha) returns the smallest count whose cumulative binomial probability reaches alpha.',
        'Use RAND() as alpha, with the number of pallets and the failure probability as the first two arguments.',
        'CRITBINOM($B$6, $B$7, RAND()).',
      ],
      explain:
        'With alpha = RAND(), CRITBINOM inverts the binomial CDF and returns a random Bin(40, 5%) count, mean 40 x 0.05 = 2 pallets. ' +
        'BINOM.INV is the newer name of the same function.',
    },
    {
      id: 'poisson',
      kind: 'formula',
      cells: 'E10:E29',
      prompt:
        'Damage reports have no fixed number of trials, only an average (B8 per truck): a Poisson count. In E10 draw truck 1\'s reports ' +
        'the course way, as a binomial with many trials: `CRITBINOM` with 1000 trials, probability B8/1000 and a `RAND`. Fill down to E29.',
      solution: '=CRITBINOM(1000,$B$8/1000,RAND())',
      random: { trials: 50, stat: 'mean', target: 1.5, tol: 0.17 },
      check: { absolute: ['$B$8'] },
      wrong: [
        '=CRITBINOM(1000,$B$8,RAND())', '=CRITBINOM($B$8,0.5,RAND())', '=CRITBINOM(1000,1/$B$8,RAND())', '=POISSON(RAND(),$B$8,TRUE)',
        '=CRITBINOM(1000,1.5/1000,RAND())', '=CRITBINOM(1000,B8/1000,RAND())',
      ],
      hints: [
        'A Poisson count with mean m behaves like a binomial with a huge number of trials n, each with a tiny probability m/n: its mean is still n x m/n = m.',
        'So invert a binomial with CRITBINOM: 1000 trials, probability B8/1000, and RAND() as alpha.',
        'CRITBINOM(1000, $B$8/1000, RAND()).',
      ],
      explain:
        'Excel has no inverse of POISSON, so the course borrows the binomial: 1000 trials with probability 0.0015 each give a count with ' +
        'mean 1.5 and almost exactly the Poisson shape (22.3% of trucks with no report either way). Use the real number of trials when the ' +
        'story has one (the 40 pallets); when only an average rate is known, use this Poisson trick with a large n. BINOM.INV works the same way.',
    },
  ],
  skills: ['NORMINV(RAND(), mean, sd)', 'exponential -mean*LN(RAND())', 'CRITBINOM(n, p, RAND())', 'Poisson via CRITBINOM(1000, mean/1000, RAND())'],
  techniques: [
    'Exponential inter-arrival times (-mean*LN(RAND()))',
    'Binomial random variable (CRITBINOM / BINOM.INV)',
  ],
}

const LOAVES = [52, 47, 58, 61, 45, 55, 94, 50, 53, 48, 57, 66, 51, 42, 56, 60, 85, 53, 49, 58, 63, 54, 46, 72, 55]
const PROOFING = [3.2, 2.8, 3.6, 4.1, 3.0, 2.5, 3.9, 3.4, 4.6, 3.1, 2.9, 3.7, 5.2, 3.3, 3.5]

// lays out values row by row across the given columns, e.g. grid('BCDEF', 4, LOAVES, ...) fills B4:F8
const grid = (cols: string, first: number, data: readonly CellValue[], make: (v: CellValue) => CellSpec): Cells =>
  Object.fromEntries(data.map((v, i) => [`${cols[i % cols.length]}${first + Math.floor(i / cols.length)}`, make(v)]))

const bakery: Exercise = {
  id: 'w5-resample-bakery-records',
  week: 'W5',
  topic: 'Resampling (M2)',
  title: 'Resample the records: SMALL + RANDBETWEEN (M2a) and PERCENTILE + RAND (M2b)',
  level: 1,
  minutes: 6,
  scenario:
    'A Tiong Bahru bakery logged its sourdough sales on 25 Saturdays (B4:F8, five Saturdays to a row) and the proofing time of 15 dough ' +
    'batches (B11:F13). Rather than fit a distribution, the owner wants to resample the records themselves to simulate 20 future ' +
    'Saturdays and batches.',
  sheet: {
    rows: 25,
    cols: 10,
    cells: {
      A1: label('Bakery records', true),
      A3: header('Loaves sold, 25 Saturdays'),
      ...listed('A', 4, ['Sat 1-5', 'Sat 6-10', 'Sat 11-15', 'Sat 16-20', 'Sat 21-25'], (v) => label(String(v))),
      ...grid('BCDEF', 4, LOAVES, (v) => given(v, '0')),
      A10: header('Proofing time, 15 batches (h)'),
      ...listed('A', 11, ['Batch 1-5', 'Batch 6-10', 'Batch 11-15'], (v) => label(String(v))),
      ...grid('BCDEF', 11, PROOFING, (v) => given(v, '0.0')),
      H3: label('Saturdays recorded'), I3: calc('=COUNT(B4:F8)', '0'),
      H5: header('Simulation'), I5: header('Loaves (M2a)'), J5: header('Proofing h (M2b)'),
      ...runs('H', 6, 20),
      ...answers('I', 6, 25, '0'),
      ...answers('J', 6, 25, '0.00'),
    },
    colWidths: { A: 110, B: 60, C: 60, D: 60, E: 60, F: 60, G: 30, H: 150, I: 110, J: 140 },
  },
  tasks: [
    {
      id: 'm2a',
      kind: 'formula',
      cells: 'I6:I25',
      prompt:
        'In I6 resample one Saturday with method M2a: draw a random rank from 1 to the count in I3 with `RANDBETWEEN`, then return the ' +
        'record of that rank from the block B4:F8 with `SMALL`. Fill down to I25.',
      solution: '=SMALL($B$4:$F$8,RANDBETWEEN(1,$I$3))',
      random: { trials: 50, stat: 'mean', target: 57.2, tol: 2 },
      // the mean alone cannot tell M2a from M2b or a fitted normal (both average about 57): require the RANDBETWEEN rank
      check: { mustUse: ['RANDBETWEEN'], absolute: ['$B$4:$F$8'] },
      wrong: [
        '=RANDBETWEEN(MIN($B$4:$F$8),MAX($B$4:$F$8))', '=SMALL($B$4:$F$8,RANDBETWEEN(0,$I$3))', '=SMALL($B$4:$F$8,$I$3)',
        '=SMALL(B4:F8,RANDBETWEEN(1,I3))', '=PERCENTILE($B$4:$F$8,RAND())', '=INDEX($B$4:$F$8,RANDBETWEEN(1,$I$3))',
        '=NORMINV(RAND(),AVERAGE($B$4:$F$8),STDEV($B$4:$F$8))',
      ],
      hints: [
        'Resampling reuses the recorded values, each record equally likely; it does not invent new ones.',
        'RANDBETWEEN(1, count) picks a random rank k, and SMALL(data, k) returns the k-th smallest record, so the block need not be sorted first.',
        'SMALL($B$4:$F$8, RANDBETWEEN(1, $I$3)).',
      ],
      explain:
        'Each of the 25 records has the same 1-in-25 chance of being picked, so typical Saturdays of 50-60 loaves come up often and the ' +
        'festive 85 and 94 only rarely, just as in the log. SMALL reads the whole 5 x 5 block; INDEX needs a random row and a random column, ' +
        'INDEX($B$4:$F$8,RANDBETWEEN(1,5),RANDBETWEEN(1,5)), which gives the same distribution (past exam keys accept both forms). ' +
        'RANDBETWEEN(MIN, MAX) would make every number from 42 to 94 equally likely, which the records do not support.',
    },
    {
      id: 'm2b',
      kind: 'formula',
      cells: 'J6:J25',
      prompt: 'In J6 resample a proofing time with method M2b: `PERCENTILE` of the 15 batches in B11:F13 at a random percentile from `RAND`. Fill down to J25.',
      solution: '=PERCENTILE($B$11:$F$13,RAND())',
      random: { trials: 50, stat: 'mean', target: 3.4964, tol: 0.085 },
      // M2a on these batches averages 3.52, inside tol: rule it out by name (PERCENTILE.INC counts as PERCENTILE)
      check: { mustUse: ['PERCENTILE'], absolute: ['$B$11:$F$13'] },
      wrong: [
        '=PERCENTILE($B$11:$F$13,RANDBETWEEN(0,1))', '=PERCENTILE($B$11:$F$13,0.5)', '=PERCENTILE($B$11:$F$13,RAND()*100)',
        '=PERCENTILE(B11:F13,RAND())', '=SMALL($B$11:$F$13,RANDBETWEEN(1,15))',
      ],
      hints: [
        'PERCENTILE(data, k) returns the value below which a fraction k of the data lies, interpolating between neighbouring values.',
        'Let RAND() choose k; k must stay between 0 and 1.',
        'PERCENTILE($B$11:$F$13, RAND()).',
      ],
      explain:
        'PERCENTILE sorts the 15 times and joins neighbouring values with straight lines, so RAND() = 0.5 returns the median and other ' +
        'draws land between recorded times: realistic new values, which suits continuous data such as hours (M2a would only ever repeat ' +
        'the 15 recorded times). k must be a fraction: PERCENTILE(..., 37) gives #NUM!.',
    },
  ],
  skills: ['SMALL(data, RANDBETWEEN(1, N)) (M2a)', 'PERCENTILE(data, RAND()) (M2b)', 'resampling a block of records'],
  techniques: ['Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))'],
}

const rider: Exercise = {
  id: 'w5-datatable-rider-trips',
  week: 'W5',
  topic: 'Data Table replications',
  title: 'Replicate a random model 100 times with a blank input cell',
  level: 1,
  minutes: 6,
  scenario:
    'A Punggol cloud kitchen sends a rider out with five drops per trip; each leg takes an exponential time with mean 6 minutes. ' +
    'One trip is already modelled in B4:B10. Replicate the trip 100 times with a Data Table and estimate the average trip time.',
  sheet: {
    rows: 103,
    cols: 8,
    cells: {
      A1: label('Rider trip model', true),
      A2: label('Mean time per leg (min)'), B2: input(6, '0.0'),
      A3: header('Leg'), B3: header('Minutes'),
      ...column('A', 4, 8, (i) => label(`Leg ${i + 1}`)),
      ...column('B', 4, 8, () => calc('=-$B$2*LN(RAND())', '0.00')),
      A10: label('Trip time (min)'), B10: calc('=SUM(B4:B8)', '0.00'),
      D2: header('Run'), E2: header('Trip time'),
      E3: answer('0.00'),
      ...runs('D', 4, 100),
      ...answers('E', 4, 103, '0.00'),
      G2: label('Average trip time (min)'), H2: answer('0.00'),
      H5: { note: 'An empty cell: use it as the Column input cell of the data table' },
    },
    colWidths: { A: 170, E: 100, G: 170 },
    frozenRows: 3,
  },
  tasks: [
    {
      id: 'link',
      kind: 'formula',
      cells: 'E3',
      prompt: 'The table records whatever its top row shows. In E3 link to the trip time in B10.',
      solution: '=B10',
      wrong: ['=B8', '=B2'],
      hints: [
        'A one-variable data table re-evaluates the formula at the top of its result column for every run.',
        'So E3 must show the output you want to replicate: the trip time.',
        'Type = and point at B10.',
      ],
      explain: 'E3 is the output the table collects. In the exam this is the step that is easiest to forget: without it the table has nothing to record.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E4:E103',
      prompt:
        'Select D3:E103 and run What-If Analysis › Data Table with an empty Row input cell and the Column input cell on an empty cell ' +
        'outside the table (H5 is free). Each of the 100 rows is one replication of the trip.',
      toolSetup: { range: 'D3:E103', colInput: 'H5' },
      random: { trials: 5, stat: 'mean', target: 30, tol: 3 },
      hints: [
        'A one-variable table puts each run number 1-100 into the column input cell and records E3. If that cell is empty and unused, the only thing that changes is the random draws.',
        'Select the run numbers together with the linked cell (D3:E103), then fill only the Column input cell.',
        'Row input cell: empty. Column input cell: H5.',
      ],
      explain:
        'Every row of the table forces a full recalculation, and every recalculation redraws RAND(), so each row is an independent trip. ' +
        'The run numbers only trigger the recalculation; pointing the input cell at B2 would set the mean leg time to 1, 2 ... 100 minutes. ' +
        'Excel\'s Automatic except for Data Tables setting keeps the table still until you press F9.',
    },
    {
      id: 'average',
      kind: 'formula',
      cells: 'H2',
      prompt: 'In H2 average the 100 simulated trip times with `AVERAGE`.',
      solution: '=AVERAGE(E4:E103)',
      check: { mustUse: ['AVERAGE'] },
      wrong: ['=AVERAGE(E3:E103)', '=AVERAGE(D4:D103)'],
      hints: [
        'Each row of the table body is one simulated trip.',
        'Average the body E4:E103 only: E3 is the live trip, not a replication.',
        'AVERAGE(E4:E103).',
      ],
      explain:
        'The average of the replications estimates the expected trip time, 5 legs x 6 minutes = 30 minutes; with 100 runs it is usually ' +
        'within about 1.3 minutes of 30 (standard error 13.4/10). Leave E3 out: it is the current recalculation, not a replication.',
    },
  ],
  testCases: [{ name: 'the mean leg time rises to 8 minutes', inputs: { B2: 8 } }],
  skills: ['one-variable Data Table', 'blank column input cell', 'average of replications'],
  techniques: ['Data Table for Monte Carlo replications (blank input cell)'],
}

// ---------- level 2 applied models ----------

// 40 surveyed drinks (counts 0:10, 1:14, 2:9, 3:5, 4:2) in A4:D13, row by row
const TOPPINGS = [1, 0, 0, 1, 2, 4, 0, 2, 0, 1, 1, 0, 3, 0, 1, 2, 3, 3, 0, 1, 0, 1, 1, 2, 2, 3, 1, 4, 0, 1, 1, 0, 2, 2, 2, 1, 3, 1, 1, 2]
const surveyCells = (): Cells => {
  const out: Cells = {}
  TOPPINGS.forEach((v, i) => { out[`${'ABCD'[i % 4]}${4 + Math.floor(i / 4)}`] = input(v, '0') })
  return out
}

const toppings: Exercise = {
  id: 'w5-m1-toppings-vlookup',
  week: 'W5',
  topic: 'M1 frequency bins',
  title: 'From a raw survey to a CRF table and VLOOKUP TRUE draws',
  level: 2,
  minutes: 15,
  scenario:
    'A Bishan bubble-tea shop noted the number of toppings on 40 drinks (A4:D13). Use method M1: count each number of toppings, turn ' +
    'the counts into relative frequencies and a lower-bound cumulative column, then simulate 20 drinks from the RAND() column with ' +
    'VLOOKUP TRUE and compare with the expected value.',
  sheet: {
    rows: 23,
    cols: 11,
    cells: {
      A1: label('Bubble tea survey: toppings per drink', true),
      A3: header('Survey (40 drinks)'),
      ...surveyCells(),
      F3: header('Cum. prob'), G3: header('Toppings'), H3: header('Count'), I3: header('Rel. freq'),
      F4: given(0, '0.000'),
      ...answers('F', 5, 8, '0.000'),
      ...column('G', 4, 8, (i) => given(i, '0')),
      ...answers('H', 4, 8, '0'),
      ...answers('I', 4, 8, '0.000'),
      F10: label('Expected toppings per drink'), I10: answer('0.000'),
      F11: label('Simulated average (20 drinks)'), I11: answer('0.000'),
      J3: header('RAND()'), K3: header('Toppings'),
      ...column('J', 4, 23, () => calc('=RAND()', '0.000')),
      ...answers('K', 4, 23, '0'),
    },
    colWidths: { F: 90, G: 80, H: 70, I: 80, J: 80, K: 80 },
  },
  tasks: [
    {
      id: 'count',
      kind: 'formula',
      cells: 'H4:H8',
      prompt: 'In H4 count how many surveyed drinks had the number of toppings in G4, with `COUNTIF` over A4:D13. Fill down to H8.',
      solution: '=COUNTIF($A$4:$D$13,G4)',
      check: { mustUse: ['COUNTIF'], absolute: ['$A$4:$D$13'] },
      wrong: ['=COUNTIF(A4:D13,G4)', '=COUNT($A$4:$D$13)', '=COUNTIF($A$4:$D$13,"G4")'],
      hints: [
        'COUNTIF(range, criteria) counts the cells of range equal to criteria; the criteria can be a cell.',
        'Count over the whole survey block, with the number of toppings in G4 as the criteria; lock the block with $ so it stays put when you fill down.',
        'COUNTIF($A$4:$D$13, G4).',
      ],
      explain: 'These are the frequency bins of M1: 10, 14, 9, 5 and 2 drinks. Quoting "G4" would count the text G4, not the value in G4.',
    },
    {
      id: 'relfreq',
      kind: 'formula',
      cells: 'I4:I8',
      prompt: 'In I4 turn the count into a relative frequency (share of all surveyed drinks). Fill down to I8.',
      solution: '=H4/SUM($H$4:$H$8)',
      wrong: ['=H4/SUM(H4:H8)', '=H4/10'],
      hints: [
        'Relative frequency = count / total count.',
        'Use the total of the count column (anchored), not a typed 40: the survey size may change.',
        'H4 / SUM($H$4:$H$8).',
      ],
      explain: 'The relative frequencies (0.250, 0.350, 0.225, 0.125, 0.050) estimate the probabilities and add up to 1.',
    },
    {
      id: 'crf',
      kind: 'formula',
      cells: 'F5:F8',
      prompt: 'F4 holds 0. In F5 enter the lower-bound cumulative probability for G5 (the share of drinks with fewer toppings) and fill down to F8.',
      solution: '=F4+I4',
      wrong: ['=F4+I5', '=I4', '=SUM($I$4:I5)'],
      hints: [
        'The interval for 1 topping starts where the interval for 0 toppings ends, and so on down the table.',
        'Each lower bound is the previous lower bound plus the previous relative frequency.',
        'F5 = F4 + I4 (or SUM the relative frequencies above the row), filled down.',
      ],
      explain:
        'The cumulative column is 0, 0.250, 0.600, 0.825, 0.950: the lower bound of each interval. It sits on the LEFT of the toppings ' +
        'column because VLOOKUP can only search the first column of its table.',
    },
    {
      id: 'simulate',
      kind: 'formula',
      cells: 'K4:K23',
      prompt: 'In K4 turn the random number in J4 into a number of toppings with `VLOOKUP` (approximate match, TRUE) on the table F4:G8. Fill down to K23.',
      solution: '=VLOOKUP(J4,$F$4:$G$8,2,TRUE)',
      check: { mustUse: ['VLOOKUP'], absolute: ['$F$4:$G$8'] },
      wrong: ['=VLOOKUP(J4,$F$4:$G$8,2,FALSE)', '=VLOOKUP(J4,F4:G8,2,TRUE)', '=VLOOKUP(J4,$F$5:$G$9,2,TRUE)'],
      hints: [
        'VLOOKUP with TRUE finds the largest lower bound in the first column that is <= the random number.',
        'Look up J4 in the table F4:G8 (lower bounds on the left), return column 2 and lock the table with $.',
        'VLOOKUP(J4, $F$4:$G$8, 2, TRUE).',
      ],
      explain:
        'With TRUE, VLOOKUP returns the row whose lower bound is the largest one <= J4: a J4 of 0.70 falls between 0.600 and 0.825, so 2 ' +
        'toppings. FALSE looks for the exact random number and returns #N/A. Keeping RAND() in its own column (J) lets you see which ' +
        'interval each draw fell into.',
    },
    {
      id: 'expected',
      kind: 'formula',
      cells: 'I10',
      prompt: 'In I10 compute the expected toppings per drink from the frequency table with `SUMPRODUCT`.',
      solution: '=SUMPRODUCT(G4:G8,I4:I8)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=AVERAGE(G4:G8)', '=SUMPRODUCT(G4:G8,H4:H8)'],
      hints: [
        'Expected value = sum of value x probability, and the relative frequencies are the probabilities.',
        'SUMPRODUCT(values, probabilities) does the multiplying and adding in one step.',
        'SUMPRODUCT(G4:G8, I4:I8).',
      ],
      explain: 'E[toppings] = 1.375, the same as the average of the 40 survey values: M1 reproduces the survey\'s distribution.',
    },
    {
      id: 'simavg',
      kind: 'formula',
      cells: 'I11',
      prompt: 'In I11 average the 20 simulated drinks.',
      solution: '=AVERAGE(K4:K23)',
      wrong: ['=AVERAGE(J4:J23)', '=AVERAGE(G4:G8)'],
      hints: ['The 20 simulated drinks are in K4:K23.', 'Average the toppings column, not the RAND() column next to it.', 'AVERAGE(K4:K23).'],
      explain: 'Press F9 a few times: this average jumps around 1.375.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'Your simulated average in I11 is not exactly I10. Explain why, and how you would make the simulated estimate more reliable.',
      answer:
        'Twenty random drinks are only a small sample, so their average varies from one recalculation to the next (standard error about ' +
        '1.13/sqrt(20) = 0.25 toppings) and rarely hits 1.375 exactly. The estimate becomes more reliable with more simulated drinks or ' +
        'with many replications collected in a Data Table and averaged; the scatter shrinks with the square root of the number of draws.',
    },
  ],
  testCases: [
    { name: 'three drinks logged with 0 toppings actually had 4', inputs: { B4: 4, C8: 4, A11: 4 } },
    { name: 'two drinks logged with 1 topping actually had 3', inputs: { A4: 3, D4: 3 } },
    { name: 'one survey entry (D13) is deleted', inputs: { D13: null } },
  ],
  skills: ['COUNTIF frequency bins', 'relative frequency', 'CRF lower bounds', 'VLOOKUP TRUE on a RAND() column', 'expected value'],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'SUMPRODUCT totals and weighted/expected values',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Written interpretation of model results',
  ],
}

const fleet: Exercise = {
  id: 'w5-bike-fleet-replicate',
  week: 'W5',
  topic: 'Replicate the full output',
  title: 'Average the profit, not the demand',
  level: 2,
  minutes: 18,
  scenario:
    'An East Coast Park kiosk leases bicycles from a fleet operator for each Saturday at $5 a bike and rents them out for the day at $12. ' +
    'A customer who arrives when every bike is out gets a $2 drink voucher as an apology. Saturday demand follows the table in D3:F8. ' +
    'Simulate one Saturday, replicate it 100 times with a Data Table, and compare the average profit with the profit of a Saturday ' +
    'whose demand is exactly the average demand.',
  sheet: {
    rows: 111,
    cols: 6,
    cells: {
      A1: label('Bike kiosk: bikes leased for a Saturday', true),
      A3: label('Bikes leased for the day'), B3: input(45, '0'),
      A4: label('Rental price per bike'), B4: input(12, '$#,##0.00'),
      A5: label('Lease cost per bike'), B5: input(5, '$#,##0.00'),
      A6: label('Voucher per customer turned away'), B6: input(2, '$#,##0.00'),
      A7: label('Target daily profit'), B7: input(200, '$#,##0'),
      D3: header('Cum. prob'), E3: header('Demand (customers)'), F3: header('Probability'),
      D4: given(0, '0%'),
      ...column('D', 5, 8, (_, row) => calc(`=D${row - 1}+F${row - 1}`, '0%')),
      ...listed('E', 4, [20, 30, 40, 50, 60], (v) => input(v, '0')),
      ...listed('F', 4, [0.1, 0.25, 0.3, 0.2, 0.15], (v) => input(v, '0%')),
      A9: header('One simulated Saturday'),
      A10: label('Random number'), B10: calc('=RAND()', '0.000'),
      A11: label('Demand (customers)'), B11: answer('0'),
      A12: label('Profit'), B12: answer('$#,##0.00'),
      A14: header('Results'),
      A15: label('Expected demand (customers)'), B15: calc('=SUMPRODUCT(E4:E8,F4:F8)', '0.0'),
      A16: label('Average profit, 100 Saturdays'), B16: answer('$#,##0.00'),
      A17: label('P(profit below target)'), B17: answer('0%'),
      A18: label('Profit at the expected demand'), B18: answer('$#,##0.00'),
      B20: { note: 'An empty cell: use it as the Column input cell of the data table' },
      D10: header('Saturday'), E10: header('Profit'),
      E11: calc('=B12', '$#,##0.00'),
      ...runs('D', 12, 100),
      ...answers('E', 12, 111, '$#,##0.00'),
    },
    colWidths: { A: 240, B: 100, C: 40, D: 80, E: 140, F: 90 },
  },
  tasks: [
    {
      id: 'demand',
      kind: 'formula',
      cells: 'B11',
      prompt: 'In B11 turn the random number in B10 into the day\'s demand with `LOOKUP` (or `VLOOKUP` TRUE) on the cumulative column D4:D8 and the demands E4:E8.',
      solution: '=LOOKUP(B10,$D$4:$D$8,$E$4:$E$8)',
      wrong: ['=LOOKUP(B10,$D$4:$D$8,$E$5:$E$9)', '=VLOOKUP(B10,$D$4:$E$8,2,FALSE)', '=LOOKUP(B10,$F$4:$F$8,$E$4:$E$8)'],
      hints: [
        'The cumulative column holds lower bounds, so an approximate match finds the right demand.',
        'Look up the random number already in B10 rather than a new RAND(): the profit must use the same draw.',
        'LOOKUP(B10, $D$4:$D$8, $E$4:$E$8).',
      ],
      explain: 'A random number of 0.62 lies between 35% and 65%, so 40 customers want a bike. Keeping RAND() in B10 means B11 and B12 use the same draw.',
    },
    {
      id: 'profit',
      kind: 'formula',
      cells: 'B12',
      prompt:
        'In B12 work out the day\'s profit: bikes rented (never more than were leased, use `MIN`) at the rental price, minus a voucher for ' +
        'every customer turned away (use `MAX`), minus the lease on every bike leased.',
      solution: '=B4*MIN(B11,B3)-B6*MAX(0,B11-B3)-B5*B3',
      wrong: [
        '=B4*B11-B5*B3', '=B4*MIN(B11,B3)-B5*B3', '=B4*MIN(B11,B3)-B6*MAX(0,B11-B3)-B5*B11',
        '=B4*MIN(B11,B3)-2*MAX(0,B11-B3)-B5*B3', '=B4*MIN(B11,B3)-B6*MAX(0,B11-B3)-5*B3', '=B4*MIN(B11,B3)+B6*MAX(0,B11-B3)-B5*B3',
        '=B4*MIN(B11,B3)-B6*MAX(0,B3-B11)-B5*B3',
      ],
      hints: [
        'Rented = MIN(demand, bikes leased); turned away = MAX(0, demand - bikes leased).',
        'Profit = price x rented - voucher x turned away - lease cost x every bike leased.',
        'B4*MIN(B11,B3) - B6*MAX(0,B11-B3) - B5*B3.',
      ],
      explain:
        'MIN caps rentals at the bikes leased and MAX(0, ...) counts only the customers beyond the fleet, while the lease is paid on every ' +
        'bike, rented or not. These kinks make the profit non-linear in demand.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E12:E111',
      prompt: 'Replicate the day 100 times: select D11:E111 and run What-If Analysis › Data Table with the Column input cell on an empty cell (B20 is free).',
      toolSetup: { range: 'D11:E111', colInput: 'B20' },
      random: { trials: 5, stat: 'mean', target: 215.5, tol: 17 },
      hints: [
        'E11 already links to the profit in B12; the Saturday numbers go down the first column.',
        'Leave the Row input cell empty; the Column input cell must be a cell the model does not use.',
        'Select D11:E111, Row input cell empty, Column input cell B20.',
      ],
      explain: 'Each row recalculates the sheet with a fresh RAND() in B10, so the column holds 100 independent Saturday profits.',
    },
    {
      id: 'average',
      kind: 'formula',
      cells: 'B16',
      prompt: 'In B16 average the 100 simulated profits.',
      solution: '=AVERAGE(E12:E111)',
      wrong: ['=AVERAGE(E11:E111)', '=AVERAGE(D12:D111)', '=SUM(E11:E111)/100'],
      hints: ['Each row of the table body is one simulated Saturday.', 'Average E12:E111 and leave out E11, the live day that feeds the table.', 'AVERAGE(E12:E111).'],
      explain: 'The expected profit with 45 bikes is $215.50; 100 Saturdays give an estimate within about $18 of it most of the time.',
    },
    {
      id: 'risk',
      kind: 'formula',
      cells: 'B17',
      prompt: 'In B17 estimate the probability that a Saturday\'s profit falls below the target in B7, with `COUNTIF` and a criteria string joined to B7.',
      solution: '=COUNTIF(E12:E111,"<"&B7)/COUNT(E12:E111)',
      check: { mustUse: ['COUNTIF'] },
      wrong: [
        '=COUNTIF(E12:E111,"<B7")/COUNT(E12:E111)', '=COUNTIF(E12:E111,"<"&B7)', '=COUNTIF(E12:E111,"<="&B7)/COUNT(E12:E111)',
        '=COUNTIF(E12:E111,"<200")/COUNT(E12:E111)',
      ],
      hints: [
        'The criteria "<"&B7 builds the text "<200" from the cell; "<B7" in quotes would compare with the letters B7.',
        'Divide the count by the number of simulated Saturdays.',
        'COUNTIF(E12:E111, "<"&B7) / COUNT(E12:E111).',
      ],
      explain: 'Joining "<" to B7 keeps the criterion live when the target changes. Profit is below $200 on Saturdays with 20 or 30 customers: 35% in theory.',
    },
    {
      id: 'atmean',
      kind: 'formula',
      cells: 'B18',
      prompt: 'In B18 compute the profit of a Saturday whose demand equals the expected demand in B15 (same rules as B12).',
      solution: '=B4*MIN(B15,B3)-B6*MAX(0,B15-B3)-B5*B3',
      wrong: ['=B16', '=B4*B15-B5*B3', '=B4*MIN(B15,B3)-2*MAX(0,B15-B3)-B5*B3', '=B4*MIN(B15,B3)-B6*MAX(0,B3-B15)-B5*B3'],
      hints: [
        'This is the plug-in-the-average shortcut: one Saturday whose demand is exactly the expected demand.',
        'Re-use the logic of B12 with B15 in place of the simulated demand.',
        'B4*MIN(B15,B3) - B6*MAX(0,B15-B3) - B5*B3.',
      ],
      explain: 'With 45 bikes and a demand of 40.5 the profit is $261.00, well above the simulated average of about $215.50.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'B18 is clearly higher than B16. Explain why, and which of the two the kiosk should use to decide how many bikes to lease.',
      answer:
        'Profit is not a straight line in demand. A quiet Saturday still pays the lease on all 45 bikes, but a busy one cannot earn more ' +
        'than 45 rentals and even costs vouchers, so busy Saturdays cannot make up for quiet ones. Plugging the average demand (40.5) into ' +
        'the profit formula ignores that and overstates the profit ($261 against about $215.50): E[profit(demand)] is not ' +
        'profit(E[demand]). Use the average of the simulated profits (the full output replicated) and compare it across fleet sizes, the ' +
        'decision variable.',
    },
  ],
  testCases: [
    { name: 'only 15 bikes are leased', inputs: { B3: 15 } },
    { name: 'the kiosk leases 65 bikes', inputs: { B3: 65 } },
    { name: 'a bike costs $6 to lease', inputs: { B5: 6 } },
    { name: 'only 15 bikes and the voucher is worth $3', inputs: { B3: 15, B6: 3 } },
    { name: 'the target profit is $135', inputs: { B7: 135 } },
    { name: 'the rental price rises to $14', inputs: { B4: 14 } },
    { name: 'demand of 20 falls to 5% and demand of 60 rises to 20%', inputs: { F4: 0.05, F8: 0.2 } },
    { name: 'every demand level is 5 customers higher', inputs: { E4: 25, E5: 35, E6: 45, E7: 55, E8: 65 } },
  ],
  skills: ['LOOKUP on a RAND() cell', 'MIN/MAX capacity and turned-away customers', 'Data Table replications', 'COUNTIF probability', 'E[f(X)] vs f(E[X])'],
  techniques: [
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'Capacity and flow-balance logic with MIN/MAX',
    'Data Table for Monte Carlo replications (blank input cell)',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Replicate the full output (E[f(X)] is not f(E[X]))',
    'Written interpretation of model results',
  ],
}

const locker: Exercise = {
  id: 'w5-mystery-locker-switch',
  week: 'W5',
  topic: 'Monty-Hall-style game',
  title: 'Mystery Locker: stay or switch?',
  level: 2,
  minutes: 20,
  scenario:
    'A Jurong mall roadshow runs "Mystery Locker": one of three lockers holds a $300 voucher, the other two a $5 coupon. The contestant ' +
    'picks a locker; the host, who knows where the voucher is, opens one of the other two that holds a coupon and offers a switch. ' +
    'Simulate 50 games to estimate the win rates and budget the prizes if every contestant switches.',
  sheet: {
    rows: 60,
    cols: 8,
    cells: {
      A1: label('Mystery Locker roadshow', true),
      A3: label('Voucher value'), B3: input(300, '$#,##0'),
      A4: label('Coupon value'), B4: input(5, '$#,##0'),
      A5: label('Contestants per day'), B5: input(6, '0'),
      A6: label('Roadshow days'), B6: input(14, '0'),
      A7: label('Prize per switcher (expected)'), B7: answer('$#,##0.00'),
      A8: label('Roadshow prize budget'), B8: answer('$#,##0'),
      D2: header('Locker the host opens (row = voucher locker, column = pick)'), D3: header('Voucher \\ pick'), E3: header(1), F3: header(2), G3: header(3),
      D4: header(1), E4: calc('=RANDBETWEEN(2,3)', '0'), F4: given(3, '0'), G4: given(2, '0'),
      D5: header(2), E5: given(3, '0'), F5: calc('=IF(RAND()<0.5,1,3)', '0'), G5: given(1, '0'),
      D6: header(3), E6: given(2, '0'), F6: given(1, '0'), G6: calc('=RANDBETWEEN(1,2)', '0'),
      F8: label('Win rate'), G8: answer('0.0%'), H8: answer('0.0%'),
      A10: header('Game'), B10: header('Voucher locker'), C10: header('Picked'), D10: header('Opened'),
      E10: header('Final if stay'), F10: header('Final if switch'), G10: header('Win if stay'), H10: header('Win if switch'),
      ...runs('A', 11, 50),
      ...answers('B', 11, 60, '0'),
      ...answers('C', 11, 60, '0'),
      ...answers('D', 11, 60, '0'),
      ...column('E', 11, 60, (_, row) => calc(`=C${row}`, '0')),
      ...answers('F', 11, 60, '0'),
      ...answers('G', 11, 60, '0'),
      ...answers('H', 11, 60, '0'),
    },
    colWidths: { A: 220, B: 110, C: 80, D: 120, E: 100, F: 110, G: 90, H: 110 },
    frozenRows: 10,
  },
  tasks: [
    {
      id: 'draws',
      kind: 'formula',
      cells: 'B11:C60',
      prompt: 'In B11 draw the locker that holds the voucher (1 to 3) with `RANDBETWEEN`; the same formula draws the contestant\'s pick in C11. Fill B11:C60.',
      solution: '=RANDBETWEEN(1,3)',
      random: { trials: 20, stat: 'mean', target: 2, tol: 0.08 },
      wrong: ['=RANDBETWEEN(0,3)', '=RANDBETWEEN(1,4)', '=RAND()*3'],
      hints: [
        'Each locker is equally likely: a discrete uniform draw over 1, 2, 3.',
        'RANDBETWEEN(bottom, top) returns each whole number from bottom to top with equal probability.',
        'RANDBETWEEN(1,3) in B11, filled across to C11 and down to row 60.',
      ],
      explain: 'RANDBETWEEN(1,3) returns 1, 2 or 3 with probability 1/3 each. The voucher and the pick are drawn independently.',
    },
    {
      id: 'opened',
      kind: 'formula',
      cells: 'D11:D60',
      prompt: 'In D11 find the locker the host opens: read the matrix E4:G6 with `INDEX`, using the voucher locker as the row and the pick as the column. Fill down to D60.',
      solution: '=INDEX($E$4:$G$6,B11,C11)',
      check: { mustUse: ['INDEX'], absolute: ['$E$4:$G$6'] },
      wrong: ['=INDEX(E4:G6,B11,C11)', '=INDEX($E$4:$G$6,B11,1)'],
      hints: [
        'INDEX(array, row_num, column_num) returns the cell at that row and column of the array.',
        'The voucher locker (B11) picks the row and the pick (C11) the column; lock the matrix with $ so every game reads the same one.',
        'INDEX($E$4:$G$6, B11, C11).',
      ],
      explain:
        'Off the diagonal the host has no choice: he opens the one locker that is neither the voucher nor the pick. On the diagonal ' +
        '(pick = voucher) either other locker works, so those matrix cells draw at random.',
    },
    {
      id: 'switch',
      kind: 'formula',
      cells: 'F11:F60',
      prompt: 'Column E already copies the pick (stay). In F11 find the locker a switching contestant ends with, the one that is neither picked nor opened. Fill down to F60.',
      solution: '=6-C11-D11',
      wrong: ['=6-B11-D11', '=D11', '=6-C11'],
      hints: [
        'The switcher takes the one locker that is neither picked (C11) nor opened (D11).',
        'The three locker numbers add up to 1 + 2 + 3 = 6.',
        '6 - C11 - D11.',
      ],
      explain: 'Picked + opened + remaining = 6, so the remaining locker is 6 - picked - opened. The course also uses a second INDEX matrix for this.',
    },
    {
      id: 'wins',
      kind: 'formula',
      cells: 'G11:H60',
      prompt: 'In G11 score the stay strategy as 1 if its final locker holds the voucher and 0 otherwise. Write it so it fills right to H11 (switch) and down to row 60.',
      solution: '=(E11=$B11)*1',
      check: { absolute: ['$B11'] },
      wrong: ['=(E11=B11)*1', '=E11=$B11', '=(E11=$C11)*1'],
      hints: [
        'A comparison such as E11=B11 gives TRUE or FALSE; multiplying by 1 turns it into 1 or 0.',
        'When you fill right, the final locker should move from E to F but the voucher column must stay on B: anchor only the column.',
        '(E11=$B11)*1.',
      ],
      explain: '$B11 keeps the column fixed and lets the row move, so one formula serves both strategies. 1/0 scores average straight into win rates.',
    },
    {
      id: 'rates',
      kind: 'formula',
      cells: 'G8:H8',
      prompt: 'In G8 compute the win rate of staying over the 50 games and fill right to H8 for switching.',
      solution: '=AVERAGE(G11:G60)',
      wrong: ['=SUM(G11:G60)', '=AVERAGE(G11:H60)'],
      hints: [
        'Each game scores 1 for a win and 0 for a loss.',
        'The average of 1/0 scores is the share of wins; fill right so H8 averages the switch column.',
        'AVERAGE(G11:G60), filled right to H8.',
      ],
      explain:
        'AVERAGE (or SUM/COUNT, as in the course workbook) of the 1/0 scores is the relative frequency of winning: near 33% for staying ' +
        'and 67% for switching. The two rates add up to exactly 100%: the opened locker never holds the voucher, so in every game exactly ' +
        'one of the two final lockers does (P1 + P2 = 1).',
    },
    {
      id: 'prize',
      kind: 'formula',
      cells: 'B7',
      prompt: 'In B7 compute the expected prize per contestant if everyone switches, using the simulated switch win rate in H8.',
      solution: '=H8*B3+(1-H8)*B4',
      wrong: ['=H8*B3', '=G8*B3+(1-G8)*B4', '=H8*B3+(1-H8)*5', '=(B3+B4)/2'],
      hints: [
        'A switcher wins the voucher with probability H8 and otherwise gets the coupon.',
        'Expected prize = P(win) x voucher + P(lose) x coupon.',
        'H8*B3 + (1-H8)*B4.',
      ],
      explain:
        'With a 2/3 win rate the expected prize is about 2/3 x $300 + 1/3 x $5 = $201.67 per contestant. Reading H8 rather than typing 2/3 ' +
        'lets the budget follow the simulation.',
    },
    {
      id: 'budget',
      kind: 'formula',
      cells: 'B8',
      prompt: 'In B8 turn the expected prize in B7 into the prize budget for every contestant over the whole roadshow.',
      solution: '=B7*B5*B6',
      wrong: ['=B7*B5', '=B7*B6', '=B3*B5*B6'],
      hints: [
        'On average every contestant takes home the expected prize.',
        'Number of contestants = contestants per day x roadshow days.',
        'B7 * B5 * B6.',
      ],
      explain:
        '6 contestants x 14 days = 84 contestants, so the roadshow needs about 84 x $201.67 = $16,940. In influence-diagram terms, ' +
        'stay-or-switch is the decision, the prize values and contestant numbers are parameters, the lockers and win rates are ' +
        'consequence variables, and the prize budget is the performance measure.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'Why does switching win about two games in three while staying wins only one in three? Refer to your simulated win rates.',
      answer:
        'The first pick holds the voucher only 1/3 of the time, and staying keeps exactly that chance. In the other 2/3 of games the ' +
        'voucher is behind one of the two other lockers; the host must open the empty one of those two, so switching lands on the voucher ' +
        'every time. The simulated rates in G8:H8 sit near 33% and 67% and settle closer with more games or replications. A newcomer who ' +
        'walks up after the host has opened a locker and picks one of the two closed lockers at random, IF(RAND()<0.5, stay locker, ' +
        'switch locker), wins only half the time: the host\'s information is what lifts switching to 2/3.',
    },
  ],
  testCases: [
    { name: 'the voucher is worth $500', inputs: { B3: 500 } },
    { name: 'the coupon is worth $10', inputs: { B4: 10 } },
    { name: '8 contestants a day for 10 days', inputs: { B5: 8, B6: 10 } },
  ],
  skills: ['RANDBETWEEN', 'INDEX on an options matrix', 'mixed reference $B11', '1/0 win indicators', 'expected prize from a simulated rate', 'prize budget'],
  techniques: [
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'INDEX by row/column number (matrix lookup)',
    'Absolute/mixed references so formulas fill down/right',
    'Written interpretation of model results',
  ],
}

const dice: Exercise = {
  id: 'w5-dice-booth-verify',
  week: 'W5',
  topic: 'Simulation vs analysis',
  title: 'Fun-fair dice booth: check the simulation against the maths',
  level: 2,
  minutes: 18,
  scenario:
    'A Bukit Timah school fun fair runs a dice booth: a player pays $2, rolls two dice and wins the payout listed for the total in G4:H14. ' +
    'The treasurer wants the expected payout worked out exactly from the probabilities of each total, then checked against a ' +
    'simulation of 50 games.',
  sheet: {
    rows: 55,
    cols: 9,
    cells: {
      A1: label('Fun-fair dice booth', true),
      A3: label('Price per game'), B3: input(2, '$#,##0.00'),
      A5: header('Game'), B5: header('Die 1'), C5: header('Die 2'), D5: header('Total'), E5: header('Payout'),
      ...runs('A', 6, 50),
      ...answers('B', 6, 55, '0'),
      ...answers('C', 6, 55, '0'),
      ...answers('D', 6, 55, '0'),
      ...answers('E', 6, 55, '$#,##0'),
      G3: header('Total'), H3: header('Payout'), I3: header('P(total)'),
      ...column('G', 4, 14, (i) => given(i + 2, '0')),
      ...listed('H', 4, [10, 4, 0, 0, 0, 5, 0, 0, 0, 4, 10], (v) => input(v, '$#,##0')),
      ...answers('I', 4, 14, '0.000'),
      G16: label('Expected payout per game'), I16: answer('$#,##0.000'),
      G17: label('Expected profit per game'), I17: answer('$#,##0.000'),
      G18: label('Simulated average payout'), I18: answer('$#,##0.000'),
      G19: label('Simulated share of 7s'), I19: answer('0.0%'),
    },
    colWidths: { A: 120, E: 80, G: 200, I: 90 },
    frozenRows: 5,
  },
  tasks: [
    {
      id: 'dice',
      kind: 'formula',
      cells: 'B6:C55',
      prompt: 'In B6 roll a fair die with `RANDBETWEEN`, then fill B6:C55 so every game has two independent dice.',
      solution: '=RANDBETWEEN(1,6)',
      random: { trials: 20, stat: 'mean', target: 3.5, tol: 0.17 },
      // the mean cannot see ROUND(RAND()*5,0)+1 (ends half as likely): the prompt asks for RANDBETWEEN, so require it
      check: { mustUse: ['RANDBETWEEN'] },
      wrong: ['=RANDBETWEEN(0,6)', '=RANDBETWEEN(1,12)', '=INT(RAND()*6)', '=ROUND(RAND()*5,0)+1'],
      hints: [
        'A die is a discrete uniform draw: each whole number from 1 to 6 equally likely.',
        'RANDBETWEEN(bottom, top) does exactly that; with no cell references there is nothing to anchor.',
        'RANDBETWEEN(1,6) in B6, filled across to C6 and down to row 55.',
      ],
      explain:
        'RANDBETWEEN(1,6) is the course\'s die toss (INT(RAND()*6)+1 is the same thing). Each cell is a separate die, so the two dice are ' +
        'independent. ROUND(RAND()*5,0)+1 looks similar but is biased: 1 and 6 come up only half as often as the other faces.',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'D6:D55',
      prompt: 'In D6 add the two dice and fill down to D55.',
      solution: '=B6+C6',
      wrong: ['=RANDBETWEEN(2,12)', '=B6*C6'],
      hints: [
        'The total is the sum of the two dice you rolled, not a new random number.',
        'Add the two dice in the same row so the total matches what is shown.',
        'B6 + C6.',
      ],
      explain: 'Adding two uniform dice gives a triangular distribution peaking at 7. RANDBETWEEN(2,12) would make every total equally likely, which is wrong: 7 can be made 6 ways but 2 only 1 way.',
    },
    {
      id: 'payout',
      kind: 'formula',
      cells: 'E6:E55',
      prompt: 'In E6 look up the payout for the total with `VLOOKUP` exact match on G4:H14. Fill down to E55.',
      solution: '=VLOOKUP(D6,$G$4:$H$14,2,FALSE)',
      check: { mustUse: ['VLOOKUP'] },
      wrong: ['=VLOOKUP(D6,G4:H14,2,FALSE)', '=VLOOKUP(D6,$G$4:$H$14,1,FALSE)'],
      hints: [
        'VLOOKUP searches the first column of G4:H14 for the total and returns the payout from the second column.',
        'Every total from 2 to 12 is listed, so use exact match (FALSE) and lock the table with $.',
        'VLOOKUP(D6, $G$4:$H$14, 2, FALSE).',
      ],
      explain: 'Exact match (FALSE) suits a table that lists every possible total. Anchoring the table keeps it in place for all 50 games.',
    },
    {
      id: 'prob',
      kind: 'formula',
      cells: 'I4:I14',
      prompt: 'In I4 compute the exact probability of the total in G4: there are 36 equally likely rolls, and a total t can be made in 6 - |t - 7| ways (use `ABS`). Fill down to I14.',
      solution: '=(6-ABS(G4-7))/36',
      check: { mustUse: ['ABS'] },
      wrong: ['=(6-ABS(G4-7))/12', '=1/11', '=(6-(G4-7))/36'],
      hints: [
        'For a total of 7 there are 6 ways (1+6, 2+5 ... 6+1); each step away from 7 loses one way.',
        'Number of ways = 6 - ABS(total - 7); divide it by the 36 possible rolls.',
        '(6 - ABS(G4 - 7)) / 36.',
      ],
      explain: 'The probabilities run 1/36, 2/36 ... 6/36 (for 7) ... 1/36 and add up to 1: the triangular distribution of the course\'s two-dice example.',
    },
    {
      id: 'expected',
      kind: 'formula',
      cells: 'I16',
      prompt: 'In I16 compute the exact expected payout per game from the payouts and their probabilities, with `SUMPRODUCT`.',
      solution: '=SUMPRODUCT(H4:H14,I4:I14)',
      wrong: ['=AVERAGE(H4:H14)', '=SUM(H4:H14)/36', '=SUMPRODUCT(G4:G14,I4:I14)'],
      hints: [
        'An expected payout weights each payout by the probability of its total.',
        'Multiply payout by probability for every total and add the products.',
        'SUMPRODUCT(H4:H14, I4:I14).',
      ],
      explain: 'E[payout] = (10 + 2x4 + 6x5 + 2x4 + 10)/36 = $1.833. AVERAGE of the payout column ignores that a 7 is six times as likely as a 2.',
    },
    {
      id: 'profit',
      kind: 'formula',
      cells: 'I17',
      prompt: 'In I17 compute the booth\'s expected profit per game.',
      solution: '=B3-I16',
      wrong: ['=I16-B3', '=B3-I18', '=2-I16'],
      hints: ['The booth keeps the price of the game and pays out the prize.', 'Expected profit = price per game - expected payout.', 'B3 - I16.'],
      explain: 'The booth keeps $2.00 - $1.833 = about $0.17 of every game on average, roughly 8% of the takings.',
    },
    {
      id: 'simavg',
      kind: 'formula',
      cells: 'I18',
      prompt: 'In I18 average the payouts of the 50 simulated games.',
      solution: '=AVERAGE(E6:E55)',
      wrong: ['=AVERAGE(H4:H14)', '=SUM(E6:E55)', '=AVERAGE(E6:E54)'],
      hints: ['Use the simulated payout column, not the payout table.', 'Average all 50 games, E6 to E55.', 'AVERAGE(E6:E55).'],
      explain: 'Compare I18 with the exact I16: close, but not equal, and different after every F9.',
    },
    {
      id: 'share7',
      kind: 'formula',
      cells: 'I19',
      prompt: 'In I19 compute the simulated share of games with a total of 7, with `COUNTIF`.',
      solution: '=COUNTIF(D6:D55,7)/COUNT(D6:D55)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(D6:D55,7)', '=COUNTIF(D6:D55,I9)/COUNT(D6:D55)', '=COUNTIF(D6:D55,">7")/COUNT(D6:D55)'],
      hints: [
        'COUNTIF(range, 7) counts the cells equal to 7.',
        'Count the 7s among the totals in D6:D55, then divide by the number of games.',
        'COUNTIF(D6:D55, 7) / COUNT(D6:D55).',
      ],
      explain: 'Compare I19 with the exact 6/36 = 16.7% in I9. With 50 games the share moves by about 5 percentage points (one standard error) from one F9 to the next.',
    },
    {
      id: 'trust',
      kind: 'explain',
      cells: '',
      prompt: 'After a few F9 presses your 50 games sometimes show an average payout above $2, as if the booth loses money, while I17 says it earns. Which do you trust, and how many games would the simulation need?',
      answer:
        'Trust the exact calculation: E[payout] = 66/36 = $1.833, so the booth earns about $0.17 per game. One game\'s payout has an SD of ' +
        'about $2.85, so the average of 50 games has a standard error of about $0.40, bigger than the $0.17 margin; a 50-game simulation ' +
        'can easily show a loss. To pin the average to within about $0.08 (two standard errors of $0.04) it needs around 5,000 games, ' +
        'for example many replications collected with a Data Table. The simulation is a check on the maths, and agrees with it as the ' +
        'number of games grows.',
    },
  ],
  testCases: [
    { name: 'a total of 7 pays $6', inputs: { H9: 6 } },
    { name: 'the price rises to $2.50', inputs: { B3: 2.5 } },
  ],
  skills: ['RANDBETWEEN dice', 'VLOOKUP exact payout', 'exact probabilities with ABS', 'SUMPRODUCT expected value', 'simulation vs analysis'],
  techniques: [
    'Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))',
    'SUMPRODUCT totals and weighted/expected values',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Written interpretation of model results',
  ],
}

// ---------- level 3 exam-style ----------

const generator: Exercise = {
  id: 'w5-generator-sizing-exam',
  week: 'W5',
  topic: 'Capacity from a percentile',
  title: 'Exam-style: size the night-market generator',
  level: 3,
  minutes: 28,
  scenario:
    'A Bedok night market hires one diesel generator for its 20 stalls. Stall types follow Table 1 (D3:H6) and each stall\'s load is ' +
    'normal with the mean and SD of its type, never below 0 kW. The organiser wants the smallest generator, hired in steps of B3 kW, ' +
    'that covers the total load on the share of nights in B4. Answer in the cells named in each part, as in the final exam.',
  sheet: {
    rows: 109,
    cols: 8,
    cells: {
      A1: label('Night market generator sizing', true),
      A3: label('Generator size step (kW)'), B3: input(5, '0'),
      A4: label('Reliability target'), B4: input(0.95, '0%'),
      B6: { note: 'An empty cell: use it as the Column input cell of the data table' },
      D2: header('Table 1: stall types'),
      D3: header('Cum. prob'), E3: header('Stall type'), F3: header('Share'), G3: header('Mean load (kW)'), H3: header('SD (kW)'),
      D4: given(0, '0%'),
      ...answers('D', 5, 6, '0%'),
      ...listed('E', 4, ['Food', 'Drinks', 'Retail'], (v) => given(v)),
      ...listed('F', 4, [0.45, 0.3, 0.25], (v) => input(v, '0%')),
      ...listed('G', 4, [3, 1.6, 0.6], (v) => input(v, '0.0')),
      ...listed('H', 4, [0.9, 0.5, 0.4], (v) => input(v, '0.0')),
      A8: header('Stall'), B8: header('Type'), C8: header('Load (kW)'),
      ...runs('A', 9, 20),
      ...answers('B', 9, 28),
      ...answers('C', 9, 28, '0.00'),
      E8: header('Results'),
      E9: label('Total load tonight (kW)'), F9: answer('0.0'),
      E11: label('Average total load (kW)'), F11: answer('0.0'),
      E12: label('SD of total load (kW)'), F12: answer('0.00'),
      E13: label('Percentile load (kW)'), F13: answer('0.0'),
      E14: label('Generator to hire (kW)'), F14: answer('0'),
      E15: label('Share of nights overloaded'), F15: answer('0%'),
      G8: header('Night'), H8: header('Total load (kW)'),
      H9: answer('0.0'),
      ...runs('G', 10, 100),
      ...answers('H', 10, 109, '0.0'),
    },
    colWidths: { A: 190, B: 80, C: 80, D: 80, E: 210, F: 80, G: 110, H: 125 },
  },
  tasks: [
    {
      id: 'crf',
      kind: 'formula',
      cells: 'D5:D6',
      prompt: '(a) D4 holds 0. Complete the lower-bound cumulative probabilities in D5:D6 so that LOOKUP can read Table 1.',
      solution: '=D4+F4',
      wrong: ['=D4+F5', '=F4', '=SUM($F$4:F5)'],
      hints: [
        'Drinks start where Food ends, and Retail starts where Drinks end.',
        'Each lower bound is the lower bound above plus the share above.',
        'D5 = D4 + F4, filled down to D6.',
      ],
      explain: 'The column reads 0, 45%, 75%: Food covers [0, 45%), Drinks [45%, 75%), Retail [75%, 100%).',
    },
    {
      id: 'type',
      kind: 'formula',
      cells: 'B9:B28',
      prompt: '(b) In B9 simulate the type of stall 1 with `LOOKUP` on a `RAND`, the cumulative column D4:D6 and the types E4:E6. Fill down to B28.',
      solution: '=LOOKUP(RAND(),$D$4:$D$6,$E$4:$E$6)',
      random: { trials: 50, stat: 'p', event: 'Food', target: 0.45, tol: 0.065 },
      // an IF chain with two RAND() calls gets Food right (45%) but Drinks wrong (41%): the share of Food cannot see it
      check: { mustNotUse: ['IF'] },
      wrong: [
        '=LOOKUP(RAND(),$F$4:$F$6,$E$4:$E$6)', '=LOOKUP(RAND(),$D$4:$D$6,$E$5:$E$7)', '=LOOKUP(RAND(),D4:D6,E4:E6)',
        '=IF(RAND()<0.45,"Food",IF(RAND()<0.75,"Drinks","Retail"))', '=INDEX($E$4:$E$6,RANDBETWEEN(1,3))',
      ],
      hints: [
        'Draw a fresh RAND() for every stall and find the largest lower bound in D4:D6 that is <= it.',
        'LOOKUP can return text: the result vector can be the column of type names. Lock both ranges.',
        'LOOKUP(RAND(), $D$4:$D$6, $E$4:$E$6).',
      ],
      explain: 'Each stall gets its own RAND(), so types are drawn independently with probabilities 45%, 30% and 25%.',
    },
    {
      id: 'load',
      kind: 'formula',
      cells: 'C9:C28',
      prompt:
        '(c) In C9 simulate the load of stall 1: `NORMINV` of a `RAND` with the mean and SD of its type (look them up in Table 1 with ' +
        '`VLOOKUP` exact match), floored at 0 with `MAX`. Fill down to C28.',
      solution: '=MAX(0,NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,3,FALSE),VLOOKUP(B9,$E$4:$H$6,4,FALSE)))',
      // sd of the floored mixture (mean 1.983): the mean cannot see a wrong SD column (VLOOKUP ...,3 twice); the floor changes
      // neither stat, so MAX is required by name (RAND as well, as the prompt names it)
      random: { trials: 50, stat: 'sd', target: 1.206, tol: 0.11 },
      check: { mustUse: ['MAX', 'RAND'] },
      wrong: [
        '=MAX(0,NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,3,FALSE),VLOOKUP(B9,$E$4:$H$6,3,FALSE)))',
        '=MAX(0,NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,4,FALSE),VLOOKUP(B9,$E$4:$H$6,3,FALSE)))',
        '=MAX(0,NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,2,FALSE),VLOOKUP(B9,$E$4:$H$6,4,FALSE)))',
        '=MAX(0,NORMDIST(RAND(),VLOOKUP(B9,$E$4:$H$6,3,FALSE),VLOOKUP(B9,$E$4:$H$6,4,FALSE),TRUE))',
        '=NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,3,FALSE),VLOOKUP(B9,$E$4:$H$6,4,FALSE))',
        '=MAX(0,NORMINV(RAND(),VLOOKUP(B9,$E$4:$H$6,3,TRUE),VLOOKUP(B9,$E$4:$H$6,4,TRUE)))',
        '=MAX(0,VLOOKUP(B9,$E$4:$H$6,3,FALSE))',
      ],
      hints: [
        'VLOOKUP(B9, $E$4:$H$6, 3, FALSE) returns the mean load of the stall\'s type; column 4 is the SD.',
        'NORMINV(RAND(), mean, SD) draws the load; wrap it in MAX(0, ...) so a retail stall never shows a negative load.',
        'MAX(0, NORMINV(RAND(), VLOOKUP(B9,$E$4:$H$6,3,FALSE), VLOOKUP(B9,$E$4:$H$6,4,FALSE))).',
      ],
      explain:
        'Type names are labels, so the mean and SD need an exact-match lookup (FALSE). A retail stall (mean 0.6, SD 0.4) would go ' +
        'negative on about 7% of nights without the MAX floor; the floor keeps the physics right and lifts its mean load slightly.',
    },
    {
      id: 'total',
      kind: 'formula',
      cells: 'F9',
      prompt: '(d) In F9 compute tonight\'s total load of the 20 stalls.',
      solution: '=SUM(C9:C28)',
      wrong: ['=SUM(C9:C27)', '=AVERAGE(C9:C28)'],
      hints: ['The generator carries every stall at once.', 'Add up the load column.', 'SUM(C9:C28).'],
      explain: 'The total is what the generator must carry; it is the output to replicate.',
    },
    {
      id: 'link',
      kind: 'formula',
      cells: 'H9',
      prompt: '(e) Prepare the replication table: in H9 link to the total load.',
      solution: '=F9',
      wrong: ['=C28', '=F11'],
      hints: ['The top row of a one-variable table holds the output formula.', 'Type = and point at the total load in F9.'],
      explain: 'H9 feeds the data table: every replication records it.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'H10:H109',
      prompt: '(f) Replicate the night 100 times: select G9:H109 and run a Data Table with an empty Row input cell and the Column input cell on a blank cell (B6 is free).',
      toolSetup: { range: 'G9:H109', colInput: 'B6' },
      random: { trials: 5, stat: 'mean', target: 39.66, tol: 1.3 },
      hints: ['The night numbers in G10:G109 only trigger the recalculations; the input cell must not feed the model.', 'Select G9:H109 (night numbers plus the linked cell H9), leave the Row input cell empty and use B6 as the Column input cell.'],
      explain: 'Each row redraws all 40 random numbers (20 types, 20 loads), so the column holds 100 independent nightly totals, mean about 39.7 kW.',
    },
    {
      id: 'stats',
      kind: 'formula',
      cells: 'F11:F13',
      prompt: '(g) Summarise the 100 nights: average (F11), standard deviation with `STDEV` (F12) and the percentile at the reliability target in B4 with `PERCENTILE` (F13).',
      solutions: { F11: '=AVERAGE(H10:H109)', F12: '=STDEV(H10:H109)', F13: '=PERCENTILE(H10:H109,B4)' },
      wrong: ['=AVERAGE(H9:H109)', '=AVERAGE(G10:G109)'],
      hints: [
        'Use the 100 replications in H10:H109 only, not the link cell H9.',
        'PERCENTILE(range, B4) is the load that only a share 1 - B4 of the nights exceed: with B4 = 95%, 5% of nights.',
        'AVERAGE(H10:H109), STDEV(H10:H109) and PERCENTILE(H10:H109, B4).',
      ],
      explain: 'Expect about 39.7 kW on average and an SD near 5.4 kW. The 95th percentile is about 48.7 kW in the long run; 100 nights put it anywhere from about 47 to 50 kW. STDEV is the sample standard deviation (n - 1), as taught.',
    },
    {
      id: 'size',
      kind: 'formula',
      cells: 'F14:F15',
      prompt:
        '(h) In F14 choose the smallest generator, in steps of B3 kW, that covers the percentile in F13 (use `ROUNDUP`). In F15 estimate the ' +
        'share of simulated nights that would overload it, with `COUNTIF`.',
      solutions: { F14: '=ROUNDUP(F13/B3,0)*B3', F15: '=COUNTIF(H10:H109,">"&F14)/COUNT(H10:H109)' },
      wrong: ['=ROUNDUP(F13,0)', '=ROUND(F13/B3,0)*B3', '=ROUNDUP(F11/B3,0)*B3', '=ROUNDUP(F13/5,0)*5'],
      hints: [
        'A size must be a whole number of B3 kW steps, at or above the percentile in F13.',
        'Count the steps with ROUNDUP(F13/B3, 0) and multiply back by the step; overloaded nights are those whose total is above F14.',
        'ROUNDUP(F13/B3,0)*B3, and COUNTIF(H10:H109, ">"&F14) / COUNT(H10:H109).',
      ],
      explain:
        'ROUNDUP of the number of 5 kW steps, times 5, gives the next size up (about 50 kW). Overloads are then rare: about 3% of ' +
        'nights in the long run. The share in your own table is at most 5% (usually 1-4%), because the size sits at or above the ' +
        '95th percentile of those same 100 nights; fresh nights would overload it about 3% of the time.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt: '(i) An assistant suggests hiring a 40 kW generator because the average load is about 40 kW. Use your results to advise the organiser.',
      answer:
        'The average is only the middle of the distribution: the total load is above 40 kW on roughly half the nights (SD about 5.4 kW), ' +
        'so a 40 kW generator would trip often. Sizing at the 95th percentile (about 48-49 kW, so a 50 kW unit) covers about 19 nights in ' +
        '20; the remaining risk (about 3% of nights in the long run, a few nights in a 100-night table) is the price of not hiring a bigger, dearer unit. More ' +
        'replications would pin down the percentile more precisely.',
    },
  ],
  testCases: [
    { name: 'shares change to 50% / 35% / 15%', inputs: { F4: 0.5, F5: 0.35, F6: 0.15 } },
    { name: 'food stalls average 3.5 kW', inputs: { G4: 3.5 } },
    { name: 'generators come in 2 kW steps', inputs: { B3: 2 } },
    { name: 'the reliability target is 90%', inputs: { B4: 0.9 } },
    { name: 'the reliability target is 75%', inputs: { B4: 0.75 } },
  ],
  skills: ['CRF + LOOKUP on text', 'NORMINV with VLOOKUP parameters and a MAX floor', 'Data Table replications', 'STDEV and PERCENTILE', 'ROUNDUP to a size step', 'COUNTIF risk'],
  techniques: [
    'Building lookup/step tables (lower bounds, increments, CRF)',
    'Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)',
    'Discrete random variable via CRF table + LOOKUP(RAND())',
    'Normal random variable (NORMINV) with a floor via MAX',
    'Data Table for Monte Carlo replications (blank input cell)',
    'ROUNDUP block counts and MIN for the cheaper option',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Written interpretation of model results',
  ],
}

const overbooking: Exercise = {
  id: 'w5-overbooking-two-way-exam',
  week: 'W5',
  topic: 'Two-way replication table',
  title: 'Exam-style: how many bookings for 16 cooking stations?',
  level: 3,
  minutes: 33,
  scenario:
    'A Holland Village cooking studio runs a Saturday class with 16 stations. Each booked participant shows up with probability 85%; ' +
    'no-shows forfeit the $95 fee. A participant who arrives when every station is taken is refunded and given a voucher, costing $250 ' +
    'in total. Simulate one class, check the show-up model against the exact binomial probability, then use a two-way Data Table ' +
    '(bookings across, runs down) to compare accepting 16 to 20 bookings.',
  sheet: {
    rows: 57,
    cols: 9,
    cells: {
      A1: label('Cooking studio overbooking', true),
      A3: label('Cooking stations'), B3: input(16, '0'),
      A4: label('Bookings accepted'), B4: input(18, '0'),
      A5: label('Show-up probability'), B5: input(0.85, '0%'),
      A6: label('Class fee (paid at booking)'), B6: input(95, '$#,##0'),
      A7: label('Ingredients per cook'), B7: input(22, '$#,##0'),
      A8: label('Cost per bumped participant'), B8: input(250, '$#,##0'),
      A10: header('One Saturday class'),
      A11: label('Participants who show up'), B11: answer('0'),
      A12: label('Participants who cook'), B12: answer('0'),
      A13: label('Participants bumped'), B13: answer('0'),
      A14: label('Profit'), B14: answer('$#,##0'),
      A15: label('Exact P(more show-ups than stations)'), B15: answer('0.0%'),
      B16: { note: 'An empty cell: use it as the Column input cell of the data table' },
      D2: header('Profit by bookings accepted (across) and run (down)'),
      D4: answer('$#,##0'),
      E4: given(16, '0'), F4: given(17, '0'), G4: given(18, '0'), H4: given(19, '0'), I4: given(20, '0'),
      ...runs('D', 5, 50),
      ...['E', 'F', 'G', 'H', 'I'].reduce((acc: Cells, col) => ({ ...acc, ...answers(col, 5, 54, '$#,##0') }), {}),
      D56: label('Average profit'),
      ...['E', 'F', 'G', 'H', 'I'].reduce((acc: Cells, col) => ({ ...acc, [`${col}56`]: answer('$#,##0') }), {}),
      D57: label('Best bookings level'), E57: answer('0'),
    },
    colWidths: { A: 230, B: 80, C: 40, D: 110, E: 80, F: 80, G: 80, H: 80, I: 80 },
    frozenRows: 4,
  },
  tasks: [
    {
      id: 'shows',
      kind: 'formula',
      cells: 'B11',
      prompt: '(a) In B11 simulate how many of the B4 booked participants show up, with `CRITBINOM` and a `RAND`.',
      solution: '=CRITBINOM(B4,B5,RAND())',
      random: { trials: 100, stat: 'mean', target: 15.3, tol: 0.7 },
      wrong: ['=CRITBINOM(B3,B5,RAND())', '=CRITBINOM(B4,1-B5,RAND())', '=B4*B5'],
      hints: [
        'Each booking is an independent yes/no with probability B5, so the number who show up is binomial.',
        'Invert the binomial with CRITBINOM: trials = bookings, probability = show-up rate, alpha = RAND().',
        'CRITBINOM(B4, B5, RAND()).',
      ],
      explain: 'Bin(18, 85%) has mean 15.3: most Saturdays 14-17 people turn up, so with 18 bookings the class is overfull on about 22% of Saturdays.',
    },
    {
      id: 'exact',
      kind: 'formula',
      cells: 'B15',
      prompt: '(b) Check the show-up model exactly: in B15 compute the probability that more participants show up than there are stations, with `BINOMDIST`.',
      solution: '=1-BINOMDIST(B3,B4,B5,TRUE)',
      wrong: ['=BINOMDIST(B3,B4,B5,TRUE)', '=1-BINOMDIST(B3,B4,B5,FALSE)', '=1-BINOMDIST(B3-1,B4,B5,TRUE)', '=1-BINOMDIST(16,18,0.85,TRUE)'],
      hints: [
        'BINOMDIST(k, n, p, TRUE) is the probability of at most k successes in n trials.',
        'Overfull means more than B3 show-ups: the complement of at most B3.',
        '1 - BINOMDIST(B3, B4, B5, TRUE).',
      ],
      explain:
        'With 18 bookings, P(17 or 18 show up) = 1 - BINOMDIST(16, 18, 85%, TRUE) = 22.4%: the share of simulated classes with someone ' +
        'bumped should sit near it, which confirms the CRITBINOM draw. TRUE gives the cumulative probability; FALSE would give the ' +
        'chance of exactly 16 show-ups.',
    },
    {
      id: 'flow',
      kind: 'formula',
      cells: 'B12:B13',
      prompt: '(c) In B12 compute how many participants cook (no more than the stations, `MIN`) and in B13 how many are bumped (`MAX`).',
      solutions: { B12: '=MIN(B11,B3)', B13: '=MAX(0,B11-B3)' },
      wrong: ['=MIN(B11,B4)', '=B11', '=MAX(B11,B3)'],
      hints: ['Cooks = MIN(show-ups, stations).', 'Bumped = MAX(0, show-ups - stations): never negative.', 'MIN(B11,B3) and MAX(0,B11-B3).'],
      explain: 'MIN caps the class at the station count and MAX(0, ...) counts only the overflow.',
    },
    {
      id: 'profit',
      kind: 'formula',
      cells: 'B14',
      prompt: '(d) In B14 compute the profit: fees from every booking, minus ingredients for those who cook, minus the cost of each bumped participant.',
      solution: '=B6*B4-B7*B12-B8*B13',
      wrong: ['=B6*B12-B7*B12-B8*B13', '=B6*B4-B7*B12', '=B6*B4-B7*B4-B8*B13', '=95*B4-22*B12-250*B13', '=B6*B4-B7*B12-250*B13'],
      hints: [
        'No-shows still pay the fee, so fees come from all B4 bookings.',
        'Then subtract ingredients for those who cook (B12) and the cost of each bumped participant (B13).',
        'B6*B4 - B7*B12 - B8*B13.',
      ],
      explain: 'Fees are earned on bookings, ingredients on cooks and the penalty on bumped participants: overbooking trades extra fees against bumping costs.',
    },
    {
      id: 'corner',
      kind: 'formula',
      cells: 'D4',
      prompt: '(e) The two-way table D4:I54 has bookings 16-20 across row 4 and runs 1-50 down column D. In its corner D4 link to the profit.',
      solution: '=B14',
      wrong: ['=B11', '=B4'],
      hints: ['A two-way data table evaluates the single formula in its top-left corner.', 'Point the corner at the profit of one class.'],
      explain: 'The corner formula is the output; each body cell holds it for one bookings level (column) and one run (row).',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'E5:I54',
      prompt: '(f) Select D4:I54 and run a Data Table with the Row input cell B4 (bookings across) and the Column input cell on a blank cell (B16 is free).',
      toolSetup: { range: 'D4:I54', rowInput: 'B4', colInput: 'B16' },
      random: { trials: 3, stat: 'mean', target: 1268.8, tol: 30 },
      hints: [
        'Row input = the cell the values across the top should replace: the bookings accepted.',
        'Column input = an empty cell, so the run numbers down the side only force fresh random draws.',
        'Select D4:I54, Row input cell B4, Column input cell B16.',
      ],
      explain: 'Every body cell is a separate recalculation: column E uses 16 bookings, column I uses 20, and every row redraws the show-ups.',
    },
    {
      id: 'averages',
      kind: 'formula',
      cells: 'E56:I56',
      prompt: '(g) In E56 average the 50 runs for 16 bookings and fill right to I56.',
      solution: '=AVERAGE(E5:E54)',
      wrong: ['=AVERAGE(E4:E54)', '=AVERAGE($E$5:$E$54)'],
      hints: [
        'Each column of the table holds 50 simulated classes for one bookings level.',
        'Average rows 5-54 only (row 4 holds the bookings level) and leave the references relative so the formula fills right.',
        'AVERAGE(E5:E54), filled right to I56.',
      ],
      explain:
        'The expected profits are about $1,221, $1,283, $1,310, $1,293 and $1,237 for 16-20 bookings. Varying a decision variable ' +
        '(the bookings accepted) across the table is a trade-off analysis; varying an uncontrollable parameter such as the show-up rate ' +
        'would be a sensitivity analysis.',
    },
    {
      id: 'best',
      kind: 'formula',
      cells: 'E57',
      prompt: '(h) In E57 return the bookings level (from row 4) with the highest average profit, using `INDEX` and `MATCH`.',
      solution: '=INDEX(E4:I4,MATCH(MAX(E56:I56),E56:I56,0))',
      wrong: ['=MAX(E56:I56)', '=MATCH(MAX(E56:I56),E56:I56,0)', '=INDEX(E4:I4,MATCH(MIN(E56:I56),E56:I56,0))'],
      hints: [
        'MATCH(MAX(row), row, 0) gives the position of the best average.',
        'INDEX on the bookings row turns that position into a bookings level.',
        'INDEX(E4:I4, MATCH(MAX(E56:I56), E56:I56, 0)).',
      ],
      explain: 'MATCH with 0 finds the exact position of the maximum; INDEX reads the bookings level above it.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt: '(i) Advise the studio how many bookings to accept. Comment on how reliable the comparison is with 50 runs per level.',
      answer:
        'Accept about 18 bookings: it has the highest expected profit (about $1,310 against $1,221 with no overbooking), because ' +
        'no-shows keep paying while bumping is still fairly rare (about 22% of Saturdays). 20 bookings is clearly worse: someone is ' +
        'bumped on about 65% of Saturdays. 17, 18 and 19 differ by less than the simulation noise of 50 runs (standard errors of ' +
        '$11-33), so a single run can rank them differently; use more replications before choosing among them.',
    },
  ],
  testCases: [
    { name: '24 bookings are accepted', inputs: { B4: 24 } },
    { name: 'only 12 stations work', inputs: { B3: 12 } },
    { name: 'the show-up rate falls to 70%', inputs: { B5: 0.7 } },
    { name: 'the fee rises to $110 and ingredients cost $25', inputs: { B6: 110, B7: 25 } },
    { name: 'only 12 stations work and bumping costs $300', inputs: { B3: 12, B8: 300 } },
  ],
  skills: ['CRITBINOM(n, p, RAND())', 'BINOMDIST to check the simulation', 'MIN/MAX capacity', 'two-way Data Table: decision across, runs down', 'AVERAGE per column', 'INDEX/MATCH of the best'],
  techniques: [
    'Binomial random variable (CRITBINOM / BINOM.INV)',
    'Capacity and flow-balance logic with MIN/MAX',
    'Data Table for Monte Carlo replications (blank input cell)',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
  ],
}

// average monthly rainfall (mm) at the campsite, for a water year that starts with the wet monsoon in November
const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const RAIN = [255, 300, 240, 120, 170, 165, 165, 135, 150, 150, 140, 165]

const tank: Exercise = {
  id: 'w5-rainwater-tank-exam',
  week: 'W5',
  topic: 'Storage sizing with random rainfall',
  title: 'Exam-style: size a campsite rainwater tank for unreliable rain',
  level: 3,
  minutes: 35,
  scenario:
    'A Pulau Ubin campsite collects rainwater from its shelter roofs into one storage tank for its washrooms. Water use is steady, ' +
    'but rain is not: the monsoon months from November must fill the tank for the drier months that follow, so the campsite plans ' +
    'a water year from November to October. Size the tank for average rain, then let the rain vary and see how much bigger the ' +
    'tank must be. Answer in the cells named in each part, as in the final exam.',
  sheet: {
    rows: 112,
    cols: 12,
    cells: {
      A1: label('Campsite rainwater tank: one water year from November', true),
      A3: label('Roof area (m²)'), B3: input(320, '0'),
      A4: label('Collection efficiency'), B4: input(0.85, '0%'),
      A5: label('Campers per day'), B5: input(40, '0'),
      A6: label('Water per camper per day (litres)'), B6: input(40, '0'),
      A7: label('Rainfall CV (SD / mean)'), B7: input(0.25, '0%'),
      A8: label('Tank reliability target'), B8: input(0.9, '0%'),
      A9: label('Water demand per month (m³)'), B9: answer('0.00'),
      A10: label('Mean monthly rainfall (mm)'), B10: calc('=AVERAGE(C13:C24)', '0.0'),
      D3: label('Tank for average rain (m³)'), G3: answer('0.0'),
      D4: label('Tank at the reliability target (m³)'), G4: answer('0.0'),
      D5: label('Safety factor on the average-rain tank'), G5: answer('0%'),
      D6: label('P(roof collects a year\'s demand)'), G6: answer('0%'),
      D8: label('Blank cell for the data table:'), G8: { note: 'An empty cell: use it as the Column input cell of the data table' },
      A12: header('No.'), B12: header('Month'), C12: header('Avg rain (mm)'), D12: header('Cum supply (m³)'), E12: header('Cum demand (m³)'),
      F12: header('Surplus (m³)'), G12: header('Sim rain (mm)'), H12: header('Sim surplus (m³)'),
      ...runs('A', 13, 12),
      ...listed('B', 13, MONTHS, (v) => given(v)),
      ...listed('C', 13, RAIN, (v) => input(v, '0')),
      ...answers('D', 13, 24, '0.0'),
      ...column('E', 13, 24, (_, row) => calc(`=A${row}*$B$9`, '0.0')),
      ...column('F', 13, 24, (_, row) => calc(`=D${row}-E${row}`, '0.0')),
      ...answers('G', 13, 24, '0'),
      ...answers('H', 13, 24, '0.0'),
      J11: header('Year'), K11: header('Tank (m³)'), L11: header('Year-end surplus (m³)'),
      K12: answer('0.0'), L12: calc('=H24', '0.0'),
      ...runs('J', 13, 100),
      ...answers('K', 13, 112, '0.0'),
      ...answers('L', 13, 112, '0.0'),
    },
    colWidths: { A: 220, B: 80, C: 100, D: 115, E: 120, F: 95, G: 95, H: 125, I: 24, J: 60, K: 90, L: 150 },
    frozenRows: 12,
  },
  tasks: [
    {
      id: 'demand',
      kind: 'formula',
      cells: 'B9',
      prompt: '(a) In B9 compute the campsite\'s water demand per month in m³ (an average month has 365/12 days; 1 m³ = 1,000 litres).',
      solution: '=B5*B6*365/12/1000',
      wrong: ['=B5*B6*30/1000', '=B5*B6*365/12', '=B5*B6*365/1000', '=40*40*365/12/1000'],
      hints: [
        'Daily use = campers x litres per camper per day.',
        'Scale a day up to an average month (365/12 days), then turn litres into m³.',
        'B5*B6*365/12/1000.',
      ],
      explain:
        '40 campers x 40 litres = 1,600 litres a day; x 365/12 days = 48,667 litres, or 48.67 m³ a month (584 m³ a year). Using 30 days ' +
        'drops five days a year, and forgetting /1,000 mixes litres with the m³ on the supply side.',
    },
    {
      id: 'supply',
      kind: 'formula',
      cells: 'D13:D24',
      prompt:
        '(b) In D13 compute the rainwater collected from November up to this month, in m³: roof area x collection efficiency x the rain so ' +
        'far (mm) / 1,000. Use `SUM` over a range that grows as you fill down to D24.',
      solution: '=$B$3*$B$4*SUM($C$13:C13)/1000',
      wrong: ['=$B$3*$B$4*C13/1000', '=$B$3*$B$4*SUM($C$13:$C$24)/1000', '=$B$3*$B$4*SUM($C$13:C13)', '=B3*B4*SUM(C13:C13)/1000'],
      hints: [
        '1 mm of rain on 1 m² of roof is 1 litre, so roof area x rain (mm) / 1,000 is in m³; only the collection efficiency share reaches the tank.',
        'Anchor the start of the range and leave its end relative: SUM($C$13:C13) becomes SUM($C$13:C14), and so on, as you fill down.',
        '$B$3*$B$4*SUM($C$13:C13)/1000.',
      ],
      explain:
        'November alone gives 320 x 0.85 x 255 / 1,000 = 69.4 m³, and by October the roof has collected 586.2 m³, just above the 584 m³ ' +
        'the campers use in a year. The half-anchored range $C$13:C13 is what makes the total cumulative. Columns E and F then give the ' +
        'cumulative demand and the surplus (supply so far minus demand so far).',
    },
    {
      id: 'tank',
      kind: 'formula',
      cells: 'G3',
      prompt:
        '(c) In G3 compute the tank needed with average rain: the largest surplus in F13:F24, floored at 0, minus the surplus left at ' +
        'the end of the year (F24), also floored at 0. Use `MAX`.',
      solution: '=MAX(0,MAX(F13:F24))-MAX(0,F24)',
      wrong: ['=MAX(F13:F24)', '=MAX(F13:F24)-MIN(F13:F24)', '=MAX(0,MAX(D13:D24))-MAX(0,D24)', '=MAX(0,MAX(F13:F24))-MAX(0,F13)'],
      hints: [
        'The tank stores the surplus of the wet months for the drier months, so it must hold the largest cumulative surplus of the year.',
        'Water still in hand at the end of the year is not needed again, so take the year-end surplus off; MAX(0, ...) stops a deficit from counting.',
        'MAX(0, MAX(F13:F24)) - MAX(0, F24).',
      ],
      explain:
        'The surplus peaks at 70.2 m³ in January and 2.2 m³ is left in October, so a 68.1 m³ tank carries the monsoon rain through the ' +
        'drier months. Without a helper column the same rule is one array formula: MAX(0,D13:D24-E13:E24)-MAX(0,D24-E24).',
    },
    {
      id: 'simrain',
      kind: 'formula',
      cells: 'G13:G24',
      prompt:
        '(d) Rain is unreliable. In G13 simulate November\'s rain as the average rain minus a normal variation with mean 0 and SD = the CV ' +
        'in B7 x the mean monthly rainfall in B10, floored at 0, with `MAX`, `NORMINV` and `RAND`. Fill down to G24.',
      solution: '=MAX(0,C13-NORMINV(RAND(),0,$B$7*$B$10))',
      // pooled sd of the 12 months (exact, floor included): sees a wrong SD or a missing average; the floor seldom binds, so MAX is
      // required by name (RAND as well, as the prompt names it)
      random: { trials: 100, stat: 'sd', target: 69.27, tol: 6 },
      check: { mustUse: ['MAX', 'RAND'] },
      wrong: [
        '=C13-NORMINV(RAND(),0,$B$7*$B$10)', '=MAX(0,C13-NORMINV(RAND(),0,$B$7))', '=MAX(0,C13-NORMINV(RAND(),C13,$B$7*$B$10))',
        '=MAX(0,NORMINV(RAND(),0,$B$7*$B$10))', '=MAX(0,C13-NORMINV(RAND(),0,B7*B10))',
      ],
      hints: [
        'CV = SD / mean, so the SD of the variation is CV x mean monthly rainfall: 25% x 179.6 = 44.9 mm, the same for every month.',
        'Draw the variation with NORMINV(RAND(), 0, SD), take it off the month\'s average rain, and floor the result at 0 because rain cannot be negative.',
        'MAX(0, C13 - NORMINV(RAND(), 0, $B$7*$B$10)).',
      ],
      explain:
        'NORMINV(RAND(), 0, 44.9) is a variation centred on 0, so each month\'s rain scatters around its own average with the same SD, ' +
        'and MAX(0, ...) stops a very dry draw from going below zero. MAX(0, NORMINV(RAND(), C13, $B$7*$B$10)) gives the same distribution.',
    },
    {
      id: 'simsurplus',
      kind: 'formula',
      cells: 'H13:H24',
      prompt:
        '(e) In H13 compute the cumulative surplus with the simulated rain: the rainwater collected so far from column G (the rule of ' +
        'part b) minus the cumulative demand in E13. Fill down to H24.',
      solution: '=$B$3*$B$4*SUM($G$13:G13)/1000-E13',
      wrong: ['=$B$3*$B$4*SUM($C$13:C13)/1000-E13', '=$B$3*$B$4*G13/1000-E13', '=F13', '=$B$3*$B$4*SUM($G$13:G13)/1000-$E$13'],
      hints: [
        'Same rule as columns D and F, with the simulated rain in column G instead of the average.',
        'Simulated supply so far = $B$3*$B$4*SUM($G$13:G13)/1000; then subtract the demand so far.',
        '$B$3*$B$4*SUM($G$13:G13)/1000 - E13.',
      ],
      explain:
        'In a wet simulated year the surplus keeps climbing; in a dry one it can sink below zero before October, and then the campsite runs ' +
        'short whatever the size of its tank.',
    },
    {
      id: 'simtank',
      kind: 'formula',
      cells: 'K12',
      prompt:
        '(f) The table J12:L112 will replicate the year. In K12, its first output, compute the tank this simulated year needs: the rule of ' +
        'part (c) applied to column H. (L12 already links to the year-end surplus in H24.)',
      solution: '=MAX(0,MAX(H13:H24))-MAX(0,H24)',
      wrong: ['=MAX(0,MAX(F13:F24))-MAX(0,F24)', '=G3', '=MAX(0,MAX(H13:H24))-MAX(0,H13)'],
      hints: [
        'Same rule as G3, on the simulated surplus.',
        'Largest simulated surplus (floored at 0) minus the simulated year-end surplus (floored at 0).',
        'MAX(0, MAX(H13:H24)) - MAX(0, H24).',
      ],
      explain: 'K12 changes with every F9: each simulated year needs a different tank, and that spread is what the replications measure.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'K13:L112',
      prompt:
        '(g) Replicate the year 100 times: select J12:L112 and run a Data Table with an empty Row input cell and the Column input cell on ' +
        'the blank cell G8.',
      toolSetup: { range: 'J12:L112', colInput: 'G8' },
      // mean over both output columns: tank (about 56.1) and year-end surplus (about 2.0), long-run simulation
      random: { trials: 3, stat: 'mean', target: 29.07, tol: 8 },
      hints: [
        'The year numbers in J13:J112 only trigger the recalculations; the input cell must not feed the model.',
        'K12 and L12 are the two outputs across the top row: select them together with the year numbers.',
        'Select J12:L112, Row input cell empty, Column input cell G8.',
      ],
      explain: 'Each row redraws all 12 months of rain, so column K holds 100 independent tank sizes and column L 100 year-end surpluses: one table can collect several outputs side by side.',
    },
    {
      id: 'sizing',
      kind: 'formula',
      cells: 'G4:G5',
      prompt:
        '(h) In G4 compute the tank that is big enough in the share of years in B8, with `PERCENTILE` over the 100 simulated tanks. In G5 ' +
        'compute the safety factor: how much bigger G4 is than the tank for average rain in G3, as a percentage of G3.',
      solutions: { G4: '=PERCENTILE(K13:K112,B8)', G5: '=G4/G3-1' },
      wrong: ['=PERCENTILE(K13:K112,0.9)', '=PERCENTILE(L13:L112,B8)', '=AVERAGE(K13:K112)', '=PERCENTILE(K12:K112,B8)'],
      hints: [
        'PERCENTILE(range, k) returns the value that a share k of the range does not exceed.',
        'Use the 100 simulated tanks K13:K112 (not the live K12) with k = B8; the safety factor is the extra size relative to G3.',
        'PERCENTILE(K13:K112, B8), and G4/G3 - 1.',
      ],
      explain:
        'About 84 m³ covers 9 years in 10 in the long run, roughly 23% more than the 68 m³ for average rain: that percentage is the safety ' +
        'factor to add. A 100-year table puts the 90th percentile anywhere from about 77 to 90 m³, so quote it as a range.',
    },
    {
      id: 'enough',
      kind: 'formula',
      cells: 'G6',
      prompt:
        '(i) In G6 estimate the probability that the roof collects at least a full year\'s demand (a year-end surplus of 0 or more), ' +
        'with `COUNTIF` over the 100 simulated years.',
      solution: '=COUNTIF(L13:L112,">=0")/COUNT(L13:L112)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(K13:K112,">=0")/COUNT(K13:K112)', '=COUNTIF(L13:L112,">=0")', '=COUNTIF(L13:L112,"<0")/COUNT(L13:L112)'],
      hints: [
        'A year-end surplus of 0 or more means the roof collected at least what the campers used.',
        'COUNTIF(range, ">=0") counts those years; divide by the number of years.',
        'COUNTIF(L13:L112, ">=0") / COUNT(L13:L112).',
      ],
      explain:
        'Only about half the simulated years (52% in the long run; 42% to 62% in a 100-year table) end with water to spare: the roof ' +
        'was sized to balance an average year.',
    },
    {
      id: 'advice',
      kind: 'explain',
      cells: '',
      prompt: '(j) The campsite planned its tank for average rain (G3). Using G4:G6, advise how big the tank should be, and whether a bigger tank alone protects the campsite in a dry year.',
      answer:
        'Size the tank on the simulated years, not on average rain: about 84 m³ is enough in 9 years out of 10, roughly 23% more than ' +
        'the 68 m³ tank for average rain. A bigger tank is not enough on its own, though: it only carries water from wet months to dry ' +
        'months and cannot create water. The roof collects a full year\'s demand in only about half the years (G6), because it was sized ' +
        'to balance an average year, so the campsite also needs a larger roof (or lower use per camper). The percentile from 100 years ' +
        'is rough; more replications would pin it down.',
    },
  ],
  testCases: [
    { name: 'the roof area grows to 400 m²', inputs: { B3: 400 } },
    { name: 'collection efficiency drops to 75%', inputs: { B4: 0.75 } },
    { name: '50 campers a day', inputs: { B5: 50 } },
    { name: 'each camper uses 35 litres a day', inputs: { B6: 35 } },
    { name: 'January brings only 180 mm', inputs: { C15: 180 } },
    { name: 'rain varies more: CV of 40%', inputs: { B7: 0.4 } },
    { name: 'the reliability target is 80%', inputs: { B8: 0.8 } },
  ],
  skills: [
    'monthly demand with unit conversion', 'cumulative supply with SUM($C$13:C13)', 'storage = MAX(0, peak surplus) - MAX(0, year-end surplus)',
    'rain noise MAX(0, average - NORMINV(RAND(), 0, CV x mean))', 'Data Table with two outputs', 'PERCENTILE sizing and safety factor', 'COUNTIF probability',
  ],
  techniques: [
    'Unit conversion (MB to GB, seconds/minutes to day fractions)',
    'Absolute/mixed references so formulas fill down/right',
    'Capacity and flow-balance logic with MIN/MAX',
    'Normal random variable (NORMINV) with a floor via MAX',
    'Data Table for Monte Carlo replications (blank input cell)',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
    'Written interpretation of model results',
  ],
}

export const exercises: readonly Exercise[] = [kopi, bouquets, hub, bakery, rider, toppings, fleet, locker, dice, generator, overbooking, tank]
