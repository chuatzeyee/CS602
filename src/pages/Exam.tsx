import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Anchor, ArrowRight, ChartBar, ChevronDown, CirclePlay, ClipboardList, FileText, GraduationCap, Hourglass,
  Info, ListChecks, RotateCcw, Ruler, Square, SquareCheck, Target, Timer, TriangleAlert, Trophy, Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exam } from '../data/exam'
import type { PaperSummary, QuestionSummary, TechniqueCount } from '../data/exam'
import { exercises, mocks } from '../data/lab'
import { getMockBest } from '../lab/progress'

const CHECKLIST_KEY = 'cs602-exam-checklist'
const TOP_TECHNIQUES = 12
const PAPER_COUNT = exam.papers.length

const sections = [
  ['glance', 'At a glance'],
  ['marking', 'Marking'],
  ['time', 'Time plan'],
  ['strategy', 'Strategy'],
  ['techniques', 'Techniques'],
  ['papers', 'Past papers'],
  ['quizzes', 'Quiz patterns'],
  ['mocks', 'Mock exams'],
] as const

// lab exercises per exam technique (exact names, see src/data/lab/techniques.ts)
const drillCounts = new Map(
  exam.techniqueFrequency.map(t => [t.technique, exercises.filter(e => e.techniques?.includes(t.technique)).length]),
)

const shortName = (technique: string) => technique.replace(/\s*\(.*\)\s*$/, '')
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function loadTicks(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []   // storage disabled or corrupt entry: start empty
  }
}

