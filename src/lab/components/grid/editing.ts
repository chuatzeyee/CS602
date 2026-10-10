// in-cell / formula-bar editing: start, commit, cancel, point mode, F4, function autocomplete
import type { KeyboardEvent } from 'react'
import { autoCloseParens, cycleRef, functionPrefixAt, isFormulaText, isPointable, rangeText, spliceText } from './formulaText'
import { boxOfSel, single, type Edit, type EditMode, type GridCtx } from './gridTypes'
import { jump, moveWithin, step, type Pos } from './navigate'
import { boxText, isBlank, lockReason, refOf } from './sheetOps'
import { asOneStep } from '../../sheet'

export const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
}

export function startEdit(
  ctx: GridCtx,
  opts: { text?: string; mode: EditMode; where: 'cell' | 'bar'; caret?: number },
): boolean {
  const p = ctx.sel.active
  const why = lockReason(ctx.sheet, ctx.bodies, p.r, p.c, ctx.readOnly)
  if (why) {
    ctx.toast(why)
    return false
  }
  const original = ctx.sheet.raw(refOf(p.r, p.c))
  const text = opts.text ?? original
  const caret = Math.min(opts.caret ?? text.length, text.length)
  ctx.point.current = null
  const where = ctx.geo.rowPos[p.r] < 0 ? 'bar' : opts.where
  ctx.setEdit({ r: p.r, c: p.c, text, caret, where, mode: opts.mode, original })
  ctx.pendingCaret.current = caret
  ctx.reveal(p)
  return true
}

function editorInput(ctx: GridCtx, e: Edit): HTMLInputElement | null {
  return e.where === 'cell' ? ctx.cellInput() : ctx.barInput()
}

export function updateText(ctx: GridCtx, text: string, caret: number, keepPoint = false): void {
  const e = ctx.edit
  if (!e) return
  ctx.setEdit({ ...e, text, caret })
  ctx.pendingCaret.current = caret
  if (!keepPoint) ctx.point.current = null
}

/** after Enter / Tab: inside a multi-cell selection move within it, otherwise move the single cell */
export function moveAfterEntry(ctx: GridCtx, dr: number, dc: number): void {
  const b = boxOfSel(ctx.sel)
  if (!single(b)) {
    const a = moveWithin(ctx.geo, b, ctx.sel.active, dr, dc)
    ctx.setSel({ ...ctx.sel, active: a })
    ctx.reveal(a)
    return
  }
  const a = step(ctx.geo, ctx.sel.active, dr, dc)
  ctx.setSel({ anchor: a, extent: a, active: a })
  ctx.reveal(a)
}

export type After = { dr: number; dc: number; collapse?: boolean } | { to: Pos } | null

/** enter the edited text into the cell; false (editor stays open) when the sheet rejects it */
export function commit(ctx: GridCtx, after: After): boolean {
  const e = ctx.edit
  if (!e) return true
  const text = isFormulaText(e.text) ? autoCloseParens(e.text) : e.text
  if (text !== e.original) {
    const res = ctx.sheet.set(refOf(e.r, e.c), text)
    if (!res.ok) {
      ctx.toast(res.message, 'error')
      editorInput(ctx, e)?.focus()
      return false
    }
    if (ctx.clip) ctx.setClip(null)
  }
  ctx.point.current = null
  ctx.setEdit(null)
  if (after && 'to' in after) {
    ctx.setSel({ anchor: after.to, extent: after.to, active: after.to })
  } else if (after && after.collapse) {
    const a = step(ctx.geo, { r: e.r, c: e.c }, after.dr, after.dc)
    ctx.setSel({ anchor: a, extent: a, active: a })
    ctx.reveal(a)
  } else if (after) {
    moveAfterEntry(ctx, after.dr, after.dc)
  }
  ctx.focusGrid()
  return true
}

export function cancelEdit(ctx: GridCtx): void {
  ctx.point.current = null
  ctx.setEdit(null)
  ctx.focusGrid()
}

/** Ctrl+Enter: enter the formula into every selected cell (relative refs adjusted, like Excel), as one undo step */
function commitAll(ctx: GridCtx): void {
  const e = ctx.edit
  if (!e) return
  const b = boxOfSel(ctx.sel)
  asOneStep(ctx.sheet, () => {
    if (!commit(ctx, null)) return
    if (single(b) || e.r !== b.r1 || e.c !== b.c1) return
    const firstRow = { ...b, r2: b.r1 }
    if (b.c2 > b.c1) ctx.sheet.fill(refOf(b.r1, b.c1), boxText(firstRow))
    if (b.r2 > b.r1) ctx.sheet.fill(boxText(firstRow), boxText(b))
    ctx.setSel({ anchor: { r: b.r1, c: b.c1 }, extent: { r: b.r2, c: b.c2 }, active: { r: b.r1, c: b.c1 } })
  })
}

