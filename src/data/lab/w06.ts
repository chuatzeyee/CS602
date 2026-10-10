import type { CellSpec, CellValue, Exercise } from '../../lab/types'

// Week 6: dates and times as serial numbers, time arithmetic, date/time format codes, and queue models
// (single server, c servers with COUNTIF + LARGE, balking and reneging with the BR / BR-2 / BR-M end times, and
// random queues replicated with Data Tables: exponential times and the slides' PERCENTILE(data, RAND()) resampling).
// Every scenario and number is original. The fixed-data c-server models are tie-free: every service end is at least 5 s away
// from every arrival and every potential wait at least 5 s away from the renege limit, in the base data and in each
// test case (and for each number of servers the kiosk Data Table tries), so the strict comparisons (">"&arrival,
// wait > limit) never sit on a floating-point boundary. Exact ties appear only where the task is about the boundary
// (w6-countif-wait-targets: "at most" vs "over", typed waits equal to the limits; the 30-day swim in the renewal caps);
// Excel's 15-digit text in "<="&B3 rounds those two limits upwards, so Excel counts them exactly as the lab does.
// In the random models (kiosk replications, car wash) the checker compares formulas on the same draws, and ties
// between continuous draws have probability zero.
// Every function a task requires (mustUse) is named in its prompt. Anchoring is never forced with check.absolute, so
// the slides' mixed refs (C$4, I$11:I11) pass too: a reference that breaks on fill-down is caught by the filled values.

// a clock time or a duration as Excel stores it: a fraction of a day
const t = (h: number, m = 0, s = 0): number => (h * 3600 + m * 60 + s) / 86400
const sec = (s: number): number => s / 86400
// Excel 1900-system serial number of a date (after 1 Mar 1900)
const day = (y: number, m: number, d: number): number => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)

const CLOCK = 'h:mm:ss'
const DUR = 'mm:ss'
const DATE_FMT = 'dd-mmm-yyyy'
const WDATE = 'ddd dd-mmm-yyyy'
const PCT = '0.0%'
const MONEY = '$#,##0.00'

const title = (v: string): CellSpec => ({ v, role: 'label', bold: true })
const label = (v: string): CellSpec => ({ v, role: 'label' })
const header = (v: string): CellSpec => ({ v, role: 'header' })
const note = (v: string): CellSpec => ({ v, role: 'note' })
const input = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'input', fmt } : { v, role: 'input' })
const given = (v: CellValue, fmt?: string): CellSpec => (fmt ? { v, role: 'given', fmt } : { v, role: 'given' })
const givenF = (f: string, fmt?: string): CellSpec => (fmt ? { f, role: 'given', fmt } : { f, role: 'given' })
const answer = (fmt?: string): CellSpec => (fmt ? { role: 'answer', fmt } : { role: 'answer' })

// one spec per row down a column, starting at row r0
function down(col: string, r0: number, specs: readonly CellSpec[]): Record<string, CellSpec> {
  return Object.fromEntries(specs.map((s, i) => [`${col}${r0 + i}`, s]))
}
// the same spec in rows r0..r0+n-1 of a column
function block(col: string, r0: number, n: number, spec: CellSpec): Record<string, CellSpec> {
  return down(col, r0, Array.from({ length: n }, () => spec))
}
// test-case inputs for a column of values
function inputsDown(col: string, r0: number, values: readonly CellValue[]): Record<string, CellValue> {
  return Object.fromEntries(values.map((v, i) => [`${col}${r0 + i}`, v]))
}

// ---------- level 1 drills ----------

const STAMPS = [day(2026, 11, 2) + t(7, 42, 15), day(2026, 11, 2) + t(12, 8, 50), day(2026, 11, 3) + t(18, 45, 0), day(2026, 11, 5) + t(21, 17, 36), day(2026, 11, 7) + t(0, 35, 20)]
const NEXT_STAMPS = [day(2026, 11, 9) + t(6, 55, 40), day(2026, 11, 9) + t(13, 20, 5), day(2026, 11, 10) + t(19, 2, 30), day(2026, 11, 11) + t(23, 48, 12), day(2026, 11, 12) + t(10, 10, 10)]

const timestampParts: Exercise = {
  id: 'w6-timestamp-parts',
  week: 'W6',
  topic: 'Date and time serial numbers',
  title: 'Split order timestamps into date and clock time',
  level: 1,
  minutes: 6,
  scenario:
    'Kallang Wok Lab, a cloud kitchen, exports every delivery order with one timestamp, and the export shows it as a plain serial number. ' +
    'The shift report needs the order date and the clock time in separate columns, and the dispatch chart wants the clock time as decimal hours.',
  sheet: {
    rows: 11,
    cols: 5,
    cells: {
      A1: title('Order timestamps: take the serial number apart'),
      A3: header('Order'), B3: header('Timestamp (serial)'), C3: header('Date'), D3: header('Clock time'), E3: header('Decimal hours'),
      ...down('A', 4, ['K-201', 'K-202', 'K-203', 'K-204', 'K-205'].map((v) => given(v))),
      ...down('B', 4, STAMPS.map((v) => input(v, '0.000000'))),
      ...block('C', 4, 5, answer(DATE_FMT)),
      ...block('D', 4, 5, answer('hh:mm:ss')),
      ...block('E', 4, 5, answer('0.000')),
      A10: note('The whole number counts days (1 Jan 1900 is day 1); the fraction is the time of day.'),
    },
    colWidths: { A: 70, B: 140, C: 110, D: 100, E: 110 },
  },
  tasks: [
    {
      id: 'date',
      kind: 'formula',
      cells: 'C4:C8',
      prompt: 'In C4 return only the date of the timestamp in B4, rebuilt with `DATE` from `YEAR`, `MONTH` and `DAY`. Fill down to C8.',
      solution: '=DATE(YEAR(B4),MONTH(B4),DAY(B4))',
      check: { mustUse: ['DATE', 'YEAR', 'MONTH', 'DAY'] },
      wrong: ['=DATE(YEAR(B4),DAY(B4),MONTH(B4))', '=DAY(B4)', '=DATE(YEAR(B4),MONTH(B4),1)'],
      hints: [
        '`YEAR`, `MONTH` and `DAY` each pull one part out of a serial number.',
        '`DATE(year, month, day)` turns three plain numbers back into a serial number, with no time of day.',
        'Nest them, in the order year, month, day.',
      ],
      explain:
        'DATE returns a whole number, so the time of day is dropped: K-201 becomes 46328, shown as 02-Nov-2026. INT(B4) gives the same number. ' +
        'Keep the argument order year, month, day: DATE(2026,2,11) is 11 Feb, not 2 Nov.',
    },
    {
      id: 'time',
      kind: 'formula',
      cells: 'D4:D8',
      prompt: 'In D4 return only the clock time of B4, rebuilt with `TIME` from `HOUR`, `MINUTE` and `SECOND`. Fill down to D8.',
      solution: '=TIME(HOUR(B4),MINUTE(B4),SECOND(B4))',
      check: { mustUse: ['TIME', 'HOUR', 'MINUTE', 'SECOND'] },
      wrong: ['=TIME(HOUR(B4),MINUTE(B4),0)', '=HOUR(B4)', '=TIME(MINUTE(B4),HOUR(B4),SECOND(B4))'],
      hints: [
        '`HOUR`, `MINUTE` and `SECOND` read the clock parts and ignore the date.',
        '`TIME(hour, minute, second)` returns a fraction of a day between 0 and 1.',
        'Nest them as in column C, in the order hour, minute, second.',
      ],
      explain:
        'TIME gives only the fraction: 18:45:00 is 0.78125 of a day, with no date in front. B4-C4 (timestamp minus its date) gives the same value. ' +
        'Dropping the seconds (TIME(h,m,0)) shifts four of the five rows, K-202 by 50 seconds.',
    },
    {
      id: 'hours',
      kind: 'formula',
      cells: 'E4:E8',
      prompt: 'In E4 turn the clock time in D4 into decimal hours (18:45 becomes 18.75). Fill down to E8.',
      solution: '=D4*24',
      wrong: ['=HOUR(B4)', '=D4*1440', '=D4/24'],
      hints: ['A time is a fraction of one day. How many hours are in a day?', 'HOUR alone keeps only the whole hours and drops the minutes.'],
      explain:
        'Fraction of a day x 24 = hours: 0.78125 x 24 = 18.75. HOUR(B6) returns 18 and loses the 45 minutes; x1440 would give minutes instead.',
    },
  ],
  testCases: [
    { name: 'the next export arrives', inputs: inputsDown('B', 4, NEXT_STAMPS) },
    { name: 'K-203 was placed at 23:59:59', inputs: { B6: day(2026, 11, 3) + t(23, 59, 59) } },
  ],
  skills: ['date serial numbers', 'YEAR, MONTH, DAY', 'DATE', 'HOUR, MINUTE, SECOND', 'TIME', 'decimal hours (x24)'],
  techniques: ['Date functions (TODAY, MONTH, WEEKDAY, date differences)', 'Time arithmetic (durations, x24, /1440, /86400)'],
}

const durationConversions: Exercise = {
  id: 'w6-duration-conversions',
  week: 'W6',
  topic: 'Duration units',
  title: 'Durations in hours, minutes and seconds',
  level: 1,
  minutes: 5,
  scenario:
    'A climbing gym in Jurong East logs each instructor session as a duration (h:mm:ss). Payroll pays by decimal hours and the booking app shows minutes. ' +
    'The door sensor reports the gap between two sessions as a plain number of seconds, which has to become a time value before it can be added to a clock time.',
  sheet: {
    rows: 11,
    cols: 7,
    cells: {
      A1: title('Convert durations between units'),
      A3: header('Session'), B3: header('Length'), C3: header('Hours'), D3: header('Minutes'),
      F3: header('Gap (seconds)'), G3: header('Gap as a time'),
      ...down('A', 4, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((v) => given(v))),
      ...down('B', 4, [t(1, 30), t(0, 45), t(2, 10, 30), t(1, 5, 45), t(0, 55, 20), t(3)].map((v) => input(v, 'h:mm:ss'))),
      ...block('C', 4, 6, answer('0.00')),
      ...block('D', 4, 6, answer('0.0')),
      ...down('F', 4, [300, 945, 1260, 75, 3725, 615].map((v) => input(v, '0'))),
      ...block('G', 4, 6, answer('h:mm:ss')),
      A11: note('Excel stores 1:30:00 as 0.0625 of a day.'),
    },
    colWidths: { A: 70, B: 90, C: 80, D: 80, E: 24, F: 110, G: 110 },
  },
  tasks: [
    {
      id: 'hours',
      kind: 'formula',
      cells: 'C4:C9',
      prompt: 'In C4 convert the session length in B4 to decimal hours for payroll (1:30:00 is 1.5). Fill down to C9.',
      solution: '=B4*24',
      wrong: ['=B4*60', '=HOUR(B4)', '=B4/24'],
      hints: ['B4 holds a fraction of one day.', 'One day = 24 hours.'],
      explain: 'Hours = day fraction x 24, so 0.0625 x 24 = 1.5. HOUR(B4) keeps only the whole hours (1), which underpays every part hour.',
    },
    {
      id: 'minutes',
      kind: 'formula',
      cells: 'D4:D9',
      prompt: 'In D4 convert the session length to minutes for the app (seconds become decimals of a minute). Fill down to D9.',
      solution: '=B4*1440',
      wrong: ['=MINUTE(B4)', '=B4*60', '=HOUR(B4)*60+MINUTE(B4)'],
      hints: ['How many minutes are in one day?', '24 x 60 = 1440. MINUTE(B4) only reads the minutes past the hour.'],
      explain:
        'Minutes = day fraction x 1440 (24 x 60): 2:10:30 is 130.5 minutes. MINUTE returns 10 for it, and HOUR*60+MINUTE drops the 30 seconds.',
    },
    {
      id: 'gap',
      kind: 'formula',
      cells: 'G4:G9',
      prompt: 'In G4 turn the gap in F4 (a plain number of seconds) into a time value, so that 300 shows as 0:05:00. Fill down to G9.',
      solution: '=F4/86400',
      wrong: ['=F4/1440', '=F4/60', '=F4*86400'],
      hints: ['Going from a unit to a day fraction, you divide by the number of those units in a day.', 'A day has 24 x 60 x 60 seconds.'],
      explain: 'Seconds / 86400 = fraction of a day, so 300 / 86400 = 0.00347, shown as 0:05:00. Dividing by 1440 treats the number as minutes. TIME(0,0,F4) works too.',
    },
  ],
  testCases: [
    { name: 'every session is longer', inputs: inputsDown('B', 4, [t(2), t(1, 15), t(2, 40, 30), t(1, 35, 45), t(1, 25, 20), t(3, 30)]) },
    { name: 'a new sensor log arrives', inputs: inputsDown('F', 4, [420, 1500, 90, 2700, 3605, 30]) },
  ],
  skills: ['durations as day fractions', 'x24 for hours', 'x1440 for minutes', '/86400 from seconds'],
  techniques: ['Time arithmetic (durations, x24, /1440, /86400)', 'Unit conversion (MB to GB, seconds/minutes to day fractions)'],
}

const WAITS = [0, 125, 480, 610, 900, 300, 1020, 75, 455, 960, 240, 530]

