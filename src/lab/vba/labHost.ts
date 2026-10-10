// labHost.ts - a VbaHost over a LabSheet. During the run every write goes straight into the sheet's engine (no undo
// entries, no version bumps) so the next read sees it and formulas recalculate at once. finish() puts the engine back
// and re-applies the net change with writeCells (one undo step, version bump, subscribers notified). Locked cells raise
// 1004 "The cell is protected" so a macro cannot overwrite given data. Number formats and styles live in side maps.
import { CellValueDetailedType, DetailedCellError } from 'hyperformula'
import type { RawCellContent, SimpleCellAddress } from 'hyperformula'
import { parseInput } from '../engine/input'
import { GRID_COLS, GRID_ROWS, MAX_FORMULA, MAX_TEXT } from '../engine/limits'
import { normRef, parseRange, refPastEdge, toRange, toRef } from '../refs'
import type { CellValue, EditResult, LabSheet } from '../types'
import { VbaError } from './runtime'
import type { CellStyle, VbaHost } from './runtime'
import { epochOf, protectedText } from './labHostUtil'
export { clockFromDate, cssColor } from './labHostUtil'
import { deleteCells } from './labHostDelete'
import { insertCells, moveCells } from './labHostInsert'
import { applyRun, diffRun } from './labHostRun'

/** Monday 5 January 2026, 09:00:00 as an Excel serial: the clock when the caller passes none. */
export const DEFAULT_CLOCK = 46027.375
/** MsgBox and Debug.Print lines kept per run (the last ones): a print in an endless loop must not fill the memory */
export const MAX_MESSAGES = 1000

export interface LabHostOptions {
  activeCell?: string
  selection?: string
  inputs?: string[]                                     // scripted InputBox answers, in order ('' = Cancel)
  msgBoxReplies?: number[]                              // scripted MsgBox return values (vbYes = 6 ...)
  prompt?: (text: string, def: string) => string | null // asked when the scripted inputs run out; null = Cancel
  clock?: number                                        // Excel serial for Now / NOW()
  seed?: number                                         // Rnd seed
}

/** Extra host services used by the Excel object model (objects*.ts checks for them at run time). */
export interface HostExtras {
  setNow(serial: number): void                          // Application.Wait
  locked(row: number, col: number): boolean
  hasFormula(row: number, col: number): boolean
  evaluateArray(formula: string): CellValue | CellValue[][]
  batch<T>(fn: () => T): T                              // many writes, one recalculation
  knowsFunction(name: string): boolean                  // 'NORM.INV' -> true when the engine has it
  deleteCells(r1: number, c1: number, r2: number, c2: number, shift: 'up' | 'left'): void   // Range.Delete
  insertCells(r1: number, c1: number, r2: number, c2: number, shift: 'down' | 'right'): void  // Range.Insert
  moveCells(r1: number, c1: number, r2: number, c2: number, row: number, col: number): void  // Cut, then Paste
}

export interface LabHost extends VbaHost, HostExtras {
  readonly sheet: LabSheet
  readonly messages: string[]                           // MsgBox prompts and Debug.Print lines, in order (the last MAX_MESSAGES or more)
  readonly styles: ReadonlyMap<string, CellStyle>       // font/fill set by the run ('B4' -> style; colours are VBA longs, see cssColor)
  finalSelection(): { range: string; active: string }
  finish(): EditResult                                  // apply the run as one undo step (idempotent)
  discard(): void                                       // put the sheet back as it was before the run
}

// an unscripted MsgBox answers with its default button, as if the learner pressed Enter: the first button unless
// vbDefaultButton2/3 (256/512) picks another (OK/Cancel -> OK, Yes/No -> Yes, Yes/No + vbDefaultButton2 -> No)
const BUTTON_REPLIES: Record<number, number[]> = { 0: [1], 1: [1, 2], 2: [3, 4, 5], 3: [6, 7, 2], 4: [6, 7], 5: [4, 2] }
function firstButtonReply(buttons: number): number {
  const replies = BUTTON_REPLIES[buttons & 7] ?? [1]
  const pick = (buttons >> 8) & 3
  return replies[pick < replies.length ? pick : 0]
}

