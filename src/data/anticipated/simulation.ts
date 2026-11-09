// Anticipated Question 2 parts: random variables, resampling, replications, flows and queues.
// Original exam-style scenarios; formulas follow the course conventions (CRF lower bounds, -mean*LN(RAND()),
// COUNTIF($G$14:G14,">"&E15), IF(J15<$G$4,E15,LARGE(...)), times as day fractions).
import type { AnticipatedQ } from './types'

// shared layouts, so every part of one scenario reads the same cells
const SS_LAYOUT =
  'One pharmacist. Opening time 09:00 in G14 (the end time of an imaginary customer 0) and E14 holds =G14. ' +
  'Customers 1-50 in rows 15-64: inter-arrival gaps C15:C64 and service times D15:D64 (Excel times), ' +
  'arrival times E14:E64, service starts F15:F64, service ends G14:G64, waits H15:H64, times in system I15:I64.'

const MS_LAYOUT =
  'Number of counters c in G4. Opening time 09:00 in G14 (the end time of an imaginary customer 0) and E14 holds =G14. ' +
  'Customers 1-50 in rows 15-64: inter-arrival gaps C15:C64 and service times D15:D64 (Excel times), arrival times E14:E64, ' +
  'service starts F15:F64, service ends G14:G64, waits H15:H64, number in system at arrival J15:J64.'

const QM_LAYOUT =
  'Single check-in counter; each row is a group of visitors. Groups 1-50 in rows 15-64: group numbers A15:A64, group sizes B15:B64, ' +
  'inter-arrival gaps C15:C64, service times D15:D64, arrivals E14:E64 (E14 = opening time 09:00), service starts F15:F64, ' +
  'service ends G14:G64 (G14 = opening time 09:00), waits H15:H64, times in system I15:I64 (all Excel times), ' +
  'number in system at arrival J15:J64. Thresholds in minutes: 5 in B6 and 10 in B7.'

const BR_LAYOUT =
  'Car wash with 2 washing bays in I4. Balk limit 6 in F4 (a driver balks when MORE than 6 cars are already in the system), ' +
  'renege limit 0:20 typed as a time in G4, opening time 08:00 in I14 (the end time of an imaginary car 0). ' +
  'Cars 1-50 in rows 15-64: gaps C15:C64, wash times D15:D64, arrivals E15:E64, potential start F15:F64, potential wait G15:G64, ' +
  'actual start H15:H64, end time I14:I64, wait J15:J64, time in system K15:K64, system length at arrival L15:L64. ' +
  'Cars that balk or renege hold "" where they have no value.'

const BQ_LAYOUT =
  'Bumboats from a jetty: interval 10 (minutes) in B2, seats per boat 12 in D2, shelter capacity 25 in G2, fare $4 in J2, ' +
  'loading time 15 (seconds per passenger) in K2. Arrivals per interval 6, 9, 12, 15, 18 in M6:M10 (probabilities 0.15, 0.25, 0.30, 0.20, 0.10) ' +
  'with CRF lower bounds 0, 0.15, 0.40, 0.70, 0.90 in N6:N10. Row 6 is the start state: C6 = 07:00 and G6 = 0 (nobody left behind). ' +
  'Departures 1-36 in rows 7-42: scheduled time C7:C42, arrivals D7:D42, in shelter E7:E42, boarded F7:F42, left behind G6:G42, ' +
  'turned away H7:H42, actual departure I7:I42, revenue J7:J42.'

const FL_LAYOUT =
  'Umbrella sharing at four MRT stations numbered 1-4. Route table rows 5-16 (one row per origin-destination pair): ' +
  'origin station number A5:A16, destination station number B5:B16, potential borrowers n C5:C16 (some 0), ' +
  'borrow probability p D5:D16, simulated trips E5:E16, fare F5:F16. Station table rows 5-8: station number H5:H8, ' +
  'start stock I5:I8, departures J5:J8, arrivals K5:K8, end stock L5:L8, surplus M5:M8. Target stock per station 30 in P2, ' +
  'cost per umbrella moved $1.50 in P3, fare matrix P5:S8 (row = origin station 1-4, column = destination station 1-4).'

const REP_LAYOUT =
  'One simulated weekend of a pop-up stall: profit (the output) in H20, computed from RAND() inputs. One-way Data Table in K5:L505: ' +
  'trial numbers 1-500 in K6:K505, link cell L5 (=H20), replicated profits L6:L505. N2 is a blank cell that no formula uses.'

