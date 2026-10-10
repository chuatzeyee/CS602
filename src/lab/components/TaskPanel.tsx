import type { ReactNode } from 'react'
import { Clock, Sparkles } from 'lucide-react'
import type { Exercise } from '../types'
import PromptText from './PromptText'
import type { PlayerMode } from './playerTypes'

const LEVELS: Record<number, string> = { 1: 'Drill', 2: 'Applied', 3: 'Exam-style' }

interface TaskPanelProps {
  exercise: Exercise
  mode: PlayerMode
  summary?: ReactNode
  children: ReactNode
}

// scenario card + score line + task cards
export default function TaskPanel({ exercise, mode, summary, children }: TaskPanelProps) {
  const exam = mode === 'exam' || mode === 'review'
  return (
    <div className="space-y-3">
      <section className="bg-surface border border-edge rounded-lg px-4 py-4" aria-label="Scenario">
        {!exam && (
          <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[11px] font-mono text-ink-muted">
            <span className="uppercase tracking-wider">{exercise.week} · L{exercise.level} {LEVELS[exercise.level]}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {exercise.minutes} min</span>
            {exercise.extension && (
              <span className="flex items-center gap-1 text-s2" title="Uses functions beyond this week's syllabus"><Sparkles size={10} /> extension</span>
            )}
          </div>
        )}
        <h2 className="text-lg font-semibold text-ink leading-snug">{exercise.title}</h2>
        {!exam && <p className="text-xs text-ink-muted mb-2">{exercise.topic}</p>}
        <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line mt-2"><PromptText text={exercise.scenario} /></p>
        {!exam && exercise.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {exercise.skills.map(s => (
              <span key={s} className="text-[11px] text-ink-muted bg-raised border border-edge rounded px-1.5 py-0.5">{s}</span>
            ))}
          </div>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-amber-400/[0.09] border border-amber-400/40" aria-hidden /> your answers
          </span>
          <span><span className="font-mono text-sky-300">blue</span> inputs you may change</span>
          <span><span className="font-mono text-ink-secondary">grey</span> given</span>
        </p>
      </section>
      {summary}
      {children}
    </div>
  )
}
