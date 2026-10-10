// lab-review-fixes.test.ts - regressions for the lab code review (runaway macros, size limits, saved-state hardening,
// undo grouping, wildcard matching, prototype lookups). Run: npx tsx --test tests/lab-review-fixes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KeyboardEvent } from 'react'
import { asOneStep, createLabSheet, writeCells } from '../src/lab/sheet.ts'
import type { SheetSpec } from '../src/lab/types.ts'
import { callFunctionOn, MAX_CANCELS, MAX_MS, MAX_PROMPTS, runVba } from '../src/lab/vba/index.ts'
import { MAX_MESSAGES } from '../src/lab/vba/labHost.ts'
import { checkVbaTask } from '../src/lab/vba/check.ts'
import { fromCell } from '../src/lab/vba/runtime.ts'
import { likeMatch } from '../src/lab/vba/coerce.ts'
import { wildcardRegExp } from '../src/lab/engine/excelMath.ts'
import { wildcardRegex } from '../src/lab/tools/advFilter.ts'
import { MAX_FORMULA, MAX_TEXT } from '../src/lab/engine/limits.ts'
import { refPastEdge } from '../src/lab/refs.ts'
import { scanRefs } from '../src/lab/components/grid/formulaText.ts'
import { cellView } from '../src/lab/components/grid/cellView.ts'
import { buildGeometry } from '../src/lab/components/grid/geometry.ts'
import { gridKeyDown } from '../src/lab/components/grid/commands.ts'
import type { GridCtx, Sel } from '../src/lab/components/grid/gridTypes.ts'
import { autoFill } from '../src/lab/components/grid/sheetOps.ts'
import { restoreAfterRun } from '../src/lab/components/toolUndo.ts'
import LabErrorBoundary, { isChunkError } from '../src/lab/components/LabErrorBoundary.tsx'
import { cleanState, getExerciseProgress, saveExerciseProgress } from '../src/lab/progress.ts'
import { exerciseById } from '../src/data/lab/index.ts'

const blank = (rows = 30, cols = 26): SheetSpec => ({ name: 'Sheet1', rows, cols, cells: {} })
const mod = (...lines: string[]) => lines.join('\n') + '\n'
const timed = <T>(fn: () => T): [T, number] => {
  const t0 = performance.now()
  const out = fn()
  return [out, performance.now() - t0]
}

// ---------- runaway macros (review findings 2 and 3) ----------

test('a loop of slow steps (a block write per pass) stops close to its time budget, not 4,096 steps later', () => {
  const sheet = createLabSheet(blank(30))
  const loop = mod('Sub Fill()', '    Dim i As Long', '    For i = 1 To 100000', '        Range("A1:Z30").Value = i', '    Next', 'End Sub')
  const [r, ms] = timed(() => runVba(sheet, loop, 'Fill', { maxMs: 300 }))
  assert.equal(r.ok, false)
  assert.match(r.error?.message ?? '', /^Macro stopped after 0\.3 seconds: possible infinite loop/)
  assert.ok(ms < 1500, `stopped after ${Math.round(ms)} ms`)
  sheet.destroy()
})

test('a fast loop still stops on its step budget and pays little for the clock checks', () => {
  const sheet = createLabSheet(blank(5, 5))
  const [r, ms] = timed(() => runVba(sheet, mod('Sub Go()', '    Dim x As Long', '    Do', '        x = x + 1', '    Loop', 'End Sub'), 'Go', { maxSteps: 400_000 }))
  assert.match(r.error?.message ?? '', /^Macro stopped after 400,000 steps/)
  assert.ok(ms < 1500, `${Math.round(ms)} ms`)
  sheet.destroy()
})

test('Function calls of one Check share one time budget: a budget that started earlier stops the call at once', () => {
  const never = mod('Function Slow(n)', '    Do', '        Slow = n', '    Loop', 'End Function')
  const [r, ms] = timed(() => callFunctionOn(undefined, never, 'Slow', [1], { started: performance.now() - MAX_MS + 100 }))
  assert.equal(r.ok, false)
  assert.match(r.ok ? '' : r.error, /^Macro stopped after 5 seconds/)
  assert.ok(ms < 1500, `${Math.round(ms)} ms`)
})