export const questions: readonly AnticipatedQ[] = [
  // ---------------------------------------------------------------- discrete-rv
  {
    id: 'discrete-rv-prob-from-freq',
    topic: 'discrete-rv',
    question:
      'A chicken-rice stall logged how many orders arrived in each of 200 five-minute intervals. In C5, compute the probability of each order count from its frequency, and fill down to C9. In C10, check that the probabilities add up to 1.',
    layout: 'Order counts 0, 1, 2, 3, 4 in A5:A9; frequencies 20, 50, 70, 40, 20 (200 intervals in total) in B5:B9. Probabilities go in C5:C9 and the check in C10.',
    formulas: [
      { cell: 'C5 (fill to C5:C9)', formula: '=B5/SUM($B$5:$B$9)', note: 'frequency over the anchored total' },
      { cell: 'C10', formula: '=SUM(C5:C9)', note: 'must show 1' },
    ],
    steps: [
      'Divide each frequency by the total of all frequencies.',
      'Anchor the total range ($B$5:$B$9) so it does not slide as you fill down.',
      'Check that the probabilities add up to exactly 1.',
    ],
    pitfalls: [
      'Dividing by a typed 200 breaks if the data change; divide by SUM of the range.',
      'Without the $ signs, row 6 divides by SUM(B6:B10), which drops B5 and gives wrong probabilities.',
    ],
    answer: 'C5:C9 = 0.10, 0.25, 0.35, 0.20, 0.10 and C10 = 1.',
  },
  {
    id: 'discrete-rv-crf-lower-bound',
    topic: 'discrete-rv',
    question:
      'Using the probabilities in C5:C9, build the cumulative probability (CRF) column in D5:D9 as LOWER bounds, so that a random number can be looked up against it.',
    layout: 'Order counts 0-4 in A5:A9 and their probabilities 0.10, 0.25, 0.35, 0.20, 0.10 in C5:C9. The CRF lower bounds go in D5:D9.',
    formulas: [
      { cell: 'D5', formula: '=0', note: 'or simply type 0: the first lower bound is always 0' },
      { cell: 'D6 (fill to D6:D9)', formula: '=D5+C5', note: 'bound above + probability above' },
      { cell: 'D6 (alternative, fill to D6:D9)', formula: '=SUM($C$5:C5)', note: 'running total of the probabilities above' },
    ],
    steps: [
      'Start the column at 0 on the first value row.',
      'Each next bound = previous bound + the probability of the row ABOVE.',
      'The last bound equals 1 minus the last probability (here 0.90), never 1.',
    ],
    pitfalls: [
      'Starting at the first probability (0.10) instead of 0 shifts every draw by one value.',
      'Adding the probability of the same row gives upper bounds; LOOKUP then returns a value one row too low and #N/A for small random numbers.',
    ],
    answer: 'D5:D9 = 0, 0.10, 0.35, 0.70, 0.90.',
  },
  {
    id: 'discrete-rv-lookup-draw',
    topic: 'discrete-rv',
    question:
      'Simulate the number of orders in each of the 60 intervals of the lunch period. In G15, draw a value from the order-count distribution, and fill down to G74.',
    layout: 'Order counts 0-4 in A5:A9 (ascending), CRF lower bounds 0, 0.10, 0.35, 0.70, 0.90 in D5:D9. Intervals 1-60 in F15:F74; the draws go in G15:G74.',
    formulas: [{ cell: 'G15 (fill to G15:G74)', formula: '=LOOKUP(RAND(),$D$5:$D$9,$A$5:$A$9)', note: 'LOOKUP(value, CRF lower bounds, values)' }],
    steps: [
      'RAND() is the lookup value.',
      'Lookup vector = the CRF lower-bound column; result vector = the values column. Same size, both anchored.',
      'LOOKUP returns the value on the last row whose lower bound is <= RAND().',
      'Press F9 a few times: the average of G15:G74 should stay near the expected value 1.95.',
    ],
    pitfalls: [
      'Swapping the vectors (values first, CRF second) returns the wrong column.',
      'The CRF column must be in ascending order and start at 0.',
    ],
    answer: 'Each cell shows 0-4 and changes on every F9; in the long run about 10% of intervals are 0, 25% are 1, 35% are 2, 20% are 3 and 10% are 4.',
  },
  {
    id: 'discrete-rv-vlookup-draw',
    topic: 'discrete-rv',
    question:
      'A durian stall serves groups of 1 to 5 people. Draw a random group size for each of 40 groups in C15:C54 with VLOOKUP on the group-size table (formula in C15, filled down).',
    layout:
      'Group-size table K4:L8: CRF lower bounds 0, 0.30, 0.55, 0.80, 0.95 in K4:K8 and group sizes 1, 2, 3, 4, 5 in L4:L8 (probabilities 0.30, 0.25, 0.25, 0.15, 0.05). Groups 1-40 in rows 15-54; sizes go in C15:C54.',
    formulas: [{ cell: 'C15 (fill to C15:C54)', formula: '=VLOOKUP(RAND(),$K$4:$L$8,2,TRUE)', note: 'approximate match on the CRF column' }],
    steps: [
      'The CRF lower bounds must be the LEFTMOST column of the table range.',
      'Column index 2 returns the group size beside the matched bound.',
      'TRUE (or leaving it out) means approximate match: the largest bound <= RAND().',
    ],
    pitfalls: [
      'FALSE (exact match) returns #N/A because RAND() almost never equals a bound.',
      'If the values sit to the LEFT of the CRF column, VLOOKUP cannot reach them: use LOOKUP(RAND(),CRF,values).',
    ],
    answer: 'Sizes 1-5 that change on F9; the long-run average is 1(0.30) + 2(0.25) + 3(0.25) + 4(0.15) + 5(0.05) = 2.40.',
  },
  {
    id: 'discrete-rv-predrawn',
    topic: 'discrete-rv',
    question:
      'So the first run can be marked, the template gives a fixed random number for each group in B15:B54. In C15, return the group size for that random number instead of using RAND(), and fill down to C54. What size does 0.62 give?',
    layout: 'Fixed random numbers in B15:B54 (B15 = 0.62). Group-size table: CRF lower bounds 0, 0.30, 0.55, 0.80, 0.95 in K4:K8, group sizes 1-5 in L4:L8.',
    formulas: [{ cell: 'C15 (fill to C15:C54)', formula: '=LOOKUP(B15,$K$4:$K$8,$L$4:$L$8)', note: 'the given random number replaces RAND()' }],
    steps: [
      'Use the given random-number cell as the lookup value, relative so it moves down.',
      'Keep the table ranges anchored.',
      'Check one row by hand: find the last lower bound that is <= the random number.',
    ],
    pitfalls: [
      'Writing RAND() when the paper supplies fixed numbers loses the marks for matching the key.',
      'Anchoring the random number ($B$15) makes every group use the first number.',
    ],
    answer: '0.62 lies between the bounds 0.55 and 0.80, so C15 = 3. With fixed numbers the results do not change on F9.',
  },
  {
    id: 'discrete-rv-expected-value',
    topic: 'discrete-rv',
    question:
      'Check the order-count model: in C12, compute the expected number of orders per interval from the table; in C13, the average of the 60 simulated intervals, so the two can be compared.',
    layout: 'Order counts 0-4 in A5:A9, probabilities 0.10, 0.25, 0.35, 0.20, 0.10 in C5:C9, simulated counts for 60 intervals in G15:G74.',
    formulas: [
      { cell: 'C12', formula: '=SUMPRODUCT(A5:A9,C5:C9)', note: 'sum of value x probability' },
      { cell: 'C13', formula: '=AVERAGE(G15:G74)', note: 'simulated average, changes on F9' },
    ],
    steps: [
      'Multiply each value by its probability and add up: SUMPRODUCT does both.',
      'Average the simulated column.',
      'The two should be close; a big gap points to a CRF or LOOKUP error.',
    ],
    pitfalls: ['SUMPRODUCT with the CRF column instead of the probabilities gives a meaningless number.'],
    answer: 'C12 = 0(0.10) + 1(0.25) + 2(0.35) + 3(0.20) + 4(0.10) = 1.95 orders. C13 changes on every F9 and should land near 1.95.',
  },
  {
    id: 'discrete-rv-upper-crf-shifted',
    topic: 'discrete-rv',
    question:
      'A taxi-stand table gives, for 0 to 4 taxis arriving per minute, the running cumulative probability INCLUDING each value (as in the course DataSim sheet). Without adding a new column, draw the number of taxis arriving in each of 120 minutes in D15:D134 (formula in D15, filled down).',
    layout:
      'Taxi counts 0, 1, 2, 3, 4 in A6:A10, probabilities 0.20, 0.30, 0.25, 0.15, 0.10 in B6:B10, running cumulative probabilities 0.20, 0.50, 0.75, 0.90, 1.00 in C6:C10, and C5 holds 0. Minutes 1-120 in rows 15-134; draws go in D15:D134.',
    formulas: [{ cell: 'D15 (fill to D15:D134)', formula: '=LOOKUP(RAND(),$C$5:$C$9,$A$6:$A$10)', note: 'CRF range starts one row ABOVE the values' }],
    steps: [
      'A running total that includes its own row is an UPPER bound; LOOKUP needs lower bounds.',
      'The lower bound of each value is the running total of the row above, so pair C5:C9 (C5 = 0) with the values A6:A10.',
      'Both vectors still have the same number of cells (5 and 5).',
    ],
    pitfalls: ['=LOOKUP(RAND(),$C$6:$C$10,$A$6:$A$10) returns #N/A whenever RAND() < 0.20 and a value one too low otherwise.'],
    answer: 'Taxi counts 0-4 that change on F9. Example: 0.60 matches the bound 0.50 (third position) and returns the third value, 2 taxis.',
  },

  // ---------------------------------------------------------------- continuous-rv
  {
    id: 'continuous-rv-uniform',
    topic: 'continuous-rv',
    question:
      'A food-delivery rider takes anywhere between 20 and 35 minutes per delivery, all values equally likely. In D15, simulate the delivery time in minutes for each of 100 orders, and fill down to D114.',
    layout: 'Minimum 20 (minutes) in B3, maximum 35 (minutes) in B4. Orders 1-100 in rows 15-114; times go in D15:D114.',
    formulas: [{ cell: 'D15 (fill to D15:D114)', formula: '=$B$3+RAND()*($B$4-$B$3)', note: 'a + RAND() x (b - a)' }],
    steps: [
      'RAND() is uniform between 0 and 1; multiplying by (b - a) stretches it to the width of the range.',
      'Adding a shifts it to start at the minimum.',
      'Anchor both parameter cells.',
    ],
    pitfalls: [
      'RANDBETWEEN(20,35) gives whole minutes only; use it only when the question says whole numbers.',
      'RAND()*$B$4 alone runs from 0 to 35, not 20 to 35.',
    ],
    answer: 'Values between 20 and 35 that change on F9; the long-run average is (20 + 35)/2 = 27.5 minutes.',
  },
  {
    id: 'continuous-rv-uniform-clock',
    topic: 'continuous-rv',
    question: 'A supplier van arrives at a random time, equally likely anywhere between 10:00 and 10:30. In C5, simulate its arrival clock time.',
    layout: 'Earliest time 10:00 in B3 and latest time 10:30 in B4, both typed as times. The arrival time goes in C5 (format h:mm:ss).',
    formulas: [
      { cell: 'C5', formula: '=$B$3+RAND()*($B$4-$B$3)', note: 'uniform between two clock times' },
      { cell: 'C5 (alternative)', formula: '=TIME(10,0,0)+RAND()*30/1440', note: '10:00 plus up to 30 minutes' },
    ],
    steps: [
      'Clock times are day fractions, so the uniform formula works on them directly.',
      'If the width is given in minutes, convert it: 30/1440.',
      'Format the result as a time.',
    ],
    pitfalls: ['=TIME(10,0,0)+RAND()*30 adds up to 30 DAYS.'],
    answer: 'A time between 10:00 and 10:30 that changes on F9; the average is 10:15.',
  },
  {
    id: 'continuous-rv-randbetween',
    topic: 'continuous-rv',
    question:
      'Each visitor to a souvenir kiosk buys a whole number of keychains from 1 to 6, all equally likely. In E15, simulate the number bought by each of 80 visitors, and fill down to E94.',
    layout: 'Smallest quantity 1 in B3, largest quantity 6 in B4. Visitors 1-80 in rows 15-94; quantities go in E15:E94.',
    formulas: [{ cell: 'E15 (fill to E15:E94)', formula: '=RANDBETWEEN($B$3,$B$4)', note: 'whole numbers, both ends included' }],
    steps: [
      'RANDBETWEEN(bottom, top) returns a whole number, every value equally likely.',
      'Both ends are included: 1 and 6 can both appear.',
    ],
    pitfalls: ['=ROUND($B$3+RAND()*($B$4-$B$3),0) makes the two end values only half as likely as the middle ones.'],
    answer: 'Whole numbers 1-6 that change on F9; the long-run average is (1 + 6)/2 = 3.5 keychains.',
  },
  {
    id: 'continuous-rv-normal',
    topic: 'continuous-rv',
    question:
      'Daily demand for kaya toast sets at a kopitiam is normally distributed with mean 180 and standard deviation 25. In C15, simulate the demand for each of 30 days, and fill down to C44.',
    layout: 'Mean 180 in B3, standard deviation 25 in B4. Days 1-30 in rows 15-44; demands go in C15:C44.',
    formulas: [{ cell: 'C15 (fill to C15:C44)', formula: '=NORMINV(RAND(),$B$3,$B$4)', note: 'NORMINV(probability, mean, sd)' }],
    steps: [
      'The first argument is the random probability RAND().',
      'Then the mean, then the standard deviation.',
      'Add ROUND or MAX only if the question asks for whole units or a floor.',
    ],
    pitfalls: ['NORMINV(RAND(),$B$4,$B$3) swaps the mean and the sd.', 'NORM.INV is the newer name of the same function; NORMINV is the course form.'],
    answer: 'Decimal values that change on F9, almost all within 180 +/- 3 x 25 (105 to 255); the average over many days is near 180.',
  },
  {
    id: 'continuous-rv-normal-floor',
    topic: 'continuous-rv',
    question:
      'Making a bubble-tea order takes a normally distributed time with mean 3 minutes and standard deviation 1.2 minutes, but never less than 0.5 minutes. In D15, simulate the time in minutes for each of 50 orders, and fill down to D64.',
    layout: 'Mean 3 (minutes) in B3, standard deviation 1.2 (minutes) in B4, minimum 0.5 (minutes) in B5. Orders 1-50 in rows 15-64; times go in D15:D64.',
    formulas: [{ cell: 'D15 (fill to D15:D64)', formula: '=MAX($B$5,NORMINV(RAND(),$B$3,$B$4))', note: 'MAX applies the floor' }],
    steps: [
      'Draw the normal value with NORMINV(RAND(), mean, sd).',
      'Wrap it in MAX(floor, draw): any draw below the floor becomes the floor.',
    ],
    pitfalls: ['MIN instead of MAX caps every time at 0.5.', 'Leaving the floor out lets a few draws go negative.'],
    answer: 'Values of at least 0.5 that change on F9; the average is slightly above 3 because the floor lifts the lowest draws.',
  },
  {
    id: 'continuous-rv-normal-round',
    topic: 'continuous-rv',
    question:
      'The number of walk-in patients at a polyclinic each hour is roughly normal with mean 14 and standard deviation 5. In C15, simulate a whole, never-negative number of patients for each of 10 hours, and fill down to C24.',
    layout: 'Mean 14 in B3, standard deviation 5 in B4. Hours 1-10 in rows 15-24; counts go in C15:C24.',
    formulas: [{ cell: 'C15 (fill to C15:C24)', formula: '=MAX(0,ROUND(NORMINV(RAND(),$B$3,$B$4),0))', note: 'round to whole patients, then floor at 0' }],
    steps: ['Draw the normal value.', 'ROUND(..., 0) makes it a whole number.', 'MAX(0, ...) turns any negative count into 0.'],
    pitfalls: [
      'ROUNDUP or ROUNDDOWN shift the average by about half a patient; ROUND keeps it centred.',
      'ROUND alone can still give -1 or -2 for a draw far below the mean.',
    ],
    answer: 'Whole numbers 0 or more that change on F9, averaging close to 14.',
  },
  {
    id: 'continuous-rv-normal-time',
    topic: 'continuous-rv',
    question:
      'At an immigration counter each check takes a normally distributed time with mean 4 minutes and standard deviation 1.5 minutes, never less than 1 minute. The queue works in clock times. In D15, simulate the check time as an Excel time, and fill down to D64.',
    layout: 'Mean 4 (minutes, typed as a number) in B3, standard deviation 1.5 (minutes) in B4, minimum 1 (minute) in B5. Travellers 1-50 in rows 15-64; check times (format mm:ss) go in D15:D64.',
    formulas: [
      { cell: 'D15 (fill to D15:D64)', formula: '=MAX($B$5/1440,NORMINV(RAND(),$B$3/1440,$B$4/1440))', note: 'everything converted to day fractions' },
      { cell: 'D15 (alternative)', formula: '=MAX($B$5,NORMINV(RAND(),$B$3,$B$4))/1440', note: 'draw and floor in minutes, convert once' },
    ],
    steps: [
      'Excel times are fractions of a day: 1 minute = 1/1440.',
      'Convert the mean, the sd AND the floor, or work in minutes and divide the final result by 1440.',
      'Format the column mm:ss (or [h]:mm:ss).',
    ],
    pitfalls: [
      'Converting the mean but not the sd or the floor mixes units: MAX(1, ...) on day fractions makes every check last 1 full day.',
      'About 0.0028 in General format is not an error: it is 4 minutes (check with x1440).',
    ],
    answer: 'Times of at least 0:01:00 that change on F9; their average x 1440 is about 4 minutes.',
  },
  {
    id: 'continuous-rv-service-by-size',
    topic: 'continuous-rv',
    question:
      'At a clinic registration desk, registering a family takes a normal time with mean 2 minutes plus 1.5 minutes per family member and standard deviation 0.8 minutes, never below 1 minute. In D15, simulate the registration time as an Excel time for each family, and fill down to D64.',
    layout:
      'Base time 2 (minutes) in B3, extra time per member 1.5 (minutes) in B4, standard deviation 0.8 (minutes) in B5, minimum 1 (minute) in B6. Families 1-50 in rows 15-64 with family sizes in C15:C64; times (format mm:ss) go in D15:D64.',
    formulas: [{ cell: 'D15 (fill to D15:D64)', formula: '=MAX($B$6,NORMINV(RAND(),$B$3+$B$4*C15,$B$5))/1440', note: 'mean depends on the row; converted to a time at the end' }],
    steps: [
      'Build the mean for this row: base + per-member time x family size.',
      'Draw in minutes and apply the floor with MAX.',
      'Divide the final result by 1440 to get a time value.',
    ],
    pitfalls: [
      'Anchoring C15 gives every family the size of the first one.',
      'Converting only the mean to a day fraction while the sd and the floor stay in minutes mixes units; stay in minutes and divide once.',
    ],
    answer: 'Times that change on F9; a family of 3 averages about 2 + 1.5 x 3 = 6.5 minutes (0:06:30).',
  },
  {
    id: 'continuous-rv-exponential',
    topic: 'continuous-rv',
    question:
      'Calls to a hotline arrive with exponentially distributed gaps averaging 2.5 minutes. In C15, simulate the gap in minutes (a plain number) for each of 100 calls, and fill down to C114. Give both common forms of the formula.',
    layout: 'Mean gap 2.5 (minutes) in B3. Calls 1-100 in rows 15-114; gaps go in C15:C114.',
    formulas: [
      { cell: 'C15 (fill to C15:C114)', formula: '=-$B$3*LN(RAND())', note: 'course form' },
      { cell: 'C15 (alternative)', formula: '=-$B$3*LN(1-RAND())', note: 'inverse CDF; same distribution since 1-RAND() is also uniform' },
    ],
    steps: [
      'LN of a number between 0 and 1 is negative, so the leading minus makes the gap positive.',
      'Multiply by the MEAN, not the rate.',
      'If a rate is given (calls per hour), the mean gap is 1/rate: 24 calls per hour means 60/24 = 2.5 minutes.',
    ],
    pitfalls: ['Without the minus sign every gap is negative.', 'Putting the rate (24) where the mean (2.5) belongs.'],
    answer: 'Positive values that change on F9 and average about 2.5 minutes: many short gaps, a few long ones.',
  },
  {
    id: 'continuous-rv-exp-time',
    topic: 'continuous-rv',
    question:
      'Cars reach a carpark gantry with exponential gaps averaging 1.5 minutes, and the arrival column holds clock times. In C15, simulate each gap as an Excel time, and fill down to C214.',
    layout: 'Mean gap 1.5 (minutes, typed as a number) in B3. Cars 1-200 in rows 15-214; gaps (format mm:ss) go in C15:C214.',
    formulas: [
      { cell: 'C15 (fill to C15:C214)', formula: '=-$B$3/1440*LN(RAND())', note: 'mean converted from minutes to a day fraction' },
      { cell: 'C15 (if B3 holds the time 0:01:30)', formula: '=-$B$3*LN(RAND())', note: 'no /1440 when the mean is already a time' },
    ],
    steps: [
      'Check how the mean is stored: a number of minutes (1.5) or a time (0:01:30).',
      'A number of minutes must be divided by 1440 before it is added to clock times.',
      'A mean typed as a time is already a day fraction: do not divide again.',
    ],
    pitfalls: ['Dividing a mean that is already a time by 1440 makes the gaps 1440 times too small.', 'Forgetting /1440 on a mean in minutes adds 1.5 DAYS per car.'],
    answer: 'Gaps that change on F9; formatted mm:ss they average about 01:30.',
  },
  {
    id: 'continuous-rv-binomial',
    topic: 'continuous-rv',
    question:
      'Each tour group booked on a river-cruise slot has a known number of members, and each member independently fails to show up with probability 0.08. Some slots have no booking (0 members). In D15, simulate the number of no-shows for each of 40 slots, and fill down to D54.',
    layout: 'No-show probability 0.08 in B3. Members booked per slot in C15:C54 (whole numbers, some 0). No-shows go in D15:D54.',
    formulas: [{ cell: 'D15 (fill to D15:D54)', formula: '=IF(C15>0,CRITBINOM(C15,$B$3,RAND()),0)', note: 'CRITBINOM(trials, probability, RAND())' }],
    steps: [
      'n independent yes/no trials with the same chance p give a binomial count.',
      'CRITBINOM(n, p, RAND()) draws that count.',
      'Guard with IF(n>0, ..., 0) so an empty slot always gives 0 and never an error.',
    ],
    pitfalls: [
      'The order is trials, probability, random number: CRITBINOM(RAND(),C15,$B$3) is wrong.',
      'Anchor p but not n, because n changes row by row.',
      'BINOM.INV is the newer name; CRITBINOM is the course form.',
    ],
    answer: 'Whole numbers from 0 to the slot size that change on F9; a slot averages 0.08 x its members (25 members gives 2 no-shows on average).',
  },
  {
    id: 'continuous-rv-poisson-approx',
    topic: 'continuous-rv',
    question:
      'The number of ambulance call-outs per day in a district is Poisson with mean 3.2. Using the course method, simulate the daily count in C15 for 365 days, filling down to C379.',
    layout: 'Mean 3.2 call-outs per day in B3. Days 1-365 in rows 15-379; counts go in C15:C379.',
    formulas: [{ cell: 'C15 (fill to C15:C379)', formula: '=CRITBINOM(1000,$B$3/1000,RAND())', note: 'binomial with large n and p = mean/n' }],
    steps: [
      'Poisson is the limit of a binomial with large n and small p where n x p = mean.',
      'Use n = 1000 (as in the course) and p = mean/1000.',
      'The result is a whole number 0, 1, 2, ...',
    ],
    pitfalls: ['NORMINV for a small-mean count gives decimals and negative values.', 'p must be mean/n (between 0 and 1), not the mean itself.'],
    answer: 'Whole numbers that change on F9, averaging about 3.2 per day.',
  },
  {
    id: 'continuous-rv-bernoulli',
    topic: 'continuous-rv',
    question:
      'Each customer at a mixed-rice stall buys a drink with probability 0.35. In F15, record 1 if the customer buys a drink and 0 if not, and fill down to F74 (60 customers). In F76, compute the simulated share of buyers.',
    layout: 'Probability 0.35 in B3. Customers 1-60 in rows 15-74; the 1/0 results go in F15:F74 and the share in F76.',
    formulas: [
      { cell: 'F15 (fill to F15:F74)', formula: '=IF(RAND()<$B$3,1,0)' },
      { cell: 'F76', formula: '=AVERAGE(F15:F74)', note: 'share of 1s' },
    ],
    steps: [
      'RAND() < p is TRUE with probability p.',
      'Return 1/0 so that SUM counts the buyers and AVERAGE gives the share.',
      'If the same random number is needed twice, put RAND() in its own cell and test that cell.',
    ],
    pitfalls: ['RAND()>$B$3 happens with probability 1 - p = 0.65.', 'Text results ("Yes"/"No") cannot be summed; use 1/0 or COUNTIF.'],
    answer: 'F76 changes on F9 and stays around 0.35 (21 buyers out of 60 on average).',
  },
  {
    id: 'continuous-rv-choice-crf',
    topic: 'continuous-rv',
    question:
      'Customers at a bakery pay by card (50%), PayNow (30%) or cash (20%). In C15, draw one random number per customer; in D15, return the payment method from that number. Fill both down to row 74. Also give the CRF-table version.',
    layout:
      'Customers 1-60 in rows 15-74: random numbers in C15:C74, payment methods in D15:D74. Optional table: CRF lower bounds 0, 0.50, 0.80 in J4:J6 and the methods "Card", "PayNow", "Cash" in K4:K6.',
    formulas: [
      { cell: 'C15 (fill to C15:C74)', formula: '=RAND()', note: 'one stored random number per customer' },
      { cell: 'D15 (fill to D15:D74)', formula: '=IF(C15<0.5,"Card",IF(C15<0.8,"PayNow","Cash"))', note: 'cumulative cut-offs 0.5 and 0.8' },
      { cell: 'D15 (table alternative)', formula: '=LOOKUP(C15,$J$4:$J$6,$K$4:$K$6)', note: 'same result from the CRF table' },
    ],
    steps: [
      'Store one RAND() in its own cell.',
      'Compare it with CUMULATIVE cut-offs: below 0.5 is Card, 0.5 to 0.8 is PayNow, the rest (0.2) is Cash.',
      'With many options a CRF table and LOOKUP are easier to check.',
    ],
    pitfalls: [
      '=IF(RAND()<0.5,"Card",IF(RAND()<0.8,"PayNow","Cash")) uses two different random numbers: PayNow comes out 0.5 x 0.8 = 40% and Cash 10%.',
      'Using the plain probabilities (0.5, 0.3) as cut-offs instead of the cumulative ones (0.5, 0.8).',
    ],
    answer: 'Text labels that change on F9; over many customers about 50% Card, 30% PayNow and 20% Cash.',
  },

  // ---------------------------------------------------------------- resample
  {
    id: 'resample-percentile',
    topic: 'resample',
    question:
      'The template lists 120 recorded taxi-queue waiting times (minutes) in B5:K16. Resample them as a continuous variable: in N15, draw one simulated waiting time, and fill down to N214.',
    layout: 'Observed waiting times in minutes in the block B5:K16 (12 rows by 10 columns = 120 values). Simulated draws go in N15:N214.',
    formulas: [{ cell: 'N15 (fill to N15:N214)', formula: '=PERCENTILE($B$5:$K$16,RAND())', note: 'random percentile of the data' }],
    steps: [
      'PERCENTILE(data, k) returns the value below which a share k of the data lies.',
      'With k = RAND() every percentile is equally likely, so the draws follow the shape of the data.',
      'It interpolates between neighbouring observations, so draws are continuous between the smallest and largest value.',
    ],
    pitfalls: ['The data block can span several columns; anchor the whole block.', 'Draws can never go below the smallest or above the largest observation.'],
    answer: 'Values between the smallest and largest recorded wait that change on F9; their average is close to AVERAGE(B5:K16).',
  },
  {
    id: 'resample-small',
    topic: 'resample',
    question:
      'The number of items in 80 recorded self-checkout baskets is in A5:A84 (whole numbers). In D2, count the observations; in F15, resample one basket size so that only observed values can appear, and fill down to F64.',
    layout: 'Recorded basket sizes in A5:A84 (80 whole numbers). The count goes in D2 and the simulated sizes in F15:F64.',
    formulas: [
      { cell: 'D2', formula: '=COUNT($A$5:$A$84)', note: 'n = 80' },
      { cell: 'F15 (fill to F15:F64)', formula: '=SMALL($A$5:$A$84,RANDBETWEEN(1,$D$2))', note: 'k-th smallest for a random position k' },
      { cell: 'F15 (alternative)', formula: '=INDEX($A$5:$A$84,RANDBETWEEN(1,$D$2))', note: 'random row; same distribution' },
      { cell: 'F15 (rounded alternative)', formula: '=ROUND(PERCENTILE($A$5:$A$84,RAND()),0)', note: 'course alternative: whole numbers, but it can return values between observations that were never recorded' },
    ],
    steps: [
      'Count the data so the random position covers every observation.',
      'RANDBETWEEN(1, n) picks a position; SMALL returns the value in that sorted position.',
      'Every recorded basket is equally likely, so values appear in proportion to their frequency.',
    ],
    pitfalls: ['RANDBETWEEN(1,100) with only 80 values gives #NUM! whenever k > 80.', 'PERCENTILE without ROUND interpolates and can return 3.4 items.'],
    answer: 'D2 = 80. F15:F64 are whole numbers that all appear in A5:A84 and change on F9.',
  },
  {
    id: 'resample-index-row',
    topic: 'resample',
    question:
      'A hawker centre has 40 stalls listed in A5:A44. Each day an inspector visits one stall chosen at random. In E15, return the stall inspected on each of 30 days, and fill down to E44.',
    layout: 'Stall names in A5:A44 (40 stalls). Days 1-30 in rows 15-44; the inspected stall goes in E15:E44.',
    formulas: [{ cell: 'E15 (fill to E15:E44)', formula: '=INDEX($A$5:$A$44,RANDBETWEEN(1,40))', note: 'random position 1-40' }],
    steps: ['INDEX(list, k) returns the k-th item.', 'RANDBETWEEN(1, 40) makes every stall equally likely.', 'The upper limit must equal the number of items in the list.'],
    pitfalls: ['RANDBETWEEN(0,40) can ask for position 0, which is not a stall; positions start at 1.'],
    answer: 'Stall names that change on F9; each stall has a 1/40 = 2.5% chance per day.',
  },
  {
    id: 'resample-index-grid',
    topic: 'resample',
    question:
      'The loading time per passenger (seconds) is equally likely to be any of the 8 values in the table H4:I7. In J15, draw one loading time for each of 36 departures, and fill down to J50.',
    layout: 'Loading times in seconds in the 4-row by 2-column table H4:I7 (8 equally likely values). Draws go in J15:J50.',
    formulas: [{ cell: 'J15 (fill to J15:J50)', formula: '=INDEX($H$4:$I$7,RANDBETWEEN(1,4),RANDBETWEEN(1,2))', note: 'random row 1-4, random column 1-2' }],
    steps: [
      'INDEX(table, row, column) returns one cell of a grid.',
      'Draw the row with RANDBETWEEN(1, rows) and the column with RANDBETWEEN(1, columns).',
      'Each of the 4 x 2 = 8 cells is then equally likely.',
    ],
    pitfalls: [
      'Swapping the limits asks for columns 3 or 4 of a 2-column table and returns #REF!.',
      'These are seconds: divide by 86400 before adding them to a clock time.',
    ],
    answer: 'Values from the table that change on F9; the long-run average is the plain average of the 8 cells, AVERAGE(H4:I7).',
  },

  // ---------------------------------------------------------------- replications
  {
    id: 'replications-data-table-setup',
    topic: 'replications',
    question:
      'The sheet simulates one weekend of a Christmas pop-up stall, with the profit in H20. Set up 500 replications of the profit with a Data Table in K5:L505 (trial numbers in K6:K505, results in L6:L505).',
    layout: REP_LAYOUT,
    formulas: [
      { cell: 'K7 (fill to K7:K505)', formula: '=K6+1', note: 'K6 holds 1; trial numbers are only labels' },
      { cell: 'L5', formula: '=H20', note: 'link to the output, one row above the first trial and one column right' },
    ],
    tool: [
      'Type 1 in K6 and fill =K6+1 from K7 down to K505',
      'Put =H20 in L5',
      'Select K5:L505 (trial column plus the link column, including row 5)',
      'Data > What-If Analysis > Data Table',
      'Row input cell: (leave empty)',
      'Column input cell: $N$2 (a blank cell that no formula uses)',
      'OK: L6:L505 fills with 500 different profits',
    ],
    steps: [
      'Build ONE complete run of the model with RAND() inside, ending in one output cell.',
      'Trial numbers go down a column; the link to the output sits in the row above, one column to the right.',
      'Run Data Table with a BLANK column input cell: each row recalculates every RAND() and records the new output.',
      'If the sheet becomes slow: Formulas > Calculation Options > Automatic Except for Data Tables, then F9.',
    ],
    pitfalls: [
      'Using a model input (e.g. the price cell) as the column input cell overwrites it with 1, 2, 3, ... and ruins every result.',
      'The selection must include the trial column and the link row; selecting L5:L505 alone does not work.',
    ],
    answer: 'Report the method: 500 replications, Data Table on K5:L505, row input empty, column input N2, link L5 = H20. The values in L6:L505 change on every F9.',
  },
  {
    id: 'replications-average',
    topic: 'replications',
    question: 'From the 500 replicated profits, estimate the expected weekend profit in L2.',
    layout: REP_LAYOUT,
    formulas: [{ cell: 'L2', formula: '=AVERAGE(L6:L505)', note: 'table body only' }],
    steps: ['Average the 500 replicated values, not the link cell.', 'Place the summary outside the table block.', 'Quote it as an estimate with the number of replications.'],
    pitfalls: ['Including L5 (the current single run) in the average.', 'Averaging the trial-number column K gives 250.5, not a profit.'],
    answer: 'A value that moves slightly on every F9: report "about <value> from 500 replications". Keys accept a range around the true mean.',
  },
  {
    id: 'replications-probability',
    topic: 'replications',
    question:
      'The weekend model also counts customers turned away in H22. Record it in column M of the same Data Table (K5:M505), and in M2 estimate the probability that at least one customer is turned away in a weekend.',
    layout: `${REP_LAYOUT} Turned-away count for one run in H22; second link cell M5, replicated counts M6:M505.`,
    formulas: [
      { cell: 'M5', formula: '=H22', note: 'second output in the same table' },
      { cell: 'M2', formula: '=COUNTIF(M6:M505,">0")/COUNT(M6:M505)', note: 'share of replications with at least one turned away' },
    ],
    tool: [
      'Clear the old table body L6:L505 first (part of a Data Table cannot be changed)',
      'Select K5:M505',
      'Data > What-If Analysis > Data Table',
      'Row input cell: (empty)',
      'Column input cell: $N$2 (blank)',
    ],
    steps: [
      'Add the second output as another link cell in the link row.',
      'Probability = replications where the event happens / number of replications.',
      'COUNTIF with ">0" counts the replications with at least one turned away.',
    ],
    pitfalls: ['AVERAGE(M6:M505) is the expected NUMBER turned away, not the probability.', '">1" misses the replications with exactly 1; use ">0" or ">=1".'],
    answer: 'A share between 0 and 1 that moves slightly on F9; report it as a percentage with the number of replications.',
  },
  {
    id: 'replications-loss-share',
    topic: 'replications',
    question:
      'Using the 500 replicated profits, compute in L3 the probability of making a loss, and in L4 the probability that profit reaches at least the target in P3.',
    layout: `${REP_LAYOUT} Profit target in P3.`,
    formulas: [
      { cell: 'L3', formula: '=COUNTIF(L6:L505,"<0")/COUNT(L6:L505)', note: 'share of runs with a loss' },
      { cell: 'L4', formula: '=COUNTIF(L6:L505,">="&$P$3)/COUNT(L6:L505)', note: 'criterion joined to the cell with &' },
    ],
    steps: ['A loss is profit < 0.', 'Count the replications that meet the condition and divide by the number of replications.', 'Join a cell into the criterion with &: ">="&P3.'],
    pitfalls: ['">=P3" inside the quotes compares with the text P3.', '"<=0" would also count break-even runs as losses.'],
    answer: 'Two shares between 0 and 1 that move slightly on F9; quote them with the number of replications.',
  },
  {
    id: 'replications-two-way',
    topic: 'replications',
    question:
      'A bank-branch model (one simulated morning) reports the average wait in minutes in H8, using the number of tellers in G4. With ONE Data Table, replicate the morning 200 times for 2, 3, 4 and 5 tellers, and give the average wait for each teller count in L2:O2.',
    layout:
      'Number of tellers (a typed model input) in G4; average wait in minutes for one run in H8. Two-way Data Table K4:O204: corner K4, teller counts 2, 3, 4, 5 in L4:O4, trial numbers 1-200 in K5:K204, results L5:O204. Q1 is a blank cell. Averages go in L2:O2.',
    formulas: [
      { cell: 'K4', formula: '=H8', note: 'output in the top-left corner' },
      { cell: 'L2 (fill right to L2:O2)', formula: '=AVERAGE(L5:L204)', note: 'average wait for that teller count' },
    ],
    tool: [
      'Type 2, 3, 4, 5 in L4:O4 and trial numbers 1 to 200 in K5:K204',
      'Put =H8 in the corner K4',
      'Select K4:O204',
      'Data > What-If Analysis > Data Table',
      'Row input cell: $G$4 (the tellers cell: the values across the top go here)',
      'Column input cell: $Q$1 (a blank cell: the trial numbers go here)',
    ],
    steps: [
      'Parameter values across the top, trial numbers down the side, the output in the corner.',
      'Row input cell = the parameter cell, because the values in the top ROW are fed into it.',
      'Column input cell = a blank cell, because the trial numbers in the side COLUMN are only labels.',
      'Average each column and compare.',
    ],
    pitfalls: ['Swapping the two input cells feeds 1-200 into the tellers cell.', 'G4 must hold a typed value, not a formula.'],
    answer: 'Four averages that move slightly on F9; the wait should fall as tellers are added. Report the setup (K4:O204, row input G4, column input Q1, 200 replications) and the four averages.',
  },
  {
    id: 'replications-compare-policies',
    topic: 'replications',
    question:
      'A mini-mart model computes, from the SAME random demand, the weekly profit under ordering policy A in H20 and under policy B in H21. Replicate both 500 times in one Data Table (K5:N505). Give the average profit of each policy in L2 and M2, the average difference B - A in N2, and in N3 the share of weeks in which B earns more.',
    layout:
      'Profit under policy A in H20 and under policy B in H21 (one simulated week, same RAND() demand). Data Table K5:N505: trial numbers K6:K505, link cells L5, M5, N5, results L6:N505. P1 is a blank cell.',
    formulas: [
      { cell: 'L5', formula: '=H20' },
      { cell: 'M5', formula: '=H21' },
      { cell: 'N5', formula: '=H21-H20', note: 'difference B - A in the same run' },
      { cell: 'L2 (fill right to L2:N2)', formula: '=AVERAGE(L6:L505)' },
      { cell: 'N3', formula: '=COUNTIF(N6:N505,">0")/COUNT(N6:N505)', note: 'share of weeks where B beats A' },
    ],
    tool: ['Select K5:N505', 'Data > What-If Analysis > Data Table', 'Row input cell: (empty)', 'Column input cell: $P$1 (blank)'],
    steps: [
      'Compute both policies from the same random draws in each run, so the comparison is fair.',
      'Record both profits and their difference as three outputs of one table.',
      'Recommend the policy with the higher average; N3 shows how consistently it wins.',
      'If the average difference is small next to the run-to-run spread, call it inconclusive.',
    ],
    pitfalls: ['Comparing two separate F9 runs mixes the policy effect with random noise.'],
    answer: 'All values move on F9; recommend the policy with the higher average profit and quote N3 as the share of weeks it wins.',
  },
  {
    id: 'replications-spread',
    topic: 'replications',
    question:
      'For the 500 replicated profits, report in P6 the standard deviation, in P7 the range (largest minus smallest), in P8 the 5th percentile (the profit that 95% of weekends exceed), and in P9 the standard error of the average profit.',
    layout: REP_LAYOUT,
    formulas: [
      { cell: 'P6', formula: '=STDEV(L6:L505)' },
      { cell: 'P7', formula: '=MAX(L6:L505)-MIN(L6:L505)' },
      { cell: 'P8', formula: '=PERCENTILE(L6:L505,0.05)', note: '5% of runs fall below this' },
      { cell: 'P9', formula: '=STDEV(L6:L505)/SQRT(COUNT(L6:L505))', note: 'precision of the average' },
    ],
    steps: [
      'STDEV measures how much one weekend varies around the average.',
      'MAX - MIN is the full range seen in the replications.',
      'PERCENTILE(results, 0.05) is a bad-weekend level; 0.95 gives a good-weekend level.',
      'The standard error shrinks with more replications; the average is usually within 2-3 standard errors of the true mean.',
    ],
    pitfalls: ['Confusing the standard deviation (spread of one weekend) with the standard error (precision of the average).'],
    answer: 'All four move slightly on F9; quote them as estimates from 500 replications.',
  },
  {
    id: 'replications-output-not-inputs',
    topic: 'replications',
    question:
      'A newsstand stocks 100 copies of a magazine at $2 each and sells at $5; unsold copies are worthless. Demand is 0 or 200 copies, each with probability 0.5. A classmate averages simulated demand (about 100) and reports profit = 5 x MIN(100, 100) - 200 = $300. Build the one-run model in B8 and B10, replicate the profit 500 times, give the correct expected profit in H2 and explain the difference.',
    layout:
      'Stock 100 in B3, unit cost 2 in B4, price 5 in B5. Demand for one run in B8, profit for one run in B10. One-way Data Table G4:H504: trial numbers G5:G504, link H4, results H5:H504. J1 is a blank cell.',
    formulas: [
      { cell: 'B8', formula: '=IF(RAND()<0.5,0,200)', note: 'demand 0 or 200, each with probability 0.5' },
      { cell: 'B10', formula: '=$B$5*MIN(B8,$B$3)-$B$4*$B$3', note: 'non-linear because of MIN' },
      { cell: 'H4', formula: '=B10' },
      { cell: 'H2', formula: '=AVERAGE(H5:H504)', note: 'average of the replicated OUTPUT' },
    ],
    tool: ['Select G4:H504', 'Data > What-If Analysis > Data Table', 'Row input cell: (empty)', 'Column input cell: $J$1 (blank)'],
    steps: [
      'Replicate the output (profit) itself, then average it.',
      'Demand 0 gives 0 - 200 = -200; demand 200 gives 5 x 100 - 200 = 300.',
      'Expected profit = 0.5 x (-200) + 0.5 x 300 = 50.',
      'The average demand of 100 gives 300 because MIN cuts off the high demand while the low demand still costs the full stock.',
    ],
    pitfalls: [
      'f(average input) is not the average of f(input) when the model has MIN, MAX or IF.',
      'Replicating only the inputs and averaging them throws away the variation that drives the loss.',
    ],
    answer: 'H2 is about $50 (it moves around 50 on each F9); the classmate overstates the expected profit by about $250.',
  },

  // ---------------------------------------------------------------- flows
  {
    id: 'flows-binomial-trips',
    topic: 'flows',
    question:
      'For each route, C holds the number of commuters who might borrow an umbrella at the origin station and return it at the destination, and D the chance each one does. In E5, simulate the number of trips on the route, and fill down to E16. In E18, compute the expected total number of trips as a check.',
    layout: `${FL_LAYOUT} The check goes in E18.`,
    formulas: [
      { cell: 'E5 (fill to E5:E16)', formula: '=IF(C5>0,CRITBINOM(C5,D5,RAND()),0)', note: 'binomial trips, guarded for n = 0' },
      { cell: 'E18', formula: '=SUMPRODUCT(C5:C16,D5:D16)', note: 'expected trips = sum of n x p' },
    ],
    steps: [
      'Each commuter borrows or not with the same chance, so the trips on a route are binomial(n, p).',
      'CRITBINOM(n, p, RAND()) draws the count; n and p stay relative because each route has its own.',
      'Guard empty routes so they always give 0.',
      'The average of SUM(E5:E16) over replications should be close to E18.',
    ],
    pitfalls: ['Anchoring $D$5 when each route has its own probability.', 'ROUND(n x p) is the average, not a random count.'],
    answer: 'E5:E16 are whole numbers from 0 to n that change on F9. E18 is fixed; for example a route with n = 40 and p = 0.15 contributes 6 trips.',
  },
  {
    id: 'flows-departures',
    topic: 'flows',
    question: 'In J5, compute the number of umbrellas that leave station 1 (trips that start there), and fill down to J8 for stations 2-4.',
    layout: FL_LAYOUT,
    formulas: [
      { cell: 'J5 (fill to J5:J8)', formula: '=SUMIF($A$5:$A$16,H5,$E$5:$E$16)', note: 'trips whose ORIGIN is this station' },
      { cell: 'J5 (alternative)', formula: '=SUMPRODUCT(($A$5:$A$16=H5)*$E$5:$E$16)' },
    ],
    steps: [
      'Departures = trips whose origin is this station.',
      'SUMIF(origin column, station number, trips column).',
      'Anchor both ranges; leave the station cell H5 relative.',
    ],
    pitfalls: ['Using the destination column gives arrivals instead.', 'The criteria range and the sum range must cover the same rows (5-16).'],
    answer: 'Whole numbers that change on F9; the four departures add up to SUM(E5:E16).',
  },
  {
    id: 'flows-arrivals',
    topic: 'flows',
    question: 'In K5, compute the number of umbrellas returned to each station (trips that end there), and fill down to K8. In K10, check that total departures equal total arrivals.',
    layout: `${FL_LAYOUT} The check goes in K10.`,
    formulas: [
      { cell: 'K5 (fill to K5:K8)', formula: '=SUMIF($B$5:$B$16,H5,$E$5:$E$16)', note: 'trips whose DESTINATION is this station' },
      { cell: 'K10', formula: '=SUM(J5:J8)-SUM(K5:K8)', note: 'must be 0: every trip departs once and arrives once' },
    ],
    steps: ['Arrivals = trips whose destination is this station.', 'Same SUMIF, with the destination column as the criteria range.', 'The totals must match.'],
    pitfalls: ['Swapping origin and destination flips departures and arrivals but the totals still match, so K10 will not catch it: check one station by hand.'],
    answer: 'Whole numbers that change on F9; K10 is always 0.',
  },
  {
    id: 'flows-end-stock-surplus',
    topic: 'flows',
    question:
      'In L5, compute the end-of-day stock at each station; in M5, the surplus above the target stock that must be trucked back; fill both down to row 8. In M10, compute the day rebalancing cost.',
    layout: `${FL_LAYOUT} The rebalancing cost goes in M10.`,
    formulas: [
      { cell: 'L5 (fill to L5:L8)', formula: '=I5-J5+K5', note: 'start - departures + arrivals' },
      { cell: 'M5 (fill to M5:M8)', formula: '=MAX(0,L5-$P$2)', note: 'only the excess above target' },
      { cell: 'M10', formula: '=SUM(M5:M8)*$P$3', note: 'surplus umbrellas x cost per umbrella' },
    ],
    steps: [
      'End stock = start - departures + arrivals.',
      'Surplus = MAX(0, end - target); a station below target has no surplus (its shortage would be MAX(0, target - end)).',
      'Cost = total surplus x cost per umbrella moved.',
    ],
    pitfalls: [
      'L5-$P$2 without MAX gives negative surpluses that reduce the cost.',
      'The cost is non-linear in the stocks: replicate the cost or profit itself, never plug average stocks into MAX.',
    ],
    answer: 'Example: I5 = 30, J5 = 12, K5 = 18 gives L5 = 36 and M5 = 36 - 30 = 6; at $1.50 each that station adds $9 to M10. Simulated values change on F9.',
  },
  {
    id: 'flows-fare-revenue',
    topic: 'flows',
    question:
      'The rental fare depends on the route and is given in a 4 x 4 fare matrix. In F5, look up the fare for each route and fill down to F16. In F18, compute the total rental revenue, and in F19 the profit after the rebalancing cost.',
    layout: `${FL_LAYOUT} The rebalancing cost for the day is in M10.`,
    formulas: [
      { cell: 'F5 (fill to F5:F16)', formula: '=INDEX($P$5:$S$8,A5,B5)', note: 'row = origin number, column = destination number' },
      { cell: 'F18', formula: '=SUMPRODUCT(E5:E16,F5:F16)', note: 'trips x fare, summed' },
      { cell: 'F19', formula: '=F18-M10' },
    ],
    steps: [
      'INDEX(matrix, row number, column number) picks one fare.',
      'The station numbers 1-4 are exactly the row and column positions in the matrix.',
      'Revenue = sum of trips x fare over all routes.',
      'Replicate F19 with a Data Table for the expected profit.',
    ],
    pitfalls: ['INDEX($P$5:$S$8,B5,A5) reads the reverse route (wrong when the matrix is not symmetric).', 'Station names (text) cannot be INDEX positions; use the numbers.'],
    answer: 'F5:F16 are fixed fares; F18 and F19 change on F9. Report the expected profit as the average of a Data Table of F19.',
  },

  // ---------------------------------------------------------------- single-server
  {
    id: 'single-server-arrival-chain',
    topic: 'single-server',
    question:
      'A neighbourhood pharmacy has one pharmacist. In E15, compute the arrival clock time of customer 1 from the gap in C15, then fill down to E64 so that each customer arrives one gap after the previous one.',
    layout: SS_LAYOUT,
    formulas: [{ cell: 'E15 (fill to E15:E64)', formula: '=E14+C15', note: 'previous arrival + this gap' }],
    steps: [
      'Row 14 is customer 0: E14 = G14 = opening time, so customer 1 arrives one gap after opening.',
      'Each arrival = previous arrival (relative E14) + own gap.',
      'Format column E as a clock time (h:mm:ss).',
    ],
    pitfalls: [
      '=$E$14+C15 measures every gap from the opening time, so customers never spread out.',
      'Gaps in minutes (plain numbers) must be divided by 1440 before adding them to a clock time.',
    ],
    answer: 'Rising clock times that change on F9. Example: gaps of 0:03:30 and 0:02:00 give arrivals 09:03:30 and 09:05:30.',
  },
  {
    id: 'single-server-first-row-opening',
    topic: 'single-server',
    question:
      'In a sheet with NO customer-0 row, the opening time 10:00 is in B3 and customer 1 is in row 15 (row 14 holds headers). Give the arrival, service start and service end of customer 1 in E15:G15, then the row-16 formulas in E16:G16 that fill down to row 64.',
    layout:
      'Opening time 10:00 in B3; row 14 holds column headers. Customers 1-50 in rows 15-64: gaps C15:C64, service times D15:D64 (Excel times), arrivals E15:E64, service starts F15:F64, service ends G15:G64.',
    formulas: [
      { cell: 'E15', formula: '=$B$3+C15', note: 'first arrival = opening time + first gap' },
      { cell: 'F15', formula: '=E15', note: 'the server is free, so customer 1 starts on arrival' },
      { cell: 'G15', formula: '=F15+D15' },
      { cell: 'E16 (fill to E16:E64)', formula: '=E15+C16' },
      { cell: 'F16 (fill to F16:F64)', formula: '=MAX(E16,G15)' },
      { cell: 'G16 (fill to G16:G64)', formula: '=F16+D16' },
    ],
    steps: [
      'The first row is special: it starts from the opening time and nobody is ahead of customer 1.',
      'From row 16 the general formulas read the row above.',
      'Alternatively add a customer-0 row (end = opening time) so one formula fills the whole column.',
    ],
    pitfalls: [
      'Filling the general formula into row 15 makes it read the header row: =E14+C15 returns #VALUE! on header text.',
      'If customer 1 arrives exactly at opening, E15 = $B$3 with no gap.',
    ],
    answer: 'Example: B3 = 10:00, C15 = 0:04:00, D15 = 0:06:00 gives E15 = 10:04, F15 = 10:04, G15 = 10:10.',
  },
  {
    id: 'single-server-start',
    topic: 'single-server',
    question:
      'In F15, compute when the pharmacist starts serving customer 1, and fill down to F64. Service starts once the customer has arrived and the previous customer has finished.',
    layout: SS_LAYOUT,
    formulas: [{ cell: 'F15 (fill to F15:F64)', formula: '=MAX(E15,G14)', note: 'later of own arrival and previous end' }],
    steps: [
      'Service cannot start before the customer arrives (E15).',
      'Nor before the previous customer leaves (G14, the end time one row up).',
      'The later of the two is the MAX; G14 = opening time handles customer 1.',
    ],
    pitfalls: [
      '=MAX(E15,F14) uses the previous START and ignores how long that service took.',
      '=E15 alone ignores the queue: every wait becomes 0.',
      'MIN instead of MAX lets service start before the customer arrives.',
    ],
    answer: 'Example: arrival 09:05:30 while the previous customer ends at 09:08:00 gives a start of 09:08:00.',
  },
  {
    id: 'single-server-end',
    topic: 'single-server',
    question: 'In G15, compute when service ends for each customer, and fill down to G64.',
    layout: SS_LAYOUT,
    formulas: [{ cell: 'G15 (fill to G15:G64)', formula: '=F15+D15', note: 'start + service duration' }],
    steps: ['End = service start + service time.', 'Clock time + duration = a later clock time.'],
    pitfalls: ['=E15+D15 (arrival + service) forgets the wait, so the queue never builds.'],
    answer: 'Example: start 09:08:00 with a service time of 0:04:15 ends at 09:12:15.',
  },
  {
    id: 'single-server-wait',
    topic: 'single-server',
    question: 'In H15, compute how long each customer waits before service starts, and fill down to H64.',
    layout: SS_LAYOUT,
    formulas: [{ cell: 'H15 (fill to H15:H64)', formula: '=F15-E15', note: 'start - arrival' }],
    steps: ['Wait = service start - arrival.', 'It is 0 when the server is free on arrival.', 'Format as mm:ss, or [h]:mm:ss if a wait can exceed an hour.'],
    pitfalls: ['=G15-E15 is the time in system (wait + service), not the wait.', 'mm:ss hides whole hours: a 65-minute wait shows as 05:00.'],
    answer: 'Example: arrival 09:05:30 and start 09:08:00 give a wait of 00:02:30.',
  },
  {
    id: 'single-server-system-time',
    topic: 'single-server',
    question: 'In I15, compute the time each customer spends in the system (from arrival until service ends), and fill down to I64.',
    layout: SS_LAYOUT,
    formulas: [
      { cell: 'I15 (fill to I15:I64)', formula: '=G15-E15', note: 'end - arrival' },
      { cell: 'I15 (alternative)', formula: '=H15+D15', note: 'wait + service' },
    ],
    steps: ['Time in system = service end - arrival.', 'It always equals wait + service time, which is a useful check.'],
    pitfalls: ['=G15-F15 is just the service time.'],
    answer: 'Example: arrival 09:05:30 and end 09:12:15 give 00:06:45 (= 2:30 wait + 4:15 service).',
  },
  {
    id: 'single-server-idle',
    topic: 'single-server',
    question:
      'In K15, compute how long the pharmacist is idle just before serving each customer, and fill down to K64. In K66, compute the total idle time in minutes.',
    layout: `${SS_LAYOUT} Idle times go in K15:K64 and the total in K66.`,
    formulas: [
      { cell: 'K15 (fill to K15:K64)', formula: '=F15-G14', note: 'previous end to this start' },
      { cell: 'K66', formula: '=SUM(K15:K64)*1440', note: 'total idle minutes' },
    ],
    steps: [
      'The server is free from the previous end time (G14 for customer 1 = the opening time).',
      'Idle = this start - previous end; it is 0 whenever the customer had to wait.',
      'Multiply a total time by 1440 to report minutes.',
    ],
    pitfalls: [
      '=E15-G14 (arrival - previous end) turns negative whenever a queue exists.',
      'Check: total idle + total service = last end - opening time.',
    ],
    answer: 'Changes on F9. Check: SUM(K15:K64) + SUM(D15:D64) = G64 - G14.',
  },
  {
    id: 'single-server-wait-minutes',
    topic: 'single-server',
    question: 'The mark scheme wants waits as plain numbers of minutes. In L15, convert the wait in H15 to minutes rounded to 2 decimals, and fill down to L64.',
    layout: `${SS_LAYOUT} Waits in minutes go in L15:L64.`,
    formulas: [
      { cell: 'L15 (fill to L15:L64)', formula: '=ROUND(H15*1440,2)', note: 'a day has 1440 minutes' },
      { cell: 'L15 (alternative)', formula: '=HOUR(H15)*60+MINUTE(H15)+SECOND(H15)/60', note: 'from the time parts, to the nearest second' },
    ],
    steps: [
      'A time value is a fraction of a day; x1440 gives minutes (x24 hours, x86400 seconds).',
      'Format the result as Number or General, not as a time.',
      'Round only if the question asks for it.',
    ],
    pitfalls: ['Formatting H15 as mm only changes the display; the cell still holds a day fraction.', 'MINUTE(H15) alone drops whole hours and the seconds.'],
    answer: 'Example: a wait of 0:02:30 is stored as about 0.001736 and converts to 2.5 minutes.',
  },
  {
    id: 'single-server-overtime',
    topic: 'single-server',
    question:
      'The pharmacy closes at 13:00 but finishes serving everyone in the sheet (all 50 arrive before closing). In K3, find when the pharmacist finishes the last customer; in K4, the overtime in minutes after closing (0 if none).',
    layout: `${SS_LAYOUT} Closing time 13:00 in B5.`,
    formulas: [
      { cell: 'K3', formula: '=MAX(G15:G64)', note: 'last service end' },
      { cell: 'K4', formula: '=MAX(0,K3-$B$5)*1440', note: 'minutes past closing, never negative' },
      { cell: 'K4 (alternative)', formula: '=MAX(0,K3-TIME(13,0,0))*1440', note: 'closing time built with TIME' },
    ],
    steps: [
      'The last end time is the largest end time: MAX of the column.',
      'Overtime = MAX(0, last end - closing) so an early finish gives 0, not a negative.',
      'x1440 reports minutes.',
    ],
    pitfalls: ['Typing 13 for the closing time means 13 days; use 13:00 in a cell or TIME(13,0,0).'],
    answer: 'Example: a last end of 13:17:30 gives K4 = 17.5 minutes. Simulated values change on F9.',
  },

  // ---------------------------------------------------------------- multi-server
  {
    id: 'multi-server-number-in-system',
    topic: 'multi-server',
    question:
      'A hospital outpatient pharmacy has c dispensing counters fed by one queue. In J15, count how many earlier patients are still in the system (waiting or being served) when patient 1 arrives, and fill down to J64.',
    layout: MS_LAYOUT,
    formulas: [{ cell: 'J15 (fill to J15:J64)', formula: '=COUNTIF($G$14:G14,">"&E15)', note: 'earlier end times later than this arrival' }],
    steps: [
      'An earlier patient is still in the system if the service end is after this arrival.',
      'COUNTIF over the earlier end times with the criterion ">"&E15.',
      'The range $G$14:G14 grows by one row as you fill down: anchored top, relative bottom.',
    ],
    pitfalls: [
      '">E15" inside the quotes compares with the text E15; join the cell with &.',
      '$G$14:$G$14 (fully anchored) only ever looks at customer 0.',
      'Including the own row (G15) is circular, because G15 depends on the start.',
    ],
    answer: 'Whole numbers 0, 1, 2, ... that change on F9; a value of at least c means the patient has to wait.',
  },
  {
    id: 'multi-server-start-c',
    topic: 'multi-server',
    question:
      'With c counters (G4) sharing one queue, compute in F15 when patient 1 starts service and fill down to F64. Then give the end time in G15 and the wait in H15, both filled down to row 64.',
    layout: MS_LAYOUT,
    formulas: [
      { cell: 'F15 (fill to F15:F64)', formula: '=IF(J15<$G$4,E15,LARGE($G$14:G14,$G$4))', note: 'course form' },
      { cell: 'G15 (fill to G15:G64)', formula: '=F15+D15' },
      { cell: 'H15 (fill to H15:H64)', formula: '=F15-E15' },
    ],
    steps: [
      'Fewer than c patients in the system means a counter is free: start on arrival.',
      'Otherwise start when the first counter frees up: the c-th largest end time among the earlier patients.',
      'Anchor G4 and the top of the expanding range; keep E15, J15 and the bottom of the range relative.',
    ],
    pitfalls: [
      '=MAX(E15,LARGE($G$14:G14,$G$4)) returns #NUM! for the first patients (fewer than c end times exist) and the error spreads down.',
      'LARGE(..., 1) is the LAST counter to free up, not the first.',
      '=MAX(E15,G14) treats the pharmacy as a single server.',
    ],
    answer: 'Clock times that change on F9; with more counters, more rows have F = E (no wait).',
  },
  {
    id: 'multi-server-next-free-logic',
    topic: 'multi-server',
    question:
      'Explain why the c-th largest earlier end time is when the next counter frees up, using these numbers: c = 3; the earlier patients end at 09:00 (customer 0), 09:58, 10:01, 10:04, 10:09 and 10:06; the next patient arrives at 10:02 in E20. Give J20 and F20, and say what changes if the arrival is 10:05.',
    layout:
      'Counters c = 3 in G4. End times of the earlier patients in G14:G19: 09:00 (customer 0, the opening time), 09:58, 10:01, 10:04, 10:09, 10:06. The next patient arrives at 10:02 in E20; J20 is the number in system and F20 the start.',
    formulas: [
      { cell: 'J20', formula: '=COUNTIF($G$14:G19,">"&E20)' },
      { cell: 'F20', formula: '=IF(J20<$G$4,E20,LARGE($G$14:G19,$G$4))' },
    ],
    steps: [
      'Patients start in arrival order, so the c largest end times so far belong to the patient currently (or last) at each counter.',
      'The smallest of those c values, the c-th largest overall, is when the first counter frees up.',
      'Here the three latest ends are 10:09, 10:06 and 10:04, so the next free counter opens at 10:04.',
      'If fewer than c earlier patients are still in the system, a counter is already idle and service starts on arrival.',
    ],
    pitfalls: [
      'MIN of all earlier ends (09:00) picks a counter that has long since served someone else.',
      'The c-th largest is the SMALLEST of the c latest ends, not the largest.',
    ],
    answer: 'J20 = 3 (10:04, 10:09 and 10:06 are after 10:02), so F20 = 3rd largest = 10:04 and the wait is 2 minutes. If the arrival is 10:05, J20 = 2 < 3, so service starts at 10:05 at the counter freed at 10:04.',
  },
  {
    id: 'multi-server-utilisation',
    topic: 'multi-server',
    question:
      'In D8, compute the utilisation of the c counters: total service time divided by the counter time available from opening until the last patient leaves. Put the last service end in G8.',
    layout: `${MS_LAYOUT} The last end goes in G8 and the utilisation in D8.`,
    formulas: [
      { cell: 'G8', formula: '=MAX(G14:G64)', note: 'last service end' },
      { cell: 'D8', formula: '=SUM(D15:D64)/($G$4*(G8-G14))', note: 'busy time / (c x elapsed time)' },
    ],
    steps: ['Busy time = sum of all service times.', 'Available time = c counters x (last end - opening time).', 'The ratio lies between 0 and 1; format as %.'],
    pitfalls: [
      'Forgetting the x c gives values above 100% with several counters.',
      'With several counters the last ROW need not hold the last end time: use MAX.',
    ],
    answer: 'Changes on F9. Example: 6 hours of service in total with c = 2 from 09:00 to 13:00 gives 6/(2 x 4) = 0.75 (75%).',
  },
  {
    id: 'multi-server-traffic-intensity',
    topic: 'multi-server',
    question:
      'Before simulating, compute in C8 the traffic intensity from the mean service time (D4), the mean inter-arrival time (C4) and c counters (G4). What does a value above 1 mean?',
    layout: 'Mean inter-arrival time in C4 and mean service time in D4 (both Excel times, or both minutes); counters c in G4. The result goes in C8.',
    formulas: [{ cell: 'C8', formula: '=($D$4/$G$4)/$C$4', note: 'course form: (mean service / c) / mean gap' }],
    steps: [
      'c counters share the work: the effective service time per patient is mean service / c.',
      'Intensity = (service / c) / gap, i.e. arrival rate / total service rate.',
      'Above 1, patients arrive faster than the counters can serve, so the queue keeps growing.',
    ],
    pitfalls: ['Gap / service (upside down) looks fine when the system is actually overloaded.', 'C4 and D4 must be in the same units.'],
    answer: 'Example: mean service 9 minutes, mean gap 4 minutes, c = 2 gives (9/2)/4 = 1.125 (queue builds); with c = 3 it is (9/3)/4 = 0.75.',
  },
  {
    id: 'multi-server-first-row',
    topic: 'multi-server',
    question:
      'Explain why the model uses a customer-0 row (G14 = opening time, E14 = G14). Then give the row-15 and row-16 formulas for a sheet WITHOUT it, where patient 1 is in row 15 and the arrivals already chain from the opening time.',
    layout:
      'Counters c in G4. No customer-0 row: patients 1-50 in rows 15-64 with gaps C15:C64, service times D15:D64, arrivals E15:E64, starts F15:F64, ends G15:G64, number in system J15:J64.',
    formulas: [
      { cell: 'J15', formula: '=0', note: 'nobody is ahead of patient 1 (or type 0)' },
      { cell: 'F15', formula: '=E15' },
      { cell: 'J16 (fill to J16:J64)', formula: '=COUNTIF($G$15:G15,">"&E16)' },
      { cell: 'F16 (fill to F16:F64)', formula: '=IF(J16<$G$4,E16,LARGE($G$15:G15,$G$4))' },
    ],
    steps: [
      'With a customer-0 row every real patient has at least one earlier end time, so one formula fills from row 15.',
      'Customer 0 ends at the opening time, so it never counts as in the system once the pharmacy is open.',
      'Without it, patient 1 has no earlier rows: J15 = 0 and F15 = E15 by hand; from row 16 the ranges start at $G$15.',
    ],
    pitfalls: ['Filling the row-15 formulas down instead of the row-16 ones gives every patient F = E (no queue).'],
    answer: 'Same results as the customer-0 version; patient 1 always starts on arrival.',
  },

  // ---------------------------------------------------------------- queue-measures
  {
    id: 'queue-measures-avg-wait',
    topic: 'queue-measures',
    question: 'In H8, compute the average wait in minutes over the 50 groups; in I8, the average time in system in minutes.',
    layout: QM_LAYOUT,
    formulas: [
      { cell: 'H8', formula: '=AVERAGE(H15:H64)*1440', note: 'day fraction to minutes' },
      { cell: 'I8', formula: '=AVERAGE(I15:I64)*1440' },
    ],
    steps: ['AVERAGE of a time column gives a day fraction.', 'x1440 turns it into minutes.', 'If the question wants a time instead, leave out x1440 and format [h]:mm:ss.'],
    pitfalls: ['Reporting the raw day fraction: 0.004167 is 6 minutes, not 0.004 minutes.', 'mm:ss formatting hides whole hours for long averages.'],
    answer: 'Changes on F9; quote it in minutes.',
  },
  {
    id: 'queue-measures-share-within',
    topic: 'queue-measures',
    question: 'In H9, compute the proportion of groups that waited at most the threshold in B6 (minutes).',
    layout: QM_LAYOUT,
    formulas: [
      { cell: 'H9', formula: '=COUNTIF(H15:H64,"<="&$B$6/1440)/COUNT(H15:H64)', note: 'threshold converted to a time' },
      { cell: 'H9 (typed 5 minutes)', formula: '=COUNTIF(H15:H64,"<="&5/1440)/COUNT(H15:H64)' },
    ],
    steps: ['Turn the threshold into a time: minutes/1440.', 'Build the criterion with "<="&value.', 'Divide by the number of groups (COUNT).'],
    pitfalls: [
      '"<=5" compares the waits with 5 DAYS: every group passes and the answer is 100%.',
      '"at most" is <=, "less than" is <.',
      'If the waits are already in minutes, drop the /1440.',
    ],
    answer: 'A proportion between 0 and 1 that changes on F9; format as %.',
  },
  {
    id: 'queue-measures-share-more-than',
    topic: 'queue-measures',
    question: 'In H10, compute the proportion of groups that waited MORE than the threshold in B7 (10 minutes).',
    layout: QM_LAYOUT,
    formulas: [
      { cell: 'H10', formula: '=COUNTIF(H15:H64,">"&$B$7/1440)/COUNT(H15:H64)' },
      { cell: 'H10 (alternative)', formula: '=1-COUNTIF(H15:H64,"<="&$B$7/1440)/COUNT(H15:H64)', note: '1 - share within' },
    ],
    steps: ['Same pattern as the share within, with ">".', '"More than" and "at most" are complements: they add up to 1.'],
    pitfalls: ['">=" would include groups that waited exactly 10 minutes.'],
    answer: 'A proportion that changes on F9; it equals 1 minus the share waiting at most 10 minutes.',
  },
  {
    id: 'queue-measures-weighted-wait',
    topic: 'queue-measures',
    question: 'Everyone in a group waits the same time. In H11, compute the average wait PER PERSON in minutes, using the group sizes in B15:B64.',
    layout: QM_LAYOUT,
    formulas: [{ cell: 'H11', formula: '=SUMPRODUCT(H15:H64,B15:B64)/SUM(B15:B64)*1440', note: 'person-waiting time / persons' }],
    steps: ['Total waiting by people = sum of (group wait x group size): SUMPRODUCT.', 'Divide by the total number of people.', 'x1440 for minutes.'],
    pitfalls: ['AVERAGE(H15:H64) is the wait per GROUP and under-weights the big groups.'],
    answer: 'Example: groups of 1, 3 and 2 waiting 2, 4 and 0 minutes give (2 + 12 + 0)/6 = 2.33 minutes per person, while the plain average is 2.',
  },
  {
    id: 'queue-measures-weighted-share',
    topic: 'queue-measures',
    question: 'In H12, compute the proportion of PEOPLE (not groups) who waited at most the threshold in B6.',
    layout: QM_LAYOUT,
    formulas: [{ cell: 'H12', formula: '=SUMIF(H15:H64,"<="&$B$6/1440,B15:B64)/SUM(B15:B64)', note: 'people in qualifying groups / all people' }],
    steps: ['SUMIF adds the sizes of the groups whose wait meets the criterion.', 'Divide by the total number of people.'],
    pitfalls: ['COUNTIF counts groups, not people.'],
    answer: 'Example: groups of 1, 3 and 2 waiting 2, 6 and 0 minutes: 1 + 2 = 3 of the 6 people waited at most 5 minutes, so 50% (COUNTIF would say 2 of 3 groups, 67%).',
  },
  {
    id: 'queue-measures-utilisation',
    topic: 'queue-measures',
    question: 'In D8, compute the utilisation of the single counter: the share of time from opening until the last group leaves during which it was busy.',
    layout: `${QM_LAYOUT} Idle times before each group, if computed, are in K15:K64.`,
    formulas: [
      { cell: 'D8', formula: '=SUM(D15:D64)/(MAX(G15:G64)-G14)', note: 'busy time / elapsed time' },
      { cell: 'D8 (alternative)', formula: '=1-SUM(K15:K64)/(MAX(G15:G64)-G14)', note: '1 - idle share' },
    ],
    steps: ['Busy time = total service time.', 'Elapsed time = last end - opening time.', 'Utilisation = busy / elapsed; idle share = 1 - utilisation.'],
    pitfalls: ['Dividing by the number of groups instead of the elapsed time.', 'A value above 100% means something is double counted.'],
    answer: 'Changes on F9. Example: 3 hours of service between 09:00 and 13:00 gives 3/4 = 0.75.',
  },
  {
    id: 'queue-measures-longest-wait',
    topic: 'queue-measures',
    question: 'In M3, report the longest wait in minutes; in M4, the number of the group that waited longest.',
    layout: QM_LAYOUT,
    formulas: [
      { cell: 'M3', formula: '=MAX(H15:H64)*1440' },
      { cell: 'M4', formula: '=INDEX(A15:A64,MATCH(MAX(H15:H64),H15:H64,0))', note: 'position of the largest wait' },
    ],
    steps: ['MAX gives the longest wait; x1440 for minutes.', 'MATCH(max, waits, 0) finds its position; INDEX returns the group number there.'],
    pitfalls: ['MATCH needs 0 (exact match): the waits are not sorted.'],
    answer: 'Changes on F9; if two groups tie, MATCH returns the first.',
  },
  {
    id: 'queue-measures-number-waited',
    topic: 'queue-measures',
    question: 'In M5, count the groups that had to wait at all; in M6, the proportion that waited; in M7, the average wait in minutes of only those that waited.',
    layout: `${QM_LAYOUT} Groups served on arrival have a wait of exactly 0.`,
    formulas: [
      { cell: 'M5', formula: '=COUNTIF(H15:H64,">0")' },
      { cell: 'M6', formula: '=COUNTIF(H15:H64,">0")/COUNT(H15:H64)' },
      { cell: 'M7', formula: '=SUM(H15:H64)/COUNTIF(H15:H64,">0")*1440', note: 'total wait / number who waited' },
    ],
    steps: ['A group waited if its wait is greater than 0.', 'Divide by COUNT for the proportion.', 'Zero waits add nothing to the sum, so total wait / number who waited is their average.'],
    pitfalls: ['AVERAGE(H15:H64) includes the zero waits and is lower.', 'If nobody waited, M7 gives #DIV/0!; guard with IF(M5=0,0,...).'],
    answer: 'All three change on F9.',
  },
  {
    id: 'queue-measures-avg-number-in-system',
    topic: 'queue-measures',
    question: 'Using the course formula, compute in J8 the time-average number of groups in the system between opening and the last arrival. Put the last arrival in E8.',
    layout: `${QM_LAYOUT} J15:J64 counts the earlier groups still in the system when each group arrives (not counting itself). The last arrival goes in E8.`,
    formulas: [
      { cell: 'E8', formula: '=MAX(E14:E64)', note: 'last arrival' },
      { cell: 'J8', formula: '=SUMPRODUCT(((J15:J63+1)+J16:J64)/2,C16:C64)/(E8-E14)', note: 'area under the number-in-system curve / elapsed time' },
    ],
    steps: [
      'Just after group k arrives there are J(k) + 1 groups in the system; just before group k+1 arrives there are J(k+1).',
      'Over the gap C(k+1) the course uses the average of the two (a trapezoid).',
      'Add the trapezoid areas with SUMPRODUCT and divide by the time from opening (E14) to the last arrival (E8).',
      'Enter it normally: SUMPRODUCT handles the arrays (the course file shows it with braces).',
    ],
    pitfalls: [
      'The ranges are offset by one row: J15:J63 with J16:J64 and C16:C64, all 49 cells.',
      'Numerator and denominator are both in days, so there is no x1440: the result is a count.',
    ],
    answer: 'A plain number of groups (format as Number, not time) that changes on F9.',
  },
  {
    id: 'queue-measures-arrivals-before-closing',
    topic: 'queue-measures',
    question: 'The counter stops taking new groups at 12:00. In M8, count the simulated groups that arrive before 12:00; in M9, the average wait in minutes of those groups only.',
    layout: QM_LAYOUT,
    formulas: [
      { cell: 'M8', formula: '=COUNTIF(E15:E64,"<"&TIME(12,0,0))' },
      { cell: 'M9', formula: '=SUMIF(E15:E64,"<"&TIME(12,0,0),H15:H64)/M8*1440', note: 'total wait of early arrivals / their number' },
    ],
    steps: [
      'TIME(12,0,0) builds 12:00 as a day fraction (0.5).',
      'Join it to the operator with & inside COUNTIF and SUMIF.',
      'SUMIF adds the waits of the rows whose ARRIVAL meets the criterion.',
    ],
    pitfalls: ['"<12" compares with 12 DAYS, so every arrival passes; use TIME(12,0,0) or a cell holding 12:00.'],
    answer: 'Both change on F9. TIME(12,0,0) = 0.5.',
  },

  // ---------------------------------------------------------------- balk-renege
  {
    id: 'balk-renege-system-length',
    topic: 'balk-renege',
    question: 'In L15, compute the system length (earlier cars still in the system) when car 1 arrives, and fill down to L64.',
    layout: BR_LAYOUT,
    formulas: [{ cell: 'L15 (fill to L15:L64)', formula: '=COUNTIF($I$14:I14,">"&E15)', note: 'earlier end times after this arrival' }],
    steps: [
      'Count the earlier end times that are later than this arrival.',
      'Balkers hold "" in I; COUNTIF with a numeric criterion skips text, so they are not counted.',
      'The range grows as you fill down: $I$14:I14.',
    ],
    pitfalls: ['The end-time column must treat renegers correctly (see the end-time part), or L is inflated and too many cars balk.'],
    answer: 'Whole numbers that change on F9.',
  },
  {
    id: 'balk-renege-potential-start',
    topic: 'balk-renege',
    question:
      'A driver balks (drives off at once) if MORE than F4 cars are already in the system. In F15, return "" for a balking driver; otherwise the time washing would start with I4 bays. Fill down to F64.',
    layout: BR_LAYOUT,
    formulas: [{ cell: 'F15 (fill to F15:F64)', formula: '=IF(L15>F$4,"",IF(L15>=I$4,LARGE(I$14:I14,I$4),$E15))', note: 'course form' }],
    steps: [
      'Test the balk rule first: L15 > F4 means the driver leaves, so "".',
      'Otherwise the c-bay rule: start on arrival if L15 < c, else at the c-th largest earlier end time.',
      'This is a POTENTIAL start: the driver may still renege.',
    ],
    pitfalls: [
      '"more than 6" is L15>6; "6 or more" would be L15>=6. Read the wording.',
      'Returning 0 instead of "" for balkers makes COUNT treat them as cars that joined.',
    ],
    answer: 'Clock times or blanks that change on F9.',
  },
  {
    id: 'balk-renege-actual-start',
    topic: 'balk-renege',
    question:
      'A driver who joins leaves (reneges) if the potential wait exceeds the limit in G4. In G15, compute the potential wait; in H15, the actual start ("" for balkers and renegers). Fill both down to row 64.',
    layout: BR_LAYOUT,
    formulas: [
      { cell: 'G15 (fill to G15:G64)', formula: '=IF(F15="","",F15-E15)', note: 'potential wait' },
      { cell: 'H15 (fill to H15:H64)', formula: '=IF(F15="","",IF(G15>$G$4,"",F15))', note: 'blank if balked or reneged' },
    ],
    steps: [
      'Potential wait = potential start - arrival; blank for balkers.',
      'If the potential wait exceeds the limit, the driver leaves before washing: no actual start.',
      'Otherwise the actual start equals the potential start.',
    ],
    pitfalls: [
      'If the limit is typed as 20 (minutes) instead of 0:20, compare with $G$4/1440.',
      'Test F15="" first: on a "" cell, G15>$G$4 is TRUE because text compares greater than any number.',
    ],
    answer: 'Times or blanks that change on F9.',
  },
  {
    id: 'balk-renege-end-time',
    topic: 'balk-renege',
    question:
      'In I15, compute when each car leaves the system: washed cars at actual start + wash time, renegers when their patience runs out (arrival + G4), balkers "". Fill down to I64. Then give the wait in J15 and the time in system in K15 (renegers count the full limit), both filled down.',
    layout: BR_LAYOUT,
    formulas: [
      { cell: 'I15 (fill to I15:I64)', formula: '=IF(F15="","",IF(G15>$G$4,E15+$G$4,H15+D15))', note: 'course BR-M version' },
      { cell: 'J15 (fill to J15:J64)', formula: '=IF(F15="","",IF(H15="",$G$4,H15-E15))' },
      { cell: 'K15 (fill to K15:K64)', formula: '=IF(F15="","",IF(H15="",$G$4,I15-E15))' },
    ],
    steps: [
      'Balkers never join: "".',
      'Renegers stay in the queue for exactly the renege limit, so they still count in later system lengths for that time.',
      'Washed cars end at actual start + wash time.',
    ],
    pitfalls: [
      '=IF(F15="","",F15+D15) gives renegers a full wash end time, inflating later system lengths so too many cars balk.',
      '=IF(H15="","",H15+D15) drops renegers from the count altogether, so too few balk.',
    ],
    answer: 'Times or blanks that change on F9.',
  },
  {
    id: 'balk-renege-proportions',
    topic: 'balk-renege',
    question: 'In F8, compute the proportion of arriving cars that balked; in G8, the proportion of cars that joined but reneged.',
    layout: `${BR_LAYOUT} Results in F8 and G8.`,
    formulas: [
      { cell: 'F8', formula: '=(COUNT(E15:E64)-COUNT(F15:F64))/COUNT(E15:E64)', note: '(arrivals - joined) / arrivals' },
      { cell: 'G8', formula: '=(COUNT(F15:F64)-COUNT(H15:H64))/COUNT(F15:F64)', note: '(joined - washed) / joined' },
    ],
    steps: [
      'COUNT counts numbers only, so "" cells are skipped.',
      'Balked = arrivals - joined (potential starts); divide by arrivals.',
      'Reneged = joined - washed (actual starts); divide by those who JOINED.',
    ],
    pitfalls: ['Dividing the reneges by all arrivals understates the renege proportion.', 'COUNTA counts "" cells as filled.'],
    answer: 'Example: 50 arrivals, 44 joined and 38 washed give F8 = 6/50 = 0.12 and G8 = 6/44 = 0.136. Simulated values change on F9.',
  },
  {
    id: 'balk-renege-lost-revenue',
    topic: 'balk-renege',
    question: 'Each car washed pays the fee in B5. In M8, compute the number of cars lost (balked or reneged); in M9, the fees lost.',
    layout: `${BR_LAYOUT} Fee per car $15 in B5.`,
    formulas: [
      { cell: 'M8', formula: '=COUNT(E15:E64)-COUNT(H15:H64)', note: 'arrivals - washed' },
      { cell: 'M9', formula: '=M8*$B$5' },
    ],
    steps: ['Every arrival either balks, reneges or is washed.', 'Lost = arrivals - actual starts.', 'Lost fees = lost cars x fee.'],
    pitfalls: ['Counting only the balkers misses the renegers.'],
    answer: 'Example: 50 arrivals and 38 washed give 12 lost cars and $180 of lost fees. Simulated values change on F9.',
  },
  {
    id: 'balk-renege-probabilistic-balk',
    topic: 'balk-renege',
    question:
      'Variation: when AT LEAST F4 cars are already in the system, an arriving driver balks only with the probability in F5 (otherwise joins). Rewrite the potential start in F15 and fill down to F64.',
    layout: `${BR_LAYOUT} Here F4 = 4 (balk threshold) and F5 = 0.6 (probability of balking once the threshold is reached).`,
    formulas: [
      { cell: 'F15 (fill to F15:F64)', formula: '=IF(AND(L15>=$F$4,RAND()<$F$5),"",IF(L15>=$I$4,LARGE($I$14:I14,$I$4),E15))', note: 'long line AND a random yes' },
    ],
    steps: [
      'Balking now needs two things at once: a long line AND a random yes with chance F5.',
      'If the driver stays, apply the usual c-bay start rule.',
      'The later columns stay the same because they test F15="".',
    ],
    pitfalls: ['"at least 4" is >=4, "more than 4" is >4.'],
    answer: 'Times or blanks that change on F9; fewer drivers balk than with a hard limit at the same threshold.',
  },

  // ---------------------------------------------------------------- batch-queue
  {
    id: 'batch-queue-schedule-arrivals',
    topic: 'batch-queue',
    question:
      'Bumboats leave the jetty every B2 minutes, the first at 07:10. In C7, compute the scheduled departure time from the one above; in D7, the number of passengers arriving during the interval, drawn from the arrivals table. Fill both down to row 42.',
    layout: BQ_LAYOUT,
    formulas: [
      { cell: 'C7 (fill to C7:C42)', formula: '=C6+$B$2/1440', note: 'minutes to a day fraction' },
      { cell: 'C7 (alternative)', formula: '=C6+TIME(0,$B$2,0)' },
      { cell: 'D7 (fill to D7:D42)', formula: '=LOOKUP(RAND(),$N$6:$N$10,$M$6:$M$10)', note: 'discrete arrivals via the CRF' },
    ],
    steps: [
      'One row per departure; the scheduled time steps by the interval.',
      'Arrivals per interval come from the discrete table: LOOKUP(RAND(), CRF, values).',
      'Expected arrivals per interval = 6(0.15) + 9(0.25) + 12(0.30) + 15(0.20) + 18(0.10) = 11.55.',
    ],
    pitfalls: ['=C6+$B$2 adds 10 DAYS.', 'Anchoring $C$6 makes every boat leave at 07:10.'],
    answer: 'C7:C42 run 07:10, 07:20, ..., 13:00; D7:D42 are values from the table that change on F9.',
  },
  {
    id: 'batch-queue-waiting',
    topic: 'batch-queue',
    question:
      'The jetty shelter holds at most G2 people. In E7, compute how many people are in the shelter waiting for the boat: new arrivals plus those left behind by the previous boat, capped at the capacity. Fill down to E42.',
    layout: BQ_LAYOUT,
    formulas: [{ cell: 'E7 (fill to E7:E42)', formula: '=MIN(D7+G6,$G$2)', note: 'arrivals + left behind, capped' }],
    steps: ['People available = this interval arrivals + left behind by the PREVIOUS boat (row above).', 'The shelter cannot hold more than its capacity: MIN(available, capacity).'],
    pitfalls: ['=MIN(D7+G7,$G$2) uses this row left-behind, which depends on E7: a circular reference.', 'MAX instead of MIN fills the shelter to capacity every time.'],
    answer: 'Example: 18 arrivals and 10 left behind give MIN(28, 25) = 25.',
  },
  {
    id: 'batch-queue-boarded-left',
    topic: 'batch-queue',
    question: 'Each boat takes at most D2 passengers. In F7, compute the number who board; in G7, the number left behind for the next boat. Fill both down to row 42.',
    layout: BQ_LAYOUT,
    formulas: [
      { cell: 'F7 (fill to F7:F42)', formula: '=MIN($D$2,E7)', note: 'seats or people waiting, whichever is fewer' },
      { cell: 'G7 (fill to G7:G42)', formula: '=E7-F7' },
    ],
    steps: ['Boarded = MIN(seats, people in the shelter).', 'Left behind = people in the shelter - boarded; they wait for the next boat.'],
    pitfalls: ['MAX($D$2,E7) boards more people than there are seats.', 'Left behind comes from the shelter number E7, not from the arrivals D7.'],
    answer: 'Example: 25 in the shelter gives F7 = 12 and G7 = 13.',
  },
  {
    id: 'batch-queue-turned-away',
    topic: 'batch-queue',
    question: 'In H7, compute how many people are turned away because the shelter is full, and fill down to H42. In H44, total the people turned away over the day.',
    layout: `${BQ_LAYOUT} The day total goes in H44.`,
    formulas: [
      { cell: 'H7 (fill to H7:H42)', formula: '=MAX(D7+G6-$G$2,0)', note: 'excess over capacity, never negative' },
      { cell: 'H44', formula: '=SUM(H7:H42)' },
    ],
    steps: ['Excess = arrivals + left behind - capacity.', 'MAX(excess, 0): nobody is turned away when there is room.', 'Check each row: E7 + H7 = D7 + G6.'],
    pitfalls: ['=MAX(D7-$G$2,0) ignores the people already waiting from the previous boat.', 'Working from G7 (after boarding) is too late: the cap applies before the boat comes.'],
    answer: 'Example: 18 arrivals + 10 left behind - 25 = 3 turned away. The total changes on F9.',
  },
  {
    id: 'batch-queue-departure-time',
    topic: 'batch-queue',
    question:
      'Loading takes K2 seconds per boarding passenger, so a boat leaves later than scheduled. In I7, compute the actual departure time, and fill down to I42. Also give the version where the seconds per passenger are drawn at random from the 4 x 2 table P4:Q7.',
    layout: `${BQ_LAYOUT} Optional random loading table (seconds per passenger) in P4:Q7.`,
    formulas: [
      { cell: 'I7 (fill to I7:I42)', formula: '=C7+F7*$K$2/86400', note: 'seconds to a day fraction' },
      { cell: 'I7 (random loading time)', formula: '=C7+F7*INDEX($P$4:$Q$7,RANDBETWEEN(1,4),RANDBETWEEN(1,2))/86400' },
    ],
    steps: ['Total loading seconds = boarded x seconds per passenger.', 'Divide seconds by 86400 (seconds in a day) before adding them to a clock time.', 'Format column I as h:mm:ss.'],
    pitfalls: ['/1440 treats the seconds as minutes: 12 x 15 = 180 would add 3 hours.', 'Anchor K2; keep C7 and F7 relative.'],
    answer: 'Example: C7 = 07:10 with 12 boarding at 15 seconds each adds 180 seconds, so I7 = 07:13:00.',
  },
  {
    id: 'batch-queue-revenue-summary',
    topic: 'batch-queue',
    question:
      'Each boarding passenger pays the fare in J2. In J7, compute the revenue of each boat (fill down to J42); in J44, the day revenue; in G44, the average number left behind per departure; in F44, the share of boats that left full.',
    layout: `${BQ_LAYOUT} Summaries go in F44, G44 and J44.`,
    formulas: [
      { cell: 'J7 (fill to J7:J42)', formula: '=F7*$J$2' },
      { cell: 'J44', formula: '=SUM(J7:J42)' },
      { cell: 'G44', formula: '=AVERAGE(G7:G42)' },
      { cell: 'F44', formula: '=COUNTIF(F7:F42,$D$2)/COUNT(F7:F42)', note: 'boats with every seat taken' },
    ],
    steps: ['Revenue per boat = boarded x fare.', 'Sum for the day; average the left-behind column; count the full boats.', 'Replicate J44 with a Data Table for the expected daily revenue.'],
    pitfalls: ['Revenue on arrivals (D) counts people who never boarded.'],
    answer: 'Changes on F9. Upper bound: 36 boats x 12 seats x $4 = $1,728 if every boat leaves full.',
  },
  {
    id: 'batch-queue-capacity-compare',
    topic: 'batch-queue',
    question:
      'Management may enlarge the shelter from 25 to 40 people. With one Data Table, replicate the day 1,000 times for both capacities and give the average number turned away for each in S3:T3. Does the larger shelter raise revenue? Explain.',
    layout: `${BQ_LAYOUT} Day total turned away in H44 and day revenue in J44. Two-way Data Table R5:T1005: corner R5, capacities 25 and 40 in S5:T5, trial numbers 1-1000 in R6:R1005, results S6:T1005. V1 is a blank cell. Averages go in S3:T3.`,
    formulas: [
      { cell: 'R5', formula: '=H44', note: 'output in the corner' },
      { cell: 'S3 (fill right to S3:T3)', formula: '=AVERAGE(S6:S1005)' },
    ],
    tool: [
      'Type 25 and 40 in S5:T5 and 1 to 1000 in R6:R1005',
      'Put =H44 in the corner R5',
      'Select R5:T1005',
      'Data > What-If Analysis > Data Table',
      'Row input cell: $G$2 (shelter capacity)',
      'Column input cell: $V$1 (blank)',
      'Build a second table the same way with =J44 in its corner for revenue',
    ],
    steps: [
      'Capacities across the top feed G2 (row input); trial numbers down the side feed a blank cell.',
      'Average each column for the two capacities.',
      'Repeat with revenue (J44) as the output to answer the revenue question.',
      'Explain using the seats: revenue can never exceed 36 x 12 x $4 = $1,728 a day.',
    ],
    pitfalls: ['G2 must be a typed value, not a formula.', 'Comparing single F9 runs instead of 1,000-replication averages.'],
    answer:
      'Averages change on F9. Fewer people are turned away with 40 places. Revenue rises only if the extra people kept in the shelter later find seats; expected arrivals (11.55 per interval) are close to the 12 seats, so boats are often full and the revenue gain is small and capped at $1,728. Quote both revenue averages before concluding.',
  },
]