const countifTargets: Exercise = {
  id: 'w6-countif-wait-targets',
  week: 'W6',
  topic: 'COUNTIF with a built criterion',
  title: 'Count waits against a target with COUNTIF',
  level: 1,
  minutes: 5,
  scenario:
    'A polyclinic pharmacy in Bukit Batok timed twelve patients this morning. The manager sets a target wait (B3) and a long-wait threshold (B4) ' +
    'and wants the counts and the share served within target to update whenever either limit changes.',
  sheet: {
    rows: 19,
    cols: 5,
    cells: {
      A1: title('Waits against a target'),
      A3: label('Target wait (at most)'), B3: input(t(0, 8), DUR),
      A4: label('Long wait (over)'), B4: input(t(0, 15), DUR),
      D3: label('Patients within target'), E3: answer('0'),
      D4: label('Patients with a long wait'), E4: answer('0'),
      D5: label('Share within target'), E5: answer(PCT),
      A6: header('Patient'), B6: header('Wait'),
      ...down('A', 7, WAITS.map((_, i) => given(`P${String(i + 1).padStart(2, '0')}`))),
      ...down('B', 7, WAITS.map((s) => input(sec(s), DUR))),
    },
    colWidths: { A: 150, B: 80, C: 24, D: 170, E: 80 },
  },
  tasks: [
    {
      id: 'within',
      kind: 'formula',
      cells: 'E3',
      prompt: 'In E3 count the patients whose wait is at most the target in B3, with `COUNTIF` and a criterion built from B3.',
      solution: '=COUNTIF(B7:B18,"<="&B3)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(B7:B18,"<"&B3)', '=COUNTIF(B7:B18,"<=B3")', '=COUNTIF(B7:B18,"<="&B4)'],
      hints: [
        'The criterion is text such as "<=10". To compare with a cell, build the text with & (or `CONCATENATE`).',
        '"At most" includes a wait exactly equal to the target: P03 waited exactly 8:00.',
      ],
      explain:
        '"<="&B3 builds the text "<=0.00555..." (8:00 as a day fraction), so COUNTIF compares numbers. Inside the quotes, "<=B3" compares with the text B3 and finds nothing.',
    },
    {
      id: 'long',
      kind: 'formula',
      cells: 'E4',
      prompt: 'In E4 count, again with `COUNTIF`, the patients who waited longer than B4.',
      solution: '=COUNTIF(B7:B18,">"&B4)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(B7:B18,">="&B4)', '=COUNTIF(B7:B18,">B4")', '=COUNT(B7:B18)-E3'],
      hints: ['Same pattern as E3 with a different operator.', '"Over" excludes a wait exactly equal to the threshold (P05 waited exactly 15:00).'],
      explain: 'Two patients waited over 15:00. ">=" would also count P05, who waited exactly 15:00.',
    },
    {
      id: 'share',
      kind: 'formula',
      cells: 'E5',
      prompt: 'In E5 compute the share of timed patients served within target: E3 divided by the number of waits recorded in B7:B18, counted with `COUNT` so that a patient who was not timed drops out.',
      solution: '=E3/COUNT(B7:B18)',
      wrong: ['=E3/12', '=E3/COUNT(B7:B17)'],
      hints: ['A share is a part over the whole: patients within target over all timed patients.', '`COUNT` counts the cells that hold numbers, so a patient who was not timed (blank) drops out.'],
      explain: '7 of 12 = 58.3%. Typing /12 breaks as soon as a wait is missing; COUNT adapts to the data.',
    },
  ],
  testCases: [
    { name: 'the target rises to 10:00', inputs: { B3: t(0, 10) } },
    { name: 'a long wait means over 10:00', inputs: { B4: t(0, 10) } },
    { name: 'P11 was not timed', inputs: { B17: null } },
  ],
  skills: ['COUNTIF', 'criteria built with &', 'at most vs over', 'COUNT for a share'],
  techniques: ['Conditional aggregation (SUMIF/COUNTIF with criteria strings)', 'Queue performance measures (weighted wait, % within threshold, utilisation)'],
}

const RIDER_ARRIVALS = [t(10, 0, 40), t(10, 1, 30), t(10, 2, 10), t(10, 3, 5), t(10, 7, 15), t(10, 9, 30), t(10, 14, 20), t(10, 15, 0)]
const RIDER_REPAIRS = [t(0, 6), t(0, 5, 20), t(0, 4, 10), t(0, 3, 30), t(0, 2, 40), t(0, 5, 5), t(0, 3), t(0, 2, 30)]

const nextFreeServer: Exercise = {
  id: 'w6-next-free-server',
  week: 'W6',
  topic: 'c servers: COUNTIF + LARGE',
  title: 'Next free mechanic with COUNTIF and LARGE',
  level: 1,
  minutes: 8,
  scenario:
    'A bicycle repair stand on a Punggol park connector opens at 10:00 (B3) with B2 mechanics, and eight riders turn up for quick fixes. ' +
    'Each End cell (column F) is already set to Start + Repair time, so once the In-system and Start columns are filled, the whole queue runs.',
  sheet: {
    rows: 15,
    cols: 6,
    cells: {
      A1: title('Repair stand with c mechanics'),
      A2: label('Mechanics (c)'), B2: input(2, '0'),
      A3: label('Opening time'), B3: input(t(10), 'h:mm'),
      A5: header('Rider'), B5: header('Arrival'), C5: header('Repair time'), D5: header('In system at arrival'), E5: header('Start'), F5: header('End'),
      A6: given(0), B6: label('opening'), F6: givenF('=B3', CLOCK),
      ...down('A', 7, [1, 2, 3, 4, 5, 6, 7, 8].map((v) => given(v))),
      ...down('B', 7, RIDER_ARRIVALS.map((v) => input(v, CLOCK))),
      ...down('C', 7, RIDER_REPAIRS.map((v) => given(v, DUR))),
      ...block('D', 7, 8, answer('0')),
      ...block('E', 7, 8, answer(CLOCK)),
      ...down('F', 7, [7, 8, 9, 10, 11, 12, 13, 14].map((r) => givenF(`=E${r}+C${r}`, CLOCK))),
    },
    colWidths: { A: 110, B: 80, C: 90, D: 140, E: 80, F: 80 },
  },
  tasks: [
    {
      id: 'inSystem',
      kind: 'formula',
      cells: 'D7:D14',
      prompt:
        'In D7 count how many earlier riders are still in the system when rider 1 arrives: the end times from F6 down to the row above that are later than the arrival in B7. ' +
        'Use `COUNTIF` with a range that starts at F6 and grows as you fill down to D14.',
      solution: '=COUNTIF($F$6:F6,">"&B7)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(F6:F6,">"&B7)', '=COUNTIF($F$6:F6,">B7")', '=COUNTIF($F$6:F6,"<"&B7)', '=COUNTIF($F6:F6,">"&B7)'],
      hints: [
        'An earlier rider is still in the system if their repair ends after this arrival: count the end times greater than B7.',
        'The criterion is text built from the arrival time: ">"&B7.',
        'Anchor only the start of the range ($F$6:F6) and leave its end relative, so row 8 looks at F6:F7, row 9 at F6:F8, and so on.',
      ],
      explain:
        'An earlier rider is still in the system if their repair ends after this arrival. $F$6:F6 expands as it fills, so every row counts all earlier riders and nobody later.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'E7:E14',
      prompt:
        'In E7 compute the start time: the arrival time if fewer than c riders (B2) are in the system, otherwise the c-th largest earlier end time (`LARGE`). Fill down to E14.',
      solution: '=IF(D7<$B$2,B7,LARGE($F$6:F6,$B$2))',
      check: { mustUse: ['LARGE'] },
      wrong: [
        '=IF(D7<$B$2,B7,SMALL($F$6:F6,1))',
        '=IF(D7<$B$2,B7,LARGE($F$6:F6,1))',
        '=MAX(B7,LARGE($F$6:F6,$B$2))',
        '=IF(D7<=$B$2,B7,LARGE($F$6:F6,$B$2))',
        '=IF(D7<2,B7,LARGE($F$6:F6,2))',
      ],
      hints: [
        'If D7 < c, a mechanic is idle, so the rider starts on arrival.',
        'If all c mechanics are busy, the riders on the stands own the c latest end times; the earliest of those is when a mechanic frees up.',
        'That is the c-th largest end time so far: LARGE(range, c), with the same growing range as column D.',
      ],
      explain:
        'Rider 3 arrives at 10:02:10 with 2 riders in the system, so with c = 2 the start is LARGE(F6:F8,2) = 10:06:40, when rider 1 finishes. ' +
        'MAX(arrival, LARGE(...)) fails on the first rows: LARGE needs at least c values and returns #NUM!, which then flows down the column.',
    },
    {
      id: 'why',
      kind: 'explain',
      cells: '',
      prompt: 'Why does the start time use LARGE(earlier ends, c) and not SMALL(earlier ends, 1), the earliest end time?',
      answer:
        'The range holds the end time of every earlier rider, including riders who left long ago, so SMALL(...,1) returns a time in the past (here the opening time). ' +
        'When all c mechanics are busy, the c largest end times belong to the riders being repaired right now, and the smallest of those, the c-th largest overall, ' +
        'is when the first mechanic becomes free.',
    },
  ],
  testCases: [
    { name: 'only one mechanic turns up', inputs: { B2: 1 } },
    { name: 'a third mechanic helps', inputs: { B2: 3 } },
    { name: 'a quiet morning: a rider every 7 minutes from 10:02', inputs: inputsDown('B', 7, RIDER_ARRIVALS.map((_, i) => t(10, 2 + 7 * i))) },
  ],
  skills: ['COUNTIF with an expanding range', 'c-server start with LARGE', 'mixed anchoring $F$6:F6'],
  techniques: ['Multi-server queue (COUNTIF system length + LARGE c-th end time)', 'Absolute/mixed references so formulas fill down/right'],
}

const textFormatCodes: Exercise = {
  id: 'w6-text-format-codes',
  week: 'W6',
  topic: 'Date and time format codes',
  title: 'Badges, a long wait and staff hours with format codes',
  level: 1,
  minutes: 6,
  scenario:
    'An events company at Marina Bay prints conference badges from the session timestamp in B3. Its registration dashboard shows the longest queue wait of the day (B4) ' +
    'in minutes and seconds, and the staff rota totals the hours worked at registration over the three days (B5). ' +
    'Each output needs a fixed style, so the codes you would type in Format Cells > Custom go inside TEXT(value, "code"). ' +
    'Extension: TEXT itself is taught in week 10; in week 6 you apply the same codes with Format Cells, and writing them inside TEXT lets the lab check them.',
  sheet: {
    rows: 11,
    cols: 3,
    cells: {
      A1: title('Format codes inside TEXT'),
      A3: label('Session starts'), B3: input(day(2026, 11, 6) + t(19, 5), 'dd/mm/yyyy hh:mm'),
      A4: label('Longest wait at registration'), B4: input(t(1, 5, 37), '[h]:mm:ss'),
      A5: label('Staff time over the three days'), B5: input(t(31, 20), '[h]:mm'),
      A6: header('Output'), B6: header('Must show'), C6: header('Your TEXT formula'),
      A7: label('Badge date'), B7: given('Fri 06-Nov-2026'), C7: answer(),
      A8: label('Badge time'), B8: given('7:05 PM'), C8: answer(),
      A9: label('Longest wait (min:sec)'), B9: given('65:37'), C9: answer(),
      A10: label('Staff time (hours:min)'), B10: given('31:20'), C10: answer(),
    },
    colWidths: { A: 210, B: 140, C: 170 },
  },
  tasks: [
    {
      id: 'badge',
      kind: 'formula',
      cells: 'C7',
      prompt: 'In C7 use `TEXT` on B3 so it shows the weekday, day, month and year exactly like B7 (Fri 06-Nov-2026).',
      solution: '=TEXT(B3,"ddd dd-mmm-yyyy")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B3,"dd-mmm-yyyy")', '=TEXT(B3,"dddd dd-mmmm-yyyy")', '="Fri 06-Nov-2026"'],
      hints: ['d gives 6 and dd gives 06; ddd gives Fri and dddd Friday.', 'Months follow a similar pattern: mm 11, mmm Nov, mmmm November.'],
      explain:
        'ddd dd-mmm-yyyy gives Fri 06-Nov-2026. The deck flags the inconsistency: more d letters switch from the day of the month to the weekday, while more m letters only spell the month out.',
    },
    {
      id: 'clock',
      kind: 'formula',
      cells: 'C8',
      prompt: 'In C8 use `TEXT` on B3 to show the time on a 12-hour clock, like B8 (7:05 PM).',
      solution: '=TEXT(B3,"h:mm AM/PM")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B3,"hh:mm")', '=TEXT(B3,"h:mm")'],
      hints: ['h:mm alone gives 19:05.', 'Add AM/PM at the end of the code to switch to a 12-hour clock.'],
      explain: 'h:mm AM/PM shows 7:05 PM. The m after h means minutes, not months.',
    },
    {
      id: 'longWait',
      kind: 'formula',
      cells: 'C9',
      prompt: 'In C9 use `TEXT` on B4 to show the wait as minutes and seconds, with the minutes counting past 59, like B9 (65:37).',
      solution: '=TEXT(B4,"[mm]:ss")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B4,"mm:ss")', '=TEXT(B4,"h:mm:ss")', '=TEXT(B4,"[h]:mm")'],
      hints: ['mm:ss shows only the minutes past the hour, so 1:05:37 would read 05:37.', 'Square brackets let a unit keep counting past its usual limit: [h] past 23 hours, [m] past 59 minutes.'],
      explain:
        '[mm]:ss (or [m]:ss) shows the elapsed minutes: 65:37. Plain mm:ss shows 05:37 and silently hides the hour, the trap in queue sheets whose wait columns are formatted mm:ss; MINUTE(B4) also returns 5.',
    },
    {
      id: 'staffHours',
      kind: 'formula',
      cells: 'C10',
      prompt: 'In C10 use `TEXT` on B5 to show the total staff time in hours and minutes, with the hours counting past 23, like B10 (31:20).',
      solution: '=TEXT(B5,"[h]:mm")',
      check: { mustUse: ['TEXT'] },
      wrong: ['=TEXT(B5,"h:mm")', '=TEXT(B5,"hh:mm")', '=TEXT(B5,"[h]:mm:ss")', '="31:20"'],
      hints: [
        'h:mm shows only the hours past the last whole day: 31:20 would read 7:20.',
        'The slides\' code for elapsed hours puts the h in square brackets.',
      ],
      explain:
        '[h]:mm keeps counting past 23 hours: 31:20. B5 holds 1.3056 days, and h:mm shows 7:20 because the whole day counts as a date, which a time code ignores. ' +
        'Use [h] for any total of hours that can pass one day, such as staff hours over a week.',
    },
  ],
  testCases: [
    { name: 'the session moves to Saturday 9:30', inputs: { B3: day(2026, 11, 7) + t(9, 30) } },
    { name: 'the longest wait is 2:03:10', inputs: { B4: t(2, 3, 10) } },
    { name: 'a fourth day adds 9:45 of staff time', inputs: { B5: t(41, 5) } },
  ],
  skills: ['date format codes d/dd/ddd/dddd, m/mm/mmm/mmmm, yy/yyyy', 'time codes h, mm, ss, AM/PM', 'elapsed time [h] and [m]', 'TEXT'],
  extension: true,
}