// mulberry32: small, fast, deterministic per seed
function seeded(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cleanRange(text: string | undefined, fallback: string): string {
  try {
    return text ? text.split(',').map((p) => toRange(parseRange(p.trim()))).join(',') : fallback
  } catch {
    return fallback
  }
}

export function createLabHost(sheet: LabSheet, opts: LabHostOptions = {}): LabHost {
  const hf = sheet.hf
  const sheetId = sheet.sheetId
  const inputs = [...(opts.inputs ?? [])]
  const replies = [...(opts.msgBoxReplies ?? [])]
  const messages: string[] = []
  const fmts = new Map<string, string>()
  const typed = new Map<string, string>()                // '12%' typed through Formula/Value: kept as the entry text
  const styles = new Map<string, CellStyle>()
  const specBold = new Map<string, boolean>()
  for (const [key, cell] of Object.entries(sheet.spec.cells ?? {})) {
    try {
      if (cell.bold) specBold.set(normRef(key), true)
    } catch {
      // a bad spec key is the sheet's problem, not the macro's
    }
  }
  const rnd = seeded(opts.seed ?? 1)
  let clock = Number.isFinite(opts.clock) ? (opts.clock as number) : DEFAULT_CLOCK
  let finished = false
  const firstArea = cleanRange(opts.selection, '').split(',')[0]
  let active = cleanRange(opts.activeCell, firstArea ? firstArea.split(':')[0] : 'A1')
  let range = cleanRange(opts.selection, active)

  const at = (row: number, col: number): SimpleCellAddress => ({ sheet: sheetId, row: row - 1, col: col - 1 })
  const refOf = (row: number, col: number): string => toRef(row - 1, col - 1)
  const inside = (row: number, col: number): boolean => row >= 1 && col >= 1 && row <= sheet.rows && col <= sheet.cols

  // NOW()/TODAY() in the engine use Date.now: point it at the mock clock while the engine works
  function withClock<T>(fn: () => T): T {
    const real = Date.now
    const fixed = epochOf(clock)
    Date.now = () => fixed
    try {
      return fn()
    } finally {
      Date.now = real
    }
  }
  const scratch = (): SimpleCellAddress | undefined => {
    const id = hf.getSheetId('__lab')
    return id === undefined ? undefined : { sheet: id, row: 0, col: 0 }
  }
  // re-evaluate volatile cells (NOW, TODAY) without changing any content
  function touchVolatile(): void {
    const s = scratch()
    if (s) hf.setCellContents(s, [[hf.getCellSerialized(s) ?? null]])
  }

  const before = hf.getSheetSerialized(sheetId)
  withClock(touchVolatile)
  let batching = 0
  let functionNames: Set<string> | undefined
  const say = (text: string): void => {
    messages.push(text)
    if (messages.length >= 2 * MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES)
  }

  function guard(row: number, col: number): SimpleCellAddress {
    if (finished) throw new VbaError(1004, 'The macro has already finished')
    if (!inside(row, col)) throw new VbaError(1004, `${row > 0 && col > 0 ? refOf(row, col) : 'That cell'} is outside the lab sheet`)
    const ref = refOf(row, col)
    if (!sheet.editable(ref)) throw new VbaError(1004, protectedText(ref))
    const a = at(row, col)
    if (!hf.isItPossibleToSetCellContents(a)) throw new VbaError(1004, `You can't change part of an array (${ref} is filled by a formula that spills)`)
    return a
  }
  function put(row: number, col: number, content: RawCellContent): void {
    const a = guard(row, col)
    // Excel's cell limits: 32,767 characters of text, 8,192 in a formula (VBA strings can be far longer)
    if (typeof content === 'string' && content.length > (content.startsWith('=') ? MAX_FORMULA : MAX_TEXT + 1)) {
      throw new VbaError(1004, content.startsWith('=')
        ? `Application-defined or object-defined error (a formula can have at most ${MAX_FORMULA.toLocaleString('en-US')} characters)`
        : `Application-defined or object-defined error (a cell can hold at most ${MAX_TEXT.toLocaleString('en-US')} characters)`)
    }
    typed.delete(refOf(row, col))
    if (batching) hf.setCellContents(a, [[content]])
    else withClock(() => hf.setCellContents(a, [[content]]))
  }
  function storedFmt(ref: string): string | undefined {
    return fmts.has(ref) ? fmts.get(ref) : sheet.fmt(ref)
  }
  function typeFormat(row: number, col: number): string | undefined {
    if (batching) return undefined // the engine cannot answer while a batch is open
    const type = hf.getCellValueDetailedType(at(row, col))
    if (type === CellValueDetailedType.NUMBER_DATE) return 'dd/mm/yyyy'
    if (type === CellValueDetailedType.NUMBER_DATETIME) return 'dd/mm/yyyy h:mm'
    if (type === CellValueDetailedType.NUMBER_TIME) return 'h:mm AM/PM'
    return undefined
  }
  function engineValue(v: unknown): CellValue {
    if (v instanceof DetailedCellError) return v.value
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
    return null
  }

  const host: LabHost = {
    sheet,
    messages,
    styles,
    get sheetName() { return sheet.name },
    get rows() { return sheet.rows },
    get cols() { return sheet.cols },
    value(row, col) {
      if (!inside(row, col)) return null
      return sheet.read(refOf(row, col)).value
    },
    formula(row, col) {
      return inside(row, col) ? sheet.raw(refOf(row, col)) : ''
    },
    hasFormula(row, col) {
      return inside(row, col) && hf.doesCellHaveFormula(at(row, col))
    },
    setFormula(row, col, text) {
      // Range.Value = " " stores a space (the cell is not empty), as typing a space into a cell does in Excel
      if (text !== '' && text.trim() === '') return put(row, col, `'${text}`)
      const p = parseInput(text)
      if (p.kind === 'empty') return put(row, col, null)
      if (p.kind === 'formula') {
        if (!hf.validateFormula(p.formula)) throw new VbaError(1004, `Application-defined or object-defined error (the formula ${p.formula} has a syntax error)`)
        const far = refPastEdge(p.formula, GRID_ROWS, GRID_COLS)
        if (far) throw new VbaError(1004, `Application-defined or object-defined error (${far} is past the edge of the lab's sheet)`)
        return put(row, col, p.formula)
      }
      put(row, col, typeof p.value === 'string' ? `'${p.value}` : p.value)
      const ref = refOf(row, col)
      if (p.fmt && (storedFmt(ref) ?? 'General') === 'General') {
        fmts.set(ref, p.fmt)
        typed.set(ref, text.trim())
      }
    },
    setValue(row, col, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new VbaError(6)
      put(row, col, typeof value === 'string' ? (value === '' ? null : `'${value}`) : value)
    },
    numberFormat(row, col) {
      return storedFmt(refOf(row, col)) ?? typeFormat(row, col) ?? 'General'
    },
    setNumberFormat(row, col, code) {
      if (!inside(row, col)) throw new VbaError(1004)
      fmts.set(refOf(row, col), code === '' ? 'General' : code)
    },
    style(row, col) {
      const ref = refOf(row, col)
      const base: CellStyle = specBold.has(ref) ? { bold: true } : {}
      return { ...base, ...styles.get(ref) }
    },
    setStyle(row, col, patch) {
      if (!inside(row, col)) throw new VbaError(1004)
      const ref = refOf(row, col)
      styles.set(ref, { ...styles.get(ref), ...patch })
    },
    clear(r1, c1, r2, c2, what) {
      if (what !== 'formats') {
        const full: [number, number][] = []
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            guard(r, c)
            if (hf.getCellSerialized(at(r, c)) !== null) full.push([r, c])
          }
        }
        if (full.length) host.batch(() => full.forEach(([r, c]) => put(r, c, null)))
      }
      if (what === 'contents') return
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const ref = refOf(r, c)
          fmts.set(ref, 'General')
          styles.set(ref, { bold: false, italic: false, fontColor: undefined, fill: undefined })
        }
      }
    },
    recalc() {
      withClock(() => sheet.recalc())
    },
    evaluate(formula) {
      const v = host.evaluateArray(formula)
      return Array.isArray(v) ? (v[0]?.[0] ?? null) : v
    },
    evaluateArray(formula) {
      try {
        const v = withClock(() => hf.calculateFormula(formula, sheetId))
        if (Array.isArray(v)) return v.map((line) => line.map(engineValue))
        return engineValue(v)
      } catch {
        return '#NAME?'
      }
    },
    batch(fn) {
      batching += 1
      const real = Date.now
      const fixed = epochOf(clock)
      Date.now = () => fixed
      try {
        let out: ReturnType<typeof fn> | undefined
        hf.batch(() => { out = fn() })
        return out as ReturnType<typeof fn>
      } finally {
        Date.now = real
        batching -= 1
      }
    },
    knowsFunction(name) {
      functionNames ??= new Set(hf.getRegisteredFunctionNames().map((n) => n.toUpperCase()))
      return functionNames.has(name.toUpperCase())
    },
    locked(row, col) {
      return !inside(row, col) || !sheet.editable(refOf(row, col))
    },
    selection() {
      return { range, active }
    },
    finalSelection() {
      return { range, active }
    },
    select(next, act) {
      range = cleanRange(next, range)
      active = cleanRange(act, active)
    },
    msgBox(prompt, buttons) {
      say(prompt)
      return replies.length ? (replies.shift() as number) : firstButtonReply(buttons)
    },
    inputBox(prompt, _title, def) {
      if (inputs.length) return inputs.shift() ?? null
      return opts.prompt ? opts.prompt(prompt, def) : null
    },
    print(text) {
      say(text)
    },
    now() {
      return clock
    },
    setNow(serial) {
      if (Number.isFinite(serial)) clock = serial
    },
    random() {
      return rnd()
    },
    deleteCells(r1, c1, r2, c2, shift) {
      if (finished) throw new VbaError(1004, 'The macro has already finished')
      withClock(() => deleteCells(sheet, { r1, c1, r2, c2 }, shift))
    },
    insertCells(r1, c1, r2, c2, shift) {
      if (finished) throw new VbaError(1004, 'The macro has already finished')
      withClock(() => insertCells(sheet, { r1, c1, r2, c2 }, shift))
    },
    moveCells(r1, c1, r2, c2, row, col) {
      if (finished) throw new VbaError(1004, 'The macro has already finished')
      withClock(() => moveCells(sheet, { r1, c1, r2, c2 }, row, col))
    },
    finish() {
      if (finished) return { ok: true }
      finished = true
      return applyRun(sheet, before, { fmts, typed }, touchVolatile)
    },
    discard() {
      if (finished) return
      finished = true
      const { restore } = diffRun(sheet, before)
      if (restore.length) hf.batch(() => restore.forEach(([a, content]) => hf.setCellContents(a, [[content]])))
      touchVolatile()
    },
  }
  return host
}
