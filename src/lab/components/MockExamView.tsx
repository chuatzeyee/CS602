import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, GraduationCap, LoaderCircle, Play, RotateCcw, Send, Trophy } from 'lucide-react'
import type { ExerciseResult, LearnerState, MockExam, MockQuestion } from '../types'
import { checkExercise } from '../checker'
import { getMockProgress, saveMockProgress, type MockProgress } from '../progress'
import Player from './Player'
import ConfirmDialog from './ConfirmDialog'
import { fmtMarks, scoreMock, taskMax, type QuestionScore } from './mockScoring'
import { btnPrimary, btnSecondary } from './ui'

type Phase = 'intro' | 'running' | 'submitting' | 'done'

interface MockExamViewProps {
  mock: MockExam
  backTo?: string
}

// the page above the player holds the breadcrumb and the sticky question tabs; below lg the sheet also leaves room for
// the one-row tab bar on top and the bottom nav pill, so its toolbar and status bar stay visible
const PLAYER_HEIGHTS = { sheet: 'h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-13rem)]', panel: 'lg:h-[calc(100dvh-13rem)] lg:top-16' }

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
}

// review: what each task earned when the paper was submitted. The task cards show each task's worth and the latest check
// in review instead, so a task fixed now reads ✓ on its card and keeps its submitted 0/1 here. Written answers count
// once they are self-marked (that updates these marks).
function SubmittedMarks({ question, score, result }: { question: MockQuestion; score: QuestionScore; result?: ExerciseResult }) {
  return (
    <section aria-label="Submitted marks" className="mb-3">
      <p className="text-xs text-ink-muted font-mono">{question.title}: {fmtMarks(score.got)}/{fmtMarks(score.max)} marks submitted</p>
      <ol className="flex flex-wrap gap-1.5 mt-2">
        {question.exercise.tasks.map((t, i) => {
          const got = score.tasks[t.id] ?? 0
          const max = taskMax(question, t)
          const pending = result?.tasks.find(r => r.taskId === t.id)?.pending
          const tone = pending ? 'text-s4' : max > 0 && got >= max ? 'text-correct' : got > 0 ? 'text-ink' : 'text-wrong'
          return (
            <li
              key={t.id}
              className="text-[11px] font-mono bg-surface border border-edge rounded px-1.5 py-0.5"
              title={pending ? 'Written answer: it counts once you self-mark it' : undefined}
            >
              <span className="text-ink-muted"><span className="max-sm:hidden">Task </span><span className="sm:hidden">T</span>{i + 1}</span>{' '}
              <span className={tone}>{fmtMarks(got)}</span><span className="text-ink-muted">/{fmtMarks(max)}</span>
            </li>
          )
        })}
      </ol>
      <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed">
        Marks as submitted. The ✓ or ✗ on each task card is your latest check in review: a task you fix now shows ✓ there and keeps its
        submitted mark here.
      </p>
    </section>
  )
}

function markAll(mock: MockExam, states: Record<string, LearnerState>): Record<string, ExerciseResult> {
  const out: Record<string, ExerciseResult> = {}
  for (const q of mock.questions) {
    try {
      out[q.id] = checkExercise(q.exercise, states[q.id] ?? { edits: {} })
    } catch {
      out[q.id] = { score: 0, tasks: [] }
    }
  }
  return out
}

