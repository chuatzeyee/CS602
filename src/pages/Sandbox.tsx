import { Link } from 'react-router-dom'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import type { Exercise } from '../lab/types'
import Player from '../lab/components/Player'
import LabErrorBoundary from '../lab/components/LabErrorBoundary'
import { clearExerciseProgress } from '../lab/progress'

const SANDBOX: Exercise = {
  id: 'sandbox',
  week: 'W1',
  topic: 'Sandbox',
  title: 'Sandbox',
  level: 1,
  minutes: 0,
  scenario: '',
  sheet: { name: 'Sheet1', rows: 100, cols: 26, cells: {} },
  tasks: [],
  skills: [],
}

// the header sits above the sheet: below lg keep the grid's last rows and the status bar clear of the bottom nav pill
const HEIGHTS = { sheet: 'h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-12rem)]', panel: '' }

export default function Sandbox() {
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <Link to="/lab" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"><ArrowLeft size={14} /> Excel Lab</Link>
        <span className="text-ink-faint text-xs">/</span>
        <h1 className="flex items-center gap-1.5 text-sm font-semibold text-ink"><FlaskConical size={15} className="text-glow" /> Sandbox</h1>
        <p className="text-xs text-ink-muted basis-full sm:basis-auto sm:ml-2">
          A blank 100 × 26 sheet with every tool and the VBA editor. Nothing is checked; your work is saved on this device.
        </p>
      </div>
      <LabErrorBoundary backTo="/lab" backLabel="Back to the Excel Lab" onReset={() => clearExerciseProgress(SANDBOX.id)} resetLabel="Clear the sandbox and start again">
        <Player exercise={SANDBOX} mode="sandbox" progressId={SANDBOX.id} heights={HEIGHTS} />
      </LabErrorBoundary>
    </div>
  )
}
