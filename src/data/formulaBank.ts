// Formula Bank: one entry per exam-style question part, answer formula first. Sources: past papers (in our own
// words), mock exams and the lab. Search ranks by how many query words an entry contains, so a whole pasted
// question still finds the closest parts.
import { pastPapers } from './pastPapers'
import { worked, answerLines, cleanPrompt } from './worked'

export type BankSource = 'Past paper' | 'Mock exam' | 'Lab'
export const BANK_SOURCES: readonly BankSource[] = ['Past paper', 'Mock exam', 'Lab']

export interface BankLine { code: string; note?: string }
export interface BankEntry {
  id: string
  source: BankSource
  label: string               // 'AY2014-15 Term 1 Q1(d), 2 marks'
  context: string             // the question's scenario, short
  task: string
  lines: readonly BankLine[]  // answer formulas / settings
  steps: readonly string[]
  pitfalls: readonly string[]
  answer?: string             // the value the key reports
  to?: string                 // full worked question
}

const marks = (m?: number) => (m ? `, ${m} mark${m === 1 ? '' : 's'}` : '')

function build(): BankEntry[] {
  const out: BankEntry[] = []
  for (const p of pastPapers) for (const q of p.questions) for (const pt of q.parts) {
    out.push({
      id: `${p.id}-${q.id}-${pt.label}`,
      source: 'Past paper',
      label: `${p.title} ${q.id.toUpperCase()}(${pt.label})${marks(pt.marks)}`,
      context: `${q.title}. ${q.scenario}`,
      task: pt.task,
      lines: pt.formulas.map(f => ({ code: f.cell ? `${f.cell}: ${f.formula}` : f.formula, note: f.meaning || undefined })),
      steps: pt.steps,
      pitfalls: pt.pitfalls,
      answer: pt.answer || undefined,
    })
  }
  for (const w of worked) for (const t of w.ex.tasks) {
    if (t.kind === 'explain') continue
    const lines = answerLines(t)
    if (lines.length === 0) continue
    const mock = w.source.startsWith('Mock')
    out.push({
      id: `${w.ex.id}-${t.id}`,
      source: mock ? 'Mock exam' : 'Lab',
      label: `${w.source}: ${w.ex.title}${marks(t.marks)}`,
      context: w.ex.scenario,
      task: cleanPrompt(t.prompt),
      lines: lines.map(code => ({ code })),
      steps: (t.hints ?? []).map(cleanPrompt),
      pitfalls: [],
      answer: t.explain ? cleanPrompt(t.explain) : undefined,
      to: `/bank/q/${w.ex.id}`,
    })
  }
  return out
}

export const formulaBank: readonly BankEntry[] = build()

const STOP = new Set('a an the and or of to in on at for by with is are be as if it its this that from into than then each per use using what which who how when do does give find compute determine provide show cell cells formula value'.split(' '))

// light stemming so "exponentially" finds "exponential" and "integers" finds "integer" (matching is by substring)
const stem = (t: string) => (t.length > 5 ? t.replace(/(ally|ly|ing|ed|es|s)$/, '') : t)

export const queryTerms = (q: string): string[] =>
  [...new Set(q.toLowerCase().replace(/[^a-z0-9%$<>=.*/+-]+/g, ' ').split(' ').map(t => t.replace(/^[.]+|[.]+$/g, '')).filter(t => t.length > 1 && !STOP.has(t)).map(stem))]

interface Indexed { e: BankEntry; task: string; code: string; rest: string; all: string }
const indexOf = (e: BankEntry): Indexed => {
  const task = e.task.toLowerCase()
  const code = e.lines.map(l => `${l.code} ${l.note ?? ''}`).join(' ').toLowerCase()
  const rest = `${e.label} ${e.context} ${e.steps.join(' ')} ${e.pitfalls.join(' ')} ${e.answer ?? ''}`.toLowerCase()
  return { e, task, code, rest, all: `${task} ${code} ${rest}` }
}
const cache = new WeakMap<readonly BankEntry[], Indexed[]>()
const indexed = (list: readonly BankEntry[]) => {
  let x = cache.get(list)
  if (!x) cache.set(list, (x = list.map(indexOf)))
  return x
}

// Ranked like a search engine: each matched word scores by rarity (rare words such as "weekend" count more than
// "discount"), more in the task and formula than in the context. A pasted question needs only 2 matching words.
// ponytail: linear scan over ~550 entries per keystroke, fine
export function searchBank(q: string, list: readonly BankEntry[] = formulaBank, source?: BankSource): BankEntry[] {
  const ts = queryTerms(q)
  const docs = indexed(list).filter(d => !source || d.e.source === source)
  if (ts.length === 0) return docs.map(d => d.e)
  const need = ts.length <= 2 ? ts.length : 2
  const idf = new Map(ts.map(t => {
    const df = docs.reduce((n, d) => n + (d.all.includes(t) ? 1 : 0), 0)
    return [t, df ? Math.log(1 + docs.length / df) : 0]
  }))
  const scored: { e: BankEntry; s: number }[] = []
  for (const d of docs) {
    let hit = 0
    let s = 0
    for (const t of ts) {
      const w = (d.task.includes(t) ? 3 : 0) + (d.code.includes(t) ? 2 : 0) + (d.rest.includes(t) ? 1 : 0)
      if (w) { hit++; s += w * idf.get(t)! }
    }
    if (hit < need) continue
    scored.push({ e: d.e, s: d.e.source === 'Past paper' ? s * 1.1 : s })
  }
  return scored.sort((a, b) => b.s - a.s).map(x => x.e)
}
