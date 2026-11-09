import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formulaBank, searchBank, queryTerms } from '../src/data/formulaBank'
import { pastPapers } from '../src/data/pastPapers'
import { search } from '../src/data/searchIndex'

const TGIF = "Joe's Market offers TGIF coupon. If the customer transaction occurs on a Friday, the store offers an additional 5% off coupon if the total bill (before applying Joe's Discount Coupon) is at least $50 and if the total number of food items purchased is at least five. Determine the correct TGIF coupon amount in Cell I20. Provide the formula for Cell I20."

test('a pasted past-paper question finds its part first, with the key formula', () => {
  const top = searchBank(TGIF)[0]
  assert.equal(top.id, 'ay1415t1-q1-d')
  assert.match(top.lines[0].code, /^I20: =IF\(AND\(WEEKDAY\(TODAY\(\)\)=6,J17>=50,SUM\(I2:I16\)>=5\),5%,0%\)$/)
})

test('every past-paper part is in the bank; mocks and lab parts too', () => {
  const parts = pastPapers.flatMap(p => p.questions.flatMap(q => q.parts))
  assert.equal(formulaBank.filter(e => e.source === 'Past paper').length, parts.length)
  assert.ok(formulaBank.some(e => e.source === 'Mock exam') && formulaBank.some(e => e.source === 'Lab'))
  assert.equal(new Set(formulaBank.map(e => e.id)).size, formulaBank.length)
})

test('an unseen question still finds similar parts first', () => {
  const hotel = searchBank('A hotel gives a weekend discount of 10% if the booking date falls on a Saturday or Sunday and the guest stays at least 3 nights.')
  assert.ok(hotel.slice(0, 3).some(e => e.lines.some(l => /WEEKDAY/.test(l.code))))
  const taxi = searchBank('Passengers arrive with exponentially distributed inter-arrival times with a mean of 2 minutes.')
  const ln = (e: { lines: readonly { code: string }[] }) => e.lines.some(l => /LN\(/.test(l.code))
  assert.ok(ln(taxi[0]) && taxi.slice(0, 3).filter(ln).length >= 2)
  // the spotter's question type outranks a shared scenario noun: the weekend surcharge beats a hotel price grid
  assert.ok(hotel[0].lines.some(l => /WEEKDAY/.test(l.code)))
})

test('short queries: 1-2 words all required, 3 or more words any two', () => {
  assert.ok(searchBank('PMT monthly').every(e => /pmt/i.test(JSON.stringify(e)) && /month/i.test(JSON.stringify(e))))
  assert.ok(searchBank('NPV lump sum').length > 0)
  assert.deepEqual(searchBank('zzqq'), [])
  assert.deepEqual(queryTerms('the formula for a cell'), [])
})

test('source filter and empty query', () => {
  assert.ok(searchBank('', formulaBank, 'Past paper').every(e => e.source === 'Past paper'))
  assert.equal(searchBank('').length, formulaBank.length)
})

test('global search lists past-paper parts linking to the formula bank', () => {
  const hit = search('Friday coupon').find(d => d.kind === 'Past paper')
  assert.ok(hit && hit.to.startsWith('/formulas?q='))
})
