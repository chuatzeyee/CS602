import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, ClipboardCheck, Sigma, FlaskConical, Table2, GraduationCap, Users, CalendarDays, ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { sessions } from '../data/topics'
import { definitions } from '../data/definitions'
import { questions } from '../data/quiz'
import { formulas } from '../data/formulas'
import { walkthroughs } from '../data/walkthroughs'
import { course } from '../data/course'
import { weekSpan } from '../data/weeks'
import { EXAM_TECHNIQUES } from '../data/lab/techniques'

const coverage = weekSpan(sessions.map(s => s.id))

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// lab exercises, mock exams and the project guide are big data modules: count them after the first paint, from the
// chunks their own pages load, so the home bundle stays small (never import the lab engine, sheet or checker here)
type LazyKey = 'lab' | 'exam' | 'project'
type LazyStats = Record<LazyKey, string[]>

async function loadStats(): Promise<LazyStats> {
  const [{ exercises, mocks }, { project }] = await Promise.all([import('../data/lab'), import('../data/project')])
  const drills = Object.values(project.drills).reduce((n, d) => n + d.items.length, 0)
  const counts: Record<LazyKey, [number, string][]> = {
    lab: [[exercises.length, 'exercise'], [exercises.reduce((n, e) => n + e.tasks.length, 0), 'task']],
    exam: [[mocks.length, 'mock exam'], [EXAM_TECHNIQUES.length, 'exam technique']],
    project: [[project.deliverables.length, 'deliverable'], [drills, 'drill question']],
  }
  const text = (list: [number, string][]) => list.filter(([n]) => n > 0).map(([n, word]) => plural(n, word))
  return { lab: text(counts.lab), exam: text(counts.exam), project: text(counts.project) }
}

function useLazyStats(): LazyStats | 'loading' | 'failed' {
  const [stats, setStats] = useState<LazyStats | 'loading' | 'failed'>('loading')
  useEffect(() => {
    let live = true
    loadStats().then(
      s => { if (live) setStats(s) },
      () => { if (live) setStats('failed') },   // offline or a stale deploy: the cards still link, without counts
    )
    return () => { live = false }
  }, [])
  return stats
}

interface Card {
  to: string
  icon: LucideIcon
  title: string
  description: string
  stats: readonly string[] | LazyKey
}

const cards: readonly Card[] = [
  {
    to: '/topics',
    icon: BookOpen,
    title: 'Topics & Glossary',
    description: `Every session (${coverage}) distilled into revision notes, plus a searchable glossary of key terms`,
    stats: [`${sessions.reduce((sum, s) => sum + s.topics.length, 0) + definitions.length} entries`],
  },
  {
    to: '/quiz',
    icon: ClipboardCheck,
    title: 'Practice Quiz',
    description: 'MCQ bank with worked explanations — concepts, function behaviour, and calculation drills',
    stats: [`${questions.length} questions`],
  },
  {
    to: '/functions',
    icon: Sigma,
    title: 'Function Bank',
    description: 'Every Excel function, formula pattern and VBA snippet taught, with real syntax from the session workbooks and gotchas to watch for',
    stats: [`${formulas.length} functions`],
  },
  {
    to: '/models',
    icon: FlaskConical,
    title: 'Model Walkthroughs',
    description: 'The signature session workbooks — water tank, breakeven, Solver, time value of money, simulation, call-centre queues, VBA macros, filters and PivotTables — rebuilt step by step with the real formulas and code',
    stats: [`${walkthroughs.length} models`],
  },
  {
    to: '/lab',
    icon: Table2,
    title: 'Excel Lab',
    description: 'Hands-on exercises for every week in a spreadsheet that runs in your browser — formulas, Goal Seek, Data Tables, Solver, filters, PivotTables and VBA — checked against hidden test inputs, plus a free sandbox',
    stats: 'lab',
  },
  {
    to: '/exam',
    icon: GraduationCap,
    title: 'Exam Prep',
    description: 'Format, marking and a time plan for the two-hour open-book final, the techniques past papers test most, and timed mock exams marked cell by cell',
    stats: 'exam',
  },
  {
    to: '/project',
    icon: Users,
    title: 'Group Project',
    description: 'Deadlines, deliverables and the grading rubric for the team project, plus modelling conventions, quick drills, lessons from past projects and a guide to documenting data',
    stats: 'project',
  },
  {
    to: '/course',
    icon: CalendarDays,
    title: 'Course Map',
    description: 'Assessment weights, week-by-week schedule, exam format, and the ground rules from the course outline',
    stats: [`${course.schedule.length} weeks mapped`],
  },
]

const badge = 'text-xs font-medium text-glow bg-glow-dim px-2.5 py-1 rounded-full font-mono border border-glow/10'

export default function Home() {
  const lazy = useLazyStats()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-block mb-4">
          <span className="text-xs font-mono text-glow bg-glow-dim px-3 py-1 rounded-full border border-glow/20">
            Unofficial · SMU MITB
          </span>
        </div>
        <h1 className="text-4xl font-bold text-ink mb-2 tracking-tight">
          <span aria-hidden="true">📊</span> CS602 SheetSmith
        </h1>
        <p className="text-lg text-glow font-medium mb-6 font-mono tracking-wide">
          {course.courseTitle}
        </p>
        <p className="text-ink-secondary max-w-2xl mx-auto leading-relaxed">
          Study companion for SMU CS602/IS602, {coverage}: revision notes, a quiz bank, a function bank and the
          session workbooks rebuilt step by step, from modelling foundations and Solver to simulation, queuing, VBA
          and PivotTables. Practise in an interactive Excel lab that checks your work in the browser, prepare for the
          final with exam technique and timed mock exams, and plan the group project with deliverable checklists and
          drills.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ to, icon: Icon, title, description, stats }, i) => {
          const shown = typeof stats !== 'string' ? stats : typeof lazy === 'string' ? null : lazy[stats]
          return (
            <Link
              key={to}
              to={to}
              className="group bg-surface border border-edge rounded-lg p-6 hover:border-glow/30 hover:bg-raised transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-glow-dim rounded-lg text-glow group-hover:bg-glow/15 transition-colors duration-200">
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-ink">{title}</h2>
                    <ArrowRight
                      size={16}
                      className="text-ink-faint group-hover:text-glow group-hover:translate-x-1 transition-all duration-200"
                    />
                  </div>
                  <p className="text-sm text-ink-secondary mb-3">{description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shown
                      ? shown.map(text => <span key={text} className={badge}>{text}</span>)
                      : lazy === 'loading' && <span className={`${badge} opacity-50`} aria-hidden="true">…</span>}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
