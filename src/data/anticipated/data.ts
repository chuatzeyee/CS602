// Anticipated exam parts on data tools and cross-cutting formula skills: Advanced Filter criteria, PivotTables,
// conditional counts and totals (COUNTIF, SUMIF, SUMPRODUCT), $ anchoring, lookups with IFERROR, rounding,
// text labels, FORMULATEXT and table checks. Original scenarios; every formula is typed exactly as in the cell.
import type { AnticipatedQ } from './types'

// shared order list for the filter, pivot and helper-column parts
const ORDERS =
  'Fresh Fields Wholesale order list A8:K68: headers in row 8 (Order ID, Region, Channel, Order Date, Customer, Product, ' +
  'Category, Qty, Unit Price, Status, Revenue) and 60 orders in rows 9-68. Order ID A9:A68, Region B9:B68 (North, North-East, ' +
  'East, West, Central), Channel C9:C68 (Hawker, Restaurant, Supermarket, Online), Order Date D9:D68 (real Excel dates in 2026), ' +
  'Customer E9:E68, Product F9:F68, Category G9:G68 (Vegetables, Fruit, Herbs), Qty H9:H68 (cartons), Unit Price I9:I68 (S$), ' +
  'Status J9:J68 (Paid, Pending), Revenue K9:K68 (Qty x Unit Price). Rows 1-6 are free for criteria and answers; row 7 is blank.'

// shared delivery-job list for the conditional count and total parts
const JOBS =
  'Delivery job list A5:G45: headers in row 5 (Job ID, Zone, Vehicle, Distance, Fee, Rating, Comment) and 40 jobs in rows 6-45. ' +
  'Job ID A6:A45, Zone B6:B45 (North, South, East, West, Central), Vehicle C6:C45 (Bike, Van), Distance D6:D45 (km), ' +
  'Fee E6:E45 (S$), Rating F6:F45 (whole numbers 1 to 5, blank if the customer did not rate), Comment G6:G45 (text, blank if none).'

const NOT_TAUGHT = 'Alternative only: not taught in the course, use it as a check'

