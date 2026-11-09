// Question patterns: how to recognise an exam part, then the steps, formulas and tool settings that answer it.
// Content lives in patternsModel.ts (question 1 style) and patternsSim.ts (question 2 style); this file holds the
// types and the spotter that ranks patterns against pasted question text.
import type { ExamTechnique } from './lab/techniques'
import { modelPatterns } from './patternsModel'
import { simPatterns } from './patternsSim'

export type PatternGroup = 'Model and optimise' | 'Simulation' | 'Queues' | 'Finance' | 'Data tools and VBA'

export interface PatternFormula {
  label: string
  f: string
  where?: string        // what the cells in the template hold
}

export interface QuestionPattern {
  id: string
  group: PatternGroup
  title: string
  spot: string                          // one line: what the question looks like
  cues: readonly string[]               // lowercase phrases that signal this pattern in a question
  steps: readonly string[]
  formulas: readonly PatternFormula[]
  tool?: readonly string[]              // dialog settings, in order
  pitfalls: readonly string[]
  answer?: string                       // how to write the answer cell or sentence
  techniques: readonly ExamTechnique[]  // links to past-paper parts and worked lab questions
  examples?: readonly string[]          // extra worked-question ids (lab exercises) when no technique fits
}

export const PATTERN_GROUPS: readonly PatternGroup[] = ['Model and optimise', 'Finance', 'Simulation', 'Queues', 'Data tools and VBA']

export const patterns: readonly QuestionPattern[] = [...modelPatterns, ...simPatterns]

export const patternById = (id: string): QuestionPattern | undefined => patterns.find(p => p.id === id)

export interface SpotHit { pattern: QuestionPattern; score: number; matched: string[] }

// lowercase, keep the symbols cues use (%, $, <, >, =, decimal points), turn other punctuation into spaces
const normalise = (s: string) =>
  ` ${s.toLowerCase().replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/[^a-z0-9%$<>=.+*/-]+/g, ' ').replace(/\s+/g, ' ')} `

// how many patterns share each cue: a cue used by 3 patterns says less than one used by 1
const cueSpread = new Map<string, number>()
for (const p of patterns) for (const c of new Set(p.cues.map(normalise))) cueSpread.set(c, (cueSpread.get(c) ?? 0) + 1)

// ponytail: phrase containment, weighted by phrase length / spread; fine for ~30 patterns
export function spot(text: string, list: readonly QuestionPattern[] = patterns): SpotHit[] {
  const t = normalise(text)
  if (t.trim().length < 2) return []
  const hits: SpotHit[] = []
  for (const p of list) {
    const matched = p.cues.filter(c => t.includes(normalise(c)))
    if (matched.length === 0) continue
    const score = matched.reduce((n, c) => n + c.split(' ').length / (cueSpread.get(normalise(c)) ?? 1), 0)
    hits.push({ pattern: p, score, matched })
  }
  return hits.sort((a, b) => b.score - a.score || b.matched.length - a.matched.length)
}
