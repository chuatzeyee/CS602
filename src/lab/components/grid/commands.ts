// grid-level commands: keyboard navigation, clipboard, fill, clear, undo
import type { KeyboardEvent } from 'react'
import { ARROWS, moveAfterEntry, startEdit } from './editing'
import { HEADER_H, ROW_H } from './geometry'
import { boxOfSel, single, type GridCtx } from './gridTypes'
import { jump, lastUsed, page, step, type Box, type Pos } from './navigate'
import { autoFill, boxLockReason, boxText, boxTsv, isBlank, moveBox, pasteText, READ_ONLY_MSG, refOf } from './sheetOps'

export const blankOf = (ctx: GridCtx) => (r: number, c: number): boolean => isBlank(ctx.sheet, r, c)

export function selectBox(ctx: GridCtx, b: Box, active: Pos = { r: b.r1, c: b.c1 }): void {
  ctx.setSel({ anchor: { r: b.r1, c: b.c1 }, extent: { r: b.r2, c: b.c2 }, active })
}

export function selectCell(ctx: GridCtx, p: Pos): void {
  ctx.setSel({ anchor: p, extent: p, active: p })
  ctx.reveal(p)
}

const firstRow = (ctx: GridCtx) => ctx.geo.visRows[0] ?? 0
const lastRow = (ctx: GridCtx) => ctx.geo.visRows[ctx.geo.visRows.length - 1] ?? 0

export function selectAll(ctx: GridCtx): void {
  selectBox(ctx, { r1: firstRow(ctx), c1: 0, r2: lastRow(ctx), c2: ctx.geo.cols - 1 }, ctx.sel.active)
}

export function selectCols(ctx: GridCtx, from: number, to: number): void {
  const a = { r: firstRow(ctx), c: from }
  ctx.setSel({ anchor: a, extent: { r: lastRow(ctx), c: to }, active: a })
}

export function selectRows(ctx: GridCtx, from: number, to: number): void {
  const a = { r: from, c: 0 }
  ctx.setSel({ anchor: a, extent: { r: to, c: ctx.geo.cols - 1 }, active: a })
}

function arrowKey(ctx: GridCtx, dr: number, dc: number, shift: boolean, mod: boolean): void {
  const s = ctx.sel
  const blank = blankOf(ctx)
  if (shift) {
    const e = mod ? jump(ctx.geo, s.extent, dr, dc, blank) : step(ctx.geo, s.extent, dr, dc)
    ctx.setSel({ ...s, extent: e })
    ctx.reveal(e)
    return
  }
  selectCell(ctx, mod ? jump(ctx.geo, s.active, dr, dc, blank) : step(ctx.geo, s.active, dr, dc))
}

function extendOrSelect(ctx: GridCtx, p: Pos, shift: boolean): void {
  if (shift) {
    ctx.setSel({ ...ctx.sel, extent: p })
    ctx.reveal(p)
  } else {
    selectCell(ctx, p)
  }
}

function rowsPerPage(ctx: GridCtx): number {
  const h = ctx.scrollEl()?.clientHeight ?? 400
  return Math.max(1, Math.floor((h - HEADER_H - ctx.geo.frozenH) / ROW_H) - 1)
}

function guard(ctx: GridCtx): boolean {
  if (ctx.readOnly) ctx.toast(READ_ONLY_MSG)
  return !ctx.readOnly
}

export function undo(ctx: GridCtx): void {
  if (guard(ctx) && ctx.sheet.canUndo()) ctx.sheet.undo()
}

export function redo(ctx: GridCtx): void {
  if (guard(ctx) && ctx.sheet.canRedo()) ctx.sheet.redo()
}

export function clearSelection(ctx: GridCtx): void {
  if (!guard(ctx)) return
  const b = boxOfSel(ctx.sel)
  const why = boxLockReason(ctx.sheet, ctx.bodies, b, ctx.geo.visRows)
  if (why && single(b)) {
    ctx.toast(why)
    return
  }
  const res = ctx.sheet.clear(boxText(b))
  if (!res.ok) ctx.toast(res.message, 'error')
  else if (why) ctx.toast('Locked cells (given data) were left unchanged')
}

