// presentation-script.test.ts - the team's proposal presentation script (data portion, slides 9 and 10) published at
// /project/data-script: both slides in order with their timings, every line spoken text with an optional stage cue,
// the [Name] hand-over placeholder kept, one sources row per number, and nothing internal published (no local file
// or folder names, parameter IDs or notes to self). The page itself is checked in the browser by
// scripts/qa-script-page.mjs. Run: npx tsx --test tests/presentation-script.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presentationScript } from '../src/data/presentationScript.ts'

const { title, intro, sections, sources } = presentationScript
const published = JSON.stringify(presentationScript)

test('the page title and the one-line intro with both timings', () => {
  assert.equal(title, 'Proposal presentation: data portion script')
  assert.equal(intro, 'About 3½ minutes for slide 10, the data slide; about 4¼ minutes with the optional slide 9 lead-in.')
})

test('slide 9 (optional, about 45 seconds) comes before slide 10 (about 80 seconds)', () => {
  assert.deepEqual(sections.map(s => s.slide), [9, 10])
  const [setUp, data] = sections
  assert.equal(setUp.title, 'How each run is set up')
  assert.equal(setUp.optional, true)
  assert.equal(setUp.timing, 'about 45 seconds')
  assert.equal(data.title, 'Data behind the models')
  assert.equal(data.optional, false)
  assert.equal(data.timing, 'about 3½ minutes')
})

test('every line is text to say; cues are plain stage directions without brackets or markdown', () => {
  for (const s of sections) {
    assert.ok(s.lines.length > 0, `slide ${s.slide} has lines`)
    assert.equal(s.lines[0].cue, `Slide ${s.slide}`, `slide ${s.slide} opens on its own cue`)
    for (const line of s.lines) {
      assert.ok(line.text.trim().length > 0, `slide ${s.slide}: empty line`)
      assert.equal(line.text, line.text.trim(), `slide ${s.slide}: stray whitespace in "${line.text.slice(0, 30)}"`)
      assert.doesNotMatch(line.text, /\*\*|`/, `slide ${s.slide}: markdown left in "${line.text.slice(0, 30)}"`)
      if (line.cue === undefined) continue
      assert.ok(line.cue.trim().length > 0, `slide ${s.slide}: empty cue`)
      assert.doesNotMatch(line.cue, /[[\]*`]/, `slide ${s.slide}: cue "${line.cue}" keeps its brackets or markdown`)
    }
  }
})

test('the cues and lines of both slides, in order', () => {
  const cues = sections.map(s => s.lines.map(l => l.cue ?? null))
  assert.deepEqual(cues, [
    ['Slide 9', 'Point to the persona box', 'Point to the 6-month and 3-month figures', 'Point to the assumptions box'],
    ['Slide 10', 'Gesture at the cards', 'Point to "Government support"', 'Stay on government support', 'Point to "Income and spending"', 'Point to "Job loss and shocks"', 'Point to "CPF, tax and macro"', 'Point to "Fertility and childcare"', 'Pause on the whole slide', 'Next slide'],
  ])
})

test('the hand-over keeps [Name] as a placeholder for the next speaker', () => {
  const last = sections[1].lines.at(-1)
  assert.ok(last)
  assert.equal(last.cue, 'Next slide')
  assert.match(last.text, /\[Name\] will take you through/)
})

test('sources: one row per number, each with a source', () => {
  assert.equal(sources.length, 15)
  for (const row of sources) {
    assert.ok(row.number.trim().length > 0 && row.source.trim().length > 0, 'number and source are filled in')
  }
  const numbers = sources.map(r => r.number).join(' | ')
  for (const figure of ['$10,792', '$16,655', '$8,175', '52nd percentile', '$1,117', '555 parameters', '$364.90', '$150',
    '619 of 1,600', '0.8%', '1.4%']) {
    assert.ok(numbers.includes(figure), `the sources table covers ${figure}`)
  }
})

test('sources cite the original public sources', () => {
  const cited = sources.map(r => r.source).join(' | ')
  for (const name of ['MOM Comprehensive Labour Force Survey, June 2025', 'SingStat table 17886', 'MOM levy',
    'data.gov.sg', '9 Oct 2026', 'NPTD', 'MOM retrenchment incidence, 2007–2025']) {
    assert.ok(cited.includes(name), `cites ${name}`)
  }
})

test('nothing internal is published: no file or folder names, parameter IDs, data-pack notes or notes to self', () => {
  assert.doesNotMatch(published, /_/, 'snake_case file, folder or parameter names')
  assert.doesNotMatch(published, /\.(csv|md|txt|pdf|xlsx?|docx|pptx|json)\b/i, 'file extensions')
  assert.doesNotMatch(published, /\b[A-Z]{1,3}\d{2}\b/, 'parameter codes')
  assert.doesNotMatch(published, /data pack|recording|`/i, 'internal notes')
})
