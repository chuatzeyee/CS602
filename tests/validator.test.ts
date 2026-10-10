// validator.test.ts - scripts/validate-lab.ts: schema, syllabus, reference and wrong-answer checks.
// Run: npx tsx --test tests/validator.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTable, mockIssues, run, schemaIssues, validateExercise, valuesDiffer, wrongState } from '../scripts/validate-lab.ts'
import type { Issue } from '../scripts/validate-lab.ts'
import { referenceState } from '../src/lab/checker.ts'
import { FIRST_TAUGHT, functionsUsed, notYetTaught } from '../src/lab/syllabus.ts'
import { fixtureMock, fixtures, pendingFixtures } from './fixtures.ts'
import type { CellSpec, Exercise, MockExam, Task } from '../src/lab/types.ts'

const ex = (cells: Record<string, CellSpec>, tasks: Task[], extra: Partial<Exercise> = {}): Exercise => ({
  id: 'unit-ex', week: 'W3', topic: 't', title: 'T', level: 1, minutes: 5, scenario: 's', skills: [],
  sheet: { rows: 12, cols: 6, cells }, tasks, ...extra,
})
const base = (): Exercise => ex(
  { A1: { v: 10, role: 'input' }, A2: { v: 4, role: 'input' }, B1: { role: 'answer' }, B2: { role: 'answer' } },
  [{ id: 't', kind: 'formula', cells: 'B1:B2', prompt: 'p', solution: '=A1*$A$1' }],
  { testCases: [{ name: 'A1 is 3', inputs: { A1: 3 } }] },
)
const has = (issues: Issue[], level: Issue['level'], re: RegExp) =>
  assert.ok(issues.some((i) => i.level === level && re.test(i.message)), `no ${level} matching ${re}: ${JSON.stringify(issues)}`)
const clean = (issues: Issue[]) => assert.deepEqual(issues.filter((i) => i.level === 'error'), [])

test('syllabus: function names and first-taught weeks', () => {
  assert.deepEqual(functionsUsed('=IF(A1>0,"VLOOKUP(x)",_xlfn.XLOOKUP(A1,B:B,C:C))+sum(a1)'), ['IF', 'XLOOKUP', 'SUM'])
  assert.deepEqual(functionsUsed("='Data (2024)'!A1+NORM.INV(RAND(),0,1)"), ['NORM.INV', 'RAND'])
  assert.equal(FIRST_TAUGHT.SUMPRODUCT, 'W1')
  assert.equal(FIRST_TAUGHT.VLOOKUP, 'W3')
  assert.equal(FIRST_TAUGHT.PMT, 'W4')
  assert.equal(FIRST_TAUGHT.RAND, 'W5')
  assert.equal(FIRST_TAUGHT.LARGE, 'W6')
  assert.deepEqual(notYetTaught('=VLOOKUP(A1,B1:C9,2)+PMT(1,2,3)', 'W3'), ['PMT'])
  assert.deepEqual(notYetTaught('=PMT(1,2,3)+LARGE(A1:A9,2)', 'EXAM'), [])
  assert.deepEqual(notYetTaught('=MADEUP(1)', 'EXAM'), ['MADEUP'])
})

test('every fixture validates: PASS or WARN, SKIP only for the pending stubs', () => {
  const ids = new Map<string, number>()
  for (const f of [...fixtures, ...fixtureMock.questions.map((q) => q.exercise)]) ids.set(f.id, (ids.get(f.id) ?? 0) + 1)
  for (const f of fixtures) {
    const r = validateExercise(f, { ids, pending: pendingFixtures[f.id] })
    assert.notEqual(r.status, 'FAIL', `${f.id}: ${JSON.stringify(r.issues)}`)
    if (r.status === 'SKIP') assert.ok(pendingFixtures[f.id], `${f.id} skipped without a pending note`)
  }
  for (const q of fixtureMock.questions) assert.equal(validateExercise(q.exercise, { ids }).status, 'PASS')
  clean(mockIssues(fixtureMock))
})

