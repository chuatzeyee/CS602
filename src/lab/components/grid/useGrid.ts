// spreadsheet controller: state, the shared GridCtx, viewport/virtualisation, document + window listeners, api
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { SpreadsheetApi, SpreadsheetProps } from '../../types'
import { copySelection, markClipboardHandled, pasteClipboard, selectBox } from './commands'
import { commit } from './editing'
import { colLetters, functionPrefixAt, parseRangeText } from './formulaText'
import { matchFunctions } from './functions'
import { bodyWindow, buildGeometry, HEADER_H, ROW_H, ROW_HEADER_W, scrollToReveal } from './geometry'
import type { Clip, Drag, Edit, FillPreview, GridCtx, PointState, Sel, Tone } from './gridTypes'
import { boxOfSel } from './gridTypes'
import { dragEnd, dragMove } from './pointer'
import { boxText, refOf, tableBodies } from './sheetOps'

const BLOCK = ROW_H * 6

export interface AcState { prefix: string; index: number; closedFor: string | null }
export interface ToastState { id: number; text: string; tone: Tone }

export function autocompleteOf(edit: Edit | null, ac: AcState) {
  if (!edit || ac.closedFor === edit.text) return null
  const fp = functionPrefixAt(edit.text, edit.caret)
  if (!fp) return null
  const items = matchFunctions(fp.prefix)
  if (!items.length) return null
  const index = ac.prefix === fp.prefix ? Math.min(ac.index, items.length - 1) : 0
  return { ...fp, items, index }
}

