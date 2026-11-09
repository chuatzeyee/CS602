import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, ArrowRight } from 'lucide-react'
import { DOC_KINDS, search, searchDocs, terms } from '../data/searchIndex'
import type { DocKind, SearchDoc } from '../data/searchIndex'
import { weekText } from '../data/weeks'
import { OFFLINE, routeAvailable } from '../offline'

const PAGE = 40
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Marked({ text, ts }: { text: string; ts: string[] }) {
  if (ts.length === 0) return <>{text}</>
  const re = new RegExp(`(${ts.map(escapeRe).join('|')})`, 'gi')
  return <>{text.split(re).map((part, i) => (i % 2 ? <span key={i} className="highlight-match">{part}</span> : part))}</>
}

function Result({ d, ts }: { d: SearchDoc; ts: string[] }) {
  return (
    <li className="bg-surface border border-edge rounded-lg">
      <details>
        <summary className="cursor-pointer list-none px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-mono mb-1">
            <span className="px-1.5 py-0.5 rounded bg-raised text-ink-secondary">{d.kind}</span>
            {d.week && <span className={weekText(d.week)}>{d.week}</span>}
          </div>
          <div className="text-sm font-medium text-ink"><Marked text={d.title} ts={ts} /></div>
          {d.code && <pre className="mt-2 font-mono text-xs text-glow whitespace-pre-wrap break-all"><Marked text={d.code} ts={ts} /></pre>}
          <p className="mt-1 text-xs text-ink-muted line-clamp-2"><Marked text={d.body} ts={ts} /></p>
        </summary>
        <div className="px-4 pb-4 border-t border-edge pt-3">
          <p className="text-sm text-ink-secondary whitespace-pre-line leading-relaxed"><Marked text={d.body} ts={ts} /></p>
          {routeAvailable(d.to) && (
            <Link to={d.to} className="inline-flex items-center gap-1 mt-3 text-xs text-glow hover:text-glow-hover">
              Open in context <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </details>
    </li>
  )
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [kind, setKind] = useState<DocKind | ''>('')
  const [limit, setLimit] = useState(PAGE)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])
  // a new ?q= from a link or the Ctrl+K shortcut replaces the box
  const urlQ = params.get('q') ?? ''
  useEffect(() => { setQuery(urlQ) }, [urlQ])

  const ts = useMemo(() => terms(query), [query])
  const all = useMemo(() => search(query), [query])
  const counts = useMemo(() => {
    const c = new Map<DocKind, number>()
    for (const d of all) c.set(d.kind, (c.get(d.kind) ?? 0) + 1)
    return c
  }, [all])
  const shown = kind ? all.filter(d => d.kind === kind) : all

  const onChange = (v: string) => {
    setQuery(v)
    setLimit(PAGE)
    setParams(v ? { q: v } : {}, { replace: true })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <h1 className="text-3xl font-bold text-ink mb-2">Search</h1>
      {OFFLINE ? (
        <p className="text-ink-secondary mb-6 text-sm">{searchDocs.length.toLocaleString()} entries. Ctrl K or / jumps here from any page.</p>
      ) : (
      <p className="text-ink-secondary mb-6 text-sm">
        {searchDocs.length.toLocaleString()} entries: notes, glossary, functions, model steps, lab solutions, exam tips, quiz explanations.
        Works offline. Press <kbd className="font-mono text-xs px-1 border border-edge rounded">Ctrl K</kbd> or <kbd className="font-mono text-xs px-1 border border-edge rounded">/</kbd> anywhere to jump here.
      </p>
      )}
      <div className="relative mb-4">
        <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          ref={input}
          type="search"
          aria-label="Search everything"
          value={query}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
          placeholder="e.g. CRITBINOM, NPV timing, LARGE server, advanced filter or"
          className="w-full bg-surface border border-edge rounded-lg pl-10 pr-4 py-3 text-base text-ink focus:outline-none focus:border-glow"
        />
      </div>
      {query && (
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2 mb-6">
          {(['', ...DOC_KINDS] as const).map(k => (
            <button
              key={k || 'all'}
              onClick={() => { setKind(k); setLimit(PAGE) }}
              aria-pressed={kind === k}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${kind === k ? 'bg-glow-dim text-glow border-glow/20' : 'bg-surface text-ink-muted border-edge hover:text-ink'}`}
            >
              {k || 'All'} {k ? counts.get(k) ?? 0 : all.length}
            </button>
          ))}
        </div>
      )}
      {query && shown.length === 0 && <p className="text-sm text-ink-muted">No matches. Try fewer or shorter words; every word must appear.</p>}
      <ul className="space-y-2">
        {shown.slice(0, limit).map((d, i) => <Result key={`${d.kind}-${i}-${d.title}`} d={d} ts={ts} />)}
      </ul>
      {shown.length > limit && (
        <button onClick={() => setLimit(l => l + PAGE)} className="mt-4 text-sm text-glow hover:text-glow-hover">
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  )
}