test('schema: ids, refs inside the sheet, required fields per kind, techniques', () => {
  const ids = new Map([['unit-ex', 2]])
  has(schemaIssues(base(), ids), 'error', /used by 2 exercises/)
  has(schemaIssues({ ...base(), id: 'Bad Id' }), 'error', /lower-case words/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'formula', cells: 'B1:B20', prompt: 'p', solution: '=1' }] }), 'error', /outside the 12x6 sheet/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'formula', cells: 'B1', prompt: 'p' }] }), 'error', /needs solution or solutions/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'value', cells: 'B1', prompt: 'p' }] }), 'error', /needs answer/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'tool', tool: 'goalseek', cells: 'B1', prompt: 'p' }] }), 'error', /needs toolSetup/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'criteria', cells: 'E1:E2', prompt: 'p' }] }), 'error', /needs criteria/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'vba', cells: '', prompt: 'p', vba: { entry: 'X', starter: '', solution: 'Sub X()\nEnd Sub' } }] }), 'error', /expected or vba.calls/)
  has(schemaIssues({ ...base(), tasks: [{ id: 't', kind: 'explain', cells: '', prompt: 'p' }] }), 'error', /model answer/)
  has(schemaIssues({ ...base(), techniques: ['Spreadsheet wizardry'] }), 'error', /not in EXAM_TECHNIQUES/)
  has(schemaIssues({ ...base(), testCases: [{ name: 'x', inputs: { Z99: 1 } }] }), 'error', /outside/)
  has(schemaIssues({ ...base(), testCases: [{ name: 'x', inputs: { B1: 1 } }] }), 'error', /an answer cell/)
  const dup = base()
  has(schemaIssues({ ...dup, tasks: [...dup.tasks, { ...dup.tasks[0] }] }), 'error', /duplicate task id t/)
  const setup = { ...base(), tasks: [{ id: 'g', kind: 'tool' as const, tool: 'goalseek' as const, cells: 'A1', prompt: 'p', toolSetup: { setCell: 'B1', toValue: 0, changingCell: 'H40' }, answer: { A1: 1 } }] }
  has(schemaIssues(setup), 'error', /toolSetup.changingCell H40 is outside/)
  const rnd = { ...base(), tasks: [{ id: 'r', kind: 'formula' as const, cells: 'B1', prompt: 'p', solution: '=RAND()', random: { trials: 500, stat: 'mean' as const, target: 0.5, tol: 0.1 } }] }
  has(schemaIssues(rnd), 'error', /trials must be <= 100/)
  clean(schemaIssues(base()))
})

