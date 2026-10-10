import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { formulas } from '../data/formulas'
import { weekDot, weekOrder, weekSpan, weekText } from '../data/weeks'

const weeks = ['All', ...weekOrder(formulas.map(f => f.week))]
const coverage = weekSpan(formulas.map(f => f.week))

export default function Functions() {
  const [query, setQuery] = useState('')
  const [week, setWeek] = useState('All')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return formulas.filter(f =>
      (week === 'All' || f.week === week) &&
      (!q || f.name.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q) || f.note.toLowerCase().includes(q)),
    )
  }, [query, week])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">Function Bank</h1>
        <p className="text-ink-secondary">
          Every Excel function, formula pattern and VBA snippet taught in {coverage},
          with the real syntax used in the session workbooks and the gotchas that cost marks.
        </p>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          aria-label="Search the function bank"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
          placeholder="Search functions, syntax, notes…"
          className="w-full bg-surface border border-edge rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:border-glow"
        />
      </div>
      <div role="group" aria-label="Filter by week" className="flex flex-wrap gap-1.5 mb-6">
        {weeks.map(w => (
          <button
            key={w}
            onClick={() => setWeek(w)}
            aria-pressed={week === w}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${week === w ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
          >
            {w !== 'All' && <span className={`h-1.5 w-1.5 rounded-full ${weekDot(w)}`} />}
            {w}
          </button>
        ))}
      </div>

      <p role="status" className="sr-only">
        {filtered.length === formulas.length ? '' : `${filtered.length} of ${formulas.length} functions`}
      </p>
      <div className="space-y-3">
        {filtered.map(f => (
          <div key={`${f.week}-${f.name}`} className="bg-surface border border-edge rounded-lg px-5 py-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="font-semibold text-ink">{f.name}</h2>
              <span className={`text-[10px] font-mono uppercase tracking-wider bg-raised px-2 py-0.5 rounded border border-edge flex-shrink-0 ${weekText(f.week)}`}>
                {f.week}
              </span>
            </div>
            <pre className="text-xs font-mono text-ink bg-raised border border-edge rounded-md px-4 py-2.5 overflow-x-auto whitespace-pre-wrap mb-2">
              {f.formula}
            </pre>
            <p className="text-sm text-ink-secondary leading-relaxed">{f.note}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-ink-muted py-12">No functions match your search.</p>
        )}
      </div>
    </div>
  )
}