export const questions: readonly AnticipatedQ[] = [
  // ---------- filters (Advanced Filter, criteria ranges) ----------
  {
    id: 'data-filters-and-one-row',
    topic: 'filters',
    question: 'Fresh Fields wants every Supermarket order of at least 40 cartons. Set up the criteria in M1:N2 and use Advanced Filter to copy the matching orders, with their headers, to the area starting at M8.',
    layout: ORDERS,
    formulas: [
      { cell: 'M2', formula: '="=Supermarket"', note: 'Exact match on Channel; the cell displays =Supermarket' },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$N$2', 'Copy to: $M$8', 'Unique records only: not ticked'],
    steps: [
      'Copy the headers Channel (C8) and Qty (H8) into M1 and N1 so the spelling matches the list exactly.',
      'Put both conditions on row 2 (same row = AND): M2 ="=Supermarket", and N2 typed as the text >=40.',
      'Run Data > Advanced with the settings shown; the matching orders appear from M8 with their headers.',
    ],
    pitfalls: [
      '>40 drops the orders of exactly 40 cartons: "at least" means >=.',
      'A criteria range that runs on to an empty row 3 ($M$1:$N$3) lets every order through.',
      'Keep the area below M8 empty: the extract overwrites it.',
    ],
    answer: 'Report the criteria M1:N2 and the extract from M8. The number of rows copied must equal =SUMPRODUCT((C9:C68="Supermarket")*(H9:H68>=40)) on the original list.',
  },
  {
    id: 'data-filters-or-two-regions',
    topic: 'filters',
    question: 'Show only the Paid orders from the East or the West region. Write the criteria in M1:N3, filter the list in place, and count the same orders by formula in Q2.',
    layout: ORDERS,
    formulas: [
      { cell: 'M2', formula: '="=East"' },
      { cell: 'N2', formula: '="=Paid"', note: 'Plain Paid works too (no other status begins with Paid)' },
      { cell: 'M3', formula: '="=West"' },
      { cell: 'N3', formula: '="=Paid"', note: 'Repeat the Paid condition on every OR row' },
      { cell: 'Q2', formula: '=SUMPRODUCT(((B9:B68="East")+(B9:B68="West"))*(J9:J68="Paid"))', note: 'Adding the two Region tests gives OR; multiplying by the Status test gives AND' },
    ],
    tool: ['Data > Advanced', 'Action: Filter the list, in-place', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$N$3'],
    steps: [
      'Headers: M1 Region and N1 Status, copied from B8 and J8.',
      'Row 2 = East AND Paid, row 3 = West AND Paid: each extra row is an OR alternative.',
      'Run Data > Advanced in place; the status bar shows how many records were found, which must equal Q2.',
      'Data > Clear brings back all 60 rows.',
    ],
    pitfalls: [
      'Paid written only on row 2 lets row 3 keep every West order, Pending ones included.',
      'East and West on one row (Region header twice) asks for both at once and returns nothing.',
      'An empty row 4 inside the criteria range shows every order.',
    ],
    answer: 'Report M1:N3 and Q2; the number of records found by the filter equals Q2.',
  },
  {
    id: 'data-filters-exact-north',
    topic: 'filters',
    question: 'The Region column holds North, North-East and other regions. Filter the list in place to show only the orders whose Region is exactly North, with the criteria in M1:M2, and give their number in Q2 by formula.',
    layout: ORDERS,
    formulas: [
      { cell: 'M2', formula: '="=North"', note: 'Displays =North: an exact match, so North-East is left out' },
      { cell: 'Q2', formula: '=COUNTIF(B9:B68,"North")', note: 'COUNTIF without wildcards matches the whole cell, so it also leaves out North-East' },
    ],
    tool: ['Data > Advanced', 'Action: Filter the list, in-place', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$M$2'],
    steps: [
      'M1 holds the header Region.',
      `M2 holds ="=North" (or type '=North with a leading apostrophe, which stores the text =North).`,
      'Run Data > Advanced in place and compare the number of records found with Q2.',
    ],
    pitfalls: [
      'Plain North in M2 means "begins with North" and keeps the North-East orders too.',
      'Typing =North without the quotes makes Excel read a formula and show #NAME?.',
      'COUNTIF(B9:B68,"North*") would count North-East as well.',
    ],
    answer: 'M2 shows =North; the filter finds exactly Q2 records.',
  },
  {
    id: 'data-filters-revenue-band',
    topic: 'filters',
    question: 'The sales manager types a minimum revenue in Q1 and a maximum in Q2. Build criteria in M1:N2 from these two cells that copy the orders with Revenue from Q1 to Q2 (both included) to M8, and count those orders in Q4.',
    layout: ORDERS,
    formulas: [
      { cell: 'M2', formula: '=">="&Q1', note: 'Shows, for example, >=500' },
      { cell: 'N2', formula: '="<="&Q2', note: 'Shows, for example, <=1500' },
      { cell: 'Q4', formula: '=COUNTIF(K9:K68,">="&Q1)-COUNTIF(K9:K68,">"&Q2)', note: 'At least Q1, minus those above Q2' },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$N$2', 'Copy to: $M$8'],
    steps: [
      'Type Revenue in both M1 and N1: one field, two conditions on the same row = AND.',
      'Build M2 and N2 from Q1 and Q2 with &; fixed bounds could simply be typed as >=500 and <=1500.',
      'Run Data > Advanced. Run it again whenever Q1 or Q2 changes: the extract does not update by itself.',
      'Check that Q4 equals the number of orders copied.',
    ],
    pitfalls: [
      'The two bounds on separate rows are OR, and every order passes.',
      '">=Q1" inside the quotes compares with the text Q1, not the value in Q1.',
    ],
    answer: 'Report M1:N2, the extract from M8 and Q4.',
  },
  {
    id: 'data-filters-date-window',
    topic: 'filters',
    question: 'Q1 holds a start date and Q2 an end date. In M1:N2 build criteria from these two cells that extract the orders dated from Q1 to Q2 (both days included) to M8, and count them by formula in Q4.',
    layout: ORDERS,
    formulas: [
      { cell: 'M2', formula: '=">="&TEXT(Q1,"d mmm yyyy")', note: 'Shows, for example, >=1 Mar 2026' },
      { cell: 'N2', formula: '="<="&TEXT(Q2,"d mmm yyyy")' },
      { cell: 'M2 (alternative)', formula: '=">="&Q1', note: 'Also works: compares the date serial number (1 Mar 2026 shows as >=46082)' },
      { cell: 'Q4', formula: '=COUNTIF(D9:D68,">="&Q1)-COUNTIF(D9:D68,">"&Q2)' },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$N$2', 'Copy to: $M$8'],
    steps: [
      'M1 and N1 both hold Order Date, spelt exactly as in D8.',
      'M2 and N2 turn the dates in Q1 and Q2 into criteria text with TEXT, joined to the operator with &.',
      'Run Data > Advanced; Q4 must equal the number of orders copied.',
    ],
    pitfalls: [
      'A TEXT format that Excel cannot read back as a date, such as "yyyymmdd", matches nothing.',
      '> and < instead of >= and <= lose the orders placed on the first and the last day.',
      'The header must read Order Date exactly: "Date" is not a field of this list.',
    ],
    answer: 'Report M1:N2, the extract from M8 and Q4.',
  },
  {
    id: 'data-filters-unique-customers',
    topic: 'filters',
    question: 'With Advanced Filter, list each customer in the order book once, starting at M8, and report the number of distinct customers in Q2.',
    layout: `${ORDERS} The extract will fill column M from the header in M8 down; M9:M68 is empty beforehand.`,
    formulas: [
      { cell: 'Q2', formula: '=COUNTIF(M9:M68,"<>")', note: 'Counts the names below the header M8' },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $E$8:$E$68 (Customer column only, header included)', 'Criteria range: leave blank', 'Copy to: $M$8', 'Unique records only: ticked'],
    steps: [
      'Use only the Customer column E8:E68 as the list range: duplicates are judged on whole rows of the list range.',
      'Leave the criteria range blank so no customer is excluded.',
      'Tick Unique records only and copy to M8, then count the names in Q2.',
      'For distinct pairs, such as Region and Channel, use $B$8:$C$68 as the list range instead.',
    ],
    pitfalls: [
      'With the full list $A$8:$K$68 every row is unique (each order has its own Order ID), so nothing is removed.',
      'Names that differ only by a trailing space count as two customers.',
      'Do not count the header: the count starts at M9.',
    ],
    answer: 'Q2 = number of distinct customers; M9 down lists each name once.',
  },
  {
    id: 'data-filters-wildcards',
    topic: 'filters',
    question: 'Copy to M8 the orders whose Customer name contains Hotel anywhere and whose Product begins with Durian, using criteria in M1:N2. In Q2 count all orders from customers whose name contains Hotel (any product), and in Q3 count the records extracted.',
    layout: `${ORDERS} After the filter, the copied Qty column lands in T9:T68 (list columns A to K map to output columns M to W).`,
    formulas: [
      { cell: 'Q2', formula: '=COUNTIF(E9:E68,"*Hotel*")', note: '* stands for any run of characters, including none' },
      { cell: 'Q3', formula: '=COUNT(T9:T68)', note: 'Counts the copied rows through their numeric Qty' },
      { cell: 'Q3 (alternative)', formula: '=COUNTIFS(E9:E68,"*Hotel*",F9:F68,"Durian*")', note: NOT_TAUGHT },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$N$2', 'Copy to: $M$8'],
    steps: [
      'Headers M1 Customer and N1 Product, copied from E8 and F8.',
      'M2 *Hotel* (contains Hotel); N2 Durian* (begins with Durian; plain Durian does the same in Advanced Filter).',
      'Both sit on row 2, so both must hold. Run Data > Advanced and copy to M8.',
    ],
    pitfalls: [
      'Plain Hotel in M2 means "begins with Hotel" and misses names such as Marina Bay Hotel.',
      '="=Hotel" is an exact match and finds only a customer called just Hotel.',
      'COUNTIF needs the * written in: COUNTIF(E9:E68,"Hotel") counts only cells equal to Hotel.',
    ],
    answer: 'Report M1:N2, the extract from M8, Q2 and Q3.',
  },
  {
    id: 'data-filters-count-crosscheck',
    topic: 'filters',
    question: 'An Advanced Filter with criteria M1:O2 (Region exactly Central, Channel exactly Online, Revenue above 800) has copied the matching orders to M8. As a cross-check, give in Q4 the number of such orders and in Q5 their total revenue, both by formula on the original list.',
    layout: `${ORDERS} Criteria range M1:O2: M1 Region, N1 Channel, O1 Revenue; M2 ="=Central", N2 ="=Online", O2 holds the text >800.`,
    formulas: [
      { cell: 'Q4', formula: '=SUMPRODUCT((B9:B68="Central")*(C9:C68="Online")*(K9:K68>800))', note: 'Each test gives 1 or 0; the product is 1 only when all three hold' },
      { cell: 'Q5', formula: '=SUMPRODUCT((B9:B68="Central")*(C9:C68="Online")*(K9:K68>800)*K9:K68)' },
      { cell: 'Q4 (alternative)', formula: '=COUNTIFS(B9:B68,"Central",C9:C68,"Online",K9:K68,">800")', note: NOT_TAUGHT },
      { cell: 'Q5 (alternative)', formula: '=SUMIFS(K9:K68,B9:B68,"Central",C9:C68,"Online",K9:K68,">800")', note: NOT_TAUGHT },
    ],
    tool: ['Data > Advanced', 'Action: Copy to another location', 'List range: $A$8:$K$68', 'Criteria range: $M$1:$O$2', 'Copy to: $M$8'],
    steps: [
      'Turn each criteria cell into a test in brackets: (B9:B68="Central"), (C9:C68="Online"), (K9:K68>800).',
      'Multiply the tests for AND; SUMPRODUCT adds the 1s, which counts the orders.',
      'Multiply by K9:K68 as well to total their revenue.',
      'Q4 must equal the rows copied, and Q5 the sum of the copied Revenue column (W9:W68).',
    ],
    pitfalls: [
      'Tests separated by commas instead of * make SUMPRODUCT return 0.',
      'A comparison inside SUMPRODUCT is an exact match, while plain text in a criteria cell means "begins with".',
      'Above 800 is >800; >=800 would add the orders of exactly 800.',
    ],
    answer: 'Q4 = number of orders copied below M8; Q5 = their total revenue.',
  },

  // ---------- pivot (PivotTables with formula cross-checks) ----------
  {
    id: 'data-pivot-total-by-category',
    topic: 'pivot',
    question: 'Build a PivotTable on a new sheet showing total Revenue for each Category, with a grand total. On the data sheet, check the Fruit total in Q2 and the grand total in Q3 by formula.',
    layout: ORDERS,
    formulas: [
      { cell: 'Q2', formula: '=SUMIF(G9:G68,"Fruit",K9:K68)', note: 'Range to test, criterion, range to add' },
      { cell: 'Q3', formula: '=SUM(K9:K68)' },
    ],
    tool: ['Click a cell inside A8:K68, then Insert > PivotTable', 'Table/Range: $A$8:$K$68; location: New Worksheet', 'Rows: Category', 'Values: Revenue (Sum of Revenue)'],
    steps: [
      'Insert the PivotTable from the whole list, headers included.',
      'Drag Category to Rows and Revenue to Values.',
      'If Values shows Count of Revenue, change it in Value Field Settings to Sum.',
      'Q2 must equal the Fruit row and Q3 the Grand Total.',
    ],
    pitfalls: [
      'SUMIF takes the criteria range first and the sum range last: SUMIF(K9:K68,"Fruit",G9:G68) returns 0.',
      'After the data changes, right-click the PivotTable > Refresh: it does not update by itself.',
    ],
    answer: 'Report the PivotTable and Q2:Q3; the Fruit row equals Q2 and the Grand Total equals Q3.',
  },
  {
    id: 'data-pivot-region-by-channel',
    topic: 'pivot',
    question: 'Summarise total Revenue with Region down the side and Channel across the top: first as a PivotTable on a new sheet, then by formula in N2:Q6, with the regions in M2:M6 and the channels in N1:Q1.',
    layout: `${ORDERS} M2:M6 hold North, North-East, East, West, Central; N1:Q1 hold Hawker, Restaurant, Supermarket, Online.`,
    formulas: [
      { cell: 'N2 (fill to N2:Q6)', formula: '=SUMPRODUCT(($B$9:$B$68=$M2)*($C$9:$C$68=N$1)*$K$9:$K$68)', note: 'Region label: column locked; channel label: row locked; data ranges fully locked' },
      { cell: 'N2 (alternative)', formula: '=SUMIFS($K$9:$K$68,$B$9:$B$68,$M2,$C$9:$C$68,N$1)', note: NOT_TAUGHT },
    ],
    tool: ['Insert > PivotTable, Table/Range: $A$8:$K$68, New Worksheet', 'Rows: Region', 'Columns: Channel', 'Values: Sum of Revenue'],
    steps: [
      'Drag Region to Rows, Channel to Columns and Revenue to Values.',
      'For the formula grid, lock the data ranges fully, the region label by column ($M2) and the channel label by row (N$1).',
      'Write N2 once and fill it to Q6; each cell must match the pivot cell with the same two labels.',
    ],
    pitfalls: [
      '$M$2 in the formula repeats North in every row of the grid.',
      'The PivotTable sorts the regions A to Z, so compare cells by label, not by position.',
      'An empty pivot cell means no orders for that pair; the formula shows 0 there.',
    ],
    answer: 'N2:Q6 match the PivotTable body, and =SUM(N2:Q6) matches its Grand Total.',
  },
  {
    id: 'data-pivot-percent-of-total',
    topic: 'pivot',
    question: `Show each Category's share of total Revenue as a percentage: with a PivotTable on a new sheet, and by formula in N2:N4 for the categories in M2:M4, with a check total in N5.`,
    layout: `${ORDERS} M2:M4 hold Vegetables, Fruit, Herbs.`,
    formulas: [
      { cell: 'N2 (fill to N2:N4)', formula: '=SUMIF($G$9:$G$68,M2,$K$9:$K$68)/SUM($K$9:$K$68)', note: 'Category total over the locked grand total' },
      { cell: 'N5', formula: '=SUM(N2:N4)', note: 'Must show 100%' },
    ],
    tool: ['Insert > PivotTable, Table/Range: $A$8:$K$68, New Worksheet', 'Rows: Category; Values: Sum of Revenue', 'Value Field Settings > Show Values As: % of Grand Total'],
    steps: [
      'Build the Sum of Revenue by Category pivot first.',
      'Value Field Settings > Show Values As tab > % of Grand Total (or right-click a value > Show Values As).',
      'For the formulas, divide each category total by the anchored grand total and format N2:N5 as percentages.',
    ],
    pitfalls: [
      'SUM(K9:K68) without $ slides down as the formula is filled (K10:K69, K11:K70).',
      'Once a Columns field is added, % of Column Total and % of Row Total give shares within a column or a row, not of the grand total.',
    ],
    answer: 'N2:N4 equal the pivot percentages and add up to 100% in N5.',
  },
  {
    id: 'data-pivot-average-by-channel',
    topic: 'pivot',
    question: 'Report the average Revenue per order for each Channel: with a PivotTable on a new sheet, and by formula in N2:N5 for the channels listed in M2:M5.',
    layout: `${ORDERS} M2:M5 hold Hawker, Restaurant, Supermarket, Online.`,
    formulas: [
      { cell: 'N2 (fill to N2:N5)', formula: '=SUMIF($C$9:$C$68,M2,$K$9:$K$68)/COUNTIF($C$9:$C$68,M2)', note: 'Channel total over the number of orders in the channel' },
      { cell: 'N2 (alternative)', formula: '=AVERAGEIF($C$9:$C$68,M2,$K$9:$K$68)', note: NOT_TAUGHT },
    ],
    tool: ['Insert > PivotTable, Table/Range: $A$8:$K$68, New Worksheet', 'Rows: Channel; Values: Revenue', 'Value Field Settings > Summarize value field by: Average', 'Number Format: Number, 2 decimal places'],
    steps: [
      'Drag Channel to Rows and Revenue to Values (it starts as Sum of Revenue).',
      'Value Field Settings > Average: the field becomes Average of Revenue.',
      'Formula check: the channel total divided by the channel order count.',
    ],
    pitfalls: [
      'Leaving Sum, or picking Count, answers a different question: the field name in the pivot shows which one is used.',
      'The Grand Total of an Average pivot is the average over all orders, not the average of the four channel averages.',
      'A label in M2:M5 that does not appear in the list gives #DIV/0!.',
    ],
    answer: 'N2:N5 equal the Average of Revenue values in the pivot, to 2 decimal places.',
  },
  {
    id: 'data-pivot-month-helper',
    topic: 'pivot',
    question: 'Management wants total Revenue by month. Add a helper column Month in column L (header in L8) holding the year and month of each order, then build a PivotTable of total Revenue by Month.',
    layout: `${ORDERS} Column L is empty.`,
    formulas: [
      { cell: 'L9 (fill to L9:L68)', formula: '=TEXT(D9,"yyyy-mm")', note: 'Text such as 2026-03, which sorts in date order' },
    ],
    tool: ['Type Month in L8 and fill L9 down to L68', 'Insert > PivotTable, Table/Range: $A$8:$L$68 (include column L), New Worksheet', 'Rows: Month', 'Values: Sum of Revenue'],
    steps: [
      'Give L8 the header Month so the PivotTable can use the column.',
      'L9 =TEXT(D9,"yyyy-mm"), filled down to L68.',
      'Build the PivotTable on A8:L68 with Month in Rows and Revenue in Values.',
      'Without a helper: put Order Date in Rows, then right-click a date > Group > Months (and Years).',
    ],
    pitfalls: [
      'TEXT(D9,"mmm") merges the same month of different years into one row; "yyyy-mm" keeps them apart.',
      'A PivotTable built on A8:K68 has no Month field: widen it with Change Data Source, then Refresh.',
      'A blank header in L8 stops the PivotTable with a "field name is not valid" message.',
    ],
    answer: 'One row per month (2026-01, 2026-02, ...) with its Sum of Revenue; the Grand Total equals =SUM(K9:K68).',
  },

  // ---------- sumproduct (conditional counts and totals) ----------
  {
    id: 'data-sumproduct-countif-cell-criterion',
    topic: 'sumproduct',
    question: 'The dispatcher types a distance in km in J2. In J4 count the jobs longer than that distance, so that J4 updates whenever J2 changes.',
    layout: `${JOBS} J2 is the input cell.`,
    formulas: [
      { cell: 'J4', formula: '=COUNTIF(D6:D45,">"&J2)', note: 'The criterion becomes text such as >8' },
    ],
    steps: [
      'Range first: the Distance column D6:D45.',
      'Build the criterion by joining the operator in quotes to the cell: ">"&J2.',
      'Test it by changing J2 and watching J4 change.',
    ],
    pitfalls: [
      '">J2" inside the quotes compares with the text J2 and returns 0.',
      '"Longer than" is >; "at least" would be ">="&J2.',
    ],
    answer: 'J4 = number of jobs with a Distance greater than J2.',
  },
  {
    id: 'data-sumproduct-sumif-by-zone',
    topic: 'sumproduct',
    question: 'The five zones are listed in L6:L10. In M6:M10 give the total fee earned in each zone with one formula filled down, and in M11 the sum of the zone totals.',
    layout: `${JOBS} L6:L10 hold North, South, East, West, Central.`,
    formulas: [
      { cell: 'M6 (fill to M6:M10)', formula: '=SUMIF($B$6:$B$45,L6,$E$6:$E$45)' },
      { cell: 'M11', formula: '=SUM(M6:M10)', note: 'Must equal =SUM(E6:E45); if it is lower, a label in L6:L10 is misspelt' },
    ],
    steps: [
      `SUMIF(range, criteria, sum_range): the Zone column, this row's label, the Fee column.`,
      'Lock both data ranges with $, leave L6 relative, and fill down to M10.',
      'Check that M11 equals the total of all fees.',
    ],
    pitfalls: [
      'Without $ the ranges slide down when filled, so the lower rows miss the first jobs.',
      'A label typed "East " with a trailing space returns 0.',
    ],
    answer: 'M6:M10 hold one total per zone; M11 equals SUM(E6:E45).',
  },
  {
    id: 'data-sumproduct-average-by-zone',
    topic: 'sumproduct',
    question: 'For the zones in L6:L10, show in N6:N10 the average fee per job in each zone, using taught functions only.',
    layout: `${JOBS} L6:L10 hold North, South, East, West, Central.`,
    formulas: [
      { cell: 'N6 (fill to N6:N10)', formula: '=SUMIF($B$6:$B$45,L6,$E$6:$E$45)/COUNTIF($B$6:$B$45,L6)', note: 'Zone total over the number of jobs in the zone' },
      { cell: 'N6 (alternative)', formula: '=AVERAGEIF($B$6:$B$45,L6,$E$6:$E$45)', note: NOT_TAUGHT },
    ],
    steps: [
      'Zone total with SUMIF, number of jobs in the zone with COUNTIF, then divide.',
      'Lock the data ranges, keep L6 relative, and fill down to N10.',
      'If the zone totals already sit in M6:M10, =M6/COUNTIF($B$6:$B$45,L6) gives the same result.',
    ],
    pitfalls: [
      'Dividing by 40 (all jobs) instead of the zone count understates every average.',
      'A zone with no jobs gives #DIV/0!; wrap the formula in IFERROR(...,0) only if the question allows it.',
    ],
    answer: 'N6:N10 hold the average fee per job in S$, shown to 2 decimal places.',
  },
  {
    id: 'data-sumproduct-count-between',
    topic: 'sumproduct',
    question: 'J2 holds a lower and J3 an upper distance in km. In J4 count the jobs whose Distance is from J2 to J3, both limits included.',
    layout: `${JOBS} J2 and J3 are input cells; the value in J2 is not greater than the value in J3.`,
    formulas: [
      { cell: 'J4', formula: '=COUNTIF(D6:D45,">="&J2)-COUNTIF(D6:D45,">"&J3)', note: 'At least J2, minus those above J3' },
      { cell: 'J4 (SUMPRODUCT alternative)', formula: '=SUMPRODUCT((D6:D45>=J2)*(D6:D45<=J3))', note: 'Same count with two tests multiplied (AND)' },
      { cell: 'J4 (COUNTIFS alternative)', formula: '=COUNTIFS(D6:D45,">="&J2,D6:D45,"<="&J3)', note: NOT_TAUGHT },
    ],
    steps: [
      'Count every job at or above the lower limit.',
      'Subtract every job strictly above the upper limit, so jobs exactly at J3 stay in.',
      'Check with the SUMPRODUCT version: both must agree.',
    ],
    pitfalls: [
      'Subtracting COUNTIF(D6:D45,">="&J3) also removes the jobs exactly at J3.',
      'For strictly between, use ">"&J2 in the first term and ">="&J3 in the second.',
    ],
    answer: 'J4 = number of jobs with J2 <= Distance <= J3.',
  },
  {
    id: 'data-sumproduct-two-conditions',
    topic: 'sumproduct',
    question: 'J2 holds a zone name and J3 a vehicle type. In J4 count the jobs that match both, and in J5 total their fees, using taught functions only.',
    layout: `${JOBS} J2 (for example East) and J3 (for example Van) are input cells.`,
    formulas: [
      { cell: 'J4', formula: '=SUMPRODUCT((B6:B45=J2)*(C6:C45=J3))' },
      { cell: 'J5', formula: '=SUMPRODUCT((B6:B45=J2)*(C6:C45=J3)*E6:E45)' },
      { cell: 'J4 (alternative)', formula: '=COUNTIFS(B6:B45,J2,C6:C45,J3)', note: NOT_TAUGHT },
      { cell: 'J5 (alternative)', formula: '=SUMIFS(E6:E45,B6:B45,J2,C6:C45,J3)', note: NOT_TAUGHT },
    ],
    steps: [
      'Write each condition as a test in brackets: (B6:B45=J2) and (C6:C45=J3).',
      'Multiply the tests: TRUE x TRUE = 1 and anything with a FALSE = 0, so SUMPRODUCT counts the matches.',
      'Multiply by the Fee column as well to add up the fees of the matching jobs only.',
    ],
    pitfalls: [
      'Commas between the tests, SUMPRODUCT((B6:B45=J2),(C6:C45=J3)), return 0: only * turns TRUE/FALSE into 1/0.',
      'All ranges must cover the same rows (6 to 45), else #VALUE!.',
      'SUMIFS puts the sum range first, unlike SUMIF where it comes last.',
    ],
    answer: 'J4 = number of jobs in zone J2 with vehicle J3; J5 = their total fee.',
  },
  {
    id: 'data-sumproduct-share-rated',
    topic: 'sumproduct',
    question: 'In J4 show, as a percentage, the share of rated jobs that scored 4 or 5. Jobs without a rating must not count.',
    layout: JOBS,
    formulas: [
      { cell: 'J4', formula: '=COUNTIF(F6:F45,">=4")/COUNT(F6:F45)', note: 'COUNT counts only the rated (numeric) cells' },
    ],
    steps: [
      'Numerator: jobs rated 4 or more, COUNTIF(F6:F45,">=4").',
      'Denominator: jobs rated at all, COUNT(F6:F45), which skips the blanks.',
      'Format J4 as a percentage.',
    ],
    pitfalls: [
      'Dividing by 40 puts the unrated jobs into the base and understates the share.',
      '">4" leaves out the 4s: "4 or 5" is ">=4".',
    ],
    answer: 'J4 formatted as a percentage.',
  },
  {
    id: 'data-sumproduct-count-nonblank',
    topic: 'sumproduct',
    question: 'Report in J4 how many jobs were rated, in J5 how many have a comment, and in J6 how many were not rated.',
    layout: JOBS,
    formulas: [
      { cell: 'J4', formula: '=COUNT(F6:F45)', note: 'Counts cells holding numbers' },
      { cell: 'J5', formula: '=COUNTIF(G6:G45,"<>")', note: 'Counts cells that are not empty, text included' },
      { cell: 'J6', formula: '=COUNTIF(F6:F45,"")', note: 'Counts the empty Rating cells' },
    ],
    steps: [
      'Numeric answers (ratings): COUNT counts the cells holding numbers.',
      'Text answers (comments): COUNTIF(range,"<>") counts the cells that are not empty.',
      'Blanks: COUNTIF(range,""); check that J4 + J6 equals the 40 jobs.',
    ],
    pitfalls: [
      'COUNT(G6:G45) returns 0 because the comments are text.',
      'A cell holding only a space looks empty but is counted by "<>" and not by "".',
    ],
    answer: 'Three whole numbers, with J4 + J6 = 40.',
  },
  {
    id: 'data-sumproduct-top3-large',
    topic: 'sumproduct',
    question: 'In J4 give the total fee of the three highest-paying jobs, and in J5 the share of all fees that these three jobs represent.',
    layout: JOBS,
    formulas: [
      { cell: 'J4', formula: '=LARGE(E6:E45,1)+LARGE(E6:E45,2)+LARGE(E6:E45,3)' },
      { cell: 'J4 (alternative)', formula: '=SUMPRODUCT(LARGE(E6:E45,{1,2,3}))', note: 'Same total with one LARGE and the array constant {1,2,3}' },
      { cell: 'J5', formula: '=J4/SUM(E6:E45)', note: 'Format as a percentage' },
    ],
    steps: [
      'LARGE(range,k) returns the k-th highest value: k = 1, 2, 3.',
      'Add the three, or put the array constant {1,2,3} inside SUMPRODUCT.',
      'Divide by the total of all fees for the share.',
    ],
    pitfalls: [
      'MAX(E6:E45)*3 triples the top fee instead of adding the top three.',
      'Tied fees each count: if two jobs share the top fee, LARGE(...,1) and LARGE(...,2) both return it.',
      'SMALL(range,k) gives the k-th lowest, for "the three cheapest jobs".',
    ],
    answer: 'J4 in S$, J5 as a percentage.',
  },

  // ---------- anchoring ----------
  {
    id: 'data-anchoring-quote-grid',
    topic: 'anchoring',
    question: 'Build a quote grid in B6:F12 that gives the charge for each number of cartons in A6:A12 at each discount rate in B5:F5, with the list price per carton in B2. Write one formula in B6 and fill it to F12.',
    layout: 'B2 list price per carton: 24 (S$). A6:A12 carton numbers: 10, 20, 30, 40, 50, 60, 70. B5:F5 discount rates: 0%, 5%, 10%, 15%, 20%.',
    formulas: [
      { cell: 'B6 (fill to B6:F12)', formula: '=$A6*$B$2*(1-B$5)', note: 'Cartons: column locked; discount: row locked; price: both locked' },
    ],
    steps: [
      'The cartons sit in column A on every row: lock the column, $A6.',
      'The discounts sit in row 5 for every column: lock the row, B$5.',
      'The price is one cell for the whole grid: lock both, $B$2.',
      'Fill B6 right to F6 and down to F12, then click F12 and check that it reads $A12, $B$2 and F$5.',
    ],
    pitfalls: [
      'A6 without $ turns into B6, C6 ... (cells of the grid itself) when filled right.',
      'B5 without the $ before the 5 slides down to B6, B7 ... when filled down.',
      'B2 without $ reads the empty cells C2, D2 ... when filled right and returns 0.',
    ],
    answer: 'B6 = 240; D9 (40 cartons at 10%) = 864; F12 (70 cartons at 20%) = 1344.',
  },
  {
    id: 'data-anchoring-growth-fill',
    topic: 'anchoring',
    question: 'January sales for five outlets are in B6:B10 and the monthly growth rate is in B2. Fill C6:M10 with the projected sales for February to December, each month growing by the rate in B2 on the month before. Write one formula in C6 and fill it right and down.',
    layout: 'B2 monthly growth rate: 2%. A6:A10 outlet names; B6:B10 January sales (B6 = 10000); C5:M5 month labels Feb to Dec.',
    formulas: [
      { cell: 'C6 (fill to C6:M10)', formula: '=B6*(1+$B$2)', note: 'Previous month (relative) times the locked growth factor' },
    ],
    steps: [
      'Each cell grows the cell to its left, so the reference to B6 stays fully relative.',
      'The rate is one cell for the whole grid: $B$2.',
      'Fill C6 right to M6, then fill C6:M6 down to row 10.',
    ],
    pitfalls: [
      '$B6 would grow every month from January, so all of C6:M6 would show 10200.',
      'B2 without $ moves to the empty C2, D2 ... and multiplies by 1, so sales stop growing.',
    ],
    answer: 'With B6 = 10000 and B2 = 2%: C6 = 10200, D6 = 10404, M6 = 10000 x 1.02^11 = 12433.74 (2 dp).',
  },
  {
    id: 'data-anchoring-row-share',
    topic: 'anchoring',
    question: `Quarterly sales for five outlets are in B5:E9. In F5:F9 give each outlet's annual total, then in H5:K9 show each quarter as a percentage of that outlet's annual total, writing one formula in H5 and filling it across and down.`,
    layout: 'A5:A9 outlet names; B5:E9 sales for Q1 to Q4 (row 5: 120, 150, 90, 140); F5:F9 empty for the totals; H5:K9 empty for the shares.',
    formulas: [
      { cell: 'F5 (fill to F5:F9)', formula: '=SUM(B5:E5)' },
      { cell: 'H5 (fill to H5:K9)', formula: '=B5/$F5', note: 'Column F locked so every quarter divides by the total; row free so each outlet uses its own total' },
    ],
    steps: [
      'Totals: =SUM(B5:E5) in F5, filled down to F9.',
      'Shares: the quarter (B5) moves with the fill, the total stays in column F: $F5.',
      'Format H5:K9 as percentages; each row adds up to 100%.',
      `For a share of each quarter's column total instead (totals in row 10), the lock flips: =B5/B$10.`,
    ],
    pitfalls: [
      'Without the $ on F, I5 divides by the empty G5 and shows #DIV/0!.',
      `$F$5 divides every outlet by the first outlet's total.`,
    ],
    answer: 'F5 = 500; H5:K5 = 24%, 30%, 18%, 28%.',
  },

  // ---------- general formula skills ----------
  {
    id: 'data-exact-lookup-iferror-not-found',
    topic: 'exact-lookup',
    question: 'A clerk types a product code in F2. In F3 return its unit price from the price list, and show the text Not found when the code is not in the list.',
    layout: 'Price list A5:C30: headers in row 5, product codes A6:A30 (text such as FF-101), product names B6:B30, unit prices C6:C30 (S$). The code is typed in F2.',
    formulas: [
      { cell: 'F3', formula: '=IFERROR(VLOOKUP(F2,$A$6:$C$30,3,FALSE),"Not found")', note: 'Exact match; the #N/A of a missing code becomes the text' },
      { cell: 'F3 (alternative)', formula: '=IFERROR(INDEX($C$6:$C$30,MATCH(F2,$A$6:$A$30,0)),"Not found")' },
    ],
    steps: [
      'Write the exact lookup first, VLOOKUP(F2,$A$6:$C$30,3,FALSE), and test it with a real code.',
      'Wrap it: IFERROR(lookup,"Not found").',
      'Test again with a code that is not in the list.',
    ],
    pitfalls: [
      'Without FALSE (or with TRUE) VLOOKUP matches approximately and can return a wrong price for a missing code.',
      'IFERROR also hides real mistakes such as a wrong column number, so test the bare lookup first.',
      'A code stored as a number in one place and as text in the other never matches.',
    ],
    answer: 'F3 shows the price for a listed code and the text Not found otherwise.',
  },
  {
    id: 'data-capacity-boxes-and-gst',
    topic: 'capacity',
    question: 'A caterer needs the number of curry puffs in B4; each box holds the number in B5 and costs the price in B6. Give in B7 the boxes to buy, in B8 the boxes that will be completely full, in B9 the puffs in the last, part-filled box, in B10 the cost of the boxes, in B11 the GST on B10 at the rate in B3 rounded to the cent, and in B12 the total bill.',
    layout: 'B3 GST rate: 9%. B4 puffs needed: 250. B5 puffs per box: 24. B6 price per box: 28.40 (S$).',
    formulas: [
      { cell: 'B7', formula: '=ROUNDUP(B4/B5,0)', note: 'Containers always round up' },
      { cell: 'B8', formula: '=ROUNDDOWN(B4/B5,0)', note: '=INT(B4/B5) gives the same for positive numbers' },
      { cell: 'B9', formula: '=MOD(B4,B5)', note: 'Remainder after the full boxes' },
      { cell: 'B10', formula: '=B7*B6' },
      { cell: 'B11', formula: '=ROUND(B10*B3,2)', note: 'Rounded to the cent' },
      { cell: 'B12', formula: '=B10+B11' },
    ],
    steps: [
      'Containers to buy: ROUNDUP(amount/size,0).',
      'Full containers: ROUNDDOWN or INT; the remainder: MOD(amount,size).',
      'Money to the cent: ROUND(value,2); to whole dollars: ROUND(value,0), or ROUNDUP/ROUNDDOWN if the rule says so.',
    ],
    pitfalls: [
      'ROUND(B4/B5,0) gives 10 boxes and leaves 10 puffs without a box.',
      'Formatting B11 to 2 decimals only changes the display: B12 would still add 28.116. Use ROUND when the question says round.',
      'MOD(B4,B5) = 0 means the last box is completely full.',
    ],
    answer: 'B7 = 11, B8 = 10, B9 = 10, B10 = 312.40, B11 = 28.12 (from 28.116), B12 = 340.52.',
  },
  {
    id: 'data-exact-lookup-best-seller',
    topic: 'exact-lookup',
    question: 'Units sold for eight dishes are in B5:B12, with the dish names in A5:A12. In E2 return the name of the best-selling dish, in E3 its units, in E4 the name of the weakest seller and in E5 the name of the runner-up.',
    layout: 'A5:A12 dishes: Kaya Toast, Nasi Lemak, Laksa, Chicken Rice, Satay, Roti Prata, Mee Goreng, Char Kway Teow. B5:B12 units sold: 320, 415, 280, 506, 198, 377, 245, 389.',
    formulas: [
      { cell: 'E2', formula: '=INDEX(A5:A12,MATCH(MAX(B5:B12),B5:B12,0))', note: 'Position of the largest value, then the name in that position' },
      { cell: 'E3', formula: '=MAX(B5:B12)' },
      { cell: 'E4', formula: '=INDEX(A5:A12,MATCH(MIN(B5:B12),B5:B12,0))' },
      { cell: 'E5', formula: '=INDEX(A5:A12,MATCH(LARGE(B5:B12,2),B5:B12,0))', note: 'LARGE(range,2) is the second highest' },
    ],
    steps: [
      'Find the value: MAX, MIN or LARGE(range,k).',
      'MATCH(value,units,0) gives its position in the list.',
      'INDEX(names,position) returns the name in that position.',
    ],
    pitfalls: [
      'MATCH without the 0 assumes sorted data and can return the wrong dish.',
      'If two dishes tie, MATCH returns the first one listed.',
      'The INDEX and MATCH ranges must start and end on the same rows (5 to 12).',
    ],
    answer: 'E2 = Chicken Rice, E3 = 506, E4 = Satay (198 units), E5 = Nasi Lemak (415 units).',
  },
  {
    id: 'data-dates-quarter-label',
    topic: 'dates',
    question: 'Add two helper columns to the order list for a quarterly PivotTable: in L9:L68 (header Quarter in L8) a label Q1 to Q4 from each Order Date, and in M9:M68 (header Period in M8) a label such as 2026-Q3.',
    layout: `${ORDERS} Columns L and M are empty.`,
    formulas: [
      { cell: 'L9 (fill to L9:L68)', formula: '="Q"&ROUNDUP(MONTH(D9)/3,0)' },
      { cell: 'M9 (fill to M9:M68)', formula: '=YEAR(D9)&"-Q"&ROUNDUP(MONTH(D9)/3,0)' },
      { cell: 'L9 (alternative)', formula: '=IF(MONTH(D9)<=3,"Q1",IF(MONTH(D9)<=6,"Q2",IF(MONTH(D9)<=9,"Q3","Q4")))', note: 'Same labels with nested IF' },
    ],
    steps: [
      'MONTH(D9)/3 rounded up gives 1 for Jan-Mar, 2 for Apr-Jun, 3 for Jul-Sep and 4 for Oct-Dec.',
      'Join the text and the number with &: "Q"&...',
      'Fill down to row 68, then use Quarter or Period as the PivotTable row field (list range $A$8:$M$68).',
    ],
    pitfalls: [
      'ROUND instead of ROUNDUP puts April (4/3 = 1.33) in Q1.',
      'Excel has no format code for quarters, so TEXT cannot produce Q1 to Q4.',
      'The labels are text: they group and filter well but cannot be added up.',
    ],
    answer: 'An order of 15 Aug 2026 gives Q3 and 2026-Q3; 1 Apr 2026 gives Q2; 31 Mar 2026 gives Q1.',
  },
  {
    id: 'data-interpret-formulatext',
    topic: 'interpret',
    question: 'The answer template asks you to show, beside each answer, the formula that produced it: show the formula of J4 as text in K4, and the formulas of the model column F6:F20 in G6:G20.',
    layout: 'J4 holds your answer formula (for example =COUNTIF(D6:D45,">"&J2)). F6:F20 hold a column of formulas. K4 and G6:G20 are empty.',
    formulas: [
      { cell: 'K4', formula: '=FORMULATEXT(J4)' },
      { cell: 'G6 (fill to G6:G20)', formula: '=FORMULATEXT(F6)' },
    ],
    steps: [
      'FORMULATEXT(cell) returns the formula of that cell as text, exactly as typed.',
      'Fill it down beside a column of formulas to document them all at once.',
      'Keep the working formula in the answer cell itself: FORMULATEXT only displays it.',
    ],
    pitfalls: [
      'A cell holding a typed number makes FORMULATEXT return #N/A, which shows that the answer was hard-coded.',
      'Typing the formula as text after an apostrophe also shows it, but it does not update when the formula changes.',
    ],
    answer: 'K4 displays the text =COUNTIF(D6:D45,">"&J2) and follows any change made to J4.',
  },
  {
    id: 'data-if-logic-probability-check',
    topic: 'if-logic',
    question: 'A demand distribution lists demand values in A5:A9 and their probabilities in B5:B9. In B11 show OK if the probabilities add up to 1 and Check otherwise, and in B12 give the expected demand.',
    layout: 'A5:A9 demand: 10, 20, 30, 40, 50. B5:B9 probabilities: 0.10, 0.25, 0.30, 0.20, 0.15.',
    formulas: [
      { cell: 'B11', formula: '=IF(ROUND(SUM(B5:B9),6)=1,"OK","Check")' },
      { cell: 'B11 (alternative)', formula: '=ROUND(SUM(B5:B9),6)=1', note: 'Returns TRUE or FALSE' },
      { cell: 'B12', formula: '=SUMPRODUCT(A5:A9,B5:B9)', note: 'Each value times its probability, added up' },
    ],
    steps: [
      'Add the probabilities with SUM.',
      'Round the sum to 6 decimals before comparing it with 1, so tiny floating-point errors cannot fail the test.',
      'Expected value: SUMPRODUCT of the values and the probabilities.',
    ],
    pitfalls: [
      'Without ROUND, a sum stored as 0.9999999999999999 can fail an exact test against 1.',
      'Probabilities typed as 25 instead of 25% add up to 100, not 1.',
      'Run the check before building a cumulative column for a simulation lookup.',
    ],
    answer: 'B11 = OK (the five probabilities add up to 1); B12 = 30.5.',
  },
]
