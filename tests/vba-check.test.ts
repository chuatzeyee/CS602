import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises } from '../src/data/lab/w09'
import { checkTask, referenceState } from '../src/lab/checker'
import { checkVbaTask } from '../src/lab/vba/check'
import type { Exercise, LearnerState, Task } from '../src/lab/types'

const ex = (id: string): Exercise => {
  const found = exercises.find(e => e.id === id)
  assert.ok(found, id)
  return found
}
const task = (e: Exercise, id: string): Task => {
  const found = e.tasks.find(t => t.id === id)
  assert.ok(found, id)
  return found
}
const withVba = (e: Exercise, t: Task, source: string): LearnerState => {
  const ref = referenceState(e)
  return { ...ref, vba: { ...ref.vba, [t.id]: source } }
}

test('every W9 vba reference passes, its starter fails, and messages never quote the solution', () => {
  for (const e of exercises) {
    for (const t of e.tasks.filter(x => x.kind === 'vba')) {
      const ref = checkVbaTask(e, t, referenceState(e))
      assert.equal(ref.ok, true, `${e.id}/${t.id}: ${ref.messages.join(' | ')}`)
      const starter = checkVbaTask(e, t, withVba(e, t, t.vba?.starter ?? ''))
      assert.equal(starter.ok, false, `${e.id}/${t.id} starter passes`)
      const solutionLines = (t.vba?.solution ?? '').split('\n').map(l => l.trim()).filter(l => l.length > 12 && !/^(Sub|End|Dim|Next|Loop|Function)\b/.test(l))
      for (const w of [starter, ...(t.wrong ?? []).map(src => checkVbaTask(e, t, withVba(e, t, src)))]) {
        assert.equal(w.ok, false)
        for (const m of w.messages) for (const l of solutionLines) assert.ok(!m.includes(l), `${t.id} message reveals "${l}"`)
      }
    }
  }
})

test('a run-time error is reported with its line and procedure', () => {
  const e = ex('w9-vba-post-deliveries')
  const t = task(e, 'post')
  const src = (t.vba?.solution ?? '').replace(/Sub PostDeliveries\(\)\n/, 'Sub PostDeliveries()\n    Dim boom As Integer\n    boom = 40000\n')
  const r = checkVbaTask(e, t, withVba(e, t, src))
  assert.equal(r.ok, false)
  const line = src.split('\n').findIndex(l => l.includes('boom = 40000')) + 1
  assert.match(r.messages[0], new RegExp(`Run-time error '6': Overflow on line ${line} \\(in PostDeliveries\\)`))
})

test('a compile error, a deleted Test driver and an empty module get specific messages', () => {
  const e = ex('w9-vba-post-deliveries')
  const t = task(e, 'post')
  const broken = (t.vba?.solution ?? '').replace('Loop', '')
  assert.match(checkVbaTask(e, t, withVba(e, t, broken)).messages[0], /^Compile error/)
  const noDriver = checkVbaTask(e, t, withVba(e, t, 'Sub PostDeliveries()\nEnd Sub\n'))
  assert.match(noDriver.messages[0], /no procedure called TestTwoDays/)
  assert.match(checkVbaTask(e, t, withVba(e, t, '  ')).messages[0], /empty/)
})

test('mustUse keywords count only in the learner code, not in comments or strings', () => {
  const e = ex('w9-vba-post-deliveries')
  const t = task(e, 'post')
  const src = (t.vba?.solution ?? '').replace('Range("J4").Value = Now', 'Range("J4").Value = Date + Time \' Now')
  const r = checkVbaTask(e, t, withVba(e, t, src))
  assert.equal(r.ok, false)
  assert.ok(r.messages.some(m => /use Now/.test(m)), r.messages.join(' | '))
})

test('function tasks compare each call', () => {
  const e = ex('w9-vba-function-tables')
  const t = task(e, 'tables-needed')
  const r = checkVbaTask(e, t, withVba(e, t, 'Function TablesNeeded(guests, seats)\n    TablesNeeded = Int(guests / seats)\nEnd Function\n'))
  assert.equal(r.ok, false)
  assert.ok(r.messages.some(m => /^TablesNeeded\(\d+, \d+\) returns \d+, which is not right$/.test(m)), r.messages.join(' | '))
  assert.equal(r.total, t.vba?.calls?.length)
})

test('the reference state holds what the reference macros wrote, so later formulas see it', () => {
  const e = ex('w9-vba-post-deliveries')
  const ref = referenceState(e)
  assert.equal(ref.edits.B25, 'DairyLand')
  assert.equal(ref.edits.G25, 'Short')
  // the stronger wrong entries miss rows the macro appends
  for (const [id, wrong] of [['short-count', '=COUNTIF(G16:G24,"Short")'], ['cost', '=SUMPRODUCT(E16:E19,F16:F19)']] as const) {
    const t = task(e, id)
    const cell = t.cells
    assert.equal(checkTask(e, t, { ...ref, edits: { ...ref.edits, [cell]: wrong } }).ok, false, `${id} accepts ${wrong}`)
    assert.equal(checkTask(e, t, ref).ok, true)
  }
})

test('a cell that must be cleared fails when the macro types a space into it instead', () => {
  const e = ex('w6-macro-loan-register')
  const t = task(e, 'add-loan')
  const spaced = (t.vba?.solution ?? '').replace('Selection.ClearContents', 'Selection.Value = " "')
  assert.notEqual(spaced, t.vba?.solution)
  const r = checkVbaTask(e, t, withVba(e, t, spaced))
  assert.equal(r.ok, false)
  assert.match(r.messages.join(' '), /D4 should be empty/)
})