// ---------- level 2 applied models ----------

const ktvBilling: Exercise = {
  id: 'w6-overnight-room-billing',
  week: 'W6',
  topic: 'Durations across midnight',
  title: 'Late-night room billing across midnight',
  level: 2,
  minutes: 12,
  scenario:
    'Night Owl KTV in Clarke Quay bills each room per minute: a booking fee (B2) plus an hourly rate (B3) on the exact session length. ' +
    'Many sessions end after midnight, where end minus start turns negative. ' +
    'Group E (row 10) starts at 19:45 with a fixed budget (B4) and asks for the latest time they can stay.',
  sheet: {
    rows: 12,
    cols: 6,
    cells: {
      A1: title('Room billing across midnight'),
      A2: label('Booking fee'), B2: input(12, MONEY),
      A3: label('Rate per hour'), B3: input(16, MONEY),
      A4: label('Group E budget'), B4: input(60, MONEY),
      A5: header('Room'), B5: header('Start'), C5: header('End'), D5: header('Length'), E5: header('Hours'), F5: header('Charge'),
      ...down('A', 6, ['Room A', 'Room B', 'Room C', 'Room D', 'Group E'].map((v) => given(v))),
      ...down('B', 6, [t(19, 30), t(20, 15), t(21, 40), t(22, 50), t(19, 45)].map((v) => input(v, 'h:mm'))),
      ...down('C', 6, [t(21, 45), t(23, 5), t(0, 25), t(2, 5)].map((v) => input(v, 'h:mm'))),
      C10: { v: t(21), role: 'answer', fmt: 'h:mm' },
      ...block('D', 6, 5, answer('h:mm')),
      ...block('E', 6, 5, answer('0.00')),
      ...block('F', 6, 5, answer(MONEY)),
      A12: note('C10 is Group E\'s end time: a starting guess for Goal Seek.'),
    },
    colWidths: { A: 120, B: 70, C: 70, D: 70, E: 70, F: 90 },
  },
  tasks: [
    {
      id: 'length',
      kind: 'formula',
      cells: 'D6:D10',
      prompt: 'In D6 compute the session length from the start (B6) and end (C6) clock times, so that it is also right when the session ends after midnight. Fill down to D10.',
      solution: '=IF(C6<B6,C6+1-B6,C6-B6)',
      wrong: ['=C6-B6', '=B6-C6', '=ABS(C6-B6)'],
      hints: [
        'Room C runs from 21:40 to 0:25: C8-B8 is negative because 0:25 is the start of the same day.',
        'An end time earlier than the start time means the session ended the next day: add 1 (one whole day) to the end.',
        '`IF(end<start, end+1-start, end-start)`. `MOD(end-start,1)` does the same.',
      ],
      explain:
        'Clock times hold no date, so 0:25 is smaller than 21:40. Adding 1 day to the end fixes it: 0:25 + 24:00 - 21:40 = 2:45. ' +
        'Plain C8-B8 gives -0.885, which Excel shows as #####; ABS gives 21:15, the wrong way round the clock.',
    },
    {
      id: 'hours',
      kind: 'formula',
      cells: 'E6:E10',
      prompt: 'In E6 convert the length to decimal hours. Fill down to E10.',
      solution: '=D6*24',
      wrong: ['=HOUR(D6)', '=D6*1440', '=HOUR(D6)+MINUTE(D6)'],
      hints: ['The length is a fraction of a day.', 'How many hours does one whole day hold?'],
      explain: 'x24 turns the day fraction into hours: 2:50 becomes 2.83 hours. HOUR(D7) returns 2 and would bill only whole hours.',
    },
    {
      id: 'charge',
      kind: 'formula',
      cells: 'F6:F10',
      prompt: 'In F6 compute the charge: the booking fee B2 plus the rate B3 times the hours. Write it once so it fills down to F10.',
      solution: '=$B$2+$B$3*E6',
      wrong: ['=B2+B3*E6', '=$B$2+$B$3*D6', '=($B$2+$B$3)*E6', '=12+16*E6'],
      hints: ['The fee and the rate sit in single cells that every row needs.', 'Multiply the rate by hours (E), not by the day fraction (D).'],
      explain: 'Room A: 12 + 16 x 2.25 = $48.00. Without $ the fee reference slides down to B3, B4, ... as you fill.',
    },
    {
      id: 'budget',
      kind: 'tool',
      tool: 'goalseek',
      cells: 'C10',
      prompt:
        'Group E has B4 = $60. Use What-If Analysis > Goal Seek: set F10 to 60 by changing C10 (the end time). Keep the 21:00 guess or any guess between 19:45 and midnight.',
      toolSetup: { setCell: 'F10', toValue: 60, changingCell: 'C10' },
      answer: { C10: t(22, 45) },
      check: { tol: 1e-5 },
      wrong: ['21:00', '23:45'],
      hints: ['Set cell F10, To value 60, By changing cell C10.', 'Check by hand: (60 - 12) / 16 = 3 hours after 19:45.'],
      explain:
        '$60 buys 3 hours, so Group E can stay until 22:45. Goal Seek needs a value (not a formula) in the changing cell. ' +
        'A guess after midnight puts the IF on its other branch, which can send Goal Seek to a negative time.',
    },
  ],
  testCases: [
    { name: 'the fee is $15 and the rate $20 an hour', inputs: { B2: 15, B3: 20 } },
    { name: 'Room D stays until 2:40', inputs: { C9: t(2, 40) } },
    {
      name: 'a new set of bookings',
      inputs: { B6: t(18, 50), C6: t(20, 20), B7: t(21, 5), C7: t(23, 50), B8: t(22, 35), C8: t(1, 5), B9: t(23, 55), C9: t(1, 40), B10: t(20) },
    },
  ],
  skills: ['durations from clock times', 'crossing midnight with IF', 'x24 for hours', 'absolute references', 'Goal Seek on a time'],
  techniques: ['Time arithmetic (durations, x24, /1440, /86400)', 'Goal Seek', 'Absolute/mixed references so formulas fill down/right'],
}

const LAST_RENEWED = [day(2027, 1, 3), day(2027, 1, 16), day(2027, 1, 26), day(2027, 1, 29), day(2027, 3, 10), day(2027, 1, 12), day(2027, 1, 8), day(2027, 7, 30)]
// last swims: 35, 2, 30 (the "at most" boundary), 53, 4, 7, 13 and 1 days before the 12-Jan-2028 report
const LAST_SWIM = [day(2027, 12, 8), day(2028, 1, 10), day(2027, 12, 13), day(2027, 11, 20), day(2028, 1, 8), day(2028, 1, 5), day(2027, 12, 30), day(2028, 1, 11)]

