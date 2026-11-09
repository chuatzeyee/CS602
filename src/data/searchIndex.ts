// One flat index over everything worth looking up in an open-book exam. Pure data + a scorer, so it is testable.
import { sessions } from './topics'
import { definitions } from './definitions'
import { formulas } from './formulas'
import { walkthroughs } from './walkthroughs'
import { questions } from './quiz'
import { exam } from './exam'
import { worked, answerLines, cleanPrompt } from './worked'
import { patterns } from './patterns'
import { studyPlan } from './studyPlan'

export type DocKind = 'Pattern' | 'Question' | 'Notes' | 'Glossary' | 'Function' | 'Model' | 'Quiz' | 'Exam' | 'Recall'
export const DOC_KINDS: readonly DocKind[] = ['Pattern', 'Question', 'Function', 'Notes', 'Glossary', 'Model', 'Exam', 'Quiz', 'Recall']

export interface SearchDoc {
  kind: DocKind
  week: string          // 'W3', or '' when not tied to a week
  title: string
  body: string          // full text shown when the result is expanded
  code?: string         // formula / syntax, shown in mono
  to: string            // route to open
}

const wk = (id: string) => id.toUpperCase()

function build(): SearchDoc[] {
  const docs: SearchDoc[] = []
  for (const s of sessions) for (const t of s.topics) for (const sec of t.sections)
    docs.push({ kind: 'Notes', week: wk(s.id), title: `${t.title} > ${sec.heading}`, body: sec.points.join('\n'), to: `/topics?week=${wk(s.id)}` })
  for (const d of definitions)
    docs.push({ kind: 'Glossary', week: d.source, title: d.term, body: d.example ? `${d.definition}\nExample: ${d.example}` : d.definition, to: '/topics?view=glossary' })
  for (const f of formulas)
    docs.push({ kind: 'Function', week: f.week, title: f.name, code: f.formula, body: f.note, to: `/functions?q=${encodeURIComponent(f.name)}` })
  for (const w of walkthroughs) {
    docs.push({ kind: 'Model', week: w.week, title: w.title, body: [w.overview, ...w.takeaways].join('\n'), to: '/models' })
    for (const st of w.steps)
      docs.push({ kind: 'Model', week: w.week, title: `${w.title.split(':')[0]} > ${st.title}`, body: st.explanation, code: st.code, to: '/models' })
  }
  for (const q of questions)
    docs.push({ kind: 'Quiz', week: q.topic, title: q.question, body: `Answer: ${q.options[q.answerIndex]}\n${q.explanation}`, to: `/quiz?topic=${q.topic}` })
  for (const p of patterns)
    docs.push({
      kind: 'Pattern', week: '', title: p.title, to: `/bank?p=${p.id}`,
      code: p.formulas.map(f => `${f.label}: ${f.f}`).join('\n') || undefined,
      body: [p.spot, `Cue words: ${p.cues.join(', ')}`, 'Steps:', ...p.steps.map((x, i) => `${i + 1}. ${x}`), ...(p.tool ? ['Dialog:', ...p.tool] : []), 'Pitfalls:', ...p.pitfalls].join('\n'),
    })
  for (const w of worked) for (const t of w.ex.tasks) {
    const ans = answerLines(t)
    if (ans.length === 0 && !t.explain) continue
    const steps = (t.hints ?? []).map((h, i) => `Step ${i + 1}: ${cleanPrompt(h)}`)
    docs.push({
      kind: 'Question', week: w.ex.week === 'EXAM' ? '' : w.ex.week, to: `/bank/q/${w.ex.id}`,
      title: `${w.source}: ${w.ex.title} > ${cleanPrompt(t.prompt).slice(0, 120)}`,
      code: t.kind === 'explain' ? undefined : ans.join('\n') || undefined,
      body: [cleanPrompt(t.prompt), ...steps, t.kind === 'explain' ? `Model answer: ${ans[0] ?? ''}` : '', t.explain ? `Why: ${cleanPrompt(t.explain)}` : ''].filter(Boolean).join('\n'),
    })
  }
  const examNotes = [
    ...exam.marking, ...exam.strategy, ...exam.mockConventions,
    ...exam.templateNotes.map(n => ({ title: 'Template note', detail: n })),
    ...exam.rules.map(n => ({ title: 'Exam rule', detail: n })),
    ...exam.timeTips.map(n => ({ title: 'Time tip', detail: n })),
  ]
  for (const n of examNotes) docs.push({ kind: 'Exam', week: '', title: n.title, body: n.detail, to: '/exam' })
  for (const p of exam.quizPatterns) docs.push({ kind: 'Exam', week: '', title: `${p.quiz} patterns`, body: p.patterns.join('\n'), to: '/exam' })
  for (const s of studyPlan) for (const r of s.recall)
    docs.push({ kind: 'Recall', week: '', title: r.q, body: r.a, to: '/study' })
  return docs
}

export const searchDocs: readonly SearchDoc[] = build()

export const terms = (q: string): string[] => q.toLowerCase().split(/\s+/).filter(Boolean)

// every term must appear somewhere; title hits and whole-phrase hits rank higher. ponytail: linear scan of ~2-3k docs, fine
export function search(q: string, docs: readonly SearchDoc[] = searchDocs, kind?: DocKind): SearchDoc[] {
  const ts = terms(q)
  if (ts.length === 0) return []
  const phrase = q.trim().toLowerCase()
  const scored: { d: SearchDoc; s: number }[] = []
  for (const d of docs) {
    if (kind && d.kind !== kind) continue
    const title = d.title.toLowerCase()
    const all = `${title}\n${(d.code ?? '').toLowerCase()}\n${d.body.toLowerCase()}`
    if (!ts.every(t => all.includes(t))) continue
    let s = ts.reduce((n, t) => n + (title.includes(t) ? 3 : 1) + ((d.code ?? '').toLowerCase().includes(t) ? 2 : 0), 0)
    if (all.includes(phrase)) s += 4
    if (title.includes(phrase)) s += 6
    if (d.kind === 'Pattern') s += 3
    if (d.kind === 'Function' || d.kind === 'Recall') s += 1
    scored.push({ d, s })
  }
  return scored.sort((a, b) => b.s - a.s).map(x => x.d)
}