export default function MockExamView({ mock, backTo = '/exam' }: MockExamViewProps) {
  const [boot] = useState<MockProgress>(() => getMockProgress(mock.id) ?? { states: {} })
  const progress = useRef<MockProgress>(boot)
  const limit = mock.minutes * 60_000
  const [phase, setPhase] = useState<Phase>(() =>
    boot.submittedAt ? 'submitting' : boot.startedAt ? (Date.now() - boot.startedAt >= limit ? 'submitting' : 'running') : 'intro')
  const [active, setActive] = useState(mock.questions[0]?.id ?? '')
  const [now, setNow] = useState(() => Date.now())
  const [results, setResults] = useState<Record<string, ExerciseResult> | null>(null)
  const [confirm, setConfirm] = useState<'submit' | 'retake' | null>(null)
  const [autoSubmitted, setAutoSubmitted] = useState(() => Boolean(boot.startedAt && !boot.submittedAt && Date.now() - boot.startedAt >= limit))
  const [best, setBest] = useState(boot.best)
  const [saveFailed, setSaveFailed] = useState(false)

  const totalMarks = mock.questions.reduce((n, q) => n + q.marks, 0)
  const save = useCallback((patch: Partial<MockProgress>) => {
    progress.current = { ...progress.current, ...patch }
    if (!saveMockProgress(mock.id, progress.current)) setSaveFailed(true)
  }, [mock.id])

  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const remaining = (progress.current.startedAt ?? now) + limit - now
  useEffect(() => {
    if (phase === 'running' && remaining <= 0) {
      setAutoSubmitted(true)
      setPhase('submitting')
    }
  }, [phase, remaining])

  // marking runs after the exam Players unmount, so their last edits are already flushed into progress
  useEffect(() => {
    if (phase !== 'submitting') return
    const t = setTimeout(() => {
      const r = markAll(mock, progress.current.states)
      const s = scoreMock(mock, r)
      const firstMark = !progress.current.submittedAt
      const nextBest = !progress.current.best || s.got > progress.current.best.got ? { got: s.got, max: s.max } : progress.current.best
      save({ submittedAt: progress.current.submittedAt ?? Date.now(), best: nextBest })
      setBest(nextBest)
      setResults(r)
      setPhase('done')
      if (firstMark) window.scrollTo({ top: 0 })
    }, 60)
    return () => clearTimeout(t)
  }, [phase, mock, save])

  const score = useMemo(() => (results ? scoreMock(mock, results) : null), [mock, results])

  const start = () => {
    save({ states: {}, startedAt: Date.now(), submittedAt: undefined })
    setNow(Date.now())
    setActive(mock.questions[0]?.id ?? '')
    setPhase('running')
  }

  const retake = () => {
    progress.current = { states: {}, best: progress.current.best }
    saveMockProgress(mock.id, progress.current)
    setResults(null)
    setAutoSubmitted(false)
    setPhase('intro')
  }

  const onState = useCallback((qid: string, state: LearnerState) => {
    if (phase !== 'running') return
    save({ states: { ...progress.current.states, [qid]: state } })
  }, [phase, save])

  // review: written answers are self-marked after the model answer is shown; that can lift the score
  const onSelfMark = (qid: string, taskId: string, ok: boolean) => {
    const q = mock.questions.find(x => x.id === qid)
    if (!q || !results) return
    const prev = progress.current.states[qid] ?? { edits: {} }
    const state: LearnerState = { ...prev, selfMarks: { ...prev.selfMarks, [taskId]: ok } }
    save({ states: { ...progress.current.states, [qid]: state } })
    let r: ExerciseResult
    try {
      r = checkExercise(q.exercise, state)
    } catch {
      return
    }
    const next = { ...results, [qid]: r }
    setResults(next)
    const s = scoreMock(mock, next)
    if (!progress.current.best || s.got > progress.current.best.got) {
      save({ best: { got: s.got, max: s.max } })
      setBest({ got: s.got, max: s.max })
    }
  }

  const q = mock.questions.find(x => x.id === active) ?? mock.questions[0]
  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
      <Link to={backTo} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"><ArrowLeft size={14} /> Exam</Link>
      <span className="text-ink-faint">/</span>
      <span className="text-xs text-ink-secondary truncate">{mock.title}</span>
      {saveFailed && (
        <p role="alert" className="basis-full text-xs text-s4">
          Your answers could not be saved on this device (the browser's storage is full or blocked): keep this page open until you submit.
        </p>
      )}
    </div>
  )

  if (phase === 'intro') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
        {header}
        <div className="bg-surface border border-edge rounded-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2.5 bg-glow-dim rounded-lg text-glow"><GraduationCap size={24} /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink">{mock.title}</h1>
              <p className="text-xs text-ink-muted mt-1">{mock.basedOn}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 mb-5 text-center">
            <div className="bg-raised border border-edge rounded-lg py-3"><dt className="text-[11px] text-ink-muted">Time</dt><dd className="text-lg font-mono text-ink">{mock.minutes} min</dd></div>
            <div className="bg-raised border border-edge rounded-lg py-3"><dt className="text-[11px] text-ink-muted">Questions</dt><dd className="text-lg font-mono text-ink">{mock.questions.length}</dd></div>
            <div className="bg-raised border border-edge rounded-lg py-3"><dt className="text-[11px] text-ink-muted">Marks</dt><dd className="text-lg font-mono text-ink">{fmtMarks(totalMarks)}</dd></div>
          </dl>
          <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line mb-5">{mock.intro}</div>
          <ul className="space-y-1.5 mb-5">
            {mock.questions.map((x, i) => (
              <li key={x.id} className="flex items-center justify-between gap-3 text-sm bg-raised/60 border border-edge rounded-md px-3 py-2">
                <span className="text-ink"><span className="font-mono text-ink-muted mr-2">Q{i + 1}</span>{x.title}</span>
                <span className="font-mono text-xs text-ink-muted flex-shrink-0">{fmtMarks(x.marks)} marks</span>
              </li>
            ))}
          </ul>
          <ul className="text-xs text-ink-muted leading-relaxed list-disc pl-5 mb-6 space-y-1">
            <li>The timer starts when you press Start and keeps running if you leave or reload the page.</li>
            <li>Hints, Reveal and Check are off until you submit. Submission is automatic when time runs out.</li>
            <li>Each task earns its marks in proportion to the cells it gets right, rounded down to 0.25.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={start} className={`${btnPrimary} !px-5 !py-2.5 !text-sm`}><Play size={15} /> Start the exam</button>
            {best && <span className="flex items-center gap-1.5 text-xs text-ink-muted"><Trophy size={13} className="text-s4" /> Best {fmtMarks(best.got)}/{fmtMarks(best.max)}</span>}
          </div>
        </div>
      </div>
    )
  }

  if (!q) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {header}
        <p className="text-ink-muted">This mock exam has no questions yet.</p>
      </div>
    )
  }

  if (phase === 'submitting' || (phase === 'done' && !results)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center gap-2 text-ink-muted text-sm">
        <LoaderCircle size={16} className="animate-spin" /> Marking your answers…
      </div>
    )
  }

  const running = phase === 'running'
  const low = remaining < 5 * 60_000
  const qScore = score?.questions[q.id]

  return (
    // review: room under the player and the task list so both scroll clear of the fixed nav pill
    <div className={`max-w-[1600px] mx-auto px-3 sm:px-4 pt-4 ${running ? 'pb-4' : 'pb-24'}`}>
      {header}
      {!running && score && (
        <section className="bg-surface border border-edge rounded-lg p-5 mb-4 animate-fade-in" aria-label="Result">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-ink-muted">{autoSubmitted ? 'Time is up: submitted automatically' : 'Submitted'}</p>
              <p className="text-3xl font-bold font-mono text-ink">{fmtMarks(score.got)}<span className="text-ink-muted text-xl">/{fmtMarks(score.max)}</span></p>
              <p className="text-xs text-ink-muted">{score.max ? Math.round((score.got / score.max) * 100) : 0}%{best ? ` · best ${fmtMarks(best.got)}/${fmtMarks(best.max)}` : ''}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {mock.questions.map((x, i) => (
                <li key={x.id} className="text-xs font-mono bg-raised border border-edge rounded-md px-3 py-2">
                  <span className="text-ink-muted">Q{i + 1}</span> <span className="text-ink">{fmtMarks(score.questions[x.id].got)}</span><span className="text-ink-muted">/{fmtMarks(score.questions[x.id].max)}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => setConfirm('retake')} className={btnSecondary}><RotateCcw size={14} /> Retake</button>
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">Review mode: hints, Reveal, Check and explanations are on. Written answers can be self-marked after viewing the model answer. Changes you make now are not saved to the mark.</p>
        </section>
      )}

      <div className={`flex items-center gap-2 mb-4 ${running ? 'sticky top-0 z-30 bg-void/95 backdrop-blur py-2 -mx-1 px-1' : 'flex-wrap'}`}>
        <div className="flex gap-1.5 overflow-x-auto min-w-0" role="tablist" aria-label="Questions">
          {mock.questions.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === q.id}
              onClick={() => setActive(x.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${x.id === q.id ? 'bg-glow-dim text-glow border-glow/25' : 'bg-surface text-ink-muted border-edge hover:text-ink'}`}
            >
              Q{i + 1}{' '}
              {score
                ? <span className="font-mono opacity-70">{fmtMarks(score.questions[x.id].got)}/{fmtMarks(x.marks)}</span>
                : <span className="opacity-70 sr-only sm:not-sr-only">· {fmtMarks(x.marks)} mark{x.marks === 1 ? '' : 's'}</span>}
            </button>
          ))}
        </div>
        {running && (
          <>
            <span
              className={`ml-auto flex items-center gap-1.5 font-mono text-sm px-3 py-1.5 rounded-full border ${low ? 'text-wrong border-wrong/40 bg-wrong-dim/40' : 'text-ink border-edge bg-surface'}`}
              role="timer"
              aria-label={`Time left ${clock(remaining)}`}
            >
              <Clock size={14} /> {clock(remaining)}
            </span>
            <button type="button" onClick={() => setConfirm('submit')} className={btnPrimary}><Send size={14} /> Submit</button>
          </>
        )}
      </div>

      <h2 className="sr-only">{q.title}</h2>
      {!running && qScore && <SubmittedMarks question={q} score={qScore} result={results?.[q.id]} />}
      <Player
        key={`${q.id}-${phase}`}
        exercise={q.exercise}
        mode={running ? 'exam' : 'review'}
        initialState={progress.current.states[q.id]}
        onStateChange={running ? state => onState(q.id, state) : undefined}
        initialResult={running ? undefined : results?.[q.id]}
        onSelfMark={running ? undefined : (taskId, ok) => onSelfMark(q.id, taskId, ok)}
        heights={PLAYER_HEIGHTS}
      />

      {confirm === 'submit' && (
        <ConfirmDialog
          title="Submit the exam?"
          confirmLabel="Submit"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); setPhase('submitting') }}
        >
          Your answers to all {mock.questions.length} questions are marked now and the timer stops. {clock(remaining)} left.
        </ConfirmDialog>
      )}
      {confirm === 'retake' && (
        <ConfirmDialog
          title="Retake this mock?"
          confirmLabel="Retake"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); retake() }}
        >
          Your answers are cleared and you start again with a fresh timer. Your best score is kept.
        </ConfirmDialog>
      )}
    </div>
  )
}
