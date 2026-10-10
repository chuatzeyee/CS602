// dev harness for the lab player: npx vite --port 4622 --strictPort, then
// http://localhost:4622/CS602/dev/player-harness.html?id=<fixture id>  (not part of the production build)
// views: ?view=list (default without id) | player (&id=, &mode=practice|exam|review|sandbox) | catalogue | sandbox
//        | mock (&mockId=, &minutes=): the first fixture mock, or one built from the fixtures for an unknown id
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../src/index.css'
import NavPill from '../src/components/NavPill'
import * as fixtureModule from '../tests/fixtures'
import Player from '../src/lab/components/Player'
import MockExamView from '../src/lab/components/MockExamView'
import type { PlayerMode } from '../src/lab/components/playerTypes'
import { LabCatalogue } from '../src/pages/Lab'
import Sandbox from '../src/pages/Sandbox'
import type { Exercise, MockExam, Task } from '../src/lab/types'

const isExercise = (v: unknown): v is Exercise =>
  !!v && typeof v === 'object' && 'id' in v && 'sheet' in v && Array.isArray((v as Exercise).tasks)
const isMock = (v: unknown): v is MockExam =>
  !!v && typeof v === 'object' && 'questions' in v && Array.isArray((v as MockExam).questions)

// every exercise / mock exported by tests/fixtures.ts, whatever the export names
function collect(mod: Record<string, unknown>): { exercises: Exercise[]; mocks: MockExam[] } {
  const exercises = new Map<string, Exercise>()
  const mocks = new Map<string, MockExam>()
  const visit = (v: unknown, depth: number) => {
    if (depth > 3 || !v || typeof v !== 'object') return
    if (isExercise(v)) {
      if (!exercises.has(v.id)) exercises.set(v.id, v)
      return
    }
    if (isMock(v)) {
      if (!mocks.has(v.id)) mocks.set(v.id, v)
      return
    }
    for (const x of Array.isArray(v) ? v : Object.values(v)) visit(x, depth + 1)
  }
  for (const v of Object.values(mod)) visit(v, 0)
  return { exercises: [...exercises.values()], mocks: [...mocks.values()] }
}

const fixtures = collect(fixtureModule as Record<string, unknown>)

// harness-only variant: the first fixture with progressive hints and explanations on every task
function withHints(e: Exercise): Exercise {
  return {
    ...e,
    id: `${e.id}-hints`,
    title: `${e.title} (hints)`,
    tasks: e.tasks.map((t, i) => ({
      ...t,
      hints: t.hints ?? [
        `Start from task ${i + 1}'s first cell: ${t.cells || 'the answer box'}.`,
        'Use `SUM`, `MAX` or the function the prompt names, and anchor what must not move with $.',
      ],
      explain: t.explain ?? 'Mixed references keep the price row and the quantity column fixed while the formula fills.',
    })),
  }
}
const extras = fixtures.exercises.length ? [withHints(fixtures.exercises[0])] : []
const exerciseOf = (key: string) => [...fixtures.exercises, ...extras].find(e => e.id === key)

// typed answers only (no tool dialogs, no VBA), so a mock can be answered by keyboard
const typedOnly = (e: Exercise) => e.tasks.length > 0 && e.tasks.every(t => t.kind === 'formula' || t.kind === 'value' || t.kind === 'explain')

function fixtureMock(id: string, minutes: number): MockExam {
  const picks = fixtures.exercises.filter(typedOnly).slice(0, 3)
  const withMarks = (t: Task): Task => ({ ...t, marks: 2 })
  return {
    id,
    title: 'Fixture mock exam',
    minutes,
    basedOn: 'Built by the player harness from tests/fixtures.ts',
    intro: 'Answer every question in the sheet. Hints, Reveal and Check stay off until you submit.',
    questions: picks.map((e, i) => ({
      id: `q${i + 1}`,
      title: e.title,
      marks: e.tasks.length * 2,
      exercise: { ...e, week: 'EXAM', tasks: e.tasks.map(withMarks) },
    })),
  }
}

declare global {
  interface Window { __harness?: { exercises: Exercise[]; extras: Exercise[]; mocks: MockExam[]; mock: MockExam } }
}

const params = new URLSearchParams(window.location.search)
const id = params.get('id') ?? ''
const view = params.get('view') ?? (id ? 'player' : 'list')
const mode = (params.get('mode') ?? 'practice') as PlayerMode
// ?mockId= picks a fixture mock (default: the first); an unknown id builds one; ?minutes= overrides the time
const minutes = Number(params.get('minutes'))
const found = fixtures.mocks.find(m => m.id === (params.get('mockId') ?? fixtures.mocks[0]?.id))
const mock = found
  ? (minutes > 0 ? { ...found, minutes } : found)
  : fixtureMock(params.get('mockId') ?? 'fixture-mock', minutes > 0 ? minutes : 30)
window.__harness = { exercises: fixtures.exercises, extras, mocks: fixtures.mocks, mock }

const link = (q: string) => `${window.location.pathname}?${q}`

function FixtureList() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Player harness</h1>
      <ul className="space-y-1.5">
        {[...fixtures.exercises, ...extras].map(e => (
          <li key={e.id} className="flex items-center gap-3 text-sm">
            <a className="text-glow hover:underline font-mono" href={link(`id=${encodeURIComponent(e.id)}`)}>{e.id}</a>
            <span className="text-ink-secondary">{e.title}</span>
            <span className="text-ink-muted text-xs">{e.tasks.map(t => t.kind).join(', ')}</span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-4 text-sm">
        <a className="text-glow hover:underline" href={link('view=catalogue')}>catalogue</a>
        <a className="text-glow hover:underline" href={link('view=sandbox')}>sandbox</a>
        <a className="text-glow hover:underline" href={link('view=mock')}>mock exam</a>
      </p>
    </div>
  )
}

function PlayerView() {
  const ex = exerciseOf(id)
  if (!ex) return <p className="p-10 text-wrong">No fixture exercise "{id}".</p>
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-4">
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 text-xs">
        <a href={link('view=list')} className="text-ink-muted hover:text-ink">Fixtures</a>
        <span className="text-ink-faint">/</span>
        <span className="font-mono text-ink-secondary">{ex.id} · {mode}</span>
      </nav>
      <Player key={`${ex.id}-${mode}`} exercise={ex} mode={mode} progressId={mode === 'practice' || mode === 'sandbox' ? ex.id : undefined} />
    </div>
  )
}

function View() {
  if (view === 'catalogue') return <LabCatalogue list={fixtures.exercises} />
  if (view === 'sandbox') return <Sandbox />
  if (view === 'mock') return <MockExamView key={mock.id} mock={mock} backTo="/" />
  if (view === 'player') return <PlayerView />
  return <FixtureList />
}

// one root even if this module is re-run by a hot update
const host = window as Window & { __harnessRoot?: Root }
host.__harnessRoot ??= createRoot(document.getElementById('root')!)
host.__harnessRoot.render(
  <StrictMode>
    <HashRouter>
      <div className="min-h-screen bg-void">
        <main className="pb-24">
          <View />
        </main>
        <NavPill />
      </div>
    </HashRouter>
  </StrictMode>,
)
