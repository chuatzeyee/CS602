# CS602 SheetSmith

An unofficial study guide for SMU CS602/IS602 *Spreadsheets Modeling for Decision Making* (MITB). It is a static
React site for GitHub Pages: everything runs in the browser, including a working spreadsheet for the Excel Lab, and
progress is kept in the browser's local storage.

## Sections

- **Topics**: revision notes for every session, plus a searchable glossary.
- **Quiz**: a multiple-choice bank with worked explanations.
- **Functions**: the Excel functions, formula patterns and VBA snippets taught in the course, with syntax and gotchas.
- **Models**: the signature session workbooks rebuilt step by step.
- **Excel Lab**: exercises for every taught week in an in-browser spreadsheet (formulas and fill, Goal Seek, Data
  Tables, Solver, Sort, AutoFilter, Advanced Filter, PivotTables and VBA) with Check, hints and Reveal, plus a sandbox.
- **Exam Prep**: format, marking, a time plan and strategy for the final, the techniques past papers test, and timed
  mock exams marked cell by cell.
- **Group Project**: deadlines, deliverables, the rubric, modelling conventions, drills and lessons from past projects.
- **Course**: assessment weights, the week-by-week schedule and course policies.

## How checking works

Every lab exercise ships a reference solution. When a learner presses Check, the checker builds its own copy of the
sheet (HyperFormula plus Excel extras) and judges each task in isolation, on the reference answers for all other tasks
plus the learner's entries for that task, so one mistake does not fail the next task. Formula answers must be formulas
whose values match the reference, then both sides are re-run on hidden test inputs, which catches typed-in numbers and
missing `$` anchors; tasks can also require or forbid functions and specific absolute references. Tool tasks compare
the cells Goal Seek, Solver (with its constraints), Data Tables, filters, Sort or a PivotTable produce; Monte Carlo
tasks are checked statistically over seeded redraws; VBA tasks run the learner's macro on a copy of the sheet; written
answers are self-marked against a model answer. `npm run validate` runs every reference through the same checker and
confirms that typical wrong answers fail.

## Development

```bash
npm install
npm run dev        # dev server: http://localhost:5173/CS602/
npm test           # unit tests (node:test via tsx)
npm run validate   # every exercise and mock exam: schema, syllabus, reference passes, wrong answers fail
npm run build      # type-check and production build into dist/
npm run deploy     # publish dist/ to the gh-pages branch; predeploy runs test, validate and build first
```

React 19, Vite, Tailwind 4, react-router (HashRouter), HyperFormula. The lab pages are lazy-loaded, so the formula
engine is only downloaded when a learner opens an exercise, the sandbox or a mock exam.

## Project layout

```text
src/pages/      one component per route
src/data/       topics, glossary, quiz, functions, models, course, exam and project content
src/data/lab/   Excel Lab exercises by week (w01.ts ... w10.ts), mock exams and the exam technique list
src/lab/        lab runtime: engine, sheet, checker, what-if and data tools, VBA, player components; CONTRACTS.md
scripts/        validate-lab.ts and headless-browser QA scripts (qa-*.mjs)
tests/          node:test suites and fixture exercises
dev/            dev-only harnesses for the grid, player and tools: /CS602/dev/<name>-harness.html under npm run dev
```

## Licence

GPL-3.0-or-later (see `LICENSE`). HyperFormula is used under its GPLv3 option, so the published site is distributed
under the GPLv3; other bundled packages and their licences are listed in `THIRD_PARTY_LICENSES.md`.

Course materials (slides, session workbooks, past papers) are not included. The notes, exercises and mock exams are
original, and the site is not affiliated with SMU.
