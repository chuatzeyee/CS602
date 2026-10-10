// final-data.test.ts - the last data pass: mock sheets show every label and value in full (column widths and label
// placement), the W4 circular drill must read its loop cell, the W5 M2b drill names PERCENTILE again (PERCENTILE.INC
// counts) and the W5 fill-down draws over a fixed table or parameter check their $ anchoring again (any anchoring that
// survives the fill passes). The mock review UX (submitted marks vs the latest check, room under the nav pill) is a
// React page: scripts/qa-final-data.mjs checks it in the browser. Run: npx tsx --test tests/final-data.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises, mocks } from '../src/data/lab/index.ts'
import { checkTask, referenceState } from '../src/lab/checker.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import { colLetter, parseRange, shiftFormula, toRef } from '../src/lab/refs.ts'
import { cellView } from '../src/lab/components/grid/cellView.ts'
import { CHAR_W, DEFAULT_COL_W } from '../src/lab/components/grid/geometry.ts'
import type { Exercise, LearnerState, Task, TaskResult } from '../src/lab/types.ts'

// ---------- mock sheet layout ----------

// px a grid cell's text may use: its column minus the 3 px paddings and the grid line, or, when the text spills into
// the empty cells to its right (cellView decides), its column minus the paddings plus those cells
const ownRoom = (width: number) => width - 7
const spillRoom = (width: number, spill: number) => width - 6 + spill
// spare px every text keeps, so a monospace fallback a little wider than JetBrains Mono (DejaVu Sans Mono, Menlo) fits too
const SPARE = 2

