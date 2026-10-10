// group project guide: public subset only. weights, dates and limits checked against the AY2026-27 course outline
// (it wins over the Week 1 slides). examples are generic or from class exercises; no team plans, no student names.

export interface WeightPart {
  name: string
  weight: number        // % of the course grade
  due: string
}

export interface TimelineItem {
  week: string
  item: string
}

export interface ProjectType {
  name: string
  detail: string
}

export interface ProjectOverview {
  weight: string
  parts: readonly WeightPart[]
  team: string
  themeRules: readonly string[]
  timeline: readonly TimelineItem[]
  projectTypes: readonly ProjectType[]
  verified: string
}

export interface Deliverable {
  id: string            // localStorage key part: keep stable
  name: string
  weight: string
  due: string
  limits: string
  gradedOn: string
  mustInclude: readonly string[]
  checklist: readonly string[]
}

export interface GradingCriterion {
  criterion: string
  appliesTo: string
  lookFor: string
  howToScore: readonly string[]
}

export interface Convention {
  title: string
  points: readonly string[]
}

export type NodeRole = 'Decision' | 'Parameter' | 'Consequence variable' | 'Performance measure'
export type AnalysisKind = 'Trade-off' | 'Sensitivity'
export type ToolChoice = 'Goal Seek' | 'Solver' | 'Data Table' | 'Monte Carlo + Data Table' | 'Scenario selector/lookup'

export interface DrillItem<A extends string> {
  item: string
  context: string       // class exercise name, or 'Practice: ...' for an original scenario
  answer: A
  why: string
}

export interface Drill<A extends string> {
  title: string
  prompt: string
  options: readonly A[]
  items: readonly DrillItem<A>[]
}

export interface ProjectDrills {
  classifyNodes: Drill<NodeRole>
  tradeoffOrSensitivity: Drill<AnalysisKind>
  whichTool: Drill<ToolChoice>
}

export interface PastProject {
  project: string
  kind: string
  question: string
  lessons: readonly string[]
}

export interface PastProjectLessons {
  projects: readonly PastProject[]
  commonPatterns: readonly string[]
}

export interface ParameterForm {
  form: string
  useWhen: string
  excel: string
  example: string
}

export interface GoodBad {
  bad: string
  good: string
}

export interface DataGuidance {
  principles: readonly string[]
  tableColumns: readonly string[]
  exampleRows: readonly (readonly string[])[]   // illustrative rows for the table columns
  dataToParameterForms: readonly ParameterForm[]
  goodVsBadExamples: readonly GoodBad[]
}

export interface Faq {
  q: string
  a: string
}

export interface ProjectData {
  overview: ProjectOverview
  deliverables: readonly Deliverable[]
  gradingCriteria: readonly GradingCriterion[]
  conventions: readonly Convention[]
  drills: ProjectDrills
  pastProjectLessons: PastProjectLessons
  dataGuidance: DataGuidance
  faq: readonly Faq[]
}

