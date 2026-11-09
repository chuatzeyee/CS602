import { test } from 'node:test'
import assert from 'node:assert/strict'
import { patterns, spot } from '../src/data/patterns'
import { worked, workedById, answerLines, examplesFor, pastPartsFor } from '../src/data/worked'
import { EXAM_TECHNIQUES } from '../src/data/lab/techniques'
import { search } from '../src/data/searchIndex'

test('patterns: unique ids, valid techniques and example ids, content present', () => {
  assert.equal(new Set(patterns.map(p => p.id)).size, patterns.length)
  for (const p of patterns) {
    assert.ok(p.cues.length >= 5 && p.steps.length >= 3 && p.pitfalls.length >= 1, p.id)
    for (const t of p.techniques) assert.ok((EXAM_TECHNIQUES as readonly string[]).includes(t), `${p.id}: ${t}`)
    for (const id of p.examples ?? []) assert.ok(workedById(id), `${p.id}: unknown example ${id}`)
    assert.ok(examplesFor(p).length > 0, `${p.id} has no worked questions`)
    for (const c of p.cues) assert.equal(c, c.toLowerCase(), `${p.id} cue not lowercase: ${c}`)
  }
})

test('every exam technique is covered by a pattern', () => {
  const covered = new Set(patterns.flatMap(p => p.techniques))
  for (const t of EXAM_TECHNIQUES) assert.ok(covered.has(t), `no pattern for ${t}`)
})

// question wording in the style of the past papers -> the pattern that must rank in the top 3
const SAMPLES: [string, string][] = [
  ['Customers arrive with exponential inter-arrival times and are served at two counters sharing one queue. Find each start time.', 'multi-server'],
  ['Find the percentage of customers who wait more than 5 minutes and the utilisation of the servers.', 'queue-measures'],
  ['Using Solver, find how many of each tray to buy to maximise profit subject to the budget. Quantities must be whole numbers.', 'solver'],
  ['The discount rate depends on the subtotal: below $500 none, $500 and above 3%, $1,500 and above 5%.', 'bracket'],
  ['A loan of $300,000 is repaid monthly over 25 years at 3.5% interest. Compute the monthly instalment.', 'tvm'],
  ['The number of visitors arriving per interval has the probability distribution in Table A. Complete the cumulative probability column.', 'discrete-rv'],
  ['Replicate the evening 1,000 times with a data table and estimate the average revenue.', 'replications'],
  ['A tram departs every 6 minutes with 40 seats; visitors wait in a holding pen of 60 and the rest are turned away.', 'batch-queue'],
  ['Screening time is normally distributed with mean 3 minutes and standard deviation 1 minute, but never below 1 minute.', 'continuous-rv'],
  ['Use Goal Seek to find the latest finish time so that the charge is exactly $50.', 'goal-seek'],
  ['Forecast next year\'s sales with a straight-line trend and give the equation of the trendline.', 'trend'],
  ['Customers balk if more than 7 are in the system and renege after waiting 30 minutes.', 'balk-renege'],
  ['Explain whether a bigger lounge is worthwhile and recommend an option.', 'interpret'],
  ['Use the Advanced Filter with a criteria range to list the orders from North or West.', 'filters'],
  ['Each route has n potential riders who each rent with probability p. Compute departures and arrivals at each location and the surplus bikes.', 'flows'],
  ['Compute the session duration in hours from the start and end times, and the hourly charge prorated by the minute.', 'time-arith'],
  ['Customers pay whichever is cheaper: the hourly charge or blocks of 3 hours at $20 per block.', 'capacity'],
  ['Flag customers whose birthday is this month and who have at least 500 points.', 'dates'],
  ['Summarise total revenue by region and channel.', 'pivot'],
  ['Write a macro that loops through the list and posts each delivery.', 'vba'],
  ['Compute the expected revenue per customer from the duration distribution.', 'sumproduct'],
  ['Look up the fare from the fare matrix using the origin and destination.', 'exact-lookup'],
]

test('spotter ranks the right pattern first for exam-style wording', () => {
  for (const [text, id] of SAMPLES) {
    const top = spot(text).slice(0, 1).map(h => h.pattern.id)
    assert.ok(top.includes(id), `"${text.slice(0, 50)}..." -> ${top.join(', ')} (wanted ${id})`)
  }
  assert.deepEqual(spot(''), [])
  assert.deepEqual(spot('zzz qqq'), [])
})

test('every worked task yields an answer or an explanation', () => {
  let tasks = 0
  for (const w of worked) for (const t of w.ex.tasks) {
    tasks++
    assert.ok(answerLines(t).length > 0 || t.explain, `${w.ex.id}/${t.id} (${t.kind}) has no answer`)
  }
  assert.ok(tasks > 500)
})

test('answer lines: formula fill range, solver record, data table, value', () => {
  const sol = answerLines({ id: 'a', kind: 'formula', cells: 'D18:D23', prompt: '', solution: '=C18*2' })
  assert.deepEqual(sol, ['D18 (fill to D18:D23): =C18*2'])
  const solver = answerLines({ id: 's', kind: 'tool', tool: 'solver', cells: 'B4:D4', prompt: '', toolSetup: { objective: 'E8', sense: 'max', changing: 'B4:D4', constraints: [{ lhs: 'B4:D4', relation: 'int' }, { lhs: 'F5', relation: '<=', rhs: 'G5' }] } })
  assert.ok(solver.includes('Set Objective: E8   To: Max'))
  assert.ok(solver.includes('Subject to: B4:D4 = integer'))
  assert.ok(solver.includes('Subject to: F5 <= G5'))
  const dt = answerLines({ id: 'd', kind: 'tool', tool: 'datatable', cells: 'E4:E103', prompt: '', toolSetup: { range: 'D3:E103', colInput: 'H5' } })
  assert.deepEqual(dt, ['Select D3:E103', 'Data > What-If Analysis > Data Table', 'Row input cell: (empty)', 'Column input cell: H5'])
  assert.deepEqual(answerLines({ id: 'v', kind: 'value', cells: 'G13', prompt: '', answer: 221 }), ['G13: 221'])
})

test('past-paper parts are found for the most tested pattern', () => {
  const time = patterns.find(p => p.id === 'time-arith')!
  assert.ok(pastPartsFor(time).length >= 7)
})

test('search surfaces patterns and worked questions', () => {
  assert.equal(search('multi-server')[0]?.kind, 'Pattern')
  assert.ok(search('LARGE').some(d => d.kind === 'Question' && d.to.startsWith('/bank/q/')))
  assert.ok(search('Mock Exam A').length > 0)
})