// every cell whose text would be cut off (or a number shown as ####), as the grid draws it at 12 px JetBrains Mono
function clippedCells(ex: Exercise, state?: LearnerState): string[] {
  const sheet = createLabSheet(ex.sheet, state ? { state } : undefined)
  const width = (c: number) => ex.sheet.colWidths?.[colLetter(c)] ?? DEFAULT_COL_W
  const out: string[] = []
  try {
    for (let r = 0; r < sheet.rows; r++) {
      const blank = (c: number) => sheet.raw(toRef(r, c)) === '' && sheet.read(toRef(r, c)).kind === 'empty'
      for (let c = 0; c < sheet.cols; c++) {
        const ref = toRef(r, c)
        const read = sheet.read(ref)
        if (read.kind === 'empty') continue
        let free = 0
        for (let k = c + 1; k < sheet.cols && blank(k); k++) free += width(k)
        const v = cellView({ sheet, ref, raw: sheet.raw(ref), read, width: width(c), spillRoom: free, showFormulas: false, dataTableBody: false })
        const room = v.spill ? spillRoom(width(c), v.spill) : ownRoom(width(c))
        const need = v.text.length * CHAR_W
        if (read.kind === 'number' && /^#+$/.test(v.text)) out.push(`${ref} shows ${v.text}`)
        else if (need + SPARE > room) out.push(`${ref} "${v.text}" needs ${need.toFixed(1)} px, has ${room.toFixed(1)}`)
      }
    }
  } finally {
    sheet.destroy()
  }
  return out
}

const mockQuestions = mocks.flatMap((m) => m.questions.map((q) => q.exercise))

test('mock sheets: every label, header and value fits its cell on the blank sheet and with every answer filled', () => {
  assert.equal(mockQuestions.length, 6)
  for (const ex of mockQuestions) {
    assert.deepEqual(clippedCells(ex), [], `${ex.id}, blank sheet`)
    assert.deepEqual(clippedCells(ex, referenceState(ex)), [], `${ex.id}, every answer filled (review of a full attempt)`)
  }
})

test('mock sheets: the reported cells in particular (T = 0 vs T = 1, B1 title, E2:E4, G42, M20 date, B9, row 17)', () => {
  const byId = (id: string) => {
    const ex = mockQuestions.find((x) => x.id === id)
    assert.ok(ex, id)
    return ex
  }
  // what the cells show with every answer filled
  const shows = (id: string, refs: string[]) => {
    const ex = byId(id)
    const sheet = createLabSheet(ex.sheet, { state: referenceState(ex) })
    try {
      return refs.map((ref) => sheet.display(ref))
    } finally {
      sheet.destroy()
    }
  }
  assert.deepEqual(shows('mock-c-q2', ['C3', 'F3']), ['Umbrellas at T = 0', 'Umbrellas at T = 1'])
  // the zoo title runs across B1:E1 now that the Table 1 title sits one cell right, at F1 above its table
  assert.equal(byId('mock-b-q2').sheet.cells.E1, undefined)
  assert.equal(byId('mock-b-q2').sheet.cells.F1?.v, 'Table 1 - Party sizes')
  assert.equal(shows('mock-a-q1', ['M20'])[0], '12-Nov-2026')
  for (const [id, refs] of [
    ['mock-c-q2', ['C3', 'F3', 'Q14', 'Q15']], ['mock-b-q2', ['B1', 'G2', 'H9', 'I41', 'K44']], ['mock-a-q1', ['E2', 'E3', 'E4', 'G42', 'M20']],
    ['mock-a-q2', ['C2', 'D5', 'E5', 'H5', 'M5', 'L14', 'P5']], ['mock-b-q1', ['B9', 'H12', 'N12', 'V12', 'W12']],
    ['mock-c-q1', ['B3', 'T3', 'C17', 'D17', 'L17', 'W17', 'Y17']],
  ] as const) {
    const clipped = clippedCells(byId(id), referenceState(byId(id)))
    for (const ref of refs) assert.ok(!clipped.some((s) => s.startsWith(`${ref} `)), `${id} ${ref}: ${clipped.join('; ')}`)
  }
})

test('mock sheets: layout only, so no task cell became a label or header', () => {
  // the only label move is mock-b-q2's Table 1 title (E1 -> F1, checked above); answer cells stay where they were
  for (const ex of mockQuestions) {
    for (const t of ex.tasks) {
      if (!t.cells) continue
      for (const area of t.cells.split(',')) {
        const b = parseRange(area)
        for (let r = b.r1; r <= b.r2; r++) {
          for (let c = b.c1; c <= b.c2; c++) {
            const role = ex.sheet.cells[toRef(r, c)]?.role
            assert.ok(role !== 'label' && role !== 'header', `${ex.id} ${t.id}: ${toRef(r, c)} is a ${role}`)
          }
        }
      }
    }
  }
})

// ---------- W4 / W5 refinements ----------

const exercise = (id: string): Exercise => {
  const ex = exercises.find((e) => e.id === id)
  assert.ok(ex, `exercise ${id}`)
  return ex
}
const taskOf = (ex: Exercise, id: string): Task => {
  const t = ex.tasks.find((x) => x.id === id)
  assert.ok(t, `${ex.id}/${id}`)
  return t
}
// the reference state with the task's cells replaced by `first` filled across them like Excel's fill
function attempt(ex: Exercise, task: Task, first: string): TaskResult {
  const ref = referenceState(ex)
  const b = parseRange(task.cells)
  const edits = { ...ref.edits }
  for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) edits[toRef(r, c)] = shiftFormula(first, r - b.r1, c - b.c1)
  return checkTask(ex, task, { ...ref, edits })
}

test('W4 manager fee: B7 must close the loop through B8; the typed closed form no longer passes', () => {
  const ex = exercise('w4-circular-manager-fee')
  const fee = taskOf(ex, 'fee')
  assert.deepEqual(fee.check?.refs, ['B8'])
  assert.ok(checkTask(ex, fee, referenceState(ex)).ok, 'the reference passes')
  const closed = attempt(ex, fee, '=B5*(B3-B4)/(1+B5)')
  assert.equal(closed.ok, false, 'the algebra answer in B7 skips the loop')
  assert.ok(closed.messages.some((m) => /refer to B8/.test(m)), closed.messages.join(' | '))
  assert.ok(attempt(ex, fee, '=$B$5*B8').ok, 'any $ on the loop reference is fine')
  assert.ok(fee.wrong?.includes('=B5*(B3-B4)/(1+B5)'), 'the validator keeps trying the closed form')
})

test('W5 bakery M2b: mustUse PERCENTILE again, and PERCENTILE.INC counts as PERCENTILE', () => {
  const ex = exercise('w5-resample-bakery-records')
  const m2b = taskOf(ex, 'm2b')
  assert.deepEqual(m2b.check?.mustUse, ['PERCENTILE'])
  assert.equal(m2b.check?.mustNotUse, undefined)
  assert.ok(attempt(ex, m2b, '=PERCENTILE($B$11:$F$13,RAND())').ok)
  assert.ok(attempt(ex, m2b, '=PERCENTILE.INC($B$11:$F$13,RAND())').ok, 'the modern name passes')
  const m2a = attempt(ex, m2b, '=SMALL($B$11:$F$13,RANDBETWEEN(1,15))')
  assert.equal(m2a.ok, false, 'M2a on the batches averages 3.52, inside tol: only the function name rules it out')
  assert.ok(m2a.messages.some((m) => /PERCENTILE/.test(m)), m2a.messages.join(' | '))
})

