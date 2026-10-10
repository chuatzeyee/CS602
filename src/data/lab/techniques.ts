// exam techniques seen in the past papers (site_build/exam/analysis.json), most frequent first.
// Exercise.techniques must use these exact strings.
export const EXAM_TECHNIQUES = [
  "Time arithmetic (durations, x24, /1440, /86400)",
  "Data Table for Monte Carlo replications (blank input cell)",
  "SUMPRODUCT totals and weighted/expected values",
  "Written interpretation of model results",
  "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)",
  "Absolute/mixed references so formulas fill down/right",
  "Solver optimisation (objective, changing cells, constraints)",
  "What-if / scenario analysis by changing inputs",
  "Building lookup/step tables (lower bounds, increments, CRF)",
  "Discrete random variable via CRF table + LOOKUP(RAND())",
  "IF with AND/OR multi-condition rules",
  "Queue performance measures (weighted wait, % within threshold, utilisation)",
  "Unit conversion (MB to GB, seconds/minutes to day fractions)",
  "Capacity and flow-balance logic with MIN/MAX",
  "Conditional aggregation (SUMIF/COUNTIF with criteria strings)",
  "INDEX by row/column number (matrix lookup)",
  "Linearising a model for Solver (fix step-lookups, choose engine)",
  "Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))",
  "Date functions (TODAY, MONTH, WEEKDAY, date differences)",
  "ROUNDUP block counts and MIN for the cheaper option",
  "Bernoulli event (RAND() < p)",
  "Binomial random variable (CRITBINOM / BINOM.INV)",
  "Exponential inter-arrival times (-mean*LN(RAND()))",
  "Goal Seek",
  "Integer constraints in Solver",
  "Linear trend forecasting (TREND / trendline)",
  "Multi-server queue (COUNTIF system length + LARGE c-th end time)",
  "Normal random variable (NORMINV) with a floor via MAX",
  "Replicate the full output (E[f(X)] is not f(E[X]))",
  "Time value of money (NPV vs lump sum)",
  "Time-stepped batch-service queue simulation",
  "Two-way INDEX/MATCH lookup"
] as const

export type ExamTechnique = (typeof EXAM_TECHNIQUES)[number]