test('Check stops a Function that never returns after one budget for all its calls (6 calls, not 6 x 5 s)', () => {
  const ex = exerciseById('w9-vba-function-tables')
  assert.ok(ex)
  const task = ex.tasks.find(t => t.kind === 'vba')
  assert.ok(task)
  const learner = mod('Function TablesNeeded(guests, seats)', '    Dim t', '    Do While True', '        t = Int(Range("B4").Value)', '    Loop', 'End Function')
  const [r, ms] = timed(() => checkVbaTask(ex, task, { edits: {}, vba: { [task.id]: learner } }))
  assert.equal(r.ok, false)
  assert.ok(ms < MAX_MS + 2500, `took ${Math.round(ms)} ms`)
  // whichever budget runs out first (5 s, or 2,000,000 steps on a fast machine), the remaining calls are not run
  assert.equal(r.messages.filter(m => /did not finish: Macro stopped after/.test(m)).length, 1, r.messages.join(' | '))
  assert.ok(r.messages.length <= 5)
})

test('an InputBox loop stops after MAX_PROMPTS prompts, or after MAX_CANCELS Cancels in a row', () => {
  const sheet = createLabSheet(blank(5, 5))
  const ask = mod('Sub Ask()', '    Dim s As String', '    Do', '        s = InputBox("Code?")', '    Loop Until s = "stop"', 'End Sub')
  let asked = 0
  const r = runVba(sheet, ask, 'Ask', { prompt: () => { asked += 1; return 'again' } })
  assert.equal(asked, MAX_PROMPTS)
  assert.match(r.error?.message ?? '', new RegExp(`^Macro stopped after ${MAX_PROMPTS} InputBox prompts: possible infinite loop \\(line 4\\)`))
  asked = 0
  const c = runVba(sheet, ask, 'Ask', { prompt: () => { asked += 1; return null } })
  assert.equal(asked, MAX_CANCELS)
  assert.match(c.error?.message ?? '', /InputBox was cancelled 3 times in a row/)
  const scripted = runVba(sheet, ask, 'Ask', { inputs: ['a', 'b', 'stop'] })
  assert.equal(scripted.ok, true)
  sheet.destroy()
})

test('Debug.Print in a long loop keeps only the last MAX_MESSAGES lines and counts the rest', () => {
  const sheet = createLabSheet(blank(5, 5))
  const r = runVba(sheet, mod('Sub P()', '    Dim i As Long', '    For i = 1 To 5000', '        Debug.Print i', '    Next', 'End Sub'), 'P')
  assert.equal(r.ok, true)
  assert.equal(r.output?.length, MAX_MESSAGES)
  assert.equal(r.messages.length, MAX_MESSAGES)
  assert.equal(r.omitted, 5000 - MAX_MESSAGES)
  assert.equal(r.output?.at(-1)?.text.trim(), '5000')
  assert.equal(r.output?.[0]?.text.trim(), String(5000 - MAX_MESSAGES + 1))
  const short = runVba(sheet, mod('Sub Q()', '    Debug.Print "one"', 'End Sub'), 'Q')
  assert.equal(short.omitted, undefined)
  sheet.destroy()
})

// ---------- size limits (finding 4) ----------

