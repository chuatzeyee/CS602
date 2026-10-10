import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  ClipboardCheck,
  Sigma,
  FlaskConical,
  Table2,
  GraduationCap,
  Users,
  CalendarDays,
} from 'lucide-react'

const SITE = 'CS602 SheetSmith'

// title = the page's own heading, used for the browser tab
const navItems = [
  { to: '/', label: 'Home', title: SITE, icon: Home },
  { to: '/topics', label: 'Topics', title: 'Topics & Glossary', icon: BookOpen },
  { to: '/quiz', label: 'Quiz', title: 'Practice Quiz', icon: ClipboardCheck },
  { to: '/functions', label: 'Functions', title: 'Function Bank', icon: Sigma },
  { to: '/models', label: 'Models', title: 'Model Walkthroughs', icon: FlaskConical },
  { to: '/lab', label: 'Excel Lab', title: 'Excel Lab', icon: Table2 },
  { to: '/exam', label: 'Exam', title: 'Exam Prep', icon: GraduationCap },
  { to: '/project', label: 'Project', title: 'Group Project', icon: Users },
  { to: '/course', label: 'Course', title: 'Course Map', icon: CalendarDays },
] as const

const HEADING_WAIT_FRAMES = 120 // lazy pages (lab, exam, project) render their heading once the chunk arrives

const isCurrent = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))

// every route gets its own tab title, so history, bookmarks and screen readers can tell the pages apart
function useRouteTitle(pathname: string) {
  useEffect(() => {
    const item = navItems.find(n => isCurrent(n.to, pathname))
    document.title = item && item.title !== SITE ? `${item.title} · ${SITE}` : SITE
  }, [pathname])
}

// keyboard users who pick a page here continue from its heading instead of from the pill at the end of the document
function useFocusHeadingAfterKeyboardNav(pathname: string) {
  const pending = useRef(false)
  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    let frame = 0
    let tries = 0
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>('#main-content h1')
      if (heading) {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      } else if (++tries < HEADING_WAIT_FRAMES) {
        frame = requestAnimationFrame(focusHeading)
      }
    }
    frame = requestAnimationFrame(focusHeading)
    return () => cancelAnimationFrame(frame)
  }, [pathname])
  // a click with detail 0 came from Enter (or a screen reader), not from a pointer; modified clicks open a new tab
  return (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
    pending.current = e.detail === 0 && !modified && to !== pathname
  }
}

export default function NavPill() {
  const { pathname } = useLocation()
  useRouteTitle(pathname)
  const onNavigate = useFocusHeadingAfterKeyboardNav(pathname)

  return (
    <nav aria-label="Main" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      {/* below 360px the gaps and padding tighten so all nine items still fit (282px at 320px) */}
      <div className="flex items-center gap-0.5 min-[360px]:gap-1 px-1.5 min-[360px]:px-2 py-2 bg-base/95 backdrop-blur-md border border-edge-bright rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            title={label}
            onClick={e => onNavigate(e, to)}
            className={({ isActive }) =>
              `flex items-center gap-2 px-1.5 min-[360px]:px-2 lg:px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-glow-dim text-glow shadow-[0_0_12px_rgba(74,222,128,0.12)]'
                  : 'text-ink-muted hover:text-ink hover:bg-raised'
              }`
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
