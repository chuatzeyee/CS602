import type { Lab } from './types'

export const walkthroughs: readonly Lab[] = [
  {
    "id": "communitywatertank-cost-model",
    "week": "W1",
    "title": "CommunityWaterTank.xlsx: minimising the cost of a 30 cbm village water tank",
    "overview": "Sammy must build an open-top rectangular concrete tank holding 30 cubic metres of water. Site constraints fix the width at 2 m; the base costs $10/sqm and the sides $5/sqm. The workbook enumerates candidate heights, derives length from the fixed volume, computes areas and cost per row, and reveals a U-shaped cost curve with its minimum of $305 at height 3.87 m. It is the week's signature example of separating parameters, decisions and outputs.",
    "takeaways": [
      "Separate the worksheet into parameters, decision column, derived columns and documentation — never hardcode a number inside a formula.",
      "Enter each parameter once (width in C6) and reference it absolutely (=$C$6) so a single edit updates the entire model.",
      "Anchor deliberately: $C$3 for the constant volume, relative B6/C6 for row-specific values, and SUMPRODUCT with absolute unit costs for a fill-safe cost line.",
      "Enumerating a decision over a sensible grid exposes the U-shaped cost curve and brackets the minimum without any advanced tools: the best grid row is $305 at H = 4 m, and the workbook's note puts the true optimum at about H = 3.87 m (still ≈ $305).",
      "A Documentation block that marks '<Input>' cells and shows each unique formula makes the model auditable from a printout alone."
    ],
    "steps": [
      {
        "title": "Frame the problem before touching Excel",
        "explanation": "The Home sheet sets the brief: build an open-top rectangular concrete tank that holds 30 cubic metres (cbm) of water, with the width fixed at 2 m; concrete costs $10 per square metre (sqm) for the base and $5 per sqm for the side walls. The influence diagram fixes the logic: Height (Decision) and the Parameters determine Length, Length determines the areas, the areas determine Cost."
      },
      {
        "title": "Lay out the input parameters in their own cells",
        "explanation": "Row 3 of the Model sheet holds the required volume and the two unit costs, each typed once beside a label and never hardcoded into formulas (the width parameter is entered once in C6, covered below).",
        "code": "B3: 'Volume (cbm)'   C3: 30\nD3: 'Unit Cost'      E3: 10 (base $/sqm)   F3: 5 (side $/sqm)"
      },
      {
        "title": "Enumerate the decision variable down column B",
        "explanation": "Candidate heights run from 0.25 m to 7 m in B6:B18 (0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, then 3 to 7). Trying a spread of values — fine steps where the action is, coarse steps beyond — is the Week 1 way to 'optimise' before any solver is taught."
      },
      {
        "title": "Enter the width once, reference it everywhere",
        "explanation": "C6 holds the typed value 2; every row below points back at it with an absolute reference, so changing the site constraint in ONE cell updates the whole table.",
        "code": "C6: 2\nC7: =$C$6   (filled down to C18)"
      },
      {
        "title": "Derive length from the fixed volume",
        "explanation": "Since Volume = L x W x H is pinned at 30 cbm, length must be L = V/(W x H). $C$3 is absolute (same volume every row); B6 and C6 are relative so each row uses its own height.",
        "code": "D6: =$C$3/(B6*C6)   (filled down: D7 becomes =$C$3/(B7*C7))"
      },
      {
        "title": "Compute the two areas",
        "explanation": "Base area is width times length. The open-top tank has four walls — two of W x H and two of L x H — giving 2(W+L)H. Both formulas are fully relative and fill straight down.",
        "code": "E6: =C6*D6\nF6: =2*(C6+D6)*B6"
      },
      {
        "title": "Cost the tank with one SUMPRODUCT",
        "explanation": "Instead of writing =E3*E6+F3*F6, the model pairs the unit-cost vector with the area vector: SUMPRODUCT multiplies element-by-element and sums. The unit costs are anchored absolutely so the formula fills down; the areas stay relative.",
        "code": "G6: =SUMPRODUCT($E$3:$F$3,E6:F6)   (= 10 x BaseArea + 5 x SideArea)"
      },
      {
        "title": "Fill down and read the cost curve",
        "explanation": "Filling row 6 down to row 18 prices all thirteen heights. The workbook's comments record the finding: cost falls steeply across the low heights and then climbs slowly as the tank gets taller, and with a 2 m width and 30 cu.m volume the cheapest tank costs $305, at a height of 3.87 metres. Sanity check at H=3: L=5, base 10 sqm, sides 42 sqm, cost 100+210 = $310."
      },
      {
        "title": "Document the model",
        "explanation": "Rows 20-29 hold the Documentation block: every labelled quantity, its cell, and either '<Input>' or its one representative formula — exactly the convention Assignment 0 grades against.",
        "code": "Tank volume   C3     <Input>\nTank height   B6     <Input>, 0.25, 0.5, ...\nTank width    C6,C7  <Input>, =$C$6\nTank length   D6     =$C$3/(B6*C6)\nBase area     E6     =C6*D6\nSide area     F6     =2*(C6+D6)*B6\nTank cost     G6     =SUMPRODUCT($E$3:$F$3,E6:F6)"
      }
    ]
  },
  {
    "id": "datacenterassets-capacity-plan",
    "week": "W1",
    "title": "DataCenterAssets.xlsx: projecting SAM Bank's IT asset requirements with performance ratios and TREND",
    "overview": "SAM Bank's CEO wants a simple model to project IT capacity for the next five years from ten years of actuals: customer deposits ($3.91b to $23.92b), headcount (743 to 2,320) and seven asset classes. Auto-filling the asset columns directly would be wrong — requirements are driven by business volume through performance ratios. The model computes historical ratios, projects them with anchored TREND formulas, lets management negotiate the targets, and divides projected volume by the planned ratio.",
    "takeaways": [
      "Model the DRIVER, not the symptom: project performance ratios (volume per asset) and derive asset counts, instead of extrapolating asset counts directly.",
      "The three-step pattern — historical ratio =$C9/E9, TREND projection, requirement =$C19/E37 — turns one careful formula per step into a full 7-asset, 5-year capacity plan.",
      "Method 1's seven $ signs (=TREND(E$27:E$36,$C$27:$C$36,$C37)) are the fewest that keep the 10-year history window fixed while the formula fills in both directions.",
      "TREND output is a starting point: real plans copy the projections into input cells and adjust them in a negotiated process into performance targets.",
      "The choice of x-variable (time, volume, or headcount) changes the projection — document the assumption and question whether the capacity measures are even the right ones."
    ],
    "steps": [
      {
        "title": "Understand the brief and the data",
        "explanation": "The Model sheet tabulates 10 years of actuals in rows 9-18 (Customer Deposit $b, Total Employees, and seven asset classes: low/mid/high-end servers in BIPS, data storage in '00GB, network switches in '00MBPS, racks in RU, floor space in '0 sqm) and 5 projected years of deposits and headcount in rows 19-23 (deposits 27.74 up to 45.22 $b). Unit costs and order leadtimes sit in rows 4-5 as inputs."
      },
      {
        "title": "Make the year column self-maintaining",
        "explanation": "The first year is computed from today's date and every later year adds one, so the table never goes stale.",
        "code": "B9:  =YEAR(TODAY())-9\nB10: =B9+1   (filled down to B23)"
      },
      {
        "title": "Reject the naive approach",
        "explanation": "Auto-filling E19:K23 straight from the asset history would extrapolate a least-squares line through quantities that have no direct straight-line relationship with time. The case advice warns that with growth slowing, such rough planning risks buying equipment too early, paying for far more than is needed, or being left with obsolete technology."
      },
      {
        "title": "Step 1 — compute historical performance ratios",
        "explanation": "Performance = Business Volume / # Equipment. One mixed-reference formula covers the whole block: $C locks the deposits column so the formula fills right across all seven asset classes, and the free row number lets it fill down ten years. Year 1 low-end servers: 3.91/20 = 0.1955 $b per BIPS.",
        "code": "E27: =$C9/E9   (fills right to =$C9/F9 ... =$C9/K9, and down to =$C18/E18)"
      },
      {
        "title": "Step 2 — project the ratios with anchored TREND",
        "explanation": "The Trends block (rows 45-49) predicts each ratio at the projected deposit levels. Method 1 anchoring — 'seven $ signs' — locks the rows of known_y (fill down keeps the 10-year history), locks known_x completely (fill right stays on deposits), and column-locks new_x so it advances down the projected years.",
        "code": "E45: =TREND(E$27:E$36,$C$27:$C$36,$C37)\n(time-based alternative:  =TREND(E$27:E$36,$B$27:$B$36,$B37);\n size-based alternative:  =TREND(E$27:E$36,$D$27:$D$36,$D37))"
      },
      {
        "title": "Negotiate the planned performance targets",
        "explanation": "The projected ratios actually used (E37:K41) are typed <Input> values — per the documentation, 'values copied from E45:K49 and then adjusted'. The sheet's own Notes column (cell N24) explains that management then negotiates the TREND values and records the agreed figures as planned performance targets, and the sheet warns that ratios projected this way may not be acceptable. E37 ends up 0.29 rising to 0.50 by the fifth projected year.",
        "code": "E37:K41: <Input>  (e.g. E37: 0.29, E38: 0.31, E39: 0.35, E40: 0.40, E41: 0.50)"
      },
      {
        "title": "Step 3 — derive the future asset requirements",
        "explanation": "New IT Assets # = New Business Volume / New Performance ratio. Again $C anchors the deposit column so one formula serves all seven asset classes and all five years. First projected year, low-end servers: 27.74/0.29 = 95.7 BIPS.",
        "code": "E19: =$C19/E37   (fills right to =$C19/F37 and down to =$C23/E41)"
      },
      {
        "title": "Interrogate the model, not just the numbers",
        "explanation": "The Notes column keeps the analysis honest: 'Are the measures of capacity used correct?' and 'What are the strengths and weaknesses of this data center?' — plus a reminder that other assets (power distribution, cooling) sit outside the model. Productivity may be treated as a function of time, business volume, or organisation size; the choice is a modelling judgement, not an Excel setting."
      }
    ]
  },
  {
    "id": "w2-inkjet-printer",
    "week": "W2",
    "title": "InkJetPrinter.xlsm — Engineering the Bait & Hook Model",
    "overview": "Builds the inkjet pricing model in stages: real market data, blackbox classification, a rough model that Solver breaks, a price-demand function, prototypes with and without fixed cost, the final trade-off model, and a two-way Data Table for sensitivity.",
    "takeaways": [
      "A model without the price-demand relationship gives absurd answers (infinite optimal price) — structure before optimization.",
      "Goal Seek finds breakeven (one cell to one value); Solver finds the optimum (MAX with several variables and constraints).",
      "Trade-off analysis varies decisions (price); sensitivity analysis varies uncontrollable parameters (slope, cartridges per printer).",
      "Breaking calculations into simple intermediate formulas made the missing fixed cost easy to catch by hand verification.",
      "The bait & hook signature: 9.1% printer margin vs 66.7% cartridge margin, guarded by the IF rule that demand dies when cartridges cost over 2/3 of the printer."
    ],
    "steps": [
      {
        "title": "Understand the business problem",
        "explanation": "The Home sheet asks how inkjet printers can be sold so cheaply — is a low production cost the only reason? The lecture turns that into the modelling task: choose printer and cartridge prices that maximize profit under a Bait & Hook strategy — sell the printer cheap (even below cost) and profit on marked-up proprietary cartridges. The Learn sheet lists the modelling steps to follow."
      },
      {
        "title": "Ground the model in real data",
        "explanation": "The Data sheet lists actual market prices: Epson Stylus C43SX $75 (cartridge $29.80), Canon i255 $89 ($23.90), Lexmark Z617 $59 ($65.50), HP Deskjet 3744 $75 ($46). The Lexmark cartridge costs MORE than the printer — ratio 1.11.",
        "code": "C11: =C7+C10    ' printer + cartridge bundle\nC12: =C10/C7    ' cartridge/printer price ratio, copied across; Lexmark's (E12) = 1.11"
      },
      {
        "title": "Classify variables in the Black-Box sheet",
        "explanation": "Decisions: Printer Price, Cartridge Price. Parameters: Printer Unit Cost, Cartridge Unit Cost, Fixed Cost. The workbook's Black-Box sheet lists Profit, Total Revenue, Total Cost, Printer Revenue and Cartridge Revenue under Performance Measures, with Printer Demand and Cartridge Demand as Consequence Variables; the lecture slides simplify this to Profit as the sole performance measure and Total Revenue, Total Cost, Printer Demand and Cartridge Demand as consequence variables. The sheet also defines Historical variables (uncontrollable inputs with fixed values)."
      },
      {
        "title": "Audit the rough model — and watch Solver break it",
        "explanation": "In a rough model where demand ignores price — the Proto sheet, whose printer demand C13 is a typed 6.4 (thousand) — Solver asked to maximize profit (target = Profit C27, MAX, changing printer price C5) answers: optimal printer price = infinity! Higher price is always better when demand never falls. Lesson: the model is wrong, not Solver. The FormulaAudit sheet (titled 'Rough Model', with a button that toggles trace arrows) shows the repaired logic in miniature: printer demand E8 is linked to price and every formula feeds profit in M13.",
        "code": "E8:  =10-0.06*C5          ' printer demand ('000)\nG8:  =6*E8+0*C12          ' cartridge demand\nI5:  =C5*E8               ' printer revenue\nK8:  =I5+I12              ' total revenue\nK20: =C17*E8+C20*G8+C23   ' total cost incl. fixed\nM13: =K8-K20              ' profit"
      },
      {
        "title": "Model the price-demand relationship",
        "explanation": "The Demand sheet tabulates demand at prices $0-$250 from three assumptions: at most 10,000 units even at $0, 600 fewer units per $10 increase, and practically no buyers by $250. The straight-line rule is y = -0.06x + 10 (y in '000), the trendline equation on the slide; on its own that line reaches 0 near $167 (the formula column even shows -2 at $200), whereas the typed column tapers to 2.2, 0.7 and 0 at $150, $200 and $250.",
        "code": "C10: =10-0.6*(B10-$B$9)/10   ' linear model: 10, 9.4, 8.8, ... (observed data tapers to 0.7, then 0)"
      },
      {
        "title": "Prototype the full income statement",
        "explanation": "Proto computes margins, revenue, cost and profit at trial prices $60/$20 with demands 6.4k printers / 42k cartridges — profit 368k. But an embedded question asks: 'Shouldn't there be a fixed cost?' Verification by hand catches the omission.",
        "code": "C15: =(C5-C9)/C9     ' printer margin 9.1%\nC16: =(C6-C10)/C10   ' cartridge margin 66.7%\nC21: =C19+C20        ' total revenue 1,224k\nC24: =C22+C23        ' total cost 856k (no fixed cost!)\nC27: =C25+C26        ' profit 368k — overstated"
      },
      {
        "title": "Refine with fixed cost and the IF guard",
        "explanation": "Proto(2) adds the $70k fixed cost and a behavioral rule: if the cartridge price exceeds 2/3 of the printer price, printer demand collapses to 0. Cartridge demand is now computed as 6 per printer (38.4k instead of Proto's typed 42k), so with the fixed cost profit at $60/$20 falls from 368k to 269.2k (368 − 28.8 lost cartridge profit − 70 fixed cost).",
        "code": "C18: =IF(C6/C5 > C12, 0, C15*C5+C14)   ' guarded demand\nC19: =C18*C13                           ' cartridge demand = 6 per printer\nC29: =C27+C28+C11                       ' total cost + fixed cost\nC32: =C30+C31-C11                       ' profit = 269.2k"
      },
      {
        "title": "Run the trade-off analysis across prices",
        "explanation": "The Model sheet copies the column model across printer prices. Three special columns hold the analysis answers: $26.96 (lower breakeven, profit = 0), $95.98 (Solver's optimum, profit about 1,434.9k) and $165.00 (upper breakeven). Cartridge price rides along at 2/3 of printer price.",
        "code": "C6:  =$C12*C5                        ' cartridge price = ratio x printer price\nC18: =IF(C6>$C12*C5,0,$C14+$C15*C5)  ' guarded demand\nC29: =C27+C28+$C11                   ' total cost\nC32: =C26-C29                        ' profit; row spans $26.96 ... $95.98 ... $165.00"
      },
      {
        "title": "Sensitivity analysis with a two-way Data Table",
        "explanation": "Model(2) fixes prices at $90/$60.30 and varies two uncontrollable parameters: demand slope (-0.12 to -0.01) across the row and cartridges-per-printer (4.6 to 6.8) down the column. The corner cell links to Profit; Excel fills the grid. Base case (slope -0.06, 6 cartridges) gives 1,618.96k.",
        "code": "N4: =IF(M5>G4*M4,0,I4+I5*M4)   ' demand with guard\nO6: =O4+O5-D6                   ' profit\nC9: =O6                         ' Data Table corner cell"
      },
      {
        "title": "Draw the management conclusion",
        "explanation": "The chart of the Data Table shows profit changes are more sensitive to the demand slope when more cartridges are sold per printer, and the model is more robust at lower cartridges-per-printer. Management should validate the demand-slope assumption hardest before committing to the $95.98 price."
      }
    ]
  },
  {
    "id": "w2-invest-in-education",
    "week": "W2",
    "title": "InvestInEducation.xlsx — From Blackbox to a 10-Level Margin Model",
    "overview": "Models a social-enterprise investment: contributors sponsor students at 10 education levels and receive a share of future salaries, discounted by default risk. The walkthrough builds the per-level and total margin calculations and reads off the key findings.",
    "takeaways": [
      "Expected value handles risk simply: multiply the return by (1 - default probability).",
      "Dollar margin and margin % rank levels differently — Upper primary wins on dollars, Technical degree on percentage — so pick the performance measure before optimizing.",
      "Row-anchored mixed references (C$16, C$21) pin the student-count and default-probability rows, while the free column letter lets one formula copy across all 10 levels.",
      "Keeping decision, parameter and output rows separate makes the model instantly ready for what-if analysis on student counts."
    ],
    "steps": [
      {
        "title": "Frame the case",
        "explanation": "Contributors expect returns — this is an investment, not a donation. The return is a percentage of the sponsored person's salary, but sponsored students may default. The model must find each level's expected margin, the best levels, and the overall margin."
      },
      {
        "title": "Classify with the blackbox",
        "explanation": "Decision: Number of Students per Level. Parameters: Education Levels, Investment per Student, Expected Return per Student, Default Probability per level. Performance measures: Total Expected Margin and Expected Margin per level. Consequence variables: Total Investment, Total Expected Return, and the per-level investment and return."
      },
      {
        "title": "Lay out the parameters",
        "explanation": "Rows 18-21 hold the 10 levels (Lower primary through Technical degree) with Investment per student rising $500 to $4,100, Expected return per student $600 to $5,100, and default probability falling from 5% (Lower primary) through 4%, 3% and 2% to 1% for every level from Junior college onward."
      },
      {
        "title": "Enter the decision row",
        "explanation": "Row 16 holds the student counts — 50, 50, 20, 20, 15, 10, 8, 6, 5, 3 across the levels. This is the only row a decision maker changes in what-if analysis."
      },
      {
        "title": "Compute investment per level",
        "explanation": "Each level's investment is simply students times investment per student. Lower primary: 50 x 500 = $25,000.",
        "code": "C10: =C$16*C19   ' copied across C10:L10"
      },
      {
        "title": "Compute expected return per level",
        "explanation": "The return is discounted by the default probability: only the (1 - p) fraction of students pays back. Lower primary: 0.95 x 50 x 600 = $28,500.",
        "code": "C11: =(1-C$21)*C$16*C20"
      },
      {
        "title": "Compute expected margin and margin %",
        "explanation": "Margin is return minus investment; margin % divides by the investment. Lower primary: 28,500 - 25,000 = $3,500, i.e. 14.0%.",
        "code": "C12: =C11-C10\nC13: =C12/C10"
      },
      {
        "title": "Total everything in row 4",
        "explanation": "SUM rolls up students, investment and return; the total margin and overall margin % come from the totals.",
        "code": "H4: =SUM(C16:L16)   ' 187 students\nI4: =SUM(C10:L10)   ' 260,300 total investment\nJ4: =SUM(C11:L11)   ' 313,583 total E[return]\nK4: =J4-I4          ' 53,283 total E[margin]\nL4: =K4/I4          ' 20.47% overall margin"
      },
      {
        "title": "Add proportion rows for insight",
        "explanation": "Rows 6-8 express each level's students, investment and return as a share of the totals, showing where the money concentrates.",
        "code": "C6: =C16/$H4\nC7: =C10/$I4\nC8: =C11/$J4"
      },
      {
        "title": "Read off the findings",
        "explanation": "Highest expected margin in dollars: Upper primary at $7,800. Highest expected margin percentage: Technical degree at 23.15% (margin % climbs steadily from 14.0% at Lower primary). Overall expected margin: $53,283 on $260,300 invested = 20.47%."
      }
    ]
  },
  {
    "id": "w3wt1",
    "week": "W3",
    "title": "DataLookUp.xlsx: Country GDP lookups with INDEX and MATCH",
    "overview": "The 'Match & Index' sheet holds 225 countries in A1:D226 (Rank, Country, GDP per capita, Population) and builds up from a plain INDEX, to MATCH, to INDEX+MATCH, to a two-MATCH 2-D lookup, and finally to a spill formula.",
    "takeaways": [
      "INDEX returns the value at a position; MATCH returns the position of a value; together they replace VLOOKUP and can look in any direction.",
      "Use match_type 0 for exact matches on unsorted data; the default match_type 1 silently does an approximate match and needs ascending data.",
      "Two MATCH calls inside one INDEX give a full two-dimensional lookup driven entirely by cell inputs.",
      "column_num 0 turns INDEX into a spill formula returning a whole row; the @ operator collapses a spill back to one value."
    ],
    "steps": [
      {
        "title": "Understand the data layout",
        "explanation": "Columns A:D hold Rank, Country, GDP per capita, and Population for 225 countries (rows 2-226). Liechtenstein is rank 1 with GDP per capita 141100; Singapore is rank 6 with GDP per capita 60500 and population 5353494; Brunei is rank 10 with GDP per capita 50000."
      },
      {
        "title": "Retrieve by position with INDEX",
        "explanation": "With the position 1 typed in G4, INDEX returns the country name at that row of the array — Liechtenstein. INDEX answers 'what is at this position?'",
        "code": "H4: =INDEX(B2:B226,G4)"
      },
      {
        "title": "Find a position with MATCH",
        "explanation": "MATCH does the opposite of INDEX: given 'Brunei' in G12 it returns the position 10; given 'Singapore' in G16 it returns 6. Match_type 0 forces an exact match so the country list does not need to be sorted.",
        "code": "H12: =MATCH(G12,B2:B226,0)\nH16: =MATCH(G16,B2:B226,0)"
      },
      {
        "title": "Combine them: INDEX + MATCH",
        "explanation": "Nesting MATCH inside INDEX turns 'find Singapore's row' plus 'return column C at that row' into one formula, returning GDP per capita 60500. The same pattern on column D returns the population 5353494.",
        "code": "H20: =INDEX(C2:C226,MATCH(G20,B2:B226,0))\nI20: =INDEX(D2:D226,MATCH(G20,B2:B226,0))"
      },
      {
        "title": "Anchor references so the formula copies safely",
        "explanation": "The exercise version uses absolute and mixed references ($G$24 for the country, $B$2:$B$226 for the lookup list, C$2:C$226 for the data) so that dragging H24 right into I24 shifts only the return column from C to D (GDP to Population) while the country cell and the lookup list stay fixed.",
        "code": "H24: =INDEX(C$2:C$226, MATCH($G$24,$B$2:$B$226,0))"
      },
      {
        "title": "Do a 2-D lookup with two MATCH calls",
        "explanation": "One MATCH computes the row (which country), a second MATCH computes the column (GDP or Population, picked from the headers in H23:I23). INDEX then pulls the value at that row/column intersection of C2:D226.",
        "code": "H25: =INDEX($C$2:$D$226,MATCH($G$24,$B$2:$B$226,0),MATCH(H23,$H$23:$I$23,0))"
      },
      {
        "title": "Return the whole row with a spill formula",
        "explanation": "Setting column_num to 0 makes INDEX return the entire matching row (GDP and Population together), which spills into the adjacent cell — the sheet labels this 'One MATCH within INDEX - Spill Formula - start by selecting first cell'. Add @ in front to undo the spill and get a single value.",
        "code": "H26: =INDEX(C2:D226,MATCH(G24,B2:B226,0),0)"
      }
    ]
  },
  {
    "id": "w3wt2",
    "week": "W3",
    "title": "CasinoHotel.xlsx: LP guest-mix optimization with Solver",
    "overview": "The Model sheet finds the guest mix across four guest types (Slot Machine Player, Game of Chance Player, Show-time Guest, High Roller) that maximizes daily net income, subject to per-type demand limits, total occupancy and fire-safety limits, and a floor space budget.",
    "takeaways": [
      "Structure LP models in layers: decision variables, parameters, consequence variables, then a single objective cell — mirroring the influence diagram.",
      "Express constraints as spreadsheet cells (LHS formula, comparison, RHS cell) so the Solver dialog just points at them, e.g. H17 <= J17.",
      "SUM with negative terms, e.g. =SUM(H14, -H20), keeps additive models auditable compared to long a-b-c expressions.",
      "Binding constraints reveal the economics: the optimal mix uses all 40,000 units of net floor space and hits the 2000-guest fire-safety ceiling, telling management which limits cost them money.",
      "A Documentation block on the sheet recording every input, formula, and the Solver setup makes the model reusable and gradeable."
    ],
    "steps": [
      {
        "title": "Frame the problem",
        "explanation": "The hotel owner wants the guest mix that maximizes net income so the architect can finalize the building design. Each guest type has different revenue, cost, and floor space profiles, so the mix matters."
      },
      {
        "title": "Lay out the decision variables",
        "explanation": "C4:F4 hold the number of guests of each type — these are the cells Solver will change. Row 5 holds each type's minimum demand (500, 350, 250, 50) and row 6 the maximum (1000, 900, 750, 80); H4 totals the guests.",
        "code": "H4: =SUM(C4:F4)"
      },
      {
        "title": "Enter the per-guest parameters",
        "explanation": "Rows 8-11 hold the constants per guest per day: floor space (12, 28, 8, 95), base revenue (150, 250, 110, 4500), food revenue (30, 95, 120, 0), and direct expense (1, 35, 15, 400). High rollers earn the most but need by far the most space."
      },
      {
        "title": "Compute the consequence variables",
        "explanation": "Rows 17-20 multiply guests by the per-guest rates, using a mixed reference so one formula copies across all four guest types, and column H totals each row.",
        "code": "C17: =C$4*C8   (floor space)\nC18: =C$4*C9   (base revenue/day)\nC19: =C$4*C10  (food revenue/day)\nC20: =C$4*C11  (direct expense/day)\nH17: =SUM(C17:F17)"
      },
      {
        "title": "Build the objective: net income",
        "explanation": "Total revenue H14 adds base and food revenue; net income J14 subtracts total direct expense. J14 is labeled '(to maximize)' — it is the objective cell.",
        "code": "H14: =SUM(H18:H19)\nJ14: =SUM(H14, -H20)"
      },
      {
        "title": "Build the floor space constraint",
        "explanation": "Net space available J17 is gross space minus stage and dining space: 50000 - 5000 - 5000 = 40000. The constraint is H17 <= J17: total space used by guests cannot exceed the net space.",
        "code": "J17: =SUM(J9,-J10,-J11)"
      },
      {
        "title": "Configure Solver",
        "explanation": "Per the sheet's own Documentation block: 'Use Solver to maximize J14 by changing C4:F4 subject to' C4:F4 <= C6:F6 (max demand), C4:F4 >= C5:F5 (min demand), H17 <= J17 (floor space), H4 >= J4 (occupancy of at least 1000), and H4 <= K4 (fire safety cap of 2000). Add C4:F4 = integer since fractional guests are meaningless — the integer constraint goes on decision variables only."
      },
      {
        "title": "Run Solver and interpret the answer",
        "explanation": "Solver's optimal integer mix is 500 slot machine players, 752 game of chance players, 668 show-time guests, and 80 high rollers (2000 guests total, right at the fire-safety cap). The Proto sheet shows the same model with real-valued guests (752.0000000000001, 667.9999999999998) before integer constraints are imposed on the Model sheet."
      }
    ]
  },
  {
    "id": "timevalue-seven-functions",
    "week": "W4",
    "title": "TimeValue.xlsm: All Seven Financial Functions, With and Without Excel",
    "overview": "One workbook, one sheet per function (PMT, PV, FV, RATE, NPER, NPV, IRR). Every sheet solves the same situation twice — once with the Excel financial function and once with a manual period-by-period schedule (searched with Goal Seek on the PMT, PV, RATE and IRR sheets; computed straight forward on FV, NPER and NPV) — proving the function and the first-principles model agree.",
    "takeaways": [
      "Every Group 1 function (PMT, PV, FV, RATE, NPER) is the same five-quantity equation solved for a different unknown — the workbook proves each against a first-principles schedule.",
      "Keep rate, nper and pmt in the same period terms: divide annual rates by 12 for monthly problems.",
      "Goal Seek reproduces any financial function by trial-and-error on the manual schedule — useful for validation and for problems the functions cannot express.",
      "NPV() excludes today's investment (add it to the result); IRR() includes it in the value range.",
      "Excel never checks whether your signs make sense — NPER(12%,-100,-1000) ≈ -6.96 years is returned without complaint."
    ],
    "steps": [
      {
        "title": "Scratch: get rate and nper in the same terms",
        "explanation": "The Scratch sheet contrasts the correct monthly-terms call against a wrong mixed-terms call for a $10,000 loan (C12) at 8% p.a. (C13) over 10 months (C14). Only the first is valid: rate, nper and pmt must all be monthly.",
        "code": "Scratch!C15: =PMT(C13/12,C14,C12)   ← correct (monthly rate, months)\nScratch!C16: =PMT(C13,C14/12,C12)   ← wrong (annual rate, fractional years)"
      },
      {
        "title": "PMT: price the car loan with a balloon",
        "explanation": "Situation: borrow $140,000 for 5 years at 5% p.a. monthly rest, 60 monthly payments plus a $10,000 balloon with the last payment. Inputs sit in B12 (0.05), C12 (60), D12 (140000), E12 (-10000); the payment ≈ -$2,494.93.",
        "code": "PMT!F12: =PMT(B12/12,C12,D12,E12)"
      },
      {
        "title": "PMT without the function: residue-loan schedule + Goal Seek",
        "explanation": "Columns L14:N74 replay the loan month by month: the residue grows one month of interest then drops by the payment. Goal Seek (or trial and error) changes the payment in M15 until the last residue N74 hits the $10,000 target in M10.",
        "code": "PMT!N14: 140000\nPMT!M15: 2494.927... (changed by Goal Seek)\nPMT!N15: =N14*(1+L$10/12)-M15\nPMT!N10: =N74   ← compare against Target Last M10 = 10000"
      },
      {
        "title": "PV: fund nine months overseas, beginning-of-month",
        "explanation": "Situation: $3,500 needed at the beginning of each of 9 months plus $600 extra in the last month, at 3% p.a. The type argument 1 marks beginning-of-period withdrawals; the answer is ≈ $31,774.27, matching the manual balance N14.",
        "code": "PV!D12: =PV(B12/12,C12,F12,E12,1)   with B12=0.03, C12=9, F12=-3500, E12=-600\nPV!N15: =(N14-M15)*(1+L$10/12)   ← withdraw first, then earn interest"
      },
      {
        "title": "FV: lump sum plus yearly injections",
        "explanation": "Situation: $50,000 invested now plus $8,000 added each year for 10 years at 6.5% p.a. The schedule confirms it: each year the investment grows a full year then receives the injection.",
        "code": "FV!E12: =FV(B12,C12,F12,D12)   with B12=0.065, C12=10, F12=-8000, D12=-50000\nFV!N15: =N14*(1+L$10)+ M15"
      },
      {
        "title": "RATE: what return gets me to $250,000?",
        "explanation": "Same investment plan, but now the target fv is $250,000 and the unknown is the rate. RATE iterates from the default 10% guess; the sheet's Goal Seek check converges to the same 0.0959269 (≈9.59% p.a.).",
        "code": "RATE!B12: =RATE(C12,F12,D12,E12)   with C12=10, F12=-8000, D12=-50000, E12=250000"
      },
      {
        "title": "NPER: how many years — and a MATCH() sanity check",
        "explanation": "At 8% p.a., NPER solves for the duration to reach $250,000 (≈ 11.01 years). The no-function version tabulates years 0-20 in N14:N34 and uses MATCH with match-type 1, which returns 12: because the list starts at year 0, position 12 is year 11 (about $249,746, the last balance still ≤ the target), so the target is crossed during year 12 — bracketing the fractional NPER answer.",
        "code": "NPER!C12: =NPER(B12,F12,D12,E12)\nNPER!N10: =MATCH(M10,N14:N34,1)   ← match-type 1: largest value ≤ 250000"
      },
      {
        "title": "NPV: exclude today's investment from the arguments",
        "explanation": "The project costs $200,000 today (B14/C14 row, year 0) and returns ten uneven year-end cash flows (C15:C24: 56990, 54637, 56529, ...). Because NPV() treats value1 as END of period 1, the year-0 outflow stays outside and is added back.",
        "code": "NPV!C10: =NPV(B10,C15:C24)+C14   with B10=0.08, C14=-200000\nNPV!N14: =M14/(1+L$10)^L14   ← manual PV per year; SUM(N14:N24) matches"
      },
      {
        "title": "IRR: the rate where NPV is zero",
        "explanation": "IRR takes the WHOLE range including the -$200,000 year-0 value and returns ≈24.05%. The manual check plugs that rate into the same PV-per-year column and Goal Seek confirms SUM(N14:N24) = 0 at L10 = 0.2404619547.",
        "code": "IRR!C10: =IRR(C14:C24)\nIRR!N10: =SUM(N14:N24)   ← equals 0 at the IRR"
      },
      {
        "title": "Model: manual grid vs a real Data Table",
        "explanation": "The Model sheet computes compound growth F5 for $100 at 3% over 4 years, then sweeps rates 5%–12% across the top and years 1–20 down the side. The example builds the grid manually with mixed references; the exercise rebuilds it as a genuine Excel Data Table (cells hold {=TABLE(...)} entries).",
        "code": "Model!F5: =IF(COUNT(C5:E5)<3,\"\",C5*(1+D5)^E5)\nModel!D9: =$C$5*(1+D$8)^$C9   ← manual two-way grid\nModel!O8: =O5*(1+P5)^Q5       ← formula cell for the real Data Table at P9:W28"
      }
    ]
  },
  {
    "id": "charity-donation-circular",
    "week": "W4",
    "title": "CharityDonation.xlsx: Resolving a Circular Reference by Iteration",
    "overview": "Sam's firm expects $180,000 revenue and $108,500 costs. He donates 10% of after-tax profit to charity, but the donation is deductible before the 25% tax — charity depends on profit, which depends on charity. The workbook shows the naive circular prototype, the robust iterative model, and an explicit 25-step iteration table with a converging spider-web chart.",
    "takeaways": [
      "Circular references are legitimate modeling tools when the business logic is genuinely self-referential — resolve them with Enable iterative calculation, not by breaking the logic.",
      "Tighten Maximum change (0.0001) so the converged answer is accurate enough for money amounts.",
      "Guard circular formulas with MAX(0,...) so edge cases (no profit) do not corrupt the iteration.",
      "An explicit iteration table plus a spider-web chart turns invisible iteration into a teachable, checkable picture.",
      "Always verify convergence: this loop contracts by a factor of 0.075 per pass, so it converges quickly to Charity ≈ $4,988 (exactly 7.5% of pre-tax profit)."
    ],
    "steps": [
      {
        "title": "Proto: write the model naturally and hit the circle",
        "explanation": "The prototype writes each business rule directly: tax is 25% of profit before tax, charity is 10% of profit after tax, and profit before tax deducts the charity. D8 → D14 → D11 → D15 → D8 forms a circular reference and Excel warns it cannot calculate.",
        "code": "Proto!D5: 180000 (Revenue)   Proto!D6: 108500 (Cost)\nProto!D8:  =C8*D14    (Tax, C8=0.25)\nProto!D11: =C11*D15   (Charity, C11=0.1)\nProto!D14: =D5-D6-D11 (Profit before tax)\nProto!D15: =D14-D8    (Profit after tax)"
      },
      {
        "title": "Enable iterative calculation",
        "explanation": "The Model sheet's notes say: go to Excel Options / Formulas / Calculation options, tick 'Enable iterative calculation', and reduce the Maximum change parameter to 0.0001. Excel then cycles the circular chain until values stabilize instead of raising the warning.",
        "code": "File > Options > Formulas > Enable iterative calculation  (Maximum change: 0.0001)"
      },
      {
        "title": "Model: add MAX(0,...) guards for the no-profit case",
        "explanation": "The final model hardens the prototype: tax and charity can never go negative even if the firm makes a loss, answering the Home sheet's question 'What happens if the company doesn't make any profit?'. Profit after tax is rewritten as (1−tax rate)×profit before tax.",
        "code": "Model!D9:  =MAX(0,C8*D14)    (Tax)\nModel!D12: =MAX(0,C11*D15)   (Charity)\nModel!D14: =D5-D6-D12        (Profit before tax)\nModel!D15: =(1-C8)*D14       (Profit after tax)"
      },
      {
        "title": "Read off the converged answer",
        "explanation": "With iteration on, the model settles at Charity ≈ $4,988.37: algebraically C = 0.1×0.75×(71,500 − C), so 1.075C = 5,362.50. Cell D18 answers the Home sheet's other question — charity is exactly 7.5% (= 10% × 75%) of profit BEFORE tax, not 10%.",
        "code": "Model!D18: =D12/D14   ← Charity / Profit before tax = 7.5%"
      },
      {
        "title": "Model(2): show the iterations explicitly",
        "explanation": "Instead of hidden iteration, rows numbered #0 to #25 replay it: row #0 starts with zero donation, and each subsequent row takes 10% of the PREVIOUS row's after-tax profit. The donation column marches from 0 toward $4,988, making convergence visible.",
        "code": "Model(2)!E8: 0\nModel(2)!F8: =MAX(0,C$8-D$8-E8)   G8: =MAX(0,G$5*F8)   H8: =F8-G8\nModel(2)!E9: =MAX(0,D$5*H8)       ← next donation from previous profit\nModel(2)!E5: =E33                 ← final converged donation"
      },
      {
        "title": "Extra: the converging spider-web chart",
        "explanation": "A Step column alternates between updating Donation and Profit-after-tax so an XY chart of the pairs staircases into the fixed point — the classic cobweb picture of a converging iteration.",
        "code": "Model(2)!T9: =IF(ISODD($S9),T8,INDEX($E$8:$E$33,INT($S9/2)+1))\nModel(2)!U9: =IF(ISEVEN($S9),U8,INDEX($H$8:$H$33,INT($S9/2)+1))"
      },
      {
        "title": "Judge convergence vs divergence",
        "explanation": "This model converges because each pass multiplies the correction by 0.075 (donation rate × after-tax fraction), shrinking it toward zero. A circular model whose feedback factor exceeds 1 would diverge — iteration only helps when the loop is a contraction.",
        "code": "Fixed point: C = 0.1*(1-0.25)*(180000-108500-C)  →  C = $4,988.37"
      }
    ]
  },
  {
    "id": "w5-montyhall",
    "week": "W5",
    "title": "MontyHall.xlsx: simulating stay vs change vs random-door strategies",
    "overview": "The Model sheet runs 1000 trials of the Monty Hall game. Each trial randomly generates the prize door and the selected door, uses the Reveal Door Options Matrix to decide which door the host opens, computes the final door under three strategies (stay, change, random second contestant), scores each as win (1) or lose (0), and averages the scores to estimate the win probabilities (1/3, 2/3 and 1/2).",
    "takeaways": [
      "Encode conditional game logic in an options matrix and read it with INDEX(array, row, column) — randomness only belongs in cells where a genuine choice exists.",
      "The change-door shortcut 6-(selected+revealed) works because the door numbers 1+2+3 sum to 6.",
      "Score outcomes as 1/0 with (comparison)*1 so a plain average estimates a probability.",
      "Simulation confirms the analytical result: switching doubles the win probability from 1/3 to 2/3, while a no-knowledge newcomer only achieves 1/2."
    ],
    "steps": [
      {
        "title": "Set up the Reveal Door Options Matrix (G4:I6)",
        "explanation": "Rows F4:F6 are the prize door (1-3), columns G3:I3 the selected door (1-3). Off-diagonal cells are fixed (only one door can be revealed), e.g. H4=3, I4=2, G5=3, I5=1, G6=2, H6=1. Diagonal cells are random because when prize = selected the host can open either remaining door.",
        "code": "G4: =RANDBETWEEN(2,3)\nH5: =IF(RAND()<0.5,1,3)\nI6: =RANDBETWEEN(1,2)"
      },
      {
        "title": "Step 1a — randomly generate the prize door and selected door",
        "explanation": "Each trial row (10 to 1009) draws both doors independently with a discrete uniform over 1-3.",
        "code": "C10: =RANDBETWEEN(1,3)   (Prize Door)\nD10: =RANDBETWEEN(1,3)   (Selected Door)"
      },
      {
        "title": "Step 1b — determine the revealed door with INDEX",
        "explanation": "INDEX reads the matrix at row = prize door, column = selected door, returning the door the host opens. The matrix range is absolute so the formula fills down 1000 rows.",
        "code": "E10: =INDEX($G$4:$I$6,C10,D10)   (Revealed Door)"
      },
      {
        "title": "Step 2a — final door if the contestant stays",
        "explanation": "Staying means keeping the originally selected door, so the 'Same Door' column just copies the selection.",
        "code": "G10: =D10   (Same Door)"
      },
      {
        "title": "Step 2b — final door if the contestant changes",
        "explanation": "Since the three door numbers sum to 6, the remaining closed door is 6 minus the selected and revealed doors. This replaces the Change Door Options Matrix with one arithmetic shortcut.",
        "code": "H10: =6-D10-E10   (Change Door)"
      },
      {
        "title": "Step 2c — add a second contestant with no prior knowledge",
        "explanation": "A newcomer facing the 2 remaining closed doors picks either with probability 0.5. This distinguishes winning WITH prior knowledge (change strategy) from winning WITHOUT it.",
        "code": "I10: =IF(RAND()<0.5,D10,H10)   (Random Door)"
      },
      {
        "title": "Step 3 — score each strategy as win (1) or lose (0)",
        "explanation": "Comparing the final door to the prize door gives TRUE/FALSE; multiplying by 1 coerces it to 1/0 so probabilities can be computed by averaging.",
        "code": "K10: =(G10=$C10)*1   (Same Door win)\nL10: =(H10=$C10)*1   (Change Door win)\nM10: =(I10=$C10)*1   (Random Door win)"
      },
      {
        "title": "Aggregate 1000 trials into win probabilities",
        "explanation": "The relative frequency of winning is the sum of the 1/0 indicators divided by the trial count — an average. Expect approximately 1/3 (stay), 2/3 (change) and 1/2 (random). B6 counts the trials.",
        "code": "K6: =SUM(K10:K1009)/COUNT(K10:K1009)\nL6: =SUM(L10:L1009)/COUNT(L10:L1009)\nM6: =SUM(M10:M1009)/COUNT(M10:M1009)\nB6: =COUNT(B10:B1009)"
      },
      {
        "title": "Collect replications with a Data Table (columns Z:AC)",
        "explanation": "A one-way Data Table re-runs the whole 1000-trial simulation per replication row, capturing the three probabilities each time so their variability can be studied.",
        "code": "AA10: =K6\nAB10: =L6\nAC10: =M6\nAA6: =SUM(AA10:AA25)/COUNT(AA10:AA1009)"
      }
    ]
  },
  {
    "id": "w5-datasim",
    "week": "W5",
    "title": "DataSim.xlsx: generating random variates from every Week 5 method",
    "overview": "DataSim teaches random number generation from the ground up: the Learn sheet covers RAND()/RANDBETWEEN basics and pitfalls, the Explain sheet proves that PERCENTILE and PERCENTRANK are consistent inverses (justifying M2b resampling), and the Continuous and Discrete sheets provide one working formula per distribution — empirical, uniform, normal, exponential, binomial, Poisson and more.",
    "takeaways": [
      "Every simulation method reduces to the same move: draw RAND() as a cumulative probability and invert a CDF — empirical (PERCENTILE/LOOKUP) or theoretical (NORMINV, CRITBINOM, -mean*LN(1-RAND())).",
      "Always freeze a RAND() draw in its own cell before testing it in an IF — each call is a new number.",
      "Use SMALL+RANDBETWEEN for discrete resampling (returns only observed values) and PERCENTILE+RAND for continuous resampling (interpolates new values).",
      "Remember the CRF down-shift: LOOKUP matches the largest CRF <= RAND(), so the value column starts one row below the CRF column."
    ],
    "steps": [
      {
        "title": "Learn — RAND() and a fair coin flip",
        "explanation": "RAND() draws a continuous uniform number in [0, 1.0). Comparing it to 0.5 splits the probability evenly. Press F9 to redraw all random numbers and re-run the simulation.",
        "code": "=RAND()\n=IF(RAND()<0.5,\"Head\", \"Tail\")"
      },
      {
        "title": "Learn — continuous uniform between any min and max",
        "explanation": "Scale RAND() into the interval [min, max): with H12 = 0.1 (min) and I12 = 0.85 (max), the draw is min + RAND()*(max−min).",
        "code": "=H12+RAND()*(I12-H12)"
      },
      {
        "title": "Learn — the repeated-RAND pitfall",
        "explanation": "Each RAND() call is a fresh draw, so testing one RAND() and returning another breaks the logic. Store the draw in its own cell and reference it in the IF.",
        "code": "WRONG: =IF(RAND()<0.5, RAND(), \"Wow\")\nCORRECT: J15: =RAND()   K15: =IF(J15<0.5,J15,\"Wow\")"
      },
      {
        "title": "Learn — discrete uniform (die toss) two ways",
        "explanation": "RANDBETWEEN(bottom, top) returns an integer inclusive of both bounds but historically needed the Analysis Toolpak; INT(RAND()*(top-bottom+1))+bottom is the RAND()-only equivalent. With H24=1 and I24=6 both simulate a fair die.",
        "code": "=RANDBETWEEN(H24,I24)\n=INT(RAND()*(I24-H24+1))+H24\n=INT(RAND()*6)+1"
      },
      {
        "title": "Explain — sort the sample and assign percentiles",
        "explanation": "For a 25-point sample in C6:C30, SMALL with index B6 (1..25) produces the sorted values and (B6−1)/24 assigns each sorted point its percentile position (k−1)/(N−1), from 0 to 1.",
        "code": "E6: =SMALL($C$6:$C$30,B6)   (Xsorted)\nF6: =(B6-1)/24   (Y percentile)"
      },
      {
        "title": "Explain — consistency check: PERCENTILE and PERCENTRANK are inverses",
        "explanation": "Feeding the percentile back through PERCENTILE recovers the sorted X, and feeding the sorted X through PERCENTRANK recovers the percentile — proving the empirical CDF is invertible, which is what M2b resampling relies on.",
        "code": "G6: =PERCENTILE($C$6:$C$30,F6)   (check X)\nH6: =PERCENTRANK($C$6:$C$30,E6)   (check Y)"
      },
      {
        "title": "Explain — resample by inverting the empirical CDF at RAND()",
        "explanation": "Put RAND() in its own cell (J6) and invert: PERCENTILE(data, RAND()) generates new representative continuous data, interpolating between original observations.",
        "code": "J6: =RAND()\nI6: =PERCENTILE($C$6:$C$30,J6)   (resampled X)"
      },
      {
        "title": "Continuous sheet — one formula per continuous distribution",
        "explanation": "Row 12 holds the generator for each column, filled down to row 41 beside the 30 sample points (the C$12:C$997 ranges leave room for up to 986 data rows). Parameters live in rows 4-7 (G$4 = mean, G$5 = SD, F$6/F$7 = min/max, H$4 = exponential mean).",
        "code": "Empirical:   =PERCENTILE(C$12:C$997,RAND())\nUniform:     =F$6+RAND()*(F$7-F$6)\nNormal:      =NORMINV(RAND(),G$4,G$5)\nExponential: =-H$4*LN(1-RAND())"
      },
      {
        "title": "Continuous sheet — EXTRA distributions",
        "explanation": "The same inversion idea extends to the extra distributions: Lognormal exponentiates a normal variate of LN(X), Gamma/Erlang invert GAMMAINV, Weibull inverts its closed-form CDF, Beta uses BETAINV with bounds A and B.",
        "code": "LogNormal: =EXP(NORMINV(RAND(), LN(K$4), LN(K$5)))\nGamma:     =GAMMAINV(RAND(), M$4, M$5)\nWeibull:   =N$5*(-LN(1-RAND()))^(1/N$4)\nBeta:      =BETAINV(RAND(),O$4,O$5,O$6,O$7)"
      },
      {
        "title": "Discrete sheet — empirical resampling three ways",
        "explanation": "M2a picks a random position among the N=$C$8 sample points; a rounded PERCENTILE resample also works for discrete data; M1 looks RAND() up in the down-shifted CRF table (CRF in M$12:M$32, values one row lower in L$13:L$33).",
        "code": "E12: =SMALL($C$12:$C$997,RANDBETWEEN(1,$C$8))\nF12: =ROUND(PERCENTILE($C$12:$C$997,RAND()),0)\nG12: =LOOKUP(RAND(),M$12:M$32,L$13:L$33)"
      },
      {
        "title": "Discrete sheet — uniform, binomial and Poisson variates",
        "explanation": "RANDBETWEEN inverts the discrete uniform directly. CRITBINOM (modern BINOM.INV) inverts the Binomial CDF at RAND(). Poisson has no direct inverse, so use Binomial with n=1000 and p=λ/1000 since Poisson is the large-n small-p limit with λ=np.",
        "code": "H12: =RANDBETWEEN(H$6,H$7)\nI12: =CRITBINOM(I$4,I$5,RAND())\nJ12: =CRITBINOM(1000,J$4/1000,RAND())"
      }
    ]
  },
  {
    "id": "w6-callcenter-single-server",
    "week": "W6",
    "title": "CallCenter-modified.xlsx: date-time basics and the single-server queue (Scratch, Data, 1-Server)",
    "overview": "The workbook asks how business growth affects the demand for call-center capacity. The Scratch sheet practises the date and time functions. The Data sheet stores 150 observed inter-arrival times and 150 service times and shows two ways to generate new ones. The 1-Server sheet simulates 50 customers through one server, one row per customer, with clock-time columns (arrival, start, end) and duration columns (inter-arrival, service, wait, system time), and summarises performance in row 8.",
    "takeaways": [
      "Model one customer per row, and treat every time column as either a clock time (arrival, start, end) or a duration (inter-arrival, service, wait, system time). Format it accordingly (h:mm vs mm:ss).",
      "A dummy customer-0 row (opening time as the previous end) lets a single formula fill down for every customer.",
      "Single-server start = MAX(arrival, previous end); everything else is addition or subtraction of times.",
      "COUNTIF over an expanding range with a \">\"& criterion counts who is still in the system at each arrival.",
      "Traffic intensity (service ÷ inter-arrival) predicts congestion before you simulate; utilisation and average wait measure it afterwards."
    ],
    "steps": [
      {
        "title": "Scratch: split today's date and rebuild it",
        "explanation": "TODAY() reads the system clock. YEAR, MONTH and DAY take the date apart and DATE puts it back together. B5 is left in General format, so it shows the serial number (46292 for 27 Sep 2026 in the saved file), while B1 shows the same kind of number formatted as a date (mm-dd-yy).",
        "code": "B1: =TODAY()\nB2: =YEAR(B1)\nB3: =MONTH(B1)\nB4: =DAY(B1)\nB5: =DATE(B2,B3,B4)"
      },
      {
        "title": "Scratch: split the current time and rebuild it",
        "explanation": "NOW() carries both date and time (formatted d/m/yyyy h:mm:ss). HOUR, MINUTE and SECOND extract the clock parts, and TIME rebuilds only the fraction of the day: 18:05:11 became 0.7536.",
        "code": "D1: =NOW()\nD2: =HOUR(D1)\nD3: =MINUTE(D1)\nD4: =SECOND(D1)\nD5: =TIME(D2,D3,D4)"
      },
      {
        "title": "Data: two ways to generate random durations",
        "explanation": "B13:K27 holds 150 recorded inter-arrival times and B30:K44 holds 150 service times, all formatted mm:ss. PERCENTILE(array, RAND()) re-samples the observed distribution. -Average*LN(RAND()) assumes an exponential distribution with that average. Press F9 to draw new values.",
        "code": "H6: =AVERAGE(B13:K27)   (about 4:48 between arrivals)\nI6: =AVERAGE(B30:K44)   (about 11:00 per service)\nB9: =PERCENTILE($B$13:$K$27,RAND())\nC9: =PERCENTILE($B$30:$K$44,RAND())\nH9: =-H6*LN(RAND())\nI9: =-I6*LN(RAND())"
      },
      {
        "title": "1-Server: inputs and the customer-0 row",
        "explanation": "C4 and D4 are the average inter-arrival and service times, validated as times > 0. Row 14 is a dummy customer 0: the opening time in G14 acts as the previous customer's service end, and E14 copies it as the previous arrival. Row 15's formulas therefore always have a row above them to refer to.",
        "code": "C4: 5:00   (average inter-arrival, m:ss)\nD4: 4:00   (average service, m:ss)\nG14: 9:00   (opening time = customer 0 service end)\nE14: =G14"
      },
      {
        "title": "Simulate durations and build the arrival clock",
        "explanation": "$C$4 and $D$4 are absolute so row 15 can be filled down to row 64 (50 customers). An arrival is a clock time plus a duration: the previous arrival plus this customer's inter-arrival time.",
        "code": "C15: =-$C$4*LN(RAND())\nD15: =-$D$4*LN(RAND())\nE15: =E14+C15"
      },
      {
        "title": "Service start, end, wait and system time",
        "explanation": "With one server, service starts at the later of the arrival and the previous customer's end. End = start + service time. Wait and system time are clock time minus clock time, which gives durations (formatted mm:ss, while E:G are h:mm).",
        "code": "F15: =MAX(E15,G14)   (service start)\nG15: =F15+D15   (service end)\nH15: =F15-E15   (wait)\nI15: =G15-E15   (system time)"
      },
      {
        "title": "System queue length with COUNTIF",
        "explanation": "Counts earlier customers whose service ends after this arrival, i.e. those still in the system. The range starts at the anchored $G$14 and ends at the relative row above, so it expands as it fills down. The criterion is built as text with \">\"&E15.",
        "code": "J15: =COUNTIF($G$14:G14,\">\"&E15)"
      },
      {
        "title": "Summary row 8",
        "explanation": "Ranges run to row 99, so more customers can be added below row 64 without editing the summaries. Saved run: utilisation 0.72, average wait about 6:14, average system time about 10:31, last arrival 13:38:51 and last service end 13:57:52.",
        "code": "C8: =D4/C4   (traffic intensity = 0.8)\nD8: =SUM(D15:D99)/(G8-G14)   (utilisation)\nE8: =MAX(E14:E99)   (last arrival)\nG8: =MAX(G14:G99)   (last service end)\nH8: =AVERAGE(H15:H99)   (average wait)\nI8: =AVERAGE(I15:I99)   (average system time)"
      },
      {
        "title": "Average number in the system (Explain sheet)",
        "explanation": "Between arrivals k and k+1 there are J_k + 1 customers just after customer k arrives and J_(k+1) just before customer k+1 arrives. A trapezoid of those two heights over the inter-arrival width C_(k+1) approximates the area under the customers-in-system curve. Summing the trapezoids and dividing by the elapsed time from opening to the last arrival gives the time-average number in the system (about 1.9 in the saved run).",
        "code": "J8: {=SUMPRODUCT(((J15:J98+1)+J16:J99)/2,C16:C99)/(E8-E14)}"
      },
      {
        "title": "Read the chart",
        "explanation": "The sheet's XY chart puts clock time on the horizontal axis (h:mm, 9:00 to 14:00) and customer number on the vertical axis. It plots Arrive (E15:E64), Start of Service (F15:F64) and Depart (G15:G64) against customer number (B15:B64), plus Wait Time (helper S15 =H15+$G$14, each wait drawn from 9:00) and System Length (J15:J64 against arrival time). The horizontal gap between a customer's Arrive and Start of Service points is that customer's wait, and it widens whenever the server falls behind.",
        "code": "Series (x vs y): E15:E64, F15:F64, G15:G64, S15:S64 vs B15:B64\nSystem Length: E15:E64 vs J15:J64"
      }
    ]
  },
  {
    "id": "w6-callcenter-cserver-br",
    "week": "W6",
    "title": "CallCenter-modified.xlsx: c servers, balking and reneging (c-Server, BR and BR-M sheets)",
    "overview": "The c-Server sheet generalises the model to any number of servers: an IF/LARGE rule replaces MAX, and the inputs switch to re-sampling the Data sheet. The BR sheets then add a balk limit and a renege limit, which bring in potential start and potential wait columns and blank-text (\"\") logic. The Modified sheet fixes how reneging customers' end times feed the system length, and '(Modified) (2)' uses Data Tables to compare 1 to 5 servers.",
    "takeaways": [
      "LARGE(previous end times, c) finds when the first of c busy servers frees up. Guard it with IF(J<c, …) so LARGE never runs on fewer than c values.",
      "Use \"\" to mark 'did not happen'. COUNT and AVERAGE skip it, so the balk and renege proportions become simple COUNT differences.",
      "System length is computed from the service end column, so the end-time rule decides who balks: BR inflates L, BR-2 understates it, BR-M counts renegers for exactly the renege limit.",
      "Sanity-check every output. A utilisation above 1 is impossible; in the BR sheets it comes from mixing clock times with durations.",
      "Data Tables over the servers input, plus a blank column-input cell for replications, compare staffing levels across many random runs."
    ],
    "steps": [
      {
        "title": "c-Server: inputs come from the data",
        "explanation": "The averages are calculated from the 150 observations instead of being typed, and each customer's times are re-sampled with PERCENTILE(array, RAND()). G4 holds the number of servers (validated as a whole number > 0; the G3 header comment reads 'Any number of Servers').",
        "code": "C4: =AVERAGE(Data!B13:K27)\nD4: =AVERAGE(Data!B30:K44)\nG4: 2   (servers)\nC15: =PERCENTILE(Data!$B$13:$K$27, RAND())\nD15: =PERCENTILE(Data!$B$30:$K$44,RAND())"
      },
      {
        "title": "c-Server: start time with c servers",
        "explanation": "If fewer than c customers are in the system, a server is idle and service starts on arrival. Otherwise the c-th largest earlier end time is the moment the first busy server frees up. Saved trace: customer 3 arrives at 9:12:09 with J17 = 2 = c, so F17 = LARGE($G$14:G16,2) = 9:20:50 (customer 1's end), a wait of 8:41.",
        "code": "J15: =COUNTIF($G$14:G14,\">\"&E15)\nF15: =IF(J15<$G$4,E15,LARGE($G$14:G14,$G$4))\nG15: =F15+D15   H15: =F15-E15   I15: =G15-E15"
      },
      {
        "title": "c-Server: results divide by the number of servers",
        "explanation": "Saved run: traffic intensity 1.15 (above 1, so the two servers cannot keep up), utilisation 0.97, average wait about 54 minutes, and 20 customers already in the system when customer 50 arrives. The average system time I8 is just over an hour, which its m:ss format cannot show in full.",
        "code": "C8: =(D4/G4)/C4   (traffic intensity)\nD8: =SUM(D15:D99)/(G4*(G8-G14))   (utilisation)"
      },
      {
        "title": "Why not MAX(arrival, LARGE(...))?",
        "explanation": "The documentation block asks why this shorter version would not work properly. When the range holds at least c end times it gives the same answer as the IF, but for the first customers the range holds fewer than c values. LARGE then returns #NUM!, which flows into G15 and every later LARGE range. The IF evaluates LARGE only once J ≥ c.",
        "code": "Do not use: =MAX(E20, LARGE($G$14:G19,c))\nUse:        =IF(J20<c, E20, LARGE($G$14:G19,c))"
      },
      {
        "title": "BR: new inputs",
        "explanation": "Balk limit: a customer who finds more than 7 in the system leaves without joining. Renege limit: a customer whose potential wait exceeds 30 minutes leaves the queue. The servers input moves to I4, and the opening time moves to I14.",
        "code": "F4: 7   (BalkLimit)\nG4: 0:30   (RenegeLimit = 30 minutes; its mm:ss format shows 30:00)\nI4: 2   (Servers)\nI14: 9:00   E14: =I14"
      },
      {
        "title": "BR: potential start and potential wait",
        "explanation": "F applies the balk test first (\"\" = balked), then the c-server rule over the service end column I. G is the wait the customer would face. G, H and I test F15=\"\" directly, and J and K test H and I, so balkers stay blank from F to K.",
        "code": "L15: =COUNTIF($I$14:I14,\">\"&E15)   (system length)\nF15: =IF(L15>F$4,\"\",IF(L15>=I$4,LARGE(I$14:I14,I$4),$E15))\nG15: =IF(F15=\"\",\"\",F15-E15)"
      },
      {
        "title": "BR: actual start (reneging test)",
        "explanation": "H keeps the potential start only if the potential wait is within the renege limit; otherwise the customer reneges and H is blank.",
        "code": "H15: =IF(F15=\"\",\"\",IF(G15>$G$4,\"\",F15))"
      },
      {
        "title": "Service end: original BR vs BR-M",
        "explanation": "L is counted from column I, so the end-time rule decides who balks next. The original BR gives renegers a fake end time F + D, which inflates L (ERROR). The sheet's documentation block lists I = IF(H=\"\",\"\",H+D), which is the BR-2 rule and drops renegers from L entirely (ERROR AGAIN). BR-M, in 'c-Server (BR) (Modified)', keeps renegers in the system for exactly the renege limit.",
        "code": "BR:   I15: =IF(F15=\"\",\"\",F15+D15)\nBR-M: I15: =IF(F15=\"\",\"\",IF(G15>$G$4,E15+$G$4,H15+D15))"
      },
      {
        "title": "Wait and system time",
        "explanation": "BR records waits only for customers who were served. BR-M records the renege limit (30:00) as both the wait and the system time of a reneger, because they really spent that long in the queue.",
        "code": "BR:   J15: =IF(H15=\"\",\"\",H15-E15)\n      K15: =IF(I15=\"\",\"\",I15-E15)\nBR-M: J15: =IF(F15=\"\",\"\", IF(H15=\"\",$G$4,H15-E15))\n      K15: =IF(F15=\"\",\"\", IF(H15=\"\", $G$4, I15-E15))"
      },
      {
        "title": "Balk and renege proportions",
        "explanation": "COUNT counts numbers only, so the \"\" cells drop out. Saved values: 0.16 balked and 0.19 reneged in BR; 0.18 and 0.17 in BR-M (each sheet re-randomises).",
        "code": "F8: =(COUNT(E15:E99)-COUNT(F15:F99))/COUNT(E15:E99)\nG8: =(COUNT(F15:F99)-COUNT(H15:H99))/COUNT(F15:F99)\nJ8: =AVERAGE(J15:J99)   K8: =AVERAGE(K15:K99)\nL8: =SUMPRODUCT((L16:L98+1+L17:L99)/2,C17:C99)/(I8-H15)"
      },
      {
        "title": "Sanity-check the utilisation cell",
        "explanation": "This utilisation formula reads 12.63 (BR), 11.08 (BR-M) and 1.99 ('(Modified) (2)') in the saved file. All three are impossible, because a reneger has an end clock time in I but no start time in H to subtract. Total only the service time of customers who actually started (for example a helper column =IF(H15=\"\",0,D15)) and divide by I4*(I8-I14): the BR run then gives about 0.72.",
        "code": "Stored: D8: =(SUM(I15:I99)-SUM(H15:H99))/(I4*(I8-I14))"
      },
      {
        "title": "Size the team with Data Tables ('(Modified) (2)')",
        "explanation": "A one-way Data Table varies the servers input I4 from 1 to 5 and records the average wait, system time and system length. A two-way table then puts servers 1–5 across and 100 run numbers down, using a blank cell U1 as the column input so each row is a fresh replication. Averaging each column gives waits of about 23:25, 12:37, 3:34, 0:58 and 0:18 for 1 to 5 servers.",
        "code": "P2: =J8   Q2: =K8   R2: =L8\nP3:R7: {=TABLE(,I4)}   (O3:O7 = 1..5 servers)\nO10: =J8\nP11:T110: {=TABLE(I4,U1)}   (P10:T10 = 1..5, O11:O110 = 1..100)\nP9: =AVERAGE(P11:P110)   (fill right to T9)"
      }
    ]
  },
  {
    "id": "w6-macro-record-management",
    "week": "W6",
    "title": "Macro-Recording.xlsm: record management with recorded macros and simple VBA edits",
    "overview": "A one-sheet member registry shows how far macro recording plus a few hand-written lines can go. Macro-Recording-Student.xlsm is the blank layout, Macro-Recording.xlsm the finished model and Macro-Recording-2.xlsm an extended version. Formulas auto-number new IDs and find a record's row. The recorded addRecord macro appends the entry row to the table, the recorded-then-edited deleteRecord removes the record found by the lookup, and the extension adds Edit and Update buttons.",
    "takeaways": [
      "Let formulas do the lookup work (C4 auto-ID, B7 row finder, D7:G7 fetch) and let macros do the repetitive clicking (copy, paste, clear, delete).",
      "Turn Use Relative Reference on only for the move that must follow the data: the Down Arrow to the next empty row.",
      "Treat recorded code as a draft: one added line keeps the ID counter in step, and five added lines turn a 'clear C7' recording into a guarded delete.",
      "Paste Special > Values (and number formats) turns formula results into permanent record values.",
      "Guard destructive VBA (If rowNum <> \"\" Then) so a missing ID can never delete the wrong row."
    ],
    "steps": [
      {
        "title": "Lay out the three zones",
        "explanation": "Rows 3–4 are the entry zone (Last ID, Member ID, Name, Gender, Address, DOB). Rows 6–7 are the lookup zone (Row, Member ID typed in C7, fetched fields). The Member's Records table has its title in C10, headers in C11 and data from row 12. B4 starts at 0, so the first member gets ID 1. Gender uses a Data Validation list, and G2 reminds users to type DOB as dd/mm/yyyy.",
        "code": "C4: =B4+1   (next Member ID)\nE4: Data Validation > Allow: List, Source: Male, Female"
      },
      {
        "title": "Find the record's worksheet row",
        "explanation": "MATCH with match type 0 finds the exact ID in the open-ended column C12:C1048576. Adding the rows above the table converts the position into a sheet row number, which deleteRecord and updateRecord use. IFERROR returns \"\" when the ID does not exist. In the saved Macro-Recording.xlsm, C7 = 1 gives B7 = 12.",
        "code": "B7: =IFERROR(MATCH(C7,C12:C1048576,0)+11,\"\")   (Macro-Recording-2.xlsm)\nB7: =IFERROR(MATCH(C7,C12:C1048576,0)+ROW(C11),\"\")   (Macro-Recording.xlsm)"
      },
      {
        "title": "Fetch the whole record with one array formula",
        "explanation": "Select D7:G7, type the formula and confirm it as an array formula. A column_num of 0 makes INDEX return every column of the matching row (Name, Gender, Address, DOB) into the four cells. An empty C7 shows blanks, and an unknown ID shows #N/A.",
        "code": "D7:G7: {=IF(C7=\"\",\"\",INDEX(D12:G1048576,MATCH(C7,C12:C1048576,0),0))}"
      },
      {
        "title": "Record addRecord",
        "explanation": "Developer > Record Macro, name it addRecord, then perform the steps: copy C4:G4; select C10; Ctrl+Down; Use Relative Reference ON; Down Arrow; Paste Special > Values and number formats; Use Relative Reference OFF; Esc; select D4:G4 and Clear Contents; Stop Recording. The only relative line is the Offset, so the paste always lands one row below the current last record.",
        "code": "Range(\"C4:G4\").Select\nSelection.Copy\nRange(\"C10\").Select\nSelection.End(xlDown).Select\nActiveCell.Offset(1, 0).Range(\"A1\").Select\nSelection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats, Operation:= _\n    xlNone, SkipBlanks:=False, Transpose:=False\nApplication.CutCopyMode = False\nRange(\"D4:G4\").Select\nSelection.ClearContents"
      },
      {
        "title": "Edit addRecord: advance the Last ID",
        "explanation": "Recording cannot capture 'add one to the counter', so add the line by hand in the Visual Basic Editor. After each add, B4 goes up by one and C4 =B4+1 offers the next free ID. In the saved file two members have been added, so B4 = 2 and C4 = 3.",
        "code": "    Range(\"B4\").Value = Range(\"B4\").Value + 1\nEnd Sub"
      },
      {
        "title": "Record deleteRecord, then add the guarded delete",
        "explanation": "The recording only captures 'select C7, Clear Contents'. The five added lines read the row number that B7 calculated and delete that entire row; the If guard skips the delete when B7 is blank, so an unknown ID removes nothing.",
        "code": "Sub deleteRecord()\n    rowNum = Range(\"B7\").Value\n    If rowNum <> \"\" Then\n        Rows(rowNum).Select\n        Selection.Delete\n    End If\n    Range(\"C7\").Select\n    Selection.ClearContents\nEnd Sub"
      },
      {
        "title": "Attach the macros to buttons",
        "explanation": "Developer > Insert > Form Controls > Button, draw the button, choose the macro in the Assign Macro dialog, then edit the label. The finished sheet has an Add button running addRecord and a Delete button running deleteRecord.",
        "code": "Add button    -> addRecord\nDelete button -> deleteRecord"
      },
      {
        "title": "Extension: Edit and Update (Macro-Recording-2.xlsm)",
        "explanation": "editRecord (recorded) copies the looked-up record in C7:G7 as plain values into row 8, where it can be changed. updateRecord (hand-written) pastes row 8 back over the original record at row rowNum, builds the address with \"C\" & CStr(rowNum), then clears the edit row and C7. The workbook has four buttons: Add, Delete, Edit, Update.",
        "code": "Sub editRecord()\n    Range(\"C7:G7\").Select\n    Selection.Copy\n    Range(\"C8\").Select\n    Selection.PasteSpecial Paste:=xlPasteValues, Operation:=xlNone, SkipBlanks _\n        :=False, Transpose:=False\n    Application.CutCopyMode = False\nEnd Sub\n\nSub updateRecord()\n    rowNum = Range(\"B7\").Value\n    If rowNum <> \"\" Then\n        Range(\"C8:G8\").Select\n        Selection.Copy\n        Range(\"C\" & CStr(rowNum)).Select\n        Selection.PasteSpecial Paste:=xlPasteValues, Operation:=xlNone, SkipBlanks _\n        :=False, Transpose:=False\n        Application.CutCopyMode = False\n        Range(\"C8:G8\").Select\n        Selection.ClearContents\n        Range(\"C7\").ClearContents\n    End If\nEnd Sub"
      }
    ]
  },
  {
    "id": "timerclicker-queue-stamps",
    "week": "W9",
    "title": "TimerClicker.xlsm: recording macros that time-stamp a queue",
    "overview": "Timer-Clicker is the session's macro-recording exercise. The Timer sheet stamps arrival, service-start and service-end times for a first-come first-served, single-server queue and derives inter-arrival, service, wait and system times. Clicker adapts it to count up to three customer types against 30-minute time bins. The Proto sheet is a blank template for rebuilding Timer yourself (Exercise 1: record the macros and assign buttons) and building Clicker from a copy of Timer (Exercise 2). The macros in Module1 are tidied versions of the keystroke recipes on slides 5 and 6.",
    "takeaways": [
      "Record first, then tidy: the recorder gives you working code for copy, Ctrl+Down and Paste Special, and editing removes the clutter.",
      "Only the step that must move with the data (the Down Arrow after Ctrl+Down) needs Use Relative References ON.",
      "Range(\"C6\").End(xlDown).Offset(1, 0) is the course's standard way to reach the next empty row, and the never-empty row 7 makes it safe.",
      "Paste values and number formats to freeze a NOW() reading as a permanent time stamp; the durations are then simple subtractions.",
      "Use Call and Private helpers to build bigger actions (RecordEndPlus) from small recorded ones."
    ],
    "steps": [
      {
        "title": "Put a live clock and a copy row on the sheet",
        "explanation": "D3 holds the current time. Row 7 repeats it under each time column, so every Record macro can copy its own column's row-7 cell. NOW only moves when the sheet recalculates, so recording starts with F9 and the code starts with Calculate.",
        "code": "D3: =NOW()                       (format h:mm:ss)\nC7: =$D$3   D7: =$D$3   E7: =$D$3"
      },
      {
        "title": "Add the four duration formulas in row 7",
        "explanation": "F7:I7 hold the inter-arrival, service, wait and system formulas, formatted m:ss. CopyFormulas later copies them down one row per completed customer. In F7 the header text 'Arrive' in C6 counts as larger than any number, so the IF shows a blank. In F8 the live clock in C7 is later than the first stamp, so the first customer also shows a blank; real gaps start at customer 2.",
        "code": "F7: =IF(C6>C7,\"\",C7-C6)   Interarrival\nG7: =E7-D7                 Service\nH7: =D7-C7                 Wait\nI7: =E7-C7                 System"
      },
      {
        "title": "Record the Arrive macro with the relative-reference switch",
        "explanation": "Slide 5's recipe: start recording; press F9; select and copy C7 (or D3); select the header C6 (not C7, the last filled cell before any time is stamped); press Ctrl+Down to reach the last filled cell; switch Use Relative References ON; press Down Arrow; Paste Special > Values and Number Formats; press Esc; switch relative OFF; stop recording. Only the Down Arrow has to be relative: the cells you select (C7 and C6) should stay fixed, and Ctrl+Down is recorded as End(xlDown), which follows the data in either mode."
      },
      {
        "title": "Read the tidied RecordArrive code",
        "explanation": "The recorded keystrokes map onto these lines, with selecting C6, Ctrl+Down and the Down Arrow folded into one: End(xlDown) is Ctrl+Down and Offset(1, 0) is the relative Down Arrow. Pasting values and number formats freezes the time but keeps the h:mm:ss look. CutCopyMode = False is the Esc key. Selecting D3 at the end parks the cursor away from the data.",
        "code": "Sub RecordArrive()\n    Calculate\n    Range(\"C7\").Copy\n    Range(\"C6\").End(xlDown).Offset(1, 0).Select\n    Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats\n    Selection.HorizontalAlignment = xlCenter\n    Range(\"D3\").Select\n    Application.CutCopyMode = False\nEnd Sub"
      },
      {
        "title": "Clone it for Start and End",
        "explanation": "RecordStart and RecordEnd are identical apart from the column: D7/D6 and E7/E6. The sheet's notes give two routes: re-record with steps 2 and 3 changed, or copy the Arrive code in the VBE and edit the two addresses. The second is faster and avoids recorder clutter.",
        "code": "Range(\"D7\").Copy\nRange(\"D6\").End(xlDown).Offset(1, 0).Select   ' RecordStart\nRange(\"E7\").Copy\nRange(\"E6\").End(xlDown).Offset(1, 0).Select   ' RecordEnd"
      },
      {
        "title": "Chain macros: RecordEndPlus and the Private helper CopyFormulas",
        "explanation": "When a customer leaves, the row can be completed. RecordEndPlus calls RecordEnd and then CopyFormulas. CopyFormulas selects F7, extends to the end of the row with End(xlToRight) (F7:I7), and pastes formulas and number formats into the next empty row of column F. This is the code form of slide 6, steps 11 to 16, except that the slide's step 16 uses a plain Paste. CopyFormulas is Private, so it does not clutter the Macro list.",
        "code": "Sub RecordEndPlus()\n    Call RecordEnd\n    Call CopyFormulas\n    Range(\"D3\").Select\n    Application.CutCopyMode = False\nEnd Sub\n\nPrivate Sub CopyFormulas()\n    Range(\"F7\").Select\n    Range(Selection, Selection.End(xlToRight)).Copy\n    Range(\"F6\").End(xlDown).Offset(1, 0).Select\n    Selection.PasteSpecial Paste:=xlPasteFormulasAndNumberFormats\n    Selection.HorizontalAlignment = xlCenter\n    Application.CutCopyMode = False\nEnd Sub"
      },
      {
        "title": "Wire the macros to the headers",
        "explanation": "On the Timer sheet, transparent rectangles over C6, D6 and E6 run RecordArrive, RecordStart and RecordEndPlus, and B5 tells the observer 'Click header to record time point.' Clicking a header stamps a time without using the Macro dialog during fieldwork."
      },
      {
        "title": "Clicker: cumulative counts per time bin",
        "explanation": "Clicker stamps Count A, B and C in columns C to E with the same three record macros. Bins (8:00, 8:30, ...) are typed from F8 down. G7 holds a FREQUENCY formula that, with a single bin, counts stamps at or before that time. CompleteCumFreqTable counts the bins from F8 down and pastes the G7 formula across three columns for every bin row. In the sample, Cum A is 2 at the 9:00 bin and 6 at the 9:30 bin.",
        "code": "G7: =FREQUENCY(C$8:C$999,$F7)\n\nRange(\"F8\").Select\nnumBin = Range(Selection, Selection.End(xlDown)).Count\nRange(\"G7\").Select: Selection.Copy\nRange(Selection.Offset(1, 0), Selection.Offset(numBin, 2)).Select\nSelection.PasteSpecial Paste:=xlPasteFormulasAndNumberFormats"
      },
      {
        "title": "Housekeeping: open event, protection and self-documentation",
        "explanation": "ThisWorkbook's Workbook_Open activates Home and selects A1. Module3 shows two wrappers: Security, which unprotects the sheet, runs the core code and protects it again, and FastAndClean, which turns ScreenUpdating off and on. CellFormula and ShowFormula return a cell's formula as text, so formulas can be documented automatically. The Timer sheet's notes suggest PasteSpecial Value for older Excel versions and leave open questions for you: worksheet protection, and whether you could select row 65536 and use Ctrl+Up Arrow instead.",
        "code": "Private Sub Workbook_Open()\n    Application.ScreenUpdating = False\n    Sheets(\"Home\").Activate\n    Range(\"A1\").Select\nEnd Sub"
      }
    ]
  },
  {
    "id": "introvba-nine-exercises",
    "week": "W9",
    "title": "IntroVBA-V2.xlsm: nine button-driven exercises from writing cells to trapping errors",
    "overview": "IntroVBA-V2 is a deliberately blank three-sheet workbook. Sheet1 carries ten form-control buttons (Ex 1 - Enter Name to Ex 9 - Square Root) wired to the procedures in Module1. Each exercise isolates one idea from the slides: writing and formatting a cell, Offset versus Cells addressing, GoTo, If-Then-Else, Select Case, For-Next, Do-While, Do-Until and On Error. Slides 21 to 31 show the same code for Ex3 to Ex9, so working through the buttons is the fastest revision of VBA program flow.",
    "takeaways": [
      "Each Sub in Module1 (Ex1 has two) is assigned to its own form-control button, the standard way to give users one-click access to a macro.",
      "Offset(rows, cols) moves relative to a range; Cells(row, col) addresses by numbers, which is handy inside loops.",
      "Choose the structure by intent: If/Else for two branches, Select Case for many, For-Next for a known count, and Do While/Until when the stopping point depends on the data.",
      "Type 1 loops (test first) can run zero times; Type 2 loops (test last) always run at least once.",
      "Validate inputs (Ex6's range check) and add On Error GoTo for everything you cannot predict (Ex9)."
    ],
    "steps": [
      {
        "title": "Ex1: write to a cell, format it, clear it",
        "explanation": "The two Ex 1 buttons show the object.property = value pattern. Value is a property of the Range object, and Italic and Bold are properties of its Font object; ClearContents is a method that empties the cell but keeps its formatting.",
        "code": "Sub Ex1_EnterMyName()\n    Range(\"A1\").Value = \"Your Name\"\n    Range(\"A1\").Font.Italic = True\n    Range(\"A1\").Font.Bold = True\nEnd Sub\n\nSub Ex1_ClearMyName()\n    Range(\"A1\").ClearContents\nEnd Sub"
      },
      {
        "title": "Ex2: two ways to address a cell",
        "explanation": "Offset(rows, columns) is relative to a starting range, while Cells(row, column) is an absolute grid position built from numbers. YEAH1 lands in D3 (2 down and 3 right of A1) and YEAH2 in E4 (row 4, column 5). A1 is shaded black (ColorIndex 1) and then cleared with xlNone.",
        "code": "Range(\"A1\").Interior.ColorIndex = 1 'Black\nRange(\"A1\").Offset(2, 3).Value = \"YEAH1\"\ni = 3\nj = 4\nCells(1 + i, 1 + j).Value = \"YEAH2\"\nRange(\"A1\").Interior.ColorIndex = xlNone"
      },
      {
        "title": "Ex3: GoTo a label",
        "explanation": "UCase makes the test case-insensitive, so 'is602' is accepted. Exit Sub before the label stops a correct answer from falling through into the error message. The slides use this exercise to show why GoTo is disliked: execution jumps around and is hard to follow.",
        "code": "FavCourse = InputBox(\"Enter your favorite course: \")\nIf UCase(FavCourse) <> \"IS602\" Then GoTo WrongAns\nMsgBox (\"Wise choice!\")\nExit Sub\nWrongAns:\nMsgBox (\"Sorry. You are not welcome here!\")"
      },
      {
        "title": "Ex4: MsgBox as a question, nested If",
        "explanation": "MsgBox with vbOKCancel returns a number: 1 means OK was clicked. Only then does the inner If ask for the course name and branch with Else.",
        "code": "myanswer = MsgBox(\"Take an IQ test?\", vbOKCancel, \"IQ Test\")\nIf myanswer = 1 Then\n    FavCourse = InputBox(\"Name the best course in SMU: \")\n    If UCase(FavCourse) = \"IS602\" Then\n        MsgBox (\"Your IQ is above 160. Congratulations! \")\n    Else\n        MsgBox (\"I am sorry. Please seek assistance ASAP!\")\n    End If\nEnd If"
      },
      {
        "title": "Ex5: Select Case for one-of-many choices",
        "explanation": "Each Case lists a value to match. The workbook stores the input in Rating (the slide calls it FavCourse). With no Case Else, a numeric rating outside 1 to 3 simply produces no message.",
        "code": "Rating = InputBox(\"Enter your rating for IS602 (1-bad to 3-good): \")\nSelect Case Rating\n    Case 1\n        MsgBox (\"Are you sure?\")\n    Case 2\n        MsgBox (\"OK lah\")\n    Case 3\n        MsgBox (\"I am happy!\")\nEnd Select"
      },
      {
        "title": "Ex6: validate, then loop with For-Next",
        "explanation": "Num and i are declared As Integer. The If guard accepts only 1 to 56, the limits stated in the prompt. Each pass colours the cell i rows below A1 with index i + 1, so an input of 5 colours A1:A5 with indexes 1 to 5. Note that there is no error trap here, unlike Ex9.",
        "code": "Num = InputBox(\"Enter # of cells to color (min 1, max 56): \")\nIf Num >= 1 And Num <= 56 Then\n    Range(\"A1\").Interior.ColorIndex = 1 'Black\n    If Num > 1 Then\n        For i = 1 To Num - 1\n            Range(\"A1\").Offset(i, 0).Interior.ColorIndex = i + 1\n        Next i\n    End If\nEnd If"
      },
      {
        "title": "Ex7: Do While, a test-first loop",
        "explanation": "spending starts at 10 and rises by 20 each pass, so the message shows for 10, 30, 50, 70 and 90. At 110 the test fails and the farewell message follows, 6 boxes in all. The & operator joins text and numbers into one message.",
        "code": "spending = 10\nDo While spending <= 100\n    MsgBox (\"Your $\" & spending & \" spending is within the limit, I still love you.\")\n    spending = spending + 20\nLoop\nMsgBox (\"I am broke and I have to stop loving you.\")"
      },
      {
        "title": "Ex8: Do ... Loop Until, a test-last loop",
        "explanation": "Money is a Single starting at 4. The body runs before the test, giving 'Can spend' messages at $4, $3.5, $3 and $2.5. When Money reaches 2 the Until condition (Money < 2.1) becomes TRUE, and the closing message reports $2.",
        "code": "Money = 4\nDo\n    MsgBox (\"You have $\" & Money & \". Can spend.\")\n    Money = Money - 0.5\nLoop Until Money < 2.1\nMsgBox (\"You have $\" & Money & \". Better stop spending.\")"
      },
      {
        "title": "Ex9: a general error trap",
        "explanation": "On Error GoTo BadEntry catches any run-time error, such as a negative number or text passed to Sqr, and shows one friendly message instead of the VBA debugger. Exit Sub after the normal path keeps the handler from running on success. The blank-entry test compares with a single space; testing for an empty string would also let Cancel exit quietly.",
        "code": "On Error GoTo BadEntry\nNum = InputBox(\"Enter a value: \")\nIf Num = \" \" Then Exit Sub\nActiveCell.Value = Sqr(Num)\nExit Sub\nBadEntry:\nMsgBox (\"Enter a positive numeric value\")"
      }
    ]
  },
  {
    "id": "usefulmacros-code-library",
    "week": "W9",
    "title": "UsefulMacros.xlsm: a copy-and-adapt library of range, sheet, workbook, dialog and event macros",
    "overview": "UsefulMacros is a code library rather than a model. Its Home sheet invites you to copy and paste whole subroutines or parts of them into your own workbook and adapt them for your projects. Each demo sheet (Range, Worksheet, Chart, Workbook, Dialog, Event) covers one area; the Range, Worksheet and Dialog sheets print the code beside clickable labels, and modules M1_Range to M8_ThisWkbk_Events hold most of the procedures (the Workbook and Event sheets keep theirs in their own sheet modules). It is the reference to keep open when you add VBA to the group project.",
    "takeaways": [
      "Treat UsefulMacros as a parts bin: copy a routine, change the addresses and sheet names, and test it on a copy of your workbook.",
      "Two loop idioms recur: For i ... Offset(i, 0) when the count is known, and Do While ActiveCell <> \"\" / Offset(1, 0).Select when it is not.",
      "Writing a value (Range = x) freezes a result, while writing .Formula keeps the model live; pick the one that matches the model's purpose.",
      "Event code must live in the sheet or ThisWorkbook code module; code in a sheet module is called as SheetCodeName.SubName from elsewhere.",
      "Wrap project macros with ScreenUpdating and Protect/Unprotect so they run fast and keep inputs safe."
    ],
    "steps": [
      {
        "title": "Range sheet: fill a series with a For loop",
        "explanation": "The SerialNo label runs SerialNum. The loop counter doubles as both the offset and the value, so B4:B11 receive 1 to 8. Writing Range(...) = i uses the default Value property.",
        "code": "Sub SerialNum()\n    For i = 1 To 8\n        Range(\"B3\").Offset(i, 0) = i\n    Next i\nEnd Sub"
      },
      {
        "title": "Range sheet: test-and-format with With, then walk down a column",
        "explanation": "CheckThis formats whichever cell is active. With ActiveCell ... End With avoids repeating the object, and four separate single-line Ifs let the last true test win. CheckAllBelow starts at C4 and calls CheckThis until it meets an empty cell, so C4:C11 (500 to 10000) end up 2 red, 2 black, 3 blue and 1 green. The code printed on the sheet starts at B4, but the module, which actually runs, uses C4 and C3.",
        "code": "Sub CheckThis()\n    With ActiveCell\n        If .Value = \"\" Then Exit Sub\n        If .Value <= 1000 Then .Font.Color = vbRed\n        If .Value > 1000 Then .Font.Color = vbBlack\n        If .Value > 4999 Then .Font.Color = vbBlue\n        If .Value > 9999 Then .Font.Color = vbGreen\n    End With\nEnd Sub\n\nSub CheckAllBelow()\n    Range(\"C4\").Select\n    Do While ActiveCell <> \"\"\n        CheckThis\n        ActiveCell.Offset(1, 0).Select\n    Loop\n    Range(\"C3\").Select\nEnd Sub"
      },
      {
        "title": "Range sheet: copy a cell, copy-paste a range, clear a range",
        "explanation": "CopyCell assigns one cell to another with no clipboard (C13 receives C4's 500). CopyRange uses the clipboard, pastes values only, and then releases the marquee as Esc would. ClearRange empties B4:B11 so the demos can be rerun. AllBlack resets the font colours with a Do ... Loop Until ActiveCell = \"\" walk from C4.",
        "code": "Range(\"C13\") = Range(\"C4\")                      ' CopyCell\nRange(\"C4:C11\").Copy                             ' CopyRange\nRange(\"B4\").PasteSpecial xlPasteValues\nApplication.CutCopyMode = False\nRange(\"B4:B11\").ClearContents                    ' ClearRange"
      },
      {
        "title": "Worksheet sheet: worksheet functions, formulas and UDFs",
        "explanation": "With Shoes in C4:C7 (5000, 6000, 9000, 10000), UseXLFunction writes the number 30000 into C8, while EnterFormula writes the live formula =SUM(C4:C7) and the documentation text ' =SUM(C4:C7)' into E8. C13 =WorkbookName() and C14 =WorksheetName() are user-defined functions from M2_Function; Application.Volatile True makes them recalculate.",
        "code": "Total = WorksheetFunction.Sum(Range(\"C4:C7\"))   ' UseXLFunction\nRange(\"C8\") = Total\n\nRange(\"C8\").Formula = \"=SUM(C4:C7)\"              ' EnterFormula\n\nFunction WorksheetName()\n    Application.Volatile True\n    WorksheetName = Application.Caller.Parent.Name\nEnd Function"
      },
      {
        "title": "Managing sheets: index vs name, visibility, adding in a loop",
        "explanation": "Worksheets(1) and Sheets(4) pick sheets by position, which shifts when tabs move; Sheets(\"Chart1\") picks by name. Visible takes -1, 0 or 2 (visible, hidden, very hidden). AddSheet keeps adding at the end until the workbook has 12 sheets. ClearOldData shows For Each over a named list of sheets, clearing from C9 down on each.",
        "code": "Do While Sheets.Count < 12\n    ThisWorkbook.Sheets.Add After:=Sheets(Sheets.Count)\nLoop\n\nFor Each sht In Sheets(Array(\"RT\", \"WH\", \"DC\", \"Factory\"))\n    sht.Activate\n    ActiveSheet.Range(\"C9\").Select\n    ActiveSheet.Range(Selection, Selection.End(xlDown)).ClearContents\nNext"
      },
      {
        "title": "Workbook sheet: names, paths and a folder listing",
        "explanation": "These three macros live in the Workbook sheet's own code module (code name Sheet5), so the labels call Sheet5.GetFileName, Sheet5.GetFilePath and Sheet5.ListFiles. GetFileName writes ActiveWorkbook.Name to C7 and GetFilePath writes ActiveWorkbook.Path to C8. ListFiles clears the old list, then calls Dir repeatedly to write each file name from C11 down. D11:D52 turn each name into a clickable link with =IF(C11=\"\",\"\",HYPERLINK($C$8&\"\\\"&C11,C11)).",
        "code": "foundFile = Dir(filePath & \"\\*.*\")\nIf foundFile = \"\" Then MsgBox \"No files found in the active directory.\"\ni = 1\nCall ClearOldList\nDo While foundFile <> \"\"\n    Range(\"C10\").Offset(i, 0) = foundFile\n    foundFile = Dir\n    i = i + 1\nLoop"
      },
      {
        "title": "Dialog sheet: MsgBox and InputBox",
        "explanation": "The sheet prints the syntax MsgBox(prompt[, buttons][, title][, helpfile, context]) and InputBox(prompt[, title][, default][, xpos][, ypos][, helpfile, context]). vbCrLf breaks a line. Adding button constants (vbQuestion + vbYesNo) sets the icon and buttons, and comparing the reply with vbYes branches the code.",
        "code": "Ans = MsgBox(\"CAT is the best SMU course\" & vbCrLf & \"Do you agree?\", _\n    vbQuestion + vbYesNo, \"Quick Check\")\nIf Ans = vbYes Then\n    MsgBox \"You are so kind.\", vbOKOnly, \"Thank you\"\nElse\n    MsgBox \"Will need your feedback to improve.\" & vbCrLf & \"Please email me.  Thanks.\", vbOKOnly, \"I will try harder.\"\nEnd If"
      },
      {
        "title": "Event sheet and ThisWorkbook: code that runs by itself",
        "explanation": "The Event sheet's module highlights the row and column of every selection: it clears all row colours, shades the entire row and column grey (ColorIndex 16) and colours the selected cells (Target) red. ThisWorkbook's Workbook_SheetActivate selects A1 whenever a worksheet is activated. M7_OtherEvents and M8_ThisWkbk_Events hold more patterns (Worksheet_Change, Intersect filtering, Workbook_Open hiding sheets, BeforeSave confirmation, BeforeClose auto-save); copy them into the object's code module to make them live. The first line's constant is misspelt in the source (the module has no Option Explicit); with Option Explicit the VBE would flag it as an undeclared variable.",
        "code": "Private Sub Worksheet_SelectionChange(ByVal Target As Range)\n    Rows.Interior.ColorIndex = xlColourindexnone\n    Target.EntireColumn.Interior.ColorIndex = 16\n    Target.EntireRow.Interior.ColorIndex = 16\n    Target.Interior.Color = vbRed\nEnd Sub"
      },
      {
        "title": "Wrappers worth reusing in any macro",
        "explanation": "M3_Worksheet collects small patterns you can wrap around a project macro's core code: ScreenUpdating off and on to stop flicker and speed things up, Unprotect and Protect with a password constant, and Application.Wait to slow a loop for display. The library also contains a NoPrompt demo, but its code types Application.DisplayAlert, whereas the SelfDestruct routine in M8 uses the correct property name, Application.DisplayAlerts.",
        "code": "Const Pswd As String = \"Password\"\nActiveSheet.Unprotect Password:=Pswd\nApplication.ScreenUpdating = False\n'  ** core program here **\nApplication.ScreenUpdating = True\nActiveSheet.Protect Password:=Pswd\n\nApplication.Wait (Now + TimeValue(\"00:00:01\"))"
      }
    ]
  },
  {
    "id": "demo-advanced-filter-and-or",
    "week": "W10",
    "title": "Demo-Advanced-Filter.xlsx: writing AND and OR criteria ranges",
    "overview": "A four-record list (Name, Gender, Address, Age in Sheet1!B7:E11) is filtered twice with Data > Advanced. Example 1 keeps females aged 30 or more; Example 2 keeps (female AND 30+) OR (male AND under 30). The saved file still remembers the last run: its hidden _FilterDatabase name points at B7:E11 and its Criteria name at G3:H5.",
    "takeaways": [
      "Copy the list's header text exactly into the criteria range; position and order do not matter.",
      "Same row = AND; extra rows = OR. Write each alternative as a complete row.",
      "A blank criteria cell (or a whole blank column) restricts nothing.",
      "Comparison criteria such as >=30 and <30 are typed as text in the criteria cells.",
      "Keep at least one empty row between the criteria range (above) and the data list (below)."
    ],
    "steps": [
      {
        "title": "Lay out the data list",
        "explanation": "The list starts with a single header row, with one record per row beneath it. Advanced Filter treats B7:E11 (header included) as the List range.",
        "code": "B7:E11\nName     | Gender | Address | Age\nMei      | F      | Yishun  | 38\nABC      | M      | AMK     | 35\nDEF      | F      | HM      | 40\nGGG      | M      | gregd   | 25"
      },
      {
        "title": "Example 1: one criteria row means AND",
        "explanation": "B2 states the goal: all Female AND >= 30 age. Copy the headers Gender, Age and Address into B3:D3 and type the conditions on row 4. Address (D4) is left empty, so it places no restriction. Run Data > Advanced with List range $B$7:$E$11 and Criteria range $B$3:$D$4. Result: Mei (F, 38) and DEF (F, 40).",
        "code": "B3: Gender   C3: Age    D3: Address\nB4: F        C4: >=30   D4: (blank)"
      },
      {
        "title": "Keep the criteria above the list with an empty separator row",
        "explanation": "The criteria sit in rows 3-5 and the list header is in row 7, leaving row 6 empty. That meets the deck's two placement rules: criteria above the data list, separated by at least one empty row."
      },
      {
        "title": "Header order is free; header spelling is not",
        "explanation": "The criteria headers run Gender | Age | Address while the list runs Name | Gender | Address | Age. Excel pairs them by name, so the order does not matter, but each criteria header must be spelled exactly like its list header or it will not match."
      },
      {
        "title": "Example 2: two criteria rows means OR",
        "explanation": "G2 states the goal: (Female AND >= 30 age) OR (Male AND < 30 age). Under the G3:I3 headers, each criteria row (4 and 5) is one AND-group; Excel keeps a record if it satisfies either row. Mei and DEF pass row 4; GGG (M, 25) passes row 5; ABC (M, 35) fails both, so 3 of 4 records remain.",
        "code": "G3: Gender   H3: Age    I3: Address\nG4: F        H4: >=30\nG5: M        H5: <30"
      },
      {
        "title": "Check what the workbook remembers",
        "explanation": "Defined names store the last Advanced Filter run: _xlnm._FilterDatabase = Sheet1!$B$7:$E$11 (the list) and _xlnm.Criteria = Sheet1!$G$3:$H$5. The last run therefore used Example 2 with just the Gender and Age columns. Leaving out the empty Address column changes nothing, because a blank criteria column restricts nothing.",
        "code": "List range:     Sheet1!$B$7:$E$11\nCriteria range: Sheet1!$G$3:$H$5\nAction:         Filter the list, in-place"
      }
    ]
  },
  {
    "id": "offshore-development-alert-filter",
    "week": "W10",
    "title": "OffshoreDevelopment-modified.xlsm: alert-level milestone tracking with Advanced Filter and VBA",
    "overview": "SAA tracks 50 outsourced IT projects with 5 milestones each (Model!B19:I269, 250 rows). On the Model sheet a manager picks an alert level in E4; formulas turn that choice into date-window criteria strings in D15:E15, and a recorded Advanced Filter macro, fired by a Worksheet_Change event, shows only the milestones due in that window. Proto is the student build sheet: same layout, with the model's working formulas (F4:I4, H8:I12, D15:E15, F20:G268) left blank, although in this class file Proto's column D also supplies the rolling due dates that Model reads.",
    "takeaways": [
      "Criteria values are plain text in cells, so formulas (VLOOKUP + TEXT) can rewrite them - that is what makes the filter dynamic.",
      "Repeat a header (Due Date | Due Date) on one criteria row to express a from-to window on a single field.",
      "Guard date arithmetic: IF(TODAY()+offset<1,1,...) keeps 'All' from producing a negative date.",
      "Advanced Filter is a one-off action; a Worksheet_Change event that calls the recorded macro keeps the view in step with the user's selections.",
      "Audit filled-down formulas: in the class file Model!D269 points at an empty Proto row and G269 compares E269 with D270, so the last milestone row is broken; G34:G38 also compare with the next row's due date and G39 holds #REF!."
    ],
    "steps": [
      {
        "title": "Read the brief",
        "explanation": "Home: SAA's IT department watches about 50 outsourced projects, each with several major milestones. Projects slip when requirements change or technical problems arise, and senior management does not want surprises. The VP asks for a simple, user-friendly mechanism that at least raises alerts when major milestones are not completed on time."
      },
      {
        "title": "Build the alert-level table",
        "explanation": "E7:I12 lists each level with its day offsets (From/To) and the matching dates. All: -99999 to 99999; 0: -14 to 0; 1: -28 to -15; 2: -56 to -29; 3: -99999 to -57. The date columns add the offset to TODAY(), with a guard so a huge negative offset becomes serial 1 (1 Jan 1900) instead of an invalid date.",
        "code": "H8: =IF(TODAY()+F8<1,1,TODAY()+F8)   (filled to H12)\nI8: =IF(TODAY()+G8<1,1,TODAY()+G8)   (filled to I12)"
      },
      {
        "title": "Pick a level and look up its window",
        "explanation": "E4 is the only input in row 4: a data-validation drop-down whose list is =$E$8:$E$12 (All, 0, 1, 2, 3). Row 4 fetches the chosen row's offsets and dates. The file was saved with level 1 selected, giving -28/-15 days and 26 Sep 2023 to 9 Oct 2023 (as at 24 Oct 2023).",
        "code": "F4: =VLOOKUP($E$4,$E$8:$I$12,2)\nG4: =VLOOKUP($E$4,$E$8:$I$12,3)\nH4: =VLOOKUP($E$4,$E$8:$I$12,4)\nI4: =VLOOKUP($E$4,$E$8:$I$12,5)"
      },
      {
        "title": "Write the criteria as strings",
        "explanation": "The criteria headers D14:I14 copy the list headers, with Due Date used twice so one field gets a from-to window (AND on the same row). The deck insists criteria values must be strings, so TEXT converts the dates. As at 2 Nov 2019 with All selected, the deck's screenshot shows >=1 Jan 1900 and <=16 Aug 2293.",
        "code": "D14: Due Date   E14: Due Date   F14: Completed?   G14: On Time?   H14: Mid-pt Review   I14: Milestone Review\nD15: =\">=\"&TEXT(H4,\"d MMM yyyy\")\nE15: =\"<=\"&TEXT(I4,\"d MMM yyyy\")"
      },
      {
        "title": "Derive the status columns",
        "explanation": "Completed? and On Time? are formulas filled down rows 20-269. The two review columns accept only Waived or Done (data validation). The criteria cells F15:G15 offer Yes/No drop-downs and H15:I15 offer Waived/Done, so a manager can, for example, view only uncompleted level-3 milestones.",
        "code": "F20: =IF(E20=\"\",\"No\",\"Yes\")\nG20: =IF(E20= \"\", \"\", IF(E20> D20, \"No\", \"Yes\"))"
      },
      {
        "title": "Colour the due dates by alert level",
        "explanation": "Three conditional-formatting rules on D20:D270 compare each due date with the level windows: between $H$10 and $I$10 gives light yellow (level 1), $H$11-$I$11 pink (level 2) and $H$12-$I$12 tan (level 3). Level-0 dates stay white, matching the deck's colour bar."
      },
      {
        "title": "Record the filter macro",
        "explanation": "Model!L28:L31 documents the recording: Data/Filter/Advance Filter, enter the list and criteria ranges, OK. The recorded call is wrapped in an If so that 'All' uses only the two Due Date criteria.",
        "code": "Sub Filter_Alert()\n    If Range(\"E4\").Value <> \"All\" Then\n        Range(\"B19:I65536\").AdvancedFilter Action:=xlFilterInPlace, CriteriaRange:= _\n        Range(\"D14:I15\"), Unique:=False\n    Else\n        Range(\"B19:I65536\").AdvancedFilter Action:=xlFilterInPlace, CriteriaRange:= _\n        Range(\"D14:E15\"), Unique:=False\n    End If\nEnd Sub"
      },
      {
        "title": "Re-run it automatically",
        "explanation": "An advanced filter does not refresh itself, so the Model sheet's Worksheet_Change event calls Filter_Alert whenever an edited cell intersects the watched range. The modified file watches Range(\"E4\", \"F15:I15\"), a two-argument Range that spans the rectangle E4:I15. The textbook original watched only E4.",
        "code": "Private Sub Worksheet_Change(ByVal Target As Range)\n    If Intersect(Target, Range(\"E4\", \"F15:I15\")) Is Nothing Then\n        Exit Sub\n    Else 'Alert level changed!\n        Call Filter_Alert\n    End If\nEnd Sub"
      },
      {
        "title": "Keep the dates fresh and the view tidy",
        "explanation": "In the class version, Proto!D20 =TODAY()+L20 adds fixed offsets (Proto!L20:L268, -100 to +100 days) and Model!D20 =Proto!D20. Each level therefore always has rows: 23 milestones at level 0, 14 at level 1, 37 at level 2 and 58 at level 3, with 117 not yet due. The file saved at level 1 shows exactly 14 rows (e.g. rows 34, 54, 62). The Learn sheet explains Custom Views: a 'Neat' view hides the working rows 6-17 (alert table and criteria list) and a 'Raw' view shows them."
      }
    ]
  },
  {
    "id": "grand-grocery-pivottable",
    "week": "W10",
    "title": "GrandGrocery.xlsx: summarising 360 sales records with a PivotTable and PivotChart",
    "overview": "Grand Grocery has downloaded a year of fictitious sales data (Data!B1:E361: Category, Product, Sales, Quarter) and wants to look at it overall, by quarter, by category and by product without writing formulas. The solution's PivotTable (PivotTable!B5:L95) shows Q2 sales by Product and Category, and a stacked-column PivotChart sits on its own sheet.",
    "takeaways": [
      "Map each business question to an area: what to restrict (report filter), what to list down (rows), what to compare across (columns) and what to total (values).",
      "One row per product means multi-category products are summed across their categories in the Grand Total column.",
      "The report filter re-slices the whole table (and its PivotChart) in one click - Q2 total 2,123,685; all quarters 8,951,630.",
      "PivotTables read a cache: refresh after changing the source data.",
      "Keep a formula route (SUMIFS) in reserve - exam templates are graded on cell values and formulas, not PivotTables."
    ],
    "steps": [
      {
        "title": "Inspect the source list",
        "explanation": "One header row with 360 records below it: 9 categories with 40 records each, 88 distinct products, and four quarters (Q1-Q4). Two products appear in two categories: Butter (Condiment and Dairy) and Chocolate (Beverage and Confection). This tidy one-header-row, one-record-per-row shape is what the PivotTable summarises."
      },
      {
        "title": "Create the PivotTable from the list",
        "explanation": "The pivot's source is Data!B1:E361, and its cache holds all 360 records. It is placed on its own PivotTable sheet in the classic grid layout, starting at B5, with the report filter above it in B3:C3."
      },
      {
        "title": "Drop the fields into the four areas",
        "explanation": "Quarter goes to the report filter (page field), Product to row labels (sorted A to Z), Category to column labels and Sales to values, where it is summarised as Sum of Sales.",
        "code": "Report filter : Quarter = Q2       (B3:C3)\nRow labels    : Product, A to Z    (B7:B94)\nColumn labels : Category           (C6:K6)\nValues        : Sum of Sales       (C7:K94)\nGrand totals  : row 95 and column L (L95 = 2,123,685)"
      },
      {
        "title": "Read the Q2 view",
        "explanation": "Row 95 gives each category's Q2 total: Beverage 155,718; Condiment 225,716; Confection 321,383 (highest); Dairy 218,544; Fruits 190,368; Grain 258,670; Meat/Poultry 289,186; Produce 244,057; Seafood 220,043. Grand total 2,123,685. Each product row has one filled cell, except Butter (32,565 + 30,953 = 63,518) and Chocolate (1,152 + 29,855 = 31,007)."
      },
      {
        "title": "Re-slice with the report filter",
        "explanation": "Choosing another quarter re-computes every cell. From the Data sheet the quarter totals are Q1 2,358,496; Q2 2,123,685; Q3 2,309,363; Q4 2,160,086, so selecting all quarters would show 8,951,630. Over the full year Dairy is the top category (1,127,239) and Beverage the lowest (803,749)."
      },
      {
        "title": "Chart it with a PivotChart",
        "explanation": "The PivotChart sheet holds a stacked column chart linked to PivotTable1. It has one series per category (9 series, legend on the right) and products along the axis. Because it reads the pivot, changing the Quarter filter redraws the chart."
      },
      {
        "title": "Refresh after the data changes",
        "explanation": "A PivotTable summarises its cache, not the live cells, so after editing Data you must Refresh. This file's cache still remembers two product names that no longer occur in any record (Powder milk, Skim milk), flagged as missing items. The Home sheet also asks how to get the original data back from a PivotTable: double-clicking a value cell (Show Details) lists the records behind that number on a new sheet."
      },
      {
        "title": "Cross-check a pivot number with a formula",
        "explanation": "Past exam solutions build summaries with SUMIF-style formulas rather than PivotTables, so it helps to verify a pivot cell by formula. These formulas are not in the workbook; they reproduce PivotTable!L95 and the Butter row total.",
        "code": "=SUMIFS(Data!$D$2:$D$361,Data!$E$2:$E$361,\"Q2\")                                 -> 2,123,685\n=SUMIFS(Data!$D$2:$D$361,Data!$C$2:$C$361,\"Butter\",Data!$E$2:$E$361,\"Q2\")   -> 63,518"
      }
    ]
  }
]
