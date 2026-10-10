// mouse / touch on the grid: select, drag-select, header selection, point mode, fill handle, double-click / tap
import { autoFillTo, selectAll, selectCell, selectCols, selectRows } from './commands'
import { commit, pointAt, startEdit, wantsPoint } from './editing'
import { HEADER_H, hitTest, ROW_H, ROW_HEADER_W, type Hit } from './geometry'
import type { GridCtx } from './gridTypes'
import type { Box, Pos } from './navigate'

/** hit test from client coordinates; strict = null outside the drawn cells */
export function hitAt(ctx: GridCtx, clientX: number, clientY: number, strict: boolean): Hit | null {
  const el = ctx.scrollEl()
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left - el.clientLeft
  const y = clientY - rect.top - el.clientTop
  if (strict) {
    if (x < 0 || y < 0 || x >= el.clientWidth || y >= el.clientHeight) return null
    if (x >= ROW_HEADER_W && x + el.scrollLeft >= ctx.geo.totalW) return null
    const bodyY = y - HEADER_H - ctx.geo.frozenH
    if (bodyY >= 0 && bodyY + el.scrollTop >= ctx.geo.bodyH) return null
  }
  return hitTest(ctx.geo, x, y, el.scrollLeft, el.scrollTop)
}

/** a press (mouse down or tap) on the grid */
export function press(ctx: GridCtx, hit: Hit, shift: boolean, mouse: boolean): void {
  if (ctx.edit && hit.zone === 'cell' && wantsPoint(ctx)) {
    pointAt(ctx, { r: hit.r, c: hit.c }, false)
    if (mouse) ctx.drag.current = { kind: 'point' }
    return
  }
  if (ctx.edit && !commit(ctx, null)) return
  const s = ctx.sel
  switch (hit.zone) {
    case 'corner':
      selectAll(ctx)
      break
    case 'colHeader': {
      const from = shift ? s.anchor.c : hit.c
      selectCols(ctx, from, hit.c)
      if (mouse) ctx.drag.current = { kind: 'cols', from }
      break
    }
    case 'rowHeader': {
      const from = shift ? s.anchor.r : hit.r
      selectRows(ctx, from, hit.r)
      if (mouse) ctx.drag.current = { kind: 'rows', from }
      break
    }
    case 'cell':
      if (shift) ctx.setSel({ ...s, extent: { r: hit.r, c: hit.c } })
      else selectCell(ctx, { r: hit.r, c: hit.c })
      if (mouse) ctx.drag.current = { kind: 'cells' }
      break
  }
  ctx.focusGrid()
}

function fillPreviewAt(ctx: GridCtx, src: Box, p: Pos): void {
  const { geo } = ctx
  const down = p.r > src.r2 ? (geo.rowPos[p.r] - geo.rowPos[src.r2]) * ROW_H : 0
  const right = p.c > src.c2 ? geo.colX[p.c + 1] - geo.colX[src.c2 + 1] : 0
  const cur = ctx.fillPreview
  let next: typeof cur = null
  if (down > 0 || right > 0) {
    next = down >= right ? { box: { ...src, r2: p.r }, dir: 'down' } : { box: { ...src, c2: p.c }, dir: 'right' }
  }
  const same = cur && next && cur.dir === next.dir && cur.box.r2 === next.box.r2 && cur.box.c2 === next.box.c2
  if (!same && (cur || next)) ctx.setFillPreview(next)
}

/** pointer moved during a drag (clamped to the sheet) */
export function dragMove(ctx: GridCtx, clientX: number, clientY: number): void {
  const d = ctx.drag.current
  if (!d) return
  const hit = hitAt(ctx, clientX, clientY, false)
  if (!hit) return
  const p = { r: hit.r, c: hit.c }
  const s = ctx.sel
  switch (d.kind) {
    case 'cells':
      if (s.extent.r !== p.r || s.extent.c !== p.c) {
        ctx.setSel({ ...s, extent: p })
        ctx.reveal(p)
      }
      break
    case 'cols':
      if (s.extent.c !== hit.c) selectCols(ctx, d.from, hit.c)
      break
    case 'rows':
      if (s.extent.r !== hit.r) selectRows(ctx, d.from, hit.r)
      break
    case 'point': {
      const pt = ctx.point.current
      if (!pt || pt.extent.r !== p.r || pt.extent.c !== p.c) pointAt(ctx, p, true)
      break
    }
    case 'fill':
      fillPreviewAt(ctx, d.src, p)
      break
  }
}

export function dragEnd(ctx: GridCtx): void {
  const d = ctx.drag.current
  ctx.drag.current = null
  if (d?.kind === 'fill') {
    const prev = ctx.fillPreview
    ctx.setFillPreview(null)
    if (prev) autoFillTo(ctx, d.src, prev.box, prev.dir)
    ctx.focusGrid()
  }
}

export function doubleClick(ctx: GridCtx, hit: Hit | null): void {
  if (!hit || hit.zone !== 'cell' || ctx.edit) return
  startEdit(ctx, { mode: 'edit', where: 'cell' })
}

let lastTap: { r: number; c: number; t: number } | null = null

/** touch: tap selects (or points), double-tap edits in the formula bar */
export function tap(ctx: GridCtx, hit: Hit): void {
  const now = performance.now()
  const dbl = lastTap !== null && lastTap.r === hit.r && lastTap.c === hit.c && now - lastTap.t < 450
  lastTap = { r: hit.r, c: hit.c, t: now }
  if (dbl && hit.zone === 'cell' && !ctx.edit) {
    lastTap = null
    ctx.barInput()?.focus()
    return
  }
  press(ctx, hit, false, false)
}
