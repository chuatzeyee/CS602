export interface Formula {
  name: string
  formula: string
  note: string
  week: string
}

export const formulas: readonly Formula[] = [
  {
    "name": "Tank length from fixed volume",
    "formula": "=$C$3/(B6*C6)",
    "note": "CommunityWaterTank Model!D6. From V = L x W x H, length L = V/(W x H); $C$3 pins the 30 cbm volume while B6 (height) and C6 (width) stay relative so the formula fills down all height rows.",
    "week": "W1"
  },
  {
    "name": "Base area",
    "formula": "=C6*D6",
    "note": "CommunityWaterTank Model!E6. Base = Width x Length; fully relative so it fills straight down.",
    "week": "W1"
  },
  {
    "name": "Side (wall) area of open-top tank",
    "formula": "=2*(C6+D6)*B6",
    "note": "CommunityWaterTank Model!F6. Two walls of W x H plus two walls of L x H = 2(W+L)H; no top, and the base is costed separately.",
    "week": "W1"
  },
  {
    "name": "Tank cost via SUMPRODUCT",
    "formula": "=SUMPRODUCT($E$3:$F$3,E6:F6)",
    "note": "CommunityWaterTank Model!G6. Pairs unit costs ($10 base, $5 side in E3:F3, absolutely anchored) with the areas (E6:F6, relative) and sums: 10 x BaseArea + 5 x SideArea.",
    "week": "W1"
  },
  {
    "name": "Column average over an open-ended range",
    "formula": "=AVERAGE(C8:C65536)",
    "note": "RetailGasoline Model!C3. Averaging to the bottom of the sheet means newly inserted country rows are included automatically; the documentation block shows the tight form =AVERAGE(C8:C14).",
    "week": "W1"
  },
  {
    "name": "Column maximum",
    "formula": "=MAX(C8:C65536)",
    "note": "RetailGasoline Model!C4. Highest gasoline price in the year's column; filled right across all year columns.",
    "week": "W1"
  },
  {
    "name": "Column minimum",
    "formula": "=MIN(C8:C65536)",
    "note": "RetailGasoline Model!C5. Lowest gasoline price in the year's column; AVERAGE/MAX/MIN are the Week 1 summary trio.",
    "week": "W1"
  },
  {
    "name": "Historical performance ratio",
    "formula": "=$C9/E9",
    "note": "DataCenterAssets Model!E27. Business Volume / # Equipment; the $C column lock lets ONE formula fill right across seven asset classes and down ten years. Year 1 low-end: 3.91/20 = 0.1955 $b/BIPS.",
    "week": "W1"
  },
  {
    "name": "Volume-based TREND projection (Method 1 anchoring)",
    "formula": "=TREND(E$27:E$36,$C$27:$C$36,$C37)",
    "note": "DataCenterAssets Model!E45. Seven $ signs: known_y rows locked, known_x fully locked, new_x column locked — fills both right (asset classes) and down (projected years) without sliding the history window.",
    "week": "W1"
  },
  {
    "name": "Projected asset requirement",
    "formula": "=$C19/E37",
    "note": "DataCenterAssets Model!E19. New requirement = projected Customer Deposit / planned performance ratio, where E37 holds the negotiated target adjusted from the TREND output.",
    "week": "W1"
  },
  {
    "name": "Economic Order Quantity",
    "formula": "=SQRT(2*B6*C6/D6)",
    "note": "Assign0Soln Q1!E6. EOQ = SQRT(2DO/C) with D=demand (B6), O=order cost (C6), C=carry cost (D6); orders per year follow as =B6/E6. Format as integer, or use ROUND/ROUNDUP/ROUNDDOWN when a true integer is wise.",
    "week": "W1"
  },
  {
    "name": "Break-even point in units",
    "formula": "=D5/((1-C5)*B5)",
    "note": "Assign0Soln Q2!E5. Fixed Cost / unit marginal contribution, where contribution = (1 - VariableCost%) x UnitPrice; dollar volume is =D5/(1-C5) and profit check is =E5*(B5-B5*C5)-D5.",
    "week": "W1"
  },
  {
    "name": "Linear price-demand table",
    "formula": "=10-0.6*(B10-$B$9)/10",
    "note": "Demand sheet, C10: demand in '000 falls 0.6 for every $10 above the $0 base price; equivalent to y = -0.06x + 10.",
    "week": "W2"
  },
  {
    "name": "Printer demand (intercept/slope form)",
    "formula": "=$C14+$C15*C5",
    "note": "Model sheet, unguarded core of the IF in C18: demand = intercept (10) + slope (-0.06) x printer price; keeps parameters in separate cells so sensitivity analysis can vary them.",
    "week": "W2"
  },
  {
    "name": "Guarded printer demand (IF)",
    "formula": "=IF(C6>$C12*C5,0,$C14+$C15*C5)",
    "note": "Model sheet C18: demand collapses to 0 when the cartridge price C6 exceeds the max ratio (2/3) times the printer price — the bait & hook limit.",
    "week": "W2"
  },
  {
    "name": "Cartridge price link",
    "formula": "=$C12*C5",
    "note": "Model sheet C6: cartridge price set at the ratio (0.67) of printer price in the trade-off row.",
    "week": "W2"
  },
  {
    "name": "Cartridge demand",
    "formula": "=$C13*C18",
    "note": "Model sheet C19: cartridge demand = cartridges per printer (6) x printer demand.",
    "week": "W2"
  },
  {
    "name": "Unit profit margin",
    "formula": "=(C5-$C9)/$C9",
    "note": "Model sheet C20 (printer). Same pattern on Proto at trial prices: printer (60-55)/55 = 9.1%, cartridge (20-12)/12 = 66.7%.",
    "week": "W2"
  },
  {
    "name": "Total cost with fixed cost",
    "formula": "=C27+C28+$C11",
    "note": "Model sheet C29: printer cost + cartridge cost + fixed cost ($70k). Proto omitted the fixed cost — 'Shouldn't there be a fixed cost?'",
    "week": "W2"
  },
  {
    "name": "Profit (performance measure)",
    "formula": "=C26-C29",
    "note": "Model sheet C32: Total Revenue - Total Cost; C33 = C32/C26 gives profit as a % of revenue.",
    "week": "W2"
  },
  {
    "name": "Rough-model total cost",
    "formula": "=C17*E8+C20*G8+C23",
    "note": "FormulaAudit K20: printer unit cost x printer demand + cartridge unit cost x cartridge demand + fixed cost; paired with profit M13 = K8-K20.",
    "week": "W2"
  },
  {
    "name": "Expected return per level (IIE)",
    "formula": "=(1-C$21)*C$16*C20",
    "note": "InvestInEducation Model C11: (1 - default probability) x students x return per student.",
    "week": "W2"
  },
  {
    "name": "Expected margin and margin % (IIE)",
    "formula": "=C11-C10  and  =C12/C10",
    "note": "C12 = E[Return] - Investment; C13 = margin as % of investment. Overall: L4 = K4/I4 = 53,283/260,300 = 20.47%.",
    "week": "W2"
  },
  {
    "name": "LOOKUP syntax",
    "formula": "=LOOKUP(lookup_value, lookup_vector, [result_vector])",
    "note": "lookup_vector must be sorted ascending; returns the entry for the largest value <= lookup_value.",
    "week": "W3"
  },
  {
    "name": "VLOOKUP syntax",
    "formula": "=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])",
    "note": "Searches the leftmost column only; TRUE/omitted = approximate match (ascending data required), FALSE = first exact match or #N/A.",
    "week": "W3"
  },
  {
    "name": "INDEX by position (DataLookUp.xlsx H4)",
    "formula": "=INDEX(B2:B226,G4)",
    "note": "With G4 = 1 this returns Liechtenstein, the country in row position 1 of the array.",
    "week": "W3"
  },
  {
    "name": "MATCH exact (DataLookUp.xlsx H12)",
    "formula": "=MATCH(G12,B2:B226,0)",
    "note": "Match_type 0 returns the first exact position; with G12 = \"Brunei\" it returns 10.",
    "week": "W3"
  },
  {
    "name": "INDEX + MATCH (DataLookUp.xlsx H20)",
    "formula": "=INDEX(C2:C226,MATCH(G20,B2:B226,0))",
    "note": "MATCH computes the row position of Singapore, INDEX returns its GDP per capita (60500).",
    "week": "W3"
  },
  {
    "name": "Two-MATCH INDEX (DataLookUp.xlsx H25)",
    "formula": "=INDEX($C$2:$D$226,MATCH($G$24,$B$2:$B$226,0),MATCH(H23,$H$23:$I$23,0))",
    "note": "One MATCH supplies row_num, the second supplies column_num, giving a full 2-D lookup.",
    "week": "W3"
  },
  {
    "name": "XLOOKUP default exact match (XLOOKUP-IFS.xlsx C13)",
    "formula": "=XLOOKUP(C12,B3:B9,C3:C9)",
    "note": "Default match_mode is 0 (exact): looking up 1 returns D; a missing value returns #N/A unless if_not_found is supplied.",
    "week": "W3"
  },
  {
    "name": "XLOOKUP next-larger from last (XLOOKUP-IFS.xlsx C20)",
    "formula": "=XLOOKUP(C15,B3:B9,C3:C9,\"Duh\",1,-1)",
    "note": "match_mode 1 = next larger item, search_mode -1 = search from the last item; looking up 2 returns G (the last 3 in the array).",
    "week": "W3"
  },
  {
    "name": "XLOOKUP binary search (XLOOKUP-IFS.xlsx C33)",
    "formula": "=XLOOKUP(C32,B24:B30,C24:C30,\"Duh\",-1,2)",
    "note": "search_mode 2 performs a fast binary search but requires the lookup_array sorted ascending (-2 for descending).",
    "week": "W3"
  },
  {
    "name": "IFS min-max capping (XLOOKUP-IFS.xlsx F6)",
    "formula": "=IFS(C6<$C$3,0,C6>$E$3,100,TRUE,C6)",
    "note": "Equivalent to =IF(C6<$C$3,0,IF(C6>$E$3,100,C6)) and to =MIN($E$3,MAX($C$3,C6)); TRUE is the catch-all branch.",
    "week": "W3"
  },
  {
    "name": "Casino Hotel net income objective (Model J14)",
    "formula": "=SUM(H14, -H20)",
    "note": "Net income = total revenue H14 (=SUM(H18:H19), base + food revenue) minus total direct expense H20; this is the cell Solver maximizes.",
    "week": "W3"
  },
  {
    "name": "Casino Hotel floor space constraint (Model H17 <= J17)",
    "formula": "=SUM(C17:F17)  <=  =SUM(J9,-J10,-J11)",
    "note": "Space used (each C17 = C$4*C8, guests times space per guest) must not exceed net space 50000 - 5000 - 5000 = 40000.",
    "week": "W3"
  },
  {
    "name": "PMT — loan payment with balloon",
    "formula": "=PMT(B12/12, C12, D12, E12)  → =PMT(5%/12, 60, 140000, -10000)",
    "note": "TimeValue.xlsm PMT sheet F12: monthly payment ≈ -$2,494.93 for a $140,000 car loan at 5% p.a. monthly rest with a $10,000 balloon.",
    "week": "W4"
  },
  {
    "name": "PV — beginning-of-month withdrawals",
    "formula": "=PV(B12/12, C12, F12, E12, 1)  → =PV(3%/12, 9, -3500, -600, 1)",
    "note": "TimeValue.xlsm PV sheet D12: type 1 puts the $3,500 withdrawals at the beginning of each month; result ≈ $31,774.27.",
    "week": "W4"
  },
  {
    "name": "FV — lump sum plus yearly injections",
    "formula": "=FV(B12, C12, F12, D12)  → =FV(6.5%, 10, -8000, -50000)",
    "note": "TimeValue.xlsm FV sheet E12: future value of $50,000 now plus $8,000 per year for 10 years at 6.5% p.a.",
    "week": "W4"
  },
  {
    "name": "RATE — required return",
    "formula": "=RATE(C12, F12, D12, E12)  → =RATE(10, -8000, -50000, 250000)",
    "note": "TimeValue.xlsm RATE sheet B12: iterative, default guess 10%, #NUM! if no convergence in 20 iterations; answer ≈ 9.59% p.a.",
    "week": "W4"
  },
  {
    "name": "NPER — investment duration",
    "formula": "=NPER(B12, F12, D12, E12)  → =NPER(8%, -8000, -50000, 250000)",
    "note": "TimeValue.xlsm NPER sheet C12 ≈ 11.01 years. The schedule cross-check =MATCH(M10, N14:N34, 1) returns 12: the list starts at year 0, so position 12 is year 11, the last balance still under $250,000, and the target is crossed during year 12.",
    "week": "W4"
  },
  {
    "name": "NPV — with initial investment today",
    "formula": "=NPV(B10, C15:C24) + C14",
    "note": "TimeValue.xlsm NPV sheet C10: the -$200,000 in C14 occurs today, so it is excluded from NPV() and added to the result.",
    "week": "W4"
  },
  {
    "name": "Manual present value of one cash flow",
    "formula": "=M14/(1+L$10)^L14   (PV = CashFlow / (1+rate)^n)",
    "note": "TimeValue.xlsm NPV sheet N14: summing these per-year PVs reproduces NPV() exactly — NPV(10%,-10000,3000,4200,6800) = $1,188.44.",
    "week": "W4"
  },
  {
    "name": "IRR — internal rate of return",
    "formula": "=IRR(C14:C24)",
    "note": "TimeValue.xlsm IRR sheet C10: include ALL values (year-0 outflow too); needs ≥1 positive and ≥1 negative value; result ≈ 24.05%.",
    "week": "W4"
  },
  {
    "name": "Residue loan recurrence",
    "formula": "=N14*(1+L$10/12)-M15",
    "note": "TimeValue.xlsm PMT sheet N15: each month's residue = previous residue grown one month at 5%/12 minus the payment — the no-function check used with Goal Seek.",
    "week": "W4"
  },
  {
    "name": "Charity Donation circular formulas",
    "formula": "D12 =MAX(0,C11*D15);  D14 =D5-D6-D12;  D15 =(1-C8)*D14",
    "note": "CharityDonation.xlsx Model sheet: charity is 10% of after-tax profit while being deducted before tax — enable iterative calculation (max change 0.0001); converges to ≈$4,988.",
    "week": "W4"
  },
  {
    "name": "Black-Scholes d1",
    "formula": "=(LN(D4/D5)+(D6+D7^2/2)*D8)/(D7*SQRT(D8))",
    "note": "BlackScholes.xlsm Model D11: d1 = [LN(S/X) + (rf + σ²/2)t]/[σ√t]; D12 uses (D6-D7^2/2) for d2.",
    "week": "W4"
  },
  {
    "name": "Black-Scholes call and put prices",
    "formula": "Call D15 =D4*D13-D5*EXP(-D6*D8)*D14;  Put D21 =-D4*D19+D5*EXP(-D6*D8)*D20",
    "note": "BlackScholes.xlsm Model: D13 =NORMSDIST(D11) is N(d1), D14 =NORMSDIST(D12) is N(d2); D19/D20 use the negated d values for the put.",
    "week": "W4"
  },
  {
    "name": "Continuous empirical resampling (M2b)",
    "formula": "=PERCENTILE(C$12:C$997,RAND())",
    "note": "Resamples continuous data by drawing a random percentile; Excel sorts and linearly interpolates between bracketing data points. From DataSim.xlsx Continuous sheet.",
    "week": "W5"
  },
  {
    "name": "Discrete empirical resampling (M2a)",
    "formula": "=SMALL($C$12:$C$997,RANDBETWEEN(1,$C$8))",
    "note": "Picks the k-th smallest data point where k = RANDBETWEEN(1, N) and $C$8 = COUNT of the sample; every original observation is equally likely. From DataSim.xlsx Discrete sheet.",
    "week": "W5"
  },
  {
    "name": "CRF table lookup (M1)",
    "formula": "=LOOKUP(RAND(),M$12:M$32,L$13:L$33)",
    "note": "Looks a RAND() draw up in the cumulative relative frequency column; the value range is down-shifted one row because LOOKUP matches the largest CRF <= RAND(). VLOOKUP variant: =VLOOKUP(0.556,H9:I13,2) with CRF as the leftmost column.",
    "week": "W5"
  },
  {
    "name": "Continuous uniform variate",
    "formula": "=F$6+RAND()*(F$7-F$6)",
    "note": "X' = min + RAND()*(max − min). F$6 = min, F$7 = max in DataSim.xlsx; the Learn sheet uses the same pattern =H12+RAND()*(I12-H12).",
    "week": "W5"
  },
  {
    "name": "Discrete uniform variate (die toss)",
    "formula": "=RANDBETWEEN(1,6)",
    "note": "Random integer 1-6 inclusive. Equivalent without the Analysis Toolpak: =INT(RAND()*6)+1, or generally =INT(RAND()*(top-bottom+1))+bottom.",
    "week": "W5"
  },
  {
    "name": "Normal variate by inversion (M3a)",
    "formula": "=NORMINV(RAND(),G$4,G$5)",
    "note": "Inverts the normal CDF at a random cumulative probability; G$4 = mean, G$5 = SD. Standard normal: =NORMSINV(RAND()).",
    "week": "W5"
  },
  {
    "name": "Exponential variate by inversion (M3a)",
    "formula": "=-H$4*LN(1-RAND())",
    "note": "From solving Y = 1 − e^−λx for x: X' = −mean*LN(1−RAND()); H$4 = mean = 1/λ. Since 1−RAND() is still uniform, =-mean*LN(RAND()) is equivalent.",
    "week": "W5"
  },
  {
    "name": "Binomial and Poisson variates (M3b)",
    "formula": "=CRITBINOM(I$4,I$5,RAND())",
    "note": "Smallest k whose cumulative Binomial(n=I$4, p=I$5) probability >= RAND(); modern name BINOM.INV. Poisson has no direct inverse, so approximate with λ=np: =CRITBINOM(1000,J$4/1000,RAND()).",
    "week": "W5"
  },
  {
    "name": "Monty Hall revealed door",
    "formula": "=INDEX($G$4:$I$6,C10,D10)",
    "note": "Reads the Reveal Door Options Matrix by (prize door C10, selected door D10). Diagonal cells hold =RANDBETWEEN(2,3), =IF(RAND()<0.5,1,3), =RANDBETWEEN(1,2) since the host has 2 choices when prize = selected. From MontyHall.xlsx Model sheet.",
    "week": "W5"
  },
  {
    "name": "Monty Hall change door and win indicator",
    "formula": "=6-D10-E10",
    "note": "Change door = 6 − (selected + revealed) since door numbers sum to 6. Win indicator: =(G10=$C10)*1 converts TRUE/FALSE to 1/0; win probability: =SUM(K10:K1009)/COUNT(K10:K1009), i.e. an average over 1000 trials.",
    "week": "W5"
  },
  {
    "name": "Village tank size (array formula)",
    "formula": "{=MAX(0,C12:N12-C13:N13)-MAX(0,N12-N13)}",
    "note": "MAX(0, Cum Supply − Cum Demand) over all 12 months minus the December surplus, so leftover year-end water is flushed. Household version over 24 hours: {=MAX(0,C17:N17-C18:N18,C21:N21-C22:N22)-MAX(0,N21-N22)}. From VillageWater.xlsx Model sheet.",
    "week": "W5"
  },
  {
    "name": "Sinusoidal hourly household demand",
    "formula": "=SUM(B18,($C$5/24)*$C$4*(1-SIN(C16/24*2*PI())))",
    "note": "Accumulates hourly demand using the (1 − SIN(i/24*2π)) consumption pattern; $C$5 = litres/person/day, $C$4 = family size 5, C16 = hour i. Rainfall uncertainty extension: MAX(0, average rainfall − NORMINV(RAND(),0,CV*MEAN)).",
    "week": "W5"
  },
  {
    "name": "Rebuild a date from its parts",
    "formula": "=DATE(B2,B3,B4)",
    "note": "CallCenter-modified Scratch!B5, where B2 =YEAR(B1), B3 =MONTH(B1) and B4 =DAY(B1) split B1 =TODAY(). DATE returns the serial number (46292 for 27 Sep 2026 in the saved file), so format the cell as a date to read it.",
    "week": "W6"
  },
  {
    "name": "Rebuild a time from its parts",
    "formula": "=TIME(D2,D3,D4)",
    "note": "Scratch!D5, with D2 =HOUR(D1), D3 =MINUTE(D1), D4 =SECOND(D1) and D1 =NOW(). TIME returns only the fraction of a day (18:05:11 becomes 0.7536), never a date.",
    "week": "W6"
  },
  {
    "name": "Days between two dates",
    "formula": "=DATE(2005,1,14)-DATE(2004,9,23)",
    "note": "Slide example returning 113. Dates are serial numbers, so subtraction gives elapsed days. Quoted text (\"14-Jan-05\"-\"23-Sep-04\") also works, but a bare 14-Jan-05 typed inside a formula does not.",
    "week": "W6"
  },
  {
    "name": "Exponential random duration",
    "formula": "=-$C$4*LN(RAND())",
    "note": "1-Server!C15 (inter-arrival; D15 uses $D$4 for service). The inverse exponential with mean C4 (5:00). LN of a number between 0 and 1 is negative, so the leading minus makes the duration positive. The result is a time value, formatted mm:ss.",
    "week": "W6"
  },
  {
    "name": "Resampled random duration",
    "formula": "=PERCENTILE(Data!$B$13:$K$27, RAND())",
    "note": "c-Server!C15 (and all BR sheets). Re-samples the 150 observed inter-arrival times on the Data sheet; D15 does the same with Data!$B$30:$K$44 for service times. Absolute references let it fill down 50 rows.",
    "week": "W6"
  },
  {
    "name": "Single-server service start",
    "formula": "=MAX(E15,G14)",
    "note": "1-Server!F15. Service starts at the later of this customer's arrival (E15) and the previous customer's service end (G14). G14 = 9:00 is the opening time acting as customer 0's end.",
    "week": "W6"
  },
  {
    "name": "Customers in system at arrival",
    "formula": "=COUNTIF($G$14:G14,\">\"&E15)",
    "note": "1-Server!J15 and c-Server!J15. Counts earlier customers whose service end time is later than this arrival. The expanding range $G$14:G14 grows as it fills down, and \">\"&E15 builds the text criterion from the arrival time.",
    "week": "W6"
  },
  {
    "name": "c-server service start",
    "formula": "=IF(J15<$G$4,E15,LARGE($G$14:G14,$G$4))",
    "note": "c-Server!F15 (G4 = number of servers). Fewer than c in the system means start on arrival; otherwise the c-th largest earlier end time, which is when the first busy server frees up. The IF also keeps LARGE from running before c end times exist (it would return #NUM!).",
    "week": "W6"
  },
  {
    "name": "Utilisation with c servers",
    "formula": "=SUM(D15:D99)/(G4*(G8-G14))",
    "note": "c-Server!D8: total service time ÷ (servers × time from opening G14 to the last service end G8). Traffic intensity sits beside it in C8 =(D4/G4)/C4. The 1-Server versions are D8 =SUM(D15:D99)/(G8-G14) and C8 =D4/C4.",
    "week": "W6"
  },
  {
    "name": "Average number of customers in the system",
    "formula": "=SUMPRODUCT(((J15:J98+1)+J16:J99)/2,C16:C99)/(E8-E14)",
    "note": "1-Server!J8 (entered as an array formula). The Explain sheet sums trapezoids of the customers-in-system curve between consecutive arrivals, ((J_k + 1) + J_(k+1))/2 × the next inter-arrival time, then divides by the elapsed time from opening E14 to the last arrival E8.",
    "week": "W6"
  },
  {
    "name": "Potential start with balking",
    "formula": "=IF(L15>F$4,\"\",IF(L15>=I$4,LARGE(I$14:I14,I$4),$E15))",
    "note": "c-Server (BR)!F15. Blank if the system length L15 exceeds the balk limit F4 (the customer balks); otherwise the c-server rule with I4 servers over the service end column I.",
    "week": "W6"
  },
  {
    "name": "BR-M service end time",
    "formula": "=IF(F15=\"\",\"\",IF(G15>$G$4,E15+$G$4,H15+D15))",
    "note": "c-Server (BR) (Modified)!I15. Balkers stay blank, renegers (potential wait G15 > renege limit G4) leave at arrival + G4, and served customers end at start + service time. This keeps renegers in the system length L for exactly the renege limit.",
    "week": "W6"
  },
  {
    "name": "Balk proportion",
    "formula": "=(COUNT(E15:E99)-COUNT(F15:F99))/COUNT(E15:E99)",
    "note": "c-Server (BR)!F8. COUNT only counts numbers, so the \"\" left by balkers drops out. The renege proportion beside it is G8 =(COUNT(F15:F99)-COUNT(H15:H99))/COUNT(F15:F99), which divides by those who joined, not by all arrivals.",
    "week": "W6"
  },
  {
    "name": "Worksheet row of a record",
    "formula": "=IFERROR(MATCH(C7,C12:C1048576,0)+11,\"\")",
    "note": "Macro-Recording-2.xlsm Model!B7. Exact-match MATCH gives the position in the table starting at row 12, and +11 converts it to the sheet row read by deleteRecord. Macro-Recording.xlsm uses +ROW(C11) instead. IFERROR returns \"\" for an unknown ID.",
    "week": "W6"
  },
  {
    "name": "Fetch a whole record",
    "formula": "=IF(C7=\"\",\"\",INDEX(D12:G1048576,MATCH(C7,C12:C1048576,0),0))",
    "note": "Model!D7:G7, entered as one array formula across the four cells. column_num 0 makes INDEX return the whole matching row (Name, Gender, Address, DOB); a missing ID returns #N/A.",
    "week": "W6"
  },
  {
    "name": "VBA: advance the Last ID after adding",
    "formula": "Range(\"B4\").Value = Range(\"B4\").Value + 1",
    "note": "The line added by hand at the end of the recorded addRecord macro. B4 stores the last ID used, so C4 =B4+1 offers the next ID. In deleteRecord the hand-added lines read rowNum = Range(\"B7\").Value, then If rowNum <> \"\" Then Rows(rowNum).Select / Selection.Delete, so a blank B7 (unknown ID) deletes nothing.",
    "week": "W6"
  },
  {
    "name": "Live clock",
    "formula": "=NOW()",
    "note": "TimerClicker Timer!D3 (and Clicker!D3), format h:mm:ss. NOW is volatile but only refreshes on recalculation, so the recording steps start with F9 and the tidied macros start with the VBA Calculate statement.",
    "week": "W9"
  },
  {
    "name": "Time-now copy row",
    "formula": "=$D$3",
    "note": "Timer!C7, D7 and E7. Each Record macro copies its column's row-7 cell and pastes it as a value, freezing the time stamp. Because row 7 is never empty, End(xlDown) from the header always finds a filled cell.",
    "week": "W9"
  },
  {
    "name": "Inter-arrival time (guarded)",
    "formula": "=IF(C6>C7,\"\",C7-C6)",
    "note": "Timer!F7, filled down, format m:ss. Excel ranks text above numbers, so the header 'Arrive' in C6 blanks row 7. Row 8 compares with the live clock in C7, which is always later than the first stamp, so the first customer also shows blank; real gaps start at customer 2.",
    "week": "W9"
  },
  {
    "name": "Service time",
    "formula": "=E7-D7",
    "note": "Timer!G7, format m:ss: service end minus service start.",
    "week": "W9"
  },
  {
    "name": "Wait time",
    "formula": "=D7-C7",
    "note": "Timer!H7, format m:ss: service start minus arrival (time spent in the queue).",
    "week": "W9"
  },
  {
    "name": "System time",
    "formula": "=E7-C7",
    "note": "Timer!I7, format m:ss: service end minus arrival, which equals wait plus service.",
    "week": "W9"
  },
  {
    "name": "Cumulative arrivals up to a time bin",
    "formula": "=FREQUENCY(C$8:C$999,$F7)",
    "note": "TimerClicker Clicker!G7, filled across to I and down the bins by CompleteCumFreqTable. With a single bin value FREQUENCY counts the stamps at or before that time, which gives a cumulative count; C$8 keeps the data rows fixed while $F7 keeps the bin column fixed.",
    "week": "W9"
  },
  {
    "name": "Stamp a value in the next empty row (VBA)",
    "formula": "Calculate\nRange(\"C7\").Copy\nRange(\"C6\").End(xlDown).Offset(1, 0).Select\nSelection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats\nApplication.CutCopyMode = False",
    "note": "TimerClicker Module1 RecordArrive (RecordStart and RecordEnd swap in D7/D6 and E7/E6). This is the tidied form of the recorded keystrokes F9, copy, Ctrl+Down, Down Arrow (relative), Paste Special Values and Number Formats, then Esc.",
    "week": "W9"
  },
  {
    "name": "Relative move as recorded (VBA)",
    "formula": "ActiveCell.Offset(-2,0).Range(\"A1\").Select",
    "note": "Slide 3 (Absolute vs Relative Reference). Recorded with Use Relative References ON, it means 'two rows up from the current cell'; .Range(\"A1\") is the offset cell itself.",
    "week": "W9"
  },
  {
    "name": "Call a worksheet function from VBA",
    "formula": "Dim myRange As Range\nSet myRange = Worksheets(\"Sheet1\").Range(\"A1:A10\")\nAnswer = Application.WorksheetFunction.Min(myRange)",
    "note": "Slide 19 (UseFunction). Object variables need Set; most worksheet functions are reached through Application.WorksheetFunction.<name>. UsefulMacros' UseXLFunction does the same with WorksheetFunction.Sum(Range(\"C4:C7\")).",
    "week": "W9"
  },
  {
    "name": "Write a result vs write a formula (VBA)",
    "formula": "Total = WorksheetFunction.Sum(Range(\"C4:C7\"))\nRange(\"C8\") = Total\n\nRange(\"C8\").Formula = \"=SUM(C4:C7)\"",
    "note": "UsefulMacros M2_Function: UseXLFunction leaves a fixed 30000 in Worksheet!C8, while EnterFormula leaves a live =SUM(C4:C7) that updates when C4:C7 change.",
    "week": "W9"
  },
  {
    "name": "User-defined function",
    "formula": "Function CubeRoot(number)\n    CubeRoot = number ^ (1/3)\nEnd Function",
    "note": "Slide 11. The value is returned by assigning to the function's name. Written in a Module, it can be used in a cell (=CubeRoot(27) gives 3) or called from a Sub (Ans = CubeRoot(123) is about 4.973).",
    "week": "W9"
  },
  {
    "name": "Workbook and sheet name UDFs in cells",
    "formula": "=WorkbookName()   =WorksheetName()",
    "note": "UsefulMacros Worksheet!C13:C14, backed by M2_Function. Both declare Application.Volatile True so they recalculate. WorksheetName uses Application.Caller.Parent.Name, the sheet holding the calling cell.",
    "week": "W9"
  },
  {
    "name": "Clickable file list",
    "formula": "=IF(C11=\"\",\"\",HYPERLINK($C$8&\"\\\"&C11,C11))",
    "note": "UsefulMacros Workbook!D11, filled down to D52. C8 holds the folder path written by GetFilePath, and C11 down hold the file names written by ListFiles; the IF keeps empty rows blank.",
    "week": "W9"
  },
  {
    "name": "Colour a column of cells in a loop (VBA)",
    "formula": "For i = 1 To Num - 1\n    Range(\"A1\").Offset(i, 0).Interior.ColorIndex = i + 1\nNext i",
    "note": "IntroVBA-V2 Module1 Ex6_ColorMeBad, which runs only after If Num >= 1 And Num <= 56 passes. A1 is set to ColorIndex 1 (black) first, so an input of 5 colours A1:A5 with indexes 1 to 5.",
    "week": "W9"
  },
  {
    "name": "Watch selected cells in a Change event (VBA)",
    "formula": "If Intersect(Target, Range(\"C4:C5,F4:F5\")) Is Nothing Then\n    Exit Sub\nElse\n    Range(\"C10\") = \"??\"\n    Range(\"C10\").Select\nEnd If",
    "note": "UsefulMacros M7_OtherEvents Worksheet_Change2. Intersect returns Nothing when the edited cells (Target) do not overlap the watched inputs, so the handler exits; otherwise it flags C10 with \"??\" and selects it.",
    "week": "W9"
  },
  {
    "name": "As-at date",
    "formula": "=TODAY()",
    "note": "OffshoreDevelopment-modified Model!B4 displays the as-at date, but in this class file the alert windows (H8:I12) call TODAY() themselves rather than reading B4. In the textbook version B4 holds a typed date (documented as '=TODAY() or <Input>') and H8:I12 add the offsets to $B$4, so a past situation can be replayed.",
    "week": "W10"
  },
  {
    "name": "Look up the selected alert window",
    "formula": "=VLOOKUP($E$4,$E$8:$I$12,2)",
    "note": "Model!F4; G4, H4 and I4 use column indexes 3, 4 and 5 to fetch To (days), Date From and Date To for the level picked in the E4 drop-down.",
    "week": "W10"
  },
  {
    "name": "Guarded window start date",
    "formula": "=IF(TODAY()+F8<1,1,TODAY()+F8)",
    "note": "Model!H8, filled down H8:I12 (I8 uses G8). For 'All' and level 3 the offset -99999 makes TODAY()+F8 negative, so the IF substitutes serial 1 = 1 Jan 1900, the first valid date in Excel's 1900 date system.",
    "week": "W10"
  },
  {
    "name": "Lower-bound criterion as text",
    "formula": "=\">=\"&TEXT(H4,\"d MMM yyyy\")",
    "note": "Model!D15 under the first Due Date header. Criteria values must be strings, so TEXT turns the window start into text such as >=26 Sep 2023 (level 1 as at the saved date 24 Oct 2023).",
    "week": "W10"
  },
  {
    "name": "Upper-bound criterion as text",
    "formula": "=\"<=\"&TEXT(I4,\"d MMM yyyy\")",
    "note": "Model!E15 under the second Due Date header. With D15 on the same row this forms an AND window on one field: Due Date >= from AND Due Date <= to.",
    "week": "W10"
  },
  {
    "name": "Completed? flag",
    "formula": "=IF(E20=\"\",\"No\",\"Yes\")",
    "note": "Model!F20 filled to F269. Any completion date in column E marks the milestone completed.",
    "week": "W10"
  },
  {
    "name": "On Time? flag",
    "formula": "=IF(E20= \"\", \"\", IF(E20> D20, \"No\", \"Yes\"))",
    "note": "Model!G20. Blank until completed; then No if the completion date is after the due date, otherwise Yes.",
    "week": "W10"
  },
  {
    "name": "Rolling due date",
    "formula": "=TODAY()+L20",
    "note": "Proto!D20 in the modified workbook (Model!D20 is =Proto!D20). Fixed day offsets in Proto!L20:L268 keep the due dates near today, so every alert level has milestones whenever the file is opened.",
    "week": "W10"
  },
  {
    "name": "Alert colour band (conditional formatting)",
    "formula": "Cell Value between =$H$10 and =$I$10",
    "note": "Rule on Model!D20:D270 that paints level-1 due dates light yellow; companion rules use $H$11/$I$11 (pink, level 2) and $H$12/$I$12 (tan, level 3).",
    "week": "W10"
  },
  {
    "name": "Drop-down sources (data validation)",
    "formula": "List source: =$E$8:$E$12   |   F15:G15: Yes, No   |   H15:I15: Waived, Done",
    "note": "Model!E4 offers All, 0, 1, 2, 3; the criteria cells F15:I15 and review columns H20:I269 are restricted to valid words so typed criteria always match the data.",
    "week": "W10"
  },
  {
    "name": "Advanced Filter criteria typed as text",
    "formula": "C4: >=30     (Example 2: H4 >=30, H5 <30)",
    "note": "Demo-Advanced-Filter Sheet1. A comparison operator followed by a value, entered under the Age header; F and M under Gender select the gender.",
    "week": "W10"
  },
  {
    "name": "Recorded Advanced Filter call (VBA)",
    "formula": "Range(\"B19:I65536\").AdvancedFilter Action:=xlFilterInPlace, CriteriaRange:=Range(\"D14:I15\"), Unique:=False",
    "note": "Filter_Alert in the Model sheet's code module. When E4 = \"All\" the same call uses CriteriaRange:=Range(\"D14:E15\"), dropping the status criteria.",
    "week": "W10"
  },
  {
    "name": "Re-filter when a watched cell changes (VBA)",
    "formula": "If Intersect(Target, Range(\"E4\", \"F15:I15\")) Is Nothing Then Exit Sub Else Call Filter_Alert",
    "note": "Worksheet_Change event of the Model sheet (modified workbook). Two-argument Range spans the rectangle E4:I15; the textbook version watches only Range(\"E4\").",
    "week": "W10"
  },
  {
    "name": "Reset the as-at date (VBA)",
    "formula": "Range(\"B4\").Formula = \"=TODAY()\"",
    "note": "Sub SetToday in the Model sheet's module: writes the =TODAY() formula back into B4, for example after a fixed test date was typed there.",
    "week": "W10"
  },
  {
    "name": "Show a cell's formula as documentation (UDF)",
    "formula": "ShowFormula = \" \" & R.Formula",
    "note": "Module1 user-defined function (Application.Volatile). Returns a cell's formula text with a leading space - the style used in Model's documentation column N.",
    "week": "W10"
  },
  {
    "name": "Formula cross-check of the pivot total",
    "formula": "=SUMIFS(Data!$D$2:$D$361,Data!$E$2:$E$361,\"Q2\")",
    "note": "Not in the workbook: reproduces GrandGrocery PivotTable!L95 = 2,123,685. Adding a Product condition (Data!$C$2:$C$361,\"Butter\") returns the Butter row total 63,518 - useful when an exam answer must be a formula.",
    "week": "W10"
  }
]
