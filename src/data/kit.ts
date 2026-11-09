// The offline exam kit: files copied next to the offline HTML by scripts/build-kit.ts, and the one-page syntax sheet.
// `src` is relative to the course folder (~/SMU/CS602); `file` is the path inside the kit folder.

export interface KitFile { file: string; src: string; label: string; note?: string }
export interface KitGroup { title: string; files: readonly KitFile[] }

const wb = (week: string, name: string, label: string, note?: string): KitFile => ({ file: `workbooks/${week}-${name}`, src: `Week ${week.slice(1)}/${name}`, label, note })

export const kitGroups: readonly KitGroup[] = [
  {
    title: 'Course workbooks (the key ones first)',
    files: [
      wb('W6', 'CallCenter-modified.xlsx', 'Call Center: single and c-server queues', 'COUNTIF system length, LARGE c-th end time, balking and reneging, utilisation'),
      wb('W5', 'DataSim.xlsx', 'DataSim: simulation methods', 'CRF + LOOKUP(RAND()), resampling, NORMINV, exponential, CRITBINOM'),
      wb('W3', 'EchoOfficeSupplies.xlsm', 'Echo Office Supplies: lookups and price lists'),
      wb('W4', 'TimeValue.xlsm', 'Time Value: PMT, PV, FV, RATE, NPER, NPV, IRR'),
      wb('W2', 'InkJetPrinter.xlsm', 'InkJet Printer: price-demand model and Solver'),
      { file: 'workbooks/W1-CommunityWaterTank.xlsx', src: 'Week 1a/CommunityWaterTank.xlsx', label: 'Community Water Tank: parameters, anchoring, SUMPRODUCT' },
      { file: 'workbooks/W1-DataCenterAssets.xlsx', src: 'Week 1a/DataCenterAssets.xlsx', label: 'Data Centre Assets: ratios and TREND' },
      { file: 'workbooks/W1-RetailGasoline.xlsx', src: 'Week 1a/RetailGasoline.xlsx', label: 'Retail Gasoline' },
      wb('W2', 'InvestInEducation.xlsx', 'Invest in Education: expected values and margins'),
      wb('W3', 'CasinoHotel.xlsx', 'Casino Hotel: LP model for Solver'),
      wb('W3', 'DataLookUp.xlsx', 'DataLookUp: INDEX, MATCH, two-way lookups'),
      wb('W3', 'XLOOKUP-IFS.xlsx', 'XLOOKUP and IFS'),
      wb('W3', 'Project Manpower.xlsx', 'Project Manpower (Solver)'),
      wb('W4', 'BlackScholes.xlsm', 'Black-Scholes option pricing'),
      wb('W4', 'CharityDonation.xlsx', 'Charity Donation: circular references'),
      wb('W5', 'MontyHall.xlsx', 'Monty Hall simulation'),
      wb('W5', 'VillageWater.xlsx', 'Village Water: simulation with replications'),
      wb('W10', 'Demo-Advanced-Filter.xlsx', 'Advanced Filter demo: AND / OR criteria'),
      wb('W10', 'OffshoreDevelopment-modified.xlsm', 'Offshore Development: date-window criteria'),
    ],
  },
  {
    title: 'Solved mock exams (reference answers from this guide)',
    files: [
      { file: 'mocks/Mock-A-solved.xlsx', src: '', label: 'Mock A: pet supplies receipt and Solver; night-safari tram queue' },
      { file: 'mocks/Mock-B-solved.xlsx', src: '', label: 'Mock B: study-pod pricing, Goal Seek, NPV; zoo multi-counter queue' },
      { file: 'mocks/Mock-C-solved.xlsx', src: '', label: 'Mock C: storage tiers and Solver; umbrella-sharing binomial flows' },
    ],
  },
  {
    title: 'Past papers with solutions',
    files: [
      { file: 'past-papers/AY2014-15-T1-paper.docx', src: 'Past Exams/Sample Paper Solutions-AY2014-15-Term1.docx', label: 'AY2014-15 Term 1: paper with solutions' },
      { file: 'past-papers/AY2014-15-T1-Q1.xlsx', src: 'Past Exams/Sample Paper Solutions-AY2014-15-Term1-Q1.xlsx', label: 'AY2014-15 Q1 solution workbook' },
      { file: 'past-papers/AY2014-15-T1-Q2.xlsx', src: 'Past Exams/Sample Paper Solutions-AY2014-15-Term1-Q2.xlsx', label: 'AY2014-15 Q2 solution workbook' },
      { file: 'past-papers/AY2016-17-T2-paper.docx', src: 'Past Exams/Sample Paper Solutions-AY2016-17-Term2.docx', label: 'AY2016-17 Term 2: paper with solutions' },
      { file: 'past-papers/AY2016-17-T2-Q1.xlsx', src: 'Past Exams/Sample Paper Solutions-AY2016-17-Term2-Q1.xlsx', label: 'AY2016-17 Q1 solution workbook' },
      { file: 'past-papers/AY2016-17-T2-Q2.xlsm', src: 'Past Exams/Sample Paper Solutions-AY2016-17-Term2-Q2.xlsm', label: 'AY2016-17 Q2 solution workbook' },
      { file: 'past-papers/AY2017-18-T2-paper.pdf', src: 'Past Exams/Sample4 2017-18 T2 with Solutions.pdf', label: 'AY2017-18 Term 2: paper with solutions' },
      { file: 'past-papers/AY2017-18-T2-solutions.xlsx', src: 'Past Exams/Sample4 2017-18 T2 Solutions.xlsx', label: 'AY2017-18 solution workbook' },
    ],
  },
  {
    title: 'Online quiz solutions',
    files: [
      { file: 'quizzes/Quiz1-Spreadsheet-Engineering.xlsx', src: 'Quizzes/Quiz 1 - Spreadsheet Engineering - Solution.xlsx', label: 'Quiz 1: spreadsheet engineering' },
      { file: 'quizzes/Quiz2-Lookup-Optimization.xlsx', src: 'Quizzes/Quiz 2 - Lookup & Optimization - Solution.xlsx', label: 'Quiz 2: lookup and optimisation' },
      { file: 'quizzes/Quiz3-Financial-Functions.xlsx', src: 'Quizzes/Quiz 3 - Financial Functions - Solution.xlsx', label: 'Quiz 3: financial functions' },
    ],
  },
  {
    title: 'Slides',
    files: [
      { file: 'slides/S1-Intro.pdf', src: 'Week 1a/IS602-AY2026-27-S1.pdf', label: 'Week 1: introduction to spreadsheet modelling' },
      { file: 'slides/S2-Modelling.pdf', src: 'Week 2/IS602-AY2026-27-S2.pdf', label: 'Week 2: modelling, Goal Seek, Solver' },
      { file: 'slides/S3-LP-Lookups.pdf', src: 'Week 3/IS602-AY2026-27-S3.pdf', label: 'Week 3: linear programming and lookups' },
      { file: 'slides/S3-Solver-Info.pdf', src: 'Week 3/Solver-Info.pdf', label: 'Week 3: Solver reference' },
      { file: 'slides/S4-Finance.pdf', src: 'Week 4/IS602-AY2026-27-S4.pdf', label: 'Week 4: financial functions' },
      { file: 'slides/S5-Simulation.pdf', src: 'Week 5/IS602-AY2026-27-S5.pdf', label: 'Week 5: Monte Carlo simulation' },
      { file: 'slides/S5-Exponential-Inversion.pdf', src: 'Week 5/Inversion of Exponential Distribution.pdf', label: 'Week 5: inverting the exponential distribution' },
      { file: 'slides/S6-Queues-Dates.pdf', src: 'Week 6/IS602-AY2026-27-S6.pdf', label: 'Week 6: queuing, dates and times' },
      { file: 'slides/S10-Filters.pdf', src: 'Week 10/IS602-AY2026-27-S10.pdf', label: 'Week 10: filters and PivotTables' },
    ],
  },
]

