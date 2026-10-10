import type { Exercise, MockExam } from '../../lab/types'
import { exercise as aQ1 } from './mocks/mock-a-q1'
import { exercise as aQ2 } from './mocks/mock-a-q2'
import { exercise as bQ1 } from './mocks/mock-b-q1'
import { exercise as bQ2 } from './mocks/mock-b-q2'
import { exercise as cQ1 } from './mocks/mock-c-q1'
import { exercise as cQ2 } from './mocks/mock-c-q2'

// three timed papers, each mirroring one past paper's structure (site_build/exam/analysis.json "mock_blueprints").
// question marks are written out, not summed from the tasks, so the validator catches a question whose task marks drift.

const CONDITIONS = "Open book, no internet or AI help.\nThe input tables sit at the paper's cell addresses; answer each part in the cells it names."
const ORIGINAL = 'Original practice scenarios and numbers, not past exam questions.'

// written answers (explain tasks) score only after the learner self-marks them in review, so the intro says how much
const writtenMarks = (...questions: Exercise[]): number =>
  questions.flatMap(ex => ex.tasks).filter(t => t.kind === 'explain').reduce((n, t) => n + (t.marks ?? 0), 0)

// draws: where the simulation question's fixed random numbers are and when they become RAND()
const intro = (draws: string, written: number): string => [
  CONDITIONS,
  draws,
  `Written answers (${written} mark${written === 1 ? '' : 's'}) are self-marked against a model answer after you submit.`,
  ORIGINAL,
].join('\n')

export const mocks: readonly MockExam[] = [
  {
    id: 'mock-a',
    title: 'Mock Exam A - PawPantry pet supplies & night-safari trams',
    minutes: 120,
    basedOn: 'Structure of the AY2014-15 Term 1 paper',
    intro: intro(
      "Q2's first run uses the pre-drawn numbers in P7:R27 and is marked exactly; its replications switch to RAND() and " +
        'RANDBETWEEN() and are marked against ranges.',
      writtenMarks(aQ1, aQ2),
    ),
    questions: [
      { id: 'q1', title: aQ1.title, marks: 13, exercise: aQ1 },
      { id: 'q2', title: aQ2.title, marks: 12, exercise: aQ2 },
    ],
  },
  {
    id: 'mock-b',
    title: 'Mock Exam B - FocusPod study pods & zoo entrance queue',
    minutes: 120,
    basedOn: 'Structure of the AY2016-17 Term 2 paper',
    intro: intro(
      "Q2's first run uses the pre-drawn numbers in Q16:U40 and is marked exactly; part (f) switches them to RAND() for " +
        'replications, which are marked against ranges.',
      writtenMarks(bQ1, bQ2),
    ),
    questions: [
      { id: 'q1', title: bQ1.title, marks: 12, exercise: bQ1 },
      { id: 'q2', title: bQ2.title, marks: 13, exercise: bQ2 },
    ],
  },
  {
    id: 'mock-c',
    title: 'Mock Exam C - Library storage tiers & UmbraShare umbrellas',
    minutes: 120,
    basedOn: 'Structure of the AY2017-18 Term 2 paper',
    intro: intro(
      "Q2's first run uses the pre-drawn numbers in H11:H22 and is marked exactly; part (c) switches them to RAND() for " +
        'replications, which are marked against ranges.',
      writtenMarks(cQ1, cQ2),
    ),
    questions: [
      { id: 'q1', title: cQ1.title, marks: 12, exercise: cQ1 },
      { id: 'q2', title: cQ2.title, marks: 13, exercise: cQ2 },
    ],
  },
]
