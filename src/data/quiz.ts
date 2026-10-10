import type { QuizQuestion } from './types'

export const questions: readonly QuizQuestion[] = [
  {
    "id": "w1q1",
    "topic": "W1",
    "question": "In the Community Water Tank model, a tank must hold 30 cbm with width 2 m, and you try a height of 3 m. Base costs $10/sqm and sides cost $5/sqm. What is the total cost?",
    "options": [
      "$305",
      "$210",
      "$310",
      "$405"
    ],
    "answerIndex": 2,
    "explanation": "Length = 30/(2 x 3) = 5 m. Base area = 2 x 5 = 10 sqm; side area = 2 x (2+5) x 3 = 42 sqm. Cost = 10 x 10 + 42 x 5 = 100 + 210 = $310. ($305 is the tempting distractor — it is the true minimum, achieved at height 3.87 m, not 3 m.)"
  },
  {
    "id": "w1q2",
    "topic": "W1",
    "question": "SAM Bank's Year 1 actuals are customer deposits of $3.91b and 20 BIPS of low-end servers. What is the low-end server performance ratio in $b per BIPS?",
    "options": [
      "0.1955",
      "5.1150",
      "0.0489",
      "78.20"
    ],
    "answerIndex": 0,
    "explanation": "Performance ratio = Business Volume / # Equipment = 3.91/20 = 0.1955 $b per BIPS (Model!E27 =$C9/E9). 5.115 is the inverted ratio 20/3.91; 0.0489 is 3.91/80, the MID-range server ratio."
  },
  {
    "id": "w1q3",
    "topic": "W1",
    "question": "The Widget Division buys 25,000 couplers a year; processing an order costs $20 and carrying one coupler costs $4 per year. Using EOQ = SQRT(2DO/C), how many couplers should be ordered each time?",
    "options": [
      "250",
      "500",
      "1,000",
      "354"
    ],
    "answerIndex": 1,
    "explanation": "EOQ = SQRT(2 x 25,000 x 20 / 4) = SQRT(250,000) = 500 couplers, which means 25,000/500 = 50 orders per year. The model solution's formula pattern is =SQRT(2*B6*C6/D6) (Q1!E6); this 25,000-coupler case appears as test case (a) in row 12."
  },
  {
    "id": "w1q4",
    "topic": "W1",
    "question": "A product sells at $200 per unit, variable cost is 60% of the selling price, and fixed cost is $40,000. What is the break-even point in units sold?",
    "options": [
      "200 units",
      "333 units",
      "1,000 units",
      "500 units"
    ],
    "answerIndex": 3,
    "explanation": "Marginal contribution per unit = (1 - 0.6) x 200 = $80. Break-even units = 40,000/80 = 500 (formula =D5/((1-C5)*B5)). The break-even dollar volume is 40,000/(1-0.6) = $100,000."
  },
  {
    "id": "w1q5",
    "topic": "W1",
    "question": "Cell E27 contains =$C9/E9. When this formula is filled ONE column to the right into F27, what does F27 contain?",
    "options": [
      "=$C9/E9",
      "=$C9/F9",
      "=$D9/F9",
      "=$C10/E10"
    ],
    "answerIndex": 1,
    "explanation": "Filling right changes column letters only: $C is locked so it stays, but E9 is free and slides to F9. Row numbers never change on a horizontal fill — =$C10/E10 would result from filling DOWN with no locks."
  },
  {
    "id": "w1q6",
    "topic": "W1",
    "question": "A formula contains the mixed reference C$5. If the formula is copied one column right AND one row down, the reference becomes:",
    "options": [
      "D$5",
      "C$6",
      "D$6",
      "$C5"
    ],
    "answerIndex": 0,
    "explanation": "The $ sits before the row number, so row 5 is frozen; the column letter is free and moves from C to D. Result: D$5. (C$6 would require the row to move, which the $ prevents.)"
  },
  {
    "id": "w1q7",
    "topic": "W1",
    "question": "Following Excel's operator evaluation order, what does =3+2^2*2 return?",
    "options": [
      "50",
      "19",
      "11",
      "14"
    ],
    "answerIndex": 2,
    "explanation": "Precedence is parentheses; then negation, %, ^, * or /, + or -. So 2^2 = 4 first, then 4*2 = 8, then 3+8 = 11. Answer 50 assumes + binds first ((3+2)^2*2); 19 assumes * binds before ^ (2^(2*2))."
  },
  {
    "id": "w1q8",
    "topic": "W1",
    "question": "Which is the correct argument order for the TREND function?",
    "options": [
      "=TREND(known_y, known_x, new_x, [const])",
      "=TREND(known_x, known_y, new_x, [const])",
      "=TREND(new_x, known_x, known_y, [const])",
      "=TREND(known_y, new_x, known_x, [const])"
    ],
    "answerIndex": 0,
    "explanation": "TREND takes the known y-values FIRST, then the known x-values, then the new x at which to predict — e.g. =TREND(E26:E35, C26:C35, C36). The optional const computes the intercept b when TRUE/omitted and forces b=0 when FALSE."
  },
  {
    "id": "w1q9",
    "topic": "W1",
    "question": "Which anchoring lets a TREND projection be filled BOTH right across the seven asset columns AND down the five projected years (Method 1 in Data Centre Assets)?",
    "options": [
      "=TREND($E$27:$E$36,$C$27:$C$36,$C$37)",
      "=TREND(E27:E36,C27:C36,C37)",
      "=TREND($E27:$E36,C$27:C$36,C37)",
      "=TREND(E$27:E$36,$C$27:$C$36,$C37)"
    ],
    "answerIndex": 3,
    "explanation": "Method 1 uses seven $ signs: E$27:E$36 locks the ROWS of known_y (fill down keeps the 10-year history but fill right moves to the next asset), $C$27:$C$36 fully locks known_x on the deposits column, and $C37 locks only the column of new_x so it advances down each projected year. Fully locking everything (option 1) would freeze new_x and give the same prediction in every row."
  },
  {
    "id": "w1q10",
    "topic": "W1",
    "question": "Method 2 anchoring (five $ signs) grows the known range so the just-predicted value becomes an eleventh known point. Why do the slides call it 'correct but adds no value'?",
    "options": [
      "Because it changes the slope of the fitted line in every row",
      "Because the predicted 11th value already lies exactly on the fitted line, so including it leaves the least-squares fit unchanged",
      "Because TREND cannot accept more than 10 known points",
      "Because it forces the intercept through zero"
    ],
    "answerIndex": 1,
    "explanation": "A TREND prediction is by construction a point ON the least-squares line, so refitting with it included returns the identical line — extra complexity, same numbers. Changing slopes describes Method 3 (3 $ signs, rolling window), whose verdict is 'Depends'."
  },
  {
    "id": "w1q11",
    "topic": "W1",
    "question": "Which statement about the Auto-Fill function is correct?",
    "options": [
      "It copies formulas into adjacent cells, adjusting relative references",
      "It repeats the last selected value unchanged",
      "It writes values (not formulas) from a least-squares straight-line fit through the selected points, assuming they are equally spaced on the x-axis",
      "It fits an exponential growth curve to the selected points"
    ],
    "answerIndex": 2,
    "explanation": "Auto-Fill extrapolates a least-squares straight line and deposits static VALUES — no formulas, so nothing recalculates later — and it assumes equal x-spacing. Option 1 describes the ordinary Fill function, which does copy formulas."
  },
  {
    "id": "w1q12",
    "topic": "W1",
    "question": "In Data Centre Assets, why is directly Auto-Filling the IT asset columns to project future holdings the wrong approach?",
    "options": [
      "Asset requirements are driven by business volume through a performance ratio, not by a straight line in time — blind extrapolation risks expensive over-purchase or obsolescence now that growth has slowed",
      "Auto-Fill cannot operate on columns of more than 10 numbers",
      "The worksheet is protected, so Auto-Fill is disabled",
      "TREND overwrites Auto-Fill results automatically"
    ],
    "answerIndex": 0,
    "explanation": "The case's advice says past acquisitions were crude but good enough while growth was fast; now that growth is slowing, rough straight-line planning risks buying equipment too soon, costly over-buying, or kit that goes obsolete. The correct 3-step route: compute ratios, project ratios with TREND, then divide projected volume by the planned ratio."
  },
  {
    "id": "w1q13",
    "topic": "W1",
    "question": "In the blackbox view of the Community Water Tank model, Tank Height is classified as a:",
    "options": [
      "Parameter",
      "Decision",
      "Consequence variable",
      "Performance measure"
    ],
    "answerIndex": 1,
    "explanation": "Height is the input Sammy controls — the Decision. The Parameters are the required 30 cbm volume, the fixed 2 m width, and the $10/$5 unit costs; Tank Length, Base Area and Wall Area are Consequence variables; Cost of Tank is the Performance measure."
  },
  {
    "id": "w1q14",
    "topic": "W1",
    "question": "According to the Assignment 0 model solution's evaluation notes, what must a proper Documentation block contain?",
    "options": [
      "Every single cell used anywhere in the worksheet",
      "Only the final answer cells",
      "All input and referenced cells, plus every unique formula cell — with cell referencing chosen so the formulas still work when copied — readable from the printed copy alone",
      "Only a list of the chart settings and colour choices"
    ],
    "answerIndex": 2,
    "explanation": "The evaluation notes say documentation 'does not need to list all cells', but it MUST contain all input and referenced cells and all unique formula cells with appropriate referencing ('cell formulas when copied to other cells must still work'), and be readable using just the printed copy without row and column headers. Inputs are marked '<Input>'."
  },
  {
    "id": "w2q1",
    "topic": "W2",
    "question": "In spreadsheet engineering, what is the correct order of the three basic model-building steps?",
    "options": [
      "Formulate the Relationships (Influence Diagram) → Frame What You Understand (Black Box) → Construct the Model (Spreadsheet)",
      "Construct the Model → Formulate the Relationships → Frame What You Understand",
      "Frame What You Understand → Construct the Model → Formulate the Relationships",
      "Construct the Model → run Solver → draw the Influence Diagram"
    ],
    "answerIndex": 0,
    "explanation": "You first formulate the relationships with an influence diagram, then frame the inputs/outputs with a black box view, and only then construct the spreadsheet model. Building the spreadsheet first invites structural errors that the two schematic models are designed to prevent."
  },
  {
    "id": "w2q2",
    "topic": "W2",
    "question": "In the blackbox model, an input variable with a given or assumed value that the user cannot control is called a:",
    "options": [
      "Decision",
      "Consequence Variable",
      "Parameter",
      "Performance Measure"
    ],
    "answerIndex": 2,
    "explanation": "Parameters are uncontrollable inputs with given values (e.g., Printer Unit Cost, Fixed Cost). Decisions are controllable inputs; Performance Measures and Consequence Variables are outputs, not inputs."
  },
  {
    "id": "w2q3",
    "topic": "W2",
    "question": "When building an influence diagram, where do you start?",
    "options": [
      "With the decision variables, working forward to outputs",
      "With the performance measure, decomposing it into intermediate variables until decision variables are reached",
      "With the parameters, since they are given",
      "With the spreadsheet layout, so cells map to nodes"
    ],
    "answerIndex": 1,
    "explanation": "The slides prescribe starting with the performance measure (e.g., Profit), decomposing it into two or more intermediate variables (demand, revenue, cost) that combine mathematically, and continuing until an input decision variable (Price) is defined."
  },
  {
    "id": "w2q4",
    "topic": "W2",
    "question": "Which statement about Goal Seek is TRUE?",
    "options": [
      "It can maximize a target cell by changing several inputs",
      "It finds the input values for multiple cells simultaneously",
      "It requires constraints on the changing cell",
      "It can only drive one cell to a specific target value by changing exactly one input cell — it cannot maximize or minimize"
    ],
    "answerIndex": 3,
    "explanation": "Goal Seek 'calculates backward': you fix the result one formula must reach and Excel searches for the input that produces it. Its limits are one changing cell and a fixed target value only. Maximizing/minimizing or multiple variables and constraints require Solver."
  },
  {
    "id": "w2q5",
    "topic": "W2",
    "question": "Which tool searches for an optimal solution involving several variables, subject to constraints?",
    "options": [
      "Solver",
      "Goal Seek",
      "Data Table",
      "Format Trendline"
    ],
    "answerIndex": 0,
    "explanation": "Solver maximizes, minimizes or sets an objective cell to a value by adjusting decision variable cells while keeping constraints within their limits. Goal Seek handles only one input and one target; a Data Table only tabulates results."
  },
  {
    "id": "w2q6",
    "topic": "W2",
    "question": "Using the printer price-demand function y = -0.06x + 10 (y in '000 units), what is printer demand at a price of $60?",
    "options": [
      "7,000 units",
      "6,400 units",
      "6.4 units",
      "3,600 units"
    ],
    "answerIndex": 1,
    "explanation": "Demand = 10 - 0.06 x 60 = 10 - 3.6 = 6.4 thousand = 6,400 printers. Watch the units: y is measured in thousands, so 6.4 means 6,400, not 6.4 units. 3,600 is the amount lost (0.06 x 60), not the demand."
  },
  {
    "id": "w2q7",
    "topic": "W2",
    "question": "With printer price $60, cartridge price $20, printer demand 6.4k, cartridge demand 38.4k, unit costs $55 and $12, and fixed cost $70k, what is profit?",
    "options": [
      "$339,200",
      "$1,152,000",
      "$269,200",
      "$882,800"
    ],
    "answerIndex": 2,
    "explanation": "Revenue = 60x6.4 + 20x38.4 = 384 + 768 = 1,152k. Cost = 55x6.4 + 12x38.4 + 70 = 352 + 460.8 + 70 = 882.8k. Profit = 1,152 - 882.8 = 269.2k = $269,200. $339,200 forgets the fixed cost; $1,152,000 is revenue; $882,800 is total cost."
  },
  {
    "id": "w2q8",
    "topic": "W2",
    "question": "In Invest in Education, Lower primary has 50 students, expected return $600 per student and default probability 0.05. What is the level's expected return?",
    "options": [
      "$28,500",
      "$30,000",
      "$1,500",
      "$25,000"
    ],
    "answerIndex": 0,
    "explanation": "E[Return] = (1 - 0.05) x 50 x 600 = 0.95 x 30,000 = $28,500 (formula C11 = (1-C$21)*C$16*C20). $30,000 ignores defaults; $1,500 is the defaulted portion; $25,000 is the investment (50 x $500), not the return."
  },
  {
    "id": "w2q9",
    "topic": "W2",
    "question": "In the Invest in Education model, which education level yields the highest expected margin in dollars?",
    "options": [
      "Technical degree",
      "Upper primary, at $7,800",
      "Lower primary",
      "Professional degree"
    ],
    "answerIndex": 1,
    "explanation": "Upper primary (50 students) earns E[Margin] = 52,800 - 45,000 = $7,800, the largest dollar margin. Technical degree has the highest margin PERCENTAGE (23.15%) but only $2,847 in dollars because just 3 students are sponsored — dollar margin and margin % rank levels differently."
  },
  {
    "id": "w2q10",
    "topic": "W2",
    "question": "In the sensitivity model, demand = IF(cartridge price > 0.67 x printer price, 0, 10.6 - 0.06 x printer price). With printer price $90 and cartridge price $70, what is printer demand?",
    "options": [
      "5,200 units",
      "5.2 thousand units",
      "10,600 units",
      "0 units"
    ],
    "answerIndex": 3,
    "explanation": "The threshold is 0.67 x 90 = $60.30. Since the cartridge price $70 exceeds $60.30, the IF condition is TRUE and demand is 0 — customers reject the bait & hook when cartridges are too dear. Only if the cartridge were $60.30 or less would demand be 10.6 - 0.06x90 = 5.2 thousand."
  },
  {
    "id": "w2q11",
    "topic": "W2",
    "question": "Changing the demand-curve slope (an uncontrollable assumption) to see its effect on profit is an example of:",
    "options": [
      "Trade-off analysis",
      "Breakeven analysis",
      "Sensitivity analysis",
      "Goal seeking"
    ],
    "answerIndex": 2,
    "explanation": "Sensitivity analysis varies UNCONTROLLABLE parameters (like the slope or cartridges-per-printer). Trade-off analysis varies DECISION variables (like printer price). Breakeven drives profit to zero; Goal Seek is a tool, not an analysis type."
  },
  {
    "id": "w2q12",
    "topic": "W2",
    "question": "The two-way Data Table in the printer sensitivity study varies which two parameters?",
    "options": [
      "Demand-curve slope and cartridges sold per printer",
      "Printer price and cartridge price",
      "Printer unit cost and fixed cost",
      "Demand intercept and printer price"
    ],
    "answerIndex": 0,
    "explanation": "The Model(2) table puts the demand slope (-0.12 to -0.01) across the row and cartridges-per-printer (4.6 to 6.8) down the column, with the corner cell = Profit. Printer/cartridge prices are decisions, so varying them would be trade-off analysis, not sensitivity."
  },
  {
    "id": "w2q13",
    "topic": "W2",
    "question": "When Solver maximizes profit in the ROUGH printer model (no price-demand relationship), what answer does it give for the optimal printer price?",
    "options": [
      "$95.98",
      "Infinity — because demand does not depend on price",
      "$165.00",
      "$26.96"
    ],
    "answerIndex": 1,
    "explanation": "With demand fixed regardless of price, raising the price raises profit forever, so Solver runs to infinity. This absurd result is the lesson: the model must capture the price-demand relationship. $95.98 is the optimum AFTER the relationship is added; $26.96 and $165.00 are the breakeven prices."
  },
  {
    "id": "w2q14",
    "topic": "W2",
    "question": "To find the breakeven printer price with Goal Seek, given Profit in C27 and Printer price in C5, the correct settings are:",
    "options": [
      "Set cell C5, To value 0, By changing C27",
      "Set cell C27, To value MAX, By changing C5",
      "Set cell C27, To value 0, By changing cell C5",
      "Set cell C27, To value 0, By changing C5 and C6"
    ],
    "answerIndex": 2,
    "explanation": "Breakeven means Profit = 0, so the Set cell is the formula cell C27, the target value is 0, and the single changing cell is the input C5. Goal Seek has no MAX option and cannot change two cells — those would need Solver. (C27 is the slides' address for Profit, taken from the Proto sheet; on the final Model sheet Profit sits in C32.)"
  },
  {
    "id": "w2q15",
    "topic": "W2",
    "question": "At printer price $60 (cost $55) and cartridge price $20 (cost $12), what are the unit profit margins, computed as (price - cost)/cost?",
    "options": [
      "Printer 8.3%, cartridge 40.0%",
      "Printer 5.0%, cartridge 8.0%",
      "Printer 66.7%, cartridge 9.1%",
      "Printer 9.1%, cartridge 66.7%"
    ],
    "answerIndex": 3,
    "explanation": "Printer: (60-55)/55 = 5/55 = 9.1%. Cartridge: (20-12)/12 = 8/12 = 66.7%. The thin printer margin and fat cartridge margin are the numerical signature of the bait & hook strategy. 8.3%/40% would result from dividing by price instead of cost."
  },
  {
    "id": "w3q1",
    "topic": "W3",
    "question": "Which three components must every linear programming model contain?",
    "options": [
      "Inputs, macros, and pivot tables",
      "Decision variables, constraints, and an objective function",
      "Parameters, charts, and scenarios",
      "A data table, a lookup table, and a solver table"
    ],
    "answerIndex": 1,
    "explanation": "An LP model is defined by its decision variables (inputs the optimizer can change), constraints (restrictions defining the feasible region), and a single objective function to maximize or minimize."
  },
  {
    "id": "w3q2",
    "topic": "W3",
    "question": "If a linear program has a unique optimal solution, where must that solution be located?",
    "options": [
      "At the centroid of the feasible region",
      "Anywhere strictly inside the feasible region",
      "At a corner point of the feasible region",
      "On the longest edge of the feasible region"
    ],
    "answerIndex": 2,
    "explanation": "A fundamental LP result: when a unique optimum exists it must occur at a corner (extreme) point of the feasible region, because the linear objective improves monotonically until it leaves the region."
  },
  {
    "id": "w3q3",
    "topic": "W3",
    "question": "When does a linear program have multiple optimal solutions?",
    "options": [
      "When the objective function line lies exactly on one of the constraint boundaries",
      "When there are more constraints than decision variables",
      "When all decision variables are integers",
      "When two constraints intersect at a single point"
    ],
    "answerIndex": 0,
    "explanation": "If the objective line is parallel to and coincides with a binding constraint edge, every point on that edge achieves the same optimal value, giving infinitely many optima."
  },
  {
    "id": "w3q4",
    "topic": "W3",
    "question": "A minimization LP has a feasible region that is unbounded in the direction that keeps improving the objective. What is the outcome?",
    "options": [
      "Solver reports the smallest corner-point value",
      "The optimal cost is minus infinity (unbounded)",
      "There are no feasible solutions",
      "The problem automatically becomes a maximization"
    ],
    "answerIndex": 1,
    "explanation": "With an unbounded feasible region in the improving direction, the objective can decrease without limit, so the optimal cost is minus infinity; for maximization the analogous case gives plus infinity."
  },
  {
    "id": "w3q5",
    "topic": "W3",
    "question": "In Excel Solver, integer (int) and binary (bin) constraints may be applied to which cells?",
    "options": [
      "Any calculated cell in the model",
      "Only the objective cell",
      "Only decision variable (changing) cells",
      "Only constraint right-hand-side cells"
    ],
    "answerIndex": 2,
    "explanation": "Integer and binary constraints restrict what values Solver may assign, so they only make sense on the changing cells; calculated quantities like total cost are determined by formulas and cannot be directly constrained to integers."
  },
  {
    "id": "w3q6",
    "topic": "W3",
    "question": "The array A1:A4 contains {1, 3, 5, 8}. What does =MATCH(2, A1:A4, 1) return?",
    "options": [
      "1",
      "2",
      "3",
      "#N/A"
    ],
    "answerIndex": 0,
    "explanation": "Match_type 1 (the default) finds the largest value less than or equal to the lookup_value on ascending data. The largest value <= 2 is 1, which sits in position 1, so MATCH returns 1."
  },
  {
    "id": "w3q7",
    "topic": "W3",
    "question": "What does VLOOKUP do when range_lookup is FALSE?",
    "options": [
      "It returns the largest value less than or equal to the lookup_value",
      "It returns the first exact match, or #N/A if none exists, and the data need not be sorted",
      "It requires the first column to be sorted descending",
      "It returns the last exact match in the table"
    ],
    "answerIndex": 1,
    "explanation": "FALSE forces exact matching: VLOOKUP scans the leftmost column in any order and returns the value from col_index_num for the first exact match, or #N/A when the value is absent."
  },
  {
    "id": "w3q8",
    "topic": "W3",
    "question": "Before XLOOKUP, which function could perform an approximate match on data sorted in DESCENDING order?",
    "options": [
      "VLOOKUP with range_lookup TRUE",
      "LOOKUP",
      "MATCH with match_type -1",
      "INDEX on its own"
    ],
    "answerIndex": 2,
    "explanation": "LOOKUP and approximate VLOOKUP both require ascending data. Only MATCH with match_type -1 handles descending data, finding the smallest value greater than or equal to the lookup_value."
  },
  {
    "id": "w3q9",
    "topic": "W3",
    "question": "In CasinoHotel.xlsx, gross space is 50000, stage space is 5000, and dining space is 5000. What net space is available for guests (cell J17)?",
    "options": [
      "50000",
      "45000",
      "40000",
      "60000"
    ],
    "answerIndex": 2,
    "explanation": "J17 = SUM(J9,-J10,-J11) = 50000 - 5000 - 5000 = 40000. Total floor space required by guests (H17) must not exceed this 40000."
  },
  {
    "id": "w3q10",
    "topic": "W3",
    "question": "A slot machine player generates $150 base revenue, $30 food revenue, and $1 direct expense per day. What is the total daily net contribution of 500 slot machine players?",
    "options": [
      "$90,000",
      "$89,500",
      "$74,500",
      "$90,500"
    ],
    "answerIndex": 1,
    "explanation": "Net contribution per guest = 150 + 30 - 1 = $179 per day. For 500 guests: 500 x 179 = $89,500. This mirrors how rows 18-20 of the model multiply guests by per-guest rates before summing."
  },
  {
    "id": "w3q11",
    "topic": "W3",
    "question": "What is the default match_mode of XLOOKUP?",
    "options": [
      "0 — exact match",
      "-1 — exact match or next smaller item",
      "1 — exact match or next larger item",
      "2 — wildcard match"
    ],
    "answerIndex": 0,
    "explanation": "Unlike VLOOKUP (which defaults to approximate match), XLOOKUP defaults to exact match (match_mode 0) and returns #N/A, or the if_not_found value, when the item is missing."
  },
  {
    "id": "w3q12",
    "topic": "W3",
    "question": "Lookup_array B3:B9 = {4, 5, 3, 1, 6, 8, 3} and return_array C3:C9 = {A, B, C, D, E, F, G}. What does =XLOOKUP(2, B3:B9, C3:C9, \"Duh\", -1) return?",
    "options": [
      "\"Duh\"",
      "C",
      "D",
      "#N/A"
    ],
    "answerIndex": 2,
    "explanation": "match_mode -1 means exact match or next smaller item. There is no 2, so XLOOKUP falls back to the largest value below 2, which is 1, and returns its paired value D. The if_not_found text is only used when even the fallback fails."
  },
  {
    "id": "w3q13",
    "topic": "W3",
    "question": "In an IFS formula, how do you provide a default (catch-all) result when none of the earlier conditions are true?",
    "options": [
      "Add ELSE as the last argument",
      "Use TRUE as the final condition with the default value after it",
      "Leave the last value argument empty",
      "IFS automatically returns 0 when nothing matches"
    ],
    "answerIndex": 1,
    "explanation": "IFS has no built-in else, so the idiom is a final pair TRUE, default_value — e.g. =IFS(A1<0,0,A1>100,100,TRUE,A1) returns A1 itself when it is already within 0-100."
  },
  {
    "id": "w3q14",
    "topic": "W3",
    "question": "A formula such as =INDEX(G21:J70, MATCH(B17,B21:B70,0), 0) spills an entire row into neighboring cells. What does the Week 3 material tell you to do so it returns only a single value instead of spilling?",
    "options": [
      "Wrap it in TRANSPOSE()",
      "Add a $ in front of every cell reference",
      "Add the @ operator in front of the formula",
      "Change match_type to 1"
    ],
    "answerIndex": 2,
    "explanation": "The @ operator (implicit intersection) undoes the spill and returns a single value. TRANSPOSE would only turn the spilled row into a spilled column, $ signs merely anchor references, and match_type 1 changes how the row is found, not whether the result spills. Column_num 0 is what makes INDEX return the whole row; spill formulas replaced the old Ctrl+Shift+Enter array formulas."
  },
  {
    "id": "w4q1",
    "topic": "W4",
    "question": "Which pair of Excel financial functions is designed for UNEVEN cash flows?",
    "options": [
      "PMT() and PV()",
      "NPV() and IRR()",
      "RATE() and NPER()",
      "FV() and PMT()"
    ],
    "answerIndex": 1,
    "explanation": "Group 1 functions (PMT, PV, FV, RATE, NPER) all assume constant periodic cash flows. Only NPV() and IRR() accept a series of different values, one per period."
  },
  {
    "id": "w4q2",
    "topic": "W4",
    "question": "Under Excel's sign convention, a NEGATIVE amount means:",
    "options": [
      "The formula contains an error",
      "Money added to the point of reference",
      "Money taken away from the point of reference",
      "The interest rate is negative"
    ],
    "answerIndex": 2,
    "explanation": "Negative = money leaving the point of reference (e.g., payments you make); positive = money coming in. That is why PMT() on a positive loan pv returns a negative payment."
  },
  {
    "id": "w4q3",
    "topic": "W4",
    "question": "What does =PMT(8%/12, 10, 10000) return for a $10,000 loan at 8% p.a. repaid in 10 monthly payments?",
    "options": [
      "-$1,037.03",
      "-$1,000.00",
      "-$1,363.15",
      "+$1,037.03"
    ],
    "answerIndex": 0,
    "explanation": "The annual 8% is divided by 12 to get the monthly rate, and 10 monthly periods amortize the $10,000: the payment is -$1,037.03 (negative because it leaves the borrower). -$1,363.15 is the answer to a different problem, PMT(8%,6,0,10000)."
  },
  {
    "id": "w4q4",
    "topic": "W4",
    "question": "You borrow $140,000 for 5 years at 5% p.a. (monthly rest), paying 60 equal monthly payments plus a $10,000 balloon with the last payment. Which formula gives the monthly payment?",
    "options": [
      "=PMT(5%, 60, 140000, 10000)",
      "=PMT(5%/12, 60, 140000, -10000)",
      "=PMT(5%/12, 60, -140000, 10000, 1)",
      "=PMT(5%/12, 5, 140000, -10000)"
    ],
    "answerIndex": 1,
    "explanation": "Monthly payments require the monthly rate 5%/12 with nper 60. From the borrower's reference the loan received is +140000 and the balloon still owed at the end is -10000. This matches TimeValue.xlsm PMT sheet F12 =PMT(B12/12,C12,D12,E12)."
  },
  {
    "id": "w4q5",
    "topic": "W4",
    "question": "In =PV(3%/12, 9, -3500, -600, 1), what does the final argument 1 signify?",
    "options": [
      "One extra payment is added",
      "Withdrawals occur at the beginning of each month",
      "The result is rounded to 1 decimal place",
      "Interest compounds once per year"
    ],
    "answerIndex": 1,
    "explanation": "The [type] argument controls timing: 0 (default) = end of period, 1 = beginning of period. The overseas-exchange exercise needs $3,500 at the START of each month, so type must be 1."
  },
  {
    "id": "w4q6",
    "topic": "W4",
    "question": "Depositing $100 at the end of each month for 10 months at 8% p.a., starting with $300 already in the account, gives what future value (=FV(8%/12,10,-100,-300))?",
    "options": [
      "$1,030.54",
      "$1,300.00",
      "$1,351.15",
      "$1,188.44"
    ],
    "answerIndex": 2,
    "explanation": "Without the initial $300, FV(8%/12,10,-100) = $1,030.54; adding the -300 pv compounds the opening balance too, giving $1,351.15. ($1,188.44 is the NPV example's answer.)"
  },
  {
    "id": "w4q7",
    "topic": "W4",
    "question": "RATE() returns #NUM! when:",
    "options": [
      "The pv argument is negative",
      "Successive iterative answers do not converge to within 0.0000001 after 20 iterations",
      "nper exceeds 254 periods",
      "The guess argument is omitted"
    ],
    "answerIndex": 1,
    "explanation": "RATE is solved iteratively from the guess (default 10%). If after 20 iterations the answers have not converged within 0.0000001, Excel gives up with #NUM!. Omitting the guess is fine — 10% is assumed."
  },
  {
    "id": "w4q8",
    "topic": "W4",
    "question": "NPER(12%, -100, -1000) returns about -6.96 years. What is the correct interpretation?",
    "options": [
      "The investment doubles in 6.96 years",
      "Excel made a rounding error",
      "The answer is mathematically returned but is nonsense — Excel accepts any signs, so the modeler must judge if the result makes sense",
      "You must add 6.96 to nper to fix it"
    ],
    "answerIndex": 2,
    "explanation": "With no fv target, depositing money forever has no meaningful 'number of periods'. Excel does not police sign combinations — it returns whatever the equation yields, and the modeler must recognize nonsense results. (The exact value is -6.957; the slide prints it as -6.95.)"
  },
  {
    "id": "w4q9",
    "topic": "W4",
    "question": "A project requires $200,000 invested TODAY followed by returns at each year end. How is the $200,000 handled with NPV()?",
    "options": [
      "Include it as the first value inside NPV()",
      "Exclude it from NPV() and add it to the NPV() result, e.g. =NPV(8%, C15:C24)+C14",
      "Divide it by (1+rate) before including it",
      "Exclude it entirely from the analysis"
    ],
    "answerIndex": 1,
    "explanation": "NPV() assumes value1 sits at the END of period 1. Money spent today (end of period 0) is already at present value, so it stays out of the arguments and is added directly: =NPV(B10,C15:C24)+C14 in TimeValue.xlsm."
  },
  {
    "id": "w4q10",
    "topic": "W4",
    "question": "What is NPV(10%, -10000, 3000, 4200, 6800)?",
    "options": [
      "$4,000.00",
      "$1,188.44",
      "-$1,188.44",
      "$1,922.06"
    ],
    "answerIndex": 1,
    "explanation": "Each cash flow is discounted by (1+10%)^n: -9,090.91 + 2,479.34 + 3,155.52 + 4,644.49 = $1,188.44. Note the -10,000 here is at the END of year 1, so it belongs inside NPV()."
  },
  {
    "id": "w4q11",
    "topic": "W4",
    "question": "Which condition must the values passed to IRR() satisfy?",
    "options": [
      "All values must be positive",
      "At least one positive and at least one negative value, equally spaced at end of period",
      "Exactly 20 values",
      "The first value must be zero"
    ],
    "answerIndex": 1,
    "explanation": "IRR needs a sign change to have a root (a rate where NPV = 0), and it assumes the cash flows occur at the end of equally spaced periods. Unlike NPV usage, the initial outflow IS included in the range: =IRR(C14:C24)."
  },
  {
    "id": "w4q12",
    "topic": "W4",
    "question": "In a TWO-variable data table, where must the formula be placed?",
    "options": [
      "In the top-left cell at the intersection of the row of input values and the column of input values",
      "One row above and one column to the right of the inputs",
      "In any empty cell outside the table",
      "In the bottom-right corner of the grid"
    ],
    "answerIndex": 0,
    "explanation": "For two-variable tables the formula goes in the intersection (top-left) cell, with one input's values across the top row and the other's down the left column; then both Row and Column input cells are specified. The 'one row above, one column right' layout is for ONE-variable column-oriented tables."
  },
  {
    "id": "w4q13",
    "topic": "W4",
    "question": "In the Charity Donation model (Revenue $180,000, Cost $108,500, tax 25%, donation 10% of after-tax profit, donation tax-deductible), the donation converges to approximately:",
    "options": [
      "$7,150",
      "$5,363",
      "$4,988",
      "$6,500"
    ],
    "answerIndex": 2,
    "explanation": "C = 0.1 × (1−0.25) × (71,500 − C) = 0.075 × (71,500 − C), so 1.075C = 5,362.50 and C ≈ $4,988.37. $5,363 is what you get if you forget the donation reduces its own base (0.075 × 71,500)."
  },
  {
    "id": "w4q14",
    "topic": "W4",
    "question": "How do you make Excel resolve the Charity Donation circular reference instead of showing a warning?",
    "options": [
      "Wrap the formula in IFERROR()",
      "Enable iterative calculation in Excel Options/Formulas and reduce Maximum change to 0.0001",
      "Press F9 repeatedly",
      "Convert all formulas to values"
    ],
    "answerIndex": 1,
    "explanation": "Circular references can only be resolved by iteration: tick 'Enable iterative calculation' under File/Options/Formulas and tighten the Maximum change parameter to 0.0001, as noted in CharityDonation.xlsx. Excel then recalculates until successive changes are below the threshold."
  },
  {
    "id": "w4q15",
    "topic": "W4",
    "question": "What does NORMSDIST(0) return, and why?",
    "options": [
      "0, because the mean has zero probability",
      "0.5, because half of the standard Normal distribution lies below the mean",
      "1, because 0 is the maximum z value",
      "0.3989, the height of the density at 0"
    ],
    "answerIndex": 1,
    "explanation": "NORMSDIST is the CUMULATIVE standard Normal distribution (mean 0, sd 1). At z = 0 exactly half the area lies to the left, so it returns 0.5. (0.3989 is the density height, not the cumulative probability.)"
  },
  {
    "id": "w4q16",
    "topic": "W4",
    "question": "Which is the Black-Scholes CALL option price formula?",
    "options": [
      "Call = S·N(d1) − X·exp(−rf·t)·N(d2)",
      "Call = −S·N(−d1) + X·exp(−rf·t)·N(−d2)",
      "Call = X·N(d1) − S·exp(−rf·t)·N(d2)",
      "Call = S·exp(−rf·t) − X·N(d1)"
    ],
    "answerIndex": 0,
    "explanation": "The call is S·N(d1) − X·exp(−rf·t)·N(d2), implemented in BlackScholes.xlsm as D15 =D4*D13-D5*EXP(-D6*D8)*D14. Option B is the PUT formula."
  },
  {
    "id": "w5q1",
    "topic": "W5",
    "question": "Which statement about RAND() and RANDBETWEEN() is correct?",
    "options": [
      "RAND() returns a real number in [0, 1.0) and is used as a cumulative probability; RANDBETWEEN(bottom, top) returns an integer inclusive of both bounds and is used as a position number",
      "RAND() returns an integer between 0 and 1; RANDBETWEEN returns a real number between its bounds",
      "Both functions return real numbers, but RANDBETWEEN excludes its upper bound",
      "RAND() can return exactly 1.0, while RANDBETWEEN excludes the top value"
    ],
    "answerIndex": 0,
    "explanation": "RAND() generates a continuous uniform value in [0, 1.0) — it can be 0 but never 1 — which is why it can stand in for a cumulative probability. RANDBETWEEN(bottom, top) generates a discrete uniform integer inclusive of both endpoints, useful as a random position (e.g. which data point to resample)."
  },
  {
    "id": "w5q2",
    "topic": "W5",
    "question": "Why can a RAND() draw be equated to a cumulative probability when performing a Monte Carlo trial?",
    "options": [
      "Because RAND() is normally distributed around 0.5",
      "Because cumulative probability always lies between 0 and 1.0, the same range RAND() generates in",
      "Because Excel automatically sorts RAND() values before using them",
      "Because RAND() returns the most likely value of the distribution"
    ],
    "answerIndex": 1,
    "explanation": "A CDF maps any outcome to a value between 0 and 1.0. Since RAND() is uniform on [0,1), drawing RAND() and mapping it back through the CDF (or a CRF table) samples each outcome with exactly its intended probability. This is the foundation of both the CRF lookup (M1) and inversion (M3) methods."
  },
  {
    "id": "w5q3",
    "topic": "W5",
    "question": "A CRF table for number of children has boundaries 0 / 0.381 / 0.667 / 0.869 / 0.964 for values 0, 1, 2, 3, 4. If RAND() returns 0.556, what is the simulated number of children?",
    "options": [
      "0",
      "1",
      "2",
      "3"
    ],
    "answerIndex": 1,
    "explanation": "LOOKUP finds the largest boundary less than or equal to 0.556, which is 0.381 — the row for value 1. In other words 0.556 falls in the interval [0.381, 0.667), so the simulated value is 1 child. This is why the CRF column is down-shifted one row relative to the values."
  },
  {
    "id": "w5q4",
    "topic": "W5",
    "question": "When using LOOKUP with a CRF table, why must the CRF column be shifted down one row relative to the values column?",
    "options": [
      "Because Excel lookups are 1-indexed rather than 0-indexed",
      "Because LOOKUP finds the largest lookup value less than or equal to the target, so each value must be paired with the cumulative probability of all values below it",
      "Because LOOKUP scans the lookup_vector from the bottom row upward",
      "Because CRF values must be sorted in descending order"
    ],
    "answerIndex": 1,
    "explanation": "LOOKUP matches the largest CRF that is <= RAND(). A value X should be selected when RAND() lands anywhere in [CRF below X, CRF up to X), so X must sit next to the LOWER boundary. DataSim codes this as =LOOKUP(RAND(),M$12:M$32,L$13:L$33) with the value range starting one row lower."
  },
  {
    "id": "w5q5",
    "topic": "W5",
    "question": "A sample of N=25 discrete values has frequencies: value 1 appears 3 times, value 2 appears 10 times, value 3 appears 10 times, value 4 appears 2 times. Using X' = SMALL(data, RANDBETWEEN(1,25)), what is X' if RANDBETWEEN returns 8?",
    "options": [
      "1",
      "2",
      "3",
      "4"
    ],
    "answerIndex": 1,
    "explanation": "SMALL returns the 8th smallest value. Positions 1-3 are the three 1s and positions 4-13 are the ten 2s, so the 8th smallest is 2. This is method M2a: each of the 25 original observations is equally likely to be drawn, so values recur in proportion to their sample frequency."
  },
  {
    "id": "w5q6",
    "topic": "W5",
    "question": "Sorted sample data 1.0, 3.0, 5.0, 7.0 sit at percentiles 0, 1/3, 2/3, 1. What does X' = PERCENTILE(data, RAND()) return when RAND() = 0.5?",
    "options": [
      "3.0",
      "3.5",
      "4.0",
      "5.0"
    ],
    "answerIndex": 2,
    "explanation": "0.5 lies halfway between percentiles 1/3 and 2/3, so Excel interpolates linearly: (0.5 − 1/3)/(2/3 − 1/3) = (X' − 3.0)/(5.0 − 3.0), giving X' = 3.0 + 0.5 × 2.0 = 4.0. This interpolation is what makes M2b suitable for continuous data — it can generate values not present in the original sample."
  },
  {
    "id": "w5q7",
    "topic": "W5",
    "question": "The inversion of the Exponential CDF Y = 1 − e^(−λx) gives x = −(1/λ)ln(1−Y). Why is X' = −mean*LN(RAND()) also a valid simulation formula?",
    "options": [
      "Because LN(RAND()) = LN(1−RAND()) for all inputs",
      "Because 1−RAND() is itself a uniform random number on the same range, so replacing it with RAND() draws from the same distribution",
      "Because the exponential distribution is symmetric about its mean",
      "Because Excel evaluates RAND() twice and averages the results"
    ],
    "answerIndex": 1,
    "explanation": "If U is uniform on [0,1), then 1−U is uniform on (0,1]. Both feed every cumulative probability equally often into the inverse CDF, so −mean*LN(1−RAND()) and −mean*LN(RAND()) produce identically distributed exponential variates. Note mean = 1/λ replaces 1/λ in the derivation."
  },
  {
    "id": "w5q8",
    "topic": "W5",
    "question": "Which formula correctly simulates a data point from a Normal distribution with mean 25 and standard deviation 4?",
    "options": [
      "=NORMDIST(RAND(), 25, 4, TRUE)",
      "=NORMINV(RAND(), 25, 4)",
      "=NORMSINV(RAND()) * 25 + 4",
      "=25 + RAND() * 4"
    ],
    "answerIndex": 1,
    "explanation": "NORMINV inverts the normal CDF: given a random cumulative probability from RAND(), it returns the x with that CDF value — exactly the inversion method M3a. NORMDIST goes the other direction (x to probability). Option 3 has mean and SD swapped (it should be *4 + 25), and option 4 gives a uniform, not normal, variate."
  },
  {
    "id": "w5q9",
    "topic": "W5",
    "question": "There is no direct Excel inverse function for the Poisson distribution. How does DataSim.xlsx simulate a Poisson variate with mean λ?",
    "options": [
      "=POISSON(RAND(), λ, TRUE)",
      "=CRITBINOM(1000, λ/1000, RAND()), using the fact that Poisson is the limit of Binomial with λ = np for large n and small p",
      "=RANDBETWEEN(0, 2*λ), since Poisson is roughly uniform around its mean",
      "=-λ*LN(RAND()), the same inversion as the Exponential"
    ],
    "answerIndex": 1,
    "explanation": "The Binomial(n, p) distribution converges to Poisson(np) as n grows large and p small. Setting n = 1000 and p = λ/1000 keeps np = λ, so CRITBINOM(1000, λ/1000, RAND()) inverts an excellent approximation of the Poisson CDF. Option 4 simulates the exponential (inter-arrival time), not the Poisson count."
  },
  {
    "id": "w5q10",
    "topic": "W5",
    "question": "In the 4-door Monty Hall variant, why is IF(RAND()<1/3, Door 1, IF(RAND()>2/3, Door 4, Door 3)) an INCORRECT way to pick among doors 1, 3, 4?",
    "options": [
      "Because IF statements cannot be nested more than once in Excel",
      "Because RAND() cannot be compared against fractions like 1/3",
      "Because the two RAND() calls generate two different values, distorting the intended 1/3-1/3-1/3 split",
      "Because the formula should use RANDBETWEEN(1,4) instead"
    ],
    "answerIndex": 2,
    "explanation": "Each RAND() is a fresh draw, so the second test is not conditioned on the first draw falling in (1/3, 2/3]. Correct fixes: store one draw in a cell C5 = RAND() and test C5 twice, or re-scale the second branch to IF(RAND()>0.5, Door 4, Door 3) since doors 4 and 3 must split the remaining probability equally."
  },
  {
    "id": "w5q11",
    "topic": "W5",
    "question": "In MontyHall.xlsx, the contestant selected door 1 and the host revealed door 2. Using the shortcut Change door = 6 − (revealed + selected), which door does the contestant switch to?",
    "options": [
      "Door 1",
      "Door 2",
      "Door 3",
      "It cannot be determined without the prize door"
    ],
    "answerIndex": 2,
    "explanation": "The three door numbers always sum to 1+2+3 = 6, so the remaining door is 6 − (2 + 1) = 3. The workbook implements this as =6-D10-E10 where D10 is the selected door and E10 the revealed door — no options matrix needed for the change decision."
  },
  {
    "id": "w5q12",
    "topic": "W5",
    "question": "According to the Week 5 analysis of Monty Hall, what is the probability of winning if the contestant CHANGES door after the reveal?",
    "options": [
      "1/3",
      "1/2",
      "2/3",
      "It depends on which door was revealed"
    ],
    "answerIndex": 2,
    "explanation": "With the prize behind (say) door 2, the contestant's initial pick is door 1, 2 or 3 with equal probability. Switching wins from initial picks 1 and 3 and loses only from pick 2, so P(win | change) = 2/3 and P(win | stay) = 1/3. The second contestant with no prior knowledge, choosing between the 2 remaining doors, wins with probability 1/2."
  },
  {
    "id": "w5q13",
    "topic": "W5",
    "question": "MontyHall.xlsx computes the win indicator as =(G10=$C10)*1 and the win probability as =SUM(K10:K1009)/COUNT(K10:K1009). Why multiply the comparison by 1?",
    "options": [
      "To round the result to the nearest integer",
      "To convert the TRUE/FALSE comparison into 1/0 so wins can be averaged into a probability",
      "To scale the probability into a percentage",
      "Because Excel comparisons return #VALUE! unless multiplied"
    ],
    "answerIndex": 1,
    "explanation": "(G10=$C10) evaluates to TRUE or FALSE; multiplying by 1 coerces TRUE*1 = 1 and FALSE*1 = 0. With 1000 trials of 1s and 0s, SUM/COUNT (equivalently AVERAGE) directly estimates the probability of winning. Alternatives shown on the slides: IF(choice=prize, 1, 0) or IF(choice=prize, TRUE, FALSE)*1."
  },
  {
    "id": "w5q14",
    "topic": "W5",
    "question": "The village tank size in VillageWater.xlsx is {=MAX(0,C12:N12-C13:N13)-MAX(0,N12-N13)}. Why is the December term subtracted?",
    "options": [
      "Because December has the lowest rainfall of the year",
      "Because demand is zero in December",
      "So any leftover water at year-end is removed from the tank; otherwise the tank size would need to increase after each year",
      "To convert the result from litres to cubic metres"
    ],
    "answerIndex": 2,
    "explanation": "The first term finds the largest positive gap between cumulative supply and cumulative demand across all 12 months (May in the example) — the storage needed. Subtracting the December surplus flushes leftover water at the annual boundary so the yearly cycle restarts cleanly; without it the tank would have to grow every year. The household tank uses the same logic over 24 hours."
  },
  {
    "id": "w6q1",
    "topic": "W6",
    "question": "In Excel's default 1900 date system, what does =DATE(1900,3,1)-DATE(1900,2,1) return?",
    "options": [
      "28",
      "31",
      "29",
      "1"
    ],
    "answerIndex": 2,
    "explanation": "DATE(1900,3,1) = 61 and DATE(1900,2,1) = 32, because the 1900 system counts the non-existent 29 Feb 1900 as serial 60. The difference is 29, one more than the real 28 days. The slides warn that subtracting dates on either side of 29 Feb 1900 overstates the gap by one; modern pairs are unaffected (DATE(2026,3,1)-DATE(2026,2,1) = 28)."
  },
  {
    "id": "w6q2",
    "topic": "W6",
    "question": "Cell A1 holds the number 39461.847. What does =HOUR(A1)&\":\"&MINUTE(A1) return?",
    "options": [
      "20:19",
      "8:19",
      "20:20",
      "39461:847"
    ],
    "answerIndex": 0,
    "explanation": "Only the fraction .847 sets the clock time: 0.847 of a day = 73,181 seconds ≈ 20 h 19 min 41 s, so HOUR = 20 and MINUTE = 19 (SECOND = 41, i.e. 8:19:41 PM as on the slide). The & operator turns both numbers into text, giving \"20:19\". 8:19 is the 12-hour reading, but HOUR always returns 0–23; 20:20 rounds the minutes instead of taking the whole minute."
  },
  {
    "id": "w6q3",
    "topic": "W6",
    "question": "B2 holds the date 2-Sep-2026 and C2 holds 14-Oct-2026. Which formula returns the 42 days between them?",
    "options": [
      "=DAY(C2)-DAY(B2)",
      "=C2-B2",
      "=14-Oct-26-2-Sep-26",
      "=MONTH(C2)-MONTH(B2)"
    ],
    "answerIndex": 1,
    "explanation": "Dates are serial numbers, so subtracting the two cells gives the elapsed days: 28 days to the end of September + 14 = 42. DAY(C2)-DAY(B2) = 14 − 2 = 12 ignores the change of month, and the MONTH difference is 1. Typing bare dates inside a formula is the slides' 'WRONG' pattern: use cell references, quoted text or DATE()."
  },
  {
    "id": "w6q4",
    "topic": "W6",
    "question": "A maintenance log sums seven daily run-times in B10 to 31 hours 15 minutes (stored as 1.3020833). Which custom format makes B10 display 31:15?",
    "options": [
      "h:mm",
      "hh:mm",
      "mm:ss",
      "[h]:mm"
    ],
    "answerIndex": 3,
    "explanation": "1.3020833 is 1 whole day plus 0.3020833 (7 h 15 min). h and hh show only the hour within the day (0–23), so they display 7:15 and 07:15; mm:ss shows the minutes and seconds of the time part (15:00). [h] keeps counting past 23 ('Hours as 0, 1, …, 23, 24, 25, …' on the slide), so [h]:mm displays 31:15."
  },
  {
    "id": "w6q5",
    "topic": "W6",
    "question": "A customer's wait is exactly 1 hour 5 minutes 37 seconds, and the cell is formatted mm:ss like the Call Center wait columns. What does the cell display?",
    "options": [
      "05:37",
      "65:37",
      "1:05:37",
      "#####"
    ],
    "answerIndex": 0,
    "explanation": "mm shows the minutes (0–59) of the time part only, so the whole hour disappears from view while the stored value stays the same. The saved c-Server sheet has this issue for its longest waits. 1:05:37 needs h:mm:ss or an [h] format, and ##### is what Excel shows for a negative time, not a long one."
  },
  {
    "id": "w6q6",
    "topic": "W6",
    "question": "The average service time in D4 is 4:00 (mm:ss). If RAND() returns 0.5, what duration does =-$D$4*LN(RAND()) produce?",
    "options": [
      "2:00",
      "4:00",
      "1:12",
      "2:46"
    ],
    "answerIndex": 3,
    "explanation": "−4 × LN(0.5) = −4 × (−0.6931) = 2.77 minutes = 2 min 46 s. LN of a number between 0 and 1 is negative, which is why the formula starts with a minus sign. D4 is a time value, so the result is also a time (format it mm:ss). 2:00 is simply half the mean, and 1:12 is what LOG10 would give instead of LN."
  },
  {
    "id": "w6q7",
    "topic": "W6",
    "question": "A single-server help desk opens at 8:00 (customer 0's service end). Three customers have inter-arrival times of 3, 2 and 5 minutes and service times of 6, 4 and 2 minutes. With start =MAX(arrival, previous service end), how long does customer 3 wait?",
    "options": [
      "0 minutes",
      "3 minutes",
      "4 minutes",
      "5 minutes"
    ],
    "answerIndex": 1,
    "explanation": "Arrivals are 8:03, 8:05 and 8:10. Customer 1 starts at 8:03 and ends at 8:09. Customer 2 starts at MAX(8:05, 8:09) = 8:09, waits 4 and ends at 8:13. Customer 3 starts at MAX(8:10, 8:13) = 8:13, so the wait is 3 minutes (system time 3 + 2 = 5). 4 is customer 2's wait, 5 is customer 3's system time, and 0 assumes the server is free."
  },
  {
    "id": "w6q8",
    "topic": "W6",
    "question": "Earlier service end times in G14:G18 are 9:00 (opening), 9:07, 9:12, 9:15 and 9:21. The next customer arrives at E19 = 9:13. What does =COUNTIF($G$14:G18,\">\"&E19) return?",
    "options": [
      "2",
      "3",
      "0",
      "5"
    ],
    "answerIndex": 0,
    "explanation": "Only 9:15 and 9:21 are later than 9:13, so 2 earlier customers are still in the system when this one arrives. 3 wrongly includes 9:12. 0 is what you get from typing the criterion as \">E19\": COUNTIF then compares against the text 'E19' instead of the arrival time, which is why the slides build criteria with &. 5 counts every row."
  },
  {
    "id": "w6q9",
    "topic": "W6",
    "question": "A queue has c = 3 servers (G4). Earlier service end times in G14:G20 are 10:00 (opening), 10:06, 10:15, 10:09, 10:22, 10:18 and 10:11. A customer arrives at 10:12, and J21 = 3 of those end times are later than 10:12. What does =IF(J21<$G$4,E21,LARGE($G$14:G20,$G$4)) return?",
    "options": [
      "10:12",
      "10:22",
      "10:15",
      "10:11"
    ],
    "answerIndex": 2,
    "explanation": "J21 = 3 is not below 3, so the formula takes the 3rd-largest earlier end time. Sorted descending: 10:22, 10:18, 10:15, … → 10:15. The three customers still in the system (one per server) finish at 10:15, 10:18 and 10:22, so the earliest server frees up at 10:15 and the customer waits 3 minutes. 10:12 would apply only if a server were idle, 10:22 is when the last server frees, and 10:11 is the 4th largest."
  },
  {
    "id": "w6q10",
    "topic": "W6",
    "question": "The c-Server documentation asks why F20 =MAX(E20, LARGE($G$14:G19,c)) would not work properly in place of =IF(J20<c, E20, LARGE($G$14:G19,c)). With c = 2, what goes wrong?",
    "options": [
      "MAX ignores time values, so the formula always returns the arrival time",
      "It returns the arrival time even when all c servers are busy, so no one ever waits in line",
      "LARGE cannot take an expanding range such as $G$14:G19, so it returns #VALUE!",
      "LARGE returns #NUM! for customer 1 (only one end time in range) and the error cascades down"
    ],
    "answerIndex": 3,
    "explanation": "When the range holds at least c values, MAX(arrival, c-th largest end) gives the same answer as the IF. If fewer than c earlier customers are still in the system, the c-th largest end time is no later than the arrival; otherwise it is later. The problem is the first rows: LARGE returns #NUM! when k exceeds the number of values, MAX passes the error on, G15 = F15 + D15 becomes #NUM!, and every later LARGE range includes it. The IF version never evaluates LARGE until J ≥ c."
  },
  {
    "id": "w6q11",
    "topic": "W6",
    "question": "A clinic averages one patient every 6:00 minutes, each consultation averages 15:00 minutes and 3 doctors are on duty. What is the traffic intensity using the c-Server formula =(D4/G4)/C4?",
    "options": [
      "0.83",
      "2.50",
      "0.40",
      "1.20"
    ],
    "answerIndex": 0,
    "explanation": "(15 ÷ 3) ÷ 6 = 5/6 = 0.83. Each doctor carries one third of the workload, and a value below 1 means the doctors can keep up on average. 2.50 forgets to divide by the 3 servers (the single-server D4/C4), 0.40 inverts the ratio (6/15), and 1.20 is (6 × 3)/15."
  },
  {
    "id": "w6q12",
    "topic": "W6",
    "question": "In a BR model with balk limit F4 = 7, renege limit G4 = 30:00 and 2 servers, a customer arrives at 10:40 when L = 5, and LARGE gives a potential start of 11:14. What do G (potential wait) and H (service start) show?",
    "options": [
      "G and H are both blank: the customer balks",
      "G = 34:00 and H is blank: the customer joins, then reneges",
      "G = 34:00 and H = 11:14: the customer is served late",
      "G = 30:00 and H = 11:10: the wait is capped at the renege limit"
    ],
    "answerIndex": 1,
    "explanation": "L = 5 is not above 7, so the customer joins, and because L ≥ 2 servers, F = LARGE(...) = 11:14. G15 =IF(F15=\"\",\"\",F15-E15) = 11:14 − 10:40 = 34 minutes. H15 =IF(F15=\"\",\"\",IF(G15>$G$4,\"\",F15)): 34 > 30, so H is blank and the customer reneges without being served. Balking would need L > 7."
  },
  {
    "id": "w6q13",
    "topic": "W6",
    "question": "A BR run has 80 arrivals in column E. 68 of them have a potential start time in F, and 51 have an actual service start in H. Using the F8 and G8 formulas, what are the balk and renege proportions?",
    "options": [
      "Balk 0.15, renege 0.21",
      "Balk 0.18, renege 0.25",
      "Balk 0.15, renege 0.25",
      "Balk 0.85, renege 0.75"
    ],
    "answerIndex": 2,
    "explanation": "Balk = (COUNT(E) − COUNT(F))/COUNT(E) = (80 − 68)/80 = 0.15. Renege = (COUNT(F) − COUNT(H))/COUNT(F) = (68 − 51)/68 = 0.25. The renege denominator is the customers who JOINED, not all arrivals (17/80 = 0.21 is the trap). 0.18 = 12/68 uses the wrong base for balking, and 0.85 and 0.75 are the shares who joined and who were served."
  },
  {
    "id": "w6q14",
    "topic": "W6",
    "question": "The original 'c-Server (BR)' sheet sets the service end time as I15 =IF(F15=\"\",\"\",F15+D15). Why do the slides call this an ERROR?",
    "options": [
      "Customers who balked are given an end time, so they are counted in L",
      "Customers who reneged are left out of L even though they waited in the queue",
      "The service time D15 is added twice, so every end time comes out too late",
      "Customers who reneged still get an end time as if served, so they inflate L"
    ],
    "answerIndex": 3,
    "explanation": "F is filled for everyone who joined, including renegers whose potential wait exceeded 30 minutes. Their fake end time F + D stays in column I, and L =COUNTIF($I$14:I14,\">\"&E15) counts it, overstating the queue. Dropping renegers entirely is the BR-2 error (I based on H). Balkers have F = \"\", so they never get an end time."
  },
  {
    "id": "w6q15",
    "topic": "W6",
    "question": "Under BR-M (renege limit G4 = 30:00), using the sheet's I15, J15 and K15 formulas, a customer arrives at 14:05, joins the queue and later reneges. What do I (service end), J (wait) and K (system time) show?",
    "options": [
      "I = 14:35, J = 30:00, K = 30:00",
      "I, J and K are all blank",
      "I = 14:35, J is blank, K = 30:00",
      "I = potential start + service time, J = 30:00, K is blank"
    ],
    "answerIndex": 0,
    "explanation": "I15 =IF(F15=\"\",\"\",IF(G15>$G$4,E15+$G$4,H15+D15)) gives arrival + renege limit = 14:35, so the customer counts in L for exactly 30 minutes. J15 and K15 both test H15=\"\" and return $G$4 = 30:00 for renegers. All blank describes a balker, and potential start + service time is the original BR's fake end time. The BR-M overview diagram's side note shows J blank for renegers, but the J15 formula slide and the workbook both record the renege limit."
  },
  {
    "id": "w6q16",
    "topic": "W6",
    "question": "Member records start in row 12. After some deletions, the IDs in C12:C16 are 3, 7, 8, 12 and 15. A user types 12 into C7. What does B7 =IFERROR(MATCH(C7,C12:C1048576,0)+11,\"\") return, and therefore which row does deleteRecord remove?",
    "options": [
      "4, so row 4",
      "15, so row 15",
      "12, so row 12",
      "16, so row 16"
    ],
    "answerIndex": 1,
    "explanation": "MATCH with match type 0 finds ID 12 in position 4 of C12:C…, and adding 11 converts that position into the worksheet row: 4 + 11 = 15. deleteRecord reads rowNum = Range(\"B7\").Value = 15 and deletes Rows(15). 4 forgets the offset, and 12 confuses the ID with the row. If the ID were missing, IFERROR would return \"\" and the If rowNum <> \"\" guard would skip the delete."
  },
  {
    "id": "w6q17",
    "topic": "W6",
    "question": "On the record sheet, C10 holds the title \"Member's Records\", C11 the header and records fill C12:C14. addRecord runs Range(\"C10\").Select, Selection.End(xlDown).Select and ActiveCell.Offset(1, 0).Range(\"A1\").Select before pasting. Where do the new values land?",
    "options": [
      "C11",
      "C14",
      "C15",
      "C1048576"
    ],
    "answerIndex": 2,
    "explanation": "End(xlDown), the recorded Ctrl+Down Arrow, runs from C10 through the unbroken non-empty cells to the last record, C14. The relative Offset(1, 0) then moves one row down to the empty C15, where Paste Special puts the values and number formats. Starting at C10 also handles the very first add: with no records, Ctrl+Down stops at the header C11 and the paste lands in C12."
  },
  {
    "id": "w6q18",
    "topic": "W6",
    "question": "While recording addRecord, why must Use Relative Reference be switched ON just before pressing the Down Arrow, and OFF again afterwards?",
    "options": [
      "It makes Paste Special paste the source formulas rather than their values",
      "It lets the recorded macro run on any worksheet in any open workbook",
      "It must be on before a Form Controls button can be assigned to the macro",
      "It records ActiveCell.Offset(1, 0), so each paste lands below the last record"
    ],
    "answerIndex": 3,
    "explanation": "In absolute mode the recorder stores the exact cell you landed on, so the next run would paste into that same row again. Relative mode records the movement, so the paste follows the table as it grows. Switching it OFF again keeps the later Range(\"D4:G4\") selection absolute, so the entry fields are always the ones cleared. Paste Special 'Values and number formats' deliberately pastes values, not formulas."
  },
  {
    "id": "w9q1",
    "topic": "W9",
    "question": "Ex2_MoveIt runs Range(\"A1\").Offset(2, 3).Value = \"YEAH1\", then sets i = 3 and j = 4 and runs Cells(1 + i, 1 + j).Value = \"YEAH2\". Which cells receive YEAH1 and YEAH2 respectively?",
    "options": [
      "C4 and D5",
      "C2 and E4",
      "D3 and E4",
      "E4 and D3"
    ],
    "answerIndex": 2,
    "explanation": "Offset(2, 3) moves 2 rows down and 3 columns right of A1, giving D3. Cells(row, column) takes the row first: Cells(4, 5) is row 4, column 5 (E), giving E4. C4/D5 is what you get by swapping rows and columns. The macro also shades A1 black (ColorIndex 1) and then clears it with xlNone."
  },
  {
    "id": "w9q2",
    "topic": "W9",
    "question": "Ex7_IStillLoveYou sets spending = 10. Inside Do While spending <= 100 it shows a 'within the limit' message and adds 20; after the loop it shows 'I am broke and I have to stop loving you.' How many message boxes appear in total?",
    "options": [
      "6",
      "5",
      "7",
      "11"
    ],
    "answerIndex": 0,
    "explanation": "The loop test passes at spending = 10, 30, 50, 70 and 90, giving 5 in-loop messages. Spending then becomes 110, 110 <= 100 is FALSE and the loop ends, followed by the final message: 5 + 1 = 6. Answering 5 forgets the message after the loop."
  },
  {
    "id": "w9q3",
    "topic": "W9",
    "question": "Ex8_StopSpending declares Money As Single, sets Money = 4 and runs Do: MsgBox (\"You have $\" & Money & \". Can spend.\"): Money = Money - 0.5: Loop Until Money < 2.1, then shows 'You have $<Money>. Better stop spending.' What amount appears in that final message?",
    "options": [
      "$2.5",
      "$1.5",
      "$2.1",
      "$2"
    ],
    "answerIndex": 3,
    "explanation": "This is a Type 2 loop, so the test comes after the body. The 'Can spend' messages show $4, $3.5, $3 and $2.5, with Money dropping by 0.5 after each. After the $2.5 pass Money = 2, and 2 < 2.1 is TRUE, so the loop stops and the final message says $2. Money never reaches $1.5, and $2.1 is only the threshold, not a value it takes."
  },
  {
    "id": "w9q4",
    "topic": "W9",
    "question": "In the slide demos, j is declared with Dim j As Integer (starting at 0). Suppose j is set to 10 just before each loop instead. How many times is 'Hi' shown by DoWhileDemo1 (Do While j < 10 ... Loop) and by DoWhileDemo2 (Do ... Loop While j < 10)?",
    "options": [
      "1 and 0",
      "0 and 1",
      "0 and 0",
      "10 and 10"
    ],
    "answerIndex": 1,
    "explanation": "Type 1 tests before the first pass: 10 < 10 is FALSE, so the body never runs (0). Type 2 runs the body once (Hi, j becomes 11) and only then tests 11 < 10, which is FALSE (1). This matches the slide: when the condition starts FALSE, Type 1 does not execute at all but Type 2 executes once. With j starting at 0, both show Hi 10 times."
  },
  {
    "id": "w9q5",
    "topic": "W9",
    "question": "A procedure declares Dim p, q, r As Integer. Which variables are Integers?",
    "options": [
      "p, q and r",
      "Only r",
      "Only p",
      "None: all three are Variants"
    ],
    "answerIndex": 1,
    "explanation": "The As clause applies only to the variable directly before it, so r is an Integer while p and q become Variants (16 bytes each), which the slide calls a waste of memory. To type all three, write Dim p As Integer, q As Integer, r As Integer."
  },
  {
    "id": "w9q6",
    "topic": "W9",
    "question": "A module starts with Public x As Integer and Dim y As Long, followed by Sub Mysub() containing Dim z As Single, Static k As Integer and k = k + 1. Which statement is TRUE?",
    "options": [
      "y can be used by procedures in every module of the project",
      "z keeps its value between runs of Mysub",
      "x can only be used by procedures in this module",
      "After Mysub has run three times, k equals 3"
    ],
    "answerIndex": 3,
    "explanation": "x is Public, so every module can use it. y is declared with Dim before the first procedure, so only this module's procedures can use it. z is local and starts fresh on every call. k is Static, so it keeps its value when Mysub ends: 1 after the first run, 2 after the second and 3 after the third. This is the slide's example of counting how many times a program has run."
  },
  {
    "id": "w9q7",
    "topic": "W9",
    "question": "A macro needs a whole-number counter that may reach 40,000 records. Following the slide's rule to choose the data type with the fewest bytes that can still handle the job, which type should you declare?",
    "options": [
      "Integer",
      "Byte",
      "Long",
      "Double"
    ],
    "answerIndex": 2,
    "explanation": "Integer uses 2 bytes but stops at 32,767, so 40,000 would overflow. Byte only covers 0 to 255. Long uses 4 bytes and holds whole numbers up to 2,147,483,647; the slide describes it as the type for whole numbers too large for Integer. Double (8 bytes, floating point) would work but wastes memory."
  },
  {
    "id": "w9q8",
    "topic": "W9",
    "question": "Ex6_ColorMeBad is run and the user types 5. Which cells get coloured, and what ColorIndex does the last one receive?",
    "options": [
      "A1:A5, with A5 at ColorIndex 5",
      "A1:A4, with A4 at ColorIndex 4",
      "A2:A6, with A6 at ColorIndex 6",
      "A1:A5, with A5 at ColorIndex 6"
    ],
    "answerIndex": 0,
    "explanation": "5 passes the check If Num >= 1 And Num <= 56. A1 is set to ColorIndex 1 (black). Then For i = 1 To 4 colours Range(\"A1\").Offset(i, 0), which is A2 to A5, with ColorIndex i + 1 = 2 to 5. Five cells, A1:A5, are coloured and the last has index 5. An entry of 60 fails the check and nothing is coloured."
  },
  {
    "id": "w9q9",
    "topic": "W9",
    "question": "CheckThis runs With ActiveCell: If .Value <= 1000 Then .Font.Color = vbRed; If .Value > 1000 Then vbBlack; If .Value > 4999 Then vbBlue; If .Value > 9999 Then vbGreen (four separate single-line Ifs). What colour does a cell holding 5000 end up?",
    "options": [
      "Black",
      "Red",
      "Green",
      "Blue"
    ],
    "answerIndex": 3,
    "explanation": "The four Ifs are independent, not ElseIf, so every true condition runs in order and the last true one wins. For 5000: <= 1000 is FALSE; > 1000 is TRUE (black); > 4999 is TRUE (blue, overwriting black); > 9999 is FALSE. The result is blue. On the Range sheet, C4:C11 (500 to 10000) end up 2 red, 2 black, 3 blue and 1 green."
  },
  {
    "id": "w9q10",
    "topic": "W9",
    "question": "On UsefulMacros' Worksheet sheet, C4:C7 hold 5000, 6000, 9000 and 10000. You click UseXLFunction (Total = WorksheetFunction.Sum(Range(\"C4:C7\")) then Range(\"C8\") = Total) and afterwards change C4 to 7000. What does C8 show?",
    "options": [
      "32000",
      "30000",
      "#VALUE!",
      "0"
    ],
    "answerIndex": 1,
    "explanation": "VBA computed 5000 + 6000 + 9000 + 10000 = 30000 and wrote that number into C8. A written value does not recalculate, so C8 stays 30000. EnterFormula instead writes Range(\"C8\").Formula = \"=SUM(C4:C7)\", which would update to 32000."
  },
  {
    "id": "w9q11",
    "topic": "W9",
    "question": "When recording the Arrive macro, why is Use Relative References switched ON just before pressing the Down Arrow that follows Ctrl+Down?",
    "options": [
      "So the paste lands one row below whichever cell is last at run time, instead of always in the cell used while recording",
      "Because Paste Special can only be recorded in relative mode",
      "So the pasted time keeps its =$D$3 formula and stays live",
      "Because Ctrl+Down Arrow cannot be recorded in absolute mode"
    ],
    "answerIndex": 0,
    "explanation": "In absolute mode the Down Arrow would be recorded as a fixed address, so every run would overwrite the same cell. In relative mode it is recorded as ActiveCell.Offset(1, 0).Range(\"A1\").Select, one row below wherever Ctrl+Down (End(xlDown)) landed. The paste uses Values and Number Formats, which deliberately freezes the time instead of keeping =$D$3. The slides switch relative OFF again after the paste and the Esc."
  },
  {
    "id": "w9q12",
    "topic": "W9",
    "question": "In TimerClicker's Timer sheet, column C has the header 'Arrive' in C6, =$D$3 in C7 and recorded times in C8:C12; C13 is empty. Which cell does Range(\"C6\").End(xlDown).Offset(1, 0) refer to?",
    "options": [
      "C12",
      "C7",
      "C13",
      "C1048576"
    ],
    "answerIndex": 2,
    "explanation": "End(xlDown) from C6 runs to the last filled cell of the contiguous block, C12, and Offset(1, 0) moves one row down to C13, the next empty row. C7's formula ensures there is always at least one filled cell under the header, so End(xlDown) never runs to the bottom of the sheet."
  },
  {
    "id": "w9q13",
    "topic": "W9",
    "question": "With the Timer formulas (wait H = D - C, service G = E - D, system I = E - C), a customer arrives at 10:02:30, starts service at 10:05:00 and leaves at 10:09:15. What are the wait, service and system times?",
    "options": [
      "Wait 4:15, service 2:30, system 6:45",
      "Wait 2:30, service 6:45, system 4:15",
      "Wait 2:30, service 4:15, system 4:15",
      "Wait 2:30, service 4:15, system 6:45"
    ],
    "answerIndex": 3,
    "explanation": "Wait = 10:05:00 - 10:02:30 = 2:30. Service = 10:09:15 - 10:05:00 = 4:15. System = 10:09:15 - 10:02:30 = 6:45, which equals wait + service (2:30 + 4:15). If the previous customer arrived at 9:58:00, the inter-arrival time F would be 4:30."
  },
  {
    "id": "w9q14",
    "topic": "W9",
    "question": "A cell holds 1.5 (one and a half days). How does it display under the custom format [h]:mm and under h:mm?",
    "options": [
      "36:00 and 12:00",
      "36:00 and 36:00",
      "12:00 and 36:00",
      "1:30 and 12:00"
    ],
    "answerIndex": 0,
    "explanation": "Time is a fraction of a day, so 1.5 days = 36 hours. With [h] the hours keep counting past 23 (the Learn sheet's code table: 'Hours as 0, 1, ..., 23, 24, 25, ...'), giving 36:00. Plain h rolls over every 24 hours and shows only the 12 hours beyond the full day, giving 12:00. Use [h]:mm for durations that can exceed a day."
  },
  {
    "id": "w9q15",
    "topic": "W9",
    "question": "Ex9_SquareRoot (On Error GoTo BadEntry; Num = InputBox(...); If Num = \" \" Then Exit Sub; ActiveCell.Value = Sqr(Num); Exit Sub; BadEntry: MsgBox ...) is run and the user types -9. What happens?",
    "options": [
      "ActiveCell shows 3",
      "The message 'Enter a positive numeric value' appears and ActiveCell is unchanged",
      "ActiveCell shows -3",
      "The macro ends silently through If Num = \" \" Then Exit Sub"
    ],
    "answerIndex": 1,
    "explanation": "Sqr of a negative number raises a run-time error. On Error GoTo BadEntry jumps straight to the label, so the assignment to ActiveCell never happens and the message box appears. The Exit Sub test only matches a single space. Typing 16 would put 4 in the active cell, and Exit Sub then stops the macro before it reaches BadEntry."
  },
  {
    "id": "w9q16",
    "topic": "W9",
    "question": "You paste a Worksheet_Change(ByVal Target As Range) procedure into Module1, but editing cells on Sheet1 never triggers it. What is the fix?",
    "options": [
      "Rename it Module1_Change",
      "Add Option Explicit at the top of Module1",
      "Run it from a button with Call Worksheet_Change",
      "Move it into Sheet1's own code module (select Sheet1 in Project Explorer, View Code, choose Worksheet and then Change)"
    ],
    "answerIndex": 3,
    "explanation": "Event-handler procedures belong to the object that raises the event. The slide's steps are to select the object in Project Explorer, click View Code and pick the object and the operation, which creates the correct header. UsefulMacros keeps extra event procedures in the standard modules M7_OtherEvents and M8_ThisWkbk_Events as templates that never fire there, while its live handlers sit in the Event sheet's module and in ThisWorkbook."
  },
  {
    "id": "w9q17",
    "topic": "W9",
    "question": "Where must the code for Function CubeRoot(number): CubeRoot = number ^ (1/3) be written so that =CubeRoot(27) works in a worksheet cell, and what does that cell return?",
    "options": [
      "In ThisWorkbook; 3",
      "In the Sheet1 object; 9",
      "In a Module; 3",
      "In a Module; 9"
    ],
    "answerIndex": 2,
    "explanation": "The slides state that for functions to work in a workbook their code MUST be written in a Module object (VBE: select the workbook, Insert Module, code the function). 27^(1/3) = 3, because 3 x 3 x 3 = 27. 9 would come from 27/3 or 27^(2/3). The same function called from a Sub (Ans = CubeRoot(123)) gives about 4.973."
  },
  {
    "id": "w9q18",
    "topic": "W9",
    "question": "Ex5_Evaluation reads a rating with InputBox and runs Select Case with only Case 1, Case 2 and Case 3. The user types 4. What happens?",
    "options": [
      "Nothing is displayed, because no Case matches and there is no Case Else",
      "'I am happy!' appears, because 4 is above 3",
      "A type-mismatch error stops the macro",
      "'Are you sure?' appears, because the first Case is the default"
    ],
    "answerIndex": 0,
    "explanation": "Select Case runs only the branch whose value matches. 4 matches none, and without a Case Else nothing runs, so no message appears. The InputBox text '4' is compared with the numbers 1 to 3 without error. A Case Else line would be the place to handle out-of-range ratings."
  },
  {
    "id": "w10q1",
    "topic": "W10",
    "question": "You want AutoFilter pull-downs on a 2,000-row order list. What is the correct way to switch them on?",
    "options": [
      "Click any cell in the list and choose Data > Filter",
      "Type a criteria range above the list and choose Data > Advanced",
      "Select only the header row and insert a PivotTable",
      "Apply data validation lists to every header cell"
    ],
    "answerIndex": 0,
    "explanation": "Per the deck, put the active cell somewhere inside the list, then choose Data > Filter, and every column header gets a pull-down. Data > Advanced is Advanced Filter (it needs a criteria range), and data validation drop-downs restrict input rather than filter rows."
  },
  {
    "id": "w10q2",
    "topic": "W10",
    "question": "Which request can be done in a SINGLE Custom AutoFilter dialog on the Priority column?",
    "options": [
      "Priority = 1 OR Priority = 3 OR Priority = 5",
      "Priority between 2 and 4 AND Customer begins with 'A'",
      "Priority >= 2 AND Priority <= 4",
      "Priority = 1 for Customer 001 OR Priority = 5 for Customer 002"
    ],
    "answerIndex": 2,
    "explanation": "A Custom AutoFilter dialog works on one column and allows at most 2 criteria joined by AND or OR. Option C is exactly two conditions on Priority. Option A needs three conditions, and options B and D bring in a second column (D's OR across columns needs Advanced Filter)."
  },
  {
    "id": "w10q3",
    "topic": "W10",
    "question": "A Product Code column holds T-1, T-10, T-100 and TX-10. You apply Custom Filter with 'equals T-1?'. Which codes stay visible?",
    "options": [
      "T-1 and T-10",
      "T-10 only",
      "T-10 and T-100",
      "T-1, T-10 and T-100"
    ],
    "answerIndex": 1,
    "explanation": "? stands for exactly one character, so the pattern needs exactly four characters: T, -, 1 and one more. T-10 fits; T-1 has nothing in the ? position, T-100 has one character too many and TX-10 fails at the second character. 'equals T-1*' would keep T-1, T-10 and T-100 because * matches zero or more characters."
  },
  {
    "id": "w10q4",
    "topic": "W10",
    "question": "A Sales column holds 500, 450, 450, 450, 300 and 200. You set the Top 10 AutoFilter to Top 3 Items. How many rows are displayed?",
    "options": [
      "3",
      "2",
      "5",
      "4"
    ],
    "answerIndex": 3,
    "explanation": "The 3rd-highest value is 450, which three rows share. When more items than requested satisfy the criterion, all of them are displayed: 500 plus the three 450s = 4 rows."
  },
  {
    "id": "w10q5",
    "topic": "W10",
    "question": "Why does the Top 10 option appear only under Number Filters?",
    "options": [
      "It can be used only once per worksheet",
      "It needs a field measured in numbers so items can be ranked",
      "Text columns are always sorted A to Z first",
      "Dates are converted to text when filtered"
    ],
    "answerIndex": 1,
    "explanation": "The deck notes that Top 10 works only when the field can be computed in measurable units, so it sits under Number Filter. It can still be switched to Bottom N or to a percentage of items."
  },
  {
    "id": "w10q6",
    "topic": "W10",
    "question": "Cell A1 contains 2 Nov 2019, which was a Saturday. What does the custom format ddd d mmm yy display?",
    "options": [
      "Sat 2 Nov 19",
      "Saturday 02 November 2019",
      "Sat 02 11 19",
      "2 Sat Nov 2019"
    ],
    "answerIndex": 0,
    "explanation": "ddd = short weekday (Sat), d = day without a leading zero (2), mmm = short month name (Nov), yy = 2-digit year (19). Saturday would need dddd, 02 would need dd, November would need mmmm and 2019 would need yyyy."
  },
  {
    "id": "w10q7",
    "topic": "W10",
    "question": "A cell holds the duration 1.5 (one and a half days). What does it display with the format [h]:mm?",
    "options": [
      "12:00",
      "1:30",
      "36:00",
      "36:30"
    ],
    "answerIndex": 2,
    "explanation": "1.5 days = 36 hours. [h] keeps counting past 23 (24, 25, ...), so the cell shows 36:00. With h:mm the hours restart after 23 and the cell would show 12:00; 1:30 confuses days with hours."
  },
  {
    "id": "w10q8",
    "topic": "W10",
    "question": "Which statement about an Advanced Filter criteria range is FALSE according to the deck's rules?",
    "options": [
      "It must sit above the data list with at least one empty row between them",
      "Its headers are matched to the list headers by exact spelling",
      "A blank criteria value means that field is not restricted",
      "Its headers must appear in the same left-to-right order as the list headers"
    ],
    "answerIndex": 3,
    "explanation": "Matching is by header name, not position. In Demo-Advanced-Filter the criteria headers read Gender | Age | Address while the list reads Name | Gender | Address | Age, and the filter still works. The other three statements are the deck's rules."
  },
  {
    "id": "w10q9",
    "topic": "W10",
    "question": "Demo-Advanced-Filter's list holds Mei (F, 38), ABC (M, 35), DEF (F, 40) and GGG (M, 25). The criteria range has Gender | Age headers with F | >=30 on the first row and M | <30 on the second. Which records are shown?",
    "options": [
      "Mei and DEF only",
      "Mei, DEF and GGG",
      "ABC and GGG only",
      "All four records"
    ],
    "answerIndex": 1,
    "explanation": "Each criteria row is an AND, and the rows are OR'ed: (F AND age >= 30) keeps Mei and DEF; (M AND age < 30) keeps GGG. ABC is male but 35, so it fails both rows. 'Mei and DEF only' is the one-row Example 1 answer."
  },
  {
    "id": "w10q10",
    "topic": "W10",
    "question": "In Example 1 of the demo (criteria B3:D4), the Address header is included but D4 is left empty. What does the empty cell do?",
    "options": [
      "Shows only records whose Address is empty",
      "Makes the filter fail because every criteria header needs a value",
      "Nothing - Address is not restricted, so any address passes",
      "Hides records whose Address is empty"
    ],
    "answerIndex": 2,
    "explanation": "An empty criteria value means Show All for that field, so only Gender = F and Age >= 30 apply and Mei and DEF are returned."
  },
  {
    "id": "w10q11",
    "topic": "W10",
    "question": "As at 2 Nov 2019, the Offshore user selects alert level 2 (From -56, To -29 days). What do D15 and E15 display?",
    "options": [
      ">=7 Sep 2019 and <=4 Oct 2019",
      ">=4 Oct 2019 and <=7 Sep 2019",
      ">=5 Oct 2019 and <=18 Oct 2019",
      ">=7 Sep 2019 and <=6 Sep 2019"
    ],
    "answerIndex": 0,
    "explanation": "From date = 2 Nov 2019 - 56 days = 7 Sep 2019; To date = 2 Nov 2019 - 29 days = 4 Oct 2019. D15 =\">=\"&TEXT(H4,\"d MMM yyyy\") and E15 =\"<=\"&TEXT(I4,\"d MMM yyyy\") turn them into >=7 Sep 2019 and <=4 Oct 2019. Option C is the level-1 window."
  },
  {
    "id": "w10q12",
    "topic": "W10",
    "question": "As at 2 Nov 2019, an uncompleted milestone was due on 10 Oct 2019. Which alert level is it in, and what colour is its due-date cell?",
    "options": [
      "Level 0, white",
      "Level 2, pink",
      "Level 3, tan/orange",
      "Level 1, light yellow"
    ],
    "answerIndex": 3,
    "explanation": "10 Oct 2019 is 23 days before 2 Nov 2019 (offset -23), inside level 1's band of -28 to -15 days (due 2 to 4 weeks ago, window 5-18 Oct 2019). The conditional format 'between $H$10 and $I$10' colours it light yellow."
  },
  {
    "id": "w10q13",
    "topic": "W10",
    "question": "Model!H8 holds =IF(TODAY()+F8<1,1,TODAY()+F8) and F8 = -99999 for 'All'. What does H8 display (format d mmm yyyy)?",
    "options": [
      "A date about 274 years before today",
      "1 Jan 1900",
      "#VALUE!",
      "0 Jan 1900"
    ],
    "answerIndex": 1,
    "explanation": "TODAY() - 99999 is a negative serial number, so TODAY()+F8<1 is TRUE and the IF returns 1. Serial 1 is 1 Jan 1900 - the From (date) the deck's screenshot shows for All. The guard keeps the cell from holding an impossible negative date."
  },
  {
    "id": "w10q14",
    "topic": "W10",
    "question": "In the Filter_Alert macro, what changes when E4 = \"All\"?",
    "options": [
      "It clears the filter instead of filtering",
      "It copies the records to another location",
      "It uses criteria range D14:E15, leaving out the status criteria F15:I15",
      "It sets Unique to True to drop duplicate milestones"
    ],
    "answerIndex": 2,
    "explanation": "Both branches run Range(\"B19:I65536\").AdvancedFilter Action:=xlFilterInPlace with Unique:=False; only the criteria range differs - D14:I15 for a chosen level, D14:E15 (just the two Due Date bounds, 1 Jan 1900 to about 274 years ahead) for All."
  },
  {
    "id": "w10q15",
    "topic": "W10",
    "question": "The modified workbook's Worksheet_Change handler tests Intersect(Target, Range(\"E4\", \"F15:I15\")). Which cells does Range(\"E4\", \"F15:I15\") refer to?",
    "options": [
      "The whole rectangle E4:I15",
      "Only E4 and F15:I15",
      "Only F15:I15",
      "Only E4"
    ],
    "answerIndex": 0,
    "explanation": "With two arguments, Range spans from the first reference to the far corner of the second, so it covers E4:I15 - including the alert table E8:I12. A single string \"E4, F15:I15\" with a comma would be the union of the two areas instead. Either way, editing E4 or F15:I15 runs Filter_Alert; the textbook version watched E4 only."
  },
  {
    "id": "w10q16",
    "topic": "W10",
    "question": "In GrandGrocery's PivotTable, which field sits in the report filter (page) area?",
    "options": [
      "Category",
      "Product",
      "Sales",
      "Quarter"
    ],
    "answerIndex": 3,
    "explanation": "Quarter is the page field (B3:C3, set to Q2). Product is the row field (sorted A to Z), Category the column field, and Sales is summarised as Sum of Sales in the values area."
  },
  {
    "id": "w10q17",
    "topic": "W10",
    "question": "Butter is sold under two categories. In Q2 its sales were Condiment $32,565 and Dairy $30,953. What does the Butter row show in the Grand Total column of the Q2 PivotTable?",
    "options": [
      "$32,565",
      "$63,518",
      "$30,953",
      "$1,612"
    ],
    "answerIndex": 1,
    "explanation": "Product is the row field, so both Butter records share one row, with values under Condiment and Dairy; the row's Grand Total adds them: 32,565 + 30,953 = 63,518. $1,612 is the difference, not the total."
  },
  {
    "id": "w10q18",
    "topic": "W10",
    "question": "The Q2 PivotTable's grand total is $2,123,685 and Beverage contributes $155,718. Roughly what share of Q2 sales came from Beverage?",
    "options": [
      "13.6%",
      "15.6%",
      "7.3%",
      "92.7%"
    ],
    "answerIndex": 2,
    "explanation": "155,718 / 2,123,685 = 0.0733, about 7.3%. 92.7% is the share of all the other categories, and 13.6 comes from inverting the ratio (2,123,685 / 155,718)."
  }
]
