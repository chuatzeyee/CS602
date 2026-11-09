// One worked question: scenario, starting sheet, then every part with its steps, answer and explanation.
import type { Worked } from '../data/worked'
import { answerLines, cleanPrompt } from '../data/worked'
import SheetPreview from './SheetPreview'

export default function WorkedQuestion({ w }: { w: Worked }) {
  const { ex } = w
  return (
    <article>
      <p className="font-mono text-xs text-ink-muted mb-1">{w.source}{w.marks ? `, ${w.marks} marks` : ''}, level {ex.level}, about {ex.minutes} min</p>
      <h1 className="text-2xl font-bold text-ink mb-3">{ex.title}</h1>
      <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line mb-4">{ex.scenario}</p>
      <details className="mb-6">
        <summary className="cursor-pointer text-sm text-glow">Starting sheet layout</summary>
        <div className="mt-2"><SheetPreview sheet={ex.sheet} /></div>
      </details>
      <ol className="space-y-4">
        {ex.tasks.map((t, i) => {
          const ans = answerLines(t)
          return (
            <li key={t.id} className="bg-surface border border-edge rounded-lg p-4">
              <p className="text-sm text-ink leading-relaxed">
                <span className="font-mono text-xs text-ink-muted mr-2">{i + 1}.</span>{cleanPrompt(t.prompt)}
                {t.marks ? <span className="ml-2 font-mono text-xs text-ink-muted">[{t.marks}]</span> : null}
              </p>
              {t.hints && t.hints.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Steps</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm text-ink-secondary">
                    {t.hints.map((h, k) => <li key={k}>{cleanPrompt(h)}</li>)}
                  </ol>
                </div>
              )}
              {ans.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">{t.kind === 'explain' ? 'Model answer' : 'Answer'}</h3>
                  {t.kind === 'explain'
                    ? <p className="text-sm text-ink leading-relaxed">{ans[0]}</p>
                    : <pre className="font-mono text-xs text-glow bg-raised border border-edge rounded px-3 py-2 whitespace-pre-wrap break-all">{ans.join('\n')}</pre>}
                </div>
              )}
              {t.explain && <p className="mt-3 text-sm text-ink-secondary leading-relaxed"><span className="text-ink-muted">Why: </span>{cleanPrompt(t.explain)}</p>}
            </li>
          )
        })}
      </ol>
    </article>
  )
}