test('schema: syllabus by week, extension, answer roles, TODAY/NOW', () => {
  const lookup = ex({ A1: { v: 1, role: 'input' }, B1: { role: 'answer' }, D1: { v: 1 }, E1: { v: 2 } }, [
    { id: 'l', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=VLOOKUP(A1,D1:E1,2,TRUE)' },
  ], { week: 'W1' })
  has(schemaIssues(lookup), 'error', /uses VLOOKUP, first taught in W3 \(after W1\)/)
  clean(schemaIssues({ ...lookup, extension: true }))
  clean(schemaIssues({ ...lookup, week: 'W3' }))
  has(schemaIssues({ ...lookup, week: 'W3', extension: true }), 'warn', /extension: true but every function is taught by W3/)
  has(schemaIssues({ ...lookup, tasks: [{ ...lookup.tasks[0], solution: '=MODE.MULT(D1:E1)' }], week: 'W10' }), 'error', /never teaches/)
  const given = ex({ A1: { v: 1, role: 'input' }, B1: { f: '=PMT(1,2,3)', role: 'given' }, C1: { role: 'answer' } }, [
    { id: 'c', kind: 'formula', cells: 'C1', prompt: 'p', solution: '=B1' },
  ], { week: 'W2' })
  has(schemaIssues(given), 'error', /uses PMT/)
  const unstyled = ex({ A1: { v: 1, role: 'input' }, B1: {} }, [{ id: 'u', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=A1' }])
  has(schemaIssues(unstyled), 'error', /role 'answer'/)
  const dated = ex({ B1: { role: 'answer' } }, [{ id: 'd', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=YEAR(TODAY())' }], { week: 'W6' })
  has(schemaIssues(dated), 'error', /must not use TODAY/)
  const draws = ex({ B1: { role: 'answer' } }, [{ id: 'r', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=RAND()' }], { week: 'W5' })
  has(schemaIssues(draws), 'error', /give the task a random check/)
  const mustUse = ex({ A1: { v: 1, role: 'input' }, B1: { role: 'answer' } }, [{ id: 'm', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=A1*2', check: { mustUse: ['SUM'] } }])
  has(schemaIssues(mustUse), 'error', /reference does not use SUM/)
})

test('behaviour: a wrong entry that passes, and a $-stripped solution that passes, are failures', () => {
  const lenient = base()
  lenient.tasks = [{ ...lenient.tasks[0], wrong: ['=A1*A1'], check: { tol: 1e9 } }]
  const r = validateExercise(lenient)
  assert.equal(r.status, 'FAIL')
  has(r.issues, 'error', /wrong entry "=A1\*A1" passes the check/)
  has(r.issues, 'error', /the solution with its \$ signs removed passes the check/)
  const strict = base()
  strict.tasks = [{ ...strict.tasks[0], wrong: ['=A1*A1'] }]
  const ok = validateExercise(strict)
  assert.equal(ok.status, 'PASS', JSON.stringify(ok.issues))
})

test('behaviour: test cases must move a checked value; answer cells need a task', () => {
  const idle = base()
  idle.testCases = [{ name: 'A2 changes', inputs: { A2: 9 } }]
  idle.sheet = { ...idle.sheet, cells: { ...idle.sheet.cells, C5: { role: 'answer' } } }
  const r = validateExercise({ ...idle, tasks: [{ ...idle.tasks[0], cells: 'B1' }] })
  has(r.issues, 'warn', /test case 'A2 changes' changes no checked value/)
  has(r.issues, 'warn', /answer-styled cells no task checks: B2, C5/)
  const none = validateExercise({ ...base(), testCases: undefined })
  has(none.issues, 'warn', /no test cases/)
})

test('behaviour: a reference that fails its own check is reported', () => {
  const bad = ex({ A1: { v: 3, role: 'input' }, B1: { role: 'answer' }, C1: { role: 'answer' } }, [
    { id: 'f', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=A1*2' },
    { id: 'g', kind: 'tool', tool: 'goalseek', cells: 'A1', prompt: 'p', toolSetup: { setCell: 'B1', toValue: 10, changingCell: 'A1' }, answer: { A1: 6 } },
  ])
  const r = validateExercise(bad)
  assert.equal(r.status, 'FAIL')
  has(r.issues, 'error', /the reference fails its own check/)
  const random = ex({ B1: { role: 'answer' } }, [
    { id: 'r', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=RAND()', random: { trials: 50, stat: 'mean', target: 0.5, tol: 0.01 } },
  ], { week: 'W5' })
  const rr = validateExercise(random)
  assert.ok(rr.issues.some((i) => i.level === 'error' || (i.level === 'warn' && /under 4 standard errors/.test(i.message))), JSON.stringify(rr.issues))
})

test('wrong entries: one solution is filled across the range like it; per-cell solutions get the first cell only', () => {
  const answer: CellSpec = { role: 'answer' }
  const fill = ex(
    { B1: { v: 0.1, role: 'input' }, A3: { v: 100, role: 'given' }, A4: { v: 200, role: 'given' }, B3: answer, B4: answer },
    [{ id: 'rate', kind: 'formula', cells: 'B3:B4', prompt: 'p', solution: '=A3*$B$1', wrong: ['=A3*B1'] }],
    { testCases: [{ name: 'B1 is 0.2', inputs: { B1: 0.2 } }] },
  )
  const ref = referenceState(fill)
  assert.deepEqual(wrongState(fill.tasks[0], ref, '=A3*B1').edits, { ...ref.edits, B3: '=A3*B1', B4: '=A4*B2' })
  // right in the first cell and only wrong once filled: entered like the solution, it fails as it should
  const r = validateExercise(fill)
  assert.equal(r.status, 'PASS', JSON.stringify(r.issues))
  const per = ex(
    { A3: { v: 4, role: 'input' }, A4: { v: 5, role: 'input' }, B3: answer, B4: answer },
    [{ id: 'pair', kind: 'formula', cells: 'B3:B4', prompt: 'p', solutions: { B3: '=A3+A4', B4: '=A3*A4' }, wrong: ['=A3-A4'] }],
    { testCases: [{ name: 'A3 is 6', inputs: { A3: 6 } }] },
  )
  const perRef = referenceState(per)
  assert.deepEqual(wrongState(per.tasks[0], perRef, '=A3-A4').edits, { ...perRef.edits, B3: '=A3-A4' })
  assert.equal(validateExercise(per).status, 'PASS')
})

test('schema: check.refs inside the sheet, mustUse accepts the modern name, allowFormula only on value tasks', () => {
  const b = base()
  has(schemaIssues({ ...b, tasks: [{ ...b.tasks[0], check: { refs: ['H40'] } }] }), 'error', /check.refs H40 is outside the 12x6 sheet/)
  const modern = ex({ A1: { v: 0.5, role: 'input' }, B1: { role: 'answer' } }, [
    { id: 'z', kind: 'formula', cells: 'B1', prompt: 'p', solution: '=NORM.INV(A1,0,1)', check: { mustUse: ['NORMINV'] } },
  ], { week: 'EXAM' })
  clean(schemaIssues(modern))
  has(schemaIssues({ ...b, tasks: [{ ...b.tasks[0], check: { allowFormula: true } }] }), 'warn', /allowFormula only applies to value tasks/)
})

test('valuesDiffer sees changes across the range and the test cases only', () => {
  const e = base()
  const ref = referenceState(e)
  assert.equal(valuesDiffer(e, e.tasks[0], ref, { ...ref, edits: { ...ref.edits, B1: '=A1*A1', B2: '=A2*A1' } }), false)
  assert.equal(valuesDiffer(e, e.tasks[0], ref, { ...ref, edits: { ...ref.edits, B1: '=A1*10', B2: '=A2*10' } }), true)
})

test('mocks: marks must add up; question exercises are validated', () => {
  const broken: MockExam = { ...fixtureMock, questions: [{ ...fixtureMock.questions[0], marks: 5 }] }
  has(mockIssues(broken), 'error', /add up to 6, the question is worth 5/)
  has(mockIssues({ ...fixtureMock, id: '' }), 'error', /mock id/)
})

test('cli: --fixtures passes and prints a table', async () => {
  const { reports, failed } = await run(['--fixtures'])
  assert.equal(failed, false, formatTable(reports))
  const table = formatTable(reports)
  assert.match(table, /^STATUS\s+EXERCISE/)
  assert.match(table, /PASS\s+fx-basics/)
  assert.ok(reports.some((r) => r.id === 'mock fx-mock'))
})
