import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALargeSmall, ArrowLeft, Database, Timer } from 'lucide-react'
import { presentationScript, scriptPoints } from '../data/presentationScript'
import type { ScriptLine, ScriptSection, ScriptSource } from '../data/presentationScript'

const LARGE_TEXT_KEY = 'cs602-script-large'
const PLACEHOLDER = '[Name]'

// the spoken lines are what the presenter reads aloud: large text is for a phone held at arm's length
interface TextSize {
  line: string
  cue: string
  gap: string
}

const NORMAL: TextSize = { line: 'text-lg leading-8', cue: 'text-[11px]', gap: 'space-y-7' }
const LARGE: TextSize = { line: 'text-[22px] sm:text-2xl leading-[1.7]', cue: 'text-xs', gap: 'space-y-9' }

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false   // storage disabled: start with normal text
  }
}

function useStoredFlag(key: string): readonly [boolean, () => void] {
  const [on, setOn] = useState(() => loadFlag(key))
  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // private mode / quota: the setting just isn't kept
    }
  }
  return [on, toggle]
}

// the next speaker's name is a placeholder: highlight it so the presenter swaps in the name
function Spoken({ text }: { text: string }) {
  return (
    <>
      {text.split(PLACEHOLDER).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-glow font-medium">{PLACEHOLDER}</span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}

function Line({ line, size, points }: { line: ScriptLine; size: TextSize; points: boolean }) {
  const bullets = points && line.cue ? scriptPoints[line.cue] : undefined
  return (
    <li>
      {line.cue && (
        <p className={`inline-block font-mono uppercase tracking-wider leading-snug text-ink-muted bg-raised border border-edge rounded px-2 py-0.5 mb-2 ${size.cue}`}>
          <span className="sr-only">Cue: </span>{line.cue}
        </p>
      )}
      {bullets ? (
        <ul className={`list-disc pl-5 space-y-1.5 text-ink marker:text-glow ${size.line}`}>
          {bullets.map(b => <li key={b}><Spoken text={b} /></li>)}
        </ul>
      ) : (
        <p className={`text-ink ${size.line}`}><Spoken text={line.text} /></p>
      )}
    </li>
  )
}

function SlideCard({ section, size, points }: { section: ScriptSection; size: TextSize; points: boolean }) {
  const headingId = `slide-${section.slide}`
  return (
    <section aria-labelledby={headingId} className="bg-surface border border-edge rounded-lg mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 sm:px-6 py-4 border-b border-edge">
        <h2 id={headingId} className="flex items-center gap-3 text-lg font-semibold text-ink leading-snug">
          <span className="font-mono text-xs font-medium text-glow bg-glow-dim px-2 py-1 rounded border border-glow/10 flex-shrink-0">
            Slide {section.slide}
          </span>
          <span><span className="sr-only">: </span>{section.title}</span>
        </h2>
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Timer size={14} aria-hidden="true" /> {section.timing}
          </span>
          {section.optional && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary bg-raised px-2 py-0.5 rounded border border-edge-bright">
              Optional
            </span>
          )}
        </div>
      </div>
      <ol className={`px-5 sm:px-6 py-6 ${size.gap}`}>
        {section.lines.map(line => <Line key={line.text} line={line} size={size} points={points} />)}
      </ol>
    </section>
  )
}

// a table from 640px; below that each number stacks over its source, so the page never scrolls sideways
function SourcesTable({ rows }: { rows: readonly ScriptSource[] }) {
  return (
    <div className="bg-surface border border-edge rounded-lg overflow-hidden">
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="bg-raised">
            <th scope="col" className="w-2/5 text-left text-xs font-semibold text-ink px-4 py-2.5 border-b border-edge">Number in the script</th>
            <th scope="col" className="text-left text-xs font-semibold text-ink px-4 py-2.5 border-b border-edge">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.number} className="border-t border-edge first:border-t-0">
              <td className="px-4 py-3 align-top text-ink leading-relaxed">{r.number}</td>
              <td className="px-4 py-3 align-top text-ink-secondary leading-relaxed">{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="sm:hidden">
        {rows.map(r => (
          <div key={r.number} className="px-4 py-3.5 border-t border-edge first:border-t-0">
            <dt className="text-sm text-ink leading-relaxed">{r.number}</dt>
            <dd className="text-sm text-ink-secondary leading-relaxed mt-1">
              <span className="text-ink-muted">Source: </span>{r.source}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const MODES = [
  { to: '/project/data-script', label: 'Full script', points: false },
  { to: '/project/data-points', label: 'Point form', points: true },
] as const

export default function ProjectScript({ points = false }: { points?: boolean }) {
  const [large, toggleLarge] = useStoredFlag(LARGE_TEXT_KEY)
  const size = large ? LARGE : NORMAL
  const { sections, sources } = presentationScript
  const title = points ? 'Proposal presentation: data portion in point form' : presentationScript.title
  const intro = points
    ? 'Key points to speak from, in the same order and with the same cues as the full script.'
    : presentationScript.intro
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <Link to="/project" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink mb-6">
        <ArrowLeft size={14} aria-hidden="true" /> Group Project
      </Link>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">{title}</h1>
        <p className="text-ink-secondary leading-relaxed max-w-2xl">{intro}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
      <nav aria-label="Script format" className="inline-flex rounded-full border border-edge bg-surface p-0.5">
        {MODES.map(m => (
          <Link
            key={m.to}
            to={m.to}
            aria-current={m.points === points ? 'page' : undefined}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              m.points === points ? 'bg-glow-dim text-glow' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={toggleLarge}
        aria-pressed={large}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          large ? 'bg-glow-dim text-glow border-glow/20' : 'bg-surface text-ink-muted border-edge hover:text-ink hover:border-edge-bright'
        }`}
      >
        <ALargeSmall size={15} aria-hidden="true" /> Large text
      </button>
      </div>

      {sections.map(s => <SlideCard key={s.slide} section={s} size={size} points={points} />)}

      <section aria-labelledby="sources" className="mt-12">
        <div className="flex items-center gap-2 mb-2">
          <Database size={18} className="text-glow flex-shrink-0" aria-hidden="true" />
          <h2 id="sources" className="text-xl font-bold text-ink">Sources for the numbers</h2>
        </div>
        <p className="text-sm text-ink-secondary leading-relaxed mb-5 max-w-2xl">Where each number in the script comes from.</p>
        <SourcesTable rows={sources} />
      </section>
    </div>
  )
}
