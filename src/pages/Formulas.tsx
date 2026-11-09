import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search as SearchIcon } from 'lucide-react'
import { BANK_SOURCES, formulaBank, queryTerms, searchBank } from '../data/formulaBank'
import type { BankEntry, BankSource } from '../data/formulaBank'
import Marked from '../components/Marked'
import { routeAvailable } from '../offline'
import { spot } from '../data/patterns'

const PAGE = 30

function Entry({ e, ts }: { e: BankEntry; ts: readonly string[] }) {
  return (
    <li className="bg-surface border border-edge rounded-lg px-4 py-3">
      <p className="font-mono text-[11px] text-ink-muted mb-1"><Marked text={`${e.source}: ${e.label}`} ts={ts} /></p>
      <p className="text-sm text-ink leading-relaxed"><Marked text={e.task} ts={ts} /></p>
      <div className="mt-2 space-y-1.5">
        {e.lines.map((l, i) => (
          <div key={i}>
            <pre className="font-mono text-[13px] text-glow bg-raised border border-edge rounded px-3 py-1.5 whitespace-pre-wrap break-all"><Marked text={l.code} ts={ts} /></pre>
            {l.note && <p className="text-xs text-ink-muted mt-0.5">{l.note}</p>}
          </div>
        ))}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-glow">Steps, context and pitfalls</summary>
        <div className="mt-2 space-y-2 text-sm text-ink-secondary leading-relaxed">
          {e.steps.length > 0 && <ol className="list-decimal pl-5 space-y-1">{e.steps.map((s, i) => <li key={i}><Marked text={s} ts={ts} /></li>)}</ol>}
          {e.answer && <p><span className="text-ink-muted">Answer / why: </span><Marked text={e.answer} ts={ts} /></p>}
          {e.pitfalls.length > 0 && <ul className="list-disc pl-5 space-y-1">{e.pitfalls.map((s, i) => <li key={i}><Marked text={s} ts={ts} /></li>)}</ul>}
          {e.context && <p className="text-xs text-ink-muted"><span>Context: </span><Marked text={e.context} ts={ts} /></p>}
          {e.to && routeAvailable(e.to) && (
            <Link to={e.to} className="inline-flex items-center gap-1 text-xs text-glow hover:text-glow-hover">{e.source === 'Reference' ? 'Open' : 'Full worked question'} <ArrowRight size={12} /></Link>
          )}
        </div>
      </details>
    </li>
  )
}

export default function Formulas() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [source, setSource] = useState<BankSource | ''>('')
  const [limit, setLimit] = useState(PAGE)
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  // a new ?q= from a search result link replaces the box
  const urlQ = params.get('q') ?? ''
  useEffect(() => { setQuery(urlQ) }, [urlQ])

  const ts = useMemo(() => queryTerms(query), [query])
  const results = useMemo(() => searchBank(query, formulaBank, source || undefined), [query, source])
  const spotted = useMemo(() => spot(query).slice(0, 2), [query])
  const onChange = (v: string) => {
    setQuery(v)
    setLimit(PAGE)
    setParams(v ? { q: v } : {}, { replace: true })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold text-ink mb-2">Formula Bank</h1>
      <p className="text-ink-secondary text-sm mb-5">
        {formulaBank.length} question parts with their answer formulas: every past-paper part (in our own words), likely exam questions for every pattern, the mock exams, the lab and the course's reference formulas. Type key words or paste the whole question: the closest parts come first, ranked by how many (and how rare) of your words they share.
      </p>
      <div className="relative mb-3">
        <SearchIcon size={16} className="absolute left-3.5 top-3.5 text-ink-muted" />
        <textarea
          ref={input}
          aria-label="Search the formula bank"
          value={query}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
          rows={query.length > 80 ? 4 : 1}
          placeholder="e.g. Friday coupon at least $50 five items, or paste the exam question"
          className="w-full bg-surface border border-edge rounded-lg pl-10 pr-4 py-2.5 text-base text-ink focus:outline-none focus:border-glow resize-y"
        />
      </div>
      <div role="group" aria-label="Filter by source" className="flex flex-wrap gap-2 mb-5">
        {(['', ...BANK_SOURCES] as const).map(k => (
          <button
            key={k || 'all'}
            onClick={() => { setSource(k); setLimit(PAGE) }}
            aria-pressed={source === k}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${source === k ? 'bg-glow-dim text-glow border-glow/20' : 'bg-surface text-ink-muted border-edge hover:text-ink'}`}
          >
            {k || 'All'}
          </button>
        ))}
        <span className="text-xs text-ink-muted self-center ml-1">{results.length} match{results.length === 1 ? '' : 'es'}{query.trim() ? ', best first' : ''}</span>
      </div>
      {spotted.length > 0 && (
        <p className="mb-4 text-sm text-ink-secondary">
          Looks like:{' '}
          {spotted.map((h, i) => (
            <span key={h.pattern.id}>{i > 0 && ' or '}<Link to={`/bank?p=${h.pattern.id}`} className="text-glow hover:text-glow-hover">{h.pattern.title}</Link></span>
          ))}
          <span className="text-ink-muted"> (steps and pitfalls in the Q Bank)</span>
        </p>
      )}
      {results.length === 0 && <p className="text-sm text-ink-muted">No match. Try fewer, more specific words (function names, "per hour", "at least").</p>}
      <ul className="space-y-3">
        {results.slice(0, limit).map(e => <Entry key={e.id} e={e} ts={ts} />)}
      </ul>
      {results.length > limit && (
        <button onClick={() => setLimit(l => l + PAGE)} className="mt-4 text-sm text-glow hover:text-glow-hover">Show more ({results.length - limit} left)</button>
      )}
    </div>
  )
}
