import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { kitGroups, syntaxSheet } from '../src/data/kit'

const files = kitGroups.flatMap(g => g.files)

test('kit: unique paths, no VBA-only workbooks, sources exist when the course folder is present', () => {
  assert.equal(new Set(files.map(f => f.file)).size, files.length)
  for (const f of files) assert.doesNotMatch(f.file, /Macro|IntroVBA|TimerClicker|UsefulMacros/)
  const course = resolve('..')
  if (!existsSync(resolve(course, 'Week 6'))) return   // a clone without the course files
  for (const f of files) if (f.src) assert.ok(existsSync(resolve(course, f.src)), `missing ${f.src}`)
})

test('syntax sheet: no banned characters', () => {
  assert.doesNotMatch(JSON.stringify(syntaxSheet), /[—–·…−›]/)
})
