// pure helpers behind the lab player: npx tsx --test tests/player.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Exercise, ExerciseResult, MockExam, MockQuestion, Task, TaskResult } from '../src/lab/types'
import { fillArgs, box, boxRef, cellCount, cellsOf, firstCell, normRef, refProblem } from '../src/lab/components/refUtil'
import { floorQuarter, fmtMarks, scoreMock, scoreQuestion, taskMax } from '../src/lab/components/mockScoring'
import { hasVba, needsIterative, toolsFor } from '../src/lab/components/playerTypes'
import { courseExamples, functionInfo, isFunctionName } from '../src/lab/components/functionInfo'
import { clearExerciseProgress, getExerciseProgress, getMockBest, getMockProgress, saveExerciseProgress } from '../src/lab/progress'

// in-memory localStorage for the progress store
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  },
})

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, kind: 'formula', cells: 'B2', prompt: '', ...extra })
const exercise = (tasks: Task[], extra: Partial<Exercise> = {}): Exercise => ({
  id: 'x', week: 'W1', topic: 't', title: 'T', level: 1, minutes: 5, scenario: '', skills: [],
  sheet: { rows: 10, cols: 5, cells: {} }, tasks, ...extra,
})
const tr = (taskId: string, correct: number, total: number, extra: Partial<TaskResult> = {}): TaskResult => ({
  taskId, ok: correct === total, correct, total, messages: [], cells: {}, ...extra,
})
const question = (tasks: Task[], marks: number, id = 'q1'): MockQuestion => ({ id, title: id, marks, exercise: exercise(tasks) })

test('refs: normalise, parse and print ranges', () => {
  assert.equal(normRef(' $b$4 : d9 '), 'B4:D9')
  assert.deepEqual(box('D9:B4'), { r1: 3, c1: 1, r2: 8, c2: 3 })
  assert.equal(box('B4:C5:D6'), undefined)
  assert.equal(box('4B'), undefined)
  assert.equal(boxRef({ r1: 0, c1: 26, r2: 0, c2: 26 }), 'AA1')
  assert.equal(boxRef({ r1: 1, c1: 0, r2: 3, c2: 2 }), 'A2:C4')
  assert.equal(cellCount('B4:D4,F4'), 4)
  assert.equal(firstCell('C5:D9,A1'), 'C5')
  assert.deepEqual(cellsOf('A1:B2'), ['A1', 'B1', 'A2', 'B2'])
  assert.equal(cellsOf('A1:Z1000', 10).length, 10)
})

test('refs: learner-facing problems with typed references', () => {
  const dims = { rows: 20, cols: 6 }
  assert.equal(refProblem('B4', dims), undefined)
  assert.equal(refProblem('', { ...dims, optional: true }), undefined)
  assert.match(refProblem('', dims) ?? '', /Enter a cell reference/)
  assert.match(refProblem('B4:C4', { ...dims, single: true }) ?? '', /single cell/)
  assert.match(refProblem('Z99', dims) ?? '', /outside the sheet/)
  assert.match(refProblem('B4,C4', dims) ?? '', /single range/)
  assert.equal(refProblem('B4:D4,F4', { ...dims, multi: true }), undefined)
  assert.match(refProblem('hello', dims) ?? '', /not a cell reference/)
})

test('fill down / right like Excel', () => {
  assert.deepEqual(fillArgs('C5:C9', 'down'), { source: 'C5', target: 'C5:C9' })
  assert.deepEqual(fillArgs('C5:E9', 'down'), { source: 'C5:E5', target: 'C5:E9' })
  assert.deepEqual(fillArgs('C6', 'down'), { source: 'C5', target: 'C5:C6' })
  assert.deepEqual(fillArgs('C5:F5', 'right'), { source: 'C5', target: 'C5:F5' })
  assert.deepEqual(fillArgs('D5', 'right'), { source: 'C5', target: 'C5:D5' })
  assert.equal(fillArgs('A1', 'down'), null)
  assert.equal(fillArgs('A3', 'right'), null)
  assert.equal(fillArgs('nonsense', 'down'), null)
})

test('mock marks: task share x correct/total, rounded down to 0.25', () => {
  assert.equal(floorQuarter(1.3), 1.25)
  assert.equal(floorQuarter(0.24), 0)
  assert.equal(floorQuarter(0.75), 0.75)
  assert.equal(floorQuarter(3 * (2 / 3) * 0.75), 1.5)
  const q = question([task('a', { marks: 3 }), task('b', { marks: 2 }), task('c', { marks: 1, kind: 'explain' })], 6)
  const r: ExerciseResult = { score: 0, tasks: [tr('a', 2, 3), tr('b', 5, 5), tr('c', 0, 1, { pending: true })] }
  const s = scoreQuestion(q, r)
  assert.deepEqual(s.tasks, { a: 2, b: 2, c: 0 })
  assert.equal(s.got, 4)
  assert.equal(s.max, 6)
  assert.deepEqual(scoreQuestion(q, undefined).tasks, { a: 0, b: 0, c: 0 })
})

