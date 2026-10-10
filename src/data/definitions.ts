import type { Definition } from './types'

export const definitions: readonly Definition[] = [
  {
    "term": "Model",
    "definition": "A simplified representation of a real business situation built to support a decision; it provides decision support only — 'NOT an antidote nor a magical crystal ball'.",
    "example": "The Community Water Tank worksheet lets Sammy compare tank heights before pouring any concrete.",
    "source": "W1"
  },
  {
    "term": "Influence diagram",
    "definition": "A diagram of nodes and arrows showing which inputs drive which computed quantities, drawn before building the worksheet to fix the calculation order.",
    "example": "Tank Height and Tank Width -> Tank Length -> Base Area and Wall Area -> Cost of Tank.",
    "source": "W1"
  },
  {
    "term": "Blackbox view",
    "definition": "A framing of a model where Decisions and Parameters flow into a black box and Performance Measures and Consequence Variables come out.",
    "example": "For the water tank: Tank Height goes in as the Decision; Cost of Tank comes out as the Performance Measure.",
    "source": "W1"
  },
  {
    "term": "Decision (variable)",
    "definition": "A model input the decision maker controls and can vary to search for a better outcome.",
    "example": "Tank Height in Community Water Tank; New Business Volume and New Headcount in Data Centre Assets.",
    "source": "W1"
  },
  {
    "term": "Parameter",
    "definition": "A model input fixed by the environment or the problem statement, not chosen by the decision maker.",
    "example": "Required volume 30 cbm, tank width 2 m, base cost $10/sqm and wall cost $5/sqm.",
    "source": "W1"
  },
  {
    "term": "Performance measure",
    "definition": "The output used to judge how good a decision is — the quantity the decision maker is trying to optimise.",
    "example": "Cost of Tank (minimise); New IT Assets # (plan).",
    "source": "W1"
  },
  {
    "term": "Consequence variable",
    "definition": "An intermediate output computed along the way that helps explain the result but is not itself the objective.",
    "example": "Tank Length, Base Area and Wall Area; the IT performance ratios and business growth rate.",
    "source": "W1"
  },
  {
    "term": "Relative reference",
    "definition": "A reference like C5 with no $ signs: the column shifts when the formula is copied sideways and the row shifts when copied down.",
    "example": "=C6*D6 in E6 becomes =C7*D7 when filled down to E7.",
    "source": "W1"
  },
  {
    "term": "Absolute reference",
    "definition": "A reference like $C$5 with both parts locked: it points at the same cell no matter where the formula is copied.",
    "example": "=$C$3/(B6*C6) keeps dividing by the 30 cbm volume in C3 in every height row.",
    "source": "W1"
  },
  {
    "term": "Mixed reference",
    "definition": "A reference locking only one part: $C5 freezes the column (survives filling right), C$5 freezes the row (survives filling down).",
    "example": "=$C9/E9 fills right to =$C9/F9 — the deposit column stays put while the asset column advances.",
    "source": "W1"
  },
  {
    "term": "Fill Function",
    "definition": "Copying a formula into adjacent cells with relative references adjusted; the result is live formulas that recalculate when inputs change.",
    "example": "Filling G6 =SUMPRODUCT($E$3:$F$3,E6:F6) down to G18 costs out all thirteen candidate heights.",
    "source": "W1"
  },
  {
    "term": "Auto-Fill Function",
    "definition": "An operation that writes VALUES (no formulas) by fitting a least-squares straight line through the selected points and extrapolating, assuming the points are equally spaced on the x-axis.",
    "example": "RetailGasoline auto-fills 1990/1995/2000 prices out to 2005/2010/2015 — Brazil's price extrapolates down to 1.19 by 2015.",
    "source": "W1"
  },
  {
    "term": "TREND function",
    "definition": "TREND(known_y, known_x, new_x, [const]) returns the value on the least-squares straight line fitted to (known_x, known_y) at new_x; const TRUE/omitted computes the intercept b, const FALSE forces b = 0.",
    "example": "=TREND(E$27:E$36,$C$27:$C$36,$C37) predicts the low-end server performance ratio at the first projected deposit level.",
    "source": "W1"
  },
  {
    "term": "Least-squares straight line",
    "definition": "The straight line y = mx + b minimising the sum of squared vertical deviations from the data points; it underlies both Auto-Fill and TREND.",
    "example": "Method 2's predicted 11th point adds no value precisely because it already lies on this fitted line.",
    "source": "W1"
  },
  {
    "term": "Performance ratio",
    "definition": "Business Volume divided by # Equipment — how much business each unit of an IT asset supports; new requirement = New Business Volume / New Performance ratio.",
    "example": "Year 1 low-end servers: 3.91/20 = 0.1955 $b per BIPS (Model!E27 =$C9/E9).",
    "source": "W1"
  },
  {
    "term": "Documentation block",
    "definition": "A worksheet table listing each labelled cell: inputs marked '<Input>' and each unique formula shown once with its real cell references, readable from the printout without row/column headers.",
    "example": "Tank length | D6 | =$C$3/(B6*C6); Tank cost | G6 | =SUMPRODUCT($E$3:$F$3,E6:F6).",
    "source": "W1"
  },
  {
    "term": "Economic Order Quantity (EOQ)",
    "definition": "The order size minimising total ordering-plus-carrying cost: EOQ = SQRT(2DO/C), where D is annual demand, O is cost per order, and C is annual unit carrying cost.",
    "example": "D=25,000, O=$20, C=$4 gives EOQ = SQRT(2 x 25,000 x 20 / 4) = 500 couplers per order, i.e. 50 orders a year (test case (a) in the Assign0Soln Q1 sheet; the model formula pattern is =SQRT(2*B6*C6/D6)).",
    "source": "W1"
  },
  {
    "term": "Test cases",
    "definition": "Extra input sets placed on the worksheet that demonstrate extremes and show the model computes correctly for ANY quantities entered — a required block in a professional layout.",
    "example": "Assign0Soln Q1 re-runs the EOQ model for demands of 25,000 up to 200,000 with varied order and carry costs.",
    "source": "W1"
  },
  {
    "term": "Spreadsheet Engineering",
    "definition": "A disciplined two-stage process for spreadsheet modeling: Stage 1 builds the model (formulate relationships, frame understanding, construct), Stage 2 analyzes it (what-if scenarios, sensitivity and trade-off analysis).",
    "source": "W2"
  },
  {
    "term": "Influence Diagram",
    "definition": "A schematic picture of the connections between exogenous variables (known/given inputs) and the performance measure, built by starting from the performance measure and decomposing it until decision variables are reached.",
    "example": "Profit decomposes into demand, revenue and cost, which trace back to Price.",
    "source": "W2"
  },
  {
    "term": "Blackbox Model",
    "definition": "A schematic view that frames the model as inputs entering a box and outputs leaving it, classifying every variable as a Decision, Parameter, Historical variable, Performance Measure or Consequence Variable.",
    "source": "W2"
  },
  {
    "term": "Decision (Controllable Input)",
    "definition": "An input variable whose value is to be decided by the user of the model.",
    "example": "Printer Unit Price and Cartridge Unit Price in the inkjet model.",
    "source": "W2"
  },
  {
    "term": "Parameter (Uncontrollable Input)",
    "definition": "An input variable with a given or assumed value that the decision maker cannot control.",
    "example": "Printer Unit Cost, Cartridge Unit Cost and Fixed Cost.",
    "source": "W2"
  },
  {
    "term": "Historical Variable",
    "definition": "An input variable with its value fixed (uncontrollable) — the InkJetPrinter workbook's term for inputs taken from historical data.",
    "source": "W2"
  },
  {
    "term": "Performance Measure",
    "definition": "An output (computed) variable whose value is of key interest to the decision maker.",
    "example": "Profit in the inkjet model; Total Expected Margin in Invest in Education.",
    "source": "W2"
  },
  {
    "term": "Consequence Variable",
    "definition": "An output variable produced along the way in the calculations, not itself the key interest.",
    "example": "Total Revenue, Total Cost, Printer Demand and Cartridge Demand.",
    "source": "W2"
  },
  {
    "term": "Exogenous Variable",
    "definition": "A known or given input variable coming from outside the model; influence diagrams picture how exogenous variables connect to the performance measure.",
    "source": "W2"
  },
  {
    "term": "What-if Analysis",
    "definition": "Changing input values in a completed model to observe the effect on outputs; Excel's what-if tools include Goal Seek and Data Tables.",
    "source": "W2"
  },
  {
    "term": "Goal Seek",
    "definition": "A what-if tool that finds the input value in ONE cell needed to make another cell reach a desired result — it calculates backward. It cannot maximize or minimize.",
    "example": "On the inkjet Model sheet, set cell C32 (Profit) to value 0 by changing C5 (Printer price) to find breakeven; the slides call the profit cell C27, its address on the Proto sheet.",
    "source": "W2"
  },
  {
    "term": "Solver",
    "definition": "An Excel add-in that searches for an optimal solution involving several variables: it maximizes, minimizes, or sets an objective cell to a value, subject to constraints, by adjusting decision variable cells.",
    "source": "W2"
  },
  {
    "term": "Trade-off Analysis",
    "definition": "Analysis in which a DECISION variable is changed to examine how the performance measures trade off against each other.",
    "example": "Varying printer price from $26.96 to $165 and observing profit.",
    "source": "W2"
  },
  {
    "term": "Sensitivity Analysis",
    "definition": "Analysis in which UNCONTROLLABLE parameters are changed to see how sensitive (or robust) the performance measure is to the assumptions.",
    "example": "Varying the demand-curve slope and cartridges-per-printer in a two-way Data Table.",
    "source": "W2"
  },
  {
    "term": "Data Table",
    "definition": "An Excel what-if feature that tabulates the results of a model in 2-D so you do not have to recompute manually; a two-way table has a corner formula cell, row input values and column input values.",
    "source": "W2"
  },
  {
    "term": "Breakeven Price",
    "definition": "The price at which profit equals zero; found with Goal Seek or Solver by driving the profit cell to 0. The inkjet model breaks even at $26.96 and again at $165.00.",
    "source": "W2"
  },
  {
    "term": "Bait & Hook Strategy",
    "definition": "A business model that sells the base product (printer) at a very low, possibly below-cost price and profits from highly marked-up proprietary consumables (cartridges).",
    "example": "Lexmark Z617 printer $59 vs its cartridge $65.50.",
    "source": "W2"
  },
  {
    "term": "Price-Demand Function",
    "definition": "A linear relationship between price and demand: demand = intercept + slope x price. For the printer, y = -0.06x + 10 with y in thousands of units.",
    "example": "At $60, demand = 10 - 0.06*60 = 6.4 thousand printers.",
    "source": "W2"
  },
  {
    "term": "Linear Programming (LP)",
    "definition": "A technique for minimizing or maximizing a linear objective function subject to linear equality and/or inequality constraints.",
    "example": "Choosing the casino hotel guest mix that maximizes net income subject to demand, occupancy, and floor space constraints.",
    "source": "W3"
  },
  {
    "term": "Decision Variables",
    "definition": "The input cells an optimizer is allowed to change; they may be real, integer, or binary values.",
    "example": "Cells C4:F4 in CasinoHotel.xlsx hold the number of guests of each type.",
    "source": "W3"
  },
  {
    "term": "Constraints",
    "definition": "Restrictions of the form <=, >=, or = on cells or combinations of cells; together they define the feasible region.",
    "example": "H17 <= J17 forces total floor space used to stay within net space available.",
    "source": "W3"
  },
  {
    "term": "Objective Function",
    "definition": "The single output quantity that Solver maximizes, minimizes, or drives to a target value.",
    "example": "Cell J14 (Net Income) in CasinoHotel.xlsx is set to Max.",
    "source": "W3"
  },
  {
    "term": "Feasible Region",
    "definition": "The set of all decision-variable combinations that satisfy every constraint; a unique LP optimum must lie at one of its corner points.",
    "source": "W3"
  },
  {
    "term": "Unbounded Solution",
    "definition": "An LP outcome where the feasible region is open in the improving direction, so the optimal cost is minus infinity (minimization) or plus infinity (maximization).",
    "source": "W3"
  },
  {
    "term": "Infeasible Problem",
    "definition": "An LP outcome where the constraints contradict each other so no feasible region exists and no solution can be found.",
    "source": "W3"
  },
  {
    "term": "LOOKUP",
    "definition": "A function that searches an ascending lookup_vector for the largest value less than or equal to the lookup_value and returns the corresponding result_vector entry.",
    "example": "=LOOKUP(4.19, A2:A6, B2:B6) returns the band whose threshold is the largest value <= 4.19.",
    "source": "W3"
  },
  {
    "term": "VLOOKUP",
    "definition": "A function that searches the leftmost column of a table_array and returns a value from the column given by col_index_num; TRUE/omitted gives approximate match on ascending data, FALSE gives the first exact match or #N/A.",
    "example": "=VLOOKUP(\"Singapore\", B2:D226, 2, FALSE)",
    "source": "W3"
  },
  {
    "term": "MATCH",
    "definition": "A function that returns the relative position of a lookup_value in a lookup_array; match_type 1 (default) needs ascending data, 0 is exact match in any order, -1 needs descending data.",
    "example": "=MATCH(\"Brunei\", B2:B226, 0) returns 10 in DataLookUp.xlsx.",
    "source": "W3"
  },
  {
    "term": "INDEX",
    "definition": "A function that returns the value at a given row_num and optional column_num position within an array; a row_num or column_num of 0 returns the whole column or row as a spill.",
    "example": "=INDEX(B2:B226, 1) returns Liechtenstein, the country ranked 1.",
    "source": "W3"
  },
  {
    "term": "Spill Formula",
    "definition": "A modern Excel formula that returns multiple values and automatically fills (spills) them into adjacent empty cells; it replaced the Ctrl+Shift+Enter array formula, and prefixing @ undoes the spill.",
    "source": "W3"
  },
  {
    "term": "XLOOKUP",
    "definition": "A modern lookup with separate lookup_array and return_array plus optional if_not_found, match_mode (0 exact default, -1 next smaller, 1 next larger, 2 wildcard), and search_mode (1 first default, -1 last, 2 binary ascending, -2 binary descending).",
    "example": "=XLOOKUP(C15,B3:B9,C3:C9,\"Duh\",-1) returns the value of the next smaller item when 2 is not found.",
    "source": "W3"
  },
  {
    "term": "IFS",
    "definition": "A function that evaluates condition/value pairs in order and returns the value for the first TRUE condition; a final TRUE condition acts as the catch-all, replacing nested IFs.",
    "example": "=IFS(A1<0,0,A1>100,100,TRUE,A1) caps A1 to the range 0-100.",
    "source": "W3"
  },
  {
    "term": "Time Value of Money",
    "definition": "The principle that a dollar today is worth more than a dollar in the future because money can earn interest over time; all Week 4 financial functions convert cash flows across time on this basis.",
    "source": "W4"
  },
  {
    "term": "Sign Convention",
    "definition": "In Excel financial functions, a negative amount is money taken away from the point of reference and a positive amount is money added to it.",
    "example": "From the borrower's view, PMT(8%/12,10,10000) returns -$1,037.03 — negative because the payment leaves the borrower's pocket.",
    "source": "W4"
  },
  {
    "term": "Point of Reference (Today)",
    "definition": "The timeline anchor for financial functions: today is the end of period 0, which is the same instant as the beginning of period 1.",
    "source": "W4"
  },
  {
    "term": "PMT()",
    "definition": "PMT(rate, nper, pv, [fv], [type]) returns the constant payment per period that amortizes a present value (and optionally reaches a future value) at a given rate.",
    "example": "=PMT(5%/12, 60, 140000, -10000) gives the monthly car-loan payment with a $10,000 balloon.",
    "source": "W4"
  },
  {
    "term": "PV()",
    "definition": "PV(rate, nper, pmt, [fv], [type]) returns the present value of a series of constant future payments and/or a future lump sum.",
    "example": "=PV(3%/12, 9, -3500, -600, 1) is the amount needed today for nine months of $3,500 beginning-of-month withdrawals plus $600 extra in the last month.",
    "source": "W4"
  },
  {
    "term": "FV()",
    "definition": "FV(rate, nper, pmt, [pv], [type]) returns the future value of constant periodic deposits and/or an initial amount compounded at the given rate.",
    "example": "=FV(6.5%, 10, -8000, -50000) is the value after 10 years of $50,000 now plus $8,000 yearly.",
    "source": "W4"
  },
  {
    "term": "RATE()",
    "definition": "RATE(nper, pmt, pv, [fv], [type], [guess]) gives the periodic interest rate, found by iteration from the guess (default 10%); it returns #NUM! if not converged within 0.0000001 after 20 iterations.",
    "example": "=RATE(12, -100, 1000) ≈ 2.92% per month (rounded to 3% on the slide).",
    "source": "W4"
  },
  {
    "term": "NPER()",
    "definition": "NPER(rate, pmt, pv, [fv], [type]) returns the number of periods needed; Excel accepts any sign combination, so the modeler must judge whether the answer makes sense.",
    "example": "NPER(12%, -100, -1000) ≈ -6.96 years is returned without error but is nonsense.",
    "source": "W4"
  },
  {
    "term": "NPV()",
    "definition": "NPV(rate, value1, value2, …) returns the present value of uneven cash flows assumed at the end of each period, with value1 at the end of period 1; an investment made today must be excluded from the arguments and added to the result.",
    "example": "=NPV(B10, C15:C24) + C14 where C14 holds the -$200,000 initial outlay.",
    "source": "W4"
  },
  {
    "term": "IRR()",
    "definition": "IRR(values, [guess]) returns the internal rate of return — the rate at which the NPV of the cash flows (including the initial investment) is zero; it needs at least one positive and one negative value and iterates up to 20 times to 0.00001% accuracy.",
    "example": "=IRR(C14:C24) ≈ 24.05% for the $200,000 project.",
    "source": "W4"
  },
  {
    "term": "Circular Reference",
    "definition": "A formula that refers back to its own cell, directly or through a chain of cells; Excel can only resolve it by iterative calculation, which may converge or diverge.",
    "example": "Charity = 10% of after-tax profit, but the charity amount is deducted before computing tax.",
    "source": "W4"
  },
  {
    "term": "Iterative Calculation",
    "definition": "Excel option (File / Options / Formulas / Enable iterative calculation) that repeatedly recalculates circular formulas until the change is below the Maximum change threshold (set to 0.0001 in the Charity model).",
    "source": "W4"
  },
  {
    "term": "Call Option",
    "definition": "The right (not obligation) to BUY an asset at a pre-agreed exercise price at a specified future time; priced by Black-Scholes as S·N(d1) − X·exp(−rf·t)·N(d2).",
    "source": "W4"
  },
  {
    "term": "Put Option",
    "definition": "The right (not obligation) to SELL an asset at a pre-agreed exercise price at a specified future time; priced by Black-Scholes as −S·N(−d1) + X·exp(−rf·t)·N(−d2).",
    "source": "W4"
  },
  {
    "term": "NORMSDIST()",
    "definition": "NORMSDIST(z) returns the cumulative probability of the standard Normal distribution (mean 0, sd 1) up to z; NORMSDIST(0) = 0.5.",
    "source": "W4"
  },
  {
    "term": "Balloon Payment",
    "definition": "A larger lump-sum amount paid together with the final periodic payment of a loan, entered as the fv argument of PMT with the appropriate sign.",
    "example": "=PMT(5%/12, 60, 140000, -10000) — the -10000 is the balloon.",
    "source": "W4"
  },
  {
    "term": "Monte Carlo simulation",
    "definition": "A technique that estimates the distribution of an outcome variable by repeated random sampling from the probability functions of the input variables. It yields a distribution of answers, not a single answer.",
    "example": "Simulate 1000 trials of the Monty Hall game with F9 recalculation, then take AVERAGE of the 0/1 win column to estimate the win probability.",
    "source": "W5"
  },
  {
    "term": "RAND()",
    "definition": "Excel function returning a continuous uniform random real number in [0, 1.0) — can equal 0 but never 1. Used as a randomly drawn cumulative probability.",
    "example": "=RAND() drawn as 0.556 is looked up against a CRF table to pick the simulated value.",
    "source": "W5"
  },
  {
    "term": "RANDBETWEEN(bottom, top)",
    "definition": "Excel function returning a discrete uniform random integer between bottom and top inclusive. Used as a random position number.",
    "example": "=RANDBETWEEN(1,6) simulates one die toss; equivalent to =INT(RAND()*6)+1.",
    "source": "W5"
  },
  {
    "term": "Resampling (Boot-strapping)",
    "definition": "Generating additional representative data from a small sample so a simulation has enough realistic input data. Week 5 covers three methods: frequency bins (M1), resampling from sample data (M2), and inverse distribution functions (M3).",
    "source": "W5"
  },
  {
    "term": "Cumulative Relative Frequency (CRF) table",
    "definition": "A table accumulating relative frequencies of each value from 0 to 1.0. A RAND() draw is located in a CRF interval to select the simulated value (Method M1).",
    "example": "Boundaries 0/0.381/0.667/0.869/0.964/1.0 for 0-4 children: RAND()=0.556 falls in [0.381, 0.667) so the simulated value is 1 child.",
    "source": "W5"
  },
  {
    "term": "LOOKUP down-shift rule",
    "definition": "LOOKUP returns the largest lookup value less than or equal to the target, so the CRF column must be shifted down one row relative to the values column; with VLOOKUP the CRF must be the leftmost column.",
    "example": "=LOOKUP(RAND(),M$12:M$32,L$13:L$33) — the values range starts one row lower than the CRF range.",
    "source": "W5"
  },
  {
    "term": "Probability Mass Function (PMF)",
    "definition": "For a discrete random variable, the function giving the probability of each exact value, P(X = x). Returned by Excel distribution functions when cumulative = FALSE.",
    "example": "=BINOMDIST(2, 10, 0.3, FALSE) gives P(exactly 2 successes in 10 trials).",
    "source": "W5"
  },
  {
    "term": "Probability Density Function (PDF)",
    "definition": "For a continuous random variable, the density at x; probabilities are areas under the curve. Returned when cumulative = FALSE for continuous distributions.",
    "example": "Exponential PDF: f(x) = λe^−λx where λ is the arrival rate.",
    "source": "W5"
  },
  {
    "term": "Cumulative Distribution Function (CDF)",
    "definition": "F(x) = P(X ≤ x), the probability that the random variable is at most x; always between 0 and 1. Returned when cumulative = TRUE. Because CDF values lie in [0,1], RAND() can stand in for a random CDF value in inversion.",
    "source": "W5"
  },
  {
    "term": "Inverse transform (inversion) method",
    "definition": "Simulating a random variate by setting the CDF equal to RAND() and solving for x, i.e. X' = F^-1(RAND()). Method M3 in Week 5.",
    "example": "Exponential: Y = 1 − e^−λx solved for x gives X' = −mean*LN(1−RAND()), and since 1−RAND() is still uniform, X' = −mean*LN(RAND()).",
    "source": "W5"
  },
  {
    "term": "Binomial distribution",
    "definition": "Distribution of the number of successes in n independent trials each with success probability p: P(X=k) = nCk p^k (1−p)^(n−k). Excel: BINOMDIST(number_s, trials, probability_s, cumulative).",
    "source": "W5"
  },
  {
    "term": "Poisson distribution",
    "definition": "Distribution of the number of events in a fixed interval with average rate λ: P(X=k) = e^−λ λ^k / k!. It is the limit of the Binomial with λ = np for very large n and small p. Excel: POISSON(x, mean, cumulative).",
    "example": "Simulated by X' = CRITBINOM(1000, mean/1000, RAND()).",
    "source": "W5"
  },
  {
    "term": "Exponential distribution",
    "definition": "Continuous distribution of inter-arrival times: f(x) = λe^−λx, where λ = arrival rate and mean = 1/λ. Excel: EXPONDIST(x, lambda, cumulative) — note the argument is the rate, not the mean.",
    "source": "W5"
  },
  {
    "term": "Standardisation (Z-score)",
    "definition": "Transforming a normal variable to standard normal with Z = (x − µ)/σ. NORMSDIST(z) gives the standard normal CDF; NORMSINV(RAND()) simulates a standard normal variate.",
    "source": "W5"
  },
  {
    "term": "CRITBINOM (BINOM.INV)",
    "definition": "Excel's inverse binomial: the smallest value whose cumulative binomial probability is greater than or equal to a criterion. With RAND() as the criterion it simulates a binomial variate.",
    "example": "=CRITBINOM(I$4,I$5,RAND()) in DataSim's Discrete sheet simulates Binomial(n, p).",
    "source": "W5"
  },
  {
    "term": "PERCENTILE resampling (M2b)",
    "definition": "X' = PERCENTILE(data, RAND()) resamples continuous data: Excel sorts the data, places points at percentiles (k−1)/(N−1), and linearly interpolates between the two points that bracket the drawn percentile.",
    "example": "Sorted 1.0, 3.0, 5.0, 7.0 sit at percentiles 0, 1/3, 2/3, 1; RAND()=0.5 gives (0.5−1/3)/(2/3−1/3) = (X'−3.0)/(5.0−3.0), so X' = 4.0.",
    "source": "W5"
  },
  {
    "term": "Reveal Door Options Matrix",
    "definition": "A 3x3 matrix (prize door rows x selected door columns) giving the host's door to open in Monty Hall; diagonal cells are random because the host has two valid doors when prize = selected. Read with INDEX(array, prize door, selected door).",
    "example": "Row prize=1: RANDBETWEEN(2,3), 3, 2. Prize=2, selected=2 cell: =IF(RAND()<0.5,1,3).",
    "source": "W5"
  },
  {
    "term": "Change door shortcut",
    "definition": "In 3-door Monty Hall, the switch door can be computed without a matrix: Change door = 6 − (revealed door + selected door), because the three door numbers always sum to 6.",
    "example": "Selected = 1, revealed = 2 → change door = 6 − 3 = 3.",
    "source": "W5"
  },
  {
    "term": "Serial value",
    "definition": "The sequential number Excel uses to store a date. The whole part counts days and the decimal part holds the time of day, so dates and times can be calculated like ordinary numbers.",
    "example": "39014 is 24 Oct 2006; Scratch!B5 =DATE(B2,B3,B4) returned 46292 for 27 Sep 2026.",
    "source": "W6"
  },
  {
    "term": "1900 date system",
    "definition": "Excel's default date system on Windows, where 1 Jan 1900 = 1. It includes a non-existent 29 Feb 1900 as serial 60, so a subtraction that spans that date comes out one day too large.",
    "example": "1 Mar 1900 is stored as 61 instead of 60.",
    "source": "W6"
  },
  {
    "term": "1904 date system",
    "definition": "The date system the slides list as the Mac default (true of older Excel for Mac; Excel for Mac 2011 and later default to 1900), where 1 Jan 1904 = 0; it has no phantom leap day.",
    "example": "29 Feb 1904 = 59 and 1 Mar 1904 = 60.",
    "source": "W6"
  },
  {
    "term": "Time serial (fraction of a day)",
    "definition": "A time is stored as the decimal part of a serial value because it is a portion of one day; TIME(hour, minute, second) returns just this fraction.",
    "example": "0.3333333 is 8:00 AM; 0.847 is 8:19:41 PM on any day.",
    "source": "W6"
  },
  {
    "term": "[h] format code",
    "definition": "A custom time code that keeps counting hours past 23 (24, 25, …) instead of wrapping at midnight, used to display elapsed durations longer than a day.",
    "example": "A total of 31 h 15 min shows as 31:15 with [h]:mm but as 7:15 with h:mm.",
    "source": "W6"
  },
  {
    "term": "Inter-arrival time",
    "definition": "The duration between one customer's arrival and the next customer's arrival.",
    "example": "Data!B13:K27 holds 150 observed inter-arrival times averaging about 4:48 (H6 =AVERAGE(B13:K27)).",
    "source": "W6"
  },
  {
    "term": "Service time",
    "definition": "The duration a server spends serving one customer, from service start to service end.",
    "example": "Data!B30:K44 holds 150 observed service times averaging about 11:00 (I6).",
    "source": "W6"
  },
  {
    "term": "Wait time",
    "definition": "The duration a customer spends queuing: service start time minus arrival time.",
    "example": "1-Server!H15 =F15-E15.",
    "source": "W6"
  },
  {
    "term": "System time",
    "definition": "The total duration a customer spends in the system: service end time minus arrival time, i.e. wait time plus service time.",
    "example": "1-Server!I15 =G15-E15.",
    "source": "W6"
  },
  {
    "term": "System queue length",
    "definition": "The number of customers in the system (waiting plus being served) when a customer arrives, counted as earlier customers whose service end time is later than that arrival.",
    "example": "1-Server!J15 =COUNTIF($G$14:G14,\">\"&E15).",
    "source": "W6"
  },
  {
    "term": "Traffic intensity",
    "definition": "(Average service time ÷ number of servers) ÷ average inter-arrival time. A value above 1 means customers arrive faster than the servers can handle them, so the queue keeps growing.",
    "example": "1-Server C8 =D4/C4 = 4:00/5:00 = 0.8; c-Server C8 =(D4/G4)/C4 = 1.15 with 2 servers.",
    "source": "W6"
  },
  {
    "term": "Utilisation",
    "definition": "The fraction of available server time actually spent serving: total service time ÷ (number of servers × time the system has been open). It can never exceed 1.",
    "example": "c-Server D8 =SUM(D15:D99)/(G4*(G8-G14)) = 0.97 in the saved run.",
    "source": "W6"
  },
  {
    "term": "Balking",
    "definition": "An arriving customer leaves without joining because the system queue length exceeds the balk limit.",
    "example": "With BalkLimit F4 = 7, F15 becomes \"\" when L15 > 7.",
    "source": "W6"
  },
  {
    "term": "Reneging",
    "definition": "A customer who has joined the queue leaves before being served because the potential wait exceeds the reneging time limit.",
    "example": "With RenegeLimit G4 = 0:30, H15 is blank when G15 > 30 minutes.",
    "source": "W6"
  },
  {
    "term": "Balk proportion",
    "definition": "The share of all arrivals who balked: (total arrivals − total who joined the queue) ÷ total arrivals.",
    "example": "F8 =(COUNT(E15:E99)-COUNT(F15:F99))/COUNT(E15:E99) = 0.16 in 'c-Server (BR)'.",
    "source": "W6"
  },
  {
    "term": "Renege proportion",
    "definition": "The share of customers who joined the queue but left before starting service: (total who joined − total who started service) ÷ total who joined.",
    "example": "G8 =(COUNT(F15:F99)-COUNT(H15:H99))/COUNT(F15:F99) = 0.19 in 'c-Server (BR)'.",
    "source": "W6"
  },
  {
    "term": "Potential start time",
    "definition": "In the balking/reneging model, the service start a customer who joined would get: the arrival time if fewer than c are in the system, otherwise the c-th largest earlier end time. It becomes the actual start only if the potential wait is within the renege limit.",
    "example": "F15 =IF(L15>F$4,\"\",IF(L15>=I$4,LARGE(I$14:I14,I$4),$E15)).",
    "source": "W6"
  },
  {
    "term": "Inverse-exponential generator",
    "definition": "-Mean*LN(RAND()) turns a uniform random number into an exponentially distributed duration with the given mean; used for inter-arrival and service times from a known distribution.",
    "example": "1-Server!C15 =-$C$4*LN(RAND()).",
    "source": "W6"
  },
  {
    "term": "Macro (recorded)",
    "definition": "A sequence of Excel actions captured by Developer > Record Macro and saved as VBA code, which can then be edited in the Visual Basic Editor and assigned to a button.",
    "example": "addRecord copies C4:G4, pastes the values below the last record and clears D4:G4.",
    "source": "W6"
  },
  {
    "term": "Use Relative Reference",
    "definition": "A macro-recorder mode that records cursor moves relative to the active cell (ActiveCell.Offset) instead of fixed addresses, so the macro follows data that grows.",
    "example": "The relative Down Arrow in addRecord is recorded as ActiveCell.Offset(1, 0).Range(\"A1\").Select.",
    "source": "W6"
  },
  {
    "term": "Macro",
    "definition": "An automated series of spreadsheet actions, stored as a unit of VBA code (a Sub procedure). It is created by recording in Excel or by coding in the VB Editor.",
    "example": "RecordArrive in TimerClicker stamps the current time into the next empty Arrive cell.",
    "source": "W9"
  },
  {
    "term": "VBA (Visual Basic for Applications)",
    "definition": "The object-oriented programming language built into Excel, used to cut the time and effort of repetitive tasks.",
    "example": "Ex1_EnterMyName writes text into A1 and sets Font.Italic and Font.Bold to True.",
    "source": "W9"
  },
  {
    "term": "Visual Basic Editor (VBE)",
    "definition": "Excel's code editor, with three main panes: Project Explorer, Code Window and Properties Window.",
    "example": "Use Insert > Module in the VBE before writing a user-defined function.",
    "source": "W9"
  },
  {
    "term": "Module",
    "definition": "A standard code container in a VBA project. Recorded macros are stored in a Module, and a user-defined function MUST be written in a Module to work in a worksheet.",
    "example": "TimerClicker Module1 holds RecordArrive, RecordStart, RecordEnd, RecordEndPlus and CopyFormulas.",
    "source": "W9"
  },
  {
    "term": "Sub procedure",
    "definition": "A program that runs without returning a value. It can be run from the VBE, from the Macro dialog box or from a button or shape it is assigned to.",
    "example": "Sub ShowMessage() / MsgBox (\"I love MITB!\") / End Sub",
    "source": "W9"
  },
  {
    "term": "Function procedure (user-defined function)",
    "definition": "A program that returns a single value by assigning to its own name. It can be called from a Sub or used in a worksheet formula.",
    "example": "Function CubeRoot(number): CubeRoot = number ^ (1/3), so =CubeRoot(27) returns 3.",
    "source": "W9"
  },
  {
    "term": "Object hierarchy",
    "definition": "The nesting of Excel objects: Application contains WorksheetFunction, Add-ins and Workbooks; a Workbook contains Charts and Worksheets; a Worksheet contains Range and Cells.",
    "example": "Worksheets(\"Sheet1\").Range(\"A1:A10\") walks from a worksheet down to a range.",
    "source": "W9"
  },
  {
    "term": "Property",
    "definition": "An attribute of an object that can be read or set, either in the Properties Window or in code.",
    "example": "Range(\"A1\").Font.Bold = True; Sheets(\"Scratch\").Visible = 0.",
    "source": "W9"
  },
  {
    "term": "Method",
    "definition": "An action that an object can perform.",
    "example": "Add, Activate and Calculate on the slides; Range(\"B4:B11\").ClearContents in UsefulMacros.",
    "source": "W9"
  },
  {
    "term": "Event-handler procedure",
    "definition": "A procedure that runs automatically in response to an interactive action (open, change, select, click). Its header is generated by choosing the object and the event in the object's code window.",
    "example": "Private Sub Workbook_Open() / MsgBox (\"Welcome\") / End Sub in ThisWorkbook.",
    "source": "W9"
  },
  {
    "term": "Absolute reference (macro recording)",
    "definition": "The default recording mode: cell addresses are fixed in the code, so the macro acts on the same cells on every run.",
    "example": "Range(\"C7\").Copy in RecordArrive always copies the time-now cell C7, wherever the cursor is.",
    "source": "W9"
  },
  {
    "term": "Relative reference (macro recording)",
    "definition": "The recording mode turned on with Use Relative References: moves are recorded as offsets from the active cell, so the target changes on each run.",
    "example": "ActiveCell.Offset(-2,0).Range(\"A1\").Select moves two cells up from wherever the cursor is.",
    "source": "W9"
  },
  {
    "term": "ActiveCell",
    "definition": "The single cell that currently has the focus. Relative macros move it with Offset, and many macros read or write it directly.",
    "example": "Ex9_SquareRoot writes Sqr(Num) into ActiveCell.Value.",
    "source": "W9"
  },
  {
    "term": "Offset",
    "definition": "Range.Offset(rows, columns) returns the cell that many rows down and columns to the right of a reference cell; negative values go up or left.",
    "example": "Range(\"A1\").Offset(2, 3) is D3 (Ex2_MoveIt).",
    "source": "W9"
  },
  {
    "term": "End(xlDown)",
    "definition": "The code form of Ctrl+Down Arrow: from a filled cell with data directly below it, it returns the last filled cell of that contiguous block.",
    "example": "Range(\"C6\").End(xlDown).Offset(1, 0) is the first empty Arrive cell in TimerClicker.",
    "source": "W9"
  },
  {
    "term": "Option Explicit",
    "definition": "A statement placed first in a module that forces every variable to be declared before use.",
    "example": "TimerClicker Module1 and Module3 both start with Option Explicit.",
    "source": "W9"
  },
  {
    "term": "Variant",
    "definition": "The 16-byte catch-all data type that holds numeric, string or date data and the special values Empty and Null. Every variable not explicitly declared becomes a Variant.",
    "example": "In Dim p, q, r As Integer only r is an Integer; p and q are Variants.",
    "source": "W9"
  },
  {
    "term": "Static variable",
    "definition": "A procedure-level variable that keeps its value after the procedure ends.",
    "example": "Static k As Integer with k = k + 1 counts how many times Mysub has run.",
    "source": "W9"
  },
  {
    "term": "Dynamic array",
    "definition": "An array declared without a size and sized at run time with ReDim.",
    "example": "Dim MyArray() As Integer, then ASize = Range(\"A1\").Value and ReDim MyArray(ASize).",
    "source": "W9"
  },
  {
    "term": "On Error GoTo <label>",
    "definition": "A general error trap: any run-time error jumps to the named label, where the macro can show a friendly message instead of stopping.",
    "example": "Ex9_SquareRoot sends a negative or non-numeric entry to BadEntry: MsgBox (\"Enter a positive numeric value\").",
    "source": "W9"
  },
  {
    "term": "AutoFilter",
    "definition": "Excel's quick filter: Data > Filter adds a pull-down to every column header offering sorts, colour filters, type-specific filters and a checklist of the column's unique entries.",
    "example": "Untick everything except one customer in a Customer column to show only that customer's rows.",
    "source": "W10"
  },
  {
    "term": "Custom AutoFilter",
    "definition": "The 'Show rows where:' dialog reached through Custom Filter...; it applies at most two conditions to one column, joined by And or Or.",
    "example": "Priority is greater than or equal to 2 And Priority is less than 4.",
    "source": "W10"
  },
  {
    "term": "Wildcard characters (? and *)",
    "definition": "Pattern symbols used in filter conditions: ? matches exactly one character and * matches any run of characters, including none.",
    "example": "'equals T-1?' matches T-10 but not T-100; 'equals T-1*' matches T-1, T-10 and T-100.",
    "source": "W10"
  },
  {
    "term": "Top 10 filter",
    "definition": "A Number Filter that keeps the top or bottom N items or N percent of a numeric field; when ties at the cut-off mean more records qualify, all of them are shown.",
    "example": "Top 3 Items on sales of 500, 450, 450, 450, 300 shows four rows.",
    "source": "W10"
  },
  {
    "term": "Sort by Color (custom sort)",
    "definition": "A Sort dialog option that orders rows by Cell Color, Font Color or Conditional Formatting Icon instead of by cell values.",
    "example": "Put all orange (level 3) milestones first by sorting the Due Date column on cell colour.",
    "source": "W10"
  },
  {
    "term": "Custom List",
    "definition": "A user-defined or built-in sequence (Sun-Sat, Jan-Dec and their full-name versions) that a sort can follow instead of alphabetical order.",
    "example": "Sorting Jan, Feb, Mar with the Jan-Dec custom list keeps calendar order instead of Feb, Jan, Mar.",
    "source": "W10"
  },
  {
    "term": "Day and month format codes",
    "definition": "Codes that control how a date displays: d/dd give the day of the month, ddd/dddd the weekday name, m/mm the month number and mmm/mmmm the month name.",
    "example": "2 Nov 2019 with ddd d mmm yy displays Sat 2 Nov 19.",
    "source": "W10"
  },
  {
    "term": "Elapsed-hours code [h]",
    "definition": "A time format code that keeps counting hours beyond 23 (24, 25, ...), unlike h or hh, which restart at 0 each day.",
    "example": "A duration of 1.5 days shows as 36:00 with [h]:mm but as 12:00 with h:mm.",
    "source": "W10"
  },
  {
    "term": "Advanced Filter",
    "definition": "Data > Advanced: filters a list against several criteria at once, written in a criteria range on the sheet; it can filter in place or copy the results elsewhere.",
    "example": "Filter_Alert in the Offshore workbook runs Advanced Filter on B19:I65536 with criteria D14:I15.",
    "source": "W10"
  },
  {
    "term": "List range",
    "definition": "The block of records Advanced Filter examines, including its header row.",
    "example": "Demo-Advanced-Filter uses Sheet1!$B$7:$E$11 (Name, Gender, Address, Age).",
    "source": "W10"
  },
  {
    "term": "Criteria range",
    "definition": "The criteria headers and the row(s) of criteria values below them; it sits above the list with at least one empty row between, and its headers must match list headers exactly.",
    "example": "Demo Example 2 uses G3:H5: Gender | Age, then F | >=30 and M | <30.",
    "source": "W10"
  },
  {
    "term": "Filter the list, in-place",
    "definition": "The Advanced Filter action that hides every list row failing the criteria, leaving matching rows where they are.",
    "example": "Offshore hides all milestones outside the chosen alert window.",
    "source": "W10"
  },
  {
    "term": "Copy to another location",
    "definition": "The Advanced Filter action that copies matching records to the range named in Copy to, leaving the original list unfiltered.",
    "example": "Extract all overdue orders to a separate report area to the right of the data.",
    "source": "W10"
  },
  {
    "term": "Unique records only",
    "definition": "An Advanced Filter option that removes duplicate records from the result.",
    "example": "Copy only the Customer column with Unique records only ticked to list each matching customer once.",
    "source": "W10"
  },
  {
    "term": "AND condition (same row)",
    "definition": "Criteria values written on the same criteria row must all be satisfied by a record at the same time.",
    "example": "Gender F and Age >=30 on one row keep only females aged 30 or more.",
    "source": "W10"
  },
  {
    "term": "OR condition (separate rows)",
    "definition": "Each additional criteria row is an alternative; a record passes if it satisfies any one row completely.",
    "example": "Row 4 F | >=30 and row 5 M | <30 keep (female AND 30+) OR (male AND under 30).",
    "source": "W10"
  },
  {
    "term": "Alert level",
    "definition": "Offshore Development's lateness band for a milestone, based on how many days ago it fell due: 0 (last 2 weeks), 1 (2-4 weeks), 2 (4-8 weeks), 3 (over 8 weeks).",
    "example": "A milestone due 23 days before the as-at date is level 1 (-28 to -15 days).",
    "source": "W10"
  },
  {
    "term": "PivotTable",
    "definition": "An interactive summary of a list that groups records by the fields placed in its row and column areas, limits them to the item(s) chosen in its report-filter area, and aggregates a value field.",
    "example": "Grand Grocery sums Sales by Product (rows) and Category (columns) for the quarter chosen in the filter.",
    "source": "W10"
  },
  {
    "term": "Report filter (page field)",
    "definition": "The PivotTable area above the table that restricts the whole summary to the selected item(s) of a field.",
    "example": "Quarter = Q2 in PivotTable!B3:C3 limits every total to second-quarter sales ($2,123,685).",
    "source": "W10"
  },
  {
    "term": "PivotChart",
    "definition": "A chart linked to a PivotTable that redraws whenever the pivot's layout or filters change.",
    "example": "Grand Grocery's stacked column PivotChart shows each product's Q2 sales split by its 9 category series.",
    "source": "W10"
  }
]
