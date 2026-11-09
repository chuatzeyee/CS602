import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import NavPill from './components/NavPill'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Topics from './pages/Topics'
import Quiz from './pages/Quiz'
import Functions from './pages/Functions'
import Models from './pages/Models'
import Course from './pages/Course'
import LabErrorBoundary from './lab/components/LabErrorBoundary'
import { OFFLINE } from './offline'

// lab pages pull in the formula engine (~200 KB gz): load them on demand
const Lab = lazy(() => import('./pages/Lab'))
const LabPlayer = lazy(() => import('./pages/LabPlayer'))
const Sandbox = lazy(() => import('./pages/Sandbox'))
const MockExam = lazy(() => import('./pages/MockExam'))
const Exam = lazy(() => import('./pages/Exam'))
const Project = lazy(() => import('./pages/Project'))
const ProjectScript = lazy(() => import('./pages/ProjectScript'))
const Study = lazy(() => import('./pages/Study'))
const Search = lazy(() => import('./pages/Search'))
const Bank = lazy(() => import('./pages/Bank'))
const Formulas = lazy(() => import('./pages/Formulas'))
const Kit = lazy(() => import('./pages/Kit'))
const BankQuestion = lazy(() => import('./pages/Bank').then(m => ({ default: m.BankQuestion })))

// Ctrl/Cmd+K anywhere, or '/' outside a text field, opens Search
function useSearchShortcut() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        navigate('/search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}

const loading = <div className="max-w-3xl mx-auto px-4 pt-12 text-ink-muted text-sm">Loading...</div>

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useSearchShortcut()

  return (
    <div className="min-h-screen bg-void">
      <main id="main-content" className="pb-24 scroll-smooth">
        <LabErrorBoundary key={pathname} backTo="/" backLabel="Home">
          <Suspense fallback={loading}>
            {OFFLINE ? (
              <Routes>
                <Route path="/search" element={<Search />} />
                <Route path="/bank" element={<Bank />} />
                <Route path="/formulas" element={<Formulas />} />
                <Route path="/kit" element={<Kit />} />
                <Route path="/bank/q/:id" element={<BankQuestion />} />
                <Route path="/topics" element={<Topics />} />
                <Route path="/functions" element={<Functions />} />
                <Route path="/models" element={<Models />} />
                <Route path="/exam" element={<Exam />} />
                <Route path="*" element={<Navigate to="/search" replace />} />
              </Routes>
            ) : (
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/study" element={<Study />} />
                <Route path="/search" element={<Search />} />
                <Route path="/bank" element={<Bank />} />
                <Route path="/formulas" element={<Formulas />} />
                <Route path="/kit" element={<Kit />} />
                <Route path="/bank/q/:id" element={<BankQuestion />} />
                <Route path="/topics" element={<Topics />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/functions" element={<Functions />} />
                <Route path="/models" element={<Models />} />
                <Route path="/lab" element={<Lab />} />
                <Route path="/lab/sandbox" element={<Sandbox />} />
                <Route path="/lab/:exerciseId" element={<LabPlayer />} />
                <Route path="/exam" element={<Exam />} />
                <Route path="/exam/mock/:mockId" element={<MockExam />} />
                <Route path="/project" element={<Project />} />
                <Route path="/project/data-script" element={<ProjectScript />} />
                <Route path="/project/data-points" element={<ProjectScript points />} />
                <Route path="/course" element={<Course />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </Suspense>
        </LabErrorBoundary>
        {!OFFLINE && (
        <footer className="max-w-5xl mx-auto px-4 pt-16 text-[11px] leading-relaxed text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
          <a href={`${import.meta.env.BASE_URL}LICENSE.txt`} className="underline hover:text-ink-secondary">Code licence: GPL-3.0-or-later</a>
          <span>Spreadsheet engine: HyperFormula (GPLv3)</span>
          <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.txt`} className="underline hover:text-ink-secondary">Third-party licences</a>
        </footer>
        )}
      </main>
      <NavPill />
      <ScrollToTop />
    </div>
  )
}