export function useGrid(props: SpreadsheetProps) {
  const { sheet, readOnly = false, apiRef, onSelectionChange } = props
  const gridId = `lab-grid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const subscribe = useCallback((l: () => void) => sheet.subscribe(l), [sheet])
  const getVersion = useCallback(() => sheet.version, [sheet])
  const version = useSyncExternalStore(subscribe, getVersion, getVersion)
  const [showFormulas, setShowFormulas] = useState(false)
  const letters = useMemo(() => Array.from({ length: sheet.cols }, (_, c) => colLetters(c)), [sheet])
  const geo = useMemo(
    () => buildGeometry({
      rows: sheet.rows, cols: sheet.cols, colWidths: sheet.spec.colWidths, hidden: sheet.hiddenRows,
      frozenRows: sheet.spec.frozenRows, showFormulas, colLetter: c => letters[c],
    }),
    // version: hidden rows change through the sheet
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, version, showFormulas, letters],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bodies = useMemo(() => tableBodies(sheet), [sheet, version])

  const start = { r: geo.visRows[0] ?? 0, c: 0 }
  const [sel, setSelState] = useState<Sel>({ anchor: start, extent: start, active: start })
  const [edit, setEditState] = useState<Edit | null>(null)
  const [clip, setClipState] = useState<Clip | null>(null)
  const [fillPreview, setFillPreviewState] = useState<FillPreview | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [ac, setAc] = useState<AcState>({ prefix: '', index: 0, closedFor: null })
  const [focused, setFocused] = useState(false)
  const [scrollQ, setScrollQ] = useState(0)
  const [viewH, setViewH] = useState(480)
  const [scrollTick, setScrollTick] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cellInputRef = useRef<HTMLInputElement>(null)
  const barInputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const point = useRef<PointState | null>(null)
  const drag = useRef<Drag | null>(null)
  const escaped = useRef(false)
  const acRef = useRef(ac)

  const ctxRef = useRef<GridCtx | null>(null)
  if (ctxRef.current === null) {
    const c: GridCtx = {
      sheet, geo, bodies, readOnly, sel, edit, clip, fillPreview,
      setSel: s => { c.sel = s; setSelState(s) },
      setEdit: e => { c.edit = e; setEditState(e) },
      setClip: x => { c.clip = x; setClipState(x) },
      setFillPreview: p => { c.fillPreview = p; setFillPreviewState(p) },
      toggleFormulas: () => setShowFormulas(v => !v),
      toast: (text, tone = 'info') => setToast({ id: Date.now() + Math.random(), text, tone }),
      scrollEl: () => scrollRef.current,
      cellInput: () => cellInputRef.current,
      barInput: () => barInputRef.current,
      focusGrid: () => scrollRef.current?.focus({ preventScroll: true }),
      reveal: p => {
        const el = scrollRef.current
        if (!el) return
        const next = scrollToReveal(c.geo, p.r, p.c, {
          scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, width: el.clientWidth, height: el.clientHeight,
        })
        if (!next) return
        el.scrollLeft = next.left
        el.scrollTop = next.top
        setScrollQ(Math.floor(el.scrollTop / BLOCK))
      },
      pendingCaret, point, drag, escaped,
      acPick: () => {
        const a = autocompleteOf(c.edit, acRef.current)
        return a ? a.items[a.index] : null
      },
      acMove: delta => {
        const a = autocompleteOf(c.edit, acRef.current)
        if (!a) return
        const next = { ...acRef.current, prefix: a.prefix, index: (a.index + delta + a.items.length) % a.items.length }
        acRef.current = next
        setAc(next)
      },
      acClose: () => {
        const next = { ...acRef.current, closedFor: c.edit?.text ?? null }
        acRef.current = next
        setAc(next)
      },
    }
    ctxRef.current = c
  }
  const ctx = ctxRef.current

  useLayoutEffect(() => {
    Object.assign(ctx, { sheet, geo, bodies, readOnly, sel, edit, clip, fillPreview })
    acRef.current = ac
  })

  // a rebuilt sheet of the same exercise (reset, reveal) keeps the selection; another exercise starts at the top-left
  const specRef = useRef(sheet.spec)
  useEffect(() => {
    const sameSpec = specRef.current === sheet.spec
    specRef.current = sheet.spec
    const s = ctx.sel
    const fits = [s.anchor, s.extent, s.active].every(p => p.r < ctx.geo.rows && p.c < ctx.geo.cols && ctx.geo.rowPos[p.r] >= 0)
    if (!sameSpec || !fits) {
      const p = { r: ctx.geo.visRows[0] ?? 0, c: 0 }
      ctx.setSel({ anchor: p, extent: p, active: p })
    }
    ctx.setEdit(null)
    ctx.setClip(null)
    point.current = null
  }, [sheet, ctx])

  // keep the caret where editing commands put it
  useLayoutEffect(() => {
    const pc = pendingCaret.current
    if (pc === null || !edit) return
    const input = edit.where === 'cell' ? cellInputRef.current : barInputRef.current
    if (!input) return
    if (document.activeElement !== input) input.focus({ preventScroll: true })
    input.setSelectionRange(pc, pc)
    pendingCaret.current = null
  })

  // viewport size for row virtualisation
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewH(el.clientHeight || 480)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const q = Math.floor(el.scrollTop / BLOCK)
    setScrollQ(prev => (prev === q ? prev : q))
    if (ctx.edit) setScrollTick(t => t + 1)
  }, [ctx])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  // clipboard: the browser's copy/cut/paste events carry the system clipboard without permission prompts
  useEffect(() => {
    const mine = () => document.activeElement === scrollRef.current && !ctx.edit
    const onCopy = (cut: boolean) => (e: ClipboardEvent) => {
      if (!mine()) return
      markClipboardHandled()
      const tsv = copySelection(ctx, cut)
      if (tsv === null) return
      e.clipboardData?.setData('text/plain', tsv)
      e.preventDefault()
    }
    const copy = onCopy(false)
    const cut = onCopy(true)
    const paste = (e: ClipboardEvent) => {
      if (!mine()) return
      markClipboardHandled()
      e.preventDefault()
      pasteClipboard(ctx, e.clipboardData?.getData('text/plain') ?? null)
    }
    document.addEventListener('copy', copy)
    document.addEventListener('cut', cut)
    document.addEventListener('paste', paste)
    return () => {
      document.removeEventListener('copy', copy)
      document.removeEventListener('cut', cut)
      document.removeEventListener('paste', paste)
    }
  }, [ctx])

  // drags (selection, point mode, fill handle) follow the pointer outside the grid and auto-scroll
  useEffect(() => {
    let last: { x: number; y: number } | null = null
    let timer = 0
    const tick = () => {
      timer = 0
      const el = scrollRef.current
      if (!el || !ctx.drag.current || !last) return
      const r = el.getBoundingClientRect()
      const top = r.top + HEADER_H + ctx.geo.frozenH
      const dx = last.x < r.left + ROW_HEADER_W ? last.x - r.left - ROW_HEADER_W : last.x > r.right ? last.x - r.right : 0
      const dy = last.y < top ? last.y - top : last.y > r.bottom ? last.y - r.bottom : 0
      if (!dx && !dy) return
      el.scrollLeft += Math.max(-40, Math.min(40, dx))
      el.scrollTop += Math.max(-40, Math.min(40, dy))
      dragMove(ctx, last.x, last.y)
      timer = window.setTimeout(tick, 40)
    }
    const move = (e: PointerEvent) => {
      if (!ctx.drag.current) return
      last = { x: e.clientX, y: e.clientY }
      dragMove(ctx, e.clientX, e.clientY)
      if (!timer) tick()
    }
    const up = () => {
      if (ctx.drag.current) dragEnd(ctx)
      last = null
      window.clearTimeout(timer)
      timer = 0
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.clearTimeout(timer)
    }
  }, [ctx])

  // report the selection
  const box = boxOfSel(sel)
  const rangeStr = boxText(box)
  const activeStr = refOf(sel.active.r, sel.active.c)
  const onSelRef = useRef(onSelectionChange)
  useLayoutEffect(() => { onSelRef.current = onSelectionChange })
  useEffect(() => { onSelRef.current?.(rangeStr, activeStr) }, [rangeStr, activeStr])

  useEffect(() => {
    if (!apiRef) return
    const api: SpreadsheetApi = {
      select(range: string) {
        const b = parseRangeText(range.split(',')[0] ?? '')
        if (!b) return
        const clamped = {
          r1: Math.min(b.r1, ctx.geo.rows - 1), c1: Math.min(b.c1, ctx.geo.cols - 1),
          r2: Math.min(b.r2, ctx.geo.rows - 1), c2: Math.min(b.c2, ctx.geo.cols - 1),
        }
        if (ctx.edit && !commit(ctx, null)) return
        selectBox(ctx, clamped)
        ctx.reveal({ r: clamped.r2, c: clamped.c2 })
        ctx.reveal({ r: clamped.r1, c: clamped.c1 })
      },
      focus() {
        const e = ctx.edit
        if (e) (e.where === 'cell' ? cellInputRef.current : barInputRef.current)?.focus()
        else ctx.focusGrid()
      },
      selection() {
        const b = boxOfSel(ctx.sel)
        return { range: boxText(b), active: refOf(ctx.sel.active.r, ctx.sel.active.c) }
      },
    }
    apiRef.current = api
    return () => {
      if (apiRef.current === api) apiRef.current = null
    }
  }, [apiRef, ctx])

  const win = bodyWindow(geo, scrollQ * BLOCK, viewH)

  return {
    ctx, gridId, version, geo, letters, bodies, sel, box, rangeStr, activeStr, edit, clip, fillPreview, toast,
    ac, setAc, focused, setFocused, showFormulas, win, scrollTick,
    rootRef, scrollRef, cellInputRef, barInputRef, onScroll,
  }
}
