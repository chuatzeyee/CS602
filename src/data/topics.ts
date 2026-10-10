import type { Session } from './types'

export const sessions: readonly Session[] = [
  {
    "id": "w1",
    "title": "Week 1 — Introduction to Spreadsheet Modelling",
    "subtitle": "IS602-AY2026-27-S1.pdf",
    "topics": [
      {
        "id": "spreadsheet-models-and-blackbox",
        "title": "What a Spreadsheet Model Is",
        "sections": [
          {
            "heading": "Models as decision support",
            "points": [
              "Week 1 (Introduction to Spreadsheet) is built around three case workbooks: Retail Gasoline, Community Water Tank, and Data Centre Assets.",
              "A model is a simplified representation of a real business situation, built so a decision maker can compare alternatives before committing resources.",
              "The slides stress that a model only supports a decision: it is no cure-all, and it cannot see the future like a crystal ball."
            ]
          },
          {
            "heading": "Influence diagrams",
            "points": [
              "An influence diagram maps how inputs drive computed quantities with arrows: for the water tank, Required Volume, Tank Width and Tank Height feed Tank Length; Length and Width feed Base Area, while Length, Width and Height feed Wall Area; the areas with the two unit costs feed Cost of Tank.",
              "Drawing the influence diagram before building the worksheet fixes the calculation order, so every formula you type already has its precedent cells available."
            ]
          },
          {
            "heading": "Blackbox view",
            "points": [
              "The blackbox view sorts every variable into four roles: Decisions and Parameters flow INTO the blackbox; Performance Measures and Consequence Variables come OUT.",
              "Community Water Tank mapping — Decision: Tank Height; Parameters: Required volume of H2O (30 cbm), Tank Width (2 m), Cost per sqm of base ($10) and of wall ($5); Consequences: Tank Length, Base Area, Wall Area; Performance Measure: Cost of Tank.",
              "Data Centre Assets mapping — Decisions: New Business Volume and New Headcount; Parameters: Past Business Volume, Past Headcount, Past IT Assets #; Performance Measure: New IT Assets #; Consequences: Past IT Performance Ratio, New IT Performance Ratio, Business Growth Rate."
            ]
          }
        ]
      },
      {
        "id": "excel-formula-basics",
        "title": "Formula-Building Basics",
        "sections": [
          {
            "heading": "Three cell content types",
            "points": [
              "The slides name three main kinds of cell content: Text, Values, and Formulas — and a formula always begins with '='.",
              "Formatting changes display, not the stored value: the Assignment 0 solution notes that 'figures formatted as percentages are actually stored as fractions', so they must NOT be divided by 100 again when used in calculations."
            ]
          },
          {
            "heading": "Operator precedence",
            "points": [
              "Excel evaluates parentheses first; then negation, percent (%), exponentiation (^), multiplication or division (* /), and finally addition or subtraction (+ -); operators of equal rank evaluate left to right.",
              "Worked example: =3+2^2*2 returns 11, because 2^2=4 evaluates first, then 4*2=8, then 3+8=11 — not 50 (which would need (3+2)^2*2) and not 19 (which would need 2^(2*2))."
            ]
          }
        ]
      },
      {
        "id": "cell-referencing",
        "title": "Absolute, Relative and Mixed Referencing",
        "sections": [
          {
            "heading": "The four reference forms",
            "points": [
              "C5 is fully relative: copied one column right it becomes D5, copied one row down it becomes C6.",
              "$C$5 is fully absolute: it stays $C$5 wherever the formula is copied.",
              "$C5 locks only the column: copied right it stays $C5, copied down it becomes $C6.",
              "C$5 locks only the row: copied right it becomes D$5, copied down it stays C$5."
            ]
          },
          {
            "heading": "Drag rules",
            "points": [
              "Dragging (filling) to the right changes column letters only; dragging down changes row numbers only — a $ in front of a letter or number freezes exactly that part.",
              "Choose anchors by asking, for each direction you will fill, which part of the reference must NOT move."
            ]
          },
          {
            "heading": "Worked example — performance ratios",
            "points": [
              "In DataCenterAssets Model!E27 the ratio is =$C9/E9: the $ before C pins the Customer Deposit column, so filling right gives =$C9/F9, =$C9/G9, ... across all seven asset classes, while filling down gives =$C10/E10 for the next year.",
              "One correctly anchored formula therefore covers the whole 7-column by 10-row performance-ratio block."
            ]
          }
        ]
      },
      {
        "id": "fill-vs-autofill",
        "title": "Fill vs Auto-Fill",
        "sections": [
          {
            "heading": "Fill Function",
            "points": [
              "Fill copies formulas into adjacent cells, adjusting every relative reference as it goes; it is the workhorse used in every Week 1 workbook (the water tank rows 6-18, the payroll columns, the ratio tables).",
              "Because Fill preserves the formula, the filled cells stay live: change an input and every filled cell recalculates."
            ]
          },
          {
            "heading": "Auto-Fill Function",
            "points": [
              "Auto-Fill produces VALUES, not formulas: it fits a least-squares straight line through the selected numbers and extrapolates it, assuming the points are equally spaced on the x-axis.",
              "RetailGasoline demonstrates it: US prices 1.16, 1.15, 1.51 (1990/1995/2000) auto-fill forward to about 1.62, 1.80, 1.97 for 2005/2010/2015, while Brazil's 3.82, 2.16, 2.93 extrapolates down to 1.19 by 2015 — the straight line is followed even when the trend is doubtful.",
              "Auto-filled cells do not recalculate when the source data changes, because no formula was written."
            ]
          },
          {
            "heading": "When Auto-Fill misleads",
            "points": [
              "In Data Centre Assets, auto-filling the IT asset columns directly is the WRONG approach: asset requirements are driven by business volume through a performance ratio, not by a straight line in time.",
              "The case's own advice: growth has slowed sharply, so crude straight-line planning now risks buying equipment before it is needed, paying for far more than is needed, or being left with technology that has gone obsolete."
            ]
          }
        ]
      },
      {
        "id": "trend-function",
        "title": "The TREND Function",
        "sections": [
          {
            "heading": "Syntax and semantics",
            "points": [
              "TREND(known_y, known_x, new_x, [const]) returns the new_y value on the least-squares straight line fitted through (known_x, known_y).",
              "If const is TRUE or omitted, the intercept b is computed normally; if const is FALSE, the line is forced through the origin (b = 0).",
              "Unlike Auto-Fill, TREND does not require equally spaced x-values and it lives in a formula, so it recalculates when the data changes."
            ]
          },
          {
            "heading": "Anchoring TREND for filling",
            "points": [
              "The naive formula =TREND(E26:E35, C26:C35, C36) is correct in one cell but breaks when filled, because the known ranges slide.",
              "Method 1 fixes it with seven $ signs: =TREND(E$26:E$35,$C$26:$C$35,$C36) — rows of known_y locked (fill down keeps the 10-year history), known_x fully locked (fill right stays on the deposits column), and new_x column-locked so it advances down each projected year."
            ]
          },
          {
            "heading": "Method 1 vs Method 2 vs Method 3",
            "points": [
              "Method 1 (7 $ signs, fixed 10-point window) is correct and sufficient.",
              "Method 2 (5 $ signs, growing the window to include the just-predicted point) is correct but adds no value: the predicted 11th value lies exactly on the fitted line, so including it leaves the fit unchanged.",
              "Method 3 (3 $ signs, a rolling 10-point window that drops old points and rolls in predictions) is graded 'Depends': the slope changes every row because predictions feed later predictions."
            ]
          }
        ]
      },
      {
        "id": "community-water-tank",
        "title": "Case: Community Water Tank",
        "sections": [
          {
            "heading": "Problem framing",
            "points": [
              "Sammy must build an open-top rectangular concrete tank holding 30 cubic metres of water; site constraints fix the width at 2 metres; the base costs $10 per sqm and the sides cost $5 per sqm.",
              "The decision is the tank height: because Volume = L x W x H is fixed at 30, choosing H determines L = 30/(2 x H), which drives both areas and hence cost."
            ]
          },
          {
            "heading": "Model mechanics",
            "points": [
              "Heights 0.25 m to 7 m are enumerated in column B; length is D6 =$C$3/(B6*C6); base area is =C6*D6; side area is =2*(C6+D6)*B6 (two walls of W x H plus two of L x H).",
              "Total cost is computed in one stroke with =SUMPRODUCT($E$3:$F$3,E6:F6), pairing the unit costs (10, 5) with the areas (base, side)."
            ]
          },
          {
            "heading": "Findings",
            "points": [
              "Cost falls steeply across the low heights, then climbs slowly as the tank gets taller — a U-shaped cost curve.",
              "With the width fixed at 2 m and a 30 cbm volume, the cheapest tank costs $305, at a height of 3.87 metres."
            ]
          }
        ]
      },
      {
        "id": "data-centre-assets",
        "title": "Case: Data Centre Assets",
        "sections": [
          {
            "heading": "Problem framing",
            "points": [
              "SAM Bank's CEO wants a SIMPLE model of IT asset capacity: 10 years of actuals — customer deposits growing $3.91b to $23.92b, headcount 743 to 2,320 — across seven asset classes (low/mid/high-end servers, data storage, network switches, racks, floor space).",
              "Five projected years follow: deposits to $45.2b and headcount to 3,800, for which the asset requirements must be derived."
            ]
          },
          {
            "heading": "The three-step method",
            "points": [
              "Step 1: compute the historical performance ratio for each asset class as Business Volume / # Equipment, e.g. Model!E27 =$C9/E9 = 3.91/20 = 0.1955 $b per BIPS of low-end servers.",
              "Step 2: project the ratio forward with TREND — the ratio may be modelled as a function of time (=TREND(E$27:E$36,$B$27:$B$36,$B37)), of business volume (=TREND(E$27:E$36,$C$27:$C$36,$C37)), or of organisation size (=TREND(E$27:E$36,$D$27:$D$36,$D37)).",
              "Step 3: compute the future requirement as projected volume divided by the planned ratio, e.g. Model!E19 =$C19/E37."
            ]
          },
          {
            "heading": "Negotiated performance targets",
            "points": [
              "The raw TREND outputs (rows 45-49) are not used directly: they are copied into E37:K41 as inputs and then adjusted: management negotiates the TREND values and records the agreed figures as planned performance targets.",
              "The workbook itself warns that ratios projected this way may not be acceptable, and asks whether the measures of capacity used are even correct — model outputs are a starting point for judgement, not a substitute for it."
            ]
          }
        ]
      },
      {
        "id": "professional-layout",
        "title": "Professional Layout and Documentation (Assignment 0)",
        "sections": [
          {
            "heading": "Layout requirements",
            "points": [
              "A professional worksheet separates its parts: input parameters in their own labelled cells (NO hardcoding of numbers inside formulas), the output model, test cases demonstrating extremes, a documentation block, notes where needed, and gridlines switched off.",
              "Assignment 0 is ungraded, but its model solution sets the standard: treat each answer as a polished decision-support tool that other people could reuse many times, not just as a set of numbers."
            ]
          },
          {
            "heading": "Documentation convention",
            "points": [
              "The Documentation block lists each labelled cell: input cells are marked '<Input>' and each UNIQUE formula is shown once with its actual cell reference, e.g. Tank length, D6, =$C$3/(B6*C6).",
              "The model solution's evaluation notes require documentation to be readable using just the printed copy (without row and column headers), to contain all input and referenced cells, and to reference cells so that every formula still works after it is copied elsewhere."
            ]
          },
          {
            "heading": "Evaluation checklist from the model solution",
            "points": [
              "Does the worksheet meet the stated requirements, with every required test case done and enough extra cases to expose problems and demonstrate that the model is right?",
              "Could someone else pick it up and use it easily, and is it foolproof: locked against tampering, with only the input cells left unlocked and shaded by conditional formatting while empty?",
              "Does it fit the screen well and print naturally within a page or two, with key results placed at the top so the table can be extended by inserting rows?"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w2",
    "title": "Week 2 — Spreadsheet Engineering",
    "subtitle": "IS602-AY2026-27-S2.pdf",
    "topics": [
      {
        "id": "overview-of-modeling",
        "title": "Overview: Building and Analyzing a Model",
        "sections": [
          {
            "heading": "Two stages of spreadsheet engineering",
            "points": [
              "Stage 1 is Model Building: formulate the relationships, frame what you understand, and construct the spreadsheet model.",
              "Stage 2 is Analyzing the Model: run what-if scenarios and perform sensitivity and trade-off analysis on the completed model.",
              "The week's learning objectives are to describe two schematic models (Influence Diagram and Blackbox), create a spreadsheet model with Input, Intermediate and Output sections, and analyze it."
            ]
          },
          {
            "heading": "The three basic steps",
            "points": [
              "Step 1 — Formulate the Relationships: draw an Influence Diagram to picture how variables connect.",
              "Step 2 — Frame What You Understand: use a Black Box View to classify inputs and outputs.",
              "Step 3 — Construct the Model: build the spreadsheet model itself, then test it with trial values."
            ]
          },
          {
            "heading": "Verification discipline",
            "points": [
              "After constructing the model, test it using trial values and verify the results by hand.",
              "Breaking intermediate calculations into simple formulas makes hand-verification much easier than one giant formula.",
              "The two exercises used this week are Invest in Education and the Inkjet Printer problem."
            ]
          }
        ]
      },
      {
        "id": "influence-diagram",
        "title": "Influence Diagram",
        "sections": [
          {
            "heading": "What an influence diagram is",
            "points": [
              "An influence diagram is a picture that shows the connections between exogenous variables (known or given inputs) and the performance measure (the output of interest).",
              "Its purpose is to formulate the relationships: identify decision variables, parameters (uncontrollable inputs) and outputs, then define the logic that transforms inputs into outputs.",
              "Once the diagram is drawn, you determine the formulas that implement each link."
            ]
          },
          {
            "heading": "How to build one",
            "points": [
              "Start with the performance measure — the output you ultimately care about.",
              "Decompose it into two or more intermediate variables that combine mathematically to produce it.",
              "Keep decomposing each intermediate variable until an input decision variable is defined at the leaves."
            ]
          },
          {
            "heading": "Worked example from the slides",
            "points": [
              "Profit is the performance measure; it decomposes into demand, revenue and cost.",
              "Those intermediate variables ultimately trace back to Price, the decision variable.",
              "This top-down decomposition guarantees every input in the model actually influences the output."
            ]
          }
        ]
      },
      {
        "id": "blackbox-model",
        "title": "Blackbox Model and Variable Classification",
        "sections": [
          {
            "heading": "The four (plus one) variable classes",
            "points": [
              "Decisions (controllable inputs): input variables whose values are to be decided by the user.",
              "Parameters (uncontrollable inputs): input variables with a given or assumed value.",
              "Performance Measures (interested outputs): output variables of key interest to the decision maker.",
              "Consequence Variables (calculated outputs): outputs produced along the way in the calculations.",
              "The InkJetPrinter workbook adds Historical variables: uncontrollable inputs whose values are fixed from past data."
            ]
          },
          {
            "heading": "Why classify",
            "points": [
              "The blackbox view frames what you understand before any formula is written.",
              "Highlighting the key inputs and outputs tells you exactly which cells to vary in what-if analysis later.",
              "Decisions are what you change in trade-off analysis; parameters are what you change in sensitivity analysis."
            ]
          },
          {
            "heading": "Blackbox for the two cases",
            "points": [
              "Inkjet Printer: decisions are Printer Unit Price and Cartridge Unit Price; parameters are Printer Unit Cost, Cartridge Unit Cost and Fixed Cost; the performance measure is Profit; consequence variables are Total Revenue, Total Cost, Printer Demand and Cartridge Demand.",
              "Invest in Education: the decision is the Number of Students per Level; parameters are Education Levels, Investment per Student, Expected Return per Student and Default Probability per level; performance measures are Total Expected Margin and Expected Margin per level; consequence variables are Total Investment, Total Expected Return, Investment per level and Expected Return per level."
            ]
          }
        ]
      },
      {
        "id": "inkjet-price-demand",
        "title": "Inkjet Printer: Bait & Hook and the Price-Demand Function",
        "sections": [
          {
            "heading": "The Bait & Hook strategy",
            "points": [
              "The business model sells the printer at a very low price — possibly below cost — and profits from highly marked-up proprietary cartridges.",
              "Real market data in the workbook shows a Lexmark Z617 printer at $59 while its 12A1980 cartridge costs $65.50, a cartridge-to-printer ratio of 1.11 — the cartridge is dearer than the printer.",
              "At trial prices of $60 (printer) and $20 (cartridge), the printer margin is only (60-55)/55 = 9.1% while the cartridge margin is (20-12)/12 = 66.7%."
            ]
          },
          {
            "heading": "The linear price-demand function",
            "points": [
              "The stated assumptions: demand is 10,000 printers at a price of $0, drops by 600 units for every $10 price increase, and is 0 at $250. Note that the 600-per-$10 straight line on its own already hits 0 near $167, so the $250 end point only fits the tapering tabulated data.",
              "The Demand sheet tabulates the observed data — 10, 9.4, 8.8, ... 0.7 (at $200), 0 (at $250) in thousands — alongside the linear model C10 = 10 - 0.6*(B10-$B$9)/10 that approximates it.",
              "As a straight line this is y = -0.06x + 10, where y is demand in thousands and x is the printer price."
            ]
          },
          {
            "heading": "Refinements in the final model",
            "points": [
              "Printer demand is guarded by an IF: if the cartridge price exceeds 2/3 of the printer price, printer demand drops to 0 — customers see through the hook.",
              "Cartridge demand is driven by printer sales: each printer sold consumes 6 cartridges, so cartridge demand = 6 x printer demand.",
              "The rough model without a price-demand relationship gives an absurd answer — Solver reports the optimal printer price is infinity, proving the model must link demand to price."
            ]
          }
        ]
      },
      {
        "id": "goal-seek-solver",
        "title": "Goal Seek and Solver",
        "sections": [
          {
            "heading": "Goal Seek",
            "points": [
              "Goal Seek is part of Excel's what-if analysis tools: it finds the input value in one cell that makes another cell reach a desired result — it calculates backward.",
              "Use it when you know the answer one formula should produce but not the input value that gets it there.",
              "Goal Seek CANNOT maximize or minimize, and it can only change ONE input cell to hit a target value."
            ]
          },
          {
            "heading": "Solver",
            "points": [
              "Solver searches for an optimal solution to a problem involving several variables.",
              "It can maximize, minimize, or drive an objective cell to a specific value, subject to constraints.",
              "Solver adjusts the decision variable cells while keeping every constraint within its limit."
            ]
          },
          {
            "heading": "Breakeven and optimum in the printer model",
            "points": [
              "Breakeven by Goal Seek: Set cell = Profit, To value = 0, By changing cell = C5 (Printer price). The slides give Profit as C27, its address on the Proto sheet; on the final Model sheet Profit is C32 (C27 there is Printer cost), so set C32.",
              "Breakeven by Solver: objective = the same Profit cell, Value Of = 0, changing C5 — same answer, different tool.",
              "The Model sheet stores the analytic results in its trade-off row: lower breakeven price $26.96, Solver optimum $95.98, upper breakeven $165.00."
            ]
          }
        ]
      },
      {
        "id": "tradeoff-sensitivity",
        "title": "Trade-off Analysis, Sensitivity Analysis and Data Tables",
        "sections": [
          {
            "heading": "Trade-off vs sensitivity",
            "points": [
              "Trade-off analysis changes a DECISION variable to examine how performance measures trade off against each other.",
              "Sensitivity analysis changes UNCONTROLLABLE parameters to see how robust the performance measure is to assumptions.",
              "In the printer model, varying printer price ($26.96 to $165) is trade-off; varying the demand-curve slope or cartridges-per-printer is sensitivity."
            ]
          },
          {
            "heading": "The two-way Data Table",
            "points": [
              "A Data Table tabulates the results of a given model in 2-D so you do not have to recompute manually for every input combination.",
              "The Model(2) sheet builds a two-way table with corner cell C9 = O6 (Profit), row inputs = demand slope from -0.12 to -0.01, column inputs = cartridges per printer from 4.6 to 6.8.",
              "At the base case (slope -0.06, 6 cartridges per printer) the table returns a profit of 1618.96 thousand dollars."
            ]
          },
          {
            "heading": "Conclusion from the sensitivity study",
            "points": [
              "Profit is more sensitive to the demand-curve slope when more cartridges are sold per printer.",
              "The model is more robust (less sensitive) at lower cartridges-per-printer values.",
              "This tells management which assumption deserves the most validation effort before trusting the recommended price."
            ]
          }
        ]
      },
      {
        "id": "invest-in-education",
        "title": "Invest in Education Case",
        "sections": [
          {
            "heading": "The business setting",
            "points": [
              "A social enterprise lets contributors sponsor students; contributors expect returns — it is an investment, not a donation.",
              "The return is a percentage of the future salary of the sponsored person, discounted by the probability the sponsored student defaults.",
              "The model must compute the investment amount, expected return and expected return margin for each of 10 education levels, from Lower primary to Technical degree."
            ]
          },
          {
            "heading": "Model structure",
            "points": [
              "Per level: Investment = Students x Investment-per-Student (C10 = C$16*C19); Expected Return = (1 - Default Probability) x Students x Return-per-Student (C11 = (1-C$21)*C$16*C20).",
              "Expected Margin = Expected Return - Investment (C12 = C11-C10) and Expected Margin % = Margin / Investment (C13 = C12/C10).",
              "Totals use SUM across the 10 levels, and the overall margin percentage is Total Margin divided by Total Investment (L4 = K4/I4)."
            ]
          },
          {
            "heading": "Results the model must report",
            "points": [
              "Total investment is $260,300 and total expected return is $313,583, giving a total expected margin of $53,283.",
              "The highest expected margin in dollars is Upper primary at $7,800; the highest expected margin percentage is Technical degree at 23.15%.",
              "The overall expected margin percentage across all levels is 53,283 / 260,300 = 20.47%."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w3",
    "title": "Week 3 — Lookup Functions & Optimization with Solver",
    "subtitle": "IS602-AY2026-27-S3.pdf",
    "topics": [
      {
        "id": "linear-programming-fundamentals",
        "title": "Linear Programming Fundamentals",
        "sections": [
          {
            "heading": "What linear programming is",
            "points": [
              "Linear Programming (LP) is a technique for minimizing (or maximizing) a linear cost (or profit) function subject to linear equality and/or inequality constraints.",
              "An LP model maps directly onto an influence diagram: Parameters and Decisions feed Consequence Variables, which feed the Performance Measure.",
              "In spreadsheet terms the decision variables are Input cells, the constraints restrict combinations of cells, and the objective function is the Output cell."
            ]
          },
          {
            "heading": "The three components of every LP model",
            "points": [
              "Decision Variables are the inputs the optimizer is free to change, and they can be real numbers, integers, or binary (0/1) values.",
              "Constraints are the <=, >=, or = restrictions that together define the feasible region of allowed solutions.",
              "The Objective Function is the single quantity to maximize, minimize, or drive to a target value."
            ]
          },
          {
            "heading": "Four possible optimization outcomes",
            "points": [
              "A unique optimal solution, when it exists, must occur at a corner point of the feasible region.",
              "Multiple optimal solutions occur when the objective function line lies exactly on one of the constraint boundaries, so every point on that edge is optimal.",
              "The optimal cost can be unbounded (minus infinity for minimization, plus infinity for maximization) when the feasible region is unbounded in the improving direction.",
              "There can be no feasible solution at all when the constraints are contradictory and no feasible region exists."
            ]
          }
        ]
      },
      {
        "id": "solver-in-excel",
        "title": "Setting Up Excel Solver",
        "sections": [
          {
            "heading": "Solver dialog anatomy",
            "points": [
              "In the Solver Parameters dialog you set the objective cell to Max, Min, or a target Value Of, choose the changing (decision variable) cells, and add constraints comparing left-hand-side cells to right-hand-side cells or constants.",
              "Solver is an Excel add-in: it repeatedly changes the decision variable cells, recalculates the workbook, and stops when the objective cannot be improved without violating a constraint.",
              "Range-to-range constraints such as C4:F4 <= C6:F6 apply the comparison cell by cell, which keeps the constraint list short."
            ]
          },
          {
            "heading": "Integer and binary constraints",
            "points": [
              "Integer (int) and binary (bin) constraints may only be applied to decision variable cells, never to calculated consequence cells.",
              "In the slides' truck-fleet scheduling example, the number of trucks sent along each route is the decision variable and must be an integer (a fraction of a truck on a route is useless), while calculated quantities such as total cost are left as formulas.",
              "Adding integer constraints turns the LP into an integer program, which Solver handles but which can no longer be guaranteed to sit on a corner point of the continuous feasible region."
            ]
          }
        ]
      },
      {
        "id": "casino-hotel-lp-model",
        "title": "Casino Hotel Guest-Mix Model",
        "sections": [
          {
            "heading": "Business problem",
            "points": [
              "An integrated resort hotel must choose the best guest mix, from slot machine players to high rollers, that maximizes the hotel's net income, because each guest type has a different revenue and cost profile.",
              "The four guest types are Slot Machine Player, Game of Chance Player, Show-time Guest, and High Roller, and the number of guests of each type is the (integer) decision variable.",
              "Net income is defined as Total Revenue minus Total Expense, where revenue is base revenue plus food revenue per day."
            ]
          },
          {
            "heading": "Constraints in the model",
            "points": [
              "Each guest type has a minimum demand (500, 350, 250, 50) and a maximum demand (1000, 900, 750, 80) that bound its decision variable.",
              "Total guests must lie between the occupancy floor of 1000 and the fire safety ceiling of 2000.",
              "Total floor space required (guests times floor space per guest of 12, 28, 8, and 95 square units) must not exceed the net space available, which is gross space 50000 minus stage space 5000 minus dining space 5000, i.e. 40000."
            ]
          },
          {
            "heading": "Echo Office Supplies variation",
            "points": [
              "The Echo Office Supplies case minimizes the drop in revenue instead of maximizing income, with 18 new prices (3 products - Widgets, Sprockets, Gizmos - times 6 price ranges) as real-valued decision variables.",
              "Its constraints require the revenue reduction ratio (Revenue_before minus Revenue_after) divided by Revenue_before to be at least 9% for the 5 big customers as a group and at least 5% for the 45 other customers as a group, with prices dropped for all customers and each individual big customer's revenue reduced by at least 8%.",
              "The case's Proto sheet retrieves the selected customer's projected sales with a two-MATCH INDEX: G17 = INDEX($G$21:$J$70, MATCH($B$17,$B$21:$B$70,0), MATCH(G20,$G$20:$J$20,0)), showing how lookup functions and optimization combine in one model."
            ]
          }
        ]
      },
      {
        "id": "classic-lookup-functions",
        "title": "LOOKUP and VLOOKUP",
        "sections": [
          {
            "heading": "LOOKUP",
            "points": [
              "LOOKUP(lookup_value, lookup_vector, [result_vector]) requires the lookup_vector to be sorted in ascending order.",
              "LOOKUP finds the largest value in the lookup_vector that is less than or equal to the lookup_value, then returns the corresponding entry from the result_vector.",
              "If the lookup_value is smaller than every value in the lookup_vector, LOOKUP returns an error."
            ]
          },
          {
            "heading": "VLOOKUP",
            "points": [
              "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]) always searches the leftmost column of the table_array and returns the value from the column numbered col_index_num.",
              "With range_lookup TRUE or omitted, VLOOKUP does an approximate match (largest value less than or equal to the lookup_value) and the first column must be sorted ascending.",
              "With range_lookup FALSE, VLOOKUP returns the first exact match in any sort order, or #N/A if no exact match exists.",
              "VLOOKUP cannot look to the left of the search column, which is a key reason to prefer INDEX plus MATCH or XLOOKUP."
            ]
          }
        ]
      },
      {
        "id": "match-and-index",
        "title": "MATCH, INDEX, and Their Combination",
        "sections": [
          {
            "heading": "MATCH match types",
            "points": [
              "MATCH(lookup_value, lookup_array, [match_type]) gives where the lookup value sits in the array (1 for the first cell), not the item itself.",
              "Match_type 1 (the default) finds the largest value less than or equal to the lookup_value and requires the array to be sorted ascending.",
              "Match_type 0 finds the first value exactly equal to the lookup_value and works on data in any order.",
              "Match_type -1 finds the smallest value greater than or equal to the lookup_value and requires the array to be sorted descending; MATCH is the only classic lookup function that can approximate-match descending data."
            ]
          },
          {
            "heading": "INDEX and INDEX+MATCH",
            "points": [
              "INDEX(array, row_num, [column_num]) returns the value at the given row and column position of the array.",
              "Nesting MATCH inside INDEX replaces a hard-coded row or column number with a computed position, e.g. INDEX(C2:C226, MATCH(\"Singapore\", B2:B226, 0)) returns Singapore's GDP per capita.",
              "A two-dimensional lookup uses two MATCH calls, one for row_num and one for column_num, inside a single INDEX.",
              "Unlike VLOOKUP, INDEX+MATCH can return values from any column relative to the search column, including columns to its left."
            ]
          }
        ]
      },
      {
        "id": "spill-formulas",
        "title": "Spill Formulas",
        "sections": [
          {
            "heading": "How spilling works",
            "points": [
              "The old Array Formula (Ctrl+Shift+Enter) has been replaced by the Spill formula in modern Excel: a formula that returns multiple values automatically spills them into neighboring empty cells.",
              "Setting the column_num argument of INDEX to 0, e.g. INDEX(G21:J70, MATCH(B17,B21:B70,0), 0), returns the entire matching row as a spilled range.",
              "To enter a spill formula you start by selecting only the first cell; Excel fills the rest of the spill range itself."
            ]
          },
          {
            "heading": "Controlling spill behavior",
            "points": [
              "Adding the @ operator in front of a formula (implicit intersection) undoes the spill and returns only a single value.",
              "A spill fails with a #SPILL! error if any cell in the target spill range is not empty."
            ]
          }
        ]
      },
      {
        "id": "xlookup-and-ifs",
        "title": "XLOOKUP and IFS",
        "sections": [
          {
            "heading": "XLOOKUP arguments",
            "points": [
              "XLOOKUP(lookup_value, lookup_array, return_array, ...) keeps the lookup and return arrays separate, so it can look in any direction; the optional trailing arguments set the not-found result, the match mode and the search mode.",
              "Match_mode 0 (the default) is exact match, -1 returns the next smaller item if no exact match, 1 returns the next larger item, and 2 allows wildcard matching with *, ?, and ~.",
              "Search_mode 1 (the default) searches from the first item, -1 searches from the last item, 2 does a binary search on ascending data, and -2 does a binary search on descending data.",
              "With the default exact match, XLOOKUP returns #N/A when the value is absent unless the if_not_found argument supplies a fallback value."
            ]
          },
          {
            "heading": "IFS for multi-way branching",
            "points": [
              "IFS(condition1, value1, condition2, value2, ...) evaluates conditions in order and returns the value paired with the first condition that is TRUE.",
              "Using TRUE as the final condition creates a catch-all branch, replacing deeply nested IF formulas.",
              "Capping A1 to the range 0 to 100 can be written three equivalent ways: =IF(A1<0,0,IF(A1>100,100,A1)), =MIN(100,MAX(0,A1)), or =IFS(A1<0,0,A1>100,100,TRUE,A1)."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w4",
    "title": "Week 4 — Financial Functions & Modeling",
    "subtitle": "IS602-AY2026-27-S4.pdf",
    "topics": [
      {
        "id": "time-value-of-money",
        "title": "Time Value of Money & the 7 Financial Functions",
        "sections": [
          {
            "heading": "Two groups of financial functions",
            "points": [
              "Week 4 covers seven Excel financial functions in two groups: Group 1 handles constant periodic cash flows — PMT(), PV(), FV(), RATE(), NPER() — while Group 2 handles uneven cash flows — NPV() and IRR().",
              "All Group 1 functions share the same five quantities (rate, nper, pmt, pv, fv): each function computes one of them given the others, so they are essentially five views of a single time-value-of-money equation.",
              "Money has time value: a dollar today is worth more than a dollar in the future because it can earn interest, which is why cash flows at different times cannot be compared without discounting or compounding."
            ]
          },
          {
            "heading": "Sign convention and point of reference",
            "points": [
              "Excel's sign convention: a NEGATIVE amount is money taken away from the point of reference, and a POSITIVE amount is money added to the point of reference (e.g., from the borrower's view a loan received is positive and repayments are negative).",
              "Today is the END of Period 0, which is the same instant as the BEGINNING of Period 1 — getting this timeline convention right is essential before applying any financial function.",
              "The [type] argument controls timing within a period: type 0 (the default) means payments occur at the END of each period; type 1 means payments occur at the BEGINNING of each period."
            ]
          },
          {
            "heading": "Consistency of rate, nper and pmt",
            "points": [
              "rate, nper and pmt must all be expressed in the SAME period terms: for monthly payments on an 8% p.a. loan over 10 months use PMT(8%/12, 10, 10000) = -$1,037.03, not PMT(8%, 10, 10000).",
              "Mixing terms gives nonsense: in TimeValue.xlsm the Scratch sheet contrasts =PMT(C13/12,C14,C12) (monthly rate, months) against the wrong =PMT(C13,C14/12,C12) (annual rate with fractional years).",
              "Annual example: to accumulate $10,000 in 6 years, PMT(8%, 6, 0, 10000) = -$1,363.15 must be deposited at the end of each year."
            ]
          }
        ]
      },
      {
        "id": "pmt-pv-fv",
        "title": "PMT, PV and FV with Worked Examples",
        "sections": [
          {
            "heading": "PMT — equal periodic payments",
            "points": [
              "PMT(rate, nper, pv, [fv], [type]) returns the constant payment per period; PMT(8%/12, 10, 10000) = -$1,037.03 is the monthly payment to clear a $10,000 loan at 8% p.a. over 10 months.",
              "PMT exercise: borrow $140,000 for a car over 5 years at 5% p.a. (monthly rest) with 60 monthly payments plus a $10,000 balloon payment with the last payment — the answer is =PMT(5%/12, 60, 140000, -10000) ≈ -$2,494.93 per month.",
              "The same answer is verified WITHOUT financial functions by a 60-row residue-loan schedule where each month's residue = previous residue × (1 + 5%/12) − payment, and Goal Seek (or trial and error) drives the last residue to the $10,000 target."
            ]
          },
          {
            "heading": "PV — present value",
            "points": [
              "PV(rate, nper, pmt, [fv], [type]) converts future constant cash flows to today's value; PV(8%/12, 10, -1037.03) = $10,000 confirms the PMT example in reverse.",
              "PV(8%, 5, , 10000) = -$6,805.83 shows how much to deposit today to reach $10,000 in 5 years at 8% p.a.; PV(8%/12, 5*12, 500) = -$24,659.22 prices a 5-year stream of $500 monthly receipts.",
              "PV exercise: nine months overseas needing $3,500 at the BEGINNING of each month plus an extra $600 in the last month, at 3% p.a. interest — the answer is =PV(3%/12, 9, -3500, -600, 1) ≈ $31,774.27, cross-checked by a balance schedule where balance = (previous balance − withdrawal) × (1 + 3%/12)."
            ]
          },
          {
            "heading": "FV — future value",
            "points": [
              "FV(rate, nper, pmt, [pv], [type]) compounds deposits forward: FV(8%/12, 10, -100) = $1,030.54 for ten $100 monthly deposits, and FV(8%/12, 10, -100, -300) = $1,351.15 when starting with $300 already in the account.",
              "FV exercise: invest $50,000 now and add $8,000 each year for 10 years at 6.5% p.a. — the answer is =FV(6.5%, 10, -8000, -50000), verified by a schedule where each year's investment = previous × (1 + 6.5%) + $8,000 injection."
            ]
          }
        ]
      },
      {
        "id": "rate-nper",
        "title": "RATE and NPER — Iterative Solutions",
        "sections": [
          {
            "heading": "RATE is solved by iteration",
            "points": [
              "RATE(nper, pmt, pv, [fv], [type], [guess]) is computed by iteration starting from the guess (default 10%) and returns #NUM! if successive answers do not converge to within 0.0000001 after 20 iterations.",
              "RATE(12, -100, 1000) ≈ 2.92% per month is the rate on a $1,000 loan repaid by twelve $100 payments; RATE(12, , -1000, 2000) ≈ 5.95% per month doubles $1,000 to $2,000 in 12 periods with no intermediate payments (the slides round these to 3% and 6%).",
              "RATE exercise: =RATE(10, -8000, -50000, 250000) ≈ 9.59% p.a. is the return needed for $50,000 now plus $8,000 yearly injections to grow to $250,000 in 10 years — TimeValue.xlsm confirms 0.09592693 by Goal Seek on the schedule."
            ]
          },
          {
            "heading": "NPER and judging sensible answers",
            "points": [
              "NPER(rate, pmt, pv, [fv], [type]) returns the number of periods: NPER(12%, -100, -1000, 10000) ≈ 15.68 years (the slide truncates it to 15.67) for $1,000 now plus $100 yearly deposits at 12% to reach $10,000.",
              "Excel accepts ANY sign combination without complaint: NPER(12%, -100, -1000) ≈ -6.96 years (printed as -6.95 on the slide) is mathematically returned but is nonsense, so the modeler must judge whether results make sense; NPER(-12%, -100, 1000) = 6.17 years shows a negative rate case.",
              "NPER exercise: =NPER(8%, -8000, -50000, 250000) ≈ 11.01 years is how long $50,000 plus $8,000 yearly at 8% takes to reach $250,000. The schedule check =MATCH(M10, N14:N34, 1) returns 12: the list starts at year 0 in N14, so position 12 is year 11 (about $249,746, the last balance still below target) and the $250,000 mark is passed during year 12."
            ]
          }
        ]
      },
      {
        "id": "npv-irr",
        "title": "NPV and IRR for Uneven Cash Flows",
        "sections": [
          {
            "heading": "NPV rules",
            "points": [
              "NPV(rate, value1, value2, …) discounts a series of UNEVEN cash flows assumed to occur at the END of each period, with value1 at the end of period 1; Excel 2003 allows up to 29 values and Excel 2007+ up to 254.",
              "A first investment made TODAY (beginning of period 1 / end of period 0) must be EXCLUDED from the NPV() arguments and ADDED to the NPV result, as in TimeValue.xlsm cell C10: =NPV(B10, C15:C24) + C14 where C14 = -200000.",
              "NPV(10%, -10000, 3000, 4200, 6800) = $1,188.44 — the individual present values are -$9,090.91 (the slide shows -$9,090.90), $2,479.34, $3,155.52 and $4,644.49, each computed manually as CashFlow/(1+rate)^n.",
              "NPV differs from PV: PV requires constant cash flows but allows begin- or end-of-period timing, while NPV allows varying cash flows but fixes them at end of period."
            ]
          },
          {
            "heading": "IRR rules",
            "points": [
              "IRR(values, [guess]) needs at least ONE positive and ONE negative value, assumes cash flows are equally spaced at the end of each period, and iterates from the guess until accurate within 0.00001%, returning #NUM! if 20 tries do not converge.",
              "IRR is the interest rate at which NPV equals zero — the project in TimeValue.xlsm ($200,000 out, ten yearly inflows) has =IRR(C14:C24) ≈ 24.05%, confirmed by Goal Seek driving =SUM(N14:N24) of manual present values to zero.",
              "Unlike NPV, the initial investment IS included in the IRR() value range — the IRR exercise stresses that ALL values, including the year-0 outflow, go into the argument."
            ]
          }
        ]
      },
      {
        "id": "goal-seek-data-tables",
        "title": "Goal Seek and Data Tables",
        "sections": [
          {
            "heading": "Goal Seek",
            "points": [
              "Goal Seek (Data / What-If Analysis / Goal Seek) automates trial-and-error: you specify a formula cell to SET, the target VALUE, and the input cell to CHANGE, and Excel iterates the input until the formula hits the target.",
              "In TimeValue.xlsm every function sheet also has a 'Without Excel financial function' schedule. Where the unknown is an input (PMT, PV, RATE, IRR) the sheet says to solve it 'by trial and error, or use Goal Seek' — e.g. on the PMT sheet, Goal Seek changes the monthly payment until the last residue N74 equals the $10,000 balloon target; the FV, NPER and NPV schedules just compute forward and need no search."
            ]
          },
          {
            "heading": "One-variable and two-variable data tables",
            "points": [
              "A one-variable (column-oriented) data table lists input values down a column, puts the formula one row above and one column to the right, selects the block, then Data / What-If Analysis / Data Table with the Column input cell set to the model's input.",
              "A two-variable data table places the formula in the TOP-LEFT intersection cell, one input's values across the top row and the other input's values down the left column, then supplies both the Row input cell and Column input cell.",
              "TimeValue.xlsm's Model sheet builds the same table manually with =$C$5*(1+D$8)^$C9 (mixed absolute/relative references) across rates 5%–12% and years 1–20, then rebuilds it as a real Excel Data Table in the exercise columns — the table cells appear as {=TABLE(...)} array formulas."
            ]
          }
        ]
      },
      {
        "id": "circular-reference-charity",
        "title": "Circular References & the Charity Donation Model",
        "sections": [
          {
            "heading": "What a circular reference is",
            "points": [
              "A circular reference occurs when a formula refers back to its own cell, directly or through a chain of other cells; Excel cannot evaluate it normally and needs ITERATION to resolve it.",
              "Iterative calculation may CONVERGE (successive values settle to a stable answer) or DIVERGE (values grow without bound) — only converging circular models are useful.",
              "To resolve one, enable File / Options / Formulas / 'Enable iterative calculation' and reduce the Maximum change parameter to 0.0001, as documented in CharityDonation.xlsx's Model sheet notes."
            ]
          },
          {
            "heading": "The Charity Donation circular model",
            "points": [
              "Sam's firm expects $180,000 revenue and $108,500 costs; he will donate 10% of AFTER-TAX profit to charity, but the charity donation is itself deductible before the 25% tax — so Charity = 10% × [(Revenue − Cost − Charity) × (1 − 25%)], a circular definition.",
              "The model formulas are D12 =MAX(0,C11*D15) for charity, D14 =D5-D6-D12 for profit before tax, D9 =MAX(0,C8*D14) for tax, and D15 =(1-C8)*D14 for profit after tax — the MAX(0,…) guards handle the no-profit case.",
              "With iteration enabled the donation converges to about $4,988 (≈$5,000): algebraically C = 0.075 × (71,500 − C) gives C = $4,988.37, so charity is exactly 7.5% (= 10% × 75%) of profit before tax (cell D18 =D12/D14 = 0.075)."
            ]
          },
          {
            "heading": "Showing the iterations (extra)",
            "points": [
              "Model(2) replays 25 iterations explicitly in rows numbered #0–#25: E9 =MAX(0,D$5*H8) takes 10% of the previous row's after-tax profit, F9 =MAX(0,C$8-D$8-E9) recomputes profit before tax, and each row's donation moves closer to the fixed point.",
              "A converging 'spider web' chart plots Donation against Profit-after-tax using step formulas T9 =IF(ISODD($S9),T8,INDEX($E$8:$E$33,INT($S9/2)+1)) and U9 =IF(ISEVEN($S9),U8,INDEX($H$8:$H$33,INT($S9/2)+1)) so the path staircases into the convergence point."
            ]
          }
        ]
      },
      {
        "id": "black-scholes-options",
        "title": "Black-Scholes Option Pricing & New Math Functions",
        "sections": [
          {
            "heading": "Options and the Black-Scholes formulas",
            "points": [
              "A CALL option gives the holder the right to BUY an asset at a pre-agreed exercise price in the future; a PUT option gives the right to SELL — the formulas were derived in 1973 by Fischer Black and Myron Scholes.",
              "Call price = S·N(d1) − X·exp(−rf·t)·N(d2) and Put price = −S·N(−d1) + X·exp(−rf·t)·N(−d2), where S is the share price now, X the exercise price, rf the risk-free rate, σ the volatility per year and t the time to maturity in years.",
              "The intermediates are d1 = [LN(S/X) + (rf + σ²/2)·t] / [σ·√t] and d2 = [LN(S/X) + (rf − σ²/2)·t] / [σ·√t]; N( ) is the cumulative standard Normal distribution.",
              "In BlackScholes.xlsm with S=102.5, X=100, rf=7%, σ=0.8607, t=0.3556 years, cell D15 =D4*D13-D5*EXP(-D6*D8)*D14 prices the call and D21 =-D4*D19+D5*EXP(-D6*D8)*D20 prices the put."
            ]
          },
          {
            "heading": "New Excel functions: LN, EXP, NORMSDIST, NORMDIST",
            "points": [
              "LN(number) returns the natural logarithm and EXP(number) returns e raised to the power — EXP is the inverse of LN.",
              "NORMSDIST(z) returns the cumulative standard Normal probability (mean 0, standard deviation 1); NORMSDIST(0) = 0.5 because half the distribution lies below the mean.",
              "NORMDIST(x, mean, standard_dev, cumulative) handles a general Normal; standardize with z = (x − mean) / sd so that NORMDIST(x, m, s, TRUE) = NORMSDIST((x−m)/s)."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w5",
    "title": "Week 5 — Monte Carlo Simulation",
    "subtitle": "IS602-AY2026-27-S5.pdf",
    "topics": [
      {
        "id": "monte-carlo-fundamentals",
        "title": "Monte Carlo Simulation Fundamentals",
        "sections": [
          {
            "heading": "What Monte Carlo simulation is",
            "points": [
              "Monte Carlo simulation estimates the distribution of an outcome variable by repeated random sampling from the probability functions of the input variables.",
              "It follows 3 steps: (1) specify the probability distributions of the inputs, (2) perform one trial by drawing a random number and equating it to the cumulative probability to get a sampled input value, (3) repeat for many trials to build a distribution of answers.",
              "The output of a simulation is a distribution of answers, NOT one single answer — you then summarise it with statistics such as the mean or a probability.",
              "A random draw can be equated to the cumulative probability because cumulative probability always lies between 0 and 1.0, exactly the range RAND() generates in."
            ]
          },
          {
            "heading": "RAND() vs RANDBETWEEN()",
            "points": [
              "RAND() returns a continuous uniform random real number in [0, 1.0), i.e. it can equal 0 but never 1; it is used as a cumulative probability number.",
              "RANDBETWEEN(bottom, top) returns a discrete uniform random integer between bottom and top inclusive; it is used as a position number (e.g. picking which data point to resample).",
              "RANDBETWEEN historically required the Analysis Toolpak add-in; INT(RAND()*(top-bottom+1))+bottom is the equivalent built from RAND() alone.",
              "Pressing F9 recalculates the worksheet, generating a fresh set of random numbers — this is how you 'run' the simulation repeatedly in Excel."
            ]
          },
          {
            "heading": "A common RAND() pitfall",
            "points": [
              "Writing =IF(RAND()<0.5, RAND(), \"Wow\") is WRONG if you intend to reuse the same random value: each RAND() call generates a different number.",
              "The correct pattern is to put RAND() in its own cell (e.g. J15 =RAND()) and reference it (K15 =IF(J15<0.5,J15,\"Wow\")) so the same value is tested and returned.",
              "The same trap appears in the 4-door Monty Hall extension: IF(RAND()<1/3, Door 1, IF(RAND()>2/3, Door 4, Door 3)) is wrong because the two RAND() calls generate two different values; fix it with a helper cell C5=RAND() then IF(C5<1/3,...,IF(C5>2/3,...)), or re-scale the second branch as IF(RAND()>0.5, Door 4, Door 3)."
            ]
          }
        ]
      },
      {
        "id": "resampling-overview",
        "title": "Resampling (Boot-strapping): Three Methods",
        "sections": [
          {
            "heading": "Why resample",
            "points": [
              "Resampling, also called boot-strapping, generates additional representative data from a small sample so that simulation models have enough realistic input data.",
              "Method 1 (M1): build frequency bins and a cumulative relative frequency (CRF) table, then look up a RAND() value in the CRF column.",
              "Method 2 (M2): resample directly from the sample data — M2a for discrete data using SMALL + RANDBETWEEN, M2b for continuous data using PERCENTILE + RAND with interpolation.",
              "Method 3 (M3): use inverse distribution functions — M3a for continuous distributions (Uniform, Normal, Exponential, ...), M3b for discrete distributions (Uniform, Binomial, Poisson)."
            ]
          }
        ]
      },
      {
        "id": "m1-frequency-bins",
        "title": "M1 — Frequency Bins and the CRF Table",
        "sections": [
          {
            "heading": "Building and using a CRF table",
            "points": [
              "Tabulate each value's frequency, convert to relative frequency, then accumulate to get the cumulative relative frequency (CRF); the CRF spans 0 to 1.0.",
              "Draw RAND() and find which CRF interval it falls into; the corresponding value is the simulated observation.",
              "Worked example (number of children): CRF boundaries 0 / 0.381 / 0.667 / 0.869 / 0.964 / 1.0 for values 0-4; a RAND() of 0.556 falls between 0.381 and 0.667, so the simulated value is 1 child.",
              "Toy-store example: 0, 1, 2, 3 or 4 children arrive in 10%, 20%, 30%, 30% and 10% of the minutes respectively, giving lookup boundaries 0.0→0, 0.1→1, 0.3→2, 0.6→3, 0.9→4 arrivals."
            ]
          },
          {
            "heading": "The LOOKUP down-shift gotcha",
            "points": [
              "LOOKUP finds the LARGEST lookup value that is LESS THAN OR EQUAL TO the target, so the CRF column must be shifted DOWN one row relative to the values column (each value is matched with the cumulative probability of all values below it).",
              "In DataSim's Discrete sheet this is coded as =LOOKUP(RAND(),M$12:M$32,L$13:L$33) — note the value range L$13:L$33 starts one row lower than the CRF range M$12:M$32.",
              "With VLOOKUP the CRF must be the LEFTMOST column of the table, e.g. VLOOKUP(0.556, H9:I13, 2) returns the value from column 2 for the largest CRF ≤ 0.556."
            ]
          }
        ]
      },
      {
        "id": "m2-resampling-from-sample",
        "title": "M2 — Resampling Directly from Sample Data",
        "sections": [
          {
            "heading": "M2a: discrete data with SMALL + RANDBETWEEN",
            "points": [
              "X' = SMALL(raw data range, RANDBETWEEN(1, N)) picks the k-th smallest value where k is a random position between 1 and the sample size N — every original data point is equally likely to be drawn.",
              "Worked example: sample of N=25 with frequencies 1→3, 2→10, 3→10, 4→2; if RANDBETWEEN(1,25) returns 8, then SMALL returns the 8th smallest value, which is 2.",
              "DataSim Discrete sheet formula: =SMALL($C$12:$C$997,RANDBETWEEN(1,$C$8)) where $C$8 holds =COUNT(C12:C997)."
            ]
          },
          {
            "heading": "M2b: continuous data with PERCENTILE + RAND",
            "points": [
              "X' = PERCENTILE(raw data range, RAND()) implicitly sorts the data, assigns percentile positions (k-1)/(N-1), and linearly interpolates between the two data points that bracket the drawn percentile.",
              "Worked example: sorted data 1.0, 3.0, 5.0, 7.0 sit at percentiles 0, 1/3, 2/3 and 1 (the slide rounds the middle two to 0.33 and 0.66); RAND()=0.5 interpolates via (0.5−1/3)/(2/3−1/3) = (X'−3.0)/(5.0−3.0), giving X' = 4.0, which is what PERCENTILE returns (the rounded 0.33/0.66 would give about 4.03).",
              "DataSim's Explain sheet verifies this consistency: =SMALL($C$6:$C$30,B6) sorts the data, =(B6-1)/24 computes each point's percentile, =PERCENTILE($C$6:$C$30,F6) recovers the X value, and =PERCENTRANK($C$6:$C$30,E6) recovers the Y value.",
              "For discrete data you can also round the continuous resample: =ROUND(PERCENTILE($C$12:$C$997,RAND()),0)."
            ]
          }
        ]
      },
      {
        "id": "distribution-functions",
        "title": "Excel Probability Distribution Functions",
        "sections": [
          {
            "heading": "The four workhorse functions",
            "points": [
              "BINOMDIST(number_s, trials, probability_s, cumulative) — Binomial: probability of a number of successes in n independent trials each with success probability p; P(X=k) = nCk p^k (1−p)^(n−k).",
              "POISSON(x, mean, cumulative) — Poisson: probability of x events in a fixed interval given average rate λ; P(X=k) = e^−λ λ^k / k!.",
              "EXPONDIST(x, lambda, cumulative) — Exponential: models inter-arrival times; lambda is the arrival RATE (1/mean), and f(x) = λe^−λx.",
              "NORMDIST(x, mean, standard_dev, cumulative) — Normal; NORMSDIST(z) gives the STANDARD normal CDF only, with z = (x − µ)/σ."
            ]
          },
          {
            "heading": "The cumulative flag",
            "points": [
              "cumulative = TRUE returns the CDF, i.e. P(X ≤ x).",
              "cumulative = FALSE returns the PMF (probability mass function, discrete) or PDF (probability density function, continuous) at x.",
              "The sum of two dice Y = X1 + X2 illustrates how distributions combine: Y ranges 2 to 12 with a triangular shape peaking at 7."
            ]
          }
        ]
      },
      {
        "id": "m3-inverse-distributions",
        "title": "M3 — Inversion of Distribution Functions",
        "sections": [
          {
            "heading": "M3a: inverting continuous distributions",
            "points": [
              "Continuous Uniform: X' = min + RAND()*(max − min).",
              "Normal: X' = NORMINV(RAND(), mean, SD); Standard normal: X' = NORMSINV(RAND()).",
              "Exponential: X' = −mean*LN(1−RAND()), derived by setting Y = F(x) = 1 − e^−λx and solving for x = (−1/λ)ln(1−Y); since 1−RAND() is itself uniform on (0,1], X' = −mean*LN(RAND()) is equivalent.",
              "EXTRA distributions: Triangular uses P=(mode−min)/(max−min) and one stored draw U=RAND(): X' = min + (max−min)*SQRT(P*U) if U ≤ P, else X' = max − (max−min)*SQRT((1−P)*(1−U)) — DataSim's Triangular column computes exactly this, whereas the slide's second branch starts from min + instead of max −, a typo that would put large draws near min; Lognormal X' = EXP(NORMINV(RAND(), Mean(LN(X)), SD(LN(X)))) = LOGINV(RAND(), mean, SD); Gamma X' = GAMMAINV(RAND(), alpha, beta) with Erlang as the special case of waiting time to the h-th Poisson arrival; Weibull X' = beta*(−LN(RAND()))^(1/alpha); Beta X' = BETAINV(RAND(), alpha, beta, A, B) where A and B bound x."
            ]
          },
          {
            "heading": "M3b: inverting discrete distributions",
            "points": [
              "Discrete Uniform: X' = RANDBETWEEN(min, max).",
              "Binomial: X' = CRITBINOM(trials, probability_s, RAND()) — the modern name is BINOM.INV; it returns the smallest value whose cumulative binomial probability is ≥ the RAND() draw.",
              "Poisson: there is no direct inverse, so use the Binomial approximation with very large n and small p: X' = CRITBINOM(n, mean/n, RAND()) with n large (e.g. 1000), because Poisson is the limit of Binomial with λ = np."
            ]
          }
        ]
      },
      {
        "id": "monty-hall-simulation",
        "title": "Monty Hall Simulation",
        "sections": [
          {
            "heading": "The game and the modelling question",
            "points": [
              "Three doors hide one grand prize; the contestant selects a door, the host opens one remaining door WITHOUT the prize, and the contestant may switch to the other closed door or stay.",
              "Grand prize = $5000, booby prize = $100; if we can determine P1 (win probability if stay) and P2 (win probability if switch), we can budget the total prize money for 3 contestants over 50 nights.",
              "P1 + P2 = 1 because switching wins exactly when staying loses.",
              "The influence diagram identifies parameters (decision to switch/stay, initial selected door), decisions (prize door placement, prize amount), consequence variables (door to reveal, final doors, win probabilities) and the performance measure (total prize money to prepare)."
            ]
          },
          {
            "heading": "The three simulation steps",
            "points": [
              "Step 1: randomly generate the prize door and the selected door with RANDBETWEEN(1,3), then determine the door to reveal using the Reveal Door Options Matrix: Revealed door = INDEX(array, prize door, selected door), where the diagonal cells hold RANDBETWEEN(2,3), IF(RAND()>0.5,1,3) and RANDBETWEEN(1,2) because the host has two doors to choose from when prize = selected.",
              "Step 2: determine the final door if the contestant stays (= selected door), if the contestant changes — via the Change Door Options Matrix or the shortcut Change door = 6 − (revealed door + selected door) — and add a 'random door' second contestant with no prior knowledge who picks between the 2 remaining doors with IF(RAND()<0.5, selected, changed).",
              "Step 3: evaluate a win as 1 and a loss as 0 using formulas such as IF(door choice = prize door, 1, 0) or (door choice = prize door)*1 (TRUE*1=1, FALSE*1=0), so probabilities can be computed with AVERAGE().",
              "Analytical result: probability of winning if the contestant changes door = 2/3 (of the 3 equally likely initial picks, 2 lead to a win after switching); staying wins 1/3, and the no-knowledge second contestant wins 1/2."
            ]
          }
        ]
      },
      {
        "id": "village-water-simulation",
        "title": "Village Water Tank Sizing",
        "sections": [
          {
            "heading": "The model",
            "points": [
              "Goal: determine the required water storage tank sizes (one village tank, one household tank) to satisfy fluctuating demand using rainwater supply delivered at a constant flow rate.",
              "Monthly rainfall supply = catchment area size × average rainfall × loss coefficient; monthly demand = village population × demand per person per day × number of days (constant flow rate).",
              "Rainfall varies month to month and household demand varies hour to hour, but the water drawn from the Village Tank to Household Tanks must be a constant flow; each household is assumed to have 5 members out of a 1000-person village."
            ]
          },
          {
            "heading": "Village tank size",
            "points": [
              "Compute monthly Cumulative Supply from expected average rainfall, catchment area and loss coefficient for 12 months, and monthly Cumulative Demand from population and per-person demand.",
              "Tank size = MAX(0, Cumulative Supply − Cumulative Demand) over all months − MAX(0, Cumulative Supply − Cumulative Demand) in Dec.",
              "May has the maximum supply-demand gap, so the tank must cater for it; the December term is subtracted so leftover year-end water is removed, otherwise the tank would need to grow every year."
            ]
          },
          {
            "heading": "Household tank size and adding uncertainty",
            "points": [
              "Household hourly Cumulative Demand uses the sinusoidal consumption pattern (1 − SIN(i/24 * 2π)) for the i-th hour, while hourly Cumulative Supply is the household's constant-flow share (5 members out of 1000).",
              "Household tank size = MAX(0, Cum Supply − Cum Demand) over 24 hours − MAX(0, Cum Supply − Cum Demand) at Hour 24; hours 11-12 show the maximum difference.",
              "To model unreliable rainfall, replace fixed average rainfall with MAX(0, average rainfall − variation) where variation = NORMINV(RAND(), 0, CV*MEAN) and CV = SD/MEAN; simulation then gives the probability that Supply > Demand, which advises a safety factor for the tank size."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w6",
    "title": "Week 6 — Queuing Model, Date & Time, and Macro Recording (VBA)",
    "subtitle": "IS602-AY2026-27-S6.pdf",
    "topics": [
      {
        "id": "date-serial-values",
        "title": "How Excel Stores Dates and Times",
        "sections": [
          {
            "heading": "Dates are serial values",
            "points": [
              "Excel stores every date as a sequential whole number called a serial value, which is why dates can be added, subtracted and compared like any other number.",
              "There are two date systems: the 1900 date system (the Windows default) and the 1904 date system (the slides list it as the Mac default; that holds for older Excel for Mac, while Excel for Mac 2011 and later also default to 1900).",
              "In the 1900 system 1 Jan 1900 = 1. For a modern reference point, the Scratch sheet of CallCenter-modified.xlsx rebuilt 27 Sep 2026 with =DATE(B2,B3,B4) and got 46292."
            ]
          },
          {
            "heading": "The phantom 29 Feb 1900",
            "points": [
              "The 1900 system gives serial 60 to 29 Feb 1900, a day that never existed (1900 was not a leap year), so 1 Mar 1900 becomes 61 instead of 60.",
              "The slides spell out the consequence: subtract a date before 29 Feb 1900 from a date after it and the answer is one greater than it should be.",
              "The 1904 system has no such gap: 1 Jan 1904 = 0, 29 Feb 1904 = 59 (a real leap day) and 1 Mar 1904 = 60.",
              "Business dates in this course are far later than 1900, so ordinary subtraction is safe. The error only affects date pairs that straddle 29 Feb 1900."
            ]
          },
          {
            "heading": "Times are fractions of a day",
            "points": [
              "A time is stored as a decimal fraction (the digits to the right of the decimal point) because it is a portion of one day.",
              "Slide example: 8:00 AM on 25 Dec 2005 is 38711.3333333. The 38711 is the date, and .3333333 is one third of a day (8 of 24 hours). 8:00 AM the next day is 38712.3333333.",
              "The fraction alone fixes the clock time on any day: 0.847 is 8:19:41 PM, whatever the date.",
              "Durations use the same scale. The Call Center renege limit G4 is entered as 0:30, which Excel stores as 30/1440 ≈ 0.0208 of a day. The Data Table in 'c-Server (BR) (Modified) (2)' also stores average waits as raw day fractions, such as 0.016 (about 23 minutes)."
            ]
          }
        ]
      },
      {
        "id": "date-time-functions",
        "title": "Date and Time Functions",
        "sections": [
          {
            "heading": "Date functions",
            "points": [
              "TODAY() returns the current date from the computer's system clock. YEAR(serial_number), MONTH(serial_number) and DAY(serial_number) extract the parts of a date.",
              "Slide check: YEAR(39014) = 2006, MONTH(39014) = 10 and DAY(39014) = 24, so serial 39014 is 24 Oct 2006.",
              "DATE(year, month, day) works in the opposite direction and returns the serial number. The Scratch sheet chains them: B1 =TODAY(), B2 =YEAR(B1), B3 =MONTH(B1), B4 =DAY(B1), B5 =DATE(B2,B3,B4)."
            ]
          },
          {
            "heading": "Passing dates to functions correctly",
            "points": [
              "Wrong: YEAR(14-Jan-05). A date typed bare inside a formula is not read as a date.",
              "Valid alternatives: quoted date text, YEAR(\"14-Jan-05\"); a cell that holds the date, YEAR(B15); or the serial number itself, YEAR(39014) = 2006.",
              "Subtraction follows the same rule. Typed bare, 14-Jan-05 – 23-Sep-04 is wrong, but \"14-Jan-05\" – \"23-Sep-04\" and DATE(2005,1,14) – DATE(2004,9,23) both return 113 days.",
              "DATE(y,m,d) builds the date from plain numbers, so you never have to type date text inside a formula."
            ]
          },
          {
            "heading": "Time functions",
            "points": [
              "NOW() returns the current date AND time. Scratch!D1 displays it with the format d/m/yyyy h:mm:ss.",
              "HOUR(serial_number), MINUTE(serial_number) and SECOND(serial_number) return the parts of the time: HOUR(39461.847) = 20, MINUTE(39461.847) = 19, SECOND(39461.847) = 41.",
              "TIME(hour, minute, second) returns only the fractional serial in the form 0.xxxxx. Scratch!D5 =TIME(D2,D3,D4) rebuilt 18:05:11 as 0.7536.",
              "Because the clock time lives in the fraction, HOUR, MINUTE and SECOND ignore the whole-day part of the number."
            ]
          }
        ]
      },
      {
        "id": "date-time-format-codes",
        "title": "Date and Time Format Codes",
        "sections": [
          {
            "heading": "Day, month and year codes",
            "points": [
              "d shows the day as 1–31 and dd as 01–31, but ddd shows the weekday as Sun–Sat and dddd as Sunday–Saturday.",
              "m shows the month as 1–12 and mm as 01–12, while mmm shows Jan–Dec and mmmm January–December.",
              "The slides point out an inconsistency: three or four d's switch from day-of-month to day-of-week, but three or four m's still mean the month.",
              "yy shows a 2-digit year (08) and yyyy a 4-digit year (2008). The record-management sheet uses dd/mm/yyyy for date of birth."
            ]
          },
          {
            "heading": "Time codes",
            "points": [
              "h shows hours as 0–23 and hh as 00–23. m/mm show minutes (0–59) and s/ss show seconds (0–59). The letter m means minutes when it sits in a time pattern such as h:mm or mm:ss.",
              "[h] keeps counting past 23 (…, 23, 24, 25, …), so it is the code for elapsed time that can exceed one day.",
              "AM/PM or am/pm switches the display to a 12-hour clock."
            ]
          },
          {
            "heading": "Formats in the Call Center workbook",
            "points": [
              "Durations (inter-arrival, service, wait and system time) are formatted mm:ss or m:ss. Clock times (arrival, service start, service end) are formatted h:mm. This follows the deck's split between durations and clock times.",
              "Formatting changes only what is displayed. The stored fraction of a day never changes.",
              "Watch out: mm:ss hides whole hours. In the saved c-Server sheet, the average system time in I8 is just over 1 hour and the wait in H62 is about 1 hour 5 minutes, but their minute-second formats show only the minutes past the hour. Use an [h] format such as [h]:mm:ss for any duration that can exceed 60 minutes."
            ]
          }
        ]
      },
      {
        "id": "queue-system-basics",
        "title": "Queue System Anatomy and Inputs",
        "sections": [
          {
            "heading": "The queue timeline",
            "points": [
              "Each customer arrives at an Arrival time, may wait, starts service at the Service Start time, is served for the Service time and leaves at the Service End time.",
              "Inter-arrival time is the gap between consecutive arrivals. System time runs from arrival to service end. System queue length is the number of customers in the system (waiting plus being served).",
              "Duration vs clock time: inter-arrival, service, wait and system time are durations; arrival, service start and service end are clock times. Each time column of the model is one or the other."
            ]
          },
          {
            "heading": "Measuring call-center performance",
            "points": [
              "The case: a fast-growing call center wants to understand how business growth affects the demand for call-center capacity before deciding what to do (outsourcing is one option).",
              "The headline performance measures are average customer wait time and system queue length.",
              "To analyse them you need the average customer inter-arrival time and the average service time. The sheets also report traffic intensity, utilisation, the last arrival and last service-end times, average system time and the average number of customers in the system."
            ]
          },
          {
            "heading": "Generating inter-arrival and service times",
            "points": [
              "Re-sampling: PERCENTILE(array, RAND()) generates new values that mimic the observed data. Data!B9 =PERCENTILE($B$13:$K$27,RAND()) resamples the 150 recorded inter-arrival times, and C9 does the same for the 150 service times in B30:K44.",
              "Known distribution: the inverse of the exponential, -Mean*LN(RAND()). Data!H9 =-H6*LN(RAND()) uses H6 =AVERAGE(B13:K27) (about 4:48 between arrivals), and I9 =-I6*LN(RAND()) uses I6 =AVERAGE(B30:K44) (about 11:00 per service).",
              "Press F9 to re-simulate every random value. The 1-Server sheet uses the exponential formula, while the c-Server and BR sheets resample the empirical Data sheet."
            ]
          }
        ]
      },
      {
        "id": "single-server-model",
        "title": "Single-Server Call Center Model",
        "sections": [
          {
            "heading": "Column logic A to H (from the slides)",
            "points": [
              "A inter-arrival time and B service time are simulated with -mean*LN(RAND()).",
              "C arrival = previous arrival + A; D service start = MAX(previous customer's service end, C); E service end = D + B.",
              "F wait = D − C; G system time = E − C = F + B; H system queue length = COUNTIF of all previous customers whose service end time is later than C.",
              "MAX encodes the single-server rule: service starts at whichever is later, the customer's arrival or the moment the server finishes the previous customer."
            ]
          },
          {
            "heading": "The '1-Server' sheet",
            "points": [
              "Inputs: C4 average inter-arrival 5:00 and D4 average service 4:00, both validated as times > 0. G14 = 9:00 is the opening time and doubles as customer 0's service end, and E14 =G14 starts the arrival chain.",
              "Row 15 formulas are filled down to row 64 (50 customers): C15 =-$C$4*LN(RAND()), D15 =-$D$4*LN(RAND()), E15 =E14+C15, F15 =MAX(E15,G14), G15 =F15+D15, H15 =F15-E15, I15 =G15-E15.",
              "J15 =COUNTIF($G$14:G14,\">\"&E15) uses an expanding range (anchored start $G$14, relative end), so every row looks only at customers who arrived earlier."
            ]
          },
          {
            "heading": "COUNTIF with a text criterion",
            "points": [
              "COUNTIF(range, criteria) returns the number of cells in range that satisfy the criteria. The criteria is entered as text, e.g. \"apple\" or \"<=55\".",
              "To compare against a cell's value, build the text with CONCATENATE() or &. With A1 = 10, \"<=\"&A1 gives \"<=10\". Numbers are converted to text automatically: if A2 = 20 and A3 = \"Apples\", then A2&\" \"&A3 = \"20 Apples\".",
              "That is why the queue formula uses \">\"&E15: the arrival time becomes a criterion that COUNTIF can apply to every earlier service end time."
            ]
          },
          {
            "heading": "Summary results in row 8",
            "points": [
              "Traffic intensity C8 =D4/C4 (4:00/5:00 = 0.8). Utilisation D8 =SUM(D15:D99)/(G8-G14) is the total service time divided by the time the center has been open.",
              "E8 =MAX(E14:E99) gives the last arrival and G8 =MAX(G14:G99) the last service end. H8 =AVERAGE(H15:H99) is the average wait and I8 =AVERAGE(I15:I99) the average system time.",
              "J8 {=SUMPRODUCT(((J15:J98+1)+J16:J99)/2,C16:C99)/(E8-E14)}: the Explain sheet derives this as the area under the customers-in-system vs time curve (trapezoids of height (J+1) and next J over each inter-arrival time), divided by the elapsed time.",
              "In the saved run the server was busy 72% of the time, the average wait was about 6:14 and on average about 1.9 customers were in the system."
            ]
          }
        ]
      },
      {
        "id": "multi-server-model",
        "title": "c-Server Model: LARGE Finds the Next Free Server",
        "sections": [
          {
            "heading": "What changes with c servers",
            "points": [
              "Customers still arrive one at a time, but with more than one server a customer's service start can be brought earlier whenever any server is free.",
              "Whenever more than c customers are in the system, some of them are waiting in line without a server.",
              "Rule: if the system queue length at arrival is < c, service starts at the arrival time. If it is ≥ c, service starts at the c-th largest service end time among all previous customers.",
              "Slide picture: three busy servers will free up at 12:01, 12:05 and 12:03. With c = 3 the 3rd-largest end time is 12:01, so the next customer starts at 12:01 on S1."
            ]
          },
          {
            "heading": "The formula in the 'c-Server' sheet",
            "points": [
              "F15 =IF(J15<$G$4,E15,LARGE($G$14:G14,$G$4)), with the number of servers in G4 (2 in the saved file, validated as a whole number > 0; the 'Servers' header in G3 carries the comment 'Any number of Servers').",
              "Why the c-th largest works: the c largest end times so far belong to the last customer on each server, so the smallest of them (the c-th largest) is the moment the first server frees up.",
              "Inputs now come from the data: C4 =AVERAGE(Data!B13:K27), D4 =AVERAGE(Data!B30:K44), C15 =PERCENTILE(Data!$B$13:$K$27, RAND()) and D15 =PERCENTILE(Data!$B$30:$K$44,RAND()).",
              "The sheet's documentation asks why =MAX(E20, LARGE($G$14:G19,c)) would not work properly. For the first customers the range holds fewer than c end times, so LARGE returns #NUM! and the error flows into every later row. The IF version only calls LARGE once J ≥ c."
            ]
          },
          {
            "heading": "Reading the results",
            "points": [
              "Traffic intensity becomes C8 =(D4/G4)/C4 and utilisation D8 =SUM(D15:D99)/(G4*(G8-G14)). Both divide by the number of servers.",
              "Saved run: average inter-arrival 4:48 and service 11:00 with 2 servers gives a traffic intensity of 1.15 (> 1, so demand exceeds capacity). Utilisation is 0.97, the average wait is about 54 minutes and 20 customers are already in the system when customer 50 arrives.",
              "A traffic intensity above 1 means the queue keeps building, and adding servers is the lever. The '(Modified) (2)' sheet uses Data Tables to compare 1 to 5 servers."
            ]
          }
        ]
      },
      {
        "id": "balking-reneging",
        "title": "c-Servers with Balking and Reneging",
        "sections": [
          {
            "heading": "Two ways customers leave early",
            "points": [
              "Balk limit: the system queue length beyond which an arriving customer leaves without joining the queue. In 'c-Server (BR)' F4 = 7, so a customer balks when L > 7 (L ≤ 7 joins).",
              "Reneging time limit: how long a customer will tolerate waiting after joining the queue. G4 = 0:30, so a customer whose potential wait exceeds 30 minutes leaves the queue.",
              "Other inputs: I4 = 2 servers and I14 = 9:00 opening time. Data validation requires whole numbers > 0 in F4 and I4 and a time > 0 in G4."
            ]
          },
          {
            "heading": "The column chain",
            "points": [
              "F potential start =IF(L15>F$4,\"\",IF(L15>=I$4,LARGE(I$14:I14,I$4),$E15)) is blank if the customer balks and otherwise applies the c-server rule. It depends on L and c, so it may differ from the arrival time E.",
              "G potential wait =IF(F15=\"\",\"\",F15-E15). H actual service start =IF(F15=\"\",\"\",IF(G15>$G$4,\"\",F15)) is blank for balkers and for renegers.",
              "L system length =COUNTIF($I$14:I14,\">\"&E15) is counted from the earlier customers' service end times in column I, and it decides whether this arriving customer joins. Each customer's I then feeds the L of later arrivals, and that feedback loop is why I must be defined carefully.",
              "Balkers carry \"\" in F through K. COUNT and AVERAGE skip these empty-text cells, which keeps the summary formulas simple."
            ]
          },
          {
            "heading": "Summary measures",
            "points": [
              "Balk proportion = (total arrivals − total who joined) / total arrivals: F8 =(COUNT(E15:E99)-COUNT(F15:F99))/COUNT(E15:E99).",
              "Renege proportion = (total who joined − total who actually started service) / total who joined: G8 =(COUNT(F15:F99)-COUNT(H15:H99))/COUNT(F15:F99).",
              "J8 =AVERAGE(J15:J99) and K8 =AVERAGE(K15:K99) give the average wait and system time, and L8 =SUMPRODUCT((L16:L98+1+L17:L99)/2,C17:C99)/(I8-H15) the average number in the system.",
              "Sanity check: the stored utilisation D8 =(SUM(I15:I99)-SUM(H15:H99))/(I4*(I8-I14)) reads 12.63 in 'c-Server (BR)', which is impossible for a utilisation. Every reneged customer adds an end clock time in I with no start time in H to subtract. Summing only the service times of customers who actually started gives about 0.72 for the same run."
            ]
          }
        ]
      },
      {
        "id": "defining-service-end",
        "title": "Defining the Service End Time: BR, BR-2, BR-M",
        "sections": [
          {
            "heading": "Original BR: renegers get a fake end time",
            "points": [
              "I = IF(F=\"\",\"\",F+D): everyone who joined gets an end time, including customers who reneged (potential wait over 30 minutes) and were never served.",
              "Those fake end times are counted in L, so the system length is inflated and later arrivals balk when they should not. The slides label this ERROR.",
              "In the saved 'c-Server (BR)' run, 8 of 50 arrivals balked (F8 = 0.16) and 8 of the 42 who joined reneged (G8 = 0.19)."
            ]
          },
          {
            "heading": "BR-2: renegers vanish from the count",
            "points": [
              "I = IF(H=\"\",\"\",H+D): only customers who actually start service receive an end time.",
              "Renegers now drop out of L entirely, even though they really occupied the queue for 30 minutes. The slides call this ERROR AGAIN: the system length is understated and too few later customers balk."
            ]
          },
          {
            "heading": "BR-M: renegers stay for exactly the renege limit",
            "points": [
              "I15 =IF(F15=\"\",\"\",IF(G15>$G$4,E15+$G$4,H15+D15)). A reneger leaves at arrival + 30 minutes; a served customer leaves at start + service time.",
              "J15 =IF(F15=\"\",\"\",IF(H15=\"\",$G$4,H15-E15)) and K15 =IF(F15=\"\",\"\",IF(H15=\"\",$G$4,I15-E15)) record 30 minutes of wait and system time for renegers.",
              "This version is implemented in 'c-Server (BR) (Modified)', which keeps the same F, G, H and L formulas."
            ]
          },
          {
            "heading": "BR-M-Again: the remaining challenge",
            "points": [
              "Renegers should count towards L for their 30 minutes, but they never occupy a server, so their end times should not feed the LARGE that sets the potential start time.",
              "Suggested fix: add a Reneged Time column for customers who joined and reneged (they have no actual start or end time). Compute the potential start with LARGE over ACTUAL end times only, and count L as (actual end times > arrival) + (reneged times > arrival).",
              "The deck leaves this as a challenge: update the model yourself."
            ]
          }
        ]
      },
      {
        "id": "macro-record-management",
        "title": "Macro Recording: Record Management",
        "sections": [
          {
            "heading": "Preparing the workbook",
            "points": [
              "Entry row: B4 holds the Last ID used, and C4 =B4+1 makes the next Member ID increment automatically. D4:G4 take Name, Gender (a Data Validation list with source Male, Female), Address and DOB (dd/mm/yyyy).",
              "Lookup row: B7 =IFERROR(MATCH(C7,C12:C1048576,0)+11,\"\") turns the ID typed in C7 into the worksheet row number of that record. Records start in row 12, so MATCH position 1 + 11 = row 12.",
              "D7:G7 {=IF(C7=\"\",\"\",INDEX(D12:G1048576,MATCH(C7,C12:C1048576,0),0))} is an array formula. A column_num of 0 makes INDEX return the whole matching row, and an ID that is not in the table returns #N/A.",
              "Macro-Recording.xlsm writes the offset as +ROW(C11) instead of the hard-coded +11, so the formula still works if the table is moved."
            ]
          },
          {
            "heading": "Recording addRecord",
            "points": [
              "Developer > Record Macro, name it addRecord. Copy C4:G4, select C10 and press Ctrl+Down Arrow to jump to the last record.",
              "Turn Use Relative Reference ON, press Down Arrow to reach the empty row, Paste Special > Values and number formats, then turn Use Relative Reference OFF. Press Esc, clear D4:G4 and click Stop Recording.",
              "The recorder writes Selection.End(xlDown).Select for Ctrl+Down and ActiveCell.Offset(1, 0).Range(\"A1\").Select for the relative Down Arrow. Without relative mode it would hard-code one fixed row.",
              "Then edit the code in the Visual Basic Editor and add Range(\"B4\").Value = Range(\"B4\").Value + 1, so the Last ID (and therefore C4) moves on after every add."
            ]
          },
          {
            "heading": "Recording deleteRecord and wiring the buttons",
            "points": [
              "Record deleteRecord by selecting C7 and choosing Clear Contents. Then add five lines in the editor: rowNum = Range(\"B7\").Value / If rowNum <> \"\" Then / Rows(rowNum).Select / Selection.Delete / End If.",
              "The If guard skips the delete when B7 is blank (no matching ID). Otherwise the record's row is removed and the rows below move up.",
              "Developer > Insert > Form Controls > Button: assign addRecord and deleteRecord to two buttons and relabel them Add and Delete.",
              "Macro-Recording-2.xlsm adds Edit (editRecord copies C7:G7 as values into C8:G8) and Update (updateRecord pastes C8:G8 back to Range(\"C\" & CStr(rowNum)), then clears C8:G8 and C7)."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w9",
    "title": "Week 9 — Macros & VBA",
    "subtitle": "IS602-AY2026-S7-S9.pdf",
    "topics": [
      {
        "id": "why-macros-and-vba",
        "title": "Macros & VBA: What and Why",
        "sections": [
          {
            "heading": "Usefulness of VBA",
            "points": [
              "VBA (Visual Basic for Applications) is object-oriented programming inside Excel; the session's stated payoff is to reduce the time and effort of repetitive tasks and to simplify coding effort.",
              "A macro automates a series of actions in a spreadsheet. Macros are stored as units of VBA code and can be written directly in the VB Editor or recorded in Excel.",
              "The session runs three exercises: Timer-Clicker (recorded macros for queue data), IntroVBA (nine coding exercises, Ex1 to Ex9) and Useful Macros (a code library covering Range, Worksheet, Chart, Workbook, Dialog and Event)."
            ]
          },
          {
            "heading": "Three ways to program VBA",
            "points": [
              "Record a macro: recorded macros are coded as Sub procedures under a Module.",
              "Code automatic procedures and events: the procedure headers are created automatically and you write the code inside them.",
              "Code from scratch: write your own Sub and Function procedures."
            ]
          },
          {
            "heading": "Recording macros: strengths and limits",
            "points": [
              "The recorder converts actions into a Sub automatically, but it often adds extraneous 'garbage' code and some desired actions cannot be converted into code, so simple editing is often needed.",
              "Recording is the quick way to get code for interactive actions (copy, Paste Special, Ctrl+arrow navigation) without having to work out how to code them.",
              "Use buttons or shapes as the user interface and assign the macro to them: IntroVBA-V2 has ten form-control buttons on Sheet1, while TimerClicker and UsefulMacros attach macros to rectangle shapes drawn over header and label cells.",
              "A workbook that carries macros must be saved in a macro-enabled format such as .xlsm (not .xlsx); the Workbook_Open slide says to save as .xlsm and reopen to see the event fire."
            ]
          }
        ]
      },
      {
        "id": "absolute-vs-relative-recording",
        "title": "Absolute vs Relative Reference When Recording",
        "sections": [
          {
            "heading": "Absolute reference (default)",
            "points": [
              "Cell addresses are fixed in the code once recorded, so the macro refers to that same cell every time it runs, e.g. Range(\"C7\").Copy.",
              "Absolute recording suits fixed locations: the Time Now cell D3, the copy row C7:E7 and the header cell where a downward search starts."
            ]
          },
          {
            "heading": "Relative reference (Use Relative References ON)",
            "points": [
              "With the Relative Reference button switched on, VBA uses Offset to record the number of rows or columns moved from the active cell, so the target changes on every run.",
              "Slide example: ActiveCell.Offset(-2,0).Range(\"A1\").Select moves 2 steps up from the current cell; Offset(rows, columns) uses negative numbers for up or left.",
              "The trailing .Range(\"A1\") is the recorder's way of saying 'the offset cell itself' (A1 relative to that cell).",
              "Recipe from the slides: switch relative ON just before the Down Arrow that must move with the data, and switch it OFF again before the remaining fixed steps."
            ]
          },
          {
            "heading": "Finding the next empty row",
            "points": [
              "Ctrl+Down Arrow from a header jumps to the last filled cell of a contiguous column; in code this is .End(xlDown).",
              "One more Down Arrow (relative ON) reaches the first empty row. The tidied TimerClicker code writes the whole move as Range(\"C6\").End(xlDown).Offset(1, 0).Select.",
              "Start the Ctrl+Down from the header C6, directly above the data: slide Step 4 picks C6 and rules out C7, which is the last filled cell before any time has been stamped.",
              "Paste Special > 'Values and Number Formats' is recorded as PasteSpecial Paste:=xlPasteValuesAndNumberFormats, and pressing Esc to release the copy is recorded as Application.CutCopyMode = False."
            ]
          }
        ]
      },
      {
        "id": "timer-clicker-queue-data",
        "title": "Timer-Clicker: Stamping Queue Times with Macros",
        "sections": [
          {
            "heading": "What the Timer measures",
            "points": [
              "Each customer has three time points (Arrival, Service Start, Service End) and four derived durations: inter-arrival time (between successive arrivals), wait time (Start minus Arrive), service time (End minus Start) and system time (End minus Arrive).",
              "Three macros are recorded and assigned to three separate buttons to stamp arrival, service-start and service-end times; the durations are then computed by formulas.",
              "The Timer sheet notes it is set up for First-come First-served (FCFS), single-server queues and asks how you would collect data for non-FCFS and multi-server systems."
            ]
          },
          {
            "heading": "Worksheet design",
            "points": [
              "D3 holds =NOW() formatted h:mm:ss. Press F9 (or run the VBA Calculate statement) to refresh it to the current time.",
              "Row 7 holds =$D$3 in C7, D7 and E7: a live 'time now' row that the macros copy and paste as values into the next empty row of each column.",
              "Duration formulas in F7:I7 (format m:ss): F7 =IF(C6>C7,\"\",C7-C6) for inter-arrival, G7 =E7-D7 for service, H7 =D7-C7 for wait and I7 =E7-C7 for system time.",
              "Transparent rectangles over the headers C6 (Arrive), D6 (Start) and E6 (End) run RecordArrive, RecordStart and RecordEndPlus; cell B5 tells the user 'Click header to record time point.'"
            ]
          },
          {
            "heading": "Recording and wiring the macros",
            "points": [
              "RecordArrive: Calculate, Range(\"C7\").Copy, Range(\"C6\").End(xlDown).Offset(1, 0).Select, Selection.PasteSpecial Paste:=xlPasteValuesAndNumberFormats, centre the cell, then Application.CutCopyMode = False.",
              "RecordStart and RecordEnd are the same macro using D7/D6 and E7/E6: the sheet's notes suggest either re-recording with steps 2 and 3 changed to the new column, or copying the Arrive code in the VBE and editing it.",
              "RecordEndPlus runs Call RecordEnd and then Call CopyFormulas, a Private Sub that copies F7 to the end of the row (End(xlToRight)) and pastes formulas and number formats into the next empty row of column F.",
              "The Proto sheet is a blank template: Exercise 1 asks you to build Timer by recording macros and assigning buttons, and Exercise 2 to build Clicker by modifying a copy of Timer."
            ]
          },
          {
            "heading": "Clicker and time arithmetic",
            "points": [
              "Clicker counts arrivals of up to three customer types (Count A, B, C in columns C to E) against time bins listed from F8 down (every 30 minutes from 8:00 in the sample).",
              "G7 =FREQUENCY(C$8:C$999,$F7) is the template (F7 itself holds no bin); copied into a bin row, it returns the cumulative count of type-A stamps at or before that bin, and the CompleteCumFreqTable macro pastes it across G:I for every bin row.",
              "The Learn sheet explains that Excel stores dates as numbers (1 Jan 1900 is day 1) and time as a fraction of a day: 0.25 is 6 am, 0.5 is 12 noon, 0.75 is 6 pm.",
              "Format durations with [h]:mm (or [m], [s]) when they can reach 24 hours (or 60 minutes or seconds), so the total keeps counting instead of rolling over into the next unit."
            ]
          }
        ]
      },
      {
        "id": "vbe-and-object-model",
        "title": "The VB Editor and Excel's Object Model",
        "sections": [
          {
            "heading": "Visual Basic Editor (VBE) windows",
            "points": [
              "Project Explorer: a tree of all projects; each project can hold Excel Objects (the Workbook and its worksheets), Add-ins, UserForms, Modules and Class Modules.",
              "Code Window: every object, UserForm and Module has its own code window, and it is good practice to put code with the object it belongs to.",
              "Properties Window: sets the properties of the selected object, for example the name of a sheet or the caption of a UserForm."
            ]
          },
          {
            "heading": "Hierarchy of objects",
            "points": [
              "Application is at the top and holds WorksheetFunction, Add-ins and Workbooks; each Workbook holds Charts and Worksheets; each Worksheet holds Range and Cells.",
              "Each object comes with properties, methods and events. You can set properties in the Properties Window or in code; methods are actions the object performs, such as Add, Activate and Calculate; events fire when the user does something, such as Click, Change, Activate or Keypress.",
              "Range(\"A1\").Value, Range(\"A1\").Font.Bold and Range(\"A1\").Interior.ColorIndex (Ex1 and Ex2) are properties; .Copy, .ClearContents and .Select are methods."
            ]
          },
          {
            "heading": "Referring to sheets and workbooks",
            "points": [
              "Worksheets(1) uses an index number based on the tab position (counting from the left) among sheets of the same type, and the numbering can change if you move, add or delete sheets.",
              "Sheets(4) counts all sheet types (worksheets, charts, modules and dialog sheets); referring by name, e.g. Sheets(\"Chart1\").Activate, is more robust.",
              "ActiveWorkbook is the workbook that has been activated, while ThisWorkbook is the workbook that contains the macro code. The UsefulMacros comments warn that the two are not necessarily the same."
            ]
          }
        ]
      },
      {
        "id": "sub-and-function-procedures",
        "title": "Sub and Function Procedures",
        "sections": [
          {
            "heading": "Subs versus Functions",
            "points": [
              "A Sub runs without returning a value. Run it from the VB Editor, from the Macro dialog box, or by assigning it to a button in the worksheet (via the Macro dialog box).",
              "A Function returns a single value by assigning to its own name, e.g. CubeRoot = number ^ (1/3). It can be called inside a Sub (Ans = CubeRoot(123)) or used in a worksheet formula.",
              "For a function to work in a workbook its code MUST be in a Module: in the VBE select the workbook, Insert Module, code the function, then use it in the worksheet like any Excel function."
            ]
          },
          {
            "heading": "Private procedures and calling other Subs",
            "points": [
              "A Private Sub can only be called by other subs in the same module (TimerClicker Module2 comment); a plain Sub is public and can be run from Excel.",
              "RecordEndPlus uses Call RecordEnd and Call CopyFormulas, where CopyFormulas is a Private helper the user never needs to run directly.",
              "Code kept in a worksheet object cannot be reached directly from other sheets: state the sheet's code name, a dot, then the Sub name. The Workbook sheet's labels run Sheet5.GetFileName, Sheet5.GetFilePath and Sheet5.ListFiles."
            ]
          },
          {
            "heading": "Calling worksheet functions from VBA",
            "points": [
              "Call most worksheet functions through Application.WorksheetFunction.<function name>; the slide example sets myRange to Worksheets(\"Sheet1\").Range(\"A1:A10\"), stores Application.WorksheetFunction.Min(myRange) in Answer and shows it with MsgBox.",
              "UseXLFunction stores Total = WorksheetFunction.Sum(Range(\"C4:C7\")) in C8 as a fixed number, while EnterFormula writes Range(\"C8\").Formula = \"=SUM(C4:C7)\", a live formula that recalculates."
            ]
          },
          {
            "heading": "User-defined functions in the workbooks",
            "points": [
              "WorkbookName() and WorksheetName() (Worksheet!C13:C14) return the file and sheet names. Application.Volatile True makes them recalculate, and Application.Caller.Parent.Name is more stable than ActiveSheet.Name when moving between sheets.",
              "CellFormula(ID) and ShowFormula(R) in TimerClicker Module3 return \" \" & Range.Formula, so a cell can document another cell's formula automatically.",
              "IntRU(x) rounds a real number up to an integer, because the standard Int() rounds down: IntRU = Int(x): If x > IntRU Then IntRU = IntRU + 1."
            ]
          }
        ]
      },
      {
        "id": "declarations-data-types-arrays",
        "title": "Declarations, Data Types and Arrays",
        "sections": [
          {
            "heading": "Data types and memory",
            "points": [
              "Declare a type for each variable to save memory, and always choose the type that uses the smallest number of bytes that can handle the program.",
              "Bytes per type: Byte 1 (0 to 255), Boolean 2, Integer 2 (-32,768 to 32,767), Long 4 (about plus or minus 2.1 billion), Single 4, Double 8, Currency 8, Date 8, String 1 byte per character, Variant 16.",
              "Type-declaration characters: Integer %, Long &, Currency @, Single !, Double #, String $.",
              "Date stores date and time as one real number: the whole part is the date and the decimal part is the time. Any variable that is not explicitly declared becomes a Variant."
            ]
          },
          {
            "heading": "Declaration scope",
            "points": [
              "Put Option Explicit as the first statement to force yourself to declare every variable.",
              "Dim inside a procedure gives a local variable; Dim before the first procedure makes it usable by every procedure in that module; Public before the first procedure makes it usable by all modules.",
              "Static k As Integer keeps its value after the procedure ends, which is handy for counting how many times a program has run. Const declares a fixed value at any level, e.g. Public Const gravity As Single = 9.8.",
              "Pitfall: Dim p, q, r As Integer declares only r as Integer; p and q become Variants and waste memory."
            ]
          },
          {
            "heading": "Arrays",
            "points": [
              "An array is a group of variables with a common name: Dim CD_ID(1 To 200) As Integer holds 200 CD IDs, and Dim CD_ID(1 To 100, 1 To 100) As Integer is a 2-D array of 10,000 by row and column.",
              "A dynamic array has no preset size: declare Dim MyArray() As Integer, read the size from cell A1 (ASize = Range(\"A1\").Value) and then ReDim MyArray(ASize)."
            ]
          }
        ]
      },
      {
        "id": "program-flow",
        "title": "Program Flow: Decisions, Loops and Error Traps",
        "sections": [
          {
            "heading": "Testing a condition",
            "points": [
              "GoTo jumps to a line label: Ex3_Goto runs If UCase(FavCourse) <> \"IS602\" Then GoTo WrongAns, with Exit Sub placed before the WrongAns: label so a correct answer never falls into it. The slides note that serious programmers dislike GoTo because it makes programs unstructured and hard to follow.",
              "If <condition> Then ... Else ... End If runs one of two branches. Ex4_TakeIQTest nests an If inside another and tests MsgBox's return value (1 means OK was clicked on a vbOKCancel box).",
              "Select Case <variable> with Case <value> lines chooses one branch from many. In Ex5_Evaluation, ratings 1, 2 and 3 each get a message and any other number does nothing, because there is no Case Else."
            ]
          },
          {
            "heading": "Counted loops",
            "points": [
              "For <counter> = <start> To <end> [Step <stepsize>] ... Next <counter> repeats a fixed number of times.",
              "Ex6_ColorMeBad first validates the input (If Num >= 1 And Num <= 56), colours A1 black, and then loops For i = 1 To Num - 1, setting Range(\"A1\").Offset(i, 0).Interior.ColorIndex = i + 1.",
              "For Each <object> In <collection> loops over objects instead of numbers, e.g. For Each sht In ActiveWorkbook.Sheets or For Each Wkbk In Workbooks (UsefulMacros)."
            ]
          },
          {
            "heading": "Conditional loops",
            "points": [
              "Do While <condition> ... Loop (Type 1) tests first, so it never runs if the condition starts FALSE. Do ... Loop While <condition> (Type 2) tests at the end, so it always runs at least once.",
              "Do Until keeps looping while the condition is FALSE and stops once it becomes TRUE. Type 1 (Do Until ... Loop) can run zero times, while Type 2 (Do ... Loop Until) runs at least once.",
              "The loop variable must move toward the exit: Ex7 adds 20 to spending on each pass (Do While spending <= 100) and Ex8 takes 0.5 off Money (Loop Until Money < 2.1)."
            ]
          },
          {
            "heading": "Handling run-time errors",
            "points": [
              "When a program needs a positive number (e.g. a square root), check that the value is positive and numeric, and also add a general error trap to catch anything else.",
              "Ex9_SquareRoot: On Error GoTo BadEntry, then Num = InputBox(...), If Num = \" \" Then Exit Sub, ActiveCell.Value = Sqr(Num), Exit Sub, and finally BadEntry: MsgBox (\"Enter a positive numeric value\")."
            ]
          }
        ]
      },
      {
        "id": "events-and-automatic-procedures",
        "title": "Events and Automatic Procedures",
        "sections": [
          {
            "heading": "Event-handler procedures",
            "points": [
              "Event-handler procedures are programs activated by interactive actions, and every object can respond to events: workbook, worksheet, UserForm and button events.",
              "Steps: in the VBE select the object in Project Explorer, click View Code, then pick the object and the operation from the code window's drop-downs. The Sub header is created for you; write the code inside and use arguments such as Target to refer to the input cells.",
              "Private Sub Workbook_Open() in ThisWorkbook runs every time the file opens: the slide shows MsgBox (\"Welcome\"), and TimerClicker uses it to activate the Home sheet and select A1."
            ]
          },
          {
            "heading": "Worksheet events in UsefulMacros",
            "points": [
              "Worksheet_SelectionChange(ByVal Target As Range) on the Event sheet clears every row's colour, shades Target.EntireColumn and Target.EntireRow grey (ColorIndex 16) and colours the selected cells (Target) red.",
              "Worksheet_Change(ByVal Target As Range) runs when cells are edited; the sample turns changed cells blue with Target.Font.ColorIndex = 5.",
              "To watch only some cells, exit early when the edit misses them: Worksheet_Change2 tests If Intersect(Target, Range(\"C4:C5,F4:F5\")) Is Nothing Then Exit Sub, and otherwise flags C10 with \"??\"."
            ]
          },
          {
            "heading": "Workbook events",
            "points": [
              "Workbook_Open can hide every sheet except Home (sht.Visible = False inside a For Each loop) and maximise the Excel window with Application.WindowState = xlMaximized.",
              "Workbook_BeforeSave asks 'Do you really want to save the workbook?' and sets Cancel = True when the answer is vbNo; Workbook_BeforeClose saves automatically when Me.Saved = False.",
              "ThisWorkbook's Workbook_SheetActivate selects A1 whenever a worksheet is activated. The event procedures kept in the standard modules M7_OtherEvents and M8_ThisWkbk_Events are reference templates ('see also the ThisWorkbook Excel object') that do not fire there, because event code must sit in the object's own code module."
            ]
          }
        ]
      },
      {
        "id": "useful-macros-library",
        "title": "Useful Macros Library and Final-Exam Notes",
        "sections": [
          {
            "heading": "Range macros",
            "points": [
              "SerialNum writes 1 to 8 into B4:B11: For i = 1 To 8: Range(\"B3\").Offset(i, 0) = i: Next i.",
              "CheckThis uses With ActiveCell ... End With to colour a value red (1,000 or less), black (over 1,000), blue (over 4,999) or green (over 9,999). CheckAllBelow starts at C4 and calls CheckThis Do While ActiveCell <> \"\".",
              "CopyRange copies C4:C11 and pastes values into B4 with Range(\"B4\").PasteSpecial xlPasteValues; ClearRange runs Range(\"B4:B11\").ClearContents."
            ]
          },
          {
            "heading": "Sheets, workbooks and the application",
            "points": [
              "Sheet visibility codes: Visible = -1 (xlSheetVisible), 0 (xlSheetHidden) or 2 (xlSheetVeryHidden).",
              "AddSheet loops Do While Sheets.Count < 12 with ThisWorkbook.Sheets.Add After:=Sheets(Sheets.Count), adding sheets at the end until there are 12.",
              "Application.ScreenUpdating = False ... True hides intermediate steps and speeds a macro up; ActiveSheet.Unprotect / ActiveSheet.Protect (optionally with Password:=) lets a macro edit a protected sheet; Application.Wait (Now + TimeValue(\"00:00:01\")) slows a loop.",
              "Workbook code covers Workbooks.Open, ActiveWorkbook.SaveAs (FileFormat:=xlCSV for CSV), Workbooks(\"...\").Close and Workbooks.Add, and lists a folder's files with Dir inside Do While foundFile <> \"\"."
            ]
          },
          {
            "heading": "Dialog boxes",
            "points": [
              "MsgBox(prompt[, buttons][, title][, helpfile, context]) and InputBox(prompt[, title][, default][, xpos][, ypos][, helpfile, context]) are the two dialog functions demonstrated on the Dialog sheet; vbCrLf starts a new line in a message.",
              "Add button constants (vbQuestion + vbYesNo) and test the reply (If Ans = vbYes Then ...) to turn MsgBox into a decision point, as MsgWithOptions does.",
              "SimpleInput substitutes 0 when the InputBox is left blank (If Yr = \"\" Then Yr = 0), a simple form of input validation."
            ]
          },
          {
            "heading": "Examena dry run and final exam",
            "points": [
              "Set up your Examena account and download the Examena Final Instructions file before the dry run, which is held the week after this session.",
              "The final exam is open book with NO internet access, so store all the materials you need on your computer or bring printed copies.",
              "Examena records your screen during the final exam: do not access local LLMs or any other external assistance."
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "w10",
    "title": "Week 10 — Decision Support: AutoFilter, Advanced Filter & PivotTables",
    "subtitle": "IS602-AY2026-27-S10.pdf",
    "topics": [
      {
        "id": "w10-at-a-glance",
        "title": "Week 10 at a Glance: Decision Support Tools",
        "sections": [
          {
            "heading": "Learning objectives",
            "points": [
              "Locate AutoFilter in Excel and use it to sort and filter a list by pre-defined rules and by rules you specify yourself.",
              "Tell date and time format codes apart (d vs ddd, m vs mmm, h vs [h]).",
              "Explain how Advanced Filter works, then apply it together with date formats in the Offshore Development exercise.",
              "Make advanced filtering dynamic by recording a macro and re-running it whenever the criteria change."
            ]
          },
          {
            "heading": "Exercises and files",
            "points": [
              "The Session 10 deck covers AutoFilter, custom sorting and date/time format codes, then the Offshore Development exercise, then the Advanced Filter dialog and criteria rules, and closes with project admin.",
              "Demo-Advanced-Filter.xlsx is a four-record list with two ready-made criteria ranges: an AND example and an OR-of-ANDs example.",
              "OffshoreDevelopment-modified.xlsm is the class version of the textbook's Chapter 8 exercise: its due dates roll forward with TODAY() and its filter macro also reacts to the status criteria cells.",
              "The course outline lists PivotTables for Week 10, with Grand Grocery as a class exercise and in the recorded revision videos, although the Session 10 deck has no PivotTable slides; GrandGrocery.xlsx contains the finished PivotTable and PivotChart."
            ]
          },
          {
            "heading": "Project wrap-up announced in Session 10",
            "points": [
              "Week 11 final presentation: a 15-minute hard stop that includes the demo, so curate the most convincing material and keep extra detail for Q&A.",
              "One or more team members may present; a 5-minute Q&A follows in which peers earn class participation for asking - the presenting group earns none for answering about its own project.",
              "Group project peer evaluation (5%): submit only after Week 11, rating every member from 1 (min) to 5 (max) with optional comments; any member you leave unrated is treated as a 5."
            ]
          }
        ]
      },
      {
        "id": "autofilter-basics",
        "title": "AutoFilter: Quick Sorting and Filtering",
        "sections": [
          {
            "heading": "Switching AutoFilter on",
            "points": [
              "AutoFilter lets you filter a large list using criteria that Excel builds automatically from each column's contents.",
              "Click any cell inside the list and choose Data > Filter; a pull-down arrow appears beside every column header.",
              "Each pull-down shows every unique entry in that column as a checkbox under (Select All), so you can tick just the values to keep."
            ]
          },
          {
            "heading": "What every pull-down offers",
            "points": [
              "Sort A to Z (ascending) and Sort Z to A (descending); number columns show Sort Smallest to Largest / Largest to Smallest, and date columns show Sort Oldest to Newest / Newest to Oldest.",
              "Sort by Color and Filter by Color, plus Clear Filter From \"<column>\" to remove that column's filter.",
              "A Text, Number or Date Filters submenu that ends with Custom Filter..."
            ]
          },
          {
            "heading": "Filter menus follow the column's data type",
            "points": [
              "Text Filters: Equals, Does Not Equal, Begins With, Ends With, Contains, Does Not Contain.",
              "Number Filters: Equals, Does Not Equal, Greater Than, Greater Than Or Equal To, Less Than, Less Than Or Equal To, Between, Top 10, Above Average, Below Average.",
              "Date Filters: Equals, Before, After, Between, relative periods (Tomorrow/Today/Yesterday and Next/This/Last Week, Month, Quarter, Year), Year to Date and All Dates in the Period; the checklist groups dates by year with expandable levels."
            ]
          }
        ]
      },
      {
        "id": "custom-filter-and-top10",
        "title": "Custom AutoFilter, Wildcards and Top 10",
        "sections": [
          {
            "heading": "Custom AutoFilter",
            "points": [
              "Custom Filter... appears at the bottom of the Text, Number and Date Filters submenus.",
              "The Custom AutoFilter dialog ('Show rows where:') combines at most two conditions on one column, joined by And or Or.",
              "Each condition pairs an operator (equals, does not equal, is greater than, is greater than or equal to, is less than, ...) with a value."
            ]
          },
          {
            "heading": "Wildcards",
            "points": [
              "? stands for exactly one character.",
              "* stands for any run of characters, from zero characters upwards.",
              "Example: 'equals T-1?' keeps T-10 but not T-1 (too short) or T-100 (too long); 'equals T-1*' keeps all three."
            ]
          },
          {
            "heading": "Top 10 filter",
            "points": [
              "Shows the highest 10 items or the highest 10 percent of items; the dialog lets you choose Top or Bottom, change the number and pick Items or Percent (for example Bottom 5).",
              "It only works on fields measured in numbers, so it is listed under Number Filters.",
              "Ties at the cut-off are all kept: if more records qualify than the number requested, every qualifying record is displayed."
            ]
          }
        ]
      },
      {
        "id": "custom-sort",
        "title": "Custom Sort: Sort by Color and Custom Lists",
        "sections": [
          {
            "heading": "The Sort dialog",
            "points": [
              "Add Level, Delete Level and Copy Level build multi-key sorts; the arrow buttons reorder the levels and Options... holds extra settings.",
              "Tick 'My data has headers' so the first row is read as field names; each level then picks a Column (Sort by), what to Sort On and an Order."
            ]
          },
          {
            "heading": "Sort On",
            "points": [
              "Choices are Cell Values, Cell Color, Font Color and Conditional Formatting Icon.",
              "Sorting on colour groups rows that were highlighted, for example milestones coloured by alert level."
            ]
          },
          {
            "heading": "Custom Lists",
            "points": [
              "Order can be A to Z, Z to A or Custom List..., which opens the Custom Lists dialog.",
              "Built-in lists cover Sun-Sat, Sunday-Saturday, Jan-Dec and January-December, so weekdays and months sort in calendar order rather than alphabetically.",
              "Pick NEW LIST, type the entries (press Enter between them) and click Add to define your own order."
            ]
          }
        ]
      },
      {
        "id": "date-time-format-codes",
        "title": "Date and Time Format Codes",
        "sections": [
          {
            "heading": "Day and month codes",
            "points": [
              "d shows the day as 1-31 and dd as 01-31, but ddd and dddd switch to the day of the week (Sun / Sunday).",
              "m, mm, mmm and mmmm all describe the month: 1-12, 01-12, Jan-Dec, January-December.",
              "The deck flags this inconsistency: adding d's changes the meaning (day of month to weekday), while adding m's only changes how the month is written."
            ]
          },
          {
            "heading": "Year and time codes",
            "points": [
              "yy gives a 2-digit year (08) and yyyy a 4-digit year (2008).",
              "h shows hours as 0-23 and hh as 00-23; [h] keeps counting past 23 (24, 25, ...), which is what elapsed durations need.",
              "m/mm and s/ss show minutes and seconds (so the letter m appears in both the date and the time tables); AM/PM or am/pm switches to a 12-hour clock."
            ]
          },
          {
            "heading": "Formats in the Offshore workbook",
            "points": [
              "Due and completion dates use the custom format d mmm yyyy, so a date shows as 2 Nov 2019 instead of a serial number.",
              "Criteria strings are built with TEXT(date,\"d MMM yyyy\"), producing text such as >=7 Sep 2019 that Advanced Filter reads as a date condition.",
              "2 Nov 2019 was a Saturday, so the format dddd d mmmm yyyy would display Saturday 2 November 2019."
            ]
          }
        ]
      },
      {
        "id": "advanced-filter-dialog",
        "title": "Advanced Filter: Ranges and Actions",
        "sections": [
          {
            "heading": "When to reach for Advanced Filter",
            "points": [
              "Data > Advanced filters a list on several criteria at once, written in a separate criteria range on the sheet.",
              "Because the conditions sit in cells, formulas can rewrite them, and a recorded macro can re-apply the filter with the new values - the deck's 'dynamic criteria value'."
            ]
          },
          {
            "heading": "The dialog box",
            "points": [
              "Action: 'Filter the list, in-place' hides the rows that fail the criteria; 'Copy to another location' writes the matching records to the range given in Copy to.",
              "List range is the data list including its header row; Criteria range is the criteria headers plus the rows of criteria values.",
              "Unique records only drops duplicate records from the result."
            ]
          },
          {
            "heading": "Re-running the filter",
            "points": [
              "Applying an advanced filter is a one-off action, so the Offshore workbook calls its recorded macro Filter_Alert from a Worksheet_Change event whenever the alert level or the status criteria change.",
              "The macro's list range B19:I65536 runs down to row 65,536 (the bottom of the old .xls grid) so newly added milestone rows are always included."
            ]
          }
        ]
      },
      {
        "id": "advanced-filter-rules",
        "title": "Advanced Filter Criteria Rules",
        "sections": [
          {
            "heading": "Layout rules",
            "points": [
              "Place the criteria range above the data list, with at least one empty row separating them.",
              "Criteria headers are matched to list headers by exact spelling, and at least one header must match.",
              "Header order is free: the demo's criteria read Gender | Age | Address while its list reads Name | Gender | Address | Age."
            ]
          },
          {
            "heading": "AND across a row, OR down the rows",
            "points": [
              "Every condition on the same criteria row must hold together (AND).",
              "Each extra row of criteria values is an alternative (OR): a record passes if it satisfies any one row.",
              "A header may appear twice to put two conditions on one field - Offshore uses two Due Date headers to express a from-to window."
            ]
          },
          {
            "heading": "Blank cells",
            "points": [
              "A blank criteria cell puts no restriction on that field (show all).",
              "By the same rule, an entirely blank criteria row would match every record, so the criteria range should stop at the last filled row - Filter_Alert uses D14:I15."
            ]
          },
          {
            "heading": "Reading the deck's rules diagram",
            "points": [
              "Row 1 requires Field 1 to meet both Value 1a and Value 1b (two conditions on one field), Field 3 to meet Value 3 and Field 4 to meet Value 4; Field 5 is blank and therefore ignored.",
              "Row 2 requires only Field 2 to meet Value 2, so the filter returns (all row-1 conditions) OR (the row-2 condition).",
              "Criteria values are text entries: the demo types F and >=30, and the deck stresses that criteria values must be strings - which is why Offshore converts its dates with TEXT."
            ]
          }
        ]
      },
      {
        "id": "offshore-development-tracking",
        "title": "Offshore Development: Milestone Alert Tracking",
        "sections": [
          {
            "heading": "The business problem",
            "points": [
              "SAA, a national airline, outsources many IT projects to offshore vendors; at any time its IT department monitors about 50 projects, each with several major milestones.",
              "Changing user requirements and technical problems make projects slip, so the VP wants a simple, user-friendly mechanism that at least raises alerts when major milestones are not completed on time."
            ]
          },
          {
            "heading": "Alert levels",
            "points": [
              "Level 0: due within the last 2 weeks (-14 to 0 days); level 1: 2-4 weeks ago (-28 to -15); level 2: 4-8 weeks ago (-56 to -29); level 3: more than 8 weeks ago (-99999 to -57). 'All' spans -99999 to 99999 days.",
              "Conditional formatting colours the due dates in D20:D270: light yellow for level 1, pink for level 2 and tan/orange for level 3; level 0 stays white.",
              "As at 2 Nov 2019 (the deck's screenshot) the windows are 19 Oct-2 Nov 2019 (level 0), 5-18 Oct (1), 7 Sep-4 Oct (2) and 1 Jan 1900-6 Sep 2019 (3)."
            ]
          },
          {
            "heading": "Four build steps",
            "points": [
              "1) Define the alert-level table (Model!E7:I12) holding the day offsets and the matching date limits.",
              "2) Add a drop-down in E4 (data validation list =$E$8:$E$12) so the user picks All, 0, 1, 2 or 3; F4:I4 VLOOKUP the chosen row.",
              "3) Convert the chosen dates into criteria strings in D15 (>=from) and E15 (<=to), each under its own Due Date header.",
              "4) Record a macro that runs Advanced Filter on the milestone list starting at B19 with criteria D14:I15."
            ]
          },
          {
            "heading": "Status columns and reviews",
            "points": [
              "Completed? shows Yes once a completion date is entered; On Time? shows Yes if completion is on or before the due date, No if late, and stays blank until completion.",
              "Mid-pt Review and Milestone Review accept only Waived or Done (data validation); the criteria row F15:I15 offers the same choices (Yes/No, Waived/Done) to narrow an alert view."
            ]
          }
        ]
      },
      {
        "id": "pivot-tables-grand-grocery",
        "title": "PivotTables and PivotCharts: Grand Grocery",
        "sections": [
          {
            "heading": "Why a PivotTable",
            "points": [
              "Grand Grocery downloaded 360 sales records (Category, Product, Sales, Quarter in Data!B1:E361) and wants to examine sales overall, by quarter, by category and by product, on the fly.",
              "A PivotTable summarises the list without writing formulas; dragging fields to different areas produces a new view instantly."
            ]
          },
          {
            "heading": "Areas used in the solution",
            "points": [
              "Report filter (page) area: Quarter, currently set to Q2 (PivotTable!B3:C3).",
              "Row labels: Product, sorted A to Z; column labels: Category; values: Sum of Sales.",
              "Grand totals run along row 95 and down column L, so PivotTable!L95 holds the Q2 total of $2,123,685."
            ]
          },
          {
            "heading": "Reading the result",
            "points": [
              "In Q2 Confection leads the categories with $321,383 and Beverage trails with $155,718 (about 7.3% of the quarter).",
              "A product sold under two categories gets one row with two filled cells: Butter = Condiment $32,565 + Dairy $30,953 = $63,518; Chocolate = Beverage $1,152 + Confection $29,855 = $31,007.",
              "The Proto sheet is an empty mock-up of the target layout (row and column labels, no values) to compare your PivotTable against."
            ]
          },
          {
            "heading": "PivotChart, cache and refresh",
            "points": [
              "The PivotChart sheet is a stacked column chart driven by PivotTable1, with one series per category (9) and one column per product; it follows the pivot's filter and layout.",
              "A PivotTable summarises a stored cache of the source list, so edits to the Data sheet appear only after Refresh; this file's cache still remembers two product names no longer in the data (Powder milk, Skim milk) as missing items.",
              "The Home sheet asks how to recover the original records from a PivotTable alone: double-clicking a value cell (Show Details) lists the records behind that number on a new sheet."
            ]
          }
        ]
      }
    ]
  }
]
