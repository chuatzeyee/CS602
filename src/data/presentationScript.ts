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
  intro: 'About 2 minutes for slides 9 and 10, or 80 seconds for slide 10 only.',
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
      timing: 'about 80 seconds',
      optional: false,
      lines: [
        {
          cue: 'Slide 10',
          text: "Here's the data behind all five models, and how we checked it.",
        },
        {
          cue: 'Gesture at the cards',
          text: 'Behind these six cards is one register of 555 parameters across eight areas, each logged with its source and date. Wherever official data exist we used them: LifeSG, ECDA, MOM, SingStat and MOH, all accessed on 9 October. Our own assumptions are flagged as such.',
        },
        {
          cue: 'Point to "Government support"',
          text: 'One example of why the detail matters. Full-day childcare at an Anchor Operator centre costs a working family about $365 a month after the basic subsidy. NDR cuts that to $150 by 2030, but nearly 4 in 10 childcare centres are outside the scheme, so we price those separately.',
        },
        {
          cue: 'Point to "Job loss and shocks"',
          text: 'The data enters the models in three ways. Base values drive the cashflows. Over half the parameters carry a documented low and high value for the sensitivity tests. And the Monte Carlo draws shocks calibrated to history, for example a 0.8% yearly chance of job loss per earner from MOM data, with the 2009 peak of 1.4% as our high case.',
        },
        {
          text: 'Every area was then re-checked in a second pass: sources re-downloaded and derived numbers recomputed.',
        },
        {
          cue: 'Next slide',
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
  ],
}
