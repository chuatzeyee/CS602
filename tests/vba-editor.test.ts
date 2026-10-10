import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySplice, lineOf, lineRange, newlineSplice, outdentSplice, tabSplice } from '../src/lab/vba/editing'
import { tokenizeLine } from '../src/lab/vba/highlight'

const run = (value: string, start: number, end: number, f: typeof tabSplice) => {
  const s = f(value, start, end)
  return { value: applySplice(value, s), start: s.selStart, end: s.selEnd }
}

test('Tab inserts spaces to the next 4-column stop, or indents every selected line', () => {
  assert.deepEqual(run('x', 0, 0, tabSplice), { value: '    x', start: 4, end: 4 })
  assert.deepEqual(run('ab', 2, 2, tabSplice), { value: 'ab  ', start: 4, end: 4 })
  const v = 'Sub A()\nx = 1\n\ny = 2\nEnd Sub'
  const s = v.indexOf('x')
  const e = v.indexOf('y = 2') + 5
  const r = run(v, s, e, tabSplice)
  assert.equal(r.value, 'Sub A()\n    x = 1\n\n    y = 2\nEnd Sub')
  assert.equal(r.value.slice(r.start, r.end), 'x = 1\n\n    y = 2')
})

test('Shift+Tab outdents to the previous stop', () => {
  const o = (value: string, start: number, end: number) => {
    const s = outdentSplice(value, start, end)
    return s ? { value: applySplice(value, s), start: s.selStart, end: s.selEnd } : null
  }
  assert.deepEqual(o('        x', 9, 9), { value: '    x', start: 5, end: 5 })
  assert.deepEqual(o('      x', 7, 7), { value: '    x', start: 5, end: 5 })
  assert.equal(o('x', 1, 1), null)
  const v = '    a\n        b\nc'
  assert.equal(o(v, 0, v.length)?.value, 'a\n    b\nc')
  // caret inside the indentation stays at the line start
  assert.deepEqual(o('    x', 2, 2), { value: 'x', start: 0, end: 0 })
})

test('Enter keeps the indentation of the current line', () => {
  assert.deepEqual(run('    x = 1', 9, 9, newlineSplice), { value: '    x = 1\n    ', start: 14, end: 14 })
  assert.deepEqual(run('    x', 2, 2, newlineSplice), { value: '  \n    x', start: 5, end: 5 })
  assert.deepEqual(run('a', 1, 1, newlineSplice), { value: 'a\n', start: 2, end: 2 })
})

test('line helpers', () => {
  const v = 'a\nbc\n\nd'
  assert.equal(lineOf(v, 0), 1)
  assert.equal(lineOf(v, 3), 2)
  assert.deepEqual(lineRange(v, 2), { start: 2, end: 4 })
  assert.deepEqual(lineRange(v, 3), { start: 5, end: 5 })
  assert.deepEqual(lineRange(v, 9), { start: 7, end: 7 })
})

test('tokenizeLine colours keywords, comments, strings and numbers', () => {
  const kinds = (line: string) => tokenizeLine(line).filter(t => t.kind !== 'text').map(t => `${t.kind}:${t.text}`)
  assert.deepEqual(kinds('For i = 1 To 10 \' loop'), ['kw:For', 'num:1', 'kw:To', 'num:10', "comment:' loop"])
  assert.deepEqual(kinds('MsgBox "It\'s ""done"""'), ['str:"It\'s ""done"""'])
  assert.deepEqual(kinds('Rem note'), ['comment:Rem note'])
  assert.deepEqual(kinds('x = 1: Rem note'), ['num:1', 'comment:Rem note'])
  assert.deepEqual(kinds('Range("A1").End(xlDown).Select'), ['str:"A1"'])
  assert.deepEqual(kinds('Debug.Print x2'), [])
  assert.equal(tokenizeLine('a = "open').map(t => t.text).join(''), 'a = "open')
})
