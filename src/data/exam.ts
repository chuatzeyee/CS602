// final exam prep: format checked against the course outline; papers paraphrased from the past-paper analysis.
// no question text is reproduced; technique names match EXAM_TECHNIQUES so lab links line up.
import type { ExamTechnique } from './lab/techniques'

export interface GlanceStat {
  label: string
  value: string
  note: string
}

export interface Note {
  title: string
  detail: string
}

export interface StrategyItem {
  id: string            // localStorage key part: keep stable
  title: string
  detail: string
}

export interface TimeBlock {
  from: number          // minutes into the paper
  to: number
  label: string
  detail: string
  focus: boolean        // a question block (accent) or overhead (muted)
}

export interface PartSummary {
  label: string
  marks: number
  focus: string         // what the part asked for, in our words
  techniques: readonly ExamTechnique[]
}

export interface QuestionSummary {
  id: string
  title: string
  marks: number
  kind: 'model' | 'simulation'
  modelled: string
  parts: readonly PartSummary[]
  watch: readonly string[]
}

export interface PaperSummary {
  id: string
  title: string
  sitting: string
  questions: readonly QuestionSummary[]
}

export interface TechniqueCount {
  technique: ExamTechnique
  count: number         // sub-parts that needed it
  papers: number        // of the 3 papers
}

export interface QuizPattern {
  quiz: string
  week: string
  patterns: readonly string[]
}

export interface ExamData {
  glance: readonly GlanceStat[]
  verified: string
  questions: string
  rules: readonly string[]
  grading: string
  marking: readonly Note[]
  templateNotes: readonly string[]
  timePlan: readonly TimeBlock[]
  timeTips: readonly string[]
  strategy: readonly StrategyItem[]
  sourceNote: string
  papers: readonly PaperSummary[]
  techniqueFrequency: readonly TechniqueCount[]
  quizPatterns: readonly QuizPattern[]
  mockConventions: readonly Note[]
}

