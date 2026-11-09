// true only in the single-file exam copy (scripts/build-offline.mjs sets VITE_OFFLINE=1): a reference-only build with
// search, notes, functions, models and exam reference; no home page, footer, practice tools or lab engine.
export const OFFLINE: boolean = import.meta.env.VITE_OFFLINE === '1'

// routes that exist in the offline copy; links elsewhere are hidden there
export const OFFLINE_ROUTES = ['/search', '/bank', '/formulas', '/kit', '/topics', '/functions', '/models', '/exam'] as const
export const routeAvailable = (to: string): boolean =>
  !OFFLINE || OFFLINE_ROUTES.some(r => to === r || to.startsWith(`${r}?`) || to.startsWith(`${r}/`))