/** Ctrl+D / Ctrl+R: copy the first row (column) of the selection over the rest; one cell copies from above (left) */
export function fillDirection(ctx: GridCtx, dir: 'down' | 'right'): void {
  if (!guard(ctx)) return
  const b = boxOfSel(ctx.sel)
  let src: Box
  let target: Box
  if (dir === 'down') {
    if (b.r1 === b.r2) {
      const above = step(ctx.geo, { r: b.r1, c: b.c1 }, -1, 0).r
      if (above === b.r1) return
      src = { ...b, r1: above, r2: above }
      target = { ...b, r1: above }
    } else {
      src = { ...b, r2: b.r1 }
      target = b
    }
  } else if (b.c1 === b.c2) {
    if (b.c1 === 0) return
    src = { ...b, c1: b.c1 - 1, c2: b.c1 - 1 }
    target = { ...b, c1: b.c1 - 1 }
  } else {
    src = { ...b, c2: b.c1 }
    target = b
  }
  const rest: Box = dir === 'down' ? { ...target, r1: src.r2 + 1 } : { ...target, c1: src.c2 + 1 }
  const why = boxLockReason(ctx.sheet, ctx.bodies, rest, ctx.geo.visRows)
  if (why) {
    ctx.toast(why)
    return
  }
  const res = ctx.sheet.fill(boxText(src), boxText(target))
  if (!res.ok) ctx.toast(res.message, 'error')
  else if (ctx.clip) ctx.setClip(null)
}

/** fill handle released: AutoFill from the selection over the dragged-out area */
export function autoFillTo(ctx: GridCtx, src: Box, target: Box, dir: 'down' | 'right'): void {
  if (!guard(ctx)) return
  const rest: Box = dir === 'down' ? { ...target, r1: src.r2 + 1 } : { ...target, c1: src.c2 + 1 }
  const why = boxLockReason(ctx.sheet, ctx.bodies, rest, ctx.geo.visRows)
  if (why) {
    ctx.toast(why)
    return
  }
  const res = autoFill(ctx.sheet, src, target, dir)
  if (!res.ok) ctx.toast(res.message, 'error')
  selectBox(ctx, target, ctx.sel.active)
  if (ctx.clip) ctx.setClip(null)
}

/** double-click on the fill handle: fill down as far as the data in the neighbouring column goes */
export function autoFillDownToData(ctx: GridCtx): void {
  const b = boxOfSel(ctx.sel)
  const blank = blankOf(ctx)
  const side = b.c1 > 0 && !blank(b.r2 + 1, b.c1 - 1) ? b.c1 - 1 : b.c2 + 1 < ctx.geo.cols ? b.c2 + 1 : -1
  if (side < 0 || b.r2 + 1 >= ctx.geo.rows) return
  let end = b.r2
  while (end + 1 < ctx.geo.rows && !blank(end + 1, side)) end++
  if (end > b.r2) autoFillTo(ctx, b, { ...b, r2: end }, 'down')
}

export function copySelection(ctx: GridCtx, cut: boolean): string | null {
  const b = boxOfSel(ctx.sel)
  if (cut) {
    if (!guard(ctx)) return null
    const why = boxLockReason(ctx.sheet, ctx.bodies, b, ctx.geo.visRows)
    if (why) {
      ctx.toast(why)
      return null
    }
  }
  ctx.sheet.copy(boxText(b))
  const tsv = boxTsv(ctx.sheet, b, ctx.geo.visRows)
  ctx.setClip({ box: b, tsv, cut })
  return tsv
}

const normEol = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '')

/** Ctrl+V: the marquee copy when it matches the clipboard (or the clipboard is unreadable), else clipboard text */
export function pasteClipboard(ctx: GridCtx, text: string | null): void {
  if (!guard(ctx)) return
  const clip = ctx.clip
  if (clip && (!text || normEol(text) === normEol(clip.tsv))) {
    pasteInternal(ctx)
    return
  }
  if (!text) return
  const at = boxOfSel(ctx.sel)
  const out = pasteText(ctx.sheet, ctx.bodies, { r: at.r1, c: at.c1 }, text)
  selectBox(ctx, out.box)
  if (ctx.clip) ctx.setClip(null)
  if (out.error) ctx.toast(out.error, 'error')
  else if (out.skipped) ctx.toast(`${out.skipped} locked cell${out.skipped > 1 ? 's were' : ' was'} not changed`)
}

export function pasteInternal(ctx: GridCtx): void {
  const clip = ctx.clip
  if (!clip || !guard(ctx)) return
  const at = boxOfSel(ctx.sel)
  const dest: Box = {
    r1: at.r1, c1: at.c1,
    r2: Math.min(ctx.geo.rows - 1, at.r1 + clip.box.r2 - clip.box.r1),
    c2: Math.min(ctx.geo.cols - 1, at.c1 + clip.box.c2 - clip.box.c1),
  }
  const why = boxLockReason(ctx.sheet, ctx.bodies, dest, ctx.geo.visRows)
  if (why) {
    ctx.toast(why)
    return
  }
  const res = clip.cut ? moveBox(ctx.sheet, clip.box, dest) : ctx.sheet.paste(refOf(at.r1, at.c1))
  if (!res.ok) {
    ctx.toast(res.message, 'error')
    return
  }
  if (clip.cut) ctx.setClip(null)
  selectBox(ctx, dest)
}

// browsers that fire no copy/cut/paste event for a focused grid: do the work after the key event
let pendingClipboard: { kind: 'c' | 'x' | 'v'; handled: boolean } | null = null

