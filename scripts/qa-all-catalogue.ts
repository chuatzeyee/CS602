// prints the lab catalogue as JSON for scripts/qa-all-exercises.mjs: npx tsx scripts/qa-all-catalogue.ts
import { exercises, mocks } from '../src/data/lab/index.ts'
import type { Exercise, Task } from '../src/lab/types.ts'

const taskOf = (t: Task) => ({
  id: t.id,
  kind: t.kind,
  tool: t.tool ?? null,
  cells: t.cells,
  chips: /`[A-Z][A-Z0-9.]*`/.test(t.prompt),   // the prompt names a function in backticks: a syntax-card chip
  marks: t.marks ?? null,
  random: Boolean(t.random),
  solution: t.solution ?? null,
  solutions: t.solutions ?? null,
  vba: t.vba ? { entry: t.vba.entry, starter: t.vba.starter, solution: t.vba.solution } : null,
})

const exerciseOf = (e: Exercise) => ({
  id: e.id,
  week: e.week,
  title: e.title,
  topic: e.topic,
  level: e.level,
  techniques: e.techniques ?? [],
  skills: e.skills,
  rows: e.sheet.rows,
  cols: e.sheet.cols,
  iterative: Boolean(e.sheet.iterative),
  tasks: e.tasks.map(taskOf),
})

process.stdout.write(JSON.stringify({
  exercises: exercises.map(exerciseOf),
  mocks: mocks.map(m => ({
    id: m.id,
    title: m.title,
    minutes: m.minutes,
    questions: m.questions.map(q => ({ id: q.id, title: q.title, marks: q.marks, exercise: exerciseOf(q.exercise) })),
  })),
}))
