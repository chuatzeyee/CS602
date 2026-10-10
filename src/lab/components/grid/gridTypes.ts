// shared state shapes for the spreadsheet controller (selection, editing, clipboard, drags)
import type { LabSheet } from '../../types'
import type { Geometry } from './geometry'
import type { Box, Pos } from './navigate'

export interface Sel { anchor: Pos; extent: Pos; active: Pos }

export type EditMode = 'enter' | 'edit'
export interface Edit {
  r: number
  c: number
  text: string
  caret: number
  where: 'cell' | 'bar'
  mode: EditMode
  original: string
}

export interface Clip { box: Box; tsv: string; cut: boolean }

// the reference inserted by point mode, so the next arrow/click replaces it
export interface PointState { start: number; end: number; anchor: Pos; extent: Pos }

export type Drag =
  | { kind: 'cells' }
  | { kind: 'cols'; from: number }
  | { kind: 'rows'; from: number }
  | { kind: 'point' }
  | { kind: 'fill'; src: Box }

export interface FillPreview { box: Box; dir: 'down' | 'right' }

export type Tone = 'info' | 'error'

/** the controller's view of the world; refreshed every render, mutated by the setters for same-tick reads */
export interface GridCtx {
  sheet: LabSheet
  geo: Geometry
  bodies: Box[]
  readOnly: boolean
  sel: Sel
  edit: Edit | null
  clip: Clip | null
  fillPreview: FillPreview | null
  setSel(s: Sel): void
  setEdit(e: Edit | null): void
  setClip(c: Clip | null): void
  setFillPreview(p: FillPreview | null): void
  toggleFormulas(): void
  toast(text: string, tone?: Tone): void
  scrollEl(): HTMLDivElement | null
  cellInput(): HTMLInputElement | null
  barInput(): HTMLInputElement | null
  focusGrid(): void
  reveal(p: Pos): void
  pendingCaret: { current: number | null }
  point: { current: PointState | null }
  drag: { current: Drag | null }
  escaped: { current: boolean }      // the last key on the grid was Esc: the next Tab leaves the grid
  acPick(): string | null            // highlighted autocomplete entry, if the list is open
  acMove(delta: number): void
  acClose(): void
}

export const boxOfSel = (s: Sel): Box => ({
  r1: Math.min(s.anchor.r, s.extent.r), c1: Math.min(s.anchor.c, s.extent.c),
  r2: Math.max(s.anchor.r, s.extent.r), c2: Math.max(s.anchor.c, s.extent.c),
})

export const single = (b: Box): boolean => b.r1 === b.r2 && b.c1 === b.c2
