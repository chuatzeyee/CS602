import { CalendarDays, GraduationCap, BookMarked, Info } from 'lucide-react'
import { course } from '../data/course'
import { weekText } from '../data/weeks'

export default function Course() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 [overflow-wrap:anywhere]">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-ink mb-2">Course Map</h1>
        <p className="text-ink-secondary">
          {course.courseTitle}
          {course.instructor ? ` · ${course.instructor}` : ''}
        </p>
      </div>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={18} className="text-glow" />
          <h2 className="text-xl font-bold text-ink">Assessment</h2>
        </div>
        <div className="space-y-2.5">
          {course.assessments.map(a => (
            <div key={a.component} className="bg-surface border border-edge rounded-lg px-5 py-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-medium text-ink">{a.component}</span>
                <span className="font-mono text-glow bg-glow-dim px-2.5 py-0.5 rounded-full text-sm border border-glow/10 flex-shrink-0">{a.weight}</span>
              </div>
              {a.detail && <p className="text-sm text-ink-secondary leading-relaxed">{a.detail}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={18} className="text-glow" />
          <h2 className="text-xl font-bold text-ink">Schedule</h2>
        </div>
        <ol className="bg-surface border border-edge rounded-lg overflow-hidden">
          {course.schedule.map((s, i) => (
            <li key={i} className={`flex items-start gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-edge' : ''}`}>
              <span className={`font-mono text-xs bg-raised px-2 py-1 rounded border border-edge flex-shrink-0 mt-0.5 w-16 text-center ${weekText(s.week, 'text-ink-secondary')}`}>{s.week}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink leading-relaxed">{s.topic}</p>
                {s.note && <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">{s.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {course.textbooks && course.textbooks.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <BookMarked size={18} className="text-glow" />
            <h2 className="text-xl font-bold text-ink">Textbooks & References</h2>
          </div>
          <ul className="space-y-2">
            {course.textbooks.map((t, i) => (
              <li key={i} className="text-sm text-ink-secondary bg-surface border border-edge rounded-lg px-5 py-3 leading-relaxed">{t}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Info size={18} className="text-glow" />
          <h2 className="text-xl font-bold text-ink">Worth remembering</h2>
        </div>
        <ul className="space-y-2">
          {course.notes.map((n, i) => (
            <li key={i} className="text-sm text-ink-secondary flex gap-2.5 leading-relaxed bg-surface border border-edge rounded-lg px-5 py-3">
              <span className="text-glow mt-0.5 flex-shrink-0">→</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
