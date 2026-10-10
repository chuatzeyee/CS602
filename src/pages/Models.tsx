import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { walkthroughs as labs } from '../data/walkthroughs'
import { weekDot, weekOrder, weekText } from '../data/weeks'
import type { Lab } from '../data/types'

const weeks = weekOrder(labs.map(l => l.week))

// tab label = workbook name; repeated names get a part number
function tabLabels(list: readonly Lab[]): string[] {
  const names = list.map(l => l.title.split(/:\s| — /)[0])
  return names.map((n, i) => {
    const total = names.filter(x => x === n).length
    return total > 1 ? `${n} · part ${names.slice(0, i + 1).filter(x => x === n).length}` : n
  })
}

export default function Models() {
  const [week, setWeek] = useState(weeks[0])
  const [labIdx, setLabIdx] = useState(0)
  const inWeek = labs.filter(l => l.week === week)
  const lab = inWeek[Math.min(labIdx, inWeek.length - 1)]
  const labels = tabLabels(inWeek)

  if (!lab) return null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div role="group" aria-label="Week" className="flex flex-wrap gap-1.5 mb-3">
        {weeks.map(w => (
          <button
            key={w}
            onClick={() => { setWeek(w); setLabIdx(0) }}
            aria-pressed={w === week}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${w === week ? 'bg-glow-dim text-glow border border-glow/20' : 'bg-surface text-ink-muted border border-edge hover:text-ink'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${weekDot(w)}`} />
            {w}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Walkthrough" className="flex flex-wrap gap-2 mb-8">
        {inWeek.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setLabIdx(i)}
            aria-pressed={l.id === lab.id}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors duration-150 ${
              l.id === lab.id
                ? 'bg-glow-dim text-glow border-glow/30'
                : 'bg-surface text-ink-secondary border-edge hover:border-glow/20'
            }`}
          >
            {labels[i]}
          </button>
        ))}
      </div>

      <div key={lab.id}>
        <div className="mb-8 animate-fade-in">
          <p className={`font-mono text-xs mb-2 ${weekText(lab.week)}`}>{lab.week} · model walkthrough</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-2 break-words">{lab.title}</h1>
          <p className="text-ink-secondary leading-relaxed">{lab.overview}</p>
        </div>

        <div className="space-y-4 mb-10">
          {lab.steps.map((s, i) => (
            <div key={i} className="bg-surface border border-edge rounded-lg p-5 animate-fade-in" style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationFillMode: 'both' }}>
              <h2 className="font-semibold text-ink mb-2">
                <span className="font-mono text-glow mr-2">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              <p className="text-sm text-ink-secondary leading-relaxed mb-3">{s.explanation}</p>
              {s.code && (
                <pre className="text-xs font-mono text-ink bg-raised border border-edge rounded-md px-4 py-3 overflow-x-auto whitespace-pre">
                  {s.code}
                </pre>
              )}
            </div>
          ))}
        </div>

        <div className="bg-glow-dim/40 border border-glow/15 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-glow" />
            <h2 className="font-semibold text-ink">Key takeaways</h2>
          </div>
          <ul className="space-y-2">
            {lab.takeaways.map((t, i) => (
              <li key={i} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed">
                <span className="text-glow mt-0.5">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
