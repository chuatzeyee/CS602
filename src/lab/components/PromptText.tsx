import { Fragment, useRef, useState } from 'react'
import FunctionCard from './FunctionCard'
import { isFunctionName } from './functionInfo'

function FunctionChip({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${name}: syntax and notes`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="inline-flex items-center font-mono text-[0.85em] leading-tight text-glow bg-glow-dim/50 border border-glow/20 rounded px-1.5 py-px mx-px hover:bg-glow-dim hover:border-glow/40 transition-colors align-baseline"
      >
        {name}
      </button>
      {open && <FunctionCard name={name} anchor={ref.current} onClose={() => setOpen(false)} />}
    </>
  )
}

// task prompt text: `NAME` becomes a function chip, other backticked text inline code
export default function PromptText({ text }: { text: string }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{p}</Fragment>
        ) : isFunctionName(p) ? (
          <FunctionChip key={i} name={p} />
        ) : (
          <code key={i} className="font-mono text-[0.85em] text-ink bg-raised border border-edge rounded px-1 py-px break-words">{p}</code>
        ),
      )}
    </>
  )
}