const renewals: Exercise = {
  id: 'w6-membership-renewals',
  week: 'W6',
  topic: 'Date arithmetic and WEEKDAY',
  title: 'Renewal dates, Sunday shifts, reminders and gifts',
  level: 2,
  minutes: 17,
  scenario:
    'The Bishan Otters swim club renews memberships every 12 months on the same calendar date. The office is shut on Sundays, so a renewal that falls on a Sunday is processed the next day. ' +
    'Reminders go out when the processing date is at most B4 days away, and active swimmers get a free swim cap with a renewal processed in the report month. ' +
    'The report runs as of the fixed date in B3 so it can be checked; a live sheet would use =TODAY() there.',
  sheet: {
    rows: 17,
    cols: 8,
    cells: {
      A1: title('Membership renewals'),
      A3: label('Report date (as of)'), B3: input(day(2028, 1, 12), WDATE),
      A4: label('Reminder lead (days)'), B4: input(14, '0'),
      A5: label('Active: swam within (days)'), B5: input(30, '0'),
      A6: header('Member'), B6: header('Last renewed'), C6: header('Next renewal'), D6: header('Processed on'), E6: header('Days left'), F6: header('Status'),
      G6: header('Last swim'), H6: header('Free cap'),
      ...down('A', 7, ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08'].map((v) => given(v))),
      ...down('B', 7, LAST_RENEWED.map((v) => input(v, DATE_FMT))),
      ...block('C', 7, 8, answer(WDATE)),
      ...block('D', 7, 8, answer(WDATE)),
      ...block('E', 7, 8, answer('0')),
      ...block('F', 7, 8, answer()),
      ...down('G', 7, LAST_SWIM.map((v) => input(v, DATE_FMT))),
      ...block('H', 7, 8, answer()),
      E16: label('Reminders'), F16: answer('0'),
    },
    colWidths: { A: 170, B: 120, C: 130, D: 130, E: 80, F: 90, G: 110, H: 70 },
  },
  tasks: [
    {
      id: 'renewal',
      kind: 'formula',
      cells: 'C7:C14',
      prompt: 'In C7 compute the next renewal: the same day and month as B7, one year later. Build it with `DATE`, `YEAR`, `MONTH` and `DAY`, then fill down to C14.',
      solution: '=DATE(YEAR(B7)+1,MONTH(B7),DAY(B7))',
      check: { mustUse: ['DATE'] },
      wrong: ['=B7+365', '=DATE(YEAR(B7)+1,DAY(B7),MONTH(B7))', '=DATE(YEAR(B7),MONTH(B7)+1,DAY(B7))'],
      hints: ['Take the date apart, add 1 to the year only, and put it back together.', '`DATE(year, month, day)`: the order matters.'],
      explain:
        'Adding 1 to the year keeps the calendar date. B7+365 is a day short whenever 29 Feb sits in between: M05 renewed on 10-Mar-2027 is due on Fri 10-Mar-2028, not 9 Mar, because 2028 is a leap year.',
    },
    {
      id: 'processed',
      kind: 'formula',
      cells: 'D7:D14',
      prompt: 'In D7 move a renewal that falls on a Sunday to the next day; any other day stays. Use `WEEKDAY` (default numbering: Sunday = 1). Fill down to D14.',
      solution: '=IF(WEEKDAY(C7)=1,C7+1,C7)',
      check: { mustUse: ['WEEKDAY'] },
      wrong: ['=IF(WEEKDAY(C7)=7,C7+1,C7)', '=C7+1', '=IF(WEEKDAY(C7)=1,C7-1,C7)'],
      hints: ['`WEEKDAY(date)` returns 1 for Sunday up to 7 for Saturday.', 'Dates are day numbers, so the next day is the date + 1.'],
      explain:
        'M02 renews on Sun 16-Jan-2028, so it is processed on Mon 17 Jan; M04 (a Saturday) stays. WEEKDAY(C7,2)=7 is the same test with Monday = 1 numbering.',
    },
    {
      id: 'daysLeft',
      kind: 'formula',
      cells: 'E7:E14',
      prompt: 'In E7 compute the days from the report date (B3) to the processing date (negative = already passed). Write it once so it fills down to E14.',
      solution: '=D7-$B$3',
      wrong: ['=D7-B3', '=$B$3-D7', '=C7-$B$3'],
      hints: ['Subtracting two dates gives the number of days between them.', 'Every row compares with the same report date.'],
      explain: 'Later date minus earlier date: M02 has 17-Jan minus 12-Jan = 5 days left. Use the processing date (D), not the calendar renewal date (C).',
    },
    {
      id: 'status',
      kind: 'formula',
      cells: 'F7:F14',
      prompt: 'In F7 show "Lapsed" when the days left are negative, "Remind" when they are at most the lead in B4, and "OK" otherwise. Fill down to F14.',
      solution: '=IF(E7<0,"Lapsed",IF(E7<=$B$4,"Remind","OK"))',
      wrong: [
        '=IF(E7<0,"Lapsed",IF(E7<$B$4,"Remind","OK"))',
        '=IF(E7<=$B$4,"Remind",IF(E7<0,"Lapsed","OK"))',
        '=IF(E7<=$B$4,"Remind","OK")',
        '=IF(E7<=0,"Lapsed",IF(E7<=$B$4,"Remind","OK"))',
        '=IF(E7<0,"Lapsed",IF(E7<=B4,"Remind","OK"))',
      ],
      hints: ['Nest one IF inside another: test the lapsed case first.', '"At most 14 days" includes 14 (M03).'],
      explain:
        'Order matters: a lapsed member also has fewer than 14 days left, so testing "<=14" first would remind M01 and M07 instead of marking them Lapsed.',
    },
    {
      id: 'reminders',
      kind: 'formula',
      cells: 'F16',
      prompt: 'In F16 count the reminders to send with `COUNTIF`.',
      solution: '=COUNTIF(F7:F14,"Remind")',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(F7:F14,"<>OK")', '=COUNTIF(E7:E14,"<="&B4)'],
      hints: ['`COUNTIF(range, criterion)` with a text criterion counts the cells equal to that text (not case sensitive).', 'Count the status column, not the days: lapsed members also have fewer than 14 days left.'],
      explain: 'Three reminders (M02, M03, M06). Counting days left <= 14 would also count the two lapsed members.',
    },
    {
      id: 'cap',
      kind: 'formula',
      cells: 'H7:H14',
      prompt:
        'In H7 show "Yes" (a free swim cap) when both hold: the renewal is processed in the same month as the report date (compare the `MONTH` of D7 with the `MONTH` of B3), ' +
        'and the member swam within the last B5 days (B3 minus the last swim in G7 is at most B5). Otherwise show "No". Use `IF` with `AND`, then fill down to H14.',
      solution: '=IF(AND(MONTH(D7)=MONTH($B$3),$B$3-G7<=$B$5),"Yes","No")',
      check: { mustUse: ['AND', 'MONTH'] },
      wrong: [
        '=IF(OR(MONTH(D7)=MONTH($B$3),$B$3-G7<=$B$5),"Yes","No")',
        '=IF(AND(MONTH(D7)=MONTH($B$3),$B$3-G7<$B$5),"Yes","No")',
        '=IF(AND(MONTH(D7)=$B$3,$B$3-G7<=$B$5),"Yes","No")',
        '=IF(AND(MONTH(D7)=MONTH(B3),B3-G7<=B5),"Yes","No")',
        '=IF(AND(MONTH(D7)=MONTH($B$3),G7-$B$3<=$B$5),"Yes","No")',
      ],
      hints: [
        'Both conditions must be true, so put them inside `AND`(condition 1, condition 2) and use that as the test of the IF.',
        'Compare months, not whole dates: MONTH(D7)=MONTH($B$3). A date minus a date gives days: $B$3-G7<=$B$5.',
        'Anchor B3 and B5 with $ so every row compares with the same report date and limit.',
      ],
      explain:
        'Four caps: M02, M03, M06 and M07. M05 swam 4 days ago but renews in March, and M04 renews in January but last swam 53 days ago: AND needs both. ' +
        'M03 swam exactly 30 days before the report, which "within 30 days" includes (<=). M07 gets a cap although lapsed: the rule reads only the month and the last swim. ' +
        'Comparing whole dates (D7=$B$3) would only match a renewal processed on the report day itself.',
    },
  ],
  testCases: [
    { name: 'the report runs on 20 Jan 2028', inputs: { B3: day(2028, 1, 20) } },
    { name: 'reminders go out 7 days ahead', inputs: { B4: 7 } },
    {
      name: 'the next renewal list',
      inputs: inputsDown('B', 7, [day(2027, 2, 2), day(2027, 1, 30), day(2027, 2, 6), day(2027, 1, 20), day(2027, 1, 10), day(2027, 1, 25), day(2027, 1, 23), day(2027, 1, 15)]),
    },
    { name: 'active means a swim in the last 60 days', inputs: { B5: 60 } },
    { name: 'the report runs on 3 Feb 2028', inputs: { B3: day(2028, 2, 3) } },
  ],
  skills: ['DATE, YEAR, MONTH, DAY', 'same date next year', 'WEEKDAY', 'date differences', 'nested IF', 'COUNTIF on text', 'IF with AND on dates (same month, within N days)'],
  techniques: [
    'Date functions (TODAY, MONTH, WEEKDAY, date differences)',
    'IF with AND/OR multi-condition rules',
    'Absolute/mixed references so formulas fill down/right',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
  ],
}

const BOOTH_IA = [150, 80, 465, 55, 50, 690, 140, 100, 210, 135]
const BOOTH_SV = [270, 195, 300, 160, 260, 210, 370, 170, 220, 150]

const singleServer: Exercise = {
  id: 'w6-single-server-booth',
  week: 'W6',
  topic: 'Single-server queue',
  title: 'One nurse: build the single-server queue',
  level: 2,
  minutes: 20,
  scenario:
    'A flu-jab booth at a Toa Payoh community club has one nurse and opens at C2. Yesterday\'s log gives each walk-in\'s inter-arrival time and jab time. ' +
    'Row 5 is customer 0: its End is the opening time, so the first real customer has an earlier end time to compare with.',
  sheet: {
    rows: 18,
    cols: 9,
    cells: {
      A1: title('Single-server queue'),
      A2: label('Opening time'), C2: input(t(9), 'h:mm'),
      A4: header('Customer'), B4: header('Inter-arrival'), C4: header('Service'), D4: header('Arrival'), E4: header('Start'), F4: header('End'), G4: header('Wait'), H4: header('Nurse idle before'),
      I4: header('Time in system'),
      A5: given(0), D5: givenF('=F5', CLOCK), F5: givenF('=C2', CLOCK),
      ...down('A', 6, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => given(v))),
      ...down('B', 6, BOOTH_IA.map((s) => input(sec(s), DUR))),
      ...down('C', 6, BOOTH_SV.map((s) => input(sec(s), DUR))),
      ...block('D', 6, 10, answer(CLOCK)),
      ...block('E', 6, 10, answer(CLOCK)),
      ...block('F', 6, 10, answer(CLOCK)),
      ...block('G', 6, 10, answer(DUR)),
      ...block('H', 6, 10, answer(DUR)),
      ...block('I', 6, 10, answer(DUR)),
      A17: label('Average wait'), C17: answer(DUR),
      A18: label('Nurse utilisation'), C18: answer(PCT),
    },
    colWidths: { A: 120, B: 90, C: 80, D: 80, E: 80, F: 80, G: 70, H: 130, I: 120 },
  },
  tasks: [
    {
      id: 'arrival',
      kind: 'formula',
      cells: 'D6:D15',
      prompt: 'In D6 compute the arrival clock time: the previous arrival plus this inter-arrival time. Fill down to D15.',
      solution: '=D5+B6',
      wrong: ['=$D$5+B6', '=D5+C6', '=F5+B6'],
      hints: ['Inter-arrival = the gap since the previous customer arrived.', 'Clock time + duration = a later clock time.'],
      explain: 'Arrivals chain: 9:00 + 2:30 = 9:02:30, then + 1:20 = 9:03:50. Anchoring $D$5 would measure every gap from the opening time.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'E6:E15',
      prompt: 'In E6 compute the service start: the later of this arrival and the previous customer\'s end time. Fill down to E15.',
      solution: '=MAX(D6,F5)',
      wrong: ['=MAX(D6,E5)', '=D6', '=F5', '=MIN(D6,F5)'],
      hints: ['The nurse can start only when the customer is there AND the previous jab is done.', 'The later of two times is their `MAX`.'],
      explain: 'Customer 2 arrives at 9:03:50 but the nurse is busy until 9:07:00, so the jab starts at 9:07:00. Using the previous START (E5) ignores the time the previous jab takes.',
    },
    {
      id: 'end',
      kind: 'formula',
      cells: 'F6:F15',
      prompt: 'In F6 compute the end time: start plus service time. Fill down to F15.',
      solution: '=E6+C6',
      wrong: ['=D6+C6', '=E6+B6'],
      hints: ['When does the nurse finish with this customer?', 'End = start + duration of the jab.'],
      explain: 'Ending at arrival + service (D6+C6) forgets the wait, and the queue would never build.',
    },
    {
      id: 'wait',
      kind: 'formula',
      cells: 'G6:G15',
      prompt: 'In G6 compute the wait: from arrival to start. Fill down to G15.',
      solution: '=E6-D6',
      wrong: ['=D6-E6', '=F6-D6'],
      hints: ['How long between arriving and being called in?', 'Clock time minus clock time gives a duration.'],
      explain: 'Wait = start - arrival. End - arrival is the system time (wait + service).',
    },
    {
      id: 'idle',
      kind: 'formula',
      cells: 'H6:H15',
      prompt: 'In H6 compute how long the nurse sat idle before this customer: from the previous end time to this start. Fill down to H15.',
      solution: '=E6-F5',
      wrong: ['=D6-F5', '=E6-E5', '=F5-E6'],
      hints: ['The nurse is free from the previous end time (F5) until this start.', 'When a customer waits, the start equals the previous end, so the idle time is 0.'],
      explain: 'Idle = start - previous end; it is 0 whenever a queue exists. Arrival - previous end (D6-F5) turns negative as soon as customers wait.',
    },
    {
      id: 'system',
      kind: 'formula',
      cells: 'I6:I15',
      prompt: 'In I6 compute the time in system: from arrival to the end of the jab. Fill down to I15.',
      solution: '=F6-D6',
      wrong: ['=E6-D6', '=F6-E6', '=D6-F6'],
      hints: ['The customer is in the system while waiting and while being jabbed.', 'End clock time minus arrival clock time.'],
      explain:
        'Time in system = end - arrival = wait + service: customer 2 waited 3:10 and was jabbed for 3:15, so 6:25 in the system. Start - arrival is only the wait, and end - start only the service.',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'C17',
      prompt: 'In C17 compute the average wait.',
      solution: '=AVERAGE(G6:G15)',
      wrong: ['=AVERAGE(G6:G14)', '=SUM(G6:G15)/9', '=AVERAGE(G7:G15)'],
      hints: ['One number that summarises column G.', 'Average over all ten customers, including those who did not wait (0:00).'],
      explain: 'The average wait is 188.5 seconds (3:08.5). Customers who did not wait count as 0:00 and stay in the average.',
    },
    {
      id: 'util',
      kind: 'formula',
      cells: 'C18',
      prompt: 'In C18 compute the nurse\'s utilisation: total service time divided by the time from opening (F5) to the last end time.',
      solution: '=SUM(C6:C15)/(MAX(F6:F15)-F5)',
      wrong: ['=SUM(C6:C15)/MAX(F6:F15)', '=SUM(C6:C15)/(MAX(F6:F15)-D6)', '=SUM(G6:G15)/(MAX(F6:F15)-F5)'],
      hints: ['Utilisation = busy time / time open.', 'Time open = last end - opening time: a clock time minus a clock time.'],
      explain:
        'The nurse jabbed for 38:25 of the 43:30 from 9:00 to 9:43:30: 88.3%. The idle column adds up to the other 5:05. Dividing by MAX(F6:F15) alone divides by a clock time (0.40 of a day since midnight).',
    },
  ],
  testCases: [
    { name: 'the booth opens at 8:30', inputs: { C2: t(8, 30) } },
    { name: 'a quiet morning with a customer every 6:30', inputs: inputsDown('B', 6, BOOTH_IA.map(() => sec(390))) },
    { name: 'customer 2 needs 9:00', inputs: { C7: sec(540) } },
  ],
  skills: ['arrival = previous arrival + inter-arrival', 'start = MAX(arrival, previous end)', 'wait, time in system and idle time', 'utilisation'],
  techniques: ['Time arithmetic (durations, x24, /1440, /86400)', 'Queue performance measures (weighted wait, % within threshold, utilisation)'],
}

const FERRY_ARR = [t(7, 30, 45), t(7, 31, 55), t(7, 32, 25), t(7, 34, 0), t(7, 34, 20), t(7, 35, 0), t(7, 36, 50), t(7, 37, 25), t(7, 38, 25), t(7, 38, 50), t(7, 40, 15), t(7, 41, 5)]
const FERRY_START = [t(7, 30, 45), t(7, 31, 55), t(7, 33, 55), t(7, 35, 45), t(7, 36, 35), t(7, 39, 30), t(7, 40, 25), t(7, 42, 55), t(7, 43, 0), t(7, 46, 20), t(7, 47, 0), t(7, 49, 25)]
const FERRY_END = [t(7, 33, 55), t(7, 35, 45), t(7, 36, 35), t(7, 40, 25), t(7, 39, 30), t(7, 43, 0), t(7, 42, 55), t(7, 47, 0), t(7, 46, 20), t(7, 49, 25), t(7, 53, 30), t(7, 53, 5)]
const FERRY_SIZE = [1, 1, 2, 1, 2, 1, 2, 4, 1, 4, 3, 3]

