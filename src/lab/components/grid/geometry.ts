// grid layout maths: column offsets, visible (non-hidden) rows, frozen block, layer rectangles, hit testing

export const ROW_H = 24
export const HEADER_H = 24
export const ROW_HEADER_W = 44
export const DEFAULT_COL_W = 84
export const CHAR_W = 7.2           // JetBrains Mono at 12px: 0.6em advance
export const CELL_PAD = 6           // left + right text padding inside a cell, plus the grid line

export interface Rect { left: number; top: number; width: number; height: number }
export interface LayerRects { frozen?: Rect; body?: Rect; clipTop: boolean; clipBottom: boolean }

export interface Geometry {
  rows: number
  cols: number
  colW: number[]
  colX: number[]          // cumulative widths, length cols + 1 (content x excluding the row header)
  visRows: number[]       // rows not hidden, ascending (0-based)
  rowPos: Int32Array      // row -> index in visRows, -1 when hidden
  frozen: number          // how many of visRows sit in the frozen block
  frozenH: number
  bodyH: number
  totalW: number          // row header + all columns
}

export interface GeometryInput {
  rows: number
  cols: number
  colWidths?: Record<string, number>
  hidden: ReadonlySet<number>       // 1-based, like LabSheet.hiddenRows
  frozenRows?: number
  showFormulas: boolean
  colLetter: (c: number) => string
}

export function buildGeometry(g: GeometryInput): Geometry {
  const colW: number[] = []
  const colX: number[] = [0]
  for (let c = 0; c < g.cols; c++) {
    const base = g.colWidths?.[g.colLetter(c)] ?? DEFAULT_COL_W
    const w = g.showFormulas ? Math.max(Math.round(base * 1.75), 120) : base
    colW.push(w)
    colX.push(colX[c] + w)
  }
  const visRows: number[] = []
  const rowPos = new Int32Array(g.rows).fill(-1)
  for (let r = 0; r < g.rows; r++) {
    if (g.hidden.has(r + 1)) continue
    rowPos[r] = visRows.length
    visRows.push(r)
  }
  const fr = Math.max(0, Math.min(g.frozenRows ?? 0, g.rows))
  let frozen = 0
  while (frozen < visRows.length && visRows[frozen] < fr) frozen++
  return {
    rows: g.rows, cols: g.cols, colW, colX, visRows, rowPos, frozen,
    frozenH: frozen * ROW_H,
    bodyH: (visRows.length - frozen) * ROW_H,
    totalW: ROW_HEADER_W + colX[g.cols],
  }
}

/** first visible row index (into visRows) at or after row r, or -1 */
function visAtOrAfter(geo: Geometry, r: number): number {
  for (let x = Math.max(0, r); x < geo.rows; x++) if (geo.rowPos[x] >= 0) return geo.rowPos[x]
  return -1
}

/** last visible row index at or before row r, or -1 */
function visAtOrBefore(geo: Geometry, r: number): number {
  for (let x = Math.min(geo.rows - 1, r); x >= 0; x--) if (geo.rowPos[x] >= 0) return geo.rowPos[x]
  return -1
}

/** rectangle of a cell range split between the frozen block and the scrolling body (layer coordinates) */
export function rangeRects(geo: Geometry, r1: number, c1: number, r2: number, c2: number): LayerRects {
  const out: LayerRects = { clipTop: false, clipBottom: false }
  const a = visAtOrAfter(geo, r1)
  const b = visAtOrBefore(geo, r2)
  if (a < 0 || b < 0 || a > b) return out
  const cl = Math.max(0, Math.min(c1, c2))
  const cr = Math.min(geo.cols - 1, Math.max(c1, c2))
  const left = ROW_HEADER_W + geo.colX[cl]
  const width = geo.colX[cr + 1] - geo.colX[cl]
  if (a < geo.frozen) {
    const end = Math.min(b, geo.frozen - 1)
    out.frozen = { left, width, top: a * ROW_H, height: (end - a + 1) * ROW_H }
  }
  if (b >= geo.frozen) {
    const start = Math.max(a, geo.frozen)
    out.body = { left, width, top: (start - geo.frozen) * ROW_H, height: (b - start + 1) * ROW_H }
  }
  out.clipTop = out.frozen !== undefined && out.body !== undefined
  out.clipBottom = out.clipTop
  return out
}

/** column under a content x (excluding the row header), clamped */
export function colAtX(geo: Geometry, x: number): number {
  if (x <= 0) return 0
  let lo = 0
  let hi = geo.cols - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (geo.colX[mid] <= x) lo = mid
    else hi = mid - 1
  }
  return lo
}

export interface Hit { r: number; c: number; zone: 'cell' | 'colHeader' | 'rowHeader' | 'corner' }

/** what sits under a point given relative to the scroll viewport's top-left corner */
export function hitTest(geo: Geometry, x: number, y: number, scrollLeft: number, scrollTop: number): Hit | null {
  if (!geo.visRows.length || !geo.cols) return null
  const inRowHeader = x < ROW_HEADER_W
  const c = colAtX(geo, x + scrollLeft - ROW_HEADER_W)
  if (y < HEADER_H) return { r: geo.visRows[0], c, zone: inRowHeader ? 'corner' : 'colHeader' }
  let idx: number
  if (y < HEADER_H + geo.frozenH) idx = Math.floor((y - HEADER_H) / ROW_H)
  else idx = geo.frozen + Math.floor((y - HEADER_H - geo.frozenH + scrollTop) / ROW_H)
  idx = Math.max(0, Math.min(geo.visRows.length - 1, idx))
  return { r: geo.visRows[idx], c, zone: inRowHeader ? 'rowHeader' : 'cell' }
}

/** scroll position that brings a cell into view (null when no change needed) */
export function scrollToReveal(
  geo: Geometry, r: number, c: number,
  view: { scrollLeft: number; scrollTop: number; width: number; height: number },
): { left: number; top: number } | null {
  let { scrollLeft: left, scrollTop: top } = view
  const idx = geo.rowPos[r]
  if (idx >= geo.frozen) {
    const b = idx - geo.frozen
    const rowTop = b * ROW_H
    const visibleH = view.height - HEADER_H - geo.frozenH
    if (rowTop < top) top = rowTop
    else if (rowTop + ROW_H > top + visibleH) top = rowTop + ROW_H - Math.max(ROW_H, visibleH)
  }
  if (c >= 0 && c < geo.cols) {
    const x = geo.colX[c]
    const w = geo.colW[c]
    const visibleW = view.width - ROW_HEADER_W
    if (x < left) left = x
    else if (x + w > left + visibleW) left = Math.min(x, x + w - visibleW)
  }
  if (left === view.scrollLeft && top === view.scrollTop) return null
  return { left: Math.max(0, left), top: Math.max(0, top) }
}

/** body rows to render for a scroll position (indices into the body part of visRows) */
export function bodyWindow(geo: Geometry, scrollTop: number, viewH: number, buffer = 12): [number, number] {
  const count = geo.visRows.length - geo.frozen
  const block = Math.floor(Math.max(0, scrollTop) / ROW_H / 6) * 6   // quantised: fewer re-renders while scrolling
  const start = Math.max(0, block - buffer)
  const end = Math.min(count, block + Math.ceil(viewH / ROW_H) + buffer + 6)
  return [Math.min(start, count), end]
}
