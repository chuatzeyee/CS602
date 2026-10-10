// the range the data dialogs start from: npx tsx --test tests/toolRange.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet } from '../src/lab/sheet.ts'
import { listBox, startRegion } from '../src/lab/components/toolRange.ts'

// a title in A1, a blank row, then a 3-column list with headers at A3:C6; a lone note in F1
const sheet = () => createLabSheet({
  name: 'Orders',
  rows: 12,
  cols: 8,
  cells: {
    A1: { v: 'Order book', role: 'label' },
    A3: { v: 'Region', role: 'header' }, B3: { v: 'Qty', role: 'header' }, C3: { v: 'Revenue', role: 'header' },
    A4: { v: 'North' }, B4: { v: 3 }, C4: { v: 30 },
    A5: { v: 'South' }, B5: { v: 5 }, C5: { v: 55 },
    A6: { v: 'East' }, B6: { v: 2 }, C6: { v: 18 },
    F1: { v: 'note' },
  },
})

const box = (r1: number, c1: number, r2: number, c2: number) => ({ r1, c1, r2, c2 })

test('startRegion: a single cell grows to its current region, a block stays as selected', () => {
  const s = sheet()
  assert.deepEqual(startRegion(s, 'B5'), box(2, 0, 5, 2))
  assert.deepEqual(startRegion(s, 'D7'), box(2, 0, 6, 3))        // blank, touching the list diagonally: Excel keeps the cell too
  assert.deepEqual(startRegion(s, 'A4:B5'), box(3, 0, 4, 1))
  assert.deepEqual(startRegion(s, '$B$5,F1'), box(2, 0, 5, 2))  // first area only
  s.destroy()
})

test('startRegion: a blank cell with nothing around it has no region; a lone value is its own region', () => {
  const s = sheet()
  assert.equal(startRegion(s, 'H12'), undefined)
  assert.deepEqual(startRegion(s, 'A1'), box(0, 0, 0, 0))
  assert.equal(startRegion(s, 'Z99'), undefined)                 // outside the sheet
  s.destroy()
})

test('listBox: a typed or picked single cell stands for its region; ranges and bad text as typed', () => {
  const s = sheet()
  assert.deepEqual(listBox(s, 'c5'), box(2, 0, 5, 2))
  assert.deepEqual(listBox(s, '$A$3:$C$6'), box(2, 0, 5, 2))
  assert.deepEqual(listBox(s, 'Orders!A3:B4'), box(2, 0, 3, 1))
  assert.deepEqual(listBox(s, 'H12'), box(11, 7, 11, 7))         // nothing around it: the cell itself
  assert.equal(listBox(s, ''), undefined)
  assert.equal(listBox(s, 'A3:'), undefined)
  assert.equal(listBox(s, 'Other!A3:C6'), undefined)
  s.destroy()
})