const queueScorecard: Exercise = {
  id: 'w6-queue-scorecard',
  week: 'W6',
  topic: 'Queue performance measures',
  title: 'Queue scorecard: per party and per passenger',
  level: 2,
  minutes: 15,
  scenario:
    'Two clerks sell tickets at a ferry terminal counter that opens at C4. The log below records twelve travel parties (size, arrival, start and end of service). ' +
    'Management wants the usual scorecard, both per party and per passenger, and the time the k-th party (C6) had its tickets, because the first ferry takes only that many parties.',
  sheet: {
    rows: 21,
    cols: 10,
    cells: {
      A1: title('Ferry counter scorecard'),
      A3: label('Clerks on duty'), C3: given(2, '0'),
      A4: label('Counter opened'), C4: input(t(7, 30), 'h:mm'),
      A5: label('Target wait (at most)'), C5: input(t(0, 4), DUR),
      A6: label('Parties the first ferry takes'), C6: input(8, '0'),
      A8: header('Party'), B8: header('Size'), C8: header('Arrival'), D8: header('Start'), E8: header('End'), F8: header('Wait'), G8: header('Service'),
      ...down('A', 9, FERRY_SIZE.map((_, i) => given(`F${String(i + 1).padStart(2, '0')}`))),
      ...down('B', 9, FERRY_SIZE.map((v) => input(v, '0'))),
      ...down('C', 9, FERRY_ARR.map((v) => input(v, CLOCK))),
      ...down('D', 9, FERRY_START.map((v) => input(v, CLOCK))),
      ...down('E', 9, FERRY_END.map((v) => input(v, CLOCK))),
      ...block('F', 9, 12, answer(DUR)),
      ...block('G', 9, 12, answer(DUR)),
      I3: label('Average wait per party'), J3: answer(DUR),
      I4: label('Average wait per passenger'), J4: answer(DUR),
      I5: label('Parties within target'), J5: answer(PCT),
      I6: label('Passengers within target'), J6: answer(PCT),
      I7: label('Clerk utilisation'), J7: answer(PCT),
      I8: label('k-th party served at'), J8: answer(CLOCK),
    },
    colWidths: { A: 200, B: 50, C: 80, D: 80, E: 80, F: 70, G: 70, H: 20, I: 210, J: 80 },
  },
  tasks: [
    {
      id: 'wait',
      kind: 'formula',
      cells: 'F9:F20',
      prompt: 'In F9 compute each party\'s wait (arrival to start of service). Fill down to F20.',
      solution: '=D9-C9',
      wrong: ['=E9-C9', '=C9-D9'],
      hints: ['How long does a party stand in line before a clerk serves it?', 'Start clock time minus arrival clock time.'],
      explain: 'Wait = start - arrival. End - arrival would be the time in the system.',
    },
    {
      id: 'service',
      kind: 'formula',
      cells: 'G9:G20',
      prompt: 'In G9 compute each party\'s service time. Fill down to G20.',
      solution: '=E9-D9',
      wrong: ['=E9-C9', '=D9-C9'],
      hints: ['How long does a clerk spend with the party?', 'Service runs from start to end.'],
      explain: 'Service = end - start. With two clerks, ends are not in arrival order (F05 finishes before F04).',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'J3',
      prompt: 'In J3 compute the average wait per party.',
      solution: '=AVERAGE(F9:F20)',
      wrong: ['=AVERAGE(G9:G20)', '=SUM(F9:F20)/11'],
      hints: ['Each party counts once, whatever its size.', 'A plain average of the wait column.'],
      explain: 'Per party the average wait is 3:51.',
    },
    {
      id: 'paxWait',
      kind: 'formula',
      cells: 'J4',
      prompt: 'In J4 compute the average wait per passenger: weight each party\'s wait by its size (`SUMPRODUCT`), then divide by the number of passengers.',
      solution: '=SUMPRODUCT(B9:B20,F9:F20)/SUM(B9:B20)',
      check: { mustUse: ['SUMPRODUCT'] },
      wrong: ['=SUMPRODUCT(B9:B20,F9:F20)/COUNT(B9:B20)', '=SUMPRODUCT(B9:B20,F9:F20)', '=AVERAGE(F9:F20)*AVERAGE(B9:B20)'],
      hints: ['Every passenger in a party waits as long as the party.', 'Total passenger-minutes of waiting / total passengers.'],
      explain:
        'Per passenger the average wait is 4:55, not 3:51: the big parties came late and waited longest. Dividing by COUNT (12 parties) instead of SUM (25 passengers) mixes the two units.',
    },
    {
      id: 'pctParties',
      kind: 'formula',
      cells: 'J5',
      prompt: 'In J5 compute the share of parties that waited at most the target in C5: count them with `COUNTIF`, then divide by the number of parties.',
      solution: '=COUNTIF(F9:F20,"<="&C5)/COUNT(F9:F20)',
      check: { mustUse: ['COUNTIF'] },
      wrong: [
        '=COUNTIF(F9:F20,"<="&C5)',
        '=COUNTIF(F9:F20,"<=C5")/COUNT(F9:F20)',
        '=COUNTIF(F9:F20,">"&C5)/COUNT(F9:F20)',
        '=COUNTIF(F9:F20,"<="&C5)/SUM(B9:B20)',
      ],
      hints: ['Count the parties that met the target, then divide by all parties.', 'The criterion is text built from the cell: "<="&C5.'],
      explain: '6 of the 12 parties (50%) waited at most 4:00.',
    },
    {
      id: 'pctPax',
      kind: 'formula',
      cells: 'J6',
      prompt: 'In J6 compute the share of passengers whose wait was at most C5: add up the sizes of those parties with `SUMIF`, then divide by all passengers.',
      solution: '=SUMIF(F9:F20,"<="&C5,B9:B20)/SUM(B9:B20)',
      check: { mustUse: ['SUMIF'] },
      wrong: ['=SUMIF(F9:F20,"<="&C5,B9:B20)/COUNT(B9:B20)', '=COUNTIF(F9:F20,"<="&C5)/SUM(B9:B20)', '=SUMIF(B9:B20,"<="&C5,F9:F20)/SUM(B9:B20)'],
      hints: ['Now count passengers, not parties: add up the sizes of the parties that met the target.', '`SUMIF(criteria range, criterion, sum range)`: test the waits, add the sizes.'],
      explain: 'Only 9 of the 25 passengers (36%) waited at most 4:00, although half the parties did. Exam keys ask for this weighted share.',
    },
    {
      id: 'util',
      kind: 'formula',
      cells: 'J7',
      prompt: 'In J7 compute the clerks\' utilisation: total service time divided by (clerks x time from opening C4 to the last end time).',
      solution: '=SUM(G9:G20)/(C3*(MAX(E9:E20)-C4))',
      wrong: ['=SUM(G9:G20)/(MAX(E9:E20)-C4)', '=SUM(G9:G20)/(C3*(E20-C4))', '=SUM(G9:G20)/(C3*(MAX(E9:E20)-C9))'],
      hints: ['With two clerks the counter offers 2 clerk-minutes per minute open.', 'The last party to arrive is not always the last to finish: use MAX of the end times.'],
      explain:
        '43:55 of service over 2 x 23:30 open (7:30 to 7:53:30, when F11 finishes, not F12) = 93.4%. Without C3 the result is 187%, an impossible utilisation.',
    },
    {
      id: 'kth',
      kind: 'formula',
      cells: 'J8',
      prompt: 'In J8 find the clock time when the C6-th party had its tickets (the C6-th earliest end time), with `SMALL`.',
      solution: '=SMALL(E9:E20,C6)',
      check: { mustUse: ['SMALL'] },
      wrong: ['=LARGE(E9:E20,C6)', '=SMALL(D9:D20,C6)', '=E16'],
      hints: ['Ends are not in party order, so row 16 is not the 8th ticket sale.', '`SMALL(range, k)` returns the k-th smallest value.'],
      explain: 'The 8th ticket sale ended at 7:46:20 (party F09, not F08). SMALL sorts the times for you, and LARGE(...,k) counts from the latest instead.',
    },
  ],
  testCases: [
    { name: 'the target is 3:00 and the ferry takes 10 parties', inputs: { C5: t(0, 3), C6: 10 } },
    { name: 'party F03 is a family of 5', inputs: { B11: 5 } },
    {
      name: 'the log is re-timed (arrivals 20 s earlier, ends 15 s later)',
      inputs: { ...inputsDown('C', 9, FERRY_ARR.map((v) => v - sec(20))), ...inputsDown('E', 9, FERRY_END.map((v) => v + sec(15))) },
    },
  ],
  skills: ['wait and service from a log', 'per-party vs per-passenger averages', 'SUMPRODUCT weights', 'COUNTIF / SUMIF shares', 'utilisation with c servers', 'SMALL for the k-th event'],
  techniques: [
    'Queue performance measures (weighted wait, % within threshold, utilisation)',
    'SUMPRODUCT totals and weighted/expected values',
    'Conditional aggregation (SUMIF/COUNTIF with criteria strings)',
  ],
}

// ---------- level 3 exam-style ----------

const KIOSK_IA = [70, 120, 135, 55, 25, 165, 90, 60, 40, 35, 60, 40, 85, 160]
const KIOSK_SV = [155, 255, 230, 225, 150, 240, 245, 155, 180, 115, 255, 190, 130, 175]

const kioskStaffing: Exercise = {
  id: 'w6-kiosk-staffing',
  week: 'W6',
  topic: 'c-server queue and staffing',
  title: 'How many drink makers? c-server model and a Data Table',
  level: 3,
  minutes: 28,
  scenario:
    'A pop-up bubble-tea kiosk at a Tampines mall opens at C3 with C4 drink makers, who share one queue. Fourteen customers were timed on the opening afternoon. ' +
    'Build the model at the given addresses, report the scorecard in F3:F6, use a Data Table to compare 1 to 4 drink makers, and recommend a staffing level, as an exam question would.',
  sheet: {
    rows: 25,
    cols: 10,
    cells: {
      A1: title('Bubble-tea kiosk: c drink makers, one queue'),
      A3: label('Opening time'), C3: input(t(15), 'h:mm'),
      A4: label('Drink makers (c)'), C4: input(2, '0'),
      A5: label('Target wait (at most)'), C5: input(t(0, 3), DUR),
      E3: label('Average wait'), F3: answer(DUR),
      E4: label('Within target'), F4: answer(PCT),
      E5: label('Utilisation'), F5: answer(PCT),
      E6: label('Traffic intensity'), F6: answer('0.00'),
      H2: header('Makers'), I2: header('Avg wait'), J2: header('Within'),
      I3: givenF('=F3', DUR), J3: givenF('=F4', PCT),
      ...down('H', 4, [1, 2, 3, 4].map((v) => given(v, '0'))),
      ...block('I', 4, 4, answer(DUR)),
      ...block('J', 4, 4, answer(PCT)),
      A9: header('Customer'), B9: header('Inter-arrival'), C9: header('Making time'), D9: header('Arrival'), E9: header('In system'), F9: header('Start'), G9: header('End'), H9: header('Wait'),
      A10: given(0), D10: givenF('=G10', CLOCK), G10: givenF('=C3', CLOCK),
      ...down('A', 11, KIOSK_IA.map((_, i) => given(i + 1))),
      ...down('B', 11, KIOSK_IA.map((s) => input(sec(s), DUR))),
      ...down('C', 11, KIOSK_SV.map((s) => input(sec(s), DUR))),
      ...block('D', 11, 14, answer(CLOCK)),
      ...block('E', 11, 14, answer('0')),
      ...block('F', 11, 14, answer(CLOCK)),
      ...block('G', 11, 14, answer(CLOCK)),
      ...block('H', 11, 14, answer(DUR)),
    },
    colWidths: { A: 150, B: 100, C: 100, D: 80, E: 120, F: 80, G: 80, H: 70, I: 80, J: 70 },
  },
  tasks: [
    {
      id: 'arrival',
      kind: 'formula',
      cells: 'D11:D24',
      prompt: 'D11:D24: arrival clock times (previous arrival + inter-arrival).',
      solution: '=D10+B11',
      wrong: ['=$D$10+B11', '=D10+C11'],
      hints: ['Each customer arrives one inter-arrival time after the previous one.', 'Row 10 is customer 0: its arrival and end are the opening time.'],
      explain: 'Customer 1 arrives at 15:00 + 1:10 = 15:01:10.',
    },
    {
      id: 'inSystem',
      kind: 'formula',
      cells: 'E11:E24',
      prompt: 'E11:E24: number of earlier customers still in the system at this arrival (`COUNTIF` over the end times so far).',
      solution: '=COUNTIF($G$10:G10,">"&D11)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(G10:G10,">"&D11)', '=COUNTIF($G$10:G10,">D11")', '=COUNTIF($G$10:G10,"<"&D11)'],
      hints: ['Count earlier end times later than this arrival.', 'The range starts at the anchored $G$10 and ends one row above.'],
      explain: 'An expanding range $G$10:G10 counts every earlier customer and none of the later ones.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'F11:F24',
      prompt: 'F11:F24: service start. Fewer than c in the system: start on arrival; otherwise the c-th largest earlier end time (`LARGE`).',
      solution: '=IF(E11<$C$4,D11,LARGE($G$10:G10,$C$4))',
      check: { mustUse: ['LARGE'] },
      wrong: [
        '=MAX(D11,G10)',
        '=IF(E11<$C$4,D11,LARGE($G$10:G10,1))',
        '=MAX(D11,LARGE($G$10:G10,$C$4))',
        '=IF(E11<$C$4,D11,SMALL($G$10:G10,$C$4))',
        '=IF(E11<2,D11,LARGE($G$10:G10,2))',
      ],
      hints: [
        'MAX(arrival, previous end) only works for one server.',
        'With all c makers busy, the earliest of the c latest end times is when one frees up: LARGE(..., c).',
      ],
      explain:
        'Customer 4 arrives at 15:06:20 with 2 in the system, so the start is LARGE(G10:G13,2) = 15:07:25, when customer 2\'s drink is done. The IF also keeps LARGE away from the first rows, where fewer than c end times exist (#NUM!).',
    },
    {
      id: 'end',
      kind: 'formula',
      cells: 'G11:G24',
      prompt: 'G11:G24: end time.',
      solution: '=F11+C11',
      wrong: ['=D11+C11', '=F11+B11'],
      hints: ['When does a drink maker finish this order?', 'Start + making time.'],
      explain: 'End = start + making time; column E reads these ends for the later customers.',
    },
    {
      id: 'wait',
      kind: 'formula',
      cells: 'H11:H24',
      prompt: 'H11:H24: wait in the queue.',
      solution: '=F11-D11',
      wrong: ['=G11-D11', '=D11-F11'],
      hints: ['How long between arriving and the order being started?', 'Start - arrival.'],
      explain: 'Wait = start - arrival. End - arrival is the time in the system.',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'F3',
      prompt: 'F3: average wait.',
      solution: '=AVERAGE(H11:H24)',
      wrong: ['=AVERAGE(H11:H23)', '=MAX(H11:H24)'],
      hints: ['One number that summarises column H.', 'All fourteen customers, zero waits included.'],
      explain: 'About 2:38 with two drink makers.',
    },
    {
      id: 'within',
      kind: 'formula',
      cells: 'F4',
      prompt: 'F4: share of customers whose wait was at most the target C5 (`COUNTIF`).',
      solution: '=COUNTIF(H11:H24,"<="&C5)/COUNT(H11:H24)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(H11:H24,"<="&C5)', '=COUNTIF(H11:H24,">"&C5)/COUNT(H11:H24)', '=COUNTIF(H11:H24,"<=C5")/COUNT(H11:H24)'],
      hints: ['Count the waits that are at most the target, then divide by the number of customers.', 'Build the criterion with &: "<="&C5.'],
      explain: '7 of 14 customers (50%) waited at most 3:00.',
    },
    {
      id: 'util',
      kind: 'formula',
      cells: 'F5',
      prompt: 'F5: utilisation of the drink makers: total making time / (c x time from opening to the last end).',
      solution: '=SUM(C11:C24)/(C4*(MAX(G11:G24)-G10))',
      wrong: [
        '=SUM(C11:C24)/(MAX(G11:G24)-G10)',
        '=SUM(H11:H24)/(C4*(MAX(G11:G24)-G10))',
        '=SUM(C11:C24)/(C4*MAX(G11:G24))',
        '=SUM(C11:C24)/(C4*(G24-G10))',
      ],
      hints: ['c makers offer c minutes of work per minute open.', 'Open time = last end - opening; with c servers the last customer is not always the last to finish, so take MAX.'],
      explain: '45:00 of drink making over 2 x 26:00 open = 86.5%. Without c it would read 173%, an impossible utilisation.',
    },
    {
      id: 'traffic',
      kind: 'formula',
      cells: 'F6',
      prompt: 'F6: traffic intensity = (average making time / c) / average inter-arrival time.',
      solution: '=(AVERAGE(C11:C24)/C4)/AVERAGE(B11:B24)',
      wrong: ['=AVERAGE(C11:C24)/AVERAGE(B11:B24)', '=(AVERAGE(B11:B24)/C4)/AVERAGE(C11:C24)', '=SUM(C11:C24)/(C4*(MAX(G11:G24)-G10))'],
      hints: ['It compares the work arriving with the capacity of c servers, from the inputs alone.', 'Average making time per maker, divided by the average gap between customers.'],
      explain: '(3:12.9 / 2) / 1:21.4 = 1.18. Above 1, the customers bring more work than two makers can handle, so in the long run the queue keeps growing.',
    },
    {
      id: 'table',
      kind: 'tool',
      tool: 'datatable',
      cells: 'I4:J7',
      prompt:
        'Select H3:J7 and use What-If Analysis > Data Table with Column input cell C4, to see the average wait and the share within target for 1 to 4 drink makers.',
      toolSetup: { range: 'H3:J7', colInput: 'C4' },
      answer: {
        I4: 0.008796296296296297, I5: 0.0018229166666666667, I6: 0.0002686838624338624, I7: 0.000037202380952380956,
        J4: 0.21428571428571427, J5: 0.5, J6: 1, J7: 1,
      },
      check: { tol: 1e-6 },
      hints: ['The makers 1-4 run down column H, so they replace C4: that is the Column input cell.', 'Leave the Row input cell empty; I3 and J3 already link to F3 and F4.'],
      explain:
        'One maker: average wait 12:40 and 21% within target; two: 2:38 and 50%; three: 0:23 and 100%; four: 0:03. The table re-runs the whole model for each value of C4.',
    },
    {
      id: 'staffing',
      kind: 'explain',
      cells: '',
      prompt: 'How many drink makers would you recommend, and why? Use the traffic intensity, the Data Table and the utilisation.',
      answer:
        'Three. With two makers this sample averages 2:38, but the traffic intensity is 1.18 (> 1): drinks are ordered faster than two makers can make them, so on a longer afternoon the queue keeps growing, ' +
        'and only half the customers are served within 3:00. Three makers bring the traffic intensity to 0.79, the average wait to about 0:23 and everyone within target, while still keeping them busy about 68% of the time. ' +
        'A fourth maker saves only about 20 more seconds and drops utilisation to about 51%.',
    },
  ],
  testCases: [
    { name: 'opening at 14:30 with a 2:00 target', inputs: { C3: t(14, 30), C5: t(0, 2) } },
    { name: 'three drink makers', inputs: { C4: 3 } },
    { name: 'only one drink maker', inputs: { C4: 1 } },
    { name: 'customers come 50 s further apart', inputs: inputsDown('B', 11, KIOSK_IA.map((s) => sec(s + 50))) },
    { name: 'the last order is a quick 1:00 drink', inputs: { C24: sec(60) } },
  ],
  skills: ['arrival chain', 'COUNTIF system length', 'c-server start with LARGE', 'average wait and share within target', 'utilisation and traffic intensity with c servers', 'Data Table over the number of servers'],
  techniques: [
    'Multi-server queue (COUNTIF system length + LARGE c-th end time)',
    'Queue performance measures (weighted wait, % within threshold, utilisation)',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
    'Absolute/mixed references so formulas fill down/right',
  ],
}

