import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { exercises, exerciseById } from '../data/lab'
import Player from '../lab/components/Player'
import LabErrorBoundary from '../lab/components/LabErrorBoundary'
import { clearExerciseProgress } from '../lab/progress'

const LEVELS: Record<number, string> = { 1: 'Drill', 2: 'Applied', 3: 'Exam-style' }
const nav = 'flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors'

export default function LabPlayer() {
  const { exerciseId = '' } = useParams()
  const ex = exerciseById(exerciseId)

  if (!ex) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center animate-fade-in">
        <SearchX size={36} className="mx-auto text-ink-muted mb-4" />
        <h1 className="text-2xl font-bold text-ink mb-2">Exercise not found</h1>
        <p className="text-ink-secondary mb-6">
          There is no exercise called <span className="font-mono text-ink">{exerciseId || '(blank)'}</span>. It may have been renamed or moved.
        </p>
        <Link to="/lab" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15">
          <ArrowLeft size={15} /> Back to the Excel Lab
        </Link>
      </div>
    )
  }

  const week = exercises.filter(e => e.week === ex.week)
  const i = week.findIndex(e => e.id === ex.id)
  const prev = i > 0 ? week[i - 1] : undefined
  const next = i >= 0 && i < week.length - 1 ? week[i + 1] : undefined

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-4">
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3" aria-label="Exercise navigation">
        <Link to={`/lab?week=${ex.week}`} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
          <ArrowLeft size={14} /> Excel Lab
        </Link>
        <span className="text-ink-faint text-xs">/</span>
        <span className="text-xs font-mono text-ink-secondary">{ex.week} · L{ex.level} {LEVELS[ex.level]}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {prev ? (
            <Link to={`/lab/${prev.id}`} title={prev.title} className={`${nav} bg-surface text-ink-secondary border-edge hover:text-ink hover:border-edge-bright`}>
              <ChevronLeft size={14} /> Previous
            </Link>
          ) : (
            <span className={`${nav} text-ink-faint border-edge/60`} aria-disabled><ChevronLeft size={14} /> Previous</span>
          )}
          <span className="text-[11px] font-mono text-ink-muted px-1">{i + 1}/{week.length}</span>
          {next ? (
            <Link to={`/lab/${next.id}`} title={next.title} className={`${nav} bg-surface text-ink-secondary border-edge hover:text-ink hover:border-edge-bright`}>
              Next <ChevronRight size={14} />
            </Link>
          ) : (
            <span className={`${nav} text-ink-faint border-edge/60`} aria-disabled>Next <ChevronRight size={14} /></span>
          )}
        </div>
      </nav>
      <LabErrorBoundary key={ex.id} backTo={`/lab?week=${ex.week}`} backLabel="Back to the Excel Lab" onReset={() => clearExerciseProgress(ex.id)}>
        <Player exercise={ex} progressId={ex.id} />
      </LabErrorBoundary>
    </div>
  )
}
