import type { ExerciseResult, MockExam, MockQuestion, Task } from '../types'

export const floorQuarter = (x: number): number => Math.floor(x * 4 + 1e-9) / 4

// a task's share of the question: its own marks, or an equal split when the question gives none per task
export function taskMax(q: MockQuestion, t: Task): number {
  const perTask = q.exercise.tasks.some(x => x.marks !== undefined)
  if (perTask) return t.marks ?? 0
  return q.exercise.tasks.length ? q.marks / q.exercise.tasks.length : 0
}

export interface QuestionScore { got: number; max: number; tasks: Record<string, number> }

// marks per task = task marks x correct/total, rounded down to 0.25
export function scoreQuestion(q: MockQuestion, r: ExerciseResult | undefined): QuestionScore {
  const tasks: Record<string, number> = {}
  let got = 0
  let max = 0
  for (const t of q.exercise.tasks) {
    const m = taskMax(q, t)
    const tr = r?.tasks.find(x => x.taskId === t.id)
    const frac = !tr || tr.pending ? 0 : tr.total > 0 ? Math.min(1, tr.correct / tr.total) : tr.ok ? 1 : 0
    const g = floorQuarter(m * frac)
    tasks[t.id] = g
    got += g
    max += m
  }
  return { got, max, tasks }
}

export function scoreMock(mock: MockExam, results: Record<string, ExerciseResult | undefined>) {
  const questions: Record<string, QuestionScore> = {}
  let got = 0
  let max = 0
  for (const q of mock.questions) {
    const s = scoreQuestion(q, results[q.id])
    questions[q.id] = s
    got += s.got
    max += s.max
  }
  return { got, max, questions }
}

export const fmtMarks = (n: number): string => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))))
