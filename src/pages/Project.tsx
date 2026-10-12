import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, CircleQuestionMark, ClipboardList, Database, FileSpreadsheet,
  Info, Lightbulb, Presentation, RotateCcw, Scale, Shapes, Square, SquareCheck, Target, Users, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { project } from '../data/project'
import type { Deliverable, Drill, ProjectDrills, PastProject } from '../data/project'

const CHECKLIST_KEY = 'cs602-project-checklist'

const sections = [
  ['overview', 'Overview'],
  ['deliverables', 'Deliverables'],
  ['rubric', 'Rubric'],
  ['conventions', 'Conventions'],
  ['drills', 'Drills'],
  ['past', 'Past projects'],
  ['data', 'Data'],
  ['faq', 'FAQ'],
] as const

const drillOrder: readonly (keyof ProjectDrills)[] = ['classifyNodes', 'tradeoffOrSensitivity', 'whichTool']

const itemKey = (deliverableId: string, text: string) =>
  `${deliverableId}:${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`

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
  const clear = (prefix: string) => commit(new Set([...ticks].filter(t => !t.startsWith(prefix))))
  return { ticks, toggle, clear }
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

function Bullets({ items, marker = 'dot' }: { items: readonly string[]; marker?: 'dot' | 'arrow' }) {
  return (
    <ul className="space-y-2">
      {items.map(t => (
        <li key={t} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed">
          {marker === 'arrow'
            ? <span className="text-glow flex-shrink-0">→</span>
            : <span className="mt-2 h-1.5 w-1.5 rounded-full bg-glow/70 flex-shrink-0" />}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Collapsible({ title, subtitle, aside, defaultOpen = false, children }: {
  title: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-surface border border-edge rounded-lg overflow-hidden">
      <h3>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-raised transition-colors focus-visible:-outline-offset-2"
        >
          <span className="min-w-0">
            <span className={`block font-semibold ${open ? 'text-ink' : 'text-ink-secondary'}`}>{title}</span>
            {subtitle && <span className="block text-xs text-ink-muted mt-0.5">{subtitle}</span>}
          </span>
          <span className="flex items-center gap-3 flex-shrink-0">
            {aside}
            <ChevronDown size={18} className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </h3>
      {open && <div className="px-5 pb-5 animate-fade-in">{children}</div>}
    </div>
  )
}

function Meter({ value, max, label, className = '' }: { value: number; max: number; label: string; className?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className={`h-1.5 rounded-full bg-glow-dim/40 overflow-hidden ${className}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-glow transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Overview() {
  const o = project.overview
  const heaviest = Math.max(...o.parts.map(p => p.weight))
  return (
    <Section id="overview" icon={Users} title="Overview" intro={o.weight}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {o.parts.map(p => (
          <div key={p.name} className={`bg-surface border border-edge rounded-lg px-4 py-3.5 ${p.weight === heaviest ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="text-xs text-ink-muted">{p.name}</p>
            <p className="text-2xl font-semibold text-ink mt-1 leading-tight">{p.weight}%</p>
            <p className="text-xs text-ink-secondary mt-1">{p.due}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 bg-surface border border-edge rounded-lg px-5 py-4 mb-5">
        <Users size={18} className="text-glow flex-shrink-0 mt-0.5" />
        <p className="text-sm text-ink-secondary leading-relaxed">{o.team}</p>
      </div>
      <h3 className="text-sm font-semibold text-ink mb-2">Ground rules</h3>
      <div className="mb-6"><Bullets items={o.themeRules} marker="arrow" /></div>
      <h3 className="text-sm font-semibold text-ink mb-2">Project types</h3>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {o.projectTypes.map(t => (
          <div key={t.name} className="bg-surface border border-edge rounded-lg px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">{t.name}</p>
            <p className="text-sm text-ink-secondary leading-relaxed mt-1">{t.detail}</p>
          </div>
        ))}
      </div>
      <h3 className="text-sm font-semibold text-ink mb-2">Timeline</h3>
      <ol className="bg-surface border border-edge rounded-lg overflow-hidden mb-3">
        {o.timeline.map((t, i) => (
          <li key={t.week} className={`flex items-start gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-edge' : ''}`}>
            <span className="font-mono text-xs text-glow bg-glow-dim px-2 py-1 rounded border border-glow/10 flex-shrink-0 mt-0.5 w-16 text-center">{t.week}</span>
            <p className="text-sm text-ink leading-relaxed">{t.item}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-muted flex gap-1.5 leading-relaxed">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        {o.verified}
      </p>
    </Section>
  )
}

function DeliverableCard({ d, ticks, toggle, clear, defaultOpen }: {
  d: Deliverable
  ticks: ReadonlySet<string>
  toggle: (id: string) => void
  clear: (prefix: string) => void
  defaultOpen: boolean
}) {
  const keys = d.checklist.map(c => itemKey(d.id, c))
  const done = keys.filter(k => ticks.has(k)).length
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      title={<>{d.name} <span className="font-mono text-sm text-glow ml-1">{d.weight}</span></>}
      subtitle={`Due ${d.due}`}
      aside={
        <span className="hidden sm:flex items-center gap-2">
          <Meter value={done} max={keys.length} label={`${d.name} checklist`} className="w-20" />
          <span className="font-mono text-xs text-ink-muted tabular-nums">{done}/{keys.length}</span>
        </span>
      }
    >
      <p className="text-sm text-ink-secondary leading-relaxed">{d.limits}</p>
      <p className="text-sm text-ink-secondary leading-relaxed mt-2">
        <span className="text-ink font-medium">Graded on: </span>{d.gradedOn}
      </p>
      <h4 className="text-sm font-semibold text-ink mt-4 mb-2">Must include</h4>
      <Bullets items={d.mustInclude} />
      <div className="flex items-center gap-3 mt-5 mb-2">
        <h4 className="text-sm font-semibold text-ink">Checklist</h4>
        <Meter value={done} max={keys.length} label={`${d.name} checklist`} className="flex-1 max-w-40" />
        <span className="font-mono text-xs text-ink-secondary tabular-nums" data-testid={`checklist-count-${d.id}`}>{done}/{keys.length}</span>
        <button
          onClick={() => clear(`${d.id}:`)}
          disabled={done === 0}
          className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40 disabled:hover:text-ink-muted transition-colors"
        >
          <RotateCcw size={13} /> Clear
        </button>
      </div>
      <ul className="space-y-1.5">
        {d.checklist.map((c, i) => {
          const on = ticks.has(keys[i])
          return (
            <li key={keys[i]}>
              <label className={`relative flex gap-3 items-start rounded-md border px-3 py-2.5 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-glow ${on ? 'bg-glow-dim/25 border-glow/20' : 'bg-raised/40 border-edge hover:border-edge-bright'}`}>
                {/* transparent, row-sized: Tab scrolls the whole row clear of the nav pill */}
                <input type="checkbox" className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" checked={on} onChange={() => toggle(keys[i])} data-check={keys[i]} />
                {on
                  ? <SquareCheck size={17} className="text-glow flex-shrink-0 mt-0.5" />
                  : <Square size={17} className="text-ink-muted flex-shrink-0 mt-0.5" />}
                <span className={`text-sm leading-relaxed ${on ? 'text-ink-muted' : 'text-ink-secondary'}`}>{c}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </Collapsible>
  )
}

function Deliverables() {
  const { ticks, toggle, clear } = useTicks(CHECKLIST_KEY)
  return (
    <Section id="deliverables" icon={ClipboardList} title="Deliverables" intro="What each piece must contain, then a working checklist. Ticks are saved in this browser only.">
      <div className="space-y-3">
        {project.deliverables.map((d, i) => (
          <DeliverableCard key={d.id} d={d} ticks={ticks} toggle={toggle} clear={clear} defaultOpen={i === 0} />
        ))}
      </div>
    </Section>
  )
}

function Rubric() {
  return (
    <Section
      id="rubric"
      icon={Scale}
      title="Grading rubric"
      intro="The criterion names come from the Week 1 slides. The notes on what earns marks are our reading of the course materials and past projects, not an official marking scheme."
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {project.gradingCriteria.map(c => (
          <div key={c.criterion} className="bg-surface border border-edge rounded-lg px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <h3 className="font-semibold text-ink">{c.criterion}</h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted bg-raised px-2 py-0.5 rounded border border-edge">{c.appliesTo}</span>
            </div>
            <p className="text-sm text-ink-secondary leading-relaxed mb-3">{c.lookFor}</p>
            <Bullets items={c.howToScore} />
          </div>
        ))}
      </div>
    </Section>
  )
}

function Conventions() {
  return (
    <Section id="conventions" icon={Shapes} title="Modelling conventions" intro="The course's house style for diagrams, analyses, Solver, simulation and layout, illustrated with the class exercises where they help.">
      <div className="space-y-3">
        {project.conventions.map(c => (
          <Collapsible key={c.title} title={c.title}>
            <Bullets items={c.points} />
          </Collapsible>
        ))}
      </div>
    </Section>
  )
}

function DrillPanel({ drill, id, labelledBy, hidden }: { drill: Drill<string>; id: string; labelledBy: string; hidden: boolean }) {
  const [answers, setAnswers] = useState<Readonly<Record<number, string>>>({})
  const [i, setI] = useState(0)
  const n = drill.items.length
  const item = drill.items[i]
  const picked = answers[i]
  const answered = Object.keys(answers).length
  const correct = drill.items.filter((it, k) => answers[k] === it.answer).length
  // answering disables the options, so focus moves on to the feedback, then to the next item's text
  const focusNext = useRef<'feedback' | 'item' | null>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const target = focusNext.current === 'feedback' ? feedbackRef.current : focusNext.current === 'item' ? itemRef.current : null
    focusNext.current = null
    target?.focus()
  }, [picked, i])

  const pick = (opt: string) => {
    if (picked !== undefined) return
    focusNext.current = 'feedback'
    setAnswers(a => ({ ...a, [i]: opt }))
  }
  const next = () => {
    const order = Array.from({ length: n }, (_, k) => (i + 1 + k) % n)
    focusNext.current = 'item'
    setI(order.find(k => answers[k] === undefined && k !== i) ?? (i + 1) % n)
  }
  const reset = () => {
    setAnswers({})
    setI(0)
  }

  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} hidden={hidden} className="bg-surface border border-edge rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-ink-secondary">{drill.prompt}</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-ink-muted" data-testid="drill-score">
            <span className="text-correct">{correct}</span>/{answered} correct · {n} items
          </span>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div role="group" aria-label="Items" className="flex flex-wrap gap-1 mb-5">
        {drill.items.map((it, k) => {
          const a = answers[k]
          const state = a === undefined ? 'bg-raised border-edge text-ink-muted' : a === it.answer ? 'bg-correct-dim border-correct/40 text-correct' : 'bg-wrong-dim border-wrong/40 text-wrong'
          return (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Item ${k + 1}${a === undefined ? '' : a === it.answer ? ', correct' : ', wrong'}`}
              aria-current={k === i}
              className={`h-6 w-6 rounded text-[10px] font-mono border transition-colors ${state} ${k === i ? 'ring-1 ring-ink-secondary' : ''}`}
            >
              {k + 1}
            </button>
          )
        })}
      </div>

      <div key={i} className="animate-fade-in">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted bg-raised px-2 py-0.5 rounded border border-edge">{item.context}</span>
        <p ref={itemRef} tabIndex={-1} className="text-lg text-ink leading-relaxed mt-3 mb-4 outline-none">{item.item}</p>
        <div className={`grid gap-2 ${drill.options.length === 2 ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
          {drill.options.map(opt => {
            const isAnswer = opt === item.answer
            const isPicked = opt === picked
            let cls = 'bg-raised border-edge text-ink-secondary hover:border-glow/30 hover:text-ink'
            if (picked !== undefined) {
              if (isAnswer) cls = 'bg-correct-dim/60 border-correct/40 text-ink'
              else if (isPicked) cls = 'bg-wrong-dim/60 border-wrong/40 text-ink'
              else cls = 'bg-raised border-edge text-ink-muted'
            }
            return (
              <button
                key={opt}
                onClick={() => pick(opt)}
                disabled={picked !== undefined}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-2 ${cls}`}
              >
                <span className="flex-1">{opt}</span>
                {picked !== undefined && isAnswer && <><Check size={16} className="text-correct flex-shrink-0" /><span className="sr-only">(correct answer)</span></>}
                {picked !== undefined && isPicked && !isAnswer && <><X size={16} className="text-wrong flex-shrink-0" /><span className="sr-only">(your answer)</span></>}
              </button>
            )
          })}
        </div>
        {picked !== undefined && (
          <div className="animate-fade-in mt-4">
            <div ref={feedbackRef} tabIndex={-1} className="text-sm text-ink-secondary leading-relaxed bg-raised border border-edge rounded-md px-4 py-3 mb-4 outline-none" data-testid="drill-feedback">
              <span className={`font-medium ${picked === item.answer ? 'text-correct' : 'text-wrong'}`}>
                {picked === item.answer ? 'Correct. ' : `Not quite: the answer is ${item.answer}. `}
              </span>
              {item.why}
            </div>
            {answered < n ? (
              <button
                onClick={next}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15 transition-colors"
              >
                Next item →
              </button>
            ) : (
              <p className="text-sm text-ink">
                All {n} done: <span className="text-correct font-medium">{correct}</span> correct. Reset to go again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// key -> index of the tab to move to, given the current index and the last index
const TAB_KEYS: ReadonlyMap<string, (from: number, last: number) => number> = new Map<string, (from: number, last: number) => number>([
  ['ArrowRight', (from, last) => (from === last ? 0 : from + 1)],
  ['ArrowLeft', (from, last) => (from === 0 ? last : from - 1)],
  ['Home', () => 0],
  ['End', (_, last) => last],
])

function Drills() {
  const [active, setActive] = useState<keyof ProjectDrills>('classifyNodes')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  // WAI-ARIA tabs: one Tab stop for the strip, arrow keys / Home / End move between drills and open them
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const move = TAB_KEYS.get(e.key)
    if (!move) return
    e.preventDefault()
    const k = move(drillOrder.indexOf(active), drillOrder.length - 1)
    setActive(drillOrder[k])
    tabs.current[k]?.focus()
  }
  return (
    <Section id="drills" icon={Target} title="Quick drills" intro="Short checks on the distinctions graders care about. Items come from the class exercises plus a few original practice scenarios.">
      <div role="tablist" aria-label="Drills" onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5 mb-4">
        {drillOrder.map((k, n) => (
          <button
            key={k}
            ref={el => { tabs.current[n] = el }}
            id={`drill-tab-${k}`}
            role="tab"
            aria-selected={active === k}
            aria-controls={`drill-panel-${k}`}
            tabIndex={active === k ? 0 : -1}
            onClick={() => setActive(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active === k ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
          >
            {project.drills[k].title} <span className="font-normal tabular-nums">({project.drills[k].items.length})</span>
          </button>
        ))}
      </div>
      {drillOrder.map(k => (
        <DrillPanel key={k} id={`drill-panel-${k}`} labelledBy={`drill-tab-${k}`} drill={project.drills[k]} hidden={active !== k} />
      ))}
    </Section>
  )
}

function PastProjectCard({ p, defaultOpen }: { p: PastProject; defaultOpen: boolean }) {
  return (
    <Collapsible title={p.project} subtitle={p.kind} defaultOpen={defaultOpen}>
      <p className="text-sm text-ink leading-relaxed border-l-2 border-glow/40 pl-3 mb-4">{p.question}</p>
      <Bullets items={p.lessons} />
    </Collapsible>
  )
}

function PastProjects() {
  const l = project.pastProjectLessons
  return (
    <Section id="past" icon={BookOpen} title="Lessons from past projects" intro="What the sample projects shared with the class did well, and one thing to avoid. Summaries only; no team details.">
      <div className="space-y-3 mb-5">
        {l.projects.map((p, i) => <PastProjectCard key={p.project} p={p} defaultOpen={i === 0} />)}
      </div>
      <div className="bg-surface border border-edge rounded-lg px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={16} className="text-glow" />
          <h3 className="font-semibold text-ink">What they had in common</h3>
        </div>
        <Bullets items={l.commonPatterns} />
      </div>
    </Section>
  )
}

function DataGuidance() {
  const g = project.dataGuidance
  return (
    <Section id="data" icon={Database} title="Data guidance" intro="How to find, document and turn data into model parameters so every number can be traced.">
      <ol className="space-y-2 mb-8">
        {g.principles.map((p, i) => (
          <li key={p} className="flex gap-3 text-sm text-ink-secondary leading-relaxed bg-surface border border-edge rounded-lg px-4 py-3">
            <span className="font-mono text-xs text-glow mt-0.5 w-5 flex-shrink-0">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      <h3 className="text-sm font-semibold text-ink mb-1">The parameter table</h3>
      <p className="text-xs text-ink-muted mb-3">One row per model input. The two rows below are illustrative, not real sources.</p>
      <div className="overflow-x-auto bg-surface border border-edge rounded-lg mb-8">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-raised">
              {g.tableColumns.map(c => (
                <th key={c} scope="col" className="text-left text-xs font-semibold text-ink px-3 py-2.5 border-b border-edge align-bottom">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.exampleRows.map(r => (
              <tr key={r[0]} className="border-t border-edge first:border-t-0">
                {r.map((cell, k) => (
                  <td key={k} className={`px-3 py-2.5 align-top leading-snug ${k === 0 ? 'font-mono text-xs text-ink-muted' : 'text-ink-secondary'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-semibold text-ink mb-3">From data to parameter</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {g.dataToParameterForms.map(f => (
          <div key={f.form} className="bg-surface border border-edge rounded-lg px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet size={15} className="text-glow flex-shrink-0" />
              <p className="text-sm font-semibold text-ink">{f.form}</p>
            </div>
            <p className="text-xs text-ink-muted mb-2">{f.useWhen}</p>
            <p className="text-sm text-ink-secondary leading-relaxed"><span className="text-ink">In Excel: </span>{f.excel}</p>
            <p className="text-sm text-ink-secondary leading-relaxed mt-1"><span className="text-ink">e.g. </span>{f.example}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-ink mb-3">Weak vs strong source entries</h3>
      <div className="space-y-3">
        {g.goodVsBadExamples.map(e => (
          <div key={e.bad} className="grid sm:grid-cols-[2fr_3fr] gap-2">
            <div className="flex gap-2 text-sm leading-relaxed bg-wrong-dim/30 border border-wrong/20 rounded-lg px-3.5 py-2.5">
              <X size={15} className="text-wrong flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-ink-secondary"><span className="text-wrong font-medium">Weak: </span>{e.bad}</span>
            </div>
            <div className="flex gap-2 text-sm leading-relaxed bg-correct-dim/30 border border-correct/20 rounded-lg px-3.5 py-2.5">
              <Check size={15} className="text-correct flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-ink-secondary"><span className="text-correct font-medium">Strong: </span>{e.good}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Faq() {
  return (
    <Section id="faq" icon={CircleQuestionMark} title="FAQ">
      <div className="space-y-2">
        {project.faq.map(f => (
          <Collapsible key={f.q} title={<span className="text-[15px]">{f.q}</span>}>
            <p className="text-sm text-ink-secondary leading-relaxed">{f.a}</p>
          </Collapsible>
        ))}
      </div>
    </Section>
  )
}

export default function Project() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">Group Project</h1>
        <p className="text-ink-secondary leading-relaxed max-w-2xl">
          Deadlines, deliverables and grading for the 30% team project, plus the course's modelling conventions,
          quick drills, lessons from past projects and a guide to documenting data.
        </p>
      </div>
      <Link
        to="/project/data-script"
        className="group flex items-center gap-3 bg-surface border border-edge rounded-lg px-4 py-3 mb-8 hover:border-glow/30 hover:bg-raised transition-colors"
      >
        <Presentation size={18} className="text-glow flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">Our proposal presentation: data portion script</span>
          <span className="block text-xs text-ink-muted mt-0.5">What to say on slides 9 and 10, with stage cues and the sources behind each number</span>
        </span>
        <ArrowRight size={16} className="text-glow flex-shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <JumpNav />
      <Overview />
      <Deliverables />
      <Rubric />
      <Conventions />
      <Drills />
      <PastProjects />
      <DataGuidance />
      <Faq />
      <p className="text-xs text-ink-muted flex items-center gap-1.5">
        <CalendarDays size={13} /> Always check eLearn: updates given in class take precedence over this guide.
      </p>
    </div>
  )
}
