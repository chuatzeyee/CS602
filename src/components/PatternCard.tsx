// One question pattern, collapsible: how to spot it, steps, formulas, tool settings, pitfalls, past papers, worked examples.
import { Link } from 'react-router-dom'
import type { QuestionPattern } from '../data/patterns'
import { examplesFor, pastPartsFor } from '../data/worked'
import { anticipated } from '../data/anticipated'

const H = ({ children }: { children: string }) => <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mt-4 mb-1.5">{children}</h3>

interface Props { p: QuestionPattern; open?: boolean; matched?: string[]; anchor?: boolean }

// anchor: only the card in the full list carries the #pattern-<id> target, so spotter copies don't duplicate ids
export default function PatternCard({ p, open, matched, anchor }: Props) {
  const past = pastPartsFor(p)
  const examples = examplesFor(p)
  const likely = anticipated.filter(q => q.topic === p.id)
  return (
    <details id={anchor ? `pattern-${p.id}` : undefined} open={open} className="bg-surface border border-edge rounded-lg scroll-mt-6">
      <summary className="cursor-pointer px-4 py-3">
        <span className="text-sm font-semibold text-ink">{p.title}</span>
        <span className="block text-xs text-ink-muted mt-0.5">{p.spot}</span>
        {matched && matched.length > 0 && <span className="block text-[11px] text-glow mt-1 font-mono">matched: {matched.join(', ')}</span>}
      </summary>
      <div className="px-4 pb-4 border-t border-edge">
        <H>Cue words</H>
        <p className="text-xs text-ink-secondary">{p.cues.join(', ')}</p>
        <H>Steps</H>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-ink">{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        {p.formulas.length > 0 && <>
          <H>Formulas</H>
          <ul className="space-y-2">
            {p.formulas.map(f => (
              <li key={f.label} className="text-sm">
                <span className="text-ink-secondary">{f.label}</span>
                <pre className="font-mono text-xs text-glow bg-raised border border-edge rounded px-3 py-1.5 mt-0.5 whitespace-pre-wrap break-all">{f.f}</pre>
                {f.where && <span className="text-xs text-ink-muted">{f.where}</span>}
              </li>
            ))}
          </ul>
        </>}
        {p.tool && <>
          <H>Dialog settings</H>
          <ol className="list-decimal pl-5 space-y-0.5 text-sm text-ink">{p.tool.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>}
        <H>Pitfalls</H>
        <ul className="list-disc pl-5 space-y-1 text-sm text-ink-secondary">{p.pitfalls.map((s, i) => <li key={i}>{s}</li>)}</ul>
        {p.answer && <>
          <H>How to write the answer</H>
          <p className="text-sm text-ink bg-raised border border-edge rounded px-3 py-2">{p.answer}</p>
        </>}
        {past.length > 0 && <>
          <H>{`In past papers (${past.length} parts)`}</H>
          <ul className="space-y-0.5 text-xs text-ink-secondary">
            {past.map((x, i) => <li key={i}>{x.paper} {x.question}({x.label}), {x.marks} mark{x.marks === 1 ? '' : 's'}: {x.focus}</li>)}
          </ul>
        </>}
        {likely.length > 0 && <>
          <H>{`Likely exam questions (${likely.length})`}</H>
          <ul className="space-y-2">
            {likely.map(q => (
              <li key={q.id} className="text-sm">
                <details>
                  <summary className="cursor-pointer text-ink">{q.question}</summary>
                  <div className="mt-1 pl-4 space-y-1">
                    <p className="text-xs text-ink-muted">{q.layout}</p>
                    {q.formulas.map((f, i) => <pre key={i} className="font-mono text-xs text-glow bg-raised border border-edge rounded px-2 py-1 whitespace-pre-wrap break-all">{f.cell}: {f.formula}</pre>)}
                    {q.tool && <ol className="list-decimal pl-5 text-xs text-ink">{q.tool.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                    {q.answer && <p className="text-xs text-ink-secondary">{q.answer}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>}
        {examples.length > 0 && <>
          <H>Worked questions</H>
          <div className="flex flex-wrap gap-2">
            {examples.map(w => (
              <Link key={w.ex.id} to={`/bank/q/${w.ex.id}`} className="px-3 py-1 rounded-full bg-raised border border-edge text-xs text-ink-secondary hover:text-glow hover:border-glow/30">
                {w.source}: {w.ex.title}
              </Link>
            ))}
          </div>
        </>}
      </div>
    </details>
  )
}
