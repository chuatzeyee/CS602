import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Table2, Search, FlaskConical, GraduationCap, ArrowRight, Clock, CircleCheck, X, Sparkles } from 'lucide-react'
import { exercises, EXAM_TECHNIQUES } from '../data/lab'
import { course } from '../data/course'
import { weekText } from '../data/weeks'
import { getExerciseProgress } from '../lab/progress'
import LabErrorBoundary from '../lab/components/LabErrorBoundary'
import type { Exercise, Week } from '../lab/types'

// catalogue only: no engine, sheet or checker imports (keeps the formula engine out of this chunk)

const WEEKS: Week[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W9', 'W10']
const LEVELS: Record<number, string> = { 1: 'Drill', 2: 'Applied', 3: 'Exam-style' }
const weekTopic = (w: string) => course.schedule.find(s => s.week === w)?.topic ?? (w === 'EXAM' ? 'Exam practice' : '')

const pill = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-glow-dim text-glow border-glow/20' : 'bg-surface text-ink-muted border-edge hover:text-ink'}`

interface Progress { solved: number; total: number }

interface Filters { week: string; level: number; technique: string; q: string }
const filtersOf = (p: URLSearchParams): Filters => ({
  week: p.get('week') ?? '', level: Number(p.get('level')) || 0, technique: p.get('technique') ?? '', q: p.get('q') ?? '',
})
function paramsOf(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.week) p.set('week', f.week)
  if (f.level) p.set('level', String(f.level))
  if (f.technique) p.set('technique', f.technique)
  if (f.q) p.set('q', f.q)
  return p
}

function readProgress(list: readonly Exercise[]): Record<string, Progress> {
  const out: Record<string, Progress> = {}
  for (const ex of list) {
    const p = getExerciseProgress(ex.id)
    if (p) out[ex.id] = { solved: p.solved.filter(id => ex.tasks.some(t => t.id === id)).length, total: ex.tasks.length }
  }
  return out
}