function useTicks(key: string) {
  const [ticks, setTicks] = useState<ReadonlySet<string>>(() => new Set(loadTicks(key)))
  const commit = (next: ReadonlySet<string>) => {
    setTicks(next)
    try {
      localStorage.setItem(key, JSON.stringify([...next]))
    } catch {
      // private mode / quota: ticks just aren't kept
    }
  }
  const toggle = (id: string) => {
    const next = new Set(ticks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    commit(next)
  }
  return { ticks, toggle, reset: () => commit(new Set()) }
}

function Section({ id, icon: Icon, title, intro, children }: {
  id: string
  icon: LucideIcon
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 mb-14">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-glow flex-shrink-0" />
        <h2 tabIndex={-1} className="text-xl font-bold text-ink outline-none">{title}</h2>
      </div>
      {intro && <p className="text-sm text-ink-secondary leading-relaxed mb-5 max-w-2xl">{intro}</p>}
      {!intro && <div className="mb-4" />}
      {children}
    </section>
  )
}

// scroll to the section and move focus to its heading, so Tab carries on inside the section
function jumpTo(id: string) {
  const section = document.getElementById(id)
  if (!section) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
}

function JumpNav() {
  return (
    // pt-1 / sm:px-1: room inside the scroll strip for the 4px focus ring
    <nav aria-label="On this page" className="flex gap-1.5 overflow-x-auto -mt-1 pt-1 pb-2 mb-10 -mx-4 px-4 sm:-mx-1 sm:px-1 sm:flex-wrap">
      {sections.map(([id, label]) => (
        <button
          key={id}
          onClick={() => jumpTo(id)}
          className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-surface text-ink-muted border border-edge hover:text-ink hover:border-edge-bright transition-colors"
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

function Glance() {
  return (
    <Section id="glance" icon={GraduationCap} title="Exam at a glance" intro={exam.questions}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {exam.glance.map(g => (
          <div key={g.label} className="bg-surface border border-edge rounded-lg px-4 py-3.5">
            <p className="text-xs text-ink-muted">{g.label}</p>
            <p className="text-2xl font-semibold text-ink mt-1 leading-tight">{g.value}</p>
            <p className="text-xs text-ink-secondary mt-1 leading-snug">{g.note}</p>
          </div>
        ))}
      </div>
      <ul className="space-y-2 mb-3">
        {exam.rules.map(r => (
          <li key={r} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed bg-surface border border-edge rounded-lg px-4 py-3">
            <span className="text-glow flex-shrink-0">→</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted flex gap-1.5 leading-relaxed">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        {exam.verified}
      </p>
    </Section>
  )
}

const markIcons: readonly LucideIcon[] = [Target, Check, Anchor, Ruler]

function Marking() {
  return (
    <Section id="marking" icon={ClipboardList} title="How it is marked" intro={exam.grading}>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {exam.marking.map((m, i) => {
          const Icon = markIcons[i % markIcons.length]
          return (
            <div key={m.title} className="bg-surface border border-edge rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1.5 bg-glow-dim rounded-md text-glow"><Icon size={15} /></span>
                <h3 className="font-semibold text-ink">{m.title}</h3>
              </div>
              <p className="text-sm text-ink-secondary leading-relaxed">{m.detail}</p>
            </div>
          )
        })}
      </div>
      <h3 className="text-sm font-semibold text-ink mb-2">Template habits from past keys</h3>
      <ul className="space-y-2">
        {exam.templateNotes.map(n => (
          <li key={n} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-glow/70 flex-shrink-0" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function TimePlan() {
  const total = exam.timePlan[exam.timePlan.length - 1].to
  const last = exam.timePlan.length - 1
  const summary = exam.timePlan.map(b => `${b.label} ${b.from}-${b.to} min`).join(', ')
  return (
    <Section id="time" icon={Timer} title="A 120-minute plan" intro="Two blocks of about 55 minutes, with 5 minutes to read at the start and 5 to check at the end.">
      <div role="img" aria-label={`Time plan: ${summary}`} className="flex gap-0.5 h-9">
        {exam.timePlan.map((b, i) => (
          <div
            key={b.label}
            title={`${b.label}: minute ${b.from} to ${b.to}`}
            style={{ width: `${((b.to - b.from) / total) * 100}%` }}
            className={`h-full flex items-center justify-center text-xs font-semibold ${b.focus ? 'bg-glow text-void' : 'bg-ink-muted'} ${i === 0 ? 'rounded-l' : ''} ${i === last ? 'rounded-r' : ''}`}
          >
            {b.focus && (
              <span className="whitespace-nowrap px-2">
                <span className="hidden sm:inline">{b.label} · </span>
                {b.to - b.from} min
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="relative h-5 mt-1 text-[11px] text-ink-muted font-mono tabular-nums" aria-hidden="true">
        <span className="absolute left-0">0</span>
        <span className="absolute left-1/2 -translate-x-1/2">60</span>
        <span className="absolute right-0">120 min</span>
      </div>
      <ol className="mt-3 space-y-2">
        {exam.timePlan.map(b => (
          <li key={b.label} className="flex gap-3 bg-surface border border-edge rounded-lg px-4 py-3">
            <span className={`mt-1.5 h-2.5 w-2.5 rounded-sm flex-shrink-0 ${b.focus ? 'bg-glow' : 'bg-ink-muted'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{b.label}</span>
                <span className="font-mono text-xs text-ink-muted tabular-nums flex-shrink-0">{b.from}–{b.to} min</span>
              </div>
              <p className="text-sm text-ink-secondary leading-relaxed mt-0.5">{b.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <ul className="mt-4 space-y-2">
        {exam.timeTips.map(t => (
          <li key={t} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed">
            <span className="text-glow flex-shrink-0">→</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="flex-1 max-w-xs h-1.5 rounded-full bg-glow-dim/40 overflow-hidden" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-glow transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Strategy() {
  const { ticks, toggle, reset } = useTicks(CHECKLIST_KEY)
  const done = exam.strategy.filter(s => ticks.has(s.id)).length
  const total = exam.strategy.length
  return (
    <Section id="strategy" icon={ListChecks} title="Strategy checklist" intro="Tick each habit once you have practised it under time pressure. Ticks are saved in this browser only.">
      <div className="flex items-center gap-3 mb-4">
        <Meter value={done} max={total} label="Strategy habits practised" />
        <span className="font-mono text-xs text-ink-secondary tabular-nums" data-testid="exam-checklist-count">{done}/{total} ready</span>
        <button
          onClick={reset}
          disabled={done === 0}
          className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted transition-colors"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
      <ul className="space-y-2">
        {exam.strategy.map(s => {
          const on = ticks.has(s.id)
          return (
            <li key={s.id}>
              <label className={`relative flex gap-3 items-start rounded-lg border px-4 py-3 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-glow ${on ? 'bg-glow-dim/25 border-glow/20' : 'bg-surface border-edge hover:border-edge-bright'}`}>
                {/* transparent, row-sized: Tab scrolls the whole row clear of the nav pill */}
                <input type="checkbox" className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" checked={on} onChange={() => toggle(s.id)} data-strategy={s.id} />
                {on
                  ? <SquareCheck size={18} className="text-glow flex-shrink-0 mt-0.5" />
                  : <Square size={18} className="text-ink-muted flex-shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${on ? 'text-ink-secondary' : 'text-ink'}`}>{s.title}</span>
                  <span className="block text-sm text-ink-secondary leading-relaxed mt-0.5">{s.detail}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function TechniqueRow({ t, max }: { t: TechniqueCount; max: number }) {
  const { technique, count, papers } = t
  const drills = drillCounts.get(technique) ?? 0
  return (
    <li className="py-3 border-t border-edge first:border-t-0" title={`${plural(count, 'sub-part')} across ${papers} of ${PAPER_COUNT} papers`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-ink leading-snug">{technique}</span>
        {drills > 0 ? (
          <Link
            to={`/lab?technique=${encodeURIComponent(technique)}`}
            className="flex items-center gap-1 text-xs font-medium text-glow hover:text-glow-hover whitespace-nowrap flex-shrink-0"
          >
            {plural(drills, 'drill')} <ArrowRight size={12} />
          </Link>
        ) : (
          <span className="text-xs text-ink-muted whitespace-nowrap flex-shrink-0">drills coming</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-2">
          <div className="h-2 rounded-r bg-glow" style={{ width: `${(count / max) * 100}%` }} />
        </div>
        <span className="font-mono text-xs text-ink-secondary tabular-nums w-14 text-right">{plural(count, 'part')}</span>
        <span role="img" className="flex gap-1" aria-label={`in ${papers} of ${PAPER_COUNT} papers`}>
          {Array.from({ length: PAPER_COUNT }, (_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i < papers ? 'bg-ink-secondary' : 'border border-edge-bright'}`} />
          ))}
        </span>
      </div>
    </li>
  )
}

function Techniques() {
  const [showAll, setShowAll] = useState(false)
  const list = exam.techniqueFrequency
  const max = Math.max(...list.map(t => t.count))
  const shown = showAll ? list : list.slice(0, TOP_TECHNIQUES)
  return (
    <Section
      id="techniques"
      icon={ChartBar}
      title="What the past papers tested"
      intro={`Ranked by how many sub-parts needed each technique across the ${PAPER_COUNT} papers; the dots show how many papers used it. Each link opens the matching Excel Lab drills.`}
    >
      <ul className="bg-surface border border-edge rounded-lg px-5 py-1">
        {shown.map(t => <TechniqueRow key={t.technique} t={t} max={max} />)}
      </ul>
      {list.length > TOP_TECHNIQUES && (
        <button
          onClick={() => setShowAll(s => !s)}
          aria-expanded={showAll}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? `Show the top ${TOP_TECHNIQUES}` : `Show all ${list.length} techniques`}
        </button>
      )}
    </Section>
  )
}

function QuestionBlock({ q }: { q: QuestionSummary }) {
  const kind = q.kind === 'model'
    ? { label: 'Model + optimise', cls: 'text-s3 border-s3/30 bg-s3/10' }
    : { label: 'Simulation', cls: 'text-s2 border-s2/30 bg-s2/10' }
  return (
    <div className="pt-5 mt-5 border-t border-edge first:pt-0 first:mt-0 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${kind.cls}`}>{kind.label}</span>
        <span className="font-mono text-xs text-ink-muted">{q.id.toUpperCase()} · {plural(q.marks, 'mark')}</span>
      </div>
      <h4 className="font-semibold text-ink leading-snug">{q.title}</h4>
      <p className="text-sm text-ink-secondary leading-relaxed mt-1.5">{q.modelled}</p>
      <ol className="mt-3 rounded-md border border-edge overflow-hidden">
        {q.parts.map(p => (
          <li key={p.label} className="flex gap-3 px-3 py-2.5 bg-raised/40 border-t border-edge first:border-t-0">
            <span className="font-mono text-xs text-glow w-4 flex-shrink-0 mt-0.5">{p.label}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink leading-snug">{p.focus}</span>
                <span className="font-mono text-[11px] text-ink-muted whitespace-nowrap tabular-nums">{p.marks} mk</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.techniques.map(t => (
                  <span key={t} title={t} className="text-[11px] text-ink-secondary bg-raised border border-edge rounded px-1.5 py-0.5">{shortName(t)}</span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1.5">
        {q.watch.map(w => (
          <li key={w} className="text-sm text-ink-secondary flex gap-2 leading-relaxed">
            <TriangleAlert size={14} className="text-s4 flex-shrink-0 mt-1" aria-hidden="true" />
            <span><span className="sr-only">Watch out: </span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PaperCard({ paper, defaultOpen }: { paper: PaperSummary; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const split = paper.questions.map(q => `${q.id.toUpperCase()} ${q.marks}`).join(' · ')
  return (
    <div className="bg-surface border border-edge rounded-lg overflow-hidden">
      <h3>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-raised transition-colors focus-visible:-outline-offset-2"
        >
          <span className="min-w-0">
            <span className={`block font-semibold ${open ? 'text-ink' : 'text-ink-secondary'}`}>{paper.title}</span>
            <span className="block text-xs text-ink-muted mt-0.5">{paper.sitting} · {split}</span>
          </span>
          <ChevronDown size={18} className={`text-ink-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      {open && (
        <div className="px-5 pb-5 animate-fade-in">
          {paper.questions.map(q => <QuestionBlock key={q.id} q={q} />)}
        </div>
      )}
    </div>
  )
}

function Papers() {
  return (
    <Section id="papers" icon={FileText} title="Past papers, question by question">
      <div className="flex gap-2.5 text-sm text-ink-secondary leading-relaxed bg-raised border border-edge rounded-lg px-4 py-3 mb-4">
        <Info size={16} className="text-glow flex-shrink-0 mt-0.5" />
        <p>{exam.sourceNote}</p>
      </div>
      <div className="space-y-3">
        {exam.papers.map((p, i) => <PaperCard key={p.id} paper={p} defaultOpen={i === 0} />)}
      </div>
    </Section>
  )
}

function Quizzes() {
  return (
    <Section id="quizzes" icon={ListChecks} title="Patterns from the online quizzes" intro="What the quiz solution workbooks keep coming back to. Each one is also fair game inside an exam question.">
      <div className="grid gap-3 md:grid-cols-3">
        {exam.quizPatterns.map(q => (
          <div key={q.quiz} className="bg-surface border border-edge rounded-lg px-5 py-4">
            <h3 className="font-semibold text-ink leading-snug">{q.quiz}</h3>
            <p className="text-xs text-ink-muted font-mono mt-0.5 mb-3">{q.week}</p>
            <ul className="space-y-2">
              {q.patterns.map(p => (
                <li key={p} className="text-sm text-ink-secondary flex gap-2 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-glow/70 flex-shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function MockList() {
  if (mocks.length === 0) {
    return (
      <div className="bg-surface border border-dashed border-edge-bright rounded-lg px-5 py-6 text-center">
        <Hourglass size={22} className="text-glow mx-auto mb-2" />
        <h3 className="font-semibold text-ink">Mock exams are being prepared</h3>
        <p className="text-sm text-ink-secondary leading-relaxed mt-1 max-w-md mx-auto">
          Full two-hour mocks built on the past papers' technique mix are on the way. Until then, drill the top techniques in the Excel Lab.
        </p>
        <Link
          to="/lab"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15 transition-colors"
        >
          Open the Excel Lab <ArrowRight size={14} />
        </Link>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {mocks.map(m => {
        const marks = m.questions.reduce((sum, q) => sum + q.marks, 0)
        const best = getMockBest(m.id)
        return (
          <div key={m.id} className="bg-surface border border-edge rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-ink leading-snug">{m.title}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed mt-1">{m.basedOn}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-ink-muted">
                <span className="flex items-center gap-1"><Timer size={13} /> {m.minutes} min</span>
                <span className="flex items-center gap-1"><Target size={13} /> {plural(marks, 'mark')}</span>
                <span className="flex items-center gap-1">
                  <Trophy size={13} className={best ? 'text-glow' : ''} />
                  {best ? <>Best <span className="text-ink font-medium">{best.got}/{best.max}</span></> : 'Not attempted yet'}
                </span>
              </div>
            </div>
            <Link
              to={`/exam/mock/${m.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15 transition-colors flex-shrink-0"
            >
              <CirclePlay size={15} /> Start
            </Link>
          </div>
        )
      })}
    </div>
  )
}

function Mocks() {
  return (
    <Section id="mocks" icon={CirclePlay} title="Mock exams" intro="Timed, two-question practice papers in the browser spreadsheet, marked cell by cell. Your best score is kept in this browser.">
      <MockList />
      <h3 className="text-sm font-semibold text-ink mt-6 mb-3">How the mocks are marked</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {exam.mockConventions.map(c => (
          <div key={c.title} className="bg-surface border border-edge rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-ink">{c.title}</p>
            <p className="text-sm text-ink-secondary leading-relaxed mt-0.5">{c.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

export default function Exam() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">Final Exam Prep</h1>
        <p className="text-ink-secondary leading-relaxed max-w-2xl">
          Format, marking, timing and strategy for the two-hour open-book exam, built from the course outline and
          three past papers, with links from the techniques they tested into the matching Excel Lab drills.
        </p>
      </div>
      <JumpNav />
      <Glance />
      <Marking />
      <TimePlan />
      <Strategy />
      <Techniques />
      <Papers />
      <Quizzes />
      <Mocks />
    </div>
  )
}