const REPAIR_IA = [195, 185, 60, 25, 185, 185, 80, 175, 35, 25, 165, 20]
const REPAIR_SV = [480, 590, 320, 580, 330, 430, 540, 560, 470, 400, 260, 420]

const balkRenege: Exercise = {
  id: 'w6-repair-balk-renege',
  week: 'W6',
  topic: 'Balking, reneging and BR-M',
  title: 'Phone-repair counter with balking and reneging (BR-M)',
  level: 3,
  minutes: 30,
  scenario:
    'An express phone-repair counter in a Jurong mall opens at C3 with C4 technicians and one queue. A customer who finds more than C5 people inside leaves at once (balks); ' +
    'one who would wait longer than C6 joins but gives up after C6 (reneges). Arrivals (column D) are given. Build the BR-M chain, report the balk and renege proportions and the average wait, ' +
    'then see how the BR and BR-2 end-time rules change who balks.',
  sheet: {
    rows: 24,
    cols: 10,
    cells: {
      A1: title('Repair counter: balking and reneging'),
      A3: label('Opening time'), C3: input(t(11), 'h:mm'),
      A4: label('Technicians (c)'), C4: input(2, '0'),
      A5: { v: 'Balk limit', role: 'label', note: 'More than this many in the system on arrival: the customer leaves at once.' }, C5: input(3, '0'),
      A6: { v: 'Renege limit', role: 'label', note: 'A customer whose wait would be longer than this joins, then gives up after this long.' }, C6: input(t(0, 8), DUR),
      E3: label('Balk proportion'), F3: answer(PCT),
      E4: label('Renege proportion'), F4: answer(PCT),
      E5: label('Average wait (BR-M)'), F5: answer(DUR),
      E7: label('Balk prop. (BR)'), F7: answer(PCT),
      E8: label('Balk prop. (BR-2)'), F8: answer(PCT),
      A10: header('Customer'), B10: header('Inter-arrival'), C10: header('Repair time'), D10: header('Arrival'), E10: header('In system (L)'),
      F10: header('Potential start'), G10: header('Potential wait'), H10: header('Start'), I10: header('End (BR-M)'), J10: header('Wait'),
      A11: given(0), D11: givenF('=I11', CLOCK), I11: givenF('=C3', CLOCK),
      ...down('A', 12, REPAIR_IA.map((_, i) => given(i + 1))),
      ...down('B', 12, REPAIR_IA.map((s) => input(sec(s), DUR))),
      ...down('C', 12, REPAIR_SV.map((s) => input(sec(s), DUR))),
      ...down('D', 12, REPAIR_IA.map((_, i) => givenF(`=D${11 + i}+B${12 + i}`, CLOCK))),
      ...block('E', 12, 12, answer('0')),
      ...block('F', 12, 12, answer(CLOCK)),
      ...block('G', 12, 12, answer(DUR)),
      ...block('H', 12, 12, answer(CLOCK)),
      ...block('I', 12, 12, answer(CLOCK)),
      ...block('J', 12, 12, answer(DUR)),
    },
    colWidths: { A: 120, B: 100, C: 90, D: 80, E: 150, F: 100, G: 100, H: 75, I: 85, J: 70 },
  },
  tasks: [
    {
      id: 'inSystem',
      kind: 'formula',
      cells: 'E12:E23',
      prompt: 'E12:E23: system length L at each arrival: `COUNTIF` the earlier end times (column I) later than the arrival.',
      solution: '=COUNTIF($I$11:I11,">"&D12)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(I11:I11,">"&D12)', '=COUNTIF($I$11:I11,">D12")', '=COUNTIF($H$11:H11,">"&D12)'],
      hints: ['Same expanding-range COUNTIF as the plain c-server model, over column I.', 'COUNTIF skips the "" of customers who balked.'],
      explain: 'L is read from the end times in column I, so how I is defined decides who balks later.',
    },
    {
      id: 'potStart',
      kind: 'formula',
      cells: 'F12:F23',
      prompt: 'F12:F23: potential start. "" if L is over the balk limit (C5); otherwise the c-server rule: the arrival if L < c, else the c-th largest earlier end time (`LARGE` over column I).',
      solution: '=IF(E12>$C$5,"",IF(E12>=$C$4,LARGE($I$11:I11,$C$4),D12))',
      check: { mustUse: ['LARGE'] },
      wrong: [
        '=IF(E12>=$C$5,"",IF(E12>=$C$4,LARGE($I$11:I11,$C$4),D12))',
        '=IF(E12>$C$5,"",IF(E12>=$C$4,LARGE($I$11:I11,1),D12))',
        '=IF(E12>$C$5,"",IF(E12>$C$4,LARGE($I$11:I11,$C$4),D12))',
        '=IF(E12>=$C$4,LARGE($I$11:I11,$C$4),D12)',
        '=IF(E12>C5,"",IF(E12>=C4,LARGE($I$11:I11,C4),D12))',
      ],
      hints: ['Test the balk first: more than C5 inside means leave, and "" marks "did not happen".', 'Then the c-server rule from the plain model, with LARGE over column I.'],
      explain:
        'Customer 4 finds L = 3, which is not more than the limit of 3, so they join. Customers 5, 7, 11 and 12 find 4 inside and balk. Use > for "more than": >= would turn customer 4 away.',
    },
    {
      id: 'potWait',
      kind: 'formula',
      cells: 'G12:G23',
      prompt: 'G12:G23: potential wait (potential start - arrival), or "" for a customer who balked: test F12="" with `IF` before subtracting, as the slides do.',
      solution: '=IF(F12="","",F12-D12)',
      check: { mustUse: ['IF'] },
      wrong: ['=F12-D12', '=IF(F12="","",D12-F12)', '=IF(F12="","",F12-$D$12)'],
      hints: ['The wait the customer would face if they stayed: potential start - arrival.', 'Guard against the "" left by balkers before subtracting: IF(F12="","",...).'],
      explain: 'Without the guard, a balker\'s "" - D12 is #VALUE! in Excel. The wait the customer would face decides whether they renege.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'H12:H23',
      prompt: 'H12:H23: actual start: "" for a balker, "" for a customer whose potential wait exceeds the renege limit C6, otherwise the potential start.',
      solution: '=IF(F12="","",IF(G12>$C$6,"",F12))',
      wrong: ['=IF(F12="","",IF(G12>$C$6,F12,""))', '=IF(F12="","",IF(G12>$C$6,"",D12))', '=IF(F12="","",IF(G12>C6,"",F12))'],
      hints: ['Two IFs: balked? then reneged?', 'A reneger never starts service, so their start is "".'],
      explain: 'Customers 4 (8:25) and 10 (8:20) would wait more than 8:00, so they renege and get no start time.',
    },
    {
      id: 'end',
      kind: 'formula',
      cells: 'I12:I23',
      prompt: 'I12:I23: end time with the BR-M rule: "" for a balker; arrival + renege limit for a reneger (the moment they give up); otherwise start + repair time.',
      solution: '=IF(F12="","",IF(G12>$C$6,D12+$C$6,H12+C12))',
      wrong: ['=IF(F12="","",F12+C12)', '=IF(H12="","",H12+C12)', '=IF(G12>$C$6,D12+$C$6,H12+C12)', '=IF(F12="","",IF(G12>$C$6,F12+$C$6,H12+C12))'],
      hints: [
        'A reneger stands in the queue from arrival until the renege limit runs out, then leaves.',
        'Keep the outer IF(F12="",...): in Excel "" counts as larger than any number, so a balker would pass the G12>$C$6 test and get a fake end time.',
      ],
      explain:
        'BR-M keeps a reneger in the system for exactly the 8 minutes they waited (customer 4 leaves at 11:15:45), so later arrivals count them in L for that long and no longer.',
    },
    {
      id: 'wait',
      kind: 'formula',
      cells: 'J12:J23',
      prompt: 'J12:J23: wait (BR-M): "" for a balker, the renege limit for a reneger, otherwise start - arrival.',
      solution: '=IF(F12="","",IF(H12="",$C$6,H12-D12))',
      wrong: ['=IF(F12="","",G12)', '=IF(H12="","",H12-D12)', '=IF(F12="","",IF(H12="",0,H12-D12))'],
      hints: ['Three cases: balked (""), reneged, or served.', 'A reneger really waited, for exactly the renege limit; a served customer waited start - arrival.'],
      explain: 'Renegers count 8:00 each; leaving them out (BR) or using their 8:25 potential wait misstates the experience in the queue.',
    },
    {
      id: 'balk',
      kind: 'formula',
      cells: 'F3',
      prompt: 'F3: balk proportion = (arrivals - customers who joined) / arrivals. Count with `COUNT`, which skips "".',
      solution: '=(COUNT(D12:D23)-COUNT(F12:F23))/COUNT(D12:D23)',
      check: { mustUse: ['COUNT'] },
      wrong: ['=COUNT(F12:F23)/COUNT(D12:D23)', '=(COUNT(D12:D23)-COUNT(H12:H23))/COUNT(D12:D23)'],
      hints: ['Everyone has an arrival time; only those who joined have a potential start.', '`COUNT` counts numbers only, so the "" cells drop out.'],
      explain: '4 of 12 arrivals balked: 33.3%.',
    },
    {
      id: 'renege',
      kind: 'formula',
      cells: 'F4',
      prompt: 'F4: renege proportion = (customers who joined - customers who started service) / customers who joined. Count with `COUNT`.',
      solution: '=(COUNT(F12:F23)-COUNT(H12:H23))/COUNT(F12:F23)',
      check: { mustUse: ['COUNT'] },
      wrong: ['=(COUNT(F12:F23)-COUNT(H12:H23))/COUNT(D12:D23)', '=COUNT(H12:H23)/COUNT(F12:F23)'],
      hints: ['A reneger joined (has a potential start) but never started (no start time).', 'Divide by those who joined, not by all arrivals.'],
      explain: '2 of the 8 who joined reneged: 25%.',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'F5',
      prompt: 'F5: average wait (column J) of the customers who joined.',
      solution: '=AVERAGE(J12:J23)',
      wrong: ['=AVERAGE(G12:G23)', '=SUM(J12:J23)/COUNT(D12:D23)'],
      hints: ['Column J holds the BR-M waits.', 'AVERAGE skips the "" of balkers, which is what you want.'],
      explain: 'About 3:21 over the 8 who joined. Dividing by all 12 arrivals would treat balkers as zero waits.',
    },
    {
      id: 'brBalk',
      kind: 'value',
      cells: 'F7',
      prompt:
        'Change I12 to the original BR rule =IF(F12="","",F12+C12) and fill it down to I23. Note the balk proportion F3 now shows, press Undo twice to get your BR-M formulas back, then type that proportion into F7 (as a decimal or a %).',
      answer: 5 / 12,
      check: { tol: 0.005 },
      wrong: ['0.3333', '0.1667'],
      hints: ['L reads column I, so changing how I is defined changes who balks.', 'F3 recalculates as soon as column I changes; read it before you undo.'],
      explain: 'BR: 5 of 12 balk (41.7%). Renegers keep a fake end time F + C (potential start + repair time), as if they had been repaired, so they inflate L and turn customer 10 away too.',
    },
    {
      id: 'br2Balk',
      kind: 'value',
      cells: 'F8',
      prompt: 'Do the same with the BR-2 rule =IF(H12="","",H12+C12): note F3, Undo back to BR-M, and type the balk proportion into F8.',
      answer: 2 / 12,
      check: { tol: 0.005 },
      wrong: ['0.3333', '0.4167'],
      hints: ['Under BR-2 a reneger has no end time at all.', 'Fewer end times in column I means smaller L values for the customers who arrive later.'],
      explain: 'BR-2: only 2 of 12 balk (16.7%). Renegers vanish from L at once, although they stood in the queue for 8 minutes, so too many later customers join.',
    },
    {
      id: 'whyBrm',
      kind: 'explain',
      cells: '',
      prompt: 'Why is BR-M the better definition of the end time? Refer to your BR and BR-2 results.',
      answer:
        'L counts earlier customers whose end time in column I is later than the new arrival, so the end-time rule decides who balks. BR gives a reneger the end time F + C (potential start + repair time) as if they had been served, ' +
        'so they stay in L too long and 5 of 12 balk. BR-2 gives renegers no end time, so they drop out of L at once although they were still queueing, and only 2 balk. ' +
        'BR-M ends a reneger at arrival + renege limit, the moment they really leave, so L is right and 4 of 12 balk. (Renegers still feed LARGE in column F although they never use a technician: the BR-M-Again refinement.)',
    },
  ],
  testCases: [
    { name: 'the balk limit rises to 4', inputs: { C5: 4 } },
    { name: 'the renege limit falls to 6:00', inputs: { C6: t(0, 6) } },
    { name: 'a third technician joins', inputs: { C4: 3 } },
    { name: 'only one technician turns up', inputs: { C4: 1 } },
    {
      name: 'customers come 30 s further apart and every repair takes a minute less',
      inputs: { ...inputsDown('B', 12, REPAIR_IA.map((s) => sec(s + 30))), ...inputsDown('C', 12, REPAIR_SV.map((s) => sec(s - 60))) },
    },
  ],
  skills: ['balking with a system-length limit', 'reneging with a wait limit', '"" for events that did not happen', 'BR, BR-2 and BR-M end times', 'balk and renege proportions with COUNT'],
  techniques: [
    'Multi-server queue (COUNTIF system length + LARGE c-th end time)',
    'Queue performance measures (weighted wait, % within threshold, utilisation)',
    'Written interpretation of model results',
  ],
}

