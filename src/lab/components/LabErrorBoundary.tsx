// A render error in a lab page (a corrupt saved entry, a bug) shows a way out instead of blanking the whole app, nav
// included. When a newer deployment has replaced the code the page was built from ("Failed to fetch dynamically
// imported module"), the page reloads once to fetch it. No engine imports: the catalogue uses it too.
import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleAlert, RefreshCw, RotateCcw } from 'lucide-react'
import { btnPrimary, btnSecondary } from './ui'

interface LabErrorBoundaryProps {
  children: ReactNode
  backTo: string                  // where "back" goes: '/lab', '/exam'
  backLabel: string
  onReset?(): void                // clears the saved work that may be the cause; the page then starts fresh
  resetLabel?: string
}

interface State { error: Error | null }

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|Unable to preload/i
const RELOADED_AT = 'cs602-reloaded-at'

export const isChunkError = (e: Error): boolean => CHUNK_ERROR.test(e.message)

// reload at most once a minute, so a deployment that is really broken cannot loop
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

export default class LabErrorBoundary extends Component<LabErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error): void {
    if (isChunkError(error)) reloadOnce()
  }

  private reset = (): void => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { backTo, backLabel, onReset, resetLabel } = this.props
    const stale = isChunkError(error)
    return (
      <div role="alert" className="max-w-xl mx-auto px-6 py-16 text-center animate-fade-in">
        <CircleAlert size={32} className="mx-auto text-wrong mb-3" aria-hidden />
        <h2 className="text-xl font-bold text-ink mb-2">{stale ? 'This page has been updated' : 'Something went wrong here'}</h2>
        <p className="text-sm text-ink-secondary leading-relaxed mb-5">
          {stale
            ? 'A newer version of the site was published since you opened it. Reload the page to get it; your saved work is kept.'
            : `This part of the lab stopped with an error. Reloading usually helps; your saved work is kept${onReset ? ' unless you clear it' : ''}.`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={btnPrimary} onClick={() => window.location.reload()}>
            <RefreshCw size={14} aria-hidden /> Reload the page
          </button>
          {onReset && !stale && (
            <button type="button" className={btnSecondary} onClick={this.reset}>
              <RotateCcw size={14} aria-hidden /> {resetLabel ?? 'Clear my saved work and start again'}
            </button>
          )}
          <Link to={backTo} className={btnSecondary}>
            <ArrowLeft size={14} aria-hidden /> {backLabel}
          </Link>
        </div>
        {!stale && <p className="mt-5 text-[11px] text-ink-muted font-mono break-words">{error.message}</p>}
      </div>
    )
  }
}
