import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PATTERN_GROUPS, patterns, spot } from '../data/patterns'
import { worked, workedById } from '../data/worked'
import PatternCard from '../components/PatternCard'
import WorkedQuestion from '../components/WorkedQuestion'

const SPOT_SHOWN = 4

function Spotter() {
  const [text, setText] = useState('')
  const hits = useMemo(() => spot(text), [text])
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-ink mb-1">Spot the question</h2>
      <p className="text-sm text-ink-secondary mb-3">Paste or type the exam part (or just its key words). The closest patterns open below with steps and formulas.</p>
      <textarea
        aria-label="Question text"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder="e.g. Customers arrive with exponential inter-arrival times (mean 4 minutes) and are served by two counters. Find the percentage who wait more than 5 minutes."
        className="w-full bg-surface border border-edge rounded-lg px-4 py-3 text-sm text-ink focus:outline-none focus:border-glow"
      />
      {text.trim() && (
        hits.length === 0
          ? <p className="text-sm text-ink-muted mt-2">No pattern matched. Try the key nouns and verbs (maximise, normally distributed, queue, loan, band).</p>
          : <div className="space-y-2 mt-3">{hits.slice(0, SPOT_SHOWN).map((h, i) => <PatternCard key={h.pattern.id} p={h.pattern} open={i === 0} matched={h.matched} />)}</div>
      )}
    </section>
  )
}

function Questions() {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? worked.filter(w => [w.source, w.ex.title, w.ex.topic, w.ex.scenario, ...(w.ex.techniques ?? []), ...w.ex.skills].some(s => s.toLowerCase().includes(n))) : worked
  }, [q])
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-1">Worked questions ({worked.length})</h2>
      <p className="text-sm text-ink-secondary mb-3">Every mock-exam and lab question with its steps, answer formulas and explanations. Mock exams first.</p>
      <input
        type="search"
        aria-label="Filter worked questions"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Filter: queue, Solver, W5, Mock Exam B, CRITBINOM"
        className="w-full bg-surface border border-edge rounded-lg px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-glow mb-3"
      />
      <ul className="divide-y divide-edge border border-edge rounded-lg bg-surface">
        {shown.map(w => (
          <li key={w.ex.id}>
            <Link to={`/bank/q/${w.ex.id}`} className="flex gap-3 px-4 py-2.5 hover:bg-raised">
              <span className="font-mono text-[11px] text-ink-muted w-28 shrink-0 pt-0.5">{w.source}</span>
              <span className="text-sm text-ink">{w.ex.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BankQuestion() {
  const { id = '' } = useParams()
  const w = workedById(id)
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <Link to="/bank" className="inline-flex items-center gap-1 text-sm text-glow hover:text-glow-hover mb-6"><ArrowLeft size={14} /> Question Bank</Link>
      {w ? <WorkedQuestion w={w} /> : <h1 className="text-2xl font-bold text-ink">Question not found</h1>}
    </div>
  )
}

export default function Bank() {
  const [params] = useSearchParams()
  const focus = params.get('p') ?? ''
  useEffect(() => {
    if (focus) document.getElementById(`pattern-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus])
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold text-ink mb-2">Question Bank</h1>
      <p className="text-ink-secondary text-sm mb-8">
        Recognise the type of question, then follow its steps and formulas. {patterns.length} patterns from the past papers and course, and {worked.length} worked questions.
      </p>
      <Spotter />
      <section className="mb-10">
        <h2 className="text-lg font-bold text-ink mb-3">All patterns</h2>
        {PATTERN_GROUPS.map(g => (
          <div key={g} className="mb-6">
            <h3 className="text-xs font-mono uppercase tracking-wide text-ink-muted mb-2">{g}</h3>
            <div className="space-y-2">
              {patterns.filter(p => p.group === g).map(p => <PatternCard key={p.id} p={p} open={p.id === focus} anchor />)}
            </div>
          </div>
        ))}
      </section>
      <Questions />
    </div>
  )
}