export const exam: ExamData = {
  glance: [
    { label: "Duration", value: "2 h", note: "for both questions" },
    { label: "Questions", value: "2", note: "business problems, all parts compulsory" },
    { label: "Marks", value: "25", note: "total in every past paper" },
    { label: "Course grade", value: "30%", note: "joint largest, with the group project" },
    { label: "Materials", value: "Open book", note: "printed notes and files on your laptop" },
    { label: "Internet", value: "None", note: "no live internet access is allowed" },
  ],
  verified:
    "Duration, question count, open book, no internet and the 30% weight are confirmed by the AY2026-27 course outline. The 25-mark total and the rule that every question must be answered come from the past papers.",
  questions:
    "Each question is a business problem that you build into one Excel model. The past papers split the 25 marks almost evenly (13 + 12 or 12 + 13), with 4 to 8 sub-parts per question worth anything from half a mark to 6 marks.",
  rules: [
    "Open book: bring any printed material, and use any files already saved on your laptop, such as slides, class workbooks and your own notes.",
    "No live internet. Web search, online help and AI assistants are all unavailable, so prepare an offline kit.",
    "Two hours cover both questions, and every part needs an answer.",
    "The past papers allowed no enquiries during the exam. If a part is ambiguous, write your assumption in a cell next to the answer.",
    "The exam is worth 30% of the course grade.",
  ],
  grading:
    "Only the template file you hand in is marked: the values and/or formula text sitting in the named answer cells. In past keys a single cell earned between a quarter mark and 2 marks, the formula and its result were often scored separately, equivalent formulas were accepted, simulated results were judged against a range, and short written explanations earned marks where a part asked for them.",
  marking: [
    {
      title: "Answer cells",
      detail:
        "Marks come only from the named cells. Build at the exact addresses the question shows (J17, G13 and so on) so your formula points at the same cells as the key.",
    },
    {
      title: "Formula + value",
      detail:
        "Many cells score twice: once for a working formula rather than a typed-in number, and once for the value it returns. Any equivalent formula earns the marks.",
    },
    {
      title: "Fill-safe $ anchoring",
      detail:
        "Most answers get filled down or across, so the dollar signs are checked too. Lock parameter cells ($G$2), lock only the column or the row where needed ($F18, C$4), and leave the moving part relative.",
    },
    {
      title: "Formats",
      detail:
        "Report values in the format requested: clock times as hh:mm:ss rather than day fractions, rates as percentages, money to 2 decimal places.",
    },
  ],
  templateNotes: [
    "Solver parts: record the objective cell, Max or Min, the changing cells, every constraint (written as range comparisons such as E4:E6 >= E5:E7) and the optimal values.",
    "Goal Seek parts: report the input you solved for, such as an end time, not just the target value you reached.",
    "Simulation parts: say how many replications you ran, how the Data Table was set up (which row and column input cells) and the averaged result. Keys accept a range.",
    "Never insert rows or columns that would shift the answer cells. Experiment on a copy and paste your final formulas or values back.",
    "=FORMULATEXT(cell) displays a formula as text, which saves retyping it into an answer cell. It appears in the Week 3 XLOOKUP workbook.",
  ],
  timePlan: [
    {
      from: 0,
      to: 5,
      label: "Read and tag",
      detail: "Read both questions. Label each part with its technique and note the answer cells.",
      focus: false,
    },
    {
      from: 5,
      to: 60,
      label: "Model question",
      detail:
        "About 55 minutes. Bank the quick deterministic parts first (lookups, totals, financial functions); leave Solver for the end of the block.",
      focus: true,
    },
    {
      from: 60,
      to: 115,
      label: "Simulation question",
      detail:
        "About 55 minutes. Build the probability tables, get one correct row, fill it down, then set up the replication Data Tables.",
      focus: true,
    },
    {
      from: 115,
      to: 120,
      label: "Final pass",
      detail: "Check formats and $ anchoring in the answer cells, make sure every part has an entry, and save.",
      focus: false,
    },
  ],
  timeTips: [
    "In all three past papers Question 1 was the deterministic model-and-optimise problem and Question 2 the simulation or queue. Read both before choosing an order.",
    "Save a new version every 10 minutes, and keep the original template untouched until you paste in final answers.",
    "If a Solver or replication part stalls, record what you have (settings, partial values, assumptions) and move on; come back in the final pass.",
  ],
  strategy: [
    {
      id: "tag-parts",
      title: "Spend the first 5 minutes tagging parts",
      detail:
        "Mark each part as lookup, SUMPRODUCT, Solver, Goal Seek or simulation + Data Table. Every past paper paired one deterministic model with one simulation or queue problem.",
    },
    {
      id: "budget-time",
      title: "Budget about 55 minutes per question",
      detail:
        "Collect the fast deterministic marks first. Solver and replication parts take longest, so they come last.",
    },
    {
      id: "same-cells",
      title: "Rebuild the layout at the template's addresses",
      detail: "The key's formulas refer to those exact cells, so yours should too.",
    },
    {
      id: "crf-first",
      title: "Build each probability table before drawing from it",
      detail:
        "Start the cumulative (CRF) column at 0 and draw with LOOKUP(RAND(), CRF, values). Keep the other generators ready: -mean*LN(1-RAND()), NORMINV(RAND(),mean,sd), CRITBINOM(n,p,RAND()), a+RAND()*(b-a), INDEX(table,RANDBETWEEN(..),RANDBETWEEN(..)) and PERCENTILE(data,RAND()).",
    },
    {
      id: "replications",
      title: "Replicate with a Data Table on a blank input cell",
      detail:
        "Trial numbers go down a column, the output formula sits at the top, and a BLANK cell is the column input. When a parameter runs across the top, make it a two-way table with that parameter as the row input. Average the whole column. While building, set calculation to Automatic except for Data Tables and press F9 to refresh.",
    },
    {
      id: "ranges",
      title: "Expect a range, not the key's number",
      detail:
        "Simulated answers never match the key's point estimate exactly; keys accept a band such as 35-37. Sanity-check with quick arithmetic: n x p, capacity x price, utilisation below 100%.",
    },
    {
      id: "solver-engine",
      title: "Choose the Solver engine deliberately",
      detail:
        "Simplex LP for linear models. Remove step functions first by fixing the bracket the answer must sit in, then confirm it. GRG Nonlinear suits smooth non-linear models and Evolutionary handles leftover IF, MIN or LOOKUP. For integer models set Integer Optimality to 0%, tick Make Unconstrained Variables Non-Negative, and re-run GRG from a second start.",
    },
    {
      id: "solver-write",
      title: "Write Solver settings the way keys do",
      detail:
        "Objective, Max/Min and changing cells, then each constraint as a range comparison (E4:E6 >= E5:E7, M18:O27 <= 1).",
    },
    {
      id: "goal-seek",
      title: "Start Goal Seek near the answer",
      detail:
        "The changing cell must hold a value, not a formula. With tiered prices that drop at band edges, start close to the expected answer, then plug the result back in to confirm it.",
    },
    {
      id: "time-units",
      title: "Treat times as fractions of a day",
      detail:
        "Multiply a time by 24 for hours; divide minutes by 1440 and seconds by 86400 to turn them into time values. Format answers hh:mm:ss, and test bands with ROUND(x*24,6) so exact boundaries do not fall a hair short.",
    },
    {
      id: "financial",
      title: "Mind NPV timing and the rate period",
      detail:
        "NPV discounts its first value by one period, so add the time-0 cash flow outside the function. Match the rate to the period (annual/12 for months), watch PMT/PV/FV signs, and use type = 1 for payments at the start of each period.",
    },
    {
      id: "replicate-output",
      title: "Average outputs, not inputs",
      detail:
        "When the output is non-linear (MAX(0,x), MIN, IF), replicate the output itself. Feeding average inputs into the formula gives a different, wrong number.",
    },
    {
      id: "assumptions",
      title: "Write assumptions beside answers",
      detail:
        "With no one to ask, note choices such as \"discounts applied one after the other\" or \"items = total units\" next to the cell.",
    },
    {
      id: "offline-kit",
      title: "Pack an offline kit",
      detail:
        "Course workbooks (the Call Center c-server model, DataSim, Echo Office Supplies, Time Value, InkJet Printer), a one-page syntax sheet (LOOKUP vectors, CRITBINOM, NORMINV, COUNTIF with \">\"&cell, LARGE, NPV timing) and your own solved mock workbooks.",
    },
    {
      id: "save-often",
      title: "Save a new version every 10 minutes",
      detail: "Keep the original template untouched until you paste in the final answers.",
    },
    {
      id: "weeks-9-10",
      title: "Know where Weeks 9-10 fit",
      detail:
        "Macros, VBA, PivotTables and filters never appeared in these three papers, but the CS602 outline lists them in the course scope and does not exclude them from the exam. Be ready to summarise with COUNTIF, SUMPRODUCT or a quick PivotTable and to apply an AutoFilter or Advanced Filter. A macro is harder to mark through answer cells, but do not rule one out.",
    },
  ],
  sourceNote:
    "All three papers were set for IS102 Computer as an Analysis Tool, an earlier SMU course built on the same Excel modelling toolkit. CS602 keeps the core format (2 hours, 2 business problems, open book, no internet). The old papers had answer boxes printed in the paper, while CS602 collects answers in a template file, so these papers are the best available guide to the technique mix rather than to the answer layout. The summaries below are written in our own words and do not reproduce any question text.",
  papers: [
    {
      id: "ay1415t1",
      title: "AY2014-15 Term 1",
      sitting: "IS102 final exam, December 2014",
      questions: [
        {
          id: "q1",
          title: "Grocery checkout: discount brackets, a budget Solver, a trend and date rules",
          marks: 13,
          kind: "model",
          modelled:
            "A shop receipt where quantities times unit prices give a subtotal. A spend-based discount comes from brackets supplied as text ranges, and a weekday add-on discount depends on spend and item count. Later parts optimise a basket under a budget, forecast sales with a straight-line trend and flag customers for a birthday offer using dates and loyalty points.",
          parts: [
            { label: "a", marks: 1, focus: "Receipt subtotal", techniques: ["SUMPRODUCT totals and weighted/expected values"] },
            {
              label: "b",
              marks: 1,
              focus: "Turn text brackets into a numeric lower-bound table",
              techniques: [
                "Building lookup/step tables (lower bounds, increments, CRF)",
                "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)",
              ],
            },
            {
              label: "c",
              marks: 1,
              focus: "Discount rate by approximate match",
              techniques: ["Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)"],
            },
            {
              label: "d",
              marks: 2,
              focus: "Weekday add-on discount with three conditions",
              techniques: ["IF with AND/OR multi-condition rules", "Date functions (TODAY, MONTH, WEEKDAY, date differences)"],
            },
            {
              label: "e",
              marks: 3,
              focus: "Integer Solver basket within a budget",
              techniques: [
                "Solver optimisation (objective, changing cells, constraints)",
                "Integer constraints in Solver",
                "Linearising a model for Solver (fix step-lookups, choose engine)",
              ],
            },
            {
              label: "f",
              marks: 1,
              focus: "Read off the optimal subtotal and total",
              techniques: ["Solver optimisation (objective, changing cells, constraints)"],
            },
            {
              label: "g",
              marks: 2,
              focus: "Straight-line forecast and its equation",
              techniques: [
                "Linear trend forecasting (TREND / trendline)",
                "Absolute/mixed references so formulas fill down/right",
              ],
            },
            {
              label: "h",
              marks: 2,
              focus: "Birthday-offer eligibility from dates and points",
              techniques: ["IF with AND/OR multi-condition rules", "Date functions (TODAY, MONTH, WEEKDAY, date differences)"],
            },
          ],
          watch: [
            "List bracket lower bounds in ascending order and include a 0 row, otherwise small amounts return #N/A.",
            "The discount is a step function of the subtotal. Fix the bracket the optimum must fall in so the model stays linear, then solve with Simplex LP and integer constraints.",
            "\"At least\" means >=, \"more than\" means >. WEEKDAY counts Sunday as 1 unless told otherwise.",
            "Anchor the history ranges inside TREND with $ so they do not slide when filled down.",
          ],
        },
        {
          id: "q2",
          title: "Peak-hour shuttle with a capacity-capped waiting lounge",
          marks: 12,
          kind: "simulation",
          modelled:
            "A time-stepped queue. Buses leave at fixed intervals with limited seats, and a lounge of limited size holds waiting passengers and turns away the overflow. Arrivals per interval follow a discrete distribution and boarding time per passenger is drawn from a small table. The model tracks boarded, left-behind and rejected passengers, revenue and departure times, then replicates the evening to test lounge sizes.",
          parts: [
            {
              label: "a",
              marks: 6,
              focus: "One fill-down row: arrivals, lounge, boarded, waiting, rejected, departure time",
              techniques: [
                "Discrete random variable via CRF table + LOOKUP(RAND())",
                "Capacity and flow-balance logic with MIN/MAX",
                "Time-stepped batch-service queue simulation",
                "Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))",
                "INDEX by row/column number (matrix lookup)",
                "Time arithmetic (durations, x24, /1440, /86400)",
                "Unit conversion (MB to GB, seconds/minutes to day fractions)",
                "Absolute/mixed references so formulas fill down/right",
              ],
            },
            {
              label: "b",
              marks: 2,
              focus: "Average queue for two lounge sizes from 1,000 replications",
              techniques: [
                "Data Table for Monte Carlo replications (blank input cell)",
                "What-if / scenario analysis by changing inputs",
                "Queue performance measures (weighted wait, % within threshold, utilisation)",
              ],
            },
            {
              label: "c",
              marks: 1,
              focus: "Average daily revenue from replications",
              techniques: ["Data Table for Monte Carlo replications (blank input cell)"],
            },
            {
              label: "d",
              marks: 3,
              focus: "Does a bigger lounge raise revenue? Explain",
              techniques: ["What-if / scenario analysis by changing inputs", "Written interpretation of model results"],
            },
          ],
          watch: [
            "Start the cumulative-probability column at 0 so LOOKUP maps every RAND() to the right value.",
            "Divide seconds by 86400 before adding them to a clock time.",
            "Count rejections from arrivals plus those left behind, before the lounge cap is applied.",
            "Average the whole replication column. Once the lounge is large, seats rather than lounge space limit revenue.",
          ],
        },
      ],
    },
    {
      id: "ay1617t2",
      title: "AY2016-17 Term 2",
      sitting: "IS102 final exam, April 2017",
      questions: [
        {
          id: "q1",
          title: "Board-game café: tiered time pricing, Goal Seek, NPV and a Solver rate card",
          marks: 12,
          kind: "model",
          modelled:
            "Hourly rates fall as play time grows and differ by customer group; the band rate covers the whole session, prorated by the minute. Customers may instead buy fixed-price blocks of hours and pay whichever is cheaper. Parts price one session, find the latest finish time for a fixed budget, weigh a lump sum against monthly payments, compute expected revenue from duration distributions and design a common rate table with Solver.",
          parts: [
            {
              label: "a",
              marks: 3,
              focus: "Duration, band rate, hourly charge, blocks needed, block charge, cheaper option",
              techniques: [
                "Time arithmetic (durations, x24, /1440, /86400)",
                "Two-way INDEX/MATCH lookup",
                "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)",
                "ROUNDUP block counts and MIN for the cheaper option",
                "Absolute/mixed references so formulas fill down/right",
              ],
            },
            {
              label: "b",
              marks: 1.5,
              focus: "Latest finish time for a fixed budget",
              techniques: ["Goal Seek", "Time arithmetic (durations, x24, /1440, /86400)"],
            },
            {
              label: "c",
              marks: 1,
              focus: "Lump sum now versus monthly payments",
              techniques: ["Time value of money (NPV vs lump sum)", "Written interpretation of model results"],
            },
            {
              label: "d",
              marks: 1.5,
              focus: "Expected revenue per customer from duration distributions",
              techniques: [
                "SUMPRODUCT totals and weighted/expected values",
                "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)",
                "ROUNDUP block counts and MIN for the cheaper option",
              ],
            },
            {
              label: "e",
              marks: 5,
              focus: "Common rate table designed by Solver under pricing rules",
              techniques: [
                "Solver optimisation (objective, changing cells, constraints)",
                "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)",
                "Written interpretation of model results",
              ],
            },
          ],
          watch: [
            "Multiply durations by 24 before matching hour bands, and wrap the result in ROUND(x*24,6) so exact boundaries land in the right band.",
            "Use ROUNDUP, not ROUND, to count the blocks a session needs.",
            "The charge drops where a cheaper band starts, so begin Goal Seek near the expected answer.",
            "NPV treats its first value as one period away: keep month 0 outside and use the monthly rate.",
            "Write \"rates never rise with duration\" as one range constraint, such as E4:E6 >= E5:E7.",
          ],
        },
        {
          id: "q2",
          title: "Airport security screening: a pooled multi-station queue versus gate queues",
          marks: 13,
          kind: "simulation",
          modelled:
            "Groups of one to four passengers arrive with exponential gaps and are screened at several stations fed by one shared queue. Screening time is normal, depends on group size and never drops below a minute. A single extra-check team picks some groups at random, but only when it is free. Students simulate the queue, compute size-weighted waiting measures and utilisation, then use replications to compare the pooled design with separate single-station gates.",
          parts: [
            {
              label: "a",
              marks: 0.5,
              focus: "Cumulative probabilities for group size",
              techniques: [
                "Building lookup/step tables (lower bounds, increments, CRF)",
                "Discrete random variable via CRF table + LOOKUP(RAND())",
              ],
            },
            {
              label: "b",
              marks: 0.5,
              focus: "Exponential gaps between arrivals",
              techniques: ["Exponential inter-arrival times (-mean*LN(RAND()))", "Time arithmetic (durations, x24, /1440, /86400)"],
            },
            {
              label: "c",
              marks: 2.5,
              focus: "Group size, check time with a floor, start and end times with several stations",
              techniques: [
                "Discrete random variable via CRF table + LOOKUP(RAND())",
                "Normal random variable (NORMINV) with a floor via MAX",
                "Multi-server queue (COUNTIF system length + LARGE c-th end time)",
                "Time arithmetic (durations, x24, /1440, /86400)",
              ],
            },
            {
              label: "d",
              marks: 3.5,
              focus: "Extra-check team: availability, random selection, end time",
              techniques: [
                "IF with AND/OR multi-condition rules",
                "Bernoulli event (RAND() < p)",
                "Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))",
                "Time arithmetic (durations, x24, /1440, /86400)",
              ],
            },
            {
              label: "e",
              marks: 3,
              focus: "Size-weighted average wait, share served quickly, utilisation",
              techniques: [
                "Queue performance measures (weighted wait, % within threshold, utilisation)",
                "SUMPRODUCT totals and weighted/expected values",
                "Conditional aggregation (SUMIF/COUNTIF with criteria strings)",
              ],
            },
            {
              label: "f",
              marks: 3,
              focus: "Replications comparing pooled stations with gate queues",
              techniques: [
                "Data Table for Monte Carlo replications (blank input cell)",
                "What-if / scenario analysis by changing inputs",
                "Written interpretation of model results",
                "Queue performance measures (weighted wait, % within threshold, utilisation)",
              ],
            },
          ],
          watch: [
            "Convert minutes to day fractions for the mean, the standard deviation and the 1-minute floor.",
            "With c stations a group starts on arrival if fewer than c groups are still being screened, otherwise at the c-th largest earlier end time (COUNTIF with \">\"&cell, then LARGE).",
            "Per-passenger measures need size weights (SUMPRODUCT), not a plain AVERAGE.",
            "Compare like with like: each separate gate sees the overall gap multiplied by the number of gates.",
          ],
        },
      ],
    },
    {
      id: "ay1718t2",
      title: "AY2017-18 Term 2",
      sitting: "IS102 final exam (circulated as Sample 4)",
      questions: [
        {
          id: "q1",
          title: "Video storage tiers: failure rates, policy cost and a Solver allocation",
          marks: 12,
          kind: "model",
          modelled:
            "Three storage tiers trade price against failed views: the premium tier never fails, a cheaper tier fails now and then, and the cheapest archive tier adds a random delay that makes viewers give up. Videos are grouped by age with their access rates. Students build a delay-to-failure table, cost the all-premium status quo and a proposed tier mix (storage plus the cost of failed views), then let Solver choose the cheapest mix.",
          parts: [
            {
              label: "1",
              marks: 1,
              focus: "Delay-to-failure step table and its average",
              techniques: [
                "Building lookup/step tables (lower bounds, increments, CRF)",
                "Time arithmetic (durations, x24, /1440, /86400)",
              ],
            },
            {
              label: "2",
              marks: 1,
              focus: "Daily cost of keeping everything on premium",
              techniques: ["Unit conversion (MB to GB, seconds/minutes to day fractions)"],
            },
            {
              label: "3",
              marks: 4.5,
              focus: "Per-group share, storage cost, blended failure rate, expected failures",
              techniques: [
                "SUMPRODUCT totals and weighted/expected values",
                "Absolute/mixed references so formulas fill down/right",
                "Unit conversion (MB to GB, seconds/minutes to day fractions)",
              ],
            },
            {
              label: "4",
              marks: 2.5,
              focus: "Storage, failure and total cost of the proposal",
              techniques: ["SUMPRODUCT totals and weighted/expected values"],
            },
            {
              label: "5",
              marks: 3,
              focus: "Cost-minimising tier shares with Solver",
              techniques: [
                "Solver optimisation (objective, changing cells, constraints)",
                "Linearising a model for Solver (fix step-lookups, choose engine)",
              ],
            },
          ],
          watch: [
            "Step a time column with a time value (\"0:0:10\" or TIME(0,0,10)), not with the number 10.",
            "Use the unit conversion the question states (here 1000 MB to the GB, not 1024).",
            "Lock the price and failure-rate rows but let the share row move: mixed references such as $F18.",
            "Everything is linear in the shares, so Simplex LP finds the exact optimum. Compute the remainder share with a formula, not a typed value.",
          ],
        },
        {
          id: "q2",
          title: "Bike-share flows, rebalancing cost and a fare what-if",
          marks: 13,
          kind: "simulation",
          modelled:
            "Bikes move between three parking locations and an unofficial fourth spot. Each origin-destination pair has potential riders who rent with some probability, so trips are binomial. The model simulates trips, departures, arrivals and end-of-period stocks, prices rentals from a fare matrix, charges for moving surplus bikes back, replicates for expected stocks and profit, and tests whether a higher fare for unofficial drop-offs pays off.",
          parts: [
            {
              label: "a",
              marks: 1,
              focus: "Binomial bike moves per route",
              techniques: ["Binomial random variable (CRITBINOM / BINOM.INV)"],
            },
            {
              label: "b",
              marks: 2,
              focus: "Departures, arrivals, remaining and surplus bikes",
              techniques: [
                "Conditional aggregation (SUMIF/COUNTIF with criteria strings)",
                "Capacity and flow-balance logic with MIN/MAX",
              ],
            },
            {
              label: "c",
              marks: 3,
              focus: "Average remaining bikes from 100 replications, with the method described",
              techniques: ["Data Table for Monte Carlo replications (blank input cell)"],
            },
            {
              label: "d",
              marks: 5,
              focus: "Fare-matrix revenue, rebalancing cost, profit and expected profit",
              techniques: [
                "INDEX by row/column number (matrix lookup)",
                "SUMPRODUCT totals and weighted/expected values",
                "Data Table for Monte Carlo replications (blank input cell)",
                "Replicate the full output (E[f(X)] is not f(E[X]))",
                "Written interpretation of model results",
              ],
            },
            {
              label: "e",
              marks: 2,
              focus: "Fare what-if and the break-even rental chances",
              techniques: [
                "What-if / scenario analysis by changing inputs",
                "Data Table for Monte Carlo replications (blank input cell)",
                "Written interpretation of model results",
              ],
            },
          ],
          watch: [
            "Guard empty routes with IF(n>0, CRITBINOM(n,p,RAND()), 0). BINOM.INV is the newer name for the same function.",
            "SUMIF over the origin and destination columns gives departures and arrivals; a SUMPRODUCT with a condition works too.",
            "Cost depends on MAX(0, stock - target), so replicate profit itself. Plugging in average stocks understates the cost.",
            "Check simulated means against n x p arithmetic, and treat differences smaller than the trial-to-trial noise as inconclusive.",
          ],
        },
      ],
    },
  ],
  techniqueFrequency: [
    { technique: "Time arithmetic (durations, x24, /1440, /86400)", count: 7, papers: 3 },
    { technique: "Data Table for Monte Carlo replications (blank input cell)", count: 6, papers: 3 },
    { technique: "SUMPRODUCT totals and weighted/expected values", count: 6, papers: 3 },
    { technique: "Written interpretation of model results", count: 6, papers: 3 },
    { technique: "Approximate-match lookup on a bracket table (VLOOKUP TRUE / LOOKUP / INDEX-MATCH 1)", count: 5, papers: 2 },
    { technique: "Absolute/mixed references so formulas fill down/right", count: 4, papers: 3 },
    { technique: "Solver optimisation (objective, changing cells, constraints)", count: 4, papers: 3 },
    { technique: "What-if / scenario analysis by changing inputs", count: 4, papers: 3 },
    { technique: "Building lookup/step tables (lower bounds, increments, CRF)", count: 3, papers: 3 },
    { technique: "Discrete random variable via CRF table + LOOKUP(RAND())", count: 3, papers: 2 },
    { technique: "IF with AND/OR multi-condition rules", count: 3, papers: 2 },
    { technique: "Queue performance measures (weighted wait, % within threshold, utilisation)", count: 3, papers: 2 },
    { technique: "Unit conversion (MB to GB, seconds/minutes to day fractions)", count: 3, papers: 2 },
    { technique: "Capacity and flow-balance logic with MIN/MAX", count: 2, papers: 2 },
    { technique: "Conditional aggregation (SUMIF/COUNTIF with criteria strings)", count: 2, papers: 2 },
    { technique: "INDEX by row/column number (matrix lookup)", count: 2, papers: 2 },
    { technique: "Linearising a model for Solver (fix step-lookups, choose engine)", count: 2, papers: 2 },
    { technique: "Uniform random draws (RANDBETWEEN position, a+RAND()*(b-a))", count: 2, papers: 2 },
    { technique: "Date functions (TODAY, MONTH, WEEKDAY, date differences)", count: 2, papers: 1 },
    { technique: "ROUNDUP block counts and MIN for the cheaper option", count: 2, papers: 1 },
    { technique: "Bernoulli event (RAND() < p)", count: 1, papers: 1 },
    { technique: "Binomial random variable (CRITBINOM / BINOM.INV)", count: 1, papers: 1 },
    { technique: "Exponential inter-arrival times (-mean*LN(RAND()))", count: 1, papers: 1 },
    { technique: "Goal Seek", count: 1, papers: 1 },
    { technique: "Integer constraints in Solver", count: 1, papers: 1 },
    { technique: "Linear trend forecasting (TREND / trendline)", count: 1, papers: 1 },
    { technique: "Multi-server queue (COUNTIF system length + LARGE c-th end time)", count: 1, papers: 1 },
    { technique: "Normal random variable (NORMINV) with a floor via MAX", count: 1, papers: 1 },
    { technique: "Replicate the full output (E[f(X)] is not f(E[X]))", count: 1, papers: 1 },
    { technique: "Time value of money (NPV vs lump sum)", count: 1, papers: 1 },
    { technique: "Time-stepped batch-service queue simulation", count: 1, papers: 1 },
    { technique: "Two-way INDEX/MATCH lookup", count: 1, papers: 1 },
  ],
  quizPatterns: [
    {
      quiz: "Quiz 1: Spreadsheet engineering",
      week: "Week 2",
      patterns: [
        "SUM, AVERAGE, MAX and MIN over a small sales table",
        "A two-way profit grid filled from one formula: lock the quantity row, the price column and the unit cost cell with the right mix of $ signs",
        "TREND to predict y for a new x",
        "Goal Seek or Solver on a quadratic demand curve: its peak and both roots (a different starting value finds the other root)",
      ],
    },
    {
      quiz: "Quiz 2: Lookup and optimisation",
      week: "Week 3",
      patterns: [
        "Goal Seek the discount rate that hits a target profit margin",
        "VLOOKUP with no 4th argument matches approximately, the same as TRUE and as LOOKUP",
        "Two-way INDEX/MATCH with exact versus approximate MATCH",
        "LOOKUP on an unsorted key column gives #N/A or a wrong value, while VLOOKUP(...,FALSE) still works",
        "A transportation-style LP: assign pupils from neighbourhoods to schools at minimum total distance, with supply equalities, capacity limits and integer cells",
      ],
    },
    {
      quiz: "Quiz 3: Financial functions",
      week: "Week 4",
      patterns: [
        "PMT with type = 1 for payments at the start of each period",
        "PV and FV sign conventions",
        "RATE x 12 to annualise; nominal versus effective rates through compounding",
        "NPER for a savings target",
        "NPV with the time-0 flow kept outside, and IRR",
        "Loan balance after k payments: FV of the loan and the payments, or PV of the payments still due",
        "Accept or reject projects by NPV at the hurdle rate, and by IRR against the hurdle",
      ],
    },
  ],
  mockConventions: [
    {
      title: "Exact cells",
      detail: "Inputs sit at the addresses the question gives and every answer goes in its named cell, just like the real template.",
    },
    {
      title: "Times and dates",
      detail:
        "Times and dates are Excel serial numbers (one day = 1). A cell formatted hh:mm:ss shows the clock time, but the value checked is the underlying fraction.",
    },
    {
      title: "Tolerance",
      detail:
        "Deterministic answers must match within a small absolute tolerance. Simulated averages pass when they land inside a range of about the mean plus or minus 3 standard errors for the stated number of replications.",
    },
    {
      title: "Fixed draws",
      detail:
        "Some simulation parts supply fixed random numbers so a first run can be checked exactly. In the real exam you would write RAND() or RANDBETWEEN() in those places.",
    },
  ],
}
