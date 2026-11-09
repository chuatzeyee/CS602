// Anticipated Question 1 parts: deterministic models, lookups, rules, dates and times, capacity, forecasting,
// Goal Seek, Solver, what-if and finance. Original scenarios; every value quoted in `answer` was computed from the
// numbers stated in the layout (Solver optima checked by enumeration / LP, finance values by HyperFormula).
import type { AnticipatedQ } from './types'

export const questions: readonly AnticipatedQ[] = [
  // ---------------------------------------------------------------- sumproduct
  {
    id: 'sumproduct-receipt-subtotal',
    topic: 'sumproduct',
    question: 'A Tiong Bahru bakery receipt lists five items. In D11 compute the subtotal, in D12 the GST at the rate in G2, and in D13 the total payable.',
    layout: 'Item names in B5:B9, quantities in C5:C9 (2, 1, 3, 6, 2), unit prices in D5:D9 ($4.50, $6.80, $2.20, $1.60, $3.90). GST rate in G2 (9%).',
    formulas: [
      { cell: 'D11', formula: '=SUMPRODUCT(C5:C9,D5:D9)', note: 'quantity x price on each line, added up' },
      { cell: 'D12', formula: '=D11*G2' },
      { cell: 'D13', formula: '=D11+D12' },
    ],
    steps: [
      'Pair the quantity column with the unit-price column: same rows, same length.',
      'D11: =SUMPRODUCT(C5:C9,D5:D9).',
      'GST = subtotal x rate cell; total = subtotal + GST.',
      'Format all three as currency with 2 decimals.',
    ],
    pitfalls: [
      'SUM(C5:C9)*SUM(D5:D9) is not the subtotal: it multiplies every quantity by every price.',
      'If the template says GST is rounded to cents, use =ROUND(D11*G2,2).',
    ],
    answer: 'D11 = $39.80, D12 = $3.58 (3.582 unrounded), D13 = $43.38.',
  },
  {
    id: 'sumproduct-production-plan-cost',
    topic: 'sumproduct',
    question: 'A Tuas sauce factory plans four weeks of output for four sauces. In G8 compute the production cost of week 1 and fill it down to G11 for weeks 2 to 4. In G12 compute the total cost of the plan.',
    layout: 'Unit cost of each sauce in C5:F5 ($12, $18, $25, $9). Planned units, one row per week, in C8:F11 (week 1: 100, 50, 20, 200). Week labels in B8:B11.',
    formulas: [
      { cell: 'G8 (fill to G8:G11)', formula: '=SUMPRODUCT($C$5:$F$5,C8:F8)', note: 'unit-cost row locked, this week row moves' },
      { cell: 'G12', formula: '=SUM(G8:G11)' },
    ],
    steps: [
      'Unit costs sit in one row, the plan in rows below: both 4 columns wide.',
      'G8: =SUMPRODUCT($C$5:$F$5,C8:F8). Lock the cost row, leave the plan row relative.',
      'Fill G8 down to G11, then sum G8:G11 in G12.',
      'Click G11 and check it reads $C$5:$F$5 and C11:F11.',
    ],
    pitfalls: [
      'Without $ on C5:F5 the cost row slides down to empty rows and weeks 2 to 4 come out wrong.',
      'Both ranges must have the same shape (1 row x 4 columns).',
    ],
    answer: 'Week 1: G8 = 100x12 + 50x18 + 20x25 + 200x9 = $4,400. G12 is the sum of the four weekly costs.',
  },
  {
    id: 'sumproduct-expected-value',
    topic: 'sumproduct',
    question: 'A Sentosa drinks kiosk earns a different daily profit depending on the weather. In E10 compute the expected daily profit from the probability table, and in E11 check that the probabilities add up to 1.',
    layout: 'Weather outcomes in B5:B8 (Sunny, Cloudy, Light rain, Heavy rain), daily profit in C5:C8 ($1,400, $900, $450, $200), probabilities in D5:D8 (0.35, 0.30, 0.25, 0.10).',
    formulas: [
      { cell: 'E10', formula: '=SUMPRODUCT(C5:C8,D5:D8)', note: 'each outcome x its probability, added up' },
      { cell: 'E11', formula: '=SUM(D5:D8)' },
    ],
    steps: [
      'Pair each outcome with its probability (same rows).',
      'Expected value = SUMPRODUCT(outcomes, probabilities).',
      'Check the probabilities sum to exactly 1.',
    ],
    pitfalls: [
      'AVERAGE(C5:C8) treats every weather type as equally likely.',
      'Probabilities typed as 35 instead of 0.35 or 35% give 100 times the answer.',
    ],
    answer: 'E10 = 490 + 270 + 112.50 + 20 = $892.50; E11 = 1.',
  },
  {
    id: 'sumproduct-weighted-average-per-person',
    topic: 'sumproduct',
    question: 'A hawker food-tour company sold five group bookings at different per-person prices. In D11 compute the average price paid per person (not per booking).',
    layout: 'People per booking in C5:C9 (2, 6, 4, 1, 7), price per person in D5:D9 ($45, $38, $40, $50, $36).',
    formulas: [
      { cell: 'D11', formula: '=SUMPRODUCT(C5:C9,D5:D9)/SUM(C5:C9)', note: 'total revenue / total people' },
    ],
    steps: [
      'Total revenue = SUMPRODUCT(people, price per person).',
      'Total people = SUM(people).',
      'Weighted average = revenue / people.',
    ],
    pitfalls: [
      '=AVERAGE(D5:D9) gives $41.80, the average per booking: it weights the solo traveller the same as the group of 7.',
    ],
    answer: 'Revenue $780 over 20 people: D11 = $39.00 per person.',
  },
  {
    id: 'sumproduct-conditional-total',
    topic: 'sumproduct',
    question: 'A bubble-tea chain logs 60 transactions. In H5 compute the total revenue of the outlet named in G5 and fill down to H8 for the outlets in G6:G8. In I5 count the transactions of that outlet and fill down to I8.',
    layout: 'Transaction list: outlet name in B5:B64, revenue in E5:E64. Outlets to summarise in G5:G8 (Jurong, Tampines, Bugis, Woodlands).',
    formulas: [
      { cell: 'H5 (fill to H5:H8)', formula: '=SUMPRODUCT(($B$5:$B$64=G5)*$E$5:$E$64)', note: 'the comparison is 1 on matching rows, 0 elsewhere' },
      { cell: 'H5 (alternative)', formula: '=SUMIF($B$5:$B$64,G5,$E$5:$E$64)' },
      { cell: 'I5 (fill to I5:I8)', formula: '=COUNTIF($B$5:$B$64,G5)' },
    ],
    steps: [
      'Write the condition as a whole-column comparison with the criterion cell: ($B$5:$B$64=G5).',
      'Multiply by the values to add (*$E$5:$E$64) and wrap in SUMPRODUCT.',
      'Lock the data ranges, leave G5 relative, fill down.',
      'Check: if every outlet is listed, H5:H8 adds up to SUM(E5:E64).',
    ],
    pitfalls: [
      '=SUMPRODUCT($B$5:$B$64=G5,$E$5:$E$64) with a comma returns 0: TRUE/FALSE only become 1/0 when multiplied.',
      'Text criteria must match exactly, including stray spaces.',
    ],
    answer: 'One revenue total and one count per outlet in H5:I8.',
  },
  {
    id: 'sumproduct-two-conditions',
    topic: 'sumproduct',
    question: 'From an online grocer order log, compute in H5 the total value of orders that came through the channel in H3 and were worth at least the amount in H4. In H6 count those orders.',
    layout: 'Order log: channel in C5:C204 ("App", "Web", "Phone"), order value in E5:E204. Criteria: channel in H3 (App), minimum value in H4 ($50).',
    formulas: [
      { cell: 'H5', formula: '=SUMPRODUCT((C5:C204=H3)*(E5:E204>=H4)*E5:E204)' },
      { cell: 'H6', formula: '=SUMPRODUCT((C5:C204=H3)*(E5:E204>=H4))' },
      { cell: 'H5 (alternative, not taught)', formula: '=SUMIFS(E5:E204,C5:C204,H3,E5:E204,">="&H4)' },
    ],
    steps: [
      'One bracket per condition: (C5:C204=H3) and (E5:E204>=H4).',
      'Multiply the brackets (both must hold). Multiply by E5:E204 to add values; leave it out to count.',
      '"At least" is >=; "more than" would be >.',
    ],
    pitfalls: [
      'For OR (either condition) add the brackets and test >0, so a row meeting both is not counted twice: =SUMPRODUCT(((C5:C204="App")+(E5:E204>=100)>0)*E5:E204).',
      'All ranges must cover the same rows (5 to 204).',
    ],
    answer: 'H5 = value of App orders of $50 or more; H6 = how many there are (H5/H6 is their average).',
  },

  // ---------------------------------------------------------------- bracket
  {
    id: 'bracket-text-bands-discount',
    topic: 'bracket',
    question: 'A furniture showroom gives a discount based on the subtotal, with bands printed as text in F5:F9. (i) In E5:E9 build the numeric lower bound of each band. (ii) In D20 look up the discount rate for the subtotal in D19. (iii) In D21 compute the discount and in D22 the amount payable.',
    layout: 'Band text in F5:F9: "Below $100", "$100 to $299.99", "$300 to $599.99", "$600 to $999.99", "$1,000 and above". Discount rates in G5:G9 (0%, 3%, 5%, 8%, 12%). Lower bounds to build in E5:E9. Subtotal in D19 ($452.60).',
    formulas: [
      { cell: 'D20', formula: '=VLOOKUP(D19,$E$5:$G$9,3,TRUE)', note: 'approximate match on the lower bounds; the rate is column 3 counted from E' },
      { cell: 'D20 (alternative)', formula: '=LOOKUP(D19,$E$5:$E$9,$G$5:$G$9)' },
      { cell: 'D21', formula: '=D19*D20' },
      { cell: 'D22', formula: '=D19-D21' },
    ],
    steps: [
      'Type the smallest amount of each band in E5:E9: 0, 100, 300, 600, 1000 (ascending, starting at 0).',
      'D20: VLOOKUP the subtotal in E5:G9 with TRUE, column 3.',
      'Discount = subtotal x rate; payable = subtotal - discount (or =D19*(1-D20)).',
      'Test the edges: 299.99 must give 3%, 300 must give 5%.',
    ],
    pitfalls: [
      'FALSE (exact match) returns #N/A for any subtotal that is not exactly a lower bound.',
      'Lower bounds typed as text break the lookup: type plain numbers.',
      'Column 2 returns the band text, not the rate.',
    ],
    answer: 'E5:E9 = 0, 100, 300, 600, 1000. For $452.60: D20 = 5%, D21 = $22.63, D22 = $429.97.',
  },
  {
    id: 'bracket-commission-tier',
    topic: 'bracket',
    question: 'A property agency pays each agent commission on ALL of their monthly sales at the rate of the tier the sales fall in. In D5 compute the commission for the agent in row 5 and fill down to D30.',
    layout: 'Monthly sales in C5:C30. Tier table: lower bounds G5:G8 (0, 20000, 50000, 100000), rates H5:H8 (2%, 3.5%, 5%, 6.5%). A tier starts at its lower bound ("$50,000 or more earns 5%").',
    formulas: [
      { cell: 'D5 (fill to D5:D30)', formula: '=C5*VLOOKUP(C5,$G$5:$H$8,2,TRUE)' },
      { cell: 'D5 (alternative)', formula: '=C5*INDEX($H$5:$H$8,MATCH(C5,$G$5:$G$8,1))' },
    ],
    steps: [
      'Check the tier table is ascending and starts at 0.',
      'Look up the rate with VLOOKUP(...,TRUE) on the locked table.',
      'Multiply the whole sales figure by that rate; fill down.',
      'Test 49,999 and 50,000.',
    ],
    pitfalls: [
      'This is NOT progressive. If the wording is "5% on the part above $50,000", use base + (sales - bound) x rate (see the progressive tax question).',
      'An unlocked G5:H8 slides down and returns #N/A lower in the column.',
    ],
    answer: '$49,999 earns 3.5% = $1,749.97 (1,749.965); $50,000 earns 5% = $2,500.',
  },
  {
    id: 'bracket-shipping-weight-up-to',
    topic: 'bracket',
    question: 'An online seller charges shipping by weight: up to 1 kg $4.50; over 1 kg up to 3 kg $7.80; over 3 kg up to 5 kg $11.20; over 5 kg up to 10 kg $16.00; over 10 kg $25.00. Build the lower bounds in H5:H9, then in E6 compute the fee for the parcel in row 6 and fill down to E40.',
    layout: 'Parcel weights in kg in D6:D40, recorded to the nearest gram (3 decimals). Fee table: lower bounds to build in H5:H9, fees in I5:I9 ($4.50, $7.80, $11.20, $16.00, $25.00).',
    formulas: [
      { cell: 'E6 (fill to E6:E40)', formula: '=VLOOKUP(D6,$H$5:$I$9,2,TRUE)', note: 'H5:H9 = 0, 1.001, 3.001, 5.001, 10.001' },
      { cell: 'E6 (alternative)', formula: '=IFS(D6<=1,$I$5,D6<=3,$I$6,D6<=5,$I$7,D6<=10,$I$8,TRUE,$I$9)' },
    ],
    steps: [
      '"Up to 1 kg" includes 1 kg, so the next band starts just above 1.',
      'With weights to the gram, type lower bounds 0, 1.001, 3.001, 5.001, 10.001 in H5:H9.',
      'VLOOKUP(...,TRUE) on the locked table; fill down.',
      'Test 1.000 kg ($4.50) and 1.001 kg ($7.80).',
    ],
    pitfalls: [
      'Lower bounds 0, 1, 3, 5, 10 put exactly 1 kg in the $7.80 band: wrong for "up to" wording.',
      'If weights can have more decimals, use the IFS version with <= on the upper limits.',
    ],
    answer: '3.000 kg pays $7.80; 3.250 kg pays $11.20; 10.000 kg pays $16.00.',
  },
  {
    id: 'bracket-grade-by-score',
    topic: 'bracket',
    question: 'A culinary school awards a grade from the final score. In D5 return the grade for the student in row 5 and fill down to D60. In I5 count the students with the grade in H5 and fill down to I9.',
    layout: 'Final scores (0 to 100, may have one decimal) in C5:C60. Grade table: minimum scores in G5:G9 (0, 50, 65, 75, 85), grades in H5:H9 ("F", "D", "C", "B", "A").',
    formulas: [
      { cell: 'D5 (fill to D5:D60)', formula: '=VLOOKUP(C5,$G$5:$H$9,2,TRUE)' },
      { cell: 'D5 (alternative)', formula: '=LOOKUP(C5,$G$5:$G$9,$H$5:$H$9)' },
      { cell: 'D5 (nested IF alternative)', formula: '=IF(C5>=85,"A",IF(C5>=75,"B",IF(C5>=65,"C",IF(C5>=50,"D","F"))))' },
      { cell: 'I5 (fill to I5:I9)', formula: '=COUNTIF($D$5:$D$60,H5)' },
    ],
    steps: [
      'Minimum scores ascending from 0, grades beside them.',
      'Approximate VLOOKUP (TRUE) on the locked table; fill down.',
      'Count each grade with COUNTIF over the locked grade column.',
    ],
    pitfalls: [
      'If scores must be rounded first ("74.5 counts as 75"), look up ROUND(C5,0).',
      'A table sorted A to F (descending scores) breaks the approximate match.',
    ],
    answer: '84.9 gives "B", 85 gives "A", 49.5 gives "F" (unless rounding is specified).',
  },
  {
    id: 'bracket-price-break-all-units',
    topic: 'bracket',
    question: 'A packaging supplier uses all-units price breaks: one unit price, set by the order quantity, applies to the whole order. In C5 look up the unit price for the quantity in C4 and in C6 compute the order cost.',
    layout: 'Order quantity in C4 (260). Price-break table: minimum quantities F5:F8 (1, 100, 250, 500), unit prices G5:G8 ($2.40, $2.10, $1.95, $1.80).',
    formulas: [
      { cell: 'C5', formula: '=VLOOKUP(C4,$F$5:$G$8,2,TRUE)' },
      { cell: 'C6', formula: '=C4*C5' },
    ],
    steps: [
      'Approximate-match lookup on the minimum-quantity column.',
      'All units at that price: cost = quantity x unit price.',
      'Check a quantity just below a break (249) and on it (250).',
    ],
    pitfalls: [
      'If the lower price applies only to units above the break (incremental), cost is built band by band, not quantity x one price.',
      'A quantity of 0 returns #N/A because the first bound is 1.',
    ],
    answer: '260 units: C5 = $1.95, C6 = $507.00. Note 240 units cost $504.00 but 250 cost only $487.50.',
  },
  {
    id: 'bracket-progressive-tax',
    topic: 'bracket',
    question: 'Compute income tax with a progressive (marginal) table. (i) In H5 compute the base tax of each bracket and fill down to H9. (ii) In D5 compute the tax on the income in C5 and fill down to D40. (iii) In E5 compute the effective tax rate and fill down to E40.',
    layout: 'Chargeable incomes in C5:C40. Tax table: lower bounds G4:G9 (0, 20000, 30000, 40000, 80000, 120000), base tax H4:H9 (tax on income equal to the lower bound; H4 typed 0), marginal rates I4:I9 (0%, 2%, 3.5%, 7%, 11.5%, 15%).',
    formulas: [
      { cell: 'H5 (fill to H5:H9)', formula: '=H4+(G5-G4)*I4', note: 'base of the previous bracket + its full width x its rate' },
      { cell: 'D5 (fill to D5:D40)', formula: '=VLOOKUP(C5,$G$4:$I$9,2,TRUE)+(C5-VLOOKUP(C5,$G$4:$I$9,1,TRUE))*VLOOKUP(C5,$G$4:$I$9,3,TRUE)', note: 'base + (income - lower bound) x marginal rate' },
      { cell: 'E5 (fill to E5:E40)', formula: '=IF(C5>0,D5/C5,0)' },
    ],
    steps: [
      'Base tax: H5 = H4 + (G5 - G4) x I4, filled down.',
      'VLOOKUP(...,TRUE) on G4:I9: column 1 = lower bound, 2 = base tax, 3 = rate.',
      'Tax = base + (income - lower bound) x marginal rate.',
      'Check by hand: 65,000 gives 550 + 25,000 x 7% = 2,300.',
    ],
    pitfalls: [
      'Income x marginal rate (65,000 x 7% = 4,550) overstates the tax: the rate applies only above the lower bound.',
      'Lock $G$4:$I$9 in all three VLOOKUPs.',
    ],
    answer: 'H4:H9 = 0, 0, 200, 550, 3,350, 7,950. Income $65,000: D5 = $2,300, E5 = 3.54%.',
  },
  {
    id: 'bracket-session-rate-from-times',
    topic: 'bracket',
    question: 'A karaoke studio prices by session length: the band rate applies to the whole session, prorated by the minute. For the booking in row 5 compute the hours in E5, the hourly rate in F5 and the charge in G5; fill all three down to row 40.',
    layout: 'Start times in C5:C40, end times in D5:D40 (hh:mm, same day). Rate table: lower bounds in hours J5:J8 (0, 2, 4, 6), hourly rates K5:K8 ($18, $15, $13, $11).',
    formulas: [
      { cell: 'E5 (fill to E5:E40)', formula: '=ROUND((D5-C5)*24,6)', note: 'day fraction to hours, rounded to clear floating-point dust' },
      { cell: 'F5 (fill to F5:F40)', formula: '=VLOOKUP(E5,$J$5:$K$8,2,TRUE)' },
      { cell: 'G5 (fill to G5:G40)', formula: '=E5*F5' },
    ],
    steps: [
      'Hours = (end - start) x 24, wrapped in ROUND(...,6).',
      'Band rate by approximate VLOOKUP on the hour bounds.',
      'Charge = hours x rate (prorated by the minute).',
    ],
    pitfalls: [
      'Without ROUND, 14:00 to 16:00 computes as 1.9999999999999996 hours and lands in the $18 band.',
      'Looking up D5-C5 directly compares a day fraction (0.083) with hour bounds: multiply by 24 first.',
    ],
    answer: '13:40 to 17:10 is 3.5 h at $15 = $52.50. 14:00 to 16:00 is 2 h at $15 = $30.00.',
  },
  {
    id: 'bracket-discount-band-after-member-discount',
    topic: 'bracket',
    question: 'A sports shop takes 10% off for members first. A volume discount is then applied to the amount AFTER the member discount, and the volume band is also decided by that discounted amount. In D21 compute the amount after the member discount, in D22 the volume rate, and in D23 the amount payable.',
    layout: 'Member flag in D18 ("Y" or "N"). Subtotal before any discount in D20 ($540). Member discount rate in H2 (10%). Volume table: lower bounds G5:G8 (0, 200, 500, 1000), rates H5:H8 (0%, 5%, 8%, 10%).',
    formulas: [
      { cell: 'D21', formula: '=D20*(1-IF(D18="Y",H2,0))' },
      { cell: 'D22', formula: '=VLOOKUP(D21,G5:H8,2,TRUE)', note: 'band from the amount AFTER the member discount' },
      { cell: 'D23', formula: '=D21*(1-D22)' },
      { cell: 'D22 (if the band were set by the amount BEFORE discounts)', formula: '=VLOOKUP(D20,G5:H8,2,TRUE)' },
    ],
    steps: [
      'Read the order: which discount comes first, and which amount decides the band.',
      'Apply the member discount when the flag is "Y".',
      'Look up the band with the amount the question names (here D21).',
      'Apply the volume rate to the discounted amount: D21 x (1 - rate).',
    ],
    pitfalls: [
      'Adding the rates (10% + 5% = 15% off $540 = $459.00) is wrong when discounts are applied one after the other.',
      'Banding on D20 ($540, 8%) instead of D21 ($486, 5%) gives $447.12 instead of $461.70.',
      'If the wording is ambiguous, write your assumption next to the answer.',
    ],
    answer: 'Member, $540: D21 = $486.00, D22 = 5%, D23 = $461.70.',
  },

  // ---------------------------------------------------------------- exact-lookup
  {
    id: 'exact-lookup-price-by-code',
    topic: 'exact-lookup',
    question: 'A cafe order sheet lists item codes. In C6 return the item name and in D6 the unit price for the code in B6; in F6 compute the line total. Fill all three down to row 15.',
    layout: 'Order lines: item codes in B6:B15 (e.g. "K07"), quantities in E6:E15. Menu table in H5:J24: code in column H, item name in I, price in J.',
    formulas: [
      { cell: 'C6 (fill to C6:C15)', formula: '=VLOOKUP(B6,$H$5:$J$24,2,FALSE)' },
      { cell: 'D6 (fill to D6:D15)', formula: '=VLOOKUP(B6,$H$5:$J$24,3,FALSE)' },
      { cell: 'F6 (fill to F6:F15)', formula: '=D6*E6' },
      { cell: 'D6 (alternative)', formula: '=XLOOKUP(B6,$H$5:$H$24,$J$5:$J$24)' },
    ],
    steps: [
      'Codes are exact keys: last argument FALSE (or 0).',
      'Column number counts from the first column of the table: H = 1, I = 2, J = 3.',
      'Lock the table, leave B6 relative, fill down.',
    ],
    pitfalls: [
      'TRUE or a missing 4th argument does an approximate match and can silently return the wrong item.',
      '#N/A: code not in the menu, a stray space, or a number stored as text.',
    ],
    answer: 'One name and price per line; SUM(F6:F15) is the order subtotal.',
  },
  {
    id: 'exact-lookup-left-lookup',
    topic: 'exact-lookup',
    question: 'A clinic staff list has the department in column B, staff ID in column C and name in column D. For the ID typed in G3, return the department in G4 and the name in G5.',
    layout: 'Departments in B5:B40, staff IDs in C5:C40 (unique, e.g. "S1043"), names in D5:D40. Search ID in G3.',
    formulas: [
      { cell: 'G4', formula: '=INDEX(B5:B40,MATCH(G3,C5:C40,0))', note: 'answer column is LEFT of the key: VLOOKUP cannot do this' },
      { cell: 'G5', formula: '=INDEX(D5:D40,MATCH(G3,C5:C40,0))' },
      { cell: 'G4 (alternative)', formula: '=XLOOKUP(G3,C5:C40,B5:B40)' },
    ],
    steps: [
      'MATCH(G3, ID column, 0) gives the position of the ID inside C5:C40.',
      'INDEX(answer column, that position) returns the value on the same row.',
      'Both ranges must start and end on the same rows (5 to 40).',
    ],
    pitfalls: [
      'MATCH without the 0 matches approximately and can return a wrong row on unsorted IDs.',
      'INDEX over B5:B40 with MATCH over C4:C40 shifts every answer by one row.',
    ],
    answer: 'G4 shows the department and G5 the name; #N/A means the ID is not in the list.',
  },
  {
    id: 'exact-lookup-two-way-region-weight',
    topic: 'exact-lookup',
    question: 'A courier rate card gives the price by region (columns) and weight band (rows). For the parcel in row 13 return the rate in E13 and fill down to E40.',
    layout: 'Rate card: label "From (kg)" in F4, region names in G4:J4 ("Central", "East", "North", "West"), weight-band lower bounds in kg in F5:F9 (0, 1, 2, 5, 10), rates in G5:J9. Parcels: region in C13:C40, weight in kg in D13:D40.',
    formulas: [
      { cell: 'E13 (fill to E13:E40)', formula: '=INDEX($G$5:$J$9,MATCH(D13,$F$5:$F$9,1),MATCH(C13,$G$4:$J$4,0))', note: 'row: approximate (weight band); column: exact (region)' },
      { cell: 'E13 (alternative)', formula: '=VLOOKUP(D13,$F$5:$J$9,MATCH(C13,$F$4:$J$4,0),TRUE)', note: 'the MATCH counts from F, the first column of the VLOOKUP table' },
    ],
    steps: [
      'Row position: MATCH(weight, lower bounds, 1), since weights fall between bounds.',
      'Column position: MATCH(region, headers, 0), since names must match exactly.',
      'INDEX(grid, row, column). Lock all table ranges, leave C13 and D13 relative.',
    ],
    pitfalls: [
      'Match type 0 on the weight returns #N/A for any weight that is not exactly a bound.',
      'In the VLOOKUP version the header range must start in column F or the column number is off by one.',
      'Swapping the row and column MATCH returns a wrong rate or #REF!.',
    ],
    answer: 'A 3.4 kg parcel to "East" uses the 2 kg row and the East column: the value in H7.',
  },
  {
    id: 'exact-lookup-fare-matrix-position',
    topic: 'exact-lookup',
    question: 'A ferry operator numbers its six piers 1 to 6. The fare matrix gives the fare from each origin (row) to each destination (column). For the trip in row 14 return the fare in E14 and the trip revenue in F14; fill both down to row 50.',
    layout: 'Fare matrix in C4:H9: row 1 = origin pier 1, column 1 = destination pier 1 (pier numbers labelled in B4:B9 and C3:H3). Trips: origin pier number in B14:B50, destination pier number in C14:C50, passengers in D14:D50.',
    formulas: [
      { cell: 'E14 (fill to E14:E50)', formula: '=INDEX($C$4:$H$9,B14,C14)', note: 'row number = origin, column number = destination' },
      { cell: 'F14 (fill to F14:F50)', formula: '=D14*E14' },
    ],
    steps: [
      'The pier numbers are already positions inside the grid.',
      'INDEX(grid, row = origin, column = destination); lock the grid.',
      'Revenue = passengers x fare; fill down.',
    ],
    pitfalls: [
      'INDEX takes the row first: swapping gives the return-trip fare, which may differ.',
      'The numbers are positions inside C4:H9, not sheet rows: do not add 3.',
    ],
    answer: 'Origin 2 to destination 5 reads the 2nd row, 5th column of the grid: cell G5.',
  },
  {
    id: 'exact-lookup-match-position',
    topic: 'exact-lookup',
    question: 'A sales table has one row per outlet and one column per month. For the outlet chosen in Q3 and the month in Q4, return the row position in Q5, the column position in Q6, the sales in Q7 and the outlet total for the year in Q8.',
    layout: 'Outlet names in B5:B12, month labels "Jan" to "Dec" (text) in C4:N4, sales in C5:N12. Choices: outlet name in Q3, month label in Q4 (e.g. "Mar").',
    formulas: [
      { cell: 'Q5', formula: '=MATCH(Q3,B5:B12,0)' },
      { cell: 'Q6', formula: '=MATCH(Q4,C4:N4,0)' },
      { cell: 'Q7', formula: '=INDEX(C5:N12,Q5,Q6)' },
      { cell: 'Q8', formula: '=SUMPRODUCT((B5:B12=Q3)*C5:N12)', note: 'the 1/0 column picks out the outlet row' },
    ],
    steps: [
      'MATCH(value, list, 0) returns the position inside the list, counting from 1.',
      'Feed both positions into INDEX(grid, row, column).',
      'For a whole-row total, multiply the grid by the row condition inside SUMPRODUCT.',
    ],
    pitfalls: [
      'If the month headers are real dates formatted "mmm", matching the text "Mar" fails.',
      'MATCH positions count from the start of the range, not from row 1 of the sheet.',
    ],
    answer: 'If Q3 is the 3rd outlet and Q4 = "Mar": Q5 = 3, Q6 = 3, Q7 returns E7.',
  },
  {
    id: 'exact-lookup-best-option-name',
    topic: 'exact-lookup',
    question: 'Four marketing plans have been evaluated. In F10 return the name of the plan with the highest projected profit and in F11 that profit.',
    layout: 'Plan names in B5:B8, projected profits in E5:E8 (model formulas).',
    formulas: [
      { cell: 'F10', formula: '=INDEX(B5:B8,MATCH(MAX(E5:E8),E5:E8,0))' },
      { cell: 'F11', formula: '=MAX(E5:E8)' },
      { cell: 'F10 (alternative)', formula: '=XLOOKUP(MAX(E5:E8),E5:E8,B5:B8)' },
    ],
    steps: [
      'MAX finds the best value (MIN for a cost column).',
      'MATCH(best, values, 0) finds where it sits.',
      'INDEX on the names returns the matching name.',
    ],
    pitfalls: [
      'With a tie MATCH returns the first one: mention the tie in words.',
      'Typing the winner by hand earns no formula mark and goes stale if inputs change.',
    ],
    answer: 'F10 shows the plan name (text), F11 its profit.',
  },

  // ---------------------------------------------------------------- if-logic
  {
    id: 'if-logic-weekday-spend-items',
    topic: 'if-logic',
    question: 'A supermarket gives an extra discount on a weekday (Monday to Friday) when the subtotal is at least the amount in H4 and the basket has at least the number of items in H5. In D18 count the items and in D19 compute the extra discount (0 if not eligible).',
    layout: 'Purchase date in C3. Quantities in C6:C15. Subtotal in D17. Extra discount rate in H3 (5%), minimum subtotal in H4 ($80), minimum items in H5 (6).',
    formulas: [
      { cell: 'D18', formula: '=SUM(C6:C15)', note: 'items = total units (state this assumption)' },
      { cell: 'D19', formula: '=IF(AND(WEEKDAY(C3,2)<=5,D17>=H4,D18>=H5),D17*H3,0)' },
    ],
    steps: [
      'Weekday test: WEEKDAY(C3,2)<=5 (Mon = 1 ... Fri = 5).',
      '"At least" is >= for both thresholds.',
      'All three must hold: AND(...). True: subtotal x rate; false: 0.',
    ],
    pitfalls: [
      'WEEKDAY(C3) without ,2 has Sunday = 1, so <=5 includes Sunday and drops Friday.',
      'If "items" could mean product lines, COUNTIF(C6:C15,">0") counts lines instead: write which one you used.',
    ],
    answer: 'A Wednesday basket of 7 items and $92.40: D19 = $4.62. The same basket on a Saturday: $0.',
  },
  {
    id: 'if-logic-or-free-delivery',
    topic: 'if-logic',
    question: 'An online florist waives the delivery fee if the order value is at least the amount in H3 or the customer tier is "Gold". In E5 compute the delivery fee and in F5 the amount payable; fill both down to row 80.',
    layout: 'Order values in C5:C80, customer tiers in D5:D80 ("Gold", "Silver", "Basic"). Standard delivery fee in H2 ($8.90), free-delivery threshold in H3 ($120).',
    formulas: [
      { cell: 'E5 (fill to E5:E80)', formula: '=IF(OR(C5>=$H$3,D5="Gold"),0,$H$2)' },
      { cell: 'F5 (fill to F5:F80)', formula: '=C5+E5' },
    ],
    steps: [
      'Either condition is enough: OR(...).',
      'True: fee 0; false: the standard fee.',
      'Lock H2 and H3, fill down.',
    ],
    pitfalls: [
      'AND instead of OR charges a Gold customer with a $100 order.',
      '"Gold " with a trailing space fails the text test.',
    ],
    answer: '$95 Gold: fee $0. $95 Silver: fee $8.90 ($103.90 payable). $130 Basic: fee $0.',
  },
  {
    id: 'if-logic-nested-three-tiers',
    topic: 'if-logic',
    question: 'A logistics firm pays a year-end bonus of 10% of salary if the performance score is at least 85, 5% if it is at least 70, otherwise nothing. In E5 compute the bonus and fill down to E50.',
    layout: 'Scores in C5:C50, annual salaries in D5:D50. Top rate in H2 (10%), middle rate in H3 (5%), cut-offs in H4 (85) and H5 (70).',
    formulas: [
      { cell: 'E5 (fill to E5:E50)', formula: '=IF(C5>=$H$4,D5*$H$2,IF(C5>=$H$5,D5*$H$3,0))' },
      { cell: 'E5 (IFS alternative)', formula: '=IFS(C5>=$H$4,D5*$H$2,C5>=$H$5,D5*$H$3,TRUE,0)' },
    ],
    steps: [
      'Test the highest tier first: a score of 90 also passes the >=70 test.',
      'The second IF sits in the value-if-false of the first.',
      'The last value-if-false is the default (0).',
    ],
    pitfalls: [
      'Testing >=70 first gives the 90s only 5%.',
      'One closing bracket per IF.',
    ],
    answer: 'Salary $60,000: score 88 earns $6,000, 72 earns $3,000, 69 earns $0.',
  },
  {
    id: 'if-logic-ifs-stock-status',
    topic: 'if-logic',
    question: 'A pharmacy labels each product "Reorder" if stock is at or below its reorder level, "Low" if at or below 1.5 times that level, otherwise "OK". In E5 return the label and fill down to E120. In H3 count the products to reorder.',
    layout: 'Stock on hand in C5:C120, reorder levels in D5:D120. The 1.5 factor in H2.',
    formulas: [
      { cell: 'E5 (fill to E5:E120)', formula: '=IFS(C5<=D5,"Reorder",C5<=$H$2*D5,"Low",TRUE,"OK")' },
      { cell: 'E5 (nested IF alternative)', formula: '=IF(C5<=D5,"Reorder",IF(C5<=$H$2*D5,"Low","OK"))' },
      { cell: 'H3', formula: '=COUNTIF(E5:E120,"Reorder")' },
    ],
    steps: [
      'Order the tests from the most severe to the least.',
      'IFS(test1, result1, test2, result2, TRUE, default).',
      'Count a label with COUNTIF(range,"Reorder").',
    ],
    pitfalls: [
      'Without TRUE as the last test, IFS returns #N/A when nothing matches.',
      'Spell text results exactly as asked: later counts depend on them.',
    ],
    answer: 'Level 40: stock 40 is "Reorder", 55 is "Low" (limit 60), 61 is "OK".',
  },
  {
    id: 'if-logic-overtime-pay',
    topic: 'if-logic',
    question: 'Warehouse staff earn their hourly rate for the first 40 hours a week and 1.5 times that rate for every hour above 40. In E5 compute the weekly pay and fill down to E30.',
    layout: 'Hours worked in C5:C30, hourly rates in D5:D30. Normal-hours limit in H2 (40), overtime multiplier in H3 (1.5).',
    formulas: [
      { cell: 'E5 (fill to E5:E30)', formula: '=MIN(C5,$H$2)*D5+MAX(0,C5-$H$2)*D5*$H$3' },
      { cell: 'E5 (IF alternative)', formula: '=IF(C5<=$H$2,C5*D5,$H$2*D5+(C5-$H$2)*D5*$H$3)' },
    ],
    steps: [
      'Normal hours = MIN(hours, 40).',
      'Overtime hours = MAX(0, hours - 40).',
      'Pay = normal x rate + overtime x rate x 1.5.',
    ],
    pitfalls: [
      'C5*D5*1.5 pays the premium on every hour, not just the extra ones.',
      'Without MAX(0, ...) a 32-hour week gets negative overtime.',
    ],
    answer: '46 h at $15: 40x15 + 6x15x1.5 = $735.00. 32 h at $15: $480.00.',
  },
  {
    id: 'if-logic-minimum-charge',
    topic: 'if-logic',
    question: 'A laundry charges per kg with a minimum charge per order. In D5 compute the charge and fill down to D60. Then give the version that also caps the charge at the amount in H4.',
    layout: 'Order weights in kg in C5:C60. Price per kg in H2 ($3.20), minimum charge in H3 ($12.00), cap in H4 ($40.00).',
    formulas: [
      { cell: 'D5 (fill to D5:D60)', formula: '=MAX($H$3,C5*$H$2)' },
      { cell: 'D5 (with the cap)', formula: '=MIN($H$4,MAX($H$3,C5*$H$2))' },
      { cell: 'D5 (IF alternative)', formula: '=IF(C5*$H$2<$H$3,$H$3,C5*$H$2)' },
    ],
    steps: [
      'A minimum charge = the larger of the minimum and the computed charge: MAX.',
      'A cap = the smaller of the cap and the charge: MIN.',
      'Both: MIN(cap, MAX(minimum, charge)).',
    ],
    pitfalls: [
      'MIN and MAX are easy to swap: a "minimum charge" uses MAX.',
    ],
    answer: '2.5 kg: $8.00 is below the minimum, so $12.00. 5 kg: $16.00. 15 kg: $48.00, or $40.00 with the cap.',
  },
  {
    id: 'if-logic-late-delivery-flag',
    topic: 'if-logic',
    question: 'A furniture retailer promises a delivery date for each order. In E5 return "Late" if delivered after the promised date, else "On time"; in F5 the days late (0 if on time); in G5 compensation of $20 per day late, capped at $200. Fill all three down to row 60.',
    layout: 'Promised dates in C5:C60, actual delivery dates in D5:D60. Compensation per day in J2 ($20), cap in J3 ($200).',
    formulas: [
      { cell: 'E5 (fill to E5:E60)', formula: '=IF(D5>C5,"Late","On time")' },
      { cell: 'F5 (fill to F5:F60)', formula: '=MAX(0,D5-C5)' },
      { cell: 'G5 (fill to G5:G60)', formula: '=MIN($J$3,F5*$J$2)' },
    ],
    steps: [
      'Dates are day numbers: D5 - C5 is days.',
      'Delivered on the promised day is on time: test > not >=.',
      'MAX(0, ...) stops negative days; MIN applies the cap.',
    ],
    pitfalls: [
      'Format F as Number: a day count formatted as a date shows 1900 dates.',
      'Compare date cells, never typed text like "15/3/2026".',
    ],
    answer: 'Promised 12 Oct 2026, delivered 16 Oct: "Late", 4 days, $80. Delivered 25 Oct: 13 days, $260 capped to $200.',
  },

  // ---------------------------------------------------------------- dates
  {
    id: 'dates-day-name',
    topic: 'dates',
    question: 'A spa booking list needs the day of each booking. In D5 show the short day name (Mon, Tue, ...) and in E5 the day number with Monday = 1; fill both down to row 80.',
    layout: 'Booking dates in C5:C80.',
    formulas: [
      { cell: 'D5 (fill to D5:D80)', formula: '=TEXT(C5,"ddd")' },
      { cell: 'D5 (full day name)', formula: '=TEXT(C5,"dddd")' },
      { cell: 'E5 (fill to E5:E80)', formula: '=WEEKDAY(C5,2)' },
    ],
    steps: [
      'TEXT(date,"ddd") gives Mon; "dddd" gives Monday.',
      'WEEKDAY(date,2) gives 1 for Monday ... 7 for Sunday.',
    ],
    pitfalls: [
      'TEXT returns text: use WEEKDAY, not the day name, inside rules.',
      'Formatting C5 as "ddd" only changes the display; the value is still the date.',
    ],
    answer: '9 Nov 2026 gives "Mon" and 1.',
  },
  {
    id: 'dates-weekend-holiday-surcharge',
    topic: 'dates',
    question: 'A party venue charges 20% more on Saturdays, Sundays and public holidays. In E5 return "Peak" or "Off-peak" and in F5 the price including any surcharge; fill both down to row 60.',
    layout: 'Event dates in C5:C60, base prices in D5:D60. Surcharge rate in H2 (20%). Public holiday dates in J5:J15.',
    formulas: [
      { cell: 'E5 (fill to E5:E60)', formula: '=IF(OR(WEEKDAY(C5,2)>5,COUNTIF($J$5:$J$15,C5)>0),"Peak","Off-peak")' },
      { cell: 'F5 (fill to F5:F60)', formula: '=IF(E5="Peak",D5*(1+$H$2),D5)' },
    ],
    steps: [
      'WEEKDAY(date,2) is 6 for Saturday and 7 for Sunday: >5 means weekend.',
      'COUNTIF(holiday list, date)>0 is TRUE when the date is a listed holiday.',
      'Join with OR; lock the holiday list and the rate.',
    ],
    pitfalls: [
      'WEEKDAY(C5)>5 without ,2 flags Friday and Saturday.',
      'Holiday cells must be real dates, not text.',
    ],
    answer: 'Sat 12 Dec 2026, $2,000: "Peak", $2,400. Fri 11 Dec 2026 (not a holiday): "Off-peak", $2,000.',
  },
  {
    id: 'dates-days-between-nights',
    topic: 'dates',
    question: 'A hotel charges per night. In E5 compute the nights between check-in and check-out and in F5 the room charge; fill both down to row 40. In E3 count the bookings longer than 7 nights.',
    layout: 'Check-in dates in C5:C40, check-out dates in D5:D40. Nightly rate in H2 ($180). Nights go in E5:E40, charges in F5:F40.',
    formulas: [
      { cell: 'E5 (fill to E5:E40)', formula: '=D5-C5' },
      { cell: 'F5 (fill to F5:F40)', formula: '=E5*$H$2' },
      { cell: 'E3', formula: '=COUNTIF(E5:E40,">7")' },
    ],
    steps: [
      'Nights = check-out - check-in (dates are day numbers).',
      'Format E as Number, not Date.',
      'Charge = nights x locked rate.',
    ],
    pitfalls: [
      'Days counted inclusively (a rental from the 1st to the 3rd is 3 days) need +1; nights do not.',
    ],
    answer: 'Check-in 28 Dec 2026, check-out 3 Jan 2027: 6 nights, $1,080.',
  },
  {
    id: 'dates-age-in-years',
    topic: 'dates',
    question: 'An insurer prices policies by age in completed years on the valuation date in H2. In D5 compute the age of the customer in row 5 and fill down to D200.',
    layout: 'Dates of birth in C5:C200. Valuation date in H2 (9 Nov 2026).',
    formulas: [
      { cell: 'D5 (fill to D5:D200)', formula: '=YEAR($H$2)-YEAR(C5)-IF(DATE(YEAR($H$2),MONTH(C5),DAY(C5))>$H$2,1,0)', note: 'minus 1 if the birthday has not yet come this year' },
      { cell: 'D5 (approximate, course version)', formula: '=INT(($H$2-C5)/365.25)' },
      { cell: 'D5 (alternative, not taught)', formula: '=DATEDIF(C5,$H$2,"Y")' },
    ],
    steps: [
      'Year difference: YEAR(valuation) - YEAR(birth).',
      'Rebuild the birthday in the valuation year: DATE(YEAR(H2),MONTH(C5),DAY(C5)).',
      'If that birthday is after the valuation date, subtract 1.',
      'Use the given date cell, not TODAY(), when the question fixes the date.',
    ],
    pitfalls: [
      'YEAR(H2)-YEAR(C5) alone is a year too high for birthdays later in the year.',
      'The 365.25 version can be a day off near a birthday: use it only if an approximation is accepted.',
    ],
    answer: 'Born 15 Mar 2000: 26. Born 20 Dec 2000: 25.',
  },
  {
    id: 'dates-birthday-month-points',
    topic: 'dates',
    question: 'A retailer sends a voucher to members whose birthday month is the month of the mailing date in H2 and who have at least the points in H3. In E5 compute the voucher value (0 if not eligible) and fill down to E300. In H6 compute the total value of vouchers.',
    layout: 'Dates of birth in C5:C300, loyalty points in D5:D300. Mailing date in H2 (a November 2026 date), minimum points in H3 (500), voucher value in H4 ($10).',
    formulas: [
      { cell: 'E5 (fill to E5:E300)', formula: '=IF(AND(MONTH(C5)=MONTH($H$2),D5>=$H$3),$H$4,0)' },
      { cell: 'E5 (if the rule says "this month")', formula: '=IF(AND(MONTH(C5)=MONTH(TODAY()),D5>=$H$3),$H$4,0)' },
      { cell: 'H6', formula: '=SUM(E5:E300)' },
    ],
    steps: [
      'Compare months with months: MONTH(birth) = MONTH(mailing date).',
      'Points rule: >= H3.',
      'Both must hold: AND; lock H2:H4 and fill down.',
    ],
    pitfalls: [
      'MONTH(C5)=H2 compares 11 with a date number: always FALSE.',
      'C5=H2 compares full dates, birth year included: almost never TRUE.',
    ],
    answer: 'November mailing: born 3 Nov 1990 with 620 points gets $10; with 480 points gets $0.',
  },
  {
    id: 'dates-due-date-overdue',
    topic: 'dates',
    question: 'An accounts team tracks invoices. In F5 compute the due date, in G5 the days overdue as at the date in J2 (0 if paid or not yet due), and in H5 a flag "Overdue" or "OK". Fill all three down to row 80.',
    layout: 'Invoice dates in C5:C80, payment terms in days in D5:D80 (30 or 60), paid status in E5:E80 ("Y" or "N"). As-at date in J2 (9 Nov 2026).',
    formulas: [
      { cell: 'F5 (fill to F5:F80)', formula: '=C5+D5' },
      { cell: 'G5 (fill to G5:G80)', formula: '=IF(AND(E5="N",$J$2>F5),$J$2-F5,0)' },
      { cell: 'H5 (fill to H5:H80)', formula: '=IF(G5>0,"Overdue","OK")' },
    ],
    steps: [
      'Due date = invoice date + terms; format F as a date.',
      'Overdue only if unpaid AND as-at date > due date (due today is not yet overdue).',
      'Days overdue = as-at date - due date.',
      'Lock J2; use TODAY() only if the question says "today".',
    ],
    pitfalls: [
      'TODAY() instead of the given as-at date changes every day and will not match the key.',
      'A due date shown as 46,000-something just needs a date format.',
    ],
    answer: 'Invoice 15 Sep 2026, 30 days, unpaid: due 15 Oct 2026, 25 days overdue, "Overdue".',
  },
  {
    id: 'dates-within-promo-window',
    topic: 'dates',
    question: 'A members-only sale runs from the date in H2 to the date in H3, both inclusive. In E5 return "Promo" if the order date is inside the window (else blank) and in F5 the discount on the order; fill both down to row 150.',
    layout: 'Order dates in C5:C150, order values in D5:D150. Window start in H2, window end in H3, discount rate in H4 (15%).',
    formulas: [
      { cell: 'E5 (fill to E5:E150)', formula: '=IF(AND(C5>=$H$2,C5<=$H$3),"Promo","")' },
      { cell: 'F5 (fill to F5:F150)', formula: '=IF(AND(C5>=$H$2,C5<=$H$3),D5*$H$4,0)' },
      { cell: 'F5 (if C holds date AND time)', formula: '=IF(AND(INT(C5)>=$H$2,INT(C5)<=$H$3),D5*$H$4,0)' },
    ],
    steps: [
      'Inclusive window: >= start AND <= end.',
      'Lock the window cells.',
      'If orders carry a time stamp, drop the time with INT() first.',
    ],
    pitfalls: [
      'A 3 pm order on the end date is larger than the end date itself, so <= H3 wrongly excludes it unless you use INT.',
      'Typed text dates ("1/12/2026") inside the formula compare as text: use the cells or DATE(2026,12,1).',
    ],
    answer: 'Window 1 to 7 Dec 2026: a $200 order on 7 Dec gets "Promo" and $30; one on 8 Dec gets $0.',
  },

  // ---------------------------------------------------------------- time-arith
  {
    id: 'time-arith-duration-hours',
    topic: 'time-arith',
    question: 'A car park records entry and exit times. In E5 compute the parking duration in hours (a number) and in F5 in minutes; fill both down to row 200.',
    layout: 'Entry times in C5:C200, exit times in D5:D200 (hh:mm, same day).',
    formulas: [
      { cell: 'E5 (fill to E5:E200)', formula: '=(D5-C5)*24' },
      { cell: 'F5 (fill to F5:F200)', formula: '=(D5-C5)*1440' },
      { cell: 'F5 (whole minutes)', formula: '=ROUND((D5-C5)*1440,0)' },
    ],
    steps: [
      'D5 - C5 is a fraction of a day.',
      'x24 for hours, x1440 for minutes, x86400 for seconds.',
      'Format E and F as Number, not as a time.',
    ],
    pitfalls: [
      'D5-C5 formatted hh:mm shows 2:35 but its value is 0.1076: a rate multiplied by it is wrong.',
    ],
    answer: '08:45 to 11:20: E5 = 2.5833 hours, F5 = 155 minutes.',
  },
  {
    id: 'time-arith-prorated-hourly-charge',
    topic: 'time-arith',
    question: 'A co-working meeting room costs the hourly rate in H2, charged by the minute. In E5 compute the charge for the booking in row 5 and fill down to E60.',
    layout: 'Start times in C5:C60, end times in D5:D60. Hourly rate in H2 ($24).',
    formulas: [
      { cell: 'E5 (fill to E5:E60)', formula: '=(D5-C5)*24*$H$2' },
      { cell: 'E5 (same, via minutes)', formula: '=(D5-C5)*1440*$H$2/60' },
    ],
    steps: [
      'Hours = (end - start) x 24, including the part hour.',
      'Charge = hours x locked hourly rate.',
    ],
    pitfalls: [
      '(D5-C5)*$H$2 without x24 charges 1/24 of the right amount.',
      'HOUR(D5-C5)*rate drops the minutes: not prorated.',
    ],
    answer: '09:10 to 11:55 is 2.75 hours: $66.00.',
  },
  {
    id: 'time-arith-add-minutes',
    topic: 'time-arith',
    question: 'A delivery app estimates arrival as dispatch time plus travel minutes. In E5 compute the estimated arrival time (format hh:mm) and fill down to E100.',
    layout: 'Dispatch times in C5:C100, travel times in whole minutes (numbers) in D5:D100.',
    formulas: [
      { cell: 'E5 (fill to E5:E100)', formula: '=C5+D5/1440' },
      { cell: 'E5 (alternative)', formula: '=C5+TIME(0,D5,0)' },
    ],
    steps: [
      'Turn minutes into a day fraction: divide by 1440 (24 x 60).',
      'Add to the clock time; format hh:mm.',
    ],
    pitfalls: [
      '=C5+D5 adds D5 DAYS: the clock shows the same time.',
      'TIME(0,D5,0) wraps past midnight (drops whole days): fine for a clock time, not for long durations.',
    ],
    answer: '10:47 + 38 minutes = 11:25.',
  },
  {
    id: 'time-arith-add-seconds-chain',
    topic: 'time-arith',
    question: 'An assembly cell processes units one after another. In E5 compute each unit finish time (start + cycle seconds) and fill down to E60; in C6 start the next unit when the previous one finishes and fill down to C60.',
    layout: 'Start times in C5:C60 (C5 typed 08:00:00), cycle times in seconds in D5:D60, finish times in E5:E60.',
    formulas: [
      { cell: 'E5 (fill to E5:E60)', formula: '=C5+D5/86400' },
      { cell: 'C6 (fill to C6:C60)', formula: '=E5' },
      { cell: 'E5 (alternative)', formula: '=C5+TIME(0,0,D5)' },
    ],
    steps: [
      'Seconds to a day fraction: /86400 (24 x 60 x 60).',
      'Finish = start + cycle; next start = previous finish.',
      'Format C and E as hh:mm:ss.',
    ],
    pitfalls: [
      'TIME(0,0,s) only accepts up to 32,767 seconds; /86400 has no limit.',
      '+D5 without /86400 adds days, not seconds.',
    ],
    answer: '08:00:00 + 95 s: E5 = 08:01:35 and C6 = 08:01:35.',
  },
  {
    id: 'time-arith-minutes-to-hhmm',
    topic: 'time-arith',
    question: 'A call-centre report gives total talk time per agent in minutes. In D5 convert it to a time value shown as [h]:mm and in E5 to the text "h:mm"; fill both down to row 40.',
    layout: 'Total talk minutes in C5:C40 (numbers, can exceed 1,440).',
    formulas: [
      { cell: 'D5 (fill to D5:D40)', formula: '=C5/1440', note: 'format the cell [h]:mm' },
      { cell: 'E5 (fill to E5:E40)', formula: '=TEXT(C5/1440,"[h]:mm")' },
      { cell: 'D5 (alternative, under 24 h)', formula: '=TIME(INT(C5/60),MOD(C5,60),0)' },
    ],
    steps: [
      'Minutes / 1440 = a day fraction Excel can show as a time.',
      'Use the [h]:mm format so totals over 24 hours are not reset.',
    ],
    pitfalls: [
      'hh:mm without brackets resets at 24 h: 1,575 minutes shows 02:15 instead of 26:15.',
      'Dividing by 60 gives decimal hours (2.25), not a time: 2.25 formatted hh:mm shows 06:00.',
    ],
    answer: '135 minutes: D5 = 0.09375, shown 2:15. 1,575 minutes shows 26:15.',
  },
  {
    id: 'time-arith-across-midnight',
    topic: 'time-arith',
    question: 'Security guards work shifts that may end after midnight. In E5 compute the shift length in hours and fill down to E50.',
    layout: 'Shift start times in C5:C50, end times in D5:D50 (clock times only, no dates; every shift is under 24 hours).',
    formulas: [
      { cell: 'E5 (fill to E5:E50)', formula: '=MOD(D5-C5,1)*24' },
      { cell: 'E5 (IF alternative)', formula: '=IF(D5<C5,D5+1-C5,D5-C5)*24' },
    ],
    steps: [
      'If the end is earlier than the start, the shift crossed midnight: add 1 day to the end.',
      'MOD(end - start, 1) does that automatically.',
      'x24 for hours.',
    ],
    pitfalls: [
      'Plain D5-C5 for 22:30 to 06:15 is negative (##### as a time).',
      'If the cells hold full date-times, plain D5-C5 already works: do not add 1.',
    ],
    answer: '22:30 to 06:15: 7.75 hours. 09:00 to 17:30: 8.5 hours.',
  },
  {
    id: 'time-arith-roundup-15-min-blocks',
    topic: 'time-arith',
    question: 'A legal clinic bills in 15-minute blocks, always rounding up. For each consultation compute the blocks billed in E5, billable hours in F5 and the fee in G5 at the hourly rate in J2. Fill all three down to row 80.',
    layout: 'Start times in C5:C80, end times in D5:D80 (hh:mm). Hourly rate in J2 ($80).',
    formulas: [
      { cell: 'E5 (fill to E5:E80)', formula: '=ROUNDUP(ROUND((D5-C5)*96,6),0)', note: '96 quarter-hours per day; inner ROUND keeps an exact 45 min at 3 blocks' },
      { cell: 'F5 (fill to F5:F80)', formula: '=E5/4' },
      { cell: 'G5 (fill to G5:G80)', formula: '=F5*$J$2' },
      { cell: 'F5 (as a time value instead)', formula: '=ROUNDUP(ROUND((D5-C5)*96,6),0)/96', note: 'format [h]:mm' },
    ],
    steps: [
      'Quarter-hours = (end - start) x 96 (same as x24x4).',
      'ROUNDUP(...,0) to the next whole block; ROUND(...,6) inside removes floating-point dust.',
      'Hours = blocks / 4; fee = hours x rate.',
    ],
    pitfalls: [
      'ROUND instead of ROUNDUP bills 77 minutes as 5 blocks instead of 6.',
      'Without the inner ROUND, 11:45 to 12:30 computes as 3.000000000000005 blocks and rounds up to 4.',
    ],
    answer: '14:05 to 15:22 (77 min): 6 blocks, 1.5 hours, $120.00. Exactly 45 minutes: 3 blocks, $60.00.',
  },
  {
    id: 'time-arith-within-opening-hours',
    topic: 'time-arith',
    question: 'A food-court stall opens at the time in H2 and closes at the time in H3. In E5 compute the time of day of the order in hours, and in D5 return "Open" if it is within opening hours (opening included, closing excluded), else "Closed". Fill both down to row 500.',
    layout: 'Order timestamps (date and time) in C5:C500. Opening time in H2 (10:00), closing time in H3 (22:00).',
    formulas: [
      { cell: 'E5 (fill to E5:E500)', formula: '=ROUND(MOD(C5,1)*24,6)', note: 'MOD(C5,1) drops the date; x24 and ROUND give a clean hour value' },
      { cell: 'D5 (fill to D5:D500)', formula: '=IF(AND(E5>=ROUND($H$2*24,6),E5<ROUND($H$3*24,6)),"Open","Closed")' },
      { cell: 'D5 (if closing is after midnight, e.g. 18:00 to 02:00)', formula: '=IF(OR(E5>=ROUND($H$2*24,6),E5<ROUND($H$3*24,6)),"Open","Closed")' },
      { cell: 'D5 (one cell, no helper column)', formula: '=IF(AND(ROUND(MOD(C5,1)*24,6)>=ROUND($H$2*24,6),ROUND(MOD(C5,1)*24,6)<ROUND($H$3*24,6)),"Open","Closed")' },
    ],
    steps: [
      'Strip the date: MOD(timestamp,1) is the time of day.',
      'Turn both sides into rounded hours: ROUND(x*24,6).',
      'Within hours: >= opening AND < closing. Hours across midnight: OR instead of AND.',
    ],
    pitfalls: [
      'Without ROUND, MOD of a 22:00 timestamp is a hair under 22:00 (0.91666666666424 vs 0.91666666666667), so an order at exactly 22:00 shows "Open".',
      'A full timestamp (e.g. 46,335.9) is always greater than 10:00 (0.4167): strip the date first.',
    ],
    answer: 'An order at 21:59 is "Open", at exactly 22:00 "Closed", at exactly 10:00 "Open".',
  },
  {
    id: 'time-arith-mb-to-gb-cost',
    topic: 'time-arith',
    question: 'A video studio pays cloud storage per GB per month, with 1 GB = 1,000 MB as stated. In D5 convert each file size to GB and in E5 compute its monthly cost; fill both down to row 40. In E42 compute the total monthly cost.',
    layout: 'File sizes in MB in C5:C40. Price per GB per month in H2 ($0.023). MB per GB in H3 (1000). Sizes in GB go in D5:D40, monthly cost per file in E5:E40.',
    formulas: [
      { cell: 'D5 (fill to D5:D40)', formula: '=C5/$H$3' },
      { cell: 'E5 (fill to E5:E40)', formula: '=D5*$H$2' },
      { cell: 'E42', formula: '=SUM(E5:E40)' },
      { cell: 'E42 (one cell, no helper columns)', formula: '=SUM(C5:C40)/H3*H2' },
    ],
    steps: [
      'Use exactly the factor given (1000 here; 1024 only if stated), kept in a cell.',
      'GB = MB / factor; cost = GB x price.',
    ],
    pitfalls: [
      'Multiplying by 1000 instead of dividing gives a cost a million times too high.',
      'Never mix MB and GB in one SUMPRODUCT.',
    ],
    answer: 'A 2,350 MB file is 2.35 GB and costs $0.05405 a month.',
  },

  // ---------------------------------------------------------------- capacity
  {
    id: 'capacity-units-sold-min',
    topic: 'capacity',
    question: 'A concert hall sells tickets for 7 shows. In E5 compute the tickets sold (demand capped by seats) and in F5 the revenue; fill both down to row 11.',
    layout: 'Demand per show in C5:C11, seats available in D5:D11. Ticket price in J2 ($68).',
    formulas: [
      { cell: 'E5 (fill to E5:E11)', formula: '=MIN(C5,D5)' },
      { cell: 'F5 (fill to F5:F11)', formula: '=E5*$J$2' },
    ],
    steps: [
      'Sold = the smaller of demand and seats: MIN.',
      'Revenue = sold x locked price.',
    ],
    pitfalls: [
      'Revenue on demand (C5 x price) counts tickets that could not be sold.',
    ],
    answer: 'Demand 1,240, seats 1,100: 1,100 sold, $74,800.',
  },
  {
    id: 'capacity-unsold-max',
    topic: 'capacity',
    question: 'A bakery bakes a fixed batch of croissants each day and donates the unsold ones. In E5 compute croissants sold, in F5 those left over (never negative) and in G5 the day profit; fill down to row 34.',
    layout: 'Daily demand in C5:C34, croissants baked in D5:D34. Price in J2 ($3.20), baking cost per croissant in J3 ($1.10).',
    formulas: [
      { cell: 'E5 (fill to E5:E34)', formula: '=MIN(C5,D5)' },
      { cell: 'F5 (fill to F5:F34)', formula: '=MAX(0,D5-C5)' },
      { cell: 'G5 (fill to G5:G34)', formula: '=E5*$J$2-D5*$J$3' },
    ],
    steps: [
      'Sold = MIN(demand, baked).',
      'Left over = MAX(0, baked - demand).',
      'Profit = revenue on sold units - cost of ALL units baked.',
    ],
    pitfalls: [
      'D5-C5 without MAX gives negative leftovers on busy days.',
      'Costing only the sold units understates cost.',
    ],
    answer: 'Demand 150, baked 180: sold 150, left 30, profit 150x3.20 - 180x1.10 = $282.00.',
  },
  {
    id: 'capacity-lost-sales',
    topic: 'capacity',
    question: 'A chicken-rice stall prepares a fixed number of portions per day. In E5 compute portions turned away and in F5 the lost margin; fill both down to row 34. In F36 total the lost margin for the month.',
    layout: 'Daily demand in C5:C34, portions prepared in D5:D34. Margin per portion in J2 ($2.80). Lost portions go in E5:E34, lost margin in F5:F34.',
    formulas: [
      { cell: 'E5 (fill to E5:E34)', formula: '=MAX(0,C5-D5)' },
      { cell: 'F5 (fill to F5:F34)', formula: '=E5*$J$2' },
      { cell: 'F36', formula: '=SUM(F5:F34)' },
      { cell: 'E5 (equivalent)', formula: '=C5-MIN(C5,D5)' },
    ],
    steps: [
      'Lost sales = demand above what was prepared, never negative: MAX(0, demand - prepared).',
      'Lost margin = lost portions x margin.',
    ],
    pitfalls: [
      'C5-D5 alone is negative on quiet days and cancels real losses in the monthly total.',
    ],
    answer: 'Demand 320, prepared 280: 40 lost, $112.00 margin lost.',
  },
  {
    id: 'capacity-trucks-roundup',
    topic: 'capacity',
    question: 'A beverage distributor ships cartons to supermarkets. In E5 compute the trucks needed, in F5 the delivery cost and in G5 the spare carton space on the trucks used; fill down to row 30.',
    layout: 'Cartons ordered per supermarket in C5:C30. Truck capacity in J2 (240 cartons), cost per truck trip in J3 ($180).',
    formulas: [
      { cell: 'E5 (fill to E5:E30)', formula: '=ROUNDUP(C5/$J$2,0)' },
      { cell: 'F5 (fill to F5:F30)', formula: '=E5*$J$3' },
      { cell: 'G5 (fill to G5:G30)', formula: '=E5*$J$2-C5' },
    ],
    steps: [
      'Containers always round UP: a part-load still needs a whole truck.',
      'Cost = trucks x cost per truck.',
      'Spare space = trucks x capacity - cartons.',
    ],
    pitfalls: [
      'ROUND(4.2,0) = 4 leaves cartons behind: always ROUNDUP.',
      'INT or ROUNDDOWN also undercounts.',
    ],
    answer: '1,130 cartons: 4.71, so 5 trucks, $900, spare 70 cartons.',
  },
  {
    id: 'capacity-cheaper-pricing-option',
    topic: 'capacity',
    question: 'A bicycle kiosk charges $6 per hour (prorated) or $15 per 3-hour pass, whichever is cheaper. For each rental compute hours in E5, hourly charge in F5, passes needed in G5, pass charge in H5, amount paid in I5 and the option used in J5. Fill down to row 60.',
    layout: 'Rental start times in C5:C60, return times in D5:D60 (same day). Hourly rate in M2 ($6), pass price in M3 ($15), hours per pass in M4 (3).',
    formulas: [
      { cell: 'E5 (fill to E5:E60)', formula: '=ROUND((D5-C5)*24,6)' },
      { cell: 'F5 (fill to F5:F60)', formula: '=E5*$M$2' },
      { cell: 'G5 (fill to G5:G60)', formula: '=ROUNDUP(E5/$M$4,0)' },
      { cell: 'H5 (fill to H5:H60)', formula: '=G5*$M$3' },
      { cell: 'I5 (fill to I5:I60)', formula: '=MIN(F5,H5)' },
      { cell: 'J5 (fill to J5:J60)', formula: '=IF(F5<=H5,"Hourly","Pass")' },
    ],
    steps: [
      'Hours from the times (x24, rounded).',
      'Option 1 = hours x rate. Option 2 = ROUNDUP(hours / 3) passes x pass price.',
      'Paid = MIN of the two; label with IF.',
    ],
    pitfalls: [
      'Passes need ROUNDUP: 4.5 hours needs 2 passes, not 1.5.',
      'Compute each option in its own cell first: MIN is then easy to check.',
    ],
    answer: '13:00 to 17:30 (4.5 h): $27.00 vs $30.00, pays $27.00 "Hourly". 09:00 to 15:00 (6 h): $36.00 vs $30.00, pays $30.00 "Pass".',
  },
  {
    id: 'capacity-end-of-period-stock',
    topic: 'capacity',
    question: 'A warehouse tracks weekly stock. For each week compute units shipped in F5 (demand capped by stock available), closing stock in G5 and unmet demand in H5, filling rows 5 to 16; in C6 make each week open with the previous closing stock and fill down to C16.',
    layout: 'Opening stock in C5:C16 (only C5 typed: 500), receipts in D5:D16, demand in E5:E16.',
    formulas: [
      { cell: 'F5 (fill to F5:F16)', formula: '=MIN(C5+D5,E5)' },
      { cell: 'G5 (fill to G5:G16)', formula: '=C5+D5-F5' },
      { cell: 'H5 (fill to H5:H16)', formula: '=E5-F5' },
      { cell: 'C6 (fill to C6:C16)', formula: '=G5' },
    ],
    steps: [
      'Available this week = opening + receipts.',
      'Shipped = MIN(available, demand).',
      'Closing = available - shipped; next opening = this closing.',
      'Unmet demand = demand - shipped.',
    ],
    pitfalls: [
      'Typing each week opening stock by hand breaks the chain: only week 1 is typed.',
      'A negative closing stock means the MIN is missing.',
    ],
    answer: 'Week 1: 500 + 200 in, demand 650: ship 650, close 50. Week 2: 50 + 0 in, demand 300: ship 50, close 0, unmet 250.',
  },

  // ---------------------------------------------------------------- trend
  {
    id: 'trend-forecast-fill-down',
    topic: 'trend',
    question: 'A bubble-tea chain has 24 months of order history. In C29 forecast month 25 with a straight-line trend and fill down to C34 for months 25 to 30.',
    layout: 'Month numbers 1 to 30 in B5:B34 (B5:B28 history, B29:B34 months to forecast). Orders for months 1 to 24 in C5:C28.',
    formulas: [
      { cell: 'C29 (fill to C29:C34)', formula: '=TREND($C$5:$C$28,$B$5:$B$28,B29)', note: 'known y, known x, new x' },
      { cell: 'C29 (alternative)', formula: '=FORECAST.LINEAR(B29,$C$5:$C$28,$B$5:$B$28)' },
    ],
    steps: [
      'TREND(known_y, known_x, new_x): y = orders, x = month number.',
      'Lock the history ranges; leave the new x (B29) relative.',
      'Fill to C34 and check C34 still reads $C$5:$C$28.',
    ],
    pitfalls: [
      'Unlocked ranges slide down and treat earlier forecasts as history.',
      'Swapping y and x fits the wrong line.',
      'If the periods are month names, use a column of month numbers as x.',
    ],
    answer: 'Six forecasts in C29:C34 that change by the same amount (the slope) each month.',
  },
  {
    id: 'trend-forecast-linear-driver',
    topic: 'trend',
    question: 'A retail chain models monthly sales against advertising spend (both in $000). In G4 forecast sales for the ad spend planned in G3.',
    layout: 'Ad spend history in B5:B10 (10, 12, 15, 18, 20, 25), sales in C5:C10 (120, 131, 150, 163, 178, 205), both in $000. Planned ad spend in G3 (22).',
    formulas: [
      { cell: 'G4', formula: '=FORECAST.LINEAR(G3,C5:C10,B5:B10)', note: 'new x FIRST, then known y, then known x' },
      { cell: 'G4 (same with TREND)', formula: '=TREND(C5:C10,B5:B10,G3)' },
    ],
    steps: [
      'x = the driver (ad spend), y = what you forecast (sales).',
      'FORECAST.LINEAR(new_x, known_y, known_x) vs TREND(known_y, known_x, new_x): different order, same answer.',
      'Quote the result with units.',
    ],
    pitfalls: [
      'Using the TREND argument order inside FORECAST.LINEAR gives a nonsense value.',
    ],
    answer: 'G4 = 188.06, about $188,000 of sales (line: y = 5.667x + 63.38).',
  },
  {
    id: 'trend-equation-from-chart',
    topic: 'trend',
    question: 'A scatter chart of quarterly revenue (x = quarter 1 to 12) has a linear trendline labelled y = 152.4x + 3180. (i) Explain the slope and intercept. (ii) In C17 forecast quarter 13 from the equation and in D17 with TREND as a check. (iii) In G5 and G6 recover the slope and intercept from the data.',
    layout: 'Quarter numbers in B5:B17 (1 to 12 history, 13 in B17), revenue in $000 for quarters 1 to 12 in C5:C16. Slope typed in G3 (152.4), intercept in G4 (3180).',
    formulas: [
      { cell: 'C17', formula: '=G3*B17+G4', note: 'y = m x + c' },
      { cell: 'D17', formula: '=TREND($C$5:$C$16,$B$5:$B$16,B17)' },
      { cell: 'G5', formula: '=TREND(C5:C16,B5:B16,1)-TREND(C5:C16,B5:B16,0)', note: 'slope = line value at x=1 minus at x=0' },
      { cell: 'G6', formula: '=TREND(C5:C16,B5:B16,0)', note: 'intercept = line value at x=0' },
      { cell: 'G5 (alternative, not taught)', formula: '=SLOPE(C5:C16,B5:B16)' },
    ],
    steps: [
      'Chart: Insert > Scatter on B5:C16, Add Trendline > Linear > Display Equation on chart.',
      'Slope 152.4: revenue rises about $152,400 per quarter. Intercept 3180: the line value at x = 0.',
      'Forecast = 152.4 x 13 + 3180; TREND on the same data agrees up to the rounding of the label.',
    ],
    pitfalls: [
      'On a LINE chart the trendline uses x = 1, 2, 3, ... whatever the labels; on a scatter it uses the real x values (e.g. years 2019, 2020), giving a very different intercept.',
      'The chart label is rounded, so D17 can differ from C17 in the last digits.',
    ],
    answer: 'C17 = 152.4 x 13 + 3180 = 5,161.2, about $5.16 million in quarter 13.',
  },

  // ---------------------------------------------------------------- goal-seek
  {
    id: 'goal-seek-break-even-price',
    topic: 'goal-seek',
    question: 'A start-up sells a gadget whose demand falls as the price rises. Use Goal Seek to find the lowest price in B4 at which profit in B9 is exactly 0, then find the second break-even price.',
    layout: 'Price in B4 (typed input). Unit variable cost in B5 ($8), fixed cost in B6 ($30,000). Demand intercept in E4 (6000), demand slope in E5 (150 units per $1). Units in B7, revenue in B8, profit in B9.',
    formulas: [
      { cell: 'B7', formula: '=E4-E5*B4' },
      { cell: 'B8', formula: '=B4*B7' },
      { cell: 'B9', formula: '=B8-B5*B7-B6' },
    ],
    tool: [
      'Type a start price of 15 in B4',
      'Data > What-If Analysis > Goal Seek',
      'Set cell: B9',
      'To value: 0',
      'By changing cell: B4',
      'Repeat from a start price of 35 for the second root',
    ],
    steps: [
      'Build units, revenue and profit as formulas that depend on B4.',
      'Type a start value in B4 near the answer you want.',
      'Goal Seek B9 to 0 by changing B4; check B9 shows 0 (or a tiny number).',
      'Profit is a hill here, so there are two break-even prices: rerun from a high start.',
    ],
    pitfalls: [
      'B4 must hold a typed number, not a formula.',
      'Goal Seek usually returns the root nearest the start value, never both: run it twice.',
    ],
    answer: 'B4 = $16.52 from a start of 15 and $31.48 from a start of 35 (exact roots 24 +/- SQRT(56)). Profit is positive between them.',
  },
  {
    id: 'goal-seek-latest-finish-time',
    topic: 'goal-seek',
    question: 'A recording studio prices by session length: the band rate applies to the whole session, prorated by the minute. A band booked from 14:00 has $150 to spend. Use Goal Seek to find the LATEST end time in B5 that keeps the charge in B8 at the budget.',
    layout: 'Start time in B4 (14:00). End time in B5 (typed input). Hours in B6, hourly rate in B7, charge in B8. Budget in B10 ($150). Rate table: lower bounds in hours E4:E6 (0, 2, 4), hourly rates F4:F6 ($45, $40, $36).',
    formulas: [
      { cell: 'B6', formula: '=ROUND((B5-B4)*24,6)' },
      { cell: 'B7', formula: '=VLOOKUP(B6,$E$4:$F$6,2,TRUE)' },
      { cell: 'B8', formula: '=B6*B7' },
    ],
    tool: [
      'Type a start end time of 18:30 in B5 (inside the top band)',
      'Data > What-If Analysis > Goal Seek',
      'Set cell: B8',
      'To value: 150 (typed: the box cannot point at B10)',
      'By changing cell: B5',
      'Format B5 as hh:mm:ss and check B6 is still at least 4 hours',
    ],
    steps: [
      'The charge DROPS where a cheaper band starts (3.99 h costs $159.60, 4 h costs $144), so it is not monotonic.',
      'Two end times cost exactly $150: 17:45 (3.75 h at $40) and 18:10 (4.1667 h at $36). The latest is 18:10.',
      'Start Goal Seek inside the top band (18:30) so it converges to 18:10, then confirm the band in B6/B7.',
    ],
    pitfalls: [
      'Starting below 18:00 (e.g. 17:00) tends to converge to 17:45, which is not the latest time.',
      'Report the end time in B5, not the charge.',
      'Goal Seek can stop a fraction of a second away: report 18:10:00.',
    ],
    answer: 'B5 = 18:10:00 (4 h 10 min at $36/h = $150). Any later end time costs more than $150.',
  },
  {
    id: 'goal-seek-required-rate',
    topic: 'goal-seek',
    question: 'A saver has $20,000 now and adds $500 at the end of every month for 10 years. Use Goal Seek to find the annual rate in B2 (compounded monthly) that makes the balance in B7 reach $120,000. Check it with a formula in B8.',
    layout: 'Annual rate in B2 (typed input, start at 5%). Years in B3 (10). Amount now in B4 ($20,000). Monthly deposit in B5 ($500). Balance after 10 years in B7.',
    formulas: [
      { cell: 'B7', formula: '=FV(B2/12,B3*12,-B5,-B4)', note: 'deposits are paid in, so negative' },
      { cell: 'B8 (check without Goal Seek)', formula: '=RATE(B3*12,-B5,-B4,120000)*12' },
    ],
    tool: [
      'Data > What-If Analysis > Goal Seek',
      'Set cell: B7',
      'To value: 120000',
      'By changing cell: B2',
    ],
    steps: [
      'Make B7 a formula of B2 with monthly rate B2/12 and B3*12 periods.',
      'Goal Seek B7 to 120000 by changing B2.',
      'Format B2 as a percentage with 2 decimals.',
    ],
    pitfalls: [
      'With positive deposits FV returns a negative balance and Goal Seek heads the wrong way.',
      'RATE returns a monthly rate when nper is in months: x12 for the annual rate.',
    ],
    answer: 'B2 = 6.21% a year (0.517% a month x 12 = 6.2056%).',
  },
  {
    id: 'goal-seek-units-target-profit',
    topic: 'goal-seek',
    question: 'A craft brewery wants a profit of $50,000 this year. Use Goal Seek to find the cases in B4 that give that profit in B9. Check with a formula in B11 and give the whole number of cases needed in B12.',
    layout: 'Cases sold in B4 (typed input). Price per case in B5 ($25), variable cost per case in B6 ($9.50), fixed costs in B7 ($82,000). Revenue in B8, profit in B9.',
    formulas: [
      { cell: 'B8', formula: '=B4*B5' },
      { cell: 'B9', formula: '=B8-B4*B6-B7' },
      { cell: 'B11 (closed-form check)', formula: '=(B7+50000)/(B5-B6)' },
      { cell: 'B12', formula: '=ROUNDUP(B4,0)' },
    ],
    tool: [
      'Data > What-If Analysis > Goal Seek',
      'Set cell: B9',
      'To value: 50000',
      'By changing cell: B4',
    ],
    steps: [
      'Profit = cases x (price - variable cost) - fixed costs.',
      'Goal Seek B9 to 50000 by changing B4.',
      'Cases come in whole units: round UP so the target is reached.',
    ],
    pitfalls: [
      'Rounding down (8,516) misses the target by $2.',
    ],
    answer: 'B4 = 8,516.13, so B12 = 8,517 cases (8,516 cases give only $49,998).',
  },

  // ---------------------------------------------------------------- solver
  {
    id: 'solver-product-mix',
    topic: 'solver',
    question: 'A teak-furniture workshop makes tables, chairs and benches. Use Solver to find the whole numbers of each in C5:E5 that maximise total profit in F6, within carpentry hours, finishing hours, teak supply and a market limit on chairs.',
    layout: 'Decisions (units) in C5:E5: tables, chairs, benches. Unit profits in C6:E6 ($150, $55, $105). Use per unit in C9:E11: carpentry hours (5, 2, 4), finishing hours (3, 1, 2), teak board-feet (16, 5, 12). Used in F9:F11, available in G9:G11 (420, 220, 1400). Chair market limit in G12 (70).',
    formulas: [
      { cell: 'F6', formula: '=SUMPRODUCT(C5:E5,C6:E6)' },
      { cell: 'F9 (fill to F9:F11)', formula: '=SUMPRODUCT($C$5:$E$5,C9:E9)' },
    ],
    tool: [
      'Data > Solver',
      'Set Objective: $F$6, To: Max',
      'By Changing Variable Cells: $C$5:$E$5',
      'Subject to: $F$9:$F$11 <= $G$9:$G$11',
      'Subject to: $D$5 <= $G$12',
      'Subject to: $C$5:$E$5 = integer',
      'Make Unconstrained Variables Non-Negative: ticked; Solving Method: Simplex LP',
    ],
    steps: [
      'Type 0 in C5:E5 as start values.',
      'Objective = SUMPRODUCT(decisions, unit profits); each resource used = SUMPRODUCT(locked decisions, its row).',
      'Add constraints as range comparisons, plus integer; Simplex LP.',
      'Solve, Keep Solver Solution, record settings and optimal values.',
    ],
    pitfalls: [
      'Without $ on $C$5:$E$5 in F9, F10 and F11 multiply the wrong cells.',
      'Integer Optimality left at 1% can stop short: set it to 0 in Options.',
    ],
    answer: 'Tables 20, chairs 70, benches 45: profit F6 = $11,575. Carpentry (420) and finishing (220) are fully used, teak 1,210 of 1,400, chairs at the 70 limit.',
  },
  {
    id: 'solver-integer-basket-budget',
    topic: 'solver',
    question: 'A student club has $250 for orientation-day food and wants as many servings as possible, with at least 2 fruit trays and supply limits. Use Solver to find the whole quantities in C5:F5 that maximise servings in G6.',
    layout: 'Items in C4:F4 (cracker box, juice pack, fruit tray, sandwich platter). Quantities in C5:F5 (decisions). Servings per item in C6:F6 (12, 11, 21, 31). Prices in C7:F7 ($7.50, $12, $25, $36). Maximum available in C8:F8 (6, 8, 10, 4). Minimum fruit trays in E9 (2). Total servings in G6, total cost in G7, budget in H7 ($250).',
    formulas: [
      { cell: 'G6', formula: '=SUMPRODUCT(C5:F5,C6:F6)' },
      { cell: 'G7', formula: '=SUMPRODUCT(C5:F5,C7:F7)' },
    ],
    tool: [
      'Data > Solver',
      'Set Objective: $G$6, To: Max',
      'By Changing Variable Cells: $C$5:$F$5',
      'Subject to: $G$7 <= $H$7',
      'Subject to: $C$5:$F$5 <= $C$8:$F$8',
      'Subject to: $E$5 >= $E$9',
      'Subject to: $C$5:$F$5 = integer',
      'Non-negative ticked; Simplex LP; Options: Integer Optimality 0%',
    ],
    steps: [
      'Servings and cost are SUMPRODUCTs of the same quantity row.',
      'Budget, supply limits and the fruit minimum become three constraint lines.',
      'Integer quantities; solve with Simplex LP.',
    ],
    pitfalls: [
      'Without the integer constraint Solver buys fractions of a platter.',
      'With Integer Optimality at 1% Solver may stop a few servings short.',
    ],
    answer: 'Crackers 6, juice packs 8, fruit trays 4, platters 0: 244 servings for $241.00 (the unique best basket).',
  },
  {
    id: 'solver-min-cost-blend',
    topic: 'solver',
    question: 'A coffee roaster blends three beans. Use Solver to find the shares in C5:E5 that minimise cost per kg in F7, with average flavour at least 6.5, caffeine at most 1.8%, robusta share at most 40% and shares summing to 100%.',
    layout: 'Shares in C5:E5 (Colombia arabica, Brazil arabica, Vietnam robusta). Cost per kg in C7:E7 ($14, $11, $6). Flavour scores in C8:E8 (9, 7, 4). Caffeine in C9:E9 (1.2%, 1.3%, 2.4%). F5 = sum of shares, F7 = blend cost, F8 = blend flavour, F9 = blend caffeine. Limits: H8 minimum flavour (6.5), H9 maximum caffeine (1.8%), H10 maximum robusta share (40%).',
    formulas: [
      { cell: 'F5', formula: '=SUM(C5:E5)' },
      { cell: 'F7', formula: '=SUMPRODUCT(C5:E5,C7:E7)' },
      { cell: 'F8 (fill to F8:F9)', formula: '=SUMPRODUCT($C$5:$E$5,C8:E8)' },
    ],
    tool: [
      'Data > Solver',
      'Set Objective: $F$7, To: Min',
      'By Changing Variable Cells: $C$5:$E$5',
      'Subject to: $F$5 = 1',
      'Subject to: $F$8 >= $H$8',
      'Subject to: $F$9 <= $H$9',
      'Subject to: $E$5 <= $H$10',
      'Non-negative ticked; Simplex LP (no integer: shares are fractions)',
    ],
    steps: [
      'Blend properties are share-weighted averages: SUMPRODUCT(shares, property).',
      'Shares must sum to 1 (or make E5 = 1 - C5 - D5 and add E5 >= 0).',
      'Minimise cost with Simplex LP; report shares as percentages.',
    ],
    pitfalls: [
      'Without the sum-to-1 constraint Solver sets every share to 0 (cost $0).',
      'If E5 is a formula (remainder share), it must not be in the changing cells.',
    ],
    answer: 'Colombia 35%, Brazil 25%, Vietnam 40%: $10.05 per kg. Flavour exactly 6.5 and robusta at 40% bind; caffeine 1.705% is under the limit.',
  },
  {
    id: 'solver-staff-scheduling',
    topic: 'solver',
    question: 'A cafe opens 08:00 to 22:00 in seven 2-hour blocks. Staff work one of five 6-hour shifts. Use Solver to choose the whole number of staff per shift in C5:G5 so every block has at least the required staff, at minimum wage cost in H6. Show total staff in H7.',
    layout: 'Shifts in C4:G4: S1 08-14, S2 10-16, S3 12-18, S4 14-20, S5 16-22. Staff per shift in C5:G5 (decisions). Cost per staff per shift in C6:G6 ($88, $90, $95, $100, $110). Coverage table in C9:G15: 1 if the shift works in that block, else 0 (blocks 08-10 to 20-22 down rows 9 to 15). On duty per block in H9:H15, required in I9:I15 (3, 5, 8, 6, 7, 9, 4).',
    formulas: [
      { cell: 'H6', formula: '=SUMPRODUCT(C5:G5,C6:G6)' },
      { cell: 'H7', formula: '=SUM(C5:G5)' },
      { cell: 'H9 (fill to H9:H15)', formula: '=SUMPRODUCT($C$5:$G$5,C9:G9)' },
    ],
    tool: [
      'Data > Solver',
      'Set Objective: $H$6, To: Min',
      'By Changing Variable Cells: $C$5:$G$5',
      'Subject to: $H$9:$H$15 >= $I$9:$I$15',
      'Subject to: $C$5:$G$5 = integer',
      'Non-negative ticked; Simplex LP; Integer Optimality 0%',
    ],
    steps: [
      'Coverage matrix: in each block row put 1 under every shift working then.',
      'On duty per block = SUMPRODUCT(locked staff row, that block row).',
      'One range constraint: on duty >= required; integer staff.',
    ],
    pitfalls: [
      'A 6-hour shift covers 3 two-hour blocks: check each column has three 1s.',
      'Minimising headcount instead of cost gives many tied answers; use the objective the question asks for.',
    ],
    answer: 'S1 = 7, S2 = 1, S3 = 0, S4 = 5, S5 = 4 (17 staff), cost $1,646. On duty per block: 7, 8, 8, 6, 9, 9, 4.',
  },
  {
    id: 'solver-transportation',
    topic: 'solver',
    question: 'Three central kitchens (Woodlands, Tuas, Changi) supply four outlets (Orchard, Tampines, Jurong, Bishan). Use Solver to choose crates shipped on each route in C11:F13 that meet every outlet demand at minimum delivery cost in H16 without exceeding kitchen supply.',
    layout: 'Cost per crate in C5:F7 (rows Woodlands, Tuas, Changi; columns Orchard, Tampines, Jurong, Bishan): Woodlands 6, 9, 7, 4; Tuas 7, 11, 3, 7; Changi 9, 4, 12, 8. Shipments (decisions) in C11:F13. Shipped per kitchen in G11:G13, supply in H11:H13 (300, 250, 200). Received per outlet in C14:F14, demand in C15:F15 (180, 220, 160, 150).',
    formulas: [
      { cell: 'H16', formula: '=SUMPRODUCT(C5:F7,C11:F13)' },
      { cell: 'G11 (fill to G11:G13)', formula: '=SUM(C11:F11)' },
      { cell: 'C14 (fill to C14:F14)', formula: '=SUM(C11:C13)' },
    ],
    tool: [
      'Data > Solver',
      'Set Objective: $H$16, To: Min',
      'By Changing Variable Cells: $C$11:$F$13',
      'Subject to: $G$11:$G$13 <= $H$11:$H$13',
      'Subject to: $C$14:$F$14 >= $C$15:$F$15',
      'Non-negative ticked; Simplex LP (add $C$11:$F$13 = integer only if asked; the answer is whole anyway)',
    ],
    steps: [
      'Cost grid and shipment grid have the same 3 x 4 shape: SUMPRODUCT them.',
      'Row sums = shipped by each kitchen; column sums = received by each outlet.',
      'Supply <=, demand >=, minimise with Simplex LP.',
    ],
    pitfalls: [
      'Supply (750) exceeds demand (710): supply must be <=, not =, or the model is infeasible.',
      'Mixing up rows and columns of the cost grid prices every route wrongly.',
    ],
    answer: 'Woodlands: Orchard 130, Tampines 20, Bishan 150. Tuas: Orchard 50, Jurong 160. Changi: Tampines 200. Minimum cost $3,190; Tuas has 40 crates spare.',
  },
  {
    id: 'solver-linearise-step-discount',
    topic: 'solver',
    question: 'A sports club spends at most $500 (amount paid). The shop discount depends on the subtotal: 0% below $300, 5% from $300, 10% from $450, looked up in H7. Find whole quantities in C5:F5 (at most 6 each) that maximise usefulness points in H5, solving with Simplex LP.',
    layout: 'Items in C4:F4 (football, racket, shuttlecock tube, basketball). Quantities in C5:F5 (decisions). Points per item in C6:F6 (6, 8, 3, 7). Prices in C7:F7 ($28, $45, $18, $35). Maximum per item in C8:F8 (6 each). Total points H5, subtotal H6, looked-up rate H7, amount paid H8, budget H9 ($500). Fixed band rate typed in H11, its lower bound in H12, check cell H13. Discount table: lower bounds K5:K7 (0, 300, 450), rates L5:L7 (0%, 5%, 10%).',
    formulas: [
      { cell: 'H5', formula: '=SUMPRODUCT(C5:F5,C6:F6)' },
      { cell: 'H6', formula: '=SUMPRODUCT(C5:F5,C7:F7)' },
      { cell: 'H7 (original model, non-linear)', formula: '=VLOOKUP(H6,K5:L7,2,TRUE)' },
      { cell: 'H8', formula: '=H6*(1-H11)', note: 'linear: uses the FIXED band rate in H11, not the lookup' },
      { cell: 'H13 (check after solving)', formula: '=VLOOKUP(H6,K5:L7,2,TRUE)=H11' },
    ],
    tool: [
      'Type 10% in H11 and 450 in H12 (top band: $500 buys more than $450 of goods)',
      'Data > Solver: Set Objective $H$5, To: Max',
      'By Changing Variable Cells: $C$5:$F$5',
      'Subject to: $H$8 <= $H$9',
      'Subject to: $H$6 >= $H$12',
      'Subject to: $C$5:$F$5 <= $C$8:$F$8',
      'Subject to: $C$5:$F$5 = integer',
      'Non-negative ticked; Simplex LP; Integer Optimality 0%',
    ],
    steps: [
      'With the VLOOKUP inside, Simplex LP stops with "linearity conditions are not satisfied".',
      'Fix the band: paid = subtotal x (1 - fixed rate H11), and force the subtotal into that band (H6 >= 450).',
      'Solve with Simplex LP, then confirm H13 is TRUE (the lookup agrees with the fixed rate).',
      'If unsure which band wins, solve once per band and keep the best (for a lower band also cap the subtotal, e.g. H6 <= 449.99 for the 5% band).',
    ],
    pitfalls: [
      'Fixing the rate without the subtotal >= 450 constraint lets Solver take 10% off a $200 basket.',
      'GRG Nonlinear on the VLOOKUP model can stop at a poor answer; Evolutionary is slow and not guaranteed optimal.',
    ],
    answer: 'Footballs 6, rackets 3, shuttlecock tubes 2, basketballs 6: 108 points, subtotal $549, 10% off, paid $494.10 (H13 TRUE).',
  },
  {
    id: 'solver-record-keeping-key-style',
    topic: 'solver',
    question: 'A courier leases small vans (80 parcels a day, $95 a day) and large vans (150 parcels, $160 a day). It must carry at least 1,200 parcels a day, has 12 drivers (one per van) and parking for 6 large vans. After running Solver for minimum daily cost, record the model in answer cells J4:J10 the way a marking key expects.',
    layout: 'Vans leased in C5:D5 (small, large; decisions). Cost per van in C6:D6 ($95, $160), parcels per van in C7:D7 (80, 150). Total cost in F6, capacity in F7, vans used (drivers) in F8. Limits: parcels required G7 (1200), drivers available G8 (12), large-van parking D9 (6). Answer cells J4:J10.',
    formulas: [
      { cell: 'F6', formula: '=SUMPRODUCT(C5:D5,C6:D6)' },
      { cell: 'F7', formula: '=SUMPRODUCT(C5:D5,C7:D7)' },
      { cell: 'F8', formula: '=SUM(C5:D5)' },
      { cell: 'J4 (objective formula shown as text)', formula: '=FORMULATEXT(F6)' },
    ],
    tool: [
      'Objective: $F$6, Min',
      'Changing cells: $C$5:$D$5',
      'Constraint: $F$7 >= $G$7 (capacity)',
      'Constraint: $F$8 <= $G$8 (drivers)',
      'Constraint: $D$5 <= $D$9 (parking)',
      'Constraint: $C$5:$D$5 = integer; Make Unconstrained Variables Non-Negative ticked',
      'Engine: Simplex LP. Result: 4 small, 6 large, cost $1,340',
    ],
    steps: [
      'One line each: objective and Max/Min; changing cells; every constraint; integer and non-negative; engine.',
      'Then the optimal decision values and the objective value.',
      'Write references as the Solver dialog shows them ($F$6).',
    ],
    pitfalls: [
      'Giving only the answer (4 and 6) loses the marks for the settings.',
      'Leaving out integer or non-negativity loses marks even if the solution happens to be whole.',
    ],
    answer: 'Small 4, large 6: 1,220 parcels, 10 drivers, $1,340 a day (next best 6 small + 5 large at $1,370).',
  },

  // ---------------------------------------------------------------- what-if
  {
    id: 'what-if-one-way-data-table',
    topic: 'what-if',
    question: 'A theme-park model computes daily revenue in B10 and profit in B12 from the ticket price in B4. Build a one-way data table in E5:G16 showing revenue and profit for ticket prices $40 to $60 in steps of $2.',
    layout: 'Model: ticket price B4 (input), revenue B10, profit B12. Table block E5:G16: prices in E6:E16 (E6 typed 40), links to the outputs in F5 and G5, E5 left blank.',
    formulas: [
      { cell: 'E7 (fill to E7:E16)', formula: '=E6+2' },
      { cell: 'F5', formula: '=B10' },
      { cell: 'G5', formula: '=B12' },
    ],
    tool: [
      'Select E5:G16 (link row + price column + empty result cells)',
      'Data > What-If Analysis > Data Table',
      'Row input cell: (leave blank)',
      'Column input cell: $B$4',
    ],
    steps: [
      'List the input values down E6:E16.',
      'One row up and one column right of the first value, link to each output (=B10, =B12).',
      'Select the whole block and run Data Table with B4 as the Column input cell.',
    ],
    pitfalls: [
      'Selecting E6:G16 without the link row gives a wrong or empty table.',
      'B4 in the Row input box (values run DOWN a column) fills the table with wrong numbers.',
      'The input cell must be on the same sheet as the table.',
    ],
    answer: 'Each row of F6:G16 shows revenue and profit if B4 took that price.',
  },
  {
    id: 'what-if-two-way-data-table',
    topic: 'what-if',
    question: 'A home-loan model computes the monthly instalment in B8 from the annual rate in B2 and the term in years in B3. Build a two-way data table in E4:J10 with rates 2.5% to 4.5% across and terms 10 to 35 years down.',
    layout: 'Model: annual rate B2, years B3, loan amount B4 ($500,000), instalment B8. Table block E4:J10: E4 = link to the output, rates (2.5%, 3%, 3.5%, 4%, 4.5%) in F4:J4, terms (10, 15, 20, 25, 30, 35) in E5:E10.',
    formulas: [
      { cell: 'B8', formula: '=-PMT(B2/12,B3*12,B4)', note: 'positive instalment' },
      { cell: 'E4', formula: '=B8' },
    ],
    tool: [
      'Select E4:J10',
      'Data > What-If Analysis > Data Table',
      'Row input cell: $B$2 (rates run across the top row)',
      'Column input cell: $B$3 (terms run down the first column)',
    ],
    steps: [
      'Output link in the top-left corner (E4).',
      'One input across the top row, the other down the first column.',
      'Row input = the input across the top; Column input = the input down the side.',
    ],
    pitfalls: [
      'Swapping the row and column input cells puts every value in the wrong place without any error.',
    ],
    answer: 'F5:J10 holds the instalment for each rate and term; the 3%, 30-year cell is $2,108.02.',
  },
  {
    id: 'what-if-pick-best-input',
    topic: 'what-if',
    question: 'From the one-way data table of ticket prices and profits, return in J5 the price with the highest profit, in J6 that profit, and in J7 how many listed prices reach the profit target in J2.',
    layout: 'Data table results: ticket prices in E6:E16, revenue in F6:F16, profit in G6:G16. Profit target in J2 ($20,000).',
    formulas: [
      { cell: 'J5', formula: '=INDEX(E6:E16,MATCH(MAX(G6:G16),G6:G16,0))' },
      { cell: 'J6', formula: '=MAX(G6:G16)' },
      { cell: 'J7', formula: '=COUNTIF(G6:G16,">="&J2)' },
    ],
    steps: [
      'MAX of the result column finds the best profit.',
      'INDEX/MATCH returns the input value on the same row.',
      'COUNTIF with ">="&cell counts results meeting a target.',
    ],
    pitfalls: [
      'The best listed price is only the best of the values tried; a finer step or Solver could do slightly better: say so.',
      'Data-table cells cannot be edited one by one.',
    ],
    answer: 'J5 is one of the listed prices, J6 its profit, J7 a count between 0 and 11.',
  },

  // ---------------------------------------------------------------- tvm
  {
    id: 'tvm-monthly-loan-payment',
    topic: 'tvm',
    question: 'A customer borrows for a car at an annual rate compounded monthly, repaid monthly. In B6 compute the monthly instalment as a positive amount and in B7 the total interest paid.',
    layout: 'Annual rate in B2 (3.2%), years in B3 (7), loan amount in B4 ($85,000).',
    formulas: [
      { cell: 'B6', formula: '=-PMT(B2/12,B3*12,B4)', note: 'PMT is negative for a loan received; the minus shows it positive' },
      { cell: 'B7', formula: '=B6*B3*12-B4' },
    ],
    steps: [
      'Monthly rate = annual / 12; payments = years x 12.',
      'PMT(rate, nper, pv): the loan is received, so pv is positive and PMT is negative.',
      'Total interest = all payments - amount borrowed.',
    ],
    pitfalls: [
      'PMT(B2,B3,B4) with yearly inputs gives a yearly payment.',
      'This formula is for a rate compounded monthly; a "flat rate" quote is a different calculation.',
    ],
    answer: 'B6 = $1,130.81 a month; B7 = $9,987.93 total interest.',
  },
  {
    id: 'tvm-payment-with-balloon',
    topic: 'tvm',
    question: 'A clinic finances equipment over 5 years at an annual rate (monthly payments and compounding), with a balloon payment due with the last instalment. In B7 compute the regular monthly payment (positive) and in B8 the payment without a balloon.',
    layout: 'Annual rate B2 (4.5%), years B3 (5), amount financed B4 ($150,000), balloon B5 ($30,000).',
    formulas: [
      { cell: 'B7', formula: '=-PMT(B2/12,B3*12,B4,-B5)', note: 'fv = -balloon: money still to be paid at the end' },
      { cell: 'B8', formula: '=-PMT(B2/12,B3*12,B4)' },
    ],
    steps: [
      'pv = amount financed (+), fv = balloon (-): both are on the loan side.',
      'The balloon lowers the regular payment.',
    ],
    pitfalls: [
      '+B5 as fv means you RECEIVE $30,000 at the end, which raises the payment.',
    ],
    answer: 'B7 = $2,349.66 a month; B8 = $2,796.45 without the balloon.',
  },
  {
    id: 'tvm-pv-annuity-max-loan',
    topic: 'tvm',
    question: 'A couple can afford a fixed monthly payment on a 25-year home loan at an annual rate compounded monthly. In B6 compute the largest loan they can take.',
    layout: 'Annual rate B2 (3.5%), years B3 (25), affordable monthly payment B4 ($2,400).',
    formulas: [
      { cell: 'B6', formula: '=PV(B2/12,B3*12,-B4)', note: 'payments made are negative, so the loan comes out positive' },
    ],
    steps: [
      'The largest loan = present value of the payments they can afford.',
      'Monthly rate and months; payment entered negative.',
    ],
    pitfalls: [
      '2,400 x 300 = $720,000 ignores interest: far too high.',
    ],
    answer: 'B6 = $479,402.12.',
  },
  {
    id: 'tvm-fv-savings-topups',
    topic: 'tvm',
    question: 'An investor puts a lump sum into a fund now and adds a fixed amount at the end of every month. In B7 compute the balance after the given years and in B8 the interest earned.',
    layout: 'Annual rate B2 (4%, compounded monthly), years B3 (15), amount now B4 ($10,000), monthly top-up B5 ($800).',
    formulas: [
      { cell: 'B7', formula: '=FV(B2/12,B3*12,-B5,-B4)' },
      { cell: 'B8', formula: '=B7-B4-B5*B3*12', note: 'balance - everything paid in' },
    ],
    steps: [
      'Money paid in is negative: -B5 (pmt) and -B4 (pv).',
      'FV then comes out positive.',
      'Interest = balance - lump sum - all top-ups.',
    ],
    pitfalls: [
      'Leaving out pv (the lump sum) ignores the $10,000 and its growth.',
    ],
    answer: 'B7 = $215,075.41; paid in $154,000; B8 = $61,075.41.',
  },
  {
    id: 'tvm-rate-instalment-plan',
    topic: 'tvm',
    question: 'A store sells a TV for a cash price or 24 monthly instalments starting one month from now. In B6 compute the implied monthly rate, in B7 the nominal annual rate and in B8 the effective annual rate.',
    layout: 'Cash price B2 ($2,999), instalment B3 ($139), number of instalments B4 (24).',
    formulas: [
      { cell: 'B6', formula: '=RATE(B4,-B3,B2)' },
      { cell: 'B7', formula: '=B6*12' },
      { cell: 'B8', formula: '=(1+B6)^12-1' },
    ],
    steps: [
      'Treat the cash price as a loan received (+) repaid by the instalments (-).',
      'RATE gives the rate per month; x12 for the nominal annual rate.',
      'Effective annual = (1 + monthly)^12 - 1.',
    ],
    pitfalls: [
      'Same signs on price and instalment give #NUM!.',
      'Reporting the monthly rate as the annual rate understates it 12 times.',
    ],
    answer: 'B6 = 0.870% a month; B7 = 10.44% a year; B8 = 10.96%.',
  },
  {
    id: 'tvm-nper-pay-off',
    topic: 'tvm',
    question: 'A credit-card balance is charged interest monthly. Paying a fixed amount at the end of each month and spending nothing more, in B6 compute the months needed to clear it and in B7 the whole number of payments.',
    layout: 'Balance B2 ($8,000), annual rate B3 (24%, i.e. 2% a month), monthly payment B4 ($300).',
    formulas: [
      { cell: 'B6', formula: '=NPER(B3/12,-B4,B2)' },
      { cell: 'B7', formula: '=ROUNDUP(B6,0)' },
    ],
    steps: [
      'Monthly rate = B3 / 12.',
      'Balance owed is pv (+), payments are pmt (-).',
      'Round the months up: the last payment is a smaller one.',
    ],
    pitfalls: [
      'If the payment is below the monthly interest ($160 here) the debt never clears and NPER returns #NUM!.',
    ],
    answer: 'B6 = 38.49 months, so B7 = 39 payments.',
  },
  {
    id: 'tvm-npv-time0-outside',
    topic: 'tvm',
    question: 'A bakery chain considers a new outlet costing $250,000 now with net cash flows over 6 years. In C13 compute the NPV at the rate in B2, in C14 decide "Accept" or "Reject", and in C15 compute the IRR.',
    layout: 'Discount rate B2 (8%). Cash flows in C5:C11: C5 = year 0 (-250,000), C6:C11 = years 1 to 6 (50,000, 58,000, 65,000, 65,000, 60,000, 45,000).',
    formulas: [
      { cell: 'C13', formula: '=NPV(B2,C6:C11)+C5', note: 'NPV() discounts its first value one year, so year 0 stays outside' },
      { cell: 'C14', formula: '=IF(C13>0,"Accept","Reject")' },
      { cell: 'C15', formula: '=IRR(C5:C11)' },
    ],
    steps: [
      'NPV(rate, years 1 to n) + year-0 flow (already negative).',
      'Accept if NPV > 0.',
      'IRR takes the whole range including year 0.',
    ],
    pitfalls: [
      '=NPV(B2,C5:C11) also discounts the outlay and returns $13,509.82: wrong.',
    ],
    answer: 'C13 = $14,590.61, "Accept". C15 = 9.90%, above the 8% rate (consistent).',
  },
  {
    id: 'tvm-irr-accept-reject',
    topic: 'tvm',
    question: 'A factory can install rooftop solar for $180,000. It saves $28,000 a year for 10 years and the panels are sold for $10,000 at the end of year 10. In C17 compute the IRR, in C18 decide against the hurdle rate, and in C19 compute the NPV at the hurdle rate.',
    layout: 'Hurdle rate B2 (7%). Cash flows in C5:C15: C5 = year 0 (-180,000), C6:C14 = years 1 to 9 (28,000 each), C15 = year 10 (38,000 = 28,000 + 10,000).',
    formulas: [
      { cell: 'C17', formula: '=IRR(C5:C15)' },
      { cell: 'C18', formula: '=IF(C17>B2,"Accept","Reject")' },
      { cell: 'C19', formula: '=NPV(B2,C6:C15)+C5' },
    ],
    steps: [
      'One cell per year in time order, year 0 first.',
      'IRR over the whole range; accept if IRR > hurdle.',
      'NPV at the hurdle should then be positive: a consistency check.',
    ],
    pitfalls: [
      'IRR needs the year-0 flow inside the range (unlike NPV).',
      'Add the resale to the year-10 flow; do not give it its own year.',
    ],
    answer: 'C17 = 9.48% > 7%: "Accept". C19 = $21,743.78.',
  },
  {
    id: 'tvm-lump-sum-vs-monthly',
    topic: 'tvm',
    question: 'A retiring business owner can take a lump sum now or receive a fixed amount at the end of each month for 5 years. In B7 compute the present value of the monthly option, in B8 its difference from the lump sum, and in B9 recommend an option.',
    layout: 'Annual rate B2 (5%, compounded monthly), number of months B3 (60), monthly amount B4 ($1,800), lump sum now B5 ($95,000).',
    formulas: [
      { cell: 'B7', formula: '=PV(B2/12,B3,-B4)' },
      { cell: 'B8', formula: '=B7-B5', note: 'positive means the monthly stream is worth more' },
      { cell: 'B9', formula: '=IF(B8>0,"Monthly payments","Lump sum")' },
    ],
    steps: [
      'Bring the stream to today: PV at the monthly rate.',
      'Compare with the lump sum (already in today money).',
      'Recommend the larger value, and say it depends on the rate.',
    ],
    pitfalls: [
      'Comparing 60 x 1,800 = $108,000 with $95,000 ignores the time value of money.',
      'Annual rate with monthly periods makes the stream look far less valuable.',
    ],
    answer: 'B7 = $95,383.27, B8 = $383.27: "Monthly payments" at 5%, by a small margin (a higher rate would favour the lump sum).',
  },
  {
    id: 'tvm-start-of-period-type1',
    topic: 'tvm',
    question: 'A firm leases an office for 36 months with rent paid at the START of each month. In B6 compute the present value of the rent at the given rate; in B7 compute it as if rent were paid at the end of each month.',
    layout: 'Annual rate B2 (6%, compounded monthly), months B3 (36), monthly rent B4 ($4,500).',
    formulas: [
      { cell: 'B6', formula: '=PV(B2/12,B3,-B4,0,1)', note: 'type 1 = payments at the start of each period' },
      { cell: 'B7', formula: '=PV(B2/12,B3,-B4)' },
    ],
    steps: [
      'Start-of-period payments: last argument type = 1 (fv = 0 before it).',
      'The same with type 0 (or omitted) for end-of-period.',
    ],
    pitfalls: [
      'Forgetting the 0 for fv puts the 1 in the fv slot: =PV(r,n,pmt,1) is wrong.',
    ],
    answer: 'B6 = $148,659.17; B7 = $147,919.57 (B6 = B7 x 1.005: each payment is one month earlier).',
  },
  {
    id: 'tvm-loan-balance-after-k',
    topic: 'tvm',
    question: 'A home loan is repaid monthly over 25 years. In B7 compute the monthly payment (as Excel returns it, negative) and in B8 the balance still owed right after the payment number in B5.',
    layout: 'Annual rate B2 (2.6%, compounded monthly), years B3 (25), loan B4 ($600,000), payments made B5 (60).',
    formulas: [
      { cell: 'B7', formula: '=PMT(B2/12,B3*12,B4)' },
      { cell: 'B8', formula: '=-FV(B2/12,B5,B7,B4)', note: 'FV of the loan and the payments made; minus shows the debt as positive' },
      { cell: 'B8 (alternative)', formula: '=PV(B2/12,B3*12-B5,B7)', note: 'PV of the payments still due' },
    ],
    steps: [
      'Payment over the full term with PMT (negative).',
      'Balance after k payments = -FV(rate, k, payment, loan).',
      'Check: PV of the remaining payments gives the same number.',
    ],
    pitfalls: [
      'The payment must be negative and the loan positive inside FV, or the balance grows instead of shrinking.',
      'Use the full term for PMT but k (B5) for FV.',
    ],
    answer: 'B7 = -$2,722.02; B8 = $508,989.88 still owed after 5 years.',
  },

  // ---------------------------------------------------------------- interpret
  {
    id: 'interpret-recommend-buy-or-lease',
    topic: 'interpret',
    question: 'The model gives the present value of the total cost of buying (D20) and leasing (E20) a delivery van over 5 years. In D22 compute the difference and in D23 write a 2-3 sentence recommendation.',
    layout: 'PV of the cost of buying in D20 ($182,400), PV of the cost of leasing in E20 ($176,900), both at the 6% discount rate in B2.',
    formulas: [
      { cell: 'D22', formula: '=D20-E20', note: 'positive means buying costs more' },
    ],
    steps: [
      'Start with the decision: "Lease."',
      'Quote both numbers and the difference with units and the rate.',
      'Give one assumption that could change the answer.',
    ],
    pitfalls: [
      'A number without a decision earns little: say what to do.',
    ],
    answer: 'Lease. At a 6% discount rate leasing costs $176,900 in present-value terms against $182,400 for buying, a saving of $5,500 (D22). The gap depends on the discount rate and the resale value assumed for the van, so a lower rate or a higher resale value would narrow it.',
  },
  {
    id: 'interpret-compare-solver-vs-current',
    topic: 'interpret',
    question: 'The current furniture plan earns the profit in F7; the Solver plan earns the profit in F6. In F8 compute the improvement, in F9 the percentage improvement, and explain in 2-3 sentences what Solver changed.',
    layout: 'Solver-plan profit F6 ($11,575: 20 tables, 70 chairs, 45 benches). Current-plan profit F7 ($10,900: 30 tables, 40 chairs, 40 benches). Carpentry 420 h and finishing 220 h available; the current plan uses 390 h and 210 h.',
    formulas: [
      { cell: 'F8', formula: '=F6-F7' },
      { cell: 'F9', formula: '=F6/F7-1' },
    ],
    steps: [
      'Lead with the gain in dollars and percent.',
      'Say what moved (fewer tables, more chairs and benches) and why it helps (idle hours now used).',
      'One assumption: everything made can be sold at the listed profits.',
    ],
    pitfalls: [
      'Do not invent reasons: check claims such as "more profit per hour" against the data before writing them.',
    ],
    answer: 'The Solver plan earns $675 more (6.19%). It makes 10 fewer tables but 30 more chairs (up to the 70 limit) and 5 more benches, so carpentry and finishing are fully used (420 h and 220 h) instead of leaving 30 and 10 hours idle. This assumes all units sell at the listed unit profits.',
  },
  {
    id: 'interpret-limitation-trend',
    topic: 'interpret',
    question: 'Your TREND forecast for month 36 in C40 is based on 24 months of history. In D40 compute how far the forecast differs from the last actual value, then write two limitations of using it for planning in D41.',
    layout: 'Month numbers 1 to 24 in B5:B28 with orders in C5:C28 (history; last actual in C28). Forecast month 36 in B40, forecast in C40.',
    formulas: [
      { cell: 'C40', formula: '=TREND($C$5:$C$28,$B$5:$B$28,B40)' },
      { cell: 'D40', formula: '=C40-C28' },
    ],
    steps: [
      'State the number first (the forecast and the gap in D40).',
      'Limitation 1: extrapolation 12 months past the data assumes the same straight-line growth.',
      'Limitation 2: a single point with no range, ignoring seasonality and one-off events.',
    ],
    pitfalls: [
      'Generic remarks ("forecasts can be wrong") earn less than ones tied to this model.',
    ],
    answer: 'The forecast extrapolates 12 months beyond the data and assumes orders keep changing by the same amount every month, so any change in trend, seasonality or one-off event is ignored. It is also a single point estimate with no error range, so plans should allow a margin and be updated as new months arrive.',
  },
]
