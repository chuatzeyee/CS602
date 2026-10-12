import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import NavPill from './components/NavPill'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Topics from './pages/Topics'
import Quiz from './pages/Quiz'
import Functions from './pages/Functions'
import Models from './pages/Models'
import Course from './pages/Course'
import LabErrorBoundary from './lab/components/LabErrorBoundary'

// lab pages pull in the formula engine (~200 KB gz): load them on demand
const Lab = lazy(() => import('./pages/Lab'))
const LabPlayer = lazy(() => import('./pages/LabPlayer'))
const Sandbox = lazy(() => import('./pages/Sandbox'))
const MockExam = lazy(() => import('./pages/MockExam'))
const Exam = lazy(() => import('./pages/Exam'))
const Project = lazy(() => import('./pages/Project'))
const ProjectScript = lazy(() => import('./pages/ProjectScript'))

const loading = <div className="max-w-3xl mx-auto px-4 pt-12 text-ink-muted text-sm">Loading…</div>

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="min-h-screen bg-void">
      <main id="main-content" className="pb-24 scroll-smooth">
        <LabErrorBoundary key={pathname} backTo="/" backLabel="Home">
          <Suspense fallback={loading}>
            <Routes>
              <Route path="/" element={<Home />} />
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
              <Route path="/course" element={<Course />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </LabErrorBoundary>
        <footer className="max-w-5xl mx-auto px-4 pt-16 text-[11px] leading-relaxed text-ink-muted">
          Unofficial study guide for SMU IS602/CS602, not affiliated with or endorsed by SMU. Notes, exercises and mock exams are
          original; course materials belong to their owners. Code licensed{' '}
          <a href={`${import.meta.env.BASE_URL}LICENSE.txt`} className="underline hover:text-ink-secondary">GPL-3.0-or-later</a> ·
          Spreadsheet engine: HyperFormula (GPLv3) ·{' '}
          <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.txt`} className="underline hover:text-ink-secondary">third-party licences</a> ·{' '}
          <a href="https://github.com/chuatzeyee/CS602" className="underline hover:text-ink-secondary">Source on GitHub</a>
        </footer>
      </main>
      <NavPill />
      <ScrollToTop />
    </div>
  )
}
