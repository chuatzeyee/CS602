// our team's script for the data portion (slides 9 and 10) of the group-project proposal presentation, shown at
// /project/data-script. The lines keep the script's wording; the sources name the original public source behind
// each number (tests/presentation-script.test.ts keeps internal file names and notes off the page).

export interface ScriptLine {
  cue?: string          // stage direction, shown before the line (the [bracketed] text of the script)
  text: string          // what to say
}

export interface ScriptSection {
  slide: number
  title: string
  timing: string
  optional: boolean
  lines: readonly ScriptLine[]
}

export interface ScriptSource {
  number: string        // as it appears in the script
  source: string
}

export interface PresentationScript {
  title: string
  intro: string
  sections: readonly ScriptSection[]
  sources: readonly ScriptSource[]
}

export const presentationScript: PresentationScript = {
  title: 'Proposal presentation: data portion script',
  intro: 'About 4½ minutes for slide 10, the data slide; about 5¼ minutes with the optional slide 9 lead-in.',
  sections: [
    {
      slide: 9,
      title: 'How each run is set up',
      timing: 'about 45 seconds',
      optional: true,
      lines: [
        {
          cue: 'Slide 9',
          text: 'Every model run combines three things: a persona, a scenario and a policy setting, before or after NDR.',
        },
        {
          cue: 'Point to the persona box',
          text: "The personas are calibrated to MOM's 2025 income data. Couple A earns about $10,800 a month gross, roughly the middle of Singapore's working households. B earns about $16,700, and C, the sandwiched couple, about $8,200.",
        },
        {
          cue: 'Point to the 6-month and 3-month figures',
          text: "Each couple starts with six months of expenses in savings, in line with MAS's three-to-six-month guide. We call it financial stress if savings fall below three months in any year of the 20-year horizon.",
        },
        {
          cue: 'Point to the assumptions box',
          text: "Where there's no single official figure, we say so. A domestic helper costs about $1,117 a month, which we derived from MOM levy and salary data. Preschool fee cuts are phased in evenly from 2028 to 2030, following the NDR timeline.",
        },
      ],
    },
    {
      slide: 10,
      title: 'Data behind the models',
      timing: 'about 4½ minutes',
      optional: false,
      lines: [
        {
          cue: "Slide 10",
          text: "Here's the data behind all five models, and how we checked it. A model is only as good as its inputs, so this is where a lot of our time went.",
        },
        {
          cue: "Gesture at the cards",
          text: "Behind these six cards is one register of 555 parameters across eight areas, from support packages and childcare fees to job-loss risk. Each one is logged with its value, unit, date and publisher. Wherever official data exist we used them, mainly SingStat, MOM, MSF, NPTD, MOH and ECDA, all accessed on 9 October, and anything that is our own assumption is flagged as such.",
        },
        {
          cue: "How we collected it, with Python",
          text: "On method, almost all of this was pulled with Python, in about 95 small scripts. Where an agency offers an open API, like SingStat's TableBuilder or data.gov.sg for ECDA's centre and fee listings, the scripts call it directly with the requests library and save the raw response. MOM's statistics come as Excel tables, which we read with openpyxl; government web pages are parsed with BeautifulSoup; and for pages that only load in a browser, such as MOE's fee pages, Playwright renders them first. Every raw file is saved with its access date, about 950 in all. pandas then cleans and reshapes everything into tidy tables and computes the derived numbers, re-pricing older figures to 2026 with the CPI and taking low and high values from published percentiles or historical ranges. Because it's all scripted, the second-pass check could simply re-run every download and recompute every number.",
        },
        {
          cue: "Point to \"Government support\"",
          text: "Start with government support. The new SG Child Support Package is worth up to $62,000 per Singapore Citizen child, or about $70,000 once you add the existing MediSave Grant and Edusave. We also captured the pre-NDR baseline, the Baby Bonus, CDA and Large Families Scheme, so every before-and-after comparison is like for like.",
        },
        {
          cue: "Stay on government support",
          text: "Childcare fees show why the detail matters. Full-day childcare at an Anchor Operator centre costs a working family about $365 a month after the basic subsidy. NDR cuts that to $150 by 2030, and infant care falls from about $746 to $300. But nearly 4 in 10 childcare centres are outside the scheme, where the median fee is about $1,830 a month, so we price those separately.",
        },
        {
          cue: "Point to \"Income and spending\"",
          text: "For income, each persona is built from MOM's 2025 median incomes, then checked against SingStat. Couple A, at about $10,800 a month, sits right around the middle of working households. For the cost of the child itself, we re-priced the 2023 Household Expenditure Survey to 2026: at the moderate tier, that is about $620 a month for an infant, rising to about $1,070 for a secondary-school child.",
        },
        {
          cue: "Point to \"Job loss and shocks\"",
          text: "For risk, the Monte Carlo draws shocks calibrated to history. Job loss is about a 0.8% chance a year per earner, from MOM retrenchment data, with the 2009 peak of 1.4% as our high case, and SkillsFuture Jobseeker Support pays up to $6,000 per spell. Medical bills are drawn net of MediShield Life and MediSave, and spending inflation averages 2% a year.",
        },
        {
          cue: "Point to \"CPF, tax and macro\"",
          text: "The financial parameters use 2026 CPF rates, 20% from the employee and 17% from the employer, IRAS tax rates and reliefs, and base rates of 3.7% income growth and a 2.5% discount rate, each with a range for sensitivity testing.",
        },
        {
          cue: "Point to \"Fertility and childcare\"",
          text: "Our preference model is grounded in the Marriage and Parenthood Survey 2021: among married respondents who did not want more children, 64% cited financial cost, 49% said raising children here is too stressful, and 34% said work and family are hard to balance.",
        },
        {
          cue: "Pause on the whole slide",
          text: "So the data enters the models in three ways: base values drive the cashflows, over half the parameters carry a documented low and high value for the sensitivity tests, and the Monte Carlo uses distributions. Every area was then re-checked in a second pass: sources re-downloaded and derived numbers recomputed.",
        },
        {
          cue: "Next slide",
          text: "With the inputs in place, [Name] will take you through the trade-offs and sensitivities we'll run.",
        },
      ],
    },
  ],
  sources: [
    {
      number: 'A $10,792 / B $16,655 / C $8,175 gross a month',
      source: 'MOM Comprehensive Labour Force Survey, June 2025 (gross monthly income by age and sex), checked against SingStat table 17886',
    },
    {
      number: 'A near the middle of working households (52nd percentile)',
      source: 'SingStat table 17886 (household employment income at selected percentiles, 2025)',
    },
    {
      number: 'Helper $1,117 a month (range $866–1,311)',
      source: 'Our estimate from MOM levy rates, SingStat helper salary data (Household Expenditure Survey 2023) and published helper cost guides',
    },
    {
      number: '555 parameters, 8 domains, 291 with low/high values',
      source: 'Our own parameter register (each value logged with its source and date)',
    },
    {
      number: '$364.90 a month at an AOP after Basic Subsidy; $150 NDR target by 2030',
      source: 'ECDA: Anchor Operator fee cap with GST ($664.90) less the $300 Basic Subsidy (subsidy tables updated 6 Oct 2026); NPTD NDR 2026 release (updated 24 Aug 2026)',
    },
    {
      number: '619 of 1,600 childcare centres without an AOP/POP fee cap',
      source: 'ECDA childcare centre and fee listings on data.gov.sg (as at 9 Oct 2026)',
    },
    {
      number: '0.8% job loss a year per earner; 1.4% high case (2009 peak)',
      source: 'MOM retrenchment incidence, 2007–2025 (about 8 per 1,000 prime-age resident employees a year; 13.8 per 1,000 at the 2009 peak)',
    },
    {
      number: "Package up to $62,000; about $70,000 with the MediSave Grant and Edusave",
      source: "LifeSG SG Child Support Package page; NPTD NDR 2026 release and annexes",
    },
    {
      number: "Infant care about $746 a month at an AOP after Basic Subsidy; $300 NDR target",
      source: "ECDA fee caps and subsidy tables; NPTD NDR 2026 release",
    },
    {
      number: "Median fee about $1,830 a month at centres outside the scheme",
      source: "ECDA childcare fee listings on data.gov.sg (as at 9 Oct 2026), median private/non-AOP/POP centre incl. GST",
    },
    {
      number: "Child costs about $620 a month (infant) to $1,070 (secondary), moderate tier",
      source: "SingStat Household Expenditure Survey 2023 (detailed spending, table 17967), re-priced to 2026 with SingStat CPI",
    },
    {
      number: "Jobseeker Support up to $6,000 per spell",
      source: "SkillsFuture Jobseeker Support scheme page (SSG/WSG), 2026",
    },
    {
      number: "CPF 20% employee / 17% employer; tax rates and reliefs",
      source: "CPF Board contribution rates from 1 Jan 2026; IRAS resident tax rates and parenthood reliefs",
    },
    {
      number: "Income growth 3.7%; discount rate 2.5%; inflation 2% a year",
      source: "MOM income growth 2015–2025; CPF, SGS and Savings Bond rates; SingStat CPI",
    },
    {
      number: "64% cost, 49% stress, 34% work–family balance",
      source: "NPTD Marriage and Parenthood Survey 2021 (married respondents not wanting more children)",
    },
  ],
}
