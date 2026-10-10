// shared class strings for the lab ui (portal dark theme tokens)
const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/40 disabled:opacity-40 disabled:pointer-events-none'

export const btn = `${btnBase} px-3 py-1.5`
export const btnPrimary = `${btn} bg-glow-dim text-glow border-glow/25 hover:bg-glow/15`
export const btnSecondary = `${btn} bg-raised text-ink-secondary border-edge hover:text-ink hover:border-edge-bright`
export const btnDanger = `${btn} bg-wrong-dim/60 text-wrong border-wrong/30 hover:bg-wrong-dim`
export const btnGhost = `${btn} bg-transparent text-ink-muted border-transparent hover:text-ink hover:bg-raised`
export const btnTool = `${btnBase} px-2 py-1.5 bg-transparent text-ink-secondary border-transparent hover:text-ink hover:bg-raised`

export const input =
  'w-full bg-surface border border-edge rounded-md px-2.5 py-1.5 text-sm text-ink ' +
  'focus:outline-none focus:border-glow/50 disabled:opacity-50'
export const monoInput = `${input} font-mono`
export const label = 'block text-xs font-medium text-ink-secondary mb-1'
export const chip = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium'

export const card = 'bg-surface border border-edge rounded-lg'
