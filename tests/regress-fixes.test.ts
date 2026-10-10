// regress-fixes.test.ts - regressions found after the engine, checker and misc fixes. The engine now evaluates Excel's @
// (implicit intersection), so the W3 spill exercise must not claim that =@INDEX(...) collapses to the first value: in
// H4 it gives #VALUE!, as in Excel. Run: npx tsx --test tests/regress-fixes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises } from '../src/data/lab/index.ts'
import { referenceState } from '../src/lab/checker.ts'
import { createLabSheet } from '../src/lab/sheet.ts'

test('W3 spill: the explanation of =@INDEX(...) matches what the lab (and Excel) shows in H4', () => {
  const ex = exercises.find((e) => e.id === 'w3-spill-outlet-quarters')
  assert.ok(ex, 'the W3 spill exercise exists')
  const row = ex.tasks.find((t) => t.id === 'row')
  assert.ok(row?.explain, 'the row task has an explanation')
  assert.doesNotMatch(row.explain, /first value/i)
  assert.match(row.explain, /=@INDEX\(\.\.\.\)/)
  assert.match(row.explain, /H4 shows #VALUE!/)

  const sheet = createLabSheet(ex.sheet, { state: referenceState(ex) })
  try {
    assert.equal(sheet.read('I4').kind, 'number', 'the reference formula spills into I4')
    assert.deepEqual(sheet.set('H4', '=@INDEX(B4:E11,MATCH(H2,A4:A11,0),0)'), { ok: true })
    assert.equal(sheet.raw('H4'), '=@INDEX(B4:E11,MATCH(H2,A4:A11,0),0)')
    const h4 = sheet.read('H4')
    assert.equal(h4.kind, 'error')
    assert.equal(h4.value, '#VALUE!')
    assert.equal(sheet.read('I4').kind, 'empty', 'no spill once the @ asks for a single value')
    // inside the row's columns the @ picks the cell in the formula's own column, as the explanation says
    assert.deepEqual(sheet.set('C2', '=@INDEX(B4:E11,MATCH(H2,A4:A11,0),0)'), { ok: true })
    assert.equal(sheet.read('C2').value, sheet.read('C6').value) // H2 is Tampines, row 6
  } finally {
    sheet.destroy()
  }
})