export function markClipboardHandled(): void {
  if (pendingClipboard) pendingClipboard.handled = true
}

function clipboardKey(ctx: GridCtx, kind: 'c' | 'x' | 'v'): void {
  const mine = { kind, handled: false }
  pendingClipboard = mine
  window.setTimeout(() => {
    if (pendingClipboard === mine) pendingClipboard = null
    if (mine.handled) return
    if (kind === 'v') {
      pasteClipboard(ctx, null)
      return
    }
    const tsv = copySelection(ctx, kind === 'x')
    if (tsv !== null) navigator.clipboard?.writeText(tsv).catch(() => undefined)
  }, 0)
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

export function gridKeyDown(ctx: GridCtx, ev: KeyboardEvent<HTMLDivElement>): void {
  // keys typed in the in-cell editor bubble up here: the editor handles its own
  if (ev.target !== ev.currentTarget || ctx.edit || ev.nativeEvent.isComposing) return
  const mod = ev.ctrlKey || ev.metaKey
  const k = ev.key
  // Tab moves between cells, as in Excel; Esc then Tab (or Shift+Tab) moves on to the rest of the page
  if (MODIFIERS.has(k)) return
  const leaving = ctx.escaped.current && k === 'Tab'
  ctx.escaped.current = k === 'Escape'
  if (leaving) return
  const arrow = ARROWS[k]
  if (arrow) {
    ev.preventDefault()
    arrowKey(ctx, arrow[0], arrow[1], ev.shiftKey, mod)
    return
  }
  if (mod && !ev.altKey) {
    if (ev.code === 'Backquote' || k === '`') {
      ev.preventDefault()
      ctx.toggleFormulas()
      return
    }
    switch (k.toLowerCase()) {
      case ' ': {
        ev.preventDefault()
        const b = boxOfSel(ctx.sel)
        selectBox(ctx, { r1: firstRow(ctx), c1: b.c1, r2: lastRow(ctx), c2: b.c2 }, ctx.sel.active)
        return
      }
      case 'a': ev.preventDefault(); selectAll(ctx); return
      case 'z': ev.preventDefault(); if (ev.shiftKey) redo(ctx); else undo(ctx); return
      case 'y': ev.preventDefault(); redo(ctx); return
      case 'd': ev.preventDefault(); fillDirection(ctx, 'down'); return
      case 'r': ev.preventDefault(); fillDirection(ctx, 'right'); return
      case 'home': ev.preventDefault(); extendOrSelect(ctx, { r: firstRow(ctx), c: 0 }, ev.shiftKey); return
      case 'end': ev.preventDefault(); extendOrSelect(ctx, lastUsed(ctx.geo, blankOf(ctx)), ev.shiftKey); return
      case 'c': case 'x': case 'v': clipboardKey(ctx, k.toLowerCase() as 'c' | 'x' | 'v'); return
    }
    return
  }
  switch (k) {
    case 'Tab':
      ev.preventDefault()
      moveAfterEntry(ctx, 0, ev.shiftKey ? -1 : 1)
      return
    case 'Enter':
      ev.preventDefault()
      if (ctx.clip && !ev.shiftKey) {
        pasteInternal(ctx)
        ctx.setClip(null)
        return
      }
      moveAfterEntry(ctx, ev.shiftKey ? -1 : 1, 0)
      return
    case 'Home':
      ev.preventDefault()
      extendOrSelect(ctx, { r: (ev.shiftKey ? ctx.sel.extent : ctx.sel.active).r, c: 0 }, ev.shiftKey)
      return
    case 'PageDown':
    case 'PageUp': {
      ev.preventDefault()
      const from = ev.shiftKey ? ctx.sel.extent : ctx.sel.active
      extendOrSelect(ctx, page(ctx.geo, from, k === 'PageDown' ? 1 : -1, rowsPerPage(ctx)), ev.shiftKey)
      return
    }
    case 'F2':
      ev.preventDefault()
      startEdit(ctx, { mode: 'edit', where: 'cell' })
      return
    case 'F9':
      ev.preventDefault()
      ctx.sheet.recalc()
      return
    case 'Delete':
    case 'Backspace':
      ev.preventDefault()
      clearSelection(ctx)
      return
    case 'Escape':
      if (ctx.clip) {
        ev.preventDefault()
        ctx.setClip(null)
      }
      return
  }
  if (k === ' ' && ev.shiftKey) {
    ev.preventDefault()
    const b = boxOfSel(ctx.sel)
    selectBox(ctx, { r1: b.r1, c1: 0, r2: b.r2, c2: ctx.geo.cols - 1 }, ctx.sel.active)
    return
  }
  if (k.length === 1 && !ev.ctrlKey && !ev.metaKey) {
    ev.preventDefault()
    startEdit(ctx, { text: k, mode: 'enter', where: 'cell' })
  }
}
