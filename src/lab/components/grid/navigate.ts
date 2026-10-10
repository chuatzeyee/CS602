// keyboard movement over visible cells: arrows, Ctrl+arrow data-edge jumps, paging, moving inside a selection
import type { Geometry } from './geometry'

export interface Pos { r: number; c: number }
export interface Box { r1: number; c1: number; r2: number; c2: number }

/** one visible step; stays put at the sheet edge */
export function step(geo: Geometry, p: Pos, dr: number, dc: number): Pos {
  let { r, c } = p
  if (dc) c = Math.max(0, Math.min(geo.cols - 1, c + dc))
  if (dr) {
    const idx = geo.rowPos[r] >= 0 ? geo.rowPos[r] : nearestIdx(geo, r)
    const next = Math.max(0, Math.min(geo.visRows.length - 1, idx + dr))
    r = geo.visRows[next] ?? r
  }
  return { r, c }
}

function nearestIdx(geo: Geometry, r: number): number {
  for (let x = r; x < geo.rows; x++) if (geo.rowPos[x] >= 0) return geo.rowPos[x]
  for (let x = r; x >= 0; x--) if (geo.rowPos[x] >= 0) return geo.rowPos[x]
  return 0
}

/** Excel's Ctrl+arrow: to the end of the current data block, or to the next non-blank cell, or the edge */
export function jump(geo: Geometry, p: Pos, dr: number, dc: number, blank: (r: number, c: number) => boolean): Pos {
  let cur = p
  let next = step(geo, cur, dr, dc)
  if (next.r === cur.r && next.c === cur.c) return cur
  if (!blank(cur.r, cur.c) && !blank(next.r, next.c)) {
    for (;;) {
      cur = next
      next = step(geo, cur, dr, dc)
      if ((next.r === cur.r && next.c === cur.c) || blank(next.r, next.c)) return cur
    }
  }
  cur = next
  for (;;) {
    if (!blank(cur.r, cur.c)) return cur
    next = step(geo, cur, dr, dc)
    if (next.r === cur.r && next.c === cur.c) return cur
    cur = next
  }
}

/** PageUp / PageDown by a screenful of visible rows */
export function page(geo: Geometry, p: Pos, dir: 1 | -1, rowsPerPage: number): Pos {
  return step(geo, p, dir * Math.max(1, rowsPerPage), 0)
}

/** Enter / Tab inside a multi-cell selection: move within it and wrap, like Excel */
export function moveWithin(geo: Geometry, box: Box, p: Pos, dr: number, dc: number): Pos {
  const rows = geo.visRows.filter(r => r >= box.r1 && r <= box.r2)
  if (!rows.length) return p
  let ri = Math.max(0, rows.indexOf(p.r))
  let c = p.c
  if (dr) {
    ri += dr
    if (ri >= rows.length) { ri = 0; c = c + 1 > box.c2 ? box.c1 : c + 1 }
    else if (ri < 0) { ri = rows.length - 1; c = c - 1 < box.c1 ? box.c2 : c - 1 }
  } else if (dc) {
    c += dc
    if (c > box.c2) { c = box.c1; ri = ri + 1 >= rows.length ? 0 : ri + 1 }
    else if (c < box.c1) { c = box.c2; ri = ri - 1 < 0 ? rows.length - 1 : ri - 1 }
  }
  return { r: rows[ri], c }
}

/** bottom-right of the used area (Ctrl+End) */
export function lastUsed(geo: Geometry, blank: (r: number, c: number) => boolean): Pos {
  let maxR = geo.visRows[0] ?? 0
  let maxC = 0
  for (const r of geo.visRows) {
    for (let c = 0; c < geo.cols; c++) {
      if (!blank(r, c)) {
        if (r > maxR) maxR = r
        if (c > maxC) maxC = c
      }
    }
  }
  return { r: maxR, c: maxC }
}