const RUNS = 50

const kioskReplications: Exercise = {
  id: 'w6-kiosk-replications',
  week: 'W6',
  topic: 'Replicating a random queue',
  title: 'Self-service kiosk: replicate the average wait with a Data Table',
  level: 3,
  minutes: 25,
  scenario:
    'A single self-service ticket kiosk opens at C3. The vendor quotes the means in plain minutes: gaps between customers are exponential with mean C4 minutes and service times exponential with mean C5 minutes. ' +
    'Simulate 20 customers, then replicate the average wait 50 times with a two-way Data Table for the current software (2 minutes per customer) and two faster versions (1.75 and 1.5 minutes).',
  sheet: {
    rows: 62,
    cols: 12,
    cells: {
      A1: title('Self-service kiosk: one server, random times'),
      A3: label('Opening time'), C3: input(t(8), 'h:mm'),
      A4: label('Mean inter-arrival (minutes)'), C4: input(2.5, '0.00'),
      A5: label('Mean service time (minutes)'), C5: input(2, '0.00'),
      A7: label('Average wait (this run)'), C7: answer(DUR),
      E3: label('Blank cell for the runs:'), G3: { note: 'Leave blank: Column input cell of the replication table.' },
      E5: { v: 'Wait at average times', role: 'label', note: 'Every gap exactly C4 minutes and every service exactly C5 minutes.' }, G5: answer(DUR),
      A9: header('Customer'), B9: header('Inter-arrival'), C9: header('Service'), D9: header('Arrival'), E9: header('Start'), F9: header('End'), G9: header('Wait'),
      A10: given(0), D10: givenF('=F10', CLOCK), F10: givenF('=C3', CLOCK),
      ...down('A', 11, Array.from({ length: 20 }, (_, i) => given(i + 1))),
      ...block('B', 11, 20, answer(DUR)),
      ...block('C', 11, 20, answer(DUR)),
      ...block('D', 11, 20, answer(CLOCK)),
      ...block('E', 11, 20, answer(CLOCK)),
      ...block('F', 11, 20, answer(CLOCK)),
      ...block('G', 11, 20, answer(DUR)),
      I8: header('Run'), J8: header('Service (min)'),
      I9: givenF('=C7', DUR), J9: given(2, '0.00'), K9: given(1.75, '0.00'), L9: given(1.5, '0.00'),
      ...down('I', 10, Array.from({ length: RUNS }, (_, i) => given(i + 1))),
      ...block('J', 10, RUNS, answer(DUR)),
      ...block('K', 10, RUNS, answer(DUR)),
      ...block('L', 10, RUNS, answer(DUR)),
      I61: label('Average'), J61: answer(DUR), K61: answer(DUR), L61: answer(DUR),
    },
    colWidths: { A: 110, B: 100, C: 80, D: 80, E: 80, F: 80, G: 80, H: 24, I: 70, J: 90, K: 80, L: 80 },
    frozenRows: 9,
  },
  tasks: [
    {
      id: 'interArrival',
      kind: 'formula',
      cells: 'B11:B30',
      prompt: 'B11:B30: exponential inter-arrival times with mean C4 minutes, returned as time values. Use the inverse of the exponential with `LN` and `RAND`, and convert the minutes to a fraction of a day.',
      solution: '=-$C$4/1440*LN(RAND())',
      // 2,000 draws (20 cells x 100 trials) of an exponential with sd 150 s: SE 3.4 s, so tol 16 s is 4.8 SE, and the
      // C5 mix-up (mean 120 s, 30 s away) still fails by over 5 SE of its own sample
      random: { trials: 100, stat: 'mean', target: sec(150), tol: sec(16) },
      check: { mustUse: ['LN', 'RAND'] },
      wrong: ['=-$C$4*LN(RAND())', '=$C$4/1440*LN(RAND())', '=-C4/1440*LN(RAND())', '=$C$4/1440*RAND()', '=-$C$5/1440*LN(RAND())', '=-$C$4/60*LN(RAND())'],
      hints: [
        'C4 is a plain number of minutes; the queue columns are clock times, so convert it to a fraction of a day first.',
        'LN of a number between 0 and 1 is negative: the minus sign makes the time positive.',
        'Anchor C4 ($C$4 or C$4) so every row uses the same mean. A circular reference in B14 means C4 slid down to C7 as you filled: anchor C4, do not switch on iteration.',
      ],
      explain:
        'C4/1440 turns 2.5 minutes into 0.001736 of a day, and -mean x LN(RAND()) is the inverse of the exponential: it averages 2:30 but is often short and sometimes very long, which is what builds queues. ' +
        'Without /1440 every gap is about 2.5 DAYS. When the mean is already stored as a time (2:30 formatted m:ss, as in the slides\' queue model), drop the /1440.',
    },
    {
      id: 'service',
      kind: 'formula',
      cells: 'C11:C30',
      prompt: 'C11:C30: exponential service times with mean C5 minutes, as time values (`LN` and `RAND`, as in column B).',
      solution: '=-$C$5/1440*LN(RAND())',
      // 2,000 draws with sd 120 s: SE 2.7 s, tol 13 s is 4.8 SE; the C4 mix-up (mean 150 s) fails by 5 SE of its sample
      random: { trials: 100, stat: 'mean', target: sec(120), tol: sec(13) },
      check: { mustUse: ['LN', 'RAND'] },
      wrong: ['=-$C$4/1440*LN(RAND())', '=-$C$5*LN(RAND())', '=-$C$5/1440*LN(1/RAND())', '=-C5/1440*LN(RAND())'],
      hints: [
        'Same generator as column B, with the mean service time.',
        'Refer to C5 rather than typing 2: the Data Table will swap other means into C5.',
        'Anchor C5 ($C$5 or C$5): a circular reference in C13 means C5 slid down to C7 as you filled.',
      ],
      explain: 'C5 is the row input of the Data Table, so the table can swap in the faster service means; a typed 2 would ignore them.',
    },
    {
      id: 'arrival',
      kind: 'formula',
      cells: 'D11:D30',
      prompt: 'D11:D30: arrival clock times.',
      solution: '=D10+B11',
      wrong: ['=$D$10+B11', '=D10+C11'],
      hints: ['Previous arrival + inter-arrival.', 'Row 10 is customer 0, who "arrives" and leaves at the opening time.'],
      explain: 'Row 10 is customer 0, so the same formula works from the first customer on.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'E11:E30',
      prompt: 'E11:E30: service start (one kiosk).',
      solution: '=MAX(D11,F10)',
      wrong: ['=MAX(D11,E10)', '=D11'],
      hints: ['A customer needs to be there and the kiosk needs to be free.', 'The later of the arrival and the previous end.'],
      explain: 'One server: start = MAX(arrival, previous end). The previous START (E10) ignores how long the previous customer took.',
    },
    {
      id: 'end',
      kind: 'formula',
      cells: 'F11:F30',
      prompt: 'F11:F30: end times.',
      solution: '=E11+C11',
      wrong: ['=D11+C11', '=E11+B11'],
      hints: ['When does the kiosk finish with this customer?', 'Start + service.'],
      explain: 'End = start + service time; the next row compares its arrival with it.',
    },
    {
      id: 'wait',
      kind: 'formula',
      cells: 'G11:G30',
      prompt: 'G11:G30: waits.',
      solution: '=E11-D11',
      wrong: ['=F11-D11', '=D11-E11'],
      hints: ['How long between arriving and being served?', 'Start - arrival (a clock time minus a clock time is a duration).'],
      explain: 'Wait = start - arrival. End - arrival would add the service time.',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'C7',
      prompt: 'C7: average wait of this run (press F9 to see it jump around).',
      solution: '=AVERAGE(G11:G30)',
      wrong: ['=AVERAGE(G11:G29)', '=MAX(G11:G30)'],
      hints: ['One number for this run.', 'Average all 20 waits, zeros included.'],
      explain: 'One run of 20 customers is a single noisy observation: that is why it has to be replicated.',
    },
    {
      id: 'flaw',
      kind: 'value',
      cells: 'G5',
      prompt: 'Without simulating: if every customer arrived exactly C4 minutes apart and every service took exactly C5 minutes, what would the average wait be? Type it in G5.',
      answer: 0,
      check: { tol: sec(1) },
      wrong: ['0:00:30', '0:03:27'],
      hints: ['Trace two customers: when does the first one leave, and when does the second arrive?', 'Each customer arrives 2.5 minutes after the previous one, who needed only 2.'],
      explain: 'Zero: with average inputs nobody ever waits. The waits come from the variability, so plugging averages into the model badly understates them; replicate the whole model instead.',
    },
    {
      id: 'runs',
      kind: 'tool',
      tool: 'datatable',
      cells: 'J10:L59',
      prompt:
        'Select I9:L59 and open What-If Analysis > Data Table: Row input cell C5 (the service means in J9:L9), Column input cell G3 (a blank cell, so each row is just a fresh run).',
      toolSetup: { range: 'I9:L59', rowInput: 'C5', colInput: 'G3' },
      random: { trials: 4, stat: 'mean', target: sec(149.6), tol: sec(30) },
      hints: [
        'I9 holds =C7, the output to replicate, in the top-left corner.',
        'The values across the top go into the Row input cell; the run numbers down the side go into the Column input cell.',
        'Each substitution recalculates RAND, so a blank column input cell turns every row into an independent run.',
      ],
      explain:
        'Each cell is the average wait of one fresh 20-customer run with that service mean. Averaged over all three columns the runs come to about 2:30 for this kiosk; press F9 for a new set of runs.',
    },
    {
      id: 'runAvg',
      kind: 'formula',
      cells: 'J61:L61',
      prompt: 'J61:L61: the average of each column of runs (one formula filled right).',
      solution: '=AVERAGE(J10:J59)',
      wrong: ['=AVERAGE(J10:J58)', '=AVERAGE($J$10:$J$59)'],
      hints: ['Average the 50 runs of the first column.', 'Use relative references, so filling right moves to the next column.'],
      explain: 'The long-run averages for this kiosk are about 3:27, 2:25 and 1:37; your 50 runs land near them, a little differently after every F9.',
    },
    {
      id: 'interpret',
      kind: 'explain',
      cells: '',
      prompt: 'What does a faster kiosk buy, and why do you need 50 runs rather than one?',
      answer:
        'Cutting the mean service time from 2 to 1.75 and 1.5 minutes lowers the average wait from about 3:27 to about 2:25 and 1:37: the traffic intensity falls from 0.80 to 0.70 and 0.60, ' +
        'and the wait shrinks much faster than the service time. A single run of 20 customers is very noisy (with the current software single runs average anything from under half a minute to over 10 minutes), ' +
        'so only the average of many runs is a reliable estimate, and even that average moves a little with every F9. Plugging the average gap and service time into the model gives no wait at all, ' +
        'so the randomness itself must be simulated and replicated.',
    },
  ],
  testCases: [
    { name: 'the kiosk opens at 9:00', inputs: { C3: t(9) } },
    { name: 'customers arrive every 3 minutes on average', inputs: { C4: 3 } },
    { name: 'the kiosk slows to 3 minutes per customer', inputs: { C5: 3 } },
  ],
  skills: ['exponential times with -mean*LN(RAND())', 'minutes to day fractions (/1440)', 'single-server queue', 'two-way Data Table with a blank column input', 'averaging replications', 'flaw of averages'],
  techniques: [
    'Exponential inter-arrival times (-mean*LN(RAND()))',
    'Data Table for Monte Carlo replications (blank input cell)',
    'Time arithmetic (durations, x24, /1440, /86400)',
    'Unit conversion (MB to GB, seconds/minutes to day fractions)',
    'Replicate the full output (E[f(X)] is not f(E[X]))',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
  ],
}

// 15 logged wash times in seconds, in log order across E3:I5 (6:20 to 13:00, average 9:12)
const WASH_LOG = [520, 380, 630, 550, 470, 705, 495, 425, 780, 570, 535, 600, 450, 660, 510]
const LOG_CELLS = WASH_LOG.map((_, i) => `${'EFGHI'[i % 5]}${3 + Math.floor(i / 5)}`)
const WASH_RUNS = 25
const RUN_LAST = 9 + WASH_RUNS
const AVG_ROW = RUN_LAST + 2
const CARS = Array.from({ length: 20 }, (_, i) => 11 + i)
const DUR_H = '[h]:mm:ss'