/** the point-mode reference that sits right before the caret, if any */
function activePoint(ctx: GridCtx, e: Edit, caret: number) {
  const pt = ctx.point.current
  if (!pt || pt.end !== caret) return null
  const ref = rangeText(pt.anchor.r, pt.anchor.c, pt.extent.r, pt.extent.c)
  return e.text.slice(pt.start, pt.end) === ref ? pt : null
}

export function canPoint(ctx: GridCtx, e: Edit, caret: number): boolean {
  return isFormulaText(e.text) && (activePoint(ctx, e, caret) !== null || isPointable(e.text, caret))
}

function setPoint(ctx: GridCtx, e: Edit, start: number, end: number, anchor: Pos, extent: Pos): void {
  const ref = rangeText(anchor.r, anchor.c, extent.r, extent.c)
  const out = spliceText(e.text, start, end, ref)
  updateText(ctx, out.text, out.caret)
  ctx.point.current = { start, end: start + ref.length, anchor, extent }
  ctx.reveal(extent)
}

function pointByKey(ctx: GridCtx, e: Edit, caret: number, dr: number, dc: number, shift: boolean, ctrl: boolean): void {
  const pt = activePoint(ctx, e, caret)
  const from = pt ? pt.extent : { r: e.r, c: e.c }
  const blank = (r: number, c: number) => isBlank(ctx.sheet, r, c)
  const to = ctrl ? jump(ctx.geo, from, dr, dc, blank) : step(ctx.geo, from, dr, dc)
  const anchor = pt && shift ? pt.anchor : to
  setPoint(ctx, e, pt ? pt.start : caret, pt ? pt.end : caret, anchor, to)
}

/** click (or drag) on the grid while a formula is open at a pointable position */
export function pointAt(ctx: GridCtx, p: Pos, extend: boolean): void {
  const e = ctx.edit
  if (!e) return
  const pt = ctx.point.current
  if (extend && pt) {
    setPoint(ctx, e, pt.start, pt.end, pt.anchor, p)
    return
  }
  const caret = editorInput(ctx, e)?.selectionStart ?? e.caret
  const cur = activePoint(ctx, e, caret)
  setPoint(ctx, e, cur ? cur.start : caret, cur ? cur.end : caret, p, p)
}

export function wantsPoint(ctx: GridCtx): boolean {
  const e = ctx.edit
  if (!e) return false
  const caret = editorInput(ctx, e)?.selectionStart ?? e.caret
  return canPoint(ctx, e, caret)
}

export function insertFunction(ctx: GridCtx, name: string): void {
  const e = ctx.edit
  if (!e) return
  const fp = functionPrefixAt(e.text, e.caret)
  if (!fp) return
  const out = spliceText(e.text, fp.start, e.caret, `${name}(`)
  updateText(ctx, out.text, out.caret)
}

export function editorKeyDown(ctx: GridCtx, ev: KeyboardEvent<HTMLInputElement>): void {
  const e = ctx.edit
  if (!e || ev.nativeEvent.isComposing) return
  const caret = ev.currentTarget.selectionStart ?? e.text.length
  const mod = ev.ctrlKey || ev.metaKey
  const pick = ctx.acPick()
  if (pick !== null) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault()
      ctx.acMove(ev.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (ev.key === 'Tab') {
      ev.preventDefault()
      insertFunction(ctx, pick)
      return
    }
    if (ev.key === 'Escape') {
      ev.preventDefault()
      ctx.acClose()
      return
    }
  }
  switch (ev.key) {
    case 'Enter':
      if (ev.altKey) return
      ev.preventDefault()
      if (mod) commitAll(ctx)
      else commit(ctx, { dr: ev.shiftKey ? -1 : 1, dc: 0 })
      return
    case 'Tab':
      ev.preventDefault()
      commit(ctx, { dr: 0, dc: ev.shiftKey ? -1 : 1 })
      return
    case 'Escape':
      ev.preventDefault()
      cancelEdit(ctx)
      return
    case 'F4': {
      ev.preventDefault()
      const out = cycleRef(e.text, caret)
      if (out) updateText(ctx, out.text, out.caret)
      return
    }
    case 'F2':
      ev.preventDefault()
      ctx.point.current = null
      ctx.setEdit({ ...e, caret, mode: e.mode === 'enter' ? 'edit' : 'enter' })
      return
  }
  const arrow = ARROWS[ev.key]
  if (!arrow || ev.altKey) return
  if (e.mode === 'enter' && canPoint(ctx, e, caret)) {
    ev.preventDefault()
    pointByKey(ctx, e, caret, arrow[0], arrow[1], ev.shiftKey, mod)
    return
  }
  if (e.mode === 'enter' && e.where === 'cell' && !ev.shiftKey && !mod) {
    ev.preventDefault()
    commit(ctx, { dr: arrow[0], dc: arrow[1], collapse: true })
  }
}