function ExerciseCard({ ex, progress }: { ex: Exercise; progress?: Progress }) {
  const total = ex.tasks.length
  const solved = progress?.solved ?? 0
  const done = total > 0 && solved >= total
  const extraSkills = ex.skills.length - 4
  return (
    <Link
      to={`/lab/${ex.id}`}
      className="group flex flex-col bg-surface border border-edge rounded-lg p-5 hover:border-glow/30 hover:bg-raised transition-all duration-200"
    >
      <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-ink-muted">
        <span className="uppercase tracking-wider">L{ex.level} · {LEVELS[ex.level]}</span>
        <span className="flex items-center gap-1"><Clock size={11} /> {ex.minutes} min</span>
        {ex.extension && (
          <span className="flex items-center gap-1 text-s2 bg-raised border border-edge rounded px-1.5 py-px" title="Uses functions beyond this week's syllabus">
            <Sparkles size={10} /> extension
          </span>
        )}
        {done && <CircleCheck size={14} className="ml-auto text-correct" aria-label="All tasks solved" />}
      </div>
      <h3 className="font-semibold text-ink leading-snug group-hover:text-glow transition-colors">{ex.title}</h3>
      <p className="text-sm text-ink-secondary mt-0.5 mb-3">{ex.topic}</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ex.skills.slice(0, 4).map(s => (
          <span key={s} className="text-[11px] text-ink-muted bg-raised border border-edge rounded px-1.5 py-0.5">{s}</span>
        ))}
        {extraSkills > 0 && <span className="text-[11px] text-ink-faint px-1 py-0.5">+{extraSkills}</span>}
      </div>
      <div className="mt-auto flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-raised overflow-hidden" aria-hidden>
          <div className={`h-full rounded-full ${done ? 'bg-correct' : 'bg-glow/60'}`} style={{ width: `${total ? (solved / total) * 100 : 0}%` }} />
        </div>
        <span className="text-[11px] font-mono text-ink-muted" aria-label={`${solved} of ${total} task${total === 1 ? '' : 's'} solved`}>{solved}/{total}</span>
        <ArrowRight size={14} className="text-ink-faint group-hover:text-glow group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

export default function Lab() {
  return (
    <LabErrorBoundary backTo="/" backLabel="Home">
      <LabCatalogue list={exercises} />
    </LabErrorBoundary>
  )
}

export function LabCatalogue({ list }: { list: readonly Exercise[] }) {
  // filters live in state (instant, never stale between quick clicks) and are mirrored to ?week=&level=&technique=&q=
  const [params, setParams] = useSearchParams()
  const urlKey = params.toString()
  const [filters, setFilters] = useState(() => filtersOf(params))
  const latest = useRef({ filters, url: urlKey })
  useEffect(() => {
    if (urlKey === latest.current.url) return   // our own write
    const f = filtersOf(new URLSearchParams(urlKey))   // back button or a link such as /lab?week=W3
    latest.current = { filters: f, url: urlKey }
    setFilters(f)
  }, [urlKey])
  const update = (patch: Partial<Filters>, replace = false) => {
    const next = { ...latest.current.filters, ...patch }
    const p = paramsOf(next)
    latest.current = { filters: next, url: p.toString() }
    setFilters(next)
    setParams(p, { replace })
  }
  const { week, level, technique, q } = filters
  const progress = useMemo(() => readProgress(list), [list])

  const techniques = useMemo(() => {
    const used = new Set(list.flatMap(e => e.techniques ?? []))
    return EXAM_TECHNIQUES.filter(t => used.has(t) || t === technique)
  }, [list, technique])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return list.filter(e =>
      (!week || e.week === week) &&
      (!level || e.level === level) &&
      (!technique || (e.techniques ?? []).includes(technique)) &&
      (!needle || [e.title, e.topic, e.scenario, ...e.skills, ...(e.techniques ?? [])].some(s => s.toLowerCase().includes(needle))),
    )
  }, [list, week, level, technique, q])

  const groups = useMemo(() => {
    const order = [...WEEKS, 'EXAM'] as string[]
    const by = new Map<string, Exercise[]>()
    for (const e of filtered) by.set(e.week, [...(by.get(e.week) ?? []), e])
    return order.filter(w => by.has(w)).map(w => ({ week: w, items: by.get(w)! }))
  }, [filtered])

  const solvedTotal = list.reduce((n, e) => n + (progress[e.id]?.solved ?? 0), 0)
  const taskTotal = list.reduce((n, e) => n + e.tasks.length, 0)
  const filtering = Boolean(week || level || technique || q)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2.5 mb-2">
          <Table2 size={26} className="text-glow" />
          <h1 className="text-3xl font-bold text-ink">Excel Lab</h1>
        </div>
        <p className="text-ink-secondary max-w-3xl leading-relaxed">
          Practise every Excel skill of the course in a real spreadsheet: type formulas, fill them down, run Goal Seek,
          Data Tables, Solver, filters and PivotTables, write small VBA macros, then press <span className="text-ink font-medium">Check</span>.
          Answers are re-tested on hidden inputs, so hard-coded numbers and missing <span className="font-mono text-ink">$</span> signs are caught.
        </p>
        {taskTotal > 0 && (
          <p className="mt-3 text-xs font-mono text-ink-muted">
            {list.length} exercises · <span className="text-correct">{solvedTotal}</span>/{taskTotal} tasks solved on this device
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Link to="/lab/sandbox" className="group flex items-start gap-4 bg-surface border border-edge rounded-lg p-5 hover:border-glow/30 hover:bg-raised transition-all">
          <div className="p-2.5 bg-glow-dim rounded-lg text-glow"><FlaskConical size={22} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-ink flex items-center gap-2">Sandbox <ArrowRight size={15} className="text-ink-faint group-hover:text-glow group-hover:translate-x-0.5 transition-all" /></h2>
            <p className="text-sm text-ink-secondary">A blank 100 × 26 sheet with every tool and the VBA editor. Saved on this device.</p>
          </div>
        </Link>
        <Link to="/exam" className="group flex items-start gap-4 bg-surface border border-edge rounded-lg p-5 hover:border-glow/30 hover:bg-raised transition-all">
          <div className="p-2.5 bg-glow-dim rounded-lg text-glow"><GraduationCap size={22} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-ink flex items-center gap-2">Mock exams <ArrowRight size={15} className="text-ink-faint group-hover:text-glow group-hover:translate-x-0.5 transition-all" /></h2>
            <p className="text-sm text-ink-secondary">Timed, exam-style papers marked like the real thing, with a review afterwards.</p>
          </div>
        </Link>
      </div>

      <div className="space-y-3 mb-8">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={e => update({ q: e.target.value }, true)}
            placeholder="Search exercises, skills, functions…"
            aria-label="Search exercises"
            className="w-full bg-surface border border-edge rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:border-glow/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Week">
          <button type="button" onClick={() => update({ week: '' })} className={pill(!week)} aria-pressed={!week}>All weeks</button>
          {WEEKS.map(w => (
            <button key={w} type="button" onClick={() => update({ week: week === w ? '' : w })} className={pill(week === w)} aria-pressed={week === w}>{w}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Level">
          <button type="button" onClick={() => update({ level: 0 })} className={pill(!level)} aria-pressed={!level}>All levels</button>
          {[1, 2, 3].map(l => (
            <button key={l} type="button" onClick={() => update({ level: level === l ? 0 : l })} className={pill(level === l)} aria-pressed={level === l}>
              {l} · {LEVELS[l]}
            </button>
          ))}
          {techniques.length > 0 && (
            <select
              value={technique}
              onChange={e => update({ technique: e.target.value })}
              aria-label="Exam technique"
              className="ml-auto max-w-full sm:max-w-xs bg-surface border border-edge rounded-full px-3 py-1.5 text-xs text-ink-secondary focus:outline-none focus:border-glow/40"
            >
              <option value="">Any exam technique</option>
              {techniques.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        {technique && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-muted">Technique:</span>
            <span className="inline-flex items-center gap-1.5 bg-glow-dim text-glow border border-glow/20 rounded-full pl-3 pr-1.5 py-1">
              {technique}
              <button type="button" onClick={() => update({ technique: '' })} aria-label="Clear technique filter" className="p-0.5 rounded-full hover:bg-glow/15"><X size={12} /></button>
            </span>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge rounded-lg">
          {list.length === 0 ? (
            <p className="text-ink-muted">Exercises are on their way. The sandbox is ready now.</p>
          ) : (
            <>
              <p className="text-ink-muted mb-4">No exercises match these filters.</p>
              {filtering && (
                <button type="button" onClick={() => update({ week: '', level: 0, technique: '', q: '' })} className="px-4 py-2 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15">
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(g => {
            const solved = g.items.reduce((n, e) => n + (progress[e.id]?.solved ?? 0), 0)
            const total = g.items.reduce((n, e) => n + e.tasks.length, 0)
            return (
              <section key={g.week} aria-labelledby={`wk-${g.week}`}>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <h2 id={`wk-${g.week}`} className={`text-xl font-bold ${weekText(g.week, 'text-s4')}`}>
                    {g.week === 'EXAM' ? 'Exam practice' : g.week} <span className="text-ink-secondary font-semibold text-base">{g.week === 'EXAM' ? '' : `· ${weekTopic(g.week)}`}</span>
                  </h2>
                  <span className="text-xs font-mono text-ink-muted flex-shrink-0">{solved}/{total} tasks</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.items.map(e => <ExerciseCard key={e.id} ex={e} progress={progress[e.id]} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