const carWashBays: Exercise = {
  id: 'w6-carwash-resample-bays',
  week: 'W6',
  topic: 'Random c-server queue and replications',
  title: 'Car-wash bays: resample the log, then replicate 1 to 4 bays',
  level: 3,
  minutes: 30,
  scenario:
    'A drive-through car wash at a Woodlands petrol station opens at C3 with C5 wash bays fed by one queue. On Saturday mornings a car arrives on average every C4 ' +
    '(exponential gaps; C4 is a time value). Instead of assuming a distribution for the wash times, the owner logged 15 real washes (E3:I5): resample them with PERCENTILE, ' +
    'the way the slides\' c-server model resamples its data. Arrival, End and Wait (columns D, G and H) are already set up. ' +
    `Simulate 20 cars, replicate the average wait ${WASH_RUNS} times for 1 to 4 bays, and recommend how many bays to open.`,
  sheet: {
    rows: AVG_ROW,
    cols: 15,
    seed: 40,
    cells: {
      A1: title('Car wash: c bays, one queue, resampled wash times'),
      A3: label('Opening time'), C3: input(t(9), 'h:mm'),
      A4: label('Mean gap between cars'), C4: input(t(0, 5), 'm:ss'),
      A5: label('Wash bays (c)'), C5: input(2, '0'),
      A6: label('Traffic intensity'), C6: answer('0.00'),
      A7: label('Average wait (this run)'), C7: answer(DUR_H),
      E2: label('Logged wash times (m:ss)'),
      ...Object.fromEntries(LOG_CELLS.map((ref, i) => [ref, input(sec(WASH_LOG[i]), 'm:ss')])),
      K3: label('Blank cell for the runs:'), N3: { note: 'Leave blank: the Column input cell of the replication table.' },
      A9: header('Car'), B9: header('Gap'), C9: header('Wash time'), D9: header('Arrival'), E9: header('In system'), F9: header('Start'), G9: header('End'), H9: header('Wait'),
      A10: given(0), D10: givenF('=G10', CLOCK), G10: givenF('=C3', CLOCK),
      ...down('A', 11, CARS.map((_, i) => given(i + 1))),
      ...block('B', 11, 20, answer(DUR)),
      ...block('C', 11, 20, answer(DUR)),
      ...down('D', 11, CARS.map((r) => givenF(`=D${r - 1}+B${r}`, CLOCK))),
      ...block('E', 11, 20, answer('0')),
      ...block('F', 11, 20, answer(CLOCK)),
      ...down('G', 11, CARS.map((r) => givenF(`=F${r}+C${r}`, CLOCK))),
      ...down('H', 11, CARS.map((r) => givenF(`=IF(F${r}="","",F${r}-D${r})`, DUR_H))),
      K8: header('Run'), L8: header('Bays open'),
      K9: givenF('=C7', DUR_H), L9: given(1, '0'), M9: given(2, '0'), N9: given(3, '0'), O9: given(4, '0'),
      ...down('K', 10, Array.from({ length: WASH_RUNS }, (_, i) => given(i + 1))),
      ...block('L', 10, WASH_RUNS, answer(DUR_H)),
      ...block('M', 10, WASH_RUNS, answer(DUR_H)),
      ...block('N', 10, WASH_RUNS, answer(DUR_H)),
      ...block('O', 10, WASH_RUNS, answer(DUR_H)),
      [`K${AVG_ROW}`]: label('Average'),
      ...Object.fromEntries(['L', 'M', 'N', 'O'].map((c) => [`${c}${AVG_ROW}`, answer(DUR_H)])),
    },
    colWidths: { A: 160, B: 70, C: 80, D: 80, E: 75, F: 80, G: 80, H: 80, I: 70, J: 24, K: 70, L: 80, M: 80, N: 80, O: 80 },
    frozenRows: 9,
  },
  tasks: [
    {
      id: 'gap',
      kind: 'formula',
      cells: 'B11:B30',
      prompt:
        'B11:B30: exponential gaps between cars with mean C4. C4 is already a time value (5:00 is 0.00347 of a day), so the result is a time too. ' +
        'Use the inverse of the exponential with `LN` and `RAND`.',
      solution: '=-$C$4*LN(RAND())',
      // 2,000 draws (20 cells x 100 trials) with sd 300 s: SE 6.7 s, so tol 32 s is 4.8 SE
      random: { trials: 100, stat: 'mean', target: sec(300), tol: sec(32) },
      check: { mustUse: ['LN', 'RAND'] },
      wrong: ['=-$C$4/1440*LN(RAND())', '=$C$4*LN(RAND())', '=-$C$4*RAND()', '=-C4*LN(RAND())', '=-$C$4*24*LN(RAND())'],
      hints: [
        '-mean * LN(RAND()) turns a uniform random number into an exponential time with that mean.',
        'C4 holds 5:00 as a fraction of a day already: no /1440 or /24 this time.',
        'Anchor C4 ($C$4) so every row uses the same mean. A circular reference in B14 means C4 slid down to C7 as you filled: anchor C4, do not switch on iteration.',
      ],
      explain:
        'C4 is stored as 0.00347 of a day, so -$C$4*LN(RAND()) is already a time that averages 5:00. Dividing by 1440 again (as you must when the mean is a plain number of minutes) ' +
        'would make every gap about 0.2 seconds. LN(1-RAND()) works just as well.',
    },
    {
      id: 'wash',
      kind: 'formula',
      cells: 'C11:C30',
      prompt: 'C11:C30: wash times resampled from the 15 logged washes in E3:I5, with `PERCENTILE` at a random percentile drawn by `RAND`.',
      solution: '=PERCENTILE($E$3:$I$5,RAND())',
      // 2,000 draws with sd 93 s: SE 2.1 s, tol 12 s is 5.8 SE; PERCENTILE(...,RANDBETWEEN(0,1)) averages 9:40, 30 s away
      random: { trials: 100, stat: 'mean', target: sec(550), tol: sec(12) },
      check: { mustUse: ['PERCENTILE', 'RAND'] },
      wrong: [
        '=PERCENTILE($E$3:$I$5,RANDBETWEEN(0,1))',
        '=PERCENTILE($E$3:$I$5,0.5)',
        '=PERCENTILE(E3:I5,RAND())',
        '=PERCENTILE($E$3:$I$5,RAND()*100)',
        '=AVERAGE($E$3:$I$5)',
      ],
      hints: [
        '`PERCENTILE`(data, k) returns the value below which a fraction k of the data lies; k must be between 0 and 1.',
        'A random k from RAND() picks a random point of the logged distribution, between the shortest and the longest wash.',
        'Anchor the whole log ($E$3:$I$5) so it does not slide as you fill down; #NUM! a few rows down means the range slid off the log.',
      ],
      explain:
        'PERCENTILE($E$3:$I$5,RAND()) resamples the log: every draw lies between 6:20 and 13:00 and the draws follow the shape of the 15 real washes, with no distribution assumed. ' +
        'Without $ the range slides down into other cells, and RAND()*100 gives #NUM! because k must be at most 1.',
    },
    {
      id: 'traffic',
      kind: 'formula',
      cells: 'C6',
      prompt: 'C6: traffic intensity = (average logged wash time / C5 bays) / mean gap C4.',
      solution: '=(AVERAGE(E3:I5)/C5)/C4',
      wrong: ['=AVERAGE(E3:I5)/C4', '=(C4/C5)/AVERAGE(E3:I5)', '=(AVERAGE(E3:I5)/2)/C4'],
      hints: ['It compares the work arriving with what c bays can do, using the inputs only.', 'Average wash per bay, divided by the average gap between cars.'],
      explain:
        'With 2 bays: (9:12 / 2) / 5:00 = 0.92, close to 1, so queues build easily. One bay gives 1.84 (the queue keeps growing), three bays 0.61 and four bays 0.46.',
    },
    {
      id: 'inSystem',
      kind: 'formula',
      cells: 'E11:E30',
      prompt: 'E11:E30: cars still at the wash (queueing or being washed) when this car arrives: `COUNTIF` the earlier end times that are later than the arrival.',
      solution: '=COUNTIF($G$10:G10,">"&D11)',
      check: { mustUse: ['COUNTIF'] },
      wrong: ['=COUNTIF(G10:G10,">"&D11)', '=COUNTIF($G$10:G10,">D11")', '=COUNTIF($G$10:G10,"<"&D11)'],
      hints: ['Same expanding-range COUNTIF as in the fixed-data models.', 'Start the range at the anchored $G$10 and end it one row above: $G$10:G10.'],
      explain: 'The count changes on every F9 because the gaps and washes do; the formula stays the same.',
    },
    {
      id: 'start',
      kind: 'formula',
      cells: 'F11:F30',
      prompt: 'F11:F30: wash start with C5 bays: the arrival if fewer than C5 cars are in the system, otherwise the C5-th largest earlier end time (`LARGE`).',
      solution: '=IF(E11<$C$5,D11,LARGE($G$10:G10,$C$5))',
      check: { mustUse: ['LARGE'] },
      wrong: [
        '=MAX(D11,G10)',
        '=IF(E11<$C$5,D11,LARGE($G$10:G10,1))',
        '=IF(E11<=$C$5,D11,LARGE($G$10:G10,$C$5))',
        '=IF(E11<2,D11,LARGE($G$10:G10,2))',
        '=MAX(D11,LARGE($G$10:G10,$C$5))',
      ],
      hints: [
        'Fewer cars inside than bays: a bay is free, so the wash starts on arrival.',
        'All bays busy: the earliest of the c latest end times is when a bay frees up, LARGE(range, c), with c in $C$5 so the Data Table can change it.',
      ],
      explain:
        'Refer to $C$5, never a typed 2: the Data Table puts 1, 2, 3 and 4 into C5, and with a typed 2 every column would really be a 2-bay run.',
    },
    {
      id: 'avgWait',
      kind: 'formula',
      cells: 'C7',
      prompt: 'C7: average wait of the 20 cars in this run.',
      solution: '=AVERAGE(H11:H30)',
      wrong: ['=AVERAGE(H11:H29)', '=MAX(H11:H30)', '=SUM(H11:H30)/19'],
      hints: ['One number for this run: it is what the Data Table replicates.', 'All 20 waits, zeros included.'],
      explain: 'Press F9 a few times: with 2 bays this one number jumps from about a minute to over ten, which is why it has to be replicated.',
    },
    {
      id: 'runs',
      kind: 'tool',
      tool: 'datatable',
      cells: `L10:O${RUN_LAST}`,
      prompt:
        `K9:O${RUN_LAST}: replicate the average wait ${WASH_RUNS} times for 1, 2, 3 and 4 bays with a two-way Data Table. The bays across L9:O9 go into C5, ` +
        `and the run numbers down K10:K${RUN_LAST} go into the blank cell N3.`,
      toolSetup: { range: `K9:O${RUN_LAST}`, rowInput: 'C5', colInput: 'N3' },
      random: { trials: 3, stat: 'mean', target: sec(726), tol: sec(300) },
      hints: [
        `Select the whole block K9:O${RUN_LAST}: K9 already links to the output C7.`,
        'Values across the top go into the Row input cell (C5); values down the side go into the Column input cell (N3).',
        'N3 is blank on purpose: substituting the run number there changes nothing except that RAND redraws, so every row is a fresh run.',
      ],
      explain:
        'Each cell is the average wait of one fresh 20-car morning with that many bays. One bay is far worse than the rest, so the overall mean of the table (about 12 minutes) ' +
        'says little; compare the columns.',
    },
    {
      id: 'runAvg',
      kind: 'formula',
      cells: `L${AVG_ROW}:O${AVG_ROW}`,
      prompt: `L${AVG_ROW}:O${AVG_ROW}: the average of each column of ${WASH_RUNS} runs (one formula filled right).`,
      solution: `=AVERAGE(L10:L${RUN_LAST})`,
      wrong: [`=AVERAGE(L10:L${RUN_LAST - 1})`, `=AVERAGE($L$10:$L$${RUN_LAST})`, `=AVERAGE(L9:L${RUN_LAST})`],
      hints: [`Average the ${WASH_RUNS} runs under the 1 in L9, not the 1 itself.`, 'Relative references, so filling right moves to the next number of bays.'],
      explain:
        'The long-run averages are about 41 minutes, 5:50, 1:07 and 0:15 for 1 to 4 bays; your runs land near them and move a little with every F9. ' +
        'The [h]:mm:ss format matters here: a single run with one bay can pass an hour, which mm:ss would hide.',
    },
    {
      id: 'recommend',
      kind: 'explain',
      cells: '',
      prompt: 'How many bays should open on Saturday mornings? Use the column averages, how much single runs vary, and the traffic intensity for each number of bays.',
      answer:
        'Three bays. One bay cannot cope: the traffic intensity is 1.84, the queue grows all morning and cars wait about 41 minutes on average. ' +
        'Two bays (0.92) average about 6 minutes, but single mornings range from about 1:30 to 12 minutes, so many Saturdays feel slow. ' +
        'Three bays (0.61) cut the average wait to about a minute, and a fourth bay saves less than another minute while standing idle more than half the time. ' +
        'The decision rests on the column averages of many runs: one run in C7 is far too noisy.',
    },
  ],
  testCases: [
    { name: 'only one bay opens', inputs: { C5: 1 } },
    { name: 'a third bay opens', inputs: { C5: 3 } },
    { name: 'cars come every 4:00 on average', inputs: { C4: t(0, 4) } },
    { name: 'new brushes take 45 s off every logged wash', inputs: Object.fromEntries(LOG_CELLS.map((ref, i) => [ref, sec(WASH_LOG[i] - 45)])) },
  ],
  skills: [
    'exponential gaps with a time-valued mean (no unit conversion)',
    'resampling a log with PERCENTILE(data, RAND())',
    'c-server start with COUNTIF and LARGE on random times',
    'traffic intensity with c servers',
    'two-way Data Table: servers across, runs down (blank input cell)',
    'averaging replications and recommending a staffing level',
  ],
  techniques: [
    'Multi-server queue (COUNTIF system length + LARGE c-th end time)',
    'Data Table for Monte Carlo replications (blank input cell)',
    'Exponential inter-arrival times (-mean*LN(RAND()))',
    'What-if / scenario analysis by changing inputs',
    'Written interpretation of model results',
    'Absolute/mixed references so formulas fill down/right',
  ],
}

export const exercises: readonly Exercise[] = [
  timestampParts, durationConversions, countifTargets, nextFreeServer, textFormatCodes,
  ktvBilling, renewals, singleServer, queueScorecard,
  kioskStaffing, balkRenege, kioskReplications, carWashBays,
]