export interface SyntaxRow { what: string; f: string; note?: string }
export interface SyntaxBlock { title: string; rows: readonly SyntaxRow[] }

export const syntaxSheet: readonly SyntaxBlock[] = [
  {
    title: 'Lookups',
    rows: [
      { what: 'Band / bracket (lower bounds ascending, first = 0)', f: '=LOOKUP(x,$F$5:$F$9,$G$5:$G$9)' },
      { what: 'Same with VLOOKUP', f: '=VLOOKUP(x,$F$5:$G$9,2,TRUE)', note: 'TRUE = bands, FALSE = exact codes' },
      { what: 'Exact by code', f: '=VLOOKUP(code,$A$5:$D$14,3,FALSE)', note: 'col counts from the table\'s first column' },
      { what: 'Key not in first column', f: '=INDEX($C$5:$C$14,MATCH(key,$A$5:$A$14,0))' },
      { what: 'Two-way grid', f: '=INDEX(grid,MATCH(row,rows,0),MATCH(col,cols,0))', note: 'use 1 instead of 0 for a numeric band' },
      { what: 'Grid by numbers', f: '=INDEX($B$3:$E$6,r,c)' },
      { what: 'Best option name', f: '=INDEX(names,MATCH(MAX(vals),vals,0))' },
    ],
  },
  {
    title: 'Random draws',
    rows: [
      { what: 'Discrete from CRF table', f: '=LOOKUP(RAND(),$C$2:$C$6,$A$2:$A$6)', note: 'CRF: first row 0, next = above + prob above' },
      { what: 'Uniform a to b', f: '=a+RAND()*(b-a)', note: 'whole numbers: RANDBETWEEN(a,b)' },
      { what: 'Normal', f: '=NORMINV(RAND(),mean,sd)', note: 'floor: =MAX(1/1440,NORMINV(RAND(),m/1440,s/1440))' },
      { what: 'Exponential (mean m)', f: '=-m*LN(RAND())', note: 'or -m*LN(1-RAND()); minutes as time: -m/1440*LN(RAND())' },
      { what: 'Binomial (n trials, chance p)', f: '=CRITBINOM(n,p,RAND())', note: 'guard n=0: IF(n>0,CRITBINOM(n,p,RAND()),0); BINOM.INV same' },
      { what: 'Yes/no with chance p', f: '=IF(RAND()<p,1,0)' },
      { what: 'Resample data', f: '=PERCENTILE(data,RAND())', note: 'observed values only: SMALL(data,RANDBETWEEN(1,n))' },
    ],
  },
  {
    title: 'Counting and totals',
    rows: [
      { what: 'Count above a cell value', f: '=COUNTIF(range,">"&B2)', note: 'the operator goes in quotes, the cell after &' },
      { what: 'Share waiting at most 5 min', f: '=COUNTIF(waits,"<="&5/1440)/COUNT(waits)' },
      { what: 'Total by category', f: '=SUMIF(cats,"North",amounts)' },
      { what: 'Two conditions', f: '=SUMPRODUCT((B2:B61="North")*(C2:C61>=24)*E2:E61)' },
      { what: 'Expected value / subtotal', f: '=SUMPRODUCT(values,probs)' },
      { what: 'Weighted average', f: '=SUMPRODUCT(x,w)/SUM(w)' },
    ],
  },
  {
    title: 'Queues',
    rows: [
      { what: 'Arrival', f: '=E14+C15', note: 'previous arrival + gap' },
      { what: 'Single-server start', f: '=MAX(E15,G14)', note: 'arrival vs previous end' },
      { what: 'Number in system at arrival', f: '=COUNTIF($G$14:G14,">"&E15)' },
      { what: 'c-server start', f: '=IF(J15<$G$4,E15,LARGE($G$14:G14,$G$4))', note: 'G4 = c; not MAX(...,LARGE) (#NUM! for first rows)' },
      { what: 'End, wait', f: '=F15+D15   =F15-E15' },
      { what: 'Utilisation (c servers)', f: '=SUM(D15:D99)/(c*(last end-open))' },
      { what: 'Batch: in area, boarded, left, turned away', f: '=MIN(D7+G6,cap)  =MIN(seats,E7)  =E7-F7  =MAX(D7+G6-cap,0)' },
    ],
  },
  {
    title: 'Time and dates',
    rows: [
      { what: 'Duration in hours / minutes', f: '=(C5-B5)*24   =(C5-B5)*1440' },
      { what: 'Add m minutes / s seconds', f: '=B5+m/1440   =B5+s/86400', note: 'or +TIME(h,m,s)' },
      { what: 'Band match on hours', f: '=VLOOKUP(ROUND((C5-B5)*24,6),bands,2,TRUE)' },
      { what: 'Day of week', f: '=WEEKDAY(d)', note: 'Sun=1 ... Fri=6, Sat=7; WEEKDAY(d,2): Mon=1 ... Sun=7' },
      { what: 'Parts / build', f: '=YEAR(d) MONTH(d) DAY(d)   =DATE(y,m,dd)   =TIME(h,m,s)' },
      { what: 'Formats', f: 'hh:mm:ss   [h]:mm (over 24 h)   dd-mmm-yy' },
    ],
  },
  {
    title: 'Finance (money out negative)',
    rows: [
      { what: 'Monthly payment', f: '=PMT(r/12,years*12,loan,[fv],[type])', note: 'returns negative; type 1 = start of period' },
      { what: 'PV / FV / RATE / NPER', f: '=PV(r,n,pmt,[fv],[type])  =FV(r,n,pmt,[pv],[type])  =RATE(n,pmt,pv,[fv])  =NPER(r,pmt,pv,[fv])' },
      { what: 'NPV with an outlay today', f: '=NPV(r,C15:C24)+C14', note: 'NPV discounts its FIRST value one period' },
      { what: 'IRR', f: '=IRR(C14:C24)', note: 'includes the time-0 flow' },
    ],
  },
  {
    title: 'Capacity and rounding',
    rows: [
      { what: 'Sold / unsold / lost', f: '=MIN(dem,stock)  =MAX(0,stock-dem)  =MAX(0,dem-stock)' },
      { what: 'Trucks, blocks, packs', f: '=ROUNDUP(amount/size,0)' },
      { what: 'Cheaper option', f: '=MIN(option1,option2)' },
      { what: 'Forecast', f: '=TREND($B$2:$B$11,$A$2:$A$11,A12)', note: 'y first, then x' },
    ],
  },
  {
    title: 'Tools: what to record',
    rows: [
      { what: 'Goal Seek', f: 'Set cell (formula) / To value / By changing (a value)', note: 'start near the answer for step functions' },
      { what: 'Solver', f: 'Objective, Max/Min, changing cells, each constraint as ranges (H8:H10 <= J8:J10), int, Simplex LP', note: 'Integer Optimality 0%; non-negative ticked' },
      { what: 'Data Table, one input', f: 'values down, =output top-right; Column input = model input' },
      { what: 'Replications', f: '1..N down, =output above; Column input = BLANK cell; AVERAGE the body', note: 'Automatic except tables, F9' },
      { what: 'Two-way (parameter)', f: '=output in corner; Row input = parameter cell; Column input = blank cell' },
      { what: 'Advanced Filter criteria', f: 'same row = AND; new row = OR; ="=North" exact; >=24; ">="&date' },
    ],
  },
]