test('arrays, ranges and text are capped at the lab grid and at Excel limits, quickly', () => {
  const sheet = createLabSheet(blank(100))
  const [seq, ms] = timed(() => sheet.set('A1', '=SEQUENCE(5000,5000)'))
  assert.equal(seq.ok, true)
  assert.equal(sheet.read('A1').value, '#VALUE!')
  assert.match(sheet.read('A1').kind === 'error' ? sheet.read('A1').hint : '', /at most the lab's grid/)
  assert.ok(ms < 1000, `${Math.round(ms)} ms`)
  assert.equal(sheet.set('B1', '=REPT("ab",15000000)').ok, true)
  assert.equal(sheet.read('B1').value, '#VALUE!')
  assert.equal(sheet.set('B2', '=REPT("a",32767)&"a"').ok, true)
  assert.equal(sheet.read('B2').value, '#VALUE!')
  assert.equal(sheet.set('B3', '=LEN(REPT("a",32767))').ok, true)
  assert.equal(sheet.read('B3').value, 32767)
  assert.equal(sheet.set('B4', '=SUBSTITUTE(REPT("a",30000),"a",REPT("b",30000))').ok, true)
  assert.equal(sheet.read('B4').value, '#VALUE!')
  const far = sheet.set('C1', '=SUM(A2:Z10000)')
  assert.equal(far.ok, false)
  assert.match(far.ok ? '' : far.message, /Z10000 is past the edge of the lab's sheet/)
  assert.equal(sheet.set('C2', '=SUM(A:A)').ok, true)
  const long = sheet.set('C3', `=${'1+'.repeat(MAX_FORMULA / 2)}1`)
  assert.equal(long.ok, false)
  assert.match(long.ok ? '' : long.message, /at most 8,192 characters/)
  const text = sheet.set('C4', 'x'.repeat(MAX_TEXT + 1))
  assert.match(text.ok ? '' : text.message, /at most 32,767 characters/)
  assert.equal(sheet.set('C4', 'x'.repeat(MAX_TEXT)).ok, true)
  const deep = sheet.set('C5', `=${'('.repeat(4000)}1${')'.repeat(4000)}`)
  assert.match(deep.ok ? '' : deep.message, /more than 64 levels deep/)
  assert.equal(writeCells(sheet, { C6: '=AA1' }).ok, false)
  sheet.destroy()
})

test('references past the grid edge are found outside text only', () => {
  assert.equal(refPastEdge('=SUM(B2:B5000)', 1000, 26), 'B5000')
  assert.equal(refPastEdge('=AA1+1', 1000, 26), 'AA1')
  assert.equal(refPastEdge('=SUM(A:AB)', 1000, 26), 'A:AB')
  assert.equal(refPastEdge('=SUM(1:5000)', 1000, 26), '1:5000')
  assert.equal(refPastEdge('=SUM(A1:Z1000)+LOG10(5)+DAYS360(A1,B1)', 1000, 26), undefined)
  assert.equal(refPastEdge('="B5000"&\'Sheet 12\'!A1', 1000, 26), undefined)
})

test('a macro cannot write an entry past Excel limits or a formula past the grid', () => {
  const sheet = createLabSheet(blank(5, 5))
  const big = runVba(sheet, mod('Sub W()', '    Range("A1").Value = String(40000, "a")', 'End Sub'), 'W')
  assert.match(big.error?.message ?? '', /Run-time error '1004'.*32,767 characters/)
  const far = runVba(sheet, mod('Sub F()', '    Range("A2").Formula = "=SUM(B1:B5000)"', 'End Sub'), 'F')
  assert.match(far.error?.message ?? '', /Run-time error '1004'.*B5000 is past the edge/)
  sheet.destroy()
})

// ---------- saved state (finding 9) ----------

test('a saved state the engine refuses keeps its other entries; bad data-table and VBA parts are skipped', () => {
  const spec = blank(10, 5)
  const deep = `=${'('.repeat(4000)}1${')'.repeat(4000)}`
  const s = createLabSheet(spec, { state: { edits: { A1: deep, B1: '=1+1', B2: '=REPT("ab",600000000)' } } })
  assert.equal(s.read('B1').value, 2)
  assert.equal(s.read('B2').value, '#VALUE!')
  assert.equal(s.raw('A1'), '')
  s.destroy()
  const t = createLabSheet(spec, { state: { edits: { A2: '5' }, dataTables: [{ range: 'A1:C3', rowInput: 5 as unknown as string }] } })
  assert.equal(t.read('A2').value, 5)
  assert.deepEqual(t.dataTables, [])
  t.destroy()
  const cleaned = cleanState({
    edits: { B2: '=1' }, vba: { module: 5, ok: 'Sub A()\nEnd Sub' }, notes: { t1: 3 }, selfMarks: { t1: 'yes', t2: true },
    dataTables: [{ range: 'A1:C3', rowInput: 5 }, { range: 'A5:C7', colInput: 'E1' }, 'junk'], hiddenRows: [2, 'x', 3.5], iterative: 'on',
  })
  assert.deepEqual(cleaned, {
    edits: { B2: '=1' }, vba: { ok: 'Sub A()\nEnd Sub' }, selfMarks: { t2: true }, dataTables: [{ range: 'A5:C7', colInput: 'E1' }], hiddenRows: [2],
  })
  assert.equal(cleanState({ edits: { B2: 5 } }), undefined)
})

test('saving reports a refused write (storage full or blocked) instead of swallowing it', () => {
  const store = new Map<string, string>()
  const full = { getItem: (k: string) => store.get(k) ?? null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
  const ok = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: () => {} }
  const p = { state: { edits: {} }, solved: [], total: 1, best: 0, updated: 1 }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: full })
  assert.equal(saveExerciseProgress('x', p), false)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: ok })
  assert.equal(saveExerciseProgress('x', p), true)
  assert.deepEqual(getExerciseProgress('x')?.state, { edits: {} })
})