test('mock marks: equal split when tasks carry no marks; totals over questions', () => {
  const q1 = question([task('a'), task('b'), task('c')], 10, 'q1')
  assert.equal(taskMax(q1, q1.exercise.tasks[0]), 10 / 3)
  const s1 = scoreQuestion(q1, { score: 0, tasks: [tr('a', 1, 1), tr('b', 1, 2), tr('c', 0, 0, { ok: true })] })
  assert.deepEqual(s1.tasks, { a: 3.25, b: 1.5, c: 3.25 })
  const q2 = question([task('d', { marks: 4 })], 4, 'q2')
  const mock: MockExam = { id: 'm', title: 'M', minutes: 60, basedOn: '', intro: '', questions: [q1, q2] }
  const total = scoreMock(mock, { q1: { score: 0, tasks: [tr('a', 1, 1)] }, q2: { score: 1, tasks: [tr('d', 1, 1)] } })
  assert.equal(total.got, 3.25 + 4)
  assert.equal(Math.round(total.max * 1000) / 1000, 14)
  assert.equal(fmtMarks(7.25), '7.25')
  assert.equal(fmtMarks(10 / 3), '3.33')
  assert.equal(fmtMarks(4), '4')
})

test('toolbar tools, iterative toggle and VBA come from the exercise', () => {
  const ex = exercise([
    task('a', { kind: 'tool', tool: 'solver' }),
    task('b', { kind: 'criteria' }),
    task('c', { kind: 'tool', tool: 'goalseek' }),
    task('d', { kind: 'tool', tool: 'solver' }),
  ])
  assert.deepEqual(toolsFor(ex), ['goalseek', 'solver', 'advfilter'])
  assert.deepEqual(toolsFor(exercise([task('a')])), [])
  assert.equal(needsIterative(exercise([], { sheet: { rows: 1, cols: 1, cells: {}, iterative: true } })), true)
  assert.equal(needsIterative(exercise([], { skills: ['circular references'] })), true)
  assert.equal(needsIterative(exercise([], { skills: ['VLOOKUP'] })), false)
  assert.equal(hasVba(exercise([task('v', { kind: 'vba' })])), true)
  assert.equal(hasVba(ex), false)
})

test('function chips: names vs cell refs and literals; syntax cards and course examples', () => {
  assert.equal(isFunctionName('VLOOKUP'), true)
  assert.equal(isFunctionName('NORM.INV'), true)
  assert.equal(isFunctionName('B2'), false)
  assert.equal(isFunctionName('TRUE'), false)
  assert.equal(isFunctionName('=B2*C2'), false)
  assert.match(functionInfo('stdevp')?.syntax ?? '', /^STDEV\.P\(/)
  assert.equal(functionInfo('NOPE'), undefined)
  assert.ok(courseExamples('SUMPRODUCT').every(f => /SUMPRODUCT\(/i.test(f.formula)))
})

test('progress store: round trip, and corrupt or old entries are cleaned or ignored', () => {
  saveExerciseProgress('ex1', { state: { edits: { B2: '=A2*2' } }, solved: ['t1'], total: 2, best: 0.5, updated: 1 })
  assert.deepEqual(getExerciseProgress('ex1')?.solved, ['t1'])
  assert.equal(getExerciseProgress('ex1')?.state.edits.B2, '=A2*2')
  clearExerciseProgress('ex1')
  assert.equal(getExerciseProgress('ex1'), undefined)
  store.set('cs602-lab:bad-json', '{oops')
  assert.equal(getExerciseProgress('bad-json'), undefined)
  store.set('cs602-lab:bad-edits', JSON.stringify({ state: { edits: { B2: 5 } }, solved: [] }))
  assert.equal(getExerciseProgress('bad-edits'), undefined)
  store.set('cs602-lab:old', JSON.stringify({ state: { edits: {} }, solved: 'all', best: 'x' }))
  assert.deepEqual(getExerciseProgress('old'), { state: { edits: {} }, solved: [], total: 0, best: 0, updated: 0 })
  store.set('cs602-mock:m1', JSON.stringify({ states: { q1: { edits: { C2: '1' } }, q2: { nope: true } }, startedAt: 5, best: { got: 3 } }))
  const m = getMockProgress('m1')
  assert.deepEqual(Object.keys(m?.states ?? {}), ['q1'])
  assert.equal(m?.startedAt, 5)
  assert.equal(getMockBest('m1'), undefined)
})
