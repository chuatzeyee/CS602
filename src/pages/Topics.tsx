import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Search, BookOpen, ListFilter } from 'lucide-react'
import { sessions } from '../data/topics'
import { definitions } from '../data/definitions'
import { weekDot, weekOrder, weekSpan, weekText } from '../data/weeks'
import type { Topic } from '../data/types'

function highlight(text: string, q: string) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <span className="highlight-match">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  )
}

function TopicCard({ topic, color }: { topic: Topic; color: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-surface border border-edge rounded-lg overflow-hidden">
      <h3>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-raised transition-colors focus-visible:-outline-offset-2"
        >
          <span className={`font-semibold ${open ? 'text-ink' : 'text-ink-secondary'}`}>{topic.title}</span>
          <ChevronDown size={18} className={`text-ink-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      {open && (
        <div className="px-5 pb-5 animate-fade-in space-y-4">
          {topic.sections.map(s => (
            <div key={s.heading}>
              <h4 className={`text-sm font-semibold mb-2 ${color}`}>{s.heading}</h4>
              <ul className="space-y-2">
                {s.points.map((p, i) => (
                  <li key={i} className="text-sm text-ink flex gap-2.5 leading-relaxed">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${color} bg-current opacity-70`} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const weeks = ['All', ...sessions.map(s => s.id.toUpperCase())]
const sources = ['All', ...weekOrder(definitions.map(d => d.source))]
const coverage = weekSpan(sessions.map(s => s.id))

function WeekChips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (w: string) => void }) {
  return (
    <div role="group" aria-label="Filter by week" className="flex flex-wrap gap-1.5 mb-6">
      {options.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${value === c ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
        >
          {c !== 'All' && <span className={`h-1.5 w-1.5 rounded-full ${weekDot(c)}`} />}
          {c}
        </button>
      ))}
    </div>
  )
}

export default function Topics() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'glossary' ? 'glossary' : 'topics'
  const [query, setQuery] = useState('')
  const [week, setWeek] = useState('All')

  const filteredDefs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return definitions.filter(d =>
      (week === 'All' || d.source === week) &&
      (!q || d.term.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q)),
    )
  }, [query, week])
  const shownSessions = week === 'All' ? sessions : sessions.filter(s => s.id.toUpperCase() === week)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">Topics & Glossary</h1>
        <p className="text-ink-secondary">Session notes for {coverage}, week by week, plus every term you need.</p>
      </div>

      <div role="group" aria-label="View" className="flex gap-2 mb-8">
        <button
          onClick={() => setParams({})}
          aria-pressed={view === 'topics'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === 'topics' ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
        >
          <BookOpen size={15} /> Topics
        </button>
        <button
          onClick={() => setParams({ view: 'glossary' })}
          aria-pressed={view === 'glossary'}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === 'glossary' ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
        >
          <ListFilter size={15} /> Glossary ({definitions.length})
        </button>
      </div>

      {view === 'topics' ? (
        <div>
          <WeekChips options={weeks} value={week} onChange={setWeek} />
          <div className="space-y-10">
            {shownSessions.map(s => (
              <section key={s.id}>
                <div className="mb-4">
                  <h2 className={`text-xl font-bold ${weekText(s.id)}`}>
                    {s.title}
                  </h2>
                  {s.subtitle && <p className="text-sm text-ink-muted mt-1">{s.subtitle}</p>}
                </div>
                <div className="space-y-3">
                  {s.topics.map(t => (
                    <TopicCard key={t.id} topic={t} color={weekText(s.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              aria-label="Search the glossary"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
              placeholder="Search terms and definitions…"
              className="w-full bg-surface border border-edge rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:border-glow"
            />
          </div>
          <WeekChips options={sources} value={week} onChange={setWeek} />
          <p role="status" className="sr-only">
            {filteredDefs.length === definitions.length ? '' : `${filteredDefs.length} of ${definitions.length} terms`}
          </p>
          <div className="space-y-3">
            {filteredDefs.map(d => (
              <div key={d.term} className="bg-surface border border-edge rounded-lg px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h2 className="font-semibold text-ink">{highlight(d.term, query)}</h2>
                  <span className={`text-[10px] font-mono uppercase tracking-wider bg-raised px-2 py-0.5 rounded border border-edge flex-shrink-0 ${weekText(d.source)}`}>{d.source}</span>
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed">{highlight(d.definition, query)}</p>
                {d.example && (
                  <p className="text-xs text-ink-muted leading-relaxed mt-2">
                    <span className="text-glow font-mono">e.g.</span> {d.example}
                  </p>
                )}
              </div>
            ))}
            {filteredDefs.length === 0 && (
              <p className="text-center text-ink-muted py-12">No terms match your search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
