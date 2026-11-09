import { test } from 'node:test'
import assert from 'node:assert/strict'
import { search, searchDocs } from '../src/data/searchIndex'
import { studyPlan } from '../src/data/studyPlan'
import { exerciseById, mocks } from '../src/data/lab'

test('search finds exam-critical syntax', () => {
  for (const q of ['CRITBINOM', 'NPV', 'LARGE', 'hh:mm:ss', 'advanced filter', 'NORMINV', 'PMT'])
    assert.ok(search(q).length > 0, `no hits for ${q}`)
})

test('search requires every term and ranks title hits first', () => {
  const hits = search('vlookup true')
  assert.ok(hits.length > 0)
  for (const h of hits) assert.match(`${h.title} ${h.code ?? ''} ${h.body}`.toLowerCase(), /vlookup[\s\S]*true|true[\s\S]*vlookup/)
  assert.deepEqual(search('   '), [])
  assert.deepEqual(search('zzqqxx-nothing'), [])
})

test('search filters by kind', () => {
  const hits = search('NPV', searchDocs, 'Function')
  assert.ok(hits.length > 0 && hits.every(h => h.kind === 'Function'))
})

test('study plan: unique ids, every lab and mock link resolves', () => {
  assert.equal(new Set(studyPlan.map(s => s.id)).size, studyPlan.length)
  for (const s of studyPlan) for (const l of s.links) {
    const lab = l.to.match(/^\/lab\/([^?]+)$/)
    if (lab) assert.ok(exerciseById(lab[1]), `${s.id}: unknown exercise ${lab[1]}`)
    const mock = l.to.match(/^\/exam\/mock\/(.+)$/)
    if (mock) assert.ok(mocks.some(m => m.id === mock[1]), `${s.id}: unknown mock ${mock[1]}`)
  }
})