test('a render error is caught; an outdated chunk is recognised for the reload', () => {
  assert.equal(LabErrorBoundary.getDerivedStateFromError(new TypeError('e.split is not a function')).error?.message, 'e.split is not a function')
  assert.ok(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Lab-abc.js')))
  assert.ok(isChunkError(new TypeError('Importing a module script failed.')))
  assert.ok(!isChunkError(new TypeError('e.split is not a function')))
})

// ---------- grid (findings 5, 6, 13, 14) ----------

function fakeGrid(sheet: ReturnType<typeof createLabSheet>): GridCtx & { moves: Sel[] } {
  const geo = buildGeometry({ rows: sheet.rows, cols: sheet.cols, hidden: new Set(), frozenRows: 0, showFormulas: false, colLetter: c => String.fromCharCode(65 + c) })
  const at = { r: 0, c: 0 }
  const ctx = {
    sheet, geo, bodies: [], readOnly: false, sel: { anchor: at, extent: at, active: at }, edit: null, clip: null, fillPreview: null,
    escaped: { current: false }, moves: [] as Sel[],
    setSel(s: Sel) { ctx.sel = s; ctx.moves.push(s) },
    reveal() {},
  }
  return ctx as unknown as GridCtx & { moves: Sel[] }
}
function key(k: string, shiftKey = false) {
  const target = {}
  let prevented = false
  const ev = {
    key: k, shiftKey, ctrlKey: false, metaKey: false, altKey: false, target, currentTarget: target, code: '',
    nativeEvent: { isComposing: false }, preventDefault: () => { prevented = true },
  }
  return { ev: ev as unknown as KeyboardEvent<HTMLDivElement>, prevented: () => prevented }
}

test('the grid is not a keyboard trap: Tab moves between cells, Esc then (Shift+)Tab leaves', () => {
  const sheet = createLabSheet(blank(10, 5))
  const ctx = fakeGrid(sheet)
  const tab = key('Tab')
  gridKeyDown(ctx, tab.ev)
  assert.equal(tab.prevented(), true)
  assert.deepEqual(ctx.sel.active, { r: 0, c: 1 })
  gridKeyDown(ctx, key('Escape').ev)
  gridKeyDown(ctx, key('Shift', true).ev)        // pressing Shift for Shift+Tab does not disarm the exit
  const out = key('Tab', true)
  gridKeyDown(ctx, out.ev)
  assert.equal(out.prevented(), false)            // the browser moves focus on
  assert.deepEqual(ctx.sel.active, { r: 0, c: 1 })
  const again = key('Tab')
  gridKeyDown(ctx, again.ev)                      // only the Tab right after Esc leaves
  assert.equal(again.prevented(), true)
  sheet.destroy()
})

test('checked cells differ by more than colour: wrong is a dashed edge, both say so in the tooltip', () => {
  const sheet = createLabSheet({ name: 'S', rows: 5, cols: 3, cells: { B2: { v: '', role: 'answer' } } })
  const view = (mark?: 'ok' | 'bad') =>
    cellView({ sheet, ref: 'B2', raw: '', read: sheet.read('B2'), width: 80, spillRoom: 0, showFormulas: false, mark, dataTableBody: false })
  assert.match(view('bad').outline ?? '', /dashed/)
  assert.equal(view('bad').shadow, undefined)
  assert.match(view('bad').title ?? '', /not right yet/)
  assert.equal(view('ok').outline, undefined)
  assert.match(view('ok').shadow ?? '', /inset/)
  assert.match(view('ok').title ?? '', /Checked: right/)
  assert.equal(view().outline, undefined)
  sheet.destroy()
})

test('reference colouring stays fast on a very long formula', () => {
  const [, ms] = timed(() => scanRefs(`=${'a'.repeat(32000)}`))
  assert.ok(ms < 200, `${Math.round(ms)} ms`)
  assert.deepEqual(scanRefs("='Sales 2026'!B4+Sheet1!C5").map(t => t.text), ["'Sales 2026'!B4", 'Sheet1!C5'])
})

test('one action, one undo step: a mixed fill-handle drag and grouped writes undo and redo together', () => {
  const sheet = createLabSheet({ name: 'S', rows: 20, cols: 4, cells: {} })
  writeCells(sheet, { A1: '1', A2: '2', B1: '=A1*10', B2: '=A2*10' })
  sheet.setFmt('A1:A2', '0.0')
  const res = autoFill(sheet, { r1: 0, c1: 0, r2: 1, c2: 1 }, { r1: 0, c1: 0, r2: 4, c2: 1 }, 'down')
  assert.equal(res.ok, true)
  assert.equal(sheet.read('A5').value, 5)
  assert.equal(sheet.raw('B5'), '=A5*10')
  assert.equal(sheet.fmt('A5'), '0.0')
  sheet.undo()
  assert.equal(sheet.raw('A5'), '')
  assert.equal(sheet.raw('B5'), '')
  assert.equal(sheet.fmt('A5'), undefined)
  assert.equal(sheet.raw('A2'), '2')                // the step before the drag is still there
  sheet.redo()
  assert.equal(sheet.raw('B5'), '=A5*10')
  assert.equal(sheet.fmt('A5'), '0.0')
  const before = sheet.raw('C1')
  asOneStep(sheet, () => {
    writeCells(sheet, { C1: '7' })
    writeCells(sheet, { C1: '8', C2: '9' })
    sheet.setFmt('C1', '0%')
  })
  sheet.undo()
  assert.equal(sheet.raw('C1'), before)
  assert.equal(sheet.raw('C2'), '')
  assert.equal(sheet.fmt('C1'), undefined)
  sheet.redo()
  assert.equal(sheet.raw('C1'), '8')
  sheet.destroy()
})

// ---------- tool dialogs (finding 7) ----------

test('Cancel after Goal Seek or Solver restores their cells without erasing an entry made meanwhile', () => {
  const sheet = createLabSheet({ name: 'S', rows: 10, cols: 5, cells: { B4: { v: 30, role: 'input' } } })
  writeCells(sheet, { B4: '41.5' })                // the run's own undo step
  const after = sheet.version
  assert.equal(sheet.set('D2', '999').ok, true)   // typed while the modeless result dialog was open
  restoreAfterRun(sheet, { B4: '30' }, after)
  assert.equal(sheet.raw('B4'), '30')
  assert.equal(sheet.raw('D2'), '999')
  sheet.undo()                                    // the restore is its own step
  assert.equal(sheet.raw('B4'), '41.5')
  assert.equal(sheet.raw('D2'), '999')
  writeCells(sheet, { B4: '50' })
  restoreAfterRun(sheet, { B4: '41.5' }, sheet.version)   // nothing changed since: the run's step is taken back
  assert.equal(sheet.raw('B4'), '41.5')
  assert.equal(sheet.canRedo(), true)
  sheet.destroy()
})

// ---------- wildcards and VBA lookups (findings 11, 12) ----------

test('wildcard and Like patterns with many stars match in linear time', () => {
  const stars = `*${'a*'.repeat(10)}b`
  const text = 'a'.repeat(28)
  const [vba, msVba] = timed(() => likeMatch(text, stars, false))
  const [xl, msXl] = timed(() => wildcardRegExp(stars).test(text))
  const [adv, msAdv] = timed(() => wildcardRegex(stars, 'contains').test(text.repeat(20)))
  assert.deepEqual([vba, xl, adv], [false, false, false])
  assert.ok(msVba + msXl + msAdv < 100, `${Math.round(msVba)} / ${Math.round(msXl)} / ${Math.round(msAdv)} ms`)
  assert.equal(likeMatch('Aab', '[a-c]*B', true), true)
  assert.equal(likeMatch('Aab', '[a-c]*B', false), false)
  assert.equal(likeMatch('d', '[!A-C]', true), true)
  assert.equal(likeMatch('B', '[!a-c]', true), false)
  assert.equal(wildcardRegExp('North*~*').test('north east*'), true)
  assert.equal(wildcardRegExp('North*~*').test('north east'), false)
  assert.equal(wildcardRegex('~d', 'whole').test('d'), true)
  const sheet = createLabSheet(blank(5, 5))
  sheet.set('A1', 'a'.repeat(26))
  const [, msCountif] = timed(() => sheet.set('B1', `=COUNTIF(A1,"${stars}")`))
  assert.equal(sheet.read('B1').value, 0)
  assert.ok(msCountif < 100, `${Math.round(msCountif)} ms`)
  sheet.destroy()
})

test('member names and cell text never reach Object.prototype in the VBA object model', () => {
  assert.deepEqual(fromCell('toString'), { t: 'str', v: 'toString' })
  assert.deepEqual(fromCell('constructor'), { t: 'str', v: 'constructor' })
  assert.deepEqual(fromCell('#N/A'), { t: 'err', v: 2042 })
  const sheet = createLabSheet(blank(5, 5))
  sheet.set('A1', 'toString')
  const r = runVba(sheet, mod('Sub T()', '    Debug.Print TypeName(Range("A1").Value), IsError(Range("A1").Value)', 'End Sub'), 'T')
  assert.equal(r.messages[0]?.replace(/\s+/g, ' '), 'String False')
  for (const member of ['Range("A1").constructor', 'Application.constructor', 'Range("A1").Font.constructor', 'ActiveWindow.constructor']) {
    const m = runVba(sheet, mod('Sub T()', `    MsgBox ${member}`, 'End Sub'), 'T')
    assert.match(m.error?.message ?? '', /Run-time error '438'/, member)
  }
  sheet.destroy()
})
