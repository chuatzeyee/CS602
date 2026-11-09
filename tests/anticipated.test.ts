import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { anticipated } from '../src/data/anticipated'
import { patterns } from '../src/data/patterns'

test('anticipated questions pass the content checker (syntax, layout refs, ids, characters)', () => {
  const r = spawnSync('npx', ['tsx', 'scripts/check-anticipated.ts'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

test('every question pattern has likely exam questions', () => {
  for (const p of patterns) assert.ok(anticipated.some(q => q.topic === p.id), `no likely questions for ${p.id}`)
})
