// Excel-like grid for the lab: name box + formula bar + virtualised grid with selection, editing, point mode,
// F4, autocomplete, clipboard, fill handle, undo, Show Formulas. State and commands live in ./grid/*.
import { useLayoutEffect, useMemo, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import type { CellMark, SpreadsheetProps } from '../types'
import { autoFillDownToData, gridKeyDown, selectBox } from './grid/commands'
import { cancelEdit, canPoint, commit, editorKeyDown, insertFunction, startEdit } from './grid/editing'
import EditorPopups, { type PopupAnchor } from './grid/EditorPopups'
import FormulaBar from './grid/FormulaBar'
import { callContextAt, isFormulaText, parseRangeText, scanRefs } from './grid/formulaText'
import { syntaxHint } from './grid/functions'
import { CHAR_W, HEADER_H, rangeRects, ROW_H, type Rect } from './grid/geometry'
import { MARK_TEXT } from './grid/cellView'
import { cellId, ColumnHeader, GridRow, markId, type RowLayout } from './grid/GridRows'
import { boxOfSel, single } from './grid/gridTypes'
import type { Box } from './grid/navigate'
import { OverlayLayer, REF_COLOURS, type OverlayBox } from './grid/Overlays'
import { doubleClick, hitAt, press, tap } from './grid/pointer'
import { lockReason, refOf } from './grid/sheetOps'
import { autocompleteOf, useGrid } from './grid/useGrid'

export default function Spreadsheet(props: SpreadsheetProps) {
  const { sheet, marks, focusCells, readOnly = false } = props
  const g = useGrid(props)
  const { ctx, geo, box, edit, sel } = g
  const [touch, setTouch] = useState<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const [anchor, setAnchor] = useState<PopupAnchor | null>(null)

  const layout: RowLayout = useMemo(
    () => ({ sheet, geo, letters: g.letters, showFormulas: g.showFormulas, gridId: g.gridId, dataTables: g.bodies }),
    [sheet, geo, g.letters, g.showFormulas, g.gridId, g.bodies],
  )

  const marksByRow = useMemo(() => {
    const m = new Map<number, Record<number, CellMark>>()
    for (const [ref, mark] of Object.entries(marks ?? {})) {
      const p = parseRangeText(ref)
      if (p) m.set(p.r1, { ...m.get(p.r1), [p.c1]: mark })
    }
    return m
  }, [marks])

  // overlays, split between the frozen block and the scrolling body
  const layers = useMemo(() => {
    const frozen: OverlayBox[] = []
    const body: OverlayBox[] = []
    const add = (key: string, kind: OverlayBox['kind'], b: Box, extra: Partial<OverlayBox> = {}) => {
      const rr = rangeRects(geo, b.r1, b.c1, b.r2, b.c2)
      if (rr.frozen) frozen.push({ key, kind, rect: rr.frozen, openBottom: !!rr.body, ...extra })
      if (rr.body) body.push({ key, kind, rect: rr.body, openTop: !!rr.frozen, ...extra })
    }
    for (const [i, part] of (focusCells ?? '').split(',').entries()) {
      const b = parseRangeText(part)
      if (b) add(`focus${i}`, 'focus', b)
    }
    if (edit && isFormulaText(edit.text)) {
      const seen = new Map<string, string>()
      for (const [i, t] of scanRefs(edit.text).entries()) {
        if (t.sheet && t.sheet !== sheet.name) continue
        const key = t.text.replace(/\$/g, '').toUpperCase()
        if (!seen.has(key)) seen.set(key, REF_COLOURS[seen.size % REF_COLOURS.length])
        const r2 = t.wholeCols ? geo.rows - 1 : t.r2
        add(`ref${i}`, 'ref', { r1: t.r1, c1: t.c1, r2, c2: t.c2 }, { color: seen.get(key) })
      }
    }
    add('sel', 'sel', box, { dim: !g.focused })
    if (!single(box)) add('active', 'active', { r1: sel.active.r, c1: sel.active.c, r2: sel.active.r, c2: sel.active.c })
    if (g.clip) add('ants', 'ants', g.clip.box)
    if (g.fillPreview) add('fill', 'fill', g.fillPreview.box)
    return { frozen, body }
  }, [geo, focusCells, edit, sheet, box, sel.active, g.focused, g.clip, g.fillPreview])

  const selRects = rangeRects(geo, box.r1, box.c1, box.r2, box.c2)
  const showHandle = !readOnly && !edit
  const handleLayer = selRects.body ? 'body' : selRects.frozen ? 'frozen' : null

  const onHandleDown = (e: PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (readOnly) return
    ctx.drag.current = { kind: 'fill', src: boxOfSel(ctx.sel) }
  }

  // editor geometry (in-cell)
  const editRow = edit ? geo.rowPos[edit.r] : -1
  const editLayer = edit && editRow >= 0 ? (editRow < geo.frozen ? 'frozen' : 'body') : null
  let editRect: Rect | undefined
  if (edit && editLayer) editRect = rangeRects(geo, edit.r, edit.c, edit.r, edit.c)[editLayer]

  const auto = autocompleteOf(edit, g.ac)
  const call = edit && !auto ? callContextAt(edit.text, edit.caret) : null
  const hint = call ? syntaxHint(call.name) : null

  // popups follow the active editor
  useLayoutEffect(() => {
    const root = g.rootRef.current
    const input = edit ? (edit.where === 'cell' ? g.cellInputRef.current : g.barInputRef.current) : null
    let next: PopupAnchor | null = null
    if (root && input && (auto || hint)) {
      const ir = input.getBoundingClientRect()
      const rr = root.getBoundingClientRect()
      next = { left: Math.max(4, Math.min(ir.left - rr.left, rr.width - 200)), top: ir.bottom - rr.top + 3, maxWidth: rr.width - 8 }
    }
    setAnchor(prev =>
      prev === next || (prev && next && prev.left === next.left && prev.top === next.top && prev.maxWidth === next.maxWidth) ? prev : next,
    )
  })

  const activeRef = g.activeStr
  const activeLock = edit ? null : lockReason(sheet, g.bodies, sel.active.r, sel.active.c, readOnly)
  const activeRead = sheet.read(activeRef)
  const activeNote = sheet.spec.cells[activeRef]?.note

  let mode = 'Ready'
  if (edit) {
    const pointing = edit.mode === 'enter' && canPoint(ctx, edit, edit.caret)
    mode = pointing ? 'Point' : edit.mode === 'enter' ? 'Enter' : 'Edit'
  }

  const wholeRow = box.c1 === 0 && box.c2 === geo.cols - 1
  const wholeCol = box.r1 === geo.visRows[0] && box.r2 === geo.visRows[geo.visRows.length - 1]
  const rowEl = (r: number) => {
    const inSel = r >= box.r1 && r <= box.r2
    return (
      <GridRow
        key={r}
        layout={layout}
        r={r}
        version={g.version}
        selC1={inSel ? box.c1 : -1}
        selC2={inSel ? box.c2 : -1}
        wholeRow={inSel && wholeRow}
        marks={marksByRow.get(r)}
        afterHidden={r > 0 && geo.rowPos[r - 1] < 0}
      />
    )
  }
  const frozenRows = geo.visRows.slice(0, geo.frozen)
  const bodyRows = geo.visRows.slice(geo.frozen + g.win[0], geo.frozen + g.win[1])
  const activeRendered = geo.rowPos[sel.active.r] >= 0 &&
    (geo.rowPos[sel.active.r] < geo.frozen || (geo.rowPos[sel.active.r] - geo.frozen >= g.win[0] && geo.rowPos[sel.active.r] - geo.frozen < g.win[1]))

  const onGridPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t === g.cellInputRef.current || t.closest('[data-fill-handle]')) return
    if (e.pointerType === 'touch') {
      setTouch({ id: e.pointerId, x: e.clientX, y: e.clientY, moved: false })
      return
    }
    if (e.button !== 0) return
    const hit = hitAt(ctx, e.clientX, e.clientY, true)
    if (hit) press(ctx, hit, e.shiftKey, true)
    else if (!edit) ctx.focusGrid()
  }
  const onGridPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (touch && touch.id === e.pointerId && !touch.moved && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) {
      setTouch({ ...touch, moved: true })
    }
  }
  const onGridPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!touch || touch.id !== e.pointerId) return
    setTouch(null)
    if (touch.moved) return
    const hit = hitAt(ctx, e.clientX, e.clientY, true)
    if (hit) tap(ctx, hit)
  }

  const editorChange = (where: 'cell' | 'bar') => (text: string, caret: number) => {
    const e = ctx.edit
    if (!e) return
    ctx.point.current = null
    ctx.setEdit({ ...e, text, caret, where })
  }
  const editorSelect = (caret: number) => {
    const e = ctx.edit
    if (e && e.caret !== caret) ctx.setEdit({ ...e, caret })
  }
  const editorBlur = (ev: FocusEvent<HTMLInputElement>) => {
    const next = ev.relatedTarget as Node | null
    if (!ctx.edit || (next && g.rootRef.current?.contains(next))) return
    if (!document.hasFocus()) return
    commit(ctx, null)
  }
  const editorKeys = (ev: KeyboardEvent<HTMLInputElement>) => editorKeyDown(ctx, ev)

  const nameSubmit = (text: string): boolean => {
    if (ctx.edit && !commit(ctx, null)) return false
    const t = text.trim()
    let b = parseRangeText(t)
    const names = sheet.spec.names ?? {}
    const named = Object.keys(names).find(n => n.toLowerCase() === t.toLowerCase())
    if (!b && named) b = parseRangeText(names[named].replace(/^=/, ''))
    if (!b || b.r2 >= sheet.rows || b.c2 >= sheet.cols) {
      ctx.toast('Type a cell or range on this sheet, e.g. B4 or B4:D9', 'error')
      return false
    }
    selectBox(ctx, b)
    ctx.reveal({ r: b.r2, c: b.c2 })
    ctx.reveal({ r: b.r1, c: b.c1 })
    return true
  }

  const editorWidth = editRect && edit
    ? Math.min(Math.max(editRect.width + 1, edit.text.length * CHAR_W + 14), Math.max(editRect.width + 1, geo.totalW - editRect.left))
    : 0
  const editor = edit && editRect && (
    <input
      ref={g.cellInputRef}
      aria-label={`Edit ${refOf(edit.r, edit.c)}`}
      value={edit.text}
      onChange={e => editorChange('cell')(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      onSelect={e => editorSelect(e.currentTarget.selectionStart ?? 0)}
      onKeyDown={editorKeys}
      onBlur={editorBlur}
      onFocus={() => { if (ctx.edit && ctx.edit.where !== 'cell') ctx.setEdit({ ...ctx.edit, where: 'cell' }) }}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      aria-autocomplete="list"
      aria-controls={auto ? `${g.gridId}-ac` : undefined}
      aria-activedescendant={auto ? `${g.gridId}-ac-${auto.index}` : undefined}
      className="absolute z-[4] m-0 bg-base text-ink font-mono text-[12px] px-[3px] outline-none border-2 border-glow rounded-none shadow-[0_3px_12px_rgba(0,0,0,0.5)]"
      style={{
        left: editRect.left - 1, top: editRect.top - 1, width: editorWidth + 1, height: ROW_H + 1,
        // a mirror while the formula bar edits (touch: the tap that opened it must not land in it)
        pointerEvents: edit.where === 'bar' ? 'none' : undefined,
      }}
    />
  )

  let chipText: string | null = null
  let chipTone: 'info' | 'error' = 'info'
  if (g.clip && !edit) chipText = 'Select the destination, then press Enter or Ctrl+V (Esc to cancel)'
  else if (!edit && activeRead.kind === 'error') {
    chipText = `${activeRef} ${activeRead.value}${activeRead.hint ? `: ${activeRead.hint}` : ''}`
    chipTone = 'error'
  } else if (!edit && activeNote) chipText = `${activeRef}: ${activeNote}`

  return (
    <div
      ref={g.rootRef}
      className="relative flex flex-col h-full min-h-0 bg-base"
      onFocus={() => g.setFocused(true)}
      onBlur={e => { if (!g.rootRef.current?.contains(e.relatedTarget as Node | null)) g.setFocused(false) }}
    >
      <FormulaBar
        gridId={g.gridId}
        selectionText={g.rangeStr}
        onNameSubmit={nameSubmit}
        onNameDone={() => ctx.focusGrid()}
        value={edit ? edit.text : sheet.raw(activeRef)}
        editing={!!edit}
        locked={!!activeLock}
        lockReason={activeLock ?? undefined}
        inputRef={g.barInputRef}
        onBarFocus={caret => {
          const e = ctx.edit
          if (e) {
            if (e.where !== 'bar') ctx.setEdit({ ...e, where: 'bar', caret })
            return
          }
          startEdit(ctx, { mode: 'edit', where: 'bar', caret })   // a locked cell shows why instead
        }}
        onBarChange={editorChange('bar')}
        onBarSelect={editorSelect}
        onBarKeyDown={editorKeys}
        onBarBlur={editorBlur}
        onCancel={() => cancelEdit(ctx)}
        onEnter={() => commit(ctx, { dr: 1, dc: 0 })}
        showFormulas={g.showFormulas}
        onToggleFormulas={() => ctx.toggleFormulas()}
        mode={mode}
      />
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={g.scrollRef}
          id={g.gridId}
          role="grid"
          tabIndex={0}
          aria-label={`${sheet.name} grid`}
          aria-rowcount={sheet.rows + 1}
          aria-colcount={sheet.cols + 1}
          aria-multiselectable="true"
          aria-readonly={readOnly || undefined}
          aria-activedescendant={activeRendered && !edit ? cellId(g.gridId, sel.active.r, sel.active.c) : undefined}
          aria-describedby={`${g.gridId}-keys`}
          onKeyDown={e => gridKeyDown(ctx, e)}
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
          onPointerCancel={() => setTouch(null)}
          onMouseDown={e => { if (e.target !== g.cellInputRef.current) e.preventDefault() }}
          onDoubleClick={e => doubleClick(ctx, hitAt(ctx, e.clientX, e.clientY, true))}
          onScroll={g.onScroll}
          className="relative flex-1 min-h-0 overflow-auto outline-none select-none font-mono text-[12px] bg-void"
          style={{ maxHeight: 'var(--lab-grid-max-h, 85vh)', touchAction: 'manipulation' }}
        >
          <div className="relative bg-base" style={{ width: geo.totalW }}>
            <ColumnHeader
              geo={geo}
              letters={g.letters}
              selC1={box.c1}
              selC2={box.c2}
              wholeCol={wholeCol}
              allSelected={wholeCol && wholeRow}
            />
            {geo.frozen > 0 && (
              <div role="rowgroup" className="sticky z-[5] bg-base shadow-[0_2px_0_0_#3a3a3a]" style={{ top: HEADER_H, width: geo.totalW }}>
                <div className="relative" style={{ height: geo.frozenH }}>
                  {frozenRows.map(rowEl)}
                  <OverlayLayer
                    boxes={layers.frozen}
                    handle={showHandle && handleLayer === 'frozen' ? selRects.frozen : undefined}
                    onHandleDown={onHandleDown}
                    onHandleDouble={() => autoFillDownToData(ctx)}
                  />
                  {editLayer === 'frozen' && editor}
                </div>
              </div>
            )}
            <div role="rowgroup" className="relative" style={{ height: geo.bodyH, width: geo.totalW }}>
              <div style={{ height: g.win[0] * ROW_H }} />
              {bodyRows.map(rowEl)}
              <OverlayLayer
                boxes={layers.body}
                handle={showHandle && handleLayer === 'body' ? selRects.body : undefined}
                onHandleDown={onHandleDown}
                onHandleDouble={() => autoFillDownToData(ctx)}
              />
              {editLayer === 'body' && editor}
            </div>
          </div>
        </div>
        {g.toast && (
          <div
            key={g.toast.id}
            role="status"
            aria-live="polite"
            className={`absolute left-1/2 top-8 -translate-x-1/2 z-[30] max-w-[90%] px-3 py-1.5 rounded-md border text-xs shadow-[0_6px_20px_rgba(0,0,0,0.5)] animate-fade-in pointer-events-none ${
              g.toast.tone === 'error' ? 'bg-wrong-dim text-wrong border-wrong/40' : 'bg-overlay text-ink border-edge-bright'
            }`}
          >
            {g.toast.text}
          </div>
        )}
        {chipText && (
          <div
            className={`absolute left-2 bottom-2 z-[20] max-w-[min(32rem,85%)] px-2.5 py-1 rounded-md border text-[11px] leading-snug shadow-[0_4px_14px_rgba(0,0,0,0.45)] pointer-events-none ${
              chipTone === 'error' ? 'bg-wrong-dim/95 text-wrong border-wrong/30' : 'bg-overlay/95 text-ink-secondary border-edge-bright'
            }`}
          >
            {chipText}
          </div>
        )}
      </div>
      <p id={`${g.gridId}-keys`} hidden>
        Arrow keys move between cells. Type to enter a value; F2 edits the cell, Enter or Tab finishes. To leave the grid, press
        Escape (twice while editing a cell), then Tab.
      </p>
      <span id={markId(g.gridId, 'ok')} hidden>{MARK_TEXT.ok}</span>
      <span id={markId(g.gridId, 'bad')} hidden>{MARK_TEXT.bad}</span>
      <EditorPopups
        anchor={anchor}
        listId={`${g.gridId}-ac`}
        items={auto?.items ?? []}
        active={auto?.index ?? 0}
        onPick={name => insertFunction(ctx, name)}
        onHover={index => g.setAc({ ...g.ac, prefix: auto?.prefix ?? '', index })}
        hint={hint}
        argIndex={call?.argIndex ?? 0}
      />
    </div>
  )
}
