import { FileSpreadsheet, FileText } from 'lucide-react'
import { kitGroups, syntaxSheet } from '../data/kit'
import { OFFLINE } from '../offline'

const icon = (file: string) => (/\.xls[xm]?$/.test(file) ? FileSpreadsheet : FileText)

function Files() {
  return (
    <section className="mb-10 print:hidden">
      <h2 className="text-lg font-bold text-ink mb-1">Files in your exam kit</h2>
      <p className="text-sm text-ink-secondary mb-4">
        These open from the kit folder next to this page (keep the folder structure). Excel files open in Excel; PDFs in the browser.
      </p>
      {kitGroups.map(g => (
        <div key={g.title} className="mb-5">
          <h3 className="text-xs font-mono uppercase tracking-wide text-ink-muted mb-2">{g.title}</h3>
          <ul className="space-y-1">
            {g.files.map(f => {
              const Icon = icon(f.file)
              return (
                <li key={f.file}>
                  <a href={`./${f.file}`} className="flex gap-2 items-start text-sm text-ink hover:text-glow">
                    <Icon size={15} className="mt-0.5 shrink-0 text-ink-muted" />
                    <span>{f.label}{f.note && <span className="block text-xs text-ink-muted">{f.note}</span>}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function SyntaxSheet() {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-1 print:text-black">One-page syntax sheet</h2>
      <p className="text-sm text-ink-secondary mb-4 print:hidden">The formulas you are most likely to need, in the course's form. Print it with Ctrl+P if paper notes are allowed.</p>
      <div className="md:columns-2 gap-4 print:columns-3 print:gap-2">
        {syntaxSheet.map(b => (
          <div key={b.title} className="bg-surface border border-edge rounded-lg p-3 mb-4 break-inside-avoid print:bg-white print:border-gray-400 print:p-1.5 print:mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-glow mb-2 print:text-black print:mb-1">{b.title}</h3>
            <dl className="space-y-1.5 print:space-y-0.5">
              {b.rows.map(r => (
                <div key={r.what}>
                  <dt className="text-xs text-ink-secondary print:text-black print:text-[9px]">{r.what}</dt>
                  <dd className="font-mono text-[12px] text-ink print:text-black print:text-[9px] break-all">{r.f}</dd>
                  {r.note && <dd className="text-[11px] text-ink-muted print:text-gray-700 print:text-[8px]">{r.note}</dd>}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Kit() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 print:py-0 print:px-0">
      <h1 className="text-3xl font-bold text-ink mb-2 print:hidden">Exam Kit</h1>
      <p className="text-ink-secondary text-sm mb-8 print:hidden">
        {OFFLINE
          ? 'Course workbooks, solved mocks, past papers and slides, plus a one-page syntax sheet. Everything here works without internet.'
          : 'The one-page syntax sheet. The offline exam copy also links the course workbooks, solved mocks, past papers and slides.'}
      </p>
      {OFFLINE && <Files />}
      <SyntaxSheet />
    </div>
  )
}
