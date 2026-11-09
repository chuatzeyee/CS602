// Formula Bank: one entry per exam-style question part, answer formula first. Sources: past papers (in our own
// words), mock exams and the lab. Search ranks by how many query words an entry contains, so a whole pasted
// question still finds the closest parts.
import { pastPapers } from './pastPapers'
import { worked, answerLines, cleanPrompt } from './worked'
import { patterns, spot } from './patterns'
import { formulas } from './formulas'
import { anticipated } from './anticipated'

export type BankSource = 'Past paper' | 'Likely question' | 'Mock exam' | 'Lab' | 'Reference'
export const BANK_SOURCES: readonly BankSource[] = ['Past paper', 'Likely question', 'Mock exam', 'Lab', 'Reference']

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
  topics: readonly string[]   // question-pattern ids, used to boost entries of the type the spotter detects
}

// pattern ids whose exam techniques overlap the given ones
const topicsOf = (techniques: readonly string[] = []): string[] =>
  patterns.filter(p => p.techniques.some(t => techniques.includes(t))).map(p => p.id)

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
      topics: topicsOf(pt.techniques),
    })
  }
  const titleOf = new Map(patterns.map(p => [p.id, p.title]))
  for (const q of anticipated) out.push({
    id: `likely-${q.id}`,
    source: 'Likely question',
    label: titleOf.get(q.topic) ?? q.topic,
    context: q.layout,
    task: q.question,
    lines: [...q.formulas.map(f => ({ code: `${f.cell}: ${f.formula}`, note: f.note })), ...(q.tool ?? []).map(code => ({ code }))],
    steps: q.steps,
    pitfalls: q.pitfalls ?? [],
    answer: q.answer,
    to: `/bank?p=${q.topic}`,
    topics: [q.topic],
  })
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
      topics: topicsOf(w.ex.techniques),
    })
  }
  // reference: the question patterns' formula templates and the course workbooks' formulas
  for (const p of patterns) for (const f of p.formulas) out.push({
    id: `pattern-${p.id}-${f.label}`,
    source: 'Reference',
    label: `Pattern: ${p.title}`,
    context: p.spot,
    task: f.label,
    lines: [{ code: f.f, note: f.where }],
    steps: p.steps,
    pitfalls: p.pitfalls,
    to: `/bank?p=${p.id}`,
    topics: [p.id],
  })
  for (const f of formulas) out.push({
    id: `course-${f.week}-${f.name}`,
    source: 'Reference',
    label: `${f.week} course formula`,
    context: '',
    task: f.name,
    lines: [{ code: f.formula }],
    steps: [],
    pitfalls: [],
    answer: f.note,
    to: `/functions?q=${encodeURIComponent(f.name)}`,
    topics: [],
  })
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
  const spotted = new Set(spot(q).slice(0, 2).map(h => h.pattern.id))   // the question types the wording points to
  const scored: { e: BankEntry; s: number }[] = []
  for (const d of docs) {
    let hit = 0
    let s = 0
    for (const t of ts) {
      const w = (d.task.includes(t) ? 3 : 0) + (d.code.includes(t) ? 2 : 0) + (d.rest.includes(t) ? 1 : 0)
      if (w) { hit++; s += w * idf.get(t)! }
    }
    if (hit < need) continue
    const coverage = (hit / ts.length) ** 2   // entries sharing more of the query's words win over one rare-word match
    // lab and mock topics come from the whole exercise, so they get a smaller boost than precisely tagged entries
    const typeMatch = !d.e.topics.some(t => spotted.has(t)) ? 1 : d.e.source === 'Lab' || d.e.source === 'Mock exam' ? 1.25 : 1.8
    scored.push({ e: d.e, s: s * (1 + 4 * coverage) * typeMatch * (d.e.source === 'Past paper' ? 1.1 : 1) })
  }
  return scored.sort((a, b) => b.s - a.s).map(x => x.e)
}
