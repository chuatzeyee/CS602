// highlights every occurrence of the search terms in a piece of text
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default function Marked({ text, ts }: { text: string; ts: readonly string[] }) {
  if (ts.length === 0) return <>{text}</>
  const re = new RegExp(`(${ts.map(escapeRe).join('|')})`, 'gi')
  return <>{text.split(re).map((part, i) => (i % 2 ? <span key={i} className="highlight-match">{part}</span> : part))}</>
}