// tasks whose $ check the W5 review dropped only because the old rule wanted the exact $B$3 form
const ANCHORED: readonly (readonly [string, string, readonly string[], string, string])[] = [
  // exercise, task, absolute, unanchored entry (fails), mixed anchoring that survives the fill (passes)
  ['w5-crf-lookup-bouquets', 'draw', ['$C$4:$C$8', '$A$4:$A$8'], '=LOOKUP(RAND(),C4:C8,A4:A8)', '=LOOKUP(RAND(),C$4:C$8,A$4:A$8)'],
  ['w5-inverse-transform-hub', 'normal', ['$B$3', '$B$4'], '=NORMINV(RAND(),B3,B4)', '=NORMINV(RAND(),B$3,B$4)'],
  ['w5-inverse-transform-hub', 'exponential', ['$B$5'], '=-B5*LN(RAND())', '=-B$5*LN(RAND())'],
  ['w5-inverse-transform-hub', 'binomial', ['$B$6', '$B$7'], '=CRITBINOM(B6,B7,RAND())', '=CRITBINOM(B$6,B$7,RAND())'],
  ['w5-inverse-transform-hub', 'poisson', ['$B$8'], '=CRITBINOM(1000,B8/1000,RAND())', '=CRITBINOM(1000,B$8/1000,RAND())'],
  ['w5-resample-bakery-records', 'm2a', ['$B$4:$F$8'], '=SMALL(B4:F8,RANDBETWEEN(1,$I$3))', '=SMALL(B$4:F$8,RANDBETWEEN(1,I$3))'],
  ['w5-resample-bakery-records', 'm2b', ['$B$11:$F$13'], '=PERCENTILE(B11:F13,RAND())', '=PERCENTILE(B$11:F$13,RAND())'],
  ['w5-m1-toppings-vlookup', 'count', ['$A$4:$D$13'], '=COUNTIF(A4:D13,G4)', '=COUNTIF(A$4:D$13,G4)'],
  ['w5-m1-toppings-vlookup', 'simulate', ['$F$4:$G$8'], '=VLOOKUP(J4,F4:G8,2,TRUE)', '=VLOOKUP(J4,F$4:G$8,2,TRUE)'],
  ['w5-mystery-locker-switch', 'opened', ['$E$4:$G$6'], '=INDEX(E4:G6,B11,C11)', '=INDEX(E$4:G$6,B11,C11)'],
]

test('W5 fill-down drills over a fixed table or parameter check the $ again, accepting any anchoring that survives the fill', () => {
  for (const [id, taskId, absolute, loose, mixed] of ANCHORED) {
    const ex = exercise(id)
    const task = taskOf(ex, taskId)
    assert.deepEqual(task.check?.absolute, absolute, `${id}/${taskId} absolute`)
    assert.ok(checkTask(ex, task, referenceState(ex)).ok, `${id}/${taskId}: the reference passes`)
    const bad = attempt(ex, task, loose)
    assert.equal(bad.ok, false, `${id}/${taskId}: ${loose}`)
    // the learner is told about the $, not about #N/A, #NUM! or #VALUE! further down the column
    assert.match(bad.messages[0] ?? '', /^Make .* absolute so (it survives|they survive) fill-down$/, `${id}/${taskId}: ${bad.messages.join(' | ')}`)
    const ok = attempt(ex, task, mixed)
    assert.ok(ok.ok, `${id}/${taskId}: ${mixed} -> ${ok.messages.join(' | ')}`)
  }
})

test('W5 bakery M2a still accepts the exam-key INDEX form and a typed record count', () => {
  const ex = exercise('w5-resample-bakery-records')
  const m2a = taskOf(ex, 'm2a')
  assert.ok(attempt(ex, m2a, '=INDEX($B$4:$F$8,RANDBETWEEN(1,5),RANDBETWEEN(1,5))').ok)
  assert.ok(attempt(ex, m2a, '=SMALL($B$4:$F$8,RANDBETWEEN(1,25))').ok)
})
