import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock, ExternalLink } from 'lucide-react'
import { EXAM_START, studyPlan } from '../data/studyPlan'
import type { StudyStep } from '../data/studyPlan'

const KEY = 'cs602-study-plan-v1'

interface Progress {
  current: number
  done: readonly string[]
  ticks: Readonly<Record<string, readonly number[]>>   // step id -> ticked task indexes
  notes: Readonly<Record<string, string>>
}
const EMPTY: Progress = { current: 0, done: [], ticks: {}, notes: {} }

function load(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Progress> | null
    if (!raw || typeof raw !== 'object') return EMPTY
    const current = Number.isInteger(raw.current) ? Math.min(Math.max(raw.current as number, 0), studyPlan.length - 1) : 0
    return { current, done: Array.isArray(raw.done) ? raw.done : [], ticks: raw.ticks ?? {}, notes: raw.notes ?? {} }
  } catch {
    return EMPTY   // corrupt storage: start fresh rather than crash the page
  }
}

function useProgress() {
  const [p, setP] = useState<Progress>(load)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(p)) }, [p])
  return [p, setP] as const
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`

function Countdown({ p }: { p: Progress }) {
  const now = useNow()
  const left = Math.max(0, (EXAM_START.getTime() - now) / 60_000)
  const todo = studyPlan.filter(s => !p.done.includes(s.id)).reduce((n, s) => n + s.minutes, 0)
  const pct = Math.round((p.done.length / studyPlan.length) * 100)
  return (
    <div className="bg-surface border border-edge rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink"><Clock size={14} className="inline -mt-0.5 mr-1 text-glow" />Exam in <b className="font-mono">{left > 0 ? hm(left) : 'now'}</b></span>
        <span className="text-ink-secondary">Study left: <b className="font-mono">{hm(todo)}</b></span>
        <span className="text-ink-secondary">{p.done.length}/{studyPlan.length} steps done</span>
      </div>
      <div className="mt-3 h-1.5 bg-raised rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Plan progress">
        <div className="h-full bg-glow transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Rail({ p, go }: { p: Progress; go: (i: number) => void }) {
  let lastDay = ''
  return (
    <nav aria-label="Study steps" className="lg:w-64 shrink-0">
      <ol className="space-y-0.5 text-sm">
        {studyPlan.map((s, i) => {
          const dayHead = s.day !== lastDay ? (lastDay = s.day) : null
          const done = p.done.includes(s.id)
          return (
            <li key={s.id}>
              {dayHead && <div className="text-[11px] font-mono uppercase tracking-wide text-ink-muted mt-3 mb-1">{dayHead}</div>}
              <button
                onClick={() => go(i)}
                aria-current={i === p.current ? 'step' : undefined}
                className={`w-full text-left flex gap-2 px-2 py-1.5 rounded ${i === p.current ? 'bg-glow-dim text-glow' : 'text-ink-secondary hover:bg-raised hover:text-ink'}`}
              >
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${done ? 'bg-glow border-glow text-void' : 'border-edge-bright'}`}>
                  {done && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="leading-snug"><span className="font-mono text-[11px] text-ink-muted mr-1">{s.slot.split('-')[0]}</span>{s.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface StepProps { s: StudyStep; p: Progress; setP: (f: (p: Progress) => Progress) => void }

function StepCard({ s, p, setP }: StepProps) {
  const ticks = p.ticks[s.id] ?? []
  const toggle = (i: number) => setP(q => ({
    ...q,
    ticks: { ...q.ticks, [s.id]: ticks.includes(i) ? ticks.filter(t => t !== i) : [...ticks, i] },
  }))
  return (
    <article className="bg-surface border border-edge rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap gap-x-3 text-xs font-mono text-ink-muted mb-2">
        <span>{s.day}</span><span>{s.slot} SGT</span><span>{s.minutes} min</span><span className="text-glow">{s.phase}</span>
      </div>
      <h2 className="text-xl font-bold text-ink mb-2">{s.title}</h2>
      <p className="text-sm text-ink-secondary leading-relaxed mb-5">{s.why}</p>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Do this ({ticks.length}/{s.tasks.length})</h3>
      <ul className="space-y-2 mb-6">
        {s.tasks.map((t, i) => (
          <li key={i}>
            <label className="flex gap-3 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={ticks.includes(i)} onChange={() => toggle(i)} className="mt-1 accent-[var(--color-glow)]" />
              <span className={ticks.includes(i) ? 'line-through text-ink-muted' : ''}>{t}</span>
            </label>
          </li>
        ))}
      </ul>

      {s.links.length > 0 && <>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Open</h3>
        <div className="flex flex-wrap gap-2 mb-6">
          {s.links.map(l => (
            <Link key={l.to} to={l.to} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-raised border border-edge text-xs text-ink-secondary hover:text-glow hover:border-glow/30">
              {l.label} <ExternalLink size={11} />
            </Link>
          ))}
        </div>
      </>}

      {s.recall.length > 0 && <>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Recall check: answer in your head, then reveal</h3>
        <div className="space-y-2 mb-6">
          {s.recall.map(r => (
            <details key={r.q} className="bg-raised border border-edge rounded-md px-4 py-2.5">
              <summary className="cursor-pointer text-sm text-ink">{r.q}</summary>
              <p className="mt-2 text-sm text-glow font-mono whitespace-pre-line leading-relaxed">{r.a}</p>
            </details>
          ))}
        </div>
      </>}

      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2" htmlFor={`notes-${s.id}`}>Your notes (weak spots, scores)</label>
      <textarea
        id={`notes-${s.id}`}
        value={p.notes[s.id] ?? ''}
        onChange={e => { const v = e.target.value; setP(q => ({ ...q, notes: { ...q.notes, [s.id]: v } })) }}
        rows={3}
        className="w-full bg-raised border border-edge rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-glow"
      />
    </article>
  )
}

export default function Study() {
  const [p, setP] = useProgress()
  const s = studyPlan[p.current]
  const go = (i: number) => { setP(q => ({ ...q, current: i })); window.scrollTo(0, 0) }
  const done = p.done.includes(s.id)
  const finish = () => {
    setP(q => ({ ...q, done: done ? q.done.filter(d => d !== s.id) : [...q.done, s.id] }))
    if (!done && p.current < studyPlan.length - 1) go(p.current + 1)
  }
  const firstOpen = studyPlan.findIndex(x => !p.done.includes(x.id))

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-ink mb-2">Exam Study Plan</h1>
      <p className="text-ink-secondary text-sm mb-6">
        A step-by-step plan from now to the final (Tue 10 Nov, 19:00). Steps are ordered by how often each technique was tested.
        Times are suggestions: if you fall behind, skim the steps for weeks you already scored well on. Progress is saved in this browser.
      </p>
      <Countdown p={p} />
      {firstOpen >= 0 && firstOpen !== p.current && (
        <button onClick={() => go(firstOpen)} className="mb-4 text-sm text-glow hover:text-glow-hover">Jump to the first unfinished step →</button>
      )}
      <div className="flex flex-col-reverse lg:flex-row gap-8">
        <Rail p={p} go={go} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-ink-muted mb-2">Step {p.current + 1} of {studyPlan.length}</div>
          <StepCard key={s.id} s={s} p={p} setP={setP} />
          <div className="flex justify-between mt-4">
            <button disabled={p.current === 0} onClick={() => go(p.current - 1)} className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm bg-surface border border-edge text-ink-secondary hover:text-ink disabled:opacity-40">
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={finish} className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium ${done ? 'bg-surface border border-edge text-ink-secondary' : 'bg-glow text-void hover:bg-glow-hover'}`}>
              {done ? 'Mark not done' : p.current === studyPlan.length - 1 ? 'Mark done' : <>Mark done &amp; next <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
