import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'

// exercise, sandbox and mock exam pages are sized around the spreadsheet: there the button would sit on the grid's
// corner and the status bar's Average / Count / Sum
const SHEET_PAGE = /^\/(lab|exam\/mock)\/[^/]+$/

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const { pathname } = useLocation()
  const shown = visible && !SHEET_PAGE.test(pathname)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // the button hides (aria-hidden) at the top: hand focus to the page heading so Tab continues from the top
    const heading = document.querySelector<HTMLElement>('#main-content h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-20 right-6 p-3 bg-glow-dim hover:bg-glow/20 text-glow rounded-full border border-glow/30 z-50 cursor-pointer transition-all duration-300 ${
        shown
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Scroll to top"
      aria-hidden={!shown || undefined}
      tabIndex={shown ? undefined : -1}
    >
      <ArrowUp size={20} />
    </button>
  )
}
