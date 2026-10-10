import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet } from '../src/lab/sheet'
import { callVbaFunction, listProcedures, runVba } from '../src/lab/vba/index'
import { codeOnly, learnerCode, procAt, usesKeyword } from '../src/lab/vba/sourceText'
import type { SheetSpec } from '../src/lab/types'

const spec: SheetSpec = {
  rows: 20, cols: 6,
  cells: { A1: { v: 'Item', role: 'header' }, B1: { v: 'Qty', role: 'header' }, A2: { v: 'Tea', role: 'input' }, B2: { v: 4, role: 'input' } },
}
const mod = (...lines: string[]): string => `${lines.join('\n')}\n`

test('runVba writes cells, collects MsgBox and Debug.Print, and is one undo step', () => {
  const sheet = createLabSheet(spec)
  const r = runVba(sheet, mod(
    'Sub Go()',
    '    Range("C2").Value = Range("B2").Value * 2',
    '    Cells(3, 3).Value = "done"',
    '    Debug.Print "twice"; Range("C2").Value',
    '    MsgBox "All set"',
    'End Sub',
  ), 'Go')
  assert.equal(r.ok, true, JSON.stringify(r.error))
  assert.equal(sheet.read('C2').value, 8)
  assert.equal(sheet.read('C3').value, 'done')
  assert.deepEqual(r.messages, ['twice 8', 'All set'])
  assert.deepEqual(r.output?.map(o => o.kind), ['print', 'msgbox'])
  assert.ok(r.steps > 0)
  sheet.undo()
  assert.equal(sheet.read('C2').kind, 'empty')
  assert.equal(sheet.read('C3').kind, 'empty')
  sheet.destroy()
})

test('runVba reports the active cell and selection after the run', () => {
  const sheet = createLabSheet(spec)
  const r = runVba(sheet, mod('Sub Go()', '    Range("C4:D6").Select', '    Range("D5").Activate', 'End Sub'), 'go', { activeCell: 'A1' })
  assert.equal(r.ok, true, JSON.stringify(r.error))
  assert.equal(r.activeCell, 'D5')
  assert.equal(r.selection, 'C4:D6')
  const r2 = runVba(sheet, mod('Sub Go()', '    ActiveCell.Offset(1, 0).Select', 'End Sub'), 'Go', { activeCell: 'B3' })
  assert.equal(r2.activeCell, 'B4')
  sheet.destroy()
})

test('runVba: compile errors run nothing and give the line', () => {
  const sheet = createLabSheet(spec)
  const r = runVba(sheet, mod('Sub Go()', '    Range("C2").Value = 1', '    If x Then', 'End Sub'), 'Go')
  assert.equal(r.ok, false)
  assert.match(r.error?.message ?? '', /^Compile error/)
  assert.ok((r.error?.line ?? 0) > 0)
  assert.equal(sheet.read('C2').kind, 'empty')
  const r2 = runVba(sheet, mod('Option Explicit', 'Sub Go()', '    total = 1', 'End Sub'), 'Go')
  assert.match(r2.error?.message ?? '', /Variable not defined/)
  assert.equal(r2.error?.line, 3)
  sheet.destroy()
})

test('runVba: a run-time error keeps earlier changes and gives the failing line', () => {
  const sheet = createLabSheet(spec)
  const r = runVba(sheet, mod('Sub Go()', '    Range("C2").Value = 1', '    Range("C3").Value = 1 / 0', 'End Sub'), 'Go')
  assert.equal(r.ok, false)
  assert.equal(r.error?.line, 3)
  assert.match(r.error?.message ?? '', /Run-time error '11'/)
  assert.equal(sheet.read('C2').value, 1)
  sheet.destroy()
})