export const project: ProjectData = {
  overview: {
    weight: "30% of the course grade, split across five pieces of work.",
    parts: [
      { name: "Proposal", weight: 5, due: "Week 8" },
      { name: "Presentation", weight: 5, due: "Week 11" },
      { name: "Excel workbook", weight: 10, due: "Week 11" },
      { name: "Final report", weight: 5, due: "Week 11" },
      { name: "Peer evaluation", weight: 5, due: "Week 11" },
    ],
    team:
      "Teams of 5 to 6 members, set up by the end of Session 2, with every member expected to take a full part. The Week 1 slides mention a cap of 5; the course outline's figure is shown here, so confirm your team size with the instructor.",
    themeRules: [
      "Every part of the project serves one common theme.",
      "The work has to meet both the modelling and the analysis expectations of the course.",
      "Use the techniques taught in class, in Excel. Bring in other tools or add-ins only where they are genuinely needed.",
      "Sample projects are references, not templates to copy.",
    ],
    timeline: [
      { week: "W2", item: "Teams formed by the end of Session 2. Agree a topic shortlist, roles and a shared folder." },
      {
        week: "W3-W6",
        item: "Core tools arrive: lookups, Data Tables and Solver (W3), financial functions and circular references (W4), Monte Carlo simulation (W5), queuing models, dates and times, and VBA record handling (W6). Draft the question, influence diagram and data plan as you go.",
      },
      { week: "W7", item: "Break week: finish and trim the proposal draft." },
      { week: "W8", item: "Proposal due (5%). The written proposal is graded; the in-class proposal presentation is not." },
      {
        week: "W9-W10",
        item: "Project discussion in class. Build the workbook; the Week 10 PivotTable and filter tools can summarise results.",
      },
      {
        week: "W11",
        item: "Final presentation with a short live workbook demo (5%). Hand in the workbook (10%), final report (5%) and slides as separate files, not zipped (the lesson plan also lists research forms). Complete the peer evaluation (5%).",
      },
    ],
    projectTypes: [
      {
        name: "Exploratory modelling",
        detail:
          "Start from a hypothesis, work out which data and analyses would test it, and build a model whose structure supports what-if analysis. The outline's example asks whether Singapore's water supply can keep pace with its population up to 2060.",
      },
      {
        name: "Data analysis and decision optimisation",
        detail:
          "Start from a known problem question and search for the best approach and values, usually with Solver. The outline's example divides a limited online-marketing budget across three channels: simulate conversion scenarios, then optimise the split for each.",
      },
      {
        name: "Both at once",
        detail: "Combining the two types is allowed, and every strong past project shared as a sample did so.",
      },
    ],
    verified:
      "Weights, due weeks and page limits are checked against the AY2026-27 course outline and the Week 1 slides. Where the two differ, the outline is followed.",
  },
  deliverables: [
    {
      id: "proposal",
      name: "Proposal",
      weight: "5%",
      due: "Week 8",
      limits:
        "No more than 5 pages, and the limit is all inclusive, so every figure, table and reference uses up space. The written proposal is graded; the Week 8 presentation of it is not.",
      gradedOn: "Five criteria (see the rubric below): originality, problem structure and analysis, choice of tools, clarity with completeness and accuracy, and the quality of the writing.",
      mustInclude: [
        "A short introduction to the problem",
        "The possible data sources, listed",
        "The computations and analyses you plan to perform",
        "The results you expect",
        "At least one trade-off analysis (vary a decision)",
        "At least one sensitivity analysis (vary an uncontrollable parameter)",
        "At least one influence diagram with a matching black-box model",
      ],
      checklist: [
        "Check the page count in Word: 5 pages with every figure, table and reference included. Aim slightly under to leave a margin.",
        "Hand in a clean copy with no tracked changes, comments or internal notes.",
        "Keep one final version of each diagram and table, and remove any older drafts.",
        "Open with two or three cited numbers that show why the problem matters.",
        "State the research question and hypotheses you can test, and set every pass/fail threshold before running the model.",
        "Draw the influence diagram with the course's shapes and colours, working back from each performance measure.",
        "Draw the black box as four quadrants that list the same nodes as the diagram, using the course's terms.",
        "Give the data table one row per model input, with the publisher, table ID, coverage or access date, and how the figure is used in the model.",
        "Add a short key-assumptions box for inputs with no official statistic, each with a one-phrase reason and a test range.",
        "Summarise how the sub-models connect in one line, then give one table listing each model's question, main calculations, Excel tools and the week each tool was taught.",
        "If you claim the optimisation project type, include at least one Solver model with several changing cells, plus a table of its settings (objective, changing cells, constraints, engine and the reason for it).",
        "Keep trade-offs (decisions varied) apart from sensitivities (parameters varied), and give each one a range backed by data, the performance measures you will watch and the tool.",
        "Describe expected results as directions with rough sizes (what should rise or fall, and by about how much), not as a list of outputs.",
        "Use the course's four terms everywhere: Decisions, Parameters, Performance Measures and Consequence Variables.",
        "Number the sections and put the project title, team and course on the first page.",
        "Date-stamp policy and data figures, write every section yourselves, and check the current rules on AI tools with the instructor.",
      ],
    },
    {
      id: "report",
      name: "Final report",
      weight: "5%",
      due: "Week 11",
      limits:
        "At most 10 pages, all inclusive, and shorter is better. Hand it in as its own file, not inside a zip.",
      gradedOn: "The same five criteria as the proposal, from originality through to the quality of the writing.",
      mustInclude: [
        "A short introduction to the problem",
        "The data sources used",
        "Model sketches where they help (influence diagram, black box, model chain)",
        "The computations and analyses actually performed, with equations for the complicated ones",
        "The results and insights",
        "Trade-off, sensitivity and scenario analyses",
      ],
      checklist: [
        "Update the influence diagram and black box so they match the final workbook node for node.",
        "Report what you actually built; drop planned analyses you did not do and explain why under limitations.",
        "Write complicated computations as numbered equations with every symbol defined (for example ΔProfit = Profit(new plan) - Profit(current plan)).",
        "Present each Solver model formally: objective, decision variables, constraints explained in words, engine and why.",
        "Answer every hypothesis explicitly: supported or not, with the effect size and its range.",
        "Give every chart or table an observations line: what changed, by how much, and why it matters.",
        "Show at least one trade-off chart and one two-variable Data Table formatted as a heat map.",
        "Add two or three named scenarios (say a baseline, a downside case and an alternative plan), and close each with its main insight and a recommendation.",
        "Include a calibration check against an official figure, such as your model reproducing a published annual total.",
        "Keep a short assumptions list and an honest limitations section.",
        "State the data-extraction date and table IDs; move literature and news to footnotes.",
        "Add one line on reuse: the model can be re-run for another case or year by replacing the parameter tables.",
        "Stay within 10 pages; keep detail in the workbook rather than in appendices that push past the limit.",
        "Make sure every number you quote can be found and reproduced in the workbook.",
      ],
    },
    {
      id: "workbook",
      name: "Excel workbook",
      weight: "10%",
      due: "Week 11",
      limits:
        "No password protection. Marks go to modelling the problem and running the analyses; a tidy, easy-to-use model is enough and a fancy interface earns nothing extra. Use macros only when necessary. Documentation inside the workbook is not required.",
      gradedOn: "How well it models and analyses the business problem.",
      mustInclude: [
        "A working model of the problem, from inputs through to the performance measures",
        "The analyses behind every reported result: Data Tables, Goal Seek and Solver setups, simulation runs",
        "An unprotected file (no passwords)",
      ],
      checklist: [
        "Lay out the sheets as a logical chain, for example Home, Inputs, Data, one sheet per sub-model, Analysis, Dashboard.",
        "Enter every input once, in an input area, with units; formulas reference cells and never contain typed-in numbers.",
        "Colour-code cell roles: decision, parameter and data-derived inputs each in their own colour, key outputs highlighted, with a small legend.",
        "Put drop-down lists (Data Validation) on choice inputs such as the scenario, option or policy setting.",
        "Keep raw downloaded tables on a Data sheet with source, table ID and access date beside each block, and derive parameters next to them in Excel.",
        "Keep values that change by year or category in lookup tables (INDEX/MATCH or XLOOKUP), with approximate-match lookups for bands.",
        "Test with trial and extreme values, and verify at least one result by hand.",
        "Keep each Solver model saved on its sheet with a visible settings table, and record the solutions you report.",
        "Monte Carlo: one stored RAND per draw, about 1,000 trial rows, a Data Table of replications, and calculation set to Automatic except for Data Tables.",
        "Never run Goal Seek or Solver on live RAND cells; paste the draws as values first or sweep with a Data Table.",
        "Avoid accidental circular references, for example by computing interest on opening rather than closing balances.",
        "Use a recorded macro only where it saves real effort (for example appending results to a log), and keep it short.",
        "A short Home sheet (the question, how to use it, where the results are) is enough; skip long documentation.",
        "Pre-compute slow analyses and keep values-pasted copies for the report and the demo.",
        "Remove passwords, don't zip, and check that the file opens and recalculates on another machine with Solver enabled.",
      ],
    },
    {
      id: "presentation",
      name: "Presentation",
      weight: "5%",
      due: "Week 11",
      limits:
        "Slides plus a short live run-through of the workbook showing how it answers the problem. The speaking order is drawn by lots.",
      gradedOn: "Presentation skill and presentation content.",
      mustInclude: ["Slides", "A short live demonstration of the workbook"],
      checklist: [
        "State the question, and a number that shows why it matters, in the first 30 seconds.",
        "Show the model chain and a simplified influence diagram on one slide.",
        "Give one results slide per hypothesis: supported or not, with numbers.",
        "Show one trade-off chart and one sensitivity heat map, each with a one-line takeaway.",
        "In the demo, change one decision on the dashboard and let the audience watch the performance measures update.",
        "Show one Solver setup with its solution, and one simulation result with its replications.",
        "Pre-run slow items (simulation replications, Solver) and keep a values-pasted backup sheet in case Excel lags.",
        "Close with recommendations and limitations.",
        "Rehearse to time and agree who speaks and who drives the demo.",
        "Be ready from the start of the session, because the order is drawn by lots.",
        "Prepare short answers on tool choice, key assumptions and data sources for Q&A.",
        "Submit the final slides in Week 11 together with the other files.",
      ],
    },
    {
      id: "peer",
      name: "Peer evaluation",
      weight: "5%",
      due: "Week 11",
      limits:
        "Each member scores every teammate from 1% to 5% and may add comments to explain the score. A teammate you leave unscored is treated as 5%.",
      gradedOn: "Your peers' ratings of your contribution.",
      mustInclude: ["A rating from 1% to 5% for each peer", "Optional comments supporting your ratings"],
      checklist: [
        "Agree roles, section owners and internal deadlines early (by Week 3).",
        "Keep a simple shared task log: who did what, and when.",
        "Set internal draft deadlines a few days before Week 8 and Week 11.",
        "Review each other's sections so every member understands the whole model.",
        "Keep files in one shared place with clear version names.",
        "Raise contribution concerns early in the project, not at evaluation time.",
        "Rate on contribution and reliability, not friendship.",
        "Use the comments to explain any rating below 5%.",
        "Remember the default: a peer you leave unrated gets 5%.",
        "Complete the evaluation on time in Week 11.",
      ],
    },
  ],
  gradingCriteria: [
    {
      criterion: "Originality",
      appliesTo: "Proposal and final report",
      lookFor: "A fresh, relevant question with a clear decision-maker and a quantified local stake, rather than a re-skinned class exercise.",
      howToScore: [
        "Pick a live local issue (a new policy, a current business decision) and quantify what is at stake in the first paragraph with cited numbers.",
        "Turn the idea into hypotheses that can be tested, with pass/fail thresholds set before modelling.",
        "If the question has more than one angle (cost and service level, say), give each angle its own measurable performance measure.",
        "Show who is affected: break results down by segment (customer type, site, region) instead of one overall average.",
      ],
    },
    {
      criterion: "Problem structure and analysis",
      appliesTo: "Proposal and final report",
      lookFor:
        "A clean decomposition: one influence diagram, one black box, one model chain and analyses that all agree, with trade-off and sensitivity correctly separated.",
      howToScore: [
        "Start the influence diagram at each performance measure and work back to the inputs, so each arrow stands for a term in some formula.",
        "Make the black box list exactly the diagram's nodes.",
        "Show the model chain (which sub-model feeds which) in one line or one small figure.",
        "For every analysis, name the input varied, its range and basis, the performance measures watched and the tool.",
        "Map each hypothesis to the analysis that tests it.",
      ],
    },
    {
      criterion: "Appropriateness of tool",
      appliesTo: "Proposal and final report",
      lookFor:
        "Course tools used where they fit: Goal Seek for break-evens, Solver for genuine optimisation, Data Tables for what-if grids and replications, lookups for tabled parameters, Monte Carlo for risk.",
      howToScore: [
        "Include at least one Solver model with several changing cells, documented in a settings table that explains the engine choice.",
        "Keep the word 'optimisation' for Solver models with an objective; Goal Seek and simulation runs are not optimisation.",
        "Prefer taught equivalents to untaught tools: a selector cell plus lookups instead of Scenario Manager, and one-way Data Tables feeding a bar chart instead of a tornado chart.",
        "Fit each random input's distribution to data, and replicate the simulation with a Data Table.",
      ],
    },
    {
      criterion: "Clarity, completeness and accuracy",
      appliesTo: "Proposal and final report",
      lookFor: "Every required section present, facts correct and dated, numbers consistent across sections, and the page limit respected.",
      howToScore: [
        "Tick off every item in the outline's required-contents list.",
        "Verify policy facts against official pages and date-stamp them.",
        "Use one time horizon and one nominal-versus-real convention throughout.",
        "Remove duplicated or conflicting diagrams and tables, and number the sections.",
        "Check the final page count in Word, not in a draft view.",
      ],
    },
    {
      criterion: "Writing skill",
      appliesTo: "Proposal and final report",
      lookFor: "Concise, well-organised prose in the team's own words, with consistent course vocabulary.",
      howToScore: [
        "Lead each section with its main point.",
        "Cut hedges and unresolved 'or' alternatives; decide, then state.",
        "Use tables for specifications and prose for reasoning.",
        "Use the same terms throughout (Decisions, Parameters, Performance Measures, Consequence Variables).",
        "Write in your own words and read it aloud once before submitting.",
      ],
    },
    {
      criterion: "Presentation skill",
      appliesTo: "Final presentation",
      lookFor: "A clear, well-timed delivery with a confident live demo and good answers to questions.",
      howToScore: [
        "Tell one story: question, model, results, recommendation.",
        "Rehearse to time, with smooth hand-overs between speakers.",
        "Drive the demo calmly with pre-computed backups ready.",
      ],
    },
    {
      criterion: "Presentation content",
      appliesTo: "Final presentation",
      lookFor: "The problem, the model and the results, plus a brief demonstration of how the workbook solves the problem.",
      howToScore: [
        "Show the performance measures moving when a decision changes.",
        "Present hypotheses with verdicts and numbers.",
        "Show at least one trade-off and one sensitivity result, each with its insight in one line.",
      ],
    },
    {
      criterion: "Modelling and analysis",
      appliesTo: "Excel workbook",
      lookFor:
        "A correct, traceable model of the business problem and the analyses that produce the reported results; neatness matters more than a fancy interface.",
      howToScore: [
        "Separate inputs, calculations and outputs, with no hard-coded inputs inside formulas.",
        "Make every reported number reproducible from the workbook.",
        "Keep Solver models, Goal Seek setups and Data Tables in place and labelled.",
        "Use macros only where they are genuinely needed.",
      ],
    },
  ],
  conventions: [
    {
      title: "Influence diagram legend",
      points: [
        "Four node types, all drawn as rounded rectangles.",
        "Colours: parameters have gold text on white; decisions have green text and a green border on white; performance measures have red text on pink; consequence variables have navy text on grey.",
        "Arrows run from cause to effect, and every arrow into a node should be a term in that node's formula.",
        "A model can have several performance measures: Invest in Education has two (total expected margin, and expected margin per level).",
        "In optimisation diagrams, each constraint limit appears as a parameter box, those boxes sit under a 'Constraints' brace, and the objective carries a Minimize or Maximize label (see Echo Office Supplies).",
        "Roles depend on whose model it is. The Monty Hall diagram is built for the show's prize budget, so the contestant's switch-or-stay choice is drawn as a parameter while the prize amount is a decision.",
      ],
    },
    {
      title: "Work back from the performance measures",
      points: [
        "Start from each performance measure and break it into the smaller quantities (at least two) whose formula produces it.",
        "Keep splitting each intermediate variable until you reach decisions and parameters.",
        "A node with no formula behind it (a vague 'other benefits' box, say) does not belong in the diagram.",
        "The full sequence: influence diagram, then black box, then a spreadsheet model tested with trial values, then trade-offs (vary decisions), then sensitivity (vary parameters), then assumptions and limitations.",
      ],
    },
    {
      title: "Black-box quadrants",
      points: [
        "A dark box in the middle with four labelled quadrants: Decisions (controllable inputs) top-left, Parameters (uncontrollable inputs) bottom-left, Performance Measures (outputs of key interest) top-right, Consequence Variables (calculated outputs) bottom-right.",
        "Past projects tag data-derived parameters as 'Historical', a handy label for inputs fixed by past data.",
        "List exactly the influence diagram's nodes: no extras, no omissions.",
        "Analysis results such as a break-even price or the difference between two runs are not nodes; report them under results.",
        "Preferences you are given or assume (importance weights in a scoring model, for example) are Parameters, not Decisions.",
      ],
    },
    {
      title: "Trade-off vs sensitivity analysis",
      points: [
        "Trade-off: change a decision and see how the performance measures trade off against each other. A trade-off chart can also show where the best value and the break-even point lie.",
        "Sensitivity: change uncontrollable parameters to see how sensitive the performance measures are. In class this is done with a two-variable Data Table, and the conclusion is about robustness: where is the result stable, and where does it swing?",
        "Base each range on data (the historical minimum and maximum, or low/base/high values), not on an arbitrary percentage either side of the base case.",
        "For each analysis, name the input varied, its range and basis, the performance measures watched and the tool.",
        "Rules set by others (a tariff, a regulation) and given preference weights are outside the decision-maker's control, so varying them is sensitivity. Switching how a result is measured (before versus after tax, say) is neither: present it as an alternative view.",
      ],
    },
    {
      title: "Goal Seek vs Solver vs Data Table",
      points: [
        "Goal Seek changes one input cell so that one formula reaches a target value. It cannot maximise or minimise; use it for break-evens such as profit = 0.",
        "Solver finds the best (maximum or minimum) value of an objective cell, or hits a target, by changing several cells subject to constraints.",
        "A Data Table tabulates outputs across one or two inputs: what-if grids, sensitivity tables and simulation replications.",
        "If the model has no counter-acting relationship (demand does not fall as price rises, for instance), Solver runs off towards infinity, so check the logic first.",
        "The Goal Seek 'To value' box takes a typed number, not a formula; work the target out in a cell first.",
        "Do not point Goal Seek or Solver at cells that depend on live RAND(); paste the draws as values first, or sweep the input with a Data Table.",
      ],
    },
    {
      title: "LP formulation and Solver engines",
      points: [
        "A linear programme has three parts: decision variables, which may be continuous, integer or binary; constraints (left side <=, >= or = right side, each set up in cells); and an objective to maximise or minimise.",
        "Integer and binary settings go on decision cells only, never on cells calculated from them.",
        "Four possible outcomes: a unique optimum, multiple optima, an unbounded problem or an infeasible one.",
        "Simplex LP is the engine for linear models. GRG Nonlinear handles smooth non-linear models, though it may settle on a local optimum. Evolutionary copes with non-smooth models (IF, lookups, MIN/MAX) but needs bounds on every decision cell and can run for a long time.",
        "Lookups or IFs inside the objective make a model non-smooth. Pre-compute them into a table of constants so the model stays linear and Simplex still works.",
        "Document it as a settings table in the workbook and as a formal model (objective, variables, constraints in words) in the report.",
      ],
    },
    {
      title: "Monte Carlo design and replication",
      points: [
        "Give each uncertain input a distribution, draw random numbers against its cumulative distribution, and repeat many trials to get a spread of outcomes rather than one answer.",
        "An input can be generated in three ways: a cumulative-frequency (CRF) table read with LOOKUP or approximate VLOOKUP; resampling real data with SMALL(data,RANDBETWEEN(1,N)) or PERCENTILE(data,RAND()); or inverse functions such as NORMINV(RAND(),mean,sd), -mean*LN(RAND()) and CRITBINOM(n,p,RAND()).",
        "Draw each random number once, in its own cell, and refer to that cell; writing RAND() twice inside one IF produces two different numbers.",
        "A probability is the average of 0/1 flags, for example the AVERAGE of (condition)*1 across trials.",
        "Run about 1,000 trials, one per row, then repeat the whole run with a Data Table (Monty Hall repeats it 15 times; the Call Center model tabulates 100 replications against server counts). You have enough trials when the results barely move from one replication to the next.",
        "Multi-period models (Village Water) give each period its own row or column with a fresh draw, keep a running balance, then compute a trial statistic such as MIN or COUNTIF.",
        "Correlated draws are not taught. Link inputs with conditional logic (if a machine breaks down, output stops for the drawn number of days), resample complete past years with INDEX and RANDBETWEEN, or treat the inputs as independent and say so.",
      ],
    },
    {
      title: "NPV timing",
      points: [
        "NPV() treats every value as arriving at the end of a period. A cash flow at time 0 goes outside the function: =NPV(r, CF1:CFn) + CF0.",
        "Keep rate and period units the same: an annual rate for annual flows, rate/12 for monthly flows.",
        "Keep money terms consistent: nominal cash flows need a nominal discount rate, and real flows a real one.",
        "IRR is the rate at which NPV = 0, and Goal Seek is the taught alternative. If the cash flows never change sign (all costs, for example), no IRR exists; Goal Seek the input that brings NPV to zero instead.",
        "Compare alternatives over the same horizon.",
      ],
    },
    {
      title: "Documentation template",
      points: [
        "The course template lists each key cell's label, cell reference and formula, with inputs marked as inputs.",
        "Beside it sits a Goal Seek setup table with four columns: Set Cell, To Value, By Changing Cell and the solution found.",
        "Add a note for any manual step, for example that the target was worked out by hand because 'To Value' cannot hold a formula.",
        "For Solver, record the objective cell and whether it is maximised or minimised, the changing cells, each constraint, any integer or binary restrictions, and which engine you chose and why.",
        "Assignment 0 also expects test cases that push inputs to extremes (negative, zero, very large and very small) and a clean sheet with gridlines switched off.",
      ],
    },
    {
      title: "Spreadsheet layout and colour roles",
      points: [
        "Inputs at the top, key outputs just below them, working tables at the bottom so they can grow downwards.",
        "No hard-coded inputs in formulas: enter each input once, state its unit and reference the cell.",
        "Give decision, parameter and data-derived inputs their own colours and highlight the key results, with a small legend.",
        "Put Data Validation on input cells, test with trial values and verify a result by hand.",
        "Avoid nesting more than three IFs; use a lookup table or IFS instead.",
        "The class workbooks follow a Home, Scratch, Proto, Model sheet sequence (some add Learn or Explain); a project can extend it with Data, Analysis and Dashboard sheets.",
      ],
    },
    {
      title: "Tools outside the Week 1-6 slides",
      points: [
        "Familiar Excel extras such as Scenario Manager, tornado charts and regression beyond TREND do not appear in the Week 1-6 slides.",
        "The outline allows other tools and add-ins where they are needed; explain briefly why you used one, though a taught equivalent is usually the safer choice.",
        "Scenarios: a selector cell with INDEX or XLOOKUP over a scenario table, plus Data Tables.",
        "Tornado chart: one-way Data Tables feeding an ordinary bar chart.",
        "SUMPRODUCT is used in class workbooks (Community Water Tank, Call Center) even though no slide covers it, so it is safe to use.",
      ],
    },
    {
      title: "Use data with causal sense",
      points: [
        "Do not AutoFill or TREND a quantity that has no driver. Data Centre Assets models the driver (a performance ratio) and then derives the asset count.",
        "Reserve TREND for cases with a causal x variable (sales against advertising spend, for example); otherwise prefer a growth-rate parameter with low/base/high values.",
        "A model gives decision support, not certainty, so state assumptions and limitations.",
      ],
    },
    {
      title: "Avoid accidental circular references",
      points: [
        "Charity Donation is the course's deliberate circular case: tax depends on the donation and the donation depends on profit after tax, so iterative calculation is switched on.",
        "In your own model, compute interest on the opening balance (not the closing one) so you don't create a loop by accident.",
        "If a loop is intended, enable iterative calculation and say so in the report.",
      ],
    },
  ],
  drills: {
    classifyNodes: {
      title: "Classify the node",
      prompt: "Which influence-diagram role does this quantity play?",
      options: ["Decision", "Parameter", "Consequence variable", "Performance measure"],
      items: [
        { item: "Printer unit price", context: "InkJet Printer", answer: "Decision", why: "The company sets it, and it is the cell Goal Seek or Solver changes." },
        { item: "Cartridge demand", context: "InkJet Printer", answer: "Consequence variable", why: "Calculated from the prices through the demand relationship; nobody types it in." },
        { item: "Profit", context: "InkJet Printer", answer: "Performance measure", why: "The output of key interest that the pricing decisions try to improve." },
        { item: "Tank width, fixed at 2 m by the site", context: "Community Water Tank", answer: "Parameter", why: "It is a dimension, but the site fixes it, so it is a given value. Only the height is decided." },
        { item: "Tank height", context: "Community Water Tank", answer: "Decision", why: "The one dimension the user varies; the length then follows from the required volume." },
        { item: "Wall area", context: "Community Water Tank", answer: "Consequence variable", why: "Calculated from the chosen height and the derived length, then multiplied by the wall cost per square metre." },
        { item: "Number of guests of each type", context: "Casino Hotel", answer: "Decision", why: "Solver changes these integer cells to maximise profit within the floor-space and minimum/maximum limits." },
        { item: "Floor area needed", context: "Casino Hotel", answer: "Consequence variable", why: "Calculated from guest numbers and floor space per guest; it is the left-hand side of the floor-space constraint." },
        { item: "Minimum price drop for big customers (at least 8%)", context: "Echo Office Supplies", answer: "Parameter", why: "A constraint threshold, drawn as a parameter box under the Constraints brace. Solver must respect it but cannot change it." },
        { item: "Drop in revenue", context: "Echo Office Supplies", answer: "Performance measure", why: "The objective, labelled Minimize in the diagram." },
        { item: "Contestant's choice to switch or stay", context: "Monty Hall", answer: "Parameter", why: "The diagram is built for the show organiser budgeting prize money. The organiser cannot control the contestant, so the choice is an uncontrollable input despite the word 'decision'." },
        { item: "Prize amount", context: "Monty Hall", answer: "Decision", why: "The organiser sets it; with the win probabilities it fixes the total prize money to prepare." },
        { item: "Number of students funded at each education level", context: "Invest in Education", answer: "Decision", why: "The social enterprise decides how many students to fund at each level." },
        { item: "Total expected margin", context: "Invest in Education", answer: "Performance measure", why: "One of the case's two outputs of key interest." },
        { item: "Number of servers", context: "Call Center", answer: "Decision", why: "Management chooses how many servers to staff; the replication Data Table compares server counts." },
        { item: "Number of food trucks sent out on weekends", context: "Practice: food trucks", answer: "Decision", why: "The operator chooses it, so comparing two, three or four trucks is a trade-off analysis." },
        { item: "Average spend per customer, estimated from last year's sales", context: "Practice: food trucks", answer: "Parameter", why: "Customers decide what they spend; the operator can only estimate it from data, so it is an uncontrollable (historical) input." },
        { item: "Orders served per truck per hour, worked out from the minutes per order", context: "Practice: food trucks", answer: "Consequence variable", why: "A calculated intermediate (60 divided by the minutes per order) that feeds the sales formula." },
        { item: "Weekend profit", context: "Practice: food trucks", answer: "Performance measure", why: "The output of key interest that the truck decision aims to improve." },
        { item: "Electricity tariff per kWh", context: "Practice: rooftop solar", answer: "Parameter", why: "Set by the utility. The building owner cannot control it, so varying it is a sensitivity analysis." },
        { item: "Panel capacity installed (kW)", context: "Practice: rooftop solar", answer: "Decision", why: "The owner chooses the system size." },
        { item: "Electricity generated per year", context: "Practice: rooftop solar", answer: "Consequence variable", why: "Calculated from capacity, sun hours and efficiency; it feeds the savings and the NPV." },
        { item: "NPV of the installation over 20 years", context: "Practice: rooftop solar", answer: "Performance measure", why: "The bottom-line output used to compare system sizes." },
        { item: "Patient arrival rate", context: "Practice: clinic", answer: "Parameter", why: "Patients decide when to come; the clinic can only estimate the rate." },
        { item: "Number of nurses on the evening shift", context: "Practice: clinic", answer: "Decision", why: "Management controls staffing, and staffing drives waiting time." },
        { item: "Average patient waiting time", context: "Practice: clinic", answer: "Performance measure", why: "The service output the clinic wants to keep low." },
      ],
    },
    tradeoffOrSensitivity: {
      title: "Trade-off or sensitivity?",
      prompt: "Is this a trade-off analysis (vary a decision) or a sensitivity analysis (vary an uncontrollable parameter)?",
      options: ["Trade-off", "Sensitivity"],
      items: [
        { item: "Sweep the printer price and chart profit, revenue and cost", context: "InkJet Printer", answer: "Trade-off", why: "Price is a decision; the chart shows how revenue and cost trade off and where profit peaks." },
        { item: "Two-way Data Table of demand-curve slope against cartridges sold per printer", context: "InkJet Printer", answer: "Sensitivity", why: "Both are uncontrollable market parameters; the table shows where profit is robust and where it swings." },
        { item: "Vary the tank height and compare total cost", context: "Community Water Tank", answer: "Trade-off", why: "Height is the decision: a taller tank needs less base but more wall, so the two costs trade off." },
        { item: "Revenue per guest falls 10% for every game type", context: "Casino Hotel", answer: "Sensitivity", why: "Revenue per guest is a market parameter the casino does not control." },
        { item: "Run the queue with different numbers of servers and compare the average wait", context: "Call Center", answer: "Trade-off", why: "Server count is a decision; shorter waits trade off against the cost of more servers." },
        { item: "Re-run the call centre with customers arriving 20% more often", context: "Call Center", answer: "Sensitivity", why: "Customer arrival rates are uncontrollable." },
        { item: "Make month-to-month rainfall more variable", context: "Village Water", answer: "Sensitivity", why: "Rainfall is uncontrollable; the question is how robust the tank size is to it." },
        { item: "Compare two, three and four trucks on weekend profit", context: "Practice: food trucks", answer: "Trade-off", why: "The number of trucks is the operator's decision; extra sales trade off against extra running costs." },
        { item: "Two-way Data Table of footfall against average spend", context: "Practice: food trucks", answer: "Sensitivity", why: "Both are market conditions the operator cannot set." },
        { item: "Compare three, four and five nurses on waiting time and wage cost", context: "Practice: clinic", answer: "Trade-off", why: "Staffing is a decision; shorter waits trade off against a higher wage bill." },
        { item: "Re-run the clinic with 15% more patient arrivals", context: "Practice: clinic", answer: "Sensitivity", why: "Arrivals are outside the clinic's control." },
        { item: "Compare 5 kW, 10 kW and 15 kW systems on NPV and payback", context: "Practice: rooftop solar", answer: "Trade-off", why: "System size is the owner's decision; upfront cost trades off against yearly savings." },
        { item: "Test the tariff at its historical low, base and high", context: "Practice: rooftop solar", answer: "Sensitivity", why: "The utility sets the tariff, so this tests how robust the NPV is." },
        { item: "Test discount rates of 3%, 5% and 7%", context: "Practice: rooftop solar", answer: "Sensitivity", why: "The discount rate reflects the cost of money, a market condition rather than a design choice." },
      ],
    },
    whichTool: {
      title: "Which tool?",
      prompt: "Which course tool fits this job best?",
      options: ["Goal Seek", "Solver", "Data Table", "Monte Carlo + Data Table", "Scenario selector/lookup"],
      items: [
        { item: "Find the printer price that makes profit exactly zero", context: "InkJet Printer", answer: "Goal Seek", why: "One input and one target value: a break-even." },
        { item: "Find the printer price that maximises profit when demand falls as price rises", context: "InkJet Printer", answer: "Solver", why: "Goal Seek cannot maximise. Without the demand relationship, Solver would push the price towards infinity." },
        { item: "Choose how many guests of each type to admit to maximise profit within floor-space and min/max limits", context: "Casino Hotel", answer: "Solver", why: "Several integer decision cells, constraints and an objective: a linear programme." },
        { item: "Show profit for every combination of demand slope and cartridges per printer", context: "InkJet Printer", answer: "Data Table", why: "A two-variable Data Table tabulates one output over two inputs at once." },
        { item: "Estimate the chance of winning if the contestant always switches", context: "Monty Hall", answer: "Monte Carlo + Data Table", why: "Simulate many games, average the 0/1 win flags, then replicate with a Data Table to check the estimate is stable." },
        { item: "Compare the average wait across different numbers of servers, 100 runs each", context: "Call Center", answer: "Monte Carlo + Data Table", why: "A two-variable Data Table over replication number and server count re-runs the queue simulation." },
        { item: "Find the ticket price at which a concert breaks even", context: "Practice: concert", answer: "Goal Seek", why: "One changing cell and one target value (profit = 0)." },
        { item: "Decide how many units of each product to make to maximise profit within machine-hour and material limits", context: "Practice: factory", answer: "Solver", why: "Several decision cells, constraints and a maximise objective: a linear programme." },
        { item: "Decide which of five warehouses to open so that every region is served at minimum cost", context: "Practice: logistics", answer: "Solver", why: "Binary open/close cells with coverage constraints: an integer linear programme." },
        { item: "Estimate the probability that a project finishes late when every task duration is uncertain", context: "Practice: project schedule", answer: "Monte Carlo + Data Table", why: "Random durations need trials; the probability is the average of the late flags, replicated with a Data Table." },
        { item: "Show NPV for every combination of discount rate and growth rate", context: "Practice: investment", answer: "Data Table", why: "Two inputs, one output and a deterministic model: a two-variable Data Table." },
        { item: "Find the daily order volume at which two delivery options cost the same", context: "Practice: logistics", answer: "Goal Seek", why: "Set the cost difference to 0 by changing a single cell." },
        { item: "Switch the whole model between base, optimistic and pessimistic cases from one cell", context: "Practice: planning", answer: "Scenario selector/lookup", why: "A drop-down selector plus INDEX/MATCH or XLOOKUP over a scenario table switches every input at once." },
      ],
    },
  },
  pastProjectLessons: {
    projects: [
      {
        project: "Changi Airport T5 payback",
        kind: "Final report: an exploratory payback model combined with Solver optimisation and a queue simulation.",
        question: "How would operational changes when Terminal 5 opens affect the airport operator's resource allocation, profit margin and payback period?",
        lessons: [
          "Sorted parameters into modelled (projected), simulated (random draws) and fixed values; each fixed value had its own cell, while values that change by year or category lived in lookup tables (INDEX/MATCH or XLOOKUP).",
          "Where historical inflation and productivity data showed no stable trend, it projected low, baseline and high columns instead of extrapolating.",
          "Turned observed frequencies (the aircraft-type mix from scraped flight data) into a cumulative-probability lookup table, and drew gaps between arrivals with -mean*LN(RAND()).",
          "Calibrated against an official total: a 3% uncertainty factor reconciled scraped passenger volumes with the reported figure.",
          "Used Solver twice and documented both: Simplex LP with binary cells to assign airlines to terminals, GRG Nonlinear for the retail space mix.",
          "Presented sensitivity with one-variable charts and colour-scaled two-variable Data Tables, each followed by an observations line; trade-offs on decisions got a separate section.",
          "Ran three named scenarios (baseline, delayed opening with cost pressure, funding constraint), switched from a drop-down with a recorded macro, each closing with its main insight and a recommendation.",
          "Listed lettered assumptions up front. One caution: its appendices ran past the 10 body pages, which a strict all-inclusive limit does not allow.",
        ],
      },
      {
        project: "Post-COVID recovery for Singapore Airlines",
        kind: "Final report: chained demand forecasting, Solver fleet allocation and an NPV scrap-versus-store price.",
        question: "How many aircraft should go to passenger service, cargo or storage from 2021 to 2025, and at what price is scrapping an aircraft better than storing it?",
        lessons: [
          "Kept the data section short (four source categories) but made every number traceable through dated 'retrieved on' footnotes.",
          "Derived base-year unit parameters from annual-report figures (for example cost per aircraft = total expense / fleet size) and stated the assumption wherever data were missing.",
          "Fitted a log-normal curve to case data with Solver, minimising the error, to time each country's reopening.",
          "Documented Solver in a table of cell, variable, role and constraint, and switched from GRG to Evolutionary because GRG stopped at local optima.",
          "Drew a separate influence diagram and black box for each sub-model, labelling data-driven parameters 'Historic ...'.",
          "Priced the scrap-versus-store decision with NPV at a risk-free rate, and closed with limitations and assumptions.",
        ],
      },
      {
        project: "Airline recovery study, published version",
        kind: "A later conference-paper version of the airline project: shows how the same work reads when written up formally.",
        question: "The same question as the airline report, rewritten for publication.",
        lessons: [
          "States the data-extraction date in the abstract and repeats it in table titles.",
          "Adds a figure of the model chain, with a box for each sub-model and arrows showing how data moves between them.",
          "Adds a calibration table showing base-year actuals and each derived parameter with the formula behind it.",
          "Sets out the optimisation formally, explaining the objective, the decision variables and every constraint in plain words.",
          "Claims reuse: the same models could serve another airline once its data are swapped in.",
          "Adds a literature review and consistent references; a proposal only needs short footnotes.",
        ],
      },
      {
        project: "Team Singapore in the Olympics",
        kind: "Final report and a later published version: data analysis with clustering, regression and Solver-fitted models.",
        question: "How many athletes, in which sports, should Singapore enter, and how likely is a given athlete to win a medal in their sport?",
        lessons: [
          "Used one primary dataset (120 years of Olympic results) plus World Bank development indicators, with explicit inclusion and exclusion rules that left 113 countries.",
          "Explored the data first (charts, correlations) before building models.",
          "Brought in an outside tool only where needed (JMP for clustering) and otherwise stayed in Excel: Data Analysis regression, then Solver GRG to minimise squared error and to maximise the log-likelihood of a logistic model.",
          "Evaluated honestly: back-tests, precision, recall and F1 with class imbalance discussed, and predicted-versus-actual tables even where the misses were large.",
          "Kept the interface functional rather than fancy: drop-downs, form controls, lookups and a macro to re-run Solver.",
          "Separated sensitivity (sweeping athlete attributes) from trade-off (medals against the number of athletes and sports).",
          "The published version added the dataset size, a parameter table with units and numbered equations.",
        ],
      },
    ],
    commonPatterns: [
      "One decision-maker, one crisp question, and an opening paragraph that sizes the Singapore stake with cited numbers.",
      "Both project types combined: two to five chained sub-models under one theme.",
      "Data sections name each dataset by publisher and table, with literature and news pushed to footnotes.",
      "Provenance everywhere: retrieval or extraction dates, coverage years, dataset size and inclusion rules.",
      "Explicit data-to-parameter steps: base-year ratios, low/base/high projections, CRF lookup tables, fitted distributions and calibration factors.",
      "Fixed values get a cell each; anything that changes by year or category goes in a lookup table.",
      "Influence diagram and black box use the four course categories, a colour legend and identical node lists.",
      "Solver documented with its objective, changing cells, constraints, integer or binary restrictions and a reasoned engine choice.",
      "Sensitivity (parameters) and trade-off (decisions) kept apart, each analysis with an observations line.",
      "Named scenarios, each ending in an insight and a recommendation.",
      "Honest assumptions and limitations sections.",
      "A reuse claim: swap the data and re-run.",
      "None of them ran a 1,000-trial Monte Carlo with a probability output, so a well-specified simulation can stand out.",
    ],
  },
  dataGuidance: {
    principles: [
      "List datasets and official pages, not literature. Papers, news and method pages belong in footnotes or the introduction.",
      "Give one row per model input (influence-diagram node), so every parameter in the black box traces to a source or a stated assumption.",
      "For every row give the publisher, dataset or table ID, coverage years and an as-of or access date.",
      "Say what form each source takes in the model: a single value, a low/base/high set, a lookup table, or a distribution fitted to the data.",
      "Date-stamp rules and rates taken from official pages ('as published on <date>'), because they get revised.",
      "Put inputs with no official statistic in a key-assumptions box, each with a one-phrase justification and a test range.",
      "Use the right population: match the data to the group you model (figures for the segment or age band you study, not an all-population average).",
      "Clean before use: remove items that don't apply, strip lines you model separately to avoid double counting, and convert to the model's price year.",
      "Validate at least one figure against an official total or worked example.",
      "Use primary sources for parameters; secondary estimates (blogs, news, bank guides) are for triangulation only and should be labelled as such.",
      "Keep raw downloads on a Data sheet with source, table ID and access date beside each block, and derive parameters next to them in Excel.",
      "Respect licences and attribution rules: data.gov.sg datasets carry the Singapore Open Data Licence wording, and statistics portals and ministries have their own attribution lines. Paraphrase government pages rather than republishing their PDFs or infographics.",
    ],
    tableColumns: [
      "#",
      "Model input (influence-diagram node)",
      "Data (coverage / as-of date)",
      "Source (publisher, dataset or table ID)",
      "Use in the model",
      "Used by",
    ],
    exampleRows: [
      ["1", "Electricity tariff", "Quarterly, 2016-2026 (accessed on your download date)", "Utility's published tariff history", "Low / base / high: historical min, latest, max", "M1 cost, M3 NPV"],
      ["2", "Customers per hour", "Six weeks of till records, with dates", "Partner's sales data (collection method stated)", "CRF table read with LOOKUP(RAND())", "M2 queue simulation"],
    ],
    dataToParameterForms: [
      {
        form: "Point value",
        useWhen: "A well-sourced fixed number.",
        excel: "One labelled input cell referenced everywhere.",
        example: "A published fee or tax rate, such as the current GST rate, with its effective date.",
      },
      {
        form: "Low / base / high",
        useWhen: "A rate with a historical range.",
        excel: "Three columns plus a selector cell; feeds one- and two-way Data Tables.",
        example: "Inflation: base = recent average, low and high = the historical range. A discount rate tested at three levels.",
      },
      {
        form: "Lookup table by category, band or year",
        useWhen: "Values that change by category or over time.",
        excel: "INDEX/MATCH or XLOOKUP for exact keys; approximate-match VLOOKUP or MATCH type 1 for bands.",
        example: "Price by customer type and year; a fee by size band; a delivery charge that changes with distance band.",
      },
      {
        form: "Distribution with data-estimated parameters",
        useWhen: "Uncertain inputs in the Monte Carlo model.",
        excel: "CRF table with LOOKUP; PERCENTILE(data,RAND()); NORMINV(RAND(),mean,sd); -mean*LN(RAND()); (RAND()<p)*1.",
        example: "Daily demand from a CRF of observed counts; gaps between arrivals exponential with the observed mean; a breakdown each day with probability p.",
      },
      {
        form: "Stated assumption with a test range",
        useWhen: "No official statistic exists.",
        excel: "Input cell flagged as an assumption, tested in a Data Table.",
        example: "Staff turnover of 10% a year (tested at 5-20%); a return rate of 2% (tested at 0-5%).",
      },
    ],
    goodVsBadExamples: [
      {
        bad: "Visitor arrivals: tourism board website.",
        good: "Monthly visitor arrivals from the tourism board's published statistics (series name and table ID, years covered, access date): base = the last 12 months, low and high from the historical range.",
      },
      {
        bad: "Exchange rate: test plus or minus 20%.",
        good: "Monthly exchange rates from the central bank's published series (series ID, years covered): base = recent average, low/high = the historical range, and NORMINV(RAND(), mean, sd) fitted to the monthly changes for the Monte Carlo.",
      },
      {
        bad: "Demand: a news article.",
        good: "Daily orders from the partner's sales records (six months, collection dates stated), turned into a CRF table of observed frequencies for LOOKUP(RAND()).",
      },
      {
        bad: "Prices: one shop's web page.",
        good: "A sample of listed prices collected on a stated date, summarised as median and quartiles: the median is the base value, the quartiles the test range.",
      },
      {
        bad: "A software vendor's web page listed as a data source.",
        good: "Cite a method once in the computations section; the data table is only for data that feeds parameters.",
      },
      {
        bad: "Operating costs: an industry survey average used as is.",
        good: "Start from the survey table (publisher, table ID, year), remove lines you model separately to avoid double counting, uplift to the model's price year with CPI, and state each adjustment.",
      },
      {
        bad: "Equipment grant: 'about $50,000'.",
        good: "The agency's scheme page (title and access date), with the grant split by the categories and years your model uses, date-stamped because schemes get revised.",
      },
      {
        bad: "Opening inventory: assume 500 units.",
        good: "Mark it as an assumption with a one-line reason (two weeks of average demand, say) and test a range such as one to four weeks in a Data Table.",
      },
      {
        bad: "Repair cost: draw the final amount the firm pays straight from an exponential.",
        good: "Draw the gross repair bill from a data-based distribution, then apply the warranty cap and excess in formulas. Drawing the net amount directly ignores the rules and can badly misstate the cost.",
      },
    ],
  },
  faq: [
    {
      q: "Is the Week 8 presentation graded?",
      a: "Not for the project mark: only the written proposal (5%) is graded. The Week 1 slides do link part of the 10% class-participation mark to discussing the proposals, so take part and use the feedback. An earlier version of the course ran Week 8 as a recorded video plus a discussion forum, so confirm the format with the instructor.",
    },
    {
      q: "Does the 5-page limit include diagrams, tables and references?",
      a: "Yes, it is all inclusive. Leave a small margin, keep one copy of each artefact, and remove internal notes and comments before submitting.",
    },
    {
      q: "Can we use tools that weren't taught, such as Scenario Manager or tornado charts?",
      a: "The outline allows other tools and add-ins where they are needed, so explain briefly why you used one. Taught equivalents are usually the safer choice: a selector cell with INDEX or XLOOKUP plus Data Tables for scenarios, and one-way Data Tables with a bar chart instead of a tornado chart.",
    },
    {
      q: "Do we really need Solver if we already use Goal Seek and Monte Carlo?",
      a: "If you claim the optimisation project type, yes. Goal Seek only makes one input hit a target, and Monte Carlo estimates risk; neither optimises. Include one multi-variable Solver model with constraints, a min or max objective and a settings table.",
    },
    {
      q: "Can we Goal Seek on a simulated probability?",
      a: "Not on live RAND cells: the answer changes on every recalculation and a simulated probability moves in steps. Sweep the input in a Data Table and read off where it crosses your threshold, or freeze the draws as values first.",
    },
    {
      q: "Are preference weights decisions?",
      a: "No. Weights or judgements the user supplies are Parameters, and varying them is a sensitivity analysis. Anything calculated from them is a Consequence Variable.",
    },
    {
      q: "Should a break-even value or the difference between two runs appear in the black box?",
      a: "No. Both are analysis results (a Goal Seek output, or a comparison of two runs), so they belong in the results section. The InkJet Printer black box shows the same thing: profit is its performance measure, and the break-even price is found afterwards with Goal Seek or Solver.",
    },
    {
      q: "How many Monte Carlo trials are enough?",
      a: "In class, a run is about 1,000 trials with a Data Table repeating it; you have enough when the results barely move between replications. As a guide, a probability estimated from 1,000 trials lands within about 3 percentage points of the true value 95% of the time, and closer when the probability is near 0 or 1.",
    },
    {
      q: "Do we need documentation or macros in the workbook?",
      a: "Neither is required. A short Home sheet, colour-coded inputs and a Goal Seek/Solver setup table help the demo and the grader. Use a recorded macro only where it saves real effort; a Data Table can re-run simulations without VBA.",
    },
    {
      q: "How should we cite data sources?",
      a: "In the data table give the publisher, dataset or table ID, coverage and access date, and say how each source enters the model. Put literature in footnotes, follow each portal's attribution wording, and don't redistribute raw PDFs.",
    },
    {
      q: "What if there is no official data for an input?",
      a: "Put it in a key-assumptions box with a one-phrase justification and a test range, for example a 10% staff turnover rate tested at 5% and 20%.",
    },
    {
      q: "What exactly do we submit in Week 11?",
      a: "The Excel workbook, final report and final presentation slides as separate files, not zipped; the lesson plan also lists research forms. Present with a short live demo and complete the peer evaluation.",
    },
    {
      q: "How does peer evaluation work?",
      a: "Each member rates every other member of the group from 1% to 5%, with optional comments. Anyone left unrated is assumed to get 5%.",
    },
    {
      q: "Can we use generative AI on the project?",
      a: "The AY2026-27 outline dropped the ChatGPT-based part of the project that an earlier version had, and its integrity section requires every assessed piece to be your own work. Assignment 1 forbids generative AI entirely. Check with the instructor before using any AI tool, disclose any use they allow, and write the text yourselves.",
    },
  ],
}
