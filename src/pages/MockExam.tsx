import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'
import { mocks } from '../data/lab'
import MockExamView from '../lab/components/MockExamView'
import LabErrorBoundary from '../lab/components/LabErrorBoundary'

export default function MockExam() {
  const { mockId = '' } = useParams()
  const mock = mocks.find(m => m.id === mockId)
  if (!mock) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center animate-fade-in">
        <SearchX size={36} className="mx-auto text-ink-muted mb-4" />
        <h1 className="text-2xl font-bold text-ink mb-2">Mock exam not found</h1>
        <p className="text-ink-secondary mb-6">
          There is no mock exam called <span className="font-mono text-ink">{mockId || '(blank)'}</span>.
        </p>
        <Link to="/exam" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-glow-dim text-glow border border-glow/20 hover:bg-glow/15">
          <ArrowLeft size={15} /> Back to Exam
        </Link>
      </div>
    )
  }
  return (
    <LabErrorBoundary key={mock.id} backTo="/exam" backLabel="Back to Exam">
      <MockExamView mock={mock} />
    </LabErrorBoundary>
  )
}