test('runVba: missing entry, entry with parameters, endless loop, locked cell', () => {
  const sheet = createLabSheet(spec)
  assert.match(runVba(sheet, mod('Sub Go()', 'End Sub'), 'Nope').error?.message ?? '', /no Sub called Nope/)
  assert.match(runVba(sheet, mod('Sub Go(n As Long)', 'End Sub'), 'Go').error?.message ?? '', /needs arguments/)
  const loop = runVba(sheet, mod('Sub Go()', '    Do', '        x = x + 1', '    Loop', 'End Sub'), 'Go', { maxSteps: 5000 })
  assert.equal(loop.ok, false)
  assert.match(loop.error?.message ?? '', /possible infinite loop/)
  const locked = runVba(sheet, mod('Sub Go()', '    Range("A1").Value = "x"', 'End Sub'), 'Go')
  assert.match(locked.error?.message ?? '', /protected/)
  assert.equal(sheet.read('A1').value, 'Item')
  sheet.destroy()
})

test('runVba: InputBox takes scripted inputs, then the prompt callback, then Cancel', () => {
  const sheet = createLabSheet(spec)
  const asked: string[] = []
  const r = runVba(sheet, mod(
    'Sub Go()',
    '    Range("C2").Value = InputBox("First?")',
    '    Range("C3").Value = InputBox("Second?")',
    '    Range("C4").Value = "[" & InputBox("Third?") & "]"',
    'End Sub',
  ), 'Go', { inputs: ['7'], prompt: (text) => { asked.push(text); return asked.length === 1 ? 'typed' : null } })
  assert.equal(r.ok, true, JSON.stringify(r.error))
  assert.equal(sheet.read('C2').value, 7)
  assert.equal(sheet.read('C3').value, 'typed')
  assert.equal(sheet.read('C4').value, '[]')
  assert.deepEqual(asked, ['Second?', 'Third?'])
  assert.deepEqual(r.output?.filter(o => o.kind === 'input').map(o => o.answer), ['7', 'typed', undefined])
  sheet.destroy()
})

test('callVbaFunction returns values and explains failures', () => {
  const src = mod(
    'Function Twice(x)', '    Twice = x * 2', 'End Function',
    'Function Bad(x)', '    Bad = x / 0', 'End Function',
    'Sub NotAFunction()', 'End Sub',
    'Function Arr()', '    Arr = Array(1, 2)', 'End Function',
    'Function Hello(name As String) As String', '    Hello = "Hi " & name', 'End Function',
  )
  assert.deepEqual(callVbaFunction(src, 'twice', [21]), { ok: true, value: 42 })
  assert.deepEqual(callVbaFunction(src, 'Hello', ['Ann']), { ok: true, value: 'Hi Ann' })
  const bad = callVbaFunction(src, 'Bad', [1])
  assert.equal(bad.ok, false)
  assert.match(bad.ok ? '' : bad.error, /Division by zero/)
  assert.match((callVbaFunction(src, 'NotAFunction', []) as { error: string }).error, /is a Sub/)
  assert.match((callVbaFunction(src, 'Arr', []) as { error: string }).error, /array/)
  assert.match((callVbaFunction(src, 'Missing', []) as { error: string }).error, /no Function called Missing/)
  assert.equal(callVbaFunction('Function (', 'x', []).ok, false)
})

test('listProcedures lists subs and functions with their required parameters', () => {
  const src = mod(
    'Option Explicit', 'Sub A()', 'End Sub', 'Private Sub B(x As Long, Optional y As Long = 2)', 'End Sub',
    'Function C() As Long', 'End Function',
  )
  assert.deepEqual(listProcedures(src).map(p => [p.name, p.kind, p.params]), [['A', 'sub', 0], ['B', 'sub', 1], ['C', 'function', 0]])
  // a module that does not parse still lists its procedures
  const broken = mod('Sub Go()', '    If x Then', 'End Sub', 'Function F(a, b)', 'End Function')
  assert.deepEqual(listProcedures(broken).map(p => [p.name, p.kind, p.params]), [['Go', 'sub', 0], ['F', 'function', 2]])
})

