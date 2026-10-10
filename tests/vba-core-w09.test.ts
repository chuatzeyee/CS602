// vba-core: the reference macros of every VBA task (src/data/lab/w09.ts) run through the real interpreter, the lab host
// and the Excel object model, and leave the expected cell values.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exercises } from '../src/data/lab/w09.ts'
import { createLabSheet } from '../src/lab/sheet.ts'
import { createLabHost } from '../src/lab/vba/labHost.ts'
import { excelScope } from '../src/lab/vba/objects.ts'
import { fromCell, toCell } from '../src/lab/vba/runtime.ts'
import { runProcedure } from '../src/lab/vba/interpreter.ts'
import { fakeHost } from './vbaCoreHarness.ts'

const vtest = test

vtest('runProcedure reports parse errors, a missing entry and runs a module', () => {
  const host = fakeHost().host
  const bad = runProcedure('Sub Main()\n  If x Then\nEnd Sub\n', 'Main', [], { host })
  assert.equal(bad.ok, false)
  assert.match(bad.error!.message, /^Compile error/)
  const missing = runProcedure('Sub Main()\nEnd Sub\n', 'Other', [], { host })
  assert.deepEqual(missing.error, { line: 0, message: 'Sub or Function not defined: Other' })
  const good = runProcedure('Function Twice(x)\n  Twice = x * 2\nEnd Function\n', 'Twice', [fromCell(21)], { host })
  assert.equal(good.ok, true)
  assert.equal(toCell(good.value!), 42)
})

vtest('a Function entry returning a Range gives the cell value', () => {
  const sheet = createLabSheet({ rows: 5, cols: 3, cells: { B2: { v: 7 } } })
  try {
    const host = createLabHost(sheet)
    const r = runProcedure('Function Pick() As Range\n  Set Pick = Range("B2")\nEnd Function\n', 'Pick', [], { host, globals: excelScope(host) })
    host.finish()
    assert.equal(r.ok, true)
    assert.equal(toCell(r.value!), 7)
  } finally {
    sheet.destroy()
  }
})

const near = (a: unknown, b: unknown): boolean =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)) : a === b

for (const ex of exercises) {
  for (const task of ex.tasks) {
    const spec = task.vba
    if (task.kind !== 'vba' || !spec) continue
    vtest(`w09 reference macro runs: ${ex.id} / ${task.id}`, () => {
      const sheet = createLabSheet(ex.sheet)
      try {
        if (spec.calls) {
          for (const c of spec.calls) {
            const host = createLabHost(sheet)
            const r = runProcedure(spec.solution, spec.entry, c.args.map(fromCell), { host, globals: excelScope(host) })
            host.finish()
            assert.equal(r.error?.message, undefined, `line ${r.error?.line}: ${r.error?.message}`)
            assert.ok(near(toCell(r.value!), c.result), `${spec.entry}(${c.args.join(', ')}) = ${String(toCell(r.value!))}, expected ${String(c.result)}`)
          }
        }
        if (spec.expected) {
          const host = createLabHost(sheet, { inputs: spec.inputs, activeCell: spec.activeCell, selection: spec.selection })
          const r = runProcedure(spec.solution, spec.entry, [], { host, globals: excelScope(host) })
          host.finish()
          assert.equal(r.error?.message, undefined, `line ${r.error?.line}: ${r.error?.message}`)
          for (const [ref, want] of Object.entries(spec.expected)) {
            const got = sheet.values(ref)[0]?.[0] ?? null
            assert.ok(near(got, want), `${ref} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)
          }
        }
      } finally {
        sheet.destroy()
      }
    })
  }
}

// the plausible wrong modules listed with a task must not reproduce the expected end state
for (const ex of exercises) {
  for (const task of ex.tasks) {
    const spec = task.vba
    if (task.kind !== 'vba' || !spec || !task.wrong?.length) continue
    vtest(`w09 wrong modules fail: ${ex.id} / ${task.id}`, () => {
      task.wrong!.forEach((src, i) => {
        const sheet = createLabSheet(ex.sheet)
        try {
          let differs = false
          if (spec.calls) {
            for (const c of spec.calls) {
              const host = createLabHost(sheet)
              const r = runProcedure(src, spec.entry, c.args.map(fromCell), { host, globals: excelScope(host) })
              host.finish()
              if (!r.ok || !near(toCell(r.value!), c.result)) differs = true
            }
          }
          if (spec.expected) {
            const host = createLabHost(sheet, { inputs: spec.inputs, activeCell: spec.activeCell, selection: spec.selection })
            const r = runProcedure(src, spec.entry, [], { host, globals: excelScope(host) })
            host.finish()
            if (!r.ok) differs = true
            for (const [ref, want] of Object.entries(spec.expected)) {
              if (!near(sheet.values(ref)[0]?.[0] ?? null, want)) differs = true
            }
          }
          assert.ok(differs, `wrong module ${i} reproduced the expected result`)
        } finally {
          sheet.destroy()
        }
      })
    })
  }
}