test('source helpers: keywords outside comments and strings, drivers skipped', () => {
  const src = mod("' For Each in a comment", 'Sub Go()', '    MsgBox "With a string"', '    For   Each c In Range("A1:A2")', '    Next', 'End Sub')
  const code = codeOnly(src)
  assert.ok(!code.includes('comment'))
  assert.ok(!code.includes('With a string'))
  assert.ok(usesKeyword(code, 'For Each'))
  assert.ok(!usesKeyword(code, 'With'))
  assert.ok(usesKeyword('x = Int (y)', 'Int('))
  assert.ok(!usesKeyword('x = Interest', 'Int'))
  assert.ok(usesKeyword('Set r = r.Offset(1, 0)', 'Offset'))
  assert.ok(!usesKeyword(codeOnly("x = 1 ' Offset"), 'Offset'))
  assert.ok(!usesKeyword(codeOnly('Rem Offset here'), 'Offset'))
  const starter = mod('Sub TestIt()', '    Range("A1").End(xlDown).Select', 'End Sub', 'Sub Mine()', 'End Sub')
  const learner = mod('Sub TestIt()', '    Range("A1").End(xlDown).Select', 'End Sub', 'Sub Mine()', '    x = 1', 'End Sub')
  assert.ok(!usesKeyword(learnerCode(learner, starter), 'xlDown'))
  assert.ok(usesKeyword(learnerCode(learner.replace('Range("A1").End', 'Range("A2").End'), starter), 'xlDown'))
  assert.equal(procAt(learner, 5), 'Mine')
  assert.equal(procAt(learner, 1), 'TestIt')
})

test('an unfinished line never hangs the parser: open strings close at the end of the line, like the VBE', () => {
  const sheet = createLabSheet(spec)
  const t0 = Date.now()
  const r = runVba(sheet, mod('Sub Go()', '    Range("C2").Value = "open', 'End Sub'), 'Go')
  assert.ok(Date.now() - t0 < 1000)
  assert.equal(r.ok, true, JSON.stringify(r.error))
  assert.equal(sheet.read('C2').value, 'open')
  for (const src of ['Sub Go()\n    Range("', 'Sub Go()\n    Select', 'Sub Go()\n    Select Case', 'Sub Go(', '"']) {
    const t1 = Date.now()
    const listed = listProcedures(src)
    const run = runVba(sheet, src, 'Go')
    assert.ok(Date.now() - t1 < 1000, src)
    assert.ok(Array.isArray(listed))
    assert.equal(run.ok, false)
    assert.match(run.error?.message ?? '', /^Compile error|no Sub called/, src)
  }
  sheet.destroy()
})

test('a slow endless loop stops on the time budget; time spent answering prompts does not count', () => {
  const sheet = createLabSheet(spec)
  const loop = mod('Sub Go()', '    Do', '        Range("C2").Value = Range("C2").Value + 1', '    Loop', 'End Sub')
  const r = runVba(sheet, loop, 'Go', { maxMs: 150 })
  assert.equal(r.ok, false)
  assert.match(r.error?.message ?? '', /Macro stopped after 0\.2 seconds: possible infinite loop/)
  const slowUser = () => {
    const until = performance.now() + 300
    while (performance.now() < until) { /* the user is thinking */ }
    return '5'
  }
  const ask = mod('Sub Ask()', '    Dim i As Long', '    For i = 1 To 3000', '        Range("C3").Value = i', '    Next', '    Range("C4").Value = InputBox("n?")', 'End Sub')
  const r2 = runVba(sheet, ask, 'Ask', { maxMs: 250, prompt: slowUser })
  assert.equal(r2.ok, true, JSON.stringify(r2.error))
  assert.equal(sheet.read('C4').value, 5)
  sheet.destroy()
})

test('runVba reports the fonts and fills a macro set (the grid does not draw them)', () => {
  const sheet = createLabSheet(spec)
  const r = runVba(sheet, mod('Sub Go()', '    Range("C2").Font.Bold = True', '    Range("C2:C3").Interior.Color = vbYellow', 'End Sub'), 'Go')
  assert.equal(r.ok, true, JSON.stringify(r.error))
  assert.equal(r.styles?.C2?.bold, true)
  assert.equal(r.styles?.C2?.fill, 65535)
  assert.equal(r.styles?.C3?.fill, 65535)
  assert.equal(runVba(sheet, mod('Sub Go()', '    Range("C4").Value = 1', 'End Sub'), 'Go').styles, undefined)
  sheet.destroy()
})
